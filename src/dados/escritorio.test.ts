// Testes do escritório operacional (npm test): relógio por segmento, sinal do dinheiro, rótulo de ganho e perda,
// inventário e as cinco dimensões. As janelas são as que o exportador montou com o calendário de verdade (out/nov 2026).
import test from "node:test";
import assert from "node:assert/strict";
import {
  faseAgora, escritorioAgora, comSinal, rotuloFinanceiro, reconciliarInventario, atividade, prontidaoDeLinhas,
  resultadoDeLinhas, type Segmento, type Prontidao, type ResultadoOp, type OperadorInv,
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
  assert.equal(d.txt, "DIA +R$ 1,50");
  assert.equal(d.tom, "bom");
  assert.match(d.nota, /aporte de R\$ 300,00 hoje \(não é lucro\)/);
  assert.equal(rotuloFinanceiro(R({ acumulado: -2 }), "acumulado")!.txt, "ACUM −R$ 2,00");
  assert.equal(rotuloFinanceiro(R({ acumulado: -2 }), "acumulado")!.tom, "ruim");
  assert.equal(rotuloFinanceiro(R({ dia: 0 }), "dia")!.tom, "neutro");
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

test("atividade: sem prova não parece ocupado; prova velha vira 'parado desde'", () => {
  const agora = t("2026-10-30T15:00:00Z");
  assert.equal(atividade(undefined, agora).txt, "sem registro");
  const m = { id: "sentinela-api", nome: "Sentinela", papel: "", quando: "07h", executando: false, ultima: null, texto: null, fonte: "", prova_na_vps: false, sem_prova: "a nuvem não deixa prova na VPS" };
  assert.equal(atividade([m] as never, agora).txt, "aguardando agenda");
  assert.match(atividade([{ ...m, ultima: "2026-10-30T10:00:00Z", texto: "relatório" }] as never, agora).txt, /^última atividade/);
  assert.match(atividade([{ ...m, ultima: "2026-10-27T10:00:00Z", texto: "relatório" }] as never, agora).txt, /^parado desde/);
  assert.equal(atividade([{ ...m, executando: true }] as never, agora).txt, "trabalhando agora");
});

test("linhas novas estragadas ou ausentes não quebram o painel", () => {
  assert.equal(prontidaoDeLinhas([]), null);
  assert.equal(prontidaoDeLinhas([{ chave: "prontidao:resumo", conteudo: "{", atualizado: "" }]), null);
  assert.equal(resultadoDeLinhas([{ chave: "resultado:resumo", conteudo: "{}", atualizado: "" }]), null);
});
