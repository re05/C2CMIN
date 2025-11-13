import React, { useState } from 'react'
import { api } from '../api'

export default function Sell(){
  const [title,setTitle]=useState('');
  const [price,setPrice]=useState(0);
  const submit=async e=>{ e.preventDefault(); await api.listings.create({title,price:Number(price)}); setTitle(''); setPrice(0); };
  return (
    <form onSubmit={submit} style={{display:'grid', gap:8, width:320}}>
      <h3>新規出品</h3>
      <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="タイトル"/>
      <input value={price} onChange={e=>setPrice(e.target.value)} type="number" placeholder="価格"/>
      <button>登録</button>
    </form>
  )
}
