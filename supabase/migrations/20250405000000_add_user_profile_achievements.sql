DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND column_name = 'achievements'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD COLUMN achievements jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END;
$$;
