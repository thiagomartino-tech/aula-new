/** Helpers de resposta HTTP usados pelas rotas do Worker. */

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { ...JSON_HEADERS, ...(init.headers ?? {}) },
  });
}

export function jsonError(status, message, extra = {}) {
  return json({ error: message, ...extra }, { status });
}

/**
 * Erro que as rotas podem lançar para devolver um status específico em vez
 * de um 500 genérico.
 */
export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

/** Faz o parse do corpo JSON, com limite de tamanho e erro 400 claro. */
export async function readJson(request, { maxBytes = 256 * 1024 } = {}) {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > maxBytes) {
    throw new HttpError(413, 'Corpo da requisição muito grande');
  }
  let text;
  try {
    text = await request.text();
  } catch {
    throw new HttpError(400, 'Não foi possível ler o corpo da requisição');
  }
  if (text.length > maxBytes) {
    throw new HttpError(413, 'Corpo da requisição muito grande');
  }
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Corpo da requisição não é JSON válido');
  }
}
