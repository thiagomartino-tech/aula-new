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

const SYSTEM_PROMPT = `Você é um analista de futebol brasileiro, direto e sem floreio.
Recebe a tabela final PROJETADA de um Brasileirão simulado por um torcedor e comenta o cenário.

Regras:
- Escreva em português do Brasil, no máximo 4 parágrafos curtos.
- Fale do título, das vagas na Libertadores e do rebaixamento, nessa ordem.
- Use os números que recebeu. Nunca invente pontuação, jogo ou resultado.
- Se algum jogo ainda estiver sem palpite, diga o que ainda está em aberto.
- Sem listas, sem markdown, sem emoji. Texto corrido.`;

/** Monta a tabela projetada em texto, do jeito mais legível para o modelo. */
function renderTable(rows) {
  const lines = rows.map((r) => {
    const zone = ZONES.find((z) => r.position >= z.from && z.to >= r.position);
    const pending = r.pending > 0 ? `, ${r.pending} jogo(s) sem palpite` : '';
    return (
      `${String(r.position).padStart(2)}. ${r.name} — ${r.pts} pts ` +
      `(${r.won}V ${r.drawn}E ${r.lost}D, saldo ${r.goalDiff >= 0 ? '+' : ''}${r.goalDiff})` +
      `${zone ? ` [${zone.label}]` : ''}${pending}`
    );
  });
  return lines.join('\n');
}

/** Lista os palpites como "Rodada 33: Vasco 1 x 0 Flamengo (palpite)". */
function renderPredictions(predictions) {
  const chosen = FIXTURES.filter((f) => predictions[f.id]);
  if (chosen.length === 0) return 'Nenhum palpite informado.';

  const nameOf = Object.fromEntries(TEAMS.map((t) => [t.id, t.name]));
  return chosen
    .sort((a, b) => a.round - b.round)
    .map((f) => {
      const outcome = predictions[f.id];
      const label =
        outcome === 'H'
          ? `vitória do ${nameOf[f.home]}`
          : outcome === 'A'
            ? `vitória do ${nameOf[f.away]}`
            : 'empate';
      const round = f.deferred ? `Rodada ${f.round} (atrasado)` : `Rodada ${f.round}`;
      return `${round}: ${nameOf[f.home]} x ${nameOf[f.away]} — ${label}`;
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

  const question =
    typeof body.question === 'string' && body.question.trim()
      ? body.question.trim().slice(0, 500)
      : null;

  const userPrompt = [
    `${SEASON.competition} ${SEASON.year} — cenário simulado.`,
    `Palpites informados: ${decided} de ${total} jogos restantes.`,
    '',
    'TABELA FINAL PROJETADA:',
    renderTable(rows),
    '',
    'PALPITES:',
    renderPredictions(predictions),
    question ? `\nPergunta do torcedor: ${question}` : '',
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
