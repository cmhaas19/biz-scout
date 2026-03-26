-- ============================================================
-- BizScout Database Schema
-- Run against your Supabase project via the SQL Editor
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- profiles
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  role text not null default 'member' check (role in ('admin', 'member')),
  is_disabled boolean not null default false,
  kumo_token text,
  kumo_token_expires_at timestamptz,
  buyer_profile jsonb default '{}'::jsonb,
  buyer_profile_version integer not null default 1,
  kumo_filters jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Members can read/update their own row
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Admins can read all profiles (uses SECURITY DEFINER function to avoid RLS recursion)
create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin(auth.uid()));

-- Admins can update role and is_disabled on any profile
create policy "Admins can update any profile"
  on public.profiles for update
  using (public.is_admin(auth.uid()));

-- ============================================================
-- Auto-create profile on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  user_count integer;
  user_role text;
begin
  select count(*) into user_count from public.profiles;
  -- First user becomes admin
  if user_count = 0 then
    user_role := 'admin';
  else
    user_role := 'member';
  end if;

  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    user_role
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- listings
-- ============================================================
create table if not exists public.listings (
  id text primary key,
  kumo_link text not null,
  business_name text not null,
  location text,
  asking_price numeric,
  revenue numeric,
  earnings numeric,
  margin_pct numeric,
  multiple numeric,
  industry text,
  date_added timestamptz,
  summary text,
  top_highlights text,
  additional_information text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.listings enable row level security;

-- All authenticated users can read listings
create policy "Authenticated users can view listings"
  on public.listings for select
  to authenticated
  using (true);

-- Only service role can insert/update (handled via service client)
-- No RLS insert/update policies for authenticated role

-- ============================================================
-- evaluations
-- ============================================================
create table if not exists public.evaluations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id text not null references public.listings(id) on delete cascade,
  fit_score integer not null check (fit_score >= 0 and fit_score <= 100),
  fit_notes text,
  profile_version integer not null default 1,
  prompt_version integer not null default 1,
  user_rating text check (user_rating in ('excellent', 'good', 'fair', 'poor')),
  user_notes text,
  evaluated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, listing_id)
);

alter table public.evaluations enable row level security;

-- Members can read/write their own evaluations
create policy "Users can view own evaluations"
  on public.evaluations for select
  using (auth.uid() = user_id);

create policy "Users can insert own evaluations"
  on public.evaluations for insert
  with check (auth.uid() = user_id);

create policy "Users can update own evaluations"
  on public.evaluations for update
  using (auth.uid() = user_id);

-- Admins can read all evaluations
create policy "Admins can view all evaluations"
  on public.evaluations for select
  using (public.is_admin(auth.uid()));

-- ============================================================
-- scrape_jobs
-- ============================================================
create table if not exists public.scrape_jobs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  trigger text not null default 'manual' check (trigger in ('manual', 'scheduled', 're-evaluate')),
  listings_scraped integer not null default 0,
  listings_evaluated integer not null default 0,
  error text,
  started_at timestamptz,
  completed_at timestamptz
);

alter table public.scrape_jobs enable row level security;

-- Members see own + system jobs
create policy "Users can view own and system jobs"
  on public.scrape_jobs for select
  using (user_id = auth.uid() or user_id is null);

-- Members can insert their own jobs
create policy "Users can insert own jobs"
  on public.scrape_jobs for insert
  with check (user_id = auth.uid());

-- Admins can read all jobs
create policy "Admins can view all jobs"
  on public.scrape_jobs for select
  using (public.is_admin(auth.uid()));

-- ============================================================
-- system_settings
-- ============================================================
create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.system_settings enable row level security;

-- All authenticated users can read settings
create policy "Authenticated users can view settings"
  on public.system_settings for select
  to authenticated
  using (true);

-- Only admins can write settings
create policy "Admins can update settings"
  on public.system_settings for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Admins can insert settings"
  on public.system_settings for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ============================================================
-- prompt_templates
-- ============================================================
create table if not exists public.prompt_templates (
  id uuid primary key default uuid_generate_v4(),
  version integer not null unique,
  name text not null,
  system_prompt text not null,
  is_active boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  notes text
);

alter table public.prompt_templates enable row level security;

-- All authenticated users can read prompt templates
create policy "Authenticated users can view prompts"
  on public.prompt_templates for select
  to authenticated
  using (true);

-- Only admins can insert/update
create policy "Admins can insert prompts"
  on public.prompt_templates for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Admins can update prompts"
  on public.prompt_templates for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Ensure only one active prompt at a time
create unique index idx_prompt_templates_active
  on public.prompt_templates (is_active)
  where is_active = true;

-- ============================================================
-- Seed data: default prompt template v1
-- ============================================================
insert into public.prompt_templates (version, name, system_prompt, is_active, notes)
values (
  1,
  'Default Scoring Rubric',
  E'You are a business acquisition advisor evaluating whether a business listing\nis a good fit for a specific buyer.\n\nYou will be given:\n1. The buyer''s profile with their acquisition criteria\n2. Calibration examples showing how the buyer has rated previous listings (if available)\n3. A business listing to evaluate\n\n## Scoring Rubric\n\nScore the listing 0-100 based on weighted criteria:\n\n### Financial Fit (35 points)\n- Asking price within buyer''s range and financing capacity\n- EBITDA/SDE within buyer''s target range\n- Revenue appropriate for the business type\n- Healthy margins relative to industry norms\n- Multiple reasonable for the sector\n\n### Industry Fit (20 points)\n- Direct match to buyer''s listed industries of focus\n- Adjacent or complementary industry (partial credit)\n- Completely outside buyer''s domain (no credit)\n\n### Location Fit (10 points)\n- Matches buyer''s primary geography\n- Matches secondary geography or is remote-compatible\n- Outside buyer''s geography with no remote option (no credit)\n\n### Business Quality (20 points)\n- Recurring or repeatable revenue streams\n- Established track record (3+ years profitability)\n- Growth potential (expanding market, untapped channels)\n- Diversified customer base (low concentration risk)\n- Reasonable capital expenditure requirements\n\n### Deal Feasibility (15 points)\n- SBA 7(a) eligible (within pre-approval ceiling)\n- Realistic equity contribution within buyer''s stated capacity\n- Seller financing or earnout flexibility mentioned\n- Clean ownership structure (no complex partnerships or litigation flags)\n\n### Disqualifying Factors (override)\nIf any of the buyer''s listed disqualifying factors apply, cap the score at 25\nregardless of other criteria. Note which disqualifier triggered the cap.\n\n## Score Interpretation\n\n- 80-100: Strong fit - meets or exceeds criteria across most dimensions\n- 60-79:  Good fit - solid on fundamentals, minor gaps or unknowns\n- 40-59:  Marginal - some appeal but meaningful concerns in 1-2 areas\n- 20-39:  Weak fit - fails on multiple criteria or has a soft disqualifier\n- 0-19:   Poor fit - disqualified or fundamentally misaligned\n\nIf calibration examples are provided, use them to understand the buyer''s revealed\npreferences - they may value certain things more or less than the written profile\nsuggests. Adjust your weighting accordingly.\n\nRespond with ONLY valid JSON in this exact format:\n{"score": <integer 0-100>, "notes": "<2-4 concise sentences explaining the score, key strengths and concerns>"}',
  true,
  'Initial seed prompt from product spec'
);

-- ============================================================
-- Seed data: default system settings
-- ============================================================
insert into public.system_settings (key, value) values
  ('rate_limit.general', '{"requests": 100, "window_seconds": 60}'::jsonb),
  ('rate_limit.scrape', '{"requests": 5, "window_seconds": 3600}'::jsonb),
  ('rate_limit.evaluate', '{"requests": 20, "window_seconds": 60}'::jsonb),
  ('rate_limit.export', '{"requests": 10, "window_seconds": 3600}'::jsonb),
  ('rate_limit.auth', '{"requests": 10, "window_seconds": 3600}'::jsonb),
  ('scrape.cron_schedule', '"0 8 * * *"'::jsonb),
  ('scrape.cron_enabled', 'false'::jsonb),
  ('scrape.concurrency', '5'::jsonb),
  ('evaluate.model', '"claude-sonnet-4-20250514"'::jsonb),
  ('evaluate.max_tokens', '300'::jsonb),
  ('evaluate.concurrency', '5'::jsonb),
  ('evaluate.calibration_max', '10'::jsonb),
  ('kumo.default_filters', '{"price": [500000, 7000000], "ebitda": [0, 100000000], "revenue": [0, 100000000], "addedDaysAgo": "<3", "earnings_to_revenue": [0, 1], "price_to_earnings": [0, 100]}'::jsonb)
on conflict (key) do nothing;

-- ============================================================
-- Helper function: check if a user is admin
-- ============================================================
create or replace function public.is_admin(user_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = user_id and role = 'admin'
  );
$$;

-- ============================================================
-- Updated_at trigger function
-- ============================================================
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.update_updated_at();

create trigger set_listings_updated_at
  before update on public.listings
  for each row execute procedure public.update_updated_at();

create trigger set_evaluations_updated_at
  before update on public.evaluations
  for each row execute procedure public.update_updated_at();

-- ============================================================
-- Indexes for performance
-- ============================================================
create index if not exists idx_evaluations_user_id on public.evaluations(user_id);
create index if not exists idx_evaluations_listing_id on public.evaluations(listing_id);
create index if not exists idx_evaluations_user_listing on public.evaluations(user_id, listing_id);
create index if not exists idx_listings_date_added on public.listings(date_added desc);
create index if not exists idx_listings_asking_price on public.listings(asking_price);
create index if not exists idx_scrape_jobs_user_id on public.scrape_jobs(user_id);
create index if not exists idx_scrape_jobs_status on public.scrape_jobs(status);
