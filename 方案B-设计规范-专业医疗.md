# 方案B · 专业医疗 — 设计规范

> 设计理念：口腔诊所的干净、无菌、可信赖感。医用青蓝主色，Figtree + Noto Sans 字体组合，WCAG AAA 级无障碍。

---

## 一、配色

| 角色 | 色值 | Tailwind | 用途 |
|------|------|----------|------|
| 主色 Primary | `#0891B2` | `cyan-600` | 品牌色：按钮、链接、焦点环 |
| 主色悬浮 | `#0E7490` | `cyan-700` | 按钮 hover |
| 辅助色 Secondary | `#22D3EE` | `cyan-400` | 次要装饰、图标 |
| 强调色 Accent | `#059669` | `emerald-600` | 成功状态、完成标记 |
| 背景 Background | `#ECFEFF` | `cyan-50` | 页面主背景，极淡青色 |
| 卡片 Card | `#FFFFFF` | `white` | 卡片、弹窗 |
| 前景 Foreground | `#164E63` | `cyan-900` | 正文文字，青灰调 |
| 次要文字 Muted | `#64748B` | `slate-500` | 辅助说明 |
| 边框 Border | `#A5F3FC` | `cyan-200` | 卡片边框 |
| 浅填充 Muted BG | `#E8F1F6` | — | 表格偶数行、禁用态 |
| 危险 Destructive | `#DC2626` | `red-600` | 删除、退回 |
| 光环 Ring | `#0891B2` | `cyan-600` | 输入框焦点环 3-4px |

---

## 二、字体

| 层级 | 字体 | 字号 | 字重 | 行高 | 用途 |
|------|------|------|------|------|------|
| H1 页面标题 | Figtree | 28px | 700 | 1.3 | 客户端/管理端标题 |
| H2 区块标题 | Figtree | 18px | 600 | 1.4 | SectionHead |
| Body 正文 | Noto Sans | 16px | 400 | 1.6 | 订单要求、表格内容 |
| Small 辅助 | Noto Sans | 14px | 400 | 1.5 | 时间戳、提示文字 |
| Mono 数据 | SF Mono | 14px | 500 | 1.4 | 单号、积分、牙位编码 |
| Stat 统计 | Figtree | 28px | 700 | 1.2 | 概览卡片数字 |

**引入方式：**
```html
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Noto+Sans:wght@300;400;500;700&display=swap" rel="stylesheet">
```

**Tailwind 配置：**
```js
fontFamily: {
  heading: ['Figtree', 'sans-serif'],
  body: ['Noto Sans', 'sans-serif'],
  mono: ['SF Mono', 'Menlo', 'monospace'],
}
```

---

## 三、间距

| 场景 | 值 | Tailwind | 说明 |
|------|-----|----------|------|
| 页面水平边距 | 20px | `px-5` | 内容区左右 |
| 页面顶部间距 | 40px | `pt-10` | header 上方（比方案A更宽松） |
| 页面底部间距 | 96px | `pb-24` | 内容区下方 |
| 区块间距 | 32px | `mb-8` | 统计卡片与内容之间 |
| 卡片内边距 | 20px | `p-5` | 卡片内部 |
| 表格单元格 | 10px/12px | `py-2.5 px-3` | 紧凑数据展示 |
| 按钮内边距 | 10px/20px | `py-2.5 px-5` | 主按钮 |
| 按钮最小触控 | 44x44px | — | WCAG 触控要求 |
| 标签内边距 | 4px/12px | `py-1 px-3` | 状态徽章 |
| 表单字段间距 | 32px | `space-y-8` | 表单字段之间 |

---

## 四、组件样式

### 按钮

```
主按钮 btnPrimary：
  background: #0891B2
  color: #FFFFFF
  border-radius: 6px (rounded-md)
  padding: 10px 20px
  font-family: Figtree
  font-size: 15px / font-weight: 600
  letter-spacing: 0.02em
  min-height: 44px（触控）
  hover: background #0E7490
  focus: ring 3px solid rgba(8,145,178,0.4)
  disabled: opacity 40%

次要按钮 btnGhost：
  background: #FFFFFF
  color: #0891B2
  border: 2px solid #0891B2
  border-radius: 6px
  font-family: Figtree
  hover: background #ECFEFF
  focus: ring 3px solid rgba(8,145,178,0.4)

危险按钮：
  background: #FFFFFF
  color: #DC2626
  border: 2px solid #FECACA
  border-radius: 6px
  hover: background #FEF2F2
```

### 卡片

```
统计卡片：
  background: #FFFFFF
  border: 1px solid #A5F3FC
  padding: 20px
  box-shadow: 0 1px 3px rgba(0,0,0,0.08)

订单卡片：
  background: #FFFFFF
  border-left: 3px solid #0891B2（按状态变色）
  padding: 16px
  box-shadow: 0 1px 2px rgba(0,0,0,0.06)

卡片左边线颜色规则：
  待接单 = #D97706 琥珀
  设计中 = #0891B2 青蓝
  已完成 = #059669 绿色
  返工/退回 = #DC2626 红色
```

### 导航栏

```
Tab 导航：
  layout: flex / gap: 4px

Tab 项默认：
  padding: 6px 14px
  color: #64748B
  font-family: Figtree
  font-weight: 500
  border-radius: 4px

Tab 项激活：
  background: #0891B2
  color: #FFFFFF
```

### 表格

```
表头：
  padding: 10px 12px
  color: #64748B
  font-family: Figtree
  font-size: 11px / font-weight: 600
  text-transform: uppercase
  letter-spacing: 0.08em
  background: #ECFEFF
  border-bottom: 2px solid #A5F3FC

单元格：
  padding: 10px 12px
  font-size: 14px
  border-bottom: 1px solid #E8F1F6

hover 行：
  background: rgba(8,145,178,0.04)
  transition: 150ms
```

### 状态标签

```
已完成：
  background: #059669 / color: #FFFFFF
  border-radius: 4px / padding: 4px 12px
  font-family: Figtree / letter-spacing: 0.02em

设计中：
  background: #0891B2 / color: #FFFFFF

待接单：
  background: #D97706 / color: #FFFFFF

返工/退回：
  background: #DC2626 / color: #FFFFFF
```

### 输入框

```
background: #FFFFFF
border: 1px solid #A5F3FC
border-radius: 6px (rounded-md)
padding: 12px 14px
font-size: 16px
focus: ring 3px solid rgba(8,145,178,0.4)
placeholder: color #94A3B8
```

---

## 五、Tailwind 配置对照

```js
colors: {
  brand: {
    DEFAULT: '#0891B2',   // 青蓝色系
    dark: '#0E7490',
    light: '#22D3EE',
    soft: '#ECFEFF',
  },
},
fontFamily: {
  heading: ['Figtree', 'sans-serif'],
  body: ['Noto Sans', 'sans-serif'],
},
boxShadow: {
  'card': '0 1px 3px rgba(0,0,0,0.08)',
  'focus': '0 0 0 3px rgba(8,145,178,0.4)',
},
```

---

## 六、与当前项目对照

| 元素 | 当前值 | 方案B值 | 改动 |
|------|--------|---------|------|
| 主色 | #1e5c46 | #0891B2 | 品牌色全改 |
| 字体 | 系统默认 | Figtree + Noto Sans | 全站换字体 |
| 按钮圆角 | rounded-none | rounded-md | 中等 |
| 卡片左边线 | 无 | 3px 彩色 | 新增 |
| 导航激活态 | 纯色块 | 实色胶囊 | 中等 |
| 背景色 | #fdfaf6 | #ECFEFF | 大变化 |
| 无障碍 | 部分 | AAA 全达标 | 大提升 |