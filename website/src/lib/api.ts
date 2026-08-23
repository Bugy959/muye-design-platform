import type { DB, Order, OrderFile, OrderImage, Session, ToothCode } from '../types/index.ts'

const DEFAULT_API_BASE = 'http://localhost:3001/api'

function envBase(): string | undefined {
  try {
    return (import.meta.env?.VITE_API_BASE as string | undefined)?.replace(/\/+$/, '')
  } catch {
    return undefined
  }
}

/**
 * 默认 API 地址跟随浏览器当前主机名（局域网访问时自动指向服务器 IP），
 * 本机回退 localhost；生产同源部署可用 VITE_API_BASE=/api 覆盖（nginx 反代）。
 */
function defaultApiBase(): string {
  if (typeof window === 'undefined' || !window.location) return DEFAULT_API_BASE
  return `http://${window.location.hostname}:3001/api`
}

export const API_BASE = envBase() || defaultApiBase()

/** 默认走后端；localStorage 显式写入 `muye-data-mode=demo` 可切回演示模式 */
export function isBackendMode(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (localStorage.getItem('muye-data-mode') === 'demo') return false
  } catch {
    /* ignore */
  }
  return true
}

export async function apiFetch<T>(path: string, options: { method?: string; token?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.error || `请求失败（${response.status}）`)
  }
  return data as T
}

export interface LoginResult {
  token: string
  session: Session
}

export const apiLogin = (username: string, password: string) =>
  apiFetch<LoginResult>('/auth/login', { method: 'POST', body: { username, password } })

export const apiLogout = (token: string) =>
  apiFetch<{ ok: boolean }>('/auth/logout', { method: 'POST', token })

export const apiBootstrap = (token: string) =>
  apiFetch<DB>('/bootstrap', { token })

export const apiCreateOrder = (token: string, body: unknown) =>
  apiFetch<{ order: Order; no: string; unassigned: boolean }>('/orders', { method: 'POST', token, body })

export const apiAcceptOrder = (token: string, orderId: string) =>
  apiFetch<{ ok: boolean }>(`/orders/${orderId}/accept`, { method: 'POST', token })

export const apiCreateClientGroup = (token: string, name: string, note?: string) =>
  apiFetch<{ ok: boolean; id: string }>('/admin/client-groups', { method: 'POST', token, body: { name, note } })

export const apiCreateDesignerGroup = (token: string, name: string, note?: string) =>
  apiFetch<{ ok: boolean; id: string }>('/admin/groups', { method: 'POST', token, body: { name, note } })

export const apiDispatchOrder = (token: string, orderId: string) =>
  apiFetch<{ ok: boolean }>(`/admin/orders/${orderId}/dispatch`, { method: 'POST', token })

/* ---------------- 订单（续） ---------------- */

export const apiSubmitDesign = (token: string, orderId: string, files: OrderFile[]) =>
  apiFetch<{ ok: boolean }>(`/orders/${orderId}/submit-design`, { method: 'POST', token, body: { files } })

export const apiReturnOrder = (token: string, orderId: string, reason: string) =>
  apiFetch<{ ok: boolean }>(`/orders/${orderId}/return`, { method: 'POST', token, body: { reason } })

export const apiResubmitOrder = (token: string, orderId: string, updates: { teeth?: ToothCode[]; customCount?: number; requirement?: string }) =>
  apiFetch<{ ok: boolean }>(`/orders/${orderId}/resubmit`, { method: 'POST', token, body: updates })

export const apiCancelOrder = (token: string, orderId: string) =>
  apiFetch<{ ok: boolean }>(`/orders/${orderId}/cancel`, { method: 'POST', token })

/* ---------------- 返工 ---------------- */

export const apiCreateRework = (token: string, orderId: string, reason: string, images: OrderImage[]) =>
  apiFetch<{ ok: boolean }>(`/orders/${orderId}/rework-requests`, { method: 'POST', token, body: { reason, images } })

export const apiApproveRework = (token: string, reworkId: string) =>
  apiFetch<{ ok: boolean }>(`/reworks/${reworkId}/approve`, { method: 'POST', token })

export const apiRejectRework = (token: string, reworkId: string) =>
  apiFetch<{ ok: boolean }>(`/reworks/${reworkId}/reject`, { method: 'POST', token })

export const apiCancelRework = (token: string, reworkId: string) =>
  apiFetch<{ ok: boolean }>(`/reworks/${reworkId}`, { method: 'DELETE', token })

export const apiUpdateRework = (token: string, reworkId: string, reason: string, images: OrderImage[]) =>
  apiFetch<{ ok: boolean }>(`/reworks/${reworkId}`, { method: 'PATCH', token, body: { reason, images } })

/* ---------------- 消息 ---------------- */

export const apiMarkNoticeRead = (token: string, noticeId: string) =>
  apiFetch<{ ok: boolean }>(`/notices/${noticeId}/read`, { method: 'POST', token })

export const apiMarkAllNoticesRead = (token: string) =>
  apiFetch<{ ok: boolean }>('/notices/read-all', { method: 'POST', token })

/* ---------------- 管理端 ---------------- */

export const apiAdjustPoints = (token: string, clientId: string, delta: number, reason: string) =>
  apiFetch<{ ok: boolean }>('/admin/points', { method: 'POST', token, body: { clientId, delta, reason } })

export const apiCreateAccount = (token: string, body: unknown) =>
  apiFetch<{ ok: boolean; id: string }>('/admin/accounts', { method: 'POST', token, body })

export const apiResetPassword = (token: string, accountId: string, password: string) =>
  apiFetch<{ ok: boolean }>(`/admin/accounts/${accountId}/reset-password`, { method: 'POST', token, body: { password } })

export const apiDeleteAccount = (token: string, accountId: string) =>
  apiFetch<{ ok: boolean }>(`/admin/accounts/${accountId}`, { method: 'DELETE', token })

export const apiUpdateGroup = (token: string, groupId: string, updates: { name?: string; leaderId?: string | null; note?: string }) =>
  apiFetch<{ ok: boolean }>(`/admin/groups/${groupId}`, { method: 'PATCH', token, body: updates })

export const apiMoveDesigner = (token: string, designerId: string, groupId?: string) =>
  apiFetch<{ ok: boolean }>(`/admin/designers/${designerId}/group`, { method: 'POST', token, body: { groupId: groupId ?? null } })

export const apiUpdateClientGroup = (token: string, groupId: string, updates: { name?: string; note?: string }) =>
  apiFetch<{ ok: boolean }>(`/admin/client-groups/${groupId}`, { method: 'PATCH', token, body: updates })

export const apiDeleteClientGroup = (token: string, groupId: string) =>
  apiFetch<{ ok: boolean }>(`/admin/client-groups/${groupId}`, { method: 'DELETE', token })

export const apiMoveClient = (token: string, clientId: string, clientGroupId?: string) =>
  apiFetch<{ ok: boolean }>(`/admin/clients/${clientId}/group`, { method: 'POST', token, body: { clientGroupId: clientGroupId ?? null } })

export const apiAddAssignment = (token: string, clientGroupId: string, designerGroupId: string) =>
  apiFetch<{ ok: boolean }>('/admin/assignments', { method: 'POST', token, body: { clientGroupId, designerGroupId } })

export const apiRemoveAssignment = (token: string, assignmentId: string) =>
  apiFetch<{ ok: boolean }>(`/admin/assignments/${assignmentId}`, { method: 'DELETE', token })

export const apiSaveDesignParam = (token: string, clientId: string, innerCrown: number, occlusalCut: number, proximalCut: number) =>
  apiFetch<{ ok: boolean }>('/admin/design-params', { method: 'POST', token, body: { clientId, innerCrown, occlusalCut, proximalCut } })

/* ---------------- 大文件（OSS 直传，见《服务器部署详细指南.md》第 12 章） ---------------- */

export const apiGetUploadToken = (token: string, name: string, size: number) =>
  apiFetch<{ key: string; uploadUrl: string }>('/files/upload-token', { method: 'POST', token, body: { name, size } })

/** 把文件直接 PUT 到 OSS 预签名地址（不经过后端服务器） */
export async function apiUploadFile(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: file,
  })
  if (!response.ok) throw new Error(`文件上传失败（${response.status}）`)
}
