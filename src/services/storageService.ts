/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppConfig, DEFAULT_OVERTIME_RULES, Employee, EmployeeReport, PayrollSummary, ScheduleConfig } from '../types/attendance';
import { normalizeEmployeeId, normalizeSupervisorName } from '../utils/calendarUtils';

export const HORARIOS_POR_DEFECTO: Record<string, ScheduleConfig> = {
  "ADMO": {
    nombre: "Administrativo Estándar",
    dias: {
      0: null, // Domingo: Descanso
      1: { entrada: "08:00", salida: "17:00", comida: 60, cruzaMedianoche: false },
      2: { entrada: "08:00", salida: "17:00", comida: 60, cruzaMedianoche: false },
      3: { entrada: "08:00", salida: "17:00", comida: 60, cruzaMedianoche: false },
      4: { entrada: "08:00", salida: "17:00", comida: 60, cruzaMedianoche: false },
      5: { entrada: "08:00", salida: "17:00", comida: 60, cruzaMedianoche: false },
      6: { entrada: "08:00", salida: "13:00", comida: 0, cruzaMedianoche: false }
    }
  },
  "ADMOT2": {
    nombre: "Administrativo Turno 2",
    dias: {
      0: null,
      1: { entrada: "09:00", salida: "18:00", comida: 60, cruzaMedianoche: false },
      2: { entrada: "09:00", salida: "18:00", comida: 60, cruzaMedianoche: false },
      3: { entrada: "09:00", salida: "18:00", comida: 60, cruzaMedianoche: false },
      4: { entrada: "09:00", salida: "18:00", comida: 60, cruzaMedianoche: false },
      5: { entrada: "09:00", salida: "18:00", comida: 60, cruzaMedianoche: false },
      6: { entrada: "08:00", salida: "13:00", comida: 0, cruzaMedianoche: false }
    }
  },
  "NOCT1": {
    nombre: "Turno Nocturno Producción",
    dias: {
      0: null,
      1: { entrada: "22:00", salida: "06:00", comida: 30, cruzaMedianoche: true },
      2: { entrada: "22:00", salida: "06:00", comida: 30, cruzaMedianoche: true },
      3: { entrada: "22:00", salida: "06:00", comida: 30, cruzaMedianoche: true },
      4: { entrada: "22:00", salida: "06:00", comida: 30, cruzaMedianoche: true },
      5: { entrada: "22:00", salida: "06:00", comida: 30, cruzaMedianoche: true },
      6: null
    }
  }
};

const STORAGE_KEYS = {
  HORARIOS: 'attendanceProHorarios_v2',
  ASIGNACIONES: 'attendanceProAsignaciones_v2',
  EMPLEADOS_DB: 'attendanceProEmpleadosDB_v2',
  CONFIG: 'attendanceProConfig_v2',
  REPORTES_STATE: 'attendanceProReportesState_v2'
};

export const DEFAULT_CONFIG: AppConfig = {
  emailDestino: '',
  toleranciaAntes: 29,
  toleranciaDespues: 14,
  jornadaBase: 8.0,
  comidaDefault: 60,
  modoLectura: 'checadas_reales',
  minutosRebote: 15,
  horasLimiteLiberacion: 24,
  overtimeRules: { ...DEFAULT_OVERTIME_RULES },
  theme: 'dark'
};

export class StorageService {
  static loadHorarios(): Record<string, ScheduleConfig> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.HORARIOS);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && Object.keys(parsed).length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error reading horarios from storage, using defaults', e);
    }
    return JSON.parse(JSON.stringify(HORARIOS_POR_DEFECTO));
  }

  static saveHorarios(horarios: Record<string, ScheduleConfig>): void {
    try {
      localStorage.setItem(STORAGE_KEYS.HORARIOS, JSON.stringify(horarios));
    } catch (e) {
      console.error('Error saving horarios to localStorage', e);
    }
  }

  static loadAsignaciones(): Record<string, string> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ASIGNACIONES);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  }

  static saveAsignaciones(asignaciones: Record<string, string>): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ASIGNACIONES, JSON.stringify(asignaciones));
    } catch (e) {
      console.error('Error saving asignaciones', e);
    }
  }

  static loadSavedEmployees(): { empleados: Record<string, Employee>; savedAt: string } | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.EMPLEADOS_DB);
      if (!data) return null;
      const parsed = JSON.parse(data);
      if (parsed && parsed.empleados && typeof parsed.empleados === 'object') {
        const normalizedEmpleados: Record<string, Employee> = {};
        Object.values(parsed.empleados as Record<string, Employee>).forEach(emp => {
          const id = normalizeEmployeeId(emp.id);
          if (id) {
            normalizedEmpleados[id] = {
              ...emp,
              id,
              jefe: normalizeSupervisorName(emp.jefe)
            };
          }
        });
        return {
          empleados: normalizedEmpleados,
          savedAt: parsed.savedAt || new Date().toISOString()
        };
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  static saveEmployees(empleados: Record<string, Employee>): void {
    if (!empleados || Object.keys(empleados).length === 0) return;
    try {
      localStorage.setItem(STORAGE_KEYS.EMPLEADOS_DB, JSON.stringify({
        empleados,
        savedAt: new Date().toISOString()
      }));
    } catch (e) {
      console.error('Error saving employees DB', e);
    }
  }

  static clearSavedEmployees(): void {
    localStorage.removeItem(STORAGE_KEYS.EMPLEADOS_DB);
  }

  static loadConfig(): AppConfig {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CONFIG);
      if (!data) return DEFAULT_CONFIG;
      const parsed = JSON.parse(data);
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        overtimeRules: {
          ...DEFAULT_OVERTIME_RULES,
          ...(parsed?.overtimeRules || {}),
        },
      };
    } catch (e) {
      return DEFAULT_CONFIG;
    }
  }

  static saveConfig(config: Partial<AppConfig>): void {
    try {
      const current = this.loadConfig();
      const updated = { ...current, ...config };
      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving config', e);
    }
  }

  static saveReportesState(state: {
    reportes: EmployeeReport[];
    resumen: PayrollSummary | null;
    selectedWeek?: string;
  }): void {
    const nowISO = new Date().toISOString();
    try {
      localStorage.setItem(
        STORAGE_KEYS.REPORTES_STATE,
        JSON.stringify({
          reportes: state.reportes,
          resumen: state.resumen,
          selectedWeek: state.selectedWeek,
          updatedAt: nowISO,
        })
      );
    } catch {
      // Si se excede la cuota de 5MB de localStorage (ej. por adjuntos base64 o catálogos grandes),
      // guardar versión compacta preservando todas las incidencias, checadas y ediciones del supervisor
      try {
        const compactReportes = state.reportes.map(rep => ({
          ...rep,
          dias: rep.dias.map(d => ({
            ...d,
            registrosCrudosDia: undefined,
            formatoSubidoBase64: undefined,
          })),
        }));
        localStorage.setItem(
          STORAGE_KEYS.REPORTES_STATE,
          JSON.stringify({
            reportes: compactReportes,
            resumen: state.resumen,
            selectedWeek: state.selectedWeek,
            updatedAt: nowISO,
          })
        );
      } catch (err) {
        console.warn('Error saving compact reportes state to localStorage', err);
      }
    }
  }

  static loadReportesState(): {
    reportes: EmployeeReport[];
    resumen: PayrollSummary | null;
    selectedWeek?: string;
    updatedAt?: string;
  } | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.REPORTES_STATE);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.reportes)) {
        return {
          reportes: parsed.reportes,
          resumen: parsed.resumen || null,
          selectedWeek: parsed.selectedWeek,
          updatedAt: parsed.updatedAt,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  static exportBackup(empleadosDB: Record<string, Employee>): Blob {
    const payload = {
      tipo: 'CemenQtime_Respaldo',
      version: 2,
      exportadoEn: new Date().toISOString(),
      horarios: this.loadHorarios(),
      asignaciones: this.loadAsignaciones(),
      empleados: empleadosDB && Object.keys(empleadosDB).length > 0
        ? empleadosDB
        : (this.loadSavedEmployees()?.empleados || {}),
      config: this.loadConfig()
    };
    return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  }

  static async importBackup(file: File): Promise<{
    horarios?: Record<string, ScheduleConfig>;
    asignaciones?: Record<string, string>;
    empleados?: Record<string, Employee>;
    config?: AppConfig;
  }> {
    const text = await file.text();
    const payload = JSON.parse(text);

    if (
      !payload ||
      (payload.tipo &&
        !payload.tipo.includes('CemenQtime') &&
        !payload.tipo.includes('AttendancePRO'))
    ) {
      throw new Error('El archivo seleccionado no es un respaldo válido de CemenQtime.');
    }

    if (payload.horarios) this.saveHorarios(payload.horarios);
    if (payload.asignaciones) this.saveAsignaciones(payload.asignaciones);
    if (payload.empleados) this.saveEmployees(payload.empleados);
    if (payload.config) this.saveConfig(payload.config);

    return {
      horarios: payload.horarios,
      asignaciones: payload.asignaciones,
      empleados: payload.empleados,
      config: payload.config
    };
  }
}
