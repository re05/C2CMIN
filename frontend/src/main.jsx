// frontend/src/main.jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  createBrowserRouter,
  RouterProvider,
  Link,
  Navigate,
  useNavigate,
  useLocation,
  useParams
} from 'react-router-dom';

const AUTH_URL    = import.meta.env.VITE_AUTH_URL    || 'http://localhost:4000';
const LISTING_URL = import.meta.env.VITE_LISTING_URL || 'http://localhost:4010';
const ORDER_URL   = import.meta.env.VITE_ORDER_URL   || 'http://localhost:4020';

function saveToken(t){ localStorage.setItem('token', t); }
function getToken(){ return localStorage.getItem('token'); }
function clearToken(){ localStorage.removeItem('token'); }
function authHeader(){
  const t = getToken();
  return t ? { 'Authorization': 'Bearer ' + t } : {};
}

// 共通レイアウト
function Layout({ children }){
  const [me,setMe] = React.useState(null);
  const [loaded,setLoaded] = React.useState(false);
  const nav = useNavigate();
  const loc = useLocation();

  React.useEffect(()=>{
    const t = getToken();
    if(!t){
      setMe(null);
      setLoaded(true);
      return;
    }
    fetch(AUTH_URL + '/me', { headers: { ...authHeader() } })
      .then(r => r.ok ? r.json() : null)
      .then(u => { setMe(u); setLoaded(true); })
      .catch(()=>{ setMe(null); setLoaded(true); });
  }, [loc.pathname]);

  function onLogout(){
    clearToken();
    setMe(null);
    nav('/login');
  }

  return (
    <div style={{maxWidth: 900, margin: '24px auto', fontFamily: 'system-ui', padding: '0 12px'}}>
      <nav style={{display: 'flex', gap: 16, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap'}}>
        <Link to="/">マイページ</Link>
        <Link to="/listings">出品一覧</Link>
        <Link to="/sell">出品</Link>

        {me && me.role !== 'admin' && (
          <Link to="/orders">取引一覧</Link>
        )}

        {me && me.role === 'admin' && (
          <>
            <Link to="/admin/orders">取引一覧</Link>
            <Link to="/admin/listings">出品管理</Link>
            <Link to="/admin/users">ユーザー管理</Link>
          </>
        )}

        <span style={{marginLeft: 'auto'}} />
        {!loaded && <span>読込中...</span>}
        {loaded && !me && (
          <>
            <Link to="/login">ログイン</Link>
            <Link to="/register">新規登録</Link>
          </>
        )}
        {loaded && me && (
          <>
            <span>{me.email}（{me.role}）</span>
            <button
              onClick={onLogout}
              style={{marginLeft: 8, padding: '4px 8px', cursor: 'pointer'}}
            >
              ログアウト
            </button>
          </>
        )}
      </nav>
      <hr/>
      <div style={{marginTop: 16}}>
        {children}
      </div>
    </div>
  );
}

// ここから下は前回と同じ部分も多いですが、運営画面だけ注意して読んでください

function Login(){
  const nav = useNavigate();
  const [email,setEmail] = React.useState('test@test.com');
  const [password,setPassword] = React.useState('pass');
  const [err,setErr] = React.useState('');

  async function onLogin(e){
    e.preventDefault();
    setErr('');
    const r = await fetch(AUTH_URL + '/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ email, password })
    });
    if(!r.ok){
      const body = await r.json().catch(()=>null);
      if(body && body.error === 'disabled'){
        setErr('このユーザーは凍結されています');
      }else{
        setErr('ログインに失敗しました（メールアドレスまたはパスワードが違います）');
      }
      return;
    }
    const j = await r.json();
    saveToken(j.token);
    nav('/');
  }

  return (
    <Layout>
      <h2>ログイン</h2>
      <form onSubmit={onLogin}>
        <div style={{margin: '8px 0'}}>
          <label>メールアドレス</label><br/>
          <input
            style={{padding: '8px', width: '260px'}}
            placeholder="メールアドレス"
            value={email}
            onChange={e=>setEmail(e.target.value)}
          />
        </div>
        <div style={{margin: '8px 0'}}>
          <label>パスワード</label><br/>
          <input
            style={{padding: '8px', width: '260px'}}
            type="password"
            placeholder="パスワード"
            value={password}
            onChange={e=>setPassword(e.target.value)}
          />
        </div>
        <button style={{padding: '8px 16px', cursor: 'pointer'}}>ログイン</button>
      </form>
      {err && <p style={{color:'red'}}>{err}</p>}
      <p style={{marginTop: 16}}>
        アカウントをお持ちでない方は <Link to="/register">新規登録</Link> へ
      </p>
    </Layout>
  );
}

function Register(){
  const nav = useNavigate();
  const [email,setEmail] = React.useState('');
  const [password,setPassword] = React.useState('');
  const [err,setErr] = React.useState('');

  async function onRegister(e){
    e.preventDefault();
    setErr('');

    if(!email || !password){
      setErr('メールアドレスとパスワードを入力してください');
      return;
    }

    const r = await fetch(AUTH_URL + '/register', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ email, password })
    });

    if(!r.ok){
      const body = await r.json().catch(()=>null);
      if(body && body.error === 'exists'){
        setErr('このメールアドレスは既に登録されています');
      }else{
        setErr('登録に失敗しました');
      }
      return;
    }

    const j = await r.json();
    saveToken(j.token);
    nav('/');
  }

  return (
    <Layout>
      <h2>新規登録</h2>
      <form onSubmit={onRegister}>
        <div style={{margin: '8px 0'}}>
          <label>メールアドレス</label><br/>
          <input
            style={{padding: '8px', width: '260px'}}
            placeholder="メールアドレス"
            value={email}
            onChange={e=>setEmail(e.target.value)}
          />
        </div>
        <div style={{margin: '8px 0'}}>
          <label>パスワード</label><br/>
          <input
            style={{padding: '8px', width: '260px'}}
            type="password"
            placeholder="パスワード"
            value={password}
            onChange={e=>setPassword(e.target.value)}
          />
        </div>
        <button style={{padding:'8px 16px',cursor:'pointer'}}>登録する</button>
      </form>
      {err && <p style={{color:'red'}}>{err}</p>}
      <p style={{marginTop: 16}}>
        既にアカウントをお持ちの方は <Link to="/login">ログイン</Link> へ
      </p>
    </Layout>
  );
}

function MyPage(){
  const [mine,setMine] = React.useState([]);
  const nav = useNavigate();

  React.useEffect(()=>{
    const t = getToken();
    if(!t){
      nav('/login');
      return;
    }
    fetch(LISTING_URL + '/listings/mine', { headers: { ...authHeader() } })
      .then(r => r.ok ? r.json() : [])
      .then(setMine)
      .catch(()=>setMine([]));
  },[]);

  return (
    <Layout>
      <h2>自分の出品</h2>
      {mine.length === 0 && <p>まだ出品がありません。</p>}
      {mine.map(x =>
        <div key={x.id}>
          #{x.id} {x.title} ¥{x.price} [{x.status}]
        </div>
      )}
    </Layout>
  );
}

function ListingList(){
  const [items,setItems] = React.useState([]);
  const [me,setMe] = React.useState(null);

  React.useEffect(()=>{
    fetch(LISTING_URL + '/listings')
      .then(r=>r.ok ? r.json() : [])
      .then(setItems);

    const t = getToken();
    if(t){
      fetch(AUTH_URL + '/me', { headers: { ...authHeader() } })
        .then(r=>r.ok ? r.json() : null)
        .then(setMe)
        .catch(()=>setMe(null));
    }
  },[]);

  async function buy(id){
    const r = await fetch(ORDER_URL + '/orders', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', ...authHeader()},
      body: JSON.stringify({ listingId: id })
    });
    if(r.ok){
      alert('購入しました');
      location.reload();
    }else{
      alert('購入できませんでした');
    }
  }

  async function del(id){
    const r = await fetch(LISTING_URL + '/listings/' + id, {
      method: 'DELETE',
      headers: { ...authHeader() }
    });
    if(r.ok){
      alert('削除しました');
      location.reload();
    }else{
      alert('削除できませんでした');
    }
  }

  return (
    <Layout>
      <h2>出品一覧</h2>
      {items.map(x =>
        <div key={x.id} style={{display:'flex', gap:8, alignItems:'center', padding:'6px 0', borderBottom:'1px solid #eee'}}>
          <span>#{x.id} {x.title} ¥{x.price} [{x.status}]</span>
          {me && me.id === x.seller_id && x.status === 'Active' && (
            <button onClick={()=>del(x.id)}>削除</button>
          )}
          {(!me || me.id !== x.seller_id) && x.status === 'Active' && (
            <button onClick={()=>buy(x.id)}>購入</button>
          )}
          {x.status !== 'Active' && <span>購入不可</span>}
        </div>
      )}
    </Layout>
  );
}

function Sell(){
  const nav = useNavigate();
  const [title,setTitle] = React.useState('');
  const [price,setPrice] = React.useState(1000);

  React.useEffect(()=>{
    const t = getToken();
    if(!t) nav('/login');
  },[]);

  async function submit(e){
    e.preventDefault();
    const r = await fetch(LISTING_URL + '/listings', {
      method: 'POST',
      headers: {'Content-Type':'application/json', ...authHeader()},
      body: JSON.stringify({ title, price: Number(price) })
    });
    if(r.ok){
      alert('出品しました');
      setTitle('');
      setPrice(1000);
      nav('/');
    }else{
      alert('出品に失敗しました');
    }
  }

  return (
    <Layout>
      <h2>新規出品</h2>
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
        <button style={{padding:'8px 16px',cursor:'pointer'}}>出品する</button>
      </form>
    </Layout>
  );
}

// 以下、取引一覧・取引詳細・運営用画面は前回とほぼ同じなので省略せずそのまま使う
// すでに動いているので大きな変更は入れていない

// ...（前回渡した Orders, OrderDetail, AdminOrders はそのまま）...

// 取引一覧（ユーザー）
function Orders(){
  const [orders,setOrders] = React.useState([]);
  const [loaded,setLoaded] = React.useState(false);
  const nav = useNavigate();

  React.useEffect(()=>{
    const t = getToken();
    if(!t){
      nav('/login');
      return;
    }
    Promise.all([
      fetch(ORDER_URL + '/orders/buyer/me',  { headers:{...authHeader()} }).then(r=>r.ok?r.json():[]),
      fetch(ORDER_URL + '/orders/seller/me', { headers:{...authHeader()} }).then(r=>r.ok?r.json():[])
    ]).then(([bought,sold])=>{
      const merged = [
        ...bought.map(o => ({...o, role:'buyer'})),
        ...sold.map(o => ({...o, role:'seller'}))
      ].sort((a,b)=>b.id - a.id);
      setOrders(merged);
      setLoaded(true);
    }).catch(()=>{
      setOrders([]);
      setLoaded(true);
    });
  },[]);

  if(!loaded) return <Layout><p>読み込み中...</p></Layout>;

  return (
    <Layout>
      <h2>取引一覧</h2>
      {orders.length === 0 && <p>まだ取引がありません。</p>}
      {orders.map(o =>
        <div key={o.id} style={{padding:'6px 0', borderBottom:'1px solid #eee', cursor:'pointer'}}
             onClick={()=>nav(`/orders/${o.id}`)}>
          取引ID: {o.id} / 商品: {o.title} / 金額: ¥{o.price} / 状態: {o.status} / 役割: {o.role === 'buyer' ? '購入側' : '出品側'}
        </div>
      )}
    </Layout>
  );
}

function OrderDetail(){
  const { id } = useParams();
  const [detail,setDetail] = React.useState(null);
  const [messages,setMessages] = React.useState([]);
  const [text,setText] = React.useState('');
  const [me,setMe] = React.useState(null);
  const [loaded,setLoaded] = React.useState(false);

  React.useEffect(()=>{
    const t = getToken();
    if(!t) return;

    async function load(){
      const meRes = await fetch(AUTH_URL + '/me',{headers:{...authHeader()}});
      const meJson = meRes.ok ? await meRes.json() : null;
      setMe(meJson);

      const r1 = await fetch(ORDER_URL + `/orders/${id}`, { headers:{...authHeader()} });
      if(r1.ok){
        const d = await r1.json();
        setDetail(d);
      }

      const r2 = await fetch(ORDER_URL + `/orders/${id}/messages`, { headers:{...authHeader()} });
      if(r2.ok){
        const m = await r2.json();
        setMessages(m);
      }
      setLoaded(true);
    }
    load();
  },[id]);

  async function send(e){
    e.preventDefault();
    if(!text.trim()) return;
    const r = await fetch(ORDER_URL + `/orders/${id}/messages`, {
      method:'POST',
      headers:{'Content-Type':'application/json', ...authHeader()},
      body: JSON.stringify({ text })
    });
    if(r.ok){
      const m = await r.json();
      setMessages(prev => [...prev, m]);
      setText('');
    }else{
      alert('メッセージ送信に失敗しました');
    }
  }

  const isCompleted = detail && detail.status === 'COMPLETED';
  const isAdmin = me && me.role === 'admin';

  return (
    <Layout>
      {!loaded && <p>読み込み中...</p>}
      {loaded && !detail && <p>取引情報を取得できませんでした。</p>}
      {detail && (
        <>
          <h2>取引詳細（ID: {detail.id}）</h2>
          <p>商品: {detail.title}</p>
          <p>金額: ¥{detail.price}</p>
          <p>状態: {detail.status}</p>
          <p>出品者: {detail.seller_id}</p>
          <p>購入者: {detail.buyer_id}</p>

          <h3 style={{marginTop:24}}>メッセージ</h3>
          {messages.length === 0 && <p>まだメッセージはありません。</p>}
          {messages.map(m =>
            <div key={m.id} style={{borderBottom:'1px solid #eee', padding:'4px 0'}}>
              <div>送信者ID: {m.sender_id}</div>
              <div>{m.body}</div>
              <div style={{fontSize:12,color:'#666'}}>
                {new Date(m.created_at).toLocaleString()}
              </div>
            </div>
          )}

          {!isCompleted && !isAdmin && (
            <form onSubmit={send} style={{marginTop:12}}>
              <textarea
                style={{width:'100%',height:100}}
                placeholder="メッセージを入力"
                value={text}
                onChange={e=>setText(e.target.value)}
              />
              <div style={{marginTop:8}}>
                <button style={{padding:'6px 12px',cursor:'pointer'}}>送信</button>
              </div>
            </form>
          )}
          {isAdmin && <p>※運営アカウントは閲覧のみで、メッセージ送信はできません。</p>}
          {isCompleted && <p>取引完了のため、メッセージ送信はできません。</p>}
        </>
      )}
    </Layout>
  );
}

// 運営用 出品管理
function AdminListings(){
  const [me,setMe] = React.useState(null);
  const [items,setItems] = React.useState([]);
  const [loaded,setLoaded] = React.useState(false);

  React.useEffect(()=>{
    const t = getToken();
    if(!t){
      setLoaded(true);
      setMe(null);
      return;
    }
    async function load(){
      const mr = await fetch(AUTH_URL + '/me',{ headers:{...authHeader()} });
      const u  = mr.ok ? await mr.json() : null;
      setMe(u);
      if(u && u.role === 'admin'){
        const lr = await fetch(LISTING_URL + '/listings');
        const li = lr.ok ? await lr.json() : [];
        setItems(li);
      }
      setLoaded(true);
    }
    load();
  },[]);

  if(!loaded) return <Layout><p>読み込み中...</p></Layout>;
  if(!me) return <Navigate to="/login" />;
  if(me.role !== 'admin') return <Navigate to="/" />;

  async function pause(id){
    const r = await fetch(LISTING_URL + '/listings/' + id + '/pause', {
      method: 'PATCH',
      headers: { ...authHeader() }
    });
    if(r.ok){
      const updated = await r.json();
      setItems(prev => prev.map(x => x.id === updated.id ? updated : x));
    }else{
      alert('停止に失敗しました');
    }
  }

  async function activate(id){
    const r = await fetch(LISTING_URL + '/listings/' + id + '/activate', {
      method: 'PATCH',
      headers: { ...authHeader() }
    });
    if(r.ok){
      const updated = await r.json();
      setItems(prev => prev.map(x => x.id === updated.id ? updated : x));
    }else{
      alert('再開に失敗しました');
    }
  }

  return (
    <Layout>
      <h2>運営管理（出品停止 / 再開）</h2>
      {items.length === 0 && <p>出品がありません。</p>}
      {items.map(x =>
        <div key={x.id} style={{display:'flex', gap:8, alignItems:'center', padding:'6px 0', borderBottom:'1px solid #eee'}}>
          <span>#{x.id} {x.title} ¥{x.price} [{x.status}] seller:{x.seller_id}</span>
          {x.status === 'Active'  && <button onClick={()=>pause(x.id)}>停止</button>}
          {x.status === 'Paused'  && <button onClick={()=>activate(x.id)}>再開</button>}
          {x.status === 'Sold'    && <span>売却済み</span>}
        </div>
      )}
    </Layout>
  );
}

// 運営用 取引一覧（全件）
function AdminOrders(){
  const [me,setMe] = React.useState(null);
  const [orders,setOrders] = React.useState([]);
  const [loaded,setLoaded] = React.useState(false);
  const nav = useNavigate();

  React.useEffect(()=>{
    const t = getToken();
    if(!t){
      setLoaded(true);
      setMe(null);
      return;
    }
    async function load(){
      const mr = await fetch(AUTH_URL + '/me',{ headers:{...authHeader()} });
      const u  = mr.ok ? await mr.json() : null;
      setMe(u);
      if(u && u.role === 'admin'){
        const or = await fetch(ORDER_URL + '/orders/admin/all',{ headers:{...authHeader()} });
        const os = or.ok ? await or.json() : [];
        setOrders(os);
      }
      setLoaded(true);
    }
    load();
  },[]);

  if(!loaded) return <Layout><p>読み込み中...</p></Layout>;
  if(!me) return <Navigate to="/login" />;
  if(me.role !== 'admin') return <Navigate to="/" />;

  return (
    <Layout>
      <h2>取引一覧（運営用・全件）</h2>
      {orders.length === 0 && <p>まだ取引がありません。</p>}
      {orders.map(o =>
        <div key={o.id}
             style={{padding:'6px 0', borderBottom:'1px solid #eee', cursor:'pointer'}}
             onClick={()=>nav(`/orders/${o.id}`)}>
          取引ID: {o.id} / 商品: {o.title} / 金額: ¥{o.price} / 状態: {o.status} / 出品者:{o.seller_id} / 購入者:{o.buyer_id}
        </div>
      )}
    </Layout>
  );
}

// 運営用 ユーザー一覧・凍結
function AdminUsers(){
  const [me,setMe] = React.useState(null);
  const [users,setUsers] = React.useState([]);
  const [loaded,setLoaded] = React.useState(false);

  React.useEffect(()=>{
    const t = getToken();
    if(!t){
      setLoaded(true);
      setMe(null);
      return;
    }
    async function load(){
      const mr = await fetch(AUTH_URL + '/me',{ headers:{...authHeader()} });
      const u  = mr.ok ? await mr.json() : null;
      setMe(u);
      if(u && u.role === 'admin'){
        const ur = await fetch(AUTH_URL + '/admin/users',{ headers:{...authHeader()} });
        const us = ur.ok ? await ur.json() : [];
        setUsers(us);
      }
      setLoaded(true);
    }
    load();
  },[]);

  if(!loaded) return <Layout><p>読み込み中...</p></Layout>;
  if(!me) return <Navigate to="/login" />;
  if(me.role !== 'admin') return <Navigate to="/" />;

  async function freeze(id){
    const r = await fetch(AUTH_URL + `/admin/users/${id}/freeze`,{
      method:'PATCH',
      headers:{...authHeader()}
    });
    if(r.ok){
      setUsers(prev => prev.map(u => u.id === id ? {...u,disabled:true} : u));
    }else{
      alert('凍結に失敗しました');
    }
  }

  async function unfreeze(id){
    const r = await fetch(AUTH_URL + `/admin/users/${id}/unfreeze`,{
      method:'PATCH',
      headers:{...authHeader()}
    });
    if(r.ok){
      setUsers(prev => prev.map(u => u.id === id ? {...u,disabled:false} : u));
    }else{
      alert('凍結解除に失敗しました');
    }
  }

  return (
    <Layout>
      <h2>ユーザー管理（凍結 / 解除）</h2>
      {users.length === 0 && <p>ユーザーがいません。</p>}
      {users.map(u =>
        <div key={u.id} style={{display:'flex',gap:8,alignItems:'center',padding:'4px 0',borderBottom:'1px solid #eee'}}>
          <span>ID:{u.id} / {u.email} / 役割:{u.role} / 状態:{u.disabled ? '凍結中' : '有効'}</span>
          {u.role !== 'admin' && (
            u.disabled
              ? <button onClick={()=>unfreeze(u.id)}>凍結解除</button>
              : <button onClick={()=>freeze(u.id)}>凍結</button>
          )}
        </div>
      )}
    </Layout>
  );
}

const router = createBrowserRouter([
  { path: '/',               element: <MyPage/> },
  { path: '/login',          element: <Login/> },
  { path: '/register',       element: <Register/> },
  { path: '/listings',       element: <ListingList/> },
  { path: '/sell',           element: <Sell/> },
  { path: '/orders',         element: <Orders/> },
  { path: '/orders/:id',     element: <OrderDetail/> },
  { path: '/admin/listings', element: <AdminListings/> },
  { path: '/admin/orders',   element: <AdminOrders/> },
  { path: '/admin/users',    element: <AdminUsers/> },
]);

createRoot(document.getElementById('root')).render(
  <RouterProvider router={router} />
);
