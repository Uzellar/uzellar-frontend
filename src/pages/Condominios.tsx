import { useEffect, useState } from "react";
import { API_URL, authHeaders } from "../lib/api";
import NavAdmin from "../components/NavAdmin";
import { CORES, FONTES } from "../theme";

type TipoServico = "LIMPEZA" | "MANUTENCAO" | "PORTARIA" | "SEGURANCA";
const SERVICO_LABEL: Record<TipoServico, string> = {
  LIMPEZA: "Limpeza",
  MANUTENCAO: "Manutenção",
  PORTARIA: "Portaria",
  SEGURANCA: "Segurança",
};

interface Local {
  id: string;
  nome: string;
  descricao?: string;
  status: string;
}

interface Condominio {
  id: string;
  nome: string;
  endereco: string;
  qrCodeUrl?: string;
}

export default function Condominios() {
  const [condominios, setCondominios] = useState<Condominio[]>([]);
  const [condominioSelecionado, setCondominioSelecionado] = useState<string | null>(null);
  const [locais, setLocais] = useState<Local[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Formulário de novo condomínio
  const [mostrarFormCondominio, setMostrarFormCondominio] = useState(false);
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [endereco, setEndereco] = useState("");
  const [servicos, setServicos] = useState<TipoServico[]>(["LIMPEZA", "MANUTENCAO", "PORTARIA", "SEGURANCA"]);
  const [emailResponsavel, setEmailResponsavel] = useState("");
  const [salvandoCondominio, setSalvandoCondominio] = useState(false);

  // Formulário de novo local (ambiente)
  const [mostrarFormLocal, setMostrarFormLocal] = useState(false);
  const [nomeLocal, setNomeLocal] = useState("");
  const [salvandoLocal, setSalvandoLocal] = useState(false);

  const condominioAtual = condominios.find((c) => c.id === condominioSelecionado);

  const carregarCondominios = async () => {
    setCarregando(true);
    const resposta = await fetch(`${API_URL}/api/condominios`, { headers: authHeaders() });
    const lista = await resposta.json();
    setCondominios(lista);
    if (lista.length > 0 && !condominioSelecionado) setCondominioSelecionado(lista[0].id);
    setCarregando(false);
  };

  const carregarLocais = async (condominioId: string) => {
    const resposta = await fetch(`${API_URL}/api/condominios/${condominioId}/locais`, { headers: authHeaders() });
    setLocais(await resposta.json());
  };

  useEffect(() => {
    carregarCondominios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (condominioSelecionado) carregarLocais(condominioSelecionado);
  }, [condominioSelecionado]);

  const alternarServico = (s: TipoServico) => {
    setServicos((atual) => (atual.includes(s) ? atual.filter((x) => x !== s) : [...atual, s]));
  };

  const criarCondominio = async () => {
    if (!nome.trim() || !cnpj.trim() || !endereco.trim()) return;
    setSalvandoCondominio(true);
    try {
      await fetch(`${API_URL}/api/condominios`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          nome,
          cnpj,
          endereco,
          servicos,
          emailsResponsaveis: emailResponsavel ? [emailResponsavel] : undefined,
        }),
      });
      setNome("");
      setCnpj("");
      setEndereco("");
      setEmailResponsavel("");
      setMostrarFormCondominio(false);
      await carregarCondominios();
    } finally {
      setSalvandoCondominio(false);
    }
  };

  const criarLocal = async () => {
    if (!nomeLocal.trim() || !condominioSelecionado) return;
    setSalvandoLocal(true);
    try {
      await fetch(`${API_URL}/api/condominios/${condominioSelecionado}/locais`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ nome: nomeLocal }),
      });
      setNomeLocal("");
      setMostrarFormLocal(false);
      await carregarLocais(condominioSelecionado);
    } finally {
      setSalvandoLocal(false);
    }
  };

  const regenerarQrCode = async () => {
    if (!condominioSelecionado) return;
    await fetch(`${API_URL}/api/condominios/${condominioSelecionado}/qrcode/regenerar`, {
      method: "POST",
      headers: authHeaders(),
    });
    await carregarCondominios();
  };

  const excluirCondominio = async (id: string, nome: string) => {
    const confirmou = window.confirm(
      `Tem certeza que quer excluir o condomínio "${nome}"?\n\nO histórico de solicitações dele é mantido, mas ele deixa de aparecer no sistema e o QR Code para de funcionar.`,
    );
    if (!confirmou) return;

    await fetch(`${API_URL}/api/condominios/${id}`, { method: "DELETE", headers: authHeaders() });
    if (condominioSelecionado === id) setCondominioSelecionado(null);
    await carregarCondominios();
  };

  const excluirLocal = async (localId: string, nome: string) => {
    if (!condominioSelecionado) return;
    const confirmou = window.confirm(
      `Tem certeza que quer excluir o ambiente "${nome}"?\n\nEle deixa de aparecer no formulário do morador, mas as solicitações antigas registradas nele são mantidas.`,
    );
    if (!confirmou) return;

    await fetch(`${API_URL}/api/condominios/${condominioSelecionado}/locais/${localId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    await carregarLocais(condominioSelecionado);
  };

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", display: "flex" }}>
      <NavAdmin />

      <div style={{ flex: 1, padding: "2rem 1.5rem" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <p style={{ fontSize: 22, fontWeight: 900, color: CORES.texto, margin: 0, fontFamily: FONTES.titulo, letterSpacing: "-0.02em" }}>Condomínios</p>
          <button
            onClick={() => setMostrarFormCondominio((v) => !v)}
            style={{ height: 38, padding: "0 18px", borderRadius: 9999, background: CORES.vermelho, color: "#fff", border: "none", fontSize: 12, fontWeight: 600, boxShadow: "0 8px 24px -6px rgba(255,59,59,0.45)" }}
          >
            {mostrarFormCondominio ? "Cancelar" : "+ Novo condomínio"}
          </button>
        </div>

        {mostrarFormCondominio && (
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "1.1rem", marginBottom: 20 }}>
            <input
              placeholder="Nome do condomínio"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              style={{ width: "100%", height: 38, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", padding: "0 10px", fontSize: 13, marginBottom: 8, boxSizing: "border-box" }}
            />
            <input
              placeholder="CNPJ"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              style={{ width: "100%", height: 38, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", padding: "0 10px", fontSize: 13, marginBottom: 8, boxSizing: "border-box" }}
            />
            <input
              placeholder="Endereço"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              style={{ width: "100%", height: 38, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", padding: "0 10px", fontSize: 13, marginBottom: 8, boxSizing: "border-box" }}
            />
            <input
              placeholder="E-mail para receber avisos (opcional)"
              value={emailResponsavel}
              onChange={(e) => setEmailResponsavel(e.target.value)}
              style={{ width: "100%", height: 38, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", padding: "0 10px", fontSize: 13, marginBottom: 10, boxSizing: "border-box" }}
            />
            <p style={{ fontSize: 12, color: "#8a8a8a", margin: "0 0 6px" }}>Serviços contratados</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              {(Object.keys(SERVICO_LABEL) as TipoServico[]).map((s) => (
                <button
                  key={s}
                  onClick={() => alternarServico(s)}
                  style={{
                    fontSize: 12,
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: servicos.includes(s) ? "none" : "1px solid rgba(255,255,255,0.08)",
                    background: servicos.includes(s) ? "#FF3B3B" : "transparent",
                    color: servicos.includes(s) ? "#fff" : "#aaa",
                  }}
                >
                  {SERVICO_LABEL[s]}
                </button>
              ))}
            </div>
            <button
              onClick={criarCondominio}
              disabled={salvandoCondominio}
              style={{ width: "100%", height: 38, borderRadius: 9999, background: "#FF3B3B", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px -6px rgba(255,59,59,0.45)" }}
            >
              {salvandoCondominio ? "Criando..." : "Criar condomínio"}
            </button>
          </div>
        )}

        {carregando ? (
          <p style={{ fontSize: 13, color: "#8a8a8a" }}>Carregando...</p>
        ) : condominios.length === 0 ? (
          <p style={{ fontSize: 13, color: "#8a8a8a" }}>Nenhum condomínio cadastrado ainda.</p>
        ) : (
          <>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
              {condominios.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    borderRadius: 8,
                    border: condominioSelecionado === c.id ? "none" : "1px solid rgba(255,255,255,0.08)",
                    background: condominioSelecionado === c.id ? "#FF3B3B" : "transparent",
                    overflow: "hidden",
                  }}
                >
                  <button
                    onClick={() => setCondominioSelecionado(c.id)}
                    style={{
                      fontSize: 12,
                      padding: "7px 10px 7px 14px",
                      background: "transparent",
                      border: "none",
                      color: condominioSelecionado === c.id ? "#fff" : "#aaa",
                      cursor: "pointer",
                    }}
                  >
                    {c.nome}
                  </button>
                  <button
                    onClick={() => excluirCondominio(c.id, c.nome)}
                    title="Excluir condomínio"
                    style={{
                      fontSize: 13,
                      padding: "7px 12px 7px 4px",
                      background: "transparent",
                      border: "none",
                      color: condominioSelecionado === c.id ? "rgba(255,255,255,0.7)" : "#666",
                      cursor: "pointer",
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {/* QR Code único do condomínio */}
            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "1.1rem", marginBottom: 20, display: "flex", gap: 16, alignItems: "center" }}>
              {condominioAtual?.qrCodeUrl ? (
                <img src={condominioAtual.qrCodeUrl} alt="QR Code do condomínio" style={{ width: 110, height: 110, borderRadius: 8, background: "#fff" }} />
              ) : (
                <div style={{ width: 110, height: 110, borderRadius: 8, background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#666" }}>
                  Sem QR Code
                </div>
              )}
              <div>
                <p style={{ fontSize: 13, color: "#fff", fontWeight: 500, margin: "0 0 4px" }}>QR Code do condomínio</p>
                <p style={{ fontSize: 12, color: "#8a8a8a", margin: "0 0 12px", maxWidth: 320 }}>
                  Um único QR Code para todo o condomínio — pode ser impresso e colado em vários ambientes.
                  O morador escolhe o local na hora de preencher o formulário.
                </p>
                <div style={{ display: "flex", gap: 12 }}>
                  {condominioAtual?.qrCodeUrl && (
                    <a href={condominioAtual.qrCodeUrl} download={`qrcode-${condominioAtual.nome}.png`} style={{ fontSize: 12, color: "#FF3B3B", textDecoration: "none" }}>
                      Baixar
                    </a>
                  )}
                  <button onClick={regenerarQrCode} style={{ fontSize: 12, color: "#ccc", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    Gerar novamente
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 500, color: "#fff", margin: 0 }}>Ambientes</p>
                <p style={{ fontSize: 11, color: "#8a8a8a", margin: "2px 0 0" }}>
                  Opções que aparecem no formulário para o morador escolher
                </p>
              </div>
              <button
                onClick={() => setMostrarFormLocal((v) => !v)}
                style={{ height: 32, padding: "0 12px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#ccc", fontSize: 12 }}
              >
                {mostrarFormLocal ? "Cancelar" : "+ Novo ambiente"}
              </button>
            </div>

            {mostrarFormLocal && (
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <input
                  placeholder="Ex: Salão de Festas"
                  value={nomeLocal}
                  onChange={(e) => setNomeLocal(e.target.value)}
                  style={{ flex: 1, height: 38, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", padding: "0 10px", fontSize: 13 }}
                />
                <button
                  onClick={criarLocal}
                  disabled={salvandoLocal}
                  style={{ height: 38, padding: "0 16px", borderRadius: 9999, background: "#FF3B3B", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px -6px rgba(255,59,59,0.45)" }}
                >
                  {salvandoLocal ? "..." : "Criar"}
                </button>
              </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {locais.map((l) => (
                <span
                  key={l.id}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "7px 8px 7px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", color: "#ddd" }}
                >
                  {l.nome}
                  <button
                    onClick={() => excluirLocal(l.id, l.nome)}
                    title="Excluir ambiente"
                    style={{ fontSize: 13, background: "transparent", border: "none", color: "#666", cursor: "pointer", padding: "0 2px", lineHeight: 1 }}
                  >
                    ×
                  </button>
                </span>
              ))}
              {locais.length === 0 && <p style={{ fontSize: 12, color: "#666" }}>Nenhum ambiente cadastrado ainda.</p>}
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}
