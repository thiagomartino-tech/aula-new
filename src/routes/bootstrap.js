/**
 * GET /api/bootstrap
 *
 * Tudo que o front precisa para montar a tabela numa única resposta: clubes,
 * classificação, jogos restantes e as faixas de classificação.
 *
 * A classificação sai do Supabase quando o banco está configurado e tem
 * dados; senão cai no snapshot de src/data/. `source` na resposta diz de onde
 * cada parte veio, e a interface mostra isso no rodapé.
 */
import { json } from '../lib/http.js';
import { createSupabase } from '../lib/supabase.js';
import { TEAMS } from '../data/teams.js';
import {
  STANDINGS,
  ZONES,
  LAST_ROUND_PLAYED,
  TOTAL_ROUNDS,
  assertStandings,
} from '../data/standings.js';
import {
  FIXTURES,
  REMAINING_ROUNDS,
  ROUND_DATES,
  DEFERRED_ROUND,
  assertFixtures,
} from '../data/fixtures.js';
import { SEASON } from '../data/season.js';
import { COMPETITIONS } from '../data/competitions.js';

/** Lê a classificação do Supabase, ou devolve null se não houver banco/dados. */
async function standingsFromDb(env) {
  const db = createSupabase(env);
  if (!db) return null;

  const rows = await db.select('standings', {
    select: 'team_id,played,won,drawn,lost,goals_for,goals_against,points',
    order: 'points.desc',
  });
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const mapped = rows.map((r) => ({
    teamId: r.team_id,
    played: r.played,
    won: r.won,
    drawn: r.drawn,
    lost: r.lost,
    goalsFor: r.goals_for,
    goalsAgainst: r.goals_against,
    pts: r.points,
  }));

  // Um banco incompleto ou inconsistente não deve estragar a tabela: nesse
  // caso o snapshot embutido continua valendo.
  if (mapped.length !== TEAMS.length) {
    console.warn(`standings: ${mapped.length} linhas no banco, esperado ${TEAMS.length}`);
    return null;
  }
  try {
    assertStandings(mapped);
  } catch (err) {
    console.warn(`standings do banco inconsistentes, usando snapshot: ${err.message}`);
    return null;
  }
  return mapped;
}

export async function handleBootstrap(request, env) {
  assertStandings();
  assertFixtures(FIXTURES, STANDINGS);

  const fromDb = await standingsFromDb(env).catch((err) => {
    console.warn(`falha ao ler standings do Supabase: ${err.message}`);
    return null;
  });

  const standings = fromDb ?? STANDINGS;

  return json(
    {
      season: SEASON,
      teams: TEAMS,
      standings,
      fixtures: FIXTURES,
      zones: ZONES,
      competitions: COMPETITIONS,
      meta: {
        lastRoundPlayed: LAST_ROUND_PLAYED,
        totalRounds: TOTAL_ROUNDS,
        remainingRounds: REMAINING_ROUNDS,
        roundDates: ROUND_DATES,
        deferredRound: DEFERRED_ROUND,
      },
      source: {
        standings: fromDb ? 'supabase' : 'snapshot',
        fixtures: 'snapshot',
      },
    },
    // A tabela só muda quando uma rodada termina; 5 min de cache na borda
    // evita bater no Supabase a cada visita.
    { headers: { 'cache-control': 'public, max-age=60, s-maxage=300' } },
  );
}
