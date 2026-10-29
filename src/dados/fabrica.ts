// Fábrica de estratégias: cada candidato e em que etapa está, de fonte até parecer. Só leitura, sem nada de tela.
// Lê a linha "fabrica:resumo" (gravada a partir de lab/fabrica no daytrade-lab). Sem ela, monta o que dá com o
// "lab:resumo" de hoje. Como estados.ts, não importa nada em tempo de execução: os testes rodam direto no Node.
import type { Linha } from "./formato";
import type { Lab } from "./mercados";

export type Etapa = { id: string; rotulo: string; explica: string };
export type Candidato = {
  id: string; titulo: string; mercado: string; etapa: string; situacao: string; desde: string | null;
  responsavel: string | null; evidencia: string | null; veredito: string | null; parado: boolean;
  // Trilha 2 (lab/TRILHA-2-v1.md): ideia nossa ou adaptação de uma regra publicada (mae). Trilha 1 = replicação fiel.
  trilha: 1 | 2; mae: string | null;
};
export type Fabrica = { em: string | null; origem: "fabrica" | "lab" ; etapas: Etapa[]; candidatos: Candidato[] };

// Etapas do Plano 2.0 (§14): cada uma deixa um arquivo que dá para conferir.
export const ETAPAS: Etapa[] = [
  { id: "fonte", rotulo: "Fonte", explica: "Estudo ou artigo público de onde a ideia vem." },
  { id: "hipotese", rotulo: "Hipótese", explica: "Ficha do Pesquisador: o que a regra faz e por que ganharia." },
  { id: "triagem", rotulo: "Triagem", explica: "O Revisor aceita, devolve ou descarta (custo, dados, risco)." },
  { id: "especificacao", rotulo: "Regra congelada", explica: "O Formalizador escreve a regra e lacra antes de ver qualquer número." },
  { id: "codigo", rotulo: "Código", explica: "A regra vira programa, igual ao que está escrito." },
  { id: "testes_tecnicos", rotulo: "Testes técnicos", explica: "Confere se o programa faz o que a regra diz." },
  { id: "teste_historico", rotulo: "Teste histórico", explica: "Roda em anos de dados, com custos, fora da amostra e contra a sorte." },
  { id: "parecer", rotulo: "Parecer", explica: "O Revisor aprova ou reprova pelo critério já escrito. Reprovar também é resultado." },
];

// Quem age em cada etapa (para mostrar "aguardando Revisor" etc. quando a linha não diz).
export const DONO: Record<string, string> = {
  fonte: "Pesquisador", hipotese: "Pesquisador", triagem: "Revisor", especificacao: "Formalizador",
  codigo: "Formalizador", testes_tecnicos: "Claude", teste_historico: "Claude", parecer: "Revisor",
};

const PARADO = /arquiv|descart|reprov|devolv|cancel/i;
const txt = (x: unknown) => typeof x === "string" && x.trim() ? x.trim() : null;

function normalizarEtapa(e: unknown, conhecidas: Etapa[]): string {
  const s = String(e || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\s-]+/g, "_");
  const achada = conhecidas.find(x => x.id === s || x.rotulo.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_") === s);
  return achada ? achada.id : s || "hipotese";
}

export function fabricaDeLinhas(rows: Linha[]): Fabrica | null {
  const r = rows.find(x => x.chave === "fabrica:resumo");
  if (!r) return null;
  let m: any;
  try { m = JSON.parse(r.conteudo); } catch { return null; }
  if (!m || !Array.isArray(m.candidatos)) return null;
  // Etapas: as da própria linha (na ordem dela), com os rótulos que conhecemos quando o id bate.
  const etapas: Etapa[] = Array.isArray(m.etapas) && m.etapas.length
    ? m.etapas.map((e: any) => {
        const id = typeof e === "string" ? e : String(e?.id || "");
        const nossa = ETAPAS.find(x => x.id === id);
        return { id, rotulo: (typeof e === "object" && txt(e?.rotulo)) || nossa?.rotulo || id.replace(/_/g, " "), explica: (typeof e === "object" && txt(e?.explica)) || nossa?.explica || "" };
      })
    : ETAPAS;
  const candidatos: Candidato[] = m.candidatos.filter((c: any) => c && txt(c.titulo)).map((c: any, i: number) => {
    const etapa = normalizarEtapa(c.etapa, etapas);
    const situacao = txt(c.situacao) || (DONO[etapa] ? `aguardando ${DONO[etapa]}` : "em andamento");
    return {
      id: txt(c.id) || `c${i}`, titulo: txt(c.titulo)!, mercado: txt(c.mercado) || "—", etapa, situacao,
      desde: txt(c.desde), responsavel: txt(c.responsavel) || DONO[etapa] || null, evidencia: txt(c.evidencia),
      veredito: txt(c.veredito), parado: PARADO.test(situacao) || PARADO.test(c.veredito || ""),
      trilha: c.trilha === 2 ? 2 : 1, mae: c.trilha === 2 ? txt(c.mae) : null,
    };
  });
  return { em: txt(m.em) || r.atualizado || null, origem: "fabrica", etapas, candidatos };
}

// Sem a linha da fábrica: as fichas e vereditos do laboratório viram candidatos, na etapa que o veredito indica.
export function fabricaDoLab(lab: Lab): Fabrica {
  const candidatos: Candidato[] = [];
  (["cripto", "eua", "b3"] as const).forEach(mk => {
    (lab[mk]?.linhas || []).forEach((l, i) => {
      const v = l.v || "";
      const etapa = /reprov|aprov|parecer/i.test(v) ? "parecer"
        : /descart|devolv|triagem|aceit/i.test(v) ? "triagem"
        : /lacr|congel/i.test(v) ? "especificacao"
        : /test|rodand/i.test(v) ? "teste_historico" : "hipotese";
      candidatos.push({
        id: `${mk}-${i}`, titulo: l.t, mercado: mk === "cripto" ? "Cripto" : mk.toUpperCase(), etapa, situacao: v || "sem veredito",
        desde: l.d || null, responsavel: DONO[etapa], evidencia: null, veredito: /reprov|aprov|descart|devolv/i.test(v) ? v : null,
        parado: PARADO.test(v), trilha: 1, mae: null,
      });
    });
  });
  return { em: lab.em || null, origem: "lab", etapas: ETAPAS, candidatos };
}

// Quantos candidatos esperam cada pessoa da fábrica (só os que não estão parados).
// Rótulo de um candidato da trilha 2: de onde vem a ideia e, até o veredito, que ele não está aprovado.
export function rotuloTrilha(c: Candidato): string | null {
  if (c.trilha !== 2) return null;
  const origem = c.mae ? `adaptação nossa de ${c.mae}` : "ideia nossa";
  return /aprovad/i.test(c.veredito || "") && !/reprov/i.test(c.veredito || "") ? origem : `${origem} · não aprovado`;
}

export function filaPorPessoa(f: Fabrica) {
  const c: Record<string, number> = {};
  f.candidatos.filter(x => !x.parado).forEach(x => { const p = x.responsavel || "—"; c[p] = (c[p] || 0) + 1; });
  return c;
}

export function porEtapa(f: Fabrica) {
  const conhecidas = new Set(f.etapas.map(e => e.id));
  const m = new Map<string, Candidato[]>(f.etapas.map(e => [e.id, []]));
  const outras: Candidato[] = [];
  f.candidatos.forEach(c => (conhecidas.has(c.etapa) ? m.get(c.etapa)! : outras).push(c));
  return { colunas: f.etapas.map(e => ({ etapa: e, candidatos: m.get(e.id)! })), outras };
}
