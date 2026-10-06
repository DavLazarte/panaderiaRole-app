"use client";
import React, { useState } from 'react';
import { 
  Trash2, Sparkles, Scale, DollarSign, 
  ShoppingBag, TrendingUp, Pencil, Check, ChevronUp
} from 'lucide-react';

interface DetalleCompraTableProps {
  articulos: any[];
  onUpdate: (index: number, field: string, value: any) => void;
  onRemove: (index: number) => void;
}

const UNIDADES_DEP_OPTIONS = ['bolsas', 'cajas', 'paquetes', 'bidones', 'unidades', 'kg', 'lt'];

export default function DetalleCompraTable({ articulos, onUpdate, onRemove }: DetalleCompraTableProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (articulos.length === 0) return null;

  const totalCompra = articulos.reduce((acc, art) => {
    const cant = parseFloat(String(art.cantidad).replace(',', '.')) || 0;
    const precio = parseFloat(String(art.precio_compra).replace(',', '.')) || 0;
    return acc + cant * precio;
  }, 0);

  const handleNumeric = (index: number, field: string, raw: string) => {
    onUpdate(index, field, raw.replace(/[^0-9.,]/g, ''));
  };

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-white/10">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-white/5 border-b border-white/10">
            <th className="text-left px-3 py-3 text-[11px] font-bold uppercase tracking-widest text-zinc-500 w-8">#</th>
            <th className="text-left px-3 py-3 text-[11px] font-bold uppercase tracking-widest text-zinc-500">Producto</th>
            <th className="text-center px-3 py-3 text-[11px] font-bold uppercase tracking-widest text-zinc-500 w-32 hidden sm:table-cell">Presentación</th>
            <th className="text-center px-3 py-3 text-[11px] font-bold uppercase tracking-widest text-zinc-500 w-24">Cant.</th>
            <th className="text-right px-3 py-3 text-[11px] font-bold uppercase tracking-widest text-zinc-500 w-36">Costo x bulto</th>
            <th className="text-right px-3 py-3 text-[11px] font-bold uppercase tracking-widest text-zinc-500 w-32">Subtotal</th>
            <th className="w-16"></th>
          </tr>
        </thead>
        <tbody>
          {articulos.map((art, idx) => {
            const isArticulo = art.tipo === 'articulo';
            const cantidad = parseFloat(String(art.cantidad).replace(',', '.')) || 0;
            const precioCompra = parseFloat(String(art.precio_compra).replace(',', '.')) || 0;
            const subtotal = cantidad * precioCompra;
            const nombre = art.nombre || (isArticulo ? `Artículo #${art.idarticulo}` : `MP #${art.id_materia_prima}`);
            const unidadBulto = art.unidad_medida || art.unidad_compra || 'bolsas';
            const pesoUnidad = parseFloat(String(art.peso_unidad ?? art.peso ?? 1).replace(',', '.')) || 1;
            const totalKilos = cantidad * pesoUnidad;
            const costoPorKilo = pesoUnidad > 0 ? precioCompra / pesoUnidad : precioCompra;
            const precioOriginal = Number(art.precio_original) || 0;
            const precioVenta = parseFloat(String(art.precio_venta).replace(',', '.')) || 0;
            const ganancia = precioVenta - precioCompra;
            const margen = precioCompra > 0 ? (ganancia / precioCompra) * 100 : 0;
            const isExpanded = expandedIdx === idx;

            return (
              <React.Fragment key={idx}>
                {/* ── FILA PRINCIPAL ── */}
                <tr className={`border-b border-white/5 transition-colors ${isExpanded ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'}`}>
                  
                  {/* # */}
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex w-6 h-6 rounded-md text-[11px] font-black items-center justify-center ${
                      isArticulo ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                    }`}>
                      {idx + 1}
                    </span>
                  </td>

                  {/* Nombre + badge */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{nombre}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md hidden sm:inline ${
                        isArticulo ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {isArticulo ? 'Reventa' : 'Mat. Prima'}
                      </span>
                      {!isArticulo && art.actualizar_maestro && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-brand-yellow/10 text-brand-yellow hidden md:inline">
                          ✦ recetas
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Presentación descriptiva */}
                  <td className="px-3 py-2.5 text-center hidden sm:table-cell">
                    <span className="text-xs text-zinc-400 font-mono">
                      {isArticulo ? 'unidades' : `${pesoUnidad} kg / ${unidadBulto}`}
                    </span>
                  </td>

                  {/* INPUT CANTIDAD DIRECTO EN LA FILA */}
                  <td className="px-3 py-2.5 text-center">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={art.cantidad ?? '1'}
                      onChange={e => handleNumeric(idx, 'cantidad', e.target.value)}
                      placeholder="1"
                      className="w-16 h-8 px-2 rounded-lg bg-zinc-800/90 border border-white/10 text-white font-bold text-sm text-center focus:border-brand-red outline-none transition-colors"
                    />
                  </td>

                  {/* INPUT PRECIO DIRECTO EN LA FILA */}
                  <td className="px-3 py-2.5 w-36 text-right">
                    <div className="relative inline-flex items-center w-28 sm:w-32">
                      <span className="absolute left-2.5 text-zinc-500 text-xs font-bold pointer-events-none">$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={art.precio_compra ?? ''}
                        onChange={e => handleNumeric(idx, 'precio_compra', e.target.value)}
                        placeholder="0.00"
                        className="w-full h-8 pl-6 pr-2 rounded-lg bg-zinc-800/90 border border-white/10 text-white font-bold text-sm text-right focus:border-brand-red outline-none transition-colors"
                      />
                    </div>
                    {precioOriginal > 0 && (
                      <span className="text-[10px] text-zinc-500 block text-right mt-0.5">
                        ant: ${precioOriginal.toLocaleString('es-AR')}
                      </span>
                    )}
                  </td>

                  {/* Subtotal */}
                  <td className="px-3 py-2.5 text-right">
                    <span className={`text-sm font-black font-mono ${subtotal > 0 ? 'text-brand-yellow' : 'text-zinc-700'}`}>
                      {subtotal > 0 ? `$${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '—'}
                    </span>
                  </td>

                  {/* Acciones */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                        title="Modificar presentación o unidad"
                        className={`p-1.5 rounded-lg transition-all ${
                          isExpanded
                            ? 'bg-brand-red text-white'
                            : 'bg-white/5 hover:bg-white/15 text-zinc-500 hover:text-white'
                        }`}
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => { if (isExpanded) setExpandedIdx(null); onRemove(idx); }}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-all"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>

                {/* ── ACORDEÓN DE EDICIÓN AVANZADA ── */}
                {isExpanded && (
                  <tr className="border-b border-white/5 bg-black/20">
                    <td colSpan={7} className="px-4 pb-4 pt-1">
                      <div className="rounded-xl border border-white/10 p-4 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-zinc-400 flex items-center gap-1.5">
                            <Pencil className="w-3 h-3" />
                            Ajustar Presentación: <span className="text-white ml-1 font-semibold">{nombre}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setExpandedIdx(null)}
                            className="text-xs text-emerald-400 font-bold flex items-center gap-1 hover:text-emerald-300 transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" /> Listo
                          </button>
                        </div>

                        {isArticulo ? (
                          /* ARTÍCULO: Precio de Venta al Público */
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Precio de venta ($) — Mostrador</label>
                              <input
                                type="text" inputMode="decimal"
                                value={art.precio_venta ?? ''}
                                onChange={e => handleNumeric(idx, 'precio_venta', e.target.value)}
                                placeholder="0.00"
                                className="w-full h-10 px-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 font-bold text-sm focus:border-emerald-400 outline-none transition-colors"
                              />
                              <span className="text-[10px] text-zinc-500 block mt-0.5">Se actualiza en catálogo al confirmar la compra</span>
                            </div>
                          </div>
                        ) : (
                          /* MATERIA PRIMA: Unidad en depósito + Kilos por bulto */
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Unidad en Depósito</label>
                              <select
                                value={unidadBulto}
                                onChange={e => {
                                  onUpdate(idx, 'unidad_medida', e.target.value);
                                  onUpdate(idx, 'unidad_compra', e.target.value);
                                }}
                                className="w-full h-10 px-3 rounded-lg bg-zinc-800 border border-white/10 text-white font-bold text-sm focus:border-brand-red outline-none cursor-pointer"
                              >
                                {UNIDADES_DEP_OPTIONS.map(p => (
                                  <option key={p} value={p} className="bg-zinc-900 text-white">{p}</option>
                                ))}
                              </select>
                              <span className="text-[10px] text-zinc-500 block mt-0.5">Bolsas, cajas, paquetes, bidones, etc.</span>
                            </div>

                            <div>
                              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Kilos / Litros por bulto (Presentación)</label>
                              <input
                                type="text" inputMode="decimal"
                                value={art.peso_unidad ?? art.peso ?? '25'}
                                onChange={e => {
                                  handleNumeric(idx, 'peso_unidad', e.target.value);
                                  handleNumeric(idx, 'peso', e.target.value);
                                }}
                                placeholder="25"
                                className="w-full h-10 px-3 rounded-lg bg-zinc-800 border border-white/10 text-white font-bold text-sm focus:border-brand-red outline-none transition-colors"
                              />
                              <span className="text-[10px] text-zinc-500 block mt-0.5">Ej: 25 kg la bolsa de harina, 5 kg la caja de grasa</span>
                            </div>
                          </div>
                        )}

                        {/* Chips de impacto */}
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                          {isArticulo ? (
                            <>
                              <span className="inline-flex items-center gap-1.5 text-[11px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2.5 py-1 rounded-lg font-semibold">
                                <ShoppingBag className="w-3 h-3" /> +{cantidad} u. al depósito
                              </span>
                              {precioVenta > 0 && precioCompra > 0 && (
                                <span className="inline-flex items-center gap-1.5 text-[11px] bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2.5 py-1 rounded-lg font-semibold">
                                  <TrendingUp className="w-3 h-3" /> Margen: ${ganancia.toLocaleString('es-AR', { minimumFractionDigits: 2 })} ({margen.toFixed(1)}%)
                                </span>
                              )}
                            </>
                          ) : (
                            <>
                              <span className="inline-flex items-center gap-1.5 text-[11px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2.5 py-1 rounded-lg font-semibold">
                                <Scale className="w-3 h-3" /> Suma al Depósito: <b>+{cantidad} {unidadBulto}</b> ({totalKilos.toFixed(1).replace('.0', '')} kg en total)
                              </span>
                              {costoPorKilo > 0 && (
                                <span className="inline-flex items-center gap-1.5 text-[11px] bg-brand-yellow/10 text-brand-yellow border border-brand-yellow/20 px-2.5 py-1 rounded-lg font-semibold">
                                  <DollarSign className="w-3 h-3" /> Costo Receta: <b>${costoPorKilo.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / kg</b> (${precioCompra} ÷ {pesoUnidad} kg)
                                </span>
                              )}
                              <label className="inline-flex items-center gap-1.5 text-[11px] bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg cursor-pointer hover:border-white/20 transition-all select-none">
                                <input
                                  type="checkbox"
                                  checked={!!art.actualizar_maestro}
                                  onChange={e => onUpdate(idx, 'actualizar_maestro', e.target.checked)}
                                  className="w-3.5 h-3.5 accent-brand-red cursor-pointer"
                                />
                                <Sparkles className="w-3 h-3 text-brand-yellow" />
                                <span className="text-zinc-300 font-semibold">Actualizar precio en Materia Prima y Recetas</span>
                              </label>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>

        {/* ── PIE ── */}
        <tfoot>
          <tr className="bg-white/5 border-t border-white/10">
            <td colSpan={7} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  {articulos.length} {articulos.length === 1 ? 'producto' : 'productos'}
                </span>
                <div className="text-right">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block">Total Factura</span>
                  <span className="text-xl font-black text-brand-yellow font-mono">
                    ${totalCompra.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
