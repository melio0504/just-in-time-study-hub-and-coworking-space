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

insert into public.announcements (title, body, status, starts_at)
select seed.title, seed.body, seed.status::public.content_status, seed.starts_at
from (values
  (
    'October focus-week schedule',
    'The hub will stay open until 2:00 AM from Monday through Saturday this week. Quiet-zone rules remain in effect after 10:00 PM.',
    'published'::text,
    (current_date - 1)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Extended study hours this exam season',
    'We are extending our operating hours during exam season so you have more time to focus, review, and finish your requirements.',
    'published'::text,
    (current_date - 2)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'New quiet-zone seating available',
    'Additional seats in the quiet zone are now available for individual study sessions. Reserve early for peak afternoon hours.',
    'published'::text,
    (current_date - 12)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Free coffee refill weekend',
    'Guests with an active day pass can enjoy unlimited brewed coffee refills this Saturday and Sunday while supplies last.',
    'published'::text,
    (current_date - 18)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Improved Wi-Fi coverage now live',
    'We completed our access-point upgrade. The quiet zone and back-row seats now have stronger and more consistent Wi-Fi coverage.',
    'published'::text,
    (current_date - 27)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Printing station service update',
    'The self-service printing station is available again. Please ask the front desk for current black-and-white and color printing rates.',
    'published'::text,
    (current_date - 39)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Holiday operating hours',
    'The hub will operate from 10:00 AM to 10:00 PM on the upcoming public holiday. Online reservations remain available.',
    'published'::text,
    (current_date - 52)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Study room etiquette reminder',
    'Please keep calls brief, use headphones, and leave shared desks clean for the next guest. Thank you for helping everyone stay focused.',
    'published'::text,
    (current_date - 65)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Updated day-pass inclusions',
    'Day passes now include access to charging adapters, drinking water, and the pantry throughout the reserved session.',
    'published'::text,
    (current_date - 78)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Weekend maintenance notice',
    'A short network maintenance window is planned this weekend. This draft can be edited and published by the admin team.',
    'draft'::text,
    (current_date + 5)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Student organization partnership',
    'A partnership announcement is being reviewed with participating student organizations before publication.',
    'draft'::text,
    (current_date + 12)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Old air-conditioning advisory',
    'Preventive air-conditioning maintenance was completed and normal operating temperatures have resumed.',
    'archived'::text,
    (current_date - 95)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Previous network maintenance notice',
    'The scheduled internet maintenance was completed successfully with no remaining service interruptions.',
    'archived'::text,
    (current_date - 120)::timestamp at time zone 'Asia/Manila'
  )
) as seed(title, body, status, starts_at)
where not exists (
  select 1 from public.announcements existing where existing.title = seed.title
);

-- Reproducible sample business history for the analytics dashboard. These rows
-- are database data (not UI constants) and can later be replaced by a nightly
-- aggregation job as real operations accumulate.
insert into public.daily_business_metrics (
  metric_date,
  revenue_cents,
  bookings_count,
  checkins_count,
  occupied_seat_hours,
  available_seat_hours,
  active_members,
  hourly_revenue_cents,
  daily_pass_revenue_cents,
  monthly_revenue_cents
)
select
  day::date,
  (
    260000
    + ((extract(doy from day)::integer * 3571) % 120000)
    + ((extract(doy from day)::integer * 2371) % 90000)
    + ((extract(doy from day)::integer * 1973) % 100000)
  )::bigint,
  9 + ((extract(doy from day)::integer * 7) % 19),
  7 + ((extract(doy from day)::integer * 5) % 17),
  70 + ((extract(doy from day)::integer * 13) % 260),
  600,
  96 + ((extract(doy from day)::integer * 3) % 75),
  (100000 + ((extract(doy from day)::integer * 3571) % 120000))::bigint,
  (70000 + ((extract(doy from day)::integer * 2371) % 90000))::bigint,
  (90000 + ((extract(doy from day)::integer * 1973) % 100000))::bigint
from generate_series(current_date - 179, current_date, interval '1 day') as day
on conflict (metric_date) do update set
  revenue_cents = excluded.revenue_cents,
  bookings_count = excluded.bookings_count,
  checkins_count = excluded.checkins_count,
  occupied_seat_hours = excluded.occupied_seat_hours,
  available_seat_hours = excluded.available_seat_hours,
  active_members = excluded.active_members,
  hourly_revenue_cents = excluded.hourly_revenue_cents,
  daily_pass_revenue_cents = excluded.daily_pass_revenue_cents,
  monthly_revenue_cents = excluded.monthly_revenue_cents;
