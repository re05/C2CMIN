import { Router } from 'express';
import { pool } from './db.js';
import { requireAuth } from './jwt.js';

const r = Router();

r.post('/orders', requireAuth, async (req, res) => {
  const { listingId } = req.body || {};
  const { uid } = req.user;
  if (!Number.isInteger(Number(listingId))) return res.status(400).json({ error: 'bad listingId' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const l = await client.query('SELECT id, seller_id, status FROM listings WHERE id=$1 FOR UPDATE', [listingId]);
    if (!l.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not found' }); }
    const row = l.rows[0];
    if (row.seller_id === uid) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'cannot buy own listing' }); }
    if (row.status !== 'Active') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'not purchasable' }); }

    const upd = await client.query("UPDATE listings SET status='Sold' WHERE id=$1 AND status='Active'", [listingId]);
    if (upd.rowCount !== 1) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'race condition' }); }

    const ord = await client.query('INSERT INTO orders (listing_id, buyer_id, status) VALUES ($1,$2,$3) RETURNING *', [listingId, uid, 'CREATED']);
    await client.query('COMMIT');
    return res.status(201).json(ord.rows[0]);
  } catch {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'internal' });
  } finally {
    client.release();
  }
});

r.get('/orders/buyer/me', requireAuth, async (req, res) => {
  const { uid } = req.user;
  const { rows } = await pool.query('SELECT * FROM orders WHERE buyer_id=$1 ORDER BY id DESC', [uid]);
  res.json(rows);
});

export default r;
