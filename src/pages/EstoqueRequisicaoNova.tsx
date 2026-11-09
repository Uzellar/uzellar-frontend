import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import EstoquePagina, { Campo } from "../components/EstoquePagina";
import {
  MOTIVO_REQUISICAO_LABEL,
  SETOR_LABEL,
  apiEstoque,
  estiloAreaTexto,
  estiloBotaoPequeno,
  estiloBotaoPrincipal,
  estiloCampo,
  estiloCartao,
  lerNumero,
  type CatalogoRequisicao,
  type MotivoRequisicao,
  type RequisicaoDetalhe,
  type Setor,
} from "../lib/estoque";

// Nova requisição de uniformes (Supervisor e Admin Master).
// Desde 11/2026: quem pede DIGITA o nome do contrato (não precisa estar
// cadastrado; o sistema cria se for novo), escolhe o setor (Público ou
// Privado) e o motivo, e monta a lista: uniforme → tamanho → quantidade.
// O supervisor só vê se cada tamanho está disponível ou em falta.

interface Linha {
  chave: number;
  nome: string;
  uniformeId: string;
  quantidade: string;
}

let proximaChave = 1;
const novaLinha = (): Linha => ({ chave: proximaChave++, nome: "", uniformeId: "", quantidade: "1" });

// Ordem natural dos tamanhos: PP, P, M, G, GG... e números em ordem crescente.
const ORDEM_TAMANHOS = ["PP", "P", "M", "G", "GG", "XG", "XGG", "EG", "EGG", "G1", "G2", "G3", "U", "UNICO", "ÚNICO"];
function compararTamanho(a: string, b: string) {
  const na = Number(a.replace(",", ".")), nb = Number(b.replace(",", "."));
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  const ia = ORDEM_TAMANHOS.indexOf(a.trim().toUpperCase()), ib = ORDEM_TAMANHOS.indexOf(b.trim().toUpperCase());
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return a.localeCompare(b, "pt-BR", { numeric: true });
}

export default function EstoqueRequisicaoNova() {
  const navigate = useNavigate();
  const [catalogo, setCatalogo] = useState<CatalogoRequisicao | null>(null);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [contratoNome, setContratoNome] = useState("");
  const [setor, setSetor] = useState<Setor | "">("");
  const [motivo, setMotivo] = useState<MotivoRequisicao | "">("");
  const [linhas, setLinhas] = useState<Linha[]>([novaLinha()]);
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    apiEstoque<CatalogoRequisicao>("GET", "/requisicoes/catalogo")
      .then(setCatalogo)
      .catch((e) => setErroCarga(e.message));
  }, []);

  // Nomes de uniforme (cada um com seus tamanhos).
  const porNome = useMemo(() => {
    const mapa = new Map<string, CatalogoRequisicao["uniformes"]>();
    for (const u of catalogo?.uniformes ?? []) mapa.set(u.nome, [...(mapa.get(u.nome) ?? []), u]);
    for (const lista of mapa.values()) lista.sort((x, y) => compararTamanho(x.tamanho, y.tamanho));
    return mapa;
  }, [catalogo]);

  // Ao digitar o nome de um contrato que já existe, já sugere o setor dele.
  const escolherContrato = (nome: string) => {
    setContratoNome(nome);
    const existente = catalogo?.contratos.find((c) => c.nome.trim().toLowerCase() === nome.trim().toLowerCase());
    if (existente && !setor) setSetor(existente.setor);
  };

  const mudar = (chave: number, campos: Partial<Linha>) =>
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...campos } : l)));

  const enviar = async () => {
    if (salvando) return;
    setErro(null);
    if (!contratoNome.trim()) return setErro("Informe o nome do contrato.");
    if (!setor) return setErro("Escolha o setor: Público ou Privado.");
    if (!motivo) return setErro("Escolha o motivo da requisição.");
    const preenchidas = linhas.filter((l) => l.nome || l.uniformeId);
    if (preenchidas.length === 0) return setErro("Adicione pelo menos um uniforme.");
    const itens: { uniformeId: string; quantidade: number }[] = [];
    for (const l of preenchidas) {
      if (!l.uniformeId) return setErro(`Escolha o tamanho de "${l.nome}".`);
      const q = lerNumero(l.quantidade);
      if (!q || !Number.isInteger(q) || q <= 0) return setErro("Cada item precisa de uma quantidade inteira maior que zero.");
      if (q > 1000) return setErro("Quantidade máxima por item: 1000.");
      itens.push({ uniformeId: l.uniformeId, quantidade: q });
    }
    if (new Set(itens.map((i) => i.uniformeId)).size !== itens.length) {
      return setErro("O mesmo uniforme e tamanho aparece duas vezes. Junte numa linha só.");
    }
    setSalvando(true);
    try {
      const r = await apiEstoque<RequisicaoDetalhe>("POST", "/requisicoes", {
        contratoNome: contratoNome.trim(),
        setor,
        motivo,
        itens,
        observacao: observacao.trim() || undefined,
      });
      navigate(`/estoque/requisicoes/${r.id}`, { replace: true });
    } catch (e: any) {
      setErro(e.message);
      setSalvando(false);
    }
  };

  return (
    <EstoquePagina titulo="Nova requisição" subtitulo="Peça os uniformes de que o contrato precisa. O estoque separa e registra a entrega." largura={760}>
      {erroCarga ? (
        <p style={{ fontSize: 13, color: "#f87171" }}>{erroCarga}</p>
      ) : !catalogo ? (
        <p style={{ fontSize: 13, color: "#8a8a8a" }}>Carregando...</p>
      ) : catalogo.uniformes.length === 0 ? (
        <p style={{ fontSize: 13, color: "#8a8a8a" }}>
          Ainda não há uniformes cadastrados no estoque. Fale com o responsável pelo estoque.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={estiloCartao}>
            <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 10px" }}>1. Contrato, setor e motivo</p>
            <Campo rotulo="Nome do contrato">
              <input
                value={contratoNome}
                onChange={(e) => escolherContrato(e.target.value)}
                list="contratos-existentes"
                placeholder="Digite o nome do contrato"
                maxLength={150}
                style={estiloCampo}
              />
            </Campo>
            {/* Sugestões dos contratos já usados (evita o mesmo contrato com nomes diferentes). */}
            <datalist id="contratos-existentes">
              {catalogo.contratos.map((c) => (
                <option key={c.id} value={c.nome} />
              ))}
            </datalist>

            <p style={{ fontSize: 12, color: "#8a8a8a", margin: "12px 0 6px" }}>Setor</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(["PUBLICO", "PRIVADO"] as Setor[]).map((s) => {
                const ativo = setor === s;
                return (
                  <button key={s} type="button" onClick={() => setSetor(s)} style={{
                    minWidth: 52,
                    padding: "8px 12px",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                    border: ativo ? "1px solid #FF3B3B" : "1px solid rgba(255,255,255,0.1)",
                    background: ativo ? "rgba(255,59,59,0.15)" : "rgba(255,255,255,0.03)",
                    color: "#fff",
                  }}>
                    {SETOR_LABEL[s]}
                  </button>
                );
              })}
            </div>

            <p style={{ fontSize: 12, color: "#8a8a8a", margin: "12px 0 6px" }}>Motivo</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(Object.keys(MOTIVO_REQUISICAO_LABEL) as MotivoRequisicao[]).map((m) => {
                const ativo = motivo === m;
                return (
                  <button key={m} type="button" onClick={() => setMotivo(m)} style={{
                    minWidth: 52,
                    padding: "8px 12px",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                    border: ativo ? "1px solid #FF3B3B" : "1px solid rgba(255,255,255,0.1)",
                    background: ativo ? "rgba(255,59,59,0.15)" : "rgba(255,255,255,0.03)",
                    color: "#fff",
                  }}>
                    {MOTIVO_REQUISICAO_LABEL[m]}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={estiloCartao}>
            <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 10px" }}>2. Uniformes</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {linhas.map((l, idx) => {
                const tamanhos = porNome.get(l.nome) ?? [];
                const escolhido = tamanhos.find((t) => t.id === l.uniformeId);
                return (
                  <div key={l.chave} style={{ borderTop: idx ? "1px solid rgba(255,255,255,0.06)" : "none", paddingTop: idx ? 12 : 0 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 90px auto", gap: 8, alignItems: "end" }}>
                      <Campo rotulo="Uniforme">
                        <select
                          value={l.nome}
                          onChange={(e) => {
                            const lista = porNome.get(e.target.value) ?? [];
                            mudar(l.chave, { nome: e.target.value, uniformeId: lista.length === 1 ? lista[0].id : "" });
                          }}
                          style={estiloCampo}
                        >
                          <option value="">Escolha...</option>
                          {[...porNome.keys()].map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </Campo>
                      <Campo rotulo="Qtd.">
                        <input value={l.quantidade} onChange={(e) => mudar(l.chave, { quantidade: e.target.value })} inputMode="numeric" style={estiloCampo} />
                      </Campo>
                      <button
                        onClick={() => setLinhas((ls) => (ls.length > 1 ? ls.filter((x) => x.chave !== l.chave) : [novaLinha()]))}
                        title="Remover"
                        style={{ ...estiloBotaoPequeno, height: 38 }}
                      >
                        ✕
                      </button>
                    </div>
                    {l.nome && (
                      <div style={{ marginTop: 8 }}>
                        <span style={{ fontSize: 12, color: "#8a8a8a" }}>Tamanho:</span>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                          {tamanhos.map((t) => {
                            const ativo = t.id === l.uniformeId;
                            return (
                              <button
                                key={t.id}
                                onClick={() => mudar(l.chave, { uniformeId: t.id })}
                                style={{
                                  minWidth: 52,
                                  padding: "6px 10px",
                                  borderRadius: 8,
                                  cursor: "pointer",
                                  fontSize: 13,
                                  fontWeight: 600,
                                  border: ativo ? "1px solid #FF3B3B" : "1px solid rgba(255,255,255,0.1)",
                                  background: ativo ? "rgba(255,59,59,0.15)" : "rgba(255,255,255,0.03)",
                                  color: "#fff",
                                }}
                              >
                                {t.tamanho}
                                <span style={{ display: "block", fontSize: 10, fontWeight: 500, color: t.disponivel ? "#22c55e" : "#f87171" }}>
                                  {t.saldo !== undefined ? `saldo ${t.saldo}` : t.disponivel ? "disponível" : "em falta"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        {escolhido && !escolhido.disponivel && (
                          <p style={{ fontSize: 12, color: "#fbbf24", margin: "6px 0 0" }}>
                            Este tamanho está em falta agora. Você pode pedir assim mesmo: ele fica aguardando reposição.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={() => setLinhas((ls) => [...ls, novaLinha()])} style={{ ...estiloBotaoPequeno, marginTop: 12 }}>
              + Adicionar outro uniforme
            </button>
          </div>

          <div style={estiloCartao}>
            <Campo rotulo="Observações (opcional)">
              <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: novo colaborador no posto" style={estiloAreaTexto} />
            </Campo>
            {erro && <p style={{ fontSize: 12, color: "#f87171", margin: "10px 0 0" }}>{erro}</p>}
            <button onClick={enviar} disabled={salvando} style={{ ...estiloBotaoPrincipal, marginTop: 12, width: "100%", opacity: salvando ? 0.6 : 1 }}>
              {salvando ? "Enviando..." : "Enviar requisição"}
            </button>
          </div>
        </div>
      )}
    </EstoquePagina>
  );
}
