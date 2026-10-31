/**
 * POST /api/analyze
 *
 * Recebe os palpites, projeta a tabela final no servidor (com o mesmo motor
 * que o browser usa) e pede à NVIDIA LLM API um comentário sobre o cenário.
 *
 * A projeção é refeita aqui de propósito: o prompt é montado a partir dos
 * palpites, nunca de uma tabela que o cliente mandou pronta.
 */
import { HttpError, json, readJson } from '../lib/http.js';
import { createNvidia } from '../lib/nvidia.js';
import { TEAMS } from '../data/teams.js';
import { STANDINGS, ZONES } from '../data/standings.js';
import { FIXTURES } from '../data/fixtures.js';
import { SEASON } from '../data/season.js';
import { projectTable, sanitizePredictions } from '../../public/shared/table.js';
import { classify, describeTitles, sanitizeTitles } from '../../public/shared/qualification.js';

const NAME_OF = Object.fromEntries(TEAMS.map((t) => [t.id, t.name]));

const SYSTEM_PROMPT = `You are a Brazilian football analyst: direct, no filler.
You receive the PROJECTED final table of a Brasileirão scenario a fan has simulated,
and you comment on it.

Rules:
- Write in English, at most 4 short paragraphs.
- Cover the title race, the Libertadores places and relegation, in that order.
- Use only the numbers you were given. Never invent a score, a match or a result.
- If some matches have no guess yet, say what is still open.
- No lists, no markdown, no emoji. Plain prose.`;

/**
 * Monta a tabela projetada em texto, do jeito mais legível para o modelo.
 * As faixas vêm do mesmo motor que colore a tela, para a IA e a tabela não
 * discordarem sobre quem vai à Libertadores.
 */
function renderTable(rows, titles) {
  const classes = classify(rows, ZONES, titles);
  const lines = rows.map((r) => {
    const { zone: zoneId, viaTitle } = classes.get(r.teamId);
    const zone = ZONES.find((z) => z.id === zoneId);
    const pending = r.pending > 0 ? `, ${r.pending} match(es) with no guess` : '';
    return (
      `${String(r.position).padStart(2)}. ${r.name} — ${r.pts} pts ` +
      `(${r.won}W ${r.drawn}D ${r.lost}L, goal difference ${r.goalDiff >= 0 ? '+' : ''}${r.goalDiff})` +
      `${zone ? ` [${zone.label}: ${zone.en}]` : ''}` +
      `${viaTitle ? ' (place secured by a cup win, not by the table)' : ''}${pending}`
    );
  });
  return lines.join('\n');
}

/** Lista os palpites como "Round 33: Vasco vs Flamengo — Vasco win". */
function renderPredictions(predictions) {
  const chosen = FIXTURES.filter((f) => predictions[f.id]);
  if (chosen.length === 0) return 'No guesses given.';

  const nameOf = Object.fromEntries(TEAMS.map((t) => [t.id, t.name]));
  return chosen
    .sort((a, b) => a.round - b.round)
    .map((f) => {
      const outcome = predictions[f.id];
      const label =
        outcome === 'H'
          ? `${nameOf[f.home]} win`
          : outcome === 'A'
            ? `${nameOf[f.away]} win`
            : 'draw';
      const round = f.deferred ? `Round ${f.round} (postponed)` : `Round ${f.round}`;
      return `${round}: ${nameOf[f.home]} vs ${nameOf[f.away]} — ${label}`;
    })
    .join('\n');
}

export async function handleAnalyze(request, env) {
  const nvidia = createNvidia(env);
  if (!nvidia) {
    throw new HttpError(
      503,
      'A análise com IA precisa da NVIDIA_API_KEY configurada no Worker',
    );
  }

  const body = await readJson(request);
  const predictions = sanitizePredictions(body.predictions, FIXTURES);

  const { rows, decided, total } = projectTable({
    teams: TEAMS,
    standings: STANDINGS,
    fixtures: FIXTURES,
    predictions,
  });

  // O cliente escolhe quem ganha as outras copas, nunca as regras de vaga: só
  // ids de clubes que existem passam, e as faixas são refeitas aqui.
  const titles = sanitizeTitles(
    body.titles,
    TEAMS.map((t) => t.id),
  );

  const question =
    typeof body.question === 'string' && body.question.trim()
      ? body.question.trim().slice(0, 500)
      : null;

  const userPrompt = [
    `${SEASON.competition} ${SEASON.year} — simulated scenario.`,
    `Guesses given: ${decided} of ${total} remaining matches.`,
    '',
    titles
      ? `Cup results assumed by the fan: ${describeTitles(titles, NAME_OF)}. A club ` +
        'that wins a cup is qualified for the Libertadores by that title and does ' +
        'not use a table place, so the bands below move down to the clubs behind ' +
        'it. The bands in the table already account for this.\n'
      : '',
    'PROJECTED FINAL TABLE:',
    renderTable(rows, titles),
    '',
    'GUESSES:',
    renderPredictions(predictions),
    question ? `\nThe fan asks: ${question}` : '',
  ]
    .join('\n')
    .trim();

  // A NVIDIA pode demorar; o Worker aborta antes do limite da plataforma para
  // devolver um erro útil em vez de uma conexão cortada.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const result = await nvidia.chat({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      signal: controller.signal,
    });

    return json({
      analysis: result.text,
      model: result.model,
      usage: result.usage,
      decided,
      total,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new HttpError(504, 'A NVIDIA demorou demais para responder');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
