// Testes no passado (encaminhamento de 29/10/2026, §8.6): o replay histórico do laboratório (REPLAY-v1, PR lab#102)
// mostrado sem refazer conta. Os números vêm de src/dados/replay.json, copiado de lab/reports/replay pelo
// scripts/replay-do-lab.mjs. Aqui só se escolhe a linha e se escreve a frase. Só tipos: os testes rodam no Node.
import { dinheiro, comSinal, porcento } from "./escritorio.ts";

export type Faixa = {
  capital: number; custo: "original" | "dobrado" | string; custo_por_ponta: number; regra_quantidade: string;
  final: number; retorno: number; pior_queda: number; exposicao: number; ciclos: number; custos_pagos: number; proventos: number;
  sem_capital: { vezes: number; primeira: string | null; ultima: string | null };
  segurar: { final: number; retorno: number; pior_queda: number; custos_pagos: number; proventos: number };
};
export type Controle = {
  id: string; nome: string; regra: string; ativo: string; moeda: string; explica: string; veredito: string; parecer: string;
  periodo: { inicio: string; fim: string; dias: number };
  conciliacao: { ok: boolean; eventos_replay: number; eventos_original: number };
  registros_original: number;
  capital_minimo: Record<string, { capital_minimo: number }>;
  faixas: Faixa[];
  curvas: { datas: string[]; series: Record<string, number[]> };
};
export type Replay = {
  origem: { repositorio: string; pasta: string; commit_lab: string; commit_da_rodada: string; versao: string; lacre: string; comando: string; arquivos: Record<string, string>; observacoes: string[] };
  controles: Controle[];
};

export const CAPITAIS = [100, 1000, 10000, 100000];
export const CUSTOS: Record<string, string> = { original: "custos originais", dobrado: "custos dobrados (teste de estresse)" };

export function faixa(c: Controle, capital: number, custo: string): Faixa | null {
  return c.faixas.find(f => f.capital === capital && f.custo === custo) || null;
}
const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const mesAno = (d: string) => `${MES[Number(d.slice(5, 7)) - 1]}/${d.slice(0, 4)}`;
export const anos = (c: Controle) => (Date.parse(c.periodo.fim) - Date.parse(c.periodo.inicio)) / (365.25 * 864e5);

// O quadro do §8.6, em frases. "Não conseguiu operar" quando o capital não comprou nada (não é "retorno de 0%").
export type Quadro = {
  titulo: string; periodo: string; tipo: string; capital: string; final: string; ganho: string; tom: "bom" | "ruim" | "neutro" | "aviso";
  custos: string; queda: string; comparacao: string; contagem: string; semCapital: string | null; conclusao: string; premissas: string[];
};
export function quadro(c: Controle, f: Faixa): Quadro {
  const m = c.moeda, ganhoV = f.final - f.capital;
  const naoOperou = f.ciclos === 0 && f.sem_capital.vezes > 0;
  const premissas = [
    "Avalia só a regra, sem os freios do motor de risco que a simulação ao vivo usa.",
    c.ativo === "SPY"
      ? "SPY em cotas inteiras; dividendo (líquido de 30% de imposto) entra no caixa e só volta a ser investido na próxima compra. Por isso o comprar e manter daqui fica abaixo do comprar e manter do experimento original, que reinveste tudo."
      : "Bitcoin com passo de 0,00001 BTC e ordem mínima de 10 USDT em todo o período (o mais restritivo conhecido).",
    `Ganho de ${anos(c).toFixed(1).replace(".", ",")} anos somados, não ganho por dia.`,
  ];
  return {
    titulo: c.nome,
    periodo: `Teste no passado: ${mesAno(c.periodo.inicio)} a ${mesAno(c.periodo.fim)}.`,
    tipo: "Controle de engenharia: serve para provar que o simulador reproduz o teste original. Não é resultado de hoje nem candidata nova.",
    capital: `${dinheiro(f.capital, m, 0)}`,
    final: naoOperou ? "Não conseguiu operar com este capital" : dinheiro(f.final, m),
    ganho: naoOperou ? "nenhuma compra: o dinheiro não dava para a menor ordem" : `${comSinal(ganhoV, m)} (${porcento(f.retorno)})`,
    tom: naoOperou ? "aviso" : ganhoV > 0.005 ? "bom" : ganhoV < -0.005 ? "ruim" : "neutro",
    custos: `${dinheiro(f.custos_pagos, m)} em taxas simuladas (${(f.custo_por_ponta * 100).toFixed(2).replace(".", ",")}% por compra ou venda), já descontados no resultado.`,
    queda: naoOperou ? "não se aplica: não comprou nada" : `${porcento(f.pior_queda).replace("−", "")} no pior momento`,
    comparacao: naoOperou && f.segurar.retorno === 0 ? `Comprar e manter ${c.ativo} com o mesmo dinheiro também não daria: não chega para uma unidade.` : `Comprar e manter ${c.ativo} com o mesmo dinheiro: ${dinheiro(f.segurar.final, m)} (${porcento(f.segurar.retorno)}), pior queda ${porcento(f.segurar.pior_queda).replace("−", "")}`
      + (f.segurar.proventos ? `, com ${dinheiro(f.segurar.proventos, m)} de dividendos parados no caixa` : "") + ".",
    contagem: f.ciclos ? `${f.ciclos.toLocaleString("pt-BR")} ciclos completos (cada ciclo = uma compra e a venda dela). Comprado em ${Math.round(f.exposicao * 100)}% do tempo.` : "Nenhuma compra.",
    semCapital: f.sem_capital.vezes ? `Faltou dinheiro para a ordem mínima ${f.sem_capital.vezes.toLocaleString("pt-BR")} vezes (a primeira em ${f.sem_capital.primeira?.split("-").reverse().join("/")}).` : null,
    conclusao: c.veredito,
    premissas,
  };
}
// Capital mínimo achado no histórico: diagnóstico, não recomendação de aporte.
export function minimo(c: Controle, custo: string): string | null {
  const x = c.capital_minimo[custo];
  return x ? `Menor capital que conseguiu seguir a regra no histórico: cerca de ${dinheiro(x.capital_minimo, c.moeda)}. É diagnóstico, não recomendação de quanto pôr.` : null;
}
