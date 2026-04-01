# Ledger App - 口袋记账

## 项目概述
将离线版 finance-app.html 移植为 React+Supabase 的在线记账应用。

## 技术栈
- React + TypeScript + Vite
- Tailwind CSS
- Supabase (Auth + PostgreSQL)
- Chart.js
- vite-plugin-pwa (Workbox)

## 数据库
三张表：categories, transactions, budgets，全部开启 RLS。
新用户注册时触发器自动创建默认分类（餐饮、交通、购物等）。

### budgets 表注意事项
- `period` 字段只能是 `'monthly'` 或 `'yearly'`（check constraint）
- `category_id = null` 表示月度总预算
- upsert onConflict: `'user_id,period,category_id'`
- NULL 值不触发 unique constraint，需在 Supabase 执行：
  ```sql
  CREATE UNIQUE INDEX budgets_user_period_category_unique
  ON budgets(user_id, period, category_id) NULLS NOT DISTINCT;
  ```

## 当前进度
- [x] 项目骨架搭建
- [x] Supabase 连接配置
- [x] 数据库建表 + RLS
- [x] 用户注册/登录
- [x] 首页展示
- [x] 记一笔页面（AddTransaction）
- [x] 日历视图
- [x] 统计图表
- [x] 预算管理
- [x] 多币种 + 汇率
- [x] PWA 配置（vite-plugin-pwa，manifest，Service Worker，离线缓存）
- [x] 部署到 Vercel：https://ledger-tusts.vercel.app

## UI 修复记录
- 删除首页底部"+ 记一笔"文字按钮（保留底部导航栏红色"+"圆形按钮）
- 记账页面日期快捷按钮改为紧凑一行（py-1 text-xs），货币选择移至同行右侧
- 所有页面头部顶部空白修复：pt-12 → pt-4（viewport 未设 viewport-fit=cover，safe-area-inset-top 为 0，pt-12 全为多余空白）

## GitHub
Hooper18/ledger（main 分支）

## 参考
离线版源码：D:\VscodeProject\ClaudeCodeTest\finance-app.html
