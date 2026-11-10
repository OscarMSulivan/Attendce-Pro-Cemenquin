/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ALL_PORTAL_MODULES,
  DEFAULT_EMAIL_TEMPLATES,
  EmailServerConfig,
  PORTAL_MODULE_LABELS,
  PayrollDispersal,
  PortalModule,
  PortalUser,
  UserRole,
  formatEmailTemplate,
  getUserAllowedLists,
  getUserAllowedModules,
  userHasModuleAccess,
} from '../../types/portal';
import { DEFAULT_OVERTIME_RULES, OvertimeRulesConfig } from '../../types/attendance';
import { OvertimeConfigContent } from '../OvertimeConfigModal';
import {
  Users,
  UserPlus,
  Shield,
  Mail,
  Briefcase,
  UserCheck,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  AlertCircle,
  Hash,
  Search,
  Server,
  HardDrive,
  Terminal,
  Copy,
  Check,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  LayoutGrid,
  Plus,
  Clock,
  Timer,
  Send,
  RefreshCw,
  ExternalLink,
  HelpCircle,
  BellRing,
  FileText,
  ChevronDown,
  ChevronUp,
  Sliders,
  Sparkles,
  Crown,
} from 'lucide-react';

interface AdminUsersViewProps {
  users: PortalUser[];
  supervisorsInCatalog: string[];
  onSaveUser: (user: PortalUser) => void;
  onDeleteUser: (userId: string) => void;
  horasLimiteLiberacion?: number;
  onSaveHorasLimiteLiberacion?: (horas: number, applyToCurrentDispersal: boolean) => void;
  activeDispersal?: PayrollDispersal;
  currentWeekNumber?: number;
  currentUser: PortalUser;
  emailConfig?: EmailServerConfig;
  onSaveEmailConfig?: (cfg: EmailServerConfig) => void;
  overtimeRules?: OvertimeRulesConfig;
  jornadaBase?: number;
  onSaveOvertimeRules?: (rules: OvertimeRulesConfig) => void;
}

type ConfigSectionId =
  | 'usuarios'
  | 'tiempo_extra'
  | 'tiempo_limite'
  | 'plantillas_correo'
  | 'smtp_correo'
  | 'vps_hostinger';

export const AdminUsersView: React.FC<AdminUsersViewProps> = ({
  users,
  supervisorsInCatalog,
  onSaveUser,
  onDeleteUser,
  horasLimiteLiberacion = 24,
  onSaveHorasLimiteLiberacion,
  activeDispersal,
  currentWeekNumber,
  currentUser,
  emailConfig,
  onSaveEmailConfig,
  overtimeRules,
  jornadaBase = 8,
  onSaveOvertimeRules,
}) => {
  const canManageUsers = userHasModuleAccess(currentUser, 'usuarios');
  const canManageOvertime = userHasModuleAccess(currentUser, 'tiempo_extra');
  const canManageDeadline = userHasModuleAccess(currentUser, 'tiempo_limite');
  const canManageEmailTemplates =
    userHasModuleAccess(currentUser, 'plantillas_correo') ||
    userHasModuleAccess(currentUser, 'smtp_correo');
  const canManageSmtp = userHasModuleAccess(currentUser, 'smtp_correo');

  // Control de tarjetas desplegables (Acordeón / Sub-menús)
  const [openSections, setOpenSections] = useState<Record<ConfigSectionId, boolean>>(() => ({
    usuarios: canManageUsers,
    tiempo_extra: !canManageUsers && canManageOvertime,
    tiempo_limite: !canManageUsers && !canManageOvertime && canManageDeadline,
    plantillas_correo:
      !canManageUsers && !canManageOvertime && !canManageDeadline && canManageEmailTemplates,
    smtp_correo:
      !canManageUsers &&
      !canManageOvertime &&
      !canManageDeadline &&
      !canManageEmailTemplates &&
      canManageSmtp,
    vps_hostinger: false,
  }));

  const toggleSection = (id: ConfigSectionId) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const focusSingleSection = (id: ConfigSectionId) => {
    setOpenSections({
      usuarios: id === 'usuarios',
      tiempo_extra: id === 'tiempo_extra',
      tiempo_limite: id === 'tiempo_limite',
      plantillas_correo: id === 'plantillas_correo',
      smtp_correo: id === 'smtp_correo',
      vps_hostinger: id === 'vps_hostinger',
    });
  };

  const setAllSectionsOpen = (open: boolean) => {
    setOpenSections({
      usuarios: open && canManageUsers,
      tiempo_extra: open && canManageOvertime,
      tiempo_limite: open && canManageDeadline,
      plantillas_correo: open && canManageEmailTemplates,
      smtp_correo: open && canManageSmtp,
      vps_hostinger: open && canManageUsers,
    });
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [serverStatus, setServerStatus] = useState<{
    connected: boolean;
    hostname?: string;
    uptime?: number;
    storagePath?: string;
  }>({ connected: false });
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [deadlineHoursInput, setDeadlineHoursInput] = useState<number>(horasLimiteLiberacion || 24);
  const [applyToActiveWeek, setApplyToActiveWeek] = useState<boolean>(true);
  const [savedDeadlineToast, setSavedDeadlineToast] = useState<boolean>(false);

  // Estado para configuración de credenciales SMTP en el Módulo Administrativo
  const [smtpHost, setSmtpHost] = useState<string>(emailConfig?.smtpHost || 'smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState<number>(emailConfig?.smtpPort || 587);
  const [smtpUser, setSmtpUser] = useState<string>(emailConfig?.smtpUser || '');
  const [smtpPass, setSmtpPass] = useState<string>(emailConfig?.smtpPass || '');
  const [smtpSecure, setSmtpSecure] = useState<boolean>(Boolean(emailConfig?.smtpSecure));
  const [smtpFromName, setSmtpFromName] = useState<string>(
    emailConfig?.smtpFromName || 'AttendancePRO Nóminas'
  );
  const [showSmtpPass, setShowSmtpPass] = useState<boolean>(false);
  const [showGmailGuide, setShowGmailGuide] = useState<boolean>(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState<boolean>(false);
  const [smtpFeedback, setSmtpFeedback] = useState<{
    type: 'success' | 'error' | null;
    message: string;
    requiresAppPassword?: boolean;
  }>({ type: null, message: '' });

  // Estado para Plantillas de Mensajes de Correo y Alerta Automática por Vencimiento
  const [asuntoDispersion, setAsuntoDispersion] = useState<string>(
    emailConfig?.asuntoDispersion || DEFAULT_EMAIL_TEMPLATES.asuntoDispersion
  );
  const [mensajeDispersion, setMensajeDispersion] = useState<string>(
    emailConfig?.mensajeDispersion || DEFAULT_EMAIL_TEMPLATES.mensajeDispersion
  );
  const [activarAlertaPorVencer, setActivarAlertaPorVencer] = useState<boolean>(
    emailConfig?.activarAlertaPorVencer ?? DEFAULT_EMAIL_TEMPLATES.activarAlertaPorVencer
  );
  const [horasAntesVencimiento, setHorasAntesVencimiento] = useState<number>(
    emailConfig?.horasAntesVencimiento ?? DEFAULT_EMAIL_TEMPLATES.horasAntesVencimiento
  );
  const [asuntoPorVencer, setAsuntoPorVencer] = useState<string>(
    emailConfig?.asuntoPorVencer || DEFAULT_EMAIL_TEMPLATES.asuntoPorVencer
  );
  const [mensajePorVencer, setMensajePorVencer] = useState<string>(
    emailConfig?.mensajePorVencer || DEFAULT_EMAIL_TEMPLATES.mensajePorVencer
  );
  const [templatesFeedback, setTemplatesFeedback] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });
  const [isTestingExpiringAlert, setIsTestingExpiringAlert] = useState<boolean>(false);

  useEffect(() => {
    setDeadlineHoursInput(horasLimiteLiberacion ?? 24);
  }, [horasLimiteLiberacion]);

  useEffect(() => {
    if (emailConfig) {
      setSmtpHost(emailConfig.smtpHost || 'smtp.gmail.com');
      setSmtpPort(emailConfig.smtpPort || 587);
      setSmtpUser(emailConfig.smtpUser || '');
      setSmtpPass(emailConfig.smtpPass || '');
      setSmtpSecure(Boolean(emailConfig.smtpSecure));
      setSmtpFromName(emailConfig.smtpFromName || 'AttendancePRO Nóminas');
      setAsuntoDispersion(
        emailConfig.asuntoDispersion || DEFAULT_EMAIL_TEMPLATES.asuntoDispersion
      );
      setMensajeDispersion(
        emailConfig.mensajeDispersion || DEFAULT_EMAIL_TEMPLATES.mensajeDispersion
      );
      setActivarAlertaPorVencer(
        emailConfig.activarAlertaPorVencer ?? DEFAULT_EMAIL_TEMPLATES.activarAlertaPorVencer
      );
      setHorasAntesVencimiento(
        emailConfig.horasAntesVencimiento ?? DEFAULT_EMAIL_TEMPLATES.horasAntesVencimiento
      );
      setAsuntoPorVencer(
        emailConfig.asuntoPorVencer || DEFAULT_EMAIL_TEMPLATES.asuntoPorVencer
      );
      setMensajePorVencer(
        emailConfig.mensajePorVencer || DEFAULT_EMAIL_TEMPLATES.mensajePorVencer
      );
    }
  }, [emailConfig]);

  const buildCombinedEmailConfig = (): EmailServerConfig => ({
    smtpHost: smtpHost.trim() || 'smtp.gmail.com',
    smtpPort: Number(smtpPort) || 587,
    smtpUser: smtpUser.trim(),
    smtpPass: smtpPass.trim(),
    smtpSecure,
    smtpFromName: smtpFromName.trim() || 'AttendancePRO Nóminas',
    asuntoDispersion: asuntoDispersion.trim() || DEFAULT_EMAIL_TEMPLATES.asuntoDispersion,
    mensajeDispersion: mensajeDispersion.trim() || DEFAULT_EMAIL_TEMPLATES.mensajeDispersion,
    activarAlertaPorVencer,
    horasAntesVencimiento: Math.max(1, Number(horasAntesVencimiento) || 2),
    asuntoPorVencer: asuntoPorVencer.trim() || DEFAULT_EMAIL_TEMPLATES.asuntoPorVencer,
    mensajePorVencer: mensajePorVencer.trim() || DEFAULT_EMAIL_TEMPLATES.mensajePorVencer,
  });

  const handleSaveSmtpCredentials = () => {
    if (!onSaveEmailConfig) return;
    const updatedCfg = buildCombinedEmailConfig();
    onSaveEmailConfig(updatedCfg);
    setSmtpFeedback({
      type: 'success',
      message:
        '✓ Credenciales SMTP guardadas de forma segura. El sistema enviará las alertas automáticas al dispersar nómina.',
    });
    setTimeout(() => {
      setSmtpFeedback(prev => (prev.type === 'success' ? { type: null, message: '' } : prev));
    }, 5000);
  };

  const handleSaveEmailTemplates = () => {
    if (!onSaveEmailConfig) return;
    const updatedCfg = buildCombinedEmailConfig();
    onSaveEmailConfig(updatedCfg);
    setTemplatesFeedback({
      type: 'success',
      message:
        '✓ Plantillas de correo y alerta automática por vencimiento guardadas correctamente.',
    });
    setTimeout(() => {
      setTemplatesFeedback(prev => (prev.type === 'success' ? { type: null, message: '' } : prev));
    }, 5000);
  };

  const handleRestoreDefaultTemplates = () => {
    setAsuntoDispersion(DEFAULT_EMAIL_TEMPLATES.asuntoDispersion);
    setMensajeDispersion(DEFAULT_EMAIL_TEMPLATES.mensajeDispersion);
    setActivarAlertaPorVencer(DEFAULT_EMAIL_TEMPLATES.activarAlertaPorVencer);
    setHorasAntesVencimiento(DEFAULT_EMAIL_TEMPLATES.horasAntesVencimiento);
    setAsuntoPorVencer(DEFAULT_EMAIL_TEMPLATES.asuntoPorVencer);
    setMensajePorVencer(DEFAULT_EMAIL_TEMPLATES.mensajePorVencer);
    setTemplatesFeedback({
      type: 'success',
      message: 'Plantillas restauradas a los textos recomendados. Haz clic en "Guardar Mensajes y Alertas" para aplicar.',
    });
  };

  const handleTestExpiringAlert = async () => {
    const updatedCfg = buildCombinedEmailConfig();
    if (onSaveEmailConfig) {
      onSaveEmailConfig(updatedCfg);
    }
    setIsTestingExpiringAlert(true);
    setTemplatesFeedback({ type: null, message: '' });
    try {
      const res = await fetch('/api/notifications/check-expiring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          forceTest: true,
          emailConfig: updatedCfg,
        }),
      });
      const data = await res.json();
      if (data.ok && data.smtpSent > 0) {
        setTemplatesFeedback({
          type: 'success',
          message: `✓ ${data.details?.[0] || 'Correo de prueba de alerta por vencimiento enviado con éxito.'}`,
        });
      } else {
        setTemplatesFeedback({
          type: 'error',
          message:
            data.details?.[0] ||
            data.error ||
            'Para enviar la prueba por correo, asegúrate de configurar primero el Servidor SMTP.',
        });
      }
    } catch (err: any) {
      setTemplatesFeedback({
        type: 'error',
        message: `Error al disparar prueba: ${err?.message || 'Verifica conexión con el servidor'}`,
      });
    } finally {
      setIsTestingExpiringAlert(false);
    }
  };

  const handleTestSmtpConnection = async () => {
    if (!smtpUser.trim() || !smtpPass.trim()) {
      setSmtpFeedback({
        type: 'error',
        message: 'Ingresa el Usuario / Correo y la Contraseña SMTP antes de probar la conexión.',
      });
      return;
    }

    const updatedCfg = buildCombinedEmailConfig();
    if (onSaveEmailConfig) {
      onSaveEmailConfig(updatedCfg);
    }

    setIsTestingSmtp(true);
    setSmtpFeedback({ type: null, message: '' });
    try {
      const res = await fetch('/api/notifications/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedCfg),
      });
      const data = await res.json();
      if (data.ok) {
        setSmtpFeedback({
          type: 'success',
          message: data.message || `Conexión verificada. Correo de prueba enviado a ${smtpUser}.`,
        });
      } else {
        if (data.requiresAppPassword) {
          setShowGmailGuide(true);
        }
        setSmtpFeedback({
          type: 'error',
          requiresAppPassword: Boolean(data.requiresAppPassword),
          message: data.error || 'Error al verificar credenciales con el servidor SMTP.',
        });
      }
    } catch (err: any) {
      setSmtpFeedback({
        type: 'error',
        message: `Error de red al probar SMTP: ${err?.message || 'Verifica que el servidor esté activo'}`,
      });
    } finally {
      setIsTestingSmtp(false);
    }
  };

  useEffect(() => {
    fetch('/api/health')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data && data.status === 'ok') {
          setServerStatus({
            connected: true,
            hostname: data.hostname,
            uptime: data.uptime,
            storagePath: data.storagePath,
          });
        }
      })
      .catch(() => {
        setServerStatus({ connected: false });
      });
  }, []);

  const handleCopyCommand = (cmd: string, label: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(label);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  // Estado del formulario de creación / edición de usuario
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [role, setRole] = useState<UserRole>('supervisor');
  const [allowedModules, setAllowedModules] = useState<PortalModule[]>(['nomina', 'incidencias']);
  const [assignedLists, setAssignedLists] = useState<string[]>([]);
  const [customListInput, setCustomListInput] = useState('');
  const [delegatedSupervisor, setDelegatedSupervisor] = useState('');
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState('');

  const getDefaultModulesForRole = (targetRole: UserRole): PortalModule[] => {
    if (targetRole === 'admin') {
      return [...ALL_PORTAL_MODULES];
    }
    if (targetRole === 'rh') {
      return [
        'nomina',
        'semaforo',
        'incidencias',
        'contpaqi',
        'tiempo_extra',
        'tiempo_limite',
        'plantillas_correo',
        'smtp_correo',
      ];
    }
    return ['nomina', 'incidencias'];
  };

  const openNewUserModal = (presetRole: UserRole = 'supervisor') => {
    setEditingId(null);
    setName('');
    setUsername('');
    setPassword('');
    setShowPassword(false);
    setEmail('');
    setEmployeeId('');
    setRole(presetRole);
    setAllowedModules(getDefaultModulesForRole(presetRole));
    const initialList =
      presetRole === 'supervisor' && supervisorsInCatalog[0] ? [supervisorsInCatalog[0]] : [];
    setAssignedLists(initialList);
    setCustomListInput('');
    setDelegatedSupervisor('');
    setActive(true);
    setNotes(
      presetRole === 'admin'
        ? 'Administrador General designado con acceso total a todos los módulos y configuraciones.'
        : ''
    );
    setIsModalOpen(true);
  };

  const openEditModal = (u: PortalUser) => {
    setEditingId(u.id);
    setName(u.name);
    setUsername(u.username || u.employeeId || u.email.split('@')[0]);
    setPassword(u.password || u.employeeId || '12345');
    setShowPassword(false);
    setEmail(u.email);
    setEmployeeId(u.employeeId || '');
    setRole(u.role);
    setAllowedModules(getUserAllowedModules(u));
    const currentLists = Array.from(
      new Set([
        ...(u.supervisorName ? [u.supervisorName.toUpperCase()] : []),
        ...(u.assignedLists || []).map(l => l.toUpperCase()),
      ])
    );
    setAssignedLists(currentLists);
    setCustomListInput('');
    setDelegatedSupervisor(u.delegatedSupervisor || '');
    setActive(u.active);
    setNotes(u.notes || '');
    setIsModalOpen(true);
  };

  const handleToggleModuleAccess = (mod: PortalModule) => {
    setAllowedModules(prev => {
      if (prev.includes(mod)) {
        if (prev.length === 1) return prev;
        return prev.filter(m => m !== mod);
      }
      return [...prev, mod];
    });
  };

  const handleToggleAssignedList = (listName: string) => {
    const normalized = listName.trim().toUpperCase();
    if (!normalized) return;
    setAssignedLists(prev =>
      prev.includes(normalized) ? prev.filter(l => l !== normalized) : [...prev, normalized]
    );
  };

  const handleAddCustomList = () => {
    const clean = customListInput.trim().toUpperCase();
    if (!clean) return;
    if (!assignedLists.includes(clean)) {
      setAssignedLists(prev => [...prev, clean]);
    }
    setCustomListInput('');
  };

  const handleSelectRoleInModal = (newRole: UserRole) => {
    setRole(newRole);
    if (newRole === 'admin') {
      // Garantizar que al elegir Administrador General se activen TODOS los accesos de inmediato
      setAllowedModules([...ALL_PORTAL_MODULES]);
    } else {
      setAllowedModules(getDefaultModulesForRole(newRole));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      alert('Completa el nombre y el correo electrónico.');
      return;
    }
    if (!username.trim() || !password.trim()) {
      alert('Define un usuario y una contraseña para iniciar sesión.');
      return;
    }

    const formattedEmployeeId = employeeId.trim()
      ? /^\d+$/.test(employeeId.trim())
        ? employeeId.trim().padStart(5, '0')
        : employeeId.trim()
      : undefined;

    const cleanLists =
      role === 'supervisor'
        ? assignedLists.map(l => l.trim().toUpperCase()).filter(Boolean)
        : [];

    const finalModules: PortalModule[] =
      role === 'admin'
        ? [...ALL_PORTAL_MODULES]
        : allowedModules.length > 0
        ? allowedModules
        : getDefaultModulesForRole(role);

    const newUser: PortalUser = {
      id: editingId || `user_${Date.now()}`,
      name: name.trim(),
      username: username.trim(),
      password: password.trim(),
      email: email.trim(),
      role,
      employeeId: formattedEmployeeId,
      allowedModules: finalModules,
      supervisorName: role === 'supervisor' && cleanLists.length > 0 ? cleanLists[0] : undefined,
      assignedLists: role === 'supervisor' ? cleanLists : undefined,
      delegatedSupervisor:
        role === 'supervisor' && delegatedSupervisor ? delegatedSupervisor : undefined,
      active,
      notes: notes.trim() || undefined,
    };

    onSaveUser(newUser);
    setIsModalOpen(false);
  };

  const allAvailableSupervisorLists = Array.from(
    new Set([
      ...supervisorsInCatalog.map(s => s.trim().toUpperCase()),
      ...users.flatMap(u => getUserAllowedLists(u)),
      ...assignedLists,
    ])
  )
    .filter(Boolean)
    .sort();

  const filteredUsers = users.filter(u => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const listsText = getUserAllowedLists(u).join(' ').toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.employeeId && u.employeeId.toLowerCase().includes(q)) ||
      listsText.includes(q)
    );
  });

  // Vista previa en vivo de los correos configurados
  const previewVars = {
    supervisor: supervisorsInCatalog[0] || 'OSCAR VALENZUELA',
    nombre: 'Óscar Valenzuela (Supervisor)',
    semana: String(currentWeekNumber || 43),
    periodo: '2026-10-22 al 2026-10-28',
    dispersado_por: currentUser.name || 'Recursos Humanos',
    fecha_limite: new Date(Date.now() + (deadlineHoursInput || 24) * 3600000).toLocaleString(
      'es-MX',
      {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }
    ),
    horas_limite: String(deadlineHoursInput || 24),
    tiempo_restante: `${horasAntesVencimiento || 2} hora(s)`,
  };

  const navItems: Array<{
    id: ConfigSectionId;
    label: string;
    shortDesc: string;
    badge?: string;
    visible: boolean;
    icon: React.ReactNode;
    accentColor: string;
  }> = [
    {
      id: 'usuarios',
      label: 'Usuarios, Roles y Accesos',
      shortDesc: `${users.length} cuentas · Rol Admin disponible`,
      badge: `${users.filter(u => u.role === 'admin').length} Admin`,
      visible: canManageUsers,
      icon: <Users className="w-4 h-4" />,
      accentColor: 'from-violet-600 to-indigo-600',
    },
    {
      id: 'plantillas_correo',
      label: 'Mensajes de Correo y Alerta por Vencer',
      shortDesc: activarAlertaPorVencer
        ? `Alerta automática ${horasAntesVencimiento}h antes`
        : 'Personalizar aviso de nómina',
      badge: activarAlertaPorVencer ? 'Auto-Alerta ON' : 'Manual',
      visible: canManageEmailTemplates,
      icon: <BellRing className="w-4 h-4" />,
      accentColor: 'from-rose-600 to-amber-600',
    },
    {
      id: 'tiempo_extra',
      label: 'Reglas de Tiempo Extra',
      shortDesc: `Desde ${overtimeRules?.minutosMinimosParaExtra ?? 30} min · Anticipada bloqueada`,
      badge: `${overtimeRules?.minutosMinimosParaExtra ?? 30}m mín`,
      visible: canManageOvertime && Boolean(onSaveOvertimeRules),
      icon: <Clock className="w-4 h-4" />,
      accentColor: 'from-indigo-600 to-blue-600',
    },
    {
      id: 'tiempo_limite',
      label: 'Tiempo Límite para Liberar',
      shortDesc:
        deadlineHoursInput > 0
          ? `Plazo de ${deadlineHoursInput} hrs tras dispersar`
          : 'Sin límite activo',
      badge: deadlineHoursInput > 0 ? `${deadlineHoursInput} hrs` : 'Sin límite',
      visible: canManageDeadline && Boolean(onSaveHorasLimiteLiberacion),
      icon: <Timer className="w-4 h-4" />,
      accentColor: 'from-amber-600 to-orange-600',
    },
    {
      id: 'smtp_correo',
      label: 'Servidor de Correo SMTP',
      shortDesc: smtpUser ? smtpUser : 'Configurar cuenta de envío',
      badge: smtpUser && smtpPass ? 'Configurado' : 'Pendiente',
      visible: canManageSmtp && Boolean(onSaveEmailConfig),
      icon: <Mail className="w-4 h-4" />,
      accentColor: 'from-sky-600 to-indigo-600',
    },
    {
      id: 'vps_hostinger',
      label: 'Servidor VPS Hostinger',
      shortDesc: serverStatus.connected ? 'Conectado y sincronizado' : 'Guía de comandos VPS',
      badge: serverStatus.connected ? 'Online' : 'Local',
      visible: canManageUsers,
      icon: <Server className="w-4 h-4" />,
      accentColor: 'from-emerald-600 to-teal-600',
    },
  ];

  const visibleNavItems = navItems.filter(item => item.visible);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Cabecera Principal del Centro de Configuración y Usuarios */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl border border-slate-800/80">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-violet-300 bg-violet-500/15 px-3 py-1 rounded-full border border-violet-400/20">
                Centro de Configuración Modular y Usuarios
              </span>
              <span className="text-[11px] font-bold text-emerald-300 bg-emerald-500/15 px-2.5 py-1 rounded-full border border-emerald-400/20">
                Tarjetas Desplegables Interactivas
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight mt-2 flex items-center gap-2.5">
              <Sliders className="w-6 h-6 text-violet-400" />
              Configuración General, Alertas de Nómina y Accesos
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
              Haz clic en cualquiera de los sub-menús o tarjetas desplegables para abrir únicamente el módulo que deseas configurar (Usuarios y Administradores, Mensajes de Correo y Alerta por Vencer, Tiempo Extra, Tiempo Límite o Servidor SMTP).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center">
            {canManageUsers && (
              <>
                <button
                  onClick={() => openNewUserModal('admin')}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 font-extrabold text-xs transition-all cursor-pointer"
                  title="Designar un nuevo usuario con todos los accesos de Administrador General"
                >
                  <Crown className="w-4 h-4 text-amber-300" />
                  + Designar Administrador
                </button>
                <button
                  onClick={() => openNewUserModal('supervisor')}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-extrabold text-xs shadow-lg shadow-violet-600/30 transition-all cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  + Crear Usuario
                </button>
              </>
            )}
          </div>
        </div>

        {/* Barra de Sub-Menús Rápidos para abrir o enfocar secciones */}
        <div className="mt-5 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-300">
              Sub-menús de Configuración (Clic para abrir tarjeta):
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAllSectionsOpen(true)}
                className="text-[11px] font-bold text-indigo-300 hover:text-white px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              >
                Expandir todas
              </button>
              <button
                type="button"
                onClick={() => setAllSectionsOpen(false)}
                className="text-[11px] font-bold text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              >
                Contraer todas
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
            {visibleNavItems.map(item => {
              const isOpen = openSections[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleSection(item.id)}
                  onDoubleClick={() => focusSingleSection(item.id)}
                  className={`text-left p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                    isOpen
                      ? 'bg-white text-slate-900 border-white shadow-lg scale-[1.01]'
                      : 'bg-slate-800/70 hover:bg-slate-800 text-slate-200 border-slate-700/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center text-white bg-gradient-to-br ${item.accentColor} shadow-xs shrink-0`}
                    >
                      {item.icon}
                    </div>
                    <div className="flex items-center gap-1">
                      {item.badge && (
                        <span
                          className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                            isOpen
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-slate-700 text-slate-200'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-indigo-600 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                    </div>
                  </div>
                  <div>
                    <p
                      className={`text-xs font-extrabold leading-tight ${
                        isOpen ? 'text-slate-900' : 'text-white'
                      }`}
                    >
                      {item.label}
                    </p>
                    <p
                      className={`text-[10px] mt-0.5 truncate ${
                        isOpen ? 'text-slate-600 font-semibold' : 'text-slate-400'
                      }`}
                    >
                      {item.shortDesc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* =====================================================================================
          TARJETA DESPLEGABLE 1: USUARIOS, ROLES (INCLUYENDO ROL ADMINISTRADOR) Y PERMISOS
         ===================================================================================== */}
      {canManageUsers && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden transition-all">
          <div
            onClick={() => toggleSection('usuarios')}
            className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/80 transition-colors select-none"
          >
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-violet-100 border border-violet-200 flex items-center justify-center text-violet-700 shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-violet-100 text-violet-800 border border-violet-200">
                    Módulo de Credenciales y Roles
                  </span>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                    {users.filter(u => u.role === 'admin').length} Administrador(es) con Acceso Total
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1">
                  1. Gestión de Usuarios, Administradores y Asignación de Listas ({users.length})
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Crea supervisores, personal de RH o designa usuarios con el <strong>Rol de Administrador General</strong> (con todos los accesos del usuario admin).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  openNewUserModal('admin');
                }}
                className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Crown className="w-3.5 h-3.5 text-amber-600" />
                + Nuevo Admin
              </button>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  openNewUserModal('supervisor');
                }}
                className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                + Nuevo Usuario
              </button>
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                {openSections.usuarios ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </div>
            </div>
          </div>

          {openSections.usuarios && (
            <div className="p-5 sm:p-6 pt-0 border-t border-slate-100 space-y-5">
              {/* Buscador rápido */}
              <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nombre, usuario, rol, ID o lista asignada..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 font-semibold">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold">
                    Total: {filteredUsers.length}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                    Admins: {users.filter(u => u.role === 'admin').length}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                    RH: {users.filter(u => u.role === 'rh').length}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200 font-bold">
                    Supervisores: {users.filter(u => u.role === 'supervisor').length}
                  </span>
                </div>
              </div>

              {/* Tarjetas de Usuarios */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredUsers.map(u => {
                  const userLists = getUserAllowedLists(u);
                  const isAdminRole = u.role === 'admin';
                  return (
                    <div
                      key={u.id}
                      className={`bg-white rounded-3xl border p-5 shadow-xs transition-all flex flex-col justify-between ${
                        u.active
                          ? isAdminRole
                            ? 'border-amber-300/90 hover:border-amber-400 ring-1 ring-amber-200/50'
                            : 'border-slate-200/80 hover:border-violet-300'
                          : 'border-slate-200/50 opacity-60 bg-slate-50'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm text-white shadow-sm ${
                                u.role === 'admin'
                                  ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                                  : u.role === 'rh'
                                  ? 'bg-emerald-600'
                                  : 'bg-indigo-600'
                              }`}
                            >
                              {u.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm font-extrabold text-slate-900">{u.name}</h3>
                                {u.employeeId && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-black font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                                    <Hash className="w-2.5 h-2.5 text-slate-400" />
                                    {u.employeeId}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                <Mail className="w-3 h-3 text-slate-400" />
                                {u.email}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-lg border flex items-center gap-1 ${
                              u.role === 'admin'
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : u.role === 'rh'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            }`}
                          >
                            {u.role === 'admin' && <Crown className="w-3 h-3 text-amber-600" />}
                            {u.role === 'admin'
                              ? 'Administrador Total'
                              : u.role === 'rh'
                              ? 'RH / Nóminas'
                              : 'Supervisor'}
                          </span>
                        </div>

                        {/* Credenciales de Acceso */}
                        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 bg-slate-50/80 px-3 py-2 rounded-xl border border-slate-200/60">
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <KeyRound className="w-3.5 h-3.5 text-violet-600 shrink-0" />
                            <span className="text-slate-500 font-semibold">Usuario:</span>
                            <code className="font-mono font-extrabold text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                              {u.username || u.employeeId || u.email.split('@')[0]}
                            </code>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="text-slate-500 font-semibold">Clave:</span>
                            <code className="font-mono font-bold text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                              {u.password || '•••••'}
                            </code>
                          </div>
                        </div>

                        {/* Módulos del Sistema Permitidos */}
                        <div className="mt-2.5 bg-slate-50/70 border border-slate-200/70 rounded-xl p-2.5">
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                              <LayoutGrid className="w-3 h-3 text-violet-600" />
                              Accesos a Módulos:
                            </p>
                            {isAdminRole && (
                              <span className="text-[9px] font-extrabold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                                Acceso Total Admin
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {getUserAllowedModules(u).map(mod => (
                              <span
                                key={mod}
                                className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-white text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs"
                              >
                                <Check className="w-2.5 h-2.5 text-emerald-600" />
                                {PORTAL_MODULE_LABELS[mod]?.short || mod}
                              </span>
                            ))}
                          </div>
                        </div>

                        {u.role === 'supervisor' && (
                          <div className="mt-3 space-y-2">
                            <div className="bg-indigo-50/60 rounded-xl p-2.5 border border-indigo-200/70">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 flex items-center gap-1 mb-1.5">
                                <Briefcase className="w-3 h-3 text-indigo-600" />
                                Listas de Nómina Asignadas ({userLists.length}):
                              </p>
                              {userLists.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {userLists.map(listName => (
                                    <span
                                      key={listName}
                                      className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-white text-indigo-900 border border-indigo-200 px-2 py-0.5 rounded-lg shadow-2xs"
                                    >
                                      <UserCheck className="w-3 h-3 text-indigo-600" />
                                      {listName}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11px] font-bold text-amber-700">
                                  Sin lista asignada — haz clic en Configurar para asignarle su lista
                                </p>
                              )}
                            </div>

                            {u.delegatedSupervisor && (
                              <div className="bg-amber-50/90 rounded-xl p-2.5 border border-amber-200/80">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1">
                                  <ArrowRightLeft className="w-3 h-3" /> Suplencia Temporal Activa:
                                </p>
                                <p className="text-xs font-extrabold text-amber-900 mt-0.5">
                                  Supliendo a: {u.delegatedSupervisor}
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {u.notes && (
                          <p className="text-[11px] text-slate-600 mt-3 italic bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                            "{u.notes}"
                          </p>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                            u.active ? 'text-emerald-600' : 'text-slate-400'
                          }`}
                        >
                          {u.active ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          {u.active ? 'Cuenta Activa' : 'Cuenta Inactiva'}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openEditModal(u)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-violet-50 text-slate-700 hover:text-violet-700 transition-colors text-xs font-bold flex items-center gap-1 cursor-pointer"
                            title="Editar usuario, rol y permisos"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Configurar
                          </button>
                          {u.id !== 'user_admin' && (
                            <button
                              onClick={() => {
                                if (confirm(`¿Eliminar al usuario ${u.name}?`)) {
                                  onDeleteUser(u.id);
                                }
                              }}
                              className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Eliminar usuario"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================================
          TARJETA DESPLEGABLE 2: MENSAJES DE CORREO Y ALERTA AUTOMÁTICA POR VENCIMIENTO
         ===================================================================================== */}
      {canManageEmailTemplates && onSaveEmailConfig && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden transition-all">
          <div
            onClick={() => toggleSection('plantillas_correo')}
            className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/80 transition-colors select-none"
          >
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-700 shrink-0">
                <BellRing className="w-6 h-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200">
                    Módulo de Mensajes y Alertas de Nómina
                  </span>
                  <span
                    className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${
                      activarAlertaPorVencer
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {activarAlertaPorVencer
                      ? `✓ Doble Alerta Activa (Al dispersar + ${horasAntesVencimiento}h antes de vencer)`
                      : 'Solo Alerta al Dispersar'}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1">
                  2. Configurar Mensaje de Nómina Pendiente y Alerta Automática por Vencer
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Personaliza el correo que recibe el supervisor cuando se dispersa su nómina y el segundo correo automático cuando está a punto de finalizar su tiempo de revisión.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <span className="text-xs font-bold text-rose-700 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200">
                {openSections.plantillas_correo ? 'Ocultar configuración' : 'Abrir configuración'}
              </span>
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                {openSections.plantillas_correo ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </div>
            </div>
          </div>

          {openSections.plantillas_correo && (
            <div className="p-5 sm:p-6 pt-4 border-t border-slate-100 space-y-6">
              {/* Etiquetas dinámicas disponibles */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      Variables Dinámicas Disponibles (Se reemplazan automáticamente por cada supervisor):
                    </p>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Puedes escribir estas etiquetas en el asunto o en el cuerpo del mensaje para personalizar cada correo enviado.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRestoreDefaultTemplates}
                    className="text-[11px] font-bold text-slate-600 hover:text-indigo-700 bg-white hover:bg-indigo-50 px-3 py-1.5 rounded-xl border border-slate-200 transition-colors cursor-pointer shrink-0"
                  >
                    Restaurar textos por defecto
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {[
                    { tag: '{nombre}', desc: 'Nombre del Supervisor' },
                    { tag: '{supervisor}', desc: 'Nombre de la Lista' },
                    { tag: '{semana}', desc: 'Número de Semana' },
                    { tag: '{periodo}', desc: 'Fechas del Periodo' },
                    { tag: '{fecha_limite}', desc: 'Fecha/Hora Límite' },
                    { tag: '{horas_limite}', desc: 'Horas de Plazo' },
                    { tag: '{tiempo_restante}', desc: 'Tiempo Restante' },
                    { tag: '{dispersado_por}', desc: 'Quién Dispersó' },
                  ].map(v => (
                    <span
                      key={v.tag}
                      onClick={() => {
                        navigator.clipboard.writeText(v.tag);
                      }}
                      title="Clic para copiar variable"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:border-indigo-400 cursor-pointer transition-colors"
                    >
                      <code className="font-mono font-extrabold text-indigo-700">{v.tag}</code>
                      <span className="text-slate-500">({v.desc})</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* COLUMNA 1: ALERTA 1 (AL DISPERSAR LA NÓMINA) */}
                <div className="bg-indigo-50/40 border border-indigo-200/80 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center">
                        1
                      </span>
                      <div>
                        <h4 className="text-sm font-black text-slate-900">
                          Alerta #1: Al Dispersar la Nómina (Nómina Pendiente)
                        </h4>
                        <p className="text-[11px] text-slate-600">
                          Se envía inmediatamente cuando RH / Nóminas dispersa la lista al supervisor.
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 border border-indigo-200">
                      Envío Inmediato
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Asunto del Correo al Dispersar *
                    </label>
                    <input
                      type="text"
                      value={asuntoDispersion}
                      onChange={e => setAsuntoDispersion(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200/90 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Cuerpo del Mensaje (Notificación de Nómina Pendiente) *
                    </label>
                    <textarea
                      rows={5}
                      value={mensajeDispersion}
                      onChange={e => setMensajeDispersion(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200/90 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none leading-relaxed"
                    />
                  </div>

                  {/* Vista Previa en Vivo Alerta 1 */}
                  <div className="bg-white border border-indigo-200/80 rounded-xl p-3.5 space-y-1.5">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Vista Previa Alerta #1:
                    </p>
                    <p className="text-xs font-extrabold text-slate-900">
                      {formatEmailTemplate(asuntoDispersion, previewVars)}
                    </p>
                    <p className="text-[11px] text-slate-600 whitespace-pre-line leading-relaxed border-t border-slate-100 pt-1.5">
                      {formatEmailTemplate(mensajeDispersion, previewVars)}
                    </p>
                  </div>
                </div>

                {/* COLUMNA 2: ALERTA 2 (AUTOMÁTICA CUANDO ESTÁ POR VENCER EL TIEMPO) */}
                <div className="bg-rose-50/40 border border-rose-200/80 rounded-2xl p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-xl bg-rose-600 text-white font-black text-xs flex items-center justify-center">
                        2
                      </span>
                      <div>
                        <h4 className="text-sm font-black text-slate-900">
                          Alerta #2: Recordatorio Automático Antes de Vencer
                        </h4>
                        <p className="text-[11px] text-slate-600">
                          Se envía en automático si el supervisor aún no libera su nómina y su tiempo está por expirar.
                        </p>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-rose-200 shadow-2xs shrink-0">
                      <input
                        type="checkbox"
                        checked={activarAlertaPorVencer}
                        onChange={e => setActivarAlertaPorVencer(e.target.checked)}
                        className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                      />
                      <span className="text-xs font-extrabold text-slate-800">
                        {activarAlertaPorVencer ? 'Alerta Activa' : 'Desactivada'}
                      </span>
                    </label>
                  </div>

                  {/* Selector de cuántas horas antes del vencimiento se manda el correo */}
                  <div className="bg-white border border-rose-200/80 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-extrabold text-slate-800">
                        ¿Cuánto tiempo antes de vencer se debe enviar la alerta?
                      </p>
                      <p className="text-[11px] text-slate-500">
                        El servidor revisa cada minuto las listas no liberadas y dispara el correo al entrar en este umbral.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {[1, 2, 3, 4, 6].map(hrs => (
                        <button
                          key={hrs}
                          type="button"
                          onClick={() => setHorasAntesVencimiento(hrs)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold border transition-all cursor-pointer ${
                            horasAntesVencimiento === hrs
                              ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-rose-50'
                          }`}
                        >
                          {hrs}h antes
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Asunto del Correo cuando está por Vencer *
                    </label>
                    <input
                      type="text"
                      value={asuntoPorVencer}
                      onChange={e => setAsuntoPorVencer(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200/90 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Cuerpo del Mensaje de Vencimiento Próximo *
                    </label>
                    <textarea
                      rows={5}
                      value={mensajePorVencer}
                      onChange={e => setMensajePorVencer(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200/90 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none leading-relaxed"
                    />
                  </div>

                  {/* Vista Previa en Vivo Alerta 2 */}
                  <div className="bg-white border border-rose-200/80 rounded-xl p-3.5 space-y-1.5">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 flex items-center gap-1">
                      <BellRing className="w-3 h-3" /> Vista Previa Alerta #2 (Faltando {horasAntesVencimiento}h):
                    </p>
                    <p className="text-xs font-extrabold text-slate-900">
                      {formatEmailTemplate(asuntoPorVencer, previewVars)}
                    </p>
                    <p className="text-[11px] text-slate-600 whitespace-pre-line leading-relaxed border-t border-slate-100 pt-1.5">
                      {formatEmailTemplate(mensajePorVencer, previewVars)}
                    </p>
                  </div>
                </div>
              </div>

              {templatesFeedback.type && (
                <div
                  className={`p-3.5 rounded-2xl border flex items-center gap-2.5 text-xs font-bold ${
                    templatesFeedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {templatesFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{templatesFeedback.message}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleTestExpiringAlert}
                  disabled={isTestingExpiringAlert}
                  className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {isTestingExpiringAlert ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Enviar Correo de Prueba (Alerta por Vencer)
                </button>
                <button
                  type="button"
                  onClick={handleSaveEmailTemplates}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Guardar Mensajes y Alertas Automáticas
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================================
          TARJETA DESPLEGABLE 3: REGLAS Y CÁLCULO DE TIEMPO EXTRA
         ===================================================================================== */}
      {canManageOvertime && onSaveOvertimeRules && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden transition-all">
          <div
            onClick={() => toggleSection('tiempo_extra')}
            className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/80 transition-colors select-none"
          >
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200">
                    Módulo de Cálculo de Nómina
                  </span>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Mínimo {overtimeRules?.minutosMinimosParaExtra ?? 30} min · Entrada anticipada bloqueada
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1">
                  3. Configuración de Reglas de Tiempo Extra y Entradas Anticipadas
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Define a partir de cuántos minutos posteriores a la salida cuenta como tiempo extra y descarta los minutos cuando el personal llega antes de su hora de entrada.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200">
                {openSections.tiempo_extra ? 'Ocultar reglas' : 'Abrir reglas'}
              </span>
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                {openSections.tiempo_extra ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </div>
            </div>
          </div>

          {openSections.tiempo_extra && (
            <div className="p-4 sm:p-6 pt-2 border-t border-slate-100">
              <OvertimeConfigContent
                rules={overtimeRules || DEFAULT_OVERTIME_RULES}
                jornadaBase={jornadaBase}
                onSaveRules={onSaveOvertimeRules}
              />
            </div>
          )}
        </div>
      )}

      {/* =====================================================================================
          TARJETA DESPLEGABLE 4: TIEMPO LÍMITE PARA LIBERAR NÓMINA (CUENTA REGRESIVA)
         ===================================================================================== */}
      {canManageDeadline && onSaveHorasLimiteLiberacion && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden transition-all">
          <div
            onClick={() => toggleSection('tiempo_limite')}
            className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/80 transition-colors select-none"
          >
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                <Timer className="w-6 h-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                    Control de Plazo de Supervisores
                  </span>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                    {deadlineHoursInput > 0
                      ? `Plazo actual: ${deadlineHoursInput} horas`
                      : 'Sin límite de tiempo'}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1">
                  4. Límite de Tiempo (por Horas) para Liberación de Nómina
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Configura el plazo máximo permitido para que los supervisores trabajen y liberen su lista después de ser dispersada, mostrando el reloj en cuenta regresiva en su portal.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <span className="text-xs font-bold text-amber-800 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                {openSections.tiempo_limite ? 'Ocultar plazo' : 'Configurar plazo'}
              </span>
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                {openSections.tiempo_limite ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </div>
            </div>
          </div>

          {openSections.tiempo_limite && (
            <div className="p-5 sm:p-6 pt-4 border-t border-slate-100 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                <div className="space-y-2 max-w-xl">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Selecciona un plazo rápido o escribe la cantidad exacta de horas que tendrán los supervisores para revisar y liberar su nómina desde el momento en que RH realiza la dispersión.
                  </p>
                  {activeDispersal && !activeDispersal.cancelada && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-bold">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      <span>
                        Semana {currentWeekNumber || activeDispersal.semanaNumero} activa ·{' '}
                        {activeDispersal.limiteLiberacion
                          ? `Vence: ${new Date(activeDispersal.limiteLiberacion).toLocaleString(
                              'es-MX',
                              {
                                weekday: 'short',
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              }
                            )}`
                          : 'Sin hora límite asignada'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                      Accesos Rápidos (Horas)
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[4, 8, 12, 24, 48, 72, 0].map(preset => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setDeadlineHoursInput(preset)}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer border ${
                            deadlineHoursInput === preset
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                          }`}
                        >
                          {preset === 0 ? 'Sin límite' : `${preset}h`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="h-auto sm:h-10 w-full sm:w-px bg-slate-200" />

                  <div className="flex items-center gap-2.5">
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
                        Horas Exactas
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          max={336}
                          value={deadlineHoursInput}
                          onChange={e =>
                            setDeadlineHoursInput(Math.max(0, Number(e.target.value) || 0))
                          }
                          className="w-20 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 text-center focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                        />
                        <span className="text-xs font-bold text-slate-600">hrs</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onSaveHorasLimiteLiberacion(deadlineHoursInput, applyToActiveWeek);
                        setSavedDeadlineToast(true);
                        setTimeout(() => setSavedDeadlineToast(false), 3000);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer shrink-0 flex items-center gap-1.5 mt-4 sm:mt-0"
                    >
                      {savedDeadlineToast ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          ¡Guardado!
                        </>
                      ) : (
                        <>
                          <Clock className="w-3.5 h-3.5" />
                          Guardar Límite
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {activeDispersal && !activeDispersal.cancelada && (
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyToActiveWeek}
                      onChange={e => setApplyToActiveWeek(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-bold text-slate-700">
                      Actualizar y reiniciar la cuenta regresiva en la dispersión activa de la Semana{' '}
                      {currentWeekNumber || activeDispersal.semanaNumero} al guardar
                    </span>
                  </label>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {deadlineHoursInput > 0
                      ? `Los supervisores verán una cuenta regresiva de ${deadlineHoursInput} hora(s) en su portal.`
                      : 'Modo sin límite activo: no se bloqueará por tiempo.'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================================
          TARJETA DESPLEGABLE 5: SERVIDOR DE CORREO SMTP (CREDENCIALES)
         ===================================================================================== */}
      {canManageSmtp && onSaveEmailConfig && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden transition-all">
          <div
            onClick={() => toggleSection('smtp_correo')}
            className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/80 transition-colors select-none"
          >
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-700 shrink-0">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-sky-100 text-sky-800 border border-sky-200">
                    Credenciales de Correo Corporativo
                  </span>
                  <span
                    className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${
                      smtpUser && smtpPass
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : 'bg-amber-100 text-amber-800 border-amber-200'
                    }`}
                  >
                    {smtpUser && smtpPass ? `Conectado: ${smtpUser}` : 'Pendiente de Configurar'}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1">
                  5. Configuración de Credenciales SMTP para Envío de Correos
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Configura el servidor, puerto, correo remitente y contraseña de aplicación para que el servidor envíe los correos automáticos a cada supervisor.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <span className="text-xs font-bold text-sky-800 bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-200">
                {openSections.smtp_correo ? 'Ocultar SMTP' : 'Configurar SMTP'}
              </span>
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                {openSections.smtp_correo ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </div>
            </div>
          </div>

          {openSections.smtp_correo && (
            <div className="p-5 sm:p-6 pt-4 border-t border-slate-100 space-y-4">
              {/* Presets rápidos de proveedor */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                <span className="text-[11px] font-extrabold text-slate-600">
                  Proveedores rápidos:
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSmtpHost('smtp.gmail.com');
                      setSmtpPort(587);
                      setSmtpSecure(false);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                      smtpHost === 'smtp.gmail.com'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    Gmail / Google Workspace
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSmtpHost('smtp.office365.com');
                      setSmtpPort(587);
                      setSmtpSecure(false);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                      smtpHost === 'smtp.office365.com'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    Office 365 / Outlook
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSmtpHost('smtp.hostinger.com');
                      setSmtpPort(465);
                      setSmtpSecure(true);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                      smtpHost === 'smtp.hostinger.com'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    Hostinger Mail
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Servidor SMTP (Host) *
                  </label>
                  <input
                    type="text"
                    value={smtpHost}
                    onChange={e => setSmtpHost(e.target.value)}
                    placeholder="Ej: smtp.gmail.com"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200/90 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Puerto SMTP y Seguridad *
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={smtpPort}
                      onChange={e => {
                        const val = Number(e.target.value) || 587;
                        setSmtpPort(val);
                        if (val === 465) setSmtpSecure(true);
                        if (val === 587) setSmtpSecure(false);
                      }}
                      placeholder="587"
                      className="w-24 px-3 py-2 bg-slate-50 border border-slate-200/90 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    />
                    <label className="flex items-center gap-1.5 cursor-pointer bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/90 flex-1">
                      <input
                        type="checkbox"
                        checked={smtpSecure}
                        onChange={e => setSmtpSecure(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-[11px] font-bold text-slate-700">SSL/TLS (465)</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Usuario / Correo Remitente *
                  </label>
                  <input
                    type="email"
                    value={smtpUser}
                    onChange={e => setSmtpUser(e.target.value)}
                    placeholder="nominas@empresa.com"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200/90 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Contraseña / App Password *
                    </label>
                    {(smtpHost.includes('gmail') || smtpUser.includes('@gmail')) && (
                      <button
                        type="button"
                        onClick={() => setShowGmailGuide(prev => !prev)}
                        className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                      >
                        <HelpCircle className="w-3 h-3" />
                        ¿Cómo obtener clave Gmail?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showSmtpPass ? 'text' : 'password'}
                      value={smtpPass}
                      onChange={e => setSmtpPass(e.target.value)}
                      placeholder="xxxx xxxx xxxx xxxx (16 letras)"
                      className="w-full pl-3.5 pr-9 py-2 bg-slate-50 border border-slate-200/90 rounded-xl text-xs font-mono font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmtpPass(!showSmtpPass)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title={showSmtpPass ? 'Ocultar contraseña' : 'Ver contraseña'}
                    >
                      {showSmtpPass ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Guía rápida interactiva para Contraseña de Aplicación de Google (Error 534-5.7.9) */}
              {(showGmailGuide || smtpFeedback.requiresAppPassword) && (
                <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-4 text-xs text-amber-950 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 font-black text-amber-900">
                      <KeyRound className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        Importante para Gmail / Google Workspace (Código 534-5.7.9 Application-specific password required):
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowGmailGuide(false)}
                      className="text-[11px] font-bold text-amber-700 hover:text-amber-900 cursor-pointer"
                    >
                      Cerrar guía ✕
                    </button>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Google bloquea por seguridad el uso de tu contraseña normal de Gmail en sistemas externos. Para que el envío funcione sin errores, genera una <strong>Contraseña de Aplicación de 16 letras</strong> siguiendo estos 3 pasos:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] font-semibold text-amber-900">
                    <li>
                      Entra a tu cuenta de Google en{' '}
                      <a
                        href="https://myaccount.google.com/security"
                        target="_blank"
                        rel="noreferrer"
                        className="underline font-extrabold text-indigo-700 inline-flex items-center gap-0.5"
                      >
                        myaccount.google.com/security <ExternalLink className="w-2.5 h-2.5" />
                      </a>{' '}
                      y asegúrate de tener activada la <strong>Verificación en 2 pasos</strong>.
                    </li>
                    <li>
                      Abre directamente{' '}
                      <a
                        href="https://myaccount.google.com/apppasswords"
                        target="_blank"
                        rel="noreferrer"
                        className="underline font-extrabold text-indigo-700 inline-flex items-center gap-0.5"
                      >
                        myaccount.google.com/apppasswords <ExternalLink className="w-2.5 h-2.5" />
                      </a>{' '}
                      (Contraseñas de aplicaciones), escribe <strong>"AttendancePRO Nóminas"</strong> y haz clic en <strong>Crear</strong>.
                    </li>
                    <li>
                      Copia el código de <strong>16 letras</strong> que te muestra Google y pégalo arriba en el campo <strong>Contraseña / App Password</strong> (el sistema quita los espacios automáticamente).
                    </li>
                  </ol>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-1 max-w-md">
                  <span className="text-[11px] font-bold text-slate-600 shrink-0">
                    Nombre visible del remitente:
                  </span>
                  <input
                    type="text"
                    value={smtpFromName}
                    onChange={e => setSmtpFromName(e.target.value)}
                    placeholder="AttendancePRO Nóminas"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-500 outline-none"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestSmtpConnection}
                    disabled={isTestingSmtp}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isTestingSmtp ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                    ) : (
                      <Send className="w-3.5 h-3.5 text-indigo-600" />
                    )}
                    {isTestingSmtp ? 'Probando conexión...' : 'Probar Conexión y Enviar Test'}
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveSmtpCredentials}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Guardar Credenciales SMTP
                  </button>
                </div>
              </div>

              {smtpFeedback.type && (
                <div
                  className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                    smtpFeedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {smtpFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <span className="font-semibold">{smtpFeedback.message}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================================
          TARJETA DESPLEGABLE 6: SERVIDOR VPS HOSTINGER (COMANDOS Y ESTADO)
         ===================================================================================== */}
      {canManageUsers && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden transition-all">
          <div
            onClick={() => toggleSection('vps_hostinger')}
            className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/80 transition-colors select-none"
          >
            <div className="flex items-start sm:items-center gap-3.5">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                  serverStatus.connected
                    ? 'bg-emerald-100 border-emerald-200 text-emerald-700'
                    : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}
              >
                <Server className="w-6 h-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Infraestructura y Persistencia Centralizada
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {serverStatus.hostname ? `Host: ${serverStatus.hostname}` : 'VPS Ubuntu / PM2'}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1">
                  6. Estado del Servidor VPS Hostinger KVM 2 y Comandos de Despliegue
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Consulta la sincronización en disco (`data/portal_db.json`) y copia los comandos para desplegar en tu servidor Ubuntu 24.04 LTS.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                {openSections.vps_hostinger ? 'Ocultar comandos' : 'Ver guía VPS'}
              </span>
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                {openSections.vps_hostinger ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </div>
            </div>
          </div>

          {openSections.vps_hostinger && (
            <div className="p-5 sm:p-6 pt-4 border-t border-slate-100 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-slate-900 rounded-2xl p-3.5 text-slate-200 border border-slate-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400 flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5" /> 1. Preparar Ubuntu 24.04
                    </span>
                    <button
                      onClick={() =>
                        handleCopyCommand(
                          'curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs git nginx && sudo npm install -g pm2 tsx',
                          'step1'
                        )
                      }
                      className="text-[10px] font-bold text-slate-300 hover:text-white flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded-md cursor-pointer"
                    >
                      {copiedCmd === 'step1' ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      {copiedCmd === 'step1' ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <code className="text-[11px] font-mono text-emerald-300 block break-all leading-relaxed">
                    sudo apt update && sudo apt install -y nodejs npm git nginx && sudo npm i -g pm2 tsx
                  </code>
                </div>

                <div className="bg-slate-900 rounded-2xl p-3.5 text-slate-200 border border-slate-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400 flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5" /> 2. Compilar e Iniciar con PM2
                    </span>
                    <button
                      onClick={() =>
                        handleCopyCommand(
                          'npm install && npm run build && NODE_ENV=production PORT=3000 pm2 start "npx tsx server.ts" --name attendance-pro && pm2 save',
                          'step2'
                        )
                      }
                      className="text-[10px] font-bold text-slate-300 hover:text-white flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded-md cursor-pointer"
                    >
                      {copiedCmd === 'step2' ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      {copiedCmd === 'step2' ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <code className="text-[11px] font-mono text-emerald-300 block break-all leading-relaxed">
                    npm install && npm run build && NODE_ENV=production pm2 start "npx tsx server.ts" --name attendance-pro
                  </code>
                </div>

                <div className="bg-slate-900 rounded-2xl p-3.5 text-slate-200 border border-slate-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" /> 3. Proxy Inverso Nginx (Puerto 80)
                    </span>
                    <button
                      onClick={() =>
                        handleCopyCommand(
                          'location / { proxy_pass http://127.0.0.1:3000; proxy_http_version 1.1; proxy_set_header Host $host; client_max_body_size 50M; }',
                          'step3'
                        )
                      }
                      className="text-[10px] font-bold text-slate-300 hover:text-white flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded-md cursor-pointer"
                    >
                      {copiedCmd === 'step3' ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      {copiedCmd === 'step3' ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <code className="text-[11px] font-mono text-emerald-300 block break-all leading-relaxed">
                    proxy_pass http://127.0.0.1:3000; client_max_body_size 50M;
                  </code>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================================
          MODAL PARA CREAR / EDITAR USUARIO (CON OPCIÓN DE ROL ADMINISTRADOR TOTAL)
         ===================================================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 max-w-2xl w-full overflow-hidden animate-scale-in max-h-[92vh] flex flex-col">
            <div className="bg-gradient-to-r from-violet-900 via-indigo-900 to-slate-900 p-6 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-violet-500/20 border border-violet-400/30 flex items-center justify-center text-violet-300">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-violet-300">
                    Control de Acceso, Roles y Listas
                  </span>
                  <h3 className="text-lg font-extrabold">
                    {editingId ? 'Configurar Usuario y Accesos' : 'Registrar Nuevo Usuario'}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white px-2.5 py-1 rounded-lg text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* SELECTOR VISUAL DE ROL (INCLUYENDO ROL DE ADMINISTRADOR CON TODOS LOS ACCESOS) */}
              <div className="space-y-2">
                <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                  1. Selecciona el Rol del Usuario en el Sistema *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleSelectRoleInModal('supervisor')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      role === 'supervisor'
                        ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20 text-indigo-950'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black">Supervisor de Área</span>
                      {role === 'supervisor' && (
                        <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Revisa checadas, sube formatos, autoriza extras y libera sus listas asignadas.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectRoleInModal('rh')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      role === 'rh'
                        ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-950'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black">RH / Nóminas</span>
                      {role === 'rh' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Procesa checadas globales, dispersa nóminas, autoriza incidencias y exporta CONTPAQi.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectRoleInModal('admin')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      role === 'admin'
                        ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 text-amber-950'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black flex items-center gap-1">
                        <Crown className="w-3.5 h-3.5 text-amber-600" />
                        Administrador General
                      </span>
                      {role === 'admin' && (
                        <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                      )}
                    </div>
                    <p className="text-[10px] text-amber-800 font-semibold mt-1">
                      Otorga exactamente TODOS los accesos, módulos y permisos que tiene el usuario admin.
                    </p>
                  </button>
                </div>

                {role === 'admin' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2.5 text-xs text-amber-900 font-bold">
                    <Crown className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Rol Administrador General activo: Esta persona tendrá acceso completo a todas las listas de nómina, semáforo, incidencias, CONTPAQi, configuración de tiempo extra, límites, correo y gestión de usuarios.
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ej: Ing. Carlos Ruiz"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    ID Empleado (Opcional)
                  </label>
                  <input
                    type="text"
                    value={employeeId}
                    onChange={e => {
                      const val = e.target.value;
                      setEmployeeId(val);
                      if (!editingId && val.trim() && !username) {
                        const padded = /^\d+$/.test(val.trim())
                          ? val.trim().padStart(5, '0')
                          : val.trim();
                        setUsername(padded);
                        if (!password) setPassword(padded);
                      }
                    }}
                    placeholder="Ej: 00615"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/90 rounded-xl text-xs font-mono font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none"
                  />
                </div>
              </div>

              {/* Credenciales de Login */}
              <div className="bg-violet-50/60 border border-violet-200/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-extrabold text-violet-950 uppercase tracking-wider flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-violet-600" />
                    Credenciales de Inicio de Sesión
                  </label>
                  <span className="text-[10px] font-bold text-violet-700 bg-white px-2 py-0.5 rounded-md border border-violet-200">
                    Requerido para entrar al sistema
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Usuario de Acceso *
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="Ej: carlos.ruiz o 00615"
                      className="w-full px-3 py-2 bg-white border border-violet-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Contraseña *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Contraseña de acceso"
                        className="w-full pl-3 pr-9 py-2 bg-white border border-violet-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPassword ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Correo Electrónico Empresarial (Para Recibir Alertas) *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="carlos.ruiz@empresa.com"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none"
                    required
                  />
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2.5 cursor-pointer bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200/90 w-full">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={e => setActive(e.target.checked)}
                      className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500"
                    />
                    <span className="text-xs font-bold text-slate-700">
                      Cuenta activa (Permitir inicio de sesión)
                    </span>
                  </label>
                </div>
              </div>

              {/* Configuración de Accesos a Módulos del Sistema */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <LayoutGrid className="w-3.5 h-3.5 text-violet-600" />
                    Módulos del Sistema a los que Tiene Acceso
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAllowedModules([...ALL_PORTAL_MODULES])}
                      className="text-[10px] font-extrabold text-violet-700 hover:text-violet-900 bg-violet-100 px-2.5 py-1 rounded-lg cursor-pointer"
                    >
                      Marcar Todos los Módulos
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(Object.keys(PORTAL_MODULE_LABELS) as PortalModule[]).map(mod => {
                    const checked = role === 'admin' || allowedModules.includes(mod);
                    const info = PORTAL_MODULE_LABELS[mod];
                    return (
                      <label
                        key={mod}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                          checked
                            ? 'bg-violet-50/80 border-violet-300 text-violet-950 shadow-2xs'
                            : 'bg-white border-slate-200/80 text-slate-600 hover:bg-slate-100/70'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={role === 'admin'}
                          onChange={() => handleToggleModuleAccess(mod)}
                          className="w-4 h-4 mt-0.5 rounded text-violet-600 focus:ring-violet-500"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold leading-tight">{info.title}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                            {info.description}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Asignación de Listas de Nómina para Supervisores */}
              {role === 'supervisor' && (
                <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-extrabold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                      Asignar Listas de Nómina que Trabajará este Supervisor ({assignedLists.length})
                    </label>
                    {assignedLists.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setAssignedLists([])}
                        className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                      >
                        Limpiar selección
                      </button>
                    )}
                  </div>

                  {allAvailableSupervisorLists.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                      {allAvailableSupervisorLists.map(sup => {
                        const isSelected = assignedLists.includes(sup);
                        return (
                          <label
                            key={sup}
                            className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all text-xs font-bold ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                : 'bg-white text-slate-700 border-indigo-200/80 hover:bg-indigo-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleAssignedList(sup)}
                              className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="truncate">{sup}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-100/70 p-2.5 rounded-xl">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>
                        Aún no se ha cargado el catálogo de empleados, pero puedes escribir el nombre de la lista manualmente abajo.
                      </span>
                    </div>
                  )}

                  {/* Agregar lista manual */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={customListInput}
                      onChange={e => setCustomListInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomList();
                        }
                      }}
                      placeholder="Agregar otra lista manualmente (ej: OSCAR VALENZUELA)..."
                      className="flex-1 px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomList}
                      className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Añadir Lista
                    </button>
                  </div>

                  {/* Suplencia Temporal */}
                  <div className="pt-2 border-t border-indigo-200/60">
                    <label className="block text-[11px] font-extrabold text-amber-900 uppercase tracking-wider mb-1">
                      Suplencia Temporal por Vacaciones (Opcional)
                    </label>
                    <select
                      value={delegatedSupervisor}
                      onChange={e => setDelegatedSupervisor(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                    >
                      <option value="">-- Sin suplencia activa --</option>
                      {allAvailableSupervisorLists
                        .filter(s => !assignedLists.includes(s))
                        .map(sup => (
                          <option key={sup} value={sup}>
                            Suplir temporalmente a: {sup}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Notas / Observaciones
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Ej: Administrador designado / Suplencia autorizada..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200/90 rounded-xl text-xs font-medium text-slate-700 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-200/80 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-extrabold shadow-md shadow-violet-600/20 transition-all cursor-pointer"
                >
                  {editingId ? 'Guardar Cambios de Usuario' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
