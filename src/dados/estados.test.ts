// Testes dos estados do salão: cada situação real vira o estado certo, e "aguardando mercado" nunca vira "falha".
// Rodam direto no Node (npm test), sem montar a tela.
import test from "node:test";
import assert from "node:assert/strict";
import { montarEntidades, filtrar, filtroVazio, opcoes, conciliar, capitalCarteira, ESTADOS, type Entrada, type Conexao } from "./estados.ts";
import type { Fonte } from "./formato";
import type { Vizinhas } from "./vizinhas";

const AGORA = Date.parse("2026-10-28T15:00:00Z");
const ha = (min: number) => new Date(AGORA - min * 60000).toISOString();
const OK: Conexao = { estado: "ok", lidoEm: ha(1) };

function vivo(extra: Partial<NonNullable<Fonte["status"]>> = {}): Fonte {
  const dia = (d: string, eq: number[], o: Fonte["dias"][0]["o"] = [], x: Fonte["dias"][0]["x"] = [], ev: string | null = null) =>
    ({ d, o, x, ev, eq, px: [1, 1, 1, 1, 1, 1, 1], pos: [["BTC"], [], []], st: ["ativa", "ativa", "ativa"] });
  return {
    sy: [], f0: "2026-10-26", fech: {},
    dias: [
      dia("2026-10-27", [10000, 10000, 10000], [["mm20-btc", "BTC", "compra", 9990, "regra"]]),
      dia("2026-10-28", [11000, 9500, 10200], [], [], "FOMC"),
    ],
    status: { gerado_em: ha(10), ultima_rodada: ha(14 * 60), ultimo_vigia: ha(30), diario_integro: true, situacao: { "mm20-btc": "ativa", "mm20-eth": "pausada", momentum: "ativa" }, motivo: { "mm20-eth": "perda de 15% no dia" }, ...extra } as Fonte["status"],
  };
}

const envelope = <R,>(relatorio: R, min = 10) => ({ gerado_em: ha(min), relatorio_em: ha(min), diario_integro: true, diario_problema: null, botao_parar: false, motivo_parar: null, relatorio });

function bolsa(aviso: string | null = null, ultimo: string | null = "2026-10-27") {
  const linha = (grupo: string, conta: string, extra = {}) => ({ grupo, conta, patrimonio: 10100, resultado: 0.01, queda_maxima: 0.02, operacoes: 1, situacao: grupo === "contas" ? "ativa" : null, motivo: null, posicoes: ["SPY"], veredito_lab: grupo === "referencias" ? null : "REPROVADA no laboratório em 27/10/2026", custos_pagos: 3, ...extra });
  return envelope({
    versao: "aovivo-bolsa-v1",
    mercados: {
      eua: { moeda: "USD", inicio: "2026-10-21", ultimo_pregao: ultimo, pregoes: 5, proximo_pregao: "2026-10-28", aviso, linhas: { a: linha("contas", "mm10m-spy"), b: linha("sombras", "mm10m-spy", { patrimonio: 10300 }), c: linha("referencias", "segurar-spy") } },
    },
  });
}

const carteiras = () => envelope({
  versao: "carteiras-r100-v1", capital_brl: 100, inicio: "2026-10-27", ultimo_dia: "2026-10-27",
  carteiras: {
    brasil: { nome: "Brasil", ativo: "BOVA11", moeda: "BRL", situacao: "capital insuficiente", motivo: null, valor_brl: 100, resultado: 0, quantidade: 0, comprou_em: null, preco_da_compra: null, preco_atual: 140, dia_do_preco: "2026-10-27", cambio_atual: null, custos_brl: 0, minimo_brl: 145.2, premissa: "lote de 1 cota", historico: [["2026-10-27", 100]] },
    eua: { nome: "EUA", ativo: "SPY", moeda: "USD", situacao: "sem dados", motivo: "Yahoo fora", valor_brl: 100, resultado: 0, quantidade: 0, comprou_em: null, preco_da_compra: null, preco_atual: null, dia_do_preco: null, cambio_atual: null, custos_brl: 0, minimo_brl: null, premissa: "fração", historico: [] },
    cripto: { nome: "Cripto", ativo: "BTC", moeda: "USDT", situacao: "investida", motivo: null, valor_brl: 101, resultado: 0.01, quantidade: 0.0002, comprou_em: "2026-10-27", preco_da_compra: 90000, preco_atual: 90000, dia_do_preco: "2026-10-27", cambio_atual: 5.5, custos_brl: 0.2, minimo_brl: null, premissa: "ordem mínima de 5 USDT", historico: [["2026-10-27", 101]] },
  },
});

const intradia = () => envelope({ versao: "aovivo-intradia-v1", dia: "2026-10-28", contas: { "ruido-btc": { situacao: "ativa", inicio_do_dia: 9900, operacoes_hoje: [{ hora: "13:30", lado: "compra", valor: 9800, preco: 90000, motivo: "saiu da faixa" }], veredito: "REPROVADA", sombra_inicio_do_dia: 9950 } }, boletins: [{ dia: "2026-10-27", contas: { "ruido-btc": { contas: { resultado_dia: -0.004 }, moeda_no_dia: 0.01 } } }] }, 3);

function entrada(p: Partial<Entrada> = {}): Entrada {
  return {
    vivo: vivo(), agora: AGORA, conexao: OK,
    viz: { bolsa: bolsa(), intradia: intradia(), carteiras: carteiras() } as unknown as Vizinhas,
    pregao: { EUA: { aberto: true, texto: "pregão aberto · fecha às 17:00" }, B3: { aberto: false, texto: "fechado" } },
    ...p,
  };
}
const achar = (e: Entrada, id: string) => montarEntidades(e).find(x => x.id === id)!;

test("cada estado tem rótulo e explicação", () => {
  for (const [k, v] of Object.entries(ESTADOS)) { assert.ok(v.rotulo && v.explica.length > 20, k); }
});

test("tudo em dia: ativo, pausado e capital insuficiente aparecem como são", () => {
  const e = entrada();
  assert.equal(achar(e, "cripto:mm20-btc").estado, "ativo");
  assert.equal(achar(e, "cripto:mm20-eth").estado, "pausado");
  assert.match(achar(e, "cripto:mm20-eth").motivo, /15%/);
  assert.equal(achar(e, "bolsa:eua:mm10m-spy").estado, "ativo");
  assert.equal(achar(e, "intradia:ruido-btc").estado, "ativo");
  assert.equal(achar(e, "carteira:brasil").estado, "sem-capital");
  assert.match(achar(e, "carteira:brasil").motivo, /145,20/);
  assert.equal(achar(e, "carteira:eua").estado, "aguardando-dado");
  assert.equal(achar(e, "carteira:cripto").estado, "ativo");
});

test("bolsa fechada é aguardando mercado, não falha", () => {
  const e = entrada({ pregao: { EUA: { aberto: false, texto: "fechado · abre amanhã às 10:30" }, B3: null } });
  const r = achar(e, "bolsa:eua:mm10m-spy");
  assert.equal(r.estado, "aguardando-mercado");
  assert.match(r.motivo, /abre amanhã/);
});

test("fonte de preços fora do ar na VPS é falha de conexão, com o motivo", () => {
  const e = entrada({ viz: { bolsa: bolsa("Yahoo respondeu 503"), intradia: null, carteiras: null } as unknown as Vizinhas });
  const r = achar(e, "bolsa:eua:mm10m-spy");
  assert.equal(r.estado, "falha-conexao");
  assert.match(r.motivo, /503/);
});

test("painel sem n8n: falha de conexão em todos, guardando o último dado", () => {
  const e = entrada({ conexao: { estado: "erro", msg: "sem conexão com o n8n", ultimaOk: ha(40) } });
  const todos = montarEntidades(e);
  assert.ok(todos.length >= 8);
  assert.ok(todos.every(x => x.estado === "falha-conexao"));
  assert.equal(achar(e, "cripto:mm20-btc").patrimonio, 11000);
  assert.match(achar(e, "cripto:mm20-btc").motivo, /Mostrando o que chegou/);
});

test("ao vivo não ligado: aguardando dado, sem inventar números", () => {
  const e = entrada({ vivo: null, viz: { bolsa: null, intradia: null, carteiras: null }, conexao: { estado: "sem-endereco" } });
  const t = montarEntidades(e);
  assert.equal(t.length, 3);
  assert.ok(t.every(x => x.estado === "aguardando-dado" && x.patrimonio === null));
  assert.match(t[0].motivo, /chave/);
});

test("dado velho: envio parado, vigia parado e day trade parado são distintos de falha", () => {
  assert.equal(achar(entrada({ vivo: vivo({ gerado_em: ha(200) }) }), "cripto:mm20-btc").estado, "dado-velho");
  const v = achar(entrada({ vivo: vivo({ ultimo_vigia: ha(300) }) }), "cripto:mm20-btc");
  assert.equal(v.estado, "dado-velho");
  assert.match(v.motivo, /vigia/);
  const it = intradia(); it.relatorio_em = ha(45);
  const d = achar(entrada({ viz: { bolsa: null, intradia: it, carteiras: null } as unknown as Vizinhas }), "intradia:ruido-btc");
  assert.equal(d.estado, "dado-velho");
  assert.match(d.motivo, /day trade/);
});

test("botão de parar vence tudo menos a falha de conexão", () => {
  const e = entrada({ vivo: vivo({ botao_parar: true, motivo_parar: "pedido do Beto" }) });
  assert.equal(achar(e, "cripto:momentum").estado, "parado");
  assert.match(achar(e, "cripto:momentum").motivo, /Beto/);
});

test("bolsa ainda sem pregão processado espera o mercado ou o dado", () => {
  const fechado = entrada({ viz: { bolsa: bolsa(null, null), intradia: null, carteiras: null } as unknown as Vizinhas, pregao: { EUA: { aberto: false, texto: "fechado" }, B3: null } });
  assert.equal(achar(fechado, "bolsa:eua:mm10m-spy").estado, "aguardando-mercado");
  const aberto = entrada({ viz: { bolsa: bolsa(null, null), intradia: null, carteiras: null } as unknown as Vizinhas });
  assert.equal(achar(aberto, "bolsa:eua:mm10m-spy").estado, "aguardando-dado");
});

test("detalhes: regra pura, custos, estágio e linha do tempo", () => {
  const e = entrada();
  const b = achar(e, "bolsa:eua:mm10m-spy");
  assert.equal(b.estagio, "Observação");
  assert.equal(b.custos, 3);
  assert.ok(Math.abs(b.sombra! - 0.03) < 1e-9);
  assert.equal(achar(e, "bolsa:eua:segurar-spy").tipo, "regua");
  const c = achar(e, "cripto:mm20-btc");
  assert.ok(c.linha.some(x => /compra BTC/.test(x.txt)));
  assert.ok(c.linha.some(x => /não operou: dia de FOMC/.test(x.txt)));
  assert.ok(Math.abs(achar(e, "cripto:mm20-eth").quedaMax! - (-0.05)) < 1e-9);
  assert.ok(achar(e, "intradia:ruido-btc").linha.some(x => /13:30/.test(x.d)));
});

test("filtros por mercado, estratégia, horizonte e estágio", () => {
  const t = montarEntidades(entrada());
  const f = filtroVazio();
  assert.equal(filtrar(t, f).length, t.length);
  assert.ok(filtrar(t, { ...f, mercado: "Cripto" }).every(x => x.mercado === "Cripto"));
  assert.deepEqual(filtrar(t, { ...f, horizonte: "Intradia (30 min)" }).map(x => x.id), ["intradia:ruido-btc"]);
  assert.ok(filtrar(t, { ...f, estagio: "Carteira de referência" }).every(x => x.tipo === "carteira"));
  const ops = opcoes(t, { ...f, mercado: "EUA" }, "estrategia");
  assert.equal(ops.find(o => o.valor === "MM20")!.n, 0);
  assert.equal(ops.find(o => o.valor === "MM10M")!.n, 1);
});

test("conciliação da carteira: caixa + ativo = valor, sem dinheiro a mais", () => {
  const ok = conciliar({ valor_brl: 101, quantidade: 0.0002, preco_atual: 90000, cambio_atual: 5.5, moeda: "USDT", situacao: "investida" }, 100);
  assert.ok(Math.abs(ok.exposicao - 99) < 1e-9);
  assert.ok(Math.abs(ok.caixa - 2) < 1e-9);
  assert.equal(ok.fecha, true);
  assert.equal(conciliar({ valor_brl: 300, quantidade: 0.0002, preco_atual: 90000, cambio_atual: 5.5, moeda: "USDT", situacao: "investida" }, 100).fecha, false);
  assert.equal(conciliar({ valor_brl: 100, quantidade: 0, preco_atual: 140, cambio_atual: null, moeda: "BRL", situacao: "capital insuficiente" }, 100).fecha, true);
  assert.equal(conciliar({ valor_brl: 100, quantidade: 1, preco_atual: null, cambio_atual: null, moeda: "USD", situacao: "investida" }, 100).fecha, false);
});

test("carteira com capital próprio: a Brasil de R$ 400 usa o dela, as outras o geral", () => {
  const v = carteiras() as any;
  v.relatorio.versao = "carteiras-r100-v2";
  Object.assign(v.relatorio.carteiras.brasil, { capital_brl: 400, situacao: "investida", quantidade: 2, comprou_em: "2026-10-28", preco_da_compra: 184, preco_atual: 184, dia_do_preco: "2026-10-28", valor_brl: 399.63, resultado: 399.63 / 400 - 1, custos_brl: 0.37, minimo_brl: null, historico: [["2026-10-28", 399.63]] });
  const e = entrada({ viz: { bolsa: null, intradia: null, carteiras: v } as unknown as Vizinhas });
  const br = achar(e, "carteira:brasil"), cr = achar(e, "carteira:cripto");
  assert.equal(br.capital, 400);
  assert.equal(br.estado, "ativo");
  assert.equal(br.carteira!.fecha, true, "caixa 31,63 + 2 cotas a 184 = valor");
  assert.equal(br.linha.find(x => /valor/.test(x.txt))!.tom, "ruim", "abaixo dos R$ 400, não dos R$ 100");
  assert.equal(cr.capital, 100);
  assert.equal(capitalCarteira({ capital_brl: 100 }, {}), 100);
  assert.equal(capitalCarteira({}, {}), 100);
  assert.equal(capitalCarteira({ capital_brl: 100 }, { capital_brl: 400 }), 400);
});
