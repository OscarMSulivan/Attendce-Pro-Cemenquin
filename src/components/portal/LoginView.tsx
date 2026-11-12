/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  User,
  LogIn,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Sparkles,
  Mail,
  ArrowLeft,
  Send,
  Clock,
  Users,
  BarChart3,
  FileCheck2,
  Sun,
  Moon,
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

export const LoginView: React.FC<LoginViewProps> = ({
  users,
  onLoginSuccess,
  onResetUserPassword,
  theme = 'dark',
  onToggleTheme,
}) => {
  const isLight = theme === 'light';
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [authenticatingUser, setAuthenticatingUser] = useState<PortalUser | null>(null);
  const [logoError, setLogoError] = useState(false);

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
    setAuthenticatingUser(user);
    setTimeout(() => {
      onLoginSuccess(user);
    }, 950);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const matched = PortalService.authenticateUser(users, identifier, password);
    if (!matched) {
      setErrorMsg(
        'Usuario, número de empleado o contraseña incorrectos. Verifica tus datos de acceso.'
      );
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
              expectedCode: String(data.verificationCode),
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

  const handleConfirmResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    if (!recoveryInfo) return;

    if (enteredCode.trim() !== recoveryInfo.expectedCode) {
      setRecoveryError('El código de verificación de 6 dígitos no coincide.');
      return;
    }

    if (newPassword.trim().length < 4) {
      setRecoveryError('La nueva contraseña debe tener al menos 4 caracteres.');
      return;
    }

    if (newPassword.trim() !== confirmNewPassword.trim()) {
      setRecoveryError('Las contraseñas no coinciden. Verifícalas.');
      return;
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

  return (
    <div className="min-h-screen w-full bg-[#171821] text-white flex items-center justify-center p-4 sm:p-6 lg:p-10 relative overflow-hidden font-sans">
      {/* Iluminación ambiental estilo Free Dark Admin Dashboard */}
      <div className="pointer-events-none absolute -top-36 -left-36 w-[480px] h-[480px] rounded-full bg-[#A9DFD8]/[0.06] blur-[110px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-32 w-[520px] h-[520px] rounded-full bg-[#20AEF3]/[0.07] blur-[120px]" />
      <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 w-[380px] h-[380px] rounded-full bg-[#0c2368]/25 blur-[130px]" />

      {/* OVERLAY DE BIENVENIDA AL AUTENTICAR */}
      {authenticatingUser && (
        <div className="fixed inset-0 z-50 bg-[#171821]/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-scale-in">
          <div className="w-full max-w-md rounded-3xl bg-[#21222D] border border-white/10 shadow-2xl p-8 text-center space-y-5 relative overflow-hidden">
            <div className="w-16 h-16 rounded-2xl bg-[#A9DFD8]/15 border border-[#A9DFD8]/40 flex items-center justify-center text-[#A9DFD8] mx-auto shadow-lg shadow-[#A9DFD8]/10 animate-bounce">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#A9DFD8]">
                <Sparkles className="w-3.5 h-3.5" /> Acceso Verificado
              </span>
              <h2 className="text-xl font-black text-white">
                ¡Bienvenido, {authenticatingUser.name}!
              </h2>
              {authenticatingUser.employeeId && (
                <p className="text-xs font-mono text-[#A9DFD8] font-bold tabular-nums">
                  No. de Empleado: #{authenticatingUser.employeeId}
                </p>
              )}
              <p className="text-xs text-[#87888C]">
                {authenticatingUser.role === 'supervisor'
                  ? `Cargando tu espacio de trabajo y lista(s): ${getUserAllowedLists(authenticatingUser).join(', ')}`
                  : 'Abriendo Módulo de Recursos Humanos...'}
              </p>
            </div>

            <div className="w-full h-2 rounded-full bg-[#171821] overflow-hidden border border-white/[0.06]">
              <div className="h-full bg-gradient-to-r from-[#A9DFD8] via-[#20AEF3] to-[#FEB95A] rounded-full animate-progress-fill" />
            </div>
          </div>
        </div>
      )}

      {/* CONTENEDOR PRINCIPAL SPLIT-SCREEN (ESTILO FREE DARK ADMIN DASHBOARD / EJECUTIVO CLARO) */}
      <div
        className={`relative z-10 w-full max-w-[1120px] grid grid-cols-1 lg:grid-cols-12 rounded-3xl border overflow-hidden transition-colors ${
          isLight
            ? 'bg-white border-slate-200 shadow-[0_25px_70px_rgba(15,23,42,0.12)]'
            : 'bg-[#21222D] border-white/[0.07] shadow-[0_30px_90px_rgba(0,0,0,0.65)]'
        }`}
      >
        {/* COLUMNA IZQUIERDA (7 COLUMNAS): IDENTIDAD CEMENQUIN + PREVIEW ADMIN DASHBOARD */}
        <div
          className={`lg:col-span-7 p-7 sm:p-10 lg:p-11 flex flex-col justify-between relative overflow-hidden border-b lg:border-b-0 lg:border-r transition-colors ${
            isLight
              ? 'bg-slate-50/90 border-slate-200 text-slate-900'
              : 'bg-[#1B1C26] border-white/[0.06] text-white'
          }`}
        >
          {/* Decoración geométrica sutil inspirada en el ángulo corporativo de Cemenquin */}
          <div className="pointer-events-none absolute -right-24 -top-24 w-72 h-72 rounded-full bg-[#A9DFD8]/[0.06] blur-2xl" />
          <div className="pointer-events-none absolute -left-20 -bottom-20 w-72 h-72 rounded-full bg-[#091f5c]/15 blur-2xl" />

          {/* Encabezado Superior con Logo Oficial Cemenquin y Nombre del Sistema */}
          <div className="relative z-10">
            <div
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-7 border-b ${
                isLight ? 'border-slate-200' : 'border-white/[0.06]'
              }`}
            >
              <div className="flex items-center gap-4">
                {/* Tarjeta con el Logo Oficial de Cemenquin */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#0a1e5e] p-1 border border-slate-300 dark:border-white/15 shadow-xl shadow-slate-900/20 dark:shadow-black/40 shrink-0 overflow-hidden flex items-center justify-center">
                  {!logoError ? (
                    <img
                      src={CEMENQUIN_LOGO_PATH}
                      alt="Logo Cemenquin"
                      referrerPolicy="no-referrer"
                      onError={() => setLogoError(true)}
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    <div className="w-full h-full rounded-xl bg-[#0a1e5e] flex flex-col items-center justify-center text-white font-black text-xs">
                      <span className="text-red-500 text-lg leading-none">CQ</span>
                      <span className="text-[9px] tracking-tight mt-0.5 text-white">Cemenquin</span>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2.5">
                    <span
                      className="text-2xl sm:text-3xl font-black tracking-tight"
                      style={{ color: isLight ? '#0a1e5e' : '#ffffff' }}
                    >
                      Cemen
                      <span style={{ color: isLight ? '#0d9488' : '#A9DFD8' }}>
                        Qtime
                      </span>
                    </span>
                  </div>
                  <p
                    className="text-xs sm:text-sm font-bold mt-0.5"
                    style={{ color: isLight ? '#0f766e' : '#A9DFD8' }}
                  >
                    Módulo de Recursos Humanos
                  </p>
                  <p
                    className="text-xs mt-0.5 font-medium"
                    style={{ color: isLight ? '#475569' : '#87888C' }}
                  >
                    Cemenquin® · Gestión de Asistencia, Turnos e Incidencias
                  </p>
                </div>
              </div>
            </div>

            {/* Tarjetas estilo "Free Dark Admin Dashboards" (Métricas y Gráfica de Asistencia) */}
            <div className="mt-7 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2
                    className="text-base sm:text-lg font-extrabold tracking-tight"
                    style={{ color: isLight ? '#0f172a' : '#ffffff' }}
                  >
                    Panel de Control y Asistencia
                  </h2>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: isLight ? '#475569' : '#87888C' }}
                  >
                    Monitoreo en tiempo real de listas de asistencia, tiempo extra y validación semanal
                  </p>
                </div>
              </div>

              {/* Fila de 3 mini-KPIs estilo Figma Dark Dashboard */}
              <div className="grid grid-cols-3 gap-3 pt-1">
                <div className="rounded-2xl bg-[#21222D] border border-white/[0.06] p-3.5">
                  <div className="w-8 h-8 rounded-xl bg-[#FEB95A]/15 text-[#FEB95A] flex items-center justify-center mb-2.5">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="text-sm sm:text-base font-extrabold text-white font-mono tabular-nums">
                    Biométrico
                  </div>
                  <div className="text-[11px] font-medium text-[#87888C] mt-0.5">
                    Control de Checadas
                  </div>
                  <div className="text-[10px] font-semibold text-[#FEB95A] mt-1">
                    Cálculo de Tiempo Extra
                  </div>
                </div>

                <div className="rounded-2xl bg-[#21222D] border border-white/[0.06] p-3.5">
                  <div className="w-8 h-8 rounded-xl bg-[#A9DFD8]/15 text-[#A9DFD8] flex items-center justify-center mb-2.5">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="text-sm sm:text-base font-extrabold text-white font-mono tabular-nums">
                    Supervisión
                  </div>
                  <div className="text-[11px] font-medium text-[#87888C] mt-0.5">
                    Revisión por Listas
                  </div>
                  <div className="text-[10px] font-semibold text-[#A9DFD8] mt-1">
                    Semáforo de Liberación
                  </div>
                </div>

                <div className="rounded-2xl bg-[#21222D] border border-white/[0.06] p-3.5">
                  <div className="w-8 h-8 rounded-xl bg-[#F2C8ED]/15 text-[#F2C8ED] flex items-center justify-center mb-2.5">
                    <FileCheck2 className="w-4 h-4" />
                  </div>
                  <div className="text-sm sm:text-base font-extrabold text-white font-mono tabular-nums">
                    Incidencias
                  </div>
                  <div className="text-[11px] font-medium text-[#87888C] mt-0.5">
                    Permisos y Horarios
                  </div>
                  <div className="text-[10px] font-semibold text-[#F2C8ED] mt-1">
                    Flujo Automatizado
                  </div>
                </div>
              </div>

              {/* Widget Gráfico Admin Dashboard (Curva Mint-Teal + Barras de Nivel) */}
              <div className="rounded-2xl bg-[#21222D] border border-white/[0.06] p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[#A9DFD8]" />
                    <span className="text-xs font-bold text-white">
                      Actividad del Módulo de Recursos Humanos
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-[#87888C]">
                    <span>Asistencia</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#A9DFD8] font-semibold">Validación Semanal</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                  {/* Área de curva suave Mint Teal inspirada en Visitor Insights del Figma */}
                  <div className="sm:col-span-8 h-24">
                    <svg
                      viewBox="0 0 320 90"
                      className="w-full h-full overflow-visible"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <defs>
                        <linearGradient id="mintAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop
                            offset="0%"
                            stopColor={isLight ? '#0d9488' : '#A9DFD8'}
                            stopOpacity={isLight ? '0.28' : '0.42'}
                          />
                          <stop
                            offset="100%"
                            stopColor={isLight ? '#0d9488' : '#A9DFD8'}
                            stopOpacity="0.0"
                          />
                        </linearGradient>
                      </defs>
                      <line
                        x1="0"
                        y1="20"
                        x2="320"
                        y2="20"
                        stroke={isLight ? '#e2e8f0' : '#2B2B36'}
                        strokeDasharray="3 3"
                        strokeWidth="1"
                      />
                      <line
                        x1="0"
                        y1="50"
                        x2="320"
                        y2="50"
                        stroke={isLight ? '#e2e8f0' : '#2B2B36'}
                        strokeDasharray="3 3"
                        strokeWidth="1"
                      />
                      <line
                        x1="0"
                        y1="80"
                        x2="320"
                        y2="80"
                        stroke={isLight ? '#cbd5e1' : '#2B2B36'}
                        strokeWidth="1"
                      />
                      <path
                        d="M0,68 C35,62 55,28 92,34 C128,40 152,64 188,42 C224,20 252,14 285,26 C302,32 312,22 320,18 L320,82 L0,82 Z"
                        fill="url(#mintAreaGrad)"
                      />
                      <path
                        d="M0,68 C35,62 55,28 92,34 C128,40 152,64 188,42 C224,20 252,14 285,26 C302,32 312,22 320,18"
                        fill="none"
                        stroke={isLight ? '#0d9488' : '#A9DFD8'}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      <circle
                        cx="92"
                        cy="34"
                        r="3.5"
                        fill={isLight ? '#ffffff' : '#171821'}
                        stroke={isLight ? '#0d9488' : '#A9DFD8'}
                        strokeWidth="2"
                      />
                      <circle
                        cx="188"
                        cy="42"
                        r="3.5"
                        fill={isLight ? '#ffffff' : '#171821'}
                        stroke={isLight ? '#0d9488' : '#A9DFD8'}
                        strokeWidth="2"
                      />
                      <circle
                        cx="285"
                        cy="26"
                        r="4"
                        fill={isLight ? '#d97706' : '#FEB95A'}
                        stroke={isLight ? '#ffffff' : '#171821'}
                        strokeWidth="1.5"
                      />
                    </svg>
                  </div>

                  {/* Mini barras verticales estilo Volume / Level del Figma */}
                  <div className="sm:col-span-4 flex items-end justify-around h-20 px-2 pt-2 border-t sm:border-t-0 sm:border-l border-white/[0.06]">
                    {[
                      { h: '55%', top: isLight ? '#0d9488' : '#A9DFD8', day: 'L' },
                      { h: '78%', top: isLight ? '#0d9488' : '#A9DFD8', day: 'M' },
                      { h: '65%', top: isLight ? '#0284c7' : '#20AEF3', day: 'X' },
                      { h: '88%', top: isLight ? '#0d9488' : '#A9DFD8', day: 'J' },
                      { h: '92%', top: isLight ? '#d97706' : '#FEB95A', day: 'V' },
                      { h: '48%', top: isLight ? '#9333ea' : '#F2C8ED', day: 'S' },
                    ].map((bar) => (
                      <div key={bar.day} className="flex flex-col items-center gap-1.5 h-full justify-end">
                        <div
                          className="w-2.5 h-14 rounded-full overflow-hidden flex flex-col justify-end p-0.5"
                          style={{ backgroundColor: isLight ? '#e2e8f0' : '#171821' }}
                        >
                          <div
                            className="w-full rounded-full transition-all"
                            style={{ height: bar.h, backgroundColor: bar.top }}
                          />
                        </div>
                        <span className="text-[9px] font-mono text-[#87888C]">{bar.day}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pie de columna izquierda limpio (Sin mención a CONTPAQi) */}
          <div className="relative z-10 pt-6 mt-6 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-xs text-[#87888C]">
            <span
              className="font-bold"
              style={{ color: isLight ? '#0a1e5e' : '#f8fafc' }}
            >
              Cemenquin® · Cemen
              <span style={{ color: isLight ? '#0d9488' : '#A9DFD8' }}>Qtime</span>
            </span>
            <span>Módulo de Recursos Humanos</span>
          </div>
        </div>

        {/* COLUMNA DERECHA (5 COLUMNAS): FORMULARIO DE ACCESO Y RECUPERACIÓN */}
        <div className="lg:col-span-5 bg-[#21222D] p-7 sm:p-10 lg:p-11 flex flex-col justify-center">
          {/* Cinta superior de identidad en el formulario + Selector de Tema */}
          <div className="flex items-center justify-between gap-3 mb-7">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#0a1e5e] p-0.5 border border-slate-300 dark:border-white/15 shadow-lg shrink-0 overflow-hidden flex items-center justify-center">
                {!logoError ? (
                  <img
                    src={CEMENQUIN_LOGO_PATH}
                    alt="Cemenquin"
                    referrerPolicy="no-referrer"
                    onError={() => setLogoError(true)}
                    className="w-full h-full object-cover rounded-[14px]"
                  />
                ) : (
                  <span className="text-xs font-black text-white">CQ</span>
                )}
              </div>
              <div>
                <h1
                  className="text-lg font-black tracking-tight leading-tight"
                  style={{ color: isLight ? '#0a1e5e' : '#ffffff' }}
                >
                  Cemen
                  <span style={{ color: isLight ? '#0d9488' : '#A9DFD8' }}>
                    Qtime
                  </span>
                </h1>
                <p
                  className="text-xs font-semibold"
                  style={{ color: isLight ? '#475569' : '#87888C' }}
                >
                  Módulo de Recursos Humanos
                </p>
              </div>
            </div>

            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                className="p-2.5 rounded-xl bg-[#171821] hover:bg-[#2B2B36] border border-white/[0.08] text-[#FEB95A] flex items-center gap-1.5 text-[11px] font-bold transition-all cursor-pointer shrink-0"
                title={isLight ? 'Cambiar a Tema Oscuro' : 'Cambiar a Tema Blanco'}
              >
                {isLight ? (
                  <>
                    <Moon className="w-3.5 h-3.5 text-slate-700" />
                    <span className="hidden sm:inline text-slate-700">Oscuro</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-3.5 h-3.5 text-[#FEB95A]" />
                    <span className="hidden sm:inline text-[#FEB95A]">Claro</span>
                  </>
                )}
              </button>
            )}
          </div>

          {!isRecoveryMode ? (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-extrabold text-white tracking-tight">
                  Iniciar Sesión
                </h2>
                <p className="text-xs text-[#87888C] mt-1.5 leading-relaxed">
                  Ingresa con tu usuario, número de empleado o correo electrónico registrado.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-2">
                    Usuario / No. Empleado / Correo
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#87888C] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => {
                        setIdentifier(e.target.value);
                        setErrorMsg(null);
                      }}
                      placeholder="Ej. admin, 00615 o correo@empresa.com"
                      className="w-full rounded-xl pl-11 pr-4 py-3.5 bg-[#171821] border border-white/[0.08] hover:border-white/15 focus:border-[#A9DFD8] text-white placeholder-[#87888C] text-xs font-medium outline-none transition-colors"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-2">
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#87888C] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setErrorMsg(null);
                      }}
                      placeholder="Ingresa tu contraseña"
                      className="w-full rounded-xl pl-11 pr-11 py-3.5 bg-[#171821] border border-white/[0.08] hover:border-white/15 focus:border-[#A9DFD8] text-white placeholder-[#87888C] text-xs font-medium outline-none transition-colors"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#87888C] hover:text-white transition-colors cursor-pointer"
                      title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Fila: Recordarme + ¿Olvidaste tu contraseña? */}
                <div className="flex items-center justify-between pt-1 pb-1">
                  <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={rememberMe}
                      onClick={() => setRememberMe(!rememberMe)}
                      className={`w-9 h-5 rounded-full transition-colors p-0.5 flex items-center cursor-pointer ${
                        rememberMe ? 'bg-[#A9DFD8]' : 'bg-[#171821] border border-white/15'
                      }`}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded-full transition-transform ${
                          rememberMe
                            ? 'translate-x-4 bg-[#171821]'
                            : 'translate-x-0 bg-[#87888C]'
                        }`}
                      />
                    </button>
                    <span className="text-xs font-medium text-[#87888C] hover:text-slate-200 transition-colors">
                      Recordar usuario
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
                    className="text-xs font-semibold text-[#A9DFD8] hover:text-[#c5efe9] transition-colors cursor-pointer"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                {errorMsg && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-scale-in">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={Boolean(authenticatingUser)}
                    className="w-full py-3.5 px-5 rounded-xl bg-[#A9DFD8] hover:bg-[#95d5cd] active:bg-[#82c9c0] text-[#171821] font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-[#A9DFD8]/15 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <LogIn className="w-4 h-4 stroke-[2.5]" />
                    <span>
                      {authenticatingUser ? 'Verificando Acceso...' : 'Entrar al Sistema'}
                    </span>
                  </button>
                </div>
              </form>
            </>
          ) : (
            /* MODO RECUPERAR CONTRASEÑA */
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#A9DFD8]/15 border border-[#A9DFD8]/30 flex items-center justify-center text-[#A9DFD8]">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-white">
                      Recuperar Contraseña
                    </h2>
                    <p className="text-[11px] text-[#87888C]">
                      Restablece tu acceso por correo electrónico
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeRecoveryMode}
                  className="text-xs font-bold text-[#87888C] hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Volver
                </button>
              </div>

              {recoveryStep === 'request' && (
                <form onSubmit={handleRequestRecoveryCode} className="space-y-4 pt-1">
                  <p className="text-xs text-[#87888C] leading-relaxed">
                    Ingresa tu <strong className="text-white">correo electrónico</strong>, nombre de usuario o número de empleado para enviarte un código de verificación de 6 dígitos.
                  </p>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-2">
                      Correo / Usuario / No. Empleado
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#87888C] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={recoveryIdentifier}
                        onChange={(e) => {
                          setRecoveryIdentifier(e.target.value);
                          setRecoveryError(null);
                        }}
                        placeholder="correo@empresa.com o #00615"
                        className="w-full rounded-xl pl-11 pr-4 py-3.5 bg-[#171821] border border-white/[0.08] focus:border-[#A9DFD8] text-white placeholder-[#87888C] text-xs font-medium outline-none"
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
                    className="w-full py-3.5 px-5 rounded-xl bg-[#A9DFD8] hover:bg-[#95d5cd] text-[#171821] font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>
                      {isSendingCode ? 'Enviando código...' : 'Enviar Código a mi Correo'}
                    </span>
                  </button>
                </form>
              )}

              {recoveryStep === 'verify' && recoveryInfo && (
                <form onSubmit={handleConfirmResetPassword} className="space-y-3.5 pt-1">
                  {recoveryInfo.emailSent ? (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs space-y-1">
                      <p className="font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        Código enviado a {recoveryInfo.userEmail}
                      </p>
                      <p className="text-[11px] text-emerald-300/80">
                        Ingresa el código de 6 dígitos recibido en tu bandeja de entrada.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-[#FEB95A]/10 border border-[#FEB95A]/30 text-[#FEB95A] text-xs space-y-1">
                      <p className="font-bold">
                        Cuenta verificada: {recoveryInfo.userName}
                      </p>
                      <p className="text-[11px] text-amber-200/90">
                        Código de verificación temporal:{' '}
                        <strong className="font-mono text-white bg-[#171821] px-2 py-0.5 rounded border border-[#FEB95A]/40">
                          {recoveryInfo.expectedCode}
                        </strong>
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                      Código de Verificación (6 dígitos)
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
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                      Nueva Contraseña
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
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                      Confirmar Nueva Contraseña
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
                    className="w-full py-3 px-5 rounded-xl bg-[#A9DFD8] hover:bg-[#95d5cd] text-[#171821] font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Guardar Nueva Contraseña</span>
                  </button>
                </form>
              )}

              {recoveryStep === 'done' && (
                <div className="p-5 rounded-2xl bg-[#171821] border border-[#A9DFD8]/30 text-center space-y-3">
                  <CheckCircle2 className="w-8 h-8 text-[#A9DFD8] mx-auto" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-extrabold text-white">
                      ¡Contraseña Actualizada!
                    </h3>
                    <p className="text-xs text-[#87888C]">
                      Tu nueva contraseña ha sido guardada en el sistema.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeRecoveryMode}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#A9DFD8] hover:bg-[#95d5cd] text-[#171821] font-extrabold text-xs uppercase tracking-wider cursor-pointer"
                  >
                    Iniciar Sesión Ahora
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Pie del formulario derecho (sin CONTPAQi) */}
          <div className="mt-8 pt-5 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-[#87888C]">
            <span>Acceso Seguro por Rol</span>
            <span>Módulo de Recursos Humanos</span>
          </div>
        </div>
      </div>
    </div>
  );
};
