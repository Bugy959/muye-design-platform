import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { mockLocalStorage, readDB } from './helpers.js'

mockLocalStorage()

const store = await import('../src/lib/store.ts')
const {
  resetDB,
  createOrder,
  groupOf,
  clientGroupOf,
  matchedClientGroupIds,
  matchedDesignerGroupIds,
  filterPoolOrders,
  registerDesignerGroup,
  registerClient,
  registerDesigner,
  renameGroup,
  setGroupLeader,
  updateGroupNote,
  moveDesigner,
  createClientGroup,
  renameClientGroup,
  deleteClientGroup,
  moveClient,
  addAssignment,
  removeAssignment,
  dispatchUnassignedOrder,
  searchOrders,
  orderStats,
  getDesignParam,
  saveDesignParam,
  markNoticeRead,
  markNoticesRead,
} = store

beforeEach(() => resetDB())

const baseOrder = (overrides = {}) => ({
  clientId: 'c-yahe',
  type: 'jike',
  urgent: false,
  teeth: ['36'],
  requirement: '测试',
  scanFiles: [{ name: 'scan.stl' }],
  images: [{ name: 'photo.jpg' }],
  ...overrides,
})

test('groupOf / clientGroupOf: 查询分组信息', () => {
  const db = readDB()
  assert.equal(groupOf(db, 'g-a').name, 'A 组 · 灵犀')
  assert.equal(groupOf(db, undefined), undefined)
  assert.equal(clientGroupOf(db, 'c-mingzhou').name, '宁波地区')
  assert.equal(clientGroupOf(db, 'c-missing'), undefined)
})

test('分组匹配查询: 客户组与设计师组多对多', () => {
  const db = readDB()
  assert.deepEqual(matchedClientGroupIds(db, 'g-a'), ['cg-nb'])
  assert.deepEqual(matchedClientGroupIds(db, undefined), [])
  assert.deepEqual(matchedDesignerGroupIds(db, 'cg-nb'), ['g-a', 'g-b'])
  assert.deepEqual(matchedDesignerGroupIds(db, 'cg-none'), [])
})

test('filterPoolOrders: 只显示本组匹配客户组的待接单', () => {
  const db = readDB()
  assert.deepEqual(filterPoolOrders(db, 'd-li').map((o) => o.id), ['o-006'])
  assert.deepEqual(filterPoolOrders(db, 'd-zhou').map((o) => o.id), ['o-004'])
  assert.deepEqual(filterPoolOrders(db, 'd-missing'), [])
})

test('设计师分组管理: 新增/改名/组长/备注/调组', () => {
  const g = registerDesignerGroup('  新组  ', ' 备注 ')
  assert.equal(g.name, '新组')
  assert.equal(g.note, '备注')

  renameGroup('g-c', 'C 组新名')
  setGroupLeader('g-c', 'd-li')
  updateGroupNote('g-c', '  新备注  ')
  moveDesigner('d-li', 'g-c')
  const db = readDB()
  assert.equal(db.groups.find((x) => x.id === 'g-c').name, 'C 组新名')
  assert.equal(db.groups.find((x) => x.id === 'g-c').note, '新备注')
  assert.equal(db.groups.find((x) => x.id === 'g-c').leaderId, 'd-li')
  assert.equal(db.designers.find((x) => x.id === 'd-li').groupId, 'g-c')
  assert.equal(db.groups.find((x) => x.id === 'g-a').leaderId, undefined)
})

test('客户与设计师档案注册', () => {
  const c = registerClient('测试医院', '13800000000', 'hospital')
  const d = registerDesigner({ name: '测试', phone: '13800000001', idCard: '3301**********0099', groupId: 'g-a' })
  const db = readDB()
  assert.ok(c.id.startsWith('c-'))
  assert.equal(db.clients.find((x) => x.id === c.id).points, 0)
  assert.ok(d.id.startsWith('d-'))
  assert.equal(db.designers.find((x) => x.id === d.id).groupId, 'g-a')
})

test('客户分组管理: 创建/改名/移动/删除', () => {
  const cg = createClientGroup('  测试客户组  ', ' 备注 ')
  assert.equal(cg.name, '测试客户组')
  renameClientGroup(cg.id, '改名', '新备注')
  moveClient('c-yahe', cg.id)
  addAssignment(cg.id, 'g-a')
  let db = readDB()
  assert.equal(db.clientGroups.find((x) => x.id === cg.id).name, '改名')
  assert.equal(db.clientGroups.find((x) => x.id === cg.id).note, '新备注')
  assert.equal(db.clients.find((x) => x.id === 'c-yahe').clientGroupId, cg.id)
  assert.ok(db.assignments.some((a) => a.clientGroupId === cg.id))

  const empty = createClientGroup('空组')
  addAssignment(empty.id, 'g-b')
  assert.equal(deleteClientGroup(empty.id), true)
  db = readDB()
  assert.equal(db.clientGroups.some((x) => x.id === empty.id), false)
  assert.equal(db.assignments.some((a) => a.clientGroupId === empty.id), false)

  assert.equal(deleteClientGroup('cg-nb'), false)
})

test('匹配规则: 去重添加与移除', () => {
  addAssignment('cg-nb', 'g-a')
  let db = readDB()
  assert.equal(db.assignments.filter((a) => a.clientGroupId === 'cg-nb' && a.designerGroupId === 'g-a').length, 1)

  removeAssignment('cg-nb', 'g-a')
  db = readDB()
  assert.equal(db.assignments.some((a) => a.clientGroupId === 'cg-nb' && a.designerGroupId === 'g-a'), false)
})

test('dispatchUnassignedOrder: 只有分组匹配完成后才能重新派发', () => {
  moveClient('c-yahe', 'cg-none')
  const order = createOrder(baseOrder())
  assert.equal(order.status, 'unassigned')
  assert.equal(dispatchUnassignedOrder(order.id), false)

  addAssignment('cg-none', 'g-a')
  assert.equal(dispatchUnassignedOrder(order.id), true)
  assert.equal(readDB().orders.find((o) => o.id === order.id).status, 'pending')
  assert.equal(dispatchUnassignedOrder(order.id), false)
})

test('searchOrders: 角色过滤/关键词/日期/状态与倒序', () => {
  const db = readDB()
  const ids = (role, id, ...rest) => searchOrders(db, role, id, ...rest).map((o) => o.id)

  assert.deepEqual(ids('client', 'c-mingzhou'), ['o-007', 'o-005', 'o-001'])
  assert.deepEqual(ids('designer', 'd-li'), ['o-007', 'o-001'])
  assert.equal(ids('admin', 'x').length, 7)
  assert.deepEqual(ids('admin', 'x', 'my-260711'), ['o-003'])
  assert.deepEqual(ids('admin', 'x', undefined, '2026-07-10', '2026-07-20'), ['o-004', 'o-003'])
  assert.deepEqual(ids('admin', 'x', undefined, undefined, undefined, 'pending'), ['o-006', 'o-004'])

  const order = createOrder(baseOrder({ patient: '张伟' }))
  assert.deepEqual(searchOrders(readDB(), 'admin', 'x', '张伟').map((o) => o.id), [order.id])
})

test('orderStats: 总数/当月/完成/返工/退回统计', () => {
  const before = orderStats(readDB(), 'admin', 'x')
  assert.equal(before.total, 7)
  assert.equal(before.completed, 2)
  assert.equal(before.reworked, 1)
  assert.equal(before.returned, 0)
  assert.equal(typeof before.monthly, 'number')

  createOrder(baseOrder())
  const after = orderStats(readDB(), 'admin', 'x')
  assert.equal(after.total, 8)
  assert.equal(after.monthly, before.monthly + 1)

  const clientStats = orderStats(readDB(), 'client', 'c-mingzhou')
  assert.equal(clientStats.total, 3)
  assert.equal(clientStats.completed, 1)
  assert.equal(clientStats.reworked, 1)
})

test('设计参数: 读取与新增/覆盖保存', () => {
  const db = readDB()
  assert.deepEqual(getDesignParam(db, 'c-mingzhou'), { id: 'c-mingzhou', innerCrown: 0.02, occlusalCut: 0.1, proximalCut: -0.02 })
  assert.equal(getDesignParam(db, 'c-yahe'), undefined)

  saveDesignParam('c-yahe', 0.1, 0.2, 0.3)
  saveDesignParam('c-mingzhou', 0.03, 0.11, -0.01)
  const after = readDB()
  assert.equal(after.designParams.length, 2)
  assert.deepEqual(getDesignParam(after, 'c-yahe'), { id: 'c-yahe', innerCrown: 0.1, occlusalCut: 0.2, proximalCut: 0.3 })
  assert.deepEqual(getDesignParam(after, 'c-mingzhou'), { id: 'c-mingzhou', innerCrown: 0.03, occlusalCut: 0.11, proximalCut: -0.01 })
})

test('消息已读: 单条与整组标记', () => {
  markNoticeRead('n-001')
  let db = readDB()
  assert.equal(db.notices.find((n) => n.id === 'n-001').read, true)
  assert.equal(db.notices.find((n) => n.id === 'n-002').read, false)

  markNoticesRead('c-hengmei')
  db = readDB()
  assert.equal(db.notices.find((n) => n.id === 'n-002').read, true)
})
