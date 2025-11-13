import React from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Link, Navigate, useNavigate } from 'react-router-dom'

const AUTH_URL = import.meta.env.VITE_AUTH_URL || 'http://localhost:4000'
const LISTING_URL = import.meta.env.VITE_LISTING_URL || 'http://localhost:4010'
const ORDER_URL = import.meta.env.VITE_ORDER_URL || 'http://localhost:4020'

function saveToken(t){ localStorage.setItem('token', t) }
function getToken(){ return localStorage.getItem('token') }
function clearToken(){ localStorage.removeItem('token') }
function authHeader(){
  const t = getToken()
  return t ? { 'Authorization': 'Bearer ' + t } : {}
}

function Layout({children}){
  const [me,setMe] = React.useState(null)

  React.useEffect(()=>{
    const t = getToken()
    if(!t){ setMe(null); return }
    fetch(AUTH_URL + '/me', { headers: { ...authHeader() } })
      .then(r => r.ok ? r.json() : null)
      .then(setMe)
      .catch(()=>setMe(null))
  },[])

  function onLogout(){
    clearToken()
    setMe(null)
    window.location.href = '/login'
  }

  return (
    <div style={{maxWidth:900, margin:'24px auto', fontFamily:'system-ui', padding:'0 12px'}}>
      <nav style={{display:'flex', gap:16, marginBottom:16, alignItems:'center', flexWrap:'wrap'}}>
        <Link to="/">マイページ</Link>
        <Link to="/listings">出品一覧</Link>
        <Link to="/sell">出品</Link>
        <Link to="/admin">管理</Link>
        <div style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:8}}>
          {!me && <Link to="/login">ログイン</Link>}
          {me && (
            <>
              <span>ログイン中: {me.email} ({me.role})</span>
              <button style={{padding:'4px 8px', cursor:'pointer'}} onClick={onLogout}>ログアウト</button>
            </>
          )}
        </div>
      </nav>
      <hr/>
      {children}
    </div>
  )
}

function Login(){
  const nav = useNavigate()
  const [email,setEmail] = React.useState('test@test.com')
  const [password,setPassword] = React.useState('pass')
  const [err,setErr] = React.useState('')

  async function onLogin(e){
    e.preventDefault()
    setErr('')
    try{
      const r = await fetch(AUTH_URL + '/login',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({email,password})
      })
      if(!r.ok){
        const body = await r.text().catch(()=> '')
        console.error('login error', r.status, body)
        setErr('ログインに失敗しました')
        return
      }
      const j = await r.json()
      saveToken(j.token)
      nav('/')
    }catch(e){
      console.error(e)
      setErr('通信エラーが発生しました')
    }
  }

  return (
    <Layout>
      <h2>ログイン</h2>
      <form onSubmit={onLogin}>
        <div style={{margin:'8px 0'}}>
          <label>メールアドレス</label><br/>
          <input
            style={{padding:'8px',width:'260px'}}
            placeholder="メールアドレス"
            value={email}
            onChange={e=>setEmail(e.target.value)}
          />
        </div>
        <div style={{margin:'8px 0'}}>
          <label>パスワード</label><br/>
          <input
            style={{padding:'8px',width:'260px'}}
            type="password"
            placeholder="パスワード"
            value={password}
            onChange={e=>setPassword(e.target.value)}
          />
        </div>
        <button style={{padding:'8px 16px',cursor:'pointer'}}>ログイン</button>
      </form>
      <p style={{marginTop:8,fontSize:12,color:'#666'}}>デモ: test@test.com / pass</p>
      {err && <p style={{color:'red'}}>{err}</p>}
    </Layout>
  )
}

function マイページ(){
  const [mine,setMine] = React.useState([])

  React.useEffect(()=>{
    fetch(LISTING_URL + '/listings/mine',{ headers:{...authHeader()} })
      .then(r=> r.ok ? r.json() : [])
      .then(setMine)
      .catch(()=>setMine([]))
  },[])

  return (
    <Layout>
      <h2>My 出品一覧</h2>
      {mine.length === 0 && <p>まだ出品がありません。</p>}
      {mine.map(x=> (
        <div key={x.id}>
          #{x.id} {x.title} ¥{x.price} [{x.status}]
        </div>
      ))}
    </Layout>
  )
}

function 出品一覧(){
  const [items,setItems] = React.useState([])
  const [me,setMe] = React.useState(null)

  React.useEffect(()=>{
    fetch(LISTING_URL + '/listings')
      .then(r=>r.json())
      .then(setItems)
    const t = getToken()
    if(t){
      fetch(AUTH_URL + '/me',{ headers:{...authHeader()} })
        .then(r=>r.ok ? r.json() : null)
        .then(setMe)
    }
  },[])

  async function buy(id){
    const r = await fetch(ORDER_URL + '/orders',{
      method:'POST',
      headers:{'Content-Type':'application/json',...authHeader()},
      body: JSON.stringify({listingId: id})
    })
    if(r.ok){
      alert('購入しました')
      location.reload()
    } else {
      alert('購入できません')
    }
  }

  async function del(id){
    const r = await fetch(LISTING_URL + '/listings/' + id,{
      method:'DELETE',
      headers:{...authHeader()}
    })
    if(r.ok){
      alert('削除しました')
      location.reload()
    } else {
      alert('削除できません')
    }
  }

  return (
    <Layout>
      <h2>出品一覧</h2>
      {items.map(x=> (
        <div key={x.id} style={{display:'flex', gap:8, alignItems:'center', padding:'6px 0', borderBottom:'1px solid #eee'}}>
          <span>
            #{x.id} {x.title} ¥{x.price} [{x.status}] {me && me.id===x.seller_id && <b>自分の出品</b>}
          </span>
          {me && me.id===x.seller_id && x.status==='Active' && (
            <button onClick={()=>del(x.id)}>削除</button>
          )}
          {(!me || me.id!==x.seller_id) && x.status==='Active' && (
            <button onClick={()=>buy(x.id)}>購入</button>
          )}
          {x.status!=='Active' && <span>購入不可</span>}
        </div>
      ))}
    </Layout>
  )
}

function 出品(){
  const [title,setTitle]=React.useState('サンプル')
  const [price,setPrice]=React.useState(1000)

  async function submit(e){
    e.preventDefault()
    const r = await fetch(LISTING_URL + '/listings',{
      method:'POST',
      headers:{'Content-Type':'application/json',...authHeader()},
      body: JSON.stringify({title,price:Number(price)})
    })
    if(r.ok){
      alert('出品しました')
      setTitle('')
      setPrice(0)
    } else {
      alert('失敗しました')
    }
  }

  return (
    <Layout>
      <h2>出品</h2>
      <form onSubmit={submit}>
        <div style={{margin:'8px 0'}}>
          <label>タイトル</label><br/>
          <input
            style={{padding:'8px',width:'260px'}}
            placeholder="タイトル"
            value={title}
            onChange={e=>setTitle(e.target.value)}
          />
        </div>
        <div style={{margin:'8px 0'}}>
          <label>価格</label><br/>
          <input
            style={{padding:'8px',width:'260px'}}
            type="number"
            placeholder="価格"
            value={price}
            onChange={e=>setPrice(e.target.value)}
          />
        </div>
        <button>作成</button>
      </form>
    </Layout>
  )
}

function 管理(){
  const [me,setMe]=React.useState(null)
  const [items,setItems]=React.useState([])

  React.useEffect(()=>{
    const t = getToken()
    if(!t){ setMe(null); return }
    fetch(AUTH_URL + '/me',{ headers:{...authHeader()} })
      .then(r=>r.ok ? r.json() : null)
      .then(setMe)
    fetch(LISTING_URL + '/listings?q=')
      .then(r=>r.json())
      .then(setItems)
  },[])

  if(!me) return <Navigate to="/login" />
  if(me.role!=='admin') return <Navigate to="/" />

  async function pause(id){
    const r = await fetch(LISTING_URL + '/listings/' + id + '/pause',{
      method:'PATCH',
      headers:{...authHeader()}
    })
    if(r.ok){ location.reload() } else { alert('失敗しました') }
  }

  async function activate(id){
    const r = await fetch(LISTING_URL + '/listings/' + id + '/activate',{
      method:'PATCH',
      headers:{...authHeader()}
    })
    if(r.ok){ location.reload() } else { alert('失敗しました') }
  }

  return (
    <Layout>
      <h2>管理</h2>
      {items.map(x=> (
        <div key={x.id} style={{display:'flex', gap:8, alignItems:'center', padding:'6px 0', borderBottom:'1px solid #eee'}}>
          <span>#{x.id} {x.title} ¥{x.price} [{x.status}] seller:{x.seller_id}</span>
          {x.status!=='Paused'
            ? <button onClick={()=>pause(x.id)}>停止</button>
            : <button onClick={()=>activate(x.id)}>再開</button>}
        </div>
      ))}
    </Layout>
  )
}

const router = createBrowserRouter([
  { path: "/", element: <マイページ/> },
  { path: "/login", element: <Login/> },
  { path: "/listings", element: <出品一覧/> },
  { path: "/sell", element: <出品/> },
  { path: "/admin", element: <管理/> },
])

createRoot(document.getElementById('root')).render(<RouterProvider router={router} />)
