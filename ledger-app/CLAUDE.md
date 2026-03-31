# Ledger App - 口袋记账

## 项目概述
将离线版 finance-app.html 移植为 React+Supabase 的在线记账应用。

## 技术栈
- React + TypeScript + Vite
- Tailwind CSS
- Supabase (Auth + PostgreSQL)
- Chart.js

## 数据库
三张表：categories, transactions, budgets，全部开启 RLS。
新用户注册时触发器自动创建默认分类（餐饮、交通、购物等）。

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
- [ ] 多币种 + 汇率

## 参考
离线版源码：D:\VscodeProject\ClaudeCodeTest\finance-app.html