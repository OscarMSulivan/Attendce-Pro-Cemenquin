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
  ShieldCheck,
  Mail,
  Briefcase,
  UserCheck,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  AlertCircle,
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
  Sliders,
  Crown,
  ChevronRight,
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

type UserFilterTab =
  | 'all'
  | 'admin'
  | 'rh'
  | 'supervisor'
  | 'with_dispersion'
  | 'with_work_lists';

type ModalSectionTab = 'cuenta' | 'nomina_listas' | 'modulos';

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

  const getInitialSection = (): ConfigSectionId => {
    if (canManageUsers) return 'usuarios';
    if (canManageOvertime) return 'tiempo_extra';
    if (canManageDeadline) return 'tiempo_limite';
    if (canManageEmailTemplates) return 'plantillas_correo';
    if (canManageSmtp) return 'smtp_correo';
    return 'usuarios';
  };

  const [activeSection, setActiveSection] = useState<ConfigSectionId>(getInitialSection);
  const [userFilter, setUserFilter] = useState<UserFilterTab>('all');
  const [modalTab, setModalTab] = useState<ModalSectionTab>('cuenta');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [listSearchTerm, setListSearchTerm] = useState('');
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

  // Estado para configuración de credenciales SMTP
  const [smtpHost, setSmtpHost] = useState<string>(emailConfig?.smtpHost || 'smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState<number>(emailConfig?.smtpPort || 587);
  const [smtpUser, setSmtpUser] = useState<string>(emailConfig?.smtpUser || '');
  const [smtpPass, setSmtpPass] = useState<string>(emailConfig?.smtpPass || '');
  const [smtpSecure, setSmtpSecure] = useState<boolean>(Boolean(emailConfig?.smtpSecure));
  const [smtpFromName, setSmtpFromName] = useState<string>(
    emailConfig?.smtpFromName || 'CemenQtime Nóminas'
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
  const [portalUrl, setPortalUrl] = useState<string>(
    emailConfig?.portalUrl ||
      (typeof window !== 'undefined' && window.location.protocol !== 'file:'
        ? window.location.origin
        : '')
  );
  const [textoBotonCorreo, setTextoBotonCorreo] = useState<string>(
    emailConfig?.textoBotonCorreo || DEFAULT_EMAIL_TEMPLATES.textoBotonCorreo
  );
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
      setSmtpFromName(emailConfig.smtpFromName || 'CemenQtime Nóminas');
      if (emailConfig.portalUrl) {
        setPortalUrl(emailConfig.portalUrl);
      }
      setTextoBotonCorreo(
        emailConfig.textoBotonCorreo || DEFAULT_EMAIL_TEMPLATES.textoBotonCorreo
      );
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
    smtpFromName: smtpFromName.trim() || 'CemenQtime Nóminas',
    portalUrl:
      portalUrl.trim() ||
      (typeof window !== 'undefined' && window.location.protocol !== 'file:'
        ? window.location.origin
        : ''),
    textoBotonCorreo: textoBotonCorreo.trim() || DEFAULT_EMAIL_TEMPLATES.textoBotonCorreo,
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
        'Credenciales SMTP guardadas. El sistema enviará las alertas automáticas al dispersar nómina.',
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
      message: 'Plantillas de correo y alerta automática por vencimiento guardadas.',
    });
    setTimeout(() => {
      setTemplatesFeedback(prev => (prev.type === 'success' ? { type: null, message: '' } : prev));
    }, 5000);
  };

  const handleRestoreDefaultTemplates = () => {
    setTextoBotonCorreo(DEFAULT_EMAIL_TEMPLATES.textoBotonCorreo);
    setAsuntoDispersion(DEFAULT_EMAIL_TEMPLATES.asuntoDispersion);
    setMensajeDispersion(DEFAULT_EMAIL_TEMPLATES.mensajeDispersion);
    setActivarAlertaPorVencer(DEFAULT_EMAIL_TEMPLATES.activarAlertaPorVencer);
    setHorasAntesVencimiento(DEFAULT_EMAIL_TEMPLATES.horasAntesVencimiento);
    setAsuntoPorVencer(DEFAULT_EMAIL_TEMPLATES.asuntoPorVencer);
    setMensajePorVencer(DEFAULT_EMAIL_TEMPLATES.mensajePorVencer);
    setTemplatesFeedback({
      type: 'success',
      message: 'Plantillas restauradas a los valores por defecto. Guarda los cambios para aplicar.',
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
          message:
            data.details?.[0] || 'Correo de prueba de alerta por vencimiento enviado con éxito.',
        });
      } else {
        setTemplatesFeedback({
          type: 'error',
          message:
            data.details?.[0] ||
            data.error ||
            'Para enviar la prueba por correo, configura primero el Servidor SMTP.',
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
  const [allowedModules, setAllowedModules] = useState<PortalModule[]>([
    'trabajar_listas',
    'incidencias',
  ]);
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
    return ['trabajar_listas', 'incidencias'];
  };

  const openNewUserModal = (
    presetRole: UserRole = 'supervisor',
    initialTab: ModalSectionTab = 'cuenta'
  ) => {
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
    setListSearchTerm('');
    setDelegatedSupervisor('');
    setActive(true);
    setNotes(
      presetRole === 'admin'
        ? 'Administrador General con acceso completo a todos los módulos.'
        : ''
    );
    setModalTab(initialTab);
    setIsModalOpen(true);
  };

  const openEditModal = (u: PortalUser, initialTab: ModalSectionTab = 'cuenta') => {
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
    setListSearchTerm('');
    setDelegatedSupervisor(u.delegatedSupervisor || '');
    setActive(u.active);
    setNotes(u.notes || '');
    setModalTab(initialTab);
    setIsModalOpen(true);
  };

  // Toggle rápido en línea desde la tabla de usuarios para Dispersión de Nómina o Trabajar Listas
  const handleQuickToggleUserModule = (u: PortalUser, mod: PortalModule) => {
    if (u.role === 'admin') return;
    const currentMods = getUserAllowedModules(u);
    const exists = currentMods.includes(mod);
    let nextMods: PortalModule[];
    if (exists) {
      if (currentMods.length <= 1) return;
      nextMods = currentMods.filter(m => m !== mod);
    } else {
      nextMods = [...currentMods, mod];
    }
    const updatedUser: PortalUser = {
      ...u,
      allowedModules: nextMods,
    };
    onSaveUser(updatedUser);
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

    const finalModules: PortalModule[] =
      role === 'admin'
        ? [...ALL_PORTAL_MODULES]
        : allowedModules.length > 0
        ? allowedModules
        : getDefaultModulesForRole(role);

    const hasWorkListsAccess =
      role === 'supervisor' || finalModules.includes('trabajar_listas');

    const cleanLists = hasWorkListsAccess
      ? assignedLists.map(l => l.trim().toUpperCase()).filter(Boolean)
      : [];

    const newUser: PortalUser = {
      id: editingId || `user_${Date.now()}`,
      name: name.trim(),
      username: username.trim(),
      password: password.trim(),
      email: email.trim(),
      role,
      employeeId: formattedEmployeeId,
      allowedModules: finalModules,
      supervisorName: cleanLists.length > 0 ? cleanLists[0] : undefined,
      assignedLists: hasWorkListsAccess ? cleanLists : undefined,
      delegatedSupervisor:
        hasWorkListsAccess && delegatedSupervisor ? delegatedSupervisor : undefined,
      active,
      notes: notes.trim() || undefined,
    };

    onSaveUser(newUser);
    setIsModalOpen(false);
  };

  const allAvailableSupervisorLists = Array.from(
    new Set([
      ...supervisorsInCatalog.map(s => s.trim().toUpperCase()),
      ...assignedLists.map(s => s.trim().toUpperCase()),
    ])
  )
    .filter(Boolean)
    .sort();

  const filteredModalSupervisorLists = allAvailableSupervisorLists.filter(sup => {
    if (!listSearchTerm.trim()) return true;
    return sup.toLowerCase().includes(listSearchTerm.toLowerCase());
  });

  const filteredUsers = users.filter(u => {
    const userMods = getUserAllowedModules(u);
    if (userFilter === 'admin' && u.role !== 'admin') return false;
    if (userFilter === 'rh' && u.role !== 'rh') return false;
    if (userFilter === 'supervisor' && u.role !== 'supervisor') return false;
    if (userFilter === 'with_dispersion' && !userMods.includes('nomina')) return false;
    if (userFilter === 'with_work_lists' && !userMods.includes('trabajar_listas')) return false;

    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const lists = getUserAllowedLists(u).join(' ').toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.employeeId || '').toLowerCase().includes(q) ||
      lists.includes(q)
    );
  });

  const previewActionUrl = `${(
    portalUrl.trim() ||
    (typeof window !== 'undefined' && window.location.protocol !== 'file:'
      ? window.location.origin
      : 'https://nomina.empresa.com')
  ).replace(/\/+$/, '')}/?action=liberar_nomina&semana=${encodeURIComponent(
    String(currentWeekNumber || 15)
  )}&supervisor=${encodeURIComponent('OSCAR VALENZUELA')}`;

  const samplePreviewVars = {
    supervisor: 'OSCAR VALENZUELA',
    nombre: 'Óscar Valenzuela',
    semana: String(currentWeekNumber || 15),
    periodo: activeDispersal?.semanaPeriodo || '2026-04-06 al 2026-04-12',
    horas_limite: `${deadlineHoursInput} horas`,
    horas_restantes: `${horasAntesVencimiento}h 00m`,
    tiempo_restante: `${horasAntesVencimiento}h 00m`,
    fecha_limite: new Date(Date.now() + deadlineHoursInput * 3600000).toLocaleString('es-MX', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }),
    dispersado_por: currentUser.name,
    url_portal: previewActionUrl,
  };

  const adminsCount = users.filter(u => u.role === 'admin').length;
  const dispersionUsersCount = users.filter(u => getUserAllowedModules(u).includes('nomina')).length;
  const workListUsersCount = users.filter(u =>
    getUserAllowedModules(u).includes('trabajar_listas')
  ).length;

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Encabezado Superior Estilo Panel de Configuraciones — Free Dark Admin Dashboard */}
      <div className="bg-gradient-to-r from-[#21222D] via-[#1B1C26] to-[#21222D] border border-white/[0.08] rounded-2xl px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-xl relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-[#A9DFD8]/10 blur-3xl pointer-events-none" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/15 shadow-lg bg-[#0B193D] shrink-0">
            <img
              src="/assets/aistudio/623410255_1517285780403715_965041871524205859_n_cf013194.jpg"
              alt="Cemenquin"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#87888C]">
              <span className="text-[#A9DFD8] font-bold">CemenQtime</span>
              <span aria-hidden="true">/</span>
              <span className="text-white font-bold">Panel de Configuraciones</span>
            </div>
            <h2 className="text-xl font-extrabold text-white tracking-tight mt-0.5">
              Configuración General, Usuarios y Accesos
            </h2>
          </div>
        </div>

        {canManageUsers && (
          <div className="flex items-center gap-2.5 shrink-0 relative z-10">
            <button
              type="button"
              onClick={() => {
                setActiveSection('usuarios');
                openNewUserModal('admin', 'cuenta');
              }}
              className="px-3.5 py-2.5 rounded-xl border border-[#FEB95A]/35 bg-[#FEB95A]/10 hover:bg-[#FEB95A]/20 text-[#FEB95A] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Crown className="w-3.5 h-3.5 text-[#FEB95A]" />
              Designar Administrador
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveSection('usuarios');
                openNewUserModal('supervisor', 'cuenta');
              }}
              className="px-4 py-2.5 rounded-xl bg-[#A9DFD8] hover:bg-[#95d5cd] text-[#171821] text-xs font-extrabold flex items-center gap-1.5 shadow-[0_8px_20px_rgba(169,223,216,0.18)] transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Nuevo Usuario
            </button>
          </div>
        )}
      </div>

      {/* Layout Principal de Dos Columnas: Menú Lateral de Configuración + Panel Activo */}
      <div className="flex flex-col lg:flex-row items-start gap-5">
        {/* Columna Izquierda: Menú Lateral de Categorías de Configuración */}
        <aside className="w-full lg:w-72 shrink-0 bg-[#21222D] border border-white/[0.07] rounded-2xl p-3.5 space-y-4 shadow-xl">
          {/* Grupo 1: Accesos y Equipo */}
          {canManageUsers && (
            <div>
              <p className="px-3 pb-1.5 text-[10px] font-bold text-[#87888C] uppercase tracking-wider">
                Accesos y Equipo
              </p>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setActiveSection('usuarios')}
                  className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-bold transition-all cursor-pointer ${
                    activeSection === 'usuarios'
                      ? 'bg-[#A9DFD8] text-[#171821] shadow-md'
                      : 'text-slate-300 hover:bg-[#171821] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Users
                      className={`w-4 h-4 shrink-0 ${
                        activeSection === 'usuarios' ? 'text-[#171821]' : 'text-[#A9DFD8]'
                      }`}
                    />
                    <span className="truncate">Usuarios y Permisos</span>
                  </div>
                  <span
                    className={`text-[11px] font-mono font-extrabold tabular-nums ${
                      activeSection === 'usuarios' ? 'text-[#171821]' : 'text-[#87888C]'
                    }`}
                  >
                    {users.length}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Grupo 2: Reglas de Nómina */}
          {(canManageOvertime || canManageDeadline) && (
            <div>
              <p className="px-3 pb-1.5 text-[10px] font-bold text-[#87888C] uppercase tracking-wider">
                Reglas de Nómina
              </p>
              <div className="space-y-1">
                {canManageOvertime && onSaveOvertimeRules && (
                  <button
                    type="button"
                    onClick={() => setActiveSection('tiempo_extra')}
                    className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-bold transition-all cursor-pointer ${
                      activeSection === 'tiempo_extra'
                        ? 'bg-[#A9DFD8] text-[#171821] shadow-md'
                        : 'text-slate-300 hover:bg-[#171821] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Clock
                        className={`w-4 h-4 shrink-0 ${
                          activeSection === 'tiempo_extra' ? 'text-[#171821]' : 'text-[#FEB95A]'
                        }`}
                      />
                      <span className="truncate">Reglas de Tiempo Extra</span>
                    </div>
                    <span
                      className={`text-[11px] font-mono font-extrabold tabular-nums ${
                        activeSection === 'tiempo_extra' ? 'text-[#171821]' : 'text-[#FEB95A]'
                      }`}
                    >
                      +{overtimeRules?.minutosMinimosParaExtra ?? 60}m
                    </span>
                  </button>
                )}

                {canManageDeadline && (
                  <button
                    type="button"
                    onClick={() => setActiveSection('tiempo_limite')}
                    className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-bold transition-all cursor-pointer ${
                      activeSection === 'tiempo_limite'
                        ? 'bg-[#A9DFD8] text-[#171821] shadow-md'
                        : 'text-slate-300 hover:bg-[#171821] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Timer
                        className={`w-4 h-4 shrink-0 ${
                          activeSection === 'tiempo_limite' ? 'text-[#171821]' : 'text-[#20AEF3]'
                        }`}
                      />
                      <span className="truncate">Tiempo Límite Liberación</span>
                    </div>
                    <span
                      className={`text-[11px] font-mono font-extrabold tabular-nums ${
                        activeSection === 'tiempo_limite' ? 'text-[#171821]' : 'text-[#20AEF3]'
                      }`}
                    >
                      {horasLimiteLiberacion}h
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Grupo 3: Notificaciones y Correo */}
          {(canManageEmailTemplates || canManageSmtp) && (
            <div>
              <p className="px-3 pb-1.5 text-[10px] font-bold text-[#87888C] uppercase tracking-wider">
                Notificaciones y Correo
              </p>
              <div className="space-y-1">
                {canManageEmailTemplates && (
                  <button
                    type="button"
                    onClick={() => setActiveSection('plantillas_correo')}
                    className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-bold transition-all cursor-pointer ${
                      activeSection === 'plantillas_correo'
                        ? 'bg-[#A9DFD8] text-[#171821] shadow-md'
                        : 'text-slate-300 hover:bg-[#171821] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <BellRing
                        className={`w-4 h-4 shrink-0 ${
                          activeSection === 'plantillas_correo' ? 'text-[#171821]' : 'text-[#F2C8ED]'
                        }`}
                      />
                      <span className="truncate">Mensajes y Alertas Correo</span>
                    </div>
                    <ChevronRight
                      className={`w-3.5 h-3.5 shrink-0 ${
                        activeSection === 'plantillas_correo' ? 'text-[#171821]' : 'text-[#87888C]'
                      }`}
                    />
                  </button>
                )}

                {canManageSmtp && (
                  <button
                    type="button"
                    onClick={() => setActiveSection('smtp_correo')}
                    className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-bold transition-all cursor-pointer ${
                      activeSection === 'smtp_correo'
                        ? 'bg-[#A9DFD8] text-[#171821] shadow-md'
                        : 'text-slate-300 hover:bg-[#171821] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Mail
                        className={`w-4 h-4 shrink-0 ${
                          activeSection === 'smtp_correo' ? 'text-[#171821]' : 'text-[#20AEF3]'
                        }`}
                      />
                      <span className="truncate">Servidor SMTP</span>
                    </div>
                    <span
                      className={`text-[10px] font-bold ${
                        emailConfig?.smtpUser
                          ? activeSection === 'smtp_correo'
                            ? 'text-[#171821]'
                            : 'text-[#A9DFD8]'
                          : activeSection === 'smtp_correo'
                          ? 'text-[#171821]'
                          : 'text-[#FEB95A]'
                      }`}
                    >
                      {emailConfig?.smtpUser ? 'Activo' : 'Pendiente'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Grupo 4: Infraestructura */}
          {canManageUsers && (
            <div>
              <p className="px-3 pb-1.5 text-[10px] font-bold text-[#87888C] uppercase tracking-wider">
                Infraestructura
              </p>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setActiveSection('vps_hostinger')}
                  className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-bold transition-all cursor-pointer ${
                    activeSection === 'vps_hostinger'
                      ? 'bg-[#A9DFD8] text-[#171821] shadow-md'
                      : 'text-slate-300 hover:bg-[#171821] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Server
                      className={`w-4 h-4 shrink-0 ${
                        activeSection === 'vps_hostinger' ? 'text-[#171821]' : 'text-[#A9DFD8]'
                      }`}
                    />
                    <span className="truncate">Servidor y Base de Datos</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold ${
                      serverStatus.connected
                        ? activeSection === 'vps_hostinger'
                          ? 'text-[#171821]'
                          : 'text-[#A9DFD8]'
                        : 'text-[#87888C]'
                    }`}
                  >
                    {serverStatus.connected ? 'Online' : 'Local'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Resumen rápido al pie del menú lateral */}
          <div className="pt-3 border-t border-white/[0.06] px-3 space-y-2 text-xs text-[#87888C]">
            <div className="flex items-center justify-between">
              <span>Con Dispersión Nómina</span>
              <span className="font-mono font-bold text-[#A9DFD8] tabular-nums">
                {dispersionUsersCount}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Con Trabajar Listas</span>
              <span className="font-mono font-bold text-[#20AEF3] tabular-nums">
                {workListUsersCount}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Administradores</span>
              <span className="font-mono font-bold text-[#FEB95A] tabular-nums">
                {adminsCount}
              </span>
            </div>
          </div>
        </aside>

        {/* Columna Derecha: Área de Trabajo de la Configuración Seleccionada */}
        <div className="flex-1 min-w-0 w-full">
          {/* ===================================================================== */}
          {/* SECCIÓN 1: DIRECTORIO DE USUARIOS, ACCESOS Y LISTAS ASIGNADAS         */}
          {/* ===================================================================== */}
          {activeSection === 'usuarios' && canManageUsers && (
            <div className="bg-[#21222D] border border-white/[0.07] rounded-2xl overflow-hidden shadow-xl">
              {/* Cabecera del Panel de Usuarios */}
              <div className="px-6 py-5 border-b border-white/[0.06] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    Directorio de Usuarios y Asignación de Accesos
                  </h3>
                  <p className="text-xs text-[#87888C] mt-0.5">
                    Activa o desactiva directamente el acceso a Dispersión de Nómina y a Trabajar Listas, o asigna qué lista(s) trabaja cada persona.
                  </p>
                </div>

                <div className="relative w-full sm:w-72 shrink-0">
                  <Search className="w-3.5 h-3.5 text-[#87888C] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Buscar nombre, usuario, lista..."
                    className="w-full pl-9 pr-3.5 py-2.5 bg-[#171821] border border-white/[0.08] rounded-xl text-xs font-medium text-white placeholder-[#87888C] focus:border-[#A9DFD8] outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Barra de Filtros Segmentados */}
              <div className="px-6 py-3 bg-[#171821]/70 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { id: 'all', label: `Todos (${users.length})` },
                    {
                      id: 'with_dispersion',
                      label: `Acceso Dispersión (${dispersionUsersCount})`,
                    },
                    {
                      id: 'with_work_lists',
                      label: `Acceso Trabajar Listas (${workListUsersCount})`,
                    },
                    { id: 'admin', label: `Administradores (${adminsCount})` },
                    {
                      id: 'rh',
                      label: `RH / Nóminas (${users.filter(u => u.role === 'rh').length})`,
                    },
                    {
                      id: 'supervisor',
                      label: `Supervisores (${users.filter(u => u.role === 'supervisor').length})`,
                    },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setUserFilter(tab.id as UserFilterTab)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                        userFilter === tab.id
                          ? 'bg-[#A9DFD8] text-[#171821] shadow-sm'
                          : 'text-[#87888C] hover:text-white hover:bg-[#21222D]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tabla / Lista Estructurada de Usuarios */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/[0.06] bg-[#171821]/90 text-[11px] font-bold text-[#87888C] uppercase tracking-wider">
                      <th className="py-3.5 px-6">Usuario y Credenciales</th>
                      <th className="py-3.5 px-4">Acceso a Módulos de Nómina</th>
                      <th className="py-3.5 px-4">Lista(s) Asignada(s) para Trabajar</th>
                      <th className="py-3.5 px-4">Otros Permisos</th>
                      <th className="py-3.5 px-6 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05] text-xs">
                    {filteredUsers.map(u => {
                      const userLists = getUserAllowedLists(u);
                      const userMods = getUserAllowedModules(u);
                      const isAdminRole = u.role === 'admin';
                      const hasDispersion = userMods.includes('nomina');
                      const hasTrabajarListas = userMods.includes('trabajar_listas');
                      const otherMods = userMods.filter(
                        m => m !== 'nomina' && m !== 'trabajar_listas'
                      );

                      return (
                        <tr
                          key={u.id}
                          className={`transition-colors hover:bg-white/[0.02] ${
                            !u.active ? 'opacity-60' : ''
                          }`}
                        >
                          {/* Columna 1: Identidad y Login */}
                          <td className="py-4 px-6 align-top">
                            <div className="flex items-start gap-3">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 border ${
                                  isAdminRole
                                    ? 'bg-[#FEB95A]/15 text-[#FEB95A] border-[#FEB95A]/30'
                                    : u.role === 'rh'
                                    ? 'bg-[#A9DFD8]/15 text-[#A9DFD8] border-[#A9DFD8]/30'
                                    : 'bg-[#20AEF3]/15 text-[#20AEF3] border-[#20AEF3]/30'
                                }`}
                              >
                                {u.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-white truncate">
                                    {u.name}
                                  </span>
                                  {!u.active && (
                                    <span className="text-[11px] font-semibold text-rose-400">
                                      · Inactivo
                                    </span>
                                  )}
                                </div>
                                <div className="text-[#87888C] text-[11px] truncate mt-0.5">
                                  {u.email}
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-[#87888C] mt-1 font-mono tabular-nums">
                                  <span
                                    className={`font-bold ${
                                      isAdminRole
                                        ? 'text-[#FEB95A]'
                                        : u.role === 'rh'
                                        ? 'text-[#A9DFD8]'
                                        : 'text-[#20AEF3]'
                                    }`}
                                  >
                                    {isAdminRole
                                      ? 'Administrador General'
                                      : u.role === 'rh'
                                      ? 'RH / Nóminas'
                                      : 'Supervisor'}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span>
                                    Usuario:{' '}
                                    <strong className="text-slate-200">
                                      {u.username || u.employeeId || u.email.split('@')[0]}
                                    </strong>
                                  </span>
                                  {u.employeeId && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span>ID #{u.employeeId}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Columna 2: Switches de Acceso a Dispersión de Nómina y Trabajar Listas */}
                          <td className="py-4 px-4 align-top">
                            <div className="space-y-2.5 min-w-[210px]">
                              {/* Switch 1: Dispersión de Nómina */}
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-1.5">
                                  <Send
                                    className={`w-3.5 h-3.5 shrink-0 ${
                                      hasDispersion ? 'text-[#A9DFD8]' : 'text-[#87888C]'
                                    }`}
                                  />
                                  <span
                                    className={`text-xs font-bold ${
                                      hasDispersion ? 'text-white' : 'text-[#87888C]'
                                    }`}
                                  >
                                    Dispersión de Nómina
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  disabled={isAdminRole}
                                  onClick={() => handleQuickToggleUserModule(u, 'nomina')}
                                  title={
                                    isAdminRole
                                      ? 'El Administrador General tiene todos los accesos activos'
                                      : 'Activar o desactivar acceso al Módulo de Dispersión de Nómina'
                                  }
                                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                                    isAdminRole ? 'cursor-default' : 'cursor-pointer'
                                  } ${hasDispersion ? 'bg-[#A9DFD8]' : 'bg-[#171821] border border-white/15'}`}
                                >
                                  <span
                                    className={`inline-block h-3.5 w-3.5 transform rounded-full transition-transform ${
                                      hasDispersion
                                        ? 'translate-x-4 bg-[#171821]'
                                        : 'translate-x-1 bg-[#87888C]'
                                    }`}
                                  />
                                </button>
                              </div>

                              {/* Switch 2: Módulo para Trabajar Listas */}
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-1.5">
                                  <Briefcase
                                    className={`w-3.5 h-3.5 shrink-0 ${
                                      hasTrabajarListas ? 'text-[#20AEF3]' : 'text-[#87888C]'
                                    }`}
                                  />
                                  <span
                                    className={`text-xs font-bold ${
                                      hasTrabajarListas ? 'text-white' : 'text-[#87888C]'
                                    }`}
                                  >
                                    Trabajar una Lista
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  disabled={isAdminRole}
                                  onClick={() => handleQuickToggleUserModule(u, 'trabajar_listas')}
                                  title={
                                    isAdminRole
                                      ? 'El Administrador General tiene todos los accesos activos'
                                      : 'Activar o desactivar acceso al Módulo para Trabajar Listas'
                                  }
                                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                                    isAdminRole ? 'cursor-default' : 'cursor-pointer'
                                  } ${hasTrabajarListas ? 'bg-[#20AEF3]' : 'bg-[#171821] border border-white/15'}`}
                                >
                                  <span
                                    className={`inline-block h-3.5 w-3.5 transform rounded-full transition-transform ${
                                      hasTrabajarListas
                                        ? 'translate-x-4 bg-[#171821]'
                                        : 'translate-x-1 bg-[#87888C]'
                                    }`}
                                  />
                                </button>
                              </div>
                            </div>
                          </td>

                          {/* Columna 3: Lista(s) Asignada(s) para Trabajar */}
                          <td className="py-4 px-4 align-top">
                            {hasTrabajarListas || u.role === 'supervisor' ? (
                              <div className="space-y-1.5 max-w-xs">
                                {userLists.length > 0 ? (
                                  <div className="text-xs font-bold text-white leading-relaxed">
                                    {userLists.join(' · ')}
                                  </div>
                                ) : isAdminRole ? (
                                  <div className="text-xs font-semibold text-slate-300">
                                    Todas las listas del catálogo
                                  </div>
                                ) : (
                                  <div className="text-xs font-semibold text-[#FEB95A]">
                                    Sin lista asignada
                                  </div>
                                )}

                                {u.delegatedSupervisor && (
                                  <div className="text-[11px] font-semibold text-[#FEB95A] flex items-center gap-1">
                                    <ArrowRightLeft className="w-3 h-3 shrink-0" />
                                    <span>Supliendo a: {u.delegatedSupervisor}</span>
                                  </div>
                                )}

                                <button
                                  type="button"
                                  onClick={() => openEditModal(u, 'nomina_listas')}
                                  className="text-[11px] font-bold text-[#A9DFD8] hover:underline cursor-pointer inline-flex items-center gap-1"
                                >
                                  Asignar o cambiar listas ({userLists.length})
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-[#87888C]">
                                No trabaja listas individuales
                              </span>
                            )}
                          </td>

                          {/* Columna 4: Otros Permisos del Sistema */}
                          <td className="py-4 px-4 align-top">
                            {isAdminRole ? (
                              <span className="text-xs font-bold text-[#FEB95A]">
                                Todos los módulos y configuraciones
                              </span>
                            ) : otherMods.length > 0 ? (
                              <p className="text-xs text-slate-300 leading-relaxed max-w-xs">
                                {otherMods
                                  .map(mod => PORTAL_MODULE_LABELS[mod]?.short || mod)
                                  .join(' · ')}
                              </p>
                            ) : (
                              <span className="text-xs text-[#87888C]">Ninguno adicional</span>
                            )}
                          </td>

                          {/* Columna 5: Acciones */}
                          <td className="py-4 px-6 align-top text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditModal(u, 'cuenta')}
                                className="px-3 py-1.5 rounded-lg border border-white/[0.1] bg-[#171821] hover:bg-[#2B2B36] hover:border-[#A9DFD8]/40 text-white font-bold text-xs transition-all cursor-pointer whitespace-nowrap shrink-0"
                              >
                                Configurar
                              </button>
                              {u.id !== 'user_admin_1' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (
                                      confirm(`¿Eliminar al usuario "${u.name}" del sistema?`)
                                    ) {
                                      onDeleteUser(u.id);
                                    }
                                  }}
                                  className="p-1.5 rounded-lg text-[#87888C] hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                  title="Eliminar usuario"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 px-6 text-center">
                          <p className="text-sm font-bold text-white">
                            No se encontraron usuarios con ese criterio
                          </p>
                          <p className="text-xs text-[#87888C] mt-1">
                            Prueba con otro término de búsqueda o crea un nuevo usuario.
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* SECCIÓN 2: REGLAS DE TIEMPO EXTRA                                     */}
          {/* ===================================================================== */}
          {activeSection === 'tiempo_extra' && canManageOvertime && onSaveOvertimeRules && (
            <div className="bg-[#21222D] border border-white/[0.07] rounded-2xl overflow-hidden shadow-xl">
              <div className="px-6 py-5 border-b border-white/[0.06]">
                <h3 className="text-base font-extrabold text-white">
                  Reglas de Cálculo de Tiempo Extra
                </h3>
                <p className="text-xs text-[#87888C] mt-0.5">
                  Define a partir de cuántos minutos después de la salida se contabiliza tiempo extra y bloquea que llegar temprano sume horas extras.
                </p>
              </div>
              <div className="p-6">
                <OvertimeConfigContent
                  rules={overtimeRules || DEFAULT_OVERTIME_RULES}
                  jornadaBase={jornadaBase}
                  onSaveRules={onSaveOvertimeRules}
                  isStandaloneModule={true}
                />
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* SECCIÓN 3: PLAZO LÍMITE DE LIBERACIÓN                                 */}
          {/* ===================================================================== */}
          {activeSection === 'tiempo_limite' && canManageDeadline && (
            <div className="bg-[#21222D] border border-white/[0.07] rounded-2xl overflow-hidden divide-y divide-white/[0.06] shadow-xl">
              <div className="px-6 py-5">
                <h3 className="text-base font-extrabold text-white">
                  Plazo Límite para Liberar Nómina
                </h3>
                <p className="text-xs text-[#87888C] mt-0.5">
                  Configura las horas permitidas para que los supervisores revisen y liberen su lista después de ser dispersada.
                </p>
              </div>

              {/* Fila 1: Horas permitidas */}
              <div className="px-6 py-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="max-w-md">
                  <label className="text-sm font-bold text-white">
                    Tiempo permitido después de dispersar (Horas)
                  </label>
                  <p className="text-xs text-[#87888C] mt-0.5">
                    Este cronómetro en cuenta regresiva se muestra en el portal de cada supervisor que trabaja listas.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={336}
                      value={deadlineHoursInput}
                      onChange={e =>
                        setDeadlineHoursInput(
                          Math.max(1, Math.min(336, Number(e.target.value) || 1))
                        )
                      }
                      className="w-24 px-3 py-2 bg-[#171821] border border-white/[0.1] rounded-xl text-sm font-mono font-extrabold text-white text-center focus:border-[#A9DFD8] outline-none tabular-nums"
                    />
                    <span className="text-xs font-bold text-[#87888C]">horas</span>
                  </div>

                  <div className="flex items-center gap-1 bg-[#171821] p-1 rounded-xl border border-white/[0.06]">
                    {[4, 8, 12, 24, 48, 72].map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setDeadlineHoursInput(preset)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer tabular-nums ${
                          deadlineHoursInput === preset
                            ? 'bg-[#A9DFD8] text-[#171821] shadow-sm'
                            : 'text-[#87888C] hover:text-white'
                        }`}
                      >
                        {preset}h
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Fila 2: Semana Activa */}
              <div className="px-6 py-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-white">
                    Aplicar cambio a la dispersión de la semana en curso
                  </p>
                  <p className="text-xs text-[#87888C] mt-0.5">
                    {activeDispersal?.limiteLiberacion
                      ? `La Semana ${currentWeekNumber} tiene vencimiento actual el ${new Date(
                          activeDispersal.limiteLiberacion
                        ).toLocaleString([], {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}.`
                      : 'Aún no hay una dispersión activa en la semana seleccionada.'}
                  </p>
                </div>

                <label className="inline-flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyToActiveWeek}
                    onChange={e => setApplyToActiveWeek(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#A9DFD8]"
                  />
                  <span className="text-xs font-bold text-slate-200">
                    Actualizar cuenta regresiva activa
                  </span>
                </label>
              </div>

              {/* Pie de Guardar */}
              <div className="px-6 py-4 bg-[#171821]/80 flex items-center justify-between gap-4">
                <div className="text-xs font-bold text-[#A9DFD8]">
                  {savedDeadlineToast && '✓ Plazo límite actualizado correctamente.'}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (onSaveHorasLimiteLiberacion) {
                      onSaveHorasLimiteLiberacion(deadlineHoursInput, applyToActiveWeek);
                      setSavedDeadlineToast(true);
                      setTimeout(() => setSavedDeadlineToast(false), 3000);
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-[#A9DFD8] hover:bg-[#95d5cd] text-[#171821] text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Guardar Plazo Límite
                </button>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* SECCIÓN 4: PLANTILLAS DE CORREO Y ALERTAS AUTOMÁTICAS                 */}
          {/* ===================================================================== */}
          {activeSection === 'plantillas_correo' && canManageEmailTemplates && (
            <div className="bg-[#21222D] border border-white/[0.07] rounded-2xl overflow-hidden divide-y divide-white/[0.06] shadow-xl">
              <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    Mensajes de Correo y Alertas Automáticas
                  </h3>
                  <p className="text-xs text-[#87888C] mt-0.5">
                    Personaliza el correo que se envía al dispersar la nómina y el recordatorio automático antes de que venza el plazo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRestoreDefaultTemplates}
                  className="px-3 py-1.5 rounded-xl border border-white/[0.1] bg-[#171821] hover:bg-[#2B2B36] text-slate-200 text-xs font-bold cursor-pointer self-start sm:self-auto whitespace-nowrap shrink-0"
                >
                  Restaurar Textos Base
                </button>
              </div>

              {/* Variables disponibles */}
              <div className="px-6 py-3.5 bg-[#171821]/70 text-xs text-[#87888C] flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-200">Variables dinámicas:</span>
                {[
                  '{supervisor}',
                  '{nombre}',
                  '{semana}',
                  '{periodo}',
                  '{horas_limite}',
                  '{fecha_limite}',
                  '{tiempo_restante}',
                  '{dispersado_por}',
                  '{url_portal}',
                ].map(tag => (
                  <code
                    key={tag}
                    className="font-mono font-bold text-[#A9DFD8] bg-[#171821] px-2 py-0.5 rounded border border-white/[0.08]"
                  >
                    {tag}
                  </code>
                ))}
              </div>

              {/* Bloque de Botón de Redirección al Sistema */}
              <div className="p-6 bg-[#171821]/40 space-y-4">
                <div>
                  <h4 className="text-sm font-extrabold text-white">
                    Botón de Redirección Directa al Sistema en el Correo
                  </h4>
                  <p className="text-xs text-[#87888C]">
                    Cada correo incluirá un botón interactivo que lleva al supervisor directamente al sistema para revisar y liberar su nómina.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Texto del Botón en el Correo
                    </label>
                    <input
                      type="text"
                      value={textoBotonCorreo}
                      onChange={e => setTextoBotonCorreo(e.target.value)}
                      placeholder="Ir al Sistema a Revisar y Liberar Nómina"
                      className="w-full px-3.5 py-2.5 bg-[#171821] border border-white/[0.1] rounded-xl text-xs font-semibold text-white focus:border-[#A9DFD8] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      URL del Sistema (Dominio / Servidor)
                    </label>
                    <input
                      type="url"
                      value={portalUrl}
                      onChange={e => setPortalUrl(e.target.value)}
                      placeholder={
                        typeof window !== 'undefined'
                          ? window.location.origin
                          : 'https://tu-dominio.com'
                      }
                      className="w-full px-3.5 py-2.5 bg-[#171821] border border-white/[0.1] rounded-xl text-xs font-mono font-semibold text-white focus:border-[#A9DFD8] outline-none"
                    />
                    <p className="text-[11px] text-[#87888C] mt-1">
                      Se detecta automáticamente tu servidor actual, o puedes fijar tu dominio de Hostinger.
                    </p>
                  </div>
                </div>
              </div>

              {/* Bloque 1: Correo al dispersar */}
              <div className="p-6 space-y-4">
                <div>
                  <h4 className="text-sm font-extrabold text-white">
                    1. Notificación al Dispersar Nómina
                  </h4>
                  <p className="text-xs text-[#87888C]">
                    Se envía automáticamente al correo del supervisor en cuanto se dispersa su lista.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Asunto del Correo
                    </label>
                    <input
                      type="text"
                      value={asuntoDispersion}
                      onChange={e => setAsuntoDispersion(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#171821] border border-white/[0.1] rounded-xl text-xs font-semibold text-white focus:border-[#A9DFD8] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Cuerpo del Mensaje
                    </label>
                    <textarea
                      rows={5}
                      value={mensajeDispersion}
                      onChange={e => setMensajeDispersion(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#171821] border border-white/[0.1] rounded-xl text-xs font-medium text-slate-200 focus:border-[#A9DFD8] outline-none leading-relaxed"
                    />
                  </div>
                </div>
              </div>

              {/* Bloque 2: Alerta antes de vencer */}
              <div className="p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-extrabold text-white">
                      2. Recordatorio Automático Antes de Vencer el Tiempo Límite
                    </h4>
                    <p className="text-xs text-[#87888C]">
                      Se envía automáticamente a los supervisores que aún no han liberado su lista cuando el reloj está por expirar.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activarAlertaPorVencer}
                        onChange={e => setActivarAlertaPorVencer(e.target.checked)}
                        className="w-4 h-4 rounded accent-[#A9DFD8]"
                      />
                      <span className="text-xs font-bold text-slate-200">Alerta activa</span>
                    </label>

                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-[#87888C]">Enviar</span>
                      <input
                        type="number"
                        min={1}
                        max={72}
                        value={horasAntesVencimiento}
                        onChange={e =>
                          setHorasAntesVencimiento(
                            Math.max(1, Math.min(72, Number(e.target.value) || 2))
                          )
                        }
                        className="w-16 px-2.5 py-1.5 bg-[#171821] border border-white/[0.1] rounded-lg text-xs font-mono font-bold text-white text-center tabular-nums"
                      />
                      <span className="text-xs text-[#87888C]">horas antes</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Asunto del Recordatorio por Vencimiento
                    </label>
                    <input
                      type="text"
                      value={asuntoPorVencer}
                      onChange={e => setAsuntoPorVencer(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#171821] border border-white/[0.1] rounded-xl text-xs font-semibold text-white focus:border-[#A9DFD8] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Mensaje de Alerta por Vencimiento
                    </label>
                    <textarea
                      rows={5}
                      value={mensajePorVencer}
                      onChange={e => setMensajePorVencer(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#171821] border border-white/[0.1] rounded-xl text-xs font-medium text-slate-200 focus:border-[#A9DFD8] outline-none leading-relaxed"
                    />
                  </div>
                </div>

                {/* Vista Previa limpia con el botón real */}
                <div className="bg-[#171821] border border-white/[0.08] rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold text-[#87888C] uppercase tracking-wider">
                      Vista previa del correo que recibe el supervisor:
                    </p>
                    <span className="text-[11px] font-mono text-[#A9DFD8] truncate max-w-xs">
                      {previewActionUrl}
                    </span>
                  </div>
                  <div className="bg-[#21222D] border border-white/[0.07] rounded-xl p-4 space-y-3">
                    <p className="text-xs font-extrabold text-white border-b border-white/[0.06] pb-2">
                      {formatEmailTemplate(asuntoDispersion, samplePreviewVars)}
                    </p>
                    <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">
                      {formatEmailTemplate(mensajeDispersion, samplePreviewVars)}
                    </p>
                    <div className="pt-3 pb-1 flex flex-col items-center justify-center border-t border-white/[0.06]">
                      <a
                        href={previewActionUrl}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#A9DFD8] hover:bg-[#95d5cd] text-[#171821] text-xs font-extrabold shadow-sm transition-colors no-underline"
                      >
                        <span>
                          {textoBotonCorreo.trim() || DEFAULT_EMAIL_TEMPLATES.textoBotonCorreo}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <span className="text-[10px] text-[#87888C] mt-1.5">
                        Al hacer clic, redirige al supervisor a su lista en el sistema para revisar y liberar
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {templatesFeedback.type && (
                <div
                  className={`px-6 py-3 text-xs font-bold ${
                    templatesFeedback.type === 'success'
                      ? 'bg-[#A9DFD8]/15 text-[#A9DFD8]'
                      : 'bg-rose-500/15 text-rose-300'
                  }`}
                >
                  {templatesFeedback.message}
                </div>
              )}

              <div className="px-6 py-4 bg-[#171821]/80 flex flex-wrap items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isTestingExpiringAlert}
                  onClick={handleTestExpiringAlert}
                  className="px-3.5 py-2.5 rounded-xl border border-white/[0.1] bg-[#21222D] hover:bg-[#2B2B36] text-slate-200 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {isTestingExpiringAlert ? 'Enviando prueba...' : 'Probar Envío de Alerta'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveEmailTemplates}
                  className="px-4 py-2.5 rounded-xl bg-[#A9DFD8] hover:bg-[#95d5cd] text-[#171821] text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Guardar Mensajes y Alertas
                </button>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* SECCIÓN 5: SERVIDOR DE CORREO (SMTP)                                  */}
          {/* ===================================================================== */}
          {activeSection === 'smtp_correo' && canManageSmtp && (
            <div className="bg-[#21222D] border border-white/[0.07] rounded-2xl overflow-hidden divide-y divide-white/[0.06] shadow-xl">
              <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    Credenciales de Servidor de Correo (SMTP)
                  </h3>
                  <p className="text-xs text-[#87888C] mt-0.5">
                    Configura la cuenta emisora para el envío automático de notificaciones de nómina y recuperación de contraseñas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGmailGuide(!showGmailGuide)}
                  className="px-3 py-1.5 rounded-xl border border-white/[0.1] bg-[#171821] hover:bg-[#2B2B36] text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto whitespace-nowrap shrink-0"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-[#FEB95A]" />
                  {showGmailGuide ? 'Ocultar guía Gmail' : 'Guía Contraseña de Aplicación'}
                </button>
              </div>

              {showGmailGuide && (
                <div className="p-6 bg-[#FEB95A]/10 border-l-4 border-[#FEB95A] space-y-2 text-xs text-slate-200">
                  <p className="font-bold text-[#FEB95A]">
                    Cómo generar tu Contraseña de Aplicación de 16 letras en Google (Error 534-5.7.9):
                  </p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Activa la verificación en 2 pasos en tu cuenta de Google.</li>
                    <li>
                      Abre{' '}
                      <a
                        href="https://myaccount.google.com/apppasswords"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-[#A9DFD8] underline inline-flex items-center gap-1"
                      >
                        myaccount.google.com/apppasswords
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </li>
                    <li>Crea una clave para "CemenQtime" y pega las 16 letras en Contraseña SMTP.</li>
                  </ol>
                </div>
              )}

              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Servidor SMTP (Host)
                  </label>
                  <input
                    type="text"
                    value={smtpHost}
                    onChange={e => setSmtpHost(e.target.value)}
                    placeholder="smtp.gmail.com"
                    className="w-full px-3.5 py-2.5 bg-[#171821] border border-white/[0.1] rounded-xl text-xs font-mono font-bold text-white focus:border-[#A9DFD8] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Puerto SMTP
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={smtpPort}
                      onChange={e => {
                        const port = Number(e.target.value) || 587;
                        setSmtpPort(port);
                        setSmtpSecure(port === 465);
                      }}
                      className="w-24 px-3 py-2.5 bg-[#171821] border border-white/[0.1] rounded-xl text-xs font-mono font-bold text-white text-center tabular-nums focus:border-[#A9DFD8] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSmtpPort(587);
                        setSmtpSecure(false);
                      }}
                      className={`px-2.5 py-2 rounded-lg text-xs font-mono font-bold border cursor-pointer ${
                        smtpPort === 587
                          ? 'bg-[#A9DFD8] text-[#171821] border-[#A9DFD8]'
                          : 'bg-[#171821] text-[#87888C] border-white/[0.1]'
                      }`}
                    >
                      587 TLS
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSmtpPort(465);
                        setSmtpSecure(true);
                      }}
                      className={`px-2.5 py-2 rounded-lg text-xs font-mono font-bold border cursor-pointer ${
                        smtpPort === 465
                          ? 'bg-[#A9DFD8] text-[#171821] border-[#A9DFD8]'
                          : 'bg-[#171821] text-[#87888C] border-white/[0.1]'
                      }`}
                    >
                      465 SSL
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Nombre Visible del Remitente
                  </label>
                  <input
                    type="text"
                    value={smtpFromName}
                    onChange={e => setSmtpFromName(e.target.value)}
                    placeholder="CemenQtime Nóminas"
                    className="w-full px-3.5 py-2.5 bg-[#171821] border border-white/[0.1] rounded-xl text-xs font-semibold text-white focus:border-[#A9DFD8] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Usuario / Correo Emisor SMTP
                  </label>
                  <input
                    type="email"
                    value={smtpUser}
                    onChange={e => setSmtpUser(e.target.value)}
                    placeholder="nominas@empresa.com"
                    className="w-full px-3.5 py-2.5 bg-[#171821] border border-white/[0.1] rounded-xl text-xs font-mono font-bold text-white focus:border-[#A9DFD8] outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Contraseña SMTP / Contraseña de Aplicación
                  </label>
                  <div className="relative">
                    <input
                      type={showSmtpPass ? 'text' : 'password'}
                      value={smtpPass}
                      onChange={e => setSmtpPass(e.target.value)}
                      placeholder="Contraseña de 16 caracteres o clave SMTP"
                      className="w-full pl-3.5 pr-9 py-2.5 bg-[#171821] border border-white/[0.1] rounded-xl text-xs font-mono font-bold text-white focus:border-[#A9DFD8] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmtpPass(!showSmtpPass)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#87888C] hover:text-white cursor-pointer"
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

              {smtpFeedback.type && (
                <div
                  className={`px-6 py-3 text-xs font-bold ${
                    smtpFeedback.type === 'success'
                      ? 'bg-[#A9DFD8]/15 text-[#A9DFD8]'
                      : 'bg-rose-500/15 text-rose-300'
                  }`}
                >
                  {smtpFeedback.message}
                </div>
              )}

              <div className="px-6 py-4 bg-[#171821]/80 flex flex-wrap items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isTestingSmtp}
                  onClick={handleTestSmtpConnection}
                  className="px-3.5 py-2.5 rounded-xl border border-white/[0.1] bg-[#21222D] hover:bg-[#2B2B36] text-slate-200 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {isTestingSmtp ? 'Verificando...' : 'Probar Conexión SMTP'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveSmtpCredentials}
                  className="px-4 py-2.5 rounded-xl bg-[#A9DFD8] hover:bg-[#95d5cd] text-[#171821] text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Guardar Credenciales SMTP
                </button>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* SECCIÓN 6: SERVIDOR Y PERSISTENCIA                                    */}
          {/* ===================================================================== */}
          {activeSection === 'vps_hostinger' && canManageUsers && (
            <div className="bg-[#21222D] border border-white/[0.07] rounded-2xl overflow-hidden divide-y divide-white/[0.06] shadow-xl">
              <div className="px-6 py-5 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    Estado del Servidor y Base de Datos
                  </h3>
                  <p className="text-xs text-[#87888C] mt-0.5">
                    Sincronización automática de usuarios, catálogos, dispersiones y liberaciones.
                  </p>
                </div>
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-lg border ${
                    serverStatus.connected
                      ? 'bg-[#A9DFD8]/15 text-[#A9DFD8] border-[#A9DFD8]/30'
                      : 'bg-[#171821] text-[#87888C] border-white/[0.08]'
                  }`}
                >
                  {serverStatus.connected
                    ? `Conectado (${serverStatus.hostname || 'VPS'})`
                    : 'Almacenamiento Local'}
                </span>
              </div>

              <div className="p-6 space-y-4">
                {serverStatus.storagePath && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-300">Ruta de base de datos:</span>
                    <code className="font-mono text-[#A9DFD8] bg-[#171821] border border-white/[0.08] px-2.5 py-1 rounded">
                      {serverStatus.storagePath}
                    </code>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    {
                      label: '1. Instalar dependencias',
                      cmd: 'npm install && npm run build',
                    },
                    {
                      label: '2. Iniciar con PM2 (Puerto 3000)',
                      cmd: 'PORT=3000 pm2 start "npx tsx server.ts" --name cemenqtime',
                    },
                    {
                      label: '3. Guardar arranque automático',
                      cmd: 'pm2 save && pm2 startup',
                    },
                  ].map(item => (
                    <div
                      key={item.label}
                      className="bg-[#171821] border border-white/[0.08] rounded-xl p-3.5 flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200">{item.label}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyCommand(item.cmd, item.label)}
                          className="text-[#87888C] hover:text-white cursor-pointer"
                          title="Copiar comando"
                        >
                          {copiedCmd === item.label ? (
                            <Check className="w-3.5 h-3.5 text-[#A9DFD8]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <code className="text-[11px] font-mono text-[#A9DFD8] break-all">
                        {item.cmd}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODAL DE CONFIGURACIÓN DE USUARIO ESTILO DARK ADMIN DASHBOARD         */}
      {/* ===================================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[#21222D] rounded-2xl max-w-2xl w-full border border-white/[0.1] shadow-2xl overflow-hidden my-8 animate-scale-in">
            {/* Encabezado del Modal */}
            <div className="px-6 py-4 border-b border-white/[0.07] bg-[#171821]/60 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-white">
                  {editingId ? `Configurar Usuario: ${name}` : 'Registrar Nuevo Usuario'}
                </h3>
                <p className="text-xs text-[#87888C] mt-0.5">
                  Configura sus credenciales, accesos a Dispersión o Trabajar Listas y las listas asignadas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-xs font-bold text-[#87888C] hover:text-white px-2.5 py-1 rounded-lg hover:bg-white/5 cursor-pointer"
              >
                Cerrar
              </button>
            </div>

            {/* Navegación de Pestañas Internas del Modal */}
            <div className="px-6 bg-[#171821] border-b border-white/[0.07] flex items-center gap-2 overflow-x-auto">
              {[
                { id: 'cuenta', label: '1. Cuenta y Rol Base' },
                {
                  id: 'nomina_listas',
                  label: `2. Dispersión vs Trabajar Listas (${assignedLists.length})`,
                },
                { id: 'modulos', label: '3. Otros Permisos del Sistema' },
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setModalTab(t.id as ModalSectionTab)}
                  className={`py-3 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    modalTab === t.id
                      ? 'border-[#A9DFD8] text-[#A9DFD8]'
                      : 'border-transparent text-[#87888C] hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-6 max-h-[70vh] overflow-y-auto space-y-5">
                {/* PESTAÑA 1: CUENTA Y ROL BASE */}
                {modalTab === 'cuenta' && (
                  <div className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-2">
                        Rol Base del Usuario
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {[
                          {
                            id: 'supervisor' as UserRole,
                            title: 'Supervisor de Área',
                            desc: 'Trabaja y libera las listas de nómina asignadas.',
                          },
                          {
                            id: 'rh' as UserRole,
                            title: 'RH / Nóminas',
                            desc: 'Procesa checadas, dispersa nóminas y exporta layouts.',
                          },
                          {
                            id: 'admin' as UserRole,
                            title: 'Administrador General',
                            desc: 'Acceso total a todos los módulos y configuraciones.',
                          },
                        ].map(item => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelectRoleInModal(item.id)}
                            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                              role === item.id
                                ? 'bg-[#A9DFD8]/15 text-[#A9DFD8] border-[#A9DFD8]'
                                : 'bg-[#171821] text-slate-200 border-white/[0.08] hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-extrabold">{item.title}</span>
                              {role === item.id && <Check className="w-3.5 h-3.5 shrink-0" />}
                            </div>
                            <p
                              className={`text-[11px] mt-1 leading-snug ${
                                role === item.id ? 'text-slate-200' : 'text-[#87888C]'
                              }`}
                            >
                              {item.desc}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          Nombre Completo *
                        </label>
                        <input
                          type="text"
                          value={name}
                          onChange={e => setName(e.target.value)}
                          placeholder="Ej: Ing. Carlos Ruiz"
                          className="w-full px-3.5 py-2.5 bg-[#171821] border border-white/[0.1] rounded-xl text-xs font-semibold text-white focus:border-[#A9DFD8] outline-none"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
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
                          className="w-full px-3.5 py-2.5 bg-[#171821] border border-white/[0.1] rounded-xl text-xs font-mono font-bold text-white focus:border-[#A9DFD8] outline-none tabular-nums"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          Usuario para Iniciar Sesión *
                        </label>
                        <input
                          type="text"
                          value={username}
                          onChange={e => setUsername(e.target.value)}
                          placeholder="carlos.ruiz o 00615"
                          className="w-full px-3.5 py-2.5 bg-[#171821] border border-white/[0.1] rounded-xl text-xs font-mono font-bold text-white focus:border-[#A9DFD8] outline-none"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          Contraseña *
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="Contraseña de acceso"
                            className="w-full pl-3.5 pr-9 py-2.5 bg-[#171821] border border-white/[0.1] rounded-xl text-xs font-mono font-bold text-white focus:border-[#A9DFD8] outline-none"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#87888C] hover:text-white cursor-pointer"
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          Correo Electrónico (Para recibir alertas y recuperar clave) *
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          placeholder="carlos.ruiz@empresa.com"
                          className="w-full px-3.5 py-2.5 bg-[#171821] border border-white/[0.1] rounded-xl text-xs font-semibold text-white focus:border-[#A9DFD8] outline-none"
                          required
                        />
                      </div>

                      <div className="flex items-end">
                        <label className="flex items-center gap-2.5 cursor-pointer bg-[#171821] px-3.5 py-2.5 rounded-xl border border-white/[0.1] w-full">
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={e => setActive(e.target.checked)}
                            className="w-4 h-4 rounded accent-[#A9DFD8]"
                          />
                          <span className="text-xs font-bold text-slate-200">
                            Cuenta activa para iniciar sesión
                          </span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Notas u Observaciones (Opcional)
                      </label>
                      <input
                        type="text"
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Ej: Responsable de planta / Suplencia autorizada..."
                        className="w-full px-3.5 py-2.5 bg-[#171821] border border-white/[0.1] rounded-xl text-xs font-medium text-white focus:border-[#A9DFD8] outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* PESTAÑA 2: DISPERSIÓN DE NÓMINA VS TRABAJAR LISTAS */}
                {modalTab === 'nomina_listas' && (
                  <div className="space-y-5">
                    <div className="border border-white/[0.08] bg-[#171821] rounded-xl divide-y divide-white/[0.06]">
                      {/* Fila 1: Módulo de Dispersión de Nómina */}
                      {(() => {
                        const hasDispersion =
                          role === 'admin' || allowedModules.includes('nomina');
                        return (
                          <div className="p-4 flex items-center justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <Send
                                className={`w-4 h-4 mt-0.5 shrink-0 ${
                                  hasDispersion ? 'text-[#A9DFD8]' : 'text-[#87888C]'
                                }`}
                              />
                              <div>
                                <p className="text-xs font-extrabold text-white">
                                  Acceso al Módulo de Dispersión de Nómina
                                </p>
                                <p className="text-[11px] text-[#87888C] mt-0.5">
                                  Permite subir archivos del reloj checador, generar el cálculo global y dispersar las listas a los supervisores.
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={role === 'admin'}
                              onClick={() => handleToggleModuleAccess('nomina')}
                              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                                hasDispersion ? 'bg-[#A9DFD8]' : 'bg-[#21222D] border border-white/15'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
                                  hasDispersion
                                    ? 'translate-x-6 bg-[#171821]'
                                    : 'translate-x-1 bg-[#87888C]'
                                }`}
                              />
                            </button>
                          </div>
                        );
                      })()}

                      {/* Fila 2: Módulo para Trabajar una Lista */}
                      {(() => {
                        const hasTrabajarListas =
                          role === 'admin' || allowedModules.includes('trabajar_listas');
                        return (
                          <div className="p-4 flex items-center justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <Briefcase
                                className={`w-4 h-4 mt-0.5 shrink-0 ${
                                  hasTrabajarListas ? 'text-[#20AEF3]' : 'text-[#87888C]'
                                }`}
                              />
                              <div>
                                <p className="text-xs font-extrabold text-white">
                                  Acceso al Módulo para Trabajar Listas
                                </p>
                                <p className="text-[11px] text-[#87888C] mt-0.5">
                                  Permite entrar a revisar checadas, justificar faltas/omisiones, autorizar tiempo extra y liberar las listas seleccionadas abajo.
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={role === 'admin'}
                              onClick={() => handleToggleModuleAccess('trabajar_listas')}
                              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                                hasTrabajarListas ? 'bg-[#20AEF3]' : 'bg-[#21222D] border border-white/15'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
                                  hasTrabajarListas
                                    ? 'translate-x-6 bg-[#171821]'
                                    : 'translate-x-1 bg-[#87888C]'
                                }`}
                              />
                            </button>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Selector de Listas Asignadas cuando Trabajar Listas está activo */}
                    {(role === 'supervisor' ||
                      role === 'admin' ||
                      allowedModules.includes('trabajar_listas')) && (
                      <div className="border border-white/[0.08] rounded-xl p-4 space-y-3 bg-[#171821]">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <p className="text-xs font-extrabold text-white">
                              Listas de Nómina Asignadas a este Usuario ({assignedLists.length})
                            </p>
                            <p className="text-[11px] text-[#87888C]">
                              Marca qué lista o listas específicas puede abrir y trabajar esta persona.
                            </p>
                          </div>
                          {assignedLists.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setAssignedLists([])}
                              className="text-xs font-bold text-rose-400 hover:underline cursor-pointer"
                            >
                              Desmarcar todas
                            </button>
                          )}
                        </div>

                        {allAvailableSupervisorLists.length > 4 && (
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-[#87888C] absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={listSearchTerm}
                              onChange={e => setListSearchTerm(e.target.value)}
                              placeholder="Filtrar listas del catálogo..."
                              className="w-full pl-8 pr-3 py-2 bg-[#21222D] border border-white/[0.1] rounded-lg text-xs font-medium text-white outline-none focus:border-[#A9DFD8]"
                            />
                          </div>
                        )}

                        {filteredModalSupervisorLists.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto p-1">
                            {filteredModalSupervisorLists.map(sup => {
                              const isSelected = assignedLists.includes(sup);
                              return (
                                <label
                                  key={sup}
                                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-xs font-bold ${
                                    isSelected
                                      ? 'bg-[#A9DFD8]/15 text-[#A9DFD8] border-[#A9DFD8]'
                                      : 'bg-[#21222D] text-slate-200 border-white/[0.08] hover:border-white/20'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleAssignedList(sup)}
                                    className="w-3.5 h-3.5 rounded accent-[#A9DFD8]"
                                  />
                                  <span className="truncate">{sup}</span>
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-[#87888C] py-2">
                            No hay listas cargadas en el catálogo o que coincidan con el filtro. Puedes añadir el nombre manualmente abajo.
                          </p>
                        )}

                        {/* Agregar lista manualmente */}
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
                            placeholder="Escribir nombre de lista manualmente (ej: OSCAR VALENZUELA)..."
                            className="flex-1 px-3 py-2 bg-[#21222D] border border-white/[0.1] rounded-lg text-xs font-semibold text-white focus:border-[#A9DFD8] outline-none"
                          />
                          <button
                            type="button"
                            onClick={handleAddCustomList}
                            className="px-3 py-2 rounded-lg bg-[#A9DFD8] hover:bg-[#95d5cd] text-[#171821] text-xs font-extrabold flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Añadir Lista
                          </button>
                        </div>

                        {/* Suplencia temporal */}
                        <div className="pt-2 border-t border-white/[0.06]">
                          <label className="block text-xs font-bold text-slate-300 mb-1">
                            Suplencia Temporal por Vacaciones (Opcional)
                          </label>
                          <select
                            value={delegatedSupervisor}
                            onChange={e => setDelegatedSupervisor(e.target.value)}
                            className="w-full px-3 py-2 bg-[#21222D] border border-white/[0.1] rounded-lg text-xs font-semibold text-white focus:border-[#A9DFD8] outline-none"
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
                  </div>
                )}

                {/* PESTAÑA 3: OTROS PERMISOS Y MÓDULOS DEL SISTEMA */}
                {modalTab === 'modulos' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-300">
                        Selecciona los módulos adicionales a los que tendrá acceso este usuario
                      </p>
                      <button
                        type="button"
                        onClick={() => setAllowedModules([...ALL_PORTAL_MODULES])}
                        className="text-xs font-bold text-[#A9DFD8] hover:underline cursor-pointer"
                      >
                        Habilitar todos
                      </button>
                    </div>

                    <div className="border border-white/[0.08] bg-[#171821] rounded-xl divide-y divide-white/[0.06]">
                      {(Object.keys(PORTAL_MODULE_LABELS) as PortalModule[]).map(mod => {
                        const checked = role === 'admin' || allowedModules.includes(mod);
                        const info = PORTAL_MODULE_LABELS[mod];
                        return (
                          <label
                            key={mod}
                            className="p-3.5 flex items-center justify-between gap-4 hover:bg-white/[0.02] cursor-pointer transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-extrabold text-white">{info.title}</p>
                              <p className="text-[11px] text-[#87888C] mt-0.5">
                                {info.description}
                              </p>
                            </div>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={role === 'admin'}
                              onChange={() => handleToggleModuleAccess(mod)}
                              className="w-4 h-4 rounded accent-[#A9DFD8] shrink-0"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Pie de Acciones del Modal */}
              <div className="px-6 py-4 bg-[#171821] border-t border-white/[0.07] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {modalTab !== 'nomina_listas' && (
                    <button
                      type="button"
                      onClick={() => setModalTab('nomina_listas')}
                      className="text-xs font-bold text-[#A9DFD8] hover:underline cursor-pointer"
                    >
                      Ir a Dispersión y Listas Asignadas →
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-white/[0.1] bg-[#21222D] text-xs font-bold text-slate-200 hover:bg-[#2B2B36] transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#A9DFD8] hover:bg-[#95d5cd] text-[#171821] text-xs font-extrabold transition-colors cursor-pointer"
                  >
                    {editingId ? 'Guardar Cambios' : 'Crear Usuario'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
