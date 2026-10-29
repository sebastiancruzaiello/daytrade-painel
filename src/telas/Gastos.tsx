import { hora } from "../dados/formato";
import { dinheiro } from "../dados/escritorio";
import { nomeCusto, type Custos } from "../dados/visao";

// Gastos de IA (§8.8): dinheiro de verdade, separado do dinheiro de mentira dos robôs. Lê a linha "custos:resumo"
// que a VPS monta com a Caixa (governanca/custos, limites v3 de 29/10/2026): teto do mês, gasto confirmado, reservas
// das chamadas em andamento, margem e o que ainda pode ser usado.
export function Gastos({ c }: { c: Custos | null }) {
  if (!c) return (
    <div className="gastos">
      <p className="faixa-real" role="note"><b>Despesa real de IA/API</b> — dinheiro de verdade.</p>
      <p className="nota">Sem informação de custo: a linha de custos não chegou na última leitura. Isso não quer dizer gasto zero.</p>
    </div>
  );
  const pc = (v: number) => `${Math.max(0, Math.min(100, (v / c.teto) * 100))}%`;
  const fatias: [string, number, string][] = [["gasto confirmado", c.gasto, "g-gasto"], ["reservado", c.reservado, "g-reserva"], ["margem", c.margem, "g-margem"], ["disponível", c.disponivel, "g-livre"]];
  const total = c.porTarefa.reduce((s, [, v]) => s + v, 0);
  return (
    <div className="gastos">
      <p className="faixa-real" role="note"><b>Despesa real de IA/API — dinheiro de verdade.</b> Não tem nada a ver com os ganhos e perdas dos robôs, que são simulação.</p>

      <section className="gastos-topo" aria-label="Mês de gastos">
        <h2>{c.mes.slice(5)}/{c.mes.slice(0, 4)}: {dinheiro(c.gasto, "USD")} de {dinheiro(c.teto, "USD")}</h2>
        <div className="barra-gasto" role="img" aria-label={fatias.map(([n, v]) => `${n} ${dinheiro(v, "USD")}`).join(", ")}>
          {fatias.map(([n, v, k]) => v > 0 && <span key={n} className={k} style={{ width: pc(v) }} title={`${n}: ${dinheiro(v, "USD")}`} />)}
        </div>
        <dl className="gastos-numeros">
          <div><dt><i className="g-gasto" />Gasto confirmado</dt><dd>{dinheiro(c.gasto, "USD")}</dd></div>
          <div><dt><i className="g-reserva" />Reservado para chamadas em andamento</dt><dd>{dinheiro(c.reservado, "USD")}</dd></div>
          <div><dt><i className="g-margem" />Margem de segurança</dt><dd>{dinheiro(c.margem, "USD")}</dd></div>
          <div><dt><i className="g-livre" />Ainda pode ser usado</dt><dd><b>{dinheiro(c.disponivel, "USD")}</b></dd></div>
        </dl>
        <p className="muted pequeno">
          {c.hoje != null && <>Hoje: {dinheiro(c.hoje, "USD")}. </>}Atualizado {c.em ? hora(c.em) : "—"}. O teto vale para o mês inteiro, somando todos os
          usos; não há cota por dia nem teto por candidata. Antes de cada chamada o custo máximo fica reservado; se a chamada cai, conta o custo estimado.
          Um disjuntor de US$ 40 por hora para tudo se algo entrar em laço. Passar de US$ 200 no mês só com um "sim" seu.
        </p>
      </section>

      <section aria-label="Em que foi gasto">
        <h2>Em que foi gasto</h2>
        <p className="muted pequeno">Por candidata ou tarefa, inclusive correções e tentativas que não deram certo.</p>
        <table className="tabela">
          <thead><tr><th>Candidata ou tarefa</th><th>Gasto</th><th>Do total</th></tr></thead>
          <tbody>
            {c.porTarefa.map(([k, v]) => <tr key={k}><td>{nomeCusto(k)}</td><td>{dinheiro(v, "USD")}</td><td>{total ? Math.round(v / total * 100) : 0}%</td></tr>)}
          </tbody>
        </table>
        {Math.abs(total - c.gasto) >= 0.05 && <p className="muted pequeno">A soma por tarefa ({dinheiro(total, "USD")}) difere do gasto do mês ({dinheiro(c.gasto, "USD")}) porque algumas chamadas não têm tarefa anotada.</p>}
      </section>

      <details className="glossario">
        <summary>O que não entra nesta conta</summary>
        <ul className="pequeno">
          {c.semDado.includes("assinatura-claude") && <li>A assinatura do Claude usada pelo Maestro: não tem registro de uso legível, então não aparece aqui.</li>}
          <li>A VPS: serve outros projetos e fica fora da conta do DAYTRADE (decisão de 28/10).</li>
          {c.github && <li>GitHub Actions: {c.github.usados} de {c.github.gratis.toLocaleString("pt-BR")} minutos grátis do mês.</li>}
          {c.projecao != null && <li>Se todos os dias do mês gastassem como hoje, daria {dinheiro(c.projecao, "USD")}; isso é só uma conta de ritmo. A trava não deixa passar de {dinheiro(c.teto, "USD")}.</li>}
        </ul>
      </details>
    </div>
  );
}
