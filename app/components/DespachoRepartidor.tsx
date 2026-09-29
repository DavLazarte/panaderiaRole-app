"use client";
import React, { useState } from 'react';
import { Search, Plus, Trash2, Printer, CheckCircle, Truck } from 'lucide-react';

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
  const [cart, setCart] = useState<{ item: any, cantidad: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [successTicket, setSuccessTicket] = useState<{ ticketId: string, repartidorName: string, items: any[], date: string } | null>(null);
  const [printingStock, setPrintingStock] = useState(false);

  const handlePrintStock = () => {
    setPrintingStock(true);
    setTimeout(() => {
      window.print();
      setPrintingStock(false);
    }, 100);
  };

  const filteredArticulos = (articulos || []).filter(a => 
    (a?.nombre || '').toLowerCase().includes((search || '').toLowerCase()) && Number(a?.disponible || 0) > 0
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
    if (cart.length === 0) return alert('Agregue al menos un producto');

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
          items: cart.map(c => ({ item_id: c.item.id, cantidad: c.cantidad }))
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const repName = repartidorId === 'panaderia' ? 'Panadería / Local' : (repartidores.find(r => r.id === Number(repartidorId))?.name || 'Repartidor');
        setSuccessTicket({
          ticketId: Math.floor(Math.random() * 100000).toString(),
          repartidorName: repName,
          items: [...cart],
          date: new Date().toLocaleString('es-AR')
        });
        setCart([]);
        setRepartidorId('');
        onSuccess();
      } else {
        alert(data.message || 'Error al despachar');
      }
    } catch (e) {
      alert('Error de conexión');
    }
    setLoading(false);
  };

  const printTicket = () => {
    window.print();
  };

  const repartidorStock = repartidorId === 'panaderia'
    ? articulos.filter(a => Number(a.stock) > 0)
    : (repartidorId ? articulos.filter(a => a.stock_repartidores && a.stock_repartidores[repartidorId] && a.stock_repartidores[repartidorId].cantidad > 0) : []);

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

        {/* Ticket a Imprimir (Doble Comprobante) - Oculto en pantalla, visible al imprimir */}
        <div id="print-ticket" className="bg-white text-black p-8 rounded-xl max-w-5xl mx-auto shadow-2xl overflow-hidden hidden print:block print:absolute print:top-0 print:left-0 print:m-0 print:p-8 print:w-full print:max-w-none print:h-auto print:bg-white print:z-[9999] print:shadow-none print:rounded-none" style={{ fontFamily: 'Arial, sans-serif' }}>
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              body * { visibility: hidden !important; }
              #print-ticket, #print-ticket * { visibility: visible !important; }
              @page { size: landscape; margin: 10mm; }
            }
          `}} />
          
          <div className="grid grid-cols-2 gap-12 divide-x-2 divide-dashed divide-gray-300">
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
      </>
    );
  }

  return (
    <>
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
      <div className="max-w-6xl mx-auto space-y-6 flex flex-col xl:flex-row gap-6 items-start">
        <div className="flex-1 space-y-6 w-full">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-6">Nuevo Despacho a Repartidor</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Selección de Repartidor */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Seleccionar Repartidor</label>
              <select 
                value={repartidorId} 
                onChange={e => setRepartidorId(e.target.value)}
                className="w-full h-12 bg-black/40 border border-white/10 rounded-xl px-4 text-white outline-none focus:border-brand-red"
              >
                <option value="" className="bg-zinc-900 text-white">Elegir Destino...</option>
                <option value="panaderia" className="bg-zinc-900 text-brand-yellow font-bold">🏠 Panadería / Local</option>
                {repartidores.map(r => (
                  <option key={r.id} value={r.id} className="bg-zinc-900 text-white">🚚 {r.name}</option>
                ))}
              </select>
            </div>

            {/* Buscador de Productos */}
            <div className="space-y-2 relative">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Buscar Producto (Depósito)</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input 
                    type="text" 
                    value={search}
                    onChange={e => { setSearch(e.target.value); setSelectedItem(null); }}
                    placeholder="Nombre del producto..."
                    className="w-full h-12 pl-10 pr-4 bg-black/40 border border-white/10 rounded-xl text-white outline-none focus:border-brand-red"
                  />
                </div>
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
                    <button
                      key={a.id}
                      onClick={() => { setSelectedItem(a); setSearch(a.nombre); }}
                      className="w-full text-left px-4 py-3 hover:bg-white/5 border-b border-white/5 last:border-0 flex justify-between items-center"
                    >
                      <span className="text-sm font-medium text-white">{a.nombre}</span>
                      <span className="text-xs text-emerald-400">Disp: {a.disponible}</span>
                    </button>
                  ))}
                  {filteredArticulos.length === 0 && (
                    <div className="px-4 py-3 text-sm text-zinc-500">No hay stock disponible</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Lista de Carga */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/5 bg-black/20">
            <h3 className="text-sm font-semibold text-white uppercase tracking-widest">Carga a Despachar</h3>
          </div>
          
          {cart.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-sm">
              No hay productos agregados a la carga.
            </div>
          ) : (
            <div>
              <table className="w-full text-left text-sm text-zinc-300">
                <thead className="text-xs text-zinc-500 bg-black/20">
                  <tr>
                    <th className="px-6 py-3 font-medium">Producto</th>
                    <th className="px-6 py-3 font-medium text-right">Cantidad</th>
                    <th className="px-6 py-3 text-right">Quitar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {cart.map((c, i) => (
                    <tr key={i} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-medium text-white">{c.item.nombre}</td>
                      <td className="px-6 py-4 text-right font-bold text-emerald-400">{c.cantidad}</td>
                      <td className="px-6 py-4 text-right">
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
              
              <div className="p-6 border-t border-white/5 bg-black/20 flex justify-end">
                <button 
                  onClick={handleSubmit}
                  disabled={loading || cart.length === 0 || !repartidorId}
                  className="px-8 py-3 bg-brand-red hover:bg-red-500 text-white rounded-xl font-bold uppercase tracking-widest text-sm transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? 'Procesando...' : 'Confirmar Despacho'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stock en tiempo real del repartidor seleccionado */}
      {repartidorId && (
        <div className="w-full xl:w-80 shrink-0 bg-brand-yellow/5 border border-brand-yellow/20 rounded-2xl overflow-hidden flex flex-col h-[500px]">
          <div className="p-4 border-b border-brand-yellow/20 bg-brand-yellow/10 flex justify-between items-start">
            <div>
              <h3 className="text-sm font-bold text-brand-yellow uppercase tracking-widest flex items-center gap-2">
                <Truck className="w-4 h-4" /> Stock Actual
              </h3>
              <p className="text-xs text-brand-yellow/70 mt-1">
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
          
          <div className="flex-1 overflow-y-auto p-2">
            {repartidorStock.length === 0 ? (
              <div className="p-4 text-center text-brand-yellow/50 text-sm mt-10">
                El usuario no tiene stock asignado.
              </div>
            ) : (
              <div className="space-y-1">
                {repartidorStock.map(a => (
                  <div key={a.id} className="flex justify-between items-center p-3 hover:bg-brand-yellow/10 rounded-lg transition-colors">
                    <span className="text-sm text-zinc-300 font-medium truncate pr-2">{a.nombre}</span>
                    <span className="text-sm font-bold text-brand-yellow shrink-0">
                      {repartidorId === 'panaderia' ? a.stock : a.stock_repartidores[repartidorId].cantidad}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </>
  );
}
