/**
 * Testes dos dados: a classificação e os jogos restantes precisam formar uma
 * temporada coerente. Rodar com `npm test`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { TEAMS } from '../src/data/teams.js';
import { STANDINGS, assertStandings } from '../src/data/standings.js';
import {
  FIXTURES,
  REMAINING_ROUNDS,
  assertFixtures,
} from '../src/data/fixtures.js';

test('são 20 clubes, com id e sigla únicos', () => {
  assert.equal(TEAMS.length, 20);
  assert.equal(new Set(TEAMS.map((t) => t.id)).size, 20);
  assert.equal(new Set(TEAMS.map((t) => t.abbr)).size, 20);
  for (const team of TEAMS) {
    assert.match(team.abbr, /^[A-Z]{3}$/, `sigla inválida: ${team.abbr}`);
  }
});

test('a classificação tem uma linha por clube', () => {
  assert.equal(STANDINGS.length, TEAMS.length);
  const ids = new Set(TEAMS.map((t) => t.id));
  for (const row of STANDINGS) {
    assert.ok(ids.has(row.teamId), `clube desconhecido: ${row.teamId}`);
  }
});

test('cada linha fecha: V+E+D = J e 3V+E = Pts', () => {
  assert.doesNotThrow(() => assertStandings());
});

test('gols pró e gols contra se anulam no total', () => {
  const gf = STANDINGS.reduce((acc, r) => acc + r.goalsFor, 0);
  const ga = STANDINGS.reduce((acc, r) => acc + r.goalsAgainst, 0);
  assert.equal(gf, ga, 'todo gol marcado por alguém foi sofrido por outro');
});

test('o total de jogos disputados é par', () => {
  const total = STANDINGS.reduce((acc, r) => acc + r.played, 0);
  assert.equal(total % 2, 0, 'cada jogo conta para dois clubes');
});

test('cada rodada restante tem 10 jogos e os 20 clubes', () => {
  assert.doesNotThrow(() => assertFixtures(FIXTURES, STANDINGS));
});

test('todo clube termina a temporada com 38 jogos', () => {
  for (const row of STANDINGS) {
    const ahead = FIXTURES.filter(
      (f) => f.home === row.teamId || f.away === row.teamId,
    ).length;
    assert.equal(
      row.played + ahead,
      38,
      `${row.teamId}: ${row.played} + ${ahead}`,
    );
  }
});

test('nenhum confronto se repete entre os jogos restantes', () => {
  const pairs = FIXTURES.map((f) => [f.home, f.away].sort().join('|'));
  assert.equal(new Set(pairs).size, pairs.length);
});

test('nenhum jogo é de um clube contra ele mesmo', () => {
  for (const f of FIXTURES) {
    assert.notEqual(f.home, f.away, f.id);
  }
});

test('os ids dos jogos são únicos', () => {
  const ids = FIXTURES.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('o jogo atrasado é de uma rodada anterior às que faltam', () => {
  const deferred = FIXTURES.filter((f) => f.deferred);
  assert.equal(deferred.length, 1, 'há exatamente um jogo atrasado');
  assert.ok(deferred[0].round < REMAINING_ROUNDS[0]);

  // Só os dois clubes com menos jogos disputados podem ter jogo atrasado.
  const behind = STANDINGS.filter((r) => r.played < 32).map((r) => r.teamId);
  assert.deepEqual(
    [deferred[0].home, deferred[0].away].sort(),
    [...behind].sort(),
  );
});
