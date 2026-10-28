// Testes da leitura do detalhe dos robôs (linha "robos:detalhe") e de como ele entra na ficha (npm test).
import test from "node:test";
import assert from "node:assert/strict";
import { detalheDeLinhas } from "./detalhe.ts";
import { comDetalhe, montarEntidades, type Entidade } from "./estados.ts";

const linha = (c: unknown) => [{ chave: "robos:detalhe", conteudo: typeof c === "string" ? c : JSON.stringify(c), atualizado: "2026-10-28T01:00:00Z" }];

// Pedaço do que o exportador gera (rodando a simulação de verdade com preços inventados).
const MM20 = {
  moeda: "USDT", caixa: 0, reservado: 0, exposicao: 11180.3, a_preco_de: "2026-10-06T00:02:00+00:00", custos: 37.8, operacoes: 3, pendente: null,
  conciliacao: { fecha: true, caixa_refeito: 0, diferenca: 0, nota: "Fecha: capital, 3 ordens do diário e custos refazem o caixa do estado." },
  linha: [
    { em: "2026-09-01T00:02:00+00:00", tipo: "op", txt: "compra BTC 9.988 USDT a 100,00 · custo 11,99 USDT" },
    { em: "2026-10-01T00:02:00+00:00", tipo: "nao", txt: "não operou: a regra manda seguir comprado em BTC e já estava.", vezes: 30, desde: "2026-09-02T00:02:00+00:00" },
    { em: "2026-10-01T12:00:00+00:00", tipo: "freio", txt: "pausou: perda do dia passou de 15% (-20.0%)" },
    { em: "2026-10-02T00:02:00+00:00", tipo: "freio", txt: "pausa de um dia encerrada; voltou a operar" },
    { em: "2026-10-06T00:02:00+00:00", tipo: "nao", txt: "não operou: a regra manda seguir comprado em BTC e já estava.", vezes: 4, desde: "2026-10-03T00:02:00+00:00" },
  ],
};

test("sem a linha ou com linha estragada: nada", () => {
  assert.equal(detalheDeLinhas([]), null);
  assert.equal(detalheDeLinhas(linha("{quebrado")), null);
  assert.equal(detalheDeLinhas(linha({ em: "x" })), null);
});

test("lê cada robô, aceita campo faltando e joga fora evento sem texto", () => {
  const d = detalheDeLinhas(linha({ em: "2026-10-28T01:00:00+00:00", erros: ["carteiras: KeyError"], robos: {
    "cripto:mm20-btc": MM20,
    "carteira:eua": { moeda: "BRL", caixa: 7.5, conciliacao: { fecha: false, nota: "Não fecha" }, linha: [{ em: "x", tipo: "marte", txt: "?" }, { tipo: "op" }] },
    "lixo": "nao é objeto",
  } }))!;
  assert.equal(d.erros.length, 1);
  assert.deepEqual(Object.keys(d.robos), ["cripto:mm20-btc", "carteira:eua"]);
  assert.equal(d.robos["cripto:mm20-btc"].linha[1].vezes, 30);
  const eua = d.robos["carteira:eua"];
  assert.equal(eua.reservado, 0);
  assert.equal(eua.exposicao, null);
  assert.equal(eua.linha.length, 1);
  assert.equal(eua.linha[0].tipo, "info");
  assert.equal(eua.conciliacao.fecha, false);
});

const base: Entidade = {
  id: "cripto:mm20-btc", tipo: "robo", nome: "MM20 · BTC", mercado: "Cripto", estrategia: "MM20", versao: "aovivo-v1", horizonte: "Diário",
  estagio: "Ao vivo simulado", estado: "ativo", motivo: "Comprado em BTC.", ultima: null, proxima: null, moeda: "USDT", capital: 10000,
  patrimonio: 11180, resultado: 0.118, quedaMax: -0.2, custos: null, posicoes: ["BTC"], amostra: "36 dias", regra: "", dados: "", parecer: null,
  custoIA: "", linha: [{ d: "2026-10-06", txt: "antiga" }],
};

test("o detalhe troca a linha do tempo, traz custos reais, dinheiro e a última decisão, sem mudar a situação", () => {
  const d = detalheDeLinhas(linha({ robos: { "cripto:mm20-btc": MM20 } }))!;
  const x = comDetalhe(base, d.robos["cripto:mm20-btc"]);
  assert.equal(x.estado, "ativo");
  assert.equal(x.custos, 37.8);
  assert.equal(x.linha[0].d, "2026-10-06T00:02:00+00:00", "mais recente primeiro");
  assert.equal(x.linha.length, 5);
  assert.equal(x.linha.find(e => /voltou/.test(e.txt))!.tom, "bom");
  assert.equal(x.linha.find(e => /pausou/.test(e.txt))!.tom, "ruim");
  assert.equal(x.decisao!.tipo, "nao");
  assert.match(x.decisao!.txt, /seguir comprado/);
  assert.equal(x.carteira!.real, true);
  assert.equal(x.carteira!.exposicao, 11180.3);
  assert.equal(x.carteira!.fecha, true);
  assert.equal(comDetalhe(base, undefined), base, "robô sem detalhe fica como estava");
});

test("na montagem, quem tem detalhe ganha; quem não tem continua igual", () => {
  const entrada = {
    vivo: null, agora: Date.parse("2026-10-28T15:00:00Z"), conexao: { estado: "ok" as const, lidoEm: "2026-10-28T14:59:00Z" },
    viz: { bolsa: null, intradia: null, carteiras: null }, pregao: { EUA: null, B3: null },
  };
  const sem = montarEntidades(entrada);
  const com = montarEntidades({ ...entrada, detalhe: detalheDeLinhas(linha({ robos: { "cripto:mm20-btc": MM20 } })) });
  assert.equal(sem.length, com.length);
  assert.equal(sem.find(x => x.id === "cripto:mm20-btc")!.carteira, undefined);
  assert.equal(com.find(x => x.id === "cripto:mm20-btc")!.carteira!.caixa, 0);
  assert.equal(com.find(x => x.id === "cripto:momentum")!.carteira, undefined);
});

test("motivo de estar fora da mesa e a regra pura do dia chegam do detalhe", () => {
  const espera = { curto: "sem sinal · abaixo do teto", txt: "checagem das 13:30 UTC: preço abaixo do teto", proxima: "2026-10-28T14:00:00+00:00", evento: "FOMC hoje: compra barrada" };
  const d = detalheDeLinhas(linha({ robos: { "cripto:mm20-btc": { ...MM20, espera, sombra_hoje: { operacoes: ["compra 08:30", "venda 11:30"], resultado: -0.0032, comprada: false, txt: "regra pura hoje (sem o motor de risco): compra 08:30, venda 11:30; -0,32% com custos" } },
    "cripto:mm20-eth": { ...MM20, espera: { txt: "sem curto não vale" } } } }))!;
  assert.deepEqual(d.robos["cripto:mm20-btc"].espera, espera);
  assert.equal(d.robos["cripto:mm20-eth"].espera, null);
  const x = comDetalhe({ ...base, sombra: 0.01 }, d.robos["cripto:mm20-btc"]);
  assert.equal(x.espera!.curto, "sem sinal · abaixo do teto");
  assert.ok(Math.abs(x.sombra! - (1.01 * 0.9968 - 1)) < 1e-12, "regra pura = acumulado até o começo do dia × o dia de hoje");
  assert.match(x.sombraHoje!, /compra 08:30, venda 11:30/);
});
