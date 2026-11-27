import { API_URL, authHeaders } from "./api";
import { mensagemErro } from "./mapaRonda";

// Equipamentos do posto (11/2026) — tipos e chamadas à API.
// Supervisor e Admin Master lançam e editam; só o Admin Master exclui
// e cadastra novos tipos de equipamento.

export type Propriedade = "EMPRESA" | "ALUGUEL";

export interface TipoEquipamento {
  id: string;
  nome: string;
  ativo: boolean;
  ordem: number;
}

export interface EquipamentoPosto {
  id: string;
  condominioId: string;
  tipoId: string;
  tipoNome: string;
  modelo: string | null;
  quantidade: number;
  dataImplantacao: string; // AAAA-MM-DD
  propriedade: Propriedade;
  locadora: string | null;
  criadoPorNome: string;
  atualizadoPorNome: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface CondominioSimples {
  id: string;
  nome: string;
}

export const BASE_EQUIPAMENTOS = `${API_URL}/api/equipamentos-posto`;

export async function apiEquipamentos<T>(caminho: string, opcoes: RequestInit = {}, erroPadrao = "Não foi possível concluir. Tente de novo."): Promise<T> {
  const r = await fetch(`${BASE_EQUIPAMENTOS}${caminho}`, { ...opcoes, headers: { ...authHeaders(), ...(opcoes.headers ?? {}) } });
  if (!r.ok) throw new Error(await mensagemErro(r, erroPadrao));
  return r.json();
}

export function enviarJson(metodo: string, dados: unknown): RequestInit {
  return { method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados) };
}

export function dataBr(aaaaMmDd: string): string {
  return aaaaMmDd ? aaaaMmDd.slice(0, 10).split("-").reverse().join("/") : "—";
}

export function hojeIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
