import { useEffect, useState } from "react";
import { Button } from "../ui/affectui/button";
import { ThinkingLoader } from "../ui/affectui/thinking-loader";
import type { InfoVivo } from "../App";
import { hora } from "../dados/formato";
import { textoAtualizacao } from "../atualizacao";
import type { EstadoAtualizacao } from "../global";

export function Ajustes({ info, onSalvo, atualizacao }: { info: InfoVivo; onSalvo: () => Promise<void>; atualizacao: EstadoAtualizacao | null }) {
  const api = window.daytrade;
  const [endereco, setEndereco] = useState("");
  const [chave, setChave] = useState("");
  const [temChave, setTemChave] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tom: "ok" | "ruim"; txt: string } | null>(null);

  useEffect(() => { api?.lerAjustes().then(a => { setEndereco(a.endereco); setTemChave(a.temChave); }); }, [api]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!api) return;
    setSalvando(true); setMsg(null);
    const r = await api.salvarAjustes({ endereco, chave: chave || undefined });
    if (!r.ok) { setMsg({ tom: "ruim", txt: r.erro }); setSalvando(false); return; }
    if (chave) setTemChave(true);
    setChave("");
    await onSalvo();
    setSalvando(false);
    setMsg({ tom: "ok", txt: "Guardado. O programa tenta ler a VPS agora e depois de 10 em 10 minutos." });
  }
  async function apagar() {
    if (!api) return;
    await api.apagarAjustes();
    setEndereco(""); setTemChave(false); setChave("");
    setMsg({ tom: "ok", txt: "Chave apagada deste PC. O endereço voltou ao padrão." });
    await onSalvo();
  }

  return (
    <div className="ajustes">
      <section className="bloco">
        <h2>Ligação com a simulação ao vivo</h2>
        <p>O programa lê o resumo que a VPS manda para o n8n depois de cada rodada. Ele só lê: não manda ordens, não muda regras e não tem como mexer na simulação.</p>
        {!api && <p className="aviso">Esta é a prévia no navegador. Os ajustes só funcionam no programa instalado.</p>}
        <form onSubmit={salvar} className="form">
          <label>
            <span>Endereço de leitura do n8n</span>
            <input type="url" inputMode="url" placeholder="https://…/webhook/…" value={endereco} onChange={e => setEndereco(e.target.value)} required spellCheck={false} disabled={!api} />
          </label>
          <label>
            <span>Chave só de leitura {temChave && <em className="ok">(já guardada)</em>}</span>
            <input type="password" placeholder={temChave ? "deixe em branco para manter" : "cole a chave aqui"} value={chave} onChange={e => setChave(e.target.value)} autoComplete="off" disabled={!api} />
          </label>
          <div className="form-botoes">
            <Button type="submit" loading={salvando} disabled={!api}>Guardar e testar</Button>
            <Button variant="ghost" onClick={apagar} disabled={!api || (!endereco && !temChave)}>Apagar do PC</Button>
          </div>
        </form>
        <div className="estado-ligacao">
          {info.estado === "lendo" && <ThinkingLoader phases={["Procurando a VPS", "Lendo o n8n", "Conferindo o diário"]} size="sm" />}
          {info.estado === "ok" && <ThinkingLoader done doneLabel={`Ligado · resumo de ${hora(info.geradoEm)}`} size="sm" />}
          {info.estado === "erro" && <p className="ruim">Não deu certo: {info.msg}</p>}
          {info.estado === "sem-endereco" && <p className="muted">Falta colar a chave de leitura. Enquanto isso, o programa mostra os ensaios.</p>}
          {msg && <p className={msg.tom}>{msg.txt}</p>}
        </div>
        <p className="muted pequeno">A chave fica só neste PC, guardada pelo cofre do Windows. Ela não vai para nenhum outro lugar e só serve para ler.</p>
      </section>

      <section className="bloco">
        <h2>O que este programa nunca faz</h2>
        <ul className="nunca">
          <li>Não muda regras, limites, estratégias nem o calendário da simulação.</li>
          <li>Não fala com corretora e não mexe em dinheiro de verdade.</li>
          <li>Não põe IA na decisão de comprar ou vender.</li>
          <li>Não guarda senha de nada. A única coisa guardada é o endereço e a chave de leitura acima.</li>
          <li>Atualiza sozinho só a partir do repositório público do programa no GitHub, conferindo cada arquivo baixado.</li>
        </ul>
      </section>

      <section className="bloco">
        <h2>Sobre</h2>
        <p><b>Versão {atualizacao?.versao ?? "de teste"}.</b> {textoAtualizacao(atualizacao)}</p>
        <p className="muted">DAYTRADE Painel. Feito com React e Electron. Componentes visuais do affectUI (MIT, Florian Höller). O salão é o mesmo "Pregão DAYTRADE" do claude.ai.</p>
      </section>
    </div>
  );
}
