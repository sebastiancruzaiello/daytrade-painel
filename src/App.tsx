import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SegmentedControl } from "./ui/affectui/segmented-control";
import { GridBackground } from "./ui/affectui/grid-background";
import { Button } from "./ui/affectui/button";
import { deLinhas, fonteEnsaio, dBR, hora, type Fonte } from "./dados/formato";
import { extrasDeLinhas, extrasEmbutidos, type Extras } from "./dados/mercados";
import { Pregao } from "./telas/Pregao";
import { Contas } from "./telas/Contas";
import { Diario } from "./telas/Diario";
import { Ajustes } from "./telas/Ajustes";
import { PararDialog } from "./telas/PararDialog";
import { IconeParar } from "./telas/icones";
import { useAtualizacao, FaixaAtualizacao } from "./atualizacao";

export type Base = "aovivo" | "recente" | "longo";
export type InfoVivo =
  | { estado: "sem-programa" | "sem-endereco" | "lendo" }
  | { estado: "ok"; lidoEm: string; geradoEm: string; diasVivo: number }
  | { estado: "erro"; msg: string };
type Aba = "pregao" | "contas" | "diario" | "ajustes";

const DEZ_MIN = 10 * 60 * 1000;

export function App() {
  const [aba, setAba] = useState<Aba>("pregao");
  const [base, setBase] = useState<Base>("recente");
  const [vivo, setVivo] = useState<Fonte | null>(null);
  const [info, setInfo] = useState<InfoVivo>({ estado: window.daytrade ? "lendo" : "sem-programa" });
  const [di, setDi] = useState(0);
  const [tocando, setTocando] = useState(!matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [passo, setPasso] = useState("350");
  const [pararTeste, setPararTeste] = useState(false);
  const [dialogo, setDialogo] = useState(false);
  const jaTeveVivo = useRef(false);
  const [ex, setEx] = useState<Extras>(extrasEmbutidos);
  const atualizacao = useAtualizacao();

  const fonte: Fonte = useMemo(() => (base === "aovivo" && vivo ? vivo : fonteEnsaio(base === "longo" ? "longo" : "recente")), [base, vivo]);
  const dias = fonte.dias;

  // Ao vivo: lê o resumo que a VPS manda para o n8n (só leitura), de 10 em 10 minutos.
  const lerVivo = useCallback(async () => {
    const api = window.daytrade;
    if (!api) return;
    setInfo(i => (i.estado === "ok" ? i : { estado: "lendo" }));
    const r = await api.lerFonte();
    if (!r.ok) {
      setInfo(r.erro === "sem-endereco" ? { estado: "sem-endereco" } : { estado: "erro", msg: r.erro });
      return;
    }
    const e = extrasDeLinhas(r.linhas);
    if (e) setEx(e);
    const v = deLinhas(r.linhas);
    // Tabela ainda vazia: a VPS não mandou o primeiro resumo.
    if (!v) { setInfo({ estado: "erro", msg: "o n8n respondeu, mas ainda não chegou nenhum resumo da VPS" }); return; }
    setInfo({ estado: "ok", lidoEm: r.lidoEm, geradoEm: v.status!.gerado_em, diasVivo: v.dias.length });
    if (v.dias.length) {
      setVivo(v);
      // Na primeira leitura boa, o programa passa sozinho para o ao vivo.
      if (!jaTeveVivo.current) { jaTeveVivo.current = true; setBase("aovivo"); }
    }
  }, []);
  useEffect(() => {
    lerVivo();
    const t = setInterval(lerVivo, DEZ_MIN);
    return () => clearInterval(t);
  }, [lerVivo]);

  // Ao trocar a fonte: ao vivo abre no último dia; ensaio recomeça do primeiro.
  useEffect(() => {
    setPararTeste(false);
    if (base === "aovivo") { setDi(Math.max(0, dias.length - 1)); setTocando(false); }
    else setDi(0);
  }, [base, dias]);

  // Replay dos ensaios.
  useEffect(() => {
    if (!tocando) return;
    const t = setInterval(() => setDi(i => {
      if (i >= dias.length - 1) { setTocando(false); return i; }
      return i + 1;
    }), Number(passo));
    return () => clearInterval(t);
  }, [tocando, passo, dias]);

  const diSeguro = Math.min(di, dias.length - 1);
  const dia = dias[diSeguro];
  const selo = base === "aovivo" ? "Ao vivo" : "Ensaio";

  return (
    <div className="app">
      <GridBackground className="topo" size={40} speed={4} fade={80}>
        <header className="cabeca">
          <div className="marca">
            <span className="logo" aria-hidden="true"><i /><i /><i /></span>
            <div>
              <h1>DAYTRADE <span>Painel</span></h1>
              <p className="sub">A equipe de robôs da simulação, de olho em tempo real. Dinheiro de mentira, só leitura.</p>
            </div>
          </div>
          <div className="cabeca-dir">
            <EstadoFonte info={info} base={base} onAjustes={() => setAba("ajustes")} />
            <span className={"selo " + (base === "aovivo" ? "selo-vivo" : "")}>{selo} · {dBR(dia.d)}</span>
            <Button variant="destructive" size="md" icon={<IconeParar />} onClick={() => setDialogo(true)}>Parar</Button>
          </div>
        </header>
        <nav className="abas">
          <SegmentedControl<Aba>
            kind="tabs"
            variant="underline"
            value={aba}
            onChange={a => { setAba(a); if (a !== "pregao") setTocando(false); }}
            aria-label="Telas"
            options={[
              { value: "pregao", label: "Pregão", controls: "tela" },
              { value: "contas", label: "Contas", controls: "tela" },
              { value: "diario", label: "Diário", count: contarDiario(dias, diSeguro) || undefined, controls: "tela" },
              { value: "ajustes", label: "Ajustes", controls: "tela", badge: info.estado === "sem-endereco" ? "ligar" : undefined },
            ]}
          />
        </nav>
      </GridBackground>
      <FaixaAtualizacao estado={atualizacao} />

      <main id="tela" role="tabpanel" className={"tela" + (aba === "pregao" ? " tela-larga" : "")}>
        {aba === "pregao" && (
          <Pregao
            fonte={fonte} di={diSeguro} setDi={i => { setTocando(false); setDi(i); }}
            tocando={tocando} setTocando={setTocando} passo={passo} setPasso={setPasso}
            base={base} setBase={setBase} temVivo={!!vivo} pararTeste={pararTeste}
            info={info} vivo={vivo} ex={ex}
          />
        )}
        {aba === "contas" && <Contas dias={dias} di={diSeguro} pararTeste={pararTeste} base={base} ex={ex} />}
        {aba === "diario" && <Diario dias={dias} di={diSeguro} />}
        {aba === "ajustes" && <Ajustes info={info} onSalvo={lerVivo} atualizacao={atualizacao} />}
      </main>

      <footer className="rodape">
        Este programa só olha: não muda regras, limites nem estratégias, não fala com corretora e não tem IA nas decisões.
        Componentes visuais: affectUI (MIT).
      </footer>

      <PararDialog
        aberto={dialogo}
        fechar={() => setDialogo(false)}
        pararTeste={pararTeste}
        alternarTeste={() => { setPararTeste(p => !p); setDialogo(false); setAba("pregao"); }}
      />
    </div>
  );
}

function contarDiario(dias: Fonte["dias"], di: number) {
  let n = 0; for (let i = 0; i <= di; i++) n += dias[i].o.length + dias[i].x.length;
  return n;
}

function EstadoFonte({ info, base, onAjustes }: { info: InfoVivo; base: Base; onAjustes: () => void }) {
  let txt: string, tom = "neutro";
  switch (info.estado) {
    case "sem-programa": txt = "Prévia no navegador"; break;
    case "sem-endereco": txt = "Ao vivo: falta a chave"; tom = "aviso"; break;
    case "lendo": txt = "Procurando a VPS…"; break;
    case "erro": txt = "Ao vivo: " + info.msg; tom = "ruim"; break;
    case "ok": {
      const idade = (Date.now() - Date.parse(info.geradoEm)) / 36e5;
      txt = idade > 26 ? "VPS sem notícia desde " + hora(info.geradoEm) : "VPS ok · lido às " + hora(info.lidoEm).slice(-5);
      tom = idade > 26 ? "ruim" : "ok";
      if (!info.diasVivo) { txt = "VPS ok · esperando o 1º dia"; tom = "aviso"; }
    }
  }
  return (
    <button type="button" className={"estado estado-" + tom} onClick={onAjustes} title={base === "aovivo" ? "Mostrando o ao vivo" : "Mostrando um ensaio"}>
      <i aria-hidden="true" />{txt}
    </button>
  );
}
