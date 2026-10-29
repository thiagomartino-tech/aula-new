/**
 * Cliente da NVIDIA LLM API (NIM), que é compatível com o formato
 * chat/completions da OpenAI — então é só `fetch`, sem SDK.
 *
 * Variáveis de ambiente do Worker:
 *
 *   NVIDIA_API_KEY   chave da NVIDIA (nvapi-...), segredo
 *   NVIDIA_MODEL     opcional, sobrescreve o modelo padrão
 *   NVIDIA_BASE_URL  opcional, para apontar para um NIM auto-hospedado
 *
 * Sem NVIDIA_API_KEY, `createNvidia()` devolve null e a rota /api/analyze
 * responde 503 explicando o que falta configurar.
 */
import { HttpError } from './http.js';

const DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const DEFAULT_MODEL = 'nvidia/nemotron-3.5-lightning-30b-a3b';

/** Apaga chaves da NVIDIA de um texto antes de ele sair para o cliente. */
export function redact(text) {
  return text.replace(/nvapi-[A-Za-z0-9_-]+/g, 'nvapi-***');
}

/**
 * Tira do corpo de erro da NVIDIA a frase que explica a recusa. O formato
 * varia entre `detail`, `message` e `error.message`, então os três são
 * tentados antes de desistir e devolver o texto cru truncado.
 */
export function explainFailure(text, limit = 200) {
  if (!text?.trim()) return null;

  let reason = null;
  try {
    const body = JSON.parse(text);
    const candidate =
      body?.detail ??
      body?.message ??
      body?.error?.message ??
      (typeof body?.error === 'string' ? body.error : null);
    if (typeof candidate === 'string' && candidate.trim()) {
      reason = candidate.trim();
    }
  } catch {
    // Não era JSON: o texto cru serve.
  }

  reason ??= text.trim();
  reason = redact(reason).replace(/\s+/g, ' ');
  return reason.length > limit ? `${reason.slice(0, limit)}…` : reason;
}

export function createNvidia(env) {
  if (!env.NVIDIA_API_KEY) return null;
  return new NvidiaClient({
    apiKey: env.NVIDIA_API_KEY,
    baseUrl: (env.NVIDIA_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ''),
    model: env.NVIDIA_MODEL || DEFAULT_MODEL,
  });
}

class NvidiaClient {
  constructor({ apiKey, baseUrl, model }) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.model = model;
  }

  /**
   * @param {object} args
   * @param {Array}  args.messages  mensagens no formato {role, content}
   * @param {number} [args.temperature]
   * @param {number} [args.maxTokens]
   * @param {AbortSignal} [args.signal]
   * @returns {Promise<{text: string, model: string, usage: object|null}>}
   */
  async chat({ messages, temperature = 0.4, maxTokens = 900, signal } = {}) {
    let res;
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: false,
        }),
        signal,
      });
    } catch (err) {
      // O abort tem tratamento próprio em quem chamou; o resto é rede fora
      // ou NVIDIA_BASE_URL errada.
      if (err.name === 'AbortError') throw err;
      console.error(`NVIDIA inacessível: ${err.message}`);
      throw new HttpError(502, 'Não foi possível alcançar a NVIDIA LLM API');
    }

    const text = await res.text();
    if (!res.ok) {
      console.error(`NVIDIA ${res.status}: ${text}`);

      if (res.status === 401 || res.status === 403) {
        // Num erro de autenticação o corpo costuma ecoar a chave enviada,
        // então aqui nada dele é repassado.
        throw new HttpError(502, 'A NVIDIA recusou a chave de API (NVIDIA_API_KEY)');
      }
      if (res.status === 429) {
        throw new HttpError(429, 'Limite de uso da NVIDIA atingido; tente de novo em instantes');
      }

      // Nos demais casos o motivo é diagnóstico — "modelo não encontrado",
      // por exemplo. Sem ele sobra uma mensagem genérica que não ajuda
      // ninguém a consertar nada.
      const reason = explainFailure(text);
      throw new HttpError(
        502,
        `A NVIDIA recusou a requisição (HTTP ${res.status})` +
          (reason ? `: ${reason}` : ''),
      );
    }

    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new HttpError(502, 'Resposta da NVIDIA não é JSON válido');
    }

    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new HttpError(502, 'A NVIDIA respondeu sem conteúdo');
    }

    return {
      text: content.trim(),
      model: payload.model ?? this.model,
      usage: payload.usage ?? null,
    };
  }
}
