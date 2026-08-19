# 木叶义齿设计平台 —— 后端服务（骨架版）

这是平台的**服务器端**，负责替浏览器保管数据：账号、订单、积分、流水、消息、分组匹配。
上线后，前端网页（`website/`）不再把数据存在浏览器里，而是全部通过这里的 API 读写。

## 技术选型

| 项目 | 选择 | 原因 |
|------|------|------|
| 运行时 | Node.js ≥ 22.13（内置 `node:sqlite` 自 22.13 起默认可用） | 与前端同一语言，维护简单 |
| 框架 | Express（唯一外部依赖） | 成熟、资料多、招人容易 |
| 数据库 | SQLite（Node 内置 `node:sqlite`） | 零安装、单文件好备份；量大了可平迁 MySQL，表结构已按通用 SQL 设计 |
| 密码 | scrypt 加密（Node 内置） | 永不存明文 |
| 登录 | 令牌（token）7 天有效 | 改密码/删账号后令牌立即失效 |

## 怎么跑起来

```bash
cd server
npm install        # 首次：安装 Express
npm start          # 启动，默认 http://localhost:3001
```

验证：浏览器打开 `http://localhost:3001/api/health`，看到 `{"ok":true}` 即正常。

首次启动会自动建库（`server/data/muye.db`）并写入种子数据：
演示账号与演示版一致（admin / muye2026；mingzhou、hengmei、yahe / 123456；li、wang、zhao、sun、zhou / 123456），
**密码已加密存储**；不预置订单，订单全部走真实流程产生。

## API 一览（全部以 `/api` 开头）

### 登录
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/login` | 账号密码登录，返回 token（之后请求带 `Authorization: Bearer <token>`） |
| POST | `/auth/logout` | 退出登录 |
| GET | `/bootstrap` | 按当前登录角色返回初始化数据（医院只看自己、设计师看不到医院信息和积分、管理端全量） |

### 订单（业务规则与演示版 store.ts 一致）
| 方法 | 路径 | 角色 | 说明 |
|------|------|------|------|
| POST | `/orders` | 医院 | 提交订单：算积分 → 事务内预扣 + 记流水 → 路由检查（无匹配组则未分配） |
| POST | `/orders/:id/accept` | 设计师 | 抢单：原子 UPDATE 加锁，只有一个人能抢到；校验分组匹配范围 |
| POST | `/orders/:id/submit-design` | 设计师 | 提交设计文件 → 已完成 + 通知医院 |
| POST | `/orders/:id/return` | 设计师 | 退回（信息不全/数据有问题）→ 通知医院 |
| POST | `/orders/:id/resubmit` | 医院 | 退回件修改后重提：按新牙位/颗数重算积分，多退少补 |
| POST | `/orders/:id/cancel` | 医院 | 撤回（仅待接单/未分配）：积分全额退回 |

### 返工
| 方法 | 路径 | 角色 | 说明 |
|------|------|------|------|
| POST | `/orders/:id/rework-requests` | 医院 | 申请返工：订单立即回到原设计师手上重做（不进接单大厅、不可被抢），管理端审核仅决定是否退积分 |
| POST | `/reworks/:id/approve` | 管理 | 审核通过：登记 + 退还该订单全额积分并记流水 + 通知；订单留在原设计师手上重做 |
| POST | `/reworks/:id/reject` | 管理 | 审核不通过：登记结果、不退积分 + 通知；订单留在原设计师修改 |
| PATCH | `/reworks/:id` | 医院 | 审核前修改申请 |
| DELETE | `/reworks/:id` | 医院 | 审核前撤销申请 |

### 其他
| 方法 | 路径 | 角色 | 说明 |
|------|------|------|------|
| POST | `/notices/read-all` | 医院 | 消息全部已读 |
| POST | `/admin/points` | 管理 | 积分充值/扣减（微信转账后手动加分） |
| POST | `/admin/accounts` | 管理 | 创建账号（可同时新建客户/设计师档案） |
| POST | `/admin/accounts/:id/reset-password` | 管理 | 重置密码（强制重新登录） |
| DELETE | `/admin/accounts/:id` | 管理 | 删除账号（admin 不可删） |
| POST/PATCH | `/admin/groups` | 管理 | 设计师分组新建/改名/设组长/备注 |
| POST | `/admin/designers/:id/group` | 管理 | 移动设计师到分组 |
| POST/PATCH/DELETE | `/admin/client-groups` | 管理 | 客户分组管理 |
| POST | `/admin/clients/:id/group` | 管理 | 移动客户到分组 |
| POST/DELETE | `/admin/assignments` | 管理 | 分组匹配规则（客户组 ↔ 设计师组） |
| POST | `/admin/design-params` | 管理 | 保存医院设计参数 |
| POST | `/admin/orders/:id/dispatch` | 管理 | 未分配订单重新派发 |

## 安全要点（已内置）

- 所有写操作校验登录与角色；医院只能动自己的订单，设计师只能接匹配范围内的单
- 积分增减全部在数据库事务内完成，余额不足直接回滚，不可能扣成负数（管理端扣减也拦）
- 抢单用 `UPDATE ... WHERE status = 'pending'` 原子操作，两人同点只有一人成功（返工单由原设计师重做，不进大厅、不可被抢）
- 密码 scrypt 加密 + 改密后旧令牌全部作废

## 上线前还要做的事（见根目录《服务器部署整改方案.md》）

1. 口扫文件/照片改传对象存储（OSS/COS），数据库只存地址
2. HTTPS + 域名 + ICP 备案
3. 数据库每日自动备份
4. CORS 改为只允许正式域名
