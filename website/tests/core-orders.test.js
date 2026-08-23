import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { mockLocalStorage, readDB } from './helpers.js'

mockLocalStorage()

const store = await import('../src/lib/store.ts')
const {
  resetDB,
  createOrder,
  acceptOrder,
  submitDesign,
  returnOrder,
  resubmitOrder,
  adjustPoints,
  cancelOrder,
  moveClient,
  createReworkRequest,
  approveRework,
  rejectRework,
  cancelReworkRequest,
  updateReworkRequest,
  getClientReworks,
} = store

beforeEach(() => resetDB())

const baseOrder = (overrides = {}) => ({
  clientId: 'c-mingzhou',
  type: 'quanci',
  urgent: false,
  teeth: ['21', '11'],
  requirement: '测试需求',
  scanFiles: [{ name: 'scan.stl' }],
  images: [{ name: 'photo.jpg' }],
  ...overrides,
})

test('createOrder: 预扣积分、记流水、升序牙位、递增单号', () => {
  const order = createOrder(baseOrder({ patient: ' 张三 ' }))
  const db = readDB()
  const client = db.clients.find((c) => c.id === 'c-mingzhou')
  const txn = db.txns[0]

  assert.equal(order.points, 10)
  assert.deepEqual(order.teeth, ['11', '21'])
  assert.equal(order.patient, '张三')
  assert.equal(order.status, 'pending')
  assert.match(order.no, /^MY-\d{6}-\d{3}$/)
  assert.equal(client.points, 351)
  assert.equal(db.seq, 9)
  assert.equal(txn.delta, -10)
  assert.equal(txn.balance, 351)
  assert.ok(txn.reason.includes(order.no))
  assert.equal(txn.orderId, order.id)
  assert.equal(db.orders[0].id, order.id)
})

test('createOrder: 自定义颗数与马龙桥固定分', () => {
  const custom = createOrder(baseOrder({ clientId: 'c-hengmei', custom: true, customCount: 25, teeth: [] }))
  const malong = createOrder(baseOrder({ clientId: 'c-hengmei', type: 'malong', teeth: [], arch: 'upper' }))
  const db = readDB()

  assert.equal(custom.custom, true)
  assert.equal(custom.customCount, 25)
  assert.deepEqual(custom.teeth, [])
  assert.equal(custom.points, 125)
  assert.equal(malong.custom, true)
  assert.equal(malong.arch, 'upper')
  assert.equal(malong.customCount, undefined)
  assert.equal(malong.points, 80)
  assert.equal(db.clients.find((c) => c.id === 'c-hengmei').points, 1140 - 125 - 80)
})

test('createOrder: 只有贴面支持加急附加分', () => {
  const tienian = createOrder(baseOrder({ type: 'tiemian', urgent: true, teeth: ['11', '21', '22'] }))
  const jike = createOrder(baseOrder({ clientId: 'c-hengmei', type: 'jike', urgent: true, teeth: ['16', '17'] }))
  assert.equal(tienian.points, 45)
  assert.equal(jike.points, 16)
})

test('createOrder: 积分不足返回 null 且不改动数据', () => {
  const before = readDB()
  const order = createOrder(baseOrder({
    clientId: 'c-yahe',
    type: 'tiemian',
    urgent: true,
    teeth: ['11', '21', '22', '23', '24', '25', '26', '27', '31', '32'],
  }))
  const after = readDB()

  assert.equal(order, null)
  assert.equal(after.orders.length, before.orders.length)
  assert.equal(after.seq, before.seq)
  assert.equal(after.txns.length, before.txns.length)
  assert.equal(after.clients.find((c) => c.id === 'c-yahe').points, 95)
})

test('createOrder: 客户不存在返回 null', () => {
  assert.equal(createOrder(baseOrder({ clientId: 'c-missing' })), null)
})

test('createOrder: 客户分组未匹配任何设计师组时置为 unassigned', () => {
  moveClient('c-yahe', 'cg-none')
  const order = createOrder(baseOrder({ clientId: 'c-yahe', teeth: ['36'] }))
  assert.equal(order.status, 'unassigned')
  assert.equal(readDB().orders.find((o) => o.id === order.id).status, 'unassigned')
})

test('acceptOrder: 仅 pending 可接单并记录接单时间', () => {
  assert.equal(acceptOrder('o-004', 'd-zhou'), true)
  const db = readDB()
  assert.equal(db.orders.find((o) => o.id === 'o-004').status, 'designing')
  assert.equal(db.orders.find((o) => o.id === 'o-004').designerId, 'd-zhou')
  assert.ok(db.orders.find((o) => o.id === 'o-004').acceptedAt)

  assert.equal(acceptOrder('o-003', 'd-li'), false)
  assert.equal(acceptOrder('o-001', 'd-li'), false)
  assert.equal(acceptOrder('o-missing', 'd-li'), false)
})

test('submitDesign: 完成设计并通知客户，返工重做累加 reworkCount', () => {
  submitDesign('o-003', [{ name: 'design.stl' }])
  let db = readDB()
  assert.equal(db.orders.find((o) => o.id === 'o-003').status, 'completed')
  assert.deepEqual(db.orders.find((o) => o.id === 'o-003').designFiles, [{ name: 'design.stl' }])
  assert.ok(db.orders.find((o) => o.id === 'o-003').completedAt)
  assert.equal(db.orders.find((o) => o.id === 'o-003').reworkCount, 0)
  assert.ok(db.notices.some((n) => n.orderId === 'o-003' && n.text.includes('已完成')))

  submitDesign('o-005', [{ name: 'rework.stl' }])
  db = readDB()
  assert.equal(db.orders.find((o) => o.id === 'o-005').status, 'completed')
  assert.equal(db.orders.find((o) => o.id === 'o-005').reworkCount, 2)

  submitDesign('o-004', [{ name: 'x.stl' }])
  assert.equal(readDB().orders.find((o) => o.id === 'o-004').status, 'pending')
})

test('returnOrder: 退回后清空接单信息并通知客户', () => {
  returnOrder('o-003', '口扫数据不完整')
  let db = readDB()
  const returned = db.orders.find((o) => o.id === 'o-003')
  assert.equal(returned.status, 'returned')
  assert.equal(returned.returnReason, '口扫数据不完整')
  assert.equal(returned.designerId, undefined)
  assert.equal(returned.acceptedAt, undefined)
  assert.ok(returned.returnedAt)
  assert.ok(db.notices.some((n) => n.orderId === 'o-003' && n.text.includes('口扫数据不完整')))

  returnOrder('o-001', '不应生效')
  db = readDB()
  assert.equal(db.orders.find((o) => o.id === 'o-001').status, 'completed')
  assert.equal(db.notices.some((n) => n.orderId === 'o-001' && n.text.includes('不应生效')), false)
})

test('resubmitOrder: 牙位不变时直接回到 pending', () => {
  returnOrder('o-004', '资料不齐')
  resubmitOrder('o-004', {})
  const db = readDB()
  const order = db.orders.find((o) => o.id === 'o-004')
  assert.equal(order.status, 'pending')
  assert.equal(order.returnReason, undefined)
  assert.equal(order.points, 8)
  assert.equal(db.clients.find((c) => c.id === 'c-yahe').points, 95)
  assert.equal(db.txns.length, 7)
})

test('resubmitOrder: 增加牙位时补扣积分并记流水', () => {
  returnOrder('o-004', '资料不齐')
  resubmitOrder('o-004', { teeth: ['36', '37'] })
  const db = readDB()
  const order = db.orders.find((o) => o.id === 'o-004')
  assert.equal(order.status, 'pending')
  assert.equal(order.points, 16)
  assert.deepEqual(order.teeth, ['36', '37'])
  assert.equal(db.clients.find((c) => c.id === 'c-yahe').points, 87)
  assert.equal(db.txns[0].delta, -8)
  assert.equal(db.txns[0].balance, 87)
  assert.ok(db.txns[0].reason.includes('补扣'))
})

test('resubmitOrder: 减少自定义颗数时退回积分', () => {
  returnOrder('o-007', '颗数填错')
  resubmitOrder('o-007', { customCount: 20 })
  const db = readDB()
  const order = db.orders.find((o) => o.id === 'o-007')
  assert.equal(order.points, 100)
  assert.equal(order.customCount, 20)
  assert.equal(db.clients.find((c) => c.id === 'c-mingzhou').points, 386)
  assert.equal(db.txns[0].delta, 25)
  assert.equal(db.txns[0].balance, 386)
  assert.ok(db.txns[0].reason.includes('退回'))
})

test('resubmitOrder: 补扣不足时保持退回状态且不改数据', () => {
  returnOrder('o-004', '资料不齐')
  const before = readDB()
  resubmitOrder('o-004', { teeth: Array.from({ length: 13 }, (_, i) => String(30 + i)) })
  const after = readDB()
  assert.equal(after.orders.find((o) => o.id === 'o-004').status, 'returned')
  assert.equal(after.clients.find((c) => c.id === 'c-yahe').points, 95)
  assert.equal(after.txns.length, before.txns.length)
})

test('resubmitOrder: 非退回状态不生效', () => {
  resubmitOrder('o-001', {})
  assert.equal(readDB().orders.find((o) => o.id === 'o-001').status, 'completed')
})

test('adjustPoints: 充值/扣减并记录默认或自定义原因', () => {
  assert.equal(adjustPoints('c-yahe', 50, ''), true)
  let db = readDB()
  assert.equal(db.clients.find((c) => c.id === 'c-yahe').points, 145)
  assert.equal(db.txns[0].delta, 50)
  assert.equal(db.txns[0].balance, 145)
  assert.equal(db.txns[0].reason, '积分充值')

  assert.equal(adjustPoints('c-yahe', -20, '活动补偿'), true)
  db = readDB()
  assert.equal(db.clients.find((c) => c.id === 'c-yahe').points, 125)
  assert.equal(db.txns[0].reason, '活动补偿')
})

test('adjustPoints: 扣成负数、零变动、客户不存在均失败', () => {
  assert.equal(adjustPoints('c-yahe', -200, '扣减'), false)
  assert.equal(adjustPoints('c-yahe', 0, '无变动'), false)
  assert.equal(adjustPoints('c-missing', 10, '充值'), false)
  assert.equal(readDB().clients.find((c) => c.id === 'c-yahe').points, 95)
})

test('cancelOrder: 待接单撤回全额退积分', () => {
  assert.equal(cancelOrder('o-004', 'c-yahe'), true)
  const db = readDB()
  const order = db.orders.find((o) => o.id === 'o-004')
  assert.equal(order.status, 'cancelled')
  assert.ok(order.cancelledAt)
  assert.equal(db.clients.find((c) => c.id === 'c-yahe').points, 103)
  assert.equal(db.txns[0].delta, 8)
  assert.equal(db.txns[0].balance, 103)
  assert.ok(db.txns[0].reason.includes('撤回'))
})

test('cancelOrder: 已接单或非本人订单不可撤回', () => {
  assert.equal(cancelOrder('o-003', 'c-hengmei'), false)
  assert.equal(cancelOrder('o-004', 'c-hengmei'), false)
  assert.equal(cancelOrder('o-missing', 'c-yahe'), false)
  assert.equal(readDB().orders.find((o) => o.id === 'o-003').status, 'designing')
})

test('createReworkRequest: 已完成订单进入返工并登记申请', () => {
  createReworkRequest('o-001', '边缘线需调整', [{ name: 'rework.jpg' }])
  const db = readDB()
  const order = db.orders.find((o) => o.id === 'o-001')
  assert.equal(order.status, 'rework')
  assert.equal(order.isRework, true)
  assert.equal(order.reworkReason, '边缘线需调整')
  assert.equal(db.reworks[0].orderId, 'o-001')
  assert.equal(db.reworks[0].status, 'pending')
  assert.deepEqual(db.reworks[0].images, [{ name: 'rework.jpg' }])

  createReworkRequest('o-003', '不应生效', [])
  assert.equal(readDB().orders.find((o) => o.id === 'o-003').status, 'designing')
})

test('approveRework: 通过后退还订单积分并通知客户', () => {
  createReworkRequest('o-001', '边缘线需调整', [])
  const rwId = readDB().reworks[0].id
  approveRework(rwId)
  const db = readDB()
  assert.equal(db.reworks.find((r) => r.id === rwId).status, 'approved')
  assert.ok(db.reworks.find((r) => r.id === rwId).reviewedAt)
  assert.equal(db.clients.find((c) => c.id === 'c-mingzhou').points, 377)
  assert.equal(db.txns[0].delta, 16)
  assert.equal(db.txns[0].balance, 377)
  assert.ok(db.txns[0].reason.includes('返工审核通过'))
  assert.ok(db.notices.some((n) => n.orderId === 'o-001' && n.text.includes('已退 16 积分')))

  approveRework(rwId)
  assert.equal(readDB().clients.find((c) => c.id === 'c-mingzhou').points, 377)
})

test('rejectRework: 拒绝不退积分并通知客户', () => {
  createReworkRequest('o-002', '颜色不符', [])
  const rwId = readDB().reworks[0].id
  rejectRework(rwId)
  const db = readDB()
  assert.equal(db.reworks.find((r) => r.id === rwId).status, 'rejected')
  assert.equal(db.clients.find((c) => c.id === 'c-hengmei').points, 1140)
  assert.ok(db.notices.some((n) => n.orderId === 'o-002' && n.text.includes('不予退回积分')))
})

test('getClientReworks: 按申请时间倒序返回', () => {
  createReworkRequest('o-001', '新返工', [])
  const db = readDB()
  const ids = getClientReworks(db, 'c-mingzhou').map((r) => r.id)
  assert.equal(ids[0], db.reworks[0].id)
  assert.equal(ids[1], 'rw-001')
})

test('cancelReworkRequest: 撤销后订单恢复已完成并保留返工标记', () => {
  assert.equal(cancelReworkRequest('rw-001'), true)
  const db = readDB()
  const order = db.orders.find((o) => o.id === 'o-005')
  assert.equal(order.status, 'completed')
  assert.equal(order.reworkReason, undefined)
  assert.equal(order.isRework, true)
  assert.equal(db.reworks.some((r) => r.id === 'rw-001'), false)
  assert.equal(cancelReworkRequest('rw-001'), false)
})

test('updateReworkRequest: 审核前可修改原因与照片', () => {
  assert.equal(updateReworkRequest('rw-001', '  新原因  ', [{ name: 'new.jpg' }]), true)
  let db = readDB()
  assert.equal(db.reworks.find((r) => r.id === 'rw-001').reason, '新原因')
  assert.deepEqual(db.reworks.find((r) => r.id === 'rw-001').images, [{ name: 'new.jpg' }])

  approveRework('rw-001')
  db = readDB()
  assert.equal(updateReworkRequest('rw-001', 'x', []), false)
  assert.equal(db.reworks.find((r) => r.id === 'rw-001').reason, '新原因')
})
