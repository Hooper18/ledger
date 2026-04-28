# 加载性能优化 - 基线与对比

## Phase 0：基线（优化前）

构建命令：`npm run build`

### 构建产物体积

| 文件 | 体积 | gzip |
|---|---|---|
| dist/assets/index-BdyybK_B.js | **629.22 KB** | **191.29 KB** |
| dist/assets/index-RdDuRg1Q.css | 24.04 KB | 5.26 KB |
| dist/index.html | 1.13 KB | 0.56 KB |
| dist/manifest.webmanifest | 0.44 KB | - |
| dist/registerSW.js | 0.13 KB | - |
| **dist/ 总大小** | **1.6 MB** | - |

PWA precache：18 entries (669.52 KiB)

### Bundle 分析（rollup-plugin-visualizer，按 rendered size）

| 排名 | 模块 | 体积 |
|---|---|---|
| 1 | chart.js | **374.7 KB** |
| 2 | @supabase/auth-js | 340.2 KB |
| 3 | src/pages（所有页面合并） | 135.2 KB |
| 4 | react-dom | 130.8 KB |
| 5 | @supabase/postgrest-js | 117.7 KB |
| 6 | @supabase/storage-js | 92.6 KB |
| 7 | @supabase/realtime-js | 80.5 KB |
| 8 | @supabase/phoenix | 52.6 KB |
| 9 | @remix-run/router | 29.0 KB |
| 10 | @supabase/supabase-js | 23.0 KB |
| 11 | react-router | 20.0 KB |
| 12 | iceberg-js | 15.5 KB |
| 13 | @supabase/functions-js | 14.8 KB |
| 14 | src/lib | 13.3 KB |
| 15 | @kurkle/color | 12.0 KB |
| 16 | src/components | 11.7 KB |
| 17 | lucide-react | 10.6 KB |
| 18 | react-router-dom | 9.7 KB |
| 19 | react | 8.7 KB |
| 20 | src/contexts | 6.1 KB |

### 静态资源

| 文件 | 体积 |
|---|---|
| public/images/header-bg.jpg | **917 KB** ⚠️ 极大 |
| public/icons/pwa-192.png | 4 KB |
| public/icons/pwa-512.png | 11 KB |
| public/icons/pwa-maskable.png | 11 KB |

### 关键发现

1. **chart.js 已用按需注册（非 /auto）**，但仍占 374 KB。被打入主 bundle，导致首屏需要下载图表代码。
2. **recharts 在 package.json 中声明但项目源码未使用**，可移除。
3. **header-bg.jpg 高达 917 KB**（实际是 PNG 误用 .jpg 后缀），是首屏的主要拖累。
4. **所有页面都打入主 bundle**（无路由懒加载），合计 135 KB src 代码。
5. **Supabase 占据约 720 KB**，其中 storage-js / realtime-js / phoenix 在本项目中可能未使用。
6. 主 bundle 629 KB（gzipped 191 KB）超过 500 KB 阈值，Vite 警告。

---

## Phase 8：优化后

### 构建产物体积（按首屏关键 → 懒加载）

| 文件 | 体积 | gzip | 用途 |
|---|---|---|---|
| dist/assets/index-CFfiMe4D.js | 52.64 KB | 16.98 KB | 主入口（App + Home + 上下文） |
| dist/assets/vendor-react-*.js | 163.80 KB | 53.46 KB | React + Router |
| dist/assets/vendor-supabase-*.js | 191.32 KB | 50.70 KB | Supabase Client |
| dist/assets/index-*.css | 24.01 KB | 5.25 KB | Tailwind CSS |
| —— 首屏总计 —— | **431.77 KB** | **126.39 KB** | |
| dist/assets/vendor-charts-*.js | 164.22 KB | 57.38 KB | chart.js（仅 /charts 加载） |
| dist/assets/Charts-*.js | 8.19 KB | 3.04 KB | 图表页 |
| dist/assets/Settings-*.js | 15.78 KB | 4.21 KB | 设置页 |
| dist/assets/Budget-*.js | 10.56 KB | 3.47 KB | 预算页 |
| dist/assets/AddTransaction-*.js | 8.05 KB | 2.76 KB | 记账页 |
| dist/assets/Calendar-*.js | 6.92 KB | 2.42 KB | 日历页 |
| dist/assets/About-*.js | 4.92 KB | 2.81 KB | 关于页 |
| dist/assets/ResetPassword-*.js | 2.84 KB | 1.17 KB | 重置密码页 |
| **dist/ 总大小** | **785 KB** | - | |

### 静态资源

| 文件 | 体积 | 变化 |
|---|---|---|
| public/images/header-bg.jpg | **47.5 KB** | 917 KB → 47.5 KB（-95%）|

### 优化前后对比

| 指标 | 优化前 | 优化后 | 节省 |
|---|---|---|---|
| 首屏 JS（gzip） | 191.29 KB | 126.39 KB | **-34%** |
| 首屏总传输（含 CSS+图） | ~1.1 MB | ~175 KB | **-84%** |
| dist 总大小 | 1.6 MB | 785 KB | **-51%** |
| Charts 页（gzip） | 内联 | 60.42 KB | 仅按需加载 |
| 主 bundle（未压缩） | 629 KB | 52.64 KB | **-92%** |

### 各项优化贡献

| 优化项 | 主要收益 |
|---|---|
| Phase 1 路由懒加载 | 主 bundle 629→411 KB；图表/设置/预算等页按需加载 |
| Phase 2 Chart.js tree-shaking | 已是按需注册，无变化（确认无 chart.js/auto） |
| Phase 3 移除 recharts 依赖 | 源码未使用，已 tree-shake，主要减少 npm install 体积 |
| Phase 5 压缩 header-bg.jpg | dist 体积 1.6MB→773KB（-870KB），首屏体感最大提升 |
| Phase 6 manualChunks | 拆分 vendor-react / vendor-supabase / vendor-charts；二次访问 vendor 命中缓存 |
| Phase 7 PWA 缓存策略 | auth NetworkOnly、rest NetworkFirst+24h、图片/字体 CacheFirst |

### 后续建议（未在本次执行）

1. **Supabase v2 仍打包 storage-js / realtime-js / functions-js（共 ~190 KB）**，本项目均未使用。可考虑：
   - 改用 `@supabase/postgrest-js` + `@supabase/auth-js` 直接组合；或
   - 等待 Supabase 提供更细粒度的子模块导出。
2. **Chart.js 体积可观（gzip 57 KB）**，若仅需柱图/饼图，可评估替换为 ECharts（5KB 内核）或 lightweight-charts、或直接用 CSS+SVG 手写。
3. **图片可进一步加 WebP 版本**，用 `<picture>` 标签 fallback，可再省 ~30%（当前 JPEG 47 KB → WebP 32 KB）。
4. **Brotli 压缩**：Vercel 默认开启，传输体积比 gzip 再省约 15-20%。

---

## 验证清单

构建完成后已手动验证以下场景（开发模式 + 构建产物）：

- [x] `npm run build` 成功，无 TypeScript / Rollup 错误
- [x] 所有路由懒加载 chunk 正确生成
- [x] vendor chunks 正确分离
- [x] PWA precache 正常生成（29 entries / 670 KiB）
- [x] header-bg.jpg 压缩后视觉效果与原图一致（仅缩放 + JPEG 化）

