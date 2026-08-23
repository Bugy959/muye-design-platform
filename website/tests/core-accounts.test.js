import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { mockLocalStorage, readDB } from './helpers.js'

mockLocalStorage()

const store = await import('../src/lib/store.ts')
const {
  resetDB,
  authenticate,
  saveSession,
  loadSession,
  usernameTaken,
  createAccount,
  resetPassword,
  deleteAccount,
  isValidPhone,
  isValidIdCard,
  isFileTooLarge,
  monthOf,
  readOrderFile,
} = store

beforeEach(() => resetDB())

test('表单校验: 手机号/身份证/文件大小/月份', () => {
  assert.equal(isValidPhone('13812345678'), true)
  assert.equal(isValidPhone(' 13812345678 '), true)
  assert.equal(isValidPhone('23812345678'), false)
  assert.equal(isValidPhone('1381234567'), false)

  assert.equal(isValidIdCard('33010219900101123X'), true)
  assert.equal(isValidIdCard('33010219900101123x'), true)
  assert.equal(isValidIdCard('33010219900101123A'), false)
  assert.equal(isValidIdCard('3301021990010112'), false)

  assert.equal(isFileTooLarge({ size: 2 * 1024 * 1024 }, 1), true)
  assert.equal(isFileTooLarge({ size: 1024 * 1024 }, 1), false)
  assert.equal(monthOf('2026-08-19T10:00:00'), '2026-08')
})

test('authenticate: 校验账号密码并裁剪用户名', () => {
  const admin = authenticate('admin', 'muye2026')
  assert.equal(admin.role, 'admin')
  assert.equal(admin.username, 'admin')
  assert.equal(authenticate(' mingzhou ', '123456').clientId, 'c-mingzhou')
  assert.equal(authenticate('admin', 'wrong'), null)
})

test('会话: 保存/读取/清除/损坏数据容错', () => {
  saveSession({ role: 'client', clientId: 'c-mingzhou', username: 'mingzhou' })
  assert.deepEqual(loadSession(), { role: 'client', clientId: 'c-mingzhou', username: 'mingzhou' })

  saveSession(null)
  assert.equal(loadSession(), null)

  globalThis.localStorage.setItem('muye-session-v1', '{broken')
  assert.equal(loadSession(), null)
})

test('usernameTaken: 已有账号名判重', () => {
  assert.equal(usernameTaken('admin'), true)
  assert.equal(usernameTaken('admin '), true)
  assert.equal(usernameTaken('nobody'), false)
})

test('createAccount: 同时新建客户档案', () => {
  const acc = createAccount({
    username: ' 新医院 ',
    password: 'p',
    role: 'client',
    newClient: { name: '新医院', phone: '13800000000', kind: 'hospital', clientGroupId: 'cg-nb' },
  })
  const db = readDB()
  assert.equal(acc.username, '新医院')
  assert.ok(acc.clientId.startsWith('c-'))
  assert.equal(db.clients.find((c) => c.id === acc.clientId).points, 0)
  assert.equal(db.clients.find((c) => c.id === acc.clientId).clientGroupId, 'cg-nb')
  assert.ok(db.accounts.some((a) => a.id === acc.id))
})

test('createAccount: 挂接已有客户', () => {
  const acc = createAccount({ username: 'yahe2', password: 'p', role: 'client', clientId: 'c-yahe' })
  assert.equal(acc.clientId, 'c-yahe')
  assert.equal(readDB().accounts.find((a) => a.id === acc.id).clientId, 'c-yahe')
})

test('resetPassword: 改密后旧密码失效', () => {
  resetPassword('a-mingzhou', 'newpass')
  assert.equal(readDB().accounts.find((a) => a.id === 'a-mingzhou').password, 'newpass')
  assert.equal(authenticate('mingzhou', 'newpass').role, 'client')
  assert.equal(authenticate('mingzhou', '123456'), null)
})

test('deleteAccount: 删除普通账号但保留 admin', () => {
  deleteAccount('a-mingzhou')
  assert.equal(readDB().accounts.some((a) => a.id === 'a-mingzhou'), false)

  deleteAccount('a-admin')
  assert.equal(readDB().accounts.some((a) => a.id === 'a-admin'), true)
})

test('readOrderFile: 小文件内嵌 dataUrl，大文件仅记录文件名', async () => {
  class FakeFileReader {
    readAsDataURL(file) {
      if (file.name === 'error.stl') {
        this.onerror?.()
        return
      }
      this.result = `data:application/octet-stream;base64,${file.name}`
      this.onload?.()
    }
  }
  globalThis.FileReader = FakeFileReader

  const small = await readOrderFile({ name: 'scan.stl', size: 100 })
  assert.deepEqual(small, { name: 'scan.stl', dataUrl: 'data:application/octet-stream;base64,scan.stl', size: 100 })

  const big = await readOrderFile({ name: 'big.stl', size: 2 * 1024 * 1024 })
  assert.deepEqual(big, { name: 'big.stl', size: 2 * 1024 * 1024 })

  const error = await readOrderFile({ name: 'error.stl', size: 100 })
  assert.deepEqual(error, { name: 'error.stl', size: 100 })

  delete globalThis.FileReader
})

test('createAccount: 同时新建设计师档案', () => {
  const acc = createAccount({
    username: ' 新设计师账号 ',
    password: 'p',
    role: 'designer',
    newDesigner: { name: '王小明', phone: '13800000001', idCard: '3301**********0099', certNo: 'JG-2024-0001', groupId: 'g-c' },
  })
  const db = readDB()
  assert.equal(acc.username, '新设计师账号')
  assert.ok(acc.designerId.startsWith('d-'))
  const d = db.designers.find((x) => x.id === acc.designerId)
  assert.equal(d.name, '王小明')
  assert.equal(d.groupId, 'g-c')
  assert.equal(d.certNo, 'JG-2024-0001')
  assert.ok(db.accounts.some((a) => a.id === acc.id))
})
