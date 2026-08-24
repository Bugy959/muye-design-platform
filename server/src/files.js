// 木叶设计平台后端 —— 大文件上云（阿里云 OSS 预签名直传/下载）
// 说明：文件不经过本服务器，浏览器拿到预签名地址后直接上传到 OSS；
//       数据库/订单里只存文件 key，下载时再由后端换成短期签名地址。
// 支持：
//   - 小文件：单次 PUT（预签名直传）
//   - 大文件：分片直传（multipart，浏览器逐片 PUT，可断点续传）
// 文档：仓库根目录《服务器部署详细指南.md》第 12 章
import OSS from 'ali-oss'
import crypto from 'node:crypto'

/** 单文件上限（与前端约定一致）：1GB */
export const MAX_FILE_SIZE = 1024 * 1024 * 1024
/** 上传预签名有效期：1 小时（大文件慢网也能传完） */
export const UPLOAD_PRESIGN_TTL = 3600
/** 下载预签名有效期：2 小时 */
export const DOWNLOAD_PRESIGN_TTL = 7200

let client = null
let clientCfg = null

/** 判断是否已配置 OSS（未配置时一切 OSS 功能降级为不可用，不影响其它接口） */
export function ossConfigured() {
  return !!(process.env.OSS_BUCKET && process.env.OSS_ACCESS_KEY_ID && process.env.OSS_ACCESS_KEY_SECRET)
}

/** 惰性创建 OSS client；环境变量变化时自动重建（避免缓存过期配置） */
function oss() {
  const cfg = {
    region: process.env.OSS_REGION || 'oss-cn-hangzhou',
    bucket: process.env.OSS_BUCKET,
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  }
  if (!cfg.bucket || !cfg.accessKeyId || !cfg.accessKeySecret) {
    client = null
    clientCfg = null
    throw Object.assign(new Error('未配置 OSS 环境变量（OSS_BUCKET / OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET）'), { expose: true })
  }
  if (!client || !clientCfg || clientCfg.region !== cfg.region || clientCfg.bucket !== cfg.bucket ||
      clientCfg.accessKeyId !== cfg.accessKeyId || clientCfg.accessKeySecret !== cfg.accessKeySecret) {
    client = new OSS({
      region: cfg.region,
      accessKeyId: cfg.accessKeyId,
      accessKeySecret: cfg.accessKeySecret,
      bucket: cfg.bucket,
    })
    clientCfg = cfg
  }
  return client
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

/** 单次上传（小文件）：预签名 PUT 地址，浏览器直接传 */
export function getUploadTarget(filename, size) {
  validateNameSize(filename, size)
  const key = makeKey(filename)
  const uploadUrl = oss().signatureUrl(key, {
    method: 'PUT',
    expires: UPLOAD_PRESIGN_TTL,
    'Content-Type': 'application/octet-stream',
  })
  return { key, uploadUrl }
}

/** 分片上传第一步：初始化，返回 key + uploadId */
export async function initMultipartUpload(filename, size) {
  validateNameSize(filename, size)
  const key = makeKey(filename)
  const { uploadId } = await oss().initMultipartUpload(key)
  return { key, uploadId }
}

/** 分片上传第二步：给某个分片签发预签名 PUT 地址 */
export function getUploadPartUrl(key, uploadId, partNumber) {
  const n = Number(partNumber)
  if (!Number.isInteger(n) || n < 1 || n > 10000) throw Object.assign(new Error('分片编号不正确'), { expose: true })
  return oss().signatureUrl(key, {
    method: 'PUT',
    expires: UPLOAD_PRESIGN_TTL,
    subResource: { partNumber: n, uploadId: String(uploadId) },
  })
}

/** 分片上传第三步：合并所有分片，完成整个对象上传（导致网络请求） */
export async function completeMultipartUpload(key, uploadId, parts) {
  if (!Array.isArray(parts) || parts.length === 0) throw Object.assign(new Error('缺少分片信息'), { expose: true })
  const ok = parts.every((p) => p && Number.isInteger(Number(p.number)) && Number(p.number) >= 1 && /^"?[0-9a-f]{32}"?$/i.test(String(p.etag || '').trim()))
  if (!ok) throw Object.assign(new Error('分片信息不正确'), { expose: true })
  const list = parts.map((p) => ({ number: Number(p.number), etag: String(p.etag).trim() }))
  await oss().completeMultipartUpload(String(key), String(uploadId), list)
  return true
}

/** 把 key 换成短期可下载地址（私有桶必须签名，否则一律 403） */
export function getDownloadUrl(key, expires = DOWNLOAD_PRESIGN_TTL) {
  return oss().signatureUrl(key, { expires })
}