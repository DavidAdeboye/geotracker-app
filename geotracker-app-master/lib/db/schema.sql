-- GEOTracker v2 schema
-- Closed loop: brands -> query clusters -> citation sources -> gap fixes -> verification

create table brands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  name text not null,
  category text not null, -- e.g. "project management SaaS"
  created_at timestamptz not null default now()
);

create table query_clusters (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  cluster_label text not null, -- e.g. "best PM tools for remote teams"
  prompts text[] not null,     -- the actual prompt variants run in bulk fan-out
  created_at timestamptz not null default now()
);

create table bulk_responses (
  id uuid primary key default gen_random_uuid(),
  query_cluster_id uuid not null references query_clusters(id) on delete cascade,
  prompt text not null,
  model text not null,
  response text,
  error text,
  created_at timestamptz not null default now()
);

create table citation_sources (
  id uuid primary key default gen_random_uuid(),
  query_cluster_id uuid not null references query_clusters(id) on delete cascade,
  likely_sources text[] not null,
  brand_footprint text not null check (brand_footprint in ('strong', 'weak', 'absent')),
  gap_description text,
  traced_at timestamptz not null default now()
);

create table gap_fixes (
  id uuid primary key default gen_random_uuid(),
  citation_source_id uuid not null references citation_sources(id) on delete cascade,
  fix_type text not null, -- e.g. "comparison_page", "faq_block", "reddit_answer"
  generated_content text not null,
  generation_model text not null,
  published boolean not null default false,
  published_url text,
  created_at timestamptz not null default now()
);

create table verification_runs (
  id uuid primary key default gen_random_uuid(),
  gap_fix_id uuid not null references gap_fixes(id) on delete cascade,
  query_cluster_id uuid not null references query_clusters(id) on delete cascade,
  ran_at timestamptz not null default now(),
  brand_appeared boolean not null,
  raw_response text not null
);

-- Basic RLS: users only see their own brands and everything cascading from them.
alter table brands enable row level security;
create policy "Users manage own brands" on brands
  for all using (auth.uid() = user_id);

alter table query_clusters enable row level security;
create policy "Users manage own query clusters" on query_clusters
  for all using (
    exists (select 1 from brands where brands.id = query_clusters.brand_id and brands.user_id = auth.uid())
  );

-- Repeat the same pattern for bulk_responses, citation_sources, gap_fixes,
-- verification_runs — join up through query_clusters -> brands -> user_id.
