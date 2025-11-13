import { Router } from 'express';
import { pool } from './db.js';
import { requireAuth, requireAdmin } from './jwt.js';

const r = Router();

r.get('/listings/mine', requireAuth, async (req, res) => {
  const { uid } = req.user;
  const { rows } = await pool.query('SELECT * FROM listings WHERE seller_id=$1 ORDER BY id DESC', [uid]);
  res.json(rows);
});

r.get('/listings', async (req, res) => {
  const { q, status, sellerId } = req.query;
  const wh = [];
  const args = [];
  if (status) { args.push(status); wh.push(`status=$${args.length}`); }
  if (sellerId) { args.push(Number(sellerId)); wh.push(`seller_id=$${args.length}`); }
  if (q) { args.push(`%${q}%`); wh.push(`title ILIKE $${args.length}`); }
  const sql = wh.length ? `SELECT * FROM listings WHERE ${wh.join(' AND ')} ORDER BY id DESC`
                        : `SELECT * FROM listings WHERE status='Active' ORDER BY id DESC`;
  const { rows } = await pool.query(sql, args);
  res.json(rows);
});

r.post('/listings', requireAuth, async (req, res) => {
  const { title, price } = req.body || {};
  if (!title || price == null || price < 0) return res.status(400).json({ error: 'bad request' });
  const { uid } = req.user;
  const { rows } = await pool.query(
    'INSERT INTO listings (title, price, status, seller_id) VALUES ($1,$2,$3,$4) RETURNING *',
    [title, price, 'Active', uid]
  );
  res.status(201).json(rows[0]);
});

r.delete('/listings/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad id' });
  const { uid } = req.user;
  const { rowCount } = await pool.query(
    "DELETE FROM listings WHERE id=$1 AND seller_id=$2 AND status='Active'",
    [id, uid]
  );
  if (rowCount === 0) return res.status(404).json({ error: 'not found or not deletable' });
  res.status(204).end();
});

r.patch('/listings/:id/pause', requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad id' });
  const { rows } = await pool.query("UPDATE listings SET status='Paused' WHERE id=$1 RETURNING *",[id]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});

r.patch('/listings/:id/activate', requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad id' });
  const { rows } = await pool.query("UPDATE listings SET status='Active' WHERE id=$1 RETURNING *",[id]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});

export default r;
