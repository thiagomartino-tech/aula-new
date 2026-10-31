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
  fillRemaining,
  resultForTeam,
  sanitizePredictions,
} from '../public/shared/table.js';

const project = (predictions) =>
  projectTable({ teams: TEAMS, standings: STANDINGS, fixtures: FIXTURES, predictions });

const find = (rows, id) => rows.find((r) => r.teamId === id);

// Qualquer jogo que ainda falta (fora o atrasado). Os testes não devem nomear
// um jogo específico: ele sai de FIXTURES no dia em que for disputado.
const sample = () => FIXTURES.find((f) => !f.deferred);

/**
 * Palpites variados e determinísticos: alterna vitória do mandante, empate e
 * vitória do visitante. Exercita os três resultados sem depender de sorteio,
 * então uma falha aqui é sempre reproduzível.
 */
function mixed(fixtures) {
  const cycle = [OUTCOME.HOME, OUTCOME.DRAW, OUTCOME.AWAY];
  return Object.fromEntries(fixtures.map((f, i) => [f.id, cycle[i % 3]]));
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
  const fixture = sample();
  const base = project({});
  const after = project({ [fixture.id]: OUTCOME.HOME });
  const { home, away } = fixture;

  assert.equal(find(after.rows, home).pts, find(base.rows, home).pts + 3);
  assert.equal(find(after.rows, away).pts, find(base.rows, away).pts);
  assert.equal(find(after.rows, home).won, find(base.rows, home).won + 1);
  assert.equal(find(after.rows, away).lost, find(base.rows, away).lost + 1);
});

test('o empate dá 1 ponto aos dois e não mexe no saldo', () => {
  const fixture = sample();
  const base = project({});
  const after = project({ [fixture.id]: OUTCOME.DRAW });

  for (const id of [fixture.home, fixture.away]) {
    assert.equal(find(after.rows, id).pts, find(base.rows, id).pts + 1, id);
    assert.equal(find(after.rows, id).goalDiff, find(base.rows, id).goalDiff, id);
  }
});

test('o mesmo jogo nunca dá dois resultados contraditórios', () => {
  const fixture = sample();
  const { rows } = project({ [fixture.id]: OUTCOME.AWAY });

  assert.equal(find(rows, fixture.home).games[fixture.round].result, RESULT.LOSS);
  assert.equal(find(rows, fixture.away).games[fixture.round].result, RESULT.WIN);
});

test('com todos os jogos palpitados, todo clube chega a 38 jogos', () => {
  const { rows, decided, total } = project(mixed(FIXTURES));
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
  const { rows } = project(mixed(FIXTURES));
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
  const fixture = sample();
  for (const teamId of [fixture.home, fixture.away]) {
    for (const result of [RESULT.WIN, RESULT.DRAW, RESULT.LOSS]) {
      const outcome = outcomeFromTeamResult(fixture, teamId, result);
      assert.equal(resultForTeam(fixture, teamId, outcome), result);
    }
  }
  assert.equal(outcomeFromTeamResult(fixture, fixture.home, null), null);
  assert.equal(resultForTeam(fixture, fixture.home, null), null);
});

test('sanitizePredictions descarta jogo inexistente e resultado inválido', () => {
  const [a, b, c] = FIXTURES;
  const clean = sanitizePredictions(
    {
      [a.id]: 'H',
      'jogo-que-nao-existe': 'H',
      [b.id]: 'XYZ',
      [c.id]: 'D',
    },
    FIXTURES,
  );
  assert.deepEqual(clean, { [a.id]: 'H', [c.id]: 'D' });
});

test('sanitizePredictions aceita entrada vazia ou nula', () => {
  assert.deepEqual(sanitizePredictions(null, FIXTURES), {});
  assert.deepEqual(sanitizePredictions(undefined, FIXTURES), {});
  assert.deepEqual(sanitizePredictions({}, FIXTURES), {});
});

test('fillRemaining preserva os palpites que já existem', () => {
  // O botão só completa o que falta: um palpite feito à mão sobrevive.
  const id = sample().id;
  const existing = { [id]: OUTCOME.AWAY };
  const filled = fillRemaining(FIXTURES, existing, OUTCOME.HOME);
  assert.equal(filled[id], OUTCOME.AWAY);
  assert.equal(Object.keys(filled).length, FIXTURES.length);
  assert.deepEqual(existing, { [id]: OUTCOME.AWAY }, 'não altera a entrada');
});

test('fillRemaining com vitória do mandante não gera empate nem derrota fora', () => {
  const filled = fillRemaining(FIXTURES, {}, OUTCOME.HOME);
  assert.ok(Object.values(filled).every((o) => o === OUTCOME.HOME));

  const { rows } = project(filled);
  // Todo mandante vence, então ninguém empata nos jogos que faltavam.
  const empatesAntes = STANDINGS.reduce((a, r) => a + r.drawn, 0);
  assert.equal(rows.reduce((a, r) => a + r.drawn, 0), empatesAntes);
});

test('o jogo atrasado vale pontos de verdade e conta como jogo a mais', () => {
  const deferred = FIXTURES.find((f) => f.deferred);
  assert.ok(deferred, 'a temporada tem um jogo atrasado');

  const base = project({});
  const after = project({ [deferred.id]: OUTCOME.AWAY });
  const team = find(after.rows, deferred.away);
  assert.equal(team.pts, find(base.rows, deferred.away).pts + 3);
  assert.equal(team.played, find(base.rows, deferred.away).played + 1);
});
