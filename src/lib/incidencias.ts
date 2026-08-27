import { IncidenciaAsistenciaDocente, EstadoIncidenciaAsistencia, Perfil, AsistenciaDocente } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';
import { registrarAuditoria } from './audit';
import { resolverSedeYHorarioDocente } from './scheduleResolver';
import { getBoliviaTodayDate } from './geo';

const LOCAL_INCIDENCIAS_KEY = 'cea_incidencias_asistencia_docente_v1';

/**
 * Obtiene las incidencias guardadas localmente en cache del cliente (sin datos ficticios).
 */
export function getLocalIncidencias(): IncidenciaAsistenciaDocente[] {
  try {
    const raw = localStorage.getItem(LOCAL_INCIDENCIAS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Error leyendo incidencias locales:', e);
  }
  return [];
}

/**
 * Persiste el cache local de incidencias
 */
export function saveLocalIncidencias(list: IncidenciaAsistenciaDocente[]): void {
  try {
    localStorage.setItem(LOCAL_INCIDENCIAS_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('incidenciasChanged', { detail: list }));
  } catch (e) {
    console.warn('Error guardando incidencias locales:', e);
  }
}

/**
 * Carga las incidencias de asistencia docente exclusivamente desde Supabase.
 * Si no existen registros en la base de datos, retorna un arreglo vacío [].
 */
export async function loadIncidenciasAsistencia(docenteId?: string): Promise<IncidenciaAsistenciaDocente[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase
        .from('incidencias_asistencia_docente')
        .select(`
          *,
          perfiles:docente_id (
            nombre_completo,
            rda,
            sede_nombre
          ),
          director:resuelto_por (
            nombre_completo
          )
        `)
        .order('fecha', { ascending: false });

      if (docenteId) {
        query = query.eq('docente_id', docenteId);
      }

      const { data, error } = await query;

      if (!error && data) {
        const mapped: IncidenciaAsistenciaDocente[] = data.map((inc: any) => ({
          id: inc.id,
          docente_id: inc.docente_id,
          fecha: inc.fecha,
          tipo_incidencia: inc.tipo_incidencia,
          estado: inc.estado,
          detalle: inc.detalle,
          resolucion: inc.resolucion,
          resuelto_por: inc.resuelto_por,
          fecha_resolucion: inc.fecha_resolucion,
          created_at: inc.created_at,
          docente_nombre: inc.perfiles?.nombre_completo,
          docente_rda: inc.perfiles?.rda,
          sede_nombre: inc.perfiles?.sede_nombre,
          resuelto_por_nombre: inc.director?.nombre_completo,
        }));

        saveLocalIncidencias(mapped);
        return mapped;
      } else if (error) {
        console.warn('Advertencia en consulta de incidencias en Supabase:', error.message);
      }
    } catch (e) {
      console.warn('Error al consultar incidencias en Supabase:', e);
    }
  }

  const local = getLocalIncidencias();
  if (docenteId) {
    return local.filter(inc => inc.docente_id === docenteId);
  }
  return local;
}

/**
 * Resuelve una incidencia de asistencia registrando obligatoriamente el log de auditoría
 */
export interface ResolverIncidenciaParams {
  incidenciaId: string;
  nuevoEstado: EstadoIncidenciaAsistencia; // 'justificado' | 'falta_confirmada' | 'corregido'
  motivoResolucion: string;
  directorUser: Perfil;
  observacionesAdicionales?: string;
}

export async function resolverIncidenciaAsistencia(
  params: ResolverIncidenciaParams
): Promise<{ success: boolean; data?: IncidenciaAsistenciaDocente; error?: string }> {
  const { incidenciaId, nuevoEstado, motivoResolucion, directorUser, observacionesAdicionales } = params;

  if (!motivoResolucion || !motivoResolucion.trim()) {
    return { success: false, error: 'El motivo de la resolución es obligatorio por normativa institucional.' };
  }

  const ahora = new Date().toISOString();
  const resolucionTexto = `${motivoResolucion.trim()}${observacionesAdicionales ? ` | Obs: ${observacionesAdicionales.trim()}` : ''}`;

  const currentLocalList = getLocalIncidencias();
  const targetIncidencia = currentLocalList.find(i => i.id === incidenciaId);
  const estadoAnterior = targetIncidencia?.estado || 'pendiente';

  // 1. Persistencia en Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('incidencias_asistencia_docente')
        .update({
          estado: nuevoEstado,
          resolucion: resolucionTexto,
          resuelto_por: directorUser.id,
          fecha_resolucion: ahora,
        })
        .eq('id', incidenciaId);

      if (error) {
        console.warn('Error resolviendo incidencia en Supabase:', error.message);
      }
    } catch (e: any) {
      console.warn('Excepción al resolver incidencia en Supabase:', e);
    }
  }

  // 2. Actualizar estado local
  const updatedItem: IncidenciaAsistenciaDocente = {
    ...(targetIncidencia || {
      id: incidenciaId,
      docente_id: 'usr-unknown',
      fecha: getBoliviaTodayDate(),
      tipo_incidencia: 'sin_salida',
      estado: nuevoEstado,
    }),
    estado: nuevoEstado,
    resolucion: resolucionTexto,
    resuelto_por: directorUser.id,
    resuelto_por_nombre: directorUser.nombre_completo,
    fecha_resolucion: ahora,
  };

  const updatedList = currentLocalList.map(item => (item.id === incidenciaId ? updatedItem : item));
  saveLocalIncidencias(updatedList);

  // 3. REGISTRAR OBLIGATORIAMENTE EN EL MÓDULO DE AUDITORÍA
  await registrarAuditoria({
    usuario_id: directorUser.id,
    usuario_nombre: directorUser.nombre_completo,
    usuario_rol: directorUser.rol,
    accion: `RESOLVER_INCIDENCIA_ASISTENCIA_${nuevoEstado.toUpperCase()}`,
    tabla_afectada: 'incidencias_asistencia_docente',
    registro_afectado_id: incidenciaId,
    valor_anterior: {
      estado: estadoAnterior,
      docente: targetIncidencia?.docente_nombre || targetIncidencia?.docente_id,
      fecha: targetIncidencia?.fecha,
      tipo_incidencia: targetIncidencia?.tipo_incidencia,
    },
    valor_nuevo: {
      estado: nuevoEstado,
      resolucion: resolucionTexto,
      resuelto_por: directorUser.nombre_completo,
      fecha_resolucion: ahora,
    },
    motivo_registro: `Resolución de incidencia (${targetIncidencia?.docente_nombre || 'Docente'} - ${targetIncidencia?.fecha || 'Fecha'}): ${resolucionTexto}`,
  });

  return { success: true, data: updatedItem };
}

/**
 * Evalúa las asistencias de docentes REALES vs horarios reales asignados para una fecha determinada
 * y genera incidencias en estado 'pendiente' si hay registros incompletos o ausencias.
 * REGLA INSTITUCIONAL: NUNCA genera faltas automáticas ni usa datos mock.
 */
export async function evaluarYGenerarIncidenciasDelDia(
  fecha: string,
  docentes: Perfil[],
  asistencias: AsistenciaDocente[]
): Promise<number> {
  const currentIncidencias = getLocalIncidencias();
  let generatedCount = 0;

  for (const doc of docentes) {
    if (!doc.activo) continue;

    // Obtener horario esperado real para esa fecha
    const resolved = await resolverSedeYHorarioDocente(doc);
    if (!resolved.horario) continue; // Si no tiene horario curricular para ese día, no se evalúa

    const asistencia = asistencias.find(
      a => a.docente_id === doc.id && a.fecha_laboral === fecha
    );

    // Verificar si ya existe una incidencia registrada para este docente y fecha
    const yaExiste = currentIncidencias.find(
      inc => inc.docente_id === doc.id && inc.fecha === fecha
    );

    if (yaExiste) continue;

    let nuevaIncidencia: Partial<IncidenciaAsistenciaDocente> | null = null;

    if (!asistencia) {
      // 1. Sin marcación de ningún tipo
      nuevaIncidencia = {
        docente_id: doc.id,
        fecha: fecha,
        tipo_incidencia: 'sin_registro',
        estado: 'pendiente',
        detalle: `Jornada finalizada sin marcaciones registradas para el horario asignado (${resolved.horario.hora_ingreso} - ${resolved.horario.hora_salida}). Requiere evaluación de Dirección.`,
        docente_nombre: doc.nombre_completo,
        docente_rda: doc.rda,
        sede_nombre: resolved.sede?.nombre || doc.sede_nombre,
        horario_esperado: `${resolved.horario.hora_ingreso} - ${resolved.horario.hora_salida}`,
        estado_gps: 'sin_gps',
      };
    } else if (asistencia.hora_ingreso_local && !asistencia.hora_salida_local) {
      // 2. Ingreso registrado pero sin salida
      nuevaIncidencia = {
        docente_id: doc.id,
        fecha: fecha,
        tipo_incidencia: 'sin_salida',
        estado: 'pendiente',
        detalle: `Ingreso marcado a las ${asistencia.hora_ingreso_local}. Jornada concluida sin registro de salida oficial.`,
        docente_nombre: doc.nombre_completo,
        docente_rda: doc.rda,
        sede_nombre: asistencia.sede_nombre || resolved.sede?.nombre || doc.sede_nombre,
        horario_esperado: `${resolved.horario.hora_ingreso} - ${resolved.horario.hora_salida}`,
        hora_ingreso: asistencia.hora_ingreso_local,
        estado_gps: asistencia.estado_gps_ingreso || 'dentro_rango',
        distancia_m: asistencia.distancia_m_ingreso,
        selfie_url: asistencia.selfie_url,
      };
    } else if (!asistencia.hora_ingreso_local && asistencia.hora_salida_local) {
      // 3. Salida registrada pero sin ingreso
      nuevaIncidencia = {
        docente_id: doc.id,
        fecha: fecha,
        tipo_incidencia: 'sin_ingreso',
        estado: 'pendiente',
        detalle: `Salida registrada a las ${asistencia.hora_salida_local} sin registro previo de ingreso a la sede.`,
        docente_nombre: doc.nombre_completo,
        docente_rda: doc.rda,
        sede_nombre: asistencia.sede_nombre || resolved.sede?.nombre || doc.sede_nombre,
        horario_esperado: `${resolved.horario.hora_ingreso} - ${resolved.horario.hora_salida}`,
        hora_salida: asistencia.hora_salida_local,
      };
    } else if (asistencia.estado_gps_ingreso === 'fuera_rango' || asistencia.estado_gps_ingreso === 'gps_impreciso') {
      // 4. Marcación con observación de GPS
      nuevaIncidencia = {
        docente_id: doc.id,
        fecha: fecha,
        tipo_incidencia: 'problema_gps',
        estado: 'pendiente',
        detalle: `Marcación con anomalía de geolocalización: ${asistencia.estado_gps_ingreso} (${asistencia.distancia_m_ingreso || 0}m de la sede). "${asistencia.observacion_excepcion || 'Sin justificación'}"`,
        docente_nombre: doc.nombre_completo,
        docente_rda: doc.rda,
        sede_nombre: asistencia.sede_nombre || resolved.sede?.nombre || doc.sede_nombre,
        horario_esperado: `${resolved.horario.hora_ingreso} - ${resolved.horario.hora_salida}`,
        hora_ingreso: asistencia.hora_ingreso_local,
        hora_salida: asistencia.hora_salida_local,
        estado_gps: asistencia.estado_gps_ingreso,
        distancia_m: asistencia.distancia_m_ingreso,
        selfie_url: asistencia.selfie_url,
      };
    }

    if (nuevaIncidencia) {
      const fullIncidencia: IncidenciaAsistenciaDocente = {
        id: `inc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        docente_id: nuevaIncidencia.docente_id!,
        fecha: nuevaIncidencia.fecha!,
        tipo_incidencia: nuevaIncidencia.tipo_incidencia!,
        estado: 'pendiente',
        detalle: nuevaIncidencia.detalle,
        docente_nombre: nuevaIncidencia.docente_nombre,
        docente_rda: nuevaIncidencia.docente_rda,
        sede_nombre: nuevaIncidencia.sede_nombre,
        horario_esperado: nuevaIncidencia.horario_esperado,
        hora_ingreso: nuevaIncidencia.hora_ingreso,
        hora_salida: nuevaIncidencia.hora_salida,
        estado_gps: nuevaIncidencia.estado_gps,
        distancia_m: nuevaIncidencia.distancia_m,
        selfie_url: nuevaIncidencia.selfie_url,
        created_at: new Date().toISOString(),
      };

      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('incidencias_asistencia_docente').insert({
            id: fullIncidencia.id.startsWith('inc-') ? undefined : fullIncidencia.id,
            docente_id: fullIncidencia.docente_id,
            fecha: fullIncidencia.fecha,
            tipo_incidencia: fullIncidencia.tipo_incidencia,
            estado: fullIncidencia.estado,
            detalle: fullIncidencia.detalle,
          });
        } catch (e) {
          console.warn('Error insertando incidencia automática en Supabase:', e);
        }
      }

      currentIncidencias.unshift(fullIncidencia);
      generatedCount++;
    }
  }

  if (generatedCount > 0) {
    saveLocalIncidencias(currentIncidencias);
  }

  return generatedCount;
}
