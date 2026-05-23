import { Router, Response } from 'express';
import { pool } from '../db.js';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken, requireAdmin);

router.get('/users', async (_req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, u.real_name, u.is_admin, u.created_at,
             COUNT(q.id) as question_count
      FROM users u
      LEFT JOIN questions q ON q.user_id = u.id
      WHERE u.is_admin = FALSE
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    return res.json({ users: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/users/:userId/questions', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(`
      SELECT q.id, q.title, q.content, q.created_at, q.updated_at,
             u.username, u.real_name, u.id as user_id,
             COUNT(DISTINCT a.id) as answer_count,
             ARRAY_AGG(DISTINCT qt.tag) FILTER (WHERE qt.tag IS NOT NULL) as tags
      FROM questions q
      JOIN users u ON q.user_id = u.id
      LEFT JOIN answers a ON a.question_id = q.id
      LEFT JOIN question_tags qt ON qt.question_id = q.id
      WHERE q.user_id = $1
      GROUP BY q.id, u.username, u.real_name, u.id
      ORDER BY q.created_at DESC
    `, [userId]);
    return res.json({ questions: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
