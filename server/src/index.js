// 木叶设计平台后端 —— 入口
// 启动：npm start（默认端口 3001，可用环境变量 PORT 覆盖）
import express from 'express'
import { routes } from './routes.js'

const app = express()
const PORT = process.env.PORT || 3001

// 口扫文件目前以 dataUrl 内嵌在 JSON 里传输，限制放宽到 100MB（上线第 2 步改为对象存储后可调回）
app.use(express.json({ limit: '100mb' }))

// 开发期允许前端 Vite 开发服务器（:3000）跨域调用；上线后同源部署可删除此段
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'muye-design-server', time: new Date().toISOString() }))
app.use('/api', routes)

app.use((req, res) => res.status(404).json({ error: '接口不存在' }))

app.listen(PORT, () => {
  console.log(`[muye] 后端服务已启动: http://localhost:${PORT}`)
  console.log(`[muye] 健康检查: http://localhost:${PORT}/api/health`)
})
