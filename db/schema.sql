create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists weddings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references users(id) on delete cascade,
  partner1 text not null default '',
  partner2 text not null default '',
  city text not null default '',
  currency text not null default 'INR',
  events jsonb not null default '[]',
  notes text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists category_requests (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings(id) on delete cascade,
  category text not null,
  requirements jsonb not null default '{}',
  budget numeric,
  status text not null default 'needs_details',
  progress jsonb not null default '[]',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (wedding_id, category)
);

create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references category_requests(id) on delete cascade,
  name text not null,
  website text,
  instagram text,
  email text,
  phone text,
  location text,
  price_estimate text,
  price_low numeric,
  rating numeric,
  review_count integer,
  review_summary text,
  style text,
  images jsonb not null default '[]',
  fit_notes text,
  sources jsonb not null default '[]',
  score numeric not null default 0,
  shortlisted boolean not null default false,
  status text not null default 'found',
  outreach_to text,
  thread_id text,
  quote jsonb,
  created_at timestamptz not null default now()
);

create index if not exists vendors_request_idx on vendors(request_id);
create index if not exists vendors_thread_idx on vendors(thread_id);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  agentmail_message_id text unique,
  subject text,
  body text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists messages_vendor_idx on messages(vendor_id);
