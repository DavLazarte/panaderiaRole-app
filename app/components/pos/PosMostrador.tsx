"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search, ShoppingCart, Trash2, Check, Download, RefreshCw,
  X, User as UserIcon, Calendar, ArrowRight, DollarSign,
  AlertCircle, ChevronDown, CheckCircle2, Package, Zap
} from "lucide-react";

interface Product {
  id: number;
  name: string;
  nombre?: string;
  price: number;
  quantity: number;
  stock?: number;
  sold_qty?: number;
  codigo?: string;
  unidad_medida?: string;
  stock_local?: number;
  precio_unitario?: number;
  precio_reparto?: number;
  precio_bar?: number;
  [key: string]: any;
}

interface Client {
  id: number;
  name: string;
  address: string;
  balance: number;
}

interface PosItem {
  id: number;
  name: string;
  codigo?: string;
  stock: number;
  price: number;
  quantity: number;
  unidad_medida?: string;
}

interface PosMostradorProps {
  token: string;
  user: any;
  products: Product[];
  clients: Client[];
  apiUrl: string;
  onVentaExitosa: () => void;
  isAdmin?: boolean;
  posMode?: "mostrador" | "reparto";
  onTogglePosMode?: (mode: "mostrador" | "reparto") => void;
}

const formatUnidadStock = (stock: number, unidad?: string) => {
  if (!unidad) return `${stock}`;
  const u = unidad.trim().toLowerCase();
  if (['unidades', 'unidad', 'u.', 'u'].includes(u)) {
    return `${stock}`;
  }
  return `${stock} ${unidad}`;
};

export default function PosMostrador({
  token,
  user,
  products,
  clients,
  apiUrl,
  onVentaExitosa,
  isAdmin = false,
  posMode = "mostrador",
  onTogglePosMode,
}: PosMostradorProps) {
  // ─── ÍTEMS DE LA VENTA ACTUAL ────────────────────────────────────────────────
  const [saleItems, setSaleItems] = useState<PosItem[]>([]);

  // ─── PARÁMETROS DE LA VENTA (COMMAND CENTER) ────────────────────────────────
  const [tipoVenta, setTipoVenta] = useState<"venta_rapida" | "cuenta_corriente" | "venta_reparto">("venta_rapida");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);

  const [formaPago, setFormaPago] = useState<string>("efectivo");
  const [descuento, setDescuento] = useState<number>(0);
  const [recargo, setRecargo] = useState<number>(0);
  const [ventaConReposicion, setVentaConReposicion] = useState(false);

  // Pedido / Reserva
  const [esPedido, setEsPedido] = useState(false);
  const [fechaEntrega, setFechaEntrega] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [anticipo, setAnticipo] = useState<number>(0);

  // ─── BÚSQUEDA Y ACCESOS RÁPIDOS ─────────────────────────────────────────────
  const [productSearch, setProductSearch] = useState("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [quickAccessProducts, setQuickAccessProducts] = useState<any[]>([]);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // ─── COBRO Y PAGO ───────────────────────────────────────────────────────────
  const [pagoInput, setPagoInput] = useState<string>("");
  const [userEditedPago, setUserEditedPago] = useState<boolean>(false);
  const [loadingCobro, setLoadingCobro] = useState(false);

  // ─── MODAL DE COMPROBANTE FINAL ─────────────────────────────────────────────
  const [completedVentaId, setCompletedVentaId] = useState<number | null>(null);
  const [imprimirDoble, setImprimirDoble] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);

  // Cargar productos de acceso rápido (más vendidos)
  useEffect(() => {
    if (!token) return;
    const fetchQuick = async () => {
      try {
        const res = await fetch(`${apiUrl}/pos/acceso-rapido`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setQuickAccessProducts(data);
        }
      } catch {
        // Fallback: usar los primeros productos con stock
        const fallback = products.slice(0, 10);
        setQuickAccessProducts(fallback);
      }
    };
    fetchQuick();
  }, [token, apiUrl, products]);

  // Si cambia el cliente a null y el tipo es cuenta corriente, volver a venta rápida
  useEffect(() => {
    if (tipoVenta === "cuenta_corriente" && !selectedClient) {
      // mantener cuenta corriente esperando selección de cliente
    }
  }, [tipoVenta, selectedClient]);

  // Si cambia forma de pago a cuenta corriente, seleccionar tipo venta cuenta corriente
  const handleFormaPagoChange = (forma: string) => {
    setFormaPago(forma);
    if (forma === "cuenta_corriente") {
      setTipoVenta("cuenta_corriente");
      setClientDropdownOpen(true);
    }
  };

  // ─── CÁLCULOS DE TOTALES (SUBTOTAL, DESCUENTO, RECARGO, FINAL) ───────────────
  const subtotal = useMemo(() => {
    return saleItems.reduce((acc, item) => acc + item.price * (item.quantity || 0), 0);
  }, [saleItems]);

  const totalFinal = useMemo(() => {
    const desc = (descuento / 100) * subtotal;
    const rec = (recargo / 100) * subtotal;
    return Math.max(0, Math.round((subtotal - desc + rec) * 100) / 100);
  }, [subtotal, descuento, recargo]);

  // Sincronizar pagoInput con totalFinal si el usuario no ingresó un monto manual
  useEffect(() => {
    if (!userEditedPago) {
      setPagoInput(totalFinal > 0 ? totalFinal.toFixed(2).replace(".", ",") : "");
    }
  }, [totalFinal, userEditedPago]);

  const pagoNum = useMemo(() => {
    if (!pagoInput) return 0;
    const clean = pagoInput.replace(/\./g, "").replace(",", ".");
    return parseFloat(clean) || 0;
  }, [pagoInput]);

  const saldo = useMemo(() => {
    return Math.max(0, Math.round((totalFinal - pagoNum) * 100) / 100);
  }, [totalFinal, pagoNum]);

  const vuelto = useMemo(() => {
    return Math.max(0, Math.round((pagoNum - totalFinal) * 100) / 100);
  }, [totalFinal, pagoNum]);

  // Formato input de pago con puntos de miles
  const handlePagoInputChange = (val: string) => {
    setUserEditedPago(true);
    let clean = val.replace(/[^0-9,]/g, "");
    const parts = clean.split(",");
    if (parts.length > 2) {
      clean = parts[0] + "," + parts.slice(1).join("");
    }
    let integerPart = parts[0];
    const decimalPart = parts[1] !== undefined ? "," + parts[1] : "";
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    setPagoInput(integerPart + decimalPart);
  };

  // ─── AGREGAR PRODUCTO A LA VENTA ─────────────────────────────────────────────
  const agregarProducto = (prod: Product | any) => {
    const existingIndex = saleItems.findIndex((i) => i.id === prod.id);

    // Determinar precio según tipo de venta
    let precioBase = prod.precio_unitario ?? prod.price ?? 0;
    if (tipoVenta === "cuenta_corriente" && prod.precio_bar) {
      precioBase = prod.precio_bar;
    } else if (tipoVenta === "venta_reparto" && prod.precio_reparto) {
      precioBase = prod.precio_reparto;
    }

    if (existingIndex >= 0) {
      // Si ya existe, sumar 1 unidad
      setSaleItems((prev) => {
        const next = [...prev];
        next[existingIndex].quantity = Math.round((next[existingIndex].quantity + 1) * 1000) / 1000;
        return next;
      });
    } else {
      // Agregar nuevo ítem
      const newItem: PosItem = {
        id: prod.id,
        name: prod.name || prod.nombre,
        codigo: prod.codigo,
        stock: prod.stock_local ?? prod.quantity ?? prod.stock ?? 0,
        price: Number(precioBase) || 0,
        quantity: 1,
        unidad_medida: prod.unidad_medida || "unidades",
      };
      setSaleItems((prev) => [...prev, newItem]);
    }

    setProductSearch("");
    setProductDropdownOpen(false);
    if (searchInputRef.current) searchInputRef.current.focus();
  };

  // Eliminar ítem
  const eliminarItem = (index: number) => {
    setSaleItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Actualizar cantidad (admite decimales: 0.5, 1.25, etc.)
  const handleUpdateQuantity = (index: number, valStr: string) => {
    setSaleItems((prev) => {
      const next = [...prev];
      if (valStr === "") {
        next[index].quantity = 0;
        return next;
      }
      const parsed = parseFloat(valStr.replace(",", "."));
      if (!isNaN(parsed)) {
        next[index].quantity = Math.max(0, parsed);
      }
      return next;
    });
  };

  // Actualizar precio unitario de un ítem
  const handleUpdatePrice = (index: number, valStr: string) => {
    setSaleItems((prev) => {
      const next = [...prev];
      if (valStr === "") {
        next[index].price = 0;
        return next;
      }
      const parsed = parseFloat(valStr.replace(",", "."));
      if (!isNaN(parsed)) {
        next[index].price = Math.max(0, parsed);
      }
      return next;
    });
  };

  // ─── BÚSQUEDA Y CÓDIGO DE BARRAS ─────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return [];
    const q = productSearch.toLowerCase().trim();
    return products.filter((p) => {
      const matchName = (p.name || "").toLowerCase().includes(q);
      const matchCode = (p.codigo || "").toLowerCase().includes(q);
      return matchName || matchCode;
    }).slice(0, 8);
  }, [products, productSearch]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const term = productSearch.trim().toLowerCase();
      if (!term) return;

      // 1. Coincidencia exacta por código de barras
      const exactCode = products.find((p) => (p.codigo || "").toLowerCase() === term);
      if (exactCode) {
        agregarProducto(exactCode);
        return;
      }

      // 2. Si hay un único resultado en la búsqueda
      if (filteredProducts.length === 1) {
        agregarProducto(filteredProducts[0]);
        return;
      }

      // 3. Primer resultado si existe
      if (filteredProducts.length > 0) {
        agregarProducto(filteredProducts[0]);
      }
    }
  };

  // ─── REGISTRAR COBRO / VENTA DIRECTA ─────────────────────────────────────────
  const handleCobrarVenta = async () => {
    if (saleItems.length === 0) {
      alert("Por favor agregá al menos un producto a la venta.");
      return;
    }

    if (tipoVenta === "cuenta_corriente" && !selectedClient) {
      alert("Para realizar una venta en Cuenta Corriente debés seleccionar un cliente.");
      setClientDropdownOpen(true);
      return;
    }

    if (esPedido && !fechaEntrega) {
      alert("Por favor seleccioná una fecha de entrega para el pedido.");
      return;
    }

    setLoadingCobro(true);
    try {
      const payload = {
        cart: saleItems.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          price: item.price,
        })),
        total: totalFinal,
        idcliente: selectedClient?.id ?? null,
        tipo_venta: tipoVenta,
        descuento,
        recargo,
        pago: esPedido ? anticipo : pagoNum,
        forma_de_pago: formaPago,
        es_pedido: esPedido,
        fecha_entrega: esPedido ? fechaEntrega : null,
        notas: ventaConReposicion ? "Venta con reposición de mercadería" : null,
      };

      const res = await fetch(`${apiUrl}/ventas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // Venta registrada con éxito
        setCompletedVentaId(data.venta_id);
        // Limpiar venta actual
        setSaleItems([]);
        setUserEditedPago(false);
        setPagoInput("");
        setDescuento(0);
        setRecargo(0);
        setAnticipo(0);
        setEsPedido(false);
        setVentaConReposicion(false);
        if (tipoVenta === "cuenta_corriente") setSelectedClient(null);
        onVentaExitosa();
      } else {
        alert(data.message || data.error || "Error al registrar venta");
      }
    } catch (err: any) {
      alert(err?.message || "Error de conexión al registrar venta");
    } finally {
      setLoadingCobro(false);
    }
  };

  // Descarga de PDF / Remito
  const handleDownloadPdf = async () => {
    if (!completedVentaId) return;
    setLoadingPdf(true);
    try {
      const res = await fetch(`${apiUrl}/pedidos/${completedVentaId}/comprobante?doble=${imprimirDoble}`, {
        headers: { Authorization: `Bearer ${token}` },
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

  return (
    <div className="flex flex-col w-full max-w-7xl mx-auto" style={{ gap: "1.75rem", paddingBottom: "3rem" }}>
      {/* ─── COMMAND CENTER / BARRA SUPERIOR ──────────────────────────── */}
      <div
        className="rounded-3xl border border-white/10 bg-zinc-900/95 backdrop-blur-xl shadow-2xl transition-all"
        style={{ padding: "1.5rem" }}
      >
        {/* Fila 1: PV Config, Cliente, Modo Reparto Toggle y Pedido */}
        <div
          className="flex flex-wrap items-center justify-between border-b border-white/10"
          style={{ gap: "1rem", paddingBottom: "1.25rem", marginBottom: "1.25rem" }}
        >
          <div className="flex items-center flex-wrap" style={{ gap: "1rem" }}>
            <div className="flex items-center" style={{ gap: "0.5rem" }}>
              <span
                className="text-xs font-black tracking-widest uppercase text-brand-yellow bg-brand-yellow/15 rounded-xl border border-brand-yellow/30"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0.4rem 0.85rem" }}
              >
                PV
              </span>
              {/* Selector de Tipo de Venta */}
              <select
                value={tipoVenta}
                onChange={(e) => setTipoVenta(e.target.value as any)}
                className="rounded-xl bg-black/50 border border-white/20 text-xs sm:text-sm font-bold text-white outline-none focus:border-brand-red transition-all cursor-pointer"
                style={{ height: "2.75rem", padding: "0 1rem" }}
              >
                <option value="venta_rapida" className="bg-zinc-900">⚡ Rápida (Mostrador)</option>
                <option value="cuenta_corriente" className="bg-zinc-900">👤 Cta. Cte. (Cliente)</option>
                <option value="venta_reparto" className="bg-zinc-900">🚚 Reparto</option>
              </select>
            </div>

            {/* Selector de Cliente */}
            <div className="relative">
              {selectedClient ? (
                <div
                  className="flex items-center bg-brand-red/10 border border-brand-red/30 rounded-xl text-xs sm:text-sm font-semibold text-white"
                  style={{ padding: "0.5rem 1rem", gap: "0.65rem" }}
                >
                  <UserIcon className="w-4 h-4 text-brand-yellow shrink-0" />
                  <span className="max-w-[160px] truncate">{selectedClient.name}</span>
                  <span
                    className={`text-[11px] font-black rounded-lg ${selectedClient.balance > 0 ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-300"}`}
                    style={{ padding: "0.2rem 0.5rem" }}
                  >
                    {selectedClient.balance > 0 ? `-$${selectedClient.balance.toLocaleString("es-AR")}` : "OK"}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setSelectedClient(null); setTipoVenta("venta_rapida"); }}
                    className="hover:text-red-400 transition-colors rounded-lg hover:bg-white/5"
                    style={{ padding: "0.25rem", marginLeft: "0.25rem" }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search
                    className="absolute text-zinc-500 pointer-events-none"
                    style={{ left: "0.85rem", top: "50%", transform: "translateY(-50%)", width: "1rem", height: "1rem" }}
                  />
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => { setClientSearch(e.target.value); setClientDropdownOpen(true); }}
                    onFocus={() => setClientDropdownOpen(true)}
                    placeholder="Buscar Cliente..."
                    className="rounded-xl bg-black/50 border border-white/20 text-xs sm:text-sm text-white placeholder:text-zinc-500 outline-none focus:border-brand-red transition-all"
                    style={{ height: "2.75rem", width: "16rem", paddingLeft: "2.5rem", paddingRight: "1rem" }}
                  />
                  {clientDropdownOpen && clientSearch && (
                    <div
                      className="absolute left-0 top-full bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl z-50 max-h-60 overflow-y-auto divide-y divide-white/5"
                      style={{ marginTop: "0.5rem", width: "18rem" }}
                    >
                      {clients
                        .filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase()))
                        .map((c) => (
                          <div
                            key={c.id}
                            onClick={() => {
                              setSelectedClient(c);
                              setTipoVenta("cuenta_corriente");
                              setClientSearch("");
                              setClientDropdownOpen(false);
                            }}
                            className="hover:bg-white/10 cursor-pointer flex justify-between items-center text-xs sm:text-sm transition-colors"
                            style={{ padding: "0.75rem 1rem" }}
                          >
                            <span className="font-semibold text-white truncate" style={{ marginRight: "0.5rem" }}>{c.name}</span>
                            <span className={c.balance > 0 ? "text-red-400 font-bold shrink-0" : "text-emerald-400 font-bold shrink-0"}>
                              {c.balance > 0 ? `-$${c.balance}` : "OK"}
                            </span>
                          </div>
                        ))}
                      {clients.filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase())).length === 0 && (
                        <p className="text-center text-xs text-zinc-500" style={{ padding: "1rem" }}>Sin clientes encontrados</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Lado derecho: Toggle Modo Admin & Checkbox Reserva */}
          <div className="flex items-center" style={{ gap: "0.75rem" }}>
            {isAdmin && onTogglePosMode && (
              <div
                className="flex bg-black/60 rounded-xl border border-white/15"
                style={{ padding: "0.3rem", gap: "0.3rem" }}
              >
                <button
                  type="button"
                  onClick={() => onTogglePosMode("mostrador")}
                  className={`rounded-lg text-xs font-bold transition-all ${
                    posMode === "mostrador" ? "bg-brand-red text-white shadow-md" : "text-zinc-400 hover:text-white"
                  }`}
                  style={{ padding: "0.45rem 0.9rem" }}
                >
                  🥖 Mostrador
                </button>
                <button
                  type="button"
                  onClick={() => onTogglePosMode("reparto")}
                  className={`rounded-lg text-xs font-bold transition-all ${
                    posMode === "reparto" ? "bg-brand-yellow text-zinc-950 font-black shadow-md" : "text-zinc-400 hover:text-white"
                  }`}
                  style={{ padding: "0.45rem 0.9rem" }}
                >
                  🚐 Móviles
                </button>
              </div>
            )}

            <label
              className={`flex items-center rounded-xl border cursor-pointer transition-all text-xs font-semibold select-none ${
                esPedido ? "bg-amber-500/20 border-amber-500/40 text-amber-200" : "bg-white/5 border-white/10 hover:bg-white/10 text-zinc-300"
              }`}
              style={{ padding: "0.55rem 1rem", gap: "0.65rem" }}
            >
              <input
                type="checkbox"
                checked={esPedido}
                onChange={(e) => setEsPedido(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-brand-red focus:ring-brand-red cursor-pointer"
              />
              <span>Es Pedido / Reserva</span>
            </label>
          </div>
        </div>

        {/* Fila 2: Formas de Pago, Ajustes, y Bloque de Cobro */}
        <div
          className="flex flex-col xl:flex-row xl:items-center justify-between"
          style={{ gap: "1.5rem", paddingTop: "0.25rem" }}
        >
          {/* Ajustes de Pago */}
          <div className="flex flex-wrap items-end flex-1" style={{ gap: "1rem" }}>
            {/* Forma de Pago */}
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-bold text-zinc-400" style={{ marginBottom: "0.4rem" }}>Forma Pago</label>
              <select
                value={formaPago}
                onChange={(e) => handleFormaPagoChange(e.target.value)}
                className="rounded-xl bg-black/50 border border-white/20 text-xs sm:text-sm font-bold text-white outline-none focus:border-brand-red transition-all cursor-pointer"
                style={{ height: "2.75rem", padding: "0 1rem" }}
              >
                <option value="efectivo" className="bg-zinc-900">💵 Efectivo</option>
                <option value="transferencia" className="bg-zinc-900">🏦 Transferencia</option>
                <option value="cuenta_corriente" className="bg-zinc-900">📝 Cta. Corriente</option>
                <option value="tarjeta" className="bg-zinc-900">💳 Débito / Tarjeta</option>
              </select>
            </div>

            {/* Descuento (%) */}
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-bold text-zinc-400" style={{ marginBottom: "0.4rem" }}>Desc. (%)</label>
              <div className="relative">
                <span
                  className="absolute text-zinc-500 text-xs font-bold pointer-events-none"
                  style={{ left: "0.65rem", top: "50%", transform: "translateY(-50%)" }}
                >-</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={descuento || ""}
                  onChange={(e) => setDescuento(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="rounded-xl bg-black/50 border border-white/20 text-sm font-bold text-white text-center outline-none focus:border-brand-red transition-all"
                  style={{ height: "2.75rem", width: "5.5rem", paddingLeft: "1.25rem", paddingRight: "0.5rem" }}
                />
              </div>
            </div>

            {/* Recargo (%) */}
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-bold text-zinc-400" style={{ marginBottom: "0.4rem" }}>Rec. (%)</label>
              <div className="relative">
                <span
                  className="absolute text-zinc-500 text-xs font-bold pointer-events-none"
                  style={{ left: "0.65rem", top: "50%", transform: "translateY(-50%)" }}
                >+</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={recargo || ""}
                  onChange={(e) => setRecargo(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="rounded-xl bg-black/50 border border-white/20 text-sm font-bold text-white text-center outline-none focus:border-brand-red transition-all"
                  style={{ height: "2.75rem", width: "5.5rem", paddingLeft: "1.25rem", paddingRight: "0.5rem" }}
                />
              </div>
            </div>

            {/* Reposición */}
            <div
              className="flex items-center rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              style={{ height: "2.75rem", padding: "0 1rem", gap: "0.65rem" }}
            >
              <input
                type="checkbox"
                id="reposCheck"
                checked={ventaConReposicion}
                onChange={(e) => setVentaConReposicion(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-brand-red focus:ring-brand-red cursor-pointer"
              />
              <label htmlFor="reposCheck" className="text-xs text-zinc-300 font-semibold cursor-pointer select-none">
                Reposición
              </label>
            </div>

            {/* Fechas de entrega si es Pedido */}
            {esPedido && (
              <div
                className="flex items-end rounded-2xl bg-amber-500/10 border border-amber-500/20"
                style={{ padding: "0.5rem 0.75rem", gap: "0.75rem" }}
              >
                <div>
                  <label className="block text-[10px] uppercase font-bold text-amber-300" style={{ marginBottom: "0.25rem" }}>Entrega</label>
                  <input
                    type="date"
                    value={fechaEntrega}
                    onChange={(e) => setFechaEntrega(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="rounded-xl bg-black/50 border border-amber-500/30 text-xs text-amber-200 outline-none"
                    style={{ height: "2.35rem", padding: "0 0.65rem" }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-amber-300" style={{ marginBottom: "0.25rem" }}>Anticipo ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={anticipo || ""}
                    onChange={(e) => setAnticipo(parseFloat(e.target.value) || 0)}
                    placeholder="$0"
                    className="rounded-xl bg-black/50 border border-amber-500/30 text-xs text-amber-200 font-bold outline-none"
                    style={{ height: "2.35rem", width: "6rem", padding: "0 0.65rem" }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Bloque de Totales y Botón Cobrar (Big Numbers) */}
          <div
            className="flex items-center justify-between sm:justify-end bg-black/85 rounded-2xl border border-white/20 shadow-2xl shrink-0 self-stretch xl:self-auto"
            style={{ padding: "1rem 1.5rem", gap: "1.5rem" }}
          >
            {/* Total */}
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wider font-bold text-zinc-400 leading-none" style={{ marginBottom: "0.35rem" }}>Total</p>
              <p className="text-2xl sm:text-3xl font-black text-white font-mono leading-none tracking-tight">
                ${totalFinal.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            <div className="w-px bg-white/15" style={{ height: "2.5rem" }} />

            {/* Paga con */}
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wider font-bold text-zinc-400 leading-none" style={{ marginBottom: "0.35rem" }}>Paga Con</p>
              <input
                type="text"
                inputMode="decimal"
                value={pagoInput}
                onChange={(e) => handlePagoInputChange(e.target.value)}
                placeholder="0,00"
                className="rounded-xl bg-white/10 border border-emerald-500/50 text-base sm:text-lg font-black text-emerald-400 font-mono text-right outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all"
                style={{ height: "2.5rem", width: "7.5rem", padding: "0 0.75rem" }}
              />
            </div>

            <div className="w-px bg-white/15" style={{ height: "2.5rem" }} />

            {/* Vuelto / Saldo */}
            <div className="text-right" style={{ minWidth: "5.5rem" }}>
              <p className="text-[11px] uppercase tracking-wider font-bold text-zinc-400 leading-none" style={{ marginBottom: "0.35rem" }}>
                {vuelto > 0 ? "Vuelto" : "Saldo"}
              </p>
              <p
                className={`text-lg sm:text-xl font-black font-mono leading-none tracking-tight ${
                  vuelto > 0
                    ? "text-emerald-400 font-extrabold"
                    : saldo > 0
                    ? "text-red-400"
                    : "text-zinc-400"
                }`}
              >
                ${(vuelto > 0 ? vuelto : saldo).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            <div className="w-px bg-white/15 hidden sm:block" style={{ height: "2.5rem" }} />

            {/* Botón Cobrar */}
            <button
              onClick={handleCobrarVenta}
              disabled={loadingCobro || saleItems.length === 0}
              className={`rounded-xl font-black text-sm sm:text-base uppercase tracking-wider text-white shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${
                saleItems.length === 0
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-white/5 opacity-60"
                  : esPedido
                  ? "bg-amber-600 hover:bg-amber-500 shadow-amber-600/30 hover:scale-[1.02]"
                  : "bg-purple-600 hover:bg-purple-500 shadow-purple-600/30 border border-purple-400/40 hover:scale-[1.02]"
              }`}
              style={{ height: "3rem", padding: "0 2rem" }}
            >
              {loadingCobro ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : esPedido ? (
                <>📅 Reservar</>
              ) : (
                <>⚡ Cobrar</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ─── ÁREA DE BÚSQUEDA Y ACCESOS RÁPIDOS (CHIPS) ────────────────────────── */}
      <div
        className="rounded-3xl border border-white/10 bg-zinc-900/90 shadow-xl flex flex-col"
        style={{ padding: "1.5rem", gap: "1.25rem" }}
      >
        {/* Input Prominente de Búsqueda / Código de Barras */}
        <div className="relative max-w-3xl mx-auto w-full">
          <Search
            className="absolute text-zinc-400 pointer-events-none"
            style={{ left: "1.25rem", top: "50%", transform: "translateY(-50%)", width: "1.35rem", height: "1.35rem" }}
          />
          <input
            ref={searchInputRef}
            type="text"
            value={productSearch}
            onChange={(e) => {
              setProductSearch(e.target.value);
              setProductDropdownOpen(true);
            }}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => setProductDropdownOpen(true)}
            placeholder="Escanear código de barras o escribir producto..."
            className="w-full rounded-2xl bg-black/60 border-2 border-white/20 text-white placeholder:text-zinc-500 font-medium outline-none focus:border-brand-red focus:ring-4 focus:ring-brand-red/15 shadow-inner transition-all"
            style={{ height: "3.75rem", paddingLeft: "3.5rem", paddingRight: "1.25rem", fontSize: "1.05rem" }}
            autoFocus
          />

          {/* Dropdown de Resultados al tipear */}
          {productDropdownOpen && productSearch && (
            <div
              className="absolute left-0 top-full w-full bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl z-50 max-h-72 overflow-y-auto divide-y divide-white/5"
              style={{ marginTop: "0.5rem" }}
            >
              {filteredProducts.map((p) => {
                const stockVal = p.stock_local ?? p.quantity ?? p.stock ?? 0;
                return (
                  <div
                    key={p.id}
                    onClick={() => agregarProducto(p)}
                    className="hover:bg-white/10 cursor-pointer flex items-center justify-between transition-colors group"
                    style={{ padding: "1rem 1.25rem" }}
                  >
                    <div>
                      <p className="text-sm font-bold text-white group-hover:text-brand-yellow transition-colors">
                        {p.name}
                      </p>
                      <p className="text-xs text-zinc-400" style={{ marginTop: "0.2rem" }}>
                        {p.codigo ? `Cód: ${p.codigo}` : ""} · Precio: ${p.precio_unitario ?? p.price}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-xs rounded-full font-bold ${stockVal <= 0 ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-300"}`}
                        style={{ padding: "0.35rem 0.75rem", whiteSpace: "nowrap" }}
                      >
                        Stock: {formatUnidadStock(stockVal, p.unidad_medida)}
                      </span>
                    </div>
                  </div>
                );
              })}
              {filteredProducts.length === 0 && (
                <div className="text-center text-xs text-zinc-500" style={{ padding: "1.25rem" }}>
                  No se encontraron productos coincidentes con "{productSearch}"
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chips de Accesos Rápidos (Los Más Vendidos) */}
        {quickAccessProducts.length > 0 && (
          <div className="flex flex-col" style={{ gap: "0.65rem", paddingTop: "0.25rem" }}>
            <div className="flex items-center text-xs font-bold uppercase tracking-wider text-zinc-400" style={{ gap: "0.5rem" }}>
              <Zap className="w-4 h-4 text-brand-yellow" />
              <span>Accesos Rápidos (Top 10 más vendidos):</span>
            </div>
            <div className="flex flex-wrap items-center" style={{ gap: "0.65rem" }}>
              {quickAccessProducts.map((prod) => {
                const stockVal = prod.stock_local ?? prod.quantity ?? prod.stock ?? 0;
                const sinStock = stockVal <= 0;
                return (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => agregarProducto(prod)}
                    className={`rounded-xl text-xs sm:text-sm font-semibold border transition-all active:scale-95 flex items-center shadow-sm ${
                      sinStock
                        ? "bg-white/5 border-white/5 text-zinc-500 hover:text-zinc-300 hover:border-white/20"
                        : "bg-white/5 border-white/15 text-zinc-200 hover:bg-white/10 hover:border-brand-yellow/50 hover:text-white"
                    }`}
                    style={{ padding: "0.55rem 1.15rem", gap: "0.65rem" }}
                  >
                    <span>{prod.name}</span>
                    <span
                      className="rounded-lg bg-black/60 text-brand-yellow font-bold font-mono text-xs border border-white/10"
                      style={{ padding: "0.2rem 0.6rem" }}
                    >
                      ${prod.price || prod.precio_unitario}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── TABLA DINÁMICA DE LA VENTA ────────────────────────────────────────── */}
      <div
        className="rounded-3xl border border-white/10 bg-zinc-900/90 overflow-hidden shadow-2xl flex flex-col"
        style={{ minHeight: "380px" }}
      >
        {saleItems.length === 0 ? (
          /* Estado Vacío */
          <div
            className="flex-1 flex flex-col items-center justify-center text-center"
            style={{ padding: "5rem 1.5rem" }}
          >
            <div
              className="bg-white/5 rounded-3xl flex items-center justify-center border border-white/10 shadow-inner"
              style={{ width: "5.5rem", height: "5.5rem", marginBottom: "1.25rem" }}
            >
              <ShoppingCart className="w-10 h-10 text-zinc-500" />
            </div>
            <h3 className="text-xl font-bold text-white" style={{ marginBottom: "0.5rem" }}>No hay productos en la venta</h3>
            <p className="text-sm text-zinc-400 max-w-sm leading-relaxed">
              Escaneá un código de barras o buscá un producto arriba para comenzar la venta de mostrador.
            </p>
          </div>
        ) : (
          /* Tabla de Productos */
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/60 text-[11px] uppercase tracking-wider font-bold text-zinc-400 border-b border-white/15">
                  <th style={{ padding: "1rem 1.5rem" }}>Producto</th>
                  <th className="text-center" style={{ padding: "1rem 1.5rem", width: "7.5rem" }}>Stock</th>
                  <th className="text-right" style={{ padding: "1rem 1.5rem", width: "9rem" }}>Precio ($)</th>
                  <th className="text-center" style={{ padding: "1rem 1.5rem", width: "8rem" }}>Cant.</th>
                  <th className="text-right" style={{ padding: "1rem 1.5rem", width: "10rem" }}>Subtotal</th>
                  <th className="text-center" style={{ padding: "1rem 1.5rem", width: "4rem" }}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {saleItems.map((item, index) => {
                  const itemSubtotal = item.price * (item.quantity || 0);
                  const isOutOfStock = item.stock <= 0;
                  return (
                    <tr key={`${item.id}-${index}`} className="hover:bg-white/[0.03] transition-colors group">
                      {/* Producto */}
                      <td style={{ padding: "1rem 1.5rem" }}>
                        <p className="text-sm font-bold text-white">{item.name}</p>
                        {item.codigo && (
                          <p className="text-[11px] text-zinc-500 font-mono" style={{ marginTop: "0.2rem" }}>Cód: {item.codigo}</p>
                        )}
                      </td>

                      {/* Stock */}
                      <td className="text-center" style={{ padding: "1rem 1.5rem" }}>
                        <span
                          className={`text-xs font-bold rounded-lg ${isOutOfStock ? "bg-red-500/20 text-red-300" : "bg-white/5 text-zinc-400 border border-white/5"}`}
                          style={{ padding: "0.35rem 0.75rem", whiteSpace: "nowrap", display: "inline-block" }}
                        >
                          {formatUnidadStock(item.stock, item.unidad_medida)}
                        </span>
                      </td>

                      {/* Precio Editable */}
                      <td className="text-right" style={{ padding: "1rem 1.5rem" }}>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.price || ""}
                          onChange={(e) => handleUpdatePrice(index, e.target.value)}
                          className="text-right rounded-xl bg-black/50 border border-white/20 text-sm font-bold text-white outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red transition-all"
                          style={{ height: "2.5rem", width: "7rem", padding: "0 0.75rem" }}
                        />
                      </td>

                      {/* Cantidad Editable con Soporte Decimal */}
                      <td className="text-center" style={{ padding: "1rem 1.5rem" }}>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={item.quantity === 0 ? "" : item.quantity}
                          onChange={(e) => handleUpdateQuantity(index, e.target.value)}
                          placeholder="1"
                          className="text-center rounded-xl bg-black/50 border border-white/20 text-sm font-black text-brand-yellow outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red transition-all"
                          style={{ height: "2.5rem", width: "6rem", padding: "0 0.5rem" }}
                        />
                      </td>

                      {/* Subtotal */}
                      <td className="text-right font-black text-emerald-400 text-base font-mono" style={{ padding: "1rem 1.5rem" }}>
                        ${itemSubtotal.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Eliminar */}
                      <td className="text-center" style={{ padding: "1rem 1.5rem" }}>
                        <button
                          type="button"
                          onClick={() => eliminarItem(index)}
                          className="rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          style={{ padding: "0.5rem" }}
                          title="Quitar producto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Barra Inferior de Resumen si hay ítems */}
        {saleItems.length > 0 && (
          <div
            className="bg-black/60 border-t border-white/10 flex items-center justify-between text-xs sm:text-sm text-zinc-300"
            style={{ padding: "1.25rem 2rem" }}
          >
            <span className="font-medium">
              {saleItems.length} {saleItems.length === 1 ? "producto" : "productos"} en la venta
            </span>
            <div className="flex items-center" style={{ gap: "1.5rem" }}>
              {descuento > 0 && (
                <span className="text-emerald-400 font-semibold">Descuento: -{descuento}%</span>
              )}
              {recargo > 0 && (
                <span className="text-amber-400 font-semibold">Recargo: +{recargo}%</span>
              )}
              <span className="text-white font-black text-base sm:text-lg">
                Total: ${totalFinal.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ─── MODAL DE COMPROBANTE FINAL / VENTA EXITOSA ──────────────────────── */}
      {completedVentaId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-1">¡Venta Registrada!</h2>
            <p className="text-xs text-zinc-400 mb-6">
              Comprobante #{completedVentaId} guardado con éxito en el sistema.
            </p>
            <div className="flex flex-col gap-3 w-full">
              <label className="flex items-center justify-center gap-2 cursor-pointer text-zinc-300 text-xs">
                <input
                  type="checkbox"
                  checked={imprimirDoble}
                  onChange={(e) => setImprimirDoble(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-800 text-brand-red focus:ring-brand-red"
                />
                <span>Imprimir 2 copias por hoja (Remito Doble)</span>
              </label>
              <button
                onClick={handleDownloadPdf}
                disabled={loadingPdf}
                className="w-full bg-brand-red text-white font-bold py-3.5 rounded-xl hover:bg-red-600 transition-colors flex items-center justify-center gap-2 text-sm shadow-lg shadow-brand-red/20 active:scale-95"
              >
                {loadingPdf ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {loadingPdf ? "Descargando..." : "Descargar Comprobante"}
              </button>
              <button
                onClick={() => setCompletedVentaId(null)}
                className="w-full bg-white/5 text-zinc-300 font-bold py-3.5 rounded-xl hover:bg-white/10 transition-colors text-sm"
              >
                Nueva Venta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
