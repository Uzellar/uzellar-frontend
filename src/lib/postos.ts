import { API_URL, authHeaders } from "./api";
import { mensagemErro } from "./mapaRonda";

// Confirmação de posto operacional (11/2026).

export const BASE_POSTOS = `${API_URL}/api/postos`;

export type Aba = "DIURNO" | "LIMPEZA" | "NOTURNO";
export type Status = "CONFIRMADO" | "FALTA" | "RECOLHIMENTO" | "FOLGA" | "VAGO" | "FERIAS";
// SEM_COBERTURA só aparece em registros antigos (a tela não oferece mais).
export type TipoCobertura = "RESERVA" | "FT" | "FREELANCER" | "OUTROS" | "SEM_COBERTURA";

export const ABAS: { aba: Aba; titulo: string; subtitulo: string }[] = [
  { aba: "DIURNO", titulo: "☀️ Diurno", subtitulo: "Portaria e Zeladoria e Manutenção" },
  { aba: "LIMPEZA", titulo: "🧹 Limpeza", subtitulo: "Diurno" },
  { aba: "NOTURNO", titulo: "🌙 Noturno", subtitulo: "Portaria" },
];

export const ROTULO_AREA: Record<string, string> = {
  PORTARIA: "Portaria",
  ZELADORIA: "Zeladoria e Manutenção",
  LIMPEZA: "Limpeza",
};

export const ROTULO_STATUS: Record<string, string> = {
  CONFIRMADO: "Confirmado",
  FALTA: "Falta",
  RECOLHIMENTO: "Recolhimento",
  FOLGA: "Folga",
  VAGO: "Posto vago",
  FERIAS: "Férias",
};

// Motivo da ida da Reserva Técnica a um posto (11/2026).
export const ROTULO_MOTIVO_RESERVA: Record<string, string> = {
  FALTA: "Falta",
  FERIAS: "Férias",
  VAGO: "Posto vago",
  RECOLHIMENTO: "Recolhimento",
  TREINAMENTO: "Treinamento",
  APOIO: "Apoio extra",
};

export const ROTULO_COBERTURA: Record<string, string> = {
  RESERVA: "Reserva Técnica",
  FT: "FT (folga trabalhada)",
  FREELANCER: "Freelancer",
  OUTROS: "Outros",
  SEM_COBERTURA: "Sem cobertura",
};

export const REGRAS: { valor: string; rotulo: string; referencia?: string }[] = [
  { valor: "IMPAR", rotulo: "12x36 — dias ímpares (turma 1)" },
  { valor: "PAR", rotulo: "12x36 — dias pares (turma 2)" },
  { valor: "SEG_SEX", rotulo: "Segunda a sexta" },
  { valor: "SEG_SAB", rotulo: "Segunda a sábado" },
  { valor: "TER_DOM", rotulo: "Terça a domingo" },
  { valor: "FDS_ALTERNADO", rotulo: "Seg a sex + fim de semana alternado", referencia: "Um sábado ou domingo em que trabalha" },
  { valor: "CICLO_5X1", rotulo: "5x1 (folga a cada 6 dias)", referencia: "Um dia de folga" },
  { valor: "CICLO_6X1", rotulo: "6x1 (folga a cada 7 dias)", referencia: "Um dia de folga" },
  { valor: "TODOS_DIAS", rotulo: "Todos os dias" },
];

export const rotuloRegra = (v: string) => REGRAS.find((r) => r.valor === v)?.rotulo ?? v;

export const CORES_STATUS = {
  verde: { fundo: "rgba(52,211,153,0.14)", borda: "rgba(52,211,153,0.55)", texto: "#34d399" },
  vermelho: { fundo: "rgba(255,59,59,0.12)", borda: "rgba(255,59,59,0.55)", texto: "#ff6b6b" },
  cinza: { fundo: "rgba(255,255,255,0.05)", borda: "rgba(255,255,255,0.18)", texto: "#a8a8a8" },
  amarelo: { fundo: "rgba(251,191,36,0.12)", borda: "rgba(251,191,36,0.5)", texto: "#fbbf24" },
};

export function corDoStatus(status?: string | null) {
  if (status === "CONFIRMADO") return CORES_STATUS.verde;
  if (status === "FALTA" || status === "RECOLHIMENTO" || status === "VAGO") return CORES_STATUS.vermelho;
  if (status === "FOLGA") return CORES_STATUS.cinza;
  if (status === "FERIAS") return CORES_STATUS.amarelo;
  return null;
}

export interface RegistroDia {
  id: string;
  status: Status;
  coberturaTipo: TipoCobertura | null;
  coberturaColaboradorId: string | null;
  coberturaNome: string | null;
  coberturaValor: number | null;
  observacao: string | null;
  // Reserva Técnica: posto para onde foi neste dia e por quê (11/2026).
  cobrindoPostoNome?: string | null;
  cobrindoMotivo?: string | null;
  cobrindoNome?: string | null;
  registradoPorNome: string;
  atualizadoEm: string;
}

export interface LinhaColaborador {
  id: string;
  nome: string;
  matricula: string | null;
  area: string;
  turno: string;
  horario: string | null;
  regraDias: string;
  dataReferencia: string | null;
  escalaTexto: string | null;
  inicioEm: string;
  vaga: boolean;
  aguardandoInicio: string | null;
  substituiNome: string | null;
  iniciante?: boolean;
  plantao: boolean | null;
  registro: RegistroDia | null;
  // Remanejamento: de onde veio (no posto novo) / para onde vai (no posto atual).
  remanejadoDe?: { inicio: string; posto: string; reserva: boolean; usuarioNome: string | null; criadoEm: string } | null;
  remanejadoPara?: { inicio: string; posto: string; usuarioNome: string | null; criadoEm: string } | null;
}

export interface PostoResumo {
  id: string;
  nome: string;
  tipo: string;
  condominioId: string | null;
  total: number;
  dePlantao: number;
  pendentes: number;
  vermelhos: number;
}

export interface ReservaOpcao {
  id: string;
  nome: string;
  matricula?: string | null;
  area: string;
  turno: string;
  horario: string | null;
  plantao: boolean | null;
  cobrindo: string | null;
}

// Apoio extra por evento (11/2026): reforço no posto que não cobre ninguém.
export interface ApoioExtra {
  id: string;
  postoId: string;
  posto?: string;
  data: string;
  area: string;
  turno: string;
  motivo: string;
  coberturaTipo: "RESERVA" | "FT" | "FREELANCER";
  coberturaColaboradorId: string | null;
  coberturaNome: string;
  coberturaValor: number | null;
  observacao: string | null;
  registradoPorNome: string;
  criadoEm: string;
}

// Colaborador que pode cobrir uma falta como FT (qualquer posto, inclusive Reserva Técnica).
export interface FtOpcao {
  id: string;
  nome: string;
  matricula: string | null;
  posto: string;
  postoTipo: string;
  mesmoPosto: boolean;
  area: string;
  turno: string;
  horario: string | null;
  plantao: boolean | null;
  situacao: string | null;
  cobrindo: string | null;
}

export function dataHoraBr(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

export async function apiPostos<T>(caminho: string, opcoes: RequestInit = {}, erroPadrao = "Não foi possível concluir. Tente de novo."): Promise<T> {
  const r = await fetch(`${BASE_POSTOS}${caminho}`, {
    ...opcoes,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(opcoes.headers ?? {}) },
  });
  if (!r.ok) throw new Error(await mensagemErro(r, erroPadrao));
  return r.json();
}

// Hoje no horário de Brasília (AAAA-MM-DD).
export function hojeBrasilia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function somarDias(data: string, dias: number): string {
  const [a, m, d] = data.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d) + dias * 86_400_000).toISOString().slice(0, 10);
}

export function dataBr(data: string | null | undefined): string {
  if (!data) return "—";
  return `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}`;
}

const SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
export function diaDaSemana(data: string): string {
  const [a, m, d] = data.split("-").map(Number);
  return SEMANA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
}

export function moeda(v: number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
