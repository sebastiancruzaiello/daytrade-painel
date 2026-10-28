// Elenco do escritório: quem deveria existir, quem chegou e onde cada um senta na ala gerada.
// O cadastro (linha "elenco:esperado", tirada dos config.json da VPS) diz quem existe; as linhas de cada simulação
// dizem o que cada um faz; a cena só desenha esta lista. Nenhuma cadeira é escrita à mão por robô (auditoria de
// 28/10/2026, achados A e B).
// Como estados.ts, não importa nada em tempo de execução: os testes rodam direto no Node.
import type { Linha } from "./formato";
import type { Entidade, Mercado } from "./estados";

export type Esperado = { id: string; origem: string; versao: string | null };
export type Elenco = { em: string | null; esperados: Esperado[]; erros: string[] };

const txt = (x: unknown) => typeof x === "string" && x.trim() ? x.trim() : null;

export function elencoDeLinhas(rows: Linha[]): Elenco | null {
  const r = rows.find(x => x.chave === "elenco:esperado");
  if (!r) return null;
  let m: any;
  try { m = JSON.parse(r.conteudo); } catch { return null; }
  if (!m || !Array.isArray(m.esperados)) return null;
  const vistos = new Set<string>();
  const esperados = m.esperados
    .filter((x: any) => x && txt(x.id) && !vistos.has(x.id) && vistos.add(x.id))
    .map((x: any) => ({ id: x.id.trim(), origem: txt(x.origem) || "?", versao: txt(x.versao) }));
  return { em: txt(m.em) || r.atualizado || null, esperados, erros: Array.isArray(m.erros) ? m.erros.filter(txt) : [] };
}

// Nome e mercado de quem é esperado mas não chegou, só pelo id (o resto fica "sem dado").
const MERCADO_ID: Record<string, Mercado> = { cripto: "Cripto", intradia: "Cripto", eua: "EUA", b3: "B3", brasil: "B3" };
function mercadoDoId(id: string): Mercado {
  const [origem, a] = id.split(":");
  if (origem === "bolsa") return MERCADO_ID[a] || "EUA";
  if (origem === "carteira") return MERCADO_ID[a] || "Cripto";
  if (origem === "lote") return /bova|smal|b3/i.test(a) ? "B3" : /sol|btc|eth|cripto/i.test(a) ? "Cripto" : "EUA";
  return "Cripto";
}

// Quem o cadastro espera e não veio na leitura vira uma entidade "sem telemetria": aparece na lista e no escritório,
// em vez de sumir. Quem chegou e não está no cadastro continua aparecendo (o cadastro pode estar atrasado).
export function semTelemetria(e: Esperado, motivo: string): Entidade {
  const [origem, ...resto] = e.id.split(":");
  const nome = resto.join(" · ") || e.id;
  return {
    id: e.id, tipo: /segurar|cesta/.test(e.id) ? "regua" : origem === "carteira" ? "carteira" : "robo", nome,
    mercado: mercadoDoId(e.id), estrategia: "—", versao: e.versao || "—", horizonte: "—",
    estagio: origem === "lote" ? "Observação (lote)" : "—",
    estado: "aguardando-dado", motivo,
    ultima: null, proxima: null, moeda: "", capital: 0, patrimonio: null, resultado: null, quedaMax: null,
    custos: null, posicoes: [], amostra: "sem telemetria", regra: "—", dados: "—", parecer: null,
    custoIA: "Zero: regra fixa no cron da VPS, sem IA nem API paga.", linha: [], semTelemetria: true,
  };
}

export type Conta = { esperados: number | null; recebidos: number; faltando: string[]; foraDoCadastro: string[] };

// Junta o cadastro com o que chegou. Sem a linha do cadastro, devolve a lista como veio (esperados = null).
export function reconciliar(lista: Entidade[], elenco: Elenco | null, motivoFalta: string): { lista: Entidade[]; conta: Conta } {
  const recebidos = lista.length;
  if (!elenco) return { lista, conta: { esperados: null, recebidos, faltando: [], foraDoCadastro: [] } };
  const tem = new Set(lista.map(x => x.id));
  const quer = new Set(elenco.esperados.map(x => x.id));
  const faltam = elenco.esperados.filter(x => !tem.has(x.id));
  return {
    lista: [...lista, ...faltam.map(x => semTelemetria(x, motivoFalta))],
    conta: { esperados: quer.size, recebidos: lista.filter(x => quer.has(x.id)).length, faltando: faltam.map(x => x.id),
      foraDoCadastro: lista.filter(x => !quer.has(x.id)).map(x => x.id) },
  };
}

// ---------- lugares na ala gerada ----------
// A ala fica em x 23–43 e y 0,8–13,3 (coordenadas do chão da cena). Uma faixa por mercado; cada fileira tem uma
// mesa comprida e até POR_FILEIRA lugares, bem afastados para nome e valor não se cobrirem (pedido de 28/10/2026).
// Se não couber tudo, os que sobram não são desenhados e a conta diz quantos ficaram de fora (nunca se esconde em
// silêncio).
export const ALA = { x0: 23, x1: 43, y0: 0.8, y1: 13.3 };
export const POR_FILEIRA = 6;
const PASSO_X = (ALA.x1 - ALA.x0) / POR_FILEIRA;
const FILEIRA = 2.55;   // distância entre fileiras
const TITULO = 0.55;    // espaço do nome da faixa
const ORDEM: string[] = ["Cripto", "EUA", "B3"];

// Quem já tem lugar fixo no salão antigo (cripto diário, com replay): não ganha outro lugar na ala.
export const FIXOS = new Set(["cripto:mm20-btc", "cripto:mm20-eth", "cripto:momentum"]);

export type Lugar = { id: string; x: number; y: number; faixa: string };
export type Faixa = { nome: string; y: number; fileiras: { y: number; n: number }[] };
export type Planta = { lugares: Lugar[]; faixas: Faixa[]; foraDaAla: string[] };

export function planta(lista: Entidade[]): Planta {
  const naAla = lista.filter(x => !FIXOS.has(x.id));
  const grupos = new Map<string, Entidade[]>();
  ORDEM.forEach(m => grupos.set(m, []));
  naAla.forEach(x => { if (!grupos.has(x.mercado)) grupos.set(x.mercado, []); grupos.get(x.mercado)!.push(x); });
  // Dentro da faixa: robôs primeiro, depois réguas e carteiras; e o id, para a ordem não pular entre leituras.
  const peso = (x: Entidade) => (x.tipo === "robo" ? 0 : x.tipo === "regua" ? 1 : 2);
  const lugares: Lugar[] = [], faixas: Faixa[] = [], foraDaAla: string[] = [];
  let y = ALA.y0;
  for (const [nome, membros] of grupos) {
    if (!membros.length) continue;
    membros.sort((a, b) => peso(a) - peso(b) || a.id.localeCompare(b.id));
    const faixa: Faixa = { nome, y, fileiras: [] };
    y += TITULO;
    for (let i = 0; i < membros.length; i += POR_FILEIRA) {
      const fy = y + FILEIRA - 0.35;  // os pés ficam na frente da mesa da fileira
      if (fy + 0.3 > ALA.y1) { membros.slice(i).forEach(m => foraDaAla.push(m.id)); break; }
      const daFileira = membros.slice(i, i + POR_FILEIRA);
      faixa.fileiras.push({ y: fy, n: daFileira.length });
      // lugares alternados um pouco para a frente e para trás, para os nomes não se encostarem
      daFileira.forEach((m, j) => lugares.push({ id: m.id, x: ALA.x0 + PASSO_X * (j + 0.5), y: fy + (j % 2 ? 0.35 : 0), faixa: nome }));
      y += FILEIRA;
    }
    if (faixa.fileiras.length) faixas.push(faixa);
    y += 0.25;
  }
  return { lugares, faixas, foraDaAla };
}

// Quantos aparecem desenhados: os da ala mais os fixos do salão antigo que estão na lista.
export function desenhados(lista: Entidade[], p: Planta) {
  return p.lugares.length + lista.filter(x => FIXOS.has(x.id)).length;
}

// ---------- mesa ou área de lazer ----------
// Regra do Sebastian (28/10/2026): na mesa fica só quem tem posição aberta (comprou moeda ou ação), mesmo parado
// esperando; quem está sem posição, inclusive esperando sinal, vai para a área de lazer (sinuca, café). Falha, pausa,
// parada e falta de dado NUNCA parecem lazer: ficam em pé no próprio lugar, com o alerta à vista.
export type Onde = "mesa" | "alerta" | "lazer";
const ALERTA = new Set(["parado", "pausado", "falha-conexao", "dado-velho", "aguardando-dado"]);
export function ondeFica(x: Pick<Entidade, "estado" | "posicoes" | "semTelemetria">): Onde {
  if (x.semTelemetria || ALERTA.has(x.estado)) return "alerta";
  return x.posicoes && x.posicoes.length ? "mesa" : "lazer";
}

// Área de lazer: faixa da frente do escritório (x 13,4–43, y 14,2–21,6). Os móveis (sinuca, sofás, café) ficam no
// fundo dela; as pessoas, em até três fileiras na frente, repartidas por igual e espalhadas pela largura toda, para
// os nomes não encostarem. A ordem é pelo id, para ninguém trocar de lugar sem motivo entre uma leitura e outra.
export const LAZER = { x0: 13.4, x1: 43, y0: 14.2, y1: 21.6 };
const LAZER_FILEIRAS = [17.0, 18.8, 20.6];
const LAZER_PASSO_MIN = 2.3, LAZER_PASSO_MAX = 5;
export type Vaga = { id: string; x: number; y: number };
export function vagasLazer(ids: string[]): { vagas: Vaga[]; semVaga: string[] } {
  const larg = LAZER.x1 - LAZER.x0 - 1.2, cabe = Math.floor(larg / LAZER_PASSO_MIN);
  const todos = [...new Set(ids)].sort(), dentro = todos.slice(0, cabe * LAZER_FILEIRAS.length);
  const nf = Math.min(LAZER_FILEIRAS.length, Math.max(1, Math.ceil(dentro.length / 5))), k = Math.ceil(dentro.length / nf);
  const vagas: Vaga[] = [];
  for (let f = 0; f < nf; f++) {
    const fila = dentro.slice(f * k, (f + 1) * k), passo = Math.min(LAZER_PASSO_MAX, larg / Math.max(1, fila.length));
    const ini = LAZER.x0 + 0.6 + (larg - passo * fila.length) / 2;
    fila.forEach((id, j) => vagas.push({ id, x: ini + passo * (j + 0.5) + (f % 2 ? passo / 4 : -passo / 4) * (fila.length > 1 ? 1 : 0), y: LAZER_FILEIRAS[f] }));
  }
  return { vagas, semVaga: todos.slice(dentro.length) };
}
