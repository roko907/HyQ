import { Router, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

const QuestionSchema = z.object({
  title: z.string().min(5).max(255),
  content: z.string().min(10),
  tags: z.array(z.string().max(50)).max(5).optional(),
});

const AnswerSchema = z.object({
  content: z.string().min(5),
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { search, tag, page = '1', limit = '10' } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT q.id, q.title, q.content, q.created_at, q.updated_at,
             u.username, u.id as user_id,
             COUNT(DISTINCT a.id) as answer_count,
             ARRAY_AGG(DISTINCT qt.tag) FILTER (WHERE qt.tag IS NOT NULL) as tags
      FROM questions q
      JOIN users u ON q.user_id = u.id
      LEFT JOIN answers a ON a.question_id = q.id
      LEFT JOIN question_tags qt ON qt.question_id = q.id
    `;
    const params: (string | number)[] = [];
    const conditions: string[] = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(q.title ILIKE $${params.length} OR q.content ILIKE $${params.length})`);
    }
    if (tag) {
      params.push(tag);
      conditions.push(`EXISTS (SELECT 1 FROM question_tags qt2 WHERE qt2.question_id = q.id AND qt2.tag = $${params.length})`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ` GROUP BY q.id, u.username, u.id ORDER BY q.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    const countQuery = `SELECT COUNT(*) FROM questions q ${conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''}`;
    const countResult = await pool.query(countQuery, params.slice(0, params.length - 2));

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

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT q.id, q.title, q.content, q.created_at, q.updated_at,
              u.username, u.id as user_id,
              ARRAY_AGG(DISTINCT qt.tag) FILTER (WHERE qt.tag IS NOT NULL) as tags
       FROM questions q
       JOIN users u ON q.user_id = u.id
       LEFT JOIN question_tags qt ON qt.question_id = q.id
       WHERE q.id = $1
       GROUP BY q.id, u.username, u.id`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const answers = await pool.query(
      `SELECT a.id, a.content, a.is_accepted, a.created_at,
              u.username, u.id as user_id
       FROM answers a
       JOIN users u ON a.user_id = u.id
       WHERE a.question_id = $1
       ORDER BY a.is_accepted DESC, a.created_at ASC`,
      [id]
    );

    return res.json({ question: result.rows[0], answers: answers.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { title, content, tags } = QuestionSchema.parse(req.body);

    const result = await pool.query(
      'INSERT INTO questions (title, content, user_id) VALUES ($1, $2, $3) RETURNING id, title, content, created_at',
      [title, content, req.userId]
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

router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, content, tags } = QuestionSchema.parse(req.body);

    const existing = await pool.query('SELECT user_id FROM questions WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (existing.rows[0].user_id !== req.userId) return res.status(403).json({ error: 'Forbidden' });

    await pool.query(
      'UPDATE questions SET title = $1, content = $2, updated_at = NOW() WHERE id = $3',
      [title, content, id]
    );

    if (tags !== undefined) {
      await pool.query('DELETE FROM question_tags WHERE question_id = $1', [id]);
      for (const tag of tags) {
        await pool.query(
          'INSERT INTO question_tags (question_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [id, tag.toLowerCase()]
        );
      }
    }

    return res.json({ success: true });
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
    if (existing.rows[0].user_id !== req.userId) return res.status(403).json({ error: 'Forbidden' });

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
    const { content } = AnswerSchema.parse(req.body);

    const question = await pool.query('SELECT id FROM questions WHERE id = $1', [id]);
    if (question.rows.length === 0) return res.status(404).json({ error: 'Question not found' });

    const result = await pool.query(
      'INSERT INTO answers (content, question_id, user_id) VALUES ($1, $2, $3) RETURNING id, content, is_accepted, created_at',
      [content, id, req.userId]
    );

    const userResult = await pool.query('SELECT username FROM users WHERE id = $1', [req.userId]);

    return res.status(201).json({
      answer: { ...result.rows[0], username: userResult.rows[0].username, user_id: req.userId }
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:questionId/answers/:answerId/accept', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { questionId, answerId } = req.params;
    const question = await pool.query('SELECT user_id FROM questions WHERE id = $1', [questionId]);
    if (question.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (question.rows[0].user_id !== req.userId) return res.status(403).json({ error: 'Only the question author can accept answers' });

    await pool.query('UPDATE answers SET is_accepted = FALSE WHERE question_id = $1', [questionId]);
    await pool.query('UPDATE answers SET is_accepted = TRUE WHERE id = $1', [answerId]);

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:questionId/answers/:answerId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { answerId } = req.params;
    const answer = await pool.query('SELECT user_id FROM answers WHERE id = $1', [answerId]);
    if (answer.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (answer.rows[0].user_id !== req.userId) return res.status(403).json({ error: 'Forbidden' });

    await pool.query('DELETE FROM answers WHERE id = $1', [answerId]);
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
