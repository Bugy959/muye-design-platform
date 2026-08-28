// 木叶设计平台后端 —— 大文件上云（腾讯云 COS 预签名直传/下载）
// 说明：文件不经过本服务器，浏览器拿到预签名地址后直接上传到 COS；
//       数据库/订单里只存文件 key，下载时再由后端换成短期签名地址。
// 支持：
//   - 小文件：单次 PUT（预签名直传）
//   - 大文件：分片直传（multipart，浏览器逐片 PUT，可断点续传）
// 文档：仓库根目录《服务器部署详细指南.md》第 12 章
import COS from 'cos-nodejs-sdk-v5'
import crypto from 'node:crypto'
import { db, now } from './db.js'

/** 单文件上限（与前端约定一致）：1GB */
export const MAX_FILE_SIZE = 1024 * 1024 * 1024
/** 上传预签名有效期：1 小时（大文件慢网也能传完） */
export const UPLOAD_PRESIGN_TTL = 3600
/** 下载预签名有效期：2 小时 */
export const DOWNLOAD_PRESIGN_TTL = 7200
/** COS 默认地域（可用 COS_REGION 覆盖） */
export const COS_DEFAULT_REGION = 'ap-shanghai'

let client = null
let clientCfg = null

/** 判断是否已配置 COS（未配置时一切 COS 功能降级为不可用，不影响其它接口） */
export function cosConfigured() {
  return !!(process.env.COS_BUCKET && process.env.COS_SECRET_ID && process.env.COS_SECRET_KEY)
}

/** 惰性创建 COS client；环境变量变化时自动重建（避免缓存过期配置） */
function cos() {
  const cfg = {
    region: process.env.COS_REGION || COS_DEFAULT_REGION,
    bucket: process.env.COS_BUCKET,
    secretId: process.env.COS_SECRET_ID,
    secretKey: process.env.COS_SECRET_KEY,
  }
  if (!cfg.bucket || !cfg.secretId || !cfg.secretKey) {
    client = null
    clientCfg = null
    throw Object.assign(new Error('未配置 COS 环境变量（COS_BUCKET / COS_SECRET_ID / COS_SECRET_KEY）'), { expose: true, status: 503 })
  }
  if (!client || !clientCfg || clientCfg.region !== cfg.region || clientCfg.bucket !== cfg.bucket ||
      clientCfg.secretId !== cfg.secretId || clientCfg.secretKey !== cfg.secretKey) {
    client = new COS({ SecretId: cfg.secretId, SecretKey: cfg.secretKey })
    clientCfg = cfg
  }
  return client
}

/** 把 COS 回调风格 API 包装成 Promise */
function callCos(api, params) {
  return new Promise((resolve, reject) => {
    const c = cos()
    c[api](params, (err, data) => (err ? reject(err) : resolve(data)))
  })
}

/** 生成随机文件 key（按日期分目录 + uuid，防猜测） */
function makeKey(filename) {
  const ext = (String(filename).match(/\.([a-zA-Z0-9]+)$/)?.[1] || 'bin').toLowerCase()
  return `uploads/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`
}

/** 校验文件名与大小（1GB 上限） */
function validateNameSize(filename, size) {
  if (!filename || !Number.isInteger(size) || size <= 0) throw Object.assign(new Error('文件信息不正确'), { expose: true })
  if (size > MAX_FILE_SIZE) throw Object.assign(new Error('文件不能超过 1GB 上限'), { expose: true })
}

/**
 * 生成带签名的操作地址（单次 PUT / 分片 part PUT / 下载）。
 * 用 SDK getObjectUrl：本地 HMAC 签名（无网络请求），Expires 秒后过期。
 */
function signedUrl(key, { method = 'get', query = {}, expires = UPLOAD_PRESIGN_TTL } = {}) {
  const params = {
    Bucket: process.env.COS_BUCKET,
    Region: process.env.COS_REGION || COS_DEFAULT_REGION,
    Key: key,
    Method: method,
    Expires: expires,
    Sign: true,
  }
  if (Object.keys(query).length > 0) params.Query = query
  if (String(method).toUpperCase() === 'PUT') params.Headers = { 'Content-Type': 'application/octet-stream' }
  return callCos('getObjectUrl', params).then((d) => d.Url)
}

/** 单次上传（小文件）：预签名 PUT 地址，浏览器直接传 */
export async function getUploadTarget(filename, size) {
  validateNameSize(filename, size)
  const key = makeKey(filename)
  const uploadUrl = await signedUrl(key, { method: 'PUT', expires: UPLOAD_PRESIGN_TTL })
  return { key, uploadUrl }
}

/** 分片上传第一步：初始化，返回 key + uploadId */
export async function initMultipartUpload(filename, size) {
  validateNameSize(filename, size)
  const key = makeKey(filename)
  const { UploadId } = await callCos('multipartInit', {
    Bucket: process.env.COS_BUCKET,
    Region: process.env.COS_REGION || COS_DEFAULT_REGION,
    Key: key,
  })
  return { key, uploadId: UploadId }
}

/** 分片上传第二步：给某个分片签发预签名 PUT 地址 */
export async function getUploadPartUrl(key, uploadId, partNumber) {
  const n = Number(partNumber)
  if (!Number.isInteger(n) || n < 1 || n > 10000) throw Object.assign(new Error('分片编号不正确'), { expose: true })
  return signedUrl(key, {
    method: 'PUT',
    expires: UPLOAD_PRESIGN_TTL,
    query: { partNumber: n, uploadId: String(uploadId) },
  })
}

/** 分片上传第三步：合并所有分片，完成整个对象上传（导致网络请求） */
export async function completeMultipartUpload(key, uploadId, parts) {
  if (!Array.isArray(parts) || parts.length === 0) throw Object.assign(new Error('缺少分片信息'), { expose: true })
  const ok = parts.every((p) => p && Number.isInteger(Number(p.number)) && Number(p.number) >= 1 && /^"?[0-9a-f]{32}"?$/i.test(String(p.etag || '').trim()))
  if (!ok) throw Object.assign(new Error('分片信息不正确'), { expose: true })
  const list = parts.map((p) => ({ PartNumber: Number(p.number), ETag: String(p.etag).trim() }))
  await callCos('multipartComplete', {
    Bucket: process.env.COS_BUCKET,
    Region: process.env.COS_REGION || COS_DEFAULT_REGION,
    Key: String(key),
    UploadId: String(uploadId),
    Parts: list,
  })
  return true
}

/** 把 key 换成短期可下载地址（私有桶必须签名，否则一律 403） */
export function getDownloadUrl(key, expires = DOWNLOAD_PRESIGN_TTL) {
  return signedUrl(key, { method: 'get', expires })
}
/* ---------------- 上传登记与孤儿回收（V2.10 第二轮：1.8） ----------------
 * uploads 表：upload-token / upload-init 时登记，upload-complete 标记完成；
 * 归属校验防「A 用户补完 B 用户的分片 / 任意 key 签名」；孤儿记录定期回收。 */

/** 上传登记（单次直传用 uploadId=key；分片用 OSS multipart uploadId） */
export function registerUpload(accountId, key, uploadId) {
  db.prepare(`INSERT INTO uploads (key, account_id, upload_id, status, created_at) VALUES (?,?,?,'uploading',?)
             ON CONFLICT(key) DO UPDATE SET account_id = excluded.account_id, upload_id = excluded.upload_id, status = excluded.status, completed_at = NULL`)
    .run(key, String(accountId), String(uploadId), now())
}

/** 校验 key+uploadId 归属当前账号；不通过抛 expose 错误（→ 403） */
export function assertUploadOwner(accountId, key, uploadId) {
  const r = db.prepare(`SELECT key FROM uploads WHERE key = ? AND account_id = ? AND upload_id = ?`).get(key, String(accountId), String(uploadId))
  if (!r) throw Object.assign(new Error('上传凭据不属于当前账号或已失效'), { expose: true, status: 403 })
}

/** 分片合并成功后标记完成 */
export function markUploadComplete(accountId, key, uploadId) {
  assertUploadOwner(accountId, key, uploadId)
  db.prepare(`UPDATE uploads SET status = 'complete', completed_at = ? WHERE key = ?`).run(now(), key)
}

/** key 是否已被任一订单引用（扫描文件/照片/设计文件 JSON 含该 key） */
function uploadBoundToOrder(key) {
  const esc = String(key).replace(/'/g, "''")
  const r = db.prepare(`SELECT 1 FROM orders WHERE scan_files LIKE '%"${esc}"%' OR images LIKE '%"${esc}"%' OR design_files LIKE '%"${esc}"%' LIMIT 1`).get()
  return !!r
}

/** 本地时间格式的「N 小时前」字符串，与 now() 同格式可比较 */
function localIsoAgo(hours) {
  const d = new Date(Date.now() - hours * 3600 * 1000)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** 孤儿回收：删除「创建超过 maxAgeHours、仍未 complete、且未被订单引用」的上传记录。
 *  COS 对象删除默认关闭（交给桶生命周期规则兜底），显式设置 COS_ENABLE_CLEANUP=true 才执行。
 *  每分钟最多跑一次（force 可绕过，供测试/启动时用）。返回删除条数。 */
let lastSweepAt = 0
export function sweepExpiredUploads({ maxAgeHours = 24, force = false, createdBefore } = {}) {
  const nowMs = Date.now()
  if (!force && nowMs - lastSweepAt < 60_000) return 0
  const cutoff = createdBefore ?? localIsoAgo(maxAgeHours)
  const rows = db.prepare(`SELECT key FROM uploads WHERE status = 'uploading' AND created_at < ?`).all(cutoff)
  let deleted = 0
  for (const r of rows) {
    if (uploadBoundToOrder(r.key)) continue
    db.prepare(`DELETE FROM uploads WHERE key = ?`).run(r.key)
    deleted += 1
    if (process.env.COS_ENABLE_CLEANUP === 'true' && cosConfigured()) {
      try {
        callCos('deleteObject', {
          Bucket: process.env.COS_BUCKET,
          Region: process.env.COS_REGION || COS_DEFAULT_REGION,
          Key: r.key,
        })
      } catch { /* 删除失败交给桶生命周期规则兜底 */ }
    }
  }
  lastSweepAt = nowMs
  return deleted
}