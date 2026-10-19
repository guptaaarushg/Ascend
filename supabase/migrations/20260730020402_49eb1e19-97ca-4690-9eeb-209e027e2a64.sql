CREATE TABLE public.feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  email TEXT NOT NULL CHECK (char_length(email) BETWEEN 3 AND 200),
  topic TEXT NOT NULL DEFAULT 'general' CHECK (topic IN ('general','bug','feature','partnership','other')),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 5 AND 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.feedback TO anon;
GRANT INSERT, SELECT ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit feedback"
ON public.feedback FOR INSERT TO anon, authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users can read their own feedback"
ON public.feedback FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can read all feedback"
ON public.feedback FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));