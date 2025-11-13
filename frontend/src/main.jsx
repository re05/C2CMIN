import React from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Link, Navigate, useNavigate, useLocation } from 'react-router-dom'

const AUTH_URL    = import.meta.env.VITE_AUTH_URL    || 'http://localhost:4000'
const LISTING_URL = import.meta.env.VITE_LISTING_URL || 'http://localhost:4010'
const ORDER_URL   = import.meta.env.VITE_ORDER_URL   || 'http://localhost:4020'

function saveToken(t){ localStorage.setItem('token', t) }
function getToken(){ return localStorage.getItem('token') }
function authHeader(){ const t=getToken(); return t ? { Authorization: 'Bearer ' + t } : {} }

// 認証必須レイアウト（未ログインなら /login に飛ばす）
function Layout({children}){
  const loc = useLocation()
  const [me,setMe] = React.useState(null)
  const [checked,setChecked] = React.useState(false)

  React.useEffect(()=>{
    const t = getToken()
    if(!t){ setChecked(true); return }
    fetch(`${AUTH_URL}/me`, { headers: { ...authHeader() }})
      .then(r => r.ok ? r.json() : null)
      .then(u => { setMe(u); setChecked(true) })
      .catch(() => { setMe(null); setChecked(true) })
  },[])

  // 未チェック中は軽いプレースホルダ
  if(!checked) return <div style={{padding:24}}>読み込み中...</div>

  // 未ログイン or /me 失敗 → /login
  if(!me) return <Navigate to="/login" state={{ from: loc.pathname }} replace />

  return (
    <div style={{maxWidth:900, margin:'24px auto', fontFamily:'system-ui', padding:'0 12px'}}>
      <nav style={{display:'flex', gap:16, marginBottom:16, alignItems:'center', flexWrap:'wrap'}}>
        <Link to="/">マイページ</Link>
        <Link to="/listings">出品一覧</Link>
        <Link to="/sell">出品</Link>
        {me.role==='admin' && <Link to="/admin">管理</Link>}
        <span style={{marginLeft:'auto', fontSize:14, color:'#555'}}>
          {me.email}（{me.role==='admin'?'管理者':'ユーザー'}）
        </span>
      </nav>
      <div style={{background:'#fafafa', padding:16, borderRadius:8, boxShadow:'0 0 6px rgba(0,0,0,0.1)'}}>
        {children(me)}
      </div>
    </div>
  )
}

// ---- ページ ----

// Login は Layout で包まない（未ログインでも表示させるため）
function Login(){
  const nav = useNavigate()
  const [email,setEmail] = React.useState('test@test.com')
  const [password,setPassword] = React.useState('pass')
  const [err,setErr] = React.useState('')

  async function onLogin(e){
    e.preventDefault()
    setErr('')
    const r = await fetch(`${AUTH_URL}/login`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({email,password})
    })
    if(!r.ok){ setErr('ログインに失敗しました'); return }
    const j = await r.json()
    saveToken(j.token)
    nav('/') // 成功時トップへ
  }

  return (
    <div style={{maxWidth:380, margin:'64px auto', fontFamily:'system-ui', padding:'0 12px'}}>
      <h2>ログイン</h2>
      <form onSubmit={onLogin}>
        <div style={{margin:'8px 0'}}>
          <label>メールアドレス</label><br/>
          <input style={{padding:'8px',width:'100%'}} placeholder="メールアドレス"
                 value={email} onChange={e=>setEmail(e.target.value)} />
        </div>
        <div style={{margin:'8px 0'}}>
          <label>パスワード</label><br/>
          <input type="password" style={{padding:'8px',width:'100%'}} placeholder="パスワード"
                 value={password} onChange={e=>setPassword(e.target.value)} />
        </div>
        <button style={{padding:'10px 16px',cursor:'pointer'}}>ログイン</button>
      </form>
      {err && <p style={{color:'crimson'}}>{err}</p>}
      <p style={{marginTop:8, fontSize:13, color:'#666'}}>デモ: test@test.com / pass</p>
    </div>
  )
}

function マイページ(){
  return (
    <Layout>
      {(me)=>(
        <>
          <h2>マイ出品一覧</h2>
          <MyListings me={me}/>
        </>
      )}
    </Layout>
  )
}

function MyListings({me}){
  const [mine,setMine] = React.useState([])
  React.useEffect(()=>{
    fetch(`${LISTING_URL}/listings/mine`, { headers:{...authHeader()} })
      .then(r=>r.ok?r.json():[])
      .then(setMine)
      .catch(()=>setMine([]))
  },[])
  if(mine.length===0) return <p>まだ出品がありません</p>
  return (
    <>
      {mine.map(x=> <div key={x.id}>#{x.id} {x.title} ¥{x.price} [{x.status}]</div>)}
    </>
  )
}

function 出品一覧(){
  return (
    <Layout>
      {(me)=> <ListingsBody me={me}/> }
    </Layout>
  )
}
function ListingsBody({me}){
  const [items,setItems] = React.useState([])
  React.useEffect(()=>{
    fetch(`${LISTING_URL}/listings`).then(r=>r.json()).then(setItems)
  },[])
  async function buy(id){
    const r = await fetch(`${ORDER_URL}/orders`,{
      method:'POST', headers:{'Content-Type':'application/json',...authHeader()},
      body: JSON.stringify({listingId:id})
    })
    alert(r.ok?'購入しました':'購入できません')
    if(r.ok) location.reload()
  }
  async function del(id){
    const r = await fetch(`${LISTING_URL}/listings/${id}`,{ method:'DELETE', headers:{...authHeader()} })
    alert(r.ok?'削除しました':'削除できません')
    if(r.ok) location.reload()
  }
  return (
    <>
      <h2>出品一覧</h2>
      {items.map(x=>
        <div key={x.id} style={{display:'flex',gap:8,alignItems:'center',padding:'6px 0',borderBottom:'1px solid #eee'}}>
          <span>#{x.id} {x.title} ¥{x.price} [{x.status}] {me && me.id===x.seller_id && <b>自分の出品</b>}</span>
          {me && me.id===x.seller_id && x.status==='Active' && <button onClick={()=>del(x.id)}>削除</button>}
          {(!me || me.id!==x.seller_id) && x.status==='Active' && <button onClick={()=>buy(x.id)}>購入</button>}
          {x.status!=='Active' && <span>購入不可</span>}
        </div>
      )}
    </>
  )
}

function 出品(){
  return (
    <Layout>
      {()=> <SellForm/>}
    </Layout>
  )
}
function SellForm(){
  const [title,setTitle] = React.useState('')
  const [price,setPrice] = React.useState('')
  async function submit(e){
    e.preventDefault()
    const r = await fetch(`${LISTING_URL}/listings`,{
      method:'POST', headers:{'Content-Type':'application/json',...authHeader()},
      body: JSON.stringify({title,price:Number(price)})
    })
    alert(r.ok?'出品しました':'失敗')
    if(r.ok){ setTitle(''); setPrice('') }
  }
  return (
    <>
      <h2>出品</h2>
      <form onSubmit={submit}>
        <div style={{margin:'8px 0'}}>
          <label>タイトル</label><br/>
          <input style={{padding:'8px',width:'260px'}} value={title} onChange={e=>setTitle(e.target.value)} placeholder="商品タイトル"/>
        </div>
        <div style={{margin:'8px 0'}}>
          <label>価格</label><br/>
          <input type="number" style={{padding:'8px',width:'260px'}} value={price} onChange={e=>setPrice(e.target.value)} placeholder="価格"/>
        </div>
        <button style={{padding:'8px 16px'}}>出品する</button>
      </form>
    </>
  )
}

function 管理(){
  return (
    <Layout>
      {(me)=> {
        if(me.role!=='admin') return <Navigate to="/" replace />
        return <AdminBody/>
      }}
    </Layout>
  )
}
function AdminBody(){
  const [items,setItems] = React.useState([])
  React.useEffect(()=>{
    fetch(`${LISTING_URL}/listings`).then(r=>r.json()).then(setItems)
  },[])
  async function toggle(id,act){
    const r = await fetch(`${LISTING_URL}/listings/${id}/${act}`, { method:'PATCH', headers:{...authHeader()} })
    alert(r.ok?'更新しました':'失敗')
    if(r.ok) location.reload()
  }
  return (
    <>
      <h2>管理</h2>
      {items.map(x=>
        <div key={x.id} style={{display:'flex',gap:8,alignItems:'center',padding:'6px 0',borderBottom:'1px solid #eee'}}>
          <span>#{x.id} {x.title} ¥{x.price} [{x.status}] seller:{x.seller_id}</span>
          {x.status!=='Paused'
            ? <button onClick={()=>toggle(x.id,'pause')}>停止</button>
            : <button onClick={()=>toggle(x.id,'activate')}>再開</button>}
        </div>
      )}
    </>
  )
}

// ルーティング
const router = createBrowserRouter([
  { path: '/login', element: <Login/> },
  { path: '/', element: <マイページ/> },
  { path: '/listings', element: <出品一覧/> },
  { path: '/sell', element: <出品/> },
  { path: '/admin', element: <管理/> },
])

createRoot(document.getElementById('root')).render(<RouterProvider router={router} />)
