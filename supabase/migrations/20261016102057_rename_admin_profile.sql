-- Keep the owner name consistent anywhere profiles are joined into audit logs.
update public.profiles
set full_name = 'Admin'
where lower(email) = 'admin@jit-studyhub.com'
  and full_name is distinct from 'Admin';
