import { useEffect, useMemo, useState } from "react";
import EstoquePagina, { Campo } from "../components/EstoquePagina";
import {
  apiEstoque,
  estiloAreaTexto,
  estiloBotaoPequeno,
  estiloBotaoPrincipal,
  estiloCampo,
  estiloCartao,
  estiloGrade,
  estiloRotulo,
  estiloSelo,
  formatarMoeda,
  lerNumero,
  type Fornecedor,
  type Uniforme,
} from "../lib/estoque";

// Cadastro de uniformes (um registro por tipo + tamanho) e saldo atual.
// O saldo não é editável aqui: só muda por entrada, saída ou estorno.

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function EstoqueUniformes() {
  const [uniformes, setUniformes] = useState<Uniforme[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [soBaixo, setSoBaixo] = useState(false);
  const [verInativos, setVerInativos] = useState(false);
  const [editando, setEditando] = useState<Uniforme | "novo" | null>(null);

  const carregar = async () => {
    setErroCarga(null);
    try {
      const [u, f] = await Promise.all([
        apiEstoque<Uniforme[]>("GET", `/uniformes${verInativos ? "?inativos=1" : ""}`),
        apiEstoque<Fornecedor[]>("GET", "/fornecedores"),
      ]);
      setUniformes(u);
      setFornecedores(f);
    } catch (e: any) {
      setErroCarga(e.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verInativos]);

  const filtrados = useMemo(() => {
    const termo = semAcento(busca.trim());
    return uniformes.filter(
      (u) =>
        (!soBaixo || u.estoqueBaixo) &&
        (!termo || semAcento(`${u.nome} ${u.tipo} ${u.tamanho} ${u.categoria ?? ""} ${u.fornecedor?.nome ?? ""}`).includes(termo)),
    );
  }, [uniformes, busca, soBaixo]);

  const ativos = uniformes.filter((u) => u.ativo);
  const totalPecas = ativos.reduce((s, u) => s + u.saldo, 0);
  const baixos = ativos.filter((u) => u.estoqueBaixo).length;

  return (
    <EstoquePagina
      titulo="Uniformes e saldo"
      subtitulo="Cada uniforme tem um cadastro por tamanho. O saldo muda só com entradas e saídas."
      acoes={
        <button onClick={() => setEditando(editando === "novo" ? null : "novo")} style={{ ...estiloBotaoPrincipal, borderRadius: 9999 }}>
          {editando === "novo" ? "Cancelar" : "+ Novo uniforme"}
        </button>
      }
    >
      <div style={{ ...estiloGrade, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", marginBottom: 16 }}>
        <Indicador rotulo="Itens cadastrados" valor={ativos.length} />
        <Indicador rotulo="Peças em estoque" valor={totalPecas} />
        <Indicador rotulo="Estoque baixo" valor={baixos} destaque={baixos > 0} />
      </div>

      {editando === "novo" && (
        <FormUniforme fornecedores={fornecedores} aoSalvar={async () => { setEditando(null); await carregar(); }} aoCancelar={() => setEditando(null)} />
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", margin: "16px 0 12px" }}>
        <input placeholder="Pesquisar uniforme, tipo, tamanho ou fornecedor" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ ...estiloCampo, flex: "1 1 240px", width: "auto" }} />
        <label style={{ fontSize: 12, color: "#aaa", display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={soBaixo} onChange={(e) => setSoBaixo(e.target.checked)} /> Só estoque baixo
        </label>
        <label style={{ fontSize: 12, color: "#aaa", display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={verInativos} onChange={(e) => setVerInativos(e.target.checked)} /> Mostrar desativados
        </label>
      </div>

      {carregando ? (
        <p style={{ fontSize: 13, color: "#8a8a8a" }}>Carregando...</p>
      ) : erroCarga ? (
        <p style={{ fontSize: 13, color: "#f87171" }}>{erroCarga}</p>
      ) : filtrados.length === 0 ? (
        <p style={{ fontSize: 13, color: "#8a8a8a" }}>{uniformes.length === 0 ? "Nenhum uniforme cadastrado ainda." : "Nenhum uniforme encontrado."}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtrados.map((u) =>
            editando !== "novo" && editando?.id === u.id ? (
              <FormUniforme key={u.id} uniforme={u} fornecedores={fornecedores} aoSalvar={async () => { setEditando(null); await carregar(); }} aoCancelar={() => setEditando(null)} />
            ) : (
              <div key={u.id} style={{ ...estiloCartao, padding: "12px 16px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", opacity: u.ativo ? 1 : 0.55 }}>
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
                    {u.nome} <span style={{ color: "#aaa", fontWeight: 500 }}>· {u.tamanho}</span>{" "}
                    {!u.ativo && <span style={{ fontSize: 11, color: "#f87171" }}>(desativado)</span>}
                  </p>
                  <p style={{ fontSize: 12, color: "#8a8a8a", margin: "2px 0 0" }}>
                    {[u.tipo, u.categoria, u.fornecedor?.nome, u.valorUnitario !== null ? formatarMoeda(u.valorUnitario) : null].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 20, fontWeight: 800, margin: 0, color: u.estoqueBaixo ? "#f87171" : "#fff" }}>{u.saldo}</p>
                  <p style={{ fontSize: 11, color: "#8a8a8a", margin: 0 }}>mínimo {u.estoqueMinimo}</p>
                </div>
                {u.estoqueBaixo && <span style={estiloSelo("#f87171")}>Repor</span>}
                <button onClick={() => setEditando(u)} style={estiloBotaoPequeno}>Editar</button>
              </div>
            ),
          )}
        </div>
      )}
    </EstoquePagina>
  );
}

function Indicador({ rotulo, valor, destaque }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <div style={{ ...estiloCartao, padding: "14px 16px" }}>
      <p style={{ fontSize: 12, color: "#8a8a8a", margin: 0 }}>{rotulo}</p>
      <p style={{ fontSize: 24, fontWeight: 800, margin: "4px 0 0", color: destaque ? "#f87171" : "#fff" }}>{valor.toLocaleString("pt-BR")}</p>
    </div>
  );
}

function FormUniforme({
  uniforme,
  fornecedores,
  aoSalvar,
  aoCancelar,
}: {
  uniforme?: Uniforme;
  fornecedores: Fornecedor[];
  aoSalvar: () => Promise<void>;
  aoCancelar: () => void;
}) {
  const novo = !uniforme;
  const [nome, setNome] = useState(uniforme?.nome ?? "");
  const [tipo, setTipo] = useState(uniforme?.tipo ?? "");
  const [categoria, setCategoria] = useState(uniforme?.categoria ?? "");
  const [descricao, setDescricao] = useState(uniforme?.descricao ?? "");
  const [tamanho, setTamanho] = useState(uniforme?.tamanho ?? "");
  const [fornecedorId, setFornecedorId] = useState(uniforme?.fornecedorId ?? "");
  const [valor, setValor] = useState(uniforme?.valorUnitario != null ? String(uniforme.valorUnitario).replace(".", ",") : "");
  const [minimo, setMinimo] = useState(String(uniforme?.estoqueMinimo ?? 0));
  const [saldoInicial, setSaldoInicial] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const salvar = async (extra?: { ativo: boolean }) => {
    const valorNum = lerNumero(valor);
    const minimoNum = lerNumero(minimo) ?? 0;
    const saldoNum = lerNumero(saldoInicial);
    if (!extra) {
      if (!nome.trim() || !tipo.trim() || !tamanho.trim()) return setErro("Preencha nome, tipo e tamanho.");
      if (Number.isNaN(valorNum) || (valorNum !== undefined && valorNum < 0)) return setErro("Valor unitário inválido.");
      if (!Number.isInteger(minimoNum) || minimoNum < 0) return setErro("A quantidade mínima precisa ser um número inteiro.");
      if (saldoNum !== undefined && (!Number.isInteger(saldoNum) || saldoNum < 0)) return setErro("A quantidade inicial precisa ser um número inteiro.");
    }
    setSalvando(true);
    setErro(null);
    try {
      if (extra) {
        await apiEstoque("PATCH", `/uniformes/${uniforme!.id}`, extra);
      } else if (novo) {
        await apiEstoque("POST", "/uniformes", {
          nome: nome.trim(),
          tipo: tipo.trim(),
          categoria: categoria.trim() || undefined,
          descricao: descricao.trim() || undefined,
          tamanho: tamanho.trim(),
          fornecedorId: fornecedorId || undefined,
          valorUnitario: valorNum,
          estoqueMinimo: minimoNum,
          saldoInicial: saldoNum,
        });
      } else {
        await apiEstoque("PATCH", `/uniformes/${uniforme!.id}`, {
          nome: nome.trim(),
          tipo: tipo.trim(),
          categoria: categoria.trim(),
          descricao: descricao.trim(),
          tamanho: tamanho.trim(),
          fornecedorId,
          valorUnitario: valorNum === undefined ? null : valorNum,
          estoqueMinimo: minimoNum,
        });
      }
      await aoSalvar();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div style={{ ...estiloCartao, border: "1px solid rgba(255,59,59,0.25)", marginBottom: 8 }}>
      <p style={{ fontSize: 14, fontWeight: 700, margin: "0 0 12px" }}>{novo ? "Novo uniforme" : `Editar ${uniforme!.nome} · ${uniforme!.tamanho}`}</p>
      <div style={estiloGrade}>
        <Campo rotulo="Nome *"><input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Camisa operacional" style={estiloCampo} /></Campo>
        <Campo rotulo="Tipo *"><input value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder="Ex.: Camisa, Calça, Jaqueta" style={estiloCampo} /></Campo>
        <Campo rotulo="Tamanho *"><input value={tamanho} onChange={(e) => setTamanho(e.target.value)} placeholder="Ex.: P, M, G, 42" style={estiloCampo} /></Campo>
        <Campo rotulo="Categoria"><input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Ex.: Portaria, Limpeza" style={estiloCampo} /></Campo>
        <Campo rotulo="Fornecedor">
          <select value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)} style={estiloCampo}>
            <option value="">— nenhum —</option>
            {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Valor unitário (R$)"><input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ex.: 39,90" inputMode="decimal" style={estiloCampo} /></Campo>
        <Campo rotulo="Quantidade mínima (alerta)"><input value={minimo} onChange={(e) => setMinimo(e.target.value)} inputMode="numeric" style={estiloCampo} /></Campo>
        {novo ? (
          <Campo rotulo="Quantidade já em estoque"><input value={saldoInicial} onChange={(e) => setSaldoInicial(e.target.value)} placeholder="0" inputMode="numeric" style={estiloCampo} /></Campo>
        ) : (
          <Campo rotulo="Saldo atual"><div style={{ ...estiloCampo, display: "flex", alignItems: "center", color: "#aaa" }}>{uniforme!.saldo} (muda só por entrada/saída)</div></Campo>
        )}
      </div>
      <div style={{ marginTop: 10 }}>
        <Campo rotulo="Descrição"><textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} style={estiloAreaTexto} /></Campo>
      </div>
      {novo && saldoInicial.trim() && (
        <p style={{ fontSize: 12, color: "#8a8a8a", margin: "8px 0 0" }}>A quantidade inicial fica registrada como uma entrada ("Saldo inicial") no histórico.</p>
      )}
      {erro && <p style={{ fontSize: 12, color: "#f87171", margin: "10px 0 0" }}>{erro}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button onClick={() => salvar()} disabled={salvando} style={{ ...estiloBotaoPrincipal, opacity: salvando ? 0.6 : 1 }}>
          {salvando ? "Salvando..." : novo ? "Cadastrar uniforme" : "Salvar alterações"}
        </button>
        <button onClick={aoCancelar} disabled={salvando} style={estiloBotaoPequeno}>Cancelar</button>
        <span style={{ flex: 1 }} />
        {!novo && (
          <button onClick={() => salvar({ ativo: !uniforme!.ativo })} disabled={salvando} style={estiloBotaoPequeno}>
            {uniforme!.ativo ? "Desativar" : "Reativar"}
          </button>
        )}
      </div>
    </div>
  );
}
