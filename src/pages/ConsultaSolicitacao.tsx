import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { API_URL } from "../lib/api";

// Tela pública (sem login) onde o morador consulta o andamento da
// própria solicitação usando o código de protocolo recebido no
// envio. Acessível em /consulta ou /consulta/:protocolo.

type Status = "ABERTA" | "RECEBIDA" | "EM_ANDAMENTO" | "CONCLUIDA" | "CANCELADA";

interface EventoLinhaDoTempo {
  status: Status;
  data: string;
}

interface ResultadoConsulta {
  protocolo: string;
  condominio: string;
  local: string;
  tipo: string;
  status: Status;
  criadoEm: string;
  concluidaEm: string | null;
  linhaDoTempo: EventoLinhaDoTempo[];
}

const ETAPAS: { status: Status; label: string }[] = [
  { status: "ABERTA", label: "Aberta" },
  { status: "RECEBIDA", label: "Recebida" },
  { status: "EM_ANDAMENTO", label: "Em andamento" },
  { status: "CONCLUIDA", label: "Concluída" },
];

const TIPO_LABEL: Record<string, string> = {
  LIMPEZA: "Limpeza",
  MANUTENCAO: "Manutenção",
  PORTARIA: "Portaria",
  SEGURANCA: "Segurança",
};

function formatarData(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function ConsultaSolicitacao() {
  const { protocolo: protocoloDaUrl } = useParams<{ protocolo?: string }>();
  const protocoloInicial = protocoloDaUrl;
  const [protocolo, setProtocolo] = useState(protocoloInicial ?? "");
  const [resultado, setResultado] = useState<ResultadoConsulta | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const consultar = async (codigo: string) => {
    if (!codigo.trim()) return;
    setCarregando(true);
    setErro(null);
    setResultado(null);

    try {
      const resposta = await fetch(`${API_URL}/api/solicitacoes/protocolo/${encodeURIComponent(codigo.trim())}`);
      if (!resposta.ok) throw new Error();
      setResultado(await resposta.json());
    } catch {
      setErro("Protocolo não encontrado. Confira o código e tente novamente.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (protocoloInicial) consultar(protocoloInicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protocoloInicial]);

  const cancelada = resultado?.status === "CANCELADA";
  const etapaAtualIndex = resultado ? ETAPAS.findIndex((e) => e.status === resultado.status) : -1;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-white px-5 py-8">
      <h1 className="text-lg font-medium text-neutral-900 mb-1">Consultar solicitação</h1>
      <p className="text-sm text-neutral-500 mb-6">Digite o protocolo recebido ao registrar sua ocorrência.</p>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={protocolo}
          onChange={(e) => setProtocolo(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && consultar(protocolo)}
          placeholder="Ex: A3F9-7K2Q"
          className="flex-1 h-11 rounded-lg border border-neutral-200 px-3 text-sm tracking-wide text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300"
        />
        <button
          onClick={() => consultar(protocolo)}
          disabled={carregando}
          className="h-11 px-5 rounded-lg bg-neutral-900 text-white text-sm font-medium disabled:opacity-40"
        >
          {carregando ? "..." : "Buscar"}
        </button>
      </div>

      {erro && <p className="text-sm text-red-600 mb-4">{erro}</p>}

      {resultado && (
        <div className="border border-neutral-200 rounded-xl p-5">
          <p className="text-xs text-neutral-400 mb-1">{resultado.condominio}</p>
          <p className="text-sm font-medium text-neutral-900 mb-1">{resultado.local}</p>
          <p className="text-xs text-neutral-500 mb-5">
            {TIPO_LABEL[resultado.tipo] ?? resultado.tipo} · aberta em {formatarData(resultado.criadoEm)}
          </p>

          {cancelada ? (
            <div className="flex items-center gap-2 text-sm text-neutral-500 bg-neutral-50 rounded-lg px-3 py-2.5">
              <span className="w-2 h-2 rounded-full bg-neutral-400" />
              Esta solicitação foi cancelada.
            </div>
          ) : (
            <div className="flex items-center">
              {ETAPAS.map((etapa, i) => {
                const concluida = i <= etapaAtualIndex;
                const ativa = i === etapaAtualIndex;
                return (
                  <div key={etapa.status} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          concluida ? (ativa && etapa.status !== "CONCLUIDA" ? "bg-amber-500" : "bg-emerald-500") : "bg-neutral-200"
                        }`}
                      />
                      <span className={`text-[11px] text-center ${concluida ? "text-neutral-900" : "text-neutral-400"}`}>
                        {etapa.label}
                      </span>
                    </div>
                    {i < ETAPAS.length - 1 && (
                      <div className={`h-0.5 flex-1 mx-1 mb-4 ${i < etapaAtualIndex ? "bg-emerald-500" : "bg-neutral-200"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {resultado.concluidaEm && (
            <p className="text-xs text-neutral-500 mt-4">Concluída em {formatarData(resultado.concluidaEm)}</p>
          )}
        </div>
      )}
    </div>
  );
}
