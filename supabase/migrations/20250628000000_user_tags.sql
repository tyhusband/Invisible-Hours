-- User-defined tags and slot tag assignments

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

CREATE POLICY "Users manage own time entry tags"
  ON public.time_entry_tags
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
