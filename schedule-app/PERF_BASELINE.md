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

（每完成一步追加在此）
