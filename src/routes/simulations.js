/**
 * POST /api/simulations      salva uma simulação e devolve um id curto
 * GET  /api/simulations/:id  carrega uma simulação salva
 *
 * Precisa do Supabase configurado. Sem banco, responde 503 e a interface
 * segue guardando a simulação no localStorage do navegador.
 */
import { HttpError, json, readJson } from '../lib/http.js';
import { createSupabase } from '../lib/supabase.js';
import { FIXTURES } from '../data/fixtures.js';
import { sanitizePredictions } from '../../public/shared/table.js';

const ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const ID_LENGTH = 8;
const MAX_NAME = 80;

function newId() {
  const bytes = new Uint8Array(ID_LENGTH);
  crypto.getRandomValues(bytes);
  // O viés do módulo é irrelevante aqui: o id é um identificador de
  // compartilhamento, não um segredo.
  return [...bytes].map((b) => ID_ALPHABET[b % ID_ALPHABET.length]).join('');
}

function requireDb(env) {
  const db = createSupabase(env);
  if (!db) {
    throw new HttpError(
      503,
      'Salvar simulações precisa do Supabase configurado (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY)',
    );
  }
  return db;
}

export async function handleSaveSimulation(request, env) {
  const db = requireDb(env);
  const body = await readJson(request);

  const predictions = sanitizePredictions(body.predictions, FIXTURES);
  if (Object.keys(predictions).length === 0) {
    throw new HttpError(400, 'Nenhum palpite válido para salvar');
  }

  const name =
    typeof body.name === 'string' && body.name.trim()
      ? body.name.trim().slice(0, MAX_NAME)
      : null;

  const id = newId();
  await db.insert('simulations', [{ id, name, predictions }]);

  return json({ id, name, predictions }, { status: 201 });
}

export async function handleGetSimulation(request, env, { id }) {
  const db = requireDb(env);

  if (!/^[a-z0-9]{1,32}$/.test(id)) {
    throw new HttpError(400, 'Id de simulação inválido');
  }

  const rows = await db.select('simulations', {
    select: 'id,name,predictions,created_at',
    id: `eq.${id}`,
    limit: '1',
  });

  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) throw new HttpError(404, 'Simulação não encontrada');

  return json({
    id: row.id,
    name: row.name,
    predictions: sanitizePredictions(row.predictions, FIXTURES),
    createdAt: row.created_at,
  });
}
