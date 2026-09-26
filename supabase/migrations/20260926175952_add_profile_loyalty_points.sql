alter table public.profiles
  add column loyalty_points integer not null default 500,
  add constraint profiles_loyalty_points_nonnegative check (loyalty_points >= 0);
