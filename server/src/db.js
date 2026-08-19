// 木叶设计平台后端 —— 数据库连接、建表、种子数据
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { hashPassword } from './auth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', 'data')
mkdirSync(DATA_DIR, { recursive: true })

export const db = new DatabaseSync(path.join(DATA_DIR, 'muye.db'))
db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA foreign_keys = ON')
db.exec(readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'))

/* ---------------- 通用小工具 ---------------- */

export const uid = () => Math.random().toString(36).slice(2, 10)

/** 本地时间 ISO（不带 Z），与前端种子数据格式一致，按本地时区展示 */
export function now() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** 事务包装：fn 抛错则回滚。涉及积分/订单状态的操作必须走这里 */
export function tx(fn) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const r = fn()
    db.exec('COMMIT')
    return r
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

export function nextSeq() {
  const row = db.prepare(`SELECT value FROM meta WHERE key = 'seq'`).get()
  const seq = (row ? parseInt(row.value, 10) : 1)
  db.prepare(`UPDATE meta SET value = ? WHERE key = 'seq'`).run(String(seq + 1))
  return seq
}

/* ---------------- 行 → 前端驼峰对象 ---------------- */

const J = (s) => JSON.parse(s || '[]')
const B = (v) => !!v

export function rowToOrder(r) {
  return {
    id: r.id, no: r.no, clientId: r.client_id, patient: r.patient ?? undefined,
    designerId: r.designer_id ?? undefined, type: r.type, urgent: B(r.urgent),
    teeth: J(r.teeth), custom: B(r.custom), customCount: r.custom_count ?? undefined,
    arch: r.arch ?? undefined, requirement: r.requirement,
    scanFiles: J(r.scan_files), images: J(r.images), designFiles: J(r.design_files),
    status: r.status, points: r.points, isRework: B(r.is_rework), reworkCount: r.rework_count,
    reworkReason: r.rework_reason ?? undefined, returnReason: r.return_reason ?? undefined,
    returnedAt: r.returned_at ?? undefined, cancelledAt: r.cancelled_at ?? undefined,
    createdAt: r.created_at, acceptedAt: r.accepted_at ?? undefined, completedAt: r.completed_at ?? undefined,
  }
}

export const rowToClient = (r) => ({ id: r.id, name: r.name, phone: r.phone, kind: r.kind, points: r.points, clientGroupId: r.client_group_id ?? undefined, createdAt: r.created_at })
export const rowToDesigner = (r) => ({ id: r.id, name: r.name, phone: r.phone, idCard: r.id_card, certNo: r.cert_no ?? undefined, groupId: r.group_id ?? undefined, createdAt: r.created_at })
export const rowToGroup = (r) => ({ id: r.id, name: r.name, leaderId: r.leader_id ?? undefined, note: r.note ?? undefined })
export const rowToClientGroup = (r) => ({ id: r.id, name: r.name, note: r.note ?? undefined, createdAt: r.created_at })
export const rowToAssignment = (r) => ({ id: r.id, clientGroupId: r.client_group_id, designerGroupId: r.designer_group_id, createdAt: r.created_at })
export const rowToTxn = (r) => ({ id: r.id, clientId: r.client_id, delta: r.delta, balance: r.balance, reason: r.reason, orderId: r.order_id ?? undefined, createdAt: r.created_at })
export const rowToNotice = (r) => ({ id: r.id, clientId: r.client_id, orderId: r.order_id, text: r.text, read: B(r.is_read), createdAt: r.created_at })
export const rowToRework = (r) => ({ id: r.id, orderId: r.order_id, clientId: r.client_id, reason: r.reason, images: J(r.images), status: r.status, createdAt: r.created_at, reviewedAt: r.reviewed_at ?? undefined })
export const rowToAccount = (r) => ({ id: r.id, username: r.username, role: r.role, clientId: r.client_id ?? undefined, designerId: r.designer_id ?? undefined, createdAt: r.created_at })
export const rowToParam = (r) => ({ id: r.id, innerCrown: r.inner_crown, occlusalCut: r.occlusal_cut, proximalCut: r.proximal_cut })

/* ---------------- 种子数据：演示账号 + 分组（不预置订单，订单走真实流程） ---------------- */

function seed() {
  const has = db.prepare(`SELECT value FROM meta WHERE key = 'seeded'`).get()
  if (has) return
  tx(() => {
    const t = now()
    const insGroup = db.prepare('INSERT INTO groups (id, name, leader_id, note) VALUES (?,?,?,?)')
    insGroup.run('g-a', 'A 组 · 灵犀', 'd-li', '白班·主攻全瓷冠')
    insGroup.run('g-b', 'B 组 · 匠心', 'd-zhao', '夜班·全能型')
    insGroup.run('g-c', 'C 组 · 精工', null, '周末组·专攻即刻')
    insGroup.run('g-d', 'D 组 · 速琢', null, '机动组')

    const insDesigner = db.prepare('INSERT INTO designers (id, name, phone, id_card, cert_no, group_id, created_at) VALUES (?,?,?,?,?,?,?)')
    insDesigner.run('d-li', '李二', '13800000001', '3301**********0011', 'JG-2019-0042', 'g-a', t)
    insDesigner.run('d-wang', '王五', '13800000002', '3301**********0022', null, 'g-a', t)
    insDesigner.run('d-zhao', '赵六', '13800000003', '3301**********0033', 'JG-2021-0117', 'g-b', t)
    insDesigner.run('d-sun', '孙七', '13800000004', '3301**********0044', null, 'g-b', t)
    insDesigner.run('d-zhou', '周八', '13800000005', '3301**********0055', null, 'g-c', t)

    const insCg = db.prepare('INSERT INTO client_groups (id, name, note, created_at) VALUES (?,?,?,?)')
    insCg.run('cg-nb', '宁波片区', '首批合作客户', t)
    insCg.run('cg-hz', '杭州片区', '', t)

    const insClient = db.prepare('INSERT INTO clients (id, name, phone, kind, points, client_group_id, created_at) VALUES (?,?,?,?,?,?,?)')
    insClient.run('c-mingzhou', '明州口腔医院', '0574-88000001', 'hospital', 361, 'cg-nb', t)
    insClient.run('c-hengmei', '恒美义齿加工厂', '0574-88000002', 'factory', 1140, 'cg-nb', t)
    insClient.run('c-yahe', '雅禾口腔门诊部', '0574-88000003', 'hospital', 95, 'cg-hz', t)

    const insAssign = db.prepare('INSERT INTO assignments (id, client_group_id, designer_group_id, created_at) VALUES (?,?,?,?)')
    insAssign.run(`as-${uid()}`, 'cg-nb', 'g-a', t)
    insAssign.run(`as-${uid()}`, 'cg-nb', 'g-b', t)
    insAssign.run(`as-${uid()}`, 'cg-hz', 'g-c', t)
    insAssign.run(`as-${uid()}`, 'cg-hz', 'g-d', t)

    db.prepare('INSERT INTO design_params (id, inner_crown, occlusal_cut, proximal_cut) VALUES (?,?,?,?)')
      .run('c-mingzhou', 0.02, 0.1, -0.02)

    const insAcc = db.prepare('INSERT INTO accounts (id, username, pass_hash, role, client_id, designer_id, created_at) VALUES (?,?,?,?,?,?,?)')
    insAcc.run(`a-${uid()}`, 'admin', hashPassword('muye2026'), 'admin', null, null, t)
    insAcc.run(`a-${uid()}`, 'mingzhou', hashPassword('123456'), 'client', 'c-mingzhou', null, t)
    insAcc.run(`a-${uid()}`, 'hengmei', hashPassword('123456'), 'client', 'c-hengmei', null, t)
    insAcc.run(`a-${uid()}`, 'yahe', hashPassword('123456'), 'client', 'c-yahe', null, t)
    insAcc.run(`a-${uid()}`, 'li', hashPassword('123456'), 'designer', null, 'd-li', t)
    insAcc.run(`a-${uid()}`, 'wang', hashPassword('123456'), 'designer', null, 'd-wang', t)
    insAcc.run(`a-${uid()}`, 'zhao', hashPassword('123456'), 'designer', null, 'd-zhao', t)
    insAcc.run(`a-${uid()}`, 'sun', hashPassword('123456'), 'designer', null, 'd-sun', t)
    insAcc.run(`a-${uid()}`, 'zhou', hashPassword('123456'), 'designer', null, 'd-zhou', t)

    db.prepare(`INSERT INTO meta (key, value) VALUES ('seq', '1'), ('seeded', '1')`).run()
  })
  console.log('[muye] 数据库已初始化种子数据（演示账号已创建，密码已加密）')
}

seed()
