// order-svc/server.js
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const app = express();

app.use(cors({
  origin: ['http://localhost:3100', 'http://localhost:3000'],
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: false,
  optionsSuccessStatus: 204
}));
app.options('*', (req,res)=>res.sendStatus(204));

app.use(express.json());

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

function authRequired(req,res,next){
  const h = req.headers['authorization'] || '';
  const [scheme, token] = h.split(' ');
  if(scheme !== 'Bearer' || !token) return res.status(401).json({error:'unauthorized'});
  try{
    req.user = jwt.verify(token, process.env.JWT_SECRET); // uid, role, sub
    next();
  }catch(e){
    return res.status(401).json({error:'unauthorized'});
  }
}

app.get('/health',(req,res)=>res.json({ok:true, service:'order-svc'}));

/**
 * 購入: status = CREATED
 */
app.post('/orders', authRequired, async (req,res)=>{
  const { listingId } = req.body || {};
  if(!listingId) return res.status(400).json({error:'bad_request'});

  const client = await pool.connect();
  try{
    await client.query('BEGIN');

    const q1 = await client.query(
      'SELECT id,title,price,status,seller_id FROM listings WHERE id=$1 FOR UPDATE',
      [listingId]
    );
    if(q1.rowCount === 0){
      await client.query('ROLLBACK');
      return res.status(404).json({error:'not_found'});
    }
    const l = q1.rows[0];

    if(l.seller_id === req.user.uid){
      await client.query('ROLLBACK');
      return res.status(403).json({error:'own_listing'});
    }
    if(l.status !== 'Active'){
      await client.query('ROLLBACK');
      return res.status(409).json({error:'not_active'});
    }

    const q2 = await client.query(
      'INSERT INTO orders(listing_id,buyer_id,status) VALUES($1,$2,$3) RETURNING id,status,created_at',
      [listingId, req.user.uid, 'CREATED']
    );
    const o = q2.rows[0];

    await client.query(
      'UPDATE listings SET status=$1 WHERE id=$2',
      ['Sold', listingId]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      id: o.id,
      status: o.status,
      created_at: o.created_at,
      listing_id: l.id,
      title: l.title,
      price: l.price,
      seller_id: l.seller_id,
      buyer_id: req.user.uid
    });

  }catch(e){
    await client.query('ROLLBACK');
    console.error(e);
    return res.status(500).json({error:'server_error'});
  }finally{
    client.release();
  }
});

/**
 * 自分が買った注文一覧
 */
app.get('/orders/buyer/me', authRequired, async (req,res)=>{
  try{
    const q = await pool.query(
      `SELECT o.id, o.status, o.created_at,
              o.buyer_id,
              l.id AS listing_id, l.title, l.price, l.seller_id
       FROM orders o
       JOIN listings l ON o.listing_id = l.id
       WHERE o.buyer_id = $1
       ORDER BY o.id DESC`,
      [req.user.uid]
    );
    return res.json(q.rows);
  }catch(e){
    console.error(e);
    return res.status(500).json({error:'server_error'});
  }
});

/**
 * 自分の出品が売れた注文一覧
 */
app.get('/orders/seller/me', authRequired, async (req,res)=>{
  try{
    const q = await pool.query(
      `SELECT o.id, o.status, o.created_at,
              o.buyer_id,
              l.id AS listing_id, l.title, l.price, l.seller_id
       FROM orders o
       JOIN listings l ON o.listing_id = l.id
       WHERE l.seller_id = $1
       ORDER BY o.id DESC`,
      [req.user.uid]
    );
    return res.json(q.rows);
  }catch(e){
    console.error(e);
    return res.status(500).json({error:'server_error'});
  }
});

/**
 * 取引詳細取得（買い手・売り手・admin 用）
 * フロントの取引詳細画面はこれを使う
 */
app.get('/orders/:id', authRequired, async (req,res)=>{
  const id = Number(req.params.id);
  if(!Number.isInteger(id)) return res.status(400).json({error:'bad_id'});

  try{
    const q = await pool.query(
      `SELECT
         o.id,
         o.status,
         o.created_at,
         o.buyer_id,
         o.listing_id,
         l.title,
         l.price,
         l.seller_id
       FROM orders o
       JOIN listings l ON o.listing_id = l.id
       WHERE o.id = $1`,
      [id]
    );
    if(q.rowCount === 0) return res.status(404).json({error:'not_found'});
    const o = q.rows[0];

    // admin は全て閲覧可
    if(req.user.role !== 'admin'){
      if(o.buyer_id !== req.user.uid && o.seller_id !== req.user.uid){
        return res.status(403).json({error:'forbidden'});
      }
    }

    return res.json(o);
  }catch(e){
    console.error(e);
    return res.status(500).json({error:'server_error'});
  }
});

/**
 * 発送済みにする（出品者）
 * CREATED -> SHIPPING
 */
app.patch('/orders/:id/ship', authRequired, async (req,res)=>{
  const id = Number(req.params.id);
  if(!Number.isInteger(id)) return res.status(400).json({error:'bad_id'});

  const client = await pool.connect();
  try{
    await client.query('BEGIN');
    const q = await client.query(
      `SELECT o.id, o.status,
              l.seller_id
       FROM orders o
       JOIN listings l ON o.listing_id = l.id
       WHERE o.id = $1
       FOR UPDATE`,
      [id]
    );
    if(q.rowCount === 0){
      await client.query('ROLLBACK');
      return res.status(404).json({error:'not_found'});
    }
    const o = q.rows[0];

    if(o.seller_id !== req.user.uid){
      await client.query('ROLLBACK');
      return res.status(403).json({error:'forbidden'});
    }
    if(o.status !== 'CREATED'){
      await client.query('ROLLBACK');
      return res.status(409).json({error:'invalid_status'});
    }

    const u = await client.query(
      'UPDATE orders SET status=$1 WHERE id=$2 RETURNING id,status',
      ['SHIPPING', id]
    );
    await client.query('COMMIT');
    return res.json(u.rows[0]);
  }catch(e){
    await client.query('ROLLBACK');
    console.error(e);
    return res.status(500).json({error:'server_error'});
  }finally{
    client.release();
  }
});

/**
 * 到着済みにする（買い手）
 * SHIPPING -> DELIVERED
 */
app.patch('/orders/:id/deliver', authRequired, async (req,res)=>{
  const id = Number(req.params.id);
  if(!Number.isInteger(id)) return res.status(400).json({error:'bad_id'});

  const client = await pool.connect();
  try{
    await client.query('BEGIN');
    const q = await client.query(
      `SELECT id,status,buyer_id FROM orders WHERE id=$1 FOR UPDATE`,
      [id]
    );
    if(q.rowCount === 0){
      await client.query('ROLLBACK');
      return res.status(404).json({error:'not_found'});
    }
    const o = q.rows[0];

    if(o.buyer_id !== req.user.uid){
      await client.query('ROLLBACK');
      return res.status(403).json({error:'forbidden'});
    }
    if(o.status !== 'SHIPPING'){
      await client.query('ROLLBACK');
      return res.status(409).json({error:'invalid_status'});
    }

    const u = await client.query(
      'UPDATE orders SET status=$1 WHERE id=$2 RETURNING id,status',
      ['DELIVERED', id]
    );
    await client.query('COMMIT');
    return res.json(u.rows[0]);
  }catch(e){
    await client.query('ROLLBACK');
    console.error(e);
    return res.status(500).json({error:'server_error'});
  }finally{
    client.release();
  }
});

/**
 * 受け取り評価完了（買い手）
 * DELIVERED -> COMPLETED
 */
app.patch('/orders/:id/complete', authRequired, async (req,res)=>{
  const id = Number(req.params.id);
  if(!Number.isInteger(id)) return res.status(400).json({error:'bad_id'});

  const client = await pool.connect();
  try{
    await client.query('BEGIN');
    const q = await client.query(
      `SELECT id,status,buyer_id FROM orders WHERE id=$1 FOR UPDATE`,
      [id]
    );
    if(q.rowCount === 0){
      await client.query('ROLLBACK');
      return res.status(404).json({error:'not_found'});
    }
    const o = q.rows[0];

    if(o.buyer_id !== req.user.uid){
      await client.query('ROLLBACK');
      return res.status(403).json({error:'forbidden'});
    }
    if(o.status !== 'DELIVERED'){
      await client.query('ROLLBACK');
      return res.status(409).json({error:'invalid_status'});
    }

    const u = await client.query(
      'UPDATE orders SET status=$1 WHERE id=$2 RETURNING id,status',
      ['COMPLETED', id]
    );
    await client.query('COMMIT');
    return res.json(u.rows[0]);
  }catch(e){
    await client.query('ROLLBACK');
    console.error(e);
    return res.status(500).json({error:'server_error'});
  }finally{
    client.release();
  }
});

// =========================
// 取引メッセージ API
// =========================

app.get('/orders/:id/messages', authRequired, async (req,res)=>{
  const id = Number(req.params.id);
  if(!Number.isInteger(id)) return res.status(400).json({error:'bad_id'});

  try{
    const q1 = await pool.query(
      `SELECT o.id, o.buyer_id, o.status, l.seller_id
       FROM orders o
       JOIN listings l ON o.listing_id = l.id
       WHERE o.id = $1`,
      [id]
    );
    if(q1.rowCount === 0) return res.status(404).json({error:'not_found'});
    const o = q1.rows[0];

    if(req.user.role !== 'admin'){
      if(o.buyer_id !== req.user.uid && o.seller_id !== req.user.uid){
        return res.status(403).json({error:'forbidden'});
      }
    }

    const q2 = await pool.query(
      `SELECT id, order_id, sender_id, body, created_at
       FROM order_messages
       WHERE order_id = $1
       ORDER BY id ASC`,
      [id]
    );

    return res.json(q2.rows);
  }catch(e){
    console.error(e);
    return res.status(500).json({error:'server_error'});
  }
});

app.post('/orders/:id/messages', authRequired, async (req,res)=>{
  const id = Number(req.params.id);
  if(!Number.isInteger(id)) return res.status(400).json({error:'bad_id'});

  const { text } = req.body || {};
  const body = (text || '').trim();
  if(!body) return res.status(400).json({error:'empty'});

  try{
    const q1 = await pool.query(
      `SELECT o.id, o.buyer_id, o.status, l.seller_id
       FROM orders o
       JOIN listings l ON o.listing_id = l.id
       WHERE o.id = $1`,
      [id]
    );
    if(q1.rowCount === 0) return res.status(404).json({error:'not_found'});
    const o = q1.rows[0];

    if(req.user.role === 'admin'){
      return res.status(403).json({error:'admin_view_only'});
    }

    if(o.buyer_id !== req.user.uid && o.seller_id !== req.user.uid){
      return res.status(403).json({error:'forbidden'});
    }

    if(o.status === 'COMPLETED'){
      return res.status(409).json({error:'completed'});
    }

    const q2 = await pool.query(
      `INSERT INTO order_messages(order_id, sender_id, body)
       VALUES($1,$2,$3)
       RETURNING id, order_id, sender_id, body, created_at`,
      [id, req.user.uid, body]
    );

    return res.status(201).json(q2.rows[0]);
  }catch(e){
    console.error(e);
    return res.status(500).json({error:'server_error'});
  }
});

// admin 用：全ての取引一覧
app.get('/orders/admin/all', authRequired, async (req,res)=>{
  try{
    if(req.user.role !== 'admin'){
      return res.status(403).json({error:'forbidden'});
    }

    const q = await pool.query(
      `SELECT
         o.id,
         o.status,
         o.buyer_id,
         o.listing_id,
         o.created_at,
         l.title,
         l.price,
         l.seller_id
       FROM orders o
       JOIN listings l ON o.listing_id = l.id
       ORDER BY o.id DESC`
    );

    return res.json(q.rows);
  }catch(e){
    console.error(e);
    return res.status(500).json({error:'server_error'});
  }
});

const PORT = process.env.PORT || 4020;
app.listen(PORT, ()=>console.log('listening on', PORT));
