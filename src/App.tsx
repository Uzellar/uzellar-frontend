import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { getToken, ehAdminMaster, perfilEstaEm } from "./lib/api";
import Login from "./pages/Login";
import SolicitacaoForm from "./pages/SolicitacaoForm";
import Dashboard from "./pages/Dashboard";
import GestaoUsuarios from "./pages/GestaoUsuarios";
import Condominios from "./pages/Condominios";
import VisitasOperacionaisAdmin from "./pages/VisitasOperacionaisAdmin";
import Solicitacoes from "./pages/Solicitacoes";
import Relatorios from "./pages/Relatorios";
import RelatorioVisitas from "./pages/RelatorioVisitas";
import VisitaForm from "./pages/VisitaForm";

// Rotas protegidas (painel administrativo) exigem login — se não
// houver token salvo, manda de volta para a tela de login.
function RotaProtegida({ children }: { children: JSX.Element }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

// Além de exigir login, exige também que o perfil seja Admin Master
// — usado nas telas que os demais perfis (Supervisor, Funcionário
// etc.) não devem acessar, mesmo digitando o endereço direto na
// barra do navegador (a aba já fica escondida do menu, mas isso
// sozinho não impede alguém de tentar acessar direto pela URL).
function RotaAdminMaster({ children }: { children: JSX.Element }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  if (!ehAdminMaster()) return <Navigate to="/dashboard" replace />;
  return children;
}

// Mesma ideia da RotaAdminMaster, só que aceita mais de um perfil —
// usado no Relatório de Visitas, que Admin Master e Supervisor podem
// acessar (os demais perfis, não).
function RotaComPerfil({ perfis, children }: { perfis: string[]; children: JSX.Element }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  if (!perfilEstaEm(...perfis)) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Pública — sem login, é o que o morador usa */}
        <Route path="/atender/:condominioId" element={<SolicitacaoForm />} />

        {/* Pública — sem login, é o que o supervisor usa nas rondas */}
        <Route path="/visita/:condominioId" element={<VisitaForm />} />

        {/* Painel administrativo */}
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <RotaProtegida>
              <Dashboard />
            </RotaProtegida>
          }
        />
        <Route
          path="/usuarios"
          element={
            <RotaAdminMaster>
              <GestaoUsuarios />
            </RotaAdminMaster>
          }
        />
        <Route
          path="/condominios"
          element={
            <RotaAdminMaster>
              <Condominios />
            </RotaAdminMaster>
          }
        />
        <Route
          path="/visitas-operacionais"
          element={
            <RotaAdminMaster>
              <VisitasOperacionaisAdmin />
            </RotaAdminMaster>
          }
        />
        <Route
          path="/solicitacoes"
          element={
            <RotaProtegida>
              <Solicitacoes />
            </RotaProtegida>
          }
        />
        <Route
          path="/relatorios"
          element={
            <RotaAdminMaster>
              <Relatorios />
            </RotaAdminMaster>
          }
        />
        <Route
          path="/relatorio-visitas"
          element={
            <RotaComPerfil perfis={["ADMIN_MASTER", "SUPERVISOR"]}>
              <RelatorioVisitas />
            </RotaComPerfil>
          }
        />

        {/* Qualquer outro endereço cai na tela de login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  );
}
