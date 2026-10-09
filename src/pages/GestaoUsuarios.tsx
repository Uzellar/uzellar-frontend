import { useEffect, useState } from "react";
import { API_URL, authHeaders } from "../lib/api";
import NavAdmin from "../components/NavAdmin";
import { CORES, FONTES } from "../theme";

// Tela administrativa — só o Administrador Master enxerga essa opção
// no menu. Lista os logins existentes, permite criar novos e editar
// os existentes (dados, perfil, condomínios liberados, senha nova,
// desativar/reativar e excluir).

type Perfil = "ADMIN_MASTER" | "ADMIN_CONDOMINIO" | "SUPERVISOR" | "FUNCIONARIO" | "VISUALIZADOR";

const PERFIL_LABEL: Record<Perfil, string> = {
  ADMIN_MASTER: "Administrador master",
  ADMIN_CONDOMINIO: "Administrador do condomínio",
  SUPERVISOR: "Supervisor",
  FUNCIONARIO: "Funcionário",
  VISUALIZADOR: "Visualizador",
};

// Só esses dois perfis podem ser escolhidos ao CRIAR um usuário novo
// — os outros (Admin do Condomínio, Funcionário, Visualizador) foram
// descontinuados por decisão do cliente, mas o rótulo acima continua
// completo pra exibir corretamente qualquer usuário antigo que ainda
// tenha um desses perfis no banco.
const PERFIS_CRIAVEIS: Perfil[] = ["ADMIN_MASTER", "SUPERVISOR"];

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
  const [senha, setSenha] = useState("");
  const [perfil, setPerfil] = useState<Perfil>("SUPERVISOR");
  const [condominioIds, setCondominioIds] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);


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
        body: JSON.stringify({ nome, email, senha, perfil, condominioIds: precisaCondominio ? condominioIds : undefined }),
      });
      if (!resposta.ok) {
        const dados = await resposta.json();
        throw new Error(dados.message ?? "Não foi possível criar o usuário.");
      }
      setNome("");
      setEmail("");
      setSenha("");
      setPerfil("SUPERVISOR");
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

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", color: "#fff", display: "flex" }}>
      <NavAdmin />
      <div style={{ flex: 1, padding: "2rem 1.5rem" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <p style={{ fontSize: 22, fontWeight: 900, margin: 0, color: CORES.texto, fontFamily: FONTES.titulo, letterSpacing: "-0.02em" }}>Configuração de usuários</p>
            <p style={{ fontSize: 13, color: "#8a8a8a", margin: "2px 0 0" }}>Quem tem acesso ao painel do Uzellar</p>
          </div>
          <button
            onClick={() => setMostrarForm((v) => !v)}
            style={{ height: 38, padding: "0 16px", borderRadius: 9999, background: "#FF3B3B", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px -6px rgba(255,59,59,0.45)" }}
          >
            {mostrarForm ? "Cancelar" : "+ Novo usuário"}
          </button>
        </div>

        {mostrarForm && (
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "1.25rem", marginBottom: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <input
                placeholder="Nome completo"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                style={{ height: 38, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", padding: "0 10px", fontSize: 13 }}
              />
              <input
                placeholder="E-mail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ height: 38, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", padding: "0 10px", fontSize: 13 }}
              />
            </div>
            <input
              placeholder="Senha provisória (mín. 8 caracteres)"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              style={{ width: "100%", height: 38, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", padding: "0 10px", fontSize: 13, marginBottom: 10, boxSizing: "border-box" }}
            />

            <p style={{ fontSize: 12, color: "#8a8a8a", margin: "0 0 6px" }}>Perfil de acesso</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {PERFIS_CRIAVEIS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPerfil(p)}
                  style={{
                    fontSize: 12,
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: perfil === p ? "none" : "1px solid rgba(255,255,255,0.08)",
                    background: perfil === p ? "#FF3B3B" : "transparent",
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
                        border: condominioIds.includes(c.id) ? "none" : "1px solid rgba(255,255,255,0.08)",
                        background: condominioIds.includes(c.id) ? "#FF3B3B" : "transparent",
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
              style={{ width: "100%", height: 40, borderRadius: 8, background: "#FF3B3B", color: "#fff", border: "none", fontSize: 13, fontWeight: 500, opacity: podeSalvar ? 1 : 0.4 }}
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
              <CartaoUsuario key={u.id} usuario={u} condominios={condominios} aoAlterar={carregar} />
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

const estiloCampo = {
  height: 38,
  borderRadius: 8,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#fff",
  padding: "0 10px",
  fontSize: 13,
  boxSizing: "border-box" as const,
  width: "100%",
};

const estiloBotaoPequeno = {
  fontSize: 12,
  color: "#aaa",
  background: "none",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 6,
  padding: "6px 10px",
  cursor: "pointer",
};

async function lerErro(resposta: Response, padrao: string) {
  const dados = await resposta.json().catch(() => ({}));
  const msg = Array.isArray(dados.message) ? dados.message[0] : dados.message;
  return msg ?? padrao;
}

// Um usuário da lista — fechado mostra o resumo; "Editar" abre o
// formulário com nome, e-mail, telefone, perfil, condomínios liberados
// e senha nova (opcional). Também tem Desativar/Reativar e Excluir.
function CartaoUsuario({ usuario: u, condominios, aoAlterar }: { usuario: Usuario; condominios: Condominio[]; aoAlterar: () => Promise<void> }) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(u.nome);
  const [email, setEmail] = useState(u.email);
  const [telefone, setTelefone] = useState(u.telefone ?? "");
  const [perfil, setPerfil] = useState<Perfil>(u.perfil);
  const [condominioIds, setCondominioIds] = useState<string[]>(u.condominios.map((c) => c.condominio.id));
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Mostra os perfis que podem ser criados + o perfil atual (caso seja
  // um perfil antigo), pra não trocar o perfil de alguém sem querer.
  const perfisDisponiveis = PERFIS_CRIAVEIS.includes(u.perfil) ? PERFIS_CRIAVEIS : [...PERFIS_CRIAVEIS, u.perfil];
  const precisaCondominio = perfil !== "ADMIN_MASTER";
  const podeSalvar =
    nome.trim() && email.trim() && (!novaSenha || novaSenha.length >= 8) && (!precisaCondominio || condominioIds.length > 0);

  const abrir = () => {
    setNome(u.nome);
    setEmail(u.email);
    setTelefone(u.telefone ?? "");
    setPerfil(u.perfil);
    setCondominioIds(u.condominios.map((c) => c.condominio.id));
    setNovaSenha("");
    setErro(null);
    setConfirmarExclusao(false);
    setEditando(true);
  };

  const enviar = async (metodo: string, caminho: string, corpo?: object) => {
    setOcupado(true);
    setErro(null);
    try {
      const resposta = await fetch(`${API_URL}/api/usuarios/${u.id}${caminho}`, {
        method: metodo,
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
      if (!resposta.ok) throw new Error(await lerErro(resposta, "Não foi possível salvar."));
      await aoAlterar();
      return true;
    } catch (e: any) {
      setErro(e.message);
      return false;
    } finally {
      setOcupado(false);
    }
  };

  const salvar = async () => {
    if (!podeSalvar) return;
    const ok = await enviar("PATCH", "", {
      nome: nome.trim(),
      email: email.trim(),
      telefone: telefone.trim(),
      perfil,
      // Admin Master enxerga tudo — os vínculos ficam vazios.
      condominioIds: precisaCondominio ? condominioIds : [],
      ...(novaSenha ? { senha: novaSenha } : {}),
    });
    if (ok) setEditando(false);
  };

  const alternarCondominio = (id: string) =>
    setCondominioIds((atual) => (atual.includes(id) ? atual.filter((c) => c !== id) : [...atual, id]));

  return (
    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "12px 16px", opacity: u.ativo || editando ? 1 : 0.55 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>
            {u.nome} {!u.ativo && <span style={{ fontSize: 11, color: "#f87171" }}>(desativado)</span>}
          </p>
          <p style={{ fontSize: 12, color: "#8a8a8a", margin: "2px 0 0", overflowWrap: "anywhere" }}>
            {u.email}
            {u.telefone && ` · ${u.telefone}`}
          </p>
          <p style={{ fontSize: 11, color: "#666", margin: "4px 0 0" }}>
            {PERFIL_LABEL[u.perfil]}
            {u.perfil === "ADMIN_MASTER"
              ? " · todos os condomínios"
              : u.condominios.length > 0 && ` · ${u.condominios.map((c) => c.condominio.nome).join(", ")}`}
          </p>
        </div>
        {!editando && (
          <button onClick={abrir} style={estiloBotaoPequeno}>
            Editar
          </button>
        )}
      </div>

      {editando && (
        <div style={{ marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 10 }}>
            <input placeholder="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} style={estiloCampo} />
            <input placeholder="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={estiloCampo} />
            <input placeholder="Telefone (opcional)" value={telefone} onChange={(e) => setTelefone(e.target.value)} style={estiloCampo} />
            <input
              placeholder="Nova senha (deixe vazio para manter)"
              type="password"
              autoComplete="new-password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              style={estiloCampo}
            />
          </div>
          {novaSenha && novaSenha.length < 8 && (
            <p style={{ fontSize: 12, color: "#f87171", margin: "0 0 10px" }}>A senha precisa ter no mínimo 8 caracteres.</p>
          )}

          <p style={{ fontSize: 12, color: "#8a8a8a", margin: "0 0 6px" }}>Perfil de acesso</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {perfisDisponiveis.map((p) => (
              <button
                key={p}
                onClick={() => setPerfil(p)}
                style={{
                  fontSize: 12,
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: perfil === p ? "none" : "1px solid rgba(255,255,255,0.08)",
                  background: perfil === p ? "#FF3B3B" : "transparent",
                  color: perfil === p ? "#fff" : "#aaa",
                  cursor: "pointer",
                }}
              >
                {PERFIL_LABEL[p]}
              </button>
            ))}
          </div>

          {precisaCondominio ? (
            <>
              <p style={{ fontSize: 12, color: "#8a8a8a", margin: "0 0 6px" }}>Condomínios que essa pessoa pode acessar</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {condominios.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => alternarCondominio(c.id)}
                    style={{
                      fontSize: 12,
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: condominioIds.includes(c.id) ? "none" : "1px solid rgba(255,255,255,0.08)",
                      background: condominioIds.includes(c.id) ? "#FF3B3B" : "transparent",
                      color: condominioIds.includes(c.id) ? "#fff" : "#aaa",
                      cursor: "pointer",
                    }}
                  >
                    {c.nome}
                  </button>
                ))}
              </div>
              {condominioIds.length === 0 && (
                <p style={{ fontSize: 12, color: "#f87171", margin: "0 0 10px" }}>Escolha pelo menos um condomínio.</p>
              )}
            </>
          ) : (
            <p style={{ fontSize: 12, color: "#8a8a8a", margin: "0 0 12px" }}>O Administrador master acessa todos os condomínios.</p>
          )}

          {erro && <p style={{ fontSize: 12, color: "#f87171", margin: "0 0 10px" }}>{erro}</p>}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <button
              onClick={salvar}
              disabled={!podeSalvar || ocupado}
              style={{ height: 36, padding: "0 16px", borderRadius: 8, background: "#FF3B3B", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, opacity: podeSalvar ? 1 : 0.4, cursor: "pointer" }}
            >
              {ocupado ? "Salvando..." : "Salvar alterações"}
            </button>
            <button onClick={() => setEditando(false)} disabled={ocupado} style={estiloBotaoPequeno}>
              Cancelar
            </button>
            <span style={{ flex: 1 }} />
            {u.ativo ? (
              <button onClick={async () => (await enviar("DELETE", "")) && setEditando(false)} disabled={ocupado} style={estiloBotaoPequeno}>
                Desativar
              </button>
            ) : (
              <button onClick={async () => (await enviar("PATCH", "", { ativo: true })) && setEditando(false)} disabled={ocupado} style={estiloBotaoPequeno}>
                Reativar
              </button>
            )}
            {confirmarExclusao ? (
              <>
                <span style={{ fontSize: 12, color: "#f87171" }}>Excluir de vez?</span>
                <button
                  onClick={() => enviar("DELETE", "/permanente")}
                  disabled={ocupado}
                  style={{ ...estiloBotaoPequeno, color: "#fff", background: "#b91c1c", border: "none" }}
                >
                  Sim, excluir
                </button>
                <button onClick={() => setConfirmarExclusao(false)} disabled={ocupado} style={estiloBotaoPequeno}>
                  Não
                </button>
              </>
            ) : (
              <button onClick={() => setConfirmarExclusao(true)} disabled={ocupado} style={{ ...estiloBotaoPequeno, color: "#f87171" }}>
                Excluir
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
