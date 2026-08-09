import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { API_URL, authHeaders } from "../lib/api";
import NavAdmin from "../components/NavAdmin";
import { CORES, FONTES, estiloCartaoVidro } from "../theme";

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

function PainelCard({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div style={{ ...estiloCartaoVidro, padding: "1.2rem" }}>
      <p style={{ fontSize: 13, color: CORES.texto, fontWeight: 600, margin: "0 0 14px", fontFamily: FONTES.corpo }}>{titulo}</p>
      {children}
    </div>
  );
}

export default function Dashboard() {
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
    fetch(`${API_URL}/api/dashboard?condominioId=${condominioId}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then(setDados);
  }, [condominioId]);

  if (condominiosCarregados && condominios.length === 0) {
    return (
      <div style={{ background: CORES.fundo, minHeight: "100vh", display: "flex" }}>
        <NavAdmin />
        <div style={{ flex: 1, padding: "2rem", color: CORES.textoMuted, fontSize: 13, fontFamily: FONTES.corpo }}>
          Nenhum condomínio cadastrado ainda.{" "}
          <a href="#/condominios" style={{ color: CORES.vermelho }}>
            Cadastrar o primeiro
          </a>
          .
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

  const maiorRanking = Math.max(...dados.rankingLocais.map((r) => r.quantidade), 1);

  return (
    <div style={{ background: CORES.fundo, minHeight: "100vh", display: "flex" }}>
      <NavAdmin />

      <div style={{ flex: 1, padding: "2.5rem 1.5rem" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <p
            style={{
              fontSize: 26,
              fontWeight: 900,
              color: CORES.texto,
              margin: "0 0 4px",
              fontFamily: FONTES.titulo,
              letterSpacing: "-0.03em",
            }}
          >
            Dashboard
          </p>
          <p style={{ fontSize: 13, color: CORES.textoSecundario, margin: "0 0 28px", fontFamily: FONTES.corpo }}>
            Visão geral das solicitações
          </p>

          {/* Cartões principais */}
          <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
            <Cartao rotulo="Total" valor={dados.total} />
            <Cartao rotulo="Abertas" valor={dados.porStatus.ABERTA ?? 0} />
            <Cartao rotulo="Em andamento" valor={dados.porStatus.EM_ANDAMENTO ?? 0} destaque />
            <Cartao rotulo="Concluídas" valor={dados.porStatus.CONCLUIDA ?? 0} />
            <Cartao rotulo="Tempo médio" valor={dados.tempoMedioHoras !== null ? `${dados.tempoMedioHoras}h` : "—"} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <PainelCard titulo="Últimas 8 semanas">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={dados.graficoSemanal}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="rotulo" tick={{ fill: CORES.textoMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: CORES.textoMuted, fontSize: 11 }} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#1a1a1a", border: `1px solid ${CORES.borda}`, borderRadius: 10, fontSize: 12 }} labelStyle={{ color: CORES.texto }} />
                  <Bar dataKey="quantidade" fill={CORES.vermelho} radius={[4, 4, 0, 0]} />
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
                  <Line type="monotone" dataKey="quantidade" stroke={CORES.vermelho} strokeWidth={2} dot={{ r: 3, fill: CORES.vermelho }} />
                </LineChart>
              </ResponsiveContainer>
            </PainelCard>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <PainelCard titulo="Locais com mais ocorrências">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {dados.rankingLocais.length === 0 && <p style={{ fontSize: 12, color: CORES.textoMuted }}>Nenhuma solicitação ainda.</p>}
                {dados.rankingLocais.map((r) => (
                  <div key={r.local}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: CORES.textoSecundario, marginBottom: 4 }}>
                      <span>{r.local}</span>
                      <span>{r.quantidade}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 4, background: "rgba(255,255,255,0.06)" }}>
                      <div style={{ height: 6, borderRadius: 4, background: CORES.vermelho, width: `${(r.quantidade / maiorRanking) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </PainelCard>

            <PainelCard titulo="Por categoria">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {Object.entries(dados.porTipo).map(([tipo, quantidade]) => (
                  <div key={tipo} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: CORES.textoSecundario }}>
                    <span>{TIPO_LABEL[tipo] ?? tipo}</span>
                    <span style={{ color: CORES.texto, fontWeight: 600 }}>{quantidade}</span>
                  </div>
                ))}
              </div>
            </PainelCard>
          </div>
        </div>
      </div>
    </div>
  );
}
