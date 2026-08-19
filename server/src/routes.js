// 木叶设计平台后端 —— 业务 API
// 业务规则与前端演示版 website/src/lib/store.ts 一一对应，注释里标注对应函数名
import { Router } from 'express'
import {
  db, tx, uid, now, nextSeq,
  rowToOrder, rowToClient, rowToDesigner, rowToGroup, rowToClientGroup,
  rowToAssignment, rowToTxn, rowToNotice, rowToRework, rowToAccount, rowToParam,
} from './db.js'
import { hashPassword, verifyPassword, createSession, destroySession, requireAuth, requireRole } from './auth.js'

export const routes = Router()

/* ---------------- 设计类型与积分规则（对应 types/index.ts） ---------------- */

const DESIGN_TYPES = {
  jike: { label: '即刻设计', pointsPerTooth: 8, urgentAllowed: false },
  quanci: { label: '全瓷冠 / 基台上部冠', pointsPerTooth: 5, urgentAllowed: false },
  tiemian: { label: '贴面 / 嵌体设计', pointsPerTooth: 10, urgentAllowed: true },
  malong: { label: '马龙桥设计', pointsPerTooth: 0, urgentAllowed: false },
  jita: { label: '基台', pointsPerTooth: 5, urgentAllowed: false },
}
const MALONG_POINTS = 80
const URGENT_POINTS_PER_TOOTH = 5

/** 对应 orderPoints：马龙桥按件 80 分；其余按颗数，加急每颗 +5（仅贴面允许加急） */
function orderPoints(type, urgent, teeth, customCount) {
  if (type === 'malong') return MALONG_POINTS
  const t = DESIGN_TYPES[type]
  const per = t.pointsPerTooth + (urgent && t.urgentAllowed ? URGENT_POINTS_PER_TOOTH : 0)
  return per * (customCount ?? teeth.length)
}

const getOrder = (id) => db.prepare('SELECT * FROM orders WHERE id = ?').get(id)
const getClient = (id) => db.prepare('SELECT * FROM clients WHERE id = ?').get(id)
const getDesigner = (id) => db.prepare('SELECT * FROM designers WHERE id = ?').get(id)

/* ---------------- 分组路由（对应 matchedDesignerGroupIds / matchedClientGroupIds / filterPoolOrders） ---------------- */

function matchedDesignerGroupIds(clientGroupId) {
  return db.prepare('SELECT designer_group_id FROM assignments WHERE client_group_id = ?').all(clientGroupId).map((r) => r.designer_group_id)
}
function matchedClientGroupIds(designerGroupId) {
  if (!designerGroupId) return []
  return db.prepare('SELECT client_group_id FROM assignments WHERE designer_group_id = ?').all(designerGroupId).map((r) => r.client_group_id)
}
/** 该订单对该设计师是否可见（可抢） */
function orderVisibleToDesigner(order, designer) {
  if (!designer?.group_id) return false
  const client = getClient(order.client_id)
  if (!client?.client_group_id) return false
  return matchedClientGroupIds(designer.group_id).includes(client.client_group_id)
}
/** 对应 checkUnassigned：客户组无匹配设计师组 → 置为 unassigned */
function applyRouting(orderId) {
  const o = getOrder(orderId)
  const client = getClient(o.client_id)
  if (!client?.client_group_id || matchedDesignerGroupIds(client.client_group_id).length === 0) {
    db.prepare(`UPDATE orders SET status = 'unassigned' WHERE id = ? AND status = 'pending'`).run(orderId)
  }
}

function addNotice(clientId, orderId, text) {
  db.prepare('INSERT INTO notices (id, client_id, order_id, text, is_read, created_at) VALUES (?,?,?,?,0,?)')
    .run(`n-${uid()}`, clientId, orderId, text, now())
}

function addTxn(clientId, delta, balance, reason, orderId) {
  db.prepare('INSERT INTO point_txns (id, client_id, delta, balance, reason, order_id, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(`t-${uid()}`, clientId, delta, balance, reason, orderId ?? null, now())
}

/** 统一错误处理包装 */
const h = (fn) => (req, res) => {
  try {
    fn(req, res)
  } catch (e) {
    if (e?.expose) return res.status(400).json({ error: e.message })
    console.error('[muye] API 错误:', e)
    res.status(500).json({ error: '服务器内部错误，请稍后重试' })
  }
}
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg })

/* ==================== 登录 ==================== */

routes.post('/auth/login', h((req, res) => {
  const { username, password } = req.body || {}
  const acc = db.prepare('SELECT * FROM accounts WHERE username = ?').get(String(username || '').trim())
  if (!acc || !verifyPassword(password, acc.pass_hash)) return bad(res, '账号或密码错误', 401)
  const token = createSession(acc)
  res.json({ token, session: { role: acc.role, clientId: acc.client_id ?? undefined, designerId: acc.designer_id ?? undefined, username: acc.username } })
}))

routes.post('/auth/logout', requireAuth, h((req, res) => {
  destroySession(req.session.token)
  res.json({ ok: true })
}))

/* ==================== 初始化数据（按角色过滤） ==================== */

routes.get('/bootstrap', requireAuth, h((req, res) => {
  const s = req.session
  const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all().map(rowToOrder)
  const reworks = db.prepare('SELECT * FROM rework_requests ORDER BY created_at DESC').all().map(rowToRework)
  const txns = db.prepare('SELECT * FROM point_txns ORDER BY created_at DESC').all().map(rowToTxn)
  const notices = db.prepare('SELECT * FROM notices ORDER BY created_at DESC').all().map(rowToNotice)
  const params = db.prepare('SELECT * FROM design_params').all().map(rowToParam)
  const groups = db.prepare('SELECT * FROM groups').all().map(rowToGroup)
  const clientGroups = db.prepare('SELECT * FROM client_groups').all().map(rowToClientGroup)
  const assignments = db.prepare('SELECT * FROM assignments').all().map(rowToAssignment)

  if (s.role === 'admin') {
    return res.json({
      clients: db.prepare('SELECT * FROM clients').all().map(rowToClient),
      designers: db.prepare('SELECT * FROM designers').all().map(rowToDesigner),
      accounts: db.prepare('SELECT * FROM accounts').all().map(rowToAccount),
      groups, clientGroups, assignments, orders, reworks, txns, notices, designParams: params,
    })
  }
  if (s.role === 'client') {
    return res.json({
      clients: db.prepare('SELECT * FROM clients WHERE id = ?').all(s.clientId).map(rowToClient),
      designers: db.prepare('SELECT * FROM designers').all().map(rowToDesigner), // 仅用于显示设计师花名
      groups, clientGroups: [], assignments: [],
      orders: orders.filter((o) => o.clientId === s.clientId),
      reworks: reworks.filter((r) => r.clientId === s.clientId),
      txns: txns.filter((t) => t.clientId === s.clientId),
      notices: notices.filter((n) => n.clientId === s.clientId),
      designParams: params.filter((p) => p.id === s.clientId),
    })
  }
  // designer：看不到任何积分、医院信息，只看自己相关的订单与接单大厅
  const me = getDesigner(s.designerId)
  return res.json({
    clients: [], // 设计师不可见医院/加工厂信息（隐私规则）
    designers: db.prepare('SELECT * FROM designers').all().map(rowToDesigner),
    groups, clientGroups: [], assignments: [],
    orders: orders.filter((o) => o.designerId === s.designerId || (o.status === 'pending' && orderVisibleToDesigner(o, me))),
    reworks: [], txns: [], notices: [],
    designParams: params, // 设计参数设计师可见（对应演示版设计师端显示参数）
  })
}))

/* ==================== 订单 ==================== */

/** 对应 createOrder：校验 → 算分 → 事务（开单 + 预扣 + 流水 + 单号）→ 路由检查 */
routes.post('/orders', requireAuth, requireRole('client'), h((req, res) => {
  const { type, urgent, teeth, custom, customCount, arch, patient, requirement, scanFiles, images } = req.body || {}
  const t = DESIGN_TYPES[type]
  if (!t) return bad(res, '设计类型不正确')
  const isCustom = type === 'malong' ? true : !!custom
  const teethArr = Array.isArray(teeth) ? teeth.map(String) : []
  if (!isCustom && teethArr.length === 0) return bad(res, '请选择牙位')
  if (isCustom && type !== 'malong' && (!Number.isInteger(customCount) || customCount < 1)) return bad(res, '请填写自定义颗数')
  if (!Array.isArray(scanFiles) || scanFiles.length === 0) return bad(res, '请上传口扫文件')
  if (!Array.isArray(images) || images.length === 0) return bad(res, '请至少上传一张照片')
  if (type === 'malong' && !['upper', 'lower', 'full'].includes(arch)) return bad(res, '请选择马龙桥范围（上颌/下颌/全口）')

  const points = orderPoints(type, !!urgent, teethArr, isCustom && type !== 'malong' ? customCount : undefined)
  const client = getClient(req.session.clientId)
  if (!client) return bad(res, '客户不存在', 403)
  if (client.points < points) return bad(res, '积分不足，请联系管理方充值')

  const orderId = `o-${uid()}`
  const result = tx(() => {
    const d = new Date()
    const p = (n) => String(n).padStart(2, '0')
    const stamp = `${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}`
    const no = `MY-${stamp}-${String(nextSeq()).padStart(3, '0')}`
    const fresh = getClient(client.id) // 事务内重读，防并发超扣
    if (fresh.points < points) throw Object.assign(new Error('积分不足'), { expose: true })
    const balance = fresh.points - points
    db.prepare(`INSERT INTO orders (id, no, client_id, patient, type, urgent, teeth, custom, custom_count, arch, requirement, scan_files, images, design_files, status, points, is_rework, rework_count, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'[]','pending',?,0,0,?)`)
      .run(orderId, no, client.id, patient?.trim() || null, type, urgent ? 1 : 0,
        JSON.stringify(isCustom ? [] : teethArr.map(Number).sort((a, b) => a - b).map(String)),
        isCustom ? 1 : 0, isCustom && type !== 'malong' ? customCount : null, type === 'malong' ? arch : null,
        String(requirement || ''), JSON.stringify(scanFiles), JSON.stringify(images), points, now())
    db.prepare('UPDATE clients SET points = ? WHERE id = ?').run(balance, client.id)
    addTxn(client.id, -points, balance, `订单 ${no} 提交预扣`, orderId)
    return no
  })
  applyRouting(orderId)
  const row = getOrder(orderId)
  res.json({ order: rowToOrder(row), no: result, unassigned: row.status === 'unassigned' })
}))

/** 对应 acceptOrder：原子 UPDATE 实现抢单锁，同一订单只有一人能抢到 */
routes.post('/orders/:id/accept', requireAuth, requireRole('designer'), h((req, res) => {
  const order = getOrder(req.params.id)
  if (!order) return bad(res, '订单不存在', 404)
  const me = getDesigner(req.session.designerId)
  if (!me) return bad(res, '设计师不存在', 403)
  if (!orderVisibleToDesigner(order, me)) return bad(res, '该订单不在你所在组的匹配范围内')
  const r = db.prepare(`UPDATE orders SET designer_id = ?, status = 'designing', accepted_at = ? WHERE id = ? AND status = 'pending'`)
    .run(me.id, now(), order.id)
  if (r.changes === 0) return bad(res, '手慢了，该订单已被其他设计师接走', 409)
  res.json({ ok: true })
}))

/** 对应 submitDesign：设计师提交设计文件完成订单（积分提交时已预扣，此处不再扣）；返工重做的订单也由原设计师从此提交 */
routes.post('/orders/:id/submit-design', requireAuth, requireRole('designer'), h((req, res) => {
  const { files } = req.body || {}
  if (!Array.isArray(files) || files.length === 0) return bad(res, '请上传设计文件')
  const order = getOrder(req.params.id)
  if (!order) return bad(res, '订单不存在', 404)
  if (order.designer_id !== req.session.designerId) return bad(res, '这不是你的订单', 403)
  if (order.status !== 'designing' && order.status !== 'rework') return bad(res, '订单当前状态不能提交设计稿')
  const wasRework = order.status === 'rework'
  tx(() => {
    db.prepare(`UPDATE orders SET design_files = ?, status = 'completed', completed_at = ?, rework_count = rework_count + ? WHERE id = ?`)
      .run(JSON.stringify(files), now(), wasRework ? 1 : 0, order.id)
    addNotice(order.client_id, order.id, `订单 ${order.no} 已完成，设计文件已可下载。`)
  })
  res.json({ ok: true })
}))

/** 对应 returnOrder：设计师退回（信息不全/数据有问题），退回给医院 */
routes.post('/orders/:id/return', requireAuth, requireRole('designer'), h((req, res) => {
  const reason = String(req.body?.reason || '').trim()
  if (!reason) return bad(res, '请填写退回原因')
  const order = getOrder(req.params.id)
  if (!order) return bad(res, '订单不存在', 404)
  if (!['pending', 'designing', 'rework'].includes(order.status)) return bad(res, '订单当前状态不能退回')
  if ((order.status === 'designing' || order.status === 'rework') && order.designer_id !== req.session.designerId) return bad(res, '这不是你的订单', 403)
  if (order.status === 'pending' && !orderVisibleToDesigner(order, getDesigner(req.session.designerId))) return bad(res, '该订单不在你所在组的匹配范围内')
  tx(() => {
    db.prepare(`UPDATE orders SET status = 'returned', return_reason = ?, returned_at = ?, designer_id = NULL, accepted_at = NULL WHERE id = ?`)
      .run(reason, now(), order.id)
    addNotice(order.client_id, order.id, `订单 ${order.no} 被设计师退回：${reason}。请修改后重新提交。`)
  })
  res.json({ ok: true })
}))

/** 对应 resubmitOrder：退回订单修改后重新提交，按新牙位/颗数重算积分，多退少补 */
routes.post('/orders/:id/resubmit', requireAuth, requireRole('client'), h((req, res) => {
  const order = getOrder(req.params.id)
  if (!order) return bad(res, '订单不存在', 404)
  if (order.client_id !== req.session.clientId) return bad(res, '这不是你的订单', 403)
  if (order.status !== 'returned') return bad(res, '只有被退回的订单才能重新提交')
  const teeth = Array.isArray(req.body?.teeth) ? req.body.teeth.map(String) : JSON.parse(order.teeth)
  const customCount = req.body?.customCount ?? order.custom_count ?? undefined
  const requirement = req.body?.requirement ?? order.requirement
  const newPoints = orderPoints(order.type, !!order.urgent, teeth, order.custom ? customCount : undefined)
  const diff = newPoints - order.points
  const client = getClient(order.client_id)
  if (diff > 0 && client.points < diff) return bad(res, '积分不足，请联系管理方充值')
  tx(() => {
    const fresh = getClient(client.id)
    if (diff > 0 && fresh.points < diff) throw Object.assign(new Error('积分不足'), { expose: true })
    const balance = fresh.points - diff
    db.prepare(`UPDATE orders SET teeth = ?, custom_count = ?, requirement = ?, points = ?, status = 'pending', return_reason = NULL, created_at = ? WHERE id = ?`)
      .run(JSON.stringify(teeth), customCount ?? null, String(requirement), newPoints, now(), order.id)
    if (diff !== 0) {
      db.prepare('UPDATE clients SET points = ? WHERE id = ?').run(balance, client.id)
      addTxn(client.id, -diff, balance, diff > 0 ? `订单 ${order.no} 重新提交补扣 · ${diff} 分` : `订单 ${order.no} 重新提交退回 · ${-diff} 分`, order.id)
    }
  })
  applyRouting(order.id)
  res.json({ ok: true })
}))

/** 对应 cancelOrder：待接单/未分配可撤回，预扣积分全额退回 */
routes.post('/orders/:id/cancel', requireAuth, requireRole('client'), h((req, res) => {
  const order = getOrder(req.params.id)
  if (!order) return bad(res, '订单不存在', 404)
  if (order.client_id !== req.session.clientId) return bad(res, '这不是你的订单', 403)
  if (!['pending', 'unassigned'].includes(order.status)) return bad(res, '设计师已接单，订单无法撤回')
  tx(() => {
    const client = getClient(order.client_id)
    const balance = client.points + order.points
    db.prepare(`UPDATE orders SET status = 'cancelled', cancelled_at = ? WHERE id = ?`).run(now(), order.id)
    db.prepare('UPDATE clients SET points = ? WHERE id = ?').run(balance, client.id)
    addTxn(client.id, order.points, balance, `订单 ${order.no} 撤回退回`, order.id)
  })
  res.json({ ok: true })
}))

/* ==================== 返工 ==================== */

/** 对应 createReworkRequest：订单立即回到原设计师手上重做（不进接单大厅），管理端审核仅决定是否退积分 */
routes.post('/orders/:id/rework-requests', requireAuth, requireRole('client'), h((req, res) => {
  const reason = String(req.body?.reason || '').trim()
  const images = Array.isArray(req.body?.images) ? req.body.images : []
  if (!reason) return bad(res, '请填写返工原因')
  const order = getOrder(req.params.id)
  if (!order) return bad(res, '订单不存在', 404)
  if (order.client_id !== req.session.clientId) return bad(res, '这不是你的订单', 403)
  if (order.status !== 'completed') return bad(res, '只有已完成的订单才能申请返工')
  tx(() => {
    db.prepare(`UPDATE orders SET status = 'rework', is_rework = 1, rework_reason = ? WHERE id = ?`).run(reason, order.id)
    db.prepare('INSERT INTO rework_requests (id, order_id, client_id, reason, images, status, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(`rw-${uid()}`, order.id, order.client_id, reason, JSON.stringify(images), 'pending', now())
  })
  res.json({ ok: true })
}))

/** 对应 approveRework：登记 + 退还该订单积分；订单保持在原设计师手上重做，不回接单大厅 */
routes.post('/reworks/:id/approve', requireAuth, requireRole('admin'), h((req, res) => {
  const rw = db.prepare('SELECT * FROM rework_requests WHERE id = ?').get(req.params.id)
  if (!rw || rw.status !== 'pending') return bad(res, '该申请不存在或已审核')
  const order = getOrder(rw.order_id)
  if (!order) return bad(res, '订单不存在', 404)
  tx(() => {
    const client = getClient(order.client_id)
    const balance = client.points + order.points
    db.prepare(`UPDATE rework_requests SET status = 'approved', reviewed_at = ? WHERE id = ?`).run(now(), rw.id)
    db.prepare('UPDATE clients SET points = ? WHERE id = ?').run(balance, client.id)
    addTxn(client.id, order.points, balance, `返工审核通过 · 订单 ${order.no} 退回 ${order.points} 分`, order.id)
    addNotice(client.id, order.id, `返工审核通过：订单 ${order.no} 已退 ${order.points} 积分，订单由原设计师继续重做`)
  })
  res.json({ ok: true })
}))

/** 对应 rejectRework：登记结果、不退积分；订单保持在原设计师手上重做 */
routes.post('/reworks/:id/reject', requireAuth, requireRole('admin'), h((req, res) => {
  const rw = db.prepare('SELECT * FROM rework_requests WHERE id = ?').get(req.params.id)
  if (!rw || rw.status !== 'pending') return bad(res, '该申请不存在或已审核')
  const order = getOrder(rw.order_id)
  tx(() => {
    db.prepare(`UPDATE rework_requests SET status = 'rejected', reviewed_at = ? WHERE id = ?`).run(now(), rw.id)
    if (order) {
      addNotice(rw.client_id, rw.order_id, `返工审核未通过：订单 ${order.no} 不予退回积分，订单仍由原设计师修改，如有疑问请联系管理方`)
    }
  })
  res.json({ ok: true })
}))

/** 对应 cancelReworkRequest：审核前客户撤销，订单恢复已完成（有过返工记录则保留返工标记） */
routes.delete('/reworks/:id', requireAuth, requireRole('client'), h((req, res) => {
  const rw = db.prepare('SELECT * FROM rework_requests WHERE id = ?').get(req.params.id)
  if (!rw || rw.status !== 'pending') return bad(res, '该申请不存在或已审核')
  if (rw.client_id !== req.session.clientId) return bad(res, '这不是你的申请', 403)
  tx(() => {
    db.prepare('DELETE FROM rework_requests WHERE id = ?').run(rw.id)
    db.prepare(`UPDATE orders SET status = 'completed', rework_reason = NULL, is_rework = CASE WHEN rework_count > 0 THEN 1 ELSE 0 END WHERE id = ?`).run(rw.order_id)
  })
  res.json({ ok: true })
}))

/** 对应 updateReworkRequest：审核前客户修改 */
routes.patch('/reworks/:id', requireAuth, requireRole('client'), h((req, res) => {
  const rw = db.prepare('SELECT * FROM rework_requests WHERE id = ?').get(req.params.id)
  if (!rw || rw.status !== 'pending') return bad(res, '该申请不存在或已审核')
  if (rw.client_id !== req.session.clientId) return bad(res, '这不是你的申请', 403)
  const reason = String(req.body?.reason || '').trim()
  if (!reason) return bad(res, '请填写返工原因')
  const images = Array.isArray(req.body?.images) ? req.body.images : []
  db.prepare('UPDATE rework_requests SET reason = ?, images = ? WHERE id = ?').run(reason, JSON.stringify(images), rw.id)
  res.json({ ok: true })
}))

/* ==================== 消息 ==================== */

routes.post('/notices/read-all', requireAuth, requireRole('client'), h((req, res) => {
  db.prepare('UPDATE notices SET is_read = 1 WHERE client_id = ?').run(req.session.clientId)
  res.json({ ok: true })
}))

/* ==================== 管理端 ==================== */

/** 对应 adjustPoints：管理端充值/扣减积分（微信转账后手动加积分） */
routes.post('/admin/points', requireAuth, requireRole('admin'), h((req, res) => {
  const { clientId, delta, reason } = req.body || {}
  const d = parseInt(delta, 10)
  if (!Number.isInteger(d) || d === 0) return bad(res, '积分变动数量不正确')
  const client = getClient(clientId)
  if (!client) return bad(res, '客户不存在', 404)
  tx(() => {
    const fresh = getClient(clientId)
    const balance = fresh.points + d
    if (balance < 0) throw Object.assign(new Error('扣减后积分不能为负'), { expose: true })
    db.prepare('UPDATE clients SET points = ? WHERE id = ?').run(balance, clientId)
    addTxn(clientId, d, balance, String(reason || '').trim() || (d > 0 ? '积分充值' : '积分扣减'), null)
  })
  res.json({ ok: true })
}))

/** 对应 createAccount：可挂已有客户/设计师，或同时新建 */
routes.post('/admin/accounts', requireAuth, requireRole('admin'), h((req, res) => {
  const { username, password, role, clientId, designerId, newClient, newDesigner } = req.body || {}
  if (!username?.trim() || !password) return bad(res, '请填写账号和密码')
  if (!['client', 'designer'].includes(role)) return bad(res, '角色不正确')
  if (db.prepare('SELECT id FROM accounts WHERE username = ?').get(username.trim())) return bad(res, '账号名已存在')
  const accId = `a-${uid()}`
  tx(() => {
    let cid = clientId ?? null
    let did = designerId ?? null
    if (newClient) {
      cid = `c-${uid()}`
      db.prepare('INSERT INTO clients (id, name, phone, kind, points, client_group_id, created_at) VALUES (?,?,?,?,0,?,?)')
        .run(cid, newClient.name, newClient.phone, newClient.kind, newClient.clientGroupId ?? null, now())
    }
    if (newDesigner) {
      did = `d-${uid()}`
      db.prepare('INSERT INTO designers (id, name, phone, id_card, cert_no, group_id, created_at) VALUES (?,?,?,?,?,?,?)')
        .run(did, newDesigner.name, newDesigner.phone, newDesigner.idCard, newDesigner.certNo ?? null, newDesigner.groupId ?? null, now())
    }
    db.prepare('INSERT INTO accounts (id, username, pass_hash, role, client_id, designer_id, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(accId, username.trim(), hashPassword(password), role, cid, did, now())
  })
  res.json({ ok: true, id: accId })
}))

/** 对应 resetPassword */
routes.post('/admin/accounts/:id/reset-password', requireAuth, requireRole('admin'), h((req, res) => {
  const { password } = req.body || {}
  if (!password) return bad(res, '请填写新密码')
  const r = db.prepare('UPDATE accounts SET pass_hash = ? WHERE id = ?').run(hashPassword(password), req.params.id)
  if (r.changes === 0) return bad(res, '账号不存在', 404)
  db.prepare('DELETE FROM sessions WHERE account_id = ?').run(req.params.id) // 改密后强制重新登录
  res.json({ ok: true })
}))

/** 对应 deleteAccount：admin 账号不可删 */
routes.delete('/admin/accounts/:id', requireAuth, requireRole('admin'), h((req, res) => {
  const acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id)
  if (!acc) return bad(res, '账号不存在', 404)
  if (acc.role === 'admin') return bad(res, '管理账号不能删除')
  tx(() => {
    db.prepare('DELETE FROM sessions WHERE account_id = ?').run(acc.id)
    db.prepare('DELETE FROM accounts WHERE id = ?').run(acc.id)
  })
  res.json({ ok: true })
}))

/* ---- 设计师分组（对应 registerDesignerGroup / renameGroup / setGroupLeader / updateGroupNote / moveDesigner） ---- */

routes.post('/admin/groups', requireAuth, requireRole('admin'), h((req, res) => {
  const name = String(req.body?.name || '').trim()
  if (!name) return bad(res, '请填写分组名')
  const id = `g-${uid()}`
  db.prepare('INSERT INTO groups (id, name, leader_id, note) VALUES (?,?,NULL,?)').run(id, name, String(req.body?.note || '').trim())
  res.json({ ok: true, id })
}))

routes.patch('/admin/groups/:id', requireAuth, requireRole('admin'), h((req, res) => {
  const g = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id)
  if (!g) return bad(res, '分组不存在', 404)
  const name = req.body?.name ?? g.name
  const leaderId = req.body?.leaderId !== undefined ? req.body.leaderId : g.leader_id
  const note = req.body?.note !== undefined ? String(req.body.note).trim() : g.note
  db.prepare('UPDATE groups SET name = ?, leader_id = ?, note = ? WHERE id = ?').run(String(name).trim(), leaderId ?? null, note, g.id)
  res.json({ ok: true })
}))

routes.post('/admin/designers/:id/group', requireAuth, requireRole('admin'), h((req, res) => {
  const r = db.prepare('UPDATE designers SET group_id = ? WHERE id = ?').run(req.body?.groupId ?? null, req.params.id)
  if (r.changes === 0) return bad(res, '设计师不存在', 404)
  res.json({ ok: true })
}))

/* ---- 客户分组（对应 createClientGroup / renameClientGroup / deleteClientGroup / moveClient） ---- */

routes.post('/admin/client-groups', requireAuth, requireRole('admin'), h((req, res) => {
  const name = String(req.body?.name || '').trim()
  if (!name) return bad(res, '请填写分组名')
  const id = `cg-${uid()}`
  db.prepare('INSERT INTO client_groups (id, name, note, created_at) VALUES (?,?,?,?)').run(id, name, String(req.body?.note || '').trim(), now())
  res.json({ ok: true, id })
}))

routes.patch('/admin/client-groups/:id', requireAuth, requireRole('admin'), h((req, res) => {
  const g = db.prepare('SELECT * FROM client_groups WHERE id = ?').get(req.params.id)
  if (!g) return bad(res, '分组不存在', 404)
  const name = req.body?.name !== undefined ? String(req.body.name).trim() : g.name
  const note = req.body?.note !== undefined ? String(req.body.note).trim() : g.note
  db.prepare('UPDATE client_groups SET name = ?, note = ? WHERE id = ?').run(name, note, g.id)
  res.json({ ok: true })
}))

routes.delete('/admin/client-groups/:id', requireAuth, requireRole('admin'), h((req, res) => {
  const used = db.prepare('SELECT COUNT(*) AS n FROM clients WHERE client_group_id = ?').get(req.params.id).n
  if (used > 0) return bad(res, '该分组下还有客户，请先移出')
  db.prepare('DELETE FROM assignments WHERE client_group_id = ?').run(req.params.id)
  db.prepare('DELETE FROM client_groups WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
}))

routes.post('/admin/clients/:id/group', requireAuth, requireRole('admin'), h((req, res) => {
  const r = db.prepare('UPDATE clients SET client_group_id = ? WHERE id = ?').run(req.body?.clientGroupId ?? null, req.params.id)
  if (r.changes === 0) return bad(res, '客户不存在', 404)
  res.json({ ok: true })
}))

/* ---- 分组匹配（对应 addAssignment / removeAssignment） ---- */

routes.post('/admin/assignments', requireAuth, requireRole('admin'), h((req, res) => {
  const { clientGroupId, designerGroupId } = req.body || {}
  if (!clientGroupId || !designerGroupId) return bad(res, '参数不完整')
  db.prepare('INSERT OR IGNORE INTO assignments (id, client_group_id, designer_group_id, created_at) VALUES (?,?,?,?)')
    .run(`as-${uid()}`, clientGroupId, designerGroupId, now())
  res.json({ ok: true })
}))

routes.delete('/admin/assignments/:id', requireAuth, requireRole('admin'), h((req, res) => {
  db.prepare('DELETE FROM assignments WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
}))

/** 对应 saveDesignParam */
routes.post('/admin/design-params', requireAuth, requireRole('admin'), h((req, res) => {
  const { clientId, innerCrown, occlusalCut, proximalCut } = req.body || {}
  if (!clientId) return bad(res, '缺少客户')
  db.prepare(`INSERT INTO design_params (id, inner_crown, occlusal_cut, proximal_cut) VALUES (?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET inner_crown = excluded.inner_crown, occlusal_cut = excluded.occlusal_cut, proximal_cut = excluded.proximal_cut`)
    .run(clientId, Number(innerCrown), Number(occlusalCut), Number(proximalCut))
  res.json({ ok: true })
}))

/** 对应 dispatchUnassignedOrder：仅当客户组已匹配设计师组时重新派发 */
routes.post('/admin/orders/:id/dispatch', requireAuth, requireRole('admin'), h((req, res) => {
  const order = getOrder(req.params.id)
  if (!order || order.status !== 'unassigned') return bad(res, '订单不存在或不是未分配状态')
  const client = getClient(order.client_id)
  if (!client?.client_group_id || matchedDesignerGroupIds(client.client_group_id).length === 0) {
    return bad(res, '该订单的客户分组仍未匹配任何设计师组，请先配置分组匹配')
  }
  db.prepare(`UPDATE orders SET status = 'pending' WHERE id = ?`).run(order.id)
  res.json({ ok: true })
}))
