import { useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { OrderSort } from '@/lib/order-utils'
import type { DesignType, Order, OrderStatus, ToothCode } from '@/types'
import { ARCH_LABELS, DESIGN_TYPES, ORDER_STATUS, toothLabel, toothSort } from '@/types'
import { downloadFileNow, refreshFileUrl } from '@/lib/store'

/* 状态徽章 —— 纸面柔色块（B版），语义色 */
const PILL: Record<string, string> = {
  orange: 'bg-[#f6ecd8] text-[#8a5a13]',
  blue: 'bg-[#e3edf6] text-[#20557f]',
  green: 'bg-[#eef4f0] text-[#1e5c46]',
  red: 'bg-[#f6e5e1] text-[#b3402f]',
}

export function StatusPill({ status }: { status: OrderStatus }) {
  const s = ORDER_STATUS[status]
  const pulse = status ==='completed' ? 'animate-pulse-green' : status ==='rework' ? 'animate-pulse-red' : ''
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12.5px] font-medium', PILL[s.tone], pulse)}>
      {s.label}
    </span>
  )
}

export function TypeTag({ type, urgent }: { type: DesignType; urgent?: boolean }) {
  const isUrgent = urgent || type === 'jike' // 即刻设计备注为加急
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-[15px] font-medium text-stone-800">{DESIGN_TYPES[type].label}</span>
      {isUrgent && (
        <span className="rounded-full bg-[#b3402f] px-2 py-px text-[12px] font-semibold tracking-wide text-white">
          加急件
        </span>
      )}
    </span>
  )
}

/* 区块标题：mono 编号 + 中文标题 + hairline */
export function SectionHead({ index, title, desc, right }: { index: string; title: string; desc?: string; right?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4 border-b border-stone-300 pb-3">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[12px] tabular-nums tracking-[0.18em] text-stone-400">{index}</span>
        <div>
          <h2 className="text-[18px] font-semibold tracking-tight text-stone-900">{title}</h2>
          {desc && <p className="mt-0.5 text-[13.5px] text-stone-500">{desc}</p>}
        </div>
      </div>
      {right}
    </div>
  )
}

/* 数字统计块 —— tabular figures 大数字 */
export function Stat({ label, value, unit, tone }: { label: string; value: number | string; unit?: string; tone?: 'default' | 'warn' }) {
  return (
    <div className="border-l border-stone-300 pl-4 first:border-l-0 first:pl-0 shadow-sm">
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-stone-400">{label}</div>
      {/* key 随 value 变化触发重挂载，CSS 动画自然重放，无需 effect */}
      <div key={String(value)} className={cn('mt-1 font-display font-mono text-[28px] leading-none tabular-nums tracking-tight animate-count-pop', tone === 'warn' ? 'text-red-600' : 'text-stone-900')}>
        {value}
        {unit && <span className="ml-1 text-[13px] font-normal text-stone-400">{unit}</span>}
      </div>
    </div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="border border-dashed border-stone-300 px-6 py-12 text-center">
      <div className="text-[15px] font-medium text-stone-600">{title}</div>
      {hint && <div className="mt-1 text-[13.5px] text-stone-400">{hint}</div>}
    </div>
  )
}

/* 表单字段 */
export function Field({ label, required, optional, children, hint }: {
  label: string; required?: boolean; optional?: boolean; children: ReactNode; hint?: string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-2 text-[14px] font-medium text-stone-700">
        {label}
        {required && <span className="font-mono text-[11px] uppercase tracking-wider text-red-500">必填</span>}
        {optional && <span className="font-mono text-[11px] uppercase tracking-wider text-stone-400">可填可不填</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[12.5px] text-stone-400">{hint}</span>}
    </label>
  )
}

export const inputCls =
  'w-full rounded border border-stone-300 bg-white px-3 py-2.5 text-[16px] text-stone-900 placeholder:text-stone-400 transition-colors duration-150 focus-visible:outline-none focus-visible:ring focus-visible:ring-[#1e5c46]/60 focus-visible:ring-offset-1'

export const btnPrimary =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded bg-brand px-5 py-2.5 text-[14.5px] font-medium tracking-[0.04em] text-stone-50 transition-all duration-150 hover:bg-brand-light active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40'

export const btnGhost =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded border border-stone-300 bg-white px-4 py-2 text-[15px] font-medium text-stone-700 transition-colors duration-150 hover:border-stone-500 hover:text-stone-900 active:scale-[0.98]'

/* 可下载文件标签：有内容可直接下载；演示版大文件仅记录文件名 */
export function FileChip({ file, tone = 'green' }: { file: { name: string; dataUrl?: string; key?: string; url?: string }; tone?: 'green' | 'stone' }) {
  const cls = tone === 'green'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-stone-300 bg-stone-50 text-stone-600'
  if (file.dataUrl || file.key) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); void downloadFileNow(file).catch(() => {}) }}
        className={cn('inline-flex items-center gap-1.5 rounded-sm border px-3 py-1 font-mono text-[13.5px] transition-colors duration-150 hover:brightness-95', cls)}
        title="点击下载（实时签名）"
      >
        ↓ {file.name}
      </button>
    )
  }
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-sm border px-3 py-1 font-mono text-[13.5px]', cls)} title="演示版未保存文件内容">
      {file.name}
    </span>
  )
}

/* 牙位展示（只读小标签组） */
export function TeethInline({ teeth }: { teeth: ToothCode[] }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {[...teeth].sort(toothSort).map((t) => (
        <span key={t} className="rounded-sm bg-brand px-1.5 py-px font-mono text-[12px] tabular-nums text-stone-50">
          {toothLabel(t)}
        </span>
      ))}
    </span>
  )
}

/* 订单范围展示：马龙桥显示上/下颌/全口，自定义单显示颗数，普通单显示牙位标签 */
export function OrderScope({ order: o }: { order: Order }) {
  if (o.type === 'malong') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-sm bg-brand px-1.5 py-px text-[12px] text-stone-50">
        马龙桥 · {o.arch ? ARCH_LABELS[o.arch] : '全口'}
      </span>
    )
  }
  if (o.custom) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-sm bg-brand px-1.5 py-px text-[12px] text-stone-50">
        自定义 {o.customCount ?? 0} 颗
      </span>
    )
  }
  return <TeethInline teeth={o.teeth} />
}

/* 照片缩略图：点击放大（Lightbox），放大后可下载 */
export function ImageThumb({ img, size = 'h-14 w-14' }: { img: { name: string; dataUrl?: string; key?: string; url?: string }; size?: string }) {
  const [open, setOpen] = useState(false)
  const [fresh, setFresh] = useState<string | undefined>()
  const src = fresh ?? img.dataUrl ?? img.url
  const openPreview = () => {
    setOpen(true)
    // 2.7：点开预览时实时重新签名，避免 bootstrap 旧签名过期 403
    if (img.key && !fresh) {
      void refreshFileUrl(img).then((u) => { if (u) setFresh(u) }).catch(() => {})
    }
  }
  return (
    <>
      <button type="button" className={cn('overflow-hidden rounded border border-stone-300 bg-stone-100', size)} onClick={openPreview} title="点击放大">
        {src
          ? <img src={src} alt={img.name} className="h-full w-full object-cover" />
          : <span className="flex h-full w-full items-center justify-center overflow-hidden break-all px-0.5 text-center font-mono text-[9px] leading-tight text-stone-400">{img.name}</span>}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setOpen(false)}>
          <div className="max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            {src
              ? <img src={src} alt={img.name} className="max-h-[85vh] max-w-[90vw] object-contain" />
              : <div className="bg-white px-10 py-8 font-mono text-[14px] text-stone-500">{img.name}（演示版未保存图片内容）</div>}
            <div className="mt-3 flex justify-center gap-3">
              <button type="button" className="rounded-full bg-white px-4 py-1.5 text-[14px] text-stone-700 hover:bg-stone-100" onClick={() => void downloadFileNow(img).catch(() => {})}>下载照片</button>
              <button type="button" className="rounded-full bg-white/20 px-4 py-1.5 text-[14px] text-white" onClick={() => setOpen(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* 订单流程时间线：提交 → 接单 → 完成（退回/返工为红色终态） */
export function OrderTimeline({ order: o }: { order: Order }) {
  const fmt = (iso?: string) => {
    if (!iso) return ''
    const d = new Date(iso)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  const steps = [
    { label: '提交订单', time: fmt(o.createdAt), done: true },
    { label: '设计师接单', time: fmt(o.acceptedAt), done: !!o.acceptedAt },
    { label: '设计完成', time: fmt(o.completedAt), done: !!o.completedAt },
  ]
  const terminal =
    o.status === 'returned' ? '已退回'
    : o.status === 'rework' ? '返工重做中'
    : null
  const cancelled = o.status === 'cancelled'
  return (
    <div className="flex items-start overflow-x-auto py-1">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-start">
          {i > 0 && <div className={cn('mt-[5px] h-px w-6 shrink-0 sm:w-10', s.done ? 'bg-brand' : 'bg-stone-200')} />}
          <div className="flex flex-col items-center gap-1 px-1 text-center">
            <span className={cn('h-2.5 w-2.5 rounded-full', s.done ? 'bg-brand' : 'border border-stone-300 bg-white')} />
            <span className={cn('whitespace-nowrap text-[12px]', s.done ? 'font-medium text-stone-700' : 'text-stone-400')}>{s.label}</span>
            {s.time && <span className="whitespace-nowrap font-mono text-[10.5px] tabular-nums text-stone-400">{s.time}</span>}
          </div>
        </div>
      ))}
      {terminal && (
        <div className="flex items-start">
          <div className="mt-[5px] h-px w-6 shrink-0 bg-red-300 sm:w-10" />
          <div className="flex flex-col items-center gap-1 px-1 text-center">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
            <span className="whitespace-nowrap text-[12px] font-medium text-red-600">{terminal}</span>
          </div>
        </div>
      )}
      {cancelled && (
        <div className="flex items-start">
          <div className="mt-[5px] h-px w-6 shrink-0 bg-stone-300 sm:w-10" />
          <div className="flex flex-col items-center gap-1 px-1 text-center">
            <span className="h-2.5 w-2.5 rounded-full bg-stone-400" />
            <span className="whitespace-nowrap text-[12px] font-medium text-stone-500">已撤回</span>
            {o.cancelledAt && <span className="whitespace-nowrap font-mono text-[10.5px] tabular-nums text-stone-400">{fmt(o.cancelledAt)}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

/** 订单列表排序切换按钮组 */
export function SortBar({ sort, onChange }: { sort: OrderSort; onChange: (s: OrderSort) => void }) {
  const opts: [OrderSort, string][] = [['new', '最新'], ['old', '最早'], ['points', '积分高'], ['status', '按状态']]
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-stone-300 bg-white p-1">
      <span className="pl-1.5 text-[12px] text-stone-400">排序</span>
      {opts.map(([k, label]) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={cn('rounded-full px-2.5 py-0.5 text-[12px] font-medium transition-colors duration-150', sort === k ? 'bg-brand text-stone-50' : 'text-stone-500 hover:text-stone-900')}
        >
          {label}
        </button>
      ))}
    </span>
  )
}
