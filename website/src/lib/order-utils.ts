/* ---------------- 文件大小与订单排序（纯工具函数，无组件） ---------------- */

/** 字节数 → 可读文本，如 12.4 MB / 860 KB */
export function fmtSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export type OrderSort = 'new' | 'old' | 'points' | 'status'

/** 按状态的排序权重：越需要处理的排越前 */
const STATUS_RANK: Record<string, number> = {
  pending: 0, unassigned: 1, designing: 2, rework: 3, returned: 4, completed: 5, cancelled: 6,
}

export function sortOrders<T extends { createdAt: string; points: number; status: string }>(list: T[], sort: OrderSort): T[] {
  const arr = [...list]
  if (sort === 'new') arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  else if (sort === 'old') arr.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  else if (sort === 'points') arr.sort((a, b) => b.points - a.points || b.createdAt.localeCompare(a.createdAt))
  else arr.sort((a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) || b.createdAt.localeCompare(a.createdAt))
  return arr
}
