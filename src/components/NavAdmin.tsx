import { Link, useLocation } from "react-router-dom";
import logoUlrik from "../assets/ulrik-logo.png";

const ITENS = [
  { rota: "/dashboard", rotulo: "Dashboard" },
  { rota: "/condominios", rotulo: "Condomínios" },
  { rota: "/usuarios", rotulo: "Usuários" },
];

export default function NavAdmin() {
  const { pathname } = useLocation();

  return (
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.5rem", borderBottom: "0.5px solid #262626" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: "#fff", margin: 0 }}>Uzellar</p>
        <nav style={{ display: "flex", gap: 16 }}>
          {ITENS.map((item) => (
            <Link
              key={item.rota}
              to={item.rota}
              style={{
                fontSize: 13,
                textDecoration: "none",
                color: pathname === item.rota ? "#fff" : "#8a8a8a",
                fontWeight: pathname === item.rota ? 500 : 400,
              }}
            >
              {item.rotulo}
            </Link>
          ))}
        </nav>
      </div>
      <img src={logoUlrik} alt="Ulrik" style={{ height: 20, width: "auto" }} />
    </header>
  );
}
