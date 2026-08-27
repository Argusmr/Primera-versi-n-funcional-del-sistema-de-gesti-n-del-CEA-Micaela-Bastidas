import { DatosInstitucionales } from '../types';
import { supabase, isSupabaseConfigured, checkIsOnline } from './supabase';

export const DEFAULT_DATOS_INSTITUCIONALES: DatosInstitucionales = {
  nombre_completo: 'Centro de Educación Alternativa Micaela Bastidas',
  nombre_corto: 'CEA Micaela Bastidas',
  nombre_director: 'Dirección Institucional',
  cargo_director: 'Director General Institucional',
  direccion: 'Poroma - Chuquisaca, Bolivia',
  telefono: '+591 67891234',
  lema_subtitulo: 'Asistencia, seguimiento e información en un solo lugar',
  temporada_actual: 'verano',
};

const STORAGE_KEY = 'cea_datos_institucionales_v1';

export function getLocalDatosInstitucionales(): DatosInstitucionales {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_DATOS_INSTITUCIONALES, ...parsed };
    }
  } catch (e) {
    console.warn('Error al leer datos institucionales locales:', e);
  }
  return DEFAULT_DATOS_INSTITUCIONALES;
}

export function setLocalDatosInstitucionales(datos: DatosInstitucionales): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(datos));
    // Dispatch custom event so reactive listeners can update immediately
    window.dispatchEvent(new CustomEvent('datosInstitucionalesChanged', { detail: datos }));
  } catch (e) {
    console.warn('Error al guardar datos institucionales locales:', e);
  }
}

export async function loadDatosInstitucionales(): Promise<DatosInstitucionales> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('datos_institucionales')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        const fetched: DatosInstitucionales = {
          nombre_completo: data.nombre_completo || DEFAULT_DATOS_INSTITUCIONALES.nombre_completo,
          nombre_corto: data.nombre_corto || DEFAULT_DATOS_INSTITUCIONALES.nombre_corto,
          nombre_director: data.nombre_director || DEFAULT_DATOS_INSTITUCIONALES.nombre_director,
          cargo_director: data.cargo_director || DEFAULT_DATOS_INSTITUCIONALES.cargo_director,
          direccion: data.direccion || DEFAULT_DATOS_INSTITUCIONALES.direccion,
          telefono: data.telefono || DEFAULT_DATOS_INSTITUCIONALES.telefono,
          lema_subtitulo: data.lema_subtitulo || DEFAULT_DATOS_INSTITUCIONALES.lema_subtitulo,
          temporada_actual: data.temporada_actual || DEFAULT_DATOS_INSTITUCIONALES.temporada_actual || 'verano',
        };
        setLocalDatosInstitucionales(fetched);
        return fetched;
      }
      if (error) {
        console.error('Error leyendo datos institucionales desde Supabase:', error);
      }
    } catch (e) {
      console.error('Excepción leyendo datos institucionales desde Supabase:', e);
    }
  }

  return getLocalDatosInstitucionales();
}

export async function saveDatosInstitucionales(datos: DatosInstitucionales): Promise<{ success: boolean; error?: string }> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('datos_institucionales')
        .upsert({
          id: 'main',
          ...datos,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error guardando en Supabase datos_institucionales:', error);
        return { success: false, error: error.message };
      }

      setLocalDatosInstitucionales(datos);
      return { success: true };
    } catch (e: any) {
      console.error('Excepción al guardar datos institucionales en Supabase:', e);
      return { success: false, error: e.message || 'Error de conexión' };
    }
  }

  setLocalDatosInstitucionales(datos);
  return { success: true };
}
