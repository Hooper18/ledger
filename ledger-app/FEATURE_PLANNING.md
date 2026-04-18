# Feature Planning

## 调查结论

### A. 认证与邮件相关

**A1. 登录/注册代码位置**

- `src/pages/Auth.tsx` — 完整的 UI 层（登录/注册 tab 切换，第 5–189 行）
  - 第 40–50 行：登录分支，调用 `useAuth().signIn(email, password)`
  - 第 51–65 行：注册分支，调用 `useAuth().signUp(email, password)`
- `src/contexts/AuthContext.tsx` — 封装 Supabase 调用
  - 第 40 行：`supabase.auth.signInWithPassword({ email, password })`
  - 第 44 行：`supabase.auth.signUp({ email, password })`
  - 当前暴露：`signIn`, `signUp`, `signOut` — **没有** `resetPassword` / `updateUser`

**A2. Supabase client 初始化**

- `src/lib/supabase.ts` — 极简文件，仅导出 `supabase` client（第 13 行），无任何辅助函数
- 忘记密码需要的方法 `supabase.auth.resetPasswordForEmail()` 和修改密码需要的 `supabase.auth.updateUser()` 在 SDK 里现成，但尚未封装到 `AuthContext`

**A3. 邮件触发代码**

- 注册成功提示在 `Auth.tsx:60`：硬编码中文 `"注册成功！请检查邮箱，点击验证链接后即可登录。"`
- 邮件模板不在代码库里，在 Supabase Dashboard 管理
- `CLAUDE.md` 确认已配置 Resend SMTP（smtp.resend.com:465，发件人 `onboarding@resend.dev`，模板已中文化）
- 忘记密码邮件会走同一个 SMTP 通道，无需额外配置

**A4. .env / .env.example 里的邮件相关变量**

- `.env.example` 只有两个变量：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`
- `.env` 中无 `RESEND_*` 或 `SMTP_*` 变量（Resend 配置在 Supabase 后台，前端无感知）

**A5. README/CLAUDE.md 里的 Resend SMTP 说明**

- `CLAUDE.md` 已记录："配置 Resend SMTP：smtp.resend.com:465，发件人 onboarding@resend.dev '口袋记账'，邮箱验证中文化"
- 待办项：阿里云实名认证通过后，验证域名 pocketledger.top、将发件地址改为 `noreply@pocketledger.top`
- **结论**：SMTP 通道可用，忘记密码邮件可直接使用现有 Resend 配置发出

---

### B. 设置页与路由

**B1. 设置页结构**

`src/pages/Settings.tsx`，当前分为 4 个区块：
1. **Account card**（第 50–62 行）：展示用户邮箱和首字母头像
2. **货币** section（第 64–98 行）：偏好货币 + 默认记账货币，点击弹出底部 Sheet
3. **其他** section（第 100–118 行）：预算管理（跳转 `/budget`）+ 数据导出（disabled 占位符）
4. **退出登录** section（第 121–129 行）

使用 `Layout` 组件（带底部导航），无 `hideNav`。

**B2. 路由定义**

`src/App.tsx` 第 34–101 行，react-router-dom v6 `<Routes>/<Route>`。

现有路由：`/auth`、`/`、`/add`、`/calendar`、`/charts`、`/settings`、`/budget`。

新增路由的两种模式：
- 需要登录：`<ProtectedRoute><Layout><NewPage /></Layout></ProtectedRoute>`
- 不需要登录（如重置密码落地页）：直接 `element={<ResetPassword />}`，**不套 ProtectedRoute**

`/reset-password` 页面必须在 ProtectedRoute 外，因为用户点邮件链接时没有 session。

**B3. 获取当前 session**

- `useAuth()` 返回 `{ user, session, ... }` — `src/contexts/AuthContext.tsx:5–12`
- `session` 类型为 `Session | null`（Supabase JS SDK）
- 修改密码调用：`supabase.auth.updateUser({ password: newPassword })`，需要用户已登录（active session 即可，无需重新验证旧密码）

---

### C. 数据导出能力

**C1. 现有导出代码**

全库搜索（download / blob / saveAs / xlsx / papaparse / csv / export）：**无任何现成导出代码**，需要从零新建。

**C2. 数据访问层**

项目没有 service 层，所有 Supabase 查询内联在页面组件里：
- 交易记录：`Home.tsx:109–120`，`select('id, type, amount, currency, description, date, category_id, exchange_rate, categories(name, icon)')`
- 预算：`Budget.tsx` 内联
- 分类：`AddTransaction.tsx:88`

**导出时可复用的模式**（不复用现有函数，需要写一个全量 fetch）：

```ts
supabase
  .from('transactions')
  .select('id, type, amount, currency, description, date, exchange_rate, categories(name, icon)')
  .eq('user_id', user.id)
  .order('date', { ascending: false })
```

**C3. exchange_rate 字段与多币种换算**

- `database.types.ts:46`：transactions 表有 `exchange_rate: number | null`（存的是记账时的汇率快照）
- `CurrencyContext.tsx:77–84`：`convert(amount, fromCurrency)` 用**实时汇率**转换到 baseCurrency
- 两种导出策略：
  - 原始数据：直接导出 `amount`（原始值）+ `currency`（原始货币）+ `exchange_rate`（记账时汇率，可能 null）
  - 换算数据：调用 `convert()` 统一折算成 baseCurrency（依赖当前实时汇率，每次导出结果可能不同）
- 推荐：原始数据 + 一列换算值（CNY），两者都给用户

**C4. Bundle 体积**

- `dist/assets/index-B_0NwkXp.js` = 597 KB（单包，未分 chunk）
- 无代码分割
- papaparse 约 30 KB（gzip ~12 KB）——可接受
- xlsx / exceljs 约 1 MB+——**不推荐**，移动端 PWA 代价太高
- 纯手写 CSV 生成（无需任何库）：对本项目完全可行，字段无嵌套

---

### D. i18n 现状

**D1. i18n 框架依赖**

`package.json` 中**没有** `react-i18next`、`i18next`、`@formatjs/intl`。  
项目使用**完全自研**的轻量 i18n 方案。

**D2. i18n 初始化与语言文件**

- `src/lib/i18n.ts`：单文件，包含完整的 `zh` 和 `en` 两个翻译 dict，约 136 个 key
- `src/contexts/LanguageContext.tsx`：Context Provider，提供 `t(key, vars)`、`setLang()`，语言偏好持久化到 `localStorage('ledger_lang')`
- **无独立 locale JSON 文件**，全部在 `i18n.ts` 里

**D3. 各页面字符串硬编码 vs t() 调用（抽样检查）**

| 文件 | 使用 `t()` | 状态 |
|---|---|---|
| `Home.tsx` | ✅ 是 | 完全接入 |
| `Calendar.tsx` | ✅ 是 | 完全接入 |
| `AddTransaction.tsx` | ✅ 是 | 完全接入 |
| `BottomNav.tsx` | ✅ 是 | 完全接入 |
| `TransactionSheet.tsx` | ✅ 是 | 完全接入 |
| `Budget.tsx` | ❌ 否 | **全硬编码中文** |
| `Charts.tsx` | ❌ 否 | **全硬编码中文** |
| `Settings.tsx` | ❌ 否 | **全硬编码中文** |
| `Auth.tsx` | ❌ 否 | **全硬编码中文** |

实际抽样字符串（Settings.tsx）：`'设置'`、`'个人账户'`、`'货币'`、`'偏好货币'`、`'退出登录'` ——均为硬编码中文，与已有 i18n.ts 中的 key 一一对应但未接入。

**D4. 翻译文件统计**

- `i18n.ts` 约 136 个 key，zh 和 en **两种语言均完整**（TypeScript 用 `const en: typeof zh` 强制对齐）
- **没有缺 key**，基础覆盖面良好
- 新功能（忘记密码、修改密码、数据导出）需要补充若干新 key

**D5. 语言切换 UI 入口**

- `i18n.ts` 里有 `languageSection`、`languageLabel`、`languageDesc`、`selectLanguage`、`langZh`、`langEn` 等 key——**有基础设施但无 UI**
- `Settings.tsx` 当前**完全没有渲染**语言切换 section
- `LanguageContext.tsx` 的 `setLang()` 可直接用，UI 还没加上去

---

### E. 现有 Bug 摸底

**E1. 注册流程 & users_profile**

- `Auth.tsx:52`：`signUp(email, password)` → `supabase.auth.signUp()`，**前端没有手动 insert users_profile**
- `001_initial_schema.sql:125–141`：DB 触发器 `on_auth_user_created` 在 `auth.users` 插入时自动执行 `INSERT INTO users_profile (id)`

理论上 trigger 应该保证每次注册都创建 profile。  
**但**：用户描述 "categories 有 3 个用户的数据，users_profile 只有 1 行"。可能原因：
1. 触发器是后来才加的，早期注册的用户没有 profile（migration 是否完整应用过存疑）
2. `CurrencyContext.tsx:44–46` 有兜底逻辑：检测到 profile 行缺失时，会调用 `supabase.from('users_profile').upsert({ id: user.id })`，所以已登录老用户会自动补建

**结论**：注册时 profile 创建依赖 DB trigger，前端只有兜底 upsert。如果 trigger 漏掉了老用户，功能上不会崩（CurrencyContext 会补），但数据不干净。

**E2. 默认分类的创建方式**

- `database.types.ts` 显示 `categories` 表存在（有 `user_id`, `name`, `type`, `icon` 字段）
- `001_initial_schema.sql` **不包含** categories 表定义，也**没有**创建默认分类的触发器
- `CLAUDE.md` 说 "新用户注册时触发器自动创建默认分类" ——但 migration 文件里没有这段逻辑

**结论**：categories 表 + 默认分类触发器是**直接在 Supabase Dashboard 创建的，未同步到 migration 文件**。本地 migration SQL 和实际生产 schema 存在重大漂移（见风险提示）。

---

## 4 个功能的实现方案

### 功能 1：忘记密码

**复用什么现成代码**
- `Auth.tsx` 的 UI 骨架（card、error/message 展示、loading button）
- `useAuth()` context（需要新增 `resetPassword` 方法）
- Resend SMTP 通道已就绪，Supabase `resetPasswordForEmail()` 直接复用

**需要新建什么**
- `src/pages/ResetPassword.tsx`：邮件链接落地页（输入新密码 + 确认，调用 `updateUser`）
- `src/lib/i18n.ts`：新增约 8 个 key（forgotPassword, sendResetEmail, resetEmailSent, newPassword, confirmNewPassword, resetPassword, resetSuccess, backToLogin）

**涉及文件改动**
1. `src/contexts/AuthContext.tsx`：暴露 `resetPassword(email)` 方法
2. `src/pages/Auth.tsx`：登录 tab 下新增"忘记密码？"链接，切换到 `mode='forgot'` 子状态
3. `src/pages/ResetPassword.tsx`：新建落地页
4. `src/App.tsx`：新增 `/reset-password` route（**在 ProtectedRoute 外**）
5. `src/lib/i18n.ts`：补充 key

**预估工作量**：小

**依赖关系**：无外部依赖，Supabase 方法现成

---

### 功能 2：修改密码

**复用什么现成代码**
- `Settings.tsx` 的底部 Sheet 组件逻辑（已有货币选择 Sheet 的 slideUp 动画）
- `useAuth()` 的 `session` 对象
- `supabase.auth.updateUser()` SDK 方法

**需要新建什么**
- Settings 页里新增"账号安全"section 和修改密码 Sheet（inline，不需要新文件）
- i18n.ts：新增约 6 个 key（changePassword, currentPassword, newPasswordLabel, passwordChanged, passwordChangeFailed, accountSection）

**涉及文件改动**
1. `src/pages/Settings.tsx`：新增"账号安全"section + 底部 Sheet UI
2. `src/lib/i18n.ts`：补充 key

**预估工作量**：小

**依赖关系**
- 依赖功能 4（语言切换）之前，Settings.tsx 尚未接入 `t()`，修改密码实现时顺手接入，或者先硬编码再统一处理
- 不需要先实现忘记密码

---

### 功能 3：数据导出

**复用什么现成代码**
- `Home.tsx:109–120` 的 Supabase 查询模式（全量 fetch，去掉月份过滤即可）
- `CurrencyContext.tsx:77–84` 的 `convert()` 函数（用于换算列）
- 纯手写 CSV（无需引库）：`Blob + URL.createObjectURL + <a>.click()`

**需要新建什么**
- `src/pages/Settings.tsx`：解除"数据导出"button 的 disabled，改为打开导出配置 Sheet
- 导出逻辑可 inline 在 Settings.tsx，或提取成 `src/utils/exportCsv.ts`（建议后者，便于测试）
- i18n.ts：新增约 10 个 key（exportData, exportRange, exportAll, exportThisMonth, exportFormat, exportColumns, exporting, exportSuccess, exportFailed, exportDateFrom, exportDateTo）

**涉及文件改动**
1. `src/pages/Settings.tsx`：启用导出按钮 + 导出配置 Sheet
2. `src/utils/exportCsv.ts`：新建，封装 fetch + CSV 生成 + 下载触发
3. `src/lib/i18n.ts`：补充 key

**预估工作量**：中（数据 fetch、CSV 字段映射、多币种列、时间筛选逻辑都要写）

**依赖关系**：不依赖其他功能，可独立实现

---

### 功能 4：中英文切换

**复用什么现成代码**
- 基础设施已完整：`LanguageContext`、`i18n.ts`（136 key，zh + en 齐全）、`t()` 函数
- Home、Calendar、AddTransaction、BottomNav、TransactionSheet 已接入，直接受益

**需要新建什么**
- 无需新文件
- 主要工作：**把 4 个未接入页面（Settings、Auth、Budget、Charts）改为使用 `t()`**

**涉及文件改动**
1. `src/pages/Settings.tsx`：接入 `useLanguage()`，将所有硬编码字符串替换为 `t('xxx')`，并渲染语言切换 section（key 已有）
2. `src/pages/Auth.tsx`：接入 `useLanguage()`，替换所有硬编码字符串
3. `src/pages/Budget.tsx`：接入 `useLanguage()`，替换所有硬编码字符串（`i18n.ts` 里 budget 相关 key 已完整）
4. `src/pages/Charts.tsx`：接入 `useLanguage()`，替换所有硬编码字符串
5. `src/types/index.ts`：`CURRENCY_LABELS` 当前为中文，切换英文时需要国际化（见待决策事项）
6. `src/lib/i18n.ts`：按需补充新功能 key

**预估工作量**：中（改动文件多，但每处改动机械重复，风险低）

**依赖关系**：其他 3 个功能都会新增 UI 文字，建议先完成 i18n 接入，再开发其他功能，否则要回头补两遍

---

## 待用户决策的事项

### 1. 忘记密码邮件：用 Supabase 默认 vs Resend？

| 选项 | 说明 |
|---|---|
| A. **继续用已配置的 Resend**（推荐） | smtp.resend.com:465 已配好，邮件模板已中文化，无需任何额外配置，直接调 `resetPasswordForEmail()` 即可发出 |
| B. Supabase 内置 SMTP | 默认发件人是 Supabase 官方域名，邮件模板是英文，需要额外修改 |

**推荐 A**，理由：已经做好，零成本，且发件人名称是"口袋记账"，体验更好。

---

### 2. 修改密码：是否先验证旧密码？

| 选项 | 说明 |
|---|---|
| A. **不验证旧密码**（推荐） | 直接调 `supabase.auth.updateUser({ password: newPassword })`，用户已登录即认为授权。Supabase 本身不提供"先验证旧密码再改"的原子 API |
| B. 先用旧密码重新登录验证 | 调 `signInWithPassword(email, oldPwd)`，成功后再 `updateUser`。能防止"借用别人解锁屏幕改密码"场景，但实现更复杂 |

**推荐 A**，理由：用户必须已登录（有 session），安全边界足够；移动端 UX 更流畅；Supabase 官方文档示例也是直接 `updateUser`。若担心安全，可在修改密码后自动登出其他设备（`signOut({ scope: 'others' })`，Supabase 支持）。

---

### 3. 数据导出范围：哪些表？

| 选项 | 内容 |
|---|---|
| A. **仅交易记录**（推荐） | transactions 表，包含日期/类型/金额/货币/分类/备注 |
| B. 交易 + 预算 | 同时导出 budgets 表 |
| C. 交易 + 预算 + 分类定义 | 再加 categories 表（用于重建数据） |

**推荐 A**，理由：用户最核心的需求是交易流水；预算和分类配置意义不大，且多文件下载在移动端体验差。

---

### 4. 数据导出格式：CSV vs JSON？

| 选项 | 说明 |
|---|---|
| A. **CSV**（推荐） | Excel/Numbers 直接打开，无需任何库（手写 20 行代码），文件小，用户最熟悉 |
| B. JSON | 完整保留所有字段，但普通用户无法直接使用 |
| C. 两种都支持 | 增加选项复杂度，对大多数用户没必要 |

**推荐 A**，理由：目标用户是个人记账，用 Excel 看流水是主要场景。

---

### 5. 数据导出多币种处理：原币 / 换算 CNY / 两列都要？

| 选项 | CSV 列 |
|---|---|
| A. **原始币 + 折算列**（推荐） | `amount`（原始金额）、`currency`（原始货币）、`amount_cny`（折算 CNY） |
| B. 仅原始币 | 只有 `amount` + `currency`，用户需要自己换算 |
| C. 仅折算 CNY | 丢失原始数据，不可逆 |

**推荐 A**，理由：原始数据保留，折算列方便汇总；折算用 `exchange_rate` 字段（记账时快照，比实时汇率更准确反映当时价值）。

---

### 6. 数据导出是否带时间筛选？

| 选项 | 说明 |
|---|---|
| A. **支持筛选（全部/本月/自定义日期范围）**（推荐） | 用户数据积累后全量导出可能很大，筛选更实用 |
| B. 仅全量导出 | 实现最简单 |

**推荐 A**，理由：工作量差别不大（Supabase query 加两个 `.gte` / `.lte` 即可），用户体验好很多。

---

### 7. i18n：基于现状如何推进？

**现状**：自研方案，136 key 完整，5 个组件已接入，4 个组件（Auth、Settings、Budget、Charts）还在用硬编码中文。

| 选项 | 说明 |
|---|---|
| A. **补全接入现有 4 个组件**（推荐） | 把 Auth、Settings、Budget、Charts 接入 `t()`，顺手加语言切换 UI，工作量约 2–3 小时，效果立竿见影 |
| B. 引入 react-i18next 重写 | 引入 ~40KB 依赖、重构所有 `t()` 调用，但现有方案已足够用，没必要 |
| C. 只加语言切换入口、先不管 Budget/Charts | UI 看起来会切换了，但 Budget/Charts 页面仍然是中文，体验割裂 |

**推荐 A**，理由：自研方案已经运行良好，补全 4 个组件是机械劳动，无架构风险。

---

### 8. 语言切换入口放哪？

| 选项 | 说明 |
|---|---|
| A. **Settings 页新增"语言"section**（推荐） | 与货币设置风格一致，i18n.ts 里的 `languageSection`/`selectLanguage` key 已经准备好 |
| B. Settings 页 Header 右上角小图标 | 随时可切换，但与"设置"页入口冲突，语义重复 |
| C. 首次启动引导页选择 | 工作量大，杀鸡用牛刀 |

**推荐 A**，理由：UI pattern 与货币选择完全一致，可复用底部 Sheet 弹窗逻辑，代码量极少。

---

### 9. 附加：CURRENCY_LABELS 国际化问题（需要决策）

`src/types/index.ts:61–75`：`CURRENCY_LABELS` 是硬编码中文（如 `'人民币 CNY'`、`'马来西亚令吉 MYR'`）。

切英文后，设置页的货币选择器仍会显示中文货币名称。

| 选项 | 说明 |
|---|---|
| A. 把 CURRENCY_LABELS 中英文都加到 i18n.ts | 每种货币各两行 key，Settings.tsx 里用 `t(currency + 'Label')` |
| B. **始终显示英文缩写**（推荐） | 不显示"人民币"只显示"CNY · ¥"——简洁，货币用户大多认识英文缩写 |
| C. 保持中文不动 | 语言切换功能不完整 |

**推荐 B**，理由：货币 code（CNY/USD/JPY）本身就是国际标准，无需翻译；改动极小。

---

## 推荐执行顺序

### Phase 1：语言切换（功能 4）先行
**为什么先做**：Auth、Settings、Budget、Charts 都会在后续功能里被改动，如果 i18n 接入滞后，每个新功能都要补两遍（先硬编码、再改 `t()`）。先把 4 个页面接入 `t()`，后续所有改动天然支持双语。

**交付物**：
- Auth、Settings、Budget、Charts 接入 `useLanguage()`
- Settings 页出现语言切换 section，可在中/英文之间切换
- BottomNav、Home、Calendar、AddTransaction 已有，继续工作

**用户验证方式**：Settings → 切换到 English → 所有页面文字变英文；再切回中文 → 刷新后保持。

---

### Phase 2：忘记密码（功能 1）
**依赖**：Phase 1 完成（这样 ResetPassword 页面天然支持双语）

**交付物**：
- 登录页出现"忘记密码？"链接
- 填邮箱 → 收到重置邮件 → 点链接落地 `/reset-password` → 设新密码

**用户验证方式**：真实操作一遍忘记密码流程（用真实邮箱）。

---

### Phase 3：修改密码（功能 2）
**依赖**：Phase 1 完成（Settings 页已接入 i18n）

**交付物**：
- Settings → 账号安全 → 修改密码 → 弹出 Sheet → 输入新密码 → 保存

**用户验证方式**：改密码后退出登录，用新密码重新登录成功。

---

### Phase 4：数据导出（功能 3）
**依赖**：无外部依赖，可独立实现，但建议在 Phase 1 后（Settings 已接入 i18n）

**交付物**：
- Settings → 数据导出 → 配置范围/时间筛选 → 导出 CSV 文件到本地

**用户验证方式**：导出 CSV，用 Excel/Numbers 打开，验证字段正确、金额换算准确。

---

## 风险提示

### 🔴 高风险：migration SQL 与生产 DB 严重漂移

`supabase/migrations/001_initial_schema.sql` 与实际数据库（`database.types.ts` 反映）存在以下差异：

| migration SQL（文件里的） | 实际 DB（database.types.ts 里的） |
|---|---|
| `transactions.category TEXT` | `transactions.category_id UUID`（外键到 categories） |
| `transactions.note TEXT` | `transactions.description TEXT` |
| 无 `exchange_rate` 字段 | `transactions.exchange_rate NUMERIC` |
| 无 `categories` 表 | 有 `categories` 表（user_id, name, type, icon） |
| `budgets.category TEXT` | `budgets.category_id UUID` |
| `budgets` 有 `updated_at` | `budgets` 无 `updated_at` |

**影响**：如果按 migration SQL 重建数据库（新成员接入 / 灾难恢复），应用会完全无法使用。**强烈建议在本次功能开发前，从 Supabase Dashboard 导出当前真实 schema，更新 migration 文件。**

---

### 🟡 中风险：`/reset-password` 落地页的 session 处理

Supabase 密码重置邮件链接会在 URL 附带 `type=recovery` 的 token。`supabase.auth.onAuthStateChange` 在检测到 `SIGNED_IN` + `type=recovery` 事件时需要特殊处理，否则用户可能被直接重定向走（ProtectedRoute 检测到 user 后会跳到 `/`）。

`App.tsx:36–37` 的 `ProtectedRoute` 逻辑 + `AppRoutes` 里"已登录跳 /"的逻辑，需要在 recovery 场景下暂停跳转。

---

### 🟡 中风险：Auth.tsx 和 Settings.tsx 完全没接入 t()

这两个文件目前是 136 个 t() key 里实际使用为零的页面，但 i18n.ts 里已经为它们准备了完整翻译。接入时是机械替换，但文件行数多（Auth.tsx 189 行，Settings.tsx 187 行），需要逐行检查，不能遗漏。

---

### 🟡 中风险：数据导出的 exchange_rate 字段语义

`transactions.exchange_rate` 的含义需要确认：是"1 CNY = ? 目标货币"还是"1 目标货币 = ? CNY"，方向不同则换算逻辑相反。`CurrencyContext.tsx:63–64` 中 `rates[X]` 表示"1 CNY 能换多少 X"，需确认 DB 里存储的 `exchange_rate` 遵循同一约定。

---

### 🟢 低风险：Budget.tsx / Charts.tsx 未接入 i18n，但 key 已完整

两个页面缺 `useLanguage()` 接入，但 `i18n.ts` 里 budget 和 charts 相关的翻译 key 已经全部存在，接入时只需机械替换，TypeScript 会在编译时帮助检查 key 是否存在。

---

### 🟢 低风险：bundle 未做代码分割

597 KB 单包对 PWA 来说偏大，但加入导出功能的纯手写 CSV 代码不会增加任何体积。如果将来有导入功能（需要 xlsx 解析），才需要评估 dynamic import。
