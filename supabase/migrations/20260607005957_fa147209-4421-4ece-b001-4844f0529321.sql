
CREATE TABLE public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('summer_programs','chance_me','college_advice','life_advice')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  author_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX community_posts_category_created_idx ON public.community_posts (category, created_at DESC);

CREATE TABLE public.community_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 3000),
  author_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX community_replies_post_created_idx ON public.community_replies (post_id, created_at ASC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_replies TO authenticated;
GRANT ALL ON public.community_posts TO service_role;
GRANT ALL ON public.community_replies TO service_role;

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "posts: any auth can read" ON public.community_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "posts: insert own"        ON public.community_posts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "posts: update own"        ON public.community_posts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "posts: delete own"        ON public.community_posts FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "replies: any auth can read" ON public.community_replies FOR SELECT TO authenticated USING (true);
CREATE POLICY "replies: insert own"        ON public.community_replies FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "replies: update own"        ON public.community_replies FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "replies: delete own"        ON public.community_replies FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER touch_community_posts BEFORE UPDATE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
