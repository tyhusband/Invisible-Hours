-- Core app tables: calendar slots, categories, user preferences

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

CREATE POLICY "Users manage own settings"
  ON public.user_settings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
