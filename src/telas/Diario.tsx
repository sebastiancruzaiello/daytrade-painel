import type React from "react";
import { ToolCallCard } from "../ui/affectui/tool-call-card";
import { NOME, fmt, dBR, type Dia } from "../dados/formato";
import { IconeCompra, IconeVenda, IconeFreio, IconeRetomar } from "./icones";

const TIPO: Record<string, string> = { pausar: "pausada", parar: "parada", retomar: "retomada", alerta: "aviso" };

// Diário do dia mostrado para trás: cada ordem ou freio vira um cartão que abre para mostrar os detalhes.
export function Diario({ dias, di }: { dias: Dia[]; di: number }) {
  const itens: { chave: string; d: string; el: React.ReactElement }[] = [];
  for (let i = di; i >= 0 && itens.length < 60; i--) {
    const x = dias[i];
    x.x.forEach((e, j) => itens.push({
      chave: `${x.d}-x${j}`, d: x.d,
      el: (
        <ToolCallCard
          name={`${NOME[e[0]] || e[0]} · ${TIPO[e[1]] || e[1]}`}
          summary={e[2]}
          icon={e[1] === "retomar" ? <IconeRetomar /> : <IconeFreio />}
          status={e[1] === "retomar" ? "success" : "error"}
          error={e[1] === "retomar" ? undefined : "Motor de risco: " + e[2]}
          args={{ dia: dBR(x.d), conta: NOME[e[0]] || e[0], o_que: TIPO[e[1]] || e[1], motivo: e[2] }}
        />
      ),
    }));
    x.o.forEach((o, j) => itens.push({
      chave: `${x.d}-o${j}`, d: x.d,
      el: (
        <ToolCallCard
          name={`${o[2]} ${o[1]}`}
          summary={`${NOME[o[0]]} · ${fmt(o[3])} USDT${o[4] === "motor_de_risco" ? " · mandada pelo motor de risco" : ""}`}
          icon={o[2] === "compra" ? <IconeCompra /> : <IconeVenda />}
          status="success"
          args={{ dia: dBR(x.d), conta: NOME[o[0]], ordem: o[2], moeda: o[1], valor_usdt: o[3], quem_mandou: o[4] === "motor_de_risco" ? "motor de risco" : "regra da estratégia" }}
        />
      ),
    }));
  }
  if (!itens.length) return <div className="diario vazio">Nenhuma ordem até {dBR(dias[di].d)}.</div>;
  let ultimo = "";
  return (
    <div className="diario">
      <p className="nota">Do dia mostrado para trás (até 60 registros). Clique num cartão para ver os detalhes.</p>
      {itens.map(it => {
        const titulo = it.d !== ultimo ? (ultimo = it.d, <h3 className="diario-dia">{dBR(it.d)}</h3>) : null;
        return <div key={it.chave}>{titulo}{it.el}</div>;
      })}
    </div>
  );
}
