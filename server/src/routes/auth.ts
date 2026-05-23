import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '../db.js';
import { generateToken, authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

const RegisterSchema = z.object({
  username: z.string().min(3).max(50),
  real_name: z.string().min(2).max(100),
  password: z.string().min(6),
});

const LoginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, real_name, password } = RegisterSchema.parse(req.body);

    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (username, real_name, password_hash) VALUES ($1, $2, $3) RETURNING id, username, real_name, is_admin, created_at',
      [username, real_name, passwordHash]
    );

    const user = result.rows[0];
    const token = generateToken(user.id, user.username, user.is_admin);

    return res.status(201).json({
      token,
      user: { id: user.id, username: user.username, real_name: user.real_name, is_admin: user.is_admin },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = LoginSchema.parse(req.body);

    const result = await pool.query(
      'SELECT id, username, real_name, is_admin, password_hash FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = generateToken(user.id, user.username, user.is_admin);
    return res.json({
      token,
      user: { id: user.id, username: user.username, real_name: user.real_name, is_admin: user.is_admin },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, username, real_name, is_admin, created_at FROM users WHERE id = $1',
      [req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
