"use client";
import React, { useState, useEffect } from 'react';
import { Plus, Edit2, KeyRound, Trash2, Search, X } from 'lucide-react';

interface UsuariosCrudProps {
  token: string;
  apiUrl: string;
}

export default function UsuariosCrud({ token, apiUrl }: UsuariosCrudProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [resetPasswordOpen, setResetPasswordOpen] = useState<any>(null);

  const rolesDisponibles = ['admin', 'preventista', 'vendedor', 'cliente_mayorista', 'produccion'];

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const role = fd.get('role') as string;
    
    const body = {
      name: fd.get('name'),
      email: fd.get('email'),
      vehiculo: fd.get('vehiculo') || null,
      roles: role ? [role] : [],
      password: fd.get('password') || undefined,
    };

    const url = editingUser ? `${apiUrl}/admin/users/${editingUser.id}` : `${apiUrl}/admin/users`;
    const method = editingUser ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        setModalOpen(false);
        setEditingUser(null);
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.message || 'Error al guardar');
      }
    } catch (e) {
      alert('Error de red');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const password = fd.get('password');
    if (!password) return;

    try {
      const res = await fetch(`${apiUrl}/admin/users/${resetPasswordOpen.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        alert('Contraseña actualizada correctamente');
        setResetPasswordOpen(null);
      } else {
        alert('Error al resetear contraseña');
      }
    } catch (e) {
      alert('Error de red');
    }
  };

  const filtered = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Gestión de Usuarios</h2>
          <p className="text-zinc-400 text-sm">Administra los accesos y roles del sistema.</p>
        </div>
        <button 
          onClick={() => { setEditingUser(null); setModalOpen(true); }}
          className="bg-brand-red hover:bg-red-500 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" /> Nuevo Usuario
        </button>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/5 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:border-brand-red outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-black/20 text-xs text-zinc-500 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4 font-medium">Nombre</th>
                <th className="px-6 py-4 font-medium">Email</th>
                <th className="px-6 py-4 font-medium">Móvil/Vehículo</th>
                <th className="px-6 py-4 font-medium">Rol Principal</th>
                <th className="px-6 py-4 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-8">Cargando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-zinc-500">No se encontraron usuarios</td></tr>
              ) : (
                filtered.map(u => (
                  <tr key={u.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-medium text-white">{u.name}</td>
                    <td className="px-6 py-4">{u.email}</td>
                    <td className="px-6 py-4">
                      {u.vehiculo ? <span className="text-zinc-300">Móvil {u.vehiculo}</span> : <span className="text-zinc-600">-</span>}
                    </td>
                    <td className="px-6 py-4">
                      {u.roles?.length > 0 ? (
                        <span className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-xs font-semibold">
                          {u.roles[0].name}
                        </span>
                      ) : <span className="text-zinc-500 text-xs">Sin rol</span>}
                    </td>
                    <td className="px-6 py-4 flex items-center justify-end gap-2">
                      <button 
                        onClick={() => setResetPasswordOpen(u)}
                        className="p-2 bg-white/5 hover:bg-brand-yellow/20 text-zinc-400 hover:text-brand-yellow rounded-lg transition-colors"
                        title="Cambiar Contraseña"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => { setEditingUser(u); setModalOpen(true); }}
                        className="p-2 bg-white/5 hover:bg-brand-red/20 text-zinc-400 hover:text-brand-red rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear/Editar */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
              <h3 className="font-bold text-white">{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
              <button onClick={() => setModalOpen(false)} className="text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5 block">Nombre Completo</label>
                <input name="name" type="text" required defaultValue={editingUser?.name}
                  className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm text-white outline-none focus:border-brand-red" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5 block">Correo Electrónico</label>
                <input name="email" type="email" required defaultValue={editingUser?.email}
                  className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm text-white outline-none focus:border-brand-red" />
              </div>
              {!editingUser && (
                <div>
                  <label className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5 block">Contraseña Inicial</label>
                  <input name="password" type="password" required minLength={6}
                    className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm text-white outline-none focus:border-brand-red" />
                </div>
              )}
              <div>
                <label className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5 block">Rol de Sistema</label>
                <select name="role" defaultValue={editingUser?.roles?.[0]?.name || ''} required
                  className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm text-white outline-none focus:border-brand-red">
                  <option value="" className="bg-zinc-900 text-white">Seleccione un rol...</option>
                  {rolesDisponibles.map(r => (
                    <option key={r} value={r} className="bg-zinc-900 text-white">{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-400 uppercase tracking-widest mb-1.5 block">Identificador de Móvil (Opcional)</label>
                <input name="vehiculo" type="text" defaultValue={editingUser?.vehiculo || ''} placeholder="Ej: 1, 2, Camioneta..."
                  className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm text-white outline-none focus:border-brand-red" />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-3 rounded-xl border border-white/10 text-white text-sm font-semibold hover:bg-white/5 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 py-3 rounded-xl bg-brand-red text-white text-sm font-bold hover:bg-red-500 transition-colors">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cambiar Contraseña */}
      {resetPasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
              <h3 className="font-bold text-white">Resetear Contraseña</h3>
              <button onClick={() => setResetPasswordOpen(null)} className="text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <p className="text-sm text-zinc-400">Ingrese la nueva contraseña para <b>{resetPasswordOpen.name}</b>.</p>
              <div>
                <input name="password" type="text" required minLength={6} placeholder="Nueva contraseña..."
                  className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm text-white outline-none focus:border-brand-red" />
              </div>
              <button type="submit" className="w-full py-3 rounded-xl bg-brand-yellow text-black text-sm font-bold hover:bg-yellow-400 transition-colors">Actualizar</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
