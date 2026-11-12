/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  Eye,
  FileSpreadsheet,
  Building2,
  MessageSquare,
  Send,
  FileCheck,
  Bell,
  Mail,
  ListChecks,
  UserCheck,
  X,
  Ban,
  RotateCcw,
  Key,
  Check,
  Sparkles,
  Settings,
  ShieldCheck,
  Timer
} from 'lucide-react';
import { PayrollDispersal, PayrollRelease, PortalUser, EmailServerConfig, getUserAllowedLists, userHasModuleAccess } from '../../types/portal';
import { EmpleadoProcesado } from '../../types/attendance';
import { HeadlessSelect, SelectOption } from '../ui/HeadlessSelect';
import { HeadlessModal } from '../ui/HeadlessModal';
import { DispersalCountdownTimer } from './DispersalCountdownTimer';
import { PortalService } from '../../services/portalService';

interface RHPayrollMonitorViewProps {
  supervisors: string[];
  users?: PortalUser[];
  releases: Record<string, PayrollRelease>;
  dispersals: PayrollDispersal[];
  empleados: EmpleadoProcesado[];
  semanaPeriodo: string;
  semanaNumero: number;
  currentUser: PortalUser;
  onDownloadExcel: (supervisorName: string) => void;
  onInspectSupervisor: (supervisorName: string) => void;
  onDisperseWeek: (
    semanaNumero: number,
    semanaPeriodo: string,
    mensaje?: string,
    targetSupervisors?: string[],
    sendCorporateEmail?: boolean,
    horasLimite?: number,
    limiteLiberacion?: string
  ) => void;
  onCancelDispersal?: (
    semanaNumero: number,
    targetSupervisors?: string[],
    motivo?: string
  ) => void;
  onDownloadSupervisorReturnedExcel: (fileName: string, base64: string) => void;
  onUpdateReleaseStatus?: (releaseId: string, status: 'pendiente' | 'en_revision' | 'liberado') => void;
  onOpenContpaqiModule?: () => void;
  defaultHorasLimite?: number;
}

export const RHPayrollMonitorView: React.FC<RHPayrollMonitorViewProps> = ({
  supervisors,
  users = [],
  releases,
  dispersals,
  empleados,
  semanaPeriodo,
  semanaNumero,
  currentUser,
  onDownloadExcel,
  onInspectSupervisor,
  onDisperseWeek,
  onCancelDispersal,
  onDownloadSupervisorReturnedExcel,
  onOpenContpaqiModule,
  defaultHorasLimite = 24,
}) => {
  const [dispersalMessage, setDispersalMessage] = useState('');
  const [showDispersalDialog, setShowDispersalDialog] = useState(false);
  const [dispersalDialogMode, setDispersalDialogMode] = useState<'all' | 'by_list'>('all');
  const [sendEmailOnDisperse, setSendEmailOnDisperse] = useState(true);
  const [filterSupervisor, setFilterSupervisor] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'liberado' | 'pendiente'>('todos');

  // Estado del Temporizador Configurable (inicializado con el límite por horas configurado por el Administrador)
  const [timerHoursPreset, setTimerHoursPreset] = useState<string>(() => String(defaultHorasLimite || 24));
  const [customDeadlineTime, setCustomDeadlineTime] = useState<string>(() => {
    const d = new Date(Date.now() + (defaultHorasLimite || 24) * 3600000);
    return d.toISOString().slice(0, 16);
  });

  // Estado del Modal de Cancelación de Dispersión
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<'all' | string>('all');
  const [cancelMotivo, setCancelMotivo] = useState('');

  // Estado del Modal de Configuración SMTP
  const [showSmtpModal, setShowSmtpModal] = useState(false);
  const [smtpConfig, setSmtpConfig] = useState<EmailServerConfig>(() => PortalService.loadEmailConfig());
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Permisos granulares sobre Tiempo Límite y Credenciales SMTP
  const canEditTimeLimit = userHasModuleAccess(currentUser, 'tiempo_limite');
  const canEditSmtp = userHasModuleAccess(currentUser, 'smtp_correo');

  // Buscar si esta semana ya fue dispersada
  const currentDispersal = dispersals.find((d) => d.semanaNumero === semanaNumero);
  const isGlobalCancelled = Boolean(currentDispersal?.cancelada);
  const cancelledSupervisorsSet = new Set(
    (currentDispersal?.supervisoresCancelados || []).map((s) => s.trim().toUpperCase())
  );
  const notifiedListsSet = new Set(
    (currentDispersal?.supervisoresNotificados || []).map((s) => s.trim().toUpperCase())
  );

  // Calcular deadline ISO según el preset elegido
  const calculatedDeadlineISO = useMemo(() => {
    if (timerHoursPreset === 'none') return undefined;
    if (timerHoursPreset === 'custom' && customDeadlineTime) {
      return new Date(customDeadlineTime).toISOString();
    }
    const hours = Number(timerHoursPreset) || defaultHorasLimite || 24;
    return new Date(Date.now() + hours * 3600000).toISOString();
  }, [timerHoursPreset, customDeadlineTime, defaultHorasLimite]);

  // Calcular métricas por supervisor en tiempo real a partir de los datos procesados
  const supervisorStats = useMemo(() => {
    return supervisors.map((supName) => {
      const supEmployees = empleados.filter((e) => e.supervisor === supName);
      const releaseKey = `${semanaNumero}_${supName}`;
      const release = releases[releaseKey];
      const matchedUser = users.find(
        (u) => u.role === 'supervisor' && getUserAllowedLists(u).includes(supName.toUpperCase())
      );
      const corporateEmail =
        matchedUser?.email || `${supName.toLowerCase().replace(/\s+/g, '.')}@empresa.com`;

      const isCancelled = isGlobalCancelled || cancelledSupervisorsSet.has(supName.trim().toUpperCase());
      const isListDispersed = !isCancelled && notifiedListsSet.has(supName.trim().toUpperCase());

      const totalNormal = supEmployees.reduce((sum, e) => sum + e.totalHorasNormales, 0);
      const totalExtra = supEmployees.reduce((sum, e) => sum + e.totalHorasExtras, 0);
      const totalAlertas = supEmployees.reduce((sum, e) => sum + e.alertas.length, 0);

      const modifiedDays: Array<{
        empId: string;
        empNombre: string;
        fechaStr: string;
        entradaOriginal?: string;
        salidaOriginal?: string;
        entrada: string;
        salida: string;
        incidencia: string;
        tipoModificacion?: string;
        nota?: string;
        formatoNombre?: string;
        formatoBase64?: string;
      }> = [];

      supEmployees.forEach((emp) => {
        (emp.dias || []).forEach((d) => {
          if (d.modificadoPorSupervisor) {
            modifiedDays.push({
              empId: emp.id,
              empNombre: emp.nombre,
              fechaStr: `${d.dayName} ${d.isoDate}`,
              entradaOriginal: d.entradaOriginal,
              salidaOriginal: d.salidaOriginal,
              entrada: d.entrada,
              salida: d.salida,
              incidencia: d.incidencia,
              tipoModificacion: d.tipoModificacionSupervisor,
              nota: d.notaSupervisorDia,
              formatoNombre: d.formatoSubidoNombre,
              formatoBase64: d.formatoSubidoBase64,
            });
          }
        });
      });

      const checadasAgregadasCount =
        modifiedDays.filter(
          (m) =>
            m.tipoModificacion === 'checada_agregada' ||
            m.tipoModificacion === 'formato_checada_sin_gafete'
        ).length ||
        release?.checadasAgregadasSupervisorCount ||
        0;
      const formatosAdjuntosCount =
        modifiedDays.filter((m) => Boolean(m.formatoNombre)).length ||
        release?.formatosAdjuntosCount ||
        0;
      const faltasConfirmadasCount =
        modifiedDays.filter((m) => m.tipoModificacion === 'falta_confirmada').length ||
        release?.faltasConfirmadasCount ||
        0;

      const isLiberado = release?.status === 'liberado';
      const isEnRevision = release?.status === 'en_revision';

      // Validación de vencimiento de tiempo
      const deadline = currentDispersal?.limiteLiberacion;
      const isOverdue = Boolean(
        isListDispersed && !isLiberado && deadline && new Date(deadline).getTime() < Date.now()
      );

      return {
        name: supName,
        corporateEmail,
        isListDispersed,
        isCancelled,
        isOverdue,
        deadline,
        releaseKey,
        release,
        empleadosCount: supEmployees.length,
        horasNormales: totalNormal,
        horasExtras: totalExtra,
        alertasCount: totalAlertas,
        modifiedDays,
        checadasAgregadasCount,
        formatosAdjuntosCount,
        faltasConfirmadasCount,
        status: isLiberado ? 'liberado' : isEnRevision ? 'en_revision' : 'pendiente',
        fechaLiberacion: release?.fechaLiberacion,
        excelFileName: release?.excelTrabajadoNombre,
        excelBase64: release?.excelTrabajadoBase64,
        notasRevision: release?.notasRevision,
      };
    });
  }, [
    supervisors,
    empleados,
    semanaNumero,
    releases,
    users,
    notifiedListsSet,
    cancelledSupervisorsSet,
    isGlobalCancelled,
    currentDispersal,
  ]);

  const filteredStats = useMemo(() => {
    return supervisorStats.filter((st) => {
      const matchSup = !filterSupervisor || st.name === filterSupervisor;
      const matchStatus =
        filterStatus === 'todos'
          ? true
          : filterStatus === 'liberado'
          ? st.status === 'liberado'
          : st.status !== 'liberado';
      return matchSup && matchStatus;
    });
  }, [supervisorStats, filterSupervisor, filterStatus]);

  const totalSupervisores = supervisorStats.length;
  const dispersedListsCount = supervisorStats.filter((s) => s.isListDispersed).length;
  const liberadosCount = supervisorStats.filter((s) => s.status === 'liberado').length;
  const pendientesCount = totalSupervisores - liberadosCount;
  const overdueCount = supervisorStats.filter((s) => s.isOverdue).length;
  const porcentajeLiberacion =
    totalSupervisores > 0 ? Math.round((liberadosCount / totalSupervisores) * 100) : 0;

  const supervisorFilterOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: `Todas las Listas`, badge: `${totalSupervisores}` },
      ...supervisors.map((sup) => {
        const stat = supervisorStats.find((s) => s.name === sup);
        return {
          value: sup,
          label: sup,
          badge: stat?.status === 'liberado' ? 'Liberada' : 'Pendiente',
        };
      }),
    ],
    [supervisors, totalSupervisores, supervisorStats]
  );

  const statusFilterOptions: SelectOption[] = useMemo(
    () => [
      { value: 'todos', label: 'Todos los estatus' },
      { value: 'liberado', label: 'Solo Liberadas', badge: `${liberadosCount}` },
      { value: 'pendiente', label: 'Solo Pendientes', badge: `${pendientesCount}` },
    ],
    [liberadosCount, pendientesCount]
  );

  const handleConfirmDisperseAll = () => {
    const hours = timerHoursPreset === 'none' ? undefined : Number(timerHoursPreset) || 24;
    onDisperseWeek(
      semanaNumero,
      semanaPeriodo,
      dispersalMessage,
      supervisors,
      sendEmailOnDisperse,
      hours,
      calculatedDeadlineISO
    );
    setShowDispersalDialog(false);
    setDispersalMessage('');
  };

  const handleDisperseSingleList = (supName: string) => {
    const hours = timerHoursPreset === 'none' ? undefined : Number(timerHoursPreset) || 24;
    onDisperseWeek(
      semanaNumero,
      semanaPeriodo,
      dispersalMessage,
      [supName],
      sendEmailOnDisperse,
      hours,
      calculatedDeadlineISO
    );
  };

  const handleOpenCancelModal = (target: 'all' | string) => {
    setCancelTarget(target);
    setCancelMotivo('');
    setShowCancelDialog(true);
  };

  const handleConfirmCancelDispersal = () => {
    if (onCancelDispersal) {
      const targets = cancelTarget === 'all' ? undefined : [cancelTarget];
      onCancelDispersal(semanaNumero, targets, cancelMotivo);
    }
    setShowCancelDialog(false);
    setCancelMotivo('');
  };

  const handleTestSmtpConnection = async () => {
    setSmtpTesting(true);
    setSmtpTestResult(null);
    try {
      const res = await fetch('/api/notifications/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(smtpConfig),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSmtpTestResult({
          ok: true,
          message: data.message || '✓ Conexión SMTP verificada y lista para envíos.',
        });
        const merged = { ...PortalService.loadEmailConfig(), ...smtpConfig };
        setSmtpConfig(merged);
        PortalService.saveEmailConfig(merged);
      } else {
        setSmtpTestResult({
          ok: false,
          message: data.error || 'No se pudo conectar con el servidor SMTP. Revisa usuario y contraseña.',
        });
      }
    } catch (err: any) {
      setSmtpTestResult({
        ok: false,
        message: err.message || 'Error de red al conectar con el servidor.',
      });
    } finally {
      setSmtpTesting(false);
    }
  };

  const handleSaveSmtpConfig = () => {
    const merged = { ...PortalService.loadEmailConfig(), ...smtpConfig };
    setSmtpConfig(merged);
    PortalService.saveEmailConfig(merged);
    setShowSmtpModal(false);
  };

  const handleOpenMailClientForSupervisor = (supName: string, email: string) => {
    const deadlineTxt = currentDispersal?.limiteLiberacion
      ? `Fecha límite de liberación: ${new Date(currentDispersal.limiteLiberacion).toLocaleString()}\n\n`
      : '';
    const subject = encodeURIComponent(
      `[CemenQtime] Nómina Semana ${semanaNumero} Dispersada — Lista ${supName}`
    );
    const body = encodeURIComponent(
      `Hola ${supName},\n\n` +
        `El área de Recursos Humanos / Nóminas ha dispersado tu lista de asistencia correspondiente a la Semana ${semanaNumero} (${semanaPeriodo.replace(
          '|',
          ' al '
        )}).\n\n` +
        `${deadlineTxt}` +
        `${dispersalMessage ? `Nota de RH: ${dispersalMessage}\n\n` : ''}` +
        `Por favor ingresa al portal CemenQtime para revisar tus colaboradores, registrar formatos de checada/permiso o confirmar faltas y liberar tu nómina dentro del plazo establecido.\n\n` +
        `Atentamente,\n${currentUser.name}`
    );
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  const handleDownloadFormatAttachment = (fileName: string, base64: string) => {
    try {
      const link = document.createElement('a');
      link.href = base64.startsWith('data:') ? base64 : `data:application/pdf;base64,${base64}`;
      link.download = fileName;
      link.click();
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Barra Superior de Dispersión y Acciones */}
      <div className="rounded-2xl p-5 sm:p-6 bg-white dark:bg-[#21222D] border border-slate-200 dark:border-white/[0.06] shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-teal-500/15 dark:bg-[#A9DFD8]/15 border border-teal-500/35 dark:border-[#A9DFD8]/35 flex items-center justify-center text-teal-700 dark:text-[#A9DFD8] shrink-0">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Semáforo y Dispersión — Semana {semanaNumero}
              </h3>
              {isGlobalCancelled ? (
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/35 flex items-center gap-1">
                  <Ban className="w-3 h-3" /> Dispersión Cancelada
                </span>
              ) : dispersedListsCount === totalSupervisores && totalSupervisores > 0 ? (
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-teal-500/15 text-teal-700 dark:text-[#A9DFD8] border border-teal-500/35 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Todas Dispersadas ({dispersedListsCount}/{totalSupervisores})
                </span>
              ) : dispersedListsCount > 0 ? (
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-700 dark:text-[#20AEF3] border border-sky-500/35">
                  {dispersedListsCount} de {totalSupervisores} dispersadas
                </span>
              ) : null}
            </div>
            <p className="text-xs text-slate-500 dark:text-[#87888C] mt-0.5">
              Supervisa el avance de los supervisores, cancela nóminas o dispersa con temporizador y alertas automáticas por correo.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Botón Configurar Correo SMTP (solo usuarios con permiso smtp_correo) */}
          {canEditSmtp && (
            <button
              type="button"
              onClick={() => {
                setSmtpConfig(PortalService.loadEmailConfig());
                setShowSmtpModal(true);
              }}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#171821] dark:hover:bg-[#2B2B36] text-slate-700 dark:text-[#E8E8EA] border border-slate-300 dark:border-white/[0.08] text-xs font-bold transition-all cursor-pointer"
              title="Configurar servidor SMTP / credenciales para envío automático de correo"
            >
              <Key className="w-3.5 h-3.5 text-amber-500 dark:text-[#FEB95A]" />
              <span>Configurar Correo</span>
            </button>
          )}

          {onOpenContpaqiModule && (
            <button
              type="button"
              onClick={onOpenContpaqiModule}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#171821] dark:hover:bg-[#2B2B36] text-teal-700 dark:text-[#A9DFD8] border border-teal-300 dark:border-[#A9DFD8]/35 text-xs font-bold transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-teal-600 dark:text-[#A9DFD8]" />
              <span>Ir a CONTPAQi®</span>
            </button>
          )}

          {/* Botón Cancelar Dispersión (si hay listas dispersadas en la semana) */}
          {dispersedListsCount > 0 && onCancelDispersal && (
            <button
              type="button"
              onClick={() => handleOpenCancelModal('all')}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-100 dark:hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/35 text-xs font-bold transition-all cursor-pointer"
              title="Cancelar la dispersión de nómina de esta semana"
            >
              <Ban className="w-4 h-4 text-rose-500" />
              <span>Cancelar Dispersión</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setDispersalDialogMode('by_list');
              setShowDispersalDialog(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#171821] dark:hover:bg-[#2B2B36] text-sky-700 dark:text-[#20AEF3] border border-sky-300 dark:border-[#20AEF3]/35 text-xs font-bold transition-all cursor-pointer"
          >
            <ListChecks className="w-4 h-4 text-sky-600 dark:text-[#20AEF3]" />
            <span>Dispersar por Lista</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setDispersalDialogMode('all');
              setShowDispersalDialog(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-500 dark:bg-[#A9DFD8] hover:bg-teal-600 dark:hover:bg-[#95d2ca] text-white dark:text-[#171821] text-xs font-extrabold transition-all shadow-md shadow-teal-500/15 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Dispersar Todas ({totalSupervisores})</span>
          </button>
        </div>
      </div>

      {/* Tablero Semáforo Resumen estilo Bento */}
      <div className="rounded-2xl p-5 sm:p-6 bg-white dark:bg-[#21222D] border border-slate-200 dark:border-white/[0.06] shadow-lg transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 dark:bg-[#20AEF3]/15 border border-sky-500/35 dark:border-[#20AEF3]/35 flex items-center justify-center text-sky-600 dark:text-[#20AEF3]">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Estado Global de Liberación — Semana {semanaNumero}
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#87888C]">
                Período activo: <span className="font-mono text-slate-800 dark:text-[#E8E8EA]">{semanaPeriodo || 'Semana Activa'}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Dropdown accesible para filtrar por Supervisor */}
            <div className="w-56">
              <HeadlessSelect
                value={filterSupervisor}
                onChange={setFilterSupervisor}
                options={supervisorFilterOptions}
                searchable={supervisors.length > 4}
                placeholder="Todas las listas"
              />
            </div>

            {/* Dropdown accesible para filtrar por estatus */}
            <div className="w-48">
              <HeadlessSelect
                value={filterStatus}
                onChange={(val) => setFilterStatus(val as 'todos' | 'liberado' | 'pendiente')}
                options={statusFilterOptions}
                placeholder="Todos los estatus"
              />
            </div>
          </div>
        </div>

        {/* 4 Sub-tarjetas Bento con Temporizador integrado */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-5">
          {/* Sub-tarjeta 1: Liberadas */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.04] flex flex-col justify-between">
            <div className="w-8 h-8 rounded-lg bg-teal-500/15 dark:bg-[#A9DFD8]/15 border border-teal-500/30 dark:border-[#A9DFD8]/30 flex items-center justify-center text-teal-700 dark:text-[#A9DFD8] mb-3">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                {liberadosCount} / {totalSupervisores}
              </p>
              <p className="text-xs font-bold text-slate-700 dark:text-[#E8E8EA] mt-1">Nóminas Liberadas</p>
              <p className="text-[10px] font-mono text-teal-700 dark:text-[#A9DFD8] mt-1">
                {porcentajeLiberacion}% de avance total
              </p>
            </div>
          </div>

          {/* Sub-tarjeta 2: Dispersadas vs Canceladas */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.04] flex flex-col justify-between">
            <div className="w-8 h-8 rounded-lg bg-sky-500/15 dark:bg-[#20AEF3]/15 border border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-[#20AEF3] mb-3">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                {dispersedListsCount} / {totalSupervisores}
              </p>
              <p className="text-xs font-bold text-slate-700 dark:text-[#E8E8EA] mt-1">Listas Dispersadas</p>
              <p className="text-[10px] font-mono text-sky-700 dark:text-[#20AEF3] mt-1">
                {isGlobalCancelled ? '⚠️ Dispersión cancelada' : 'Notificadas a supervisores'}
              </p>
            </div>
          </div>

          {/* Sub-tarjeta 3: Temporizador y Plazo de Liberación */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.04] flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 dark:bg-[#FEB95A]/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-[#FEB95A]">
                <Clock className="w-4 h-4" />
              </div>
              <DispersalCountdownTimer
                limiteLiberacion={currentDispersal?.limiteLiberacion}
                isReleased={liberadosCount === totalSupervisores && totalSupervisores > 0}
                isCancelled={isGlobalCancelled}
                compact
              />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                {pendientesCount}
              </p>
              <p className="text-xs font-bold text-slate-700 dark:text-[#E8E8EA] mt-1">Pendientes por Liberar</p>
              <p className="text-[10px] font-mono text-amber-700 dark:text-[#FEB95A] mt-1">
                {overdueCount > 0 ? `⚠️ ${overdueCount} fuera de plazo` : 'Dentro del plazo'}
              </p>
            </div>
          </div>

          {/* Sub-tarjeta 4: Alertas por Validar */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.04] flex flex-col justify-between">
            <div className="w-8 h-8 rounded-lg bg-purple-500/15 dark:bg-[#F2C8ED]/15 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-[#F2C8ED] mb-3">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                {supervisorStats.reduce((sum, s) => sum + s.alertasCount, 0)}
              </p>
              <p className="text-xs font-bold text-slate-700 dark:text-[#E8E8EA] mt-1">Alertas por Validar</p>
              <p className="text-[10px] font-mono text-purple-700 dark:text-[#F2C8ED] mt-1">
                Checadas / incidencias en revisión
              </p>
            </div>
          </div>
        </div>

        {/* Tabla Detallada por Supervisor */}
        <div className="mt-6 space-y-3">
          {filteredStats.map((st) => (
            <div
              key={st.name}
              className="p-4 rounded-2xl bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.06] flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-all"
            >
              {/* Información del Supervisor y estado */}
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {st.name}
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-[#21222D] text-slate-700 dark:text-[#87888C]">
                    {st.empleadosCount} colaboradores
                  </span>
                  {st.status === 'liberado' ? (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-teal-50 dark:bg-[#A9DFD8]/15 text-teal-700 dark:text-[#A9DFD8] border border-teal-200 dark:border-[#A9DFD8]/35 flex items-center gap-1 font-mono">
                      <CheckCircle2 className="w-3 h-3" /> LIBERADA ✓
                    </span>
                  ) : st.isCancelled ? (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/35 flex items-center gap-1 font-mono">
                      <Ban className="w-3 h-3" /> CANCELADA
                    </span>
                  ) : st.isListDispersed ? (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-sky-50 dark:bg-[#20AEF3]/15 text-sky-700 dark:text-[#20AEF3] border border-sky-200 dark:border-[#20AEF3]/35 flex items-center gap-1 font-mono">
                      <Send className="w-3 h-3" /> DISPERSADA (EN REVISIÓN)
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-slate-200 dark:bg-white/5 text-slate-600 dark:text-[#87888C] font-mono">
                      SIN DISPERSAR
                    </span>
                  )}

                  {/* Contador regresivo en vivo en cada fila */}
                  {st.isListDispersed && (
                    <DispersalCountdownTimer
                      limiteLiberacion={st.deadline}
                      isReleased={st.status === 'liberado'}
                      isCancelled={st.isCancelled}
                      compact
                    />
                  )}
                </div>

                <p className="text-xs text-slate-500 dark:text-[#87888C]">
                  Correo: <strong className="text-sky-600 dark:text-[#20AEF3]">{st.corporateEmail}</strong>
                  {st.fechaLiberacion ? ` · Liberada el: ${new Date(st.fechaLiberacion).toLocaleString()}` : ''}
                </p>

                {/* Resumen rápido de modificaciones */}
                <div className="flex items-center gap-3 text-[11px] font-mono flex-wrap pt-1 text-slate-600 dark:text-slate-300">
                  <span>H. Norm: <strong className="text-slate-900 dark:text-white">{st.horasNormales.toFixed(1)}h</strong></span>
                  <span>H. Extra: <strong className="text-amber-600 dark:text-[#FEB95A]">{st.horasExtras.toFixed(1)}h</strong></span>
                  <span>Alertas: <strong className={st.alertasCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}>{st.alertasCount}</strong></span>
                  {st.checadasAgregadasCount > 0 && (
                    <span className="text-sky-600 dark:text-[#20AEF3]">+{st.checadasAgregadasCount} checadas agregadas</span>
                  )}
                  {st.formatosAdjuntosCount > 0 && (
                    <span className="text-teal-600 dark:text-[#A9DFD8]">+{st.formatosAdjuntosCount} formatos sin gafete</span>
                  )}
                </div>
              </div>

              {/* Botones de acción por supervisor */}
              <div className="flex items-center gap-2 flex-wrap self-end lg:self-center shrink-0">
                {st.isListDispersed && st.status !== 'liberado' && onCancelDispersal && (
                  <button
                    type="button"
                    onClick={() => handleOpenCancelModal(st.name)}
                    className="px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-100 dark:hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/30 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    title={`Cancelar dispersión de ${st.name}`}
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Cancelar</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onInspectSupervisor(st.name)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#21222D] dark:hover:bg-[#2B2B36] text-slate-800 dark:text-white border border-slate-300 dark:border-white/[0.08] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-sky-500 dark:text-[#20AEF3]" />
                  <span>Auditar</span>
                </button>

                <button
                  type="button"
                  onClick={() => onDownloadExcel(st.name)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#21222D] dark:hover:bg-[#2B2B36] text-slate-800 dark:text-white border border-slate-300 dark:border-white/[0.08] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-teal-600 dark:text-[#A9DFD8]" />
                  <span>Excel</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDisperseSingleList(st.name)}
                  className="px-3.5 py-1.5 rounded-xl bg-teal-500 dark:bg-[#A9DFD8] hover:bg-teal-600 dark:hover:bg-[#95d2ca] text-white dark:text-[#171821] text-xs font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{st.isListDispersed ? 'Re-Notificar' : 'Dispersar'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* =========================================================================
       * MODAL 1: Dispersión con Temporizador Configurable y Envío de Correo
       * ========================================================================= */}
      {showDispersalDialog && (
        <HeadlessModal
          isOpen={showDispersalDialog}
          onClose={() => setShowDispersalDialog(false)}
          maxWidth="max-w-2xl"
          title={
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/15 dark:bg-[#A9DFD8]/15 border border-teal-500/35 dark:border-[#A9DFD8]/35 flex items-center justify-center text-teal-600 dark:text-[#A9DFD8] shrink-0">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {dispersalDialogMode === 'by_list'
                    ? `Dispersar Nómina por Lista — Semana ${semanaNumero}`
                    : `Dispersar Todas las Listas — Semana ${semanaNumero}`}
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#87888C]">
                  Configura el temporizador de liberación y el envío automático de notificaciones
                </p>
              </div>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Selector de modo */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => setDispersalDialogMode('by_list')}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  dispersalDialogMode === 'by_list'
                    ? 'bg-teal-500 dark:bg-[#A9DFD8] text-white dark:text-[#171821] shadow'
                    : 'text-slate-600 dark:text-[#87888C] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ListChecks className="w-4 h-4" />
                <span>Lista por Lista</span>
              </button>
              <button
                type="button"
                onClick={() => setDispersalDialogMode('all')}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  dispersalDialogMode === 'all'
                    ? 'bg-teal-500 dark:bg-[#A9DFD8] text-white dark:text-[#171821] shadow'
                    : 'text-slate-600 dark:text-[#87888C] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Send className="w-4 h-4" />
                <span>Dispersar Todas ({totalSupervisores})</span>
              </button>
            </div>

            {/* Configuración del Temporizador / Plazo de Liberación */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#171821] border border-sky-300 dark:border-sky-500/30 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-sky-500 dark:text-[#20AEF3]" />
                  <span>Plazo Límite para que Supervisores Liberen:</span>
                </span>
                {calculatedDeadlineISO && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-sky-50 dark:bg-[#20AEF3]/15 text-sky-700 dark:text-[#20AEF3] border border-sky-200 dark:border-[#20AEF3]/30">
                    Límite: {new Date(calculatedDeadlineISO).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, {new Date(calculatedDeadlineISO).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>

              {canEditTimeLimit ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                    {[
                      { id: '12', label: '12 Horas' },
                      { id: '24', label: '24 Horas' },
                      { id: '48', label: '48 Horas' },
                      { id: 'custom', label: 'Fecha/Hora' },
                      { id: 'none', label: 'Sin límite' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setTimerHoursPreset(opt.id as any)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          timerHoursPreset === opt.id
                            ? 'bg-sky-500 dark:bg-[#20AEF3] text-white dark:text-[#171821] border-sky-500 dark:border-[#20AEF3] shadow-sm'
                            : 'bg-white dark:bg-[#21222D] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {timerHoursPreset === 'custom' && (
                    <div className="pt-1">
                      <input
                        type="datetime-local"
                        value={customDeadlineTime}
                        onChange={(e) => setCustomDeadlineTime(e.target.value)}
                        className="w-full text-xs rounded-xl px-3 py-2 bg-white dark:bg-[#21222D] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white outline-none focus:border-sky-500 font-mono"
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[11px] text-slate-600 dark:text-slate-300 bg-white dark:bg-[#21222D] px-3 py-2 rounded-lg border border-slate-200 dark:border-white/[0.08]">
                  Plazo oficial establecido por Administración: <strong className="font-mono text-sky-600 dark:text-[#20AEF3]">{defaultHorasLimite} horas</strong> (Solicita permiso de <em>Tiempo Límite Lista</em> para modificarlo).
                </div>
              )}
            </div>

            {/* Checkbox de Envío por Correo Electrónico Empresarial */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.06] space-y-2">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-teal-600 dark:text-[#A9DFD8] shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">
                      Enviar Notificación por Correo Electrónico + Campana en Sistema
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-[#87888C]">
                      Envía en automático el aviso formal con el temporizador a cada supervisor.
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={sendEmailOnDisperse}
                  onChange={(e) => setSendEmailOnDisperse(e.target.checked)}
                  className="w-4 h-4 accent-teal-500 rounded cursor-pointer"
                />
              </label>

              {/* Acceso rápido a credenciales SMTP */}
              <div className="pt-1 border-t border-slate-200/80 dark:border-white/[0.04] flex items-center justify-between text-[11px]">
                <span className="text-slate-500 dark:text-[#87888C]">
                  Remitente SMTP: <strong className="text-slate-800 dark:text-[#E8E8EA]">{smtpConfig.smtpUser}</strong>{' '}
                  {smtpConfig.smtpPass ? (
                    <span className="text-teal-600 dark:text-[#A9DFD8] font-bold">(Listo ✓)</span>
                  ) : (
                    <span className="text-amber-600 dark:text-[#FEB95A]">(Sin clave SMTP)</span>
                  )}
                </span>
                {canEditSmtp ? (
                  <button
                    type="button"
                    onClick={() => setShowSmtpModal(true)}
                    className="text-xs font-bold text-teal-600 dark:text-[#A9DFD8] hover:underline cursor-pointer"
                  >
                    Editar Credenciales
                  </button>
                ) : (
                  <span className="text-[10px] font-mono text-slate-400">Configurado por Admin</span>
                )}
              </div>
            </div>

            {/* Instrucciones o Mensaje de Nóminas */}
            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-[#87888C] block mb-1.5">
                Instrucciones o Mensaje para el Supervisor:
              </label>
              <textarea
                rows={2}
                value={dispersalMessage}
                onChange={(e) => setDispersalMessage(e.target.value)}
                placeholder="Ej: Favor de validar checadas faltantes, subir formatos y liberar antes del cierre de nómina..."
                className="w-full rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white outline-none focus:border-teal-500 placeholder:text-slate-400 dark:placeholder:text-[#87888C] resize-none text-xs"
              />
            </div>

            {/* Lista por lista o Todas */}
            {dispersalDialogMode === 'by_list' ? (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {supervisorStats.map((st) => (
                  <div
                    key={st.name}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{st.name}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-[#21222D] text-slate-700 dark:text-[#87888C]">
                          {st.empleadosCount} colab.
                        </span>
                        {st.isListDispersed && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-50 dark:bg-[#A9DFD8]/15 text-teal-700 dark:text-[#A9DFD8] border border-teal-200 dark:border-[#A9DFD8]/35">
                            Dispersada ✓
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-[#87888C] font-mono mt-0.5">
                        Correo: <strong className="text-sky-600 dark:text-[#20AEF3]">{st.corporateEmail}</strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenMailClientForSupervisor(st.name, st.corporateEmail)}
                        className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#21222D] text-amber-700 dark:text-[#FEB95A] border border-slate-200 dark:border-white/[0.08] text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Mail className="w-3 h-3" />
                        <span>Abrir Correo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDisperseSingleList(st.name)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all bg-teal-500 dark:bg-[#A9DFD8] hover:bg-teal-600 dark:hover:bg-[#95d2ca] text-white dark:text-[#171821]"
                      >
                        <Send className="w-3 h-3" />
                        <span>{st.isListDispersed ? 'Re-Notificar' : 'Dispersar'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.06] space-y-2">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-[#87888C] block">
                  Supervisores que recibirán su lista ({supervisorStats.length}):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {supervisorStats.map((st) => (
                    <div
                      key={st.name}
                      className="p-2 rounded-xl bg-white dark:bg-[#21222D] border border-slate-200 dark:border-white/[0.06] text-[11px] flex items-center justify-between gap-2"
                    >
                      <div className="truncate">
                        <strong className="text-slate-900 dark:text-white block truncate">{st.name}</strong>
                        <span className="text-slate-500 dark:text-[#87888C] font-mono text-[10px] truncate block">
                          {st.corporateEmail}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-50 dark:bg-[#20AEF3]/15 text-sky-700 dark:text-[#20AEF3] shrink-0">
                        {st.empleadosCount} emp.
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Acciones del footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => setShowDispersalDialog(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 dark:text-[#87888C] hover:text-slate-800 dark:hover:text-white cursor-pointer"
              >
                Cerrar
              </button>

              {dispersalDialogMode === 'all' && (
                <button
                  type="button"
                  onClick={handleConfirmDisperseAll}
                  className="px-5 py-2.5 rounded-xl bg-teal-500 dark:bg-[#A9DFD8] hover:bg-teal-600 dark:hover:bg-[#95d2ca] text-white dark:text-[#171821] text-xs font-extrabold flex items-center gap-2 shadow-md cursor-pointer transition-all"
                >
                  <Send className="w-4 h-4" />
                  <span>Confirmar y Dispersar Todas ({totalSupervisores})</span>
                </button>
              )}
            </div>
          </div>
        </HeadlessModal>
      )}

      {/* =========================================================================
       * MODAL 2: Cancelación de Dispersión de Nómina
       * ========================================================================= */}
      {showCancelDialog && (
        <HeadlessModal
          isOpen={showCancelDialog}
          onClose={() => setShowCancelDialog(false)}
          maxWidth="max-w-md"
          title={
            <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
              <Ban className="w-5 h-5 shrink-0" />
              <span className="font-bold text-base text-slate-900 dark:text-white">
                Cancelar Nómina Dispersada
              </span>
            </div>
          }
          subtitle={`Semana ${semanaNumero} — ${
            cancelTarget === 'all' ? 'Todas las listas' : `Lista de ${cancelTarget}`
          }`}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Al cancelar la dispersión, la nómina quedará bloqueada para que el supervisor no pueda liberarla y se enviará un aviso de cancelación en el sistema.
            </p>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
                Motivo de la Cancelación:
              </label>
              <textarea
                rows={3}
                value={cancelMotivo}
                onChange={(e) => setCancelMotivo(e.target.value)}
                placeholder="Ej: No trabajó su nómina / Corrección solicitada por Dirección antes del cálculo final..."
                className="w-full text-xs rounded-xl p-3 bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white outline-none focus:border-rose-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => setShowCancelDialog(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelDispersal}
                className="px-4 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider bg-rose-600 hover:bg-rose-500 text-white shadow-md cursor-pointer transition-all flex items-center gap-1.5"
              >
                <Ban className="w-4 h-4" />
                <span>Confirmar Cancelación</span>
              </button>
            </div>
          </div>
        </HeadlessModal>
      )}

      {/* =========================================================================
       * MODAL 3: Configuración de Correo SMTP (Gmail / Corporativo)
       * ========================================================================= */}
      {showSmtpModal && (
        <HeadlessModal
          isOpen={showSmtpModal}
          onClose={() => setShowSmtpModal(false)}
          maxWidth="max-w-lg"
          title={
            <div className="flex items-center gap-2.5 text-teal-600 dark:text-[#A9DFD8]">
              <Mail className="w-5 h-5 shrink-0" />
              <span className="font-bold text-base text-slate-900 dark:text-white">
                Configuración de Servidor de Correo (SMTP / Gmail)
              </span>
            </div>
          }
          subtitle="Conecta el correo que le configura el administrador a Nóminas para enviar las alertas automáticas"
        >
          <div className="space-y-3.5">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
                Correo Remitente de Nóminas *
              </label>
              <input
                type="email"
                value={smtpConfig.smtpUser || ''}
                onChange={(e) => setSmtpConfig((prev) => ({ ...prev, smtpUser: e.target.value }))}
                placeholder="ej: nominas@empresa.com o tu_correo@gmail.com"
                className="w-full text-xs rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white outline-none focus:border-teal-500 font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
                Contraseña / Contraseña de Aplicación (App Password) *
              </label>
              <input
                type="password"
                value={smtpConfig.smtpPass || ''}
                onChange={(e) => setSmtpConfig((prev) => ({ ...prev, smtpPass: e.target.value }))}
                placeholder="Si usas Gmail, usa la Contraseña de Aplicación de 16 caracteres"
                className="w-full text-xs rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white outline-none focus:border-teal-500 font-mono"
              />
              <p className="text-[10px] text-slate-500 dark:text-[#87888C] mt-1">
                Para Gmail o Google Workspace: ve a Tu Cuenta Google &gt; Seguridad &gt; Verificación en 2 pasos &gt; Contraseñas de aplicaciones.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
                  Servidor SMTP
                </label>
                <input
                  type="text"
                  value={smtpConfig.smtpHost || ''}
                  onChange={(e) => setSmtpConfig((prev) => ({ ...prev, smtpHost: e.target.value }))}
                  placeholder="smtp.gmail.com"
                  className="w-full text-xs rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white outline-none focus:border-teal-500 font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
                  Puerto SMTP
                </label>
                <input
                  type="number"
                  value={smtpConfig.smtpPort || 587}
                  onChange={(e) => setSmtpConfig((prev) => ({ ...prev, smtpPort: Number(e.target.value) || 587 }))}
                  placeholder="587 o 465"
                  className="w-full text-xs rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#171821] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white outline-none focus:border-teal-500 font-mono"
                />
              </div>
            </div>

            {smtpTestResult && (
              <div
                className={`p-3 rounded-xl border text-xs font-semibold flex items-start gap-2 ${
                  smtpTestResult.ok
                    ? 'bg-teal-50 dark:bg-[#A9DFD8]/15 border-teal-200 dark:border-[#A9DFD8]/40 text-teal-800 dark:text-[#A9DFD8]'
                    : 'bg-rose-50 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-400'
                }`}
              >
                {smtpTestResult.ok ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span>{smtpTestResult.message}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-white/[0.06]">
              <button
                type="button"
                onClick={handleTestSmtpConnection}
                disabled={smtpTesting || !smtpConfig.smtpUser || !smtpConfig.smtpPass}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#171821] dark:hover:bg-[#2B2B36] text-sky-700 dark:text-[#20AEF3] border border-sky-300 dark:border-[#20AEF3]/35 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
              >
                {smtpTesting ? (
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>{smtpTesting ? 'Probando...' : 'Probar Conexión'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSmtpModal(false)}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-slate-500 dark:text-[#87888C] hover:text-slate-800 dark:hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveSmtpConfig}
                  className="px-4 py-2 rounded-xl bg-teal-500 dark:bg-[#A9DFD8] hover:bg-teal-600 dark:hover:bg-[#95d2ca] text-white dark:text-[#171821] text-xs font-extrabold cursor-pointer"
                >
                  Guardar Credenciales
                </button>
              </div>
            </div>
          </div>
        </HeadlessModal>
      )}
    </div>
  );
};
