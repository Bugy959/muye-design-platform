// 木叶设计平台后端 —— 维护任务（会话过期清理等）
import { db, now } from './db.js'

/** 会话过期清理（1.11）：登录时顺带执行，防止 sessions 表无限膨胀 */
export function sweepExpiredSessions() {
  const r = db.prepare(`DELETE FROM sessions WHERE expires_at < ?`).run(now())
  return r.changes
}