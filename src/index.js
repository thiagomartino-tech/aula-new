/**
 * Entrada do Cloudflare Worker.
 *
 * O Worker responde /api/*; qualquer outra rota é entregue ao binding de
 * assets estáticos (public/), configurado em wrangler.toml. Como o
 * not_found_handling é "single-page-application", o index.html é servido
 * para rotas que não casam com um arquivo.
 */
import { HttpError, json, jsonError } from './lib/http.js';
import { handleBootstrap } from './routes/bootstrap.js';
import { handleAnalyze } from './routes/analyze.js';
import { handleChat } from './routes/chat.js';
import {
  handleGetSimulation,
  handleSaveSimulation,
} from './routes/simulations.js';

/**
 * Rotas da API. Cada entrada é [método, padrão, handler]; o padrão aceita
 * `:param`, entregue ao handler no terceiro argumento.
 */
const ROUTES = [
  ['GET', '/api/health', handleHealth],
  ['GET', '/api/bootstrap', handleBootstrap],
  ['POST', '/api/analyze', handleAnalyze],
  ['POST', '/api/chat', handleChat],
  ['POST', '/api/simulations', handleSaveSimulation],
  ['GET', '/api/simulations/:id', handleGetSimulation],
];

/**
 * GET /api/health
 *
 * Diz quais integrações já estão configuradas, sem vazar valor de segredo.
 * A interface usa isso para habilitar os botões de salvar e de análise.
 */
function handleHealth(request, env) {
  return json({
    ok: true,
    integrations: {
      supabase: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
      nvidia: Boolean(env.NVIDIA_API_KEY),
    },
  });
}

/** Casa o path com um padrão de rota, devolvendo os params ou null. */
function matchRoute(pattern, pathname) {
  const patternParts = pattern.split('/');
  const pathParts = pathname.split('/');
  if (patternParts.length !== pathParts.length) return null;

  const params = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    const expected = patternParts[i];
    const actual = pathParts[i];
    if (expected.startsWith(':')) {
      if (!actual) return null;
      params[expected.slice(1)] = decodeURIComponent(actual);
    } else if (expected !== actual) {
      return null;
    }
  }
  return params;
}

async function handleApi(request, env, ctx) {
  const { pathname } = new URL(request.url);
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

  // Separa "rota inexistente" de "método errado" para devolver 405 com Allow.
  const allowed = new Set();
  for (const [method, pattern, handler] of ROUTES) {
    const params = matchRoute(pattern, normalized);
    if (!params) continue;
    allowed.add(method);
    if (method === request.method) {
      return handler(request, env, params, ctx);
    }
    // HEAD é atendido pelo handler de GET; o runtime descarta o corpo.
    if (method === 'GET' && request.method === 'HEAD') {
      return handler(request, env, params, ctx);
    }
  }

  if (allowed.size > 0) {
    return jsonError(405, `Método ${request.method} não permitido`, {
      allow: [...allowed].join(', '),
    });
  }
  return jsonError(404, 'Rota não encontrada');
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);

    if (!pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    try {
      return await handleApi(request, env, ctx);
    } catch (err) {
      if (err instanceof HttpError) {
        return jsonError(err.status, err.message, err.extra);
      }
      // Erro inesperado: detalhe vai para o log, cliente recebe genérico.
      console.error('Erro não tratado:', err?.stack ?? err);
      return jsonError(500, 'Erro interno no servidor');
    }
  },
};
