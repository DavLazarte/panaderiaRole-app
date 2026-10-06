"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, CircleDollarSign, AlertCircle, Building2, Calendar, Receipt, Check, ArrowRight } from "lucide-react";

export interface Proveedor {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  mail?: string;
  balance: number;
  fecha_mas_antigua?: string | null;
  compras_pendientes: number;
  total_compras: number;
}

export interface CompraProveedor {
  id: number;
  fecha: string;
  num_recibo: string;
  tipo_compra: string;
  tipo_pago: string;
  total: number;
  pago: number;
  saldo: number;
  estado: string;
  items: string;
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

// ─── Modal de Detalle de Proveedor (Historial de Compras y Deuda) ────────────
export function ProveedorDetalleModal({
  proveedor,
  token,
  apiUrl,
  onClose,
  onCargarPago,
}: {
  proveedor: Proveedor;
  token: string;
  apiUrl: string;
  onClose: () => void;
  onCargarPago: (proveedor: Proveedor) => void;
}) {
  const [compras, setCompras] = useState<CompraProveedor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${apiUrl}/proveedores/${proveedor.id}/compras`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setCompras(Array.isArray(data) ? data : []))
      .catch(() => setCompras([]))
      .finally(() => setLoading(false));
  }, [proveedor.id, token, apiUrl]);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-t-3xl md:rounded-3xl border-t md:border border-white/10 bg-zinc-950 p-6 pb-10 md:pb-6 shadow-2xl overflow-y-auto transition-all"
        style={{ maxHeight: "85vh" }}
      >
        <div className="mx-auto mb-5 h-1 w-12 rounded-full bg-white/20 md:hidden" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-red/10 border border-brand-red/20 flex items-center justify-center text-brand-yellow">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{proveedor.name}</h2>
              <p className="text-xs text-zinc-400">
                {proveedor.address || "Sin dirección"} {proveedor.phone ? `• Tel: ${proveedor.phone}` : ""}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
            <X className="h-5 w-5 text-zinc-400" />
          </button>
        </div>

        {/* Resumen de Deuda */}
        <div
          className={`rounded-2xl p-4 flex justify-between items-center mb-5 ${
            proveedor.balance > 0 ? "bg-red-500/10 border border-red-500/30" : "bg-emerald-500/10 border border-emerald-500/30"
          }`}
        >
          <div>
            <span className="text-xs font-medium text-zinc-400 block">Deuda total a pagar</span>
            <span className={`text-2xl font-bold ${proveedor.balance > 0 ? "text-red-300" : "text-emerald-300"}`}>
              {proveedor.balance > 0 ? `-$${proveedor.balance.toLocaleString("es-AR")}` : "Al día ✓"}
            </span>
            {proveedor.fecha_mas_antigua && proveedor.balance > 0 && (
              <span className="text-[11px] text-zinc-400 block mt-0.5">
                Desde: {new Date(proveedor.fecha_mas_antigua).toLocaleDateString("es-AR")}
              </span>
            )}
          </div>
          {proveedor.balance > 0 && (
            <button
              onClick={() => onCargarPago(proveedor)}
              className="bg-brand-red hover:bg-red-600 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-brand-red/20 active:scale-95 text-xs transition-all flex items-center gap-1.5 shrink-0"
            >
              <CircleDollarSign className="h-4 w-4" /> Registrar Pago
            </button>
          )}
        </div>

        {/* Listado de Compras */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs text-zinc-400 uppercase tracking-widest font-semibold flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5" /> Compras / Facturas Recientes
          </h3>
          <span className="text-xs text-zinc-500">
            {compras.filter((c) => c.saldo > 0).length} con saldo pendiente
          </span>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : compras.length === 0 ? (
          <p className="text-center text-zinc-500 text-sm mt-6 py-4 bg-white/5 rounded-2xl border border-white/5">
            Sin compras registradas para este proveedor
          </p>
        ) : (
          <div className="space-y-3">
            {compras.map((c) => (
              <div key={c.id} className="rounded-2xl border border-white/10 bg-white/5 p-3.5 transition-all">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{c.num_recibo}</span>
                      <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-zinc-300 font-medium">
                        {c.fecha}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{c.items}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-bold text-white">${c.total.toLocaleString("es-AR")}</p>
                    {c.saldo > 0 ? (
                      <p className="text-xs font-semibold text-red-400 mt-0.5">
                        Debe ${c.saldo.toLocaleString("es-AR")}
                      </p>
                    ) : (
                      <p className="text-xs font-semibold text-emerald-400 mt-0.5">Pagado ✓</p>
                    )}
                  </div>
                </div>
                <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-xs text-zinc-400">
                  <span>Tipo: <b className="text-zinc-300 capitalize">{c.tipo_compra}</b></span>
                  <span>Pagó: <b className="text-zinc-300">${c.pago.toLocaleString("es-AR")}</b></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Modal Cargar Pago a Proveedor (Registra Salida) ────────────────────────
export function CargarPagoProveedorModal({
  proveedor,
  token,
  apiUrl,
  onClose,
  onSuccess,
}: {
  proveedor: Proveedor;
  token: string;
  apiUrl: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [monto, setMonto] = useState("");
  const [tipoPago, setTipoPago] = useState<string>("efectivo");
  const [impactaCaja, setImpactaCaja] = useState<boolean>(true);
  const [descripcion, setDescripcion] = useState("");
  const [compras, setCompras] = useState<CompraProveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [selectedCompraIds, setSelectedCompraIds] = useState<number[]>([]);

  useEffect(() => {
    fetch(`${apiUrl}/proveedores/${proveedor.id}/compras?only_debt=true`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setCompras(Array.isArray(data) ? data : []);
      })
      .catch(() => setCompras([]))
      .finally(() => setLoading(false));
  }, [proveedor.id, token, apiUrl]);

  const toggleCompra = (id: number) => {
    setSelectedCompraIds((prev) =>
      prev.includes(id) ? prev.filter((cId) => cId !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    if (selectedCompraIds.length > 0) {
      const sum = compras
        .filter((c) => selectedCompraIds.includes(c.id))
        .reduce((s, c) => s + c.saldo, 0);
      setMonto(formatPaymentInput(sum.toString().replace(".", ",")));
    } else {
      setMonto("");
    }
  }, [selectedCompraIds, compras]);

  const targetCompras = useMemo(() => {
    return selectedCompraIds.length > 0
      ? compras.filter((c) => selectedCompraIds.includes(c.id))
      : compras;
  }, [compras, selectedCompraIds]);

  const totalSaldos = useMemo(() => {
    return targetCompras.reduce((s, c) => s + c.saldo, 0);
  }, [targetCompras]);

  const distribution = useMemo(() => {
    const amountNum = parsePaymentInput(monto);
    let remaining = amountNum;
    const sorted = [...targetCompras].sort((a, b) => a.id - b.id);
    const distResult: any[] = [];

    sorted.forEach((c) => {
      const allocated = Math.min(c.saldo, remaining);
      remaining -= allocated;
      distResult.push({
        ...c,
        allocated,
        newSaldo: Math.round((c.saldo - allocated) * 100) / 100,
      });
    });

    return distResult;
  }, [targetCompras, monto]);

  const newTotalBalance = useMemo(() => {
    const amountNum = parsePaymentInput(monto);
    return Math.max(0, Math.round((totalSaldos - amountNum) * 100) / 100);
  }, [totalSaldos, monto]);

  const vuelto = useMemo(() => {
    const amountNum = parsePaymentInput(monto);
    return Math.max(0, Math.round((amountNum - totalSaldos) * 100) / 100);
  }, [totalSaldos, monto]);

  const handleConfirm = async () => {
    const amountNum = parsePaymentInput(monto);
    if (amountNum <= 0) {
      alert("Por favor ingrese un monto válido.");
      return;
    }

    setLoadingSubmit(true);
    try {
      const res = await fetch(`${apiUrl}/proveedores/${proveedor.id}/pagar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          monto: amountNum,
          tipo_pago_salida: tipoPago,
          impacta_caja: impactaCaja,
          descripcion: descripcion.trim() || undefined,
          compras_seleccionadas: selectedCompraIds.length > 0 ? selectedCompraIds : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onSuccess();
      } else {
        alert(data.message || "Error al registrar el pago");
      }
    } catch {
      alert("Error de conexión al procesar el pago");
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-t-3xl md:rounded-3xl border-t md:border border-white/10 bg-zinc-950 p-6 pb-10 md:pb-6 shadow-2xl overflow-y-auto transition-all"
        style={{ maxHeight: "88vh" }}
      >
        <div className="mx-auto mb-5 h-1 w-12 rounded-full bg-white/20 md:hidden" />

        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Registrar Salida / Pago a Proveedor</h2>
            <p className="text-xs text-zinc-400 mt-0.5">{proveedor.name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10">
            <X className="h-5 w-5 text-zinc-400" />
          </button>
        </div>

        {loading ? (
          <div className="space-y-3 py-6">
            <div className="h-12 rounded-xl bg-white/5 animate-pulse" />
            <div className="h-12 rounded-xl bg-white/5 animate-pulse" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Monto del Pago */}
            <div>
              <label className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5 block font-semibold">
                Monto del Pago (Salida)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-yellow font-bold text-lg">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={monto}
                  onChange={(e) => setMonto(formatPaymentInput(e.target.value))}
                  placeholder="Ej: 25.000"
                  className="w-full h-12 rounded-xl bg-white/5 border border-white/10 pl-9 pr-4 font-bold outline-none focus:border-brand-red text-white text-base"
                />
              </div>
            </div>

            {/* Forma de Pago */}
            <div>
              <label className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5 block font-semibold">
                Forma de Pago
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTipoPago("efectivo");
                    setImpactaCaja(true);
                  }}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                    tipoPago === "efectivo"
                      ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-sm"
                      : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
                  }`}
                >
                  💵 Efectivo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTipoPago("transferencia");
                    setImpactaCaja(false);
                  }}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                    tipoPago === "transferencia"
                      ? "bg-blue-500/20 border-blue-500/50 text-blue-300 shadow-sm"
                      : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
                  }`}
                >
                  🏦 Transferencia
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTipoPago("otro");
                    setImpactaCaja(false);
                  }}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                    tipoPago === "otro"
                      ? "bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-sm"
                      : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
                  }`}
                >
                  💳 Cheque / Otro
                </button>
              </div>
            </div>

            {/* Impacta Caja */}
            <label className="flex items-center gap-3 cursor-pointer bg-white/5 border border-white/10 p-3.5 rounded-xl hover:bg-white/[0.07] transition-colors">
              <input
                type="checkbox"
                checked={impactaCaja}
                onChange={(e) => setImpactaCaja(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-brand-red focus:ring-brand-red cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-semibold text-white block">Impacta en Caja física actual</span>
                <span className="text-[11px] text-zinc-400">
                  Descuenta este monto del arqueo y efectivo esperado de la caja abierta
                </span>
              </div>
            </label>

            {/* Descripción / Nota */}
            <div>
              <label className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5 block font-semibold">
                Descripción / Referencia / Comprobante
              </label>
              <input
                type="text"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej: Pago factura 0045 en efectivo"
                className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm outline-none focus:border-brand-red text-white placeholder:text-zinc-600"
              />
            </div>

            {/* Resumen Deuda */}
            <div className="rounded-2xl p-4 bg-white/5 border border-white/10 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-zinc-400">Deuda actual seleccionada</p>
                <p className="text-base font-bold text-red-300">${totalSaldos.toLocaleString("es-AR")}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-400">Nuevo saldo estimado</p>
                <p className={`text-base font-bold ${newTotalBalance > 0 ? "text-red-300" : "text-emerald-300"}`}>
                  ${newTotalBalance.toLocaleString("es-AR")}
                </p>
              </div>
            </div>

            {vuelto > 0 && (
              <div className="rounded-2xl p-3.5 bg-brand-red/10 border border-brand-red/30 text-center animate-pulse">
                <p className="text-xs text-brand-yellow font-semibold uppercase tracking-wider">
                  El pago excede la deuda seleccionada
                </p>
                <p className="text-lg font-bold text-brand-yellow mt-0.5">
                  Sobrante: ${vuelto.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}

            {/* Lista de Compras / Facturas con Saldo */}
            {compras.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-zinc-400 uppercase tracking-widest font-semibold block">
                    {selectedCompraIds.length > 0 ? "Compras seleccionadas" : "Distribución FIFO en compras pendientes"}
                  </label>
                  {selectedCompraIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedCompraIds([])}
                      className="text-[11px] text-brand-yellow hover:underline"
                    >
                      Limpiar selección
                    </button>
                  )}
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {compras.map((c) => {
                    const isSelected = selectedCompraIds.includes(c.id);
                    const distCompra = distribution.find((d) => d.id === c.id);
                    const isTargeted = selectedCompraIds.length === 0 || isSelected;

                    return (
                      <div
                        key={c.id}
                        onClick={() => toggleCompra(c.id)}
                        className={`rounded-xl border p-3 text-xs flex gap-3 items-center cursor-pointer transition-colors ${
                          isSelected
                            ? "border-brand-red bg-brand-red/10"
                            : "border-white/5 bg-black/20 hover:bg-black/30"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}} // handled by div onClick
                          className="rounded border-zinc-700 bg-zinc-800 text-brand-red focus:ring-brand-red w-4 h-4 cursor-pointer shrink-0 pointer-events-none"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-zinc-200">{c.num_recibo}</p>
                            <span className="text-[10px] text-zinc-500">{c.fecha}</span>
                          </div>
                          <p className="text-zinc-500 truncate max-w-[200px] mt-0.5">{c.items}</p>
                          <p className="text-[11px] text-zinc-400 mt-1">
                            Saldo: <b className="text-red-400">${c.saldo.toLocaleString("es-AR")}</b>
                          </p>
                        </div>

                        {isTargeted && distCompra && distCompra.allocated > 0 && (
                          <div className="text-right shrink-0">
                            <span className="text-emerald-400 font-bold block">
                              -${distCompra.allocated.toLocaleString("es-AR")}
                            </span>
                            <span className="text-[10px] text-zinc-500 block">
                              Queda: ${distCompra.newSaldo.toLocaleString("es-AR")}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Botón de Confirmación */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loadingSubmit || parsePaymentInput(monto) <= 0}
                className="w-full h-12 rounded-xl bg-brand-red hover:bg-red-600 disabled:opacity-50 text-white font-bold text-sm transition-all shadow-lg shadow-brand-red/20 active:scale-95 flex items-center justify-center gap-2"
              >
                {loadingSubmit ? (
                  <span>Registrando Salida...</span>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Confirmar Pago de ${monto || "0"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
