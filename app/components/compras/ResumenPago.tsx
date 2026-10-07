"use client";
import React from 'react';
import { CircleDollarSign, Receipt, CreditCard, Banknote, ShieldCheck } from 'lucide-react';

interface ResumenPagoProps {
  total: number;
  pago: number | string;
  setPago: (val: any) => void;
  tipoPago: string;
  setTipoPago: (val: string) => void;
  numRecibo: string;
  setNumRecibo: (val: string) => void;
  impactaCaja: boolean;
  setImpactaCaja: (val: boolean) => void;
}

export default function ResumenPago({ 
  total, pago, setPago, tipoPago, setTipoPago, numRecibo, setNumRecibo, impactaCaja, setImpactaCaja 
}: ResumenPagoProps) {
  
  const pagoNum = parseFloat(String(pago).replace(',', '.')) || 0;
  const saldo = Math.max(0, total - pagoNum);

  const formasPago = [
    { id: 'efectivo', label: 'Efectivo', icon: Banknote },
    { id: 'transferencia', label: 'Transferencia', icon: CreditCard },
    { id: 'cuenta_corriente', label: 'Cta Corriente (Deuda)', icon: CircleDollarSign },
  ];

  const handlePagoChange = (raw: string) => {
    const cleaned = raw.replace(/[^0-9.,]/g, '');
    setPago(cleaned);
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-10 backdrop-blur-md shadow-2xl flex flex-col gap-6 sm:gap-8">
      {/* Header espacioso */}
      <div className="flex items-center gap-4 pb-6 border-b border-white/5">
        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
          <Receipt className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base sm:text-lg font-bold text-white">Comprobante y Condiciones Financieras</h3>
          <p className="text-xs text-zinc-400">Registra el número de factura/remito y cómo se liquida el pago</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Columna Izquierda: Datos del Comprobante y Método (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Número de comprobante */}
          <div>
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">
              Nº de Factura o Remito <span className="text-zinc-500 font-normal lowercase">(opcional)</span>
            </label>
            <div className="relative">
              <Receipt className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-5 h-5" />
              <input 
                type="text" 
                value={numRecibo}
                onChange={e => setNumRecibo(e.target.value)}
                placeholder="Ej: FC-0001-00045892 (opcional)"
                className="w-full h-12 pl-12 pr-4 rounded-2xl bg-black/60 border border-white/10 text-white placeholder:text-zinc-600 font-semibold text-sm sm:text-base focus:border-brand-red outline-none transition-colors"
              />
            </div>
            <span className="text-[11px] text-zinc-500 block mt-1">Identificador del comprobante entregado por el proveedor (opcional)</span>
          </div>

          {/* Formas de Pago */}
          <div>
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">
              Forma de Pago
            </label>
            <div className="grid grid-cols-3 gap-3">
              {formasPago.map(f => {
                const Icon = f.icon;
                const isSelected = tipoPago === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setTipoPago(f.id);
                      if (f.id === 'cuenta_corriente') {
                        setPago('0');
                      }
                    }}
                    className={`p-3.5 sm:p-4 rounded-2xl border text-xs sm:text-sm font-bold flex flex-col items-center gap-2 transition-all cursor-pointer ${
                      isSelected 
                        ? 'border-brand-red bg-brand-red/20 text-brand-yellow shadow-lg shadow-brand-red/10 scale-[1.02]' 
                        : 'border-white/5 bg-black/40 text-zinc-400 hover:text-white hover:border-white/20'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-center leading-tight">{f.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Toggle Impacta Caja */}
          <div className="p-4 sm:p-5 rounded-2xl border border-white/10 bg-black/40 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <input 
                type="checkbox" 
                id="impacta_caja_toggle"
                checked={impactaCaja}
                onChange={e => setImpactaCaja(e.target.checked)}
                className="w-5 h-5 rounded border-zinc-700 bg-zinc-900 text-brand-red accent-brand-red cursor-pointer"
              />
              <label htmlFor="impacta_caja_toggle" className="text-xs sm:text-sm text-zinc-200 font-semibold cursor-pointer">
                Resta del Dinero de Turno de Caja (Mostrador)
              </label>
            </div>
            
            <span className={`text-[11px] font-extrabold uppercase px-3 py-1 rounded-full border shrink-0 ${
              impactaCaja 
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' 
                : 'bg-white/10 text-zinc-400 border-white/10'
            }`}>
              {impactaCaja ? 'Resta de Efectivo' : 'Sin Impacto en Caja'}
            </span>
          </div>
        </div>

        {/* Columna Derecha: Tarjeta Financiera de Totales (5 cols) */}
        <div className="lg:col-span-5 rounded-3xl border border-white/10 bg-zinc-950 p-6 sm:p-7 flex flex-col justify-between space-y-6 shadow-2xl">
          <div className="flex justify-between items-baseline pb-4 border-b border-white/10">
            <div>
              <span className="text-xs uppercase font-extrabold text-zinc-400 tracking-wider block">Total Factura</span>
              <span className="text-[11px] text-zinc-500">Suma total de insumos</span>
            </div>
            <span className="text-2xl sm:text-3xl font-black text-white font-mono">
              ${total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Monto Abonado Hoy
              </label>
              <button
                type="button"
                onClick={() => setPago(String(total))}
                className="text-xs text-brand-yellow hover:underline font-bold transition-all"
              >
                Pagar Total (100%)
              </button>
            </div>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-yellow font-bold text-base">$</span>
              <input 
                type="text"
                inputMode="decimal"
                value={pago !== undefined ? pago : ''}
                onChange={e => handlePagoChange(e.target.value)}
                placeholder="0.00"
                className="w-full h-12 pl-9 pr-4 rounded-2xl bg-black/80 border border-white/15 text-white font-black text-lg focus:border-brand-red outline-none transition-colors"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 flex justify-between items-center text-sm">
            <div>
              <span className="text-xs uppercase font-extrabold text-zinc-400 tracking-wider block">Saldo Deudor</span>
              <span className="text-[11px] text-zinc-500">En cuenta corriente</span>
            </div>
            <span className={`font-black font-mono text-lg sm:text-xl ${saldo > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {saldo > 0 
                ? `-$${saldo.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                : 'Saldado ✓'
              }
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
