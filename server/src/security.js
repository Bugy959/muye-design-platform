// 木叶设计平台后端 —— 安全中间件
// 登录限流：防止暴力破解（《服务器部署整改方案.md》第五节遗留 TODO 落地）
import rateLimit from 'express-rate-limit'

/** 登录限流：默认每 IP 每分钟 5 次；可用 LOGIN_MAX_PER_MINUTE 覆盖（生产建议保持默认） */
export function loginRateLimiter() {
  return rateLimit({
    windowMs: 60_000,
    limit: () => Math.max(1, Number(process.env.LOGIN_MAX_PER_MINUTE || 5)),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: '登录尝试次数过多，请 1 分钟后再试' },
  })
}

/* ---------------- 上传接口限流（防恶意刷 OSS） ----------------
 * 每账号每分钟 upload-token + upload-init 合计上限，默认 30 次（UPLOAD_MAX_PER_MINUTE 覆盖）。 */

const uploadHits = new Map()

export function checkUploadRate(accountId) {
  const max = Math.max(1, Number(process.env.UPLOAD_MAX_PER_MINUTE || 30))
  const key = String(accountId)
  const nowMs = Date.now()
  const hit = uploadHits.get(key)
  if (!hit || nowMs - hit.resetAt >= 60_000) {
    uploadHits.set(key, { count: 1, resetAt: nowMs })
    return
  }
  hit.count += 1
  if (hit.count > max) {
    throw Object.assign(new Error('上传操作过于频繁，请 1 分钟后再试'), { expose: true, status: 429 })
  }
}

/** 测试/会话重置用 */
export function resetUploadRate(accountId) {
  uploadHits.delete(String(accountId))
}