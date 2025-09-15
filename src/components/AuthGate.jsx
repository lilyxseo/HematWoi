import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

export default function AuthGate({ children }) {
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState("")

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null); setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => {
      setUser(session?.user ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function signIn(e) {
    e.preventDefault()
    setErr("")
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setErr(error.message)
  }
  async function signUp(e) {
    e.preventDefault()
    setErr("")
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) setErr(error.message)
  }
  async function signOut() { await supabase.auth.signOut() }

  if (loading) return <div className="p-6">Loading…</div>
  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center bg-bg">
        <form onSubmit={signIn} className="w-[360px] space-y-3 bg-surface-1 p-4 rounded-xl border border-border">
          <h1 className="text-xl font-bold">Masuk HematWoi</h1>
          <input className="input" placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
          <input className="input" type="password" placeholder="password" value={password} onChange={e=>setPassword(e.target.value)} />
          {err && <p className="text-sm text-danger">{err}</p>}
          <div className="flex gap-2">
            <button className="btn btn-primary">Masuk</button>
            <button type="button" onClick={signUp} className="btn">Daftar</button>
          </div>
        </form>
      </div>
    )
  }
  return (
    <div>
      <div className="p-2 text-sm bg-surface-2 flex items-center justify-between">
        <span>Login sebagai <b>{user.email}</b></span>
        <button onClick={signOut} className="btn">Keluar</button>
      </div>
      {children}
    </div>
  )
}
