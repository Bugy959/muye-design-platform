import { useEffect, useState } from "react"
import { initBackend, refreshFromServer, useDB, loadSession, saveSession, type Session } from "@/lib/store"
import { apiLogout, API_BASE, isBackendMode } from "@/lib/api"
import { Login } from "@/sections/Login"
import { ClientApp } from "@/sections/ClientApp"
import { DesignerApp } from "@/sections/DesignerApp"
import { AdminApp } from "@/sections/AdminApp"

export default function App() {
  const db = useDB()
  const [session, setSession] = useState<Session | null>(() => loadSession())
  const [readyFor, setReadyFor] = useState<Session | null>(null)
  const [failedFor, setFailedFor] = useState<Session | null>(null)
  const [retryTick, setRetryTick] = useState(0)
  const backend = isBackendMode()

  /* 后端模式：登录后先拉取服务端数据再进入应用；之后每 15 秒轮询，保证接单大厅等列表接近实时 */
  useEffect(() => {
    if (!session || !backend) return
    let alive = true
    initBackend().then((ok) => {
      if (!alive) return
      if (ok) setReadyFor(session)
      else setFailedFor(session)
    })
    const timer = setInterval(() => { void refreshFromServer() }, 15000)
    return () => { alive = false; clearInterval(timer) }
  }, [session, backend, retryTick])

  const client = session?.role === "client" ? db.clients.find((c) => c.id === session.clientId) : undefined
  const designer = session?.role === "designer" ? db.designers.find((d) => d.id === session.designerId) : undefined

  /* 账号被删除或数据重置后，登录态失效 */
  const sessionValid =
    !session ||
    session.role === "admin" ||
    (session.role === "client" && !!client) ||
    (session.role === "designer" && !!designer)

  const logout = () => {
    if (backend && session?.token) apiLogout(session.token).catch(() => {})
    saveSession(null)
    setSession(null)
  }

  if (!session || !sessionValid) {
    return (
      <div className="flex min-h-screen flex-col">
        <main className="flex-1">
          <Login onLogin={setSession} />
        </main>
        <Disclaimer />
      </div>
    )
  }

  if (backend && failedFor === session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#faf9f5] px-6 text-center">
        <p className="text-[17px] font-medium text-stone-800">无法连接后端服务器</p>
        <p className="mt-2 font-mono text-[13px] text-stone-400">{API_BASE}</p>
        <p className="mt-3 text-[14px] leading-relaxed text-stone-500">
          请先启动后端：<span className="font-mono text-[13px] text-stone-600">cd server && npm run dev</span>
        </p>
        <div className="mt-7 flex items-center gap-3">
          <button
            type="button"
            className="rounded-full bg-[#1e5c46] px-6 py-2 text-[14px] font-medium text-[#faf9f5] transition-colors hover:bg-[#2a5139]"
            onClick={() => { setFailedFor(null); setRetryTick((t) => t + 1) }}
          >
            重试
          </button>
          <button
            type="button"
            className="rounded-full border border-stone-300 px-6 py-2 text-[14px] text-stone-600 transition-colors hover:border-stone-500"
            onClick={() => { localStorage.setItem('muye-data-mode', 'demo'); window.location.reload() }}
          >
            使用演示数据
          </button>
          <button type="button" className="px-3 py-2 text-[13px] text-stone-400 hover:text-stone-600" onClick={logout}>
            退出登录
          </button>
        </div>
      </div>
    )
  }

  if (backend && readyFor !== session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf9f5]">
        <p className="text-[14px] text-stone-400">正在连接后端数据…</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* 顶栏：B版纸面网格 —— 纸面底 + 发丝线分格 */}
      <div className="border-b border-[#ddd6c6] bg-[#fdfaf6]">
        <div className="mx-auto flex max-w-6xl items-stretch justify-between">
          <div className="flex items-center gap-2.5 border-r border-[#ddd6c6] px-5 py-2.5">
            <img src="logo-icon.png" alt="木叶义齿" className="h-8 w-auto" />
            <span className="text-[16px] font-semibold tracking-tight text-[#1c1a17]">木叶义齿 · 设计平台</span>
          </div>
          <div className="flex items-stretch">
            <span className="flex items-center border-l border-[#ddd6c6] px-5 text-[13px] text-stone-500">
              {session.role === "admin"
                ? "管理端"
                : session.role === "client"
                  ? client?.name
                  : `${designer?.name.charAt(0)} 师傅`}
              {" · "}
              {session.username}
            </span>
            {!backend && (
              <button
                type="button"
                title="当前为本地演示数据，点击切换为后端数据"
                className="border-l border-[#ddd6c6] px-4 font-mono text-[11px] uppercase tracking-wider text-amber-600 transition-colors hover:bg-amber-50"
                onClick={() => { localStorage.removeItem('muye-data-mode'); window.location.reload() }}
              >
                演示数据
              </button>
            )}
            <button
              type="button"
              className="border-l border-[#ddd6c6] px-5 text-[13.5px] text-[#1c1a17] transition-colors duration-150 hover:bg-[#1e5c46] hover:text-[#fdfaf6]"
              onClick={logout}
            >
              退出登录
            </button>
          </div>
        </div>
      </div>

      <main className="flex-1">
        {session.role === "client" && client && <ClientApp key={client.id} client={client} />}
        {session.role === "designer" && designer && <DesignerApp key={designer.id} designer={designer} />}
        {session.role === "admin" && <AdminApp />}
      </main>

      <Disclaimer />
    </div>
  )
}

/* 平台免责声明 */
function Disclaimer() {
  return (
    <footer className="border-t border-stone-200 bg-[#faf9f5]">
      <p className="mx-auto max-w-6xl px-5 py-4 text-center text-[13px] leading-relaxed text-stone-400">
        本平台仅提供数字化建模技术服务，为医院 / 加工厂与设计师提供订单交接环境，不对最终义齿的临床效果及医疗器材质量承担责任。
        平台积分由管理方线下充值结算，积分解释权归管理方所有。
      </p>
    </footer>
  )
}
