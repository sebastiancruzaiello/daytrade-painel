import { useEffect, useState } from "react";
import { Button } from "./ui/affectui/button";
import type { EstadoAtualizacao } from "./global";

// Estado da atualização automática, vindo do processo principal. Fora do programa (navegador), fica nulo.
export function useAtualizacao() {
  const [estado, setEstado] = useState<EstadoAtualizacao | null>(null);
  useEffect(() => {
    const api = window.daytrade;
    if (!api?.lerAtualizacao) return;
    api.lerAtualizacao().then(setEstado);
    return api.aoAtualizar(setEstado);
  }, []);
  return estado;
}

export function FaixaAtualizacao({ estado }: { estado: EstadoAtualizacao | null }) {
  const [reiniciando, setReiniciando] = useState(false);
  if (estado?.fase !== "pronta") return null;
  return (
    <div className="faixa-atualizacao" role="status">
      <span><b>Versão {estado.nova} baixada.</b> Ela entra sozinha quando você fechar o programa.</span>
      <Button size="sm" variant="secondary" disabled={reiniciando}
        onClick={() => { setReiniciando(true); window.daytrade?.reiniciarParaAtualizar(); }}>
        {reiniciando ? "Reiniciando…" : "Reiniciar agora"}
      </Button>
    </div>
  );
}

export function textoAtualizacao(e: EstadoAtualizacao | null): string {
  if (!e) return "Atualização automática só funciona no programa instalado.";
  switch (e.fase) {
    case "procurando": return "Procurando versão nova…";
    case "em-dia": return "Em dia: esta é a versão mais nova.";
    case "baixando": return `Baixando a versão ${e.nova ?? "nova"}${e.pct ? ` (${e.pct}%)` : ""}…`;
    case "pronta": return `Versão ${e.nova} baixada: entra quando você fechar o programa.`;
    case "erro": return `Não consegui procurar atualização agora (${e.msg}). Tento de novo em algumas horas.`;
    default: return "Procura versão nova ao abrir e de 4 em 4 horas.";
  }
}
