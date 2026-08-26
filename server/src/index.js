// 木叶设计平台后端 —— 入口
// 启动：npm start（默认端口 3001，可用环境变量 PORT 覆盖）
import express from 'express'
import helmet from 'helmet'
import { routes } from './routes.js'
import { sweepExpiredSessions } from './maintenance.js'
import { sweepExpiredUploads } from './files.js'

const PORT = process.env.PORT || 3001

export function createApp() {
  const app = express()

  // 信任 nginx 反代：登录限流按 X-Forwarded-For 取客户端真实 IP（单层反代用 1，多层可用 TRUST_PROXY 覆盖）
  app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1))

  // 全局安全响应头（helmet：X-Content-Type-Options / X-Frame-Options / HSTS / 隐藏 X-Powered-By 等）
  app.use(helmet())

  // 请求日志（1.14）：方法/路径/状态/耗时；测试环境不输出，保持测试输出干净（不记请求体，脱敏）
  if (process.env.NODE_ENV !== 'test') {
    app.use((req, res, next) => {
      const t0 = Date.now()
      res.on('finish', () => {
        console.log(`[muye] ${req.method} ${req.originalUrl} -> ${res.statusCode} ${Date.now() - t0}ms`)
      })
      next()
    })
  }

  // JSON 请求体限制：默认 10mb。小文件（≤1.5MB）以 dataUrl 内嵌（base64 后约 2MB），
  // 大文件已全部走 OSS 直传，JSON 不再承载百兆数据；特殊场景可用 JSON_BODY_LIMIT 覆盖
  app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '10mb' }))

  // CORS：开发期默认放行任意来源；生产用 CORS_ORIGIN 收紧为域名白名单
  // （nginx 同源反代 /api 其实不跨域，此配置主要给「前端域名 ≠ 后端域名」的部署兜底）
  const corsOrigin = process.env.CORS_ORIGIN
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin || req.headers.origin || '*')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    next()
  })

  app.get('/api/health', (req, res) => res.json({ ok: true, service: 'muye-design-server', time: new Date().toISOString() }))
  app.use('/api', routes)
  app.use((req, res) => res.status(404).json({ error: '接口不存在' }))

  return app
}

if (process.env.NODE_ENV !== 'test') {
  sweepExpiredSessions() // 1.11：启动清理过期会话
  sweepExpiredUploads({ force: true }) // 1.8：启动回收孤儿上传记录
  createApp().listen(PORT, () => {
    console.log(`[muye] 后端服务已启动: http://localhost:${PORT}`)
    console.log(`[muye] 健康检查: http://localhost:${PORT}/api/health`)
  })
}