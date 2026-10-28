/**
 * Cliente mínimo do Supabase sobre a API REST (PostgREST), feito com `fetch`
 * para rodar no Workers sem dependência nenhuma.
 *
 * As credenciais vêm das variáveis de ambiente do Worker:
 *
 *   SUPABASE_URL              https://<project-ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY chave service_role (segredo, só no servidor)
 *
 * Enquanto elas não estiverem configuradas, `createSupabase()` devolve null e
 * as rotas caem no snapshot embutido em src/data/ — o site funciona sem banco.
 *
 * A service_role ignora RLS, então ela nunca sai do Worker; o browser fala só
 * com /api/*. Ver supabase/schema.sql para as tabelas e as políticas.
 */
import { HttpError } from './http.js';

export function createSupabase(env) {
  const url = env.SUPABASE_URL?.replace(/\/+$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return new SupabaseRest(url, key);
}

class SupabaseRest {
  constructor(url, key) {
    this.url = url;
    this.key = key;
  }

  get headers() {
    return {
      apikey: this.key,
      authorization: `Bearer ${this.key}`,
      'content-type': 'application/json',
      accept: 'application/json',
    };
  }

  async request(path, { method = 'GET', body, prefer, searchParams } = {}) {
    const url = new URL(`${this.url}/rest/v1/${path}`);
    for (const [k, v] of Object.entries(searchParams ?? {})) {
      url.searchParams.set(k, v);
    }

    const headers = { ...this.headers };
    if (prefer) headers.prefer = prefer;

    let res;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (err) {
      // DNS errado, rede fora, projeto pausado: o fetch estoura antes de
      // haver resposta. Sem isto o usuário receberia um 500 opaco.
      console.error(`Supabase ${method} ${path} inacessível: ${err.message}`);
      throw new HttpError(502, 'Não foi possível alcançar o banco de dados');
    }

    const text = await res.text();
    if (!res.ok) {
      // A mensagem do PostgREST é útil no log, mas não vai crua para o cliente.
      console.error(`Supabase ${method} ${path} -> ${res.status}: ${text}`);
      throw new HttpError(502, 'Erro ao falar com o banco de dados', {
        status: res.status,
      });
    }
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  select(table, searchParams) {
    return this.request(table, { searchParams });
  }

  insert(table, rows, { upsert = false, onConflict } = {}) {
    const prefer = [
      'return=representation',
      upsert ? 'resolution=merge-duplicates' : null,
    ]
      .filter(Boolean)
      .join(',');
    return this.request(table, {
      method: 'POST',
      body: rows,
      prefer,
      searchParams: onConflict ? { on_conflict: onConflict } : undefined,
    });
  }
}
