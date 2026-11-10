import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// Aviso "Você tem uma visita em andamento" (10/11/2026): procura neste
// aparelho as visitas salvas pelo VisitaForm (chave
// uzellar_visita_andamento_<condominioId>, validade 12 h) e mostra um
// botão para continuar sem precisar ler o QR Code de novo.

const PREFIXO = "uzellar_visita_andamento_";
const VALIDADE_MS = 12 * 60 * 60 * 1000;

interface VisitaPendente {
  condominioId: string;
  condominioNome?: string;
  iniciadaEm: number;
}

function buscarPendentes(): VisitaPendente[] {
  const lista: VisitaPendente[] = [];
  try {
    const nomeLogado = (localStorage.getItem("uzellar_nome") ?? "").trim().toLowerCase();
    for (let i = 0; i < localStorage.length; i++) {
      const chave = localStorage.key(i);
      if (!chave || !chave.startsWith(PREFIXO)) continue;
      try {
        const salva = JSON.parse(localStorage.getItem(chave) ?? "null");
        if (!salva?.visitaId || !salva.iniciadaEm || Date.now() - salva.iniciadaEm > VALIDADE_MS) continue;
        // Visita de outra pessoa que usou este aparelho: não mostra.
        if (nomeLogado && String(salva.supervisorNome ?? "").trim().toLowerCase() !== nomeLogado) continue;
        lista.push({ condominioId: chave.slice(PREFIXO.length), condominioNome: salva.condominioNome, iniciadaEm: salva.iniciadaEm });
      } catch {
        // rascunho corrompido: ignora
      }
    }
  } catch {
    // sem armazenamento disponível
  }
  return lista.sort((a, b) => b.iniciadaEm - a.iniciadaEm);
}

export default function AvisoVisitaAndamento() {
  const navigate = useNavigate();
  const [pendentes, setPendentes] = useState<VisitaPendente[]>([]);

  useEffect(() => {
    setPendentes(buscarPendentes());
  }, []);

  if (pendentes.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
      {pendentes.map((v) => (
        <div
          key={v.condominioId}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
            padding: "12px 14px",
            borderRadius: 12,
            background: "rgba(251,191,36,0.10)",
            border: "1px solid rgba(251,191,36,0.35)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#fbbf24" }}>Você tem uma visita em andamento</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#d4d4d4" }}>
              {v.condominioNome ?? "Condomínio"} · iniciada às{" "}
              {new Date(v.iniciadaEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/visita/${v.condominioId}`)}
            style={{ height: 36, padding: "0 16px", borderRadius: 8, background: "#FF3B3B", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Continuar visita
          </button>
        </div>
      ))}
    </div>
  );
}
