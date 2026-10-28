-- GERADO POR scripts/generate-seed.mjs — não edite à mão.
-- Classificação após a 32ª rodada do Brasileirão 2026.
-- Rode supabase/schema.sql antes deste arquivo.

begin;

-- Clubes
insert into public.teams (id, name, abbr, color, color2) values
  ('flamengo', 'Flamengo', 'FLA', '#c52613', '#17171a'),
  ('palmeiras', 'Palmeiras', 'PAL', '#0a6e3f', '#e9ece9'),
  ('cruzeiro', 'Cruzeiro', 'CRU', '#1f4e9c', '#e9ecf2'),
  ('athletico-pr', 'Athletico-PR', 'CAP', '#b3161f', '#17171a'),
  ('fluminense', 'Fluminense', 'FLU', '#7a1430', '#0f6b3f'),
  ('atletico-mg', 'Atlético-MG', 'CAM', '#17171a', '#e9ece9'),
  ('bahia', 'Bahia', 'BAH', '#1c5bb8', '#d42a2a'),
  ('santos', 'Santos', 'SAN', '#17171a', '#e9ece9'),
  ('sao-paulo', 'São Paulo', 'SAO', '#c4162a', '#17171a'),
  ('bragantino', 'Red Bull Bragantino', 'RBB', '#cf1d2d', '#e9ece9'),
  ('botafogo', 'Botafogo', 'BOT', '#17171a', '#e9ece9'),
  ('coritiba', 'Coritiba', 'CTB', '#0d5c3a', '#e9ece9'),
  ('vasco', 'Vasco', 'VAS', '#17171a', '#e9ece9'),
  ('vitoria', 'Vitória', 'VIT', '#c8102e', '#17171a'),
  ('mirassol', 'Mirassol', 'MIR', '#107a4d', '#f5c518'),
  ('internacional', 'Internacional', 'INT', '#c4121f', '#e9ece9'),
  ('gremio', 'Grêmio', 'GRE', '#2a6fc9', '#17171a'),
  ('corinthians', 'Corinthians', 'COR', '#17171a', '#e9ece9'),
  ('remo', 'Remo', 'REM', '#14387f', '#e9ece9'),
  ('chapecoense', 'Chapecoense', 'CHA', '#0f7a35', '#e9ece9')
on conflict (id) do update set
  name = excluded.name, abbr = excluded.abbr,
  color = excluded.color, color2 = excluded.color2;

-- Classificação
insert into public.standings
  (team_id, played, won, drawn, lost, goals_for, goals_against) values
  ('flamengo', 32, 21, 7, 4, 64, 27),
  ('palmeiras', 32, 20, 9, 3, 56, 22),
  ('cruzeiro', 32, 16, 6, 10, 51, 46),
  ('athletico-pr', 32, 15, 9, 8, 50, 38),
  ('fluminense', 32, 14, 9, 9, 50, 41),
  ('atletico-mg', 32, 14, 8, 10, 44, 38),
  ('bahia', 32, 13, 11, 8, 45, 40),
  ('santos', 32, 12, 10, 10, 49, 47),
  ('sao-paulo', 32, 12, 7, 13, 37, 36),
  ('bragantino', 32, 11, 8, 13, 39, 38),
  ('botafogo', 32, 10, 9, 13, 44, 51),
  ('coritiba', 32, 10, 9, 13, 38, 50),
  ('vasco', 31, 10, 8, 13, 39, 45),
  ('vitoria', 32, 10, 8, 14, 35, 46),
  ('mirassol', 32, 9, 10, 13, 37, 45),
  ('internacional', 32, 8, 11, 13, 36, 40),
  ('gremio', 32, 8, 10, 14, 35, 44),
  ('corinthians', 32, 8, 9, 15, 34, 42),
  ('remo', 32, 5, 11, 16, 34, 50),
  ('chapecoense', 31, 4, 9, 18, 32, 63)
on conflict (team_id) do update set
  played = excluded.played, won = excluded.won, drawn = excluded.drawn,
  lost = excluded.lost, goals_for = excluded.goals_for,
  goals_against = excluded.goals_against, updated_at = now();

-- Jogos restantes (sem placar: ainda não foram disputados)
insert into public.fixtures (id, round, home_id, away_id, deferred) values
  ('r21-chapecoense-vasco', 21, 'chapecoense', 'vasco', true),
  ('r33-fluminense-internacional', 33, 'fluminense', 'internacional', false),
  ('r33-santos-palmeiras', 33, 'santos', 'palmeiras', false),
  ('r33-bragantino-chapecoense', 33, 'bragantino', 'chapecoense', false),
  ('r33-remo-botafogo', 33, 'remo', 'botafogo', false),
  ('r33-bahia-sao-paulo', 33, 'bahia', 'sao-paulo', false),
  ('r33-atletico-mg-cruzeiro', 33, 'atletico-mg', 'cruzeiro', false),
  ('r33-vasco-flamengo', 33, 'vasco', 'flamengo', false),
  ('r33-gremio-athletico-pr', 33, 'gremio', 'athletico-pr', false),
  ('r33-corinthians-mirassol', 33, 'corinthians', 'mirassol', false),
  ('r33-coritiba-vitoria', 33, 'coritiba', 'vitoria', false),
  ('r34-bragantino-santos', 34, 'bragantino', 'santos', false),
  ('r34-chapecoense-mirassol', 34, 'chapecoense', 'mirassol', false),
  ('r34-internacional-coritiba', 34, 'internacional', 'coritiba', false),
  ('r34-sao-paulo-corinthians', 34, 'sao-paulo', 'corinthians', false),
  ('r34-flamengo-gremio', 34, 'flamengo', 'gremio', false),
  ('r34-athletico-pr-vasco', 34, 'athletico-pr', 'vasco', false),
  ('r34-botafogo-atletico-mg', 34, 'botafogo', 'atletico-mg', false),
  ('r34-palmeiras-remo', 34, 'palmeiras', 'remo', false),
  ('r34-cruzeiro-bahia', 34, 'cruzeiro', 'bahia', false),
  ('r34-vitoria-fluminense', 34, 'vitoria', 'fluminense', false),
  ('r35-vasco-internacional', 35, 'vasco', 'internacional', false),
  ('r35-flamengo-athletico-pr', 35, 'flamengo', 'athletico-pr', false),
  ('r35-sao-paulo-fluminense', 35, 'sao-paulo', 'fluminense', false),
  ('r35-corinthians-botafogo', 35, 'corinthians', 'botafogo', false),
  ('r35-mirassol-atletico-mg', 35, 'mirassol', 'atletico-mg', false),
  ('r35-cruzeiro-palmeiras', 35, 'cruzeiro', 'palmeiras', false),
  ('r35-gremio-bahia', 35, 'gremio', 'bahia', false),
  ('r35-coritiba-santos', 35, 'coritiba', 'santos', false),
  ('r35-vitoria-bragantino', 35, 'vitoria', 'bragantino', false),
  ('r35-remo-chapecoense', 35, 'remo', 'chapecoense', false),
  ('r36-atletico-mg-corinthians', 36, 'atletico-mg', 'corinthians', false),
  ('r36-athletico-pr-remo', 36, 'athletico-pr', 'remo', false),
  ('r36-bahia-coritiba', 36, 'bahia', 'coritiba', false),
  ('r36-botafogo-sao-paulo', 36, 'botafogo', 'sao-paulo', false),
  ('r36-chapecoense-cruzeiro', 36, 'chapecoense', 'cruzeiro', false),
  ('r36-fluminense-mirassol', 36, 'fluminense', 'mirassol', false),
  ('r36-internacional-vitoria', 36, 'internacional', 'vitoria', false),
  ('r36-palmeiras-flamengo', 36, 'palmeiras', 'flamengo', false),
  ('r36-bragantino-vasco', 36, 'bragantino', 'vasco', false),
  ('r36-santos-gremio', 36, 'santos', 'gremio', false),
  ('r37-atletico-mg-vasco', 37, 'atletico-mg', 'vasco', false),
  ('r37-botafogo-bahia', 37, 'botafogo', 'bahia', false),
  ('r37-chapecoense-palmeiras', 37, 'chapecoense', 'palmeiras', false),
  ('r37-corinthians-gremio', 37, 'corinthians', 'gremio', false),
  ('r37-coritiba-flamengo', 37, 'coritiba', 'flamengo', false),
  ('r37-fluminense-cruzeiro', 37, 'fluminense', 'cruzeiro', false),
  ('r37-internacional-bragantino', 37, 'internacional', 'bragantino', false),
  ('r37-mirassol-athletico-pr', 37, 'mirassol', 'athletico-pr', false),
  ('r37-sao-paulo-remo', 37, 'sao-paulo', 'remo', false),
  ('r37-vitoria-santos', 37, 'vitoria', 'santos', false),
  ('r38-flamengo-chapecoense', 38, 'flamengo', 'chapecoense', false),
  ('r38-vasco-vitoria', 38, 'vasco', 'vitoria', false),
  ('r38-santos-botafogo', 38, 'santos', 'botafogo', false),
  ('r38-palmeiras-coritiba', 38, 'palmeiras', 'coritiba', false),
  ('r38-bragantino-fluminense', 38, 'bragantino', 'fluminense', false),
  ('r38-cruzeiro-internacional', 38, 'cruzeiro', 'internacional', false),
  ('r38-gremio-mirassol', 38, 'gremio', 'mirassol', false),
  ('r38-athletico-pr-sao-paulo', 38, 'athletico-pr', 'sao-paulo', false),
  ('r38-bahia-atletico-mg', 38, 'bahia', 'atletico-mg', false),
  ('r38-remo-corinthians', 38, 'remo', 'corinthians', false)
on conflict (id) do update set
  round = excluded.round, home_id = excluded.home_id,
  away_id = excluded.away_id, deferred = excluded.deferred;

commit;
