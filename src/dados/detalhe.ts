// Detalhe de cada robô e carteira: o que fez, o que decidiu NÃO fazer e por quê, custos, caixa e conciliação.
// Chega numa linha só, "robos:detalhe", gravada pelo exportador da VPS (daytrade-lab, painel-aovivo/painel/detalhe.py).
// Como estados.ts, não importa nada em tempo de execução: os testes rodam direto no Node.
import type { Linha } from "./formato";

export type TipoEvento = "op" | "vai" | "nao" | "rec" | "freio" | "info";
export type EventoDetalhe = { em: string; tipo: TipoEvento; txt: string; vezes?: number; desde?: string };
export type ConciliacaoDetalhe = { fecha: boolean | null; nota: string; caixa_refeito?: number; diferenca?: number };
export type DetalheRobo = {
  moeda: string; caixa: number | null; caixa_local?: number | null; reservado: number; exposicao: number | null;
  a_preco_de: string | null; custos: number | null; imposto?: number | null; dividendos?: number | null;
  operacoes: number | null; pendente: string | null; conciliacao: ConciliacaoDetalhe; linha: EventoDetalhe[];
  quantidades?: Record<string, number>;  // só day trade: o que a conta tem agora (exportador desde 28/10/2026)
  espera?: Espera | null;                // sem posição: por que está fora da mesa e quando olha de novo
  sombra_hoje?: SombraHoje | null;       // só day trade: a regra pura (sem o motor de risco) no dia de hoje
};
// Motivo concreto de estar na área de lazer (exportador, painel/espera.py, tarefa T-20261028-05): "curto" cabe acima
// da cabeça, "txt" é a frase inteira, "proxima" é a hora (ISO) da próxima rodada que decide, "evento" é o dia de
// FOMC/CPI do calendário lacrado.
export type Espera = { curto: string; txt: string; proxima: string | null; evento: string | null };
export type SombraHoje = { operacoes: string[]; resultado: number | null; comprada: boolean; txt: string };
export function esperaDe(e: any): Espera | null {
  return e && typeof e === "object" && txt(e.curto)
    ? { curto: e.curto.trim(), txt: txt(e.txt) || e.curto.trim(), proxima: txt(e.proxima), evento: txt(e.evento) } : null;
}
export type Detalhes = { em: string | null; robos: Record<string, DetalheRobo>; erros: string[] };

export const TIPOS: Record<TipoEvento, { rotulo: string; explica: string }> = {
  op: { rotulo: "operou", explica: "Ordem executada (compra ou venda), com o custo pago." },
  vai: { rotulo: "vai operar", explica: "A regra mandou comprar ou vender no fechamento; a ordem sai na próxima abertura, se o motor de risco deixar." },
  nao: { rotulo: "não operou", explica: "O robô olhou e decidiu não mandar ordem. O motivo vem da regra, com os números do dia." },
  rec: { rotulo: "recusada", explica: "O robô quis operar, mas o motor de risco recusou a ordem." },
  freio: { rotulo: "freio", explica: "Motor de risco ou botão de parar: pausou, parou, zerou ou voltou." },
  info: { rotulo: "registro", explica: "Fato do dia: pregão fechado, dividendo, imposto, fim do dia." },
};

const num = (x: unknown) => typeof x === "number" && Number.isFinite(x) ? x : null;
const txt = (x: unknown) => typeof x === "string" && x.trim() ? x.trim() : null;

export function detalheDeLinhas(rows: Linha[]): Detalhes | null {
  const r = rows.find(x => x.chave === "robos:detalhe");
  if (!r) return null;
  let m: any;
  try { m = JSON.parse(r.conteudo); } catch { return null; }
  if (!m || typeof m.robos !== "object" || !m.robos) return null;
  const robos: Record<string, DetalheRobo> = {};
  for (const [id, d] of Object.entries<any>(m.robos)) {
    if (!d || typeof d !== "object") continue;
    const c = d.conciliacao || {};
    robos[id] = {
      moeda: txt(d.moeda) || "", caixa: num(d.caixa), caixa_local: num(d.caixa_local), reservado: num(d.reservado) ?? 0,
      exposicao: num(d.exposicao), a_preco_de: txt(d.a_preco_de), custos: num(d.custos), imposto: num(d.imposto),
      dividendos: num(d.dividendos), operacoes: num(d.operacoes), pendente: txt(d.pendente),
      espera: esperaDe(d.espera),
      ...(d.sombra_hoje && typeof d.sombra_hoje === "object" && txt(d.sombra_hoje.txt) ? { sombra_hoje: {
        operacoes: Array.isArray(d.sombra_hoje.operacoes) ? d.sombra_hoje.operacoes.filter(txt) : [],
        resultado: num(d.sombra_hoje.resultado), comprada: !!d.sombra_hoje.comprada, txt: d.sombra_hoje.txt.trim() } } : {}),
      ...(d.quantidades && typeof d.quantidades === "object"
        ? { quantidades: Object.fromEntries(Object.entries<any>(d.quantidades).filter(([, q]) => num(q) && q > 0)) } : {}),
      conciliacao: { fecha: typeof c.fecha === "boolean" ? c.fecha : null, nota: txt(c.nota) || "sem conferência",
        caixa_refeito: num(c.caixa_refeito) ?? undefined, diferenca: num(c.diferenca) ?? undefined },
      linha: (Array.isArray(d.linha) ? d.linha : [])
        .filter((e: any) => e && txt(e.em) && txt(e.txt))
        .map((e: any) => ({ em: e.em, tipo: (e.tipo in TIPOS ? e.tipo : "info") as TipoEvento, txt: e.txt,
          ...(num(e.vezes) && e.vezes > 1 ? { vezes: e.vezes } : {}), ...(txt(e.desde) ? { desde: e.desde } : {}) })),
    };
  }
  return { em: txt(m.em) || r.atualizado || null, robos, erros: Array.isArray(m.erros) ? m.erros.filter(txt) : [] };
}
