import type { Linha } from "./dados/formato";

export type EstadoAtualizacao = {
  fase: "parado" | "procurando" | "em-dia" | "baixando" | "pronta" | "erro";
  versao: string; nova?: string; pct?: number; notas?: string; msg?: string; conferidoEm?: string;
};
type Resposta = { ok: true } | { ok: false; erro: string };
declare global {
  interface Window {
    // Ponte do preload. Ausente quando a tela roda fora do programa (ex.: no navegador, para testes).
    daytrade?: {
      lerAjustes: () => Promise<{ endereco: string; temChave: boolean }>;
      salvarAjustes: (a: { endereco: string; chave?: string }) => Promise<Resposta>;
      apagarAjustes: () => Promise<Resposta>;
      lerFonte: () => Promise<{ ok: true; linhas: Linha[]; lidoEm: string } | { ok: false; erro: string }>;
      lerAtualizacao: () => Promise<EstadoAtualizacao>;
      aoAtualizar: (fn: (e: EstadoAtualizacao) => void) => () => void;
      reiniciarParaAtualizar: () => Promise<{ ok: boolean }>;
    };
  }
}
export {};
