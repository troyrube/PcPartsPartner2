-- Supabase: SQL Editor -> New query -> paste ALL of this text -> Run
-- (Safe to run again: it only creates tables that don't exist yet.)

create extension if not exists "uuid-ossp";

create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  username text unique not null,
  cellphone text not null,
  password_hash text not null,
  is_admin boolean default false,
  created_at timestamptz default now()
);

create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  price numeric not null,
  category text not null,
  description text,
  image_url text,
  stock integer default 0,
  created_at timestamptz default now()
);

create table if not exists orders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id),
  items jsonb not null,
  total numeric not null,
  delivery_address text,
  payment_status text default 'PENDING',
  created_at timestamptz default now()
);

-- Lock the tables: only the server (secret key) can read/write them.
alter table users enable row level security;
alter table products enable row level security;
alter table orders enable row level security;

-- ---------------------------------------------------------------
-- MAKE YOURSELF AN ADMIN (run this separately, AFTER you have
-- registered an account on the site; put your own username in):
--
--   update users set is_admin = true where username = 'YOUR USERNAME';
-- ---------------------------------------------------------------
