import { useMemo } from "react";
import { hora } from "../dados/formato";
import { dinheiro } from "../dados/escritorio";
import type { Entidade } from "../dados/estados";
import type { Fabrica } from "../dados/fabrica";
import {
  cartaoSimples, contar, resumo, pedidos, colunasTarefas, GRUPOS, GLOSSARIO, NOME_MEMBRO,
  type CartaoSimples, type Grupo, type Tarefa, type Custos,
} from "../dados/visao";
import type { Periodo } from "../dados/escritorio";

// Visão geral (encaminhamento de 29/10/2026, §8): em 30 segundos, o que está acontecendo, quem tem posição, quem espera
// e por quê, o que a equipe faz, quanto custa a IA de verdade e se algo precisa do Sebastian. Frases feitas por regra
// a partir dos dados; nenhuma IA escreve esta tela.
export type Aba = "visao" | "pregao" | "robos" | "passado" | "fabrica" | "gastos" | "contas" | "diario" | "ajustes";

type Props = {
  lista: Entidade[]; tarefas: { em: string | null; lista: Tarefa[] } | null; fabrica: Fabrica | null; custos: Custos | null;
  conexao: { ok: boolean; msg?: string; desde?: string | null }; lidoEm: string | null; enviadoEm: string | null;
  agentes: { ia: number; apoio: number } | null; mudou: string[]; ultimaVisita: string | null; periodo: Periodo; agora: number;
  abrir: (id: string) => void; ir: (a: Aba) => void;
};

// O robô da PETR4 roda no MT5 do PC do Sebastian e não manda nada para a VPS (sem telemetria por desenho, não por
// defeito): aparece sempre como "sem informação", para a ausência não parecer folga (§6 e §8.4).
const PETR4: CartaoSimples = {
  id: "pc:petr4", nome: "Rompimento da abertura · PETR4 (no seu computador)", tecnico: "ORB-B3 · PETR4 (b3xp, MT5 da XP Demo)", tipo: "robo",
  mercado: "B3", ritmo: "day trade na B3, olha a primeira meia hora do pregão", grupo: "sem-info",
  agora: "não recebemos sinal do computador",
  porque: "O robô roda no MT5 do seu computador e não manda informação para este painel. Não dá para confirmar daqui que ele está funcionando.",
  proxima: "a confirmação depende do computador ligado durante o pregão",
  resultado: { txt: "sem informação", tom: "aviso", nota: "o resultado fica só no computador" },
  acumulado: { txt: "sem informação", tom: "aviso", nota: "o resultado fica só no computador" },
  horarios: "sem horário: nada chega daqui", projecao: null,
};

export function VisaoGeral(p: Props) {
  const cartoes = useMemo(() => {
    const l = p.lista.filter(x => x.tipo === "robo").map(x => cartaoSimples(x, p.agora, p.periodo));
    if (!p.lista.some(x => /petr4/i.test(x.id))) l.push(PETR4);
    return l;
  }, [p.lista, p.agora, p.periodo]);
  const comparacoes = useMemo(() => p.lista.filter(x => x.tipo !== "robo").map(x => cartaoSimples(x, p.agora, p.periodo)), [p.lista, p.agora, p.periodo]);
  const c = contar(p.lista, p.agentes);
  const grupos: Grupo[] = ["posicao", "esperando", "problema", "sem-info"];
  const por = (g: Grupo) => cartoes.filter(x => x.grupo === g);
  const petr4 = cartoes.includes(PETR4) ? 1 : 0;
  const frases = resumo({ lista: p.lista, tarefas: p.tarefas, fabrica: p.fabrica, custos: p.custos, conexao: p.conexao });
  if (petr4) frases.splice(1, 0, "Além deles, o robô da PETR4 roda no seu computador e não manda informação para cá: não dá para confirmar daqui que ele está funcionando.");
  const peds = pedidos(p.tarefas);
  const col = p.tarefas ? colunasTarefas(p.tarefas.lista) : null;
  const intencoes = cartoes.filter(x => x.projecao);

  return (
    <div className="visao">
      <p className="faixa-sim" role="note"><b>100% simulação — nenhum investimento real.</b> Os ganhos e perdas dos robôs são dinheiro de mentira. A única despesa de verdade é a da IA, em <button type="button" className="link" onClick={() => p.ir("gastos")}>Gastos de IA</button>.</p>

      <section className={"pedido " + (peds == null ? "pedido-aviso" : peds.length ? "pedido-sim" : "pedido-nada")} aria-label="Precisa de você?">
        <h2>Precisa de você?</h2>
        {peds == null && <p>Não sabemos: o registro de tarefas da equipe não chegou na última leitura. Por isso o painel não diz "nada precisa de você".</p>}
        {peds && !peds.length && <p><b>Nada precisa de você agora.</b> Pode só acompanhar.</p>}
        {peds && !!peds.length && (
          <ul>
            {peds.map(x => (
              <li key={x.titulo}><b>{x.titulo}</b><br /><span>O que falta de você: {x.oQue}.</span>{x.porque && x.porque !== x.oQue && <><br /><span className="muted pequeno">Por quê: {x.porque}.</span></>}</li>
            ))}
          </ul>
        )}
        {peds && !!peds.length && <p className="muted pequeno">Só aparece aqui o que o registro de tarefas diz que é seu. O que depende de um agente fica em Equipe e tarefas.</p>}
      </section>

      <section className="resumo" aria-label="Em resumo">
        <h2>Em resumo</h2>
        {frases.map((f, i) => <p key={i}>{f}</p>)}
        <p className="muted pequeno">Frases montadas por regra a partir dos dados, sem IA. Dados enviados pela VPS {p.enviadoEm ? "às " + hora(p.enviadoEm) : "— ainda não"} · lidos pelo painel {p.lidoEm ? "às " + hora(p.lidoEm) : "— ainda não"}. Ler de novo não deixa o preço mais novo: cada robô mostra o horário do preço dele.</p>
      </section>

      <section className="mudou" aria-label="O que mudou desde sua última visita">
        <h2>O que mudou desde sua última visita</h2>
        {!p.ultimaVisita && <p className="muted">Primeira visita registrada neste computador. Da próxima vez, aparece aqui o que mudou.</p>}
        {p.ultimaVisita && !p.mudou.length && <p className="muted">Nada mudou desde {hora(p.ultimaVisita)}.</p>}
        {p.ultimaVisita && !!p.mudou.length && <><p className="muted pequeno">Desde {hora(p.ultimaVisita)}:</p><ul>{p.mudou.map((m, i) => <li key={i}>{m}</li>)}</ul></>}
      </section>

      <section className="blocos" aria-label="As quatro áreas">
        <button type="button" className="bloco" onClick={() => p.ir("pregao")}>
          <span className="bloco-tit">Robôs em simulação</span>
          <b>{c.robos + petr4} robôs · {c.estrategias + petr4} estratégias</b>
          <span>{c.porGrupo.posicao} com posição · {c.porGrupo.esperando} esperando · {c.porGrupo.problema} com problema · {c.porGrupo["sem-info"] + petr4} sem informação</span>
          <span className="muted pequeno">À parte: {c.comparacoes} réguas e {c.carteiras} carteiras de referência{c.agentes ? ` · ${c.agentes.ia} agentes de IA e ${c.agentes.apoio} programas de apoio` : ""}. Nada disso se soma.</span>
        </button>
        <button type="button" className="bloco" onClick={() => p.ir("fabrica")}>
          <span className="bloco-tit">Equipe e tarefas</span>
          {col ? <>
            <b>{col.execucao.length} em execução · {col.proximas.length} próximas</b>
            <span>{col.aguardando.length} aguardando condição · {col.incidentes.length} {col.incidentes.length === 1 ? "incidente" : "incidentes"}</span>
          </> : <b>registro de tarefas não chegou</b>}
          <span className="muted pequeno">Quem pesquisa, confere e programa as estratégias.</span>
        </button>
        <button type="button" className="bloco" onClick={() => p.ir("passado")}>
          <span className="bloco-tit">Testes no passado</span>
          <b>3 regras reproduzidas</b>
          <span>em 4 capitais e 2 cenários de custo</span>
          <span className="muted pequeno">Pregões que já aconteceram. Não é resultado de hoje.</span>
        </button>
        <button type="button" className="bloco bloco-real" onClick={() => p.ir("gastos")}>
          <span className="bloco-tit">Despesa real de IA/API</span>
          {p.custos ? <>
            <b>{dinheiro(p.custos.gasto, "USD")} de {dinheiro(p.custos.teto, "USD")} no mês</b>
            <span>disponível {dinheiro(p.custos.disponivel, "USD")}</span>
            <span className="muted pequeno">Dinheiro de verdade · atualizado {p.custos.em ? hora(p.custos.em) : "—"}</span>
          </> : <b>sem informação de custo</b>}
        </button>
      </section>

      {!!intencoes.length && (
        <section className="intencoes" aria-label="Decidido para a próxima abertura">
          <h2>Decidido para a próxima abertura</h2>
          <p className="muted pequeno">Intenção ou projeção — ainda não é execução confirmada. Não entra no patrimônio nem senta na mesa até a compra acontecer.</p>
          <ul>{intencoes.map(x => <li key={x.id}><b>{x.nome}</b>: {x.projecao}</li>)}</ul>
        </section>
      )}

      <section aria-label="Robôs em simulação">
        <h2>Robôs em simulação</h2>
        <p className="muted pequeno">No escritório, quem tem posição fica na mesa e quem está sem posição vai para o lazer. <b>No lazer = sem posição ou sem tarefa neste momento. Não significa necessariamente desligado.</b> Clique num robô para ver o detalhe.</p>
        {grupos.map(g => !!por(g).length && (
          <div key={g} className={"grupo grupo-" + g}>
            <h3>{GRUPOS[g].rotulo} <span className="muted">({por(g).length})</span></h3>
            <p className="muted pequeno">{GRUPOS[g].explica}</p>
            <div className="simples-grade">{por(g).map(x => <Cartao key={x.id} x={x} abrir={x.id === PETR4.id ? null : () => p.abrir(x.id)} periodo={p.periodo} />)}</div>
          </div>
        ))}
      </section>

      {!!comparacoes.length && (
        <details className="glossario">
          <summary>Comparações: réguas e carteiras de referência ({comparacoes.length})</summary>
          <p className="muted pequeno">Não são robôs: só compram e seguram, para mostrar o que teria acontecido sem estratégia. Cada uma na sua moeda; nunca se somam.</p>
          <div className="simples-grade">{comparacoes.map(x => <Cartao key={x.id} x={x} abrir={() => p.abrir(x.id)} periodo={p.periodo} />)}</div>
        </details>
      )}

      <details className="glossario" id="glossario">
        <summary>O que quer dizer cada palavra do painel</summary>
        <dl>{GLOSSARIO.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}</dl>
      </details>
    </div>
  );
}

function Cartao({ x, abrir, periodo }: { x: CartaoSimples; abrir: (() => void) | null; periodo: Periodo }) {
  const corpo = (
    <>
      <header><b>{x.nome}</b><span className="muted pequeno">{x.mercado} · {x.ritmo}</span></header>
      <p className="simples-agora">{x.agora}</p>
      <p className="pequeno"><span className="muted">Por quê: </span>{x.porque}</p>
      <p className="pequeno"><span className="muted">Próximo: </span>{x.proxima}</p>
      <p className="simples-fin">
        <span className={"fin-" + x.resultado.tom} title={x.resultado.nota}>{x.resultado.txt}</span>
        {periodo === "dia" && <span className={"fin-" + x.acumulado.tom} title={x.acumulado.nota}>{x.acumulado.txt.replace(/^ACUM/, "desde o início")}</span>}
      </p>
      <p className="muted pequeno">{x.horarios}</p>
    </>
  );
  return abrir
    ? <button type="button" className={"simples simples-" + x.grupo} onClick={abrir} title={"Ver detalhe de " + x.tecnico}>{corpo}</button>
    : <article className={"simples simples-" + x.grupo} title={x.tecnico}>{corpo}</article>;
}

export const membroNome = (id: string) => NOME_MEMBRO[id] || id;
