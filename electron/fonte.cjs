// Leitura da simulação ao vivo. Só GET, só leitura: este arquivo nunca envia nada que mude a VPS ou o n8n.
"use strict";

const LIMITE_BYTES = 2 * 1024 * 1024;
const TEMPO_MS = 15000;

// Endereço aceito: https, sem usuário/senha embutidos.
function validarEndereco(texto) {
  let u;
  try { u = new URL(String(texto || "").trim()); } catch { return { ok: false, erro: "endereço inválido" }; }
  if (u.protocol !== "https:") return { ok: false, erro: "o endereço precisa começar com https://" };
  if (u.username || u.password) return { ok: false, erro: "o endereço não pode levar usuário ou senha" };
  return { ok: true, endereco: u.toString() };
}

// Aceita o que o n8n devolve (lista, {data:[...]}, {rows:[...]}) e fica só com {chave, conteudo, atualizado} em texto.
function normalizarLinhas(corpo) {
  const lista = Array.isArray(corpo) ? corpo : corpo && (corpo.data || corpo.rows || corpo.linhas);
  if (!Array.isArray(lista)) return null;
  const linhas = [];
  for (const item of lista) {
    const r = item && item.json ? item.json : item;
    if (!r || typeof r.chave !== "string" || typeof r.conteudo !== "string") continue;
    if (r.chave.length > 40 || r.conteudo.length > 200000) continue;
    linhas.push({ chave: r.chave, conteudo: r.conteudo, atualizado: typeof r.atualizado === "string" ? r.atualizado : null });
  }
  return linhas;
}

async function lerFonte({ endereco, chave, fetchImpl = fetch }) {
  const v = validarEndereco(endereco);
  if (!v.ok) return v;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TEMPO_MS);
  try {
    const headers = { accept: "application/json" };
    if (chave) headers["x-painel-leitura"] = chave;
    const r = await fetchImpl(v.endereco, { method: "GET", headers, redirect: "error", signal: ctl.signal });
    if (r.status === 401 || r.status === 403) return { ok: false, erro: "o n8n recusou a chave de leitura" };
    if (!r.ok) return { ok: false, erro: `o n8n respondeu ${r.status}` };
    const texto = await r.text();
    if (texto.length > LIMITE_BYTES) return { ok: false, erro: "resposta grande demais" };
    let corpo;
    try { corpo = JSON.parse(texto); } catch { return { ok: false, erro: "a resposta não é JSON" }; }
    const linhas = normalizarLinhas(corpo);
    if (!linhas) return { ok: false, erro: "a resposta não tem as linhas do painel" };
    return { ok: true, linhas, lidoEm: new Date().toISOString() };
  } catch (e) {
    return { ok: false, erro: e && e.name === "AbortError" ? "o n8n demorou demais para responder" : "sem conexão com o n8n" };
  } finally {
    clearTimeout(t);
  }
}

module.exports = { validarEndereco, normalizarLinhas, lerFonte };
