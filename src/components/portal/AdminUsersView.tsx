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
  Globe,
  Clock,
  Timer,
  Mail,
  Send,
  Lock,
  AlertTriangle
} from 'lucide-react';
import {
  PortalUser,
  UserRole,
  PortalModule,
  PayrollDispersal,
  EmailServerConfig,
  PORTAL_MODULE_LABELS,
  getUserAllowedLists,
  getUserAllowedModules,
  userHasModuleAccess,
} from '../../types/portal';
import { normalizeEmployeeId, normalizeSupervisorName } from '../../utils/calendarUtils';
import { PortalService } from '../../services/portalService';
import saveAs from 'file-saver';
import { HeadlessSelect, SelectOption } from '../ui/HeadlessSelect';
import { DispersalCountdownTimer } from './DispersalCountdownTimer';

interface AdminUsersViewProps {
  users: PortalUser[];
  currentUser?: PortalUser;
  supervisorsInCatalog: string[];
  onSaveUser: (user: PortalUser) => void;
  onDeleteUser: (userId: string) => void;
  horasLimiteLiberacion?: number;
  onSaveHorasLimiteLiberacion?: (horas: number, applyToCurrentWeek: boolean, resetFromNow: boolean) => void;
  currentWeekNumber?: number;
  activeDispersal?: PayrollDispersal;
  emailConfig?: EmailServerConfig;
  onSaveEmailConfig?: (cfg: EmailServerConfig) => void;
}

export const AdminUsersView: React.FC<AdminUsersViewProps> = ({
  users,
  currentUser,
  supervisorsInCatalog,
  onSaveUser,
  onDeleteUser,
  horasLimiteLiberacion = 24,
  onSaveHorasLimiteLiberacion,
  currentWeekNumber,
  activeDispersal,
  emailConfig,
  onSaveEmailConfig,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showHostingerGuide, setShowHostingerGuide] = useState(false);
  const [copiedBlock, setCopiedBlock] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Permisos granulares del usuario en sesión sobre cada sub-módulo administrativo
  const canManageUsers = !currentUser || userHasModuleAccess(currentUser, 'usuarios');
  const canConfigureTimeLimit = !currentUser || userHasModuleAccess(currentUser, 'tiempo_limite');
  const canConfigureSmtp = !currentUser || userHasModuleAccess(currentUser, 'smtp_correo');

  // Estado para configuración de horas límite de liberación de nómina
  const [deadlineHoursInput, setDeadlineHoursInput] = useState<number>(horasLimiteLiberacion);
  const [applyToActiveWeek, setApplyToActiveWeek] = useState<boolean>(true);
  const [resetClockFromNow, setResetClockFromNow] = useState<boolean>(false);

  React.useEffect(() => {
    setDeadlineHoursInput(horasLimiteLiberacion);
  }, [horasLimiteLiberacion]);

  // Estado para configuración de credenciales SMTP (envío automático de dispersión)
  const [smtpForm, setSmtpForm] = useState<EmailServerConfig>(() => emailConfig || PortalService.loadEmailConfig());
  const [showSmtpPassword, setShowSmtpPassword] = useState<boolean>(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState<boolean>(false);
  const [smtpTestFeedback, setSmtpTestFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  React.useEffect(() => {
    if (emailConfig) {
      setSmtpForm(emailConfig);
    }
  }, [emailConfig]);

  const handleApplySmtpPreset = (preset: 'gmail' | 'office365' | 'hostinger') => {
    if (preset === 'gmail') {
      setSmtpForm(prev => ({
        ...prev,
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpSecure: false,
      }));
    } else if (preset === 'office365') {
      setSmtpForm(prev => ({
        ...prev,
        smtpHost: 'smtp.office365.com',
        smtpPort: 587,
        smtpSecure: false,
      }));
    } else if (preset === 'hostinger') {
      setSmtpForm(prev => ({
        ...prev,
        smtpHost: 'smtp.hostinger.com',
        smtpPort: 465,
        smtpSecure: true,
      }));
    }
    setSmtpTestFeedback(null);
  };

  const handleSaveSmtpCredentials = () => {
    const cleaned: EmailServerConfig = {
      smtpHost: (smtpForm.smtpHost || 'smtp.gmail.com').trim(),
      smtpPort: Number(smtpForm.smtpPort) || 587,
      smtpUser: (smtpForm.smtpUser || '').trim(),
      smtpPass: (smtpForm.smtpPass || '').trim(),
      smtpSecure: Boolean(smtpForm.smtpSecure) || Number(smtpForm.smtpPort) === 465,
      smtpFromName: (smtpForm.smtpFromName || 'AttendancePRO Nóminas').trim(),
    };
    PortalService.saveEmailConfig(cleaned);
    if (onSaveEmailConfig) {
      onSaveEmailConfig(cleaned);
    }
    setSmtpTestFeedback({
      ok: true,
      message: `✓ Credenciales SMTP guardadas para ${cleaned.smtpUser || 'el servidor configurado'} (${cleaned.smtpHost}:${cleaned.smtpPort}).`,
    });
  };

  const handleTestSmtpConnection = async () => {
    if (!smtpForm.smtpUser || !smtpForm.smtpPass) {
      setSmtpTestFeedback({
        ok: false,
        message: 'Ingresa primero el Correo Remitente (Usuario SMTP) y la Contraseña / Clave de Aplicación.',
      });
      return;
    }
    setIsTestingSmtp(true);
    setSmtpTestFeedback(null);
    try {
      const cleaned: EmailServerConfig = {
        smtpHost: (smtpForm.smtpHost || 'smtp.gmail.com').trim(),
        smtpPort: Number(smtpForm.smtpPort) || 587,
        smtpUser: (smtpForm.smtpUser || '').trim(),
        smtpPass: (smtpForm.smtpPass || '').trim(),
        smtpSecure: Boolean(smtpForm.smtpSecure) || Number(smtpForm.smtpPort) === 465,
        smtpFromName: (smtpForm.smtpFromName || 'AttendancePRO Nóminas').trim(),
      };
      PortalService.saveEmailConfig(cleaned);
      if (onSaveEmailConfig) {
        onSaveEmailConfig(cleaned);
      }

      const res = await fetch('/api/notifications/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleaned),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSmtpTestFeedback({
          ok: true,
          message: data.message || `✓ Conexión SMTP verificada con éxito. Se envió correo de prueba a ${cleaned.smtpUser}.`,
        });
      } else {
        setSmtpTestFeedback({
          ok: false,
          message: data.error || 'No se pudo autenticar con el servidor SMTP. Verifica puerto y contraseña de aplicación.',
        });
      }
    } catch (err: any) {
      setSmtpTestFeedback({
        ok: false,
        message: err.message || 'Error de red al probar conexión con el servidor SMTP.',
      });
    } finally {
      setIsTestingSmtp(false);
    }
  };

  // Form states para creación/edición de usuarios
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

  const roleOptions: SelectOption[] = useMemo(() => [
    { value: 'supervisor', label: 'Supervisor', sublabel: 'Trabaja y libera las listas asignadas (y módulos extra que autorices)' },
    { value: 'rh', label: 'Recursos Humanos / Nóminas', sublabel: 'Sube archivos, dispersa, configura plazos/correo y exporta a CONTPAQi' },
    { value: 'admin', label: 'Administrador General', sublabel: 'Control total de usuarios, roles, plazos, SMTP y nóminas' },
  ], []);

  const delegationOptions: SelectOption[] = useMemo(() => [
    { value: '', label: '(Ninguna - no suple a otro supervisor)' },
    ...allAvailableLists
      .filter(s => !assignedLists.includes(s))
      .map(s => ({ value: s, label: `Suplir temporalmente a: ${s}` }))
  ], [allAvailableLists, assignedLists]);

  const getDefaultModulesForRole = (r: UserRole): PortalModule[] => {
    if (r === 'admin') {
      return ['nomina', 'semaforo', 'incidencias', 'contpaqi', 'tiempo_limite', 'smtp_correo', 'usuarios'];
    }
    if (r === 'rh') {
      return ['nomina', 'semaforo', 'incidencias', 'contpaqi', 'tiempo_limite', 'smtp_correo'];
    }
    return ['nomina', 'incidencias'];
  };

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
      supervisorName: assignedLists.length > 0 ? assignedLists[0] : undefined,
      assignedLists: assignedLists,
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

  const allSelectableModules: Array<{
    id: PortalModule;
    badgeColor: string;
    activeClass: string;
    accentClass: string;
  }> = [
    {
      id: 'nomina',
      badgeColor: 'bg-sky-50 dark:bg-[#20AEF3]/10 text-sky-700 dark:text-[#20AEF3] border-sky-200 dark:border-[#20AEF3]/30',
      activeClass: 'bg-sky-50 dark:bg-[#20AEF3]/15 border-sky-400 dark:border-[#20AEF3]/50 text-sky-800 dark:text-[#20AEF3]',
      accentClass: 'accent-sky-500 dark:accent-[#20AEF3]',
    },
    {
      id: 'semaforo',
      badgeColor: 'bg-teal-50 dark:bg-[#A9DFD8]/10 text-teal-800 dark:text-[#A9DFD8] border-teal-200 dark:border-[#A9DFD8]/30',
      activeClass: 'bg-teal-50 dark:bg-[#A9DFD8]/15 border-teal-400 dark:border-[#A9DFD8]/50 text-teal-900 dark:text-[#A9DFD8]',
      accentClass: 'accent-teal-600 dark:accent-[#A9DFD8]',
    },
    {
      id: 'incidencias',
      badgeColor: 'bg-amber-50 dark:bg-[#FEB95A]/10 text-amber-800 dark:text-[#FEB95A] border-amber-200 dark:border-[#FEB95A]/30',
      activeClass: 'bg-amber-50 dark:bg-[#FEB95A]/15 border-amber-400 dark:border-[#FEB95A]/50 text-amber-900 dark:text-[#FEB95A]',
      accentClass: 'accent-amber-500 dark:accent-[#FEB95A]',
    },
    {
      id: 'contpaqi',
      badgeColor: 'bg-pink-50 dark:bg-[#F2C8ED]/10 text-pink-700 dark:text-[#F2C8ED] border-pink-200 dark:border-[#F2C8ED]/30',
      activeClass: 'bg-pink-50 dark:bg-[#F2C8ED]/15 border-pink-400 dark:border-[#F2C8ED]/50 text-pink-900 dark:text-[#F2C8ED]',
      accentClass: 'accent-pink-500 dark:accent-[#F2C8ED]',
    },
    {
      id: 'tiempo_limite',
      badgeColor: 'bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/30',
      activeClass: 'bg-orange-50 dark:bg-orange-500/15 border-orange-400 dark:border-orange-500/50 text-orange-900 dark:text-orange-300',
      accentClass: 'accent-orange-500',
    },
    {
      id: 'smtp_correo',
      badgeColor: 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30',
      activeClass: 'bg-indigo-50 dark:bg-indigo-500/15 border-indigo-400 dark:border-indigo-500/50 text-indigo-900 dark:text-indigo-300',
      accentClass: 'accent-indigo-500',
    },
    {
      id: 'usuarios',
      badgeColor: 'bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/30',
      activeClass: 'bg-purple-50 dark:bg-purple-500/15 border-purple-400 dark:border-purple-500/50 text-purple-900 dark:text-purple-300',
      accentClass: 'accent-purple-500',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Encabezado Principal */}
      <div className="rounded-2xl p-5 bg-white dark:bg-[#21222D] border border-slate-200 dark:border-[#2C2D3C] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-md dark:shadow-xl">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-[#F2C8ED]/15 border border-purple-200 dark:border-[#F2C8ED]/30 flex items-center justify-center text-purple-700 dark:text-[#F2C8ED]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Módulo Administrativo: Usuarios, Roles, Tiempo Límite y Servidor SMTP
              </h3>
              <p className="text-xs text-slate-600 dark:text-[#8C8D9B] mt-0.5">
                Gestiona accesos por módulo, configura el límite de horas para liberar nóminas y administra las credenciales seguras de envío de correo SMTP.
              </p>
            </div>
          </div>
        </div>

        {canManageUsers && (
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowHostingerGuide(!showHostingerGuide)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                showHostingerGuide
                  ? 'bg-teal-50 dark:bg-[#A9DFD8]/15 text-teal-800 dark:text-[#A9DFD8] border-teal-300 dark:border-[#A9DFD8]/40'
                  : 'bg-slate-100 dark:bg-[#171821] hover:bg-slate-200 dark:hover:bg-[#2A2B36] text-slate-800 dark:text-slate-200 border-slate-300 dark:border-[#2C2D3C]'
              }`}
            >
              <Server className="w-4 h-4 text-teal-600 dark:text-[#A9DFD8]" />
              <span>Arquitectura Hostinger VPS KVM 2</span>
            </button>

            <button
              type="button"
              onClick={handleOpenNew}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-600 dark:bg-[#A9DFD8] hover:bg-teal-500 dark:hover:bg-[#95d0c8] text-white dark:text-[#171821] text-xs font-extrabold uppercase tracking-wider transition-all shadow-md cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Crear Nuevo Usuario</span>
            </button>
          </div>
        )}
      </div>

      {/* SECCIÓN 1: CONFIGURACIÓN DE LÍMITE DE TIEMPO PARA LIBERAR NÓMINA (POR HORAS) */}
      {canConfigureTimeLimit && (
        <div className="rounded-2xl p-5 bg-white dark:bg-[#21222D] border border-slate-200 dark:border-[#2C2D3C] shadow-md dark:shadow-xl space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-[#2C2D3C] pb-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-[#FEB95A]/15 border border-amber-200 dark:border-[#FEB95A]/30 flex items-center justify-center text-amber-600 dark:text-[#FEB95A] shrink-0">
                <Timer className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Módulo de Tiempo Límite para Trabajar y Liberar Lista (Por Horas)
                  </h4>
                  <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-lg bg-teal-50 dark:bg-[#A9DFD8]/15 text-teal-800 dark:text-[#A9DFD8] border border-teal-200 dark:border-[#A9DFD8]/30">
                    Plazo actual: {horasLimiteLiberacion > 0 ? `${horasLimiteLiberacion} horas` : 'Sin límite estricto'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-[#8C8D9B] mt-0.5">
                  Define cuántas horas tienen permitidas los supervisores para validar y liberar su lista de nómina después de ser dispersada. Esta cuenta regresiva se visualiza en vivo dentro de su portal.
                </p>
              </div>
            </div>

            {/* Vista previa en tiempo real de cómo lo ve el supervisor */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-[#2C2D3C] flex flex-col items-start sm:items-end justify-center shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#8C8D9B] mb-1">
                Vista previa en Portal de Supervisor:
              </span>
              <DispersalCountdownTimer
                limiteLiberacion={
                  activeDispersal?.limiteLiberacion && applyToActiveWeek && !resetClockFromNow
                    ? new Date(
                        new Date(activeDispersal.fechaDispersion).getTime() +
                          deadlineHoursInput * 3600000
                      ).toISOString()
                    : deadlineHoursInput > 0
                    ? new Date(Date.now() + deadlineHoursInput * 3600000).toISOString()
                    : undefined
                }
                isReleased={false}
                isCancelled={false}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
            {/* Selección rápida por horas */}
            <div className="lg:col-span-5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1.5">
                1. Selección Rápida de Plazo (Horas tras dispersión):
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {[6, 12, 24, 36, 48, 72].map(hrs => {
                  const isSelected = deadlineHoursInput === hrs;
                  return (
                    <button
                      key={hrs}
                      type="button"
                      onClick={() => setDeadlineHoursInput(hrs)}
                      className={`py-2 px-2 rounded-xl text-xs font-extrabold font-mono border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                          : 'bg-slate-50 hover:bg-slate-100 dark:bg-[#171821] dark:hover:bg-[#2A2B36] text-slate-700 dark:text-slate-200 border-slate-300 dark:border-[#2C2D3C]'
                      }`}
                    >
                      {hrs}h
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Entrada numérica exacta en horas */}
            <div className="lg:col-span-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1.5">
                2. O Personalizar Horas Exactas:
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    min={0}
                    max={336}
                    value={deadlineHoursInput}
                    onChange={(e) => setDeadlineHoursInput(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full text-xs rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#171821] border border-slate-300 dark:border-[#2C2D3C] text-slate-900 dark:text-white font-mono font-bold outline-none focus:border-amber-500"
                  />
                </div>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0">
                  horas
                </span>
              </div>
            </div>

            {/* Opciones de aplicación a semana activa y guardado */}
            <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center justify-end gap-2.5">
              {activeDispersal && (
                <div className="flex flex-col gap-1 text-[11px] text-slate-600 dark:text-slate-300 mr-auto">
                  <label className="flex items-center gap-1.5 cursor-pointer font-semibold">
                    <input
                      type="checkbox"
                      checked={applyToActiveWeek}
                      onChange={(e) => setApplyToActiveWeek(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-700 text-teal-600"
                    />
                    <span>Actualizar Semana {currentWeekNumber} activa</span>
                  </label>
                  {applyToActiveWeek && (
                    <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-amber-700 dark:text-[#FEB95A]">
                      <input
                        type="checkbox"
                        checked={resetClockFromNow}
                        onChange={(e) => setResetClockFromNow(e.target.checked)}
                        className="rounded border-slate-300 dark:border-slate-700 text-amber-500"
                      />
                      <span>Reiniciar conteo desde este momento</span>
                    </label>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  if (onSaveHorasLimiteLiberacion) {
                    onSaveHorasLimiteLiberacion(deadlineHoursInput, applyToActiveWeek, resetClockFromNow);
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-teal-600 dark:bg-[#A9DFD8] hover:bg-teal-500 dark:hover:bg-[#95d0c8] text-white dark:text-[#171821] text-xs font-extrabold uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
              >
                <Clock className="w-4 h-4" />
                <span>Guardar Límite ({deadlineHoursInput}h)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECCIÓN 2: CONFIGURACIÓN SEGURA DE CREDENCIALES SMTP PARA ENVÍO AUTOMÁTICO DE CORREOS */}
      {canConfigureSmtp && (
        <div className="rounded-2xl p-5 bg-white dark:bg-[#21222D] border border-slate-200 dark:border-[#2C2D3C] shadow-md dark:shadow-xl space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-[#2C2D3C] pb-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Credenciales SMTP para Envío Automático de Correos de Dispersión
                  </h4>
                  {smtpForm.smtpUser && smtpForm.smtpPass ? (
                    <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Configurado ({smtpForm.smtpUser})
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Falta contraseña SMTP
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-[#8C8D9B] mt-0.5">
                  Configura el servidor, puerto, correo remitente y contraseña de aplicación para que el sistema envíe automáticamente las alertas por email a cada supervisor al dispersar la nómina.
                </p>
              </div>
            </div>

            {/* Botones rápidos de proveedor */}
            <div className="flex items-center gap-1.5 flex-wrap shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#8C8D9B] mr-1">
                Plantilla SMTP:
              </span>
              <button
                type="button"
                onClick={() => handleApplySmtpPreset('gmail')}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                  smtpForm.smtpHost === 'smtp.gmail.com'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-[#171821] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2C2D3C]'
                }`}
              >
                Gmail (587)
              </button>
              <button
                type="button"
                onClick={() => handleApplySmtpPreset('office365')}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                  smtpForm.smtpHost === 'smtp.office365.com'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-[#171821] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2C2D3C]'
                }`}
              >
                Outlook / 365 (587)
              </button>
              <button
                type="button"
                onClick={() => handleApplySmtpPreset('hostinger')}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                  smtpForm.smtpHost === 'smtp.hostinger.com'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-[#171821] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2C2D3C]'
                }`}
              >
                Hostinger / cPanel (465)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
            {/* Servidor SMTP */}
            <div className="lg:col-span-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
                Servidor SMTP (Host) *
              </label>
              <input
                type="text"
                value={smtpForm.smtpHost || ''}
                onChange={(e) => setSmtpForm(prev => ({ ...prev, smtpHost: e.target.value }))}
                placeholder="smtp.gmail.com"
                className="w-full text-xs rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#171821] border border-slate-300 dark:border-[#2C2D3C] text-slate-900 dark:text-white font-mono outline-none focus:border-indigo-500"
              />
            </div>

            {/* Puerto SMTP */}
            <div className="lg:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
                Puerto *
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={smtpForm.smtpPort || 587}
                  onChange={(e) => {
                    const port = parseInt(e.target.value, 10) || 587;
                    setSmtpForm(prev => ({
                      ...prev,
                      smtpPort: port,
                      smtpSecure: port === 465,
                    }));
                  }}
                  placeholder="587"
                  className="w-full text-xs rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#171821] border border-slate-300 dark:border-[#2C2D3C] text-slate-900 dark:text-white font-mono font-bold outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Usuario / Correo Remitente */}
            <div className="lg:col-span-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
                Usuario / Correo de Nóminas *
              </label>
              <input
                type="email"
                value={smtpForm.smtpUser || ''}
                onChange={(e) => setSmtpForm(prev => ({ ...prev, smtpUser: e.target.value }))}
                placeholder="nominas@empresa.com"
                className="w-full text-xs rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#171821] border border-slate-300 dark:border-[#2C2D3C] text-slate-900 dark:text-white font-mono outline-none focus:border-indigo-500"
              />
            </div>

            {/* Contraseña / App Password */}
            <div className="lg:col-span-4">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3 text-indigo-500" />
                  Contraseña / Clave de Aplicación *
                </span>
                <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-normal">
                  En Gmail usa Contraseña de Aplicación (16 letras)
                </span>
              </label>
              <div className="relative">
                <input
                  type={showSmtpPassword ? 'text' : 'password'}
                  value={smtpForm.smtpPass || ''}
                  onChange={(e) => setSmtpForm(prev => ({ ...prev, smtpPass: e.target.value }))}
                  placeholder="xxxx xxxx xxxx xxxx"
                  className="w-full text-xs rounded-xl pl-3 pr-9 py-2 bg-slate-50 dark:bg-[#171821] border border-slate-300 dark:border-[#2C2D3C] text-slate-900 dark:text-white font-mono outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                  title={showSmtpPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showSmtpPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Fila inferior: Nombre remitente, SSL/TLS, Probar y Guardar */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 dark:border-[#2C2D3C]/60">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Nombre visible:</span>
                <input
                  type="text"
                  value={smtpForm.smtpFromName || ''}
                  onChange={(e) => setSmtpForm(prev => ({ ...prev, smtpFromName: e.target.value }))}
                  placeholder="AttendancePRO Nóminas"
                  className="text-xs rounded-lg px-2.5 py-1 bg-slate-50 dark:bg-[#171821] border border-slate-300 dark:border-[#2C2D3C] text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>

              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(smtpForm.smtpSecure)}
                  onChange={(e) => setSmtpForm(prev => ({ ...prev, smtpSecure: e.target.checked }))}
                  className="rounded border-slate-300 text-indigo-600"
                />
                <span>Usar SSL/TLS Directo (Puerto 465)</span>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleTestSmtpConnection}
                disabled={isTestingSmtp}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#171821] dark:hover:bg-[#2A2B36] text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-[#2C2D3C] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>{isTestingSmtp ? 'Verificando SMTP...' : 'Probar Conexión y Enviar Correo'}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveSmtpCredentials}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold uppercase tracking-wider shadow-md flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Guardar Credenciales SMTP</span>
              </button>
            </div>
          </div>

          {smtpTestFeedback && (
            <div
              className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
                smtpTestFeedback.ok
                  ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300'
              }`}
            >
              <span>{smtpTestFeedback.message}</span>
              <button
                type="button"
                onClick={() => setSmtpTestFeedback(null)}
                className="text-xs font-bold opacity-70 hover:opacity-100 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}

      {/* PANEL DESPLEGABLE: ESTRUCTURA Y DESPLIEGUE EN HOSTINGER VPS KVM 2 */}
      {canManageUsers && showHostingerGuide && (
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

      {/* SECCIÓN 3: LISTA DE USUARIOS REGISTRADOS Y ASIGNACIÓN DE PERMISOS */}
      {canManageUsers && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((u) => {
            const userLists = getUserAllowedLists(u);
            const userMods = getUserAllowedModules(u);
            return (
              <div
                key={u.id}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                  u.active !== false
                    ? 'bg-white dark:bg-[#21222D] border-slate-200 dark:border-[#2C2D3C] hover:border-teal-400 dark:hover:border-[#A9DFD8]/40 shadow-md dark:shadow-lg'
                    : 'bg-slate-100 dark:bg-[#171821] border-slate-200 dark:border-[#2C2D3C]/60 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{u.name}</h4>
                        {u.employeeId && (
                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-lg bg-sky-50 dark:bg-[#20AEF3]/15 text-sky-700 dark:text-[#20AEF3] border border-sky-200 dark:border-[#20AEF3]/30">
                            ID #{u.employeeId}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-[#8C8D9B] mt-0.5">{u.email}</p>
                    </div>
                    {u.role === 'admin' ? (
                      <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-lg bg-purple-50 dark:bg-[#F2C8ED]/15 text-purple-700 dark:text-[#F2C8ED] border border-purple-200 dark:border-[#F2C8ED]/30">
                        Admin
                      </span>
                    ) : u.role === 'rh' ? (
                      <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-lg bg-sky-50 dark:bg-[#20AEF3]/15 text-sky-700 dark:text-[#20AEF3] border border-sky-200 dark:border-[#20AEF3]/30">
                        RH / Nóminas
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-lg bg-amber-50 dark:bg-[#FEB95A]/15 text-amber-800 dark:text-[#FEB95A] border border-amber-200 dark:border-[#FEB95A]/30">
                        Supervisor
                      </span>
                    )}
                  </div>

                  {/* Credenciales de Login */}
                  <div className="mt-2 p-3 rounded-xl bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-[#2C2D3C] flex items-center justify-between gap-2 text-[11px] font-mono">
                    <div>
                      <span className="text-slate-500 dark:text-[#8C8D9B] text-[9px] uppercase font-sans font-bold block">
                        Usuario Login:
                      </span>
                      <strong className="text-teal-700 dark:text-[#A9DFD8]">
                        {u.username || u.employeeId || u.email.split('@')[0]}
                      </strong>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-500 dark:text-[#8C8D9B] text-[9px] uppercase font-sans font-bold block">
                        Contraseña:
                      </span>
                      <strong className="text-slate-900 dark:text-white">
                        {u.password || u.employeeId || '12345'}
                      </strong>
                    </div>
                  </div>

                  {/* Módulos de Acceso Permitidos */}
                  <div className="mt-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-[#2C2D3C] text-[11px]">
                    <span className="text-slate-500 dark:text-[#8C8D9B] block text-[9px] uppercase font-bold tracking-wider mb-1.5">
                      Módulos con Acceso Permitido ({userMods.length}):
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {userMods.map((mod) => {
                        const meta = PORTAL_MODULE_LABELS[mod];
                        const isSpecial = mod === 'tiempo_limite' || mod === 'smtp_correo' || mod === 'usuarios';
                        return (
                          <span
                            key={mod}
                            className={`px-2 py-0.5 rounded-md border font-bold text-[9px] uppercase ${
                              isSpecial
                                ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30'
                                : 'bg-sky-50 dark:bg-[#20AEF3]/10 text-sky-700 dark:text-[#20AEF3] border-sky-200 dark:border-[#20AEF3]/25'
                            }`}
                          >
                            {meta?.short || mod}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Listas asignadas */}
                  {(u.role === 'supervisor' || userLists.length > 0) && (
                    <div className="mt-2.5 p-3 rounded-xl bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-[#2C2D3C] text-[11px]">
                      <span className="text-slate-500 dark:text-[#8C8D9B] block text-[9px] uppercase font-bold tracking-wider mb-1.5">
                        Lista(s) de Nómina Asignadas:
                      </span>
                      {userLists.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {userLists.map((listName) => (
                            <span
                              key={listName}
                              className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-[#FEB95A]/15 text-amber-800 dark:text-[#FEB95A] border border-amber-200 dark:border-[#FEB95A]/30 font-bold text-[10px]"
                            >
                              {listName}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-rose-500 dark:text-rose-400 text-[10px]">Sin lista asignada</span>
                      )}
                    </div>
                  )}

                  {/* Suplencia de vacaciones */}
                  {u.delegatedSupervisor && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-amber-50 dark:bg-[#FEB95A]/10 border border-amber-200 dark:border-[#FEB95A]/30 text-[11px] text-amber-800 dark:text-[#FEB95A]">
                      <span className="block text-[9px] uppercase font-bold tracking-wider flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" /> Suplencia Activa:
                      </span>
                      <span>
                        Supliendo a: <strong>{u.delegatedSupervisor}</strong>
                      </span>
                    </div>
                  )}

                  {u.notes && (
                    <p className="text-[11px] text-slate-500 dark:text-[#8C8D9B] mt-2.5 italic leading-tight">
                      &ldquo;{u.notes}&rdquo;
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 mt-3 border-t border-slate-200 dark:border-[#2C2D3C]">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(u)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#171821] dark:hover:bg-[#2A2B36] text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-[#2C2D3C] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-teal-600 dark:text-[#A9DFD8]" /> Configurar Accesos
                  </button>
                  {u.id !== 'user_admin' && (
                    <button
                      type="button"
                      onClick={() => onDeleteUser(u.id)}
                      className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/25 text-xs cursor-pointer transition-colors"
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
      )}

      {/* Modal Alta / Edición de Usuario, Módulos y Asignación de Listas */}
      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-slate-900/70 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-[#21222D] border border-slate-200 dark:border-[#2C2D3C] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 bg-slate-50 dark:bg-[#171821] border-b border-slate-200 dark:border-[#2C2D3C] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-[#A9DFD8]/15 border border-teal-200 dark:border-[#A9DFD8]/30 flex items-center justify-center text-teal-600 dark:text-[#A9DFD8]">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {editingId ? 'Configurar Usuario, Accesos a Módulos y Listas' : 'Crear Nuevo Usuario del Sistema'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-[#8C8D9B]">
                    Define sus credenciales y selecciona qué módulos (incluyendo Tiempo Límite y Correo SMTP) puede gestionar
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl bg-white dark:bg-[#21222D] text-slate-500 dark:text-[#8C8D9B] hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#2C2D3C] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs max-h-[82vh] overflow-y-auto">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 font-semibold">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-[#8C8D9B] block mb-1">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Marcela Lima / Óscar Valenzuela"
                    className="w-full rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#171821] border border-slate-300 dark:border-[#2C2D3C] text-slate-900 dark:text-white outline-none focus:border-teal-500 dark:focus:border-[#A9DFD8]"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-[#8C8D9B] block mb-1">
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
                    className="w-full rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#171821] border border-slate-300 dark:border-[#2C2D3C] text-slate-900 dark:text-white outline-none focus:border-teal-500 dark:focus:border-[#A9DFD8] font-mono"
                  />
                </div>
              </div>

              {/* Credenciales de Login */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-[#2C2D3C] space-y-3">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-[#A9DFD8]">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Credenciales para Iniciar Sesión (Login)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 dark:text-[#8C8D9B] block mb-1">
                      Usuario de Acceso *
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Ej: 00615 o marcela.lima"
                      className="w-full rounded-xl px-3 py-2 bg-white dark:bg-[#21222D] border border-slate-300 dark:border-[#2C2D3C] text-teal-700 dark:text-[#A9DFD8] font-mono font-bold outline-none focus:border-teal-500 dark:focus:border-[#A9DFD8]"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 dark:text-[#8C8D9B] block mb-1">
                      Contraseña de Acceso *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Contraseña..."
                        className="w-full rounded-xl pl-3 pr-9 py-2 bg-white dark:bg-[#21222D] border border-slate-300 dark:border-[#2C2D3C] text-slate-900 dark:text-white font-mono outline-none focus:border-teal-500 dark:focus:border-[#A9DFD8]"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 dark:text-[#8C8D9B] block mb-1">
                    Correo Electrónico Corporativo (Recibe alertas de dispersión)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@empresa.com"
                    className="w-full rounded-xl px-3 py-2 bg-white dark:bg-[#21222D] border border-slate-300 dark:border-[#2C2D3C] text-slate-900 dark:text-slate-200 font-mono outline-none focus:border-teal-500 dark:focus:border-[#A9DFD8]"
                  />
                </div>
              </div>

              {/* Rol en el sistema */}
              <div>
                <HeadlessSelect
                  label="ROL PRINCIPAL EN EL SISTEMA *"
                  value={role}
                  onChange={(val) => {
                    const newRole = val as UserRole;
                    setRole(newRole);
                    if (!editingId) {
                      setAllowedModules(getDefaultModulesForRole(newRole));
                    }
                  }}
                  options={roleOptions}
                  placeholder="Seleccionar rol..."
                />
              </div>

              {/* ASIGNACIÓN DE PERMISOS Y ACCESO A MÓDULOS (TODOS LOS 7 MÓDULOS DISPONIBLES PARA CUALQUIER USUARIO) */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#171821] border border-sky-300 dark:border-[#20AEF3]/40 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-[#20AEF3] flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Permisos y Acceso a Módulos del Sistema ({allowedModules.length}/7) *</span>
                    </label>
                    <p className="text-[11px] text-slate-600 dark:text-[#8C8D9B] mt-0.5">
                      Marca exactamente a qué módulos y configuraciones (incluyendo Tiempo Límite y Correo SMTP) tendrá acceso este usuario.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setAllowedModules(getDefaultModulesForRole(role))}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#21222D] border border-slate-300 dark:border-[#2C2D3C] text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:border-sky-400 cursor-pointer"
                    >
                      Por defecto del rol
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setAllowedModules([
                          'nomina',
                          'semaforo',
                          'incidencias',
                          'contpaqi',
                          'tiempo_limite',
                          'smtp_correo',
                          'usuarios',
                        ])
                      }
                      className="px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-[#20AEF3]/15 border border-sky-200 dark:border-[#20AEF3]/30 text-[10px] font-bold text-sky-700 dark:text-[#20AEF3] cursor-pointer"
                    >
                      Todos (7)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {allSelectableModules.map((modItem) => {
                    const isChecked = allowedModules.includes(modItem.id);
                    const meta = PORTAL_MODULE_LABELS[modItem.id];
                    return (
                      <label
                        key={modItem.id}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                          isChecked
                            ? modItem.activeClass
                            : 'bg-white dark:bg-[#21222D] border-slate-200 dark:border-[#2C2D3C] text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleModule(modItem.id)}
                          className={`mt-0.5 rounded ${modItem.accentClass}`}
                        />
                        <div>
                          <strong className="block text-xs font-bold text-slate-900 dark:text-white">
                            {meta.title}
                          </strong>
                          <span className="text-[10px] text-slate-500 dark:text-[#8C8D9B] block">
                            {meta.description}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Asignación de Listas de Nómina */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#171821] border border-amber-300 dark:border-[#FEB95A]/40 space-y-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-[#FEB95A] flex items-center gap-1.5">
                    <ListChecks className="w-4 h-4" />
                    <span>
                      ¿Qué Lista(s) de Nómina trabajará o supervisará este Usuario? {role === 'supervisor' ? '*' : '(Opcional)'}
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-600 dark:text-[#8C8D9B] mt-0.5">
                    Selecciona una o más listas del catálogo o agrega una nueva (para RH/Admin tiene acceso global, o puedes vincularle listas específicas).
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
                            ? 'bg-amber-50 dark:bg-[#FEB95A]/15 border-amber-400 dark:border-[#FEB95A]/50 text-amber-900 dark:text-[#FEB95A] font-bold'
                            : 'bg-white dark:bg-[#21222D] border-slate-200 dark:border-[#2C2D3C] text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-[#8C8D9B]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleAssignedList(listName)}
                          className="rounded accent-amber-500 dark:accent-[#FEB95A]"
                        />
                        <span className="truncate text-[11px]">{listName}</span>
                      </label>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-[#2C2D3C]">
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
                    className="flex-1 rounded-xl px-3 py-2 bg-white dark:bg-[#21222D] border border-slate-300 dark:border-[#2C2D3C] text-slate-900 dark:text-white font-mono text-xs uppercase outline-none focus:border-amber-500 dark:focus:border-[#FEB95A]"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomList}
                    className="px-3 py-2 rounded-xl bg-amber-500 dark:bg-[#FEB95A] hover:bg-amber-400 dark:hover:bg-[#f5a83d] text-slate-950 dark:text-[#171821] font-extrabold text-xs flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar</span>
                  </button>
                </div>
              </div>

              {/* Suplencia de Vacaciones */}
              {role === 'supervisor' && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-[#2C2D3C]">
                  <HeadlessSelect
                    label="Suplencia Temporal por Vacaciones (Opcional)"
                    icon={<RefreshCw className="w-3.5 h-3.5 text-amber-600 dark:text-[#FEB95A]" />}
                    value={delegatedSupervisor}
                    onChange={setDelegatedSupervisor}
                    options={delegationOptions}
                    placeholder="(Ninguna - no suple a otro supervisor)"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-[#8C8D9B] block mb-1">
                    Notas / Puesto
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ej: Gerencia RH / Supervisor Planta"
                    className="w-full rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#171821] border border-slate-300 dark:border-[#2C2D3C] text-slate-900 dark:text-white outline-none focus:border-teal-500 dark:focus:border-[#A9DFD8]"
                  />
                </div>

                <div className="pt-4">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-800 dark:text-slate-200 font-semibold">
                    <input
                      type="checkbox"
                      checked={activeStatus}
                      onChange={(e) => setActiveStatus(e.target.checked)}
                      className="w-4 h-4 rounded accent-teal-600 dark:accent-[#A9DFD8]"
                    />
                    <span>Cuenta de usuario activa (Permitir Login)</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-[#2C2D3C]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-[#8C8D9B] hover:text-slate-900 dark:hover:text-white cursor-pointer font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-teal-600 dark:bg-[#A9DFD8] hover:bg-teal-500 dark:hover:bg-[#95d0c8] text-white dark:text-[#171821] font-extrabold uppercase tracking-wider text-xs shadow-md transition-all cursor-pointer"
                >
                  Guardar Usuario y Accesos
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

