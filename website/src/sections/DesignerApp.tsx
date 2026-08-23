import { useMemo, useRef, useState } from 'react'
import type { Designer, Order, OrderFile } from '@/types'
import { acceptOrderAsync, designerAlias, filterPoolOrders, getDesignParam, groupOf, matchedClientGroupIds, orderCount, orderStats, readOrderFile, returnOrder, submitDesign, useDB } from '@/lib/store'
import { toast } from 'sonner'
import { ToothChartMini } from '@/components/ToothChart'
import { EmptyState, FileChip, ImageThumb, SectionHead, StatusPill, btnGhost, btnPrimary, inputCls } from '@/components/bits'
import { ARCH_LABELS, DESIGN_TYPES } from '@/types'
import { cn } from '@/lib/utils'

/** 一键下载订单的全部扫描文件与照片（仅演示版已保存内容的文件可下） */
function downloadAll(files: { name: string; dataUrl?: string; url?: string }[], images: { name: string; dataUrl?: string; url?: string }[]) {
  const items = [...files, ...images].filter((f) => f.dataUrl || f.url)
  items.forEach((f, i) =>
    setTimeout(() => {
      const a = document.createElement('a')
      if (f.url) { a.href = f.url; a.target = '_blank'; a.rel = 'noreferrer' }
      else if (f.dataUrl) { a.href = f.dataUrl; a.download = f.name }
      a.click()
    }, i * 150),
  )
  return items.length
}

const fmtTime = (iso: string) => {
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function DesignerApp({ designer }: { designer: Designer }) {
  const db = useDB()
  const [tab, setTab] = useState<'pool' | 'mine'>('pool')
  const group = groupOf(db, designer.groupId)
  const isLeader = group?.leaderId === designer.id

  const pool = useMemo(
    () => filterPoolOrders(db, designer.id),
    [db, designer.id],
  )
  const mine = useMemo(
    () => db.orders.filter((o) => o.designerId === designer.id && (o.status === 'designing' || o.status === 'completed' || o.status === 'rework')),
    [db, designer.id],
  )
  const doing = mine.filter((o) => o.status === 'designing' || o.status === 'rework')
  const myStats = useMemo(() => orderStats(db, 'designer', designer.id), [db, designer.id])

  return (
    <div className="mx-auto max-w-5xl px-5 pb-20 pt-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-stone-300 pb-5">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-stone-400">设计师端</div>
          <h1 className="mt-1 flex items-center gap-3 font-display text-[28px] font-semibold tracking-tight text-brand">
            {designerAlias(designer)}
            <span className="rounded-full border border-stone-200 bg-white px-2.5 py-0.5 font-mono text-[12px] font-normal text-stone-500">
              {group?.name ?? '未分组'}{isLeader ? ' · 组长' : ''}
            </span>
          </h1>
          <p className="mt-0.5 text-[13.5px] text-stone-500">
            远程接单设计 · 订单仅显示单号与牙位要求，不显示派单来源
          </p>
        </div>
        <nav className="flex flex-wrap gap-2 border-b-2 border-[#ddd6c6]">
          {([
            ['pool', `接单大厅 ${pool.length}`],
            ['mine', doing.length > 0 ? `我的订单 · ${doing.length} 进行中` : '我的订单'],
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
      </header>

      {/* 订单概览统计 */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-md border border-stone-300 bg-white p-4"><div className="text-[11px] uppercase tracking-wider text-stone-400">累计接单</div><div className="mt-1 font-mono text-[24px] tabular-nums text-stone-900">{myStats.total}</div></div>
        <div className="rounded-md border border-stone-300 bg-white p-4"><div className="text-[11px] uppercase tracking-wider text-stone-400">本月接单</div><div className="mt-1 font-mono text-[24px] tabular-nums text-stone-900">{myStats.monthly}</div></div>
        <div className="rounded-md border border-stone-300 bg-white p-4"><div className="text-[11px] uppercase tracking-wider text-stone-400">已完成</div><div className="mt-1 font-mono text-[24px] tabular-nums text-emerald-600">{myStats.completed}</div></div>
        <div className="rounded-md border border-stone-300 bg-white p-4"><div className="text-[11px] uppercase tracking-wider text-stone-400">返工</div><div className="mt-1 font-mono text-[24px] tabular-nums text-amber-600">{myStats.reworked}</div></div>
      </div>

      {tab === 'pool' && (
        <section>
          <SectionHead index="01" title="接单大厅" desc="查看牙位、设计要求、扫描文件与照片后接单；接单后如信息不全或数据有问题，可在「我的订单」中退回给客户" />
          {doing.length > 0 && (
            <div className="mb-4 border border-blue-200 bg-blue-50 px-4 py-2.5 text-[13.5px] text-blue-800">
              你手上有 {doing.length} 单进行中，接单成功后会自动跳转到「我的订单」
            </div>
          )}
          {pool.length === 0 ? (
            <>{pool.length === 0 && matchedClientGroupIds(db, designer.groupId).length === 0
    ? <EmptyState title="暂无待接订单" hint="你所在的设计师组尚未匹配任何客户分组，请联系管理端配置" />
    : <EmptyState title="暂无待接订单" hint="匹配客户组的订单提交后会出现在这里" />}</>
          ) : (
            <ul className="space-y-[18px]">
              {pool.map((o) => <PoolCard key={o.id} order={o} designerId={designer.id} onAccepted={() => setTab('mine')} />)}
            </ul>
          )}
        </section>
      )}

      {tab === 'mine' && (
        <section>
          <SectionHead index="02" title="我的订单" desc="完成设计后提交设计文件，客户会收到完成提醒" />
          {mine.length === 0 ? (
            <EmptyState title="还没有接单" hint="到接单大厅挑选订单" />
          ) : (
            <ul className="space-y-[18px]">
              {mine.map((o) => <MineRow key={o.id} order={o} />)}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

/* ---------------- 退回按钮（信息不全 / 数据有问题，退回医院/加工厂） ---------------- */

function ReturnControl({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')

  if (!open) {
    return (
      <button
        className="inline-flex items-center justify-center gap-2 rounded-full border border-red-300 bg-white px-4 py-2 text-[14px] font-medium text-red-600 transition-colors duration-150 hover:border-red-500 hover:bg-red-50 active:scale-[0.98]"
        aria-label="退回订单：信息不全或数据有问题"
        onClick={() => setOpen(true)}
      >
        退回
      </button>
    )
  }
  return (
    <span className="flex w-full flex-wrap items-center gap-2 border-t border-red-100 pt-3">
      <input
        className={cn(inputCls, 'min-w-[220px] flex-1 py-1.5 text-[14px]')}
        placeholder="退回原因：信息不全 / 数据有问题，请说明缺什么"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <button
        className={btnPrimary}
        disabled={!reason.trim()}
        onClick={() => returnOrder(orderId, reason.trim())}
      >
        确认退回
      </button>
      <button className={btnGhost} onClick={() => { setOpen(false); setReason('') }}>取消</button>
    </span>
  )
}

/* ---------------- 接单大厅卡片 ---------------- */

function PoolCard({ order: o, designerId, onAccepted }: { order: Order; designerId: string; onAccepted: () => void }) {
  const db = useDB()
  const dp = getDesignParam(db, o.clientId)
  const [accepting, setAccepting] = useState(false)
  const [open, setOpen] = useState(false)
  const grab = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (accepting) return
    setAccepting(true)
    try {
      const r = await acceptOrderAsync(o.id, designerId)
      if (r.ok) onAccepted()
      else if (r.error) toast.error(r.error)
    } finally {
      setAccepting(false)
    }
  }
  return (
    <li className={cn('rounded-md border bg-white transition-colors duration-150', o.isRework ? 'border-red-300' : 'border-stone-300')}>
      {/* 长条主体：点击任意处展开/收起详情 */}
      <div className="flex h-[120px] cursor-pointer items-center gap-4 px-4" onClick={() => setOpen(!open)} title={open ? '点击收起详情' : '点击展开扫描文件与照片'}>
        <div className="w-[132px] shrink-0">
          <div className="font-mono text-[13px] tabular-nums text-stone-600">{o.no}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {o.isRework && (
              <span className="rounded-full bg-red-50 px-2 py-px text-[12px] font-medium text-red-600 ring-1 ring-inset ring-red-200">返工</span>
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
          {dp && (
            <div className="mt-1.5 inline-block rounded bg-brand-soft px-2 py-0.5 text-[12px] font-medium text-brand">
              设计参数 · 内冠 {dp.innerCrown} / 咬合 {dp.occlusalCut} / 邻接 {dp.proximalCut}
            </div>
          )}
          <div className="mt-1.5 flex items-center gap-4 font-mono text-[12px] tabular-nums text-stone-400">
            {o.patient && <span className="font-medium text-stone-600">患者 {o.patient}</span>}
            <span>扫描 {o.scanFiles.length}</span>
            <span>照片 {o.images.length}</span>
            <span>{fmtTime(o.createdAt)}</span>
          </div>
        </div>
        <div className="w-[100px] shrink-0 text-right">
          <button
            className="h-10 w-24 rounded bg-brand text-[14.5px] font-medium tracking-[0.04em] text-stone-50 transition-all duration-150 hover:bg-brand-light active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
            disabled={accepting}
            aria-label={`接取订单 ${o.no}`}
            onClick={grab}
          >
            {accepting ? '接单中…' : '接单'}
          </button>
        </div>
      </div>

      {/* 展开的详情区：完整要求 / 返工信息 / 扫描文件 / 照片 / 全部下载 */}
      {open && (
        <div className="border-t border-dashed border-stone-300 bg-stone-50/50 px-4 py-3.5">
          <p className="max-w-3xl text-[14px] leading-relaxed text-stone-600">{o.requirement}</p>
          {o.isRework && o.reworkReason && (
            <div className="mt-2">
              <p className="border-l-2 border-red-400 pl-2.5 text-[13.5px] text-red-600">返工要求：{o.reworkReason}</p>
              {(() => {
                const rw = db.reworks.find((r) => r.orderId === o.id)
                if (!rw || rw.images.length === 0) return null
                return (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {rw.images.map((img, i) => <ImageThumb key={i} img={img} />)}
                  </div>
                )
              })()}
            </div>
          )}
          <div className="mt-3">
            <div className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-stone-400">扫描文件（点击下载）</div>
            <div className="flex flex-wrap gap-2">
              {o.scanFiles.map((f, i) => <FileChip key={i} file={f} tone="stone" />)}
            </div>
          </div>
          {o.images.length > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-stone-400">照片（点击放大 / 下载）</div>
              <div className="flex flex-wrap gap-2">
                {o.images.map((img, i) => <ImageThumb key={i} img={img} />)}
              </div>
            </div>
          )}
          <div className="mt-3">
            <button
              type="button"
              className="rounded-full border border-brand px-3.5 py-1 text-[12.5px] font-medium text-brand transition-colors hover:bg-brand hover:text-stone-50 disabled:pointer-events-none disabled:opacity-40"
              disabled={![...o.scanFiles, ...o.images].some((f) => f.dataUrl || f.url)}
              title={[...o.scanFiles, ...o.images].some((f) => f.dataUrl || f.url) ? '依次下载全部扫描文件与照片' : '演示订单未保存文件内容，真实上传的文件可一键下载'}
              onClick={(e) => { e.stopPropagation(); downloadAll(o.scanFiles, o.images) }}
            >
              ↓ 全部下载（文件 {o.scanFiles.length} + 照片 {o.images.length}）
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

/* ---------------- 我的订单行 ---------------- */

function MineRow({ order: o }: { order: Order }) {
  const db = useDB()
  const [files, setFiles] = useState<OrderFile[]>([])
  const [picking, setPicking] = useState(false)
  const [open, setOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const pick = async (list: FileList | null) => {
    if (!list) return
    const picked = await Promise.all(Array.from(list).map(readOrderFile))
    setFiles((prev) => [...prev, ...picked].slice(0, 6))
  }
  const startPicking = (e: React.MouseEvent) => {
    e.stopPropagation()
    setOpen(true)
    setPicking(true)
  }

  return (
    <li className={cn('rounded-md border bg-white transition-colors duration-150', o.status === 'rework' ? 'border-red-300' : 'border-stone-300')}>
      {/* 长条主体：点击任意处展开/收起详情 */}
      <div className="flex h-[120px] cursor-pointer items-center gap-4 px-4" onClick={() => setOpen(!open)} title={open ? '点击收起详情' : '点击展开扫描文件与照片'}>
        <div className="w-[132px] shrink-0">
          <div className="font-mono text-[13px] tabular-nums text-stone-600">{o.no}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {o.isRework && (
              <span className="rounded-full bg-red-50 px-2 py-px text-[12px] font-medium text-red-600 ring-1 ring-inset ring-red-200">返工</span>
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
            <span>接单于 {o.acceptedAt ? fmtTime(o.acceptedAt) : '—'}</span>
            <span>扫描 {o.scanFiles.length}</span>
            <span>照片 {o.images.length}</span>
          </div>
        </div>
        <div className="flex w-[120px] shrink-0 flex-col items-end gap-2">
          <StatusPill status={o.status} />
          {o.status !== 'completed' && (
            <button
              className="h-9 rounded bg-brand px-4 text-[13.5px] font-medium text-stone-50 transition-all duration-150 hover:bg-brand-light active:scale-[0.98]"
              onClick={startPicking}
            >
              完成订单
            </button>
          )}
        </div>
      </div>

      {/* 展开的详情区 */}
      {open && (
        <div className="border-t border-dashed border-stone-300 bg-stone-50/50 px-4 py-3.5">
          <p className="max-w-3xl text-[14px] leading-relaxed text-stone-600">{o.requirement}</p>
          {o.isRework && o.reworkReason && (
            <div className="mt-2">
              <p className="border-l-2 border-red-400 pl-3 text-[14px] text-red-600">返工要求：{o.reworkReason}</p>
              {(() => {
                const rw = db.reworks.find((r) => r.orderId === o.id)
                if (!rw || rw.images.length === 0) return null
                return (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {rw.images.map((img, i) => <ImageThumb key={i} img={img} />)}
                  </div>
                )
              })()}
            </div>
          )}

          <div className="mt-3">
            <div className="mb-1.5 flex flex-wrap items-center gap-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-stone-400">扫描文件（点击下载）</span>
              <button
                type="button"
                className="rounded-full border border-brand px-3 py-0.5 text-[12px] font-medium text-brand transition-colors hover:bg-brand hover:text-stone-50 disabled:pointer-events-none disabled:opacity-40"
                disabled={![...o.scanFiles, ...o.images].some((f) => f.dataUrl || f.url)}
                title={[...o.scanFiles, ...o.images].some((f) => f.dataUrl || f.url) ? '依次下载全部扫描文件与照片' : '演示订单未保存文件内容，真实上传的文件可一键下载'}
                onClick={() => downloadAll(o.scanFiles, o.images)}
              >
                ↓ 全部下载（文件 {o.scanFiles.length} + 照片 {o.images.length}）
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {o.scanFiles.map((f, i) => <FileChip key={i} file={f} tone="stone" />)}
            </div>
          </div>

          {o.images.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {o.images.map((img, i) => <ImageThumb key={i} img={img} />)}
            </div>
          )}

          {o.status !== 'completed' && (
            <div className="mt-3 border-t border-stone-200 pt-3">
              {picking ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => void pick(e.target.files)} />
                  <button className={btnGhost} onClick={() => fileRef.current?.click()}>选择设计文件</button>
                  {files.map((f, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 font-mono text-[12.5px] text-stone-600">
                      {f.name}
                      <button className="text-stone-400 hover:text-stone-700" onClick={() => setFiles((prev) => prev.filter((_, x) => x !== i))}>×</button>
                    </span>
                  ))}
                  <button
                    className={btnPrimary}
                    disabled={files.length === 0}
                    aria-label={`提交订单 ${o.no} 的设计文件并完成订单`}
                    onClick={() => { submitDesign(o.id, files); }}
                  >
                    提交设计文件 · 完成订单
                  </button>
                  <button className={btnGhost} onClick={() => { setPicking(false); setFiles([]) }}>取消</button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button className={btnGhost} onClick={() => setPicking(true)}>上传设计文件</button>
                  <button className={btnPrimary} onClick={() => setPicking(true)}>完成订单</button>
                  <ReturnControl orderId={o.id} />
                </div>
              )}
            </div>
          )}

          {o.status === 'completed' && o.designFiles.length > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-stone-400">已提交的设计文件</div>
              <div className="flex flex-wrap gap-2">
                {o.designFiles.map((f, i) => <FileChip key={i} file={f} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  )
}
