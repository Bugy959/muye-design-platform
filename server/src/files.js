// 木叶设计平台后端 —— 大文件上云（阿里云 OSS 预签名直传/下载）
// 说明：文件不经过本服务器，浏览器拿到预签名地址后直接上传到 OSS；
//       数据库/订单里只存文件 key，下载时再由后端换成短期签名地址。
// 文档：仓库根目录《服务器部署详细指南.md》第 12 章
import OSS from 'ali-oss'
import crypto from 'node:crypto'

/** 单文件上限（与前端约定一致）：1GB */
export const MAX_FILE_SIZE = 1024 * 1024 * 1024

let client = null

/** 判断是否已配置 OSS（未配置时一切 OSS 功能降级为不可用，不影响其它接口） */
export function ossConfigured() {
  return !!(process.env.OSS_BUCKET && process.env.OSS_ACCESS_KEY_ID && process.env.OSS_ACCESS_KEY_SECRET)
}

function oss() {
  if (client) return client
  const { OSS_REGION, OSS_BUCKET, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET } = process.env
  if (!OSS_BUCKET || !OSS_ACCESS_KEY_ID || !OSS_ACCESS_KEY_SECRET) {
    throw Object.assign(new Error('未配置 OSS 环境变量（OSS_BUCKET / OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET）'), { expose: true })
  }
  client = new OSS({
    region: OSS_REGION || 'oss-cn-hangzhou',
    accessKeyId: OSS_ACCESS_KEY_ID,
    accessKeySecret: OSS_ACCESS_KEY_SECRET,
    bucket: OSS_BUCKET,
  })
  return client
}

/** 生成一次上传的直传凭证：前端拿到后直接把文件 PUT 到 OSS（不经过服务器） */
export function getUploadTarget(filename, size) {
  if (!Number.isInteger(size) || size <= 0) throw Object.assign(new Error('文件大小不正确'), { expose: true })
  if (size > MAX_FILE_SIZE) throw Object.assign(new Error('文件不能超过 1GB 上限'), { expose: true })
  const ext = (String(filename).match(/\.([a-zA-Z0-9]+)$/)?.[1] || 'bin').toLowerCase()
  const key = `uploads/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`
  const uploadUrl = oss().signatureUrl(key, {
    method: 'PUT',
    expires: 600, // 10 分钟有效
    'Content-Type': 'application/octet-stream',
  })
  return { key, uploadUrl }
}

/** 把 key 换成短期可下载地址（私有桶必须签名，否则一律 403） */
export function getDownloadUrl(key, expires = 3600) {
  return oss().signatureUrl(key, { expires })
}