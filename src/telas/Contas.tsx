import { useState, type ReactElement } from "react";
import { ChangeSummary, type MetricChange } from "../ui/affectui/change-summary";
import { KS, NOME, COR, REF, fmt, pct, dBR, hora, resumoConta, type Dia } from "../dados/formato";
import type { Base } from "../App";
import { IconeConta } from "./icones";
import { segurar, type Extras } from "../dados/mercados";
import { capitalCarteira, type Entidade } from "../dados/estados";
import { CAPITAL, nomeViz, veredito, type Vizinhas as Viz, type LinhaBolsa } from "../dados/vizinhas";

const ACOES = [["spy", "EUA · Segurar SPY", "#e8a25b", "EUA"], ["bova", "B3 · Segurar BOVA11", "#5fcf8f", "B3"]] as const;

// Quantos robôs de verdade (não réguas nem carteiras) há num mercado agora, pela mesma lista da aba Robôs.
function robosDoMercado(lista: Entidade[], mercado: string) {
  const r = lista.filter(x => x.tipo === "robo" && x.mercado === mercado);
  if (!r.length) return "nenhum na leitura de agora";
  const obs = r.filter(x => /observa/i.test(x.estagio)).length;
  return `${r.length} ${r.length === 1 ? "robô" : "robôs"}` + (obs ? `, ${obs} só observação` : "") + " (aba Robôs)";
}

export function Contas({ dias, di, pararTeste, base, ex, viz, entidades }: { dias: Dia[]; di: number; pararTeste: boolean; base: Base; ex: Extras; viz: Viz; entidades: Entidade[] }) {
  return (
    <div className="contas">
      <Curva dias={dias} di={di} ex={ex} />
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
        {ACOES.map(([q, titulo, cor, mercado]) => {
          const mk = ex[q], s = segurar(mk, dias[0].d, dias[di].d);
          const changes: MetricChange[] = s ? [
            { label: "Só segurar", change: `${fmt(s.valor)} ${mk.moeda} (${pct(s.ret)} desde ${dBR(dias[0].d).slice(0, 5)})`, tone: s.ret >= 0 ? "good" : "bad" },
            { label: "Preço do fundo", change: `${fmt(s.preco, 2)} em ${dBR(s.diaPreco)}`, tone: "neutral" },
            { label: "Em 12 meses", change: s.ret1a != null ? pct(s.ret1a) : "—", tone: s.ret1a == null ? "neutral" : s.ret1a >= 0 ? "good" : "bad" },
            { label: "Robôs neste mercado", change: robosDoMercado(entidades, mercado), tone: "neutral" },
          ] : [{ label: "Só segurar", change: "sem dados neste dia", tone: "neutral" }];
          return (
            <div key={q} style={{ ["--cor" as string]: cor }} className="conta-bloco">
              <ChangeSummary title={titulo} period={"régua · " + dBR(dias[di].d)} icon={<span className="conta-icone"><IconeConta /></span>} changes={changes} />
            </div>
          );
        })}
      </div>
      <Carteiras viz={viz} />
      <Vizinhas viz={viz} entidades={entidades} />
      <p className="nota">Cada conta de cripto começa com 10.000 USDT de mentira e é comparada com quem só comprasse e segurasse. SPY e BOVA11 mostram quanto 10.000 virariam só segurando o fundo, com dividendos: é a régua que os robôs de ações (os da bolsa e os do lote, na aba Robôs) precisam vencer. Cada robô tem o seu dinheiro; os resultados nunca se somam numa conta só.</p>
    </div>
  );
}

// Curva das três contas e de "só segurar BTC" até o dia mostrado, com dica ao passar o mouse.
function Curva({ dias, di, ex }: { dias: Dia[]; di: number; ex: Extras }) {
  const [mira, setMira] = useState<number | null>(null);
  const W = 1000, H = 260, pad = { l: 56, r: 16, t: 16, b: 28 };
  const sl = dias.slice(0, di + 1);
  if (sl.length < 2) return <section className="curva vazia">A curva aparece a partir do segundo dia.</section>;
  const hold = sl.map(d => 10000 * d.px[0] / dias[0].px[0]);
  const series = KS.map((_, ki) => sl.map(d => d.eq[ki]));
  const acoes = ACOES.map(([q]) => sl.map(d => segurar(ex[q], dias[0].d, d.d)?.valor ?? 10000));
  const all = [...hold, ...series.flat(), ...acoes.flat()], lo = Math.min(...all), hi = Math.max(...all);
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
          {ACOES.map(([q, t, cor]) => <li key={q}><i className="tracejado" style={{ ["--tc" as string]: cor }} />{t.split(" · ")[1].replace("Segurar", "segurar")}</li>)}
        </ul>
      </header>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Patrimônio das três contas de cripto e das réguas de ações ao longo do tempo"
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
        {acoes.map((a, i) => <path key={i} d={path(a)} className="linha-hold" style={{ stroke: ACOES[i][2] }} />)}
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
          {ACOES.map(([q, t, cor], i) => <span key={q}><i className="tracejado" style={{ ["--tc" as string]: cor }} />{t.split(" · ")[1].replace("Segurar", "segurar")} {fmt(acoes[i][m])}</span>)}
        </div>
      )}
    </section>
  );
}

const COR_CARTEIRA: Record<string, string> = { brasil: "#5fcf8f", eua: "#e8a25b", cripto: "#f39a3d" };

// Três carteiras de referência: só segurar, com lote, custos e câmbio de verdade. O capital de cada uma vem do dado
// (desde 28/10/2026 a Brasil tem R$ 400 e as outras R$ 100), nunca de um texto fixo.
function Carteiras({ viz }: { viz: Viz }) {
  const c = viz.carteiras;
  if (!c) return null;
  const r = c.relatorio, lista = Object.entries(r.carteiras || {});
  const caps = lista.map(([, w]) => capitalCarteira(r, w));
  const igual = caps.length > 0 && caps.every(x => x === caps[0]);
  const real = (v: number) => "R$ " + fmt(v, 2);
  return (
    <section className="vizinhas">
      <h2>Carteiras de referência · {igual ? `R$ ${fmt(caps[0])} cada` : lista.map(([, w], i) => `${w.nome} R$ ${fmt(caps[i])}`).join(", ")}</h2>
      <p className="nota">
        Dinheiro de mentira. Cada carteira compra o ativo de referência quando o capital dela dá para comprar e nunca vende.
        Os resultados são separados e não se somam. Atualizado {hora(c.relatorio_em)}.
      </p>
      {(r.avisos || []).map(a => <p key={a} className="nota aviso">{a}</p>)}
      <div className="contas-grade">
        {lista.map(([k, w], i) => {
          const insuf = w.situacao === "capital insuficiente";
          const changes: MetricChange[] = [
            { label: "Capital", change: `R$ ${fmt(caps[i])} de mentira`, tone: "neutral" },
            { label: "Valor hoje", change: `${real(w.valor_brl)} (${pct(w.resultado)})`, tone: w.resultado > 0 ? "good" : w.resultado < 0 ? "bad" : "neutral" },
            { label: "Situação", change: w.situacao + (w.motivo ? ` (${w.motivo})` : ""), tone: w.situacao === "investida" ? "good" : insuf ? "bad" : "neutral", direction: w.situacao === "investida" ? "up" : "down" },
          ];
          if (insuf && w.minimo_brl) changes.push({ label: "Mínimo para a 1ª compra", change: real(w.minimo_brl), tone: "neutral" });
          if (w.quantidade) changes.push({ label: "Posição", change: `${w.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 8 })} ${w.ativo} desde ${w.comprou_em ? dBR(w.comprou_em) : "—"}`, tone: "neutral" });
          if (w.preco_atual) changes.push({ label: "Preço do " + w.ativo, change: `${fmt(w.preco_atual, 2)} ${w.moeda}` + (w.dia_do_preco ? ` em ${dBR(w.dia_do_preco).slice(0, 5)}` : ""), tone: "neutral" });
          changes.push({ label: "Premissa", change: w.premissa, tone: "neutral" });
          return (
            <div key={k} style={{ ["--cor" as string]: COR_CARTEIRA[k] || "#9aa" }} className="conta-bloco">
              <ChangeSummary title={`${w.nome} · ${w.ativo}`} period={r.ultimo_dia ? dBR(r.ultimo_dia).slice(0, 5) : "—"} icon={<span className="conta-icone"><IconeConta /></span>} changes={changes} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

const MERCADO = { eua: ["EUA", "#e8a25b"], b3: ["B3", "#5fcf8f"] } as Record<string, [string, string]>;

// Bolsa (EUA e B3) e day trade em cripto, como a VPS mandou. Sempre o dia de hoje: não acompanha a régua do ensaio.
function Vizinhas({ viz, entidades }: { viz: Viz; entidades: Entidade[] }) {
  const { bolsa, intradia } = viz;
  if (!bolsa && !intradia) return (
    <p className="nota">A bolsa (EUA e B3) e o day trade em cripto aparecem aqui assim que a VPS mandar o primeiro resumo deles.</p>
  );
  const blocos: ReactElement[] = [];
  const freio = (s: string | null | undefined, botao: boolean) => botao ? "parada (botão de parar)" : s || "ativa";
  if (bolsa) {
    const merc = bolsa.relatorio.mercados || {};
    Object.entries(merc).forEach(([mk, m]) => {
      const [rotulo, cor] = MERCADO[mk] || [mk.toUpperCase(), "#9aa"];
      const linhas = Object.values(m.linhas || {});
      const sombra = (c: string) => linhas.find(l => l.grupo === "sombras" && l.conta === c);
      const quando = m.ultimo_pregao ? `${m.pregoes} ${m.pregoes === 1 ? "pregão" : "pregões"} · ${dBR(m.ultimo_pregao).slice(0, 5)}` : `começa ${m.proximo_pregao ? dBR(m.proximo_pregao).slice(0, 5) : "—"}`;
      linhas.filter(l => l.grupo !== "sombras").forEach((l: LinhaBolsa) => {
        const ret = l.patrimonio / CAPITAL - 1, sb = sombra(l.conta), ver = veredito(l.veredito_lab);
        const st = l.grupo === "contas" ? freio(l.situacao, bolsa.botao_parar) : "régua (só segurar)";
        const changes: MetricChange[] = [
          { label: "Patrimônio", change: `${fmt(l.patrimonio)} ${m.moeda} (${pct(ret)})`, tone: ret > 0 ? "good" : ret < 0 ? "bad" : "neutral" },
          { label: "Queda desde o pico", change: pct(-Math.abs(l.queda_maxima)), tone: Math.abs(l.queda_maxima) > 0.15 ? "bad" : "neutral", direction: "down" },
          { label: "Operações", change: `${l.operacoes}` + (l.imposto_pago ? ` · IR pago ${fmt(l.imposto_pago, 2)}` : ""), tone: "neutral" },
          { label: "Situação", change: st + (l.motivo ? ` (${l.motivo})` : ""), tone: st === "ativa" || st.startsWith("régua") ? "neutral" : "bad" },
        ];
        if (sb) changes.push({ label: "Regra pura (sem freios)", change: pct(sb.patrimonio / CAPITAL - 1), tone: "neutral" });
        if (ver) changes.push({ label: "Laboratório", change: ver, tone: "bad" });
        blocos.push(
          <div key={"b-" + mk + l.conta + l.grupo} style={{ ["--cor" as string]: cor }} className="conta-bloco">
            <ChangeSummary title={`${rotulo} · ${nomeViz(l.conta)}`} period={quando} icon={<span className="conta-icone"><IconeConta /></span>} changes={changes} />
          </div>);
      });
    });
  }
  if (intradia) {
    const r = intradia.relatorio, ult = (r.boletins || []).slice(-1)[0];
    // A regra pura só fecha o dia à meia-noite UTC; com o dia corrente da VPS (sombra_hoje), mostra o de agora e o
    // que ela fez hoje, em vez de "+0,00%" o dia inteiro.
    const regraPura = (k: string, inicio: number) => {
      const e = entidades.find(x => x.id === "intradia:" + k);
      if (!e || e.sombra == null || !e.sombraHoje) return pct(inicio / CAPITAL - 1);
      return `${pct(e.sombra)} · ${e.sombraHoje.replace(/^regra pura hoje \(sem o motor de risco\): /, "hoje: ")}`;
    };
    Object.entries(r.contas || {}).forEach(([k, c]) => {
      const ret = c.inicio_do_dia / CAPITAL - 1, dia = ult?.contas?.[k];
      const changes: MetricChange[] = [
        { label: "Patrimônio no começo do dia", change: `${fmt(c.inicio_do_dia)} USDT (${pct(ret)})`, tone: ret > 0 ? "good" : ret < 0 ? "bad" : "neutral" },
        { label: "Operações hoje", change: `${c.operacoes_hoje.length}`, tone: "neutral" },
        { label: "Último dia fechado", change: dia?.contas?.resultado_dia != null ? `${pct(dia.contas.resultado_dia)} em ${dBR(ult!.dia)}` : "ainda nenhum", tone: "neutral" },
        { label: "Situação", change: freio(c.situacao, intradia.botao_parar), tone: c.situacao === "ativa" && !intradia.botao_parar ? "neutral" : "bad" },
        { label: "Regra pura (sem freios)", change: regraPura(k, c.sombra_inicio_do_dia), tone: "neutral" },
      ];
      const ver = veredito(c.veredito);
      if (ver) changes.push({ label: "Laboratório", change: ver, tone: "bad" });
      blocos.push(
        <div key={"i-" + k} style={{ ["--cor" as string]: "#b99cf0" }} className="conta-bloco">
          <ChangeSummary title={`Day trade · ${nomeViz(k)}`} period={r.dia ? dBR(r.dia).slice(0, 5) : "hoje"} icon={<span className="conta-icone"><IconeConta /></span>} changes={changes} />
        </div>);
    });
  }
  const avisos = [bolsa, intradia].filter(Boolean).flatMap(v => [
    !v!.diario_integro ? "diário com problema: " + (v!.diario_problema || "") : null,
    v!.relatorio.erro || null,
  ]).filter(Boolean);
  return (
    <section className="vizinhas">
      <h2>Bolsa e day trade (ao vivo)</h2>
      <p className="nota">
        Cada conta começa com 10.000 de mentira. Hoje são regras reprovadas no laboratório, rodando só para observar como se
        comportam ao vivo. Atualizado {hora(bolsa?.relatorio_em || intradia?.relatorio_em)}.
      </p>
      {avisos.map(a => <p key={a!} className="nota aviso">{a}</p>)}
      <div className="contas-grade">{blocos}</div>
    </section>
  );
}
