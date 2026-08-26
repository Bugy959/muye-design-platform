// 后端同步层测试：mock window + fetch，验证 store.ts 的 P0 后端同步逻辑与 api.ts 客户端
// 运行：node --test（与其它测试文件同目录，node --test 自动发现）
import { test } from 'node:test'
import assert from 'node:assert/strict'

// —— 后端模式环境：isBackendMode() 需要 window 存在且 localStorage 无 demo 标记 ——
globalThis.window = {}
globalThis.localStorage = {
  _data: {},
  getItem(k) { return this._data[k] ?? null },
  setItem(k, v) { this._data[k] = String(v) },
  removeItem(k) { delete this._data[k] },
}
// 预置登录会话 token（SESSION_KEY = 'muye-session-v1'）
localStorage.setItem('muye-session-v1', JSON.stringify({ token: 'test-token', role: 'admin', username: 'admin' }))

const calls = []
let fetchImpl = () => { throw new Error('未配置 fetch 实现') }
globalThis.fetch = async (url, opts = {}) => {
  calls.push({ url: String(url), method: opts.method ?? 'GET', auth: opts.headers?.Authorization })
  return fetchImpl(String(url), opts)
}

const json = (status, data) => ({ ok: status >= 200 && status < 300, status, json: async () => data })

// —— import（顶层 load() 会把种子数据写入 localStorage）——
const store = await import('../src/lib/store.ts')
const api = await import('../src/lib/api.ts')

const readDB = () => JSON.parse(globalThis.localStorage.getItem('muye-design-platform-v5'))
const flush = () => new Promise((r) => setTimeout(r, 40))

/** 服务端 bootstrap 数据：1 客户 / 1 设计师 / 1 组 / 1 订单 / 1 消息，缺 reworks/designParams 等表以验证补空 */
const remoteWith = (over = {}) => ({
  clients: [{ id: 'c-mingzhou', name: '明州口腔医院', phone: '0574-1', kind: 'hospital', points: 500, clientGroupId: 'cg-nb', createdAt: '2026-01-01T00:00:00' }],
  designers: [{ id: 'd-li', name: '李二', phone: '13800000000', idCard: '', certNo: '', groupId: 'g-a', createdAt: '2026-01-01T00:00:00' }],
  groups: [{ id: 'g-a', name: 'A组', leaderId: 'd-li', note: '', createdAt: '2026-01-01T00:00:00' }],
  clientGroups: [{ id: 'cg-nb', name: '宁波', note: '', createdAt: '2026-01-01T00:00:00' }],
  assignments: [{ id: 'as-1', clientGroupId: 'cg-nb', designerGroupId: 'g-a', createdAt: '2026-01-01T00:00:00' }],
  orders: [{
    id: 'o-1', no: 'MY-999', clientId: 'c-mingzhou', patient: '测试患者', type: 'quanci', urgent: false,
    teeth: ['11'], custom: false, customCount: 0, arch: undefined, requirement: '', points: 5, status: 'pending',
    designerId: undefined, acceptedAt: undefined, completedAt: undefined, returnedAt: undefined, cancelledAt: undefined,
    isRework: false, reworkCount: 0, reworkReason: undefined, scanFiles: [], images: [], designFiles: [],
    createdAt: '2026-08-21T10:00:00',
  }],
  reworks: [], designParams: [], txns: [], accounts: [],
  notices: [{ id: 'n-1', clientId: 'c-mingzhou', orderId: 'o-1', text: '完成提醒', read: false, createdAt: '2026-08-21T10:01:00' }],
  ...over,
})

/* ---------------- api.ts ---------------- */

test('isBackendMode: 默认后端模式，demo 标记切演示', () => {
  assert.equal(api.isBackendMode(), true)
  localStorage.setItem('muye-data-mode', 'demo')
  assert.equal(api.isBackendMode(), false)
  localStorage.removeItem('muye-data-mode')
  assert.equal(api.isBackendMode(), true)
})

test('apiFetch: 非 ok 抛服务端 error 消息', async () => {
  fetchImpl = () => json(400, { error: '请填写设计要求' })
  await assert.rejects(api.apiFetch('/orders', { method: 'POST', body: {} }), /请填写设计要求/)
})

test('apiFetch: 非 JSON 响应抛状态码消息', async () => {
  fetchImpl = () => ({ ok: false, status: 502, json: async () => { throw new Error('not json') } })
  await assert.rejects(api.apiFetch('/x'), /请求失败（502）/)
})

test('apiFetch: 携带 Bearer token', async () => {
  calls.length = 0
  fetchImpl = () => json(200, { ok: true })
  await api.apiFetch('/bootstrap', { token: 'tok-1' })
  assert.equal(calls[0].auth, 'Bearer tok-1')
})

/* ---------------- refreshFromServer / initBackend ---------------- */

test('refreshFromServer: 成功用服务端数据覆盖本地并携带 Bearer token', async () => {
  calls.length = 0
  fetchImpl = (url) => (url.endsWith('/bootstrap') ? json(200, remoteWith()) : json(404, {}))
  const ok = await store.refreshFromServer()
  assert.equal(ok, true)
  const d = readDB()
  assert.equal(d.orders.length, 1)
  assert.equal(d.orders[0].no, 'MY-999')
  assert.equal(d.clients[0].points, 500)
  assert.equal(d.reworks.length, 0) // normalizeRemote 补齐缺失表
  assert.ok(calls.some((c) => c.url.endsWith('/bootstrap') && c.auth === 'Bearer test-token'))
})

test('refreshFromServer: 并发调用合并并补一轮', async () => {
  calls.length = 0
  let n = 0
  fetchImpl = (url) => { if (url.endsWith('/bootstrap')) n += 1; return json(200, remoteWith()) }
  const p1 = store.refreshFromServer()
  const p2 = store.refreshFromServer()
  assert.equal(p1, p2) // 并发调用返回同一 promise（单飞合并）
  await p1
  // 刷新期间有排队请求 → 完成后补一轮：初始 1 次 + 补轮 1 次
  assert.equal(n, 2)
})

test('refreshFromServer: 请求失败返回 false 且本地数据保持上次刷新结果', async () => {
  fetchImpl = () => { throw new Error('network down') }
  const ok = await store.refreshFromServer()
  assert.equal(ok, false)
  assert.equal(readDB().orders.length, 1)
})

test('refreshFromServer / initBackend: 无 token 时短路不请求', async () => {
  localStorage.removeItem('muye-session-v1')
  calls.length = 0
  fetchImpl = () => json(200, remoteWith())
  assert.equal(await store.refreshFromServer(), false)
  assert.equal(await store.initBackend(), false)
  assert.equal(calls.length, 0)
  localStorage.setItem('muye-session-v1', JSON.stringify({ token: 'test-token', role: 'admin', username: 'admin' }))
})

test('initBackend: 演示模式直接返回 true 不请求', async () => {
  localStorage.setItem('muye-data-mode', 'demo')
  calls.length = 0
  assert.equal(await store.initBackend(), true)
  assert.equal(calls.length, 0)
  localStorage.removeItem('muye-data-mode')
})

/* ---------------- sync 业务函数（乐观更新 + 推送 + 刷新/回滚） ---------------- */

test('markNoticeRead: 乐观已读 + 推送后端 + 服务端刷新', async () => {
  fetchImpl = (url) => (url.endsWith('/bootstrap') ? json(200, remoteWith()) : json(200, { ok: true }))
  await store.refreshFromServer()
  calls.length = 0
  store.markNoticeRead('n-1')
  assert.equal(readDB().notices.find((x) => x.id === 'n-1').read, true) // 乐观更新立即生效
  await flush()
  assert.ok(calls.some((c) => c.url.endsWith('/notices/n-1/read') && c.method === 'POST'))
  assert.ok(calls.some((c) => c.url.endsWith('/bootstrap')))
})

test('adjustPoints: 同步失败自动回滚为服务端数据', async () => {
  fetchImpl = (url) => (url.endsWith('/bootstrap') ? json(200, remoteWith()) : json(200, { ok: true }))
  await store.refreshFromServer() // 服务端余额 500
  calls.length = 0
  fetchImpl = (url) => (url.endsWith('/bootstrap') ? json(200, remoteWith()) : json(500, { error: '扣减后积分不能为负' }))
  const ret = store.adjustPoints('c-mingzhou', -50, '测试扣减')
  assert.equal(ret, true)
  assert.equal(readDB().clients[0].points, 450) // 本地乐观更新
  await flush() // 等待 sync 失败 → 回滚
  assert.equal(readDB().clients[0].points, 500)
})

test('adjustPoints: 余额不足本地拦截不调后端', () => {
  assert.equal(store.adjustPoints('c-mingzhou', -99999, 'x'), false)
  assert.equal(readDB().clients[0].points, 500)
})

/* ---------------- 后端模式异步变体 ---------------- */

test('createOrderAsync: 后端模式返回服务端单号', async () => {
  calls.length = 0
  const newOrder = { ...remoteWith().orders[0], id: 'o-new', no: 'MY-1001' }
  fetchImpl = (url, opts) => {
    if (url.endsWith('/orders') && opts.method === 'POST') return json(200, { order: newOrder })
    if (url.endsWith('/bootstrap')) return json(200, remoteWith({ orders: [newOrder] }))
    return json(404, {})
  }
  const input = { clientId: 'c-mingzhou', type: 'quanci', urgent: false, teeth: ['11'], requirement: '', scanFiles: [], images: [] }
  const o = await store.createOrderAsync(input)
  assert.ok(o)
  assert.equal(o.no, 'MY-1001')
  assert.ok(calls.some((c) => c.url.endsWith('/orders') && c.method === 'POST'))
  assert.ok(calls.some((c) => c.url.endsWith('/bootstrap')))
})

test('createOrderAsync: 无 token 返回 null', async () => {
  localStorage.removeItem('muye-session-v1')
  const input = { clientId: 'c-mingzhou', type: 'quanci', urgent: false, teeth: ['11'], requirement: '', scanFiles: [], images: [] }
  assert.equal(await store.createOrderAsync(input), null)
  localStorage.setItem('muye-session-v1', JSON.stringify({ token: 'test-token', role: 'admin', username: 'admin' }))
})

test('acceptOrderAsync: 成功返回 ok', async () => {
  fetchImpl = (url) => (url.endsWith('/accept') ? json(200, { ok: true }) : json(200, remoteWith()))
  const r = await store.acceptOrderAsync('o-1', 'd-li')
  assert.deepEqual(r, { ok: true })
})

test('acceptOrderAsync: 失败透传服务端"手慢了"', async () => {
  fetchImpl = (url) => (url.endsWith('/accept') ? json(409, { error: '手慢了，该订单已被其他设计师接走' }) : json(200, remoteWith()))
  const r = await store.acceptOrderAsync('o-1', 'd-li')
  assert.equal(r.ok, false)
  assert.match(r.error, /手慢了/)
})

test('dispatchUnassignedOrderAsync: 成功与失败', async () => {
  fetchImpl = (url) => (url.endsWith('/dispatch') ? json(200, { ok: true }) : json(200, remoteWith()))
  assert.equal(await store.dispatchUnassignedOrderAsync('o-1'), true)
  fetchImpl = (url) => (url.endsWith('/dispatch') ? json(500, { error: '无法派发' }) : json(200, remoteWith()))
  assert.equal(await store.dispatchUnassignedOrderAsync('o-1'), false)
})

/* ---------------- 其它 ---------------- */

test('resetDB: 恢复种子数据', () => {
  store.resetDB()
  const d = readDB()
  assert.equal(d.orders.length, 7) // 种子含 7 条演示订单
  assert.equal(d.seq, 8)
  assert.ok(d.clients.some((c) => c.id === 'c-mingzhou' && c.points === 361))
})

/* ---------------- 补充：坏 token / initBackend / 分组与账号异步变体 ---------------- */

test('tokenOf: 会话数据损坏时不发起请求且不抛错', async () => {
  localStorage.setItem('muye-session-v1', '{broken')
  calls.length = 0
  fetchImpl = () => json(200, remoteWith())
  assert.equal(await store.refreshFromServer(), false)
  assert.equal(await store.initBackend(), false)
  assert.equal(calls.length, 0)
  localStorage.setItem('muye-session-v1', JSON.stringify({ token: 'test-token', role: 'admin', username: 'admin' }))
})

test('initBackend: 有 token 时返回服务端刷新结果', async () => {
  calls.length = 0
  fetchImpl = (url) => (url.endsWith('/bootstrap') ? json(200, remoteWith()) : json(404, {}))
  assert.equal(await store.initBackend(), true)
  assert.ok(calls.some((c) => c.url.endsWith('/bootstrap') && c.auth === 'Bearer test-token'))
})

test('createClientGroupAsync: 后端模式成功返回分组并触发刷新', async () => {
  calls.length = 0
  fetchImpl = (url) => {
    if (url.endsWith('/admin/client-groups')) return json(200, { ok: true, id: 'cg-new' })
    if (url.endsWith('/bootstrap')) return json(200, remoteWith())
    return json(404, {})
  }
  const g = await store.createClientGroupAsync('  新客户组  ', ' 备注 ')
  assert.equal(g.id, 'cg-new')
  assert.equal(g.name, '新客户组')
  assert.equal(g.note, '备注')
  assert.ok(calls.some((c) => c.url.endsWith('/admin/client-groups') && c.method === 'POST'))
  assert.ok(calls.some((c) => c.url.endsWith('/bootstrap')))
})

test('createClientGroupAsync: 演示模式直接本地创建', async () => {
  localStorage.setItem('muye-data-mode', 'demo')
  calls.length = 0
  const g = await store.createClientGroupAsync('演示组')
  assert.ok(g.id.startsWith('cg-'))
  assert.equal(readDB().clientGroups.some((x) => x.id === g.id && x.name === '演示组'), true)
  assert.equal(calls.length, 0)
  localStorage.removeItem('muye-data-mode')
})

test('createClientGroupAsync: 无 token 抛未登录', async () => {
  localStorage.removeItem('muye-session-v1')
  await assert.rejects(store.createClientGroupAsync('x'), /未登录/)
  localStorage.setItem('muye-session-v1', JSON.stringify({ token: 'test-token', role: 'admin', username: 'admin' }))
})

test('registerDesignerGroupAsync: 后端模式成功返回分组', async () => {
  calls.length = 0
  fetchImpl = (url) => {
    if (url.endsWith('/admin/groups')) return json(200, { ok: true, id: 'g-new' })
    if (url.endsWith('/bootstrap')) return json(200, remoteWith())
    return json(404, {})
  }
  const g = await store.registerDesignerGroupAsync('新组', '夜班')
  assert.equal(g.id, 'g-new')
  assert.equal(g.name, '新组')
  assert.equal(g.note, '夜班')
  assert.ok(calls.some((c) => c.url.endsWith('/admin/groups') && c.method === 'POST'))
})

test('registerDesignerGroupAsync: 演示模式直接本地创建', async () => {
  localStorage.setItem('muye-data-mode', 'demo')
  calls.length = 0
  const g = await store.registerDesignerGroupAsync('本地组')
  assert.equal(readDB().groups.some((x) => x.id === g.id && x.name === '本地组'), true)
  assert.equal(calls.length, 0)
  localStorage.removeItem('muye-data-mode')
})

test('createAccountAsync: 演示模式本地创建，后端模式推送并刷新', async () => {
  localStorage.setItem('muye-data-mode', 'demo')
  calls.length = 0
  await store.createAccountAsync({
    username: 'demo-user',
    password: 'p',
    role: 'client',
    newClient: { name: '演示医院', phone: '13800000000', kind: 'hospital' },
  })
  assert.equal(readDB().accounts.some((a) => a.username === 'demo-user'), true)
  assert.equal(calls.length, 0)
  localStorage.removeItem('muye-data-mode')

  calls.length = 0
  fetchImpl = (url) => {
    if (url.endsWith('/admin/accounts')) return json(200, { ok: true, id: 'a-new' })
    if (url.endsWith('/bootstrap')) return json(200, remoteWith())
    return json(404, {})
  }
  await store.createAccountAsync({ username: 'net-user', password: 'p', role: 'client', clientId: 'c-mingzhou' })
  assert.ok(calls.some((c) => c.url.endsWith('/admin/accounts') && c.method === 'POST'))
  assert.ok(calls.some((c) => c.url.endsWith('/bootstrap')))
})

test('uploadOrderFile: 小文件用单次直传', async () => {
  calls.length = 0
  let putCalls = 0
  fetchImpl = (url) => (url.endsWith('/files/upload-token') ? json(200, { key: 'uploads/2026-08-23/abc.stl', uploadUrl: 'https://oss.example/abc.stl' }) : json(404, {}))

  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, opts = {}) => {
    if (String(url) === 'https://oss.example/abc.stl' && opts.method === 'PUT') { putCalls += 1; return { ok: true, status: 200, json: async () => ({}) } }
    return originalFetch(url, opts)
  }
  try {
    const f = await store.uploadOrderFile({ name: 'scan.stl', size: 1024 * 1024 })
    assert.deepEqual(f, { name: 'scan.stl', key: 'uploads/2026-08-23/abc.stl', size: 1024 * 1024 })
    assert.equal(putCalls, 1)
    assert.ok(calls.some((c) => c.url.endsWith('/files/upload-token') && c.method === 'POST'))
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('uploadOrderFile: 未登录时抛错', async () => {
  localStorage.removeItem('muye-session-v1')
  await assert.rejects(store.uploadOrderFile({ name: 'x.stl', size: 1 }), /未登录/)
  localStorage.setItem('muye-session-v1', JSON.stringify({ token: 'test-token', role: 'admin', username: 'admin' }))
})

test('readOrderFile: 大文件在后端模式走 OSS 直传', async () => {
  calls.length = 0
  let putCalls = 0
  fetchImpl = (url) => (url.endsWith('/files/upload-token') ? json(200, { key: 'uploads/2026-08-23/big.stl', uploadUrl: 'https://oss.example/big.stl' }) : json(404, {}))

  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, opts = {}) => {
    if (String(url) === 'https://oss.example/big.stl' && opts.method === 'PUT') { putCalls += 1; return { ok: true, status: 200, json: async () => ({}) } }
    return originalFetch(url, opts)
  }
  try {
    const f = await store.readOrderFile({ name: 'big.stl', size: 2 * 1024 * 1024 })
    assert.deepEqual(f, { name: 'big.stl', key: 'uploads/2026-08-23/big.stl', size: 2 * 1024 * 1024 })
    assert.equal(putCalls, 1)
    assert.ok(calls.some((c) => c.url.endsWith('/files/upload-token') && c.method === 'POST'))
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('readOrderFile: OSS 不可用时大文件回退为仅记录文件名', async () => {
  calls.length = 0
  fetchImpl = () => json(400, { error: '未配置 OSS 环境变量（OSS_BUCKET / OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET）' })
  const f = await store.readOrderFile({ name: 'big.stl', size: 2 * 1024 * 1024 })
  assert.deepEqual(f, { name: 'big.stl', size: 2 * 1024 * 1024 })
})

test('readOrderFile: 小文件在后端模式仍内嵌 dataUrl，不调 OSS', async () => {
  calls.length = 0
  class FakeFileReader {
    readAsDataURL() { this.result = 'data:application/octet-stream;base64,ok'; this.onload?.() }
  }
  globalThis.FileReader = FakeFileReader
  try {
    const f = await store.readOrderFile({ name: 'ok.stl', size: 100 })
    assert.equal(f.dataUrl, 'data:application/octet-stream;base64,ok')
    assert.equal(calls.length, 0)
  } finally {
    delete globalThis.FileReader
  }
})

test('uploadOrderFile: 大文件走分片直传并合并', async () => {
  calls.length = 0
  const size = 51 * 1024 * 1024
  const parts = Math.ceil(size / (5 * 1024 * 1024)) // 11
  let partPuts = 0
  const etagFor = (n) => `"${String(n).padStart(32, '0')}"`
  fetchImpl = (url) => {
    if (url.endsWith('/files/upload-init')) return json(200, { key: 'uploads/2026-08-24/big.stl', uploadId: 'uid-1' })
    if (url.endsWith('/files/upload-part-url')) return json(200, { uploadUrl: 'https://oss.example/part' })
    if (url.endsWith('/files/upload-complete')) return json(200, { ok: true })
    return json(404, {})
  }
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, opts = {}) => {
    if (String(url) === 'https://oss.example/part' && opts.method === 'PUT') {
      partPuts += 1
      return { ok: true, status: 200, headers: new Headers({ ETag: etagFor(partPuts) }), json: async () => ({}) }
    }
    return originalFetch(url, opts)
  }
  try {
    const file = new File([new Uint8Array(size)], 'big.stl', { lastModified: 123 })
    let lastPercent = -1
    const f = await store.uploadOrderFile(file, (p) => { lastPercent = p.percent })
    assert.deepEqual(f, { name: 'big.stl', key: 'uploads/2026-08-24/big.stl', size })
    assert.equal(partPuts, parts)
    assert.equal(lastPercent, 100)
    assert.ok(calls.some((c) => c.url.endsWith('/files/upload-init') && c.method === 'POST'))
    assert.ok(calls.some((c) => c.url.endsWith('/files/upload-complete') && c.method === 'POST'))
    // 完成后检查点已清理
    assert.equal(globalThis.localStorage.getItem(`muye-upload-${size}-123-big.stl`), null)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('uploadOrderFile: 断点续传，跳过已完成分片', async () => {
  calls.length = 0
  const size = 51 * 1024 * 1024
  const parts = Math.ceil(size / (5 * 1024 * 1024)) // 11
  let partPuts = 0
  let completeParts = null
  const etagFor = (n) => `"${String(n).padStart(32, '0')}"`
  // 预置检查点：前 3 片已完成（含 etag）
  globalThis.localStorage.setItem(`muye-upload-${size}-456-big.stl`, JSON.stringify({
    key: 'uploads/2026-08-24/big.stl', uploadId: 'uid-9', done: [1, 2, 3],
    etags: { 1: etagFor(1), 2: etagFor(2), 3: etagFor(3) },
  }))
  fetchImpl = (url, opts = {}) => {
    if (url.endsWith('/files/upload-part-url')) return json(200, { uploadUrl: 'https://oss.example/part' })
    if (url.endsWith('/files/upload-complete')) { completeParts = JSON.parse(opts.body).parts; return json(200, { ok: true }) }
    return json(404, {})
  }
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, opts = {}) => {
    if (String(url) === 'https://oss.example/part' && opts.method === 'PUT') {
      partPuts += 1
      return { ok: true, status: 200, headers: new Headers({ ETag: etagFor(partPuts + 3) }), json: async () => ({}) }
    }
    return originalFetch(url, opts)
  }
  try {
    const file = new File([new Uint8Array(size)], 'big.stl', { lastModified: 456 })
    const f = await store.uploadOrderFile(file)
    assert.equal(partPuts, parts - 3)          // 只补传剩余 8 片
    assert.equal(completeParts.length, parts)  // 合并全部 11 片
    assert.equal(completeParts[0].number, 1)
    assert.equal(completeParts[parts - 1].number, parts)
    assert.deepEqual(f, { name: 'big.stl', key: 'uploads/2026-08-24/big.stl', size })
    assert.equal(globalThis.localStorage.getItem(`muye-upload-${size}-456-big.stl`), null)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('uploadOrderFile: 分片中途失败保留检查点，可在下次续传', async () => {
  calls.length = 0
  const size = 51 * 1024 * 1024
  const parts = Math.ceil(size / (5 * 1024 * 1024)) // 11
  let partPuts = 0
  const etagFor = (n) => `"${String(n).padStart(32, '0')}"`
  fetchImpl = (url) => {
    if (url.endsWith('/files/upload-init')) return json(200, { key: 'uploads/2026-08-24/big.stl', uploadId: 'uid-7' })
    if (url.endsWith('/files/upload-part-url')) return json(200, { uploadUrl: 'https://oss.example/part' })
    return json(404, {})
  }
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, opts = {}) => {
    if (String(url) === 'https://oss.example/part' && opts.method === 'PUT') {
      partPuts += 1
      if (partPuts > 1) return { ok: false, status: 500, json: async () => ({}) } // 第 2 个分片起持续失败（含重试），验证整体失败
      return { ok: true, status: 200, headers: new Headers({ ETag: etagFor(partPuts) }), json: async () => ({}) }
    }
    return originalFetch(url, opts)
  }
  try {
    const file = new File([new Uint8Array(size)], 'big.stl', { lastModified: 789 })
    await assert.rejects(store.uploadOrderFile(file), /500/)
    // 检查点保留：done 里至少有第 1 片
    const ck = JSON.parse(globalThis.localStorage.getItem(`muye-upload-${size}-789-big.stl`))
    assert.equal(ck.uploadId, 'uid-7')
    assert.ok(ck.done.length >= 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('readOrderFile: 大文件 OSS 直传时透传进度回调', async () => {
  calls.length = 0
  fetchImpl = (url) => (url.endsWith('/files/upload-token') ? json(200, { key: 'uploads/2026-08-23/p.stl', uploadUrl: 'https://oss.example/p.stl' }) : json(404, {}))
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, opts = {}) => {
    if (String(url) === 'https://oss.example/p.stl' && opts.method === 'PUT') return { ok: true, status: 200, json: async () => ({}) }
    return originalFetch(url, opts)
  }
  try {
    let last = -1
    const f = await store.readOrderFile({ name: 'p.stl', size: 2 * 1024 * 1024 }, (p) => { last = p.percent })
    assert.deepEqual(f, { name: 'p.stl', key: 'uploads/2026-08-23/p.stl', size: 2 * 1024 * 1024 })
    assert.equal(last, 100)
  } finally {
    globalThis.fetch = originalFetch
  }
})
test('refreshFileUrl: 通过后端重新签发实时下载地址（2.7）', async () => {
  calls.length = 0
  fetchImpl = (url) => (url.endsWith('/files/download-url') ? json(200, { url: 'https://oss.example/signed?v=2' }) : json(404, {}))
  const url = await store.refreshFileUrl({ key: 'uploads/x/a.stl' })
  assert.equal(url, 'https://oss.example/signed?v=2')
  assert.ok(calls.some((c) => c.url.endsWith('/files/download-url') && c.method === 'POST'))
})

test('uploadOrderFile: complete 失败（uploadId 失效）时清检查点重新 init 整传（2.5）', async () => {
  calls.length = 0
  const size = 51 * 1024 * 1024
  const parts = Math.ceil(size / (5 * 1024 * 1024)) // 11
  let inits = 0
  let completes = 0
  let partPuts = 0
  const etagFor = (n) => `"${String(n).padStart(32, '0')}"`
  fetchImpl = (url, opts = {}) => {
    if (url.endsWith('/files/upload-init')) { inits += 1; return json(200, { key: `uploads/2026-08-24/big-${inits}.stl`, uploadId: `uid-${inits}` }) }
    if (url.endsWith('/files/upload-part-url')) return json(200, { uploadUrl: 'https://oss.example/part' })
    if (url.endsWith('/files/upload-complete')) {
      completes += 1
      if (completes === 1) return json(500, { error: 'NoSuchUpload（分片 uploadId 已失效）' })
      return json(200, { ok: true })
    }
    return json(404, {})
  }
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, opts = {}) => {
    if (String(url) === 'https://oss.example/part' && opts.method === 'PUT') {
      partPuts += 1
      return { ok: true, status: 200, headers: new Headers({ ETag: etagFor(partPuts) }), json: async () => ({}) }
    }
    return originalFetch(url, opts)
  }
  try {
    const file = new File([new Uint8Array(size)], 'big.stl', { lastModified: 111 })
    const f = await store.uploadOrderFile(file)
    assert.ok(f.key.endsWith('big-2.stl'))
    assert.equal(inits, 2)             // 重新 init 一次
    assert.equal(completes, 2)         // 第一次失效失败，第二次成功
    assert.equal(partPuts, parts * 2)  // 两轮各传一遍
    assert.equal(globalThis.localStorage.getItem(`muye-upload-${size}-111-big.stl`), null)
  } finally {
    globalThis.fetch = originalFetch
  }
})
test('uploadOrderFile: 分片 PUT 瞬时失败自动重试后成功（2.5）', async () => {
  calls.length = 0
  const size = 51 * 1024 * 1024
  const parts = Math.ceil(size / (5 * 1024 * 1024)) // 11
  let partPuts = 0

  let retried = false
  const etagFor = (n) => `"${String(n).padStart(32, '0')}"`
  fetchImpl = (url) => {
    if (url.endsWith('/files/upload-init')) return json(200, { key: 'uploads/2026-08-24/big.stl', uploadId: 'uid-1' })
    if (url.endsWith('/files/upload-part-url')) return json(200, { uploadUrl: 'https://oss.example/part' })
    if (url.endsWith('/files/upload-complete')) return json(200, { ok: true })
    return json(404, {})
  }
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, opts = {}) => {
    if (String(url) === 'https://oss.example/part' && opts.method === 'PUT') {
      partPuts += 1

      if (partPuts === 2) { retried = true; return { ok: false, status: 500, json: async () => ({}) } } // 只失败一次
      return { ok: true, status: 200, headers: new Headers({ ETag: etagFor(partPuts) }), json: async () => ({}) }
    }
    return originalFetch(url, opts)
  }
  try {
    const file = new File([new Uint8Array(size)], 'big.stl', { lastModified: 222 })
    const f = await store.uploadOrderFile(file)
    assert.ok(retried, '第 2 个分片应先失败一次')
    assert.deepEqual(f, { name: 'big.stl', key: 'uploads/2026-08-24/big.stl', size })

    assert.ok(partPuts >= parts + 1, '至少重试 1 次（实际 ' + partPuts + ' 次 PUT）') // 11 片 + 至少 1 次重试（并发时序不锁定精确次数）
    assert.equal(globalThis.localStorage.getItem(`muye-upload-${size}-222-big.stl`), null)
  } finally {
    globalThis.fetch = originalFetch
  }
})
