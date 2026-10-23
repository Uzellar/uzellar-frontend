import { useEffect, useMemo, useState } from "react";
import EstoquePagina, { Campo } from "../components/EstoquePagina";
import {
  SETOR_LABEL,
  apiEstoque,
  estiloAreaTexto,
  estiloBotaoPrincipal,
  estiloCampo,
  estiloCartao,
  estiloGrade,
  formatarData,
  formatarDataHora,
  formatarMoeda,
  hojeISO,
  lerNumero,
  nomeUniforme,
  type Contrato,
  type Fornecedor,
  type Movimentacao,
  type Setor,
  type Uniforme,
  type UsuarioEstoque,
} from "../lib/estoque";

// Registro de ENTRADAS (compras/recebimentos) ou SAÍDAS (retiradas
// para um contrato) — a mesma tela, com o formulário de cada tipo.
// Quem registra fica gravado como responsável pela movimentação.

const OUTRA_PESSOA = "__outra__";

export default function EstoqueMovimentar({ tipo }: { tipo: "ENTRADA" | "SAIDA" }) {
  const entrada = tipo === "ENTRADA";
  const [uniformes, setUniformes] = useState<Uniforme[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioEstoque[]>([]);
  const [recentes, setRecentes] = useState<Movimentacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);

  // Formulário
  const [uniformeId, setUniformeId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [data, setData] = useState(hojeISO());
  const [compradoPor, setCompradoPor] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [notaFiscal, setNotaFiscal] = useState("");
  const [valor, setValor] = useState("");
  const [contratoId, setContratoId] = useState("");
  const [solicitante, setSolicitante] = useState("");
  const [solicitanteNome, setSolicitanteNome] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const carregarRecentes = async () => {
    setRecentes(await apiEstoque<Movimentacao[]>("GET", `/movimentacoes?tipo=${tipo}&limite=20`));
  };

  useEffect(() => {
    (async () => {
      try {
        const [u, f, c, us] = await Promise.all([
          apiEstoque<Uniforme[]>("GET", "/uniformes"),
          entrada ? apiEstoque<Fornecedor[]>("GET", "/fornecedores") : Promise.resolve([]),
          entrada ? Promise.resolve([]) : apiEstoque<Contrato[]>("GET", "/contratos"),
          entrada ? Promise.resolve([]) : apiEstoque<UsuarioEstoque[]>("GET", "/usuarios"),
        ]);
        setUniformes(u);
        setFornecedores(f as Fornecedor[]);
        setContratos(c as Contrato[]);
        setUsuarios((us as UsuarioEstoque[]).filter((x) => x.ativo));
        await carregarRecentes();
      } catch (e: any) {
        setErroCarga(e.message);
      } finally {
        setCarregando(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo]);

  const uniforme = uniformes.find((u) => u.id === uniformeId);
  const contrato = contratos.find((c) => c.id === contratoId);
  const usuarioSolicitante = usuarios.find((u) => u.id === solicitante);

  // Mesmo critério do servidor: setor do usuário; sem usuário ou sem
  // setor cadastrado, vale o setor do contrato.
  const setorPrevisto: Setor | null = usuarioSolicitante?.setor ?? contrato?.setor ?? null;

  // Uniformes agrupados por nome na lista (Camisa operacional → P, M, G...)
  const grupos = useMemo(() => {
    const mapa = new Map<string, Uniforme[]>();
    for (const u of uniformes) mapa.set(u.nome, [...(mapa.get(u.nome) ?? []), u]);
    return [...mapa.entries()];
  }, [uniformes]);

  const escolherUniforme = (id: string) => {
    setUniformeId(id);
    const u = uniformes.find((x) => x.id === id);
    if (entrada && u) {
      if (u.fornecedorId && !fornecedorId) setFornecedorId(u.fornecedorId);
      if (u.valorUnitario != null && !valor) setValor(String(u.valorUnitario).replace(".", ","));
    }
  };

  const limpar = () => {
    setQuantidade("");
    setNotaFiscal("");
    setObservacao("");
    setSolicitanteNome("");
  };

  const registrar = async () => {
    if (salvando) return;
    setErro(null);
    setSucesso(null);
    const qtd = lerNumero(quantidade);
    if (!uniformeId) return setErro("Escolha o uniforme.");
    if (!qtd || !Number.isInteger(qtd) || qtd <= 0) return setErro("Informe uma quantidade inteira maior que zero.");
    if (!entrada && uniforme && qtd > uniforme.saldo) return setErro(`Estoque insuficiente: saldo atual ${uniforme.saldo}.`);
    const valorNum = lerNumero(valor);
    if (entrada && Number.isNaN(valorNum)) return setErro("Valor unitário inválido.");
    if (!entrada) {
      if (!contratoId) return setErro("Escolha o contrato de destino.");
      if (!solicitante) return setErro("Informe quem está retirando.");
      if (solicitante === OUTRA_PESSOA && !solicitanteNome.trim()) return setErro("Informe o nome de quem está retirando.");
    }

    setSalvando(true);
    try {
      const corpo = entrada
        ? {
            uniformeId,
            quantidade: qtd,
            data,
            compradoPor: compradoPor.trim() || undefined,
            fornecedorId: fornecedorId || undefined,
            notaFiscal: notaFiscal.trim() || undefined,
            valorUnitario: valorNum,
            observacao: observacao.trim() || undefined,
          }
        : {
            uniformeId,
            quantidade: qtd,
            data,
            contratoId,
            solicitanteId: solicitante !== OUTRA_PESSOA ? solicitante : undefined,
            solicitanteNome: solicitante === OUTRA_PESSOA ? solicitanteNome.trim() : undefined,
            observacao: observacao.trim() || undefined,
          };
      const mov = await apiEstoque<Movimentacao>("POST", entrada ? "/movimentacoes/entrada" : "/movimentacoes/saida", corpo);
      setSucesso(`${entrada ? "Entrada" : "Saída"} registrada: ${mov.quantidade} × ${nomeUniforme(mov.uniforme)}. Saldo agora: ${mov.saldoPosterior}.`);
      setUniformes((lista) => lista.map((u) => (u.id === mov.uniforme.id ? { ...u, saldo: mov.saldoPosterior, estoqueBaixo: mov.saldoPosterior <= u.estoqueMinimo } : u)));
      limpar();
      await carregarRecentes();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <EstoquePagina
      titulo={entrada ? "Entradas" : "Saídas"}
      subtitulo={
        entrada
          ? "Registre os uniformes recebidos (compra, nota fiscal, fornecedor). O saldo é atualizado na hora."
          : "Registre os uniformes retirados para um contrato. O estoque nunca fica negativo."
      }
    >
      {carregando ? (
        <p style={{ fontSize: 13, color: "#8a8a8a" }}>Carregando...</p>
      ) : erroCarga ? (
        <p style={{ fontSize: 13, color: "#f87171" }}>{erroCarga}</p>
      ) : uniformes.length === 0 ? (
        <p style={{ fontSize: 13, color: "#8a8a8a" }}>Cadastre os uniformes primeiro, em "Uniformes e saldo".</p>
      ) : (
        <>
          <div style={estiloCartao}>
            <div style={estiloGrade}>
              <Campo rotulo="Uniforme e tamanho *">
                <select value={uniformeId} onChange={(e) => escolherUniforme(e.target.value)} style={estiloCampo}>
                  <option value="">Escolha...</option>
                  {grupos.map(([nome, itens]) => (
                    <optgroup key={nome} label={nome}>
                      {itens.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nome} · {u.tamanho} (saldo {u.saldo})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Campo>
              <Campo rotulo={entrada ? "Quantidade recebida *" : "Quantidade retirada *"}>
                <input value={quantidade} onChange={(e) => setQuantidade(e.target.value)} inputMode="numeric" placeholder="0" style={estiloCampo} />
              </Campo>
              <Campo rotulo={entrada ? "Data da entrada *" : "Data da saída *"}>
                <input type="date" value={data} max={hojeISO()} onChange={(e) => setData(e.target.value)} style={estiloCampo} />
              </Campo>

              {entrada ? (
                <>
                  <Campo rotulo="Quem realizou a compra">
                    <input value={compradoPor} onChange={(e) => setCompradoPor(e.target.value)} style={estiloCampo} />
                  </Campo>
                  <Campo rotulo="Fornecedor">
                    <select value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)} style={estiloCampo}>
                      <option value="">— nenhum —</option>
                      {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                    </select>
                  </Campo>
                  <Campo rotulo="Número da nota fiscal">
                    <input value={notaFiscal} onChange={(e) => setNotaFiscal(e.target.value)} style={estiloCampo} />
                  </Campo>
                  <Campo rotulo="Valor unitário (R$)">
                    <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="Ex.: 39,90" style={estiloCampo} />
                  </Campo>
                </>
              ) : (
                <>
                  <Campo rotulo="Contrato de destino *">
                    <select value={contratoId} onChange={(e) => setContratoId(e.target.value)} style={estiloCampo}>
                      <option value="">Escolha...</option>
                      {contratos.map((c) => <option key={c.id} value={c.id}>{c.nome} ({SETOR_LABEL[c.setor]})</option>)}
                    </select>
                  </Campo>
                  <Campo rotulo="Quem está retirando *">
                    <select value={solicitante} onChange={(e) => setSolicitante(e.target.value)} style={estiloCampo}>
                      <option value="">Escolha...</option>
                      {usuarios.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nome}{u.setor ? ` (${SETOR_LABEL[u.setor]})` : ""}
                        </option>
                      ))}
                      <option value={OUTRA_PESSOA}>Outra pessoa (sem login no Uzellar)</option>
                    </select>
                  </Campo>
                  {solicitante === OUTRA_PESSOA && (
                    <Campo rotulo="Nome de quem está retirando *">
                      <input value={solicitanteNome} onChange={(e) => setSolicitanteNome(e.target.value)} style={estiloCampo} />
                    </Campo>
                  )}
                </>
              )}
            </div>

            <div style={{ marginTop: 10 }}>
              <Campo rotulo="Observações">
                <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} style={estiloAreaTexto} />
              </Campo>
            </div>

            {uniforme && (
              <p style={{ fontSize: 12, color: "#8a8a8a", margin: "10px 0 0" }}>
                Saldo atual de {nomeUniforme(uniforme)}: <b style={{ color: "#fff" }}>{uniforme.saldo}</b>
                {!entrada && setorPrevisto && (
                  <> · Setor desta saída: <b style={{ color: "#fff" }}>{SETOR_LABEL[setorPrevisto]}</b>{usuarioSolicitante?.setor ? " (cadastro do usuário)" : " (contrato)"}</>
                )}
              </p>
            )}
            {!entrada && <p style={{ fontSize: 12, color: "#8a8a8a", margin: "6px 0 0" }}>A liberação fica registrada no seu nome.</p>}

            {erro && <p style={{ fontSize: 12, color: "#f87171", margin: "10px 0 0" }}>{erro}</p>}
            {sucesso && <p style={{ fontSize: 12, color: "#22c55e", margin: "10px 0 0" }}>{sucesso}</p>}

            <button onClick={registrar} disabled={salvando} style={{ ...estiloBotaoPrincipal, marginTop: 12, width: "100%", opacity: salvando ? 0.6 : 1 }}>
              {salvando ? "Registrando..." : entrada ? "Registrar entrada" : "Registrar saída"}
            </button>
          </div>

          <p style={{ fontSize: 13, fontWeight: 700, margin: "24px 0 10px" }}>Últimas {entrada ? "entradas" : "saídas"}</p>
          {recentes.length === 0 ? (
            <p style={{ fontSize: 13, color: "#8a8a8a" }}>Nenhuma {entrada ? "entrada" : "saída"} registrada ainda.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {recentes.map((m) => (
                <div key={m.id} style={{ ...estiloCartao, padding: "10px 14px", opacity: m.estornadaPor ? 0.5 : 1 }}>
                  <p style={{ fontSize: 13, margin: 0 }}>
                    <b>{m.quantidade}</b> × {nomeUniforme(m.uniforme)} · {formatarData(m.data)}
                    {m.estornadaPor && <span style={{ fontSize: 11, color: "#a78bfa" }}> (estornada)</span>}
                  </p>
                  <p style={{ fontSize: 12, color: "#8a8a8a", margin: "2px 0 0" }}>
                    {entrada
                      ? [m.fornecedor?.nome, m.notaFiscal && `NF ${m.notaFiscal}`, m.compradoPor && `comprado por ${m.compradoPor}`, m.valorUnitario != null && formatarMoeda(m.valorUnitario)].filter(Boolean).join(" · ")
                      : [m.contrato?.nome, m.setor && SETOR_LABEL[m.setor], m.solicitanteNome && `retirado por ${m.solicitanteNome}`].filter(Boolean).join(" · ")}
                  </p>
                  <p style={{ fontSize: 11, color: "#666", margin: "2px 0 0" }}>
                    Registrado por {m.registradoPor.nome} em {formatarDataHora(m.criadoEm)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </EstoquePagina>
  );
}
