import { Programa, Subprograma, CarreraTecnica, Etapa, NivelEducativo, Estudiante } from '../types';
import { INITIAL_PROGRAMAS, INITIAL_SUBPROGRAMAS, INITIAL_CARRERAS, MOCK_ESTUDIANTES } from './mockData';
import { supabase, isSupabaseConfigured } from './supabase';

export const INITIAL_ETAPAS: Etapa[] = [
  // EPA: Educación Primaria de Personas Jóvenes y Adultas (Solamente Elementales y Avanzados)
  {
    id: 'etapa-epa-1',
    nombre: 'Aprendizajes Elementales',
    programa_codigo: 'EPJA',
    subprograma_codigo: 'EPA',
    descripcion: 'Alfabetización inicial y competencias básicas de primaria.',
    activo: true,
  },
  {
    id: 'etapa-epa-2',
    nombre: 'Aprendizajes Avanzados',
    programa_codigo: 'EPJA',
    subprograma_codigo: 'EPA',
    descripcion: 'Consolidación de conocimientos y culminación del nivel primario.',
    activo: true,
  },
  // ESA: Educación Secundaria de Adultos (Aplicados, Complementarios y Especializados)
  {
    id: 'etapa-esa-1',
    nombre: 'Aprendizajes Aplicados',
    programa_codigo: 'EPJA',
    subprograma_codigo: 'ESA',
    descripcion: 'Primer ciclo de educación secundaria humanística para jóvenes y adultos.',
    activo: true,
  },
  {
    id: 'etapa-esa-2',
    nombre: 'Aprendizajes Complementarios',
    programa_codigo: 'EPJA',
    subprograma_codigo: 'ESA',
    descripcion: 'Segundo ciclo secundario con énfasis en formación sociocomunitaria.',
    activo: true,
  },
  {
    id: 'etapa-esa-3',
    nombre: 'Aprendizajes Especializados',
    programa_codigo: 'EPJA',
    subprograma_codigo: 'ESA',
    descripcion: 'Tercer ciclo secundario habilitante para el bachillerato.',
    activo: true,
  },
];

export const INITIAL_NIVELES: NivelEducativo[] = [
  // Niveles EPA
  {
    id: 'niv-epa-1',
    nombre: 'Aprendizajes Elementales',
    etapa_nombre: 'Aprendizajes Elementales',
    programa_codigo: 'EPJA',
    subprograma_codigo: 'EPA',
    orden: 1,
    descripcion: 'Ciclo inicial de alfabetización y educación primaria de adultos.',
    activo: true,
  },
  {
    id: 'niv-epa-2',
    nombre: 'Aprendizajes Avanzados',
    etapa_nombre: 'Aprendizajes Avanzados',
    programa_codigo: 'EPJA',
    subprograma_codigo: 'EPA',
    orden: 2,
    descripcion: 'Ciclo avanzado de educación primaria de adultos.',
    activo: true,
  },
  // Niveles ESA
  {
    id: 'niv-esa-1',
    nombre: 'Aprendizajes Aplicados',
    etapa_nombre: 'Aprendizajes Aplicados',
    programa_codigo: 'EPJA',
    subprograma_codigo: 'ESA',
    orden: 1,
    descripcion: 'Primer ciclo de secundaria humanística de adultos.',
    activo: true,
  },
  {
    id: 'niv-esa-2',
    nombre: 'Aprendizajes Complementarios',
    etapa_nombre: 'Aprendizajes Complementarios',
    programa_codigo: 'EPJA',
    subprograma_codigo: 'ESA',
    orden: 2,
    descripcion: 'Segundo ciclo de secundaria humanística de adultos.',
    activo: true,
  },
  {
    id: 'niv-esa-3',
    nombre: 'Aprendizajes Especializados',
    etapa_nombre: 'Aprendizajes Especializados',
    programa_codigo: 'EPJA',
    subprograma_codigo: 'ESA',
    orden: 3,
    descripcion: 'Tercer ciclo de secundaria humanística (Bachillerato).',
    activo: true,
  },
  // Niveles ETA - Sistemas Informáticos
  {
    id: 'niv-eta-sis-1',
    nombre: 'Técnico Básico',
    carrera_nombre: 'Sistemas Informáticos',
    programa_codigo: 'ETA',
    subprograma_codigo: 'ETA',
    orden: 1,
    descripcion: 'Nivel 1: Certificación inicial en operación y ofimática técnica.',
    activo: true,
  },
  {
    id: 'niv-eta-sis-2',
    nombre: 'Técnico Auxiliar',
    carrera_nombre: 'Sistemas Informáticos',
    programa_codigo: 'ETA',
    subprograma_codigo: 'ETA',
    orden: 2,
    descripcion: 'Nivel 2: Mantenimiento de hardware, redes y soporte técnico.',
    activo: true,
  },
  {
    id: 'niv-eta-sis-3',
    nombre: 'Técnico Medio',
    carrera_nombre: 'Sistemas Informáticos',
    programa_codigo: 'ETA',
    subprograma_codigo: 'ETA',
    orden: 3,
    descripcion: 'Nivel 3: Título profesional habilitante en desarrollo de software y sistemas.',
    activo: true,
  },
  // Niveles ETA - Gastronomía
  {
    id: 'niv-eta-gas-1',
    nombre: 'Técnico Básico',
    carrera_nombre: 'Gastronomía',
    programa_codigo: 'ETA',
    subprograma_codigo: 'ETA',
    orden: 1,
    descripcion: 'Nivel 1: Técnicas básicas de cocina, higiene y manipulación de alimentos.',
    activo: true,
  },
  {
    id: 'niv-eta-gas-2',
    nombre: 'Técnico Auxiliar',
    carrera_nombre: 'Gastronomía',
    programa_codigo: 'ETA',
    subprograma_codigo: 'ETA',
    orden: 2,
    descripcion: 'Nivel 2: Elaboración de menús, panadería y repostería intermedia.',
    activo: true,
  },
  {
    id: 'niv-eta-gas-3',
    nombre: 'Técnico Medio',
    carrera_nombre: 'Gastronomía',
    programa_codigo: 'ETA',
    subprograma_codigo: 'ETA',
    orden: 3,
    descripcion: 'Nivel 3: Gestión gastronómica profesional, alta cocina y administración.',
    activo: true,
  },
  // EDUPER
  {
    id: 'niv-eduper-1',
    nombre: 'Cursos de Capacitación',
    programa_codigo: 'EDUPER',
    orden: 1,
    descripcion: 'Cursos cortos de formación para el trabajo y desarrollo comunitario.',
    activo: true,
  },
  {
    id: 'niv-eduper-2',
    nombre: 'Talleres Comunitarios',
    programa_codigo: 'EDUPER',
    orden: 2,
    descripcion: 'Talleres prácticos vivenciales con participación comunitaria.',
    activo: true,
  },
  {
    id: 'niv-eduper-3',
    nombre: 'Procesos Formativos Permanentes',
    programa_codigo: 'EDUPER',
    orden: 3,
    descripcion: 'Programas continuos modulares de fortalecimiento comunitario.',
    activo: true,
  },
  // CEE
  {
    id: 'niv-cee-1',
    nombre: 'Atención Curricular Inclusiva',
    programa_codigo: 'CEE',
    orden: 1,
    descripcion: 'Procesos de integración adaptativa para personas con necesidades especiales.',
    activo: true,
  },
];

const KEY_PROGRAMAS = 'cea_programas_v2';
const KEY_SUBPROGRAMAS = 'cea_subprogramas_v2';
const KEY_CARRERAS = 'cea_carreras_v2';
const KEY_ETAPAS = 'cea_etapas_v2';
const KEY_NIVELES = 'cea_niveles_v2';
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

// SUBPROGRAMAS
export function getLocalSubprogramas(): Subprograma[] {
  try {
    const raw = localStorage.getItem(KEY_SUBPROGRAMAS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Error al leer subprogramas locales:', e);
  }
  return INITIAL_SUBPROGRAMAS;
}

export function saveLocalSubprogramas(list: Subprograma[]): void {
  try {
    localStorage.setItem(KEY_SUBPROGRAMAS, JSON.stringify(list));
    notifyAcademicChanged();
  } catch (e) {
    console.warn('Error al guardar subprogramas locales:', e);
  }
}

// CARRERAS TECNICAS (ETA)
export function getLocalCarreras(): CarreraTecnica[] {
  try {
    const raw = localStorage.getItem(KEY_CARRERAS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Error al leer carreras locales:', e);
  }
  return INITIAL_CARRERAS;
}

export function saveLocalCarreras(list: CarreraTecnica[]): void {
  try {
    localStorage.setItem(KEY_CARRERAS, JSON.stringify(list));
    notifyAcademicChanged();
  } catch (e) {
    console.warn('Error al guardar carreras locales:', e);
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

export async function loadSubprogramasFromSupabase(): Promise<Subprograma[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('subprogramas')
        .select('*, programas(codigo, nombre)')
        .order('codigo', { ascending: true });

      if (!error && data && data.length > 0) {
        const mapped: Subprograma[] = data.map((item: any) => ({
          id: item.id,
          programa_id: item.programa_id,
          programa_codigo: item.programas?.codigo || 'EPJA',
          codigo: item.codigo,
          nombre: item.nombre,
          descripcion: item.descripcion,
          activo: item.activo ?? true,
          created_at: item.created_at,
        }));
        saveLocalSubprogramas(mapped);
        return mapped;
      }
    } catch (e) {
      console.warn('Error al obtener subprogramas de Supabase:', e);
    }
  }
  return getLocalSubprogramas();
}

export async function loadCarrerasFromSupabase(): Promise<CarreraTecnica[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('carreras')
        .select('*')
        .order('nombre', { ascending: true });

      if (!error && data && data.length > 0) {
        const mapped: CarreraTecnica[] = data.map((item: any) => ({
          id: item.id,
          subprograma_id: item.subprograma_id,
          programa_codigo: 'ETA',
          codigo: item.codigo,
          nombre: item.nombre,
          descripcion: item.descripcion,
          activo: item.activo ?? true,
          created_at: item.created_at,
        }));
        saveLocalCarreras(mapped);
        return mapped;
      }
    } catch (e) {
      console.warn('Error al obtener carreras de Supabase:', e);
    }
  }
  return getLocalCarreras();
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
        .order('orden', { ascending: true });

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
