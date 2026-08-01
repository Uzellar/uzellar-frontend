import { useEffect, useState } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import logoUlrik from "../assets/ulrik-logo.png";
import { API_URL, authHeaders } from "../lib/api";

// Painel principal do administrador — primeira tela que aparece ao
// logar. Números e gráficos vêm de GET /api/dashboard?condominioId=...

const TIPO_LABEL: Record<string, string> = {
  LIMPEZA: "Limpeza",
  MANUTENCAO: "Manutenção",
  PORTARIA: "Portaria",
  SEGURANCA: "Segurança",
};

interface Indicadores {
  total: number;
  porStatus: Record<string, number>;
  porTipo: Record<string, number>;
  tempoMedioHoras: number | null;
  rankingLocais: { local: string; quantidade: number }[];
  graficoSemanal: { rotulo: string; quantidade: number }[];
  graficoMensal: { rotulo: string; quantidade: number }[];
}

function Cartao({ rotulo, valor, destaque }: { rotulo: string; valor: string | number; destaque?: boolean }) {
  return (
    <div style={{ background: "#1c1c1c", borderRadius: 12, padding: "1rem 1.1rem", flex: 1, minWidth: 130 }}>
      <p style={{ fontSize: 12, color: "#8a8a8a", margin: "0 0 6px" }}>{rotulo}</p>
      <p style={{ fontSize: 24, fontWeight: 500, margin: 0, color: destaque ? "#EE312D" : "#fff" }}>{valor}</p>
    </div>
  );
}

export default function Dashboard() {
  const [dados, setDados] = useState<Indicadores | null>(null);
  const [condominios, setCondominios] = useState<{ id: string; nome: string }[]>([]);
  const [condominioId, setCondominioId] = useState<string | null>(null);
  const [condominiosCarregados, setCondominiosCarregados] = useState(false);

  // Ao entrar na tela, busca os condomínios que esse usuário enxerga
  // e seleciona o primeiro automaticamente.
  useEffect(() => {
    fetch(`${API_URL}/api/condominios`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((lista) => {
        setCondominios(lista);
        if (lista.length > 0) setCondominioId(lista[0].id);
        setCondominiosCarregados(true);
      });
  }, []);

  useEffect(() => {
    if (!condominioId) return;
    fetch(`${API_URL}/api/dashboard?condominioId=${condominioId}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then(setDados);
  }, [condominioId]);

  if (condominiosCarregados && condominios.length === 0) {
    return (
      <div style={{ background: "#141414", minHeight: "100vh", padding: "2rem", color: "#8a8a8a", fontSize: 13 }}>
        Nenhum condomínio cadastrado ainda.
      </div>
    );
  }

  if (!dados) {
    return (
      <div style={{ background: "#141414", minHeight: "100vh", padding: "2rem", color: "#8a8a8a", fontSize: 13 }}>
        Carregando indicadores...
      </div>
    );
  }

  const maiorRanking = Math.max(...dados.rankingLocais.map((r) => r.quantidade), 1);

  return (
    <div style={{ background: "#141414", minHeight: "100vh" }}>
      {/* Cabeçalho com a marca — mesmo padrão usado nas outras telas do sistema */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 1.5rem",
          borderBottom: "0.5px solid #262626",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#1c1c1c", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="12" height="16" viewBox="0 0 18 24">
              <polygon points="0,0 9,12 0,24 5,24 14,12 5,0" fill="#EE312D" />
              <rect x="13" y="0" width="5" height="24" fill="#EE312D" />
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: "#fff", margin: 0, lineHeight: 1.1 }}>Uzellar</p>
            <p style={{ fontSize: 10, color: "#666", margin: 0, lineHeight: 1.1 }}>by Ulrik</p>
          </div>
        </div>
        <img src={logoUlrik} alt="Ulrik" style={{ height: 20, width: "auto" }} />
      </header>

      <div style={{ padding: "2rem 1.5rem" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <p style={{ fontSize: 20, fontWeight: 500, color: "#fff", margin: "0 0 4px" }}>Dashboard</p>
          <p style={{ fontSize: 13, color: "#8a8a8a", margin: "0 0 24px" }}>Visão geral das solicitações</p>

          {/* Cartões principais */}
          <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
            <Cartao rotulo="Total" valor={dados.total} />
            <Cartao rotulo="Abertas" valor={dados.porStatus.ABERTA ?? 0} />
            <Cartao rotulo="Em andamento" valor={dados.porStatus.EM_ANDAMENTO ?? 0} destaque />
            <Cartao rotulo="Concluídas" valor={dados.porStatus.CONCLUIDA ?? 0} />
            <Cartao rotulo="Tempo médio" valor={dados.tempoMedioHoras !== null ? `${dados.tempoMedioHoras}h` : "—"} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            {/* Gráfico semanal */}
            <div style={{ background: "#1c1c1c", borderRadius: 12, padding: "1.1rem" }}>
              <p style={{ fontSize: 13, color: "#fff", fontWeight: 500, margin: "0 0 12px" }}>Últimas 8 semanas</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={dados.graficoSemanal}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                  <XAxis dataKey="rotulo" tick={{ fill: "#8a8a8a", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#8a8a8a", fontSize: 11 }} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#262626", border: "0.5px solid #333", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#fff" }} />
                  <Bar dataKey="quantidade" fill="#EE312D" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Gráfico mensal */}
            <div style={{ background: "#1c1c1c", borderRadius: 12, padding: "1.1rem" }}>
              <p style={{ fontSize: 13, color: "#fff", fontWeight: 500, margin: "0 0 12px" }}>Últimos 6 meses</p>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={dados.graficoMensal}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                  <XAxis dataKey="rotulo" tick={{ fill: "#8a8a8a", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#8a8a8a", fontSize: 11 }} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#262626", border: "0.5px solid #333", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#fff" }} />
                  <Line type="monotone" dataKey="quantidade" stroke="#EE312D" strokeWidth={2} dot={{ r: 3, fill: "#EE312D" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Ranking de locais */}
            <div style={{ background: "#1c1c1c", borderRadius: 12, padding: "1.1rem" }}>
              <p style={{ fontSize: 13, color: "#fff", fontWeight: 500, margin: "0 0 12px" }}>Locais com mais ocorrências</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {dados.rankingLocais.length === 0 && <p style={{ fontSize: 12, color: "#666" }}>Nenhuma solicitação ainda.</p>}
                {dados.rankingLocais.map((r) => (
                  <div key={r.local}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#ccc", marginBottom: 4 }}>
                      <span>{r.local}</span>
                      <span>{r.quantidade}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 4, background: "#262626" }}>
                      <div style={{ height: 6, borderRadius: 4, background: "#EE312D", width: `${(r.quantidade / maiorRanking) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Por categoria */}
            <div style={{ background: "#1c1c1c", borderRadius: 12, padding: "1.1rem" }}>
              <p style={{ fontSize: 13, color: "#fff", fontWeight: 500, margin: "0 0 12px" }}>Por categoria</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {Object.entries(dados.porTipo).map(([tipo, quantidade]) => (
                  <div key={tipo} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#ccc" }}>
                    <span>{TIPO_LABEL[tipo] ?? tipo}</span>
                    <span style={{ color: "#fff", fontWeight: 500 }}>{quantidade}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
