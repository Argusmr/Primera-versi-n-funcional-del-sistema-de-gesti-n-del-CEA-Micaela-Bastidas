import { ConfiguracionCalendario } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';

const CALENDAR_STORAGE_KEY = 'cea_configuracion_calendario_v1';

export const FALLBACK_DIAS_TRABAJADOS = 22;

export function getLocalConfiguracionesCalendario(): ConfiguracionCalendario[] {
  try {
    const raw = localStorage.getItem(CALENDAR_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Error al leer configuraciones de calendario locales:', e);
  }
  return [];
}

export function setLocalConfiguracionesCalendario(configs: ConfiguracionCalendario[]): void {
  try {
    localStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(configs));
    window.dispatchEvent(new CustomEvent('configuracionCalendarioChanged', { detail: configs }));
  } catch (e) {
    console.warn('Error al guardar configuraciones de calendario locales:', e);
  }
}

export async function loadConfiguracionesCalendario(): Promise<ConfiguracionCalendario[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('configuracion_calendario')
        .select('*')
        .order('mes', { ascending: false });

      if (error) {
        console.warn('Error al consultar configuracion_calendario de Supabase:', error.message);
        return getLocalConfiguracionesCalendario();
      }

      if (data) {
        const mapped: ConfiguracionCalendario[] = data.map((item: any) => ({
          id: item.id,
          mes: item.mes,
          dias_trabajados: Number(item.dias_trabajados),
          observacion: item.observacion || '',
          creado_por: item.creado_por,
          created_at: item.created_at,
          updated_at: item.updated_at
        }));
        setLocalConfiguracionesCalendario(mapped);
        return mapped;
      }
    } catch (err: any) {
      console.warn('Excepción al cargar configuracion_calendario:', err);
    }
  }
  return getLocalConfiguracionesCalendario();
}

export async function saveConfiguracionCalendario(
  mes: string,
  diasTrabajados: number,
  observacion: string = '',
  creadoPor?: string
): Promise<{ success: boolean; data?: ConfiguracionCalendario; error?: string }> {
  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
    return { success: false, error: 'El formato de mes debe ser YYYY-MM (ej. 2026-08)' };
  }

  if (diasTrabajados < 0 || diasTrabajados > 31 || isNaN(diasTrabajados)) {
    return { success: false, error: 'Los días trabajados deben ser un número entre 0 y 31' };
  }

  const nowIso = new Date().toISOString();

  if (isSupabaseConfigured && supabase) {
    try {
      // Check if record exists for this mes
      const { data: existing, error: checkErr } = await supabase
        .from('configuracion_calendario')
        .select('id')
        .eq('mes', mes)
        .maybeSingle();

      if (checkErr) {
        console.warn('Error verificando mes en Supabase:', checkErr);
      }

      let resData: any = null;

      if (existing) {
        const { data, error } = await supabase
          .from('configuracion_calendario')
          .update({
            dias_trabajados: diasTrabajados,
            observacion: observacion.trim(),
            updated_at: nowIso
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        resData = data;
      } else {
        const { data, error } = await supabase
          .from('configuracion_calendario')
          .insert({
            mes,
            dias_trabajados: diasTrabajados,
            observacion: observacion.trim(),
            creado_por: creadoPor || null,
            created_at: nowIso,
            updated_at: nowIso
          })
          .select()
          .single();

        if (error) throw error;
        resData = data;
      }

      const saved: ConfiguracionCalendario = {
        id: resData.id,
        mes: resData.mes,
        dias_trabajados: Number(resData.dias_trabajados),
        observacion: resData.observacion || '',
        creado_por: resData.creado_por,
        created_at: resData.created_at,
        updated_at: resData.updated_at
      };

      // Sync local
      const locals = getLocalConfiguracionesCalendario();
      const updatedLocals = [saved, ...locals.filter(l => l.mes !== mes)];
      setLocalConfiguracionesCalendario(updatedLocals);

      return { success: true, data: saved };
    } catch (err: any) {
      console.error('Error al guardar configuracion_calendario en Supabase:', err);
      // Fallback to local save
      const savedLocal: ConfiguracionCalendario = {
        id: `cal-${Date.now()}`,
        mes,
        dias_trabajados: diasTrabajados,
        observacion: observacion.trim(),
        creado_por: creadoPor,
        created_at: nowIso,
        updated_at: nowIso
      };
      const locals = getLocalConfiguracionesCalendario();
      const updatedLocals = [savedLocal, ...locals.filter(l => l.mes !== mes)];
      setLocalConfiguracionesCalendario(updatedLocals);

      return { success: true, data: savedLocal, error: 'Guardado localmente (sin conexión a base de datos)' };
    }
  } else {
    const savedLocal: ConfiguracionCalendario = {
      id: `cal-${Date.now()}`,
      mes,
      dias_trabajados: diasTrabajados,
      observacion: observacion.trim(),
      creado_por: creadoPor,
      created_at: nowIso,
      updated_at: nowIso
    };
    const locals = getLocalConfiguracionesCalendario();
    const updatedLocals = [savedLocal, ...locals.filter(l => l.mes !== mes)];
    setLocalConfiguracionesCalendario(updatedLocals);

    return { success: true, data: savedLocal };
  }
}

export async function deleteConfiguracionCalendario(id: string, mes: string): Promise<{ success: boolean; error?: string }> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('configuracion_calendario')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (err: any) {
      console.error('Error al eliminar configuracion_calendario en Supabase:', err);
    }
  }

  const locals = getLocalConfiguracionesCalendario();
  const updated = locals.filter(l => l.id !== id && l.mes !== mes);
  setLocalConfiguracionesCalendario(updated);
  return { success: true };
}

export function getDiasTrabajadosForMonth(
  mes: string,
  configs: ConfiguracionCalendario[] = []
): number {
  if (!mes) return FALLBACK_DIAS_TRABAJADOS;
  // Mes can be 'YYYY-MM' or 'YYYY-MM-DD'
  const normalizedMes = mes.length > 7 ? mes.slice(0, 7) : mes;
  const match = configs.find(c => c.mes === normalizedMes);
  if (match && typeof match.dias_trabajados === 'number' && match.dias_trabajados >= 0) {
    return match.dias_trabajados;
  }
  return FALLBACK_DIAS_TRABAJADOS;
}
