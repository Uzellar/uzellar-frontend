import { useEffect, useState } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { API_URL, authHeaders } from "../lib/api";
import NavAdmin from "../components/NavAdmin";
import { CORES, FONTES, estiloCartaoVidro } from "../theme";

// Painel de indicadores do fluxo de Supervisão (visitas operacionais)
// — separado de propósito do Dashboard de Limpeza. Números e
// gráficos vêm de GET /api/visitas/dashboard?condominioId=...

const TURNO_LABEL: Record<string, string> = {
  DIURNO: "Diurno",
  NOTURNO: "Noturno",
  LIMPEZA: "Limpeza",
};

interface Indicadores {
  total: number;
  concluidas: number;
  emAndamento: number;
  porTurno: Record<string, number>;
  tempoMedioMinutos: number | null;
  graficoSemanal: { rotulo: string; quantidade: number }[];
  graficoMensal: { rotulo: string; quantidade: number }[];
}

function Cartao({ rotulo, valor, destaque }: { rotulo: string; valor: string | number; destaque?: boolean }) {
  return (
    <div style={{ ...estiloCartaoVidro, padding: "1.1rem 1.2rem", flex: 1, minWidth: 130 }}>
      <p style={{ fontSize: 12, color: CORES.textoMuted, margin: "0 0 6px", fontFamily: FONTES.corpo }}>{rotulo}</p>
      <p
        style={{
          fontSize: 26,
          fontWeight: 900,
          margin: 0,
          color: destaque ? CORES.vermelho : CORES.texto,
          fontFamily: FONTES.titulo,
          letterSpacing: "-0.02em",
        }}
      >
        {valor}
      </p>
    </div>
  );
}

function PainelCard({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ ...estiloCartaoVidro, padding: "1.2rem" }}>
      <p style={{ fontSize: 13, color: CORES.texto, fontWeight: 600, margin: "0 0 14px", fontFamily: FONTES.corpo }}>{titulo}</p>
      {children}
    </div>
  );
}

export default function DashboardSupervisao() {
  const [dados, setDados] = useState<Indicadores | null>(null);
  const [condominios, setCondominios] = useState<{ id: string; nome: string }[]>([]);
  const [condominioId, setCondominioId] = useState<string | null>(null);
  const [condominiosCarregados, setCondominiosCarregados] = useState(false);

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
    fetch(`${API_URL}/api/visitas/dashboard?condominioId=${condominioId}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then(setDados);
  }, [condominioId]);

  if (condominiosCarregados && condominios.length === 0) {
    return (
      <div style={{ background: CORES.fundo, minHeight: "100vh", display: "flex" }}>
        <NavAdmin />
        <div style={{ flex: 1, padding: "2rem", color: CORES.textoMuted, fontSize: 13, fontFamily: FONTES.corpo }}>
          Nenhum condomínio cadastrado ainda.
        </div>
      </div>
    );
  }

  if (!dados) {
    return (
      <div style={{ background: CORES.fundo, minHeight: "100vh", display: "flex" }}>
        <NavAdmin />
        <div style={{ flex: 1, padding: "2rem", color: CORES.textoMuted, fontSize: 13, fontFamily: FONTES.corpo }}>Carregando indicadores...</div>
      </div>
    );
  }

  return (
    <div style={{ background: CORES.fundo, minHeight: "100vh", display: "flex" }}>
      <NavAdmin />

      <div style={{ flex: 1, padding: "2.5rem 1.5rem" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <p
              style={{
                fontSize: 26,
                fontWeight: 900,
                color: CORES.texto,
                margin: 0,
                fontFamily: FONTES.titulo,
                letterSpacing: "-0.03em",
              }}
            >
              Dashboard de Supervisão
            </p>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#60a5fa", background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.3)", borderRadius: 999, padding: "3px 10px" }}>
              👷 Supervisão
            </span>
          </div>
          <p style={{ fontSize: 13, color: CORES.textoSecundario, margin: "0 0 16px", fontFamily: FONTES.corpo }}>
            Visão geral das rondas — separado do Dashboard de Limpeza.
          </p>

          {condominios.length > 1 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24 }}>
              {condominios.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCondominioId(c.id)}
                  style={{
                    fontSize: 12,
                    padding: "7px 14px",
                    borderRadius: 8,
                    border: condominioId === c.id ? "none" : "1px solid rgba(255,255,255,0.08)",
                    background: condominioId === c.id ? CORES.vermelho : "transparent",
                    color: condominioId === c.id ? "#fff" : "#aaa",
                    cursor: "pointer",
                    fontFamily: FONTES.corpo,
                  }}
                >
                  {c.nome}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
            <Cartao rotulo="Total de visitas" valor={dados.total} />
            <Cartao rotulo="Em andamento" valor={dados.emAndamento} destaque />
            <Cartao rotulo="Concluídas" valor={dados.concluidas} />
            <Cartao rotulo="Tempo médio" valor={dados.tempoMedioMinutos !== null ? `${dados.tempoMedioMinutos} min` : "—"} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <PainelCard titulo="Últimas 8 semanas">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={dados.graficoSemanal}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="rotulo" tick={{ fill: CORES.textoMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: CORES.textoMuted, fontSize: 11 }} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#1a1a1a", border: `1px solid ${CORES.borda}`, borderRadius: 10, fontSize: 12 }} labelStyle={{ color: CORES.texto }} />
                  <Bar dataKey="quantidade" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </PainelCard>

            <PainelCard titulo="Últimos 6 meses">
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={dados.graficoMensal}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="rotulo" tick={{ fill: CORES.textoMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: CORES.textoMuted, fontSize: 11 }} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#1a1a1a", border: `1px solid ${CORES.borda}`, borderRadius: 10, fontSize: 12 }} labelStyle={{ color: CORES.texto }} />
                  <Line type="monotone" dataKey="quantidade" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3, fill: "#60a5fa" }} />
                </LineChart>
              </ResponsiveContainer>
            </PainelCard>
          </div>

          <PainelCard titulo="Por turno">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Object.entries(dados.porTurno).map(([turno, quantidade]) => (
                <div key={turno} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: CORES.textoSecundario }}>
                  <span>{TURNO_LABEL[turno] ?? turno}</span>
                  <span style={{ color: CORES.texto, fontWeight: 600 }}>{quantidade}</span>
                </div>
              ))}
            </div>
          </PainelCard>
        </div>
      </div>
    </div>
  );
}
