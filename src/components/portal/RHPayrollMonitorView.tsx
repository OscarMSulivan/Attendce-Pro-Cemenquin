/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
  X
} from 'lucide-react';
import { PayrollDispersal, PayrollRelease, PortalUser, getUserAllowedLists } from '../../types/portal';
import { EmpleadoProcesado } from '../../types/attendance';

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
    sendCorporateEmail?: boolean
  ) => void;
  onDownloadSupervisorReturnedExcel: (fileName: string, base64: string) => void;
  onUpdateReleaseStatus?: (releaseId: string, status: 'pendiente' | 'en_revision' | 'liberado') => void;
  onOpenContpaqiModule?: () => void;
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
  onDownloadSupervisorReturnedExcel,
  onOpenContpaqiModule,
}) => {
  const [dispersalMessage, setDispersalMessage] = useState('');
  const [showDispersalDialog, setShowDispersalDialog] = useState(false);
  const [dispersalDialogMode, setDispersalDialogMode] = useState<'all' | 'by_list'>('all');
  const [sendEmailOnDisperse, setSendEmailOnDisperse] = useState(true);
  const [filterSupervisor, setFilterSupervisor] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'liberado' | 'pendiente'>('todos');

  // Buscar si esta semana ya fue dispersada
  const currentDispersal = dispersals.find((d) => d.semanaNumero === semanaNumero);
  const notifiedListsSet = new Set(
    (currentDispersal?.supervisoresNotificados || []).map(s => s.trim().toUpperCase())
  );

  // Calcular métricas por supervisor en tiempo real a partir de los datos procesados
  const supervisorStats = useMemo(() => {
    return supervisors.map((supName) => {
      const supEmployees = empleados.filter((e) => e.supervisor === supName);
      const releaseKey = `${semanaNumero}_${supName}`;
      const release = releases[releaseKey];
      const matchedUser = users.find(
        u => u.role === 'supervisor' && getUserAllowedLists(u).includes(supName.toUpperCase())
      );
      const corporateEmail =
        matchedUser?.email || `${supName.toLowerCase().replace(/\s+/g, '.')}@empresa.com`;
      const isListDispersed = notifiedListsSet.has(supName.trim().toUpperCase());

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

      return {
        name: supName,
        corporateEmail,
        isListDispersed,
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
      };
    });
  }, [supervisors, empleados, semanaNumero, releases, users, notifiedListsSet]);

  const filteredSupervisorStats = useMemo(() => {
    return supervisorStats.filter(st => {
      if (filterSupervisor && st.name !== filterSupervisor) return false;
      if (filterStatus === 'liberado' && st.status !== 'liberado') return false;
      if (filterStatus === 'pendiente' && st.status === 'liberado') return false;
      return true;
    });
  }, [supervisorStats, filterSupervisor, filterStatus]);

  const handleDownloadFormatAttachment = (fileName: string, base64: string) => {
    try {
      const link = document.createElement('a');
      link.href = base64;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error al descargar formato adjunto:', err);
    }
  };

  const totalSupervisores = supervisorStats.length;
  const dispersedListsCount = supervisorStats.filter((s) => s.isListDispersed).length;
  const liberadosCount = supervisorStats.filter((s) => s.status === 'liberado').length;
  const pendientesCount = totalSupervisores - liberadosCount;
  const porcentajeLiberacion = totalSupervisores > 0
    ? Math.round((liberadosCount / totalSupervisores) * 100)
    : 0;

  const handleConfirmDisperseAll = () => {
    onDisperseWeek(semanaNumero, semanaPeriodo, dispersalMessage, supervisors, sendEmailOnDisperse);
    setShowDispersalDialog(false);
    setDispersalMessage('');
  };

  const handleDisperseSingleList = (supName: string) => {
    onDisperseWeek(semanaNumero, semanaPeriodo, dispersalMessage, [supName], sendEmailOnDisperse);
  };

  const handleOpenMailClientForSupervisor = (supName: string, email: string) => {
    const subject = encodeURIComponent(
      `[AttendancePRO] Nómina Semana ${semanaNumero} Dispersada — Lista ${supName}`
    );
    const body = encodeURIComponent(
      `Hola ${supName},\n\n` +
      `El área de Recursos Humanos / Nóminas ha dispersado tu lista de asistencia correspondiente a la Semana ${semanaNumero} (${semanaPeriodo.replace('|', ' al ')}).\n\n` +
      `${dispersalMessage ? `Nota de RH: ${dispersalMessage}\n\n` : ''}` +
      `Por favor ingresa al portal AttendancePRO para revisar tus colaboradores, registrar formatos de checada/permiso o confirmar faltas y liberar tu nómina.\n\n` +
      `Atentamente,\n${currentUser.name}`
    );
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Barra Superior de Dispersión y Acciones alineada al diseño #21222D / #171821 / #A9DFD8 */}
      <div className="rounded-2xl p-5 sm:p-6 bg-[#21222D] border border-white/[0.06] shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#A9DFD8]/15 border border-[#A9DFD8]/35 flex items-center justify-center text-[#A9DFD8] shrink-0">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Semáforo y Dispersión — Semana {semanaNumero}
              </h3>
              {dispersedListsCount === totalSupervisores && totalSupervisores > 0 ? (
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-[#A9DFD8]/15 text-[#A9DFD8] border border-[#A9DFD8]/35 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Todas Dispersadas ({dispersedListsCount}/{totalSupervisores})
                </span>
              ) : dispersedListsCount > 0 ? (
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-[#20AEF3]/15 text-[#20AEF3] border border-[#20AEF3]/35 flex items-center gap-1">
                  <ListChecks className="w-3 h-3" /> Parcial: {dispersedListsCount} de {totalSupervisores} Listas
                </span>
              ) : (
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-[#FEB95A]/15 text-[#FEB95A] border border-[#FEB95A]/35">
                  Sin Dispersar
                </span>
              )}
            </div>
            <p className="text-xs text-[#87888C] mt-0.5">
              {currentDispersal ? (
                <span>
                  Última dispersión por <strong className="text-white">{currentDispersal.dispersadoPor}</strong> el{' '}
                  {new Date(currentDispersal.fechaDispersion).toLocaleString('es-MX')} (Sistema + Correo Empresarial).
                </span>
              ) : (
                <span>
                  Monitorea el avance de revisión de cada supervisor y dispersa listas de forma individual o masiva.
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {onOpenContpaqiModule && (
            <button
              type="button"
              onClick={onOpenContpaqiModule}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#171821] hover:bg-[#2B2B36] text-[#A9DFD8] border border-[#A9DFD8]/35 text-xs font-bold transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#A9DFD8]" />
              <span>Ir a CONTPAQi®</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setDispersalDialogMode('by_list');
              setShowDispersalDialog(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#171821] hover:bg-[#2B2B36] text-[#20AEF3] border border-[#20AEF3]/35 text-xs font-bold transition-all cursor-pointer"
          >
            <ListChecks className="w-4 h-4 text-[#20AEF3]" />
            <span>Dispersar por Lista</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setDispersalDialogMode('all');
              setShowDispersalDialog(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#A9DFD8] hover:bg-[#95d2ca] text-[#171821] text-xs font-extrabold transition-all shadow-md shadow-[#A9DFD8]/15 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Dispersar Todas ({totalSupervisores})</span>
          </button>
        </div>
      </div>

      {/* Tablero Semáforo Resumen estilo "Today's Sales" Bento */}
      <div className="rounded-2xl p-5 sm:p-6 bg-[#21222D] border border-white/[0.06] shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#20AEF3]/15 border border-[#20AEF3]/35 flex items-center justify-center text-[#20AEF3]">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Estado Global de Liberación — Semana {semanaNumero}
              </h2>
              <p className="text-xs text-[#87888C]">
                Período activo: <span className="font-mono text-[#E8E8EA]">{semanaPeriodo || 'Semana Activa'}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Dropdown List para filtrar por Supervisor */}
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#20AEF3] shrink-0" />
              <select
                value={filterSupervisor}
                onChange={(e) => setFilterSupervisor(e.target.value)}
                className="rounded-xl px-3 py-2 text-xs bg-[#171821] border border-white/[0.08] text-white outline-none focus:border-[#A9DFD8] cursor-pointer"
              >
                <option value="">Todas las Listas ({totalSupervisores})</option>
                {supervisors.map(sup => (
                  <option key={sup} value={sup}>
                    {sup}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro por estatus */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'todos' | 'liberado' | 'pendiente')}
              className="rounded-xl px-3 py-2 text-xs bg-[#171821] border border-white/[0.08] text-white outline-none focus:border-[#A9DFD8] cursor-pointer"
            >
              <option value="todos">Todos los estatus</option>
              <option value="liberado">Solo Liberadas ({liberadosCount})</option>
              <option value="pendiente">Solo Pendientes ({pendientesCount})</option>
            </select>
          </div>
        </div>

        {/* 4 Sub-tarjetas oscuras (#171821) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-5">
          <div className="p-4 rounded-xl bg-[#171821] border border-white/[0.04] flex flex-col justify-between">
            <div className="w-8 h-8 rounded-lg bg-[#A9DFD8]/15 border border-[#A9DFD8]/30 flex items-center justify-center text-[#A9DFD8] mb-3">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-white">
                {liberadosCount} / {totalSupervisores}
              </p>
              <p className="text-xs font-medium text-[#E8E8EA] mt-1">Nóminas Liberadas</p>
              <p className="text-[10px] font-mono text-[#A9DFD8] mt-1">
                {porcentajeLiberacion}% de avance total
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#171821] border border-white/[0.04] flex flex-col justify-between">
            <div className="w-8 h-8 rounded-lg bg-[#FEB95A]/15 border border-[#FEB95A]/30 flex items-center justify-center text-[#FEB95A] mb-3">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-white">
                {pendientesCount}
              </p>
              <p className="text-xs font-medium text-[#E8E8EA] mt-1">Pendientes de Revisión</p>
              <p className="text-[10px] font-mono text-[#FEB95A] mt-1">
                En espera de supervisor
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#171821] border border-white/[0.04] flex flex-col justify-between">
            <div className="w-8 h-8 rounded-lg bg-[#20AEF3]/15 border border-[#20AEF3]/30 flex items-center justify-center text-[#20AEF3] mb-3">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-white">
                {dispersedListsCount} / {totalSupervisores}
              </p>
              <p className="text-xs font-medium text-[#E8E8EA] mt-1">Listas Dispersadas</p>
              <p className="text-[10px] font-mono text-[#20AEF3] mt-1">
                Notificadas en sistema y correo
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#171821] border border-white/[0.04] flex flex-col justify-between">
            <div className="w-8 h-8 rounded-lg bg-[#F2C8ED]/15 border border-[#F2C8ED]/30 flex items-center justify-center text-[#F2C8ED] mb-3">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-white">
                {supervisorStats.reduce((sum, s) => sum + s.alertasCount, 0)}
              </p>
              <p className="text-xs font-medium text-[#E8E8EA] mt-1">Alertas por Validar</p>
              <p className="text-[10px] font-mono text-[#F2C8ED] mt-1">
                Checadas / incidencias detectadas
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tarjetas por cada Supervisor */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#87888C]">
            Detalle por Lista de Supervisor ({filteredSupervisorStats.length})
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-3.5">
          {filteredSupervisorStats.map((stat) => (
            <div
              key={stat.name}
              className={`p-5 rounded-2xl border transition-all flex flex-col gap-4 ${
                stat.status === 'liberado'
                  ? 'bg-[#21222D] border-[#A9DFD8]/40 shadow-lg'
                  : 'bg-[#21222D] border-white/[0.06] hover:border-white/[0.12]'
              }`}
            >
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  {/* Indicador Semáforo */}
                  <div
                    className={`w-3.5 h-3.5 rounded-full mt-1.5 shrink-0 ${
                      stat.status === 'liberado'
                        ? 'bg-[#A9DFD8] shadow-[0_0_10px_#A9DFD8]'
                        : stat.status === 'en_revision'
                        ? 'bg-[#FEB95A] shadow-[0_0_10px_#FEB95A]'
                        : 'bg-rose-500 shadow-[0_0_10px_#f43f5e]'
                    }`}
                  />

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm sm:text-base font-bold text-white">{stat.name}</h4>
                      {stat.isListDispersed ? (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-[#20AEF3]/15 text-[#20AEF3] border border-[#20AEF3]/35 flex items-center gap-1">
                          <Bell className="w-3 h-3" /> Dispersada ✓
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-[#171821] text-[#87888C] border border-white/[0.06]">
                          Sin Dispersar
                        </span>
                      )}

                      {stat.status === 'liberado' ? (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-[#A9DFD8]/15 text-[#A9DFD8] border border-[#A9DFD8]/35">
                          Liberada a RH ✓
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-[#FEB95A]/15 text-[#FEB95A] border border-[#FEB95A]/35">
                          Pendiente de Liberar
                        </span>
                      )}

                      {stat.checadasAgregadasCount > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#F2C8ED]/15 text-[#F2C8ED] border border-[#F2C8ED]/35">
                          {stat.checadasAgregadasCount} Checada(s) Supervisor
                        </span>
                      )}

                      {stat.formatosAdjuntosCount > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#A9DFD8]/15 text-[#A9DFD8] border border-[#A9DFD8]/35">
                          📎 {stat.formatosAdjuntosCount} Formato(s)
                        </span>
                      )}

                      {stat.faltasConfirmadasCount > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/35">
                          {stat.faltasConfirmadasCount} Falta(s) Confirmada(s)
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-[#87888C] mt-1 flex items-center gap-1.5 font-mono">
                      <Mail className="w-3 h-3 text-[#20AEF3]" />
                      <span>
                        Correo: <strong className="text-[#E8E8EA]">{stat.corporateEmail}</strong>
                      </span>
                    </p>

                    {stat.release?.fechaLiberacion && (
                      <p className="text-[11px] text-[#87888C] mt-0.5">
                        Liberado por:{' '}
                        <strong className="text-[#A9DFD8]">{stat.release.liberadoPor || stat.name}</strong> el{' '}
                        {new Date(stat.release.fechaLiberacion).toLocaleString('es-MX')}
                      </p>
                    )}

                    {stat.release?.comentariosSupervisor && (
                      <div className="mt-2 text-xs bg-[#171821] p-2.5 rounded-xl border border-white/[0.06] text-[#E8E8EA] flex items-start gap-2">
                        <MessageSquare className="w-3.5 h-3.5 text-[#20AEF3] shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[10px] font-bold text-[#87888C] block">
                            Comentarios del Supervisor:
                          </span>
                          <p className="italic">&ldquo;{stat.release.comentariosSupervisor}&rdquo;</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Métricas y Acciones */}
                <div className="flex flex-wrap items-center gap-3 sm:gap-5 self-end xl:self-center">
                  <div className="grid grid-cols-3 gap-2.5 text-center font-mono">
                    <div className="px-3 py-1.5 rounded-xl bg-[#171821] border border-white/[0.06]">
                      <span className="text-[9px] uppercase text-[#87888C] block">Colab.</span>
                      <span className="text-xs font-bold text-white tabular-nums">
                        {stat.empleadosCount}
                      </span>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-[#171821] border border-white/[0.06]">
                      <span className="text-[9px] uppercase text-[#87888C] block">H. Normal</span>
                      <span className="text-xs font-bold text-[#A9DFD8] tabular-nums">
                        {stat.horasNormales.toFixed(1)}
                      </span>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-[#171821] border border-white/[0.06]">
                      <span className="text-[9px] uppercase text-[#87888C] block">H. Extra</span>
                      <span className="text-xs font-bold text-[#FEB95A] tabular-nums">
                        {stat.horasExtras.toFixed(1)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleDisperseSingleList(stat.name)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        stat.isListDispersed
                          ? 'bg-[#171821] hover:bg-[#2B2B36] text-[#20AEF3] border border-[#20AEF3]/35'
                          : 'bg-[#20AEF3] hover:bg-[#1b9bd9] text-[#171821]'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{stat.isListDispersed ? 'Re-Dispersar' : 'Dispersar Lista'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onInspectSupervisor(stat.name)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#171821] hover:bg-[#2B2B36] text-[#E8E8EA] text-xs font-semibold transition-all border border-white/[0.08] cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#FEB95A]" />
                      <span>Ver Detalle</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDownloadExcel(stat.name)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#A9DFD8] hover:bg-[#95d2ca] text-[#171821] text-xs font-extrabold transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Descargar Excel</span>
                    </button>

                    {stat.release?.excelTrabajadoNombre && stat.release?.excelTrabajadoBase64 && (
                      <button
                        type="button"
                        onClick={() =>
                          onDownloadSupervisorReturnedExcel(
                            stat.release!.excelTrabajadoNombre!,
                            stat.release!.excelTrabajadoBase64!
                          )
                        }
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#171821] hover:bg-[#2B2B36] text-[#F2C8ED] border border-[#F2C8ED]/35 text-xs font-bold transition-all cursor-pointer"
                      >
                        <FileCheck className="w-3.5 h-3.5" />
                        <span>Excel Adjunto</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Detalle de Modificaciones del Supervisor */}
              {stat.modifiedDays.length > 0 && (
                <div className="pt-3 border-t border-white/[0.06]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#F2C8ED] block mb-2">
                    Bitácora de Modificaciones del Supervisor ({stat.modifiedDays.length}):
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {stat.modifiedDays.map((mod, idx) => (
                      <div
                        key={`${mod.empId}-${mod.fechaStr}-${idx}`}
                        className="p-3 rounded-xl bg-[#171821] border border-white/[0.06] flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-[#20AEF3]">#{mod.empId}</span>
                            <span className="font-semibold text-white truncate">{mod.empNombre}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#21222D] text-[#87888C] font-mono">
                              {mod.fechaStr}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#E8E8EA] flex items-center gap-2 flex-wrap">
                            {mod.tipoModificacion === 'falta_confirmada' ? (
                              <span className="text-rose-400 font-bold">Confirmó Falta</span>
                            ) : (
                              <span>
                                Checada: <strong className="text-[#F2C8ED] font-mono">{mod.entrada} - {mod.salida}</strong>
                              </span>
                            )}
                            <span className="text-[#A9DFD8] font-semibold">• {mod.incidencia}</span>
                          </div>
                          {mod.nota && (
                            <p className="text-[10px] text-[#87888C] italic truncate">
                              &ldquo;{mod.nota}&rdquo;
                            </p>
                          )}
                        </div>

                        {mod.formatoNombre && mod.formatoBase64 && (
                          <button
                            type="button"
                            onClick={() => handleDownloadFormatAttachment(mod.formatoNombre!, mod.formatoBase64!)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#A9DFD8]/15 hover:bg-[#A9DFD8]/25 text-[#A9DFD8] border border-[#A9DFD8]/35 text-[10px] font-bold flex items-center gap-1 shrink-0 transition-all cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            <span>Formato</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Modal de Dispersión con Portal */}
      {showDispersalDialog &&
        createPortal(
          <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-[#21222D] border border-white/[0.08] rounded-2xl w-full max-w-2xl shadow-2xl p-5 sm:p-6 space-y-4 animate-scale-in text-slate-100 my-auto">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#A9DFD8]/15 border border-[#A9DFD8]/35 flex items-center justify-center text-[#A9DFD8] shrink-0">
                    {dispersalDialogMode === 'by_list' ? (
                      <ListChecks className="w-5 h-5" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white">
                      {dispersalDialogMode === 'by_list'
                        ? `Dispersar Nómina por Lista — Semana ${semanaNumero}`
                        : `Dispersar Todas las Listas — Semana ${semanaNumero}`}
                    </h3>
                    <p className="text-xs text-[#87888C]">
                      Notificación en sistema + correo electrónico empresarial
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDispersalDialog(false)}
                  className="p-1.5 rounded-xl text-[#87888C] hover:text-white hover:bg-[#171821] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#171821] border border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setDispersalDialogMode('by_list')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    dispersalDialogMode === 'by_list'
                      ? 'bg-[#A9DFD8] text-[#171821] shadow'
                      : 'text-[#87888C] hover:text-white'
                  }`}
                >
                  <ListChecks className="w-4 h-4" />
                  <span>Dispersar Lista por Lista</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDispersalDialogMode('all')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    dispersalDialogMode === 'all'
                      ? 'bg-[#A9DFD8] text-[#171821] shadow'
                      : 'text-[#87888C] hover:text-white'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  <span>Dispersar Todas ({totalSupervisores})</span>
                </button>
              </div>

              <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#171821] border border-[#A9DFD8]/30 cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-[#A9DFD8] shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-white block">
                      Enviar Notificación al Correo Empresarial + Campana del Sistema
                    </span>
                    <span className="text-[11px] text-[#87888C]">
                      Notifica automáticamente al correo asignado de cada supervisor.
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={sendEmailOnDisperse}
                  onChange={(e) => setSendEmailOnDisperse(e.target.checked)}
                  className="w-4 h-4 accent-[#A9DFD8] rounded cursor-pointer"
                />
              </label>

              <div>
                <label className="text-[11px] font-semibold text-[#87888C] block mb-1.5">
                  Instrucciones o Mensaje para el Supervisor:
                </label>
                <textarea
                  rows={2}
                  value={dispersalMessage}
                  onChange={(e) => setDispersalMessage(e.target.value)}
                  placeholder="Ej: Favor de validar checadas faltantes y liberar antes del cierre..."
                  className="w-full rounded-xl px-3 py-2 bg-[#171821] border border-white/[0.08] text-white outline-none focus:border-[#A9DFD8] placeholder:text-[#87888C] resize-none text-xs"
                />
              </div>

              {dispersalDialogMode === 'by_list' ? (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {supervisorStats.map((st) => (
                    <div
                      key={st.name}
                      className="p-3 rounded-xl bg-[#171821] border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{st.name}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#21222D] text-[#87888C]">
                            {st.empleadosCount} colab.
                          </span>
                          {st.isListDispersed && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#A9DFD8]/15 text-[#A9DFD8] border border-[#A9DFD8]/35">
                              Dispersada ✓
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#87888C] font-mono mt-0.5">
                          Correo: <strong className="text-[#20AEF3]">{st.corporateEmail}</strong>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenMailClientForSupervisor(st.name, st.corporateEmail)}
                          className="px-2.5 py-1.5 rounded-xl bg-[#21222D] hover:bg-[#2B2B36] text-[#FEB95A] border border-white/[0.08] text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Mail className="w-3 h-3" />
                          <span>Correo</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDisperseSingleList(st.name)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                            st.isListDispersed
                              ? 'bg-[#A9DFD8]/15 text-[#A9DFD8] border border-[#A9DFD8]/35'
                              : 'bg-[#A9DFD8] hover:bg-[#95d2ca] text-[#171821]'
                          }`}
                        >
                          <Send className="w-3 h-3" />
                          <span>{st.isListDispersed ? 'Re-Notificar' : 'Dispersar'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-[#171821] border border-white/[0.06] space-y-2">
                  <span className="text-[11px] font-semibold text-[#87888C] block">
                    Supervisores que recibirán su lista ({supervisorStats.length}):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto">
                    {supervisorStats.map((st) => (
                      <div
                        key={st.name}
                        className="p-2.5 rounded-xl bg-[#21222D] border border-white/[0.06] text-[11px] flex items-center justify-between gap-2"
                      >
                        <div className="truncate">
                          <strong className="text-white block truncate">{st.name}</strong>
                          <span className="text-[#87888C] font-mono text-[10px] truncate block">{st.corporateEmail}</span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#20AEF3]/15 text-[#20AEF3] shrink-0">
                          {st.empleadosCount} emp.
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowDispersalDialog(false)}
                  className="px-4 py-2 rounded-xl text-[#87888C] hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Cerrar
                </button>
                {dispersalDialogMode === 'all' && (
                  <button
                    type="button"
                    onClick={handleConfirmDisperseAll}
                    className="px-5 py-2.5 rounded-xl bg-[#A9DFD8] hover:bg-[#95d2ca] text-[#171821] font-extrabold text-xs shadow-md flex items-center gap-2 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Dispersar Todas ({totalSupervisores})</span>
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
