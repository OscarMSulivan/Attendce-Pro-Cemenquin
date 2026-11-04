import React, { useState } from 'react';
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
  ListChecks
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

  // Buscar si esta semana ya fue dispersada
  const currentDispersal = dispersals.find((d) => d.semanaNumero === semanaNumero);
  const notifiedListsSet = new Set(
    (currentDispersal?.supervisoresNotificados || []).map(s => s.trim().toUpperCase())
  );

  // Calcular métricas por supervisor en tiempo real a partir de los datos procesados
  const supervisorStats = supervisors.map((supName) => {
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

    // Modificaciones hechas por el supervisor en la lista
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
      {/* Barra de Dispersión de Nómina a Supervisores (Dos opciones independientes: Lista por Lista vs Dispersar Todas) */}
      <div className="rounded-2xl p-5 bg-gradient-to-r from-blue-950/60 via-slate-900 to-slate-900 border border-blue-500/30 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-100">
                Dispersión y Notificaciones — Semana {semanaNumero}
              </h3>
              {dispersedListsCount === totalSupervisores && totalSupervisores > 0 ? (
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Todas Dispersadas ({dispersedListsCount}/{totalSupervisores})
                </span>
              ) : dispersedListsCount > 0 ? (
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1">
                  <ListChecks className="w-3 h-3" /> Parcial: {dispersedListsCount} de {totalSupervisores} Listas Dispersadas
                </span>
              ) : (
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Sin Dispersar
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {currentDispersal ? (
                <span>
                  Última dispersión por <strong className="text-slate-300">{currentDispersal.dispersadoPor}</strong> el {new Date(currentDispersal.fechaDispersion).toLocaleString('es-MX')} (Notificación enviada en Sistema + Correo Electrónico Empresarial).
                </span>
              ) : (
                <span>
                  Elige si deseas <strong>dispersar lista por lista</strong> o <strong>dispersar todas en un solo botón</strong>. Cada dispersión notifica al supervisor tanto en el sistema como a su correo electrónico empresarial.
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
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exportar a CONTPAQi®</span>
            </button>
          )}

          {/* Opción 1: Botón para Dispersar Lista por Lista */}
          <button
            type="button"
            onClick={() => {
              setDispersalDialogMode('by_list');
              setShowDispersalDialog(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-950 hover:bg-indigo-900 text-indigo-200 border border-indigo-500/40 text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            <ListChecks className="w-4 h-4 text-indigo-400" />
            <span>Dispersar Lista por Lista</span>
          </button>

          {/* Opción 2: Botón para Dispersar Todas en un solo botón */}
          <button
            type="button"
            onClick={() => {
              setDispersalDialogMode('all');
              setShowDispersalDialog(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/20 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Dispersar Todas en un Solo Botón</span>
          </button>
        </div>
      </div>

      {/* Tablero Semáforo Resumen */}
      <div className="rounded-xl p-6 bg-slate-900/90 border border-slate-800 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                <Building2 className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-slate-100">
                Semáforo de Liberación de Nóminas — Semana {semanaNumero}
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Monitoreo central de nóminas revisadas y autorizadas formalmente por cada supervisor de área.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-500 text-[10px] block uppercase">Período</span>
              <span className="text-slate-200 font-bold">{semanaPeriodo || 'Semana Activa'}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <span className="text-[10px] block uppercase">Avance</span>
              <span className="font-bold text-sm">{porcentajeLiberacion}% Liberado</span>
            </div>
          </div>
        </div>

        {/* Indicadores Semáforo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 block">
                Nóminas Liberadas
              </span>
              <span className="text-2xl font-black text-emerald-300 font-mono tabular-nums">
                {liberadosCount} / {totalSupervisores}
              </span>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 block">
                Pendientes de Supervisor
              </span>
              <span className="text-2xl font-black text-amber-300 font-mono tabular-nums">
                {pendientesCount}
              </span>
            </div>
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-rose-400 block">
                Alertas por Validar
              </span>
              <span className="text-2xl font-black text-rose-300 font-mono tabular-nums">
                {supervisorStats.reduce((sum, s) => sum + s.alertasCount, 0)}
              </span>
            </div>
            <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Tarjetas / Tabla por cada Supervisor */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
          Estado Detallado por Supervisor de Área ({supervisorStats.length})
        </h3>

        <div className="grid grid-cols-1 gap-3">
          {supervisorStats.map((stat) => (
            <div
              key={stat.name}
              className={`p-4 rounded-xl border transition-all flex flex-col gap-4 ${
                stat.status === 'liberado'
                  ? 'bg-slate-900/90 border-emerald-500/40 shadow-sm'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start md:items-center gap-3">
                  {/* Semáforo visual */}
                  <div
                    className={`w-4 h-4 rounded-full mt-1 md:mt-0 shrink-0 ${
                      stat.status === 'liberado'
                        ? 'bg-emerald-500 shadow-md shadow-emerald-500/50'
                        : stat.status === 'en_revision'
                        ? 'bg-amber-500 shadow-md shadow-amber-500/50'
                        : 'bg-rose-500 shadow-md shadow-rose-500/50'
                    }`}
                    title={
                      stat.status === 'liberado'
                        ? 'Nómina Liberada'
                        : 'Pendiente de Liberación'
                    }
                  />

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-slate-100">{stat.name}</h4>
                      {stat.isListDispersed ? (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1">
                          <Bell className="w-3 h-3" /> Lista Dispersada ✓
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          Lista Sin Dispersar
                        </span>
                      )}

                      {stat.status === 'liberado' ? (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          Liberado a RH
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          Pendiente de Revisión
                        </span>
                      )}

                      {stat.checadasAgregadasCount > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                          🟣 {stat.checadasAgregadasCount} Checada(s) Agregada(s) por Supervisor
                        </span>
                      )}

                      {stat.formatosAdjuntosCount > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          📎 {stat.formatosAdjuntosCount} Formato(s) Adjunto(s)
                        </span>
                      )}

                      {stat.faltasConfirmadasCount > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          🚫 {stat.faltasConfirmadasCount} Falta(s) Confirmada(s)
                        </span>
                      )}

                      {stat.release?.excelTrabajadoNombre && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1">
                          <FileCheck className="w-3 h-3 text-blue-400" /> Excel Devuelto
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5 font-mono">
                      <Mail className="w-3 h-3 text-indigo-400" />
                      <span>Correo empresarial: <strong className="text-slate-300">{stat.corporateEmail}</strong></span>
                    </p>

                    {stat.release?.fechaLiberacion && (
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Liberado por: <strong className="text-slate-300">{stat.release.liberadoPor || stat.name}</strong> el {new Date(stat.release.fechaLiberacion).toLocaleString('es-MX')}
                      </p>
                    )}

                    {stat.release?.comentariosSupervisor && (
                      <div className="mt-2 text-xs bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-slate-300 flex items-start gap-2">
                        <MessageSquare className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block">
                            Comentarios del Supervisor:
                          </span>
                          <p className="italic">&ldquo;{stat.release.comentariosSupervisor}&rdquo;</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Métricas y Acciones */}
                <div className="flex flex-wrap items-center gap-4 sm:gap-6 self-end md:self-center">
                  <div className="grid grid-cols-3 gap-3 text-center font-mono">
                    <div className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800">
                      <span className="text-[9px] uppercase text-slate-500 block">Empleados</span>
                      <span className="text-xs font-bold text-slate-200 tabular-nums">
                        {stat.empleadosCount}
                      </span>
                    </div>
                    <div className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800">
                      <span className="text-[9px] uppercase text-slate-500 block">H. Normal</span>
                      <span className="text-xs font-bold text-slate-200 tabular-nums">
                        {stat.horasNormales.toFixed(2)}
                      </span>
                    </div>
                    <div className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800">
                      <span className="text-[9px] uppercase text-slate-500 block">H. Extra</span>
                      <span className="text-xs font-bold text-amber-400 tabular-nums">
                        {stat.horasExtras.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Botón individual para Dispersar esta Lista (Opción Lista por Lista directa) */}
                    <button
                      type="button"
                      onClick={() => handleDisperseSingleList(stat.name)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        stat.isListDispersed
                          ? 'bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20'
                      }`}
                      title={`Dispersar únicamente la lista de ${stat.name} y enviarle notificación en sistema + correo a ${stat.corporateEmail}`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{stat.isListDispersed ? 'Re-Dispersar Lista' : 'Dispersar esta Lista'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onInspectSupervisor(stat.name)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all border border-slate-700 cursor-pointer"
                      title="Ver detalle de colaboradores y checadas"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ver Detalle</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDownloadExcel(stat.name)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                      title="Descargar Excel de nómina con las modificaciones del supervisor marcadas en morado"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Descargar Excel</span>
                    </button>

                    {/* Botón para descargar el Excel trabajado devuelto por el supervisor si existe */}
                    {stat.release?.excelTrabajadoNombre && stat.release?.excelTrabajadoBase64 && (
                      <button
                        type="button"
                        onClick={() => onDownloadSupervisorReturnedExcel(
                          stat.release!.excelTrabajadoNombre!,
                          stat.release!.excelTrabajadoBase64!
                        )}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 cursor-pointer"
                        title={`Descargar Excel subido por el supervisor (${stat.release.excelTrabajadoNombre})`}
                      >
                        <FileCheck className="w-3.5 h-3.5" />
                        <span>Excel Adjunto</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Detalle de Checadas Agregadas / Formatos / Faltas Confirmadas por el Supervisor */}
              {stat.modifiedDays.length > 0 && (
                <div className="pt-3 border-t border-slate-800/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 block mb-2">
                    🟣 Bitácora de Modificaciones del Supervisor en la Lista ({stat.modifiedDays.length}):
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {stat.modifiedDays.map((mod, idx) => (
                      <div
                        key={`${mod.empId}-${mod.fechaStr}-${idx}`}
                        className="p-2.5 rounded-lg bg-purple-950/20 border border-purple-500/30 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-purple-300">#{mod.empId}</span>
                            <span className="font-semibold text-slate-200">{mod.empNombre}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 font-mono">
                              {mod.fechaStr}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-300 flex items-center gap-2 flex-wrap">
                            {mod.tipoModificacion === 'falta_confirmada' ? (
                              <span className="text-rose-300 font-bold">🚫 Confirmó Falta (No vino)</span>
                            ) : (
                              <span>
                                Checada: <strong className="text-purple-300 font-mono">{mod.entrada} - {mod.salida}</strong>{' '}
                                <span className="text-slate-500 text-[10px]">
                                  (Orig: {mod.entradaOriginal || '--:--'} / {mod.salidaOriginal || '--:--'})
                                </span>
                              </span>
                            )}
                            <span className="text-blue-300 font-semibold">• {mod.incidencia}</span>
                          </div>
                          {mod.nota && (
                            <p className="text-[10px] text-slate-400 italic">
                              &ldquo;{mod.nota}&rdquo;
                            </p>
                          )}
                        </div>

                        {mod.formatoNombre && mod.formatoBase64 ? (
                          <button
                            type="button"
                            onClick={() => handleDownloadFormatAttachment(mod.formatoNombre!, mod.formatoBase64!)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold flex items-center gap-1 shrink-0 transition-all cursor-pointer"
                            title={`Descargar formato: ${mod.formatoNombre}`}
                          >
                            <Download className="w-3 h-3" />
                            <span>Respaldo</span>
                          </button>
                        ) : mod.tipoModificacion === 'checada_agregada' ||
                          mod.tipoModificacion === 'formato_checada_sin_gafete' ? (
                          (!mod.entradaOriginal || mod.entradaOriginal === '--:--') &&
                          (!mod.salidaOriginal || mod.salidaOriginal === '--:--') ? (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold shrink-0">
                              Sin Respaldo (Faltaban 2)
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold shrink-0">
                              Faltaba 1 (Opcional)
                            </span>
                          )
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Modal de Dispersión (Soporta Modo "Lista por Lista" o Modo "Dispersar Todas en un Solo Botón") */}
      {showDispersalDialog && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                  {dispersalDialogMode === 'by_list' ? (
                    <ListChecks className="w-5 h-5 text-indigo-400" />
                  ) : (
                    <Send className="w-5 h-5 text-blue-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    {dispersalDialogMode === 'by_list'
                      ? `Dispersar Nómina Lista por Lista — Semana ${semanaNumero}`
                      : `Dispersar Todas las Listas en un Solo Botón — Semana ${semanaNumero}`}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Notificación dual automática: <strong className="text-indigo-300">Alerta en Sistema</strong> + <strong className="text-emerald-300">Correo Electrónico Empresarial</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDispersalDialog(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Selector rápido entre las dos modalidades dentro del modal */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => setDispersalDialogMode('by_list')}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  dispersalDialogMode === 'by_list'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ListChecks className="w-4 h-4" />
                <span>Opción 1: Dispersar Lista por Lista</span>
              </button>
              <button
                type="button"
                onClick={() => setDispersalDialogMode('all')}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  dispersalDialogMode === 'all'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Send className="w-4 h-4" />
                <span>Opción 2: Dispersar Todas ({totalSupervisores})</span>
              </button>
            </div>

            {/* Opción de Notificación por Correo Empresarial + Sistema */}
            <label className="flex items-center justify-between p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 cursor-pointer">
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-emerald-200 block">
                    Enviar Notificación al Correo Electrónico Empresarial + Notificación en Sistema
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Envía aviso inmediato al buzón corporativo registrado de cada supervisor y activa la campana en su sesión.
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={sendEmailOnDisperse}
                onChange={(e) => setSendEmailOnDisperse(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
            </label>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Instrucciones o Mensaje para el Supervisor (Se incluye en Sistema y Correo):
              </label>
              <textarea
                rows={2}
                value={dispersalMessage}
                onChange={(e) => setDispersalMessage(e.target.value)}
                placeholder="Ej: Favor de validar checadas faltantes, adjuntar formatos firmados obligatorios y liberar antes del cierre..."
                className="w-full rounded-xl px-3 py-2 bg-slate-950 border border-slate-800 text-slate-100 outline-none focus:border-blue-500 placeholder:text-slate-600 resize-none text-xs"
              />
            </div>

            {dispersalDialogMode === 'by_list' ? (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 block">
                  Selecciona qué lista deseas dispersar y notificar individualmente:
                </span>
                {supervisorStats.map((st) => (
                  <div
                    key={st.name}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-100">{st.name}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                          {st.empleadosCount} colab.
                        </span>
                        {st.isListDispersed && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Dispersada ✓
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Correo: <strong className="text-indigo-300">{st.corporateEmail}</strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenMailClientForSupervisor(st.name, st.corporateEmail)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                        title="Abrir cliente de correo corporativo con mensaje prellenado"
                      >
                        <Mail className="w-3 h-3 text-amber-400" />
                        <span>Cliente Correo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDisperseSingleList(st.name)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                          st.isListDispersed
                            ? 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow'
                        }`}
                      >
                        <Send className="w-3 h-3" />
                        <span>{st.isListDispersed ? 'Re-Notificar Lista' : 'Dispersar esta Lista'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300 block">
                  Supervisores y Correos Empresariales que recibirán su lista ({supervisorStats.length}):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto">
                  {supervisorStats.map((st) => (
                    <div
                      key={st.name}
                      className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] flex items-center justify-between gap-2"
                    >
                      <div className="truncate">
                        <strong className="text-slate-200 block truncate">{st.name}</strong>
                        <span className="text-slate-400 font-mono text-[10px] truncate block">{st.corporateEmail}</span>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 shrink-0">
                        {st.empleadosCount} emp.
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowDispersalDialog(false)}
                className="px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 text-xs cursor-pointer"
              >
                Cerrar
              </button>
              {dispersalDialogMode === 'all' && (
                <button
                  type="button"
                  onClick={handleConfirmDisperseAll}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-600/20 flex items-center gap-2 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Dispersar Todas las Listas ({totalSupervisores}) y Notificar</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

