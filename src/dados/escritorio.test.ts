// Testes do escritório operacional (npm test): relógio por segmento, sinal do dinheiro, rótulo de ganho e perda,
// inventário e as cinco dimensões. As janelas são as que o exportador montou com o calendário de verdade (out/nov 2026).
import test from "node:test";
import assert from "node:assert/strict";
import {
  faseAgora, escritorioAgora, comSinal, rotuloFinanceiro, reconciliarInventario, atividade, prontidaoDeLinhas,
  resultadoDeLinhas, horaCurta, linhaEspera, tarefasDeLinhas, agentesDeLinhas, atividadeTarefas,
  type Segmento, type Prontidao, type ResultadoOp, type OperadorInv,
} from "./escritorio.ts";

const B3_ETF: Segmento = {
  nome: "B3 · ETFs", exemplos: "BOVA11", fuso: "America/Sao_Paulo", fase: "x", texto: "x", fonte: "teste",
  janelas: [
    { dia: "2026-10-30", pre: "2026-10-30T12:45:00+00:00", abre: "2026-10-30T13:05:00+00:00", fecha: "2026-10-30T19:55:00+00:00", call_fim: "2026-10-30T20:00:00+00:00" },
    { dia: "2026-11-03", pre: "2026-11-03T12:45:00+00:00", abre: "2026-11-03T13:05:00+00:00", fecha: "2026-11-03T20:55:00+00:00", call_fim: "2026-11-03T21:00:00+00:00" },
  ],
};
const EUA: Segmento = {
  nome: "EUA · NYSE", exemplos: "SPY", fuso: "America/New_York", fase: "x", texto: "x", fonte: "teste",
  janelas: [
    { dia: "2026-10-30", pre: null, abre: "2026-10-30T13:30:00+00:00", fecha: "2026-10-30T20:00:00+00:00", call_fim: null },
    { dia: "2026-11-02", pre: null, abre: "2026-11-02T14:30:00+00:00", fecha: "2026-11-02T21:00:00+00:00", call_fim: null },
  ],
};
const t = (iso: string) => Date.parse(iso);

test("ETF da B3: pré-abertura 9h45, negocia às 10h05 (não às 9h)", () => {
  assert.equal(faseAgora("b3-etf", B3_ETF, t("2026-10-30T12:00:00Z")).fase, "fechado");      // 9h00 Brasília
  const pre = faseAgora("b3-etf", B3_ETF, t("2026-10-30T12:50:00Z"));                         // 9h50
  assert.equal(pre.fase, "pre_abertura");
  assert.equal(pre.proximo, "negocia às 10:05");
  assert.equal(faseAgora("b3-etf", B3_ETF, t("2026-10-30T13:05:00Z")).fase, "negociacao");
  assert.equal(faseAgora("b3-etf", B3_ETF, t("2026-10-30T19:57:00Z")).fase, "leilao_fechamento");
  assert.equal(faseAgora("b3-etf", B3_ETF, t("2026-10-30T20:01:00Z")).fase, "encerrado");
});

test("grade nova da B3 a partir de 03/11: negocia até 17h55", () => {
  assert.equal(faseAgora("b3-etf", B3_ETF, t("2026-11-03T20:30:00Z")).fase, "negociacao");     // 17h30 Brasília
  assert.equal(faseAgora("b3-etf", B3_ETF, t("2026-11-03T20:30:00Z")).proximo, "fecha às 17:55");
});

test("feriado (02/11, Finados) aparece como sem sessão e aponta a próxima", () => {
  const f = faseAgora("b3-etf", B3_ETF, t("2026-11-02T14:00:00Z"));
  assert.equal(f.fase, "fechado");
  assert.equal(f.texto, "sem sessão hoje");
  assert.match(f.proximo || "", /03\/11.*10:05/);
});

test("EUA abre 9h30 de Nova York: 10h30 em Brasília em 30/10, 11h30 depois do fim do horário de verão de lá", () => {
  assert.equal(faseAgora("eua", EUA, t("2026-10-30T13:29:00Z")).fase, "fechado");
  assert.equal(faseAgora("eua", EUA, t("2026-10-30T13:30:00Z")).fase, "negociacao");
  assert.equal(faseAgora("eua", EUA, t("2026-11-02T13:30:00Z")).fase, "fechado");
  assert.equal(faseAgora("eua", EUA, t("2026-11-02T14:30:00Z")).fase, "negociacao");
});

test("cripto é contínuo e segmento sem relógio da VPS avisa em vez de inventar", () => {
  assert.equal(faseAgora("cripto", undefined, Date.now()).fase, "continuo");
  assert.equal(faseAgora("eua", undefined, Date.now()).tom, "aviso");
});

const PRONT = (bloqueios = 0): Prontidao => ({
  em: "2026-10-30T11:50:00Z", sessoes: {}, escritorio: { preparo_inicio: "08:30", preparo_fim: "08:55", pronto: "09:00" },
  inventario: { fonte_aprovado: "teste", operadores: [] }, simulacoes: [],
  checklist: { mercados: { b3: { situacao: bloqueios ? "bloqueio" : "pronto", prontos: 3, esperando: 0, bloqueios, itens: [] } } },
} as unknown as Prontidao);

test("escritório: preparando às 8h40, pronto às 9h; impedimento fica vermelho", () => {
  assert.equal(escritorioAgora(PRONT(), t("2026-10-30T11:40:00Z")).texto, "preparando (pronto às 09:00)");
  assert.equal(escritorioAgora(PRONT(), t("2026-10-30T12:00:00Z")).texto, "pronto desde as 09:00");
  assert.equal(escritorioAgora(PRONT(1), t("2026-10-30T12:00:00Z")).tom, "ruim");
  assert.equal(escritorioAgora(null, Date.now()).tom, "aviso");
});

test("sinal do dinheiro: moeda certa e nunca −0,00", () => {
  assert.equal(comSinal(3.24, "BRL"), "+R$ 3,24");
  assert.equal(comSinal(-1.1, "USD"), "−US$ 1,10");
  assert.equal(comSinal(0.18, "USDT"), "+0,18 USDT");
  assert.equal(comSinal(0, "BRL"), "R$ 0,00");
  assert.equal(comSinal(0.001, "BRL"), "+<R$ 0,01");
  assert.equal(comSinal(-0.001, "BRL"), "−<R$ 0,01");
});

const R = (p: Partial<ResultadoOp>): ResultadoOp => ({
  moeda: "BRL", tipo: "carteira", capital: 400, patrimonio: 401.5, a_preco_de: "2026-10-28", dia: 1.5, aporte_dia: 0,
  base_dia: 100, base_origem: "última marcação de 2026-10-27", base_em: null, acumulado: 1.5, sem_marcacao: null,
  realizado: null, nao_realizado: null, ...p,
} as ResultadoOp);

test("rótulo: aporte não vira lucro e o período escolhe o número", () => {
  const r = R({ aporte_dia: 300, dia: 1.5, acumulado: 1.5 });
  const d = rotuloFinanceiro(r, "dia")!;
  assert.equal(d.txt, "DIA +R$ 1,50 (+1,50%)");
  assert.equal(d.tom, "bom");
  assert.match(d.nota, /aporte de R\$ 300,00 hoje \(não é lucro\)/);
  assert.equal(rotuloFinanceiro(R({ acumulado: -2 }), "acumulado")!.txt, "ACUM −R$ 2,00 (−0,50%)");
  assert.equal(rotuloFinanceiro(R({ acumulado: -2 }), "acumulado")!.tom, "ruim");
  assert.equal(rotuloFinanceiro(R({ dia: 0 }), "dia")!.tom, "neutro");
});

test("quem só marca uma vez por dia não mostra um 0,00 que parece resultado: diz desde quando é o preço", () => {
  // Momentum de 28/10: marcado às 00:02 UTC (21h02 de 27/10 em Brasília), base do dia tirada às 12:40 UTC.
  const r = R({ moeda: "USDT", capital: 10000, patrimonio: 10036.78, a_preco_de: "2026-10-28T00:02:02+00:00", dia: 0, base_dia: 10036.78,
    base_em: "2026-10-28T12:40:02+00:00", acumulado: 36.78 });
  const d = rotuloFinanceiro(r, "dia")!;
  assert.equal(d.txt, "DIA — sem preço novo desde 27/10, 21:02");
  assert.equal(d.tom, "aviso");
  assert.equal(rotuloFinanceiro(r, "acumulado")!.txt, "ACUM +36,78 USDT (+0,37%)");
  assert.equal(rotuloFinanceiro({ ...r, a_preco_de: "2026-10-28T16:00:00+00:00", dia: 5 }, "dia")!.txt, "DIA +5,00 USDT (+0,05%)");
  assert.equal(rotuloFinanceiro({ ...r, a_preco_de: "2026-10-27" }, "dia")!.tom, "aviso");  // bolsa: só o fechamento de ontem
});

test("rótulo sem preço diz que não tem marcação (amarelo), e quem não tem conta não ganha rótulo", () => {
  const r = rotuloFinanceiro(R({ dia: null, sem_marcacao: "ainda sem fechamento processado" }), "dia")!;
  assert.equal(r.txt, "DIA — sem marcação");
  assert.equal(r.tom, "aviso");
  assert.equal(rotuloFinanceiro(undefined, "dia"), null);
});

test("inventário: aprovado que não chegou continua na conta e aparece como faltando", () => {
  const op = (id: string, p: Partial<OperadorInv>): OperadorInv => ({
    id, origem: "lote", aprovado: true, instalado: true, processo_em_dia: true, no_cron: true, enviado: true, situacao: "ok", ...p,
  } as OperadorInv);
  const p = { ...PRONT(), inventario: { fonte_aprovado: "teste", operadores: [
    op("lote:a", {}), op("lote:b", { enviado: false, situacao: "não chegou ao painel" }), op("pc:orb-petr4", { instalado: false, situacao: "depende do PC" }),
  ] } } as Prontidao;
  const e = reconciliarInventario(p, new Set(["lote:a"]))!;
  assert.equal(e.total, 3);
  assert.equal(e.aprovados, 3);
  assert.equal(e.instalados, 2);
  assert.equal(e.enviados, 2);
  assert.equal(e.desenhados, 1);
  assert.deepEqual(e.faltando.map(o => o.id), ["lote:b", "pc:orb-petr4"]);
});

test("atividade: só fica no posto quem está trabalhando agora; sem tarefa vai para o lazer; sem dado fica com alerta", () => {
  const agora = t("2026-10-30T15:00:00Z");
  const sem = atividade(undefined, agora);
  assert.equal(sem.txt, "sem registro");
  assert.equal(sem.posto, "alerta");
  const m = { id: "sentinela-api", nome: "Sentinela", papel: "", quando: "07h", executando: false, ultima: null, texto: null, fonte: "", prova_na_vps: false, sem_prova: "a nuvem não deixa prova na VPS" };
  assert.deepEqual([atividade([m] as never, agora).txt, atividade([m] as never, agora).posto], ["sem tarefa · aguardando agenda", "folga"]);
  const recente = atividade([{ ...m, ultima: "2026-10-30T10:00:00Z", texto: "relatório" }] as never, agora);
  assert.match(recente.txt, /^sem tarefa · última \d\d:\d\d$/);
  assert.equal(recente.posto, "folga");
  const velho = atividade([{ ...m, ultima: "2026-10-27T10:00:00Z", texto: "relatório" }] as never, agora);
  assert.match(velho.txt, /^parado desde/);
  assert.equal(velho.posto, "alerta");
  const agoraMesmo = atividade([{ ...m, executando: true }] as never, agora);
  assert.equal(agoraMesmo.txt, "trabalhando agora");
  assert.equal(agoraMesmo.posto, "trabalhando");
});

test("linhas novas estragadas ou ausentes não quebram o painel", () => {
  assert.equal(prontidaoDeLinhas([]), null);
  assert.equal(prontidaoDeLinhas([{ chave: "prontidao:resumo", conteudo: "{", atualizado: "" }]), null);
  assert.equal(resultadoDeLinhas([{ chave: "resultado:resumo", conteudo: "{}", atualizado: "" }]), null);
});

test("lazer: hora da próxima rodada em Brasília e evento do calendário na segunda linha", () => {
  const agora = t("2026-10-28T13:42:00Z");
  assert.equal(horaCurta("2026-10-29T00:02:00+00:00", agora), "21:02");
  assert.equal(horaCurta("2026-11-02T00:02:00+00:00", agora), "01/11 21:02");
  assert.equal(horaCurta(null, agora), "");
  assert.equal(linhaEspera({ curto: "sem sinal · abaixo do teto", proxima: "2026-10-28T14:00:00+00:00", evento: "FOMC hoje: compra barrada" }, agora),
    "FOMC hoje · próx. 11:00");
  // o evento já está no motivo: não repete
  assert.equal(linhaEspera({ curto: "compra recusada · FOMC", proxima: "2026-10-28T14:00:00+00:00", evento: "FOMC hoje: compra barrada" }, agora), "próx. 11:00");
  assert.equal(linhaEspera({ curto: "conta pausada pelo motor", proxima: null, evento: null }, agora), "");
});

test("tarefas: em execução fica no posto com a tarefa; não confirmada fica com aviso; só aguardando vai para o lazer", () => {
  const linha = (por_membro: unknown) => [{ chave: "tarefas:resumo", atualizado: "", conteudo: JSON.stringify({ em: "2026-10-28T17:00:00Z", registro_em: "2026-10-28T16:59:00Z", por_membro }) }];
  const q = tarefasDeLinhas(linha({
    maestro: { em_execucao: [
      { id: "T-20261028-05", titulo: "Motivo concreto de cada robô no lazer", situacao: "em execução", desde: "2026-10-28T16:55:00Z" },
      { id: "T-20261028-02", titulo: "Registro de tarefas", situacao: "atividade não confirmada", desde: "2026-10-28T08:00:00Z" }],
      aguardando: [{ id: "T-20261028-13", titulo: "Cartão único", condicao: "resposta do Sebastian" }], planejadas: 9, concluidas: 2 },
    revisor: { em_execucao: [{ id: "T-20261028-08", titulo: "Revisão", situacao: "atividade não confirmada", desde: "2026-10-28T01:00:00Z" }], aguardando: [] },
    pesquisador: { em_execucao: [], aguardando: [{ id: "T-20261028-14", titulo: "Hipótese", condicao: "decisão do Sebastian" }] },
    vazio: { em_execucao: [], aguardando: [] },
  }))!;
  assert.equal(q.registro_em, "2026-10-28T16:59:00Z");
  const m = atividadeTarefas(q.por_membro.maestro)!;
  assert.equal(m.posto, "trabalhando");
  assert.equal(m.txt, "T-05 · Motivo concreto de cada… +1");
  assert.match(m.detalhe, /T-20261028-13 \(resposta do Sebastian\)/);
  const r = atividadeTarefas(q.por_membro.revisor)!;
  assert.deepEqual([r.txt, r.posto, r.tom], ["atividade não confirmada", "alerta", "aviso"]);
  const p = atividadeTarefas(q.por_membro.pesquisador)!;
  assert.deepEqual([p.txt, p.posto], ["aguarda: decisão do Sebastian", "folga"]);
  assert.equal(atividadeTarefas(q.por_membro.vazio), null);  // sem tarefa no registro: vale a prova de atividade
  assert.equal(atividadeTarefas(undefined), null);
  // sem agentes:resumo, o quadro de tarefas ainda chega
  assert.ok(agentesDeLinhas(linha({}))?.tarefas);
  assert.equal(tarefasDeLinhas([{ chave: "tarefas:resumo", conteudo: "{", atualizado: "" }]), null);
});
