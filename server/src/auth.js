// 木叶设计平台后端 —— 密码加密与登录令牌
// 密码：scrypt（Node 内置，无需第三方库），存储格式 salt:hash（hex），永不存明文
import crypto from 'node:crypto'
import { db, uid, now } from './db.js'

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':')
  if (!salt || !hash) return false
  const candidate = crypto.scryptSync(String(password), salt, 64)
  const expected = Buffer.from(hash, 'hex')
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected)
}

const SESSION_DAYS = 7

export function createSession(account) {
  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000)
  const p = (n) => String(n).padStart(2, '0')
  const expiresAt = `${expires.getFullYear()}-${p(expires.getMonth() + 1)}-${p(expires.getDate())}T${p(expires.getHours())}:${p(expires.getMinutes())}:${p(expires.getSeconds())}`
  db.prepare('INSERT INTO sessions (token, account_id, role, client_id, designer_id, username, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(token, account.id, account.role, account.client_id, account.designer_id, account.username, now(), expiresAt)
  return token
}

export function destroySession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
}

/** Express 中间件：校验 Authorization: Bearer <token>，通过后挂 req.session */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: '未登录' })
  const s = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token)
  if (!s || s.expires_at < now()) {
    if (s) destroySession(token)
    return res.status(401).json({ error: '登录已过期，请重新登录' })
  }
  req.session = { token, accountId: s.account_id, role: s.role, clientId: s.client_id ?? undefined, designerId: s.designer_id ?? undefined, username: s.username }
  next()
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.session.role)) return res.status(403).json({ error: '没有权限执行此操作' })
    next()
  }
}
