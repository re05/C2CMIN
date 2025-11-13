import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';
import { requireAuth } from './jwt.js';

const r = Router();

r.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'bad request' });
  const { rows } = await pool.query('SELECT id, email, role FROM users WHERE email=$1 AND password=$2', [email, password]);
  if (rows.length === 0) return res.status(401).json({ error: 'invalid credentials' });
  const user = rows[0];
  const token = jwt.sign({ sub: user.email, uid: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '2h' });
  return res.json({ token });
});

r.get('/me', requireAuth, async (req, res) => {
  const { uid } = req.user;
  const { rows } = await pool.query('SELECT id, email, role FROM users WHERE id=$1', [uid]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});

export default r;
