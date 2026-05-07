# 口袋记账（ledger-app）

> 最后校准：2026-05-07，以代码为准重写。

## 项目概述
React + Supabase 的多币种在线记账 PWA。前身：仓库根目录 `finance-app.html` 离线原型（已不维护，保留参考）。

## 技术栈
| 层 | 技术 |
|----|------|
| 框架 | React 18 + TypeScript 5 |
| 构建 | Vite 5 + `@vitejs/plugin-react` |
| 样式 | Tailwind CSS 3 |
| 路由 | react-router-dom 6 |
| 后端 | Supabase（Auth + PostgreSQL，全表 RLS） |
| 图表 | chart.js 4 + react-chartjs-2 5（**未装 recharts**） |
| PWA | vite-plugin-pwa（Workbox autoUpdate） |
| 移动打包 | Capacitor 6（Android） |
| 通知 | @capacitor/local-notifications 6 |

## 数据库（4 张表）

以 `src/lib/database.types.ts` 为权威。

| 表 | 关键字段 | 备注 |
|----|---------|------|
| `users_profile` | id, preferred_currency, default_currency, created_at, updated_at | 1:1 auth.users |
| `categories` | id, user_id, name, type, icon, created_at | 用户级分类，**无 updated_at** |
| `transactions` | id, user_id, type, amount, currency, **category_id** UUID, description, date, **exchange_rate**, created_at, updated_at | 流水 |
| `budgets` | id, user_id, **category_id** (NULL=总预算), amount, currency, **period**, created_at | **无 updated_at** |

全部启用 RLS：仅操作自己的行。

### 触发器
- **`handle_new_user`**：新用户注册 → 仅创建 `users_profile` 行，**不创建任何分类**。
- 分类首次使用时由前端 `buildFallback()`（`src/pages/AddTransaction.tsx:29`）兜底返回默认列表。
- `set_updated_at`：仅 `users_profile` / `transactions` 上挂触发器（`categories` / `budgets` 无 updated_at 列）。

### budgets.period
- 类型：`'monthly' | 'yearly'`（CHECK 约束 + `src/types/index.ts:34` 也定义为字面量联合类型）。
- 当前代码只用 `'monthly'`（`src/pages/Budget.tsx:44`），`'yearly'` 为预留。
- 唯一性：`(user_id, period, category_id)`，`category_id IS NULL` 表示总预算。
- NULL 默认不参与 unique 约束，需手动建索引：
  ```sql
  CREATE UNIQUE INDEX budgets_user_period_category_unique
  ON budgets(user_id, period, category_id) NULLS NOT DISTINCT;
  ```
- upsert onConflict：`'user_id,period,category_id'`（`src/hooks/useBudgets.ts:91`）。

## Migration

`supabase/migrations/001_initial_schema.sql` 是**当前生产 schema 的快照式 migration**（一次性建表，不再增量演进；新环境直接执行可得到与生产一致的结构）。

## 多币种与汇率（13 种货币）
- 集中在 `src/types/index.ts`：
  - `Currency` 联合类型
  - `SUPPORTED_CURRENCIES` 数组
  - `CURRENCY_SYMBOLS`、`CURRENCY_LABELS`
- 现有：CNY · MYR · SGD · USD · HKD · JPY · EUR · GBP · THB · KHR · TWD · AUD · MOP
- 添加新币种只改这一个文件 4 处。
- 实时汇率：`https://api.exchangerate-api.com/v4/latest/CNY`，localStorage 缓存 1 小时（key: `ledger_fx_rates`）。
- **存储时快照**：`AddTransaction.tsx` 把 currency→baseCurrency 的瞬时比率写入 `transactions.exchange_rate`。
- **展示时还原**：`Home.tsx` 优先用 exchange_rate 还原本币，再按当前实时汇率转目标币种。

## 路由
定义于 `src/App.tsx`，Provider 嵌套：`LanguageProvider → AuthProvider → CurrencyProvider`。

| 路径 | 组件 | 备注 |
|------|------|------|
| `/auth` | Auth | 登录/注册，已登录自动跳 `/` |
| `/` | Home | 受 ProtectedRoute 保护 |
| `/add` | AddTransaction | hideNav |
| `/calendar` | Calendar | |
| `/charts` | Charts | |
| `/budget` | Budget | hideNav |
| `/settings` | Settings | |
| `*` | redirect → `/` | |

## i18n
- 自定义 Context（`LanguageContext`），无第三方库。
- `src/lib/i18n.ts`：zh/en 两个对象 + 强类型 `TranslationKey`。
- 持久化 key：`ledger_lang`，默认 `'zh'`。
- 支持插值：`t('budgetSubtitle', { year, month, currency })`。

## 离线与同步
- `src/lib/outbox.ts`：写操作先入队 localStorage，联网后批量 push。
- `src/lib/sync.ts`：拉远端 + 推 outbox。
- `src/lib/dataCache.ts`：每张表的快照 localStorage。
- `src/lib/lastSync.ts`：每表最后同步时间。

## 部署
- 主入口：https://ledger.tuchenguang.com（Vercel 默认 URL `ledger-tusts.vercel.app` 仍可访问）
- `vercel.json`：SPA 重写 + sw.js no-cache + assets 长缓存
- 环境变量：`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
- Capacitor `server.url` 已指向 `ledger.tuchenguang.com`（`capacitor.config.ts:10`）

## 已知坑位
- `database.types.ts` 是**手写**，未用 `supabase gen types`；改 schema 需手动同步。
- categories / budgets 无 `updated_at` 列。
- `src/lib/sync.ts:101` 的 `console.warn` 是**有意观测点**（不是调试残留）：当 outbox 写入被服务端拒绝（RLS / 唯一约束冲突等）时记录，等 toast 接入后再替换。

## 历史修复记录（按时间倒序，便于回溯）
- 全局日期 UTC 偏移修复：用 `localDateStr()` 替代 `toISOString()`，避免 UTC+8 凌晨记账记到昨天
- 日历今日高亮 UTC 偏移修复
- 配置 Resend SMTP（smtp.resend.com:465，发件人 onboarding@resend.dev "口袋记账"）
- 货币定义统一收口到 `types/index.ts`，新增 MOP
- PWA 图标：红底白字"记账"，含 192/512/maskable 三个 PNG
- 全局滚动：html/body/#root 加 `height:100%; overflow:hidden`；Layout 用 `h-dvh`
- BottomNav 从 `fixed` 改为正常流（`shrink-0`），Layout main 去掉 `pb-16`
- 删除首页底部"+ 记一笔"文字按钮（保留导航栏 + 圆形按钮）
- 记账页键盘高度压缩（py 缩窄共节省约 50px）
- 各页 header `pt-12 → pt-4`（viewport 未设 viewport-fit=cover，safe-area-inset-top 为 0）
- PWA 状态栏：theme-color = `#ffffff`，viewport 加 `viewport-fit=cover`

## GitHub
Hooper18/ledger（main 分支）

## 参考
离线版源码：`../finance-app.html`
