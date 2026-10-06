"use client";

import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import {
  ShoppingCart, Truck, Package, Users, Plus, Minus, Search,
  CircleDollarSign, ClipboardList, ChevronRight, LogOut,
  User as UserIcon, X, Check, Calendar, CheckCircle2,
  CreditCard, Banknote, Clock, Receipt, ArrowLeft,
  ChevronDown, AlertCircle, RefreshCw, Trash2, PieChart as PieChartIcon, BarChart3, Edit2, Download, Warehouse, Archive,
  Building2
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

import { DndContext, closestCenter, KeyboardSensor, TouchSensor, MouseSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import DespachoRepartidor from "./components/DespachoRepartidor";
import UsuariosCrud from "./components/UsuariosCrud";
import ComprasApp from "./components/compras/ComprasApp";
import { Proveedor, ProveedorDetalleModal, CargarPagoProveedorModal } from "./components/personas/ProveedorModals";
import PosMostrador from "./components/pos/PosMostrador";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://role.test/api";

function SortableProductItem({ product, disabled, qty, onUpdateQuantity, onSetQuantity, isReordering }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: product.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : 1 };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-all cursor-grab active:cursor-grabbing ${
        disabled ? "border-zinc-800 bg-zinc-900/40 opacity-40" :
        qty > 0 ? "border-brand-red/40 bg-brand-red/5" : "border-white/10 bg-white/5"
      } ${isDragging ? "shadow-2xl opacity-80" : ""}`}>
      <div className="flex-1 min-w-0 pointer-events-none">
        <p className="text-sm font-semibold truncate">{product.name}</p>
        <p className="text-xs text-zinc-400">${product.price} · {product.quantity} disp.</p>
      </div>
      <div className="flex items-center gap-2 shrink-0 pointer-events-auto" onPointerDown={e => { if(!isReordering) e.stopPropagation(); }}>
        {isReordering ? (
          <div className="h-8 flex items-center px-3 rounded-lg border border-white/10 bg-white/10 text-white/50 text-xs font-bold uppercase tracking-wider pointer-events-none">
            Mover
          </div>
        ) : (
          <>
            <button onClick={() => onUpdateQuantity(product, -1)} disabled={qty === 0}
              className="h-8 w-8 rounded-full border border-white/10 bg-white/5 flex items-center justify-center hover:bg-white/10 disabled:opacity-30">
              <Minus className="h-4 w-4" />
            </button>
            <input type="number" step="any" min="0" max={product.quantity} value={qty || ""} placeholder="0"
              onChange={(e) => onSetQuantity(product, e.target.value)}
              className="w-10 bg-transparent text-center text-sm font-bold outline-none" />
            <button onClick={() => onUpdateQuantity(product, 1)} disabled={disabled || qty >= product.quantity}
              className="h-8 w-8 rounded-full bg-brand-red text-white flex items-center justify-center shadow-lg hover:bg-red-600 disabled:opacity-30 disabled:bg-white/10 disabled:text-white/30">
              <Plus className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const formatPaymentInput = (val: string) => {
  let clean = val.replace(/[^0-9,]/g, "");
  const parts = clean.split(",");
  if (parts.length > 2) {
    clean = parts[0] + "," + parts.slice(1).join("");
  }
  let integerPart = parts[0];
  const decimalPart = parts[1] !== undefined ? "," + parts[1] : "";
  integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return integerPart + decimalPart;
};

const parsePaymentInput = (formatted: string): number => {
  const clean = formatted.replace(/\./g, "").replace(",", ".");
  return Number(clean) || 0;
};

interface Product  { id: number; name: string; price: number; quantity: number; sold_qty?: number; reserved_qty?: number; stock_local?: number; stock_repartidores?: { [id: string]: { cantidad: number, cantidad_reservada: number } }; descripcion?: string; codigo?: string; estado?: string; idcategoria?: number; precio_unitario?: number; precio_reparto?: number; precio_bar?: number; disponible_reparto?: number; precios_especiales?: any[]; unidad_medida?: string; }
interface Client   { id: number; name: string; address: string; balance: number; }
interface Delivery { id: number; customer: string; status: string; estado?: string; estado_pedido?: string; fecha_venta?: string | null; pago?: number; saldo?: number; forma_de_pago?: string; items: string; raw_items?: {id?: number, name: string, qty: number}[]; total: string; total_raw: number; address: string; advance?: number; fecha_entrega?: string | null; idcliente?: number; telefono?: string; notas?: string; creador?: { id: number | null; nombre: string; email?: string | null; rol: string; tipo_origen: string; etiqueta_origen: string; }; }
interface SaleItem { id: number; name: string; price: number; quantity: number; }
interface Categoria { id_categoria: number; nombre: string; descripcion?: string; estado?: string; articulos_count?: number; }


const TagIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
  </svg>
);

// ─── CategoriasModal ─────────────────────────────────────────────────────────
function CategoriasModal({
  open,
  onClose,
  token,
  onRefresh
}: {
  open: boolean;
  onClose: () => void;
  token: string;
  onRefresh: () => void;
}) {
  const [categoriasList, setCategoriasList] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingCat, setEditingCat] = useState<{ id?: number; nombre: string; descripcion: string; estado: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchCategorias = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/categorias`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCategoriasList(data);
      }
    } catch {
      setError("Error al cargar categorías");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (open) {
      setError(null);
      setSuccessMsg(null);
      setEditingCat(null);
      fetchCategorias();
    }
  }, [open, fetchCategorias]);

  if (!open) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCat || !editingCat.nombre.trim()) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const isEdit = !!editingCat.id;
      const url = isEdit
        ? `${API_URL}/admin/categorias/${editingCat.id}`
        : `${API_URL}/admin/categorias`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          nombre: editingCat.nombre.trim(),
          descripcion: editingCat.descripcion.trim() || null,
          estado: editingCat.estado
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(isEdit ? "Categoría actualizada" : "Categoría creada con éxito");
        setEditingCat(null);
        await fetchCategorias();
        onRefresh();
      } else {
        setError(data.message || data.error || "Error al guardar categoría");
      }
    } catch {
      setError("Error de conexión al guardar categoría");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: Categoria) => {
    if (!window.confirm(`¿Estás seguro de eliminar la categoría "${cat.nombre}"?`)) return;
    setDeletingId(cat.id_categoria);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`${API_URL}/admin/categorias/${cat.id_categoria}`, {
        method: "DELETE",
        headers: {
          "Accept": "application/json",
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg("Categoría eliminada con éxito");
        await fetchCategorias();
        onRefresh();
      } else {
        setError(data.message || data.error || "No se pudo eliminar la categoría");
      }
    } catch {
      setError("Error de conexión al eliminar categoría");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-yellow/10 border border-brand-yellow/20 flex items-center justify-center">
              <TagIcon className="w-5 h-5 text-brand-yellow" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Gestión de Categorías</h2>
              <p className="text-xs text-zinc-400">Organiza los productos por rubros</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback messages */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form if editing/creating */}
        {editingCat ? (
          <form onSubmit={handleSave} className="py-4 space-y-3.5 overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <h3 className="text-sm font-bold text-brand-yellow">
                {editingCat.id ? "Editar Categoría" : "Nueva Categoría"}
              </h3>
              <button
                type="button"
                onClick={() => setEditingCat(null)}
                className="text-xs text-zinc-400 hover:text-white"
              >
                Volver a la lista
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-400 block mb-1">Nombre de Categoría *</label>
              <input
                type="text"
                required
                value={editingCat.nombre}
                onChange={e => setEditingCat({ ...editingCat, nombre: e.target.value })}
                placeholder="Ej: Panificados, Facturas, Confitería..."
                className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-3.5 text-sm outline-none focus:border-brand-red text-white placeholder:text-zinc-600"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-400 block mb-1">Descripción (Opcional)</label>
              <input
                type="text"
                value={editingCat.descripcion}
                onChange={e => setEditingCat({ ...editingCat, descripcion: e.target.value })}
                placeholder="Breve descripción..."
                className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-3.5 text-sm outline-none focus:border-brand-red text-white placeholder:text-zinc-600"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-400 block mb-1">Estado</label>
              <select
                value={editingCat.estado}
                onChange={e => setEditingCat({ ...editingCat, estado: e.target.value })}
                className="w-full h-11 rounded-xl bg-zinc-900 border border-white/10 px-3.5 text-sm outline-none focus:border-brand-red text-white"
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>

            <div className="flex gap-2.5 pt-3">
              <button
                type="button"
                onClick={() => setEditingCat(null)}
                className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 font-semibold text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || !editingCat.nombre.trim()}
                className="flex-1 py-3 rounded-xl bg-brand-red hover:bg-red-600 text-white font-bold text-sm shadow-lg shadow-brand-red/20 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>{saving ? "Guardando..." : editingCat.id ? "Guardar Cambios" : "Crear"}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="py-4 flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                {categoriasList.length} Categoría(s)
              </span>
              <button
                onClick={() => setEditingCat({ nombre: "", descripcion: "", estado: "activo" })}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red hover:bg-red-600 rounded-xl text-xs font-bold text-white transition-all shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nueva Categoría</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {loading ? (
                <div className="flex items-center justify-center py-10 text-zinc-500">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  <span>Cargando categorías...</span>
                </div>
              ) : categoriasList.length === 0 ? (
                <div className="text-center py-10 text-zinc-500 text-sm">
                  No hay categorías registradas.
                </div>
              ) : (
                categoriasList.map(cat => (
                  <div
                    key={cat.id_categoria}
                    className="flex items-center justify-between p-3.5 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 transition-all"
                  >
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white truncate">{cat.nombre}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            cat.estado === "inactivo"
                              ? "bg-zinc-800 text-zinc-400"
                              : "bg-emerald-500/20 text-emerald-300"
                          }`}
                        >
                          {cat.estado || "activo"}
                        </span>
                      </div>
                      {cat.descripcion && (
                        <p className="text-xs text-zinc-400 truncate mt-0.5">{cat.descripcion}</p>
                      )}
                      <p className="text-[11px] text-zinc-500 mt-1">
                        {cat.articulos_count ?? 0} producto(s) vinculado(s)
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => setEditingCat({
                          id: cat.id_categoria,
                          nombre: cat.nombre,
                          descripcion: cat.descripcion || "",
                          estado: cat.estado || "activo"
                        })}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(cat)}
                        disabled={deletingId === cat.id_categoria}
                        className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors disabled:opacity-40"
                        title="Eliminar"
                      >
                        {deletingId === cat.id_categoria ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-white/10 mt-auto shrink-0">
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 font-semibold text-sm transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CheckoutModal ────────────────────────────────────────────────────────────
function CheckoutModal({
  open, onClose, cart, products, token, onSuccess, clients,
  pedidoId, pedidoItems, pedidoCliente, isEditing, isVendedor,
}: {
  open: boolean; onClose: () => void; cart: Record<number, number>;
  products: Product[]; token: string; onSuccess: () => void; clients: Client[];
  pedidoId?: number | null; pedidoItems?: SaleItem[]; pedidoCliente?: { id: number; name: string } | null;
  isEditing?: boolean; isVendedor?: boolean;
}) {
  const [step, setStep] = useState(0);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [esPedido, setEsPedido] = useState(false);
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [descuento, setDescuento] = useState(0);
  const [recargo, setRecargo] = useState(0);
  const [pago, setPago] = useState("");
  const [formaDePago, setFormaDePago] = useState("efectivo");
  const [loading, setLoading] = useState(false);
  const [completedVentaId, setCompletedVentaId] = useState<number | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [imprimirDoble, setImprimirDoble] = useState(false);
  const [cambios, setCambios] = useState<Record<number, number>>({});
  const [hasExchanges, setHasExchanges] = useState(false);
  const [customPrices, setCustomPrices] = useState<Record<number, number>>({});

  // Cargar precios especiales/promocionales cuando se selecciona un cliente
  useEffect(() => {
    if (!selectedClient) {
      setCustomPrices({});
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };
    fetch(`${API_URL}/stock?idcliente=${selectedClient.id}`, { headers })
      .then(res => res.json())
      .then((data: Product[]) => {
        const priceMap: Record<number, number> = {};
        data.forEach(p => {
          priceMap[p.id] = p.price;
        });
        setCustomPrices(priceMap);
      })
      .catch(err => console.error("Error al cargar precios especiales del cliente:", err));
  }, [selectedClient, token]);

  // Si viene de un pedido, usar sus items; si no, usar el carrito
  const activeItems: SaleItem[] = useMemo(() => {
    if (pedidoId && pedidoItems && !isEditing) return pedidoItems;
    return Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const prod = products.find(p => p.id === Number(id));
        const pedItem = pedidoItems?.find(pi => pi.id === Number(id));
        const name = prod?.name || pedItem?.name || "Desconocido";
        const basePrice = prod ? prod.price : (pedItem ? pedItem.price : 0);
        const price = prod && customPrices[prod.id] !== undefined ? customPrices[prod.id] : basePrice;
        return { id: Number(id), quantity: qty, price: price, name: name };
      });
  }, [pedidoId, pedidoItems, cart, products, customPrices, isEditing]);

  const subtotal = useMemo(() => {
    return activeItems.reduce((s, item) => {
      const cambioQty = cambios[item.id] || 0;
      const cobradoQty = Math.max(0, item.quantity - cambioQty);
      return s + (item.price * cobradoQty);
    }, 0);
  }, [activeItems, cambios]);

  const totalFinal = useMemo(() => {
    const desc = (descuento / 100) * subtotal;
    const rec  = (recargo / 100) * subtotal;
    return Math.round((subtotal - desc + rec) * 100) / 100;
  }, [subtotal, descuento, recargo]);

  const pagoNum = useMemo(() => parsePaymentInput(pago), [pago]);

  const saldo = useMemo(() => Math.max(0, Math.round((totalFinal - pagoNum) * 100) / 100), [totalFinal, pagoNum]);

  const vuelto = useMemo(() => Math.max(0, Math.round((pagoNum - totalFinal) * 100) / 100), [totalFinal, pagoNum]);

  useEffect(() => { setPago(formatPaymentInput(totalFinal.toString().replace(".", ","))); }, [totalFinal]);

  useEffect(() => {
    if (open) {
      setStep(0); setClientSearch(""); setDescuento(0);
      setRecargo(0); setFormaDePago("efectivo"); setEsPedido(false); setFechaEntrega("");
      setCambios({});
      setHasExchanges(false);
      setCustomPrices({});
      setCompletedVentaId(null);
      // Pre-cargar cliente del pedido si viene
      if (pedidoCliente) {
        const found = clients.find(c => c.id === pedidoCliente.id);
        setSelectedClient(found || { id: pedidoCliente.id, name: pedidoCliente.name, address: "", balance: 0 });
      } else {
        setSelectedClient(null);
      }
    }
  }, [open, pedidoCliente, clients]);

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const handleConfirm = async () => {
    setLoading(true);
    try {
      let res;
      if (pedidoId && isEditing) {
        // Editar items de un pedido existente usando POST para evitar bloqueos de servidores
        res = await fetch(`${API_URL}/pedidos/${pedidoId}/editar`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            cart: activeItems.map(i => ({ id: i.id, quantity: i.quantity, price: i.price })),
            total: totalFinal,
          }),
        });
      } else if (pedidoId) {
        // Cobrar pedido existente
        res = await fetch(`${API_URL}/pedidos/${pedidoId}/cobrar`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ pago: pagoNum, forma_de_pago: formaDePago }),
        });
      } else {
        // Venta nueva
        const exchangesList = Object.entries(cambios)
          .filter(([, qty]) => qty > 0)
          .map(([id, qty]) => ({ id: Number(id), quantity: qty }));

        res = await fetch(`${API_URL}/ventas`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Accept": "application/json",
            Authorization: `Bearer ${token}` 
          },
          body: JSON.stringify({
            cart: activeItems.map(i => ({ id: i.id, quantity: i.quantity, price: i.price })),
            total: totalFinal,
            idcliente: selectedClient?.id ?? null,
            tipo_venta: isVendedor || !selectedClient ? "venta_rapida" : "venta_reparto",
            descuento, recargo, pago: pagoNum,
            forma_de_pago: formaDePago,
            es_pedido: esPedido,
            fecha_entrega: esPedido ? fechaEntrega : null,
            exchanges: exchangesList,
          }),
        });
      }

      let parsedRes: any = {};
      if (res.ok) {
        try { parsedRes = await res.json(); } catch(e){}
        const vId = parsedRes.venta_id || pedidoId;
        
        // Mostramos el modal de descarga para todas las ventas registradas por la caja/reparto
        setCompletedVentaId(vId);
      } else {
        try {
          const err = await res.json();
          alert(err.message || err.error || "Error al registrar venta");
        } catch {
          const text = await res.text();
          alert(`Error del servidor (${res.status}): ${text.substring(0, 120)}`);
        }
      }
    } catch (err: any) { 
      console.error("Error al registrar venta:", err);
      alert(err?.message || "Error de conexión"); 
    }
    finally { setLoading(false); }
  };

  const handleDownloadPdf = async () => {
    if (!completedVentaId) return;
    setLoadingPdf(true);
    try {
      const res = await fetch(`${API_URL}/pedidos/${completedVentaId}/comprobante?doble=${imprimirDoble}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Comprobante_${completedVentaId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        alert("Error al descargar PDF");
      }
    } catch {
      alert("Error de conexión al descargar PDF");
    } finally {
      setLoadingPdf(false);
    }
  };

  if (!open) return null;

  if (completedVentaId) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
            <Check className="w-8 h-8 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2"> ¡Venta Exitosa!</h2>
          <p className="text-sm text-zinc-400 mb-6">El pedido de reparto fue registrado correctamente.</p>
          <div className="flex flex-col gap-3 w-full">
            <label className="flex items-center justify-center gap-2 cursor-pointer text-zinc-300">
              <input type="checkbox" checked={imprimirDoble} onChange={(e) => setImprimirDoble(e.target.checked)} className="rounded border-zinc-700 bg-zinc-800 text-brand-red focus:ring-brand-red" />
              <span className="text-sm">Imprimir 2 copias por hoja (Remito)</span>
            </label>
            <button 
              onClick={handleDownloadPdf}
              disabled={loadingPdf}
              className="w-full bg-brand-red text-white font-bold py-3.5 rounded-xl hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
            >
              {loadingPdf ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              {loadingPdf ? "Descargando..." : "Descargar Comprobante"}
            </button>
            <button 
              onClick={() => { setCompletedVentaId(null); onSuccess(); onClose(); }}
              className="w-full bg-white/5 text-zinc-300 font-bold py-3.5 rounded-xl hover:bg-white/10 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isPedidoMode = !!pedidoId;
  const isEditingMode = isPedidoMode && isEditing;
  const stepTitles = isEditingMode
    ? ["Confirmar Cambios"]
    : isPedidoMode
      ? ["Resumen Pedido", "Pago"]
      : ["Cliente", "Ajustes", "Pago"];
  const totalSteps = isEditingMode ? 1 : isPedidoMode ? 2 : 3;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-3xl md:rounded-3xl border-t md:border border-white/10 bg-zinc-950 p-6 pb-10 md:pb-6 shadow-2xl overflow-y-auto transition-all duration-300" style={{ maxHeight: "90vh" }}>
        <div className="mx-auto mb-5 h-1 w-12 rounded-full bg-white/20 md:hidden" />
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-widest">
              {isPedidoMode ? "Entregar Pedido" : `Paso ${step + 1} de ${totalSteps}`}
            </p>
            <h2 className="text-2xl font-bold">{stepTitles[step]}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-white/5 border border-white/10">
            <X className="h-5 w-5 text-zinc-400" />
          </button>
        </div>
        <div className="flex gap-2 mb-6">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= step ? "bg-brand-red" : "bg-white/10"}`} />
          ))}
        </div>

        {/* ── PASO 0: CLIENTE (solo venta nueva) ── */}
        {step === 0 && !isPedidoMode && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-3 space-y-2">
              {activeItems.map(item => {
                const origProd = products.find(p => p.id === item.id);
                const hasPromo = origProd && origProd.price !== item.price;
                return (
                  <div key={item.id} className="flex justify-between text-sm items-center">
                    <div className="flex flex-col">
                      <span className="text-zinc-300 font-medium">{item.quantity}x {item.name}</span>
                      {hasPromo && (
                        <span className="text-[10px] text-emerald-400 font-semibold tracking-wide"> ¡Precio especial aplicado!</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {hasPromo && (
                        <span className="text-xs text-zinc-500 line-through">
                          ${(origProd.price * item.quantity).toFixed(2)}
                        </span>
                      )}
                      <span className={hasPromo ? "text-emerald-400 font-bold" : "text-zinc-400"}>
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div className="border-t border-white/10 pt-2 flex justify-between font-bold">
                <span>Subtotal</span>
                <span className="text-brand-yellow">${subtotal.toFixed(2)}</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-400 uppercase tracking-widest mb-2 block">Cliente</label>
              {selectedClient ? (
                <div className="flex items-center justify-between rounded-2xl border border-brand-red/40 bg-brand-red/10 p-3">
                  <div>
                    <p className="font-semibold text-sm">{selectedClient.name}</p>
                    <p className="text-xs text-zinc-400">{selectedClient.address}</p>
                  </div>
                  <button onClick={() => setSelectedClient(null)} className="p-1 rounded-full bg-white/5">
                    <X className="h-4 w-4 text-zinc-400" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input value={clientSearch} onChange={e => setClientSearch(e.target.value)}
                      placeholder="Buscar cliente..." className="w-full h-11 rounded-xl bg-white/5 border border-white/10 pl-9 pr-3 text-sm outline-none focus:border-brand-red" />
                  </div>
                  {clientSearch && (
                    <div className="rounded-2xl border border-white/10 bg-zinc-900 overflow-hidden max-h-40 overflow-y-auto">
                      {filteredClients.slice(0, 6).map(c => (
                        <button key={c.id} onClick={() => { setSelectedClient(c); setClientSearch(""); }}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 border-b border-white/5 last:border-0 flex justify-between items-center">
                          <span>{c.name}</span>
                          {c.balance > 0 && <span className="text-xs text-red-400">Debe ${c.balance.toLocaleString('es-AR')}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-zinc-500 mt-1">Sin cliente = Consumidor Final</p>
                </>
              )}
            </div>
            <div onClick={() => setEsPedido(!esPedido)}
              className={`flex items-center justify-between rounded-2xl border p-4 cursor-pointer transition-all ${esPedido ? "border-brand-red/50 bg-brand-red/10" : "border-white/10 bg-white/5"}`}>
              <div className="flex items-center gap-3">
                <Clock className={`h-5 w-5 ${esPedido ? "text-brand-yellow" : "text-zinc-500"}`} />
                <div>
                  <p className="text-sm font-semibold">Guardar como Pedido</p>
                  <p className="text-xs text-zinc-500">Entregar en otra fecha</p>
                </div>
              </div>
              <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${esPedido ? "border-brand-red bg-brand-red" : "border-white/20"}`}>
                {esPedido && <Check className="h-3 w-3 text-white" />}
              </div>
            </div>
            {esPedido && (
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input type="date" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)}
                  className="w-full h-11 rounded-xl bg-white/5 border border-white/10 pl-9 pr-3 text-sm outline-none focus:border-brand-red text-white" />
              </div>
            )}
            <button onClick={() => setStep(1)}
              className="w-full bg-brand-red text-white py-4 rounded-2xl font-bold shadow-lg shadow-brand-red/20 active:scale-95 flex items-center justify-center gap-2">
              Continuar <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* ── PASO 0 PEDIDO: Resumen ── */}
        {step === 0 && isPedidoMode && (
          <div className="space-y-4">
            {pedidoCliente && (
              <div className="flex items-center gap-3 rounded-2xl border border-brand-red/30 bg-brand-red/10 p-3">
                <UserIcon className="h-4 w-4 text-brand-yellow" />
                <span className="text-sm font-semibold">{pedidoCliente.name}</span>
              </div>
            )}
            <div className="rounded-2xl bg-white/5 border border-white/10 p-3 space-y-2">
              {activeItems.map(item => {
                const origProd = products.find(p => p.id === item.id);
                const hasPromo = origProd && origProd.price !== item.price;
                return (
                  <div key={item.id} className="flex justify-between text-sm items-center">
                    <div className="flex flex-col">
                      <span className="text-zinc-300 font-medium">{item.quantity}x {item.name}</span>
                      {hasPromo && (
                        <span className="text-[10px] text-emerald-400 font-semibold tracking-wide"> ¡Precio especial aplicado!</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {hasPromo && (
                        <span className="text-xs text-zinc-500 line-through">
                          ${(origProd.price * item.quantity).toFixed(2)}
                        </span>
                      )}
                      <span className={hasPromo ? "text-emerald-400 font-bold" : "text-zinc-400"}>
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div className="border-t border-white/10 pt-2 flex justify-between font-bold">
                <span>Total del Pedido</span>
                <span className="text-brand-yellow">${subtotal.toFixed(2)}</span>
              </div>
            </div>
            {isEditingMode ? (
              <button onClick={handleConfirm} disabled={loading}
                className="w-full bg-brand-red text-white py-4 rounded-2xl font-bold shadow-lg shadow-brand-red/20 active:scale-95 flex items-center justify-center gap-2">
                {loading ? "Guardando..." : <><Check className="h-5 w-5" /> Guardar Cambios</>}
              </button>
            ) : (
              <button onClick={() => setStep(1)}
                className="w-full bg-brand-red text-white py-4 rounded-2xl font-bold shadow-lg shadow-brand-red/20 active:scale-95 flex items-center justify-center gap-2">
                Ir al Pago <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </div>
        )}

        {/* ── PASO 1: AJUSTES (solo venta nueva) ── */}
        {step === 1 && !isPedidoMode && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex justify-between">
              <span className="text-zinc-400 text-sm">Subtotal</span>
              <span className="font-bold">${subtotal.toFixed(2)}</span>
            </div>
            <div>
              <label className="text-xs text-zinc-400 uppercase tracking-widest mb-2 block">Descuento (%)</label>
              <div className="flex gap-2 mb-2">
                {[0, 5, 10, 15].map(v => (
                  <button key={v} onClick={() => setDescuento(v)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${descuento === v ? "bg-green-500 text-white" : "bg-white/5 border border-white/10 text-zinc-300"}`}>
                    {v === 0 ? "-" : `${v}%`}
                  </button>
                ))}
              </div>
              <div className="relative">
                <input type="number" min={0} max={100} value={descuento}
                  onChange={e => setDescuento(Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm outline-none focus:border-green-500 text-white" placeholder="Personalizado..." />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">%</span>
              </div>
              {descuento > 0 && <p className="text-xs text-green-400 mt-1">-${((descuento / 100) * subtotal).toFixed(2)}</p>}
            </div>
            <div>
              <label className="text-xs text-zinc-400 uppercase tracking-widest mb-2 block">Recargo (%)</label>
              <div className="relative">
                <input type="number" min={0} max={100} value={recargo}
                  onChange={e => setRecargo(Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm outline-none focus:border-brand-red text-white" placeholder="Porcentaje de recargo..." />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">%</span>
              </div>
              {recargo > 0 && <p className="text-xs text-brand-yellow mt-1">+${((recargo / 100) * subtotal).toFixed(2)}</p>}
            </div>

            {/* Ã°Å¸ € €ž Cambio de Mercadería */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-brand-yellow" />
                  <span className="text-sm font-semibold">¿Incluye cambios/reposición?</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={hasExchanges} 
                  onChange={e => {
                    setHasExchanges(e.target.checked);
                    if (!e.target.checked) setCambios({});
                  }}
                  className="h-4.5 w-4.5 rounded border-white/20 bg-zinc-900 text-brand-red accent-brand-red cursor-pointer"
                />
              </div>
              
              {hasExchanges && (
                <div className="space-y-3 pt-2 border-t border-white/5">
                  <p className="text-xs text-zinc-400">Indica cuántas unidades entregadas corresponden a un cambio (se restarán del cobro):</p>
                  {activeItems.map(item => {
                    const maxQty = item.quantity;
                    const val = cambios[item.id] || 0;
                    return (
                      <div key={item.id} className="flex items-center justify-between text-sm bg-black/30 p-2.5 rounded-xl border border-white/5">
                        <span className="text-zinc-300 font-medium truncate max-w-[150px]">{item.name}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCambios(prev => ({ ...prev, [item.id]: Math.max(0, val - 1) }))}
                            className="h-7 w-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold"
                          >
                            -
                          </button>
                          <span className="w-6 text-center font-semibold">{val}</span>
                          <button
                            type="button"
                            onClick={() => setCambios(prev => ({ ...prev, [item.id]: Math.min(maxQty, val + 1) }))}
                            className="h-7 w-7 flex items-center justify-center rounded-lg bg-brand-red hover:bg-orange-600 text-white font-bold"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-brand-red/10 border border-brand-red/30 p-4 flex justify-between items-center">
              <span className="font-semibold text-brand-yellow">Total a Cobrar</span>
              <span className="text-2xl font-bold">${totalFinal.toFixed(2)}</span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(0)} className="flex-1 py-4 rounded-2xl border border-white/10 text-zinc-300 font-semibold active:scale-95">Atrás</button>
              <button onClick={() => setStep(2)} className="flex-1 bg-brand-red text-white py-4 rounded-2xl font-bold active:scale-95">Continuar</button>
            </div>
          </div>
        )}

        {/* ── ULTIMO PASO: PAGO ── */}
        {((step === 2 && !isPedidoMode) || (step === 1 && isPedidoMode)) && (
          <div className="space-y-5">
            {!esPedido && (
              <>
                <div>
                  <label className="text-xs text-zinc-400 uppercase tracking-widest mb-2 block">Forma de Pago</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: "efectivo", label: "Efectivo", icon: Banknote },
                      { value: "transferencia", label: "Transfer.", icon: CreditCard },
                      { value: "debito", label: "Débito", icon: CreditCard },
                    ].map(({ value, label, icon: Icon }) => (
                      <button key={value} onClick={() => setFormaDePago(value)}
                        className={`py-3 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition-all ${formaDePago === value ? "bg-brand-red text-white" : "bg-white/5 border border-white/10 text-zinc-300"}`}>
                        <Icon className="h-4 w-4" /> {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 uppercase tracking-widest mb-2 block">
                    Pago Recibido <span className="text-zinc-600 normal-case">(deja menos para dejar a cuenta)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-yellow font-bold text-lg">$</span>
                    <input type="text" value={pago}
                      onChange={e => setPago(formatPaymentInput(e.target.value))}
                      className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 pl-10 pr-4 text-xl font-bold outline-none focus:border-brand-red text-white" />
                  </div>
                </div>
                <div className={`rounded-2xl p-4 flex justify-between items-center transition-all ${
                  saldo > 0 ? "bg-red-500/10 border border-red-500/30" :
                  vuelto > 0 ? "bg-brand-red/10 border border-brand-red/30 animate-pulse" :
                  "bg-emerald-500/10 border border-emerald-500/30"
                }`}>
                  <div>
                    {saldo > 0 ? (
                      <>
                        <p className="text-xs text-zinc-400">Queda en cuenta corriente</p>
                        <p className="text-xl font-bold text-red-300">
                          -${saldo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </p>
                      </>
                    ) : vuelto > 0 ? (
                      <>
                        <p className="text-xs text-brand-yellow">Vuelto a entregar</p>
                        <p className="text-xl font-bold text-brand-yellow">
                          ${vuelto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-zinc-400">Saldo</p>
                        <p className="text-xl font-bold text-emerald-300">Pagado ✓</p>
                      </>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-400">Total</p>
                    <p className="text-xl font-bold">${totalFinal.toFixed(2)}</p>
                  </div>
                </div>
              </>
            )}
            {esPedido && (
              <div className="rounded-2xl bg-blue-500/10 border border-blue-500/30 p-4 text-center space-y-2">
                <Clock className="h-8 w-8 text-blue-400 mx-auto" />
                <p className="font-semibold text-blue-300">Guardando como Pedido</p>
                <p className="text-xs text-zinc-400">Entrega: {fechaEntrega || "sin fecha"} · ${totalFinal.toFixed(2)}</p>
              </div>
            )}
            {selectedClient && (
              <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                <UserIcon className="h-4 w-4 text-brand-yellow" />
                <span className="text-sm text-zinc-300">{selectedClient.name}</span>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setStep(isPedidoMode ? 0 : 1)} className="flex-1 py-4 rounded-2xl border border-white/10 text-zinc-300 font-semibold active:scale-95">Atrás</button>
              <button onClick={handleConfirm} disabled={loading}
                className="flex-1 bg-brand-red text-white py-4 rounded-2xl font-bold shadow-lg shadow-brand-red/20 active:scale-95 flex items-center justify-center gap-2">
                {loading ? "Guardando..." : <><CheckCircle2 className="h-5 w-5" /> Confirmar</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ClienteDetalle Modal ─────────────────────────────────────────────────────
function ClienteDetalleModal({ client, token, onClose, onCargarPago }: { client: Client; token: string; onClose: () => void; onCargarPago: (client: Client) => void; }) {
  const [ventas, setVentas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/clientes/${client.id}/ventas`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setVentas).finally(() => setLoading(false));
  }, [client.id, token]);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-3xl md:rounded-3xl border-t md:border border-white/10 bg-zinc-950 p-6 pb-10 md:pb-6 shadow-2xl overflow-y-auto transition-all duration-300" style={{ maxHeight: "85vh" }}>
        <div className="mx-auto mb-5 h-1 w-12 rounded-full bg-white/20 md:hidden" />
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">{client.name}</h2>
            <p className="text-xs text-zinc-400">{client.address}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-white/5 border border-white/10">
            <X className="h-5 w-5 text-zinc-400" />
          </button>
        </div>
        <div className={`rounded-2xl p-4 flex justify-between items-center mb-5 ${client.balance > 0 ? "bg-red-500/10 border border-red-500/30" : "bg-emerald-500/10 border border-emerald-500/30"}`}>
          <div>
            <span className="text-xs font-medium text-zinc-400 block">Saldo total</span>
            <span className={`text-2xl font-bold ${client.balance > 0 ? "text-red-300" : "text-emerald-300"}`}>
              {client.balance > 0 ? `-$${client.balance.toLocaleString('es-AR')}` : "Sin deuda ✓"}
            </span>
          </div>
          {client.balance > 0 && (
            <button
              onClick={() => onCargarPago(client)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 text-xs transition-all flex items-center gap-1 shrink-0"
            >
              <CircleDollarSign className="h-4 w-4" /> Cargar Pago
            </button>
          )}
        </div>
        <h3 className="text-xs text-zinc-500 uppercase tracking-widest mb-3">Ãšltimas ventas</h3>
        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-2xl bg-white/5 animate-pulse" />)}</div>
        ) : ventas.length === 0 ? (
          <p className="text-center text-zinc-500 text-sm mt-6">Sin ventas registradas</p>
        ) : (
          <div className="space-y-3">
            {ventas.map(v => (
              <div key={v.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-semibold">{v.fecha}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{v.items}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">${v.total.toLocaleString('es-AR')}</p>
                    {v.saldo > 0 && <p className="text-xs text-red-400">Debe ${v.saldo.toLocaleString('es-AR')}</p>}
                    {v.saldo === 0 && <p className="text-xs text-emerald-400">Pagado</p>}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-0.5 text-zinc-400">{v.forma_pago}</span>
                  <span className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-0.5 text-zinc-400">Pagó ${v.pago.toLocaleString('es-AR')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CargarPago Modal ─────────────────────────────────────────────────────────
function CargarPagoModal({
  client, token, onClose, onSuccess
}: {
  client: Client; token: string; onClose: () => void; onSuccess: () => void;
}) {
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [ventas, setVentas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const [selectedVentaIds, setSelectedVentaIds] = useState<number[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/clientes/${client.id}/ventas?only_debt=true`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        setVentas(data);
      })
      .finally(() => setLoading(false));
  }, [client.id, token]);

  const toggleVenta = (id: number) => {
    setSelectedVentaIds(prev => 
      prev.includes(id) ? prev.filter(vId => vId !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    if (selectedVentaIds.length > 0) {
      const sum = ventas.filter(v => selectedVentaIds.includes(v.id)).reduce((s, v) => s + v.saldo, 0);
      setMonto(sum.toString());
    } else {
      setMonto("");
    }
  }, [selectedVentaIds, ventas]);

  const distribution = useMemo(() => {
    const amountNum = parsePaymentInput(monto);
    let remaining = amountNum;
    const targetVentas = selectedVentaIds.length > 0 
      ? ventas.filter(v => selectedVentaIds.includes(v.id))
      : ventas;
      
    const sortedForDist = [...targetVentas].sort((a, b) => a.id - b.id);
    const distResult: any[] = [];
    
    sortedForDist.forEach(v => {
      const allocated = Math.min(v.saldo, remaining);
      remaining -= allocated;
      distResult.push({
        ...v,
        allocated,
        newSaldo: Math.round((v.saldo - allocated) * 100) / 100
      });
    });
    
    return distResult;
  }, [ventas, monto, selectedVentaIds]);

  const totalSaldos = useMemo(() => {
    const targetVentas = selectedVentaIds.length > 0 
      ? ventas.filter(v => selectedVentaIds.includes(v.id))
      : ventas;
    return targetVentas.reduce((s, v) => s + v.saldo, 0);
  }, [ventas, selectedVentaIds]);

  const newTotalBalance = useMemo(() => {
    const amountNum = parsePaymentInput(monto);
    return Math.max(0, Math.round((totalSaldos - amountNum) * 100) / 100);
  }, [totalSaldos, monto]);

  const vuelto = useMemo(() => {
    const amountNum = parsePaymentInput(monto);
    return Math.max(0, Math.round((amountNum - totalSaldos) * 100) / 100);
  }, [totalSaldos, monto]);

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      const res = await fetch(`${API_URL}/clientes/${client.id}/resumen-pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const rawBlob = await res.blob();
        const blob = new Blob([rawBlob], { type: "application/pdf" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `resumen_cuenta_${client.name.replace(/\s+/g, "_")}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        const err = await res.json();
        alert(err.message || "Error al generar el PDF");
      }
    } catch {
      alert("Error al descargar el resumen de cuenta");
    } finally {
      setPdfLoading(false);
    }
  };

  const handleConfirm = async () => {
    const amountNum = parsePaymentInput(monto);
    if (amountNum <= 0) {
      alert("Por favor ingrese un monto válido.");
      return;
    }
    setLoadingSubmit(true);
    try {
      const res = await fetch(`${API_URL}/clientes/${client.id}/pagar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          monto: amountNum, 
          descripcion,
          ventas_seleccionadas: selectedVentaIds.length > 0 ? selectedVentaIds : undefined
        }),
      });
      if (res.ok) {
        onSuccess();
      } else {
        const err = await res.json();
        alert(err.message || "Error al registrar el pago");
      }
    } catch {
      alert("Error de conexión");
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-3xl md:rounded-3xl border-t md:border border-white/10 bg-zinc-950 p-6 pb-10 md:pb-6 shadow-2xl overflow-y-auto transition-all duration-300" style={{ maxHeight: "85vh" }}>
        <div className="mx-auto mb-5 h-1 w-12 rounded-full bg-white/20 md:hidden" />
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">Cargar Pago</h2>
            <p className="text-xs text-zinc-400">{client.name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-white/5 border border-white/10">
            <X className="h-5 w-5 text-zinc-400" />
          </button>
        </div>

        {loading ? (
          <div className="space-y-3 py-6">
            <div className="h-12 rounded-xl bg-white/5 animate-pulse" />
            <div className="h-12 rounded-xl bg-white/5 animate-pulse" />
            <div className="h-24 rounded-2xl bg-white/5 animate-pulse" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Inputs de Monto y Nota */}
            <div>
              <label className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5 block">Monto del Pago</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-yellow font-bold text-lg">$</span>
                <input
                  type="text"
                  value={monto}
                  onChange={e => setMonto(formatPaymentInput(e.target.value))}
                  placeholder="Ej: 2.000"
                  className="w-full h-12 rounded-xl bg-white/5 border border-white/10 pl-9 pr-4 font-bold outline-none focus:border-brand-red text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5 block">Descripción / Nota</label>
              <input
                type="text"
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                placeholder="Ej: Entrega a cuenta"
                className="w-full h-12 rounded-xl bg-white/5 border border-white/10 px-4 text-sm outline-none focus:border-brand-red text-white"
              />
            </div>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={pdfLoading || totalSaldos === 0}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-red/10 border border-brand-red/20 hover:bg-brand-red/20 active:scale-95 text-brand-yellow py-3 text-sm font-semibold transition-all disabled:opacity-40"
            >
              {pdfLoading ? (
                <span>Generando PDF...</span>
              ) : (
                <>
                  <ClipboardList className="h-4 w-4" />
                  <span>Ver Resumen de Cuenta (PDF)</span>
                </>
              )}
            </button>

            {/* Resumen Deuda */}
            <div className="rounded-2xl p-4 bg-white/5 border border-white/10 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-zinc-400">Deuda actual</p>
                <p className="text-base font-bold text-red-300">${totalSaldos.toLocaleString('es-AR')}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-400">Nueva deuda estimada</p>
                <p className={`text-base font-bold ${newTotalBalance > 0 ? "text-red-300" : "text-emerald-300"}`}>
                  ${newTotalBalance.toLocaleString('es-AR')}
                </p>
              </div>
            </div>

            {vuelto > 0 && (
              <div className="rounded-2xl p-4 bg-brand-red/10 border border-brand-red/30 text-center animate-pulse">
                <p className="text-xs text-brand-yellow font-semibold uppercase tracking-wider">Pago excede la deuda</p>
                <p className="text-xl font-bold text-brand-yellow mt-1">Vuelto a entregar: ${vuelto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
              </div>
            )}

            {/* Vista Previa de Distribución */}
            {ventas.length > 0 ? (
              <div>
                <label className="text-xs text-zinc-400 uppercase tracking-widest mb-2 block">Distribución de pago estimada (FIFO)</label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {ventas.map(v => {
                    const isSelected = selectedVentaIds.includes(v.id);
                    const distVenta = distribution.find(d => d.id === v.id);
                    const isTargeted = selectedVentaIds.length === 0 || isSelected;
                    return (
                    <div key={v.id} className={`rounded-xl border ${isSelected ? 'border-brand-red bg-brand-red/10' : 'border-white/5 bg-black/20'} p-3 text-xs flex gap-3 items-center transition-colors`}>
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => toggleVenta(v.id)}
                        className="rounded border-zinc-700 bg-zinc-800 text-brand-red focus:ring-brand-red w-5 h-5 cursor-pointer shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-zinc-300">{v.fecha}</p>
                        <p className="text-zinc-500 truncate max-w-[180px]">{v.items}</p>
                        <p className="text-[10px] text-zinc-400 mt-1">Saldo original: ${v.saldo.toLocaleString('es-AR')}</p>
                      </div>
                      {isTargeted && distVenta && (
                      <div className="text-right shrink-0">
                        {distVenta.allocated > 0 && (
                          <p className="font-semibold text-emerald-400">-${distVenta.allocated.toLocaleString('es-AR')}</p>
                        )}
                        <p className={`font-bold mt-1 ${distVenta.newSaldo === 0 ? "text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded inline-block" : "text-zinc-300"}`}>
                          {distVenta.newSaldo === 0 ? "Saldado ✓" : `Restan: $${distVenta.newSaldo.toLocaleString('es-AR')}`}
                        </p>
                      </div>
                      )}
                    </div>
                  )})}
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-500 text-center py-2">No hay ventas con saldo pendiente para distribuir.</p>
            )}

            {/* Acciones */}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-3.5 rounded-xl border border-white/10 text-zinc-300 font-semibold active:scale-95 text-sm">
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loadingSubmit || !monto}
                className="flex-1 bg-brand-red disabled:bg-zinc-800 disabled:text-zinc-600 text-white py-3.5 rounded-xl font-bold active:scale-95 flex items-center justify-center gap-1.5 text-sm"
              >
                {loadingSubmit ? "Procesando..." : <><Check className="h-4.5 w-4.5" /> Confirmar Pago</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ProductEditModal ─────────────────────────────────────────────────────────
function ProductEditModal({ open, product, categorias, clients, token, onClose, onSaved, onRefresh }: any) {
  const [tab, setTab] = useState("general");
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '', idcategoria: '', codigo: '', descripcion: '',
    precio_unitario: 0, precio_reparto: 0, precio_bar: 0,
    stock_local: 0,
    estado: 'activo', disponible_reparto: 1, unidad_medida: 'unidades'
  });
  const [promos, setPromos] = useState<any[]>([]);
  const [newPromo, setNewPromo] = useState({ idcliente: '', precio: '', fecha_desde: '', fecha_hasta: '' });

  useEffect(() => {
    if (open && product) {
      setFormData({
        nombre: product.name || '',
        idcategoria: product.idcategoria || '',
        codigo: product.codigo || '',
        descripcion: product.descripcion || '',
        precio_unitario: product.precio_unitario || 0,
        precio_reparto: product.precio_reparto || 0,
        precio_bar: product.precio_bar || 0,
        stock_local: product.stock_local || 0,
        estado: product.estado || 'activo',
        disponible_reparto: product.disponible_reparto ? 1 : 0,
        unidad_medida: product.unidad_medida || 'unidades',
      });
      setPromos(product.precios_especiales || []);
      setTab("general");
    }
  }, [open, product]);

  if (!open || !product) return null;

  const handleSaveProduct = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/productos/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        onSaved();
      } else alert("Error al guardar el producto");
    } catch (e) { alert("Error de red"); }
    setSaving(false);
  };

  const handleAddPromo = async () => {
    if (!newPromo.idcliente || !newPromo.precio) return alert("Cliente y precio requeridos");
    try {
      const res = await fetch(`${API_URL}/productos/${product.id}/promociones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newPromo)
      });
      if (res.ok) {
        const data = await res.json();
        const existingIdx = promos.findIndex((p: any) => p.id === data.promocion.id);
        if (existingIdx >= 0) {
            const newPromos = [...promos];
            newPromos[existingIdx] = data.promocion;
            setPromos(newPromos);
        } else {
            setPromos([...promos, data.promocion]);
        }
        if (onRefresh) onRefresh();
        setNewPromo({ idcliente: '', precio: '', fecha_desde: '', fecha_hasta: '' });
      } else alert("Error al añadir promoción");
    } catch (e) { alert("Error de red"); }
  };

  const handleDeletePromo = async (idPromo: number) => {
    if (!confirm("¿Eliminar promoción?")) return;
    try {
      const res = await fetch(`${API_URL}/promociones/${idPromo}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setPromos(promos.filter((p: any) => p.id !== idPromo));
        if (onRefresh) onRefresh();
      }
    } catch (e) { alert("Error al eliminar"); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[90vh] bg-zinc-900 border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-black/20">
          <div>
            <h2 className="text-xl font-bold text-white">Editar Producto</h2>
            <p className="text-sm text-zinc-400">{product.name}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full active:scale-95 transition-all text-zinc-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto p-4 border-b border-white/5 gap-2 scrollbar-hide shrink-0">
          {[
            { id: "general", label: "General" },
            { id: "inventario", label: "Inventario" },
            { id: "precios", label: "Precios" },
            { id: "ajustes", label: "Ajustes" },
            { id: "promociones", label: "Precios Especiales" }
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                tab === t.id ? "bg-brand-red text-white" : "bg-white/5 text-zinc-400 hover:bg-white/10"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {tab === "general" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Nombre</label>
                <input type="text" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-brand-red outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Categoría</label>
                  <select value={formData.idcategoria} onChange={e => setFormData({...formData, idcategoria: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-brand-red outline-none appearance-none">
                    <option value="">Seleccionar...</option>
                    {categorias.map((c: any) => <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Unidad de Medida</label>
                  <select value={formData.unidad_medida} onChange={e => setFormData({...formData, unidad_medida: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-brand-red outline-none appearance-none">
                    <option value="unidades">Unidades (un)</option>
                    <option value="kg">Kilogramos (kg)</option>
                    <option value="gr">Gramos (gr)</option>
                    <option value="litros">Litros (l)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Código de Barras</label>
                <input type="text" value={formData.codigo} onChange={e => setFormData({...formData, codigo: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-brand-red outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Descripción</label>
                <textarea value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} rows={3} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-brand-red outline-none resize-none" />
              </div>
            </div>
          )}

          {tab === "inventario" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                  <label className="block text-xs font-semibold text-brand-yellow mb-2 uppercase tracking-wider text-center">Stock Local (Panadería)</label>
                  <input type="number" value={formData.stock_local} onChange={e => setFormData({...formData, stock_local: Number(e.target.value)})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-lg font-bold text-center text-zinc-300 focus:border-brand-yellow outline-none" />
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <p className="text-zinc-400 text-xs mt-1">Al modificar el stock aquí, se crearán automáticamente los movimientos de distribución o devolución en el Depósito.</p>
              </div>
            </div>
          )}

          {tab === "precios" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Precio Mostrador</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                  <input type="number" value={formData.precio_unitario} onChange={e => setFormData({...formData, precio_unitario: Number(e.target.value)})} className="w-full bg-black/20 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-sm focus:border-brand-red outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Precio Reparto</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                  <input type="number" value={formData.precio_reparto} onChange={e => setFormData({...formData, precio_reparto: Number(e.target.value)})} className="w-full bg-black/20 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-sm focus:border-brand-red outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Precio Bar</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                  <input type="number" value={formData.precio_bar} onChange={e => setFormData({...formData, precio_bar: Number(e.target.value)})} className="w-full bg-black/20 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-sm focus:border-brand-red outline-none" />
                </div>
              </div>
            </div>
          )}

          {tab === "ajustes" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                <label className="block text-sm font-semibold mb-4 text-white">Estado del Artículo</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="radio" name="estado" value="activo" checked={formData.estado === 'activo'} onChange={() => setFormData({...formData, estado: 'activo'})} className="accent-brand-red w-4 h-4" /> Activo
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-zinc-400 text-sm">
                    <input type="radio" name="estado" value="inactivo" checked={formData.estado === 'inactivo'} onChange={() => setFormData({...formData, estado: 'inactivo'})} className="accent-brand-red w-4 h-4" /> Inactivo
                  </label>
                </div>
              </div>
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                <label className="block text-sm font-semibold mb-4 text-white">Disponible Reparto</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="radio" name="disponible" value={1} checked={formData.disponible_reparto === 1} onChange={() => setFormData({...formData, disponible_reparto: 1})} className="accent-brand-red w-4 h-4" /> Sí
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-zinc-400 text-sm">
                    <input type="radio" name="disponible" value={0} checked={formData.disponible_reparto === 0} onChange={() => setFormData({...formData, disponible_reparto: 0})} className="accent-brand-red w-4 h-4" /> No
                  </label>
                </div>
              </div>
            </div>
          )}

          {tab === "promociones" && (
            <div className="space-y-6">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-4">
                <h3 className="font-semibold text-sm text-white">Añadir Promoción</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">Cliente</label>
                    <select value={newPromo.idcliente} onChange={e => setNewPromo({...newPromo, idcliente: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:border-brand-red outline-none appearance-none">
                      <option value="">Seleccionar cliente...</option>
                      {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">Precio Especial</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                      <input type="number" value={newPromo.precio} onChange={e => setNewPromo({...newPromo, precio: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-xl pl-7 pr-3 py-2.5 text-sm focus:border-brand-red outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">Desde (Opcional)</label>
                    <input type="date" value={newPromo.fecha_desde} onChange={e => setNewPromo({...newPromo, fecha_desde: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:border-brand-red outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">Hasta (Opcional)</label>
                    <input type="date" value={newPromo.fecha_hasta} onChange={e => setNewPromo({...newPromo, fecha_hasta: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:border-brand-red outline-none" />
                  </div>
                </div>
                <button onClick={handleAddPromo} className="w-full bg-brand-red/20 text-brand-yellow hover:bg-brand-red hover:text-white py-2.5 rounded-xl font-bold text-sm active:scale-95 transition-all">
                  Guardar Promoción
                </button>
              </div>

              <div>
                <h3 className="font-semibold text-sm mb-3 text-white">Promociones Activas</h3>
                {promos.length === 0 ? (
                  <p className="text-zinc-500 text-sm text-center py-4 bg-black/20 rounded-xl border border-white/5">Sin promociones configuradas</p>
                ) : (
                  <div className="space-y-2">
                    {promos.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                        <div>
                          <p className="font-semibold text-sm text-white">{p.cliente_nombre}</p>
                          <p className="text-xs text-brand-yellow font-medium">${p.precio} <span className="text-zinc-500 ml-1">{p.fecha_desde ? `(${p.fecha_desde} - ${p.fecha_hasta||'Ã¢Ë†Å¾'})` : 'Permanente'}</span></p>
                        </div>
                        <button onClick={() => handleDeletePromo(p.id)} className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg active:scale-95 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {tab !== "promociones" && (
          <div className="p-4 border-t border-white/10 bg-black/20 flex gap-3 shrink-0">
            <button onClick={onClose} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl active:scale-95 transition-all text-sm">
              Cancelar
            </button>
            <button onClick={handleSaveProduct} disabled={saving} className="flex-1 py-3 bg-brand-red hover:bg-orange-600 text-white font-bold rounded-xl active:scale-95 transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? "Guardando..." : <><Check className="w-4 h-4"/> Guardar Cambios</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
const InlineStockEdit = ({
  id,
  initialStock,
  onSave
}: {
  id: number;
  initialStock: number;
  onSave: (id: number, newStock: number) => Promise<void>;
}) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(initialStock));
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    setVal(String(initialStock));
  }, [initialStock]);

  const handleSave = async () => {
    const num = Number(val);
    if (isNaN(num) || num < 0) {
      setVal(String(initialStock));
      setEditing(false);
      return;
    }
    if (num !== initialStock) {
      setLoading(true);
      await onSave(id, num);
      setLoading(false);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex justify-center items-center gap-1">
        <input
          type="number"
          autoFocus
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={handleSave}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setVal(String(initialStock)); setEditing(false); } }}
          className="w-16 h-8 text-center rounded-lg bg-black/40 border border-brand-red text-white outline-none focus:ring-1 focus:ring-brand-red font-bold text-lg"
          disabled={loading}
        />
      </div>
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="cursor-pointer hover:bg-white/10 rounded-lg px-2 py-0.5 transition-colors group inline-flex items-center gap-1 mx-auto"
      title="Click para editar stock"
    >
      <span className="font-bold text-white text-lg">{initialStock}</span>
      <Edit2 className="w-3 h-3 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
};

export default function BakeryDriverApp() {
  const [token, setToken]   = useState<string | null>(null);
  const [user, setUser]     = useState<any>(null);

  const isAdmin = user?.roles?.some((r: string) => r.toLowerCase() === 'admin');
  const isProduccion = user?.roles?.some((r: string) => r.toLowerCase() === 'produccion');
  const isVendedor = user?.roles?.some((r: string) => r.toLowerCase() === 'vendedor');
  const isVehiculo1 = user?.roles?.some((r: string) => r.toLowerCase() === 'vehiculo1');
  const isVehiculo2 = user?.roles?.some((r: string) => r.toLowerCase() === 'vehiculo2');
  const isRepartidor = user?.roles?.some((r: string) => 
    ['repartidor', 'preventista', 'vehiculo1', 'vehiculo2'].includes(r.toLowerCase())
  );
  const isClienteMayorista = user?.roles?.some((r: string) => 
    ['cliente_mayorista', 'cliente mayorista', 'cliente'].includes(r.toLowerCase())
  );

  const [adminPosMode, setAdminPosMode] = useState<"mostrador" | "reparto">("mostrador");

  const [activeTab, setActiveTab]           = useState("pos");
  const [deliveryFilter, setDeliveryFilter] = useState("All");
  const [search, setSearch]                 = useState("");
  const [cart, setCart]     = useState<Record<number, number>>({});
  const [products, setProducts]   = useState<Product[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [entregados, setEntregados] = useState<Delivery[]>([]);
  const [pedidosSubTab, setPedidosSubTab] = useState<'pendientes' | 'entregados'>('pendientes');
  const [loadingEntregados, setLoadingEntregados] = useState(false);
  const [clients, setClients]     = useState<Client[]>([]);
  const [misVentas, setMisVentas] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  // Estados específicos para Cliente Mayorista
  const [mayoristaFechaEntrega, setMayoristaFechaEntrega] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [mayoristaNotas, setMayoristaNotas] = useState('');
  const [loadingMayoristaPedido, setLoadingMayoristaPedido] = useState(false);
  const [mayoristaVentas, setMayoristaVentas] = useState<any[]>([]);
  const [loadingMayoristaCuenta, setLoadingMayoristaCuenta] = useState(false);
  const [mayoristaSearchProd, setMayoristaSearchProd] = useState('');

  React.useEffect(() => {
    if (user && isProduccion && activeTab === 'pos') {
      setActiveTab('deposito');
    }
    if (user && isClienteMayorista && (activeTab === 'pos' || activeTab === 'stock' || activeTab === 'clientes' || activeTab === 'ventas')) {
      setActiveTab('cargar_pedido');
    }
  }, [user, isProduccion, isClienteMayorista, activeTab]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [categoriasModalOpen, setCategoriasModalOpen] = useState(false);

  const [isReordering, setIsReordering] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // DnD operates on displayedProducts, but we need to update the full products array
    const activeId = Number(active.id);
    const overId = Number(over.id);
    const oldIndexInProducts = products.findIndex(i => i.id === activeId);
    const overIndexInProducts = products.findIndex(i => i.id === overId);

    const newProducts = arrayMove([...products], oldIndexInProducts, overIndexInProducts);
    setProducts(newProducts);

    // Auto-save immediately after drop
    try {
      const articulosData = newProducts.map((p, index) => ({ id: p.id, orden: index }));
      await fetch(`${API_URL}/articulos/orden`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ articulos: articulosData })
      });
    } catch {
      // silent fail, order is still updated locally
    }
  };

  const handleSaveOrder = async () => {
    setSavingOrder(true);
    try {
      const articulosData = products.map((p, index) => ({ id: p.id, orden: index }));
      const res = await fetch(`${API_URL}/articulos/orden`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ articulos: articulosData })
      });
      if (res.ok) {
        setIsReordering(false);
      } else {
        alert("Error al guardar el orden");
      }
    } catch {
      alert("Error de red");
    } finally {
      setSavingOrder(false);
    }
  };
  const [adminStock, setAdminStock] = useState<Product[]>([]);
  const [adminStockPage, setAdminStockPage] = useState(1);
  const [adminStockTotalPages, setAdminStockTotalPages] = useState(1);
  const [adminStockSearch, setAdminStockSearch] = useState("");
  const [loadingAdminStock, setLoadingAdminStock] = useState(false);
  const [adminStockRefresh, setAdminStockRefresh] = useState(0);

  const [historyFilterType, setHistoryFilterType] = useState<'day' | 'range' | 'month'>('day');
  const [historyDate, setHistoryDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [historyStartDate, setHistoryStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [historyEndDate, setHistoryEndDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [historyMonthYear, setHistoryMonthYear] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [historyTab, setHistoryTab] = useState<'movimientos' | 'estadisticas' | 'cierres'>('movimientos');
  const [productStats, setProductStats] = useState<any[]>([]);
  const [clientStats, setClientStats] = useState<{ top_clientes: any[], cambios: any[] } | null>(null);
  const [cierresList, setCierresList] = useState<any[]>([]);
  const [loadingCierres, setLoadingCierres] = useState(false);
  const [selectedCierreDetail, setSelectedCierreDetail] = useState<any | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [totalsModalOpen, setTotalsModalOpen] = useState(false);

  const [historyPage, setHistoryPage] = useState(1);
  const [historySearch, setHistorySearch] = useState("");
  const [historyType, setHistoryType] = useState("todas");
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotalEfectivo, setHistoryTotalEfectivo] = useState(0);
  const [historyTotalTransferencia, setHistoryTotalTransferencia] = useState(0);
  const [historyTotalSaldo, setHistoryTotalSaldo] = useState(0);
  const [historyTotalFacturado, setHistoryTotalFacturado] = useState(0);
  const [historyCajas, setHistoryCajas] = useState<any[]>([]);
  const [historyActiveFilter, setHistoryActiveFilter] = useState<{ type: 'caja' | 'payment', value: any } | null>(null);
  const [selectedVenta, setSelectedVenta] = useState<any | null>(null);
  const [selectedCaja, setSelectedCaja] = useState<any | null>(null); // caja detail modal

  // ── Estados de Turno (Cierre de Caja) ──
  const [cajaTurnoActivo, setCajaTurnoActivo] = useState<any | null>(null);
  const [cajaTurnoModal, setCajaTurnoModal] = useState<'abrir' | 'cerrar' | null>(null);
  const [cajaMontoApertura, setCajaMontoApertura] = useState<number | string>("");
  const [cajaFechaApertura, setCajaFechaApertura] = useState<string>("");
  const [cajaEfectivoReal, setCajaEfectivoReal] = useState<number | string>("");
  const [cajaObservaciones, setCajaObservaciones] = useState<string>("");
  const [cajaSales, setCajaSales] = useState<any[]>([]);
  const [loadingCajaSales, setLoadingCajaSales] = useState(false);
  const [imprimirDoble, setImprimirDoble] = useState(false);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const historyLoaderRef = useRef<HTMLDivElement | null>(null);

  // Driver Reservations
  const [misReservas, setMisReservas] = useState<any[]>([]);
  const [reservaModalItem, setReservaModalItem] = useState<Product | null>(null);

  // ── Depósito state ──────────────────────────────────────────────────────────
  const [depositoArticulos, setDepositoArticulos] = useState<any[]>([]);
  const [repartidores, setRepartidores] = useState<{id: number, name: string}[]>([]);
  const [depositoMP, setDepositoMP] = useState<any[]>([]);
  const [depositoReservasPendientes, setDepositoReservasPendientes] = useState<any[]>([]);
  const [depositoMovimientos, setDepositoMovimientos] = useState<any[]>([]);
  const [depositoHistoryPage, setDepositoHistoryPage] = useState(1);
  const [depositoHistorySearch, setDepositoHistorySearch] = useState("");
  const [depositoHistoryDate, setDepositoHistoryDate] = useState("");
  const [depositoHistoryTotalPages, setDepositoHistoryTotalPages] = useState(1);
  const [loadingDeposito, setLoadingDeposito] = useState(false);
  const [depositoSubTab, setDepositoSubTab] = useState<'stock' | 'mp' | 'historial' | 'reservas'>('stock');
  const [depositoModal, setDepositoModal] = useState<null | 'entrada' | 'editar_entrada' | 'distribuir' | 'salida_mp' | 'devolucion'>(null);
  const [depositoModalItem, setDepositoModalItem] = useState<any>(null);
  const [depositoSearchStock, setDepositoSearchStock] = useState("");
  const [depositoPageStock, setDepositoPageStock] = useState(1);
  const [depositoSearchMP, setDepositoSearchMP] = useState("");
  const [depositoPageMP, setDepositoPageMP] = useState(1);

  // ── Materias Primas state ────────────────────────────────────────────────────
  const [materiaPrimas, setMateriaPrimas] = useState<any[]>([]);
  const [loadingMP, setLoadingMP] = useState(false);
  const [mpSearch, setMpSearch] = useState("");
  const [mpPage, setMpPage] = useState(1);
  const [mpTotalPages, setMpTotalPages] = useState(1);
  const [mpModal, setMpModal] = useState<null | 'crear' | 'editar'>(null);
  const [mpEditing, setMpEditing] = useState<any>(null);
  const [mpForm, setMpForm] = useState({ nombre: '', precio: 0, peso: 0, unidad_medida: 'kg' });

  // ── Recetas state ────────────────────────────────────────────────────────────
  const [recetas, setRecetas] = useState<any[]>([]);
  const [loadingRecetas, setLoadingRecetas] = useState(false);
  const [recetaSearch, setRecetaSearch] = useState("");
  const [recetaPage, setRecetaPage] = useState(1);
  const [recetaArticuloSearch, setRecetaArticuloSearch] = useState('');
  const [recetaArticuloDropdownOpen, setRecetaArticuloDropdownOpen] = useState(false);
  const [recetaModal, setRecetaModal] = useState<null | 'crear' | 'editar'>(null);
  const [recetaEditing, setRecetaEditing] = useState<any>(null);
  const [recetaForm, setRecetaForm] = useState<any>({ 
    nombre: '', descripcion: '', porciones: 1, id_articulo_resultado: '',
    empleado: 0, costo_elaboracion: 0, costo_unitario: 0, porcentaje_ganancia: 0, precio_unitario: 0, iva: 0, precio_iva: 0, ganancia: 0
  });
  const [recetaIngredientes, setRecetaIngredientes] = useState<any[]>([]);
  const [recetaIngSearch, setRecetaIngSearch] = useState('');
  const [recetaEjecutarModal, setRecetaEjecutarModal] = useState<any>(null);
  const [recetaEjecutarQty, setRecetaEjecutarQty] = useState(1);

  // Math for Receta
  const recetaTotalPages = Math.ceil(recetas.length / 6) || 1;
  const subtotalIngredientes = useMemo(() => {
    return recetaIngredientes.reduce((sum, i) => {
      const p = parseFloat(i.precio) || 0;
      const w = parseFloat(i.peso) || 1;
      const qty = parseFloat(i.cantidad) || 0;
      return sum + (qty * p / Math.max(1, w));
    }, 0);
  }, [recetaIngredientes]);

  React.useEffect(() => {
    if (recetaModal) {
      const emp = parseFloat(String(recetaForm.empleado).replace(',', '.')) || 0;
      const costo_elaboracion = subtotalIngredientes + emp;
      const porc = parseFloat(String(recetaForm.porciones).replace(',', '.')) || 1;
      const costo_unitario = costo_elaboracion / Math.max(0.01, porc);
      const porc_ganancia = parseFloat(String(recetaForm.porcentaje_ganancia).replace(',', '.')) || 0;
      const ganancia = costo_unitario * (porc_ganancia / 100);
      const precio_unitario = costo_unitario + ganancia;
      const iva = parseFloat(String(recetaForm.iva).replace(',', '.')) || 0;
      const precio_iva = precio_unitario * (1 + (iva / 100));

      setRecetaForm((prev: any) => ({
        ...prev,
        costo_elaboracion: costo_elaboracion.toFixed(2),
        costo_unitario: costo_unitario.toFixed(2),
        ganancia: ganancia.toFixed(2),
        precio_unitario: precio_unitario.toFixed(2),
        precio_iva: precio_iva.toFixed(2)
      }));
    }
  }, [subtotalIngredientes, recetaForm.empleado, recetaForm.porciones, recetaForm.porcentaje_ganancia, recetaForm.iva, recetaModal]);

  const filteredDepositoArticulos = useMemo(() => {
    let list = depositoArticulos;
    if (depositoSearchStock.trim()) {
      list = list.filter(a => a.nombre.toLowerCase().includes(depositoSearchStock.toLowerCase()));
    }
    return list;
  }, [depositoArticulos, depositoSearchStock]);

  const filteredDepositoMP = useMemo(() => {
    let list = depositoMP;
    if (depositoSearchMP.trim()) {
      list = list.filter(mp => mp.nombre.toLowerCase().includes(depositoSearchMP.toLowerCase()));
    }
    return list;
  }, [depositoMP, depositoSearchMP]);

  const [depositoModalSelectedId, setDepositoModalSelectedId] = useState<string | number>('');
  const [depositoModalItemSearch, setDepositoModalItemSearch] = useState("");

  const depositoModalItemsList = useMemo(() => {
    const isMP = depositoModal === 'salida_mp' || depositoModalItem?.tipo === 'materia_prima';
    return isMP ? depositoMP : depositoArticulos;
  }, [depositoModal, depositoModalItem, depositoMP, depositoArticulos]);

  const depositoModalSelectedItemObj = useMemo(() => {
    return depositoModalItemsList.find(i => String(i.id) === String(depositoModalSelectedId));
  }, [depositoModalItemsList, depositoModalSelectedId]);

  const allMateriasPrimas = useMemo(() => {
    const map = new Map<string, any>();
    depositoMP.forEach(mp => {
      if (mp && mp.id) {
        map.set(String(mp.id), {
          id: mp.id,
          nombre: mp.nombre || mp.producto || '',
          stock_deposito: mp.stock_deposito ?? 0,
          unidad_medida: mp.unidad_medida || 'kg',
          precio: Number(mp.precio) || 0,
          peso: Number(mp.peso) || 1,
        });
      }
    });
    materiaPrimas.forEach(mp => {
      if (mp && mp.id) {
        const existing = map.get(String(mp.id)) || {};
        map.set(String(mp.id), {
          id: mp.id,
          nombre: mp.nombre || mp.producto || existing.nombre || '',
          stock_deposito: mp.stock_deposito ?? existing.stock_deposito ?? 0,
          unidad_medida: mp.unidad_medida || existing.unidad_medida || 'kg',
          precio: Number(mp.precio) || existing.precio || 0,
          peso: Number(mp.peso) || existing.peso || 1,
        });
      }
    });
    return Array.from(map.values());
  }, [depositoMP, materiaPrimas]);

  useEffect(() => {
    if (depositoModal) {
      setDepositoModalSelectedId(depositoModalItem?.id ?? '');
      setDepositoModalItemSearch('');
    }
  }, [depositoModal, depositoModalItem]);


  // Only payment filter goes to server; caja opens a modal (no server filter)
  const historyFormaPago = historyActiveFilter?.type === 'payment' ? (historyActiveFilter.value as string) : '';

  useEffect(() => {
    if (!token || !user) return;
    
    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const headers = { Authorization: `Bearer ${token}` };
        let queryParams = `filter_type=${historyFilterType}&page=${historyPage}&search=${historySearch}&tipo=${historyType}`;
        if (historyFormaPago) queryParams += `&forma_pago=${historyFormaPago}`;
        if (historyFilterType === 'range') {
          queryParams += `&start_date=${historyStartDate}&end_date=${historyEndDate}`;
        } else if (historyFilterType === 'month') {
          const [year, month] = historyMonthYear.split("-");
          queryParams += `&month=${month}&year=${year}`;
        } else {
          queryParams += `&date=${historyDate}`;
        }

        const res = await fetch(`${API_URL}/mis-ventas?${queryParams}`, { headers });
        if (res.ok) {
          const data = await res.json();
          // Infinite scroll: append if page > 1, replace if page === 1
          setMisVentas(prev => historyPage === 1 ? data.paginator.data : [...prev, ...data.paginator.data]);
          setHistoryTotalPages(data.paginator.last_page || 1);
          setHistoryHasMore(data.paginator.current_page < (data.paginator.last_page || 1));
          setHistoryTotalEfectivo(data.total_efectivo || 0);
          setHistoryTotalTransferencia(data.total_transferencia || 0);
          setHistoryTotalSaldo(data.total_saldo || 0);
          setHistoryTotalFacturado(data.total_facturado || 0);
          setHistoryCajas(data.cajas || []);
        }

        if (user.roles?.some((r: string) => r.toLowerCase() === 'admin')) {
          const statsRes = await fetch(`${API_URL}/admin/estadisticas/productos?${queryParams}`, { headers });
          if (statsRes.ok) setProductStats(await statsRes.json());
          
          const clientStatsRes = await fetch(`${API_URL}/admin/estadisticas/clientes?${queryParams}`, { headers });
          if (clientStatsRes.ok) setClientStats(await clientStatsRes.json());
        }
      } catch (e) {}
      setLoadingHistory(false);
    };
    
    const delayDebounceFn = setTimeout(() => {
      fetchHistory();
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [token, user, historyFilterType, historyDate, historyStartDate, historyEndDate, historyMonthYear, historyRefresh, historyPage, historySearch, historyType, historyFormaPago]);

  const fetchCajaTurno = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/admin/caja-activa`, { 
        headers: { 'Accept': 'application/json', Authorization: `Bearer ${token}` } 
      });
      if (res.ok) {
        const d = await res.json();
        setCajaTurnoActivo(d.caja || null);
      }
    } catch (e) {
      console.error("Error al obtener caja activa", e);
    }
  };

  const fetchCierres = async () => {
    if (!token) return;
    setLoadingCierres(true);
    try {
      const res = await fetch(`${API_URL}/admin/cierre-cajas`, {
        headers: { 'Accept': 'application/json', Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const d = await res.json();
        setCierresList(d.data || []);
      }
    } catch (e) {
      console.error("Error al obtener cierres de caja", e);
    } finally {
      setLoadingCierres(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchCajaTurno();
      if (historyTab === 'cierres') {
        fetchCierres();
      }
    }
  }, [token, activeTab, historyTab, historyRefresh]);

  const handleAbrirCaja = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/abrir-caja`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "Accept": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          monto_apertura: cajaMontoApertura || 0,
          fecha_apertura: cajaFechaApertura 
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCajaTurnoActivo(data.caja);
        setCajaTurnoModal(null);
        setHistoryRefresh(p => p + 1);
        fetchCajaTurno();
      } else {
        alert(data.message || "Error al abrir la caja");
        if (data.message === 'Ya hay una caja abierta.') {
          setCajaTurnoModal(null);
          fetchCajaTurno();
        }
      }
    } catch (e: any) {
      console.error("Error al abrir caja:", e);
      alert("Error al abrir caja: " + (e?.message || ""));
    }
  };

  const handleCerrarCaja = async () => {
    if (!cajaTurnoActivo) return;
    try {
      const res = await fetch(`${API_URL}/admin/cerrar-caja/${cajaTurnoActivo.id}`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "Accept": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          efectivo_real: cajaEfectivoReal || 0,
          observaciones: cajaObservaciones
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`Caja cerrada. Diferencia: $${data.caja.diferencia}`);
        setCajaTurnoActivo(null);
        setCajaTurnoModal(null);
        setHistoryRefresh(p => p + 1);
        fetchCajaTurno();
      } else {
        alert(data.message || "Error al cerrar la caja");
      }
    } catch (e: any) {
      console.error("Error al cerrar caja:", e);
      alert("Error al cerrar caja: " + (e?.message || ""));
    }
  };
  const [cajaFormaPago, setCajaFormaPago] = useState<string>("");

  useEffect(() => {
    if (!selectedCaja || !token) {
      setCajaSales([]);
      return;
    }
    const fetchCajaSales = async () => {
      setLoadingCajaSales(true);
      try {
        let queryParams = `filter_type=${historyFilterType}&search=${historySearch}&tipo=${historyType}&per_page=1000`;
        if (selectedCaja.caja_id === 'panaderia' || selectedCaja.tipo_caja === 'panaderia') {
          queryParams += `&caja_tipo=panaderia`;
        } else {
          queryParams += `&caja_tipo=reparto&user_id=${selectedCaja.user_id}`;
        }
        if (cajaFormaPago) queryParams += `&forma_pago=${cajaFormaPago}`;
        if (historyFilterType === 'range') {
          queryParams += `&start_date=${historyStartDate}&end_date=${historyEndDate}`;
        } else if (historyFilterType === 'month') {
          const [year, month] = historyMonthYear.split("-");
          queryParams += `&month=${month}&year=${year}`;
        } else {
          queryParams += `&date=${historyDate}`;
        }
        const res = await fetch(`${API_URL}/mis-ventas?${queryParams}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setCajaSales(data.paginator.data || []);
        }
      } catch (e) {}
      setLoadingCajaSales(false);
    };
    fetchCajaSales();
  }, [selectedCaja, token, historyFilterType, historyDate, historyStartDate, historyEndDate, historyMonthYear, historySearch, historyType, cajaFormaPago]);

  // Reset to page 1 when filters change (not page itself)
  useEffect(() => {
    setHistoryPage(1);
    setMisVentas([]);
  }, [historyFilterType, historyDate, historyStartDate, historyEndDate, historyMonthYear, historySearch, historyType, historyFormaPago]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (!historyLoaderRef.current || !historyHasMore || loadingHistory) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setHistoryPage(p => p + 1);
    }, { threshold: 0.5 });
    obs.observe(historyLoaderRef.current);
    return () => obs.disconnect();
  }, [historyHasMore, loadingHistory]);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastStockElementRef = useCallback((node: any) => {
    if (loadingAdminStock) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && adminStockPage < adminStockTotalPages) {
        setAdminStockPage(prev => prev + 1);
      }
    });
    if (node) observerRef.current.observe(node);
  }, [loadingAdminStock, adminStockPage, adminStockTotalPages]);

  useEffect(() => {
    if (!token || !user?.roles?.some((r: string) => r.toLowerCase() === 'admin')) return;
    const fetchAdminStock = async () => {
      setLoadingAdminStock(true);
      try {
        const res = await fetch(`${API_URL}/admin/stock?page=${adminStockPage}&search=${adminStockSearch}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (adminStockPage === 1) {
            setAdminStock(data.data);
          } else {
            setAdminStock(prev => {
              const newItems = data.data.filter((d: any) => !prev.some(p => p.id === d.id));
              return [...prev, ...newItems];
            });
          }
          setAdminStockTotalPages(data.last_page || 1);
        }
      } catch (e) {}
      setLoadingAdminStock(false);
    };

    // Si la página es > 1, no queremos debounce porque rompería el infinite scroll saltándose páginas
    if (adminStockPage > 1) {
      fetchAdminStock();
    } else {
      const delayDebounceFn = setTimeout(() => {
        fetchAdminStock();
      }, 400);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [token, user, adminStockPage, adminStockSearch, adminStockRefresh]);

  // POS search and sorting state
  const [posSearch, setPosSearch] = useState("");

  const displayedProducts = useMemo(() => {
    if (posSearch) {
      return products.filter(p => p.name.toLowerCase().includes(posSearch.toLowerCase()));
    }
    
    let baseList = [...products];
    if (isAdmin || isVendedor) {
      return baseList.filter(p => p.quantity > 0).sort((a, b) => (b.sold_qty || 0) - (a.sold_qty || 0)).slice(0, 10);
    }
    
    // Sort in-stock first, keep order stable
    return baseList.sort((a, b) => {
      const aHasStock = a.quantity > 0 ? 1 : 0;
      const bHasStock = b.quantity > 0 ? 1 : 0;
      return bHasStock - aHasStock;
    });
  }, [products, posSearch, isAdmin, isVendedor]);

  // Checkout state
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [pedidoCheckout, setPedidoCheckout] = useState<{ id: number; items: SaleItem[]; cliente: { id: number; name: string } | null } | null>(null);

  // Cliente detalle
  const [clienteDetalle, setClienteDetalle] = useState<Client | null>(null);

  // Proveedores state
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loadingProveedores, setLoadingProveedores] = useState(false);
  const [personaSubTab, setPersonaSubTab] = useState<'clientes' | 'proveedores'>('clientes');
  const [proveedorDetalle, setProveedorDetalle] = useState<Proveedor | null>(null);
  const [paymentProveedor, setPaymentProveedor] = useState<Proveedor | null>(null);
  const [proveedorSearch, setProveedorSearch] = useState("");

  const filteredProveedores = useMemo(() => {
    if (!proveedorSearch.trim()) return proveedores;
    const q = proveedorSearch.toLowerCase();
    return proveedores.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.phone && p.phone.toLowerCase().includes(q)) ||
      (p.address && p.address.toLowerCase().includes(q))
    );
  }, [proveedores, proveedorSearch]);

  const fetchProveedores = useCallback(async () => {
    if (!token) return;
    try {
      setLoadingProveedores(true);
      const res = await fetch(`${API_URL}/proveedores`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setProveedores(await res.json());
      }
    } catch (e) {
    } finally {
      setLoadingProveedores(false);
    }
  }, [token]);

  // Admin Personas (CRUD)
  const [adminClientesTab, setAdminClientesTab] = useState<'saldos' | 'gestion'>('saldos');
  const [adminPersonasTipo, setAdminPersonasTipo] = useState<string>("");
  const [adminPersonas, setAdminPersonas] = useState<any[]>([]);
  const [adminPersonasPage, setAdminPersonasPage] = useState(1);
  const [adminPersonasTotalPages, setAdminPersonasTotalPages] = useState(1);
  const [adminPersonasSearch, setAdminPersonasSearch] = useState("");
  const [loadingAdminPersonas, setLoadingAdminPersonas] = useState(false);
  const [adminPersonasRefresh, setAdminPersonasRefresh] = useState(0);
  
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  
  const [editingPersona, setEditingPersona] = useState<any | null>(null);
  const [personaForm, setPersonaForm] = useState({
    nombre: "", tipo_persona: "cliente", direccion: "", telefono: "", mail: "", user_id: ""
  });
  const [savingPersona, setSavingPersona] = useState(false);

  const observerPersonaRef = useRef<IntersectionObserver | null>(null);
  const lastPersonaElementRef = useCallback((node: any) => {
    if (loadingAdminPersonas) return;
    if (observerPersonaRef.current) observerPersonaRef.current.disconnect();
    observerPersonaRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && adminPersonasPage < adminPersonasTotalPages) {
        setAdminPersonasPage(prev => prev + 1);
      }
    });
    if (node) observerPersonaRef.current.observe(node);
  }, [loadingAdminPersonas, adminPersonasPage, adminPersonasTotalPages]);

  useEffect(() => {
    if (!token || !user?.roles?.some((r: string) => r.toLowerCase() === 'admin')) return;
    const fetchAdminPersonas = async () => {
      if (adminPersonasPage === 1) setLoadingAdminPersonas(true);
      try {
        const tipoParam = adminPersonasTipo ? `&tipo_persona=${adminPersonasTipo}` : '';
        const res = await fetch(`${API_URL}/admin/personas?page=${adminPersonasPage}&search=${adminPersonasSearch}${tipoParam}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (adminPersonasPage === 1) {
            setAdminPersonas(data.data);
          } else {
            setAdminPersonas(prev => {
              const newItems = data.data.filter((d: any) => !prev.some(p => p.idpersona === d.idpersona));
              return [...prev, ...newItems];
            });
          }
          setAdminPersonasTotalPages(data.last_page || 1);
        }
      } catch (e) {}
      setLoadingAdminPersonas(false);
    };
    const delayDebounceFn = setTimeout(() => {
      fetchAdminPersonas();
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [token, user, adminPersonasPage, adminPersonasSearch, adminPersonasTipo, adminPersonasRefresh]);

  const handleSavePersona = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingPersona(true);
    try {
      const url = editingPersona?.idpersona ? `${API_URL}/admin/personas/${editingPersona.idpersona}` : `${API_URL}/admin/personas`;
      const method = editingPersona?.idpersona ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(personaForm)
      });
      if (res.ok) {
        setEditingPersona(null);
        setAdminPersonasPage(1);
        setAdminPersonasRefresh(prev => prev + 1);
        if (personaForm.tipo_persona === 'cliente') {
           const cliRes = await fetch(`${API_URL}/clientes`, { headers: { Authorization: `Bearer ${token}` } });
           if (cliRes.ok) setClients(await cliRes.json());
        }
        if (personaForm.tipo_persona === 'proveedor') {
           fetchProveedores();
        }
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || "Error al guardar");
      }
    } catch(e) {
      alert("Error de conexión al guardar");
    } finally {
      setSavingPersona(false);
    }
  };

  const handleDeletePersona = async (id: number) => {
    if (!confirm("¿Eliminar este registro?")) return;
    if (!token) return;
    try {
      await fetch(`${API_URL}/admin/personas/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      setAdminPersonasPage(1);
      setAdminPersonasRefresh(prev => prev + 1);
    } catch(e) {}
  };

  // Cargar pago state
  const [paymentClient, setPaymentClient] = useState<Client | null>(null);

  // Pedido que se está editando
  const [editingPedido, setEditingPedido] = useState<{ id: number; cliente: { id: number; name: string } | null } | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    if (savedToken) { setToken(savedToken); fetchUser(savedToken); }
    else setLoading(false);
  }, []);

  const fetchUser = async (authToken: string) => {
    try {
      const res = await fetch(`${API_URL}/user`, { headers: { Authorization: `Bearer ${authToken}` } });
      if (res.ok) { const u = await res.json(); setUser(u); fetchAllData(authToken); }
      else logout();
    } catch { logout(); }
  };

  const fetchAllData = useCallback(async (authToken: string, full: boolean = true) => {
    // Si no es full, no bloqueamos toda la UI con setLoading(true) (asumiendo que loading solo se usa en login)
    if (full) setLoading(true);
    const headers = { Authorization: `Bearer ${authToken}` };
    try {
      const [stockRes, pedRes, cliRes, entRes, provRes] = await Promise.all([
        fetch(`${API_URL}/stock`, { headers }),
        fetch(`${API_URL}/pedidos?filtro_estado=pendientes`, { headers }),
        fetch(`${API_URL}/clientes`, { headers }),
        fetch(`${API_URL}/pedidos?filtro_estado=entregados`, { headers }),
        fetch(`${API_URL}/proveedores`, { headers }),
      ]);
      if (stockRes.ok) setProducts(await stockRes.json());
      if (pedRes.ok)   setDeliveries(await pedRes.json());
      if (cliRes.ok)   setClients(await cliRes.json());
      if (entRes.ok)   setEntregados(await entRes.json());
      if (provRes.ok)  setProveedores(await provRes.json());
      
      if (full) {
        const usrRes = await fetch(`${API_URL}/user`, { headers });
        if (usrRes.ok) {
          const u = await usrRes.json();
          if (u.roles?.some((r: string) => r.toLowerCase() === 'admin')) {
            const catRes = await fetch(`${API_URL}/categorias`, { headers });
            if (catRes.ok) setCategorias(await catRes.json());
            const mayRes = await fetch(`${API_URL}/admin/users/mayoristas`, { headers });
            if (mayRes.ok) setAdminUsers(await mayRes.json());
          } else {
            const reservasRes = await fetch(`${API_URL}/deposito/mis-reservas`, { headers });
            if (reservasRes.ok) setMisReservas(await reservasRes.json());
          }
        }
      } else {
        // Even on partial refresh, update driver reservations
        if (!user?.roles?.some((r: string) => r.toLowerCase() === 'admin')) {
          const reservasRes = await fetch(`${API_URL}/deposito/mis-reservas`, { headers });
          if (reservasRes.ok) setMisReservas(await reservasRes.json());
        }
      }
      setHistoryRefresh(prev => prev + 1);
    } catch (err) { console.error(err); }
    finally { if (full) setLoading(false); }
  }, [user]);

  const handleInlineAjusteMP = async (id: number, newStock: number) => {
    try {
      const res = await fetch(`${API_URL}/deposito/mp/${id}/ajustar`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ cantidad: newStock })
      });
      if (res.ok) {
        await fetchDeposito();
      } else {
        const data = await res.json();
        alert(data.message || 'Error al ajustar stock de materia prima');
      }
    } catch (e) {
      alert('Error de conexión al ajustar stock');
    }
  };

  const handleInlineAjuste = async (id: number, newStock: number) => {
    try {
      const res = await fetch(`${API_URL}/deposito/articulos/${id}/ajustar`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ cantidad: newStock })
      });
      if (res.ok) {
        await fetchDeposito(); // Recargar todo el depósito (artículos y MP)
      } else {
        const data = await res.json();
        alert(data.message || 'Error al ajustar stock');
      }
    } catch (e) {
      alert('Error de conexión al ajustar stock');
    }
  };

  const fetchDeposito = useCallback(async () => {
    if (!token) return;
    setLoadingDeposito(true);
    try {
      const res = await fetch(`${API_URL}/deposito`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setDepositoArticulos(data.articulos ?? []);
        setDepositoMP(data.materias_primas ?? []);
        setDepositoReservasPendientes(data.reservas_pendientes ?? []);
        setRepartidores(data.repartidores ?? []);
      }
    } catch { console.error('Error fetching deposito'); }
    finally { setLoadingDeposito(false); }
  }, [token]);

  const fetchDepositoMovimientos = useCallback(async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams({ page: depositoHistoryPage.toString() });
      if (depositoHistorySearch) params.append('search', depositoHistorySearch);
      if (depositoHistoryDate) params.append('fecha', depositoHistoryDate);
      
      const res = await fetch(`${API_URL}/deposito/movimientos?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setDepositoMovimientos(data.data ?? []);
        setDepositoHistoryTotalPages(data.last_page ?? 1);
      }
    } catch { console.error('Error fetching movimientos deposito'); }
  }, [token, depositoHistoryPage, depositoHistorySearch, depositoHistoryDate]);

  useEffect(() => {
    if (depositoSubTab === 'historial') {
      fetchDepositoMovimientos();
    }
  }, [fetchDepositoMovimientos, depositoSubTab]);

  useEffect(() => {
    const handleCompraRegistrada = () => {
      fetchDeposito();
      fetchDepositoMovimientos();
    };
    window.addEventListener('compra-registrada', handleCompraRegistrada);
    return () => window.removeEventListener('compra-registrada', handleCompraRegistrada);
  }, [fetchDeposito, fetchDepositoMovimientos]);

  const fetchMateriaPrimas = useCallback(async (page = 1, search = '') => {
    if (!token) return;
    setLoadingMP(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), per_page: '20' });
      if (search) params.append('search', search);
      const res = await fetch(`${API_URL}/admin/materias-primas?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setMateriaPrimas(data.data ?? []);
        setMpTotalPages(data.last_page ?? 1);
      }
    } catch { }
    setLoadingMP(false);
  }, [token]);

  const fetchRecetas = useCallback(async (search = '') => {
    if (!token) return;
    setLoadingRecetas(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      const res = await fetch(`${API_URL}/admin/recetas?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setRecetas(await res.json());
    } catch { }
    setLoadingRecetas(false);
  }, [token]);

  useEffect(() => {
    if (activeTab === 'deposito') {
      fetchDeposito();
    }
  }, [activeTab, fetchDeposito]);

  useEffect(() => {
    if (activeTab === 'materias') {
      fetchMateriaPrimas(mpPage, mpSearch);
    }
  }, [activeTab, fetchMateriaPrimas, mpPage]);

  useEffect(() => {
    if (activeTab === 'recetas') {
      fetchRecetas(recetaSearch);
      fetchDeposito();
      fetchMateriaPrimas(1, '');
    }
  }, [activeTab, fetchRecetas, fetchDeposito, fetchMateriaPrimas]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const email    = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("token", data.token);
        setToken(data.token); setUser(data.user); setActiveTab("pos");
        fetchAllData(data.token);
      } else { alert(data.message); setLoading(false); }
    } catch { alert("Error de conexión"); setLoading(false); }
  };

  const logout = () => {
    localStorage.removeItem("token"); setToken(null); setUser(null); setLoading(false);
  };

  const updateQuantity = (product: Product, change: number) => {
    setCart(prev => {
      const maxLimit = isClienteMayorista ? 99999 : product.quantity;
      const next = Math.max(0, Math.min(maxLimit, (prev[product.id] || 0) + change));
      return { ...prev, [product.id]: next };
    });
  };

  const handleSetQuantity = (product: Product, value: string) => {
    if (value === "") {
      setCart(prev => ({ ...prev, [product.id]: 0 }));
      return;
    }
    const parsed = parseFloat(value.replace(",", "."));
    if (isNaN(parsed)) return;
    const maxLimit = isClienteMayorista ? 99999 : product.quantity;
    const clamped = Math.max(0, Math.min(maxLimit, Math.round(parsed * 1000) / 1000));
    setCart(prev => ({ ...prev, [product.id]: clamped }));
  };

  const cartTotal = useMemo(() =>
    products.reduce((s, p) => s + p.price * (cart[p.id] || 0), 0).toFixed(2), [cart, products]);
  const cartCount = useMemo(() => Object.values(cart).reduce((s, q) => s + q, 0), [cart]);

  const [loadingActionId, setLoadingActionId] = useState<number | null>(null);


  // Cargar pedido para checkout
  const handleEntregarPedido = async (delivery: Delivery) => {
    if (loadingActionId) return;
    setLoadingActionId(delivery.id);
    try {
      const res = await fetch(`${API_URL}/pedidos/${delivery.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const pedido = await res.json();
        setPedidoCheckout({
          id: pedido.id,
          items: pedido.items,
          cliente: pedido.customer !== "Consumidor Final"
            ? { id: pedido.idcliente, name: pedido.customer }
            : null,
        });
        setCheckoutOpen(true);
      }
    } catch { alert("Error al cargar pedido"); }
    finally { setLoadingActionId(null); }
  };

  // Cargar pedido para edición en el POS
  const handleEditarPedido = async (delivery: Delivery) => {
    if (loadingActionId) return;
    setLoadingActionId(delivery.id);
    try {
      const res = await fetch(`${API_URL}/pedidos/${delivery.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const pedido = await res.json();

        // Mapear items al carrito
        const cartMap: Record<number, number> = {};
        pedido.items.forEach((item: SaleItem) => {
          cartMap[item.id] = item.quantity;
        });
        setCart(cartMap);

        // Activar modo edición
        setEditingPedido({
          id: pedido.id,
          cliente: pedido.customer !== "Consumidor Final"
            ? { id: pedido.idcliente, name: pedido.customer }
            : null,
        });

        // Redirigir al POS
        setActiveTab("pos");
      }
    } catch {
      alert("Error al cargar pedido para edición");
    } finally { setLoadingActionId(null); }
  };

  // Cancelar/Eliminar pedido
  const handleCancelarPedido = async (delivery: Delivery) => {
    if (loadingActionId) return;
    if (!confirm(`¿Estás seguro de que deseas eliminar el pedido de ${delivery.customer}?`)) {
      return;
    }
    setLoadingActionId(delivery.id);
    try {
      const res = await fetch(`${API_URL}/pedidos/${delivery.id}/cancelar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        // No mostramos alert aquí para que sea más rápido, el usuario ya ve que desaparece
        fetchAllData(token!, false);
      } else {
        const err = await res.json();
        alert(err.message || "Error al eliminar el pedido");
      }
    } catch {
      alert("Error de conexión");
    } finally { setLoadingActionId(null); }
  };

  // ── Handlers Cliente Mayorista ──
  const handleCrearPedidoMayorista = async () => {
    const selectedItems = Object.entries(cart)
      .filter(([_, qty]) => qty > 0)
      .map(([id, quantity]) => {
        const prod = products.find(p => p.id === Number(id));
        return {
          id: Number(id),
          quantity,
          price: prod?.price || 0,
        };
      });

    if (selectedItems.length === 0) {
      alert("Por favor selecciona al menos un producto para el pedido.");
      return;
    }

    if (!mayoristaFechaEntrega) {
      alert("Por favor selecciona una fecha estimada de entrega.");
      return;
    }

    const total = selectedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    setLoadingMayoristaPedido(true);

    try {
      const res = await fetch(`${API_URL}/ventas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          cart: selectedItems,
          total: total,
          es_pedido: true,
          fecha_entrega: mayoristaFechaEntrega,
          notas: mayoristaNotas.trim() || undefined,
          idcliente: user?.persona_id || user?.persona?.id || undefined,
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert("¡Pedido registrado con éxito! Tu pedido ha sido enviado a producción y reparto.");
        setCart({});
        setMayoristaNotas("");
        setActiveTab("pedidos");
        fetchAllData(token!, false);
      } else {
        alert(data.message || "Error al registrar el pedido");
      }
    } catch {
      alert("Error de conexión al registrar el pedido");
    } finally {
      setLoadingMayoristaPedido(false);
    }
  };

  const handleDownloadPdfMayorista = async () => {
    const clientId = user?.persona_id || user?.persona?.id;
    if (!clientId) {
      alert("No se encontró el cliente asociado a tu usuario.");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/clientes/${clientId}/resumen-pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Estado_Cuenta_${(user.name || 'Cliente').replace(/\s+/g, '_')}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || "No hay movimientos con saldo pendiente para descargar.");
      }
    } catch {
      alert("Error al descargar el resumen de cuenta");
    }
  };

  useEffect(() => {
    if (!token || !isClienteMayorista || activeTab !== "cuenta") return;
    const clientId = user?.persona_id || user?.persona?.id;
    if (!clientId) return;

    const fetchCuenta = async () => {
      setLoadingMayoristaCuenta(true);
      try {
        const res = await fetch(`${API_URL}/clientes/${clientId}/ventas`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setMayoristaVentas(data);
        }
      } catch (e) {
        console.error("Error al cargar estado de cuenta mayorista", e);
      } finally {
        setLoadingMayoristaCuenta(false);
      }
    };

    fetchCuenta();
  }, [token, isClienteMayorista, activeTab, user]);

  const filteredClients    = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  // ── Pedidos: búsqueda y agrupación por cliente ──
  const [pedidosSearch, setPedidosSearch] = useState("");
  const [pedidosViewMode, setPedidosViewMode] = useState<'clientes' | 'lista'>('clientes');
  const [pedidosOrigenFilter, setPedidosOrigenFilter] = useState<string>("All");
  const [collapsedClients, setCollapsedClients] = useState<Record<string, boolean>>({});

  const toggleClientCollapse = (key: string) => {
    setCollapsedClients(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const collapseAllClients = (keys: string[]) => {
    setCollapsedClients(prev => {
      const next = { ...prev };
      keys.forEach(k => { next[k] = true; });
      return next;
    });
  };

  const expandAllClients = (keys: string[]) => {
    setCollapsedClients(prev => {
      const next = { ...prev };
      keys.forEach(k => { next[k] = false; });
      return next;
    });
  };

  const filteredDeliveries = useMemo(() => {
    return deliveries.filter(d => {
      const isInactive = d.estado && ['inactivo', 'cancelado', 'anulado', 'eliminado'].includes(d.estado.toLowerCase());
      if (isInactive) return false;
      const matchesStatus = deliveryFilter === "All" ? true : d.status === deliveryFilter;
      const matchesOrigen = pedidosOrigenFilter === "All" || d.creador?.tipo_origen === pedidosOrigenFilter;
      const s = pedidosSearch.toLowerCase().trim();
      const matchesSearch = !s ||
        (d.customer && d.customer.toLowerCase().includes(s)) ||
        (d.address && d.address.toLowerCase().includes(s)) ||
        (d.items && d.items.toLowerCase().includes(s)) ||
        (d.notas && d.notas.toLowerCase().includes(s)) ||
        (d.creador?.nombre && d.creador.nombre.toLowerCase().includes(s)) ||
        (d.creador?.etiqueta_origen && d.creador.etiqueta_origen.toLowerCase().includes(s));
      return matchesStatus && matchesOrigen && matchesSearch;
    });
  }, [deliveries, deliveryFilter, pedidosOrigenFilter, pedidosSearch]);

  const groupedDeliveriesByClient = useMemo(() => {
    const groups: {
      clientKey: string;
      customer: string;
      address: string;
      telefono?: string;
      idcliente?: number;
      orders: Delivery[];
      totalAmount: number;
    }[] = [];

    const map = new Map<string, typeof groups[0]>();

    filteredDeliveries.forEach(d => {
      const key = d.customer || "Consumidor Final";
      if (!map.has(key)) {
        const groupObj = {
          clientKey: key,
          customer: d.customer,
          address: d.address || "Sin dirección",
          telefono: d.telefono || "",
          idcliente: d.idcliente,
          orders: [],
          totalAmount: 0,
        };
        map.set(key, groupObj);
        groups.push(groupObj);
      }
      const g = map.get(key)!;
      g.orders.push(d);
      const val = d.total_raw || parseFloat(String(d.total).replace(/[^0-9.-]+/g, "")) || 0;
      g.totalAmount += val;
    });

    return groups;
  }, [filteredDeliveries]);

  const fetchEntregados = useCallback(async (authToken?: string) => {
    const tk = authToken || token;
    if (!tk) return;
    setLoadingEntregados(true);
    try {
      const res = await fetch(`${API_URL}/pedidos?filtro_estado=entregados`, {
        headers: { Authorization: `Bearer ${tk}` }
      });
      if (res.ok) {
        setEntregados(await res.json());
      }
    } catch (e) {
      console.error("Error al cargar entregados", e);
    } finally {
      setLoadingEntregados(false);
    }
  }, [token]);

  const filteredEntregados = useMemo(() => {
    return entregados.filter(d => {
      const isInactive = d.estado && ['inactivo', 'cancelado', 'anulado', 'eliminado'].includes(d.estado.toLowerCase());
      if (isInactive) return false;
      const matchesOrigen = pedidosOrigenFilter === "All" || d.creador?.tipo_origen === pedidosOrigenFilter;
      const s = pedidosSearch.toLowerCase().trim();
      const matchesSearch = !s ||
        (d.customer && d.customer.toLowerCase().includes(s)) ||
        (d.address && d.address.toLowerCase().includes(s)) ||
        (d.items && d.items.toLowerCase().includes(s)) ||
        (d.notas && d.notas.toLowerCase().includes(s)) ||
        (d.creador?.nombre && d.creador.nombre.toLowerCase().includes(s)) ||
        (d.creador?.etiqueta_origen && d.creador.etiqueta_origen.toLowerCase().includes(s));
      return matchesOrigen && matchesSearch;
    });
  }, [entregados, pedidosOrigenFilter, pedidosSearch]);

  const groupedEntregadosByClient = useMemo(() => {
    const groups: {
      clientKey: string;
      customer: string;
      address: string;
      telefono?: string;
      idcliente?: number;
      orders: Delivery[];
      totalAmount: number;
    }[] = [];

    const map = new Map<string, typeof groups[0]>();

    filteredEntregados.forEach(d => {
      const key = d.customer || "Consumidor Final";
      if (!map.has(key)) {
        const groupObj = {
          clientKey: key,
          customer: d.customer,
          address: d.address || "Sin dirección",
          telefono: d.telefono || "",
          idcliente: d.idcliente,
          orders: [],
          totalAmount: 0,
        };
        map.set(key, groupObj);
        groups.push(groupObj);
      }
      const g = map.get(key)!;
      g.orders.push(d);
      const val = d.total_raw || parseFloat(String(d.total).replace(/[^0-9.-]+/g, "")) || 0;
      g.totalAmount += val;
    });

    return groups;
  }, [filteredEntregados]);

  const NavButton = ({ icon: Icon, label, value, prominent, badge }: any) => (
    <button onClick={() => setActiveTab(value)}
      className={`flex flex-col items-center justify-center gap-1 transition-all duration-300 relative ${activeTab === value ? "text-brand-red" : "text-zinc-400"}`}>
      <div className={`flex items-center justify-center rounded-2xl transition-all duration-300 relative ${
        prominent
          ? activeTab === value ? "bg-brand-red text-white shadow-lg shadow-brand-red/40 scale-110 w-16 h-16 -mt-8" : "bg-zinc-800 text-zinc-300 w-16 h-16 -mt-8"
          : activeTab === value ? "bg-brand-red/15 w-12 h-12" : "w-12 h-12"
      }`}>
        <Icon className={prominent ? "w-7 h-7" : "w-5 h-5"} />
        {badge > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center font-bold">{badge}</span>}
      </div>
      <span className="text-xs font-medium">{label}</span>
    </button>
  );

  const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
      Today: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      Late:  "bg-red-500/20 text-red-300 border-red-500/30",
      Pending: "bg-brand-red/20 text-brand-yellow border-brand-red/30",
      Delivered: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    };
    const labels: Record<string, string> = { Today: "Hoy", Late: "Atrasado", Pending: "Pendiente", Delivered: "Entregado" };
    return <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${styles[status] || styles.Pending}`}>{labels[status] || status}</div>;
  };

  const CreadorBadge = ({ creador }: { creador?: Delivery['creador'] }) => {
    if (!creador) return null;
    const origen = creador.tipo_origen;
    
    if (origen === 'mayorista') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0" title={`Cargado por: ${creador.nombre} (${creador.rol})`}>
          🛒 {creador.nombre} · Mayorista
        </span>
      );
    }
    if (origen === 'pos_local') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shrink-0" title={`Cargado por: ${creador.nombre} (${creador.rol})`}>
          🏪 {creador.nombre} · POS Panadería
        </span>
      );
    }
    if (origen === 'preventista') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0" title={`Cargado por: ${creador.nombre} (${creador.rol})`}>
          🛵 {creador.nombre} · Preventista
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0" title={`Cargado por: ${creador.nombre} (${creador.rol})`}>
        ⚡ {creador.nombre} · Admin
      </span>
    );
  };

  // ── LOGIN ──
  if (!token || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-orange-950 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="flex justify-center mb-6">
            <img src="/logo.svg" alt="Role Logo" className="h-20 drop-shadow-lg" />
          </div>
          <h1 className="text-2xl font-bold text-center mb-8">Role · Repartos</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input name="email" type="email" placeholder="Email" required
              className="w-full h-12 rounded-xl bg-black/20 border border-white/10 px-4 focus:border-brand-red outline-none" />
            <input name="password" type="password" placeholder="Contraseña" required
              className="w-full h-12 rounded-xl bg-black/20 border border-white/10 px-4 focus:border-brand-red outline-none" />
            <button disabled={loading} className="w-full bg-brand-red text-white h-12 rounded-xl font-bold shadow-lg shadow-brand-red/20 active:scale-95 transition-all">
              {loading ? "Cargando..." : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── APP ──
  return (
    <div className="h-screen w-full bg-gradient-to-br from-zinc-950 via-zinc-900 to-orange-950 text-white overflow-hidden">
      <div className="flex h-full w-full flex-col md:flex-row relative transition-all duration-300">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,146,60,0.18),transparent_40%)]" />

        {/* Sidebar Desktop */}
        <div className="hidden md:flex w-64 flex-col border-r border-white/10 bg-black/40 backdrop-blur-3xl z-30 h-full shrink-0">
          <div className="p-6 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-brand-red/20 rounded-full flex items-center justify-center border border-brand-red/30">
                <UserIcon className="h-5 w-5 text-brand-yellow" />
              </div>
              <div>
                <p className="text-sm font-bold leading-tight">{user.name}</p>
                <p className="text-xs text-zinc-500">{user.roles?.[0]}</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {isClienteMayorista ? (
              <>
                <button onClick={() => setActiveTab('cargar_pedido')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'cargar_pedido' ? 'bg-brand-red/20 text-brand-yellow font-bold' : 'hover:bg-white/5 text-zinc-400 font-semibold'} text-sm`}>
                  <ShoppingCart className="w-5 h-5"/> <span>Cargar Pedido</span>
                </button>
                <button onClick={() => setActiveTab('pedidos')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'pedidos' ? 'bg-brand-red/20 text-brand-yellow font-bold' : 'hover:bg-white/5 text-zinc-400 font-semibold'} text-sm`}>
                  <Truck className="w-5 h-5"/> <span>Mis Pedidos</span>
                  {deliveries.length > 0 && <span className="ml-auto bg-brand-red text-white text-xs px-2 py-0.5 rounded-full font-bold">{deliveries.length}</span>}
                </button>
                <button onClick={() => setActiveTab('cuenta')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'cuenta' ? 'bg-brand-red/20 text-brand-yellow font-bold' : 'hover:bg-white/5 text-zinc-400 font-semibold'} text-sm`}>
                  <Receipt className="w-5 h-5"/> <span>Estado de Cuenta</span>
                </button>
              </>
            ) : (
              <>
                {!isProduccion && (
                  <>
                    <button onClick={() => setActiveTab('pedidos')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'pedidos' ? 'bg-brand-red/20 text-brand-yellow' : 'hover:bg-white/5 text-zinc-400'}`}>
                      <Truck className="w-5 h-5"/> <span className="font-semibold text-sm">Pedidos</span>
                      {deliveries.filter(d => d.status === "Late").length > 0 && <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{deliveries.filter(d => d.status === "Late").length}</span>}
                    </button>
                    {!isVendedor && (
                      <button onClick={() => setActiveTab('stock')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'stock' ? 'bg-brand-red/20 text-brand-yellow' : 'hover:bg-white/5 text-zinc-400'}`}><Package className="w-5 h-5"/> <span className="font-semibold text-sm">Stock</span></button>
                    )}
                    <button onClick={() => setActiveTab('pos')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'pos' ? 'bg-brand-red/20 text-brand-yellow' : 'hover:bg-white/5 text-zinc-400'}`}><ShoppingCart className="w-5 h-5"/> <span className="font-semibold text-sm">Venta Rápida</span></button>
                    {!isVendedor && (
                      <button onClick={() => { setActiveTab('clientes'); fetchProveedores(); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'clientes' ? 'bg-brand-red/20 text-brand-yellow' : 'hover:bg-white/5 text-zinc-400'}`}><Users className="w-5 h-5"/> <span className="font-semibold text-sm">Personas</span></button>
                    )}
                    <button onClick={() => setActiveTab('ventas')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'ventas' ? 'bg-brand-red/20 text-brand-yellow' : 'hover:bg-white/5 text-zinc-400'}`}><Receipt className="w-5 h-5"/> <span className="font-semibold text-sm">Historial</span></button>
                  </>
                )}
                
                {(isAdmin || isProduccion) && (
                  <button onClick={() => { setActiveTab('deposito'); fetchDeposito(); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'deposito' ? 'bg-brand-red/20 text-brand-yellow' : 'hover:bg-white/5 text-zinc-400'}`}>
                    <Warehouse className="w-5 h-5"/> <span className="font-semibold text-sm">Depósito</span>
                    {depositoReservasPendientes.length > 0 && <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{depositoReservasPendientes.length}</span>}
                  </button>
                )}
                {isAdmin && (
                  <button onClick={() => { setActiveTab('materias'); fetchMateriaPrimas(mpPage, mpSearch); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'materias' ? 'bg-brand-red/20 text-brand-yellow' : 'hover:bg-white/5 text-zinc-400'}`}>
                    <ClipboardList className="w-5 h-5"/> <span className="font-semibold text-sm">Materias Primas</span>
                  </button>
                )}
                {isAdmin && (
                  <button onClick={() => setActiveTab('compras')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'compras' ? 'bg-brand-red/20 text-brand-yellow' : 'hover:bg-white/5 text-zinc-400'}`}>
                    <ShoppingCart className="w-5 h-5"/> <span className="font-semibold text-sm">Compras</span>
                  </button>
                )}
                {(isAdmin || isProduccion) && (
                  <button onClick={() => { setActiveTab('recetas'); fetchRecetas(recetaSearch); fetchMateriaPrimas(1, ''); fetchDeposito(); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'recetas' ? 'bg-brand-red/20 text-brand-yellow' : 'hover:bg-white/5 text-zinc-400'}`}>
                    <CheckCircle2 className="w-5 h-5"/> <span className="font-semibold text-sm">Recetas</span>
                  </button>
                )}
                {isAdmin && (
                  <button onClick={() => { setActiveTab('despacho'); fetchDeposito(); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'despacho' ? 'bg-brand-red/20 text-brand-yellow' : 'hover:bg-white/5 text-zinc-400'}`}>
                    <Truck className="w-5 h-5"/> <span className="font-semibold text-sm">Despacho</span>
                  </button>
                )}
                {isAdmin && (
                  <button onClick={() => setActiveTab('usuarios')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'usuarios' ? 'bg-brand-red/20 text-brand-yellow' : 'hover:bg-white/5 text-zinc-400'}`}>
                    <UserIcon className="w-5 h-5"/> <span className="font-semibold text-sm">Usuarios</span>
                  </button>
                )}
              </>
            )}
          </nav>
          <div className="p-4 border-t border-white/10">
            <button onClick={logout} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all font-semibold text-sm"><LogOut className="w-4 h-4" /> Cerrar Sesión</button>
          </div>
        </div>

        <div className="flex-1 flex flex-col relative w-full min-w-0 h-full">
        {/* Header Mobile */}
        <div className="md:hidden flex items-center justify-between px-4 pt-5 pb-2 relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-brand-red/20 rounded-full flex items-center justify-center border border-brand-red/30">
              <UserIcon className="h-4 w-4 text-brand-yellow" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">{user.name}</p>
              <p className="text-xs text-zinc-500">{isClienteMayorista ? "Cliente Mayorista" : `Van #${user.vehiculo} · ${user.roles[0]}`}</p>
            </div>
          </div>
          <button onClick={logout} className="p-2 bg-white/5 rounded-full border border-white/10">
            <LogOut className="h-4 w-4 text-red-400" />
          </button>
        </div>

        <main className="flex-1 overflow-y-auto px-4 pb-40 pt-3 relative z-10">

          {/* ── CLIENTE MAYORISTA: CARGAR PEDIDO ── */}
          {isClienteMayorista && activeTab === "cargar_pedido" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold flex items-center gap-2">
                    <ShoppingCart className="w-6 h-6 text-brand-red" /> Realizar Pedido
                  </h1>
                  <p className="text-xs text-zinc-400 mt-1">
                    Selecciona los productos y cantidades deseadas para tu entrega.
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 shrink-0 self-start sm:self-auto">
                  <UserIcon className="h-4 w-4 text-brand-yellow" />
                  <span className="text-xs font-semibold text-brand-yellow">{user.name}</span>
                </div>
              </div>

              {/* Parámetros del Pedido: Fecha y Notas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-3xl border border-white/10 bg-black/40 backdrop-blur-md">
                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                    Fecha deseada de Entrega
                  </label>
                  <input
                    type="date"
                    value={mayoristaFechaEntrega}
                    onChange={e => setMayoristaFechaEntrega(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:border-brand-red outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                    Notas o Aclaraciones (Opcional)
                  </label>
                  <input
                    type="text"
                    value={mayoristaNotas}
                    onChange={e => setMayoristaNotas(e.target.value)}
                    placeholder="Ej: Entregar por la mañana, timbre 2, etc..."
                    className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:border-brand-red outline-none placeholder:text-zinc-500"
                  />
                </div>
              </div>

              {/* Buscador de Productos */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  value={mayoristaSearchProd}
                  onChange={e => setMayoristaSearchProd(e.target.value)}
                  placeholder="Buscar producto en el catálogo..."
                  className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 pl-11 pr-4 text-sm outline-none placeholder:text-zinc-500 focus:border-brand-red text-white"
                />
                {mayoristaSearchProd && (
                  <button onClick={() => setMayoristaSearchProd("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-white">
                    Limpiar
                  </button>
                )}
              </div>

              {/* Catálogo de Productos */}
              {loading ? (
                <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-16 rounded-2xl bg-white/5 animate-pulse" />)}</div>
              ) : products.filter(p => p.name.toLowerCase().includes(mayoristaSearchProd.toLowerCase())).length === 0 ? (
                <div className="text-center py-12 border border-dashed border-white/10 rounded-3xl p-6">
                  <Package className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                  <p className="text-zinc-400 text-sm">No se encontraron productos disponibles.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {products
                    .filter(p => p.name.toLowerCase().includes(mayoristaSearchProd.toLowerCase()))
                    .map(product => {
                      const qty = cart[product.id] || 0;
                      return (
                        <div
                          key={product.id}
                          className={`flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all ${
                            qty > 0 ? "border-brand-red/60 bg-brand-red/10 shadow-lg shadow-brand-red/10" : "border-white/10 bg-white/5 hover:border-white/20"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate text-white">{product.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-base font-bold text-brand-yellow">
                                ${product.price}
                              </span>
                              {(product as any).has_special_price && (
                                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold">
                                  Precio Especial
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 bg-black/40 p-1 rounded-xl border border-white/10">
                            <button
                              onClick={() => updateQuantity(product, -1)}
                              className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/5 text-zinc-300 hover:bg-white/10 active:scale-95 disabled:opacity-30"
                              disabled={qty === 0}
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <input
                              type="number"
                              min={0}
                              value={qty === 0 ? "" : qty}
                              placeholder="0"
                              onChange={e => handleSetQuantity(product, e.target.value)}
                              className="w-14 h-8 text-center text-sm font-bold bg-transparent text-white outline-none"
                            />
                            <button
                              onClick={() => updateQuantity(product, 1)}
                              className="h-8 w-8 flex items-center justify-center rounded-lg bg-brand-red text-white hover:bg-brand-red/90 shadow-md shadow-brand-red/20 active:scale-95"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* ── CLIENTE MAYORISTA: ESTADO DE CUENTA ── */}
          {isClienteMayorista && activeTab === "cuenta" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Receipt className="w-6 h-6 text-brand-red" /> Estado de Cuenta
                  </h1>
                  <p className="text-xs text-zinc-400 mt-1">
                    Consulta tu saldo actual, comprobantes y detalle de compras.
                  </p>
                </div>
                <button
                  onClick={handleDownloadPdfMayorista}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500/10 border border-blue-500/30 text-blue-300 hover:bg-blue-500/20 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-lg shadow-blue-500/10 self-start sm:self-auto cursor-pointer"
                >
                  <Download className="w-4 h-4" /> Descargar Resumen PDF
                </button>
              </div>

              {/* Tarjeta de Saldo Principal */}
              <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-900 to-black p-6 shadow-2xl relative overflow-hidden">
                <div className="pointer-events-none absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-brand-red/10 blur-3xl" />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                      Saldo Total Pendiente
                    </span>
                    <h2 className={`text-4xl font-extrabold mt-1 ${
                      (user?.persona?.balance || 0) > 0 ? "text-red-400" : "text-emerald-400"
                    }`}>
                      ${Number(user?.persona?.balance || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </h2>
                    <p className="text-xs text-zinc-500 mt-1">
                      {(user?.persona?.balance || 0) > 0 
                        ? "Monto pendiente de cobro en cuenta corriente" 
                        : "¡Tu cuenta se encuentra al día!"}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-left">
                    <p className="text-xs text-zinc-400">Cliente</p>
                    <p className="text-sm font-bold text-white">{user?.persona?.name || user.name}</p>
                    {user?.persona?.address && (
                      <p className="text-xs text-zinc-400 mt-0.5">{user.persona.address}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Historial de Compras / Facturas */}
              <div className="space-y-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-brand-yellow" /> Últimos Movimientos
                </h3>

                {loadingMayoristaCuenta ? (
                  <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse" />)}</div>
                ) : mayoristaVentas.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-white/10 rounded-3xl p-6">
                    <Receipt className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                    <p className="text-zinc-400 text-sm">No se registran compras recientes con saldo.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {mayoristaVentas.map(v => (
                      <div
                        key={v.id}
                        className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-white/20 transition-all"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">Comprobante #{v.id}</span>
                            <span className="text-xs text-zinc-400">· {v.fecha}</span>
                            {v.saldo === 0 ? (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                                Saldado
                              </span>
                            ) : (
                              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                                Saldo: ${v.saldo}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{v.items}</p>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                          <div className="text-right">
                            <p className="text-[10px] uppercase font-bold text-zinc-500">Total</p>
                            <p className="text-sm font-bold text-white">${v.total}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] uppercase font-bold text-zinc-500">Pagado</p>
                            <p className="text-sm font-bold text-emerald-400">${v.pago}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] uppercase font-bold text-zinc-500">Pendiente</p>
                            <p className={`text-sm font-bold ${v.saldo > 0 ? "text-red-400" : "text-zinc-500"}`}>
                              ${v.saldo}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── POS ── */}
          {!isClienteMayorista && activeTab === "pos" && (
            isVendedor || (isAdmin && adminPosMode === "mostrador") ? (
              <PosMostrador
                token={token!}
                user={user}
                products={products}
                clients={clients}
                apiUrl={API_URL}
                isAdmin={isAdmin}
                posMode={adminPosMode}
                onTogglePosMode={setAdminPosMode}
                onVentaExitosa={() => fetchAllData(token!, false)}
              />
            ) : (
              <div className="space-y-4">
                {isAdmin && (
                  <div className="flex items-center justify-end">
                    <div className="flex items-center bg-zinc-900 border border-white/10 p-1 rounded-xl text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setAdminPosMode("mostrador")}
                        className={`px-3 py-1.5 rounded-lg transition-all ${
                          adminPosMode === "mostrador"
                            ? "bg-brand-red text-white shadow-sm"
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        Mostrador (Local)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdminPosMode("reparto")}
                        className={`px-3 py-1.5 rounded-lg transition-all ${
                          adminPosMode === "reparto"
                            ? "bg-brand-yellow text-zinc-950 font-bold shadow-sm"
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        Móviles (Reparto)
                      </button>
                    </div>
                  </div>
                )}
                {editingPedido && (
                <div className="rounded-2xl border border-brand-red/30 bg-brand-red/10 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-brand-yellow shrink-0" />
                    <div>
                      <p className="text-xs text-brand-yellow font-bold uppercase tracking-wider">Modo Edición</p>
                      <p className="text-sm font-semibold text-white">Pedido #{editingPedido.id}</p>
                      <p className="text-xs text-zinc-400">{editingPedido.cliente?.name ?? 'Consumidor Final'}</p>
                    </div>
                  </div>
                  <button onClick={() => { setCart({}); setEditingPedido(null); }}
                    className="bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold px-3 py-2 rounded-xl text-zinc-300 transition-all active:scale-95">
                    Cancelar
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Venta Rápida</h1>
                <div className="flex items-center gap-3">
                  {isReordering ? (
                    <button onClick={handleSaveOrder} disabled={savingOrder} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-500 text-white shadow-lg disabled:opacity-50">
                      {savingOrder ? "Guardando..." : "Guardar Orden"}
                    </button>
                  ) : (
                    <button onClick={() => setIsReordering(true)} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors">
                      <LogOut className="h-3 w-3 rotate-90" /> Ordenar
                    </button>
                  )}
                  <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                    <CircleDollarSign className="h-4 w-4 text-brand-yellow" />
                    <span className="text-sm font-semibold text-brand-yellow">Reparto</span>
                  </div>
                </div>
              </div>
              {/* Buscador de productos en POS */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  value={posSearch}
                  onChange={e => setPosSearch(e.target.value)}
                  placeholder="Buscar producto..."
                  className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 pl-11 pr-4 text-sm outline-none placeholder:text-zinc-500 focus:border-brand-red text-white"
                />
                {posSearch && (
                  <button onClick={() => setPosSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-white">
                    Limpiar
                  </button>
                )}
              </div>

              {loading ? (
                <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-14 rounded-2xl bg-white/5 animate-pulse" />)}</div>
              ) : displayedProducts.length === 0 ? (
                <p className="text-center text-zinc-500 text-sm mt-10">No se encontraron productos.</p>
              ) : (
                <>
                  {isReordering ? (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={displayedProducts.map(p => p.id)} strategy={rectSortingStrategy}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {displayedProducts.map(product => {
                            const disabled = product.quantity === 0;
                            const qty = cart[product.id] || 0;
                            return (
                              <SortableProductItem
                                key={product.id}
                                product={product}
                                disabled={disabled}
                                qty={qty}
                                onUpdateQuantity={updateQuantity}
                                onSetQuantity={handleSetQuantity}
                                isReordering={isReordering}
                              />
                            );
                          })}
                        </div>
                      </SortableContext>
                    </DndContext>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {displayedProducts.map(product => {
                        const disabled = product.quantity === 0;
                        const qty = cart[product.id] || 0;
                        return (
                          <div key={product.id}
                            className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-all ${
                              disabled ? "border-zinc-800 bg-zinc-900/40 opacity-40" :
                              qty > 0 ? "border-brand-red/40 bg-brand-red/5" : "border-white/10 bg-white/5"
                            }`}>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate">{product.name}</p>
                              <p className="text-xs text-zinc-400">${product.price} · {product.quantity} disp.</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button disabled={disabled} onClick={() => updateQuantity(product, -1)}
                                className="h-8 w-8 flex items-center justify-center rounded-lg border border-white/10 bg-zinc-900/60 active:scale-95 disabled:opacity-40">
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <input
                                type="number"
                                step="any"
                                min={0}
                                max={product.quantity}
                                value={qty === 0 ? "" : qty}
                                onChange={e => handleSetQuantity(product, e.target.value)}
                                onBlur={() => {
                                  if (qty === 0) setCart(prev => ({ ...prev, [product.id]: 0 }));
                                }}
                                onWheel={e => (e.target as HTMLElement).blur()}
                                className="w-12 h-8 text-center text-sm font-bold bg-white/5 border border-white/10 rounded-lg outline-none focus:border-brand-red focus:bg-brand-red/10 text-white"
                                style={{ appearance: "textfield", WebkitAppearance: "none", MozAppearance: "textfield" }}
                              />
                              <button disabled={disabled} onClick={() => updateQuantity(product, 1)}
                                className="h-8 w-8 flex items-center justify-center rounded-lg bg-brand-red text-white shadow-sm shadow-brand-red/30 active:scale-95 disabled:opacity-40">
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        )}

          {/* ── PEDIDOS ── */}
          {activeTab === "pedidos" && (
            <div className="space-y-4">
              {/* Header con Título, Botón de Totales y Selector de Vista */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Truck className="w-6 h-6 text-brand-red" /> {isClienteMayorista ? "Mis Pedidos" : "Gestión de Pedidos"}
                  </h1>
                  <p className="text-xs text-zinc-400 mt-1">
                    {isClienteMayorista 
                      ? "Consulta el estado y descarga los comprobantes de tus pedidos." 
                      : "Control de entregas y cobranzas agrupado por cliente o lista."}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {isAdmin && pedidosSubTab === 'pendientes' && (
                    <button onClick={() => setTotalsModalOpen(true)}
                      className="inline-flex items-center justify-center px-4 py-2.5 bg-brand-red/20 text-brand-yellow border border-brand-red/30 rounded-xl font-semibold text-xs hover:bg-brand-red/30 transition-all active:scale-95 shadow-md shadow-brand-red/10">
                      <Package className="w-4 h-4 mr-2" />
                      Totales por Producto
                    </button>
                  )}

                  {!isClienteMayorista && (
                    <div className="flex items-center rounded-xl bg-black/40 border border-white/10 p-1">
                      <button
                        onClick={() => setPedidosViewMode('clientes')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          pedidosViewMode === 'clientes'
                            ? "bg-brand-red text-white shadow-md shadow-brand-red/20"
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        <Users className="w-3.5 h-3.5" /> Clientes
                      </button>
                      <button
                        onClick={() => setPedidosViewMode('lista')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          pedidosViewMode === 'lista'
                            ? "bg-brand-red text-white shadow-md shadow-brand-red/20"
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        <ClipboardList className="w-3.5 h-3.5" /> Lista
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Sub-tabs: Pendientes vs Entregados */}
              <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/10 w-full sm:w-fit self-start gap-1">
                <button
                  onClick={() => setPedidosSubTab('pendientes')}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    pedidosSubTab === 'pendientes'
                      ? 'bg-brand-red text-white shadow-lg shadow-brand-red/30'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>Pendientes</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                    pedidosSubTab === 'pendientes' ? 'bg-white/20 text-white' : 'bg-white/10 text-zinc-400'
                  }`}>
                    {deliveries.length}
                  </span>
                </button>
                
                <button
                  onClick={() => {
                    setPedidosSubTab('entregados');
                    if (entregados.length === 0) fetchEntregados();
                  }}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    pedidosSubTab === 'entregados'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Entregados</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                    pedidosSubTab === 'entregados' ? 'bg-white/20 text-white' : 'bg-white/10 text-zinc-400'
                  }`}>
                    {entregados.length}
                  </span>
                </button>
              </div>

              {/* ── SUB-TAB: PENDIENTES ── */}
              {pedidosSubTab === 'pendientes' && (
                <>
                  {/* Barra de Filtros y Búsqueda */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="relative md:col-span-7">
                      <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                      <input
                        value={pedidosSearch}
                        onChange={e => setPedidosSearch(e.target.value)}
                        placeholder="Buscar por cliente, dirección o productos..."
                        className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 pl-11 pr-4 text-sm outline-none placeholder:text-zinc-500 focus:border-brand-red text-white"
                      />
                      {pedidosSearch && (
                        <button onClick={() => setPedidosSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-white">
                          Limpiar
                        </button>
                      )}
                    </div>

                    <div className="flex gap-2 md:col-span-5 overflow-x-auto pb-1 md:pb-0">
                      {[
                        { id: "Today", label: "Hoy", count: deliveries.filter(d => d.status === "Today").length },
                        { id: "Late",  label: "Atrasados", count: deliveries.filter(d => d.status === "Late").length },
                        { id: "All",   label: "Todos", count: deliveries.length },
                      ].map(f => (
                        <button
                          key={f.id}
                          onClick={() => setDeliveryFilter(f.id)}
                          className={`flex-1 min-w-[90px] h-11 rounded-2xl px-3 text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                            deliveryFilter === f.id
                              ? "bg-brand-red text-white shadow-lg shadow-brand-red/20"
                              : "border border-white/10 bg-white/5 text-zinc-400 hover:text-white"
                          }`}
                        >
                          <span>{f.label}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                            deliveryFilter === f.id ? "bg-white/20 text-white" : "bg-white/5 text-zinc-500"
                          }`}>
                            {f.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Filtro por Canal de Origen / Creador */}
                  {!isClienteMayorista && (
                    <div className="flex gap-2 overflow-x-auto pb-1 text-xs">
                      <button
                        onClick={() => setPedidosOrigenFilter("All")}
                        className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 ${
                          pedidosOrigenFilter === "All"
                            ? "bg-white/20 text-white border border-white/30"
                            : "bg-white/5 text-zinc-400 hover:text-white border border-transparent"
                        }`}
                      >
                        Todos los Canales ({deliveries.length})
                      </button>
                      <button
                        onClick={() => setPedidosOrigenFilter("mayorista")}
                        className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 shrink-0 ${
                          pedidosOrigenFilter === "mayorista"
                            ? "bg-purple-500/30 text-purple-200 border border-purple-500/40"
                            : "bg-white/5 text-zinc-400 hover:text-white border border-transparent"
                        }`}
                      >
                        🛒 Mayoristas ({deliveries.filter(d => d.creador?.tipo_origen === 'mayorista').length})
                      </button>
                      <button
                        onClick={() => setPedidosOrigenFilter("preventista")}
                        className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 shrink-0 ${
                          pedidosOrigenFilter === "preventista"
                            ? "bg-emerald-500/30 text-emerald-200 border border-emerald-500/40"
                            : "bg-white/5 text-zinc-400 hover:text-white border border-transparent"
                        }`}
                      >
                        🛵 Preventistas ({deliveries.filter(d => d.creador?.tipo_origen === 'preventista').length})
                      </button>
                      <button
                        onClick={() => setPedidosOrigenFilter("pos_local")}
                        className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 shrink-0 ${
                          pedidosOrigenFilter === "pos_local"
                            ? "bg-cyan-500/30 text-cyan-200 border border-cyan-500/40"
                            : "bg-white/5 text-zinc-400 hover:text-white border border-transparent"
                        }`}
                      >
                        🏪 POS Panadería ({deliveries.filter(d => d.creador?.tipo_origen === 'pos_local').length})
                      </button>
                      <button
                        onClick={() => setPedidosOrigenFilter("admin")}
                        className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 shrink-0 ${
                          pedidosOrigenFilter === "admin"
                            ? "bg-amber-500/30 text-amber-200 border border-amber-500/40"
                            : "bg-white/5 text-zinc-400 hover:text-white border border-transparent"
                        }`}
                      >
                        ⚡ Admin ({deliveries.filter(d => d.creador?.tipo_origen === 'admin').length})
                      </button>
                    </div>
                  )}

                  {/* Métricas rápidas de pedidos pendientes */}
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-zinc-400 bg-black/20 border border-white/5 px-4 py-2.5 rounded-2xl">
                    <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                      <span>📦 <b>{filteredDeliveries.length}</b> {filteredDeliveries.length === 1 ? 'pedido pendiente' : 'pedidos pendientes'}</span>
                      {!isClienteMayorista && (
                        <span>👥 <b>{groupedDeliveriesByClient.length}</b> {groupedDeliveriesByClient.length === 1 ? 'cliente' : 'clientes'}</span>
                      )}
                      {!isClienteMayorista && pedidosViewMode === 'clientes' && groupedDeliveriesByClient.length > 0 && (
                        <div className="flex items-center gap-1.5 border-l border-white/10 pl-3">
                          <button
                            type="button"
                            onClick={() => collapseAllClients(groupedDeliveriesByClient.map(g => g.clientKey))}
                            className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                          >
                            Colapsar todos
                          </button>
                          <button
                            type="button"
                            onClick={() => expandAllClients(groupedDeliveriesByClient.map(g => g.clientKey))}
                            className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                          >
                            Expandir todos
                          </button>
                        </div>
                      )}
                    </div>
                    <span className="text-brand-yellow font-bold text-sm">
                      Total: ${filteredDeliveries.reduce((acc, d) => acc + (d.total_raw || parseFloat(String(d.total).replace(/[^0-9.-]+/g, "")) || 0), 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Vista Agrupada por Cliente (Acordeón) */}
                  {(!isClienteMayorista && pedidosViewMode === 'clientes') ? (
                    <div className="space-y-4">
                      {groupedDeliveriesByClient.map(group => {
                        const isCollapsed = !!collapsedClients[group.clientKey];
                        return (
                          <div key={group.clientKey} className="rounded-3xl border border-white/10 bg-white/5 overflow-hidden backdrop-blur-md transition-all shadow-xl hover:border-white/20">
                            {/* Cabecera del Cliente (Click para expandir / contraer) */}
                            <div
                              onClick={() => toggleClientCollapse(group.clientKey)}
                              className={`p-4 sm:p-5 bg-black/40 ${isCollapsed ? '' : 'border-b border-white/10'} flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none hover:bg-white/[0.04] transition-colors`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-11 w-11 rounded-2xl bg-brand-red/20 border border-brand-red/30 flex items-center justify-center shrink-0">
                                  <Users className="h-5 w-5 text-brand-yellow" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h2 className="text-base sm:text-lg font-bold text-white leading-tight">{group.customer}</h2>
                                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/10 text-zinc-300 border border-white/10">
                                      {group.orders.length} {group.orders.length === 1 ? 'pedido' : 'pedidos'}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 mt-1">
                                    {group.address && group.address !== 'Sin dirección' && (
                                      <span className="flex items-center gap-1 text-zinc-300">
                                        📍 {group.address}
                                      </span>
                                    )}
                                    {group.telefono && (
                                      <span className="flex items-center gap-1 text-zinc-400">
                                        📞 {group.telefono}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                                <div className="text-right">
                                  <p className="text-[10px] uppercase font-bold text-zinc-500">Total Cliente</p>
                                  <p className="text-lg font-extrabold text-brand-yellow">
                                    ${group.totalAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                  </p>
                                </div>
                                <div className={`p-2 rounded-xl bg-white/5 text-zinc-400 hover:text-white transition-all duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}>
                                  <ChevronDown className="h-4 w-4" />
                                </div>
                              </div>
                            </div>

                            {/* Pedidos del Cliente */}
                            {!isCollapsed && (
                              <div className="p-3 sm:p-4 space-y-3 bg-black/10">
                                {group.orders.map(delivery => (
                                  <div key={delivery.id} className="rounded-2xl border border-white/10 bg-zinc-900/60 p-3.5 sm:p-4 flex flex-col justify-between gap-3 hover:border-brand-red/40 transition-all">
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="text-sm font-bold text-white">Pedido #{delivery.id}</span>
                                          <StatusBadge status={delivery.status} />
                                          <CreadorBadge creador={delivery.creador} />
                                          {delivery.fecha_entrega && (
                                            <span className="text-[10px] font-bold tracking-wider text-brand-yellow bg-brand-red/10 px-2.5 py-0.5 rounded-full border border-brand-red/20">
                                              📅 ENTREGAR: {delivery.fecha_entrega.split('-').reverse().join('/')}
                                            </span>
                                          )}
                                        </div>
                                        {delivery.notas && (
                                          <p className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-xl mt-2 inline-block">
                                            💬 {delivery.notas}
                                          </p>
                                        )}
                                        <div className="mt-2 text-xs text-zinc-300 bg-black/30 rounded-xl px-3 py-2 border border-white/5 font-mono">
                                          {delivery.items}
                                        </div>
                                      </div>

                                      <div className="sm:text-right shrink-0">
                                        <p className="text-[10px] uppercase font-bold text-zinc-500">Total Pedido</p>
                                        <p className="text-base sm:text-lg font-bold text-white">{delivery.total}</p>
                                      </div>
                                    </div>

                                    {/* Botones de acción */}
                                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5">
                                      <div className="flex items-center gap-2">
                                        <button onClick={() => handleCancelarPedido(delivery)} disabled={loadingActionId === delivery.id}
                                          className="flex items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2 hover:bg-red-500/20 active:scale-95 text-red-400 disabled:opacity-50 text-xs font-semibold"
                                          title="Eliminar pedido">
                                          {loadingActionId === delivery.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                          <span className="hidden sm:inline ml-1.5">Eliminar</span>
                                        </button>

                                        <div className="relative group">
                                          <button disabled={loadingActionId === delivery.id}
                                            className="flex items-center gap-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 px-3 py-2 hover:bg-blue-500/20 active:scale-95 text-blue-400 disabled:opacity-50 text-xs font-semibold"
                                            title="Descargar remito">
                                            <Download className="h-3.5 w-3.5" />
                                            <span>Remito</span>
                                          </button>
                                          <div className="absolute bottom-full left-0 mb-2 hidden group-focus-within:flex flex-col bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-20 min-w-[160px]">
                                            <button
                                              onClick={async () => {
                                                try {
                                                  const res = await fetch(`${API_URL}/pedidos/${delivery.id}/comprobante?doble=false`, { headers: { Authorization: `Bearer ${token}` } });
                                                  if (res.ok) {
                                                    const blob = await res.blob();
                                                    const url = window.URL.createObjectURL(blob);
                                                    const a = document.createElement("a");
                                                    a.href = url; a.download = `Remito_${delivery.id}.pdf`;
                                                    document.body.appendChild(a); a.click(); a.remove();
                                                    window.URL.revokeObjectURL(url);
                                                  } else { alert("Error al descargar"); }
                                                } catch { alert("Error de conexión"); }
                                              }}
                                              className="px-4 py-2.5 text-xs text-left hover:bg-white/10 text-zinc-300 transition-colors">
                                              📄 Remito Simple
                                            </button>
                                            <button
                                              onClick={async () => {
                                                try {
                                                  const res = await fetch(`${API_URL}/pedidos/${delivery.id}/comprobante?doble=true`, { headers: { Authorization: `Bearer ${token}` } });
                                                  if (res.ok) {
                                                    const blob = await res.blob();
                                                    const url = window.URL.createObjectURL(blob);
                                                    const a = document.createElement("a");
                                                    a.href = url; a.download = `Remito_Doble_${delivery.id}.pdf`;
                                                    document.body.appendChild(a); a.click(); a.remove();
                                                    window.URL.revokeObjectURL(url);
                                                  } else { alert("Error al descargar"); }
                                                } catch { alert("Error de conexión"); }
                                              }}
                                              className="px-4 py-2.5 text-xs text-left hover:bg-white/10 text-zinc-300 border-t border-white/5 transition-colors">
                                              📄📄 Remito Doble
                                            </button>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 ml-auto">
                                        <button onClick={() => handleEditarPedido(delivery)} disabled={loadingActionId === delivery.id}
                                          className="flex items-center gap-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/10 active:scale-95 text-zinc-300 disabled:opacity-50">
                                          <Edit2 className="h-3.5 w-3.5" /> Editar
                                        </button>
                                        <button onClick={() => handleEntregarPedido(delivery)} disabled={loadingActionId === delivery.id}
                                          className="flex items-center gap-1 rounded-xl bg-brand-red px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-brand-red/20 active:scale-95 disabled:opacity-50">
                                          {loadingActionId === delivery.id ? (
                                            <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Cargando...</>
                                          ) : (
                                            <>Cobrar <ChevronRight className="h-3.5 w-3.5" /></>
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Vista Lista Tradicional (o vista cliente mayorista) */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredDeliveries.map(delivery => (
                        <div key={delivery.id} className="rounded-3xl border border-white/10 bg-white/5 p-4 flex flex-col justify-between hover:border-white/20 transition-all">
                          <div>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-base font-semibold">{delivery.customer}</h3>
                                  <CreadorBadge creador={delivery.creador} />
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <span className="text-xs font-bold text-zinc-300">#{delivery.id}</span>
                                  <p className="text-xs text-zinc-400">· {delivery.address}</p>
                                  {delivery.fecha_entrega && (
                                    <span className="text-[10px] font-semibold tracking-wider text-brand-yellow bg-brand-red/10 px-2 py-0.5 rounded-full border border-brand-red/20">
                                      ENTREGAR: {delivery.fecha_entrega.split('-').reverse().join('/')}
                                    </span>
                                  )}
                                </div>
                                {delivery.notas && (
                                  <p className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg mt-1.5 inline-block">
                                    💬 {delivery.notas}
                                  </p>
                                )}
                              </div>
                              <StatusBadge status={delivery.status} />
                            </div>
                            <div className="mt-2 rounded-xl bg-black/20 px-3 py-2 text-xs text-zinc-300">{delivery.items}</div>
                          </div>
                          <div className="mt-3 flex items-center justify-between">
                            <div>
                              <p className="text-xs text-zinc-500">Total</p>
                              <p className="text-lg font-bold">{delivery.total}</p>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handleCancelarPedido(delivery)} disabled={loadingActionId === delivery.id}
                                className="flex items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2.5 hover:bg-red-500/20 active:scale-95 text-red-400 disabled:opacity-50"
                                title="Eliminar pedido">
                                {loadingActionId === delivery.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              </button>
                              <div className="relative group">
                                <button disabled={loadingActionId === delivery.id}
                                  className="flex items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 px-3 py-2.5 hover:bg-blue-500/20 active:scale-95 text-blue-400 disabled:opacity-50"
                                  title="Descargar remito">
                                  <Download className="h-4 w-4" />
                                </button>
                                <div className="absolute bottom-full right-0 mb-2 hidden group-focus-within:flex flex-col bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-20 min-w-[160px]">
                                  <button
                                    onClick={async () => {
                                      try {
                                        const res = await fetch(`${API_URL}/pedidos/${delivery.id}/comprobante?doble=false`, { headers: { Authorization: `Bearer ${token}` } });
                                        if (res.ok) {
                                          const blob = await res.blob();
                                          const url = window.URL.createObjectURL(blob);
                                          const a = document.createElement("a");
                                          a.href = url; a.download = `Remito_${delivery.id}.pdf`;
                                          document.body.appendChild(a); a.click(); a.remove();
                                          window.URL.revokeObjectURL(url);
                                        } else { alert("Error al descargar"); }
                                      } catch { alert("Error de conexión"); }
                                    }}
                                    className="px-4 py-2.5 text-sm text-left hover:bg-white/10 text-zinc-300 transition-colors">
                                    📄 Remito Simple
                                  </button>
                                  <button
                                    onClick={async () => {
                                      try {
                                        const res = await fetch(`${API_URL}/pedidos/${delivery.id}/comprobante?doble=true`, { headers: { Authorization: `Bearer ${token}` } });
                                        if (res.ok) {
                                          const blob = await res.blob();
                                          const url = window.URL.createObjectURL(blob);
                                          const a = document.createElement("a");
                                          a.href = url; a.download = `Remito_Doble_${delivery.id}.pdf`;
                                          document.body.appendChild(a); a.click(); a.remove();
                                          window.URL.revokeObjectURL(url);
                                        } else { alert("Error al descargar"); }
                                      } catch { alert("Error de conexión"); }
                                    }}
                                    className="px-4 py-2.5 text-sm text-left hover:bg-white/10 text-zinc-300 border-t border-white/5 transition-colors">
                                    📄📄 Remito Doble
                                  </button>
                                </div>
                              </div>
                              {!isClienteMayorista && (
                                <>
                                  <button onClick={() => handleEditarPedido(delivery)} disabled={loadingActionId === delivery.id}
                                    className="flex items-center gap-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm font-semibold hover:bg-white/10 active:scale-95 text-zinc-300 disabled:opacity-50">
                                    Editar
                                  </button>
                                  <button onClick={() => handleEntregarPedido(delivery)} disabled={loadingActionId === delivery.id}
                                    className="flex items-center gap-1 rounded-xl bg-brand-red px-4 py-2.5 text-sm font-semibold shadow-lg shadow-brand-red/20 active:scale-95 disabled:opacity-50">
                                    {loadingActionId === delivery.id ? (
                                      <><RefreshCw className="h-4 w-4 animate-spin" /> Cargando...</>
                                    ) : (
                                      <>Cobrar <ChevronRight className="h-4 w-4" /></>
                                    )}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {filteredDeliveries.length === 0 && (
                    <div className="text-center py-12 border border-dashed border-white/10 rounded-3xl p-6">
                      <Truck className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                      <p className="text-zinc-400 text-sm">No se encontraron pedidos pendientes con los filtros aplicados.</p>
                    </div>
                  )}
                </>
              )}

              {/* ── SUB-TAB: ENTREGADOS ── */}
              {pedidosSubTab === 'entregados' && (
                <>
                  {/* Barra de Búsqueda */}
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input
                      value={pedidosSearch}
                      onChange={e => setPedidosSearch(e.target.value)}
                      placeholder="Buscar pedidos entregados por cliente, dirección o productos..."
                      className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 pl-11 pr-4 text-sm outline-none placeholder:text-zinc-500 focus:border-emerald-500 text-white"
                    />
                    {pedidosSearch && (
                      <button onClick={() => setPedidosSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-white">
                        Limpiar
                      </button>
                    )}
                  </div>

                  {/* Filtro por Canal de Origen / Creador */}
                  {!isClienteMayorista && (
                    <div className="flex gap-2 overflow-x-auto pb-1 text-xs">
                      <button
                        onClick={() => setPedidosOrigenFilter("All")}
                        className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 ${
                          pedidosOrigenFilter === "All"
                            ? "bg-white/20 text-white border border-white/30"
                            : "bg-white/5 text-zinc-400 hover:text-white border border-transparent"
                        }`}
                      >
                        Todos los Canales ({entregados.length})
                      </button>
                      <button
                        onClick={() => setPedidosOrigenFilter("mayorista")}
                        className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 shrink-0 ${
                          pedidosOrigenFilter === "mayorista"
                            ? "bg-purple-500/30 text-purple-200 border border-purple-500/40"
                            : "bg-white/5 text-zinc-400 hover:text-white border border-transparent"
                        }`}
                      >
                        🛒 Mayoristas ({entregados.filter(d => d.creador?.tipo_origen === 'mayorista').length})
                      </button>
                      <button
                        onClick={() => setPedidosOrigenFilter("preventista")}
                        className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 shrink-0 ${
                          pedidosOrigenFilter === "preventista"
                            ? "bg-emerald-500/30 text-emerald-200 border border-emerald-500/40"
                            : "bg-white/5 text-zinc-400 hover:text-white border border-transparent"
                        }`}
                      >
                        🛵 Preventistas ({entregados.filter(d => d.creador?.tipo_origen === 'preventista').length})
                      </button>
                      <button
                        onClick={() => setPedidosOrigenFilter("pos_local")}
                        className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 shrink-0 ${
                          pedidosOrigenFilter === "pos_local"
                            ? "bg-cyan-500/30 text-cyan-200 border border-cyan-500/40"
                            : "bg-white/5 text-zinc-400 hover:text-white border border-transparent"
                        }`}
                      >
                        🏪 POS Panadería ({entregados.filter(d => d.creador?.tipo_origen === 'pos_local').length})
                      </button>
                      <button
                        onClick={() => setPedidosOrigenFilter("admin")}
                        className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 shrink-0 ${
                          pedidosOrigenFilter === "admin"
                            ? "bg-amber-500/30 text-amber-200 border border-amber-500/40"
                            : "bg-white/5 text-zinc-400 hover:text-white border border-transparent"
                        }`}
                      >
                        ⚡ Admin ({entregados.filter(d => d.creador?.tipo_origen === 'admin').length})
                      </button>
                    </div>
                  )}

                  {/* Métricas rápidas de pedidos entregados */}
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-zinc-400 bg-emerald-950/20 border border-emerald-500/20 px-4 py-2.5 rounded-2xl">
                    <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                      <span className="text-emerald-300">✅ <b>{filteredEntregados.length}</b> {filteredEntregados.length === 1 ? 'pedido entregado' : 'pedidos entregados'}</span>
                      {!isClienteMayorista && (
                        <span>👥 <b>{groupedEntregadosByClient.length}</b> {groupedEntregadosByClient.length === 1 ? 'cliente' : 'clientes'}</span>
                      )}
                      {!isClienteMayorista && pedidosViewMode === 'clientes' && groupedEntregadosByClient.length > 0 && (
                        <div className="flex items-center gap-1.5 border-l border-emerald-500/20 pl-3">
                          <button
                            type="button"
                            onClick={() => collapseAllClients(groupedEntregadosByClient.map(g => g.clientKey))}
                            className="px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 transition-colors"
                          >
                            Colapsar todos
                          </button>
                          <button
                            type="button"
                            onClick={() => expandAllClients(groupedEntregadosByClient.map(g => g.clientKey))}
                            className="px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 transition-colors"
                          >
                            Expandir todos
                          </button>
                        </div>
                      )}
                    </div>
                    <span className="text-emerald-400 font-bold text-sm">
                      Total: ${filteredEntregados.reduce((acc, d) => acc + (d.total_raw || parseFloat(String(d.total).replace(/[^0-9.-]+/g, "")) || 0), 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {loadingEntregados && (
                    <div className="flex justify-center py-10">
                      <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
                    </div>
                  )}

                  {!loadingEntregados && (!isClienteMayorista && pedidosViewMode === 'clientes') ? (
                    <div className="space-y-4">
                      {groupedEntregadosByClient.map(group => {
                        const isCollapsed = !!collapsedClients[group.clientKey];
                        return (
                          <div key={group.clientKey} className="rounded-3xl border border-white/10 bg-white/5 overflow-hidden backdrop-blur-md transition-all shadow-xl hover:border-emerald-500/30">
                            {/* Cabecera del Cliente (Click para expandir / contraer) */}
                            <div
                              onClick={() => toggleClientCollapse(group.clientKey)}
                              className={`p-4 sm:p-5 bg-black/40 ${isCollapsed ? '' : 'border-b border-white/10'} flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none hover:bg-white/[0.04] transition-colors`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-11 w-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                                  <Users className="h-5 w-5 text-emerald-400" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h2 className="text-base sm:text-lg font-bold text-white leading-tight">{group.customer}</h2>
                                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                      {group.orders.length} {group.orders.length === 1 ? 'entregado' : 'entregados'}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 mt-1">
                                    {group.address && group.address !== 'Sin dirección' && (
                                      <span className="flex items-center gap-1 text-zinc-300">
                                        📍 {group.address}
                                      </span>
                                    )}
                                    {group.telefono && (
                                      <span className="flex items-center gap-1 text-zinc-400">
                                        📞 {group.telefono}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                                <div className="text-right">
                                  <p className="text-[10px] uppercase font-bold text-zinc-500">Total Histórico</p>
                                  <p className="text-lg font-extrabold text-emerald-400">
                                    ${group.totalAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                  </p>
                                </div>
                                <div className={`p-2 rounded-xl bg-white/5 text-emerald-400 transition-all duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}>
                                  <ChevronDown className="h-4 w-4" />
                                </div>
                              </div>
                            </div>

                            {/* Pedidos Entregados del Cliente */}
                            {!isCollapsed && (
                              <div className="p-3 sm:p-4 space-y-3 bg-black/10">
                                {group.orders.map(delivery => (
                                  <div key={delivery.id} className="rounded-2xl border border-white/10 bg-zinc-900/60 p-3.5 sm:p-4 flex flex-col justify-between gap-3 hover:border-emerald-500/40 transition-all">
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="text-sm font-bold text-white">Pedido #{delivery.id}</span>
                                          <StatusBadge status="Delivered" />
                                          <CreadorBadge creador={delivery.creador} />
                                          {delivery.fecha_entrega && (
                                            <span className="text-[10px] font-bold tracking-wider text-emerald-300 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                                              📅 ENTREGADO: {delivery.fecha_entrega.split('-').reverse().join('/')}
                                            </span>
                                          )}
                                        </div>
                                        {delivery.notas && (
                                          <p className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-xl mt-2 inline-block">
                                            💬 {delivery.notas}
                                          </p>
                                        )}
                                        <div className="mt-2 text-xs text-zinc-300 bg-black/30 rounded-xl px-3 py-2 border border-white/5 font-mono">
                                          {delivery.items}
                                        </div>
                                      </div>

                                      <div className="sm:text-right shrink-0">
                                        <p className="text-[10px] uppercase font-bold text-zinc-500">Total Pedido</p>
                                        <p className="text-base sm:text-lg font-bold text-white">{delivery.total}</p>
                                        <p className="text-[11px] text-zinc-400 mt-0.5">
                                          {delivery.forma_de_pago ? `Pago: ${delivery.forma_de_pago}` : ''}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Botones de acción (Remito Simple / Doble) */}
                                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5">
                                      <div className="flex items-center gap-2">
                                        <div className="relative group">
                                          <button
                                            className="flex items-center gap-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 px-3 py-2 hover:bg-blue-500/20 active:scale-95 text-blue-400 text-xs font-semibold"
                                            title="Descargar remito">
                                            <Download className="h-3.5 w-3.5" />
                                            <span>Descargar Remito</span>
                                          </button>
                                          <div className="absolute bottom-full left-0 mb-2 hidden group-focus-within:flex flex-col bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-20 min-w-[160px]">
                                            <button
                                              onClick={async () => {
                                                try {
                                                  const res = await fetch(`${API_URL}/pedidos/${delivery.id}/comprobante?doble=false`, { headers: { Authorization: `Bearer ${token}` } });
                                                  if (res.ok) {
                                                    const blob = await res.blob();
                                                    const url = window.URL.createObjectURL(blob);
                                                    const a = document.createElement("a");
                                                    a.href = url; a.download = `Remito_${delivery.id}.pdf`;
                                                    document.body.appendChild(a); a.click(); a.remove();
                                                    window.URL.revokeObjectURL(url);
                                                  } else { alert("Error al descargar"); }
                                                } catch { alert("Error de conexión"); }
                                              }}
                                              className="px-4 py-2.5 text-xs text-left hover:bg-white/10 text-zinc-300 transition-colors">
                                              📄 Remito Simple
                                            </button>
                                            <button
                                              onClick={async () => {
                                                try {
                                                  const res = await fetch(`${API_URL}/pedidos/${delivery.id}/comprobante?doble=true`, { headers: { Authorization: `Bearer ${token}` } });
                                                  if (res.ok) {
                                                    const blob = await res.blob();
                                                    const url = window.URL.createObjectURL(blob);
                                                    const a = document.createElement("a");
                                                    a.href = url; a.download = `Remito_Doble_${delivery.id}.pdf`;
                                                    document.body.appendChild(a); a.click(); a.remove();
                                                    window.URL.revokeObjectURL(url);
                                                  } else { alert("Error al descargar"); }
                                                } catch { alert("Error de conexión"); }
                                              }}
                                              className="px-4 py-2.5 text-xs text-left hover:bg-white/10 text-zinc-300 border-t border-white/5 transition-colors">
                                              📄📄 Remito Doble
                                            </button>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 ml-auto">
                                        <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold">
                                          <CheckCircle2 className="w-3.5 h-3.5" /> Entregado
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : !loadingEntregados ? (
                    /* Vista Lista Tradicional de Entregados */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredEntregados.map(delivery => (
                        <div key={delivery.id} className="rounded-3xl border border-white/10 bg-white/5 p-4 flex flex-col justify-between hover:border-emerald-500/30 transition-all">
                          <div>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-base font-semibold">{delivery.customer}</h3>
                                  <CreadorBadge creador={delivery.creador} />
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <span className="text-xs font-bold text-zinc-300">#{delivery.id}</span>
                                  <p className="text-xs text-zinc-400">· {delivery.address}</p>
                                  {delivery.fecha_entrega && (
                                    <span className="text-[10px] font-semibold tracking-wider text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                      ENTREGADO: {delivery.fecha_entrega.split('-').reverse().join('/')}
                                    </span>
                                  )}
                                </div>
                                {delivery.notas && (
                                  <p className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg mt-1.5 inline-block">
                                    💬 {delivery.notas}
                                  </p>
                                )}
                              </div>
                              <StatusBadge status="Delivered" />
                            </div>
                            <div className="mt-2 rounded-xl bg-black/20 px-3 py-2 text-xs text-zinc-300">{delivery.items}</div>
                          </div>
                          <div className="mt-3 flex items-center justify-between">
                            <div>
                              <p className="text-xs text-zinc-500">Total</p>
                              <p className="text-lg font-bold text-white">{delivery.total}</p>
                              {delivery.forma_de_pago && (
                                <p className="text-[10px] text-zinc-400">Pago: {delivery.forma_de_pago}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="relative group">
                                <button
                                  className="flex items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 px-3 py-2.5 hover:bg-blue-500/20 active:scale-95 text-blue-400"
                                  title="Descargar remito">
                                  <Download className="h-4 w-4" />
                                </button>
                                <div className="absolute bottom-full right-0 mb-2 hidden group-focus-within:flex flex-col bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-20 min-w-[160px]">
                                  <button
                                    onClick={async () => {
                                      try {
                                        const res = await fetch(`${API_URL}/pedidos/${delivery.id}/comprobante?doble=false`, { headers: { Authorization: `Bearer ${token}` } });
                                        if (res.ok) {
                                          const blob = await res.blob();
                                          const url = window.URL.createObjectURL(blob);
                                          const a = document.createElement("a");
                                          a.href = url; a.download = `Remito_${delivery.id}.pdf`;
                                          document.body.appendChild(a); a.click(); a.remove();
                                          window.URL.revokeObjectURL(url);
                                        } else { alert("Error al descargar"); }
                                      } catch { alert("Error de conexión"); }
                                    }}
                                    className="px-4 py-2.5 text-sm text-left hover:bg-white/10 text-zinc-300 transition-colors">
                                    📄 Remito Simple
                                  </button>
                                  <button
                                    onClick={async () => {
                                      try {
                                        const res = await fetch(`${API_URL}/pedidos/${delivery.id}/comprobante?doble=true`, { headers: { Authorization: `Bearer ${token}` } });
                                        if (res.ok) {
                                          const blob = await res.blob();
                                          const url = window.URL.createObjectURL(blob);
                                          const a = document.createElement("a");
                                          a.href = url; a.download = `Remito_Doble_${delivery.id}.pdf`;
                                          document.body.appendChild(a); a.click(); a.remove();
                                          window.URL.revokeObjectURL(url);
                                        } else { alert("Error al descargar"); }
                                      } catch { alert("Error de conexión"); }
                                    }}
                                    className="px-4 py-2.5 text-sm text-left hover:bg-white/10 text-zinc-300 border-t border-white/5 transition-colors">
                                    📄📄 Remito Doble
                                  </button>
                                </div>
                              </div>

                              <span className="inline-flex items-center gap-1 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Entregado
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {!loadingEntregados && filteredEntregados.length === 0 && (
                    <div className="text-center py-12 border border-dashed border-white/10 rounded-3xl p-6">
                      <CheckCircle2 className="w-10 h-10 text-emerald-600/50 mx-auto mb-2" />
                      <p className="text-zinc-400 text-sm">No se encontraron pedidos entregados con los filtros aplicados.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Totals Modal ── */}
          {totalsModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setTotalsModalOpen(false)} />
              <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl overflow-y-auto max-h-[80vh]">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold flex items-center gap-2"><Package className="w-5 h-5 text-brand-yellow" /> Totales por Producto</h2>
                  <button onClick={() => setTotalsModalOpen(false)} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  {(() => {
                    const totals: Record<string, { qty: number, id?: number }> = {};
                    filteredDeliveries.forEach(d => {
                      if (d.raw_items) {
                        d.raw_items.forEach(item => {
                          if (!totals[item.name]) totals[item.name] = { qty: 0, id: item.id };
                          totals[item.name].qty += item.qty;
                        });
                      }
                    });
                    const entries = Object.entries(totals).sort((a, b) => b[1].qty - a[1].qty);
                    
                    if (entries.length === 0) return <p className="text-center text-zinc-500 py-4 text-sm">No hay productos en los pedidos mostrados actualmente.</p>;
                    
                    return entries.map(([name, { qty, id }]) => {
                      const prod = products.find(p => p.id === id) || adminStock.find(p => p.id === id);
                      const totalRepartidores = prod?.stock_repartidores ? Object.values(prod.stock_repartidores).reduce((acc: number, r: any) => acc + Number(r.cantidad), 0) : 0;
                      const faltan = qty > totalRepartidores ? qty - totalRepartidores : 0;

                      return (
                        <div key={name} className="flex flex-col gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-semibold text-white">{name}</span>
                            <span className="text-sm font-bold text-brand-yellow bg-brand-red/10 px-3 py-1 rounded-lg border border-brand-red/20">{qty} uds</span>
                          </div>
                          <div className="flex items-center justify-between mt-1 pt-2 border-t border-white/5">
                            <div className="flex flex-col gap-0.5 text-[11px]">
                              <span className="text-zinc-400">En Repartidores: <b className="text-zinc-200">{totalRepartidores}</b></span>
                              {faltan > 0 && <span className="text-red-400 font-semibold">Ã¢Å¡  Ã¯ ¸  Faltan {faltan} uds en móviles</span>}
                            </div>
                            
                            {faltan > 0 && prod && (
                              <button onClick={() => {
                                setEditingProduct(prod);
                                setTotalsModalOpen(false);
                              }}
                              className="text-[10px] font-bold uppercase tracking-wider bg-red-500 hover:bg-red-600 text-white px-2.5 py-1.5 rounded-lg transition-colors active:scale-95">
                                Cargar Stock
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* ── STOCK ── */}
          {activeTab === "stock" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Mi Stock {isAdmin ? "(Admin)" : ""}</h1>
                {isAdmin && (
                  <button
                    onClick={() => setCategoriasModalOpen(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-zinc-200 transition-all hover:border-brand-red/50 shadow-sm"
                  >
                    <TagIcon className="w-4 h-4 text-brand-yellow" />
                    <span>Categorías</span>
                  </button>
                )}
              </div>
              {isAdmin ? (
                <>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input value={adminStockSearch} onChange={e => { setAdminStockSearch(e.target.value); setAdminStockPage(1); }} placeholder="Buscar por nombre o código..."
                      className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 pl-11 pr-4 text-sm outline-none placeholder:text-zinc-500 focus:border-brand-red" />
                  </div>
                  {loadingAdminStock && adminStockPage === 1 ? (
                    <p className="text-center text-zinc-500 py-10">Cargando...</p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {adminStock.map((item, index) => {
                        const isLast = index === adminStock.length - 1;
                        return (
                          <div ref={isLast ? lastStockElementRef : null} key={item.id}
                            className={`flex flex-row items-center gap-3 px-3 py-2.5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors ${item.disponible_reparto === 0 ? 'opacity-50' : ''}`}>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white leading-snug" style={{overflowWrap:'anywhere'}}>{item.name}</p>
                              <p className="text-xs text-zinc-400 font-medium mt-0.5">${item.price}</p>
                            </div>
                            <div className="hidden sm:flex items-center gap-1 shrink-0">
                              {([{label:'LOC',val:item.stock_local},{label:'REP',val:item.stock_repartidores ? Object.values(item.stock_repartidores).reduce((acc: number, r: any) => acc + Number(r.cantidad), 0) : 0}] as {label:string,val:number}[]).map(s => (
                                <div key={s.label} className="flex flex-col items-center justify-center bg-black/40 rounded-lg w-9 h-9">
                                  <span className="text-[9px] text-zinc-500 font-medium leading-none">{s.label}</span>
                                  <span className="text-xs font-bold text-white leading-none mt-0.5">{s.val}</span>
                                </div>
                              ))}
                            </div>
                            <button onClick={() => setEditingProduct(item)} className="shrink-0 p-2 rounded-lg bg-white/5 hover:bg-brand-red/20 hover:text-brand-yellow text-zinc-400 transition-all active:scale-95">
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                      {loadingAdminStock && adminStockPage > 1 && (
                        <div className="flex justify-center items-center py-4">
                          <RefreshCw className="w-5 h-5 text-brand-red animate-spin" />
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-6">
                  {misReservas.length > 0 && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
                      <h2 className="text-sm font-semibold text-red-400 mb-3">Tus Solicitudes Pendientes</h2>
                      <div className="space-y-2">
                        {misReservas.map(r => (
                          <div key={r.id} className="flex justify-between items-center bg-black/20 rounded-xl p-2 px-3">
                            <span className="text-sm font-medium text-white">{r.item_nombre}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold text-red-300">{r.cantidad}</span>
                              <button onClick={async () => {
                                if (!confirm("¿Cancelar solicitud?")) return;
                                try {
                                  const res = await fetch(`${API_URL}/deposito/reservas/${r.id}/cancelar`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
                                  if (res.ok) fetchAllData(token!, false);
                                } catch {}
                              }} className="text-[10px] px-2 py-1 bg-red-500/20 text-red-200 rounded-lg hover:bg-red-500/30 transition-colors uppercase tracking-wider">Cancelar</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {products.map(item => (
                      <div key={item.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold">{item.name}</p>
                          <p className="text-xs text-zinc-400">Precio reparto: ${item.price}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className={`rounded-xl px-3 py-1.5 text-sm font-bold flex flex-col items-end ${item.quantity === 0 ? "bg-red-500/20 text-red-300" : "bg-brand-red/20 text-brand-yellow"}`}>
                            <span>{item.quantity} {!item.unidad_medida || item.unidad_medida === 'unidades' ? 'un.' : item.unidad_medida}</span>
                            {(item.reserved_qty ?? 0) > 0 && (
                              <span className="text-[10px] text-emerald-400 mt-0.5">+{item.reserved_qty} reservados</span>
                            )}
                          </div>
                          <button onClick={() => setReservaModalItem(item)}
                            className="text-[10px] uppercase tracking-wider bg-white/10 text-zinc-300 px-2 py-1 rounded-lg hover:bg-white/20 transition-colors border border-white/10">
                            + Solicitar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Driver Reserva Modal ── */}
          {reservaModalItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setReservaModalItem(null)} />
              <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold flex items-center gap-2"><Package className="w-5 h-5 text-brand-yellow" /> Solicitar Stock</h2>
                  <button onClick={() => setReservaModalItem(null)} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.target as HTMLFormElement);
                  try {
                    const res = await fetch(`${API_URL}/deposito/reservar`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ item_id: reservaModalItem.id, cantidad: parseFloat(fd.get('cantidad') as string) })
                    });
                    if (res.ok) {
                      setReservaModalItem(null);
                      fetchAllData(token!, false);
                    } else {
                      const data = await res.json();
                      alert(data.message || 'Error al solicitar');
                    }
                  } catch { alert('Error de conexión'); }
                }} className="space-y-4">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-center">
                    Producto: <strong className="text-brand-yellow">{reservaModalItem.name}</strong>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5 block">Cantidad a solicitar</label>
                    <input name="cantidad" type="number" step="0.01" min="0.01" required autoFocus
                      className="w-full h-12 rounded-xl bg-white/5 border border-white/10 px-4 text-white outline-none focus:border-brand-red text-center text-lg" />
                  </div>
                  <button type="submit" className="w-full bg-brand-red text-white h-12 rounded-xl font-bold shadow-lg shadow-brand-red/20 active:scale-95 transition-all">
                    Enviar Solicitud
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ── MATERIAS PRIMAS ── */}
          {activeTab === "materias" && isAdmin && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h1 className="text-2xl font-bold">Materias Primas</h1>
                <button onClick={() => { setMpForm({ nombre: '', precio: 0, peso: 0, unidad_medida: 'kg' }); setMpEditing(null); setMpModal('crear'); }}
                  className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-500/20 transition-colors shrink-0">
                  <Plus className="w-4 h-4" /> Nueva Materia Prima
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input type="text" placeholder="Buscar..." value={mpSearch}
                  onChange={e => { setMpSearch(e.target.value); setMpPage(1); fetchMateriaPrimas(1, e.target.value); }}
                  className="w-full h-10 pl-9 pr-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:border-brand-red outline-none" />
              </div>
              {loadingMP ? <p className="text-center text-zinc-500 py-8">Cargando...</p> : (
                <div className="space-y-2">
                  {materiaPrimas.map((mp: any) => (
                    <div key={mp.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-semibold text-white">{mp.nombre}</p>
                        <div className="flex flex-wrap gap-3 text-xs text-zinc-400">
                          <span>Precio: <strong className="text-zinc-200">${mp.precio}</strong></span>
                          <span>Presentación: <strong className="text-zinc-200">{mp.peso} unid. base</strong></span>
                          <span>En depósito: <strong className="text-emerald-300">{mp.stock_deposito} {mp.unidad_medida}</strong></span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => { setMpForm({ nombre: mp.nombre, precio: mp.precio, peso: mp.peso, unidad_medida: mp.unidad_medida }); setMpEditing(mp); setMpModal('editar'); }}
                          className="text-xs px-3 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors">
                          <Edit2 className="w-3 h-3 inline mr-1" />Editar
                        </button>
                        <button onClick={async () => {
                          if (!confirm(`¿Eliminar "${mp.nombre}"?`)) return;
                          const res = await fetch(`${API_URL}/admin/materias-primas/${mp.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
                          const d = await res.json();
                          if (d.success) fetchMateriaPrimas(mpPage, mpSearch); else alert(d.message);
                        }} className="text-xs px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors">
                          <Trash2 className="w-3 h-3 inline mr-1" />Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                  {materiaPrimas.length === 0 && <p className="text-center text-zinc-500 py-8">No se encontraron materias primas.</p>}
                </div>
              )}
              {mpTotalPages > 1 && (
                <div className="flex items-center justify-center gap-4 py-2">
                  <button onClick={() => { const p = Math.max(1, mpPage - 1); setMpPage(p); fetchMateriaPrimas(p, mpSearch); }} disabled={mpPage === 1}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm disabled:opacity-30">Anterior</button>
                  <span className="text-xs text-zinc-500">Pág {mpPage} de {mpTotalPages}</span>
                  <button onClick={() => { const p = Math.min(mpTotalPages, mpPage + 1); setMpPage(p); fetchMateriaPrimas(p, mpSearch); }} disabled={mpPage === mpTotalPages}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm disabled:opacity-30">Siguiente</button>
                </div>
              )}
            </div>
          )}

          {/* Modal MP (Crear/Editar) */}
          {mpModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="font-bold text-lg">{mpModal === 'crear' ? 'Nueva Materia Prima' : 'Editar Materia Prima'}</h2>
                  <button onClick={() => setMpModal(null)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={async e => {
                  e.preventDefault();
                  const url = mpEditing ? `${API_URL}/admin/materias-primas/${mpEditing.id}` : `${API_URL}/admin/materias-primas`;
                  const method = mpEditing ? 'PUT' : 'POST';
                  try {
                    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(mpForm) });
                    const d = await res.json();
                    if (d.success) { setMpModal(null); fetchMateriaPrimas(mpPage, mpSearch); } else alert(d.message || JSON.stringify(d));
                  } catch (err: any) { alert(err?.message || 'Error al guardar'); }
                }} className="space-y-4">
                  <div><label className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5 block">Nombre</label>
                    <input required value={mpForm.nombre} onChange={e => setMpForm({...mpForm, nombre: e.target.value})} className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white outline-none focus:border-brand-red" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5 block">Costo de compra ($)</label>
                      <input type="number" step="0.01" required value={mpForm.precio} onChange={e => setMpForm({...mpForm, precio: Number(e.target.value)})} placeholder="Ej: 25000" className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white outline-none focus:border-brand-red" /></div>
                    <div><label className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5 block">Presentación / Cantidad</label>
                      <input type="number" step="0.01" required value={mpForm.peso} onChange={e => setMpForm({...mpForm, peso: Number(e.target.value)})} placeholder="Ej: 25" className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white outline-none focus:border-brand-red" /></div>
                  </div>
                  <div><label className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5 block">Unidad de medida</label>
                    <select value={mpForm.unidad_medida} onChange={e => setMpForm({...mpForm, unidad_medida: e.target.value})} className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white outline-none focus:border-brand-red">
                      {['kg','g','lt','ml','unidades','paquetes','cajas','bidones','bolsas'].map(u => <option key={u} value={u} className="bg-zinc-900">{u}</option>)}
                    </select>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-[11px] text-zinc-400 leading-relaxed">
                    💡 <strong>Tip para Recetas:</strong> Si vas a usar <strong>gramos</strong> en tus recetas, poné el total de gramos en la Presentación (ej: <code>25000</code> para una bolsa de 25kg). El costo estimado será de <strong>${mpForm.peso > 0 ? (mpForm.precio / mpForm.peso).toFixed(2) : '0.00'} por cada unidad base</strong>.
                  </div>
                  <button type="submit" className="w-full bg-brand-red text-white h-11 rounded-xl font-bold shadow-lg shadow-brand-red/20">{mpEditing ? 'Guardar Cambios' : 'Crear'}</button>
                </form>
              </div>
            </div>
          )}

          {/* ── RECETAS ── */}
          {activeTab === "recetas" && (isAdmin || isProduccion) && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h1 className="text-2xl font-bold">Recetas de Producción</h1>
                                {isAdmin && (
                  <button onClick={() => { 
                    if (depositoArticulos.length === 0) fetchDeposito();
                    if (materiaPrimas.length === 0) fetchMateriaPrimas(1, '');
                    setRecetaForm({ 
                      nombre: '', descripcion: '', porciones: 1, id_articulo_resultado: '',
                      empleado: 0, costo_elaboracion: 0, costo_unitario: 0, porcentaje_ganancia: 0, precio_unitario: 0, iva: 0, precio_iva: 0, ganancia: 0
                    }); 
                    setRecetaIngredientes([]); 
                    setRecetaEditing(null); 
                    setRecetaArticuloSearch('');
                    setRecetaArticuloDropdownOpen(false);
                    setRecetaModal('crear'); 
                  }}
                    className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-500/20 transition-colors shrink-0">
                    <Plus className="w-4 h-4" /> Nueva Receta
                  </button>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input type="text" placeholder="Buscar recetas..." value={recetaSearch}
                  onChange={e => { setRecetaSearch(e.target.value); setRecetaPage(1); fetchRecetas(e.target.value); }}
                  className="w-full h-10 pl-9 pr-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:border-brand-red outline-none" />
              </div>
              {loadingRecetas ? <p className="text-center text-zinc-500 py-8">Cargando...</p> : (
                <div className="space-y-3">
                  {recetas.slice((recetaPage - 1) * 6, recetaPage * 6).map((r: any) => (
                    <div key={r.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{r.nombre}</p>
                          {r.descripcion && <p className="text-xs text-zinc-400 mt-0.5">{r.descripcion}</p>}
                          <div className="flex flex-wrap gap-3 text-xs text-zinc-400 mt-1">
                            <span>Porciones: <strong className="text-zinc-200">{r.porciones}</strong></span>
                            <span>Ingredientes: <strong className="text-zinc-200">{r.ingredientes?.length ?? 0}</strong></span>
                            <span>Costo total: <strong className="text-brand-yellow">${r.costo_total?.toFixed(2) ?? '0.00'}</strong></span>
                            {r.articulo_resultado && <span>→ <strong className="text-emerald-300">{r.articulo_resultado.nombre}</strong></span>}
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0 flex-wrap">
                          <button onClick={() => { setRecetaEjecutarModal(r); setRecetaEjecutarQty(1); }}
                            className="text-xs px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors font-semibold">
                             –¶ Ejecutar
                          </button>
                          <button onClick={() => {
                            if (depositoArticulos.length === 0) fetchDeposito();
                            if (materiaPrimas.length === 0) fetchMateriaPrimas(1, '');
                            setRecetaForm({ 
                              nombre: r.nombre, 
                              descripcion: r.descripcion ?? '', 
                              porciones: r.porciones, 
                              id_articulo_resultado: r.id_articulo_resultado ?? '',
                              empleado: r.calculo?.empleado ?? 0,
                              costo_elaboracion: r.calculo?.costo_elaboracion ?? 0,
                              costo_unitario: r.calculo?.costo_unitario ?? 0,
                              porcentaje_ganancia: r.calculo?.porcentaje_ganancia ?? 0,
                              precio_unitario: r.calculo?.precio ?? 0,
                              iva: r.calculo?.iva ?? 0,
                              precio_iva: r.calculo?.precio_iva ?? 0,
                              ganancia: r.calculo?.ganancia ?? 0
                            });
                            setRecetaIngredientes(r.ingredientes?.map((i: any) => {
                              const mpInfo = allMateriasPrimas.find((mp: any) => String(mp.id) === String(i.id_materia_prima));
                              return { 
                                id_materia_prima: i.id_materia_prima, 
                                nombre: i.nombre, 
                                cantidad: i.cantidad, 
                                unidad: i.unidad,
                                precio: i.precio || mpInfo?.precio || 0,
                                peso: i.peso || mpInfo?.peso || 1,
                              };
                            }) ?? []);
                            setRecetaEditing(r);
                            setRecetaArticuloSearch('');
                            setRecetaArticuloDropdownOpen(false);
                            setRecetaModal('editar');
                          }} className="text-xs px-3 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors">
                            <Edit2 className="w-3 h-3 inline mr-1" />Editar
                          </button>
                          <button onClick={async () => {
                            if (!confirm(`¿Eliminar receta "${r.nombre}"?`)) return;
                            const res = await fetch(`${API_URL}/admin/recetas/${r.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
                            const d = await res.json();
                            if (d.success) fetchRecetas(recetaSearch); else alert(d.message);
                          }} className="text-xs px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors">
                            <Trash2 className="w-3 h-3 inline mr-1" />Eliminar
                          </button>
                        </div>
                      </div>
                      {r.ingredientes?.length > 0 && (
                        <div className="border-t border-white/5 pt-2 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                          {r.ingredientes.map((ing: any, idx: number) => (
                            <div key={idx} className="bg-black/20 rounded-lg px-2 py-1 text-xs flex justify-between">
                              <span className="text-zinc-300 truncate">{ing.nombre}</span>
                              <span className="text-zinc-400 ml-2 shrink-0">{ing.cantidad} {ing.unidad}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {recetas.length === 0 && <p className="text-center text-zinc-500 py-8">No hay recetas cargadas.</p>}
                </div>
              )}
              {recetaTotalPages > 1 && (
                <div className="flex items-center justify-center gap-4 py-3 border-t border-white/5 mt-4">
                  <button type="button" onClick={() => setRecetaPage(p => Math.max(1, p - 1))} disabled={recetaPage === 1}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm disabled:opacity-30 transition-colors">Anterior</button>
                  <span className="text-xs text-zinc-500">Pág {recetaPage} de {recetaTotalPages}</span>
                  <button type="button" onClick={() => setRecetaPage(p => Math.min(recetaTotalPages, p + 1))} disabled={recetaPage === recetaTotalPages}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm disabled:opacity-30 transition-colors">Siguiente</button>
                </div>
              )}
            </div>
          )}

          {/* Modal Receta (Crear/Editar) */}
          {recetaModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <div className="w-full max-w-2xl bg-zinc-900 border border-white/10 rounded-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center">
                  <h2 className="font-bold text-lg">{recetaModal === 'crear' ? 'Nueva Receta' : 'Editar Receta'}</h2>
                  <button onClick={() => setRecetaModal(null)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={async e => {
                  e.preventDefault();
                  if (recetaIngredientes.length === 0) { alert('Agregá al menos un ingrediente.'); return; }

                  const parsedIngredientes = recetaIngredientes.map(i => ({
                    ...i,
                    cantidad: parseFloat(String(i.cantidad).replace(',', '.')) || 0,
                  }));

                  if (parsedIngredientes.some(i => i.cantidad <= 0)) {
                    alert('La cantidad de cada ingrediente debe ser mayor a 0');
                    return;
                  }

                  const url = recetaEditing ? `${API_URL}/admin/recetas/${recetaEditing.id}` : `${API_URL}/admin/recetas`;
                  const method = recetaEditing ? 'PUT' : 'POST';
                  try {
                    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ 
                        ...recetaForm, 
                        porciones: parseFloat(String(recetaForm.porciones).replace(',', '.')) || 1,
                        id_articulo_resultado: recetaForm.id_articulo_resultado || null, 
                        ingredientes: parsedIngredientes,
                        empleado: parseFloat(String(recetaForm.empleado).replace(',', '.')) || 0,
                        costo_elaboracion: parseFloat(String(recetaForm.costo_elaboracion).replace(',', '.')) || 0,
                        costo_unitario: parseFloat(String(recetaForm.costo_unitario).replace(',', '.')) || 0,
                        porcentaje_ganancia: parseFloat(String(recetaForm.porcentaje_ganancia).replace(',', '.')) || 0,
                        precio_unitario: parseFloat(String(recetaForm.precio_unitario).replace(',', '.')) || 0,
                        iva: parseFloat(String(recetaForm.iva).replace(',', '.')) || 0,
                        precio_iva: parseFloat(String(recetaForm.precio_iva).replace(',', '.')) || 0,
                        ganancia: parseFloat(String(recetaForm.ganancia).replace(',', '.')) || 0,
                      }) 
                    });
                    const d = await res.json();
                    if (d.success) { setRecetaModal(null); fetchRecetas(recetaSearch); } else alert(d.message || JSON.stringify(d));
                  } catch (err: any) { alert(err?.message || 'Error al guardar'); }
                }} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2"><label className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5 block">Nombre de la receta</label>
                      <input required value={recetaForm.nombre} onChange={e => {
                        const nuevoNombre = e.target.value;
                        const match = depositoArticulos.find((a: any) => a.nombre.trim().toLowerCase() === nuevoNombre.trim().toLowerCase());
                        setRecetaForm((prev: any) => ({
                          ...prev,
                          nombre: nuevoNombre,
                          ...(match ? { id_articulo_resultado: match.id } : {})
                        }));
                      }} className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white outline-none focus:border-brand-red" /></div>
                    <div><label className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5 block">Porciones producidas</label>
                      <input type="text" inputMode="decimal" required value={recetaForm.porciones} onChange={e => setRecetaForm({...recetaForm, porciones: e.target.value})} className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white outline-none focus:border-brand-red font-semibold" /></div>
                    <div>
                      <label className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5 block">Artículo que produce</label>
                      {(() => {
                        const selectedArticulo = depositoArticulos.find((a: any) => String(a.id) === String(recetaForm.id_articulo_resultado));
                        if (selectedArticulo) {
                          return (
                            <div className="flex items-center justify-between w-full h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 text-sm">
                              <div className="flex items-center gap-2 truncate">
                                <Package className="w-4 h-4 text-emerald-400 shrink-0" />
                                <span className="font-semibold text-emerald-300 truncate">{selectedArticulo.nombre}</span>
                              </div>
                              <button 
                                type="button" 
                                onClick={() => { 
                                  setRecetaForm({ ...recetaForm, id_articulo_resultado: '' }); 
                                  setRecetaArticuloSearch(''); 
                                }}
                                className="text-xs text-zinc-400 hover:text-red-400 p-1 transition-colors"
                                title="Cambiar / Quitar"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        }
                        
                        const articulosFiltrados = depositoArticulos.filter((a: any) => 
                          !recetaArticuloSearch.trim() || a.nombre.toLowerCase().includes(recetaArticuloSearch.toLowerCase())
                        );

                        return (
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                            <input
                              type="text"
                              placeholder="Buscar artículo..."
                              value={recetaArticuloSearch}
                              onFocus={() => setRecetaArticuloDropdownOpen(true)}
                              onChange={e => {
                                setRecetaArticuloSearch(e.target.value);
                                setRecetaArticuloDropdownOpen(true);
                              }}
                              className="w-full h-11 pl-9 pr-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white outline-none focus:border-brand-red placeholder:text-zinc-500"
                            />
                            {recetaArticuloDropdownOpen && (
                              <div className="absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto bg-zinc-950 border border-white/10 rounded-xl shadow-2xl z-30 p-1 space-y-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRecetaForm({ ...recetaForm, id_articulo_resultado: '' });
                                    setRecetaArticuloDropdownOpen(false);
                                    setRecetaArticuloSearch('');
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs rounded-lg text-zinc-400 hover:bg-white/5 transition-colors italic"
                                >
                                  -- Sin asignar --
                                </button>
                                {articulosFiltrados.slice(0, 15).map((a: any) => (
                                  <button
                                    key={a.id}
                                    type="button"
                                    onClick={() => {
                                      setRecetaForm({ ...recetaForm, id_articulo_resultado: a.id });
                                      setRecetaArticuloDropdownOpen(false);
                                      setRecetaArticuloSearch('');
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-white/10 text-white flex justify-between items-center transition-colors"
                                  >
                                    <span className="font-medium text-zinc-200 truncate">{a.nombre}</span>
                                    <span className="text-[10px] text-zinc-400 font-mono shrink-0 ml-2">Stock dep: {a.stock_deposito}</span>
                                  </button>
                                ))}
                                {articulosFiltrados.length === 0 && (
                                  <p className="text-center text-xs text-zinc-500 py-2">No se encontró artículo</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="sm:col-span-2"><label className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5 block">Descripción (opcional)</label>
                      <input value={recetaForm.descripcion} onChange={e => setRecetaForm({...recetaForm, descripcion: e.target.value})} className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white outline-none focus:border-brand-red" /></div>
                  </div>
                  <div className="border-t border-white/10 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-zinc-400 uppercase tracking-widest font-semibold">Ingredientes</p>
                      {allMateriasPrimas.length === 0 && (
                        <button type="button" onClick={() => { fetchDeposito(); fetchMateriaPrimas(1, ''); }} className="text-xs text-brand-yellow hover:underline">
                          Recargar materias primas
                        </button>
                      )}
                    </div>
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                      <input
                        placeholder="Buscar materia prima para agregar..."
                        value={recetaIngSearch}
                        onChange={e => setRecetaIngSearch(e.target.value)}
                        className="w-full h-10 pl-9 pr-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white outline-none focus:border-brand-red"
                      />
                    </div>
                    {(recetaIngSearch.trim().length > 0 || (allMateriasPrimas.length > 0 && recetaIngredientes.length === 0)) && (
                      <div className="bg-black/40 border border-white/10 rounded-xl mb-3 max-h-48 overflow-y-auto divide-y divide-white/5">
                        {allMateriasPrimas
                          .filter((mp: any) => {
                            if (recetaIngredientes.some(i => String(i.id_materia_prima) === String(mp.id))) return false;
                            const term = recetaIngSearch.toLowerCase().trim();
                            if (!term) return true;
                            const name = (mp.nombre || '').toLowerCase();
                            return name.includes(term);
                          })
                          .map((mp: any) => (
                            <button
                              type="button"
                              key={mp.id}
                              onClick={() => {
                                setRecetaIngredientes([
                                  ...recetaIngredientes,
                                  { 
                                    id_materia_prima: mp.id, 
                                    nombre: mp.nombre, 
                                    cantidad: 1, 
                                    unidad: mp.unidad_medida || 'kg',
                                    precio: Number(mp.precio) || 0,
                                    peso: Number(mp.peso) > 0 ? Number(mp.peso) : 1,
                                  }
                                ]);
                                setRecetaIngSearch('');
                              }}
                              className="w-full text-left px-3 py-2.5 text-xs hover:bg-white/10 text-zinc-300 flex justify-between items-center transition-colors"
                            >
                              <div className="flex flex-col">
                                <span className="font-medium text-white">{mp.nombre}</span>
                                <span className="text-[10px] text-zinc-500">
                                  {Number(mp.precio) > 0 ? `$${(Number(mp.precio) / (Number(mp.peso) || 1)).toFixed(2)} por ${mp.unidad_medida || 'kg'}` : 'Sin precio cargado ($0.00)'}
                                </span>
                              </div>
                              <span className="text-zinc-400 text-[11px]">
                                depósito: <strong className="text-emerald-400">{mp.stock_deposito} {mp.unidad_medida || 'kg'}</strong>
                              </span>
                            </button>
                          ))}
                        {allMateriasPrimas.filter((mp: any) => {
                          if (recetaIngredientes.some(i => String(i.id_materia_prima) === String(mp.id))) return false;
                          const term = recetaIngSearch.toLowerCase().trim();
                          if (!term) return true;
                          return (mp.nombre || '').toLowerCase().includes(term);
                        }).length === 0 && (
                          <p className="text-center text-zinc-500 text-xs py-3">No se encontraron materias primas que coincidan</p>
                        )}
                      </div>
                    )}
                    <div className="space-y-2">
                      {recetaIngredientes.map((ing, idx) => {
                        const cantNum = parseFloat(String(ing.cantidad).replace(',', '.')) || 0;
                        const p = Number(ing.precio) || 0;
                        const w = Number(ing.peso) > 0 ? Number(ing.peso) : 1;
                        const unitCost = p / w;
                        const subtotalCost = cantNum * unitCost;

                        return (
                          <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white/5 border border-white/10 rounded-xl p-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-zinc-200 font-semibold truncate">{ing.nombre}</p>
                              <p className="text-[11px] text-zinc-400">
                                {p > 0 ? (
                                  <>Costo base: <span className="text-zinc-300 font-mono">${unitCost.toFixed(2)}</span> por {ing.unidad}</>
                                ) : (
                                  <span className="text-amber-400/80">Sin precio cargado en MP ($0.00)</span>
                                )}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={ing.cantidad}
                                  onChange={e => {
                                    const val = e.target.value;
                                    const upd = [...recetaIngredientes];
                                    upd[idx].cantidad = val;
                                    setRecetaIngredientes(upd);
                                  }}
                                  placeholder="0"
                                  className="w-16 bg-transparent text-sm text-white outline-none text-right font-bold"
                                />
                                <input type="text" value={ing.unidad} onChange={e => { const upd = [...recetaIngredientes]; upd[idx].unidad = e.target.value; setRecetaIngredientes(upd); }} className="w-12 bg-transparent text-xs text-zinc-400 border-b border-white/10 outline-none focus:border-brand-red ml-1" />
                              </div>
                              <div className="w-20 text-right">
                                <p className="text-[10px] text-zinc-500 uppercase font-mono">Subtotal</p>
                                <p className="text-xs font-bold text-brand-yellow font-mono">
                                  ${subtotalCost.toFixed(2)}
                                </p>
                              </div>
                              <button type="button" onClick={() => setRecetaIngredientes(recetaIngredientes.filter((_, i) => i !== idx))} className="text-zinc-500 hover:text-red-400 p-1 transition-colors">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {recetaIngredientes.length === 0 && <p className="text-xs text-zinc-500 text-center py-2">Buscá y agregá ingredientes arriba</p>}
                    </div>

                    {/* Resumen de costos de la receta en tiempo real */}
                    {recetaIngredientes.length > 0 && (() => {
                      const totalCosto = recetaIngredientes.reduce((acc, ing) => {
                        const cantNum = parseFloat(String(ing.cantidad).replace(',', '.')) || 0;
                        const p = Number(ing.precio) || 0;
                        const w = Number(ing.peso) > 0 ? Number(ing.peso) : 1;
                        return acc + (cantNum * (p / w));
                      }, 0);
                      const porcionesNum = parseFloat(String(recetaForm.porciones).replace(',', '.')) || 1;
                      const costoPorPorcion = totalCosto / Math.max(0.01, porcionesNum);

                      return (
                        <div className="mt-3 bg-gradient-to-r from-amber-500/10 via-brand-red/10 to-transparent border border-brand-yellow/20 rounded-2xl p-3.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-zinc-300 font-semibold">Costo Total Estimado de la Receta:</span>
                            <span className="text-base font-black text-brand-yellow font-mono">${totalCosto.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-zinc-400">
                            <span>Costo por porción producida ({porcionesNum} {porcionesNum === 1 ? 'porción' : 'porciones'}):</span>
                            <span className="font-bold text-white font-mono">${costoPorPorcion.toFixed(2)}</span>
                          </div>
                          <p className="text-[11px] text-zinc-400/90 leading-tight pt-1.5 border-t border-white/5">
                            💡 <strong>¿De dónde sale este costo?</strong> Se calcula automáticamente a partir del precio de compra de cada materia prima: <code className="text-zinc-300 bg-white/5 px-1 py-0.5 rounded">(Cantidad × Precio) ÷ Presentación</code>. Podés actualizar los costos base desde la pestaña <em>Materias Primas</em>.
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="border-t border-white/10 pt-4">
                    <p className="text-xs text-zinc-400 uppercase tracking-widest font-semibold mb-3">Costos y Ganancias</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                                  <div><label className="text-xs text-zinc-400 block mb-1">Costo Empleado</label>
                        <input type="text" inputMode="decimal" value={recetaForm.empleado} onChange={e => setRecetaForm({...recetaForm, empleado: e.target.value})} className="w-full h-10 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white outline-none focus:border-brand-red" />
                      </div>
                      <div><label className="text-xs text-zinc-400 block mb-1">Costo Elaboración</label>
                        <input type="text" inputMode="decimal" value={recetaForm.costo_elaboracion} onChange={e => setRecetaForm({...recetaForm, costo_elaboracion: e.target.value})} className="w-full h-10 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white outline-none focus:border-brand-red" />
                      </div>
                      <div><label className="text-xs text-zinc-400 block mb-1">Costo Unitario</label>
                        <input type="text" inputMode="decimal" value={recetaForm.costo_unitario} onChange={e => setRecetaForm({...recetaForm, costo_unitario: e.target.value})} className="w-full h-10 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white outline-none focus:border-brand-red" />
                      </div>
                      <div><label className="text-xs text-zinc-400 block mb-1">% Ganancia</label>
                        <input type="text" inputMode="decimal" value={recetaForm.porcentaje_ganancia} onChange={e => setRecetaForm({...recetaForm, porcentaje_ganancia: e.target.value})} className="w-full h-10 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white outline-none focus:border-brand-red" />
                      </div>
                      <div><label className="text-xs text-zinc-400 block mb-1">Precio Neto</label>
                        <input type="text" inputMode="decimal" value={recetaForm.precio_unitario} onChange={e => setRecetaForm({...recetaForm, precio_unitario: e.target.value})} className="w-full h-10 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white outline-none focus:border-brand-red" />
                      </div>
                      <div><label className="text-xs text-zinc-400 block mb-1">% IVA</label>
                        <input type="text" inputMode="decimal" value={recetaForm.iva} onChange={e => setRecetaForm({...recetaForm, iva: e.target.value})} className="w-full h-10 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white outline-none focus:border-brand-red" />
                      </div>
                      <div className="col-span-2 sm:col-span-3"><label className="text-xs text-emerald-400 font-bold block mb-1">Precio Final (con IVA)</label>
                        <input type="text" inputMode="decimal" value={recetaForm.precio_iva} onChange={e => setRecetaForm({...recetaForm, precio_iva: e.target.value})} className="w-full h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 font-bold text-lg text-emerald-400 outline-none focus:border-emerald-400" />
                      </div>
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-brand-red text-white h-11 rounded-xl font-bold shadow-lg shadow-brand-red/20">{recetaEditing ? 'Guardar Cambios' : 'Crear Receta'}</button>
                </form>
              </div>
            </div>
          )}

          {/* Modal Ejecutar Receta */}
          {recetaEjecutarModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="font-bold text-lg"> –¶ Ejecutar Receta</h2>
                  <button onClick={() => setRecetaEjecutarModal(null)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-1">
                  <p className="font-semibold text-white">{recetaEjecutarModal.nombre}</p>
                  <p className="text-xs text-zinc-400">{recetaEjecutarModal.porciones} porciones por ejecución → <strong className="text-emerald-300">{recetaEjecutarModal.articulo_resultado?.nombre ?? 'Sin artículo asignado'}</strong></p>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 uppercase tracking-widest mb-2 block">¿Cuántas veces ejecutar?</label>
                  <input type="number" min="1" value={recetaEjecutarQty} onChange={e => setRecetaEjecutarQty(Number(e.target.value))} className="w-full h-14 rounded-xl bg-white/5 border border-white/10 px-4 text-2xl font-bold text-center text-white outline-none focus:border-emerald-400" />
                  <p className="text-xs text-zinc-500 mt-1 text-center">Producirá {(recetaEjecutarModal.porciones * recetaEjecutarQty).toFixed(2)} unidades al depósito</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-zinc-400 font-semibold uppercase tracking-widest">Consumo de MP:</p>
                  {recetaEjecutarModal.ingredientes?.map((ing: any, i: number) => {
                    const cantTotal = ing.cantidad * recetaEjecutarQty;
                    const u = (ing.unidad || '').toLowerCase().trim();
                    const peso = ing.peso || 1;
                    let consumo = cantTotal / peso;
                    
                    if (['g', 'gr', 'grs', 'gramos', 'gramo', 'ml', 'cc', 'cm3', 'mililitro', 'mililitros'].includes(u)) {
                      consumo = cantTotal / (peso > 100 ? peso : peso * 1000);
                    } else if (['kg', 'kgs', 'kilo', 'kilos', 'kilogramo', 'kilogramos', 'l', 'lt', 'lts', 'litro', 'litros'].includes(u)) {
                      consumo = cantTotal / (peso > 100 ? peso / 1000 : peso);
                    }

                    return (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-zinc-300">{ing.nombre}</span>
                        <span className={`font-semibold ${ing.stock_deposito >= consumo ? 'text-emerald-300' : 'text-red-400'}`}>
                          {cantTotal.toFixed(2)} {ing.unidad} (disp: {ing.stock_deposito.toFixed(2)})
                        </span>
                      </div>
                    );
                  })}
                </div>
                <button onClick={async () => {
                  try {
                    const res = await fetch(`${API_URL}/admin/recetas/${recetaEjecutarModal.id}/ejecutar`, {
                      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ cantidad_ejecuciones: recetaEjecutarQty })
                    });
                    const d = await res.json();
                    if (d.success) { setRecetaEjecutarModal(null); alert(d.message); fetchRecetas(recetaSearch); fetchDeposito(); }
                    else { alert(d.message + (d.faltantes ? '\n' + d.faltantes.join('\n') : '')); }
                  } catch { alert('Error de conexión'); }
                }} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white h-12 rounded-xl font-bold transition-colors">
                  ✓ Confirmar Producción
                </button>
              </div>
            </div>
          )}

          {/* ── PERSONAS (CLIENTES & PROVEEDORES) ── */}
          {activeTab === "clientes" && !isVendedor && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center justify-between w-full sm:w-auto gap-3">
                  <h1 className="text-2xl font-bold">Personas {isAdmin ? "(Saldos & Gestión)" : ""}</h1>
                  {!isAdmin && (
                    <button
                      onClick={() => {
                        setPersonaForm({ nombre: "", tipo_persona: "cliente", direccion: "", telefono: "", mail: "", user_id: "" });
                        setEditingPersona({});
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-brand-red hover:bg-red-600 rounded-xl text-xs font-bold text-white transition-all shadow-md shadow-brand-red/20 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Nueva Persona</span>
                    </button>
                  )}
                </div>
                
                {isAdmin && (
                  <div className="flex bg-black/20 p-1 rounded-xl border border-white/5 self-start sm:self-auto shrink-0">
                    <button
                      onClick={() => setAdminClientesTab('saldos')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        adminClientesTab === 'saldos' ? 'bg-brand-red text-white' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Saldos
                    </button>
                    <button
                      onClick={() => setAdminClientesTab('gestion')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        adminClientesTab === 'gestion' ? 'bg-brand-red text-white' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Gestión (CRUD)
                    </button>
                  </div>
                )}
              </div>

              {(!isAdmin || adminClientesTab === 'saldos') && (
                <div className="space-y-4">
                  {/* Selector Sub-pestañas: Clientes (A cobrar) vs Proveedores (A pagar) */}
                  <div className="flex bg-black/40 p-1 rounded-2xl border border-white/10 w-full sm:w-auto gap-1">
                    <button
                      type="button"
                      onClick={() => setPersonaSubTab('clientes')}
                      className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        personaSubTab === 'clientes'
                          ? 'bg-brand-red text-white shadow-md shadow-brand-red/20'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      <span>Clientes (A cobrar)</span>
                      {clients.filter(c => c.balance > 0).length > 0 && (
                        <span className="bg-red-500/20 text-red-300 text-[10px] px-1.5 py-0.5 rounded-full border border-red-500/30 font-bold">
                          {clients.filter(c => c.balance > 0).length}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPersonaSubTab('proveedores'); fetchProveedores(); }}
                      className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        personaSubTab === 'proveedores'
                          ? 'bg-brand-red text-white shadow-md shadow-brand-red/20'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Building2 className="w-4 h-4" />
                      <span>Proveedores (A pagar)</span>
                      {proveedores.filter(p => p.balance > 0).length > 0 && (
                        <span className="bg-brand-yellow/20 text-brand-yellow text-[10px] px-1.5 py-0.5 rounded-full border border-brand-yellow/30 font-bold">
                          {proveedores.filter(p => p.balance > 0).length}
                        </span>
                      )}
                    </button>
                  </div>

                  {/* ── SUBTAB: CLIENTES (A COBRAR) ── */}
                  {personaSubTab === 'clientes' && (
                    <>
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar clientes..."
                          className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 pl-11 pr-4 text-sm outline-none placeholder:text-zinc-500 focus:border-brand-red transition-colors" />
                      </div>
                      <div className="flex flex-col gap-2">
                        {filteredClients.map(client => (
                          <button key={client.id} onClick={() => setClienteDetalle(client)}
                            className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left active:scale-[0.99] transition-all flex items-center justify-between">
                            <div className="flex flex-col min-w-0 pr-2">
                              <h3 className="text-sm font-semibold truncate text-white">{client.name}</h3>
                              <p className="text-[11px] text-zinc-400 mt-0.5 truncate">{client.address || "Sin dirección"}</p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <div className={`rounded-xl px-3 py-1.5 text-xs font-bold ${client.balance > 0 ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-300"}`}>
                                {client.balance > 0 ? `-$${client.balance.toLocaleString('es-AR')}` : "OK"}
                              </div>
                              <ChevronRight className="h-4 w-4 text-zinc-500" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {/* ── SUBTAB: PROVEEDORES (A PAGAR) ── */}
                  {personaSubTab === 'proveedores' && (
                    <div className="space-y-4">
                      {/* Banner resumen de deuda total a proveedores */}
                      <div className="rounded-2xl p-4 bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">Deuda total acumulada a proveedores</span>
                          <span className="text-2xl font-bold text-red-400">
                            ${proveedores.reduce((acc, p) => acc + (p.balance || 0), 0).toLocaleString('es-AR')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                          <span className="px-3 py-1 rounded-xl bg-white/5 border border-white/10">
                            <b>{proveedores.filter(p => p.balance > 0).length}</b> proveedores con saldo pendiente
                          </span>
                          <button
                            type="button"
                            onClick={fetchProveedores}
                            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-zinc-300 transition-colors"
                            title="Actualizar"
                          >
                            <RefreshCw className={`w-4 h-4 ${loadingProveedores ? 'animate-spin text-brand-red' : ''}`} />
                          </button>
                        </div>
                      </div>

                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                        <input
                          value={proveedorSearch}
                          onChange={e => setProveedorSearch(e.target.value)}
                          placeholder="Buscar proveedores por nombre, teléfono o dirección..."
                          className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 pl-11 pr-4 text-sm outline-none placeholder:text-zinc-500 focus:border-brand-red transition-colors"
                        />
                      </div>

                      {loadingProveedores ? (
                        <div className="space-y-2">
                          {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse" />)}
                        </div>
                      ) : filteredProveedores.length === 0 ? (
                        <div className="p-8 text-center bg-white/5 rounded-2xl border border-white/5 text-zinc-500 text-sm">
                          No se encontraron proveedores registrados
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2.5">
                          {filteredProveedores.map(prov => (
                            <div
                              key={prov.id}
                              className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-white/20 transition-all"
                            >
                              <div className="flex flex-col min-w-0 pr-2">
                                <div className="flex items-center gap-2">
                                  <h3 className="text-sm font-semibold truncate text-white">{prov.name}</h3>
                                  {prov.compras_pendientes > 0 && (
                                    <span className="text-[10px] bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded-md font-medium">
                                      {prov.compras_pendientes} {prov.compras_pendientes === 1 ? 'compra impaga' : 'compras impagas'}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-zinc-400 mt-1 truncate">
                                  {prov.address || "Sin dirección"} {prov.phone ? `• Tel: ${prov.phone}` : ""}
                                </p>
                                {prov.fecha_mas_antigua && prov.balance > 0 && (
                                  <p className="text-[10px] text-zinc-500 mt-0.5">
                                    Deuda más antigua: {new Date(prov.fecha_mas_antigua).toLocaleDateString('es-AR')}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                                <div className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
                                  prov.balance > 0
                                    ? "bg-red-500/20 text-red-300 border border-red-500/30"
                                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                }`}>
                                  {prov.balance > 0 ? `-$${prov.balance.toLocaleString('es-AR')}` : "Al día ✓"}
                                </div>

                                {prov.balance > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setPaymentProveedor(prov)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-red hover:bg-red-600 text-white text-xs font-bold transition-all shadow-md shadow-brand-red/20 active:scale-95"
                                  >
                                    <CircleDollarSign className="w-3.5 h-3.5" />
                                    <span>Pagar</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => setProveedorDetalle(prov)}
                                  className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                                  title="Ver compras e historial"
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {isAdmin && adminClientesTab === 'gestion' && (
                <div className="space-y-4 relative pb-20">
                  {/* Filtro por tipo de persona en CRUD */}
                  <div className="flex bg-black/30 p-1 rounded-xl border border-white/5 gap-1 overflow-x-auto">
                    {[
                      { id: "", label: "Todos" },
                      { id: "cliente", label: "Clientes" },
                      { id: "proveedor", label: "Proveedores" },
                      { id: "empleado", label: "Empleados" }
                    ].map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => { setAdminPersonasTipo(t.id); setAdminPersonasPage(1); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                          adminPersonasTipo === t.id ? "bg-brand-red text-white" : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                      <input 
                        value={adminPersonasSearch} 
                        onChange={e => { setAdminPersonasSearch(e.target.value); setAdminPersonasPage(1); }} 
                        placeholder="Buscar por nombre, email o teléfono..."
                        className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 pl-11 pr-4 text-sm outline-none placeholder:text-zinc-500 focus:border-brand-red transition-colors" 
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {adminPersonas.map((persona, i) => {
                      const isLast = i === adminPersonas.length - 1;
                      return (
                        <div 
                          key={persona.idpersona} 
                          ref={isLast ? lastPersonaElementRef : null}
                          className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-sm font-semibold truncate text-white">{persona.nombre}</h3>
                              <span className="text-[10px] uppercase font-bold tracking-wider bg-white/10 px-2 py-0.5 rounded-md text-zinc-300">
                                {persona.tipo_persona}
                              </span>
                            </div>
                            {persona.mail && <p className="text-[11px] text-zinc-400 truncate">Email: {persona.mail}</p>}
                            {persona.telefono && <p className="text-[11px] text-zinc-400 truncate">Tel: {persona.telefono}</p>}
                            {persona.user && <p className="text-[11px] text-brand-yellow truncate mt-1">Usuario: {persona.user.name}</p>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button 
                              onClick={() => {
                                setPersonaForm({
                                  nombre: persona.nombre, tipo_persona: persona.tipo_persona, 
                                  direccion: persona.direccion || "", telefono: persona.telefono || "", 
                                  mail: persona.mail || "", user_id: persona.user_id || ""
                                });
                                setEditingPersona(persona);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 text-xs font-semibold hover:bg-blue-500/30 transition-colors"
                            >
                              Editar
                            </button>
                            <button 
                              onClick={() => handleDeletePersona(persona.idpersona)}
                              className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 text-xs font-semibold hover:bg-red-500/30 transition-colors"
                            >
                              Borrar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {loadingAdminPersonas && (
                      <div className="flex justify-center py-4">
                        <RefreshCw className="w-5 h-5 text-brand-red animate-spin" />
                      </div>
                    )}
                  </div>
                  
                  <button 
                    onClick={() => {
                      setPersonaForm({ nombre: "", tipo_persona: "cliente", direccion: "", telefono: "", mail: "", user_id: "" });
                      setEditingPersona({}); // Empty object means "new"
                    }}
                    className="fixed bottom-24 right-6 bg-brand-red text-white p-4 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all z-20 flex items-center justify-center group"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── DEPÃ“SITO ── */}
          {activeTab === "deposito" && (isAdmin || isProduccion) && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Depósito</h1>
                <button onClick={fetchDeposito} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors" title="Actualizar">
                  <RefreshCw className={`w-4 h-4 text-zinc-400 ${loadingDeposito ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Sub-tabs */}
              <div className="flex bg-black/20 p-1 rounded-xl border border-white/5 w-full overflow-x-auto">
                {([['stock', 'Artículos'], ['mp', 'Materia Prima'], ['reservas', 'Reservas'], ['historial', 'Historial']] as const).map(([v, l]) => (
                  <button key={v} onClick={() => { setDepositoSubTab(v); if (v === 'historial') fetchDepositoMovimientos(); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${depositoSubTab === v ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                    {l}
                    {v === 'reservas' && depositoReservasPendientes.length > 0 && (
                      <span className="bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">{depositoReservasPendientes.length}</span>
                    )}
                  </button>
                ))}
              </div>

              {loadingDeposito && (
                <div className="flex justify-center py-10"><RefreshCw className="w-6 h-6 text-brand-red animate-spin" /></div>
              )}

              {/* ── Sub-tab: Artículos ── */}
              {!loadingDeposito && depositoSubTab === 'stock' && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2 justify-between mb-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input type="text" placeholder="Buscar artículo..." value={depositoSearchStock} onChange={e => { setDepositoSearchStock(e.target.value); setDepositoPageStock(1); }}
                        className="w-full h-10 pl-9 pr-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:border-brand-red outline-none" />
                    </div>
                    <div className="flex justify-end gap-2 shrink-0 flex-wrap">
                      <button onClick={() => { setDepositoModal('entrada'); setDepositoModalItem(null); }}
                        className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-500/20 transition-colors">
                        + Entrada
                      </button>
                      <button onClick={() => { setDepositoModal('distribuir'); setDepositoModalItem(null); }}
                        className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-500/20 transition-colors">
                        → Distribuir
                      </button>
                      <button onClick={() => { setDepositoModal('devolucion'); setDepositoModalItem(null); }}
                        className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 text-orange-400 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-orange-500/20 transition-colors">
                        ← Devolver
                      </button>
                    </div>
                  </div>
                  {filteredDepositoArticulos.length === 0 ? (
                    <p className="text-center text-zinc-500 text-sm py-8">No se encontraron artículos.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {filteredDepositoArticulos.slice((depositoPageStock - 1) * 10, depositoPageStock * 10).map(a => (
                          <div key={a.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                            <div className="flex justify-between items-start">
                              <p className="font-semibold text-sm text-white">{a.nombre}</p>
                              <div className="flex flex-wrap gap-1.5 shrink-0 justify-end">
                                <button onClick={() => { setDepositoModal('entrada'); setDepositoModalItem(a); }}
                                  className="text-[10px] px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors">+ Ent</button>
                                <button onClick={() => { setDepositoModal('distribuir'); setDepositoModalItem(a); }}
                                  className="text-[10px] px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors">→ Dist</button>
                                <button onClick={() => { setDepositoModal('devolucion'); setDepositoModalItem(a); }}
                                  className="text-[10px] px-2 py-1 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg hover:bg-orange-500/20 transition-colors">← Dev</button>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                              <div className="bg-black/20 rounded-xl p-2">
                                <p className="text-zinc-400">En Depósito</p>
                                <div className="text-center pt-1"><InlineStockEdit id={a.id} initialStock={a.stock_deposito} onSave={handleInlineAjuste} /></div>
                              </div>
                              <div className="bg-red-500/10 rounded-xl p-2">
                                <p className="text-red-400">Reservado</p>
                                <p className="font-bold text-red-300 text-lg">{a.total_reservado}</p>
                                {(Object.keys(a.stock_repartidores || {}).length > 0) && (
                                  <div className="text-[10px] text-zinc-500 mt-0.5 space-y-0.5">
                                    {Object.entries(a.stock_repartidores || {}).map(([id, rep]: [string, any]) => 
                                      rep.cantidad_reservada > 0 ? <p key={id}>Rep {id}: {rep.cantidad_reservada}</p> : null
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className={`rounded-xl p-2 ${a.disponible > 0 ? 'bg-emerald-500/10' : 'bg-zinc-800'}`}>
                                <p className={a.disponible > 0 ? 'text-emerald-400' : 'text-zinc-500'}>Disponible</p>
                                <p className={`font-bold text-lg ${a.disponible > 0 ? 'text-emerald-300' : 'text-zinc-500'}`}>{a.disponible}</p>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1 text-[10px] text-zinc-500 border-t border-white/5 pt-2">
                              <span>ðŸª Panadería: <strong className="text-zinc-300">{a.stock_panaderia}</strong></span>
                              <div className="flex gap-2 flex-wrap">
                                {Object.entries(a.stock_repartidores || {}).map(([id, rep]: [string, any]) => 
                                  <span key={id}>Ã°Å¸Å¡  Rep {id}: <strong className="text-zinc-300">{rep.cantidad}</strong></span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Paginación */}
                      {Math.ceil(filteredDepositoArticulos.length / 10) > 1 && (
                        <div className="flex items-center justify-center gap-4 py-4">
                          <button onClick={() => setDepositoPageStock(p => Math.max(1, p - 1))} disabled={depositoPageStock === 1}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm disabled:opacity-30 transition-colors">
                            Anterior
                          </button>
                          <span className="text-xs text-zinc-500">
                            Pág {depositoPageStock} de {Math.ceil(filteredDepositoArticulos.length / 10)}
                          </span>
                          <button onClick={() => setDepositoPageStock(p => Math.min(Math.ceil(filteredDepositoArticulos.length / 10), p + 1))} disabled={depositoPageStock === Math.ceil(filteredDepositoArticulos.length / 10)}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm disabled:opacity-30 transition-colors">
                            Siguiente
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── Sub-tab: Materia Prima ── */}
              {!loadingDeposito && depositoSubTab === 'mp' && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2 justify-between mb-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input type="text" placeholder="Buscar materia prima..." value={depositoSearchMP} onChange={e => { setDepositoSearchMP(e.target.value); setDepositoPageMP(1); }}
                        className="w-full h-10 pl-9 pr-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:border-brand-red outline-none" />
                    </div>
                    <div className="flex justify-end shrink-0">
                      <button onClick={() => { setDepositoModal('entrada'); setDepositoModalItem({ tipo: 'materia_prima' }); }}
                        className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-500/20 transition-colors">
                        + Registrar Entrada MP
                      </button>
                    </div>
                  </div>
                  {filteredDepositoMP.length === 0 ? (
                    <p className="text-center text-zinc-500 text-sm py-8">No se encontraron materias primas.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {filteredDepositoMP.slice((depositoPageMP - 1) * 10, depositoPageMP * 10).map(mp => (
                          <div key={mp.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                            <div className="flex justify-between items-start">
                              <p className="font-semibold text-sm text-white">{mp.nombre}</p>
                              <div className="flex flex-wrap gap-1.5 shrink-0 justify-end">
                                <button onClick={() => { setDepositoModal('entrada'); setDepositoModalItem(mp); }}
                                  className="text-[10px] px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors">+ Ent</button>
                                <button onClick={() => { setDepositoModal('salida_mp'); setDepositoModalItem(mp); }}
                                  className="text-[10px] px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors shrink-0">
                                    Salida
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-center text-xs">
                              <div className="bg-black/20 rounded-xl p-2">
                                <p className="text-zinc-400">En Depósito</p>
                                <div className="text-center pt-1"><InlineStockEdit id={mp.id} initialStock={mp.stock_deposito} onSave={handleInlineAjusteMP} /></div>
                                <p className="text-xs text-brand-yellow font-bold mt-0.5">{mp.unidad_medida || 'bolsas'}</p>
                                {mp.peso > 0 && (
                                  <p className="text-[10px] text-zinc-500 font-mono">({(mp.stock_deposito * mp.peso).toFixed(1).replace('.0', '')} kg)</p>
                                )}
                              </div>
                              <div className="bg-zinc-800 rounded-xl p-2">
                                <p className="text-zinc-500">En Uso / Panadería</p>
                                <p className="font-bold text-zinc-300 text-lg mt-1">{mp.stock_uso} <span className="text-xs text-brand-yellow font-bold">{mp.unidad_medida || 'bolsas'}</span></p>
                                {mp.peso > 0 && (
                                  <p className="text-[10px] text-zinc-500 font-mono">({(mp.stock_uso * mp.peso).toFixed(1).replace('.0', '')} kg)</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Paginación MP */}
                      {Math.ceil(filteredDepositoMP.length / 10) > 1 && (
                        <div className="flex items-center justify-center gap-4 py-4">
                          <button onClick={() => setDepositoPageMP(p => Math.max(1, p - 1))} disabled={depositoPageMP === 1}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm disabled:opacity-30 transition-colors">
                            Anterior
                          </button>
                          <span className="text-xs text-zinc-500">
                            Pág {depositoPageMP} de {Math.ceil(filteredDepositoMP.length / 10)}
                          </span>
                          <button onClick={() => setDepositoPageMP(p => Math.min(Math.ceil(filteredDepositoMP.length / 10), p + 1))} disabled={depositoPageMP === Math.ceil(filteredDepositoMP.length / 10)}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm disabled:opacity-30 transition-colors">
                            Siguiente
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── Sub-tab: Reservas Pendientes ── */}
              {!loadingDeposito && depositoSubTab === 'reservas' && (
                <div className="space-y-3">
                  {depositoReservasPendientes.length === 0 ? (
                    <p className="text-center text-zinc-500 text-sm py-8">No hay reservas pendientes de aprobación.</p>
                  ) : (
                    depositoReservasPendientes.map(r => (
                      <div key={r.id} className="rounded-2xl border border-brand-yellow/20 bg-brand-yellow/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-sm text-white">{r.item_nombre}</p>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            Móvil {r.vehiculo_solicitante} · {r.solicitante} · {r.created_at}
                          </p>
                          {r.motivo && <p className="text-xs text-zinc-500 mt-0.5 italic">"{r.motivo}"</p>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-brand-yellow">{r.cantidad} u.</span>
                          <button onClick={async () => {
                            try {
                              const res = await fetch(`${API_URL}/deposito/reservas/${r.id}/aprobar`, {
                                method: 'POST', headers: { Authorization: `Bearer ${token}` }
                              });
                              const data = await res.json();
                              if (data.success) { fetchDeposito(); } else { alert(data.message); }
                            } catch { alert('Error de conexión'); }
                          }} className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-semibold hover:bg-emerald-500/30 transition-colors">
                            ✓ Aprobar
                          </button>
                          <button onClick={async () => {
                            try {
                              const res = await fetch(`${API_URL}/deposito/reservas/${r.id}/cancelar`, {
                                method: 'POST', headers: { Authorization: `Bearer ${token}` }
                              });
                              const data = await res.json();
                              if (data.success) { fetchDeposito(); } else { alert(data.message); }
                            } catch { alert('Error de conexión'); }
                          }} className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-semibold hover:bg-red-500/20 transition-colors">
                            ✕ Rechazar
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ── Sub-tab: Historial ── */}
              {depositoSubTab === 'historial' && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2 justify-between mb-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input type="text" placeholder="Buscar por nombre..." value={depositoHistorySearch} onChange={e => { setDepositoHistorySearch(e.target.value); setDepositoHistoryPage(1); }}
                        className="w-full h-10 pl-9 pr-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:border-brand-red outline-none" />
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input type="date" value={depositoHistoryDate} onChange={e => { setDepositoHistoryDate(e.target.value); setDepositoHistoryPage(1); }}
                          className="h-10 pl-9 pr-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:border-brand-red outline-none [color-scheme:dark]" />
                      </div>
                      <button
                        type="button"
                        onClick={() => fetchDepositoMovimientos()}
                        className="h-10 px-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-zinc-300 hover:text-white transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                        title="Recargar historial"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Actualizar</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {depositoMovimientos.length === 0 ? (
                      <p className="text-center text-zinc-500 text-sm py-8">Sin movimientos registrados.</p>
                    ) : (
                      depositoMovimientos.map((m: any) => {
                        const icons: Record<string, string> = {
                          entrada: '📦', distribucion: '→', reserva: '🔒', cancelar_reserva: '🔓', salida_mp: '🧪'
                        };
                        const colors: Record<string, string> = {
                          entrada: 'text-emerald-400', distribucion: 'text-blue-400',
                          reserva: 'text-brand-yellow', cancelar_reserva: 'text-zinc-400', salida_mp: 'text-red-400'
                        };
                        return (
                          <div key={m.id} className="rounded-xl border border-white/5 bg-white/5 p-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{icons[m.tipo_movimiento] ?? '•'}</span>
                              <div>
                                <p className={`text-xs font-semibold ${colors[m.tipo_movimiento] ?? 'text-white'}`}>
                                  {m.tipo_movimiento.replace(/_/g, ' ').toUpperCase()} · {m.destino}
                                </p>
                                <p className="text-xs text-zinc-400">{m.item_nombre}</p>
                                {m.motivo && <p className="text-[10px] text-zinc-600 italic">"{m.motivo}"</p>}
                                <p className="text-[10px] text-zinc-500 mt-1">👤 {m.user?.name || 'Sistema'}</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0 flex flex-col items-end justify-center">
                              <p className="font-bold text-white">{m.cantidad} u.</p>
                              <p className="text-[10px] text-zinc-500 mb-1">{m.fecha} · {m.user}</p>
                              {m.tipo_movimiento === 'entrada' && (
                                <button 
                                  onClick={() => { setDepositoModal('editar_entrada'); setDepositoModalItem(m); }}
                                  className="text-[10px] text-zinc-400 hover:text-brand-yellow flex items-center gap-1 transition-colors"
                                >
                                  <Edit2 className="w-3 h-3" /> Editar
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Paginación Historial */}
                  {depositoHistoryTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-4 py-4">
                      <button onClick={() => setDepositoHistoryPage(p => Math.max(1, p - 1))} disabled={depositoHistoryPage === 1}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm disabled:opacity-30 transition-colors">
                        Anterior
                      </button>
                      <span className="text-xs text-zinc-500">
                        Pág {depositoHistoryPage} de {depositoHistoryTotalPages}
                      </span>
                      <button onClick={() => setDepositoHistoryPage(p => Math.min(depositoHistoryTotalPages, p + 1))} disabled={depositoHistoryPage === depositoHistoryTotalPages}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm disabled:opacity-30 transition-colors">
                        Siguiente
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── Modales de Acción ── */}
              {depositoModal && (
                <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDepositoModal(null)} />
                  <div className="relative w-full max-w-md rounded-t-3xl md:rounded-3xl border-t md:border border-white/10 bg-zinc-950 p-6 pb-10 md:pb-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                    <div className="mx-auto mb-5 h-1 w-12 rounded-full bg-white/20 md:hidden" />
                    <div className="flex items-center justify-between mb-5">
                      <h2 className="text-lg font-bold">
                        {depositoModal === 'entrada' ? '+ Registrar Entrada al Depósito' :
                         depositoModal === 'editar_entrada' ? 'Editar Entrada (ID: ' + depositoModalItem?.id + ')' :
                         depositoModal === 'distribuir' ? '→ Distribuir desde Depósito' :
                         depositoModal === 'devolucion' ? 'Ã¢ €   Devolver al Depósito' :
                         'Ã¢ €  €œ Salida de Materia Prima'}
                      </h2>
                      <button onClick={() => setDepositoModal(null)} className="p-2 rounded-full bg-white/5 border border-white/10">
                        <X className="h-4 w-4 text-zinc-400" />
                      </button>
                    </div>
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      const fd = new FormData(e.target as HTMLFormElement);
                      const itemId = fd.get('item_id');
                      if (depositoModal !== 'editar_entrada' && !itemId) {
                        alert('Por favor seleccioná un ítem');
                        return;
                      }
                      const body: any = {
                        tipo_item: fd.get('tipo_item'),
                        item_id: itemId,
                        motivo: fd.get('motivo') || undefined,
                      };

                      if (depositoModal === 'distribuir' || depositoModal === 'devolucion') {
                        body.cantidad_panaderia = fd.get('cantidad_panaderia') ? parseFloat(fd.get('cantidad_panaderia') as string) : 0;
                        body.repartidor_id = fd.get('repartidor_id') ? parseInt(fd.get('repartidor_id') as string) : null;
                        body.qty_repartidor = fd.get('qty_repartidor') ? parseFloat(fd.get('qty_repartidor') as string) : 0;
                      } else {
                        body.cantidad = parseFloat(fd.get('cantidad') as string);
                      }

                      const url = depositoModal === 'entrada' ? `${API_URL}/deposito/entrada` :
                                  depositoModal === 'editar_entrada' ? `${API_URL}/deposito/movimientos/${depositoModalItem.id}` :
                                  depositoModal === 'distribuir' ? `${API_URL}/deposito/distribuir` :
                                  depositoModal === 'devolucion' ? `${API_URL}/deposito/devolucion` :
                                  `${API_URL}/deposito/mp/salida`;
                      const method = depositoModal === 'editar_entrada' ? 'PUT' : 'POST';
                      try {
                        const res = await fetch(url, {
                          method,
                          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', Authorization: `Bearer ${token}` },
                          body: JSON.stringify(body),
                        });
                        const data = await res.json();
                        if (data.success) { 
                          setDepositoModal(null); 
                          fetchDeposito(); 
                          if (depositoSubTab === 'historial') fetchDepositoMovimientos();
                        }
                        else { alert(data.message || 'Error'); }
                      } catch { alert('Error de conexión'); }
                    }} className="space-y-4">
                      {/* Selección de ítem */}
                      <div>
                        <label className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5 block">
                          {depositoModal === 'salida_mp' ? 'Materia Prima' : 'Producto'}
                        </label>
                        {depositoModal === 'editar_entrada' ? (
                          <div className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 flex items-center text-sm text-zinc-300">
                            {depositoModalItem?.item_nombre}
                          </div>
                        ) : depositoModalSelectedId && depositoModalSelectedItemObj ? (
                          <div className="flex items-center justify-between w-full p-3 rounded-xl bg-white/5 border border-white/10">
                            <div className="min-w-0 flex-1 pr-2">
                              <p className="text-sm font-semibold text-white truncate">{depositoModalSelectedItemObj.nombre}</p>
                              <p className="text-xs text-zinc-400">
                                En depósito: <strong className="text-emerald-400">{depositoModalSelectedItemObj.stock_deposito} {depositoModalSelectedItemObj.unidad_medida || 'unidades'}</strong>
                              </p>
                            </div>
                            {!depositoModalItem?.id && (
                              <button
                                type="button"
                                onClick={() => { setDepositoModalSelectedId(''); setDepositoModalItemSearch(''); }}
                                className="text-xs px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-brand-yellow transition-colors shrink-0"
                              >
                                Cambiar
                              </button>
                            )}
                            <input type="hidden" name="item_id" value={depositoModalSelectedId} />
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                              <input
                                type="text"
                                placeholder={`Buscar ${depositoModal === 'salida_mp' || depositoModalItem?.tipo === 'materia_prima' ? 'materia prima' : 'producto'}...`}
                                value={depositoModalItemSearch}
                                onChange={e => setDepositoModalItemSearch(e.target.value)}
                                className="w-full h-11 pl-9 pr-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:border-brand-red outline-none"
                                autoFocus
                              />
                            </div>
                            <div className="max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-black/40 divide-y divide-white/5">
                              {depositoModalItemsList
                                .filter(item => {
                                  const term = depositoModalItemSearch.toLowerCase().trim();
                                  if (!term) return true;
                                  const name = (item.nombre || item.producto || '').toLowerCase();
                                  return name.includes(term);
                                })
                                .map(item => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setDepositoModalSelectedId(item.id)}
                                    className="w-full text-left px-4 py-2.5 hover:bg-white/10 flex justify-between items-center text-sm transition-colors"
                                  >
                                    <span className="text-zinc-200 font-medium truncate mr-2">{item.nombre}</span>
                                    <span className="text-xs text-zinc-400 shrink-0">
                                      depósito: <strong className="text-emerald-400">{item.stock_deposito} {item.unidad_medida || ''}</strong>
                                    </span>
                                  </button>
                                ))
                              }
                              {depositoModalItemsList.filter(item => (item.nombre || item.producto || '').toLowerCase().includes(depositoModalItemSearch.toLowerCase().trim())).length === 0 && (
                                <p className="text-center text-zinc-500 text-xs py-4">No se encontraron ítems</p>
                              )}
                            </div>
                            <input type="hidden" name="item_id" value="" />
                          </div>
                        )}
                        <input type="hidden" name="tipo_item" value={depositoModal === 'salida_mp' || depositoModalItem?.tipo === 'materia_prima' ? 'materia_prima' : 'articulo'} />
                      </div>
                      
                      {/* Cantidades (distribuir o devolucion) */}
                      {(depositoModal === 'distribuir' || depositoModal === 'devolucion') && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5 block">Panadería</label>
                            <input name="cantidad_panaderia" type="number" step="0.01" min="0" placeholder="0"
                              defaultValue={depositoModal === 'devolucion' && depositoModalItem ? depositoModalItem.stock_panaderia : undefined}
                              className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white outline-none focus:border-brand-yellow" />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5 block">Repartidor (opcional)</label>
                            <div className="flex gap-2">
                              <select name="repartidor_id" className="flex-1 h-11 rounded-xl bg-white/5 border border-white/10 px-2 text-sm text-white outline-none focus:border-emerald-500">
                                <option value="">Seleccione...</option>
                                {repartidores.map(r => (
                                  <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                              </select>
                              <input name="qty_repartidor" type="number" step="0.01" min="0" placeholder="Cant."
                                className="w-20 h-11 rounded-xl bg-white/5 border border-white/10 px-2 text-center text-sm text-emerald-300 outline-none focus:border-emerald-500" />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Cantidad Única (solo entrada o salida mp) */}
                      {(depositoModal === 'entrada' || depositoModal === 'editar_entrada' || depositoModal === 'salida_mp') && (
                        <div>
                          <label className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5 block">Cantidad</label>
                          <input name="cantidad" type="number" step="0.01" min="0.01" required placeholder="Ej: 100"
                            defaultValue={depositoModal === 'editar_entrada' ? depositoModalItem?.cantidad : undefined}
                            className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white outline-none focus:border-brand-red" />
                        </div>
                      )}
                      {/* Motivo */}
                      <div>
                        <label className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5 block">
                          Motivo / Nota {depositoModal === 'salida_mp' ? '(obligatorio)' : '(opcional)'}
                        </label>
                        <input name="motivo" type="text" required={depositoModal === 'salida_mp'} placeholder="Ej: Compra proveedor XYZ / producción del lunes"
                          defaultValue={depositoModal === 'editar_entrada' ? depositoModalItem?.motivo : undefined}
                          className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white outline-none focus:border-brand-red" />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setDepositoModal(null)}
                          className="flex-1 py-3.5 rounded-xl border border-white/10 text-zinc-300 font-semibold active:scale-95 text-sm">Cancelar</button>
                        <button type="submit"
                          className="flex-1 bg-brand-red text-white py-3.5 rounded-xl font-bold active:scale-95 text-sm">Confirmar</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* ── DESPACHO A REPARTIDOR ── */}
          {activeTab === "despacho" && isAdmin && (
            <div className="p-4">
              <DespachoRepartidor 
                repartidores={repartidores} 
                articulos={depositoArticulos} 
                token={token!} 
                apiUrl={API_URL} 
                onSuccess={() => { fetchDeposito(); }} 
              />
            </div>
          )}

          {/* ── USUARIOS CRUD ── */}
          {activeTab === "usuarios" && isAdmin && (
            <div className="p-4">
              <UsuariosCrud token={token!} apiUrl={API_URL} />
            </div>
          )}

          {/* ── COMPRAS ── */}
          {activeTab === "compras" && isAdmin && (
            <div className="p-4">
              <ComprasApp token={token!} />
            </div>
          )}

          {/* ── MIS VENTAS ── */}
          {activeTab === "ventas" && (
            <div className="space-y-4">
              
              {/* Banner de Mi Turno / Caja (Solo visible para perfil Vendedor) */}
              {isVendedor && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-white flex items-center gap-2">
                      {cajaTurnoActivo ? <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> : <span className="w-2 h-2 rounded-full bg-red-500" />}
                      {cajaTurnoActivo ? "Caja Abierta" : "Caja Cerrada"}
                    </h3>
                    <p className="text-sm text-zinc-400">
                      {cajaTurnoActivo 
                        ? `Abierta hoy a las ${new Date(cajaTurnoActivo.fecha_apertura).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})} hs`
                        : "La caja se encuentra cerrada. Puedes abrirla para registrar el monto inicial."}
                    </p>
                  </div>
                  <div>
                    {cajaTurnoActivo ? (
                      <button onClick={() => setCajaTurnoModal('cerrar')} className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-xl font-bold text-sm transition-colors">
                        Cerrar Caja
                      </button>
                    ) : (
                      <button onClick={() => {
                        setCajaTurnoModal('abrir');
                        const now = new Date();
                        const tzOffset = now.getTimezoneOffset() * 60000;
                        setCajaFechaApertura(new Date(Date.now() - tzOffset).toISOString().slice(0, 16));
                      }} className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-xl font-bold text-sm transition-colors">
                        Abrir Caja
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h1 className="text-2xl font-bold">Historial {isAdmin ? "(Admin)" : ""}</h1>
                  
                  {/* Selector de tipo de filtro */}
                  <div className="flex bg-black/20 p-1 rounded-xl border border-white/5 self-start sm:self-auto">
                    {(['day', 'range', 'month'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => { setHistoryFilterType(t); setHistoryPage(1); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          historyFilterType === t ? 'bg-brand-red text-white' : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {t === 'day' ? 'Día' : t === 'range' ? 'Período' : 'Mes'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Controles de fecha según el tipo de filtro */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {historyFilterType === 'day' && (
                    <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus-within:border-brand-red transition-colors w-full sm:w-60">
                      <Calendar className="w-4 h-4 text-brand-yellow shrink-0" />
                      <input
                        type="date"
                        value={historyDate}
                        onChange={(e) => { setHistoryDate(e.target.value); setHistoryPage(1); }}
                        className="bg-transparent text-sm font-semibold outline-none text-white w-full [&::-webkit-calendar-picker-indicator]:invert"
                      />
                    </div>
                  )}

                  {historyFilterType === 'range' && (
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                      <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus-within:border-brand-red transition-colors w-full sm:w-48">
                        <span className="text-xs text-zinc-500 font-semibold shrink-0">Desde:</span>
                        <input
                          type="date"
                          value={historyStartDate}
                          onChange={(e) => { setHistoryStartDate(e.target.value); setHistoryPage(1); }}
                          className="bg-transparent text-sm font-semibold outline-none text-white w-full [&::-webkit-calendar-picker-indicator]:invert"
                        />
                      </div>
                      <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus-within:border-brand-red transition-colors w-full sm:w-48">
                        <span className="text-xs text-zinc-500 font-semibold shrink-0">Hasta:</span>
                        <input
                          type="date"
                          value={historyEndDate}
                          onChange={(e) => { setHistoryEndDate(e.target.value); setHistoryPage(1); }}
                          className="bg-transparent text-sm font-semibold outline-none text-white w-full [&::-webkit-calendar-picker-indicator]:invert"
                        />
                      </div>
                    </div>
                  )}

                  {historyFilterType === 'month' && (
                    <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus-within:border-brand-red transition-colors w-full sm:w-60">
                      <Calendar className="w-4 h-4 text-brand-yellow shrink-0" />
                      <input
                        type="month"
                        value={historyMonthYear}
                        onChange={(e) => { setHistoryMonthYear(e.target.value); setHistoryPage(1); }}
                        className="bg-transparent text-sm font-semibold outline-none text-white w-full [&::-webkit-calendar-picker-indicator]:invert"
                      />
                    </div>
                  )}
                </div>
              </div>

              {isAdmin && (
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input value={historySearch} onChange={e => { setHistorySearch(e.target.value); setHistoryPage(1); }} placeholder="Buscar por cliente..."
                      className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 pl-11 pr-4 text-sm outline-none placeholder:text-zinc-500 focus:border-brand-red text-white" />
                  </div>
                  <div className="relative">
                    <select value={historyType} onChange={e => { setHistoryType(e.target.value); setHistoryPage(1); }}
                      className="h-11 rounded-2xl border border-white/10 bg-white/5 pl-4 pr-10 text-sm outline-none focus:border-brand-red text-white sm:w-48 appearance-none">
                      <option value="todas" className="bg-zinc-900">Todos</option>
                      <option value="ventas" className="bg-zinc-900">Solo Ventas</option>
                      <option value="cobros" className="bg-zinc-900">Solo Cobros</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                  </div>
                </div>
              )}

              {isAdmin && (
                <div className="flex bg-black/20 p-1 rounded-xl border border-white/5 w-full sm:w-fit flex-wrap">
                  <button onClick={() => setHistoryTab('movimientos')}
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${historyTab === 'movimientos' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                    <ClipboardList className="w-4 h-4" /> Movimientos
                  </button>
                  <button onClick={() => setHistoryTab('estadisticas')}
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${historyTab === 'estadisticas' ? 'bg-brand-red/20 text-brand-yellow' : 'text-zinc-500 hover:text-zinc-300'}`}>
                    <PieChartIcon className="w-4 h-4" /> Estadísticas
                  </button>
                  <button onClick={() => { setHistoryTab('cierres'); fetchCierres(); }}
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${historyTab === 'cierres' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}>
                    <Archive className="w-4 h-4" /> Cierres de Caja
                  </button>
                </div>
              )}

              {historyTab === 'movimientos' || !isAdmin ? (
                <>
                  {isAdmin && historyCajas.length > 0 && (
                    <div className="mb-6 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Cajas (Panadería y Móviles)</h3>
                        <span className="text-xs text-zinc-500 font-medium">{historyCajas.length} activas</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {historyCajas.map((caja: any) => {
                          const isPanaderia = caja.tipo_caja === 'panaderia';
                          return (
                            <div
                              key={caja.caja_id || caja.user_id}
                              onClick={() => setSelectedCaja(caja)}
                              className={`rounded-2xl border p-4 space-y-2 cursor-pointer transition-all active:scale-[0.98] ${
                                isPanaderia 
                                  ? 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/50' 
                                  : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                              }`}>
                              <div className="flex justify-between items-center mb-2 pb-2 border-b border-white/10">
                                <p className="font-bold text-white truncate">{caja.user_name}</p>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                  isPanaderia ? 'bg-amber-400/20 text-amber-300' : 'bg-blue-400/20 text-blue-300'
                                }`}>
                                  {isPanaderia ? 'Local / Mostrador' : 'Móvil / Reparto'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-zinc-400">💵 Efectivo a Rendir</span>
                                <span className="font-bold text-emerald-400">${caja.total_efectivo.toLocaleString('es-AR')}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-zinc-400">🏦 Transferencias</span>
                                <span className="font-bold text-blue-400">${caja.total_transferencia.toLocaleString('es-AR')}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-zinc-400">📝 Pendiente (Fiado)</span>
                                <span className="font-bold text-red-400">${caja.total_saldo.toLocaleString('es-AR')}</span>
                              </div>
                              <div className="flex justify-between items-center text-xs pt-2 mt-2 border-t border-white/5">
                                <span className="text-zinc-500">🛒 Total Vendido</span>
                                <span className="font-semibold text-zinc-300">
                                  ${caja.total_facturado.toLocaleString('es-AR')}
                                  {caja.total_movimientos !== undefined && (
                                    <span className="text-zinc-500 ml-1.5 font-normal">({caja.total_movimientos} mov.)</span>
                                  )}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-xs pt-1">
                                <span className="text-zinc-500">Ticket Promedio</span>
                                <span className="font-semibold text-emerald-400">
                                  ${caja.total_movimientos > 0 ? Math.round(caja.total_facturado / caja.total_movimientos).toLocaleString('es-AR') : 0}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Resumen General */}
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                      {isAdmin ? 'Totales Generales' : 'Tu Caja'}
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div 
                        onClick={() => setHistoryActiveFilter({ type: 'payment', value: 'efectivo' })}
                        className={`rounded-2xl bg-emerald-500/10 border p-4 col-span-2 cursor-pointer transition-all hover:bg-emerald-500/20 ${historyActiveFilter?.type === 'payment' && historyActiveFilter.value === 'efectivo' ? 'border-emerald-400 ring-2 ring-emerald-400/50 shadow-lg shadow-emerald-400/20' : 'border-emerald-500/20'}`}>
                        <p className="text-sm text-emerald-400/80 mb-1">💵 Efectivo en Mano (A Rendir)</p>
                        <p className="text-3xl font-bold text-emerald-400">${historyTotalEfectivo.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </div>
                      <div 
                        onClick={() => setHistoryActiveFilter({ type: 'payment', value: 'transferencia' })}
                        className={`rounded-2xl bg-blue-500/10 border p-3 cursor-pointer transition-all hover:bg-blue-500/20 ${historyActiveFilter?.type === 'payment' && historyActiveFilter.value === 'transferencia' ? 'border-blue-400 ring-2 ring-blue-400/50 shadow-lg shadow-blue-400/20' : 'border-blue-500/20'}`}>
                        <p className="text-xs text-blue-400/80">🏦 Transferencias</p>
                        <p className="text-lg font-bold text-blue-400">${historyTotalTransferencia.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </div>
                      <div 
                        onClick={() => setHistoryActiveFilter({ type: 'payment', value: 'saldo' })}
                        className={`rounded-2xl bg-red-500/10 border p-3 cursor-pointer transition-all hover:bg-red-500/20 ${historyActiveFilter?.type === 'payment' && historyActiveFilter.value === 'saldo' ? 'border-red-400 ring-2 ring-red-400/50 shadow-lg shadow-red-400/20' : 'border-red-500/20'}`}>
                        <p className="text-xs text-red-400/80">📝 Fiado / Cuenta Corriente</p>
                        <p className="text-lg font-bold text-red-400">${historyTotalSaldo.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <p className="text-xs text-zinc-500">Total Facturado (Referencia): ${historyTotalFacturado.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white">Detalle de Movimientos</h3>
                    {historyActiveFilter && (
                      <button 
                        onClick={() => setHistoryActiveFilter(null)}
                        className="text-xs bg-white/10 hover:bg-brand-red/20 text-zinc-300 hover:text-brand-yellow px-3 py-1.5 rounded-full transition-colors flex items-center gap-1">
                        <X className="w-3 h-3" /> Limpiar Filtro
                      </button>
                    )}
                  </div>

                  {misVentas.length === 0 && !loadingHistory ? (
                    <p className="text-center text-zinc-500 text-sm mt-10">No hay movimientos que coincidan con el filtro actual.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {misVentas.map(v => {
                        const isCobro = v.tipo === "cobro_cuenta";
                        const isSalida = v.tipo === "pago_proveedor" || v.tipo === "salida" || (typeof v.tipo === "string" && v.tipo.startsWith("pago_"));
                        return (
                          <div
                            key={`${v.tipo}-${v.id}`}
                            onClick={() => setSelectedVenta(v)}
                            className="rounded-2xl border border-white/10 bg-white/5 p-3 flex items-center justify-between hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer"
                          >
                            <div className="flex-1 min-w-0 mr-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 truncate">
                                  <p className="text-sm font-semibold truncate text-white">{v.customer}</p>
                                  {isSalida && (
                                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold shrink-0 ${
                                      !v.impacta_caja 
                                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                        : "bg-red-500/20 text-red-300 border border-red-500/30"
                                    }`}>
                                      {!v.impacta_caja ? "Sin impacto" : "Salida caja"}
                                    </span>
                                  )}
                                </div>
                                {!isSalida && !isCobro && (
                                  <div className="relative group/dl" onClick={e => e.stopPropagation()}>
                                    <button
                                      className="p-1.5 bg-white/10 rounded-md hover:bg-white/20 transition-colors shrink-0"
                                      title="Descargar Comprobante"
                                    >
                                      <Download className="w-3.5 h-3.5 text-zinc-300" />
                                    </button>
                                    <div className="absolute bottom-full right-0 mb-2 hidden group-focus-within/dl:flex flex-col bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-20 min-w-[155px]">
                                      <button
                                        onClick={async () => {
                                          try {
                                            const res = await fetch(`${API_URL}/pedidos/${v.id}/comprobante?doble=false`, { headers: { Authorization: `Bearer ${token}` } });
                                            if (res.ok) {
                                              const blob = await res.blob();
                                              const url = window.URL.createObjectURL(blob);
                                              const a = document.createElement("a");
                                              a.href = url; a.download = `Remito_${v.id}.pdf`;
                                              document.body.appendChild(a); a.click(); a.remove();
                                              window.URL.revokeObjectURL(url);
                                            } else alert("Error al descargar");
                                          } catch { alert("Error de conexión"); }
                                        }}
                                        className="px-3 py-2 text-xs text-left hover:bg-white/10 text-zinc-300 transition-colors">
                                        📄 Simple
                                      </button>
                                      <button
                                        onClick={async () => {
                                          try {
                                            const res = await fetch(`${API_URL}/pedidos/${v.id}/comprobante?doble=true`, { headers: { Authorization: `Bearer ${token}` } });
                                            if (res.ok) {
                                              const blob = await res.blob();
                                              const url = window.URL.createObjectURL(blob);
                                              const a = document.createElement("a");
                                              a.href = url; a.download = `Remito_Doble_${v.id}.pdf`;
                                              document.body.appendChild(a); a.click(); a.remove();
                                              window.URL.revokeObjectURL(url);
                                            } else alert("Error al descargar");
                                          } catch { alert("Error de conexión"); }
                                        }}
                                        className="px-3 py-2 text-xs text-left hover:bg-white/10 text-zinc-300 border-t border-white/5 transition-colors">
                                        📄📄 Doble
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <p className="text-xs text-zinc-400 mt-0.5 truncate">
                                {isSalida
                                  ? `${v.hora} · ${v.tipo === 'pago_proveedor' ? 'Pago a Proveedor' : 'Salida'} · ${v.forma_pago || 'Efectivo'}${v.descripcion ? ` · ${v.descripcion}` : ''}`
                                  : isCobro
                                    ? `${v.hora} · Cobro · Efectivo`
                                    : `${v.hora} · ${v.tipo === "pedido" ? "Pedido" : "Venta"} · ${v.forma_pago || 'Efectivo'}`
                                }
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`text-sm font-bold ${
                                isSalida ? "text-amber-400" :
                                isCobro ? "text-emerald-400" : "text-white"
                              }`}>
                                {isSalida ? "-" : isCobro ? "+" : ""}${((isSalida || isCobro) ? v.pago : (v.total > 0 ? v.total : v.pago)).toLocaleString('es-AR')}
                              </p>
                              {isSalida ? (
                                <p className={`text-xs font-semibold ${!v.impacta_caja ? "text-amber-400" : "text-red-400"}`}>
                                  {!v.impacta_caja ? "Sin impacto" : "Salida"}
                                </p>
                              ) : isCobro ? (
                                <p className="text-xs text-emerald-500 font-semibold">Cobrado</p>
                              ) : (
                                v.saldo > 0
                                  ? <p className="text-xs text-red-400">Debe ${v.saldo.toLocaleString('es-AR')}</p>
                                  : <p className="text-xs text-emerald-400">Pagado</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Infinite scroll sentinel */}
                  {historyHasMore && (
                    <div ref={historyLoaderRef} className="flex justify-center py-4">
                      <RefreshCw className="w-5 h-5 text-zinc-500 animate-spin" />
                    </div>
                  )}
                  {loadingHistory && misVentas.length === 0 && (
                    <div className="flex justify-center py-10"><RefreshCw className="w-6 h-6 text-brand-red animate-spin" /></div>
                  )}
                </>
              ) : historyTab === 'estadisticas' ? (
                <div className="space-y-6">
                  {productStats.length === 0 ? (
                    <p className="text-center text-zinc-500 text-sm mt-10">Sin ventas de productos de reparto en esta fecha.</p>
                  ) : (
                    <>
                      <div className="h-64 md:h-80 bg-white/5 border border-white/10 rounded-3xl p-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={productStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                            <XAxis dataKey="name" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                            <RechartsTooltip 
                              cursor={{fill: '#ffffff05'}}
                              contentStyle={{backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px'}} 
                              itemStyle={{color: '#f97316'}}
                            />
                            <Bar dataKey="total_cantidad" name="Cantidad Vendida" fill="#f97316" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="total_cambios" name="Cambios / Roturas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {productStats.map(stat => (
                          <div key={stat.name} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-bold truncate text-white max-w-[150px]">{stat.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-md">{stat.total_cantidad} vendidas</span>
                                {Number(stat.total_cambios) > 0 && (
                                  <span className="text-xs font-semibold text-red-400 bg-red-400/10 px-2 py-0.5 rounded-md">{stat.total_cambios} cambios</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-brand-yellow">${Number(stat.total_monto).toLocaleString('es-AR', {minimumFractionDigits: 2})}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {clientStats && clientStats.top_clientes.length > 0 && (
                        <div className="mt-10 border-t border-white/10 pt-8">
                          <h3 className="text-lg font-bold text-white mb-4">🏆 Top 10 Clientes</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {clientStats.top_clientes.map((c, i) => (
                              <div key={c.name} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-brand-red/20 text-brand-yellow flex items-center justify-center font-bold text-sm">
                                    {i + 1}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold truncate text-white max-w-[120px]">{c.name}</p>
                                    <p className="text-xs text-zinc-400">{c.total_compras} compras</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-bold text-emerald-400">${Number(c.total_monto).toLocaleString('es-AR', {minimumFractionDigits: 2})}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {clientStats && clientStats.cambios.length > 0 && (
                        <div className="mt-10 border-t border-white/10 pt-8">
                          <h3 className="text-lg font-bold text-white mb-4">🔄 Cambios y Roturas (Por Cliente)</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {clientStats.cambios.map((cambio, i) => (
                              <div key={i} className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-bold text-white">{cambio.client_name}</p>
                                  <p className="text-xs text-zinc-400">{cambio.product_name}</p>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-semibold text-red-400 bg-red-400/10 px-2 py-1 rounded-md">
                                    {cambio.total_cambio} devueltos
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                /* ── Sub-tab Cierres de Caja ── */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-white">Historial de Cierres de Caja</h3>
                      <p className="text-xs text-zinc-400">Control de turnos, arqueos de mostrador y diferencias de efectivo.</p>
                    </div>
                    <button onClick={fetchCierres} disabled={loadingCierres}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-zinc-300 transition-colors">
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingCierres ? 'animate-spin' : ''}`} />
                      Actualizar
                    </button>
                  </div>

                  {loadingCierres && cierresList.length === 0 ? (
                    <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 text-brand-red animate-spin" /></div>
                  ) : cierresList.length === 0 ? (
                    <div className="text-center py-12 border border-white/5 bg-white/5 rounded-2xl">
                      <Archive className="w-8 h-8 text-zinc-500 mx-auto mb-2 opacity-50" />
                      <p className="text-sm font-semibold text-zinc-400">No hay registros de cierre de caja aún.</p>
                      <p className="text-xs text-zinc-600 mt-1">Cuando abras y cierres un turno de caja, aparecerá listado aquí.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cierresList.map((c: any) => {
                        const isAbierta = c.estado === 'abierta';
                        const fechaAperturaStr = new Date(c.fecha_apertura).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                        const horaAperturaStr = new Date(c.fecha_apertura).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
                        const horaCierreStr = c.fecha_cierre ? new Date(c.fecha_cierre).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : null;
                        const diff = Number(c.diferencia) || 0;

                        return (
                          <div key={c.id} 
                            onClick={() => setSelectedCierreDetail(c)}
                            className="bg-white/5 hover:bg-white/[0.08] border border-white/10 rounded-2xl p-4 transition-all cursor-pointer space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                              <div className="flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full ${isAbierta ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-500'}`} />
                                <span className="font-bold text-white text-sm">
                                  {fechaAperturaStr} · {horaAperturaStr} hs {horaCierreStr ? `a ${horaCierreStr} hs` : '(En curso)'}
                                </span>
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${isAbierta ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-zinc-400'}`}>
                                  {isAbierta ? 'Abierta' : 'Cerrada'}
                                </span>
                              </div>
                              <span className="text-xs text-zinc-400">
                                Cajero: <strong className="text-zinc-200">{c.user?.name || 'Sistema'}</strong>
                              </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                              <div className="bg-black/20 rounded-xl p-2.5">
                                <span className="text-zinc-500 block text-[10px] uppercase font-bold">Monto Apertura</span>
                                <span className="font-bold text-zinc-200 text-sm">${Number(c.monto_apertura || 0).toLocaleString('es-AR')}</span>
                              </div>
                              <div className="bg-black/20 rounded-xl p-2.5">
                                <span className="text-zinc-500 block text-[10px] uppercase font-bold">Ventas Mostrador</span>
                                <span className="font-bold text-brand-yellow text-sm">${Number(c.ventas_panaderia_total || 0).toLocaleString('es-AR')}</span>
                              </div>
                              <div className="bg-black/20 rounded-xl p-2.5">
                                <span className="text-zinc-500 block text-[10px] uppercase font-bold">Efectivo Esperado</span>
                                <span className="font-bold text-zinc-200 text-sm">${Number(c.efectivo_esperado || 0).toLocaleString('es-AR')}</span>
                              </div>
                              <div className="bg-black/20 rounded-xl p-2.5">
                                <span className="text-zinc-500 block text-[10px] uppercase font-bold">Efectivo Real</span>
                                <span className="font-bold text-emerald-400 text-sm">${Number(c.efectivo_real || 0).toLocaleString('es-AR')}</span>
                              </div>
                            </div>

                            {!isAbierta && (
                              <div className="flex items-center justify-between pt-1 text-xs">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-zinc-500">Diferencia de caja:</span>
                                  {diff === 0 ? (
                                    <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">✓ $0 (Exacto)</span>
                                  ) : diff > 0 ? (
                                    <span className="font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">+${diff.toLocaleString('es-AR')} (Sobrante)</span>
                                  ) : (
                                    <span className="font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-md">-${Math.abs(diff).toLocaleString('es-AR')} (Faltante)</span>
                                  )}
                                </div>
                                <span className="text-brand-red text-[11px] font-semibold flex items-center gap-1">Ver desglose completo →</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </main>

        {/* ── Bottom Bar POS / Mayorista ── */}
        {((!isClienteMayorista && activeTab === "pos" && !isVendedor && (!isAdmin || adminPosMode !== "mostrador")) || (isClienteMayorista && activeTab === "cargar_pedido")) && (
          <div className={`fixed bottom-24 md:bottom-8 left-1/2 md:left-[calc(50%+8rem)] z-20 w-[calc(100%-2rem)] max-w-md md:max-w-[calc(100%-18rem)] xl:max-w-6xl -translate-x-1/2 rounded-3xl border border-white/10 bg-black/80 p-4 backdrop-blur-2xl transition-all duration-300 ${
            Number(cartTotal) > 0 ? "scale-100 opacity-100 shadow-2xl shadow-brand-red/20" : "scale-95 opacity-80"
          }`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-zinc-400 font-bold">Total · {cartCount} items</p>
                <h3 className="text-2xl font-bold">${cartTotal}</h3>
              </div>
              {isClienteMayorista ? (
                <button
                  onClick={handleCrearPedidoMayorista}
                  disabled={Number(cartTotal) === 0 || loadingMayoristaPedido}
                  className={`rounded-2xl px-6 py-3.5 text-sm font-bold transition-all duration-300 flex items-center gap-2 ${
                    Number(cartTotal) > 0 && !loadingMayoristaPedido
                      ? "bg-brand-red text-white shadow-xl shadow-brand-red/30 active:scale-95 cursor-pointer"
                      : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  }`}
                >
                  {loadingMayoristaPedido ? (
                    <><RefreshCw className="h-4 w-4 animate-spin" /> Registrando...</>
                  ) : (
                    <>Confirmar Pedido <ChevronRight className="h-4 w-4" /></>
                  )}
                </button>
              ) : (
                <button onClick={() => {
                  if (Number(cartTotal) > 0) {
                    if (editingPedido) {
                      setPedidoCheckout({
                        id: editingPedido.id,
                        items: [],
                        cliente: editingPedido.cliente,
                      });
                    } else {
                      setPedidoCheckout(null);
                    }
                    setCheckoutOpen(true);
                  }
                }}
                  disabled={Number(cartTotal) === 0}
                  className={`rounded-2xl px-6 py-3.5 text-sm font-bold transition-all duration-300 ${
                    Number(cartTotal) > 0 ? "bg-brand-red text-white shadow-xl shadow-brand-red/30 active:scale-95" : "bg-zinc-800 text-zinc-500"
                  }`}>
                  {editingPedido ? "Guardar" : "Cobrar"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── NAV ── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-24 w-full border-t border-white/10 bg-black/70 backdrop-blur-3xl overflow-x-auto overflow-y-visible [&::-webkit-scrollbar]:hidden">
          <div className={`flex items-center gap-6 px-6 h-full ${(isAdmin || isProduccion) ? 'justify-start min-w-max' : 'justify-around w-full'}`}>
            {isClienteMayorista ? (
              <>
                <NavButton icon={ShoppingCart} label="Hacer Pedido" value="cargar_pedido" prominent />
                <NavButton icon={Truck} label="Mis Pedidos" value="pedidos" badge={deliveries.length} />
                <NavButton icon={Receipt} label="Mi Cuenta" value="cuenta" />
              </>
            ) : (
              <>
                {!isProduccion && (
                  <>
                    <NavButton icon={Truck}        label="Pedidos" value="pedidos" badge={deliveries.filter(d => d.status === "Late").length} />
                    {!isVendedor && <NavButton icon={Package} label="Stock" value="stock" />}
                    <NavButton icon={ShoppingCart} label="Venta"   value="pos" prominent />
                    {!isVendedor && <NavButton icon={Users}        label="Personas" value="clientes" />}
                    <NavButton icon={Receipt}      label="Historial" value="ventas" />
                  </>
                )}
                
                {(isAdmin || isProduccion) && (
                  <>
                    {!isProduccion && <div className="w-[1px] h-10 bg-white/10 mx-2"></div>}
                    <NavButton icon={Warehouse}    label="Depósito" value="deposito" badge={depositoReservasPendientes.length} />
                    {isAdmin && <NavButton icon={ClipboardList} label="Materias" value="materias" />}
                    {isAdmin && <NavButton icon={ShoppingCart} label="Compras" value="compras" />}
                    <NavButton icon={CheckCircle2} label="Recetas" value="recetas" />
                    {isAdmin && <NavButton icon={Truck}        label="Despacho" value="despacho" />}
                    {isAdmin && <NavButton icon={UserIcon}     label="Usuarios" value="usuarios" />}
                  </>
                )}
              </>
            )}
          </div>
        </nav>
      </div>
      </div>

      <ProductEditModal
        open={!!editingProduct}
        product={editingProduct}
        categorias={categorias}
        clients={clients}
        token={token}
        onClose={() => setEditingProduct(null)}
        onSaved={() => { fetchAllData(token!, false); setAdminStockRefresh(prev => prev + 1); setEditingProduct(null); }}
        onRefresh={() => { fetchAllData(token!, false); setAdminStockRefresh(prev => prev + 1); }}
      />

      {/* ── Checkout Modal ── */}
      <CheckoutModal
        open={checkoutOpen}
        onClose={() => { setCheckoutOpen(false); setPedidoCheckout(null); }}
        cart={cart}
        products={products}
        token={token!}
        clients={clients}
        pedidoId={pedidoCheckout?.id ?? null}
        pedidoItems={pedidoCheckout?.items}
        pedidoCliente={pedidoCheckout?.cliente ?? null}
        isEditing={!!editingPedido}
        isVendedor={isVendedor}
        onSuccess={() => {
          setCart({});
          setEditingPedido(null);
          fetchAllData(token!, false);
        }}
      />

      {/* ── Categorias Modal ── */}
      <CategoriasModal
        open={categoriasModalOpen}
        onClose={() => setCategoriasModalOpen(false)}
        token={token!}
        onRefresh={() => {
          fetchAllData(token!, false);
          setAdminStockRefresh(prev => prev + 1);
        }}
      />

      {/* ── Cliente Detalle Modal ── */}
      {clienteDetalle && (
        <ClienteDetalleModal
          client={clienteDetalle}
          token={token!}
          onClose={() => setClienteDetalle(null)}
          onCargarPago={(c) => {
            setClienteDetalle(null);
            setPaymentClient(c);
          }}
        />
      )}

      {/* ── Cargar Pago Modal ── */}
      {paymentClient && (
        <CargarPagoModal
          client={paymentClient}
          token={token!}
          onClose={() => setPaymentClient(null)}
          onSuccess={() => {
            setPaymentClient(null);
            fetchAllData(token!, false);
          }}
        />
      )}

      {/* ── Proveedor Detalle Modal ── */}
      {proveedorDetalle && (
        <ProveedorDetalleModal
          proveedor={proveedorDetalle}
          token={token!}
          apiUrl={API_URL}
          onClose={() => setProveedorDetalle(null)}
          onCargarPago={(p) => {
            setProveedorDetalle(null);
            setPaymentProveedor(p);
          }}
        />
      )}

      {/* ── Cargar Pago Proveedor Modal ── */}
      {paymentProveedor && (
        <CargarPagoProveedorModal
          proveedor={paymentProveedor}
          token={token!}
          apiUrl={API_URL}
          onClose={() => setPaymentProveedor(null)}
          onSuccess={() => {
            setPaymentProveedor(null);
            fetchProveedores();
            fetchAllData(token!, false);
            fetchCajaTurno();
            setHistoryRefresh(prev => prev + 1);
          }}
        />
      )}

      {/* ── Persona (CRUD) Modal ── */}
      {editingPersona && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-lg font-bold text-white">
                {editingPersona.idpersona ? "Editar Persona" : (isAdmin ? "Nueva Persona" : "Nuevo Cliente")}
              </h2>
              <button 
                onClick={() => setEditingPersona(null)} 
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
            
            <form onSubmit={handleSavePersona} className="p-4 flex flex-col gap-4 overflow-y-auto">
              {isAdmin && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-400">Tipo de Persona</label>
                  <select 
                    value={personaForm.tipo_persona} 
                    onChange={e => setPersonaForm({...personaForm, tipo_persona: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-brand-red outline-none transition-colors appearance-none"
                    required
                  >
                    <option value="cliente" className="bg-[#1a1a1a] text-white">Cliente</option>
                    <option value="proveedor" className="bg-[#1a1a1a] text-white">Proveedor</option>
                    <option value="empleado" className="bg-[#1a1a1a] text-white">Empleado</option>
                  </select>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400">Nombre Completo *</label>
                <input 
                  type="text"
                  value={personaForm.nombre} 
                  onChange={e => setPersonaForm({...personaForm, nombre: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-brand-red outline-none transition-colors"
                  required 
                  placeholder="Juan Perez"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400">Dirección (Opcional)</label>
                <input 
                  type="text"
                  value={personaForm.direccion} 
                  onChange={e => setPersonaForm({...personaForm, direccion: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-brand-red outline-none transition-colors"
                  placeholder="Av. Falsa 123"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400">Celular (Opcional)</label>
                <input 
                  type="text"
                  value={personaForm.telefono} 
                  onChange={e => setPersonaForm({...personaForm, telefono: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-brand-red outline-none transition-colors"
                  placeholder="3815000000"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400">Email (Opcional)</label>
                <input 
                  type="email"
                  value={personaForm.mail} 
                  onChange={e => setPersonaForm({...personaForm, mail: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-brand-red outline-none transition-colors"
                  placeholder="juan@mail.com"
                />
              </div>

              {isAdmin && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-400">Usuario Asociado (Opcional)</label>
                  <select 
                    value={personaForm.user_id} 
                    onChange={e => setPersonaForm({...personaForm, user_id: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-brand-red outline-none transition-colors appearance-none"
                  >
                    <option value="" className="bg-[#1a1a1a] text-white">-- Sin usuario --</option>
                    {adminUsers.map(u => (
                      <option key={u.id} value={u.id} className="bg-[#1a1a1a] text-white">{u.name} ({u.email})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="mt-2 pt-4 border-t border-white/10 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setEditingPersona(null)}
                  className="flex-1 py-3.5 rounded-xl font-bold bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={savingPersona}
                  className="flex-1 py-3.5 rounded-xl font-bold bg-brand-red hover:bg-red-600 text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {savingPersona && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {savingPersona ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Caja Detail Modal */}
      {selectedCaja && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setSelectedCaja(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md rounded-t-3xl md:rounded-3xl border-t md:border border-white/10 bg-zinc-950 p-6 pb-10 md:pb-6 shadow-2xl overflow-y-auto transition-all duration-300" style={{ maxHeight: "85vh" }} onClick={e => e.stopPropagation()}>
            <div className="mx-auto mb-5 h-1 w-12 rounded-full bg-white/20 md:hidden" />
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedCaja.user_name}</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Resumen de caja y listado de movimientos</p>
              </div>
              <button onClick={() => setSelectedCaja(null)} className="p-2 rounded-full bg-white/5 border border-white/10">
                <X className="h-5 w-5 text-zinc-400" />
              </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              <div 
                onClick={() => setCajaFormaPago(cajaFormaPago === 'efectivo' ? '' : 'efectivo')}
                className={`border rounded-xl p-3 text-center cursor-pointer transition-all ${cajaFormaPago === 'efectivo' ? 'bg-emerald-500/20 border-emerald-400 ring-1 ring-emerald-400' : 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20'}`}>
                <span className="text-[10px] text-emerald-400/80 uppercase block font-semibold mb-1">Efectivo</span>
                <span className="text-sm font-bold text-emerald-400">${selectedCaja.total_efectivo.toLocaleString('es-AR')}</span>
              </div>
              <div 
                onClick={() => setCajaFormaPago(cajaFormaPago === 'transferencia' ? '' : 'transferencia')}
                className={`border rounded-xl p-3 text-center cursor-pointer transition-all ${cajaFormaPago === 'transferencia' ? 'bg-blue-500/20 border-blue-400 ring-1 ring-blue-400' : 'bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20'}`}>
                <span className="text-[10px] text-blue-400/80 uppercase block font-semibold mb-1">Transf.</span>
                <span className="text-sm font-bold text-blue-400">${selectedCaja.total_transferencia.toLocaleString('es-AR')}</span>
              </div>
              <div 
                onClick={() => setCajaFormaPago(cajaFormaPago === 'saldo' ? '' : 'saldo')}
                className={`border rounded-xl p-3 text-center cursor-pointer transition-all ${cajaFormaPago === 'saldo' ? 'bg-red-500/20 border-red-400 ring-1 ring-red-400' : 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20'}`}>
                <span className="text-[10px] text-red-400/80 uppercase block font-semibold mb-1">Fiado</span>
                <span className="text-sm font-bold text-red-400">${selectedCaja.total_saldo.toLocaleString('es-AR')}</span>
              </div>
            </div>
            <div className="mb-6 bg-white/5 border border-white/10 rounded-xl p-3 flex justify-between items-center text-sm">
              <span className="text-zinc-400 uppercase tracking-widest text-[10px] font-bold">🛒 Total Vendido (Facturado)</span>
              <span className="font-bold text-zinc-300">${selectedCaja.total_facturado.toLocaleString('es-AR')}</span>
            </div>

            {/* Sales List Title */}
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs text-zinc-500 uppercase tracking-widest">
                Movimientos ({cajaSales.length})
              </h3>
              {cajaFormaPago && (
                <button
                  onClick={() => setCajaFormaPago('')}
                  className="text-[10px] text-zinc-400 hover:text-white underline">
                  Ver todos
                </button>
              )}
            </div>

            {/* Sales List Container */}
            <div className="space-y-3 max-h-96 md:max-h-[30rem] overflow-y-auto pr-1">
              {loadingCajaSales ? (
                <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-2xl bg-white/5 animate-pulse" />)}</div>
              ) : cajaSales.length === 0 ? (
                <p className="text-center text-zinc-500 text-sm mt-6">Sin movimientos registrados</p>
              ) : (
                <div className="space-y-3">
                  {cajaSales.map(v => {
                    const isCobro = v.tipo === "cobro_cuenta";
                    const isSalida = v.tipo === "pago_proveedor" || v.tipo === "salida" || (typeof v.tipo === "string" && v.tipo.startsWith("pago_"));
                    return (
                      <div
                        key={v.id}
                        onClick={() => {
                          setSelectedVenta(v);
                        }}
                        className="rounded-2xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
                                isSalida
                                  ? (!v.impacta_caja ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-red-500/20 text-red-300 border border-red-500/30")
                                  : isCobro 
                                    ? "bg-emerald-500/20 text-emerald-300"
                                    : v.tipo === "pedido"
                                      ? "bg-purple-500/20 text-purple-300"
                                      : "bg-blue-500/20 text-blue-300"
                              }`}>
                                {isSalida ? (!v.impacta_caja ? "Sin impacto" : "Salida") : isCobro ? "Cobro" : v.tipo === "pedido" ? "Pedido" : "Venta"}
                              </span>
                              <span className="text-xs text-zinc-400">{v.hora} hs</span>
                            </div>
                            <p className="text-sm font-semibold text-white mt-1.5 truncate">{v.customer}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm font-bold ${isSalida ? "text-amber-400" : isCobro ? "text-emerald-400" : "text-white"}`}>
                              {isSalida ? "-" : isCobro ? "+" : ""}${((isSalida || isCobro) ? v.pago : (v.total > 0 ? v.total : v.pago)).toLocaleString('es-AR')}
                            </p>
                            {isSalida ? (
                              <p className={`text-xs font-semibold ${!v.impacta_caja ? "text-amber-400" : "text-red-400"}`}>
                                {!v.impacta_caja ? "Sin impacto" : "Salida caja"}
                              </p>
                            ) : !isCobro && v.saldo > 0 ? (
                              <p className="text-xs text-red-400">Debe ${v.saldo.toLocaleString('es-AR')}</p>
                            ) : !isCobro && v.saldo === 0 ? (
                              <p className="text-xs text-emerald-400">Pagado</p>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] bg-white/5 border border-white/10 rounded-lg px-2 py-0.5 text-zinc-400 uppercase">{v.forma_pago || 'Efectivo'}</span>
                          {v.pago > 0 && <span className="text-[10px] bg-white/5 border border-white/10 rounded-lg px-2 py-0.5 text-zinc-400">{isSalida ? 'Monto' : 'Pagó'} ${v.pago.toLocaleString('es-AR')}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sale Detail Modal */}
      {selectedVenta && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={(e) => { e.stopPropagation(); setSelectedVenta(null); }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">{selectedVenta.customer}</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {selectedVenta.hora} &middot; {
                    selectedVenta.tipo === 'pago_proveedor' ? 'Pago a Proveedor' :
                    selectedVenta.tipo === 'salida' ? 'Salida de Caja' :
                    selectedVenta.tipo === 'cobro_cuenta' ? 'Cobro' :
                    selectedVenta.tipo === 'pedido' ? 'Pedido' : 'Venta'
                  } &middot; {selectedVenta.forma_pago || 'Efectivo'}
                </p>
              </div>
              <button onClick={() => setSelectedVenta(null)} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors">
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            {/* Impact badge for salida / pago proveedor */}
            {(selectedVenta.tipo === 'pago_proveedor' || selectedVenta.tipo === 'salida' || (typeof selectedVenta.tipo === 'string' && selectedVenta.tipo.startsWith('pago_'))) && (
              <div className="mb-4">
                {!selectedVenta.impacta_caja ? (
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-amber-300 text-xs font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Este pago se registró <b>Sin impacto en caja física</b> (no afecta el arqueo de efectivo).</span>
                  </div>
                ) : (
                  <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-red-300 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Este pago <b>Impactó en caja física</b> (descontado del efectivo de caja).</span>
                  </div>
                )}
                {selectedVenta.descripcion && (
                  <div className="mt-2 p-3 rounded-xl bg-white/5 border border-white/5 text-xs text-zinc-300">
                    <span className="text-zinc-500 block text-[10px] uppercase tracking-wider mb-0.5 font-bold">Nota / Referencia:</span>
                    {selectedVenta.descripcion}
                  </div>
                )}
              </div>
            )}

            {selectedVenta.items && selectedVenta.items.length > 0 ? (
              <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                {selectedVenta.items.map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                      <p className="text-xs text-zinc-500">{item.cantidad} x ${item.precio.toLocaleString('es-AR')}</p>
                    </div>
                    <p className="text-sm font-bold text-white shrink-0 ml-2">${(item.cantidad * item.precio).toLocaleString('es-AR')}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500 mb-4">
                {selectedVenta.tipo === 'pago_proveedor' ? 'Pago registrado contra saldo de facturas de compras.' :
                 selectedVenta.tipo === 'salida' ? 'Salida de dinero registrada.' :
                 selectedVenta.tipo === 'cobro_cuenta' ? 'Cobro de cuenta corriente.' : 'Sin detalle de items disponible.'}
              </p>
            )}

            <div className="space-y-2 pt-3 border-t border-white/10">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">
                  {(selectedVenta.tipo === 'pago_proveedor' || selectedVenta.tipo === 'salida' || (typeof selectedVenta.tipo === 'string' && selectedVenta.tipo.startsWith('pago_')))
                    ? 'Monto del Pago (Salida)'
                    : 'Total'
                  }
                </span>
                <span className={`font-bold ${
                  (selectedVenta.tipo === 'pago_proveedor' || selectedVenta.tipo === 'salida' || (typeof selectedVenta.tipo === 'string' && selectedVenta.tipo.startsWith('pago_')))
                    ? 'text-amber-400'
                    : 'text-white'
                }`}>
                  {(selectedVenta.tipo === 'pago_proveedor' || selectedVenta.tipo === 'salida' || (typeof selectedVenta.tipo === 'string' && selectedVenta.tipo.startsWith('pago_'))) ? '-' : ''}${((selectedVenta.tipo === 'cobro_cuenta' || selectedVenta.tipo === 'pago_proveedor' || selectedVenta.tipo === 'salida') ? selectedVenta.pago : (selectedVenta.total || selectedVenta.pago)).toLocaleString('es-AR')}
                </span>
              </div>
              {selectedVenta.pago > 0 && selectedVenta.tipo !== 'cobro_cuenta' && selectedVenta.tipo !== 'pago_proveedor' && selectedVenta.tipo !== 'salida' && !selectedVenta.tipo?.startsWith('pago_') && (
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Pagado</span>
                  <span className="font-bold text-emerald-400">${selectedVenta.pago.toLocaleString('es-AR')}</span>
                </div>
              )}
              {selectedVenta.saldo > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">
                    {selectedVenta.tipo === 'pago_proveedor' ? 'Saldo restante del proveedor' : 'Saldo deudor'}
                  </span>
                  <span className="font-bold text-red-400">${selectedVenta.saldo.toLocaleString('es-AR')}</span>
                </div>
              )}
            </div>

            {selectedVenta.tipo !== 'pago_proveedor' && selectedVenta.tipo !== 'salida' && !selectedVenta.tipo?.startsWith('pago_') && selectedVenta.tipo !== 'cobro_cuenta' && (
              <div className="flex flex-col gap-3 mt-4">
                <label className="flex items-center justify-center gap-2 cursor-pointer text-zinc-300">
                  <input type="checkbox" checked={imprimirDoble} onChange={(e) => setImprimirDoble(e.target.checked)} className="rounded border-zinc-700 bg-zinc-800 text-brand-red focus:ring-brand-red" />
                  <span className="text-sm">Imprimir 2 copias por hoja (Remito)</span>
                </label>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch(`${API_URL}/pedidos/${selectedVenta.id}/comprobante?doble=${imprimirDoble}`, { headers: { Authorization: `Bearer ${token}` } });
                      if (res.ok) {
                        const blob = await res.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement("a"); a.href = url; a.download = `Comprobante_${selectedVenta.id}.pdf`;
                        document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
                      } else alert("Error al descargar");
                    } catch { alert("Error de conexi\u00f3n"); }
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-brand-red text-white font-bold text-sm hover:bg-red-600 transition-colors active:scale-95"
                >
                  <Download className="w-4 h-4" /> Descargar Comprobante
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Abrir/Cerrar Caja (Inspirado en el monolito AdminCajas) */}
      {cajaTurnoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto" onClick={(e) => { if (e.target === e.currentTarget) setCajaTurnoModal(null); }}>
          <div className="bg-[#1c1c1e] w-full max-w-3xl rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex flex-col my-8">
            {/* Header */}
            <div className={`p-6 border-b border-white/10 flex justify-between items-center ${cajaTurnoModal === 'cerrar' ? 'bg-red-500/10 border-l-8 border-l-red-500' : 'bg-emerald-500/10 border-l-8 border-l-emerald-500'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl ${cajaTurnoModal === 'cerrar' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                  <CircleDollarSign className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {cajaTurnoModal === 'abrir' ? "🔓 Abrir Turno de Caja" : "🔒 Arqueo y Cierre de Caja"}
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {cajaTurnoModal === 'abrir' 
                      ? "Registra el monto inicial de apertura para comenzar la jornada." 
                      : "Verifica los números del día, ingresa el dinero físico contado y registra el cierre."}
                  </p>
                </div>
              </div>
              <button onClick={() => setCajaTurnoModal(null)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {cajaTurnoModal === 'abrir' ? (
                <div className="space-y-4">
                  <div className="bg-white/5 p-5 rounded-2xl border border-white/10">
                    <label className="text-xs text-zinc-400 uppercase tracking-widest font-bold mb-2 block">
                      Monto de Apertura (Fondo / Cambio Inicial) <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-zinc-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={cajaMontoApertura}
                        onChange={(e) => setCajaMontoApertura(e.target.value)}
                        placeholder="0.00"
                        className="w-full h-14 bg-black/50 border-2 border-white/10 rounded-2xl pl-10 pr-4 text-white text-2xl font-black outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                    <p className="text-xs text-zinc-500 mt-2">
                      Ingresa el efectivo físico que hay actualmente en el cajón de la panadería.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* SECCIÓN ARQUEO (3 COLUMNAS: ESPERADO, REAL, DIFERENCIA) */}
                  <div className="bg-gradient-to-br from-white/5 to-white/[0.02] p-6 rounded-2xl border-2 border-emerald-500/30 shadow-lg">
                    <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                      💰 Arqueo de Caja - Conteo de Efectivo
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* 1. Efectivo Esperado */}
                      <div className="bg-black/40 p-4 rounded-xl border border-blue-500/30 flex flex-col justify-between">
                        <label className="text-xs text-blue-400 font-semibold uppercase tracking-wider block mb-1">
                          Efectivo Esperado
                        </label>
                        <div className="text-2xl font-black text-blue-400">
                          ${Number(cajaTurnoActivo?.efectivo_esperado || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-2">
                          Apertura + Ventas Mostrador + Ingresos - Salidas - Compras
                        </p>
                      </div>

                      {/* 2. Efectivo Real (Editable) */}
                      <div className="bg-black/40 p-4 rounded-xl border-2 border-emerald-500/50 flex flex-col justify-between">
                        <label className="text-xs text-emerald-400 font-bold uppercase tracking-wider block mb-1">
                          Efectivo Real (Contado) <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-emerald-500">$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={cajaEfectivoReal}
                            onChange={(e) => setCajaEfectivoReal(e.target.value)}
                            placeholder="0.00"
                            className="w-full h-11 bg-black/60 border border-emerald-500/40 rounded-lg pl-8 pr-3 text-emerald-400 text-xl font-black outline-none focus:border-emerald-400"
                          />
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-2">
                          Dinero físico contado en mano
                        </p>
                      </div>

                      {/* 3. Diferencia */}
                      {(() => {
                        const real = parseFloat(String(cajaEfectivoReal)) || 0;
                        const esp = parseFloat(String(cajaTurnoActivo?.efectivo_esperado)) || 0;
                        const diff = real - esp;
                        const isDiffZero = Math.abs(diff) < 0.01;
                        return (
                          <div className={`p-4 rounded-xl border-2 flex flex-col justify-between ${isDiffZero ? 'bg-black/40 border-zinc-700 text-zinc-300' : diff > 0 ? 'bg-emerald-950/20 border-emerald-500/50 text-emerald-400' : 'bg-red-950/20 border-red-500/50 text-red-400'}`}>
                            <label className="text-xs font-semibold uppercase tracking-wider block mb-1">
                              Diferencia
                            </label>
                            <div className="text-2xl font-black">
                              {diff > 0 ? '+' : ''}${diff.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <p className="text-[10px] font-bold mt-2">
                              {isDiffZero ? "✅ Arqueo Exacto" : diff > 0 ? "📈 Sobrante de Caja" : "📉 Faltante de Caja"}
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* DESGLOSE DETALLADO DEL MOSTRADOR */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Ventas Panadería */}
                    <div className="bg-black/30 p-4 rounded-2xl border border-white/10">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider flex items-center gap-1.5">
                          🥖 Ventas Mostrador (Vendedor)
                        </span>
                        <span className="text-xs font-bold bg-yellow-500/20 text-yellow-300 px-2.5 py-0.5 rounded-full">
                          ${Number(cajaTurnoActivo?.ventas_panaderia_total || 0).toLocaleString('es-AR')}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between text-zinc-400">
                          <span className="font-semibold text-yellow-300">Efectivo en Caja:</span>
                          <span className="font-bold text-yellow-400 text-sm">${Number(cajaTurnoActivo?.ventas_panaderia_efectivo || 0).toLocaleString('es-AR')}</span>
                        </div>
                        <div className="flex justify-between text-zinc-400">
                          <span>Transferencia:</span>
                          <span className="font-semibold text-zinc-200">${Number(cajaTurnoActivo?.ventas_panaderia_transferencia || 0).toLocaleString('es-AR')}</span>
                        </div>
                        <div className="flex justify-between text-zinc-400">
                          <span>Tarjeta:</span>
                          <span className="font-semibold text-zinc-200">${Number(cajaTurnoActivo?.ventas_panaderia_tarjeta || 0).toLocaleString('es-AR')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Movimientos de Caja */}
                    <div className="bg-black/30 p-4 rounded-2xl border border-white/10">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                          📥 Movimientos de Caja
                        </span>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between text-zinc-400">
                          <span>Fondo Apertura:</span>
                          <span className="font-semibold text-zinc-200">${Number(cajaTurnoActivo?.monto_apertura || 0).toLocaleString('es-AR')}</span>
                        </div>
                        <div className="flex justify-between text-zinc-400">
                          <span>Cobros Deuda (Ingresos):</span>
                          <span className="font-semibold text-emerald-400">+ ${Number(cajaTurnoActivo?.ingresos || 0).toLocaleString('es-AR')}</span>
                        </div>
                        <div className="flex justify-between text-zinc-400">
                          <span>Salidas de Caja:</span>
                          <span className="font-semibold text-red-400">- ${Number(cajaTurnoActivo?.salidas || 0).toLocaleString('es-AR')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Compras y Gastos en Efectivo */}
                    <div className="bg-black/30 p-4 rounded-2xl border border-white/10">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold text-red-400 uppercase tracking-wider">
                          🛒 Gastos Pagados de Caja
                        </span>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between text-zinc-400">
                          <span>Compras en Efectivo:</span>
                          <span className="font-semibold text-red-400">- ${Number(cajaTurnoActivo?.compras_efectivo || 0).toLocaleString('es-AR')}</span>
                        </div>
                        <div className="flex justify-between text-zinc-400">
                          <span>Total Compras del Día:</span>
                          <span className="font-semibold text-zinc-200">${Number(cajaTurnoActivo?.monto_total_compras || 0).toLocaleString('es-AR')}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Observaciones */}
                  <div className="bg-black/30 p-4 rounded-2xl border border-white/10">
                    <label className="text-xs text-zinc-400 uppercase tracking-widest font-semibold mb-2 block">
                      Observaciones de Cierre (Opcional)
                    </label>
                    <textarea
                      value={cajaObservaciones}
                      onChange={(e) => setCajaObservaciones(e.target.value)}
                      placeholder="Ej: Faltante de $50 por cambio dado incorrectamente, o retiros de socios..."
                      rows={2}
                      className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-red-500 resize-none transition-colors"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-white/10 bg-black/40 flex justify-end gap-3">
              <button 
                onClick={() => setCajaTurnoModal(null)} 
                className="px-6 py-3 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white rounded-xl font-bold text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={cajaTurnoModal === 'abrir' ? handleAbrirCaja : handleCerrarCaja}
                className={`px-8 py-3 rounded-xl font-bold text-sm text-white shadow-lg transition-all ${
                  cajaTurnoModal === 'abrir' 
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/30' 
                    : 'bg-red-600 hover:bg-red-500 shadow-red-900/30'
                }`}
              >
                {cajaTurnoModal === 'abrir' ? "Abrir Caja" : "Confirmar Cierre de Caja"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle de Cierre de Caja */}
      {selectedCierreDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setSelectedCierreDetail(null); }}>
          <div className="bg-[#1c1c1e] w-full max-w-lg rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Cierre de Caja #{selectedCierreDetail.id}</span>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${selectedCierreDetail.estado === 'abierta' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-zinc-400'}`}>
                    {selectedCierreDetail.estado}
                  </span>
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Cajero: <strong className="text-zinc-200">{selectedCierreDetail.user?.name || 'Sistema'}</strong> · {new Date(selectedCierreDetail.fecha_apertura).toLocaleDateString('es-AR')}
                </p>
              </div>
              <button onClick={() => setSelectedCierreDetail(null)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              {/* Horarios */}
              <div className="grid grid-cols-2 gap-3 bg-black/20 p-3 rounded-2xl text-xs">
                <div>
                  <span className="text-zinc-500 block text-[10px] uppercase font-bold">Apertura</span>
                  <p className="font-semibold text-white mt-0.5">{new Date(selectedCierreDetail.fecha_apertura).toLocaleString('es-AR')}</p>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px] uppercase font-bold">Cierre</span>
                  <p className="font-semibold text-white mt-0.5">{selectedCierreDetail.fecha_cierre ? new Date(selectedCierreDetail.fecha_cierre).toLocaleString('es-AR') : 'En curso'}</p>
                </div>
              </div>

              {/* Arqueo Físico de Mostrador */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2 text-xs">
                <p className="font-bold text-sm text-white mb-2 pb-1 border-b border-white/5">Arqueo Físico (Efectivo en Cajón)</p>
                <div className="flex justify-between items-center text-zinc-300">
                  <span>Monto Apertura (Cambio base):</span>
                  <span className="font-mono font-bold">+${Number(selectedCierreDetail.monto_apertura || 0).toLocaleString('es-AR')}</span>
                </div>
                <div className="flex justify-between items-center text-emerald-400">
                  <span>Ventas Mostrador (Efectivo):</span>
                  <span className="font-mono font-bold">+${Number(selectedCierreDetail.ventas_panaderia_efectivo || 0).toLocaleString('es-AR')}</span>
                </div>
                {Number(selectedCierreDetail.ingresos || 0) > 0 && (
                  <div className="flex justify-between items-center text-emerald-400">
                    <span>Cobros de Cuentas Corrientes:</span>
                    <span className="font-mono font-bold">+${Number(selectedCierreDetail.ingresos).toLocaleString('es-AR')}</span>
                  </div>
                )}
                {Number(selectedCierreDetail.compras_efectivo || 0) > 0 && (
                  <div className="flex justify-between items-center text-red-400">
                    <span>Compras Pagadas en Efectivo:</span>
                    <span className="font-mono font-bold">-${Number(selectedCierreDetail.compras_efectivo).toLocaleString('es-AR')}</span>
                  </div>
                )}
                {Number(selectedCierreDetail.salidas || 0) > 0 && (
                  <div className="flex justify-between items-center text-red-400">
                    <span>Salidas de Caja (Gastos/Retiros):</span>
                    <span className="font-mono font-bold">-${Number(selectedCierreDetail.salidas).toLocaleString('es-AR')}</span>
                  </div>
                )}
                
                <div className="pt-2 mt-2 border-t border-white/10 flex justify-between items-center font-bold text-sm">
                  <span className="text-zinc-200">Efectivo Esperado:</span>
                  <span className="font-mono text-zinc-100">${Number(selectedCierreDetail.efectivo_esperado || 0).toLocaleString('es-AR')}</span>
                </div>
                <div className="flex justify-between items-center font-bold text-sm">
                  <span className="text-zinc-200">Efectivo Real en Mano:</span>
                  <span className="font-mono text-emerald-400">${Number(selectedCierreDetail.efectivo_real || 0).toLocaleString('es-AR')}</span>
                </div>
                <div className="flex justify-between items-center font-bold text-sm pt-1">
                  <span className="text-zinc-400">Diferencia:</span>
                  <span className={`font-mono px-2 py-0.5 rounded-md ${
                    Number(selectedCierreDetail.diferencia) === 0 ? 'text-emerald-400 bg-emerald-500/10' :
                    Number(selectedCierreDetail.diferencia) > 0 ? 'text-blue-400 bg-blue-500/10' :
                    'text-red-400 bg-red-500/10'
                  }`}>
                    {Number(selectedCierreDetail.diferencia) === 0 ? '$0 (Exacto)' :
                     Number(selectedCierreDetail.diferencia) > 0 ? `+$${Number(selectedCierreDetail.diferencia).toLocaleString('es-AR')} (Sobrante)` :
                     `-$${Math.abs(Number(selectedCierreDetail.diferencia)).toLocaleString('es-AR')} (Faltante)`}
                  </span>
                </div>
              </div>

              {/* Otros Medios de Pago en Mostrador */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2 text-xs">
                <p className="font-bold text-sm text-white mb-2 pb-1 border-b border-white/5">Otros Medios de Pago (Mostrador)</p>
                <div className="flex justify-between items-center text-zinc-300">
                  <span>Transferencias:</span>
                  <span className="font-mono font-bold text-blue-400">${Number(selectedCierreDetail.ventas_panaderia_transferencia || 0).toLocaleString('es-AR')}</span>
                </div>
                <div className="flex justify-between items-center text-zinc-300">
                  <span>Tarjetas (Débito/Crédito):</span>
                  <span className="font-mono font-bold text-purple-400">${Number(selectedCierreDetail.ventas_panaderia_tarjeta || 0).toLocaleString('es-AR')}</span>
                </div>
                <div className="pt-2 mt-2 border-t border-white/10 flex justify-between items-center font-bold">
                  <span className="text-zinc-300">Total Facturado Mostrador:</span>
                  <span className="font-mono text-brand-yellow text-sm">${Number(selectedCierreDetail.ventas_panaderia_total || 0).toLocaleString('es-AR')}</span>
                </div>
              </div>

              {/* Observaciones */}
              {selectedCierreDetail.observaciones && (
                <div className="bg-black/20 p-3 rounded-2xl text-xs">
                  <span className="text-zinc-500 block text-[10px] uppercase font-bold">Observaciones del Cajero</span>
                  <p className="text-zinc-300 mt-1 italic">"{selectedCierreDetail.observaciones}"</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-white/10 bg-black/20">
              <button onClick={() => setSelectedCierreDetail(null)} className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold text-sm transition-colors">
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}






