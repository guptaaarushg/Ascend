select cron.unschedule(jobname) from cron.job where jobname in ('ascend-deadline-sweep', 'ascend-digest-daily', 'ascend-digest-weekly');

select cron.schedule(
  'ascend-deadline-sweep',
  '30 8 * * *',
  $$
  select net.http_post(
    url := 'https://YOUR-APP-DOMAIN/api/public/hooks/deadline-sweep',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'YOUR_CRON_SECRET'),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

select cron.schedule(
  'ascend-digest-daily',
  '0 15 * * *',
  $$
  select net.http_post(
    url := 'https://YOUR-APP-DOMAIN/api/public/hooks/deadline-digest',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'YOUR_CRON_SECRET'),
    body := '{"frequency":"daily"}'::jsonb
  ) as request_id;
  $$
);

select cron.schedule(
  'ascend-digest-weekly',
  '0 15 * * 1',
  $$
  select net.http_post(
    url := 'https://YOUR-APP-DOMAIN/api/public/hooks/deadline-digest',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'YOUR_CRON_SECRET'),
    body := '{"frequency":"weekly"}'::jsonb
  ) as request_id;
  $$
);
