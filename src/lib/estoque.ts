import type { CSSProperties } from "react";
import { API_URL, authHeaders } from "./api";

// Tipos, chamadas à API e estilos compartilhados pelas telas do
// módulo "Estoque de uniformes".

export type Setor = "PUBLICO" | "PRIVADO";
export type TipoMovimentacao = "ENTRADA" | "SAIDA" | "ESTORNO";

export const SETOR_LABEL: Record<Setor, string> = { PUBLICO: "Público", PRIVADO: "Privado" };

export interface Fornecedor {
  id: string;
  nome: string;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  ativo: boolean;
}

export interface Contrato {
  id: string;
  nome: string;
  codigo: string | null;
  setor: Setor;
  ativo: boolean;
  condominioId: string | null;
  condominio: { id: string; nome: string } | null;
}

export interface Uniforme {
  id: string;
  nome: string;
  tipo: string;
  categoria: string | null;
  descricao: string | null;
  tamanho: string;
  fornecedorId: string | null;
  fornecedor: { id: string; nome: string } | null;
  valorUnitario: string | number | null; // o banco devolve decimal como texto
  estoqueMinimo: number;
  saldo: number;
  ativo: boolean;
  estoqueBaixo: boolean;
}

export interface UsuarioEstoque {
  id: string;
  nome: string;
  perfil: string;
  setor: Setor | null;
  ativo: boolean;
}

export interface Movimentacao {
  id: string;
  tipo: TipoMovimentacao;
  quantidade: number;
  saldoAnterior: number;
  saldoPosterior: number;
  data: string;
  criadoEm: string;
  observacao: string | null;
  compradoPor: string | null;
  notaFiscal: string | null;
  valorUnitario: string | number | null;
  setor: Setor | null;
  solicitanteNome: string | null;
  estornoDeId: string | null;
  uniforme: { id: string; nome: string; tipo: string; tamanho: string };
  registradoPor: { id: string; nome: string };
  solicitante: { id: string; nome: string } | null;
  contrato: { id: string; nome: string; setor: Setor } | null;
  fornecedor: { id: string; nome: string } | null;
  estornadaPor: { id: string; criadoEm: string; observacao: string | null } | null;
}

// Chamada à API do estoque. Em caso de erro, lança a mensagem que o
// servidor mandou (ex: "Estoque insuficiente...").
export async function apiEstoque<T = any>(metodo: string, caminho: string, corpo?: object): Promise<T> {
  const resposta = await fetch(`${API_URL}/api/estoque${caminho}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (!resposta.ok) {
    const dados = await resposta.json().catch(() => ({}));
    const msg = Array.isArray(dados.message) ? dados.message[0] : dados.message;
    throw new Error(msg ?? "Não foi possível concluir. Tente novamente.");
  }
  return resposta.json();
}

export function nomeUniforme(u: { nome: string; tamanho: string }) {
  return `${u.nome} · ${u.tamanho}`;
}

export function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

export function formatarMoeda(v: string | number | null | undefined) {
  if (v === null || v === undefined || v === "") return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// "AAAA-MM-DD" de hoje no horário de Brasília (valor padrão dos campos de data).
export function hojeISO() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

// Texto livre → número (aceita vírgula). Vazio = undefined.
export function lerNumero(texto: string): number | undefined {
  const bruto = texto.trim();
  // "1.234,50" ou "39,90" (formato brasileiro) → 1234.50 / 39.90; "39.90" fica como está.
  const t = bruto.includes(",") ? bruto.replace(/\./g, "").replace(",", ".") : bruto;
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

// ---------------- Estilos ----------------

export const estiloCampo: CSSProperties = {
  height: 38,
  borderRadius: 8,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#fff",
  padding: "0 10px",
  fontSize: 13,
  boxSizing: "border-box",
  width: "100%",
};

export const estiloAreaTexto: CSSProperties = {
  ...estiloCampo,
  height: 70,
  padding: "8px 10px",
  resize: "vertical",
  fontFamily: "inherit",
};

export const estiloRotulo: CSSProperties = { fontSize: 12, color: "#8a8a8a", margin: "0 0 4px", display: "block" };

export const estiloBotaoPrincipal: CSSProperties = {
  height: 38,
  padding: "0 16px",
  borderRadius: 8,
  background: "#FF3B3B",
  color: "#fff",
  border: "none",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

export const estiloBotaoPequeno: CSSProperties = {
  fontSize: 12,
  color: "#aaa",
  background: "none",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 6,
  padding: "6px 10px",
  cursor: "pointer",
};

export const estiloCartao: CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  borderRadius: 12,
  padding: "1.1rem",
};

export const estiloGrade: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 10,
};

export function estiloSelo(cor: string): CSSProperties {
  return {
    display: "inline-block",
    fontSize: 11,
    fontWeight: 700,
    color: cor,
    background: `${cor}1f`,
    border: `1px solid ${cor}4d`,
    borderRadius: 999,
    padding: "2px 9px",
    whiteSpace: "nowrap",
  };
}

export const COR_TIPO: Record<TipoMovimentacao, string> = {
  ENTRADA: "#22c55e",
  SAIDA: "#f59e0b",
  ESTORNO: "#a78bfa",
};

export const ROTULO_TIPO: Record<TipoMovimentacao, string> = {
  ENTRADA: "Entrada",
  SAIDA: "Saída",
  ESTORNO: "Estorno",
};

// ---------------- Requisições (Fase 2) ----------------

export type StatusRequisicao =
  | "PENDENTE"
  | "EM_SEPARACAO"
  | "PARCIALMENTE_ATENDIDA"
  | "AGUARDANDO_REPOSICAO"
  | "CONCLUIDA"
  | "CANCELADA";

export const STATUS_REQUISICAO_LABEL: Record<StatusRequisicao, string> = {
  PENDENTE: "Pendente",
  EM_SEPARACAO: "Em separação",
  PARCIALMENTE_ATENDIDA: "Parcialmente atendida",
  AGUARDANDO_REPOSICAO: "Aguardando reposição",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

export const COR_STATUS_REQUISICAO: Record<StatusRequisicao, string> = {
  PENDENTE: "#60a5fa",
  EM_SEPARACAO: "#f59e0b",
  PARCIALMENTE_ATENDIDA: "#fb923c",
  AGUARDANDO_REPOSICAO: "#f87171",
  CONCLUIDA: "#22c55e",
  CANCELADA: "#8a8a8a",
};

export const STATUS_ABERTOS: StatusRequisicao[] = ["PENDENTE", "EM_SEPARACAO", "PARCIALMENTE_ATENDIDA", "AGUARDANDO_REPOSICAO"];

export const ACAO_REQUISICAO_LABEL: Record<string, string> = {
  CRIADA: "Requisição criada",
  SEPARACAO: "Separação iniciada",
  ENTREGA: "Entrega registrada",
  AGUARDANDO_REPOSICAO: "Marcada como aguardando reposição",
  CANCELADA: "Requisição cancelada",
  ESTORNO_ENTREGA: "Entrega estornada",
};

// Opções para montar a requisição. "saldo" só vem para Master/estoque.
export interface CatalogoRequisicao {
  meuSetor: Setor | null;
  contratos: { id: string; nome: string; codigo: string | null; setor: Setor }[];
  uniformes: { id: string; nome: string; tipo: string; categoria: string | null; tamanho: string; disponivel: boolean; saldo?: number }[];
}

export interface ItemRequisicao {
  id: string;
  qtdSolicitada: number;
  qtdEntregue: number;
  falta: number;
  observacao: string | null;
  disponivel: boolean;
  uniforme: { id: string; nome: string; tipo: string; tamanho: string; saldo?: number };
}

export interface Requisicao {
  id: string;
  numero: number;
  status: StatusRequisicao;
  setor: Setor;
  observacao: string | null;
  motivoCancelamento: string | null;
  criadoEm: string;
  atualizadoEm: string;
  concluidaEm: string | null;
  canceladaEm: string | null;
  solicitante: { id: string; nome: string };
  contrato: { id: string; nome: string; codigo: string | null; setor: Setor };
  itens: ItemRequisicao[];
  totalSolicitado: number;
  totalEntregue: number;
  podeEntregarAgora: boolean;
}

export interface RequisicaoDetalhe extends Requisicao {
  historico: {
    id: string;
    acao: string;
    statusAnterior: StatusRequisicao | null;
    statusNovo: StatusRequisicao | null;
    observacao: string | null;
    criadoEm: string;
    usuario: { id: string; nome: string } | null;
  }[];
  entregas: {
    id: string;
    tipo: TipoMovimentacao;
    quantidade: number;
    data: string;
    criadoEm: string;
    observacao: string | null;
    requisicaoItemId: string | null;
    registradoPor: { id: string; nome: string };
    uniforme: { nome: string; tamanho: string };
  }[];
}
