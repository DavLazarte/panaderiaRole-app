"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  ShoppingCart, Truck, Package, Users, Plus, Minus, Search,
  CircleDollarSign, ClipboardList, ChevronRight, LogOut,
  User as UserIcon, X, Check, Calendar, CheckCircle2,
  CreditCard, Banknote, Clock, Receipt, ArrowLeft,
  ChevronDown, AlertCircle, RefreshCw, Trash2,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://role.test/api";

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

interface Product  { id: number; name: string; price: number; quantity: number; sold_qty?: number; }
interface Client   { id: number; name: string; address: string; balance: number; }
interface Delivery { id: number; customer: string; status: string; items: string; total: string; total_raw: number; address: string; advance?: number; }
interface SaleItem { id: number; name: string; price: number; quantity: number; }

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
        const prod = products.find(p => p.id === Number(id))!;
        const price = customPrices[prod.id] !== undefined ? customPrices[prod.id] : prod.price;
        return { id: Number(id), quantity: qty, price: price, name: prod.name };
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

      if (res.ok) { onSuccess(); onClose(); }
      else {
        const err = await res.json();
        alert(err.message || "Error al registrar");
      }
    } catch { alert("Error de conexión"); }
    finally { setLoading(false); }
  };

  if (!open) return null;

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
            <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= step ? "bg-orange-500" : "bg-white/10"}`} />
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
                <span className="text-orange-400">${subtotal.toFixed(2)}</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-400 uppercase tracking-widest mb-2 block">Cliente</label>
              {selectedClient ? (
                <div className="flex items-center justify-between rounded-2xl border border-orange-500/40 bg-orange-500/10 p-3">
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
                      placeholder="Buscar cliente..." className="w-full h-11 rounded-xl bg-white/5 border border-white/10 pl-9 pr-3 text-sm outline-none focus:border-orange-500" />
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
              className={`flex items-center justify-between rounded-2xl border p-4 cursor-pointer transition-all ${esPedido ? "border-orange-500/50 bg-orange-500/10" : "border-white/10 bg-white/5"}`}>
              <div className="flex items-center gap-3">
                <Clock className={`h-5 w-5 ${esPedido ? "text-orange-400" : "text-zinc-500"}`} />
                <div>
                  <p className="text-sm font-semibold">Guardar como Pedido</p>
                  <p className="text-xs text-zinc-500">Entregar en otra fecha</p>
                </div>
              </div>
              <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${esPedido ? "border-orange-500 bg-orange-500" : "border-white/20"}`}>
                {esPedido && <Check className="h-3 w-3 text-white" />}
              </div>
            </div>
            {esPedido && (
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input type="date" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)}
                  className="w-full h-11 rounded-xl bg-white/5 border border-white/10 pl-9 pr-3 text-sm outline-none focus:border-orange-500 text-white" />
              </div>
            )}
            <button onClick={() => setStep(1)}
              className="w-full bg-orange-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-orange-500/20 active:scale-95 flex items-center justify-center gap-2">
              Continuar <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* ── PASO 0 PEDIDO: Resumen ── */}
        {step === 0 && isPedidoMode && (
          <div className="space-y-4">
            {pedidoCliente && (
              <div className="flex items-center gap-3 rounded-2xl border border-orange-500/30 bg-orange-500/10 p-3">
                <UserIcon className="h-4 w-4 text-orange-400" />
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
                <span className="text-orange-400">${subtotal.toFixed(2)}</span>
              </div>
            </div>
            {isEditingMode ? (
              <button onClick={handleConfirm} disabled={loading}
                className="w-full bg-orange-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-orange-500/20 active:scale-95 flex items-center justify-center gap-2">
                {loading ? "Guardando..." : <><Check className="h-5 w-5" /> Guardar Cambios</>}
              </button>
            ) : (
              <button onClick={() => setStep(1)}
                className="w-full bg-orange-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-orange-500/20 active:scale-95 flex items-center justify-center gap-2">
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
                  className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm outline-none focus:border-orange-500 text-white" placeholder="Porcentaje de recargo..." />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">%</span>
              </div>
              {recargo > 0 && <p className="text-xs text-orange-400 mt-1">+${((recargo / 100) * subtotal).toFixed(2)}</p>}
            </div>

            {/* 🔄 Cambio de Mercadería */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-orange-400" />
                  <span className="text-sm font-semibold">¿Incluye cambios/reposición?</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={hasExchanges} 
                  onChange={e => {
                    setHasExchanges(e.target.checked);
                    if (!e.target.checked) setCambios({});
                  }}
                  className="h-4.5 w-4.5 rounded border-white/20 bg-zinc-900 text-orange-500 accent-orange-500 cursor-pointer"
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
                            className="h-7 w-7 flex items-center justify-center rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold"
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

            <div className="rounded-2xl bg-orange-500/10 border border-orange-500/30 p-4 flex justify-between items-center">
              <span className="font-semibold text-orange-300">Total a Cobrar</span>
              <span className="text-2xl font-bold">${totalFinal.toFixed(2)}</span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(0)} className="flex-1 py-4 rounded-2xl border border-white/10 text-zinc-300 font-semibold active:scale-95">Atrás</button>
              <button onClick={() => setStep(2)} className="flex-1 bg-orange-500 text-white py-4 rounded-2xl font-bold active:scale-95">Continuar</button>
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
                        className={`py-3 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition-all ${formaDePago === value ? "bg-orange-500 text-white" : "bg-white/5 border border-white/10 text-zinc-300"}`}>
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
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-400 font-bold text-lg">$</span>
                    <input type="text" value={pago}
                      onChange={e => setPago(formatPaymentInput(e.target.value))}
                      className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 pl-10 pr-4 text-xl font-bold outline-none focus:border-orange-500 text-white" />
                  </div>
                </div>
                <div className={`rounded-2xl p-4 flex justify-between items-center transition-all ${
                  saldo > 0 ? "bg-red-500/10 border border-red-500/30" :
                  vuelto > 0 ? "bg-orange-500/10 border border-orange-500/30 animate-pulse" :
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
                        <p className="text-xs text-orange-300">Vuelto a entregar</p>
                        <p className="text-xl font-bold text-orange-400">
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
                <UserIcon className="h-4 w-4 text-orange-400" />
                <span className="text-sm text-zinc-300">{selectedClient.name}</span>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setStep(isPedidoMode ? 0 : 1)} className="flex-1 py-4 rounded-2xl border border-white/10 text-zinc-300 font-semibold active:scale-95">Atrás</button>
              <button onClick={handleConfirm} disabled={loading}
                className="flex-1 bg-orange-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-orange-500/20 active:scale-95 flex items-center justify-center gap-2">
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

  useEffect(() => {
    fetch(`${API_URL}/clientes/${client.id}/ventas?only_debt=true`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        setVentas(data);
      })
      .finally(() => setLoading(false));
  }, [client.id, token]);

  const distribution = useMemo(() => {
    const amountNum = parsePaymentInput(monto);
    let remaining = amountNum;
    return ventas.map(v => {
      const allocated = Math.min(v.saldo, remaining);
      remaining -= allocated;
      return {
        ...v,
        allocated,
        newSaldo: Math.round((v.saldo - allocated) * 100) / 100
      };
    });
  }, [ventas, monto]);

  const totalSaldos = useMemo(() => {
    return ventas.reduce((s, v) => s + v.saldo, 0);
  }, [ventas]);

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
        const blob = await res.blob();
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
        body: JSON.stringify({ monto: amountNum, descripcion }),
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
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-400 font-bold text-lg">$</span>
                <input
                  type="text"
                  value={monto}
                  onChange={e => setMonto(formatPaymentInput(e.target.value))}
                  placeholder="Ej: 2.000"
                  className="w-full h-12 rounded-xl bg-white/5 border border-white/10 pl-9 pr-4 font-bold outline-none focus:border-orange-500 text-white"
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
                className="w-full h-12 rounded-xl bg-white/5 border border-white/10 px-4 text-sm outline-none focus:border-orange-500 text-white"
              />
            </div>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={pdfLoading || totalSaldos === 0}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 active:scale-95 text-orange-400 py-3 text-sm font-semibold transition-all disabled:opacity-40"
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
              <div className="rounded-2xl p-4 bg-orange-500/10 border border-orange-500/30 text-center animate-pulse">
                <p className="text-xs text-orange-300 font-semibold uppercase tracking-wider">Pago excede la deuda</p>
                <p className="text-xl font-bold text-orange-400 mt-1">Vuelto a entregar: ${vuelto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
              </div>
            )}

            {/* Vista Previa de Distribución */}
            {ventas.length > 0 ? (
              <div>
                <label className="text-xs text-zinc-400 uppercase tracking-widest mb-2 block">Distribución de pago estimada (FIFO)</label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {distribution.map(v => (
                    <div key={v.id} className="rounded-xl border border-white/5 bg-black/20 p-3 text-xs flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-zinc-300">{v.fecha}</p>
                        <p className="text-zinc-500 truncate max-w-[180px]">{v.items}</p>
                        <p className="text-[10px] text-zinc-400 mt-1">Saldo original: ${v.saldo.toLocaleString('es-AR')}</p>
                      </div>
                      <div className="text-right">
                        {v.allocated > 0 && (
                          <p className="font-semibold text-emerald-400">-${v.allocated.toLocaleString('es-AR')}</p>
                        )}
                        <p className={`font-bold mt-1 ${v.newSaldo === 0 ? "text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded inline-block" : "text-zinc-300"}`}>
                          {v.newSaldo === 0 ? "Saldado ✓" : `Restan: $${v.newSaldo.toLocaleString('es-AR')}`}
                        </p>
                      </div>
                    </div>
                  ))}
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
                className="flex-1 bg-orange-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white py-3.5 rounded-xl font-bold active:scale-95 flex items-center justify-center gap-1.5 text-sm"
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

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function BakeryDriverApp() {
  const [token, setToken]   = useState<string | null>(null);
  const [user, setUser]     = useState<any>(null);
  const [activeTab, setActiveTab]           = useState("pos");
  const [deliveryFilter, setDeliveryFilter] = useState("Today");
  const [search, setSearch]                 = useState("");
  const [cart, setCart]     = useState<Record<number, number>>({});
  const [products, setProducts]   = useState<Product[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [clients, setClients]     = useState<Client[]>([]);
  const [misVentas, setMisVentas] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);

  // POS search and sorting state
  const [posSearch, setPosSearch] = useState("");

  const displayedProducts = useMemo(() => {
    let list = products.filter(p => p.name.toLowerCase().includes(posSearch.toLowerCase()));
    return [...list].sort((a, b) => {
      const aHasStock = a.quantity > 0 ? 1 : 0;
      const bHasStock = b.quantity > 0 ? 1 : 0;
      if (aHasStock !== bHasStock) {
        return bHasStock - aHasStock;
      }
      return (b.sold_qty || 0) - (a.sold_qty || 0);
    });
  }, [products, posSearch]);

  // Checkout state
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [pedidoCheckout, setPedidoCheckout] = useState<{ id: number; items: SaleItem[]; cliente: { id: number; name: string } | null } | null>(null);

  // Cliente detalle
  const [clienteDetalle, setClienteDetalle] = useState<Client | null>(null);

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
      const [stockRes, pedRes, cliRes, ventasRes] = await Promise.all([
        fetch(`${API_URL}/stock`, { headers }),
        fetch(`${API_URL}/pedidos`, { headers }),
        fetch(`${API_URL}/clientes`, { headers }),
        fetch(`${API_URL}/mis-ventas`, { headers }),
      ]);
      if (stockRes.ok) setProducts(await stockRes.json());
      if (pedRes.ok)   setDeliveries(await pedRes.json());
      if (cliRes.ok)   setClients(await cliRes.json());
      if (ventasRes.ok) setMisVentas(await ventasRes.json());
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
        headers: { Authorization: `Bearer ${token}` }
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

  const totalVentasHoy  = misVentas.reduce((s, v) => s + Number(v.total || 0), 0);
  const totalCobradoHoy = misVentas.reduce((s, v) => s + Number(v.pago || 0), 0);

  const NavButton = ({ icon: Icon, label, value, prominent, badge }: any) => (
    <button onClick={() => setActiveTab(value)}
      className={`flex flex-col items-center justify-center gap-1 transition-all duration-300 relative ${activeTab === value ? "text-orange-500" : "text-zinc-400"}`}>
      <div className={`flex items-center justify-center rounded-2xl transition-all duration-300 relative ${
        prominent
          ? activeTab === value ? "bg-orange-500 text-white shadow-lg shadow-orange-500/40 scale-110 w-16 h-16 -mt-8" : "bg-zinc-800 text-zinc-300 w-16 h-16 -mt-8"
          : activeTab === value ? "bg-orange-500/15 w-12 h-12" : "w-12 h-12"
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
      Pending: "bg-orange-500/20 text-orange-300 border-orange-500/30",
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
              className="w-full h-12 rounded-xl bg-black/20 border border-white/10 px-4 focus:border-orange-500 outline-none" />
            <input name="password" type="password" placeholder="Contraseña" required
              className="w-full h-12 rounded-xl bg-black/20 border border-white/10 px-4 focus:border-orange-500 outline-none" />
            <button disabled={loading} className="w-full bg-orange-500 text-white h-12 rounded-xl font-bold shadow-lg shadow-orange-500/20 active:scale-95 transition-all">
              {loading ? "Cargando..." : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── APP ──
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-orange-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-md md:max-w-5xl flex-col overflow-hidden relative transition-all duration-300">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,146,60,0.18),transparent_40%)]" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-5 pb-2 relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-orange-500/20 rounded-full flex items-center justify-center border border-orange-500/30">
              <UserIcon className="h-4 w-4 text-orange-400" />
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
                <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-orange-400 shrink-0" />
                    <div>
                      <p className="text-xs text-orange-400 font-bold uppercase tracking-wider">Modo Edición</p>
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
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <CircleDollarSign className="h-4 w-4 text-orange-400" />
                  <span className="text-sm font-semibold text-orange-400">Reparto</span>
                </div>
              </div>
              {/* Buscador de productos en POS */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  value={posSearch}
                  onChange={e => setPosSearch(e.target.value)}
                  placeholder="Buscar producto..."
                  className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 pl-11 pr-4 text-sm outline-none placeholder:text-zinc-500 focus:border-orange-500 text-white"
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
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {displayedProducts.map(product => {
                    const disabled = product.quantity === 0;
                    const qty = cart[product.id] || 0;
                    return (
                      <div key={product.id}
                        className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-all ${
                          disabled ? "border-zinc-800 bg-zinc-900/40 opacity-40" :
                          qty > 0 ? "border-orange-500/40 bg-orange-500/5" : "border-white/10 bg-white/5"
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
                            className="w-12 h-8 text-center text-sm font-bold bg-white/5 border border-white/10 rounded-lg outline-none focus:border-orange-500 focus:bg-orange-500/10 text-white"
                            style={{ appearance: "textfield", WebkitAppearance: "none", MozAppearance: "textfield" }}
                          />
                          <button disabled={disabled} onClick={() => updateQuantity(product, 1)}
                            className="h-8 w-8 flex items-center justify-center rounded-lg bg-orange-500 text-white shadow-sm shadow-orange-500/30 active:scale-95 disabled:opacity-40">
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── PEDIDOS ── */}
          {activeTab === "pedidos" && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold">Pedidos</h1>
              <div className="flex gap-2">
                {["Today", "Late", "All"].map(f => (
                  <button key={f} onClick={() => setDeliveryFilter(f)}
                    className={`rounded-2xl px-4 py-2 text-sm font-medium transition-all ${deliveryFilter === f ? "bg-orange-500 text-white" : "border border-white/10 bg-white/5 text-zinc-300"}`}>
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
                          <p className="text-xs text-zinc-400">{delivery.address}</p>
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
                          className="flex items-center gap-1 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold shadow-lg shadow-orange-500/20 active:scale-95">
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

          {/* ── STOCK ── */}
          {activeTab === "stock" && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold">Mi Stock</h1>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {products.map(item => (
                  <div key={item.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold">{item.name}</p>
                      <p className="text-xs text-zinc-400">Precio reparto: ${item.price}</p>
                    </div>
                    <div className={`rounded-xl px-3 py-1.5 text-sm font-bold ${item.quantity === 0 ? "bg-red-500/20 text-red-300" : "bg-orange-500/20 text-orange-300"}`}>
                      {item.quantity} un.
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── CLIENTES ── */}
          {activeTab === "clientes" && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold">Clientes</h1>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar clientes..."
                  className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 pl-11 pr-4 text-sm outline-none placeholder:text-zinc-500 focus:border-orange-500" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {filteredClients.map(client => (
                  <button key={client.id} onClick={() => setClienteDetalle(client)}
                    className="w-full rounded-3xl border border-white/10 bg-white/5 p-4 text-left active:scale-[0.99] transition-all flex flex-col justify-between h-full">
                    <div className="flex items-start justify-between gap-3 w-full">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-semibold truncate">{client.name}</h3>
                        <p className="text-xs text-zinc-400 mt-0.5 truncate">{client.address}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-4 w-full">
                      <span className="text-xs text-zinc-500">Saldo</span>
                      <div className="flex items-center gap-2">
                        <div className={`rounded-xl px-3 py-1.5 text-sm font-bold ${client.balance > 0 ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-300"}`}>
                          {client.balance > 0 ? `-$${client.balance.toLocaleString('es-AR')}` : "OK"}
                        </div>
                        <ChevronRight className="h-4 w-4 text-zinc-500" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── MIS VENTAS ── */}
          {activeTab === "ventas" && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold">Mis Ventas · Hoy</h1>
              {/* Resumen del día */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                  <p className="text-xs text-zinc-400">Facturado</p>
                  <p className="text-xl font-bold text-orange-400">${totalVentasHoy.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                  <p className="text-xs text-zinc-400">Cobrado</p>
                  <p className="text-xl font-bold text-emerald-400">${totalCobradoHoy.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>
              {misVentas.length === 0 ? (
                <p className="text-center text-zinc-500 text-sm mt-10">Sin ventas registradas hoy.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {misVentas.map(v => {
                    const isCobro = v.tipo === "cobro_cuenta";
                    return (
                      <div key={`${v.tipo}-${v.id}`} className="rounded-2xl border border-white/10 bg-white/5 p-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold">{v.customer}</p>
                          <p className="text-xs text-zinc-400">
                            {isCobro 
                              ? `${v.hora} · Cobro de Cuenta · Efectivo` 
                              : `${v.hora} · ${v.tipo === "pedido" ? "Pedido Entregado" : "Venta Directa"} · ${v.forma_pago}`
                            }
                          </p>
                        </div>
                        <div className="text-right">
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
            </div>
          )}

        </main>

        {/* ── Bottom Bar POS ── */}
        {activeTab === "pos" && (
          <div className={`fixed bottom-24 left-1/2 z-20 w-[calc(100%-2rem)] max-w-md md:max-w-5xl -translate-x-1/2 rounded-3xl border border-white/10 bg-black/60 p-4 backdrop-blur-2xl transition-all duration-300 ${
            Number(cartTotal) > 0 ? "scale-100 opacity-100 shadow-2xl shadow-orange-500/20" : "scale-95 opacity-80"
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
                  Number(cartTotal) > 0 ? "bg-orange-500 text-white shadow-xl shadow-orange-500/30 active:scale-95" : "bg-zinc-800 text-zinc-500"
                }`}>
                {editingPedido ? "Guardar" : "Cobrar"}
              </button>
            </div>
          </div>
        )}

        {/* ── NAV ── */}
        <nav className="fixed bottom-0 left-1/2 z-30 flex h-24 w-full max-w-md md:max-w-5xl -translate-x-1/2 items-center justify-around border-t border-white/10 bg-black/70 px-2 backdrop-blur-3xl">
          <NavButton icon={Truck}        label="Pedidos" value="pedidos" badge={deliveries.filter(d => d.status === "Late").length} />
          <NavButton icon={Package}      label="Stock"   value="stock" />
          <NavButton icon={ShoppingCart} label="Venta"   value="pos" prominent />
          <NavButton icon={Users}        label="Clientes" value="clientes" />
          <NavButton icon={Receipt}      label="Historial" value="ventas" />
        </nav>
      </div>

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
    </div>
  );
}
