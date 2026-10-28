/**
 * The 20 clubs of the Campeonato Brasileiro Série A 2026.
 *
 * `abbr` is the 3-letter code used in the fixture columns of the simulator
 * table, following the abbreviations ge.globo.com uses in its own tables.
 * `color`/`color2` são as duas cores do escudo, usadas no badge ao lado do
 * nome. A segunda cor existe para os clubes de preto e branco aparecerem
 * tanto no tema claro quanto no escuro.
 */
export const TEAMS = [
  { id: 'flamengo',      name: 'Flamengo',           abbr: 'FLA', color: '#c52613', color2: '#17171a' },
  { id: 'palmeiras',     name: 'Palmeiras',          abbr: 'PAL', color: '#0a6e3f', color2: '#e9ece9' },
  { id: 'cruzeiro',      name: 'Cruzeiro',           abbr: 'CRU', color: '#1f4e9c', color2: '#e9ecf2' },
  { id: 'athletico-pr',  name: 'Athletico-PR',       abbr: 'CAP', color: '#b3161f', color2: '#17171a' },
  { id: 'fluminense',    name: 'Fluminense',         abbr: 'FLU', color: '#7a1430', color2: '#0f6b3f' },
  { id: 'atletico-mg',   name: 'Atlético-MG',        abbr: 'CAM', color: '#17171a', color2: '#e9ece9' },
  { id: 'bahia',         name: 'Bahia',              abbr: 'BAH', color: '#1c5bb8', color2: '#d42a2a' },
  { id: 'santos',        name: 'Santos',             abbr: 'SAN', color: '#17171a', color2: '#e9ece9' },
  { id: 'sao-paulo',     name: 'São Paulo',          abbr: 'SAO', color: '#c4162a', color2: '#17171a' },
  { id: 'bragantino',    name: 'Red Bull Bragantino', abbr: 'RBB', color: '#cf1d2d', color2: '#e9ece9' },
  { id: 'botafogo',      name: 'Botafogo',           abbr: 'BOT', color: '#17171a', color2: '#e9ece9' },
  { id: 'coritiba',      name: 'Coritiba',           abbr: 'CTB', color: '#0d5c3a', color2: '#e9ece9' },
  { id: 'vasco',         name: 'Vasco',              abbr: 'VAS', color: '#17171a', color2: '#e9ece9' },
  { id: 'vitoria',       name: 'Vitória',            abbr: 'VIT', color: '#c8102e', color2: '#17171a' },
  { id: 'mirassol',      name: 'Mirassol',           abbr: 'MIR', color: '#107a4d', color2: '#f5c518' },
  { id: 'internacional', name: 'Internacional',      abbr: 'INT', color: '#c4121f', color2: '#e9ece9' },
  { id: 'gremio',        name: 'Grêmio',             abbr: 'GRE', color: '#2a6fc9', color2: '#17171a' },
  { id: 'corinthians',   name: 'Corinthians',        abbr: 'COR', color: '#17171a', color2: '#e9ece9' },
  { id: 'remo',          name: 'Remo',               abbr: 'REM', color: '#14387f', color2: '#e9ece9' },
  { id: 'chapecoense',   name: 'Chapecoense',        abbr: 'CHA', color: '#0f7a35', color2: '#e9ece9' },
];

export const TEAMS_BY_ID = Object.fromEntries(TEAMS.map((t) => [t.id, t]));
