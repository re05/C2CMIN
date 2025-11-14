// listing-svc/server.js
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const app = express();

app.use(cors({
  origin: ['http://localhost:3000','http://localhost:3100'],
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: false,
  optionsSuccessStatus: 204
}));
app.options('*',(req,res)=>res.sendStatus(204));

app.use(express.json());

const pool = new pg.Pool({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

function authRequired(req,res,next){
  const h = req.headers['authorization'] || '';
  const [scheme, token] = h.split(' ');
  if(scheme !== 'Bearer' || !token){
    return res.status(401).json({error:'unauthorized'});
  }
  try{
    req.user = jwt.verify(token, process.env.JWT_SECRET); // uid, role, sub
    next();
  }catch(e){
    return res.status(401).json({error:'unauthorized'});
  }
}

app.get('/health',(req,res)=>res.json({ok:true, service:'listing-svc'}));

/**
 * 出品一覧（だれでも見られる）
 * ?q= を付けるとタイトルのあいまい検索
 * status は Active / Paused / Sold 何でも返す（運営用も兼ねる）
 */
app.get('/listings', async (req,res)=>{
  const q = (req.query.q || '').trim();
  try{
    let rows;
    if(q){
      const r = await pool.query(
        `SELECT id,title,price,status,seller_id
           FROM listings
          WHERE title ILIKE '%' || $1 || '%'
          ORDER BY id DESC`,
        [q]
      );
      rows = r.rows;
    }else{
      const r = await pool.query(
        `SELECT id,title,price,status,seller_id
           FROM listings
          ORDER BY id DESC`
      );
      rows = r.rows;
    }
    return res.json(rows);
  }catch(e){
    console.error(e);
    return res.status(500).json({error:'server_error'});
  }
});

/**
 * 自分の出品一覧
 */
app.get('/listings/mine', authRequired, async (req,res)=>{
  try{
    const r = await pool.query(
      `SELECT id,title,price,status,seller_id
         FROM listings
        WHERE seller_id = $1
        ORDER BY id DESC`,
      [req.user.uid]
    );
    return res.json(r.rows);
  }catch(e){
    console.error(e);
    return res.status(500).json({error:'server_error'});
  }
});

/**
 * 新規出品
 */
app.post('/listings', authRequired, async (req,res)=>{
  const { title, price } = req.body || {};
  if(!title || typeof price !== 'number'){
    return res.status(400).json({error:'bad_request'});
  }
  try{
    const r = await pool.query(
      `INSERT INTO listings(title,price,status,seller_id)
       VALUES($1,$2,$3,$4)
       RETURNING id,title,price,status,seller_id`,
      [title, price, 'Active', req.user.uid]
    );
    return res.status(201).json(r.rows[0]);
  }catch(e){
    console.error(e);
    return res.status(500).json({error:'server_error'});
  }
});

/**
 * 出品削除（出品者本人 または admin）
 */
app.delete('/listings/:id', authRequired, async (req,res)=>{
  const id = Number(req.params.id);
  if(!Number.isInteger(id)) return res.status(400).json({error:'bad_id'});

  try{
    const r = await pool.query(
      `SELECT id,seller_id,status FROM listings WHERE id=$1`,
      [id]
    );
    if(r.rowCount === 0) return res.status(404).json({error:'not_found'});
    const l = r.rows[0];

    if(req.user.role !== 'admin' && l.seller_id !== req.user.uid){
      return res.status(403).json({error:'forbidden'});
    }
    if(l.status !== 'Active'){
      return res.status(409).json({error:'not_active'});
    }

    await pool.query('DELETE FROM listings WHERE id=$1',[id]);
    return res.json({ok:true});
  }catch(e){
    console.error(e);
    return res.status(500).json({error:'server_error'});
  }
});

/**
 * 運営・出品者用：出品停止（Active -> Paused）
 */
app.patch('/listings/:id/pause', authRequired, async (req,res)=>{
  const id = Number(req.params.id);
  if(!Number.isInteger(id)) return res.status(400).json({error:'bad_id'});

  try{
    const r = await pool.query(
      `SELECT id,seller_id,status FROM listings WHERE id=$1`,
      [id]
    );
    if(r.rowCount === 0) return res.status(404).json({error:'not_found'});
    const l = r.rows[0];

    if(req.user.role !== 'admin' && l.seller_id !== req.user.uid){
      return res.status(403).json({error:'forbidden'});
    }
    if(l.status !== 'Active'){
      return res.status(409).json({error:'invalid_status'});
    }

    const u = await pool.query(
      `UPDATE listings
          SET status='Paused'
        WHERE id=$1
      RETURNING id,title,price,status,seller_id`,
      [id]
    );
    return res.json(u.rows[0]);
  }catch(e){
    console.error(e);
    return res.status(500).json({error:'server_error'});
  }
});

/**
 * 運営・出品者用：出品再開（Paused -> Active）
 */
app.patch('/listings/:id/activate', authRequired, async (req,res)=>{
  const id = Number(req.params.id);
  if(!Number.isInteger(id)) return res.status(400).json({error:'bad_id'});

  try{
    const r = await pool.query(
      `SELECT id,seller_id,status FROM listings WHERE id=$1`,
      [id]
    );
    if(r.rowCount === 0) return res.status(404).json({error:'not_found'});
    const l = r.rows[0];

    if(req.user.role !== 'admin' && l.seller_id !== req.user.uid){
      return res.status(403).json({error:'forbidden'});
    }
    if(l.status !== 'Paused'){
      return res.status(409).json({error:'invalid_status'});
    }

    const u = await pool.query(
      `UPDATE listings
          SET status='Active'
        WHERE id=$1
      RETURNING id,title,price,status,seller_id`,
      [id]
    );
    return res.json(u.rows[0]);
  }catch(e){
    console.error(e);
    return res.status(500).json({error:'server_error'});
  }
});

const PORT = process.env.PORT || 4010;
app.listen(PORT, ()=>console.log('listing-svc listening on', PORT));
