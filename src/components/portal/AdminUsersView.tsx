/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
import { PortalUser, UserRole, PortalModule, getUserAllowedLists, getUserAllowedModules } from '../../types/portal';
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
  const [formError, setFormError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [role, setRole] = useState<UserRole>('supervisor');
  const [allowedModules, setAllowedModules] = useState<PortalModule[]>(['nomina', 'incidencias']);
  const [assignedLists, setAssignedLists] = useState<string[]>([]);
  const [customListName, setCustomListName] = useState('');
  const [delegatedSupervisor, setDelegatedSupervisor] = useState('');
  const [activeStatus, setActiveStatus] = useState(true);
  const [notes, setNotes] = useState('');

  // Catálogo unificado de todas las listas disponibles
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
    setFormError(null);
    setName('');
    setUsername('');
    setPassword('');
    setShowPassword(true);
    setEmail('');
    setEmployeeId('');
    setRole('supervisor');
    setAllowedModules(['nomina', 'incidencias']);
    setAssignedLists(allAvailableLists[0] ? [allAvailableLists[0]] : []);
    setCustomListName('');
    setDelegatedSupervisor('');
    setActiveStatus(true);
    setNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: PortalUser) => {
    setEditingId(user.id);
    setFormError(null);
    setName(user.name);
    setUsername(user.username || user.employeeId || user.email.split('@')[0]);
    setPassword(user.password || user.employeeId || '12345');
    setShowPassword(false);
    setEmail(user.email);
    setEmployeeId(user.employeeId || '');
    setRole(user.role);
    setAllowedModules(getUserAllowedModules(user));
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

  const handleToggleModule = (mod: PortalModule) => {
    setAllowedModules(prev =>
      prev.includes(mod)
        ? prev.filter(m => m !== mod)
        : [...prev, mod]
    );
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
      setFormError('El nombre completo del usuario es obligatorio.');
      return;
    }

    const normalizedEmpId = employeeId.trim() ? normalizeEmployeeId(employeeId) : undefined;
    const cleanUsername = (username.trim() || normalizedEmpId || email.split('@')[0] || `user_${Date.now()}`).toLowerCase();
    const cleanPass = password.trim() || normalizedEmpId || '12345';

    if (role === 'supervisor' && assignedLists.length === 0) {
      setFormError('Selecciona o escribe al menos una lista de nómina para este supervisor.');
      return;
    }

    if (allowedModules.length === 0) {
      setFormError('Selecciona al menos un módulo del sistema al que este usuario tendrá acceso.');
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
      allowedModules,
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
      <div className="rounded-2xl p-5 bg-[#21222D] border border-[#2C2D3C] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-[#F2C8ED]/15 border border-[#F2C8ED]/30 flex items-center justify-center text-[#F2C8ED]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">
                Módulo de Usuarios, Credenciales y Asignación de Listas
              </h3>
              <p className="text-xs text-[#8C8D9B] mt-0.5">
                Crea usuarios con contraseña, ID de 5 dígitos y define qué lista(s) de nómina trabajará cada supervisor.
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
                ? 'bg-[#A9DFD8]/15 text-[#A9DFD8] border-[#A9DFD8]/40'
                : 'bg-[#171821] hover:bg-[#2A2B36] text-slate-200 border-[#2C2D3C]'
            }`}
          >
            <Server className="w-4 h-4 text-[#A9DFD8]" />
            <span>Arquitectura Hostinger VPS KVM 2</span>
          </button>

          <button
            type="button"
            onClick={handleOpenNew}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#A9DFD8] hover:bg-[#95d0c8] text-[#171821] text-xs font-extrabold uppercase tracking-wider transition-all shadow-md cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Crear Nuevo Usuario</span>
          </button>
        </div>
      </div>

      {/* PANEL DESPLEGABLE: ESTRUCTURA Y DESPLIEGUE EN HOSTINGER VPS KVM 2 */}
      {showHostingerGuide && (
        <div className="p-6 rounded-2xl bg-[#21222D] border border-[#A9DFD8]/30 shadow-xl space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2C2D3C] pb-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#A9DFD8]/15 border border-[#A9DFD8]/30 flex items-center justify-center text-[#A9DFD8] shrink-0">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-extrabold text-white">
                    Estructura de Servidor Lista para Hostinger VPS — Plan KVM 2
                  </h4>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#A9DFD8]/15 text-[#A9DFD8] border border-[#A9DFD8]/30">
                    2 vCPU • 8 GB RAM • 100 GB NVMe • Ubuntu LTS
                  </span>
                </div>
                <p className="text-xs text-[#8C8D9B] mt-1">
                  El proyecto cuenta con el backend <code>server.ts</code> (Express + API REST + Base de datos persistente en <code>/data/portal_db.json</code>).
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadHostingerScript}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#A9DFD8] hover:bg-[#95d0c8] text-[#171821] text-xs font-extrabold shadow-md shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Descargar Script Instalador (deploy-hostinger-kvm2.sh)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-[#171821] border border-[#2C2D3C]">
              <div className="flex items-center gap-2 font-bold text-[#A9DFD8] mb-1">
                <Cpu className="w-4 h-4" />
                <span>1. Motor Backend (Node.js 22 + PM2)</span>
              </div>
              <p className="text-[11px] text-[#8C8D9B] leading-relaxed">
                <code>server.ts</code> corre en el puerto <code>3000</code> administrado por <strong>PM2</strong> o <strong>Docker</strong>.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#171821] border border-[#2C2D3C]">
              <div className="flex items-center gap-2 font-bold text-[#20AEF3] mb-1">
                <HardDrive className="w-4 h-4" />
                <span>2. Persistencia Centralizada (/data)</span>
              </div>
              <p className="text-[11px] text-[#8C8D9B] leading-relaxed">
                Usuarios, listas dispersadas, incidencias y liberaciones se guardan en <code>/data/portal_db.json</code>.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#171821] border border-[#2C2D3C]">
              <div className="flex items-center gap-2 font-bold text-[#F2C8ED] mb-1">
                <Globe className="w-4 h-4" />
                <span>3. Reverse Proxy Nginx + SSL HTTPS</span>
              </div>
              <p className="text-[11px] text-[#8C8D9B] leading-relaxed">
                Nginx recibe tráfico en el puerto 80/443 (con certificado Let&apos;s Encrypt) hacia <code>localhost:3000</code>.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-[#171821] border border-[#2C2D3C] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-[#A9DFD8]" />
                  Opción A: Despliegue con Docker Compose
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyText(
                      'docker',
                      `git clone <TU_REPOSITORIO> /var/www/attendance-pro\ncd /var/www/attendance-pro\ndocker compose up -d --build`
                    )
                  }
                  className="text-[10px] px-2 py-1 rounded bg-[#21222D] hover:bg-[#2A2B36] text-slate-300 flex items-center gap-1 cursor-pointer border border-[#2C2D3C]"
                >
                  {copiedBlock === 'docker' ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-[#A9DFD8]" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" /> Copiar
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3 rounded-lg bg-[#21222D] text-[#A9DFD8] font-mono text-[11px] overflow-x-auto">
{`mkdir -p /var/www/attendance-pro && cd /var/www/attendance-pro
docker compose up -d --build`}
              </pre>
            </div>

            <div className="p-4 rounded-xl bg-[#171821] border border-[#2C2D3C] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-[#20AEF3]" />
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
                  className="text-[10px] px-2 py-1 rounded bg-[#21222D] hover:bg-[#2A2B36] text-slate-300 flex items-center gap-1 cursor-pointer border border-[#2C2D3C]"
                >
                  {copiedBlock === 'pm2' ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-[#A9DFD8]" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" /> Copiar
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3 rounded-lg bg-[#21222D] text-[#20AEF3] font-mono text-[11px] overflow-x-auto">
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
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                u.active !== false
                  ? 'bg-[#21222D] border-[#2C2D3C] hover:border-[#A9DFD8]/40 shadow-lg'
                  : 'bg-[#171821] border-[#2C2D3C]/60 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-white">{u.name}</h4>
                      {u.employeeId && (
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[#20AEF3]/15 text-[#20AEF3] border border-[#20AEF3]/30">
                          ID #{u.employeeId}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#8C8D9B] mt-0.5">{u.email}</p>
                  </div>
                  {u.role === 'admin' ? (
                    <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-lg bg-[#F2C8ED]/15 text-[#F2C8ED] border border-[#F2C8ED]/30">
                      Admin
                    </span>
                  ) : u.role === 'rh' ? (
                    <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-lg bg-[#20AEF3]/15 text-[#20AEF3] border border-[#20AEF3]/30">
                      RH / Nóminas
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-lg bg-[#FEB95A]/15 text-[#FEB95A] border border-[#FEB95A]/30">
                      Supervisor
                    </span>
                  )}
                </div>

                {/* Credenciales de Login */}
                <div className="mt-2 p-3 rounded-xl bg-[#171821] border border-[#2C2D3C] flex items-center justify-between gap-2 text-[11px] font-mono">
                  <div>
                    <span className="text-[#8C8D9B] text-[9px] uppercase font-sans font-bold block">
                      Usuario Login:
                    </span>
                    <strong className="text-[#A9DFD8]">
                      {u.username || u.employeeId || u.email.split('@')[0]}
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-[#8C8D9B] text-[9px] uppercase font-sans font-bold block">
                      Contraseña:
                    </span>
                    <strong className="text-white">
                      {u.password || u.employeeId || '12345'}
                    </strong>
                  </div>
                </div>

                {/* Módulos de Acceso Permitidos */}
                <div className="mt-2.5 p-2.5 rounded-xl bg-[#171821] border border-[#2C2D3C] text-[11px]">
                  <span className="text-[#8C8D9B] block text-[9px] uppercase font-bold tracking-wider mb-1.5">
                    Módulos con Acceso Permitido:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {getUserAllowedModules(u).map((mod) => (
                      <span
                        key={mod}
                        className="px-2 py-0.5 rounded-md bg-[#20AEF3]/10 text-[#20AEF3] border border-[#20AEF3]/25 font-bold text-[9px] uppercase"
                      >
                        {mod === 'nomina' ? 'Nómina' : mod === 'semaforo' ? 'Semáforo' : mod === 'incidencias' ? 'Incidencias' : mod === 'contpaqi' ? 'CONTPAQi' : 'Usuarios'}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Listas asignadas */}
                {u.role === 'supervisor' && (
                  <div className="mt-2.5 p-3 rounded-xl bg-[#171821] border border-[#2C2D3C] text-[11px]">
                    <span className="text-[#8C8D9B] block text-[9px] uppercase font-bold tracking-wider mb-1.5">
                      Lista(s) de Nómina Asignadas:
                    </span>
                    {userLists.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {userLists.map((listName) => (
                          <span
                            key={listName}
                            className="px-2 py-0.5 rounded-md bg-[#FEB95A]/15 text-[#FEB95A] border border-[#FEB95A]/30 font-bold text-[10px]"
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
                  <div className="mt-2.5 p-2.5 rounded-xl bg-[#FEB95A]/10 border border-[#FEB95A]/30 text-[11px] text-[#FEB95A]">
                    <span className="block text-[9px] uppercase font-bold tracking-wider flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" /> Suplencia Activa:
                    </span>
                    <span>
                      Supliendo a: <strong>{u.delegatedSupervisor}</strong>
                    </span>
                  </div>
                )}

                {u.notes && (
                  <p className="text-[11px] text-[#8C8D9B] mt-2.5 italic leading-tight">
                    &ldquo;{u.notes}&rdquo;
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 mt-3 border-t border-[#2C2D3C]">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(u)}
                  className="px-3 py-1.5 rounded-xl bg-[#171821] hover:bg-[#2A2B36] text-slate-200 border border-[#2C2D3C] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#A9DFD8]" /> Configurar Usuario
                </button>
                {u.id !== 'user_admin' && (
                  <button
                    type="button"
                    onClick={() => onDeleteUser(u.id)}
                    className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 text-xs cursor-pointer transition-colors"
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
      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-[#21222D] border border-[#2C2D3C] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 bg-[#171821] border-b border-[#2C2D3C] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#A9DFD8]/15 border border-[#A9DFD8]/30 flex items-center justify-center text-[#A9DFD8]">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">
                    {editingId ? 'Editar Usuario y Listas Asignadas' : 'Crear Nuevo Usuario del Sistema'}
                  </h3>
                  <p className="text-[11px] text-[#8C8D9B]">
                    Configura su usuario, contraseña y qué lista(s) de nómina trabajará
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl bg-[#21222D] text-[#8C8D9B] hover:text-white border border-[#2C2D3C] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs max-h-[82vh] overflow-y-auto">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 font-semibold">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#8C8D9B] block mb-1">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Óscar Valenzuela"
                    className="w-full rounded-xl px-3 py-2 bg-[#171821] border border-[#2C2D3C] text-white outline-none focus:border-[#A9DFD8]"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#8C8D9B] block mb-1">
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
                    className="w-full rounded-xl px-3 py-2 bg-[#171821] border border-[#2C2D3C] text-white outline-none focus:border-[#A9DFD8] font-mono"
                  />
                </div>
              </div>

              {/* Credenciales de Login */}
              <div className="p-4 rounded-xl bg-[#171821] border border-[#2C2D3C] space-y-3">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#A9DFD8]">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Credenciales para Iniciar Sesión (Login)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-[#8C8D9B] block mb-1">
                      Usuario de Acceso *
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Ej: 00615 o oscar.valenzuela"
                      className="w-full rounded-xl px-3 py-2 bg-[#21222D] border border-[#2C2D3C] text-[#A9DFD8] font-mono outline-none focus:border-[#A9DFD8]"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-[#8C8D9B] block mb-1">
                      Contraseña de Acceso *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Contraseña..."
                        className="w-full rounded-xl pl-3 pr-9 py-2 bg-[#21222D] border border-[#2C2D3C] text-white font-mono outline-none focus:border-[#A9DFD8]"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8C8D9B] hover:text-white cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-[#8C8D9B] block mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@empresa.com"
                    className="w-full rounded-xl px-3 py-2 bg-[#21222D] border border-[#2C2D3C] text-slate-200 font-mono outline-none focus:border-[#A9DFD8]"
                  />
                </div>
              </div>

              {/* Rol en el sistema */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#8C8D9B] block mb-1">
                  Rol en el Sistema
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full rounded-xl px-3 py-2.5 bg-[#171821] border border-[#2C2D3C] text-white font-semibold outline-none focus:border-[#A9DFD8]"
                >
                  <option value="supervisor">Supervisor (Trabaja y libera únicamente las listas asignadas)</option>
                  <option value="rh">Recursos Humanos / Nóminas (Sube archivos, dispersa y exporta a CONTPAQi)</option>
                  <option value="admin">Administrador General (Control total de usuarios, roles y nóminas)</option>
                </select>
              </div>

              {/* ASIGNACIÓN DE PERMISOS Y ACCESO A MÓDULOS */}
              <div className="p-4 rounded-xl bg-[#171821] border border-[#20AEF3]/40 space-y-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#20AEF3] flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Permisos y Acceso a Módulos del Sistema *</span>
                  </label>
                  <p className="text-[11px] text-[#8C8D9B] mt-0.5">
                    Selecciona exactamente a qué módulos puede entrar este colaborador (ej. Nómina, Semáforo, Incidencias o CONTPAQi).
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                    allowedModules.includes('nomina')
                      ? 'bg-[#20AEF3]/15 border-[#20AEF3]/50 text-[#20AEF3]'
                      : 'bg-[#21222D] border-[#2C2D3C] text-slate-300'
                  }`}>
                    <input
                      type="checkbox"
                      checked={allowedModules.includes('nomina')}
                      onChange={() => handleToggleModule('nomina')}
                      className="mt-0.5 rounded accent-[#20AEF3]"
                    />
                    <div>
                      <strong className="block text-xs font-bold text-white">Nómina y Asistencia</strong>
                      <span className="text-[10px] text-[#8C8D9B] block">Trabajo de checadas, horarios y asistencias de listas</span>
                    </div>
                  </label>

                  <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                    allowedModules.includes('semaforo')
                      ? 'bg-[#A9DFD8]/15 border-[#A9DFD8]/50 text-[#A9DFD8]'
                      : 'bg-[#21222D] border-[#2C2D3C] text-slate-300'
                  }`}>
                    <input
                      type="checkbox"
                      checked={allowedModules.includes('semaforo')}
                      onChange={() => handleToggleModule('semaforo')}
                      className="mt-0.5 rounded accent-[#A9DFD8]"
                    />
                    <div>
                      <strong className="block text-xs font-bold text-white">Semáforo de Nóminas</strong>
                      <span className="text-[10px] text-[#8C8D9B] block">Monitoreo de liberación y dispersión semanal</span>
                    </div>
                  </label>

                  <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                    allowedModules.includes('incidencias')
                      ? 'bg-[#FEB95A]/15 border-[#FEB95A]/50 text-[#FEB95A]'
                      : 'bg-[#21222D] border-[#2C2D3C] text-slate-300'
                  }`}>
                    <input
                      type="checkbox"
                      checked={allowedModules.includes('incidencias')}
                      onChange={() => handleToggleModule('incidencias')}
                      className="mt-0.5 rounded accent-[#FEB95A]"
                    />
                    <div>
                      <strong className="block text-xs font-bold text-white">Bandeja de Incidencias</strong>
                      <span className="text-[10px] text-[#8C8D9B] block">Solicitudes, permisos y validación de formatos</span>
                    </div>
                  </label>

                  <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                    allowedModules.includes('contpaqi')
                      ? 'bg-[#F2C8ED]/15 border-[#F2C8ED]/50 text-[#F2C8ED]'
                      : 'bg-[#21222D] border-[#2C2D3C] text-slate-300'
                  }`}>
                    <input
                      type="checkbox"
                      checked={allowedModules.includes('contpaqi')}
                      onChange={() => handleToggleModule('contpaqi')}
                      className="mt-0.5 rounded accent-[#F2C8ED]"
                    />
                    <div>
                      <strong className="block text-xs font-bold text-white">CONTPAQi® Nóminas</strong>
                      <span className="text-[10px] text-[#8C8D9B] block">Exportador y layout con claves de incidencias</span>
                    </div>
                  </label>

                  {role === 'admin' && (
                    <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all sm:col-span-2 ${
                      allowedModules.includes('usuarios')
                        ? 'bg-purple-500/15 border-purple-500/50 text-purple-300'
                        : 'bg-[#21222D] border-[#2C2D3C] text-slate-300'
                    }`}>
                      <input
                        type="checkbox"
                        checked={allowedModules.includes('usuarios')}
                        onChange={() => handleToggleModule('usuarios')}
                        className="mt-0.5 rounded accent-purple-500"
                      />
                      <div>
                        <strong className="block text-xs font-bold text-white">Administración de Usuarios</strong>
                        <span className="text-[10px] text-[#8C8D9B] block">Crear credenciales, asignar listas y otorgar accesos</span>
                      </div>
                    </label>
                  )}
                </div>
              </div>
              {role === 'supervisor' && (
                <div className="p-4 rounded-xl bg-[#171821] border border-[#FEB95A]/40 space-y-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#FEB95A] flex items-center gap-1.5">
                      <ListChecks className="w-4 h-4" />
                      <span>¿Qué Lista(s) de Nómina trabajará este Usuario? *</span>
                    </label>
                    <p className="text-[11px] text-[#8C8D9B] mt-0.5">
                      Selecciona una o más listas del catálogo o agrega una nueva.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                    {allAvailableLists.map((listName) => {
                      const isChecked = assignedLists.includes(listName);
                      return (
                        <label
                          key={listName}
                          className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-[#FEB95A]/15 border-[#FEB95A]/50 text-[#FEB95A] font-bold'
                              : 'bg-[#21222D] border-[#2C2D3C] text-slate-300 hover:border-[#8C8D9B]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleAssignedList(listName)}
                            className="rounded accent-[#FEB95A]"
                          />
                          <span className="truncate text-[11px]">{listName}</span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-[#2C2D3C]">
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
                      placeholder="¿Otra lista? Escribe el nombre..."
                      className="flex-1 rounded-xl px-3 py-2 bg-[#21222D] border border-[#2C2D3C] text-white font-mono text-xs uppercase outline-none focus:border-[#FEB95A]"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomList}
                      className="px-3 py-2 rounded-xl bg-[#FEB95A] hover:bg-[#f5a83d] text-[#171821] font-extrabold text-xs flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Suplencia de Vacaciones */}
              {role === 'supervisor' && (
                <div className="p-3.5 rounded-xl bg-[#171821] border border-[#2C2D3C]">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#FEB95A] block mb-1.5 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" /> Suplencia Temporal por Vacaciones (Opcional)
                  </label>
                  <select
                    value={delegatedSupervisor}
                    onChange={(e) => setDelegatedSupervisor(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 bg-[#21222D] border border-[#2C2D3C] text-white outline-none focus:border-[#FEB95A]"
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
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#8C8D9B] block mb-1">
                    Notas / Puesto
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ej: Supervisor Planta / Turno"
                    className="w-full rounded-xl px-3 py-2 bg-[#171821] border border-[#2C2D3C] text-white outline-none focus:border-[#A9DFD8]"
                  />
                </div>

                <div className="pt-4">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-200 font-semibold">
                    <input
                      type="checkbox"
                      checked={activeStatus}
                      onChange={(e) => setActiveStatus(e.target.checked)}
                      className="w-4 h-4 rounded accent-[#A9DFD8]"
                    />
                    <span>Cuenta de usuario activa (Permitir Login)</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2C2D3C]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-[#8C8D9B] hover:text-white cursor-pointer font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#A9DFD8] hover:bg-[#95d0c8] text-[#171821] font-extrabold uppercase tracking-wider text-xs shadow-md transition-all cursor-pointer"
                >
                  Guardar Usuario y Listas
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
