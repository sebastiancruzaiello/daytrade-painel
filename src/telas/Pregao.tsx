import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../ui/affectui/button";
import { SegmentedControl } from "../ui/affectui/segmented-control";
import { NumberTicker } from "../ui/affectui/number-ticker";
import { NotificationStack, type Notice } from "../ui/affectui/notification-stack";
import { criarCena, type Cena, type Area } from "../salao/cena";
import { KS, NOME, COR, REF, fmt, pct, dBR, hora, resumoConta, type Fonte } from "../dados/formato";
import type { Base, InfoVivo } from "../App";
import { IconePlay, IconePausa } from "./icones";
import { Ficha } from "./Ficha";
import { segurar, pregao, type Extras, type Mercado } from "../dados/mercados";
import { ESTADOS, contarEstados, type Entidade, type Estado } from "../dados/estados";
import { planta, desenhados, FIXOS, type Conta } from "../dados/elenco";
import { DetalheEntidade } from "./Robos";
import {
  faseAgora, escritorioAgora, relogio, atividade, atividadeTarefas, reconciliarInventario, PERSONAGEM_FICHA,
  type Prontidao, type Agentes, type Resultados, type Periodo, type Atividade,
} from "../dados/escritorio";

type Props = {
  fonte: Fonte; di: number; setDi: (i: number) => void;
  tocando: boolean; setTocando: (b: boolean) => void; passo: string; setPasso: (s: string) => void;
  base: Base; setBase: (b: Base) => void; temVivo: boolean; pararTeste: boolean;
  info: InfoVivo; vivo: Fonte | null; ex: Extras;
  entidades: Entidade[]; contaElenco: Conta; verRobos: () => void;
  pront: Prontidao | null; agentes: Agentes | null; res: Resultados | null;
  periodo: Periodo; setPeriodo: (p: Periodo) => void; agora: number;
};

export function Pregao(p: Props) {
  const { fonte, di, base, pararTeste } = p;
  const dias = fonte.dias, d = dias[di];
  const cv = useRef<HTMLCanvasElement>(null);
  const cena = useRef<Cena | null>(null);
  const [zoom, setZoom] = useState(1);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [lateral, setLateral] = useState(() => { try { return localStorage.getItem("lateral") !== "fechada"; } catch { return true; } });
  const mudaLateral = (v: boolean) => { setLateral(v); try { localStorage.setItem("lateral", v ? "aberta" : "fechada"); } catch { /* sem memória do navegador, tudo bem */ } };
  // Clicar em alguém abre a coluna para mostrar a ficha.
  useEffect(() => { if (selecionado) setLateral(true); }, [selecionado]);
  const fecharFicha = () => { setSelecionado(null); cena.current?.selecionar(null); };

  useEffect(() => {
    cena.current = criarCena(cv.current!, setZoom, setSelecionado);
    return () => cena.current?.destruir();
  }, []);
  // O que cada agente e cada robô de apoio comprovadamente fez (linha agentes:resumo + tabelas do n8n).
  const atividades = useMemo(() => atividadesDosPersonagens(p.agentes, p.ex, p.agora), [p.agentes, p.ex, p.agora]);
  useEffect(() => {
    cena.current?.mostrar({ D: fonte, dias, di, pararTeste, vivo: p.vivo, aoVivo: base === "aovivo", ex: p.ex, entidades: p.entidades, periodo: p.periodo, atividades });
  }, [fonte, dias, di, pararTeste, p.vivo, base, p.ex, p.entidades, p.periodo, atividades]);
  // Quem estava selecionado e saiu da lista: a ficha fecha.
  const entSel = selecionado?.startsWith("ent:") ? p.entidades.find(x => x.id === selecionado.slice(4)) || null : null;
  useEffect(() => { if (selecionado?.startsWith("ent:") && !entSel) { setSelecionado(null); cena.current?.selecionar(null); } }, [selecionado, entSel]);

  const fim = di >= dias.length - 1;
  const letreiro = useMemo(() => {
    const partes = KS.map((k, ki) => ({ k, nome: NOME[k], v: d.eq[ki], r: d.eq[ki] / 10000 - 1 }));
    // Ao vivo: todos os robôs da lista (não só os 3 do cripto diário). Ensaio: as 3 contas do cripto naquele dia.
    const robos = p.entidades.filter(x => x.tipo === "robo" && !x.semTelemetria);
    const emPos = base === "aovivo" ? `${robos.filter(x => x.posicoes.length).length} de ${robos.length} robôs`
      : `${d.pos.filter(x => x.length).length} de ${KS.length} contas do cripto diário`;
    const acoes = ([["SPY", p.ex.spy], ["BOVA11", p.ex.bova]] as const).map(([t, mk]) => ({ t, s: segurar(mk, dias[0].d, d.d) }));
    return { partes, emPos, acoes };
  }, [d, dias, p.ex, p.entidades, base]);

  return (
    <div className="pregao">
      <FaixaProntidao pront={p.pront} agora={p.agora} periodo={p.periodo} setPeriodo={p.setPeriodo} aoVivo={base === "aovivo"}
        focar={a => cena.current?.focar(a)} />
      <div className={"pregao-cima" + (lateral ? "" : " sem-lateral")}>
      <section className="palco" aria-label="Salão de trading animado">
        <div className="palco-rola">
          <canvas ref={cv} aria-label="Escritório animado: salão de cripto e ala de ações (EUA e B3). Role o mouse para aproximar, arraste para mover, clique numa pessoa para ver a ficha." />
          <button type="button" className="lateral-botao" onClick={() => mudaLateral(!lateral)} aria-expanded={lateral} title={lateral ? "Esconder a coluna e aumentar o escritório" : "Mostrar avisos e fichas"}>{lateral ? "Esconder coluna ›" : "‹ Avisos e fichas"}</button>
          <div className="zoom" role="group" aria-label="Zoom do salão">
            <button type="button" onClick={() => cena.current?.mais()} aria-label="Aproximar" title="Aproximar">+</button>
            <span aria-live="polite">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => cena.current?.menos()} aria-label="Afastar" title="Afastar" disabled={zoom <= 1.01}>−</button>
            <button type="button" className="zoom-tudo" onClick={() => cena.current?.inicio()} disabled={zoom <= 1.01} title="Ver o salão inteiro">Salão inteiro</button>
          </div>
          {zoom <= 1.01 && <p className="zoom-dica">Clique numa pessoa para ver a ficha dela · clique numa mesa para chegar perto · role o mouse para dar zoom</p>}
        </div>
        <div className="letreiro" aria-hidden="true">
          <div className="letreiro-in">
            {[0, 1].map(n => (
              <span key={n}>
                {letreiro.partes.map(x => (
                  <span key={x.k}><b>{x.nome}</b> {fmt(x.v)} <em className={x.r >= 0 ? "up" : "dn"}>{pct(x.r)}</em> · </span>
                ))}
                <span><b>BTC</b> {fmt(d.px[0])} · <b>ETH</b> {fmt(d.px[1])} · </span>
                {letreiro.acoes.map(x => x.s && <span key={x.t}><b>{x.t}</b> {fmt(x.s.preco, 2)} · </span>)}
                <span><b>{letreiro.emPos}</b> com posição aberta{base === "aovivo" ? "" : " neste dia do ensaio"} · </span>
                {d.ev && <span><b>hoje</b> {d.ev}: não abre posição · </span>}
              </span>
            ))}
          </div>
        </div>
      </section>
        <aside className="avisos" hidden={!lateral}>
          {entSel
            ? <DetalheEntidade x={entSel} fechar={fecharFicha} />
            : selecionado && !selecionado.startsWith("ent:")
            ? <Ficha id={selecionado} fonte={fonte} di={di} pararTeste={pararTeste} aoVivo={base === "aovivo"} ex={p.ex} fechar={fecharFicha} atividade={atividades[selecionado] || null} />
            : <>
                <h2>Situação agora</h2>
                <Situacao lista={p.entidades} conta={p.contaElenco} ver={p.verRobos} pront={p.pront} />
                <h2>Avisos</h2>
                <Avisos {...p} />
                <Legenda />
              </>}
        </aside>
      </div>

      <div className="controles">
        <Button
          variant="secondary"
          icon={p.tocando ? <IconePausa /> : <IconePlay />}
          onClick={() => { if (fim) { p.setDi(0); p.setTocando(true); } else p.setTocando(!p.tocando); }}
          disabled={base === "aovivo" && dias.length < 2}
        >
          {p.tocando ? "Pausar" : fim ? "Recomeçar" : "Continuar"}
        </Button>
        <SegmentedControl
          size="sm"
          aria-label="Velocidade"
          value={p.passo}
          onChange={p.setPasso}
          options={[{ value: "900", label: "1×" }, { value: "350", label: "3×" }, { value: "120", label: "8×" }]}
        />
        <SegmentedControl<Base>
          size="sm"
          aria-label="O que mostrar"
          value={base}
          onChange={p.setBase}
          options={[
            { value: "aovivo", label: "Ao vivo", disabled: !p.temVivo, badge: p.temVivo ? undefined : "desligado" },
            { value: "recente", label: "Ensaio ago–out/26" },
            { value: "longo", label: "Ensaio 2024–26" },
          ]}
        />
        <label className="linha-tempo">
          <span className="data">{dBR(d.d)}</span>
          <input type="range" min={0} max={dias.length - 1} value={di} onChange={e => p.setDi(+e.target.value)} aria-label="Dia mostrado" />
        </label>
      </div>
      {pararTeste && <p className="aviso-teste">Teste só nesta tela: os robôs saem pela porta. Nada foi enviado para a VPS.</p>}

      <div className="cartoes">
          {KS.map((k, ki) => {
            const r = resumoConta(dias, di, ki, pararTeste);
            return (
              <article className="cartao" key={k} style={{ ["--cor" as string]: COR[k] }}>
                <header>
                  <span className="cartao-nome"><i className="ponto" />{NOME[k]}</span>
                  <span className={"pilula " + r.st}>{r.st}</span>
                </header>
                <div className="grande">
                  <NumberTicker value={Math.round(r.eq)} locale="pt-BR" duration={Math.min(450, Number(p.passo) * 0.6)} />
                  <small className={r.ret >= 0 ? "up" : "dn"}>{pct(r.ret)}</small>
                </div>
                <dl>
                  <div><dt>{REF[ki]}</dt><dd>{fmt(r.ref)} ({pct(r.refRet)})</dd></div>
                  <div><dt>queda desde o pico</dt><dd>{pct(r.queda)}</dd></div>
                  <div><dt>posição</dt><dd>{r.pos.length ? r.pos.join(", ") : "caixa"}</dd></div>
                </dl>
              </article>
            );
          })}
          <CartaoAcoes titulo="Segurar SPY" mercado="EUA" cor="#e8a25b" mk={p.ex.spy} inicio={dias[0].d} dia={d.d} aoVivo={base === "aovivo"} />
          <CartaoAcoes titulo="Segurar BOVA11" mercado="B3" cor="#5fcf8f" mk={p.ex.bova} inicio={dias[0].d} dia={d.d} aoVivo={base === "aovivo"} />
      </div>
    </div>
  );
}

// Ações ainda não têm robô: o cartão mostra a régua (só segurar o fundo) que as estratégias do laboratório vão precisar vencer.
function CartaoAcoes({ titulo, mercado, cor, mk, inicio, dia, aoVivo }: { titulo: string; mercado: string; cor: string; mk: Mercado; inicio: string; dia: string; aoVivo: boolean }) {
  const s = segurar(mk, inicio, dia);
  const pg = aoVivo ? pregao(mk) : null;
  return (
    <article className="cartao" style={{ ["--cor" as string]: cor }}>
      <header>
        <span className="cartao-nome"><i className="ponto" />{mercado} · {titulo}</span>
        <span className="pilula regua">régua</span>
      </header>
      <div className="grande">
        {s ? <><NumberTicker value={Math.round(s.valor)} locale="pt-BR" duration={300} /><small className={s.ret >= 0 ? "up" : "dn"}>{pct(s.ret)}</small></> : <small>sem dados neste dia</small>}
      </div>
      <dl>
        <div><dt>preço ({mk.moeda})</dt><dd>{s ? fmt(s.preco, 2) + " em " + dBR(s.diaPreco).slice(0, 5) : "—"}</dd></div>
        <div><dt>em 12 meses</dt><dd>{s && s.ret1a != null ? pct(s.ret1a) : "—"}</dd></div>
        <div><dt>pregão</dt><dd>{pg ? pg.texto : s?.teveHoje ? "teve pregão" : "sem pregão neste dia"}</dd></div>
      </dl>
    </article>
  );
}

function Avisos({ info, vivo, base, fonte, di }: Props) {
  const lista: Notice[] = [];
  const st = vivo?.status;
  if (st?.botao_parar) lista.push({ id: "parar", badge: "Parado", title: "Botão de parar ligado", text: st.motivo_parar || "A simulação está parada. Retomar só com ordem do Sebastian.", pattern: "rays" });
  if (st && !st.diario_integro) lista.push({ id: "diario", badge: "Atenção", title: "Diário com problema", text: st.diario_problema || "A corrente do diário não fecha. Peça ao Claude para olhar.", pattern: "rays" });
  if (info.estado === "ok" && (Date.now() - Date.parse(info.geradoEm)) / 36e5 > 26) lista.push({ id: "mudo", badge: "Atenção", title: "VPS sem notícia", text: "Último resumo de " + hora(info.geradoEm) + ". Pode ser a VPS ou o n8n.", pattern: "orbit" });
  const freios: string[] = [];
  for (let i = di; i >= Math.max(0, di - 6); i--) fonte.dias[i].x.forEach(e => { if (e[1] !== "retomar") freios.push(`${dBR(fonte.dias[i].d).slice(0, 5)} ${NOME[e[0]] || e[0]}: ${e[2]}`); });
  if (freios.length) lista.push({ id: "freios", badge: "Freio", title: "Motor de risco agiu esta semana", text: freios.slice(0, 2).join(" · "), pattern: "grid" });
  if (info.estado === "sem-endereco") lista.push({ id: "ligar", badge: "Dica", title: "Ao vivo ainda não ligado", text: "Por enquanto o programa mostra os ensaios. Cole a chave de leitura em Ajustes para ver a VPS.", pattern: "orbit" });
  if (base !== "aovivo") lista.push({ id: "ensaio", badge: "Ensaio", title: "Você está vendo um ensaio", text: "O mesmo pacote aovivo-v1 rodado em dias passados, com dinheiro de mentira.", pattern: "grid" });
  if (!lista.length) lista.push({ id: "tudo-ok", badge: "Tudo certo", title: "Nada fora do normal", text: "Sem freios nos últimos 7 dias e o diário está íntegro.", pattern: "orbit" });
  const chave = lista.map(n => n.id + n.text).join("|");
  const estavel = useMemo(() => lista, [chave]); // eslint-disable-line react-hooks/exhaustive-deps
  return <NotificationStack notices={estavel} />;
}

// Quantos robôs em cada situação e quem precisa de atenção, com o motivo. "Aguardando mercado" não é problema.
function Situacao({ lista, conta, ver, pront }: { lista: Entidade[]; conta: Conta; ver: () => void; pront: Prontidao | null }) {
  const c = contarEstados(lista);
  const atencao = lista.filter(x => x.estado !== "ativo" && x.estado !== "aguardando-mercado");
  const nDesenho = useMemo(() => desenhados(lista, planta(lista)), [lista]);
  const desenhadosIds = useMemo(() => { const pl = planta(lista); return new Set([...pl.lugares.map(l => l.id), ...lista.filter(x => FIXOS.has(x.id)).map(x => x.id)]); }, [lista]);
  const inv = reconciliarInventario(pront, desenhadosIds);
  const semDado = lista.filter(x => x.semTelemetria).length;
  return (
    <div className="situacao">
      <p className="conta-elenco" title="Esperados: quem o cadastro da VPS diz que existe. Recebidos: quem veio na última leitura. No escritório: quantos estão desenhados.">
        {conta.esperados != null ? <>Esperados <b>{conta.esperados}</b> · recebidos <b className={conta.recebidos < conta.esperados ? "dn" : ""}>{conta.recebidos}</b> · </> : <>Recebidos <b>{lista.length}</b> · </>}
        no escritório <b className={nDesenho < lista.length ? "dn" : ""}>{nDesenho}</b>
        {conta.esperados == null && <span className="muted"> (a VPS ainda não manda o cadastro; sem ele, quem some não é notado)</span>}
        {semDado > 0 && <span className="dn"> · {semDado} sem telemetria</span>}
      </p>
      {inv && (
        <p className="conta-elenco" title="Aprovado: está na main do repositório e a ficha do catálogo foi aprovada. Instalado: o config está na VPS. Em dia: a simulação gravou dentro do prazo. Enviado: veio na leitura. Desenhado: está no escritório.">
          Inventário: aprovados <b>{inv.aprovados}</b> · instalados <b className={inv.instalados < inv.aprovados ? "dn" : ""}>{inv.instalados}</b> · em dia <b className={inv.emDia < inv.instalados ? "dn" : ""}>{inv.emDia}</b> · enviados <b className={inv.enviados < inv.instalados ? "dn" : ""}>{inv.enviados}</b> · desenhados <b className={inv.desenhados < inv.enviados ? "dn" : ""}>{inv.desenhados}</b>
          {inv.faltando.length > 0 && <span className="muted"> · {inv.faltando.length} com pendência (veja Robôs › Inventário)</span>}
        </p>
      )}
      <div className="resumo-estados">
        {(Object.keys(ESTADOS) as Estado[]).filter(k => c[k]).map(k => (
          <span key={k} className={"chip-estado tom-" + ESTADOS[k].tom} title={ESTADOS[k].explica}><i aria-hidden="true" />{ESTADOS[k].rotulo} <b>{c[k]}</b></span>
        ))}
      </div>
      {atencao.slice(0, 4).map(x => (
        <p key={x.id} className="situacao-item"><b>{x.nome}</b> <span className={"pilula-estado tom-" + ESTADOS[x.estado].tom}>{ESTADOS[x.estado].rotulo}</span><br /><span className="muted">{x.motivo}</span></p>
      ))}
      {atencao.length > 4 && <p className="muted pequeno">e mais {atencao.length - 4}.</p>}
      <button type="button" className="link" onClick={ver}>Ver todos os {lista.length}, com filtros e detalhes ›</button>
    </div>
  );
}

function Legenda() {
  return (
    <ul className="legenda">
      <li className="legenda-chave"><b>No lazer = sem posição ou sem tarefa neste momento. Não significa necessariamente desligado.</b> Quem tem problema ou não manda informação nunca vai para o lazer.</li>
      <li><b>Sentado na mesa</b> robô comprado (tem moeda ou ação), mesmo parado esperando. Em cima: ganho ou perda do período escolhido (DIA ou ACUM), em verde, vermelho ou neutro, com moeda; embaixo, o que está comprado.</li>
      <li><b>Área de lazer</b> (sinuca e café, na frente) quem está sem posição, inclusive esperando sinal; a cadeira dele fica vazia na mesa. Acima da cabeça, o motivo concreto ("sem sinal · abaixo do teto", "compra recusada · FOMC", "capital novo · compra 19:50") e a hora da próxima rodada, em Brasília.</li>
      <li><b>Em pé no lugar, com ⚠</b> falha, pausa, parado ou sem dado: nunca vai para o lazer. Apagado: parado, sem conexão ou sem telemetria.</li>
      <li><b>Maestro, agentes e apoio</b> seguem a mesma regra: no posto só quem está com tarefa em execução agora (a tarefa do registro aparece acima da cabeça; "atividade não confirmada" em amarelo = 6 h sem sinal); sem tarefa vai para a área de lazer ("sem tarefa · última 01:11" ou "aguardando agenda"); parado há mais de um dia ou sem registro fica no posto, em amarelo. O Guardião do motor de risco fica sempre na cabine: ele confere cada ordem na hora em que ela nasce.</li>
      <li><b>Nomes</b> ficam nos pés de cada um; a descrição aparece ao clicar.</li>
      <li><b>TVs</b> preço diário da moeda ou do fundo; nas mesas MM20, a linha clara é a média de 20 dias.</li>
      <li><b>Telão</b> 10.000 em cada conta: cripto em linha cheia; tracejado, só segurar BTC, SPY (EUA) e BOVA11 (B3).</li>
      <li><b>Cabine de vidro</b> o motor de risco, sem IA. Pisca em vermelho quando um freio dispara.</li>
      <li><b>Clique em alguém</b> abre a ficha: quem é, o que faz agora, saldo e últimas ordens.</li>
      <li><b>Ala de ações</b> à direita: "só segurar SPY" e "só segurar BOVA11" são réguas que não operam; o quadro mostra as fichas e vereditos do laboratório.</li>
      <li><b>Porta</b> conta parada: os robôs saem e só voltam com ordem do Sebastian.</li>
    </ul>
  );
}

// ---------- faixa de prontidão: relógios, fase de cada mercado e o escritório pronto às 9h ----------
const SEGS: [string, string][] = [["b3-acoes", "B3 ações"], ["b3-etf", "B3 ETFs"], ["eua", "EUA"], ["cripto", "Cripto"]];
const AREAS: [Area, string][] = [["tudo", "Tudo"], ["cripto", "Cripto"], ["acoes", "Ações EUA/B3"], ["robos", "Ala dos robôs"], ["lazer", "Área de lazer"], ["apoio", "Apoio e IA"]];

function FaixaProntidao({ pront, agora, periodo, setPeriodo, aoVivo, focar }: {
  pront: Prontidao | null; agora: number; periodo: Periodo; setPeriodo: (p: Periodo) => void; aoVivo: boolean; focar: (a: Area) => void;
}) {
  const esc = escritorioAgora(pront, agora);
  const mercados = pront?.checklist.mercados;
  const idade = pront ? Math.round((agora - Date.parse(pront.em)) / 60000) : null;
  return (
    <section className="faixa-prontidao" aria-label="Prontidão do escritório e fase de cada mercado">
      <div className="fp-relogios">
        <span title="Horário de Brasília"><b>{relogio(agora, "America/Sao_Paulo")}</b> Brasília</span>
        <span title="Horário de Nova York (muda sozinho com o horário de verão de lá)"><b>{relogio(agora, "America/New_York")}</b> Nova York</span>
      </div>
      <span className={"fp-chip tom-" + esc.tom} title="Agenda do escritório: preparação das 8h30 às 8h55 e pronto às 9h de Brasília. 9h não é a abertura da B3: cada segmento negocia no seu horário.">
        <i aria-hidden="true" />Escritório: {esc.texto}
      </span>
      {SEGS.map(([k, nome]) => {
        const f = faseAgora(k, pront?.sessoes[k], agora);
        const m = mercados?.[k.startsWith("b3") ? "b3" : k];
        const bloq = m && m.bloqueios ? ` · ${m.bloqueios} impedimento${m.bloqueios > 1 ? "s" : ""}` : "";
        return (
          <span key={k} className={"fp-chip tom-" + (m && m.bloqueios ? "ruim" : f.tom)} title={(pront?.sessoes[k]?.fonte || "") + (m ? `\nChecklist: ${m.prontos} prontos, ${m.esperando} esperando, ${m.bloqueios} impedimentos.` : "")}>
            <i aria-hidden="true" /><b>{nome}</b> {f.texto}{f.proximo ? " · " + f.proximo : ""}{bloq}
          </span>
        );
      })}
      <span className="fp-direita">
        <span className="fp-seletor" role="group" aria-label="Período do ganho e da perda">
          {(["dia", "acumulado"] as Periodo[]).map(x => (
            <button key={x} type="button" aria-pressed={periodo === x} className={periodo === x ? "ligado" : ""} onClick={() => setPeriodo(x)}
              title={x === "dia" ? "Resultado de hoje (desde a meia-noite de Brasília), sem contar aporte" : "Resultado desde o começo de cada conta, sem contar aporte"}>
              {x === "dia" ? "Dia" : "Acumulado"}
            </button>
          ))}
        </span>
        <span className="fp-foco" role="group" aria-label="Ir para uma área do escritório">
          {AREAS.map(([a, t]) => <button key={a} type="button" onClick={() => focar(a)}>{t}</button>)}
        </span>
        <small className="muted" title="Hora em que a VPS montou o checklist e o relógio. O painel lê de minuto em minuto; a VPS manda de 10 em 10.">
          {aoVivo ? (idade != null ? `checklist da VPS de há ${idade} min` : "sem checklist da VPS") : "ensaio: a faixa mostra o agora"}
        </small>
      </span>
    </section>
  );
}

// Personagem fixo → atividade comprovada. Para os robôs do n8n, a prova é a própria linha que eles gravam.
function atividadesDosPersonagens(ag: Agentes | null, ex: Extras, agora: number): Record<string, Atividade> {
  const extra: Record<string, { em: string | null; texto: string } | null> = {
    "robo:guardiao-dados": ex.guardiao ? { em: ex.guardiao.em, texto: `conferência dos dados (${ex.guardiao.nivel})` } : null,
    "robo:coletor-clima": ex.clima ? { em: ex.clima.em, texto: "medo e ganância coletados" } : null,
    "robo:coletor-mercados": ex.aoVivo ? { em: ex.spy.em, texto: "preços de SPY e BOVA11 coletados" } : null,
  };
  const out: Record<string, Atividade> = {};
  for (const [id, fichas] of Object.entries(PERSONAGEM_FICHA)) {
    const ms = fichas.map(f => ag?.membros.find(m => m.id === f)).filter(Boolean) as Agentes["membros"];
    // Prefere a versão com prova (ex.: Plantonista da VPS) à versão da nuvem, que o exportador não vê.
    ms.sort((a, b) => Number(b.prova_na_vps) - Number(a.prova_na_vps));
    // O registro de tarefas vem primeiro (tarefa em execução, aguardando); sem tarefa nele, vale a prova de atividade.
    const f = fichas.find(x => ag?.tarefas?.por_membro[x]);
    out[id] = atividadeTarefas(f ? ag!.tarefas!.por_membro[f] : undefined) ?? atividade(ms, agora, extra[id]);
  }
  return out;
}
