import { useEffect, useState } from "react";
import { API_URL, authHeaders } from "../lib/api";
import NavAdmin from "../components/NavAdmin";
import { CORES, FONTES } from "../theme";

// Aba separada de propósito da tela de "Condomínios" — aqui só vive
// o que pertence ao fluxo de VISITA OPERACIONAL (supervisão): QR
// Code próprio e telefones de aviso próprios, nunca misturados com
// o fluxo de Limpeza.

interface CondominioResumo {
  id: string;
  nome: string;
}

interface CondominioDetalhado {
  id: string;
  nome: string;
  qrCodeVisitaUrl?: string;
}

interface TelefoneVisita {
  id: string;
  numero: string;
}

export default function VisitasOperacionaisAdmin() {
  const [condominios, setCondominios] = useState<CondominioResumo[]>([]);
  const [condominioSelecionado, setCondominioSelecionado] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<CondominioDetalhado | null>(null);
  const [telefones, setTelefones] = useState<TelefoneVisita[]>([]);
  const [novoTelefone, setNovoTelefone] = useState("");
  const [salvandoTelefone, setSalvandoTelefone] = useState(false);
  const [erroTelefone, setErroTelefone] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregarCondominios = async () => {
    setCarregando(true);
    const resposta = await fetch(`${API_URL}/api/condominios`, { headers: authHeaders() });
    const lista = await resposta.json();
    setCondominios(lista);
    if (lista.length > 0 && !condominioSelecionado) setCondominioSelecionado(lista[0].id);
    setCarregando(false);
  };

  const carregarDetalhe = async (condominioId: string) => {
    const resposta = await fetch(`${API_URL}/api/condominios/${condominioId}`, { headers: authHeaders() });
    const dados = await resposta.json();
    setDetalhe(dados);
    setTelefones(dados.telefonesVisita ?? []);
  };

  useEffect(() => {
    carregarCondominios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (condominioSelecionado) carregarDetalhe(condominioSelecionado);
  }, [condominioSelecionado]);

  const regenerarQrCodeVisita = async () => {
    if (!condominioSelecionado) return;
    await fetch(`${API_URL}/api/condominios/${condominioSelecionado}/qrcode-visita/regenerar`, {
      method: "POST",
      headers: authHeaders(),
    });
    await carregarDetalhe(condominioSelecionado);
  };

  const adicionarTelefone = async () => {
    if (!novoTelefone.trim() || !condominioSelecionado) return;
    setSalvandoTelefone(true);
    setErroTelefone(null);
    try {
      const resposta = await fetch(`${API_URL}/api/condominios/${condominioSelecionado}/telefones-visita`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ numero: novoTelefone.trim() }),
      });
      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => null);
        setErroTelefone(dados?.message ?? "Não foi possível adicionar esse telefone.");
        return;
      }
      setNovoTelefone("");
      await carregarDetalhe(condominioSelecionado);
    } finally {
      setSalvandoTelefone(false);
    }
  };

  const removerTelefone = async (telefoneId: string) => {
    if (!condominioSelecionado) return;
    await fetch(`${API_URL}/api/condominios/telefones-visita/${telefoneId}`, { method: "DELETE", headers: authHeaders() });
    await carregarDetalhe(condominioSelecionado);
  };

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", display: "flex" }}>
      <NavAdmin />

      <div style={{ flex: 1, padding: "2rem 1.5rem" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <p style={{ fontSize: 22, fontWeight: 900, color: CORES.texto, margin: 0, fontFamily: FONTES.titulo, letterSpacing: "-0.02em" }}>
                Visita Operacional
              </p>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#60a5fa", background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.3)", borderRadius: 999, padding: "3px 10px" }}>
                👷 Supervisão
              </span>
            </div>
            <p style={{ fontSize: 12, color: "#8a8a8a", margin: "4px 0 0" }}>
              QR Code e telefones de aviso do fluxo de rondas do supervisor — separado do fluxo de Limpeza.
            </p>
          </div>

          {carregando ? (
            <p style={{ fontSize: 13, color: "#8a8a8a" }}>Carregando...</p>
          ) : condominios.length === 0 ? (
            <p style={{ fontSize: 13, color: "#8a8a8a" }}>Nenhum condomínio cadastrado ainda — crie um na aba "Condomínios".</p>
          ) : (
            <>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
                {condominios.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCondominioSelecionado(c.id)}
                    style={{
                      fontSize: 12,
                      padding: "7px 14px",
                      borderRadius: 8,
                      border: condominioSelecionado === c.id ? "none" : "1px solid rgba(255,255,255,0.08)",
                      background: condominioSelecionado === c.id ? "#FF3B3B" : "transparent",
                      color: condominioSelecionado === c.id ? "#fff" : "#aaa",
                      cursor: "pointer",
                    }}
                  >
                    {c.nome}
                  </button>
                ))}
              </div>

              {/* QR Code de visita operacional — próprio dessa aba, nunca o mesmo da Limpeza */}
              <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "1.1rem", marginBottom: 20, display: "flex", gap: 16, alignItems: "center" }}>
                {detalhe?.qrCodeVisitaUrl ? (
                  <img src={detalhe.qrCodeVisitaUrl} alt="QR Code de visita operacional" style={{ width: 110, height: 110, borderRadius: 8, background: "#fff" }} />
                ) : (
                  <div style={{ width: 110, height: 110, borderRadius: 8, background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#666" }}>
                    Sem QR Code
                  </div>
                )}
                <div>
                  <p style={{ fontSize: 13, color: "#fff", fontWeight: 500, margin: "0 0 4px" }}>QR Code de visita operacional</p>
                  <p style={{ fontSize: 12, color: "#8a8a8a", margin: "0 0 12px", maxWidth: 320 }}>
                    Usado pelo supervisor pra registrar o início de uma ronda — diferente do QR Code do morador (Limpeza).
                  </p>
                  <div style={{ display: "flex", gap: 12 }}>
                    {detalhe?.qrCodeVisitaUrl && (
                      <a href={detalhe.qrCodeVisitaUrl} download={`qrcode-visita-${detalhe.nome}.png`} style={{ fontSize: 12, color: "#FF3B3B", textDecoration: "none" }}>
                        Baixar
                      </a>
                    )}
                    <button onClick={regenerarQrCodeVisita} style={{ fontSize: 12, color: "#ccc", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      Gerar novamente
                    </button>
                  </div>
                </div>
              </div>

              {/* Telefones de aviso — próprios dessa aba, nunca os mesmos da Limpeza */}
              <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "1.1rem" }}>
                <p style={{ fontSize: 13, color: "#fff", fontWeight: 500, margin: "0 0 4px" }}>Telefones de aviso — WhatsApp (Supervisão)</p>
                <p style={{ fontSize: 12, color: "#8a8a8a", margin: "0 0 12px" }}>
                  Recebem uma mensagem de WhatsApp quando uma visita operacional é iniciada. Precisam ser diferentes dos telefones cadastrados na aba "Condomínios" (Limpeza).
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: telefones.length > 0 ? 12 : 0 }}>
                  {telefones.map((t) => (
                    <span
                      key={t.id}
                      style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "6px 6px 6px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", color: "#ddd" }}
                    >
                      {t.numero}
                      <button
                        onClick={() => removerTelefone(t.id)}
                        title="Remover telefone"
                        style={{ fontSize: 13, background: "transparent", border: "none", color: "#666", cursor: "pointer", padding: "0 2px", lineHeight: 1 }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    placeholder="11999999999 (DDD + número)"
                    value={novoTelefone}
                    onChange={(e) => setNovoTelefone(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && adicionarTelefone()}
                    style={{ flex: 1, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", padding: "0 10px", fontSize: 13 }}
                  />
                  <button
                    onClick={adicionarTelefone}
                    disabled={salvandoTelefone}
                    style={{ height: 36, padding: "0 14px", borderRadius: 8, background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12, fontWeight: 600 }}
                  >
                    {salvandoTelefone ? "..." : "Adicionar"}
                  </button>
                </div>
                {erroTelefone && <p style={{ fontSize: 12, color: "#ef4444", margin: "10px 0 0" }}>{erroTelefone}</p>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
