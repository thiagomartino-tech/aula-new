/**
 * Interface do simulador.
 *
 * O motor de pontuação vem de /shared/table.js — o mesmo arquivo que o Worker
 * importa — então a tabela que aparece aqui e a que o servidor usa no prompt
 * da IA são calculadas pelo mesmo código.
 */
import {
  OUTCOME,
  nextResult,
  outcomeFromTeamResult,
  projectTable,
  fillRemaining,
  sanitizePredictions,
  RESULT_CYCLE,
} from '/shared/table.js';
import { classify, SCENARIOS } from '/shared/qualification.js';

const STORAGE_KEY = 'brasileirao-2026:predictions';
const THEME_KEY = 'brasileirao-2026:theme';

/** Estado da aplicação. */
const state = {
  teams: [],
  standings: [],
  fixtures: [],
  zones: [],
  // Cenário de vagas ligado pelo botão (chave de SCENARIOS) ou null.
  scenario: null,
  // Faixa de cada clube na tabela de agora: teamId -> { zone, viaTitle }.
  classes: new Map(),
  meta: null,
  season: null,
  source: null,
  integrations: { supabase: false, nvidia: false },
  predictions: {},
  /** Colunas de rodada, incluindo a do jogo atrasado quando existir. */
  columns: [],
};

const el = {
  status: document.getElementById('status'),
  app: document.getElementById('app'),
  seasonLine: document.getElementById('seasonLine'),
  sourceLine: document.getElementById('sourceLine'),
  tableHead: document.getElementById('tableHead'),
  tableBody: document.getElementById('tableBody'),
  tableNote: document.getElementById('tableNote'),
  zoneLegend: document.getElementById('zoneLegend'),
  progressBar: document.getElementById('progressBar'),
  progressLabel: document.getElementById('progressLabel'),
  homeWinBtn: document.getElementById('homeWinBtn'),
  perfectBtn: document.getElementById('perfectBtn'),
  clearBtn: document.getElementById('clearBtn'),
  saveBtn: document.getElementById('saveBtn'),
  analyzeBtn: document.getElementById('analyzeBtn'),
  analysisPanel: document.getElementById('analysisPanel'),
  analysisForm: document.getElementById('analysisForm'),
  analysisQuestion: document.getElementById('analysisQuestion'),
  analysisSubmit: document.getElementById('analysisSubmit'),
  analysisBody: document.getElementById('analysisBody'),
  savePanel: document.getElementById('savePanel'),
  saveBody: document.getElementById('saveBody'),
  themeToggle: document.getElementById('themeToggle'),
};

/* ---------------------------------------------------------------- utilidades */

/** Cria um elemento com classe, texto e atributos, em uma chamada. */
function h(tag, { className, text, ...attrs } = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of [].concat(children)) {
    if (child) node.append(child);
  }
  return node;
}

function signed(n) {
  return n > 0 ? `+${n}` : String(n);
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  let body = null;
  try {
    body = await res.json();
  } catch {
    // Resposta sem JSON: a mensagem abaixo cobre o caso.
  }
  if (!res.ok) {
    throw new Error(body?.error ?? `Falha na requisição (HTTP ${res.status})`);
  }
  return body;
}

/* --------------------------------------------------------------- persistência */

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    // Navegação privada ou storage bloqueado: segue sem palpites salvos.
    return {};
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.predictions));
  } catch {
    // Sem storage o simulador continua funcionando, só não lembra ao recarregar.
  }
}

/* ---------------------------------------------------------------------- tema */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  el.themeToggle.setAttribute(
    'aria-label',
    theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro',
  );
}

function initTheme() {
  let stored = null;
  try {
    stored = localStorage.getItem(THEME_KEY);
  } catch { /* storage indisponível */ }
  applyTheme(stored ?? 'auto');

  el.themeToggle.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme;
    const isDark =
      current === 'dark' ||
      (current === 'auto' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    const next = isDark ? 'light' : 'dark';
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch { /* storage indisponível */ }
  });
}

/* ------------------------------------------------------------------- colunas */

/**
 * Monta a lista de colunas de jogos: as 6 rodadas que faltam e, se houver
 * jogo atrasado pendente, uma coluna extra para ele.
 */
function buildColumns() {
  const columns = state.meta.remainingRounds.map((round) => ({
    round,
    label: `${round}ª`,
    title: `${round}ª rodada — ${state.meta.roundDates[round] ?? 'data a definir'}`,
    deferred: false,
  }));

  const deferred = state.fixtures.filter((f) => f.deferred);
  if (deferred.length > 0) {
    const rounds = [...new Set(deferred.map((f) => f.round))].sort((a, b) => a - b);
    columns.push({
      round: rounds[0],
      label: 'ATR',
      title:
        `Jogo atrasado da ${rounds[0]}ª rodada, adiado e ainda sem data. ` +
        'Só os clubes envolvidos têm jogo nesta coluna.',
      deferred: true,
    });
  }
  return columns;
}

/* ------------------------------------------------------------------- render */

/* ------------------------------------------------------- colunas numéricas */

/**
 * As colunas de números, declaradas uma vez só. O cabeçalho e o corpo da
 * tabela saem daqui, então a classe de cada coluna existe nas duas pontas e
 * esconder uma coluna no mobile não desalinha nada.
 */
const NUMERIC_COLUMNS = [
  {
    cls: 'col-pts',
    label: 'Pts',
    title: 'Pontos projetados',
    render: (row) => h('span', { className: 'num num--pts', text: String(row.pts) }),
  },
  {
    cls: 'col-max',
    label: 'Máx',
    title: 'Máximo de pontos possível se vencer todos os jogos sem palpite',
    render: (row) =>
      h('span', {
        className: 'num num--max',
        text: String(row.maxPts),
        title:
          row.pending > 0
            ? `${row.pts} pts + ${row.pending} jogo(s) sem palpite`
            : 'Todos os jogos já têm palpite',
      }),
  },
  { cls: 'col-j', label: 'J', title: 'Jogos', value: (r) => r.played },
  { cls: 'col-v', label: 'V', title: 'Vitórias', value: (r) => r.won },
  { cls: 'col-e', label: 'E', title: 'Empates', value: (r) => r.drawn },
  { cls: 'col-d', label: 'D', title: 'Derrotas', value: (r) => r.lost },
  { cls: 'col-gf col-secondary', label: 'GP', title: 'Gols pró', value: (r) => r.goalsFor },
  { cls: 'col-ga col-secondary', label: 'GC', title: 'Gols contra', value: (r) => r.goalsAgainst },
  {
    cls: 'col-sg',
    label: 'SG',
    title: 'Saldo de gols',
    render: (row) =>
      h('span', {
        className: `num ${row.goalDiff > 0 ? 'num--pos' : row.goalDiff < 0 ? 'num--neg' : ''}`,
        text: signed(row.goalDiff),
      }),
  },
];

function renderHead() {
  const row = h('tr', {}, [
    h('th', { className: 'col-pos', scope: 'col', text: '#' }),
    h('th', { className: 'col-team', scope: 'col', text: 'Clube' }),
    ...NUMERIC_COLUMNS.map((col) =>
      h('th', { className: col.cls, scope: 'col', text: col.label, title: col.title }),
    ),
    ...state.columns.map((col, i) =>
      h('th', {
        className: i === 0 ? 'col-sep' : undefined,
        scope: 'col',
        text: col.label,
        title: col.title,
      }),
    ),
  ]);

  el.tableHead.replaceChildren(row);
}

/** Uma célula de jogo: sigla do adversário + resultado palpitado. */
function renderMatchCell(game, row, isFirst) {
  const td = h('td', { className: isFirst ? 'col-sep' : undefined });

  if (!game) {
    td.append(h('div', { className: 'match-empty', text: '–' }));
    return td;
  }

  const opponent = state.teamsById[game.opponent];
  const result = game.result;
  const label = game.home ? opponent.abbr : `@${opponent.abbr}`;

  const resultName = { V: 'vitória', E: 'empate', D: 'derrota' }[result];
  const where = game.home ? 'em casa' : 'fora de casa';

  const button = h(
    'button',
    {
      className: 'match',
      type: 'button',
      'data-fixture': game.fixtureId,
      'data-team': row.teamId,
      'data-result': result ?? undefined,
      title:
        `${row.name} x ${opponent.name} (${where})` +
        (game.date ? ` — ${game.date}` : '') +
        (game.deferred ? ' — jogo atrasado, sem data' : '') +
        `\n${resultName ? `Palpite: ${resultName}` : 'Sem palpite'}. Clique para alternar.`,
      'aria-label':
        `${row.name} ${where} contra ${opponent.name}. ` +
        `${resultName ? `Palpite atual: ${resultName}` : 'Sem palpite'}. ` +
        'Ativar para alternar o resultado.',
    },
    [
      h('span', {
        className: game.home ? 'match__opp' : 'match__opp match__away',
        text: label,
      }),
      h('span', { className: 'match__result', text: result ?? '—', 'aria-hidden': true }),
    ],
  );

  td.append(button);
  return td;
}

function renderRow(row) {
  const cls = state.classes.get(row.teamId) ?? { zone: null, viaTitle: false };

  const change =
    row.change > 0
      ? { cls: 'up', text: `▲${row.change}` }
      : row.change < 0
        ? { cls: 'down', text: `▼${-row.change}` }
        : { cls: 'same', text: '·' };

  const tr = h('tr', {
    'data-zone': cls.zone,
    'data-team': row.teamId,
    'data-title': cls.viaTitle,
  });

  tr.append(
    h('th', { className: 'col-pos', scope: 'row' }, [
      h('div', { className: 'pos' }, [
        h('span', { text: String(row.position) }),
        h('span', {
          className: `pos__change pos__change--${change.cls}`,
          text: change.text,
          title:
            row.change === 0
              ? 'Mesma posição de hoje'
              : `${Math.abs(row.change)} posição(ões) ${row.change > 0 ? 'acima' : 'abaixo'} da posição de hoje (${row.currentPosition}º)`,
        }),
      ]),
    ]),
    h('td', { className: 'col-team' }, [
      h('div', { className: 'team' }, [
        h('span', {
          className: 'team__badge',
          style: `background:linear-gradient(180deg,${row.color} 50%,${row.color2 ?? row.color} 50%)`,
          'aria-hidden': true,
        }),
        h('span', { className: 'team__name', text: row.name }),
        cls.viaTitle
          ? h('span', {
              className: 'team__title',
              text: '★',
              title: 'Vaga garantida por título, não pela tabela',
              role: 'img',
              'aria-label': 'Vaga garantida por título',
            })
          : null,
        h('span', { className: 'team__abbr', text: row.abbr, 'aria-hidden': true }),
      ]),
    ]),
    ...NUMERIC_COLUMNS.map((col) =>
      col.render
        ? h('td', { className: `cell ${col.cls}` }, [col.render(row)])
        : h('td', { className: `cell num ${col.cls}`, text: String(col.value(row)) }),
    ),
  );

  state.columns.forEach((col, i) => {
    // A coluna do atrasado busca pelo jogo marcado como deferred, não pela
    // rodada, porque a rodada 21 também tem jogos já disputados.
    const game = col.deferred
      ? Object.values(row.games).find((g) => g.deferred)
      : (row.games[col.round]?.deferred ? null : row.games[col.round]);
    tr.append(renderMatchCell(game ?? null, row, i === 0));
  });

  return tr;
}

function renderZoneLegend() {
  // No cenário as faixas deixam de ser posições seguidas (quem tem título é
  // pulado), então a legenda conta clubes em vez de dizer "do 1º ao 4º".
  const count = (id) =>
    [...state.classes.values()].filter((c) => c.zone === id).length;
  const range = (zone) =>
    state.scenario && zone.id !== 'rebaixamento'
      ? `${count(zone.id)} clubes`
      : `${zone.from}º${zone.to !== zone.from ? `–${zone.to}º` : ''}`;

  const items = state.zones.map((zone) =>
    h('li', {}, [
      h('span', { className: `zone-dot zone-dot--${zone.id}`, 'aria-hidden': true }),
      h('span', { className: 'legend__pair' }, [
        h('span', { text: `${zone.label} (${range(zone)})` }),
        zone.en ? h('span', { className: 'en', text: zone.en }) : null,
      ]),
    ]),
  );

  if (state.scenario) {
    items.splice(
      1,
      0,
      h('li', {}, [
        h('span', { className: 'zone-dot zone-dot--title', text: '★', 'aria-hidden': true }),
        h('span', { className: 'legend__pair' }, [
          h('span', { text: 'Vaga por título' }),
          h('span', { className: 'en', text: 'qualified by a cup win, not by the table' }),
        ]),
      ]),
    );
  }
  el.zoneLegend.replaceChildren(...items);
}

function render() {
  const { rows, decided, total } = projectTable({
    teams: state.teams,
    standings: state.standings,
    fixtures: state.fixtures,
    predictions: state.predictions,
  });

  state.classes = classify(
    rows,
    state.zones,
    state.scenario ? SCENARIOS[state.scenario] : null,
  );
  renderZoneLegend();
  renderHead();
  el.tableBody.replaceChildren(...rows.map(renderRow));

  const pct = total ? Math.round((decided / total) * 100) : 0;
  el.progressBar.style.width = `${pct}%`;
  el.progressLabel.replaceChildren(
    document.createTextNode(`${decided} de ${total} jogos simulados`),
    h('span', { className: 'en', text: `${decided} of ${total} matches guessed` }),
  );

  el.clearBtn.disabled = decided === 0;
  el.saveBtn.disabled = decided === 0;

  const pendingPt =
    decided < total
      ? ' Jogos sem palpite valem 0 ponto, por isso a coluna Máx mostra o teto de cada clube.'
      : '';
  const pendingEn =
    decided < total
      ? ' A match with no guess scores nothing, so the Máx column shows each club\u2019s ceiling.'
      : '';
  const scenarioPt = state.scenario
    ? ' Cenário perfeito: Palmeiras campeão da Libertadores e da Copa do Brasil; ' +
      'Atlético-MG campeão da Sul-Americana e vice da Copa do Brasil. O Brasil ' +
      'passa a ter 9 vagas, e os dois clubes não ocupam vaga da tabela: ' +
      'as faixas descem para quem vem atrás.'
    : '';
  const scenarioEn = state.scenario
    ? ` Perfect scenario: ${SCENARIOS[state.scenario].summary}. Brazil gets 9 ` +
      'Libertadores places and those two clubs do not use a table place, so ' +
      'every band moves down to the clubs behind them.'
    : '';
  el.tableNote.replaceChildren(
    document.createTextNode(
      'Jogos simulados entram como 1 a 0 para o vencedor e 0 a 0 no empate, ' +
      'só para o saldo de gols poder desempatar.' + pendingPt + scenarioPt,
    ),
    h('span', {
      className: 'en',
      text:
        'A guessed match counts as 1-0 to the winner and 0-0 for a draw, just so ' +
        'goal difference can break ties.' + pendingEn + scenarioEn,
    }),
  );
}

/* --------------------------------------------------------------- interação */

/** Alterna o resultado de um jogo a partir da célula clicada. */
function cycleCell(button, backwards) {
  const fixtureId = button.dataset.fixture;
  const teamId = button.dataset.team;
  const fixture = state.fixtures.find((f) => f.id === fixtureId);
  if (!fixture) return;

  const current = button.dataset.result ?? null;
  const next = backwards
    ? RESULT_CYCLE[
        (RESULT_CYCLE.indexOf(current) - 1 + RESULT_CYCLE.length) % RESULT_CYCLE.length
      ]
    : nextResult(current);

  const outcome = outcomeFromTeamResult(fixture, teamId, next);
  if (outcome) {
    state.predictions[fixtureId] = outcome;
  } else {
    delete state.predictions[fixtureId];
  }

  persist();

  // O redesenho recria os botões, então o foco é devolvido à mesma célula
  // para quem está navegando pelo teclado.
  render();
  el.tableBody
    .querySelector(
      `.match[data-fixture="${CSS.escape(fixtureId)}"][data-team="${CSS.escape(teamId)}"]`,
    )
    ?.focus({ preventScroll: true });
}

function initTableEvents() {
  el.tableBody.addEventListener('click', (event) => {
    const button = event.target.closest('.match');
    if (!button) return;
    cycleCell(button, event.shiftKey);
  });

  // Botão direito volta no ciclo, sem abrir o menu do navegador.
  el.tableBody.addEventListener('contextmenu', (event) => {
    const button = event.target.closest('.match');
    if (!button) return;
    event.preventDefault();
    cycleCell(button, true);
  });

  // Ao passar o mouse, destaca as duas células do mesmo jogo.
  el.tableBody.addEventListener('pointerover', (event) => {
    const button = event.target.closest('.match');
    if (!button) return;
    for (const twin of el.tableBody.querySelectorAll(
      `.match[data-fixture="${CSS.escape(button.dataset.fixture)}"]`,
    )) {
      if (twin !== button) twin.classList.add('match--linked');
    }
  });

  el.tableBody.addEventListener('pointerout', () => {
    for (const marked of el.tableBody.querySelectorAll('.match--linked')) {
      marked.classList.remove('match--linked');
    }
  });
}

function initToolbar() {
  el.homeWinBtn.addEventListener('click', () => {
    // Vitória do mandante em todo jogo que ainda não tem palpite.
    state.predictions = fillRemaining(state.fixtures, state.predictions, OUTCOME.HOME);
    persist();
    render();
  });

  el.perfectBtn.addEventListener('click', () => {
    state.scenario = state.scenario ? null : 'perfect';
    el.perfectBtn.setAttribute('aria-pressed', String(Boolean(state.scenario)));
    render();
  });

  el.clearBtn.addEventListener('click', () => {
    state.predictions = {};
    persist();
    render();
    el.savePanel.hidden = true;
    el.analysisPanel.hidden = true;
  });
}

/* ------------------------------------------------------------------ salvar */

function initSave() {
  el.saveBtn.addEventListener('click', async () => {
    el.savePanel.hidden = false;
    el.saveBody.className = 'panel__body';
    el.saveBody.replaceChildren(
      h('p', {}, [h('span', { className: 'spinner', 'aria-hidden': true }), 'Salvando…']),
    );
    el.saveBtn.disabled = true;

    try {
      const saved = await fetchJson('/api/simulations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ predictions: state.predictions }),
      });

      const url = new URL(window.location.href);
      url.search = `?sim=${saved.id}`;
      url.hash = '';

      const copy = h('button', { className: 'btn', type: 'button', text: 'Copiar' });
      copy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(url.toString());
          copy.textContent = 'Copiado';
        } catch {
          copy.textContent = 'Copie manualmente';
        }
      });

      el.saveBody.replaceChildren(
        h('p', { text: 'Simulação salva. Qualquer pessoa com este link abre o mesmo cenário:' }),
        h('div', { className: 'share-link' }, [
          h('code', { text: url.toString() }),
          copy,
        ]),
      );
    } catch (err) {
      el.saveBody.className = 'panel__body panel__body--error';
      el.saveBody.replaceChildren(h('p', { text: err.message }));
    } finally {
      el.saveBtn.disabled = Object.keys(state.predictions).length === 0;
    }
  });
}

/* --------------------------------------------------------------- análise IA */

function initAnalysis() {
  el.analyzeBtn.addEventListener('click', () => {
    el.analysisPanel.hidden = false;
    el.analysisPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    el.analysisQuestion.focus();
  });

  el.analysisForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    el.analysisSubmit.disabled = true;
    el.analysisBody.className = 'panel__body';
    el.analysisBody.replaceChildren(
      h('p', {}, [
        h('span', { className: 'spinner', 'aria-hidden': true }),
        'Consultando o modelo…',
      ]),
    );

    try {
      const result = await fetchJson('/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          predictions: state.predictions,
          scenario: state.scenario ?? undefined,
          question: el.analysisQuestion.value || undefined,
        }),
      });

      // O texto do modelo entra como parágrafos de texto, nunca como HTML.
      const paragraphs = result.analysis
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean);

      el.analysisBody.replaceChildren(
        ...paragraphs.map((p) => h('p', { text: p })),
        h('p', {
          className: 'legend__at',
          text: `${result.model} · ${result.decided} of ${result.total} matches guessed`,
        }),
      );
    } catch (err) {
      el.analysisBody.className = 'panel__body panel__body--error';
      el.analysisBody.replaceChildren(h('p', { text: err.message }));
    } finally {
      el.analysisSubmit.disabled = false;
    }
  });
}

/* ------------------------------------------------------------------- início */

function showError(message) {
  el.status.className = 'status status--error';
  el.status.textContent = message;
  el.status.hidden = false;
}

async function start() {
  initTheme();

  let data;
  try {
    data = await fetchJson('/api/bootstrap');
  } catch (err) {
    showError(`Não foi possível carregar a tabela: ${err.message}`);
    return;
  }

  Object.assign(state, {
    teams: data.teams,
    standings: data.standings,
    fixtures: data.fixtures,
    zones: data.zones,
    meta: data.meta,
    season: data.season,
    source: data.source,
  });
  state.teamsById = Object.fromEntries(state.teams.map((t) => [t.id, t]));
  state.columns = buildColumns();

  // /api/health diz quais integrações existem; sem ela o site segue local.
  try {
    const health = await fetchJson('/api/health');
    state.integrations = health.integrations;
  } catch {
    state.integrations = { supabase: false, nvidia: false };
  }
  el.saveBtn.hidden = !state.integrations.supabase;
  el.analyzeBtn.hidden = !state.integrations.nvidia;

  // Simulação compartilhada pela URL tem prioridade sobre a do navegador.
  const sharedId = new URLSearchParams(window.location.search).get('sim');
  if (sharedId) {
    try {
      const shared = await fetchJson(`/api/simulations/${encodeURIComponent(sharedId)}`);
      state.predictions = shared.predictions;
      persist();
    } catch (err) {
      console.warn(`Não foi possível abrir a simulação ${sharedId}: ${err.message}`);
    }
  }
  if (Object.keys(state.predictions).length === 0) {
    state.predictions = sanitizePredictions(loadStored(), state.fixtures);
  }

  const { lastRoundPlayed, totalRounds, remainingRounds } = state.meta;

  // Uma rodada se espalha por vários dias, então a primeira que falta pode já
  // ter alguns jogos lançados na classificação. Dizer só "após a Nª rodada"
  // nesse caso subestima o que a tabela já mostra.
  const corrente = remainingRounds[0];
  const faltamNaCorrente = state.fixtures.filter(
    (f) => f.round === corrente && !f.deferred,
  ).length;
  const jogadosNaCorrente = 10 - faltamNaCorrente;

  const parcialPt =
    jogadosNaCorrente > 0
      ? ` e ${jogadosNaCorrente} ${jogadosNaCorrente === 1 ? 'jogo' : 'jogos'} da ${corrente}ª`
      : '';
  const parcialEn =
    jogadosNaCorrente > 0
      ? ` plus ${jogadosNaCorrente} ${jogadosNaCorrente === 1 ? 'match' : 'matches'} of round ${corrente}`
      : '';

  el.seasonLine.replaceChildren(
    document.createTextNode(
      `${state.season.competition} ${state.season.year} · ` +
      `classificação após a ${lastRoundPlayed}ª rodada${parcialPt} · ` +
      `${remainingRounds.length} rodadas até a ${totalRounds}ª`,
    ),
    h('span', {
      className: 'en',
      text:
        `Brazilian league, ${state.season.year} · ` +
        `table after round ${lastRoundPlayed}${parcialEn} · ` +
        `${remainingRounds.length} rounds to go`,
    }),
  );

  const coletada = new Date(state.season.snapshotDate + 'T12:00:00Z');
  el.sourceLine.replaceChildren(
    document.createTextNode(
      state.source.standings === 'supabase'
        ? 'Classificação lida do Supabase.'
        : `Classificação coletada em ${coletada.toLocaleDateString('pt-BR')} e embutida na aplicação.`,
    ),
    h('span', {
      className: 'en',
      text:
        state.source.standings === 'supabase'
          ? 'Table read from Supabase.'
          : `Table collected on ${coletada.toLocaleDateString('en-GB')} and bundled with the app.`,
    }),
  );

  initTableEvents();
  initToolbar();
  initSave();
  initAnalysis();
  render();

  el.status.hidden = true;
  el.app.hidden = false;
}

start();
