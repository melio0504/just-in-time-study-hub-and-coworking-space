-- Development-only sample content. Facility seats are reference data and are
-- inserted by the migration so they exist in both local and production.
insert into public.hub_content (slug, title, body, status, published_at)
values (
  'welcome',
  'Just In Time Study Hub and Coworking Space',
  '{"summary":"A focused, comfortable place to study and work."}'::jsonb,
  'published',
  now()
)
on conflict (slug) do nothing;
