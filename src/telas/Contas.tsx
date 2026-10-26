import { useState } from "react";
import { ChangeSummary, type MetricChange } from "../ui/affectui/change-summary";
import { KS, NOME, COR, REF, fmt, pct, dBR, resumoConta, type Dia } from "../dados/formato";
import type { Base } from "../App";
import { IconeConta } from "./icones";

export function Contas({ dias, di, pararTeste, base }: { dias: Dia[]; di: number; pararTeste: boolean; base: Base }) {
  return (
    <div className="contas">
      <Curva dias={dias} di={di} />
      <div className="contas-grade">
        {KS.map((k, ki) => {
          const r = resumoConta(dias, di, ki, pararTeste);
          const ganhou = r.eq - r.ref;
          const changes: MetricChange[] = [
            { label: "Patrimônio", change: `${fmt(r.eq)} USDT (${pct(r.ret)} desde ${dBR(dias[0].d).slice(0, 5)})`, tone: r.ret >= 0 ? "good" : "bad" },
            { label: `Contra ${REF[ki]}`, change: `${ganhou >= 0 ? "ganha por" : "perde por"} ${fmt(Math.abs(ganhou))}`, tone: ganhou >= 0 ? "good" : "bad" },
            { label: "Queda desde o pico", change: pct(r.queda), tone: r.queda < -0.15 ? "bad" : "neutral", direction: "down" },
            { label: "Posição", change: r.pos.length ? r.pos.join(", ") : "em caixa", tone: "neutral" },
            { label: "Situação", change: r.st, tone: r.st === "ativa" ? "good" : r.st === "parada" ? "bad" : "neutral", direction: r.st === "ativa" ? "up" : "down" },
          ];
          return (
            <div key={k} style={{ ["--cor" as string]: COR[k] }} className="conta-bloco">
              <ChangeSummary title={NOME[k]} period={(base === "aovivo" ? "ao vivo · " : "ensaio · ") + dBR(dias[di].d)} icon={<span className="conta-icone"><IconeConta /></span>} changes={changes} />
            </div>
          );
        })}
      </div>
      <p className="nota">Cada conta começa com 10.000 USDT de mentira. A comparação é com quem só comprasse e segurasse no mesmo período.</p>
    </div>
  );
}

// Curva das três contas e de "só segurar BTC" até o dia mostrado, com dica ao passar o mouse.
function Curva({ dias, di }: { dias: Dia[]; di: number }) {
  const [mira, setMira] = useState<number | null>(null);
  const W = 1000, H = 260, pad = { l: 56, r: 16, t: 16, b: 28 };
  const sl = dias.slice(0, di + 1);
  if (sl.length < 2) return <section className="curva vazia">A curva aparece a partir do segundo dia.</section>;
  const hold = sl.map(d => 10000 * d.px[0] / dias[0].px[0]);
  const series = KS.map((_, ki) => sl.map(d => d.eq[ki]));
  const all = [...hold, ...series.flat()], lo = Math.min(...all), hi = Math.max(...all);
  const X = (i: number) => pad.l + i * (W - pad.l - pad.r) / (sl.length - 1);
  const Y = (v: number) => pad.t + (1 - (v - lo) / ((hi - lo) || 1)) * (H - pad.t - pad.b);
  const path = (vs: number[]) => vs.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1)).join("");
  const ticks = [0, 1, 2, 3].map(q => lo + (hi - lo) * q / 3);
  const m = mira == null ? null : Math.min(mira, sl.length - 1);
  return (
    <section className="curva">
      <header>
        <h2>Patrimônio</h2>
        <ul className="curva-leg">
          {KS.map(k => <li key={k}><i style={{ background: COR[k] }} />{NOME[k]}</li>)}
          <li><i className="tracejado" />só segurar BTC</li>
        </ul>
      </header>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Patrimônio das três contas ao longo do tempo"
        onPointerMove={e => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * W; setMira(Math.round((x - pad.l) / (W - pad.l - pad.r) * (sl.length - 1))); }}
        onPointerLeave={() => setMira(null)}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={Y(t)} y2={Y(t)} className="grade" />
            <text x={pad.l - 8} y={Y(t) + 4} textAnchor="end" className="eixo">{fmt(t / 1000, 1)}k</text>
          </g>
        ))}
        <text x={pad.l} y={H - 8} className="eixo">{dBR(sl[0].d)}</text>
        <text x={W - pad.r} y={H - 8} textAnchor="end" className="eixo">{dBR(sl[sl.length - 1].d)}</text>
        <path d={path(hold)} className="linha-hold" />
        {series.map((s, ki) => <path key={ki} d={path(s)} stroke={COR[KS[ki]]} className="linha" />)}
        {m != null && m >= 0 && (
          <g>
            <line x1={X(m)} x2={X(m)} y1={pad.t} y2={H - pad.b} className="mira" />
            {series.map((s, ki) => <circle key={ki} cx={X(m)} cy={Y(s[m])} r={4} fill={COR[KS[ki]]} />)}
          </g>
        )}
      </svg>
      {m != null && m >= 0 && (
        <div className="dica" style={{ left: `${Math.min(80, X(m) / W * 100)}%` }}>
          <b>{dBR(sl[m].d)}</b>
          {KS.map((k, ki) => <span key={k}><i style={{ background: COR[k] }} />{NOME[k]} {fmt(series[ki][m])}</span>)}
          <span><i className="tracejado" />segurar BTC {fmt(hold[m])}</span>
        </div>
      )}
    </section>
  );
}
