# schedule-app — 课程日历

> 给后续 Claude 的 onboarding 文档。读完应能快速判断："修这个 bug 该改哪里" / "这条不是 bug 是设计"。

## 项目身份
大学课程日历 + DDL 提醒 PWA。在线地址：https://calendar.tuchenguang.com

## 项目阶段（重要，扫描时容易误判）

| Phase | 状态 | 实装位置 |
|-------|------|---------|
| Phase 1：手动 CRUD（事件 / 课程 / 周课表 / 学期） | ✅ 完成 | `src/components/shared/EventModal.tsx` 等 |
| Phase 2：AI 辅助导入 | ✅ **已实装**（早于原计划） | `src/lib/fileParsers.ts` + `src/pages/Import.tsx` |
| 　• PDF / DOCX / PPTX 文件解析 | ✅ | mammoth + pdfjs-dist + jszip |
| 　• Moodle 课程页爬虫 | ✅ | `views/import/MoodleImportPanel.tsx` |
| 　• NLP 自然语言解析（Claude API） | ✅ | `views/import/QuickAddPanel.tsx` 走 claude-proxy |
| 　• 余额扣费（卖价 = API 原价 × 2） | ✅ | `src/lib/balance.ts` + `supabase/functions/claude-proxy` |

> 如果 memory 里写"Phase 2 还没做"——已过时，以本文件为准。

## 技术栈
| 层 | 技术 |
|----|------|
| 框架 | React 18 + TypeScript 5 + Vite 5 |
| 样式 | Tailwind CSS 4（@tailwindcss/vite，**不是 v3**） |
| 路由 | react-router-dom 6（lazy + Suspense） |
| 后端 | Supabase（Auth + PostgreSQL + Edge Function） |
| AI | Anthropic Claude API（通过 supabase/functions/claude-proxy 中转） |
| 文件解析 | pdfjs-dist · mammoth · jszip |
| PWA | vite-plugin-pwa（Workbox） |
| 移动打包 | Capacitor 6（Android） |
| 通知 | @capacitor/local-notifications 6 |

## 路由（`src/App.tsx`）

| 路径 | 组件 | 说明 |
|------|------|------|
| `/auth` | Auth | 登录/注册 |
| `/reset-password` | ResetPassword | 邮件重置 |
| `/` | Home | 受 Protected 保护（需要 user + 学期 bootstrap） |
| `/todo` | Timeline | DDL 时间线 |
| `/calendar` | CalendarPage | 月/周/列表三视图 |
| `/timetable` | WeeklySchedule | 周课表 |
| `/weekly` | → `/timetable` | 旧 URL 重定向 |
| `/courses` | Courses | 课程列表 |
| `/courses/:id` | CourseDetail | 课程详情 |
| `/import` | Import | Phase 2 导入面板（文件 / Moodle / NLP） |
| `/academic` | AcademicCalendar | 学期校历 |

**Provider 嵌套**：`BrowserRouter → AuthProvider → Routes`。

## 数据库（7 张表）

| 表 | 用途 |
|----|------|
| `semesters` | 学期定义（start_date / week1_start / exam_start 等） |
| `courses` | 课程 + 主讲人 / 答疑时间 / Moodle 关联 |
| `weekly_schedule` | 周课表条目（day_of_week / start_time / teaching_weeks） |
| `events` | DDL / 考试 / 个人事件（13 种 EventType） |
| `academic_calendar` | 校历公共条目（节假日 / 校事件） |
| `user_balance` | 用户余额（USD，列名仍是历史的 `balance_cny`，见 `balance.ts:5`） |
| `balance_transactions` | 余额流水（充值 / 扣费） |

> **历史包袱**：`user_balance.balance_cny` / `balance_transactions.amount_cny` 列名仍是 CNY，但实际存的是 USD（迁移时只改了语义没改列名）。**不要在代码里做币种转换**——DB 里的数字就是 USD。

无 migration 目录（`supabase/migrations/` 为空），schema 通过 Dashboard 直接维护。`src/lib/types.ts` 是事实上的 schema 定义。

## 通知系统（`src/lib/notifications.ts`）

设计模式：**全量同步**，不是增量。

```
useEvents.load() → syncNotifications(全量 events)
                   ├─ 拿当前 pending 列表
                   ├─ 算目标列表（未来 / 未完成事件）
                   ├─ cancel 不在目标里的
                   └─ schedule 目标列表（同 id 自然覆盖）
```

**重要含义**（扫描时容易误判）：
- 删除 / 更新事件后，调用方触发 `reload` → `useEvents.load` → `syncNotifications` 自动校准。**不需要也不应该在 EventModal 里手动 cancel**。
- notification id = UUID 哈希成 int32（Capacitor 限制）。
- 全天事件提醒：前一天 09:00。带时间事件：提前 advanceMinutes 分钟（15/30/60）。

### 通知点击 deep link
- `setupNotificationClickHandler()` 在 `main.tsx` 启动时注册 `LocalNotifications.addListener('localNotificationActionPerformed')`
- listener 把 `notification.extra.eventId` 写到 `sessionStorage[PENDING_EVENT_KEY]`
- `App.tsx:NotificationDeepLink` 在用户登录后读取并 `navigate('/todo?event=<id>')`，清掉 sessionStorage
- `TimelineView` 用 `useSearchParams` 读 `event` query → 数据加载后 `scrollIntoView` + 加 `.event-highlight` class（CSS @keyframes 闪 2 秒 outline 后淡出）→ 清 query 防重复
- **降级行为**：如果事件被当前 filter 隐藏 / 在按课程模式的折叠组里 → 静默跳过（不强制改用户视图状态）；可改进方向是让 ByCourse 的 CourseGroup 接收 highlightId 自动展开命中组

## 数据缓存策略（`src/lib/dataCache.ts`）

二级兜底：Workbox SW 缓存（HTTP）+ localStorage 快照（React 首屏）。

**有意设计**（扫描时容易误判为债）：
- localStorage 键 **不按 user.id 区分**。理由（`dataCache.ts:11-13`）："同一时刻一台浏览器一个登录用户，切账号时新用户的 fetch 会瞬间覆盖快照，体验上至多是切完账号闪一下旧数据，可接受"。
- 不要给键加 `user.id` 后缀——会损害"重载几乎瞬间出内容"的核心体验。

## 离线 / 同步守护
- `useMutationGuard`（`src/hooks/useMutationGuard.ts`）：离线时禁用所有修改按钮，避免本地写后无法 push 的不一致。
- 不像 ledger-app 那样有 outbox 队列——schedule-app 选择"离线只读"，简化心智。

## 余额系统（Phase 2 配套）

- `API_COST_MULTIPLIER = 2`（`balance.ts:14`）：卖价 = 供应商 API 成本 × 2，覆盖代理服务器 / Supabase / 运营。改这个值要同步改使用条款。
- `LOW_BALANCE_THRESHOLD_USD = 0.1`：低于触发 UI 警告。
- 余额预估必须与 `supabase/functions/claude-proxy/index.ts` 的 `estimateRawCostUsd()` **byte-for-byte 一致**——客户端预览和服务端实际扣费基于同一公式，改一边就要改另一边并重新部署 Edge Function。

## Capacitor Android

- 包名：`com.tuchenguang.schedule`（参考 `android/app/build.gradle`）
- versionName："0.2.0"（手动维护）
- versionCode：分钟级时间戳自动递增
- 签名：读 `key.properties`（gitignore），首次构建需手动创建
- 通知 channel：在 `MainActivity` 通过 Capacitor 自动注册
- 构建命令：`npx cap sync android` → Android Studio 生成 APK

## 视图模式持久化

- `CalendarView` 的 month/week/list 模式存 localStorage（`MODE_STORAGE_KEY`）
- 隐私模式浏览器写入会静默失败，每次回到默认 month——**已知行为，可接受**

## Phase 2 文件导入流程

`Import.tsx` 三个面板共享一个 "Layer 1（识别）→ Layer 2（确认）" 双层数据结构：

1. **Layer 1**：原始解析结果（PDF 文本 / DOCX 段落 / NLP 草稿），允许用户增删改
2. **Layer 2**：转换为 `Event[]` 形态，预览 + 选择性提交到 Supabase

为什么双层：用户经常想保留原始解析（比如 PDF 课表）但只挑几条入库，单层结构覆盖不了"反复编辑后批量提交"。

## 待办

### 短期
（暂无）

### 中期
- [ ] 通知点击 deep link 进一步：按课程模式下命中折叠组时自动展开（当前命中折叠组事件会静默跳过滚动）
- [ ] Phase 2 导入流程的端到端测试（目前只做过手动验证）
- [ ] Moodle 抓取的会话续期（cookie 过期需重登）

## 已知坑位（请勿误判为 bug）

1. **删除事件不直接 cancel 通知**——是**有意设计**。靠 `useEvents.load → syncNotifications` 全量校准。
2. **localStorage 不按 user.id 隔离**——是**有意设计**。见 `dataCache.ts:11-13`。
3. **CalendarView 模式持久化在隐私模式失效**——是**已接受行为**。
4. **`user_balance.balance_cny` 列名是 CNY，存的是 USD**——是**历史迁移残留**，不要做币种转换。
5. **`balance.ts` 的成本公式要和 `claude-proxy/index.ts` 同步**——改一边必须改另一边并重新部署。

## Git 规范
- 中文 commit message
- 每个独立功能单独提交
- TS 严格模式（`tsconfig.app.json` 启用 `strict` + `noUnusedLocals` + `noUnusedParameters`）

## 历史决策

- 选择全量同步通知而非增量：减少 EventModal 等多个调用点的样板代码，单一同步入口（useEvents.load）更不容易漏。
- 选择 Tailwind 4 而非 3：跟随 Vite 生态最新，`@tailwindcss/vite` 配置更简。
- 选择 RLS 单用户读写而非业务逻辑层授权：减少 Edge Function 数量，安全边界放在 PostgreSQL。
