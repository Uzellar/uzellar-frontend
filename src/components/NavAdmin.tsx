import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import logoUlrik from "../assets/ulrik-logo.png";
import { CORES, FONTES } from "../theme";
import { ehAdminMaster, perfilEstaEm, limparToken } from "../lib/api";

interface Item {
  rota: string;
  rotulo: string;
}

interface Grupo {
  titulo: string;
  itens: Item[];
}

// Menu do Administrador Master — separado em grupos por área.
const GRUPOS_ADMIN: Grupo[] = [
  {
    titulo: "Condôminos",
    itens: [
      { rota: "/solicitacoes", rotulo: "Solicitações de condômino" },
      { rota: "/relatorios", rotulo: "Relatórios" },
    ],
  },
  {
    titulo: "Supervisão",
    itens: [
      { rota: "/visitas-operacionais", rotulo: "Visita da supervisão" },
      { rota: "/dashboard-supervisao", rotulo: "Dashboard de supervisão" },
    ],
  },
  {
    titulo: "Cadastros",
    itens: [
      { rota: "/condominios", rotulo: "Cadastro de condomínios" },
      { rota: "/usuarios", rotulo: "Configuração de usuários" },
    ],
  },
];

// Supervisor: solicitações + relatório de visitas (sem QR Code,
// telefones, cadastros ou relatórios de condôminos — só Admin Master).
const GRUPOS_SUPERVISOR: Grupo[] = [
  { titulo: "Condôminos", itens: [{ rota: "/solicitacoes", rotulo: "Solicitações de condômino" }] },
  { titulo: "Supervisão", itens: [{ rota: "/relatorio-visitas", rotulo: "Relatório de visitas" }] },
];

// Perfis antigos (Admin do Condomínio, Funcionário, Visualizador).
const GRUPOS_BASICOS: Grupo[] = [
  { titulo: "Condôminos", itens: [{ rota: "/solicitacoes", rotulo: "Solicitações de condômino" }] },
];

function gruposPorPerfil(): Grupo[] {
  if (ehAdminMaster()) return GRUPOS_ADMIN;
  if (perfilEstaEm("SUPERVISOR")) return GRUPOS_SUPERVISOR;
  return GRUPOS_BASICOS;
}

// Lembra quais grupos a pessoa deixou fechados (só neste navegador).
const CHAVE_FECHADOS = "uzellar_menu_fechados";
function lerFechados(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_FECHADOS) ?? "[]");
  } catch {
    return [];
  }
}
function salvarFechados(lista: string[]) {
  try {
    localStorage.setItem(CHAVE_FECHADOS, JSON.stringify(lista));
  } catch {
    // sem armazenamento disponível — o menu só não lembra o estado
  }
}

function LinkMenu({ item, ativo, recuo }: { item: Item; ativo: boolean; recuo?: boolean }) {
  return (
    <Link
      to={item.rota}
      style={{
        display: "block",
        fontSize: 13,
        textDecoration: "none",
        color: ativo ? CORES.texto : CORES.textoMuted,
        fontWeight: ativo ? 600 : 500,
        padding: recuo ? "8px 12px 8px 22px" : "9px 12px",
        borderRadius: 8,
        background: ativo ? "rgba(255,59,59,0.10)" : "transparent",
        borderLeft: ativo ? `2px solid ${CORES.vermelho}` : "2px solid transparent",
      }}
    >
      {item.rotulo}
    </Link>
  );
}

// Barra lateral fixa do painel administrativo — logo da Ulrik em
// cima, nome do produto embaixo, e as opções de navegação em grupos
// que abrem e fecham.
export default function NavAdmin() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const grupos = gruposPorPerfil();
  const [fechados, setFechados] = useState<string[]>(lerFechados);

  const alternarGrupo = (titulo: string) => {
    const nova = fechados.includes(titulo) ? fechados.filter((t) => t !== titulo) : [...fechados, titulo];
    setFechados(nova);
    salvarFechados(nova);
  };

  const sair = () => {
    limparToken();
    navigate("/login");
  };

  return (
    <aside
      style={{
        width: 230,
        minWidth: 230,
        minHeight: "100vh",
        borderRight: `1px solid ${CORES.borda}`,
        background: "rgba(255,255,255,0.02)",
        backdropFilter: "blur(18px)",
        padding: "1.75rem 1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: 28,
        boxSizing: "border-box",
      }}
    >
      <div>
        <img src={logoUlrik} alt="Ulrik" style={{ height: 30, width: "auto", marginBottom: 10 }} />
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

      <nav style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        <LinkMenu item={{ rota: "/dashboard", rotulo: "Dashboard" }} ativo={pathname === "/dashboard"} />

        {grupos.map((grupo) => {
          // O grupo da tela atual fica sempre aberto, mesmo que a pessoa
          // tenha fechado antes — pra ela não "perder" onde está.
          const temAtivo = grupo.itens.some((i) => i.rota === pathname);
          const aberto = temAtivo || !fechados.includes(grupo.titulo);
          return (
            <div key={grupo.titulo} style={{ marginTop: 10 }}>
              <button
                onClick={() => alternarGrupo(grupo.titulo)}
                aria-expanded={aberto}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "6px 12px",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: CORES.textoSecundario,
                  fontFamily: FONTES.corpo,
                }}
              >
                {grupo.titulo}
                <span style={{ fontSize: 10, transform: aberto ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s" }}>▾</span>
              </button>
              {aberto && (
                <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 2 }}>
                  {grupo.itens.map((item) => (
                    <LinkMenu key={item.rota} item={item} ativo={pathname === item.rota} recuo />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div style={{ display: "flex", flexDirection: "column", gap: 2, borderTop: `1px solid ${CORES.borda}`, paddingTop: 12 }}>
        <LinkMenu item={{ rota: "/trocar-senha", rotulo: "Trocar senha" }} ativo={pathname === "/trocar-senha"} />
        <button
          onClick={sair}
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: CORES.textoMuted,
            background: "transparent",
            border: "none",
            textAlign: "left",
            padding: "9px 12px",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
