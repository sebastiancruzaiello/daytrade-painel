// Formato dos dados do salão (o mesmo do painel-aovivo): ensaios do dados.js e linhas {chave, conteudo} do n8n.
import ensaio from "./ensaio.json";

export type Ordem = [conta: string, moeda: string, lado: string, valor: number, quem: string];
export type Evento = [conta: string, tipo: string, motivo: string];
export type Dia = {
  d: string; o: Ordem[]; x: Evento[]; ev: string | null;
  eq: number[]; px: number[]; pos: string[][]; st: string[];
};
export type Fonte = { sy: string[]; f0: string; fech: Record<string, (number | null)[]>; dias: Dia[]; status?: Status };
export type Status = {
  gerado_em: string; ultima_rodada?: string; diario_integro: boolean; diario_linhas?: number;
  diario_problema?: string; botao_parar?: boolean; motivo_parar?: string; situacao: Record<string, string>;
};
export type Linha = { chave: string; conteudo: string; atualizado?: string | null };

export const KS = ["mm20-btc", "mm20-eth", "momentum"] as const;
export const NOME: Record<string, string> = { "mm20-btc": "MM20 · BTC", "mm20-eth": "MM20 · ETH", "momentum": "Momentum · 7 moedas", "todas": "Todas as contas" };
export const COR: Record<string, string> = { "mm20-btc": "#f39a3d", "mm20-eth": "#8b9cf5", "momentum": "#4fc1c9" };
export const C = { good: "#4cc38a", bad: "#ec5d55", warn: "#e9c046", accent: "#f0b25a", ink: "#e7ecea", muted: "#93a29e", staff: "#c6a6e8" };
export const REF = ["segurar BTC", "segurar ETH", "cesta das 7"];

export const ENSAIO = ensaio as unknown as { sy: string[]; f0: string; fech: Fonte["fech"]; recente: Dia[]; longo: Dia[] };
export const SY = ENSAIO.sy;

export const dayIdx = (D: { f0: string }, d: string) => Math.round((Date.parse(d) - Date.parse(D.f0)) / 864e5);
export const fmt = (v: number, d = 0) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
export const pct = (v: number) => (v >= 0 ? "+" : "") + fmt(v * 100, 1).replace("-", "−") + "%";
export const dBR = (d: string) => d.slice(8, 10) + "/" + d.slice(5, 7) + "/" + d.slice(0, 4);
export const hora = (iso?: string | null) => iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

export function fonteEnsaio(qual: "recente" | "longo"): Fonte {
  return { sy: ENSAIO.sy, f0: ENSAIO.f0, fech: ENSAIO.fech, dias: ENSAIO[qual] };
}

// Igual ao deLinhas do salão do claude.ai: junta status, preços e os dias que a VPS mandou.
export function deLinhas(rows: Linha[]): Fonte | null {
  const m: Record<string, any> = {};
  rows.forEach(r => { try { m[r.chave] = JSON.parse(r.conteudo); } catch { /* linha estragada fica de fora */ } });
  const st: Status | undefined = m.status;
  if (!st) return null;
  const crus = Object.keys(m).filter(k => k.startsWith("dia:")).sort().map(k => m[k]);
  const dd: Dia[] = []; let prev: Dia | null = null;
  crus.forEach(d => {
    const p: Partial<Dia> = prev || {};
    const x = { d: d.d, o: d.o || [], x: d.x || [], ev: d.ev ?? null, eq: d.eq || d.eqv || p.eq, px: d.px || p.px,
      pos: d.pos || p.pos || [[], [], []], st: d.st || p.st || ["ativa", "ativa", "ativa"] } as Dia;
    if (x.eq && x.px) { dd.push(x); prev = x; }
  });
  if (dd.length) {
    const u = dd[dd.length - 1];
    u.st = KS.map((k, ki) => st.botao_parar ? "parada" : (st.situacao?.[k] || u.st[ki]));
    if (st.botao_parar && !u.x.some(e => e[1] === "parar")) u.x.push(["todas", "parar", "botão de parar ligado: " + (st.motivo_parar || "")]);
  }
  let f0 = ENSAIO.f0, fech: Fonte["fech"] = {};
  if (m.precos && m.precos.fech && m.precos.fech.BTC) { f0 = m.precos.f0; fech = m.precos.fech; }
  else if (dd.length) {
    // Sem preços da Binance: usa a abertura de cada dia, que é o fechamento do dia anterior.
    f0 = new Date(Date.parse(dd[0].d) - 864e5).toISOString().slice(0, 10);
    const n = Math.round((Date.parse(dd[dd.length - 1].d) - Date.parse(f0)) / 864e5);
    SY.forEach((s, j) => {
      const a: (number | null)[] = new Array(n).fill(null);
      dd.forEach(x => { a[Math.round((Date.parse(x.d) - Date.parse(f0)) / 864e5) - 1] = x.px[j]; });
      for (let i = 1; i < n; i++) if (a[i] == null) a[i] = a[i - 1];
      fech[s] = a;
    });
  }
  return { sy: SY, f0, fech, dias: dd, status: st };
}

// Números de uma conta no dia i (patrimônio, referência, queda do pico).
export function resumoConta(dias: Dia[], i: number, ki: number, pararTeste = false) {
  const d = dias[i];
  const eq = d.eq[ki];
  const ref = ki < 2 ? 10000 * d.px[ki] / dias[0].px[ki] : SY.reduce((s, _, j) => s + 10000 / SY.length * d.px[j] / dias[0].px[j], 0);
  let pico = 0; for (let j = 0; j <= i; j++) pico = Math.max(pico, dias[j].eq[ki]);
  return { eq, ret: eq / 10000 - 1, ref, refRet: ref / 10000 - 1, queda: eq / pico - 1, pos: d.pos[ki], st: pararTeste ? "parada" : d.st[ki] };
}
