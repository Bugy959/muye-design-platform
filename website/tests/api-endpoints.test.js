// api.ts 全部端点客户端函数测试：mock window + fetch，
// 逐一验证 URL / HTTP 方法 / Bearer 头 / 请求体序列化 / 返回值透传。
// 运行：node --test（与其它测试文件同目录自动发现）
import { test } from 'node:test'
import assert from 'node:assert/strict'

// 后端模式环境：isBackendMode() 需要 window 存在且 localStorage 无 demo 标记
globalThis.window = {}
globalThis.localStorage = {
  _data: {},
  getItem(k) { return this._data[k] ?? null },
  setItem(k, v) { this._data[k] = String(v) },
  removeItem(k) { delete this._data[k] },
}

const calls = []
let fetchImpl = () => { throw new Error('未配置 fetch 实现') }
globalThis.fetch = async (url, opts = {}) => {
  const body = opts.body === undefined ? undefined : JSON.parse(opts.body)
  calls.push({ url: String(url), method: opts.method ?? 'GET', auth: opts.headers?.Authorization, body })
  return fetchImpl(String(url))
}
const json = (status, data) => ({ ok: status >= 200 && status < 300, status, json: async () => data })

const api = await import('../src/lib/api.ts')
const BASE = 'http://localhost:3001/api'
const TOKEN = 't-1'

/** 执行一次调用，断言请求参数与返回值，并返回调用结果 */
async function expectCall(call, { url, method = 'GET', auth = TOKEN, body }) {
  calls.length = 0
  fetchImpl = () => json(200, { ok: true })
  const result = await call()
  assert.equal(calls.length, 1, `${url} 应恰好发起 1 次请求`)
  const c = calls[0]
  assert.equal(c.url, `${BASE}${url}`, `${url} 的请求地址`)
  assert.equal(c.method, method, `${url} 的请求方法`)
  if (auth === null) assert.equal(c.auth, undefined, `${url} 不应携带 token`)
  else assert.equal(c.auth, `Bearer ${auth}`, `${url} 的认证头`)
  if (body !== undefined) assert.deepEqual(c.body, body, `${url} 的请求体`)
  else assert.equal(c.body, undefined, `${url} 不应有请求体`)
  return result
}

test('apiFetch: 无 body 时默认 GET 且不带 token', async () => {
  calls.length = 0
  fetchImpl = () => json(200, { ok: true })
  await api.apiFetch('/health')
  assert.equal(calls[0].url, `${BASE}/health`)
  assert.equal(calls[0].method, 'GET')
  assert.equal(calls[0].auth, undefined)
  assert.equal(calls[0].body, undefined)
})

test('认证与初始化端点', async () => {
  const login = await expectCall(() => api.apiLogin('admin', 'muye2026'), {
    url: '/auth/login', method: 'POST', auth: null, body: { username: 'admin', password: 'muye2026' },
  })
  assert.deepEqual(login, { ok: true })

  await expectCall(() => api.apiLogout(TOKEN), { url: '/auth/logout', method: 'POST' })
  await expectCall(() => api.apiBootstrap(TOKEN), { url: '/bootstrap' })
})

test('订单类端点', async () => {
  const files = [{ name: 'design.stl' }]
  await expectCall(() => api.apiCreateOrder(TOKEN, { type: 'quanci', teeth: ['11'] }), {
    url: '/orders', method: 'POST', body: { type: 'quanci', teeth: ['11'] },
  })
  await expectCall(() => api.apiAcceptOrder(TOKEN, 'o-1'), { url: '/orders/o-1/accept', method: 'POST' })
  await expectCall(() => api.apiDispatchOrder(TOKEN, 'o-1'), { url: '/admin/orders/o-1/dispatch', method: 'POST' })
  await expectCall(() => api.apiSubmitDesign(TOKEN, 'o-1', files), { url: '/orders/o-1/submit-design', method: 'POST', body: { files } })
  await expectCall(() => api.apiReturnOrder(TOKEN, 'o-1', '信息不全'), { url: '/orders/o-1/return', method: 'POST', body: { reason: '信息不全' } })
  await expectCall(() => api.apiResubmitOrder(TOKEN, 'o-1', { teeth: ['11', '21'], customCount: 2, requirement: 'r' }), {
    url: '/orders/o-1/resubmit', method: 'POST', body: { teeth: ['11', '21'], customCount: 2, requirement: 'r' },
  })
  await expectCall(() => api.apiCancelOrder(TOKEN, 'o-1'), { url: '/orders/o-1/cancel', method: 'POST' })
})

test('返工类端点', async () => {
  const images = [{ name: 'p.jpg' }]
  await expectCall(() => api.apiCreateRework(TOKEN, 'o-1', '边缘线需调整', images), {
    url: '/orders/o-1/rework-requests', method: 'POST', body: { reason: '边缘线需调整', images },
  })
  await expectCall(() => api.apiApproveRework(TOKEN, 'rw-1'), { url: '/reworks/rw-1/approve', method: 'POST' })
  await expectCall(() => api.apiRejectRework(TOKEN, 'rw-1'), { url: '/reworks/rw-1/reject', method: 'POST' })
  await expectCall(() => api.apiCancelRework(TOKEN, 'rw-1'), { url: '/reworks/rw-1', method: 'DELETE' })
  await expectCall(() => api.apiUpdateRework(TOKEN, 'rw-1', '新原因', images), { url: '/reworks/rw-1', method: 'PATCH', body: { reason: '新原因', images } })
})

test('消息类端点', async () => {
  await expectCall(() => api.apiMarkNoticeRead(TOKEN, 'n-1'), { url: '/notices/n-1/read', method: 'POST' })
  await expectCall(() => api.apiMarkAllNoticesRead(TOKEN), { url: '/notices/read-all', method: 'POST' })
})

test('管理端：积分与账号', async () => {
  await expectCall(() => api.apiAdjustPoints(TOKEN, 'c-1', -10, '测试扣减'), {
    url: '/admin/points', method: 'POST', body: { clientId: 'c-1', delta: -10, reason: '测试扣减' },
  })
  await expectCall(() => api.apiCreateAccount(TOKEN, { username: 'u', password: 'p', role: 'client' }), {
    url: '/admin/accounts', method: 'POST', body: { username: 'u', password: 'p', role: 'client' },
  })
  await expectCall(() => api.apiResetPassword(TOKEN, 'a-1', 'p2'), { url: '/admin/accounts/a-1/reset-password', method: 'POST', body: { password: 'p2' } })
  await expectCall(() => api.apiDeleteAccount(TOKEN, 'a-1'), { url: '/admin/accounts/a-1', method: 'DELETE' })
})

test('管理端：设计师分组与调组', async () => {
  await expectCall(() => api.apiCreateDesignerGroup(TOKEN, '新组', '备注'), { url: '/admin/groups', method: 'POST', body: { name: '新组', note: '备注' } })
  await expectCall(() => api.apiUpdateGroup(TOKEN, 'g-1', { name: '改名', leaderId: 'd-1', note: '注' }), {
    url: '/admin/groups/g-1', method: 'PATCH', body: { name: '改名', leaderId: 'd-1', note: '注' },
  })
  await expectCall(() => api.apiMoveDesigner(TOKEN, 'd-1', 'g-2'), { url: '/admin/designers/d-1/group', method: 'POST', body: { groupId: 'g-2' } })
  await expectCall(() => api.apiMoveDesigner(TOKEN, 'd-1', undefined), { url: '/admin/designers/d-1/group', method: 'POST', body: { groupId: null } })
})

test('管理端：客户分组与匹配规则', async () => {
  await expectCall(() => api.apiCreateClientGroup(TOKEN, '组A', '备注'), { url: '/admin/client-groups', method: 'POST', body: { name: '组A', note: '备注' } })
  await expectCall(() => api.apiUpdateClientGroup(TOKEN, 'cg-1', { name: '改名', note: '注' }), { url: '/admin/client-groups/cg-1', method: 'PATCH', body: { name: '改名', note: '注' } })
  await expectCall(() => api.apiDeleteClientGroup(TOKEN, 'cg-1'), { url: '/admin/client-groups/cg-1', method: 'DELETE' })
  await expectCall(() => api.apiMoveClient(TOKEN, 'c-1', 'cg-2'), { url: '/admin/clients/c-1/group', method: 'POST', body: { clientGroupId: 'cg-2' } })
  await expectCall(() => api.apiMoveClient(TOKEN, 'c-1', undefined), { url: '/admin/clients/c-1/group', method: 'POST', body: { clientGroupId: null } })
  await expectCall(() => api.apiAddAssignment(TOKEN, 'cg-1', 'g-1'), { url: '/admin/assignments', method: 'POST', body: { clientGroupId: 'cg-1', designerGroupId: 'g-1' } })
  await expectCall(() => api.apiRemoveAssignment(TOKEN, 'as-1'), { url: '/admin/assignments/as-1', method: 'DELETE' })
  await expectCall(() => api.apiSaveDesignParam(TOKEN, 'c-1', 0.1, 0.2, -0.01), {
    url: '/admin/design-params', method: 'POST', body: { clientId: 'c-1', innerCrown: 0.1, occlusalCut: 0.2, proximalCut: -0.01 },
  })
})

test('端点失败：非 ok 透传服务端错误消息', async () => {
  fetchImpl = () => json(400, { error: '请填写分组名' })
  await assert.rejects(api.apiCreateClientGroup(TOKEN, '  '), /请填写分组名/)
})
test('大文件 OSS 端点', async () => {
  const r = await expectCall(() => api.apiGetUploadToken(TOKEN, 'scan.stl', 600 * 1024 * 1024), {
    url: '/files/upload-token', method: 'POST', body: { name: 'scan.stl', size: 600 * 1024 * 1024 },
  })
  assert.deepEqual(r, { ok: true })

  // apiUploadFile：直接 PUT 到预签名地址（不经过后端）
  const originalFetch = globalThis.fetch
  let putSeen = null
  globalThis.fetch = async (url, opts = {}) => {
    putSeen = { url: String(url), method: opts.method, ct: opts.headers?.['Content-Type'], body: opts.body }
    return { ok: true, status: 200, json: async () => ({}) }
  }
  try {
    await api.apiUploadFile('https://oss.example/scan.stl', { name: 'scan.stl', size: 1 })
    assert.equal(putSeen.url, 'https://oss.example/scan.stl')
    assert.equal(putSeen.method, 'PUT')
    assert.equal(putSeen.ct, 'application/octet-stream')
    assert.equal(putSeen.body.size, 1)
  } finally {
    globalThis.fetch = originalFetch
  }

  // OSS 上传失败时抛出状态码消息
  globalThis.fetch = async () => ({ ok: false, status: 403, json: async () => ({}) })
  try {
    await assert.rejects(api.apiUploadFile('https://oss.example/x', { name: 'x', size: 1 }), /403/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('分片上传端点', async () => {
  const init = await expectCall(() => api.apiUploadInit(TOKEN, 'big.stl', 60 * 1024 * 1024), {
    url: '/files/upload-init', method: 'POST', body: { name: 'big.stl', size: 60 * 1024 * 1024 },
  })
  assert.deepEqual(init, { ok: true })
  await expectCall(() => api.apiUploadPartUrl(TOKEN, 'k', 'u1', 3), {
    url: '/files/upload-part-url', method: 'POST', body: { key: 'k', uploadId: 'u1', partNumber: 3 },
  })
  await expectCall(() => api.apiUploadComplete(TOKEN, 'k', 'u1', [{ number: 1, etag: '"abc"' }]), {
    url: '/files/upload-complete', method: 'POST', body: { key: 'k', uploadId: 'u1', parts: [{ number: 1, etag: '"abc"' }] },
  })

  // apiUploadPart：PUT 分片并读取 ETag
  const originalFetch = globalThis.fetch
  let putSeen = null
  globalThis.fetch = async (url, opts = {}) => {
    putSeen = { url: String(url), method: opts.method }
    return { ok: true, status: 200, headers: new Headers({ ETag: '"abc123"' }), json: async () => ({}) }
  }
  try {
    const etag = await api.apiUploadPart('https://oss.example/p', new Blob(['x']))
    assert.equal(etag, '"abc123"')
    assert.equal(putSeen.method, 'PUT')
  } finally { globalThis.fetch = originalFetch }

  // ETag 缺失时报错（提示检查 OSS CORS ExposeHeaders）
  globalThis.fetch = async () => ({ ok: true, status: 200, headers: new Headers({}), json: async () => ({}) })
  try {
    await assert.rejects(api.apiUploadPart('https://oss.example/p', new Blob(['x'])), /ETag/)
  } finally { globalThis.fetch = originalFetch }
})

test('apiFetch: 请求超时抛友好错误（fetchWithTimeout）', async () => {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = (url, opts = {}) => new Promise((_, reject) => {
      opts.signal?.addEventListener('abort', () => reject(opts.signal.reason))
    })
    await assert.rejects(api.fetchWithTimeout('http://x.test/timeout', {}, 30), /请求超时/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('apiFetch: 网络错误原样抛出（非超时）', async () => {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = () => { throw new Error('网络断开') }
    await assert.rejects(api.apiFetch('/health'), /网络断开/)
  } finally {
    globalThis.fetch = originalFetch
  }
})
test('下载签名端点（1.13）', async () => {
  const res = await expectCall(() => api.apiGetDownloadUrl(TOKEN, 'uploads/x/a.stl'), {
    url: '/files/download-url', method: 'POST', body: { key: 'uploads/x/a.stl' },
  })
  assert.deepEqual(res, { ok: true })
})