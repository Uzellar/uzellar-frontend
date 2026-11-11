// Rascunho do "Abrir mapa de ronda" guardado no próprio celular (11/2026).
// Se o celular fechar o app (por exemplo ao usar a câmera), o supervisor
// reabre e encontra o que já tinha preenchido, inclusive as fotos.
// Campos de texto no localStorage; fotos no IndexedDB. Vale 12 horas e é
// apagado quando o mapa é aberto com sucesso.

const CHAVE = "uzellar_rascunho_mapa";
const VALIDADE_MS = 12 * 60 * 60 * 1000;
const BANCO = "uzellar";
const LOJA = "rascunhos";

export interface CamposRascunho {
  veiculoId: string;
  kmInicial: string;
  faltando: boolean | null;
  itens: string;
  avaria: boolean | null;
  avariaDesc: string;
}

export function lerCampos(): CamposRascunho | null {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return null;
    const dados = JSON.parse(bruto);
    if (!dados?.salvoEm || Date.now() - dados.salvoEm > VALIDADE_MS) {
      apagarRascunho();
      return null;
    }
    return dados.campos as CamposRascunho;
  } catch {
    return null;
  }
}

export function gravarCampos(campos: CamposRascunho) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ salvoEm: Date.now(), campos }));
  } catch {
    // sem armazenamento: segue sem rascunho
  }
}

function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(BANCO, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(LOJA);
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

export async function gravarFotos(fotos: File[]): Promise<void> {
  try {
    const db = await abrirBanco();
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction(LOJA, "readwrite");
      t.objectStore(LOJA).put(
        fotos.map((f) => ({ nome: f.name, tipo: f.type, blob: f as Blob })),
        CHAVE,
      );
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
    db.close();
  } catch {
    // sem IndexedDB: as fotos só não são recuperadas
  }
}

export async function lerFotos(): Promise<File[]> {
  try {
    if (!lerCampos()) return [];
    const db = await abrirBanco();
    const lista = await new Promise<{ nome: string; tipo: string; blob: Blob }[] | undefined>((resolve, reject) => {
      const pedido = db.transaction(LOJA, "readonly").objectStore(LOJA).get(CHAVE);
      pedido.onsuccess = () => resolve(pedido.result);
      pedido.onerror = () => reject(pedido.error);
    });
    db.close();
    return (lista ?? []).map((f) => new File([f.blob], f.nome, { type: f.tipo }));
  } catch {
    return [];
  }
}

export function apagarRascunho() {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    // ignora
  }
  abrirBanco()
    .then((db) => {
      const t = db.transaction(LOJA, "readwrite");
      t.objectStore(LOJA).delete(CHAVE);
      t.oncomplete = () => db.close();
    })
    .catch(() => undefined);
}
