import { ConfiguracionCalendario } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';

const CALENDAR_STORAGE_KEY = 'cea_configuracion_calendario_v1';
const DIAS_NO_LABORALES_KEY = 'cea_dias_no_laborales_v1';
const PERIODOS_ACADEMICOS_KEY = 'cea_periodos_academicos_v1';

export const FALLBACK_DIAS_TRABAJADOS = 22;

export interface DiaNoLaboral {
  id?: string;
  fecha: string; // 'YYYY-MM-DD'
  motivo: string;
  tipo?: 'feriado' | 'suspension' | 'actividad_extraordinaria';
  created_at?: string;
}

export interface PeriodoAcademico {
  id?: string;
  gestion?: number;
  nombre: string;
  fecha_inicio_operativa: string; // 'YYYY-MM-DD'
  fecha_fin_operativa: string; // 'YYYY-MM-DD'
  activo?: boolean;
  created_at?: string;
}

export interface DiaCalendarioOficial {
  fecha: string; // 'YYYY-MM-DD'
  diaNumero: string; // '01', '02', ..., '31'
  diaSemana: string; // 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'
  diaSemanaCompleto: string; // 'Lunes', 'Martes', ...
  esHabil: boolean; // Monday-Friday, not holiday, within academic period
  esFinDeSemana: boolean;
  esFeriado: boolean;
  motivoFeriado?: string;
  tipoFeriado?: string;
}

// Feriados nacionales oficiales de Bolivia (Base institucional)
export const FERIADOS_NACIONALES_BOLIVIA_BASE: Record<string, string> = {
  // Fijos (MM-DD)
  '01-01': 'Año Nuevo',
  '01-22': 'Día del Estado Plurinacional de Bolivia',
  '05-01': 'Día del Trabajo',
  '06-21': 'Año Nuevo Aymara Amazónico y del Chaco',
  '08-06': 'Día de la Independencia de Bolivia (Día de la Patria)',
  '11-02': 'Día de Todos los Santos',
  '12-25': 'Navidad',
  
  // Feriados móviles / específicos gestión 2026
  '2026-02-16': 'Feriado de Carnaval (Lunes)',
  '2026-02-17': 'Feriado de Carnaval (Martes)',
  '2026-04-03': 'Viernes Santo',
  '2026-06-04': 'Corpus Christi'
};

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

export async function loadDiasNoLaborales(): Promise<DiaNoLaboral[]> {
  const localItems: DiaNoLaboral[] = [];
  try {
    const raw = localStorage.getItem(DIAS_NO_LABORALES_KEY);
    if (raw) localItems.push(...JSON.parse(raw));
  } catch {
    // ignore
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('dias_no_laborales')
        .select('*')
        .order('fecha', { ascending: true });

      if (!error && data) {
        const mapped: DiaNoLaboral[] = data.map((item: any) => ({
          id: item.id,
          fecha: item.fecha,
          motivo: item.motivo,
          tipo: item.tipo || 'feriado',
          created_at: item.created_at
        }));
        try {
          localStorage.setItem(DIAS_NO_LABORALES_KEY, JSON.stringify(mapped));
        } catch {
          // ignore
        }
        return mapped;
      }
    } catch (err) {
      console.warn('Error al consultar dias_no_laborales:', err);
    }
  }

  return localItems;
}

export async function loadPeriodosAcademicos(): Promise<PeriodoAcademico[]> {
  const localItems: PeriodoAcademico[] = [];
  try {
    const raw = localStorage.getItem(PERIODOS_ACADEMICOS_KEY);
    if (raw) localItems.push(...JSON.parse(raw));
  } catch {
    // ignore
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('periodos_academicos')
        .select('*')
        .order('fecha_inicio_operativa', { ascending: false });

      if (!error && data) {
        const mapped: PeriodoAcademico[] = data.map((item: any) => ({
          id: item.id,
          gestion: item.gestion ? Number(item.gestion) : 2026,
          nombre: item.nombre,
          fecha_inicio_operativa: item.fecha_inicio_operativa,
          fecha_fin_operativa: item.fecha_fin_operativa,
          activo: item.activo !== false,
          created_at: item.created_at
        }));
        try {
          localStorage.setItem(PERIODOS_ACADEMICOS_KEY, JSON.stringify(mapped));
        } catch {
          // ignore
        }
        return mapped;
      }
    } catch (err) {
      console.warn('Error al consultar periodos_academicos:', err);
    }
  }

  return localItems.length > 0
    ? localItems
    : [
        {
          gestion: 2026,
          nombre: 'Segundo Semestre 2026',
          fecha_inicio_operativa: '2026-07-27',
          fecha_fin_operativa: '2026-12-14',
          activo: true
        }
      ];
}

/**
 * Genera los días laborales oficiales de un mes siguiendo estrictamente la jerarquía:
 * 1. configuracion_calendario (días hábiles configurados)
 * 2. dias_no_laborales (feriados / suspensiones oficiales)
 * 3. periodos_academicos (fechas de inicio y fin de clases)
 * Excluye siempre sábados y domingos de la planilla regular de lunes a viernes.
 */
export function getDiasLaboralesOficialesMes(
  mes: string, // 'YYYY-MM'
  options?: {
    configuraciones?: ConfiguracionCalendario[];
    diasNoLaborales?: DiaNoLaboral[];
    periodos?: PeriodoAcademico[];
  }
): DiaCalendarioOficial[] {
  if (!mes || !/^\d{4}-\d{2}$/.test(mes.slice(0, 7))) {
    return [];
  }

  const normalizedMes = mes.slice(0, 7);
  const [yearStr, monthStr] = normalizedMes.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  // Cantidad de días del mes calendario
  const totalDaysInMonth = new Date(year, month, 0).getDate();

  const diasNoLaborales = options?.diasNoLaborales || [];
  const periodos = options?.periodos || [];

  // Encontrar si hay periodo académico que aplique a este año/semestre
  const activePeriod = periodos.find(p => p.activo !== false) || periodos[0];

  const diasLaborales: DiaCalendarioOficial[] = [];

  const dayNamesShort = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const dayNamesFull = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  for (let d = 1; d <= totalDaysInMonth; d++) {
    const dayPadded = d.toString().padStart(2, '0');
    const fecha = `${normalizedMes}-${dayPadded}`;
    const mmdd = `${monthStr}-${dayPadded}`;

    // Construir fecha segura a mediodía para evitar problemas de desfase UTC
    const dateObj = new Date(year, month - 1, d, 12, 0, 0);
    const dayOfWeek = dateObj.getDay(); // 0 = Domingo, 6 = Sábado

    const esFinDeSemana = dayOfWeek === 0 || dayOfWeek === 6;

    // Verificar si es feriado oficial (Base nacional o tabla dias_no_laborales)
    let esFeriado = false;
    let motivoFeriado: string | undefined = undefined;
    let tipoFeriado: string | undefined = undefined;

    // 1. Verificar tabla dias_no_laborales de Supabase
    const matchCustom = diasNoLaborales.find(item => item.fecha === fecha);
    if (matchCustom) {
      esFeriado = true;
      motivoFeriado = matchCustom.motivo;
      tipoFeriado = matchCustom.tipo || 'feriado';
    } else if (FERIADOS_NACIONALES_BOLIVIA_BASE[fecha]) {
      // 2. Feriados específicos por fecha completa (ej. Carnaval 2026, Viernes Santo)
      esFeriado = true;
      motivoFeriado = FERIADOS_NACIONALES_BOLIVIA_BASE[fecha];
      tipoFeriado = 'feriado';
    } else if (FERIADOS_NACIONALES_BOLIVIA_BASE[mmdd]) {
      // 3. Feriados fijos (ej. 08-06 Día de la Patria, 01-01, 12-25)
      esFeriado = true;
      motivoFeriado = FERIADOS_NACIONALES_BOLIVIA_BASE[mmdd];
      tipoFeriado = 'feriado';
    }

    // Verificar si está dentro del periodo académico operativo
    let dentroPeriodo = true;
    if (activePeriod && activePeriod.fecha_inicio_operativa && activePeriod.fecha_fin_operativa) {
      if (fecha < activePeriod.fecha_inicio_operativa || fecha > activePeriod.fecha_fin_operativa) {
        dentroPeriodo = false;
      }
    }

    // Es día hábil si es Lunes a Viernes, no es feriado y está dentro del periodo
    const esHabil = !esFinDeSemana && !esFeriado && dentroPeriodo;

    if (esHabil) {
      diasLaborales.push({
        fecha,
        diaNumero: dayPadded,
        diaSemana: dayNamesShort[dayOfWeek],
        diaSemanaCompleto: dayNamesFull[dayOfWeek],
        esHabil: true,
        esFinDeSemana: false,
        esFeriado: false
      });
    }
  }

  return diasLaborales;
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
