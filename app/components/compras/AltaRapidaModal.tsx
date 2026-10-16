"use client";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Boxes, ShoppingBag, Plus, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';

interface AltaRapidaModalProps {
  open: boolean;
  onClose: () => void;
  token: string;
  initialName?: string;
  initialTipo?: 'materia_prima' | 'articulo';
  onItemCreated: (item: any) => void;
}

export default function AltaRapidaModal({
  open,
  onClose,
  token,
  initialName = '',
  initialTipo = 'materia_prima',
  onItemCreated
}: AltaRapidaModalProps) {
  const [mounted, setMounted] = useState(false);
  const [tipo, setTipo] = useState<'materia_prima' | 'articulo'>(initialTipo);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Formulario Materia Prima
  const [mpForm, setMpForm] = useState({
    nombre: '',
    unidad_compra: 'bolsas',
    peso_unidad: '25',
    unidad_medida: 'kg',
    precio: '',
  });

  // Formulario Artículo
  const [artForm, setArtForm] = useState({
    nombre: '',
    codigo: '',
    precio_unitario: '',
    unidad_medida: 'unidades',
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setTipo(initialTipo);
      setMpForm(prev => ({ ...prev, nombre: initialName || '' }));
      setArtForm(prev => ({ ...prev, nombre: initialName || '' }));
    }
  }, [open, initialName, initialTipo]);

  if (!open || !mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://role.test/api';

    try {
      if (tipo === 'materia_prima') {
        if (!mpForm.nombre.trim()) {
          throw new Error('El nombre de la materia prima es requerido');
        }

        const pesoNum = parseFloat(mpForm.peso_unidad.replace(',', '.')) || 1;
        const precioNum = mpForm.precio ? parseFloat(mpForm.precio.replace(',', '.')) : 0;

        const res = await fetch(`${API_URL}/admin/materias-primas`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            nombre: mpForm.nombre.trim(),
            unidad_compra: mpForm.unidad_compra,
            peso: pesoNum,
            peso_unidad: pesoNum,
            unidad_medida: mpForm.unidad_medida,
            precio: precioNum
          })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'Error al crear la materia prima');
        }

        if (data.item) {
          onItemCreated(data.item);
        } else {
          onItemCreated({
            id: data.id,
            tipo: 'materia_prima',
            nombre: mpForm.nombre.trim(),
            unidad_medida: mpForm.unidad_medida,
            unidad_compra: mpForm.unidad_compra,
            peso_unidad: pesoNum,
            precio_compra: precioNum,
            stock_deposito: 0
          });
        }
        onClose();
      } else {
        // Artículo de mostrador / reventa
        if (!artForm.nombre.trim()) {
          throw new Error('El nombre del artículo es requerido');
        }

        const precioVentaNum = artForm.precio_unitario ? parseFloat(artForm.precio_unitario.replace(',', '.')) : 0;

        const res = await fetch(`${API_URL}/productos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            nombre: artForm.nombre.trim(),
            codigo: artForm.codigo.trim() || null,
            precio_unitario: precioVentaNum,
            precio_reparto: precioVentaNum,
            precio_bar: precioVentaNum,
            unidad_medida: artForm.unidad_medida || 'unidades'
          })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'Error al crear el artículo');
        }

        if (data.item) {
          onItemCreated(data.item);
        } else if (data.articulo) {
          onItemCreated({
            id: data.articulo.idarticulo,
            tipo: 'articulo',
            nombre: data.articulo.nombre,
            codigo: data.articulo.codigo,
            unidad_medida: data.articulo.unidad_medida || 'unidades',
            unidad_compra: 'unidades',
            peso_unidad: 1,
            precio_compra: 0,
            precio_venta: parseFloat(data.articulo.precio_unitario ?? 0),
            stock_deposito: 0
          });
        }
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocurrió un error inesperado');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-zinc-900 border border-white/10 rounded-3xl p-6 space-y-5 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center pb-2 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-red/10 border border-brand-red/20 flex items-center justify-center text-brand-red">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-white">Alta Rápida de Producto</h2>
              <p className="text-xs text-zinc-400">Se agregará directamente a la factura sin perder tus datos</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selector de Tipo (Pestañas) */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-2xl border border-white/10">
          <button
            type="button"
            onClick={() => setTipo('materia_prima')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
              tipo === 'materia_prima'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Boxes className="w-4 h-4 text-amber-400" />
            <span>Materia Prima / Insumo</span>
          </button>

          <button
            type="button"
            onClick={() => setTipo('articulo')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
              tipo === 'articulo'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <ShoppingBag className="w-4 h-4 text-emerald-400" />
            <span>Artículo Mostrador / Reventa</span>
          </button>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {tipo === 'materia_prima' ? (
            /* Campos Materia Prima */
            <>
              <div>
                <label className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5 block font-semibold">
                  Nombre de la Materia Prima *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Harina 0000, Levadura Fresca, Margarina..."
                  value={mpForm.nombre}
                  onChange={e => setMpForm({ ...mpForm, nombre: e.target.value })}
                  className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white outline-none focus:border-brand-red placeholder:text-zinc-600 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5 block font-semibold">
                    Presentación / Bulto
                  </label>
                  <select
                    value={mpForm.unidad_compra}
                    onChange={e => setMpForm({ ...mpForm, unidad_compra: e.target.value })}
                    className="w-full h-11 rounded-xl bg-zinc-800 border border-white/10 px-3 text-sm text-white outline-none focus:border-brand-red cursor-pointer"
                  >
                    <option value="bolsas">Bolsa (ej: 25 o 50 kg)</option>
                    <option value="cajas">Caja (ej: 10 o 20 kg)</option>
                    <option value="bidones">Bidón (ej: 5 o 10 L)</option>
                    <option value="paquetes">Paquete / Pack</option>
                    <option value="unidades">Unidad suelta</option>
                    <option value="kg">Kilo individual</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5 block font-semibold">
                    Kilos / Litros por bulto *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="Ej: 25"
                    value={mpForm.peso_unidad}
                    onChange={e => setMpForm({ ...mpForm, peso_unidad: e.target.value })}
                    className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white outline-none focus:border-brand-red placeholder:text-zinc-600 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5 block font-semibold">
                    Unidad para Recetas
                  </label>
                  <select
                    value={mpForm.unidad_medida}
                    onChange={e => setMpForm({ ...mpForm, unidad_medida: e.target.value })}
                    className="w-full h-11 rounded-xl bg-zinc-800 border border-white/10 px-3 text-sm text-white outline-none focus:border-brand-red cursor-pointer"
                  >
                    <option value="kg">Kilos (kg)</option>
                    <option value="g">Gramos (g)</option>
                    <option value="l">Litros (l)</option>
                    <option value="ml">Mililitros (ml)</option>
                    <option value="unidades">Unidades (u)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5 block font-semibold">
                    Costo inicial ($ / bulto)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Ej: 14500 (opcional)"
                    value={mpForm.precio}
                    onChange={e => setMpForm({ ...mpForm, precio: e.target.value })}
                    className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white outline-none focus:border-brand-red placeholder:text-zinc-600 transition-colors"
                  />
                </div>
              </div>
            </>
          ) : (
            /* Campos Artículo Mostrador */
            <>
              <div>
                <label className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5 block font-semibold">
                  Nombre del Artículo / Producto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Yerba Mate Playadito 500g, Coca Cola 500ml..."
                  value={artForm.nombre}
                  onChange={e => setArtForm({ ...artForm, nombre: e.target.value })}
                  className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white outline-none focus:border-brand-red placeholder:text-zinc-600 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5 block font-semibold">
                    Código de Barras / SKU
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: 779123456789 (opcional)"
                    value={artForm.codigo}
                    onChange={e => setArtForm({ ...artForm, codigo: e.target.value })}
                    className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white outline-none focus:border-brand-red placeholder:text-zinc-600 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5 block font-semibold">
                    Precio Venta Mostrador ($)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Ej: 2500 (opcional)"
                    value={artForm.precio_unitario}
                    onChange={e => setArtForm({ ...artForm, precio_unitario: e.target.value })}
                    className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white outline-none focus:border-brand-red placeholder:text-zinc-600 transition-colors"
                  />
                </div>
              </div>
            </>
          )}

          {/* Acciones */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-red text-white text-xs font-bold hover:bg-red-600 active:scale-95 transition-all shadow-lg shadow-brand-red/20 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Creando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Crear y Agregar a la Factura</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
