import { Programa, Etapa, NivelEducativo, Estudiante } from '../types';
import { INITIAL_PROGRAMAS, MOCK_ESTUDIANTES } from './mockData';
import { supabase, isSupabaseConfigured, checkIsOnline } from './supabase';

export const INITIAL_ETAPAS: Etapa[] = [
  {
    id: 'etapa-1',
    nombre: 'Aprendizajes Elementales',
    programa_codigo: 'EPA',
    descripcion: 'Alfabetización inicial y consolidación de competencias básicas.',
    activo: true,
  },
  {
    id: 'etapa-2',
    nombre: 'Aprendizajes Avanzados',
    programa_codigo: 'EPA',
    descripcion: 'Profundización primaria humanística.',
    activo: true,
  },
  {
    id: 'etapa-3',
    nombre: 'Secundaria Etapa Aplicada',
    programa_codigo: 'ESA',
    descripcion: 'Formación secundaria orientada al trabajo y bachillerato.',
    activo: true,
  },
  {
    id: 'etapa-4',
    nombre: 'Formación Técnica Tecnológica',
    programa_codigo: 'ETA',
    descripcion: 'Especialidades técnicas en niveles Básico, Auxiliar y Medio.',
    activo: true,
  },
  {
    id: 'etapa-5',
    nombre: 'Talleres Comunitarios',
    programa_codigo: 'EDUPER',
    descripcion: 'Capacitación no formal de corta duración.',
    activo: true,
  },
];

export const INITIAL_NIVELES: NivelEducativo[] = [
  {
    id: 'niv-1',
    nombre: 'Elemental',
    etapa_nombre: 'Aprendizajes Elementales',
    programa_codigo: 'EPA',
    descripcion: 'Nivel básico de primaria o inicio.',
    activo: true,
  },
  {
    id: 'niv-2',
    nombre: 'Avanzado',
    etapa_nombre: 'Aprendizajes Avanzados',
    programa_codigo: 'EPA',
    descripcion: 'Nivel avanzado primaria o secundaria.',
    activo: true,
  },
  {
    id: 'niv-3',
    nombre: 'Técnico Básico',
    etapa_nombre: 'Formación Técnica Tecnológica',
    programa_codigo: 'ETA',
    descripcion: 'Primer nivel de formación técnica certificada.',
    activo: true,
  },
  {
    id: 'niv-4',
    nombre: 'Técnico Auxiliar',
    etapa_nombre: 'Formación Técnica Tecnológica',
    programa_codigo: 'ETA',
    descripcion: 'Segundo nivel de especialización práctica.',
    activo: true,
  },
  {
    id: 'niv-5',
    nombre: 'Técnico Medio',
    etapa_nombre: 'Formación Técnica Tecnológica',
    programa_codigo: 'ETA',
    descripcion: 'Nivel técnico profesional habilitante.',
    activo: true,
  },
];

const KEY_PROGRAMAS = 'cea_programas_v1';
const KEY_ETAPAS = 'cea_etapas_v1';
const KEY_NIVELES = 'cea_niveles_v1';
const KEY_ESTUDIANTES = 'cea_estudiantes_v1';

// Helper to notify changes across components
function notifyAcademicChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('academicStructureChanged'));
  }
}

// PROGRAMAS
export function getLocalProgramas(): Programa[] {
  try {
    const raw = localStorage.getItem(KEY_PROGRAMAS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Error al leer programas locales:', e);
  }
  return INITIAL_PROGRAMAS;
}

export function saveLocalProgramas(list: Programa[]): void {
  try {
    localStorage.setItem(KEY_PROGRAMAS, JSON.stringify(list));
    notifyAcademicChanged();
  } catch (e) {
    console.warn('Error al guardar programas locales:', e);
  }
}

// ETAPAS
export function getLocalEtapas(): Etapa[] {
  try {
    const raw = localStorage.getItem(KEY_ETAPAS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Error al leer etapas locales:', e);
  }
  return INITIAL_ETAPAS;
}

export function saveLocalEtapas(list: Etapa[]): void {
  try {
    localStorage.setItem(KEY_ETAPAS, JSON.stringify(list));
    notifyAcademicChanged();
  } catch (e) {
    console.warn('Error al guardar etapas locales:', e);
  }
}

// NIVELES
export function getLocalNiveles(): NivelEducativo[] {
  try {
    const raw = localStorage.getItem(KEY_NIVELES);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Error al leer niveles locales:', e);
  }
  return INITIAL_NIVELES;
}

export function saveLocalNiveles(list: NivelEducativo[]): void {
  try {
    localStorage.setItem(KEY_NIVELES, JSON.stringify(list));
    notifyAcademicChanged();
  } catch (e) {
    console.warn('Error al guardar niveles locales:', e);
  }
}

// SUPABASE LOADER FUNCTIONS
export async function loadProgramasFromSupabase(): Promise<Programa[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('programas')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        saveLocalProgramas(data as Programa[]);
        return data as Programa[];
      }
    } catch (e) {
      console.warn('Error al obtener programas de Supabase:', e);
    }
  }
  return getLocalProgramas();
}

export async function loadEtapasFromSupabase(): Promise<Etapa[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('etapas')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        saveLocalEtapas(data as Etapa[]);
        return data as Etapa[];
      }
    } catch (e) {
      console.warn('Error al obtener etapas de Supabase:', e);
    }
  }
  return getLocalEtapas();
}

export async function loadNivelesFromSupabase(): Promise<NivelEducativo[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('niveles')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        saveLocalNiveles(data as NivelEducativo[]);
        return data as NivelEducativo[];
      }
    } catch (e) {
      console.warn('Error al obtener niveles de Supabase:', e);
    }
  }
  return getLocalNiveles();
}

// ESTUDIANTES
export function getLocalEstudiantes(): Estudiante[] {
  try {
    const raw = localStorage.getItem(KEY_ESTUDIANTES);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        return list;
      }
    }
  } catch (e) {
    console.warn('Error al leer estudiantes locales:', e);
  }
  return isSupabaseConfigured ? [] : MOCK_ESTUDIANTES;
}

export function saveLocalEstudiantes(list: Estudiante[]): void {
  try {
    localStorage.setItem(KEY_ESTUDIANTES, JSON.stringify(list));
    notifyAcademicChanged();
  } catch (e) {
    console.warn('Error al guardar estudiantes locales:', e);
  }
}

// Load real students from Supabase and resolve relations
export async function loadEstudiantesFromSupabase(): Promise<Estudiante[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      // 1. Cargar estudiantes reales desde public.estudiantes
      const { data: estudiantesData, error: estErr } = await supabase
        .from('estudiantes')
        .select('*')
        .order('nombre_completo', { ascending: true });

      if (estErr) {
        throw new Error(`Error en public.estudiantes: ${estErr.message}`);
      }

      if (!estudiantesData || estudiantesData.length === 0) {
        saveLocalEstudiantes([]);
        return [];
      }

      // 2. Cargar sedes, grupos y programas reales para resolver nombres
      const [sedesRes, gruposRes, programasRes] = await Promise.all([
        supabase.from('sedes').select('id, nombre'),
        supabase.from('grupos').select('id, nombre, sede_id'),
        supabase.from('programas').select('id, nombre, codigo')
      ]);

      const sedeMap = new Map<string, string>();
      (sedesRes.data || []).forEach((s: { id: string; nombre: string }) => {
        sedeMap.set(s.id, s.nombre);
      });

      const grupoMap = new Map<string, string>();
      (gruposRes.data || []).forEach((g: { id: string; nombre: string }) => {
        grupoMap.set(g.id, g.nombre);
      });

      const programaMap = new Map<string, { nombre: string; codigo: string }>();
      (programasRes.data || []).forEach((p: { id: string; nombre: string; codigo: string }) => {
        programaMap.set(p.id, { nombre: p.nombre, codigo: p.codigo });
      });

      // 3. Mapear cada estudiante resolviendo sede_nombre, grupo_nombre y programa_codigo
      const resolvedList: Estudiante[] = estudiantesData.map((e: any) => {
        const progInfo = e.programa_id ? programaMap.get(e.programa_id) : undefined;
        return {
          ...e,
          sede_nombre: (e.sede_id ? sedeMap.get(e.sede_id) : undefined) || 'Sede sin asignar',
          grupo_nombre: (e.grupo_id ? grupoMap.get(e.grupo_id) : undefined) || 'Grupo sin asignar',
          programa_nombre: progInfo?.nombre || e.carrera_especialidad || 'Sin programa',
          programa_codigo: progInfo?.codigo || e.programa_codigo || 'GENERAL'
        };
      });

      saveLocalEstudiantes(resolvedList);
      return resolvedList;
    } catch (e) {
      console.error('Error al obtener estudiantes de Supabase:', e);
      throw e;
    }
  }

  return getLocalEstudiantes();
}
