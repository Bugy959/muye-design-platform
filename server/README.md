# 木叶义齿设计平台 —— 后端服务（骨架版）

这是平台的**服务器端**，负责替浏览器保管数据：账号、订单、积分、流水、消息、分组匹配。
上线后，前端网页（`website/`）不再把数据存在浏览器里，而是全部通过这里的 API 读写。

## 技术选型

| 项目 | 选择 | 原因 |
|------|------|------|
| 运行时 | Node.js ≥ 22.13（内置 `node:sqlite` 自 22.13 起默认可用） | 与前端同一语言，维护简单 |
| 框架 | Express（业务）+ cos-nodejs-sdk-v5（COS 大文件直传） | 成熟、资料多、招人容易 |
| 数据库 | SQLite（Node 内置 `node:sqlite`） | 零安装、单文件好备份；量大了可平迁 MySQL，表结构已按通用 SQL 设计 |
| 密码 | scrypt 加密（Node 内置） | 永不存明文 |
| 登录 | 令牌（token）7 天有效 | 改密码/删账号后令牌立即失效 |

## 怎么跑起来

```bash
cd server
npm install        # 首次：安装依赖（Express + cos-nodejs-sdk-v5）
npm start          # 启动，默认 http://localhost:3001
```

验证：浏览器打开 `http://localhost:3001/api/health（返回 `db` / `cos` 探活字段）`，看到 `{"ok":true}` 即正常。

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
| POST | `/admin/orders/:id/dispatch` | 管理 | 未分配订单重新派发 |\n| POST | `/files/download-url` | 文件 | 实时签名下载地址（按角色校验 key 归属，1.13） |


## 大文件上云（腾讯云 COS 直传，2026-08-28）

口扫文件/照片/设计稿走**对象存储直传**，不经过本服务器（详见根目录《服务器部署详细指南.md》第 12 章）。

- 流程：浏览器向后端 `POST /api/files/upload-token` 申请凭证 → 直接把文件 PUT 到 COS → 订单只存文件 key → 下载时后端把 key 换成短时签名地址（bootstrap 自动处理）。
- 大文件（>50MB）自动走**分片直传**：`/files/upload-init` → `/files/upload-part-url` → `/files/upload-complete`，浏览器逐片上传、断点续传；COS CORS 的 ExposeHeaders 须包含 `ETag`。
- 预签名有效期：上传 1 小时、下载 2 小时（`server/src/files.js`）。
- **上传登记与孤儿回收**（2026-08-25）：upload-token/upload-init 登记 `uploads` 表，upload-part-url/upload-complete 校验 key+uploadId 归属当前账号；`sweepExpiredUploads()` 清理「超时且未关联订单」的孤儿记录（`COS_ENABLE_CLEANUP=true` 时顺带删 COS 对象）。
- **下载实时签名**（2026-08-25）：`POST /api/files/download-url { key }` 按角色校验归属后重新签发，前端点击下载/预览时调用，页面挂久不再 403。
- 环境变量（未配置时上传接口返回 503，其余接口不受影响；`server/src/files.js`）：

| 变量 | 说明 |
|---|---|
| `COS_REGION` | 地域，如 `ap-shanghai`（默认值） |
| `COS_BUCKET` | 存储桶名（`名字-1250000000` 格式，私有读写） |
| `COS_SECRET_ID` | SecretId（API 密钥） |
| `COS_SECRET_KEY` | SecretKey（API 密钥） |
| `DB_BUSY_TIMEOUT` | 5000 | SQLite 并发写等待毫秒（WAL 下避免偶发 SQLITE_BUSY） |
| `COS_ENABLE_CLEANUP` | 关 | =true 时孤儿回收顺带删除 COS 对象（默认交给桶生命周期规则） |

> 安全相关环境变量：`CORS_ORIGIN`（跨域白名单，生产必设）、`LOGIN_MAX_PER_MINUTE`（登录限流，默认 5）、`TRUST_PROXY`（nginx 反代层数，默认 1）、`JSON_BODY_LIMIT`（请求体上限，默认 10mb）、`DB_BUSY_TIMEOUT`（并发写等待，默认 5000）、`COS_ENABLE_CLEANUP`（孤儿回收是否删 COS 对象）、`UPLOAD_MAX_PER_MINUTE`（上传接口限流，默认 30 次/分钟/账号）。


- 所有写操作校验登录与角色；医院只能动自己的订单，设计师只能接匹配范围内的单
- 积分增减全部在数据库事务内完成，余额不足直接回滚，不可能扣成负数（管理端扣减也拦）
- 抢单用 `UPDATE ... WHERE status = 'pending'` 原子操作，两人同点只有一人成功（返工单由原设计师重做，不进大厅、不可被抢）
- 密码 scrypt 加密 + 改密后旧令牌全部作废

## 上线前还要做的事（见根目录《服务器部署整改方案.md》）

1. ~~口扫文件/照片改传对象存储~~ ✅ 已切腾讯云 COS（2026-08-28），待配置 COS 环境变量后启用
2. HTTPS + 域名 + ICP 备案
3. 数据库每日自动备份
4. ~~CORS 收紧~~ ✅ 已实现（2026-08-25）：设 `CORS_ORIGIN` 环境变量即可；另已内置登录限流（`LOGIN_MAX_PER_MINUTE`，默认 5 次/分钟）、helmet 安全头、JSON 限制 10mb（`JSON_BODY_LIMIT` 可覆盖）
