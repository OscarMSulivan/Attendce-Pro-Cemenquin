/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  UserPlus, 
  ShieldCheck, 
  Trash2, 
  Edit3, 
  RefreshCw, 
  X,
  KeyRound,
  Eye,
  EyeOff,
  ListChecks,
  Plus,
  Server,
  Terminal,
  Copy,
  CheckCircle2,
  Download,
  HardDrive,
  Cpu,
  Globe
} from 'lucide-react';
import { PortalUser, UserRole, getUserAllowedLists } from '../../types/portal';
import { normalizeEmployeeId, normalizeSupervisorName } from '../../utils/calendarUtils';
import saveAs from 'file-saver';

interface AdminUsersViewProps {
  users: PortalUser[];
  supervisorsInCatalog: string[];
  onSaveUser: (user: PortalUser) => void;
  onDeleteUser: (userId: string) => void;
}

export const AdminUsersView: React.FC<AdminUsersViewProps> = ({
  users,
  supervisorsInCatalog,
  onSaveUser,
  onDeleteUser,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showHostingerGuide, setShowHostingerGuide] = useState(false);
  const [copiedBlock, setCopiedBlock] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [role, setRole] = useState<UserRole>('supervisor');
  const [assignedLists, setAssignedLists] = useState<string[]>([]);
  const [customListName, setCustomListName] = useState('');
  const [delegatedSupervisor, setDelegatedSupervisor] = useState('');
  const [activeStatus, setActiveStatus] = useState(true);
  const [notes, setNotes] = useState('');

  // Catálogo unificado de todas las listas disponibles (las del archivo de empleados + las ya asignadas a usuarios)
  const allAvailableLists = useMemo(() => {
    const set = new Set<string>(['OSCAR VALENZUELA', 'EUDIS ZENON']);
    supervisorsInCatalog.forEach(s => {
      if (s && s.trim()) set.add(normalizeSupervisorName(s.trim()));
    });
    users.forEach(u => {
      getUserAllowedLists(u).forEach(l => set.add(l));
    });
    assignedLists.forEach(l => {
      if (l && l.trim()) set.add(l.trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [supervisorsInCatalog, users, assignedLists]);

  const handleOpenNew = () => {
    setEditingId(null);
    setName('');
    setUsername('');
    setPassword('');
    setShowPassword(true);
    setEmail('');
    setEmployeeId('');
    setRole('supervisor');
    setAssignedLists(allAvailableLists[0] ? [allAvailableLists[0]] : []);
    setCustomListName('');
    setDelegatedSupervisor('');
    setActiveStatus(true);
    setNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: PortalUser) => {
    setEditingId(user.id);
    setName(user.name);
    setUsername(user.username || user.employeeId || user.email.split('@')[0]);
    setPassword(user.password || user.employeeId || '12345');
    setShowPassword(false);
    setEmail(user.email);
    setEmployeeId(user.employeeId || '');
    setRole(user.role);
    const currentLists = user.assignedLists && user.assignedLists.length > 0
      ? user.assignedLists
      : user.supervisorName
      ? [user.supervisorName]
      : [];
    setAssignedLists(currentLists);
    setCustomListName('');
    setDelegatedSupervisor(user.delegatedSupervisor || '');
    setActiveStatus(user.active !== false);
    setNotes(user.notes || '');
    setIsModalOpen(true);
  };

  const handleToggleAssignedList = (listName: string) => {
    const normalized = listName.trim().toUpperCase();
    setAssignedLists(prev =>
      prev.includes(normalized)
        ? prev.filter(item => item !== normalized)
        : [...prev, normalized]
    );
  };

  const handleAddCustomList = () => {
    const clean = customListName.trim().toUpperCase();
    if (!clean) return;
    if (!assignedLists.includes(clean)) {
      setAssignedLists(prev => [...prev, clean]);
    }
    setCustomListName('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('El nombre completo del usuario es obligatorio.');
      return;
    }

    const normalizedEmpId = employeeId.trim() ? normalizeEmployeeId(employeeId) : undefined;
    const cleanUsername = (username.trim() || normalizedEmpId || email.split('@')[0] || `user_${Date.now()}`).toLowerCase();
    const cleanPass = password.trim() || normalizedEmpId || '12345';

    if (role === 'supervisor' && assignedLists.length === 0) {
      alert('Por favor selecciona o escribe al menos una lista de nómina que trabajará este supervisor.');
      return;
    }

    const userToSave: PortalUser = {
      id: editingId || `user_${Date.now()}`,
      name: name.trim(),
      username: cleanUsername,
      password: cleanPass,
      email: email.trim().toLowerCase() || `${cleanUsername}@empresa.com`,
      role,
      employeeId: normalizedEmpId,
      supervisorName: role === 'supervisor' ? assignedLists[0] : undefined,
      assignedLists: role === 'supervisor' ? assignedLists : [],
      delegatedSupervisor: delegatedSupervisor ? delegatedSupervisor : undefined,
      active: activeStatus,
      notes: notes.trim()
    };

    onSaveUser(userToSave);
    setIsModalOpen(false);
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedBlock(id);
    setTimeout(() => setCopiedBlock(null), 2000);
  };

  const handleDownloadHostingerScript = () => {
    const scriptContent = `#!/bin/bash
# ==============================================================================
# SCRIPT DE INSTALACIÓN AUTOMÁTICA PARA HOSTINGER VPS PLAN KVM 2 (Ubuntu 22.04 / 24.04)
# Sistema: AttendancePRO v10 — Portal RH, Nóminas, Supervisores y CONTPAQi
# ==============================================================================
set -e

echo "=== 1. Actualizando paquetes del servidor KVM 2 ==="
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx ufw build-essential

echo "=== 2. Instalando Node.js 22 LTS y Gestor de Procesos PM2 ==="
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2 tsx

echo "=== 3. Preparando directorio de la aplicación y base de datos persistente ==="
sudo mkdir -p /var/www/attendance-pro/data
sudo chown -R $USER:$USER /var/www/attendance-pro

echo "=== 4. Configurando Firewall (UFW) para SSH, HTTP y HTTPS ==="
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

echo "=== Listo. Ahora sube los archivos del proyecto a /var/www/attendance-pro y ejecuta: ==="
echo "cd /var/www/attendance-pro && npm install && npm run build"
echo "pm2 start server.ts --interpreter tsx --name attendance-pro"
echo "pm2 save && pm2 startup"
`;
    const blob = new Blob([scriptContent], { type: 'text/x-sh;charset=utf-8' });
    saveAs(blob, 'deploy-hostinger-kvm2.sh');
  };

  return (
    <div className="space-y-6">
      {/* Encabezado Principal */}
      <div className="rounded-2xl p-5 bg-slate-900/90 border border-slate-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-100">
                Módulo de Creación de Usuarios, Credenciales y Asignación de Listas
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Crea usuarios con contraseña, número de empleado de 5 dígitos y define exactamente <strong>qué lista(s) de nómina trabajará cada supervisor</strong>.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowHostingerGuide(!showHostingerGuide)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              showHostingerGuide
                ? 'bg-emerald-600/20 text-emerald-200 border-emerald-500/50'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <Server className="w-4 h-4 text-emerald-400" />
            <span>Arquitectura Hostinger VPS KVM 2</span>
          </button>

          <button
            type="button"
            onClick={handleOpenNew}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-purple-600/25 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Crear Nuevo Usuario</span>
          </button>
        </div>
      </div>

      {/* PANEL DESPLEGABLE: ESTRUCTURA Y DESPLIEGUE EN HOSTINGER VPS KVM 2 */}
      {showHostingerGuide && (
        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30 border border-emerald-500/40 shadow-2xl space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 shrink-0">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-extrabold text-slate-100">
                    Estructura de Servidor Lista para Hostinger VPS — Plan KVM 2
                  </h4>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    2 vCPU • 8 GB RAM • 100 GB NVMe • Ubuntu LTS
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  El proyecto ya cuenta con el backend <code>server.ts</code> (Express + API REST + Base de datos persistente en <code>/data/portal_db.json</code>) para que todos los supervisores y RH trabajen sincronizados desde cualquier navegador.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadHostingerScript}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Descargar Script Instalador (deploy-hostinger-kvm2.sh)</span>
            </button>
          </div>

          {/* Tarjetas de Arquitectura en el KVM 2 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="flex items-center gap-2 font-bold text-emerald-300 mb-1">
                <Cpu className="w-4 h-4" />
                <span>1. Motor Backend (Node.js 22 + PM2)</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                <code>server.ts</code> corre en el puerto <code>3000</code> administrado por <strong>PM2</strong> o <strong>Docker</strong> con auto-arranque si el VPS se reinicia.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="flex items-center gap-2 font-bold text-blue-300 mb-1">
                <HardDrive className="w-4 h-4" />
                <span>2. Persistencia Centralizada (/data)</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Usuarios, listas dispersadas, incidencias, formatos PDF/imagen adjuntos y liberaciones se guardan en <code>/data/portal_db.json</code> en el disco NVMe del KVM 2.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="flex items-center gap-2 font-bold text-purple-300 mb-1">
                <Globe className="w-4 h-4" />
                <span>3. Reverse Proxy Nginx + SSL HTTPS</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Nginx recibe el tráfico en el puerto 80/443 (con certificado gratuito Let&apos;s Encrypt) y lo dirige a <code>localhost:3000</code> con soporte para archivos de hasta 50 MB.
              </p>
            </div>
          </div>

          {/* Pasos de consola para copiar y pegar en SSH del KVM 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  Opción A: Despliegue con Docker Compose (Recomendado en KVM 2)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyText(
                      'docker',
                      `git clone <TU_REPOSITORIO> /var/www/attendance-pro\ncd /var/www/attendance-pro\ndocker compose up -d --build`
                    )
                  }
                  className="text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 cursor-pointer"
                >
                  {copiedBlock === 'docker' ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" /> Copiar
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3 rounded-lg bg-slate-900 text-emerald-300 font-mono text-[11px] overflow-x-auto">
{`# En tu terminal SSH de Hostinger KVM 2:
mkdir -p /var/www/attendance-pro && cd /var/www/attendance-pro
# Sube los archivos del proyecto y ejecuta:
docker compose up -d --build`}
              </pre>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-blue-400" />
                  Opción B: Despliegue Directo con Node.js 22 + PM2
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyText(
                      'pm2',
                      `cd /var/www/attendance-pro\nnpm install\nnpm run build\npm2 start server.ts --interpreter tsx --name attendance-pro\npm2 save && pm2 startup`
                    )
                  }
                  className="text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 cursor-pointer"
                >
                  {copiedBlock === 'pm2' ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" /> Copiar
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3 rounded-lg bg-slate-900 text-blue-300 font-mono text-[11px] overflow-x-auto">
{`cd /var/www/attendance-pro
npm install && npm run build
pm2 start server.ts --interpreter tsx --name attendance-pro
pm2 save && pm2 startup`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Lista de usuarios registrados */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((u) => {
          const userLists = getUserAllowedLists(u);
          return (
            <div
              key={u.id}
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                u.active !== false
                  ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  : 'bg-slate-950/60 border-slate-900 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-slate-100">{u.name}</h4>
                      {u.employeeId && (
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                          ID: #{u.employeeId}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{u.email}</p>
                  </div>
                  {u.role === 'admin' ? (
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      Admin
                    </span>
                  ) : u.role === 'rh' ? (
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      RH / Nóminas
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Supervisor
                    </span>
                  )}
                </div>

                {/* Credenciales de Login */}
                <div className="mt-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800/90 flex items-center justify-between gap-2 text-[11px] font-mono">
                  <div>
                    <span className="text-slate-500 text-[9px] uppercase font-sans font-bold block">
                      Usuario Login:
                    </span>
                    <strong className="text-indigo-300">
                      {u.username || u.employeeId || u.email.split('@')[0]}
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 text-[9px] uppercase font-sans font-bold block">
                      Contraseña:
                    </span>
                    <strong className="text-emerald-300">
                      {u.password || u.employeeId || '12345'}
                    </strong>
                  </div>
                </div>

                {/* Listas asignadas */}
                {u.role === 'supervisor' && (
                  <div className="mt-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px]">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider mb-1">
                      Lista(s) de Nómina que Trabaja:
                    </span>
                    {userLists.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {userLists.map((listName) => (
                          <span
                            key={listName}
                            className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold text-[10px]"
                          >
                            {listName}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-rose-400 text-[10px]">Sin lista asignada</span>
                    )}
                  </div>
                )}

                {/* Suplencia de vacaciones */}
                {u.delegatedSupervisor && (
                  <div className="mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300">
                    <span className="block text-[9px] uppercase font-bold tracking-wider flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 text-amber-400" /> Suplencia Activa por Vacaciones:
                    </span>
                    <span>
                      Supliendo lista de: <strong>{u.delegatedSupervisor}</strong>
                    </span>
                  </div>
                )}

                {u.notes && (
                  <p className="text-[11px] text-slate-400 mt-2 italic leading-tight">
                    &ldquo;{u.notes}&rdquo;
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 mt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(u)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  title="Editar credenciales, rol y listas asignadas"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Configurar Usuario / Listas
                </button>
                {u.id !== 'user_admin' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`¿Eliminar al usuario ${u.name}?`)) onDeleteUser(u.id);
                    }}
                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs cursor-pointer"
                    title="Eliminar usuario"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Alta / Edición de Usuario y Asignación de Listas */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    {editingId ? 'Editar Usuario, Acceso y Listas Asignadas' : 'Crear Nuevo Usuario del Sistema'}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Configura su usuario, contraseña y qué lista(s) de nómina trabajará
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs max-h-[82vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Óscar Valenzuela"
                    className="w-full rounded-lg px-3 py-2 bg-slate-950 border border-slate-800 text-slate-100 outline-none focus:border-purple-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    No. Empleado (5 dígitos, ej: 00615)
                  </label>
                  <input
                    type="text"
                    value={employeeId}
                    onChange={(e) => {
                      setEmployeeId(e.target.value);
                      if (!username && /^\d+$/.test(e.target.value.trim())) {
                        setUsername(e.target.value.trim().padStart(5, '0'));
                      }
                    }}
                    placeholder="Ej: 00615"
                    className="w-full rounded-lg px-3 py-2 bg-slate-950 border border-slate-800 text-slate-100 outline-none focus:border-purple-500 font-mono"
                  />
                </div>
              </div>

              {/* Credenciales de Login */}
              <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-500/30 space-y-3">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                  <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Credenciales para Iniciar Sesión (Login)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-300 block mb-1">
                      Usuario de Acceso *
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Ej: 00615 o oscar.valenzuela"
                      className="w-full rounded-lg px-3 py-2 bg-slate-950 border border-indigo-500/40 text-indigo-200 font-mono outline-none focus:border-indigo-400"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-300 block mb-1">
                      Contraseña de Acceso *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Contraseña..."
                        className="w-full rounded-lg pl-3 pr-9 py-2 bg-slate-950 border border-indigo-500/40 text-emerald-300 font-mono outline-none focus:border-indigo-400"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@empresa.com"
                    className="w-full rounded-lg px-3 py-1.5 bg-slate-950 border border-slate-800 text-slate-200 font-mono outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Rol en el sistema */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Rol en el Sistema
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full rounded-lg px-3 py-2 bg-slate-950 border border-slate-800 text-slate-100 font-semibold outline-none focus:border-purple-500"
                >
                  <option value="supervisor">Supervisor (Trabaja y libera únicamente las listas que le asignes)</option>
                  <option value="rh">Recursos Humanos / Nóminas (Sube archivos, dispersa y exporta a CONTPAQi)</option>
                  <option value="admin">Administrador General (Control total de usuarios, roles y nóminas)</option>
                </select>
              </div>

              {/* ASIGNACIÓN DE QUÉ LISTA(S) TRABAJARÁ EL SUPERVISOR */}
              {role === 'supervisor' && (
                <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/40 space-y-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                      <ListChecks className="w-4 h-4 text-amber-400" />
                      <span>¿Qué Lista(s) de Nómina trabajará este Usuario? *</span>
                    </label>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Selecciona una o más listas del catálogo o agrega el nombre de una lista nueva. Este supervisor solo verá y trabajará los colaboradores de las listas marcadas.
                    </p>
                  </div>

                  {/* Checkboxes de listas existentes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                    {allAvailableLists.map((listName) => {
                      const isChecked = assignedLists.includes(listName);
                      return (
                        <label
                          key={listName}
                          className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-amber-500/15 border-amber-500/50 text-amber-200 font-bold'
                              : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleAssignedList(listName)}
                            className="rounded accent-amber-500"
                          />
                          <span className="truncate text-[11px]">{listName}</span>
                        </label>
                      );
                    })}
                  </div>

                  {/* Agregar nueva lista manualmente */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                    <input
                      type="text"
                      value={customListName}
                      onChange={(e) => setCustomListName(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomList();
                        }
                      }}
                      placeholder="¿Otra lista? Escribe el nombre (ej. PATRICIA CONSEJO)..."
                      className="flex-1 rounded-lg px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-100 font-mono text-xs uppercase outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomList}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar Lista</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Suplencia de Vacaciones */}
              {role === 'supervisor' && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block mb-1 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" /> Suplencia Temporal por Vacaciones (Opcional)
                  </label>
                  <select
                    value={delegatedSupervisor}
                    onChange={(e) => setDelegatedSupervisor(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 bg-slate-950 border border-slate-800 text-slate-100 outline-none focus:border-amber-500"
                  >
                    <option value="">(Ninguna - no suple a otro supervisor)</option>
                    {allAvailableLists
                      .filter(s => !assignedLists.includes(s))
                      .map((s) => (
                        <option key={s} value={s}>Suplir temporalmente a: {s}</option>
                      ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Notas / Puesto
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ej: Supervisor Planta / Turno"
                    className="w-full rounded-lg px-3 py-2 bg-slate-950 border border-slate-800 text-slate-100 outline-none focus:border-purple-500"
                  />
                </div>

                <div className="pt-4">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-200 font-semibold">
                    <input
                      type="checkbox"
                      checked={activeStatus}
                      onChange={(e) => setActiveStatus(e.target.checked)}
                      className="w-4 h-4 rounded accent-emerald-500"
                    />
                    <span>Cuenta de usuario activa (Permitir Login)</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold uppercase tracking-wider text-xs shadow-lg shadow-purple-600/20 transition-all cursor-pointer"
                >
                  Guardar Usuario y Listas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
