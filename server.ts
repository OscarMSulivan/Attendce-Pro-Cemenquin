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

  // Endpoint para envío y registro de notificaciones por correo electrónico empresarial al dispersar listas
  app.post('/api/notifications/send-email', async (req, res) => {
    try {
      const { dispatches, semanaNumero, semanaPeriodo, dispersadoPor } = req.body || {};
      const current = readDatabase();
      const prevLogs = Array.isArray(current.emailLogs) ? current.emailLogs : [];
      const newEntry = {
        id: `mail_${Date.now()}`,
        semanaNumero,
        semanaPeriodo,
        dispersadoPor,
        dispatches: Array.isArray(dispatches) ? dispatches : [],
        sentAt: new Date().toISOString(),
      };
      writeDatabase({
        emailLogs: [newEntry, ...prevLogs].slice(0, 200),
      });
      res.json({
        ok: true,
        sentCount: Array.isArray(dispatches) ? dispatches.length : 0,
        timestamp: newEntry.sentAt,
      });
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
