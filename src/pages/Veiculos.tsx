import { useCallback, useEffect, useState } from "react";
import NavAdmin from "../components/NavAdmin";
import { CORES, FONTES } from "../theme";
import { Veiculo, apiMapas, formatarKm, formatarPlaca } from "../lib/mapaRonda";

// Cadastro de veículos do Mapa de ronda (só Administrador Master).
// Veículo desativado some da lista do supervisor, mas o histórico fica.

const campo =
  "h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF3B3B]/60";

function LinhaVeiculo({ v, aoSalvar }: { v: Veiculo; aoSalvar: () => void }) {
  const [editando, setEditando] = useState(false);
  const [modelo, setModelo] = useState(v.modelo);
  const [placa, setPlaca] = useState(formatarPlaca(v.placa));
  const [erro, setErro] = useState<string | null>(null);

  const salvar = async (dados: Record<string, unknown>) => {
    setErro(null);
    try {
      await apiMapas(`/veiculos/${v.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados) }, "Não foi possível salvar.");
      setEditando(false);
      aoSalvar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  return (
    <div className={`py-3 border-t border-white/5 ${v.ativo ? "" : "opacity-50"}`}>
      {editando ? (
        <div className="flex flex-wrap gap-2 items-center">
          <input value={modelo} onChange={(e) => setModelo(e.target.value)} className={`${campo} flex-1 min-w-[140px]`} />
          <input value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} className={`${campo} w-32`} />
          <button type="button" onClick={() => salvar({ modelo, placa })} className="h-10 px-4 rounded-lg bg-[#FF3B3B] text-white text-sm font-semibold">
            Salvar
          </button>
          <button type="button" onClick={() => setEditando(false)} className="h-10 px-3 rounded-lg border border-white/10 text-white/70 text-sm">
            Cancelar
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="min-w-0">
            <p className="m-0 text-sm font-semibold text-white">
              {v.modelo} <span className="text-white/60 font-normal">· {formatarPlaca(v.placa)}</span>
              {!v.ativo && <span className="ml-2 text-xs text-white/50">(desativado)</span>}
            </p>
            <p className="m-0 text-xs text-white/40">
              Último KM: {formatarKm(v.ultimoKm)}
              {v.emUsoPor ? ` · em uso por ${v.emUsoPor}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditando(true)} className="h-8 px-3 rounded-lg border border-white/10 text-white/80 text-xs">
              Editar
            </button>
            <button type="button" onClick={() => salvar({ ativo: !v.ativo })} className="h-8 px-3 rounded-lg border border-white/10 text-white/80 text-xs">
              {v.ativo ? "Desativar" : "Reativar"}
            </button>
          </div>
        </div>
      )}
      {erro && <p className="text-xs text-red-400 mt-1 mb-0">{erro}</p>}
    </div>
  );
}

export default function Veiculos() {
  const [veiculos, setVeiculos] = useState<Veiculo[] | null>(null);
  const [modelo, setModelo] = useState("");
  const [placa, setPlaca] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setVeiculos(await apiMapas<Veiculo[]>("/veiculos/gerenciar", {}, "Não foi possível carregar os veículos."));
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const cadastrar = async () => {
    if (!modelo.trim() || !placa.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      await apiMapas("/veiculos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modelo: modelo.trim(), placa: placa.trim() }) }, "Não foi possível cadastrar.");
      setModelo("");
      setPlaca("");
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", display: "flex" }}>
      <NavAdmin />
      <div style={{ flex: 1, padding: "2rem 1rem", minWidth: 0 }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <p style={{ fontSize: 22, fontWeight: 900, color: CORES.texto, margin: 0, fontFamily: FONTES.titulo, letterSpacing: "-0.02em" }}>Veículos</p>
          <p style={{ fontSize: 12, color: "#8a8a8a", margin: "4px 0 16px" }}>Veículos que os supervisores escolhem ao abrir o mapa de ronda.</p>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-4">
            <p className="text-sm font-bold text-white mt-0 mb-3">Cadastrar veículo</p>
            <div className="flex flex-wrap gap-2">
              <input value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Modelo (ex.: Fiat Mobi branco)" className={`${campo} flex-1 min-w-[180px]`} />
              <input value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} placeholder="Placa (ABC-1D23)" className={`${campo} w-40`} />
              <button
                type="button"
                disabled={salvando || !modelo.trim() || !placa.trim()}
                onClick={cadastrar}
                className="h-10 px-5 rounded-full bg-[#FF3B3B] text-white text-sm font-semibold disabled:opacity-30"
              >
                {salvando ? "Salvando..." : "Cadastrar"}
              </button>
            </div>
            {erro && <p className="text-sm text-red-400 mt-2 mb-0">{erro}</p>}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 pb-1 pt-3">
            <p className="text-sm font-bold text-white mt-0 mb-2">Veículos cadastrados</p>
            {veiculos === null && <p className="text-sm text-white/50">Carregando...</p>}
            {veiculos?.length === 0 && <p className="text-sm text-white/50">Nenhum veículo cadastrado ainda.</p>}
            {veiculos?.map((v) => <LinhaVeiculo key={`${v.id}-${v.modelo}-${v.placa}-${v.ativo}`} v={v} aoSalvar={carregar} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
