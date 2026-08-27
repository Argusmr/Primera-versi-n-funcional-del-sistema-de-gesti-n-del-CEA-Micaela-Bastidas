import { AsignacionDocente, Horario, Perfil, Sede, DatosInstitucionales, DocenteHorario } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';
import { INITIAL_HORARIOS, INITIAL_SEDES, INITIAL_DOCENTES_HORARIOS } from './mockData';
import { loadAsignacionesForDocente } from './teacherAssignments';
import { loadDatosInstitucionales, saveDatosInstitucionales, getLocalDatosInstitucionales } from './institutional';

export type TemporadaInstitucional = 'invierno' | 'verano';

export interface SedeHorarioResuelto {
  sede: Sede | null;
  horario: Horario | null;
  fuente: 'docente_horario' | 'asignacion_activa' | 'perfil' | 'ninguna';
  temporada: TemporadaInstitucional;
  dia_consultado?: string;
}

// Clave localStorage para persistencia offline de docentes_horarios
const LOCAL_DOCENTES_HORARIOS_KEY = 'cea_docentes_horarios_v1';

export function getLocalDocentesHorarios(): DocenteHorario[] {
  try {
    const raw = localStorage.getItem(LOCAL_DOCENTES_HORARIOS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Error leyendo docentes_horarios de localStorage:', e);
  }
  return INITIAL_DOCENTES_HORARIOS;
}

export function saveLocalDocentesHorarios(list: DocenteHorario[]): void {
  try {
    localStorage.setItem(LOCAL_DOCENTES_HORARIOS_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Error guardando docentes_horarios en localStorage:', e);
  }
}

/**
 * Carga los registros de docentes_horarios de un docente
 */
export async function loadDocentesHorarios(docenteId: string): Promise<DocenteHorario[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('docentes_horarios')
        .select(`
          *,
          sedes(nombre),
          horarios(nombre, hora_ingreso, tolerancia_hasta, hora_salida, es_invierno)
        `)
        .eq('docente_id', docenteId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        const mapped: DocenteHorario[] = data.map((dh: any) => ({
          id: dh.id,
          docente_id: dh.docente_id,
          horario_id: dh.horario_id,
          sede_id: dh.sede_id,
          dias_semana: Array.isArray(dh.dias_semana) ? dh.dias_semana : [],
          activo: dh.activo !== false,
          created_at: dh.created_at,
          updated_at: dh.updated_at,
          sede_nombre: dh.sedes?.nombre,
          horario_nombre: dh.horarios?.nombre,
          hora_ingreso: dh.horarios?.hora_ingreso,
          tolerancia_hasta: dh.horarios?.tolerancia_hasta,
          hora_salida: dh.horarios?.hora_salida,
          es_invierno: dh.horarios?.es_invierno,
        }));
        return mapped;
      }
    } catch (e) {
      console.warn('Error cargando docentes_horarios desde Supabase:', e);
    }
  }

  // Fallback a localStorage / mock
  const localList = getLocalDocentesHorarios();
  return localList.filter(dh => dh.docente_id === docenteId);
}

/**
 * Ajusta una hora en formato HH:mm sumando o restando minutos (ej: '22:00', -30 -> '21:30')
 */
export function ajustarHoraSalida(hora: string, deltaMinutos: number): string {
  if (!hora || !hora.includes(':')) return hora;
  const [hhStr, mmStr] = hora.split(':');
  let totalMin = parseInt(hhStr, 10) * 60 + parseInt(mmStr, 10) + deltaMinutos;
  if (totalMin < 0) totalMin += 24 * 60;
  totalMin = totalMin % (24 * 60);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * Determina la temporada institucional activa (Invierno o Verano/Habitual)
 * obtenida desde datos_institucionales.temporada_actual.
 */
export async function determinarTemporadaInstitucional(): Promise<TemporadaInstitucional> {
  try {
    const datos = await loadDatosInstitucionales();
    if (datos && (datos.temporada_actual === 'invierno' || datos.temporada_actual === 'verano')) {
      return datos.temporada_actual;
    }
  } catch (e) {
    console.warn('Error al verificar temporada institucional desde datos_institucionales:', e);
  }

  const local = getLocalDatosInstitucionales();
  return local.temporada_actual === 'invierno' ? 'invierno' : 'verano';
}

/**
 * Permite cambiar la temporada institucional activa y sincronizarla en datos_institucionales
 * sin alterar ni mutar los registros de la tabla horarios.
 */
export async function setTemporadaInstitucional(nuevaTemporada: TemporadaInstitucional): Promise<boolean> {
  try {
    const actual = getLocalDatosInstitucionales();
    const updated: DatosInstitucionales = {
      ...actual,
      temporada_actual: nuevaTemporada
    };
    const res = await saveDatosInstitucionales(updated);
    window.dispatchEvent(new CustomEvent('temporadaInstitucionalChanged', { detail: { temporada: nuevaTemporada } }));
    return res.success;
  } catch (e) {
    console.error('Error al actualizar temporada institucional:', e);
    return false;
  }
}

/**
 * Normaliza un nombre de día en español
 */
export function normalizarDiaSemana(dia: string): string {
  const d = (dia || '').toLowerCase().trim();
  if (d.startsWith('lun')) return 'lunes';
  if (d.startsWith('mar')) return 'martes';
  if (d.startsWith('mi')) return 'miércoles';
  if (d.startsWith('jue')) return 'jueves';
  if (d.startsWith('vie')) return 'viernes';
  if (d.startsWith('s')) return 'sábado';
  if (d.startsWith('d')) return 'domingo';
  return d;
}

/**
 * Obtiene el día actual de la semana en minúsculas en español (ej: 'lunes')
 */
export function getDiaActualSemana(): string {
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const now = new Date();
  return dias[now.getDay()];
}

/**
 * Resuelve el horario adecuado para una sede respetando el día actual y la temporada institucional activa.
 * 
 * Regla:
 * 1. Filtra los horarios de la sede aplicables al día consultado (o todos si no se pasa día).
 * 2. Si la temporada activa es invierno:
 *    a) Busca si la sede tiene un horario con es_invierno === true para ese día.
 *    b) Si existe, retorna el horario de invierno exacto.
 *    c) Si NO existe (ej: San Juan de Horcas), mantiene el horario regular (es_invierno === false).
 * 3. Si la temporada activa es verano/regular:
 *    Retorna el horario con es_invierno === false para ese día.
 * 4. Respaldo: si el docente tenía un horario_id específico asignado y no hay match por sede/día, lo utiliza.
 */
export function seleccionarHorarioParaTemporada(
  horariosSede: Horario[],
  temporada: TemporadaInstitucional,
  docenteHorarioId?: string,
  diaConsulta?: string
): Horario | null {
  if (!horariosSede || horariosSede.length === 0) return null;

  const diaActual = normalizarDiaSemana(diaConsulta || getDiaActualSemana());
  const esInvierno = temporada === 'invierno';

  // 1. Filtrar por día aplicable si está configurado en los horarios
  const horariosDelDia = horariosSede.filter(h => {
    if (!h.dias_semana || h.dias_semana.length === 0) return true;
    const diasNorm = h.dias_semana.map(normalizarDiaSemana);
    return diasNorm.includes(diaActual);
  });

  // Lista base a evaluar: primero los que corresponden al día, o todos los de la sede si ninguno coincide exactamente
  const pool = horariosDelDia.length > 0 ? horariosDelDia : horariosSede;

  // 2. Si es invierno:
  if (esInvierno) {
    const horarioInvierno = pool.find(h => Boolean(h.es_invierno) === true);
    if (horarioInvierno) {
      return horarioInvierno;
    }
    // Si no existe horario de invierno para esta sede/día (ej. San Juan de Horcas), mantiene horario regular
    const horarioRegularFallback = pool.find(h => !h.es_invierno);
    if (horarioRegularFallback) {
      return horarioRegularFallback;
    }
  } else {
    // Temporada Regular / Verano
    const horarioRegular = pool.find(h => !h.es_invierno);
    if (horarioRegular) {
      return horarioRegular;
    }
  }

  // 3. Respaldo por ID de horario asignado previamente al docente
  if (docenteHorarioId) {
    const docH = horariosSede.find(h => h.id === docenteHorarioId);
    if (docH) {
      return docH;
    }
  }

  // 4. Último recurso dentro de la sede: primer horario activo
  return pool[0] || horariosSede[0] || null;
}

/**
 * Resuelve la Sede y Horario de trabajo oficial de un docente siguiendo la regla estricta:
 * 
 * NUEVA PRIORIDAD (PASO 3):
 * 1. Buscar en docentes_horarios activos para el docente.
 * 2. Obtener el día actual (o día de consulta) y buscar la coincidencia donde dias_semana contenga ese día.
 * 3. Aplicar temporada institucional activa:
 *    - Si existe horario de invierno para esa sede/día, usarlo.
 *    - Si no existe (o si la temporada es verano), mantener el horario regular correspondiente.
 * 4. Si no existe configuración en docentes_horarios:
 *    Buscar en asignaciones_docentes activas (grupo_id -> grupos.sede_id -> sedes -> horarios).
 * 5. Si no existe asignación activa:
 *    Usar compatibilidad perfiles.sede_id y perfiles.horario_id.
 * 
 * Regla de No-Hardcoding:
 *   NUNCA usar valores por defecto/hardcodeados como "Sede Poroma", 18:30 o 22:00.
 *   Si no existe sede u horario, retorna null para mostrar "Sin horario asignado. Consulte con Dirección".
 */
export async function resolverSedeYHorarioDocente(docente: Perfil, diaConsulta?: string): Promise<SedeHorarioResuelto> {
  try {
    const diaActual = normalizarDiaSemana(diaConsulta || getDiaActualSemana());

    // -------------------------------------------------------------------------
    // PASO 1: Determinar temporada institucional activa
    // -------------------------------------------------------------------------
    const temporadaActiva = await determinarTemporadaInstitucional();

    // -------------------------------------------------------------------------
    // PASO 2: PRIORIDAD 1 - Buscar en docentes_horarios activos
    // -------------------------------------------------------------------------
    const docentesHorarios = await loadDocentesHorarios(docente.id);
    const dhActivos = docentesHorarios.filter(dh => dh.activo !== false);

    if (dhActivos.length > 0) {
      // Buscar el horario asignado que contenga el día actual
      const matchDia = dhActivos.find(dh => {
        if (!dh.dias_semana || dh.dias_semana.length === 0) return true;
        const normDias = dh.dias_semana.map(normalizarDiaSemana);
        return normDias.includes(diaActual);
      }) || dhActivos[0]; // Si no hay coincidencia exacta con el día, usar el primer horario activo del docente

      if (matchDia) {
        let resolvedSede: Sede | null = null;
        let resolvedHorario: Horario | null = null;

        // Cargar Sede
        if (matchDia.sede_id) {
          if (isSupabaseConfigured && supabase) {
            try {
              const { data: sData } = await supabase
                .from('sedes')
                .select('*')
                .eq('id', matchDia.sede_id)
                .maybeSingle();
              if (sData) resolvedSede = sData as Sede;
            } catch (e) {
              console.warn('Error cargando sede de docentes_horarios:', e);
            }
          }
          if (!resolvedSede) {
            resolvedSede = INITIAL_SEDES.find(s => s.id === matchDia.sede_id) || (matchDia.sede_nombre ? { id: matchDia.sede_id, nombre: matchDia.sede_nombre, activo: true } as Sede : null);
          }
        }

        // Cargar Horarios de la sede para evaluar temporada institucional activa
        let horariosSede: Horario[] = [];
        if (isSupabaseConfigured && supabase && matchDia.sede_id) {
          try {
            const { data: hList } = await supabase
              .from('horarios')
              .select('*')
              .eq('sede_id', matchDia.sede_id)
              .eq('activo', true);
            if (hList && hList.length > 0) {
              horariosSede = hList as Horario[];
            }
          } catch (e) {
            console.warn('Error cargando horarios de sede para docentes_horarios:', e);
          }
        }

        if (horariosSede.length === 0 && matchDia.sede_id) {
          horariosSede = INITIAL_HORARIOS.filter(h => h.sede_id === matchDia.sede_id && h.activo);
        }

        // Si tenemos el horario asignado exacto en matchDia
        if (matchDia.horario_id) {
          // Si es invierno, verificar si la sede tiene horario de invierno para este día
          if (temporadaActiva === 'invierno') {
            const hInvierno = horariosSede.find(h => h.es_invierno && (
              !h.dias_semana || h.dias_semana.length === 0 || h.dias_semana.map(normalizarDiaSemana).includes(diaActual)
            ));
            if (hInvierno) {
              resolvedHorario = hInvierno;
            }
          }
          
          if (!resolvedHorario) {
            const hExacto = horariosSede.find(h => h.id === matchDia.horario_id);
            if (hExacto) {
              resolvedHorario = hExacto;
            } else if (matchDia.hora_ingreso && matchDia.hora_salida) {
              resolvedHorario = {
                id: matchDia.horario_id,
                nombre: matchDia.horario_nombre || 'Horario Asignado',
                sede_id: matchDia.sede_id,
                hora_ingreso: matchDia.hora_ingreso,
                tolerancia_hasta: matchDia.tolerancia_hasta || matchDia.hora_ingreso,
                hora_salida: matchDia.hora_salida,
                es_invierno: Boolean(matchDia.es_invierno),
                dias_semana: matchDia.dias_semana,
                sede_nombre: matchDia.sede_nombre || resolvedSede?.nombre,
                activo: true,
              };
            }
          }
        }

        if (!resolvedHorario) {
          resolvedHorario = seleccionarHorarioParaTemporada(horariosSede, temporadaActiva, matchDia.horario_id, diaActual);
        }

        if (resolvedSede || resolvedHorario) {
          return {
            sede: resolvedSede,
            horario: resolvedHorario,
            fuente: 'docente_horario',
            temporada: temporadaActiva,
            dia_consultado: diaActual
          };
        }
      }
    }

    // -------------------------------------------------------------------------
    // PASO 3: PRIORIDAD 2 - Buscar en asignaciones_docentes activas
    // -------------------------------------------------------------------------
    const asignaciones = await loadAsignacionesForDocente(docente.id);
    const activas = asignaciones.filter(a => a.activo !== false && a.estado !== 'inactivo');

    if (activas.length > 0) {
      // Tomamos la asignación activa más reciente o vigente
      const asig = activas[0];
      let resolvedSedeId = asig.sede_id;
      let resolvedSede: Sede | null = null;
      let resolvedHorario: Horario | null = null;

      // Si la asignación tiene grupo_id pero no sede_id directa, buscar en grupos
      if (!resolvedSedeId && asig.grupo_id && isSupabaseConfigured && supabase) {
        try {
          const { data: grpData } = await supabase
            .from('grupos')
            .select('sede_id, sedes(*)')
            .eq('id', asig.grupo_id)
            .maybeSingle();

          if (grpData?.sede_id) {
            resolvedSedeId = grpData.sede_id;
            if (grpData.sedes) {
              resolvedSede = (Array.isArray(grpData.sedes) ? grpData.sedes[0] : grpData.sedes) as unknown as Sede;
            }
          }
        } catch (e) {
          console.warn('Error resolviendo grupo en Supabase:', e);
        }
      }

      // Si tenemos resolvedSedeId, cargar la sede y su horario correspondiente a la temporada
      if (resolvedSedeId) {
        // Cargar Sede si no la tenemos aún
        if (!resolvedSede) {
          if (isSupabaseConfigured && supabase) {
            try {
              const { data: sData } = await supabase
                .from('sedes')
                .select('*')
                .eq('id', resolvedSedeId)
                .maybeSingle();
              if (sData) resolvedSede = sData as Sede;
            } catch (e) {
              console.warn('Error cargando sede desde Supabase:', e);
            }
          }
          if (!resolvedSede) {
            resolvedSede = INITIAL_SEDES.find(s => s.id === resolvedSedeId) || null;
          }
        }

        // Cargar Horarios de la sede desde Supabase o mock
        let horariosSede: Horario[] = [];
        if (isSupabaseConfigured && supabase) {
          try {
            const { data: hList } = await supabase
              .from('horarios')
              .select('*')
              .eq('sede_id', resolvedSedeId)
              .eq('activo', true);
            if (hList && hList.length > 0) {
              horariosSede = hList as Horario[];
            }
          } catch (e) {
            console.warn('Error cargando horarios de sede desde Supabase:', e);
          }
        }

        if (horariosSede.length === 0) {
          horariosSede = INITIAL_HORARIOS.filter(h => h.sede_id === resolvedSedeId && h.activo);
        }

        resolvedHorario = seleccionarHorarioParaTemporada(horariosSede, temporadaActiva, docente.horario_id);

        if (resolvedSede || resolvedHorario) {
          return {
            sede: resolvedSede,
            horario: resolvedHorario,
            fuente: 'asignacion_activa',
            temporada: temporadaActiva
          };
        }
      }
    }

    // -------------------------------------------------------------------------
    // PASO 3: PRIORIDAD 2 - Perfil del Docente (perfiles.sede_id y perfiles.horario_id)
    // -------------------------------------------------------------------------
    let perfilSede: Sede | null = null;
    let perfilHorario: Horario | null = null;

    if (docente.sede_id) {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: sData } = await supabase
            .from('sedes')
            .select('*')
            .eq('id', docente.sede_id)
            .maybeSingle();
          if (sData) perfilSede = sData as Sede;
        } catch (e) {
          console.warn('Error cargando sede del perfil desde Supabase:', e);
        }
      }
      if (!perfilSede) {
        perfilSede = INITIAL_SEDES.find(s => s.id === docente.sede_id) || null;
      }
    } else if (docente.sede_nombre) {
      // Buscar por nombre si no vino el ID
      perfilSede = INITIAL_SEDES.find(s => s.nombre.toLowerCase().includes(docente.sede_nombre!.toLowerCase())) || null;
    }

    const targetSedeId = perfilSede?.id || docente.sede_id;

    if (targetSedeId) {
      let horariosSede: Horario[] = [];
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: hList } = await supabase
            .from('horarios')
            .select('*')
            .eq('sede_id', targetSedeId)
            .eq('activo', true);
          if (hList && hList.length > 0) {
            horariosSede = hList as Horario[];
          }
        } catch (e) {
          console.warn('Error buscando horarios para sede del perfil:', e);
        }
      }

      if (horariosSede.length === 0) {
        horariosSede = INITIAL_HORARIOS.filter(h => h.sede_id === targetSedeId && h.activo);
      }

      perfilHorario = seleccionarHorarioParaTemporada(horariosSede, temporadaActiva, docente.horario_id);
    } else if (docente.horario_id) {
      // Si solo tiene horario_id sin sede explícita
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: hData } = await supabase
            .from('horarios')
            .select('*')
            .eq('id', docente.horario_id)
            .maybeSingle();
          if (hData) {
            perfilHorario = seleccionarHorarioParaTemporada([hData as Horario], temporadaActiva, docente.horario_id);
          }
        } catch (e) {
          console.warn('Error cargando horario del perfil:', e);
        }
      }
      if (!perfilHorario) {
        const mockH = INITIAL_HORARIOS.find(h => h.id === docente.horario_id);
        if (mockH) {
          perfilHorario = seleccionarHorarioParaTemporada([mockH], temporadaActiva, docente.horario_id);
        }
      }
    }

    if (perfilSede || perfilHorario) {
      return {
        sede: perfilSede,
        horario: perfilHorario,
        fuente: 'perfil',
        temporada: temporadaActiva
      };
    }

    // -------------------------------------------------------------------------
    // SIN ASIGNACIÓN: Retornar null (NUNCA usar valores por defecto de Poroma)
    // -------------------------------------------------------------------------
    return {
      sede: null,
      horario: null,
      fuente: 'ninguna',
      temporada: temporadaActiva
    };
  } catch (error) {
    console.error('Error al resolver sede y horario del docente:', error);
    return {
      sede: null,
      horario: null,
      fuente: 'ninguna',
      temporada: 'verano'
    };
  }
}

/**
 * Calcula el minuto siguiente a la hora de tolerancia (ej: '16:40' -> '16:41')
 */
export function calcularInicioAtraso(toleranciaHasta?: string): string {
  if (!toleranciaHasta || !toleranciaHasta.includes(':')) {
    return '--:--';
  }
  const [hhStr, mmStr] = toleranciaHasta.split(':');
  let hh = parseInt(hhStr, 10);
  let mm = parseInt(mmStr, 10) + 1;
  if (mm >= 60) {
    mm = 0;
    hh = (hh + 1) % 24;
  }
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

