CREATE TABLE public.community_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
CREATE INDEX community_likes_post_idx ON public.community_likes(post_id);
GRANT SELECT, INSERT, DELETE ON public.community_likes TO authenticated;
GRANT ALL ON public.community_likes TO service_role;
ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes: any auth can read" ON public.community_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "likes: insert own" ON public.community_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "likes: delete own" ON public.community_likes FOR DELETE TO authenticated USING (user_id = auth.uid());