import { useRef, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { API_URL } from "../lib/api";

// Tela aberta ao escanear o QR Code do CONDOMÍNIO (um só QR Code
// serve para todos os ambientes). `condominioId` vem da rota
// (/atender/:condominioId). O morador escolhe o ambiente (local) e se
// identifica (nome, bloco, apartamento) diretamente no formulário.

type TipoServico = "LIMPEZA" | "MANUTENCAO" | "PORTARIA" | "SEGURANCA";

interface LocalOpcao {
  id: string;
  nome: string;
}

interface CondominioInfo {
  condominioNome: string;
  condominioLogoUrl?: string;
  servicosDisponiveis: TipoServico[];
  locais: LocalOpcao[];
}

const LABELS: Record<TipoServico, string> = {
  LIMPEZA: "Limpeza",
  MANUTENCAO: "Manutenção",
  PORTARIA: "Portaria",
  SEGURANCA: "Segurança",
};

export default function SolicitacaoForm() {
  const { condominioId } = useParams<{ condominioId: string }>();
  const [info, setInfo] = useState<CondominioInfo | null>(null);

  const [nomeMorador, setNomeMorador] = useState("");
  const [bloco, setBloco] = useState("");
  const [apartamento, setApartamento] = useState("");
  const [localId, setLocalId] = useState<string>("");
  const [tipo, setTipo] = useState<TipoServico | null>(null);
  const [descricao, setDescricao] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [protocolo, setProtocolo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const assinaturaVazia = useRef(true);

  useEffect(() => {
    // Busca os dados do condomínio (nome, logo, serviços ativos e a
    // lista de ambientes) para preencher o formulário automaticamente.
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
  }, []);

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

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0] ?? null;
    setFoto(arquivo);
    setFotoPreview(arquivo ? URL.createObjectURL(arquivo) : null);
  };

  const podeEnviar =
    nomeMorador.trim().length > 0 &&
    bloco.trim().length > 0 &&
    apartamento.trim().length > 0 &&
    localId &&
    tipo &&
    descricao.trim().length > 0 &&
    !enviando;

  const enviar = async () => {
    if (!podeEnviar) return;
    setEnviando(true);
    setErro(null);

    try {
      // Foto e assinatura são opcionais — só entram no envio se o
      // morador realmente preencheu.
      const formData = new FormData();
      formData.append("localId", localId);
      formData.append("tipo", tipo!);
      formData.append("descricao", descricao);
      formData.append("nomeMorador", nomeMorador);
      formData.append("bloco", bloco);
      formData.append("apartamento", apartamento);
      if (foto) formData.append("foto", foto);
      if (!assinaturaVazia.current && canvasRef.current) {
        formData.append("assinatura", canvasRef.current.toDataURL("image/png"));
      }

      const resposta = await fetch(`${API_URL}/api/solicitacoes`, { method: "POST", body: formData });
      if (!resposta.ok) throw new Error();
      const dados = await resposta.json();
      setProtocolo(dados.protocolo);
      setEnviado(true);
    } catch {
      setErro("Não foi possível enviar sua solicitação. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  if (enviado) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6">
        <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-lg font-medium text-neutral-900">Solicitação enviada</h1>
        <p className="text-sm text-neutral-500 mt-1 max-w-xs">
          A equipe responsável já foi notificada e vai atender o mais breve possível.
        </p>

        {protocolo && (
          <div className="mt-6 w-full max-w-xs">
            <p className="text-xs text-neutral-400 mb-1">Protocolo da sua solicitação</p>
            <p className="text-xl font-medium tracking-wide text-neutral-900 bg-neutral-50 border border-neutral-200 rounded-lg py-3">
              {protocolo}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-white">
      <header className="flex items-center gap-3 px-5 py-4 border-b border-neutral-100">
        {info?.condominioLogoUrl ? (
          <img src={info.condominioLogoUrl} alt="" className="w-9 h-9 rounded-lg object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-neutral-100" />
        )}
        <div>
          <p className="text-sm font-medium text-neutral-900 leading-tight">
            {info?.condominioNome ?? "Carregando..."}
          </p>
          <p className="text-xs text-neutral-500 leading-tight">Registrar solicitação</p>
        </div>
      </header>

      <div className="px-5 py-5 space-y-6">
        <section>
          <label className="text-sm font-medium text-neutral-900 block mb-2">Seu nome</label>
          <input
            type="text"
            value={nomeMorador}
            onChange={(e) => setNomeMorador(e.target.value)}
            placeholder="Nome completo"
            className="w-full h-10 rounded-lg border border-neutral-200 px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300"
          />
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-neutral-900 block mb-2">Bloco</label>
            <input
              type="text"
              value={bloco}
              onChange={(e) => setBloco(e.target.value)}
              placeholder="Ex: A"
              className="w-full h-10 rounded-lg border border-neutral-200 px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-900 block mb-2">Apartamento</label>
            <input
              type="text"
              value={apartamento}
              onChange={(e) => setApartamento(e.target.value)}
              placeholder="Ex: 302"
              className="w-full h-10 rounded-lg border border-neutral-200 px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300"
            />
          </div>
        </section>

        <section>
          <label className="text-sm font-medium text-neutral-900 block mb-2">Local que precisa de atenção</label>
          <select
            value={localId}
            onChange={(e) => setLocalId(e.target.value)}
            className="w-full h-10 rounded-lg border border-neutral-200 px-3 text-sm text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300"
          >
            <option value="">Selecione...</option>
            {(info?.locais ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>
        </section>

        <section>
          <label className="text-sm font-medium text-neutral-900 block mb-2">Tipo de solicitação</label>
          <div className="grid grid-cols-2 gap-2">
            {(info?.servicosDisponiveis ?? ["LIMPEZA", "MANUTENCAO", "PORTARIA", "SEGURANCA"]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setTipo(s)}
                className={`h-10 rounded-lg text-sm font-medium border transition-colors ${
                  tipo === s
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 text-neutral-700"
                }`}
              >
                {LABELS[s]}
              </button>
            ))}
          </div>
        </section>

        <section>
          <label className="text-sm font-medium text-neutral-900 block mb-2">Descrição da ocorrência</label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descreva o que está acontecendo"
            rows={4}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300 resize-none"
          />
        </section>

        <section>
          <label className="text-sm font-medium text-neutral-900 block mb-2">
            Foto do problema <span className="text-neutral-400 font-normal">(opcional)</span>
          </label>
          {fotoPreview ? (
            <div className="relative">
              <img src={fotoPreview} alt="Prévia" className="w-full h-40 object-cover rounded-lg" />
              <button
                type="button"
                onClick={() => {
                  setFoto(null);
                  setFotoPreview(null);
                }}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 text-neutral-700 text-sm flex items-center justify-center border border-neutral-200"
              >
                ✕
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center h-32 rounded-lg border-2 border-dashed border-neutral-200 text-neutral-400 text-sm cursor-pointer">
              Toque para tirar ou anexar uma foto
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFoto} />
            </label>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-neutral-900">
              Assinatura <span className="text-neutral-400 font-normal">(opcional)</span>
            </label>
            <button type="button" onClick={limparAssinatura} className="text-xs text-neutral-500">
              Limpar
            </button>
          </div>
          <canvas
            ref={canvasRef}
            width={343}
            height={140}
            className="w-full rounded-lg border border-neutral-200 touch-none bg-neutral-50"
            onMouseDown={iniciarTraco}
            onMouseMove={desenhar}
            onMouseUp={pararTraco}
            onMouseLeave={pararTraco}
            onTouchStart={iniciarTraco}
            onTouchMove={desenhar}
            onTouchEnd={pararTraco}
          />
        </section>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <button
          type="button"
          disabled={!podeEnviar}
          onClick={enviar}
          className="w-full h-11 rounded-lg bg-neutral-900 text-white text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {enviando ? "Enviando..." : "Enviar solicitação"}
        </button>
      </div>
    </div>
  );
}
