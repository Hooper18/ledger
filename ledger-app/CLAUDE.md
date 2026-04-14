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
- [x] 全局滚动修复
- [x] 导航栏遮挡修复
- [x] 记一笔键盘高度压缩
- [x] 首页 header 改为风景图背景（图片：public/images/header-bg.jpg）
- [x] 货币选择器改为完整列表并支持滚动（12种货币）
- [x] PWA图标更新：红底白字"记账"，含192/512/maskable三个PNG
- [x] 货币定义统一：所有币种集中在 types/index.ts，新增MOP澳门元
- [x] 配置 Resend SMTP：smtp.resend.com:465，发件人 onboarding@resend.dev "口袋记账"，邮箱验证中文化
- [x] 修复首页账单列表日期分组标签UTC偏移（今天/昨天标签整体慢一天）
- [x] 修复日历页今日高亮UTC偏移（今天高亮停在昨天）
- [x] 全局日期时区修复：用 localDateStr() 替代 toISOString()，避免UTC+8凌晨记账记到昨天

## UI 修复记录
- 删除首页底部"+ 记一笔"文字按钮（保留底部导航栏红色"+"圆形按钮）
- 记账页面日期快捷按钮改为紧凑一行（py-1 text-xs），货币选择移至同行右侧
- 所有页面头部顶部空白修复：pt-12 → pt-4（viewport 未设 viewport-fit=cover，safe-area-inset-top 为 0，pt-12 全为多余空白）
- 全局滚动修复：html/body/#root 加 height:100%; overflow:hidden；Layout 改用 h-dvh
- 导航栏遮挡修复：BottomNav 从 fixed 改为正常流（shrink-0），Layout main 去掉 pb-16
- 记一笔键盘压缩：py-[10px]→py-[7px]，金额区 py-2.5→py-1.5，容器 pt-3→pt-2，gap-1.5→gap-1（共节省约 50px）
- PWA 状态栏：theme-color 改为 #ffffff，viewport 加 viewport-fit=cover

## 待办（依赖阿里云实名认证通过）
- [ ] 在 Resend 验证域名 pocketledger.top
- [ ] Vercel 绑定 pocketledger.top
- [ ] Supabase SMTP 发件地址改为 noreply@pocketledger.top

## GitHub
Hooper18/ledger（main 分支）

## 如何添加新币种
只需修改 types/index.ts 一个文件，共4处：
1. Currency 类型：补充 | 'XXX'
2. SUPPORTED_CURRENCIES 数组：补充 'XXX'
3. CURRENCY_SYMBOLS：补充 XXX: '符号'
4. CURRENCY_LABELS：补充 XXX: '中文名 XXX'

修改后全局自动生效，无需改动其他文件。

## 参考
离线版源码：D:\VscodeProject\ClaudeCodeTest\finance-app.html
