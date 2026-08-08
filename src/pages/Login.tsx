import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL, setToken } from "../lib/api";
import logoUlrik from "../assets/ulrik-logo.png";
import { CORES, FONTES, estiloCartaoVidro, estiloBotaoPrimario, estiloBadge } from "../theme";

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
    <div
      style={{
        background: CORES.fundo,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Brilho vermelho de fundo, igual ao efeito do hero institucional */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 600,
          height: 600,
          background: "radial-gradient(closest-side, rgba(255,59,59,0.16), rgba(255,59,59,0) 70%)",
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />

      <div style={{ ...estiloCartaoVidro, padding: "2.75rem 2.25rem", maxWidth: 400, width: "100%", position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
          <img src={logoUlrik} alt="Ulrik" style={{ height: 30, width: "auto" }} />
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <span style={estiloBadge}>
            <span style={{ position: "relative", display: "inline-flex", height: 6, width: 6 }}>
              <span
                style={{
                  position: "absolute",
                  display: "inline-flex",
                  height: "100%",
                  width: "100%",
                  borderRadius: 9999,
                  background: CORES.vermelho,
                  opacity: 0.6,
                }}
              />
              <span style={{ position: "relative", display: "inline-flex", height: 6, width: 6, borderRadius: 9999, background: CORES.vermelho }} />
            </span>
            Painel administrativo
          </span>
        </div>

        <p
          style={{
            textAlign: "center",
            fontFamily: FONTES.titulo,
            fontWeight: 900,
            fontSize: 30,
            letterSpacing: "-0.03em",
            color: CORES.texto,
            margin: "0 0 30px",
          }}
        >
          Uzellar
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && entrar()}
            style={{
              height: 46,
              borderRadius: 12,
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${CORES.borda}`,
              color: CORES.texto,
              padding: "0 14px",
              fontSize: 14,
              fontFamily: FONTES.corpo,
            }}
          />
          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && entrar()}
            style={{
              height: 46,
              borderRadius: 12,
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${CORES.borda}`,
              color: CORES.texto,
              padding: "0 14px",
              fontSize: 14,
              fontFamily: FONTES.corpo,
            }}
          />
          {erro && <p style={{ fontSize: 12, color: "#f87171", margin: 0 }}>{erro}</p>}
          <button
            onClick={entrar}
            disabled={entrando}
            style={{ ...estiloBotaoPrimario, height: 48, fontSize: 14, marginTop: 10, opacity: entrando ? 0.7 : 1 }}
          >
            {entrando ? "Entrando..." : "Entrar"}
          </button>
        </div>
        <p style={{ textAlign: "center", fontSize: 12, color: CORES.textoMuted, marginTop: 26, fontFamily: FONTES.corpo }}>
          Uzellar é um produto Ulrik
        </p>
      </div>
    </div>
  );
}
