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