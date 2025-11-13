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

app.get('/health', (req,res)=>res.json({ok:true, service: 'listing-svc'}));

// Helpers
function parseIntOrNull(x){ const n = Number.parseInt(x,10); return Number.isFinite(n) ? n : null; }

// GET /listings?q=&status=&sellerId=
app.get('/listings', async (req,res)=>{
  const { q, status, sellerId } = req.query;
  const cond = [];
  const args = [];
  if(q){ args.push('%'+q+'%'); cond.push(`title ILIKE $${args.length}`); }
  if(status){ args.push(status); cond.push(`status = $${args.length}`); }
  if(sellerId){ const sid = parseIntOrNull(sellerId); if(sid){ args.push(sid); cond.push(`seller_id = $${args.length}`);} }
  const where = cond.length ? ('WHERE ' + cond.join(' AND ')) : 'WHERE status = \'Active\'';
  try{
    const r = await pool.query(`SELECT id,title,price,status,seller_id FROM listings ${where} ORDER BY id DESC`, args);
    return res.json(r.rows);
  }catch(e){ console.error(e); return res.status(500).json({error:'server_error'}); }
});

// GET /listings/mine
app.get('/listings/mine', authRequired, async (req,res)=>{
  try{
    const me = req.user.uid;
    const r = await pool.query('SELECT id,title,price,status,seller_id FROM listings WHERE seller_id=$1 ORDER BY id DESC',[me]);
    return res.json(r.rows);
  }catch(e){ console.error(e); return res.status(500).json({error:'server_error'}); }
});

// POST /listings {title,price}
app.post('/listings', authRequired, async (req,res)=>{
  const { title, price } = req.body || {};
  if(!title || typeof price !== 'number' || price < 0) return res.status(400).json({error:'bad_request'});
  try{
    const r = await pool.query('INSERT INTO listings(title,price,status,seller_id) VALUES($1,$2,$3,$4) RETURNING id,title,price,status,seller_id',[title,price,'Active',req.user.uid]);
    return res.status(201).json(r.rows[0]);
  }catch(e){ console.error(e); return res.status(500).json({error:'server_error'}); }
});

// DELETE /listings/:id (only own Active)
app.delete('/listings/:id', authRequired, async (req,res)=>{
  const id = parseIntOrNull(req.params.id);
  if(!id) return res.status(400).json({error:'bad_id'});
  try{
    const r = await pool.query('DELETE FROM listings WHERE id=$1 AND seller_id=$2 AND status=$3 RETURNING id',[id, req.user.uid, 'Active']);
    if(r.rowCount===0) return res.status(403).json({error:'forbidden_or_not_active'});
    return res.json({ok:true});
  }catch(e){ console.error(e); return res.status(500).json({error:'server_error'}); }
});

// PATCH /listings/:id/pause (admin only)
app.patch('/listings/:id/pause', authRequired, adminRequired, async (req,res)=>{
  const id = parseIntOrNull(req.params.id);
  if(!id) return res.status(400).json({error:'bad_id'});
  try{
    const r = await pool.query('UPDATE listings SET status=$1 WHERE id=$2 RETURNING id,title,price,status,seller_id',['Paused',id]);
    if(r.rowCount===0) return res.status(404).json({error:'not_found'});
    return res.json(r.rows[0]);
  }catch(e){ console.error(e); return res.status(500).json({error:'server_error'}); }
});

// PATCH /listings/:id/activate (admin only)
app.patch('/listings/:id/activate', authRequired, adminRequired, async (req,res)=>{
  const id = parseIntOrNull(req.params.id);
  if(!id) return res.status(400).json({error:'bad_id'});
  try{
    const r = await pool.query('UPDATE listings SET status=$1 WHERE id=$2 RETURNING id,title,price,status,seller_id',['Active',id]);
    if(r.rowCount===0) return res.status(404).json({error:'not_found'});
    return res.json(r.rows[0]);
  }catch(e){ console.error(e); return res.status(500).json({error:'server_error'}); }
});


const port = 4010;
app.listen(port, ()=>{ console.log('listening on', port); });

