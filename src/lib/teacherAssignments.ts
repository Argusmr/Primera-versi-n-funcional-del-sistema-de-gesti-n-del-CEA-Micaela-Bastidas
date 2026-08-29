import { AsignacionDocente, Grupo, Perfil } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';
import { registrarAuditoria } from './audit';
import { getBoliviaTodayDate } from './geo';
import { INITIAL_GRUPOS, MOCK_DOCENTES } from './mockData';

const STORAGE_KEY = 'cea_asignaciones_docentes_oficiales_v2';

export const INITIAL_ASIGNACIONES: AsignacionDocente[] = [
  {
    id: 'asig-1',
    docente_id: 'usr-doc-1',
    grupo_id: 'grp-1',
    materia: 'Lenguaje y Comunicación',
    programa_codigo: 'EPJA',
    subprograma_codigo: 'ESA',
    etapa_nombre: 'Aprendizajes Complementarios',
    nivel_nombre: 'Aprendizajes Complementarios',
    carrera_nombre: 'Humanidades & EPJA',
    sede_id: 'sede-1',
    sede_nombre: 'Sede Poroma',
    grupo_nombre: 'EPJA Nivel Secundario Avanzado - Poroma',
    docente_nombre: 'Lic. Elena Ramos Mamani',
    estado: 'activo',
    activo: true,
    fecha_inicio: '2026-07-27',
    gestion: 2026,
    observacion: 'Asignación regular titular Segundo Semestre 2026.',
    created_at: '2026-07-27T08:00:00Z'
  },
  {
    id: 'asig-2',
    docente_id: 'usr-doc-1',
    grupo_id: 'grp-1',
    materia: 'Ciencias Sociales',
    programa_codigo: 'EPJA',
    subprograma_codigo: 'ESA',
    etapa_nombre: 'Aprendizajes Especializados',
    nivel_nombre: 'Aprendizajes Especializados',
    carrera_nombre: 'Humanidades & EPJA',
    sede_id: 'sede-1',
    sede_nombre: 'Sede Poroma',
    grupo_nombre: 'EPJA Nivel Secundario Avanzado - Poroma',
    docente_nombre: 'Lic. Elena Ramos Mamani',
    estado: 'activo',
    activo: true,
    fecha_inicio: '2026-07-27',
    gestion: 2026,
    observacion: 'Carga complementaria nocturna.',
    created_at: '2026-07-27T08:00:00Z'
  },
  {
    id: 'asig-3',
    docente_id: 'usr-doc-2',
    grupo_id: 'grp-2',
    materia: 'Computación e Informática Básica',
    programa_codigo: 'ETA',
    carrera_nombre: 'Sistemas Informáticos',
    nivel_nombre: 'Técnico Básico',
    sede_id: 'sede-2',
    sede_nombre: 'Sede San Juan de Horcas',
    grupo_nombre: 'Sistemas e Informática - S.J. Horcas',
    docente_nombre: 'Ing. Roberto Condori Quispe',
    estado: 'activo',
    activo: true,
    fecha_inicio: '2026-07-27',
    gestion: 2026,
    observacion: 'Módulo de Ofimática e Introducción al Hardware.',
    created_at: '2026-07-27T08:00:00Z'
  },
  {
    id: 'asig-4',
    docente_id: 'usr-doc-2',
    grupo_id: 'grp-2',
    materia: 'Operación de Maquinaria y Sistemas',
    programa_codigo: 'ETA',
    carrera_nombre: 'Sistemas Informáticos',
    nivel_nombre: 'Técnico Medio',
    sede_id: 'sede-2',
    sede_nombre: 'Sede San Juan de Horcas',
    grupo_nombre: 'Sistemas e Informática - S.J. Horcas',
    docente_nombre: 'Ing. Roberto Condori Quispe',
    estado: 'activo',
    activo: true,
    fecha_inicio: '2026-07-27',
    gestion: 2026,
    observacion: 'Módulo de Titulación y Proyectos Socioproductivos.',
    created_at: '2026-07-27T08:00:00Z'
  },
  {
    id: 'asig-5',
    docente_id: 'usr-doc-2',
    grupo_id: 'grp-2',
    materia: 'Redes y Mantenimiento Técnico',
    programa_codigo: 'ETA',
    carrera_nombre: 'Sistemas Informáticos',
    nivel_nombre: 'Técnico Auxiliar',
    sede_id: 'sede-2',
    sede_nombre: 'Sede San Juan de Horcas',
    grupo_nombre: 'Sistemas e Informática - S.J. Horcas',
    docente_nombre: 'Ing. Roberto Condori Quispe',
    estado: 'inactivo',
    activo: false,
    fecha_inicio: '2026-02-05',
    fecha_fin: '2026-07-20',
    motivo_cambio: 'Finalización de semestre y promoción de estudiantes al nivel Técnico Medio.',
    gestion: 2026,
    observacion: 'Historial académico concluido satisfactoriamente.',
    created_at: '2026-02-05T08:00:00Z'
  },
  {
    id: 'asig-6',
    docente_id: 'usr-doc-3',
    grupo_id: 'grp-3',
    materia: 'Corte y Confección',
    programa_codigo: 'EDUPER',
    carrera_nombre: 'Textiles y Confección',
    nivel_nombre: 'Técnico Básico',
    sede_id: 'sede-1',
    sede_nombre: 'Sede Poroma',
    grupo_nombre: 'Corte y Confección Comunitaria - Poroma',
    docente_nombre: 'Prof. Carmen Torrez Salazar',
    estado: 'activo',
    activo: true,
    fecha_inicio: '2026-07-27',
    gestion: 2026,
    observacion: 'Taller productivo comunitario para mujeres del municipio.',
    created_at: '2026-07-27T08:00:00Z'
  }
];

export function notifyAssignmentsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('asignaciones-docentes-changed'));
  }
}

export function getLocalAsignaciones(): AsignacionDocente[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_ASIGNACIONES));
      return INITIAL_ASIGNACIONES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_ASIGNACIONES;
  } catch (e) {
    console.warn('Error leyendo asignaciones locales:', e);
    return INITIAL_ASIGNACIONES;
  }
}

export function saveLocalAsignaciones(list: AsignacionDocente[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    notifyAssignmentsChanged();
  } catch (e) {
    console.warn('Error guardando asignaciones locales:', e);
  }
}

// Cargar todas las asignaciones para un docente específico
export async function loadAsignacionesForDocente(docenteId: string): Promise<AsignacionDocente[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('asignaciones_docentes')
        .select(`
          *,
          grupos (
            id,
            nombre,
            carrera_especialidad,
            nivel,
            sede_id,
            activo,
            sedes (
              id,
              nombre
            ),
            programas (
              id,
              nombre,
              codigo
            )
          ),
          perfiles:docente_id (
            id,
            nombre_completo,
            ci,
            rda
          )
        `)
        .eq('docente_id', docenteId)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const mapped: AsignacionDocente[] = data.map((item: any) => {
          const g = item.grupos;
          const p = item.perfiles;
          const isActivo = item.activo !== false && item.estado !== 'inactivo';

          return {
            id: item.id,
            docente_id: item.docente_id,
            grupo_id: item.grupo_id,
            materia: item.materia || g?.carrera_especialidad || 'Docencia General',
            programa_id: item.programa_id || g?.programa_id,
            programa_codigo: item.programa_codigo || g?.programas?.codigo || 'EPJA',
            subprograma_id: item.subprograma_id,
            subprograma_codigo: item.subprograma_codigo,
            carrera_id: item.carrera_id,
            carrera_nombre: item.carrera_nombre || g?.carrera_especialidad,
            etapa_id: item.etapa_id,
            etapa_nombre: item.etapa_nombre,
            nivel_id: item.nivel_id,
            nivel_nombre: item.nivel_nombre || g?.nivel,
            sede_id: item.sede_id || g?.sede_id,
            sede_nombre: item.sede_nombre || g?.sedes?.nombre,
            estado: isActivo ? 'activo' : 'inactivo',
            activo: isActivo,
            fecha_inicio: item.fecha_inicio || item.created_at?.slice(0, 10) || '2026-07-27',
            fecha_fin: item.fecha_fin || undefined,
            motivo_cambio: item.motivo_cambio || undefined,
            observacion: item.observacion || undefined,
            gestion: item.gestion || 2026,
            created_at: item.created_at,
            updated_at: item.updated_at,
            grupo_nombre: g?.nombre || 'Grupo sin nombre',
            docente_nombre: p?.nombre_completo || 'Docente'
          };
        });

        // Actualizar cache local para este docente
        const currentLocal = getLocalAsignaciones();
        const otherDocs = currentLocal.filter(a => a.docente_id !== docenteId);
        saveLocalAsignaciones([...otherDocs, ...mapped]);

        return mapped;
      }
    } catch (err) {
      console.warn('Fallo cargando asignaciones desde Supabase, usando local:', err);
    }
  }

  // Fallback local
  const local = getLocalAsignaciones();
  return local.filter(a => a.docente_id === docenteId);
}

// Cargar todas las asignaciones activas de todos los docentes
export async function loadAllActiveAsignaciones(): Promise<AsignacionDocente[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('asignaciones_docentes')
        .select(`
          *,
          grupos (
            id,
            nombre,
            carrera_especialidad,
            nivel,
            sede_id,
            sedes (id, nombre),
            programas (id, nombre, codigo)
          ),
          perfiles:docente_id (id, nombre_completo)
        `)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const mapped: AsignacionDocente[] = data
          .map((item: any) => {
            const g = item.grupos;
            const p = item.perfiles;
            const isActivo = item.activo !== false && item.estado !== 'inactivo';

            return {
              id: item.id,
              docente_id: item.docente_id,
              grupo_id: item.grupo_id,
              materia: item.materia || g?.carrera_especialidad || 'Docencia General',
              programa_id: item.programa_id || g?.programa_id,
              programa_codigo: item.programa_codigo || g?.programas?.codigo || 'EPJA',
              subprograma_id: item.subprograma_id,
              subprograma_codigo: item.subprograma_codigo,
              carrera_id: item.carrera_id,
              carrera_nombre: item.carrera_nombre || g?.carrera_especialidad,
              etapa_id: item.etapa_id,
              etapa_nombre: item.etapa_nombre,
              nivel_id: item.nivel_id,
              nivel_nombre: item.nivel_nombre || g?.nivel,
              sede_id: item.sede_id || g?.sede_id,
              sede_nombre: item.sede_nombre || g?.sedes?.nombre,
              estado: isActivo ? 'activo' : 'inactivo',
              activo: isActivo,
              fecha_inicio: item.fecha_inicio || item.created_at?.slice(0, 10) || '2026-07-27',
              fecha_fin: item.fecha_fin || undefined,
              motivo_cambio: item.motivo_cambio || undefined,
              observacion: item.observacion || undefined,
              gestion: item.gestion || 2026,
              created_at: item.created_at,
              updated_at: item.updated_at,
              grupo_nombre: g?.nombre || 'Grupo sin nombre',
              docente_nombre: p?.nombre_completo || 'Docente'
            };
          });

        saveLocalAsignaciones(mapped);
        return mapped;
      }
    } catch (err) {
      console.warn('Error al cargar todas las asignaciones de Supabase:', err);
    }
  }

  return getLocalAsignaciones();
}

// Validaciones académicas estrictas según la normativa boliviana
export function validateAcademicAssignment(asig: Partial<AsignacionDocente>): { valid: boolean; error?: string } {
  if (!asig.docente_id) {
    return { valid: false, error: 'El docente es obligatorio.' };
  }
  if (!asig.programa_codigo) {
    return { valid: false, error: 'El programa educativo es obligatorio.' };
  }
  if (!asig.materia || !asig.materia.trim()) {
    return { valid: false, error: 'El nombre de la materia o módulo formativo es obligatorio.' };
  }

  // 1. Validación de EPJA (EPA vs ESA)
  if (asig.programa_codigo === 'EPJA') {
    if (asig.subprograma_codigo === 'EPA') {
      const allowedEpa = ['Aprendizajes Elementales', 'Aprendizajes Avanzados'];
      if (asig.etapa_nombre && !allowedEpa.includes(asig.etapa_nombre)) {
        return {
          valid: false,
          error: 'EPA (Primaria Adultos) solo admite Aprendizajes Elementales o Avanzados. No mezcle etapas secundarias o niveles técnicos.'
        };
      }
      if (asig.nivel_nombre && ['Técnico Básico', 'Técnico Auxiliar', 'Técnico Medio'].includes(asig.nivel_nombre)) {
        return {
          valid: false,
          error: 'No se puede asignar un nivel técnico de ETA (Técnico Medio/Básico) a la Educación Primaria (EPA).'
        };
      }
    }

    if (asig.subprograma_codigo === 'ESA') {
      const allowedEsa = ['Aprendizajes Aplicados', 'Aprendizajes Complementarios', 'Aprendizajes Especializados'];
      if (asig.etapa_nombre && !allowedEsa.includes(asig.etapa_nombre)) {
        return {
          valid: false,
          error: 'ESA (Secundaria Adultos) solo admite Aprendizajes Aplicados, Complementarios o Especializados.'
        };
      }
      if (asig.nivel_nombre && ['Técnico Básico', 'Técnico Auxiliar', 'Técnico Medio'].includes(asig.nivel_nombre)) {
        return {
          valid: false,
          error: 'No se puede asignar un nivel técnico de ETA como etapa de Secundaria EPJA.'
        };
      }
    }
  }

  // 2. Validación de ETA (Educación Técnica Alternativa)
  if (asig.programa_codigo === 'ETA') {
    if (!asig.carrera_nombre || !asig.carrera_nombre.trim()) {
      return { valid: false, error: 'Debe seleccionar una Carrera Técnica válida para el programa ETA (Ej. Sistemas Informáticos, Gastronomía).' };
    }
    const allowedEtaLevels = ['Técnico Básico', 'Técnico Auxiliar', 'Técnico Medio'];
    if (asig.nivel_nombre && !allowedEtaLevels.includes(asig.nivel_nombre)) {
      return {
        valid: false,
        error: 'Las carreras de ETA solo admiten los niveles de certificación: Técnico Básico, Técnico Auxiliar o Técnico Medio. No mezcle etapas humanísticas EPJA.'
      };
    }
    if (asig.etapa_nombre && ['Aprendizajes Elementales', 'Aprendizajes Avanzados', 'Aprendizajes Aplicados', 'Aprendizajes Complementarios', 'Aprendizajes Especializados'].includes(asig.etapa_nombre)) {
      return {
        valid: false,
        error: 'No se pueden asignar etapas humanísticas de EPJA (EPA/ESA) a carreras técnicas de ETA.'
      };
    }
  }

  return { valid: true };
}

// Crear o Asignar Carga Académica con validación de no duplicidad activa
export async function createAcademicAssignment(
  asigData: Omit<AsignacionDocente, 'id' | 'created_at'>,
  currentUser?: Perfil
): Promise<{ success: boolean; data?: AsignacionDocente; error?: string }> {
  // 1. Validar reglas académicas
  const val = validateAcademicAssignment(asigData);
  if (!val.valid) {
    return { success: false, error: val.error };
  }

  // 2. Validar que no exista asignación activa duplicada para el mismo docente y grupo/materia
  const currentList = getLocalAsignaciones();
  const duplicate = currentList.find(
    a =>
      a.docente_id === asigData.docente_id &&
      a.grupo_id === asigData.grupo_id &&
      a.materia.trim().toLowerCase() === asigData.materia.trim().toLowerCase() &&
      a.activo !== false &&
      a.estado !== 'inactivo'
  );

  if (duplicate) {
    return {
      success: false,
      error: `El docente ya tiene una asignación activa para el grupo "${asigData.grupo_nombre || 'seleccionado'}" en la materia/módulo "${asigData.materia}". Para reasignar, desactive primero la asignación vigente.`
    };
  }

  const newId = `asig-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const fullAsig: AsignacionDocente = {
    ...asigData,
    id: newId,
    estado: 'activo',
    activo: true,
    fecha_inicio: asigData.fecha_inicio || getBoliviaTodayDate(),
    gestion: asigData.gestion || 2026,
    created_at: new Date().toISOString()
  };

  // 3. Persistir en Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      // Primero asegurar que el registro base en asignaciones_docentes se inserte
      const payload: Record<string, any> = {
        docente_id: fullAsig.docente_id,
        grupo_id: fullAsig.grupo_id,
        materia: fullAsig.materia,
        activo: true,
        estado: 'activo',
        fecha_inicio: fullAsig.fecha_inicio,
        programa_codigo: fullAsig.programa_codigo,
        subprograma_codigo: fullAsig.subprograma_codigo || null,
        carrera_nombre: fullAsig.carrera_nombre || null,
        etapa_nombre: fullAsig.etapa_nombre || null,
        nivel_nombre: fullAsig.nivel_nombre || null,
        sede_id: fullAsig.sede_id || null,
        observacion: fullAsig.observacion || null,
        gestion: fullAsig.gestion || 2026
      };

      const { data, error } = await supabase
        .from('asignaciones_docentes')
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.warn('Error al insertar asignación completa en Supabase, intentando inserción básica:', error);
        // Reintentar solo con columnas base si no tiene las columnas adicionales en Supabase
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('asignaciones_docentes')
          .insert([{
            docente_id: fullAsig.docente_id,
            grupo_id: fullAsig.grupo_id,
            materia: fullAsig.materia
          }])
          .select()
          .single();

        if (fallbackError) {
          throw fallbackError;
        }
        if (fallbackData) {
          fullAsig.id = fallbackData.id;
        }
      } else if (data) {
        fullAsig.id = data.id;
      }
    } catch (e: any) {
      console.warn('Excepción al guardar en Supabase:', e);
      // Continuamos guardando localmente para que el usuario no pierda el trabajo
    }
  }

  // 4. Guardar localmente
  const updatedList = [fullAsig, ...currentList];
  saveLocalAsignaciones(updatedList);

  // 5. Auditoría institucional
  registrarAuditoria({
    usuario_id: currentUser?.id || 'usr-director',
    usuario_nombre: currentUser?.nombre_completo || 'Director Institucional',
    usuario_rol: currentUser?.rol || 'superadmin',
    accion: 'CREAR_ASIGNACION',
    tabla_afectada: 'asignaciones_docentes',
    registro_afectado_id: fullAsig.id,
    valor_anterior: null,
    valor_nuevo: {
      docente_id: fullAsig.docente_id,
      docente_nombre: fullAsig.docente_nombre,
      materia: fullAsig.materia,
      programa_codigo: fullAsig.programa_codigo,
      carrera_nombre: fullAsig.carrera_nombre,
      nivel_nombre: fullAsig.nivel_nombre,
      etapa_nombre: fullAsig.etapa_nombre,
      grupo_id: fullAsig.grupo_id
    },
    motivo_registro: `Asignación académica creada: Docente ${fullAsig.docente_nombre || fullAsig.docente_id} en ${fullAsig.programa_codigo} / ${fullAsig.carrera_nombre || fullAsig.subprograma_codigo || ''} - ${fullAsig.nivel_nombre || fullAsig.etapa_nombre || ''} (Materia: ${fullAsig.materia}).`
  });

  return { success: true, data: fullAsig };
}

// Desactivar Asignación Docente (Pasa a inactivo en el historial, guarda fecha_fin y motivo_cambio)
export async function deactivateAcademicAssignment(
  asignacionId: string,
  fechaFin: string,
  motivoCambio: string,
  currentUser?: Perfil
): Promise<{ success: boolean; error?: string }> {
  if (!motivoCambio || !motivoCambio.trim()) {
    return { success: false, error: 'Debe ingresar el motivo institucional de la desactivación o cambio.' };
  }

  const currentList = getLocalAsignaciones();
  const target = currentList.find(a => a.id === asignacionId);
  if (!target) {
    return { success: false, error: 'No se encontró la asignación especificada.' };
  }

  const nowIso = new Date().toISOString();
  const effectiveFechaFin = fechaFin || nowIso.slice(0, 10);

  // 1. Intentar actualizar en Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('asignaciones_docentes')
        .update({
          activo: false,
          estado: 'inactivo',
          fecha_fin: effectiveFechaFin,
          motivo_cambio: motivoCambio.trim(),
          updated_at: nowIso
        })
        .eq('id', asignacionId);

      if (error) {
        console.warn('Error al actualizar estado en Supabase (puede que falten columnas, se persiste localmente):', error.message);
      }
    } catch (e) {
      console.warn('Excepción al desactivar en Supabase:', e);
    }
  }

  // 2. Actualizar estado local (No borrar físicamente)
  const updatedList = currentList.map(a => {
    if (a.id === asignacionId) {
      return {
        ...a,
        activo: false,
        estado: 'inactivo' as const,
        fecha_fin: effectiveFechaFin,
        motivo_cambio: motivoCambio.trim(),
        updated_at: nowIso
      };
    }
    return a;
  });

  saveLocalAsignaciones(updatedList);

  // 3. Auditoría institucional
  registrarAuditoria({
    usuario_id: currentUser?.id || 'usr-director',
    usuario_nombre: currentUser?.nombre_completo || 'Director Institucional',
    usuario_rol: currentUser?.rol || 'superadmin',
    accion: 'DESACTIVAR_ASIGNACION',
    tabla_afectada: 'asignaciones_docentes',
    registro_afectado_id: asignacionId,
    valor_anterior: { activo: true, estado: 'activo' },
    valor_nuevo: { activo: false, estado: 'inactivo', fecha_fin: effectiveFechaFin, motivo_cambio: motivoCambio },
    motivo_registro: `Asignación ${asignacionId} de ${target.docente_nombre || target.docente_id} desactivada. Motivo: ${motivoCambio}. Fecha de cese: ${effectiveFechaFin}.`
  });

  return { success: true };
}

// Editar Asignación Académica Activa (Materia, Observación, etc.)
export async function updateAcademicAssignment(
  asignacionId: string,
  updates: Partial<AsignacionDocente>,
  currentUser?: Perfil
): Promise<{ success: boolean; error?: string }> {
  const currentList = getLocalAsignaciones();
  const target = currentList.find(a => a.id === asignacionId);
  if (!target) {
    return { success: false, error: 'No se encontró la asignación a editar.' };
  }

  // Validar reglas si se cambiaron campos curriculares
  const merged: AsignacionDocente = { ...target, ...updates };
  const val = validateAcademicAssignment(merged);
  if (!val.valid) {
    return { success: false, error: val.error };
  }

  const nowIso = new Date().toISOString();

  // Actualizar en Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      const payload: Record<string, any> = {
        materia: merged.materia,
        observacion: merged.observacion || null,
        fecha_inicio: merged.fecha_inicio || target.fecha_inicio,
        updated_at: nowIso
      };

      if (updates.carrera_nombre) payload.carrera_nombre = updates.carrera_nombre;
      if (updates.nivel_nombre) payload.nivel_nombre = updates.nivel_nombre;
      if (updates.etapa_nombre) payload.etapa_nombre = updates.etapa_nombre;

      await supabase
        .from('asignaciones_docentes')
        .update(payload)
        .eq('id', asignacionId);
    } catch (e) {
      console.warn('Error al actualizar asignación en Supabase:', e);
    }
  }

  // Actualizar localmente
  const updatedList = currentList.map(a => {
    if (a.id === asignacionId) {
      return {
        ...a,
        ...updates,
        updated_at: nowIso
      };
    }
    return a;
  });

  saveLocalAsignaciones(updatedList);

  // Auditoría
  registrarAuditoria({
    usuario_id: currentUser?.id || 'usr-director',
    usuario_nombre: currentUser?.nombre_completo || 'Director Institucional',
    usuario_rol: currentUser?.rol || 'superadmin',
    accion: 'EDITAR_ASIGNACION',
    tabla_afectada: 'asignaciones_docentes',
    registro_afectado_id: asignacionId,
    valor_anterior: { materia: target.materia, observacion: target.observacion },
    valor_nuevo: { materia: merged.materia, observacion: merged.observacion },
    motivo_registro: `Asignación ${asignacionId} modificada para ${target.docente_nombre || target.docente_id}: Materia ${merged.materia}.`
  });

  return { success: true };
}
