/**
 * POST /api/chat
 *
 * Manda uma conversa para a NVIDIA LLM API e devolve a resposta do modelo.
 * Rota genérica, sem nada do Brasileirão — para o cenário simulado existe
 * /api/analyze, que monta o prompt sozinho.
 *
 * Corpo aceito, na forma curta:
 *
 *   { "message": "explique o saldo de gols", "system": "responda em uma frase" }
 *
 * ou na forma completa, com o histórico da conversa:
 *
 *   { "messages": [{ "role": "user", "content": "..." }] }
 *
 * Opcionais: `temperature` e `maxTokens`.
 */
import { HttpError, json, readJson } from '../lib/http.js';
import { createNvidia } from '../lib/nvidia.js';

const ROLES = new Set(['system', 'user', 'assistant']);

/** Limites de entrada, para um corpo absurdo não virar custo na NVIDIA. */
const MAX_MESSAGES = 40;
const MAX_CONTENT = 8000;
const MAX_TOTAL = 24000;

/**
 * Normaliza o corpo para a lista de mensagens que a API espera, aceitando
 * tanto a forma curta quanto a completa.
 */
export function buildMessages(body) {
  const messages = [];

  if (typeof body.system === 'string' && body.system.trim()) {
    messages.push({ role: 'system', content: body.system.trim() });
  }

  if (Array.isArray(body.messages)) {
    if (body.messages.length === 0) {
      throw new HttpError(400, '`messages` está vazio');
    }
    if (body.messages.length > MAX_MESSAGES) {
      throw new HttpError(400, `No máximo ${MAX_MESSAGES} mensagens por requisição`);
    }
    for (const [i, raw] of body.messages.entries()) {
      if (!raw || typeof raw !== 'object') {
        throw new HttpError(400, `messages[${i}] não é um objeto`);
      }
      const { role, content } = raw;
      if (!ROLES.has(role)) {
        throw new HttpError(
          400,
          `messages[${i}].role inválido: use ${[...ROLES].join(', ')}`,
        );
      }
      if (typeof content !== 'string' || !content.trim()) {
        throw new HttpError(400, `messages[${i}].content vazio ou não é texto`);
      }
      if (content.length > MAX_CONTENT) {
        throw new HttpError(400, `messages[${i}].content passa de ${MAX_CONTENT} caracteres`);
      }
      messages.push({ role, content });
    }
  } else if (typeof body.message === 'string' && body.message.trim()) {
    if (body.message.length > MAX_CONTENT) {
      throw new HttpError(400, `\`message\` passa de ${MAX_CONTENT} caracteres`);
    }
    messages.push({ role: 'user', content: body.message.trim() });
  } else {
    throw new HttpError(400, 'Informe `message` (texto) ou `messages` (lista)');
  }

  // Só o system não é conversa: precisa haver algo de quem pergunta.
  if (!messages.some((m) => m.role !== 'system')) {
    throw new HttpError(400, 'Nenhuma mensagem de usuário na conversa');
  }

  const total = messages.reduce((acc, m) => acc + m.content.length, 0);
  if (total > MAX_TOTAL) {
    throw new HttpError(400, `A conversa inteira passa de ${MAX_TOTAL} caracteres`);
  }

  return messages;
}

/** Lê um número opcional dentro de uma faixa, ou devolve o padrão. */
function optionalNumber(value, { min, max, fallback, name }) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new HttpError(400, `\`${name}\` precisa ser um número`);
  }
  if (value < min || value > max) {
    throw new HttpError(400, `\`${name}\` precisa estar entre ${min} e ${max}`);
  }
  return value;
}

export async function handleChat(request, env) {
  const nvidia = createNvidia(env);
  if (!nvidia) {
    throw new HttpError(
      503,
      'O chat precisa da NVIDIA_API_KEY configurada no Worker',
    );
  }

  const body = await readJson(request);
  const messages = buildMessages(body);

  const temperature = optionalNumber(body.temperature, {
    min: 0, max: 2, fallback: 0.4, name: 'temperature',
  });
  const maxTokens = optionalNumber(body.maxTokens, {
    min: 1, max: 4096, fallback: 1024, name: 'maxTokens',
  });

  // A NVIDIA pode demorar; abortar antes do limite da plataforma devolve um
  // erro útil em vez de uma conexão cortada.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const result = await nvidia.chat({
      messages,
      temperature,
      maxTokens,
      signal: controller.signal,
    });

    return json({
      reply: result.text,
      model: result.model,
      usage: result.usage,
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
