import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const app = express();

// CORS: 3100 と 3000 を明示許可。プリフライト 204 返却。
app.use(cors({
  origin: ["http://localhost:3100","http://localhost:3000"],
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
  credentials: false,
  optionsSuccessStatus: 204
}));
app.options("*", (req,res)=>res.sendStatus(204));

app.use(express.json());

const pool = new pg.Pool({
  host: process.env.DB_HOST, user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, database: process.env.DB_NAME
});

function authRequired(req,res,next){
  const h = req.headers["authorization"] || "";
  const [scheme, token] = h.split(" ");
  if(scheme !== "Bearer" || !token) return res.status(401).json({error:"unauthorized"});
  try{
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  }catch{ return res.status(401).json({error:"unauthorized"}); }
}

app.get("/health",(req,res)=>res.json({ok:true}));

app.post("/login", async (req,res)=>{
  const { email, password } = req.body || {};
  if(!email || !password) return res.status(400).json({error:"bad_request"});
  try{
    const q = await pool.query("SELECT id,email,password,role FROM users WHERE email=$1",[email]);
    const u = q.rows[0];
    if(!u || u.password !== password) return res.status(401).json({error:"invalid"});
    const token = jwt.sign({ sub:u.email, role:u.role, uid:u.id }, process.env.JWT_SECRET, { expiresIn:"7d" });
    res.json({ token });
  }catch(e){ console.error(e); res.status(500).json({error:"server_error"}); }
});

app.get("/me", authRequired, async (req,res)=>{
  try{
    const r = await pool.query("SELECT id,email,role FROM users WHERE email=$1",[req.user.sub]);
    if(r.rowCount===0) return res.status(404).json({error:"not_found"});
    res.json(r.rows[0]);
  }catch(e){ console.error(e); res.status(500).json({error:"server_error"}); }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, ()=>console.log("listening on", PORT));
