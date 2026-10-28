// Lote de robôs (lote-v1): nove robôs pequenos de observação, cada um com seu capital e sua moeda.
// Chegam numa linha só, "lote:resumo", gravada pelo exportador da VPS a partir do relatório do próprio lote.
// Como estados.ts, não importa nada em tempo de execução: os testes rodam direto no Node.
import type { Linha } from "./formato";

export type DecisaoLote = { dia: string | null; para: string | null; texto: string };
export type CapitalInsuficiente = {
  ativo: string | null; preco: number | null; disponivel: number | null; minimo_por_ordem: number | null;
  capital_minimo_da_regra: number | null; dia_do_preco: string | null;
};
export type RoboLote = {
  id: string; estrategia: string; mercado: string; alvo: string[]; horizonte: string; execucao: string;
  moeda: string; capital: number; estagio: string; veredito: string | null; situacao: string; atividade: string | null;
  motivo: string | null; inicio: string | null; ultimo_pregao: string | null; valor: number | null; resultado: number | null;
  regua_valor: number | null; regua_resultado: number | null; queda_maxima: number | null; operacoes: number | null;
  custos: number | null; dividendos: number | null; imposto_pago: number | null; caixa: number | null;
  posicoes: Record<string, number>; ultima_decisao: DecisaoLote | null; capital_insuficiente: CapitalInsuficiente | null;
  conciliacao: true | string[]; historico: [string, number, number | null][];
};
export type Lote = {
  versao: string | null; gerado_em: string | null; relatorio_em: string | null; diario_integro: boolean;
  diario_problema: string | null; botao_parar: string | null; aviso_geral: string | null; avisos: string[];
  erro: string | null; robos: RoboLote[];
};

const num = (x: unknown) => typeof x === "number" && Number.isFinite(x) ? x : null;
const txt = (x: unknown) => typeof x === "string" && x.trim() ? x.trim() : null;

export function loteDeLinhas(rows: Linha[]): Lote | null {
  const r = rows.find(x => x.chave === "lote:resumo");
  if (!r) return null;
  let m: any;
  try { m = JSON.parse(r.conteudo); } catch { return null; }
  if (!m || typeof m !== "object") return null;
  const robos: RoboLote[] = Object.entries<any>(m.robos && typeof m.robos === "object" ? m.robos : {})
    .filter(([, x]) => x && typeof x === "object")
    .map(([id, x]) => {
      const d = x.ultima_decisao, ci = x.capital_insuficiente;
      return {
        id, estrategia: txt(x.estrategia) || id, mercado: (txt(x.mercado) || "").toLowerCase(),
        alvo: Array.isArray(x.alvo) ? x.alvo.filter(txt) : txt(x.alvo) ? [x.alvo] : [],
        horizonte: txt(x.horizonte) || "—", execucao: txt(x.execucao) || "", moeda: txt(x.moeda) || "",
        capital: num(x.capital) ?? 0, estagio: txt(x.estagio) || "observacao", veredito: txt(x.veredito),
        situacao: txt(x.situacao) || "aguardando dado", atividade: txt(x.atividade), motivo: txt(x.motivo),
        inicio: txt(x.inicio), ultimo_pregao: txt(x.ultimo_pregao), valor: num(x.valor), resultado: num(x.resultado),
        regua_valor: num(x.regua_valor), regua_resultado: num(x.regua_resultado), queda_maxima: num(x.queda_maxima),
        operacoes: num(x.operacoes), custos: num(x.custos), dividendos: num(x.dividendos), imposto_pago: num(x.imposto_pago),
        caixa: num(x.caixa),
        posicoes: Object.fromEntries(Object.entries<any>(x.posicoes && typeof x.posicoes === "object" ? x.posicoes : {}).filter(([, q]) => num(q))),
        ultima_decisao: d && txt(d.texto) ? { dia: txt(d.dia), para: txt(d.para), texto: d.texto.trim() } : null,
        capital_insuficiente: ci && typeof ci === "object" ? {
          ativo: txt(ci.ativo), preco: num(ci.preco), disponivel: num(ci.disponivel), minimo_por_ordem: num(ci.minimo_por_ordem),
          capital_minimo_da_regra: num(ci.capital_minimo_da_regra), dia_do_preco: txt(ci.dia_do_preco),
        } : null,
        conciliacao: x.conciliacao === "ok" ? true : Array.isArray(x.conciliacao) ? x.conciliacao.map(String) : [String(x.conciliacao ?? "sem conferência")],
        historico: (Array.isArray(x.historico) ? x.historico : [])
          .filter((h: any) => Array.isArray(h) && txt(h[0]) && num(h[1]) != null)
          .map((h: any) => [h[0], h[1], num(h[2])] as [string, number, number | null]),
      };
    });
  return {
    versao: txt(m.lote), gerado_em: txt(m.gerado_em) || r.atualizado || null, relatorio_em: txt(m.relatorio_em),
    diario_integro: m.diario_integro !== false, diario_problema: txt(m.diario_problema), botao_parar: txt(m.botao_parar),
    aviso_geral: txt(m.aviso_geral), avisos: Array.isArray(m.avisos) ? m.avisos.filter(txt) : [], erro: txt(m.erro), robos,
  };
}
