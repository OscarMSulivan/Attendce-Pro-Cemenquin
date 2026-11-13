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
  Mail,
  ArrowLeft,
  Send,
  Clock,
  Users,
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
  theme = 'light',
  onToggleTheme,
}) => {
  const isLight = theme !== 'dark';
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
    }, 650);
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
      // Si el servidor no está disponible (modo offline), validar contra código local si existe
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

  return (
    <div className="min-h-screen w-full bg-[#171821] text-white flex items-center justify-center p-4 sm:p-6 lg:p-10 relative overflow-hidden">
      {/* OVERLAY DE ACCESO VERIFICADO (Sin rebotes artificiales) */}
      {authenticatingUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center p-6 animate-scale-in">
          <div className="w-full max-w-md rounded-xl bg-[#21222D] border border-white/10 shadow-xl p-7 text-center space-y-4">
            <div className="w-12 h-12 rounded-lg bg-[#A9DFD8]/15 border border-[#A9DFD8]/40 flex items-center justify-center text-[#A9DFD8] mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A9DFD8]">
                Sesión autenticada
              </span>
              <h2 className="text-lg font-semibold text-white">
                Bienvenido, {authenticatingUser.name}
              </h2>
              {authenticatingUser.employeeId && (
                <p className="text-xs font-mono text-[#A9DFD8] font-medium tabular-nums">
                  No. de empleado: #{authenticatingUser.employeeId}
                </p>
              )}
              <p className="text-xs text-[#87888C]">
                {authenticatingUser.role === 'supervisor'
                  ? `Abriendo listas asignadas: ${getUserAllowedLists(authenticatingUser).join(', ')}`
                  : 'Cargando consola de Recursos Humanos y Nóminas...'}
              </p>
            </div>

            <div className="w-full h-1.5 rounded-full bg-[#171821] overflow-hidden border border-white/[0.08]">
              <div className="h-full bg-[#10B981] rounded-full animate-progress-fill" />
            </div>
          </div>
        </div>
      )}

      {/* CONTENEDOR PRINCIPAL ARQUITECTÓNICO (2 COLUMNAS CON BORDES DE 1PX) */}
      <div className="relative z-10 w-full max-w-[1080px] grid grid-cols-1 lg:grid-cols-12 rounded-xl border border-white/[0.08] bg-[#21222D] overflow-hidden shadow-sm">
        {/* COLUMNA IZQUIERDA (7 COLUMNAS): FICHA TÉCNICA DE PLANTA Y NÓMINA */}
        <div className="lg:col-span-7 p-7 sm:p-10 flex flex-col justify-between bg-[#171821] border-b lg:border-b-0 lg:border-r border-white/[0.08]">
          <div>
            {/* Cabecera de marca */}
            <div className="flex items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-lg bg-[#0a1e5e] p-1 border border-white/15 shrink-0 overflow-hidden flex items-center justify-center">
                  {!logoError ? (
                    <img
                      src={CEMENQUIN_LOGO_PATH}
                      alt="Logo Cemenquin"
                      referrerPolicy="no-referrer"
                      onError={() => setLogoError(true)}
                      className="w-full h-full object-cover rounded-md"
                    />
                  ) : (
                    <div className="w-full h-full rounded-md bg-[#0a1e5e] flex flex-col items-center justify-center text-white font-bold text-xs">
                      <span className="text-red-500 text-base leading-none">CQ</span>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold tracking-tight text-white">
                      Cemen<span className="text-[#A9DFD8]">Qtime</span>
                    </span>
                    <span className="text-[11px] font-mono tabular-nums px-2 py-0.5 rounded bg-[#21222D] border border-white/[0.08] text-[#87888C]">
                      v10.4
                    </span>
                  </div>
                  <p className="text-xs font-medium text-[#87888C] mt-0.5">
                    Cemenquin® · Consola de Asistencia, Turnos y Nómina Semanal
                  </p>
                </div>
              </div>
            </div>

            {/* Propuesta de valor directa y sin adjetivos vacíos */}
            <div className="mt-6">
              <h2 className="text-lg sm:text-xl font-semibold text-white tracking-tight leading-snug">
                Auditoría biométrica, dispersión por supervisor y validación semanal en un solo libro mayor.
              </h2>
              <p className="text-xs text-[#87888C] mt-2 leading-relaxed max-w-[62ch]">
                Concilia registros de reloj checador (ENT, ERT, SNT, RST), calcula retardos y tiempo extra conforme a reglamento, y libera listas firmadas con trazabilidad completa.
              </p>
            </div>

            {/* Grilla Ledger de 3 módulos operativos (1px hairline grid) */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 rounded-lg border border-white/[0.08] bg-[#21222D] divide-y sm:divide-y-0 sm:divide-x divide-white/[0.08] overflow-hidden">
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white">Motor biométrico</span>
                  <Clock className="w-3.5 h-3.5 text-[#A9DFD8]" />
                </div>
                <p className="text-[11px] text-[#87888C] leading-snug">
                  Fusión automática de checadas RST, cruces nocturnos y cálculo de retardos.
                </p>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white">Semáforo de listas</span>
                  <Users className="w-3.5 h-3.5 text-[#A9DFD8]" />
                </div>
                <p className="text-[11px] text-[#87888C] leading-snug">
                  Dispersión por jefatura con cuenta regresiva y alertas por correo.
                </p>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white">Formatos y permisos</span>
                  <FileCheck2 className="w-3.5 h-3.5 text-[#A9DFD8]" />
                </div>
                <p className="text-[11px] text-[#87888C] leading-snug">
                  Resolución de checadas huérfanas, vacaciones e incapacidades con evidencia.
                </p>
              </div>
            </div>

            {/* Tabla técnica de parámetros activos */}
            <div className="mt-5 rounded-lg border border-white/[0.08] bg-[#21222D] overflow-hidden">
              <div className="px-4 py-2 bg-[#2B2B36] border-b border-white/[0.08] flex items-center justify-between">
                <span className="text-[11px] font-semibold text-white">
                  Parámetros técnicos de operación
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#A9DFD8]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                  Activo
                </span>
              </div>
              <div className="divide-y divide-white/[0.06] text-xs">
                <div className="px-4 py-2.5 flex items-center justify-between">
                  <span className="text-[#87888C]">Corte de semana fiscal</span>
                  <span className="font-mono tabular-nums text-white font-medium">
                    Jueves a Miércoles (2025–2028)
                  </span>
                </div>
                <div className="px-4 py-2.5 flex items-center justify-between">
                  <span className="text-[#87888C]">Lectura de checadas y rebotes</span>
                  <span className="font-mono tabular-nums text-white font-medium">
                    24h circular · Filtro anti-rebote
                  </span>
                </div>
                <div className="px-4 py-2.5 flex items-center justify-between">
                  <span className="text-[#87888C]">Notificaciones y respaldo</span>
                  <span className="font-mono tabular-nums text-white font-medium">
                    SSE en vivo + Correo corporativo
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Pie de columna izquierda */}
          <div className="pt-6 mt-6 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-2 text-xs text-[#87888C]">
            <span className="font-semibold text-white">Cemenquin® · Recursos Humanos</span>
            <span className="font-mono tabular-nums">Sistema de control de asistencia</span>
          </div>
        </div>

        {/* COLUMNA DERECHA (5 COLUMNAS): FORMULARIO DE ACCESO */}
        <div className="lg:col-span-5 bg-[#21222D] p-7 sm:p-10 flex flex-col justify-between">
          <div>
            {/* Barra superior del formulario + Selector de Tema */}
            <div className="flex items-center justify-between gap-3 mb-7 pb-4 border-b border-white/[0.08]">
              <div>
                <span className="text-xs font-semibold text-[#A9DFD8] block">
                  Portal corporativo
                </span>
                <span className="text-[11px] text-[#87888C]">
                  Autenticación por rol asignado
                </span>
              </div>

              {onToggleTheme && (
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="px-3 py-1.5 rounded-lg bg-[#171821] hover:bg-[#2B2B36] border border-white/[0.08] text-white flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer shrink-0"
                  title={isLight ? 'Cambiar a Modo Oscuro' : 'Cambiar a Modo Claro Técnico'}
                >
                  {isLight ? (
                    <>
                      <Moon className="w-3.5 h-3.5 text-[#87888C]" />
                      <span>Modo oscuro</span>
                    </>
                  ) : (
                    <>
                      <Sun className="w-3.5 h-3.5 text-[#FEB95A]" />
                      <span>Modo claro</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {!isRecoveryMode ? (
              <>
                <div className="mb-6">
                  <h1 className="text-xl font-semibold text-white tracking-tight">
                    Iniciar sesión
                  </h1>
                  <p className="text-xs text-[#87888C] mt-1 leading-relaxed">
                    Ingresa con tu usuario, número de empleado o correo electrónico.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="login-identifier"
                      className="text-xs font-medium text-slate-300 block mb-1.5"
                    >
                      Usuario, No. de empleado o correo
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-[#87888C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="login-identifier"
                        type="text"
                        value={identifier}
                        onChange={(e) => {
                          setIdentifier(e.target.value);
                          setErrorMsg(null);
                        }}
                        placeholder="Ej. admin, 00615 o correo@cemenquin.com"
                        className="w-full rounded-lg pl-10 pr-3.5 py-2.5 bg-[#171821] border border-white/[0.08] focus:border-[#A9DFD8] text-white placeholder-[#87888C] text-xs font-medium outline-none transition-colors"
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="login-password"
                      className="text-xs font-medium text-slate-300 block mb-1.5"
                    >
                      Contraseña
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#87888C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setErrorMsg(null);
                        }}
                        placeholder="Ingresa tu contraseña"
                        className="w-full rounded-lg pl-10 pr-10 py-2.5 bg-[#171821] border border-white/[0.08] focus:border-[#A9DFD8] text-white placeholder-[#87888C] text-xs font-medium outline-none transition-colors"
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
                        className="w-3.5 h-3.5 rounded accent-[#0F6E56]"
                      />
                      <span className="text-xs text-[#87888C]">Recordar usuario</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setRecoveryIdentifier(identifier);
                        setIsRecoveryMode(true);
                        setRecoveryStep('request');
                        setRecoveryError(null);
                      }}
                      className="text-xs font-medium text-[#A9DFD8] hover:underline transition-colors cursor-pointer"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>

                  {errorMsg && (
                    <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2 animate-scale-in">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={Boolean(authenticatingUser)}
                      className="w-full py-2.5 px-4 rounded-lg bg-[#A9DFD8] hover:bg-[#95d5cd] text-[#171821] font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>
                        {authenticatingUser ? 'Verificando credenciales...' : 'Entrar al portal'}
                      </span>
                    </button>
                  </div>
                </form>
              </>
            ) : (
              /* MODO RECUPERAR CONTRASEÑA */
              <div className="space-y-4 animate-fade-up">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#A9DFD8]/15 border border-[#A9DFD8]/30 flex items-center justify-center text-[#A9DFD8]">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-white">
                        Recuperar contraseña
                      </h2>
                      <p className="text-[11px] text-[#87888C]">
                        Verificación mediante código de 6 dígitos
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeRecoveryMode}
                    className="text-xs font-medium text-[#87888C] hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Volver
                  </button>
                </div>

                {recoveryStep === 'request' && (
                  <form onSubmit={handleRequestRecoveryCode} className="space-y-4 pt-1">
                    <p className="text-xs text-[#87888C] leading-relaxed">
                      Ingresa tu correo electrónico, usuario o número de empleado para enviarte un código de verificación.
                    </p>
                    <div>
                      <label className="text-xs font-medium text-slate-300 block mb-1.5">
                        Correo, usuario o No. de empleado
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-[#87888C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={recoveryIdentifier}
                          onChange={(e) => {
                            setRecoveryIdentifier(e.target.value);
                            setRecoveryError(null);
                          }}
                          placeholder="correo@cemenquin.com o #00615"
                          className="w-full rounded-lg pl-10 pr-3.5 py-2.5 bg-[#171821] border border-white/[0.08] focus:border-[#A9DFD8] text-white placeholder-[#87888C] text-xs font-medium outline-none"
                          required
                          autoFocus
                        />
                      </div>
                    </div>

                    {recoveryError && (
                      <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <span>{recoveryError}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSendingCode}
                      className="w-full py-2.5 px-4 rounded-lg bg-[#A9DFD8] hover:bg-[#95d5cd] text-[#171821] font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                      <span>
                        {isSendingCode ? 'Enviando código...' : 'Enviar código de verificación'}
                      </span>
                    </button>
                  </form>
                )}

                {recoveryStep === 'verify' && recoveryInfo && (
                  <form onSubmit={handleConfirmResetPassword} className="space-y-3.5 pt-1">
                    {recoveryInfo.emailSent ? (
                      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs space-y-1">
                        <p className="font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          Código enviado a {recoveryInfo.userEmail}
                        </p>
                        <p className="text-[11px] text-emerald-300/80">
                          Ingresa el código de 6 dígitos recibido en tu correo (vigencia 10 min).
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-[#FEB95A]/10 border border-[#FEB95A]/30 text-[#FEB95A] text-xs space-y-1">
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
                      <label className="text-xs font-medium text-slate-300 block mb-1.5">
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
                        className="w-full rounded-lg px-4 py-2 bg-[#171821] border border-white/[0.08] focus:border-[#A9DFD8] text-white text-sm font-mono font-semibold tracking-widest text-center outline-none tabular-nums"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-300 block mb-1.5">
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
                        className="w-full rounded-lg px-3.5 py-2 bg-[#171821] border border-white/[0.08] focus:border-[#A9DFD8] text-white text-xs outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-300 block mb-1.5">
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
                        className="w-full rounded-lg px-3.5 py-2 bg-[#171821] border border-white/[0.08] focus:border-[#A9DFD8] text-white text-xs outline-none"
                        required
                      />
                    </div>

                    {recoveryError && (
                      <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <span>{recoveryError}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full py-2.5 px-4 rounded-lg bg-[#A9DFD8] hover:bg-[#95d5cd] text-[#171821] font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Guardar nueva contraseña</span>
                    </button>
                  </form>
                )}

                {recoveryStep === 'done' && (
                  <div className="p-5 rounded-xl bg-[#171821] border border-[#A9DFD8]/30 text-center space-y-3">
                    <CheckCircle2 className="w-7 h-7 text-[#A9DFD8] mx-auto" />
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-white">
                        Contraseña actualizada
                      </h3>
                      <p className="text-xs text-[#87888C]">
                        Tu nueva contraseña ya está activa en el servidor.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closeRecoveryMode}
                      className="w-full py-2.5 px-4 rounded-lg bg-[#A9DFD8] hover:bg-[#95d5cd] text-[#171821] font-semibold text-xs cursor-pointer"
                    >
                      Continuar al inicio de sesión
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pie del formulario derecho */}
          <div className="mt-8 pt-4 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-[#87888C]">
            <span>Acceso verificado por rol</span>
            <span className="font-mono">CemenQtime</span>
          </div>
        </div>
      </div>
    </div>
  );
};
