import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SegmentedControl } from "./ui/affectui/segmented-control";
import { GridBackground } from "./ui/affectui/grid-background";
import { Button } from "./ui/affectui/button";
import { deLinhas, fonteEnsaio, dBR, hora, type Fonte } from "./dados/formato";
import { extrasDeLinhas, extrasEmbutidos, pregao, type Extras } from "./dados/mercados";
import { vizinhasDeLinhas, type Vizinhas } from "./dados/vizinhas";
import { Pregao } from "./telas/Pregao";
import { Robos } from "./telas/Robos";
import { Fabrica } from "./telas/Fabrica";
import { fabricaDeLinhas, fabricaDoLab, type Fabrica as QuadroFabrica } from "./dados/fabrica";
import { montarEntidades, type Conexao } from "./dados/estados";
import { detalheDeLinhas, type Detalhes } from "./dados/detalhe";
import { loteDeLinhas, type Lote } from "./dados/lote";
import { elencoDeLinhas, reconciliar, type Elenco } from "./dados/elenco";
import { version as VERSAO } from "../package.json";
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
type Aba = "pregao" | "robos" | "fabrica" | "contas" | "diario" | "ajustes";

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
  const [viz, setViz] = useState<Vizinhas>({ bolsa: null, intradia: null, carteiras: null });
  const atualizacao = useAtualizacao();
  // Última leitura boa: numa falha, o salão continua mostrando o que chegou e diz desde quando.
  const [ultimaOk, setUltimaOk] = useState<string | null>(null);
  const [fab, setFab] = useState<QuadroFabrica | null>(null);
  const [detalhe, setDetalhe] = useState<Detalhes | null>(null);
  const [lote, setLote] = useState<Lote | null>(null);
  const [elenco, setElenco] = useState<Elenco | null>(null);
  // Relógio de minuto em minuto, para "dado velho" e "aguardando mercado" mudarem sozinhos.
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 60000); return () => clearInterval(t); }, []);

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
    setViz(vizinhasDeLinhas(r.linhas));
    setUltimaOk(r.lidoEm);
    setFab(fabricaDeLinhas(r.linhas));
    setDetalhe(detalheDeLinhas(r.linhas));
    setLote(loteDeLinhas(r.linhas));
    setElenco(elencoDeLinhas(r.linhas));
    setAgora(Date.now());
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

  const conexao: Conexao = info.estado === "erro" ? { estado: "erro", msg: info.msg, ultimaOk }
    : info.estado === "ok" ? { estado: "ok", lidoEm: info.lidoEm } : { estado: info.estado };
  // O cadastro da VPS (elenco:esperado) diz quem deveria aparecer; quem não veio na leitura entra como "sem dado".
  const { lista: entidades, conta: contaElenco } = useMemo(() => reconciliar(montarEntidades({
    vivo, viz, agora, conexao, detalhe, lote,
    pregao: { EUA: ex.aoVivo ? pregao(ex.spy, agora) : null, B3: ex.aoVivo ? pregao(ex.bova, agora) : null },
  }), elenco, conexao.estado === "erro"
    ? `Sem telemetria: a última leitura do n8n falhou (${conexao.msg}). O cadastro da VPS diz que este robô existe.`
    : "Sem telemetria: o cadastro da VPS diz que este robô existe, mas a última leitura não trouxe nada dele. Pode ser a simulação parada ou o envio dela falhando."),
  [vivo, viz, agora, info, ultimaOk, ex, detalhe, lote, elenco]); // eslint-disable-line react-hooks/exhaustive-deps
  const quadro = useMemo(() => fab || fabricaDoLab(ex.lab), [fab, ex]);
  const alertas = entidades.filter(x => x.estado !== "ativo" && x.estado !== "aguardando-mercado").length;

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
              { value: "robos", label: "Robôs", count: alertas || undefined, controls: "tela" },
              { value: "fabrica", label: "Fábrica", controls: "tela" },
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
            info={info} vivo={vivo} ex={ex} entidades={entidades} contaElenco={contaElenco} verRobos={() => setAba("robos")}
          />
        )}
        {aba === "robos" && <Robos lista={entidades} aoVivo={base === "aovivo"} avisoLote={lote ? (lote.aviso_geral || "Os robôs do lote são observação.") : null} />}
        {aba === "fabrica" && <Fabrica f={quadro} />}
        {aba === "contas" && <Contas dias={dias} di={diSeguro} pararTeste={pararTeste} base={base} ex={ex} viz={viz} entidades={entidades} />}
        {aba === "diario" && <Diario dias={dias} di={diSeguro} />}
        {aba === "ajustes" && <Ajustes info={info} onSalvo={lerVivo} atualizacao={atualizacao} />}
      </main>

      <footer className="rodape">
        <span className="rodape-versao">{origemTexto(info, ultimaOk, vivo)}</span>
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

// Versão, de onde vêm os números e de quando: para saber sempre qual tela e qual dado se está vendo (achado C).
function origemTexto(info: InfoVivo, ultimaOk: string | null, vivo: Fonte | null) {
  const onde = window.daytrade ? "programa do PC, ao vivo pelo n8n (lê de 10 em 10 minutos)" : "prévia no navegador, sem ao vivo";
  const leu = info.estado === "ok" ? `última leitura ${hora(info.lidoEm)}` : ultimaOk ? `última leitura boa ${hora(ultimaOk)}` : "nenhuma leitura ainda";
  const envio = vivo?.status?.gerado_em ? ` · último envio da VPS ${hora(vivo.status.gerado_em)}` : "";
  return `Versão ${VERSAO} · ${onde} · ${leu}${envio}. `;
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
