// Testes da leitura do lote de robôs (linha "lote:resumo") e da situação de cada robô (npm test).
// O exemplo é a saída de verdade do exportador num ensaio do lote (set/2026), com o histórico encurtado.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loteDeLinhas } from "./lote.ts";
import { montarEntidades, type Entrada } from "./estados.ts";

const EXEMPLO = JSON.parse(readFileSync(new URL("./exemplos/lote-resumo.json", import.meta.url), "utf8"));
const AGORA = Date.parse(EXEMPLO.gerado_em) + 10 * 60000;
const linha = (c: unknown) => [{ chave: "lote:resumo", conteudo: typeof c === "string" ? c : JSON.stringify(c), atualizado: EXEMPLO.gerado_em }];
const entrada = (lote: unknown, p: Partial<Entrada> = {}): Entrada => ({
  vivo: null, viz: { bolsa: null, intradia: null, carteiras: null }, agora: AGORA,
  conexao: { estado: "ok", lidoEm: new Date(AGORA).toISOString() }, lote: loteDeLinhas(linha(lote)),
  pregao: { EUA: { aberto: false, texto: "fechado · abre amanhã às 10:30" }, B3: { aberto: true, texto: "pregão aberto" } }, ...p,
});
const lote = (e: Entrada) => montarEntidades(e).filter(x => x.id.startsWith("lote:"));

test("sem a linha ou estragada: nenhum robô do lote", () => {
  assert.equal(loteDeLinhas([]), null);
  assert.equal(loteDeLinhas(linha("{quebrado")), null);
  assert.deepEqual(loteDeLinhas(linha({ robos: { a: null } }))!.robos, []);
});

test("os 9 robôs viram cartões de observação, cada um com sua moeda, régua e última decisão", () => {
  const l = lote(entrada(EXEMPLO));
  assert.equal(l.length, 9);
  assert.ok(l.every(x => x.estagio === "Observação (lote)" && x.veredito && /OBSERVAÇÃO/.test(x.veredito)));
  const efa = l.find(x => x.id === "lote:mm10m-efa")!;
  assert.equal(efa.mercado, "EUA");
  assert.equal(efa.moeda, "USD");
  assert.equal(efa.estado, "aguardando-mercado", "EUA fechado no exemplo");
  assert.equal(efa.carteira!.fecha, true);
  assert.ok(efa.regua && efa.regua.nome.includes("EFA"));
  assert.equal(efa.decisao!.tipo, "nao");
  const ief = l.find(x => x.id === "lote:mm10m-ief")!;
  assert.match(ief.decisao!.txt, /^não operou: seguir em caixa/);
  const vnq = l.find(x => x.id === "lote:mm10m-vnq")!;
  assert.equal(vnq.decisao!.tipo, "vai", "vender na próxima abertura é decisão de operar");
  const parada = structuredClone(EXEMPLO);
  parada.robos["mm10m-vnq"].ultima_decisao.texto = "vender VNQ na próxima abertura (não executa: conta pausada)";
  parada.robos["mm20-sol"].ultima_decisao.texto = "sem sinal: ainda não há histórico suficiente para a regra";
  const l2 = lote(entrada(parada));
  assert.equal(l2.find(x => x.id === "lote:mm10m-vnq")!.decisao!.tipo, "nao", "o motor avisou que não executa");
  assert.equal(l2.find(x => x.id === "lote:mm20-sol")!.decisao!.tipo, "nao");
  const bova = l.find(x => x.id === "lote:mm20-bova11")!;
  assert.equal(bova.estado, "ativo", "B3 aberta no exemplo");
  assert.equal(bova.moeda, "BRL");
  assert.equal(l.find(x => x.id === "lote:mm20-sol")!.estado, "ativo", "cripto não tem pregão fechado");
});

test("capital insuficiente, pausa, botão, diário mexido e caixa que não fecha", () => {
  const ex = structuredClone(EXEMPLO);
  ex.robos["mm10m-efa"].situacao = "capital insuficiente";
  ex.robos["mm10m-efa"].capital_insuficiente = { ativo: "EFA", preco: 95.2, disponivel: 50, minimo_por_ordem: 95.25, capital_minimo_da_regra: 95.25, dia_do_preco: "2026-09-30" };
  ex.robos["mm10m-ief"].situacao = "pausada"; ex.robos["mm10m-ief"].motivo = "perda do dia passou de 15%";
  ex.robos["mm20-sol"].conciliacao = ["caixa 10,00 a mais que o diário"];
  let l = lote(entrada(ex));
  assert.equal(l.find(x => x.id === "lote:mm10m-efa")!.estado, "sem-capital");
  assert.match(l.find(x => x.id === "lote:mm10m-efa")!.motivo, /não compram uma unidade de EFA/);
  assert.equal(l.find(x => x.id === "lote:mm10m-ief")!.estado, "pausado");
  const sol = l.find(x => x.id === "lote:mm20-sol")!;
  assert.equal(sol.carteira!.fecha, false);
  assert.match(sol.alerta!, /não fecha/);
  ex.diario_integro = false; ex.diario_problema = "linha 7 mexida"; ex.botao_parar = "teste";
  l = lote(entrada(ex));
  assert.ok(l.every(x => x.estado === "parado"));
  assert.ok(l.every(x => /diário do lote não confere/.test(x.alerta || "")));
});

test("relatório parado há mais de 2h30 vira dado velho; falha de conexão vence tudo", () => {
  assert.ok(lote(entrada(EXEMPLO, { agora: Date.parse(EXEMPLO.relatorio_em) + 151 * 60000, conexao: { estado: "ok", lidoEm: "x" } }))
    .every(x => x.estado === "dado-velho"));
  assert.ok(lote(entrada(EXEMPLO, { conexao: { estado: "erro", msg: "sem rede", ultimaOk: null } })).every(x => x.estado === "falha-conexao"));
});
