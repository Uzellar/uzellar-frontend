import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL, setToken } from "../lib/api";
import logoUlrik from "../assets/ulrik-logo.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);
  const navigate = useNavigate();

  const entrar = async () => {
    setEntrando(true);
    setErro(null);
    try {
      const resposta = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });
      if (!resposta.ok) throw new Error();
      const dados = await resposta.json();
      setToken(dados.token);
      navigate("/dashboard");
    } catch {
      setErro("E-mail ou senha inválidos.");
    } finally {
      setEntrando(false);
    }
  };

  return (
    <div style={{ background: "#141414", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
      <div style={{ background: "#1c1c1c", borderRadius: 16, padding: "2.5rem 2rem", maxWidth: 380, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <img src={logoUlrik} alt="Ulrik" style={{ height: 28, width: "auto" }} />
        </div>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <p style={{ fontSize: 22, fontWeight: 500, color: "#fff", margin: 0 }}>Uzellar</p>
          <p style={{ fontSize: 13, color: "#8a8a8a", margin: "4px 0 0" }}>Painel administrativo</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && entrar()}
            style={{ height: 42, borderRadius: 8, background: "#262626", border: "0.5px solid #333", color: "#fff", padding: "0 12px", fontSize: 14 }}
          />
          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && entrar()}
            style={{ height: 42, borderRadius: 8, background: "#262626", border: "0.5px solid #333", color: "#fff", padding: "0 12px", fontSize: 14 }}
          />
          {erro && <p style={{ fontSize: 12, color: "#f87171", margin: 0 }}>{erro}</p>}
          <button
            onClick={entrar}
            disabled={entrando}
            style={{ height: 44, borderRadius: 8, background: "#EE312D", color: "#fff", border: "none", fontSize: 14, fontWeight: 500, marginTop: 8 }}
          >
            {entrando ? "Entrando..." : "Entrar"}
          </button>
        </div>
        <p style={{ textAlign: "center", fontSize: 12, color: "#666", marginTop: 24 }}>Uzellar é um produto Ulrik</p>
      </div>
    </div>
  );
}
