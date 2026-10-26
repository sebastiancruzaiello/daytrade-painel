import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../ui/affectui/button";
import { SegmentedControl } from "../ui/affectui/segmented-control";
import { NumberTicker } from "../ui/affectui/number-ticker";
import { NotificationStack, type Notice } from "../ui/affectui/notification-stack";
import { criarCena, type Cena } from "../salao/cena";
import { KS, NOME, COR, REF, fmt, pct, dBR, hora, resumoConta, type Fonte } from "../dados/formato";
import type { Base, InfoVivo } from "../App";
import { IconePlay, IconePausa } from "./icones";
import { Ficha } from "./Ficha";
import { segurar, pregao, type Extras, type Mercado } from "../dados/mercados";

type Props = {
  fonte: Fonte; di: number; setDi: (i: number) => void;
  tocando: boolean; setTocando: (b: boolean) => void; passo: string; setPasso: (s: string) => void;
  base: Base; setBase: (b: Base) => void; temVivo: boolean; pararTeste: boolean;
  info: InfoVivo; vivo: Fonte | null; ex: Extras;
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
  useEffect(() => {
    cena.current?.mostrar({ D: fonte, dias, di, pararTeste, vivo: p.vivo, aoVivo: base === "aovivo", ex: p.ex });
  }, [fonte, dias, di, pararTeste, p.vivo, base, p.ex]);

  const fim = di >= dias.length - 1;
  const letreiro = useMemo(() => {
    const partes = KS.map((k, ki) => ({ k, nome: NOME[k], v: d.eq[ki], r: d.eq[ki] / 10000 - 1 }));
    const emPos = d.pos.reduce((s, x, ki) => s + (ki < 2 ? (x.length ? 1 : 0) : x.length), 0);
    const acoes = ([["SPY", p.ex.spy], ["BOVA11", p.ex.bova]] as const).map(([t, mk]) => ({ t, s: segurar(mk, dias[0].d, d.d) }));
    return { partes, emPos, acoes };
  }, [d, dias, p.ex]);

  return (
    <div className="pregao">
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
                <span><b>{letreiro.emPos} de 5 robôs</b> com posição aberta · </span>
                {d.ev && <span><b>hoje</b> {d.ev}: não abre posição · </span>}
              </span>
            ))}
          </div>
        </div>
      </section>
        <aside className="avisos" hidden={!lateral}>
          {selecionado
            ? <Ficha id={selecionado} fonte={fonte} di={di} pararTeste={pararTeste} aoVivo={base === "aovivo"} ex={p.ex} fechar={fecharFicha} />
            : <>
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

function Legenda() {
  return (
    <ul className="legenda">
      <li><b>Sentado na mesa</b> robô com posição aberta. No café ou na sinuca, está em caixa.</li>
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
