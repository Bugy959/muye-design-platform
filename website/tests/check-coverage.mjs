#!/usr/bin/env node
/**
 * 覆盖率门槛检查：运行 node --test --experimental-test-coverage，
 * 要求行覆盖率：all files ≥ 90%，store.ts ≥ 90%。不达标退出码 1。
 */
import { spawnSync } from 'node:child_process'

const LINE_THRESHOLD = 90

const r = spawnSync(process.execPath, ['--test', '--experimental-test-coverage'], {
  cwd: process.cwd(),
  encoding: 'utf-8',
  shell: false,
})

const out = (r.stdout || '') + (r.stderr || '')
process.stdout.write(out)

if (r.status !== 0) {
  console.error('\n[coverage] 测试本身未通过，覆盖率检查中止')
  process.exit(1)
}

// 解析覆盖率表格行，如：ℹ   store.ts   |  98.77 |    91.18 |   98.09 | ...
const rows = []
for (const line of out.split('\n')) {
  const m = line.match(/([.\w/-]+\.(?:ts|js)|all files)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|/)
  if (m) rows.push({ file: m[1], line: Number(m[2]), branch: Number(m[3]), funcs: Number(m[4]) })
}

if (rows.length === 0) {
  console.error('\n[coverage] 未解析到覆盖率报告')
  process.exit(1)
}

let failed = false
for (const row of rows) {
  if (row.file === 'all files' || row.file.endsWith('store.ts')) {
    if (row.line < LINE_THRESHOLD) {
      console.error(`[coverage] ❌ ${row.file} 行覆盖 ${row.line}% < ${LINE_THRESHOLD}%`)
      failed = true
    } else {
      console.log(`[coverage] ✅ ${row.file} 行覆盖 ${row.line}% ≥ ${LINE_THRESHOLD}%`)
    }
  }
}

if (failed) {
  console.error('[coverage] 覆盖率未达标，CI 拦截')
  process.exit(1)
}
console.log('[coverage] 覆盖率门槛通过')
