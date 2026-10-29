import { useEffect, useState } from "react";
import { SegmentedControl } from "../ui/affectui/segmented-control";
import dados from "../dados/replay.json";
import { CAPITAIS, CUSTOS, faixa, quadro, minimo, mesAno, type Replay, type Controle } from "../dados/replay";
import { dinheiro, porcento } from "../dados/escritorio";

// Testes no passado (§8.6): a "máquina do tempo" do laboratório. Os números são os do replay lacrado (REPLAY-v1,
// PR lab#102), copiados sem refazer conta; o Sebastian escolhe regra, capital e custo e lê o quadro em português.
const R = dados as unknown as Replay;
const CHAVE = "passado:escolha";
type Escolha = { id: string; capital: number; custo: string };
function lerEscolha(): Escolha {
  try { const e = JSON.parse(localStorage.getItem(CHAVE) || "{}"); if (R.controles.some(c => c.id === e.id)) return { id: e.id, capital: CAPITAIS.includes(e.capital) ? e.capital : 1000, custo: e.custo in CUSTOS ? e.custo : "original" }; } catch { /* sem memória do navegador */ }
  return { id: R.controles[0].id, capital: 1000, custo: "original" };
}

export function Passado() {
  const [e, setE] = useState<Escolha>(lerEscolha);
  useEffect(() => { try { localStorage.setItem(CHAVE, JSON.stringify(e)); } catch { /* tudo bem */ } }, [e]);
  const c = R.controles.find(x => x.id === e.id)!;
  const f = faixa(c, e.capital, e.custo)!;
  const q = quadro(c, f);
  return (
    <div className="passado">
      <p className="faixa-passado" role="note"><b>Teste no passado — não é resultado de hoje.</b> Reprodução de pregões que já aconteceram, com dinheiro de mentira. Serve para entender como cada regra se comportou, não para prever ganho.</p>

      <div className="passado-escolha">
        <SegmentedControl<string> kind="tabs" variant="tray" value={e.id} onChange={id => setE(x => ({ ...x, id }))} aria-label="Regra"
          options={R.controles.map(x => ({ value: x.id, label: x.nome.split(" · ")[0] + " · " + x.ativo }))} />
        <label><span>Capital fictício</span>
          <select value={e.capital} onChange={ev => setE(x => ({ ...x, capital: Number(ev.target.value) }))}>
            {CAPITAIS.map(v => <option key={v} value={v}>{dinheiro(v, c.moeda, 0)}</option>)}
          </select>
        </label>
        <label><span>Custos</span>
          <select value={e.custo} onChange={ev => setE(x => ({ ...x, custo: ev.target.value }))}>
            {Object.entries(CUSTOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </div>

      <article className="passado-quadro">
        <header>
          <h2>{q.titulo}</h2>
          <p className="muted">{q.periodo} {q.tipo}</p>
          <p className="pequeno">{c.explica}</p>
        </header>
        <dl className="passado-numeros">
          <div><dt>Capital fictício</dt><dd>{q.capital}</dd></div>
          <div><dt>Valor final</dt><dd className={"fin-" + q.tom}>{q.final}</dd></div>
          <div><dt>Ganho ou perda</dt><dd className={"fin-" + q.tom}>{q.ganho}</dd></div>
          <div><dt>Maior queda do patrimônio durante o teste</dt><dd>{q.queda}</dd></div>
        </dl>
        <Curva c={c} chave={`${e.capital}-${e.custo}`} />
        <ul className="passado-lista">
          <li><b>Custos:</b> {q.custos}</li>
          <li><b>Comparação:</b> {q.comparacao}</li>
          <li><b>Quantas vezes operou:</b> {q.contagem}</li>
          {q.semCapital && <li><b>Falta de dinheiro:</b> {q.semCapital}</li>}
          <li><b>Conclusão:</b> {q.conclusao}</li>
        </ul>
        <p className="muted pequeno">{q.premissas.join(" ")} {minimo(c, e.custo)}</p>
      </article>

      <details className="glossario">
        <summary>Ver detalhes: todos os capitais e custos desta regra</summary>
        <div className="tabela-rola">
          <table className="tabela">
            <thead><tr><th>Custos</th><th>Capital</th><th>Final</th><th>Ganho</th><th>Maior queda</th><th>Ciclos</th><th>Taxas pagas</th><th>Faltou dinheiro</th><th>Comprar e manter</th></tr></thead>
            <tbody>
              {c.faixas.map(x => (
                <tr key={x.custo + x.capital} className={x.capital === e.capital && x.custo === e.custo ? "linha-sel" : ""}>
                  <td>{x.custo}</td><td>{dinheiro(x.capital, c.moeda, 0)}</td>
                  <td>{x.ciclos === 0 && x.sem_capital.vezes ? "não operou" : dinheiro(x.final, c.moeda)}</td>
                  <td className={x.retorno > 0 ? "up" : x.retorno < 0 ? "dn" : ""}>{porcento(x.retorno)}</td>
                  <td>{porcento(x.pior_queda)}</td><td>{x.ciclos.toLocaleString("pt-BR")}</td>
                  <td>{dinheiro(x.custos_pagos, c.moeda)}</td><td>{x.sem_capital.vezes ? `${x.sem_capital.vezes}×` : "—"}</td>
                  <td>{porcento(x.segurar.retorno)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted pequeno">"Ciclos" = uma compra e a venda dela. Cada ciclo são 2 registros no arquivo de operações ({c.registros_original.toLocaleString("pt-BR")} registros nas condições originais).</p>
      </details>

      <details className="glossario">
        <summary>Detalhes técnicos (para o revisor)</summary>
        <ul className="pequeno tecnico">
          <li>Regra lacrada {c.regra}; veredito em {c.parecer}.</li>
          <li>Conciliação com o motor original: {c.conciliacao.eventos_replay}/{c.conciliacao.eventos_original} eventos iguais ({c.conciliacao.ok ? "confere" : "NÃO confere"}).</li>
          <li>Período {c.periodo.inicio} a {c.periodo.fim} ({c.periodo.dias} dias com patrimônio). Custo por ponta {(f.custo_por_ponta * 100).toFixed(2)}%; quantidade: {f.regra_quantidade}.</li>
          <li>Origem: {R.origem.repositorio}/{R.origem.pasta}, commit do laboratório {R.origem.commit_lab} (rodada {R.origem.commit_da_rodada.slice(0, 7)}), {R.origem.versao}, lacre {R.origem.lacre.slice(0, 16)}…, comando <code>{R.origem.comando}</code>.</li>
          {R.origem.observacoes.map(o => <li key={o}>{o}</li>)}
        </ul>
      </details>
    </div>
  );
}

// Patrimônio no fim de cada dia (amostrado), com a linha do capital inicial. Texto ao lado: começo, fim e datas.
function Curva({ c, chave }: { c: Controle; chave: string }) {
  const s = c.curvas.series[chave];
  if (!s || s.length < 2) return null;
  const W = 640, H = 150, P = 6;
  const min = Math.min(...s, s[0]), max = Math.max(...s, s[0]);
  const y = (v: number) => H - P - ((v - min) / (max - min || 1)) * (H - 2 * P);
  const x = (i: number) => P + (i / (s.length - 1)) * (W - 2 * P);
  const d = s.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const sobe = s[s.length - 1] >= s[0];
  return (
    <figure className="curva">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Patrimônio de ${dinheiro(s[0], c.moeda)} em ${mesAno(c.curvas.datas[0])} a ${dinheiro(s[s.length - 1], c.moeda)} em ${mesAno(c.curvas.datas[s.length - 1])}`}>
        <line x1={P} x2={W - P} y1={y(s[0])} y2={y(s[0])} className="curva-base" />
        <path d={d} className={sobe ? "curva-up" : "curva-dn"} />
      </svg>
      <figcaption className="muted pequeno">Patrimônio dia a dia de {mesAno(c.curvas.datas[0])} a {mesAno(c.curvas.datas[s.length - 1])}. A linha reta é o capital inicial.</figcaption>
    </figure>
  );
}
