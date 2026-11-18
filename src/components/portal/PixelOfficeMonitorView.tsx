/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Radio,
  Users,
  Coffee,
  PowerOff,
  Send,
  Sparkles,
  Volume2,
  Clock,
  Activity,
  Terminal,
  RefreshCw,
  Eye,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  BellRing,
  ShieldAlert,
  Laptop,
} from 'lucide-react';
import {
  PortalUser,
  UserLivePresence,
  LiveActivityLogEntry,
  LivePresenceStatus,
} from '../../types/portal';

interface PixelOfficeMonitorViewProps {
  currentUser: PortalUser;
  users: PortalUser[];
  livePresence: Record<string, UserLivePresence>;
  activityFeed: LiveActivityLogEntry[];
  onRefreshPresence: () => void;
  onSendAdminPing: (
    targetUserId: string,
    targetUserName: string,
    message: string,
    kind: 'saludo' | 'recordatorio' | 'urgente' | 'felicitacion'
  ) => Promise<boolean>;
}

interface CharacterPalette {
  skin: string;
  hair: string;
  shirt: string;
  tie: string;
  pants: string;
  glasses?: boolean;
  hairStyle: 'short' | 'parted' | 'curly' | 'long' | 'bald';
  archetypeLabel: string;
}

const CHARACTER_PALETTES: CharacterPalette[] = [
  {
    // Dwight style (Mustard shirt + brown tie + glasses)
    skin: '#F5CBA7',
    hair: '#5D4037',
    shirt: '#EAB308',
    tie: '#78350F',
    pants: '#451A03',
    glasses: true,
    hairStyle: 'parted',
    archetypeLabel: 'Asistente del Gerente Regional',
  },
  {
    // Jim style (White shirt + navy tie + tousled hair)
    skin: '#FAD7A0',
    hair: '#3E2723',
    shirt: '#F8FAFC',
    tie: '#1E3A8A',
    pants: '#1E293B',
    glasses: false,
    hairStyle: 'short',
    archetypeLabel: 'Especialista de Operaciones',
  },
  {
    // Pam style (Teal cardigan + warm hair)
    skin: '#FDEBD0',
    hair: '#A04000',
    shirt: '#0D9488',
    tie: '#F8FAFC',
    pants: '#334155',
    glasses: false,
    hairStyle: 'long',
    archetypeLabel: 'Coordinación y Recepción',
  },
  {
    // Stanley / Darryl style (Blue dress shirt + vest)
    skin: '#8D5524',
    hair: '#1C1917',
    shirt: '#38BDF8',
    tie: '#0369A1',
    pants: '#0F172A',
    glasses: false,
    hairStyle: 'bald',
    archetypeLabel: 'Veterano de Nómina',
  },
  {
    // Oscar style (Charcoal suit + burgundy tie)
    skin: '#E5AA70',
    hair: '#171717',
    shirt: '#E2E8F0',
    tie: '#991B1B',
    pants: '#1E293B',
    glasses: false,
    hairStyle: 'short',
    archetypeLabel: 'Auditor Maestro Contable',
  },
  {
    // Angela / Erin style (Lavender blouse + dark skirt/pants)
    skin: '#F9E79F',
    hair: '#F4D03F',
    shirt: '#A855F7',
    tie: '#F3E8FF',
    pants: '#312E81',
    glasses: true,
    hairStyle: 'long',
    archetypeLabel: 'Comité de Planeación',
  },
  {
    // Ryan / Andy style (Preppy green sweater + tie)
    skin: '#F5CBA7',
    hair: '#6E2C00',
    shirt: '#10B981',
    tie: '#F59E0B',
    pants: '#374151',
    glasses: true,
    hairStyle: 'curly',
    archetypeLabel: 'Supervisor de Planta',
  },
];

function getPaletteForUser(userId: string, role: string): CharacterPalette {
  if (role === 'admin' || userId === 'user_admin') {
    // Michael Scott Regional Manager style
    return {
      skin: '#FAD7A0',
      hair: '#1C1917',
      shirt: '#1E293B',
      tie: '#EF4444',
      pants: '#0F172A',
      glasses: false,
      hairStyle: 'parted',
      archetypeLabel: 'Regional Manager (World’s Best Boss)',
    };
  }
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return CHARACTER_PALETTES[hash % CHARACTER_PALETTES.length];
}

const TAB_LABELS: Record<string, string> = {
  inicio: 'Lobby / Bienvenida',
  nomina: 'Dispersión de Nómina',
  trabajar_listas: 'Trabajando Listas',
  empleados: 'Padrón Multi-Empresa',
  semaforo: 'Semáforo RH',
  incidencias: 'Bandeja Incidencias',
  contpaqi: 'Exportador CONTPAQi',
  usuarios: 'Configuración / Usuarios',
  oficina_live: 'Cámara de Monitoreo (The Office)',
  offline: 'Fuera de la Oficina',
};

/**
 * Sprite Pixel Art 16x20 renderizado en SVG nítido (crispEdges)
 */
const PixelAvatarSprite: React.FC<{
  palette: CharacterPalette;
  status: LivePresenceStatus;
  scale?: number;
  isTyping?: boolean;
  holdingCoffee?: boolean;
}> = ({ palette, status, scale = 3.2, isTyping = false, holdingCoffee = false }) => {
  const w = 16 * scale;
  const h = 20 * scale;

  return (
    <div
      className="relative inline-flex items-center justify-center select-none"
      style={{ width: w, height: h }}
    >
      <motion.svg
        viewBox="0 0 16 20"
        width={w}
        height={h}
        style={{ shapeRendering: 'crispEdges' }}
        animate={
          status === 'working'
            ? { y: [0, -1.5, 0] }
            : status === 'idle'
            ? { y: [0, -1, 0] }
            : { y: 0 }
        }
        transition={{
          duration: status === 'working' ? 0.55 : 1.6,
          repeat: Infinity,
          ease: 'linear',
        }}
      >
        {/* Sombra en el piso */}
        <rect x="3" y="18" width="10" height="2" fill="rgba(0,0,0,0.35)" />

        {/* Cabello base superior */}
        {palette.hairStyle !== 'bald' && (
          <>
            <rect x="4" y="1" width="8" height="2" fill={palette.hair} />
            <rect x="3" y="2" width="10" height="2" fill={palette.hair} />
          </>
        )}
        {palette.hairStyle === 'long' && (
          <>
            <rect x="3" y="4" width="1" height="5" fill={palette.hair} />
            <rect x="12" y="4" width="1" height="5" fill={palette.hair} />
          </>
        )}
        {palette.hairStyle === 'parted' && (
          <rect x="4" y="3" width="3" height="1" fill={palette.hair} />
        )}

        {/* Cabeza / Rostro */}
        <rect
          x="4"
          y={palette.hairStyle === 'bald' ? '2' : '3'}
          width="8"
          height={palette.hairStyle === 'bald' ? '6' : '5'}
          fill={palette.skin}
        />

        {/* Ojos */}
        <rect x="5" y="5" width="1" height="1" fill="#111827" />
        <rect x="10" y="5" width="1" height="1" fill="#111827" />

        {/* Lentes estilo Dwight */}
        {palette.glasses && (
          <>
            <rect x="4" y="4" width="3" height="3" fill="none" stroke="#1E293B" strokeWidth="0.6" />
            <rect x="9" y="4" width="3" height="3" fill="none" stroke="#1E293B" strokeWidth="0.6" />
            <rect x="7" y="5" width="2" height="1" fill="#1E293B" />
          </>
        )}

        {/* Boca / Expresión */}
        <rect
          x="7"
          y="7"
          width="2"
          height="1"
          fill={status === 'working' ? '#991B1B' : '#78350F'}
        />

        {/* Torso / Camisa */}
        <rect x="3" y="8" width="10" height="6" fill={palette.shirt} />

        {/* Corbata / Gafete */}
        <rect x="7" y="8" width="2" height="5" fill={palette.tie} />
        <rect x="9" y="9" width="2" height="1" fill="#F8FAFC" />

        {/* Brazos (animados al teclear) */}
        <rect
          x="2"
          y={isTyping ? '9' : '8'}
          width="1"
          height="4"
          fill={palette.shirt}
        />
        <rect
          x="2"
          y={isTyping ? '12' : '12'}
          width="1"
          height="2"
          fill={palette.skin}
        />
        <rect
          x="13"
          y={isTyping ? '8' : '8'}
          width="1"
          height="4"
          fill={palette.shirt}
        />
        <rect
          x="13"
          y="12"
          width="1"
          height="2"
          fill={palette.skin}
        />

        {/* Taza de café cuando está en la cafetería (idle) */}
        {holdingCoffee && (
          <>
            <rect x="13" y="10" width="3" height="3" fill="#F8FAFC" />
            <rect x="14" y="11" width="1" height="1" fill="#78350F" />
            <rect x="14" y="8" width="1" height="1" fill="#CBD5E1" opacity="0.8" />
          </>
        )}

        {/* Pantalones y Zapatos */}
        <rect x="4" y="14" width="3" height="3" fill={palette.pants} />
        <rect x="9" y="14" width="3" height="3" fill={palette.pants} />
        <rect x="4" y="17" width="3" height="1" fill="#090D16" />
        <rect x="9" y="17" width="3" height="1" fill="#090D16" />
      </motion.svg>
    </div>
  );
};

/**
 * Escritorio Pixel Art (Cubículo estilo Dunder Mifflin con PC, lámpara y planta)
 */
const PixelWorkstationDesk: React.FC<{
  user: PortalUser;
  presence: UserLivePresence;
  isSelected: boolean;
  onSelect: () => void;
  pingActive: boolean;
}> = ({ user, presence, isSelected, onSelect, pingActive }) => {
  const palette = useMemo(
    () => getPaletteForUser(user.id, user.role),
    [user.id, user.role]
  );
  const isWorking = presence.status === 'working';
  const isIdle = presence.status === 'idle';
  const isOffline = presence.status === 'offline';

  return (
    <motion.div
      layout
      onClick={onSelect}
      whileHover={{ y: -3, scale: 1.01 }}
      className={`relative group cursor-pointer rounded-xl p-3 transition-all select-none border-2 ${
        isSelected
          ? 'bg-slate-900/95 border-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.3)]'
          : isWorking
          ? 'bg-slate-900/85 border-emerald-500/60 hover:border-emerald-400 shadow-[0_8px_20px_rgba(16,185,129,0.12)]'
          : isIdle
          ? 'bg-slate-900/75 border-amber-500/40 hover:border-amber-400'
          : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700 opacity-80'
      }`}
    >
      {/* Globo de diálogo estilo cómic retro cuando está trabajando o cuando recibe un Ping */}
      <AnimatePresence>
        {(isWorking || pingActive) && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.9 }}
            className={`absolute -top-9 left-2 right-2 z-20 px-2.5 py-1 rounded-lg border-2 text-[10px] font-mono font-bold truncate shadow-lg ${
              pingActive
                ? 'bg-amber-400 text-slate-950 border-white animate-bounce'
                : 'bg-slate-950 text-emerald-300 border-emerald-500/80'
            }`}
          >
            <span className="mr-1">{pingActive ? '📢 ¡PING!' : '💬'}</span>
            {pingActive ? '¡Mensaje de Dirección en pantalla!' : presence.currentAction}
            {/* Puntero pixelado del globo */}
            <div
              className={`w-2 h-2 rotate-45 absolute -bottom-1.5 left-6 border-r-2 border-b-2 ${
                pingActive
                  ? 'bg-amber-400 border-white'
                  : 'bg-slate-950 border-emerald-500/80'
              }`}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cabecera del cubículo: Luz LED + Nombre + Rol/Lista */}
      <div className="flex items-center justify-between gap-1.5 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`w-2.5 h-2.5 rounded-none shrink-0 border border-black/40 ${
              isWorking
                ? 'bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse'
                : isIdle
                ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24]'
                : 'bg-slate-600'
            }`}
          />
          <span className="text-xs font-extrabold text-white truncate font-mono tracking-tight">
            {user.name}
          </span>
        </div>
        <span
          className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 ${
            isWorking
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              : isIdle
              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}
        >
          {isWorking ? 'ACTIVO' : isIdle ? 'CAFÉ / AFK' : 'OFFLINE'}
        </span>
      </div>

      {/* Escena Pixel Art del Cubículo */}
      <div className="relative h-28 rounded-lg bg-[#1e2436] border-2 border-[#0f131f] overflow-hidden flex flex-col justify-end p-2">
        {/* Tapiz de pared con cuadrícula pixelada */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(to right, #475569 1px, transparent 1px), linear-gradient(to bottom, #475569 1px, transparent 1px)',
            backgroundSize: '8px 8px',
          }}
        />

        {/* Póster / Reloj en la pared del cubículo */}
        <div className="absolute top-2 left-2.5 px-1.5 py-0.5 bg-slate-900/90 border border-slate-700 text-[8px] font-mono text-slate-300">
          {presence.supervisorList
            ? `LISTA: ${presence.supervisorList.slice(0, 14)}`
            : user.role === 'admin'
            ? '★ REGIONAL MGR'
            : 'DEPTO. RH'}
        </div>

        {/* Planta decorativa pixel art en la esquina derecha */}
        <svg
          viewBox="0 0 8 10"
          className="w-5 h-6 absolute bottom-6 right-2.5"
          style={{ shapeRendering: 'crispEdges' }}
        >
          <rect x="2" y="6" width="4" height="4" fill="#B45309" />
          <rect x="1" y="5" width="6" height="1" fill="#92400E" />
          <rect x="3" y="2" width="2" height="3" fill="#15803D" />
          <rect x="1" y="3" width="2" height="2" fill="#22C55E" />
          <rect x="5" y="3" width="2" height="2" fill="#22C55E" />
          <rect x="2" y="1" width="4" height="1" fill="#4ADE80" />
        </svg>

        {/* Avatar sentado o silla vacía si está en la cafetería / desconectado */}
        <div className="relative z-10 flex items-end justify-center mb-3">
          {isWorking ? (
            <div className="relative">
              <PixelAvatarSprite
                palette={palette}
                status="working"
                scale={2.9}
                isTyping={true}
              />
              {/* Partículas de tecleo rápido */}
              <motion.span
                animate={{ opacity: [0, 1, 0], y: [-2, -10] }}
                transition={{ duration: 1.1, repeat: Infinity }}
                className="absolute -right-4 top-0 text-[10px] font-mono font-bold text-emerald-300"
              >
                ⚡
              </motion.span>
            </div>
          ) : isIdle ? (
            <div className="flex flex-col items-center justify-center py-2 text-amber-300/90">
              <Coffee className="w-5 h-5 animate-bounce mb-0.5" />
              <span className="text-[9px] font-mono font-bold">En Cafetería</span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-2 text-slate-500">
              <PowerOff className="w-4 h-4 mb-0.5 opacity-60" />
              <span className="text-[9px] font-mono">Silla vacía</span>
            </div>
          )}
        </div>

        {/* Escritorio de madera estilo Dunder Mifflin + Monitor PC + Taza */}
        <div className="relative z-20 h-6 bg-[#78350F] border-t-2 border-[#B45309] rounded-xs flex items-center justify-between px-3 shadow-inner">
          {/* Monitor de Computadora */}
          <div className="relative -top-4 flex flex-col items-center">
            <div
              className={`w-10 h-6 border-2 border-slate-700 rounded-xs flex items-center justify-center overflow-hidden ${
                isWorking
                  ? 'bg-emerald-950 shadow-[0_0_12px_rgba(16,185,129,0.75)]'
                  : 'bg-slate-950'
              }`}
            >
              {isWorking ? (
                <div className="w-full px-1 space-y-0.5">
                  <motion.div
                    animate={{ width: ['35%', '90%', '60%'] }}
                    transition={{ duration: 0.9, repeat: Infinity }}
                    className="h-0.5 bg-emerald-400"
                  />
                  <motion.div
                    animate={{ width: ['80%', '40%', '95%'] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                    className="h-0.5 bg-cyan-400"
                  />
                  <div className="h-0.5 w-2/3 bg-amber-300" />
                </div>
              ) : (
                <span className="w-1 h-1 bg-rose-500/70 rounded-full" />
              )}
            </div>
            <div className="w-3 h-1 bg-slate-600" />
          </div>

          {/* Taza World's Best Boss o Papelería */}
          <div className="relative -top-2 flex items-center gap-1.5">
            <div className="w-2.5 h-3 bg-white border border-slate-400 rounded-xs" />
            <div className="w-4 h-2 bg-amber-200/90 border border-amber-600" />
          </div>
        </div>
      </div>

      {/* Pie del cubículo: Módulo activo y tiempo */}
      <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-slate-400">
        <span className="truncate text-slate-300 font-semibold">
          📍 {TAB_LABELS[presence.activeTab] || presence.activeTab}
        </span>
        {presence.lastHeartbeatAt ? (
          <span className="text-[9px] text-slate-400 shrink-0">
            {new Date(presence.lastHeartbeatAt).toLocaleTimeString('es-MX', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
        ) : (
          <span className="text-[9px] text-slate-500 shrink-0">Sin conexión</span>
        )}
      </div>
    </motion.div>
  );
};

export const PixelOfficeMonitorView: React.FC<PixelOfficeMonitorViewProps> = ({
  currentUser,
  users,
  livePresence,
  activityFeed,
  onRefreshPresence,
  onSendAdminPing,
}) => {
  const [selectedUserId, setSelectedUserId] = useState<string>(
    () => users.find(u => u.role === 'supervisor')?.id || users[0]?.id || 'user_admin'
  );
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [customPingText, setCustomPingText] = useState<string>('');
  const [sendingPing, setSendingPing] = useState<boolean>(false);
  const [pingHighlightUserId, setPingHighlightUserId] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<'all' | 'working' | 'idle' | 'offline'>('all');

  // Defensa estricta: solo el Administrador General puede ver este módulo
  if (currentUser.role !== 'admin' && currentUser.id !== 'user_admin') {
    return (
      <div className="rounded-2xl bg-slate-900/90 border border-rose-500/40 p-10 text-center max-w-xl mx-auto my-12">
        <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-white">Acceso Restringido a Dirección</h2>
        <p className="text-sm text-slate-400 mt-1">
          El módulo de monitoreo en vivo estilo The Office está reservado exclusivamente para el Administrador General.
        </p>
      </div>
    );
  }

  // Si el Administrador activa el "Modo Simulacro Hora Pico", animar todos los escritorios con acciones realistas
  const effectivePresenceMap = useMemo<Record<string, UserLivePresence>>(() => {
    const base: Record<string, UserLivePresence> = {};
    const demoActions = [
      'Revisando checadas de su lista en Sem. 46',
      'Autorizando +2.5h de Tiempo Extra',
      'Subiendo formato firmado de Vacaciones',
      'Validando entrada de colaborador #00064',
      'Confirmando falta en día martes',
      'Preparando liberación de nómina semanal',
      'Auditando asistencias perfectas del equipo',
    ];

    users.forEach((u, idx) => {
      const real = livePresence[u.id];
      if (!isDemoMode) {
        base[u.id] = real || {
          userId: u.id,
          userName: u.name,
          userRole: u.role,
          email: u.email,
          employeeId: u.employeeId,
          supervisorList: u.supervisorName || u.assignedLists?.[0],
          status: u.id === currentUser.id ? 'working' : 'offline',
          activeTab: u.id === currentUser.id ? 'oficina_live' : 'offline',
          currentAction:
            u.id === currentUser.id
              ? 'Monitoreando cámaras de The Office en vivo'
              : 'Desconectado del portal',
          lastActionAt: '',
          lastHeartbeatAt: '',
          recentActions: [],
        };
      } else {
        // En modo simulacro, la mayoría trabaja en sus cubículos y 2 están en la cafetería tomando café
        const simStatus: LivePresenceStatus =
          u.id === currentUser.id
            ? 'working'
            : idx % 5 === 3
            ? 'idle'
            : idx % 7 === 6
            ? 'offline'
            : 'working';
        const simTab =
          u.id === currentUser.id
            ? 'oficina_live'
            : u.role === 'rh'
            ? 'semaforo'
            : simStatus === 'working'
            ? 'trabajar_listas'
            : 'inicio';
        const nowISO = new Date().toISOString();
        base[u.id] = {
          userId: u.id,
          userName: u.name,
          userRole: u.role,
          email: u.email,
          employeeId: u.employeeId,
          supervisorList: u.supervisorName || u.assignedLists?.[0],
          status: simStatus,
          activeTab: simTab,
          currentAction:
            u.id === currentUser.id
              ? 'Supervisando oficina desde Dirección'
              : simStatus === 'idle'
              ? 'Tomando café en el Watercooler (AFK)'
              : simStatus === 'offline'
              ? 'Fuera de turno'
              : demoActions[idx % demoActions.length],
          lastActionAt: nowISO,
          lastHeartbeatAt: nowISO,
          connectedSince: nowISO,
          recentActions: real?.recentActions || [],
        };
      }
    });
    return base;
  }, [users, livePresence, isDemoMode, currentUser.id]);

  // Estadísticas globales en vivo
  const counts = useMemo(() => {
    let working = 0;
    let idle = 0;
    let offline = 0;
    users.forEach(u => {
      const st = effectivePresenceMap[u.id]?.status || 'offline';
      if (st === 'working') working++;
      else if (st === 'idle') idle++;
      else offline++;
    });
    return { working, idle, offline, total: users.length };
  }, [users, effectivePresenceMap]);

  // Separar usuarios por zona arquitectónica de la oficina
  const adminUsers = useMemo(
    () => users.filter(u => u.role === 'admin'),
    [users]
  );
  const rhUsers = useMemo(
    () => users.filter(u => u.role === 'rh'),
    [users]
  );
  const supervisorUsers = useMemo(() => {
    const list = users.filter(u => u.role === 'supervisor');
    if (roleFilter === 'all') return list;
    return list.filter(u => (effectivePresenceMap[u.id]?.status || 'offline') === roleFilter);
  }, [users, roleFilter, effectivePresenceMap]);

  const idleUsersInBreakroom = useMemo(
    () => users.filter(u => effectivePresenceMap[u.id]?.status === 'idle'),
    [users, effectivePresenceMap]
  );

  const selectedUser = useMemo(
    () => users.find(u => u.id === selectedUserId) || users[0],
    [users, selectedUserId]
  );
  const selectedPresence = selectedUser
    ? effectivePresenceMap[selectedUser.id]
    : undefined;
  const selectedPalette = useMemo(
    () =>
      selectedUser
        ? getPaletteForUser(selectedUser.id, selectedUser.role)
        : CHARACTER_PALETTES[0],
    [selectedUser]
  );

  const triggerPing = async (
    message: string,
    kind: 'saludo' | 'recordatorio' | 'urgente' | 'felicitacion'
  ) => {
    if (!selectedUser || sendingPing) return;
    setSendingPing(true);
    setPingHighlightUserId(selectedUser.id);
    try {
      await onSendAdminPing(selectedUser.id, selectedUser.name, message, kind);
      setCustomPingText('');
    } finally {
      setSendingPing(false);
      setTimeout(() => setPingHighlightUserId(null), 4000);
    }
  };

  return (
    <div className="space-y-5">
      {/* BARRA SUPERIOR ESTILO CÁMARA DE SEGURIDAD RETRO "DUNDER MIFFLIN / CEMENQTIME HQ" */}
      <div className="rounded-2xl bg-[#0d111d] border-2 border-slate-800 p-4 sm:p-5 shadow-2xl relative overflow-hidden">
        {/* Efecto Scanlines CRT sutil */}
        <div
          className="absolute inset-0 pointer-events-none opacity-15"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 3px)',
          }}
        />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-500/15 border-2 border-amber-400/60 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(251,191,36,0.2)]">
              <Radio className="w-6 h-6 text-amber-400 animate-pulse" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-mono text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  REC • CAM 01
                </span>
                <h1 className="text-lg sm:text-xl font-black text-white tracking-tight font-mono">
                  THE OFFICE — MONITOR PIXEL ART EN VIVO
                </h1>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300 font-mono text-[10px] font-bold">
                  SOLO ADMINISTRADOR
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Observa en tiempo real quién está dentro del sistema trabajando listas, quién está en la cafetería (inactivo) y envía toques directos a su pantalla.
              </p>
            </div>
          </div>

          {/* Contadores rápidos y botón de Simulacro */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setRoleFilter('all')}
              className={`px-3 py-1.5 rounded-lg border font-mono text-xs font-bold transition-all cursor-pointer ${
                roleFilter === 'all'
                  ? 'bg-slate-800 text-white border-slate-500'
                  : 'bg-slate-900/70 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              Todos ({counts.total})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter(roleFilter === 'working' ? 'all' : 'working')}
              className={`px-3 py-1.5 rounded-lg border font-mono text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                roleFilter === 'working'
                  ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400'
                  : 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30 hover:bg-emerald-900/40'
              }`}
            >
              <span className="w-2 h-2 bg-emerald-400 animate-pulse" />
              Trabajando ({counts.working})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter(roleFilter === 'idle' ? 'all' : 'idle')}
              className={`px-3 py-1.5 rounded-lg border font-mono text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                roleFilter === 'idle'
                  ? 'bg-amber-500/25 text-amber-200 border-amber-400'
                  : 'bg-amber-950/40 text-amber-300 border-amber-500/30 hover:bg-amber-900/40'
              }`}
            >
              <Coffee className="w-3.5 h-3.5" />
              Cafetería / AFK ({counts.idle})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter(roleFilter === 'offline' ? 'all' : 'offline')}
              className={`px-3 py-1.5 rounded-lg border font-mono text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                roleFilter === 'offline'
                  ? 'bg-slate-700 text-white border-slate-400'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <PowerOff className="w-3.5 h-3.5" />
              Offline ({counts.offline})
            </button>

            <button
              type="button"
              onClick={() => setIsDemoMode(prev => !prev)}
              className={`px-3 py-1.5 rounded-lg border-2 font-mono text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isDemoMode
                  ? 'bg-amber-400 text-slate-950 border-white shadow-[0_0_15px_rgba(251,191,36,0.5)]'
                  : 'bg-indigo-950/70 text-indigo-300 border-indigo-500/40 hover:border-indigo-400'
              }`}
              title="Simular a todos tus usuarios trabajando en hora pico para probar las animaciones Pixel Art"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isDemoMode ? 'Modo Simulacro: ACTIVO' : 'Probar Hora Pico'}
            </button>

            <button
              type="button"
              onClick={onRefreshPresence}
              className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition-colors cursor-pointer"
              title="Actualizar lectura de presencia ahora"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* CUERPO PRINCIPAL: PLANO ARQUITECTÓNICO PIXEL ART (IZQUIERDA) + INSPECTOR Y PING EN VIVO (DERECHA) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* COLUMNA IZQUIERDA (8/12): PLANO INTERACTIVO DE LA OFICINA ESTILO DUNDER MIFFLIN */}
        <div className="xl:col-span-8 space-y-5">
          {/* FILA SUPERIOR DEL PLANO: OFICINA DEL REGIONAL MANAGER (ADMIN) + ANEXO RH + CAFETERÍA WATERCOOLER */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* 1. OFICINA REGIONAL MANAGER (ADMIN) */}
            <div className="md:col-span-4 rounded-2xl bg-[#18131e] border-2 border-amber-500/50 p-3.5 relative overflow-hidden shadow-lg">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-mono font-extrabold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  🏆 OFICINA REGIONAL MGR
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30">
                  DIRECCIÓN
                </span>
              </div>
              <div className="space-y-2.5">
                {adminUsers.map(u => (
                  <PixelWorkstationDesk
                    key={u.id}
                    user={u}
                    presence={effectivePresenceMap[u.id]}
                    isSelected={selectedUser?.id === u.id}
                    onSelect={() => setSelectedUserId(u.id)}
                    pingActive={pingHighlightUserId === u.id}
                  />
                ))}
              </div>
            </div>

            {/* 2. DEPARTAMENTO DE RH Y DISPERSIÓN DE NÓMINA */}
            <div className="md:col-span-4 rounded-2xl bg-[#0f1f26] border-2 border-teal-500/50 p-3.5 relative overflow-hidden shadow-lg">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-mono font-extrabold text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                  📊 ANEXO RH & CONTPAQi
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-200 border border-teal-500/30">
                  NÓMINAS
                </span>
              </div>
              {rhUsers.length > 0 ? (
                <div className="space-y-2.5">
                  {rhUsers.map(u => (
                    <PixelWorkstationDesk
                      key={u.id}
                      user={u}
                      presence={effectivePresenceMap[u.id]}
                      isSelected={selectedUser?.id === u.id}
                      onSelect={() => setSelectedUserId(u.id)}
                      pingActive={pingHighlightUserId === u.id}
                    />
                  ))}
                </div>
              ) : (
                <div className="h-36 rounded-xl bg-slate-950/60 border border-teal-500/20 flex flex-col items-center justify-center p-4 text-center">
                  <Laptop className="w-6 h-6 text-teal-400/60 mb-1.5" />
                  <p className="text-[11px] font-mono text-slate-300 font-bold">
                    Operado por Dirección General
                  </p>
                  <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                    Impresora CONTPAQi lista en línea
                  </p>
                </div>
              )}
            </div>

            {/* 3. CAFETERÍA & WATERCOOLER (SALA DE DESCANSO AFK) */}
            <div className="md:col-span-4 rounded-2xl bg-[#1f1916] border-2 border-amber-600/50 p-3.5 relative overflow-hidden shadow-lg">
              {/* Piso ajedrezado de cocina retro */}
              <div
                className="absolute inset-0 opacity-10 pointer-events-none"
                style={{
                  backgroundImage:
                    'conic-gradient(#fff 90deg, #000 90deg 180deg, #fff 180deg 270deg, #000 270deg)',
                  backgroundSize: '16px 16px',
                }}
              />
              <div className="relative z-10 flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-mono font-extrabold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  ☕ CAFETERÍA & WATERCOOLER
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30">
                  {idleUsersInBreakroom.length} AFK
                </span>
              </div>

              <div className="relative z-10 min-h-[148px] rounded-xl bg-slate-950/75 border-2 border-amber-900/50 p-3 flex flex-col justify-between">
                {/* Muebles Pixel Art de la Cafetería: Garrafón Watercooler + Cafetera Expreso */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    {/* Watercooler SVG */}
                    <svg
                      viewBox="0 0 8 14"
                      className="w-5 h-8"
                      style={{ shapeRendering: 'crispEdges' }}
                    >
                      <rect x="2" y="1" width="4" height="5" fill="#38BDF8" />
                      <rect x="3" y="0" width="2" height="1" fill="#0284C7" />
                      <rect x="1" y="6" width="6" height="8" fill="#F8FAFC" />
                      <rect x="2" y="8" width="1" height="2" fill="#EF4444" />
                      <rect x="5" y="8" width="1" height="2" fill="#3B82F6" />
                    </svg>
                    <div className="text-[10px] font-mono">
                      <div className="text-amber-200 font-bold">Máquina de Café</div>
                      <div className="text-slate-400 text-[9px]">Usuarios sin mover mouse &gt;90s</div>
                    </div>
                  </div>
                  <Coffee className="w-4 h-4 text-amber-400 animate-pulse" />
                </div>

                {/* Avatares tomando café */}
                {idleUsersInBreakroom.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    {idleUsersInBreakroom.map(u => {
                      const pal = getPaletteForUser(u.id, u.role);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => setSelectedUserId(u.id)}
                          className={`group flex items-center gap-2 px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                            selectedUser?.id === u.id
                              ? 'bg-amber-500/20 border-amber-400'
                              : 'bg-slate-900/90 border-slate-800 hover:border-amber-500/50'
                          }`}
                        >
                          <PixelAvatarSprite
                            palette={pal}
                            status="idle"
                            scale={2}
                            holdingCoffee={true}
                          />
                          <div className="text-left">
                            <div className="text-[10px] font-mono font-bold text-white">
                              {u.name.split(' ')[0]}
                            </div>
                            <div className="text-[9px] font-mono text-amber-300">☕ En pausa</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-5 text-center text-[11px] font-mono text-slate-400">
                    Nadie en la cafetería — ¡Todos enfocados o fuera de turno!
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ÁREA PRINCIPAL: BULLPEN DE SUPERVISORES (CUBÍCULOS DE NÓMINA) */}
          <div className="rounded-2xl bg-[#111625] border-2 border-slate-800 p-4 sm:p-5 shadow-2xl relative overflow-hidden">
            {/* Alfombra de oficina con textura pixelada */}
            <div
              className="absolute inset-0 opacity-15 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(#64748b 1px, transparent 1px)',
                backgroundSize: '12px 12px',
              }}
            />

            <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-mono font-black text-white uppercase tracking-wider">
                  🖥️ BULLPEN DE SUPERVISORES — ESTACIONES DE TRABAJO ({supervisorUsers.length})
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Haz clic en cualquier escritorio o avatar para inspeccionar su actividad o mandarle un alerta en pantalla
              </span>
            </div>

            {supervisorUsers.length > 0 ? (
              <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {supervisorUsers.map(u => (
                  <PixelWorkstationDesk
                    key={u.id}
                    user={u}
                    presence={effectivePresenceMap[u.id]}
                    isSelected={selectedUser?.id === u.id}
                    onSelect={() => setSelectedUserId(u.id)}
                    pingActive={pingHighlightUserId === u.id}
                  />
                ))}
              </div>
            ) : (
              <div className="relative z-10 py-12 text-center font-mono text-slate-400 text-sm">
                No hay supervisores que coincidan con el filtro seleccionado.
              </div>
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA (4/12): EXPEDIENTE EN VIVO DEL PERSONAJE + PING DIRECTO + BITÁCORA EN VIVO */}
        <div className="xl:col-span-4 space-y-5">
          {/* TARJETA DE INSPECCIÓN DEL PERSONAJE SELECCIONADO */}
          {selectedUser && selectedPresence && (
            <div className="rounded-2xl bg-[#0f1422] border-2 border-amber-400/60 p-4 sm:p-5 shadow-2xl relative overflow-hidden">
              <div className="flex items-start gap-4">
                {/* Retrato Pixel Art Ampliado */}
                <div className="w-24 h-28 rounded-xl bg-[#1c2438] border-2 border-slate-700 flex flex-col items-center justify-center shrink-0 relative overflow-hidden shadow-inner">
                  <PixelAvatarSprite
                    palette={selectedPalette}
                    status={selectedPresence.status}
                    scale={3.6}
                    isTyping={selectedPresence.status === 'working'}
                    holdingCoffee={selectedPresence.status === 'idle'}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded font-mono text-[10px] font-black uppercase ${
                        selectedPresence.status === 'working'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : selectedPresence.status === 'idle'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {selectedPresence.status === 'working'
                        ? '🟢 TRABAJANDO EN VIVO'
                        : selectedPresence.status === 'idle'
                        ? '🟡 EN CAFETERÍA (AFK)'
                        : '⚫ DESCONECTADO'}
                    </span>
                  </div>

                  <h2 className="text-base sm:text-lg font-black text-white font-mono truncate mt-1.5">
                    {selectedUser.name}
                  </h2>
                  <p className="text-[11px] font-mono text-amber-300/90 font-semibold">
                    {selectedPalette.archetypeLabel}
                  </p>

                  <div className="mt-2 space-y-1 text-[11px] font-mono text-slate-300">
                    <div>
                      <span className="text-slate-500">Lista asignada:</span>{' '}
                      <span className="font-bold text-white">
                        {selectedPresence.supervisorList || 'GLOBAL / TODAS'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Ubicación actual:</span>{' '}
                      <span className="font-bold text-cyan-300">
                        {TAB_LABELS[selectedPresence.activeTab] || selectedPresence.activeTab}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Estado / Acción actual en vivo */}
              <div className="mt-4 p-3 rounded-xl bg-slate-950/90 border border-slate-800">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Actividad detectada en este momento</span>
                  {selectedPresence.connectedSince && (
                    <span className="text-emerald-400">
                      Conectado{' '}
                      {new Date(selectedPresence.connectedSince).toLocaleTimeString('es-MX', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
                <div className="text-xs font-mono font-bold text-emerald-300 mt-1 flex items-center gap-2">
                  <Terminal className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{selectedPresence.currentAction}</span>
                </div>
              </div>

              {/* ENVIAR TOQUE / ALERTA DIRECTA A LA PANTALLA DEL USUARIO */}
              <div className="mt-4 pt-4 border-t border-slate-800/90">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-extrabold text-white flex items-center gap-1.5">
                    <BellRing className="w-4 h-4 text-amber-400" />
                    Mandar Toque en Vivo a su Pantalla
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Vía SSE Instantáneo</span>
                </div>

                {/* Botones rápidos de 1 clic */}
                <div className="grid grid-cols-1 gap-1.5 mb-2.5">
                  <button
                    type="button"
                    disabled={sendingPing}
                    onClick={() =>
                      triggerPing(
                        `👋 ¡Hola ${selectedUser.name.split(' ')[0]}! Dirección está revisando el avance de nómina en vivo, ¿cómo vas con tu lista?`,
                        'saludo'
                      )
                    }
                    className="text-left px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-400/60 text-[11px] font-mono text-slate-200 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <span>👋 "¿Cómo vas con la revisión de tu lista?"</span>
                    <Send className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  </button>

                  <button
                    type="button"
                    disabled={sendingPing}
                    onClick={() =>
                      triggerPing(
                        `⏰ Recordatorio de Dirección: Por favor concluye y libera tu lista de nómina antes del cierre.`,
                        'recordatorio'
                      )
                    }
                    className="text-left px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-400/60 text-[11px] font-mono text-slate-200 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <span>⏰ "Recuerda liberar tu nómina a tiempo"</span>
                    <Send className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  </button>

                  <button
                    type="button"
                    disabled={sendingPing}
                    onClick={() =>
                      triggerPing(
                        `⚡ Tienes checadas incompletas u horas extra pendientes por validar en tu lista activa.`,
                        'urgente'
                      )
                    }
                    className="text-left px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-rose-400/60 text-[11px] font-mono text-slate-200 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <span>⚡ "Valida tus checadas y horas extra pendientes"</span>
                    <Send className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  </button>
                </div>

                {/* Mensaje personalizado */}
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    if (!customPingText.trim()) return;
                    triggerPing(customPingText.trim(), 'saludo');
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={customPingText}
                    onChange={e => setCustomPingText(e.target.value)}
                    placeholder={`Escribe un mensaje para ${selectedUser.name.split(' ')[0]}...`}
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    disabled={sendingPing || !customPingText.trim()}
                    className="px-3.5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-mono text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Enviar
                  </button>
                </form>
              </div>

              {/* Historial reciente de ese usuario */}
              <div className="mt-4 pt-3 border-t border-slate-800/80">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2">
                  Últimos movimientos de {selectedUser.name.split(' ')[0]}
                </div>
                {selectedPresence.recentActions && selectedPresence.recentActions.length > 0 ? (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {selectedPresence.recentActions.slice(0, 6).map(act => (
                      <div
                        key={act.id}
                        className="text-[11px] font-mono bg-slate-950/70 border border-slate-800/90 rounded-lg px-2.5 py-1.5 flex items-start justify-between gap-2"
                      >
                        <span className="text-slate-200">{act.action}</span>
                        <span className="text-[9px] text-slate-500 shrink-0">
                          {new Date(act.timestamp).toLocaleTimeString('es-MX', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] font-mono text-slate-500">
                    Sin movimientos registrados en esta sesión todavía.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* BITÁCORA GLOBAL DE CÁMARAS EN VIVO (FEED DE TODA LA OFICINA) */}
          <div className="rounded-2xl bg-[#0d111d] border-2 border-slate-800 p-4 sm:p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
              <span className="text-xs font-mono font-black text-white uppercase flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                Feed de Actividad en Vivo (Oficina)
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {activityFeed.length} eventos
              </span>
            </div>

            {activityFeed.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {activityFeed.slice(0, 20).map(item => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedUserId(item.userId)}
                    className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="font-bold text-amber-300">{item.userName}</span>
                      <span className="text-slate-500">
                        {new Date(item.timestamp).toLocaleTimeString('es-MX', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-200 mt-0.5">
                      {item.action}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs font-mono text-slate-500">
                Los movimientos en vivo de los usuarios aparecerán aquí conforme naveguen o editen sus listas.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
