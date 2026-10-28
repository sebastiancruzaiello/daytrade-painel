// Simulações vizinhas do cripto diário: a bolsa (EUA e B3, um pregão por dia) e o day trade em cripto (meia em meia hora).
// Chegam como linhas "sim:bolsa" e "sim:intradia": o relatório que cada simulação grava na VPS, mais a corrente do diário
// e o botão de parar. Só leitura, igual ao resto do programa.
import type { Linha } from "./formato";

export type LinhaBolsa = {
  grupo: "contas" | "sombras" | "referencias" | string; conta: string;
  patrimonio: number; resultado: number; resultado_liquido?: number; queda_maxima: number; operacoes: number;
  imposto_pago?: number; dividendos?: number; situacao: string | null; motivo: string | null;
  posicoes: unknown[]; veredito_lab: string | null;
};
export type MercadoBolsa = {
  moeda: string; inicio: string | null; ultimo_pregao: string | null; pregoes: number; proximo_pregao: string | null;
  aviso: string | null; linhas: Record<string, LinhaBolsa>;
};
export type ContaIntradia = {
  situacao: string; inicio_do_dia: number; operacoes_hoje: unknown[]; veredito: string; sombra_inicio_do_dia: number;
};
export type Boletim = { dia: string; contas: Record<string, { contas?: { resultado_dia?: number }; moeda_no_dia?: number | null }> };

type Envelope<R> = {
  gerado_em: string; relatorio_em: string; diario_integro: boolean; diario_problema: string | null;
  botao_parar: boolean; motivo_parar: string | null; relatorio: R & { erro?: string };
};
export type SimBolsa = Envelope<{ mercados?: Record<string, MercadoBolsa>; proximos_eventos?: [string, string][] }>;
export type SimIntradia = Envelope<{ dia?: string; contas?: Record<string, ContaIntradia>; boletins?: Boletim[] }>;
export type Carteira = {
  nome: string; ativo: string; moeda: string; capital_brl?: number; situacao: string; motivo: string | null; valor_brl: number; resultado: number;
  quantidade: number; comprou_em: string | null; preco_da_compra: number | null; preco_atual: number | null;
  dia_do_preco: string | null; cambio_atual: number | null; custos_brl: number; minimo_brl: number | null; premissa: string;
};
export type SimCarteiras = Envelope<{ capital_brl?: number; inicio?: string | null; ultimo_dia?: string | null; cambio?: string; avisos?: string[]; carteiras?: Record<string, Carteira> }>;
export type Vizinhas = { bolsa: SimBolsa | null; intradia: SimIntradia | null; carteiras: SimCarteiras | null };

export const CAPITAL = 10000;

export function vizinhasDeLinhas(rows: Linha[]): Vizinhas {
  const m: Record<string, any> = {};
  rows.forEach(r => { if (r.chave.startsWith("sim:")) { try { m[r.chave] = JSON.parse(r.conteudo); } catch { /* linha estragada fica de fora */ } } });
  const ok = (x: any) => x && typeof x === "object" && x.relatorio && typeof x.relatorio === "object";
  return { bolsa: ok(m["sim:bolsa"]) ? m["sim:bolsa"] : null, intradia: ok(m["sim:intradia"]) ? m["sim:intradia"] : null,
    carteiras: ok(m["sim:carteiras"]) ? m["sim:carteiras"] : null };
}

// "REPROVADA no laboratório em 27/10/2026 (...)" -> "reprovada no laboratório: só observação"
export function veredito(v: string | null | undefined) {
  if (!v) return null;
  return /REPROVADA/i.test(v) ? "reprovada no laboratório: roda só como observação" : v.slice(0, 80);
}

// Nome curto para as contas da bolsa e do day trade.
const NOMES: Record<string, string> = {
  "mm10m-spy": "MM10M · SPY", "segurar-spy": "Segurar SPY", "cesta-20-eua": "Cesta dos 20 ETFs",
  "mm10m-bova11": "MM10M · BOVA11", "segurar-bova11": "Segurar BOVA11", "cesta-6-b3": "Cesta dos 6 ETFs",
  "ruido-btc": "Ruído · BTC", "ruido-eth": "Ruído · ETH",
};
export const nomeViz = (k: string) => NOMES[k] || k;
