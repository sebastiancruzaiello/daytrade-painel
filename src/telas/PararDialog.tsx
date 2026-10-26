import { useEffect, useRef } from "react";
import { Button } from "../ui/affectui/button";

// O único comando que o painel vai ter é parar. Nesta versão ele ainda não chega na VPS (fase 2, depende de outro "sim").
export function PararDialog({ aberto, fechar, pararTeste, alternarTeste }: { aberto: boolean; fechar: () => void; pararTeste: boolean; alternarTeste: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);
  return (
    <dialog ref={ref} className="dialogo" onClose={fechar} aria-labelledby="parar-titulo">
      <h2 id="parar-titulo">Parar a simulação</h2>
      <p>Nesta versão o botão ainda <b>não</b> chega na VPS. Ligar o botão de verdade é a fase 2 e vai pedir o seu "sim".</p>
      <p>Se precisar parar agora, peça ao Claude no projeto DAY TRADE: "pare a simulação, motivo: …". Ele roda na VPS o único comando permitido:</p>
      <pre>python3 -m aovivo parar "motivo"</pre>
      <p className="muted">Retomar depois de parar é só manual, com ordem sua.</p>
      <div className="dialogo-botoes">
        <Button variant="secondary" onClick={alternarTeste}>{pararTeste ? "Desfazer o teste" : "Testar no salão"}</Button>
        <Button variant="ghost" onClick={fechar}>Fechar</Button>
      </div>
    </dialog>
  );
}
