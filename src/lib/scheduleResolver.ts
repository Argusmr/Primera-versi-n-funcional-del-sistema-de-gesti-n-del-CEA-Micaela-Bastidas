import { AsignacionDocente, Horario, Perfil, Sede } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';
import { INITIAL_HORARIOS, INITIAL_SEDES } from './mockData';
import { loadAsignacionesForDocente } from './teacherAssignments';

export interface SedeHorarioResuelto {
  sede: Sede | null;
  horario: Horario | null;
  fuente: 'asignacion_activa' | 'perfil' | 'ninguna';
}

/**
 * Resuelve la Sede y Horario de trabajo oficial de un docente siguiendo la regla estricta:
 * 
 * Prioridad 1:
 *   asignaciones_docentes (activas) -> grupo_id -> grupos.sede_id -> sedes -> horarios (para esa sede_id)
 * 
 * Prioridad 2:
 *   Si no hay asignación activa:
 *   perfiles.sede_id -> sedes
 *   perfiles.horario_id -> horarios
 * 
 * Regla:
 *   NUNCA usar valores por defecto/hardcodeados como "Sede Poroma", 18:30 o 22:00.
 *   Si no existe sede u horario, retorna null para mostrar "Sin horario asignado. Consulte con Dirección".
 */
export async function resolverSedeYHorarioDocente(docente: Perfil): Promise<SedeHorarioResuelto> {
  try {
    // -------------------------------------------------------------------------
    // PRIORIDAD 1: Buscar en asignaciones_docentes activas
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

      // Si tenemos resolvedSedeId, cargar la sede y su horario
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

        // Cargar Horario asociado a la sede (o al perfil si pertenece a la misma sede)
        if (isSupabaseConfigured && supabase) {
          try {
            // Intentar primero con el horario específico del docente si coincide con la sede
            if (docente.horario_id) {
              const { data: hData } = await supabase
                .from('horarios')
                .select('*')
                .eq('id', docente.horario_id)
                .eq('sede_id', resolvedSedeId)
                .eq('activo', true)
                .maybeSingle();
              if (hData) resolvedHorario = hData as Horario;
            }

            // Si no, buscar el primer horario activo de esa sede
            if (!resolvedHorario) {
              const { data: hList } = await supabase
                .from('horarios')
                .select('*')
                .eq('sede_id', resolvedSedeId)
                .eq('activo', true)
                .order('es_invierno', { ascending: true }) // preferir habitual
                .limit(1);
              if (hList && hList.length > 0) {
                resolvedHorario = hList[0] as Horario;
              }
            }
          } catch (e) {
            console.warn('Error cargando horario desde Supabase:', e);
          }
        }

        // Fallback local mock para horario
        if (!resolvedHorario) {
          if (docente.horario_id) {
            resolvedHorario = INITIAL_HORARIOS.find(h => h.id === docente.horario_id && h.sede_id === resolvedSedeId && h.activo) || null;
          }
          if (!resolvedHorario) {
            resolvedHorario = INITIAL_HORARIOS.find(h => h.sede_id === resolvedSedeId && h.activo) || null;
          }
        }

        if (resolvedSede || resolvedHorario) {
          return {
            sede: resolvedSede,
            horario: resolvedHorario,
            fuente: 'asignacion_activa'
          };
        }
      }
    }

    // -------------------------------------------------------------------------
    // PRIORIDAD 2: Perfil del Docente (perfiles.sede_id y perfiles.horario_id)
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
      // Buscar por nombre exacto si no vino el ID
      perfilSede = INITIAL_SEDES.find(s => s.nombre.toLowerCase().includes(docente.sede_nombre!.toLowerCase())) || null;
    }

    if (docente.horario_id) {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: hData } = await supabase
            .from('horarios')
            .select('*')
            .eq('id', docente.horario_id)
            .maybeSingle();
          if (hData) perfilHorario = hData as Horario;
        } catch (e) {
          console.warn('Error cargando horario del perfil desde Supabase:', e);
        }
      }
      if (!perfilHorario) {
        perfilHorario = INITIAL_HORARIOS.find(h => h.id === docente.horario_id) || null;
      }
    } else if (perfilSede) {
      // Si tiene sede pero no horario_id, buscar horario de esa sede
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: hList } = await supabase
            .from('horarios')
            .select('*')
            .eq('sede_id', perfilSede.id)
            .eq('activo', true)
            .limit(1);
          if (hList && hList.length > 0) {
            perfilHorario = hList[0] as Horario;
          }
        } catch (e) {
          console.warn('Error buscando horario de sede perfil:', e);
        }
      }
      if (!perfilHorario) {
        perfilHorario = INITIAL_HORARIOS.find(h => h.sede_id === perfilSede!.id && h.activo) || null;
      }
    }

    if (perfilSede || perfilHorario) {
      return {
        sede: perfilSede,
        horario: perfilHorario,
        fuente: 'perfil'
      };
    }

    // -------------------------------------------------------------------------
    // SIN ASIGNACIÓN: Retornar null (NUNCA usar valores por defecto de Poroma)
    // -------------------------------------------------------------------------
    return {
      sede: null,
      horario: null,
      fuente: 'ninguna'
    };
  } catch (error) {
    console.error('Error al resolver sede y horario del docente:', error);
    return {
      sede: null,
      horario: null,
      fuente: 'ninguna'
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
