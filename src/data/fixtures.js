/**
 * Os jogos que faltam no Brasileirão Série A 2026: as rodadas 33 a 38, mais
 * o jogo atrasado da 21ª rodada entre Chapecoense e Vasco.
 *
 * `home`/`away` são ids de src/data/teams.js. `date` é a data da tabela
 * básica da CBF — a própria CBF avisa que dias e horários ainda podem mudar.
 *
 * O jogo atrasado entra com `round: 21` e `deferred: true` para que Vasco e
 * Chapecoense cheguem aos mesmos 38 jogos dos outros clubes na simulação.
 */
export const DEFERRED_ROUND = 21;

/** As 6 rodadas que a tabela do simulador mostra em colunas. */
export const REMAINING_ROUNDS = [33, 34, 35, 36, 37, 38];

export const ROUND_DATES = {
  33: '28–31/10',
  34: '02–04/11',
  35: '18–19/11',
  36: '21–23/11',
  37: '28–29/11',
  38: '02/12',
};

export const FIXTURES = [
  // --- Jogo atrasado da 21ª rodada (adiado pelos playoffs da Sul-Americana).
  // Arena Condá; a CBF ainda não divulgou a data, prevista para novembro.
  { round: 21, deferred: true, date: null, home: 'chapecoense', away: 'vasco' },

  // --- 33ª rodada ---------------------------------------------------------
  { round: 33, home: 'fluminense',   away: 'internacional' },
  { round: 33, home: 'santos',       away: 'palmeiras' },
  { round: 33, home: 'bragantino',   away: 'chapecoense' },
  { round: 33, home: 'remo',         away: 'botafogo' },
  { round: 33, home: 'bahia',        away: 'sao-paulo' },
  { round: 33, home: 'atletico-mg',  away: 'cruzeiro' },
  { round: 33, home: 'vasco',        away: 'flamengo' },
  { round: 33, home: 'gremio',       away: 'athletico-pr' },
  { round: 33, home: 'corinthians',  away: 'mirassol' },
  { round: 33, home: 'coritiba',     away: 'vitoria' },

  // --- 34ª rodada ---------------------------------------------------------
  { round: 34, home: 'bragantino',   away: 'santos' },
  { round: 34, home: 'chapecoense',  away: 'mirassol' },
  { round: 34, home: 'internacional', away: 'coritiba' },
  { round: 34, home: 'sao-paulo',    away: 'corinthians' },
  { round: 34, home: 'flamengo',     away: 'gremio' },
  { round: 34, home: 'athletico-pr', away: 'vasco' },
  { round: 34, home: 'botafogo',     away: 'atletico-mg' },
  { round: 34, home: 'palmeiras',    away: 'remo' },
  { round: 34, home: 'cruzeiro',     away: 'bahia' },
  { round: 34, home: 'vitoria',      away: 'fluminense' },

  // --- 35ª rodada ---------------------------------------------------------
  { round: 35, home: 'vasco',        away: 'internacional' },
  { round: 35, home: 'flamengo',     away: 'athletico-pr' },
  { round: 35, home: 'sao-paulo',    away: 'fluminense' },
  { round: 35, home: 'corinthians',  away: 'botafogo' },
  { round: 35, home: 'mirassol',     away: 'atletico-mg' },
  { round: 35, home: 'cruzeiro',     away: 'palmeiras' },
  { round: 35, home: 'gremio',       away: 'bahia' },
  { round: 35, home: 'coritiba',     away: 'santos' },
  { round: 35, home: 'vitoria',      away: 'bragantino' },
  { round: 35, home: 'remo',         away: 'chapecoense' },

  // --- 36ª rodada ---------------------------------------------------------
  { round: 36, home: 'atletico-mg',  away: 'corinthians' },
  { round: 36, home: 'athletico-pr', away: 'remo' },
  { round: 36, home: 'bahia',        away: 'coritiba' },
  { round: 36, home: 'botafogo',     away: 'sao-paulo' },
  { round: 36, home: 'chapecoense',  away: 'cruzeiro' },
  { round: 36, home: 'fluminense',   away: 'mirassol' },
  { round: 36, home: 'internacional', away: 'vitoria' },
  { round: 36, home: 'palmeiras',    away: 'flamengo' },
  { round: 36, home: 'bragantino',   away: 'vasco' },
  { round: 36, home: 'santos',       away: 'gremio' },

  // --- 37ª rodada ---------------------------------------------------------
  { round: 37, home: 'atletico-mg',  away: 'vasco' },
  { round: 37, home: 'botafogo',     away: 'bahia' },
  { round: 37, home: 'chapecoense',  away: 'palmeiras' },
  { round: 37, home: 'corinthians',  away: 'gremio' },
  { round: 37, home: 'coritiba',     away: 'flamengo' },
  { round: 37, home: 'fluminense',   away: 'cruzeiro' },
  { round: 37, home: 'internacional', away: 'bragantino' },
  { round: 37, home: 'mirassol',     away: 'athletico-pr' },
  { round: 37, home: 'sao-paulo',    away: 'remo' },
  { round: 37, home: 'vitoria',      away: 'santos' },

  // --- 38ª rodada ---------------------------------------------------------
  { round: 38, home: 'flamengo',     away: 'chapecoense' },
  { round: 38, home: 'vasco',        away: 'vitoria' },
  { round: 38, home: 'santos',       away: 'botafogo' },
  { round: 38, home: 'palmeiras',    away: 'coritiba' },
  { round: 38, home: 'bragantino',   away: 'fluminense' },
  { round: 38, home: 'cruzeiro',     away: 'internacional' },
  { round: 38, home: 'gremio',       away: 'mirassol' },
  { round: 38, home: 'athletico-pr', away: 'sao-paulo' },
  { round: 38, home: 'bahia',        away: 'atletico-mg' },
  { round: 38, home: 'remo',         away: 'corinthians' },
].map((f) => ({
  ...f,
  // Id estável: usado como chave do palpite no localStorage e no Supabase.
  id: `r${f.round}-${f.home}-${f.away}`,
  date: f.date ?? ROUND_DATES[f.round] ?? null,
  deferred: f.deferred ?? false,
}));

/** Todos os jogos de uma rodada. */
export function fixturesForRound(round) {
  return FIXTURES.filter((f) => f.round === round);
}

/**
 * Throws if the fixture list is not a valid remainder of the season: every
 * listed round must cover all 20 clubs exactly once, and every club must end
 * the season on 38 games.
 */
export function assertFixtures(fixtures = FIXTURES, standings) {
  for (const round of REMAINING_ROUNDS) {
    const games = fixtures.filter((f) => f.round === round);
    if (games.length !== 10) {
      throw new Error(`Rodada ${round}: ${games.length} jogos, esperado 10`);
    }
    const seen = new Set();
    for (const g of games) {
      for (const id of [g.home, g.away]) {
        if (seen.has(id)) throw new Error(`Rodada ${round}: ${id} aparece 2x`);
        seen.add(id);
      }
    }
    if (seen.size !== 20) {
      throw new Error(`Rodada ${round}: ${seen.size} clubes, esperado 20`);
    }
  }

  if (standings) {
    for (const row of standings) {
      const ahead = fixtures.filter(
        (f) => f.home === row.teamId || f.away === row.teamId,
      ).length;
      if (row.played + ahead !== 38) {
        throw new Error(
          `${row.teamId}: ${row.played} jogados + ${ahead} restantes != 38`,
        );
      }
    }
  }
  return fixtures;
}
