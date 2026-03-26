-- Run this AFTER schema.sql in the Supabase SQL Editor
-- Helper function for admin user list

create or replace function public.eval_counts_by_user()
returns table (user_id uuid, count bigint)
language sql
security definer
stable
as $$
  select user_id, count(*)::bigint
  from public.evaluations
  group by user_id;
$$;
