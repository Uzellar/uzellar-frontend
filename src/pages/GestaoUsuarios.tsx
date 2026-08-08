import { useEffect, useState } from "react";
import { API_URL, authHeaders } from "../lib/api";
import NavAdmin from "../components/NavAdmin";

// Tela administrativa — só o Administrador Master enxerga essa opção
// no menu. Lista os logins existentes e permite criar novos,
// escolhendo o perfil e os condomínios que cada pessoa pode acessar.

type Perfil = "ADMIN_MASTER" | "ADMIN_CONDOMINIO" | "SUPERVISOR" | "FUNCIONARIO" | "VISUALIZADOR";

const PERFIL_LABEL: Record<Perfil, string> = {
  ADMIN_MASTER: "Administrador master",
  ADMIN_CONDOMINIO: "Administrador do condomínio",
  SUPERVISOR: "Supervisor",
  FUNCIONARIO: "Funcionário",
  VISUALIZADOR: "Visualizador",
};

interface Condominio {
  id: string;
  nome: string;
}

interface Usuario {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  perfil: Perfil;
  ativo: boolean;
  condominios: { condominio: Condominio }[];
}

export default function GestaoUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [condominios, setCondominios] = useState<Condominio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [perfil, setPerfil] = useState<Perfil>("VISUALIZADOR");
  const [condominioIds, setCondominioIds] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const token = localStorage.getItem("uzellar_token"); // token JWT de quem está logado

  const carregar = async () => {
    setCarregando(true);
    const [resUsuarios, resCondominios] = await Promise.all([
      fetch(`${API_URL}/api/usuarios`, { headers: authHeaders() }),
      fetch(`${API_URL}/api/condominios`, { headers: authHeaders() }),
    ]);
    setUsuarios(await resUsuarios.json());
    setCondominios(await resCondominios.json());
    setCarregando(false);
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const precisaCondominio = perfil !== "ADMIN_MASTER";
  const podeSalvar = nome.trim() && email.trim() && senha.length >= 8 && (!precisaCondominio || condominioIds.length > 0);

  const criarUsuario = async () => {
    if (!podeSalvar) return;
    setSalvando(true);
    setErro(null);
    try {
      const resposta = await fetch(`${API_URL}/api/usuarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ nome, email, telefone: telefone || undefined, senha, perfil, condominioIds: precisaCondominio ? condominioIds : undefined }),
      });
      if (!resposta.ok) {
        const dados = await resposta.json();
        throw new Error(dados.message ?? "Não foi possível criar o usuário.");
      }
      setNome("");
      setEmail("");
      setTelefone("");
      setSenha("");
      setPerfil("VISUALIZADOR");
      setCondominioIds([]);
      setMostrarForm(false);
      await carregar();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const alternarCondominio = (id: string) => {
    setCondominioIds((atual) => (atual.includes(id) ? atual.filter((c) => c !== id) : [...atual, id]));
  };

  const desativarUsuario = async (id: string) => {
    await fetch(`${API_URL}/api/usuarios/${id}`, { method: "DELETE", headers: authHeaders() });
    await carregar();
  };

  return (
    <div style={{ background: "#141414", minHeight: "100vh", color: "#fff" }}>
      <NavAdmin />
      <div style={{ padding: "2rem 1.5rem" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <p style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>Usuários</p>
            <p style={{ fontSize: 13, color: "#8a8a8a", margin: "2px 0 0" }}>Quem tem acesso ao painel do Uzellar</p>
          </div>
          <button
            onClick={() => setMostrarForm((v) => !v)}
            style={{ height: 38, padding: "0 16px", borderRadius: 8, background: "#EE312D", color: "#fff", border: "none", fontSize: 13, fontWeight: 500 }}
          >
            {mostrarForm ? "Cancelar" : "+ Novo usuário"}
          </button>
        </div>

        {mostrarForm && (
          <div style={{ background: "#1c1c1c", borderRadius: 12, padding: "1.25rem", marginBottom: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <input
                placeholder="Nome completo"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                style={{ height: 38, borderRadius: 8, background: "#262626", border: "0.5px solid #333", color: "#fff", padding: "0 10px", fontSize: 13 }}
              />
              <input
                placeholder="E-mail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ height: 38, borderRadius: 8, background: "#262626", border: "0.5px solid #333", color: "#fff", padding: "0 10px", fontSize: 13 }}
              />
            </div>
            <input
              placeholder="Telefone com DDD (ex: 11999999999) — para avisos por WhatsApp"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              style={{ width: "100%", height: 38, borderRadius: 8, background: "#262626", border: "0.5px solid #333", color: "#fff", padding: "0 10px", fontSize: 13, marginBottom: 10, boxSizing: "border-box" }}
            />
            <input
              placeholder="Senha provisória (mín. 8 caracteres)"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              style={{ width: "100%", height: 38, borderRadius: 8, background: "#262626", border: "0.5px solid #333", color: "#fff", padding: "0 10px", fontSize: 13, marginBottom: 10, boxSizing: "border-box" }}
            />

            <p style={{ fontSize: 12, color: "#8a8a8a", margin: "0 0 6px" }}>Perfil de acesso</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {(Object.keys(PERFIL_LABEL) as Perfil[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPerfil(p)}
                  style={{
                    fontSize: 12,
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: perfil === p ? "none" : "0.5px solid #333",
                    background: perfil === p ? "#EE312D" : "transparent",
                    color: perfil === p ? "#fff" : "#aaa",
                  }}
                >
                  {PERFIL_LABEL[p]}
                </button>
              ))}
            </div>

            {precisaCondominio && (
              <>
                <p style={{ fontSize: 12, color: "#8a8a8a", margin: "0 0 6px" }}>Condomínios que essa pessoa acessa</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  {condominios.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => alternarCondominio(c.id)}
                      style={{
                        fontSize: 12,
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: condominioIds.includes(c.id) ? "none" : "0.5px solid #333",
                        background: condominioIds.includes(c.id) ? "#EE312D" : "transparent",
                        color: condominioIds.includes(c.id) ? "#fff" : "#aaa",
                      }}
                    >
                      {c.nome}
                    </button>
                  ))}
                  {condominios.length === 0 && <span style={{ fontSize: 12, color: "#666" }}>Nenhum condomínio cadastrado ainda.</span>}
                </div>
              </>
            )}

            {erro && <p style={{ fontSize: 12, color: "#f87171", margin: "0 0 10px" }}>{erro}</p>}

            <button
              onClick={criarUsuario}
              disabled={!podeSalvar || salvando}
              style={{ width: "100%", height: 40, borderRadius: 8, background: "#EE312D", color: "#fff", border: "none", fontSize: 13, fontWeight: 500, opacity: podeSalvar ? 1 : 0.4 }}
            >
              {salvando ? "Criando..." : "Criar usuário"}
            </button>
          </div>
        )}

        {carregando ? (
          <p style={{ fontSize: 13, color: "#8a8a8a" }}>Carregando...</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {usuarios.map((u) => (
              <div
                key={u.id}
                style={{ background: "#1c1c1c", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", opacity: u.ativo ? 1 : 0.5 }}
              >
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>
                    {u.nome} {!u.ativo && <span style={{ fontSize: 11, color: "#f87171" }}>(desativado)</span>}
                  </p>
                  <p style={{ fontSize: 12, color: "#8a8a8a", margin: "2px 0 0" }}>
                    {u.email}
                    {u.telefone && ` · ${u.telefone}`}
                  </p>
                  <p style={{ fontSize: 11, color: "#666", margin: "4px 0 0" }}>
                    {PERFIL_LABEL[u.perfil]}
                    {u.condominios.length > 0 && ` · ${u.condominios.map((c) => c.condominio.nome).join(", ")}`}
                  </p>
                </div>
                {u.ativo && (
                  <button
                    onClick={() => desativarUsuario(u.id)}
                    style={{ fontSize: 12, color: "#8a8a8a", background: "none", border: "0.5px solid #333", borderRadius: 6, padding: "6px 10px" }}
                  >
                    Desativar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
