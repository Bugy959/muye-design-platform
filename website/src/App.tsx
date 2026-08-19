import { useState } from "react"
import { useDB, loadSession, saveSession, type Session } from "@/lib/store"
import { Login } from "@/sections/Login"
import { ClientApp } from "@/sections/ClientApp"
import { DesignerApp } from "@/sections/DesignerApp"
import { AdminApp } from "@/sections/AdminApp"

export default function App() {
  const db = useDB()
  const [session, setSession] = useState<Session | null>(() => loadSession())

  const client = session?.role === "client" ? db.clients.find((c) => c.id === session.clientId) : undefined
  const designer = session?.role === "designer" ? db.designers.find((d) => d.id === session.designerId) : undefined

  /* 账号被删除或数据重置后，登录态失效 */
  const sessionValid =
    !session ||
    session.role === "admin" ||
    (session.role === "client" && !!client) ||
    (session.role === "designer" && !!designer)

  const logout = () => {
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
