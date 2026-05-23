import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      real_name VARCHAR(100) NOT NULL DEFAULT '',
      password_hash VARCHAR(255) NOT NULL,
      is_admin BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS real_name VARCHAR(100) NOT NULL DEFAULT '';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
    ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

    CREATE TABLE IF NOT EXISTS questions (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      admin_read_at TIMESTAMP,
      user_read_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    ALTER TABLE questions ADD COLUMN IF NOT EXISTS image_url TEXT;
    ALTER TABLE questions ADD COLUMN IF NOT EXISTS admin_read_at TIMESTAMP;
    ALTER TABLE questions ADD COLUMN IF NOT EXISTS user_read_at TIMESTAMP;

    CREATE TABLE IF NOT EXISTS answers (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      image_url TEXT,
      question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      is_accepted BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    );

    ALTER TABLE answers ADD COLUMN IF NOT EXISTS image_url TEXT;

    CREATE TABLE IF NOT EXISTS question_tags (
      question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
      tag VARCHAR(50) NOT NULL,
      PRIMARY KEY (question_id, tag)
    );
  `);

  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';

  const existing = await pool.query('SELECT id FROM users WHERE username = $1', [adminUsername]);
  if (existing.rows.length === 0) {
    const hash = await bcrypt.hash(adminPassword, 12);
    await pool.query(
      `INSERT INTO users (username, real_name, password_hash, is_admin) VALUES ($1, $2, $3, TRUE)`,
      [adminUsername, 'Administrator', hash]
    );
    console.log(`Admin account created — username: "${adminUsername}", password: "${adminPassword}"`);
  } else {
    await pool.query('UPDATE users SET is_admin = TRUE WHERE username = $1', [adminUsername]);
  }
}
