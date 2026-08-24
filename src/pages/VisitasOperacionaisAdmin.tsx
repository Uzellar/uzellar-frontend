import { useEffect, useState } from "react";
import { API_URL, authHeaders } from "../lib/api";
import NavAdmin from "../components/NavAdmin";
import { CORES, FONTES } from "../theme";

// Aba separada de propósito da tela de "Condomínios" — aqui só vive
// o que pertence ao fluxo de VISITA OPERACIONAL (supervisão): QR
// Code próprio e telefones de aviso próprios, nunca misturados com
// o fluxo de Limpeza.

interface CondominioResumo {
  id: string;
  nome: string;
}

interface CondominioDetalhado {
  id: string;
  nome: string;
  qrCodeVisitaUrl?: string;
}

interface TelefoneVisita {
  id: string;
  numero: string;
}

type TipoRespostaChecklist = "OPCOES" | "TEXTO";

interface PerguntaChecklist {
  id: string;
  texto: string;
  tipoResposta: TipoRespostaChecklist;
  opcoes: string[] | null;
  ativa: boolean;
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

export default function VisitasOperacionaisAdmin() {
  const [condominios, setCondominios] = useState<CondominioResumo[]>([]);
  const [condominioSelecionado, setCondominioSelecionado] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<CondominioDetalhado | null>(null);
  const [telefones, setTelefones] = useState<TelefoneVisita[]>([]);
  const [novoTelefone, setNovoTelefone] = useState("");
  const [salvandoTelefone, setSalvandoTelefone] = useState(false);
  const [erroTelefone, setErroTelefone] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [ano, setAno] = useState(anoAtual);
  const [mes, setMes] = useState<number | null>(new Date().getMonth());
  const [baixandoRelatorio, setBaixandoRelatorio] = useState<"pdf" | "excel" | null>(null);
  const [erroRelatorio, setErroRelatorio] = useState<string | null>(null);

  const [tipoChecklist, setTipoChecklist] = useState<"PORTARIA" | "LIMPEZA">("PORTARIA");
  const [perguntas, setPerguntas] = useState<PerguntaChecklist[]>([]);
  const [carregandoPerguntas, setCarregandoPerguntas] = useState(false);
  const [novoTexto, setNovoTexto] = useState("");
  const [novoTipoResposta, setNovoTipoResposta] = useState<TipoRespostaChecklist>("OPCOES");
  const [novasOpcoes, setNovasOpcoes] = useState("");
  const [salvandoPergunta, setSalvandoPergunta] = useState(false);
  const [erroPergunta, setErroPergunta] = useState<string | null>(null);

  const carregarCondominios = async () => {
    setCarregando(true);
    const resposta = await fetch(`${API_URL}/api/condominios`, { headers: authHeaders() });
    const lista = await resposta.json();
    setCondominios(lista);
    if (lista.length > 0 && !condominioSelecionado) setCondominioSelecionado(lista[0].id);
    setCarregando(false);
  };

  const carregarDetalhe = async (condominioId: string) => {
    const resposta = await fetch(`${API_URL}/api/condominios/${condominioId}`, { headers: authHeaders() });
    const dados = await resposta.json();
    setDetalhe(dados);
    setTelefones(dados.telefonesVisita ?? []);
  };

  useEffect(() => {
    carregarCondominios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (condominioSelecionado) carregarDetalhe(condominioSelecionado);
  }, [condominioSelecionado]);

  const carregarPerguntas = async (condominioId: string, tipo: "PORTARIA" | "LIMPEZA") => {
    setCarregandoPerguntas(true);
    const params = new URLSearchParams({ condominioId, tipo });
    const resposta = await fetch(`${API_URL}/api/checklist/gerenciar?${params.toString()}`, { headers: authHeaders() });
    setPerguntas(await resposta.json());
    setCarregandoPerguntas(false);
  };

  useEffect(() => {
    if (condominioSelecionado) carregarPerguntas(condominioSelecionado, tipoChecklist);
  }, [condominioSelecionado, tipoChecklist]);

  const criarPergunta = async () => {
    if (!condominioSelecionado || !novoTexto.trim()) return;
    if (novoTipoResposta === "OPCOES" && novasOpcoes.split(",").map((o) => o.trim()).filter(Boolean).length < 2) {
      setErroPergunta("Informe pelo menos 2 opções, separadas por vírgula.");
      return;
    }
    setSalvandoPergunta(true);
    setErroPergunta(null);
    try {
      const resposta = await fetch(`${API_URL}/api/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          condominioId: condominioSelecionado,
          tipoChecklist,
          texto: novoTexto.trim(),
          tipoResposta: novoTipoResposta,
          opcoes: novoTipoResposta === "OPCOES" ? novasOpcoes.split(",").map((o) => o.trim()).filter(Boolean) : undefined,
        }),
      });
      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => null);
        setErroPergunta(dados?.message ?? "Não foi possível adicionar essa pergunta.");
        return;
      }
      setNovoTexto("");
      setNovasOpcoes("");
      await carregarPerguntas(condominioSelecionado, tipoChecklist);
    } finally {
      setSalvandoPergunta(false);
    }
  };

  const alternarAtiva = async (pergunta: PerguntaChecklist) => {
    if (!condominioSelecionado) return;
    await fetch(`${API_URL}/api/checklist/${pergunta.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ ativa: !pergunta.ativa }),
    });
    await carregarPerguntas(condominioSelecionado, tipoChecklist);
  };

  const excluirPergunta = async (perguntaId: string) => {
    if (!condominioSelecionado) return;
    await fetch(`${API_URL}/api/checklist/${perguntaId}`, { method: "DELETE", headers: authHeaders() });
    await carregarPerguntas(condominioSelecionado, tipoChecklist);
  };

  const regenerarQrCodeVisita = async () => {
    if (!condominioSelecionado) return;
    await fetch(`${API_URL}/api/condominios/${condominioSelecionado}/qrcode-visita/regenerar`, {
      method: "POST",
      headers: authHeaders(),
    });
    await carregarDetalhe(condominioSelecionado);
  };

  const adicionarTelefone = async () => {
    if (!novoTelefone.trim() || !condominioSelecionado) return;
    setSalvandoTelefone(true);
    setErroTelefone(null);
    try {
      const resposta = await fetch(`${API_URL}/api/condominios/${condominioSelecionado}/telefones-visita`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ numero: novoTelefone.trim() }),
      });
      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => null);
        setErroTelefone(dados?.message ?? "Não foi possível adicionar esse telefone.");
        return;
      }
      setNovoTelefone("");
      await carregarDetalhe(condominioSelecionado);
    } finally {
      setSalvandoTelefone(false);
    }
  };

  const removerTelefone = async (telefoneId: string) => {
    if (!condominioSelecionado) return;
    await fetch(`${API_URL}/api/condominios/telefones-visita/${telefoneId}`, { method: "DELETE", headers: authHeaders() });
    await carregarDetalhe(condominioSelecionado);
  };

  const baixarRelatorio = async (formato: "pdf" | "excel") => {
    if (!condominioSelecionado) return;
    setBaixandoRelatorio(formato);
    setErroRelatorio(null);
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
      setErroRelatorio("Não foi possível gerar o relatório. Tente novamente.");
    } finally {
      setBaixandoRelatorio(null);
    }
  };

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", display: "flex" }}>
      <NavAdmin />

      <div style={{ flex: 1, padding: "2rem 1.5rem" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <p style={{ fontSize: 22, fontWeight: 900, color: CORES.texto, margin: 0, fontFamily: FONTES.titulo, letterSpacing: "-0.02em" }}>
                Visita Operacional
              </p>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#60a5fa", background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.3)", borderRadius: 999, padding: "3px 10px" }}>
                👷 Supervisão
              </span>
            </div>
            <p style={{ fontSize: 12, color: "#8a8a8a", margin: "4px 0 0" }}>
              QR Code e telefones de aviso do fluxo de rondas do supervisor — separado do fluxo de Limpeza.
            </p>
          </div>

          {carregando ? (
            <p style={{ fontSize: 13, color: "#8a8a8a" }}>Carregando...</p>
          ) : condominios.length === 0 ? (
            <p style={{ fontSize: 13, color: "#8a8a8a" }}>Nenhum condomínio cadastrado ainda — crie um na aba "Condomínios".</p>
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
                      background: condominioSelecionado === c.id ? "#FF3B3B" : "transparent",
                      color: condominioSelecionado === c.id ? "#fff" : "#aaa",
                      cursor: "pointer",
                    }}
                  >
                    {c.nome}
                  </button>
                ))}
              </div>

              {/* QR Code de visita operacional — próprio dessa aba, nunca o mesmo da Limpeza */}
              <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "1.1rem", marginBottom: 20, display: "flex", gap: 16, alignItems: "center" }}>
                {detalhe?.qrCodeVisitaUrl ? (
                  <img src={detalhe.qrCodeVisitaUrl} alt="QR Code de visita operacional" style={{ width: 110, height: 110, borderRadius: 8, background: "#fff" }} />
                ) : (
                  <div style={{ width: 110, height: 110, borderRadius: 8, background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#666" }}>
                    Sem QR Code
                  </div>
                )}
                <div>
                  <p style={{ fontSize: 13, color: "#fff", fontWeight: 500, margin: "0 0 4px" }}>QR Code de visita operacional</p>
                  <p style={{ fontSize: 12, color: "#8a8a8a", margin: "0 0 12px", maxWidth: 320 }}>
                    Usado pelo supervisor pra registrar o início de uma ronda — diferente do QR Code do morador (Limpeza).
                  </p>
                  <div style={{ display: "flex", gap: 12 }}>
                    {detalhe?.qrCodeVisitaUrl && (
                      <a href={detalhe.qrCodeVisitaUrl} download={`qrcode-visita-${detalhe.nome}.png`} style={{ fontSize: 12, color: "#FF3B3B", textDecoration: "none" }}>
                        Baixar
                      </a>
                    )}
                    <button onClick={regenerarQrCodeVisita} style={{ fontSize: 12, color: "#ccc", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      Gerar novamente
                    </button>
                  </div>
                </div>
              </div>

              {/* Telefones de aviso — próprios dessa aba, nunca os mesmos da Limpeza */}
              <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "1.1rem" }}>
                <p style={{ fontSize: 13, color: "#fff", fontWeight: 500, margin: "0 0 4px" }}>Telefones de aviso — WhatsApp (Supervisão)</p>
                <p style={{ fontSize: 12, color: "#8a8a8a", margin: "0 0 12px" }}>
                  Recebem uma mensagem de WhatsApp quando uma visita operacional é iniciada. Precisam ser diferentes dos telefones cadastrados na aba "Condomínios" (Limpeza).
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: telefones.length > 0 ? 12 : 0 }}>
                  {telefones.map((t) => (
                    <span
                      key={t.id}
                      style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "6px 6px 6px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", color: "#ddd" }}
                    >
                      {t.numero}
                      <button
                        onClick={() => removerTelefone(t.id)}
                        title="Remover telefone"
                        style={{ fontSize: 13, background: "transparent", border: "none", color: "#666", cursor: "pointer", padding: "0 2px", lineHeight: 1 }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    placeholder="11999999999 (DDD + número)"
                    value={novoTelefone}
                    onChange={(e) => setNovoTelefone(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && adicionarTelefone()}
                    style={{ flex: 1, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", padding: "0 10px", fontSize: 13 }}
                  />
                  <button
                    onClick={adicionarTelefone}
                    disabled={salvandoTelefone}
                    style={{ height: 36, padding: "0 14px", borderRadius: 8, background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12, fontWeight: 600 }}
                  >
                    {salvandoTelefone ? "..." : "Adicionar"}
                  </button>
                </div>
                {erroTelefone && <p style={{ fontSize: 12, color: "#ef4444", margin: "10px 0 0" }}>{erroTelefone}</p>}
              </div>

              {/* Checklist personalizado — próprio de cada condomínio, editável aqui */}
              <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "1.1rem", marginTop: 20 }}>
                <p style={{ fontSize: 13, color: "#fff", fontWeight: 500, margin: "0 0 4px" }}>Checklist personalizado</p>
                <p style={{ fontSize: 12, color: "#8a8a8a", margin: "0 0 12px" }}>
                  Perguntas que o supervisor vê na hora da ronda — cada condomínio tem o seu próprio conjunto.
                </p>

                <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                  <button
                    onClick={() => setTipoChecklist("PORTARIA")}
                    style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: tipoChecklist === "PORTARIA" ? "none" : "1px solid rgba(255,255,255,0.08)", background: tipoChecklist === "PORTARIA" ? "#60a5fa" : "transparent", color: tipoChecklist === "PORTARIA" ? "#0a0a0a" : "#aaa", fontWeight: 600, cursor: "pointer" }}
                  >
                    Turnos Diurno/Noturno (Portaria)
                  </button>
                  <button
                    onClick={() => setTipoChecklist("LIMPEZA")}
                    style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: tipoChecklist === "LIMPEZA" ? "none" : "1px solid rgba(255,255,255,0.08)", background: tipoChecklist === "LIMPEZA" ? "#60a5fa" : "transparent", color: tipoChecklist === "LIMPEZA" ? "#0a0a0a" : "#aaa", fontWeight: 600, cursor: "pointer" }}
                  >
                    Turno de Limpeza
                  </button>
                </div>

                {carregandoPerguntas ? (
                  <p style={{ fontSize: 12, color: "#8a8a8a" }}>Carregando...</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                    {perguntas.map((p) => (
                      <div
                        key={p.id}
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.03)", opacity: p.ativa ? 1 : 0.45 }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 13, color: "#fff", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.texto}</p>
                          <p style={{ fontSize: 11, color: "#666", margin: "2px 0 0" }}>
                            {p.tipoResposta === "OPCOES" ? `Opções: ${(p.opcoes ?? []).join(", ")}` : "Texto livre"}
                          </p>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button
                            onClick={() => alternarAtiva(p)}
                            style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#ccc", cursor: "pointer" }}
                          >
                            {p.ativa ? "Desativar" : "Ativar"}
                          </button>
                          <button
                            onClick={() => excluirPergunta(p.id)}
                            title="Excluir"
                            style={{ fontSize: 13, padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#f87171", cursor: "pointer" }}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                    {perguntas.length === 0 && <p style={{ fontSize: 12, color: "#666" }}>Nenhuma pergunta ainda.</p>}
                  </div>
                )}

                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>
                  <p style={{ fontSize: 12, color: "#8a8a8a", margin: "0 0 8px" }}>Adicionar pergunta</p>
                  <input
                    placeholder="Texto da pergunta"
                    value={novoTexto}
                    onChange={(e) => setNovoTexto(e.target.value)}
                    style={{ width: "100%", height: 36, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", padding: "0 10px", fontSize: 13, marginBottom: 8, boxSizing: "border-box" }}
                  />
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    <button
                      onClick={() => setNovoTipoResposta("OPCOES")}
                      style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: novoTipoResposta === "OPCOES" ? "none" : "1px solid rgba(255,255,255,0.08)", background: novoTipoResposta === "OPCOES" ? CORES.vermelho : "transparent", color: novoTipoResposta === "OPCOES" ? "#fff" : "#aaa", cursor: "pointer" }}
                    >
                      Múltipla escolha
                    </button>
                    <button
                      onClick={() => setNovoTipoResposta("TEXTO")}
                      style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: novoTipoResposta === "TEXTO" ? "none" : "1px solid rgba(255,255,255,0.08)", background: novoTipoResposta === "TEXTO" ? CORES.vermelho : "transparent", color: novoTipoResposta === "TEXTO" ? "#fff" : "#aaa", cursor: "pointer" }}
                    >
                      Texto livre
                    </button>
                  </div>
                  {novoTipoResposta === "OPCOES" && (
                    <input
                      placeholder="Opções separadas por vírgula (ex: Excelente, Boa, Regular, Ruim)"
                      value={novasOpcoes}
                      onChange={(e) => setNovasOpcoes(e.target.value)}
                      style={{ width: "100%", height: 36, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", padding: "0 10px", fontSize: 13, marginBottom: 8, boxSizing: "border-box" }}
                    />
                  )}
                  <button
                    onClick={criarPergunta}
                    disabled={salvandoPergunta || !novoTexto.trim()}
                    style={{ height: 36, padding: "0 16px", borderRadius: 8, background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: !novoTexto.trim() ? 0.5 : 1 }}
                  >
                    {salvandoPergunta ? "Adicionando..." : "Adicionar pergunta"}
                  </button>
                  {erroPergunta && <p style={{ fontSize: 12, color: "#ef4444", margin: "8px 0 0" }}>{erroPergunta}</p>}
                </div>
              </div>

              {/* Relatório de visitas — próprio dessa aba, nunca o mesmo relatório de Limpeza */}
              <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "1.1rem", marginTop: 20 }}>
                <p style={{ fontSize: 13, color: "#fff", fontWeight: 500, margin: "0 0 4px" }}>Relatório de visitas (Supervisão)</p>
                <p style={{ fontSize: 12, color: "#8a8a8a", margin: "0 0 12px" }}>
                  Escolha o período e baixe o relatório de visitas desse condomínio — separado do relatório de Limpeza.
                </p>
                <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                  <select
                    value={mes === null ? "todos" : mes}
                    onChange={(e) => setMes(e.target.value === "todos" ? null : Number(e.target.value))}
                    style={{ height: 36, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", padding: "0 10px", fontSize: 13 }}
                  >
                    <option value="todos">Ano inteiro</option>
                    {MESES.map((nomeMes, i) => (
                      <option key={nomeMes} value={i}>{nomeMes}</option>
                    ))}
                  </select>
                  <select
                    value={ano}
                    onChange={(e) => setAno(Number(e.target.value))}
                    style={{ height: 36, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", padding: "0 10px", fontSize: 13 }}
                  >
                    {ANOS.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => baixarRelatorio("pdf")}
                    disabled={baixandoRelatorio === "pdf"}
                    style={{ height: 34, padding: "0 14px", borderRadius: 8, background: CORES.vermelho, color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >
                    {baixandoRelatorio === "pdf" ? "Gerando..." : "Baixar PDF"}
                  </button>
                  <button
                    onClick={() => baixarRelatorio("excel")}
                    disabled={baixandoRelatorio === "excel"}
                    style={{ height: 34, padding: "0 14px", borderRadius: 8, background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >
                    {baixandoRelatorio === "excel" ? "Gerando..." : "Baixar Excel"}
                  </button>
                </div>
                {erroRelatorio && <p style={{ fontSize: 12, color: "#ef4444", margin: "10px 0 0" }}>{erroRelatorio}</p>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
