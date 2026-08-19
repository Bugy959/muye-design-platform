import { useMemo, useRef, useState } from 'react'
import type { Arch, Client, DesignType, Order, OrderFile, OrderImage, ToothCode } from '@/types'
import { ARCH_LABELS, DESIGN_TYPES, MALONG_POINTS, URGENT_POINTS_PER_TOOTH } from '@/types'
import { cancelOrder, cancelReworkRequest, createOrder, createReworkRequest, designerAlias, getClientReworks, isFileTooLarge, markNoticeRead, markNoticesRead, orderCount, orderPoints, orderStats, readOrderFile, resubmitOrder, searchOrders, updateReworkRequest, useDB } from '@/lib/store'
import { ToothChart, ToothChartMini } from '@/components/ToothChart'
import { EmptyState, Field, FileChip, ImageThumb, OrderTimeline, SectionHead, SortBar, StatusPill, TeethInline, btnGhost, btnPrimary, fmtSize, inputCls, sortOrders } from '@/components/bits'
import type { OrderSort } from '@/components/bits'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

const fmtTime = (iso: string) => {
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function ClientApp({ client }: { client: Client }) {
  const db = useDB()
  const [tab, setTab] = useState<'design' | 'ai' | 'service' | 'points' | 'notices' | 'orders'>('design')
  const myOrders = useMemo(() => db.orders.filter((o) => o.clientId === client.id), [db.orders, client.id])
  const myNotices = useMemo(() => db.notices.filter((n) => n.clientId === client.id), [db.notices, client.id])
  const myReworks = useMemo(() => getClientReworks(db, client.id), [db.reworks, client.id])
  const myStats = useMemo(() => orderStats(db, 'client', client.id), [db.orders, client.id])
  const myTxns = useMemo(() => db.txns.filter((t) => t.clientId === client.id), [db.txns, client.id])
  const unread = myNotices.filter((n) => !n.read).length

  return (
    <div className="mx-auto max-w-5xl px-5 pb-20 pt-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-stone-300 pb-5">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-stone-400">
            {client.kind === 'hospital' ? '医院端' : '加工厂端'}
          </div>
          <h1 className="mt-1 font-display text-[28px] font-semibold tracking-tight text-brand">{client.name}</h1>
          <p className="mt-0.5 font-mono text-[13px] tabular-nums text-stone-500">{client.phone}</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <button
            onClick={() => setTab('points')}
            className={cn(
              'flex items-baseline gap-2 rounded-full border px-4 py-1.5 transition-colors duration-150',
              client.points < 50 ? 'border-red-300 bg-red-50 animate-alert-blink' : 'border-stone-200 bg-white hover:border-brand',
            )}
            title="查看积分明细"
          >
            <span className="text-[12.5px] text-stone-500">积分余额</span>
            <span className={cn('font-mono text-[18px] font-semibold tabular-nums', client.points < 50 ? 'text-red-600' : 'text-brand')}>
              {client.points}
            </span>
          </button>
          <nav className="flex flex-wrap gap-2 border-b-2 border-[#ddd6c6]">
            {([
              ['design', '设计师设计'],
              ['ai', 'AI 设计'],
              ['service', '用户服务'],
              ['points', '积分明细'],
              ['notices', unread > 0 ? `消息 · ${unread} 条未读` : '消息'],
              ['orders', `我的订单 ${myOrders.length}`],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={cn(
                  '-mb-[2px] border-b-2 border-transparent px-4 py-2 text-[14px] font-medium transition-colors duration-150',
                  tab === k ? 'border-brand font-semibold text-brand' : 'text-stone-500 hover:text-stone-900',
                )}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* 订单概览 */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-md border border-stone-300 bg-white p-4"><div className="text-[11px] uppercase tracking-wider text-stone-400">总订单</div><div className="mt-1 font-mono text-[24px] tabular-nums text-stone-900">{myStats.total}</div></div>
        <div className="rounded-md border border-stone-300 bg-white p-4"><div className="text-[11px] uppercase tracking-wider text-stone-400">本月订单</div><div className="mt-1 font-mono text-[24px] tabular-nums text-stone-900">{myStats.monthly}</div></div>
        <div className="rounded-md border border-stone-300 bg-white p-4"><div className="text-[11px] uppercase tracking-wider text-stone-400">已完成</div><div className="mt-1 font-mono text-[24px] tabular-nums text-emerald-600">{myStats.completed}</div></div>
        <button className="rounded-md border border-stone-300 bg-white p-4 text-left hover:border-amber-400" onClick={() => setTab('service')} title="点击查看返工/退回详情">
          <div className="text-[11px] uppercase tracking-wider text-stone-400">返工/退回</div><div className="mt-1 font-mono text-[24px] tabular-nums text-amber-600">{myStats.reworked + myStats.returned}</div>
        </button>
      </div>
      {tab === 'design' && <NewOrder client={client} onDone={() => setTab('orders')} />}
      {tab === 'ai' && <AIDesign />}
      {tab === 'service' && <UserService orders={myOrders} reworks={myReworks} client={client} />}
      {tab === 'orders' && <OrderList orders={myOrders} clientId={client.id} />}
      {tab === 'points' && (
        <section>
          <SectionHead index="03" title="积分明细" desc="积分由管理方线下充值与结算；如对明细有疑问请联系管理方" />
          <div className="mb-6 flex items-baseline gap-3">
            <span className="text-[14px] text-stone-500">当前余额</span>
            <span className={cn('font-mono text-[32px] font-semibold tabular-nums leading-none', client.points < 50 ? 'text-red-600' : 'text-brand')}>
              {client.points}
            </span>
            <span className="text-[13px] text-stone-400">分</span>
          </div>
          {myTxns.length === 0 ? (
            <EmptyState title="暂无积分记录" />
          ) : (
            <div className="overflow-x-auto border-y border-stone-200">
              <table className="w-full min-w-[560px] text-left text-[14px]">
                <thead>
                  <tr className="border-b border-stone-200 font-mono text-[11px] uppercase tracking-[0.14em] text-stone-400">
                    <th className="py-2.5 pr-4 font-medium">时间</th>
                    <th className="py-2.5 pr-4 font-medium">事由</th>
                    <th className="py-2.5 pr-4 font-medium text-right">变动</th>
                    <th className="py-2.5 font-medium text-right">余额</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {myTxns.map((t) => (
                    <tr key={t.id}>
                      <td className="py-3 pr-4 font-mono tabular-nums text-stone-400">{fmtTime(t.createdAt)}</td>
                      <td className="py-3 pr-4 text-stone-700">{t.reason}</td>
                      <td className={cn('py-3 pr-4 text-right font-mono tabular-nums', t.delta >= 0 ? 'text-emerald-600' : 'text-stone-900')}>
                        {t.delta >= 0 ? `+${t.delta}` : t.delta}
                      </td>
                      <td className="py-3 text-right font-mono tabular-nums text-stone-500">{t.balance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      {tab === 'notices' && (
        <section>
          <SectionHead index="04" title="消息" desc="订单完成、退回、返工审核结果都会在这里提醒你" />
          {myNotices.length === 0 ? (
            <EmptyState title="暂无消息" hint="订单完成或被退回时会收到提醒" />
          ) : (
            <ul className="divide-y divide-stone-300 border-y border-stone-300">
              {myNotices.map((n) => (
                <li key={n.id} className={cn("flex items-center justify-between gap-4 py-3.5 cursor-pointer", !n.read && "hover:bg-stone-50")} onClick={() => { if (!n.read) markNoticeRead(n.id) }}>
                  <div className="flex items-center gap-3">
                    <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', n.read ? 'bg-stone-300' : 'bg-emerald-500')} />
                    <span className="text-[15px] text-stone-800">{n.text}</span>
                  </div>
                  <span className="shrink-0 font-mono text-[12.5px] tabular-nums text-stone-400">{fmtTime(n.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

/* ---------------- 提交新订单 ---------------- */

function NewOrder({ client, onDone }: { client: Client; onDone: () => void }) {
  const [type, setType] = useState<DesignType>('jike')
  const [urgent, setUrgent] = useState(false)
  const [teeth, setTeeth] = useState<ToothCode[]>([])
  const [custom, setCustom] = useState(false)
  const [customCount, setCustomCount] = useState('')
  const [arch, setArch] = useState<Arch>('upper')
  const [patient, setPatient] = useState('')
  const [requirement, setRequirement] = useState('')
  const [scanFiles, setScanFiles] = useState<OrderFile[]>([])
  const [images, setImages] = useState<OrderImage[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState('')
  const scanRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const isMalong = type === 'malong'
  const useCustom = isMalong || custom
  const countNum = parseInt(customCount, 10) || 0

  const toggleTooth = (t: ToothCode) =>
    setTeeth((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))

  const pickScans = async (files: FileList | null) => {
    if (!files) return
    for (const f of Array.from(files)) {
      setScanFiles((prev) => [...prev, { name: f.name }]) // 先占位
      const of = await readOrderFile(f)
      setScanFiles((prev) => prev.map((x, i) => (x.name === of.name && !x.dataUrl && i === prev.findIndex((y) => y.name === of.name && !y.dataUrl) ? of : x)))
    }
  }

  const pickImages = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach(async (f) => {
      if (isFileTooLarge(f, 10)) { setError('照片超出 10MB 限制，请压缩后重试'); return }
      const of = await readOrderFile(f)
      setImages((prev) => [...prev, of])
    })
  }

  const cost = isMalong
    ? MALONG_POINTS
    : useCustom
      ? (countNum > 0 ? orderPoints(type, urgent && DESIGN_TYPES[type].urgentAllowed, [], countNum) : 0)
      : (teeth.length > 0 ? orderPoints(type, urgent && DESIGN_TYPES[type].urgentAllowed, teeth) : 0)

  const scopeReady = isMalong ? !!arch : useCustom ? countNum > 0 : teeth.length > 0
  const canSubmit = scopeReady && requirement.trim().length > 0 && scanFiles.length > 0 && images.length >= 1

  const quantityText = isMalong ? ' 1 件' : useCustom && countNum > 0 ? ` ${countNum} 颗` : teeth.length > 0 ? ` ${teeth.length} 颗` : ''

  const doSubmit = () => {
    if (submitting || !canSubmit) return
    setConfirmOpen(false)
    if (client.points < cost) {
      setError('积分不足，请联系管理方充值')
      return
    }
    setSubmitting(true)
    const o = createOrder({
      clientId: client.id, type, urgent: urgent && DESIGN_TYPES[type].urgentAllowed,
      teeth, custom: useCustom, customCount: useCustom ? countNum : undefined,
      arch: isMalong ? arch : undefined,
      patient: patient.trim() || undefined,
      requirement: requirement.trim(), scanFiles, images,
    })
    setSubmitting(false)
    if (!o) {
      setError('积分不足，请联系管理方充值')
      return
    }
    setDone(o.no)
    setTeeth([]); setRequirement(''); setImages([]); setScanFiles([]); setUrgent(false); setCustom(false); setCustomCount(''); setPatient(''); setError('')
  }

  if (done) {
    return (
      <section className="mx-auto max-w-xl border border-stone-200 bg-white px-8 py-14 text-center">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-emerald-600">已提交</div>
        <h2 className="mt-2 text-[24px] font-semibold tracking-tight text-stone-900">订单已提交</h2>
        <p className="mt-2 font-mono text-[15px] tabular-nums text-stone-500">单号 {done}</p>
        <p className="mt-3 text-[14.5px] leading-relaxed text-stone-500">
          设计师接单并完成设计后，你会在「消息」中收到完成提醒，届时可下载设计文件。
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <button className={btnPrimary} onClick={onDone}>查看我的订单</button>
          <button className={btnGhost} onClick={() => setDone(null)}>再提交一单</button>
        </div>
      </section>
    )
  }

  return (
    <section>
      <SectionHead index="01" title="设计师设计" desc="选择设计类型与牙位（或自定义颗数），上传扫描文件和照片，填写设计要求" />
      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-7">
          <Field label="设计类型" required>
            <div className="divide-y divide-stone-200 rounded-md border border-stone-300 bg-white">
              {(Object.keys(DESIGN_TYPES) as DesignType[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setType(k)
                    if (!DESIGN_TYPES[k].urgentAllowed) setUrgent(false)
                    if (k === 'malong') setCustom(true)
                  }}
                  className={cn(
                    'flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors duration-150',
                    type === k ? 'bg-brand text-stone-50' : 'hover:bg-stone-100',
                  )}
                >
                  <span className="text-[15px] font-medium">{DESIGN_TYPES[k].label}</span>
                  <span className="flex items-center gap-2">
                    <span className={cn(
                      'rounded-sm px-2.5 py-0.5 text-[12.5px] font-semibold',
                      type === k ? 'bg-white/20 text-stone-50' : 'bg-brand-soft text-brand',
                    )}>
                      {k === 'malong' ? `${MALONG_POINTS} 分 / 件` : `${DESIGN_TYPES[k].pointsPerTooth} 分 / 颗`}
                    </span>
                    {k === 'jike' && (
                      <span className="rounded-sm bg-[#b3402f] px-2.5 py-0.5 text-[12.5px] font-semibold text-white">
                        加急件
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </Field>

          {DESIGN_TYPES[type].urgentAllowed && (
            <Field label="加急">
              <button
                type="button"
                onClick={() => setUrgent(!urgent)}
                className={cn(
                  'flex w-full items-center justify-between rounded-md border px-4 py-3 transition-colors duration-150',
                  urgent ? 'border-red-300 bg-red-50' : 'border-stone-300 bg-white hover:bg-stone-100',
                )}
              >
                <span className={cn('text-[15px] font-medium', urgent ? 'text-red-700' : 'text-stone-700')}>
                  {urgent ? `已选择加急（+${URGENT_POINTS_PER_TOOTH} 分 / 颗）` : '普通件'}
                </span>
                <span className={cn('h-2 w-2 rounded-full', urgent ? 'bg-red-500' : 'bg-stone-300')} />
              </button>
            </Field>
          )}

          {isMalong ? (
            <Field label="桥架范围" required hint="马龙桥按件固定收费，与颗数无关">
              <div className="flex gap-2">
                {(Object.keys(ARCH_LABELS) as Arch[]).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setArch(a)}
                    className={cn(
                      'flex-1 rounded-md border px-4 py-3 text-[15px] font-medium transition-colors duration-150',
                      arch === a ? 'border-brand bg-brand text-stone-50' : 'border-stone-300 bg-white text-stone-600 hover:border-brand',
                    )}
                  >
                    {ARCH_LABELS[a]}
                  </button>
                ))}
              </div>
            </Field>
          ) : (
            <Field label="牙位选择" required hint="可点选牙位图，也可切换「自定义颗数」直接填写数量（适合批量大单）">
              <div className="rounded-md border border-stone-300 bg-white p-4">
                <div className="mb-4 flex gap-1 rounded-full border border-stone-200 bg-stone-50 p-1">
                  {([false, true] as const).map((v) => (
                    <button
                      key={String(v)}
                      type="button"
                      onClick={() => setCustom(v)}
                      className={cn(
                        'flex-1 rounded-full px-4 py-1.5 text-[13.5px] font-medium transition-colors duration-150',
                        custom === v ? 'bg-brand text-stone-50' : 'text-stone-500 hover:text-stone-900',
                      )}
                    >
                      {v ? '自定义颗数' : '牙位图点选'}
                    </button>
                  ))}
                </div>
                {custom ? (
                  <div className="flex items-center gap-3">
                    <input
                      className={cn(inputCls, 'w-40')}
                      type="number"
                      min={1}
                      placeholder="填写颗数"
                      value={customCount}
                      onChange={(e) => setCustomCount(e.target.value.replace(/\D/g, ''))}
                      aria-label="自定义颗数"
                    />
                    <span className="text-[14px] text-stone-500">
                      颗{countNum > 0 && ` · 共 ${cost} 积分`}
                    </span>
                  </div>
                ) : (
                  <ToothChart selected={teeth} onToggle={toggleTooth} />
                )}
              </div>
            </Field>
          )}

          <Field label="患者姓名 / 编号" optional hint="选填；同一患者再次下单时，订单里会显示该患者的历史订单，方便病例追溯">
            <input
              className={inputCls}
              placeholder="例如：毕小香 或 病历号"
              value={patient}
              autoFocus
              onChange={(e) => setPatient(e.target.value)}
            />
          </Field>

          <Field label="上传扫描文件" required hint="口腔扫描导出的文件，不限制格式与数量">
            <input ref={scanRef} type="file" multiple className="hidden" onChange={(e) => pickScans(e.target.files)} />
            <div className="flex flex-wrap items-center gap-2">
              {scanFiles.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-sky-300 bg-sky-50 px-3 py-1.5 font-mono text-[12.5px] text-sky-800">
                  {f.name}{f.size ? `（${fmtSize(f.size)}）` : ''}
                  <button type="button" className="text-sky-400 hover:text-sky-700" onClick={() => setScanFiles((prev) => prev.filter((_, x) => x !== i))}>×</button>
                </span>
              ))}
              <button
                type="button"
                onClick={() => scanRef.current?.click()}
                className="rounded-full border border-dashed border-sky-300 px-4 py-1.5 text-[13px] text-sky-600 transition-colors duration-150 hover:border-sky-500 hover:text-sky-700"
              >
                + 选择扫描文件
              </button>
            </div>
          </Field>

          <Field label="上传照片" required hint="口内照、比色照、CT 截图等，至少 1 张，数量不限（单张不超过 10MB）">
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => pickImages(e.target.files)} />
            <div className="flex flex-wrap gap-3">
              {images.map((img, i) => (
                <div key={i} className="group relative h-20 w-20 overflow-hidden rounded-md border border-emerald-300 bg-emerald-50">
                  {img.dataUrl ? (
                    <img src={img.dataUrl} alt={img.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center px-1 text-center font-mono text-[10px] text-stone-400">{img.name}</span>
                  )}
                  {img.size ? (
                    <span className="absolute bottom-0 left-0 right-0 bg-stone-900/60 py-px text-center font-mono text-[9.5px] tabular-nums text-white">{fmtSize(img.size)}</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((_, x) => x !== i))}
                    className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-stone-900/80 text-[11px] text-white group-hover:flex"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-20 w-20 items-center justify-center rounded-md border border-dashed border-emerald-300 text-emerald-600 transition-colors duration-150 hover:border-emerald-500 hover:text-emerald-700"
              >
                <span className="text-[11px]">+ 照片</span>
              </button>
            </div>
          </Field>

          <Field label="设计要求" required>
            <textarea
              className={cn(inputCls, 'min-h-[110px] resize-y')}
              placeholder="例如：咬合关系、颜色、边缘线位置、邻接要求……"
              value={requirement}
              onChange={(e) => setRequirement(e.target.value)}
            />
          </Field>

          <div className="flex items-center gap-4 border-t border-stone-200 pt-5">
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogTrigger asChild>
                <button className={btnPrimary} disabled={!canSubmit || submitting} aria-label="提交订单，将消耗相应积分">
                  {submitting ? '提交中...' : `提交订单${quantityText}`}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认提交订单</AlertDialogTitle>
                  <AlertDialogDescription>
                    将消耗 <strong>{cost}</strong> 积分（当前余额：<strong>{client.points}</strong>），提交后自动进入接单大厅。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={doSubmit}>确认提交</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            {error
              ? <span className="text-[14px] font-medium text-red-600">{error}</span>
              : !canSubmit && <span className="text-[13.5px] text-stone-400">牙位/颗数、扫描文件、照片（至少 1 张）、设计要求均为必填</span>}
          </div>
        </div>

        <aside className="h-fit rounded-md border border-stone-200 bg-white p-5 lg:sticky lg:top-6">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-stone-400">订单摘要</div>
          <dl className="mt-4 space-y-3 text-[14.5px]">
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500">类型</dt>
              <dd className="text-right font-medium text-stone-800">
                {DESIGN_TYPES[type].label}
                {(urgent && DESIGN_TYPES[type].urgentAllowed) || type === 'jike' ? ' · 加急件' : ''}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500">{isMalong ? '桥架范围' : '牙位'}</dt>
              <dd className="text-right">
                {isMalong
                  ? <span className="font-medium text-stone-800">{ARCH_LABELS[arch]}</span>
                  : useCustom
                    ? (countNum > 0 ? <span className="font-medium text-stone-800">自定义 {countNum} 颗</span> : <span className="text-stone-400">未填写</span>)
                    : teeth.length ? <TeethInline teeth={teeth} /> : <span className="text-stone-400">未选择</span>}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500">患者</dt>
              <dd className="text-right font-medium text-stone-800">{patient.trim() || <span className="font-normal text-stone-400">未填写</span>}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500">扫描文件</dt>
              <dd className="font-mono tabular-nums text-stone-800">{scanFiles.length} 个</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500">照片</dt>
              <dd className="font-mono tabular-nums text-stone-800">{images.length} 张</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500">设计要求</dt>
              <dd className="font-mono tabular-nums text-stone-800">{requirement.trim() ? `${requirement.trim().length} 字` : '未填写'}</dd>
            </div>
          </dl>
          <p className="mt-5 border-t border-stone-200 pt-4 text-[13px] leading-relaxed text-stone-400">
            提交后订单进入接单大厅，由设计师远程接单设计；完成后可在订单中下载设计文件，如需调整可申请返工。
          </p>
        </aside>
      </div>
    </section>
  )
}

/* ---------------- 退回订单的修改与重新提交 ---------------- */

function ResubmitEditor({ order: o }: { order: Order }) {
  const [open, setOpen] = useState(false)
  const [teeth, setTeeth] = useState<ToothCode[]>(o.teeth)
  const [count, setCount] = useState(String(o.customCount ?? ''))
  const [requirement, setRequirement] = useState(o.requirement)
  const countNum = parseInt(count, 10) || 0

  if (!open) {
    return (
      <button className={cn(btnPrimary, 'mt-3')} onClick={() => setOpen(true)}>
        修改后重新提交
      </button>
    )
  }

  const editable = o.custom && o.type !== 'malong'
    ? countNum > 0
    : o.type === 'malong'
      ? true
      : teeth.length > 0

  return (
    <div className="mt-3 space-y-4 border border-stone-200 bg-white p-4">
      {o.type === 'malong' ? (
        <p className="text-[14px] text-stone-500">马龙桥订单按件收费，颗数不影响积分，只需补充修改设计要求。</p>
      ) : o.custom ? (
        <Field label="颗数（可修改，多退少补）">
          <input
            className={cn(inputCls, 'w-40')}
            type="number"
            min={1}
            value={count}
            onChange={(e) => setCount(e.target.value.replace(/\D/g, ''))}
            aria-label="修改自定义颗数"
          />
        </Field>
      ) : (
        <Field label="牙位（可重新点选）">
          <ToothChart
            selected={teeth}
            onToggle={(t) => setTeeth((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))}
          />
        </Field>
      )}
      <Field label="设计要求（请按退回原因补充修改）" required>
        <textarea
          className={cn(inputCls, 'min-h-[90px] resize-y')}
          value={requirement}
          onChange={(e) => setRequirement(e.target.value)}
        />
      </Field>
      <div className="flex items-center gap-3">
        <button
          className={btnPrimary}
          disabled={!editable || !requirement.trim()}
          onClick={() => resubmitOrder(o.id, { teeth, customCount: o.custom && o.type !== 'malong' ? countNum : undefined, requirement: requirement.trim() })}
        >
          重新提交
        </button>
        <button className={btnGhost} onClick={() => setOpen(false)}>取消</button>
      </div>
    </div>
  )
}



/* ---------------- AI 设计（占位） ---------------- */

function AIDesign() {
  return (
    <section className="mx-auto max-w-xl border border-dashed border-stone-300 bg-white px-8 py-20 text-center">
      <div className="text-[40px]">🤖</div>
      <h2 className="mt-4 text-[22px] font-semibold text-stone-700">AI 设计</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-stone-400">功能正在开发中，敬请期待。</p>
    </section>
  )
}

/* ---------------- 用户服务（退回 + 返工） ---------------- */

function UserService({ orders, reworks }: { orders: any[]; reworks: any[]; client?: any }) {
  const returned = orders.filter((o: any) => o.status === 'returned')
  return (
    <section>
      <SectionHead index="02" title="用户服务" desc="退回订单与返工申请进度" />
      {returned.length === 0 && reworks.length === 0 && <EmptyState title="暂无退回或返工记录" hint="订单被退回或申请返工后会显示在这里" />}
      {returned.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 font-mono text-[12px] uppercase tracking-[0.16em] text-stone-400">退回订单</h3>
          <ul className="divide-y divide-stone-300 border-y border-stone-300">
            {returned.map((o: any) => (
              <li key={o.id} className="py-3">
                <span className="font-mono text-[14px] text-stone-500">{o.no}</span>
                <p className="mt-1 text-[14px] text-red-600">{o.returnReason ?? '信息不全或数据有问题'}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {reworks.length > 0 && (
        <div>
          <h3 className="mb-3 font-mono text-[12px] uppercase tracking-[0.16em] text-stone-400">返工申请</h3>
          <ul className="divide-y divide-stone-300 border-y border-stone-300">
            {reworks.map((rw: any) => (
              <ReworkRow key={rw.id} rw={rw} order={orders.find((x: any) => x.id === rw.orderId)} />
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

/* ---------------- 返工申请行（审核前可修改/撤销） ---------------- */

function ReworkRow({ rw, order: o }: { rw: any; order: any }) {
  const [editing, setEditing] = useState(false)
  const [reason, setReason] = useState(rw.reason)
  const [images, setImages] = useState<any[]>(rw.images)
  const fileRef = useRef<HTMLInputElement>(null)

  const statusLabel = rw.status === 'pending' ? '审核中' : rw.status === 'approved' ? '已通过（积分已退）' : '未通过'
  const statusColor = rw.status === 'pending' ? 'text-amber-600' : rw.status === 'approved' ? 'text-emerald-600' : 'text-red-600'

  return (
    <li className="py-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[14px] text-stone-500">{o?.no ?? rw.orderId}</span>
        <span className={cn('rounded-full px-2 py-px text-[12px] font-medium', statusColor, rw.status === 'pending' ? 'bg-amber-50' : rw.status === 'approved' ? 'bg-emerald-50' : 'bg-red-50')}>{statusLabel}</span>
      </div>
      {editing ? (
        <div className="mt-2 space-y-3 border border-amber-200 bg-amber-50 p-4">
          <textarea className={cn(inputCls, 'min-h-[70px] resize-y')} placeholder="返工原因（必填）" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-[13px] text-stone-600 hover:border-stone-500" onClick={() => fileRef.current?.click()}>+ 重新上传照片（替换原照片）</button>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={async (e) => { if (e.target.files) { const imgs: any[] = []; for (const f of Array.from(e.target.files).slice(0, 5)) { imgs.push(await readOrderFile(f)) } setImages(imgs) } }} />
            {images.map((img: any, i: number) => <span key={i} className="font-mono text-[12px] text-stone-500">{img.name}</span>)}
          </div>
          <div className="flex gap-2">
            <button className={btnPrimary} disabled={!reason.trim()} onClick={() => { updateReworkRequest(rw.id, reason, images); setEditing(false) }}>保存修改</button>
            <button className={btnGhost} onClick={() => { setEditing(false); setReason(rw.reason); setImages(rw.images) }}>取消</button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-1 text-[14px] font-medium text-red-600">返工原因：{rw.reason}</p>
          {rw.images.length > 0 && (
            <div className="mt-2 flex gap-2">
              {rw.images.map((img: any, i: number) => (
                <ImageThumb key={i} img={img} />
              ))}
            </div>
          )}
          {rw.status === 'pending' && (
            <div className="mt-2 flex gap-2">
              <button type="button" className="rounded-full border border-stone-300 bg-white px-3 py-1 text-[12.5px] text-stone-600 transition-colors hover:border-stone-500" onClick={() => setEditing(true)}>修改申请</button>
              <button type="button" className="rounded-full border border-red-300 bg-white px-3 py-1 text-[12.5px] text-red-600 transition-colors hover:bg-red-50" onClick={() => { if (window.confirm('确认撤销返工申请？订单将恢复为已完成状态。')) cancelReworkRequest(rw.id) }}>撤销申请</button>
            </div>
          )}
        </>
      )}
    </li>
  )
}

/* ---------------- 我的订单 ---------------- */

function OrderList({ orders, clientId }: { orders: Order[]; clientId: string }) {
  const db = useDB()
  const [query, setQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [reworkFor, setReworkFor] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [reworkImages, setReworkImages] = useState<any[]>([])
  const reworkFileRef = useRef<HTMLInputElement>(null)
  const [sort, setSort] = useState<OrderSort>('new')
  const [openId, setOpenId] = useState<string | null>(null)

  const shown = useMemo(
    () => sortOrders((query || dateFrom || dateTo
      ? searchOrders(db, 'client', clientId, query || undefined, dateFrom || undefined, dateTo || undefined)
      : orders), sort),
    [db, orders, clientId, query, dateFrom, dateTo, sort],
  )

  if (orders.length === 0) return <EmptyState title="还没有订单" hint="点击上方「设计师设计」开始第一单" />

  return (
    <section>
      <SectionHead index="02" title="我的订单" desc="完成后可下载设计文件，如需调整可申请返工" />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input className={cn(inputCls, 'w-52 py-1.5 text-[14px]')} placeholder="按单号 / 患者姓名搜索" value={query} onChange={(e) => setQuery(e.target.value)} />
        <input type="date" aria-label="开始日期" className={cn(inputCls, 'w-40 py-1.5 text-[14px]')} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <span className="text-[13px] text-stone-400">至</span>
        <input type="date" aria-label="结束日期" className={cn(inputCls, 'w-40 py-1.5 text-[14px]')} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <SortBar sort={sort} onChange={setSort} />
        {(query || dateFrom || dateTo) && (
          <button type="button" className="text-[13px] text-stone-400 hover:text-stone-700" onClick={() => { setQuery(''); setDateFrom(''); setDateTo('') }}>清除筛选</button>
        )}
      </div>
      {shown.length === 0 && <EmptyState title="没有符合条件的订单" hint="换个单号或日期范围试试" />}
      <ul className="space-y-[18px]">
        {shown.map((o) => {
          const designer = db.designers.find((d) => d.id === o.designerId)
          const open = openId === o.id
          return (
            <li key={o.id} className={cn('rounded-md border bg-white transition-colors duration-150', o.status === 'rework' || o.status === 'returned' ? 'border-red-300' : 'border-stone-300')}>
              {/* 长条主体：点击任意处展开/收起详情 */}
              <div className="flex h-[120px] cursor-pointer items-center gap-4 px-4" onClick={() => setOpenId(open ? null : o.id)} title={open ? '点击收起详情' : '点击展开详情'}>
                <div className="w-[132px] shrink-0">
                  <div className="font-mono text-[13px] tabular-nums text-stone-600">{o.no}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {o.isRework && (
                      <span className="rounded-full bg-stone-100 px-2 py-px font-mono text-[11.5px] text-stone-500 ring-1 ring-inset ring-stone-200">返工 ×{o.reworkCount}</span>
                    )}
                    {(o.urgent || o.type === 'jike') && (
                      <span className="rounded-full bg-red-600 px-2 py-px text-[12px] font-semibold text-white">加急件</span>
                    )}
                  </div>
                </div>
                <div className="w-[110px] shrink-0">
                  <div className="text-[15px] font-medium text-stone-800">{DESIGN_TYPES[o.type].label}</div>
                  <div className="mt-1.5 font-mono text-[12px] tabular-nums text-stone-500">{orderCount(o)} {o.type === 'malong' ? '件' : '颗'}</div>
                </div>
                <div className="w-[280px] shrink-0">
                  {o.teeth.length > 0 ? (
                    <ToothChartMini selected={o.teeth} />
                  ) : (
                    <span className="inline-block rounded border border-stone-200 bg-stone-100 px-2.5 py-1 text-[12.5px] text-stone-600">
                      {o.type === 'malong' ? `范围：${o.arch ? ARCH_LABELS[o.arch] : '全口'} · 按件` : `自定义 ${o.customCount ?? 0} 颗`}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[13.5px] leading-relaxed text-stone-700">{o.requirement}</p>
                  <div className="mt-1.5 flex items-center gap-4 font-mono text-[12px] tabular-nums text-stone-400">
                    {o.patient && <span className="font-medium text-stone-600">患者 {o.patient}</span>}
                    <span>设计师 {designerAlias(designer)}</span>
                    <span className="font-semibold text-stone-600">积分 {o.points}</span>
                    <span>{fmtTime(o.createdAt)}</span>
                  </div>
                </div>
                <div className="flex w-[120px] shrink-0 flex-col items-end gap-2">
                  <StatusPill status={o.status} />
                  {(o.status === 'pending' || o.status === 'unassigned') && (
                    <span onClick={(e) => e.stopPropagation()}>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button className="rounded-full border border-stone-300 bg-white px-3 py-1 text-[12.5px] text-stone-500 transition-colors hover:border-red-300 hover:text-red-600">
                            撤回订单
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>撤回订单 {o.no}？</AlertDialogTitle>
                            <AlertDialogDescription>
                              撤回后预扣的 {o.points} 积分将全额退回，订单立即从接单大厅消失。设计师接单后将无法撤回。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>再想想</AlertDialogCancel>
                            <AlertDialogAction onClick={() => cancelOrder(o.id, clientId)}>确认撤回</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </span>
                  )}
                </div>
              </div>

              {/* 展开的详情区 */}
              {open && (
                <div className="border-t border-dashed border-stone-300 bg-stone-50/50 px-4 py-3.5">
                  {o.patient && (() => {
                    const siblings = orders.filter((x) => x.patient === o.patient && x.id !== o.id)
                    if (siblings.length === 0) return null
                    return (
                      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-stone-400">
                        <span>该患者的历史订单：</span>
                        {siblings.map((x) => (
                          <span key={x.id} className="inline-flex items-center gap-1.5">
                            <span className="font-mono tabular-nums">{x.no}</span>
                            <StatusPill status={x.status} />
                          </span>
                        ))}
                      </div>
                    )
                  })()}

                  <p className="max-w-3xl text-[14px] leading-relaxed text-stone-600">{o.requirement}</p>

                  <div className="mt-3">
                    <OrderTimeline order={o} />
                  </div>

                  {o.status === 'rework' && o.reworkReason && (
                    <p className="mt-2 border-l-2 border-red-400 pl-3 text-[14px] text-red-600">返工要求：{o.reworkReason}</p>
                  )}

                  {o.status === 'returned' && (
                    <div className="mt-3">
                      <p className="border-l-2 border-red-400 pl-3 text-[14px] text-red-600">
                        设计师退回：{o.returnReason ?? '信息不全或数据有问题'}
                      </p>
                      <ResubmitEditor order={o} />
                    </div>
                  )}

                  {o.images.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {o.images.map((img, i) => <ImageThumb key={i} img={img} />)}
                    </div>
                  )}

                  {o.status === 'completed' && (
                    <div className="mt-3 space-y-2">
                      {o.designFiles.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone-400">设计文件</span>
                          {o.designFiles.map((f, i) => <FileChip key={i} file={f} />)}
                          <button type="button" className="rounded-full border border-stone-300 bg-white px-3 py-1 text-[12.5px] text-stone-600 hover:border-stone-500" onClick={() => o.designFiles.filter((f:any)=>f.dataUrl).forEach((f:any)=>{const a=document.createElement('a');a.href=f.dataUrl;a.download=f.name;a.click()})}>批量下载文件</button>
                        </div>
                      )}
                      {o.images.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone-400">照片</span>
                          <button type="button" className="rounded-full border border-stone-300 bg-white px-3 py-1 text-[12.5px] text-stone-600 hover:border-stone-500" onClick={() => o.images.filter((img:any)=>img.dataUrl).forEach((img:any)=>{const a=document.createElement('a');a.href=img.dataUrl;a.download=img.name;a.click()})}>批量下载照片</button>
                        </div>
                      )}
                      {reworkFor === o.id ? (
                        <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-4">
                          <p className="text-[14px] font-medium text-amber-800">申请返工 — 请说明需要调整的地方并上传相关照片</p>
                          <textarea className={cn(inputCls, 'min-h-[80px] resize-y')} placeholder="返工原因（必填）" value={reason} onChange={(e) => setReason(e.target.value)} />
                          <div className="flex items-center gap-2">
                            <button type="button" className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-[13px] text-stone-600 hover:border-stone-500" onClick={() => reworkFileRef.current?.click()}>+ 上传照片</button>
                            <input ref={reworkFileRef} type="file" accept="image/*" multiple className="hidden" onChange={async (e) => { if(e.target.files){ const imgs: any[] = []; for(const f of Array.from(e.target.files).slice(0,5)){ imgs.push(await readOrderFile(f)) } setReworkImages(imgs) }}} />
                            {reworkImages.map((img: any, i: number) => <span key={i} className="font-mono text-[12px] text-stone-500">{img.name}</span>)}
                          </div>
                          <div className="flex gap-2">
                            <button className={btnPrimary} disabled={!reason.trim()} onClick={() => { createReworkRequest(o.id, reason.trim(), reworkImages); setReworkFor(null); setReason(''); setReworkImages([]) }}>提交返工申请</button>
                            <button className={btnGhost} onClick={() => { setReworkFor(null); setReason(''); setReworkImages([]) }}>取消</button>
                          </div>
                        </div>
                      ) : (
                        <button className={btnGhost} onClick={() => setReworkFor(o.id)}>申请返工</button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
