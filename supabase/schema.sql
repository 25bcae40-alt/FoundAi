-- LostLink starter schema. Run in Supabase SQL Editor.
-- IMPORTANT: private ownership answers are stored in a separate table and have no user-facing SELECT policy.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.lost_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  category text not null,
  description text not null check (char_length(description) <= 1000),
  location text not null,
  item_date date not null default current_date,
  color text,
  brand text,
  image_path text,
  status text not null default 'open' check (status in ('open','potential_match','verification','verified','handover','returned','expired')),
  created_at timestamptz not null default now()
);

create table if not exists public.lost_item_private (
  item_id uuid primary key references public.lost_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  private_mark text,
  private_contents text,
  evidence_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.found_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  category text not null,
  description text not null check (char_length(description) <= 1000),
  location text not null,
  item_date date not null default current_date,
  color text,
  brand text,
  image_path text,
  status text not null default 'open' check (status in ('open','claimed','potential_match','verified','handover','returned','expired')),
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  lost_item_id uuid not null references public.lost_items(id) on delete cascade,
  found_item_id uuid not null references public.found_items(id) on delete cascade,
  category_similarity int not null default 0 check (category_similarity between 0 and 100),
  description_similarity int not null default 0 check (description_similarity between 0 and 100),
  location_similarity int not null default 0 check (location_similarity between 0 and 100),
  time_similarity int not null default 0 check (time_similarity between 0 and 100),
  overall_confidence int not null default 0 check (overall_confidence between 0 and 100),
  reasons jsonb not null default '[]'::jsonb,
  status text not null default 'potential_match' check (status in ('potential_match','verification','manual_review','rejected','verified','returned')),
  created_at timestamptz not null default now(),
  unique(lost_item_id, found_item_id)
);

create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches(id) on delete cascade,
  item_id uuid references public.found_items(id) on delete cascade,
  claimant_id uuid not null references auth.users(id) on delete cascade,
  evidence_note text check (char_length(evidence_note) <= 2000),
  status text not null default 'pending_review' check (status in ('pending_review','additional_evidence','approved','rejected','cancelled')),
  verification_confidence int not null default 0 check (verification_confidence between 0 and 100),
  admin_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  requested_by uuid references auth.users(id),
  request_note text not null,
  status text not null default 'pending' check (status in ('pending','submitted','accepted','rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.handovers (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null unique references public.claims(id) on delete cascade,
  safe_location text not null,
  scheduled_at timestamptz,
  finder_confirmed_at timestamptz,
  owner_confirmed_at timestamptz,
  status text not null default 'pending' check (status in ('pending','scheduled','completed','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id),
  action text not null,
  target_table text not null,
  target_id uuid,
  note text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.lost_items enable row level security;
alter table public.lost_item_private enable row level security;
alter table public.found_items enable row level security;
alter table public.matches enable row level security;
alter table public.claims enable row level security;
alter table public.verification_requests enable row level security;
alter table public.notifications enable row level security;
alter table public.handovers enable row level security;
alter table public.admin_actions enable row level security;

-- Admin access is checked using profiles.role. Only a trusted admin should be able to set this field.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') $$;

create policy "Profiles can be viewed by owner or admin" on public.profiles
for select using (id = auth.uid() or public.is_admin());
create policy "Users can create own profile" on public.profiles
for insert with check (id = auth.uid() and role = 'user');
create policy "Users can update own display name" on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid() and role = 'user');

create policy "Public can view open lost reports" on public.lost_items
for select using (status <> 'expired' or user_id = auth.uid() or public.is_admin());
create policy "Owners can create lost reports" on public.lost_items
for insert with check (user_id = auth.uid());
create policy "Owners or admins can update lost reports" on public.lost_items
for update using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy "Owners or admins can delete lost reports" on public.lost_items
for delete using (user_id = auth.uid() or public.is_admin());

create policy "Only owner/admin can read private lost details" on public.lost_item_private
for select using (user_id = auth.uid() or public.is_admin());
create policy "Owner can insert private lost details" on public.lost_item_private
for insert with check (user_id = auth.uid());
create policy "Owner/admin can update private lost details" on public.lost_item_private
for update using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

create policy "Public can view open found reports" on public.found_items
for select using (status <> 'expired' or user_id = auth.uid() or public.is_admin());
create policy "Owners can create found reports" on public.found_items
for insert with check (user_id = auth.uid());
create policy "Owners or admins can update found reports" on public.found_items
for update using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy "Owners or admins can delete found reports" on public.found_items
for delete using (user_id = auth.uid() or public.is_admin());

create policy "Participants/admin can read matches" on public.matches
for select using (
  public.is_admin() or
  exists(select 1 from public.lost_items l where l.id=lost_item_id and l.user_id=auth.uid()) or
  exists(select 1 from public.found_items f where f.id=found_item_id and f.user_id=auth.uid())
);
create policy "Lost owner can create match" on public.matches
for insert with check (exists(select 1 from public.lost_items l where l.id=lost_item_id and l.user_id=auth.uid()) or public.is_admin());

create policy "Claimant or admin can read claims" on public.claims
for select using (claimant_id=auth.uid() or public.is_admin() or exists(
  select 1 from public.found_items f where f.id=claims.item_id and f.user_id=auth.uid()
));
create policy "Users can submit own claims" on public.claims
for insert with check (claimant_id=auth.uid());
create policy "Admin can update claims" on public.claims
for update using (public.is_admin()) with check (public.is_admin());

create policy "Claim participants/admin can view verification requests" on public.verification_requests
for select using (public.is_admin() or requested_by=auth.uid() or exists(select 1 from public.claims c where c.id=claim_id and c.claimant_id=auth.uid()));
create policy "Admin can create verification requests" on public.verification_requests
for insert with check (public.is_admin());

create policy "Users can view own notifications" on public.notifications for select using (user_id=auth.uid() or public.is_admin());
create policy "Users can mark own notifications read" on public.notifications for update using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "Admin can create notifications" on public.notifications for insert with check (public.is_admin());

create policy "Claimant or admin can view handovers" on public.handovers for select using (
  public.is_admin() or exists(select 1 from public.claims c where c.id=claim_id and c.claimant_id=auth.uid())
);
create policy "Admin can manage handovers" on public.handovers for all using (public.is_admin()) with check (public.is_admin());

create policy "Only admins can read audit actions" on public.admin_actions for select using (public.is_admin());
create policy "Admins can insert audit actions" on public.admin_actions for insert with check (admin_id=auth.uid() and public.is_admin());

-- Storage setup: create a private bucket named item-photos in Supabase Storage.
-- Add authenticated-only upload policies there. Keep sensitive evidence in a separate private bucket.
-- Do not make the private evidence bucket public.
