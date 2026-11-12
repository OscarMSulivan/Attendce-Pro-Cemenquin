/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  IncidentRequest,
  PayrollDispersal,
  PayrollRelease,
  PortalNotification,
  PortalUser,
  getUserAllowedLists,
} from '../types/portal';

const LOGO_ICON =
  '/assets/aistudio/623410255_1517285780403715_965041871524205859_n_cf013194.jpg';
const PUSH_ENABLED_STORAGE_KEY = 'cemenqtime_push_enabled_v1';
const BROADCAST_CHANNEL_NAME = 'cemenqtime_realtime_channel_v1';

export type PushPermissionState = NotificationPermission | 'unsupported';

export interface RealtimePortalPayload {
  type:
    | 'connected'
    | 'portal_sync'
    | 'notification_dispatched'
    | 'dispersal_cancelled'
    | 'expiring_reminder'
    | 'custom_push';
  timestamp: string;
  actorId?: string;
  actorName?: string;
  summary?: string;
  targetSupervisor?: string;
  targetRole?: 'supervisor' | 'rh' | 'admin' | 'all';
  targetTab?: string;
  state?: {
    users?: PortalUser[];
    incidents?: IncidentRequest[];
    releases?: Record<string, PayrollRelease>;
    dispersals?: PayrollDispersal[];
    notifications?: PortalNotification[];
    reportes?: any[];
    resumen?: any;
    selectedWeek?: string;
  };
  notification?: PortalNotification;
}

class PushNotificationManager {
  private swRegistration: ServiceWorkerRegistration | null = null;
  private eventSource: EventSource | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<(payload: RealtimePortalPayload) => void>();
  private navListeners = new Set<(data: { targetTab?: string; supervisor?: string; semana?: number }) => void>();
  private clientTabId = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  getClientTabId(): string {
    return this.clientTabId;
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  getPermissionState(): PushPermissionState {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission;
  }

  isUserPushEnabled(): boolean {
    if (!this.isSupported()) return false;
    const saved = localStorage.getItem(PUSH_ENABLED_STORAGE_KEY);
    if (saved === 'false') return false;
    return Notification.permission === 'granted';
  }

  setUserPushPreference(enabled: boolean): void {
    try {
      localStorage.setItem(PUSH_ENABLED_STORAGE_KEY, enabled ? 'true' : 'false');
    } catch {
      // ignore storage errors
    }
  }

  async initServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return null;
    }
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      this.swRegistration = reg;

      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
          const clickData = event.data.data || {};
          this.navListeners.forEach((cb) => cb(clickData));
        }
      });

      return reg;
    } catch (err) {
      console.warn('No se pudo registrar el Service Worker de notificaciones:', err);
      return null;
    }
  }

  async requestPermission(): Promise<PushPermissionState> {
    if (!this.isSupported()) return 'unsupported';
    try {
      await this.initServiceWorker();
      const result = await Notification.requestPermission();
      if (result === 'granted') {
        this.setUserPushPreference(true);
      }
      return result;
    } catch {
      return Notification.permission;
    }
  }

  playAlertSound(kind: 'info' | 'warning' | 'success' = 'info'): void {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      const now = ctx.currentTime;
      if (kind === 'warning') {
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.setValueAtTime(660, now + 0.12);
      } else if (kind === 'success') {
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.setValueAtTime(880, now + 0.11);
      } else {
        osc.frequency.setValueAtTime(659.25, now);
        osc.frequency.setValueAtTime(783.99, now + 0.1);
      }

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.29);
    } catch {
      // AudioContext may be blocked if user hasn't interacted yet
    }
  }

  async showNativeNotification(options: {
    title: string;
    body: string;
    tag?: string;
    requireInteraction?: boolean;
    targetTab?: string;
    supervisor?: string;
    semana?: number;
    soundKind?: 'info' | 'warning' | 'success';
  }): Promise<boolean> {
    this.playAlertSound(options.soundKind || 'info');

    if (!this.isSupported() || Notification.permission !== 'granted') {
      return false;
    }
    if (localStorage.getItem(PUSH_ENABLED_STORAGE_KEY) === 'false') {
      return false;
    }

    const notifData = {
      targetTab: options.targetTab || 'trabajar_listas',
      supervisor: options.supervisor,
      semana: options.semana,
    };

    try {
      if (!this.swRegistration && 'serviceWorker' in navigator) {
        this.swRegistration = (await navigator.serviceWorker.getRegistration()) || null;
      }

      if (this.swRegistration && typeof this.swRegistration.showNotification === 'function') {
        await this.swRegistration.showNotification(options.title, {
          body: options.body,
          icon: LOGO_ICON,
          badge: LOGO_ICON,
          tag: options.tag || `cemenqtime-${Date.now()}`,
          requireInteraction: Boolean(options.requireInteraction),
          data: notifData,
        });
        return true;
      }

      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_PUSH_NOTIFICATION',
          title: options.title,
          body: options.body,
          icon: LOGO_ICON,
          badge: LOGO_ICON,
          tag: options.tag || `cemenqtime-${Date.now()}`,
          requireInteraction: Boolean(options.requireInteraction),
          data: notifData,
        });
        return true;
      }

      const fallbackNotif = new Notification(options.title, {
        body: options.body,
        icon: LOGO_ICON,
        tag: options.tag || `cemenqtime-${Date.now()}`,
      });
      fallbackNotif.onclick = () => {
        window.focus();
        this.navListeners.forEach((cb) => cb(notifData));
        fallbackNotif.close();
      };
      return true;
    } catch (err) {
      console.warn('Error mostrando notificación Web Push:', err);
      return false;
    }
  }

  connectRealtimeStream(): void {
    if (typeof window === 'undefined' || window.location.protocol === 'file:') return;

    // 1. BroadcastChannel para sincronización instantánea entre pestañas del mismo navegador
    if ('BroadcastChannel' in window && !this.broadcastChannel) {
      try {
        this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.broadcastChannel.onmessage = (event) => {
          const data = event.data as RealtimePortalPayload & { senderTabId?: string };
          if (!data || data.senderTabId === this.clientTabId) return;
          this.listeners.forEach((cb) => cb(data));
        };
      } catch {
        // ignore BroadcastChannel errors
      }
    }

    // 2. Server-Sent Events (SSE) para recibir eventos push en tiempo real desde el servidor Express
    if (this.eventSource) return;

    const connectSSE = () => {
      try {
        const es = new EventSource(`/api/notifications/stream?clientId=${encodeURIComponent(this.clientTabId)}`);
        this.eventSource = es;

        es.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data) as RealtimePortalPayload & { senderTabId?: string };
            if (!payload || payload.type === 'connected') return;
            if (payload.senderTabId && payload.senderTabId === this.clientTabId) return;
            this.listeners.forEach((cb) => cb(payload));
          } catch {
            // ignore malformed JSON
          }
        };

        es.onerror = () => {
          es.close();
          this.eventSource = null;
          if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(connectSSE, 3500);
        };
      } catch {
        // ignore SSE error
      }
    };

    connectSSE();
  }

  broadcastLocalEvent(payload: RealtimePortalPayload): void {
    const enriched = { ...payload, senderTabId: this.clientTabId };
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(enriched);
      } catch {
        // ignore
      }
    }
  }

  subscribe(callback: (payload: RealtimePortalPayload) => void): () => void {
    this.listeners.add(callback);
    this.connectRealtimeStream();
    return () => {
      this.listeners.delete(callback);
    };
  }

  onNotificationNavigate(
    callback: (data: { targetTab?: string; supervisor?: string; semana?: number }) => void
  ): () => void {
    this.navListeners.add(callback);
    return () => {
      this.navListeners.delete(callback);
    };
  }

  isSupervisorTargetMatch(user: PortalUser, targetSupervisor?: string, targetUserId?: string): boolean {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'rh') return true;
    if (targetUserId && targetUserId === user.id) return true;
    if (!targetSupervisor) return false;
    const normTarget = targetSupervisor.trim().toUpperCase();
    if (normTarget === 'ALL') return true;
    const allowed = getUserAllowedLists(user).map((s) => s.trim().toUpperCase());
    return allowed.includes(normTarget);
  }
}

export const PushNotificationService = new PushNotificationManager();
