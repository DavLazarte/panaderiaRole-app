"use client";
import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2, Printer, CheckCircle, Truck, Package, Download, X } from 'lucide-react';

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
  
  // Carrito manual para productos que no son de reparto habitual
  const [cart, setCart] = useState<{ item: any, cantidad: number }[]>([]);
  // Cantidades de carga rápida (productos con disponible_reparto)
  const [bulkCart, setBulkCart] = useState<Record<number, string>>({});
  
  const [loading, setLoading] = useState(false);
  const [successTicket, setSuccessTicket] = useState<{ ticketId: string, repartidorName: string, items: any[], date: string } | null>(null);
  const [printingStock, setPrintingStock] = useState(false);

  // Modal para Cargar o Devolver stock
  const [actionModal, setActionModal] = useState<{
    type: 'entrada' | 'devolucion';
    item: any;
    stockActual?: number;
    isPanaderia?: boolean;
  } | null>(null);
  const [modalQty, setModalQty] = useState('');
  const [modalSubmitting, setModalSubmitting] = useState(false);

  // Reiniciar carritos cuando cambia el repartidor
  useEffect(() => {
    setCart([]);
    setBulkCart({});
  }, [repartidorId]);

  const handlePrintStock = () => {
    setPrintingStock(true);
    setTimeout(() => {
      window.print();
      setPrintingStock(false);
    }, 100);
  };

  const handleEntradaRapida = (item: any) => {
    setActionModal({ type: 'entrada', item });
    setModalQty('');
  };

  const handleDevolver = (item: any, isPanaderia: boolean, stockActual: number) => {
    setActionModal({ type: 'devolucion', item, isPanaderia, stockActual });
    setModalQty('');
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionModal) return;
    const qty = Number(modalQty);
    if (isNaN(qty) || qty <= 0) return alert('Ingrese una cantidad válida mayor a 0');

    if (actionModal.type === 'devolucion' && actionModal.stockActual !== undefined && qty > actionModal.stockActual) {
      return alert(`No puedes devolver más de lo que tiene asignado (${actionModal.stockActual})`);
    }

    setModalSubmitting(true);
    try {
      if (actionModal.type === 'entrada') {
        const res = await fetch(`${apiUrl}/deposito/entrada`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
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
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
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

  const handleSubmit = async () => {
    if (!repartidorId) return alert('Seleccione un destino');
    
    // Consolidar items (bulk + manual)
    const finalItems: { item_id: number, cantidad: number, item: any }[] = [];
    
    // Agregar bulk items
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

    // Agregar manual items
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
        const repName = repartidorId === 'panaderia' ? 'Panadería / Local' : (repartidores.find(r => r.id === Number(repartidorId))?.name || 'Repartidor');
        setSuccessTicket({
          ticketId: Math.floor(Math.random() * 100000).toString(),
          repartidorName: repName,
          items: finalItems,
          date: new Date().toLocaleString('es-AR')
        });
        setCart([]);
        setBulkCart({});
        setRepartidorId('');
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

  const printTicket = () => {
    window.print();
  };

  const repartidorStock = repartidorId === 'panaderia'
    ? articulos.filter(a => Number(a.stock) > 0)
    : (repartidorId ? articulos.filter(a => a.stock_repartidores && a.stock_repartidores[repartidorId] && a.stock_repartidores[repartidorId].cantidad > 0) : []);

  const articulosDeReparto = articulos.filter(a => a.disponible_reparto);

  if (successTicket) {
    return (
      <>
        <div className="max-w-2xl mx-auto p-6 bg-white/5 border border-white/10 rounded-2xl space-y-6 print:hidden">
          <div className="text-center space-y-2">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto" />
            <h2 className="text-2xl font-bold text-white">Despacho Confirmado</h2>
            <p className="text-zinc-400">Los productos han sido asignados correctamente.</p>
          </div>
          
          <div className="flex justify-center gap-4">
            <button onClick={() => setSuccessTicket(null)} className="px-6 py-3 rounded-xl border border-white/10 text-white font-semibold">
              Nuevo Despacho
            </button>
            <button onClick={printTicket} className="px-6 py-3 rounded-xl bg-brand-yellow text-black font-bold flex items-center gap-2">
              <Printer className="w-5 h-5" /> Imprimir Remito
            </button>
          </div>
        </div>

        {/* Ticket a Imprimir (Doble Comprobante) */}
        <div id="print-ticket" className="bg-white text-black hidden print:block print:absolute print:inset-0 print:w-full print:h-auto print:bg-white print:z-[9999] print:shadow-none print:rounded-none" style={{ fontFamily: 'Arial, sans-serif' }}>
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              body { margin: 0; padding: 0; }
              body * { visibility: hidden !important; }
              #print-ticket { visibility: visible !important; position: absolute; left: 0; top: 0; width: 100%; display: flex !important; justify-content: center !important; }
              #print-ticket * { visibility: visible !important; }
              @page { size: landscape; margin: 10mm; }
            }
          `}} />
          
          <div className="w-full max-w-5xl mx-auto p-8 flex">
            <div className="grid grid-cols-2 gap-12 divide-x-2 divide-dashed divide-gray-300 w-full">
            {/* Original */}
            <div className="pr-6">
              <div className="flex justify-between items-center border-b pb-4 mb-4">
                <img src="/logo.svg" alt="Role Logo" className="h-16" />
                <h1 className="text-2xl font-bold text-gray-800">Remito de Carga</h1>
              </div>

              <h2 className="text-blue-600 font-bold text-lg mb-2">Información del Despacho</h2>
              <div className="text-sm space-y-1 mb-6">
                <p><b>Despacho Nº:</b> {successTicket.ticketId}</p>
                <p><b>Fecha:</b> {successTicket.date}</p>
                <p><b>Tipo:</b> Salida a Reparto</p>
              </div>

              <h2 className="text-blue-600 font-bold text-lg mb-2">Información del Repartidor</h2>
              <div className="text-sm space-y-1 mb-6">
                <p><b>Repartidor:</b> {successTicket.repartidorName}</p>
              </div>

              <h2 className="text-blue-600 font-bold text-lg mb-2">Detalles de los Productos</h2>
              <table className="w-full text-sm border-collapse border border-gray-200 mb-6">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-200 py-2 px-3 text-left">Producto</th>
                    <th className="border border-gray-200 py-2 px-3 text-center w-24">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {successTicket.items.map((c, idx) => (
                    <tr key={idx}>
                      <td className="border border-gray-200 py-2 px-3">{c.item.nombre}</td>
                      <td className="border border-gray-200 py-2 px-3 text-center">{c.cantidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-right">
                <p className="font-bold text-lg">
                  Total Unidades: {successTicket.items.reduce((acc, curr) => acc + curr.cantidad, 0)}
                </p>
              </div>
            </div>

            {/* Duplicado */}
            <div className="pl-6">
              <div className="flex justify-between items-center border-b pb-4 mb-4">
                <img src="/logo.svg" alt="Role Logo" className="h-16" />
                <h1 className="text-2xl font-bold text-gray-800">Remito de Carga</h1>
              </div>

              <h2 className="text-blue-600 font-bold text-lg mb-2">Información del Despacho</h2>
              <div className="text-sm space-y-1 mb-6">
                <p><b>Despacho Nº:</b> {successTicket.ticketId}</p>
                <p><b>Fecha:</b> {successTicket.date}</p>
                <p><b>Tipo:</b> Salida a Reparto</p>
              </div>

              <h2 className="text-blue-600 font-bold text-lg mb-2">Información del Repartidor</h2>
              <div className="text-sm space-y-1 mb-6">
                <p><b>Repartidor:</b> {successTicket.repartidorName}</p>
              </div>

              <h2 className="text-blue-600 font-bold text-lg mb-2">Detalles de los Productos</h2>
              <table className="w-full text-sm border-collapse border border-gray-200 mb-6">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-200 py-2 px-3 text-left">Producto</th>
                    <th className="border border-gray-200 py-2 px-3 text-center w-24">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {successTicket.items.map((c, idx) => (
                    <tr key={idx}>
                      <td className="border border-gray-200 py-2 px-3">{c.item.nombre}</td>
                      <td className="border border-gray-200 py-2 px-3 text-center">{c.cantidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-right">
                <p className="font-bold text-lg">
                  Total Unidades: {successTicket.items.reduce((acc, curr) => acc + curr.cantidad, 0)}
                </p>
              </div>
            </div>
          </div>
          </div>
        </div>
      </>
    );
  }

  const isBulkEmpty = Object.values(bulkCart).every(v => !v || Number(v) <= 0);

  return (
    <>
      {/* ── Modal Hermoso para Cargar o Devolver Stock ── */}
      {actionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header del Modal */}
            <div className={`p-6 border-b border-white/10 flex items-center justify-between ${
              actionModal.type === 'entrada' ? 'bg-emerald-500/10' : 'bg-red-500/10'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${
                  actionModal.type === 'entrada' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {actionModal.type === 'entrada' ? <Plus className="w-5 h-5" /> : <Download className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {actionModal.type === 'entrada' ? 'Ingresar Stock al Depósito' : 'Devolver al Depósito'}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {actionModal.type === 'entrada' ? 'Carga directa de mercadería' : 'Retorno desde el destino'}
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

            {/* Contenido / Form */}
            <form onSubmit={handleModalSubmit} className="p-6 space-y-4">
              <div className="bg-black/30 border border-white/5 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-400">Producto:</span>
                  <span className="font-bold text-white">{actionModal.item.nombre}</span>
                </div>
                {actionModal.type === 'entrada' ? (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-zinc-400">Disponible en depósito:</span>
                    <span className="font-bold text-emerald-400">{actionModal.item.disponible} u.</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-zinc-400">Destino/Origen:</span>
                      <span className="font-bold text-brand-yellow">
                        {actionModal.isPanaderia ? 'Panadería / Local' : repartidores.find(r => r.id === Number(repartidorId))?.name}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-zinc-400">Stock actual en destino:</span>
                      <span className="font-bold text-brand-yellow">{actionModal.stockActual} u.</span>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
                  {actionModal.type === 'entrada' ? 'Cantidad a Ingresar' : 'Cantidad a Devolver'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={actionModal.type === 'devolucion' ? actionModal.stockActual : undefined}
                  autoFocus
                  required
                  placeholder="0.00"
                  value={modalQty}
                  onChange={e => setModalQty(e.target.value)}
                  className="w-full h-12 bg-black/40 border border-white/10 rounded-xl px-4 text-white text-lg font-bold outline-none focus:border-brand-red text-center"
                />
              </div>

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
                  disabled={modalSubmitting || !modalQty || Number(modalQty) <= 0}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm text-white transition-all shadow-lg active:scale-95 disabled:opacity-50 ${
                    actionModal.type === 'entrada'
                      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/30'
                      : 'bg-brand-red hover:bg-red-500 shadow-red-900/30'
                  }`}
                >
                  {modalSubmitting ? 'Procesando...' : actionModal.type === 'entrada' ? 'Cargar Stock' : 'Confirmar Devolución'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {printingStock && (
        <div id="print-stock-ticket" className="bg-white text-black p-8 rounded-xl max-w-2xl mx-auto shadow-2xl overflow-hidden hidden print:block print:absolute print:top-0 print:left-0 print:m-0 print:p-8 print:w-full print:max-w-none print:h-auto print:bg-white print:z-[9999] print:shadow-none print:rounded-none" style={{ fontFamily: 'Arial, sans-serif' }}>
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              body * { visibility: hidden !important; }
              #print-stock-ticket, #print-stock-ticket * { visibility: visible !important; }
              @page { size: portrait; margin: 10mm; }
            }
          `}} />
          <div className="border-b pb-4 mb-4 flex justify-between items-center">
            <img src="/logo.svg" alt="Role Logo" className="h-16" />
            <h1 className="text-2xl font-bold text-gray-800">Estado de Stock</h1>
          </div>
          <div className="mb-6">
            <p><b>Repartidor:</b> {repartidorId === 'panaderia' ? 'Panadería / Local' : repartidores.find(r => r.id === Number(repartidorId))?.name}</p>
            <p><b>Fecha:</b> {new Date().toLocaleString('es-AR')}</p>
          </div>
          <table className="w-full text-sm border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-200 py-2 px-3 text-left">Producto</th>
                <th className="border border-gray-200 py-2 px-3 text-center">Stock Actual</th>
              </tr>
            </thead>
            <tbody>
              {repartidorStock.map(a => (
                <tr key={a.id}>
                  <td className="border border-gray-200 py-2 px-3">{a.nombre}</td>
                  <td className="border border-gray-200 py-2 px-3 text-center font-bold">
                    {repartidorId === 'panaderia' ? a.stock : (a.stock_repartidores && a.stock_repartidores[repartidorId] ? a.stock_repartidores[repartidorId].cantidad : 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="w-full space-y-6 flex flex-col lg:flex-row gap-6 items-start">
        {/* Columna Principal de Despacho */}
        <div className="flex-1 min-w-0 w-full space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Nuevo Despacho a Repartidor</h2>
            
            <div className="max-w-md space-y-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Seleccionar Destino</label>
              <select 
                value={repartidorId} 
                onChange={e => setRepartidorId(e.target.value)}
                className="w-full h-12 bg-black/40 border border-white/10 rounded-xl px-4 text-white outline-none focus:border-brand-red font-medium"
              >
                <option value="" className="bg-zinc-900 text-white">Elegir Destino...</option>
                <option value="panaderia" className="bg-zinc-900 text-brand-yellow font-bold">🏠 Panadería / Local</option>
                {repartidores.map(r => (
                  <option key={r.id} value={r.id} className="bg-zinc-900 text-white">🚚 {r.name}</option>
                ))}
              </select>
            </div>
          </div>

          {repartidorId && (
            <>
              {/* Carga Rápida (Productos Habituales) */}
              {articulosDeReparto.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-white/5 bg-brand-red/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="w-5 h-5 text-brand-red" />
                      <h3 className="text-sm font-semibold text-white uppercase tracking-widest">Carga Rápida (Habituales)</h3>
                    </div>
                    <span className="text-xs text-zinc-400">{articulosDeReparto.length} productos listados</span>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {articulosDeReparto.map(a => (
                      <div key={a.id} className="bg-black/30 border border-white/10 rounded-xl p-3 flex items-center justify-between gap-3 hover:border-white/20 transition-all">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate" title={a.nombre}>{a.nombre}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-zinc-400">
                              Depósito: <b className={Number(a.disponible) > 0 ? "text-emerald-400" : "text-amber-400"}>{a.disponible}</b>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleEntradaRapida(a)}
                              className="px-2 py-0.5 text-[10px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-md flex items-center gap-1 font-semibold transition-colors shrink-0"
                              title="Cargar stock directo al depósito"
                            >
                              <Plus className="w-3 h-3" /> Cargar
                            </button>
                          </div>
                        </div>
                        <div className="shrink-0">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0"
                            value={bulkCart[a.id] || ''}
                            onChange={e => setBulkCart({...bulkCart, [a.id]: e.target.value})}
                            className="w-20 h-10 bg-white/5 border border-white/15 rounded-xl px-2 text-center text-emerald-400 font-bold outline-none focus:border-emerald-500 text-base"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Agregar Productos Extras Manualmente */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-white uppercase tracking-widest mb-4">Agregar Productos Extras</h3>
                <div className="flex flex-col sm:flex-row gap-2 relative">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input 
                      type="text" 
                      value={search}
                      onChange={e => { setSearch(e.target.value); setSelectedItem(null); }}
                      placeholder="Buscar producto que no esté en la lista rápida..."
                      className="w-full h-12 pl-10 pr-4 bg-black/40 border border-white/10 rounded-xl text-white outline-none focus:border-brand-red"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      value={cantidad}
                      onChange={e => setCantidad(e.target.value)}
                      placeholder="Cant."
                      min="0.01"
                      step="0.01"
                      className="w-24 h-12 bg-black/40 border border-white/10 rounded-xl px-3 text-center text-emerald-300 outline-none focus:border-emerald-500 font-bold"
                    />
                    <button 
                      onClick={handleAdd}
                      disabled={!selectedItem || !cantidad}
                      className="h-12 w-12 flex items-center justify-center bg-white/10 hover:bg-brand-red rounded-xl text-white transition-colors disabled:opacity-50 disabled:hover:bg-white/10 shrink-0"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  {search && !selectedItem && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                      {filteredArticulos.map(a => (
                        <div key={a.id} className="w-full text-left px-4 py-3 hover:bg-white/5 border-b border-white/5 last:border-0 flex justify-between items-center gap-2">
                          <button
                            type="button"
                            onClick={() => { setSelectedItem(a); setSearch(a.nombre); }}
                            className="flex-1 text-left"
                          >
                            <span className="text-sm font-medium text-white block">{a.nombre}</span>
                            <span className="text-xs text-zinc-400">
                              Depósito: <span className={Number(a.disponible) > 0 ? "text-emerald-400" : "text-amber-400"}>{a.disponible}</span>
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleEntradaRapida(a); }}
                            className="px-2.5 py-1 text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-lg flex items-center gap-1 shrink-0 font-medium"
                            title="Ingresar stock directo al depósito"
                          >
                            <Plus className="w-3.5 h-3.5" /> Cargar
                          </button>
                        </div>
                      ))}
                      {filteredArticulos.length === 0 && (
                        <div className="px-4 py-3 text-sm text-zinc-500">No hay productos extra coincidentes</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Lista de carga extra */}
                {cart.length > 0 && (
                  <div className="mt-4 bg-black/20 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm text-zinc-300">
                      <thead className="text-xs text-zinc-500 border-b border-white/5">
                        <tr>
                          <th className="px-4 py-3 font-medium">Producto Extra</th>
                          <th className="px-4 py-3 font-medium text-right">Cantidad</th>
                          <th className="px-4 py-3 text-right">Quitar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {cart.map((c, i) => (
                          <tr key={i} className="hover:bg-white/5 transition-colors">
                            <td className="px-4 py-3 font-medium text-white">{c.item.nombre}</td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-400">{c.cantidad}</td>
                            <td className="px-4 py-3 text-right">
                              <button 
                                onClick={() => handleRemove(c.item.id)}
                                className="p-2 rounded-lg text-zinc-500 hover:text-brand-red hover:bg-brand-red/10 transition-colors inline-block"
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
              
              <div className="flex justify-end pt-4 pb-10">
                <button 
                  onClick={handleSubmit}
                  disabled={loading || (isBulkEmpty && cart.length === 0)}
                  className="px-8 py-4 w-full md:w-auto bg-brand-red hover:bg-red-500 text-white rounded-xl font-bold uppercase tracking-widest text-sm transition-all active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2 shadow-lg shadow-brand-red/20"
                >
                  {loading ? 'Procesando...' : 'Confirmar Despacho'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Columna Lateral: Stock en tiempo real del repartidor seleccionado */}
        {repartidorId && (
          <div className="w-full lg:w-[320px] shrink-0 bg-brand-yellow/5 border border-brand-yellow/20 rounded-2xl overflow-hidden flex flex-col h-[550px] lg:sticky lg:top-6">
            <div className="p-4 border-b border-brand-yellow/20 bg-brand-yellow/10 flex justify-between items-start shrink-0">
              <div>
                <h3 className="text-sm font-bold text-brand-yellow uppercase tracking-widest flex items-center gap-2">
                  <Truck className="w-4 h-4" /> Stock Actual
                </h3>
                <p className="text-xs text-brand-yellow/70 mt-1 truncate max-w-[200px]">
                  {repartidorId === 'panaderia' ? 'Panadería / Local' : repartidores.find(r => r.id === Number(repartidorId))?.name}
                </p>
              </div>
              <button 
                onClick={handlePrintStock}
                disabled={repartidorStock.length === 0}
                className="p-2 bg-brand-yellow/20 text-brand-yellow rounded-lg hover:bg-brand-yellow/30 transition-colors disabled:opacity-50"
                title="Imprimir Stock"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 divide-y divide-white/5">
              {repartidorStock.length === 0 ? (
                <div className="p-4 text-center text-brand-yellow/50 text-sm mt-10">
                  El destino no tiene stock asignado.
                </div>
              ) : (
                repartidorStock.map(a => {
                  const isPanaderia = repartidorId === 'panaderia';
                  const stockVal = isPanaderia ? a.stock : (a.stock_repartidores && a.stock_repartidores[repartidorId] ? a.stock_repartidores[repartidorId].cantidad : 0);
                  return (
                    <div key={a.id} className="py-2.5 flex justify-between items-center gap-2 first:pt-0 last:pb-0">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-zinc-200 font-medium block truncate">{a.nombre}</span>
                        <span className="text-xs text-zinc-400">Stock: <b className="text-brand-yellow">{stockVal}</b></span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDevolver(a, isPanaderia, stockVal)}
                        className="px-2.5 py-1 bg-red-500/15 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors"
                        title="Devolver al depósito"
                      >
                        <Download className="w-3 h-3" /> Devolver
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

