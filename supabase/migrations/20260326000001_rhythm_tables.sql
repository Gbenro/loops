-- Rhythm feature: practice observation layer
-- Three tables: rhythms, rhythm_cycle_instances, rhythm_observations

-- ── rhythms ──────────────────────────────────────────────────────────────────
create table if not exists rhythms (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  name        text not null,
  scope       text not null check (scope in ('cycle', 'ongoing')),
  active      boolean default true,
  created_at  timestamptz default now()
);

create index if not exists rhythms_user_active on rhythms (user_id, active);

alter table rhythms enable row level security;

create policy "Users manage own rhythms"
  on rhythms for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── rhythm_cycle_instances ────────────────────────────────────────────────────
create table if not exists rhythm_cycle_instances (
  id                uuid primary key default gen_random_uuid(),
  rhythm_id         uuid references rhythms not null,
  user_id           uuid references auth.users not null,
  cycle_start       timestamptz not null,
  intention_type    text check (intention_type in ('whole', 'phase', 'none')),
  whole_intention   text check (whole_intention in ('none','light','moderate','deep','ceremonial')),
  phase_intentions  jsonb default '{}',
  report_generated  boolean default false,
  created_at        timestamptz default now()
);

create index if not exists rci_rhythm_cycle on rhythm_cycle_instances (rhythm_id, cycle_start);
create index if not exists rci_user_cycle   on rhythm_cycle_instances (user_id, cycle_start);

alter table rhythm_cycle_instances enable row level security;

create policy "Users manage own rhythm instances"
  on rhythm_cycle_instances for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── rhythm_observations ───────────────────────────────────────────────────────
create table if not exists rhythm_observations (
  id                uuid primary key default gen_random_uuid(),
  cycle_instance_id uuid references rhythm_cycle_instances not null,
  user_id           uuid references auth.users not null,
  phase             text not null check (phase in (
                      'new','waxing-crescent','first-quarter','waxing-gibbous',
                      'full','waning-gibbous','last-quarter','waning-crescent'
                    )),
  engagement        text not null check (engagement in
                      ('none','light','moderate','deep','ceremonial')),
  note              text,
  logged_at         timestamptz default now(),
  unique (cycle_instance_id, phase)
);

create index if not exists ro_instance on rhythm_observations (cycle_instance_id);

alter table rhythm_observations enable row level security;

create policy "Users manage own observations"
  on rhythm_observations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
