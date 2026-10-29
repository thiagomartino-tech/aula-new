/**
 * Testes da montagem da conversa enviada à NVIDIA. A chamada de rede em si
 * fica de fora: o que importa aqui é o que entra e o que é recusado.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildMessages } from '../src/routes/chat.js';

/** Captura o status do HttpError lançado. */
function rejects(body, expectedStatus = 400) {
  try {
    buildMessages(body);
  } catch (err) {
    assert.equal(err.status, expectedStatus, `status de: ${err.message}`);
    return err.message;
  }
  assert.fail(`deveria ter recusado: ${JSON.stringify(body)}`);
}

test('a forma curta vira uma mensagem de usuário', () => {
  assert.deepEqual(buildMessages({ message: 'oi' }), [
    { role: 'user', content: 'oi' },
  ]);
});

test('o system vem antes da mensagem do usuário', () => {
  assert.deepEqual(buildMessages({ message: 'oi', system: 'seja breve' }), [
    { role: 'system', content: 'seja breve' },
    { role: 'user', content: 'oi' },
  ]);
});

test('espaços em volta são aparados', () => {
  assert.deepEqual(buildMessages({ message: '  oi  ', system: '  breve  ' }), [
    { role: 'system', content: 'breve' },
    { role: 'user', content: 'oi' },
  ]);
});

test('a forma completa preserva a ordem do histórico', () => {
  const messages = [
    { role: 'user', content: 'oi' },
    { role: 'assistant', content: 'olá' },
    { role: 'user', content: 'e aí?' },
  ];
  assert.deepEqual(buildMessages({ messages }), messages);
});

test('system informado à parte entra antes do histórico', () => {
  const built = buildMessages({
    system: 'responda em português',
    messages: [{ role: 'user', content: 'oi' }],
  });
  assert.equal(built[0].role, 'system');
  assert.equal(built.length, 2);
});

test('recusa corpo sem mensagem nenhuma', () => {
  rejects({});
  rejects({ message: '   ' });
  rejects({ messages: 'texto' });
});

test('recusa lista vazia', () => {
  rejects({ messages: [] });
});

test('recusa role desconhecido', () => {
  const msg = rejects({ messages: [{ role: 'root', content: 'x' }] });
  assert.match(msg, /role inválido/);
});

test('recusa content vazio, ausente ou não textual', () => {
  rejects({ messages: [{ role: 'user', content: '' }] });
  rejects({ messages: [{ role: 'user' }] });
  rejects({ messages: [{ role: 'user', content: 42 }] });
});

test('recusa item que não é objeto', () => {
  rejects({ messages: ['oi'] });
  rejects({ messages: [null] });
});

test('recusa conversa só com system, sem quem pergunte', () => {
  const msg = rejects({ messages: [{ role: 'system', content: 'seja breve' }] });
  assert.match(msg, /Nenhuma mensagem de usuário/);
});

test('recusa mensagens demais', () => {
  const messages = Array.from({ length: 41 }, () => ({ role: 'user', content: 'x' }));
  assert.match(rejects({ messages }), /No máximo 40/);
});

test('recusa uma mensagem longa demais', () => {
  assert.match(rejects({ message: 'x'.repeat(8001) }), /8000 caracteres/);
  assert.match(
    rejects({ messages: [{ role: 'user', content: 'x'.repeat(8001) }] }),
    /8000 caracteres/,
  );
});

test('recusa conversa cujo total estoura o limite', () => {
  // Cada mensagem cabe sozinha, mas a soma passa de 24000.
  const messages = Array.from({ length: 4 }, () => ({
    role: 'user',
    content: 'x'.repeat(7000),
  }));
  assert.match(rejects({ messages }), /conversa inteira/);
});

test('aceita exatamente no limite', () => {
  assert.equal(buildMessages({ message: 'x'.repeat(8000) })[0].content.length, 8000);
  const messages = Array.from({ length: 40 }, () => ({ role: 'user', content: 'x' }));
  assert.equal(buildMessages({ messages }).length, 40);
});
