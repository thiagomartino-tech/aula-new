/**
 * Motor de projeção da tabela.
 *
 * Este módulo é puro (sem DOM, sem APIs de rede) e é usado nos dois lados:
 * o browser importa de /shared/table.js e o Worker importa o mesmo arquivo
 * por caminho relativo, então a conta dos pontos é literalmente a mesma
 * no cliente e no servidor.
 */

/** Resultado de um jogo, sempre do ponto de vista do mando de campo. */
export const OUTCOME = { HOME: 'H', DRAW: 'D', AWAY: 'A' };

/** Resultado do ponto de vista de um clube. */
export const RESULT = { WIN: 'V', DRAW: 'E', LOSS: 'D' };

/** Ciclo de cliques numa célula: sem palpite -> V -> E -> D -> sem palpite. */
export const RESULT_CYCLE = [null, RESULT.WIN, RESULT.DRAW, RESULT.LOSS];

/**
 * Placar assumido para um jogo simulado. O usuário escolhe só
 * vitória/empate/derrota, mas o saldo de gols é o 3º critério de desempate,
 * então um placar mínimo é assumido e informado na interface.
 */
export const ASSUMED_SCORE = { winner: 1, loser: 0, draw: 0 };

export function isHome(fixture, teamId) {
  return fixture.home === teamId;
}

export function opponentOf(fixture, teamId) {
  return isHome(fixture, teamId) ? fixture.away : fixture.home;
}

/** Converte o resultado do jogo para a ótica de um clube. */
export function resultForTeam(fixture, teamId, outcome) {
  if (!outcome) return null;
  if (outcome === OUTCOME.DRAW) return RESULT.DRAW;
  const homeWon = outcome === OUTCOME.HOME;
  return homeWon === isHome(fixture, teamId) ? RESULT.WIN : RESULT.LOSS;
}

/** Converte a ótica de um clube de volta para o resultado do jogo. */
export function outcomeFromTeamResult(fixture, teamId, result) {
  if (!result) return null;
  if (result === RESULT.DRAW) return OUTCOME.DRAW;
  const teamIsHome = isHome(fixture, teamId);
  const teamWon = result === RESULT.WIN;
  return teamWon === teamIsHome ? OUTCOME.HOME : OUTCOME.AWAY;
}

/** Próximo resultado no ciclo de cliques. */
export function nextResult(current) {
  const i = RESULT_CYCLE.indexOf(current ?? null);
  return RESULT_CYCLE[(i + 1) % RESULT_CYCLE.length];
}

/**
 * Critérios de desempate do Brasileirão, na ordem do regulamento: pontos,
 * vitórias, saldo de gols, gols pró. Os critérios seguintes (confronto
 * direto, cartões, sorteio) não são aplicados aqui; em caso de empate total
 * a ordem cai no nome do clube só para a tabela ficar estável.
 */
export function compareRows(a, b) {
  return (
    b.pts - a.pts ||
    b.won - a.won ||
    b.goalDiff - a.goalDiff ||
    b.goalsFor - a.goalsFor ||
    a.name.localeCompare(b.name, 'pt-BR')
  );
}

/**
 * Projeta a tabela final a partir do snapshot + palpites.
 *
 * @param {object} args
 * @param {Array}  args.teams      clubes (id, name, abbr, color)
 * @param {Array}  args.standings  classificação atual
 * @param {Array}  args.fixtures   jogos restantes
 * @param {object} args.predictions mapa fixtureId -> 'H' | 'D' | 'A'
 * @returns {{rows: Array, decided: number, total: number}}
 */
export function projectTable({ teams, standings, fixtures, predictions = {} }) {
  const byId = new Map();

  for (const team of teams) {
    const current = standings.find((s) => s.teamId === team.id);
    if (!current) throw new Error(`Sem classificação para ${team.id}`);
    byId.set(team.id, {
      teamId: team.id,
      name: team.name,
      abbr: team.abbr,
      color: team.color,
      color2: team.color2,
      // Posição e pontos de hoje, para mostrar a variação da simulação.
      currentPts: current.pts,
      // Acumuladores projetados, começando do que já aconteceu.
      played: current.played,
      won: current.won,
      drawn: current.drawn,
      lost: current.lost,
      goalsFor: current.goalsFor,
      goalsAgainst: current.goalsAgainst,
      // Quantos jogos restantes ainda não têm palpite.
      pending: 0,
      games: {},
    });
  }

  let decided = 0;

  for (const fixture of fixtures) {
    const home = byId.get(fixture.home);
    const away = byId.get(fixture.away);
    if (!home || !away) throw new Error(`Jogo com clube desconhecido: ${fixture.id}`);

    const outcome = predictions[fixture.id] ?? null;
    if (outcome) decided += 1;

    for (const [row, team] of [[home, fixture.home], [away, fixture.away]]) {
      row.games[fixture.round] = {
        fixtureId: fixture.id,
        opponent: opponentOf(fixture, team),
        home: isHome(fixture, team),
        deferred: fixture.deferred,
        date: fixture.date,
        result: resultForTeam(fixture, team, outcome),
      };
    }

    if (!outcome) {
      home.pending += 1;
      away.pending += 1;
      continue;
    }

    home.played += 1;
    away.played += 1;

    const { winner, loser, draw } = ASSUMED_SCORE;

    if (outcome === OUTCOME.DRAW) {
      home.drawn += 1;
      away.drawn += 1;
      home.goalsFor += draw;
      away.goalsFor += draw;
      home.goalsAgainst += draw;
      away.goalsAgainst += draw;
    } else {
      const [win, loss] = outcome === OUTCOME.HOME ? [home, away] : [away, home];
      win.won += 1;
      loss.lost += 1;
      win.goalsFor += winner;
      win.goalsAgainst += loser;
      loss.goalsFor += loser;
      loss.goalsAgainst += winner;
    }
  }

  const rows = [...byId.values()].map((row) => {
    const pts = row.won * 3 + row.drawn;
    return {
      ...row,
      pts,
      goalDiff: row.goalsFor - row.goalsAgainst,
      // Teto e piso de pontos se todos os jogos sem palpite fossem vitória
      // ou derrota — mostra quanto a simulação ainda pode mudar.
      maxPts: pts + row.pending * 3,
      minPts: pts,
    };
  });

  rows.sort(compareRows);
  rows.forEach((row, i) => {
    row.position = i + 1;
  });

  // Posição de hoje, para a seta de variação na interface.
  const today = [...rows]
    .map((r) => ({ teamId: r.teamId, ...standings.find((s) => s.teamId === r.teamId), name: r.name }))
    .map((r) => ({ ...r, pts: r.pts, goalDiff: r.goalsFor - r.goalsAgainst }))
    .sort(compareRows);
  const todayPosition = new Map(today.map((r, i) => [r.teamId, i + 1]));
  for (const row of rows) {
    row.currentPosition = todayPosition.get(row.teamId);
    row.change = row.currentPosition - row.position;
  }

  return { rows, decided, total: fixtures.length };
}

/** Palpite aleatório para todos os jogos sem resultado definido. */
export function randomPredictions(fixtures, existing = {}, rand = Math.random) {
  const out = { ...existing };
  for (const fixture of fixtures) {
    if (out[fixture.id]) continue;
    const roll = rand();
    out[fixture.id] = roll < 0.42 ? OUTCOME.HOME : roll < 0.70 ? OUTCOME.DRAW : OUTCOME.AWAY;
  }
  return out;
}

/** Remove palpites que não correspondem a nenhum jogo restante. */
export function sanitizePredictions(predictions, fixtures) {
  const valid = new Set(fixtures.map((f) => f.id));
  const allowed = new Set(Object.values(OUTCOME));
  const out = {};
  for (const [id, outcome] of Object.entries(predictions ?? {})) {
    if (valid.has(id) && allowed.has(outcome)) out[id] = outcome;
  }
  return out;
}
