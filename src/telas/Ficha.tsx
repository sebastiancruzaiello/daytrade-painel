import { ChangeSummary, type MetricChange } from "../ui/affectui/change-summary";
import { Button } from "../ui/affectui/button";
import { KS, NOME, COR, REF, fmt, pct, dBR, hora, resumoConta, type Fonte } from "../dados/formato";
import { segurar, pregao, type Extras, type Mercado, type LabMercado } from "../dados/mercados";

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
    ultimo: "26/10/2026: 2 fichas. Virada do mês (nota 2 de 5) e meia hora final do bitcoin (nota 1 de 5: a taxa come o ganho). A partir de agora reveza entre cripto, EUA e B3.",
  },
  "agente:revisor": {
    nome: "Revisor", cor: "#c9b38a",
    funcao: "Decide o que entra no laboratório e se um resultado vale. Faz a triagem das fichas, confere a regra congelada antes de rodar e dá o parecer final de cada teste.",
    nao: "Não escreve ficha nem código, não escolhe parâmetro e não libera dinheiro real. Na dúvida, devolve ou descarta.",
    agenda: "Junto da linha de pesquisa semanal, sempre numa sessão separada de quem pesquisou.",
    ultimo: "26/10/2026: meia hora final do bitcoin descartada (o ganho por operação não paga a taxa); virada do mês devolvida (falta a janela exata no artigo).",
  },
  "agente:formalizador": {
    nome: "Formalizador", cor: "#a99ae0",
    funcao: "Transforma uma ficha aceita pelo Revisor em regra congelada, com lacre, e em código testado.",
    nao: "Não roda o teste final, não muda a regra depois do lacre e não escolhe parâmetro que não esteja na ficha.",
    agenda: "Quando o Revisor aceita uma ficha (no máximo 2 por mês).",
    ultimo: "Ainda nenhuma ficha aceita. Em 26/10 as regras de EUA e B3 foram lacradas para ele copiar.",
  },
  "agente:sentinela": {
    nome: "Sentinela", cor: "#e07a6a",
    funcao: "Procura uma vez por dia notícias que podem mexer com as 7 moedas (corretora invadida, USDT fora do dólar, regulador) e só avisa.",
    nao: "Não bloqueia compra, não para conta e não muda nada. Se for alerta, o Plantonista põe no topo do boletim.",
    agenda: "Todo dia, dentro da rotina diária, antes do boletim.",
    ultimo: "26/10/2026: nível atenção. Falha numa carteira de bitcoin (não na rede) e perda numa corretora indiana; nada na Binance e o USDT perto de 1 dólar.",
  },
};

type Props = { id: string; fonte: Fonte; di: number; pararTeste: boolean; aoVivo: boolean; ex: Extras; fechar: () => void };

export function Ficha({ id, fonte, di, pararTeste, aoVivo, ex, fechar }: Props) {
  return (
    <section className="ficha" aria-label="Ficha">
      <button type="button" className="ficha-fechar" onClick={fechar} aria-label="Fechar a ficha">×</button>
      {id.startsWith("robo:") && id.split(":").length === 3 ? <FichaRobo id={id} fonte={fonte} di={di} pararTeste={pararTeste} />
        : id === "staff:escrivao" ? <FichaEscrivao fonte={fonte} di={di} aoVivo={aoVivo} />
        : id === "staff:guardiao" ? <FichaGuardiao fonte={fonte} di={di} />
        : AGENTES[id] ? <FichaAgente a={AGENTES[id]} />
        : id === "ref:SPY" || id === "ref:BOVA11" ? <FichaReferencia mk={id === "ref:SPY" ? ex.spy : ex.bova} lab={id === "ref:SPY" ? ex.lab.eua : ex.lab.b3} inicio={fonte.dias[0].d} dia={fonte.dias[di].d} aoVivo={aoVivo && ex.aoVivo} />
        : id.startsWith("robo:") ? <FichaApoio id={id} ex={ex} />
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

function FichaReferencia({ mk, lab, inicio, dia, aoVivo }: { mk: Mercado; lab: LabMercado; inicio: string; dia: string; aoVivo: boolean }) {
  const t = mk.t.replace(".SA", ""), eua = mk.mercado === "EUA";
  const sg = segurar(mk, inicio, dia);
  const pg = pregao(mk);
  const moeda = eua ? "US$" : "R$";
  const numeros: MetricChange[] = sg ? [
    { label: `Preço do ${t}`, change: `${moeda} ${fmt(sg.preco, 2)} (${dBR(sg.diaPreco)})`, tone: "neutral" },
    { label: `10.000 desde ${dBR(inicio)}`, change: `${fmt(sg.valor)} (${pct(sg.ret)})`, tone: sg.ret >= 0 ? "good" : "bad" },
    ...(sg.ret1a != null ? [{ label: "Em 12 meses", change: pct(sg.ret1a), tone: (sg.ret1a >= 0 ? "good" : "bad") as MetricChange["tone"] }] : []),
  ] : [];
  return (
    <>
      <Cabeca nome={`Só segurar ${t}`} tipo={`referência da ala ${eua ? "EUA" : "B3"} · não opera`} cor={eua ? "#e8a25b" : "#5fcf8f"} />
      <p className="ficha-agora"><b>{aoVivo ? "Agora:" : `Em ${dBR(dia)}:`}</b> {aoVivo ? pg.texto : (sg && sg.teveHoje ? "teve pregão neste dia." : "sem pregão neste dia (fim de semana ou feriado).")}</p>
      <p>{eua
        ? "É a régua das ações americanas: comprar o fundo do S&P 500 e não mexer mais. Uma estratégia de ETFs dos EUA só vale se ganhar disto depois da taxa de 0,10% e dos 30% de imposto retido nos dividendos."
        : "É a régua da bolsa brasileira: comprar o fundo do Ibovespa e não mexer mais. Uma estratégia da B3 só vale se ganhar disto depois da taxa de 0,20% e dos 15% de IR sobre o lucro do mês."}</p>
      {sg ? <ChangeSummary title={mk.nome} period={dBR(sg.diaPreco)} changes={numeros} /> : <p className="muted">Sem dados para este dia.</p>}
      <p className="muted pequeno">Ninguém compra nem vende aqui: é só a conta de quanto teria rendido. Retorno com dividendos, pelo preço ajustado do Yahoo. Pregão de {eua ? "Nova York" : "São Paulo"}; o horário mostrado já é o do seu PC.</p>
      <h3>Laboratório {eua ? "EUA" : "B3"}</h3>
      <LinhasLab lab={lab} />
      <p className="muted pequeno">Dados: {mk.fonte ?? "Yahoo Finance"}, lidos {aoVivo ? "de hora em hora pelo n8n" : "na cópia que vem no programa"} (última em {hora(mk.em)}).</p>
    </>
  );
}

function LinhasLab({ lab }: { lab: LabMercado }) {
  if (!lab.linhas.length) return <p className="muted">{lab.nota || "Nenhuma ficha ainda."}</p>;
  return <ul className="ficha-lista">{lab.linhas.map((l, n) => <li key={n}><time>{dBR(l.d).slice(0, 5)}</time><span><b>{l.t}</b>: {l.v}</span></li>)}</ul>;
}

function FichaApoio({ id, ex }: { id: string; ex: Extras }) {
  if (id === "robo:guardiao-dados") {
    const gd = ex.guardiao;
    return (
      <>
        <Cabeca nome="Guardião de dados" tipo="robô sem IA · confere os dados" cor="#6f9fb0" />
        <p>Toda hora confere se os números da simulação estão chegando frescos e se fazem sentido. Só anota: não para nada e não muda nada.</p>
        {gd
          ? <p className={"ficha-agora " + (gd.nivel === "ok" ? "" : "ruim")}><b>Última conferência ({hora(gd.em)}):</b> {gd.nivel === "ok" ? "tudo certo." : [...gd.falhas, ...gd.alertas].join("; ") || gd.nivel}</p>
          : <p className="muted">Sem leitura agora. A conferência aparece quando o programa está ligado ao ao vivo.</p>}
        <p className="muted pequeno">Roda no n8n, no minuto 50 de toda hora.</p>
      </>
    );
  }
  if (id === "robo:coletor-clima") {
    const cl = ex.clima, mg = cl?.medo_ganancia;
    return (
      <>
        <Cabeca nome="Coletor de clima" tipo="robô sem IA · anota o humor do mercado" cor="#8fb07a" />
        <p>A cada 4 horas anota o índice de medo e ganância do mercado de cripto e quanto quem aposta com alavancagem está pagando para manter a posição (a taxa de financiamento).</p>
        {cl && mg
          ? <p className="ficha-agora"><b>Agora ({hora(cl.em)}):</b> medo e ganância em {mg.valor} de 100 ({traduzClasse(mg.classe)}){cl.leitura?.financiamento_esticado ? "; financiamento esticado" : ""}.</p>
          : <p className="muted">Sem leitura agora. Aparece quando o programa está ligado ao ao vivo.</p>}
        <p className="muted pequeno">Só anota. Nenhuma conta compra ou vende por causa disso.</p>
      </>
    );
  }
  if (id === "robo:coletor-mercados") {
    return (
      <>
        <Cabeca nome="Coletor de referências" tipo="robô sem IA · busca preços de ações" cor="#d0a35c" />
        <p>De hora em hora busca no Yahoo, de graça e sem cadastro, os fechamentos do SPY e do BOVA11 e o horário do próximo pregão de cada bolsa (já pulando fins de semana e feriados).</p>
        <p className="ficha-agora"><b>Última busca:</b> {hora(ex.spy.em)}{ex.aoVivo ? "" : " (cópia que vem no programa)"}.</p>
        <p className="muted pequeno">Só lê preços públicos e guarda no n8n. Não decide nada.</p>
      </>
    );
  }
  if (id === "robo:organizador") {
    return (
      <>
        <Cabeca nome="Organizador" tipo="robô sem IA · arruma o quadro da equipe" cor="#9a9fb0" />
        <p>Todo dia, na rotina diária, junta o que cada um da equipe fez num quadro só, para ninguém se perder.</p>
        <p className="muted pequeno">É um programa nosso, pequeno. Ferramentas prontas de terceiros ficaram de fora de propósito.</p>
      </>
    );
  }
  return <p className="muted">Não achei quem é esta pessoa.</p>;
}

function traduzClasse(c: string) {
  return ({ "Extreme Fear": "medo extremo", Fear: "medo", Neutral: "neutro", Greed: "ganância", "Extreme Greed": "ganância extrema" } as Record<string, string>)[c] || c;
}
