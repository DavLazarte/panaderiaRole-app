"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Search, ShoppingCart, Trash2, Check, Download, RefreshCw,
  X, User as UserIcon, Calendar, ArrowRight, DollarSign,
  AlertCircle, ChevronDown, CheckCircle2, Package, Zap, Repeat
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
  saldo_a_favor?: number;
  deuda?: number;
}

interface PosItem {
  id: number;
  name: string;
  codigo?: string;
  stock: number;
  price: number;
  quantity: number;
  unidad_medida?: string;
  isManualPrice?: boolean;
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
  editingPedido?: {
    id: number;
    cliente: { id: number; name: string } | null;
    items?: { id: number; name: string; price: number; quantity: number }[];
  } | null;
  onEditFinished?: () => void;
  reutilizarPedido?: {
    cliente: { id: number; name: string } | null;
    items?: { id: number; name: string; price: number; quantity: number }[];
  } | null;
  onReutilizarFinished?: () => void;
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
  editingPedido = null,
  onEditFinished,
  reutilizarPedido = null,
  onReutilizarFinished,
}: PosMostradorProps) {
  // ─── ÍTEMS DE LA VENTA ACTUAL ────────────────────────────────────────────────
  const [saleItems, setSaleItems] = useState<PosItem[]>([]);

  // ─── PRECARGA AL EDITAR UN PEDIDO PENDIENTE ─────────────────────────────────
  useEffect(() => {
    if (!editingPedido) return;
    const loaded: PosItem[] = (editingPedido.items || []).map((it) => {
      const prod = products.find((p) => p.id === it.id);
      return {
        id: it.id,
        name: it.name,
        codigo: prod?.codigo,
        stock: prod?.stock_local ?? prod?.quantity ?? prod?.stock ?? 0,
        price: Number(it.price) || 0, // precio original del pedido
        quantity: Number(it.quantity) || 0,
        unidad_medida: prod?.unidad_medida || "unidades",
      };
    });
    setSaleItems(loaded);
    setEsPedido(true);
    setUserEditedPago(false);
    setDescuento(0);
    setRecargo(0);
    if (editingPedido.cliente) {
      const found = clients.find((c) => c.id === editingPedido.cliente!.id);
      setSelectedClient(
        found ?? { id: editingPedido.cliente.id, name: editingPedido.cliente.name, address: "", balance: 0 }
      );
      setTipoVenta("cuenta_corriente");
    } else {
      setSelectedClient(null);
      setTipoVenta("venta_rapida");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingPedido?.id]);

  // ─── PRECARGA AL REUTILIZAR UN PEDIDO ANTERIOR (NUEVA VENTA) ───────────────
  useEffect(() => {
    if (!reutilizarPedido) return;
    const loaded: PosItem[] = (reutilizarPedido.items || []).map((it) => {
      const prod = products.find((p) => p.id === it.id);
      return {
        id: it.id,
        name: it.name,
        codigo: prod?.codigo,
        stock: prod?.stock_local ?? prod?.quantity ?? prod?.stock ?? 0,
        price: Number(it.price) || (prod?.price || 0),
        quantity: Number(it.quantity) || 0,
        unidad_medida: prod?.unidad_medida || "unidades",
      };
    });
    setSaleItems(loaded);
    setEsPedido(true);
    setUserEditedPago(false);
    setDescuento(0);
    setRecargo(0);
    if (reutilizarPedido.cliente) {
      const found = clients.find((c) => c.id === reutilizarPedido.cliente!.id);
      setSelectedClient(
        found ?? { id: reutilizarPedido.cliente.id, name: reutilizarPedido.cliente.name, address: "", balance: 0 }
      );
      setTipoVenta("cuenta_corriente");
    } else {
      setSelectedClient(null);
      setTipoVenta("venta_rapida");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reutilizarPedido]);

  const cancelarEdicion = () => {
    setSaleItems([]);
    setEsPedido(false);
    setSelectedClient(null);
    setTipoVenta("");
    onEditFinished?.();
  };

  // ─── PARÁMETROS DE LA VENTA (COMMAND CENTER) ────────────────────────────────
  const [tipoVenta, setTipoVenta] = useState<"" | "venta_rapida" | "cuenta_corriente" | "venta_reparto">("");
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
  const [_unusedQuickAccess, setQuickAccessProducts] = useState<any[]>([]);
  const quickAccessProducts = useMemo(() => {
    if (!products || products.length === 0) return [];
    return [...products]
      .sort((a: any, b: any) => (Number(b.sold_qty) || 0) - (Number(a.sold_qty) || 0))
      .slice(0, 10);
  }, [products]);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // ─── COBRO Y PAGO ───────────────────────────────────────────────────────────
  const [pagoInput, setPagoInput] = useState<string>("");
  const [userEditedPago, setUserEditedPago] = useState<boolean>(false);
  const [loadingCobro, setLoadingCobro] = useState(false);

  // ─── PAGO MIXTO / MULTI-PAGO ────────────────────────────────────────────────
  const [pagoEfectivo, setPagoEfectivo] = useState<string>("");
  const [pagoTransferencia, setPagoTransferencia] = useState<string>("");
  const [pagoTarjeta, setPagoTarjeta] = useState<string>("");
  const [pagoCtaCte, setPagoCtaCte] = useState<string>("");
  const [pagoSaldoAFavor, setPagoSaldoAFavor] = useState<string>("");
  const [dejarVueltoComoSaldoAFavor, setDejarVueltoComoSaldoAFavor] = useState<boolean>(false);
  const [saldoAFavorDescartado, setSaldoAFavorDescartado] = useState<boolean>(false);

  // Si cambia el cliente seleccionado, resetear el descarte de saldo a favor
  useEffect(() => {
    setSaldoAFavorDescartado(false);
  }, [selectedClient?.id]);

  // ─── MODAL DE COMPROBANTE FINAL ─────────────────────────────────────────────
  const [completedVentaId, setCompletedVentaId] = useState<number | null>(null);
  const [imprimirDoble, setImprimirDoble] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);

  // Cargar productos de acceso rápido (más vendidos)
  useEffect(() => {
    if (false) return;
    if (true) return;
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

  // Si cambia forma de pago a cuenta corriente, seleccionar tipo venta cuenta corriente (salvo que ya sea venta_reparto)
  const handleFormaPagoChange = (forma: string) => {
    setFormaPago(forma);
    if (forma === "cuenta_corriente") {
      if (tipoVenta !== "venta_reparto") {
        setTipoVenta("cuenta_corriente");
      }
      if (!selectedClient) {
        setClientDropdownOpen(true);
      }
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

  // Helpers para parseo y formateo de moneda argentina
  const parseMoney = useCallback((val: string): number => {
    if (!val) return 0;
    const clean = val.replace(/\./g, "").replace(",", ".");
    return parseFloat(clean) || 0;
  }, []);

  const formatMoneyInput = useCallback((val: string): string => {
    let clean = val.replace(/[^0-9,]/g, "");
    const parts = clean.split(",");
    if (parts.length > 2) {
      clean = parts[0] + "," + parts.slice(1).join("");
    }
    let integerPart = parts[0];
    const decimalPart = parts[1] !== undefined ? "," + parts[1] : "";
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return integerPart + decimalPart;
  }, []);

  const formatMoneyNumber = useCallback((num: number): string => {
    return num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, []);

  // Saldo a favor disponible del cliente seleccionado
  const saldoAFavorCliente = useMemo(() => {
    if (!selectedClient) return 0;
    if (selectedClient.saldo_a_favor !== undefined && selectedClient.saldo_a_favor !== null) {
      return Math.max(0, Number(selectedClient.saldo_a_favor) || 0);
    }
    return selectedClient.balance < 0 ? Math.abs(selectedClient.balance) : 0;
  }, [selectedClient]);

  // Totales de pago mixto
  const efectivoNum = useMemo(() => parseMoney(pagoEfectivo), [pagoEfectivo, parseMoney]);
  const transfNum = useMemo(() => parseMoney(pagoTransferencia), [pagoTransferencia, parseMoney]);
  const tarjetaNum = useMemo(() => parseMoney(pagoTarjeta), [pagoTarjeta, parseMoney]);
  const ctaCteNum = useMemo(() => parseMoney(pagoCtaCte), [pagoCtaCte, parseMoney]);
  const saldoAFavorNum = useMemo(() => parseMoney(pagoSaldoAFavor), [pagoSaldoAFavor, parseMoney]);

  const totalCubiertoMixto = useMemo(() => {
    return Math.round((efectivoNum + transfNum + tarjetaNum + ctaCteNum + saldoAFavorNum) * 100) / 100;
  }, [efectivoNum, transfNum, tarjetaNum, ctaCteNum, saldoAFavorNum]);

  const restantePorCubrir = useMemo(() => {
    return Math.max(0, Math.round((totalFinal - totalCubiertoMixto) * 100) / 100);
  }, [totalFinal, totalCubiertoMixto]);

  const vueltoEfectivo = useMemo(() => {
    if (formaPago !== "mixto") return 0;
    const noEfectivo = transfNum + tarjetaNum + ctaCteNum + saldoAFavorNum;
    if (noEfectivo >= totalFinal) return 0;
    const efectivoNecesario = Math.max(0, Math.round((totalFinal - noEfectivo) * 100) / 100);
    return Math.max(0, Math.round((efectivoNum - efectivoNecesario) * 100) / 100);
  }, [formaPago, totalFinal, efectivoNum, transfNum, tarjetaNum, ctaCteNum, saldoAFavorNum]);

  const handleDesgloseChange = (metodo: "efectivo" | "transferencia" | "tarjeta" | "cta_corriente" | "saldo_a_favor", val: string) => {
    const formatted = formatMoneyInput(val);
    if (metodo === "efectivo") setPagoEfectivo(formatted);
    else if (metodo === "transferencia") setPagoTransferencia(formatted);
    else if (metodo === "tarjeta") setPagoTarjeta(formatted);
    else if (metodo === "cta_corriente") setPagoCtaCte(formatted);
    else if (metodo === "saldo_a_favor") setPagoSaldoAFavor(formatted);
  };

  const handleLlenarRestante = (metodo: "efectivo" | "transferencia" | "tarjeta" | "cta_corriente" | "saldo_a_favor") => {
    let otros = 0;
    if (metodo !== "efectivo") otros += efectivoNum;
    if (metodo !== "transferencia") otros += transfNum;
    if (metodo !== "tarjeta") otros += tarjetaNum;
    if (metodo !== "cta_corriente") otros += ctaCteNum;
    if (metodo !== "saldo_a_favor") otros += saldoAFavorNum;

    const faltante = Math.max(0, Math.round((totalFinal - otros) * 100) / 100);

    if (metodo === "efectivo") setPagoEfectivo(formatMoneyNumber(faltante));
    else if (metodo === "transferencia") setPagoTransferencia(formatMoneyNumber(faltante));
    else if (metodo === "tarjeta") setPagoTarjeta(formatMoneyNumber(faltante));
    else if (metodo === "cta_corriente") setPagoCtaCte(formatMoneyNumber(faltante));
    else if (metodo === "saldo_a_favor") {
      const aplicable = Math.min(saldoAFavorCliente, faltante);
      setPagoSaldoAFavor(formatMoneyNumber(aplicable));
    }
  };

  const handleLimpiarDesglose = () => {
    setPagoEfectivo("");
    setPagoTransferencia("");
    setPagoTarjeta("");
    setPagoCtaCte("");
    setPagoSaldoAFavor("");
  };

  // Formato input de pago con puntos de miles
  const handlePagoInputChange = (val: string) => {
    setUserEditedPago(true);
    setPagoInput(formatMoneyInput(val));
  };

  // Aplicar automáticamente el Saldo a Favor disponible a la venta actual
  const handleAplicarSaldoAFavor = useCallback(() => {
    if (saldoAFavorCliente <= 0 || totalFinal <= 0) return;
    setSaldoAFavorDescartado(false);

    if (totalFinal <= saldoAFavorCliente) {
      // El saldo a favor cubre la totalidad de la venta
      setFormaPago("saldo_a_favor");
      setPagoInput(formatMoneyNumber(totalFinal));
      setUserEditedPago(true);
    } else {
      // Cubre parte: pasar automáticamente a pago mixto
      setFormaPago("mixto");
      setPagoSaldoAFavor(formatMoneyNumber(saldoAFavorCliente));
      const resto = Math.max(0, Math.round((totalFinal - saldoAFavorCliente) * 100) / 100);
      if (tipoVenta === "cuenta_corriente") {
        setPagoCtaCte(formatMoneyNumber(resto));
        setPagoEfectivo("");
      } else {
        setPagoEfectivo(formatMoneyNumber(resto));
        setPagoCtaCte("");
      }
      setPagoTransferencia("");
      setPagoTarjeta("");
    }
  }, [saldoAFavorCliente, totalFinal, formatMoneyNumber, tipoVenta]);

  // ─── RESOLUCIÓN COMPLETA DE PRECIOS (MOSTRADOR / REPARTO / BAR / MAYORISTA) ───
  const getFullProduct = useCallback(
    (prod: any) => {
      const found = products.find((p) => p.id === prod.id);
      return { ...prod, ...(found || {}) };
    },
    [products]
  );

  const calcularPrecioProducto = useCallback(
    (prod: any, tipo: string, cliente: Client | null): number => {
      const fullProd = getFullProduct(prod);

      // 1. Prioridad: Precios especiales / por mayor para el cliente asignado
      if (cliente) {
        const preciosEsp = fullProd.precios_especiales || prod.precios_especiales;
        if (Array.isArray(preciosEsp) && preciosEsp.length > 0) {
          const today = new Date().toISOString().split("T")[0];
          const match = preciosEsp.find((pe: any) => {
            if (Number(pe.idcliente) !== Number(cliente.id)) return false;
            if (pe.fecha_desde && pe.fecha_desde > today) return false;
            if (pe.fecha_hasta && pe.fecha_hasta < today) return false;
            return true;
          });
          if (match && match.precio !== undefined && match.precio !== null && Number(match.precio) > 0) {
            return Number(match.precio);
          }
        }
      }

      // 2. Precios por canal de venta
      if (tipo === "venta_reparto") {
        if (fullProd.precio_reparto && Number(fullProd.precio_reparto) > 0) {
          return Number(fullProd.precio_reparto);
        }
        return Number(fullProd.precio_unitario ?? fullProd.price ?? 0);
      }

      if (tipo === "cuenta_corriente") {
        if (fullProd.precio_bar && Number(fullProd.precio_bar) > 0) {
          return Number(fullProd.precio_bar);
        }
        return Number(fullProd.precio_unitario ?? fullProd.price ?? 0);
      }

      // 3. Venta rápida / mostrador (por defecto)
      return Number(fullProd.precio_unitario ?? fullProd.price ?? 0);
    },
    [getFullProduct]
  );

  const getPrecioTipoLabel = useCallback(
    (item: PosItem) => {
      if (item.isManualPrice) {
        return { text: "Manual", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" };
      }
      const prod = getFullProduct(item);
      if (selectedClient) {
        const preciosEsp = prod.precios_especiales || (item as any).precios_especiales;
        if (Array.isArray(preciosEsp)) {
          const today = new Date().toISOString().split("T")[0];
          const match = preciosEsp.find((pe: any) =>
            Number(pe.idcliente) === Number(selectedClient.id) &&
            (!pe.fecha_desde || pe.fecha_desde <= today) &&
            (!pe.fecha_hasta || pe.fecha_hasta >= today)
          );
          if (match && Number(match.precio) === item.price) {
            return { text: "Mayorista", color: "text-purple-300 bg-purple-500/20 border-purple-500/40" };
          }
        }
      }
      if (tipoVenta === "cuenta_corriente" && prod.precio_bar && Number(prod.precio_bar) === item.price) {
        return { text: "Bar", color: "text-cyan-300 bg-cyan-500/20 border-cyan-500/40" };
      }
      if (tipoVenta === "venta_reparto" && prod.precio_reparto && Number(prod.precio_reparto) === item.price) {
        return { text: "Reparto", color: "text-blue-300 bg-blue-500/20 border-blue-500/40" };
      }
      return { text: "Mostrador", color: "text-zinc-400 bg-white/5 border-white/10" };
    },
    [getFullProduct, selectedClient, tipoVenta]
  );

  // Recalcular precios de ítems en carrito si cambia tipo de venta o cliente seleccionado (si no fue editado a mano)
  useEffect(() => {
    // Si estamos editando un pedido preexistente y aún no cambió nada, no sobreescribir
    if (editingPedido && !selectedClient) return;

    setSaleItems((prevItems) => {
      if (prevItems.length === 0) return prevItems;
      let hasChanges = false;
      const updated = prevItems.map((item) => {
        if (item.isManualPrice) return item;
        const newPrice = calcularPrecioProducto(item, tipoVenta, selectedClient);
        if (newPrice !== item.price) {
          hasChanges = true;
          return { ...item, price: newPrice };
        }
        return item;
      });
      return hasChanges ? updated : prevItems;
    });
  }, [tipoVenta, selectedClient, calcularPrecioProducto, editingPedido]);

  // ─── AGREGAR PRODUCTO A LA VENTA ─────────────────────────────────────────────
  const agregarProducto = (prod: Product | any) => {
    const fullProd = getFullProduct(prod);
    const existingIndex = saleItems.findIndex((i) => i.id === fullProd.id);

    // Determinar precio según tipo de venta y cliente
    const precioBase = calcularPrecioProducto(fullProd, tipoVenta, selectedClient);

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
        id: fullProd.id,
        name: fullProd.name || fullProd.nombre,
        codigo: fullProd.codigo,
        stock: fullProd.stock_local ?? fullProd.quantity ?? fullProd.stock ?? 0,
        price: Number(precioBase) || 0,
        quantity: 1,
        unidad_medida: fullProd.unidad_medida || "unidades",
        isManualPrice: false,
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
      next[index].isManualPrice = true;
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

    if (!tipoVenta) {
      alert("Elegí primero el tipo de venta.");
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

    // Consulta proactiva si el cliente posee saldo a favor y no lo ha aplicado
    if (
      selectedClient &&
      saldoAFavorCliente > 0 &&
      formaPago !== "saldo_a_favor" &&
      saldoAFavorNum <= 0 &&
      !saldoAFavorDescartado
    ) {
      if (formaPago === "cuenta_corriente") {
        const aplicar = window.confirm(
          `Atención: ${selectedClient.name} tiene $${formatMoneyNumber(saldoAFavorCliente)} de Saldo a Favor disponible.\n\n¿Deseas descontar esta compra de su saldo a favor en lugar de enviarla a Cuenta Corriente?`
        );
        if (aplicar) {
          handleAplicarSaldoAFavor();
          return;
        } else {
          setSaldoAFavorDescartado(true);
        }
      }
    }

    if (formaPago === "saldo_a_favor") {
      if (!selectedClient) {
        alert("Para pagar con Saldo a Favor debés seleccionar un cliente.");
        setClientDropdownOpen(true);
        return;
      }
      if (saldoAFavorCliente < totalFinal) {
        alert(`El saldo a favor disponible ($${saldoAFavorCliente.toFixed(2)}) no alcanza para cubrir el total ($${totalFinal.toFixed(2)}). Podés usar Pago Dividido / Mixto para combinarlo con efectivo u otro medio.`);
        return;
      }
    }

    if (formaPago === "mixto") {
      if (restantePorCubrir > 0.01) {
        alert(`El monto asignado ($${totalCubiertoMixto.toFixed(2)}) no cubre el total de la venta ($${totalFinal.toFixed(2)}). Asigná el resto a un método de pago o a Cuenta Corriente.`);
        return;
      }
      if (ctaCteNum > 0 && !selectedClient) {
        alert("Para asignar parte del cobro a Cuenta Corriente debés seleccionar un cliente.");
        setClientDropdownOpen(true);
        return;
      }
      if (saldoAFavorNum > 0 && !selectedClient) {
        alert("Para utilizar Saldo a Favor debés seleccionar un cliente.");
        setClientDropdownOpen(true);
        return;
      }
    }

    setLoadingCobro(true);
    try {
      // ── Modo edición: actualizar el pedido existente ──
      if (editingPedido) {
        const resEdit = await fetch(`${apiUrl}/pedidos/${editingPedido.id}/editar`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            cart: saleItems.map((item) => ({
              id: item.id,
              quantity: item.quantity,
              price: item.price,
            })),
            total: totalFinal,
          }),
        });
        const dataEdit = await resEdit.json();
        if (resEdit.ok && dataEdit.success) {
          setSaleItems([]);
          setEsPedido(false);
          setSelectedClient(null);
          setTipoVenta("venta_rapida");
          setUserEditedPago(false);
          setPagoInput("");
          setPagoEfectivo("");
          setPagoTransferencia("");
          setPagoTarjeta("");
          setPagoCtaCte("");
          setPagoSaldoAFavor("");
          setDejarVueltoComoSaldoAFavor(false);
          onVentaExitosa();
          onEditFinished?.();
        } else {
          alert(dataEdit.message || dataEdit.error || "Error al actualizar el pedido");
        }
        return;
      }

      const totalCobradoContado = Math.round((efectivoNum + transfNum + tarjetaNum) * 100) / 100;

      const payload: any = {
        cart: saleItems.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          price: item.price,
        })),
        total: totalFinal,
        idcliente: selectedClient?.id ?? null,
        tipo_venta: formaPago === "mixto" && ctaCteNum > 0 && selectedClient && tipoVenta !== "venta_reparto" ? "cuenta_corriente" : tipoVenta,
        descuento,
        recargo,
        pago: esPedido ? anticipo : (formaPago === "mixto" ? totalCobradoContado : (formaPago === "saldo_a_favor" ? 0 : pagoNum)),
        forma_de_pago: formaPago,
        pago_saldo_a_favor: formaPago === "saldo_a_favor" ? Math.min(totalFinal, saldoAFavorCliente) : (formaPago === "mixto" ? saldoAFavorNum : 0),
        dejar_saldo_a_favor: dejarVueltoComoSaldoAFavor,
        es_pedido: esPedido,
        fecha_entrega: esPedido ? fechaEntrega : null,
        notas: ventaConReposicion ? "Venta con reposición de mercadería" : null,
      };

      if (formaPago === "mixto") {
        payload.pagos_desglose = {
          efectivo: efectivoNum,
          transferencia: transfNum,
          tarjeta: tarjetaNum,
          cta_corriente: ctaCteNum,
          saldo_a_favor: saldoAFavorNum,
        };
      }

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
        setPagoEfectivo("");
        setPagoTransferencia("");
        setPagoTarjeta("");
        setPagoCtaCte("");
        setPagoSaldoAFavor("");
        setDejarVueltoComoSaldoAFavor(false);
        setDescuento(0);
        setRecargo(0);
        setAnticipo(0);
        setEsPedido(false);
        setVentaConReposicion(false);
        if (tipoVenta === "cuenta_corriente") setSelectedClient(null);
        onVentaExitosa();
        onReutilizarFinished?.();
      } else {
        const errorMsg = data.error && data.message !== data.error 
          ? `${data.message} (${data.error})` 
          : (data.message || data.error || "Error al registrar venta");
        alert(errorMsg);
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
      {/* ─── BANNER MODO EDICIÓN ──────────────────────────────────────── */}
      {editingPedido && (
        <div className="rounded-2xl border border-brand-red/30 bg-brand-red/10 p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-brand-yellow font-bold uppercase tracking-wider">Modo Edición</p>
            <p className="text-sm font-semibold text-white">Pedido #{editingPedido.id}</p>
            <p className="text-xs text-zinc-400">{editingPedido.cliente?.name ?? "Consumidor Final"}</p>
          </div>
          <button
            type="button"
            onClick={cancelarEdicion}
            className="bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold px-3 py-2 rounded-xl text-zinc-300 transition-all active:scale-95"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* ─── BANNER REUTILIZAR PEDIDO (NUEVA VENTA) ────────────────────────── */}
      {reutilizarPedido && !editingPedido && (
        <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4 flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <Repeat className="h-5 w-5 text-purple-400 shrink-0" />
            <div>
              <p className="text-xs text-purple-300 font-bold uppercase tracking-wider">Reutilizando Pedido para Nueva Venta</p>
              <p className="text-sm font-semibold text-white">
                Cliente: {reutilizarPedido.cliente?.name ?? "Consumidor Final"} ({saleItems.length} productos cargados)
              </p>
              <p className="text-xs text-zinc-400">Podés agregar, quitar o editar cantidades antes de confirmar.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSaleItems([]);
              setSelectedClient(null);
              setEsPedido(false);
              onReutilizarFinished?.();
            }}
            className="bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold px-3 py-2 rounded-xl text-zinc-300 transition-all active:scale-95 cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      )}

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
                className={`rounded-xl border text-xs sm:text-sm font-bold text-white outline-none transition-all cursor-pointer ${
                  !tipoVenta
                    ? "bg-brand-red/20 border-brand-red/60 animate-pulse text-brand-yellow focus:border-brand-red"
                    : "bg-black/50 border-white/20 focus:border-brand-red"
                }`}
                style={{ height: "2.75rem", padding: "0 1rem" }}
              >
                <option value="" disabled className="bg-zinc-900 text-zinc-400">
                  👉 Seleccionar Tipo de Venta...
                </option>
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
                  {selectedClient.balance > 0 && (
                    <span
                      className="text-[11px] font-black rounded-lg bg-red-500/20 text-red-300"
                      style={{ padding: "0.2rem 0.5rem" }}
                    >
                      -${selectedClient.balance.toLocaleString("es-AR")}
                    </span>
                  )}
                  {saldoAFavorCliente > 0 && (
                    <span
                      className="text-[11px] font-black rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      style={{ padding: "0.2rem 0.5rem" }}
                    >
                      +${saldoAFavorCliente.toLocaleString("es-AR", { minimumFractionDigits: 2 })} a favor
                    </span>
                  )}
                  {selectedClient.balance === 0 && saldoAFavorCliente === 0 && (
                    <span
                      className="text-[11px] font-black rounded-lg bg-emerald-500/20 text-emerald-300"
                      style={{ padding: "0.2rem 0.5rem" }}
                    >
                      Al día ($0)
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClient(null);
                      if (tipoVenta === "cuenta_corriente") setTipoVenta("venta_rapida");
                    }}
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
                        .map((c) => {
                          const cSaldoAFavor = (c.saldo_a_favor !== undefined && c.saldo_a_favor !== null)
                            ? Number(c.saldo_a_favor)
                            : (c.balance < 0 ? Math.abs(c.balance) : 0);
                          return (
                            <div
                              key={c.id}
                              onClick={() => {
                                setSelectedClient(c);
                                if (tipoVenta !== "venta_reparto") {
                                  setTipoVenta("cuenta_corriente");
                                }
                                setClientSearch("");
                                setClientDropdownOpen(false);
                              }}
                              className="hover:bg-white/10 cursor-pointer flex justify-between items-center text-xs sm:text-sm transition-colors"
                              style={{ padding: "0.75rem 1rem" }}
                            >
                              <span className="font-semibold text-white truncate" style={{ marginRight: "0.5rem" }}>{c.name}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {cSaldoAFavor > 0 && (
                                  <span className="text-emerald-400 font-bold">
                                    +${cSaldoAFavor.toLocaleString("es-AR")} a favor
                                  </span>
                                )}
                                {c.balance > 0 && (
                                  <span className="text-red-400 font-bold">
                                    Debe ${c.balance.toLocaleString("es-AR")}
                                  </span>
                                )}
                                {c.balance === 0 && cSaldoAFavor === 0 && (
                                  <span className="text-emerald-400 font-bold">
                                    Al día
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
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

        {/* Banner Proactivo: Cliente con Saldo a Favor disponible */}
        {selectedClient && saldoAFavorCliente > 0 && formaPago !== "saldo_a_favor" && saldoAFavorNum <= 0 && !saldoAFavorDescartado && (
          <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/80 via-emerald-900/50 to-zinc-950 p-3 sm:p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-lg shadow-emerald-950/30 animate-fadeIn my-1">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                <span className="text-base sm:text-lg">⭐</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                    ¡{selectedClient.name} tiene Saldo a Favor!
                  </span>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    ${formatMoneyNumber(saldoAFavorCliente)} disponible
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-zinc-300 mt-0.5">
                  {totalFinal > 0 
                    ? "¿Deseas aplicar este crédito para pagar la compra actual?" 
                    : "Crédito a favor disponible. Se puede aplicar automáticamente a esta venta."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-auto">
              <button
                type="button"
                onClick={handleAplicarSaldoAFavor}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-emerald-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>⚡</span> Usar Saldo a Favor
              </button>
              <button
                type="button"
                onClick={() => setSaldoAFavorDescartado(true)}
                className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-xs font-semibold transition-all cursor-pointer"
                title="Descartar aviso para esta venta"
              >
                No usar
              </button>
            </div>
          </div>
        )}

        {/* Fila 2: Formas de Pago, Ajustes, y Bloque de Cobro */}
        <div
          className="flex flex-col xl:flex-row xl:items-center justify-between"
          style={{ gap: "1.5rem", paddingTop: "0.25rem" }}
        >
          {/* Ajustes de Pago */}
          <div className="flex flex-wrap items-end flex-1" style={{ gap: "1rem" }}>
            {/* Forma de Pago */}
            <div className="flex items-end gap-1.5">
              <div>
                <label className="block text-[11px] uppercase tracking-wider font-bold text-zinc-400" style={{ marginBottom: "0.4rem" }}>Forma Pago</label>
                <select
                  value={formaPago}
                  onChange={(e) => handleFormaPagoChange(e.target.value)}
                  className={`rounded-xl border text-xs sm:text-sm font-bold text-white outline-none focus:border-brand-red transition-all cursor-pointer ${
                    formaPago === "saldo_a_favor"
                      ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-300"
                      : formaPago === "mixto"
                      ? "bg-amber-500/20 border-amber-500/60 text-amber-300"
                      : "bg-black/50 border-white/20"
                  }`}
                  style={{ height: "2.75rem", padding: "0 1rem" }}
                >
                  <option value="efectivo" className="bg-zinc-900">💵 Efectivo</option>
                  <option value="transferencia" className="bg-zinc-900">🏦 Transferencia</option>
                  <option value="cuenta_corriente" className="bg-zinc-900">📝 Cta. Corriente</option>
                  <option value="tarjeta" className="bg-zinc-900">💳 Débito / Tarjeta</option>
                  {saldoAFavorCliente > 0 && (
                    <option value="saldo_a_favor" className="bg-zinc-900 font-bold text-emerald-300">
                      ⭐ Saldo a Favor (${saldoAFavorCliente.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                    </option>
                  )}
                  <option value="mixto" className="bg-zinc-900 font-bold text-amber-300">🔀 Dividido / Mixto</option>
                </select>
              </div>
              {saldoAFavorCliente > 0 && (
                <button
                  type="button"
                  onClick={handleAplicarSaldoAFavor}
                  className={`rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    formaPago === "saldo_a_favor"
                      ? "bg-emerald-500 text-zinc-950 font-black shadow-md shadow-emerald-500/20"
                      : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
                  }`}
                  style={{ height: "2.75rem", padding: "0 0.85rem" }}
                  title="Pagar con Saldo a Favor disponible"
                >
                  <span>⭐</span>
                  <span className="hidden sm:inline">Saldo (${formatMoneyNumber(saldoAFavorCliente)})</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleFormaPagoChange(formaPago === "mixto" ? "efectivo" : "mixto")}
                className={`rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  formaPago === "mixto"
                    ? "bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-md shadow-amber-500/10"
                    : "bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10"
                }`}
                style={{ height: "2.75rem", padding: "0 0.85rem" }}
                title="Dividir el cobro en múltiples medios de pago"
              >
                <span>🔀</span>
                <span className="hidden sm:inline">Mixto</span>
              </button>
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

            {/* Paga con / Cubierto */}
            {formaPago === "mixto" ? (
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wider font-bold text-zinc-400 leading-none" style={{ marginBottom: "0.35rem" }}>Cubierto</p>
                <p className="text-xl sm:text-2xl font-black text-amber-300 font-mono leading-none tracking-tight">
                  ${totalCubiertoMixto.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            ) : (
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
            )}

            <div className="w-px bg-white/15" style={{ height: "2.5rem" }} />

            {/* Vuelto / Saldo / Falta */}
            {formaPago === "mixto" ? (
              <div className="text-right" style={{ minWidth: "5.5rem" }}>
                <p className="text-[11px] uppercase tracking-wider font-bold text-zinc-400 leading-none" style={{ marginBottom: "0.35rem" }}>
                  {vueltoEfectivo > 0 ? "Vuelto Ef." : restantePorCubrir > 0.001 ? "Falta" : "Estado"}
                </p>
                <p
                  className={`text-base sm:text-xl font-black font-mono leading-none tracking-tight ${
                    vueltoEfectivo > 0
                      ? "text-emerald-400 font-extrabold"
                      : restantePorCubrir > 0.001
                      ? "text-red-400 animate-pulse"
                      : "text-emerald-400"
                  }`}
                >
                  {vueltoEfectivo > 0
                    ? `$${vueltoEfectivo.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : restantePorCubrir > 0.001
                    ? `$${restantePorCubrir.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : "OK"}
                </p>
              </div>
            ) : (
              <div className="text-right flex flex-col items-end" style={{ minWidth: "5.5rem" }}>
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
                {vuelto > 0 && selectedClient && (
                  <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-emerald-300 font-bold select-none bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md hover:bg-emerald-500/25 transition-all mt-1">
                    <input
                      type="checkbox"
                      checked={dejarVueltoComoSaldoAFavor}
                      onChange={(e) => setDejarVueltoComoSaldoAFavor(e.target.checked)}
                      className="w-3 h-3 rounded border-emerald-500 text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                    <span>Dejar a favor</span>
                  </label>
                )}
              </div>
            )}

            <div className="w-px bg-white/15 hidden sm:block" style={{ height: "2.5rem" }} />

            {/* Botón Cobrar */}
            <button
              onClick={handleCobrarVenta}
              disabled={loadingCobro || saleItems.length === 0 || (formaPago === "mixto" && restantePorCubrir > 0.01)}
              className={`rounded-xl font-black text-sm sm:text-base uppercase tracking-wider text-white shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${
                saleItems.length === 0 || (formaPago === "mixto" && restantePorCubrir > 0.01)
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-white/5 opacity-60"
                  : esPedido
                  ? "bg-amber-600 hover:bg-amber-500 shadow-amber-600/30 hover:scale-[1.02]"
                  : "bg-purple-600 hover:bg-purple-500 shadow-purple-600/30 border border-purple-400/40 hover:scale-[1.02]"
              }`}
              style={{ height: "3rem", padding: "0 2rem" }}
            >
              {loadingCobro ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : editingPedido ? (
                <>💾 Guardar cambios</>
              ) : esPedido ? (
                <>📅 Reservar</>
              ) : formaPago === "mixto" && restantePorCubrir > 0.01 ? (
                <span className="text-xs">Falta ${restantePorCubrir.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              ) : (
                <>⚡ Cobrar</>
              )}
            </button>
          </div>
        </div>

        {/* ─── DESGLOSE PAGO MIXTO EXPANDIBLE ──────────────────────────────────── */}
        {formaPago === "mixto" && (
          <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-3 animate-fadeIn">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <span>🔀</span> Desglose de Pago Mixto:
                </span>
                <span className="text-[11px] text-zinc-400 hidden sm:inline">
                  (Asigná los montos correspondientes a cada medio de pago)
                </span>
              </div>
              <div className="flex items-center gap-2">
                {restantePorCubrir > 0.001 ? (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                    ⚠️ Restan cubrir: ${restantePorCubrir.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                ) : (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Total Cubierto
                  </span>
                )}
                {vueltoEfectivo > 0.001 && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    💵 Vuelto Ef.: ${vueltoEfectivo.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleLimpiarDesglose}
                  className="text-[11px] text-zinc-400 hover:text-zinc-200 underline cursor-pointer ml-1"
                >
                  Limpiar
                </button>
              </div>
            </div>

            <div className={`grid grid-cols-1 sm:grid-cols-2 ${(saldoAFavorCliente > 0 || selectedClient) ? "lg:grid-cols-3 xl:grid-cols-5" : "lg:grid-cols-4"} gap-3`}>
              {/* 1. Efectivo */}
              <div className="bg-black/50 border border-white/10 rounded-2xl p-3 flex flex-col gap-2 hover:border-emerald-500/40 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    💵 Efectivo
                  </span>
                  <button
                    type="button"
                    onClick={() => handleLlenarRestante("efectivo")}
                    className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 active:scale-95 transition-all cursor-pointer"
                    title="Asignar todo el restante a efectivo"
                  >
                    Llenar Resto
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-mono text-sm">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={pagoEfectivo}
                    onChange={(e) => handleDesgloseChange("efectivo", e.target.value)}
                    placeholder="0,00"
                    className="w-full pl-7 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/15 text-white font-mono text-sm font-bold text-right outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                  />
                </div>
              </div>

              {/* 2. Transferencia / QR */}
              <div className="bg-black/50 border border-white/10 rounded-2xl p-3 flex flex-col gap-2 hover:border-sky-500/40 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    🏦 Transferencia / QR
                  </span>
                  <button
                    type="button"
                    onClick={() => handleLlenarRestante("transferencia")}
                    className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 active:scale-95 transition-all cursor-pointer"
                    title="Asignar todo el restante a transferencia"
                  >
                    Llenar Resto
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-mono text-sm">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={pagoTransferencia}
                    onChange={(e) => handleDesgloseChange("transferencia", e.target.value)}
                    placeholder="0,00"
                    className="w-full pl-7 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/15 text-white font-mono text-sm font-bold text-right outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                  />
                </div>
              </div>

              {/* 3. Débito / Tarjeta */}
              <div className="bg-black/50 border border-white/10 rounded-2xl p-3 flex flex-col gap-2 hover:border-purple-500/40 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    💳 Débito / Tarjeta
                  </span>
                  <button
                    type="button"
                    onClick={() => handleLlenarRestante("tarjeta")}
                    className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 active:scale-95 transition-all cursor-pointer"
                    title="Asignar todo el restante a tarjeta"
                  >
                    Llenar Resto
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-mono text-sm">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={pagoTarjeta}
                    onChange={(e) => handleDesgloseChange("tarjeta", e.target.value)}
                    placeholder="0,00"
                    className="w-full pl-7 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/15 text-white font-mono text-sm font-bold text-right outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                  />
                </div>
              </div>

              {/* 4. Cuenta Corriente */}
              <div className={`bg-black/50 border rounded-2xl p-3 flex flex-col gap-2 transition-colors ${
                selectedClient ? "border-white/10 hover:border-amber-500/40" : "border-white/5 opacity-70"
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5 truncate" title={selectedClient ? selectedClient.name : "Requiere cliente"}>
                    📝 Cta. Cte. {selectedClient ? `(${selectedClient.name.split(" ")[0]})` : ""}
                  </span>
                  {selectedClient ? (
                    <button
                      type="button"
                      onClick={() => handleLlenarRestante("cta_corriente")}
                      className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 active:scale-95 transition-all cursor-pointer"
                      title="Dejar resto al fiado en cuenta corriente"
                    >
                      Llenar Resto
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setClientDropdownOpen(true)}
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-zinc-400 hover:text-white"
                    >
                      + Cliente
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-mono text-sm">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    disabled={!selectedClient}
                    value={pagoCtaCte}
                    onChange={(e) => handleDesgloseChange("cta_corriente", e.target.value)}
                    placeholder={selectedClient ? "0,00" : "Elegir cliente"}
                    className="w-full pl-7 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/15 text-white font-mono text-sm font-bold text-right outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 disabled:cursor-not-allowed disabled:placeholder:text-zinc-600"
                  />
                </div>
              </div>

              {/* 5. Saldo a Favor (Crédito Acreedor) */}
              {(saldoAFavorCliente > 0 || selectedClient) && (
                <div className={`bg-black/50 border rounded-2xl p-3 flex flex-col gap-2 transition-colors ${
                  saldoAFavorCliente > 0 ? "border-emerald-500/30 hover:border-emerald-500/60" : "border-white/5 opacity-60"
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5 truncate" title={`Disponible: $${saldoAFavorCliente.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
                      ⭐ A Favor ({saldoAFavorCliente > 0 ? `$${saldoAFavorCliente.toLocaleString("es-AR", { minimumFractionDigits: 0 })}` : "$0"})
                    </span>
                    {saldoAFavorCliente > 0 ? (
                      <button
                        type="button"
                        onClick={() => handleLlenarRestante("saldo_a_favor")}
                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 active:scale-95 transition-all cursor-pointer"
                        title="Usar saldo a favor del cliente"
                      >
                        Usar
                      </button>
                    ) : (
                      <span className="text-[10px] text-zinc-500 font-semibold">$0 disp.</span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-mono text-sm">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={saldoAFavorCliente <= 0}
                      value={pagoSaldoAFavor}
                      onChange={(e) => handleDesgloseChange("saldo_a_favor", e.target.value)}
                      placeholder={saldoAFavorCliente > 0 ? "0,00" : "Sin saldo"}
                      className="w-full pl-7 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/15 text-white font-mono text-sm font-bold text-right outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 disabled:cursor-not-allowed disabled:placeholder:text-zinc-600"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── ÁREA DE BÚSQUEDA Y ACCESOS RÁPIDOS (CHIPS) ────────────────────────── */}
      {!tipoVenta ? (
        <div
          className="rounded-3xl border border-dashed border-white/20 bg-zinc-900/60 p-8 flex flex-col items-center justify-center text-center shadow-xl backdrop-blur-md"
          style={{ minHeight: "180px", gap: "0.75rem" }}
        >
          <div className="bg-brand-yellow/10 border border-brand-yellow/30 rounded-2xl p-3 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-brand-yellow animate-bounce" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-white">
            Primero seleccioná el Tipo de Venta
          </h3>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-md">
            Elegí si es <b className="text-zinc-200">Venta Rápida</b>, <b className="text-zinc-200">Cuenta Corriente</b> o <b className="text-zinc-200">Reparto</b> en el selector superior para habilitar el buscador de productos y aplicar la lista de precios correspondiente.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setTipoVenta("venta_rapida")}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white transition-all active:scale-95 cursor-pointer"
            >
              ⚡ Rápida (Mostrador)
            </button>
            <button
              type="button"
              onClick={() => {
                setTipoVenta("cuenta_corriente");
                setClientDropdownOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white transition-all active:scale-95 cursor-pointer"
            >
              👤 Cta. Cte. (Cliente)
            </button>
            <button
              type="button"
              onClick={() => setTipoVenta("venta_reparto")}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white transition-all active:scale-95 cursor-pointer"
            >
              🚚 Reparto
            </button>
          </div>
        </div>
      ) : (
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
                          {p.codigo ? `Cód: ${p.codigo}` : ""} · Precio: ${calcularPrecioProducto(p, tipoVenta, selectedClient)}
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
                  const chipPrice = calcularPrecioProducto(prod, tipoVenta, selectedClient);
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
                        ${chipPrice}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

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
                  const priceLabel = getPrecioTipoLabel(item);
                  return (
                    <tr key={`${item.id}-${index}`} className="hover:bg-white/[0.03] transition-colors group">
                      {/* Producto */}
                      <td style={{ padding: "1rem 1.5rem" }}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-white">{item.name}</p>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${priceLabel.color}`}>
                            {priceLabel.text}
                          </span>
                        </div>
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
