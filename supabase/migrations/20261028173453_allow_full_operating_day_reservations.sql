update public.booking_settings
set max_duration_hours = 24,
    updated_at = now()
where singleton;
