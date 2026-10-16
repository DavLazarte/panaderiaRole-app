"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Boxes, ShoppingBag, Check, RefreshCw, X } from 'lucide-react';
import AltaRapidaModal from './AltaRapidaModal';

interface MateriaPrimaSelectorProps {
  token: string;
  onAdd: (item: any) => void;
}

export default function MateriaPrimaSelector({ token, onAdd }: MateriaPrimaSelectorProps) {
  const [search, setSearch] = useState('');
  const [tipo, setTipo] = useState<'todos' | 'materia_prima' | 'articulo'>('todos');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);

  // Estado para el modal de alta rápida
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitialName, setModalInitialName] = useState('');
  const [modalInitialTipo, setModalInitialTipo] = useState<'materia_prima' | 'articulo'>('materia_prima');

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const justSelectedRef = useRef(false);

  const fetchItems = async (q = '', t = tipo) => {
    setLoading(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://role.test/api';
      const qParam = q.trim() ? `&q=${encodeURIComponent(q.trim())}` : '';
      const tParam = t !== 'todos' ? `&tipo=${t}` : '';
      const res = await fetch(`${API_URL}/admin/compras/buscar-items?${qParam}${tParam}`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setResults(Array.isArray(json) ? json : []);
      }
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchItems(); 
    const handleCompraRegistrada = () => {
      fetchItems('', tipo);
    };
    window.addEventListener('compra-registrada', handleCompraRegistrada);
    return () => window.removeEventListener('compra-registrada', handleCompraRegistrada);
  }, [token, tipo]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleChange = (val: string) => {
    setSearch(val);
    setIsOpen(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => fetchItems(val, tipo), 220);
  };

  const handleTipoChange = (t: 'todos' | 'materia_prima' | 'articulo') => {
    setTipo(t);
    fetchItems(search, t);
  };

  const handleSelect = (item: any) => {
    onAdd(item);
    const key = `${item.tipo}-${item.id}`;
    setRecentlyAddedId(key);
    setSearch('');
    setIsOpen(false);
    justSelectedRef.current = true;
    setTimeout(() => setRecentlyAddedId(null), 1200);
    // Enfocar y seleccionar el input para búsqueda inmediata sin reabrir el menú
    inputRef.current?.focus();
    inputRef.current?.select();
  };

  const handleItemCreated = (item: any) => {
    handleSelect(item);
    fetchItems('', tipo);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* ── CAJA DEL BUSCADOR ── */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col gap-3">
        {/* Label y Botón Crear Rápido */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-brand-yellow shrink-0" />
            <span className="text-sm font-bold text-white">Agregar producto a la factura</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setModalInitialName(search);
              setModalInitialTipo(tipo === 'articulo' ? 'articulo' : 'materia_prima');
              setModalOpen(true);
              setIsOpen(false);
            }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-brand-red/15 text-brand-yellow border border-brand-red/30 text-xs font-semibold hover:bg-brand-red/25 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Nuevo Producto</span>
          </button>
        </div>

        {/* Input + filtro de tipo integrado */}
        <div className="flex gap-2">
          {/* Selector de tipo */}
          <select
            value={tipo}
            onChange={e => handleTipoChange(e.target.value as any)}
            className="h-11 px-3 rounded-xl bg-zinc-800 border border-white/10 text-xs font-bold text-zinc-300 focus:border-brand-red outline-none appearance-none cursor-pointer shrink-0"
          >
            <option value="todos" className="bg-zinc-900">Todos</option>
            <option value="materia_prima" className="bg-zinc-900">Mat. Prima</option>
            <option value="articulo" className="bg-zinc-900">Artículos</option>
          </select>

          {/* Campo de búsqueda */}
          <div className="flex items-center gap-2.5 flex-1 h-11 px-3.5 rounded-xl bg-zinc-800 border border-white/10 focus-within:border-brand-red transition-colors">
            <Search className="w-4 h-4 text-zinc-500 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onFocus={() => {
                if (justSelectedRef.current) {
                  justSelectedRef.current = false;
                  return;
                }
                setIsOpen(true);
                if (!results.length) fetchItems(search, tipo);
              }}
              onChange={e => handleChange(e.target.value)}
              placeholder="Buscar por nombre… (Harina 000, Levadura, Yerba…)"
              className="w-full bg-transparent text-white text-sm placeholder:text-zinc-500 outline-none"
            />
            {loading && <RefreshCw className="w-4 h-4 text-zinc-500 animate-spin shrink-0" />}
            {!loading && search && (
              <button
                type="button"
                onClick={() => { setSearch(''); fetchItems('', tipo); inputRef.current?.focus(); }}
                className="text-zinc-500 hover:text-white transition-colors shrink-0 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── DROPDOWN ── */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-40 rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl overflow-hidden">
          {/* Mensaje vacío / cargando */}
          {loading && results.length === 0 ? (
            <div className="flex items-center justify-center gap-2 p-5 text-sm text-zinc-400">
              <RefreshCw className="w-4 h-4 animate-spin text-brand-red" /> Buscando…
            </div>
          ) : results.length === 0 ? (
            <div className="p-5 text-center space-y-3">
              <p className="text-sm text-zinc-400">
                No se encontraron productos coincidentes{search ? ` para "${search}"` : ''}.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setModalInitialName(search);
                    setModalInitialTipo('materia_prima');
                    setModalOpen(true);
                    setIsOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-bold hover:bg-amber-500/25 transition-all cursor-pointer"
                >
                  <Boxes className="w-4 h-4 text-amber-400" />
                  <span>Crear {search ? `"${search}"` : 'Nuevo'} como Materia Prima</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalInitialName(search);
                    setModalInitialTipo('articulo');
                    setModalOpen(true);
                    setIsOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-bold hover:bg-emerald-500/25 transition-all cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4 text-emerald-400" />
                  <span>Crear {search ? `"${search}"` : 'Nuevo'} como Artículo</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              <ul className="max-h-72 overflow-y-auto divide-y divide-white/5">
                {results.map(item => {
                  const isMp = item.tipo === 'materia_prima';
                  const key = `${item.tipo}-${item.id}`;
                  const added = recentlyAddedId === key;

                  return (
                    <li
                      key={key}
                      onClick={() => handleSelect(item)}
                      className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors group ${
                        added ? 'bg-emerald-500/10' : 'hover:bg-white/5'
                      }`}
                    >
                      {/* Icono + info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isMp ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          {isMp ? <Boxes className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate group-hover:text-brand-yellow transition-colors">
                            {item.nombre}
                          </p>
                          <p className="text-[11px] text-zinc-500 truncate">
                            {isMp
                              ? `${item.peso_unidad} ${item.unidad_medida || 'kg'}/bulto · Stock: ${item.stock_deposito} ${item.unidad_medida || 'kg'}${item.precio_compra > 0 ? ` · Último costo: $${Number(item.precio_compra).toLocaleString('es-AR')}` : ''}`
                              : `Stock: ${item.stock_deposito} u.${item.precio_venta > 0 ? ` · Precio venta: $${Number(item.precio_venta).toLocaleString('es-AR')}` : ''}`
                            }
                          </p>
                        </div>
                      </div>

                      {/* Botón agregar */}
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                        added
                          ? 'bg-emerald-500 text-white'
                          : 'bg-white/5 text-zinc-400 group-hover:bg-brand-red group-hover:text-white'
                      }`}>
                        {added ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Barra inferior para crear nuevo producto */}
              <div className="p-2.5 bg-black/40 border-t border-white/5 flex items-center justify-between">
                <span className="text-[11px] text-zinc-400">¿No encuentras lo que buscas?</span>
                <button
                  type="button"
                  onClick={() => {
                    setModalInitialName(search);
                    setModalInitialTipo(tipo === 'articulo' ? 'articulo' : 'materia_prima');
                    setModalOpen(true);
                    setIsOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-brand-yellow hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear nuevo {search ? `"${search}"` : 'producto'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal Alta Rápida */}
      <AltaRapidaModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        token={token}
        initialName={modalInitialName}
        initialTipo={modalInitialTipo}
        onItemCreated={handleItemCreated}
      />
    </div>
  );
}
