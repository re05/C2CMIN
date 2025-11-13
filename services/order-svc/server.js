import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(express.json());

const allowedOrigin = 'http://localhost:3000';
app.use(cors({ origin: true, methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'], credentials: false }));
app.options('*', (req,res)=>res.sendStatus(204));

const pool = new pg.Pool({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });

function authRequired(req,res,next){
  const h = req.headers['authorization'] || '';
  const [scheme, token] = h.split(' ');
  if(scheme !== 'Bearer' || !token) return res.status(401).json({error:'unauthorized'});
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // sub=email, role, uid
    next();
  } catch(e) {
    return res.status(401).json({error:'unauthorized'});
  }
}

function adminRequired(req,res,next){
  if(!req.user || req.user.role !== 'admin') return res.status(403).json({error:'forbidden'});
  next();
}

app.get('/health', (req,res)=>res.json({ok:true, service: 'order-svc'}));

// POST /orders {listingId}
app.post('/orders', authRequired, async (req,res)=>{
  const { listingId } = req.body || {};
  const lid = Number.parseInt(listingId,10);
  if(!Number.isFinite(lid)) return res.status(400).json({error:'bad_request'});
  const client = await pool.connect();
  try{
    await client.query('BEGIN');
    const l = await client.query('SELECT id,title,price,status,seller_id FROM listings WHERE id=$1 FOR UPDATE',[lid]);
    if(l.rowCount===0){ await client.query('ROLLBACK'); return res.status(404).json({error:'not_found'}); }
    const listing = l.rows[0];
    if(listing.seller_id === req.user.uid){ await client.query('ROLLBACK'); return res.status(403).json({error:'cannot_buy_own'}); }
    if(listing.status !== 'Active'){ await client.query('ROLLBACK'); return res.status(409).json({error:'not_active'}); }
    await client.query('UPDATE listings SET status=$1 WHERE id=$2',['Sold', lid]);
    const o = await client.query('INSERT INTO orders(listing_id,buyer_id,status) VALUES($1,$2,$3) RETURNING id,listing_id,buyer_id,status,created_at',[lid, req.user.uid, 'CREATED']);
    await client.query('COMMIT');
    return res.status(201).json({ order: o.rows[0] });
  }catch(e){
    await client.query('ROLLBACK');
    console.error(e);
    return res.status(500).json({error:'server_error'});
  } finally {
    client.release();
  }
});

// GET /orders/buyer/me
app.get('/orders/buyer/me', authRequired, async (req,res)=>{
  try{
    const r = await pool.query('SELECT id,listing_id,buyer_id,status,created_at FROM orders WHERE buyer_id=$1 ORDER BY id DESC',[req.user.uid]);
    return res.json(r.rows);
  }catch(e){ console.error(e); return res.status(500).json({error:'server_error'}); }
});


const port = 4020;
app.listen(port, ()=>{ console.log('listening on', port); });

