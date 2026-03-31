-- ============================================================
-- 口袋记账 – Initial Schema Migration
-- Run this in your Supabase project:
--   Dashboard → SQL Editor → paste & run
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- User preferences (1-to-1 with auth.users)
CREATE TABLE public.users_profile (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_currency TEXT NOT NULL DEFAULT 'CNY',   -- display currency (汇率转换目标)
  default_currency   TEXT NOT NULL DEFAULT 'CNY',   -- pre-selected currency when adding a transaction
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.users_profile IS '用户偏好设置（与 auth.users 1:1）';
COMMENT ON COLUMN public.users_profile.preferred_currency IS '偏好货币：所有金额转换展示的目标货币';
COMMENT ON COLUMN public.users_profile.default_currency   IS '默认货币：新建记账时预选的货币';

-- Transactions (支出 / 收入 / 转账)
CREATE TABLE public.transactions (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL CHECK (type IN ('expense', 'income', 'transfer')),
  amount     NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  currency   TEXT        NOT NULL DEFAULT 'CNY',
  category   TEXT        NOT NULL,
  note       TEXT,
  date       DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.transactions IS '记账记录';
COMMENT ON COLUMN public.transactions.type     IS 'expense=支出, income=收入, transfer=转账';
COMMENT ON COLUMN public.transactions.currency IS '记账时使用的货币（原始）';

-- Indexes for common query patterns
CREATE INDEX idx_transactions_user_date ON public.transactions (user_id, date DESC);
CREATE INDEX idx_transactions_user_type ON public.transactions (user_id, type);

-- Budgets (总预算 + 分类预算)
CREATE TABLE public.budgets (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category   TEXT,                                  -- NULL = total budget
  amount     NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  currency   TEXT        NOT NULL DEFAULT 'CNY',
  period     TEXT        NOT NULL DEFAULT 'monthly' CHECK (period IN ('monthly', 'yearly')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, category, period)               -- one budget per category/period per user
);

COMMENT ON TABLE  public.budgets IS '预算设置';
COMMENT ON COLUMN public.budgets.category IS 'NULL 表示总预算，非 NULL 表示具体分类预算';

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.users_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets        ENABLE ROW LEVEL SECURITY;

-- users_profile: only own row
CREATE POLICY "users_profile: select own"
  ON public.users_profile FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users_profile: insert own"
  ON public.users_profile FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_profile: update own"
  ON public.users_profile FOR UPDATE
  USING (auth.uid() = id);

-- transactions: full CRUD on own rows
CREATE POLICY "transactions: select own"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "transactions: insert own"
  ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "transactions: update own"
  ON public.transactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "transactions: delete own"
  ON public.transactions FOR DELETE
  USING (auth.uid() = user_id);

-- budgets: full CRUD on own rows
CREATE POLICY "budgets: select own"
  ON public.budgets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "budgets: insert own"
  ON public.budgets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "budgets: update own"
  ON public.budgets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "budgets: delete own"
  ON public.budgets FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- HELPER FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users_profile (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Generic updated_at trigger
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

CREATE TRIGGER trg_budgets_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
