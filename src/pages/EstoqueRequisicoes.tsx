import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import EstoquePagina from "../components/EstoquePagina";
import { perfilEstaEm } from "../lib/api";
import {
  COR_STATUS_REQUISICAO,
  SETOR_LABEL,
  STATUS_REQUISICAO_LABEL,
  apiEstoque,
  estiloBotaoPrincipal,
  estiloCartao,
  estiloSelo,
  formatarDataHora,
  nomeUniforme,
  type Requisicao,
  type StatusRequisicao,
} from "../lib/estoque";

// Lista de requisições de uniforme.
// - Supervisor: só as próprias, com o botão "Nova requisição".
// - Master / Responsável pelo estoque: todas, para atender.

type Filtro = "ABERTAS" | "TODAS" | StatusRequisicao;

const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: "ABERTAS", rotulo: "Em aberto" },
  { valor: "PENDENTE", rotulo: "Pendentes" },
  { valor: "EM_SEPARACAO", rotulo: "Em separação" },
  { valor: "PARCIALMENTE_ATENDIDA", rotulo: "Parciais" },
  { valor: "AGUARDANDO_REPOSICAO", rotulo: "Aguardando reposição" },
  { valor: "CONCLUIDA", rotulo: "Concluídas" },
  { valor: "CANCELADA", rotulo: "Canceladas" },
  { valor: "TODAS", rotulo: "Todas" },
];

export default function EstoqueRequisicoes() {
  const navigate = useNavigate();
  const equipe = perfilEstaEm("ADMIN_MASTER", "ESTOQUE");
  const podePedir = perfilEstaEm("ADMIN_MASTER", "SUPERVISOR");
  const [filtro, setFiltro] = useState<Filtro>("ABERTAS");
  const [lista, setLista] = useState<Requisicao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    const qs = filtro === "ABERTAS" ? "?abertas=1" : filtro === "TODAS" ? "" : `?status=${filtro}`;
    apiEstoque<Requisicao[]>("GET", `/requisicoes${qs}`)
      .then((r) => ativo && setLista(r))
      .catch((e) => ativo && setErro(e.message))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [filtro]);

  return (
    <EstoquePagina
      titulo={equipe ? "Requisições" : "Minhas requisições"}
      subtitulo={
        equipe
          ? "Pedidos de uniforme dos supervisores. Abra uma requisição para separar e registrar a entrega."
          : "Peça uniformes para um contrato e acompanhe a entrega."
      }
      acoes={
        podePedir && (
          <button onClick={() => navigate("/estoque/requisicoes/nova")} style={estiloBotaoPrincipal}>
            + Nova requisição
          </button>
        )
      }
    >
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {FILTROS.map((f) => {
          const ativo = filtro === f.valor;
          return (
            <button
              key={f.valor}
              onClick={() => setFiltro(f.valor)}
              style={{
                fontSize: 12,
                padding: "6px 12px",
                borderRadius: 999,
                cursor: "pointer",
                border: ativo ? "1px solid #FF3B3B" : "1px solid rgba(255,255,255,0.08)",
                background: ativo ? "rgba(255,59,59,0.12)" : "transparent",
                color: ativo ? "#fff" : "#aaa",
                fontWeight: ativo ? 600 : 500,
              }}
            >
              {f.rotulo}
            </button>
          );
        })}
      </div>

      {carregando ? (
        <p style={{ fontSize: 13, color: "#8a8a8a" }}>Carregando...</p>
      ) : erro ? (
        <p style={{ fontSize: 13, color: "#f87171" }}>{erro}</p>
      ) : lista.length === 0 ? (
        <p style={{ fontSize: 13, color: "#8a8a8a" }}>Nenhuma requisição {filtro === "ABERTAS" ? "em aberto" : "neste filtro"}.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {lista.map((r) => (
            <Link key={r.id} to={`/estoque/requisicoes/${r.id}`} style={{ ...estiloCartao, padding: "12px 14px", textDecoration: "none", color: "#fff", display: "block" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <b style={{ fontSize: 14 }}>Nº {r.numero}</b>
                <span style={estiloSelo(COR_STATUS_REQUISICAO[r.status])}>{STATUS_REQUISICAO_LABEL[r.status]}</span>
                {r.podeEntregarAgora && r.status !== "PENDENTE" && <span style={estiloSelo("#22c55e")}>Tem estoque para entregar</span>}
                <span style={{ fontSize: 12, color: "#8a8a8a", marginLeft: "auto" }}>{formatarDataHora(r.criadoEm)}</span>
              </div>
              <p style={{ fontSize: 13, margin: "6px 0 0" }}>
                {r.contrato.nome} · {SETOR_LABEL[r.setor]}
                {equipe && <span style={{ color: "#8a8a8a" }}> · pedido por {r.solicitante.nome}</span>}
              </p>
              <p style={{ fontSize: 12, color: "#aaa", margin: "4px 0 0" }}>
                {r.itens.map((i) => `${i.qtdSolicitada} × ${nomeUniforme(i.uniforme)}`).join(" · ")}
              </p>
              {r.totalEntregue > 0 && r.status !== "CONCLUIDA" && (
                <p style={{ fontSize: 12, color: "#8a8a8a", margin: "4px 0 0" }}>
                  Entregue {r.totalEntregue} de {r.totalSolicitado}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </EstoquePagina>
  );
}
