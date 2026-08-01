import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { getToken } from "./lib/api";
import Login from "./pages/Login";
import SolicitacaoForm from "./pages/SolicitacaoForm";
import ConsultaSolicitacao from "./pages/ConsultaSolicitacao";
import Dashboard from "./pages/Dashboard";
import GestaoUsuarios from "./pages/GestaoUsuarios";

// Rotas protegidas (painel administrativo) exigem login — se não
// houver token salvo, manda de volta para a tela de login.
function RotaProtegida({ children }: { children: JSX.Element }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Públicas — sem login, é o que o morador usa */}
        <Route path="/atender/:localId" element={<SolicitacaoForm />} />
        <Route path="/consulta" element={<ConsultaSolicitacao />} />
        <Route path="/consulta/:protocolo" element={<ConsultaSolicitacao />} />

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
            <RotaProtegida>
              <GestaoUsuarios />
            </RotaProtegida>
          }
        />

        {/* Qualquer outro endereço cai na tela de login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
