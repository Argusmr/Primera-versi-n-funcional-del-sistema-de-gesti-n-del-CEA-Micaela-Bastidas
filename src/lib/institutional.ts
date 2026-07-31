import { DatosInstitucionales } from '../types';
import { supabase, isSupabaseConfigured, checkIsOnline } from './supabase';

export const DEFAULT_DATOS_INSTITUCIONALES: DatosInstitucionales = {
  nombre_completo: 'Centro de Educación Alternativa Micaela Bastidas',
  nombre_corto: 'CEA Micaela Bastidas',
  nombre_director: 'Prof. Mario Gutiérrez Flores',
  cargo_director: 'Director General Institucional',
  direccion: 'Poroma - Chuquisaca, Bolivia',
  telefono: '+591 67891234',
  lema_subtitulo: 'Asistencia, seguimiento e información en un solo lugar',
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
  const local = getLocalDatosInstitucionales();

  if (isSupabaseConfigured && supabase && checkIsOnline()) {
    try {
      const { data, error } = await supabase
        .from('datos_institucionales')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        const fetched: DatosInstitucionales = {
          nombre_completo: data.nombre_completo || local.nombre_completo,
          nombre_corto: data.nombre_corto || local.nombre_corto,
          nombre_director: data.nombre_director || local.nombre_director,
          cargo_director: data.cargo_director || local.cargo_director,
          direccion: data.direccion || local.direccion,
          telefono: data.telefono || local.telefono,
          lema_subtitulo: data.lema_subtitulo || local.lema_subtitulo,
        };
        setLocalDatosInstitucionales(fetched);
        return fetched;
      }
    } catch (e) {
      console.warn('Error leyendo datos institucionales desde Supabase:', e);
    }
  }

  return local;
}

export async function saveDatosInstitucionales(datos: DatosInstitucionales): Promise<{ success: boolean; error?: string }> {
  // Always update local storage first
  setLocalDatosInstitucionales(datos);

  if (isSupabaseConfigured && supabase && checkIsOnline()) {
    try {
      // Upsert into Supabase table datos_institucionales
      const { error } = await supabase
        .from('datos_institucionales')
        .upsert({
          id: '1',
          ...datos,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.warn('Error guardando en Supabase datos_institucionales:', error);
        return { success: true, error: 'Guardado localmente. Supabase reportó: ' + error.message };
      }
    } catch (e: any) {
      console.warn('Excepción al guardar datos institucionales en Supabase:', e);
      return { success: true, error: 'Guardado localmente.' };
    }
  }

  return { success: true };
}
