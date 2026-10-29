// Testes da Visão geral (encaminhamento de 29/10/2026, §8 e §10): grupos que não confundem espera com falha, contagens
// separadas, "precisa de você" só quando o registro diz Sebastian, resumo feito por regra, gastos reais, mudanças
// desde a última visita e os casos difíceis (tudo em caixa, sem sinal, sem informação, capital insuficiente).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  grupoDe, cartaoSimples, contar, nomeSimples, ritmo, tarefasDeLinhas, colunasTarefas, doSebastian, pedidos,
  custosDeLinhas, resumo, retrato, mudancas, projecaoDe, nomeCusto, contarEquipe,
} from "./visao.ts";
import type { Entidade, Mercado } from "./estados";
import type { ResultadoOp } from "./escritorio";

const AGORA = Date.parse("2026-10-29T11:05:00Z");
function ent(id: string, mercado: Mercado, extra: Partial<Entidade> = {}): Entidade {
  return {
    id, tipo: "robo", nome: "MM20 · BTC", mercado, estrategia: "MM20", versao: "v1", horizonte: "Diário", estagio: "Observação",
    estado: "ativo", motivo: "Em caixa.", ultima: "rodada de 29/10, 00:02", proxima: null, moeda: "USDT", capital: 1000, patrimonio: 1000, resultado: 0,
    quedaMax: null, custos: null, posicoes: [], amostra: "", regra: "", dados: "", parecer: null, custoIA: "", linha: [], ...extra,
  };
}
const res = (x: Partial<ResultadoOp> = {}): ResultadoOp => ({
  moeda: "USDT", tipo: "robo", capital: 1000, patrimonio: 1000, a_preco_de: "2026-10-29T10:30:00Z", dia: 0, aporte_dia: 0,
  base_dia: 1000, base_origem: null, base_em: "2026-10-29T03:00:00Z", acumulado: 0, sem_marcacao: null, realizado: null, nao_realizado: null, ...x,
});

// Linhas reais lidas da tabela do n8n em 29/10/2026 11:00 UTC (só tarefas e custos), guardadas como exemplo.
const REAIS = JSON.parse(readFileSync(new URL("./exemplos/linhas-2026-10-29.json", import.meta.url), "utf8"));

test("grupos: posição na mesa, sem posição espera, falha é problema e sem telemetria é sem informação", () => {
  assert.equal(grupoDe(ent("a", "Cripto", { posicoes: ["BTC"] })), "posicao");
  assert.equal(grupoDe(ent("a", "Cripto")), "esperando");
  assert.equal(grupoDe(ent("a", "Cripto", { estado: "sem-capital" })), "esperando");
  for (const e of ["falha-conexao", "dado-velho", "pausado", "parado"] as const) assert.equal(grupoDe(ent("a", "Cripto", { estado: e, posicoes: ["BTC"] })), "problema", e);
  assert.equal(grupoDe(ent("a", "Cripto", { semTelemetria: true })), "sem-info");
  assert.equal(grupoDe(ent("a", "Cripto", { estado: "aguardando-dado" })), "sem-info");
});

test("cartão: o que é, o que faz, por que espera e quando é a próxima", () => {
  const c = cartaoSimples(ent("cripto:mm20-btc", "Cripto", {
    espera: { curto: "sem sinal · abaixo da MM20", txt: "não operou: o fechamento não passou da média de 20 dias", proxima: "2026-10-30T00:02:00Z", evento: null },
    res: res(),
  }), AGORA);
  assert.equal(c.nome, "Média de 20 dias · Bitcoin");
  assert.equal(c.tecnico, "MM20 · BTC");
  assert.equal(c.ritmo, "decide uma vez por dia");
  assert.equal(c.agora, "sem posição (em caixa)");
  assert.match(c.porque, /não passou da média/);
  assert.match(c.proxima, /^próxima avaliação 21:02$/);
  assert.equal(c.resultado.txt, "DIA 0,00 USDT (0,00%)");   // zero é neutro, não some
  assert.equal(c.resultado.tom, "neutro");
  assert.match(c.horarios, /preço de 29\/10, 07:30 · última avaliação: rodada de 29\/10, 00:02/);
});

test("cartão: dado ausente é 'sem informação', nunca zero", () => {
  const c = cartaoSimples(ent("x", "EUA"), AGORA);
  assert.equal(c.resultado.txt, "sem informação");
  const s = cartaoSimples(ent("x", "EUA", { semTelemetria: true }), AGORA);
  assert.equal(s.agora, "não recebemos informação deste robô");
});

test("cartão: ganho verde, perda vermelha, com sinal e moeda; aporte não vira lucro", () => {
  assert.equal(cartaoSimples(ent("x", "Cripto", { res: res({ dia: 12.5 }) }), AGORA).resultado.tom, "bom");
  const p = cartaoSimples(ent("x", "Cripto", { res: res({ dia: -3.2 }) }), AGORA).resultado;
  assert.equal(p.tom, "ruim"); assert.match(p.txt, /^DIA −3,20 USDT/);
  const a = cartaoSimples(ent("x", "B3", { res: res({ moeda: "BRL", dia: 0, aporte_dia: 300 }) }), AGORA).resultado;
  assert.match(a.nota, /aporte de R\$ 300,00 hoje \(não é lucro\)/);
});

test("cartão: capital insuficiente e intenção da abertura têm frases próprias", () => {
  assert.match(cartaoSimples(ent("x", "EUA", { estado: "sem-capital" }), AGORA).agora, /não dá para comprar nem uma unidade/);
  const e = ent("bolsa:eua:mm10m-spy", "EUA", { espera: { curto: "compra na abertura de 29/10", txt: "decidiu comprar", proxima: null, evento: null } });
  assert.equal(projecaoDe(e), "compra na abertura de 29/10");
  assert.match(cartaoSimples(e, AGORA).agora, /ainda não executado/);
  assert.equal(projecaoDe(ent("x", "EUA", { espera: { curto: "sem sinal · abaixo da MM10m", txt: "", proxima: null, evento: null } })), null);
});

test("nomes e ritmos em português", () => {
  assert.equal(nomeSimples({ nome: "MM10M · SPY", estrategia: "MM10M", tipo: "robo" }), "Média de 10 meses · S&P 500 (SPY)");
  assert.equal(nomeSimples({ nome: "Segurar SPY", estrategia: "Só segurar", tipo: "regua" }), "Segurar SPY");
  assert.equal(ritmo("Intradia (30 min)"), "day trade: confere a cada 30 minutos e fecha tudo no fim do dia");
  assert.equal(ritmo("Mensal"), "decide no último pregão do mês");
});

test("equipe: agentes de IA e apoio, sem contar de novo quem opera", () => {
  const m = [{ id: "maestro", tipo: "ia" }, { id: "revisor", tipo: "ia" }, { id: "vigia", tipo: "robo" }, { id: "operador-cripto", tipo: "robo" }, { id: "lote-robos", tipo: "robo" }, { id: "robo-orb-b3", tipo: "robo" }];
  assert.deepEqual(contarEquipe(m), { ia: 2, apoio: 1 });
  assert.equal(contarEquipe([]), null);
});

test("cartão: quem marca uma vez por dia mostra 'hoje: sem preço novo' neutro, não alerta", () => {
  const c = cartaoSimples(ent("x", "EUA", { res: res({ moeda: "USD", a_preco_de: "2026-10-28", base_em: "2026-10-29T03:00:00Z" }) }), AGORA);
  assert.equal(c.resultado.txt, "hoje: sem preço novo desde 28/10"); assert.equal(c.resultado.tom, "neutro");
});

test("contagens separadas: robôs, estratégias, comparações e carteiras não se somam", () => {
  const l = [ent("a", "Cripto", { posicoes: ["BTC"] }), ent("b", "Cripto", { estrategia: "Ruído" }), ent("c", "EUA", { estado: "parado" }),
    ent("d", "EUA", { tipo: "regua" }), ent("e", "B3", { tipo: "carteira" }), ent("f", "B3", { semTelemetria: true })];
  const c = contar(l, { ia: 10, apoio: 17 });
  assert.deepEqual({ ...c.porGrupo }, { posicao: 1, esperando: 1, problema: 1, "sem-info": 1 });
  assert.equal(c.robos, 4); assert.equal(c.estrategias, 2); assert.equal(c.comparacoes, 1); assert.equal(c.carteiras, 1); assert.deepEqual(c.agentes, { ia: 10, apoio: 17 });
});

test("tarefas reais: colunas e 'precisa de você' só quando quem resolve é o Sebastian", () => {
  const t = tarefasDeLinhas(REAIS)!;
  const col = colunasTarefas(t.lista);
  assert.equal(col.execucao.length, 2); assert.equal(col.aguardando.length, 3); assert.equal(col.proximas.length, 3);
  assert.ok(col.incidentes.some(x => x.estado === "falhou")); assert.ok(col.incidentes.some(x => x.situacao === "atividade não confirmada"));
  const meus = t.lista.filter(doSebastian).map(x => x.id).sort();
  assert.deepEqual(meus, ["T-20261028-17", "T-20261029-04"]);          // o de horário da B3 é do Maestro, não do usuário
  const ps = pedidos(t)!;
  assert.equal(ps.length, 2);
  const beto = ps.find(x => /Beto/.test(x.titulo))!, avhist = ps.find(x => /avhist/.test(x.titulo))!;
  assert.match(beto.oQue, /^pedir ao Beto no Telegram/); assert.equal(beto.porque, "");          // a porta do n8n não aparece
  assert.match(avhist.oQue, /^decidir comprar dado de minuto/); assert.match(avhist.porque, /Alpha Vantage/);
  assert.equal(pedidos(null), null);                                    // sem registro: não dizer "nada precisa de você"
  assert.deepEqual(pedidos({ lista: [] }), []);
});

test("custos reais: teto, gasto, reserva, margem e disponível batem; dólar real à parte", () => {
  const c = custosDeLinhas(REAIS)!;
  assert.equal(c.teto, 200); assert.equal(c.gasto, 84.92); assert.equal(c.disponivel, 111.83); assert.equal(c.margem, 2);
  assert.equal(c.porTarefa[0][0], "HALLOWEEN-EUA-v1");
  assert.equal(nomeCusto("revisor"), "Revisor (confere as ideias)"); assert.equal(nomeCusto("HALLOWEEN-EUA-v3"), "Candidata HALLOWEEN-EUA-v3");
  assert.equal(custosDeLinhas([]), null);
});

test("resumo por regra: tudo em caixa, sem sinal, sem leitura e nada inventado", () => {
  const tudoCaixa = resumo({ lista: [ent("a", "Cripto"), ent("b", "Cripto")], tarefas: { lista: [] }, fabrica: null, custos: null, conexao: { ok: true } });
  assert.match(tudoCaixa[0], /Dos 2 robôs em simulação, nenhum tem posição e 2 estão sem posição/);
  assert.match(tudoCaixa[1], /Nenhuma tarefa da equipe está em execução confirmada/);
  const semLeitura = resumo({ lista: [], tarefas: null, fabrica: null, custos: null, conexao: { ok: false, msg: "sem rede", desde: null } });
  assert.match(semLeitura[0], /Não conseguimos ler os dados agora \(sem rede\)/);
  assert.ok(semLeitura.some(f => /registro de tarefas da equipe não chegou/.test(f)));
  const reais = resumo({ lista: [ent("a", "Cripto")], tarefas: tarefasDeLinhas(REAIS), fabrica: null, custos: custosDeLinhas(REAIS), conexao: { ok: true } });
  assert.ok(reais.some(f => /sem sinal há mais de 6 horas: Sinal de vida do robô PETR4/.test(f)));
  assert.ok(reais.some(f => /Despesa real de IA em 10\/2026: US\$ 84,92 de US\$ 200,00/.test(f)));
});

test("mudanças desde a última visita: compra, venda, problema, tarefa concluída e gasto", () => {
  const t = tarefasDeLinhas(REAIS);
  const antes = retrato([ent("a", "Cripto"), ent("b", "Cripto", { posicoes: ["2 SPY"] })], { lista: [] }, null, { gasto: 80 } as any, "x");
  const agora = retrato([ent("a", "Cripto", { posicoes: ["BTC"] }), ent("b", "Cripto", { estado: "falha-conexao" })], t, null, { gasto: 84.92 } as any, "y");
  const m = mudancas(antes, agora, t);
  assert.ok(m.includes("Média de 20 dias · Bitcoin comprou BTC."));
  assert.ok(m.includes("Média de 20 dias · Bitcoin vendeu SPY."));
  assert.ok(m.some(x => /passou para "com problema"/.test(x)));
  assert.ok(m.some(x => /^Tarefa concluída: Replay histórico/.test(x)));
  assert.ok(m.some(x => /subiu US\$ 4,92/.test(x)));
  assert.deepEqual(mudancas(null, agora, t), []);
});
