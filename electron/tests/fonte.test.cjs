"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { validarEndereco, normalizarLinhas, lerFonte } = require("../fonte.cjs");

const resposta = (status, corpo) => async () => ({ status, ok: status >= 200 && status < 300, text: async () => corpo });

test("endereço precisa ser https e sem senha", () => {
  assert.equal(validarEndereco("http://n8n.exemplo/webhook/x").ok, false);
  assert.equal(validarEndereco("https://u:s@n8n.exemplo/webhook/x").ok, false);
  assert.equal(validarEndereco("nada").ok, false);
  assert.equal(validarEndereco(" https://n8n.exemplo/webhook/x ").ok, true);
});

test("normaliza os formatos do n8n e descarta lixo", () => {
  const ok = { chave: "status", conteudo: "{}", atualizado: "2026-10-26" };
  assert.deepEqual(normalizarLinhas([ok]), [ok]);
  assert.deepEqual(normalizarLinhas({ data: [ok] }), [ok]);
  assert.deepEqual(normalizarLinhas({ rows: [{ json: ok }] }), [ok]);
  assert.deepEqual(normalizarLinhas([{ chave: 1, conteudo: "x" }, null, { chave: "a" }]), []);
  assert.equal(normalizarLinhas({ outra: 1 }), null);
});

test("só faz GET, manda a chave no cabeçalho de leitura e não segue redirecionamento", async () => {
  let pedido;
  const r = await lerFonte({
    endereco: "https://n8n.exemplo/webhook/ler",
    chave: "abc",
    fetchImpl: async (url, opts) => { pedido = { url, opts }; return resposta(200, JSON.stringify([{ chave: "status", conteudo: "{}" }]))(); },
  });
  assert.equal(r.ok, true);
  assert.equal(pedido.opts.method, "GET");
  assert.equal(pedido.opts.headers["x-painel-leitura"], "abc");
  assert.equal(pedido.opts.redirect, "error");
  assert.equal(pedido.opts.body, undefined);
});

test("erros viram mensagens simples", async () => {
  const e = "https://n8n.exemplo/webhook/ler";
  assert.match((await lerFonte({ endereco: e, fetchImpl: resposta(403, "") })).erro, /recusou/);
  assert.match((await lerFonte({ endereco: e, fetchImpl: resposta(500, "") })).erro, /500/);
  assert.match((await lerFonte({ endereco: e, fetchImpl: resposta(200, "<html>") })).erro, /JSON/);
  assert.match((await lerFonte({ endereco: e, fetchImpl: async () => { throw new Error("x"); } })).erro, /conexão/);
});
