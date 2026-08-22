import { useEffect, useState } from "react";
import { API_URL, authHeaders } from "../lib/api";
import NavAdmin from "../components/NavAdmin";
import { CORES, FONTES } from "../theme";

// Aba dedicada a relatórios — diferente da tela "Solicitações"
// (que também baixa PDF/Excel, mas com filtros), aqui é só clicar no
// condomínio e baixar o relatório completo dele, sem passos extras.

interface CondominioResumo {
  id: string;
  nome: string;
}

export default function Relatorios() {
  const [condominios, setCondominios] = useState<CondominioResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [baixando, setBaixando] = useState<string | null>(null); // "<condominioId>-pdf" ou "-excel"
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/condominios`, { headers: authHeaders() })
      .then((r) => r.json())
      .then(setCondominios)
      .finally(() => setCarregando(false));
  }, []);

  // Mesma técnica já usada na tela de Solicitações: os relatórios
  // exigem login (Authorization no cabeçalho), então baixamos via
  // fetch e criamos um arquivo temporário na hora, só no navegador.
  const baixar = async (condominioId: string, formato: "pdf" | "excel") => {
    const chave = `${condominioId}-${formato}`;
    setBaixando(chave);
    setErro(null);
    try {
      const resposta = await fetch(`${API_URL}/api/relatorios/${formato}?condominioId=${condominioId}`, {
        headers: authHeaders(),
      });
      if (!resposta.ok) throw new Error();
      const blob = await resposta.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-uzellar.${formato === "pdf" ? "pdf" : "xlsx"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setErro("Não foi possível gerar o relatório. Tente novamente.");
    } finally {
      setBaixando(null);
    }
  };

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", display: "flex" }}>
      <NavAdmin />

      <div style={{ flex: 1, padding: "2rem 1.5rem" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <p style={{ fontSize: 22, fontWeight: 900, color: CORES.texto, margin: 0, fontFamily: FONTES.titulo, letterSpacing: "-0.02em" }}>
            Relatórios
          </p>
          <p style={{ fontSize: 12, color: "#8a8a8a", margin: "4px 0 20px" }}>
            Clique num condomínio para baixar o relatório completo de solicitações (inclui fotos anexadas).
          </p>

          {erro && (
            <p style={{ fontSize: 12, color: "#ef4444", margin: "0 0 14px" }}>{erro}</p>
          )}

          {carregando ? (
            <p style={{ fontSize: 13, color: "#8a8a8a" }}>Carregando...</p>
          ) : condominios.length === 0 ? (
            <p style={{ fontSize: 13, color: "#8a8a8a" }}>Nenhum condomínio cadastrado ainda.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {condominios.map((c) => (
                <div
                  key={c.id}
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: 12,
                    padding: "1rem 1.1rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <p style={{ fontSize: 14, color: "#fff", fontWeight: 500, margin: 0 }}>{c.nome}</p>
                  <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                    <button
                      onClick={() => baixar(c.id, "pdf")}
                      disabled={baixando === `${c.id}-pdf`}
                      style={{
                        height: 34,
                        padding: "0 14px",
                        borderRadius: 8,
                        background: CORES.vermelho,
                        color: "#fff",
                        border: "none",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {baixando === `${c.id}-pdf` ? "Gerando..." : "Baixar PDF"}
                    </button>
                    <button
                      onClick={() => baixar(c.id, "excel")}
                      disabled={baixando === `${c.id}-excel`}
                      style={{
                        height: 34,
                        padding: "0 14px",
                        borderRadius: 8,
                        background: "rgba(255,255,255,0.06)",
                        color: "#fff",
                        border: "1px solid rgba(255,255,255,0.08)",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {baixando === `${c.id}-excel` ? "Gerando..." : "Baixar Excel"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
