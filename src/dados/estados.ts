// Quem é quem no salão e em que estado está, a partir do que o n8n devolveu. Só leitura, sem nada de tela.
// Este arquivo não importa nada em tempo de execução (só tipos): os testes rodam direto no Node.
import type { Fonte } from "./formato";
import type { Vizinhas, LinhaBolsa } from "./vizinhas";
import type { Detalhes, DetalheRobo, EventoDetalhe, TipoEvento } from "./detalhe";
import type { Lote, RoboLote } from "./lote";

// Os estados que o salão mostra. "Aguardando mercado" e "falha de conexão" nunca se confundem (Plano 2.0 §17).
export type Estado =
  | "ativo" | "aguardando-mercado" | "aguardando-dado" | "falha-conexao" | "dado-velho"
  | "pausado" | "parado" | "sem-capital";
export type Tom = "ok" | "espera" | "aviso" | "ruim";

export const ESTADOS: Record<Estado, { rotulo: string; tom: Tom; explica: string }> = {
  "ativo": { rotulo: "Ativo", tom: "ok", explica: "Rodando normalmente, com dado em dia. Pode estar em caixa: ativo não quer dizer comprado." },
  "aguardando-mercado": { rotulo: "Aguardando mercado", tom: "espera", explica: "A bolsa está fechada (noite, fim de semana ou feriado). Não há nada errado: o robô volta a agir no próximo pregão." },
  "aguardando-dado": { rotulo: "Aguardando dado", tom: "espera", explica: "O robô ainda não tem o dado de que precisa: o primeiro resumo não chegou, o ao vivo não foi ligado ou a fonte ainda não publicou o preço do dia." },
  "falha-conexao": { rotulo: "Falha de conexão", tom: "ruim", explica: "Alguém não conseguiu falar com alguém: o painel com o n8n, ou a VPS com a fonte de preços. O que aparece é o último dado que chegou." },
  "dado-velho": { rotulo: "Dado velho", tom: "aviso", explica: "A conexão funciona, mas a informação parou de se renovar no prazo esperado. Pode ser a simulação ou o envio da VPS parado." },
  "pausado": { rotulo: "Pausado", tom: "aviso", explica: "O motor de risco pausou a conta por um dia depois de uma perda grande. Volta sozinha no dia seguinte." },
  "parado": { rotulo: "Parado", tom: "ruim", explica: "Conta parada pelo motor de risco ou pelo botão de parar. Só volta com ordem do Sebastian." },
  "sem-capital": { rotulo: "Capital insuficiente", tom: "espera", explica: "O dinheiro da carteira não dá para comprar nem uma unidade do ativo com as regras reais (lote, custos, câmbio). Não se põe dinheiro a mais." },
};

export type Mercado = "Cripto" | "EUA" | "B3";
export type Tipo = "robo" | "regua" | "carteira";
export const ESTAGIO_LOTE = "Observação (lote)";
export type Evento = { d: string; txt: string; tom?: "bom" | "ruim" | "neutro"; tipo?: TipoEvento; vezes?: number; desde?: string };
// Dinheiro de um robô ou carteira. "real" = números do estado.json da VPS (linha robos:detalhe); senão, calculado.
export type Conciliacao = {
  capital: number; caixa: number | null; reservado: number; exposicao: number | null; fecha: boolean | null; nota: string;
  moeda?: string; real?: boolean; aPrecoDe?: string | null; pendente?: string | null; caixaLocal?: number | null;
  diferenca?: number;
};

export type Entidade = {
  id: string; tipo: Tipo; nome: string;
  mercado: Mercado; estrategia: string; versao: string; horizonte: string; estagio: string;
  estado: Estado; motivo: string;
  ultima: string | null; proxima: string | null;
  moeda: string; capital: number; patrimonio: number | null; resultado: number | null; quedaMax: number | null;
  custos: number | null; posicoes: string[]; amostra: string;
  regra: string; dados: string; parecer: string | null; custoIA: string;
  sombra?: number | null;
  linha: Evento[];
  carteira?: Conciliacao;
  decisao?: Evento | null;   // última decisão (operou, não operou ou recusada), quando a VPS manda o detalhe
  regua?: { valor: number | null; resultado: number | null; nome: string } | null;  // "só segurar" o mesmo ativo, mesma moeda
  alerta?: string | null;    // problema que não é situação (diário mexido, caixa que não fecha): aviso vermelho no cartão
  veredito?: string | null;  // parecer do laboratório à vista no cartão (robôs de observação)
};

// Como está a ligação do painel com o n8n (vem do App).
export type Conexao =
  | { estado: "sem-programa" | "sem-endereco" | "lendo" }
  | { estado: "ok"; lidoEm: string }
  | { estado: "erro"; msg: string; ultimaOk: string | null };

// Pregão agora, já calculado pela tela com o horário do Yahoo (null = não se sabe).
export type PregaoAgora = { aberto: boolean; texto: string } | null;

export type Entrada = {
  vivo: Fonte | null; viz: Vizinhas; agora: number; conexao: Conexao; detalhe?: Detalhes | null; lote?: Lote | null;
  pregao: { EUA: PregaoAgora; B3: PregaoAgora };
};

// Prazos para "dado velho", em minutos. Cada um segue o relógio de quem grava.
export const PRAZO = {
  envio: 75,              // a VPS manda o resumo ao n8n de meia em meia hora
  vigia: 120,             // o vigia do cripto roda de hora em hora
  rodadaCripto: 25 * 60,  // a rodada do dia do cripto, logo depois da meia-noite UTC
  bolsa: 150,             // a bolsa confere de hora em hora (minuto 40)
  intradia: 20,           // o day trade roda de minuto em minuto
  carteiras: 26 * 60,     // as carteiras rodam uma vez por dia (22:50 UTC)
  lote: 150,              // o lote de robôs roda de hora em hora (minuto 25)
};

const REGRA: Record<string, string> = {
  "mm20-btc": "Compra bitcoin quando o preço do dia fecha acima da média dos últimos 20 dias e vende quando fecha abaixo. Decide uma vez por dia.",
  "mm20-eth": "Compra ethereum quando o preço do dia fecha acima da média dos últimos 20 dias e vende quando fecha abaixo. Decide uma vez por dia.",
  "momentum": "Toda semana escolhe as 3 moedas, entre 7, que mais subiram nos últimos 21 dias e divide o dinheiro entre elas.",
  "mm10m": "No último pregão do mês, se o fundo fechou acima da média dos últimos 10 fechamentos de mês, fica comprado no mês seguinte; senão, fica em caixa.",
  "ruido": "Mede o 'passeio normal' do preço em volta da abertura nos últimos 14 dias. Se o preço sai muito acima dessa faixa, compra; se volta para dentro dela ou cai abaixo do preço médio do dia, vende. Confere a cada meia hora e vende tudo no fim do dia.",
  "segurar": "Compra no primeiro dia e nunca vende. Não é estratégia: é a régua que as estratégias precisam vencer.",
  "cesta": "Divide o dinheiro em partes iguais entre os fundos do laboratório e segura. É a régua de 'comprar tudo um pouco'.",
  "carteira": "Compra o ativo de referência quando o dinheiro dá (com lote, custos e câmbio de verdade) e nunca vende.",
};
const FREIOS = "Motor de risco sem IA: perda de 15% no dia pausa a conta por um dia; queda de 35% desde o pico para de vez.";
const SEM_IA = "Zero: regra fixa no cron da VPS, sem IA nem API paga.";

const min = (a: number, b: string | null | undefined) => b ? (a - Date.parse(b)) / 60000 : Infinity;
const dBR = (d: string) => d.slice(8, 10) + "/" + d.slice(5, 7);
const quando = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const t = new Date(iso);
  return t.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};
const pctTxt = (v: number) => (v >= 0 ? "+" : "−") + Math.abs(v * 100).toFixed(1).replace(".", ",") + "%";

// Primeiro o que vale para todos (ligação), depois o que é de cada um.
type Base = { estado: Estado; motivo: string } | null;
function baseConexao(c: Conexao, temDado: boolean): Base {
  if (c.estado === "erro") return { estado: "falha-conexao", motivo: `A última leitura do n8n falhou (${c.msg}).` + (temDado && c.ultimaOk ? ` Mostrando o que chegou às ${quando(c.ultimaOk)}.` : "") };
  if (!temDado) {
    if (c.estado === "sem-endereco") return { estado: "aguardando-dado", motivo: "O ao vivo ainda não foi ligado: falta colar a chave de leitura em Ajustes." };
    if (c.estado === "sem-programa") return { estado: "aguardando-dado", motivo: "Prévia no navegador: só o programa instalado lê o ao vivo." };
    if (c.estado === "lendo") return { estado: "aguardando-dado", motivo: "Lendo o n8n pela primeira vez…" };
    return { estado: "aguardando-dado", motivo: "O n8n respondeu, mas o primeiro resumo desta simulação ainda não chegou." };
  }
  return null;
}

function velho(agora: number, envio: string | null | undefined, rel: string | null | undefined, prazoRel: number, oque: string): Base {
  if (min(agora, envio) > PRAZO.envio) return { estado: "dado-velho", motivo: `A VPS não manda resumo desde ${quando(envio)}.` };
  if (min(agora, rel) > prazoRel) return { estado: "dado-velho", motivo: `${oque} não se renova desde ${quando(rel)}.` };
  return null;
}

const frase = (t: string) => /[.!?]$/.test(t.trim()) ? t.trim() : t.trim() + ".";
const abre = (pg: { texto: string }) => pg.texto.replace(/^fechado( · )?/, "") || "sem hora de abertura";

function situacao(sit: string | null | undefined, motivo: string | null | undefined, botao: boolean, motivoBotao?: string | null): Base {
  if (botao) return { estado: "parado", motivo: frase("Botão de parar ligado" + (motivoBotao ? `: ${motivoBotao}` : "")) + " Só volta com ordem do Sebastian." };
  if (sit === "parada") return { estado: "parado", motivo: frase("Parada pelo motor de risco" + (motivo ? `: ${motivo}` : "")) + " Só volta com ordem do Sebastian." };
  if (sit === "pausada") return { estado: "pausado", motivo: frase("Pausada pelo motor de risco" + (motivo ? `: ${motivo}` : "")) + " Volta sozinha no dia seguinte." };
  return null;
}

const reprovada = (v: string | null | undefined) => !!v && /REPROVADA/i.test(v);
const parecerCurto = (v: string | null | undefined) => v ? v.slice(0, 220) + (reprovada(v) ? ". Por isso roda só como observação, sem promessa de ganho." : "") : null;

// ---------- cripto diário (aovivo-v1) ----------
const CRIPTO = [
  { k: "mm20-btc", nome: "MM20 · BTC", estrategia: "MM20" },
  { k: "mm20-eth", nome: "MM20 · ETH", estrategia: "MM20" },
  { k: "momentum", nome: "Momentum · 7 moedas", estrategia: "Momentum" },
];

function cripto(e: Entrada): Entidade[] {
  const v = e.vivo, st = v?.status;
  const base0 = baseConexao(e.conexao, !!(st && v!.dias.length));
  return CRIPTO.map(({ k, nome, estrategia }, ki) => {
    const dias = v?.dias || [];
    const u = dias[dias.length - 1];
    let pico = 0, queda = 0;
    dias.forEach(d => { pico = Math.max(pico, d.eq[ki]); queda = Math.min(queda, d.eq[ki] / pico - 1); });
    const linha: Evento[] = [];
    let ultimaOrdem: string | null = null;
    for (const d of dias) {
      d.o.filter(o => o[0] === k).forEach(o => { ultimaOrdem = d.d; linha.push({ d: d.d, txt: `${o[2]} ${o[1]} · ${Math.round(o[3]).toLocaleString("pt-BR")} USDT` + (o[4] === "motor_de_risco" ? " (mandada pelo motor de risco)" : ""), tom: "neutro" }); });
      d.x.filter(x => x[0] === k || x[0] === "todas").forEach(x => linha.push({ d: d.d, txt: `${x[1] === "retomar" ? "voltou" : x[1]}: ${x[2]}`, tom: x[1] === "retomar" ? "bom" : "ruim" }));
      if (d.ev && !d.o.some(o => o[0] === k)) linha.push({ d: d.d, txt: `não operou: dia de ${d.ev} (o motor não deixa abrir posição)`, tom: "neutro" });
    }
    const b = base0
      || situacao(st?.situacao?.[k], st?.motivo?.[k], !!st?.botao_parar, st?.motivo_parar)
      || velho(e.agora, st?.gerado_em, st?.ultimo_vigia || st?.ultima_rodada, PRAZO.vigia, "O vigia de hora em hora")
      || (min(e.agora, st?.ultima_rodada) > PRAZO.rodadaCripto ? { estado: "dado-velho" as Estado, motivo: `A rodada do dia não roda desde ${quando(st?.ultima_rodada)}.` } : null)
      || { estado: "ativo" as Estado, motivo: u && u.pos[ki].length ? `Comprado em ${u.pos[ki].join(", ")}.` : "Em caixa, esperando o sinal da regra." };
    return {
      id: "cripto:" + k, tipo: "robo", nome, mercado: "Cripto", estrategia, versao: "aovivo-v1", horizonte: "Diário", estagio: "Ao vivo simulado",
      estado: b.estado, motivo: b.motivo,
      ultima: ultimaOrdem ? `última ordem em ${dBR(ultimaOrdem)}` : st?.ultima_rodada ? `rodada de ${quando(st.ultima_rodada)}` : null,
      proxima: "rodada do dia logo depois da meia-noite UTC (21h de Brasília); vigia de hora em hora",
      moeda: "USDT", capital: 10000, patrimonio: u ? u.eq[ki] : null, resultado: u ? u.eq[ki] / 10000 - 1 : null,
      quedaMax: dias.length ? queda : null, custos: null, posicoes: u ? u.pos[ki] : [],
      amostra: dias.length ? `${dias.length} ${dias.length === 1 ? "dia" : "dias"} desde ${dBR(dias[0].d)}` : "nenhum dia ainda",
      regra: REGRA[k] + " " + FREIOS, dados: "Velas diárias públicas da Binance (7 moedas), conferidas pelo motor de risco.",
      parecer: "Regras lacradas em 26/10/2026 (aovivo-v1). Ainda sem parecer de resultado: amostra curta.", custoIA: SEM_IA,
      linha: linha.slice(-40).reverse(),
    };
  });
}

// ---------- bolsa (EUA e B3) ----------
const ROTULO_MERCADO: Record<string, Mercado> = { eua: "EUA", b3: "B3" };
const NOMES: Record<string, string> = {
  "mm10m-spy": "MM10M · SPY", "segurar-spy": "Segurar SPY", "cesta-20-eua": "Cesta dos 20 ETFs",
  "mm10m-bova11": "MM10M · BOVA11", "segurar-bova11": "Segurar BOVA11", "cesta-6-b3": "Cesta dos 6 ETFs",
  "ruido-btc": "Ruído · BTC", "ruido-eth": "Ruído · ETH",
};
const nome = (k: string) => NOMES[k] || k;
const familia = (k: string) => k.split("-")[0];

function bolsa(e: Entrada): Entidade[] {
  const s = e.viz.bolsa;
  if (!s) return [];
  const out: Entidade[] = [];
  const versao = (s.relatorio as { versao?: string }).versao || "aovivo-bolsa-v1";
  Object.entries(s.relatorio.mercados || {}).forEach(([mk, m]) => {
    const mercado = ROTULO_MERCADO[mk] || (mk.toUpperCase() as Mercado);
    const pg = e.pregao[mercado as "EUA" | "B3"] ?? null;
    const linhas = Object.values(m.linhas || {}) as (LinhaBolsa & { custos_pagos?: number })[];
    linhas.filter(l => l.grupo !== "sombras").forEach(l => {
      const regua = l.grupo === "referencias";
      const sombra = linhas.find(x => x.grupo === "sombras" && x.conta === l.conta);
      const fam = familia(l.conta);
      const b = baseConexao(e.conexao, true)
        || (regua ? null : situacao(l.situacao, l.motivo, !!s.botao_parar, s.motivo_parar))
        || velho(e.agora, s.gerado_em, s.relatorio_em, PRAZO.bolsa, "A simulação da bolsa")
        || (m.aviso ? { estado: "falha-conexao" as Estado, motivo: `A VPS não conseguiu ler os preços: ${m.aviso}` } : null)
        || (!m.ultimo_pregao ? (pg && !pg.aberto
              ? { estado: "aguardando-mercado" as Estado, motivo: `Ainda não começou: o primeiro pregão é ${m.proximo_pregao ? dBR(m.proximo_pregao) : "o próximo"}. Bolsa fechada, ${abre(pg)}.` }
              : { estado: "aguardando-dado" as Estado, motivo: `Ainda não processou nenhum pregão; começa em ${m.proximo_pregao ? dBR(m.proximo_pregao) : "breve"}.` }) : null)
        || (pg && !pg.aberto ? { estado: "aguardando-mercado" as Estado, motivo: `Bolsa fechada, ${abre(pg)}. Decide uma hora depois do fechamento do próximo pregão.` } : null)
        || { estado: "ativo" as Estado, motivo: (pg ? "Pregão aberto. " : "") + (l.posicoes.length ? `Comprado em ${(l.posicoes as string[]).join(", ")}.` : "Em caixa.") };
      const custos = (l.custos_pagos ?? 0) + (l.imposto_pago ?? 0);
      out.push({
        id: `bolsa:${mk}:${l.conta}`, tipo: regua ? "regua" : "robo", nome: nome(l.conta), mercado,
        estrategia: fam === "mm10m" ? "MM10M" : fam === "cesta" ? "Cesta" : "Só segurar", versao,
        horizonte: regua ? "Longo prazo" : "Mensal", estagio: regua ? "Régua" : reprovada(l.veredito_lab) ? "Observação" : "Ao vivo simulado",
        estado: b.estado, motivo: b.motivo,
        ultima: m.ultimo_pregao ? `pregão de ${dBR(m.ultimo_pregao)}` : null,
        proxima: m.proximo_pregao ? `pregão de ${dBR(m.proximo_pregao)} (age 1h depois do fechamento)` : null,
        moeda: m.moeda, capital: 10000, patrimonio: l.patrimonio, resultado: l.resultado, quedaMax: -Math.abs(l.queda_maxima),
        custos: regua && !custos ? null : custos, posicoes: (l.posicoes as string[]) || [],
        amostra: `${m.pregoes} ${m.pregoes === 1 ? "pregão" : "pregões"}` + (m.inicio ? ` desde ${dBR(m.inicio)}` : ""),
        regra: (REGRA[fam] || "") + (regua ? "" : " " + FREIOS), dados: "Preços diários públicos do Yahoo, com dividendos" + (mercado === "B3" ? " e IR de 15% no lucro do mês." : "."),
        parecer: parecerCurto(l.veredito_lab), custoIA: SEM_IA, sombra: sombra ? sombra.patrimonio / 10000 - 1 : null,
        linha: [
          ...(m.ultimo_pregao ? [{ d: m.ultimo_pregao, txt: `pregão processado · ${l.operacoes} ${l.operacoes === 1 ? "operação" : "operações"} no total`, tom: "neutro" as const }] : []),
          ...(l.situacao && l.situacao !== "ativa" ? [{ d: m.ultimo_pregao || "", txt: `${l.situacao}: ${l.motivo || ""}`, tom: "ruim" as const }] : []),
        ],
      });
    });
  });
  return out;
}

// ---------- day trade em cripto (intradia) ----------
function intradia(e: Entrada): Entidade[] {
  const s = e.viz.intradia;
  if (!s) return [];
  const r = s.relatorio;
  const versao = (r as { versao?: string }).versao || "aovivo-intradia-v1";
  return Object.entries(r.contas || {}).map(([k, c]) => {
    const linha: Evento[] = [];
    (r.boletins || []).forEach(bl => {
      const x = bl.contas?.[k]?.contas?.resultado_dia;
      if (x != null) linha.push({ d: bl.dia, txt: `dia fechado: ${pctTxt(x)} com custos`, tom: x > 0 ? "bom" : x < 0 ? "ruim" : "neutro" });
    });
    (c.operacoes_hoje as { hora?: string; lado?: string; valor?: number; preco?: number; motivo?: string }[]).forEach(o =>
      linha.push({ d: (r.dia || "") + (o.hora ? " " + o.hora : ""), txt: `${o.lado} ${Math.round(o.valor || 0).toLocaleString("pt-BR")} USDT a ${(o.preco || 0).toLocaleString("pt-BR")}` + (o.motivo ? ` (${o.motivo})` : ""), tom: "neutro" }));
    const b = baseConexao(e.conexao, true)
      || situacao(c.situacao, (c as { motivo?: string }).motivo, !!s.botao_parar, s.motivo_parar)
      || velho(e.agora, s.gerado_em, s.relatorio_em, PRAZO.intradia, "O day trade")
      || { estado: "ativo" as Estado, motivo: `Cripto negocia 24 horas. ${c.operacoes_hoje.length} ${c.operacoes_hoje.length === 1 ? "operação" : "operações"} hoje.` };
    const ult = linha.filter(x => x.d.length > 10).slice(-1)[0];
    return {
      id: "intradia:" + k, tipo: "robo", nome: nome(k), mercado: "Cripto", estrategia: "Ruído", versao,
      horizonte: "Intradia (30 min)", estagio: reprovada(c.veredito) ? "Observação" : "Ao vivo simulado",
      estado: b.estado, motivo: b.motivo,
      ultima: ult ? `operação às ${ult.d.slice(11)}` : r.dia ? `dia ${dBR(r.dia)}` : null,
      proxima: "confere de meia em meia hora; vende tudo às 20h59 de Brasília",
      moeda: "USDT", capital: 10000, patrimonio: c.inicio_do_dia, resultado: c.inicio_do_dia / 10000 - 1, quedaMax: null,
      custos: null, posicoes: [], amostra: (n => `${n} ${n === 1 ? "dia fechado" : "dias fechados"}`)((r.boletins || []).length),
      regra: REGRA.ruido + " " + FREIOS, dados: "Velas de 1 minuto públicas da Binance; preço com mais de 5 minutos é recusado.",
      parecer: parecerCurto(c.veredito), custoIA: SEM_IA, sombra: c.sombra_inicio_do_dia / 10000 - 1,
      linha: linha.slice(-40).reverse(),
    };
  });
}

// ---------- carteiras de referência (R$ 100) ----------
const MERCADO_CARTEIRA: Record<string, Mercado> = { brasil: "B3", eua: "EUA", cripto: "Cripto" };

function carteiras(e: Entrada): Entidade[] {
  const s = e.viz.carteiras;
  if (!s) return [];
  const r = s.relatorio, cap = r.capital_brl || 100;
  return Object.entries(r.carteiras || {}).map(([k, w]) => {
    const insuf = w.situacao === "capital insuficiente";
    const b = baseConexao(e.conexao, true)
      || (s.botao_parar ? { estado: "parado" as Estado, motivo: "Botão de parar ligado" + (s.motivo_parar ? `: ${s.motivo_parar}` : ".") } : null)
      || velho(e.agora, s.gerado_em, s.relatorio_em, PRAZO.carteiras, "A rodada das carteiras")
      || (w.situacao === "sem dados" ? { estado: "aguardando-dado" as Estado, motivo: "Sem preço recente do ativo" + (w.motivo ? `: ${w.motivo}` : ".") } : null)
      || (insuf ? { estado: "sem-capital" as Estado, motivo: `R$ ${cap} não compram uma unidade de ${w.ativo}` + (w.minimo_brl ? `; o mínimo seria R$ ${w.minimo_brl.toFixed(2).replace(".", ",")}.` : ".") } : null)
      || { estado: "ativo" as Estado, motivo: `Investida em ${w.ativo} desde ${w.comprou_em ? dBR(w.comprou_em) : "—"}.` };
    const hist = ((w as { historico?: [string, number][] }).historico || []);
    return {
      id: "carteira:" + k, tipo: "carteira", nome: `Carteira ${w.nome}`, mercado: MERCADO_CARTEIRA[k] || "Cripto",
      estrategia: "Só segurar", versao: (r as { versao?: string }).versao || "carteiras-r100-v1", horizonte: "Longo prazo", estagio: "Carteira de referência",
      estado: b.estado, motivo: b.motivo,
      ultima: r.ultimo_dia ? `rodada de ${dBR(r.ultimo_dia)}` : null, proxima: "uma rodada por dia, 19h50 de Brasília",
      moeda: "BRL", capital: cap, patrimonio: w.valor_brl, resultado: w.resultado, quedaMax: quedaDe(hist, cap),
      custos: w.custos_brl, posicoes: w.quantidade ? [`${w.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 8 })} ${w.ativo}`] : [],
      amostra: hist.length ? `${hist.length} ${hist.length === 1 ? "dia" : "dias"} desde ${dBR(hist[0][0])}` : r.inicio ? `desde ${dBR(r.inicio)}` : "nenhum dia ainda",
      regra: REGRA.carteira + " " + w.premissa, dados: "Preço e câmbio públicos (Yahoo e Binance), com custos de corretagem e câmbio.",
      parecer: null, custoIA: SEM_IA,
      linha: [
        ...(w.comprou_em ? [{ d: w.comprou_em, txt: `comprou ${w.ativo} a ${(w.preco_da_compra || 0).toLocaleString("pt-BR")} ${w.moeda}`, tom: "neutro" as const }] : []),
        ...hist.slice(-20).map(([d, v]) => ({ d, txt: `valor R$ ${v.toFixed(2).replace(".", ",")}`, tom: (v >= cap ? "bom" : "ruim") as Evento["tom"] })),
      ].sort((a, b) => b.d.localeCompare(a.d)),
      carteira: conciliar(w, cap),
    };
  });
}

function quedaDe(hist: [string, number][], cap: number) {
  if (!hist.length) return null;
  let pico = cap, q = 0;
  hist.forEach(([, v]) => { pico = Math.max(pico, v); q = Math.min(q, v / pico - 1); });
  return q;
}

// Caixa, reservado, exposição e conferência. O relatório não traz o caixa: ele é o valor menos o que está no ativo,
// e a conferência checa se esse caixa faz sentido (nem negativo, nem maior que o capital, nem dinheiro a mais).
export function conciliar(w: { valor_brl: number; quantidade: number; preco_atual: number | null; cambio_atual: number | null; moeda: string; situacao: string }, cap: number): Conciliacao {
  const cambio = w.moeda === "BRL" ? 1 : w.cambio_atual ?? null;
  const exposicao = w.quantidade && w.preco_atual != null && cambio != null ? w.quantidade * w.preco_atual * cambio : 0;
  const caixa = w.valor_brl - exposicao;
  const tol = 0.01;
  const semPreco = !!w.quantidade && (w.preco_atual == null || cambio == null);
  const fecha = !semPreco && caixa >= -tol && caixa <= cap + tol && (w.quantidade > 0 || Math.abs(w.valor_brl - cap) <= tol);
  const nota = semPreco ? "Falta preço ou câmbio de hoje para conferir."
    : fecha ? "Fecha: caixa + ativo = valor da carteira, sem dinheiro a mais."
    : "Não fecha: o valor informado não bate com caixa + ativo. Peça ao Claude para olhar.";
  return { capital: cap, caixa, reservado: 0, exposicao, fecha, nota };
}

// ---------- lote de robôs (lote-v1): observação, um capital e uma moeda por robô; nunca se somam ----------
const MERCADO_LOTE: Record<string, Mercado> = { cripto: "Cripto", eua: "EUA", b3: "B3" };
const HORIZONTE_LOTE: Record<string, string> = { diario: "Diário", "diário": "Diário", semanal: "Semanal", mensal: "Mensal" };
const dinheiroTxt = (v: number, moeda: string) => moeda === "BRL" ? "R$ " + v.toFixed(2).replace(".", ",") : v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " " + moeda;

function lote(e: Entrada): Entidade[] {
  const l = e.lote;
  if (!l) return [];
  return l.robos.map(r => {
    const mercado = MERCADO_LOTE[r.mercado] || "Cripto";
    const pg = mercado === "Cripto" ? null : e.pregao[mercado as "EUA" | "B3"] ?? null;
    const fam = r.estrategia.replace(/-v\d+$/i, "");
    const alvo = r.alvo.map(a => a.replace(/USDT$/, "")).join(", ") || r.id;
    const ci = r.capital_insuficiente;
    const ativ = r.atividade ? frase(r.atividade.replace(/^aguardando mercado: /, "").replace(/(\d{4})-(\d\d)-(\d\d)/g, (_, _a, m, d) => `${d}/${m}`)) : "";
    const b = baseConexao(e.conexao, true)
      || (l.botao_parar ? { estado: "parado" as Estado, motivo: frase(`Botão de parar do lote ligado: ${l.botao_parar}`) + " Só volta com ordem do Sebastian." } : null)
      || situacao(r.situacao, r.motivo, false)
      || velho(e.agora, l.gerado_em, l.relatorio_em, PRAZO.lote, "O relatório do lote")
      || (r.situacao === "capital insuficiente" ? { estado: "sem-capital" as Estado, motivo: ci
            ? frase(`${dinheiroTxt(ci.disponivel ?? r.capital, r.moeda)} não compram uma unidade de ${ci.ativo || alvo}` + (ci.preco != null ? ` a ${ci.preco.toLocaleString("pt-BR")}` : "") + (ci.capital_minimo_da_regra != null ? `; a regra precisaria de ${dinheiroTxt(ci.capital_minimo_da_regra, r.moeda)}` : ""))
            : "O capital não dá para comprar nem uma unidade do ativo." } : null)
      || (r.situacao === "aguardando dado" ? { estado: "aguardando-dado" as Estado, motivo: frase(r.atividade || "Sem o preço do dia") } : null)
      || (r.situacao === "aguardando o primeiro fechamento" ? (pg && !pg.aberto
            ? { estado: "aguardando-mercado" as Estado, motivo: `Ainda não começou: espera o primeiro fechamento. Bolsa fechada, ${abre(pg)}.` }
            : { estado: "aguardando-dado" as Estado, motivo: "Ainda não começou: espera o primeiro fechamento para decidir." }) : null)
      || (pg && !pg.aberto ? { estado: "aguardando-mercado" as Estado, motivo: `Bolsa fechada, ${abre(pg)}. ` + (r.situacao === "ativo, em caixa" ? "Em caixa." : `Comprado em ${Object.keys(r.posicoes).map(a => a.replace(/USDT$/, "")).join(", ") || alvo}.`) } : null)
      || { estado: "ativo" as Estado, motivo: (pg ? "Pregão aberto. " : "") + (r.situacao === "ativo, em caixa" ? "Em caixa." : `Comprado em ${Object.keys(r.posicoes).map(a => a.replace(/USDT$/, "")).join(", ") || alvo}.`) + (ativ ? " " + ativ.charAt(0).toUpperCase() + ativ.slice(1) : "") };
    const d = r.ultima_decisao;
    const opera = d && /^(comprar|vender|zerar)/i.test(d.texto);
    const decisao: Evento | null = d ? { d: d.dia || r.ultimo_pregao || "", tipo: opera ? "vai" : "nao", tom: "neutro",
      txt: (opera ? "" : "não operou: ") + d.texto.replace(/^não operar: /, "") + (d.para ? ` (decidido no fechamento de ${dBR(d.dia || "")}, vale para ${dBR(d.para)})` : "") } : null;
    const exposicao = r.valor != null && r.caixa != null ? r.valor - r.caixa : null;
    const fecha = r.conciliacao === true;
    const alertas = [
      !l.diario_integro ? `O diário do lote não confere${l.diario_problema ? ` (${l.diario_problema})` : ""}. Peça ao Claude para olhar.` : null,
      !fecha ? "O caixa não fecha com o diário. Veja o detalhe." : null,
    ].filter(Boolean) as string[];
    const posicoes = Object.entries(r.posicoes).map(([a, q]) => `${q.toLocaleString("pt-BR", { maximumFractionDigits: 8 })} ${a}`);
    return {
      id: "lote:" + r.id, tipo: "robo", nome: `${fam} · ${alvo}`, mercado, estrategia: fam, versao: r.estrategia + (l.versao ? ` · ${l.versao}` : ""),
      horizonte: HORIZONTE_LOTE[r.horizonte.toLowerCase()] || r.horizonte, estagio: ESTAGIO_LOTE,
      estado: b.estado, motivo: b.motivo,
      ultima: r.ultimo_pregao ? `fechamento de ${dBR(r.ultimo_pregao)}` : null,
      proxima: (ativ ? ativ.charAt(0).toUpperCase() + ativ.slice(1) + " " : "") + "O lote confere de hora em hora.",
      moeda: r.moeda, capital: r.capital, patrimonio: r.valor, resultado: r.resultado, quedaMax: r.queda_maxima,
      custos: r.custos != null ? r.custos + (r.imposto_pago ?? 0) : null, posicoes,
      amostra: r.historico.length ? `${r.historico.length} ${r.historico.length === 1 ? "fechamento" : "fechamentos"}` + (r.inicio ? ` desde ${dBR(r.inicio)}` : "") : "nenhum fechamento ainda",
      regra: `${r.estrategia} em ${alvo}. Execução: ${r.execucao || "—"}. ` + FREIOS,
      dados: mercado === "Cripto" ? "Velas diárias públicas da Binance." : "Preços diários públicos do Yahoo" + (mercado === "B3" ? ", com dividendos e IR." : ", com dividendos."),
      parecer: r.veredito, veredito: r.veredito, custoIA: SEM_IA,
      regua: { valor: r.regua_valor, resultado: r.regua_resultado, nome: `só segurar ${alvo}` },
      alerta: alertas.join(" ") || null,
      decisao,
      linha: [
        ...(d ? [{ ...decisao!, d: d.dia || "" }] : []),
        ...r.historico.slice(-20).reverse().map(([dia, v, rg]) => ({ d: dia, tipo: "info" as const,
          txt: `fechou valendo ${dinheiroTxt(v, r.moeda)}` + (rg != null ? ` · régua ${dinheiroTxt(rg, r.moeda)}` : ""),
          tom: (rg != null ? (v > rg ? "bom" : v < rg ? "ruim" : "neutro") : "neutro") as Evento["tom"] })),
      ],
      carteira: { capital: r.capital, caixa: r.caixa, reservado: 0, exposicao, fecha, moeda: r.moeda, real: true,
        aPrecoDe: r.ultimo_pregao, pendente: d && d.para ? `${d.texto} (no pregão de ${dBR(d.para)})` : null,
        nota: fecha ? "Fecha: o lote refez o caixa pelo diário e bateu com o estado." : `Não fecha: ${(r.conciliacao as string[]).join("; ")}` },
    };
  });
}

export function montarEntidades(e: Entrada): Entidade[] {
  const todas = [...cripto(e), ...intradia(e), ...bolsa(e), ...carteiras(e), ...lote(e)];
  return e.detalhe ? todas.map(x => comDetalhe(x, e.detalhe!.robos[x.id])) : todas;
}

const TOM: Record<TipoEvento, Evento["tom"]> = { op: "neutro", vai: "neutro", nao: "neutro", rec: "ruim", freio: "ruim", info: "neutro" };
const evento = (x: EventoDetalhe): Evento => ({ d: x.em, txt: x.txt, tom: x.tipo === "freio" && /voltou|retomada|encerrada/.test(x.txt) ? "bom" : TOM[x.tipo], tipo: x.tipo, vezes: x.vezes, desde: x.desde });

// Junta o detalhe da VPS: linha do tempo com as decisões de não operar, custos reais, caixa e conciliação.
// O estado (situação) não muda: ele vem dos prazos e da conexão; o detalhe só explica melhor.
export function comDetalhe(x: Entidade, d: DetalheRobo | undefined): Entidade {
  if (!d) return x;
  const linha = d.linha.length ? d.linha.map(evento).reverse() : x.linha;
  const decisao = [...d.linha].reverse().find(v => v.tipo === "op" || v.tipo === "vai" || v.tipo === "nao" || v.tipo === "rec");
  const carteira: Conciliacao = {
    capital: x.capital, caixa: d.caixa, reservado: d.reservado, exposicao: d.exposicao,
    fecha: d.conciliacao.fecha, nota: d.conciliacao.nota, moeda: d.moeda || x.moeda, real: true,
    aPrecoDe: d.a_preco_de, pendente: d.pendente, caixaLocal: d.caixa_local ?? null, diferenca: d.conciliacao.diferenca,
  };
  const custos = d.custos != null ? d.custos + (x.mercado !== "Cripto" && x.tipo !== "carteira" ? d.imposto ?? 0 : 0) : x.custos;
  return { ...x, linha, decisao: decisao ? evento(decisao) : null, carteira, custos };
}

// ---------- filtros ----------
export type Filtro = { mercado: string; estrategia: string; horizonte: string; estagio: string; estado: string };
export const TODOS = "todos";
export const filtroVazio = (): Filtro => ({ mercado: TODOS, estrategia: TODOS, horizonte: TODOS, estagio: TODOS, estado: TODOS });
export const CAMPOS = ["mercado", "estrategia", "horizonte", "estagio", "estado"] as const;

export function filtrar(lista: Entidade[], f: Filtro) {
  return lista.filter(x => CAMPOS.every(c => f[c] === TODOS || x[c] === f[c]));
}

// Opções de cada filtro, só com o que existe, e quantos sobram em cada uma considerando os outros filtros.
export function opcoes(lista: Entidade[], f: Filtro, campo: typeof CAMPOS[number]) {
  const resto = filtrar(lista, { ...f, [campo]: TODOS });
  const conta = new Map<string, number>();
  lista.forEach(x => conta.set(x[campo], 0));
  resto.forEach(x => conta.set(x[campo], (conta.get(x[campo]) || 0) + 1));
  return [...conta.entries()].map(([valor, n]) => ({ valor, n }));
}

export function contarEstados(lista: Entidade[]) {
  const c: Partial<Record<Estado, number>> = {};
  lista.forEach(x => { c[x.estado] = (c[x.estado] || 0) + 1; });
  return c;
}
