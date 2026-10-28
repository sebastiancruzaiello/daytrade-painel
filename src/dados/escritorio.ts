// Escritório operacional (pedido de 28/10/2026): relógio de cada mercado, prontidão às 9h de Brasília, inventário
// aprovado × instalado × enviado × desenhado, atividade comprovada dos agentes e ganho/perda de cada operador.
// Chega em três linhas gravadas pelo exportador da VPS (daytrade-lab, painel-aovivo/painel/escritorio.py e
// resultado.py): "prontidao:resumo", "agentes:resumo" e "resultado:resumo".
// Como estados.ts, não importa nada em tempo de execução: os testes rodam direto no Node.
import type { Linha } from "./formato";
import type { Entidade } from "./estados";

export type Janela = { dia: string; pre: string | null; abre: string; fecha: string; call_fim: string | null; meio_pregao?: boolean; grade?: string };
export type Segmento = { nome: string; exemplos: string; fuso: string; janelas: Janela[]; fase: string; texto: string; proxima?: string | null; fonte: string };
export type ItemChecklist = { item: string; nivel: "ok" | "espera" | "bloqueio" | string; texto: string };
export type MercadoPronto = { situacao: "pronto" | "bloqueio" | string; prontos: number; esperando: number; bloqueios: number; itens: ItemChecklist[] };
export type OperadorInv = {
  id: string; origem: string; mercado: string; tipo: string; ritmo: string | null; modo: string;
  aprovado: boolean | null; instalado: boolean | null; processo_em_dia: boolean | null; no_cron: boolean | null;
  enviado: boolean; situacao: string;
};
export type SimInv = { origem: string; ficha: string; aprovada: boolean | null; instalada: boolean; versao_vps: string | null; versao_repo: string | null; ultima_prova: string | null; em_dia: boolean; prazo_min: number; no_cron: boolean | null; parada_por_seguranca: boolean };
export type Prontidao = {
  em: string; escritorio: { preparo_inicio: string; preparo_fim: string; pronto: string; fuso: string; eua_checagem_min: number[] };
  sessoes: Record<string, Segmento>;
  inventario: { simulacoes: SimInv[]; operadores: OperadorInv[]; fonte_aprovado: string };
  checklist: { em: string; mercados: Record<string, MercadoPronto> };
  cron_lido: boolean;
};
export type MembroVivo = {
  id: string; nome: string; tipo: string; estado_ficha: string; onde_roda: string; quando: string; finalidade: string;
  ultima: string | null; fonte: string | null; texto: string | null; executando: boolean; usd_hoje: number | null;
  prova_na_vps: boolean; sem_prova: string | null;
};
export type Agentes = { em: string; membros: MembroVivo[]; fila_esperas: { candidato: string; motivo: string; texto: string; desde: string }[]; tarefas?: QuadroTarefas | null };
// Registro de tarefas da equipe (linha "tarefas:resumo", equipe/tarefas no daytrade-lab, T-20261028-04): o que cada
// membro tem em execução, o que espera e desde quando. "atividade não confirmada" = em execução sem sinal há mais de
// 6 h (o registro decide; o painel só mostra). registro_em = de quando é a cópia do registro que a VPS leu.
export type TarefaViva = { id: string; titulo: string; situacao: string; execucao?: string | null; desde: string | null };
export type MembroTarefas = {
  em_execucao: TarefaViva[]; aguardando: { id: string; titulo: string; condicao: string }[];
  planejadas: number; concluidas: number; ultima_entrega: { id: string; titulo: string; em: string; artefato?: string | null } | null;
};
export type QuadroTarefas = { em: string | null; registro_em: string | null; por_membro: Record<string, MembroTarefas> };
export type ResultadoOp = {
  moeda: string; tipo: string; capital: number | null; patrimonio: number | null; a_preco_de: string | null;
  dia: number | null; aporte_dia: number; base_dia: number | null; base_origem: string | null; base_em: string | null;
  acumulado: number | null; sem_marcacao: string | null; realizado: number | null; nao_realizado: number | null;
};
export type Resultados = { em: string; dia: string; operadores: Record<string, ResultadoOp> };

function json(rows: Linha[], chave: string): any {
  const r = rows.find(x => x.chave === chave);
  if (!r) return null;
  try { return JSON.parse(r.conteudo); } catch { return null; }
}

export function prontidaoDeLinhas(rows: Linha[]): Prontidao | null {
  const m = json(rows, "prontidao:resumo");
  return m && m.sessoes && m.inventario && m.checklist ? m as Prontidao : null;
}
export function agentesDeLinhas(rows: Linha[]): Agentes | null {
  const m = json(rows, "agentes:resumo"), tarefas = tarefasDeLinhas(rows);
  if (m && Array.isArray(m.membros)) return { ...(m as Agentes), tarefas };
  return tarefas ? { em: tarefas.em || "", membros: [], fila_esperas: [], tarefas } : null;
}
export function tarefasDeLinhas(rows: Linha[]): QuadroTarefas | null {
  const m = json(rows, "tarefas:resumo");
  if (!m || !m.por_membro || typeof m.por_membro !== "object") return null;
  const s = (x: unknown) => typeof x === "string" && x.trim() ? x.trim() : null;
  const por_membro: Record<string, MembroTarefas> = {};
  for (const [id, x] of Object.entries<any>(m.por_membro)) {
    if (!x || typeof x !== "object") continue;
    por_membro[id] = {
      em_execucao: (Array.isArray(x.em_execucao) ? x.em_execucao : []).filter((t: any) => t && s(t.id))
        .map((t: any) => ({ id: t.id, titulo: s(t.titulo) || t.id, situacao: s(t.situacao) || "em execução", execucao: s(t.execucao), desde: s(t.desde) })),
      aguardando: (Array.isArray(x.aguardando) ? x.aguardando : []).filter((t: any) => t && s(t.id))
        .map((t: any) => ({ id: t.id, titulo: s(t.titulo) || t.id, condicao: s(t.condicao) || "condição não informada" })),
      planejadas: Number(x.planejadas) || 0, concluidas: Number(x.concluidas) || 0,
      ultima_entrega: x.ultima_entrega && s(x.ultima_entrega.id) ? { id: x.ultima_entrega.id, titulo: s(x.ultima_entrega.titulo) || "",
        em: s(x.ultima_entrega.em) || "", artefato: s(x.ultima_entrega.artefato) } : null,
    };
  }
  return { em: s(m.em), registro_em: s(m.registro_em), por_membro };
}
export function resultadoDeLinhas(rows: Linha[]): Resultados | null {
  const m = json(rows, "resultado:resumo");
  return m && m.operadores && typeof m.operadores === "object" ? m as Resultados : null;
}

// ---------- relógio ----------
const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);
const hhmm = (t: number, fuso = "America/Sao_Paulo") => new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: fuso });
const diaEm = (t: number, fuso: string) => new Date(t).toLocaleDateString("en-CA", { timeZone: fuso });
const diaSemana = (t: number) => new Date(t).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
export const relogio = (t: number, fuso: string) => hhmm(t, fuso);

export type Fase = { fase: string; texto: string; tom: "ok" | "espera" | "aviso" | "ruim"; proximo: string | null };

// Fase agora, refeita a cada minuto com as janelas que a VPS mandou (não espera a próxima leitura).
export function faseAgora(seg: string, s: Segmento | undefined, agora: number): Fase {
  if (seg === "cripto") return { fase: "continuo", texto: "negocia 24 horas", tom: "ok", proximo: null };
  if (!s) return { fase: "desconhecida", texto: "sem o relógio da VPS", tom: "aviso", proximo: null };
  if (s.fase === "desconhecida") return { fase: "desconhecida", texto: s.texto, tom: "aviso", proximo: null };
  const local = s.fuso || "America/Sao_Paulo";
  const hoje = s.janelas.find(j => j.dia === diaEm(agora, local));
  const prox = s.janelas.find(j => ms(j.pre || j.abre) > agora);
  const quando = (j: Janela | undefined, campo: "pre" | "abre") => {
    if (!j) return null;
    const t = ms(j[campo] || j.abre);
    return (diaEm(t, "America/Sao_Paulo") === diaEm(agora, "America/Sao_Paulo") ? "hoje" : diaSemana(t)) + " às " + hhmm(t);
  };
  if (hoje) {
    if (hoje.pre && agora >= ms(hoje.pre) && agora < ms(hoje.abre)) return { fase: "pre_abertura", texto: "pré-abertura (leilão)", tom: "espera", proximo: "negocia às " + hhmm(ms(hoje.abre)) };
    if (agora >= ms(hoje.abre) && agora < ms(hoje.fecha)) return { fase: "negociacao", texto: "negociação" + (hoje.meio_pregao ? " (meio pregão)" : ""), tom: "ok", proximo: "fecha às " + hhmm(ms(hoje.fecha)) };
    if (hoje.call_fim && agora >= ms(hoje.fecha) && agora < ms(hoje.call_fim)) return { fase: "leilao_fechamento", texto: "leilão de fechamento", tom: "espera", proximo: "termina às " + hhmm(ms(hoje.call_fim)) };
    if (agora < ms(hoje.pre || hoje.abre)) return { fase: "fechado", texto: "ainda não abriu", tom: "espera", proximo: (hoje.pre ? "pré-abertura " : "abre ") + quando(hoje, "pre") };
    return { fase: "encerrado", texto: "sessão encerrada", tom: "espera", proximo: prox ? "abre " + quando(prox, "abre") : null };
  }
  return { fase: "fechado", texto: "sem sessão hoje", tom: "espera", proximo: prox ? "abre " + quando(prox, "abre") : null };
}

// Escritório: preparando (8h30–8h55), pronto às 9h (Brasília). Bloqueio vem do checklist da VPS.
export function escritorioAgora(p: Prontidao | null, agora: number) {
  const hm = hhmm(agora);
  if (!p) return { texto: "sem o checklist da VPS", tom: "aviso" as const };
  const e = p.escritorio;
  const bloq = Object.values(p.checklist.mercados).reduce((a, m) => a + m.bloqueios, 0);
  const fase = hm < e.preparo_inicio ? "antes da preparação" : hm < e.pronto ? "preparando" : "expediente";
  if (bloq) return { texto: `${fase === "expediente" ? "não está pronto" : fase}: ${bloq} ${bloq === 1 ? "impedimento" : "impedimentos"}`, tom: "ruim" as const };
  return { texto: fase === "expediente" ? "pronto desde as " + e.pronto : fase === "preparando" ? "preparando (pronto às " + e.pronto + ")" : "preparação começa às " + e.preparo_inicio, tom: fase === "antes da preparação" ? "espera" as const : "ok" as const };
}

// ---------- dinheiro ----------
const SIMBOLO: Record<string, string> = { BRL: "R$", USD: "US$" };
export function dinheiro(v: number, moeda: string, casas = 2): string {
  const abs = Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
  return SIMBOLO[moeda] ? `${SIMBOLO[moeda]} ${abs}` : `${abs} ${moeda}`;
}
// "+R$ 3,24", "−US$ 1,10", "+0,18 USDT", "R$ 0,00", "+<R$ 0,01" (nunca "−0,00").
export function comSinal(v: number, moeda: string): string {
  if (v === 0) return dinheiro(0, moeda);
  if (Math.abs(v) < 0.005) return (v > 0 ? "+<" : "−<") + dinheiro(0.01, moeda);
  return (v > 0 ? "+" : "−") + dinheiro(v, moeda);
}

export type Periodo = "dia" | "acumulado";
export type Rotulo = { txt: string; tom: "bom" | "ruim" | "neutro" | "aviso"; nota: string };

// O que vai acima da cabeça de quem tem conta: "DIA +R$ 3,24 (+0,81%)" verde, "ACUM −US$ 1,10 (−0,11%)" vermelho,
// zero neutro. A porcentagem é sobre a base do período (começo do dia; capital com aportes no acumulado).
// Quem só marca uma vez por dia (cripto diário às 21h de Brasília, bolsa depois do fechamento) não tem preço novo
// desde a base do dia: em vez de um "0,00" que parece resultado, o rótulo diz desde quando é o último preço.
export function rotuloFinanceiro(r: ResultadoOp | undefined, periodo: Periodo): Rotulo | null {
  if (!r) return null;
  const pre = periodo === "dia" ? "DIA" : "ACUM";
  const v = periodo === "dia" ? r.dia : r.acumulado;
  if (v == null) return { txt: `${pre} — sem marcação`, tom: "aviso", nota: r.sem_marcacao || "sem preço válido para marcar" };
  if (periodo === "dia" && semPrecoNovo(r))
    return { txt: `DIA — sem preço novo desde ${quando(r.a_preco_de!)}`, tom: "aviso",
      nota: `o último preço é de ${quando(r.a_preco_de!)}, de antes do começo do dia; o dia só muda na próxima marcação` };
  const tom = Math.abs(v) < 0.005 && v !== 0 ? (v > 0 ? "bom" : "ruim") : v > 0 ? "bom" : v < 0 ? "ruim" : "neutro";
  const sobre = periodo === "dia" ? r.base_dia : r.capital;
  const pc = sobre ? ` (${porcento(v / sobre)})` : "";
  const base = periodo === "dia" && r.base_origem ? ` · base: ${r.base_origem}` : "";
  const aporte = r.aporte_dia ? ` · aporte de ${dinheiro(r.aporte_dia, r.moeda)} hoje (não é lucro)` : "";
  return { txt: `${pre} ${comSinal(v, r.moeda)}${pc}`, tom, nota: `marcado a preço de ${r.a_preco_de ? quando(r.a_preco_de) : "—"}${base}${aporte}` };
}
// O preço usado é de antes (ou do mesmo instante) da base do dia: nada mudou desde o começo do dia.
export function semPrecoNovo(r: ResultadoOp): boolean {
  if (!r.a_preco_de || !r.base_em) return false;
  const p = Date.parse(r.a_preco_de.length <= 10 ? r.a_preco_de + "T23:59:59Z" : r.a_preco_de);
  return Number.isFinite(p) && p <= Date.parse(r.base_em);
}
// Hora da próxima rodada, em Brasília: "21:02" se for hoje, "02/11 21:02" se for outro dia.
export function horaCurta(iso: string | null | undefined, agora: number): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return "";
  const z = { timeZone: "America/Sao_Paulo" } as const;
  const dia = (x: number) => new Date(x).toLocaleDateString("pt-BR", { ...z, day: "2-digit", month: "2-digit" });
  const hm = new Date(t).toLocaleTimeString("pt-BR", { ...z, hour: "2-digit", minute: "2-digit" });
  return dia(t) === dia(agora) ? hm : `${dia(t)} ${hm}`;
}
// Segunda linha do robô na área de lazer: o evento do calendário (curto) e a próxima rodada.
export function linhaEspera(e: { curto: string; proxima: string | null; evento: string | null }, agora: number): string {
  const ev = e.evento ? e.evento.split(":")[0].trim() : "";
  const ja = ev && e.curto.includes(ev.split(" ")[0]);
  const h = horaCurta(e.proxima, agora);
  return [ja ? "" : ev, h ? "próx. " + h : ""].filter(Boolean).join(" · ");
}
export function porcento(f: number): string {
  if (!Number.isFinite(f)) return "";
  const a = Math.abs(f * 100), s = a < 0.005 ? "" : f > 0 ? "+" : "−";
  return s + a.toFixed(2).replace(".", ",") + "%";
}
const quando = (iso: string) => iso.length <= 10 ? iso.slice(8, 10) + "/" + iso.slice(5, 7)
  : new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

// ---------- agentes e apoio: atividade comprovada ----------
// Personagens fixos do escritório → ficha do catálogo. Primeiro a versão da VPS (tem prova), depois a da nuvem.
export const PERSONAGEM_FICHA: Record<string, string[]> = {
  "staff:maestro": ["maestro"], "staff:escrivao": ["escrivao"], "staff:guardiao": ["guardiao-risco"],
  "agente:pesquisador": ["pesquisador"], "agente:revisor": ["revisor"], "agente:formalizador": ["formalizador"],
  "agente:plantonista": ["plantonista-api", "plantonista"], "agente:sentinela": ["sentinela-api", "sentinela"],
  "robo:guardiao-dados": ["guardiao-dados"], "robo:coletor-clima": ["coletor-clima"],
  "robo:coletor-mercados": ["coletor-acoes"], "robo:organizador": ["organizador"],
};
// posto: onde a pessoa fica no escritório (mesma lógica da mesa dos robôs, pedido de 28/10/2026). "trabalhando" =
// tarefa em execução agora, fica no posto; "folga" = sem tarefa agora (já entregou ou espera a agenda), vai para a
// área de lazer; "alerta" = parado há mais de um dia ou sem nenhum registro, fica no posto com o aviso (falta de dado
// nunca parece lazer). O Guardião de risco não tem tarefa própria: ele faz parte do motor de risco e confere cada
// ordem no momento em que ela nasce, então fica sempre de guarda na cabine.
export type Posto = "trabalhando" | "folga" | "alerta";
export type Atividade = { txt: string; tom: "ok" | "espera" | "aviso" | "ruim"; detalhe: string; posto: Posto };
export const DE_GUARDA = new Set(["staff:guardiao"]);

// Quem não tem prova legível diz isso, em vez de parecer ocupado. "extra" = prova lida pelo próprio painel (n8n).
export function atividade(ms_: MembroVivo[] | undefined, agora: number, extra?: { em: string | null; texto: string } | null): Atividade {
  const m = ms_ && ms_[0];
  if (!m && !extra) return { txt: "sem registro", tom: "aviso", posto: "alerta", detalhe: "Ainda não há registro de atividade deste membro no escritório." };
  if (m?.executando) return { txt: "trabalhando agora", tom: "ok", posto: "trabalhando", detalhe: m.texto || "tarefa em execução" };
  const prova = [m?.ultima ? { em: m.ultima, texto: m.texto || "atividade registrada", fonte: m.fonte } : null,
    extra?.em ? { em: extra.em, texto: extra.texto, fonte: "tabela do n8n lida pelo painel" } : null]
    .filter(Boolean).sort((a, b) => ms(b!.em) - ms(a!.em))[0];
  if (prova) {
    const h = (agora - ms(prova.em)) / 36e5, det = `${prova.texto} (${prova.fonte}, ${quando(prova.em)}).`;
    return h < 24
      ? { txt: "sem tarefa · última " + quando(prova.em).slice(-5), tom: "espera", posto: "folga", detalhe: det }
      : { txt: "parado desde " + quando(prova.em).slice(0, 5), tom: "aviso", posto: "alerta", detalhe: det };
  }
  return { txt: "sem tarefa · aguardando agenda", tom: "espera", posto: "folga", detalhe: `${m!.sem_prova || "sem prova legível"}. Agenda: ${m!.quando}.` };
}

// O que o registro de tarefas diz de um membro (antes da prova de atividade): em execução fica no posto com a
// tarefa acima da cabeça; "atividade não confirmada" (6 h sem sinal) fica no posto com aviso; só aguardando uma
// condição (um sim do Sebastian, outra tarefa) não está trabalhando agora e vai para a área de lazer, dizendo o quê.
const NC = "atividade não confirmada";
const tituloCurto = (t: string) => t.length > 24 ? t.slice(0, 23) + "…" : t;
const idCurto = (id: string) => "T-" + id.slice(-2);
export function atividadeTarefas(m: MembroTarefas | undefined): Atividade | null {
  if (!m) return null;
  const desde = (t: TarefaViva) => (t.desde ? ` (desde ${quando(t.desde)})` : "");
  const lista = (ts: TarefaViva[]) => ts.map(t => `${t.id} ${t.titulo}: ${t.situacao}${desde(t)}`).join("; ");
  if (m.em_execucao.length) {
    const vivas = m.em_execucao.filter(t => t.situacao !== NC);
    const t = (vivas.length ? vivas : m.em_execucao).slice().sort((a, b) => ms(b.desde) - ms(a.desde))[0];
    const mais = m.em_execucao.length > 1 ? ` +${m.em_execucao.length - 1}` : "";
    if (!vivas.length) return { txt: NC, tom: "aviso", posto: "alerta",
      detalhe: `Em execução sem sinal há mais de 6 horas, pelo registro de tarefas: ${lista(m.em_execucao)}.` };
    return { txt: `${idCurto(t.id)} · ${tituloCurto(t.titulo)}${mais}`, tom: "ok", posto: "trabalhando",
      detalhe: `Pelo registro de tarefas: ${lista(m.em_execucao)}.` + (m.aguardando.length ? ` Aguardando: ${m.aguardando.map(a => `${a.id} (${a.condicao})`).join("; ")}.` : "") };
  }
  if (m.aguardando.length) {
    const a = m.aguardando[0];
    return { txt: `aguarda: ${tituloCurto(a.condicao)}`, tom: "espera", posto: "folga",
      detalhe: `Nada em execução agora. Aguardando: ${m.aguardando.map(x => `${x.id} ${x.titulo} (${x.condicao})`).join("; ")}.` };
  }
  return null;
}

// ---------- reconciliação: aprovado → instalado → em dia → no cron → enviado → desenhado ----------
export type Etapas = { aprovados: number; instalados: number; emDia: number; enviados: number; desenhados: number; total: number; faltando: OperadorInv[] };
export function reconciliarInventario(p: Prontidao | null, desenhadosIds: Set<string>): Etapas | null {
  if (!p) return null;
  const ops = p.inventario.operadores;
  return {
    total: ops.length,
    aprovados: ops.filter(o => o.aprovado).length,
    instalados: ops.filter(o => o.instalado).length,
    emDia: ops.filter(o => o.processo_em_dia).length,
    enviados: ops.filter(o => o.enviado).length,
    desenhados: ops.filter(o => desenhadosIds.has(o.id)).length,
    faltando: ops.filter(o => o.situacao !== "ok" || !desenhadosIds.has(o.id)),
  };
}

// ---------- cinco dimensões de cada operador (mercado, saúde, atividade, posição, estágio) ----------
// Uma palavra só ("ativo") escondia tudo; agora cada dimensão tem a sua linha. A cor do lucro nunca é cor de saúde.
export type Dimensoes = {
  mercado: string; saude: string; atividade: string; posicao: string; estagio: string;
  tomSaude: "ok" | "espera" | "aviso" | "ruim"; modo: string | null;
};
export const SEGMENTO_DO_MERCADO: Record<string, string> = { Cripto: "cripto", EUA: "eua", B3: "b3-etf" };

const SAUDE: Record<string, [string, Dimensoes["tomSaude"]]> = {
  "ativo": ["disponível", "ok"], "aguardando-mercado": ["disponível", "ok"], "sem-capital": ["disponível", "ok"],
  "aguardando-dado": ["sem dados ainda", "espera"], "dado-velho": ["degradado: dado parou de chegar", "aviso"],
  "falha-conexao": ["sem conexão", "ruim"], "pausado": ["pausado pelo motor de risco", "aviso"],
  "parado": ["parado por segurança", "ruim"],
};

function ritmoAtividade(x: Entidade, inv: OperadorInv | undefined, fase: Fase): string {
  if (x.semTelemetria) return "sem sinal: não dá para saber o que está fazendo";
  if (x.estado === "parado" || x.estado === "pausado") return "parado: respeita o bloqueio, não opera";
  if (x.estado === "falha-conexao" || x.estado === "dado-velho") return "esperando o dado voltar";
  if (x.tipo !== "robo") return x.posicoes.length ? "referência: mantendo a posição" : "referência: em caixa";
  if (x.decisao?.tipo === "vai") return "ordem decidida para a próxima abertura";
  const r = (inv?.ritmo || x.horizonte || "").toLowerCase();
  if (r.includes("intradi")) return fase.fase === "continuo" || fase.fase === "negociacao" ? "monitorando a faixa (checa a cada 30 min)" : "aguardando a sessão";
  const aberto = fase.fase === "negociacao" || fase.fase === "continuo";
  if (r.includes("seman")) return "pronto · decide no fechamento da semana";
  if (r.includes("mensal")) return "pronto · decide no último pregão do mês";
  if (r.includes("virada")) return "pronto · decide na virada do mês";
  return aberto ? "pronto · decide no fechamento do dia" : "pronto · decide no próximo fechamento";
}

export function dimensoes(x: Entidade, p: Prontidao | null, agora: number): Dimensoes {
  const seg = SEGMENTO_DO_MERCADO[x.mercado] || "cripto";
  const fase = faseAgora(seg, p?.sessoes[seg], agora);
  const inv = p?.inventario.operadores.find(o => o.id === x.id);
  const [saude, tomSaude] = x.semTelemetria ? ["sem telemetria", "ruim" as const]
    : inv && inv.instalado === false ? ["não instalado na VPS", "ruim" as const] : SAUDE[x.estado] || ["?", "aviso" as const];
  const posicao = x.estado === "sem-capital" ? "sem capital suficiente para 1 unidade"
    : x.posicoes.length ? "comprado: " + x.posicoes.join(", ") : x.patrimonio == null ? "sem número" : "em caixa";
  return {
    mercado: `${p?.sessoes[seg]?.nome || x.mercado}: ${fase.texto}${fase.proximo ? " · " + fase.proximo : ""}`,
    saude, tomSaude, atividade: ritmoAtividade(x, inv, fase), posicao, estagio: x.estagio, modo: inv?.modo || null,
  };
}

// Rótulo curto da situação (2ª linha acima da cabeça): nunca "lazer" para falha; caixa ≠ desligado.
export function rotuloSituacao(x: Entidade, d: Dimensoes): { txt: string; tom: Dimensoes["tomSaude"] } {
  if (d.tomSaude === "ruim" || d.tomSaude === "aviso") return { txt: d.saude.split(":")[0], tom: d.tomSaude };
  if (x.estado === "aguardando-dado") return { txt: "aguardando dado", tom: "espera" };
  const pos = x.estado === "sem-capital" ? "sem capital" : x.posicoes.length ? "comprado" : "em caixa";
  if (x.tipo !== "robo") return { txt: "REF · " + pos, tom: "espera" };
  if (d.atividade.startsWith("monitorando")) return { txt: "monitorando · " + pos, tom: "ok" };
  if (d.atividade.startsWith("ordem decidida")) return { txt: "vai operar na abertura", tom: "ok" };
  return { txt: (d.mercado.includes("negociação") || d.mercado.includes("24 horas") ? "pronto · " : "fechado · ") + pos, tom: "ok" };
}
