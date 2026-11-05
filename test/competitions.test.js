import test from 'node:test';
import assert from 'node:assert/strict';

import { COMPETITIONS, assertCompetitions } from '../src/data/competitions.js';
import { ZONES } from '../src/data/standings.js';
import { TEAMS } from '../src/data/teams.js';
import {
  SCENARIOS,
  allowedTitles,
  classify,
  qualificationFor,
  sanitizeTitles,
} from '../public/shared/qualification.js';

const IDS = TEAMS.map((t) => t.id);
const copy = (obj) => JSON.parse(JSON.stringify(obj));

/** Tabela com `placed` nas posições pedidas e os demais clubes no resto. */
function orderWith(placed) {
  const fixed = new Map(Object.entries(placed).map(([team, pos]) => [pos - 1, team]));
  const rest = IDS.filter((id) => !(id in placed));
  return IDS.map((_, i) => fixed.get(i) ?? rest.shift());
}

test('os dados de COMPETITIONS são coerentes com os clubes', () => {
  assertCompetitions(COMPETITIONS, IDS);
});

test('assertCompetitions acusa clube desconhecido e chaves misturadas', () => {
  const unknown = copy(COMPETITIONS);
  unknown.libertadores.brazilian = ['clube-inventado'];
  assert.throws(() => assertCompetitions(unknown, IDS), /clube desconhecido/);

  const crossed = copy(COMPETITIONS);
  crossed.copa.semifinals = [['palmeiras', 'vasco'], ['vasco', 'gremio']];
  assert.throws(() => assertCompetitions(crossed, IDS), /duas chaves/);

  const oneBracket = copy(COMPETITIONS);
  oneBracket.copa.semifinals = [['palmeiras']];
  assert.throws(() => assertCompetitions(oneBracket, IDS), /esperado 2/);
});

test('cada seletor oferece só quem ainda disputa', () => {
  const allowed = allowedTitles(COMPETITIONS);
  assert.deepEqual(allowed.libertadores, ['palmeiras']);
  assert.deepEqual(allowed.sulamericana, ['atletico-mg']);
  assert.deepEqual([...allowed.copaChampion].sort(), ['atletico-mg', 'gremio', 'palmeiras', 'vasco']);
  assert.deepEqual([...allowed.copaRunnerUp].sort(), ['atletico-mg', 'gremio', 'palmeiras', 'vasco']);
});

test('na Copa, campeão e vice vêm de chaves diferentes', () => {
  const afterChamp = allowedTitles(COMPETITIONS, { copaChampion: 'palmeiras' });
  assert.deepEqual([...afterChamp.copaRunnerUp].sort(), ['atletico-mg', 'gremio']);

  const afterVice = allowedTitles(COMPETITIONS, { copaRunnerUp: 'atletico-mg' });
  assert.deepEqual([...afterVice.copaChampion].sort(), ['palmeiras', 'vasco']);
});

test('sanitizeTitles com COMPETITIONS descarta quem não disputa mais', () => {
  assert.deepEqual(sanitizeTitles(SCENARIOS.perfect, IDS, COMPETITIONS), SCENARIOS.perfect);

  const got = sanitizeTitles(
    { libertadores: 'flamengo', sulamericana: 'palmeiras', copaChampion: 'bahia', copaRunnerUp: 'santos' },
    IDS,
    COMPETITIONS,
  );
  assert.equal(got, null, 'nenhum deles disputa a copa em que foi escolhido');
});

test('sanitizeTitles descarta o vice que está na chave do campeão', () => {
  const got = sanitizeTitles({ copaChampion: 'palmeiras', copaRunnerUp: 'vasco' }, IDS, COMPETITIONS);
  assert.equal(got.copaChampion, 'palmeiras');
  assert.equal(got.copaRunnerUp, null);
});

test('sem COMPETITIONS qualquer clube vale (o motor não depende dos dados do ano)', () => {
  const got = sanitizeTitles({ libertadores: 'flamengo' }, IDS);
  assert.equal(got.libertadores, 'flamengo');
});

test('o cenário perfeito segue possível com os dados de hoje, e deixa de ser sem o Palmeiras na Copa', () => {
  assert.deepEqual(sanitizeTitles(SCENARIOS.perfect, IDS, COMPETITIONS), SCENARIOS.perfect);

  const eliminated = copy(COMPETITIONS);
  eliminated.copa.semifinals = [['vasco'], ['atletico-mg']];
  const got = sanitizeTitles(SCENARIOS.perfect, IDS, eliminated);
  assert.notDeepEqual(got, SCENARIOS.perfect);
  assert.equal(got.copaChampion, null);
});

/* ---------------------------------------- as vagas que a tabela distribui */

test('sem títulos a tabela distribui 4 diretas e 1 prévia', () => {
  assert.deepEqual(qualificationFor(IDS, ZONES).slots, { direct: 4, pre: 1 });
});

test('cenário perfeito: a tabela ganha 1 vaga direta e 1 de prévia', () => {
  const q = qualificationFor(orderWith({ palmeiras: 2, 'atletico-mg': 7 }), ZONES, SCENARIOS.perfect);
  assert.deepEqual(q.slots, { direct: 5, pre: 2 });
});

test('o vice da Copa que já tem vaga por outro caminho libera a prévia para a tabela', () => {
  // Atlético é vice da Copa e também campeão da Sul-Americana: não usa a vaga
  // da prévia da Copa, e ela vai para o próximo da tabela.
  const withVice = qualificationFor(IDS, ZONES, {
    sulamericana: 'atletico-mg', copaChampion: 'palmeiras', copaRunnerUp: 'atletico-mg',
  });
  const withoutVice = qualificationFor(IDS, ZONES, {
    sulamericana: 'atletico-mg', copaChampion: 'palmeiras',
  });
  assert.equal(withVice.slots.pre, withoutVice.slots.pre + 1);
});

test('classify informa as vagas da tabela junto com as cores', () => {
  const rows = IDS.map((teamId, i) => ({ teamId, position: i + 1 }));
  assert.deepEqual(classify(rows, ZONES, null).slots, { direct: 4, pre: 1 });
  assert.deepEqual(
    classify(rows, ZONES, SCENARIOS.perfect).slots,
    qualificationFor(IDS, ZONES, SCENARIOS.perfect).slots,
  );
});
