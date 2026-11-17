import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend } from "recharts";
import EstoquePagina, { Campo } from "../components/EstoquePagina";
import { CORES } from "../theme";
import {
  apiEstoque,
  estiloBotaoPequeno,
  estiloCampo,
  estiloCartao,
  estiloGrade,
  formatarMoeda,
  SETOR_LABEL,
  type Contrato,
  type Setor,
  type Uniforme,
} from "../lib/estoque";

// Dashboard do Estoque de uniformes (Fase 3) — Admin Master e
// Responsável pelo estoque. Dados de GET /api/estoque/dashboard.
// Saldo = foto de agora; entradas/saídas = período escolhido.

interface Dados {
  periodo: { de: string | null; ate: string | null; agrupamento: "DIA" | "MES" };
  cartoes: {
    itensCadastrados: number;
    pecasEmEstoque: number;
    valorEmEstoque: number;
    pecasEmEstoqueSemValor: number;
    estoqueBaixo: number;
    requisicoesAbertas: number;
    entradasQtd: number;
    entradasValor: number;
    entradasSemValor: number;
    saidasQtd: number;
    saidasValor: number;
    saidasSemValor: number;
  };
  saldo: {
    id: string;
    nome: string;
    tamanho: string;
    saldo: number;
    estoqueMinimo: number;
    estoqueBaixo: boolean;
    valorUnitario: number | null;
    valorEmEstoque: number | null;
  }[];
  serie: { chave: string; rotulo: string; entradasQtd: number; saidasQtd: number; entradasValor: number; saidasValor: number }[];
  consumo: {
    porSetor: { setor: Setor | "SEM_SETOR"; quantidade: number; valor: number }[];
    porContrato: { id: string; nome: string; setor: Setor; quantidade: number; valor: number }[];
    maisSolicitados: { nome: string; tamanho: string; quantidade: number }[];
    porMotivo: { motivo: string; rotulo: string; quantidade: number }[];
  };
}

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

const COR_ENTRADA = "#22c55e";
const COR_SAIDA = "#f59e0b";
const COR_SETOR: Record<string, string> = { PUBLICO: "#60a5fa", PRIVADO: "#FF3B3B", SEM_SETOR: "#8a8a8a" };
const numero = (n: number) => n.toLocaleString("pt-BR");
const estiloTooltip = { background: "#1a1a1a", border: `1px solid ${CORES.borda}`, borderRadius: 10, fontSize: 12 };

function Indicador({ rotulo, valor, detalhe, destaque }: { rotulo: string; valor: string; detalhe?: string; destaque?: boolean }) {
  return (
    <div style={estiloCartao}>
      <p style={{ fontSize: 12, color: "#8a8a8a", margin: "0 0 6px" }}>{rotulo}</p>
      <p style={{ fontSize: 24, fontWeight: 900, margin: 0, color: destaque ? CORES.vermelho : "#fff", letterSpacing: "-0.02em" }}>{valor}</p>
      {detalhe && <p style={{ fontSize: 11, color: "#8a8a8a", margin: "4px 0 0" }}>{detalhe}</p>}
    </div>
  );
}

function Painel({ titulo, children, extra }: { titulo: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <div style={{ ...estiloCartao, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>{titulo}</p>
        {extra}
      </div>
      {children}
    </div>
  );
}

function Vazio({ texto = "Nenhuma saída no período." }: { texto?: string }) {
  return <p style={{ fontSize: 12, color: "#8a8a8a", margin: 0 }}>{texto}</p>;
}

// Linha com barra proporcional (rankings).
function LinhaBarra({ rotulo, quantidade, maximo, cor, extra }: { rotulo: string; quantidade: number; maximo: number; cor: string; extra?: string }) {
  const largura = maximo > 0 ? Math.max(3, (quantidade / maximo) * 100) : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: "#ddd", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rotulo}</span>
        <span style={{ color: "#aaa", whiteSpace: "nowrap" }}>
          {numero(quantidade)} pç{extra ? ` · ${extra}` : ""}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.06)" }}>
        <div style={{ width: `${largura}%`, height: "100%", borderRadius: 999, background: cor }} />
      </div>
    </div>
  );
}

export default function EstoqueDashboard() {
  const [ano, setAno] = useState(anoAtual);
  const [mes, setMes] = useState<number | null>(new Date().getMonth());
  const [setor, setSetor] = useState<"" | Setor>("");
  const [contratoId, setContratoId] = useState("");
  const [uniforme, setUniforme] = useState("");
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [nomesUniformes, setNomesUniformes] = useState<string[]>([]);
  const [dados, setDados] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [soBaixo, setSoBaixo] = useState(false);
  const [verValores, setVerValores] = useState(false);

  // Opções dos filtros (inclui inativos: o histórico pode ter saídas para eles).
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

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    const { de, ate } = calcularPeriodo(ano, mes);
    const p = new URLSearchParams({ de, ate });
    if (setor) p.set("setor", setor);
    if (contratoId) p.set("contratoId", contratoId);
    if (uniforme) p.set("uniforme", uniforme);
    apiEstoque<Dados>("GET", `/dashboard?${p.toString()}`)
      .then((d) => ativo && setDados(d))
      .catch((e) => ativo && setErro(e.message))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [ano, mes, setor, contratoId, uniforme]);

  // Saldo agrupado por uniforme, tamanhos em ordem natural.
  const saldoAgrupado = useMemo(() => {
    if (!dados) return [];
    const grupos = new Map<string, Dados["saldo"]>();
    for (const u of dados.saldo) {
      if (soBaixo && !u.estoqueBaixo) continue;
      grupos.set(u.nome, [...(grupos.get(u.nome) ?? []), u]);
    }
    return [...grupos.entries()].map(([nome, tamanhos]) => ({
      nome,
      tamanhos: [...tamanhos].sort((a, b) => compararTamanho(a.tamanho, b.tamanho)),
      total: tamanhos.reduce((t, x) => t + x.saldo, 0),
      baixos: tamanhos.filter((x) => x.estoqueBaixo).length,
    }));
  }, [dados, soBaixo]);

  const filtroSaidas = !!setor || !!contratoId;
  const textoPeriodo = mes === null ? `Ano de ${ano}` : `${MESES[mes]} de ${ano}`;
  const c = dados?.cartoes;
  const totalSetor = dados ? dados.consumo.porSetor.reduce((t, s) => t + s.quantidade, 0) : 0;

  return (
    <EstoquePagina titulo="Dashboard do estoque" subtitulo="Saldo atual, entradas e saídas do período e para onde vão os uniformes." largura={1100}>
      {/* Filtros */}
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
        {textoPeriodo}. {filtroSaidas ? "Setor e contrato filtram só as saídas e as requisições — entradas não têm setor nem contrato. " : ""}
        Saldo e estoque baixo mostram a situação de agora.
      </p>

      {erro && <p style={{ fontSize: 13, color: CORES.vermelho }}>{erro}</p>}
      {carregando && !dados && <p style={{ fontSize: 13, color: "#8a8a8a" }}>Carregando...</p>}

      {dados && c && (
        <div style={{ opacity: carregando ? 0.55 : 1, transition: "opacity .15s", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Cartões */}
          <div style={{ ...estiloGrade, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            <Indicador rotulo="Peças em estoque" valor={numero(c.pecasEmEstoque)} detalhe={`${c.itensCadastrados} itens (uniforme + tamanho)`} />
            <Indicador
              rotulo="Valor em estoque"
              valor={formatarMoeda(c.valorEmEstoque)}
              detalhe={c.pecasEmEstoqueSemValor > 0 ? `${numero(c.pecasEmEstoqueSemValor)} pç sem valor no cadastro` : undefined}
            />
            <Indicador rotulo="Estoque baixo" valor={numero(c.estoqueBaixo)} detalhe="itens no mínimo ou abaixo" destaque={c.estoqueBaixo > 0} />
            <Indicador rotulo="Requisições abertas" valor={numero(c.requisicoesAbertas)} detalhe="agora" />
            <Indicador rotulo="Entradas no período" valor={`${numero(c.entradasQtd)} pç`} detalhe={formatarMoeda(c.entradasValor)} />
            <Indicador rotulo="Saídas no período" valor={`${numero(c.saidasQtd)} pç`} detalhe={formatarMoeda(c.saidasValor)} />
          </div>

          {(c.entradasSemValor > 0 || c.saidasSemValor > 0) && (
            <p style={{ fontSize: 12, color: "#f59e0b", margin: 0 }}>
              ⚠ Peças sem valor unitário ficaram fora dos totais em R$
              {c.entradasSemValor > 0 ? ` — entradas: ${numero(c.entradasSemValor)} pç` : ""}
              {c.saidasSemValor > 0 ? ` — saídas: ${numero(c.saidasSemValor)} pç` : ""}. Preencha o valor no cadastro do uniforme.
            </p>
          )}

          {/* Entradas x saídas */}
          <Painel
            titulo={`Entradas x saídas ${dados.periodo.agrupamento === "MES" ? "por mês" : "por dia"}`}
            extra={
              <button onClick={() => setVerValores(!verValores)} style={estiloBotaoPequeno}>
                {verValores ? "Ver em peças" : "Ver em R$"}
              </button>
            }
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dados.serie}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="rotulo" tick={{ fill: CORES.textoMuted, fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
                <YAxis
                  tick={{ fill: CORES.textoMuted, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={verValores ? 64 : 32}
                  allowDecimals={verValores}
                  tickFormatter={(v: number) => (verValores ? `R$ ${numero(v)}` : numero(v))}
                />
                <Tooltip
                  contentStyle={estiloTooltip}
                  labelStyle={{ color: CORES.texto }}
                  formatter={(v: number) => (verValores ? formatarMoeda(v) : `${numero(v)} pç`)}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey={verValores ? "entradasValor" : "entradasQtd"} name="Entradas" fill={COR_ENTRADA} radius={[3, 3, 0, 0]} />
                <Bar dataKey={verValores ? "saidasValor" : "saidasQtd"} name="Saídas" fill={COR_SAIDA} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            {dados.serie.some((b) => b.entradasQtd < 0 || b.saidasQtd < 0) && (
              <p style={{ fontSize: 11, color: "#8a8a8a", margin: "6px 0 0" }}>Barras abaixo de zero são estornos (movimentação desfeita naquele dia).</p>
            )}
          </Painel>

          {/* Consumo */}
          <div style={{ ...estiloGrade, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
            <Painel titulo="Público x Privado (saídas)">
              {dados.consumo.porSetor.length === 0 ? (
                <Vazio />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {dados.consumo.porSetor.map((s) => (
                    <LinhaBarra
                      key={s.setor}
                      rotulo={`${s.setor === "SEM_SETOR" ? "Sem setor" : SETOR_LABEL[s.setor]} · ${Math.round((s.quantidade / totalSetor) * 100)}%`}
                      quantidade={s.quantidade}
                      maximo={totalSetor}
                      cor={COR_SETOR[s.setor]}
                      extra={formatarMoeda(s.valor)}
                    />
                  ))}
                </div>
              )}
            </Painel>

            <Painel titulo="Saídas por motivo">
              {dados.consumo.porMotivo.length === 0 ? (
                <Vazio />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {dados.consumo.porMotivo.map((m) => (
                    <LinhaBarra key={m.motivo} rotulo={m.rotulo} quantidade={m.quantidade} maximo={dados.consumo.porMotivo[0].quantidade} cor="#a78bfa" />
                  ))}
                </div>
              )}
            </Painel>

            <Painel titulo="Mais solicitados (saídas)">
              {dados.consumo.maisSolicitados.length === 0 ? (
                <Vazio />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {dados.consumo.maisSolicitados.map((u) => (
                    <LinhaBarra
                      key={`${u.nome}-${u.tamanho}`}
                      rotulo={`${u.nome} · ${u.tamanho}`}
                      quantidade={u.quantidade}
                      maximo={dados.consumo.maisSolicitados[0].quantidade}
                      cor={COR_SAIDA}
                    />
                  ))}
                </div>
              )}
            </Painel>

            <Painel titulo="Saídas por contrato (top 15)">
              {dados.consumo.porContrato.length === 0 ? (
                <Vazio />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {dados.consumo.porContrato.map((ct) => (
                    <LinhaBarra
                      key={ct.id}
                      rotulo={`${ct.nome} (${SETOR_LABEL[ct.setor]})`}
                      quantidade={ct.quantidade}
                      maximo={dados.consumo.porContrato[0].quantidade}
                      cor={COR_SETOR[ct.setor]}
                      extra={formatarMoeda(ct.valor)}
                    />
                  ))}
                </div>
              )}
            </Painel>
          </div>

          {/* Saldo por uniforme e tamanho */}
          <Painel
            titulo="Saldo por uniforme e tamanho (agora)"
            extra={
              <label style={{ fontSize: 12, color: "#aaa", display: "flex", gap: 6, alignItems: "center" }}>
                <input type="checkbox" checked={soBaixo} onChange={(e) => setSoBaixo(e.target.checked)} />
                Só estoque baixo
              </label>
            }
          >
            {saldoAgrupado.length === 0 ? (
              <Vazio texto={soBaixo ? "Nenhum item com estoque baixo." : "Nenhum uniforme ativo cadastrado."} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {saldoAgrupado.map((g) => (
                  <div key={g.nome}>
                    <p style={{ fontSize: 13, fontWeight: 600, margin: "0 0 6px" }}>
                      {g.nome} <span style={{ fontSize: 12, color: "#8a8a8a", fontWeight: 400 }}>· {numero(g.total)} pç</span>
                    </p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {g.tamanhos.map((t) => (
                        <div
                          key={t.id}
                          title={`Mínimo: ${t.estoqueMinimo}${t.valorUnitario !== null ? ` · ${formatarMoeda(t.valorUnitario)} cada` : ""}`}
                          style={{
                            minWidth: 64,
                            padding: "6px 10px",
                            borderRadius: 8,
                            background: t.estoqueBaixo ? "rgba(255,59,59,0.10)" : "rgba(255,255,255,0.04)",
                            border: `1px solid ${t.estoqueBaixo ? "rgba(255,59,59,0.35)" : "rgba(255,255,255,0.08)"}`,
                          }}
                        >
                          <p style={{ fontSize: 11, color: "#8a8a8a", margin: 0 }}>{t.tamanho}</p>
                          <p style={{ fontSize: 16, fontWeight: 800, margin: 0, color: t.estoqueBaixo ? CORES.vermelho : "#fff" }}>{numero(t.saldo)}</p>
                          <p style={{ fontSize: 10, color: "#6b6b6b", margin: 0 }}>mín. {t.estoqueMinimo}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Painel>
        </div>
      )}
    </EstoquePagina>
  );
}
