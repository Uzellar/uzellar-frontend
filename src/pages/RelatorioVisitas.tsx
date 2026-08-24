import { useEffect, useState } from "react";
import { API_URL, authHeaders } from "../lib/api";
import NavAdmin from "../components/NavAdmin";
import { CORES, FONTES } from "../theme";

// Tela enxuta, só com o relatório de visitas operacionais — separada
// de propósito da tela "Visita Operacional" (que tem QR Code e
// telefone, coisas mais sensíveis). Essa aqui é o que o Supervisor
// enxerga; a outra continua só pro Admin Master.

interface CondominioResumo {
  id: string;
  nome: string;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const anoAtual = new Date().getFullYear();
const ANOS = Array.from({ length: 5 }, (_, i) => anoAtual - i);

function calcularPeriodo(ano: number, mes: number | null) {
  if (mes === null) {
    return { de: `${ano}-01-01`, ate: `${ano}-12-31` };
  }
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  const mesFormatado = String(mes + 1).padStart(2, "0");
  return { de: `${ano}-${mesFormatado}-01`, ate: `${ano}-${mesFormatado}-${ultimoDia}` };
}

export default function RelatorioVisitas() {
  const [condominios, setCondominios] = useState<CondominioResumo[]>([]);
  const [condominioSelecionado, setCondominioSelecionado] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [ano, setAno] = useState(anoAtual);
  const [mes, setMes] = useState<number | null>(new Date().getMonth());
  const [baixando, setBaixando] = useState<"pdf" | "excel" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/condominios`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((lista) => {
        setCondominios(lista);
        if (lista.length > 0) setCondominioSelecionado(lista[0].id);
        setCarregando(false);
      });
  }, []);

  const baixar = async (formato: "pdf" | "excel") => {
    if (!condominioSelecionado) return;
    setBaixando(formato);
    setErro(null);
    try {
      const { de, ate } = calcularPeriodo(ano, mes);
      const params = new URLSearchParams({ condominioId: condominioSelecionado, de, ate });
      const resposta = await fetch(`${API_URL}/api/visitas/relatorio/${formato}?${params.toString()}`, {
        headers: authHeaders(),
      });
      if (!resposta.ok) throw new Error();
      const blob = await resposta.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-visitas-uzellar.${formato === "pdf" ? "pdf" : "xlsx"}`;
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
              Relatório de Visitas
            </p>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#60a5fa", background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.3)", borderRadius: 999, padding: "3px 10px" }}>
              👷 Supervisão
            </span>
          </div>
          <p style={{ fontSize: 12, color: "#8a8a8a", margin: "4px 0 20px" }}>
            Escolha o condomínio e o período pra baixar o relatório das rondas realizadas.
          </p>

          {carregando ? (
            <p style={{ fontSize: 13, color: "#8a8a8a" }}>Carregando...</p>
          ) : condominios.length === 0 ? (
            <p style={{ fontSize: 13, color: "#8a8a8a" }}>Nenhum condomínio cadastrado ainda.</p>
          ) : (
            <>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
                {condominios.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCondominioSelecionado(c.id)}
                    style={{
                      fontSize: 12,
                      padding: "7px 14px",
                      borderRadius: 8,
                      border: condominioSelecionado === c.id ? "none" : "1px solid rgba(255,255,255,0.08)",
                      background: condominioSelecionado === c.id ? CORES.vermelho : "transparent",
                      color: condominioSelecionado === c.id ? "#fff" : "#aaa",
                      cursor: "pointer",
                    }}
                  >
                    {c.nome}
                  </button>
                ))}
              </div>

              <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "1.1rem" }}>
                <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
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
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => baixar("pdf")}
                    disabled={baixando === "pdf"}
                    style={{ height: 34, padding: "0 14px", borderRadius: 8, background: CORES.vermelho, color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >
                    {baixando === "pdf" ? "Gerando..." : "Baixar PDF"}
                  </button>
                  <button
                    onClick={() => baixar("excel")}
                    disabled={baixando === "excel"}
                    style={{ height: 34, padding: "0 14px", borderRadius: 8, background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >
                    {baixando === "excel" ? "Gerando..." : "Baixar Excel"}
                  </button>
                </div>
                {erro && <p style={{ fontSize: 12, color: "#ef4444", margin: "10px 0 0" }}>{erro}</p>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
