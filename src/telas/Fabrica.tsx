import { useState } from "react";
import { hora, dBR } from "../dados/formato";
import { filaPorPessoa, porEtapa, rotuloTrilha, type Candidato, type Fabrica as F } from "../dados/fabrica";
import { colunasTarefas, doSebastian, NOME_MEMBRO, type Tarefa } from "../dados/visao";

// Área da fábrica: quem pesquisa, revisa, congela e testa estratégias, e onde cada candidato está. Só olha.
// Os papéis vêm do catálogo da equipe (daytrade-lab, equipe/catalogo); o andamento de verdade é a esteira abaixo.
const EQUIPE: { nome: string; cor: string; faz: string; quando: string }[] = [
  { nome: "Pesquisador", cor: "#8fa9b3", faz: "acha estudos e escreve as fichas", quando: "quando a fila tem vaga, pela API na VPS" },
  { nome: "Revisor", cor: "#c9b38a", faz: "aceita, devolve ou descarta; dá o parecer", quando: "depois de cada ficha, conferência ou teste" },
  { nome: "Formalizador", cor: "#a99ae0", faz: "congela e lacra a regra; escreve o código", quando: "quando uma ficha é aceita" },
  { nome: "Claude", cor: "#7fb8ff", faz: "aciona o executor, roda o teste histórico e leva os arquivos ao repositório", quando: "um candidato por vez" },
];

export function Fabrica({ f, tarefas }: { f: F; tarefas?: { em: string | null; lista: Tarefa[] } | null }) {
  const [verParados, setVerParados] = useState(true);
  const fila = filaPorPessoa(f);
  const { colunas, outras } = porEtapa(f);
  const filtra = (l: Candidato[]) => verParados ? l : l.filter(c => !c.parado);
  const andando = f.candidatos.filter(c => !c.parado).length;
  return (
    <div className="fabrica">
      <Tarefas t={tarefas || null} />
      <h2 className="fabrica-tit">Fábrica de estratégias</h2>
      <p className="nota">
        {f.origem === "fabrica"
          ? <>Quadro da fábrica de estratégias, atualizado {hora(f.em)}.</>
          : <>A fábrica ainda não manda o quadro dela; por enquanto aparecem as fichas e vereditos do laboratório{f.em ? ` (resumo de ${f.em.length > 10 ? hora(f.em) : dBR(f.em)})` : ""}.</>}
        {" "}{andando} {andando === 1 ? "candidato andando" : "candidatos andando"}, {f.candidatos.length - andando} {f.candidatos.length - andando === 1 ? "parado" : "parados"} (descartado, devolvido, reprovado ou arquivado).
      </p>

      <section className="equipe" aria-label="Quem trabalha na fábrica">
        {EQUIPE.map(p => (
          <article key={p.nome} className="pessoa" style={{ ["--cor" as string]: p.cor }}>
            <header><i className="ponto" aria-hidden="true" /><b>{p.nome}</b><span className={"espera" + (fila[p.nome] ? " tem" : "")}>{fila[p.nome] ? `${fila[p.nome]} esperando` : "nada esperando"}</span></header>
            <p>{p.faz}</p>
            <p className="muted pequeno">{p.quando} · sem decidir ordens</p>
          </article>
        ))}
      </section>

      <div className="fabrica-barra">
        <label className="caixinha"><input type="checkbox" checked={verParados} onChange={e => setVerParados(e.target.checked)} /> Mostrar os parados</label>
      </div>

      <section className="esteira" aria-label="Etapas da fábrica, da fonte ao parecer">
        {colunas.map(({ etapa, candidatos }, i) => (
          <div key={etapa.id} className="etapa">
            <header>
              <span className="etapa-n">{i + 1}</span>
              <b>{etapa.rotulo}</b>
              <span className="muted">{filtra(candidatos).length}</span>
            </header>
            {etapa.explica && <p className="muted pequeno">{etapa.explica}</p>}
            {filtra(candidatos).map(c => <CartaoCandidato key={c.id} c={c} />)}
            {!filtra(candidatos).length && <p className="etapa-vazia">vazia</p>}
          </div>
        ))}
        {!!filtra(outras).length && (
          <div className="etapa">
            <header><span className="etapa-n">?</span><b>Outras</b><span className="muted">{filtra(outras).length}</span></header>
            {filtra(outras).map(c => <CartaoCandidato key={c.id} c={c} />)}
          </div>
        )}
      </section>
      <p className="nota">A fábrica só propõe e testa, sem pedir "sim" a cada etapa (delegação de 27/10/2026), dentro dos US$ 200 do mês para IA/API, sem teto fixo por candidato (a referência de US$ 15 só gera aviso). Desde 29/10 também testa ideias nossas e adaptações (trilha 2): a regra é lacrada antes de qualquer número e julgada só com dias depois do lacre. Continua precisando do "sim" do Sebastian, com data e registro: um robô novo e permanente na simulação (nível 3 do catálogo), qualquer gasto novo e qualquer mudança de risco, lacre ou limite. Nenhuma IA decide ordens.</p>
    </div>
  );
}

function CartaoCandidato({ c }: { c: Candidato }) {
  return (
    <article className={"candidato" + (c.parado ? " parado" : "")}>
      <b>{c.titulo}</b>
      {rotuloTrilha(c) && <span className="candidato-trilha" title="Trilha 2: regra nossa, lacrada antes de qualquer número e julgada só com dias depois do lacre (TRILHA-2-v1.md)">{rotuloTrilha(c)}</span>}
      <span className="candidato-meta">{c.mercado}{c.desde ? ` · desde ${dBR(c.desde).slice(0, 5)}` : ""}</span>
      <span className={"candidato-sit" + (c.parado ? " dn" : "")}>{c.situacao}</span>
      {c.responsavel && !c.parado && <span className="muted pequeno">com {c.responsavel}</span>}
      {c.evidencia && <code title="Arquivo que comprova esta etapa, no repositório daytrade-lab">{c.evidencia}</code>}
    </article>
  );
}

// Tarefas da equipe (§8.8): em execução, próximas, aguardando condição, concluídas e incidentes. Quem precisa agir
// vem do registro: só aparece "você" quando quem resolve é o Sebastian; o resto é de um agente.
const nome = (id: string) => NOME_MEMBRO[id.split("@")[0].toLowerCase()] || id;
function Tarefas({ t }: { t: { em: string | null; lista: Tarefa[] } | null }) {
  const [todas, setTodas] = useState(false);
  if (!t) return <p className="nota">O registro de tarefas da equipe não chegou na última leitura: não dá para dizer quem está fazendo o quê.</p>;
  const c = colunasTarefas(t.lista);
  const colunas: [string, string, Tarefa[]][] = [
    ["Em execução", "trabalho acontecendo agora", c.execucao],
    ["Próximas", "na fila, ainda não começaram", c.proximas],
    ["Aguardando condição", "paradas até algo acontecer", c.aguardando],
    ["Incidentes", "falhou ou está sem sinal", c.incidentes],
    ["Concluídas", "entregues", todas ? c.concluidas : c.concluidas.slice(0, 5)],
  ];
  return (
    <section className="tarefas" aria-label="Tarefas da equipe">
      <h2>Equipe e tarefas</h2>
      <p className="nota">Registro de tarefas da equipe{t.em ? `, lido ${hora(t.em)}` : ""}. Cada tarefa diz quem é o responsável e, quando está parada, quem precisa agir.</p>
      <div className="tarefas-colunas">
        {colunas.map(([tit, sub, l]) => (
          <div key={tit} className="tarefas-col">
            <header><b>{tit}</b> <span className="muted">{tit === "Concluídas" ? c.concluidas.length : l.length}</span><br /><span className="muted pequeno">{sub}</span></header>
            {l.map(x => (
              <article key={tit + x.id} className={"tarefa" + (doSebastian(x) ? " tarefa-sua" : "")}>
                <b>{x.titulo}</b>
                <span className="muted pequeno">{nome(x.responsavel)} · {x.situacao}</span>
                {x.condicao && <span className="pequeno">Espera: {x.condicao}</span>}
                {x.estado === "aguardando" && <span className={"pequeno " + (doSebastian(x) ? "aviso" : "muted")}>Quem precisa agir: {doSebastian(x) ? "você (Sebastian)" : nome(x.quemResolve || x.responsavel)}</span>}
                <span className="muted pequeno tarefa-id">{x.id}</span>
              </article>
            ))}
            {!l.length && <p className="etapa-vazia">nenhuma</p>}
            {tit === "Concluídas" && c.concluidas.length > 5 && <button type="button" className="link pequeno" onClick={() => setTodas(v => !v)}>{todas ? "mostrar só as 5 últimas" : `mostrar todas (${c.concluidas.length})`}</button>}
          </div>
        ))}
      </div>
    </section>
  );
}
