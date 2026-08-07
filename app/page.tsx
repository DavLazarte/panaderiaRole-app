"use client";

import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import {
  ShoppingCart, Truck, Package, Users, Plus, Minus, Search,
  CircleDollarSign, ClipboardList, ChevronRight, LogOut,
  User as UserIcon, X, Check, Calendar, CheckCircle2,
  CreditCard, Banknote, Clock, Receipt, ArrowLeft,
  ChevronDown, AlertCircle, RefreshCw, Trash2, PieChart as PieChartIcon, BarChart3, Edit2, Download
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

import { DndContext, closestCenter, KeyboardSensor, TouchSensor, MouseSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
            <input type="number" min="0" max={product.quantity} value={qty || ""} placeholder="0"
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

interface Product  { id: number; name: string; price: number; quantity: number; sold_qty?: number; stock_local?: number; stock_vehiculo1?: number; stock_vehiculo2?: number; descripcion?: string; codigo?: string; estado?: string; idcategoria?: number; precio_unitario?: number; precio_reparto?: number; precio_bar?: number; disponible_reparto?: number; precios_especiales?: any[]; }
interface Client   { id: number; name: string; address: string; balance: number; }
interface Delivery { id: number; customer: string; status: string; items: string; raw_items?: {id?: number, name: string, qty: number}[]; total: string; total_raw: number; address: string; advance?: number; fecha_entrega?: string | null; }
interface SaleItem { id: number; name: string; price: number; quantity: number; }
interface Categoria { id_categoria: number; nombre: string; }

// ─── CheckoutModal ────────────────────────────────────────────────────────────
function CheckoutModal({
  open, onClose, cart, products, token, onSuccess, clients,
  pedidoId, pedidoItems, pedidoCliente, isEditing,
}: {
  open: boolean; onClose: () => void; cart: Record<number, number>;
  products: Product[]; token: string; onSuccess: () => void; clients: Client[];
  pedidoId?: number | null; pedidoItems?: SaleItem[]; pedidoCliente?: { id: number; name: string } | null;
  isEditing?: boolean;
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
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            cart: activeItems.map(i => ({ id: i.id, quantity: i.quantity, price: i.price })),
            total: totalFinal,
            idcliente: selectedClient?.id ?? null,
            tipo_venta: "venta_reparto",
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
        const err = await res.json();
        alert(err.message || "Error al registrar");
      }
    } catch { alert("Error de conexión"); }
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
          <h2 className="text-xl font-bold text-white mb-2">¡Venta Exitosa!</h2>
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
                        <span className="text-[10px] text-emerald-400 font-semibold tracking-wide">¡Precio especial aplicado!</span>
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
                        <span className="text-[10px] text-emerald-400 font-semibold tracking-wide">¡Precio especial aplicado!</span>
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
                    {v === 0 ? "—" : `${v}%`}
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

            {/* 🔄 Cambio de Mercadería */}
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

        {/* ── ÚLTIMO PASO: PAGO ── */}
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
        <h3 className="text-xs text-zinc-500 uppercase tracking-widest mb-3">Últimas ventas</h3>
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
    stock_local: 0, stock_vehiculo1: 0, stock_vehiculo2: 0,
    estado: 'activo', disponible_reparto: 1,
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
        stock_vehiculo1: product.stock_vehiculo1 || 0,
        stock_vehiculo2: product.stock_vehiculo2 || 0,
        estado: product.estado || 'activo',
        disponible_reparto: product.disponible_reparto ? 1 : 0,
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
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Código de Barras</label>
                  <input type="text" value={formData.codigo} onChange={e => setFormData({...formData, codigo: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-brand-red outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Descripción</label>
                <textarea value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} rows={3} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-brand-red outline-none resize-none" />
              </div>
            </div>
          )}

          {tab === "inventario" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                <label className="block text-xs font-semibold text-brand-yellow mb-2 uppercase tracking-wider text-center">Stock Local</label>
                <input type="number" value={formData.stock_local} onChange={e => setFormData({...formData, stock_local: Number(e.target.value)})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-lg font-bold focus:border-brand-red outline-none text-center" />
              </div>
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                <label className="block text-xs font-semibold text-emerald-400 mb-2 uppercase tracking-wider text-center">Vehículo 1</label>
                <input type="number" value={formData.stock_vehiculo1} onChange={e => setFormData({...formData, stock_vehiculo1: Number(e.target.value)})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-lg font-bold focus:border-emerald-500 outline-none text-center" />
              </div>
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                <label className="block text-xs font-semibold text-blue-400 mb-2 uppercase tracking-wider text-center">Vehículo 2</label>
                <input type="number" value={formData.stock_vehiculo2} onChange={e => setFormData({...formData, stock_vehiculo2: Number(e.target.value)})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-lg font-bold focus:border-blue-500 outline-none text-center" />
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
                          <p className="text-xs text-brand-yellow font-medium">${p.precio} <span className="text-zinc-500 ml-1">{p.fecha_desde ? `(${p.fecha_desde} - ${p.fecha_hasta||'∞'})` : 'Permanente'}</span></p>
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
export default function BakeryDriverApp() {
  const [token, setToken]   = useState<string | null>(null);
  const [user, setUser]     = useState<any>(null);
  const [activeTab, setActiveTab]           = useState("pos");
  const [deliveryFilter, setDeliveryFilter] = useState("All");
  const [search, setSearch]                 = useState("");
  const [cart, setCart]     = useState<Record<number, number>>({});
  const [products, setProducts]   = useState<Product[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [clients, setClients]     = useState<Client[]>([]);
  const [misVentas, setMisVentas] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

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
  const [historyTab, setHistoryTab] = useState<'movimientos' | 'estadisticas'>('movimientos');
  const [productStats, setProductStats] = useState<any[]>([]);
  const [clientStats, setClientStats] = useState<{ top_clientes: any[], cambios: any[] } | null>(null);
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
  const [cajaSales, setCajaSales] = useState<any[]>([]);
  const [loadingCajaSales, setLoadingCajaSales] = useState(false);
  const [imprimirDoble, setImprimirDoble] = useState(false);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const historyLoaderRef = useRef<HTMLDivElement | null>(null);

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
  const [cajaFormaPago, setCajaFormaPago] = useState<string>("");

  useEffect(() => {
    if (!selectedCaja || !token) {
      setCajaSales([]);
      return;
    }
    const fetchCajaSales = async () => {
      setLoadingCajaSales(true);
      try {
        let queryParams = `filter_type=${historyFilterType}&search=${historySearch}&tipo=${historyType}&user_id=${selectedCaja.user_id}`;
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
    const delayDebounceFn = setTimeout(() => {
      fetchAdminStock();
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [token, user, adminStockPage, adminStockSearch, adminStockRefresh]);

  // POS search and sorting state
  const [posSearch, setPosSearch] = useState("");

  const displayedProducts = useMemo(() => {
    if (posSearch) {
      // When searching, filter but keep the user-defined order from products array
      return products.filter(p => p.name.toLowerCase().includes(posSearch.toLowerCase()));
    }
    // No search: show all products in their saved order (products array already sorted by backend 'orden')
    // Only sort by stock within that: in-stock first, but within each group keep user order
    return [...products].sort((a, b) => {
      const aHasStock = a.quantity > 0 ? 1 : 0;
      const bHasStock = b.quantity > 0 ? 1 : 0;
      return bHasStock - aHasStock; // in-stock first, ties keep original order (stable sort)
    });
  }, [products, posSearch]);

  // Checkout state
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [pedidoCheckout, setPedidoCheckout] = useState<{ id: number; items: SaleItem[]; cliente: { id: number; name: string } | null } | null>(null);

  // Cliente detalle
  const [clienteDetalle, setClienteDetalle] = useState<Client | null>(null);

  // Admin Personas (CRUD)
  const [adminClientesTab, setAdminClientesTab] = useState<'saldos' | 'gestion'>('saldos');
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
        const res = await fetch(`${API_URL}/admin/personas?page=${adminPersonasPage}&search=${adminPersonasSearch}`, {
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
  }, [token, user, adminPersonasPage, adminPersonasSearch, adminPersonasRefresh]);

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
      }
    } catch(e) {}
    setSavingPersona(false);
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

  const fetchAllData = useCallback(async (authToken: string) => {
    setLoading(true);
    const headers = { Authorization: `Bearer ${authToken}` };
    try {
      const [stockRes, pedRes, cliRes, usrRes] = await Promise.all([
        fetch(`${API_URL}/stock`, { headers }),
        fetch(`${API_URL}/pedidos`, { headers }),
        fetch(`${API_URL}/clientes`, { headers }),
        fetch(`${API_URL}/user`, { headers }),
      ]);
      if (stockRes.ok) setProducts(await stockRes.json());
      if (pedRes.ok)   setDeliveries(await pedRes.json());
      if (cliRes.ok)   setClients(await cliRes.json());
      
      if (usrRes.ok) {
        const u = await usrRes.json();
        if (u.roles?.some((r: string) => r.toLowerCase() === 'admin')) {
          const catRes = await fetch(`${API_URL}/categorias`, { headers });
          if (catRes.ok) setCategorias(await catRes.json());
          const mayRes = await fetch(`${API_URL}/admin/users/mayoristas`, { headers });
          if (mayRes.ok) setAdminUsers(await mayRes.json());
        }
      }
      setHistoryRefresh(prev => prev + 1);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

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
      const next = Math.max(0, Math.min(product.quantity, (prev[product.id] || 0) + change));
      return { ...prev, [product.id]: next };
    });
  };

  const handleSetQuantity = (product: Product, value: string) => {
    if (value === "") {
      setCart(prev => ({ ...prev, [product.id]: 0 }));
      return;
    }
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) return;
    const clamped = Math.max(0, Math.min(product.quantity, parsed));
    setCart(prev => ({ ...prev, [product.id]: clamped }));
  };

  const cartTotal = useMemo(() =>
    products.reduce((s, p) => s + p.price * (cart[p.id] || 0), 0).toFixed(2), [cart, products]);
  const cartCount = useMemo(() => Object.values(cart).reduce((s, q) => s + q, 0), [cart]);

  const isAdmin = user?.roles?.some((r: string) => r.toLowerCase() === 'admin');
  const isVendedor = user?.roles?.some((r: string) => r.toLowerCase() === 'vendedor');



  // Cargar pedido para checkout
  const handleEntregarPedido = async (delivery: Delivery) => {
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
  };

  // Cargar pedido para edición en el POS
  const handleEditarPedido = async (delivery: Delivery) => {
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
    }
  };

  // Cancelar/Eliminar pedido
  const handleCancelarPedido = async (delivery: Delivery) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar el pedido de ${delivery.customer}?`)) {
      return;
    }
    try {
      const res = await fetch(`${API_URL}/pedidos/${delivery.id}/cancelar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        alert("Pedido eliminado correctamente");
        fetchAllData(token!);
      } else {
        const err = await res.json();
        alert(err.message || "Error al eliminar el pedido");
      }
    } catch {
      alert("Error de conexión");
    }
  };

  const filteredClients    = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const filteredDeliveries = deliveries.filter(d => deliveryFilter === "All" ? true : d.status === deliveryFilter);

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
    };
    const labels: Record<string, string> = { Today: "Hoy", Late: "Atrasado", Pending: "Pendiente" };
    return <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${styles[status] || styles.Pending}`}>{labels[status] || status}</div>;
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
            <button onClick={() => setActiveTab('pedidos')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'pedidos' ? 'bg-brand-red/20 text-brand-yellow' : 'hover:bg-white/5 text-zinc-400'}`}>
              <Truck className="w-5 h-5"/> <span className="font-semibold text-sm">Pedidos</span>
              {deliveries.filter(d => d.status === "Late").length > 0 && <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{deliveries.filter(d => d.status === "Late").length}</span>}
            </button>
            {!isVendedor && (
              <button onClick={() => setActiveTab('stock')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'stock' ? 'bg-brand-red/20 text-brand-yellow' : 'hover:bg-white/5 text-zinc-400'}`}><Package className="w-5 h-5"/> <span className="font-semibold text-sm">Stock</span></button>
            )}
            <button onClick={() => setActiveTab('pos')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'pos' ? 'bg-brand-red/20 text-brand-yellow' : 'hover:bg-white/5 text-zinc-400'}`}><ShoppingCart className="w-5 h-5"/> <span className="font-semibold text-sm">Venta Rápida</span></button>
            {!isVendedor && (
              <button onClick={() => setActiveTab('clientes')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'clientes' ? 'bg-brand-red/20 text-brand-yellow' : 'hover:bg-white/5 text-zinc-400'}`}><Users className="w-5 h-5"/> <span className="font-semibold text-sm">Clientes</span></button>
            )}
            <button onClick={() => setActiveTab('ventas')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'ventas' ? 'bg-brand-red/20 text-brand-yellow' : 'hover:bg-white/5 text-zinc-400'}`}><Receipt className="w-5 h-5"/> <span className="font-semibold text-sm">Historial</span></button>
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
              <p className="text-xs text-zinc-500">Van #{user.vehiculo} · {user.roles[0]}</p>
            </div>
          </div>
          <button onClick={logout} className="p-2 bg-white/5 rounded-full border border-white/10">
            <LogOut className="h-4 w-4 text-red-400" />
          </button>
        </div>

        <main className="flex-1 overflow-y-auto px-4 pb-40 pt-3 relative z-10">

          {/* ── POS ── */}
          {activeTab === "pos" && (
            <div className="space-y-4">
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
          )}

          {/* ── PEDIDOS ── */}
          {activeTab === "pedidos" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h1 className="text-2xl font-bold">Pedidos</h1>
                {isAdmin && (
                  <button onClick={() => setTotalsModalOpen(true)}
                    className="inline-flex items-center justify-center px-4 py-2 bg-brand-red/20 text-brand-yellow border border-brand-red/30 rounded-xl font-semibold text-sm hover:bg-brand-red/30 transition-all active:scale-95">
                    <Package className="w-4 h-4 mr-2" />
                    Ver Totales por Producto
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                {["Today", "Late", "All"].map(f => (
                  <button key={f} onClick={() => setDeliveryFilter(f)}
                    className={`rounded-2xl px-4 py-2 text-sm font-medium transition-all ${deliveryFilter === f ? "bg-brand-red text-white" : "border border-white/10 bg-white/5 text-zinc-300"}`}>
                    {f === "Today" ? "Hoy" : f === "Late" ? "Atrasados" : "Todos"}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredDeliveries.map(delivery => (
                  <div key={delivery.id} className="rounded-3xl border border-white/10 bg-white/5 p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold">{delivery.customer}</h3>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <p className="text-xs text-zinc-400">{delivery.address}</p>
                            {delivery.fecha_entrega && (
                              <span className="text-[10px] font-semibold tracking-wider text-brand-yellow bg-brand-red/10 px-2 py-0.5 rounded-full border border-brand-red/20">
                                ENTREGAR: {delivery.fecha_entrega.split('-').reverse().join('/')}
                              </span>
                            )}
                          </div>
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
                        <button onClick={() => handleCancelarPedido(delivery)}
                          className="flex items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2.5 hover:bg-red-500/20 active:scale-95 text-red-400"
                          title="Eliminar pedido">
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleEditarPedido(delivery)}
                          className="flex items-center gap-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm font-semibold hover:bg-white/10 active:scale-95 text-zinc-300">
                          Editar
                        </button>
                        <button onClick={() => handleEntregarPedido(delivery)}
                          className="flex items-center gap-1 rounded-xl bg-brand-red px-4 py-2.5 text-sm font-semibold shadow-lg shadow-brand-red/20 active:scale-95">
                          Cobrar <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {filteredDeliveries.length === 0 && <p className="text-center text-zinc-500 mt-10 text-sm">No hay pedidos pendientes.</p>}
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
                      const stockV1 = Number(prod?.stock_vehiculo1 || 0);
                      const stockV2 = Number(prod?.stock_vehiculo2 || 0);
                      const totalVehiculos = stockV1 + stockV2;
                      const faltan = qty > totalVehiculos ? qty - totalVehiculos : 0;

                      return (
                        <div key={name} className="flex flex-col gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-semibold text-white">{name}</span>
                            <span className="text-sm font-bold text-brand-yellow bg-brand-red/10 px-3 py-1 rounded-lg border border-brand-red/20">{qty} uds</span>
                          </div>
                          <div className="flex items-center justify-between mt-1 pt-2 border-t border-white/5">
                            <div className="flex flex-col gap-0.5 text-[11px]">
                              <span className="text-zinc-400">Stock V1: <b className="text-zinc-200">{stockV1}</b> | V2: <b className="text-zinc-200">{stockV2}</b></span>
                              {faltan > 0 && <span className="text-red-400 font-semibold">⚠️ Faltan {faltan} uds en móviles</span>}
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
              <h1 className="text-2xl font-bold">Mi Stock {isAdmin ? "(Admin)" : ""}</h1>
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
                              {([{label:'LOC',val:item.stock_local},{label:'V1',val:item.stock_vehiculo1},{label:'V2',val:item.stock_vehiculo2}] as {label:string,val:number}[]).map(s => (
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
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {products.map(item => (
                    <div key={item.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold">{item.name}</p>
                        <p className="text-xs text-zinc-400">Precio reparto: ${item.price}</p>
                      </div>
                      <div className={`rounded-xl px-3 py-1.5 text-sm font-bold ${item.quantity === 0 ? "bg-red-500/20 text-red-300" : "bg-brand-red/20 text-brand-yellow"}`}>
                        {item.quantity} un.
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── CLIENTES ── */}
          {activeTab === "clientes" && !isVendedor && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h1 className="text-2xl font-bold">Clientes {isAdmin ? "(Saldos & Gestión)" : ""}</h1>
                
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

              {isAdmin && adminClientesTab === 'gestion' && (
                <div className="space-y-4 relative pb-20">
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

          {/* ── MIS VENTAS ── */}
          {activeTab === "ventas" && (
            <div className="space-y-4">
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
                <div className="flex bg-black/20 p-1 rounded-xl border border-white/5 w-full sm:w-fit">
                  <button onClick={() => setHistoryTab('movimientos')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${historyTab === 'movimientos' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                    <ClipboardList className="w-4 h-4" /> Movimientos
                  </button>
                  <button onClick={() => setHistoryTab('estadisticas')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${historyTab === 'estadisticas' ? 'bg-brand-red/20 text-brand-yellow' : 'text-zinc-500 hover:text-zinc-300'}`}>
                    <PieChartIcon className="w-4 h-4" /> Estadísticas
                  </button>
                </div>
              )}

              {historyTab === 'movimientos' || !isAdmin ? (
                <>
                  {isAdmin && historyCajas.length > 0 && (
                    <div className="mb-6 space-y-3">
                      <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Cajas por Usuario</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {historyCajas.map((caja: any) => (
                          <div
                            key={caja.user_id}
                            onClick={() => setSelectedCaja(caja)}
                            className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2 cursor-pointer transition-all hover:bg-white/10 hover:border-white/20 active:scale-[0.98]">
                            <p className="font-bold text-white mb-2 pb-2 border-b border-white/10">📦 {caja.user_name}</p>
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
                              <span className="font-semibold text-zinc-300">${caja.total_facturado.toLocaleString('es-AR')}</span>
                            </div>
                          </div>
                        ))}
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
                        return (
                          <div
                            key={`${v.tipo}-${v.id}`}
                            onClick={() => setSelectedVenta(v)}
                            className="rounded-2xl border border-white/10 bg-white/5 p-3 flex items-center justify-between hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer"
                          >
                            <div className="flex-1 min-w-0 mr-2">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold truncate">{v.customer}</p>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      const res = await fetch(`${API_URL}/pedidos/${v.id}/comprobante`, {
                                        headers: { Authorization: `Bearer ${token}` }
                                      });
                                      if (res.ok) {
                                        const blob = await res.blob();
                                        const url = window.URL.createObjectURL(blob);
                                        const a = document.createElement("a");
                                        a.href = url;
                                        a.download = `Comprobante_${v.id}.pdf`;
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                        window.URL.revokeObjectURL(url);
                                      } else alert("Error al descargar");
                                    } catch { alert("Error de conexión"); }
                                  }}
                                  className="p-1.5 bg-white/10 rounded-md hover:bg-white/20 transition-colors shrink-0"
                                  title="Descargar Comprobante"
                                >
                                  <Download className="w-3.5 h-3.5 text-zinc-300" />
                                </button>
                              </div>
                              <p className="text-xs text-zinc-400 mt-0.5">
                                {isCobro
                                  ? `${v.hora} · Cobro · Efectivo`
                                  : `${v.hora} · ${v.tipo === "pedido" ? "Pedido" : "Venta"} · ${v.forma_pago || 'Efectivo'}`
                                }
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`text-sm font-bold ${isCobro ? "text-emerald-400" : "text-white"}`}>
                                {isCobro ? "+" : ""}${v.total > 0 ? v.total.toLocaleString('es-AR') : v.pago.toLocaleString('es-AR')}
                              </p>
                              {isCobro ? (
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
              ) : (
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
              )}
            </div>
          )}

        </main>

        {/* ── Bottom Bar POS ── */}
        {activeTab === "pos" && (
          <div className={`fixed bottom-24 md:bottom-8 left-1/2 md:left-[calc(50%+8rem)] z-20 w-[calc(100%-2rem)] max-w-md md:max-w-[calc(100%-18rem)] xl:max-w-6xl -translate-x-1/2 rounded-3xl border border-white/10 bg-black/60 p-4 backdrop-blur-2xl transition-all duration-300 ${
            Number(cartTotal) > 0 ? "scale-100 opacity-100 shadow-2xl shadow-brand-red/20" : "scale-95 opacity-80"
          }`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-zinc-500">Total · {cartCount} items</p>
                <h3 className="text-2xl font-bold">${cartTotal}</h3>
              </div>
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
            </div>
          </div>
        )}

        {/* ── NAV ── */}
        <nav className="md:hidden fixed bottom-0 left-1/2 z-30 flex h-24 w-full max-w-md -translate-x-1/2 items-center justify-around border-t border-white/10 bg-black/70 px-2 backdrop-blur-3xl">
          <NavButton icon={Truck}        label="Pedidos" value="pedidos" badge={deliveries.filter(d => d.status === "Late").length} />
          {!isVendedor && <NavButton icon={Package} label="Stock" value="stock" />}
          <NavButton icon={ShoppingCart} label="Venta"   value="pos" prominent />
          {!isVendedor && <NavButton icon={Users}        label="Clientes" value="clientes" />}
          <NavButton icon={Receipt}      label="Historial" value="ventas" />
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
        onSaved={() => { fetchAllData(token!); setAdminStockRefresh(prev => prev + 1); setEditingProduct(null); }}
        onRefresh={() => { fetchAllData(token!); setAdminStockRefresh(prev => prev + 1); }}
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
        onSuccess={() => {
          setCart({});
          setEditingPedido(null);
          fetchAllData(token!);
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
            fetchAllData(token!);
          }}
        />
      )}

      {/* ── Persona (CRUD) Modal ── */}
      {editingPersona && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-lg font-bold text-white">
                {editingPersona.idpersona ? "Editar Persona" : "Nueva Persona"}
              </h2>
              <button 
                onClick={() => setEditingPersona(null)} 
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
            
            <form onSubmit={handleSavePersona} className="p-4 flex flex-col gap-4 overflow-y-auto">
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

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400">Nombre Completo</label>
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

      {/* Sale Detail Modal */}
      {selectedVenta && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setSelectedVenta(null)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">{selectedVenta.customer}</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {selectedVenta.hora} &middot; {selectedVenta.tipo === 'cobro_cuenta' ? 'Cobro' : selectedVenta.tipo === 'pedido' ? 'Pedido' : 'Venta'} &middot; {selectedVenta.forma_pago || 'Efectivo'}
                </p>
              </div>
              <button onClick={() => setSelectedVenta(null)} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors">
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

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
              <p className="text-sm text-zinc-500 mb-4">{selectedVenta.tipo === 'cobro_cuenta' ? 'Cobro de cuenta corriente.' : 'Sin detalle de items disponible.'}</p>
            )}

            <div className="space-y-2 pt-3 border-t border-white/10">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Total</span>
                <span className="font-bold text-white">${(selectedVenta.total || selectedVenta.pago).toLocaleString('es-AR')}</span>
              </div>
              {selectedVenta.pago > 0 && selectedVenta.tipo !== 'cobro_cuenta' && (
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Pagado</span>
                  <span className="font-bold text-emerald-400">${selectedVenta.pago.toLocaleString('es-AR')}</span>
                </div>
              )}
              {selectedVenta.saldo > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Saldo deudor</span>
                  <span className="font-bold text-red-400">${selectedVenta.saldo.toLocaleString('es-AR')}</span>
                </div>
              )}
            </div>

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
                <h2 className="text-xl font-bold text-white">📦 Caja: {selectedCaja.user_name}</h2>
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
            <h3 className="text-xs text-zinc-500 uppercase tracking-widest mb-3">Últimos movimientos</h3>

            {/* Sales List Container */}
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {loadingCajaSales ? (
                <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-2xl bg-white/5 animate-pulse" />)}</div>
              ) : cajaSales.length === 0 ? (
                <p className="text-center text-zinc-500 text-sm mt-6">Sin movimientos registrados</p>
              ) : (
                <div className="space-y-3">
                  {cajaSales.map(v => {
                    const isCobro = v.tipo === "cobro_cuenta";
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
                                isCobro 
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : v.tipo === "pedido"
                                    ? "bg-purple-500/20 text-purple-300"
                                    : "bg-blue-500/20 text-blue-300"
                              }`}>
                                {isCobro ? "Cobro" : v.tipo === "pedido" ? "Pedido" : "Venta"}
                              </span>
                              <span className="text-xs text-zinc-400">{v.hora} hs</span>
                            </div>
                            <p className="text-sm font-semibold text-white mt-1.5 truncate">{v.customer}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-white">${(isCobro ? v.pago : v.total).toLocaleString('es-AR')}</p>
                            {!isCobro && v.saldo > 0 && <p className="text-xs text-red-400">Debe ${v.saldo.toLocaleString('es-AR')}</p>}
                            {!isCobro && v.saldo === 0 && <p className="text-xs text-emerald-400">Pagado</p>}
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] bg-white/5 border border-white/10 rounded-lg px-2 py-0.5 text-zinc-400 uppercase">{v.forma_pago || 'Efectivo'}</span>
                          {v.pago > 0 && <span className="text-[10px] bg-white/5 border border-white/10 rounded-lg px-2 py-0.5 text-zinc-400">Pagó ${v.pago.toLocaleString('es-AR')}</span>}
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
    </div>
  );
}
