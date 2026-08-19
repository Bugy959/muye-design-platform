import { useState } from 'react'
import { authenticate, saveSession, type Session } from '@/lib/store'
import { cn } from '@/lib/utils'

/* 左屏装饰：左上 + 右下角衬托的叶脉弧线（平滑贝塞尔） */
function Veins() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 600 900"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      aria-hidden
    >
      {/* 左上角 */}
      <g stroke="#faf9f5" opacity="0.08">
        <path d="M-30 150 Q 90 90 190 -30" strokeWidth="1.2" />
        <path d="M-30 260 Q 160 160 330 -30" strokeWidth="1" />
        <path d="M-30 380 C 120 300 260 180 430 -30" strokeWidth="0.8" />
        <path d="M-30 60 Q 40 30 110 -30" strokeWidth="1" />
      </g>
      {/* 右下角 */}
      <g stroke="#faf9f5" opacity="0.08">
        <path d="M630 750 Q 510 810 410 930" strokeWidth="1.2" />
        <path d="M630 640 Q 440 740 270 930" strokeWidth="1" />
        <path d="M630 520 C 480 600 340 720 170 930" strokeWidth="0.8" />
        <path d="M630 840 Q 560 870 490 930" strokeWidth="1" />
      </g>
    </svg>
  )
}

export function Login({ onLogin }: { onLogin: (s: Session) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [showDemo, setShowDemo] = useState(false)

  const submit = () => {
    const s = authenticate(username, password)
    if (!s) {
      setError('账号或密码不正确，请重试')
      return
    }
    saveSession(s)
    onLogin(s)
  }

  const fieldCls =
    'w-full border-b border-stone-300 bg-transparent py-2.5 pl-7 pr-8 text-[16px] text-stone-900 placeholder:text-stone-400 transition-colors duration-150 focus:border-[#1e5c46] focus:outline-none'

  return (
    <div className="flex min-h-screen">
      {/* 左：品牌区 */}
      <div className="relative hidden w-1/2 flex-col items-center justify-center overflow-hidden bg-[#1e5c46] md:flex">
        <Veins />
        <div className="flex h-44 w-44 items-center justify-center rounded-[2.5rem] bg-[#faf9f5] shadow-lg">
          <img src="logo-icon.png" alt="木叶义齿" className="w-32" />
        </div>
        <h1 className="mt-6 text-[32px] font-semibold tracking-[0.35em] text-[#faf9f5]">木叶义齿</h1>
      </div>

      {/* 右：登录表单 */}
      <div className="flex flex-1 flex-col items-center justify-center bg-[#faf9f5] px-6">
        {/* 移动端品牌（小屏显示） */}
        <div className="mb-8 flex flex-col items-center md:hidden">
          <img src="logo-icon.png" alt="木叶义齿" className="w-24" />
          <h1 className="mt-3 text-[23px] font-semibold tracking-[0.3em] text-[#1e5c46]">木叶义齿</h1>
        </div>

        <div className="w-full max-w-sm">
          <h2 className="text-[23px] font-semibold tracking-tight text-stone-900">登录</h2>
          <p className="mt-1 text-[14px] text-stone-500">请使用管理端分配的账号登录</p>

          <form
            className="mt-8 space-y-6"
            onSubmit={(e) => { e.preventDefault(); submit() }}
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-0 top-2.5 text-stone-400">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></svg>
              </span>
              <input
                className={fieldCls}
                placeholder="请输入账号"
                value={username}
                autoFocus
                onChange={(e) => { setUsername(e.target.value); setError('') }}
              />
              <span className="pointer-events-none absolute -top-3.5 left-0 font-mono text-[11px] uppercase tracking-[0.18em] text-stone-400">账号</span>
            </div>

            <div className="relative">
              <span className="pointer-events-none absolute left-0 top-2.5 text-stone-400">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="11" width="14" height="9" rx="1.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
              </span>
              <input
                className={fieldCls}
                type={showPw ? 'text' : 'password'}
                placeholder="请输入密码"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
              />
              <span className="pointer-events-none absolute -top-3.5 left-0 font-mono text-[11px] uppercase tracking-[0.18em] text-stone-400">密码</span>
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-0 top-2.5 text-stone-400 transition-colors hover:text-stone-700"
                aria-label={showPw ? '隐藏密码' : '显示密码'}
              >
                {showPw ? (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" /><circle cx="12" cy="12" r="2.5" /></svg>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3l18 18" /><path d="M10.6 6.2A10.8 10.8 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.7M6.6 6.9A16.4 16.4 0 0 0 2 12s3.5 6 10 6c1.4 0 2.7-.3 3.8-.7" /></svg>
                )}
              </button>
            </div>

            {error && <p className="text-[14px] text-red-600">{error}</p>}

            <button
              type="submit"
              className={cn(
                'w-full rounded-full bg-[#1e5c46] py-3 text-[16px] font-medium text-[#faf9f5]',
                'transition-all duration-150 hover:bg-[#2a5139] active:scale-[0.99]',
              )}
            >
              登 录
            </button>
          </form>

          <div className="mt-10 border-t border-stone-200 pt-4">
            <button
              className="font-mono text-[11.5px] uppercase tracking-[0.18em] text-stone-400 transition-colors hover:text-stone-600"
              onClick={() => setShowDemo(!showDemo)}
            >
              {showDemo ? '收起演示账号 ▲' : '演示账号 ▼'}
            </button>
            {showDemo && (
              <div className="mt-3 space-y-1 font-mono text-[13px] tabular-nums text-stone-500">
                <p>管理端：admin / muye2026</p>
                <p>医院：mingzhou · hengmei · yahe / 123456</p>
                <p>设计师：li · wang · zhao · sun · zhou / 123456</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
