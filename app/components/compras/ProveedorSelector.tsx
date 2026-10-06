"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, X, Building2, Phone, MapPin, Mail, UserCheck, AlertCircle, RefreshCw } from 'lucide-react';

interface ProveedorSelectorProps {
  token: string;
  onSelect: (proveedor: any) => void;
  selectedProveedor: any;
  onClear: () => void;
}

export default function ProveedorSelector({ token, onSelect, selectedProveedor, onClear }: ProveedorSelectorProps) {
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Modal para crear nuevo proveedor rápido
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [nuevoForm, setNuevoForm] = useState({
    nombre: '',
    telefono: '',
    direccion: '',
    mail: ''
  });

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchProveedores = async (query = '') => {
    setLoading(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://role.test/api";
      const endpoint = query.trim() 
        ? `${API_URL}/admin/personas?tipo_persona=proveedor&search=${encodeURIComponent(query.trim())}`
        : `${API_URL}/admin/personas?tipo_persona=proveedor&all=true`;
      
      const res = await fetch(endpoint, {
        headers: { 
          'Accept': 'application/json',
          Authorization: `Bearer ${token}` 
        }
      });
      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json) ? json : (Array.isArray(json.data) ? json.data : []);
        // Nos aseguramos de quedarnos con proveedores si la respuesta fue genérica
        const filtered = list.filter((p: any) => !p.tipo_persona || p.tipo_persona === 'proveedor');
        setProveedores(filtered);
      }
    } catch (err) {
      console.error("Error al cargar proveedores:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProveedores();
  }, [token]);

  // Búsqueda con debounce en tiempo real
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setIsDropdownOpen(true);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      fetchProveedores(val);
    }, 250);
  };

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCrearProveedor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoForm.nombre.trim()) {
      setCreateError("El nombre del proveedor es obligatorio.");
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://role.test/api";
      const res = await fetch(`${API_URL}/admin/personas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          nombre: nuevoForm.nombre.trim(),
          tipo_persona: 'proveedor',
          telefono: nuevoForm.telefono.trim() || null,
          direccion: nuevoForm.direccion.trim() || null,
          mail: nuevoForm.mail.trim() || null
        })
      });

      const data = await res.json();
      if (res.ok && data.data) {
        onSelect(data.data);
        setModalOpen(false);
        setNuevoForm({ nombre: '', telefono: '', direccion: '', mail: '' });
        fetchProveedores();
      } else {
        setCreateError(data.message || data.error || "No se pudo crear el proveedor.");
      }
    } catch (err) {
      setCreateError("Error de conexión con el servidor.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className={`rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md transition-all shadow-xl hover:border-white/20 flex flex-col gap-4 relative ${
        isDropdownOpen ? 'z-40' : 'z-20'
      }`}
      style={{ padding: '1.5rem' }}
    >
      <div className="flex items-center justify-between pb-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white leading-tight">Proveedor de la Factura</h3>
            <p className="text-xs text-zinc-400">Selecciona o registra el proveedor comercial</p>
          </div>
        </div>

        {!selectedProveedor && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs sm:text-sm font-bold text-zinc-200 transition-all active:scale-95 hover:border-white/20 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-brand-yellow" />
            <span>Nuevo Proveedor</span>
          </button>
        )}
      </div>

      {selectedProveedor ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-zinc-800/90 border border-emerald-500/30 shadow-lg">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <UserCheck className="w-6 h-6" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-bold text-white truncate">{selectedProveedor.nombre}</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  ID #{selectedProveedor.idpersona}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                {selectedProveedor.telefono && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-zinc-500" /> {selectedProveedor.telefono}
                  </span>
                )}
                {selectedProveedor.direccion && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-zinc-500" /> {selectedProveedor.direccion}
                  </span>
                )}
                {selectedProveedor.mail && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-zinc-500" /> {selectedProveedor.mail}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-zinc-300 hover:text-red-400 border border-white/10 hover:border-red-500/30 text-xs font-semibold transition-all self-end sm:self-auto cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
            <span>Cambiar Proveedor</span>
          </button>
        </div>
      ) : (
        <div className="relative" ref={dropdownRef}>
          <div className="flex items-center gap-3 w-full h-12 px-4 rounded-xl bg-zinc-800 border border-white/10 focus-within:border-brand-red transition-colors">
            <Search className="w-5 h-5 text-zinc-400 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              onFocus={() => setIsDropdownOpen(true)}
              placeholder="Buscar proveedor por nombre, teléfono o ID..."
              className="w-full bg-transparent text-sm sm:text-base text-white placeholder:text-zinc-500 outline-none"
            />
            {loading && (
              <RefreshCw className="w-4 h-4 text-zinc-500 animate-spin shrink-0" />
            )}
            {!loading && search && (
              <button
                type="button"
                onClick={() => { setSearch(''); fetchProveedores(''); }}
                className="p-1 text-zinc-400 hover:text-white shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Menú flotante de resultados */}
          {isDropdownOpen && (
            <div className="absolute left-0 right-0 top-full mt-2 z-50 max-h-64 overflow-y-auto rounded-2xl border border-white/20 bg-zinc-950 p-2 shadow-2xl backdrop-blur-2xl space-y-1">
              {loading && proveedores.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-brand-red" />
                  <span>Buscando proveedores...</span>
                </div>
              ) : proveedores.length > 0 ? (
                proveedores.map(p => (
                  <div
                    key={p.idpersona}
                    onClick={() => {
                      onSelect(p);
                      setIsDropdownOpen(false);
                      setSearch('');
                    }}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 cursor-pointer transition-all group"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-sm text-white group-hover:text-brand-yellow transition-colors truncate">
                        {p.nombre}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                        <span>ID #{p.idpersona}</span>
                        {p.telefono && <span>• 📞 {p.telefono}</span>}
                        {p.direccion && <span>• 📍 {p.direccion}</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="p-1.5 rounded-lg bg-white/5 text-zinc-400 group-hover:bg-brand-red group-hover:text-white transition-all shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center space-y-2">
                  <p className="text-xs text-zinc-400">No se encontraron proveedores coincidentes.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setNuevoForm(prev => ({ ...prev, nombre: search }));
                      setModalOpen(true);
                      setIsDropdownOpen(false);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-red/20 text-brand-yellow border border-brand-red/30 text-xs font-semibold hover:bg-brand-red/30 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Crear "{search}" como Proveedor</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal Nuevo Proveedor (exact styling as native app modals) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-lg text-white">Registrar Nuevo Proveedor</h2>
              <button 
                type="button" 
                onClick={() => setModalOpen(false)} 
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCrearProveedor} className="space-y-4">
              {createError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div>
                <label className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5 block">Nombre / Razón Social *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Molino Cañuelas S.A."
                  value={nuevoForm.nombre}
                  onChange={e => setNuevoForm({ ...nuevoForm, nombre: e.target.value })}
                  className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white outline-none focus:border-brand-red"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5 block">Teléfono / WhatsApp</label>
                <input
                  type="text"
                  placeholder="Ej: 381-1234567"
                  value={nuevoForm.telefono}
                  onChange={e => setNuevoForm({ ...nuevoForm, telefono: e.target.value })}
                  className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white outline-none focus:border-brand-red"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5 block">Dirección / Localidad</label>
                <input
                  type="text"
                  placeholder="Ej: Av. Belgrano 1234"
                  value={nuevoForm.direccion}
                  onChange={e => setNuevoForm({ ...nuevoForm, direccion: e.target.value })}
                  className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white outline-none focus:border-brand-red"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5 block">Correo Electrónico</label>
                <input
                  type="email"
                  placeholder="Ej: ventas@proveedor.com"
                  value={nuevoForm.mail}
                  onChange={e => setNuevoForm({ ...nuevoForm, mail: e.target.value })}
                  className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white outline-none focus:border-brand-red"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 h-11 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 font-semibold text-sm transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 h-11 rounded-xl bg-brand-red hover:bg-red-600 text-white font-bold text-sm shadow-lg shadow-brand-red/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {creating && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>{creating ? "Guardando..." : "Crear y Seleccionar"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
