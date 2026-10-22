import { useEffect, useState } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { API_URL, authHeaders } from "../lib/api";
import NavAdmin from "../components/NavAdmin";
import { CORES, FONTES, estiloCartaoVidro } from "../theme";
import SeletorCondominio from "../components/SeletorCondominio";

// Painel de indicadores do fluxo de Supervisão (visitas operacionais)
// — separado de propósito do Dashboard de Limpeza. Uma aba por turno
// (Diurno = Portaria e Zeladoria; Limpeza; Noturno = Portaria). Números
// e gráficos vêm de GET /api/visitas/dashboard?turno=...&condominioId=...
// (condominioId vazio = todos os condomínios).

type Turno = "DIURNO" | "LIMPEZA" | "NOTURNO";

const ABAS: { turno: Turno; titulo: string; subtitulo: string }[] = [
  { turno: "DIURNO", titulo: "☀️ Diurno", subtitulo: "Portaria e Zeladoria" },
  { turno: "LIMPEZA", titulo: "🧹 Limpeza", subtitulo: "Supervisão de limpeza" },
  { turno: "NOTURNO", titulo: "🌙 Noturno", subtitulo: "Portaria" },
];

interface Indicadores {
  total: number;
  concluidas: number;
  emAndamento: number;
  porTurno: Record<string, number>;
  tempoMedioMinutos: number | null;
  graficoSemanal: { rotulo: string; quantidade: number }[];
  graficoMensal: { rotulo: string; quantidade: number }[];
  porSupervisor?: { nome: string; quantidade: number; concluidas: number }[];
  rankingCondominios?: { condominioId: string; nome: string; quantidade: number }[];
}

// Lista com barra proporcional — usada no ranking e nos supervisores.
function ListaBarras({
  itens,
  vazio,
  limite,
}: {
  itens: { chave: string; nome: string; quantidade: number; detalhe?: string; destaque?: boolean }[];
  vazio: string;
  limite?: number;
}) {
  const [mostrarTodos, setMostrarTodos] = useState(false);
  if (itens.length === 0) return <p style={{ fontSize: 12, color: CORES.textoMuted, margin: 0 }}>{vazio}</p>;
  const maximo = Math.max(1, ...itens.map((i) => i.quantidade));
  const visiveis = limite && !mostrarTodos ? itens.slice(0, limite) : itens;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {visiveis.map((item, i) => (
        <div key={item.chave}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, marginBottom: 4 }}>
            <span
              style={{
                color: item.destaque ? CORES.texto : CORES.textoSecundario,
                fontWeight: item.destaque ? 700 : 400,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontFamily: FONTES.corpo,
              }}
            >
              {i + 1}. {item.nome}
            </span>
            <span style={{ color: CORES.texto, fontWeight: 600, whiteSpace: "nowrap" }}>
              {item.quantidade}
              {item.detalhe && <span style={{ color: CORES.textoMuted, fontWeight: 400 }}> · {item.detalhe}</span>}
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)" }}>
            <div
              style={{
                height: 6,
                borderRadius: 3,
                width: `${(item.quantidade / maximo) * 100}%`,
                background: item.quantidade === 0 ? "transparent" : "#60a5fa",
              }}
            />
          </div>
        </div>
      ))}
      {limite && itens.length > limite && (
        <button
          type="button"
          onClick={() => setMostrarTodos((m) => !m)}
          style={{ background: "none", border: "none", color: "#60a5fa", fontSize: 12, cursor: "pointer", padding: 0, textAlign: "left", fontFamily: FONTES.corpo }}
        >
          {mostrarTodos ? "Mostrar menos" : `Ver todos (${itens.length})`}
        </button>
      )}
    </div>
  );
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
  // "" = todos os condomínios (padrão, pra ver o ranking geral do turno).
  const [condominioId, setCondominioId] = useState<string>("");
  const [condominiosCarregados, setCondominiosCarregados] = useState(false);
  const [turno, setTurno] = useState<Turno>("DIURNO");
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/condominios`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((lista) => {
        setCondominios(lista);
        setCondominiosCarregados(true);
      });
  }, []);

  useEffect(() => {
    if (!condominiosCarregados || condominios.length === 0) return;
    let cancelado = false;
    setCarregando(true);
    const params = new URLSearchParams({ turno });
    if (condominioId) params.set("condominioId", condominioId);
    fetch(`${API_URL}/api/visitas/dashboard?${params.toString()}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelado) setDados(d);
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [condominioId, turno, condominiosCarregados, condominios.length]);

  const abaAtual = ABAS.find((a) => a.turno === turno)!;

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
            Visão geral das rondas por turno — separado do Dashboard de Limpeza.
          </p>

          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {ABAS.map((aba) => {
              const ativa = aba.turno === turno;
              return (
                <button
                  key={aba.turno}
                  type="button"
                  onClick={() => setTurno(aba.turno)}
                  style={{
                    flex: "1 1 140px",
                    textAlign: "left",
                    padding: "10px 14px",
                    borderRadius: 12,
                    cursor: "pointer",
                    background: ativa ? "rgba(96,165,250,0.14)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${ativa ? "rgba(96,165,250,0.5)" : CORES.borda}`,
                    color: ativa ? CORES.texto : CORES.textoSecundario,
                    fontFamily: FONTES.corpo,
                  }}
                >
                  <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{aba.titulo}</span>
                  <span style={{ display: "block", fontSize: 11, color: CORES.textoMuted, marginTop: 2 }}>{aba.subtitulo}</span>
                </button>
              );
            })}
          </div>

          <SeletorCondominio
            condominios={condominios}
            valor={condominioId}
            onChange={setCondominioId}
            opcaoTodos="Todos os condomínios"
            marginBottom={24}
          />

          <div style={{ opacity: carregando ? 0.5 : 1, transition: "opacity 0.15s" }}>

          <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
            <Cartao rotulo="Total de visitas" valor={dados.total} />
            <Cartao rotulo="Em andamento" valor={dados.emAndamento} destaque />
            <Cartao rotulo="Concluídas" valor={dados.concluidas} />
            <Cartao rotulo="Tempo médio" valor={dados.tempoMedioMinutos !== null ? `${dados.tempoMedioMinutos} min` : "—"} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 16 }}>
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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            <PainelCard titulo={`Ranking de condomínios — ${abaAtual.titulo.replace(/^\S+\s/, "")}`}>
              <ListaBarras
                limite={10}
                vazio="Nenhum condomínio cadastrado."
                itens={(dados.rankingCondominios ?? []).map((c) => ({
                  chave: c.condominioId,
                  nome: c.nome,
                  quantidade: c.quantidade,
                  destaque: c.condominioId === condominioId,
                }))}
              />
            </PainelCard>

            <PainelCard titulo="Visitas por supervisor">
              <ListaBarras
                limite={10}
                vazio="Nenhuma visita neste turno."
                itens={(dados.porSupervisor ?? []).map((sup) => ({
                  chave: sup.nome,
                  nome: sup.nome,
                  quantidade: sup.quantidade,
                  detalhe: `${sup.concluidas} concluída${sup.concluidas === 1 ? "" : "s"}`,
                }))}
              />
            </PainelCard>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
