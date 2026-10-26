import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import EstoquePagina, { Campo } from "../components/EstoquePagina";
import { getPerfil, perfilEstaEm } from "../lib/api";
import {
  ACAO_REQUISICAO_LABEL,
  COR_STATUS_REQUISICAO,
  SETOR_LABEL,
  STATUS_ABERTOS,
  STATUS_REQUISICAO_LABEL,
  apiEstoque,
  estiloAreaTexto,
  estiloBotaoPequeno,
  estiloBotaoPrincipal,
  estiloCampo,
  estiloCartao,
  estiloSelo,
  formatarData,
  formatarDataHora,
  hojeISO,
  lerNumero,
  nomeUniforme,
  type RequisicaoDetalhe,
} from "../lib/estoque";

// Detalhe de uma requisição. Master e Responsável pelo estoque separam,
// registram a entrega (total ou parcial), marcam "aguardando reposição"
// ou cancelam. O supervisor acompanha e pode cancelar enquanto estiver
// Pendente.

export default function EstoqueRequisicaoDetalhe() {
  const { id } = useParams();
  const equipe = perfilEstaEm("ADMIN_MASTER", "ESTOQUE");
  const [r, setR] = useState<RequisicaoDetalhe | null>(null);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [qtds, setQtds] = useState<Record<string, string>>({});
  const [data, setData] = useState(hojeISO());
  const [obsEntrega, setObsEntrega] = useState("");
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  // Sugestão de entrega: o que falta, limitado ao saldo atual.
  const aplicar = useCallback((d: RequisicaoDetalhe) => {
    setR(d);
    const q: Record<string, string> = {};
    for (const i of d.itens) q[i.id] = String(Math.max(0, Math.min(i.falta, i.uniforme.saldo ?? 0)));
    setQtds(q);
  }, []);

  const carregar = useCallback(async () => {
    try {
      aplicar(await apiEstoque<RequisicaoDetalhe>("GET", `/requisicoes/${id}`));
    } catch (e: any) {
      setErroCarga(e.message);
    }
  }, [id, aplicar]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const executar = async (acao: () => Promise<RequisicaoDetalhe>, msg: string) => {
    if (ocupado) return;
    setOcupado(true);
    setErro(null);
    setSucesso(null);
    try {
      aplicar(await acao());
      setSucesso(msg);
      setCancelando(false);
      setMotivo("");
      setObsEntrega("");
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setOcupado(false);
    }
  };

  if (erroCarga) {
    return (
      <EstoquePagina titulo="Requisição">
        <p style={{ fontSize: 13, color: "#f87171" }}>{erroCarga}</p>
        <Link to="/estoque/requisicoes" style={{ fontSize: 13, color: "#aaa" }}>← Voltar para a lista</Link>
      </EstoquePagina>
    );
  }
  if (!r) {
    return (
      <EstoquePagina titulo="Requisição">
        <p style={{ fontSize: 13, color: "#8a8a8a" }}>Carregando...</p>
      </EstoquePagina>
    );
  }

  const aberta = STATUS_ABERTOS.includes(r.status);
  const souSolicitante = getPerfil() === "SUPERVISOR"; // supervisor só abre as próprias
  const podeCancelar = aberta && (equipe || (souSolicitante && r.status === "PENDENTE"));
  const temFalta = r.itens.some((i) => i.falta > 0);

  const registrarEntrega = () => {
    const itens: { itemId: string; quantidade: number }[] = [];
    for (const i of r.itens) {
      if (i.falta === 0) continue;
      const q = lerNumero(qtds[i.id] ?? "") ?? 0;
      if (!Number.isInteger(q) || q < 0) return setErro("Quantidades precisam ser números inteiros.");
      if (q > i.falta) return setErro(`${nomeUniforme(i.uniforme)}: faltam só ${i.falta}.`);
      if (i.uniforme.saldo !== undefined && q > i.uniforme.saldo) return setErro(`${nomeUniforme(i.uniforme)}: saldo atual ${i.uniforme.saldo}.`);
      if (q > 0) itens.push({ itemId: i.id, quantidade: q });
    }
    if (itens.length === 0) return setErro("Informe a quantidade entregue de pelo menos um item.");
    executar(
      () => apiEstoque("POST", `/requisicoes/${r.id}/entrega`, { itens, data, observacao: obsEntrega.trim() || undefined }),
      "Entrega registrada. O estoque foi baixado.",
    );
  };

  return (
    <EstoquePagina
      titulo={`Requisição nº ${r.numero}`}
      subtitulo={`Pedida por ${r.solicitante.nome} em ${formatarDataHora(r.criadoEm)}`}
      acoes={<Link to="/estoque/requisicoes" style={{ ...estiloBotaoPequeno, textDecoration: "none" }}>← Lista</Link>}
      largura={820}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={estiloCartao}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={estiloSelo(COR_STATUS_REQUISICAO[r.status])}>{STATUS_REQUISICAO_LABEL[r.status]}</span>
            <span style={{ fontSize: 13 }}>
              {r.contrato.nome}{r.contrato.codigo ? ` (${r.contrato.codigo})` : ""} · Setor {SETOR_LABEL[r.setor]}
            </span>
          </div>
          <p style={{ fontSize: 12, color: "#8a8a8a", margin: "8px 0 0" }}>
            Entregue {r.totalEntregue} de {r.totalSolicitado}
            {r.concluidaEm && ` · concluída em ${formatarDataHora(r.concluidaEm)}`}
            {r.canceladaEm && ` · cancelada em ${formatarDataHora(r.canceladaEm)}`}
          </p>
          {r.observacao && <p style={{ fontSize: 12, color: "#ccc", margin: "6px 0 0" }}>Obs.: {r.observacao}</p>}
          {r.motivoCancelamento && <p style={{ fontSize: 12, color: "#f87171", margin: "6px 0 0" }}>Motivo do cancelamento: {r.motivoCancelamento}</p>}
        </div>

        {/* Itens (com campos de entrega para o estoque) */}
        <div style={estiloCartao}>
          <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 10px" }}>Itens</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {r.itens.map((i) => (
              <div key={i.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                  <p style={{ fontSize: 13, margin: 0, fontWeight: 600 }}>{nomeUniforme(i.uniforme)}</p>
                  <p style={{ fontSize: 12, color: "#8a8a8a", margin: "2px 0 0" }}>
                    Pedido {i.qtdSolicitada} · Entregue {i.qtdEntregue}
                    {i.falta > 0 && <> · <b style={{ color: "#fbbf24" }}>Falta {i.falta}</b></>}
                    {i.falta > 0 && (
                      i.uniforme.saldo !== undefined
                        ? <> · saldo {i.uniforme.saldo}</>
                        : <> · {i.disponivel ? "disponível" : "em falta no estoque"}</>
                    )}
                  </p>
                  {i.observacao && <p style={{ fontSize: 12, color: "#aaa", margin: "2px 0 0" }}>{i.observacao}</p>}
                </div>
                {equipe && aberta && i.falta > 0 && r.podeEntregarAgora && (
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#8a8a8a" }}>
                    Entregar agora
                    <input
                      value={qtds[i.id] ?? ""}
                      onChange={(e) => setQtds((q) => ({ ...q, [i.id]: e.target.value }))}
                      inputMode="numeric"
                      style={{ ...estiloCampo, width: 70 }}
                    />
                  </label>
                )}
                {i.falta === 0 && <span style={estiloSelo("#22c55e")}>Completo</span>}
              </div>
            ))}
          </div>

          {equipe && aberta && temFalta && !r.podeEntregarAgora && (
            <p style={{ fontSize: 12, color: "#fbbf24", margin: "12px 0 0" }}>
              Não há saldo para o que falta. Quando a reposição chegar, registre a entrada em "Entradas" e volte aqui para entregar.
            </p>
          )}

          {equipe && aberta && temFalta && r.podeEntregarAgora && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
                <Campo rotulo="Data da entrega">
                  <input type="date" value={data} max={hojeISO()} onChange={(e) => setData(e.target.value)} style={estiloCampo} />
                </Campo>
                <Campo rotulo="Observação da entrega">
                  <input value={obsEntrega} onChange={(e) => setObsEntrega(e.target.value)} placeholder="Opcional" style={estiloCampo} />
                </Campo>
              </div>
              <p style={{ fontSize: 12, color: "#8a8a8a", margin: "8px 0 0" }}>
                O que não for entregue agora continua na requisição, aguardando reposição. A entrega fica registrada no seu nome.
              </p>
              <button onClick={registrarEntrega} disabled={ocupado} style={{ ...estiloBotaoPrincipal, marginTop: 10, width: "100%", opacity: ocupado ? 0.6 : 1 }}>
                {ocupado ? "Registrando..." : "Confirmar entrega"}
              </button>
            </div>
          )}

          {erro && <p style={{ fontSize: 12, color: "#f87171", margin: "10px 0 0" }}>{erro}</p>}
          {sucesso && <p style={{ fontSize: 12, color: "#22c55e", margin: "10px 0 0" }}>{sucesso}</p>}
        </div>

        {/* Outras ações */}
        {(podeCancelar || (equipe && aberta)) && (
          <div style={{ ...estiloCartao, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {equipe && r.status === "PENDENTE" && (
                <button
                  onClick={() => executar(() => apiEstoque("POST", `/requisicoes/${r.id}/separacao`, {}), "Separação iniciada.")}
                  disabled={ocupado}
                  style={estiloBotaoPequeno}
                >
                  Iniciar separação
                </button>
              )}
              {equipe && ["PENDENTE", "EM_SEPARACAO", "PARCIALMENTE_ATENDIDA"].includes(r.status) && (
                <button
                  onClick={() => executar(() => apiEstoque("POST", `/requisicoes/${r.id}/aguardar-reposicao`, {}), "Marcada como aguardando reposição.")}
                  disabled={ocupado}
                  style={estiloBotaoPequeno}
                >
                  Marcar como aguardando reposição
                </button>
              )}
              {podeCancelar && !cancelando && (
                <button onClick={() => setCancelando(true)} style={{ ...estiloBotaoPequeno, color: "#f87171", borderColor: "rgba(248,113,113,0.4)" }}>
                  Cancelar requisição
                </button>
              )}
            </div>
            {cancelando && (
              <div>
                <Campo rotulo="Motivo do cancelamento *">
                  <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} style={estiloAreaTexto} />
                </Campo>
                {r.totalEntregue > 0 && (
                  <p style={{ fontSize: 12, color: "#fbbf24", margin: "6px 0 0" }}>
                    O que já foi entregue continua registrado; só o que falta deixa de ser entregue.
                  </p>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    onClick={() => {
                      if (!motivo.trim()) return setErro("Informe o motivo do cancelamento.");
                      executar(() => apiEstoque("POST", `/requisicoes/${r.id}/cancelar`, { motivo: motivo.trim() }), "Requisição cancelada.");
                    }}
                    disabled={ocupado}
                    style={{ ...estiloBotaoPrincipal, height: 34 }}
                  >
                    Confirmar cancelamento
                  </button>
                  <button onClick={() => setCancelando(false)} style={estiloBotaoPequeno}>Voltar</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Entregas (saídas do estoque ligadas a esta requisição) */}
        {r.entregas.length > 0 && (
          <div style={estiloCartao}>
            <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 8px" }}>Entregas</p>
            {r.entregas.map((m) => (
              <p key={m.id} style={{ fontSize: 12, color: m.tipo === "ESTORNO" ? "#a78bfa" : "#ccc", margin: "4px 0" }}>
                {formatarData(m.data)} · {m.tipo === "ESTORNO" ? "Estorno de " : ""}
                {m.quantidade} × {nomeUniforme(m.uniforme)} · por {m.registradoPor.nome}
              </p>
            ))}
          </div>
        )}

        {/* Histórico */}
        <div style={estiloCartao}>
          <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 8px" }}>Histórico</p>
          {r.historico.map((h) => (
            <div key={h.id} style={{ padding: "6px 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <p style={{ fontSize: 12, margin: 0 }}>
                <b>{ACAO_REQUISICAO_LABEL[h.acao] ?? h.acao}</b>
                {h.statusNovo && h.statusAnterior && h.statusNovo !== h.statusAnterior && (
                  <span style={{ color: "#8a8a8a" }}> → {STATUS_REQUISICAO_LABEL[h.statusNovo]}</span>
                )}
              </p>
              {h.observacao && <p style={{ fontSize: 12, color: "#aaa", margin: "2px 0 0" }}>{h.observacao}</p>}
              <p style={{ fontSize: 11, color: "#666", margin: "2px 0 0" }}>
                {h.usuario?.nome ?? "—"} · {formatarDataHora(h.criadoEm)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </EstoquePagina>
  );
}
