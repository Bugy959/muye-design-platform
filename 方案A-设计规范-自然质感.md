# 方案A · 自然质感 — 设计规范

> 设计理念：延续木叶品牌基因，像翻阅一本植物图鉴。翠绿主色 + 琥珀强调色，大圆角带来有机流动感。

---

## 一、配色

| 角色 | 色值 | Tailwind | 用途 |
|------|------|----------|------|
| 主色 Primary | `#15803D` | `green-700` | 品牌色：按钮、导航激活态、牙位标签 |
| 主色悬浮 | `#166534` | `green-800` | 按钮 hover |
| 辅助色 Secondary | `#059669` | `emerald-600` | 成功状态、完成标记 |
| 强调色 Accent | `#D97706` | `amber-600` | 待处理、返工、加急标识 |
| 背景 Background | `#F0FDF4` | `green-50` | 页面主背景，微绿色调 |
| 卡片 Card | `#FFFFFF` | `white` | 卡片、表格行 |
| 前景 Foreground | `#0F172A` | `slate-900` | 正文文字 |
| 次要文字 Muted | `#64748B` | `slate-500` | 辅助说明、时间戳 |
| 边框 Border | `#E2EFE7` | `green-100` | 卡片边框、表格分隔线 |
| 浅填充 Muted BG | `#F0F7F3` | — | 表格偶数行、输入框背景 |
| 危险 Destructive | `#DC2626` | `red-600` | 删除、退回、报错 |
| 光环 Ring | `#15803D` | `green-700` | 输入框焦点环 |

---

## 二、字体

| 层级 | 字体 | 字号 | 字重 | 行高 | 用途 |
|------|------|------|------|------|------|
| H1 页面标题 | PingFang SC | 28px | 600 | 1.3 | 客户端/管理端标题 |
| H2 区块标题 | PingFang SC | 18px | 600 | 1.4 | SectionHead |
| Body 正文 | PingFang SC | 14px | 400 | 1.6 | 订单要求、表格内容 |
| Small 辅助 | PingFang SC | 12px | 400 | 1.5 | 时间戳、提示文字 |
| Mono 数据 | SF Mono / Figtree | 13px | 500 | 1.4 | 单号、积分、牙位编码 |
| Stat 统计 | Figtree | 24-28px | 600 | 1.2 | 概览卡片数字 |

**引入方式：**
```html
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet">
```

---

## 三、间距

| 场景 | 值 | Tailwind | 说明 |
|------|-----|----------|------|
| 页面水平边距 | 20px | `px-5` | 页面内容区左右 |
| 页面顶部间距 | 32px | `pt-8` | header 上方 |
| 页面底部间距 | 80px | `pb-20` | 内容区下方 |
| 区块间距 | 24px | `mb-6` | 统计卡片与内容之间 |
| 卡片内边距 | 16px | `p-4` | 统计卡片、表单卡片 |
| 表格单元格 | 12px/10px | `py-3 px-4` | 上下/左右 |
| 按钮内边距 | 10px/20px | `py-2.5 px-5` | 主按钮 |
| 标签内边距 | 2px/10px | `py-0.5 px-2.5` | 状态徽章 |
| 表单字段间距 | 28px | `space-y-7` | 表单字段之间 |
| 列表项间距 | 16px | `py-4` | 订单列表项 |

---

## 四、组件样式

### 按钮

```
主按钮 btnPrimary：
  background: #15803D
  color: #FFFFFF
  border-radius: 20px (rounded-full)
  padding: 10px 20px
  font-size: 14.5px / font-weight: 600
  letter-spacing: 0.04em
  hover: background #166534
  active: scale(0.98)
  disabled: opacity 40%

次要按钮 btnGhost：
  background: #FFFFFF
  color: #15803D
  border: 1.5px solid #15803D
  border-radius: 20px (rounded-full)
  padding: 10px 20px
  hover: background #F0FDF4

危险按钮：
  background: #FFFFFF
  color: #DC2626
  border: 1.5px solid #DC2626
  border-radius: 20px
  hover: background #FEF2F2
```

### 卡片

```
统计卡片：
  background: #FFFFFF
  border: 1px solid #E2EFE7
  border-radius: 16px (rounded-2xl)
  padding: 16px
  box-shadow: 0 4px 16px rgba(21,128,61,0.08)

订单卡片：
  background: #FFFFFF
  border: 1px solid #E2EFE7
  border-radius: 12px (rounded-xl)
  padding: 16px
  box-shadow: 0 2px 8px rgba(0,0,0,0.04)

卡片 hover：
  box-shadow: 0 4px 16px rgba(21,128,61,0.12)
  border-color: #15803D
```

### 导航栏

```
Tab 导航：
  layout: flex / gap: 0
  border-bottom: 2px solid #E2EFE7（整体底部分隔线）

Tab 项默认：
  padding: 8px 16px
  color: #888
  font-size: 13px

Tab 项激活：
  color: #15803D
  font-weight: 600
  border-bottom: 2px solid #15803D（底部指示线）
  margin-bottom: -2px（与整体线对齐）
```

### 表格

```
表头：
  padding: 8px 12px
  color: #888
  font-size: 11px / font-weight: 500
  text-transform: uppercase
  letter-spacing: 0.08em
  border-bottom: 1px solid #E2EFE7

单元格：
  padding: 8px 12px
  font-size: 13px
  border-bottom: 1px solid #E2EFE7

偶数行：
  background: #F0FDF4

hover 行：
  background: rgba(21,128,61,0.04)
  transition: 150ms
```

### 状态标签

```
已完成：
  background: #F0FDF4 / color: #15803D
  border-radius: 20px / padding: 3px 10px

设计中：
  background: #EFF6FF / color: #2563EB

待接单：
  background: #FFF7ED / color: #D97706

返工/退回：
  background: #FEF2F2 / color: #DC2626

未分配：
  background: #FEF2F2 / color: #DC2626
  带 animate-pulse-red 脉冲环
```

### 输入框

```
background: #FFFFFF
border: 1px solid #E2EFE7
border-radius: 6px (rounded-md)
padding: 10px 12px
font-size: 16px
focus: ring 2px solid #15803D + ring-offset 1px
placeholder: color #94A3B8
```

---

## 五、Tailwind 配置对照

```js
// tailwind.config.js 变更
colors: {
  brand: {
    DEFAULT: '#15803D',   // 原 #1e5c46 → 新
    dark: '#166534',
    light: '#22C55E',
    soft: '#F0FDF4',
  },
  accent: {              // 新增
    DEFAULT: '#D97706',
    light: '#FFF7ED',
  },
},
borderRadius: {
  DEFAULT: '8px',         // 原 6px → 新
  lg: '12px',
  xl: '16px',
},
boxShadow: {
  'card': '0 4px 16px rgba(21,128,61,0.08)',
  'card-hover': '0 4px 16px rgba(21,128,61,0.12)',
},
```

---

## 六、与当前项目对照

| 元素 | 当前值 | 方案A值 | 改动 |
|------|--------|---------|------|
| 主色 | #1e5c46 | #15803D | 更亮更翠 |
| 按钮圆角 | rounded-none | rounded-full | 大变化 |
| 卡片圆角 | rounded-sm | rounded-2xl | 大变化 |
| 卡片阴影 | shadow-sm | 绿色投影 | 新增 |
| 导航激活态 | 纯色块 | 底部指示线 | 大变化 |
| 背景色 | #fdfaf6 | #F0FDF4 | 微调 |
| 强调色 | 无 | #D97706 琥珀 | 新增 |