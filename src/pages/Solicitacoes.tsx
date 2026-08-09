import { useEffect, useState } from "react";
import { API_URL, authHeaders } from "../lib/api";
import NavAdmin from "../components/NavAdmin";
import { CORES, FONTES } from "../theme";

type Status = "ABERTA" | "RECEBIDA" | "EM_ANDAMENTO" | "CONCLUIDA" | "CANCELADA";
type Tipo = "LIMPEZA" | "MANUTENCAO" | "PORTARIA" | "SEGURANCA";

const STATUS_LABEL: Record<Status, string> = {
  ABERTA: "Aberta",
  RECEBIDA: "Recebida",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

const STATUS_COR: Record<Status, string> = {
  ABERTA: "#999999",
  RECEBIDA: "#c96b1f",
  EM_ANDAMENTO: "#1f6fc9",
  CONCLUIDA: "#2c9e4a",
  CANCELADA: "#666666",
};

const TIPO_LABEL: Record<Tipo, string> = {
  LIMPEZA: "Limpeza",
  MANUTENCAO: "Manutenção",
  PORTARIA: "Portaria",
  SEGURANCA: "Segurança",
};

interface Solicitacao {
  id: string;
  protocolo: string;
  tipo: Tipo;
  descricao: string;
  status: Status;
  nomeMorador?: string;
  bloco?: string;
  apartamento?: string;
  fotoUrl?: string | null;
  assinaturaUrl?: string | null;
  criadoEm: string;
  concluidaEm?: string | null;
  local: { nome: string };
}

interface Condominio {
  id: string;
  nome: string;
}

export default function Solicitacoes() {
  const [condominios, setCondominios] = useState<Condominio[]>([]);
  const [condominioId, setCondominioId] = useState<string | null>(null);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<string>("");
  const [filtroTipo, setFiltroTipo] = useState<string>("");
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [baixando, setBaixando] = useState<"pdf" | "excel" | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/condominios`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((lista) => {
        setCondominios(lista);
        if (lista.length > 0) setCondominioId(lista[0].id);
      });
  }, []);

  const carregar = () => {
    if (!condominioId) return;
    setCarregando(true);
    const params = new URLSearchParams({ condominioId });
    if (filtroStatus) params.set("status", filtroStatus);
    if (filtroTipo) params.set("tipo", filtroTipo);
    fetch(`${API_URL}/api/solicitacoes?${params.toString()}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((lista) => {
        setSolicitacoes(lista);
        setCarregando(false);
      });
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condominioId, filtroStatus, filtroTipo]);

  const mudarStatus = async (id: string, novoStatus: Status) => {
    await fetch(`${API_URL}/api/solicitacoes/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ status: novoStatus }),
    });
    carregar();
  };

  // Os relatórios exigem login (Authorization no cabeçalho), então não
  // dá pra usar um link comum — baixamos via fetch e criamos um
  // arquivo temporário na hora, só no navegador.
  const baixarRelatorio = async (formato: "pdf" | "excel") => {
    if (!condominioId) return;
    setBaixando(formato);
    try {
      const params = new URLSearchParams({ condominioId });
      if (filtroStatus) params.set("status", filtroStatus);
      if (filtroTipo) params.set("tipo", filtroTipo);
      const resposta = await fetch(`${API_URL}/api/relatorios/${formato}?${params.toString()}`, {
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
      alert("Não foi possível gerar o relatório. Tente novamente.");
    } finally {
      setBaixando(null);
    }
  };

  return (
    <div style={{ background: CORES.fundo, minHeight: "100vh", display: "flex" }}>
      <NavAdmin />

      <div style={{ flex: 1, padding: "2.5rem 1.5rem" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <p style={{ fontSize: 26, fontWeight: 900, color: CORES.texto, margin: "0 0 4px", fontFamily: FONTES.titulo, letterSpacing: "-0.03em" }}>
            Solicitações
          </p>
          <p style={{ fontSize: 13, color: CORES.textoSecundario, margin: "0 0 24px", fontFamily: FONTES.corpo }}>
            Tudo que os moradores registraram, com filtros e relatórios
          </p>

          {/* Seletor de condomínio */}
          {condominios.length > 1 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
              {condominios.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCondominioId(c.id)}
                  style={{
                    fontSize: 12,
                    padding: "7px 14px",
                    borderRadius: 8,
                    border: condominioId === c.id ? "none" : "1px solid rgba(255,255,255,0.08)",
                    background: condominioId === c.id ? CORES.vermelho : "transparent",
                    color: condominioId === c.id ? "#fff" : "#aaa",
                  }}
                >
                  {c.nome}
                </button>
              ))}
            </div>
          )}

          {/* Filtros + relatórios */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              style={{ height: 36, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", padding: "0 10px", fontSize: 12 }}
            >
              <option value="">Todos os status</option>
              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>

            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              style={{ height: 36, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", padding: "0 10px", fontSize: 12 }}
            >
              <option value="">Todos os tipos</option>
              {(Object.keys(TIPO_LABEL) as Tipo[]).map((t) => (
                <option key={t} value={t}>
                  {TIPO_LABEL[t]}
                </option>
              ))}
            </select>

            <div style={{ flex: 1 }} />

            <button
              onClick={() => baixarRelatorio("pdf")}
              disabled={baixando !== null}
              style={{ height: 36, padding: "0 14px", borderRadius: 8, background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12, fontWeight: 600 }}
            >
              {baixando === "pdf" ? "Gerando..." : "Baixar PDF"}
            </button>
            <button
              onClick={() => baixarRelatorio("excel")}
              disabled={baixando !== null}
              style={{ height: 36, padding: "0 14px", borderRadius: 8, background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12, fontWeight: 600 }}
            >
              {baixando === "excel" ? "Gerando..." : "Baixar Excel"}
            </button>
          </div>

          {/* Lista */}
          {carregando ? (
            <p style={{ fontSize: 13, color: "#8a8a8a" }}>Carregando...</p>
          ) : solicitacoes.length === 0 ? (
            <p style={{ fontSize: 13, color: "#8a8a8a" }}>Nenhuma solicitação encontrada com esses filtros.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {solicitacoes.map((s) => {
                const expandido = expandidoId === s.id;
                return (
                  <div key={s.id} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, overflow: "hidden" }}>
                    <div
                      onClick={() => setExpandidoId(expandido ? null : s.id)}
                      style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", gap: 12 }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", color: "#fff", background: STATUS_COR[s.status], padding: "3px 8px", borderRadius: 6 }}>
                            {STATUS_LABEL[s.status]}
                          </span>
                          <span style={{ fontSize: 12, color: CORES.textoMuted }}>{s.protocolo}</span>
                        </div>
                        <p style={{ fontSize: 13, color: "#fff", margin: "0 0 2px", fontWeight: 500 }}>
                          {TIPO_LABEL[s.tipo]} · {s.local.nome}
                        </p>
                        <p style={{ fontSize: 12, color: CORES.textoMuted, margin: 0 }}>
                          {s.nomeMorador ?? "—"}
                          {s.bloco && ` · Bloco ${s.bloco}`}
                          {s.apartamento && ` · Apto ${s.apartamento}`}
                          {" · "}
                          {new Date(s.criadoEm).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <span style={{ fontSize: 18, color: CORES.textoMuted }}>{expandido ? "−" : "+"}</span>
                    </div>

                    {expandido && (
                      <div style={{ padding: "0 16px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <p style={{ fontSize: 13, color: "#ddd", margin: "14px 0" }}>{s.descricao}</p>

                        {(s.fotoUrl || s.assinaturaUrl) && (
                          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                            {s.fotoUrl && (
                              <a href={s.fotoUrl} target="_blank" rel="noreferrer">
                                <img src={s.fotoUrl} alt="Foto da ocorrência" style={{ width: 110, height: 110, objectFit: "cover", borderRadius: 8 }} />
                              </a>
                            )}
                            {s.assinaturaUrl && (
                              <a href={s.assinaturaUrl} target="_blank" rel="noreferrer">
                                <img src={s.assinaturaUrl} alt="Assinatura" style={{ width: 160, height: 80, objectFit: "contain", borderRadius: 8, background: "#fff" }} />
                              </a>
                            )}
                          </div>
                        )}

                        <div>
                          <label style={{ fontSize: 11, color: CORES.textoMuted, display: "block", marginBottom: 6 }}>Mudar status</label>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {(Object.keys(STATUS_LABEL) as Status[]).map((st) => (
                              <button
                                key={st}
                                onClick={() => mudarStatus(s.id, st)}
                                disabled={st === s.status}
                                style={{
                                  fontSize: 11,
                                  padding: "6px 10px",
                                  borderRadius: 6,
                                  border: st === s.status ? "none" : "1px solid rgba(255,255,255,0.1)",
                                  background: st === s.status ? STATUS_COR[st] : "transparent",
                                  color: st === s.status ? "#fff" : "#aaa",
                                  cursor: st === s.status ? "default" : "pointer",
                                }}
                              >
                                {STATUS_LABEL[st]}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
