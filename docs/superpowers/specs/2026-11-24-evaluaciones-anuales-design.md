# Diseño: Módulo de Evaluaciones Anuales de Desempeño (CemenQtime)

**Fecha:** 2026-11-24
**Estado:** Pendiente de aprobación
**Formato base oficial:** `Formato_de_desempeño_2023.docx` (Cemenquin)

---

## 1. Propósito y Contexto

Digitalizar dentro de **CemenQtime** el proceso anual de Evaluación de Desempeño de Cemenquin, eliminando la combinación manual en Word/Excel. RH centraliza la carga de acumulados anuales de incidencias y la tabla de equivalencias; los supervisores califican en línea las 10 competencias de sus colaboradores asignados; y el sistema genera automáticamente el cálculo 50/50, el concentrado en Excel y el formato oficial imprimible/PDF listo para firma del evaluador.

---

## 2. Objetivos, No-Objetivos y Anti-Objetivos

### Objetivos
- Permitir a **RH / Admin** crear campañas anuales (ej. *Emisión 2026 — Incidencias 2025*), configurar la tabla de equivalencias de incidencias y cargar un Excel con los acumulados anuales por colaborador.
- Permitir a cada **Supervisor** evaluar en línea únicamente a los colaboradores de sus listas asignadas (`getUserAllowedLists`), capturando los 10 criterios de competencias (`1`, `0.5`, `0`).
- Calcular automáticamente el puntaje de competencias (50%), el puntaje de incidencias (`/20` → 50%) y la **Calificación Final** (promedio 50/50).
- Dar a RH seguimiento de avance por supervisor, exportación de concentrado en Excel y generación del **formato oficial imprimible / Guardar como PDF** (individual o en lote multipágina) fiel al documento de Cemenquin.
- Sincronizar todo en tiempo real con el backend actual (`portal_db.json` + SSE) y mantener permisos modulares en `PortalModule`.

### No-Objetivos
- Generación de archivos `.docx` editables individuales desde servidor (descartado al elegir Enfoque A).
- Gestión de sueldos o incrementos salariales (el formato oficial actual no incluye compensación).
- Cálculo automático del acumulado anual a partir de checadas históricas de años previos (los acumulados provienen del Excel que sube RH).

### Anti-Objetivos
- Exponer colaboradores de otros supervisores a un usuario con rol `supervisor`.
- Romper la persistencia existente de `portal_db.json`, usuarios, nóminas o incidencias actuales.
- Agregar dependencias npm pesadas innecesarias cuando `xlsx` y `exceljs` ya están instalados.

---

## 3. Enfoques Considerados y Decisión

- **Enfoque A (Seleccionado):** Módulo nativo integrado a CemenQtime (`portal_db.json` + SSE + `xlsx`/`exceljs` + formato oficial imprimible/PDF multipágina). Cero dependencias nuevas, respaldo espejo automático en `~/.cemenqtime_data`, despliegue idéntico en Hostinger.
- **Enfoque B (Descartado):** Enfoque A más generación de archivos `.docx` binarios en backend (`docxtemplater`/`pizzip`). Descartado por agregar dependencias y duplicar el mantenimiento de plantillas.

---

## 4. Modelo de Datos y Reglas de Cálculo

### 4.1 Los 10 Criterios de Competencias (50%)

Exactos al formato oficial (`1` / `0.5` / `0`, máximo 10 puntos):

| # | Clave | Criterio | Pregunta | `1` | `0.5` | `0` |
|---|---|---|---|---|---|---|
| 1 | `dominio_puesto` | Dominio del puesto | Cuenta con los conocimientos necesarios para desempeñar sus funciones | Cumple | Desarrollo | No cumple |
| 2 | `multifuncionalidad` | Multifuncionalidad | Cuenta con la capacidad de cubrir otros puestos (iguales o ascendentes) cuando se requiere | Cumple | Desarrollo | No cumple |
| 3 | `calidad` | Calidad | ¿Cómo califica la calidad de los trabajos entregados? | Bueno | Regular | Malo |
| 4 | `mejora_trabajo` | Mejora del trabajo | Adquirió nuevas habilidades y conocimientos para aplicar a su trabajo. | Realizado | Inconcluso | No se realizó |
| 5 | `responsabilidad` | Responsabilidad | Cumple con su trabajo en tiempo y forma. | Siempre | A veces | Nunca |
| 6 | `trabajo_equipo` | Trabajo en equipo | Realiza su parte del trabajo para cumplir en las metas del equipo. | Siempre | A veces | Nunca |
| 7 | `proactividad` | Proactividad | Toma la iniciativa en la solución de problemas sin que se le solicitara. | Siempre | A veces | Nunca |
| 8 | `compromiso` | Compromiso | Cuenta con la disponibilidad de trabajar días festivos / tiempo extra cuando se requiere. | Siempre | A veces | Nunca |
| 9 | `actitud_servicio` | Actitud de servicio | Mantiene un trato cordial y de servicio hacia las personas. | Siempre | A veces | Nunca |
| 10 | `adaptacion_cambio` | Adaptación al cambio | Acepta realizar diferentes actividades, aunque implique salir de la rutina de su puesto. | Siempre | A veces | Nunca |

### 4.2 Tabla de Equivalencias de Incidencias (50%, editable por RH)

Cada uno de los 4 rubros (`faltas`, `incapacidades`, `retardos`, `permisos`) tiene una lista configurable de rangos `{ min: number; max: number | null; puntos: number }` (por defecto hasta 5 puntos por rubro, sumando `maxPuntajeTotal = 20`, también ajustable si RH cambia los máximos).

**Reglas iniciales sugeridas (editables por RH antes o durante la campaña):**
- **Faltas Injustificadas (`FI`):** `0` → 5 pts | `1` → 4 pts | `2` → 3 pts | `3` → 2 pts | `4` → 1 pt | `5+` → 0 pts
- **Incapacidades (`INC_Int`):** `0` → 5 pts | `1` → 4 pts | `2` → 3 pts | `3` → 2 pts | `4` → 1 pt | `5+` → 0 pts
- **Retardos (`RE`):** `0` → 5 pts | `1-2` → 4 pts | `3-4` → 3 pts | `5-6` → 2 pts | `7-9` → 1 pt | `10+` → 0 pts
- **Permisos (`PCGyPSG`):** `0` → 5 pts | `1-2` → 4 pts | `3-4` → 3 pts | `5-6` → 2 pts | `7-9` → 1 pt | `10+` → 0 pts

Cuando RH guarda un cambio en la tabla de equivalencias de una campaña, el sistema recalcula automáticamente los puntajes de incidencias y la calificación final de todos los registros de esa campaña.

### 4.3 Fórmulas de Resumen Final

- `puntajeCompetencias` = suma de los 10 criterios (`0` a `10`)
- `porcentajeCompetencias` = `(puntajeCompetencias / 10) * 100` (`0%` a `100%`)
- `puntajeIncidencias` = `valorFI + valorINC + valorRE + valorPER` (`0` a `maxPuntajeTotal`, default `20`)
- `porcentajeIncidencias` = `(puntajeIncidencias / maxPuntajeTotal) * 100` (`0%` a `100%`)
- `calificacionFinal` = `round(((porcentajeCompetencias + porcentajeIncidencias) / 2), 1)` (promedio 50% competencias + 50% incidencias)

### 4.4 Entidades Principales (`src/types/evaluations.ts`)

- `EvaluationCampaign`: `id`, `nombre`, `anioEmision`, `anioIncidencias`, `status` (`'borrador' | 'activa' | 'cerrada'`), `fechaLimite?`, `rules` (`IncidenceScoringRules`), `creadaPor`, `creadaEn`, `abiertaEn?`, `cerradaEn?`.
- `EmployeeEvaluationRecord`: `id`, `campaignId`, `empleadoId?`, `nombre`, `fechaIngreso`, `supervisor`, `puesto`, `area`, `justificacion` (default `'Evaluación Anual.'`), `incidencias` (`{ faltas, incapacidades, retardos, permisos }`), `puntajesIncidencias` (`{ faltas, incapacidades, retardos, permisos, total, maxTotal, porcentaje }`), `competencias`, `puntajeCompetencias`, `porcentajeCompetencias`, `calificacionFinal`, `comentariosEvaluador?`, `status` (`'pendiente' | 'en_progreso' | 'completada'`), `fechaEvaluacion?`, `evaluadoPor?`, `evaluadoPorId?`, `actualizadaEn`.

---

## 5. Flujo de Interfaz y Permisos

### Acceso y Navegación
- Nuevo módulo `'evaluaciones'` en `PortalModule` (`Evaluaciones Anuales`).
- Visible en `SidebarNav` y configurable por usuario en `AdminUsersView`.
- Migración transparente en `getUserAllowedModules`: habilitado por defecto para `admin`, `rh` y `supervisor` (sin romper usuarios ya guardados).

### Vista RH / Admin (pestañas internas del módulo)
1. **Panel y Avance (Tablero):** Selector de campaña activa + botón "Nueva Campaña" (con cambio de estado Borrador / Activa / Cerrada), KPIs (Total, Completadas, En progreso, Pendientes, Promedio general), resumen de avance agrupado por supervisor y tabla filtrable de colaboradores (por supervisor, área, estatus y búsqueda). Acciones por fila: Evaluar/Ver, Reabrir (si completada), Imprimir/PDF, Eliminar. Acciones globales: Exportar Excel concentrado, Imprimir/PDF en lote.
2. **Importar Excel de Acumulados:** Botón para descargar plantilla Excel oficial (con columnas `Codigo`, `nombre`, `hireDate`, `Supervisor`, `Puesto`, `Departamento`, `FI`, `INC_Int`, `RE`, `PCGyPSG`) + zona drag-and-drop para cargar el Excel de RH. Reconoce automáticamente tanto los encabezados del Mail Merge original como variantes en español, muestra vista previa con validación y puntaje precalculado antes de importar (modo combinar/actualizar o reemplazar registros de la campaña).
3. **Reglas de Equivalencias (`/20`):** Editor visual por rubro (Faltas, Incapacidades, Retardos, Permisos) para agregar, editar o eliminar rangos (`Mínimo`, `Máximo`, `Puntos`), vista previa del puntaje máximo total (`/20`) y botón "Guardar y Recalcular Campaña".

### Vista Supervisor
- Ve únicamente la campaña activa (o histórico de campañas cerradas en solo lectura) filtrada estrictamente a los colaboradores cuyo `supervisor` coincide con `getUserAllowedLists(currentUser)` (normalizado sin acentos/mayúsculas).
- KPIs de su avance personal (Completadas vs. Pendientes).
- Al abrir un colaborador, accede al formulario de **Evaluación por Competencias** con:
  - Cabecera con datos del colaborador y bloque de **Incidencias del año anterior** (solo lectura, mostrando conteo y puntaje `/20`).
  - Tabla interactiva de las 10 competencias con botones claros para `1`, `0.5` y `0` (mostrando la etiqueta textual oficial de cada criterio).
  - Campo opcional de observaciones del evaluador.
  - Resumen Final calculado en vivo (`% Competencias`, `% Incidencias`, `Calificación Final`).
  - Botones **Guardar borrador** y **Finalizar evaluación** (requiere las 10 competencias contestadas).
  - Botón **Imprimir / Guardar PDF** disponible en cuanto esté completada.

### Formato Oficial Imprimible / PDF
- Componente dedicado que replica la estructura y distribución del `Formato_de_desempeño_2023.docx`:
  - Encabezado con logo oficial de Cemenquin (extraído del `.docx` a `public/assets/cemenquin-eval-logo.png`), título `FORMATO EVALUACIÓN DE DESEMPEÑO` y `AÑO DE EMISIÓN`.
  - Bloque de datos del colaborador (`Nombre`, `Fecha de evaluación`, `Fecha de ingreso`, `Supervisor`, `Puesto`, `Justificación: Evaluación Anual.`, `Área`).
  - Tabla de 10 competencias con la casilla marcada con **"X"** y el puntaje obtenido.
  - Tabla de Incidencias del año anterior (`Faltas Injustificadas`, `Incapacidades`, `Retardos`, `Permisos` y `Puntaje total incidencias: X/20`).
  - Tabla de `RESUMEN FINAL` (`Evaluación por competencias %`, `Puntaje total incidencias %`, `Calificación final %`).
  - Pie con línea de `NOMBRE Y FIRMA DEL EVALUADOR`.
- Impresión limpia mediante ventana de impresión dedicada con `@page { size: letter; margin: 12mm; }` y soporte para lote multipágina (`page-break-after: always`).

---

## 6. Arquitectura de Archivos a Crear / Modificar

### Nuevos archivos
- `public/assets/cemenquin-eval-logo.png` — Logo oficial extraído del `.docx`.
- `src/types/evaluations.ts` — Tipos, constantes de los 10 criterios y reglas por defecto.
- `src/services/evaluationService.ts` — Motor de cálculo de equivalencias y promedios 50/50, parser de Excel (`xlsx`), generador de plantilla Excel y exportador de concentrado (`exceljs`), y generador de HTML imprimible oficial.
- `src/components/portal/evaluations/EvaluationsModuleView.tsx` — Contenedor principal del módulo (gestión de campañas, pestañas RH/Admin, vista Supervisor).
- `src/components/portal/evaluations/EvaluationFormModal.tsx` — Formulario de evaluación de 10 competencias + resumen en vivo.
- `src/components/portal/evaluations/IncidenceRulesEditor.tsx` — Editor visual de la tabla de equivalencias de RH.
- `src/components/portal/evaluations/EvaluationExcelImportModal.tsx` — Importador de Excel con vista previa y descarga de plantilla.

### Archivos existentes a modificar
- `src/types/portal.ts` — Agregar `'evaluaciones'` a `PortalModule`, `ALL_PORTAL_MODULES`, `PORTAL_MODULE_LABELS` y `getUserAllowedModules`.
- `server.ts` — Agregar `evaluationCampaigns` y `evaluationRecords` a `ServerPortalDatabase`, `readDatabase`, `writeDatabase`, `/api/portal/sync` y broadcast SSE.
- `src/services/portalService.ts` — Persistencia local y sincronización con servidor para campañas y registros de evaluación.
- `src/components/SidebarNav.tsx` — Agregar entrada "Evaluaciones Anuales" con badge de pendientes para supervisores.
- `src/App.tsx` — Integrar estado de evaluaciones, sincronización SSE y renderizado de `EvaluationsModuleView` en `portalTab === 'evaluaciones'`.

---

## 7. Verificación Local
- `npm run lint` (`tsc --noEmit`) y `npm run build` sin errores.
- Pruebas automatizadas del motor de cálculo (`evaluationService.ts`: equivalencias, promedio 50/50, parser de Excel).
- Servidor local levantado para prueba manual completa (flujo RH → creación de campaña, edición de equivalencias, importación de Excel, apertura → flujo Supervisor → evaluación de 10 criterios → impresión PDF y exportación Excel).
