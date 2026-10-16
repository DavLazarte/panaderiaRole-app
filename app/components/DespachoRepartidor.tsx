"use client";
import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, Trash2, Printer, CheckCircle, Truck, Package, Download, X, 
  RotateCcw, Edit3, AlertTriangle, RefreshCw, Minus
} from 'lucide-react';

interface DespachoRepartidorProps {
  repartidores: { id: number; name: string }[];
  articulos: any[];
  token: string;
  apiUrl: string;
  onSuccess: () => void;
}

export default function DespachoRepartidor({ repartidores, articulos, token, apiUrl, onSuccess }: DespachoRepartidorProps) {
  const [repartidorId, setRepartidorId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [cantidad, setCantidad] = useState<string>('');
  
  // Tab para pantallas medianas/chicas (< xl)
  const [activeMobileTab, setActiveMobileTab] = useState<'carga' | 'stock'>('carga');

  // Carrito manual para productos extras
  const [cart, setCart] = useState<{ item: any, cantidad: number }[]>([]);
  // Cantidades de carga rápida (productos con disponible_reparto)
  const [bulkCart, setBulkCart] = useState<Record<number, string>>({});
  
  const [loading, setLoading] = useState(false);
  const [successTicket, setSuccessTicket] = useState<{ ticketId: string, repartidorName: string, items: any[], date: string } | null>(null);

  // Modal para Cargar, Devolver o Ajustar stock directo
  const [actionModal, setActionModal] = useState<{
    type: 'entrada' | 'devolucion' | 'ajuste_directo';
    item: any;
    stockActual?: number;
    isPanaderia?: boolean;
  } | null>(null);
  const [modalQty, setModalQty] = useState('');
  const [modalSubmitting, setModalSubmitting] = useState(false);

  // Modal para Devolver Todo el Stock al Depósito
  const [confirmDevolverTodo, setConfirmDevolverTodo] = useState(false);
  const [devolviendoTodo, setDevolviendoTodo] = useState(false);

  // Reiniciar carritos cuando cambia el repartidor
  useEffect(() => {
    setCart([]);
    setBulkCart({});
  }, [repartidorId]);

  // Nombre del destino actual
  const repName = repartidorId === 'panaderia' 
    ? 'Panadería / Local' 
    : (repartidores.find(r => r.id === Number(repartidorId))?.name || 'Repartidor');

  // Obtener stock actual de un artículo en el destino seleccionado
  const getStockEnDestino = (art: any): number => {
    if (repartidorId === 'panaderia') {
      return Number(art.stock || 0);
    }
    if (!repartidorId || !art.stock_repartidores || !art.stock_repartidores[repartidorId]) {
      return 0;
    }
    return Number(art.stock_repartidores[repartidorId].cantidad || 0);
  };

  // Stock asignado al destino seleccionado
  const repartidorStock = (articulos || []).filter(a => getStockEnDestino(a) > 0);
  const totalUnidadesEnMovil = repartidorStock.reduce((acc, a) => acc + getStockEnDestino(a), 0);

  // Productos habituales de reparto
  const articulosDeReparto = (articulos || []).filter(a => a.disponible_reparto);

  // Conteo de ítems en borrador de carga
  const itemsEnCargaCount = Object.values(bulkCart).filter(v => Number(v) > 0).length + cart.length;

  // ── IMPRESIÓN AISLADA (IFRAME LIMPIO SIN TOCAR PANTALLA) ──
  const printIframe = (title: string, htmlBody: string) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    iframe.srcdoc = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <style>
            @page { size: portrait; margin: 10mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #111; margin: 0; padding: 15px; }
            .header { border-bottom: 2px solid #222; padding-bottom: 12px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
            .logo { max-height: 45px; }
            h2 { margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 0.5px; }
            .meta { font-size: 12px; color: #444; line-height: 1.6; margin-bottom: 15px; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px; }
            th { border-top: 1px solid #333; border-bottom: 2px solid #333; text-align: left; padding: 8px 6px; font-size: 11px; text-transform: uppercase; background: #f4f4f4; }
            td { border-bottom: 1px solid #ddd; padding: 8px 6px; }
            .qty { text-align: right; font-weight: bold; font-family: monospace; font-size: 14px; }
            .total { margin-top: 20px; text-align: right; font-size: 15px; font-weight: bold; border-top: 2px solid #222; padding-top: 8px; }
            .firmas { margin-top: 50px; display: flex; justify-content: space-between; font-size: 12px; page-break-inside: avoid; }
            .firma-box { border-top: 1px dashed #666; width: 42%; text-align: center; padding-top: 6px; color: #555; }
          </style>
        </head>
        <body>
          ${htmlBody}
        </body>
      </html>
    `;

    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1500);
      }, 250);
    };
  };

  const handlePrintStock = () => {
    if (repartidorStock.length === 0) return;
    const items = repartidorStock.map(a => ({
      nombre: a.nombre,
      cantidad: getStockEnDestino(a)
    }));
    const total = items.reduce((acc, curr) => acc + curr.cantidad, 0);

    const html = `
      <div class="header">
        <div>
          <h2>Estado de Stock en Móvil</h2>
          <div style="font-size: 11px; color: #666; margin-top: 2px;">Comprobante de mercadería asignada</div>
        </div>
        <img src="/logo.svg" class="logo" alt="Role" onerror="this.style.display='none'" />
      </div>
      <div class="meta">
        <div><strong>Destino / Repartidor:</strong> ${repName}</div>
        <div><strong>Fecha y Hora:</strong> ${new Date().toLocaleString('es-AR')}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th style="text-align: right; width: 100px;">Cantidad</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(it => `
            <tr>
              <td>${it.nombre}</td>
              <td class="qty">${it.cantidad}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="total">
        Total Unidades en Móvil: ${total}
      </div>
      <div class="firmas">
        <div class="firma-box">Firma Responsable Despacho</div>
        <div class="firma-box">Firma Receptor / Chofer</div>
      </div>
    `;

    printIframe(`Stock - ${repName}`, html);
  };

  const handlePrintRemito = () => {
    if (!successTicket) return;
    const html = `
      <div class="header">
        <div>
          <h2>Remito de Despacho</h2>
          <div style="font-size: 11px; color: #666; margin-top: 2px;">Comprobante Oficial de Salida</div>
        </div>
        <img src="/logo.svg" class="logo" alt="Role" onerror="this.style.display='none'" />
      </div>
      <div class="meta">
        <div><strong>Despacho Nº:</strong> ${successTicket.ticketId}</div>
        <div><strong>Fecha y Hora:</strong> ${successTicket.date}</div>
        <div><strong>Destino / Repartidor:</strong> ${successTicket.repartidorName}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th style="text-align: right; width: 100px;">Cantidad</th>
          </tr>
        </thead>
        <tbody>
          ${successTicket.items.map(it => `
            <tr>
              <td>${it.item.nombre}</td>
              <td class="qty">${it.cantidad}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="total">
        Total Unidades Despachadas: ${successTicket.items.reduce((acc, curr) => acc + curr.cantidad, 0)}
      </div>
      <div class="firmas">
        <div class="firma-box">Firma Responsable Despacho</div>
        <div class="firma-box">Firma Receptor / Chofer</div>
      </div>
    `;

    printIframe(`Remito - ${successTicket.ticketId}`, html);
  };

  // ── ACCIONES DIRECTAS ──
  const handleEntradaRapida = (item: any) => {
    setActionModal({ type: 'entrada', item });
    setModalQty('');
  };

  const handleDevolver = (item: any, isPanaderia: boolean, stockActual: number) => {
    setActionModal({ type: 'devolucion', item, isPanaderia, stockActual });
    setModalQty('');
  };

  const handleAjustarDirecto = (item: any, isPanaderia: boolean, stockActual: number) => {
    setActionModal({ type: 'ajuste_directo', item, isPanaderia, stockActual });
    setModalQty(String(stockActual));
  };

  // Stepper directo en la fila del móvil (+1 / -1)
  const handleQuickStepStock = async (item: any, isPanaderia: boolean, currentStock: number, step: 1 | -1) => {
    if (step === 1) {
      if (Number(item.disponible || 0) < 1) {
        return alert(`No hay stock disponible en el depósito para sumar ${item.nombre}.`);
      }
      try {
        const res = await fetch(`${apiUrl}/deposito/distribuir-batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            repartidor_id: repartidorId === 'panaderia' ? 'panaderia' : Number(repartidorId),
            items: [{ item_id: item.id, cantidad: 1 }]
          })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          onSuccess();
        } else {
          alert(data.message || 'Error al sumar stock al móvil');
        }
      } catch (e) {
        alert('Error de conexión');
      }
    } else {
      if (currentStock < 1) return;
      try {
        const payload: any = {
          tipo_item: 'articulo',
          item_id: item.id,
          motivo: 'Devolución rápida (-1) desde Despacho'
        };
        if (isPanaderia) {
          payload.cantidad_panaderia = 1;
        } else {
          payload.repartidor_id = Number(repartidorId);
          payload.qty_repartidor = 1;
        }
        const res = await fetch(`${apiUrl}/deposito/devolucion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok && data.success) {
          onSuccess();
        } else {
          alert(data.message || 'Error al devolver stock al depósito');
        }
      } catch (e) {
        alert('Error de conexión');
      }
    }
  };

  // ── DEVOLVER TODO EL STOCK AL DEPÓSITO (1 SOLO CLIC) ──
  const handleConfirmarDevolverTodo = async () => {
    if (!repartidorId) return;
    setDevolviendoTodo(true);
    try {
      const res = await fetch(`${apiUrl}/deposito/devolver-todo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          repartidor_id: repartidorId === 'panaderia' ? 'panaderia' : Number(repartidorId),
          motivo: `Devolución total de stock de ${repName}`
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setConfirmDevolverTodo(false);
        onSuccess();
        alert(data.message || 'Todo el stock fue reintegrado al depósito.');
      } else {
        alert(data.message || 'Error al devolver stock al depósito');
      }
    } catch (e) {
      alert('Error de conexión al devolver stock');
    } finally {
      setDevolviendoTodo(false);
    }
  };

  // ── SUBMIT MODAL (ENTRADA, DEVOLUCIÓN O AJUSTE DIRECTO) ──
  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionModal) return;
    const qty = Number(modalQty);
    if (isNaN(qty) || qty < 0) return alert('Ingrese una cantidad válida mayor o igual a 0');

    setModalSubmitting(true);
    try {
      if (actionModal.type === 'ajuste_directo') {
        const cur = Number(actionModal.stockActual || 0);
        const diff = qty - cur;

        if (diff === 0) {
          setActionModal(null);
          setModalSubmitting(false);
          return;
        }

        if (diff > 0) {
          // Sumar desde el depósito
          if (diff > Number(actionModal.item.disponible || 0)) {
            setModalSubmitting(false);
            return alert(`Stock insuficiente en depósito. Disponible: ${actionModal.item.disponible}`);
          }
          const res = await fetch(`${apiUrl}/deposito/distribuir-batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              repartidor_id: repartidorId === 'panaderia' ? 'panaderia' : Number(repartidorId),
              items: [{ item_id: actionModal.item.id, cantidad: diff }]
            })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            setActionModal(null);
            onSuccess();
          } else {
            alert(data.message || 'Error al ajustar stock');
          }
        } else {
          // Devolver sobrante al depósito
          const absDiff = Math.abs(diff);
          const payload: any = {
            tipo_item: 'articulo',
            item_id: actionModal.item.id,
            motivo: 'Ajuste directo de stock en móvil'
          };
          if (actionModal.isPanaderia) {
            payload.cantidad_panaderia = absDiff;
          } else {
            payload.repartidor_id = Number(repartidorId);
            payload.qty_repartidor = absDiff;
          }
          const res = await fetch(`${apiUrl}/deposito/devolucion`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (res.ok && data.success) {
            setActionModal(null);
            onSuccess();
          } else {
            alert(data.message || 'Error al devolver sobrante');
          }
        }
      } else if (actionModal.type === 'entrada') {
        if (qty <= 0) {
          setModalSubmitting(false);
          return alert('La cantidad a ingresar debe ser mayor a 0');
        }
        const res = await fetch(`${apiUrl}/deposito/entrada`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            tipo_item: 'articulo',
            item_id: actionModal.item.id,
            cantidad: qty,
            motivo: 'Entrada rápida desde Despacho'
          })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setActionModal(null);
          onSuccess();
        } else {
          alert(data.message || 'Error al ingresar stock al depósito');
        }
      } else {
        // Devolución simple
        if (qty <= 0) {
          setModalSubmitting(false);
          return alert('La cantidad a devolver debe ser mayor a 0');
        }
        if (actionModal.stockActual !== undefined && qty > actionModal.stockActual) {
          setModalSubmitting(false);
          return alert(`No puedes devolver más de lo asignado (${actionModal.stockActual})`);
        }
        const payload: any = {
          tipo_item: 'articulo',
          item_id: actionModal.item.id,
          motivo: 'Devolución rápida desde Despacho'
        };
        if (actionModal.isPanaderia) {
          payload.cantidad_panaderia = qty;
        } else {
          payload.repartidor_id = Number(repartidorId);
          payload.qty_repartidor = qty;
        }
        const res = await fetch(`${apiUrl}/deposito/devolucion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setActionModal(null);
          onSuccess();
        } else {
          alert(data.message || 'Error al devolver stock al depósito');
        }
      }
    } catch (e) {
      alert('Error de conexión');
    }
    setModalSubmitting(false);
  };

  // Filtro de artículos extras para agregar manualmente
  const filteredArticulos = (articulos || []).filter(a => 
    (a?.nombre || '').toLowerCase().includes((search || '').toLowerCase()) && Number(a?.disponible || 0) > 0 && !a?.disponible_reparto
  ).slice(0, 5);

  const handleAdd = () => {
    if (!selectedItem || !cantidad || Number(cantidad) <= 0) return;
    if (Number(cantidad) > selectedItem.disponible) {
      alert(`Stock insuficiente. Disponible: ${selectedItem.disponible}`);
      return;
    }
    
    setCart(prev => {
      const existing = prev.find(i => i.item.id === selectedItem.id);
      if (existing) {
        return prev.map(i => i.item.id === selectedItem.id ? { ...i, cantidad: i.cantidad + Number(cantidad) } : i);
      }
      return [...prev, { item: selectedItem, cantidad: Number(cantidad) }];
    });
    setSelectedItem(null);
    setSearch('');
    setCantidad('');
  };

  const handleRemove = (id: number) => {
    setCart(prev => prev.filter(i => i.item.id !== id));
  };

  // Confirmar despacho masivo (Habituales + Extras)
  const handleSubmit = async () => {
    if (!repartidorId) return alert('Seleccione un destino');
    
    const finalItems: { item_id: number, cantidad: number, item: any }[] = [];
    
    // Bulk habituales
    Object.entries(bulkCart).forEach(([id, qty]) => {
      const numQty = Number(qty);
      if (numQty > 0) {
        const art = articulos.find(a => a.id === Number(id));
        if (art) {
          if (numQty > art.disponible) {
            alert(`Stock insuficiente para ${art.nombre}. Disponible: ${art.disponible}`);
            throw new Error('Stock insuficiente');
          }
          finalItems.push({ item_id: art.id, cantidad: numQty, item: art });
        }
      }
    });

    // Extras
    cart.forEach(c => {
      const existing = finalItems.find(f => f.item_id === c.item.id);
      if (existing) {
        existing.cantidad += c.cantidad;
        if (existing.cantidad > c.item.disponible) {
          alert(`Stock insuficiente para ${c.item.nombre}. Disponible: ${c.item.disponible}`);
          throw new Error('Stock insuficiente');
        }
      } else {
        finalItems.push({ item_id: c.item.id, cantidad: c.cantidad, item: c.item });
      }
    });

    if (finalItems.length === 0) return alert('Agregue al menos un producto a la carga con cantidad mayor a 0');

    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/deposito/distribuir-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          repartidor_id: repartidorId === 'panaderia' ? 'panaderia' : Number(repartidorId),
          items: finalItems.map(f => ({ item_id: f.item_id, cantidad: f.cantidad }))
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessTicket({
          ticketId: Math.floor(Math.random() * 100000).toString(),
          repartidorName: repName,
          items: finalItems,
          date: new Date().toLocaleString('es-AR')
        });
        setCart([]);
        setBulkCart({});
        onSuccess();
      } else {
        alert(data.message || 'Error al despachar');
      }
    } catch (e) {
      if ((e as Error).message !== 'Stock insuficiente') {
        alert('Error de conexión');
      }
    }
    setLoading(false);
  };

  // ── PANTALLA DE ÉXITO TRAS DESPACHAR ──
  if (successTicket) {
    return (
      <div className="max-w-2xl mx-auto p-6 sm:p-8 bg-white/5 border border-white/10 rounded-3xl space-y-6 animate-in fade-in duration-200">
        <div className="text-center space-y-2">
          <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto" />
          <h2 className="text-2xl font-bold text-white">¡Despacho Confirmado con Éxito!</h2>
          <p className="text-sm text-zinc-400">
            Se asignaron <b>{successTicket.items.reduce((acc, curr) => acc + curr.cantidad, 0)} unidades</b> a <b>{successTicket.repartidorName}</b>.
          </p>
        </div>

        <div className="bg-black/30 border border-white/10 rounded-2xl p-4 max-h-60 overflow-y-auto divide-y divide-white/5">
          {successTicket.items.map((it, idx) => (
            <div key={idx} className="py-2.5 flex justify-between items-center text-sm first:pt-0 last:pb-0">
              <span className="text-zinc-200">{it.item.nombre}</span>
              <span className="font-mono font-bold text-brand-yellow">+{it.cantidad} u.</span>
            </div>
          ))}
        </div>
        
        <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
          <button 
            type="button"
            onClick={() => setSuccessTicket(null)} 
            className="px-6 py-3.5 rounded-xl border border-white/10 text-white font-semibold hover:bg-white/5 transition-colors cursor-pointer"
          >
            Volver al Despacho
          </button>
          <button 
            type="button"
            onClick={handlePrintRemito} 
            className="px-6 py-3.5 rounded-xl bg-brand-yellow hover:bg-amber-400 text-black font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-brand-yellow/20 transition-all cursor-pointer"
          >
            <Printer className="w-5 h-5" /> Imprimir Remito de Salida
          </button>
        </div>
      </div>
    );
  }

  const isBulkEmpty = Object.values(bulkCart).every(v => !v || Number(v) <= 0);

  return (
    <div className="space-y-6">
      {/* ── MODAL DE CONFIRMACIÓN: DEVOLVER TODO AL DEPÓSITO ── */}
      {confirmDevolverTodo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-red-500/30 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 bg-red-500/10 border-b border-red-500/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-red-500/20 text-red-400">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Devolver Todo al Depósito</h3>
                  <p className="text-xs text-red-300">Descarga completa del vehículo</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setConfirmDevolverTodo(false)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-black/40 border border-white/5 rounded-2xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Destino:</span>
                  <span className="font-bold text-white">{repName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Total productos a devolver:</span>
                  <span className="font-bold text-brand-yellow">{repartidorStock.length} artículos</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Total unidades a reintegrar:</span>
                  <span className="font-bold text-emerald-400">{totalUnidadesEnMovil} u.</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Todo el stock asignado a este móvil volverá inmediatamente al depósito central y el vehículo quedará en 0.
                </span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDevolverTodo(false)}
                  disabled={devolviendoTodo}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-zinc-300 font-semibold text-sm hover:bg-white/5"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarDevolverTodo}
                  disabled={devolviendoTodo}
                  className="flex-1 py-3 rounded-xl bg-brand-red hover:bg-red-600 font-bold text-sm text-white shadow-lg shadow-red-900/30 flex items-center justify-center gap-2"
                >
                  {devolviendoTodo ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Devolviendo...</span>
                    </>
                  ) : (
                    <span>Confirmar Devolución Total</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ENTRADA / DEVOLUCIÓN / AJUSTE DIRECTO ── */}
      {actionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header del Modal */}
            <div className={`p-6 border-b border-white/10 flex items-center justify-between ${
              actionModal.type === 'entrada' ? 'bg-emerald-500/10' : (actionModal.type === 'ajuste_directo' ? 'bg-amber-500/10' : 'bg-red-500/10')
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${
                  actionModal.type === 'entrada' 
                    ? 'bg-emerald-500/20 text-emerald-400' 
                    : (actionModal.type === 'ajuste_directo' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400')
                }`}>
                  {actionModal.type === 'entrada' ? (
                    <Plus className="w-5 h-5" />
                  ) : actionModal.type === 'ajuste_directo' ? (
                    <Edit3 className="w-5 h-5" />
                  ) : (
                    <Download className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {actionModal.type === 'entrada' 
                      ? 'Ingresar Stock al Depósito' 
                      : (actionModal.type === 'ajuste_directo' ? 'Ajustar Stock en Móvil' : 'Devolver al Depósito')}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {actionModal.type === 'entrada' 
                      ? 'Carga directa de mercadería al depósito' 
                      : (actionModal.type === 'ajuste_directo' ? 'Edición directa del total en vehículo' : 'Retorno hacia el depósito')}
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setActionModal(null)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleModalSubmit} className="p-6 space-y-4">
              <div className="bg-black/30 border border-white/5 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-400">Producto:</span>
                  <span className="font-bold text-white">{actionModal.item.nombre}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-400">Disponible en depósito:</span>
                  <span className="font-bold text-emerald-400">{actionModal.item.disponible} u.</span>
                </div>
                {actionModal.type !== 'entrada' && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-zinc-400">Stock actual en móvil:</span>
                    <span className="font-bold text-brand-yellow">{actionModal.stockActual} u.</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
                  {actionModal.type === 'entrada' 
                    ? 'Cantidad a Ingresar al Depósito' 
                    : (actionModal.type === 'ajuste_directo' ? 'Nuevo Stock Deseado en Móvil' : 'Cantidad a Devolver')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={actionModal.type === 'devolucion' ? actionModal.stockActual : undefined}
                  autoFocus
                  required
                  placeholder="0"
                  value={modalQty}
                  onFocus={e => e.target.select()}
                  onChange={e => setModalQty(e.target.value)}
                  className="w-full h-12 bg-black/40 border border-white/10 rounded-xl px-4 text-white text-xl font-bold outline-none focus:border-brand-red text-center"
                />
              </div>

              {/* Indicador en vivo para Ajuste Directo */}
              {actionModal.type === 'ajuste_directo' && modalQty !== '' && !isNaN(Number(modalQty)) && (
                <div className={`p-3 rounded-xl border text-xs font-semibold ${
                  Number(modalQty) > Number(actionModal.stockActual || 0)
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : Number(modalQty) < Number(actionModal.stockActual || 0)
                    ? 'bg-red-500/10 border-red-500/30 text-red-300'
                    : 'bg-white/5 border-white/10 text-zinc-400'
                }`}>
                  {Number(modalQty) > Number(actionModal.stockActual || 0) ? (
                    <span>▲ Se cargarán <b>{Number(modalQty) - Number(actionModal.stockActual || 0)} u.</b> desde el depósito central.</span>
                  ) : Number(modalQty) < Number(actionModal.stockActual || 0) ? (
                    <span>▼ Se devolverán <b>{Number(actionModal.stockActual || 0) - Number(modalQty)} u.</b> al depósito central.</span>
                  ) : (
                    <span>El stock se mantendrá igual ({actionModal.stockActual} u.).</span>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActionModal(null)}
                  disabled={modalSubmitting}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-zinc-300 font-semibold text-sm hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting || modalQty === '' || Number(modalQty) < 0}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm text-white transition-all shadow-lg active:scale-95 disabled:opacity-50 ${
                    actionModal.type === 'entrada'
                      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/30'
                      : (actionModal.type === 'ajuste_directo' ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/30' : 'bg-brand-red hover:bg-red-500 shadow-red-900/30')
                  }`}
                >
                  {modalSubmitting ? 'Procesando...' : actionModal.type === 'entrada' ? 'Cargar Stock' : (actionModal.type === 'ajuste_directo' ? 'Guardar Ajuste' : 'Confirmar Devolución')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── COMMAND HEADER SUPERIOR: SELECTOR DE DESTINO & MÉTRICAS ── */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex-1 max-w-lg space-y-1.5">
          <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest block">
            Seleccionar Destino del Despacho
          </label>
          <select 
            value={repartidorId} 
            onChange={e => setRepartidorId(e.target.value)}
            className="w-full h-12 bg-black/50 border border-white/15 rounded-2xl px-4 text-white outline-none focus:border-brand-red font-bold text-base cursor-pointer"
          >
            <option value="" className="bg-zinc-900 text-zinc-400">Elegir Destino...</option>
            <option value="panaderia" className="bg-zinc-900 text-brand-yellow font-bold">🏠 Panadería / Local de Venta</option>
            {repartidores.map(r => (
              <option key={r.id} value={r.id} className="bg-zinc-900 text-white">🚚 {r.name}</option>
            ))}
          </select>
        </div>

        {repartidorId && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="px-4 py-2.5 rounded-2xl bg-brand-yellow/10 border border-brand-yellow/20 flex items-center gap-2.5">
              <Truck className="w-5 h-5 text-brand-yellow" />
              <div>
                <span className="text-[10px] uppercase font-bold text-brand-yellow/70 block leading-tight">Stock en Móvil</span>
                <span className="text-sm font-black text-brand-yellow">
                  {repartidorStock.length} prod. ({totalUnidadesEnMovil} u.)
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handlePrintStock}
              disabled={repartidorStock.length === 0}
              className="h-11 px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center gap-2 border border-white/10 transition-all cursor-pointer disabled:opacity-40"
              title="Imprimir remito de stock actual"
            >
              <Printer className="w-4 h-4 text-brand-yellow" />
              <span className="hidden sm:inline">Imprimir Stock</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirmDevolverTodo(true)}
              disabled={repartidorStock.length === 0}
              className="h-11 px-3.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 font-bold text-xs flex items-center gap-2 border border-red-500/30 transition-all cursor-pointer disabled:opacity-40"
              title="Devolver todo al depósito"
            >
              <RotateCcw className="w-4 h-4 text-red-400" />
              <span>Devolver Todo</span>
            </button>
          </div>
        )}
      </div>

      {repartidorId ? (
        <>
          {/* ── TABS PARA PANTALLAS CHICAS / NOTEBOOKS (< xl) ── */}
          <div className="flex xl:hidden bg-zinc-950 border border-white/10 p-1.5 rounded-2xl gap-2 shadow-lg">
            <button
              type="button"
              onClick={() => setActiveMobileTab('carga')}
              className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeMobileTab === 'carga'
                  ? 'bg-brand-red text-white shadow-lg shadow-brand-red/25'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Cargar Mercadería</span>
              {itemsEnCargaCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] bg-white text-black font-black">
                  {itemsEnCargaCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveMobileTab('stock')}
              className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeMobileTab === 'stock'
                  ? 'bg-brand-yellow text-black shadow-lg shadow-brand-yellow/25'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>Stock en Móvil ({repartidorStock.length})</span>
            </button>
          </div>

          {/* ── WORKSPACE RESPONSIVE: 2 COLUMNAS (SIDE BY SIDE EN XL) ── */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            
            {/* ── COLUMNA 1: CARGA DE MERCADERÍA (xl:col-span-8) ── */}
            <div className={`xl:col-span-8 space-y-6 ${activeMobileTab === 'stock' ? 'hidden xl:block' : 'block'}`}>
              
              {/* Carga Rápida (Habituales) */}
              {articulosDeReparto.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden shadow-xl">
                  <div className="p-4 sm:p-5 border-b border-white/5 bg-brand-red/10 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-brand-red/20 text-brand-yellow">
                        <Package className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                          Carga Rápida (Habituales)
                        </h3>
                        <p className="text-xs text-zinc-400">
                          Productos frecuentes de reparto con disponibilidad en depósito
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-zinc-400 bg-black/40 px-3 py-1 rounded-full border border-white/10 shrink-0">
                      {articulosDeReparto.length} productos
                    </span>
                  </div>

                  {/* Grilla fluida que NO corta textos en notebooks */}
                  <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3.5">
                    {articulosDeReparto.map(a => {
                      const stockEnMovil = getStockEnDestino(a);
                      const isPanaderia = repartidorId === 'panaderia';
                      const cantCargar = bulkCart[a.id] || '';
                      const cantCargarNum = parseFloat(cantCargar) || 0;

                      return (
                        <div 
                          key={a.id} 
                          className="bg-black/40 border border-white/10 hover:border-white/20 rounded-2xl p-4 flex flex-col justify-between gap-3 transition-all hover:shadow-lg"
                        >
                          {/* Fila 1: Nombre completo + Badge de Stock en Móvil */}
                          <div className="flex items-start justify-between gap-2">
                            <span 
                              className="text-sm font-bold text-white leading-tight break-words" 
                              title={a.nombre}
                            >
                              {a.nombre}
                            </span>
                            {stockEnMovil > 0 && (
                              <span className="px-2 py-0.5 text-[11px] font-black bg-brand-yellow/15 text-brand-yellow border border-brand-yellow/30 rounded-full shrink-0 flex items-center gap-1">
                                <Truck className="w-3 h-3" /> {stockEnMovil}
                              </span>
                            )}
                          </div>

                          {/* Fila 2: Depósito + Botón +Stock y Editar Móvil */}
                          <div className="flex items-center justify-between text-xs text-zinc-400 gap-2">
                            <div className="flex items-center gap-2">
                              <span>Depósito: <b className={Number(a.disponible) > 0 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>{a.disponible}</b></span>
                              <button
                                type="button"
                                onClick={() => handleEntradaRapida(a)}
                                className="px-2 py-0.5 text-[10px] bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/20 rounded-md font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                title="Ingresar stock al depósito central"
                              >
                                <Plus className="w-3 h-3" /> Depósito
                              </button>
                            </div>

                            {stockEnMovil > 0 && (
                              <button
                                type="button"
                                onClick={() => handleAjustarDirecto(a, isPanaderia, stockEnMovil)}
                                className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 underline underline-offset-2 transition-colors cursor-pointer shrink-0"
                                title="Editar stock directamente en el móvil"
                              >
                                <Edit3 className="w-3 h-3 text-amber-400" />
                                <span>Ajustar móvil</span>
                              </button>
                            )}
                          </div>

                          {/* Fila 3: Stepper de Carga */}
                          <div className="pt-1 flex items-center justify-between gap-2 border-t border-white/5">
                            <span className="text-[11px] font-semibold text-zinc-400">Cargar:</span>
                            
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const cur = parseFloat(bulkCart[a.id] || '0') || 0;
                                  const next = Math.max(0, cur - 1);
                                  setBulkCart({ ...bulkCart, [a.id]: next === 0 ? '' : String(next) });
                                }}
                                className="w-8 h-9 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white flex items-center justify-center font-black text-base border border-white/10 active:scale-95 cursor-pointer"
                              >
                                -
                              </button>
                              
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="0"
                                value={bulkCart[a.id] === '0' || !bulkCart[a.id] ? '' : bulkCart[a.id]}
                                onFocus={e => e.target.select()}
                                onChange={e => {
                                  const val = e.target.value.replace(/[^0-9.]/g, '');
                                  const cleanVal = val.replace(/^0+(?=\d)/, '');
                                  setBulkCart({ ...bulkCart, [a.id]: cleanVal });
                                }}
                                className="w-16 h-9 bg-black/60 border border-emerald-500/40 rounded-lg text-center text-emerald-400 font-mono font-black text-sm outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                              />

                              <button
                                type="button"
                                onClick={() => {
                                  const cur = parseFloat(bulkCart[a.id] || '0') || 0;
                                  const next = cur + 1;
                                  setBulkCart({ ...bulkCart, [a.id]: String(next) });
                                }}
                                className="w-8 h-9 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 flex items-center justify-center font-black text-base active:scale-95 cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* Previsualización del stock final si se carga */}
                          {cantCargarNum > 0 && (
                            <div className="text-[10px] text-emerald-400/90 font-medium text-right -mt-1">
                              Quedará en <b>{stockEnMovil + cantCargarNum} u.</b> en móvil
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Agregar Productos Extras Manualmente */}
              <div className="bg-white/5 border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                      Agregar Productos Extras
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Buscá cualquier otro producto del catálogo que no esté en la lista habitual
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 relative">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input 
                      type="text" 
                      value={search}
                      onChange={e => { setSearch(e.target.value); setSelectedItem(null); }}
                      placeholder="Buscar producto extra por nombre..."
                      className="w-full h-12 pl-10 pr-4 bg-black/40 border border-white/10 rounded-xl text-white outline-none focus:border-brand-red text-sm"
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      inputMode="decimal"
                      value={cantidad === '0' || !cantidad ? '' : cantidad}
                      onFocus={e => e.target.select()}
                      onChange={e => {
                        const val = e.target.value.replace(/[^0-9.]/g, '');
                        const cleanVal = val.replace(/^0+(?=\d)/, '');
                        setCantidad(cleanVal);
                      }}
                      placeholder="Cant."
                      className="w-24 h-12 bg-black/40 border border-white/10 rounded-xl px-3 text-center text-emerald-300 outline-none focus:border-emerald-500 font-bold"
                    />
                    
                    <button 
                      type="button"
                      onClick={handleAdd}
                      disabled={!selectedItem || !cantidad}
                      className="h-12 px-4 flex items-center justify-center gap-1.5 bg-brand-red hover:bg-red-600 rounded-xl text-white font-bold transition-all disabled:opacity-40 cursor-pointer shadow-lg shadow-brand-red/20 shrink-0"
                    >
                      <Plus className="w-5 h-5" />
                      <span className="hidden sm:inline">Agregar</span>
                    </button>
                  </div>

                  {/* Dropdown de búsqueda rápida */}
                  {search && !selectedItem && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
                      {filteredArticulos.map(a => (
                        <div key={a.id} className="w-full text-left px-4 py-3 hover:bg-white/5 border-b border-white/5 last:border-0 flex justify-between items-center gap-2">
                          <button
                            type="button"
                            onClick={() => { setSelectedItem(a); setSearch(a.nombre); }}
                            className="flex-1 text-left cursor-pointer"
                          >
                            <span className="text-sm font-semibold text-white block">{a.nombre}</span>
                            <span className="text-xs text-zinc-400">
                              Depósito: <span className={Number(a.disponible) > 0 ? "text-emerald-400 font-bold" : "text-amber-400"}>{a.disponible}</span>
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleEntradaRapida(a); }}
                            className="px-2.5 py-1 text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-lg flex items-center gap-1 shrink-0 font-medium cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" /> Depósito
                          </button>
                        </div>
                      ))}
                      {filteredArticulos.length === 0 && (
                        <div className="px-4 py-3 text-sm text-zinc-500 text-center">No hay productos extra coincidentes</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Tabla de extras agregados al borrador */}
                {cart.length > 0 && (
                  <div className="mt-3 bg-black/30 rounded-2xl border border-white/5 overflow-hidden">
                    <table className="w-full text-left text-sm text-zinc-300">
                      <thead className="text-xs text-zinc-500 border-b border-white/5 bg-white/5">
                        <tr>
                          <th className="px-4 py-2.5 font-bold">Producto Extra</th>
                          <th className="px-4 py-2.5 font-bold text-right">Cantidad</th>
                          <th className="px-4 py-2.5 text-right font-bold w-16">Quitar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {cart.map((c, i) => (
                          <tr key={i} className="hover:bg-white/5 transition-colors">
                            <td className="px-4 py-2.5 font-semibold text-white">{c.item.nombre}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-emerald-400 font-mono">+{c.cantidad}</td>
                            <td className="px-4 py-2.5 text-right">
                              <button 
                                type="button"
                                onClick={() => handleRemove(c.item.id)}
                                className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Botón Principal de Confirmación de Despacho */}
              <div className="pt-2">
                <button 
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading || (isBulkEmpty && cart.length === 0)}
                  className="w-full h-14 bg-brand-red hover:bg-red-600 active:scale-[0.99] text-white rounded-2xl font-black uppercase tracking-wider text-base transition-all disabled:opacity-40 flex justify-center items-center gap-2.5 shadow-xl shadow-brand-red/25 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Procesando Despacho...</span>
                    </>
                  ) : (
                    <>
                      <Truck className="w-5 h-5" />
                      <span>Confirmar Despacho a {repName}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* ── COLUMNA 2: STOCK ACTUAL EN MÓVIL (xl:col-span-4) ── */}
            <div className={`xl:col-span-4 bg-brand-yellow/5 border border-brand-yellow/20 rounded-3xl overflow-hidden flex flex-col shadow-xl xl:sticky xl:top-6 ${
              activeMobileTab === 'carga' ? 'hidden xl:flex' : 'flex'
            }`}>
              {/* Header de Stock Actual */}
              <div className="p-4 sm:p-5 border-b border-brand-yellow/20 bg-brand-yellow/10 flex justify-between items-center gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-brand-yellow/20 text-brand-yellow">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-brand-yellow uppercase tracking-wider">
                      Stock Actual en Móvil
                    </h3>
                    <p className="text-xs text-brand-yellow/70">
                      {repName} · {repartidorStock.length} artículos
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button 
                    type="button"
                    onClick={handlePrintStock}
                    disabled={repartidorStock.length === 0}
                    className="p-2 bg-brand-yellow/20 hover:bg-brand-yellow/30 text-brand-yellow rounded-xl transition-colors cursor-pointer disabled:opacity-40"
                    title="Imprimir Stock Actual"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button 
                    type="button"
                    onClick={() => setConfirmDevolverTodo(true)}
                    disabled={repartidorStock.length === 0}
                    className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl transition-colors cursor-pointer disabled:opacity-40"
                    title="Devolver todo al depósito"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Lista interactiva con edición directa */}
              <div className="p-3 divide-y divide-white/5 overflow-y-auto max-h-[600px]">
                {repartidorStock.length === 0 ? (
                  <div className="py-12 px-4 text-center text-brand-yellow/50 text-sm space-y-2">
                    <Package className="w-8 h-8 mx-auto opacity-50" />
                    <p className="font-semibold">El destino no tiene mercadería asignada.</p>
                    <p className="text-xs text-zinc-500">Cargá productos desde la izquierda para iniciar el reparto.</p>
                  </div>
                ) : (
                  repartidorStock.map(a => {
                    const isPanaderia = repartidorId === 'panaderia';
                    const stockVal = getStockEnDestino(a);

                    return (
                      <div key={a.id} className="py-3 flex items-center justify-between gap-3 first:pt-1 last:pb-1">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-zinc-200 font-bold block truncate" title={a.nombre}>
                            {a.nombre}
                          </span>
                          <span className="text-xs text-zinc-400">
                            Depósito: <b className="text-emerald-400">{a.disponible}</b>
                          </span>
                        </div>

                        {/* Controles Directos en Móvil: Stepper rápido + Ajuste */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleQuickStepStock(a, isPanaderia, stockVal, -1)}
                            className="w-7 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 flex items-center justify-center font-bold text-xs transition-all active:scale-95 cursor-pointer"
                            title="Devolver 1 unidad al depósito"
                          >
                            -1
                          </button>

                          <button
                            type="button"
                            onClick={() => handleAjustarDirecto(a, isPanaderia, stockVal)}
                            className="px-2.5 h-8 rounded-lg bg-black/60 border border-brand-yellow/40 hover:border-brand-yellow text-brand-yellow font-mono font-black text-sm flex items-center gap-1 transition-all cursor-pointer"
                            title="Clic para editar o ajustar cantidad exacta"
                          >
                            <span>{stockVal}</span>
                            <Edit3 className="w-2.5 h-2.5 opacity-60" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleQuickStepStock(a, isPanaderia, stockVal, 1)}
                            disabled={Number(a.disponible || 0) < 1}
                            className="w-7 h-8 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/25 flex items-center justify-center font-bold text-xs transition-all active:scale-95 cursor-pointer disabled:opacity-30"
                            title="Sumar 1 unidad desde depósito"
                          >
                            +1
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDevolver(a, isPanaderia, stockVal)}
                            className="p-1.5 bg-red-500/15 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg text-xs transition-colors cursor-pointer"
                            title="Devolver cantidad personalizada"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer con Totalizador en Móvil */}
              {repartidorStock.length > 0 && (
                <div className="p-4 bg-black/40 border-t border-brand-yellow/20 flex items-center justify-between text-xs font-bold text-brand-yellow">
                  <span>Total Unidades en Móvil:</span>
                  <span className="font-mono text-sm">{totalUnidadesEnMovil} u.</span>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Estado inicial sin destino seleccionado */
        <div className="rounded-3xl border border-white/10 bg-white/5 p-12 text-center flex flex-col items-center justify-center space-y-3 min-h-[300px]">
          <div className="w-16 h-16 rounded-3xl bg-brand-yellow/10 border border-brand-yellow/20 flex items-center justify-center text-brand-yellow shadow-inner">
            <Truck className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white">Seleccioná un Destino para Despachar</h3>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-md">
            Elegí la Panadería local o un Repartidor en el selector superior para ver su stock actual, devolver mercadería o realizar una nueva carga.
          </p>
        </div>
      )}
    </div>
  );
}
