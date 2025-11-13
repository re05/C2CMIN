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
        {me && <Link to="/orders">取引</Link>}
        {me && me.role === 'admin' && <Link to="/admin">管理</Link>}
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

function 取引一覧(){
  const [items,setItems] = React.useState([]);
  const [me,setMe] = React.useState(null);
  const [messagesByOrder,setMessagesByOrder] = React.useState({});
  const [inputByOrder,setInputByOrder] = React.useState({});

  if(!getToken()){
    return <Navigate to="/login" />;
  }

  React.useEffect(()=>{
    async function load(){
      try{
        const h = { ...authHeader() };

        const meRes = await fetch(AUTH_URL + '/me',{ headers:h });
        if(!meRes.ok){
          setMe(null);
          return;
        }
        const meJson = await meRes.json();
        setMe(meJson);

        // admin とそれ以外で取得先を切り替える
        if(meJson.role === 'admin'){
          const all = await fetch(ORDER_URL + '/orders/admin/all', { headers:h })
            .then(r=>r.ok ? r.json() : []);
          const adminView = all.map(o => ({...o, myRole:'admin'}));
          setItems(adminView);
        }else{
          const [asBuyer, asSeller] = await Promise.all([
            fetch(ORDER_URL + '/orders/buyer/me', { headers:h }).then(r=>r.ok ? r.json() : []),
            fetch(ORDER_URL + '/orders/seller/me', { headers:h }).then(r=>r.ok ? r.json() : []),
          ]);
          const buyerWithRole  = asBuyer.map(o => ({...o, myRole:'buyer'}));
          const sellerWithRole = asSeller.map(o => ({...o, myRole:'seller'}));
          setItems([...buyerWithRole, ...sellerWithRole]);
        }
      }catch(e){
        console.error(e);
        setItems([]);
      }
    }
    load();
  },[]);

  React.useEffect(()=>{
    async function loadMessages(){
      const h = { ...authHeader() };
      const next = {};
      for(const o of items){
        try{
          const r = await fetch(ORDER_URL + '/orders/' + o.id + '/messages', { headers:h });
          if(r.ok){
            next[o.id] = await r.json();
          }else{
            next[o.id] = [];
          }
        }catch(e){
          console.error(e);
          next[o.id] = [];
        }
      }
      setMessagesByOrder(next);
    }
    if(items.length > 0){
      loadMessages();
    }
  },[items]);

  function statusLabel(s){
    if(s === 'CREATED')   return '購入済み（発送待ち）';
    if(s === 'SHIPPING')  return '発送中';
    if(s === 'DELIVERED') return '到着済み（評価待ち）';
    if(s === 'COMPLETED') return '取引完了';
    return s;
  }

  async function action(id, kind){
    let path = '';
    if(kind === 'ship')     path = '/orders/' + id + '/ship';
    if(kind === 'deliver')  path = '/orders/' + id + '/deliver';
    if(kind === 'complete') path = '/orders/' + id + '/complete';
    const r = await fetch(ORDER_URL + path,{
      method:'PATCH',
      headers:{ ...authHeader() }
    });
    if(r.ok){
      alert('状態を更新しました');
      location.reload();
    }else{
      alert('状態を更新できませんでした');
    }
  }

  function otherSideLabel(o, msg){
    if(!me) return 'ユーザー';
    if(me.role === 'admin'){
      // admin の監視用: 送り手のユーザーIDを出す
      return `ユーザーID:${msg.sender_id}`;
    }
    if(msg.sender_id === me.id) return '自分';
    return '相手';
  }

  async function sendMessage(orderId){
    const order = items.find(x => x.id === orderId);

    // admin はメッセージ送信不可
    if(me && me.role === 'admin'){
      alert('admin はメッセージ送信はできません（閲覧のみ）。');
      return;
    }

    if(order && order.status === 'COMPLETED'){
      alert('取引完了後はメッセージを送れません。');
      return;
    }

    const raw = inputByOrder[orderId] || '';
    const text = raw.trim();
    if(!text) return;

    const r = await fetch(ORDER_URL + '/orders/' + orderId + '/messages',{
      method:'POST',
      headers:{ 'Content-Type':'application/json', ...authHeader() },
      body: JSON.stringify({ text })
    });
    if(!r.ok){
      alert('メッセージ送信に失敗しました');
      return;
    }
    const msg = await r.json();
    setMessagesByOrder(prev => ({
      ...prev,
      [orderId]: [...(prev[orderId] || []), msg]
    }));
    setInputByOrder(prev => ({ ...prev, [orderId]: '' }));
  }

  const title = me && me.role === 'admin' ? '全ての取引（管理用）' : '取引一覧';

  return (
    <Layout>
      <h2>{title}</h2>
      {items.length === 0 && <p>関係する取引はまだありません。</p>}
      {items.map(o => {
        const msgs = messagesByOrder[o.id] || [];
        const input = inputByOrder[o.id] || '';
        const isCompleted = o.status === 'COMPLETED';
        const isAdmin = me && me.role === 'admin';

        return (
          <div key={o.id} style={{
            border:'1px solid #ddd',
            borderRadius:4,
            padding:8,
            marginBottom:12,
            display:'flex',
            flexDirection:'column',
            gap:6
          }}>
            <div>
              取引ID #{o.id} / {
                o.myRole === 'admin'
                  ? '管理者ビュー'
                  : (o.myRole === 'buyer' ? '購入側' : '出品側')
              } / {statusLabel(o.status)}
            </div>
            <div>
              商品: {o.title} ¥{o.price} 出品者ID:{o.seller_id} 購入者ID:{o.buyer_id}
            </div>

            {!isAdmin && (
              <div style={{marginTop:4}}>
                {o.myRole === 'seller' && o.status === 'CREATED' && (
                  <button onClick={()=>action(o.id,'ship')}>発送済みにする</button>
                )}
                {o.myRole === 'buyer' && o.status === 'SHIPPING' && (
                  <button onClick={()=>action(o.id,'deliver')}>到着済みにする</button>
                )}
                {o.myRole === 'buyer' && o.status === 'DELIVERED' && (
                  <button onClick={()=>action(o.id,'complete')}>受け取り評価済みにする</button>
                )}
              </div>
            )}

            <div style={{marginTop:8}}>
              <strong>取引メッセージ</strong>
              <div style={{
                border:'1px solid #eee',
                borderRadius:4,
                padding:6,
                maxHeight:150,
                overflowY:'auto',
                marginTop:4
              }}>
                {msgs.length === 0 && <div style={{color:'#888'}}>まだメッセージはありません。</div>}
                {msgs.map(m => (
                  <div key={m.id} style={{marginBottom:4}}>
                    <span style={{fontWeight:'bold'}}>
                      {otherSideLabel(o,m)}
                    </span>
                    <span style={{fontSize:12, color:'#888', marginLeft:4}}>
                      {m.created_at && new Date(m.created_at).toLocaleString()}
                    </span>
                    <div>{m.body}</div>
                  </div>
                ))}
              </div>

              {isAdmin ? (
                <div style={{marginTop:4, color:'#888'}}>
                  管理者はメッセージの閲覧のみ可能です。
                </div>
              ) : isCompleted ? (
                <div style={{marginTop:4, color:'#888'}}>
                  取引完了のため新しいメッセージは送れません。
                </div>
              ) : (
                <div style={{marginTop:4}}>
                  <textarea
                    rows={2}
                    style={{width:'100%', padding:4, boxSizing:'border-box'}}
                    placeholder="取引相手へのメッセージを入力"
                    value={input}
                    onChange={e=>setInputByOrder(prev=>({...prev, [o.id]: e.target.value}))}
                  />
                  <button
                    style={{marginTop:4, padding:'4px 12px', cursor:'pointer'}}
                    onClick={()=>sendMessage(o.id)}
                  >
                    送信
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </Layout>
  );
}





function 管理(){
  // undefined: 読み込み中 / null: 未ログイン / object: ログイン済み
  const [me,setMe] = React.useState(undefined);
  const [items,setItems] = React.useState([]);
  const [users,setUsers] = React.useState([]);

  React.useEffect(()=>{
    const t = getToken();
    if(!t){
      setMe(null);  // トークンがない＝未ログイン
      return;
    }

    // 自分（admin かどうか）
    fetch(AUTH_URL + '/me',{ headers:{...authHeader()} })
      .then(r => r.ok ? r.json() : null)
      .then(u => {
        setMe(u);
        if(!u || u.role !== 'admin') return;
        // admin だけユーザー一覧を取りに行く
        fetch(AUTH_URL + '/admin/users',{ headers:{...authHeader()} })
          .then(r => r.ok ? r.json() : [])
          .then(setUsers);
      });

    // 出品一覧（これは誰でも見れる運営用）
    fetch(LISTING_URL + '/listings?q=')
      .then(r => r.json())
      .then(setItems);
  },[]);

  // ここからガード
  if(me === undefined){
    // まだ /me を取りに行っている途中
    return (
      <Layout>
        <p>読み込み中です…</p>
      </Layout>
    );
  }

  if(me === null){
    // トークン無し or /me 失敗
    return <Navigate to="/login" />;
  }

  if(me.role !== 'admin'){
    // admin ではない
    return <Navigate to="/" />;
  }

  async function pauseListing(id){
    const r = await fetch(LISTING_URL + '/listings/' + id + '/pause',{
      method:'PATCH',
      headers:{...authHeader()}
    });
    if(r.ok) location.reload(); else alert('失敗しました');
  }

  async function activateListing(id){
    const r = await fetch(LISTING_URL + '/listings/' + id + '/activate',{
      method:'PATCH',
      headers:{...authHeader()}
    });
    if(r.ok) location.reload(); else alert('失敗しました');
  }

  async function freezeUser(id){
    const r = await fetch(AUTH_URL + '/admin/users/' + id + '/freeze',{
      method:'PATCH',
      headers:{...authHeader()}
    });
    if(r.ok) location.reload(); else alert('ユーザー凍結に失敗しました');
  }

  async function unfreezeUser(id){
    const r = await fetch(AUTH_URL + '/admin/users/' + id + '/unfreeze',{
      method:'PATCH',
      headers:{...authHeader()}
    });
    if(r.ok) location.reload(); else alert('解除に失敗しました');
  }

  return (
    <Layout>
      <h2>運営管理</h2>

      <h3 style={{marginTop:16}}>出品管理</h3>
      {items.map(x=> (
        <div key={x.id} style={{display:'flex', gap:8, alignItems:'center', padding:'6px 0', borderBottom:'1px solid #eee'}}>
          <span>#{x.id} {x.title} ¥{x.price} [{x.status}] seller:{x.seller_id}</span>
          {x.status!=='Paused'
            ? <button onClick={()=>pauseListing(x.id)}>停止</button>
            : <button onClick={()=>activateListing(x.id)}>再開</button>}
        </div>
      ))}

      <h3 style={{marginTop:24}}>ユーザー管理</h3>
      {users.map(u=> (
        <div key={u.id} style={{display:'flex', gap:8, alignItems:'center', padding:'6px 0', borderBottom:'1px solid #eee'}}>
          <span>#{u.id} {u.email} ({u.role}) {u.disabled && <b style={{color:'red'}}>凍結中</b>}</span>
          {u.role === 'admin'
            ? <span>管理者は凍結不可</span>
            : (u.disabled
              ? <button onClick={()=>unfreezeUser(u.id)}>凍結解除</button>
              : <button onClick={()=>freezeUser(u.id)}>凍結</button>)}
        </div>
      ))}
    </Layout>
  );
}



const router = createBrowserRouter([
  { path: "/", element: <マイページ/> },
  { path: "/login", element: <Login/> },
  { path: "/listings", element: <出品一覧/> },
  { path: "/sell", element: <出品/> },
  { path: "/orders", element: <取引一覧/> },
  { path: "/admin", element: <管理/> },
]);


createRoot(document.getElementById('root')).render(<RouterProvider router={router} />)
