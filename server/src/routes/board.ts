import { Router, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

const PostSchema = z.object({
  title: z.string().min(3).max(255),
  content: z.string().min(1),
  image_url: z.string().optional().nullable(),
});

const CommentSchema = z.object({
  content: z.string(),
  image_url: z.string().optional().nullable(),
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT p.id, p.title, p.content, p.image_url, p.created_at, p.updated_at,
             COUNT(DISTINCT c.id) as comment_count
      FROM board_posts p
      LEFT JOIN board_comments c ON c.post_id = p.id
      GROUP BY p.id
      ORDER BY p.updated_at DESC, p.created_at DESC
    `);
    return res.json({ posts: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { title, content, image_url } = PostSchema.parse(req.body);
    const result = await pool.query(
      'INSERT INTO board_posts (title, content, image_url, user_id) VALUES ($1, $2, $3, $4) RETURNING id, title, content, image_url, created_at',
      [title, content, image_url || null, req.userId]
    );
    return res.status(201).json({ post: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const postResult = await pool.query(
      'SELECT id, title, content, image_url, user_id, created_at, updated_at FROM board_posts WHERE id = $1',
      [id]
    );
    if (postResult.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
    const post = postResult.rows[0];

    const commentsResult = await pool.query(
      'SELECT id, content, image_url, user_id, created_at FROM board_comments WHERE post_id = $1 ORDER BY created_at ASC',
      [id]
    );
    const rawComments = commentsResult.rows;

    // Build stable anon number map: first commenter = 1, second = 2, ...
    // order by first appearance time (post author also gets a number but shown as "Author")
    const seenUsers: number[] = [];
    for (const c of rawComments) {
      if (!seenUsers.includes(c.user_id)) seenUsers.push(c.user_id);
    }
    const anonMap: Record<number, number> = {};
    seenUsers.forEach((uid, idx) => { anonMap[uid] = idx + 1; });

    const comments = rawComments.map((c) => ({
      id: c.id,
      content: c.content,
      image_url: c.image_url,
      created_at: c.created_at,
      is_author: c.user_id === post.user_id,
      is_me: c.user_id === req.userId,
      anon_num: anonMap[c.user_id] ?? null,
    }));

    // Strip user_id from post before returning
    return res.json({
      post: {
        id: post.id,
        title: post.title,
        content: post.content,
        image_url: post.image_url,
        is_mine: post.user_id === req.userId,
        created_at: post.created_at,
        updated_at: post.updated_at,
      },
      comments,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const post = await pool.query('SELECT user_id FROM board_posts WHERE id = $1', [id]);
    if (post.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (!req.isAdmin && post.rows[0].user_id !== req.userId) return res.status(403).json({ error: 'Forbidden' });
    await pool.query('DELETE FROM board_posts WHERE id = $1', [id]);
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/comments', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content, image_url } = CommentSchema.parse(req.body);
    if (!content.trim() && !image_url) return res.status(400).json({ error: 'Comment cannot be empty' });

    const postResult = await pool.query(
      'SELECT id, user_id FROM board_posts WHERE id = $1', [id]
    );
    if (postResult.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
    const post = postResult.rows[0];

    const result = await pool.query(
      'INSERT INTO board_comments (content, image_url, post_id, user_id) VALUES ($1, $2, $3, $4) RETURNING id, content, image_url, created_at',
      [content, image_url || null, id, req.userId]
    );
    await pool.query('UPDATE board_posts SET updated_at = NOW() WHERE id = $1', [id]);

    // Compute anon_num for this user in the post
    const seenResult = await pool.query(
      'SELECT DISTINCT user_id FROM board_comments WHERE post_id = $1 ORDER BY MIN(created_at) ASC',
      [id]
    );
    // Re-query to get correct order
    const orderedResult = await pool.query(
      `SELECT user_id FROM (
         SELECT user_id, MIN(created_at) as first_time FROM board_comments WHERE post_id = $1 GROUP BY user_id
       ) t ORDER BY first_time ASC`,
      [id]
    );
    const orderedUsers = orderedResult.rows.map((r: { user_id: number }) => r.user_id);
    const anonNum = orderedUsers.indexOf(req.userId!) + 1;

    return res.status(201).json({
      comment: {
        ...result.rows[0],
        is_author: req.userId === post.user_id,
        is_me: true,
        anon_num: anonNum,
      }
    });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:postId/comments/:commentId', async (req: AuthRequest, res: Response) => {
  try {
    const { commentId } = req.params;
    const comment = await pool.query('SELECT user_id FROM board_comments WHERE id = $1', [commentId]);
    if (comment.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (!req.isAdmin && comment.rows[0].user_id !== req.userId) return res.status(403).json({ error: 'Forbidden' });
    await pool.query('DELETE FROM board_comments WHERE id = $1', [commentId]);
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
