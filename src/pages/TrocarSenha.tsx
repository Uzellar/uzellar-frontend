import { useState } from "react";
import { API_URL, authHeaders } from "../lib/api";
import NavAdmin from "../components/NavAdmin";
import { CORES, FONTES } from "../theme";

// Qualquer usuário logado troca a própria senha aqui — precisa
// informar a senha atual (o backend confere antes de trocar).

const estiloCampo = {
  width: "100%",
  height: 40,
  borderRadius: 8,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#fff",
  padding: "0 12px",
  fontSize: 13,
  boxSizing: "border-box" as const,
};

export default function TrocarSenha() {
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const problema =
    novaSenha && novaSenha.length < 8
      ? "A nova senha precisa ter no mínimo 8 caracteres."
      : confirmacao && novaSenha !== confirmacao
        ? "A confirmação não é igual à nova senha."
        : null;
  const podeSalvar = senhaAtual && novaSenha.length >= 8 && novaSenha === confirmacao;

  const salvar = async () => {
    if (!podeSalvar) return;
    setSalvando(true);
    setErro(null);
    setSucesso(false);
    try {
      const resposta = await fetch(`${API_URL}/api/auth/trocar-senha`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ senhaAtual, novaSenha }),
      });
      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => ({}));
        const msg = Array.isArray(dados.message) ? dados.message[0] : dados.message;
        throw new Error(resposta.status === 429 ? "Muitas tentativas. Aguarde um minuto." : msg ?? "Não foi possível trocar a senha.");
      }
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmacao("");
      setSucesso(true);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div style={{ background: CORES.fundo, minHeight: "100vh", color: "#fff", display: "flex" }}>
      <NavAdmin />
      <div style={{ flex: 1, padding: "2rem 1.5rem" }}>
        <div style={{ maxWidth: 420, margin: "0 auto" }}>
          <p style={{ fontSize: 22, fontWeight: 900, margin: 0, color: CORES.texto, fontFamily: FONTES.titulo, letterSpacing: "-0.02em" }}>
            Trocar senha
          </p>
          <p style={{ fontSize: 13, color: "#8a8a8a", margin: "2px 0 24px" }}>Defina uma nova senha para entrar no Uzellar.</p>

          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "1.25rem", display: "flex", flexDirection: "column", gap: 10 }}>
            <label style={{ fontSize: 12, color: "#8a8a8a" }}>
              Senha atual
              <input type="password" autoComplete="current-password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} style={{ ...estiloCampo, marginTop: 4 }} />
            </label>
            <label style={{ fontSize: 12, color: "#8a8a8a" }}>
              Nova senha (mínimo 8 caracteres)
              <input type="password" autoComplete="new-password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} style={{ ...estiloCampo, marginTop: 4 }} />
            </label>
            <label style={{ fontSize: 12, color: "#8a8a8a" }}>
              Repita a nova senha
              <input
                type="password"
                autoComplete="new-password"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && salvar()}
                style={{ ...estiloCampo, marginTop: 4 }}
              />
            </label>

            {(problema || erro) && <p style={{ fontSize: 12, color: "#f87171", margin: 0 }}>{problema ?? erro}</p>}
            {sucesso && <p style={{ fontSize: 12, color: "#4ade80", margin: 0 }}>Senha trocada com sucesso. Use a nova senha no próximo login.</p>}

            <button
              onClick={salvar}
              disabled={!podeSalvar || salvando}
              style={{ height: 40, borderRadius: 8, background: CORES.vermelho, color: "#fff", border: "none", fontSize: 13, fontWeight: 600, opacity: podeSalvar ? 1 : 0.4, cursor: podeSalvar ? "pointer" : "default", marginTop: 4 }}
            >
              {salvando ? "Salvando..." : "Trocar senha"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
