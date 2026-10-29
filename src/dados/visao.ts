// Visão geral para quem não é técnico (encaminhamento de 29/10/2026, §8): o que está acontecendo agora, quem tem
// posição, quem espera e por quê, o que a equipe faz, quanto custa a IA de verdade e se algo precisa do Sebastian.
// Tudo sai dos dados que já chegam do n8n, por regras fixas: nenhuma IA escreve estas frases.
// Como estados.ts, só importa tipos e as funções puras do escritório: os testes rodam direto no Node.
import type { Linha } from "./formato";
import type { Entidade } from "./estados";
import type { Fabrica } from "./fabrica";
import { rotuloFinanceiro, horaCurta, dinheiro, type Rotulo, type Periodo } from "./escritorio.ts";

const txt = (x: unknown) => typeof x === "string" && x.trim() ? x.trim() : null;
const num = (x: unknown) => typeof x === "number" && Number.isFinite(x) ? x : null;
function json(rows: Linha[], chave: string): any {
  const r = rows.find(x => x.chave === chave);
  if (!r) return null;
  try { return JSON.parse(r.conteudo); } catch { return null; }
}
const quando = (iso: string | null | undefined) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "—";
};

// ---------- nomes em português ----------
const ESTRATEGIA: Record<string, string> = {
  "MM20": "Média de 20 dias", "MM10M": "Média de 10 meses", "Momentum": "Rodízio das moedas mais fortes",
  "MOMENTUM": "Rodízio das moedas mais fortes", "Ruído": "Rompimento da faixa do dia", "VIRADA-EUA": "Virada do mês",
  "Só segurar": "Só segurar", "Cesta": "Cesta igual",
};
const ATIVO: Record<string, string> = {
  BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", SPY: "S&P 500 (SPY)", BOVA11: "Ibovespa (BOVA11)",
  EFA: "ações fora dos EUA (EFA)", IEF: "títulos dos EUA (IEF)", VNQ: "imóveis dos EUA (VNQ)", GLD: "ouro (GLD)",
  SMAL11: "pequenas empresas da B3 (SMAL11)", "7 moedas": "7 moedas", "cesta-7-cripto": "7 moedas",
};
// "MM20 · BTC" → "Média de 20 dias · Bitcoin". O nome técnico continua no detalhe.
export function nomeSimples(x: Pick<Entidade, "nome" | "estrategia" | "tipo">): string {
  if (x.tipo !== "robo") return x.nome;
  const [, alvo = ""] = x.nome.split(" · ");
  const e = ESTRATEGIA[x.estrategia] || x.estrategia;
  return alvo ? `${e} · ${ATIVO[alvo] || alvo}` : e;
}
// Ritmo de decisão em palavras.
export function ritmo(horizonte: string): string {
  const h = horizonte.toLowerCase();
  if (h.includes("intradi")) return "day trade: confere a cada 30 minutos e fecha tudo no fim do dia";
  if (h.includes("seman")) return "decide uma vez por semana";
  if (h.includes("mensal")) return "decide no último pregão do mês";
  if (h.includes("virada")) return "decide na virada do mês";
  if (h.includes("diári") || h.includes("diari")) return "decide uma vez por dia";
  if (h.includes("longo")) return "compra e segura (comparação)";
  return horizonte;
}

// ---------- cartão simples de cada robô (§8.4) ----------
// grupo: "posicao" = na mesa; "esperando" = sem posição, no lazer, com motivo; "problema" = falha, pausa ou parado;
// "sem-info" = não recebemos informação. Problema e falta de informação nunca contam como espera.
export type Grupo = "posicao" | "esperando" | "problema" | "sem-info";
export const GRUPOS: Record<Grupo, { rotulo: string; explica: string }> = {
  posicao: { rotulo: "Com posição", explica: "Comprou e está segurando; o resultado muda com o preço." },
  esperando: { rotulo: "Sem posição, esperando", explica: "Está em caixa porque a regra ainda não mandou comprar. Não é falha." },
  problema: { rotulo: "Com problema", explica: "Falha de conexão, dado parado, pausa ou parada de segurança." },
  "sem-info": { rotulo: "Sem informação", explica: "Não recebemos informação deste robô; não dá para dizer o que ele está fazendo." },
};
export function grupoDe(x: Pick<Entidade, "estado" | "posicoes" | "semTelemetria" | "alerta">): Grupo {
  if (x.semTelemetria || x.estado === "aguardando-dado") return "sem-info";
  if (["falha-conexao", "dado-velho", "pausado", "parado"].includes(x.estado)) return "problema";
  return x.posicoes.length ? "posicao" : "esperando";
}

export type CartaoSimples = {
  id: string; nome: string; tecnico: string; tipo: Entidade["tipo"]; mercado: string; ritmo: string; grupo: Grupo;
  agora: string; porque: string; proxima: string; resultado: Rotulo; acumulado: Rotulo; horarios: string; projecao: string | null;
};
const SEM_INFO: Rotulo = { txt: "sem informação", tom: "aviso", nota: "o resultado desta conta não chegou na última leitura" };
// Decidiu comprar ou vender na próxima abertura: é intenção, não execução (§6, espelho da abertura).
export function projecaoDe(x: Pick<Entidade, "espera" | "decisao">): string | null {
  const e = x.espera?.curto || "";
  if (/^(compra|vend|zera)/i.test(e)) return e;
  if (x.decisao?.tipo === "vai") return x.decisao.txt;
  return null;
}
// Quem marca uma vez por dia passa o dia "sem preço novo": é o normal dele, não alerta (fica neutro e em palavras).
const calmo = (r: Rotulo | null): Rotulo | null => r && r.txt.startsWith("DIA — sem preço novo")
  ? { ...r, txt: "hoje: " + r.txt.replace("DIA — ", ""), tom: "neutro" } : r;
export function cartaoSimples(x: Entidade, agora: number, periodo: Periodo = "dia"): CartaoSimples {
  const grupo = grupoDe(x), proj = projecaoDe(x);
  const posTxt = x.posicoes.join(", ");
  const agoraTxt = grupo === "sem-info" ? "não recebemos informação deste robô"
    : grupo === "problema" ? (x.motivo || "com problema")
    : grupo === "posicao" ? `comprado: ${posTxt}`
    : x.estado === "sem-capital" ? "sem posição: o dinheiro não dá para comprar nem uma unidade"
    : proj ? `sem posição · decidiu: ${proj} (ainda não executado)` : "sem posição (em caixa)";
  const porque = grupo === "posicao" ? (x.tipo === "robo" ? "a regra mandou comprar e ainda não mandou vender" : "é uma comparação: compra e segura")
    : grupo === "esperando" ? (x.espera?.txt || x.motivo || "motivo não informado")
    : x.motivo || "motivo não informado";
  const prox = x.espera?.proxima ? `próxima avaliação ${horaCurta(x.espera.proxima, agora)}` : x.tipo !== "robo" ? "não decide nada: só acompanha o preço" : x.dim?.atividade || "sem previsão informada";
  const preco = x.res?.a_preco_de ? `preço de ${x.res.a_preco_de.length <= 10 ? x.res.a_preco_de.slice(8, 10) + "/" + x.res.a_preco_de.slice(5, 7) : quando(x.res.a_preco_de)}` : null;
  const horarios = [preco, x.ultima ? `última avaliação: ${x.ultima}` : null].filter(Boolean).join(" · ") || "sem horário informado";
  return {
    id: x.id, nome: nomeSimples(x), tecnico: x.nome, tipo: x.tipo, mercado: x.mercado, ritmo: ritmo(x.horizonte), grupo,
    agora: agoraTxt, porque, proxima: prox,
    resultado: calmo(rotuloFinanceiro(x.res, periodo)) || SEM_INFO, acumulado: rotuloFinanceiro(x.res, "acumulado") || SEM_INFO,
    horarios, projecao: proj,
  };
}

// ---------- contagens separadas (§8.3): nunca somar tudo como "robôs de trading" ----------
export type Contagem = {
  robos: number; estrategias: number; comparacoes: number; carteiras: number;
  porGrupo: Record<Grupo, number>; agentes: { ia: number; apoio: number } | null;
};
export function contar(lista: Entidade[], agentes: { ia: number; apoio: number } | null): Contagem {
  const robos = lista.filter(x => x.tipo === "robo");
  const porGrupo: Record<Grupo, number> = { posicao: 0, esperando: 0, problema: 0, "sem-info": 0 };
  robos.forEach(x => porGrupo[grupoDe(x)]++);
  return {
    robos: robos.length, estrategias: new Set(robos.map(x => (ESTRATEGIA[x.estrategia] || x.estrategia))).size,
    comparacoes: lista.filter(x => x.tipo === "regua").length, carteiras: lista.filter(x => x.tipo === "carteira").length,
    porGrupo, agentes,
  };
}

// ---------- tarefas (linha "tarefas:resumo", lista completa com quem resolve) ----------
export type Tarefa = {
  id: string; titulo: string; responsavel: string; estado: string; situacao: string;
  condicao: string | null; quemResolve: string | null; gatilho: string | null; ultimo: string | null; proximo: string | null;
};
export function tarefasDeLinhas(rows: Linha[]): { em: string | null; lista: Tarefa[] } | null {
  const m = json(rows, "tarefas:resumo");
  if (!m || !Array.isArray(m.tarefas)) return null;
  const lista = m.tarefas.filter((t: any) => t && txt(t.id)).map((t: any): Tarefa => ({
    id: t.id, titulo: txt(t.titulo) || t.id, responsavel: txt(t.responsavel) || "?", estado: txt(t.estado) || "?",
    situacao: txt(t.situacao) || txt(t.estado) || "?",
    condicao: txt(t.aguardando?.condicao), quemResolve: txt(t.aguardando?.quem_resolve), gatilho: txt(t.aguardando?.gatilho),
    ultimo: txt(t.ultimo_progresso), proximo: txt(t.proximo_passo),
  }));
  return { em: txt(m.gerado_em) || txt(m.em), lista };
}
// Quem precisa agir: só é do Sebastian quando o registro diz que ele resolve. Agente nunca vira pedido ao usuário.
export const doSebastian = (t: Tarefa) => t.estado === "aguardando" && !!t.quemResolve && /sebastian/i.test(t.quemResolve);
export type Colunas = { execucao: Tarefa[]; proximas: Tarefa[]; aguardando: Tarefa[]; concluidas: Tarefa[]; incidentes: Tarefa[] };
export function colunasTarefas(lista: Tarefa[]): Colunas {
  const por = (e: string) => lista.filter(t => t.estado === e);
  return {
    execucao: por("em_execucao"), proximas: por("planejada"), aguardando: por("aguardando"),
    concluidas: por("concluida").reverse(), incidentes: lista.filter(t => t.estado === "falhou" || t.situacao === "atividade não confirmada"),
  };
}
export const NOME_MEMBRO: Record<string, string> = { maestro: "Maestro (Claude)", pesquisador: "Pesquisador", revisor: "Revisor", formalizador: "Formalizador", sebastian: "Sebastian" };

// ---------- despesa real de IA (linha "custos:resumo") ----------
export type Custos = {
  mes: string; teto: number; gasto: number; hoje: number | null; reservado: number; disponivel: number; margem: number;
  porTarefa: [string, number][]; semDado: string[]; em: string | null; nivel: string;
  github: { usados: number; gratis: number } | null; projecao: number | null;
};
export function custosDeLinhas(rows: Linha[]): Custos | null {
  const m = json(rows, "custos:resumo");
  if (!m || num(m.api_mes) == null || num(m.teto_mes) == null) return null;
  const teto = m.teto_mes, gasto = m.api_mes, reservado = num(m.reservado) || 0;
  const disponivel = num(m.disponivel) ?? Math.max(0, teto - gasto - reservado);
  return {
    mes: txt(m.mes) || "", teto, gasto, hoje: num(m.api_hoje), reservado, disponivel,
    margem: Math.max(0, Math.round((teto - gasto - reservado - disponivel) * 100) / 100),
    porTarefa: Object.entries<any>(m.por_experimento || {}).filter(([, v]) => num(v) != null).map(([k, v]) => [k, v as number] as [string, number]).sort((a, b) => b[1] - a[1]),
    semDado: Array.isArray(m.sem_dado) ? m.sem_dado.filter(txt) : [], em: txt(m.atualizado), nivel: txt(m.nivel) || "?",
    github: num(m.github_minutos) != null ? { usados: m.github_minutos, gratis: num(m.github_gratis) || 2000 } : null,
    projecao: num(m.projecao_mes),
  };
}
// "HALLOWEEN-EUA-v3" fica como está; nomes de papéis e boletins ganham português.
const TAREFA_CUSTO: Record<string, string> = { "boletim-diario": "Boletim diário", pesquisador: "Pesquisador (procura ideias)", revisor: "Revisor (confere as ideias)" };
export const nomeCusto = (k: string) => TAREFA_CUSTO[k] || `Candidata ${k}`;

// ---------- o que precisa do Sebastian ----------
export type Pedido = { titulo: string; oQue: string; porque: string };
export function pedidos(t: { lista: Tarefa[] } | null): Pedido[] | null {
  if (!t) return null;
  // O campo que fala do Sebastian vira "o que falta de você" (sem o nome); o outro explica, se não for só técnico.
  const tecnico = (x: string | null) => !x || /porta .* no n8n|execução da porta/i.test(x);
  const semNome = (x: string) => x.replace(/^Sebastian\s+/i, "");
  return t.lista.filter(doSebastian).map(x => {
    const [oQue, outro] = x.gatilho && /sebastian/i.test(x.gatilho) ? [x.gatilho, x.condicao] : [x.condicao || x.gatilho || "ver a tarefa", x.gatilho];
    return { titulo: x.titulo, oQue: semNome(oQue!), porque: tecnico(outro) || outro === oQue ? "" : outro! };
  });
}

// Agentes de IA e programas de apoio (linha "agentes:resumo"). Os programas que operam (operadores, lote, carteiras,
// robô da PETR4) já são contados como robôs e ficam de fora, para nada ser contado duas vezes.
const OPERA = /^(operador-|lote-robos|carteiras|robo-orb)/;
export function contarEquipe(membros: { id: string; tipo: string }[] | null | undefined): { ia: number; apoio: number } | null {
  if (!membros || !membros.length) return null;
  return { ia: membros.filter(m => m.tipo === "ia").length, apoio: membros.filter(m => m.tipo !== "ia" && !OPERA.test(m.id)).length };
}

// ---------- resumo em frases (§8.2), feito por regra ----------
export type Entrada = {
  lista: Entidade[]; tarefas: { lista: Tarefa[] } | null; fabrica: Fabrica | null; custos: Custos | null;
  conexao: { ok: boolean; msg?: string; desde?: string | null };
};
const juntar = (l: string[]) => l.length > 1 ? l.slice(0, -1).join(", ") + " e " + l[l.length - 1] : l[0] || "";
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
export function resumo(e: Entrada): string[] {
  const f: string[] = [];
  if (!e.conexao.ok) f.push(`Não conseguimos ler os dados agora${e.conexao.msg ? ` (${e.conexao.msg})` : ""}.` + (e.conexao.desde ? ` O que aparece é de ${quando(e.conexao.desde)}.` : " Ainda não chegou nenhuma leitura."));
  const c = contar(e.lista, null);
  if (c.robos) {
    const g = c.porGrupo;
    const partes = [g.posicao ? plural(g.posicao, "tem posição", "têm posição") : "nenhum tem posição",
      g.esperando ? `${g.esperando} ${g.esperando === 1 ? "está" : "estão"} sem posição esperando a regra mandar comprar` : null,
      g.problema ? `${g.problema} com problema` : null, g["sem-info"] ? `${g["sem-info"]} sem informação` : null].filter(Boolean);
    f.push(`Dos ${plural(c.robos, "robô", "robôs")} em simulação, ${juntar(partes as string[])}.`);
    const proj = e.lista.filter(x => x.tipo === "robo" && projecaoDe(x));
    if (proj.length) f.push(`${plural(proj.length, "robô decidiu", "robôs decidiram")} operar na próxima abertura; isso é intenção, ainda não é compra confirmada.`);
  } else f.push("Nenhum robô chegou na última leitura.");
  if (c.comparacoes + c.carteiras) f.push(`Há ${plural(c.comparacoes + c.carteiras, "comparação", "comparações")} (réguas e carteiras de referência) que só compram e seguram; elas não são robôs.`);
  if (e.tarefas) {
    const col = colunasTarefas(e.tarefas.lista);
    const vivas = col.execucao.filter(t => t.situacao !== "atividade não confirmada");
    if (vivas.length) f.push(`A equipe está trabalhando em: ${vivas.map(t => t.titulo).join("; ")}.`);
    else f.push("Nenhuma tarefa da equipe está em execução confirmada agora.");
    const semSinal = col.execucao.filter(t => t.situacao === "atividade não confirmada");
    if (semSinal.length) f.push(`${plural(semSinal.length, "tarefa está", "tarefas estão")} sem sinal há mais de 6 horas: ${semSinal.map(t => t.titulo).join("; ")}.`);
  } else f.push("O registro de tarefas da equipe não chegou; não dá para dizer o que a equipe está fazendo.");
  if (e.fabrica) {
    const andando = e.fabrica.candidatos.filter(x => !x.parado);
    f.push(andando.length ? `Na fábrica de estratégias, ${plural(andando.length, "ideia anda", "ideias andam")}: ${andando.map(x => x.titulo.split(" (")[0]).join("; ")}.` : "Na fábrica de estratégias, nenhuma ideia está andando agora.");
  }
  if (e.custos) f.push(`Despesa real de IA em ${e.custos.mes.slice(5)}/${e.custos.mes.slice(0, 4)}: ${dinheiro(e.custos.gasto, "USD")} de ${dinheiro(e.custos.teto, "USD")}; ainda ${e.custos.disponivel > 0 ? "podem ser usados " + dinheiro(e.custos.disponivel, "USD") : "não sobra nada para usar"}.`);
  return f;
}

// ---------- o que mudou desde a última visita ----------
// Retrato guardado no próprio PC a cada leitura; ao abrir o programa, o anterior vira a base da comparação.
export type Retrato = { em: string; robos: Record<string, { nome: string; grupo: Grupo; pos: string[] }>; concluidas: string[]; candidatos: Record<string, string>; gasto: number | null };
export function retrato(lista: Entidade[], tarefas: { lista: Tarefa[] } | null, fabrica: Fabrica | null, custos: Custos | null, em: string): Retrato {
  const robos: Retrato["robos"] = {};
  lista.forEach(x => { robos[x.id] = { nome: nomeSimples(x), grupo: grupoDe(x), pos: x.posicoes.map(p => p.replace(/^[\d.,]+\s+/, "")) }; });
  const candidatos: Record<string, string> = {};
  fabrica?.candidatos.forEach(c => { candidatos[c.id] = c.situacao; });
  return { em, robos, concluidas: tarefas ? tarefas.lista.filter(t => t.estado === "concluida").map(t => t.id) : [], candidatos, gasto: custos?.gasto ?? null };
}
export function mudancas(antes: Retrato | null, agora: Retrato, tarefas: { lista: Tarefa[] } | null): string[] {
  if (!antes) return [];
  const m: string[] = [];
  for (const [id, r] of Object.entries(agora.robos)) {
    const a = antes.robos[id];
    if (!a) { m.push(`${r.nome} apareceu no painel.`); continue; }
    const novas = r.pos.filter(p => !a.pos.includes(p)), saiu = a.pos.filter(p => !r.pos.includes(p));
    if (novas.length) m.push(`${r.nome} comprou ${novas.join(", ")}.`);
    if (saiu.length) m.push(`${r.nome} vendeu ${saiu.join(", ")}.`);
    if (a.grupo !== r.grupo && (r.grupo === "problema" || r.grupo === "sem-info")) m.push(`${r.nome} passou para "${GRUPOS[r.grupo].rotulo.toLowerCase()}".`);
    if (a.grupo !== r.grupo && (a.grupo === "problema" || a.grupo === "sem-info") && r.grupo !== "problema" && r.grupo !== "sem-info") m.push(`${r.nome} voltou ao normal.`);
  }
  for (const id of Object.keys(antes.robos)) if (!agora.robos[id]) m.push(`${antes.robos[id].nome} sumiu da leitura.`);
  const titulo = (id: string) => tarefas?.lista.find(t => t.id === id)?.titulo || id;
  agora.concluidas.filter(id => !antes.concluidas.includes(id)).forEach(id => m.push(`Tarefa concluída: ${titulo(id)}.`));
  for (const [id, s] of Object.entries(agora.candidatos)) {
    if (!(id in antes.candidatos)) m.push(`Nova ideia na fábrica: ${id}.`);
    else if (antes.candidatos[id] !== s) m.push(`Fábrica, ${id}: ${s}.`);
  }
  if (antes.gasto != null && agora.gasto != null && agora.gasto - antes.gasto >= 0.01) m.push(`A despesa real de IA subiu ${dinheiro(agora.gasto - antes.gasto, "USD")} (agora ${dinheiro(agora.gasto, "USD")} no mês).`);
  return m;
}

// ---------- glossário (§8.7) ----------
export const GLOSSARIO: [string, string][] = [
  ["Teste no passado (backtest, replay)", "Rodar a regra em pregões que já aconteceram, para ver o que ela teria feito. Não é dinheiro de hoje."],
  ["Maior queda do patrimônio (drawdown)", "O pior tombo desde um pico, durante o teste. Mostra o susto que a estratégia daria."],
  ["Não recebemos informação (telemetria ausente)", "O robô não mandou notícia na última leitura. Não dá para dizer se está funcionando."],
  ["Conferindo se a ideia pode ser testada (triagem)", "O Revisor vê se a ideia tem dado, custo e regra claros antes de gastar com teste."],
  ["Encerrada nesta etapa (arquivada)", "A ideia parou aqui, sempre com o motivo escrito. Pode não ter havido teste de ganho ou perda."],
  ["Reprovada", "Não passou em algum teste já combinado antes; o painel diz qual."],
  ["Regra registrada (lacre)", "Regra guardada com uma impressão digital: se alguém mudar uma vírgula, aparece."],
  ["Comparação: comprar e manter (benchmark, régua)", "O que teria acontecido só comprando o ativo e segurando. A estratégia precisa ganhar disso."],
  ["Com posição / na mesa", "O robô comprou e está segurando moeda ou ação."],
  ["No lazer", "Sem posição ou sem tarefa neste momento. Não significa necessariamente desligado."],
  ["Intenção / projeção da abertura", "O robô decidiu operar na próxima abertura. Ainda não é compra confirmada e não entra no patrimônio."],
  ["Simulação", "Dinheiro de mentira. Nenhum investimento real é feito."],
  ["Despesa real de IA/API", "Dinheiro de verdade gasto com a IA que pesquisa e confere as ideias. Teto de US$ 200 por mês."],
  ["Detalhes técnicos (DSR, PBO, hash, commit)", "Números e códigos para o revisor técnico conferir. Não precisam ser lidos para acompanhar."],
];
