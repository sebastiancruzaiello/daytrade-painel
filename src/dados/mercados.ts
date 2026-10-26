// Mercados de ações (EUA e B3) e a equipe de apoio, só para olhar.
// Os fundos de referência vêm do robô "Coletor de referências" no n8n (Yahoo, público); sem chave, usa a cópia embutida.
// Nada aqui compra ou vende: "só segurar" é a régua que qualquer estratégia de ações precisa vencer.
import EMBUTIDO from "./mercados.json";
import type { Linha } from "./formato";

export type Mercado = {
  t: string; nome: string; mercado: "EUA" | "B3"; moeda: string; tz: string;
  pregao: { inicio: number | null; fim: number | null };
  agora: { preco: number | null; em: number | null };
  d: string[]; c: number[]; a: number[]; em: string; fonte?: string;
};
export type Guardiao = { em: string; nivel: "ok" | "alerta" | "falha" | string; falhas: string[]; alertas: string[]; falhas_seguidas?: number };
export type Clima = { em: string; medo_ganancia?: { valor: number; classe: string; ultimos_30?: number[] }; leitura?: { financiamento_medio_pct?: number; financiamento_esticado?: boolean; medo_extremo?: boolean; ganancia_extrema?: boolean } };
export type LabMercado = { fichas: number; linhas: { d: string; t: string; v: string }[]; nota?: string };
export type Lab = { em: string; cripto: LabMercado; eua: LabMercado; b3: LabMercado };
export type Extras = { spy: Mercado; bova: Mercado; guardiao: Guardiao | null; clima: Clima | null; lab: Lab; aoVivo: boolean };

// Situação do laboratório escrita à mão em 26/10/2026 (fila/ e pareceres/). Uma linha "lab:resumo" no n8n substitui.
const LAB_26_10: Lab = {
  em: "2026-10-26",
  cripto: { fichas: 2, linhas: [
    { d: "2026-10-26", t: "Meia hora final do bitcoin", v: "descartada: a taxa come o ganho" },
    { d: "2026-10-26", t: "Virada do mês (BTC e ETH)", v: "devolvida: falta a janela exata do artigo" },
  ] },
  eua: { fichas: 0, linhas: [], nota: "Regras lacradas em 26/10. As fichas chegam pela fila do Pesquisador." },
  b3: { fichas: 0, linhas: [], nota: "Regras lacradas em 26/10, com IR de 15% no lucro do mês." },
};

const E = EMBUTIDO as unknown as Record<string, Mercado>;
export const extrasEmbutidos = (): Extras => ({ spy: E["mercado:SPY"], bova: E["mercado:BOVA11"], guardiao: null, clima: null, lab: LAB_26_10, aoVivo: false });

export function extrasDeLinhas(rows: Linha[]): Extras | null {
  const m: Record<string, any> = {};
  rows.forEach(r => { try { m[r.chave] = JSON.parse(r.conteudo); } catch { /* linha estragada fica de fora */ } });
  const ok = (x: any): x is Mercado => x && Array.isArray(x.d) && Array.isArray(x.c) && x.d.length === x.c.length && x.d.length > 1;
  if (!ok(m["mercado:SPY"]) || !ok(m["mercado:BOVA11"])) return null;
  const lab = m["lab:resumo"] && m["lab:resumo"].cripto ? m["lab:resumo"] as Lab : LAB_26_10;
  return { spy: m["mercado:SPY"], bova: m["mercado:BOVA11"], guardiao: m.guardiao || null, clima: m.clima || null, lab, aoVivo: true };
}

// Último pregão até o dia pedido (inclusive). -1 se o dia é anterior aos dados.
export function idxAte(mk: Mercado, dia: string) {
  let lo = 0, hi = mk.d.length - 1, r = -1;
  while (lo <= hi) { const k = (lo + hi) >> 1; if (mk.d[k] <= dia) { r = k; lo = k + 1; } else hi = k - 1; }
  return r;
}

// Quanto viraria 10.000 só segurando o fundo desde o dia "inicio" (com dividendos, pelo preço ajustado).
export function segurar(mk: Mercado, inicio: string, dia: string) {
  const i0 = Math.max(0, idxAte(mk, inicio)), i = idxAte(mk, dia);
  if (i < 0) return null;
  const v = 10000 * mk.a[i] / mk.a[i0];
  const ano = idxAte(mk, new Date(Date.parse(mk.d[i]) - 365 * 864e5).toISOString().slice(0, 10));
  return { i, preco: mk.c[i], diaPreco: mk.d[i], valor: v, ret: v / 10000 - 1, ret1a: ano >= 0 ? mk.a[i] / mk.a[ano] - 1 : null, teveHoje: mk.d[i] === dia };
}

const hh = (s: number) => new Date(s * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const diaSemana = (s: number) => new Date(s * 1000).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });

// Pregão agora (só no ao vivo): o Yahoo informa o próximo horário regular, já pulando fim de semana e feriado.
export function pregao(mk: Mercado, agora = Date.now()) {
  const { inicio, fim } = mk.pregao || { inicio: null, fim: null };
  if (!inicio || !fim) return { aberto: false, texto: "horário do pregão desconhecido" };
  const t = agora / 1000;
  if (t >= inicio && t < fim) return { aberto: true, texto: "pregão aberto · fecha às " + hh(fim) };
  if (t < inicio) return { aberto: false, texto: "fechado · abre " + (new Date(inicio * 1000).toDateString() === new Date(agora).toDateString() ? "hoje" : diaSemana(inicio)) + " às " + hh(inicio) };
  return { aberto: false, texto: "fechado" };
}
