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
  Building2,
  Briefcase,
  AlertCircle,
  Server,
  CheckCircle2,
  KeyRound,
  Sparkles,
} from 'lucide-react';
import { PortalUser, getUserAllowedLists } from '../../types/portal';
import { PortalService } from '../../services/portalService';

interface LoginViewProps {
  users: PortalUser[];
  onLoginSuccess: (user: PortalUser) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ users, onLoginSuccess }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [authenticatingUser, setAuthenticatingUser] = useState<PortalUser | null>(null);

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

  const handleQuickFill = (u: PortalUser) => {
    const loginId = u.username || u.employeeId || u.email;
    const loginPass = u.password || u.employeeId || '12345';
    setIdentifier(loginId);
    setPassword(loginPass);
    setErrorMsg(null);
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

      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl overflow-hidden backdrop-blur-xl animate-fade-up">
        {/* Columna Izquierda: Formulario de Inicio de Sesión */}
        <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between">
          <div>
            {/* Logo e Identidad */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-base shadow-lg shadow-blue-600/20">
                AP
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-extrabold tracking-tight text-white">
                    AttendancePRO <span className="text-blue-400">v10</span>
                  </h1>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                    KVM 2 Ready
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Portal de Recursos Humanos, Nóminas y Supervisión
                </p>
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-black text-slate-100">Iniciar Sesión en el Sistema</h2>
              <p className="text-xs text-slate-400 mt-1">
                Ingresa tu usuario, número de empleado de 5 dígitos (ej. <code className="text-blue-300 font-mono">00615</code>) o correo corporativo para acceder a tus listas asignadas.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block mb-1.5">
                  Usuario / No. Empleado (5 dígitos) / Correo
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
                    placeholder="Ej: 00615, admin, rh o correo@empresa.com"
                    className="w-full rounded-xl pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono outline-none focus:border-blue-500 transition-colors"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block mb-1.5">
                  Contraseña de Acceso
                </label>
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
                <span>{authenticatingUser ? 'Iniciando Sesión...' : 'Entrar al Portal'}</span>
              </button>
            </form>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-emerald-400" />
              <span>Arquitectura Lista para Hostinger VPS KVM 2</span>
            </span>
            <span>Control de Nómina y CONTPAQi®</span>
          </div>
        </div>

        {/* Columna Derecha: Cuentas Activas y Acceso Rápido de Prueba */}
        <div className="lg:col-span-5 bg-slate-950/80 border-t lg:border-t-0 lg:border-l border-slate-800 p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <KeyRound className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-200">
                Usuarios Registrados (Clic para Autocompletar)
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
              Selecciona cualquier usuario para llenar sus credenciales o inicia sesión directamente. Desde el perfil <strong>Administrador</strong> puedes crear nuevos supervisores, cambiar contraseñas y asignar qué listas trabajarán.
            </p>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {users.filter(u => u.active).map((u) => {
                const lists = getUserAllowedLists(u);
                const loginUser = u.username || u.employeeId || u.email;
                const loginPass = u.password || u.employeeId || '12345';

                return (
                  <div
                    key={u.id}
                    onClick={() => handleQuickFill(u)}
                    className="p-3 rounded-xl bg-slate-900/90 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/40 transition-all cursor-pointer group hover-lift"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {u.role === 'admin' ? (
                          <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
                        ) : u.role === 'rh' ? (
                          <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                        ) : (
                          <Briefcase className="w-4 h-4 text-amber-400 shrink-0" />
                        )}
                        <span className="text-xs font-bold text-slate-100 group-hover:text-white">
                          {u.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerAnimatedLogin(u);
                        }}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 transition-colors cursor-pointer"
                      >
                        Entrar con animación →
                      </button>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] font-mono text-slate-400">
                      <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
                        Usuario: <strong className="text-blue-300">{loginUser}</strong>
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
                        Clave: <strong className="text-emerald-300">{loginPass}</strong>
                      </span>
                    </div>

                    {u.role === 'supervisor' && lists.length > 0 && (
                      <div className="mt-1.5 text-[10px] text-amber-300/90 flex items-center gap-1 flex-wrap">
                        <CheckCircle2 className="w-3 h-3 text-amber-400 shrink-0" />
                        <span>Lista(s) asignada(s): <strong>{lists.join(', ')}</strong></span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/30 text-[11px] text-indigo-200 leading-relaxed">
            <strong>💡 Aislamiento por Lista:</strong> Cada supervisor accede únicamente a la(s) lista(s) de nómina y colaboradores que el Administrador le haya asignado en su perfil.
          </div>
        </div>
      </div>
    </div>
  );
};

