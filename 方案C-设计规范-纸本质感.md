# 方案C · 纸本质感 — 设计规范

> 设计理念：印刷品级的排版质感，像一本精装书。编辑黑主色，Libre Bodoni 衬线标题 + Public Sans 正文，大间距留白。

---

## 一、配色

| 角色 | 色值 | Tailwind | 用途 |
|------|------|----------|------|
| 主色 Primary | `#18181B` | `zinc-900` | 品牌色：按钮、标题、强调线 |
| 辅助色 Secondary | `#3F3F46` | `zinc-700` | 次要文字、禁用态 |
| 强调色 Accent | `#EC4899` | `pink-500` | 极少量点缀（链接、数字高亮） |
| 背景 Background | `#FAFAFA` | `zinc-50` | 页面主背景 |
| 卡片 Card | `#FFFFFF` | `white` | 卡片 |
| 前景 Foreground | `#09090B` | `zinc-950` | 正文文字，纯黑 |
| 次要文字 Muted | `#71717A` | `zinc-500` | 辅助说明 |
| 边框 Border | `#E4E4E7` | `zinc-200` | 卡片边框、分隔线 |
| 浅填充 Muted BG | `#F4F4F5` | `zinc-100` | 表格偶数行 |
| 危险 Destructive | `#DC2626` | `red-600` | 删除、退回 |
| 光环 Ring | `#18181B` | `zinc-900` | 焦点环 |

---

## 二、字体

| 层级 | 字体 | 字号 | 字重 | 行高 | 用途 |
|------|------|------|------|------|------|
| H1 页面标题 | Libre Bodoni | 32px | 700 | 1.2 | 客户端/管理端标题 |
| H2 区块标题 | Libre Bodoni | 20px | 600 | 1.3 | SectionHead |
| Body 正文 | Public Sans | 15px | 400 | 1.7 | 订单要求、表格内容 |
| Small 辅助 | Public Sans | 11px | 400 | 1.5 | 时间戳、提示文字 |
| Mono 数据 | JetBrains Mono | 13px | 500 | 1.4 | 单号、积分 |
| Stat 统计 | Libre Bodoni | 36px | 700 | 1.1 | 概览卡片数字 |

**引入方式：**
```html
<link href="https://fonts.googleapis.com/css2?family=Libre+Bodoni:wght@400;500;600;700&family=Public+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

**Tailwind 配置：**
```js
fontFamily: {
  display: ['Libre Bodoni', 'serif'],
  body: ['Public Sans', 'sans-serif'],
  mono: ['JetBrains Mono', 'monospace'],
}
```

---

## 三、间距

| 场景 | 值 | Tailwind | 说明 |
|------|-----|----------|------|
| 页面水平边距 | 24px | `px-6` | 左右留白更多 |
| 页面顶部间距 | 48px | `pt-12` | 充足呼吸感 |
| 页面底部间距 | 120px | `pb-30` | 底部大量留白 |
| 区块间距 | 48px | `mb-12` | 区块之间大间隔 |
| 卡片内边距 | 24px | `p-6` | 卡片内部宽松 |
| 表格单元格 | 12px/12px | `py-3 px-3` | 上下左右均衡 |
| 按钮内边距 | 12px/24px | `py-3 px-6` | 更大的点击区域 |
| 标签内边距 | 2px/8px | `py-0.5 px-2` | 紧致标签 |
| 表单字段间距 | 40px | `space-y-10` | 表单字段之间 |
| 导航项间距 | 32px | `gap-8` | 导航项之间 |

---

## 四、组件样式

### 按钮

```
主按钮 btnPrimary：
  background: #18181B
  color: #FFFFFF
  padding: 12px 24px
  font-size: 14px / font-weight: 600
  letter-spacing: 0.04em
  hover: background #3F3F46
  active: background #09090B
  disabled: opacity 40%

次要按钮 btnGhost：
  background: transparent
  color: #18181B
  border-bottom: 2px solid #18181B
  padding: 12px 0
  border-radius: 0
  letter-spacing: 0.04em
  hover: border-bottom-color: #3F3F46 / color: #3F3F46

危险按钮：
  color: #DC2626
  border-bottom: 2px solid #DC2626
  padding: 12px 0 / border-radius: 0
```

### 卡片

```
统计卡片：
  background: #FAFAFA
  border-left: 3px solid #18181B
  padding: 24px
  box-shadow: none

订单卡片：
  background: #FFFFFF
  border: 1px solid #E4E4E7
  padding: 20px
  box-shadow: none

卡片左边线颜色规则：
  待接单 = #18181B 黑色
  设计中 = #3F3F46 深灰
  已完成 = #E4E4E7 淡灰
  返工/退回 = #DC2626 红色
```

### 导航栏

```
Tab 导航：
  layout: flex / gap: 32px

Tab 项默认：
  color: #71717A
  font-size: 13px
  font-weight: 500
  letter-spacing: 0.04em
  position: relative

Tab 项激活：
  color: #18181B
  font-weight: 700
  底部 1px 黑色下划线（::after 伪元素）
```

### 表格

```
表头：
  padding: 12px 12px
  color: #71717A
  font-size: 10px / font-weight: 500
  text-transform: uppercase
  letter-spacing: 0.08em
  border-bottom: 1px solid #E4E4E7

单元格：
  padding: 12px 12px
  font-size: 14px
  border-bottom: 1px solid #E4E4E7

首列（单号）：
  font-family: JetBrains Mono
  font-weight: 600

hover 行：
  background: #F4F4F5
  transition: 150ms
```

### 状态标签

```
已完成：
  background: #18181B / color: #FAFAFA
  padding: 2px 8px / font-size: 10px
  text-transform: uppercase / letter-spacing: 0.08em
  font-weight: 700

设计中：
  border-bottom: 2px solid #18181B / color: #18181B
  background: transparent

待接单：
  border-bottom: 2px solid #3F3F46 / color: #3F3F46
  background: transparent

返工/退回：
  color: #DC2626
  border-bottom: 2px solid #DC2626
  background: transparent
```

### 输入框

```
background: #FFFFFF
border: none
border-bottom: 1px solid #E4E4E7
padding: 12px 0 8px 0
font-size: 16px
border-radius: 0
focus: border-bottom-color: #18181B
transition: 200ms
```

---

## 五、Tailwind 配置对照

```js
colors: {
  brand: {
    DEFAULT: '#18181B',
    dark: '#09090B',
    light: '#3F3F46',
    soft: '#FAFAFA',
  },
},
fontFamily: {
  display: ['Libre Bodoni', 'serif'],
  body: ['Public Sans', 'sans-serif'],
  mono: ['JetBrains Mono', 'monospace'],
},
boxShadow: {
  DEFAULT: 'none',  // 不使用阴影
},
borderRadius: {
  DEFAULT: '0',     // 全站直角
},
```

---

## 六、与当前项目对照

| 元素 | 当前值 | 方案C值 | 改动 |
|------|--------|---------|------|
| 主色 | #1e5c46 | #18181B 黑 | 全线改色 |
| 字体 | 系统默认 | Libre Bodoni + Public Sans | 三套新字体 |
| 按钮圆角 | rounded-none | 不变（直角） | 保持 |
| 按钮样式 | 填充色块 | 底部线条 | 大变化 |
| 阴影 | shadow-sm | none | 全部移除 |
| 导航激活态 | 纯色块 | 底部黑线 | 大变化 |
| 卡片 | 白底细框 | 左边粗线 | 大变化 |
| 间距 | 紧凑 | 大量留白 | 全站加宽 |