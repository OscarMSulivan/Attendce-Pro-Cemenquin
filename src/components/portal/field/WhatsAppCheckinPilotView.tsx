/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Camera,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  ExternalLink,
  MapPin,
  MessageCircle,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import type { Employee } from '../../../types/attendance';
import type { FieldCheckinRecord, FieldCheckinType } from '../../../types/fieldCheckin';

export interface WhatsAppCheckinPilotViewProps {
  empleadosDB: Record<string, Employee>;
  records: FieldCheckinRecord[];
  onRefreshRecords: () => void;
  onInjectRecordToEvents: (record: FieldCheckinRecord) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface ChatMessage {
  id: string;
  sender: 'promoter' | 'bot';
  text: string;
  time: string;
  actionButtons?: boolean;
  checkinUrl?: string;
  checkinTipo?: FieldCheckinType;
  token?: string;
}

const DEMO_FALLBACK_PROMOTER = {
  id: '00999',
  nombre: 'Promotor Campo Demo',
  jefe: 'PROMOTORES CAMPO',
  puesto: 'Promotor de Ventas',
};

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const WhatsAppCheckinPilotView: React.FC<WhatsAppCheckinPilotViewProps> = ({
  empleadosDB,
  records,
  onRefreshRecords,
  onInjectRecordToEvents,
  onShowToast,
}) => {
  const employeesList = useMemo(() => {
    const arr = Object.values(empleadosDB || {})
      .filter(e => e && (e.id || e.nombre) && (e.status || 'activo') !== 'inactivo')
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    return arr.length > 0 ? arr : [DEMO_FALLBACK_PROMOTER];
  }, [empleadosDB]);

  const [selectedEmpId, setSelectedEmpId] = useState<string>(employeesList[0]?.id || '00999');
  const [empSearch, setEmpSearch] = useState('');
  const [creatingToken, setCreatingToken] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: '👋 ¡Hola! Soy el asistente de checador CemenQtime para Promotores en Campo.\n\nPresiona "Simular mensaje: Checar" para probar el flujo completo.',
      time: nowHHMM(),
    },
  ]);

  const filteredEmployees = useMemo(() => {
    const q = empSearch.trim().toLowerCase();
    if (!q) return employeesList.slice(0, 80);
    return employeesList
      .filter(
        e =>
          e.nombre.toLowerCase().includes(q) ||
          String(e.id).toLowerCase().includes(q) ||
          (e.jefe || '').toLowerCase().includes(q),
      )
      .slice(0, 80);
  }, [employeesList, empSearch]);

  const selectedEmployee = useMemo(
    () => employeesList.find(e => e.id === selectedEmpId) || employeesList[0],
    [employeesList, selectedEmpId],
  );

  useEffect(() => {
    onRefreshRecords();
  }, []);

  const handleSimulateHello = () => {
    const t = nowHHMM();
    setMessages(prev => [
      ...prev,
      {
        id: `m_p_${Date.now()}`,
        sender: 'promoter',
        text: 'Hola, quiero registrar mi checada',
        time: t,
      },
      {
        id: `m_b_${Date.now() + 1}`,
        sender: 'bot',
        text: `Hola ${selectedEmployee.nombre.split(' ')[0]} 👋\nTe identifiqué con el No. Empleado #${selectedEmployee.id}.\n\n¿Qué movimiento deseas registrar?`,
        time: t,
        actionButtons: true,
      },
    ]);
  };

  const handleRequestCheckinLink = async (tipo: FieldCheckinType) => {
    setCreatingToken(true);
    const label = tipo === 'entrada' ? 'Registrar Entrada' : 'Registrar Salida';
    const t = nowHHMM();

    setMessages(prev => [
      ...prev,
      {
        id: `m_choice_${Date.now()}`,
        sender: 'promoter',
        text: tipo === 'entrada' ? '🟢 Registrar Entrada' : '🟠 Registrar Salida',
        time: t,
      },
    ]);

    try {
      const res = await fetch('/api/field-checkin/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmployee.id,
          employeeName: selectedEmployee.nombre,
          supervisor: selectedEmployee.jefe || 'PROMOTORES CAMPO',
          puesto: selectedEmployee.puesto,
          tipo,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.session?.token) {
        throw new Error(data.error || 'No se pudo generar el enlace.');
      }
      const origin = window.location.origin;
      const url = `${origin}/?checkin=${encodeURIComponent(data.session.token)}`;

      setMessages(prev => [
        ...prev,
        {
          id: `m_link_${Date.now()}`,
          sender: 'bot',
          text: `✅ Enlace seguro de 1 toque generado para ${label}.\n\nÁbrelo desde el celular para capturar GPS real + selfie en vivo (válido por 30 min):`,
          time: nowHHMM(),
          checkinUrl: url,
          checkinTipo: tipo,
          token: data.session.token,
        },
      ]);
      onShowToast('Enlace real de check-in móvil generado. Envíalo a tu celular para probarlo en vivo.', 'success');
    } catch (err: any) {
      onShowToast(err?.message || 'Error al generar enlace', 'error');
    } finally {
      setCreatingToken(false);
    }
  };

  const handleSimulateInstantCheckin = async (tipo: FieldCheckinType) => {
    const now = new Date();
    const isoDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate(),
    ).padStart(2, '0')}`;
    const hora = nowHHMM();

    try {
      const res = await fetch('/api/field-checkin/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'whatsapp_simulator',
          employeeId: selectedEmployee.id,
          employeeName: selectedEmployee.nombre,
          supervisor: selectedEmployee.jefe || 'PROMOTORES CAMPO',
          puesto: selectedEmployee.puesto,
          tipo,
          isoDate,
          hora,
          latitude: 32.624539,
          longitude: -115.452262,
          accuracyMeters: 12,
          puntoVenta: 'Home Depot Mexicali (Demo)',
          notas: 'Checada simulada desde presentación piloto',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Error al simular checada');

      setMessages(prev => [
        ...prev,
        {
          id: `m_conf_${Date.now()}`,
          sender: 'bot',
          text: `✅ ¡${tipo === 'entrada' ? 'Entrada' : 'Salida'} registrada con éxito a las ${hora}!\n📍 Home Depot Mexicali (Demo)\nSe reflejó en tiempo real en CemenQtime.`,
          time: hora,
        },
      ]);
      onRefreshRecords();
      onShowToast(`Checada piloto de ${selectedEmployee.nombre} recibida.`, 'success');
    } catch (err: any) {
      onShowToast(err?.message || 'No se pudo simular la checada', 'error');
    }
  };

  const handleCopyUrl = async (url: string, token: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      onShowToast('Enlace copiado al portapapeles.', 'success');
      window.setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      onShowToast('No se pudo copiar automáticamente.', 'error');
    }
  };

  const handleDeleteRecord = async (id: string) => {
    await fetch(`/api/field-checkin/records/${encodeURIComponent(id)}`, { method: 'DELETE' });
    onRefreshRecords();
  };

  const handleClearAll = async () => {
    if (!window.confirm('¿Limpiar todas las checadas de prueba del piloto?')) return;
    await fetch('/api/field-checkin/records', { method: 'DELETE' });
    onRefreshRecords();
    onShowToast('Checadas de prueba limpiadas.', 'info');
  };

  const handleInject = async (rec: FieldCheckinRecord) => {
    onInjectRecordToEvents(rec);
    await fetch(`/api/field-checkin/records/${encodeURIComponent(rec.id)}/mark-injected`, {
      method: 'POST',
    });
    onRefreshRecords();
  };

  const stats = useMemo(() => {
    const entradas = records.filter(r => r.tipo === 'entrada').length;
    const salidas = records.filter(r => r.tipo === 'salida').length;
    const withPhoto = records.filter(r => Boolean(r.photoBase64)).length;
    return { total: records.length, entradas, salidas, withPhoto };
  }, [records]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-[#21222D] border border-white/[0.08] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 flex items-center justify-center shrink-0">
            <MessageCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-extrabold text-white">
                Checador WhatsApp · Promotores en Campo
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/35">
                Modo Piloto (Solo Admin)
              </span>
            </div>
            <p className="text-xs text-[#87888C] mt-1 max-w-2xl">
              Demostración interactiva lista para presentar a RH: genera enlaces reales de 1 toque para probar desde cualquier celular con <strong className="text-white">GPS real + cámara en vivo</strong> y recibe la checada al instante sin afectar nóminas reales.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {records.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-500/15 text-rose-300 border border-rose-500/35 hover:bg-rose-500/25 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Limpiar pruebas
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Checadas Recibidas', value: stats.total, color: 'text-[#A9DFD8]' },
          { label: 'Entradas Campo', value: stats.entradas, color: 'text-emerald-300' },
          { label: 'Salidas Campo', value: stats.salidas, color: 'text-amber-300' },
          { label: 'Con Selfie en Vivo', value: stats.withPhoto, color: 'text-sky-300' },
        ].map(k => (
          <div
            key={k.label}
            className="p-4 rounded-2xl bg-[#21222D] border border-white/[0.07]"
          >
            <p className="text-[11px] font-bold text-[#87888C] uppercase tracking-wider">
              {k.label}
            </p>
            <p className={`text-2xl font-black mt-1 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Main 2-column layout: WhatsApp Simulator + Live Monitor */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT: WhatsApp Interactive Simulator */}
        <div className="xl:col-span-5 rounded-2xl bg-[#21222D] border border-white/[0.08] overflow-hidden shadow-xl">
          {/* Promoter selector bar */}
          <div className="p-4 border-b border-white/[0.07] bg-[#171821] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-white flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                Simulador de WhatsApp (Promotor)
              </span>
              <span className="text-[10px] font-bold text-[#87888C]">
                {employeesList.length} en padrón
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={empSearch}
                onChange={e => setEmpSearch(e.target.value)}
                placeholder="Buscar promotor o #ID..."
                className="px-3 py-1.5 rounded-xl bg-[#21222D] border border-white/[0.1] text-xs text-white placeholder:text-[#87888C] outline-none focus:border-[#A9DFD8]"
              />
              <select
                value={selectedEmployee?.id || ''}
                onChange={e => setSelectedEmpId(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-[#21222D] border border-white/[0.1] text-xs font-bold text-white outline-none focus:border-[#A9DFD8]"
              >
                {filteredEmployees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    #{emp.id} · {emp.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* WhatsApp Header */}
          <div className="px-4 py-3 bg-[#075E54] text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center font-black text-xs">
                CQ
              </div>
              <div>
                <p className="text-xs font-extrabold leading-tight">CemenQtime Bot Oficial</p>
                <p className="text-[10px] text-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 inline-block" />
                  en línea · cuenta de empresa
                </p>
              </div>
            </div>
            <ShieldCheck className="w-4 h-4 text-emerald-200" />
          </div>

          {/* WhatsApp Chat Body */}
          <div className="p-4 space-y-3 h-[380px] overflow-y-auto bg-[#0b141a]">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === 'promoter' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-sm ${
                    msg.sender === 'promoter'
                      ? 'bg-[#005c4b] text-white rounded-tr-sm'
                      : 'bg-[#202c33] text-slate-100 rounded-tl-sm border border-white/[0.06]'
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.text}</p>

                  {msg.actionButtons && (
                    <div className="mt-2.5 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={creatingToken}
                        onClick={() => handleRequestCheckinLink('entrada')}
                        className="px-2.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 font-extrabold text-[11px] cursor-pointer transition-colors"
                      >
                        🟢 Entrada
                      </button>
                      <button
                        type="button"
                        disabled={creatingToken}
                        onClick={() => handleRequestCheckinLink('salida')}
                        className="px-2.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 font-extrabold text-[11px] cursor-pointer transition-colors"
                      >
                        🟠 Salida
                      </button>
                    </div>
                  )}

                  {msg.checkinUrl && msg.token && (
                    <div className="mt-2.5 space-y-2 pt-2 border-t border-white/10">
                      <div className="p-2 rounded-lg bg-black/30 font-mono text-[10px] text-teal-300 break-all">
                        {msg.checkinUrl}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(
                            `Hola, aquí tienes tu enlace seguro de CemenQtime para registrar ${
                              msg.checkinTipo === 'salida' ? 'Salida' : 'Entrada'
                            } (${selectedEmployee.nombre}): ${msg.checkinUrl}`,
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-extrabold text-[10px] hover:bg-emerald-400"
                        >
                          <Send className="w-3 h-3" />
                          Mandar por WhatsApp
                        </a>
                        <button
                          type="button"
                          onClick={() => handleCopyUrl(msg.checkinUrl!, msg.token!)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-[10px] cursor-pointer"
                        >
                          {copiedToken === msg.token ? (
                            <Check className="w-3 h-3 text-emerald-300" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          {copiedToken === msg.token ? 'Copiado' : 'Copiar'}
                        </button>
                        <a
                          href={msg.checkinUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-500/25 hover:bg-sky-500/35 text-sky-200 font-bold text-[10px]"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Abrir
                        </a>
                      </div>
                    </div>
                  )}

                  <div className="mt-1 flex items-center justify-end gap-1 text-[9px] opacity-70">
                    <span>{msg.time}</span>
                    {msg.sender === 'promoter' && <CheckCheck className="w-3 h-3 text-sky-300" />}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Simulator Controls */}
          <div className="p-3.5 bg-[#171821] border-t border-white/[0.08] space-y-2">
            <button
              type="button"
              onClick={handleSimulateHello}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              1. Simular mensaje del promotor: "Hola, quiero checar"
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSimulateInstantCheckin('entrada')}
                className="py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-200 font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                Demo rápida Entrada
              </button>
              <button
                type="button"
                onClick={() => handleSimulateInstantCheckin('salida')}
                className="py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-200 font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Demo rápida Salida
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT: Live Field Check-ins Monitor */}
        <div className="xl:col-span-7 rounded-2xl bg-[#21222D] border border-white/[0.08] overflow-hidden shadow-xl">
          <div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#A9DFD8]" />
                Monitor en Vivo de Checadas de Campo
              </h3>
              <p className="text-[11px] text-[#87888C]">
                Cada checada enviada desde el celular aparece aquí automáticamente en menos de 1 segundo.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[10px] font-extrabold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              En vivo
            </span>
          </div>

          <div className="p-4 space-y-3 max-h-[540px] overflow-y-auto">
            {records.length === 0 ? (
              <div className="py-16 text-center space-y-2.5">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-[#87888C] flex items-center justify-center mx-auto">
                  <MapPin className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-white">
                  Aún no hay checadas piloto registradas
                </p>
                <p className="text-xs text-[#87888C] max-w-md mx-auto">
                  Usa el simulador de la izquierda para generar un enlace real y abrirlo en tu celular, o presiona <strong>Demo rápida Entrada</strong> para ver cómo llegan aquí.
                </p>
              </div>
            ) : (
              records.map(rec => (
                <motion.div
                  key={rec.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-2xl bg-[#171821] border border-white/[0.08] flex flex-col sm:flex-row gap-4"
                >
                  {/* Selfie thumbnail */}
                  <div className="shrink-0">
                    {rec.photoBase64 ? (
                      <button
                        type="button"
                        onClick={() => setZoomPhoto(rec.photoBase64!)}
                        className="w-20 h-20 rounded-xl overflow-hidden border border-teal-500/40 hover:opacity-90 transition-opacity cursor-pointer block"
                        title="Ver foto en grande"
                      >
                        <img
                          src={rec.photoBase64}
                          alt={rec.employeeName}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ) : (
                      <div className="w-20 h-20 rounded-xl bg-white/[0.04] border border-white/[0.08] flex flex-col items-center justify-center text-[#87888C]">
                        <Camera className="w-5 h-5" />
                        <span className="text-[9px] mt-1">Sin foto</span>
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-white truncate">
                          {rec.employeeName}{' '}
                          <span className="text-xs font-mono text-[#A9DFD8]">
                            #{rec.employeeId}
                          </span>
                        </p>
                        <p className="text-[11px] text-[#87888C]">
                          Sup: {rec.supervisor} ·{' '}
                          {rec.source === 'whatsapp_mobile'
                            ? '📱 Celular en vivo (GPS + Cámara)'
                            : '⚡ Simulador Demo'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase border ${
                            rec.tipo === 'entrada'
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                              : 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                          }`}
                        >
                          {rec.tipo}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg bg-white/[0.05] text-xs font-mono font-extrabold text-white flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#A9DFD8]" />
                          {rec.hora}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      <span className="text-slate-200 font-semibold flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-violet-400" />
                        {rec.puntoVenta}
                      </span>
                      {rec.latitude !== null && rec.longitude !== null && (
                        <a
                          href={`https://www.google.com/maps?q=${rec.latitude},${rec.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#A9DFD8] font-bold hover:underline inline-flex items-center gap-1"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          Ver en Google Maps
                          {rec.accuracyMeters ? ` (±${rec.accuracyMeters}m)` : ''}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    {rec.notas && (
                      <p className="text-[11px] text-[#87888C] italic">"{rec.notas}"</p>
                    )}

                    {/* Actions */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06]">
                      <span className="text-[10px] font-mono text-[#87888C]">
                        Fecha: {rec.isoDate}
                      </span>
                      <div className="flex items-center gap-2">
                        {rec.injectedToPayroll ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Inyectada a eventosDB
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleInject(rec)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#A9DFD8]/15 hover:bg-[#A9DFD8]/25 border border-[#A9DFD8]/35 text-[#A9DFD8] text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            <Database className="w-3.5 h-3.5" />
                            Inyectar a Checadas (Demo)
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteRecord(rec.id)}
                          title="Eliminar registro piloto"
                          className="p-1.5 rounded-lg text-[#87888C] hover:text-rose-300 hover:bg-rose-500/10 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Photo Lightbox */}
      {zoomPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setZoomPhoto(null)}
        >
          <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setZoomPhoto(null)}
              className="absolute -top-10 right-0 text-white hover:text-teal-300 flex items-center gap-1 text-xs font-bold"
            >
              <X className="w-4 h-4" /> Cerrar
            </button>
            <img
              src={zoomPhoto}
              alt="Evidencia ampliada"
              className="w-full rounded-2xl border border-white/20 shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
