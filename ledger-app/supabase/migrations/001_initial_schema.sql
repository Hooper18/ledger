-- ============================================================
-- 口袋记账 — Schema Snapshot Migration
-- ============================================================
-- 这是一份**快照式 migration**：以代码当前期望的 schema 为基准重建。
-- 用途：在新环境（本地 / staging / fork）从零搭建 schema。
-- 不再增量演进——后续 schema 变更直接修改本文件即可。
--
-- 字段集来自 src/lib/database.types.ts（手写，与生产 DB 已对齐）。
-- 约束 / 索引 / 触发器属于合理推断，与生产可能有细微差异（如 ON DELETE 行为、
-- 索引集合）；如发现不符以生产为准回写本文件。
--
-- 运行方式：Supabase Dashboard → SQL Editor → 粘贴执行。
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- users_profile: 1:1 与 auth.users
CREATE TABLE public.users_profile (
  id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_currency TEXT NOT NULL DEFAULT 'CNY',
  default_currency   TEXT NOT NULL DEFAULT 'CNY',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.users_profile IS '用户偏好（与 auth.users 1:1）';
COMMENT ON COLUMN public.users_profile.preferred_currency IS '展示币种：所有金额转换的目标';
COMMENT ON COLUMN public.users_profile.default_currency   IS '默认币种：新建记账时预选';

-- categories: 用户级分类（不预填，前端 buildFallback() 兜底默认列表）
CREATE TABLE public.categories (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  type       TEXT        NOT NULL CHECK (type IN ('expense', 'income', 'transfer')),
  icon       TEXT        NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.categories IS '用户自定义分类（无 updated_at，分类一般不修改只增删）';

CREATE INDEX idx_categories_user_type ON public.categories (user_id, type);

-- transactions: 流水（支出 / 收入 / 转账）
CREATE TABLE public.transactions (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          TEXT          NOT NULL CHECK (type IN ('expense', 'income', 'transfer')),
  amount        NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  currency      TEXT          NOT NULL DEFAULT 'CNY',
  category_id   UUID          NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  description   TEXT,
  date          DATE          NOT NULL DEFAULT CURRENT_DATE,
  exchange_rate NUMERIC(20,8),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.transactions IS '流水记录';
COMMENT ON COLUMN public.transactions.type          IS 'expense=支出, income=收入, transfer=转账';
COMMENT ON COLUMN public.transactions.currency      IS '记账时输入币种（原始）';
COMMENT ON COLUMN public.transactions.exchange_rate IS '记账时刻的 currency→baseCurrency 比率快照（NULL 表示同币种或无快照）';

CREATE INDEX idx_transactions_user_date ON public.transactions (user_id, date DESC);
CREATE INDEX idx_transactions_user_type ON public.transactions (user_id, type);

-- budgets: 总预算 + 分类预算
CREATE TABLE public.budgets (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID          REFERENCES public.categories(id) ON DELETE CASCADE, -- NULL = 总预算
  amount      NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  currency    TEXT          NOT NULL DEFAULT 'CNY',
  period      TEXT          NOT NULL DEFAULT 'monthly' CHECK (period IN ('monthly', 'yearly')),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.budgets IS '预算（无 updated_at，更新走 upsert 覆盖）';
COMMENT ON COLUMN public.budgets.category_id IS 'NULL=总预算，非 NULL=分类预算';
COMMENT ON COLUMN public.budgets.period      IS '当前代码只用 monthly，yearly 为预留';

-- 唯一约束：(user_id, period, category_id)，且 NULL 也不能重复（NULLS NOT DISTINCT 是 PG 15+ 特性）
-- onConflict 配合：'user_id,period,category_id'（见 src/hooks/useBudgets.ts）
CREATE UNIQUE INDEX budgets_user_period_category_unique
  ON public.budgets (user_id, period, category_id)
  NULLS NOT DISTINCT;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.users_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets       ENABLE ROW LEVEL SECURITY;

-- users_profile
CREATE POLICY "users_profile: select own" ON public.users_profile FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_profile: insert own" ON public.users_profile FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users_profile: update own" ON public.users_profile FOR UPDATE USING (auth.uid() = id);

-- categories
CREATE POLICY "categories: select own" ON public.categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "categories: insert own" ON public.categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categories: update own" ON public.categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "categories: delete own" ON public.categories FOR DELETE USING (auth.uid() = user_id);

-- transactions
CREATE POLICY "transactions: select own" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "transactions: insert own" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "transactions: update own" ON public.transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "transactions: delete own" ON public.transactions FOR DELETE USING (auth.uid() = user_id);

-- budgets
CREATE POLICY "budgets: select own" ON public.budgets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "budgets: insert own" ON public.budgets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "budgets: update own" ON public.budgets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "budgets: delete own" ON public.budgets FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- 新用户注册：仅创建 users_profile 行（不创建任何分类，分类由前端 buildFallback() 兜底）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users_profile (id) VALUES (NEW.id) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at 触发器（仅 users_profile / transactions 有此列）
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_profile_updated_at
  BEFORE UPDATE ON public.users_profile
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
