import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../ui/affectui/button";
import { fmt, pct } from "../dados/formato";
import { TIPOS } from "../dados/detalhe";
import {
  ESTADOS, ESTAGIO_LOTE, CAMPOS, TODOS, filtrar, filtroVazio, opcoes, contarEstados,
  type Entidade, type Estado, type Filtro, type Evento,
} from "../dados/estados";
import { rotuloFinanceiro, comSinal, dinheiro as dinheiroMoeda, horaCurta, type Prontidao, type Periodo } from "../dados/escritorio";

// Todos os robôs, réguas e carteiras ao vivo, com filtros e a ficha completa de cada um. Só olha.
const ROTULO_CAMPO: Record<typeof CAMPOS[number], string> = {
  mercado: "Mercado", estrategia: "Estratégia", horizonte: "Horizonte", estagio: "Estágio", estado: "Situação",
};
const CHAVE = "robos:filtro";

function lerFiltro(): Filtro {
  try { return { ...filtroVazio(), ...JSON.parse(localStorage.getItem(CHAVE) || "{}") }; } catch { return filtroVazio(); }
}

export function Robos({ lista, aoVivo, avisoLote, pront, periodo = "dia" }: { lista: Entidade[]; aoVivo: boolean; avisoLote?: string | null; pront?: Prontidao | null; periodo?: Periodo }) {
  const [f, setF] = useState<Filtro>(lerFiltro);
  const [aberto, setAberto] = useState<string | null>(null);
  useEffect(() => { try { localStorage.setItem(CHAVE, JSON.stringify(f)); } catch { /* sem memória do navegador, tudo bem */ } }, [f]);
  const vistos = useMemo(() => filtrar(lista, f), [lista, f]);
  const contagem = useMemo(() => contarEstados(lista), [lista]);
  const sel = lista.find(x => x.id === aberto) || null;
  const filtrando = CAMPOS.some(c => f[c] !== TODOS);

  return (
    <div className={"robos" + (sel ? " com-detalhe" : "")}>
      <section className="robos-lista" aria-label="Robôs, réguas e carteiras">
        <div className="resumo-estados" role="group" aria-label="Quantos em cada situação">
          {(Object.keys(ESTADOS) as Estado[]).filter(k => contagem[k]).map(k => (
            <button key={k} type="button" className={"chip-estado tom-" + ESTADOS[k].tom + (f.estado === k ? " ligado" : "")}
              aria-pressed={f.estado === k} title={ESTADOS[k].explica}
              onClick={() => setF(x => ({ ...x, estado: x.estado === k ? TODOS : k }))}>
              <i aria-hidden="true" />{ESTADOS[k].rotulo} <b>{contagem[k]}</b>
            </button>
          ))}
        </div>

        <div className="filtros">
          {CAMPOS.map(c => (
            <label key={c}>
              <span>{ROTULO_CAMPO[c]}</span>
              <select value={f[c]} onChange={e => setF(x => ({ ...x, [c]: e.target.value }))}>
                <option value={TODOS}>Todos</option>
                {opcoes(lista, f, c).map(o => (
                  <option key={o.valor} value={o.valor} disabled={!o.n && f[c] !== o.valor}>
                    {(c === "estado" ? ESTADOS[o.valor as Estado]?.rotulo : o.valor) + ` (${o.n})`}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <Button variant="secondary" size="sm" onClick={() => setF(filtroVazio())} disabled={!filtrando}>Limpar filtros</Button>
        </div>

        {!aoVivo && <p className="nota">Esta tela mostra sempre o ao vivo, mesmo quando o Pregão está num ensaio.</p>}
        {avisoLote && vistos.some(x => x.estagio === ESTAGIO_LOTE) && (
          <p className="nota nota-lote">Lote de robôs: {avisoLote} Cada robô tem seu próprio capital e sua moeda; os resultados nunca se somam.</p>
        )}
        <p className="nota">{vistos.length} de {lista.length}. Verde e vermelho mostram só se ganhou ou perdeu até agora; não dizem se a estratégia é boa. Veja a amostra e o estágio.</p>

        <div className="robos-grade">
          {vistos.map(x => <Cartao key={x.id} x={x} periodo={periodo} ativo={x.id === aberto} abrir={() => setAberto(a => a === x.id ? null : x.id)} />)}
          {!vistos.length && <p className="nota">Nenhum com esses filtros.</p>}
        </div>

        <Inventario pront={pront || null} lista={lista} />

        <details className="glossario">
          <summary>O que cada situação quer dizer</summary>
          <dl>
            {(Object.keys(ESTADOS) as Estado[]).map(k => (
              <div key={k}><dt><span className={"pilula-estado tom-" + ESTADOS[k].tom}>{ESTADOS[k].rotulo}</span></dt><dd>{ESTADOS[k].explica}</dd></div>
            ))}
          </dl>
        </details>
      </section>

      {sel && <DetalheEntidade x={sel} fechar={() => setAberto(null)} />}
    </div>
  );
}

function Pilula({ e }: { e: Estado }) {
  return <span className={"pilula-estado tom-" + ESTADOS[e].tom} title={ESTADOS[e].explica}>{ESTADOS[e].rotulo}</span>;
}

const dinheiro = (v: number, moeda: string) => (moeda === "BRL" ? "R$ " + fmt(v, 2) : fmt(v) + " " + moeda);
const tomRes = (r: number | null) => r == null ? "" : r > 0 ? "up" : r < 0 ? "dn" : "";

function Cartao({ x, ativo, abrir, periodo }: { x: Entidade; ativo: boolean; abrir: () => void; periodo: Periodo }) {
  const fin = rotuloFinanceiro(x.res, periodo);
  return (
    <button type="button" className={"robo-cartao" + (ativo ? " aberto" : "")} onClick={abrir} aria-expanded={ativo}>
      <header>
        <span className="robo-nome">{x.nome}</span>
        <Pilula e={x.estado} />
      </header>
      {fin && <p className={"robo-fin fin-" + fin.tom} title={fin.nota}>{fin.txt}</p>}
      {x.dim && <p className="muted pequeno">{x.dim.atividade} · {x.dim.posicao}</p>}
      <p className="robo-tags">{x.mercado} · {x.estrategia} · {x.horizonte} · {x.estagio}</p>
      <p className="robo-numero">
        {x.patrimonio != null ? <>{dinheiro(x.patrimonio, x.moeda)} <small className={tomRes(x.resultado)}>{x.resultado != null ? pct(x.resultado) : ""}</small></> : <small className="muted">{x.semTelemetria ? "sem telemetria" : "sem número ainda"}</small>}
      </p>
      {x.valorNota && <p className="muted pequeno">{x.valorNota}</p>}
      <p className="robo-motivo">{x.motivo}</p>
      {x.decisao && <p className="robo-decisao"><b>{TIPOS[x.decisao.tipo!].rotulo}</b> {x.decisao.txt.replace(/^não operou: /, "")}</p>}
      {x.espera && <p className="robo-decisao"><b>fora da mesa</b> {x.espera.curto}{x.espera.proxima ? ` · próxima rodada ${horaCurta(x.espera.proxima, Date.now())}` : ""}</p>}
      {x.regua && x.resultado != null && x.regua.resultado != null && (
        <p className="robo-regua">régua ({x.regua.nome}): <span className={tomRes(x.regua.resultado)}>{pct(x.regua.resultado)}</span>{" "}
          <small className="muted">· {Math.abs(x.resultado - x.regua.resultado) < 0.0005 ? "igual à régua" : `${x.resultado > x.regua.resultado ? "acima" : "abaixo"} da régua por ${pct(Math.abs(x.resultado - x.regua.resultado)).replace(/^[+−-]/, "")}`}</small></p>
      )}
      {(x.alerta || x.carteira?.fecha === false) && <p className="robo-alerta">{x.alerta || "O caixa não fecha com o diário. Veja o detalhe."}</p>}
      {x.veredito && <p className="robo-veredito" title={x.veredito}>{x.veredito}</p>}
      <p className="robo-rodape"><span>{x.amostra}</span>{x.ultima && <span>{x.ultima}</span>}</p>
    </button>
  );
}

export function DetalheEntidade({ x, fechar }: { x: Entidade; fechar: () => void }) {
  const caixa = useRef<HTMLElement>(null);
  // Cada detalhe abre do começo, com o foco no botão de fechar (no celular ele cobre a tela).
  useEffect(() => { caixa.current?.scrollTo({ top: 0 }); caixa.current?.querySelector<HTMLButtonElement>(".ficha-fechar")?.focus({ preventScroll: true }); }, [x.id]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); };
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, [fechar]);
  const fatos: [string, string, string?][] = [
    ["Estratégia e versão", `${x.estrategia} · ${x.versao}`],
    ["Mercado e horizonte", `${x.mercado} · ${x.horizonte}`],
    ["Estágio", x.estagio],
    ["Capital inicial", dinheiro(x.capital, x.moeda)],
    ["Valor agora", (x.patrimonio != null ? dinheiro(x.patrimonio, x.moeda) : "—") + (x.valorNota ? ` (${x.valorNota})` : "")],
    ["Resultado", x.resultado != null ? pct(x.resultado) : "—", tomRes(x.resultado)],
    ...(x.sombra != null ? [["Regra pura (sem freios)", pct(x.sombra) + (x.sombraHoje ? ` · ${x.sombraHoje.replace(/^regra pura hoje \(sem o motor de risco\): /, "hoje: ")}` : "")] as [string, string]] : []),
    ...(x.regua ? [[`Régua: ${x.regua.nome}`, (x.regua.valor != null ? dinheiro(x.regua.valor, x.moeda) + " · " : "") + (x.regua.resultado != null ? pct(x.regua.resultado) : "—"), tomRes(x.regua.resultado)] as [string, string, string]] : []),
    ["Maior queda observada", x.quedaMax != null ? pct(x.quedaMax) : "—"],
    ["Custos pagos", x.custos != null ? dinheiro(x.custos, x.moeda === "BRL" ? "BRL" : x.moeda) : "não informado pela simulação"],
    ["Posições", x.posicoes.length ? x.posicoes.join(", ") : "nenhuma (em caixa)"],
    ["Amostra", x.amostra],
    ["Última atividade", x.ultima || "—"],
    ["Próxima ação", x.proxima || "—"],
  ];
  return (
    <aside ref={caixa} className="detalhe" aria-label={"Detalhe de " + x.nome}>
      <button type="button" className="ficha-fechar" onClick={fechar} aria-label="Fechar o detalhe">×</button>
      <header className="detalhe-cabeca">
        <span className="ficha-tipo">{x.tipo === "carteira" ? "carteira de referência" : x.tipo === "regua" ? "régua: não opera" : "robô sem IA · regra fixa"}</span>
        <h2>{x.nome}</h2>
      </header>
      <div className={"detalhe-estado tom-" + ESTADOS[x.estado].tom}>
        <Pilula e={x.estado} />
        <p>{x.motivo}</p>
        <p className="muted pequeno">{ESTADOS[x.estado].explica}</p>
      </div>
      {x.alerta && <p className="detalhe-alerta">{x.alerta}</p>}
      {x.dim && (
        <>
          <h3>Cinco dimensões, separadas</h3>
          <dl className="detalhe-fatos">
            <div><dt>Mercado</dt><dd>{x.dim.mercado}</dd></div>
            <div><dt>Saúde operacional</dt><dd className={x.dim.tomSaude === "ok" ? "ok" : x.dim.tomSaude === "ruim" ? "ruim" : ""}>{x.dim.saude}</dd></div>
            <div><dt>Atividade</dt><dd>{x.dim.atividade}</dd></div>
            <div><dt>Posição</dt><dd>{x.dim.posicao}</dd></div>
            <div><dt>Estágio de validação</dt><dd>{x.dim.estagio}</dd></div>
            {x.dim.modo && <div><dt>Como roda</dt><dd>{x.dim.modo}</dd></div>}
          </dl>
          <p className="muted pequeno">A cor do dinheiro não é a cor da saúde: um robô pode estar saudável e perdendo, ou com lucro antigo e desconectado.</p>
        </>
      )}
      {x.res && <Resultado x={x} />}
      <dl className="detalhe-fatos">
        {fatos.map(([k, v, cls]) => <div key={k}><dt>{k}</dt><dd className={cls}>{v}</dd></div>)}
      </dl>
      {x.decisao && (
        <div className={"detalhe-decisao tipo-" + x.decisao.tipo}>
          <span className="tipo-evento">{TIPOS[x.decisao.tipo!].rotulo}</span>
          <p>{semRotulo(x.decisao.txt)}</p>
          <p className="muted pequeno">Última decisão do robô, {quando(x.decisao)}.</p>
        </div>
      )}
      {x.espera && (
        <div className="detalhe-decisao tipo-nao">
          <span className="tipo-evento">fora da mesa</span>
          <p>{x.espera.txt}</p>
          <p className="muted pequeno">
            {x.espera.evento ? x.espera.evento + ". " : ""}
            {x.espera.proxima ? `Próxima rodada que decide: ${horaCurta(x.espera.proxima, Date.now())} (Brasília).` : "Sem rodada prevista enquanto o bloqueio durar."}
            {" "}Sem posição, o robô fica na área de lazer do escritório; volta para a mesa quando comprar.
          </p>
        </div>
      )}
      {x.carteira && <Dinheiro x={x} />}
      <h3>Regra aplicada</h3>
      <p>{x.regra}</p>
      <h3>Dados usados</h3>
      <p>{x.dados}</p>
      <h3>Parecer do laboratório</h3>
      <p>{x.parecer || "Nenhum parecer: régua ou carteira de referência não passam pelo laboratório."}</p>
      <h3>Custo de computação</h3>
      <p>{x.custoIA}</p>
      <h3>Linha do tempo</h3>
      <LinhaDoTempo linha={x.linha} />
    </aside>
  );
}

// O selo já diz "não operou"; o texto não precisa repetir.
const semRotulo = (t: string) => t.replace(/^não operou: /, "").replace(/^./, c => c.toUpperCase());

// Data e hora curtas (dd/mm hh:mm no fuso do computador); dia sem hora fica só dd/mm.
function dataCurta(d: string) {
  if (d.length <= 10) return d.slice(8, 10) + "/" + d.slice(5, 7);
  if (/^\d{4}-\d\d-\d\d \d\d:\d\d$/.test(d)) return d.slice(8, 10) + "/" + d.slice(5, 7) + " " + d.slice(11);
  const t = new Date(d);
  return isNaN(+t) ? d : t.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", "");
}
const quando = (ev: Evento) => ev.vezes && ev.desde ? `${ev.vezes} vezes seguidas, de ${dataCurta(ev.desde)} a ${dataCurta(ev.d)}` : dataCurta(ev.d);

function Dinheiro({ x }: { x: Entidade }) {
  const c = x.carteira!;
  const moeda = c.moeda || x.moeda;
  const v = (n: number | null | undefined) => n == null ? "—" : dinheiro(n, moeda);
  return (
    <>
      <h3>Dinheiro</h3>
      <dl className="detalhe-fatos">
        <div><dt>Caixa disponível</dt><dd>{v(c.caixa)}{c.caixaLocal ? <small className="muted"> (inclui sobra de {fmt(c.caixaLocal, 2)} na moeda do ativo)</small> : null}</dd></div>
        <div><dt>Reservado</dt><dd>{v(c.reservado)}</dd></div>
        <div><dt>Exposição (no ativo)</dt><dd>{v(c.exposicao)}</dd></div>
        {c.pendente && <div><dt>Decisão pendente</dt><dd>{c.pendente}</dd></div>}
        <div><dt>Conciliação</dt><dd className={c.fecha === true ? "ok" : c.fecha === false ? "ruim" : "muted"}>{c.nota}</dd></div>
      </dl>
      <p className="muted pequeno">
        {c.real
          ? <>Números do estado da simulação na VPS{c.aPrecoDe ? `; exposição ao preço de ${dataCurta(c.aPrecoDe)}` : ""}. Reservado é dinheiro separado para uma ordem que outro robô vai fazer na mesma carteira: hoje cada robô tem a sua, então fica zero. A conciliação refaz o caixa pelo diário (capital, cada ordem e seu custo) e compara com o estado.</>
          : <>A VPS ainda não manda o detalhe: o caixa é calculado como valor da carteira menos o que está no ativo, ao preço e câmbio do dia.</>}
      </p>
    </>
  );
}

const FILTROS_LINHA: { k: string; rotulo: string; ok: (e: Evento) => boolean }[] = [
  { k: "tudo", rotulo: "Tudo", ok: () => true },
  { k: "op", rotulo: "Operou", ok: e => e.tipo === "op" || e.tipo === "vai" || (!e.tipo && e.tom !== "ruim") },
  { k: "nao", rotulo: "Não operou", ok: e => e.tipo === "nao" },
  { k: "freio", rotulo: "Recusas e freios", ok: e => e.tipo === "rec" || e.tipo === "freio" || (!e.tipo && e.tom === "ruim") },
];

function LinhaDoTempo({ linha }: { linha: Evento[] }) {
  const [f, setF] = useState("tudo");
  const temTipos = linha.some(e => e.tipo);
  const vistos = linha.filter(FILTROS_LINHA.find(x => x.k === f)!.ok);
  if (!linha.length) return <p className="muted">Nada registrado ainda.</p>;
  return (
    <>
      {temTipos && (
        <div className="linha-filtro" role="group" aria-label="Filtrar a linha do tempo">
          {FILTROS_LINHA.map(x => (
            <button key={x.k} type="button" className={"chip-linha" + (f === x.k ? " ligado" : "")} aria-pressed={f === x.k} onClick={() => setF(x.k)}>
              {x.rotulo} <b>{linha.filter(x.ok).length}</b>
            </button>
          ))}
        </div>
      )}
      <ul className="ficha-lista linha-tempo">
        {vistos.map((ev, n) => (
          <li key={n} className={ev.tipo ? "tipo-" + ev.tipo : ""}>
            <time title={ev.d}>{dataCurta(ev.d)}</time>
            <span>
              {ev.tipo && <span className="tipo-evento" title={TIPOS[ev.tipo].explica}>{TIPOS[ev.tipo].rotulo}</span>}
              <span className={ev.tom === "bom" ? "up" : ev.tom === "ruim" ? "dn" : ""}>{ev.txt}</span>
              {ev.vezes && ev.desde ? <small className="muted"> · {ev.vezes} vezes desde {dataCurta(ev.desde)}</small> : null}
            </span>
          </li>
        ))}
        {!vistos.length && <li className="muted">Nada desse tipo nos registros recentes.</li>}
      </ul>
    </>
  );
}

// Ganho e perda na moeda da conta: do dia (meia-noite de Brasília) e acumulado, com o aporte separado.
function Resultado({ x }: { x: Entidade }) {
  const r = x.res!;
  const v = (n: number | null) => n == null ? "—" : comSinal(n, r.moeda);
  const cls = (n: number | null) => n == null ? "muted" : n > 0 ? "up" : n < 0 ? "dn" : "";
  return (
    <>
      <h3>Ganho e perda ({r.moeda})</h3>
      <dl className="detalhe-fatos">
        <div><dt>Hoje (desde 0h de Brasília)</dt><dd className={cls(r.dia)}>{v(r.dia)}</dd></div>
        <div><dt>Acumulado</dt><dd className={cls(r.acumulado)}>{v(r.acumulado)}</dd></div>
        <div><dt>Capital (com aportes)</dt><dd>{r.capital != null ? dinheiroMoeda(r.capital, r.moeda) : "—"}</dd></div>
        {r.aporte_dia ? <div><dt>Aporte hoje</dt><dd>{dinheiroMoeda(r.aporte_dia, r.moeda)} · não é lucro</dd></div> : null}
        <div><dt>Começo do dia</dt><dd>{r.base_dia != null ? dinheiroMoeda(r.base_dia, r.moeda) : "—"} <small className="muted">({r.base_origem || "sem base"})</small></dd></div>
        <div><dt>Realizado × não realizado</dt><dd className="muted">ainda não disponível: a simulação não separa os dois neste relatório</dd></div>
      </dl>
      {r.sem_marcacao && <p className="detalhe-alerta">Sem marcação: {r.sem_marcacao}. O número não é inventado.</p>}
      <p className="muted pequeno">Dia = valor agora − valor no começo do dia − aporte do dia. Acumulado = valor agora − capital. Custos já saíram do caixa e não são descontados de novo. Moedas diferentes nunca se somam.</p>
    </>
  );
}

// Inventário: aprovado (repositório + catálogo) → instalado (VPS) → em dia → no cron → enviado → desenhado.
function Inventario({ pront, lista }: { pront: Prontidao | null; lista: Entidade[] }) {
  if (!pront) return <p className="nota">Inventário: a VPS ainda não manda a linha de prontidão (versão do exportador anterior a 28/10/2026).</p>;
  const naLista = new Set(lista.filter(x => !x.semTelemetria).map(x => x.id));
  const sim = (b: boolean | null) => b == null ? "—" : b ? "sim" : "não";
  const ops = pront.inventario.operadores;
  const pend = ops.filter(o => o.situacao !== "ok").length;
  return (
    <details className="glossario inventario" open={pend > 0}>
      <summary>Inventário: {ops.length} operadores aprovados ou instalados · {pend} com pendência</summary>
      <p className="muted pequeno">Fonte do "aprovado": {pront.inventario.fonte_aprovado}. Um aprovado que não foi achado continua aqui; a lista nunca encolhe para caber no que chegou.</p>
      <div className="inv-tabela" role="table">
        <div role="row" className="inv-cab"><span>Id</span><span>Aprovado</span><span>Instalado</span><span>Em dia</span><span>No cron</span><span>Enviado</span><span>Na tela</span><span>Situação</span></div>
        {ops.map(o => (
          <div role="row" key={o.id} className={o.situacao === "ok" ? "" : "inv-pend"} title={o.modo}>
            <span>{o.id}</span><span>{sim(o.aprovado)}</span><span>{sim(o.instalado)}</span><span>{sim(o.processo_em_dia)}</span>
            <span>{sim(o.no_cron)}</span><span>{sim(o.enviado)}</span><span>{naLista.has(o.id) ? "sim" : "não"}</span><span>{o.situacao}</span>
          </div>
        ))}
      </div>
    </details>
  );
}
