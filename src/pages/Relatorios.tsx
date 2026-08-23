import { useEffect, useState } from "react";
import { API_URL, authHeaders } from "../lib/api";
import NavAdmin from "../components/NavAdmin";
import { CORES, FONTES } from "../theme";

// Aba dedicada ao relatório do fluxo de LIMPEZA (reclamação do
// morador) — o relatório de Supervisão (visitas) fica na aba
// "Visita Operacional", de propósito separado daqui.

interface CondominioResumo {
  id: string;
  nome: string;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// Gera a lista de anos pra escolher: do ano atual até 4 anos atrás —
// cobre de sobra o histórico de um sistema que começou a rodar há
// pouco tempo, sem precisar consultar o banco pra saber o intervalo real.
const anoAtual = new Date().getFullYear();
const ANOS = Array.from({ length: 5 }, (_, i) => anoAtual - i);

// A partir do ano/mês escolhidos, calcula o início e o fim do
// período — se "mês" for null, o período vale o ano inteiro.
function calcularPeriodo(ano: number, mes: number | null) {
  if (mes === null) {
    return { de: `${ano}-01-01`, ate: `${ano}-12-31` };
  }
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  const mesFormatado = String(mes + 1).padStart(2, "0");
  return { de: `${ano}-${mesFormatado}-01`, ate: `${ano}-${mesFormatado}-${ultimoDia}` };
}

export default function Relatorios() {
  const [condominios, setCondominios] = useState<CondominioResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [baixando, setBaixando] = useState<string | null>(null); // "<condominioId>-pdf" ou "-excel"
  const [erro, setErro] = useState<string | null>(null);
  const [ano, setAno] = useState(anoAtual);
  const [mes, setMes] = useState<number | null>(new Date().getMonth());

  useEffect(() => {
    fetch(`${API_URL}/api/condominios`, { headers: authHeaders() })
      .then((r) => r.json())
      .then(setCondominios)
      .finally(() => setCarregando(false));
  }, []);

  // Mesma técnica já usada na tela de Solicitações: os relatórios
  // exigem login (Authorization no cabeçalho), então baixamos via
  // fetch e criamos um arquivo temporário na hora, só no navegador.
  const baixar = async (condominioId: string, formato: "pdf" | "excel") => {
    const chave = `${condominioId}-${formato}`;
    setBaixando(chave);
    setErro(null);
    try {
      const { de, ate } = calcularPeriodo(ano, mes);
      const params = new URLSearchParams({ condominioId, de, ate });
      const resposta = await fetch(`${API_URL}/api/relatorios/${formato}?${params.toString()}`, {
        headers: authHeaders(),
      });
      if (!resposta.ok) throw new Error();
      const blob = await resposta.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-uzellar.${formato === "pdf" ? "pdf" : "xlsx"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setErro("Não foi possível gerar o relatório. Tente novamente.");
    } finally {
      setBaixando(null);
    }
  };

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", display: "flex" }}>
      <NavAdmin />

      <div style={{ flex: 1, padding: "2rem 1.5rem" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <p style={{ fontSize: 22, fontWeight: 900, color: CORES.texto, margin: 0, fontFamily: FONTES.titulo, letterSpacing: "-0.02em" }}>
              Relatórios
            </p>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#4ade80", background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: 999, padding: "3px 10px" }}>
              🧹 Limpeza
            </span>
          </div>
          <p style={{ fontSize: 12, color: "#8a8a8a", margin: "4px 0 20px" }}>
            Escolha o período e clique num condomínio para baixar o relatório de solicitações (inclui fotos anexadas).
          </p>

          {/* Seletor de período — aplica pra qualquer condomínio que for baixado depois */}
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <select
              value={mes === null ? "todos" : mes}
              onChange={(e) => setMes(e.target.value === "todos" ? null : Number(e.target.value))}
              style={{ height: 38, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", padding: "0 10px", fontSize: 13 }}
            >
              <option value="todos">Ano inteiro</option>
              {MESES.map((nomeMes, i) => (
                <option key={nomeMes} value={i}>{nomeMes}</option>
              ))}
            </select>
            <select
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              style={{ height: 38, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", padding: "0 10px", fontSize: 13 }}
            >
              {ANOS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {erro && (
            <p style={{ fontSize: 12, color: "#ef4444", margin: "0 0 14px" }}>{erro}</p>
          )}

          {carregando ? (
            <p style={{ fontSize: 13, color: "#8a8a8a" }}>Carregando...</p>
          ) : condominios.length === 0 ? (
            <p style={{ fontSize: 13, color: "#8a8a8a" }}>Nenhum condomínio cadastrado ainda.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {condominios.map((c) => (
                <div
                  key={c.id}
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: 12,
                    padding: "1rem 1.1rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <p style={{ fontSize: 14, color: "#fff", fontWeight: 500, margin: 0 }}>{c.nome}</p>
                  <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                    <button
                      onClick={() => baixar(c.id, "pdf")}
                      disabled={baixando === `${c.id}-pdf`}
                      style={{
                        height: 34,
                        padding: "0 14px",
                        borderRadius: 8,
                        background: CORES.vermelho,
                        color: "#fff",
                        border: "none",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {baixando === `${c.id}-pdf` ? "Gerando..." : "Baixar PDF"}
                    </button>
                    <button
                      onClick={() => baixar(c.id, "excel")}
                      disabled={baixando === `${c.id}-excel`}
                      style={{
                        height: 34,
                        padding: "0 14px",
                        borderRadius: 8,
                        background: "rgba(255,255,255,0.06)",
                        color: "#fff",
                        border: "1px solid rgba(255,255,255,0.08)",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {baixando === `${c.id}-excel` ? "Gerando..." : "Baixar Excel"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
