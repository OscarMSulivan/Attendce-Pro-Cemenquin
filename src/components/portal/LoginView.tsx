/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Mail,
  ArrowLeft,
  ArrowRight,
  Send,
  Clock,
  Users,
  FileCheck2,
  Sun,
  Moon,
  Activity,
  Cpu,
  Pause,
  Play,
  Fingerprint,
  Sparkles,
} from 'lucide-react';
import { PortalUser, getUserAllowedLists } from '../../types/portal';
import { PortalService } from '../../services/portalService';

interface LoginViewProps {
  users: PortalUser[];
  onLoginSuccess: (user: PortalUser) => void;
  onResetUserPassword?: (userId: string, newPassword: string) => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

const REMEMBER_USER_KEY = 'cemenqtime_remembered_user_v1';
const CEMENQUIN_LOGO_PATH =
  '/assets/aistudio/623410255_1517285780403715_965041871524205859_n_cf013194.jpg';

interface LivePunchSample {
  id: string;
  empId: string;
  name: string;
  area: string;
  punchIn: string;
  punchOut: string;
  mode: string;
  resultLabel: string;
  resultTone: 'emerald' | 'amber' | 'sky';
  detail: string;
}

const LIVE_PUNCH_SAMPLES: LivePunchSample[] = [
  {
    id: 'sample-1',
    empId: '00615',
    name: 'ÓSCAR SULLIVAN',
    area: 'PRODUCCIÓN PLANTA',
    punchIn: '07:56:14',
    punchOut: '17:04:22',
    mode: 'ENT / SNT · Turno Matutino',
    resultLabel: '8.0h Normales · Asistencia OK',
    resultTone: 'emerald',
    detail: 'Validación biométrica limpia sin retardo · Lista sincronizada',
  },
  {
    id: 'sample-2',
    empId: '00979',
    name: 'EUDIS MARTÍNEZ',
    area: 'MANTENIMIENTO INDUSTRIAL',
    punchIn: '07:58:02',
    punchOut: '19:32:10',
    mode: 'Excedente ≥ 40 min detectado',
    resultLabel: '+2.5h Extra · Autorizado',
    resultTone: 'amber',
    detail: 'Cálculo automático de horas extras · Notificado a jefatura',
  },
  {
    id: 'sample-3',
    empId: '00412',
    name: 'CARLOS RAMÍREZ',
    area: 'OPERACIÓN TRITURACIÓN',
    punchIn: '22:00:05',
    punchOut: '06:03:41',
    mode: 'Cruce nocturno 24h + Rescate RST',
    resultLabel: 'Jornada Nocturna Completa',
    resultTone: 'sky',
    detail: 'Fusión circular de marcas entre días consecutivos sin pérdida',
  },
];

export const LoginView: React.FC<LoginViewProps> = ({
  users,
  onLoginSuccess,
  onResetUserPassword,
  theme = 'light',
  onToggleTheme,
}) => {
  const isLight = theme !== 'dark';
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorShakeKey, setErrorShakeKey] = useState(0);
  const [authenticatingUser, setAuthenticatingUser] = useState<PortalUser | null>(null);
  const [authStepIndex, setAuthStepIndex] = useState(0);
  const [logoError, setLogoError] = useState(false);
  const [focusedField, setFocusedField] = useState<'id' | 'pass' | 'rec' | null>(null);

  // Estado del loop interactivo del showcase biométrico (3.2s cadence per motion.md)
  const [activeSampleIndex, setActiveSampleIndex] = useState(0);
  const [isLoopPaused, setIsLoopPaused] = useState(false);

  // Estado para Recuperación de Contraseña por Correo
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<'request' | 'verify' | 'done'>('request');
  const [recoveryIdentifier, setRecoveryIdentifier] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveryInfo, setRecoveryInfo] = useState<{
    userId: string;
    userName: string;
    userEmail: string;
    expectedCode: string;
    emailSent: boolean;
    smtpErrorMsg?: string;
  } | null>(null);
  const [enteredCode, setEnteredCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem(REMEMBER_USER_KEY);
      if (savedUser) {
        setIdentifier(savedUser);
        setRememberMe(true);
      }
    } catch {
      // ignore localStorage errors
    }
  }, []);

  // Ciclo automático de 3.2s para el monitor biométrico en vivo
  useEffect(() => {
    if (isLoopPaused || authenticatingUser) return;
    const timer = window.setInterval(() => {
      setActiveSampleIndex((prev) => (prev + 1) % LIVE_PUNCH_SAMPLES.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [isLoopPaused, authenticatingUser]);

  const triggerAnimatedLogin = (user: PortalUser) => {
    setErrorMsg(null);
    try {
      if (rememberMe && identifier.trim()) {
        localStorage.setItem(REMEMBER_USER_KEY, identifier.trim());
      } else {
        localStorage.removeItem(REMEMBER_USER_KEY);
      }
    } catch {
      // ignore
    }
    setAuthStepIndex(0);
    setAuthenticatingUser(user);
    window.setTimeout(() => {
      setAuthStepIndex(1);
    }, 380);
    window.setTimeout(() => {
      onLoginSuccess(user);
    }, 920);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const matched = PortalService.authenticateUser(users, identifier, password);
    if (!matched) {
      setErrorMsg(
        'Usuario, número de empleado o contraseña incorrectos. Verifica tus datos de acceso.'
      );
      setErrorShakeKey((prev) => prev + 1);
      return;
    }

    triggerAnimatedLogin(matched);
  };

  const handleRequestRecoveryCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    const cleanId = recoveryIdentifier.trim().toLowerCase();
    if (!cleanId) {
      setRecoveryError('Ingresa tu correo electrónico, usuario o número de empleado.');
      return;
    }

    setIsSendingCode(true);
    try {
      let handledByServer = false;
      if (typeof window !== 'undefined' && window.location.protocol !== 'file:') {
        try {
          const res = await fetch('/api/auth/recover-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              identifier: cleanId,
              users,
            }),
          });
          const data = await res.json();
          if (data && data.ok) {
            setRecoveryInfo({
              userId: data.userId,
              userName: data.userName,
              userEmail: data.userEmail,
              expectedCode: data.fallbackCode ? String(data.fallbackCode) : '',
              emailSent: Boolean(data.emailSent),
              smtpErrorMsg: data.smtpErrorMsg,
            });
            setRecoveryStep('verify');
            handledByServer = true;
          } else if (data && data.error) {
            setRecoveryError(data.error);
            handledByServer = true;
          }
        } catch {
          // Fallback local si el servidor no responde
        }
      }

      if (!handledByServer) {
        const cleanNumeric = cleanId.replace(/^0+/, '');
        const matched = users.find((u) => {
          if (!u.active) return false;
          const emailMatch = u.email.trim().toLowerCase() === cleanId;
          const userMatch = (u.username || '').trim().toLowerCase() === cleanId;
          const empRaw = (u.employeeId || '').trim().toLowerCase();
          const empMatch =
            Boolean(empRaw) &&
            (empRaw === cleanId ||
              (Boolean(cleanNumeric) && empRaw.replace(/^0+/, '') === cleanNumeric));
          return emailMatch || userMatch || empMatch;
        });

        if (!matched) {
          setRecoveryError(
            'No se encontró ningún usuario activo con ese correo, usuario o número de empleado.'
          );
        } else {
          const fallbackCode = String(Math.floor(100000 + Math.random() * 900000));
          setRecoveryInfo({
            userId: matched.id,
            userName: matched.name,
            userEmail: matched.email,
            expectedCode: fallbackCode,
            emailSent: false,
          });
          setRecoveryStep('verify');
        }
      }
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    if (!recoveryInfo) return;

    if (newPassword.trim().length < 4) {
      setRecoveryError('La nueva contraseña debe tener al menos 4 caracteres.');
      return;
    }

    if (newPassword.trim() !== confirmNewPassword.trim()) {
      setRecoveryError('Las contraseñas no coinciden. Verifícalas.');
      return;
    }

    let verifiedOnServer = false;
    try {
      const res = await fetch('/api/auth/verify-reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: recoveryInfo.userId,
          code: enteredCode.trim(),
          newPassword: newPassword.trim(),
          users,
        }),
      });
      const data = await res.json();
      if (data && data.ok) {
        verifiedOnServer = true;
      } else if (data && data.error) {
        setRecoveryError(data.error);
        return;
      }
    } catch {
      // Modo offline
    }

    if (!verifiedOnServer) {
      if (!recoveryInfo.expectedCode || enteredCode.trim() !== recoveryInfo.expectedCode) {
        setRecoveryError('El código de verificación de 6 dígitos no coincide.');
        return;
      }
    }

    if (onResetUserPassword) {
      onResetUserPassword(recoveryInfo.userId, newPassword.trim());
    } else {
      const updatedUsers = users.map((u) =>
        u.id === recoveryInfo.userId ? { ...u, password: newPassword.trim() } : u
      );
      PortalService.saveUsers(updatedUsers);
    }

    setIdentifier(recoveryInfo.userEmail);
    setPassword(newPassword.trim());
    setRecoveryStep('done');
  };

  const closeRecoveryMode = () => {
    setIsRecoveryMode(false);
    setRecoveryStep('request');
    setRecoveryError(null);
    setRecoveryInfo(null);
    setEnteredCode('');
    setNewPassword('');
    setConfirmNewPassword('');
  };

  const activeSample = LIVE_PUNCH_SAMPLES[activeSampleIndex];

  return (
    <div className="min-h-screen w-full bg-[#171821] text-white flex items-center justify-center p-3 sm:p-6 lg:p-10 relative overflow-hidden">
      {/* AMBIENT STUDIO BACKDROP (Lit Studio Sweep) */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div
          className="absolute -top-32 left-1/4 w-[650px] h-[420px] rounded-full opacity-25 blur-[120px]"
          style={{
            background:
              'radial-gradient(circle, rgba(16,185,129,0.55) 0%, rgba(32,174,243,0.25) 60%, transparent 100%)',
          }}
        />
        <div
          className="absolute -bottom-32 right-1/4 w-[580px] h-[380px] rounded-full opacity-20 blur-[120px]"
          style={{
            background:
              'radial-gradient(circle, rgba(32,174,243,0.45) 0%, rgba(16,185,129,0.2) 60%, transparent 100%)',
          }}
        />
      </div>

      {/* OVERLAY CINEMÁTICO DE ACCESO VERIFICADO */}
      <AnimatePresence>
        {authenticatingUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex flex-col items-center justify-center p-6 ground-inverse"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -10 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-md rounded-2xl bg-[#131722] border border-white/15 shadow-[0_28px_80px_rgba(0,0,0,0.65)] p-8 text-center space-y-5 relative overflow-hidden"
            >
              {/* Halo superior */}
              <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-56 h-32 rounded-full bg-emerald-500/20 blur-2xl pointer-events-none" />

              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-0 rounded-2xl border-2 border-dashed border-[#A9DFD8]/40"
                />
                <motion.div
                  initial={{ scale: 0.7 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                  className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center text-[#A9DFD8] shadow-[0_0_24px_rgba(16,185,129,0.25)]"
                >
                  <ShieldCheck className="w-6 h-6" />
                </motion.div>
              </div>

              <div className="space-y-1.5 relative z-10">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-semibold text-[#A9DFD8]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Identidad verificada
                </span>
                <h2 className="text-xl font-bold text-white tracking-tight pt-1">
                  Hola, {authenticatingUser.name}
                </h2>
                {authenticatingUser.employeeId && (
                  <p className="text-xs font-mono text-[#A9DFD8] font-medium tabular-nums">
                    ID Colaborador: #{authenticatingUser.employeeId}
                  </p>
                )}
                <AnimatePresence mode="wait">
                  <motion.p
                    key={authStepIndex}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                    className="text-xs text-slate-400 pt-1"
                  >
                    {authStepIndex === 0
                      ? 'Validando credenciales y permisos de módulo...'
                      : authenticatingUser.role === 'supervisor'
                      ? `Sincronizando listas asignadas: ${getUserAllowedLists(authenticatingUser).join(', ')}`
                      : 'Abriendo consola de Recursos Humanos y Nómina...'}
                  </motion.p>
                </AnimatePresence>
              </div>

              <div className="w-full h-1.5 rounded-full bg-[#0B0D13] overflow-hidden border border-white/10">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full bg-gradient-to-r from-[#0D9488] via-[#10B981] to-[#A9DFD8] rounded-full"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CONTENEDOR PRINCIPAL SPLIT-SCREEN (ESTILO LINEAR / X.AI STUDIO) */}
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[1160px] grid grid-cols-1 lg:grid-cols-12 rounded-3xl border border-white/10 bg-[#21222D] overflow-hidden shadow-[0_25px_70px_-15px_rgba(15,23,42,0.18)]"
      >
        {/* COLUMNA IZQUIERDA (7 COLUMNAS): DARK STUDIO STAGE (.ground-inverse preserva el acabado oscuro de alto contraste en Modo Claro y Oscuro) */}
        <div className="ground-inverse lg:col-span-7 p-7 sm:p-10 flex flex-col justify-between bg-gradient-to-br from-[#0B0F17] via-[#101624] to-[#0D131F] text-white relative overflow-hidden border-b lg:border-b-0 lg:border-r border-white/10">
          {/* Iluminación de estudio interna y retícula arquitectónica */}
          <div
            className="absolute -right-24 -top-24 w-96 h-96 rounded-full pointer-events-none opacity-30 blur-[90px]"
            style={{
              background: 'radial-gradient(circle, #10B981 0%, transparent 70%)',
            }}
          />
          <div
            className="absolute -left-24 -bottom-24 w-96 h-96 rounded-full pointer-events-none opacity-20 blur-[90px]"
            style={{
              background: 'radial-gradient(circle, #20AEF3 0%, transparent 70%)',
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.035] pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
              backgroundSize: '36px 36px',
            }}
          />

          <div className="relative z-10 space-y-6">
            {/* 1. Cabecera de Marca con Entrada Coreografiada */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center justify-between gap-4 pb-5 border-b border-white/10"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-13 h-13 rounded-2xl bg-[#0a1e5e] p-1 border border-white/20 shadow-[0_8px_24px_rgba(0,0,0,0.4)] shrink-0 overflow-hidden flex items-center justify-center">
                  {!logoError ? (
                    <img
                      src={CEMENQUIN_LOGO_PATH}
                      alt="Logo Cemenquin"
                      referrerPolicy="no-referrer"
                      onError={() => setLogoError(true)}
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    <div className="w-full h-full rounded-xl bg-[#0a1e5e] flex flex-col items-center justify-center text-white font-bold text-xs">
                      <span className="text-red-500 text-base leading-none">CQ</span>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-extrabold tracking-tight text-white">
                      Cemen<span className="text-[#A9DFD8]">Qtime</span>
                    </span>
                    <span className="text-[10px] font-mono tabular-nums px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-[#A9DFD8] font-semibold">
                      v10.4 Enterprise
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Cemenquin® · Plataforma de Asistencia Biométrica y Nómina
                  </p>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/10 text-[11px] font-mono text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Motor 24h Activo</span>
              </div>
            </motion.div>

            {/* 2. Titular Principal */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            >
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
                Control biométrico en tiempo real, dispersión por jefatura y pre-nómina automatizada.
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed max-w-[60ch]">
                Concilia eventos de reloj checador (ENT, ERT, SNT, RST), detecta retardos y horas extras conforme a reglamento, y libera listas firmadas con trazabilidad total.
              </p>
            </motion.div>

            {/* 3. VENTANA INTERACTIVA DE PRODUCTO (APP-FRAME EN VIVO — design-taste-frontend cards.md & motion.md) */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              onMouseEnter={() => setIsLoopPaused(true)}
              onMouseLeave={() => setIsLoopPaused(false)}
              className="rounded-2xl bg-[#131926]/90 border border-white/12 shadow-[0_20px_50px_rgba(0,0,0,0.45)] overflow-hidden backdrop-blur-md"
            >
              {/* Barra superior de la ventana simulada */}
              <div className="px-4 py-2.5 bg-[#0B0F17]/90 border-b border-white/10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500/70" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
                  </div>
                  <span className="ml-2 text-[11px] font-mono text-slate-300 flex items-center gap-1.5">
                    <Fingerprint className="w-3.5 h-3.5 text-[#A9DFD8]" />
                    Monitor Biométrico · Ciclo Jueves a Miércoles
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                    {isLoopPaused ? 'En pausa' : 'En vivo · 3.2s'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsLoopPaused((prev) => !prev)}
                    className="w-6 h-6 rounded-full bg-white/[0.06] hover:bg-white/15 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title={isLoopPaused ? 'Reanudar demostración en vivo' : 'Pausar demostración en vivo'}
                  >
                    {isLoopPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Diagrama de Flujo con Pulso Animado (Pipeline de 3 Nodos) */}
              <div className="px-4 py-3 bg-[#0E1420] border-b border-white/[0.07]">
                <div className="grid grid-cols-3 items-center gap-2 relative">
                  {/* Línea conectora con pulso luminoso */}
                  <div className="absolute left-[16%] right-[16%] top-1/2 -translate-y-1/2 h-[2px] bg-white/10 overflow-hidden pointer-events-none">
                    <div className="w-1/3 h-full bg-gradient-to-r from-transparent via-[#A9DFD8] to-transparent animate-pipeline-pulse" />
                  </div>

                  <div className="relative z-10 flex items-center gap-2 bg-[#151C2C] border border-white/10 rounded-xl px-2.5 py-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#20AEF3] shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-white block truncate">
                        1. Reloj Checador
                      </span>
                      <span className="text-[9px] font-mono text-slate-400 block truncate">
                        ENT · ERT · SNT · RST
                      </span>
                    </div>
                  </div>

                  <div className="relative z-10 flex items-center gap-2 bg-[#151C2C] border border-[#A9DFD8]/35 rounded-xl px-2.5 py-1.5 shadow-[0_0_15px_rgba(169,223,216,0.12)]">
                    <Cpu className="w-3.5 h-3.5 text-[#A9DFD8] shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-[#A9DFD8] block truncate">
                        2. Motor 24h
                      </span>
                      <span className="text-[9px] font-mono text-slate-300 block truncate">
                        Cálculo y Rescate
                      </span>
                    </div>
                  </div>

                  <div className="relative z-10 flex items-center gap-2 bg-[#151C2C] border border-white/10 rounded-xl px-2.5 py-1.5">
                    <FileCheck2 className="w-3.5 h-3.5 text-[#FEB95A] shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-white block truncate">
                        3. Pre-Nómina
                      </span>
                      <span className="text-[9px] font-mono text-slate-400 block truncate">
                        Semáforo + Excel
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lista de Eventos en Vivo Seleccionables */}
              <div className="p-3.5 space-y-2">
                <div className="grid grid-cols-3 gap-1.5">
                  {LIVE_PUNCH_SAMPLES.map((sample, idx) => {
                    const isSelected = idx === activeSampleIndex;
                    return (
                      <button
                        key={sample.id}
                        type="button"
                        onClick={() => setActiveSampleIndex(idx)}
                        className={`text-left px-2.5 py-2 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-white/[0.08] border-[#A9DFD8]/50 shadow-sm'
                            : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono text-[10px] font-bold text-[#A9DFD8] tabular-nums">
                            #{sample.empId}
                          </span>
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              sample.resultTone === 'emerald'
                                ? 'bg-emerald-400'
                                : sample.resultTone === 'amber'
                                ? 'bg-amber-400'
                                : 'bg-sky-400'
                            }`}
                          />
                        </div>
                        <p className="text-[11px] font-bold text-white truncate mt-0.5">
                          {sample.name}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Detalle animado del registro activo */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeSample.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="p-3 rounded-xl bg-[#0B0F17]/90 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white">
                          {activeSample.name}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.06] text-slate-300">
                          {activeSample.area}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {activeSample.detail}
                      </p>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1.5 shrink-0">
                      <div className="font-mono text-xs font-bold text-white tabular-nums bg-white/[0.05] px-2.5 py-1 rounded-lg border border-white/10">
                        {activeSample.punchIn} <span className="text-[#A9DFD8]">➔</span> {activeSample.punchOut}
                      </div>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                          activeSample.resultTone === 'emerald'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : activeSample.resultTone === 'amber'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                        }`}
                      >
                        {activeSample.resultLabel}
                      </span>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>

            {/* 4. Tarjetas de Módulos con Micro-interacción Hover Lift */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-3"
            >
              <div className="p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 transition-all card-lift">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-white">Semáforo en Vivo</span>
                  <Activity className="w-4 h-4 text-[#A9DFD8]" />
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Monitoreo de liberación por supervisor con alertas push y correo.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 transition-all card-lift">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-white">Autorización TE</span>
                  <Clock className="w-4 h-4 text-[#FEB95A]" />
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Validación en 1 clic de tiempo extra y bloqueo de llegadas anticipadas.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 transition-all card-lift">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-white">Incidencias y RH</span>
                  <Users className="w-4 h-4 text-[#20AEF3]" />
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Formatos digitales de permiso, vacaciones e interfaz CONTPAQi®.
                </p>
              </div>
            </motion.div>
          </div>

          {/* Pie de columna izquierda */}
          <div className="relative z-10 pt-5 mt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <span className="font-semibold text-slate-200">
              Cemenquin® · Módulo de Recursos Humanos
            </span>
            <span className="font-mono tabular-nums text-slate-400">
              Calendario multi-anual 2025–2028
            </span>
          </div>
        </div>

        {/* COLUMNA DERECHA (5 COLUMNAS): FORMULARIO DE ACCESO CON TRANSICIONES FLUIDAS */}
        <div className="lg:col-span-5 bg-[#21222D] p-7 sm:p-10 flex flex-col justify-between relative">
          <div>
            {/* Barra superior del formulario + Selector de Tema */}
            <div className="flex items-center justify-between gap-3 mb-7 pb-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#A9DFD8]/15 border border-[#A9DFD8]/30 flex items-center justify-center text-[#A9DFD8]">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block leading-none">
                    Acceso al Portal
                  </span>
                  <span className="text-[11px] text-[#87888C] block mt-0.5">
                    Sesión segura por rol
                  </span>
                </div>
              </div>

              {onToggleTheme && (
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="px-3 py-1.5 rounded-xl bg-[#171821] hover:bg-[#2B2B36] border border-white/[0.08] text-white flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer shrink-0 shadow-xs"
                  title={isLight ? 'Cambiar a Modo Oscuro' : 'Cambiar a Modo Claro Técnico'}
                >
                  {isLight ? (
                    <>
                      <Moon className="w-3.5 h-3.5 text-[#87888C]" />
                      <span>Oscuro</span>
                    </>
                  ) : (
                    <>
                      <Sun className="w-3.5 h-3.5 text-[#FEB95A]" />
                      <span>Claro</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Transición animada entre Login y Recuperación de Contraseña */}
            <AnimatePresence mode="wait">
              {!isRecoveryMode ? (
                <motion.div
                  key="login-form-panel"
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 14 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="mb-6">
                    <h1 className="text-2xl font-extrabold text-white tracking-tight">
                      Iniciar sesión
                    </h1>
                    <p className="text-xs text-[#87888C] mt-1.5 leading-relaxed">
                      Ingresa tus credenciales para acceder a tus listas de asistencia y módulos asignados.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label
                        htmlFor="login-identifier"
                        className="text-xs font-bold text-slate-300 block mb-1.5"
                      >
                        Usuario, No. de empleado o correo
                      </label>
                      <div className="relative">
                        <User
                          className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
                            focusedField === 'id' ? 'text-[#A9DFD8]' : 'text-[#87888C]'
                          }`}
                        />
                        <input
                          id="login-identifier"
                          type="text"
                          value={identifier}
                          onFocus={() => setFocusedField('id')}
                          onBlur={() => setFocusedField(null)}
                          onChange={(e) => {
                            setIdentifier(e.target.value);
                            setErrorMsg(null);
                          }}
                          placeholder="Ej. admin, 00615 o correo@cemenquin.com"
                          className="w-full rounded-xl pl-10 pr-3.5 py-3 bg-[#171821] border border-white/[0.08] focus:border-[#A9DFD8] text-white placeholder-[#87888C] text-xs font-medium outline-none transition-all"
                          required
                          autoFocus
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="login-password"
                        className="text-xs font-bold text-slate-300 block mb-1.5"
                      >
                        Contraseña
                      </label>
                      <div className="relative">
                        <Lock
                          className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
                            focusedField === 'pass' ? 'text-[#A9DFD8]' : 'text-[#87888C]'
                          }`}
                        />
                        <input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onFocus={() => setFocusedField('pass')}
                          onBlur={() => setFocusedField(null)}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            setErrorMsg(null);
                          }}
                          placeholder="Ingresa tu contraseña"
                          className="w-full rounded-xl pl-10 pr-10 py-3 bg-[#171821] border border-white/[0.08] focus:border-[#A9DFD8] text-white placeholder-[#87888C] text-xs font-medium outline-none transition-all"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#87888C] hover:text-white transition-colors cursor-pointer"
                          title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-[#0D9488]"
                        />
                        <span className="text-xs font-medium text-[#87888C]">
                          Recordar mi usuario
                        </span>
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          setRecoveryIdentifier(identifier);
                          setIsRecoveryMode(true);
                          setRecoveryStep('request');
                          setRecoveryError(null);
                        }}
                        className="text-xs font-semibold text-[#A9DFD8] hover:underline transition-colors cursor-pointer"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    </div>

                    <AnimatePresence>
                      {errorMsg && (
                        <motion.div
                          key={errorShakeKey}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: [-6, 6, -4, 4, 0] }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.32 }}
                          className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5"
                        >
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{errorMsg}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={Boolean(authenticatingUser)}
                        className="group w-full py-3 px-4 rounded-xl bg-[#A9DFD8] hover:bg-[#95d5cd] text-[#171821] font-bold text-xs flex items-center justify-center gap-2 shadow-[0_10px_25px_-5px_rgba(13,148,136,0.35)] transition-all cursor-pointer disabled:opacity-50"
                      >
                        <span>
                          {authenticatingUser
                            ? 'Verificando credenciales...'
                            : 'Entrar a CemenQtime'}
                        </span>
                        <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
                      </button>
                    </div>
                  </form>
                </motion.div>
              ) : (
                /* MODO RECUPERAR CONTRASEÑA CON TRANSICIÓN FLUIDA POR PASOS */
                <motion.div
                  key="recovery-form-panel"
                  initial={{ opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -14 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#A9DFD8]/15 border border-[#A9DFD8]/30 flex items-center justify-center text-[#A9DFD8]">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-white">
                          Recuperar contraseña
                        </h2>
                        <p className="text-[11px] text-[#87888C]">
                          Verificación con código de 6 dígitos
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={closeRecoveryMode}
                      className="px-2.5 py-1.5 rounded-lg bg-[#171821] border border-white/[0.08] text-xs font-semibold text-[#87888C] hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Volver
                    </button>
                  </div>

                  <AnimatePresence mode="wait">
                    {recoveryStep === 'request' && (
                      <motion.form
                        key="rec-step-request"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                        onSubmit={handleRequestRecoveryCode}
                        className="space-y-4 pt-1"
                      >
                        <p className="text-xs text-[#87888C] leading-relaxed">
                          Ingresa tu correo electrónico, usuario o número de empleado para enviarte un código de seguridad.
                        </p>
                        <div>
                          <label className="text-xs font-bold text-slate-300 block mb-1.5">
                            Correo, usuario o No. de empleado
                          </label>
                          <div className="relative">
                            <Mail
                              className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
                                focusedField === 'rec' ? 'text-[#A9DFD8]' : 'text-[#87888C]'
                              }`}
                            />
                            <input
                              type="text"
                              value={recoveryIdentifier}
                              onFocus={() => setFocusedField('rec')}
                              onBlur={() => setFocusedField(null)}
                              onChange={(e) => {
                                setRecoveryIdentifier(e.target.value);
                                setRecoveryError(null);
                              }}
                              placeholder="correo@cemenquin.com o #00615"
                              className="w-full rounded-xl pl-10 pr-3.5 py-3 bg-[#171821] border border-white/[0.08] focus:border-[#A9DFD8] text-white placeholder-[#87888C] text-xs font-medium outline-none transition-all"
                              required
                              autoFocus
                            />
                          </div>
                        </div>

                        {recoveryError && (
                          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                            <span>{recoveryError}</span>
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={isSendingCode}
                          className="w-full py-3 px-4 rounded-xl bg-[#A9DFD8] hover:bg-[#95d5cd] text-[#171821] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <Send className="w-4 h-4" />
                          <span>
                            {isSendingCode ? 'Enviando código...' : 'Enviar código de verificación'}
                          </span>
                        </button>
                      </motion.form>
                    )}

                    {recoveryStep === 'verify' && recoveryInfo && (
                      <motion.form
                        key="rec-step-verify"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                        onSubmit={handleConfirmResetPassword}
                        className="space-y-3.5 pt-1"
                      >
                        {recoveryInfo.emailSent ? (
                          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs space-y-1">
                            <p className="font-semibold flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              Código enviado a {recoveryInfo.userEmail}
                            </p>
                            <p className="text-[11px] text-emerald-300/80">
                              Ingresa el código de 6 dígitos recibido en tu correo (vigencia 10 min).
                            </p>
                          </div>
                        ) : (
                          <div className="p-3 rounded-xl bg-[#FEB95A]/10 border border-[#FEB95A]/30 text-[#FEB95A] text-xs space-y-1">
                            <p className="font-semibold">Cuenta localizada: {recoveryInfo.userName}</p>
                            {recoveryInfo.expectedCode && (
                              <p className="text-[11px]">
                                Código temporal (modo sin SMTP):{' '}
                                <strong className="font-mono text-white bg-[#171821] px-2 py-0.5 rounded border border-[#FEB95A]/40">
                                  {recoveryInfo.expectedCode}
                                </strong>
                              </p>
                            )}
                          </div>
                        )}

                        <div>
                          <label className="text-xs font-bold text-slate-300 block mb-1.5">
                            Código de verificación (6 dígitos)
                          </label>
                          <input
                            type="text"
                            maxLength={6}
                            value={enteredCode}
                            onChange={(e) => {
                              setEnteredCode(e.target.value);
                              setRecoveryError(null);
                            }}
                            placeholder="000000"
                            className="w-full rounded-xl px-4 py-2.5 bg-[#171821] border border-white/[0.08] focus:border-[#A9DFD8] text-white text-sm font-mono font-bold tracking-widest text-center outline-none tabular-nums"
                            required
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-300 block mb-1.5">
                            Nueva contraseña
                          </label>
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => {
                              setNewPassword(e.target.value);
                              setRecoveryError(null);
                            }}
                            placeholder="Mínimo 4 caracteres"
                            className="w-full rounded-xl px-3.5 py-2.5 bg-[#171821] border border-white/[0.08] focus:border-[#A9DFD8] text-white text-xs outline-none"
                            required
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-300 block mb-1.5">
                            Confirmar nueva contraseña
                          </label>
                          <input
                            type="password"
                            value={confirmNewPassword}
                            onChange={(e) => {
                              setConfirmNewPassword(e.target.value);
                              setRecoveryError(null);
                            }}
                            placeholder="Repite tu nueva contraseña"
                            className="w-full rounded-xl px-3.5 py-2.5 bg-[#171821] border border-white/[0.08] focus:border-[#A9DFD8] text-white text-xs outline-none"
                            required
                          />
                        </div>

                        {recoveryError && (
                          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                            <span>{recoveryError}</span>
                          </div>
                        )}

                        <button
                          type="submit"
                          className="w-full py-3 px-4 rounded-xl bg-[#A9DFD8] hover:bg-[#95d5cd] text-[#171821] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Guardar nueva contraseña</span>
                        </button>
                      </motion.form>
                    )}

                    {recoveryStep === 'done' && (
                      <motion.div
                        key="rec-step-done"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.25 }}
                        className="p-6 rounded-2xl bg-[#171821] border border-[#A9DFD8]/30 text-center space-y-3"
                      >
                        <CheckCircle2 className="w-8 h-8 text-[#A9DFD8] mx-auto" />
                        <div className="space-y-1">
                          <h3 className="text-sm font-bold text-white">
                            Contraseña actualizada
                          </h3>
                          <p className="text-xs text-[#87888C]">
                            Tu nueva contraseña ya está sincronizada en el servidor.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={closeRecoveryMode}
                          className="w-full py-2.5 px-4 rounded-xl bg-[#A9DFD8] hover:bg-[#95d5cd] text-[#171821] font-bold text-xs cursor-pointer"
                        >
                          Continuar al inicio de sesión
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Pie del formulario derecho */}
          <div className="mt-8 pt-4 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-[#87888C]">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#A9DFD8]" />
              <span>Acceso protegido por rol</span>
            </span>
            <span className="font-mono font-semibold">CemenQtime</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
