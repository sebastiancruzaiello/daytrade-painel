import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../ui/affectui/button";
import { fmt, pct } from "../dados/formato";
import { TIPOS } from "../dados/detalhe";
import {
  ESTADOS, ESTAGIO_LOTE, CAMPOS, TODOS, filtrar, filtroVazio, opcoes, contarEstados,
  type Entidade, type Estado, type Filtro, type Evento,
} from "../dados/estados";

// Todos os robôs, réguas e carteiras ao vivo, com filtros e a ficha completa de cada um. Só olha.
const ROTULO_CAMPO: Record<typeof CAMPOS[number], string> = {
  mercado: "Mercado", estrategia: "Estratégia", horizonte: "Horizonte", estagio: "Estágio", estado: "Situação",
};
const CHAVE = "robos:filtro";

function lerFiltro(): Filtro {
  try { return { ...filtroVazio(), ...JSON.parse(localStorage.getItem(CHAVE) || "{}") }; } catch { return filtroVazio(); }
}

export function Robos({ lista, aoVivo, avisoLote }: { lista: Entidade[]; aoVivo: boolean; avisoLote?: string | null }) {
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
          {vistos.map(x => <Cartao key={x.id} x={x} ativo={x.id === aberto} abrir={() => setAberto(a => a === x.id ? null : x.id)} />)}
          {!vistos.length && <p className="nota">Nenhum com esses filtros.</p>}
        </div>

        <details className="glossario">
          <summary>O que cada situação quer dizer</summary>
          <dl>
            {(Object.keys(ESTADOS) as Estado[]).map(k => (
              <div key={k}><dt><span className={"pilula-estado tom-" + ESTADOS[k].tom}>{ESTADOS[k].rotulo}</span></dt><dd>{ESTADOS[k].explica}</dd></div>
            ))}
          </dl>
        </details>
      </section>

      {sel && <Detalhe x={sel} fechar={() => setAberto(null)} />}
    </div>
  );
}

function Pilula({ e }: { e: Estado }) {
  return <span className={"pilula-estado tom-" + ESTADOS[e].tom} title={ESTADOS[e].explica}>{ESTADOS[e].rotulo}</span>;
}

const dinheiro = (v: number, moeda: string) => (moeda === "BRL" ? "R$ " + fmt(v, 2) : fmt(v) + " " + moeda);
const tomRes = (r: number | null) => r == null ? "" : r > 0 ? "up" : r < 0 ? "dn" : "";

function Cartao({ x, ativo, abrir }: { x: Entidade; ativo: boolean; abrir: () => void }) {
  return (
    <button type="button" className={"robo-cartao" + (ativo ? " aberto" : "")} onClick={abrir} aria-expanded={ativo}>
      <header>
        <span className="robo-nome">{x.nome}</span>
        <Pilula e={x.estado} />
      </header>
      <p className="robo-tags">{x.mercado} · {x.estrategia} · {x.horizonte} · {x.estagio}</p>
      <p className="robo-numero">
        {x.patrimonio != null ? <>{dinheiro(x.patrimonio, x.moeda)} <small className={tomRes(x.resultado)}>{x.resultado != null ? pct(x.resultado) : ""}</small></> : <small className="muted">sem número ainda</small>}
      </p>
      <p className="robo-motivo">{x.motivo}</p>
      {x.decisao && <p className="robo-decisao"><b>{TIPOS[x.decisao.tipo!].rotulo}</b> {x.decisao.txt.replace(/^não operou: /, "")}</p>}
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

function Detalhe({ x, fechar }: { x: Entidade; fechar: () => void }) {
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
    ["Valor agora", x.patrimonio != null ? dinheiro(x.patrimonio, x.moeda) : "—"],
    ["Resultado", x.resultado != null ? pct(x.resultado) : "—", tomRes(x.resultado)],
    ...(x.sombra != null ? [["Regra pura (sem freios)", pct(x.sombra)] as [string, string]] : []),
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
