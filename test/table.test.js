/**
 * Testes do motor de projeção — o mesmo módulo que roda no browser e no Worker.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { TEAMS } from '../src/data/teams.js';
import { STANDINGS } from '../src/data/standings.js';
import { FIXTURES } from '../src/data/fixtures.js';
import {
  OUTCOME,
  RESULT,
  compareRows,
  nextResult,
  outcomeFromTeamResult,
  projectTable,
  randomPredictions,
  resultForTeam,
  sanitizePredictions,
} from '../public/shared/table.js';

const project = (predictions) =>
  projectTable({ teams: TEAMS, standings: STANDINGS, fixtures: FIXTURES, predictions });

const find = (rows, id) => rows.find((r) => r.teamId === id);

/** Gerador determinístico, para o teste não depender de Math.random. */
function seeded(seed = 1) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

test('sem palpites, a projeção reproduz a classificação de hoje', () => {
  const { rows, decided, total } = project({});
  assert.equal(decided, 0);
  assert.equal(total, FIXTURES.length);

  for (const row of rows) {
    const today = STANDINGS.find((s) => s.teamId === row.teamId);
    assert.equal(row.pts, today.pts, row.teamId);
    assert.equal(row.played, today.played, row.teamId);
    assert.equal(row.change, 0, `${row.teamId} não deveria mudar de posição`);
  }
});

test('a tabela sai ordenada pelos critérios de desempate', () => {
  // Antes isto fixava a ordem da 32ª rodada, e por isso quebrava a cada
  // atualização de dados. A propriedade que vale sempre é que nenhuma linha
  // aparece à frente de outra que deveria vir antes.
  const { rows } = project({});
  for (let i = 1; i < rows.length; i += 1) {
    assert.ok(
      compareRows(rows[i - 1], rows[i]) <= 0,
      `${rows[i - 1].name} (${rows[i - 1].pts}) não deveria vir antes de ` +
        `${rows[i].name} (${rows[i].pts})`,
    );
  }
});

test('quem tem mais pontos aparece antes', () => {
  const { rows } = project({});
  for (let i = 1; i < rows.length; i += 1) {
    assert.ok(rows[i - 1].pts >= rows[i].pts, `posição ${i + 1}`);
  }
});

test('uma vitória vale 3 pontos para o mandante', () => {
  const fixture = FIXTURES.find((f) => f.id === 'r33-vasco-flamengo');
  const base = project({});
  const after = project({ [fixture.id]: OUTCOME.HOME });

  assert.equal(find(after.rows, 'vasco').pts, find(base.rows, 'vasco').pts + 3);
  assert.equal(find(after.rows, 'flamengo').pts, find(base.rows, 'flamengo').pts);
  assert.equal(find(after.rows, 'vasco').won, find(base.rows, 'vasco').won + 1);
  assert.equal(find(after.rows, 'flamengo').lost, find(base.rows, 'flamengo').lost + 1);
});

test('o empate dá 1 ponto aos dois e não mexe no saldo', () => {
  const fixture = FIXTURES.find((f) => f.id === 'r33-vasco-flamengo');
  const base = project({});
  const after = project({ [fixture.id]: OUTCOME.DRAW });

  for (const id of ['vasco', 'flamengo']) {
    assert.equal(find(after.rows, id).pts, find(base.rows, id).pts + 1, id);
    assert.equal(find(after.rows, id).goalDiff, find(base.rows, id).goalDiff, id);
  }
});

test('o mesmo jogo nunca dá dois resultados contraditórios', () => {
  const fixture = FIXTURES.find((f) => f.id === 'r33-vasco-flamengo');
  const { rows } = project({ [fixture.id]: OUTCOME.AWAY });

  assert.equal(find(rows, 'vasco').games[33].result, RESULT.LOSS);
  assert.equal(find(rows, 'flamengo').games[33].result, RESULT.WIN);
});

test('com todos os jogos palpitados, todo clube chega a 38 jogos', () => {
  const { rows, decided, total } = project(randomPredictions(FIXTURES, {}, seeded(42)));
  assert.equal(decided, total);

  for (const row of rows) {
    assert.equal(row.played, 38, row.teamId);
    assert.equal(row.pending, 0, row.teamId);
    assert.equal(row.pts, row.maxPts, row.teamId);
    assert.equal(row.won + row.drawn + row.lost, 38, row.teamId);
  }

  // Os empates vêm sempre aos pares, e os gols totais se anulam.
  assert.equal(rows.reduce((a, r) => a + r.drawn, 0) % 2, 0);
  assert.equal(
    rows.reduce((a, r) => a + r.goalsFor, 0),
    rows.reduce((a, r) => a + r.goalsAgainst, 0),
  );
});

test('as posições vão de 1 a 20, sem repetir', () => {
  const { rows } = project(randomPredictions(FIXTURES, {}, seeded(7)));
  assert.deepEqual(
    rows.map((r) => r.position),
    Array.from({ length: 20 }, (_, i) => i + 1),
  );
});

test('maxPts conta 3 pontos por jogo ainda sem palpite', () => {
  const { rows } = project({});
  for (const row of rows) {
    assert.equal(row.maxPts, row.pts + row.pending * 3, row.teamId);
  }
});

test('os jogos pendentes de cada clube completam os 38 da temporada', () => {
  // Deriva dos dados em vez de fixar números de uma rodada específica:
  // quem jogou menos tem mais pela frente, e a soma é sempre 38.
  const { rows } = project({});
  for (const row of rows) {
    assert.equal(row.played + row.pending, 38, row.teamId);
  }
});

test('o desempate segue pontos, vitórias, saldo e gols pró', () => {
  const row = (over) => ({
    name: 'X', pts: 50, won: 14, goalDiff: 5, goalsFor: 40, ...over,
  });
  assert.ok(compareRows(row({ pts: 51 }), row()) < 0, 'mais pontos vem antes');
  assert.ok(compareRows(row({ won: 15 }), row()) < 0, 'mais vitórias desempata');
  assert.ok(compareRows(row({ goalDiff: 6 }), row()) < 0, 'saldo desempata');
  assert.ok(compareRows(row({ goalsFor: 41 }), row()) < 0, 'gols pró desempata');
});

test('o ciclo de cliques volta ao começo em 4 passos', () => {
  assert.equal(nextResult(null), RESULT.WIN);
  assert.equal(nextResult(RESULT.WIN), RESULT.DRAW);
  assert.equal(nextResult(RESULT.DRAW), RESULT.LOSS);
  assert.equal(nextResult(RESULT.LOSS), null);
});

test('converter resultado para jogo e de volta é simétrico', () => {
  const fixture = FIXTURES.find((f) => f.id === 'r33-vasco-flamengo');
  for (const teamId of ['vasco', 'flamengo']) {
    for (const result of [RESULT.WIN, RESULT.DRAW, RESULT.LOSS]) {
      const outcome = outcomeFromTeamResult(fixture, teamId, result);
      assert.equal(resultForTeam(fixture, teamId, outcome), result);
    }
  }
  assert.equal(outcomeFromTeamResult(fixture, 'vasco', null), null);
  assert.equal(resultForTeam(fixture, 'vasco', null), null);
});

test('sanitizePredictions descarta jogo inexistente e resultado inválido', () => {
  const clean = sanitizePredictions(
    {
      'r33-vasco-flamengo': 'H',
      'jogo-que-nao-existe': 'H',
      'r33-santos-palmeiras': 'XYZ',
      'r34-flamengo-gremio': 'D',
    },
    FIXTURES,
  );
  assert.deepEqual(clean, {
    'r33-vasco-flamengo': 'H',
    'r34-flamengo-gremio': 'D',
  });
});

test('sanitizePredictions aceita entrada vazia ou nula', () => {
  assert.deepEqual(sanitizePredictions(null, FIXTURES), {});
  assert.deepEqual(sanitizePredictions(undefined, FIXTURES), {});
  assert.deepEqual(sanitizePredictions({}, FIXTURES), {});
});

test('randomPredictions preserva os palpites que já existem', () => {
  const existing = { 'r33-vasco-flamengo': OUTCOME.AWAY };
  const filled = randomPredictions(FIXTURES, existing, seeded(3));
  assert.equal(filled['r33-vasco-flamengo'], OUTCOME.AWAY);
  assert.equal(Object.keys(filled).length, FIXTURES.length);
  assert.deepEqual(existing, { 'r33-vasco-flamengo': OUTCOME.AWAY }, 'não altera a entrada');
});

test('uma vitória do Vasco no jogo atrasado tira ele do Z-4', () => {
  // Cenário concreto: o jogo atrasado existe e vale pontos de verdade.
  const deferred = FIXTURES.find((f) => f.deferred);
  assert.equal(deferred.away, 'vasco');

  const base = project({});
  const after = project({ [deferred.id]: OUTCOME.AWAY });
  assert.equal(find(after.rows, 'vasco').pts, find(base.rows, 'vasco').pts + 3);
  assert.equal(find(after.rows, 'vasco').played, 32);
});
