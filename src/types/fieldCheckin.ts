/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type FieldCheckinType = 'entrada' | 'salida';

export interface FieldCheckinSession {
  token: string;
  employeeId: string;
  employeeName: string;
  supervisor: string;
  puesto?: string;
  tipo: FieldCheckinType;
  createdAt: string;
  expiresAt: string;
  used: boolean;
}

export interface FieldCheckinRecord {
  id: string;
  token?: string;
  employeeId: string;
  employeeName: string;
  supervisor: string;
  puesto?: string;
  tipo: FieldCheckinType;
  timestamp: string;
  isoDate: string; // YYYY-MM-DD
  hora: string;    // HH:MM
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  puntoVenta: string;
  notas?: string;
  photoBase64?: string;
  source: 'whatsapp_mobile' | 'whatsapp_simulator';
  injectedToPayroll?: boolean;
}
