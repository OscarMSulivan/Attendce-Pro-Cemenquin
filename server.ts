/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createServer as createViteServer } from 'vite';

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'portal_db.json');

interface ServerPortalDatabase {
  users?: unknown[];
  incidents?: unknown[];
  releases?: Record<string, unknown>;
  dispersals?: unknown[];
  notifications?: unknown[];
  emailLogs?: unknown[];
  empleadosDB?: Record<string, unknown>;
  eventosDB?: Record<string, unknown>;
  vacacionesDB?: Record<string, unknown>;
  reportes?: unknown[];
  resumen?: unknown;
  selectedWeek?: string;
  horarios?: Record<string, unknown>;
  asignaciones?: Record<string, string>;
  config?: Record<string, unknown>;
  updatedAt?: string;
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readDatabase(): ServerPortalDatabase {
  try {
    ensureDataDir();
    if (!fs.existsSync(DB_FILE)) {
      return {};
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw) as ServerPortalDatabase;
  } catch (err) {
    console.warn('Error leyendo base de datos local:', err);
    return {};
  }
}

function writeDatabase(partial: Partial<ServerPortalDatabase>): ServerPortalDatabase {
  ensureDataDir();
  const current = readDatabase();
  const updated: ServerPortalDatabase = {
    ...current,
    ...partial,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(DB_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}

async function startServer() {
  const app = express();

  // Soporte para subida de formatos firmados y Excels trabajados en base64 (hasta 50 MB)
  app.use(express.json({ limit: '50mb' }));

  // Endpoint de diagnóstico para Hostinger VPS KVM 2
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'AttendancePRO v10 — Servidor RH, Nóminas y CONTPAQi',
      hostname: os.hostname(),
      uptime: Math.round(process.uptime()),
      storagePath: DB_FILE,
    });
  });

  // Obtener el estado centralizado del portal
  app.get('/api/portal/state', (_req, res) => {
    const db = readDatabase();
    res.json({
      ...db,
      serverInfo: {
        hostname: os.hostname(),
        uptime: Math.round(process.uptime()),
        storagePath: DB_FILE,
      },
    });
  });

  // Sincronizar cambios (usuarios, listas asignadas, incidencias, liberaciones, dispersiones, notificaciones y nómina activa)
  app.post('/api/portal/sync', (req, res) => {
    try {
      const body = req.body || {};
      const updated = writeDatabase({
        ...(Array.isArray(body.users) ? { users: body.users } : {}),
        ...(Array.isArray(body.incidents) ? { incidents: body.incidents } : {}),
        ...(body.releases && typeof body.releases === 'object' ? { releases: body.releases } : {}),
        ...(Array.isArray(body.dispersals) ? { dispersals: body.dispersals } : {}),
        ...(Array.isArray(body.notifications) ? { notifications: body.notifications } : {}),
        ...(body.empleadosDB && typeof body.empleadosDB === 'object' ? { empleadosDB: body.empleadosDB } : {}),
        ...(body.eventosDB && typeof body.eventosDB === 'object' ? { eventosDB: body.eventosDB } : {}),
        ...(body.vacacionesDB && typeof body.vacacionesDB === 'object' ? { vacacionesDB: body.vacacionesDB } : {}),
        ...(Array.isArray(body.reportes) ? { reportes: body.reportes } : {}),
        ...(body.resumen !== undefined ? { resumen: body.resumen } : {}),
        ...(typeof body.selectedWeek === 'string' ? { selectedWeek: body.selectedWeek } : {}),
        ...(body.horarios && typeof body.horarios === 'object' ? { horarios: body.horarios } : {}),
        ...(body.asignaciones && typeof body.asignaciones === 'object' ? { asignaciones: body.asignaciones } : {}),
        ...(body.config && typeof body.config === 'object' ? { config: body.config } : {}),
      });
      res.json({ ok: true, updatedAt: updated.updatedAt });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Endpoint para probar conexión y credenciales SMTP
  app.post('/api/notifications/test-smtp', async (req, res) => {
    try {
      const nodemailer = await import('nodemailer');
      const { smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure } = req.body || {};

      if (!smtpUser || !smtpPass) {
        return res.status(400).json({
          ok: false,
          error: 'Faltan credenciales: se requiere Correo de Nóminas y Contraseña / Clave de aplicación.',
        });
      }

      const host = smtpHost || (smtpUser.includes('@gmail') ? 'smtp.gmail.com' : 'smtp.office365.com');
      const port = Number(smtpPort) || 587;
      const secure = Boolean(smtpSecure) || port === 465;

      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        connectionTimeout: 8000,
      });

      await transporter.verify();

      // Enviar correo de prueba al mismo remitente
      const info = await transporter.sendMail({
        from: `"AttendancePRO Nóminas" <${smtpUser}>`,
        to: smtpUser,
        subject: '✓ [AttendancePRO] Prueba de Conexión Exitosa',
        text: `Hola,\n\nEste es un mensaje de prueba para verificar que el servidor de correo está correctamente conectado y listo para enviar alertas automáticas de nómina.\n\nServidor: ${host}:${port}\nUsuario: ${smtpUser}\nFecha: ${new Date().toLocaleString()}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
            <div style="background: #0f172a; padding: 12px 18px; border-radius: 8px; color: #a9dfd8; font-weight: bold; font-size: 14px; margin-bottom: 16px;">
              AttendancePRO · Validación SMTP
            </div>
            <h2 style="color: #0f172a; margin-top: 0; font-size: 18px;">✓ Conexión de Correo Exitosa</h2>
            <p style="color: #475569; font-size: 13px; line-height: 1.5;">
              Tu servidor de correo ha sido verificado correctamente. A partir de ahora, cuando Nóminas / RH disperse una lista, se enviará automáticamente la alerta a cada supervisor.
            </p>
            <div style="background: #f8fafc; border-left: 4px solid #a9dfd8; padding: 10px 14px; margin: 16px 0; font-size: 12px; color: #334155;">
              <strong>Servidor:</strong> ${host}:${port}<br/>
              <strong>Cuenta conectada:</strong> ${smtpUser}<br/>
              <strong>Fecha:</strong> ${new Date().toLocaleString()}
            </div>
          </div>
        `,
      });

      return res.json({
        ok: true,
        message: `Conexión verificada con éxito. Se envió un correo de prueba a ${smtpUser}.`,
        messageId: info.messageId,
      });
    } catch (err: any) {
      console.warn('Error probando SMTP:', err);
      return res.status(500).json({
        ok: false,
        error: err.message || 'Error al conectar con el servidor SMTP',
      });
    }
  });

  // Endpoint para envío y registro de notificaciones por correo electrónico empresarial al dispersar listas
  app.post('/api/notifications/send-email', async (req, res) => {
    try {
      const {
        dispatches,
        semanaNumero,
        semanaPeriodo,
        dispersadoPor,
        emailConfig,
        limiteLiberacion,
        horasLimite,
        mensaje,
      } = req.body || {};

      let smtpSuccessCount = 0;
      const deliveryResults: Array<{ email: string; ok: boolean; info?: string }> = [];

      // Si hay credenciales de correo configuradas, realizar envío REAL vía SMTP
      if (emailConfig && emailConfig.smtpUser && emailConfig.smtpPass && Array.isArray(dispatches)) {
        try {
          const nodemailer = await import('nodemailer');
          const host =
            emailConfig.smtpHost ||
            (emailConfig.smtpUser.includes('@gmail') ? 'smtp.gmail.com' : 'smtp.office365.com');
          const port = Number(emailConfig.smtpPort) || 587;
          const secure = Boolean(emailConfig.smtpSecure) || port === 465;

          const transporter = nodemailer.createTransport({
            host,
            port,
            secure,
            auth: {
              user: emailConfig.smtpUser,
              pass: emailConfig.smtpPass,
            },
            connectionTimeout: 10000,
          });

          for (const d of dispatches) {
            try {
              const limiteText = limiteLiberacion
                ? new Date(limiteLiberacion).toLocaleString('es-MX', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : horasLimite
                ? `${horasLimite} horas posteriores a este aviso`
                : 'A la brevedad posible';

              await transporter.sendMail({
                from: `"${emailConfig.smtpFromName || 'AttendancePRO Nóminas'}" <${emailConfig.smtpUser}>`,
                to: d.recipientEmail,
                subject: d.subject || `[AttendancePRO] Nómina Semana ${semanaNumero} Lista para Validación — ${d.supervisorName}`,
                text:
                  `Hola ${d.recipientName || d.supervisorName},\n\n` +
                  `El área de Nóminas (${dispersadoPor}) ha dispersado tu lista de asistencia para la Semana ${semanaNumero} (${semanaPeriodo}).\n\n` +
                  `TIEMPO LÍMITE DE LIBERACIÓN: ${limiteText}\n\n` +
                  `Instrucciones de Nóminas:\n${mensaje || 'Favor de validar checadas faltantes, registrar justificaciones o formatos de checada sin gafete y confirmar tu liberación.'}\n\n` +
                  `Por favor ingresa al portal AttendancePRO para revisar tu equipo y liberar tu nómina dentro del plazo establecido.\n\n` +
                  `Atentamente,\nRecursos Humanos / Nóminas`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                    <div style="background: #171821; padding: 18px 24px; color: #ffffff;">
                      <div style="color: #a9dfd8; font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">AttendancePRO · Notificación de Nómina</div>
                      <h2 style="margin: 6px 0 0 0; font-size: 18px; color: #ffffff;">Nómina Semana ${semanaNumero} Dispersada</h2>
                      <div style="color: #94a3b8; font-size: 12px; margin-top: 4px;">Período: ${semanaPeriodo} · Lista: ${d.supervisorName}</div>
                    </div>
                    <div style="padding: 24px;">
                      <p style="color: #334155; font-size: 14px; line-height: 1.5; margin-top: 0;">
                        Hola <strong>${d.recipientName || d.supervisorName}</strong>,
                      </p>
                      <p style="color: #475569; font-size: 13px; line-height: 1.5;">
                        Tu lista de asistencia ha sido dispersada por <strong>${dispersadoPor}</strong> y se encuentra lista para tu revisión y resolución de incidencias.
                      </p>
                      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #20aef3; border-radius: 8px; padding: 14px 16px; margin: 18px 0;">
                        <div style="color: #0369a1; font-weight: bold; font-size: 12px; text-transform: uppercase; margin-bottom: 4px;">⏳ Tiempo Límite para Liberar:</div>
                        <div style="color: #0f172a; font-size: 14px; font-weight: bold;">${limiteText}</div>
                        ${horasLimite ? `<div style="color: #64748b; font-size: 11px; margin-top: 2px;">(Plazo configurado de ${horasLimite} horas)</div>` : ''}
                      </div>
                      ${
                        mensaje
                          ? `<div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 12px 14px; margin-bottom: 18px; font-size: 12px; color: #92400e;">
                              <strong>Nota de Nóminas:</strong> ${mensaje}
                            </div>`
                          : ''
                      }
                      <p style="color: #64748b; font-size: 12px; line-height: 1.4;">
                        Ingresa a tu cuenta de supervisor en el sistema para autorizar tiempos extras, agregar formatos de checada sin gafete y liberar la lista a tiempo.
                      </p>
                    </div>
                  </div>
                `,
              });
              smtpSuccessCount++;
              deliveryResults.push({ email: d.recipientEmail, ok: true });
            } catch (singleErr: any) {
              console.warn(`Error enviando correo a ${d.recipientEmail}:`, singleErr.message);
              deliveryResults.push({ email: d.recipientEmail, ok: false, info: singleErr.message });
            }
          }
        } catch (smtpInitErr: any) {
          console.warn('Error inicializando transporter SMTP:', smtpInitErr.message);
        }
      }

      const current = readDatabase();
      const prevLogs = Array.isArray(current.emailLogs) ? current.emailLogs : [];
      const newEntry = {
        id: `mail_${Date.now()}`,
        semanaNumero,
        semanaPeriodo,
        dispersadoPor,
        dispatches: Array.isArray(dispatches) ? dispatches : [],
        smtpSuccessCount,
        deliveryResults,
        sentAt: new Date().toISOString(),
      };
      writeDatabase({
        emailLogs: [newEntry, ...prevLogs].slice(0, 200),
      });

      res.json({
        ok: true,
        sentCount: Array.isArray(dispatches) ? dispatches.length : 0,
        smtpSentCount: smtpSuccessCount,
        timestamp: newEntry.sentAt,
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Endpoint para registrar cancelación de nómina dispersada
  app.post('/api/notifications/cancel-email', async (req, res) => {
    try {
      const { semanaNumero, canceladoPor, targetSupervisors, motivo } = req.body || {};
      const current = readDatabase();
      const prevLogs = Array.isArray(current.emailLogs) ? current.emailLogs : [];
      const cancelEntry = {
        id: `mail_cancel_${Date.now()}`,
        type: 'cancellation',
        semanaNumero,
        canceladoPor,
        targetSupervisors,
        motivo,
        cancelledAt: new Date().toISOString(),
      };
      writeDatabase({
        emailLogs: [cancelEntry, ...prevLogs].slice(0, 200),
      });
      res.json({ ok: true, timestamp: cancelEntry.cancelledAt });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✓ AttendancePRO v10 Server corriendo en http://0.0.0.0:${PORT}`);
  });
}

startServer();
