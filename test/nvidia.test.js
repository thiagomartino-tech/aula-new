/**
 * Testes da leitura do erro que a NVIDIA devolve.
 *
 * Importam porque é essa frase que chega ao usuário quando algo dá errado:
 * sem ela, sobra "erro ao chamar a API" e ninguém sabe o que consertar.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { explainFailure, redact } from '../src/lib/nvidia.js';

test('lê o motivo no campo detail', () => {
  const text = JSON.stringify({ detail: 'Model not found: meta/llama-3.3-70b-instruct' });
  assert.equal(explainFailure(text), 'Model not found: meta/llama-3.3-70b-instruct');
});

test('lê o motivo no campo message', () => {
  const text = JSON.stringify({ message: 'max_tokens exceeds the limit' });
  assert.equal(explainFailure(text), 'max_tokens exceeds the limit');
});

test('lê o motivo em error.message', () => {
  const text = JSON.stringify({ error: { message: 'Insufficient credits' } });
  assert.equal(explainFailure(text), 'Insufficient credits');
});

test('lê o motivo quando error é só uma string', () => {
  const text = JSON.stringify({ error: 'bad request' });
  assert.equal(explainFailure(text), 'bad request');
});

test('detail tem precedência sobre message', () => {
  const text = JSON.stringify({ detail: 'primeiro', message: 'segundo' });
  assert.equal(explainFailure(text), 'primeiro');
});

test('corpo que não é JSON vem como texto cru', () => {
  assert.equal(explainFailure('Bad Gateway'), 'Bad Gateway');
});

test('corpo vazio não vira motivo', () => {
  assert.equal(explainFailure(''), null);
  assert.equal(explainFailure('   '), null);
  assert.equal(explainFailure(undefined), null);
});

test('quebras de linha viram espaço simples', () => {
  assert.equal(explainFailure('erro\n\n  em  várias\tlinhas'), 'erro em várias linhas');
});

test('motivo longo é truncado', () => {
  const out = explainFailure(JSON.stringify({ detail: 'x'.repeat(500) }));
  assert.equal(out.length, 201, 'duzentos caracteres mais a reticência');
  assert.ok(out.endsWith('…'));
});

test('a chave da NVIDIA é apagada do motivo', () => {
  const text = JSON.stringify({ detail: 'invalid key nvapi-abc123DEF-xyz enviada' });
  const out = explainFailure(text);
  assert.ok(!out.includes('abc123DEF'), `vazou: ${out}`);
  assert.match(out, /nvapi-\*\*\*/);
});

test('a chave é apagada também de corpo que não é JSON', () => {
  const out = explainFailure('upstream exploded, key was nvapi-SEGREDO-123');
  assert.ok(!out.includes('SEGREDO'), `vazou: ${out}`);
});

test('redact apaga todas as ocorrências', () => {
  const out = redact('nvapi-um e nvapi-dois no mesmo texto');
  assert.equal(out, 'nvapi-*** e nvapi-*** no mesmo texto');
});

test('redact não mexe em texto sem chave', () => {
  assert.equal(redact('nada a esconder aqui'), 'nada a esconder aqui');
});
