import { useRef, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { API_URL } from "../lib/api";

// Tela aberta ao escanear o QR Code de um local. Sem login.
// `localId` vem da rota (/atender/:localId) e o backend já resolve
// condomínio + local a partir dele.

type TipoServico = "LIMPEZA" | "MANUTENCAO" | "PORTARIA" | "SEGURANCA";

interface LocalInfo {
  condominioNome: string;
  condominioLogoUrl?: string;
  localNome: string;
  servicosDisponiveis: TipoServico[];
}

const LABELS: Record<TipoServico, string> = {
  LIMPEZA: "Limpeza",
  MANUTENCAO: "Manutenção",
  PORTARIA: "Portaria",
  SEGURANCA: "Segurança",
};

export default function SolicitacaoForm() {
  const { localId } = useParams<{ localId: string }>();
  const [info, setInfo] = useState<LocalInfo | null>(null);
  const [tipo, setTipo] = useState<TipoServico | null>(null);
  const [descricao, setDescricao] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [contato, setContato] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [protocolo, setProtocolo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const assinaturaVazia = useRef(true);

  useEffect(() => {
    // Busca os dados do local (nome do condomínio, logo, serviços ativos)
    // para preencher o topo da tela automaticamente.
    fetch(`${API_URL}/api/locais/${localId}/publico`)
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setErro("Não foi possível carregar as informações deste local."));
  }, [localId]);

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

  const podeEnviar = tipo && descricao.trim().length > 0 && foto && !assinaturaVazia.current && !enviando;

  const enviar = async () => {
    if (!podeEnviar || !canvasRef.current) return;
    setEnviando(true);
    setErro(null);

    try {
      // Upload da foto e da assinatura ficam a cargo do backend
      // (endpoint aceita multipart e devolve as URLs finais).
      const formData = new FormData();
      formData.append("localId", localId!);
      formData.append("tipo", tipo!);
      formData.append("descricao", descricao);
      formData.append("foto", foto!);
      formData.append("assinatura", canvasRef.current.toDataURL("image/png"));

      // Heurística simples: se tem "@" é e-mail, senão trata como telefone.
      const contatoLimpo = contato.trim();
      if (contatoLimpo) {
        if (contatoLimpo.includes("@")) formData.append("moradorEmail", contatoLimpo);
        else formData.append("moradorTelefone", contatoLimpo);
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
            <p className="text-xs text-neutral-400 mb-1">Guarde seu protocolo para acompanhar</p>
            <p className="text-xl font-medium tracking-wide text-neutral-900 bg-neutral-50 border border-neutral-200 rounded-lg py-3">
              {protocolo}
            </p>
            <a
              href={`/consulta/${protocolo}`}
              className="inline-block mt-3 text-sm text-neutral-900 underline underline-offset-2"
            >
              Consultar andamento agora
            </a>
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
          <p className="text-xs text-neutral-500 leading-tight">{info?.localNome}</p>
        </div>
      </header>

      <div className="px-5 py-5 space-y-6">
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
          <label className="text-sm font-medium text-neutral-900 block mb-2">Foto do problema</label>
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
            <label className="text-sm font-medium text-neutral-900">Assinatura</label>
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

        <section>
          <label className="text-sm font-medium text-neutral-900 block mb-1">
            E-mail ou telefone <span className="text-neutral-400 font-normal">(opcional)</span>
          </label>
          <p className="text-xs text-neutral-500 mb-2">Deixe seu contato para receber um aviso quando for resolvido.</p>
          <input
            type="text"
            value={contato}
            onChange={(e) => setContato(e.target.value)}
            placeholder="seu@email.com ou (11) 99999-9999"
            className="w-full h-10 rounded-lg border border-neutral-200 px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300"
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
