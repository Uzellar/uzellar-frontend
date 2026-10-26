import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { getToken, ehAdminMaster, perfilEstaEm } from "./lib/api";
import Login from "./pages/Login";
import SolicitacaoForm from "./pages/SolicitacaoForm";
import Dashboard from "./pages/Dashboard";
import DashboardSupervisao from "./pages/DashboardSupervisao";
import TrocarSenha from "./pages/TrocarSenha";
import GestaoUsuarios from "./pages/GestaoUsuarios";
import Condominios from "./pages/Condominios";
import VisitasOperacionaisAdmin from "./pages/VisitasOperacionaisAdmin";
import Solicitacoes from "./pages/Solicitacoes";
import Relatorios from "./pages/Relatorios";
import RelatorioVisitas from "./pages/RelatorioVisitas";
import VisitaForm from "./pages/VisitaForm";
import EstoqueUniformes from "./pages/EstoqueUniformes";
import EstoqueMovimentar from "./pages/EstoqueMovimentar";
import EstoqueHistorico from "./pages/EstoqueHistorico";
import EstoqueCadastros from "./pages/EstoqueCadastros";
import EstoqueRequisicoes from "./pages/EstoqueRequisicoes";
import EstoqueRequisicaoNova from "./pages/EstoqueRequisicaoNova";
import EstoqueRequisicaoDetalhe from "./pages/EstoqueRequisicaoDetalhe";

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

const PERFIS_ESTOQUE = ["ADMIN_MASTER", "ESTOQUE"];
// Requisições: o Supervisor também acessa (só as próprias).
const PERFIS_REQUISICOES = ["ADMIN_MASTER", "ESTOQUE", "SUPERVISOR"];

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
          path="/dashboard-supervisao"
          element={
            <RotaAdminMaster>
              <DashboardSupervisao />
            </RotaAdminMaster>
          }
        />
        <Route
          path="/trocar-senha"
          element={
            <RotaProtegida>
              <TrocarSenha />
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

        {/* Estoque de uniformes — Admin Master e Responsável pelo estoque */}
        <Route
          path="/estoque/uniformes"
          element={
            <RotaComPerfil perfis={PERFIS_ESTOQUE}>
              <EstoqueUniformes />
            </RotaComPerfil>
          }
        />
        <Route
          path="/estoque/entradas"
          element={
            <RotaComPerfil perfis={PERFIS_ESTOQUE}>
              <EstoqueMovimentar key="ENTRADA" tipo="ENTRADA" />
            </RotaComPerfil>
          }
        />
        <Route
          path="/estoque/saidas"
          element={
            <RotaComPerfil perfis={PERFIS_ESTOQUE}>
              <EstoqueMovimentar key="SAIDA" tipo="SAIDA" />
            </RotaComPerfil>
          }
        />
        <Route
          path="/estoque/historico"
          element={
            <RotaComPerfil perfis={PERFIS_ESTOQUE}>
              <EstoqueHistorico />
            </RotaComPerfil>
          }
        />
        <Route
          path="/estoque/fornecedores"
          element={
            <RotaComPerfil perfis={PERFIS_ESTOQUE}>
              <EstoqueCadastros key="fornecedores" tipo="fornecedores" />
            </RotaComPerfil>
          }
        />
        <Route
          path="/estoque/contratos"
          element={
            <RotaComPerfil perfis={PERFIS_ESTOQUE}>
              <EstoqueCadastros key="contratos" tipo="contratos" />
            </RotaComPerfil>
          }
        />

        {/* Requisições de uniforme (Fase 2) — "nova" antes de ":id" */}
        <Route
          path="/estoque/requisicoes"
          element={
            <RotaComPerfil perfis={PERFIS_REQUISICOES}>
              <EstoqueRequisicoes />
            </RotaComPerfil>
          }
        />
        <Route
          path="/estoque/requisicoes/nova"
          element={
            <RotaComPerfil perfis={["ADMIN_MASTER", "SUPERVISOR"]}>
              <EstoqueRequisicaoNova />
            </RotaComPerfil>
          }
        />
        <Route
          path="/estoque/requisicoes/:id"
          element={
            <RotaComPerfil perfis={PERFIS_REQUISICOES}>
              <EstoqueRequisicaoDetalhe />
            </RotaComPerfil>
          }
        />

        {/* Qualquer outro endereço cai na tela de login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  );
}
