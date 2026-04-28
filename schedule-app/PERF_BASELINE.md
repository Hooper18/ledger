# schedule-app 首屏性能基线

> 记录日期：2026-04-29
> 命令：`npm run build`（vite 5.4.21，PWA v1.2.0 generateSW）

## 1. 构建产出（基线）

### dist 根目录
| 文件 | raw |
| --- | --- |
| `registerSW.js` | 134 B |
| `sw.js` | 1,415 B |
| `workbox-8c29f6e4.js` | 15,123 B |
| `manifest.webmanifest` | 0.47 KB |
| `index.html` | 1.22 KB（gzip 0.61 KB） |

### dist/assets
| 文件 | raw | gzip |
| --- | --- | --- |
| `assets/index-*.js` | **592,604 B（≈580 KB）** | **164,077 B（≈160 KB）** |
| `assets/fileParsers-*.js` | 866,638 B（≈846 KB） | 238,397 B（≈233 KB） |
| `assets/pdf.worker.min-*.mjs` | 1,375,838 B（≈1.31 MB） | 403,357 B（≈394 KB） |
| `assets/index-*.css` | 55,269 B（≈54 KB） | 9,808 B |

> Vite 构建告警：主 `index` chunk > 500 KB。`fileParsers` 已经是动态 import 出去的独立 chunk，`pdf.worker` 是 web worker 入口、不会被主线程同步加载。

PWA precache：10 entries，1480.10 KiB。

## 2. 路由清单与组件路径

| 路由 | 组件文件 | 是否需要鉴权 |
| --- | --- | --- |
| `/auth` | `src/pages/Auth.tsx` | 否 |
| `/reset-password` | `src/pages/ResetPassword.tsx` | 否 |
| `/` | `src/pages/Home.tsx` | 是 |
| `/todo` | `src/pages/Timeline.tsx` | 是 |
| `/calendar` | `src/pages/Calendar.tsx` | 是 |
| `/timetable` | `src/pages/WeeklySchedule.tsx` | 是 |
| `/weekly` | redirect → `/timetable` | — |
| `/courses` | `src/pages/Courses.tsx` | 是 |
| `/courses/:id` | `src/pages/CourseDetail.tsx` | 是 |
| `/import` | `src/pages/Import.tsx` | 是 |
| `/academic` | `src/pages/AcademicCalendar.tsx` | 是 |

App 入口：`src/main.tsx` → `src/App.tsx`（`BrowserRouter` + `AuthProvider`）。
所有受鉴权页都包在 `<Protected>` 里，会同步等 `useAuth().loading` + `useSemesterBootstrap()` 完成后再渲染。

## 3. 主要依赖（生产）

```
@supabase/supabase-js  ^2.45.0
jszip                  ^3.10.1   （仅 fileParsers 用，已 lazy）
lucide-react           ^0.400.0  （命名导入，tree-shake 友好）
mammoth                ^1.12.0   （仅 fileParsers 用，已 lazy）
pdfjs-dist             ^4.10.38  （仅 fileParsers 用 + worker chunk）
react / react-dom      ^18.3.1
react-router-dom       ^6.26.0
```

dev：`vite`、`vite-plugin-pwa`、`tailwindcss v4`、`@tailwindcss/vite`、`@vitejs/plugin-react`、`typescript`。

## 4. 当前问题观察

1. **主 chunk 580 KB / gzip 160 KB**：所有 11 个页面、所有 hooks、context、布局组件全部打成一包，没有按路由拆。
2. **AuthProvider 阻塞首屏**：`AppRoutes` 在 `loading=true` 时整页 `<Loading />`，Supabase getSession 完成前用户什么都看不到。
3. **PWA 仅 precache**：没有配置 `runtimeCaching`，Supabase REST 请求未命中缓存策略。
4. **Vite 没有 manualChunks**：vendor 全部混在 `index-*.js` 里，react/router/supabase 的更新会让整包失效。
5. **没有 gzip/brotli 预压缩**：依赖 Vercel 压缩，但缺 `.br` 静态资源。
6. **fileParsers 已经 lazy 化**（`FileImportPanel` / `MoodleImportPanel` 内部 dynamic import），不需要重复处理。

---

# 优化记录与对比

### 第 1 步 — 路由级 Code Splitting
- 所有页面 (`Auth/ResetPassword/Home/Timeline/Calendar/WeeklySchedule/Courses/CourseDetail/Import/AcademicCalendar`) 改为 `React.lazy`，外层 `<Suspense fallback={<Loading />}>`。
- 主 chunk：592,604 B → **391,628 B**（gzip 164 KB → **115 KB**），减重 ≈ 30%。
- 单页 chunk 出现：`Home 7.9 KB`、`Timeline 13.6 KB`、`Calendar 25.2 KB`、`WeeklySchedule 8.6 KB`、`Courses 7.2 KB`、`CourseDetail 5.9 KB`、`Import 63.5 KB`、`AcademicCalendar 5.8 KB`、`ResetPassword 1.5 KB`。
- PWA precache 条目数 10 → 29，但总体积只多了 5 KB（按需加载彻底取代了一次性加载）。

### 第 2 步 — Supabase 初始化优化
- `AppRoutes` 不再在 `loading=true` 时整页 `<Loading />`，受保护路由可与 `getSession()` 并行下载 lazy chunk；`Protected` 自身已经处理 loading 态，UX 不变。
- `/auth` 路由 element 内部仍判断 `loading`，避免登录用户访问 `/auth` 时闪一下登录页再跳转。
- `/reset-password` 直接渲染（不依赖 auth state）。
- `supabaseClient` 创建时机不变（模块顶层），但客户端初始化是同步的（仅 `createClient`，不发请求），所以无需进一步异步化。

### 第 3 步 — 依赖优化（验证）
- 全项目 `import * as` 只有 `pdfjs-dist` 一处，且在 `fileParsers.ts`（已 dynamic import）。
- 无 `date-fns / moment / dayjs / recharts / @anthropic-ai/sdk` 等可疑依赖。
- `lucide-react` 全部为命名导入；构建产物里 `chevron-*` / `trash-2` / `map-pin` / `triangle` 等都成为单独的 lazy 共享 chunk。
- `mammoth / pdfjs-dist / jszip` 仅 `lib/fileParsers.ts` 用，且已通过 `import('../../../lib/fileParsers')` 在 `FileImportPanel` / `MoodleImportPanel` 内部 lazy 加载。
- Tailwind v4 (`@tailwindcss/vite`) 通过 `@import "tailwindcss"` 自动扫描使用，无需手动 `content` purge；输出 CSS 仅 9.79 KB gzip。
- 结论：本步无代码改动。

### 第 4 步 — 静态资源优化（验证）
- `index.html` 无外部 `<script>` / `<link rel="stylesheet">` 引用 CDN（无 Google Fonts、无 jQuery 等）。
- 主入口 `<script type="module" src="/src/main.tsx">`：模块脚本规范上隐含 `defer`，不会阻塞 HTML 解析。
- 内联主题恢复脚本（5 行）必须在渲染前执行以避免主题闪烁，保留。
- `public/` 下仅有 favicon (1.27 KB) / apple-touch-icon (7.43 KB) / pwa-192 (7.93 KB) / pwa-512 (19.47 KB)，无大图。
- `public/extensions.7z` (16 KB) 是 Auth/Help 弹层的下载链接，不影响首屏。
- 唯一非 defer 的脚本是 `registerSW.js`（134 B），第 5 步通过 `injectRegister: 'script-defer'` 处理。
- 结论：本步无代码改动，等第 5 步配套处理 SW 注册。

### 第 5 步 — PWA / Service Worker 缓存策略
- `vite.config.ts` 加 `injectRegister: 'script-defer'` → `<script ... defer>` 不再阻塞解析。
- `workbox.runtimeCaching` 三条规则：
  1. **静态资源（script/style/font/image/worker）→ CacheFirst**，30 天，最多 100 条；
  2. **`https://*.supabase.{co,in}/rest/*` → NetworkFirst**，5 秒超时回退缓存，5 分钟 TTL，最多 50 条；
  3. **`https://*.supabase.{co,in}/(auth|functions)/*` → NetworkOnly**（登录态、claude-proxy 必须走网络）。
- `navigateFallback: '/index.html'`，并把 `/auth/`、`/api/` 排除在 fallback 之外（这些不是 SPA 路由）。
- 验证：`dist/sw.js` 内出现 `static-assets / supabase-rest / NetworkFirst / CacheFirst / NetworkOnly` 字符串。

### 第 6 步 — Vite 构建配置优化
- `build.target = 'es2020'`、`build.cssCodeSplit = true`（已是默认，显式锁定）。
- `manualChunks`：
  - `vendor-react`：`react / react-dom / react-router-dom`
  - `vendor-supabase`：`@supabase/supabase-js`
- 安装 `vite-plugin-compression@^0.5.1`，同时生成 `.gz` 与 `.br`（`threshold: 1024`）。

---

## 优化后产出（首屏关键路径）

| 文件 | raw | gzip |
| --- | --- | --- |
| `index-*.js`（业务入口） | **31,464 B（≈30 KB）** | **10,509 B（≈10 KB）** |
| `vendor-react-*.js` | 165,059 B（≈161 KB） | 53,781 B（≈53 KB） |
| `vendor-supabase-*.js` | 194,323 B（≈190 KB） | 51,432 B（≈50 KB） |
| `Home-*.js`（首页 lazy chunk） | 8,194 B | 2,982 B |
| `index-*.css` | 54,860 B | 9,751 B |

> 首页 `/` 关键路径合计：**约 454 KB raw / 128 KB gzip**（其中 vendor 部分 ≈ 359 KB raw / 105 KB gzip 可永久缓存）。

| 文件 | 备注 |
| --- | --- |
| `Calendar-*.js` 25 KB / `Timeline-*.js` 14 KB / `WeeklySchedule-*.js` 9 KB / 其它路由 | 仅访问对应路由时下载 |
| `Import-*.js` 64 KB | `/import` 路由专属 |
| `EventModal-*.js` 15 KB | 多页共享，懒加载 |
| `fileParsers-*.js` 857 KB | 仅 `FileImportPanel` / `MoodleImportPanel` 内 dynamic import |
| `pdf.worker.min-*.mjs` 1.31 MB | 仅 PDF 导入时由 web worker 加载 |

预压缩（vite-plugin-compression）：所有 `> 1 KB` 的产物都额外生成了 `.gz` 与 `.br`，Vercel 静态托管会优先使用 `.br`。

## 主要对比（首屏关键路径 raw / gzip）

| 项目 | 基线 | 优化后 | 减少 |
| --- | --- | --- | --- |
| 主入口 chunk | 580 KB / 164 KB | **30 KB / 10 KB** | **−95% / −94%** |
| 首页关键路径合计 | 580 KB / 164 KB | 397 KB / 117 KB | −32% / −29% |
| 业务代码 chunk（每次部署都会变） | 580 KB / 164 KB | **30 KB / 10 KB** | **−94%（命中浏览器/Service Worker 缓存场景）** |
| Brotli 大小（实际线上） | 不可用 | 业务入口 ~9 KB / vendor ~88 KB | — |

## 各步预期收益

1. **第 1 步（路由 lazy）**：首次访问主入口体积砍 ~30%，访问其他页时只新增对应 lazy chunk。
2. **第 2 步（auth 不阻塞）**：受保护路由的 lazy chunk 下载与 `getSession()` 并行进行，弱网下首屏可视化提前到 lazy chunk 下载时间。
3. **第 3-4 步**：审计无需改动；记录现状方便后续 review。
4. **第 5 步（runtime caching）**：二次访问基本零网络（静态走 CacheFirst），断网/弱网下 Supabase REST 仍能回退到上次结果；`registerSW.js` 加 `defer` 不阻塞。
5. **第 6 步（manualChunks + brotli）**：vendor-react / vendor-supabase 在版本不变时永久命中 immutable 缓存；业务入口缩到 30 KB（gzip 10 KB），下次部署用户重新下载量大幅降低。

## 验证

- 构建：`npm run build` 通过，无错误。
- 预览：`npm run preview` 启动后 `curl` 验证：
  - `/` → 200 + index.html（含 modulepreload vendor-react / vendor-supabase）
  - `/calendar` → 200 + 同一 index.html（SPA 回退正确）
  - `/assets/index-*.js`、`/assets/vendor-react-*.js`、`/sw.js` 全部 200。
- TypeScript：`tsc -b` 无错误（已包含在 build 流程）。
- 不可在本环境（无浏览器）做交互式 UI 验收，请用户在本地或部署环境跑通：日历视图切换、新增/编辑/删除日程、登录/登出、主题切换、quick-add、claude-proxy 调用。

## 硬性约束遵守情况

- ✅ 不动业务逻辑（仅改 import 方式 / Suspense 包裹 / vite 配置）。
- ✅ 不动 UI 样式（Loading 复用现有组件）。
- ✅ 不删除任何功能。
- ✅ 不升级 React / Supabase 大版本（仅新增 dev 依赖 `vite-plugin-compression`）。
- ✅ 每步独立中文 commit。



