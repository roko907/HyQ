import { Router, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

const QuestionSchema = z.object({
  title: z.string().min(5).max(255),
  content: z.string().min(1),
  image_url: z.string().optional().nullable(),
  tags: z.array(z.string().max(50)).max(5).optional(),
});

const AnswerSchema = z.object({
  content: z.string(),
  image_url: z.string().optional().nullable(),
});

router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { search, page = '1', limit = '50' } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (!req.isAdmin) {
      params.push(req.userId!);
      conditions.push(`q.user_id = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(q.title ILIKE $${params.length} OR q.content ILIKE $${params.length})`);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const query = `
      SELECT q.id, q.title, q.content, q.image_url, q.created_at, q.updated_at,
             q.admin_read_at, q.user_read_at,
             u.username, u.real_name, u.id as user_id,
             COUNT(DISTINCT a.id) as answer_count,
             MAX(a.created_at) as last_answer_at,
             ARRAY_AGG(DISTINCT qt.tag) FILTER (WHERE qt.tag IS NOT NULL) as tags
      FROM questions q
      JOIN users u ON q.user_id = u.id
      LEFT JOIN answers a ON a.question_id = q.id
      LEFT JOIN question_tags qt ON qt.question_id = q.id
      ${where}
      GROUP BY q.id, u.username, u.real_name, u.id
      ORDER BY q.updated_at DESC, q.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    const countParams = params.slice(0, params.length - 2);
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM questions q JOIN users u ON q.user_id = u.id ${where}`,
      countParams
    );

    return res.json({
      questions: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT q.id, q.title, q.content, q.image_url, q.created_at, q.updated_at,
              q.admin_read_at, q.user_read_at,
              u.username, u.real_name, u.id as user_id,
              ARRAY_AGG(DISTINCT qt.tag) FILTER (WHERE qt.tag IS NOT NULL) as tags
       FROM questions q
       JOIN users u ON q.user_id = u.id
       LEFT JOIN question_tags qt ON qt.question_id = q.id
       WHERE q.id = $1
       GROUP BY q.id, u.username, u.real_name, u.id`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const question = result.rows[0];
    if (!req.isAdmin && question.user_id !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (req.isAdmin) {
      await pool.query('UPDATE questions SET admin_read_at = NOW() WHERE id = $1', [id]);
      question.admin_read_at = new Date();
    } else {
      await pool.query('UPDATE questions SET user_read_at = NOW() WHERE id = $1', [id]);
      question.user_read_at = new Date();
    }

    const answers = await pool.query(
      `SELECT a.id, a.content, a.image_url, a.is_accepted, a.created_at,
              u.username, u.real_name, u.id as user_id, u.is_admin as sender_is_admin
       FROM answers a
       JOIN users u ON a.user_id = u.id
       WHERE a.question_id = $1
       ORDER BY a.created_at ASC`,
      [id]
    );

    return res.json({ question, answers: answers.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { title, content, image_url, tags } = QuestionSchema.parse(req.body);

    const result = await pool.query(
      'INSERT INTO questions (title, content, image_url, user_id) VALUES ($1, $2, $3, $4) RETURNING id, title, content, image_url, created_at, updated_at',
      [title, content, image_url || null, req.userId]
    );
    const question = result.rows[0];

    if (tags && tags.length > 0) {
      for (const tag of tags) {
        await pool.query(
          'INSERT INTO question_tags (question_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [question.id, tag.toLowerCase()]
        );
      }
    }

    return res.status(201).json({ question: { ...question, tags: tags || [] } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await pool.query('SELECT user_id FROM questions WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (!req.isAdmin && existing.rows[0].user_id !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await pool.query('DELETE FROM questions WHERE id = $1', [id]);
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/answers', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content, image_url } = AnswerSchema.parse(req.body);

    if (!content.trim() && !image_url) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    const question = await pool.query('SELECT id, user_id FROM questions WHERE id = $1', [id]);
    if (question.rows.length === 0) return res.status(404).json({ error: 'Question not found' });
    if (!req.isAdmin && question.rows[0].user_id !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      'INSERT INTO answers (content, image_url, question_id, user_id) VALUES ($1, $2, $3, $4) RETURNING id, content, image_url, is_accepted, created_at',
      [content, image_url || null, id, req.userId]
    );

    await pool.query('UPDATE questions SET updated_at = NOW() WHERE id = $1', [id]);

    const userResult = await pool.query(
      'SELECT username, real_name, is_admin FROM users WHERE id = $1',
      [req.userId]
    );

    return res.status(201).json({
      answer: {
        ...result.rows[0],
        username: userResult.rows[0].username,
        real_name: userResult.rows[0].real_name,
        sender_is_admin: userResult.rows[0].is_admin,
        user_id: req.userId,
      }
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:questionId/answers/:answerId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { answerId } = req.params;
    const answer = await pool.query('SELECT user_id FROM answers WHERE id = $1', [answerId]);
    if (answer.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (!req.isAdmin && answer.rows[0].user_id !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await pool.query('DELETE FROM answers WHERE id = $1', [answerId]);
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
