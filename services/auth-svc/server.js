import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import pkg from "pg"; const { Client } = pkg;

const app = express();
app.use(cors({
  origin: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
  credentials: false
}));
app.options("*", (req,res)=>res.sendStatus(204));
app.use(express.json()); // 重要: req.body を読む

const client = new Client({
  host: process.env.DB_HOST || "db",
  user: process.env.DB_USER || "myuser",
  password: process.env.DB_PASSWORD || "mypass",
  database: process.env.DB_NAME || "mydb",
});
await client.connect();

app.get("/health", (req,res)=>res.json({ok:true}));

app.post("/login", async (req,res)=>{
  try{
    const { email, password } = req.body || {};
    if(!email || !password) return res.status(400).json({error:"bad request"});
    const r = await client.query("SELECT id,email,password,role FROM users WHERE email=$1",[email]);
    const row = r.rows[0];
    // 平文で照合（DB: 'pass'）
    if(!row || row.password !== password) return res.status(401).json({error:"login failed"});
    const token = jwt.sign(
      { sub: row.email, role: row.role, uid: row.id },
      process.env.JWT_SECRET || "mysecret",
      { expiresIn: "2h" }
    );
    res.json({ token });
  }catch(e){
    console.error(e);
    res.status(500).json({error:"server error"});
  }
});

app.get("/me", async (req,res)=>{
  try{
    const h = req.headers.authorization || "";
    const m = h.match(/^Bearer (.+)$/);
    if(!m) return res.status(401).json({error:"no token"});
    const payload = jwt.verify(m[1], process.env.JWT_SECRET || "mysecret");
    const r = await client.query("SELECT id,email,role FROM users WHERE email=$1",[payload.sub]);
    const me = r.rows[0];
    if(!me) return res.status(401).json({error:"invalid"});
    res.json(me);
  }catch(e){
    return res.status(401).json({error:"invalid"});
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, ()=>console.log("listening on", PORT));
