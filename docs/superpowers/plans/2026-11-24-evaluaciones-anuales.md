# Módulo de Evaluaciones Anuales de Desempeño — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el módulo completo de Evaluaciones Anuales de Desempeño en CemenQtime basado en `Formato_de_desempeño_2023.docx` (Enfoque A: persistencia en `portal_db.json` + SSE, Excel import/export con `xlsx`/`exceljs` y formato oficial imprimible/PDF).

**Architecture:** Se agrega el módulo `'evaluaciones'` al sistema de permisos `PortalModule`, se persisten `evaluationCampaigns` y `evaluationRecords` en `portal_db.json` vía `/api/portal/sync` con broadcast SSE en `server.ts`, y se construye una capa pura de cálculo/Excel/impresión (`src/services/evaluationService.ts`) separada de los componentes React en `src/components/portal/evaluations/`.

**Tech Stack:** React 19, TypeScript 5, Tailwind CSS 4, Express (`server.ts`), `xlsx`, `exceljs`, `lucide-react`, Node `node:test` vía `tsx`.

**Spec:** `docs/superpowers/specs/2026-11-24-evaluaciones-anuales-design.md`

## Global Constraints

- Cero dependencias npm nuevas (usar únicamente `xlsx`, `exceljs`, `lucide-react` y librerías ya presentes en `package.json`).
- Los 10 criterios de competencias y sus 3 etiquetas textuales (`1`, `0.5`, `0`) deben coincidir exactamente con `Formato_de_desempeño_2023.docx`.
- Los usuarios con rol `supervisor` solo pueden ver y evaluar colaboradores cuyo `supervisor` normalizado pertenezca a `getUserAllowedLists(currentUser)`.
- No romper ni sobrescribir datos existentes en `portal_db.json` (`users`, `incidents`, `dispersals`, `empleadosDB`, `reportes`).
- `npm run lint` (`tsc --noEmit`) y `npm run build` deben pasar sin errores antes de declarar terminado el trabajo.

## Review Focus

- **Rangos de equivalencias con huecos o valores fuera de rango:** si RH edita un rubro y deja un hueco o un conteo negativo/mayor al último rango, `scoreIncidenceCount` debe devolver `0` de forma segura (y nunca `NaN` ni `undefined`).
- **Excel con encabezados variados o filas vacías/fechas seriales de Excel:** el parser debe reconocer encabezados estilo Mail Merge (`FI`, `INC_Int`, `RE`, `PCGyPSG`, `hireDate`, `Departamento`) y variantes en español con acentos/mayúsculas, convertir fechas seriales de Excel a `DD/MM/YYYY`, e ignorar filas vacías sin fallar.
- **Nombres de supervisor con acentos, espacios extra o distinta capitalización:** el filtro de visibilidad del supervisor debe normalizar ambos lados con `normalizeSupervisorName` para no ocultar colaboradores legítimos ni filtrar ajenos.
- **Recálculo masivo al cambiar reglas de equivalencias:** cuando RH modifica la tabla `/20` en una campaña con evaluaciones ya completadas o pendientes, se deben recalcular `puntajesIncidencias` y `calificacionFinal` preservando las competencias ya capturadas.
- **Impresión/PDF sin pérdida de datos o inyección HTML:** el generador de HTML imprimible debe escapar caracteres especiales (`<`, `>`, `&`, `"`) en nombres, puestos y comentarios, y soportar tanto impresión individual como lote multipágina (`page-break-after: always`).

---

### Task 1: Asset del logo, tipos de evaluaciones y motor de cálculo / Excel / impresión

**Files:**
- Create: `public/assets/cemenquin-eval-logo.png` (extraído de `/home/antigravity/Formato_de_desempeño_2023.docx` → `word/media/image1.png`)
- Create: `src/types/evaluations.ts`
- Create: `src/services/evaluationService.ts`
- Test: `scripts/test-evaluations.ts`

**Interfaces:**
- Produces in `src/types/evaluations.ts`:
  - `EvaluationCompetencyId` (union de los 10 ids)
  - `CompetencyScore = 1 | 0.5 | 0 | null`
  - `CompetencyDefinition` y `EVALUATION_COMPETENCIES: CompetencyDefinition[]`
  - `IncidenceMetricKey = 'faltas' | 'incapacidades' | 'retardos' | 'permisos'`
  - `IncidenceRuleBracket = { min: number; max: number | null; puntos: number }`
  - `IncidenceScoringRules = Record<IncidenceMetricKey, IncidenceRuleBracket[]>`
  - `DEFAULT_INCIDENCE_RULES: IncidenceScoringRules`
  - `EvaluationCampaign`, `EmployeeEvaluationRecord`, `EvaluationRecordStatus`
- Produces in `src/services/evaluationService.ts`:
  - `getMetricMaxPoints(brackets: IncidenceRuleBracket[]): number`
  - `getRulesMaxTotal(rules: IncidenceScoringRules): number`
  - `scoreIncidenceCount(count: number, brackets: IncidenceRuleBracket[]): number`
  - `calculateEvaluationScores(incidencias, competencias, rules)`
  - `recalculateRecordWithRules(record: EmployeeEvaluationRecord, rules: IncidenceScoringRules): EmployeeEvaluationRecord`
  - `parseEvaluationsExcelBuffer(buffer: ArrayBuffer, campaignId: string, rules: IncidenceScoringRules): { records: EmployeeEvaluationRecord[]; warnings: string[] }`
  - `downloadEvaluationTemplateExcel(): Promise<void>`
  - `exportEvaluationsSummaryExcel(campaign: EvaluationCampaign, records: EmployeeEvaluationRecord[]): Promise<void>`
  - `buildPrintableEvaluationHtml(campaign: EvaluationCampaign, records: EmployeeEvaluationRecord[], logoUrl?: string): string`
  - `printEvaluations(campaign: EvaluationCampaign, records: EmployeeEvaluationRecord[]): void`

- [ ] **Step 1: Extraer el logo oficial del `.docx` a `public/assets/cemenquin-eval-logo.png`**
  Run Python one-liner extracting `word/media/image1.png` from `/home/antigravity/Formato_de_desempeño_2023.docx`.
  Expected: Archivo `public/assets/cemenquin-eval-logo.png` creado (~34 KB).

- [ ] **Step 2: Escribir prueba inicial en `scripts/test-evaluations.ts`**
  Cubrir:
  1. `scoreIncidenceCount` con rangos default, valor fuera de rango / negativo y huecos → `0` seguro sin `NaN`.
  2. `calculateEvaluationScores` con 10 competencias (`1`, `0.5`, `0`) + incidencias `/20` → verificar `porcentajeCompetencias`, `porcentajeIncidencias` y promedio 50/50 `calificacionFinal`.
  3. `recalculateRecordWithRules` al modificar reglas preserva `competencias` y actualiza `puntajesIncidencias` y `calificacionFinal`.
  4. `parseEvaluationsExcelBuffer` con archivo en memoria creado con `xlsx` usando encabezados Mail Merge (`nombre`, `hireDate` serial de Excel, `Supervisor`, `Puesto`, `Departamento`, `FI`, `INC_Int`, `RE`, `PCGyPSG`) + una fila vacía.
  5. `buildPrintableEvaluationHtml` escapa `<script>` en nombre/comentarios, incluye marcas `X` en las casillas seleccionadas y `page-break-after: always` para múltiples registros.

- [ ] **Step 3: Ejecutar prueba para confirmar fallo inicial**
  Run: `npx tsx --test scripts/test-evaluations.ts`
  Expected: FAIL (módulos aún no creados).

- [ ] **Step 4: Implementar `src/types/evaluations.ts` y `src/services/evaluationService.ts`**
  Implementar todas las interfaces, los 10 criterios exactos del spec, el motor de cálculo, parser de Excel flexible, exportador `exceljs`, descarga de plantilla y generador de HTML imprimible fiel al Word.

- [ ] **Step 5: Ejecutar pruebas y verificar que pasen**
  Run: `npx tsx --test scripts/test-evaluations.ts`
  Expected: PASS (todas las pruebas en verde).

---

### Task 2: Permisos modulares, persistencia en servidor + SSE y `PortalService`

**Files:**
- Modify: `src/types/portal.ts`
- Modify: `server.ts`
- Modify: `src/services/portalService.ts`

**Interfaces:**
- Consumes: `EvaluationCampaign`, `EmployeeEvaluationRecord` de `src/types/evaluations.ts`
- Produces:
  - `'evaluaciones'` en `PortalModule`, `ALL_PORTAL_MODULES`, `PORTAL_MODULE_LABELS` y migración transparente en `getUserAllowedModules`.
  - `evaluationCampaigns?: EvaluationCampaign[]` y `evaluationRecords?: EmployeeEvaluationRecord[]` en `ServerPortalDatabase` (`server.ts`), persistidos en `writeDatabase` y transmitidos por SSE en `/api/portal/sync`.
  - En `PortalService`: `getEvaluationCampaigns()`, `saveEvaluationCampaigns(campaigns, options?)`, `getEvaluationRecords()`, `saveEvaluationRecords(records, options?)`, e hidratación desde `/api/portal/state` en `hydrateFromServer()`.

- [ ] **Step 1: Actualizar `src/types/portal.ts`**
  Agregar `'evaluaciones'` a `PortalModule`, `ALL_PORTAL_MODULES`, `PORTAL_MODULE_LABELS` y asegurar en `getUserAllowedModules` que `admin`, `rh` y `supervisor` reciban `'evaluaciones'` en su migración transparente (respetando listas explícitas cuando el admin decida quitarlo si ya migró, o habilitándolo por defecto para roles `rh`/`supervisor`).

- [ ] **Step 2: Actualizar `server.ts`**
  Agregar `evaluationCampaigns?: unknown[]` y `evaluationRecords?: unknown[]` a `ServerPortalDatabase`, soportarlo en `writeDatabase`, aceptarlo en `POST /api/portal/sync` y emitirlo en `broadcastRealtimeEvent` cuando cambie.

- [ ] **Step 3: Actualizar `src/services/portalService.ts`**
  Agregar claves `EVALUATION_CAMPAIGNS` y `EVALUATION_RECORDS` en `STORAGE_KEYS`, métodos `getEvaluationCampaigns`, `saveEvaluationCampaigns`, `getEvaluationRecords`, `saveEvaluationRecords`, y soporte en `hydrateFromServer` y `syncToServer`.

- [ ] **Step 4: Verificar compilación TypeScript**
  Run: `npm run lint`
  Expected: Exit code 0 (sin errores de tipos).

---

### Task 3: Editor de reglas de equivalencias e importador Excel

**Files:**
- Create: `src/components/portal/evaluations/IncidenceRulesEditor.tsx`
- Create: `src/components/portal/evaluations/EvaluationExcelImportModal.tsx`

**Interfaces:**
- Consumes: `IncidenceScoringRules`, `IncidenceMetricKey`, `DEFAULT_INCIDENCE_RULES`, `EvaluationCampaign`, `EmployeeEvaluationRecord` y funciones de `evaluationService.ts`.
- Produces:
  - `IncidenceRulesEditor`: props `{ rules: IncidenceScoringRules; onSaveRules: (rules: IncidenceScoringRules) => void; disabled?: boolean }`. Permite editar rangos (`min`, `max` o "o más", `puntos`) por cada uno de los 4 rubros, agregar/eliminar filas, restaurar valores sugeridos y guardar con recálculo inmediato.
  - `EvaluationExcelImportModal`: props `{ campaign: EvaluationCampaign; existingCount: number; onImport: (records: EmployeeEvaluationRecord[], mode: 'merge' | 'replace') => void; onClose: () => void }`. Incluye botón "Descargar plantilla Excel", carga drag-and-drop/selector de `.xlsx`/`.xls`/`.csv`, vista previa tabular con advertencias y puntajes precalculados, y selección de modo Combinar vs Reemplazar.

- [ ] **Step 1: Implementar `src/components/portal/evaluations/IncidenceRulesEditor.tsx`**
- [ ] **Step 2: Implementar `src/components/portal/evaluations/EvaluationExcelImportModal.tsx`**
- [ ] **Step 3: Verificar compilación TypeScript**
  Run: `npm run lint`
  Expected: Exit code 0.

---

### Task 4: Modal de Evaluación de 10 Competencias

**Files:**
- Create: `src/components/portal/evaluations/EvaluationFormModal.tsx`

**Interfaces:**
- Consumes: `EVALUATION_COMPETENCIES`, `EvaluationCampaign`, `EmployeeEvaluationRecord`, `CompetencyScore`, `calculateEvaluationScores`, `printEvaluations`.
- Produces:
  - `EvaluationFormModal`: props `{ campaign: EvaluationCampaign; record: EmployeeEvaluationRecord; currentUser: PortalUser; readOnly?: boolean; onSave: (updated: EmployeeEvaluationRecord) => void; onClose: () => void }`.
  - Muestra cabecera con datos del colaborador, tarjeta de Incidencias del año anterior (solo lectura con puntaje `/20`), las 10 competencias interactivas (`1`, `0.5`, `0` con etiquetas oficiales), campo opcional de observaciones, bloque de **Resumen Final en vivo** (`% Competencias`, `% Incidencias`, `Calificación Final`), botón **Guardar borrador**, **Finalizar evaluación** (valida 10/10 respondidas) e **Imprimir / Guardar PDF**.

- [ ] **Step 1: Implementar `src/components/portal/evaluations/EvaluationFormModal.tsx`**
- [ ] **Step 2: Verificar compilación TypeScript**
  Run: `npm run lint`
  Expected: Exit code 0.

---

### Task 5: Contenedor principal del módulo (`EvaluationsModuleView.tsx`)

**Files:**
- Create: `src/components/portal/evaluations/EvaluationsModuleView.tsx`

**Interfaces:**
- Consumes: `IncidenceRulesEditor`, `EvaluationExcelImportModal`, `EvaluationFormModal`, `evaluationService.ts`, `getUserAllowedLists`, `normalizeSupervisorName`.
- Produces:
  - `EvaluationsModuleView`: props `{ currentUser: PortalUser; campaigns: EvaluationCampaign[]; records: EmployeeEvaluationRecord[]; onUpdateCampaigns: (campaigns: EvaluationCampaign[]) => void; onUpdateRecords: (records: EmployeeEvaluationRecord[]) => void; onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void }`.
  - Para **Admin/RH**: selector/creación de campañas, cambio de estado (`borrador` → `activa` → `cerrada`), 3 sub-vistas (Tablero y Avance por Supervisor, Reglas de Equivalencias `/20`, Importar Excel), filtros por supervisor/área/estatus/búsqueda, acciones por fila (Evaluar/Ver, Reabrir, Imprimir PDF, Eliminar), botón Exportar Concentrado Excel e Imprimir/PDF en lote.
  - Para **Supervisor**: vista limpia enfocada en su equipo asignado (`getUserAllowedLists`), barra de progreso personal, filtros por estatus/búsqueda y acceso directo a evaluar e imprimir sus formatos.

- [ ] **Step 1: Implementar `src/components/portal/evaluations/EvaluationsModuleView.tsx`**
- [ ] **Step 2: Verificar compilación TypeScript**
  Run: `npm run lint`
  Expected: Exit code 0.

---

### Task 6: Integración en `SidebarNav.tsx` y `App.tsx`, build y prueba local

**Files:**
- Modify: `src/components/SidebarNav.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `EvaluationsModuleView`, `PortalService` evaluation methods, `userHasModuleAccess(currentUser, 'evaluaciones')`.

- [ ] **Step 1: Agregar entrada "Evaluaciones Anuales" en `src/components/SidebarNav.tsx`**
  Con ícono `Award` o `ClipboardCheck` de `lucide-react`, visibilidad controlada por `checkAccess('evaluaciones')`, y badge `pendingEvaluationsCount` para mostrar evaluaciones pendientes al supervisor.

- [ ] **Step 2: Integrar estado, sincronización SSE y renderizado en `src/App.tsx`**
  Cargar `evaluationCampaigns` y `evaluationRecords` desde `PortalService`, sincronizar en el listener de SSE (`portal_sync`), calcular `pendingEvaluationsCount` para el sidebar, agregar etiqueta de actividad en vivo para `evaluaciones` y renderizar `<EvaluationsModuleView />` cuando `portalTab === 'evaluaciones'`.

- [ ] **Step 3: Ejecutar verificación completa (pruebas + TypeScript + build)**
  Run:
  - `npx tsx --test scripts/test-evaluations.ts`
  - `npm run lint`
  - `npm run build`
  Expected: Todos con exit code 0.

- [ ] **Step 4: Levantar servidor local en modo daemon para prueba local**
  Run `npm run dev` (o `npm run start`) con `IsDaemon: true` y verificar `GET /api/health` + `GET /api/portal/state`.
