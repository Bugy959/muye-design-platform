// 木叶设计平台 —— 数据模型

export type Role = 'client' | 'designer' | 'admin'

/** 登录会话：后端模式额外保存 token，演示模式无 token */
export interface Session {
  role: Role
  clientId?: string
  designerId?: string
  username: string
  token?: string
}

/** 设计类型：即刻设计 / 全瓷冠·基台上部冠 / 贴面·嵌体 / 马龙桥设计 */
export type DesignType = 'jike' | 'quanci' | 'tiemian' | 'malong' | 'jita'

export const DESIGN_TYPES: Record<DesignType, { label: string; pointsPerTooth: number; urgentAllowed: boolean }> = {
  jike: { label: '即刻设计', pointsPerTooth: 8, urgentAllowed: false },
  quanci: { label: '全瓷冠 / 基台上部冠', pointsPerTooth: 5, urgentAllowed: false },
  tiemian: { label: '贴面 / 嵌体设计', pointsPerTooth: 10, urgentAllowed: true },
  malong: { label: '马龙桥设计', pointsPerTooth: 0, urgentAllowed: false },
  jita: { label: '基台', pointsPerTooth: 5, urgentAllowed: false },
}

/** 马龙桥设计：按件固定收费，不按颗数 */
export const MALONG_POINTS = 80

/** 马龙桥范围：上颌 / 下颌 / 全口 */
export type Arch = 'upper' | 'lower' | 'full'
export const ARCH_LABELS: Record<Arch, string> = { upper: '上颌', lower: '下颌', full: '全口' }

export const URGENT_POINTS_PER_TOOTH = 5

export type OrderStatus = 'pending' | 'designing' | 'completed' | 'rework' | 'returned' | 'unassigned' | 'cancelled'

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: 'orange' | 'blue' | 'green' | 'red' }> = {
  pending: { label: '待接单', tone: 'orange' },
  designing: { label: '设计中', tone: 'blue' },
  completed: { label: '已完成', tone: 'green' },
  rework: { label: '返工中', tone: 'red' },
  returned: { label: '已退回', tone: 'red' },
  unassigned: { label: '未分配', tone: 'red' },
  cancelled: { label: '已撤回', tone: 'orange' }
}

/** 牙位编码：U/D（上颌/下颌）+ L/R（左/右）+ 1-7，如 UL3 = 上颌左侧第 3 颗 */
export type ToothCode = string

/** 牙位编号展示：仅显示 FDI 编号本身（如 21），不带"左上/左下"等方位字眼 */
export function toothLabel(code: ToothCode): string {
  return code
}

export function toothSort(a: ToothCode, b: ToothCode): number {
  return parseInt(a, 10) - parseInt(b, 10)
}

/** 医院 / 加工厂 */
export interface Client {
  id: string
  name: string
  phone: string
  kind: 'hospital' | 'factory'
  points: number
  clientGroupId?: string // 管理端分配的客户分组
  createdAt: string
}

/** 设计师 */
export interface Designer {
  id: string
  name: string
  phone: string
  idCard: string
  certNo?: string
  groupId?: string // 未分组的设计师看不到任何订单，由管理端后续分配
  createdAt: string
}

/** 设计师分组 */
export interface Group {
  id: string
  name: string
  leaderId?: string
  note?: string // 管理端备注
}

export interface OrderImage {
  name: string
  dataUrl?: string
  size?: number // 字节数，用于上传列表显示文件大小
  key?: string  // COS 文件 key（大文件上云后后端返回，见《服务器部署详细指南.md》第 12 章）
  url?: string  // 签名下载地址（后端返回，可短时有效）
}

/** 上传文件（扫描文件 / 设计文件）：演示版小文件内嵌 dataUrl 可下载；大文件走 COS，存 key */
export interface OrderFile {
  name: string
  dataUrl?: string
  size?: number // 字节数，用于上传列表显示文件大小
  key?: string  // COS 文件 key（大文件上云后后端返回，见《服务器部署详细指南.md》第 12 章）
  url?: string  // 签名下载地址（后端返回，可短时有效）
}

export interface Order {
  id: string
  no: string // 单号，如 MY-20260702-004
  clientId: string
  patient?: string // 患者姓名/编号（选填；设计师可见患者名，不可见医院信息）
  designerId?: string
  type: DesignType
  urgent: boolean
  teeth: ToothCode[] // 牙位编码（自定义模式下为空）
  custom?: boolean // 自定义颗数模式（不点牙位图，直接填颗数）
  customCount?: number // 自定义颗数
  arch?: Arch // 马龙桥范围：上颌/下颌/全口
  requirement: string
  scanFiles: OrderFile[] // 扫描文件（必填，不限制格式与数量）
  images: OrderImage[] // 照片（必填，至少 1 张，数量不限）
  designFiles: OrderFile[] // 设计师提交的设计文件
  status: OrderStatus
  points: number // 本单积分（提交时预扣）
  isRework: boolean
  reworkCount: number
  reworkReason?: string
  returnReason?: string // 设计师退回原因（信息不全/数据有问题）
  returnedAt?: string // 退回时间
  cancelledAt?: string // 医院撤回时间（仅待接单/未分配状态可撤回，积分退回）
  createdAt: string
  acceptedAt?: string
  completedAt?: string
}

/** 积分流水（后台记录，下单/选择牙位时不展示） */
export interface PointTxn {
  id: string
  clientId: string
  delta: number // 负数为扣减
  balance: number
  reason: string
  orderId?: string
  createdAt: string
}

/** 订单完成提醒（客户端消息） */
export interface Notice {
  id: string
  clientId: string
  orderId: string
  text: string
  read: boolean
  createdAt: string
}

/** 登录账号：由管理端统一创建，权限管理归管理端 */
export interface Account {
  id: string
  username: string
  password: string
  role: Role
  clientId?: string
  designerId?: string
  createdAt: string
}

/** 客户分组 */
export interface ClientGroup {
  id: string
  name: string
  note?: string
  createdAt: string
}

/** 分组匹配规则：客户组 ↔ 设计师组，多对多 */
export interface GroupAssignment {
  id: string
  clientGroupId: string
  designerGroupId: string
  createdAt: string
}

/** 医院端设计参数（管理端配置，设计师端可见） */
export interface DesignParam {
  id: string           // = clientId
  innerCrown: number   // 内冠间隙 默认0.02
  occlusalCut: number  // 咬合切 默认0.1
  proximalCut: number  // 邻接切 默认-0.02
}

/** 返工审核状态 */
export type ReworkStatus = 'pending' | 'approved' | 'rejected'
export const REWORK_STATUS: Record<ReworkStatus, string> = {
  pending: '待审核', approved: '已通过', rejected: '未通过'
}

/** 返工申请 */
export interface ReworkRequest {
  id: string
  orderId: string
  clientId: string
  reason: string
  images: OrderImage[]
  status: ReworkStatus
  createdAt: string
  reviewedAt?: string
}

export interface DB {
  clients: Client[]
  designers: Designer[]
  groups: Group[]          // 设计师分组
  clientGroups: ClientGroup[]
  assignments: GroupAssignment[]
  orders: Order[]
  reworks: ReworkRequest[]
  designParams: DesignParam[]
  txns: PointTxn[]
  notices: Notice[]
  accounts: Account[]
  seq: number // 单号序列
}
