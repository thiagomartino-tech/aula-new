-- Schema do Supabase para o simulador do Brasileirão.
-- Rodar no painel do Supabase: SQL Editor > New query > colar > Run.
--
-- O Worker fala com estas tabelas usando a chave service_role, que ignora
-- RLS. As políticas abaixo existem para o caso de o browser passar a ler o
-- Supabase direto com a chave anon.

-- ---------------------------------------------------------------------------
-- Clubes
-- ---------------------------------------------------------------------------
create table if not exists public.teams (
  id     text primary key,         -- 'flamengo', 'sao-paulo', ...
  name   text not null,
  abbr   text not null check (char_length(abbr) between 2 and 4),
  color  text,
  color2 text
);

-- ---------------------------------------------------------------------------
-- Classificação. Uma linha por clube; `points` é gerado para não sair do ar
-- com o resto da linha.
-- ---------------------------------------------------------------------------
create table if not exists public.standings (
  team_id       text primary key references public.teams (id) on delete cascade,
  played        smallint not null check (played between 0 and 38),
  won           smallint not null check (won >= 0),
  drawn         smallint not null check (drawn >= 0),
  lost          smallint not null check (lost >= 0),
  goals_for     smallint not null check (goals_for >= 0),
  goals_against smallint not null check (goals_against >= 0),
  points        smallint generated always as (won * 3 + drawn) stored,
  updated_at    timestamptz not null default now(),
  constraint standings_games_match check (won + drawn + lost = played)
);

-- ---------------------------------------------------------------------------
-- Jogos. Guarda a temporada inteira; os já disputados levam o placar.
-- ---------------------------------------------------------------------------
create table if not exists public.fixtures (
  id         text primary key,     -- 'r33-vasco-flamengo'
  round      smallint not null check (round between 1 and 38),
  home_id    text not null references public.teams (id),
  away_id    text not null references public.teams (id),
  kickoff_at timestamptz,
  deferred   boolean not null default false,
  home_goals smallint check (home_goals >= 0),
  away_goals smallint check (away_goals >= 0),
  constraint fixtures_distinct_teams check (home_id <> away_id),
  -- Placar é tudo ou nada.
  constraint fixtures_score_complete check (
    (home_goals is null) = (away_goals is null)
  )
);

create index if not exists fixtures_round_idx on public.fixtures (round);

-- ---------------------------------------------------------------------------
-- Simulações salvas. `predictions` é um objeto { fixture_id: 'H'|'D'|'A' }.
-- ---------------------------------------------------------------------------
create table if not exists public.simulations (
  id          text primary key,    -- id curto gerado pelo Worker
  name        text check (char_length(name) <= 80),
  predictions jsonb not null,
  created_at  timestamptz not null default now(),
  constraint simulations_predictions_is_object check (
    jsonb_typeof(predictions) = 'object'
  )
);

create index if not exists simulations_created_at_idx
  on public.simulations (created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.teams       enable row level security;
alter table public.standings   enable row level security;
alter table public.fixtures    enable row level security;
alter table public.simulations enable row level security;

-- Tabela e jogos são informação pública: leitura liberada, escrita não.
drop policy if exists "leitura publica dos clubes" on public.teams;
create policy "leitura publica dos clubes"
  on public.teams for select using (true);

drop policy if exists "leitura publica da classificacao" on public.standings;
create policy "leitura publica da classificacao"
  on public.standings for select using (true);

drop policy if exists "leitura publica dos jogos" on public.fixtures;
create policy "leitura publica dos jogos"
  on public.fixtures for select using (true);

-- Simulações: qualquer um pode criar e ler pelo id (é um link de
-- compartilhamento), mas ninguém altera nem apaga a simulação de outro.
drop policy if exists "leitura publica das simulacoes" on public.simulations;
create policy "leitura publica das simulacoes"
  on public.simulations for select using (true);

drop policy if exists "criacao publica de simulacoes" on public.simulations;
create policy "criacao publica de simulacoes"
  on public.simulations for insert with check (true);
