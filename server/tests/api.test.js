import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import path from 'node:path'
import fs from 'node:fs'

const DB_FILE = path.join(tmpdir(), `muye-api-test-${process.pid}.db`)
process.env.MUYE_DB_PATH = DB_FILE
process.env.NODE_ENV = 'test'

const { createApp } = await import('../src/index.js')
const { db, uid, now, closeDb } = await import('../src/db.js')
const { hashPassword } = await import('../src/auth.js')

let server
let base

before(async () => {
  server = createApp().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((resolve) => server.close(resolve))
  closeDb()
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(DB_FILE + suffix) } catch { /* 忽略清理失败 */ }
  }
})

function resetBusinessData() {
  db.exec('DELETE FROM sessions')
  db.exec('DELETE FROM notices')
  db.exec('DELETE FROM point_txns')
  db.exec('DELETE FROM rework_requests')
  db.exec('DELETE FROM orders')
  db.exec('DELETE FROM accounts')
  db.exec("DELETE FROM clients WHERE id NOT IN ('c-mingzhou', 'c-hengmei', 'c-yahe')")
  db.exec("DELETE FROM designers WHERE id NOT IN ('d-li', 'd-wang', 'd-zhao', 'd-sun', 'd-zhou')")
  db.exec('DELETE FROM assignments')
  db.exec("DELETE FROM client_groups WHERE id NOT IN ('cg-nb', 'cg-hz')")
  db.exec("DELETE FROM groups WHERE id NOT IN ('g-a', 'g-b', 'g-c', 'g-d')")
  db.exec(`UPDATE clients SET
    points = CASE id WHEN 'c-mingzhou' THEN 361 WHEN 'c-hengmei' THEN 1140 ELSE 95 END,
    client_group_id = CASE id WHEN 'c-yahe' THEN 'cg-hz' ELSE 'cg-nb' END`)
  db.exec(`UPDATE designers SET group_id = CASE id
    WHEN 'd-li' THEN 'g-a' WHEN 'd-wang' THEN 'g-a'
    WHEN 'd-zhao' THEN 'g-b' WHEN 'd-sun' THEN 'g-b'
    ELSE 'g-c' END`)
  db.exec(`UPDATE groups SET
    leader_id = CASE id WHEN 'g-a' THEN 'd-li' WHEN 'g-b' THEN 'd-zhao' ELSE NULL END,
    name = CASE id WHEN 'g-a' THEN 'A 组 · 灵犀' WHEN 'g-b' THEN 'B 组 · 匠心' WHEN 'g-c' THEN 'C 组 · 精工' ELSE 'D 组 · 速琢' END,
    note = CASE id WHEN 'g-a' THEN '白班·主攻全瓷冠' WHEN 'g-b' THEN '夜班·全能型' WHEN 'g-c' THEN '周末组·专攻即刻' ELSE '机动组' END`)
  const insertAssignment = db.prepare('INSERT INTO assignments (id, client_group_id, designer_group_id, created_at) VALUES (?,?,?,?)')
  for (const [clientGroupId, designerGroupId] of [['cg-nb', 'g-a'], ['cg-nb', 'g-b'], ['cg-hz', 'g-c'], ['cg-hz', 'g-d']]) {
    insertAssignment.run(`as-${uid()}`, clientGroupId, designerGroupId, now())
  }
  db.exec('DELETE FROM design_params')
  db.prepare('INSERT INTO design_params (id, inner_crown, occlusal_cut, proximal_cut) VALUES (?, ?, ?, ?)')
    .run('c-mingzhou', 0.02, 0.1, -0.02)
  db.exec("UPDATE meta SET value = '1' WHERE key = 'seq'")

  const seeds = [
    ['admin', 'muye2026', 'admin', null, null],
    ['mingzhou', '123456', 'client', 'c-mingzhou', null],
    ['hengmei', '123456', 'client', 'c-hengmei', null],
    ['yahe', '123456', 'client', 'c-yahe', null],
    ['li', '123456', 'designer', null, 'd-li'],
    ['wang', '123456', 'designer', null, 'd-wang'],
    ['zhao', '123456', 'designer', null, 'd-zhao'],
    ['sun', '123456', 'designer', null, 'd-sun'],
    ['zhou', '123456', 'designer', null, 'd-zhou'],
  ]
  const insertAccount = db.prepare('INSERT INTO accounts (id, username, pass_hash, role, client_id, designer_id, created_at) VALUES (?,?,?,?,?,?,?)')
  for (const [username, password, role, clientId, designerId] of seeds) {
    insertAccount.run(`a-${uid()}`, username, hashPassword(password), role, clientId, designerId, now())
  }
}

beforeEach(resetBusinessData)

async function api(method, pathname, { token, body } = {}) {
  const response = await fetch(`${base}/api${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: response.status, data: await response.json() }
}

async function login(username, password) {
  const { status, data } = await api('POST', '/auth/login', { body: { username, password } })
  assert.equal(status, 200)
  return data
}

test('登录、退出与未登录/越权拦截', async () => {
  const bad = await api('POST', '/auth/login', { body: { username: 'admin', password: 'wrong' } })
  assert.equal(bad.status, 401)
  assert.match(bad.data.error, /账号或密码错误/)

  const admin = await login('admin', 'muye2026')
  assert.ok(admin.token)
  assert.equal(admin.session.role, 'admin')

  const noToken = await api('GET', '/bootstrap')
  assert.equal(noToken.status, 401)

  const designer = await login('li', '123456')
  const denied = await api('POST', '/orders', { token: designer.token, body: {} })
  assert.equal(denied.status, 403)

  const logout = await api('POST', '/auth/logout', { token: admin.token })
  assert.equal(logout.status, 200)
  assert.equal((await api('GET', '/bootstrap', { token: admin.token })).status, 401)
})

test('bootstrap 按角色过滤数据', async () => {
  const admin = await login('admin', 'muye2026')
  const client = await login('mingzhou', '123456')
  const designer = await login('li', '123456')

  const adminData = (await api('GET', '/bootstrap', { token: admin.token })).data
  assert.equal(adminData.clients.length, 3)
  assert.equal(adminData.designers.length, 5)
  assert.equal(adminData.accounts.length, 9)
  assert.equal(adminData.groups.length, 4)
  assert.equal(adminData.assignments.length, 4)

  const clientData = (await api('GET', '/bootstrap', { token: client.token })).data
  assert.equal(clientData.clients.length, 1)
  assert.equal(clientData.clients[0].id, 'c-mingzhou')
  assert.deepEqual(clientData.assignments, [])
  assert.equal(clientData.designParams.length, 1)

  const designerData = (await api('GET', '/bootstrap', { token: designer.token })).data
  assert.deepEqual(designerData.clients, [])
  assert.deepEqual(designerData.txns, [])
  assert.deepEqual(designerData.notices, [])
})

test('订单校验与积分不足拦截', async () => {
  const client = await login('yahe', '123456')
  const valid = {
    type: 'quanci',
    urgent: false,
    teeth: ['11', '21'],
    requirement: '测试',
    scanFiles: [{ name: 'scan.stl' }],
    images: [{ name: 'photo.jpg' }],
  }
  const cases = [
    { ...valid, type: 'unknown' },
    { ...valid, teeth: [] },
    { ...valid, scanFiles: [] },
    { ...valid, images: [] },
    { ...valid, type: 'malong', teeth: [], custom: true, arch: undefined },
    { ...valid, type: 'jike', teeth: Array.from({ length: 13 }, (_, i) => String(30 + i)) },
  ]
  for (const body of cases) {
    assert.equal((await api('POST', '/orders', { token: client.token, body })).status, 400)
  }

  const after = (await api('GET', '/bootstrap', { token: client.token })).data
  assert.equal(after.orders.length, 0)
  assert.equal(after.clients[0].points, 95)
})

test('创建订单：预扣积分、流水与单号递增', async () => {
  const client = await login('mingzhou', '123456')
  const designer = await login('li', '123456')

  const first = await api('POST', '/orders', {
    token: client.token,
    body: {
      type: 'quanci',
      urgent: false,
      teeth: ['21', '11'],
      requirement: '前牙全瓷冠',
      scanFiles: [{ name: 'scan.stl' }],
      images: [{ name: 'photo.jpg' }],
    },
  })
  assert.equal(first.status, 200)
  assert.equal(first.data.order.points, 10)
  assert.equal(first.data.unassigned, false)
  assert.match(first.data.no, /^MY-\d{6}-001$/)

  const second = await api('POST', '/orders', {
    token: client.token,
    body: {
      type: 'jike',
      urgent: false,
      teeth: ['16'],
      requirement: '测试',
      scanFiles: [{ name: 'scan.stl' }],
      images: [{ name: 'photo.jpg' }],
    },
  })
  assert.match(second.data.no, /^MY-\d{6}-002$/)

  const clientData = (await api('GET', '/bootstrap', { token: client.token })).data
  assert.equal(clientData.orders.length, 2)
  assert.equal(clientData.clients[0].points, 361 - 18)
  assert.equal(clientData.txns.reduce((sum, t) => sum + t.delta, 0), -18)

  const designerData = (await api('GET', '/bootstrap', { token: designer.token })).data
  assert.equal(designerData.orders.filter((o) => o.status === 'pending').length, 2)
  assert.deepEqual(designerData.clients, [])
})

test('抢单：匹配范围与原子性', async () => {
  const client = await login('mingzhou', '123456')
  const li = await login('li', '123456')
  const wang = await login('wang', '123456')
  const zhou = await login('zhou', '123456')

  const created = await api('POST', '/orders', {
    token: client.token,
    body: {
      type: 'quanci',
      urgent: false,
      teeth: ['11', '21'],
      requirement: '测试',
      scanFiles: [{ name: 'scan.stl' }],
      images: [{ name: 'photo.jpg' }],
    },
  })
  const orderId = created.data.order.id

  const outOfRange = await api('POST', `/orders/${orderId}/accept`, { token: zhou.token })
  assert.equal(outOfRange.status, 400)

  assert.equal((await api('POST', `/orders/${orderId}/accept`, { token: li.token })).status, 200)
  assert.equal((await api('POST', `/orders/${orderId}/accept`, { token: wang.token })).status, 409)
  assert.equal((await api('POST', '/orders/o-missing/accept', { token: li.token })).status, 404)
})

test('提交设计：仅原设计师且状态正确', async () => {
  const client = await login('mingzhou', '123456')
  const li = await login('li', '123456')
  const wang = await login('wang', '123456')

  const created = await api('POST', '/orders', {
    token: client.token,
    body: {
      type: 'quanci',
      urgent: false,
      teeth: ['11'],
      requirement: '测试',
      scanFiles: [{ name: 'scan.stl' }],
      images: [{ name: 'photo.jpg' }],
    },
  })
  const orderId = created.data.order.id
  await api('POST', `/orders/${orderId}/accept`, { token: li.token })

  const wrongDesigner = await api('POST', `/orders/${orderId}/submit-design`, {
    token: wang.token,
    body: { files: [{ name: 'x.stl' }] },
  })
  assert.equal(wrongDesigner.status, 403)

  const ok = await api('POST', `/orders/${orderId}/submit-design`, {
    token: li.token,
    body: { files: [{ name: 'design.stl' }] },
  })
  assert.equal(ok.status, 200)

  const again = await api('POST', `/orders/${orderId}/submit-design`, {
    token: li.token,
    body: { files: [{ name: 'design.stl' }] },
  })
  assert.equal(again.status, 400)

  const clientData = (await api('GET', '/bootstrap', { token: client.token })).data
  assert.equal(clientData.orders[0].status, 'completed')
  assert.deepEqual(clientData.orders[0].designFiles, [{ name: 'design.stl' }])
  assert.equal(clientData.notices.length, 1)
})

test('退回与重新提交：多退少补', async () => {
  const client = await login('mingzhou', '123456')
  const li = await login('li', '123456')

  const created = await api('POST', '/orders', {
    token: client.token,
    body: {
      type: 'quanci',
      urgent: false,
      teeth: ['11', '21'],
      requirement: '测试',
      scanFiles: [{ name: 'scan.stl' }],
      images: [{ name: 'photo.jpg' }],
    },
  })
  const orderId = created.data.order.id
  await api('POST', `/orders/${orderId}/accept`, { token: li.token })

  const noReason = await api('POST', `/orders/${orderId}/return`, { token: li.token, body: {} })
  assert.equal(noReason.status, 400)

  const returned = await api('POST', `/orders/${orderId}/return`, {
    token: li.token,
    body: { reason: '信息不全' },
  })
  assert.equal(returned.status, 200)

  const resubmitted = await api('POST', `/orders/${orderId}/resubmit`, {
    token: client.token,
    body: { teeth: ['11', '21', '22'] },
  })
  assert.equal(resubmitted.status, 200)

  const clientData = (await api('GET', '/bootstrap', { token: client.token })).data
  assert.equal(clientData.orders[0].points, 15)
  assert.equal(clientData.orders[0].status, 'pending')
  assert.equal(clientData.clients[0].points, 346)
  const orderTxns = clientData.txns.filter((t) => t.orderId === orderId)
  assert.equal(orderTxns.reduce((sum, t) => sum + t.delta, 0), -15)
  assert.ok(orderTxns.some((t) => t.delta === -5))

  const again = await api('POST', `/orders/${orderId}/resubmit`, { token: client.token, body: {} })
  assert.equal(again.status, 400)
})

test('撤回订单：仅待接单/未分配可退', async () => {
  const client = await login('mingzhou', '123456')
  const li = await login('li', '123456')

  const created = await api('POST', '/orders', {
    token: client.token,
    body: {
      type: 'quanci',
      urgent: false,
      teeth: ['11', '21'],
      requirement: '测试',
      scanFiles: [{ name: 'scan.stl' }],
      images: [{ name: 'photo.jpg' }],
    },
  })
  const orderId = created.data.order.id

  const cancelled = await api('POST', `/orders/${orderId}/cancel`, { token: client.token })
  assert.equal(cancelled.status, 200)
  const clientData = (await api('GET', '/bootstrap', { token: client.token })).data
  assert.equal(clientData.clients[0].points, 361)
  assert.equal(clientData.orders[0].status, 'cancelled')
  assert.equal(clientData.txns.reduce((sum, t) => sum + t.delta, 0), 0)

  const second = await api('POST', '/orders', {
    token: client.token,
    body: {
      type: 'jike',
      urgent: false,
      teeth: ['16'],
      requirement: '测试',
      scanFiles: [{ name: 'scan.stl' }],
      images: [{ name: 'photo.jpg' }],
    },
  })
  await api('POST', `/orders/${second.data.order.id}/accept`, { token: li.token })
  assert.equal((await api('POST', `/orders/${second.data.order.id}/cancel`, { token: client.token })).status, 400)
})

test('返工：审核通过退分、拒绝不退分、撤销恢复完成', async () => {
  const client = await login('mingzhou', '123456')
  const li = await login('li', '123456')
  const admin = await login('admin', 'muye2026')

  const createCompleted = async (body) => {
    const created = await api('POST', '/orders', { token: client.token, body })
    const orderId = created.data.order.id
    await api('POST', `/orders/${orderId}/accept`, { token: li.token })
    await api('POST', `/orders/${orderId}/submit-design`, {
      token: li.token,
      body: { files: [{ name: 'design.stl' }] },
    })
    return orderId
  }

  const approvedOrder = await createCompleted({
    type: 'quanci', urgent: false, teeth: ['11', '21'], requirement: 'x',
    scanFiles: [{ name: 'scan.stl' }], images: [{ name: 'photo.jpg' }],
  })
  await api('POST', `/orders/${approvedOrder}/rework-requests`, {
    token: client.token,
    body: { reason: '边缘线需调整' },
  })
  let reworkId = db.prepare("SELECT id FROM rework_requests WHERE order_id = ?").get(approvedOrder).id
  assert.equal((await api('POST', `/reworks/${reworkId}/approve`, { token: admin.token })).status, 200)
  let clientData = (await api('GET', '/bootstrap', { token: client.token })).data
  assert.equal(clientData.clients[0].points, 361)

  const rejectedOrder = await createCompleted({
    type: 'jike', urgent: false, teeth: ['16'], requirement: 'x',
    scanFiles: [{ name: 'scan.stl' }], images: [{ name: 'photo.jpg' }],
  })
  await api('POST', `/orders/${rejectedOrder}/rework-requests`, {
    token: client.token,
    body: { reason: '颜色不符' },
  })
  reworkId = db.prepare("SELECT id FROM rework_requests WHERE order_id = ?").get(rejectedOrder).id
  assert.equal((await api('POST', `/reworks/${reworkId}/reject`, { token: admin.token })).status, 200)
  clientData = (await api('GET', '/bootstrap', { token: client.token })).data
  assert.equal(clientData.clients[0].points, 361 - 8)

  const cancelledOrder = await createCompleted({
    type: 'jike', urgent: false, teeth: ['17'], requirement: 'x',
    scanFiles: [{ name: 'scan.stl' }], images: [{ name: 'photo.jpg' }],
  })
  await api('POST', `/orders/${cancelledOrder}/rework-requests`, {
    token: client.token,
    body: { reason: '重新核对' },
  })
  reworkId = db.prepare("SELECT id FROM rework_requests WHERE order_id = ?").get(cancelledOrder).id
  assert.equal((await api('PATCH', `/reworks/${reworkId}`, {
    token: client.token,
    body: { reason: '更新原因', images: [{ name: 'new.jpg' }] },
  })).status, 200)
  assert.equal((await api('DELETE', `/reworks/${reworkId}`, { token: client.token })).status, 200)
  clientData = (await api('GET', '/bootstrap', { token: client.token })).data
  assert.equal(clientData.orders.find((o) => o.id === cancelledOrder).status, 'completed')
})

test('管理端：积分调整与账号生命周期', async () => {
  const admin = await login('admin', 'muye2026')

  assert.equal((await api('POST', '/admin/points', {
    token: admin.token,
    body: { clientId: 'c-yahe', delta: 0, reason: 'x' },
  })).status, 400)
  assert.equal((await api('POST', '/admin/points', {
    token: admin.token,
    body: { clientId: 'c-yahe', delta: -10000, reason: 'x' },
  })).status, 400)
  assert.equal((await api('POST', '/admin/points', {
    token: admin.token,
    body: { clientId: 'c-yahe', delta: 100, reason: '充值' },
  })).status, 200)
  const yahe = await login('yahe', '123456')
  assert.equal((await api('GET', '/bootstrap', { token: yahe.token })).data.clients[0].points, 195)

  const created = await api('POST', '/admin/accounts', {
    token: admin.token,
    body: {
      username: 'newclient',
      password: 'p123',
      role: 'client',
      newClient: { name: '新医院', phone: '13800000000', kind: 'hospital' },
    },
  })
  assert.equal(created.status, 200)
  assert.equal((await api('POST', '/admin/accounts', {
    token: admin.token,
    body: { username: 'newclient', password: 'p123', role: 'client' },
  })).status, 400)

  const newLogin = await login('newclient', 'p123')
  assert.equal(newLogin.session.role, 'client')

  assert.equal((await api('POST', `/admin/accounts/${created.data.id}/reset-password`, {
    token: admin.token,
    body: { password: 'p456' },
  })).status, 200)
  assert.equal((await api('POST', '/auth/login', {
    body: { username: 'newclient', password: 'p123' },
  })).status, 401)
  await login('newclient', 'p456')

  assert.equal((await api('DELETE', `/admin/accounts/${created.data.id}`, { token: admin.token })).status, 200)
  assert.equal((await api('POST', '/auth/login', {
    body: { username: 'newclient', password: 'p456' },
  })).status, 401)

  const adminId = db.prepare("SELECT id FROM accounts WHERE username = 'admin'").get().id
  assert.equal((await api('DELETE', `/admin/accounts/${adminId}`, { token: admin.token })).status, 400)
})

test('管理端：分组匹配与未分配订单派发', async () => {
  const admin = await login('admin', 'muye2026')
  const client = await login('yahe', '123456')

  const cg = await api('POST', '/admin/client-groups', {
    token: admin.token,
    body: { name: '测试组' },
  })
  assert.equal(cg.status, 200)
  assert.equal((await api('POST', '/admin/clients/c-yahe/group', {
    token: admin.token,
    body: { clientGroupId: cg.data.id },
  })).status, 200)

  const created = await api('POST', '/orders', {
    token: client.token,
    body: {
      type: 'jike',
      urgent: false,
      teeth: ['36'],
      requirement: '测试',
      scanFiles: [{ name: 'scan.stl' }],
      images: [{ name: 'photo.jpg' }],
    },
  })
  assert.equal(created.status, 200)
  assert.equal(created.data.unassigned, true)

  const orderId = created.data.order.id
  assert.equal((await api('POST', `/admin/orders/${orderId}/dispatch`, { token: admin.token })).status, 400)
  assert.equal((await api('POST', '/admin/assignments', {
    token: admin.token,
    body: { clientGroupId: cg.data.id, designerGroupId: 'g-a' },
  })).status, 200)
  assert.equal((await api('POST', `/admin/orders/${orderId}/dispatch`, { token: admin.token })).status, 200)

  const designer = await login('li', '123456')
  const designerData = (await api('GET', '/bootstrap', { token: designer.token })).data
  assert.ok(designerData.orders.some((o) => o.id === orderId && o.status === 'pending'))
})

test('管理端：设计参数保存后客户可见', async () => {
  const admin = await login('admin', 'muye2026')
  assert.equal((await api('POST', '/admin/design-params', {
    token: admin.token,
    body: { clientId: 'c-yahe', innerCrown: 0.05, occlusalCut: 0.2, proximalCut: -0.05 },
  })).status, 200)

  const client = await login('yahe', '123456')
  const data = (await api('GET', '/bootstrap', { token: client.token })).data
  assert.equal(data.designParams.length, 1)
  assert.equal(data.designParams[0].innerCrown, 0.05)
})

test('消息：单条已读且不能读别人的消息', async () => {
  const client = await login('mingzhou', '123456')
  const li = await login('li', '123456')

  const created = await api('POST', '/orders', {
    token: client.token,
    body: {
      type: 'quanci',
      urgent: false,
      teeth: ['11'],
      requirement: '测试',
      scanFiles: [{ name: 'scan.stl' }],
      images: [{ name: 'photo.jpg' }],
    },
  })
  const orderId = created.data.order.id
  await api('POST', `/orders/${orderId}/accept`, { token: li.token })
  await api('POST', `/orders/${orderId}/submit-design`, { token: li.token, body: { files: [{ name: 'design.stl' }] } })

  let data = (await api('GET', '/bootstrap', { token: client.token })).data
  const notice = data.notices.find((n) => n.orderId === orderId)
  assert.ok(notice)
  assert.equal(notice.read, false)

  // 他人 token 不能标记这条消息
  const other = await login('hengmei', '123456')
  await api('POST', `/notices/${notice.id}/read`, { token: other.token })
  data = (await api('GET', '/bootstrap', { token: client.token })).data
  assert.equal(data.notices.find((n) => n.id === notice.id).read, false)

  // 本人标记已读
  const ok = await api('POST', `/notices/${notice.id}/read`, { token: client.token })
  assert.equal(ok.status, 200)
  data = (await api('GET', '/bootstrap', { token: client.token })).data
  assert.equal(data.notices.find((n) => n.id === notice.id).read, true)
})

test('医院：看不到其他医院的订单，也无法操作他人订单', async () => {
  const mingzhou = await login('mingzhou', '123456')
  const hengmei = await login('hengmei', '123456')

  // mingzhou 提交一单
  const created = await api('POST', '/orders', {
    token: mingzhou.token,
    body: {
      type: 'quanci', urgent: false, teeth: ['11'], requirement: '越权测试',
      scanFiles: [{ name: 'scan.stl' }], images: [{ name: 'photo.jpg' }],
    },
  })
  assert.equal(created.status, 200)
  const orderId = created.data.order.id

  // hengmei 的 bootstrap 数据里看不到该订单
  const data = (await api('GET', '/bootstrap', { token: hengmei.token })).data
  assert.ok(!data.orders.some((o) => o.id === orderId))

  // hengmei 试图撤回他人订单被拒
  const cancel = await api('POST', `/orders/${orderId}/cancel`, { token: hengmei.token })
  assert.ok(cancel.status >= 400)

  // hengmei 试图对他人订单申请返工被拒
  const rework = await api('POST', `/orders/${orderId}/rework-requests`, {
    token: hengmei.token,
    body: { reason: '越权', images: [] },
  })
  assert.ok(rework.status >= 400)

  // 订单仍为 pending，未被他人影响
  const mine = (await api('GET', '/bootstrap', { token: mingzhou.token })).data
  assert.equal(mine.orders.find((o) => o.id === orderId).status, 'pending')
})

/* ==================== 补充：管理端分组/账号/消息 与错误兜底 ==================== */

test('管理端：设计师分组 创建/改名/设组长/改备注', async () => {
  const admin = await login('admin', 'muye2026')

  assert.equal((await api('POST', '/admin/groups', { token: admin.token, body: { name: '   ' } })).status, 400)

  const created = await api('POST', '/admin/groups', {
    token: admin.token,
    body: { name: '  新设计师组 ', note: ' 备注 ' },
  })
  assert.equal(created.status, 200)
  const gid = created.data.id

  const renamed = await api('PATCH', `/admin/groups/${gid}`, {
    token: admin.token,
    body: { name: '改名组', leaderId: 'd-wang', note: '新备注' },
  })
  assert.equal(renamed.status, 200)
  const g = db.prepare('SELECT * FROM groups WHERE id = ?').get(gid)
  assert.equal(g.name, '改名组')
  assert.equal(g.leader_id, 'd-wang')
  assert.equal(g.note, '新备注')

  assert.equal((await api('PATCH', '/admin/groups/g-missing', { token: admin.token, body: { name: 'x' } })).status, 404)
})

test('管理端：设计师调组并自动解除他在其他组的组长身份', async () => {
  const admin = await login('admin', 'muye2026')

  assert.equal((await api('POST', '/admin/designers/d-missing/group', { token: admin.token, body: { groupId: 'g-a' } })).status, 404)

  // d-zhao 是 g-b 组长，调去 g-a 后 g-b 组长自动置空
  assert.equal((await api('POST', '/admin/designers/d-zhao/group', { token: admin.token, body: { groupId: 'g-a' } })).status, 200)
  assert.equal(db.prepare('SELECT * FROM designers WHERE id = ?').get('d-zhao').group_id, 'g-a')
  assert.equal(db.prepare('SELECT * FROM groups WHERE id = ?').get('g-b').leader_id, null)

  // d-li 是 g-a 组长，调去 g-b 后 g-a 组长自动置空
  assert.equal((await api('POST', '/admin/designers/d-li/group', { token: admin.token, body: { groupId: 'g-b' } })).status, 200)
  assert.equal(db.prepare('SELECT * FROM groups WHERE id = ?').get('g-a').leader_id, null)

  // 不传分组则移出所有分组
  assert.equal((await api('POST', '/admin/designers/d-wang/group', { token: admin.token, body: {} })).status, 200)
  assert.equal(db.prepare('SELECT * FROM designers WHERE id = ?').get('d-wang').group_id, null)
})

test('管理端：客户分组 改名与删除', async () => {
  const admin = await login('admin', 'muye2026')

  const cg = await api('POST', '/admin/client-groups', { token: admin.token, body: { name: '临时组' } })
  assert.equal(cg.status, 200)
  const cgId = cg.data.id

  assert.equal((await api('PATCH', `/admin/client-groups/${cgId}`, {
    token: admin.token,
    body: { name: '临时组2', note: '备注2' },
  })).status, 200)
  let g = db.prepare('SELECT * FROM client_groups WHERE id = ?').get(cgId)
  assert.equal(g.name, '临时组2')
  assert.equal(g.note, '备注2')

  assert.equal((await api('PATCH', '/admin/client-groups/cg-missing', { token: admin.token, body: { name: 'x' } })).status, 404)

  // 仍有客户的分组不可删
  assert.equal((await api('DELETE', '/admin/client-groups/cg-nb', { token: admin.token })).status, 400)

  // 空分组可删，并顺带清理其匹配关系
  assert.equal((await api('POST', '/admin/assignments', {
    token: admin.token,
    body: { clientGroupId: cgId, designerGroupId: 'g-a' },
  })).status, 200)
  assert.equal((await api('DELETE', `/admin/client-groups/${cgId}`, { token: admin.token })).status, 200)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM client_groups WHERE id = ?').get(cgId).n, 0)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM assignments WHERE client_group_id = ?').get(cgId).n, 0)
})

test('管理端：移除分组匹配规则', async () => {
  const admin = await login('admin', 'muye2026')

  assert.equal((await api('POST', '/admin/assignments', {
    token: admin.token,
    body: { clientGroupId: 'cg-nb', designerGroupId: 'g-c' },
  })).status, 200)
  const asRow = db.prepare("SELECT id FROM assignments WHERE client_group_id = 'cg-nb' AND designer_group_id = 'g-c'").get()
  assert.ok(asRow)

  assert.equal((await api('DELETE', `/admin/assignments/${asRow.id}`, { token: admin.token })).status, 200)
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM assignments WHERE client_group_id = 'cg-nb' AND designer_group_id = 'g-c'").get().n, 0)
})

test('管理端：同时新建设计师账号', async () => {
  const admin = await login('admin', 'muye2026')

  const created = await api('POST', '/admin/accounts', {
    token: admin.token,
    body: {
      username: 'newdesigner',
      password: 'p123',
      role: 'designer',
      newDesigner: { name: '新设计师', phone: '13800000009', idCard: '3301**********0099', certNo: 'JG-2024-0001', groupId: 'g-c' },
    },
  })
  assert.equal(created.status, 200)

  const d = await login('newdesigner', 'p123')
  assert.equal(d.session.role, 'designer')
  const row = db.prepare('SELECT * FROM designers WHERE id = ?').get(d.session.designerId)
  assert.equal(row.name, '新设计师')
  assert.equal(row.group_id, 'g-c')
  assert.equal(row.cert_no, 'JG-2024-0001')
})

test('消息：整组标记已读且不影响其他客户', async () => {
  const client = await login('mingzhou', '123456')
  const other = await login('hengmei', '123456')
  const li = await login('li', '123456')

  const complete = async (token, teeth) => {
    const created = await api('POST', '/orders', {
      token,
      body: { type: 'quanci', urgent: false, teeth, requirement: 'x', scanFiles: [{ name: 's.stl' }], images: [{ name: 'p.jpg' }] },
    })
    assert.equal(created.status, 200)
    await api('POST', `/orders/${created.data.order.id}/accept`, { token: li.token })
    await api('POST', `/orders/${created.data.order.id}/submit-design`, { token: li.token, body: { files: [{ name: 'd.stl' }] } })
  }
  await complete(client.token, ['11'])
  await complete(client.token, ['12'])
  await complete(other.token, ['21'])

  const unreadOf = (cid) => db.prepare('SELECT COUNT(*) AS n FROM notices WHERE client_id = ? AND is_read = 0').get(cid).n
  assert.equal(unreadOf('c-mingzhou'), 2)
  assert.equal(unreadOf('c-hengmei'), 1)

  assert.equal((await api('POST', '/notices/read-all', { token: client.token })).status, 200)
  assert.equal(unreadOf('c-mingzhou'), 0)
  assert.equal(unreadOf('c-hengmei'), 1)
})

test('服务器内部错误兜底：返回 500 JSON 且不泄漏堆栈', async () => {
  const admin = await login('admin', 'muye2026')
  const r = await api('POST', '/admin/accounts', {
    token: admin.token,
    body: { username: 'bad-kind', password: 'p', role: 'client', newClient: { name: 'x', phone: '1', kind: 'dog' } },
  })
  assert.equal(r.status, 500)
  assert.match(r.data.error, /服务器内部错误/)
})

/* ==================== 大文件上传凭证（OSS 直传） ==================== */

test('文件上传凭证：参数校验与未配置 OSS 的兜底', async () => {
  const client = await login('mingzhou', '123456')

  assert.equal((await api('POST', '/files/upload-token', { token: client.token, body: {} })).status, 400)
  assert.equal((await api('POST', '/files/upload-token', { token: client.token, body: { name: 'x.stl' } })).status, 400)
  assert.equal((await api('POST', '/files/upload-token', { token: client.token, body: { name: 'x.stl', size: 0 } })).status, 400)

  // 确保本用例环境未配置 OSS；超过 1GB 上限在签 OSS 之前就拦截
  delete process.env.OSS_BUCKET
  delete process.env.OSS_ACCESS_KEY_ID
  delete process.env.OSS_ACCESS_KEY_SECRET
  const big = await api('POST', '/files/upload-token', {
    token: client.token,
    body: { name: 'x.stl', size: 1024 * 1024 * 1024 + 1 },
  })
  assert.equal(big.status, 400)
  assert.match(big.data.error, /1GB/)

  const noOss = await api('POST', '/files/upload-token', {
    token: client.token,
    body: { name: 'x.stl', size: 100 },
  })
  assert.equal(noOss.status, 400)
  assert.match(noOss.data.error, /OSS/)
})

test('文件上传凭证：配置 OSS 后签发直传地址，订单 key 文件转为签名下载地址', async () => {
  const client = await login('mingzhou', '123456')
  process.env.OSS_REGION = 'oss-cn-hangzhou'
  process.env.OSS_BUCKET = 'test-bucket'
  process.env.OSS_ACCESS_KEY_ID = 'test-key'
  process.env.OSS_ACCESS_KEY_SECRET = 'test-secret'
  try {
    const r = await api('POST', '/files/upload-token', {
      token: client.token,
      body: { name: 'scan.stl', size: 600 * 1024 * 1024 },
    })
    assert.equal(r.status, 200)
    assert.ok(r.data.key.startsWith('uploads/'))
    assert.ok(r.data.key.endsWith('.stl'))
    assert.match(r.data.uploadUrl, /test-bucket\.oss-cn-hangzhou\.aliyuncs\.com/)

    // 订单里含 key 的文件 → bootstrap 返回签名下载地址
    const created = await api('POST', '/orders', {
      token: client.token,
      body: {
        type: 'quanci', urgent: false, teeth: ['11'], requirement: 'x',
        scanFiles: [{ name: 'scan.stl', key: r.data.key, size: 600 * 1024 * 1024 }],
        images: [{ name: 'p.jpg', key: 'uploads/2026-08-23/abc.jpg', size: 100 }],
      },
    })
    assert.equal(created.status, 200)
    const data = (await api('GET', '/bootstrap', { token: client.token })).data
    const order = data.orders.find((o) => o.id === created.data.order.id)
    assert.ok(order.scanFiles[0].url.includes('test-bucket'))
    assert.ok(order.images[0].url.includes('test-bucket'))
  } finally {
    delete process.env.OSS_REGION
    delete process.env.OSS_BUCKET
    delete process.env.OSS_ACCESS_KEY_ID
    delete process.env.OSS_ACCESS_KEY_SECRET
  }
})
