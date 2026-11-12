/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  User,
  LogIn,
  Eye,
  EyeOff,
  AlertCircle,
  Server,
  CheckCircle2,
  KeyRound,
  Sparkles,
  Mail,
  ArrowLeft,
  Send,
} from 'lucide-react';
import { PortalUser, getUserAllowedLists } from '../../types/portal';
import { PortalService } from '../../services/portalService';

interface LoginViewProps {
  users: PortalUser[];
  onLoginSuccess: (user: PortalUser) => void;
  onResetUserPassword?: (userId: string, newPassword: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  users,
  onLoginSuccess,
  onResetUserPassword,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [authenticatingUser, setAuthenticatingUser] = useState<PortalUser | null>(null);

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

  const triggerAnimatedLogin = (user: PortalUser) => {
    setErrorMsg(null);
    setAuthenticatingUser(user);
    setTimeout(() => {
      onLoginSuccess(user);
    }, 1050);
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
            (empRaw === cleanId || (Boolean(cleanNumeric) && empRaw.replace(/^0+/, '') === cleanNumeric));
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Efectos sutiles de iluminación de fondo con animación flotante */}
      <div className="pointer-events-none absolute -top-40 -left-40 w-96 h-96 rounded-full bg-blue-600/15 blur-3xl animate-float-slow" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-indigo-600/15 blur-3xl animate-float-slow" />

      {/* Overlay de Animación de Inicio de Sesión */}
      {authenticatingUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-scale-in">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-indigo-500/40 shadow-2xl p-8 text-center space-y-5 relative overflow-hidden">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white mx-auto shadow-xl shadow-indigo-600/30 animate-bounce">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <Sparkles className="w-3 h-3 text-emerald-400" /> Acceso Verificado Correctamente
              </span>
              <h2 className="text-xl font-black text-white">
                ¡Bienvenido, {authenticatingUser.name}!
              </h2>
              {authenticatingUser.employeeId && (
                <p className="text-xs font-mono text-blue-300 font-bold">
                  No. de Empleado: #{authenticatingUser.employeeId}
                </p>
              )}
              <p className="text-xs text-slate-400">
                {authenticatingUser.role === 'supervisor'
                  ? `Cargando tu espacio de supervisión y lista(s): ${getUserAllowedLists(authenticatingUser).join(', ')}`
                  : authenticatingUser.role === 'rh'
                  ? 'Preparando consola de Recursos Humanos, Dispersión y CONTPAQi®...'
                  : 'Iniciando consola de Administración General y Gestión de Usuarios...'}
              </p>
            </div>

            {/* Barra de progreso animada */}
            <div className="w-full h-2 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 rounded-full animate-progress-fill" />
            </div>

            <p className="text-[11px] font-mono text-slate-500">
              Sincronizando notificaciones y horarios programados...
            </p>
          </div>
        </div>
      )}

      <div className="w-full max-w-md rounded-3xl bg-slate-900/95 border border-slate-800 shadow-2xl overflow-hidden backdrop-blur-xl animate-fade-up p-6 sm:p-9">
        {/* Logo e Identidad */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-base shadow-lg shadow-blue-600/20">
            CQ
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold tracking-tight text-white">
                Cemen<span className="text-blue-400">Qtime</span>
              </h1>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                Corporativo
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Portal de Recursos Humanos, Nóminas y Supervisión
            </p>
          </div>
        </div>

        {!isRecoveryMode ? (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-black text-slate-100">Iniciar Sesión</h2>
              <p className="text-xs text-slate-400 mt-1">
                Ingresa tu usuario, número de empleado de 5 dígitos o correo empresarial junto con tu contraseña asignada.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block mb-1.5">
                  Usuario / No. Empleado / Correo
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="Ingresa tu usuario, correo o número de empleado"
                    className="w-full rounded-xl pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono outline-none focus:border-blue-500 transition-colors"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    Contraseña de Acceso
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setRecoveryIdentifier(identifier);
                      setIsRecoveryMode(true);
                      setRecoveryStep('request');
                      setRecoveryError(null);
                    }}
                    className="text-[11px] font-bold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="Ingresa tu contraseña..."
                    className="w-full rounded-xl pl-10 pr-10 py-3 bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono outline-none focus:border-blue-500 transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2 animate-scale-in">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={Boolean(authenticatingUser)}
                className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                <span>{authenticatingUser ? 'Verificando Acceso...' : 'Entrar al Portal'}</span>
              </button>
            </form>
          </>
        ) : (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-100">
                    Recuperar Contraseña
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Restablece tu acceso mediante tu correo registrado
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeRecoveryMode}
                className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Volver
              </button>
            </div>

            {recoveryStep === 'request' && (
              <form onSubmit={handleRequestRecoveryCode} className="space-y-4 pt-1">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Ingresa tu <strong>correo electrónico empresarial</strong>, nombre de usuario o número de empleado. Enviaremos un código de verificación a tu correo registrado.
                </p>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block mb-1.5">
                    Correo / Usuario / No. Empleado
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={recoveryIdentifier}
                      onChange={(e) => {
                        setRecoveryIdentifier(e.target.value);
                        setRecoveryError(null);
                      }}
                      placeholder="ejemplo@empresa.com o #00615"
                      className="w-full rounded-xl pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono outline-none focus:border-blue-500"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                {recoveryError && (
                  <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{recoveryError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSendingCode}
                  className="w-full py-3 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {isSendingCode ? 'Enviando código al correo...' : 'Enviar Código a mi Correo'}
                  </span>
                </button>
              </form>
            )}

            {recoveryStep === 'verify' && recoveryInfo && (
              <form onSubmit={handleConfirmResetPassword} className="space-y-3.5 pt-1">
                {recoveryInfo.emailSent ? (
                  <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      Código enviado a {recoveryInfo.userEmail}
                    </p>
                    <p className="text-[11px] text-emerald-300/90">
                      Revisa tu bandeja de entrada e ingresa el código de 6 dígitos junto con tu nueva contraseña.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs space-y-1">
                    <p className="font-bold">
                      Cuenta verificada: {recoveryInfo.userName} ({recoveryInfo.userEmail})
                    </p>
                    <p className="text-[11px] text-amber-300/90">
                      El servidor SMTP aún no está activo o en línea. Usa este código de verificación temporal para restablecer tu contraseña:{' '}
                      <strong className="font-mono text-white bg-slate-950 px-2 py-0.5 rounded border border-amber-400/40">
                        {recoveryInfo.expectedCode}
                      </strong>
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block mb-1">
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
                    className="w-full rounded-xl px-4 py-2.5 bg-slate-950 border border-slate-800 text-slate-100 text-sm font-mono font-bold tracking-widest text-center outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block mb-1">
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
                    className="w-full rounded-xl px-3.5 py-2.5 bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block mb-1">
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
                    className="w-full rounded-xl px-3.5 py-2.5 bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono outline-none focus:border-blue-500"
                    required
                  />
                </div>

                {recoveryError && (
                  <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{recoveryError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Guardar Nueva Contraseña</span>
                </button>
              </form>
            )}

            {recoveryStep === 'done' && (
              <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-center space-y-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <div className="space-y-1">
                  <h3 className="text-sm font-extrabold text-white">
                    ¡Contraseña Actualizada con Éxito!
                  </h3>
                  <p className="text-xs text-slate-300">
                    Tu nueva contraseña ha quedado guardada y sincronizada en el sistema.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeRecoveryMode}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs uppercase tracking-wider cursor-pointer"
                >
                  Iniciar Sesión Ahora
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mt-7 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-emerald-400" />
            <span>Acceso Seguro con Rol Asignado</span>
          </span>
          <span>CONTPAQi® Nóminas</span>
        </div>
      </div>
    </div>
  );
};


