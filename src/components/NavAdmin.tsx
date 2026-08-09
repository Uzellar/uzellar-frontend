import { Link, useLocation } from "react-router-dom";
import logoUlrik from "../assets/ulrik-logo.png";
import { CORES, FONTES } from "../theme";

const ITENS = [
  { rota: "/dashboard", rotulo: "Dashboard" },
  { rota: "/solicitacoes", rotulo: "Solicitações" },
  { rota: "/condominios", rotulo: "Condomínios" },
  { rota: "/usuarios", rotulo: "Usuários" },
];

// Barra lateral fixa do painel administrativo — logo da Ulrik em
// cima, nome do produto embaixo, e as opções de navegação abaixo.
export default function NavAdmin() {
  const { pathname } = useLocation();

  return (
    <aside
      style={{
        width: 220,
        minWidth: 220,
        minHeight: "100vh",
        borderRight: `1px solid ${CORES.borda}`,
        background: "rgba(255,255,255,0.02)",
        backdropFilter: "blur(18px)",
        padding: "1.75rem 1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: 36,
      }}
    >
      <div>
        <img src={logoUlrik} alt="Ulrik" style={{ height: 20, width: "auto", marginBottom: 10 }} />
        <p
          style={{
            fontSize: 16,
            fontWeight: 900,
            color: CORES.texto,
            margin: 0,
            fontFamily: FONTES.titulo,
            letterSpacing: "-0.02em",
          }}
        >
          Uzellar
        </p>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
                padding: "9px 12px",
                borderRadius: 8,
                background: ativo ? "rgba(255,59,59,0.10)" : "transparent",
                borderLeft: ativo ? `2px solid ${CORES.vermelho}` : "2px solid transparent",
              }}
            >
              {item.rotulo}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
