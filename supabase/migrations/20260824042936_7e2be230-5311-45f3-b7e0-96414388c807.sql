CREATE TABLE public.system_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL,
  duration_ms integer,
  ok boolean NOT NULL DEFAULT true,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.system_events TO authenticated;
GRANT ALL ON public.system_events TO service_role;

ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read system events"
  ON public.system_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX system_events_created_at_idx ON public.system_events (created_at DESC);
CREATE INDEX system_events_event_idx ON public.system_events (event, created_at DESC);