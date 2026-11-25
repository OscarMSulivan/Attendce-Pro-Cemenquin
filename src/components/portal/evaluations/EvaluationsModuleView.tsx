/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  FolderOpen,
  Lock,
  Play,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Sliders,
  Trash2,
  Unlock,
  Upload,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  DEFAULT_INCIDENCE_RULES,
  type EmployeeEvaluationRecord,
  type EvaluationCampaign,
  type EvaluationCampaignStatus,
  type EvaluationRecordStatus,
  type IncidenceScoringRules,
} from '../../../types/evaluations';
import {
  getUserAllowedLists,
  userHasModuleAccess,
  type PortalUser,
} from '../../../types/portal';
import type { Employee } from '../../../types/attendance';
import { normalizeSupervisorName } from '../../../utils/calendarUtils';
import {
  buildRecordsFromEmployeesDirectory,
  exportEvaluationsSummaryExcel,
  getRulesMaxTotal,
  printEvaluations,
  recalculateRecordWithRules,
} from '../../../services/evaluationService';
import { IncidenceRulesEditor } from './IncidenceRulesEditor';
import { EvaluationExcelImportModal } from './EvaluationExcelImportModal';
import { EvaluationFormModal } from './EvaluationFormModal';

export interface EvaluationsModuleViewProps {
  currentUser: PortalUser;
  empleadosDB: Record<string, Employee>;
  campaigns: EvaluationCampaign[];
  records: EmployeeEvaluationRecord[];
  onSaveBundle: (
    campaigns: EvaluationCampaign[],
    records: EmployeeEvaluationRecord[],
  ) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type InternalTab = 'tablero' | 'reglas';
type StatusFilter = 'todos' | EvaluationRecordStatus;

interface SupervisorProgressRow {
  key: string;
  label: string;
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  percent: number;
}

const CAMPAIGN_STATUS_META: Record<
  EvaluationCampaignStatus,
  { label: string; badgeClasses: string; dotClasses: string }
> = {
  borrador: {
    label: 'Borrador',
    badgeClasses: 'bg-slate-500/15 text-slate-300 border-slate-500/35',
    dotClasses: 'bg-slate-400',
  },
  activa: {
    label: 'Activa',
    badgeClasses: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
    dotClasses: 'bg-emerald-400',
  },
  cerrada: {
    label: 'Cerrada',
    badgeClasses: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
    dotClasses: 'bg-amber-400',
  },
};

const RECORD_STATUS_META: Record<
  EvaluationRecordStatus,
  { label: string; badgeClasses: string }
> = {
  pendiente: {
    label: 'Pendiente',
    badgeClasses: 'bg-slate-500/15 text-slate-300 border-slate-500/35',
  },
  en_progreso: {
    label: 'En progreso',
    badgeClasses: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
  },
  completada: {
    label: 'Completada',
    badgeClasses: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
  },
};

function cloneDefaultRules(): IncidenceScoringRules {
  return {
    faltas: DEFAULT_INCIDENCE_RULES.faltas.map((b) => ({ ...b })),
    incapacidades: DEFAULT_INCIDENCE_RULES.incapacidades.map((b) => ({ ...b })),
    retardos: DEFAULT_INCIDENCE_RULES.retardos.map((b) => ({ ...b })),
    permisos: DEFAULT_INCIDENCE_RULES.permisos.map((b) => ({ ...b })),
  };
}

function normalizeSearchText(value: string | undefined | null): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getScoreBadgeClasses(score: number): string {
  if (score >= 85) {
    return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35';
  }
  if (score >= 70) {
    return 'bg-[#A9DFD8]/15 text-[#A9DFD8] border-[#A9DFD8]/35';
  }
  if (score >= 50) {
    return 'bg-amber-500/15 text-amber-300 border-amber-500/35';
  }
  return 'bg-rose-500/15 text-rose-300 border-rose-500/35';
}

function pickDefaultCampaign(
  list: EvaluationCampaign[],
): EvaluationCampaign | null {
  if (list.length === 0) return null;
  const sorted = [...list].sort((a, b) =>
    (b.creadaEn || '').localeCompare(a.creadaEn || ''),
  );
  return sorted.find((c) => c.status === 'activa') ?? sorted[0];
}

export const EvaluationsModuleView: React.FC<EvaluationsModuleViewProps> = ({
  currentUser,
  empleadosDB,
  campaigns,
  records,
  onSaveBundle,
  onShowToast,
}) => {
  const isManager = userHasModuleAccess(currentUser, 'evaluaciones_admin');
  const currentYear = new Date().getFullYear();

  const visibleCampaigns = useMemo(() => {
    const filtered = isManager
      ? campaigns
      : campaigns.filter(
          (c) => c.status === 'activa' || c.status === 'cerrada',
        );
    return [...filtered].sort((a, b) =>
      (b.creadaEn || '').localeCompare(a.creadaEn || ''),
    );
  }, [campaigns, isManager]);

  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    () => pickDefaultCampaign(visibleCampaigns)?.id ?? null,
  );
  const [activeTab, setActiveTab] = useState<InternalTab>('tablero');

  // Filtros del tablero
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [supervisorFilter, setSupervisorFilter] = useState<string>('todos');
  const [areaFilter, setAreaFilter] = useState<string>('todos');

  // Modales
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false);
  const [newCampNombre, setNewCampNombre] = useState(
    `Evaluación Anual ${currentYear}`,
  );
  const [newCampAnioEmision, setNewCampAnioEmision] = useState(
    String(currentYear),
  );
  const [newCampAnioIncidencias, setNewCampAnioIncidencias] = useState(
    String(currentYear - 1),
  );
  const [newCampFechaLimite, setNewCampFechaLimite] = useState('');

  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedRecord, setSelectedRecord] =
    useState<EmployeeEvaluationRecord | null>(null);
  const [recordToDelete, setRecordToDelete] =
    useState<EmployeeEvaluationRecord | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const activeCampaign = useMemo(() => {
    if (visibleCampaigns.length === 0) return null;
    if (selectedCampaignId) {
      const found = visibleCampaigns.find((c) => c.id === selectedCampaignId);
      if (found) return found;
    }
    return pickDefaultCampaign(visibleCampaigns);
  }, [visibleCampaigns, selectedCampaignId]);

  useEffect(() => {
    if (!isManager && activeTab !== 'tablero') {
      setActiveTab('tablero');
    }
  }, [isManager, activeTab]);

  // Cerrar modales ligeros con Escape
  useEffect(() => {
    if (!showNewCampaignModal && !recordToDelete) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (recordToDelete) {
          setRecordToDelete(null);
        } else if (showNewCampaignModal) {
          setShowNewCampaignModal(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showNewCampaignModal, recordToDelete]);

  // Listas permitidas para supervisor
  const userAllowedListsRaw = useMemo(
    () => (isManager ? [] : getUserAllowedLists(currentUser)),
    [currentUser, isManager],
  );

  const allowedSupervisorKeys = useMemo(() => {
    if (isManager) return null;
    return new Set(
      userAllowedListsRaw
        .map((list) => normalizeSupervisorName(list))
        .filter(Boolean),
    );
  }, [isManager, userAllowedListsRaw]);

  // Registros visibles para la campaña seleccionada (con visibilidad estricta para supervisores)
  const campaignRecords = useMemo(() => {
    if (!activeCampaign) return [];
    const inCampaign = records.filter(
      (r) => r.campaignId === activeCampaign.id,
    );
    if (isManager) return inCampaign;
    if (!allowedSupervisorKeys || allowedSupervisorKeys.size === 0) return [];
    return inCampaign.filter((r) =>
      allowedSupervisorKeys.has(normalizeSupervisorName(r.supervisor)),
    );
  }, [records, activeCampaign, isManager, allowedSupervisorKeys]);

  // KPIs superiores
  const kpis = useMemo(() => {
    const total = campaignRecords.length;
    let completed = 0;
    let inProgress = 0;
    let pending = 0;
    let finalScoreSum = 0;

    for (const rec of campaignRecords) {
      if (rec.status === 'completada') {
        completed += 1;
        finalScoreSum += rec.calificacionFinal;
      } else if (rec.status === 'en_progreso') {
        inProgress += 1;
      } else {
        pending += 1;
      }
    }

    const completionPercent =
      total > 0 ? Math.round((completed / total) * 100) : 0;
    const avgFinalScore =
      completed > 0 ? Math.round((finalScoreSum / completed) * 10) / 10 : null;

    return {
      total,
      completed,
      inProgress,
      pending,
      notCompleted: inProgress + pending,
      completionPercent,
      avgFinalScore,
    };
  }, [campaignRecords]);

  // Avance por supervisor (solo manager)
  const supervisorProgress = useMemo<SupervisorProgressRow[]>(() => {
    if (!isManager) return [];
    const map = new Map<
      string,
      {
        label: string;
        total: number;
        completed: number;
        inProgress: number;
        pending: number;
      }
    >();

    for (const rec of campaignRecords) {
      const key = normalizeSupervisorName(rec.supervisor) || '__SIN_SUPERVISOR__';
      const label = rec.supervisor?.trim() || 'Sin supervisor';
      const existing = map.get(key) ?? {
        label,
        total: 0,
        completed: 0,
        inProgress: 0,
        pending: 0,
      };
      existing.total += 1;
      if (rec.status === 'completada') {
        existing.completed += 1;
      } else if (rec.status === 'en_progreso') {
        existing.inProgress += 1;
      } else {
        existing.pending += 1;
      }
      map.set(key, existing);
    }

    return Array.from(map.entries())
      .map(([key, stats]) => ({
        key,
        label: stats.label,
        total: stats.total,
        completed: stats.completed,
        inProgress: stats.inProgress,
        pending: stats.pending,
        percent:
          stats.total > 0
            ? Math.round((stats.completed / stats.total) * 100)
            : 0,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [campaignRecords, isManager]);

  // Opciones únicas de área para filtro manager
  const areaOptions = useMemo(() => {
    if (!isManager) return [];
    const set = new Set<string>();
    for (const rec of campaignRecords) {
      const area = rec.area?.trim();
      if (area) set.add(area);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [campaignRecords, isManager]);

  // Registros filtrados en la tabla
  const filteredRecords = useMemo(() => {
    const query = normalizeSearchText(searchQuery);

    return campaignRecords
      .filter((rec) => {
        if (statusFilter !== 'todos' && rec.status !== statusFilter) {
          return false;
        }
        if (isManager && supervisorFilter !== 'todos') {
          const recSupKey =
            normalizeSupervisorName(rec.supervisor) || '__SIN_SUPERVISOR__';
          if (recSupKey !== supervisorFilter) return false;
        }
        if (isManager && areaFilter !== 'todos') {
          if ((rec.area?.trim() || '') !== areaFilter) return false;
        }
        if (query) {
          const haystack = [
            rec.nombre,
            rec.empleadoId ?? '',
            rec.puesto,
            rec.area,
            rec.supervisor,
          ]
            .map((v) => normalizeSearchText(v))
            .join(' ');
          if (!haystack.includes(query)) return false;
        }
        return true;
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [
    campaignRecords,
    statusFilter,
    isManager,
    supervisorFilter,
    areaFilter,
    searchQuery,
  ]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    statusFilter !== 'todos' ||
    (isManager && supervisorFilter !== 'todos') ||
    (isManager && areaFilter !== 'todos');

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('todos');
    setSupervisorFilter('todos');
    setAreaFilter('todos');
  };

  const handleSelectCampaign = (campaignId: string) => {
    setSelectedCampaignId(campaignId);
    setSelectedRecord(null);
    resetFilters();
  };

  // Crear nueva campaña
  const openNewCampaignModal = () => {
    const year = new Date().getFullYear();
    setNewCampNombre(`Evaluación Anual ${year}`);
    setNewCampAnioEmision(String(year));
    setNewCampAnioIncidencias(String(year - 1));
    setNewCampFechaLimite('');
    setShowNewCampaignModal(true);
  };

  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newCampNombre.trim();
    const anioEmision = Number.parseInt(newCampAnioEmision, 10);
    const anioIncidencias = Number.parseInt(newCampAnioIncidencias, 10);

    if (!trimmedName) {
      onShowToast('Ingresa un nombre para la campaña.', 'error');
      return;
    }
    if (!Number.isFinite(anioEmision) || anioEmision < 2000 || anioEmision > 2100) {
      onShowToast('Ingresa un año de emisión válido.', 'error');
      return;
    }
    if (
      !Number.isFinite(anioIncidencias) ||
      anioIncidencias < 2000 ||
      anioIncidencias > 2100
    ) {
      onShowToast('Ingresa un año de incidencias válido.', 'error');
      return;
    }

    const now = new Date().toISOString();
    const newCampaign: EvaluationCampaign = {
      id: `camp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      nombre: trimmedName,
      anioEmision,
      anioIncidencias,
      status: 'borrador',
      fechaLimite: newCampFechaLimite.trim() || undefined,
      rules: cloneDefaultRules(),
      creadaPor: currentUser.name,
      creadaEn: now,
      actualizadaEn: now,
    };

    const seeded = buildRecordsFromEmployeesDirectory(
      empleadosDB,
      newCampaign.id,
      newCampaign.rules,
    );

    onSaveBundle([newCampaign, ...campaigns], [...records, ...seeded.records]);
    setSelectedCampaignId(newCampaign.id);
    setActiveTab('tablero');
    resetFilters();
    setShowNewCampaignModal(false);
    if (seeded.addedCount > 0) {
      const supCount = new Set(seeded.records.map((r) => r.supervisor)).size;
      onShowToast(
        `Campaña "${trimmedName}" creada con ${seeded.addedCount} colaboradores distribuidos en ${supCount} supervisor(es) del padrón.`,
        'success',
      );
    } else {
      onShowToast(
        `Campaña "${trimmedName}" creada en modo borrador (padrón sin empleados cargados aún).`,
        'info',
      );
    }
  };

  const handleSyncEmployeesDirectory = () => {
    if (!activeCampaign) return;
    const otherCampaignRecords = records.filter(
      (r) => r.campaignId !== activeCampaign.id,
    );
    const currentCampaignRecords = records.filter(
      (r) => r.campaignId === activeCampaign.id,
    );
    const synced = buildRecordsFromEmployeesDirectory(
      empleadosDB,
      activeCampaign.id,
      activeCampaign.rules,
      currentCampaignRecords,
    );
    onSaveBundle(campaigns, [...otherCampaignRecords, ...synced.records]);
    onShowToast(
      `Padrón sincronizado: ${synced.addedCount} nuevo(s) y ${synced.updatedCount} actualizado(s).`,
      'success',
    );
  };

  // Cambio de estado de campaña
  const handleChangeCampaignStatus = (nextStatus: EvaluationCampaignStatus) => {
    if (!activeCampaign) return;
    const now = new Date().toISOString();
    const updatedCampaigns = campaigns.map((camp) => {
      if (camp.id !== activeCampaign.id) return camp;
      return {
        ...camp,
        status: nextStatus,
        abiertaEn:
          nextStatus === 'activa' ? camp.abiertaEn || now : camp.abiertaEn,
        cerradaEn: nextStatus === 'cerrada' ? now : camp.cerradaEn,
        actualizadaEn: now,
      };
    });

    onSaveBundle(updatedCampaigns, records);

    if (nextStatus === 'activa' && activeCampaign.status === 'borrador') {
      onShowToast(
        `Campaña "${activeCampaign.nombre}" abierta a supervisores.`,
        'success',
      );
    } else if (nextStatus === 'cerrada') {
      onShowToast(
        `Campaña "${activeCampaign.nombre}" cerrada. Las evaluaciones quedaron en solo lectura.`,
        'info',
      );
    } else {
      onShowToast(
        `Campaña "${activeCampaign.nombre}" reabierta a supervisores.`,
        'success',
      );
    }
  };

  // Guardar reglas de equivalencias y recalcular todos los registros de la campaña
  const handleSaveRules = (newRules: IncidenceScoringRules) => {
    if (!activeCampaign) return;
    const now = new Date().toISOString();
    const updatedCampaigns = campaigns.map((camp) =>
      camp.id === activeCampaign.id
        ? { ...camp, rules: newRules, actualizadaEn: now }
        : camp,
    );

    let recalculatedCount = 0;
    const updatedRecords = records.map((rec) => {
      if (rec.campaignId !== activeCampaign.id) return rec;
      recalculatedCount += 1;
      return {
        ...recalculateRecordWithRules(rec, newRules),
        actualizadaEn: now,
      };
    });

    onSaveBundle(updatedCampaigns, updatedRecords);
    onShowToast(
      `Reglas de equivalencias guardadas${
        recalculatedCount > 0
          ? ` y ${recalculatedCount} registro(s) recalculado(s)`
          : ''
      }.`,
      'success',
    );
  };

  // Aplicar incidencias mapeadas desde el analizador inteligente de Excel
  const handleApplyMappedRecords = (
    finalCampaignRecords: EmployeeEvaluationRecord[],
    summary: { matchedCount: number; untouchedCount: number; addedUnmatchedCount: number },
  ) => {
    if (!activeCampaign) return;
    const otherCampaignRecords = records.filter(
      (r) => r.campaignId !== activeCampaign.id,
    );
    onSaveBundle(campaigns, [...otherCampaignRecords, ...finalCampaignRecords]);
    setShowImportModal(false);
    const extraText =
      summary.addedUnmatchedCount > 0
        ? ` y ${summary.addedUnmatchedCount} agregado(s) fuera del padrón`
        : '';
    onShowToast(
      `Incidencias vinculadas por No. Empleado: ${summary.matchedCount} actualizado(s)${extraText}.`,
      'success',
    );
  };

  // Guardar evaluación desde EvaluationFormModal
  const handleSaveEvaluation = (updated: EmployeeEvaluationRecord) => {
    const updatedRecords = records.map((r) =>
      r.id === updated.id ? updated : r,
    );
    onSaveBundle(campaigns, updatedRecords);
    setSelectedRecord(null);

    if (updated.status === 'completada') {
      onShowToast(
        `Evaluación de ${updated.nombre} finalizada (${updated.calificacionFinal}%).`,
        'success',
      );
    } else {
      onShowToast(
        `Borrador de evaluación de ${updated.nombre} guardado.`,
        'info',
      );
    }
  };

  // Reabrir evaluación completada (solo manager)
  const handleReopenRecord = (rec: EmployeeEvaluationRecord) => {
    if (!activeCampaign || activeCampaign.status === 'cerrada') return;
    const now = new Date().toISOString();
    const updatedRecords = records.map((r) =>
      r.id === rec.id
        ? {
            ...r,
            status: 'en_progreso' as EvaluationRecordStatus,
            reabiertaPor: currentUser.name,
            actualizadaEn: now,
          }
        : r,
    );
    onSaveBundle(campaigns, updatedRecords);
    onShowToast(
      `Evaluación de ${rec.nombre} reabierta para edición.`,
      'info',
    );
  };

  // Eliminar colaborador de la campaña (solo manager, tras confirmación)
  const handleConfirmDeleteRecord = () => {
    if (!recordToDelete) return;
    const target = recordToDelete;
    const updatedRecords = records.filter((r) => r.id !== target.id);
    onSaveBundle(campaigns, updatedRecords);
    setRecordToDelete(null);
    onShowToast(
      `${target.nombre} fue eliminado de la campaña.`,
      'info',
    );
  };

  // Exportar concentrado Excel
  const handleExportExcel = async () => {
    if (!activeCampaign) return;
    if (filteredRecords.length === 0) {
      onShowToast(
        'No hay evaluaciones en el filtro actual para exportar.',
        'info',
      );
      return;
    }
    setIsExporting(true);
    try {
      await exportEvaluationsSummaryExcel(activeCampaign, filteredRecords);
      onShowToast(
        `Concentrado Excel generado (${filteredRecords.length} registro(s)).`,
        'success',
      );
    } catch (err) {
      onShowToast(
        err instanceof Error
          ? `Error al exportar Excel: ${err.message}`
          : 'No se pudo generar el concentrado Excel.',
        'error',
      );
    } finally {
      setIsExporting(false);
    }
  };

  // Imprimir / PDF en lote
  const handleBatchPrint = () => {
    if (!activeCampaign) return;
    if (filteredRecords.length === 0) {
      onShowToast(
        'No hay evaluaciones en el filtro actual para imprimir.',
        'info',
      );
      return;
    }

    const completedInFilter = filteredRecords.filter(
      (r) => r.status === 'completada',
    );

    if (completedInFilter.length > 0) {
      printEvaluations(activeCampaign, completedInFilter);
      onShowToast(
        `Abriendo impresión para ${completedInFilter.length} evaluación(es) completada(s).`,
        'success',
      );
    } else {
      onShowToast(
        `No hay evaluaciones completadas en el filtro; imprimiendo las ${filteredRecords.length} evaluaciones filtradas.`,
        'info',
      );
      printEvaluations(activeCampaign, filteredRecords);
    }
  };

  const rulesMaxTotal = activeCampaign
    ? getRulesMaxTotal(activeCampaign.rules)
    : 20;

  return (
    <div className="space-y-6">
      {/* Encabezado del módulo y barra de campaña */}
      <div className="bg-[#21222D] border border-white/[0.08] rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#A9DFD8]/15 border border-[#A9DFD8]/30 flex items-center justify-center text-[#A9DFD8] shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Evaluaciones Anuales de Desempeño
                </h1>
                {activeCampaign && (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${CAMPAIGN_STATUS_META[activeCampaign.status].badgeClasses}`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${CAMPAIGN_STATUS_META[activeCampaign.status].dotClasses}`}
                    />
                    {CAMPAIGN_STATUS_META[activeCampaign.status].label}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-400 mt-0.5">
                {isManager
                  ? 'Administra campañas anuales, reglas de equivalencias de incidencias, padrón Excel y seguimiento por supervisor.'
                  : 'Evalúa las 10 competencias de los colaboradores asignados a tu lista y consulta su calificación final.'}
              </p>
            </div>
          </div>

          {/* Controles de campaña */}
          <div className="flex flex-wrap items-center gap-2.5">
            {visibleCampaigns.length > 0 && (
              <div className="flex items-center gap-2">
                <label
                  htmlFor="eval-campaign-select"
                  className="text-xs font-medium text-slate-400 hidden sm:inline"
                >
                  Campaña:
                </label>
                <select
                  id="eval-campaign-select"
                  value={activeCampaign?.id ?? ''}
                  onChange={(e) => handleSelectCampaign(e.target.value)}
                  className="bg-[#171821] border border-white/[0.12] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#A9DFD8]/60 min-w-[220px]"
                >
                  {visibleCampaigns.map((camp) => (
                    <option key={camp.id} value={camp.id}>
                      {camp.nombre} ({camp.anioEmision}) ·{' '}
                      {CAMPAIGN_STATUS_META[camp.status].label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isManager && (
              <button
                type="button"
                onClick={openNewCampaignModal}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold bg-[#A9DFD8] text-[#171821] hover:bg-[#95d4cc] transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Nueva Campaña
              </button>
            )}

            {isManager && activeCampaign && (
              <>
                {activeCampaign.status === 'borrador' && (
                  <button
                    type="button"
                    onClick={() => handleChangeCampaignStatus('activa')}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition-colors cursor-pointer"
                  >
                    <Play className="w-4 h-4" />
                    Abrir Campaña a Supervisores
                  </button>
                )}
                {activeCampaign.status === 'activa' && (
                  <button
                    type="button"
                    onClick={() => handleChangeCampaignStatus('cerrada')}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/35 hover:bg-amber-500/25 transition-colors cursor-pointer"
                  >
                    <Lock className="w-4 h-4" />
                    Cerrar Campaña
                  </button>
                )}
                {activeCampaign.status === 'cerrada' && (
                  <button
                    type="button"
                    onClick={() => handleChangeCampaignStatus('activa')}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/35 hover:bg-sky-500/25 transition-colors cursor-pointer"
                  >
                    <Unlock className="w-4 h-4" />
                    Reabrir Campaña
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Metadatos de la campaña activa y sub-pestañas de manager */}
        {activeCampaign && (
          <div className="mt-4 pt-4 border-t border-white/[0.06] flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#A9DFD8]" />
                Emisión:{' '}
                <strong className="text-slate-200">
                  {activeCampaign.anioEmision}
                </strong>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#A9DFD8]" />
                Incidencias:{' '}
                <strong className="text-slate-200">
                  {activeCampaign.anioIncidencias}
                </strong>
              </span>
              {activeCampaign.fechaLimite && (
                <span className="inline-flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
                  Fecha límite:{' '}
                  <strong className="text-amber-200">
                    {activeCampaign.fechaLimite}
                  </strong>
                </span>
              )}
              {!isManager && userAllowedListsRaw.length > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-[#A9DFD8]" />
                  Lista(s):{' '}
                  <strong className="text-slate-200">
                    {userAllowedListsRaw.join(', ')}
                  </strong>
                </span>
              )}
            </div>

            {isManager && (
              <div className="inline-flex items-center bg-[#171821] p-1 rounded-xl border border-white/[0.08] self-start md:self-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('tablero')}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    activeTab === 'tablero'
                      ? 'bg-[#21222D] text-[#A9DFD8] shadow-sm border border-[#A9DFD8]/25'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  Tablero y Evaluaciones
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('reglas')}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    activeTab === 'reglas'
                      ? 'bg-[#21222D] text-[#A9DFD8] shadow-sm border border-[#A9DFD8]/25'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  Reglas de Equivalencias (/{rulesMaxTotal})
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Estado vacío cuando no hay campaña visible */}
      {!activeCampaign ? (
        <div className="bg-[#21222D] border border-white/[0.08] rounded-2xl p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#A9DFD8]/10 border border-[#A9DFD8]/25 flex items-center justify-center text-[#A9DFD8] mx-auto mb-4">
            <FolderOpen className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-semibold text-white">
            {isManager
              ? 'Aún no hay campañas de evaluación'
              : 'Sin campañas de evaluación abiertas'}
          </h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto mt-2">
            {isManager
              ? 'Crea tu primera campaña anual para configurar las reglas de equivalencias, importar el concentrado de incidencias y abrir la captura a los supervisores.'
              : 'Recursos Humanos aún no ha abierto una campaña de evaluación anual para tu lista. Cuando se habilite, aparecerá aquí automáticamente.'}
          </p>
          {isManager && (
            <button
              type="button"
              onClick={openNewCampaignModal}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#A9DFD8] text-[#171821] hover:bg-[#95d4cc] transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Crear Primera Campaña
            </button>
          )}
        </div>
      ) : isManager && activeTab === 'reglas' ? (
        /* Sub-pestaña Reglas de Equivalencias */
        <IncidenceRulesEditor
          rules={activeCampaign.rules}
          onSaveRules={handleSaveRules}
          disabled={activeCampaign.status === 'cerrada'}
        />
      ) : (
        /* Sub-pestaña Tablero y Evaluaciones */
        <>
          {/* Banner informativo para Borrador o Cerrada */}
          {isManager && activeCampaign.status === 'borrador' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-sky-500/10 border border-sky-500/30 rounded-xl px-4 py-3 text-sm text-sky-200">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
                <span>
                  Esta campaña está en <strong>Borrador</strong> y aún no es
                  visible para los supervisores. Importa el padrón Excel, revisa
                  las reglas de equivalencias y ábrela cuando estés listo.
                </span>
              </div>
            </div>
          )}

          {activeCampaign.status === 'cerrada' && (
            <div className="flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-200">
              <Lock className="w-4 h-4 text-amber-300 shrink-0" />
              <span>
                Esta campaña se encuentra <strong>Cerrada</strong>. Las
                evaluaciones están en modo solo lectura; puedes consultarlas e
                imprimir/exportar resultados.
              </span>
            </div>
          )}

          {/* Estado vacío para supervisor sin colaboradores asignados */}
          {!isManager && campaignRecords.length === 0 ? (
            <div className="bg-[#21222D] border border-white/[0.08] rounded-2xl p-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#A9DFD8]/10 border border-[#A9DFD8]/25 flex items-center justify-center text-[#A9DFD8] mx-auto mb-4">
                <Users className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-semibold text-white">
                Sin colaboradores asignados en esta campaña
              </h2>
              <p className="text-sm text-slate-400 max-w-md mx-auto mt-2">
                Recursos Humanos aún no ha cargado colaboradores para tu lista
                en <strong>{activeCampaign.nombre}</strong>.
                {userAllowedListsRaw.length > 0 && (
                  <>
                    {' '}
                    Lista(s) configurada(s):{' '}
                    <span className="text-slate-200 font-medium">
                      {userAllowedListsRaw.join(', ')}
                    </span>
                    .
                  </>
                )}
              </p>
            </div>
          ) : (
            <>
              {/* KPIs superiores (4 tarjetas) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-[#21222D] border border-white/[0.08] rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">
                      Total colaboradores
                    </span>
                    <Users className="w-4 h-4 text-[#A9DFD8]" />
                  </div>
                  <div className="mt-2 text-2xl font-bold text-white">
                    {kpis.total}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {isManager
                      ? `${supervisorProgress.length} supervisor(es) en campaña`
                      : 'Asignados a tu lista'}
                  </p>
                </div>

                <div className="bg-[#21222D] border border-white/[0.08] rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">
                      Completadas
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-emerald-300">
                      {kpis.completed}
                    </span>
                    <span className="text-sm font-semibold text-emerald-400/90">
                      ({kpis.completionPercent}%)
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-[#171821] overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full transition-all duration-300"
                      style={{ width: `${kpis.completionPercent}%` }}
                    />
                  </div>
                </div>

                <div className="bg-[#21222D] border border-white/[0.08] rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">
                      En progreso / Pendientes
                    </span>
                    <Clock className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="mt-2 text-2xl font-bold text-amber-300">
                    {kpis.notCompleted}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {kpis.inProgress} en progreso · {kpis.pending} pendientes
                  </p>
                </div>

                <div className="bg-[#21222D] border border-white/[0.08] rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">
                      Promedio calificación final
                    </span>
                    <Award className="w-4 h-4 text-[#A9DFD8]" />
                  </div>
                  <div className="mt-2 text-2xl font-bold text-[#A9DFD8]">
                    {kpis.avgFinalScore !== null
                      ? `${kpis.avgFinalScore}%`
                      : '—'}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {kpis.completed > 0
                      ? `Sobre ${kpis.completed} evaluación(es) completada(s)`
                      : 'Sin evaluaciones completadas aún'}
                  </p>
                </div>
              </div>

              {/* Avance por Supervisor (solo isManager) */}
              {isManager && supervisorProgress.length > 0 && (
                <div className="bg-[#21222D] border border-white/[0.08] rounded-2xl p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-[#A9DFD8]" />
                      <h2 className="text-sm font-semibold text-white">
                        Avance por Supervisor
                      </h2>
                      <span className="text-xs text-slate-400">
                        ({supervisorProgress.length})
                      </span>
                    </div>
                    {supervisorFilter !== 'todos' && (
                      <button
                        type="button"
                        onClick={() => setSupervisorFilter('todos')}
                        className="text-xs text-[#A9DFD8] hover:underline cursor-pointer"
                      >
                        Ver todos los supervisores
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {supervisorProgress.map((sup) => {
                      const isSelected = supervisorFilter === sup.key;
                      const isDone = sup.total > 0 && sup.completed === sup.total;
                      return (
                        <button
                          key={sup.key}
                          type="button"
                          onClick={() =>
                            setSupervisorFilter(isSelected ? 'todos' : sup.key)
                          }
                          className={`text-left rounded-xl p-3 border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#A9DFD8]/10 border-[#A9DFD8]/50 ring-1 ring-[#A9DFD8]/30'
                              : 'bg-[#171821] border-white/[0.07] hover:border-white/[0.18]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className="text-xs font-semibold text-white truncate"
                              title={sup.label}
                            >
                              {sup.label}
                            </span>
                            <span
                              className={`text-xs font-bold shrink-0 ${
                                isDone ? 'text-emerald-300' : 'text-[#A9DFD8]'
                              }`}
                            >
                              {sup.completed}/{sup.total}
                            </span>
                          </div>
                          <div className="mt-2 h-1.5 w-full rounded-full bg-[#21222D] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isDone ? 'bg-emerald-400' : 'bg-[#A9DFD8]'
                              }`}
                              style={{ width: `${sup.percent}%` }}
                            />
                          </div>
                          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                            <span>{sup.percent}% avance</span>
                            <span className="text-[#A9DFD8]/90">
                              {isSelected ? 'Filtrado' : 'Filtrar'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Barra de acciones y filtros */}
              <div className="bg-[#21222D] border border-white/[0.08] rounded-2xl p-4 space-y-4">
                {isManager && (
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-white/[0.06]">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={handleSyncEmployeesDirectory}
                        disabled={activeCampaign.status === 'cerrada'}
                        title="Jalar o actualizar empleados y supervisores desde el padrón de CemenQtime"
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/35 hover:bg-sky-500/25 disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      >
                        <Users className="w-3.5 h-3.5" />
                        Sincronizar Padrón ({Object.keys(empleadosDB || {}).length})
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowImportModal(true)}
                        disabled={activeCampaign.status === 'cerrada'}
                        title={
                          activeCampaign.status === 'cerrada'
                            ? 'Reabre la campaña para importar nuevos registros'
                            : 'Analizar Excel de incidencias y vincular por número de empleado'
                        }
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#A9DFD8]/15 text-[#A9DFD8] border border-[#A9DFD8]/35 hover:bg-[#A9DFD8]/25 disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Analizar / Importar Excel
                      </button>

                      <button
                        type="button"
                        onClick={handleExportExcel}
                        disabled={isExporting || filteredRecords.length === 0}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 hover:bg-emerald-500/25 disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        {isExporting
                          ? 'Exportando...'
                          : 'Exportar Concentrado Excel'}
                      </button>

                      <button
                        type="button"
                        onClick={handleBatchPrint}
                        disabled={filteredRecords.length === 0}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/[0.06] text-slate-200 border border-white/[0.12] hover:bg-white/[0.12] disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Imprimir / PDF Lote
                      </button>
                    </div>

                    <span className="text-xs text-slate-400">
                      Mostrando{' '}
                      <strong className="text-slate-200">
                        {filteredRecords.length}
                      </strong>{' '}
                      de{' '}
                      <strong className="text-slate-200">
                        {campaignRecords.length}
                      </strong>{' '}
                      colaboradores
                    </span>
                  </div>
                )}

                {/* Controles de búsqueda y filtros */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar por nombre, código o puesto..."
                      className="w-full bg-[#171821] border border-white/[0.1] rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#A9DFD8]/60"
                    />
                  </div>

                  <div className="relative">
                    <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={statusFilter}
                      onChange={(e) =>
                        setStatusFilter(e.target.value as StatusFilter)
                      }
                      aria-label="Filtrar por estatus"
                      className="w-full bg-[#171821] border border-white/[0.1] rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-[#A9DFD8]/60"
                    >
                      <option value="todos">Todos los estatus</option>
                      <option value="pendiente">Pendiente</option>
                      <option value="en_progreso">En progreso</option>
                      <option value="completada">Completada</option>
                    </select>
                  </div>

                  {isManager && (
                    <div className="relative">
                      <UserCheck className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <select
                        value={supervisorFilter}
                        onChange={(e) => setSupervisorFilter(e.target.value)}
                        aria-label="Filtrar por supervisor"
                        className="w-full bg-[#171821] border border-white/[0.1] rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-[#A9DFD8]/60"
                      >
                        <option value="todos">Todos los supervisores</option>
                        {supervisorProgress.map((sup) => (
                          <option key={sup.key} value={sup.key}>
                            {sup.label} ({sup.completed}/{sup.total})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {isManager && (
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <select
                        value={areaFilter}
                        onChange={(e) => setAreaFilter(e.target.value)}
                        aria-label="Filtrar por área"
                        className="w-full bg-[#171821] border border-white/[0.1] rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-[#A9DFD8]/60"
                      >
                        <option value="todos">Todas las áreas</option>
                        {areaOptions.map((area) => (
                          <option key={area} value={area}>
                            {area}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {hasActiveFilters && (
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                    <span>
                      Filtros activos: {filteredRecords.length} resultado(s)
                    </span>
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="inline-flex items-center gap-1 text-[#A9DFD8] hover:underline cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      Limpiar filtros
                    </button>
                  </div>
                )}
              </div>

              {/* Tabla de colaboradores */}
              <div className="bg-[#21222D] border border-white/[0.08] rounded-2xl overflow-hidden shadow-xl">
                {campaignRecords.length === 0 ? (
                  <div className="p-10 text-center">
                    <div className="w-12 h-12 rounded-xl bg-[#A9DFD8]/10 border border-[#A9DFD8]/25 flex items-center justify-center text-[#A9DFD8] mx-auto mb-3">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-semibold text-white">
                      No hay colaboradores cargados en esta campaña
                    </h3>
                    <p className="text-sm text-slate-400 max-w-md mx-auto mt-1.5">
                      Importa el archivo Excel con los colaboradores y sus
                      incidencias del año {activeCampaign.anioIncidencias} para
                      iniciar las evaluaciones.
                    </p>
                    {isManager && activeCampaign.status !== 'cerrada' && (
                      <button
                        type="button"
                        onClick={() => setShowImportModal(true)}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[#A9DFD8] text-[#171821] hover:bg-[#95d4cc] transition-colors cursor-pointer"
                      >
                        <Upload className="w-4 h-4" />
                        Importar Excel
                      </button>
                    )}
                  </div>
                ) : filteredRecords.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-slate-400">
                      Ningún colaborador coincide con los filtros seleccionados.
                    </p>
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="mt-3 text-xs font-semibold text-[#A9DFD8] hover:underline cursor-pointer"
                    >
                      Limpiar filtros
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#171821]/80 border-b border-white/[0.07] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          <th className="py-3 px-4">Colaborador</th>
                          <th className="py-3 px-4">Puesto / Área</th>
                          <th className="py-3 px-4">Supervisor</th>
                          <th className="py-3 px-4 text-center">Incidencias</th>
                          <th className="py-3 px-4 text-center">
                            Competencias
                          </th>
                          <th className="py-3 px-4 text-center">
                            Calif. Final
                          </th>
                          <th className="py-3 px-4 text-center">Estatus</th>
                          <th className="py-3 px-4 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.05] text-sm">
                        {filteredRecords.map((rec) => {
                          const isReadOnly =
                            activeCampaign.status === 'cerrada' ||
                            (!isManager && rec.status === 'completada');
                          const statusMeta = RECORD_STATUS_META[rec.status];

                          return (
                            <tr
                              key={rec.id}
                              className="hover:bg-white/[0.025] transition-colors"
                            >
                              <td className="py-3 px-4">
                                <div className="font-semibold text-white">
                                  {rec.nombre}
                                </div>
                                <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                                  {rec.empleadoId && (
                                    <span className="font-mono text-[#A9DFD8]/90">
                                      #{rec.empleadoId}
                                    </span>
                                  )}
                                  {rec.fechaIngreso && (
                                    <span>Ing: {rec.fechaIngreso}</span>
                                  )}
                                </div>
                              </td>

                              <td className="py-3 px-4">
                                <div className="text-slate-200 text-xs font-medium">
                                  {rec.puesto || '—'}
                                </div>
                                <div className="text-xs text-slate-400 mt-0.5">
                                  {rec.area || '—'}
                                </div>
                              </td>

                              <td className="py-3 px-4 text-xs text-slate-300">
                                {rec.supervisor || 'Sin supervisor'}
                              </td>

                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                <div className="text-xs font-semibold text-white">
                                  {rec.puntajesIncidencias.total}/
                                  {rec.puntajesIncidencias.maxTotal}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  {rec.puntajesIncidencias.porcentaje}%
                                </div>
                              </td>

                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                <div className="text-xs font-semibold text-white">
                                  {rec.puntajeCompetencias}/10
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  {rec.porcentajeCompetencias}%
                                </div>
                              </td>

                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getScoreBadgeClasses(
                                    rec.calificacionFinal,
                                  )}`}
                                >
                                  {rec.calificacionFinal}%
                                </span>
                              </td>

                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusMeta.badgeClasses}`}
                                >
                                  {statusMeta.label}
                                </span>
                                {rec.reabiertaPor &&
                                  rec.status === 'en_progreso' && (
                                    <div className="text-[10px] text-amber-300/80 mt-0.5">
                                      Reabierta por {rec.reabiertaPor}
                                    </div>
                                  )}
                              </td>

                              <td className="py-3 px-4">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedRecord(rec)}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                                      isReadOnly
                                        ? 'bg-white/[0.05] text-slate-200 border-white/[0.12] hover:bg-white/[0.1]'
                                        : 'bg-[#A9DFD8]/15 text-[#A9DFD8] border-[#A9DFD8]/35 hover:bg-[#A9DFD8]/25'
                                    }`}
                                  >
                                    {isReadOnly ? (
                                      <>
                                        <Eye className="w-3.5 h-3.5" />
                                        Ver
                                      </>
                                    ) : (
                                      <>
                                        <ClipboardCheck className="w-3.5 h-3.5" />
                                        Evaluar
                                      </>
                                    )}
                                  </button>

                                  {rec.status === 'completada' && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        printEvaluations(activeCampaign, [rec])
                                      }
                                      title="Imprimir / Guardar PDF"
                                      className="p-1.5 rounded-lg bg-white/[0.05] text-slate-300 border border-white/[0.1] hover:bg-white/[0.12] hover:text-white transition-colors cursor-pointer"
                                    >
                                      <Printer className="w-3.5 h-3.5" />
                                    </button>
                                  )}

                                  {isManager &&
                                    rec.status === 'completada' &&
                                    activeCampaign.status !== 'cerrada' && (
                                      <button
                                        type="button"
                                        onClick={() => handleReopenRecord(rec)}
                                        title="Reabrir evaluación para edición"
                                        className="p-1.5 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-colors cursor-pointer"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                      </button>
                                    )}

                                  {isManager && (
                                    <button
                                      type="button"
                                      onClick={() => setRecordToDelete(rec)}
                                      title="Eliminar registro de la campaña"
                                      className="p-1.5 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20 transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Modal: Nueva Campaña */}
      {showNewCampaignModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setShowNewCampaignModal(false)}
        >
          <div
            className="w-full max-w-md bg-[#21222D] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#A9DFD8]/15 text-[#A9DFD8] flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">
                  Nueva Campaña de Evaluación
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewCampaignModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="p-5 space-y-4">
              <div>
                <label
                  htmlFor="new-camp-nombre"
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
                >
                  Nombre de la campaña
                </label>
                <input
                  id="new-camp-nombre"
                  type="text"
                  required
                  value={newCampNombre}
                  onChange={(e) => setNewCampNombre(e.target.value)}
                  placeholder={`Evaluación Anual ${currentYear}`}
                  className="w-full bg-[#171821] border border-white/[0.12] rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#A9DFD8]/60"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="new-camp-emision"
                    className="block text-xs font-semibold text-slate-300 mb-1.5"
                  >
                    Año de emisión
                  </label>
                  <input
                    id="new-camp-emision"
                    type="number"
                    min={2000}
                    max={2100}
                    required
                    value={newCampAnioEmision}
                    onChange={(e) => setNewCampAnioEmision(e.target.value)}
                    className="w-full bg-[#171821] border border-white/[0.12] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#A9DFD8]/60"
                  />
                </div>

                <div>
                  <label
                    htmlFor="new-camp-incidencias"
                    className="block text-xs font-semibold text-slate-300 mb-1.5"
                  >
                    Año de incidencias
                  </label>
                  <input
                    id="new-camp-incidencias"
                    type="number"
                    min={2000}
                    max={2100}
                    required
                    value={newCampAnioIncidencias}
                    onChange={(e) => setNewCampAnioIncidencias(e.target.value)}
                    className="w-full bg-[#171821] border border-white/[0.12] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#A9DFD8]/60"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="new-camp-limite"
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
                >
                  Fecha límite (opcional)
                </label>
                <input
                  id="new-camp-limite"
                  type="date"
                  value={newCampFechaLimite}
                  onChange={(e) => setNewCampFechaLimite(e.target.value)}
                  className="w-full bg-[#171821] border border-white/[0.12] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#A9DFD8]/60"
                />
              </div>

              <p className="text-xs text-slate-400 bg-[#171821] border border-white/[0.06] rounded-xl p-3">
                La campaña se creará en estado <strong>Borrador</strong> con las
                reglas de equivalencias predeterminadas (/20). Podrás ajustar
                las reglas e importar el Excel antes de abrirla a supervisores.
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewCampaignModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[#A9DFD8] text-[#171821] hover:bg-[#95d4cc] transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Crear Campaña
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Analizador e Importación Excel */}
      {showImportModal && activeCampaign && (
        <EvaluationExcelImportModal
          campaign={activeCampaign}
          existingRecords={campaignRecords}
          onApplyMappedRecords={handleApplyMappedRecords}
          onClose={() => setShowImportModal(false)}
        />
      )}

      {/* Modal: Evaluación de 10 Competencias */}
      {selectedRecord && activeCampaign && (
        <EvaluationFormModal
          key={selectedRecord.id}
          campaign={activeCampaign}
          record={selectedRecord}
          currentUser={currentUser}
          readOnly={
            activeCampaign.status === 'cerrada' ||
            (!isManager && selectedRecord.status === 'completada')
          }
          onSave={handleSaveEvaluation}
          onClose={() => setSelectedRecord(null)}
        />
      )}

      {/* Modal: Confirmación de eliminación */}
      {recordToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setRecordToDelete(null)}
        >
          <div
            className="w-full max-w-md bg-[#21222D] border border-white/[0.1] rounded-2xl shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-300 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Eliminar colaborador de la campaña
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  ¿Seguro que deseas eliminar a{' '}
                  <strong className="text-white">
                    {recordToDelete.nombre}
                  </strong>{' '}
                  de esta campaña? Se perderán sus calificaciones e incidencias
                  capturadas en esta campaña.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteRecord}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-rose-500 text-white hover:bg-rose-600 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
