import { ControlDocumental, FormatoPlanModular } from '../types';
import { supabase } from './supabase';
import { getBoliviaTodayDate } from './geo';

const STORAGE_KEY = 'cea_control_documental_v1';

export const INITIAL_CONTROL_DOCUMENTAL_MAP: Record<string, ControlDocumental> = {
  'usr-director': {
    docente_id: 'usr-director',
    tiene_plan_modular: true,
    formato_plan_modular: 'Ambos',
    tiene_planificacion_curricular: true,
    fecha_revision: '2026-07-15',
    observacion: 'Planificación anual y modular al día. Verificado.',
    estado: 'presentado',
    updated_at: '2026-07-15T10:00:00.000Z'
  },
  'usr-doc-1': {
    docente_id: 'usr-doc-1',
    tiene_plan_modular: true,
    formato_plan_modular: 'Digital',
    tiene_planificacion_curricular: true,
    fecha_revision: '2026-07-20',
    observacion: 'Entregado en formato digital en PDF/Drive.',
    estado: 'presentado',
    updated_at: '2026-07-20T14:30:00.000Z'
  },
  'usr-doc-2': {
    docente_id: 'usr-doc-2',
    tiene_plan_modular: false,
    formato_plan_modular: 'Digital',
    tiene_planificacion_curricular: true,
    fecha_revision: '2026-07-25',
    observacion: 'Pendiente entrega de Plan Modular impreso o digital.',
    estado: 'pendiente',
    updated_at: '2026-07-25T11:15:00.000Z'
  },
  'usr-doc-3': {
    docente_id: 'usr-doc-3',
    tiene_plan_modular: true,
    formato_plan_modular: 'Impreso',
    tiene_planificacion_curricular: false,
    fecha_revision: '2026-07-28',
    observacion: 'Falta ajustar planificación curricular del 3er bimestre.',
    estado: 'pendiente',
    updated_at: '2026-07-28T16:00:00.000Z'
  }
};

/**
 * Calculates whether state is 'presentado' (Verde) or 'pendiente' (Rojo).
 */
export function calculateEstadoControl(
  tienePlanModular: boolean,
  tienePlanificacionCurricular: boolean
): 'presentado' | 'pendiente' {
  return tienePlanModular && tienePlanificacionCurricular ? 'presentado' : 'pendiente';
}

/**
 * Gets all local control documental items from localStorage or initial map
 */
export function getLocalControlDocumentalMap(): Record<string, ControlDocumental> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...INITIAL_CONTROL_DOCUMENTAL_MAP, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn('Error reading control documental from localStorage', e);
  }
  return { ...INITIAL_CONTROL_DOCUMENTAL_MAP };
}

/**
 * Gets control documental for a specific teacher
 */
export async function getControlDocumentalForDocente(docenteId: string): Promise<ControlDocumental> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('control_documental')
        .select('*')
        .eq('docente_id', docenteId)
        .maybeSingle();

      if (data && !error) {
        return {
          id: data.id,
          docente_id: data.docente_id,
          tiene_plan_modular: data.tiene_plan_modular,
          formato_plan_modular: (data.formato_plan_modular as FormatoPlanModular) || 'Digital',
          tiene_planificacion_curricular: data.tiene_planificacion_curricular,
          fecha_revision: data.fecha_revision,
          observacion: data.observacion || '',
          estado: calculateEstadoControl(data.tiene_plan_modular, data.tiene_planificacion_curricular),
          updated_at: data.updated_at
        };
      }
    } catch (e) {
      console.warn('Failed to fetch control_documental from Supabase, fallback to local', e);
    }
  }

  const map = getLocalControlDocumentalMap();
  if (map[docenteId]) {
    return map[docenteId];
  }

  // Default fallback for new docentes
  return {
    docente_id: docenteId,
    tiene_plan_modular: false,
    formato_plan_modular: 'Digital',
    tiene_planificacion_curricular: false,
    fecha_revision: getBoliviaTodayDate(),
    observacion: 'Sin revisión registrada aún.',
    estado: 'pendiente'
  };
}

/**
 * Saves control documental for a teacher to both Supabase and localStorage
 */
export async function saveControlDocumental(
  record: ControlDocumental,
  updatedByUserId?: string
): Promise<ControlDocumental> {
  const estado = calculateEstadoControl(record.tiene_plan_modular, record.tiene_planificacion_curricular);
  const updatedRecord: ControlDocumental = {
    ...record,
    estado,
    updated_at: new Date().toISOString(),
    updated_by: updatedByUserId
  };

  // 1. Local storage save
  const map = getLocalControlDocumentalMap();
  map[record.docente_id] = updatedRecord;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('Failed to save control_documental to localStorage', e);
  }

  // 2. Supabase save
  if (supabase) {
    const { data, error } = await supabase
      .from('control_documental')
      .upsert(
        {
          docente_id: updatedRecord.docente_id,
          tiene_plan_modular: updatedRecord.tiene_plan_modular,
          formato_plan_modular: updatedRecord.formato_plan_modular,
          tiene_planificacion_curricular: updatedRecord.tiene_planificacion_curricular,
          fecha_revision: updatedRecord.fecha_revision || getBoliviaTodayDate(),
          observacion: updatedRecord.observacion || '',
          updated_at: updatedRecord.updated_at,
          updated_by: updatedByUserId
        },
        { onConflict: 'docente_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('Error al guardar control_documental en Supabase:', error);
      throw new Error(`Error en Supabase: ${error.message}`);
    }

    if (data) {
      updatedRecord.id = data.id;
    }
  }

  return updatedRecord;
}
