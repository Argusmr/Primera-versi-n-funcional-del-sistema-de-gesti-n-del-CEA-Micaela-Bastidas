import { Auditoria } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';

const AUDITORIA_STORAGE_KEY = 'cea_auditoria_logs_v1';

export function getLocalAuditoriaLogs(): Auditoria[] {
  try {
    const raw = localStorage.getItem(AUDITORIA_STORAGE_KEY);
    if (raw) {
      const parsed: Auditoria[] = JSON.parse(raw);
      // Filter out any legacy demonstrative/mock log entries
      const cleaned = parsed.filter(
        item => item.id !== 'aud-1' && item.usuario_nombre !== 'Prof. Mario Gutiérrez Flores'
      );
      return cleaned;
    }
  } catch (e) {
    console.warn('Error al leer logs de auditoría locales:', e);
  }
  return [];
}

export function saveLocalAuditoriaLog(log: Auditoria): void {
  try {
    const current = getLocalAuditoriaLogs();
    const updated = [log, ...current];
    localStorage.setItem(AUDITORIA_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('auditoriaChanged', { detail: updated }));
  } catch (e) {
    console.warn('Error al guardar log de auditoría local:', e);
  }
}

export async function loadAuditoriaLogs(): Promise<Auditoria[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('auditoria')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error al consultar auditoria de Supabase:', error.message);
        return getLocalAuditoriaLogs();
      }

      if (data) {
        const mapped: Auditoria[] = data.map((item: any) => ({
          id: item.id,
          usuario_id: item.usuario_id,
          usuario_nombre: item.usuario_nombre,
          accion: item.accion,
          tabla_afectada: item.tabla_afectada,
          registro_afectado_id: item.registro_afectado_id,
          valor_anterior: item.valor_anterior,
          valor_nuevo: item.valor_nuevo,
          motivo_correccion: item.motivo_correccion,
          created_at: item.created_at
        }));
        try {
          localStorage.setItem(AUDITORIA_STORAGE_KEY, JSON.stringify(mapped));
        } catch {}
        return mapped;
      }
    } catch (err: any) {
      console.warn('Excepción al cargar auditoría:', err);
    }
  }
  return getLocalAuditoriaLogs();
}

export interface RegistrarAuditoriaParams {
  usuario_id?: string;
  usuario_nombre: string;
  usuario_rol?: string;
  accion: string;
  tabla_afectada: string;
  registro_afectado_id?: string;
  valor_anterior?: any;
  valor_nuevo?: any;
  motivo_registro: string;
}

export async function registrarAuditoria(
  params: RegistrarAuditoriaParams
): Promise<{ success: boolean; data?: Auditoria; error?: string }> {
  const newLog: Auditoria = {
    id: `aud-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    usuario_id: params.usuario_id,
    usuario_nombre: params.usuario_nombre,
    accion: params.accion,
    tabla_afectada: params.tabla_afectada,
    registro_afectado_id: params.registro_afectado_id,
    valor_anterior: params.valor_anterior || null,
    valor_nuevo: {
      ...(typeof params.valor_nuevo === 'object' ? params.valor_nuevo : { valor: params.valor_nuevo }),
      rol_usuario: params.usuario_rol
    },
    motivo_correccion: params.motivo_registro,
    created_at: new Date().toISOString()
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('auditoria')
        .insert({
          usuario_id: params.usuario_id || null,
          usuario_nombre: params.usuario_nombre,
          accion: params.accion,
          tabla_afectada: params.tabla_afectada,
          registro_afectado_id: params.registro_afectado_id || null,
          valor_anterior: params.valor_anterior || null,
          valor_nuevo: {
            ...(typeof params.valor_nuevo === 'object' ? params.valor_nuevo : { valor: params.valor_nuevo }),
            rol_usuario: params.usuario_rol
          },
          motivo_correccion: params.motivo_registro
        })
        .select()
        .single();

      if (error) {
        console.warn('Error al registrar auditoría en Supabase:', error.message);
        // Fallback to local
        saveLocalAuditoriaLog(newLog);
        return { success: true, data: newLog };
      }

      if (data) {
        const savedLog: Auditoria = {
          id: data.id,
          usuario_id: data.usuario_id,
          usuario_nombre: data.usuario_nombre,
          accion: data.accion,
          tabla_afectada: data.tabla_afectada,
          registro_afectado_id: data.registro_afectado_id,
          valor_anterior: data.valor_anterior,
          valor_nuevo: data.valor_nuevo,
          motivo_correccion: data.motivo_correccion,
          created_at: data.created_at
        };
        saveLocalAuditoriaLog(savedLog);
        return { success: true, data: savedLog };
      }
    } catch (err: any) {
      console.warn('Excepción al registrar auditoría en Supabase:', err);
      saveLocalAuditoriaLog(newLog);
      return { success: true, data: newLog };
    }
  }

  saveLocalAuditoriaLog(newLog);
  return { success: true, data: newLog };
}
