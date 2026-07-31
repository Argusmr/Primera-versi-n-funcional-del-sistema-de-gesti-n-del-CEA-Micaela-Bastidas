import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface OfflineAsistenciaDocente {
  sync_key: string;
  docente_id: string;
  tipo: 'ingreso' | 'salida';
  hora_local: string;
  observacion?: string;
  timestamp: number;
}

export interface OfflineAsistenciaEstudiante {
  sync_key: string;
  grupo_id: string;
  fecha: string;
  materia: string;
  docente_id: string;
  asistencias: Array<{
    estudiante_id: string;
    estado: 'presente' | 'atraso' | 'falta' | 'licencia';
    observacion?: string;
  }>;
  timestamp: number;
}

export interface OfflineSeguimiento {
  sync_key: string;
  estudiante_id: string;
  docente_id: string;
  motivo: string;
  accion_realizada: 'llamada' | 'mensaje' | 'visita' | 'conversacion_personal' | 'derivacion' | 'otra';
  resultado: string;
  proxima_accion?: string;
  observacion?: string;
  timestamp: number;
}

interface CEADB extends DBSchema {
  asistencias_docentes_offline: {
    key: string; // sync_key
    value: OfflineAsistenciaDocente;
  };
  asistencias_estudiantes_offline: {
    key: string; // sync_key
    value: OfflineAsistenciaEstudiante;
  };
  seguimientos_offline: {
    key: string; // sync_key
    value: OfflineSeguimiento;
  };
  cache_local: {
    key: string;
    value: any;
  };
}

let dbPromise: Promise<IDBPDatabase<CEADB>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<CEADB>('cea_micaela_bastidas_db', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('asistencias_docentes_offline')) {
          db.createObjectStore('asistencias_docentes_offline', { keyPath: 'sync_key' });
        }
        if (!db.objectStoreNames.contains('asistencias_estudiantes_offline')) {
          db.createObjectStore('asistencias_estudiantes_offline', { keyPath: 'sync_key' });
        }
        if (!db.objectStoreNames.contains('seguimientos_offline')) {
          db.createObjectStore('seguimientos_offline', { keyPath: 'sync_key' });
        }
        if (!db.objectStoreNames.contains('cache_local')) {
          db.createObjectStore('cache_local');
        }
      },
    });
  }
  return dbPromise;
}

// Helper methods for IndexedDB
export async function saveOfflineDocenteAsistencia(item: OfflineAsistenciaDocente) {
  const db = await getDB();
  await db.put('asistencias_docentes_offline', item);
}

export async function getOfflineDocenteAsistencias(): Promise<OfflineAsistenciaDocente[]> {
  const db = await getDB();
  return db.getAll('asistencias_docentes_offline');
}

export async function removeOfflineDocenteAsistencia(sync_key: string) {
  const db = await getDB();
  await db.delete('asistencias_docentes_offline', sync_key);
}

export async function saveOfflineEstudianteAsistencia(item: OfflineAsistenciaEstudiante) {
  const db = await getDB();
  await db.put('asistencias_estudiantes_offline', item);
}

export async function getOfflineEstudianteAsistencias(): Promise<OfflineAsistenciaEstudiante[]> {
  const db = await getDB();
  return db.getAll('asistencias_estudiantes_offline');
}

export async function removeOfflineEstudianteAsistencia(sync_key: string) {
  const db = await getDB();
  await db.delete('asistencias_estudiantes_offline', sync_key);
}

export async function saveOfflineSeguimiento(item: OfflineSeguimiento) {
  const db = await getDB();
  await db.put('seguimientos_offline', item);
}

export async function getOfflineSeguimientos(): Promise<OfflineSeguimiento[]> {
  const db = await getDB();
  return db.getAll('seguimientos_offline');
}

export async function removeOfflineSeguimiento(sync_key: string) {
  const db = await getDB();
  await db.delete('seguimientos_offline', sync_key);
}

export async function setCacheItem(key: string, value: any) {
  const db = await getDB();
  await db.put('cache_local', value, key);
}

export async function getCacheItem<T = any>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return db.get('cache_local', key);
}

export async function getPendingSyncCount(): Promise<number> {
  try {
    const db = await getDB();
    const docCount = await db.count('asistencias_docentes_offline');
    const estCount = await db.count('asistencias_estudiantes_offline');
    const segCount = await db.count('seguimientos_offline');
    return docCount + estCount + segCount;
  } catch {
    return 0;
  }
}
