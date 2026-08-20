import { useRef, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { API_URL } from "../lib/api";
import logoUlrik from "../assets/ulrik-logo.png";

// Tela aberta ao escanear o QR Code de VISITA do condomínio — usada
// pelo supervisor, não pelo morador. Fluxo em duas etapas:
// 1) nome + turno (grava o início da visita)
// 2) checklist correspondente ao turno escolhido (grava a conclusão)
//
// O checklist ainda é FIXO no código (Etapa 1 do projeto) — na Etapa
// 3, a gerência vai poder configurar as perguntas pelo painel, sem
// precisar mexer em código. Por isso as respostas já são guardadas
// em formato livre (JSON) desde já.

type Turno = "DIURNO" | "NOTURNO" | "LIMPEZA";

interface CondominioInfo {
  condominioNome: string;
  condominioLogoUrl?: string;
}

const OPCOES_QUALIDADE = ["Excelente", "Boa", "Regular", "Ruim"];
const OPCOES_CONFORMIDADE = ["Conforme", "Não Conforme"];
const OPCOES_MATERIAIS = ["Adequados", "Insuficientes", "Necessitam Reposição"];

function CampoOpcoes({
  label,
  opcoes,
  valor,
  onSelecionar,
}: {
  label: string;
  opcoes: string[];
  valor: string;
  onSelecionar: (v: string) => void;
}) {
  return (
    <section>
      <label className="text-sm font-medium text-white block mb-2">{label}</label>
      <div className="grid grid-cols-2 gap-2">
        {opcoes.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onSelecionar(o)}
            className={`h-10 rounded-lg text-sm font-medium border transition-colors px-2 ${
              valor === o ? "border-[#FF3B3B] bg-[#FF3B3B] text-white" : "border-white/10 text-white/70"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </section>
  );
}

export default function VisitaForm() {
  const { condominioId } = useParams<{ condominioId: string }>();
  const [info, setInfo] = useState<CondominioInfo | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Etapa 1
  const [etapa, setEtapa] = useState<1 | 2>(1);
  const [visitaId, setVisitaId] = useState<string | null>(null);
  const [supervisorNome, setSupervisorNome] = useState("");
  const [turno, setTurno] = useState<Turno | null>(null);
  const [enviandoInicio, setEnviandoInicio] = useState(false);

  // Etapa 2 — checklist Portaria (Diurno/Noturno)
  const [organizacaoPortaria, setOrganizacaoPortaria] = useState("");
  const [uniforme, setUniforme] = useState("");
  const [procedimentos, setProcedimentos] = useState("");
  const [duvidasColaboradores, setDuvidasColaboradores] = useState("");
  const [outros, setOutros] = useState("");

  // Etapa 2 — checklist Limpeza
  const [organizacaoEspacos, setOrganizacaoEspacos] = useState("");
  const [limpeza, setLimpeza] = useState("");
  const [materiais, setMateriais] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [enviandoChecklist, setEnviandoChecklist] = useState(false);
  const [concluida, setConcluida] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const assinaturaVazia = useRef(true);

  useEffect(() => {
    fetch(`${API_URL}/api/condominios/${condominioId}/publico`)
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setErro("Não foi possível carregar as informações deste condomínio."));
  }, [condominioId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1a1a1a";
  }, [etapa]);

  const posicaoRelativa = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const ponto = "touches" in e ? e.touches[0] : e;
    return { x: ponto.clientX - rect.left, y: ponto.clientY - rect.top };
  };

  const iniciarTraco = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    desenhando.current = true;
    const ctx = canvas.getContext("2d")!;
    const { x, y } = posicaoRelativa(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const desenhar = (e: React.MouseEvent | React.TouchEvent) => {
    if (!desenhando.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const { x, y } = posicaoRelativa(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
    assinaturaVazia.current = false;
  };

  const pararTraco = () => {
    desenhando.current = false;
  };

  const limparAssinatura = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    assinaturaVazia.current = true;
  };

  const podeIniciar = supervisorNome.trim().length > 0 && turno !== null && !enviandoInicio;

  const iniciarVisita = async () => {
    if (!podeIniciar) return;
    setEnviandoInicio(true);
    setErro(null);
    try {
      const resposta = await fetch(`${API_URL}/api/visitas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ condominioId, supervisorNome, turno }),
      });
      if (!resposta.ok) throw new Error();
      const dados = await resposta.json();
      setVisitaId(dados.id);
      setEtapa(2);
    } catch {
      setErro("Não foi possível iniciar a visita. Tente novamente.");
    } finally {
      setEnviandoInicio(false);
    }
  };

  const checklistPortariaCompleto =
    organizacaoPortaria.length > 0 && uniforme.length > 0 && procedimentos.length > 0;
  const checklistLimpezaCompleto = organizacaoEspacos.length > 0 && limpeza.length > 0 && materiais.length > 0;
  const podeConcluir =
    visitaId !== null &&
    !enviandoChecklist &&
    (turno === "LIMPEZA" ? checklistLimpezaCompleto : checklistPortariaCompleto);

  const concluirVisita = async () => {
    if (!podeConcluir || !visitaId) return;
    setEnviandoChecklist(true);
    setErro(null);
    try {
      const respostas =
        turno === "LIMPEZA"
          ? { organizacaoEspacos, limpeza, materiais, observacoes }
          : { organizacaoPortaria, uniforme, procedimentos, duvidasColaboradores, outros };

      const body: Record<string, unknown> = { respostas };
      if (!assinaturaVazia.current && canvasRef.current) {
        body.assinatura = canvasRef.current.toDataURL("image/png");
      }

      const resposta = await fetch(`${API_URL}/api/visitas/${visitaId}/concluir`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resposta.ok) throw new Error();
      setConcluida(true);
    } catch {
      setErro("Não foi possível concluir a visita. Tente novamente.");
    } finally {
      setEnviandoChecklist(false);
    }
  };

  if (concluida) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6 bg-[#0a0a0a]">
        <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-lg font-medium text-white" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
          Visita registrada
        </h1>
        <p className="text-sm text-white/50 mt-1 max-w-xs">Obrigado, {supervisorNome.split(" ")[0]}! Sua ronda foi registrada com sucesso.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#0a0a0a]">
      <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          {info?.condominioLogoUrl ? (
            <img src={info.condominioLogoUrl} alt="" className="w-9 h-9 rounded-lg object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-white/5" />
          )}
          <div>
            <p className="text-sm font-medium text-white leading-tight" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
              {info?.condominioNome ?? "Carregando..."}
            </p>
            <p className="text-xs text-white/50 leading-tight">Visita operacional</p>
          </div>
        </div>
        <img src={logoUlrik} alt="Ulrik" className="h-5 w-auto" />
      </header>

      {etapa === 1 ? (
        <div className="px-5 py-5 space-y-6">
          <section>
            <label className="text-sm font-medium text-white block mb-2">Seu nome</label>
            <input
              type="text"
              value={supervisorNome}
              onChange={(e) => setSupervisorNome(e.target.value)}
              placeholder="Nome completo"
              className="w-full h-10 rounded-lg border border-white/10 px-3 text-sm text-white bg-white/5 placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#FF3B3B]/25 focus:border-[#FF3B3B]/50"
            />
          </section>

          <section>
            <label className="text-sm font-medium text-white block mb-2">Turno</label>
            <div className="grid grid-cols-1 gap-2">
              {(["DIURNO", "NOTURNO", "LIMPEZA"] as Turno[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTurno(t)}
                  className={`h-10 rounded-lg text-sm font-medium border transition-colors ${
                    turno === t ? "border-[#FF3B3B] bg-[#FF3B3B] text-white" : "border-white/10 text-white/70"
                  }`}
                >
                  {t === "DIURNO" ? "Supervisão Diurna" : t === "NOTURNO" ? "Supervisão Noturna" : "Supervisão de Limpeza"}
                </button>
              ))}
            </div>
          </section>

          {erro && <p className="text-sm text-red-500">{erro}</p>}

          <button
            type="button"
            disabled={!podeIniciar}
            onClick={iniciarVisita}
            className="w-full h-12 rounded-full bg-[#FF3B3B] text-white text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ boxShadow: podeIniciar ? "0 12px 40px -6px rgba(255,59,59,0.45)" : "none" }}
          >
            {enviandoInicio ? "Iniciando..." : "Iniciar visita"}
          </button>
        </div>
      ) : (
        <div className="px-5 py-5 space-y-6">
          {turno === "LIMPEZA" ? (
            <>
              <CampoOpcoes label="Organização dos Espaços" opcoes={OPCOES_QUALIDADE} valor={organizacaoEspacos} onSelecionar={setOrganizacaoEspacos} />
              <CampoOpcoes label="Limpeza" opcoes={OPCOES_QUALIDADE} valor={limpeza} onSelecionar={setLimpeza} />
              <CampoOpcoes label="Materiais de Limpeza" opcoes={OPCOES_MATERIAIS} valor={materiais} onSelecionar={setMateriais} />
              <section>
                <label className="text-sm font-medium text-white block mb-2">
                  Observações <span className="text-white/40 font-normal">(opcional)</span>
                </label>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-white/10 px-3 py-2 text-sm text-white bg-white/5 placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#FF3B3B]/25 focus:border-[#FF3B3B]/50 resize-none"
                />
              </section>
            </>
          ) : (
            <>
              <CampoOpcoes label="Organização da Portaria" opcoes={OPCOES_QUALIDADE} valor={organizacaoPortaria} onSelecionar={setOrganizacaoPortaria} />
              <CampoOpcoes label="Uniforme" opcoes={OPCOES_CONFORMIDADE} valor={uniforme} onSelecionar={setUniforme} />
              <CampoOpcoes label="Procedimentos" opcoes={OPCOES_CONFORMIDADE} valor={procedimentos} onSelecionar={setProcedimentos} />
              <section>
                <label className="text-sm font-medium text-white block mb-2">
                  Dúvidas dos Colaboradores <span className="text-white/40 font-normal">(opcional)</span>
                </label>
                <textarea
                  value={duvidasColaboradores}
                  onChange={(e) => setDuvidasColaboradores(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-white/10 px-3 py-2 text-sm text-white bg-white/5 placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#FF3B3B]/25 focus:border-[#FF3B3B]/50 resize-none"
                />
              </section>
              <section>
                <label className="text-sm font-medium text-white block mb-2">
                  Outros <span className="text-white/40 font-normal">(opcional)</span>
                </label>
                <textarea
                  value={outros}
                  onChange={(e) => setOutros(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-white/10 px-3 py-2 text-sm text-white bg-white/5 placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#FF3B3B]/25 focus:border-[#FF3B3B]/50 resize-none"
                />
              </section>
            </>
          )}

          <section>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-white">
                Assinatura <span className="text-white/40 font-normal">(opcional)</span>
              </label>
              <button type="button" onClick={limparAssinatura} className="text-xs text-white/50">
                Limpar
              </button>
            </div>
            <canvas
              ref={canvasRef}
              width={343}
              height={140}
              className="w-full rounded-lg border border-white/10 touch-none bg-white/5"
              onMouseDown={iniciarTraco}
              onMouseMove={desenhar}
              onMouseUp={pararTraco}
              onMouseLeave={pararTraco}
              onTouchStart={iniciarTraco}
              onTouchMove={desenhar}
              onTouchEnd={pararTraco}
            />
          </section>

          {erro && <p className="text-sm text-red-500">{erro}</p>}

          <button
            type="button"
            disabled={!podeConcluir}
            onClick={concluirVisita}
            className="w-full h-12 rounded-full bg-[#FF3B3B] text-white text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ boxShadow: podeConcluir ? "0 12px 40px -6px rgba(255,59,59,0.45)" : "none" }}
          >
            {enviandoChecklist ? "Enviando..." : "Concluir visita"}
          </button>
        </div>
      )}
    </div>
  );
}
