# 默认分类 trigger 修复 (2026-04-19)

## 问题

新用户注册后只看到 9 个支出分类 (餐饮 / 交通 / 购物 / 娱乐 / 住房 / 通讯 / 医疗 / 教育 / 其他支出) + 4 个收入分类,共 13 行。老用户主号有 20 个支出分类 (三餐 / 交通 / 住房 / 其它 / 医疗 / 娱乐 / 学习 / 宠物 / 旅行 / 日用品 / 水电煤 / 汽车/加油 / 烟酒 / 电器数码 / 美妆 / 衣服 / 话费网费 / 请客送礼 / 运动 / 零食) + 4 个收入分类,共 24 行。两套名字风格也不一致。

## 根因

`public.create_default_categories()` trigger 某次在 Supabase Dashboard 直接被改成精简版 13 行,未通过 migration 提交,git 无记录。新注册账号走 trigger 灌出的是旧版 13 行,与老用户数据分布脱节。

## 修复

1. **替换 trigger**: 通过 supabase MCP `CREATE OR REPLACE FUNCTION public.create_default_categories()`,恢复为 24 行版本 (20 expense + 4 income),名字与主号对齐。
2. **清理脏数据**: 删除 5 个用旧 trigger 注册的测试账号及其 `categories` / `transactions` / `budgets` 行 (主号 `62ed3c10-d5ad-45e7-ba46-9c6a22b1a5ce` 保留)。
3. **补 sort_order**: `UPDATE public.categories SET sort_order = CASE name ... END WHERE user_id = 主号`,与新 trigger 的顺序一致。
4. **收尾**: 删除今日注册验证用的临时账号。

## 备份

`STEP2_BACKUP.sql` (项目根,已 `.gitignore`) 保存了修复前的 trigger 函数体完整定义,需要回滚时直接在 Supabase SQL Editor 执行即可恢复。

## 后续

Supabase schema 目前无版本控制——trigger 在 Dashboard 被改了没人知道。建议把现有 schema 纳入 `supabase/migrations/`,这次修复后的 `create_default_categories()` 可以作为首个种子 migration:

```
supabase/migrations/<timestamp>_create_default_categories.sql
```

后续任何对 trigger / RLS / function 的修改都走 migration + PR review,避免再次静默漂移。
