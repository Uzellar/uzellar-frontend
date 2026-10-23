import { useEffect, useState } from "react";
import EstoquePagina, { Campo } from "../components/EstoquePagina";
import { ehAdminMaster } from "../lib/api";
import {
  COR_TIPO,
  ROTULO_TIPO,
  SETOR_LABEL,
  apiEstoque,
  estiloBotaoPequeno,
  estiloBotaoPrincipal,
  estiloCampo,
  estiloCartao,
  estiloGrade,
  estiloSelo,
  formatarData,
  formatarDataHora,
  formatarMoeda,
  nomeUniforme,
  type Contrato,
  type Fornecedor,
  type Movimentacao,
  type Uniforme,
} from "../lib/estoque";

// Histórico completo de movimentações (rastreabilidade): quem
// registrou, quando, saldo antes/depois. O Master pode estornar uma
// entrada ou saída lançada errada — nada é apagado.

interface Filtros {
  tipo: string;
  uniformeId: string;
  contratoId: string;
  fornecedorId: string;
  setor: string;
  de: string;
  ate: string;
}

const VAZIO: Filtros = { tipo: "", uniformeId: "", contratoId: "", fornecedorId: "", setor: "", de: "", ate: "" };

export default function EstoqueHistorico() {
  const master = ehAdminMaster();
  const [filtros, setFiltros] = useState<Filtros>(VAZIO);
  const [movs, setMovs] = useState<Movimentacao[]>([]);
  const [uniformes, setUniformes] = useState<Uniforme[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const buscar = async (f: Filtros) => {
    setCarregando(true);
    setErro(null);
    try {
      const params = new URLSearchParams({ limite: "500" });
      for (const [k, v] of Object.entries(f)) if (v) params.set(k, v);
      setMovs(await apiEstoque<Movimentacao[]>("GET", `/movimentacoes?${params.toString()}`));
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    Promise.all([
      apiEstoque<Uniforme[]>("GET", "/uniformes?inativos=1"),
      apiEstoque<Contrato[]>("GET", "/contratos?inativos=1"),
      apiEstoque<Fornecedor[]>("GET", "/fornecedores?inativos=1"),
    ])
      .then(([u, c, f]) => {
        setUniformes(u);
        setContratos(c);
        setFornecedores(f);
      })
      .catch(() => {});
    buscar(VAZIO);
  }, []);

  const mudar = (campo: keyof Filtros, valor: string) => setFiltros((f) => ({ ...f, [campo]: valor }));

  const totalEntradas = movs.filter((m) => m.tipo === "ENTRADA").reduce((s, m) => s + m.quantidade, 0);
  const totalSaidas = movs.filter((m) => m.tipo === "SAIDA").reduce((s, m) => s + m.quantidade, 0);
  const totalEstornos = movs.filter((m) => m.tipo === "ESTORNO").length;

  return (
    <EstoquePagina titulo="Histórico de movimentações" subtitulo="Todas as entradas, saídas e estornos, com data, horário e quem registrou.">
      <div style={estiloCartao}>
        <div style={estiloGrade}>
          <Campo rotulo="Tipo">
            <select value={filtros.tipo} onChange={(e) => mudar("tipo", e.target.value)} style={estiloCampo}>
              <option value="">Todos</option>
              <option value="ENTRADA">Entradas</option>
              <option value="SAIDA">Saídas</option>
              <option value="ESTORNO">Estornos</option>
            </select>
          </Campo>
          <Campo rotulo="Uniforme">
            <select value={filtros.uniformeId} onChange={(e) => mudar("uniformeId", e.target.value)} style={estiloCampo}>
              <option value="">Todos</option>
              {uniformes.map((u) => <option key={u.id} value={u.id}>{nomeUniforme(u)}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Contrato">
            <select value={filtros.contratoId} onChange={(e) => mudar("contratoId", e.target.value)} style={estiloCampo}>
              <option value="">Todos</option>
              {contratos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Fornecedor">
            <select value={filtros.fornecedorId} onChange={(e) => mudar("fornecedorId", e.target.value)} style={estiloCampo}>
              <option value="">Todos</option>
              {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Setor">
            <select value={filtros.setor} onChange={(e) => mudar("setor", e.target.value)} style={estiloCampo}>
              <option value="">Todos</option>
              <option value="PUBLICO">Público</option>
              <option value="PRIVADO">Privado</option>
            </select>
          </Campo>
          <Campo rotulo="De">
            <input type="date" value={filtros.de} onChange={(e) => mudar("de", e.target.value)} style={estiloCampo} />
          </Campo>
          <Campo rotulo="Até">
            <input type="date" value={filtros.ate} onChange={(e) => mudar("ate", e.target.value)} style={estiloCampo} />
          </Campo>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={() => buscar(filtros)} style={estiloBotaoPrincipal}>Filtrar</button>
          <button onClick={() => { setFiltros(VAZIO); buscar(VAZIO); }} style={estiloBotaoPequeno}>Limpar filtros</button>
        </div>
      </div>

      {!carregando && !erro && (
        <p style={{ fontSize: 12, color: "#8a8a8a", margin: "14px 0 10px" }}>
          {movs.length} movimentação(ões){movs.length === 500 ? " (mostrando as 500 mais recentes)" : ""} · entradas: <b style={{ color: "#fff" }}>{totalEntradas}</b> peças · saídas: <b style={{ color: "#fff" }}>{totalSaidas}</b> peças
          {totalEstornos > 0 && <> · estornos: <b style={{ color: "#fff" }}>{totalEstornos}</b></>}
        </p>
      )}

      {carregando ? (
        <p style={{ fontSize: 13, color: "#8a8a8a", marginTop: 14 }}>Carregando...</p>
      ) : erro ? (
        <p style={{ fontSize: 13, color: "#f87171", marginTop: 14 }}>{erro}</p>
      ) : movs.length === 0 ? (
        <p style={{ fontSize: 13, color: "#8a8a8a" }}>Nenhuma movimentação encontrada.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {movs.map((m) => (
            <LinhaMovimentacao key={m.id} mov={m} podeEstornar={master} aoEstornar={() => buscar(filtros)} />
          ))}
        </div>
      )}
    </EstoquePagina>
  );
}

function LinhaMovimentacao({ mov: m, podeEstornar, aoEstornar }: { mov: Movimentacao; podeEstornar: boolean; aoEstornar: () => void }) {
  const [abrindo, setAbrindo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const estornar = async () => {
    if (!motivo.trim() || salvando) return;
    setSalvando(true);
    setErro(null);
    try {
      await apiEstoque("POST", `/movimentacoes/${m.id}/estorno`, { motivo: motivo.trim() });
      aoEstornar();
    } catch (e: any) {
      setErro(e.message);
      setSalvando(false);
    }
  };

  const detalhes =
    m.tipo === "ENTRADA"
      ? [m.fornecedor?.nome, m.notaFiscal && `NF ${m.notaFiscal}`, m.compradoPor && `comprado por ${m.compradoPor}`, m.valorUnitario != null && `${formatarMoeda(m.valorUnitario)}/un.`]
      : [m.contrato?.nome, m.setor && SETOR_LABEL[m.setor], m.solicitanteNome && `retirado por ${m.solicitanteNome}`];

  return (
    <div style={{ ...estiloCartao, padding: "10px 14px", opacity: m.estornadaPor ? 0.55 : 1 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={estiloSelo(COR_TIPO[m.tipo])}>{ROTULO_TIPO[m.tipo]}</span>
        <p style={{ fontSize: 13, margin: 0, flex: "1 1 220px" }}>
          <b>{m.tipo === "SAIDA" ? "−" : m.tipo === "ENTRADA" ? "+" : ""}{m.quantidade}</b> × {nomeUniforme(m.uniforme)} · {formatarData(m.data)}
          <span style={{ color: "#8a8a8a" }}> · saldo {m.saldoAnterior} → {m.saldoPosterior}</span>
        </p>
        {m.estornadaPor && <span style={{ fontSize: 11, color: "#a78bfa" }}>estornada em {formatarDataHora(m.estornadaPor.criadoEm)}</span>}
        {podeEstornar && m.tipo !== "ESTORNO" && !m.estornadaPor && !abrindo && (
          <button onClick={() => setAbrindo(true)} style={estiloBotaoPequeno}>Estornar</button>
        )}
      </div>
      {detalhes.filter(Boolean).length > 0 && (
        <p style={{ fontSize: 12, color: "#8a8a8a", margin: "4px 0 0" }}>{detalhes.filter(Boolean).join(" · ")}</p>
      )}
      {m.observacao && <p style={{ fontSize: 12, color: "#aaa", margin: "4px 0 0" }}>{m.tipo === "ESTORNO" ? "Motivo: " : "Obs.: "}{m.observacao}</p>}
      <p style={{ fontSize: 11, color: "#666", margin: "4px 0 0" }}>Registrado por {m.registradoPor.nome} em {formatarDataHora(m.criadoEm)}</p>

      {abrindo && (
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            placeholder="Motivo do estorno (obrigatório)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            style={{ ...estiloCampo, flex: "1 1 240px", width: "auto" }}
          />
          <button onClick={estornar} disabled={!motivo.trim() || salvando} style={{ ...estiloBotaoPrincipal, opacity: motivo.trim() && !salvando ? 1 : 0.5 }}>
            {salvando ? "Estornando..." : "Confirmar estorno"}
          </button>
          <button onClick={() => { setAbrindo(false); setMotivo(""); setErro(null); }} disabled={salvando} style={estiloBotaoPequeno}>Cancelar</button>
          <p style={{ width: "100%", fontSize: 11, color: "#8a8a8a", margin: 0 }}>
            {m.tipo === "ENTRADA" ? `Vai retirar ${m.quantidade} peça(s) do saldo.` : `Vai devolver ${m.quantidade} peça(s) ao saldo.`} A movimentação original continua no histórico.
          </p>
          {erro && <p style={{ width: "100%", fontSize: 12, color: "#f87171", margin: 0 }}>{erro}</p>}
        </div>
      )}
    </div>
  );
}
