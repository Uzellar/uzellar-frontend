import { useEffect, useState } from "react";
import { API_URL, authHeaders } from "../lib/api";
import NavAdmin from "../components/NavAdmin";

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
  qrCodeUrl?: string;
  status: string;
}

interface Condominio {
  id: string;
  nome: string;
  endereco: string;
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

  // Formulário de novo local
  const [mostrarFormLocal, setMostrarFormLocal] = useState(false);
  const [nomeLocal, setNomeLocal] = useState("");
  const [salvandoLocal, setSalvandoLocal] = useState(false);

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

  return (
    <div style={{ background: "#141414", minHeight: "100vh" }}>
      <NavAdmin />

      <div style={{ padding: "2rem 1.5rem", maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <p style={{ fontSize: 18, fontWeight: 500, color: "#fff", margin: 0 }}>Condomínios</p>
          <button
            onClick={() => setMostrarFormCondominio((v) => !v)}
            style={{ height: 36, padding: "0 14px", borderRadius: 8, background: "#EE312D", color: "#fff", border: "none", fontSize: 12, fontWeight: 500 }}
          >
            {mostrarFormCondominio ? "Cancelar" : "+ Novo condomínio"}
          </button>
        </div>

        {mostrarFormCondominio && (
          <div style={{ background: "#1c1c1c", borderRadius: 12, padding: "1.1rem", marginBottom: 20 }}>
            <input
              placeholder="Nome do condomínio"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              style={{ width: "100%", height: 38, borderRadius: 8, background: "#262626", border: "0.5px solid #333", color: "#fff", padding: "0 10px", fontSize: 13, marginBottom: 8, boxSizing: "border-box" }}
            />
            <input
              placeholder="CNPJ"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              style={{ width: "100%", height: 38, borderRadius: 8, background: "#262626", border: "0.5px solid #333", color: "#fff", padding: "0 10px", fontSize: 13, marginBottom: 8, boxSizing: "border-box" }}
            />
            <input
              placeholder="Endereço"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              style={{ width: "100%", height: 38, borderRadius: 8, background: "#262626", border: "0.5px solid #333", color: "#fff", padding: "0 10px", fontSize: 13, marginBottom: 8, boxSizing: "border-box" }}
            />
            <input
              placeholder="E-mail para receber avisos (opcional)"
              value={emailResponsavel}
              onChange={(e) => setEmailResponsavel(e.target.value)}
              style={{ width: "100%", height: 38, borderRadius: 8, background: "#262626", border: "0.5px solid #333", color: "#fff", padding: "0 10px", fontSize: 13, marginBottom: 10, boxSizing: "border-box" }}
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
                    border: servicos.includes(s) ? "none" : "0.5px solid #333",
                    background: servicos.includes(s) ? "#EE312D" : "transparent",
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
              style={{ width: "100%", height: 38, borderRadius: 8, background: "#EE312D", color: "#fff", border: "none", fontSize: 13, fontWeight: 500 }}
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
                <button
                  key={c.id}
                  onClick={() => setCondominioSelecionado(c.id)}
                  style={{
                    fontSize: 12,
                    padding: "7px 14px",
                    borderRadius: 8,
                    border: condominioSelecionado === c.id ? "none" : "0.5px solid #333",
                    background: condominioSelecionado === c.id ? "#EE312D" : "transparent",
                    color: condominioSelecionado === c.id ? "#fff" : "#aaa",
                  }}
                >
                  {c.nome}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <p style={{ fontSize: 15, fontWeight: 500, color: "#fff", margin: 0 }}>Locais e QR Codes</p>
              <button
                onClick={() => setMostrarFormLocal((v) => !v)}
                style={{ height: 32, padding: "0 12px", borderRadius: 8, background: "transparent", border: "0.5px solid #333", color: "#ccc", fontSize: 12 }}
              >
                {mostrarFormLocal ? "Cancelar" : "+ Novo local"}
              </button>
            </div>

            {mostrarFormLocal && (
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <input
                  placeholder="Ex: Hall Torre A"
                  value={nomeLocal}
                  onChange={(e) => setNomeLocal(e.target.value)}
                  style={{ flex: 1, height: 38, borderRadius: 8, background: "#1c1c1c", border: "0.5px solid #333", color: "#fff", padding: "0 10px", fontSize: 13 }}
                />
                <button
                  onClick={criarLocal}
                  disabled={salvandoLocal}
                  style={{ height: 38, padding: "0 16px", borderRadius: 8, background: "#EE312D", color: "#fff", border: "none", fontSize: 13, fontWeight: 500 }}
                >
                  {salvandoLocal ? "..." : "Criar"}
                </button>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
              {locais.map((l) => (
                <div key={l.id} style={{ background: "#1c1c1c", borderRadius: 10, padding: "12px", textAlign: "center" }}>
                  {l.qrCodeUrl ? (
                    <img src={l.qrCodeUrl} alt={`QR Code de ${l.nome}`} style={{ width: "100%", borderRadius: 6, marginBottom: 8, background: "#fff" }} />
                  ) : (
                    <div style={{ width: "100%", aspectRatio: "1", background: "#262626", borderRadius: 6, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#666" }}>
                      Gerando...
                    </div>
                  )}
                  <p style={{ fontSize: 12, color: "#fff", margin: "0 0 6px", fontWeight: 500 }}>{l.nome}</p>
                  {l.qrCodeUrl && (
                    <a href={l.qrCodeUrl} download={`qrcode-${l.nome}.png`} style={{ fontSize: 11, color: "#EE312D", textDecoration: "none" }}>
                      Baixar
                    </a>
                  )}
                </div>
              ))}
              {locais.length === 0 && <p style={{ fontSize: 12, color: "#666" }}>Nenhum local cadastrado ainda.</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
