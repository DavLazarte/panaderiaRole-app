"use client";
import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, PackagePlus, History, Search, FileText, CheckCircle2, 
  AlertCircle, RefreshCw, X, Eye, Package, Boxes, ShoppingBag, Plus
} from 'lucide-react';
import ProveedorSelector from './ProveedorSelector';
import MateriaPrimaSelector from './MateriaPrimaSelector';
import DetalleCompraTable from './DetalleCompraTable';
import ResumenPago from './ResumenPago';

export default function ComprasApp({ token, onClose }: { token: string, onClose?: () => void }) {
  const [activeTab, setActiveTab] = useState<'nueva' | 'historial'>('nueva');

  // Estado para Nueva Compra
  const [selectedProveedor, setSelectedProveedor] = useState<any>(null);
  const [articulos, setArticulos] = useState<any[]>([]);
  const [pago, setPago] = useState<number | string>(0);
  const [tipoPago, setTipoPago] = useState<string>('efectivo');
  const [numRecibo, setNumRecibo] = useState<string>('');
  const [impactaCaja, setImpactaCaja] = useState<boolean>(true);
  
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estado para Historial de Compras
  const [historialCompras, setHistorialCompras] = useState<any[]>([]);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [historialSearch, setHistorialSearch] = useState('');
  const [historialPage, setHistorialPage] = useState(1);
  const [historialLastPage, setHistorialLastPage] = useState(1);
  const [selectedCompraDetalle, setSelectedCompraDetalle] = useState<any | null>(null);

  const fetchHistorial = async (page = 1, query = '') => {
    setHistorialLoading(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://role.test/api";
      const q = query ? `&search=${encodeURIComponent(query)}` : '';
      const res = await fetch(`${API_URL}/admin/compras?page=${page}${q}`, {
        headers: { 
          'Accept': 'application/json',
          Authorization: `Bearer ${token}` 
        }
      });
      if (res.ok) {
        const json = await res.json();
        setHistorialCompras(json.data || []);
        setHistorialPage(json.current_page || 1);
        setHistorialLastPage(json.last_page || 1);
      }
    } catch (err) {
      console.error("Error al cargar historial de compras:", err);
    } finally {
      setHistorialLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'historial') {
      fetchHistorial(historialPage, historialSearch);
    }
  }, [activeTab, historialPage]);

  // Manejar adición de Materia Prima o Artículo a la factura
  const handleAddItem = (item: any) => {
    const isArticulo = item.tipo === 'articulo';
    const nombreItem = item.nombre || item.producto || 'Producto';
    
    // Si ya existe el ítem en la factura, incrementamos la cantidad
    const existingIndex = articulos.findIndex(a => {
      if (isArticulo) {
        return a.tipo === 'articulo' && (a.idarticulo === item.id || a.id === item.id);
      } else {
        return a.tipo !== 'articulo' && (a.id_materia_prima === item.id || a.id === item.id);
      }
    });

    if (existingIndex >= 0) {
      const nuevos = [...articulos];
      const curCant = parseFloat(String(nuevos[existingIndex].cantidad).replace(',', '.')) || 0;
      nuevos[existingIndex].cantidad = String(curCant + 1);
      setArticulos(nuevos);
      return;
    }

    if (isArticulo) {
      setArticulos(prev => [...prev, {
        id: item.id,
        idarticulo: item.id,
        tipo: 'articulo',
        nombre: nombreItem,
        codigo: item.codigo,
        cantidad: '1',
        precio_compra: '',
        precio_venta: item.precio_venta ? String(item.precio_venta) : '',
      }]);
    } else {
      setArticulos(prev => [...prev, {
        id: item.id,
        id_materia_prima: item.id,
        tipo: 'materia_prima',
        nombre: nombreItem,
        cantidad: '1',
        precio_compra: item.precio_compra ? String(item.precio_compra) : '',
        precio_original: Number(item.precio_compra) || 0,
        unidad_medida: item.unidad_medida || 'bolsas',
        unidad_compra: item.unidad_compra || item.unidad_medida || 'bolsas',
        peso_unidad: item.peso_unidad ? String(item.peso_unidad) : (item.peso ? String(item.peso) : '25'),
        actualizar_maestro: true
      }]);
    }
  };

  const handleUpdateItem = (index: number, field: string | Record<string, any>, value?: any) => {
    setArticulos(prev => {
      const nuevos = [...prev];
      if (typeof field === 'object' && field !== null) {
        nuevos[index] = { ...nuevos[index], ...field };
      } else {
        nuevos[index] = { ...nuevos[index], [field]: value };
      }
      return nuevos;
    });
  };

  const handleRemoveItem = (index: number) => {
    setArticulos(prev => prev.filter((_, i) => i !== index));
  };

  const totalCompra = articulos.reduce((acc, art) => {
    const cant = parseFloat(String(art.cantidad).replace(',', '.')) || 0;
    const precio = parseFloat(String(art.precio_compra).replace(',', '.')) || 0;
    return acc + (cant * precio);
  }, 0);

  const handleGuardar = async () => {
    if (!selectedProveedor) {
      setErrorMsg("Por favor, selecciona o crea un proveedor para la factura.");
      return;
    }
    if (articulos.length === 0) {
      setErrorMsg("Agrega al menos una materia prima o artículo a la compra.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://role.test/api";
    
    try {
      const payloadArticulos = articulos.map(a => {
        if (a.tipo === 'articulo') {
          return {
            tipo: 'articulo',
            idarticulo: a.idarticulo || a.id,
            cantidad: parseFloat(String(a.cantidad).replace(',', '.')) || 1,
            precio_compra: parseFloat(String(a.precio_compra).replace(',', '.')) || 0,
            precio_venta: parseFloat(String(a.precio_venta).replace(',', '.')) || 0,
          };
        } else {
          return {
            tipo: 'materia_prima',
            id_materia_prima: a.id_materia_prima || a.id,
            cantidad: parseFloat(String(a.cantidad).replace(',', '.')) || 1,
            precio_compra: parseFloat(String(a.precio_compra).replace(',', '.')) || 0,
            actualizar_maestro: !!a.actualizar_maestro,
            unidad_medida: a.unidad_medida || a.unidad_compra || 'bolsas',
            unidad_compra: a.unidad_compra || a.unidad_medida || 'bolsas',
            peso_unidad: parseFloat(String(a.peso_unidad || a.peso || 1).replace(',', '.')) || 1
          };
        }
      });

      const res = await fetch(`${API_URL}/admin/compras`, {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          idpersona: selectedProveedor.idpersona,
          tipo_compra: 'Factura',
          num_recibo: numRecibo.trim() || null,
          pago: parseFloat(String(pago).replace(',', '.')) || 0,
          tipo_pago: tipoPago,
          impacta_caja: impactaCaja,
          articulos: payloadArticulos
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg("¡Compra registrada con éxito! El stock ingresó al depósito y los precios fueron actualizados.");
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('compra-registrada'));
        }
        setSelectedProveedor(null);
        setArticulos([]);
        setPago(0);
        setNumRecibo('');
        setTimeout(() => setSuccessMsg(null), 5000);
      } else {
        setErrorMsg(data.message || data.error || "Error al procesar la compra.");
      }
    } catch (err: any) {
      setErrorMsg("Error de conexión al guardar la compra.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-10 p-4 sm:p-6 lg:p-8 pb-28 animate-in fade-in duration-300">
      {/* ── HEADER PRINCIPAL CON BUEN AIRE ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-brand-red/20 border border-brand-red/30 flex items-center justify-center text-brand-yellow shrink-0 shadow-lg shadow-brand-red/10">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              Ingreso de Compras y Facturas
            </h1>
            <p className="text-xs sm:text-sm text-gray-400">
              Registra compras de materias primas o artículos de reventa e ingresa su stock al depósito central.
            </p>
          </div>
        </div>

        {/* Pestañas Nueva Compra / Historial */}
        <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/10 w-full md:w-fit self-start gap-1">
          <button
            onClick={() => setActiveTab('nueva')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'nueva'
                ? 'bg-brand-red text-white shadow-xl shadow-brand-red/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <PackagePlus className="w-4 h-4" />
            <span>Nueva Factura</span>
          </button>
          
          <button
            onClick={() => setActiveTab('historial')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'historial'
                ? 'bg-brand-red text-white shadow-xl shadow-brand-red/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Historial de Compras</span>
          </button>
        </div>
      </div>

      {/* Alertas con espaciado amplio */}
      {successMsg && (
        <div className="p-4 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-semibold flex items-center gap-3 shadow-xl shadow-emerald-500/5 animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="flex-1">{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="p-1 hover:bg-emerald-500/20 rounded-xl">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-3xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold flex items-center gap-3 shadow-xl shadow-red-500/5 animate-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="flex-1">{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="p-1 hover:bg-red-500/20 rounded-xl">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── TAB 1: NUEVA COMPRA ── */}
      {activeTab === 'nueva' && (
        <div className="flex flex-col gap-8">
          {/* PASO 1: SELECCIÓN DE PROVEEDOR */}
          <div className="relative z-30">
            <ProveedorSelector 
              token={token} 
              selectedProveedor={selectedProveedor} 
              onSelect={setSelectedProveedor} 
              onClear={() => setSelectedProveedor(null)} 
            />
          </div>

          {/* PASO 2: BUSCADOR CENTRAL DE PRODUCTOS */}
          <div className="relative z-20">
            <MateriaPrimaSelector 
              token={token} 
              onAdd={handleAddItem} 
            />
          </div>

          {/* PASO 3: DETALLE DE LÍNEAS DE LA FACTURA */}
          {articulos.length > 0 ? (
            <div className="flex flex-col gap-6 relative z-10">
              {/* Header de sección */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Ítems de la Factura</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Ingresá el costo por bulto en cada fila · usá ✏️ para editar cantidad, presentación y unidad</p>
                </div>
                <button
                  type="button"
                  onClick={() => setArticulos([])}
                  className="text-xs text-red-400 hover:text-red-300 font-bold px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 transition-colors"
                >
                  Vaciar
                </button>
              </div>

              <DetalleCompraTable 
                articulos={articulos} 
                onUpdate={handleUpdateItem}
                onRemove={handleRemoveItem}
              />

              {/* PASO 4: CONDICIONES DE PAGO Y FACTURACIÓN */}
              <ResumenPago 
                total={totalCompra}
                pago={pago}
                setPago={setPago}
                tipoPago={tipoPago}
                setTipoPago={setTipoPago}
                numRecibo={numRecibo}
                setNumRecibo={setNumRecibo}
                impactaCaja={impactaCaja}
                setImpactaCaja={setImpactaCaja}
              />

              {/* PASO 5: BOTÓN PRINCIPAL DE CONFIRMACIÓN */}
              <button 
                type="button"
                onClick={handleGuardar}
                disabled={loading}
                className="w-full h-14 rounded-2xl bg-brand-red hover:bg-red-600 active:scale-[0.99] text-white font-black text-base shadow-xl shadow-brand-red/25 transition-all flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Guardando e ingresando stock al depósito central...</span>
                  </>
                ) : (
                  <span>Confirmar Compra e Ingresar al Depósito Central</span>
                )}
              </button>
            </div>
          ) : (
            /* Estado Inicial / Factura Vacía Espaciosa */
            <div className="rounded-3xl border border-white/10 bg-white/5 p-12 backdrop-blur-md flex flex-col items-center justify-center text-center space-y-4 shadow-xl min-h-[300px]">
              <div className="w-16 h-16 rounded-3xl bg-brand-red/10 border border-brand-red/20 flex items-center justify-center text-brand-yellow shadow-inner">
                <Package className="w-8 h-8" />
              </div>
              
              <div className="max-w-md space-y-1.5">
                <h3 className="text-lg font-bold text-white">Factura sin productos todavía</h3>
                <p className="text-xs sm:text-sm text-zinc-400">
                  Usa la barra de búsqueda de arriba para buscar y agregar materias primas o artículos de reventa a la compra.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: HISTORIAL DE COMPRAS ── */}
      {activeTab === 'historial' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white/5 p-5 sm:p-6 rounded-3xl border border-white/10 shadow-xl">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
              <input
                type="text"
                value={historialSearch}
                onChange={e => {
                  setHistorialSearch(e.target.value);
                  fetchHistorial(1, e.target.value);
                }}
                placeholder="Buscar por Nº factura o proveedor..."
                className="w-full h-11 pl-11 pr-4 rounded-2xl bg-black/50 border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:border-brand-red outline-none"
              />
            </div>

            <button
              onClick={() => fetchHistorial(historialPage, historialSearch)}
              disabled={historialLoading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-xs sm:text-sm font-bold text-zinc-300 border border-white/10 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${historialLoading ? 'animate-spin' : ''}`} />
              <span>Actualizar Historial</span>
            </button>
          </div>

          {historialLoading ? (
            <div className="p-16 text-center text-zinc-500 flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-brand-red" />
              <p className="text-sm font-medium">Cargando historial de facturas...</p>
            </div>
          ) : historialCompras.length === 0 ? (
            <div className="p-16 text-center text-zinc-500 bg-white/5 rounded-3xl border border-white/5 space-y-2">
              <History className="w-12 h-12 mx-auto text-zinc-600 opacity-40" />
              <p className="font-bold text-base text-white">No hay facturas de compra registradas.</p>
              <p className="text-xs text-zinc-400">Las compras confirmadas se almacenan aquí con su desglose detallado.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {historialCompras.map(compra => {
                const provName = compra.proveedor?.nombre || 'Proveedor Ocasional';
                const cantItems = compra.detalles_compra?.length || compra.detallesCompra?.length || 0;
                const saldo = Number(compra.saldo) || 0;

                return (
                  <div
                    key={compra.id}
                    className="rounded-3xl border border-white/10 bg-white/5 hover:bg-white/[0.08] p-5 sm:p-6 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-5 shadow-lg"
                  >
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300 shrink-0">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-bold text-white text-base">{provName}</span>
                          {compra.num_recibo ? (
                            <span className="text-xs font-mono font-bold text-brand-yellow bg-brand-yellow/10 border border-brand-yellow/20 px-2.5 py-0.5 rounded-lg">
                              Fac #{compra.num_recibo}
                            </span>
                          ) : (
                            <span className="text-xs font-mono font-bold text-zinc-400 bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-lg">
                              S/N
                            </span>
                          )}
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                            compra.impacta_caja ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-zinc-400'
                          }`}>
                            {compra.impacta_caja ? 'Impactó Caja' : 'Sin impacto en caja'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-zinc-400 flex-wrap">
                          <span>📅 {new Date(compra.created_at).toLocaleDateString('es-AR')} {new Date(compra.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs</span>
                          <span>• 📦 {cantItems} {cantItems === 1 ? 'ítem' : 'ítems'}</span>
                          <span>• 💳 {compra.tipo_pago || 'efectivo'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-white/5">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-zinc-500 block">Total Compra</span>
                        <span className="text-xl font-black text-white font-mono">
                          ${Number(compra.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                        {saldo > 0 && (
                          <span className="text-xs text-red-400 block font-bold">
                            Resta: ${saldo.toLocaleString('es-AR')}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => setSelectedCompraDetalle(compra)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs sm:text-sm font-semibold text-zinc-200 transition-all active:scale-95 cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Ver Ítems</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Paginación */}
              {historialLastPage > 1 && (
                <div className="flex items-center justify-center gap-3 pt-6">
                  <button
                    disabled={historialPage <= 1}
                    onClick={() => setHistorialPage(p => Math.max(1, p - 1))}
                    className="px-5 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-xs sm:text-sm font-bold text-zinc-300 disabled:opacity-40 transition-colors"
                  >
                    Anterior
                  </button>
                  <span className="text-xs sm:text-sm text-zinc-400">
                    Página <b>{historialPage}</b> de <b>{historialLastPage}</b>
                  </span>
                  <button
                    disabled={historialPage >= historialLastPage}
                    onClick={() => setHistorialPage(p => Math.min(historialLastPage, p + 1))}
                    className="px-5 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-xs sm:text-sm font-bold text-zinc-300 disabled:opacity-40 transition-colors"
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL DETALLE DE COMPRA PREVIA ── */}
      {selectedCompraDetalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#1c1c1e] border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-white/10 bg-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Factura #{selectedCompraDetalle.num_recibo}</span>
                  <span className="text-xs text-brand-yellow font-normal font-mono">
                    ({selectedCompraDetalle.tipo_pago})
                  </span>
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Proveedor: <b>{selectedCompraDetalle.proveedor?.nombre || 'Proveedor Ocasional'}</b> · {new Date(selectedCompraDetalle.created_at).toLocaleString('es-AR')}
                </p>
              </div>

              <button
                onClick={() => setSelectedCompraDetalle(null)}
                className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              <h4 className="text-xs uppercase font-extrabold text-zinc-400 tracking-wider">Productos de la Factura</h4>
              <div className="space-y-3">
                {(selectedCompraDetalle.detalles_compra || selectedCompraDetalle.detallesCompra || []).map((det: any, i: number) => {
                  const isArt = !!det.idarticulo;
                  const nombre = det.articulo?.nombre || det.materia_prima?.producto || det.materiaPrima?.producto || `Ítem #${det.idarticulo || det.id_materia_prima}`;
                  
                  return (
                    <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-black/50 border border-white/5 text-sm">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-white">{nombre}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isArt ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'
                          }`}>
                            {isArt ? 'Artículo Reventa' : 'Materia Prima'}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400">
                          {det.cantidad} {isArt ? 'unidades' : 'bultos'} x ${Number(det.precio_compra).toLocaleString('es-AR')}
                        </p>
                      </div>
                      <span className="font-black text-brand-yellow font-mono text-base">
                        ${Number(det.precio_total).toLocaleString('es-AR')}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="pt-5 border-t border-white/10 space-y-2 text-sm">
                <div className="flex justify-between text-zinc-400">
                  <span>Total Facturado:</span>
                  <span className="font-black text-white text-base">${Number(selectedCompraDetalle.total).toLocaleString('es-AR')}</span>
                </div>
                <div className="flex justify-between text-emerald-400">
                  <span>Monto Abonado:</span>
                  <span className="font-bold">${Number(selectedCompraDetalle.pago || 0).toLocaleString('es-AR')}</span>
                </div>
                {Number(selectedCompraDetalle.saldo) > 0 && (
                  <div className="flex justify-between text-red-400 font-bold">
                    <span>Saldo en Cuenta Corriente:</span>
                    <span>-${Number(selectedCompraDetalle.saldo).toLocaleString('es-AR')}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 border-t border-white/10 bg-black/40 flex justify-end">
              <button
                onClick={() => setSelectedCompraDetalle(null)}
                className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
