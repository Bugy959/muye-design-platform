import { Fragment, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { Account, Client, Order } from '@/types'
import { addAssignment, adjustPoints, approveRework, createAccountAsync, createClientGroup, createClientGroupAsync, deleteAccount, deleteClientGroup, designerAlias, dispatchUnassignedOrderAsync, getDesignParam, isValidIdCard, isValidPhone, matchedDesignerGroupIds, monthOf, moveDesigner, orderStats, registerDesignerGroupAsync, rejectRework, removeAssignment, renameClientGroup, renameGroup, resetPassword, saveDesignParam, searchOrders, setGroupLeader, updateGroupNote, useDB, usernameTaken } from '@/lib/store'
import { EmptyState, Field, FileChip, ImageThumb, OrderScope, SectionHead, SortBar, Stat, StatusPill, TypeTag, btnGhost, btnPrimary, inputCls } from '@/components/bits'
import { sortOrders } from '@/lib/order-utils'
import { useNow } from '@/lib/use-now'
import type { OrderSort } from '@/lib/order-utils'
import { ARCH_LABELS, DESIGN_TYPES, ORDER_STATUS } from '@/types'
import { cn } from '@/lib/utils'

type Tab = 'accounts' | 'orders' | 'points' | 'bills' | 'groups' | 'matching' | 'rework' | 'overview'

export function AdminApp() {
  const db = useDB()
  const [tab, setTab] = useState<Tab>('accounts')
  const [orderJump, setOrderJump] = useState<{ status?: string; stale?: boolean; isRework?: boolean } | null>(null)

  return (
    <div className="mx-auto max-w-6xl px-5 pb-20 pt-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-stone-300 pb-5">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-stone-400">管理端</div>
          <h1 className="mt-1 font-display text-[28px] font-semibold tracking-tight text-brand">木叶义齿 · 管理后台</h1>
          <p className="mt-0.5 text-[13.5px] text-stone-500">账号管理 · 积分管理 · 月度账单 · 设计师分组 · 订单总览</p>
        </div>
        <nav className="flex flex-wrap gap-2 border-b-2 border-[#ddd6c6]">
          {([
            ['accounts', `账号管理 ${db.accounts.length}`],
            ['bills', '账单中心'],
            ['points', '积分管理'],
            ['groups', '设计师分组'],
            ['overview', '订单概览'],
            ['matching', '分组匹配'],
            ['rework', '返工审核'],
            ['orders', `订单总览 ${db.orders.length}`],
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

      {tab === 'accounts' && <Accounts />}
      {tab === 'orders' && <Orders jump={orderJump} />}
      {tab === 'points' && <Points />}
      {tab === 'bills' && <Bills />}
      {tab === 'groups' && <Groups />}
      {tab === 'overview' && <Overview onJump={(j) => { setOrderJump(j); setTab('orders') }} />}
      {tab === 'matching' && <Matching />}
      {tab === 'rework' && <ReworkReview />}
    </div>
  )
}

/* ---------------- 账号管理（最高权限：建号 / 改密码 / 删号） ---------------- */

const ACC_PAGE = 15

function Accounts() {
  const db = useDB()
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')

  const nameOf = (a: (typeof db.accounts)[number]) => {
    if (a.role === 'admin') return '平台管理方'
    if (a.role === 'client') return db.clients.find((c) => c.id === a.clientId)?.name ?? '（档案已删除）'
    const d = db.designers.find((x) => x.id === a.designerId)
    return d ? `${designerAlias(d)}（${d.name}）` : '（档案已删除）'
  }

  const q = query.trim().toLowerCase()
  const match = (a: (typeof db.accounts)[number]) =>
    !q || a.username.toLowerCase().includes(q) || nameOf(a).toLowerCase().includes(q)

  const admins = db.accounts.filter((a) => a.role === 'admin' && match(a))
  const clientAccs = db.accounts.filter((a) => a.role === 'client' && match(a))
  const designerAccs = db.accounts.filter((a) => a.role === 'designer' && match(a))

  return (
    <section>
      <SectionHead
        index="01"
        title="账号管理"
        desc="所有账号由管理端统一创建与维护；医院/加工厂与设计师不可自行注册"
        right={<button className={btnPrimary} onClick={() => setCreating(!creating)}>{creating ? '收起' : '+ 创建账号'}</button>}
      />

      {creating && <CreateAccount onDone={() => setCreating(false)} />}

      {/* 管理端账号：最高权限，独立展示，不参与分类列表 */}
      {admins.length > 0 && (
        <div className="mb-8 rounded-md border border-stone-200 bg-white px-5 py-4">
          <div className="mb-3 font-mono text-[11.5px] uppercase tracking-[0.14em] text-stone-400">管理端账号</div>
          {admins.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-1.5">
              <span className="flex items-center gap-3">
                <span className="font-mono tabular-nums font-medium text-stone-800">{a.username}</span>
                <span className="rounded-full bg-brand px-2 py-px text-[11.5px] text-stone-50">最高权限</span>
                <span className="text-[13px] text-stone-400">{nameOf(a)}</span>
              </span>
              <RowOps a={a} allowDelete={false} />
            </div>
          ))}
        </div>
      )}

      {/* 搜索 */}
      <div className="mb-6 flex items-center gap-3">
        <input
          className={cn(inputCls, 'max-w-xs')}
          placeholder="搜索账号或名称…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="搜索账号"
        />
        {q && (
          <span className="text-[13px] text-stone-400">
            找到 {clientAccs.length + designerAccs.length + admins.length} 个账号
          </span>
        )}
      </div>

      <AccountTable title="医院 / 加工厂" accounts={clientAccs} nameOf={nameOf} />
      <AccountTable title="设计师" accounts={designerAccs} nameOf={nameOf} />
    </section>
  )
}

function AccountTable({ title, accounts, nameOf }: { title: string; accounts: Account[]; nameOf: (a: Account) => string }) {
  const [page, setPage] = useState(1)
  const pages = Math.max(1, Math.ceil(accounts.length / ACC_PAGE))
  const cur = Math.min(page, pages)
  const rows = accounts.slice((cur - 1) * ACC_PAGE, cur * ACC_PAGE)

  return (
    <div className="mb-8">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[11.5px] uppercase tracking-[0.14em] text-stone-400">
          {title} · {accounts.length} 个账号
        </span>
        {pages > 1 && (
          <span className="flex items-center gap-2">
            <button className={btnGhost} disabled={cur <= 1} onClick={() => setPage(cur - 1)}>上一页</button>
            <span className="font-mono text-[13px] tabular-nums text-stone-500">第 {cur} / {pages} 页</span>
            <button className={btnGhost} disabled={cur >= pages} onClick={() => setPage(cur + 1)}>下一页</button>
          </span>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="border-y border-stone-300 py-6 text-center text-[13.5px] text-stone-400">暂无账号</p>
      ) : (
        <div className="overflow-x-auto border-y border-stone-300">
          <table className="w-full min-w-[640px] text-left text-[14px]">
            <thead>
              <tr className="border-b-2 border-stone-300 font-mono text-[11.5px] uppercase tracking-[0.14em] text-stone-400">
                <th className="py-2.5 pr-4 font-medium">账号</th>
                <th className="py-2.5 pr-4 font-medium">关联档案</th>
                <th className="py-2.5 pr-4 font-medium">创建时间</th>
                <th className="py-2.5 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 [&>tr:nth-child(even)]:bg-[#faf7f1] [&>tr:hover]:bg-[#eef3f0] [&>tr]:transition-colors">
              {rows.map((a) => (
                <tr key={a.id} className="align-middle">
                  <td className="py-3 pr-4 font-mono tabular-nums font-medium text-stone-800">{a.username}</td>
                  <td className="py-3 pr-4 text-stone-700">{nameOf(a)}</td>
                  <td className="py-3 pr-4 font-mono tabular-nums text-stone-400">{new Date(a.createdAt).toLocaleDateString('zh-CN')}</td>
                  <td className="py-3"><RowOps a={a} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function RowOps({ a, allowDelete = true }: { a: Account; allowDelete?: boolean }) {
  const [editing, setEditing] = useState(false)
  const [newPw, setNewPw] = useState('')

  if (editing) {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <input
          className={cn(inputCls, 'w-36 py-1 text-[14px]')}
          placeholder="新密码"
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
        />
        <button
          className={btnPrimary}
          disabled={newPw.trim().length < 4}
          onClick={() => { resetPassword(a.id, newPw.trim()); setEditing(false); setNewPw('') }}
        >
          保存
        </button>
        <button className="text-[13px] text-stone-400 hover:text-stone-700" onClick={() => setEditing(false)}>取消</button>
      </span>
    )
  }
  return (
    <span className="flex items-center gap-3">
      <button className={btnGhost} onClick={() => { setEditing(true); setNewPw('') }}>修改密码</button>
      {allowDelete && (
        <button
          className="text-[13px] text-red-500 hover:text-red-700"
          onClick={() => { if (window.confirm(`确认删除账号 ${a.username}？（档案数据保留，仅删除登录权限）`)) deleteAccount(a.id) }}
        >
          删除
        </button>
      )}
    </span>
  )
}

function CreateAccount({ onDone }: { onDone: () => void }) {
  const db = useDB()
  const [role, setRole] = useState<'client' | 'designer'>('client')
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [clientForm, setClientForm] = useState({ name: '', phone: '', kind: 'hospital' as Client['kind'], clientGroupId: '' })
  const [showQuickCG, setShowQuickCG] = useState(false)
  const [quickCGName, setQuickCGName] = useState('')
  const [quickCGNote, setQuickCGNote] = useState('')
  const [showQuickDG, setShowQuickDG] = useState(false)
  const [quickDGName, setQuickDGName] = useState('')
  const [quickDGNote, setQuickDGNote] = useState('')
  const [designerForm, setDesignerForm] = useState({ name: '', phone: '', idCard: '', certNo: '', groupId: '' })
  const [existingId, setExistingId] = useState('')
  const [error, setError] = useState('')

  const unlinked = role === 'client'
    ? db.clients.filter((c) => !db.accounts.some((a) => a.clientId === c.id))
    : db.designers.filter((d) => !db.accounts.some((a) => a.designerId === d.id))

  const submit = async () => {
    if (!username.trim() || password.trim().length < 4) { setError('请填写账号，密码至少 4 位'); return }
    if (usernameTaken(username)) { setError('该账号名已被使用'); return }
    try {
      if (role === 'client') {
        if (mode === 'existing' && !existingId) { setError('请选择要关联的医院/加工厂'); return }
        if (mode === 'new' && (!clientForm.name.trim() || !clientForm.phone.trim())) { setError('请填写单位名称与联系电话'); return }
        if (mode === 'new' && !isValidPhone(clientForm.phone)) { setError('联系电话格式不正确，请输入 11 位手机号'); return }
        await createAccountAsync({
          username, password, role,
          clientId: mode === 'existing' ? existingId : undefined,
          newClient: mode === 'new' ? { name: clientForm.name.trim(), phone: clientForm.phone.trim(), kind: clientForm.kind, clientGroupId: clientForm.clientGroupId || undefined } : undefined,
        })
      } else {
        if (mode === 'existing' && !existingId) { setError('请选择要关联的设计师'); return }
        if (mode === 'new' && (!designerForm.name.trim() || !designerForm.phone.trim() || !designerForm.idCard.trim())) { setError('请填写姓名、电话与身份证号'); return }
        if (mode === 'new' && !isValidPhone(designerForm.phone)) { setError('电话格式不正确，请输入 11 位手机号'); return }
        if (mode === 'new' && !isValidIdCard(designerForm.idCard)) { setError('身份证号格式不正确，请输入 18 位'); return }
        await createAccountAsync({
          username, password, role,
          designerId: mode === 'existing' ? existingId : undefined,
          newDesigner: mode === 'new' ? { name: designerForm.name.trim(), phone: designerForm.phone.trim(), idCard: designerForm.idCard.trim(), certNo: designerForm.certNo.trim() || undefined, groupId: designerForm.groupId || undefined } : undefined,
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建账号失败')
      return
    }
    onDone()
  }

  const radioCls = (active: boolean) => cn(
    'rounded-full border px-4 py-1.5 text-[14px] transition-colors duration-150',
    active ? 'border-brand bg-brand text-stone-50' : 'border-stone-300 text-stone-500 hover:border-stone-500',
  )

  return (
    <div className="mb-8 space-y-5 rounded-md border border-stone-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-6">
        <span className="flex items-center gap-2 text-[14px] text-stone-600">
          端口
          <button className={radioCls(role === 'client')} onClick={() => { setRole('client'); setExistingId('') }}>医院 / 加工厂</button>
          <button className={radioCls(role === 'designer')} onClick={() => { setRole('designer'); setExistingId('') }}>设计师</button>
        </span>
        <span className="flex items-center gap-2 text-[14px] text-stone-600">
          档案
          <button className={radioCls(mode === 'new')} onClick={() => setMode('new')}>新建档案</button>
          <button className={radioCls(mode === 'existing')} onClick={() => setMode('existing')}>关联已有档案</button>
        </span>
      </div>

      {mode === 'existing' && (
        <Field label={role === 'client' ? '选择医院 / 加工厂' : '选择设计师'} required>
          {unlinked.length === 0 ? (
            <p className="text-[14px] text-stone-400">暂无可关联的档案（都已有账号）</p>
          ) : (
            <select className={cn(inputCls, 'max-w-xs')} value={existingId} onChange={(e) => setExistingId(e.target.value)}>
              <option value="">请选择…</option>
              {unlinked.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          )}
        </Field>
      )}

      {mode === 'new' && role === 'client' && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="单位名称" required>
            <input className={inputCls} value={clientForm.name} onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })} placeholder="如：某口腔医院 / 某加工厂" />
          </Field>
          <Field label="联系电话" required>
            <input className={inputCls} value={clientForm.phone} onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })} />
          </Field>
          <Field label="类型" required>
            <span className="flex gap-2 pt-1">
              <button className={radioCls(clientForm.kind === 'hospital')} onClick={() => setClientForm({ ...clientForm, kind: 'hospital' })}>医院</button>
              <button className={radioCls(clientForm.kind === 'factory')} onClick={() => setClientForm({ ...clientForm, kind: 'factory' })}>加工厂</button>
            </span>
          </Field>
          <Field label="客户分组" required hint="决定该客户的订单可被哪些设计师组看见">
            <span className="flex items-center gap-2">
              <select className={cn(inputCls, 'max-w-[200px]')} value={clientForm.clientGroupId} onChange={(e) => setClientForm({ ...clientForm, clientGroupId: e.target.value })}>
                <option value="">请选择…</option>
                {db.clientGroups.map((cg) => <option key={cg.id} value={cg.id}>{cg.name}{cg.note ? ' — ' + cg.note : ''}</option>)}
              </select>
              <button type="button" className={cn(btnGhost, 'text-[13px]')} onClick={() => setShowQuickCG(true)}>+ 快速创建分组</button>
            </span>
            {!clientForm.clientGroupId && <span className="mt-1 block text-[12px] text-amber-600">⚠ 未选择分组将导致订单无法自动匹配，是否继续？</span>}
          </Field>
          {showQuickCG && (
            <span className="flex items-center gap-2 rounded border border-amber-200 bg-amber-50 p-3">
              <input className={cn(inputCls, 'w-40 py-1.5 text-[14px]')} placeholder="分组名" value={quickCGName} onChange={(e) => setQuickCGName(e.target.value)} />
              <input className={cn(inputCls, 'w-40 py-1.5 text-[14px]')} placeholder="备注(可选)" value={quickCGNote} onChange={(e) => setQuickCGNote(e.target.value)} />
              <button className={btnPrimary} disabled={!quickCGName.trim()} onClick={async () => {
                try {
                  const cg = await createClientGroupAsync(quickCGName, quickCGNote)
                  setClientForm({ ...clientForm, clientGroupId: cg.id })
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : '创建分组失败')
                  return
                }
                setShowQuickCG(false); setQuickCGName(''); setQuickCGNote('')
              }}>创建</button>
              <button className={btnGhost} onClick={() => setShowQuickCG(false)}>取消</button>
            </span>
          )}
        </div>
      )}

      {mode === 'new' && role === 'designer' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="姓名" required>
            <input className={inputCls} value={designerForm.name} onChange={(e) => setDesignerForm({ ...designerForm, name: e.target.value })} placeholder="如：李二" />
          </Field>
          <Field label="电话" required>
            <input className={inputCls} value={designerForm.phone} onChange={(e) => setDesignerForm({ ...designerForm, phone: e.target.value })} />
          </Field>
          <Field label="身份证号" required>
            <input className={inputCls} value={designerForm.idCard} onChange={(e) => setDesignerForm({ ...designerForm, idCard: e.target.value })} />
          </Field>
          <Field label="技工证证件号" optional>
            <input className={inputCls} value={designerForm.certNo} onChange={(e) => setDesignerForm({ ...designerForm, certNo: e.target.value })} />
          </Field>
          <Field label="所属分组" optional hint="未分组的设计师登录后看不到任何订单，可稍后在「设计师分组」中分配">
            <span className="flex items-center gap-2">
              <select className={cn(inputCls, 'max-w-[200px]')} value={designerForm.groupId} onChange={(e) => setDesignerForm({ ...designerForm, groupId: e.target.value })}>
                <option value="">未分组（暂不接单）</option>
                {db.groups.map((g) => <option key={g.id} value={g.id}>{g.name}{g.note ? ' — ' + g.note : ''}</option>)}
              </select>
              <button type="button" className={cn(btnGhost, 'text-[13px]')} onClick={() => setShowQuickDG(true)}>+ 快速创建分组</button>
            </span>
            {!designerForm.groupId && <span className="mt-1 block text-[12px] text-amber-600">⚠ 未选择分组将无法接收匹配订单，是否继续？</span>}
          </Field>
          {showQuickDG && (
            <span className="flex items-center gap-2 rounded border border-amber-200 bg-amber-50 p-3">
              <input className={cn(inputCls, 'w-40 py-1.5 text-[14px]')} placeholder="分组名" value={quickDGName} onChange={(e) => setQuickDGName(e.target.value)} />
              <input className={cn(inputCls, 'w-40 py-1.5 text-[14px]')} placeholder="备注(可选)" value={quickDGNote} onChange={(e) => setQuickDGNote(e.target.value)} />
              <button className={btnPrimary} disabled={!quickDGName.trim()} onClick={async () => {
                try {
                  const dg = await registerDesignerGroupAsync(quickDGName, quickDGNote)
                  setDesignerForm({ ...designerForm, groupId: dg.id })
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : '创建分组失败')
                  return
                }
                setShowQuickDG(false); setQuickDGName(''); setQuickDGNote('')
              }}>创建</button>
              <button className={btnGhost} onClick={() => setShowQuickDG(false)}>取消</button>
            </span>
          )}
        </div>
      )}

      <div className="grid gap-4 border-t border-stone-100 pt-4 sm:grid-cols-2 lg:max-w-lg">
        <Field label="登录账号" required>
          <input className={inputCls} value={username} onChange={(e) => { setUsername(e.target.value); setError('') }} placeholder="如：mingzhou" />
        </Field>
        <Field label="初始密码" required hint="至少 4 位，告知对方后建议尽快修改">
          <input className={inputCls} value={password} onChange={(e) => { setPassword(e.target.value); setError('') }} placeholder="如：123456" />
        </Field>
      </div>

      {error && <p className="text-[14px] text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button className={btnPrimary} onClick={submit}>确认创建</button>
        <button className={btnGhost} onClick={onDone}>取消</button>
      </div>
    </div>
  )
}

/* ---------------- 订单总览 ---------------- */

function Orders({ jump }: { jump?: { status?: string; stale?: boolean; isRework?: boolean } | null }) {
  const db = useDB()
  const now = useNow()
  const [openId, setOpenId] = useState<string | null>(null)
  const unassignedCount = db.orders.filter((o) => o.status === 'unassigned').length
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [query, setQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [clientFilter, setClientFilter] = useState<string>('')
  const [staleOnly, setStaleOnly] = useState(false)
  const [reworkOnly, setReworkOnly] = useState(false)
  const [sort, setSort] = useState<OrderSort>('new')
  // 从概览卡片跳入时同步筛选条件：渲染期比较 prev 值（React 推荐的派生状态写法，无需 effect）
  const [prevJump, setPrevJump] = useState(jump)
  if (jump !== prevJump) {
    setPrevJump(jump)
    if (jump) { setStatusFilter(jump.status ?? ''); setStaleOnly(!!jump.stale); setReworkOnly(!!jump.isRework) }
  }
  const staleCount = db.orders.filter((o) => o.status === 'pending' && now - new Date(o.createdAt).getTime() > 24 * 3600 * 1000).length
  const filteredOrders = useMemo(() => {
    let base = searchOrders(db, 'admin', '', query || undefined, dateFrom || undefined, dateTo || undefined, statusFilter || undefined)
    if (clientFilter) base = base.filter((o) => o.clientId === clientFilter)
    if (staleOnly) base = base.filter((o) => o.status === 'pending' && now - new Date(o.createdAt).getTime() > 24 * 3600 * 1000)
    if (reworkOnly) base = base.filter((o) => o.isRework)
    return sortOrders(base, sort)
  }, [db, now, query, dateFrom, dateTo, statusFilter, clientFilter, staleOnly, reworkOnly, sort])
  const exportOrdersCSV = () => {
    const head = '单号,来源,患者,类型,牙位/范围,设计师,积分,状态,提交时间\n'
    const rows = filteredOrders.map((o) => {
      const c = db.clients.find((x) => x.id === o.clientId)
      const d = db.designers.find((x) => x.id === o.designerId)
      const scope = o.type === 'malong'
        ? `马龙桥·${o.arch ? ARCH_LABELS[o.arch] : '全口'}`
        : o.custom ? `自定义${o.customCount ?? 0}颗` : `${o.teeth.length}颗(${o.teeth.join(' ')})`
      return `${o.no},${c?.name ?? ''},${o.patient ?? ''},${DESIGN_TYPES[o.type].label}${o.urgent ? '(加急)' : ''},${scope},${d ? designerAlias(d) : ''},${o.points},${ORDER_STATUS[o.status].label},${o.createdAt.slice(0, 10)}`
    }).join('\n')
    const blob = new Blob(['﻿' + head + rows], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `木叶设计平台-订单-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  if (db.orders.length === 0) return <EmptyState title="暂无订单" />
  return (
    <section>
      <SectionHead index="04" title="订单总览" desc="管理端可见全部订单的派单来源与接单设计师，可展开查看照片与扫描/设计文件"
        right={
          <div className="flex gap-1 rounded-full border border-stone-200 bg-white p-1">
            {(['','pending','designing','completed','returned','rework','unassigned','cancelled'] as const).map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)} className={cn('rounded-full px-3 py-1 text-[12px] font-medium transition-colors duration-150', statusFilter === s ? 'bg-brand text-stone-50' : 'text-stone-500 hover:text-stone-900')}>
                {s === '' ? '全部' : ORDER_STATUS[s].label}
              </button>
            ))}
          </div>
        } />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input className={cn(inputCls, 'w-52 py-1.5 text-[14px]')} placeholder="按单号 / 患者姓名搜索" value={query} onChange={(e) => setQuery(e.target.value)} />
        <input type="date" aria-label="开始日期" className={cn(inputCls, 'w-40 py-1.5 text-[14px]')} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <span className="text-[13px] text-stone-400">至</span>
        <input type="date" aria-label="结束日期" className={cn(inputCls, 'w-40 py-1.5 text-[14px]')} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <SortBar sort={sort} onChange={setSort} />
        {(query || dateFrom || dateTo) && (
          <button type="button" className="text-[13px] text-stone-400 hover:text-stone-700" onClick={() => { setQuery(''); setDateFrom(''); setDateTo('') }}>清除</button>
        )}
        {clientFilter && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-[12.5px] text-stone-50">
            只看：{db.clients.find((c) => c.id === clientFilter)?.name}
            <button type="button" aria-label="取消客户筛选" onClick={() => setClientFilter('')}>×</button>
          </span>
        )}
        <button
          type="button"
          className={cn('rounded-full border px-3 py-1 text-[12.5px] transition-colors', staleOnly ? 'border-red-400 bg-red-50 text-red-600' : 'border-stone-300 bg-white text-stone-500 hover:border-red-300 hover:text-red-600')}
          onClick={() => setStaleOnly(!staleOnly)}
        >
          超时未接（24h）{staleCount > 0 ? ` ${staleCount}` : ''}
        </button>
        <button
          type="button"
          className={cn('rounded-full border px-3 py-1 text-[12.5px] transition-colors', reworkOnly ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-stone-300 bg-white text-stone-500 hover:border-amber-300 hover:text-amber-700')}
          onClick={() => setReworkOnly(!reworkOnly)}
        >
          返工订单
        </button>
        <button type="button" className={btnGhost} onClick={exportOrdersCSV}>导出订单 CSV</button>
      </div>
      {filteredOrders.length === 0 && <EmptyState title="没有符合条件的订单" hint="换个单号、日期或状态筛选试试" />}
      {unassignedCount > 0 && (
        <div className="mb-4 border border-amber-300 bg-amber-50 px-4 py-3 text-[13.5px] leading-relaxed text-amber-800">
          ⚠ 有 {unassignedCount} 笔订单处于「未分配」：客户分组尚未匹配设计师组，设计师暂时看不到这些订单。
          请先到「分组匹配」配置匹配关系，再点击订单旁的「重新派发」。
        </div>
      )}
      <div className="overflow-x-auto border-y border-stone-300">
        <table className="w-full min-w-[880px] text-left text-[14px]">
          <thead>
            <tr className="border-b-2 border-stone-300 font-mono text-[11.5px] uppercase tracking-[0.14em] text-stone-400">
              <th className="py-2.5 pr-4 font-medium">单号</th>
              <th className="py-2.5 pr-4 font-medium">来源（仅管理端可见）</th>
              <th className="py-2.5 pr-4 font-medium">类型</th>
              <th className="py-2.5 pr-4 font-medium">牙位</th>
              <th className="py-2.5 pr-4 font-medium">设计师</th>
              <th className="py-2.5 pr-4 font-medium text-right">积分</th>
              <th className="py-2.5 pr-4 font-medium">状态</th>
              <th className="py-2.5 font-medium">详情</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200 [&>tr:nth-child(even)]:bg-[#faf7f1] [&>tr:hover]:bg-[#eef3f0] [&>tr]:transition-colors">
            {filteredOrders.map((o) => {
              const c = db.clients.find((x) => x.id === o.clientId)
              const d = db.designers.find((x) => x.id === o.designerId)
              const open = openId === o.id
              return (
                <Fragment key={o.id}>
                <tr className="align-middle">
                  <td className="py-3 pr-4 font-mono tabular-nums text-stone-500">{o.no}</td>
                  <td className="py-3 pr-4 font-medium text-stone-800">
                    <button
                      type="button"
                      className={cn('transition-colors hover:text-brand hover:underline', clientFilter === o.clientId && 'text-brand underline')}
                      title="只看这家客户的订单"
                      onClick={() => setClientFilter(clientFilter === o.clientId ? '' : o.clientId)}
                    >
                      {c?.name}
                    </button>
                  </td>
                  <td className="py-3 pr-4"><TypeTag type={o.type} urgent={o.urgent} /></td>
                  <td className="py-3 pr-4"><OrderScope order={o} /></td>
                  <td className="py-3 pr-4 text-stone-700">{d ? `${designerAlias(d)}（${d.name}）` : '—'}</td>
                  <td className="py-3 pr-4 text-right font-mono tabular-nums text-stone-700">{o.points}</td>
                  <td className="py-3 pr-4">
                  <span className="flex items-center gap-2">
                    <StatusPill status={o.status} />
                    {o.status === 'pending' && now - new Date(o.createdAt).getTime() > 24 * 3600 * 1000 && (
                      <span className="rounded-full bg-red-50 px-2 py-px text-[11px] font-medium text-red-600 ring-1 ring-inset ring-red-200">超时未接</span>
                    )}
                    {o.status === 'unassigned' && (
                      <button
                        type="button"
                        className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700 hover:bg-amber-100"
                        onClick={async () => {
                          if (!(await dispatchUnassignedOrderAsync(o.id))) {
                            window.alert('该订单的客户分组仍未匹配任何设计师组，直接派发会让订单无人可见。\n请先到「分组匹配」中配置好匹配关系，再点击重新派发。')
                          }
                        }}
                      >
                        重新派发
                      </button>
                    )}
                  </span>
                </td>
                  <td className="py-3">
                    <button
                      className="font-mono text-[12px] uppercase tracking-wider text-stone-400 transition-colors hover:text-stone-700"
                      onClick={() => setOpenId(open ? null : o.id)}
                    >
                      {open ? '收起 ▲' : '展开 ▼'}
                    </button>
                  </td>
                </tr>
                {open && (
                  <tr>
                    <td colSpan={8} className="bg-stone-50 px-4 py-4">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div>
                          <div className="mb-1.5 font-mono text-[12px] uppercase tracking-[0.16em] text-stone-400">扫描文件（点击下载）</div>
                          <div className="flex flex-wrap gap-2">
                            {o.scanFiles.length > 0
                              ? o.scanFiles.map((f, i) => <FileChip key={i} file={f} tone="stone" />)
                              : <span className="text-[13.5px] text-stone-400">无</span>}
                          </div>
                        </div>
                        <div>
                          <div className="mb-1.5 font-mono text-[12px] uppercase tracking-[0.16em] text-stone-400">设计文件（点击下载）</div>
                          <div className="flex flex-wrap gap-2">
                            {o.designFiles.length > 0
                              ? o.designFiles.map((f, i) => <FileChip key={i} file={f} />)
                              : <span className="text-[13.5px] text-stone-400">尚未提交</span>}
                          </div>
                        </div>
                        <div>
                          <div className="mb-1.5 font-mono text-[12px] uppercase tracking-[0.16em] text-stone-400">照片（点击放大 / 下载）</div>
                          {o.images.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {o.images.map((img, i) => <ImageThumb key={i} img={img} />)}
                            </div>
                          ) : (
                            <span className="text-[13.5px] text-stone-400">无</span>
                          )}
                        </div>
                      </div>
                      <p className="mt-3 text-[14px] leading-relaxed text-stone-500">设计要求：{o.requirement}</p>
                      {(() => {
                        const fmt = (iso: string) => {
                          const dt = new Date(iso)
                          return `${dt.getMonth() + 1}月${dt.getDate()}日 ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
                        }
                        const events: { at: string; label: string; bad?: boolean }[] = [{ at: o.createdAt, label: '医院提交订单' }]
                        if (o.acceptedAt) events.push({ at: o.acceptedAt, label: `设计师接单${d ? `（${designerAlias(d)}）` : ''}` })
                        if (o.completedAt) events.push({ at: o.completedAt, label: '设计完成，提交设计稿' })
                        if (o.returnedAt) events.push({ at: o.returnedAt, label: `设计师退回：${o.returnReason ?? '信息不全或数据有问题'}`, bad: true })
                        if (o.cancelledAt) events.push({ at: o.cancelledAt, label: `医院撤回订单，退回 ${o.points} 积分` })
                        db.reworks.filter((r) => r.orderId === o.id).forEach((r) => {
                          events.push({ at: r.createdAt, label: `医院申请返工：${r.reason}` })
                          if (r.reviewedAt) {
                            events.push({
                              at: r.reviewedAt,
                              label: r.status === 'approved' ? '管理端审核通过，转为返工单' : '管理端驳回返工申请',
                              bad: r.status === 'rejected',
                            })
                          }
                        })
                        events.sort((a, b) => a.at.localeCompare(b.at))
                        return (
                          <div className="mt-3 border-t border-stone-200 pt-3">
                            <div className="mb-1.5 font-mono text-[12px] uppercase tracking-[0.16em] text-stone-400">操作时间线</div>
                            <ul className="space-y-1">
                              {events.map((e, i) => (
                                <li key={i} className="flex items-baseline gap-3 text-[13.5px]">
                                  <span className="shrink-0 font-mono tabular-nums text-stone-400">{fmt(e.at)}</span>
                                  <span className={e.bad ? 'text-red-600' : 'text-stone-600'}>{e.label}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )
                      })()}
                    </td>
                  </tr>
                )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/* ---------------- 设计参数配置（按客户，设计师端可见） ---------------- */

function ParamEditor({ clientId }: { clientId: string }) {
  const db = useDB()
  const dp = getDesignParam(db, clientId)
  const [open, setOpen] = useState(false)
  const [innerCrown, setInnerCrown] = useState('')
  const [occlusalCut, setOcclusalCut] = useState('')
  const [proximalCut, setProximalCut] = useState('')

  const startEdit = () => {
    setInnerCrown(String(dp?.innerCrown ?? 0.02))
    setOcclusalCut(String(dp?.occlusalCut ?? 0.1))
    setProximalCut(String(dp?.proximalCut ?? -0.02))
    setOpen(true)
  }

  const num = (v: string, fallback: number) => { const n = parseFloat(v); return Number.isFinite(n) ? n : fallback }

  if (!open) {
    return (
      <button
        type="button"
        className="ml-2 rounded-full border border-stone-300 px-2 py-px font-mono text-[11px] text-stone-400 transition-colors hover:border-brand hover:text-brand"
        title="配置设计参数（内冠间隙 / 咬合切 / 邻接切，设计师端可见）"
        onClick={startEdit}
      >
        参数 {dp ? `${dp.innerCrown} / ${dp.occlusalCut} / ${dp.proximalCut}` : '默认'}
      </button>
    )
  }
  return (
    <span className="ml-2 inline-flex flex-wrap items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1">
      <label className="flex items-center gap-1 text-[11px] text-stone-500">内冠间隙<input className="w-14 rounded border border-stone-300 px-1 py-0.5 font-mono text-[11px]" value={innerCrown} onChange={(e) => setInnerCrown(e.target.value)} /></label>
      <label className="flex items-center gap-1 text-[11px] text-stone-500">咬合切<input className="w-14 rounded border border-stone-300 px-1 py-0.5 font-mono text-[11px]" value={occlusalCut} onChange={(e) => setOcclusalCut(e.target.value)} /></label>
      <label className="flex items-center gap-1 text-[11px] text-stone-500">邻接切<input className="w-14 rounded border border-stone-300 px-1 py-0.5 font-mono text-[11px]" value={proximalCut} onChange={(e) => setProximalCut(e.target.value)} /></label>
      <button type="button" className="text-[11px] font-medium text-brand hover:text-brand-light" onClick={() => { saveDesignParam(clientId, num(innerCrown, 0.02), num(occlusalCut, 0.1), num(proximalCut, -0.02)); setOpen(false) }}>保存</button>
      <button type="button" className="text-[11px] text-stone-400 hover:text-stone-700" onClick={() => setOpen(false)}>取消</button>
    </span>
  )
}

/* ---------------- 积分管理 ---------------- */

function Points() {
  const db = useDB()
  const [adjustFor, setAdjustFor] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  const submitAdjust = (c: Client, sign: 1 | -1) => {
    const n = Math.abs(parseInt(amount, 10))
    if (!n) return
    if (sign === -1 && n > c.points) { toast.error(`扣减不能超过当前积分余额（${c.points} 分）`); return }
    adjustPoints(c.id, sign * n, reason.trim())
    setAdjustFor(null); setAmount(''); setReason('')
  }

  return (
    <section>
      <SectionHead index="02" title="积分管理" desc="客户微信转账后在此手动充值；医院端可见积分余额与积分明细" />
      <div className="overflow-x-auto border-y border-stone-300">
        <table className="w-full min-w-[720px] text-left text-[14px]">
          <thead>
            <tr className="border-b-2 border-stone-300 font-mono text-[11.5px] uppercase tracking-[0.14em] text-stone-400">
              <th className="py-2.5 pr-4 font-medium">医院 / 加工厂</th>
              <th className="py-2.5 pr-4 font-medium">联系电话</th>
              <th className="py-2.5 pr-4 font-medium text-right">当前积分</th>
              <th className="py-2.5 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200 [&>tr:nth-child(even)]:bg-[#faf7f1] [&>tr:hover]:bg-[#eef3f0] [&>tr]:transition-colors">
            {db.clients.map((c) => (
              <tr key={c.id} className="align-middle">
                <td className="py-3 pr-4">
                  <div className="font-medium text-stone-800">{c.name} <ParamEditor clientId={c.id} /></div>
                  <div className="font-mono text-[11.5px] uppercase tracking-wider text-stone-400">
                    {c.kind === 'hospital' ? '医院' : '加工厂'}
                  </div>
                </td>
                <td className="py-3 pr-4 font-mono tabular-nums text-stone-600">{c.phone}</td>
                <td className={cn('py-3 pr-4 text-right font-mono text-[16px] tabular-nums', c.points < 50 ? 'text-red-600' : 'text-stone-900')}>
                  {c.points}
                </td>
                <td className="py-3">
                  {adjustFor === c.id ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <input className={cn(inputCls, 'w-24 py-1 text-[14px]')} placeholder="数量" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
                      <input className={cn(inputCls, 'w-40 py-1 text-[14px]')} placeholder="备注（如：充值）" value={reason} onChange={(e) => setReason(e.target.value)} />
                      <button className={btnPrimary} onClick={() => submitAdjust(c, 1)}>+ 充值</button>
                      <button className={btnGhost} onClick={() => submitAdjust(c, -1)}>− 扣减</button>
                      <button className="text-[13px] text-stone-400 hover:text-stone-700" onClick={() => setAdjustFor(null)}>取消</button>
                    </span>
                  ) : (
                    <button className={btnGhost} onClick={() => setAdjustFor(c.id)}>调整积分</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="mb-3 mt-10 font-mono text-[11.5px] uppercase tracking-[0.18em] text-stone-400">积分流水（后台记录）</h3>
      <ul className="divide-y divide-stone-200 border-y border-stone-300 text-[14px]">
        {db.txns.map((t) => {
          const c = db.clients.find((x) => x.id === t.clientId)
          return (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <span className="text-stone-700">
                <span className="font-medium">{c?.name}</span>
                <span className="ml-3 text-stone-500">{t.reason}</span>
              </span>
              <span className="font-mono tabular-nums">
                <span className={t.delta >= 0 ? 'text-emerald-600' : 'text-stone-900'}>{t.delta >= 0 ? `+${t.delta}` : t.delta}</span>
                <span className="ml-3 text-stone-400">余额 {t.balance}</span>
                <span className="ml-3 text-[12.5px] text-stone-400">{new Date(t.createdAt).toLocaleDateString('zh-CN')}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/* ---------------- 账单中心 ---------------- */

interface BillRow {
  jike: number; quanci: number; tiemian: number; malong: number; jita: number; rework: number; points: number
}

function billOf(orders: Order[]): BillRow {
  const row: BillRow = { jike: 0, quanci: 0, tiemian: 0, malong: 0, jita: 0, rework: 0, points: 0 }
  for (const o of orders) {
    if (o.status !== 'completed' || !o.completedAt) continue
    const n = o.type === 'malong' ? 1 : (o.customCount ?? o.teeth.length)
    if (o.isRework) { row.rework += n; continue }
    row[o.type] += n
    row.points += o.points
  }
  return row
}

function BillTable({ title, rows, nameOf }: {
  title: string
  rows: { bill: BillRow }[]
  nameOf: (i: number) => string
}) {
  return (
  <div>
    <h3 className="mb-3 font-mono text-[11.5px] uppercase tracking-[0.18em] text-stone-400">{title}</h3>
    <div className="overflow-x-auto border-y border-stone-300">
      <table className="w-full min-w-[640px] text-left text-[14px]">
        <thead>
          <tr className="border-b-2 border-stone-300 font-mono text-[11.5px] uppercase tracking-[0.14em] text-stone-400">
            <th className="py-2.5 pr-4 font-medium">名称</th>
            <th className="py-2.5 pr-4 font-medium text-right">即刻设计</th>
            <th className="py-2.5 pr-4 font-medium text-right">全瓷冠/基台冠</th>
            <th className="py-2.5 pr-4 font-medium text-right">贴面/嵌体</th>
            <th className="py-2.5 pr-4 font-medium text-right">马龙桥(件)</th>
            <th className="py-2.5 pr-4 font-medium text-right">基台</th>
            <th className="py-2.5 pr-4 font-medium text-right">返工</th>
            <th className="py-2.5 font-medium text-right">积分合计</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-200 [&>tr:nth-child(even)]:bg-[#faf7f1] [&>tr:hover]:bg-[#eef3f0] [&>tr]:transition-colors">
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="py-3 pr-4 font-medium text-stone-800">{nameOf(i)}</td>
              <td className="py-3 pr-4 text-right font-mono tabular-nums text-stone-700">{r.bill.jike || '—'}</td>
              <td className="py-3 pr-4 text-right font-mono tabular-nums text-stone-700">{r.bill.quanci || '—'}</td>
              <td className="py-3 pr-4 text-right font-mono tabular-nums text-stone-700">{r.bill.tiemian || '—'}</td>
              <td className="py-3 pr-4 text-right font-mono tabular-nums text-stone-700">{r.bill.malong || '—'}</td>
              <td className="py-3 pr-4 text-right font-mono tabular-nums text-stone-700">{r.bill.jita || '—'}</td>
              <td className={cn('py-3 pr-4 text-right font-mono tabular-nums', r.bill.rework ? 'text-red-600' : 'text-stone-700')}>{r.bill.rework || '—'}</td>
              <td className="py-3 text-right font-mono tabular-nums text-stone-900">{r.bill.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
  )
}

function Bills() {
  const db = useDB()
  const months = useMemo(() => {
    const set = new Set<string>()
    db.orders.forEach((o) => { if (o.completedAt) set.add(monthOf(o.completedAt)) })
    set.add(monthOf(new Date().toISOString()))
    return [...set].sort().reverse()
  }, [db.orders])
  const [month, setMonth] = useState(months[0])

  const inMonth = (o: Order) => o.completedAt && monthOf(o.completedAt) === month

  const clientBills = db.clients.map((c) => ({ client: c, bill: billOf(db.orders.filter((o) => o.clientId === c.id && inMonth(o))) }))
  const designerBills = db.designers.map((d) => ({ designer: d, bill: billOf(db.orders.filter((o) => o.designerId === d.id && inMonth(o))) }))
  const total = billOf(db.orders.filter(inMonth))

  const exportCSV = () => {
    const head = '类型,名称,即刻设计(颗),全瓷冠/基台上部冠(颗),贴面/嵌体(颗),马龙桥(件),基台(颗),返工(颗),积分合计\n'
    const rows = [
      ...clientBills.map(({ client, bill }) => `医院/加工厂,${client.name},${bill.jike},${bill.quanci},${bill.tiemian},${bill.malong},${bill.jita},${bill.rework},${bill.points}`),
      ...designerBills.map(({ designer, bill }) => `设计师,${designerAlias(designer)},${bill.jike},${bill.quanci},${bill.tiemian},${bill.malong},${bill.jita},${bill.rework},${bill.points}`),
    ].join('\n')
    const blob = new Blob(['﻿' + head + rows], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `木叶设计平台-账单-${month}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <section>
      <SectionHead
        index="01"
        title="账单中心"
        desc="每个月为一份账单，分别生成医院/加工厂与设计师账单"
        right={
          <div className="flex items-center gap-2">
            <div className="flex gap-1 border border-[#ddd6c6] bg-white p-1">
              {months.map((m) => (
                <button
                  key={m}
                  onClick={() => setMonth(m)}
                  className={cn(
                    'rounded-full px-3 py-1 font-mono text-[13px] tabular-nums transition-colors duration-150',
                    month === m ? 'bg-brand text-stone-50' : 'text-stone-500 hover:text-stone-900',
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            <button className={btnGhost} onClick={exportCSV}>导出 CSV</button>
          </div>
        }
      />

      <div className="mb-10 grid grid-cols-2 gap-6 sm:grid-cols-7">
        <Stat label="即刻设计" value={total.jike} unit="颗" />
        <Stat label="全瓷冠/基台冠" value={total.quanci} unit="颗" />
        <Stat label="贴面/嵌体" value={total.tiemian} unit="颗" />
        <Stat label="马龙桥" value={total.malong} unit="件" />
        <Stat label="基台" value={total.jita} unit="颗" />
        <Stat label="返工" value={total.rework} unit="颗" tone={total.rework > 0 ? 'warn' : 'default'} />
        <Stat label="积分合计" value={total.points} />
      </div>

      <div className="space-y-10">
        <BillTable title="医院 / 加工厂账单" rows={clientBills} nameOf={(i) => clientBills[i].client.name} />
        <BillTable title="设计师账单（对外仅显示 X 师傅）" rows={designerBills} nameOf={(i) => designerAlias(designerBills[i].designer)} />
      </div>
    </section>
  )
}



/* ---------------- 订单概览 ---------------- */

function Overview({ onJump }: { onJump: (j: { status?: string; stale?: boolean; isRework?: boolean }) => void }) {
  const db = useDB()
  const now = useNow()
  const stats = orderStats(db, 'admin', '')
  const stale = db.orders.filter((o) => o.status === 'pending' && now - new Date(o.createdAt).getTime() > 24 * 3600 * 1000).length
  const cards: { label: string; value: number; hot?: boolean; numCls: string; jump: { status?: string; stale?: boolean; isRework?: boolean } }[] = [
    { label: '总订单', value: stats.total, numCls: 'text-stone-900', jump: {} },
    { label: '本月新增', value: stats.monthly, numCls: 'text-stone-900', jump: {} },
    { label: '已完成', value: stats.completed, numCls: 'text-emerald-600', jump: { status: 'completed' } },
    { label: '返工', value: stats.reworked, numCls: 'text-amber-600', jump: { isRework: true } },
    { label: '退回', value: stats.returned, numCls: 'text-red-600', jump: { status: 'returned' } },
    { label: '超时未接（24h）', value: stale, hot: stale > 0, numCls: stale > 0 ? 'text-red-600' : 'text-stone-900', jump: { stale: true } },
  ]
  return (
    <section>
      <SectionHead index="06" title="订单概览" desc="全平台订单数据总览，点击卡片可直接查看对应订单" />
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-6">
        {cards.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => onJump(c.jump)}
            title="点击查看对应订单"
            className={cn(
              'rounded-md border bg-white p-4 text-left transition-all duration-150 hover:border-brand hover:shadow-md',
              c.hot ? 'border-red-200 bg-red-50' : 'border-stone-200',
            )}
          >
            <div className={cn('text-[11px] uppercase tracking-wider', c.hot ? 'text-red-400' : 'text-stone-400')}>{c.label}</div>
            <div className={cn('mt-1 font-mono text-[28px] tabular-nums', c.numCls)}>{c.value}</div>
          </button>
        ))}
      </div>
      <h3 className="mb-3 font-mono text-[11.5px] uppercase tracking-[0.18em] text-stone-400">各客户组订单统计</h3>
      <ul className="divide-y divide-stone-200 border-y border-stone-300">
        {db.clientGroups.map((cg) => {
          const cids = db.clients.filter((c) => c.clientGroupId === cg.id).map((c) => c.id)
          const n = db.orders.filter((o) => cids.includes(o.clientId)).length
          return <li key={cg.id} className="flex justify-between py-2.5 text-[14px]"><span className="text-stone-700">{cg.name}</span><span className="font-mono tabular-nums text-stone-500">{n} 单</span></li>
        })}
      </ul>
    </section>
  )
}

/* ---------------- 返工审核 ---------------- */

function ReworkReview() {
  const db = useDB()
  const pendingReworks = db.reworks.filter((r) => r.status === 'pending')
  return (
    <section>
      <SectionHead index="07" title="返工审核" desc="订单在客户申请时已回到原设计师手上重做，此处仅登记并决定是否退还积分" right={pendingReworks.length > 0 ? <span className="rounded-full bg-red-500 px-3 py-1 text-[12px] text-white">{pendingReworks.length} 条待审</span> : undefined} />
      {pendingReworks.length === 0 && db.reworks.filter((r) => r.status !== 'pending').length === 0 && <EmptyState title="暂无返工申请" />}
      {db.reworks.map((rw) => {
        const o = db.orders.find((x) => x.id === rw.orderId)
        const c = db.clients.find((x) => x.id === rw.clientId)
        const statusLabel = rw.status === 'pending' ? '待审核' : rw.status === 'approved' ? '已通过' : '未通过'
        const statusColor = rw.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-300' : rw.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-red-50 text-red-700 border-red-300'
        return (
          <div key={rw.id} className={cn('mb-3 rounded-md border p-4', rw.status === 'pending' ? 'border-amber-300 bg-amber-50/30' : 'border-stone-300 bg-white')}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[14px] text-stone-500">{o?.no ?? rw.orderId}</span>
              <span className={cn('rounded-full border px-2.5 py-0.5 text-[12px]', statusColor)}>{statusLabel}</span>
            </div>
            <p className="mt-2 text-[13px] text-stone-600">客户：{c?.name} | 返工原因：{rw.reason}</p>
            {rw.images.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {rw.images.map((img, i) => <ImageThumb key={i} img={img} size="h-16 w-16" />)}
              </div>
            )}
            {rw.status === 'pending' && (
              <div className="mt-3 flex gap-2">
                <button className={btnPrimary} onClick={() => { if (window.confirm('确认审核通过？将退还该订单积分，订单仍由原设计师重做。')) { approveRework(rw.id); toast.success(`已通过返工申请，订单 ${o?.no ?? ''} 积分已退还`) } }}>通过（退积分）</button>
                <button className={btnGhost} onClick={() => { if (window.confirm('确认审核不通过？不退还积分，订单仍由原设计师修改。')) { rejectRework(rw.id); toast.info(`已驳回返工申请，订单 ${o?.no ?? ''} 不退还积分`) } }}>不通过</button>
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}

/* ---------------- 分组匹配 ---------------- */

function Matching() {
  const db = useDB()

  return (
    <section>
      <SectionHead index="05" title="分组匹配" desc="配置客户分组与设计师分组的匹配关系，订单将按此规则自动路由" />
      <div className="mb-6">
        <div className="mb-2 font-mono text-[11.5px] uppercase tracking-[0.14em] text-stone-400">客户分组列表</div>
        <div className="flex flex-wrap gap-2">
          {db.clientGroups.map((cg) => (
            <span key={cg.id} className="inline-flex items-center gap-1 rounded-full border border-stone-300 bg-white px-3 py-1 text-[13.5px] text-stone-700">
              {cg.name}
              {cg.note ? <span className="text-stone-400">({cg.note})</span> : null}
              <span className="ml-1 font-mono text-[12px] text-stone-400">
                ({db.clients.filter((c) => c.clientGroupId === cg.id).length} 客户)
              </span>
              <ClientGroupActions cg={cg} />
            </span>
          ))}
          <AddClientGroup />
        </div>
      </div>

      <div className="overflow-x-auto border-y border-stone-300">
        <table className="w-full min-w-[640px] text-left text-[14px]">
          <thead>
            <tr className="border-b-2 border-stone-300 font-mono text-[11.5px] uppercase tracking-[0.14em] text-stone-400">
              <th className="py-2.5 pr-4 font-medium">客户分组</th>
              {db.groups.map((g) => (
                <th key={g.id} className="py-2.5 px-3 font-medium text-center">
                  <span className="block text-[13px] text-stone-700">{g.name}</span>
                  {g.note && <span className="block text-[11px] font-normal text-stone-400 normal-case truncate max-w-[140px]">{g.note}</span>}
                  <span className="block text-[11px] font-normal text-stone-400">({db.designers.filter((d) => d.groupId === g.id).length}人)</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200 [&>tr:nth-child(even)]:bg-[#faf7f1] [&>tr:hover]:bg-[#eef3f0] [&>tr]:transition-colors">
            {db.clientGroups.map((cg) => {
              const matchedDesigner = matchedDesignerGroupIds(db, cg.id)
              const hasNoMatch = matchedDesigner.length === 0
              return (
                <tr key={cg.id} className={cn('align-middle', hasNoMatch && 'bg-red-50')}>
                  <td className="py-3 pr-4">
                    <div className="font-medium text-stone-800">{cg.name}</div>
                    {cg.note && <div className="text-[12px] text-stone-400">{cg.note}</div>}
                    {hasNoMatch && <div className="text-[11px] text-red-500">⚠ 无匹配 — 该组订单将进入未分配</div>}
                  </td>
                  {db.groups.map((g) => {
                    const checked = matchedDesigner.includes(g.id)
                    return (
                      <td key={g.id} className="py-3 px-3 text-center">
                        <button
                          type="button"
                          className={cn(
                            'mx-auto flex h-6 w-6 items-center justify-center rounded border transition-colors duration-150',
                            checked
                              ? 'border-brand bg-brand'
                              : 'border-stone-300 bg-white hover:border-stone-500',
                          )}
                          aria-label={checked ? `取消匹配 ${cg.name} ↔ ${g.name}` : `匹配 ${cg.name} ↔ ${g.name}`}
                          onClick={() => checked ? removeAssignment(cg.id, g.id) : addAssignment(cg.id, g.id)}
                        >
                          {checked && (
                            <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                              <path d="M1 4.5L4 7.5L10 1" stroke="#faf9f5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ClientGroupActions({ cg }: { cg: { id: string; name: string; note?: string } }) {
  const db = useDB()
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(cg.name)
  const [note, setNote] = useState(cg.note ?? '')
  const memberCount = db.clients.filter((c) => c.clientGroupId === cg.id).length

  if (renaming) {
    return (
      <span className="ml-2 flex items-center gap-1">
        <input className="w-28 rounded border border-stone-300 px-1.5 py-0.5 text-[12px]" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="w-20 rounded border border-stone-300 px-1.5 py-0.5 text-[12px]" placeholder="备注" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="text-[11px] text-brand hover:text-brand-light" onClick={() => { renameClientGroup(cg.id, name, note); setRenaming(false); }}>保存</button>
        <button className="text-[11px] text-stone-400 hover:text-stone-700" onClick={() => setRenaming(false)}>取消</button>
      </span>
    )
  }
  return (
    <span className="ml-2 flex items-center gap-1 text-[11px]">
      <button className="text-stone-400 hover:text-stone-700" onClick={() => { setName(cg.name); setNote(cg.note ?? ''); setRenaming(true); }}>编辑</button>
      {memberCount === 0 && (
        <button className="text-red-400 hover:text-red-600" onClick={() => { if (window.confirm('删除分组 ' + cg.name + '？（不含成员的分组）')) deleteClientGroup(cg.id); }}>删除</button>
      )}
    </span>
  )
}

function AddClientGroup() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [note, setNote] = useState('')

  if (!open) return <button type="button" className="inline-flex items-center rounded-full border border-dashed border-stone-300 px-3 py-1 text-[13px] text-stone-500 hover:border-brand hover:text-brand" onClick={() => setOpen(true)}>+ 新客户分组</button>

  return (
    <span className="inline-flex items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1">
      <input className="w-28 rounded border border-stone-300 px-1.5 py-0.5 text-[12px]" placeholder="分组名" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="w-24 rounded border border-stone-300 px-1.5 py-0.5 text-[12px]" placeholder="备注" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="text-[11px] text-brand" disabled={!name.trim()} onClick={() => { createClientGroup(name, note); setOpen(false); setName(''); setNote(''); }}>创建</button>
      <button className="text-[11px] text-stone-400" onClick={() => setOpen(false)}>×</button>
    </span>
  )
}

/* ---------------- 设计师分组 ---------------- */

function Groups() {
  const db = useDB()
  const [renaming, setRenaming] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteVal, setNoteVal] = useState('')

  return (
    <section>
      <SectionHead
        index="03"
        title="设计师分组"
        desc="A / B / C / D 等分组，每组一名组长，组名可随时更改；新设计师请在「账号管理」中创建"
      />

      <div className="grid gap-4 md:grid-cols-2">
        {db.groups.map((g) => {
          const members = db.designers.filter((d) => d.groupId === g.id)
          const leader = db.designers.find((d) => d.id === g.leaderId)
          return (
            <div key={g.id} className="rounded-md border border-stone-200 bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-4 py-3">
                {renaming === g.id ? (
                  <span className="flex items-center gap-2">
                    <input className={cn(inputCls, 'w-44 py-1 text-[14px]')} value={name} onChange={(e) => setName(e.target.value)} />
                    <button type="button" className={btnPrimary} onClick={() => { if (name.trim()) renameGroup(g.id, name.trim()); setRenaming(null) }}>保存</button>
                    <button type="button" className="text-[13px] text-stone-400 hover:text-stone-700" onClick={() => setRenaming(null)}>取消</button>
                  </span>
                ) : (
                  <>
                    <div>
                      <span className="text-[16px] font-semibold text-stone-900">{g.name}</span>
                      <span className="ml-3 font-mono text-[12px] tabular-nums text-stone-400">{members.length} 人</span>
                      {g.note && (
                        <div className="mt-1.5">
                          <span className="rounded bg-stone-800 px-2 py-0.5 text-[11px] text-stone-100">{g.note}</span>
                        </div>
                      )}
                    </div>
                    <span className="flex items-center gap-1.5">
                    <button type="button" className="font-mono text-[12px] uppercase tracking-wider text-stone-400 hover:text-stone-700" onClick={() => { setRenaming(g.id); setName(g.name) }}>
                      改名
                    </button>
                    {editingNote === g.id ? (
                      <span className="flex items-center gap-1">
                        <input className="w-32 rounded border border-stone-300 px-1.5 py-0.5 text-[11px]" placeholder="备注" value={noteVal} onChange={(e) => setNoteVal(e.target.value)} />
                        <button type="button" className="text-[11px] text-brand" onClick={() => { updateGroupNote(g.id, noteVal); setEditingNote(null); }}>保存</button>
                        <button type="button" className="text-[11px] text-stone-400" onClick={() => setEditingNote(null)}>取消</button>
                      </span>
                    ) : (
                      <button type="button" className="font-mono text-[10px] uppercase tracking-wider text-stone-400 hover:text-stone-600" onClick={() => { setEditingNote(g.id); setNoteVal(g.note ?? ''); }}>备注</button>
                    )}
                    </span>
                  </>
                )}
              </div>
              <ul className="divide-y divide-stone-100">
                {members.length === 0 && <li className="px-4 py-4 text-[14px] text-stone-400">暂无成员</li>}
                {members.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[14px]">
                    <span className="flex items-center gap-2">
                      <span className="font-medium text-stone-800">{designerAlias(d)}</span>
                      <span className="text-stone-400">（{d.name}）</span>
                      {g.leaderId === d.id && (
                        <span className="rounded-full bg-brand px-2 py-px text-[11.5px] text-stone-50">组长</span>
                      )}
                    </span>
                    <span className="flex items-center gap-3 font-mono text-[12px] text-stone-400">
                      <select
                        className="border border-stone-200 bg-white px-1.5 py-0.5 text-[12px] text-stone-500"
                        value={d.groupId}
                        onChange={(e) => moveDesigner(d.id, e.target.value)}
                      >
                        {db.groups.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                      {g.leaderId === d.id ? (
                        <button type="button" className="transition-colors duration-150 hover:text-stone-700" onClick={() => setGroupLeader(g.id, undefined)}>取消组长</button>
                      ) : (
                        <button type="button" className="transition-colors duration-150 hover:text-stone-700" onClick={() => setGroupLeader(g.id, d.id)}>设为组长</button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              {!leader && members.length > 0 && (
                <div className="border-t border-stone-100 px-4 py-2 text-[12.5px] text-orange-600">本组暂未设置组长</div>
              )}
            </div>
          )
        })}
      </div>

      {/* 未分组设计师：登录后看不到任何订单，在这里分配到组 */}
      {(() => {
        const ungrouped = db.designers.filter((d) => !d.groupId)
        if (ungrouped.length === 0) return null
        return (
          <div className="mt-4 rounded-md border border-dashed border-stone-300 bg-white">
            <div className="border-b border-stone-100 px-4 py-3">
              <span className="text-[16px] font-semibold text-stone-900">未分组</span>
              <span className="ml-3 font-mono text-[12px] tabular-nums text-stone-400">{ungrouped.length} 人</span>
              <span className="ml-3 text-[12.5px] text-stone-400">未分组的设计师登录后看不到任何订单</span>
            </div>
            <ul className="divide-y divide-stone-100">
              {ungrouped.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[14px]">
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-stone-800">{designerAlias(d)}</span>
                    <span className="text-stone-400">（{d.name}）</span>
                  </span>
                  <select
                    className="border border-stone-200 bg-white px-1.5 py-0.5 font-mono text-[12px] text-stone-500"
                    value=""
                    aria-label={`把 ${d.name} 分配到组`}
                    onChange={(e) => { if (e.target.value) moveDesigner(d.id, e.target.value) }}
                  >
                    <option value="">分配到组…</option>
                    {db.groups.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                </li>
              ))}
            </ul>
          </div>
        )
      })()}
    </section>
  )
}
