/**
 * Gera supabase/seed.sql a partir dos dados de src/data/.
 *
 *   node scripts/generate-seed.mjs
 *
 * Assim o seed nunca sai de sincronia com o snapshot embutido: depois de
 * atualizar src/data/, rode isto e cole o SQL no painel do Supabase.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { TEAMS } from '../src/data/teams.js';
import { STANDINGS, assertStandings, LAST_ROUND_PLAYED } from '../src/data/standings.js';
import { FIXTURES, assertFixtures } from '../src/data/fixtures.js';

assertStandings();
assertFixtures(FIXTURES, STANDINGS);

/** Escapa um literal de texto para SQL; null vira NULL. */
const q = (value) =>
  value === null || value === undefined ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`;

const lines = [
  '-- GERADO POR scripts/generate-seed.mjs — não edite à mão.',
  `-- Classificação após a ${LAST_ROUND_PLAYED}ª rodada do Brasileirão 2026.`,
  '-- Rode supabase/schema.sql antes deste arquivo.',
  '',
  'begin;',
  '',
  '-- Clubes',
  'insert into public.teams (id, name, abbr, color, color2) values',
  TEAMS.map(
    (t) => `  (${q(t.id)}, ${q(t.name)}, ${q(t.abbr)}, ${q(t.color)}, ${q(t.color2)})`,
  ).join(',\n'),
  'on conflict (id) do update set',
  '  name = excluded.name, abbr = excluded.abbr,',
  '  color = excluded.color, color2 = excluded.color2;',
  '',
  '-- Classificação',
  'insert into public.standings',
  '  (team_id, played, won, drawn, lost, goals_for, goals_against) values',
  STANDINGS.map(
    (r) =>
      `  (${q(r.teamId)}, ${r.played}, ${r.won}, ${r.drawn}, ${r.lost}, ` +
      `${r.goalsFor}, ${r.goalsAgainst})`,
  ).join(',\n'),
  'on conflict (team_id) do update set',
  '  played = excluded.played, won = excluded.won, drawn = excluded.drawn,',
  '  lost = excluded.lost, goals_for = excluded.goals_for,',
  '  goals_against = excluded.goals_against, updated_at = now();',
  '',
  '-- Jogos restantes (sem placar: ainda não foram disputados)',
  'insert into public.fixtures (id, round, home_id, away_id, deferred) values',
  FIXTURES.map(
    (f) => `  (${q(f.id)}, ${f.round}, ${q(f.home)}, ${q(f.away)}, ${f.deferred})`,
  ).join(',\n'),
  'on conflict (id) do update set',
  '  round = excluded.round, home_id = excluded.home_id,',
  '  away_id = excluded.away_id, deferred = excluded.deferred;',
  '',
  'commit;',
  '',
];

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'seed.sql');
writeFileSync(out, lines.join('\n'));
console.log(
  `seed.sql gerado: ${TEAMS.length} clubes, ${STANDINGS.length} linhas de ` +
    `classificação, ${FIXTURES.length} jogos`,
);
