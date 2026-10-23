import { useEffect, useState } from "react";
import EstoquePagina, { Campo } from "../components/EstoquePagina";
import { API_URL, authHeaders } from "../lib/api";
import {
  SETOR_LABEL,
  apiEstoque,
  estiloBotaoPequeno,
  estiloBotaoPrincipal,
  estiloCampo,
  estiloCartao,
  estiloGrade,
  estiloSelo,
  type Contrato,
  type Fornecedor,
  type Setor,
} from "../lib/estoque";

// Cadastros de apoio do estoque: fornecedores e contratos de destino.
// Não há exclusão — "Desativar" tira da lista sem perder o histórico.

type Tipo = "fornecedores" | "contratos";
type Registro = Fornecedor | Contrato;

export default function EstoqueCadastros({ tipo }: { tipo: Tipo }) {
  const ehContrato = tipo === "contratos";
  const [lista, setLista] = useState<Registro[]>([]);
  const [condominios, setCondominios] = useState<{ id: string; nome: string }[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [editando, setEditando] = useState<Registro | "novo" | null>(null);

  const carregar = async () => {
    setErroCarga(null);
    try {
      setLista(await apiEstoque<Registro[]>("GET", `/${tipo}?inativos=1`));
    } catch (e: any) {
      setErroCarga(e.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
    if (ehContrato) {
      fetch(`${API_URL}/api/condominios`, { headers: authHeaders() })
        .then((r) => (r.ok ? r.json() : []))
        .then((l) => setCondominios(Array.isArray(l) ? l.map((c: any) => ({ id: c.id, nome: c.nome })) : []))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo]);

  const aoSalvar = async () => {
    setEditando(null);
    await carregar();
  };

  return (
    <EstoquePagina
      titulo={ehContrato ? "Contratos" : "Fornecedores"}
      subtitulo={ehContrato ? "Destinos das saídas de uniforme, com o setor (público ou privado)." : "Empresas de quem os uniformes são comprados."}
      largura={760}
      acoes={
        <button onClick={() => setEditando(editando === "novo" ? null : "novo")} style={{ ...estiloBotaoPrincipal, borderRadius: 9999 }}>
          {editando === "novo" ? "Cancelar" : ehContrato ? "+ Novo contrato" : "+ Novo fornecedor"}
        </button>
      }
    >
      {editando === "novo" && <Formulario tipo={tipo} condominios={condominios} aoSalvar={aoSalvar} aoCancelar={() => setEditando(null)} />}

      {carregando ? (
        <p style={{ fontSize: 13, color: "#8a8a8a" }}>Carregando...</p>
      ) : erroCarga ? (
        <p style={{ fontSize: 13, color: "#f87171" }}>{erroCarga}</p>
      ) : lista.length === 0 ? (
        <p style={{ fontSize: 13, color: "#8a8a8a" }}>Nenhum {ehContrato ? "contrato" : "fornecedor"} cadastrado ainda.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {lista.map((r) =>
            editando !== "novo" && editando?.id === r.id ? (
              <Formulario key={r.id} tipo={tipo} registro={r} condominios={condominios} aoSalvar={aoSalvar} aoCancelar={() => setEditando(null)} />
            ) : (
              <div key={r.id} style={{ ...estiloCartao, padding: "12px 16px", display: "flex", gap: 12, alignItems: "center", opacity: r.ativo ? 1 : 0.55 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
                    {r.nome} {!r.ativo && <span style={{ fontSize: 11, color: "#f87171" }}>(desativado)</span>}
                  </p>
                  <p style={{ fontSize: 12, color: "#8a8a8a", margin: "2px 0 0", overflowWrap: "anywhere" }}>
                    {ehContrato
                      ? [(r as Contrato).codigo, (r as Contrato).condominio?.nome].filter(Boolean).join(" · ")
                      : [(r as Fornecedor).cnpj, (r as Fornecedor).telefone, (r as Fornecedor).email].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {ehContrato && (
                  <span style={estiloSelo((r as Contrato).setor === "PUBLICO" ? "#60a5fa" : "#22c55e")}>{SETOR_LABEL[(r as Contrato).setor]}</span>
                )}
                <button onClick={() => setEditando(r)} style={estiloBotaoPequeno}>Editar</button>
              </div>
            ),
          )}
        </div>
      )}
    </EstoquePagina>
  );
}

function Formulario({
  tipo,
  registro,
  condominios,
  aoSalvar,
  aoCancelar,
}: {
  tipo: Tipo;
  registro?: Registro;
  condominios: { id: string; nome: string }[];
  aoSalvar: () => Promise<void>;
  aoCancelar: () => void;
}) {
  const ehContrato = tipo === "contratos";
  const c = registro as Contrato | undefined;
  const f = registro as Fornecedor | undefined;
  const [nome, setNome] = useState(registro?.nome ?? "");
  const [codigo, setCodigo] = useState(c?.codigo ?? "");
  const [setor, setSetor] = useState<Setor | "">(c?.setor ?? "");
  const [condominioId, setCondominioId] = useState(c?.condominioId ?? "");
  const [cnpj, setCnpj] = useState(f?.cnpj ?? "");
  const [telefone, setTelefone] = useState(f?.telefone ?? "");
  const [email, setEmail] = useState(f?.email ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const enviar = async (corpo: object) => {
    setSalvando(true);
    setErro(null);
    try {
      if (registro) await apiEstoque("PATCH", `/${tipo}/${registro.id}`, corpo);
      else await apiEstoque("POST", `/${tipo}`, corpo);
      await aoSalvar();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const salvar = () => {
    if (!nome.trim()) return setErro("Informe o nome.");
    if (ehContrato && !setor) return setErro("Escolha o setor do contrato.");
    if (ehContrato) {
      enviar({
        nome: nome.trim(),
        codigo: registro ? codigo.trim() : codigo.trim() || undefined,
        setor,
        condominioId: registro ? condominioId : condominioId || undefined,
      });
    } else {
      const v = (t: string) => (registro ? t.trim() : t.trim() || undefined);
      enviar({ nome: nome.trim(), cnpj: v(cnpj), telefone: v(telefone), email: v(email) });
    }
  };

  // Condomínio vinculado que não aparece na lista (ex.: quem edita não
  // tem acesso a ele) continua aparecendo como opção, para não sumir.
  const opcoesCondominio = c?.condominio && !condominios.some((x) => x.id === c.condominio!.id) ? [c.condominio, ...condominios] : condominios;

  return (
    <div style={{ ...estiloCartao, border: "1px solid rgba(255,59,59,0.25)", marginBottom: 8 }}>
      <div style={estiloGrade}>
        <Campo rotulo="Nome *"><input value={nome} onChange={(e) => setNome(e.target.value)} style={estiloCampo} /></Campo>
        {ehContrato ? (
          <>
            <Campo rotulo="Setor *">
              <select value={setor} onChange={(e) => setSetor(e.target.value as Setor)} style={estiloCampo}>
                <option value="">Escolha...</option>
                <option value="PUBLICO">Público</option>
                <option value="PRIVADO">Privado</option>
              </select>
            </Campo>
            <Campo rotulo="Código do contrato"><input value={codigo} onChange={(e) => setCodigo(e.target.value)} style={estiloCampo} /></Campo>
            {opcoesCondominio.length > 0 && (
              <Campo rotulo="Condomínio do Uzellar (opcional)">
                <select value={condominioId} onChange={(e) => setCondominioId(e.target.value)} style={estiloCampo}>
                  <option value="">— nenhum —</option>
                  {opcoesCondominio.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                </select>
              </Campo>
            )}
          </>
        ) : (
          <>
            <Campo rotulo="CNPJ"><input value={cnpj} onChange={(e) => setCnpj(e.target.value)} style={estiloCampo} /></Campo>
            <Campo rotulo="Telefone"><input value={telefone} onChange={(e) => setTelefone(e.target.value)} style={estiloCampo} /></Campo>
            <Campo rotulo="E-mail"><input value={email} onChange={(e) => setEmail(e.target.value)} style={estiloCampo} /></Campo>
          </>
        )}
      </div>
      {erro && <p style={{ fontSize: 12, color: "#f87171", margin: "10px 0 0" }}>{erro}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button onClick={salvar} disabled={salvando} style={{ ...estiloBotaoPrincipal, opacity: salvando ? 0.6 : 1 }}>
          {salvando ? "Salvando..." : registro ? "Salvar alterações" : "Cadastrar"}
        </button>
        <button onClick={aoCancelar} disabled={salvando} style={estiloBotaoPequeno}>Cancelar</button>
        <span style={{ flex: 1 }} />
        {registro && (
          <button onClick={() => enviar({ ativo: !registro.ativo })} disabled={salvando} style={estiloBotaoPequeno}>
            {registro.ativo ? "Desativar" : "Reativar"}
          </button>
        )}
      </div>
    </div>
  );
}
