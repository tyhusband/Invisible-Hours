-- Run this entire file once in Supabase Dashboard → SQL Editor → New query → Run
-- Project: bxrrtxynkeawzjrmcxda

-- =============================================================================
-- 1. Core app tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.time_entries (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  date date NOT NULL,
  slot_key text NOT NULL,
  category_id text NOT NULL,
  note text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date, slot_key)
);

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own time entries" ON public.time_entries;
CREATE POLICY "Users manage own time entries"
  ON public.time_entries
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.user_categories (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  cat_id text NOT NULL,
  label text NOT NULL,
  color text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, cat_id)
);

ALTER TABLE public.user_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own categories" ON public.user_categories;
CREATE POLICY "Users manage own categories"
  ON public.user_categories
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  work_day_start integer,
  work_day_end integer,
  slot_granularity integer,
  data_migrated_15min boolean DEFAULT false
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own settings" ON public.user_settings;
CREATE POLICY "Users manage own settings"
  ON public.user_settings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- 1b. Tags
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_tags (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  tag_id text NOT NULL,
  label text NOT NULL CHECK (char_length(label) <= 15),
  color text NOT NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, tag_id)
);

ALTER TABLE public.user_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own tags" ON public.user_tags;
CREATE POLICY "Users manage own tags"
  ON public.user_tags
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.time_entry_tags (
  user_id uuid NOT NULL,
  date date NOT NULL,
  slot_key text NOT NULL,
  tag_id text NOT NULL,
  PRIMARY KEY (user_id, date, slot_key, tag_id),
  FOREIGN KEY (user_id, date, slot_key)
    REFERENCES public.time_entries (user_id, date, slot_key) ON DELETE CASCADE,
  FOREIGN KEY (user_id, tag_id)
    REFERENCES public.user_tags (user_id, tag_id) ON DELETE CASCADE
);

ALTER TABLE public.time_entry_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own time entry tags" ON public.time_entry_tags;
CREATE POLICY "Users manage own time entry tags"
  ON public.time_entry_tags
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- 2. Google Calendar tokens (optional feature; safe to create now)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.google_calendar_tokens (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own tokens" ON public.google_calendar_tokens;
CREATE POLICY "Users can read own tokens"
  ON public.google_calendar_tokens FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own tokens" ON public.google_calendar_tokens;
CREATE POLICY "Users can insert own tokens"
  ON public.google_calendar_tokens FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own tokens" ON public.google_calendar_tokens;
CREATE POLICY "Users can update own tokens"
  ON public.google_calendar_tokens FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own tokens" ON public.google_calendar_tokens;
CREATE POLICY "Users can delete own tokens"
  ON public.google_calendar_tokens FOR DELETE
  USING (user_id = auth.uid());

-- =============================================================================
-- 3. Profiles + admin flag
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
      NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
      ''
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.profiles (id, full_name)
SELECT
  u.id,
  COALESCE(
    NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''),
    NULLIF(trim(u.raw_user_meta_data->>'name'), ''),
    ''
  )
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 4. Grant admin to ty.husband@gmail.com
-- =============================================================================

UPDATE public.profiles
SET is_admin = true
WHERE id = (
  SELECT id FROM auth.users
  WHERE email = 'ty.husband@gmail.com'
);

-- Verify (should return one row with is_admin = true)
SELECT u.email, p.is_admin
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
WHERE u.email = 'ty.husband@gmail.com';
