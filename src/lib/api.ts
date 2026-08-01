// Endereço do backend. Em produção, definido pela variável de ambiente
// VITE_API_URL (configurada na Vercel/Netlify); em desenvolvimento local,
// cai no endereço padrão do NestJS rodando na sua máquina.
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333';

export function getToken(): string | null {
  return localStorage.getItem('uzellar_token');
}

export function setToken(token: string) {
  localStorage.setItem('uzellar_token', token);
}

export function limparToken() {
  localStorage.removeItem('uzellar_token');
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
