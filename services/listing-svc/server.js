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

// ひらがな → カタカナ
function hiraToKata(str){
  return str.replace(/[\u3041-\u3096]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60)
  );
}

app.get('/health',(req,res)=>res.json({ok:true, service:'listing-svc'}));

/**
 * 出品一覧（だれでも見られる）
 * ?q= タイトルあいまい検索, ?category= カテゴリ絞り込み
 * どちらも未指定なら全件
 */
app.get('/listings', async (req,res)=>{
  const rawQ   = (req.query.q || '').trim();
  const rawCat = (req.query.category || '').trim();

  // 検索ワードは「元の文字列」と「カタカナ変換後」の両方を使う
  const qH = rawQ;
  const qK = hiraToKata(rawQ);
  const hasQ = !!rawQ;

  const cat = rawCat;  // category は画面のプルダウン固定値なのでそのまま

  try{
    let rows;

    if(hasQ && cat){
      const r = await pool.query(
        `SELECT id,title,price,status,seller_id,image_url,category,fashion_genre
           FROM listings
          WHERE (title ILIKE '%' || $1 || '%' OR title ILIKE '%' || $2 || '%')
            AND category = $3
          ORDER BY id DESC`,
        [qH, qK, cat]
      );
      rows = r.rows;
    }else if(hasQ){
      const r = await pool.query(
        `SELECT id,title,price,status,seller_id,image_url,category,fashion_genre
           FROM listings
          WHERE (title ILIKE '%' || $1 || '%' OR title ILIKE '%' || $2 || '%')
          ORDER BY id DESC`,
        [qH, qK]
      );
      rows = r.rows;
    }else if(cat){
      const r = await pool.query(
        `SELECT id,title,price,status,seller_id,image_url,category,fashion_genre
           FROM listings
          WHERE category = $1
          ORDER BY id DESC`,
        [cat]
      );
      rows = r.rows;
    }else{
      const r = await pool.query(
        `SELECT id,title,price,status,seller_id,image_url,category,fashion_genre
           FROM listings
          ORDER BY id DESC`
      );
      rows = r.rows;
    }

    return res.json(rows);
  }catch(err){
    console.error(err);
    return res.status(500).json({error:'server_error'});
  }
});

/**
 * 出品1件取得（商品ページ用）
 */
app.get('/listings/:id', async (req,res)=>{
  const id = Number(req.params.id);
  if(!Number.isInteger(id)) return res.status(400).json({error:'bad_id'});

  try{
    const r = await pool.query(
      `SELECT id,title,price,status,seller_id,
              image_url,category,fashion_genre,size,condition
         FROM listings
        WHERE id=$1`,
      [id]
    );
    if(r.rowCount === 0) return res.status(404).json({error:'not_found'});
    return res.json(r.rows[0]);
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
      `SELECT id,title,price,status,seller_id,
              image_url,category,fashion_genre,size,condition
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
 * 画像・カテゴリ・ファッションジャンル・サイズすべて必須
 */
app.post('/listings', authRequired, async (req,res)=>{
  const { title, price, imageUrl, category, fashionGenre, size, condition } = req.body || {};

  if(!title || price == null || !imageUrl || !category){
    return res.status(400).json({error:'bad_request'});
  }

  const priceNum = Number(price);
  if(!Number.isFinite(priceNum) || priceNum <= 0){
    return res.status(400).json({error:'bad_price'});
  }

  // ファッションカテゴリの時はジャンル必須
  if(category === 'ファッション' && !fashionGenre){
    return res.status(400).json({error:'need_fashion_genre'});
  }

  const cond = condition || '未使用に近い';
  const fg   = fashionGenre || null;
  const sz   = size || null;

  try{
    const q = await pool.query(
      `INSERT INTO listings
         (title,price,status,seller_id,
          image_url,category,fashion_genre,size,condition)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id,title,price,status,seller_id,
                 image_url,category,fashion_genre,size,condition`,
      [title, priceNum, 'Active', req.user.uid,
       imageUrl, category, fg, sz, cond]
    );
    return res.status(201).json(q.rows[0]);
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
 * 出品停止（Active -> Paused）
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
      RETURNING id,title,price,status,seller_id,
                image_url,category,fashion_genre,size,condition`,
      [id]
    );
    return res.json(u.rows[0]);
  }catch(e){
    console.error(e);
    return res.status(500).json({error:'server_error'});
  }
});

/**
 * 出品再開（Paused -> Active）
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
      RETURNING id,title,price,status,seller_id,
                image_url,category,fashion_genre,size,condition`,
      [id]
    );
    return res.json(u.rows[0]);
  }catch(e){
    console.error(e);
    return res.status(500).json({error:'server_error'});
  }
});

/**
 * 商品コメント一覧
 */
app.get('/listings/:id/comments', async (req,res)=>{
  const id = Number(req.params.id);
  if(!Number.isInteger(id)) return res.status(400).json({error:'bad_id'});

  try{
    const r = await pool.query(
      `SELECT c.id,
              c.listing_id,
              c.user_id,
              c.body,
              c.created_at,
              u.email AS user_email
         FROM listing_comments c
         JOIN users u ON c.user_id = u.id
        WHERE c.listing_id = $1
        ORDER BY c.id ASC`,
      [id]
    );
    return res.json(r.rows);
  }catch(e){
    console.error(e);
    return res.status(500).json({error:'server_error'});
  }
});

/**
 * 商品コメント投稿
 */
app.post('/listings/:id/comments', authRequired, async (req,res)=>{
  const id = Number(req.params.id);
  if(!Number.isInteger(id)) return res.status(400).json({error:'bad_id'});

  const { body } = req.body || {};
  const text = (body || '').trim();
  if(!text){
    return res.status(400).json({error:'empty'});
  }

  try{
    const l = await pool.query(
      `SELECT id FROM listings WHERE id=$1`,
      [id]
    );
    if(l.rowCount === 0) return res.status(404).json({error:'not_found'});

    const r = await pool.query(
      `INSERT INTO listing_comments(listing_id,user_id,body)
       VALUES($1,$2,$3)
       RETURNING id,listing_id,user_id,body,created_at`,
      [id, req.user.uid, text]
    );
    return res.status(201).json(r.rows[0]);
  }catch(e){
    console.error(e);
    return res.status(500).json({error:'server_error'});
  }
});

const PORT = process.env.PORT || 4010;
app.listen(PORT, ()=>console.log('listing-svc listening on', PORT));
