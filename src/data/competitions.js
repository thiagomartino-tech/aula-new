/**
 * Quem ainda disputa as copas que mexem nas vagas da Libertadores. A interface
 * só oferece estes clubes nos seletores de título, e o Worker descarta o resto.
 *
 * É um retrato como `standings.js`: muda à mão quando uma fase termina. Veja
 * `.claude/skills/atualizar-classificacao/SKILL.md`. Fontes: reportagens de
 * outubro de 2026 (CBF, Conmebol, imprensa); confira antes de usar em algo sério.
 *
 * - `brazilian`: clubes brasileiros ainda na final. O adversário estrangeiro
 *   aparece em `foreign` só para a interface dizer "Fora do Brasil (Estudiantes)".
 * - `semifinals`: as chaves da Copa do Brasil. A final é entre o vencedor de cada
 *   chave, então campeão e vice nunca saem da mesma. Quando as semifinais
 *   acabarem, troque por uma chave de um clube só: [['palmeiras'], ['atletico-mg']].
 */
export const COMPETITIONS = {
  asOf: '2026-10-31',
  libertadores: {
    stage: 'final',
    date: '2026-11-28',
    brazilian: ['palmeiras'],
    foreign: 'Estudiantes',
  },
  sulamericana: {
    stage: 'final',
    date: '2026-11-21',
    brazilian: ['atletico-mg'],
    foreign: 'Boca Juniors',
  },
  copa: {
    stage: 'semifinais',
    date: '2026-12-06',
    semifinals: [
      ['palmeiras', 'vasco'],
      ['gremio', 'atletico-mg'],
    ],
  },
};

/** Lança se um id não for de um clube ou se as chaves da Copa se misturarem. */
export function assertCompetitions(competitions = COMPETITIONS, teamIds) {
  const known = new Set(teamIds);
  const ids = [
    ...competitions.libertadores.brazilian,
    ...competitions.sulamericana.brazilian,
    ...competitions.copa.semifinals.flat(),
  ];
  for (const id of ids) {
    if (!known.has(id)) throw new Error(`competitions: clube desconhecido "${id}"`);
  }
  const { semifinals } = competitions.copa;
  if (semifinals.length !== 2) {
    throw new Error(`competitions: a Copa tem ${semifinals.length} chaves, esperado 2`);
  }
  const flat = semifinals.flat();
  if (new Set(flat).size !== flat.length) {
    throw new Error('competitions: um clube aparece em duas chaves da Copa');
  }
}
