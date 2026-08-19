// 核心业务规则测试（Node 内置 test runner，无需额外依赖）
// 运行：node --test tests/

import { test } from 'node:test'
import assert from 'node:assert/strict'

// store.ts 顶层会读 localStorage；先 mock 再 import
globalThis.localStorage = {
  _data: {},
  getItem(k) { return this._data[k] ?? null },
  setItem(k, v) { this._data[k] = String(v) },
  removeItem(k) { delete this._data[k] },
}

const { orderPoints, orderCount, scopeLabel, designerAlias } = await import('../src/lib/store.ts')
const { toothLabel, toothSort } = await import('../src/types/index.ts')

test('toothLabel: FDI 每侧 8 颗', () => {
  assert.equal(toothLabel('18'), '右上8')
  assert.equal(toothLabel('28'), '左上8')
  assert.equal(toothLabel('38'), '左下8')
  assert.equal(toothLabel('48'), '右下8')
  assert.equal(toothLabel('16'), '右上6')
})

test('toothSort: 牙位按 FDI 数字排序', () => {
  assert.deepEqual(['21', '11', '48', '38'].sort(toothSort), ['11', '21', '38', '48'])
})

test('orderPoints: 马龙桥固定 80', () => {
  assert.equal(orderPoints('malong', false, []), 80)
})

test('orderPoints: 全瓷冠按颗数', () => {
  assert.equal(orderPoints('quanci', false, ['11', '21']), 10)
})

test('orderPoints: 贴面加急每颗 +5', () => {
  assert.equal(orderPoints('tiemian', true, ['11', '21', '22']), 45)
})

test('orderCount: 马龙桥按件，自定义按颗数', () => {
  assert.equal(orderCount({ type: 'malong', customCount: undefined, teeth: [] }), 1)
  assert.equal(orderCount({ type: 'quanci', custom: true, customCount: 25, teeth: [] }), 25)
})

test('scopeLabel: 马龙桥/自定义范围文案', () => {
  assert.equal(scopeLabel({ type: 'malong', arch: 'upper', custom: true, teeth: [] }), '马龙桥 · 上颌')
  assert.equal(scopeLabel({ type: 'quanci', custom: true, customCount: 20, teeth: [] }), '自定义 20 颗')
})

test('designerAlias: 只显示姓氏花名', () => {
  assert.equal(designerAlias({ name: '李二' }), '李 师傅')
  assert.equal(designerAlias(undefined), '未分配')
})