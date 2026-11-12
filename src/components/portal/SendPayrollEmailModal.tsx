/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Mail,
  Send,
  Users,
  UserCheck,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Sparkles,
  AtSign,
  RotateCcw,
  Check,
} from 'lucide-react';
import { EmployeeReport } from '../../types/attendance';
import {
  EmailServerConfig,
  PortalNotification,
  PortalUser,
  getUserAllowedLists,
} from '../../types/portal';
import { generatePayrollExcelBase64 } from '../../services/excelExportService';
import { PortalService } from '../../services/portalService';

interface SendPayrollEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportes: EmployeeReport[];
  supervisorsList: string[];
  selectedSupervisor: string;
  portalUsers: PortalUser[];
  currentUser: PortalUser;
  semanaNumero: number;
  semanaPeriodo: string;
  horasLimite?: number;
  emailConfig: EmailServerConfig;
  defaultCustomEmail?: string;
  onSaveEmailConfig?: (cfg: EmailServerConfig, options?: { silent?: boolean }) => void;
  onDisperseAndNotify?: (
    targetSupervisors: string[],
    customMessage?: string
  ) => void;
  onAppendNotifications?: (newNotifs: PortalNotification[]) => void;
  onSuccessToast?: (msg: string, title?: string) => void;
}

type RecipientMode = 'supervisor_user' | 'custom_email';

const FALLBACK_SUBJECT =
  '📋 [CemenQtime] Nómina Semana {semana} Lista para Validación — {supervisor}';
const FALLBACK_BODY = `Hola {nombre},\n\nEl área de Nóminas ({dispersado_por}) te comparte la lista de asistencia correspondiente a la Semana {semana} ({periodo}).\n\n⏳ TIEMPO LÍMITE DE LIBERACIÓN: {fecha_limite}\n\nPor favor ingresa al sistema CemenQtime para revisar las checadas de tu equipo, autorizar tiempos extras o subir formatos de respaldo y liberar tu nómina a tiempo.`;

export const SendPayrollEmailModal: React.FC<SendPayrollEmailModalProps> = ({
  isOpen,
  onClose,
  reportes,
  supervisorsList,
  selectedSupervisor,
  portalUsers,
  currentUser,
  semanaNumero,
  semanaPeriodo,
  horasLimite = 24,
  emailConfig,
  defaultCustomEmail = '',
  onSaveEmailConfig,
  onDisperseAndNotify,
  onAppendNotifications,
  onSuccessToast,
}) => {
  // Mapear cada supervisor del catálogo con el usuario registrado en portalUsers y su correo
  const supervisorDirectory = useMemo(() => {
    return supervisorsList.map((supName) => {
      const normSup = supName.trim().toUpperCase();
      const matchedUser = portalUsers.find(
        (u) =>
          u.active !== false &&
          (u.supervisorName?.trim().toUpperCase() === normSup ||
            getUserAllowedLists(u).some((l) => l.trim().toUpperCase() === normSup))
      );
      const empCount = reportes.filter(
        (r) => (r.empleado.jefe || '').trim().toUpperCase() === normSup
      ).length;
      return {
        supervisorName: supName,
        userId: matchedUser?.id,
        userName: matchedUser?.name || supName,
        userEmail: matchedUser?.email || '',
        empCount,
      };
    });
  }, [supervisorsList, portalUsers, reportes]);

  const [recipientMode, setRecipientMode] = useState<RecipientMode>('supervisor_user');
  const [selectedSupervisors, setSelectedSupervisors] = useState<string[]>([]);
  const [emailOverrides, setEmailOverrides] = useState<Record<string, string>>({});
  const [customEmailInput, setCustomEmailInput] = useState<string>('');
  const [customRecipientSupervisor, setCustomRecipientSupervisor] = useState<string>('');

  const [subjectTemplate, setSubjectTemplate] = useState<string>(() => {
    const latest = { ...PortalService.loadEmailConfig(), ...emailConfig };
    return latest.asuntoDispersion || FALLBACK_SUBJECT;
  });
  const [bodyTemplate, setBodyTemplate] = useState<string>(() => {
    const latest = { ...PortalService.loadEmailConfig(), ...emailConfig };
    return latest.mensajeDispersion || FALLBACK_BODY;
  });
  const [extraInstruction, setExtraInstruction] = useState<string>('');
  const [attachExcelFile, setAttachExcelFile] = useState<boolean>(true);
  const [alsoDisperseInSystem, setAlsoDisperseInSystem] = useState<boolean>(true);
  const [saveAsDefaultTemplate, setSaveAsDefaultTemplate] = useState<boolean>(true);
  const [templateSavedBadge, setTemplateSavedBadge] = useState<boolean>(false);

  const [isSending, setIsSending] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  const wasOpenRef = useRef<boolean>(false);
  const hasModifiedTemplateRef = useRef<boolean>(false);
  const latestEmailConfigRef = useRef<EmailServerConfig>(emailConfig);

  useEffect(() => {
    latestEmailConfigRef.current = emailConfig;
  }, [emailConfig]);

  // Inicializar selección únicamente cuando el modal pasa de cerrado a abierto (false -> true)
  // Sin incluir emailConfig ni supervisorDirectory como disparadores de reinicio mientras está abierto
  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      hasModifiedTemplateRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;
    hasModifiedTemplateRef.current = false;

    const latestCfg = {
      ...PortalService.loadEmailConfig(),
      ...latestEmailConfigRef.current,
    };

    setFeedback(null);
    setTemplateSavedBadge(false);
    setSubjectTemplate(latestCfg.asuntoDispersion || FALLBACK_SUBJECT);
    setBodyTemplate(latestCfg.mensajeDispersion || FALLBACK_BODY);

    if (selectedSupervisor) {
      setSelectedSupervisors([selectedSupervisor]);
      setCustomRecipientSupervisor(selectedSupervisor);
      const matched = supervisorDirectory.find(
        (d) => d.supervisorName.trim().toUpperCase() === selectedSupervisor.trim().toUpperCase()
      );
      setCustomEmailInput(matched?.userEmail || defaultCustomEmail || '');
    } else {
      setSelectedSupervisors(supervisorsList);
      setCustomRecipientSupervisor('');
      setCustomEmailInput(defaultCustomEmail || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const buildUpdatedEmailConfig = (subj: string, body: string): EmailServerConfig => ({
    ...PortalService.loadEmailConfig(),
    ...latestEmailConfigRef.current,
    asuntoDispersion: subj,
    mensajeDispersion: body,
    updatedAt: new Date().toISOString(),
  });

  const persistTemplateChanges = (silent = true) => {
    if (!onSaveEmailConfig) return;
    const updatedCfg = buildUpdatedEmailConfig(subjectTemplate, bodyTemplate);
    latestEmailConfigRef.current = updatedCfg;
    onSaveEmailConfig(updatedCfg, { silent });
  };

  // Auto-persistir cambios de plantilla con debounce cuando "Guardar como Plantilla" está activo
  useEffect(() => {
    if (!isOpen || !hasModifiedTemplateRef.current || !saveAsDefaultTemplate || !onSaveEmailConfig) {
      return;
    }
    const timer = setTimeout(() => {
      persistTemplateChanges(true);
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, subjectTemplate, bodyTemplate, saveAsDefaultTemplate]);

  const handleSaveTemplateNow = () => {
    if (!onSaveEmailConfig) return;
    persistTemplateChanges(false);
    hasModifiedTemplateRef.current = false;
    setTemplateSavedBadge(true);
    setTimeout(() => setTemplateSavedBadge(false), 3500);
  };

  const handleCloseModal = () => {
    if (hasModifiedTemplateRef.current && saveAsDefaultTemplate && onSaveEmailConfig) {
      persistTemplateChanges(true);
      hasModifiedTemplateRef.current = false;
    }
    onClose();
  };

  if (!isOpen) return null;

  const toggleSupervisorSelection = (supName: string) => {
    setSelectedSupervisors((prev) =>
      prev.includes(supName) ? prev.filter((s) => s !== supName) : [...prev, supName]
    );
  };

  const handleSelectAllSupervisors = () => {
    if (selectedSupervisors.length === supervisorsList.length) {
      setSelectedSupervisors([]);
    } else {
      setSelectedSupervisors([...supervisorsList]);
    }
  };

  const insertVariableInBody = (variable: string) => {
    hasModifiedTemplateRef.current = true;
    setBodyTemplate(
      (prev) => `${prev}${prev.endsWith(' ') || prev.endsWith('\n') ? '' : ' '}${variable}`
    );
  };

  const renderPreviewText = (tpl: string, supName: string, recName: string) => {
    const periodoClean = semanaPeriodo.replace('|', ' al ');
    const limiteDate = new Date(Date.now() + (horasLimite || 24) * 3600000).toLocaleString('es-MX', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    const vars: Record<string, string> = {
      supervisor: supName || 'TODAS LAS LISTAS',
      nombre: recName || supName || 'Supervisor',
      semana: String(semanaNumero),
      periodo: periodoClean,
      dispersado_por: currentUser.name,
      fecha_limite: limiteDate,
      horas_limite: String(horasLimite || 24),
    };
    let out = tpl || '';
    Object.entries(vars).forEach(([k, v]) => {
      out = out.replace(new RegExp(`\\{${k}\\}`, 'gi'), v);
    });
    return out;
  };

  const handleSendViaServer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const updatedEmailConfig = buildUpdatedEmailConfig(subjectTemplate, bodyTemplate);
    if (saveAsDefaultTemplate && onSaveEmailConfig) {
      latestEmailConfigRef.current = updatedEmailConfig;
      onSaveEmailConfig(updatedEmailConfig, { silent: true });
      hasModifiedTemplateRef.current = false;
    }

    // Construir lista de destinatarios según el modo elegido
    const targetsToBuild: Array<{
      supervisorName: string;
      recipientName: string;
      recipientEmail: string;
      userId?: string;
      reportsForAttachment: EmployeeReport[];
    }> = [];

    if (recipientMode === 'supervisor_user') {
      if (selectedSupervisors.length === 0) {
        setFeedback({
          type: 'error',
          message: 'Selecciona al menos un supervisor de la lista para enviar el correo.',
        });
        return;
      }

      for (const supName of selectedSupervisors) {
        const entry = supervisorDirectory.find((d) => d.supervisorName === supName);
        const finalEmail = (emailOverrides[supName] ?? entry?.userEmail ?? '').trim();
        if (!finalEmail || !finalEmail.includes('@')) {
          setFeedback({
            type: 'error',
            message: `El supervisor "${supName}" no tiene un correo válido asignado. Ingresa su correo en la fila correspondiente.`,
          });
          return;
        }
        const supReports = reportes.filter(
          (r) => (r.empleado.jefe || '').trim().toUpperCase() === supName.trim().toUpperCase()
        );
        targetsToBuild.push({
          supervisorName: supName,
          recipientName: entry?.userName || supName,
          recipientEmail: finalEmail,
          userId: entry?.userId,
          reportsForAttachment: supReports.length > 0 ? supReports : reportes,
        });
      }
    } else {
      const emails = customEmailInput
        .split(/[,;]+/)
        .map((s) => s.trim())
        .filter((s) => s.includes('@'));

      if (emails.length === 0) {
        setFeedback({
          type: 'error',
          message: 'Por favor ingresa al menos una dirección de correo electrónico válida.',
        });
        return;
      }

      const supLabel = customRecipientSupervisor || selectedSupervisor || 'General';
      const supEntry = supervisorDirectory.find(
        (d) => d.supervisorName.trim().toUpperCase() === supLabel.trim().toUpperCase()
      );
      const filteredForTarget = customRecipientSupervisor
        ? reportes.filter(
            (r) =>
              (r.empleado.jefe || '').trim().toUpperCase() ===
              customRecipientSupervisor.trim().toUpperCase()
          )
        : selectedSupervisor
        ? reportes.filter(
            (r) =>
              (r.empleado.jefe || '').trim().toUpperCase() ===
              selectedSupervisor.trim().toUpperCase()
          )
        : reportes;

      for (const emailAddr of emails) {
        targetsToBuild.push({
          supervisorName: supLabel,
          recipientName: supEntry?.userName || emailAddr.split('@')[0],
          recipientEmail: emailAddr,
          userId: supEntry?.userId,
          reportsForAttachment: filteredForTarget.length > 0 ? filteredForTarget : reportes,
        });
      }
    }

    setIsSending(true);
    try {
      const dispatches = [];
      for (const item of targetsToBuild) {
        let attachmentFilename: string | undefined;
        let attachmentBase64: string | undefined;

        if (attachExcelFile && item.reportsForAttachment.length > 0) {
          const excelData = await generatePayrollExcelBase64(
            item.reportsForAttachment,
            semanaNumero,
            item.supervisorName === 'General' ? undefined : item.supervisorName
          );
          attachmentFilename = excelData.fileName;
          attachmentBase64 = excelData.base64;
        }

        dispatches.push({
          supervisorName: item.supervisorName,
          recipientName: item.recipientName,
          recipientEmail: item.recipientEmail,
          subject: renderPreviewText(subjectTemplate, item.supervisorName, item.recipientName),
          customBody: renderPreviewText(bodyTemplate, item.supervisorName, item.recipientName),
          attachmentFilename,
          attachmentBase64,
        });
      }

      const limiteLiberacion = new Date(Date.now() + (horasLimite || 24) * 3600000).toISOString();

      // Si el usuario marcó registrar dispersión / notificación en el sistema
      if (alsoDisperseInSystem) {
        if (recipientMode === 'supervisor_user' && onDisperseAndNotify) {
          onDisperseAndNotify(selectedSupervisors, extraInstruction || undefined);
        } else if (onAppendNotifications) {
          const nowISO = new Date().toISOString();
          const newNotifs: PortalNotification[] = targetsToBuild.map((t, idx) => ({
            id: `notif_custom_${semanaNumero}_${Date.now()}_${idx}`,
            targetSupervisor: t.supervisorName.toUpperCase(),
            targetUserId: t.userId,
            recipientEmail: t.recipientEmail,
            semanaNumero,
            semanaPeriodo,
            titulo: renderPreviewText(subjectTemplate, t.supervisorName, t.recipientName),
            mensaje: renderPreviewText(bodyTemplate, t.supervisorName, t.recipientName),
            enviadoPor: currentUser.name,
            fechaEnvio: nowISO,
            leida: false,
            emailEnviado: true,
          }));
          onAppendNotifications(newNotifs);
        }
      }

      const response = await fetch('/api/notifications/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          semanaNumero,
          semanaPeriodo,
          dispersadoPor: currentUser.name,
          horasLimite,
          limiteLiberacion,
          mensaje: extraInstruction || undefined,
          emailConfig: updatedEmailConfig,
          portalUrl: updatedEmailConfig.portalUrl || window.location.origin,
          dispatches,
        }),
      });

      const data = await response.json();
      const recipientsSummary = targetsToBuild.map((t) => t.recipientEmail).join(', ');

      if (data.ok && data.smtpSentCount > 0) {
        setFeedback({
          type: 'success',
          message: `✓ Se enviaron ${data.smtpSentCount} correo(s) exitosamente a: ${recipientsSummary}${
            attachExcelFile ? ' (con archivo Excel adjunto y botón al sistema)' : ''
          }.`,
        });
        if (onSuccessToast) {
          onSuccessToast(
            `Correo enviado a ${recipientsSummary}${attachExcelFile ? ' con Excel adjunto' : ''}.`,
            'Correo Enviado Exitosamente'
          );
        }
      } else if (!data.smtpConfigured) {
        setFeedback({
          type: 'warning',
          message: `Se envió la notificación en tiempo real dentro del sistema para ${recipientsSummary}. Nota: Para envío directo por servidor SMTP configura tu cuenta en Configuración > Correo, o usa el botón "Abrir en mi Cliente de Correo" aquí abajo.`,
        });
        if (onSuccessToast) {
          onSuccessToast(
            `Notificación enviada en el sistema para ${recipientsSummary}.`,
            'Notificación Registrada'
          );
        }
      } else {
        const failedInfo =
          Array.isArray(data.deliveryResults) && data.deliveryResults[0]?.info
            ? ` (${data.deliveryResults[0].info})`
            : '';
        setFeedback({
          type: 'warning',
          message: `Se registró el aviso en el sistema, pero el servidor SMTP reportó un detalle al entregar el correo${failedInfo}. También puedes usar "Abrir en mi Cliente de Correo".`,
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Error al procesar el envío: ${err?.message || 'Verifica tu conexión'}`,
      });
    } finally {
      setIsSending(false);
    }
  };

  // Abrir en cliente de correo local (mailto:) con el destinatario, asunto y mensaje configurados
  const handleOpenMailClient = () => {
    if (saveAsDefaultTemplate && onSaveEmailConfig) {
      persistTemplateChanges(true);
      hasModifiedTemplateRef.current = false;
    }

    let emailsList: string[] = [];
    let supName = selectedSupervisor || 'General';
    let recName = 'Supervisor';

    if (recipientMode === 'supervisor_user') {
      emailsList = selectedSupervisors
        .map((sup) => {
          const entry = supervisorDirectory.find((d) => d.supervisorName === sup);
          return (emailOverrides[sup] ?? entry?.userEmail ?? '').trim();
        })
        .filter((e) => e.includes('@'));
      if (selectedSupervisors.length === 1) {
        supName = selectedSupervisors[0];
        const entry = supervisorDirectory.find((d) => d.supervisorName === supName);
        recName = entry?.userName || supName;
      }
    } else {
      emailsList = customEmailInput
        .split(/[,;]+/)
        .map((s) => s.trim())
        .filter((e) => e.includes('@'));
      supName = customRecipientSupervisor || selectedSupervisor || 'General';
    }

    const toAddress = emailsList.join(',');
    const renderedSubj = renderPreviewText(subjectTemplate, supName, recName);
    const portalLink = `${emailConfig.portalUrl || window.location.origin}/?action=liberar_nomina&semana=${encodeURIComponent(
      String(semanaNumero)
    )}${supName && supName !== 'General' ? `&supervisor=${encodeURIComponent(supName)}` : ''}`;
    const renderedBody =
      renderPreviewText(bodyTemplate, supName, recName) +
      (extraInstruction ? `\n\nNota adicional: ${extraInstruction}` : '') +
      `\n\n👉 Ir al Sistema a Revisar y Liberar Nómina:\n${portalLink}`;

    const mailtoUrl = `mailto:${encodeURIComponent(toAddress)}?subject=${encodeURIComponent(
      renderedSubj
    )}&body=${encodeURIComponent(renderedBody)}`;
    window.location.href = mailtoUrl;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div className="bg-[#21222D] rounded-3xl shadow-2xl border border-white/[0.1] max-w-3xl w-full overflow-hidden flex flex-col max-h-[92vh] animate-scale-in">
        {/* Encabezado del Modal */}
        <div className="bg-gradient-to-r from-[#171821] via-[#1B1C26] to-[#21222D] border-b border-white/[0.08] px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#FEB95A]/15 border border-[#FEB95A]/35 flex items-center justify-center text-[#FEB95A] shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#A9DFD8] bg-[#A9DFD8]/15 px-2.5 py-0.5 rounded-md border border-[#A9DFD8]/30">
                  Semana {semanaNumero} · Envío de Nómina por Correo
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-extrabold tracking-tight mt-1 text-white">
                Configurar Mensaje y Enviar Nómina por Correo
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCloseModal}
            className="text-[#87888C] hover:text-white px-2.5 py-1 rounded-xl hover:bg-white/10 transition-colors text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Contenido desplazable */}
        <form onSubmit={handleSendViaServer} className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* Paso 1: Elegir de dónde tomar el correo destinatario */}
          <div className="space-y-3">
            <label className="block text-[11px] font-extrabold text-[#87888C] uppercase tracking-wider">
              1. Seleccionar Destinatario(s) del Correo
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setRecipientMode('supervisor_user')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                  recipientMode === 'supervisor_user'
                    ? 'bg-[#A9DFD8]/15 border-[#A9DFD8]/50 text-white shadow-sm'
                    : 'bg-[#171821] border-white/[0.07] text-[#87888C] hover:text-white'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    recipientMode === 'supervisor_user'
                      ? 'bg-[#A9DFD8] text-[#171821]'
                      : 'bg-[#21222D] text-[#A9DFD8]'
                  }`}
                >
                  <Users className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-white flex items-center gap-1.5">
                    <span>Correo de Usuario de Supervisores</span>
                    {recipientMode === 'supervisor_user' && (
                      <Check className="w-3.5 h-3.5 text-[#A9DFD8]" />
                    )}
                  </div>
                  <p className="text-[11px] text-[#87888C] mt-0.5 leading-snug">
                    Toma automáticamente el correo registrado en el perfil de cada supervisor.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRecipientMode('custom_email')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                  recipientMode === 'custom_email'
                    ? 'bg-[#FEB95A]/15 border-[#FEB95A]/50 text-white shadow-sm'
                    : 'bg-[#171821] border-white/[0.07] text-[#87888C] hover:text-white'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    recipientMode === 'custom_email'
                      ? 'bg-[#FEB95A] text-[#171821]'
                      : 'bg-[#21222D] text-[#FEB95A]'
                  }`}
                >
                  <AtSign className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-white flex items-center gap-1.5">
                    <span>Ingresar Correo Manualmente</span>
                    {recipientMode === 'custom_email' && (
                      <Check className="w-3.5 h-3.5 text-[#FEB95A]" />
                    )}
                  </div>
                  <p className="text-[11px] text-[#87888C] mt-0.5 leading-snug">
                    Escribe cualquier dirección de correo electrónico o elige un destinatario rápido.
                  </p>
                </div>
              </button>
            </div>

            {/* Vista Modo A: Lista de Supervisores con su correo tomado de PortalUsers */}
            {recipientMode === 'supervisor_user' ? (
              <div className="rounded-2xl bg-[#171821] border border-white/[0.08] p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/[0.06]">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-[#A9DFD8]" />
                    <span>
                      Supervisores Seleccionados ({selectedSupervisors.length} de {supervisorsList.length})
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={handleSelectAllSupervisors}
                    className="text-[11px] font-bold text-[#A9DFD8] hover:underline cursor-pointer"
                  >
                    {selectedSupervisors.length === supervisorsList.length
                      ? 'Desmarcar todos'
                      : 'Seleccionar todos'}
                  </button>
                </div>

                <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                  {supervisorDirectory.map((item) => {
                    const isChecked = selectedSupervisors.includes(item.supervisorName);
                    const currentEmail = emailOverrides[item.supervisorName] ?? item.userEmail;
                    return (
                      <div
                        key={item.supervisorName}
                        className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-all ${
                          isChecked
                            ? 'bg-[#21222D] border-[#A9DFD8]/35'
                            : 'bg-[#171821]/60 border-white/[0.05] opacity-70'
                        }`}
                      >
                        <label className="flex items-center gap-2.5 cursor-pointer min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSupervisorSelection(item.supervisorName)}
                            className="w-4 h-4 rounded accent-[#A9DFD8] cursor-pointer shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-extrabold text-white truncate">
                                {item.supervisorName}
                              </span>
                              <span className="text-[10px] font-mono text-[#87888C] bg-[#171821] px-1.5 py-0.5 rounded border border-white/[0.06]">
                                {item.empCount} colab.
                              </span>
                            </div>
                            <span className="text-[10px] text-[#87888C] block truncate">
                              Usuario: {item.userName}
                            </span>
                          </div>
                        </label>

                        <div className="flex items-center gap-1.5 sm:w-64 shrink-0">
                          <Mail className="w-3.5 h-3.5 text-[#20AEF3] shrink-0" />
                          <input
                            type="email"
                            value={currentEmail}
                            onChange={(e) =>
                              setEmailOverrides((prev) => ({
                                ...prev,
                                [item.supervisorName]: e.target.value,
                              }))
                            }
                            placeholder="correo@empresa.com"
                            className="w-full rounded-lg px-2.5 py-1.5 text-xs font-mono bg-[#171821] border border-white/[0.08] focus:border-[#A9DFD8] text-white outline-none"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Vista Modo B: Ingresar correo electrónico manualmente + chips rápidos de supervisores */
              <div className="rounded-2xl bg-[#171821] border border-white/[0.08] p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-7">
                    <label className="block text-[11px] font-bold text-[#87888C] mb-1">
                      Correo(s) Electrónico(s) Destino
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#FEB95A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={customEmailInput}
                        onChange={(e) => setCustomEmailInput(e.target.value)}
                        placeholder="ejemplo@empresa.com, otro@empresa.com"
                        className="w-full rounded-xl pl-10 pr-3.5 py-2.5 bg-[#21222D] border border-white/[0.1] focus:border-[#FEB95A] text-xs font-mono text-white outline-none"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-5">
                    <label className="block text-[11px] font-bold text-[#87888C] mb-1">
                      Lista de Supervisor Asociada
                    </label>
                    <select
                      value={customRecipientSupervisor}
                      onChange={(e) => {
                        const sup = e.target.value;
                        setCustomRecipientSupervisor(sup);
                        const matched = supervisorDirectory.find((d) => d.supervisorName === sup);
                        if (matched?.userEmail && !customEmailInput) {
                          setCustomEmailInput(matched.userEmail);
                        }
                      }}
                      className="w-full rounded-xl px-3 py-2.5 bg-[#21222D] border border-white/[0.1] focus:border-[#A9DFD8] text-xs font-semibold text-white outline-none"
                    >
                      <option value="">Todas las listas / Reporte actual</option>
                      {supervisorsList.map((sup) => (
                        <option key={sup} value={sup}>
                          {sup}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Botones rápidos para tomar el correo de un supervisor con 1 clic */}
                <div>
                  <span className="text-[10px] font-bold text-[#87888C] uppercase tracking-wider block mb-1.5">
                    Tomar correo registrado de un supervisor con 1 clic:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {supervisorDirectory
                      .filter((d) => Boolean(d.userEmail))
                      .map((d) => (
                        <button
                          key={d.supervisorName}
                          type="button"
                          onClick={() => {
                            setCustomEmailInput(d.userEmail);
                            setCustomRecipientSupervisor(d.supervisorName);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#21222D] hover:bg-[#2B2B36] border border-white/[0.08] text-[10px] font-mono text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <span className="font-bold text-[#A9DFD8]">{d.supervisorName}:</span>
                          <span>{d.userEmail}</span>
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Paso 2: Configurar Asunto y Mensaje del Correo */}
          <div className="space-y-3 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-[11px] font-extrabold text-[#87888C] uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#FEB95A]" />
                <span>2. Personalizar Asunto y Mensaje del Correo</span>
              </label>

              <div className="flex items-center gap-2">
                {onSaveEmailConfig && (
                  <button
                    type="button"
                    onClick={handleSaveTemplateNow}
                    className="px-2.5 py-1 rounded-lg bg-[#A9DFD8]/15 hover:bg-[#A9DFD8]/25 border border-[#A9DFD8]/35 text-[11px] font-bold text-[#A9DFD8] flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Check className="w-3 h-3" />
                    <span>{templateSavedBadge ? '¡Plantilla Guardada!' : 'Guardar Plantilla'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    hasModifiedTemplateRef.current = true;
                    setSubjectTemplate(FALLBACK_SUBJECT);
                    setBodyTemplate(FALLBACK_BODY);
                  }}
                  className="text-[11px] font-bold text-[#87888C] hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" /> Restaurar texto base
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Asunto del Correo
              </label>
              <input
                type="text"
                value={subjectTemplate}
                onChange={(e) => {
                  hasModifiedTemplateRef.current = true;
                  setSubjectTemplate(e.target.value);
                }}
                onBlur={() => {
                  if (hasModifiedTemplateRef.current && saveAsDefaultTemplate) {
                    persistTemplateChanges(true);
                  }
                }}
                className="w-full rounded-xl px-3.5 py-2.5 bg-[#171821] border border-white/[0.08] focus:border-[#A9DFD8] text-xs font-semibold text-white outline-none"
              />
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                <label className="text-[11px] font-semibold text-slate-300">
                  Mensaje Principal del Correo
                </label>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] text-[#87888C]">Insertar variable:</span>
                  {['{nombre}', '{supervisor}', '{semana}', '{periodo}', '{fecha_limite}'].map(
                    (v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => insertVariableInBody(v)}
                        className="px-1.5 py-0.5 rounded bg-[#171821] hover:bg-[#2B2B36] border border-white/[0.08] text-[10px] font-mono text-[#A9DFD8] cursor-pointer"
                      >
                        {v}
                      </button>
                    )
                  )}
                </div>
              </div>

              <textarea
                rows={5}
                value={bodyTemplate}
                onChange={(e) => {
                  hasModifiedTemplateRef.current = true;
                  setBodyTemplate(e.target.value);
                }}
                onBlur={() => {
                  if (hasModifiedTemplateRef.current && saveAsDefaultTemplate) {
                    persistTemplateChanges(true);
                  }
                }}
                className="w-full rounded-xl p-3.5 bg-[#171821] border border-white/[0.08] focus:border-[#A9DFD8] text-xs text-slate-100 leading-relaxed outline-none font-sans resize-y"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Nota o Instrucción Destacada Adicional (Opcional)
              </label>
              <input
                type="text"
                value={extraInstruction}
                onChange={(e) => setExtraInstruction(e.target.value)}
                placeholder="Ej. Favor de validar las checadas sin gafete antes de las 14:00 hrs..."
                className="w-full rounded-xl px-3.5 py-2 bg-[#171821] border border-white/[0.08] focus:border-[#FEB95A] text-xs text-white outline-none"
              />
            </div>
          </div>

          {/* Paso 3: Opciones de Adjunto Excel y Notificación */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            <label className="p-3 rounded-xl bg-[#171821] border border-white/[0.07] flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={attachExcelFile}
                onChange={(e) => setAttachExcelFile(e.target.checked)}
                className="w-4 h-4 rounded accent-[#A9DFD8]"
              />
              <div className="min-w-0">
                <span className="text-xs font-bold text-white flex items-center gap-1">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#A9DFD8]" />
                  Adjuntar Excel (.xlsx)
                </span>
                <span className="text-[10px] text-[#87888C] block">
                  Incluye el archivo de la lista en el correo
                </span>
              </div>
            </label>

            <label className="p-3 rounded-xl bg-[#171821] border border-white/[0.07] flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={alsoDisperseInSystem}
                onChange={(e) => setAlsoDisperseInSystem(e.target.checked)}
                className="w-4 h-4 rounded accent-[#A9DFD8]"
              />
              <div className="min-w-0">
                <span className="text-xs font-bold text-white block">
                  Notificar en Sistema + Push
                </span>
                <span className="text-[10px] text-[#87888C] block">
                  Envía alerta en vivo a la campana del supervisor
                </span>
              </div>
            </label>

            <label className="p-3 rounded-xl bg-[#171821] border border-white/[0.07] flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={saveAsDefaultTemplate}
                onChange={(e) => setSaveAsDefaultTemplate(e.target.checked)}
                className="w-4 h-4 rounded accent-[#FEB95A]"
              />
              <div className="min-w-0">
                <span className="text-xs font-bold text-white block">
                  Guardar como Plantilla
                </span>
                <span className="text-[10px] text-[#87888C] block">
                  Conserva este mensaje para futuros envíos
                </span>
              </div>
            </label>
          </div>

          {/* Mensaje de resultado */}
          {feedback && (
            <div
              className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 animate-scale-in ${
                feedback.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                  : feedback.type === 'warning'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{feedback.message}</span>
            </div>
          )}

          {/* Botones de Acción */}
          <div className="pt-3 border-t border-white/[0.08] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={handleOpenMailClient}
              className="px-4 py-2.5 rounded-xl bg-[#171821] hover:bg-[#2B2B36] border border-white/[0.1] text-xs font-bold text-[#FEB95A] flex items-center justify-center gap-2 transition-colors cursor-pointer"
              title="Abrir Outlook o tu cliente de correo predeterminado con este mensaje y destinatarios"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Abrir en mi Cliente de Correo</span>
            </button>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-2.5 rounded-xl bg-[#171821] hover:bg-[#2B2B36] border border-white/[0.1] text-xs font-bold text-slate-300 transition-colors cursor-pointer"
              >
                Cerrar
              </button>

              <button
                type="submit"
                disabled={isSending}
                className="px-5 py-2.5 rounded-xl bg-[#A9DFD8] hover:bg-[#92d4cc] text-[#171821] text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-[#A9DFD8]/15 transition-all cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSending ? 'Enviando Correo...' : 'Enviar por Correo Ahora'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
