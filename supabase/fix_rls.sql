-- Fix infinite recursion in profiles RLS policies
-- Run this in the Supabase SQL Editor

-- Drop the recursive policies
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists "Admins can update any profile" on public.profiles;

-- Recreate using the is_admin() function (SECURITY DEFINER, bypasses RLS)
create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin(auth.uid()));

create policy "Admins can update any profile"
  on public.profiles for update
  using (public.is_admin(auth.uid()));

-- Also fix evaluations admin policy
drop policy if exists "Admins can view all evaluations" on public.evaluations;
create policy "Admins can view all evaluations"
  on public.evaluations for select
  using (public.is_admin(auth.uid()));

-- Also fix scrape_jobs admin policy
drop policy if exists "Admins can view all jobs" on public.scrape_jobs;
create policy "Admins can view all jobs"
  on public.scrape_jobs for select
  using (public.is_admin(auth.uid()));
