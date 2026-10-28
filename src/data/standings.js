/**
 * Classificação do Brasileirão Série A 2026 após a 32ª rodada.
 *
 * Snapshot coletado em 28/10/2026. A fonte pretendida era a tabela do
 * ge.globo.com; o domínio está bloqueado na rede desta sessão, então os
 * números vieem de agregadores que publicam a mesma tabela (SoFutebol,
 * O Tempo, Diário Celeste) — veja README.md > "Fonte dos dados".
 *
 * Vasco e Chapecoense têm 31 jogos: o confronto entre os dois, da 21ª
 * rodada, foi adiado e ainda não tem data definida (ver fixtures.js).
 *
 * pts é redundante (3*w + d) e fica aqui só para conferência contra a fonte;
 * `assertStandings()` valida a consistência de todas as linhas.
 */
export const LAST_ROUND_PLAYED = 32;
export const TOTAL_ROUNDS = 38;

export const STANDINGS = [
  { teamId: 'flamengo',      played: 32, won: 21, drawn:  7, lost:  4, goalsFor: 64, goalsAgainst: 27, pts: 70 },
  { teamId: 'palmeiras',     played: 32, won: 20, drawn:  9, lost:  3, goalsFor: 56, goalsAgainst: 22, pts: 69 },
  { teamId: 'cruzeiro',      played: 32, won: 16, drawn:  6, lost: 10, goalsFor: 51, goalsAgainst: 46, pts: 54 },
  { teamId: 'athletico-pr',  played: 32, won: 15, drawn:  9, lost:  8, goalsFor: 50, goalsAgainst: 38, pts: 54 },
  { teamId: 'fluminense',    played: 32, won: 14, drawn:  9, lost:  9, goalsFor: 50, goalsAgainst: 41, pts: 51 },
  { teamId: 'atletico-mg',   played: 32, won: 14, drawn:  8, lost: 10, goalsFor: 44, goalsAgainst: 38, pts: 50 },
  { teamId: 'bahia',         played: 32, won: 13, drawn: 11, lost:  8, goalsFor: 45, goalsAgainst: 40, pts: 50 },
  { teamId: 'santos',        played: 32, won: 12, drawn: 10, lost: 10, goalsFor: 49, goalsAgainst: 47, pts: 46 },
  { teamId: 'sao-paulo',     played: 32, won: 12, drawn:  7, lost: 13, goalsFor: 37, goalsAgainst: 36, pts: 43 },
  { teamId: 'bragantino',    played: 32, won: 11, drawn:  8, lost: 13, goalsFor: 39, goalsAgainst: 38, pts: 41 },
  { teamId: 'botafogo',      played: 32, won: 10, drawn:  9, lost: 13, goalsFor: 44, goalsAgainst: 51, pts: 39 },
  { teamId: 'coritiba',      played: 32, won: 10, drawn:  9, lost: 13, goalsFor: 38, goalsAgainst: 50, pts: 39 },
  { teamId: 'vasco',         played: 31, won: 10, drawn:  8, lost: 13, goalsFor: 39, goalsAgainst: 45, pts: 38 },
  { teamId: 'vitoria',       played: 32, won: 10, drawn:  8, lost: 14, goalsFor: 35, goalsAgainst: 46, pts: 38 },
  { teamId: 'mirassol',      played: 32, won:  9, drawn: 10, lost: 13, goalsFor: 37, goalsAgainst: 45, pts: 37 },
  { teamId: 'internacional', played: 32, won:  8, drawn: 11, lost: 13, goalsFor: 36, goalsAgainst: 40, pts: 35 },
  { teamId: 'gremio',        played: 32, won:  8, drawn: 10, lost: 14, goalsFor: 35, goalsAgainst: 44, pts: 34 },
  { teamId: 'corinthians',   played: 32, won:  8, drawn:  9, lost: 15, goalsFor: 34, goalsAgainst: 42, pts: 33 },
  { teamId: 'remo',          played: 32, won:  5, drawn: 11, lost: 16, goalsFor: 34, goalsAgainst: 50, pts: 26 },
  { teamId: 'chapecoense',   played: 31, won:  4, drawn:  9, lost: 18, goalsFor: 32, goalsAgainst: 63, pts: 21 },
];

/**
 * Faixas de classificação. Em 2026 o número exato de vagas na Libertadores
 * ainda depende dos campeões da Libertadores e da Copa do Brasil, então as
 * faixas abaixo são a divisão convencional e aproximada da tabela.
 */
export const ZONES = [
  { from: 1,  to: 4,  id: 'libertadores',     label: 'Libertadores (fase de grupos)' },
  { from: 5,  to: 6,  id: 'libertadores-pre', label: 'Libertadores (fase prévia)' },
  { from: 7,  to: 12, id: 'sulamericana',     label: 'Sul-Americana' },
  { from: 17, to: 20, id: 'rebaixamento',     label: 'Rebaixamento (Z-4)' },
];

export function zoneForPosition(position) {
  return ZONES.find((z) => position >= z.from && position <= z.to) ?? null;
}

/**
 * Throws if any row is internally inconsistent. Called by the data route so a
 * bad hand edit to the snapshot fails loudly instead of silently skewing the
 * projections.
 */
export function assertStandings(rows = STANDINGS) {
  for (const row of rows) {
    const games = row.won + row.drawn + row.lost;
    if (games !== row.played) {
      throw new Error(`${row.teamId}: V+E+D = ${games} mas J = ${row.played}`);
    }
    const pts = row.won * 3 + row.drawn;
    if (pts !== row.pts) {
      throw new Error(`${row.teamId}: 3V+E = ${pts} mas Pts = ${row.pts}`);
    }
  }
  return rows;
}
