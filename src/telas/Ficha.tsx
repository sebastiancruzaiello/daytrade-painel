import { ChangeSummary, type MetricChange } from "../ui/affectui/change-summary";
import { Button } from "../ui/affectui/button";
import { KS, NOME, COR, REF, fmt, pct, dBR, resumoConta, type Fonte } from "../dados/formato";

// Ficha de quem foi clicado no salão. Só mostra: nada aqui muda a simulação.
const ESTRATEGIA: Record<string, string> = {
  "mm20-btc": "Compra bitcoin quando o preço do dia fecha acima da média dos últimos 20 dias e vende quando fecha abaixo. Decide uma vez por dia.",
  "mm20-eth": "Compra ethereum quando o preço do dia fecha acima da média dos últimos 20 dias e vende quando fecha abaixo. Decide uma vez por dia.",
  "momentum": "Toda semana escolhe as 3 moedas, entre 7, que mais subiram nos últimos 21 dias e divide o dinheiro entre elas. Cada um dos três robôs desta mesa cuida de uma das moedas.",
};
const LIMITES = "Se a conta perder mais de 15% num dia, ela pausa. Se cair 35% desde o melhor momento, ela para de vez e só volta com ordem sua.";
const TIPO: Record<string, string> = { pausar: "pausou", parar: "parou", retomar: "voltou", alerta: "aviso" };

// O que os agentes de IA fazem. O programa não lê os arquivos deles, então isto é escrito à mão (atualizado em 26/10/2026).
const AGENTES: Record<string, { nome: string; cor: string; funcao: string; nao: string; agenda: string; ultimo: string; link?: { rotulo: string; url: string } }> = {
  "agente:plantonista": {
    nome: "Plantonista", cor: "#7fb8ff",
    funcao: "Lê a simulação todo dia e escreve um boletim em português simples, com um termo de trading explicado por dia.",
    nao: "Não pode parar nem retomar contas, e não fala em comprar ou vender.",
    agenda: "Todo dia, às 22h17 (Brasília).",
    ultimo: "Começou em 26/10/2026. Fica em ensaio por uma semana e vira oficial depois de 7 boletins certos seguidos.",
    link: { rotulo: "Abrir o boletim", url: "https://claude.ai/artifact/MAJwaiT23wdFFc2Z9u9zdT" },
  },
  "agente:pesquisador": {
    nome: "Pesquisador", cor: "#8fa9b3",
    funcao: "Procura estratégias publicadas em estudos e escreve até 4 fichas por mês para o laboratório testar.",
    nao: "Não roda código de outras pessoas e não vê os nossos resultados, para não escolher pelo que já sabe.",
    agenda: "Toda segunda-feira, às 9h41 (Brasília).",
    ultimo: "26/10/2026: 2 fichas. Virada do mês (nota 2 de 5) e meia hora final do bitcoin (nota 1 de 5: a taxa come o ganho).",
  },
};

type Props = { id: string; fonte: Fonte; di: number; pararTeste: boolean; aoVivo: boolean; fechar: () => void };

export function Ficha({ id, fonte, di, pararTeste, aoVivo, fechar }: Props) {
  return (
    <section className="ficha" aria-label="Ficha">
      <button type="button" className="ficha-fechar" onClick={fechar} aria-label="Fechar a ficha">×</button>
      {id.startsWith("robo:") ? <FichaRobo id={id} fonte={fonte} di={di} pararTeste={pararTeste} />
        : id === "staff:escrivao" ? <FichaEscrivao fonte={fonte} di={di} aoVivo={aoVivo} />
        : id === "staff:guardiao" ? <FichaGuardiao fonte={fonte} di={di} />
        : AGENTES[id] ? <FichaAgente a={AGENTES[id]} />
        : <p className="muted">Não achei quem é esta pessoa.</p>}
    </section>
  );
}

function Cabeca({ nome, tipo, cor }: { nome: string; tipo: string; cor: string }) {
  return (
    <header className="ficha-cabeca">
      <span className="ficha-avatar" style={{ background: cor }} aria-hidden="true" />
      <div><h2>{nome}</h2><span className="ficha-tipo">{tipo}</span></div>
    </header>
  );
}

function FichaRobo({ id, fonte, di, pararTeste }: { id: string; fonte: Fonte; di: number; pararTeste: boolean }) {
  const [, conta, cadeira] = id.split(":");
  const ki = KS.indexOf(conta as typeof KS[number]);
  const dias = fonte.dias, d = dias[di];
  const r = resumoConta(dias, di, ki, pararTeste);
  const i = Number(cadeira);
  const moeda = conta === "momentum" ? d.pos[2][i] : conta === "mm20-btc" ? "BTC" : "ETH";
  const sentado = r.st === "ativa" && (conta === "momentum" ? !!d.pos[2][i] : r.pos.length > 0);
  const agora = r.st === "parada" ? "Parado: saiu pela porta e só volta com ordem sua."
    : r.st === "pausada" ? "Em pausa hoje por causa de um freio."
    : sentado ? `Sentado na mesa, com ${moeda} comprado.`
    : "No café: está em caixa, esperando o sinal para comprar.";
  const freios: { d: string; t: string }[] = [];
  const ordens: { d: string; t: string; lado: string }[] = [];
  for (let j = di; j >= 0; j--) {
    dias[j].x.forEach(e => { if (e[0] === conta || e[0] === "todas") freios.push({ d: dias[j].d, t: `${TIPO[e[1]] || e[1]}: ${e[2]}` }); });
    dias[j].o.forEach(o => { if (o[0] === conta && ordens.length < 6) ordens.push({ d: dias[j].d, lado: o[2], t: `${o[2]} ${o[1]} · ${fmt(o[3])} USDT${o[4] === "motor_de_risco" ? " (motor de risco)" : ""}` }); });
  }
  const numeros: MetricChange[] = [
    { label: "Saldo da conta", change: `${fmt(r.eq)} USDT (${pct(r.ret)})`, tone: r.ret >= 0 ? "good" : "bad" },
    { label: `Contra ${REF[ki]}`, change: `${r.eq >= r.ref ? "ganha por" : "perde por"} ${fmt(Math.abs(r.eq - r.ref))}`, tone: r.eq >= r.ref ? "good" : "bad" },
    { label: "Queda desde o pico", change: pct(r.queda), tone: r.queda < -0.15 ? "bad" : "neutral", direction: "down" },
    { label: "Posição da conta", change: r.pos.length ? r.pos.join(", ") : "em caixa", tone: "neutral" },
  ];
  const nome = conta === "momentum" ? `Robô Momentum · cadeira ${i + 1}` : `Robô ${NOME[conta]}`;
  return (
    <>
      <Cabeca nome={nome} tipo="robô sem IA · segue uma regra fixa" cor={COR[conta]} />
      <p className="ficha-agora"><b>Agora ({dBR(d.d)}):</b> {agora}</p>
      <p>{ESTRATEGIA[conta]}</p>
      <ChangeSummary title={NOME[conta]} period={dBR(d.d)} changes={numeros} />
      <h3>Freios</h3>
      {freios.length
        ? <ul className="ficha-lista">{freios.slice(0, 4).map((f, n) => <li key={n}><time>{dBR(f.d).slice(0, 5)}</time><span className="dn">{f.t}</span></li>)}</ul>
        : <p className="muted">Nenhum freio disparou até aqui.</p>}
      <p className="muted pequeno">{LIMITES}</p>
      <h3>Últimas ordens da conta</h3>
      {ordens.length
        ? <ul className="ficha-lista">{ordens.map((o, n) => <li key={n}><time>{dBR(o.d).slice(0, 5)}</time><span className={o.lado === "compra" ? "up" : ""}>{o.t}</span></li>)}</ul>
        : <p className="muted">Nenhuma ordem até aqui.</p>}
    </>
  );
}

function FichaEscrivao({ fonte, di, aoVivo }: { fonte: Fonte; di: number; aoVivo: boolean }) {
  const st = fonte.status;
  let ordens = 0; for (let j = 0; j <= di; j++) ordens += fonte.dias[j].o.length;
  return (
    <>
      <Cabeca nome="Escrivão" tipo="robô sem IA · cuida do diário" cor="#c6a6e8" />
      <p>Anota cada ordem e cada freio num diário encadeado: cada linha confere a anterior, então ninguém apaga ou muda o passado sem aparecer.</p>
      {aoVivo && st
        ? <p className={st.diario_integro ? "ok" : "ruim"}>{st.diario_integro ? `Diário íntegro, com ${fmt(st.diario_linhas || 0)} linhas.` : `Diário com problema: ${st.diario_problema || "?"}`}</p>
        : <p className="muted">No ensaio, o diário é o do pacote rodado em dias passados.</p>}
      <p>Ordens anotadas até {dBR(fonte.dias[di].d)}: <b>{fmt(ordens)}</b>.</p>
    </>
  );
}

function FichaGuardiao({ fonte, di }: { fonte: Fonte; di: number }) {
  const freios: { d: string; t: string }[] = [];
  for (let j = di; j >= 0; j--) fonte.dias[j].x.forEach(e => { if (e[1] !== "retomar") freios.push({ d: fonte.dias[j].d, t: `${NOME[e[0]] || e[0]} ${TIPO[e[1]] || e[1]}: ${e[2]}` }); });
  return (
    <>
      <Cabeca nome="Guardião (motor de risco)" tipo="robô sem IA · confere os limites" cor="#5d7f8c" />
      <p>Confere os limites de cada conta antes e depois de cada rodada. Não tem IA, e ninguém muda os limites por este programa.</p>
      <p className="muted pequeno">{LIMITES} Em dia de FOMC ou CPI, nenhuma conta abre posição nova.</p>
      <h3>Freios que disparou</h3>
      {freios.length
        ? <ul className="ficha-lista">{freios.slice(0, 6).map((f, n) => <li key={n}><time>{dBR(f.d).slice(0, 5)}</time><span className="dn">{f.t}</span></li>)}</ul>
        : <p className="muted">Nenhum até {dBR(fonte.dias[di].d)}.</p>}
    </>
  );
}

function FichaAgente({ a }: { a: (typeof AGENTES)[string] }) {
  return (
    <>
      <Cabeca nome={a.nome} tipo="agente de IA · trabalha sozinho, só na simulação" cor={a.cor} />
      <p>{a.funcao}</p>
      <p className="muted">{a.nao}</p>
      <dl className="ficha-dl">
        <div><dt>Quando trabalha</dt><dd>{a.agenda}</dd></div>
        <div><dt>Último trabalho</dt><dd>{a.ultimo}</dd></div>
      </dl>
      {a.link && <Button variant="secondary" onClick={() => window.open(a.link!.url, "_blank")}>{a.link.rotulo}</Button>}
      <p className="muted pequeno">Informação escrita à mão em 26/10/2026; o programa ainda não lê o trabalho dos agentes sozinho.</p>
    </>
  );
}
