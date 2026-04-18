# PROJECT_OVERVIEW.md

> 生成于 2026-04-18。静态阅读代码所得，未执行任何构建命令。

---

## 1. 仓库结构

这是一个**单 Git 仓库 + 多子项目**的组织方式，根目录无独立 package.json：

| 目录 | 描述 | 独立 .git？ |
|------|------|-------------|
| `ledger-app/` | 主项目：口袋记账 Web App | 否（共享根 repo） |
| `billiards-scorer/` | 台球计分器（独立项目） | 是 |
| `tuchenguang-site/` | 个人网站（Astro） | 是 |
| `finance-app.html` | 离线版原型（参考用，不维护） | — |

**主项目文档**：`ledger-app/Claude.md`（注意大写 C，非 CLAUDE.md）。  
**git log 记录**：因 Windows 大小写不敏感，`git log -- ledger-app/Claude.md` 无输出；文件系统时间戳显示最后修改 Apr 15 2025；最近 commit message 含"更新CLAUDE.md"。

---

## 2. 技术栈（以实际文件为准）

| 层 | 技术 |
|----|------|
| 框架 | React 18 + TypeScript 5 |
| 构建 | Vite 5 + `@vitejs/plugin-react` |
| 样式 | Tailwind CSS 3 |
| 路由 | react-router-dom 6 |
| 后端/数据库 | Supabase（Auth + PostgreSQL） |
| 图表 | **chart.js 4 + react-chartjs-2 5** 以及 **recharts 2**（两个库同时安装） |
| PWA | vite-plugin-pwa 1（Workbox autoUpdate） |
| 图标 | lucide-react |

---

## 3. 目录树（`src/` 两层）

```
ledger-app/src/
├── App.tsx                     # 路由定义、Provider 嵌套
├── main.tsx                    # 入口
├── index.css                   # 全局样式（Tailwind 指令 + no-scrollbar）
├── vite-env.d.ts
│
├── contexts/
│   ├── AuthContext.tsx          # Supabase Auth 封装
│   ├── CurrencyContext.tsx      # 汇率 + 用户币种偏好
│   └── LanguageContext.tsx      # i18n 语言切换
│
├── lib/
│   ├── supabase.ts             # createClient（读 VITE_SUPABASE_URL/ANON_KEY）
│   ├── database.types.ts       # 手写 Supabase 类型（非自动生成）
│   └── i18n.ts                 # zh/en 翻译对象 + TranslationKey 类型
│
├── pages/
│   ├── Auth.tsx                # 登录/注册页
│   ├── Home.tsx                # 首页（月度流水 + 搜索/筛选）
│   ├── AddTransaction.tsx      # 记一笔 + 编辑
│   ├── Calendar.tsx            # 日历视图
│   ├── Charts.tsx              # 统计图表
│   ├── Budget.tsx              # 预算管理
│   └── Settings.tsx            # 设置（货币/语言/登出）
│
├── components/
│   ├── TransactionSheet.tsx    # 交易详情 bottom sheet（含删除/编辑入口）
│   └── layout/
│       ├── Layout.tsx          # flex 容器 + BottomNav（h-dvh）
│       └── BottomNav.tsx       # 底部导航（正常流，非 fixed）
│
└── types/
    └── index.ts                # 所有类型 + 常量（Currency、分类、图标映射）
```

---

## 4. 路由结构

定义在 `src/App.tsx`：

| 路径 | 组件 | 说明 |
|------|------|------|
| `/auth` | `Auth` | 登录/注册，已登录自动跳 `/` |
| `/` | `Home` | 首页，受 ProtectedRoute 保护 |
| `/add` | `AddTransaction` | 记一笔，`hideNav`（隐藏底部导航） |
| `/calendar` | `Calendar` | 日历视图 |
| `/charts` | `Charts` | 统计图表 |
| `/settings` | `Settings` | 设置 |
| `/budget` | `Budget` | 预算管理，`hideNav` |
| `*` | redirect → `/` | 兜底重定向 |

Provider 嵌套顺序（外→内）：`LanguageProvider → AuthProvider → CurrencyProvider`

---

## 5. 数据层

### 5.1 Supabase 客户端

`src/lib/supabase.ts`：`createClient<Database>(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)`

### 5.2 数据库表（以 `database.types.ts` 为准，共 4 张）

| 表名 | 主要字段 | 说明 |
|------|----------|------|
| `users_profile` | id, preferred_currency, default_currency | 1:1 auth.users |
| `transactions` | id, user_id, type, amount, currency, **category_id**, description, date, **exchange_rate** | 流水记录 |
| `categories` | id, user_id, name, type, icon | 用户自定义分类 |
| `budgets` | id, user_id, **category_id** (NULL=总预算), amount, currency, **period** | 预算 |

全部开启 RLS，仅操作自己的行。

**触发器**：新用户注册 → `handle_new_user()` → 创建 `users_profile` 行（仅此，不创建分类）。

### 5.3 Migration 文件

`ledger-app/supabase/migrations/001_initial_schema.sql`（仅 1 个）。
**注意**：该 SQL 是早期设计稿，`transactions.category` 为 TEXT、`budgets.category` 为 TEXT，与当前实际运行的 DB（使用 `category_id UUID FK`）不符，**不可直接执行**。

### 5.4 状态管理

纯 **React Context API + useState**，无 Redux / Zustand：
- `AuthContext`：user, session, loading, signIn/signUp/signOut
- `CurrencyContext`：baseCurrency, defaultCurrency, rates, convert()
- `LanguageContext`：lang, t(), setLang()

### 5.5 类型定义

集中在 `src/types/index.ts`（Currency、Transaction、Budget、TxDetail、常量、图标映射）。  
DB 类型在 `src/lib/database.types.ts`（手写，未用 `supabase gen types`）。

---

## 6. 核心功能模块

| 功能 | 主要文件 |
|------|----------|
| 交易 CRUD | `pages/AddTransaction.tsx`（新增/编辑）、`components/TransactionSheet.tsx`（删除/编辑入口） |
| 首页流水列表 | `pages/Home.tsx` |
| 搜索/筛选 | `pages/Home.tsx`（FilterState，含关键词/日期/类型/分类） |
| 日历视图 | `pages/Calendar.tsx` |
| 图表统计 | `pages/Charts.tsx`（使用 chart.js 或 recharts，需确认） |
| 预算管理 | `pages/Budget.tsx` |
| 多币种 | `contexts/CurrencyContext.tsx` + `types/index.ts` |
| 多语言（zh/en） | `contexts/LanguageContext.tsx` + `lib/i18n.ts` |
| PWA | `vite.config.ts`（VitePWA 配置） |

### 6.1 汇率快照逻辑（重点）

**位置**：`contexts/CurrencyContext.tsx` + `pages/AddTransaction.tsx`

**运行时汇率**：
- 从 `https://api.exchangerate-api.com/v4/latest/CNY` 拉取，以 CNY 为基准
- 缓存于 localStorage（key: `ledger_fx_rates`，TTL: 1 小时）
- `rates[X]` = 1 CNY 能换多少 X

**存储时快照**（`AddTransaction.tsx:131-133`）：
```ts
const exchange_rate = currency !== baseCurrency
  ? (rates[currency] ?? 1) / (rates[baseCurrency] ?? 1)
  : null
```
存入 `transactions.exchange_rate`，记录创建时的汇率比率。

**展示时转换**（`Home.tsx:76-83`）：
- 有 `exchange_rate`：`amount / exchange_rate` 先还原为 baseCurrency，再按实时汇率转显示货币
- 无 `exchange_rate`：直接用实时汇率 `(amount / rates[from]) * rates[to]`

### 6.2 i18n 实现

- 方式：自定义 Context，无第三方 i18n 库
- 语言文件：`src/lib/i18n.ts`（zh + en 两个 TypeScript 对象，强类型 `TranslationKey`）
- 持久化：localStorage（key: `ledger_lang`），默认 `'zh'`
- 支持变量插值：`t('budgetSubtitle', { year, month, currency })`

---

## 7. 配置与部署

### 7.1 Vite 配置 (`vite.config.ts`)

```
PWA: autoUpdate, NetworkFirst for *.supabase.co/* (10s timeout)
dev server: port 5173, host: true
无路径别名（无 @/ 配置）
```

### 7.2 环境变量

仅 2 个（`.env.example`）：
```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 7.3 Vercel 部署 (`vercel.json`)

- SPA 重写：`/* → /index.html`
- `sw.js`：`no-cache`（PWA service worker 每次检查更新）
- `/workbox-*.js`、`/assets/*`：1年不可变缓存
- 已部署：https://ledger-tusts.vercel.app

---

## 8. Claude.md 校验（不一致之处）

| # | Claude.md 描述 | 实际代码 | 严重程度 |
|---|----------------|----------|----------|
| 1 | "三张表：categories, transactions, budgets" | 实际 4 张：`users_profile` + 上述 3 张 | 错误 |
| 2 | "新用户触发器自动创建默认分类（餐饮、交通等）" | 触发器 `handle_new_user()` 只创建 `users_profile` 行，**不创建分类**；前端用 `buildFallback()` 做本地兜底 | 错误 |
| 3 | "budgets.period 只能是 'monthly' 或 'yearly'" | 代码实际查询 `period = '2026-04'`（YYYY-MM 格式）；migration SQL 的 CHECK constraint 与实际不符 | 严重错误 |
| 4 | 技术栈只列了 Chart.js | `package.json` 同时有 `recharts ^2.12.0`，两个图表库同时存在 | 缺失 |
| 5 | "货币选择器改为完整列表并支持滚动（12种货币）" | `types/index.ts` 实际 **13 种**（Claude.md 自身同一文件记录了新增 MOP，但 12 种未更新） | 内部矛盾 |
| 6 | 未提及 `TransactionSheet` 组件 | 交易详情 bottom sheet 是独立组件 `components/TransactionSheet.tsx` | 缺失 |
| 7 | 未提及 `TxDetail` 类型 | `types/index.ts` 定义了 `TxDetail` 接口，与 DB 查询结果结构相关 | 缺失 |
| 8 | Migration SQL 可直接使用（隐含） | Migration SQL 是早期设计，`transactions.category` 为 TEXT，实际 DB 使用 `category_id UUID`，直接执行会损坏数据 | 危险 |
| 9 | 未记录 KHR 符号映射问题 | `CURRENCY_SYMBOLS.KHR = '₫'`（越南盾符号），疑为笔误 | 潜在 bug |

---

## 9. 待办（来自 Claude.md）

- [ ] Resend 域名验证 pocketledger.top（依赖阿里云实名认证）
- [ ] Vercel 绑定 pocketledger.top
- [ ] Supabase SMTP 改为 noreply@pocketledger.top
