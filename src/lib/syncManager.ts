import {
  getOfflineDocenteAsistencias,
  removeOfflineDocenteAsistencia,
  getOfflineEstudianteAsistencias,
  removeOfflineEstudianteAsistencia,
  getOfflineSeguimientos,
  removeOfflineSeguimiento
} from './db';
import { supabase, checkIsOnline } from './supabase';

export interface SyncStatus {
  isOnline: boolean;
  pendingDocenteCount: number;
  pendingEstudianteCount: number;
  pendingSeguimientoCount: number;
  totalPending: number;
  isSyncing: boolean;
  lastSyncTime: string | null;
  syncError: string | null;
}

export async function getPendingCounts() {
  const docentes = await getOfflineDocenteAsistencias();
  const estudiantes = await getOfflineEstudianteAsistencias();
  const seguimientos = await getOfflineSeguimientos();

  return {
    docentesCount: docentes.length,
    estudiantesCount: estudiantes.length,
    seguimientosCount: seguimientos.length,
    total: docentes.length + estudiantes.length + seguimientos.length
  };
}

export async function processSyncQueue(): Promise<{ success: boolean; syncedCount: number; error?: string }> {
  if (!checkIsOnline()) {
    return { success: false, syncedCount: 0, error: 'No hay conexión a internet disponible' };
  }

  let syncedCount = 0;

  try {
    // 1. Sync Teacher Attendance Records
    const pendingDocentes = await getOfflineDocenteAsistencias();
    for (const item of pendingDocentes) {
      if (supabase) {
        if (item.tipo === 'ingreso') {
          let selfiePath = '';
          if (item.selfie_base64) {
            try {
              // Convert base64 to Blob
              const byteCharacters = atob(item.selfie_base64.split(',')[1] || item.selfie_base64);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const blob = new Blob([byteArray], { type: 'image/jpeg' });

              const fileName = `${item.docente_id}/${item.timestamp || Date.now()}.jpg`;
              const { data: uploadData, error: uploadErr } = await supabase.storage
                .from('selfies-asistencia')
                .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

              if (!uploadErr && uploadData) {
                selfiePath = uploadData.path;
              }
            } catch (imgErr) {
              console.warn('Error al subir selfie offline:', imgErr);
            }
          }

          // Attempt RPC with GPS or fallback
          const rpcParams = {
            p_docente_id: item.docente_id,
            p_sync_key: item.sync_key,
            p_hora_local: item.hora_local,
            p_es_offline: true,
            p_latitud: item.latitud || null,
            p_longitud: item.longitud || null,
            p_precision: item.precision_gps || null,
            p_distancia: item.distancia_m || null,
            p_estado_gps: item.estado_gps || 'dentro_rango',
            p_selfie_url: selfiePath || null,
            p_observacion_excepcion: item.observacion_excepcion || null,
            p_estado_excepcion: item.estado_excepcion || 'ninguna',
            p_observacion: item.observacion || 'Registrado offline y sincronizado'
          };

          let { error } = await supabase.rpc('registrar_ingreso_gps', rpcParams);
          if (error && error.message?.includes('function')) {
            // Fallback to legacy RPC
            const fallback = await supabase.rpc('registrar_ingreso', {
              p_docente_id: item.docente_id,
              p_sync_key: item.sync_key,
              p_hora_local: item.hora_local,
              p_es_offline: true,
              p_observacion: item.observacion || 'Registrado offline y sincronizado'
            });
            error = fallback.error;
          }

          if (!error) {
            await removeOfflineDocenteAsistencia(item.sync_key);
            syncedCount++;
          }
        } else if (item.tipo === 'salida') {
          let { error } = await supabase.rpc('registrar_salida_gps', {
            p_docente_id: item.docente_id,
            p_sync_key: item.sync_key,
            p_hora_local: item.hora_local,
            p_es_offline: true,
            p_latitud: item.latitud || null,
            p_longitud: item.longitud || null,
            p_precision: item.precision_gps || null,
            p_observacion: item.observacion || 'Registrado offline y sincronizado'
          });

          if (error && error.message?.includes('function')) {
            const fallback = await supabase.rpc('registrar_salida', {
              p_docente_id: item.docente_id,
              p_sync_key: item.sync_key,
              p_hora_local: item.hora_local,
              p_es_offline: true,
              p_observacion: item.observacion || 'Registrado offline y sincronizado'
            });
            error = fallback.error;
          }

          if (!error) {
            await removeOfflineDocenteAsistencia(item.sync_key);
            syncedCount++;
          }
        }
      } else {
        // Mock mode clear queue after delay
        await removeOfflineDocenteAsistencia(item.sync_key);
        syncedCount++;
      }
    }

    // 2. Sync Student Attendance
    const pendingEstudiantes = await getOfflineEstudianteAsistencias();
    for (const item of pendingEstudiantes) {
      if (supabase) {
        // Upsert session
        const { data: sesion, error: sesionError } = await supabase
          .from('sesiones_clase')
          .upsert({
            grupo_id: item.grupo_id,
            docente_id: item.docente_id,
            fecha: item.fecha,
            materia: item.materia
          }, { onConflict: 'grupo_id,fecha,materia' })
          .select()
          .single();

        if (!sesionError && sesion) {
          const recordsToInsert = item.asistencias.map(a => ({
            sesion_id: sesion.id,
            estudiante_id: a.estudiante_id,
            estado: a.estado,
            observacion: a.observacion
          }));

          const { error: asisError } = await supabase
            .from('asistencias_estudiantes')
            .upsert(recordsToInsert, { onConflict: 'sesion_id,estudiante_id' });

          if (!asisError) {
            await removeOfflineEstudianteAsistencia(item.sync_key);
            syncedCount++;
          }
        }
      } else {
        await removeOfflineEstudianteAsistencia(item.sync_key);
        syncedCount++;
      }
    }

    // 3. Sync Follow-ups
    const pendingSeguimientos = await getOfflineSeguimientos();
    for (const item of pendingSeguimientos) {
      if (supabase) {
        const { error } = await supabase.from('seguimientos').insert({
          estudiante_id: item.estudiante_id,
          docente_id: item.docente_id,
          fecha: new Date().toISOString().slice(0, 10),
          motivo: item.motivo,
          accion_realizada: item.accion_realizada,
          resultado: item.resultado,
          proxima_accion: item.proxima_accion,
          observacion: item.observacion,
          estado: 'pendiente'
        });
        if (!error) {
          await removeOfflineSeguimiento(item.sync_key);
          syncedCount++;
        }
      } else {
        await removeOfflineSeguimiento(item.sync_key);
        syncedCount++;
      }
    }

    return { success: true, syncedCount };
  } catch (e: any) {
    return { success: false, syncedCount, error: e.message || 'Error durante la sincronización' };
  }
}

export const SyncManager = {
  getPendingCounts,
  processSyncQueue
};
