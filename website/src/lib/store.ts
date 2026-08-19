import { useSyncExternalStore } from 'react'
import type { Account, Arch, Client, ClientGroup, DB, DesignParam, DesignType, Designer, Group, GroupAssignment, Notice, Order, OrderFile, OrderImage, PointTxn, ReworkRequest, ToothCode } from '../types/index.ts'
import { ARCH_LABELS, DESIGN_TYPES, MALONG_POINTS, URGENT_POINTS_PER_TOOTH, toothSort } from '../types/index.ts'

const KEY = 'muye-design-platform-v5'
const SESSION_KEY = 'muye-session-v1'

/* ---------------- 种子数据（演示用） ---------------- */

/* 种子数据：客户分组与匹配规则 */
function seedGroups() {
  const clientGroups: ClientGroup[] = [
    { id: 'cg-nb', name: '宁波地区', note: '明州+恒美', createdAt: '2026-02-01T09:00:00' },
    { id: 'cg-hz', name: '杭州地区', note: '', createdAt: '2026-06-01T09:00:00' },
  ]
  const assignments: GroupAssignment[] = [
    { id: 'ga-1', clientGroupId: 'cg-nb', designerGroupId: 'g-a', createdAt: '2026-02-01T09:00:00' },
    { id: 'ga-2', clientGroupId: 'cg-nb', designerGroupId: 'g-b', createdAt: '2026-02-01T09:00:00' },
    { id: 'ga-3', clientGroupId: 'cg-hz', designerGroupId: 'g-c', createdAt: '2026-06-01T09:00:00' },
    { id: 'ga-4', clientGroupId: 'cg-hz', designerGroupId: 'g-d', createdAt: '2026-06-01T09:00:00' },
  ]
  return { clientGroups, assignments }
}

function seed(): DB {
  const groups: Group[] = [
    { id: 'g-a', name: 'A 组 · 灵犀', leaderId: 'd-li', note: '白班·主攻全瓷冠' },
    { id: 'g-b', name: 'B 组 · 匠心', leaderId: 'd-zhao', note: '夜班·全能型' },
    { id: 'g-c', name: 'C 组 · 精工', note: '周末组·专攻即刻' },
    { id: 'g-d', name: 'D 组 · 速琢', note: '机动组' },
  ]
  const designers: Designer[] = [
    { id: 'd-li', name: '李二', phone: '13800000001', idCard: '3301**********0011', certNo: 'JG-2019-0042', groupId: 'g-a', createdAt: '2026-03-02T09:00:00' },
    { id: 'd-wang', name: '王五', phone: '13800000002', idCard: '3301**********0022', groupId: 'g-a', createdAt: '2026-03-05T09:00:00' },
    { id: 'd-zhao', name: '赵六', phone: '13800000003', idCard: '3301**********0033', certNo: 'JG-2021-0117', groupId: 'g-b', createdAt: '2026-03-11T09:00:00' },
    { id: 'd-sun', name: '孙七', phone: '13800000004', idCard: '3301**********0044', groupId: 'g-b', createdAt: '2026-04-02T09:00:00' },
    { id: 'd-zhou', name: '周八', phone: '13800000005', idCard: '3301**********0055', groupId: 'g-c', createdAt: '2026-05-16T09:00:00' },
  ]
  const { clientGroups, assignments } = seedGroups()
  const designParams: DesignParam[] = [
    { id: 'c-mingzhou', innerCrown: 0.02, occlusalCut: 0.1, proximalCut: -0.02 },
  ]
  const clients: Client[] = [
    { id: 'c-mingzhou', name: '明州口腔医院', phone: '0574-88000001', kind: 'hospital', points: 361, clientGroupId: 'cg-nb', createdAt: '2026-02-10T09:00:00' },
    { id: 'c-hengmei', name: '恒美义齿加工厂', phone: '0574-88000002', kind: 'factory', points: 1140, clientGroupId: 'cg-nb', createdAt: '2026-02-18T09:00:00' },
    { id: 'c-yahe', name: '雅禾口腔门诊部', phone: '0574-88000003', kind: 'hospital', points: 95, clientGroupId: 'cg-hz', createdAt: '2026-06-01T09:00:00' },
  ]
  const orders: Order[] = [
    {
      id: 'o-001', no: 'MY-260702-001', clientId: 'c-mingzhou', designerId: 'd-li',
      type: 'jike', urgent: false, teeth: ['16', '17'], requirement: '右上后牙即刻负重，咬合略低开，邻接正常。',
      scanFiles: [{ name: '右上后牙-扫描.stl' }], images: [{ name: '口内照-右上.jpg' }, { name: 'CT截图.jpg' }], designFiles: [{ name: 'MY-260702-001-上颌.stl' }, { name: 'MY-260702-001-咬合记录.pdf' }],
      status: 'completed', points: 16, isRework: false, reworkCount: 0,
      createdAt: '2026-07-02T09:20:00', acceptedAt: '2026-07-02T09:35:00', completedAt: '2026-07-02T11:05:00',
    },
    {
      id: 'o-002', no: 'MY-260706-002', clientId: 'c-hengmei', designerId: 'd-zhao',
      type: 'quanci', urgent: false, teeth: ['11', '21'], requirement: '前牙美学区全瓷冠，颜色 A2，注意切端半透明感。',
      scanFiles: [{ name: '前牙区-扫描.stl' }], images: [{ name: '比色照.jpg' }], designFiles: [{ name: 'MY-260706-002-冠.stl' }],
      status: 'completed', points: 10, isRework: false, reworkCount: 1, reworkReason: '边缘线需上移 0.5mm',
      createdAt: '2026-07-06T14:00:00', acceptedAt: '2026-07-06T14:12:00', completedAt: '2026-07-07T10:40:00',
    },
    {
      id: 'o-003', no: 'MY-260711-003', clientId: 'c-hengmei', designerId: 'd-wang',
      type: 'tiemian', urgent: true, teeth: ['UR2', '11', '21', 'UL2'], requirement: '上前牙四颗贴面，患者要求自然偏白，加急件。',
      scanFiles: [{ name: '上前牙-扫描.stl' }], images: [{ name: '微笑照.jpg' }, { name: '模型扫描.jpg' }], designFiles: [],
      status: 'designing', points: 60, isRework: false, reworkCount: 0,
      createdAt: '2026-07-11T10:00:00', acceptedAt: '2026-07-11T10:08:00',
    },
    {
      id: 'o-004', no: 'MY-260718-004', clientId: 'c-yahe',
      type: 'jike', urgent: false, teeth: ['36'], requirement: '左下第一磨牙即刻设计，颊侧骨壁完整。',
      scanFiles: [{ name: '左下六-扫描.stl' }], images: [{ name: '口内照-左下.jpg' }], designFiles: [],
      status: 'pending', points: 8, isRework: false, reworkCount: 0,
      createdAt: '2026-07-18T16:30:00',
    },
    {
      id: 'o-005', no: 'MY-260721-005', clientId: 'c-mingzhou', designerId: 'd-zhou',
      type: 'quanci', urgent: false, teeth: ['46'], requirement: '右下六基台上部冠，种植系统 ITI RN。',
      scanFiles: [{ name: '右下六-扫描.stl' }], images: [{ name: '基台照.jpg' }], designFiles: [{ name: 'MY-260721-005-基台冠.stl' }],
      status: 'rework', points: 5, isRework: true, reworkCount: 1, reworkReason: '咬合偏高，请降低约 0.3mm 后重新提交',
      createdAt: '2026-07-21T09:00:00', acceptedAt: '2026-07-21T09:20:00', completedAt: '2026-07-22T15:00:00',
    },
    {
      id: 'o-006', no: 'MY-260728-006', clientId: 'c-hengmei',
      type: 'malong', urgent: false, teeth: [], custom: true, arch: 'upper',
      requirement: '上颌马龙桥架，All-on-6，注意桥架龈端卫生间隙。',
      scanFiles: [{ name: '上颌-扫描.stl' }, { name: '对颌-扫描.stl' }, { name: '咬合记录.stl' }],
      images: [{ name: '口内照-正面.jpg' }, { name: '口内照-侧面.jpg' }, { name: 'CT全景.jpg' }], designFiles: [],
      status: 'pending', points: 80, isRework: false, reworkCount: 0,
      createdAt: '2026-07-28T10:30:00',
    },
    {
      id: 'o-007', no: 'MY-260729-007', clientId: 'c-mingzhou', designerId: 'd-li',
      type: 'quanci', urgent: false, teeth: [], custom: true, customCount: 25,
      requirement: '全瓷冠 25 颗批量设计，色号以 A2 为主，详见照片。',
      scanFiles: [{ name: '批量模型-01.stl' }, { name: '批量模型-02.stl' }],
      images: [{ name: '比色照-1.jpg' }, { name: '比色照-2.jpg' }], designFiles: [],
      status: 'designing', points: 125, isRework: false, reworkCount: 0,
      createdAt: '2026-07-29T14:00:00', acceptedAt: '2026-07-29T14:20:00',
    },
  ]
  const txns: PointTxn[] = [
    { id: 't-001', clientId: 'c-mingzhou', delta: 500, balance: 500, reason: '积分充值', createdAt: '2026-07-01T09:00:00' },
    { id: 't-002', clientId: 'c-mingzhou', delta: -16, balance: 484, reason: '订单 MY-260702-001 提交预扣 · 即刻设计 2 颗', orderId: 'o-001', createdAt: '2026-07-02T11:05:00' },
    { id: 't-003', clientId: 'c-hengmei', delta: 1300, balance: 1300, reason: '积分充值', createdAt: '2026-07-01T09:00:00' },
    { id: 't-004', clientId: 'c-hengmei', delta: -10, balance: 1290, reason: '订单 MY-260706-002 提交预扣 · 全瓷冠 2 颗', orderId: 'o-002', createdAt: '2026-07-07T10:40:00' },
    { id: 't-005', clientId: 'c-yahe', delta: 100, balance: 100, reason: '积分充值', createdAt: '2026-07-15T09:00:00' },
    { id: 't-006', clientId: 'c-hengmei', delta: -80, balance: 1140, reason: '订单 MY-260728-006 提交预扣 · 马龙桥设计 · 上颌', orderId: 'o-006', createdAt: '2026-07-28T10:30:00' },
    { id: 't-007', clientId: 'c-mingzhou', delta: -125, balance: 361, reason: '订单 MY-260729-007 提交预扣 · 全瓷冠 / 基台上部冠 25 颗', orderId: 'o-007', createdAt: '2026-07-29T14:00:00' },
  ]
  const reworks: ReworkRequest[] = [
    { id: 'rw-001', orderId: 'o-005', clientId: 'c-mingzhou', reason: '咬合偏高，请降低约 0.3mm 后重新提交', images: [], status: 'pending', createdAt: '2026-07-22T16:10:00' },
  ]
  const notices: Notice[] = [
    { id: 'n-001', clientId: 'c-mingzhou', orderId: 'o-001', text: '订单 MY-260702-001 已完成，设计文件已可下载。', read: true, createdAt: '2026-07-02T11:05:00' },
    { id: 'n-002', clientId: 'c-hengmei', orderId: 'o-002', text: '订单 MY-260706-002 已完成，设计文件已可下载。', read: false, createdAt: '2026-07-07T10:40:00' },
  ]
  const accounts: Account[] = [
    { id: 'a-admin', username: 'admin', password: 'muye2026', role: 'admin', createdAt: '2026-02-01T09:00:00' },
    { id: 'a-mingzhou', username: 'mingzhou', password: '123456', role: 'client', clientId: 'c-mingzhou', createdAt: '2026-02-10T09:00:00' },
    { id: 'a-hengmei', username: 'hengmei', password: '123456', role: 'client', clientId: 'c-hengmei', createdAt: '2026-02-18T09:00:00' },
    { id: 'a-yahe', username: 'yahe', password: '123456', role: 'client', clientId: 'c-yahe', createdAt: '2026-06-01T09:00:00' },
    { id: 'a-li', username: 'li', password: '123456', role: 'designer', designerId: 'd-li', createdAt: '2026-03-02T09:00:00' },
    { id: 'a-wang', username: 'wang', password: '123456', role: 'designer', designerId: 'd-wang', createdAt: '2026-03-05T09:00:00' },
    { id: 'a-zhao', username: 'zhao', password: '123456', role: 'designer', designerId: 'd-zhao', createdAt: '2026-03-11T09:00:00' },
    { id: 'a-sun', username: 'sun', password: '123456', role: 'designer', designerId: 'd-sun', createdAt: '2026-04-02T09:00:00' },
    { id: 'a-zhou', username: 'zhou', password: '123456', role: 'designer', designerId: 'd-zhou', createdAt: '2026-05-16T09:00:00' },
  ]
  return { clients, designers, groups, clientGroups, assignments, orders, reworks, designParams, txns, notices, accounts, seq: 8 }
}

/* ---------------- 存取与订阅 ---------------- */

let db: DB = load()
const listeners = new Set<() => void>()

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as DB
  } catch { /* ignore */ }
  const fresh = seed()
  localStorage.setItem(KEY, JSON.stringify(fresh))
  return fresh
}

function commit(next: DB) {
  db = next
  localStorage.setItem(KEY, JSON.stringify(db))
  listeners.forEach((l) => l())
}

export function useDB(): DB {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb) },
    () => db,
  )
}

export function resetDB() { commit(seed()) }

/** 兼容旧版浏览器缓存数据：补齐后来新增的数据表，防止页面取 undefined.map 崩溃 */
function ensureDBShape() {
  let changed = false
  const next = { ...db }
  if (!Array.isArray(next.reworks)) { next.reworks = []; changed = true }
  if (!Array.isArray(next.designParams)) { next.designParams = []; changed = true }
  if (!Array.isArray(next.clientGroups)) { next.clientGroups = []; changed = true }
  if (!Array.isArray(next.assignments)) { next.assignments = []; changed = true }
  if (!Array.isArray(next.notices)) { next.notices = []; changed = true }
  if (!Array.isArray(next.accounts)) { next.accounts = []; changed = true }
  if (typeof next.seq !== 'number') { next.seq = next.orders.length + 1; changed = true }
  // 旧牙位编码（U/D + L/R + n）迁移为 FDI 双位数：上颌 右1n/左2n，下颌 右4n/左3n
  if (next.orders.some((o) => o.teeth.some((t) => /^[UD][LR][1-7]$/.test(t)))) {
    next.orders = next.orders.map((o) => ({
      ...o,
      teeth: o.teeth.map((t) => {
        const m = /^([UD])([LR])([1-7])$/.exec(t)
        if (!m) return t
        const q = m[1] === 'U' ? (m[2] === 'R' ? 1 : 2) : m[2] === 'R' ? 4 : 3
        return `${q}${m[3]}`
      }),
    }))
    changed = true
  }
  if (changed) commit(next)
}
ensureDBShape()

export { seedGroups }

/* ---------------- 工具 ---------------- */

const uid = () => Math.random().toString(36).slice(2, 10)

/* ---------------- 表单校验辅助 ---------------- */

/** 手机号格式校验（中国大陆 11 位数字） */
export function isValidPhone(val: string): boolean {
  return /^1\d{10}$/.test(val.trim())
}

/** 身份证号格式校验（18 位，最后一位可为 X/x） */
export function isValidIdCard(val: string): boolean {
  return /^\d{17}[\dXx]$/.test(val.trim())
}

/** 检查文件是否超出最大尺寸（MB） */
export function isFileTooLarge(file: File, maxMB: number): boolean {
  return file.size > maxMB * 1024 * 1024
}

export const now = () => new Date().toISOString()
export const monthOf = (iso: string) => iso.slice(0, 7)

/** 设计师对客户/账单仅显示 “X 师傅” */
export function designerAlias(d?: Designer): string {
  if (!d) return '未分配'
  return `${d.name.charAt(0)} 师傅`
}

/** 订单积分：马龙桥按件固定 80；其余类型 =（类型单价 + 加急附加）× 颗数（自定义模式按填写颗数） */
export function orderPoints(type: DesignType, urgent: boolean, teeth: ToothCode[], customCount?: number): number {
  if (type === 'malong') return MALONG_POINTS
  const per = DESIGN_TYPES[type].pointsPerTooth + (urgent && DESIGN_TYPES[type].urgentAllowed ? URGENT_POINTS_PER_TOOTH : 0)
  return per * (customCount ?? teeth.length)
}

/** 订单颗数/件数：马龙桥按件，自定义按填写颗数，其余按牙位数 */
export function orderCount(o: Order): number {
  if (o.type === 'malong') return 1
  return o.customCount ?? o.teeth.length
}

/** 订单范围展示文案：马龙桥显示上/下颌/全口，自定义显示颗数，其余显示牙位 */
export function scopeLabel(o: Order): string {
  if (o.type === 'malong') return `马龙桥 · ${o.arch ? ARCH_LABELS[o.arch] : '全口'}`
  if (o.custom) return `自定义 ${o.customCount ?? 0} 颗`
  return ''
}

export function groupOf(dbv: DB, id?: string): Group | undefined {
  if (!id) return undefined
  return dbv.groups.find((g) => g.id === id)
}

/* ---------------- 业务动作 ---------------- */

/** 快速创建设计师分组 */
export function registerDesignerGroup(name: string, note?: string): Group {
  const g: Group = { id: `g-${uid()}`, name: name.trim(), note: note?.trim() || '' }
  commit({ ...db, groups: [...db.groups, g] })
  return g
}

export function registerClient(name: string, phone: string, kind: Client['kind']): Client {
  const c: Client = { id: `c-${uid()}`, name, phone, kind, points: 0, createdAt: now() }
  commit({ ...db, clients: [...db.clients, c] })
  return c
}

export function registerDesigner(input: Omit<Designer, 'id' | 'createdAt'>): Designer {
  const d: Designer = { ...input, id: `d-${uid()}`, createdAt: now() }
  commit({ ...db, designers: [...db.designers, d] })
  return d
}

/** 提交订单：积分在提交时预扣；余额不足返回 null（界面提示“积分不足，请联系管理方充值”） */
export function createOrder(input: {
  clientId: string; type: DesignType; urgent: boolean; teeth: ToothCode[];
  custom?: boolean; customCount?: number; arch?: Arch; patient?: string;
  requirement: string; scanFiles: OrderFile[]; images: OrderImage[]
}): Order | null {
  const client = db.clients.find((c) => c.id === input.clientId)
  if (!client) return null
  const custom = input.type === 'malong' ? true : !!input.custom
  const points = orderPoints(input.type, input.urgent, input.teeth, custom ? input.customCount : undefined)
  if (client.points < points) return null

  const d = new Date()
  const stamp = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const no = `MY-${stamp}-${String(db.seq).padStart(3, '0')}`
  const o: Order = {
    id: `o-${uid()}`, no, clientId: input.clientId, type: input.type, urgent: input.urgent,
    teeth: custom ? [] : [...input.teeth].sort(toothSort),
    custom, customCount: custom && input.type !== 'malong' ? input.customCount : undefined,
    arch: input.type === 'malong' ? input.arch : undefined,
    patient: input.patient?.trim() || undefined,
    requirement: input.requirement,
    scanFiles: input.scanFiles, images: input.images,
    designFiles: [], status: 'pending', points,
    isRework: false, reworkCount: 0, createdAt: now(),
  }
  const scopeText = input.type === 'malong'
    ? `${DESIGN_TYPES[input.type].label} · ${input.arch ? ARCH_LABELS[input.arch] : '全口'}`
    : `${DESIGN_TYPES[input.type].label} ${custom ? input.customCount ?? 0 : input.teeth.length} 颗${input.urgent ? ' · 加急' : ''}`
  const balance = client.points - points
  const txn: PointTxn = {
    id: `t-${uid()}`, clientId: client.id, delta: -points, balance,
    reason: `订单 ${no} 提交预扣 · ${scopeText}`,
    orderId: o.id, createdAt: now(),
  }
  commit({
    ...db,
    orders: [o, ...db.orders],
    clients: db.clients.map((c) => (c.id === client.id ? { ...c, points: balance } : c)),
    txns: [txn, ...db.txns],
    seq: db.seq + 1,
  })
  checkUnassigned(o)
  return o
}

export function acceptOrder(orderId: string, designerId: string): boolean {
  const target = db.orders.find((x) => x.id === orderId)
  if (!target || target.status !== 'pending') return false
  commit({
    ...db,
    orders: db.orders.map((o) =>
      o.id === orderId && o.status === 'pending'
        ? { ...o, designerId, status: 'designing' as const, acceptedAt: now() }
        : o,
    ),
  })
  return true
}

/** 设计师提交设计文件完成订单（积分已在提交时预扣，此处不再扣）；返工重做后也从这里提交 */
export function submitDesign(orderId: string, files: OrderFile[]) {
  const order = db.orders.find((o) => o.id === orderId)
  if (!order || (order.status !== 'designing' && order.status !== 'rework')) return
  const wasRework = order.status === 'rework'
  const notice: Notice = {
    id: `n-${uid()}`, clientId: order.clientId, orderId,
    text: `订单 ${order.no} 已完成，设计文件已可下载。`, read: false, createdAt: now(),
  }
  commit({
    ...db,
    orders: db.orders.map((o) => (o.id === orderId ? { ...o, designFiles: files, status: 'completed' as const, completedAt: now(), reworkCount: wasRework ? o.reworkCount + 1 : o.reworkCount } : o)),
    notices: [notice, ...db.notices],
  })
}

/** 设计师退回：信息不全或数据有问题，退回给医院/加工厂 */
export function returnOrder(orderId: string, reason: string) {
  const order = db.orders.find((o) => o.id === orderId)
  if (!order) return
  const notice: Notice = {
    id: `n-${uid()}`, clientId: order.clientId, orderId,
    text: `订单 ${order.no} 被设计师退回：${reason}。请修改后重新提交。`, read: false, createdAt: now(),
  }
  commit({
    ...db,
    orders: db.orders.map((o) =>
      o.id === orderId && (o.status === 'pending' || o.status === 'designing' || o.status === 'rework')
        ? { ...o, status: 'returned' as const, returnReason: reason, returnedAt: now(), designerId: undefined, acceptedAt: undefined }
        : o,
    ),
    notices: [notice, ...db.notices],
  })
}

/** 客户修改后重新提交被退回的订单：按新牙位/新颗数重算积分，多退少补 */
export function resubmitOrder(orderId: string, updates: { teeth?: ToothCode[]; customCount?: number; requirement?: string }) {
  const order = db.orders.find((o) => o.id === orderId)
  if (!order || order.status !== 'returned') return
  const client = db.clients.find((c) => c.id === order.clientId)
  if (!client) return

  const teeth = updates.teeth ? [...updates.teeth].sort(toothSort) : order.teeth
  const customCount = updates.customCount ?? order.customCount
  const requirement = updates.requirement ?? order.requirement
  const newPoints = orderPoints(order.type, order.urgent, teeth, order.custom ? customCount : undefined)
  const diff = newPoints - order.points // 正数=补扣，负数=退回
  if (diff > 0 && client.points < diff) return // 补扣不足时不允许提交（界面同样拦截）

  const balance = client.points - diff
  const txns = diff !== 0
    ? [{
        id: `t-${Math.random().toString(36).slice(2, 10)}`, clientId: client.id, delta: -diff, balance,
        reason: diff > 0
          ? `订单 ${order.no} 重新提交补扣 · ${diff} 分`
          : `订单 ${order.no} 重新提交退回 · ${-diff} 分`,
        orderId, createdAt: now(),
      } as PointTxn, ...db.txns]
    : db.txns

  commit({
    ...db,
    orders: db.orders.map((o) =>
      o.id === orderId
        ? { ...o, teeth, customCount, requirement, points: newPoints, status: 'pending' as const, returnReason: undefined, createdAt: now() }
        : o,
    ),
    clients: db.clients.map((c) => (c.id === client.id ? { ...c, points: balance } : c)),
    txns,
  })
  const updated = db.orders.find((o) => o.id === orderId)
  if (updated) checkUnassigned(updated)
}

export function adjustPoints(clientId: string, delta: number, reason: string): boolean {
  const client = db.clients.find((c) => c.id === clientId)
  if (!client || delta === 0) return false
  const balance = client.points + delta
  if (balance < 0) return false // 积分不允许扣成负数
  const txn: PointTxn = {
    id: `t-${uid()}`, clientId, delta, balance,
    reason: reason || (delta > 0 ? '积分充值' : '积分扣减'), createdAt: now(),
  }
  commit({
    ...db,
    clients: db.clients.map((c) => (c.id === clientId ? { ...c, points: balance } : c)),
    txns: [txn, ...db.txns],
  })
  return true
}

export function renameGroup(groupId: string, name: string) {
  commit({ ...db, groups: db.groups.map((g) => (g.id === groupId ? { ...g, name } : g)) })
}

export function setGroupLeader(groupId: string, leaderId?: string) {
  commit({ ...db, groups: db.groups.map((g) => (g.id === groupId ? { ...g, leaderId } : g)) })
}

export function moveDesigner(designerId: string, groupId: string) {
  commit({
    ...db,
    designers: db.designers.map((d) => (d.id === designerId ? { ...d, groupId } : d)),
    groups: db.groups.map((g) => (g.leaderId === designerId && g.id !== groupId ? { ...g, leaderId: undefined } : g)),
  })
}


/** 单条消息标为已读 */
export function markNoticeRead(noticeId: string) {
  commit({ ...db, notices: db.notices.map((n) => (n.id === noticeId ? { ...n, read: true } : n)) })
}

export function markNoticesRead(clientId: string) {
  commit({ ...db, notices: db.notices.map((n) => (n.clientId === clientId ? { ...n, read: true } : n)) })
}

/* ---------------- 客户分组管理 ---------------- */

/** 获取客户所属分组 */
export function clientGroupOf(dbv: DB, clientId: string): ClientGroup | undefined {
  const client = dbv.clients.find((c) => c.id === clientId)
  if (!client?.clientGroupId) return undefined
  return dbv.clientGroups.find((cg) => cg.id === client.clientGroupId)
}

/** 获取某设计师组被匹配到的客户组 ID 列表 */
export function matchedClientGroupIds(dbv: DB, designerGroupId?: string): string[] {
  if (!designerGroupId) return []
  return dbv.assignments
    .filter((a) => a.designerGroupId === designerGroupId)
    .map((a) => a.clientGroupId)
}

/** 获取某客户组匹配到的设计师组 ID 列表 */
export function matchedDesignerGroupIds(dbv: DB, clientGroupId: string): string[] {
  return dbv.assignments
    .filter((a) => a.clientGroupId === clientGroupId)
    .map((a) => a.designerGroupId)
}

/** 接单大厅过滤后的订单：只显示该设计师所在组被匹配到的客户组的 order */
export function filterPoolOrders(dbv: DB, designerId: string): Order[] {
  const designer = dbv.designers.find((d) => d.id === designerId)
  if (!designer) return []
  const matched = matchedClientGroupIds(dbv, designer.groupId)
  if (matched.length === 0) return []
  return dbv.orders.filter((o) => {
    if (o.status !== 'pending') return false
    const client = dbv.clients.find((c) => c.id === o.clientId)
    if (!client?.clientGroupId) return false
    return matched.includes(client.clientGroupId)
  })
}

/** 创建客户分组 */
export function createClientGroup(name: string, note?: string): ClientGroup {
  const cg: ClientGroup = { id: `cg-${uid()}`, name: name.trim(), note: note?.trim() || '', createdAt: now() }
  commit({ ...db, clientGroups: [...db.clientGroups, cg] })
  return cg
}

/** 重命名客户分组 */
export function renameClientGroup(groupId: string, name: string, note?: string) {
  commit({
    ...db,
    clientGroups: db.clientGroups.map((cg) =>
      cg.id === groupId ? { ...cg, name: name.trim(), note: note?.trim() ?? cg.note } : cg
    ),
  })
}

/** 删除客户分组（需无成员） */
export function deleteClientGroup(groupId: string): boolean {
  const hasClients = db.clients.some((c) => c.clientGroupId === groupId)
  if (hasClients) return false
  commit({
    ...db,
    clientGroups: db.clientGroups.filter((cg) => cg.id !== groupId),
    assignments: db.assignments.filter((a) => a.clientGroupId !== groupId),
  })
  return true
}

/** 移动客户到指定分组 */
export function moveClient(clientId: string, clientGroupId?: string) {
  commit({
    ...db,
    clients: db.clients.map((c) => (c.id === clientId ? { ...c, clientGroupId } : c)),
  })
}

/** 更新设计师组备注 */
export function updateGroupNote(groupId: string, note: string) {
  commit({ ...db, groups: db.groups.map((g) => (g.id === groupId ? { ...g, note: note.trim() } : g)) })
}

/* ---------------- 分组匹配规则管理 ---------------- */

/** 添加匹配规则 */
export function addAssignment(clientGroupId: string, designerGroupId: string) {
  if (db.assignments.some((a) => a.clientGroupId === clientGroupId && a.designerGroupId === designerGroupId)) return
  const ga: GroupAssignment = {
    id: `ga-${uid()}`, clientGroupId, designerGroupId, createdAt: now(),
  }
  commit({ ...db, assignments: [...db.assignments, ga] })
}

/** 移除匹配规则 */
export function removeAssignment(clientGroupId: string, designerGroupId: string) {
  commit({
    ...db,
    assignments: db.assignments.filter(
      (a) => !(a.clientGroupId === clientGroupId && a.designerGroupId === designerGroupId)
    ),
  })
}

/** 管理端手动派发未分配订单：仅当客户组已匹配设计师组时重置为 pending 重新路由；否则返回 false 拦截 */
export function dispatchUnassignedOrder(orderId: string): boolean {
  const order = db.orders.find((o) => o.id === orderId)
  if (!order || order.status !== 'unassigned') return false
  const client = db.clients.find((c) => c.id === order.clientId)
  if (!client?.clientGroupId) return false
  if (matchedDesignerGroupIds(db, client.clientGroupId).length === 0) return false
  commit({
    ...db,
    orders: db.orders.map((o) => (o.id === orderId ? { ...o, status: 'pending' as const } : o)),
  })
  return true
}

/** 医院撤回订单：仅待接单/未分配（尚无设计师接单）可撤回，预扣积分全额退回并记流水；否则返回 false */
export function cancelOrder(orderId: string, clientId: string): boolean {
  const order = db.orders.find((o) => o.id === orderId)
  if (!order || order.clientId !== clientId) return false
  if (order.status !== 'pending' && order.status !== 'unassigned') return false
  const client = db.clients.find((c) => c.id === clientId)
  if (!client) return false
  const balance = client.points + order.points
  const txn: PointTxn = {
    id: `t-${uid()}`, clientId: client.id, delta: order.points, balance,
    reason: `订单 ${order.no} 撤回退回`,
    orderId: order.id, createdAt: now(),
  }
  commit({
    ...db,
    orders: db.orders.map((o) => (o.id === orderId ? { ...o, status: 'cancelled' as const, cancelledAt: now() } : o)),
    clients: db.clients.map((c) => (c.id === client.id ? { ...c, points: balance } : c)),
    txns: [txn, ...db.txns],
  })
  return true
}

/** 创建订单后检查：客户组无匹配设计师组→订单置为 unassigned（管理端在订单总览看到红色横幅提醒） */
function checkUnassigned(order: Order) {
  const client = db.clients.find((c) => c.id === order.clientId)
  if (!client?.clientGroupId) return
  if (matchedDesignerGroupIds(db, client.clientGroupId).length === 0) {
    commit({
      ...db,
      orders: db.orders.map((o) => o.id === order.id ? { ...o, status: 'unassigned' as const } : o),
    })
  }
}

/* ---------------- 设计参数管理 ---------------- */

export function getDesignParam(dbv: DB, clientId: string): DesignParam | undefined {
  return dbv.designParams.find((dp) => dp.id === clientId)
}

export function saveDesignParam(clientId: string, innerCrown: number, occlusalCut: number, proximalCut: number) {
  const existing = db.designParams.findIndex((dp) => dp.id === clientId)
  if (existing >= 0) {
    const next = [...db.designParams]
    next[existing] = { id: clientId, innerCrown, occlusalCut, proximalCut }
    commit({ ...db, designParams: next })
  } else {
    commit({ ...db, designParams: [...db.designParams, { id: clientId, innerCrown, occlusalCut, proximalCut }] })
  }
}

/* ---------------- 返工审核流程 ---------------- */

/** 客户申请返工：订单立即回到原设计师手上重做（不进接单大厅），管理端审核仅决定是否退积分 */
export function createReworkRequest(orderId: string, reason: string, images: OrderImage[]) {
  const order = db.orders.find((o) => o.id === orderId)
  if (!order || order.status !== 'completed') return
  commit({
    ...db,
    orders: db.orders.map((o) => o.id === orderId ? { ...o, status: 'rework' as const, isRework: true, reworkReason: reason } : o),
    reworks: [{ id: `rw-${uid()}`, orderId, clientId: order.clientId, reason, images, status: 'pending', createdAt: now() }, ...db.reworks],
  })
}

/** 管理端审核通过：登记 + 退还该订单积分；订单保持在原设计师手上重做 */
export function approveRework(reworkId: string) {
  const rw = db.reworks.find((r) => r.id === reworkId)
  if (!rw || rw.status !== 'pending') return
  const order = db.orders.find((o) => o.id === rw.orderId)
  if (!order) return
  const client = db.clients.find((c) => c.id === order.clientId)
  if (!client) return
  const balance = client.points + order.points
  const txn: PointTxn = {
    id: `t-${uid()}`, clientId: client.id, delta: order.points, balance,
    reason: `返工审核通过 · 订单 ${order.no} 退回 ${order.points} 分`,
    orderId: order.id, createdAt: now(),
  }
  const notice: Notice = {
    id: `n-${uid()}`, clientId: client.id, orderId: order.id,
    text: `返工审核通过：订单 ${order.no} 已退 ${order.points} 积分，订单由原设计师继续重做`,
    read: false, createdAt: now(),
  }
  commit({
    ...db,
    reworks: db.reworks.map((r) => r.id === reworkId ? { ...r, status: 'approved' as const, reviewedAt: now() } : r),
    clients: db.clients.map((c) => c.id === client.id ? { ...c, points: balance } : c),
    txns: [txn, ...db.txns],
    notices: [notice, ...db.notices],
  })
}

/** 管理端审核不通过：登记结果、不退积分；订单保持在原设计师手上重做 */
export function rejectRework(reworkId: string) {
  const rw = db.reworks.find((r) => r.id === reworkId)
  if (!rw || rw.status !== 'pending') return
  const order = db.orders.find((o) => o.id === rw.orderId)
  const notice: Notice | null = order
    ? {
        id: `n-${uid()}`, clientId: rw.clientId, orderId: rw.orderId,
        text: `返工审核未通过：订单 ${order.no} 不予退回积分，订单仍由原设计师修改，如有疑问请联系管理方`,
        read: false, createdAt: now(),
      }
    : null
  commit({
    ...db,
    reworks: db.reworks.map((r) => r.id === reworkId ? { ...r, status: 'rejected' as const, reviewedAt: now() } : r),
    notices: notice ? [notice, ...db.notices] : db.notices,
  })
}

export function getClientReworks(dbv: DB, clientId: string): ReworkRequest[] {
  return dbv.reworks.filter((r) => r.clientId === clientId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** 审核前客户撤销返工申请：删除申请，订单恢复已完成（若此前有过返工记录则保留返工标记） */
export function cancelReworkRequest(reworkId: string): boolean {
  const rw = db.reworks.find((r) => r.id === reworkId)
  if (!rw || rw.status !== 'pending') return false
  commit({
    ...db,
    reworks: db.reworks.filter((r) => r.id !== reworkId),
    orders: db.orders.map((o) => o.id === rw.orderId ? { ...o, status: 'completed' as const, reworkReason: undefined, isRework: o.reworkCount > 0 } : o),
  })
  return true
}

/** 审核前客户修改返工申请内容（留言与照片） */
export function updateReworkRequest(reworkId: string, reason: string, images: OrderImage[]): boolean {
  const rw = db.reworks.find((r) => r.id === reworkId)
  if (!rw || rw.status !== 'pending') return false
  commit({
    ...db,
    reworks: db.reworks.map((r) => r.id === reworkId ? { ...r, reason: reason.trim(), images } : r),
  })
  return true
}

/* ---------------- 订单搜索 ---------------- */

export function searchOrders(dbv: DB, role: 'client' | 'designer' | 'admin', id: string, query?: string, dateFrom?: string, dateTo?: string, status?: string): Order[] {
  let orders = dbv.orders
  if (role === 'client') orders = orders.filter((o) => o.clientId === id)
  else if (role === 'designer') orders = orders.filter((o) => o.designerId === id)
  if (query) {
    const q = query.toLowerCase()
    orders = orders.filter((o) => o.no.toLowerCase().includes(q) || (o.patient ?? '').toLowerCase().includes(q))
  }
  if (dateFrom) orders = orders.filter((o) => o.createdAt >= dateFrom)
  if (dateTo) orders = orders.filter((o) => o.createdAt <= dateTo + 'T23:59:59')
  if (status) orders = orders.filter((o) => o.status === status)
  return orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/* ---------------- 订单统计 ---------------- */

export function orderStats(dbv: DB, role: 'client' | 'designer' | 'admin', id: string) {
  let orders = dbv.orders
  if (role === 'client') orders = orders.filter((o) => o.clientId === id)
  else if (role === 'designer') orders = orders.filter((o) => o.designerId === id)
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
  const monthly = orders.filter((o) => o.createdAt.startsWith(thisMonth))
  const completed = orders.filter((o) => o.status === 'completed').length
  const reworked = orders.filter((o) => o.isRework).length
  const returned = orders.filter((o) => o.status === 'returned').length
  return { total: orders.length, monthly: monthly.length, completed, reworked, returned }
}

/* ---------------- 登录与账号管理 ---------------- */

export interface Session {
  role: 'client' | 'designer' | 'admin'
  clientId?: string
  designerId?: string
  username: string
}

export function authenticate(username: string, password: string): Session | null {
  const acc = db.accounts.find((a) => a.username === username.trim() && a.password === password)
  if (!acc) return null
  return { role: acc.role, clientId: acc.clientId, designerId: acc.designerId, username: acc.username }
}

export function saveSession(s: Session | null) {
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
  else localStorage.removeItem(SESSION_KEY)
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch { return null }
}

export function usernameTaken(username: string): boolean {
  return db.accounts.some((a) => a.username === username.trim())
}

/** 管理端创建账号：可挂在已有医院/设计师上，也可同时新建档案 */
export function createAccount(input: {
  username: string
  password: string
  role: 'client' | 'designer'
  clientId?: string
  designerId?: string
  newClient?: { name: string; phone: string; kind: Client['kind']; clientGroupId?: string }
  newDesigner?: { name: string; phone: string; idCard: string; certNo?: string; groupId?: string }
}): Account {
  let { clientId, designerId } = input
  let clients = db.clients
  let designers = db.designers
  if (input.newClient) {
    const c: Client = { id: `c-${uid()}`, name: input.newClient.name, phone: input.newClient.phone, kind: input.newClient.kind, points: 0, clientGroupId: input.newClient.clientGroupId, createdAt: now() }
    clients = [...clients, c]
    clientId = c.id
  }
  if (input.newDesigner) {
    const d: Designer = { id: `d-${uid()}`, ...input.newDesigner, createdAt: now() }
    designers = [...designers, d]
    designerId = d.id
  }
  const acc: Account = {
    id: `a-${uid()}`, username: input.username.trim(), password: input.password,
    role: input.role, clientId, designerId, createdAt: now(),
  }
  commit({ ...db, clients, designers, accounts: [...db.accounts, acc] })
  return acc
}

export function resetPassword(accountId: string, newPassword: string) {
  commit({ ...db, accounts: db.accounts.map((a) => (a.id === accountId ? { ...a, password: newPassword } : a)) })
}

export function deleteAccount(accountId: string) {
  commit({ ...db, accounts: db.accounts.filter((a) => a.id !== accountId || a.role === 'admin') })
}

/* ---------------- 文件读取：小文件内嵌 dataUrl 供下载，大文件仅记录文件名 ---------------- */

const EMBED_LIMIT = 1500 * 1024 // 单文件约 1.5MB

export function readOrderFile(file: File): Promise<OrderFile> {
  return new Promise((resolve) => {
    if (file.size > EMBED_LIMIT) {
      resolve({ name: file.name, size: file.size })
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve({ name: file.name, dataUrl: String(reader.result), size: file.size })
    reader.onerror = () => resolve({ name: file.name, size: file.size })
    reader.readAsDataURL(file)
  })
}
