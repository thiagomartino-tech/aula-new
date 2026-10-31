/**
 * Quem vai à Libertadores, e em que fase, a partir da tabela e dos títulos.
 *
 * Roda no navegador e no Worker, como o resto de `shared/`: a tela e a análise
 * da IA usam as mesmas cores porque usam este mesmo código.
 *
 * As regras (CBF e Conmebol, Libertadores 2027):
 *
 * - O Brasil tem 7 vagas: 4 do Brasileirão direto na fase de grupos, 1 do
 *   Brasileirão na fase prévia, o campeão da Copa do Brasil direto e o vice na
 *   fase prévia.
 * - O campeão da Libertadores e o da Sul-Americana ganham vaga direta *além*
 *   dessas 7. Se os dois forem brasileiros, o Brasil chega a 9 vagas.
 * - Quem já tem vaga por outro caminho não ocupa a do Brasileirão: a vaga
 *   passa ao próximo da tabela. Um clube só ocupa uma vaga.
 * - Se o campeão da Copa do Brasil já tem vaga direta, o vice herda a direta.
 *   A vaga da Copa que sobrar volta ao Brasileirão.
 *
 * Não modelado: clube classificado por título que cai para a Série B (a vaga
 * seria redistribuída) e campeões de fora do Brasil.
 */

/** Cenários prontos que o botão da interface liga. */
export const SCENARIOS = {
  perfect: {
    id: 'perfect',
    libertadores: 'palmeiras',
    sulamericana: 'atletico-mg',
    copaChampion: 'palmeiras',
    copaRunnerUp: 'atletico-mg',
    summary:
      'Palmeiras win the Libertadores and the Copa do Brasil; ' +
      'Atlético-MG win the Sul-Americana and are the Copa do Brasil runners-up',
  },
};

const DIRECT = 'libertadores';
const PRE = 'libertadores-pre';
const SULA = 'sulamericana';

const spanOf = (zones, id) => {
  const zone = zones.find((z) => z.id === id);
  return zone ? zone.to - zone.from + 1 : 0;
};

/**
 * @param {string[]} order  clubes por posição, do 1º ao último
 * @param {Array} zones     ZONES: de onde saem os tamanhos das faixas
 * @param {object|null} titles  um cenário de SCENARIOS, ou null para a tabela pura
 * @returns {{ zoneOf: Map<string,string>, viaTitle: Set<string> }}
 */
export function qualificationFor(order, zones, titles = null) {
  const base = {
    direct: spanOf(zones, DIRECT),
    pre: spanOf(zones, PRE),
    sula: spanOf(zones, SULA),
  };
  const zoneOf = new Map();
  const viaTitle = new Set();
  const place = (team, zone) => {
    zoneOf.set(team, zone);
    viaTitle.add(team);
  };

  let leagueDirect = base.direct;
  let leaguePre = base.pre;

  if (titles) {
    // 1. Campeões continentais: vaga direta, fora da cota do país.
    for (const team of [titles.libertadores, titles.sulamericana]) {
      if (team) place(team, DIRECT);
    }

    // 2. Copa do Brasil. "Já tem vaga direta" vale para quem ganhou título
    // continental ou está entre os que o Brasileirão manda direto.
    const leagueTop = new Set(
      order.filter((t) => !viaTitle.has(t)).slice(0, base.direct),
    );
    const hasDirect = (team) => viaTitle.has(team) || leagueTop.has(team);
    const champ = titles.copaChampion;
    const vice = titles.copaRunnerUp;

    let copaDirectFree = false;
    let copaPreFree = false;
    if (champ) {
      if (hasDirect(champ)) copaDirectFree = true;
      else place(champ, DIRECT);
    }
    if (vice) {
      if (hasDirect(vice)) copaPreFree = true;
      else if (copaDirectFree) {
        place(vice, DIRECT);
        copaDirectFree = false;
        copaPreFree = true;
      } else place(vice, PRE);
    }

    // 3. O que sobrou da Copa do Brasil volta ao Brasileirão.
    if (copaDirectFree) leagueDirect += 1;
    if (copaPreFree) leaguePre += 1;
  }

  // 4. O Brasileirão reparte o que resta, pulando quem já tem vaga.
  const eligible = order.filter((t) => !viaTitle.has(t));
  const split = [leagueDirect, leagueDirect + leaguePre];
  eligible.slice(0, split[0]).forEach((t) => zoneOf.set(t, DIRECT));
  eligible.slice(split[0], split[1]).forEach((t) => zoneOf.set(t, PRE));
  eligible.slice(split[1], split[1] + base.sula).forEach((t) => zoneOf.set(t, SULA));

  return { zoneOf, viaTitle };
}

/**
 * Cor de cada clube da tabela projetada. O rebaixamento é sempre por posição e
 * vence qualquer vaga: um campeão que cai continua aparecendo como caído.
 *
 * @returns {Map<string, { zone: string|null, viaTitle: boolean }>}
 */
export function classify(rows, zones, scenario = null) {
  const sorted = [...rows].sort((a, b) => a.position - b.position);
  const { zoneOf, viaTitle } = qualificationFor(
    sorted.map((r) => r.teamId),
    zones,
    scenario,
  );
  const out = new Map();
  for (const row of sorted) {
    const drop = zones.find(
      (z) => z.id === 'rebaixamento' && row.position >= z.from && row.position <= z.to,
    );
    out.set(row.teamId, {
      zone: drop ? drop.id : (zoneOf.get(row.teamId) ?? null),
      viaTitle: viaTitle.has(row.teamId),
    });
  }
  return out;
}
