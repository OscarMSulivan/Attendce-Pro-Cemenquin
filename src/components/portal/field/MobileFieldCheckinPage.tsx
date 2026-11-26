/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
  RefreshCw,
  Send,
  ShieldCheck,
  Store,
} from 'lucide-react';
import type { FieldCheckinRecord, FieldCheckinSession } from '../../../types/fieldCheckin';

interface MobileFieldCheckinPageProps {
  token: string;
}

export const MobileFieldCheckinPage: React.FC<MobileFieldCheckinPageProps> = ({ token }) => {
  const [session, setSession] = useState<FieldCheckinSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [nowClock, setNowClock] = useState(() => new Date());
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fallbackFileRef = useRef<HTMLInputElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);

  const [puntoVenta, setPuntoVenta] = useState('');
  const [notas, setNotas] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedRecord, setSubmittedRecord] = useState<FieldCheckinRecord | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNowClock(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/field-checkin/token/${encodeURIComponent(token)}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          setLoadError(data.error || 'Enlace inválido o expirado.');
        } else if (data.session?.used) {
          setLoadError('Este enlace de checada ya fue utilizado.');
        } else {
          setSession(data.session);
          requestGps();
        }
      } catch {
        if (!cancelled) setLoadError('No se pudo conectar con el servidor de CemenQtime.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [token]);

  const requestGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus('error');
      setGpsError('Tu dispositivo no soporta geolocalización GPS.');
      return;
    }
    setGpsStatus('loading');
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setCoords({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy || 0),
        });
        setGpsStatus('ok');
      },
      err => {
        setGpsStatus('error');
        setGpsError(
          err.code === 1
            ? 'Permiso de ubicación denegado. Activa el GPS en tu navegador y toca Reintentar.'
            : 'No se pudo obtener tu ubicación exacta. Intenta nuevamente.',
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  };

  const startCamera = async () => {
    setCameraError(null);
    setPhotoBase64(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      fallbackFileRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      }, 60);
    } catch {
      setCameraError('No se pudo abrir la cámara en vivo. Puedes usar la captura directa.');
      fallbackFileRef.current?.click();
    }
  };

  const captureFromVideo = () => {
    const video = videoRef.current;
    if (!video) return;
    const maxW = 640;
    const ratio = video.videoWidth > 0 ? Math.min(1, maxW / video.videoWidth) : 1;
    const w = Math.max(320, Math.round((video.videoWidth || 640) * ratio));
    const h = Math.max(240, Math.round((video.videoHeight || 480) * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
      setPhotoBase64(dataUrl);
    }
    stopCamera();
  };

  const handleFallbackPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = 640;
        const ratio = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setPhotoBase64(canvas.toDataURL('image/jpeg', 0.72));
        }
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    if (!puntoVenta.trim()) {
      setSubmitError('Escribe el nombre del punto de venta o cliente visitado.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const localNow = new Date();
    const isoDate = `${localNow.getFullYear()}-${String(localNow.getMonth() + 1).padStart(
      2,
      '0',
    )}-${String(localNow.getDate()).padStart(2, '0')}`;
    const hora = `${String(localNow.getHours()).padStart(2, '0')}:${String(
      localNow.getMinutes(),
    ).padStart(2, '0')}`;

    try {
      const res = await fetch('/api/field-checkin/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: session.token,
          source: 'whatsapp_mobile',
          isoDate,
          hora,
          latitude: coords?.lat ?? null,
          longitude: coords?.lng ?? null,
          accuracyMeters: coords?.accuracy ?? null,
          puntoVenta: puntoVenta.trim(),
          notas: notas.trim() || undefined,
          photoBase64: photoBase64 || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setSubmitError(data.error || 'No se pudo registrar la checada.');
      } else {
        stopCamera();
        setSubmittedRecord(data.record);
      }
    } catch {
      setSubmitError('Error de red al enviar tu checada. Intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const formattedTime = nowClock.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-[#131726] border border-teal-500/25 shadow-2xl overflow-hidden">
        <div
          className="h-1.5 w-full"
          style={{ background: 'linear-gradient(90deg, #14b8a6 0%, #0ea5e9 55%, #6366f1 100%)' }}
        />

        {/* Brand header */}
        <div className="px-5 py-4 bg-[#181d30] border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/assets/aistudio/623410255_1517285780403715_965041871524205859_n_cf013194.jpg"
              alt="Cemenquin"
              className="w-9 h-9 rounded-xl object-cover border border-white/15"
            />
            <div>
              <h1 className="text-sm font-extrabold text-white leading-tight">
                CemenQtime · Campo
              </h1>
              <p className="text-[11px] text-teal-300 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Check-in Seguro GPS + Cámara
              </p>
            </div>
          </div>
          <div className="text-right font-mono">
            <div className="text-xs font-extrabold text-white flex items-center gap-1 justify-end">
              <Clock className="w-3.5 h-3.5 text-teal-300" />
              {formattedTime}
            </div>
            <div className="text-[10px] text-slate-400">
              {nowClock.toLocaleDateString('es-MX')}
            </div>
          </div>
        </div>

        <div className="p-5">
          {loading && (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-teal-400 animate-spin mx-auto" />
              <p className="text-xs text-slate-300 font-semibold">
                Validando enlace seguro de WhatsApp...
              </p>
            </div>
          )}

          {!loading && loadError && (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/35 text-rose-300 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h2 className="text-base font-extrabold text-white">Enlace no disponible</h2>
              <p className="text-xs text-slate-400 leading-relaxed">{loadError}</p>
            </div>
          )}

          {!loading && submittedRecord && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-6 text-center space-y-4"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 border-2 border-emerald-400 text-emerald-300 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">
                  ¡{submittedRecord.tipo === 'entrada' ? 'Entrada' : 'Salida'} Registrada!
                </h2>
                <p className="text-xs text-slate-300 mt-1">
                  {submittedRecord.employeeName} · <strong>{submittedRecord.hora}</strong>
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#181d30] border border-white/[0.08] text-left text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Punto de venta:</span>
                  <strong className="text-white">{submittedRecord.puntoVenta}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Ubicación GPS:</span>
                  <strong className="text-teal-300">
                    {submittedRecord.latitude !== null
                      ? `${submittedRecord.latitude}, ${submittedRecord.longitude}`
                      : 'Sin GPS'}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Evidencia foto:</span>
                  <strong className="text-emerald-300">
                    {submittedRecord.photoBase64 ? 'Adjunta ✓' : 'Omitida'}
                  </strong>
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                Tu registro ya se sincronizó en tiempo real con CemenQtime. Puedes cerrar esta pestaña y volver a WhatsApp.
              </p>
            </motion.div>
          )}

          {!loading && session && !submittedRecord && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Promoter banner */}
              <div className="p-3.5 rounded-2xl bg-[#181d30] border border-white/[0.08] flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-white truncate">
                    {session.employeeName}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    #{session.employeeId} · Sup: {session.supervisor}
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 border ${
                    session.tipo === 'entrada'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                  }`}
                >
                  {session.tipo === 'entrada' ? 'Entrada' : 'Salida'}
                </span>
              </div>

              {/* Step 1: GPS */}
              <div className="p-3.5 rounded-2xl bg-[#181d30] border border-white/[0.08] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-white flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-teal-400" />
                    1. Ubicación GPS en tiempo real
                  </span>
                  <button
                    type="button"
                    onClick={requestGps}
                    className="text-[11px] font-bold text-teal-300 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Actualizar
                  </button>
                </div>
                {gpsStatus === 'loading' && (
                  <p className="text-[11px] text-sky-300 flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Obteniendo coordenadas exactas...
                  </p>
                )}
                {gpsStatus === 'ok' && coords && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-emerald-300 font-mono font-bold">
                      {coords.lat}, {coords.lng} (±{coords.accuracy}m)
                    </span>
                    <a
                      href={`https://www.google.com/maps?q=${coords.lat},${coords.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-teal-300 font-bold inline-flex items-center gap-1 hover:underline"
                    >
                      Mapa <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
                {gpsStatus === 'error' && (
                  <p className="text-[11px] text-amber-300">{gpsError}</p>
                )}
              </div>

              {/* Step 2: Live Camera */}
              <div className="p-3.5 rounded-2xl bg-[#181d30] border border-white/[0.08] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-white flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-sky-400" />
                    2. Selfie / Evidencia en vivo
                  </span>
                  {photoBase64 && (
                    <button
                      type="button"
                      onClick={startCamera}
                      className="text-[11px] font-bold text-teal-300 hover:underline"
                    >
                      Tomar otra
                    </button>
                  )}
                </div>

                <input
                  ref={fallbackFileRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={handleFallbackPhoto}
                  className="hidden"
                />

                {cameraActive && (
                  <div className="space-y-2">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="w-full h-56 object-cover rounded-xl bg-black border border-teal-500/40"
                    />
                    <button
                      type="button"
                      onClick={captureFromVideo}
                      className="w-full py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2"
                    >
                      <Camera className="w-4 h-4" />
                      Capturar foto ahora
                    </button>
                  </div>
                )}

                {!cameraActive && photoBase64 && (
                  <img
                    src={photoBase64}
                    alt="Evidencia capturada"
                    className="w-full h-52 object-cover rounded-xl border border-emerald-500/40"
                  />
                )}

                {!cameraActive && !photoBase64 && (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="w-full py-6 rounded-xl border-2 border-dashed border-white/15 hover:border-teal-400/60 bg-white/[0.02] text-xs font-bold text-slate-200 flex flex-col items-center gap-2 transition-colors"
                  >
                    <Camera className="w-6 h-6 text-teal-300" />
                    <span>Tocar para abrir cámara en vivo</span>
                  </button>
                )}

                {cameraError && (
                  <p className="text-[11px] text-amber-300">{cameraError}</p>
                )}
              </div>

              {/* Step 3: Store / Client */}
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-white flex items-center gap-1.5">
                  <Store className="w-4 h-4 text-violet-400" />
                  3. Punto de venta / Obra / Cliente *
                </label>
                <input
                  type="text"
                  required
                  value={puntoVenta}
                  onChange={e => setPuntoVenta(e.target.value)}
                  placeholder="Ej. Home Depot Mexicali / Ferretería Central"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0e121e] border border-white/15 text-xs font-semibold text-white placeholder:text-slate-500 focus:border-teal-400 outline-none"
                />
                <input
                  type="text"
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  placeholder="Notas opcionales (ej. Inicio de ruta zona sur)"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0e121e] border border-white/10 text-xs text-slate-200 placeholder:text-slate-500 focus:border-teal-400 outline-none"
                />
              </div>

              {submitError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-200 text-xs">
                  {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-2xl text-sm font-black text-white shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, #0d9488 0%, #0284c7 100%)',
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Registrando checada...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Confirmar {session.tipo === 'entrada' ? 'Entrada' : 'Salida'}
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
