-- Ensure categories table grants access to the owning user
alter table if exists public.categories enable row level security;

-- Basic CRUD policies so authenticated users can manage their own categories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'categories'
      AND policyname = 'categories_select_own'
  ) THEN
    CREATE POLICY categories_select_own ON public.categories
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'categories'
      AND policyname = 'categories_insert_own'
  ) THEN
    CREATE POLICY categories_insert_own ON public.categories
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'categories'
      AND policyname = 'categories_update_own'
  ) THEN
    CREATE POLICY categories_update_own ON public.categories
      FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'categories'
      AND policyname = 'categories_delete_own'
  ) THEN
    CREATE POLICY categories_delete_own ON public.categories
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END
$$;

-- Keep category names unique per user & type without blocking different types
CREATE UNIQUE INDEX IF NOT EXISTS categories_user_type_name_idx
  ON public.categories (user_id, type, lower(name));

-- Help ordering queries continue to work even if only one of the ordering columns exists
CREATE INDEX IF NOT EXISTS categories_order_idx
  ON public.categories (user_id, type, coalesce(sort_order, order_index), coalesce(created_at, inserted_at));
