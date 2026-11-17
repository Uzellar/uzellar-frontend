import { useEffect, useState } from "react";
import EstoquePagina, { Campo } from "../components/EstoquePagina";
import { API_URL, authHeaders } from "../lib/api";
import { CORES } from "../theme";
import {
  apiEstoque,
  estiloBotaoPequeno,
  estiloCampo,
  estiloCartao,
  estiloGrade,
  type Contrato,
  type Setor,
  type Uniforme,
} from "../lib/estoque";

// Relatórios do Estoque de uniformes (Fase 4) — Admin Master e
// Responsável pelo estoque. Arquivos de GET /api/estoque/relatorios/:tipo/:formato.

type TipoRelatorio = "saidas" | "entradas" | "requisicoes" | "saldo";

const RELATORIOS: { tipo: TipoRelatorio; titulo: string; descricao: string; usa: string }[] = [
  {
    tipo: "saidas",
    titulo: "Saídas (consumo)",
    descricao: "Cada saída com uniforme, tamanho, contrato, setor, motivo, requisição, colaborador e valor. Totais por setor, motivo, contrato e uniforme.",
    usa: "Usa período, setor, contrato e uniforme.",
  },
  {
    tipo: "entradas",
    titulo: "Entradas (compras)",
    descricao: "Cada entrada com fornecedor, nota fiscal, quem comprou e valor. Totais por fornecedor e por uniforme.",
    usa: "Usa período e uniforme (entrada não tem setor nem contrato).",
  },
  {
    tipo: "requisicoes",
    titulo: "Requisições",
    descricao: "Nº, quem pediu, colaborador, contrato, motivo, status e itens entregues x pedidos. Totais por status e tempo médio até concluir.",
    usa: "Usa período (data do pedido), setor, contrato e uniforme.",
  },
  {
    tipo: "saldo",
    titulo: "Saldo atual",
    descricao: "Posição do estoque agora: uniforme, tamanho, saldo, mínimo, valor e destaque do estoque baixo.",
    usa: "Usa só o uniforme (é a situação de agora, sem período).",
  },
];

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const anoAtual = new Date().getFullYear();
const ANOS = Array.from({ length: 5 }, (_, i) => anoAtual - i);

// Mês null = ano inteiro.
function calcularPeriodo(ano: number, mes: number | null) {
  if (mes === null) return { de: `${ano}-01-01`, ate: `${ano}-12-31` };
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  const mm = String(mes + 1).padStart(2, "0");
  return { de: `${ano}-${mm}-01`, ate: `${ano}-${mm}-${ultimoDia}` };
}

export default function EstoqueRelatorios() {
  const [ano, setAno] = useState(anoAtual);
  const [mes, setMes] = useState<number | null>(new Date().getMonth());
  const [setor, setSetor] = useState<"" | Setor>("");
  const [contratoId, setContratoId] = useState("");
  const [uniforme, setUniforme] = useState("");
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [nomesUniformes, setNomesUniformes] = useState<string[]>([]);
  const [baixando, setBaixando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiEstoque<Contrato[]>("GET", "/contratos?inativos=1"),
      apiEstoque<Uniforme[]>("GET", "/uniformes?inativos=1"),
    ])
      .then(([c, u]) => {
        setContratos([...c].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
        setNomesUniformes([...new Set(u.map((x) => x.nome))].sort((a, b) => a.localeCompare(b, "pt-BR")));
      })
      .catch(() => {
        // sem as listas, os filtros de contrato/uniforme só ficam vazios
      });
  }, []);

  const baixar = async (tipo: TipoRelatorio, formato: "pdf" | "excel") => {
    const chave = `${tipo}-${formato}`;
    setBaixando(chave);
    setErro(null);
    try {
      const { de, ate } = calcularPeriodo(ano, mes);
      const p = new URLSearchParams();
      if (tipo !== "saldo") {
        p.set("de", de);
        p.set("ate", ate);
      }
      if ((tipo === "saidas" || tipo === "requisicoes") && setor) p.set("setor", setor);
      if ((tipo === "saidas" || tipo === "requisicoes") && contratoId) p.set("contratoId", contratoId);
      if (uniforme) p.set("uniforme", uniforme);
      const r = await fetch(`${API_URL}/api/estoque/relatorios/${tipo}/${formato}?${p.toString()}`, { headers: authHeaders() });
      if (!r.ok) {
        const dados = await r.json().catch(() => ({}));
        const msg = Array.isArray(dados.message) ? dados.message[0] : dados.message;
        throw new Error(msg ?? "Não foi possível gerar o relatório.");
      }
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      const sufixo = tipo === "saldo" ? new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) : mes === null ? `${ano}` : `${ano}-${String(mes + 1).padStart(2, "0")}`;
      a.download = `estoque-${tipo}-${sufixo}.${formato === "pdf" ? "pdf" : "xlsx"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setBaixando(null);
    }
  };

  return (
    <EstoquePagina titulo="Relatórios do estoque" subtitulo="Escolha os filtros e baixe cada relatório em PDF ou Excel." largura={1000}>
      <div style={{ ...estiloGrade, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", marginBottom: 8 }}>
        <Campo rotulo="Mês">
          <select value={mes === null ? "todos" : mes} onChange={(e) => setMes(e.target.value === "todos" ? null : Number(e.target.value))} style={estiloCampo}>
            <option value="todos">Ano inteiro</option>
            {MESES.map((m, i) => (
              <option key={m} value={i}>
                {m}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Ano">
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))} style={estiloCampo}>
            {ANOS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Setor">
          <select value={setor} onChange={(e) => setSetor(e.target.value as "" | Setor)} style={estiloCampo}>
            <option value="">Todos</option>
            <option value="PUBLICO">Público</option>
            <option value="PRIVADO">Privado</option>
          </select>
        </Campo>
        <Campo rotulo="Contrato">
          <select value={contratoId} onChange={(e) => setContratoId(e.target.value)} style={estiloCampo}>
            <option value="">Todos</option>
            {contratos.map((ct) => (
              <option key={ct.id} value={ct.id}>
                {ct.nome}
                {ct.ativo ? "" : " (inativo)"}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Uniforme">
          <select value={uniforme} onChange={(e) => setUniforme(e.target.value)} style={estiloCampo}>
            <option value="">Todos</option>
            {nomesUniformes.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <p style={{ fontSize: 11, color: "#8a8a8a", margin: "0 0 18px" }}>
        Cada relatório usa só os filtros que fazem sentido para ele (veja embaixo de cada um). Estornos aparecem com quantidade negativa.
      </p>

      {erro && <p style={{ fontSize: 13, color: CORES.vermelho, margin: "0 0 12px" }}>{erro}</p>}

      <div style={{ ...estiloGrade, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        {RELATORIOS.map((r) => (
          <div key={r.tipo} style={{ ...estiloCartao, display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{r.titulo}</p>
            <p style={{ fontSize: 12, color: "#bbb", margin: 0, lineHeight: 1.45 }}>{r.descricao}</p>
            <p style={{ fontSize: 11, color: "#8a8a8a", margin: 0 }}>{r.usa}</p>
            <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 6 }}>
              {(["pdf", "excel"] as const).map((f) => {
                const chave = `${r.tipo}-${f}`;
                return (
                  <button
                    key={f}
                    onClick={() => baixar(r.tipo, f)}
                    disabled={baixando !== null}
                    style={{
                      ...estiloBotaoPequeno,
                      flex: 1,
                      padding: "9px 10px",
                      color: "#fff",
                      borderColor: f === "pdf" ? "rgba(255,59,59,0.45)" : "rgba(34,197,94,0.45)",
                      opacity: baixando !== null && baixando !== chave ? 0.5 : 1,
                      cursor: baixando !== null ? "wait" : "pointer",
                    }}
                  >
                    {baixando === chave ? "Gerando..." : f === "pdf" ? "Baixar PDF" : "Baixar Excel"}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </EstoquePagina>
  );
}
