import test from 'node:test';
import assert from 'node:assert/strict';

import { ZONES } from '../src/data/standings.js';
import { TEAMS } from '../src/data/teams.js';
import { classify, qualificationFor, SCENARIOS } from '../public/shared/qualification.js';

const IDS = TEAMS.map((t) => t.id);

/** Tabela com `placed` nas posições pedidas e os demais clubes no resto. */
function orderWith(placed) {
  const fixed = new Map(Object.entries(placed).map(([team, pos]) => [pos - 1, team]));
  const rest = IDS.filter((id) => !(id in placed));
  return IDS.map((_, i) => fixed.get(i) ?? rest.shift());
}

const inZone = (q, zone) => [...q.zoneOf].filter(([, z]) => z === zone).map(([t]) => t);
const libertadores = (q) => [...inZone(q, 'libertadores'), ...inZone(q, 'libertadores-pre')];

test('sem títulos, as cores seguem as posições de ZONES', () => {
  const order = IDS;
  const { zoneOf } = qualificationFor(order, ZONES);
  order.forEach((team, i) => {
    const zone = ZONES.find((z) => i + 1 >= z.from && i + 1 <= z.to);
    const expected = zone && zone.id !== 'rebaixamento' ? zone.id : undefined;
    assert.equal(zoneOf.get(team), expected, `posição ${i + 1}`);
  });
});

test('as faixas de 2026 somam 5 vagas de Libertadores pela tabela', () => {
  const q = qualificationFor(IDS, ZONES);
  assert.equal(inZone(q, 'libertadores').length, 4);
  assert.equal(inZone(q, 'libertadores-pre').length, 1);
  assert.equal(inZone(q, 'sulamericana').length, 6);
});

test('cenário perfeito: o Brasil chega a 9 clubes, onde quer que os dois campeões estejam', () => {
  const { libertadores: lib, sulamericana: sula } = SCENARIOS.perfect;
  for (let a = 1; a <= 20; a += 1) {
    for (let b = 1; b <= 20; b += 1) {
      if (a === b) continue;
      const order = orderWith({ [lib]: a, [sula]: b });
      const q = qualificationFor(order, ZONES, SCENARIOS.perfect);
      assert.equal(libertadores(q).length, 9, `${lib} em ${a}º, ${sula} em ${b}º`);
    }
  }
});

test('cenário perfeito: quem tem título não ocupa vaga da tabela, e a vaga desce', () => {
  const { libertadores: lib, sulamericana: sula } = SCENARIOS.perfect;
  const order = orderWith({ [lib]: 2, [sula]: 7 });
  const q = qualificationFor(order, ZONES, SCENARIOS.perfect);

  assert.deepEqual([...q.viaTitle].sort(), [lib, sula].sort());

  // A tabela reparte 5 diretas e 2 prévias entre os outros 18 clubes.
  const others = order.filter((t) => t !== lib && t !== sula);
  const direct = inZone(q, 'libertadores').filter((t) => !q.viaTitle.has(t));
  const pre = inZone(q, 'libertadores-pre');
  assert.deepEqual(direct, others.slice(0, 5));
  assert.deepEqual(pre, others.slice(5, 7));
  assert.deepEqual(inZone(q, 'sulamericana'), others.slice(7, 13));
});

test('um clube nunca aparece em duas faixas nem é contado duas vezes', () => {
  const order = orderWith({ palmeiras: 1, 'atletico-mg': 2 });
  const q = qualificationFor(order, ZONES, SCENARIOS.perfect);
  assert.equal(new Set(q.zoneOf.keys()).size, q.zoneOf.size);
  assert.equal(libertadores(q).length, 9);
});

test('campeão da Copa na tabela: o vice herda a vaga direta', () => {
  const titles = { copaChampion: 'flamengo', copaRunnerUp: 'bahia' };
  const order = orderWith({ flamengo: 1, bahia: 9 });
  const q = qualificationFor(order, ZONES, titles);

  assert.equal(q.zoneOf.get('bahia'), 'libertadores');
  assert.ok(q.viaTitle.has('bahia'));
  assert.equal(libertadores(q).length, 7, 'sem título continental o Brasil tem 7 vagas');
  assert.equal(inZone(q, 'libertadores-pre').length, 2, 'a prévia do vice volta à tabela');
});

test('campeão e vice da Copa fora do topo: cada um fica com a sua vaga', () => {
  const titles = { copaChampion: 'bahia', copaRunnerUp: 'santos' };
  const order = orderWith({ bahia: 12, santos: 13 });
  const q = qualificationFor(order, ZONES, titles);

  assert.equal(q.zoneOf.get('bahia'), 'libertadores');
  assert.equal(q.zoneOf.get('santos'), 'libertadores-pre');
  assert.equal(libertadores(q).length, 7);
});

test('os dois finalistas da Copa já classificados: as duas vagas voltam à tabela', () => {
  const titles = { libertadores: 'palmeiras', copaChampion: 'palmeiras', copaRunnerUp: 'flamengo' };
  const order = orderWith({ palmeiras: 3, flamengo: 1 });
  const q = qualificationFor(order, ZONES, titles);

  // Palmeiras (título) + Flamengo (tabela) + as vagas restantes: 7 + 1 título = 8.
  assert.equal(libertadores(q).length, 8);
  assert.equal(q.zoneOf.get('flamengo'), 'libertadores');
});

test('rebaixamento vale por posição, mesmo para quem tem título', () => {
  const { sulamericana: sula } = SCENARIOS.perfect;
  const order = orderWith({ [sula]: 18 });
  const rows = order.map((teamId, i) => ({ teamId, position: i + 1 }));
  const got = classify(rows, ZONES, SCENARIOS.perfect).get(sula);

  assert.equal(got.zone, 'rebaixamento');
  assert.equal(got.viaTitle, true);
});

test('sem cenário, classify devolve a cor da posição e ninguém por título', () => {
  const rows = IDS.map((teamId, i) => ({ teamId, position: i + 1 }));
  const got = classify(rows, ZONES, null);
  assert.equal(got.get(IDS[0]).zone, 'libertadores');
  assert.equal(got.get(IDS[4]).zone, 'libertadores-pre');
  assert.equal(got.get(IDS[19]).zone, 'rebaixamento');
  assert.ok([...got.values()].every((v) => v.viaTitle === false));
});
