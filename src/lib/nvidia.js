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
const DEFAULT_MODEL = 'meta/llama-3.3-70b-instruct';

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
      // O corpo do erro pode citar a chave; fica no log, não na resposta.
      console.error(`NVIDIA ${res.status}: ${text}`);
      const message =
        res.status === 401 || res.status === 403
          ? 'A NVIDIA recusou a chave de API (NVIDIA_API_KEY)'
          : res.status === 429
            ? 'Limite de uso da NVIDIA atingido; tente de novo em instantes'
            : 'Erro ao chamar a NVIDIA LLM API';
      throw new HttpError(res.status === 429 ? 429 : 502, message);
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
