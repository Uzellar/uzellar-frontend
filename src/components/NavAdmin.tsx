import { Link, useLocation } from "react-router-dom";
import logoUlrik from "../assets/ulrik-logo.png";
import { CORES, FONTES } from "../theme";

const ITENS = [
  { rota: "/dashboard", rotulo: "Dashboard" },
  { rota: "/condominios", rotulo: "Condomínios" },
  { rota: "/usuarios", rotulo: "Usuários" },
];

export default function NavAdmin() {
  const { pathname } = useLocation();

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "1.1rem 1.75rem",
        borderBottom: `1px solid ${CORES.borda}`,
        background: "rgba(255,255,255,0.02)",
        backdropFilter: "blur(18px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
        <p
          style={{
            fontSize: 15,
            fontWeight: 900,
            color: CORES.texto,
            margin: 0,
            fontFamily: FONTES.titulo,
            letterSpacing: "-0.02em",
          }}
        >
          Uzellar
        </p>
        <nav style={{ display: "flex", gap: 22 }}>
          {ITENS.map((item) => {
            const ativo = pathname === item.rota;
            return (
              <Link
                key={item.rota}
                to={item.rota}
                style={{
                  fontSize: 13,
                  textDecoration: "none",
                  color: ativo ? CORES.texto : CORES.textoMuted,
                  fontWeight: ativo ? 600 : 500,
                  position: "relative",
                  paddingBottom: 4,
                  borderBottom: ativo ? `2px solid ${CORES.vermelho}` : "2px solid transparent",
                }}
              >
                {item.rotulo}
              </Link>
            );
          })}
        </nav>
      </div>
      <img src={logoUlrik} alt="Ulrik" style={{ height: 20, width: "auto" }} />
    </header>
  );
}
