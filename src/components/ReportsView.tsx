import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Filter,
  Users,
  GraduationCap,
  Layers,
  Building2,
  PieChart,
  BarChart3,
  CheckCircle2,
  RefreshCw,
  UserCheck,
  UserX,
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  XCircle,
  AlertCircle,
  BookOpen,
  Wifi,
  WifiOff,
  UserCheck2,
  FileText,
  Loader2
} from 'lucide-react';
import {
  Perfil,
  Estudiante,
  Programa,
  NivelEducativo,
  AsistenciaDocente,
  EstadoAsistenciaDocente,
  ResumenAsistenciaDocenteMensual,
  AlertaEstudiante,
  Seguimiento,
  ConfiguracionCalendario
} from '../types';
import {
  downloadDocenteAttendanceReport,
  downloadStudentEnrollmentReport,
  downloadAtRiskReport,
  downloadStudentStatisticalReport
} from '../lib/excelExport';
import {
  getLocalEstudiantes,
  loadEstudiantesFromSupabase,
  getLocalProgramas,
  getLocalNiveles
} from '../lib/academic';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  loadConfiguracionesCalendario,
  getDiasTrabajadosForMonth,
  getLocalConfiguracionesCalendario
} from '../lib/calendar';

interface ReportsViewProps {
  user: Perfil;
}

interface SesionReportItem {
  id: string;
  fecha: string;
  materia: string;
  grupo_id: string;
  grupo_nombre: string;
  sede_nombre: string;
  docente_nombre: string;
  total: number;
  presentes: number;
  atrasos: number;
  faltas: number;
  licencias: number;
  porcentaje: number;
  estudiantes_detalle: Array<{
    id: string;
    nombre_completo: string;
    codigo_interno: string;
    estado: 'presente' | 'atraso' | 'falta' | 'licencia';
  }>;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'estadistico' | 'asistencia_estudiantes' | 'asistencia_docente' | 'planillas'>('estadistico');

  // Load dynamic student data and structure
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>(() => getLocalEstudiantes());
  const [programas, setProgramas] = useState<Programa[]>(() => getLocalProgramas());
  const [niveles, setNiveles] = useState<NivelEducativo[]>(() => getLocalNiveles());

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [estadisticoError, setEstadisticoError] = useState<string | null>(null);

  // Filters State
  const [filterSede, setFilterSede] = useState<string>('Todas');
  const [filterPrograma, setFilterPrograma] = useState<string>('Todos');
  const [filterNivel, setFilterNivel] = useState<string>('Todos');
  const [filterSexo, setFilterSexo] = useState<string>('Todos');
  const [filterGestion, setFilterGestion] = useState<string>('2026');

  // Planillas Filter State
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-07');
  const [selectedSedePlanilla, setSelectedSedePlanilla] = useState<string>('Todas');

  // Asistencia Estudiantil Real History Filters & State
  const [dbSedes, setDbSedes] = useState<Array<{ id: string; nombre: string }>>([]);
  const [dbGrupos, setDbGrupos] = useState<Array<{ id: string; nombre: string; sede_id: string }>>([]);
  const [historiaSedeId, setHistoriaSedeId] = useState<string>('todas');
  const [historiaGrupoId, setHistoriaGrupoId] = useState<string>('todos');
  const [historiaFecha, setHistoriaFecha] = useState<string>('');
  const [sesionesHistorial, setSesionesHistorial] = useState<SesionReportItem[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState<boolean>(false);
  const [historialError, setHistorialError] = useState<string | null>(null);
  const [expandedSesionId, setExpandedSesionId] = useState<string | null>(null);

  // Asistencia Docente Real History Filters & State
  const [docentesList, setDocentesList] = useState<Array<{ id: string; nombre_completo: string; sede_id?: string }>>([]);
  const [docenteFilterSede, setDocenteFilterSede] = useState<string>('todas');
  const [docenteFilterDocenteId, setDocenteFilterDocenteId] = useState<string>('todos');
  const [docenteFilterMes, setDocenteFilterMes] = useState<string>('');
  const [docenteFilterFechaInicio, setDocenteFilterFechaInicio] = useState<string>('');
  const [docenteFilterFechaFin, setDocenteFilterFechaFin] = useState<string>('');
  const [docenteFilterEstado, setDocenteFilterEstado] = useState<string>('todos');
  const [asistenciasDocentesList, setAsistenciasDocentesList] = useState<AsistenciaDocente[]>([]);
  const [loadingDocentes, setLoadingDocentes] = useState<boolean>(false);
  const [docentesError, setDocentesError] = useState<string | null>(null);
  const [calendarConfigs, setCalendarConfigs] = useState<ConfiguracionCalendario[]>(() => getLocalConfiguracionesCalendario());

  useEffect(() => {
    loadConfiguracionesCalendario().then(configs => setCalendarConfigs(configs));

    const handleCalendarChange = (e: any) => {
      if (e.detail) {
        setCalendarConfigs(e.detail);
      }
    };
    window.addEventListener('configuracionCalendarioChanged', handleCalendarChange);
    return () => window.removeEventListener('configuracionCalendarioChanged', handleCalendarChange);
  }, []);

  const refreshData = async () => {
    setIsLoading(true);
    setEstadisticoError(null);
    try {
      const loaded = await loadEstudiantesFromSupabase();
      setEstudiantes(loaded);
      setProgramas(getLocalProgramas());
      setNiveles(getLocalNiveles());
      await loadFiltrosHistorial();
    } catch (err: any) {
      console.error('Error al cargar datos de estudiantes:', err);
      setEstadisticoError(err.message || 'Error al consultar estudiantes en Supabase.');
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar sedes y grupos reales de Supabase para los filtros de historial
  const loadFiltrosHistorial = async () => {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      // 1. Cargar sedes activas
      const { data: sedesData, error: sedesErr } = await supabase
        .from('sedes')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre', { ascending: true });

      if (!sedesErr && sedesData) {
        setDbSedes(sedesData);
      }

      // 2. Cargar grupos activos
      const { data: gruposData, error: gruposErr } = await supabase
        .from('grupos')
        .select('id, nombre, sede_id')
        .eq('activo', true)
        .order('nombre', { ascending: true });

      if (!gruposErr && gruposData) {
        setDbGrupos(gruposData);
      }

      // 3. Cargar docentes activos para filtros
      const { data: docentesData, error: docentesErr } = await supabase
        .from('perfiles')
        .select('id, nombre_completo, sede_id')
        .eq('rol', 'docente')
        .eq('activo', true)
        .order('nombre_completo', { ascending: true });

      if (!docentesErr && docentesData) {
        setDocentesList(docentesData);
      }
    } catch (err) {
      console.error('Error al cargar filtros de historial desde Supabase:', err);
    }
  };

  // Consultar historial real de asistencia docente
  const fetchAsistenciasDocentes = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setDocentesError('Supabase no está configurado.');
      return;
    }

    setLoadingDocentes(true);
    setDocentesError(null);

    try {
      // 1. Determinar docentes a consultar si hay filtro por sede o docente
      let targetDocenteIds: string[] | null = null;

      if (docenteFilterDocenteId !== 'todos') {
        targetDocenteIds = [docenteFilterDocenteId];
      } else if (docenteFilterSede !== 'todas') {
        // Filtrar docentes asignados a la sede seleccionada
        const docsEnSede = docentesList.filter(d => d.sede_id === docenteFilterSede);
        if (docsEnSede.length > 0) {
          targetDocenteIds = docsEnSede.map(d => d.id);
        } else {
          // Si no hay docentes precargados en esa sede, buscar en perfiles
          const { data: docsDb } = await supabase
            .from('perfiles')
            .select('id')
            .eq('rol', 'docente')
            .eq('sede_id', docenteFilterSede);
          
          targetDocenteIds = (docsDb || []).map(d => d.id);
          if (targetDocenteIds.length === 0) {
            setAsistenciasDocentesList([]);
            setLoadingDocentes(false);
            return;
          }
        }
      }

      // 2. Construir consulta principal a asistencias_docentes
      let query = supabase
        .from('asistencias_docentes')
        .select('*')
        .order('fecha_laboral', { ascending: false });

      if (targetDocenteIds && targetDocenteIds.length > 0) {
        query = query.in('docente_id', targetDocenteIds);
      }

      if (docenteFilterEstado !== 'todos') {
        query = query.eq('estado', docenteFilterEstado);
      }

      if (docenteFilterFechaInicio && docenteFilterFechaFin) {
        query = query.gte('fecha_laboral', docenteFilterFechaInicio).lte('fecha_laboral', docenteFilterFechaFin);
      } else if (docenteFilterFechaInicio) {
        query = query.gte('fecha_laboral', docenteFilterFechaInicio);
      } else if (docenteFilterFechaFin) {
        query = query.lte('fecha_laboral', docenteFilterFechaFin);
      } else if (docenteFilterMes) {
        // Filtro por mes YYYY-MM
        const [year, month] = docenteFilterMes.split('-');
        const startDate = `${year}-${month}-01`;
        const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
        const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
        query = query.gte('fecha_laboral', startDate).lte('fecha_laboral', endDate);
      }

      const { data: asistData, error: asistErr } = await query;

      if (asistErr) {
        throw new Error(asistErr.message);
      }

      if (!asistData || asistData.length === 0) {
        setAsistenciasDocentesList([]);
        setLoadingDocentes(false);
        return;
      }

      // 3. Consultar tablas relacionadas por separado (perfiles y sedes) para evitar joins ambiguos
      const uniqueDocenteIds = Array.from(new Set(asistData.map(a => a.docente_id).filter(Boolean)));
      
      let perfilMap = new Map<string, { nombre_completo: string; sede_id?: string }>();
      if (uniqueDocenteIds.length > 0) {
        const { data: perfilesData } = await supabase
          .from('perfiles')
          .select('id, nombre_completo, sede_id')
          .in('id', uniqueDocenteIds);

        (perfilesData || []).forEach(p => {
          perfilMap.set(p.id, {
            nombre_completo: p.nombre_completo,
            sede_id: p.sede_id
          });
        });
      }

      // Consultar sedes para mapear nombres
      const { data: sedesData } = await supabase
        .from('sedes')
        .select('id, nombre');

      const sedeMap = new Map<string, string>();
      (sedesData || []).forEach(s => sedeMap.set(s.id, s.nombre));

      // 4. Enriquecer asistencias con nombres de docente y sede
      const enriched: AsistenciaDocente[] = asistData.map(a => {
        const perf = perfilMap.get(a.docente_id);
        const docenteNombre = perf?.nombre_completo || 'Docente no registrado';
        const sedeNombre = perf?.sede_id ? (sedeMap.get(perf.sede_id) || 'Sede sin asignar') : 'Sede General';

        return {
          ...a,
          docente_nombre: docenteNombre,
          sede_nombre: sedeNombre
        };
      });

      setAsistenciasDocentesList(enriched);
    } catch (err: any) {
      console.error('Error al cargar asistencias de docentes:', err);
      setDocentesError(err.message || 'Error al consultar asistencias docentes en Supabase.');
    } finally {
      setLoadingDocentes(false);
    }
  };

  // Consultar historial real de asistencia estudiantil
  const fetchSesionesHistorial = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setHistorialError('Supabase no está configurado.');
      return;
    }

    setLoadingHistorial(true);
    setHistorialError(null);

    try {
      // Determinar qué grupos aplicar al filtro
      let targetGrupoIds: string[] = [];

      if (historiaGrupoId !== 'todos') {
        targetGrupoIds = [historiaGrupoId];
      } else if (historiaSedeId !== 'todas') {
        targetGrupoIds = dbGrupos
          .filter(g => g.sede_id === historiaSedeId)
          .map(g => g.id);

        if (targetGrupoIds.length === 0) {
          setSesionesHistorial([]);
          setLoadingHistorial(false);
          return;
        }
      }

      // 1. Cargar sesiones de clase reales
      let query = supabase
        .from('sesiones_clase')
        .select('id, grupo_id, docente_id, fecha, materia, created_at')
        .order('fecha', { ascending: false });

      if (targetGrupoIds.length > 0) {
        query = query.in('grupo_id', targetGrupoIds);
      }

      if (historiaFecha) {
        query = query.eq('fecha', historiaFecha);
      }

      const { data: sesionesData, error: sesionesErr } = await query;

      if (sesionesErr) {
        throw new Error(sesionesErr.message);
      }

      if (!sesionesData || sesionesData.length === 0) {
        setSesionesHistorial([]);
        setLoadingHistorial(false);
        return;
      }

      const sesionIds = sesionesData.map(s => s.id);
      const grupoIds = Array.from(new Set(sesionesData.map(s => s.grupo_id)));
      const docenteIds = Array.from(new Set(sesionesData.map(s => s.docente_id).filter(Boolean)));

      // 2. Cargar asistencias asociadas a estas sesiones
      const { data: asistenciasData, error: asistenciasErr } = await supabase
        .from('asistencias_estudiantes')
        .select('id, sesion_id, estudiante_id, estado')
        .in('sesion_id', sesionIds);

      if (asistenciasErr) {
        throw new Error(asistenciasErr.message);
      }

      // 3. Cargar grupos y sedes para resolver nombres
      const { data: gruposDetalle } = await supabase
        .from('grupos')
        .select('id, nombre, sede_id')
        .in('id', grupoIds);

      const sedeIds = Array.from(new Set((gruposDetalle || []).map(g => g.sede_id).filter(Boolean)));
      const { data: sedesDetalle } = await supabase
        .from('sedes')
        .select('id, nombre')
        .in('id', sedeIds);

      const sedeMap = new Map<string, string>();
      (sedesDetalle || []).forEach(s => sedeMap.set(s.id, s.nombre));

      const grupoMap = new Map<string, { nombre: string; sede_nombre: string }>();
      (gruposDetalle || []).forEach(g => {
        grupoMap.set(g.id, {
          nombre: g.nombre,
          sede_nombre: sedeMap.get(g.sede_id) || 'Sede sin asignar'
        });
      });

      // 4. Cargar perfiles de docentes
      const { data: perfilesData } = await supabase
        .from('perfiles')
        .select('id, nombre_completo')
        .in('id', docenteIds);

      const docenteMap = new Map<string, string>();
      (perfilesData || []).forEach(p => docenteMap.set(p.id, p.nombre_completo));

      // 5. Cargar estudiantes asociados
      const estudianteIds = Array.from(new Set((asistenciasData || []).map(a => a.estudiante_id)));
      let estudianteMap = new Map<string, { nombre_completo: string; codigo_interno: string }>();

      if (estudianteIds.length > 0) {
        const { data: estudiantesData } = await supabase
          .from('estudiantes')
          .select('id, nombre_completo, codigo_interno')
          .in('id', estudianteIds);

        (estudiantesData || []).forEach(st => {
          estudianteMap.set(st.id, {
            nombre_completo: st.nombre_completo,
            codigo_interno: st.codigo_interno || 'S/C'
          });
        });
      }

      // 6. Construir las sesiones con métricas calculadas y detalle de alumnos
      const builtSesiones: SesionReportItem[] = sesionesData.map(ses => {
        const sesAsistencias = (asistenciasData || []).filter(a => a.sesion_id === ses.id);
        const total = sesAsistencias.length;
        const presentes = sesAsistencias.filter(a => a.estado === 'presente').length;
        const atrasos = sesAsistencias.filter(a => a.estado === 'atraso').length;
        const faltas = sesAsistencias.filter(a => a.estado === 'falta').length;
        const licencias = sesAsistencias.filter(a => a.estado === 'licencia').length;

        // Porcentaje: (presentes + atrasos) / total * 100
        const porcentaje = total > 0 ? Math.round(((presentes + atrasos) / total) * 100) : 0;

        const grupoInfo = grupoMap.get(ses.grupo_id);
        const docenteNombre = docenteMap.get(ses.docente_id) || 'Docente no asignado';

        const estudiantesDetalle = sesAsistencias.map(a => {
          const st = estudianteMap.get(a.estudiante_id);
          return {
            id: a.estudiante_id,
            nombre_completo: st?.nombre_completo || 'Estudiante no registrado',
            codigo_interno: st?.codigo_interno || 'S/C',
            estado: a.estado as 'presente' | 'atraso' | 'falta' | 'licencia'
          };
        });

        // Ordenar estudiantes alfabéticamente
        estudiantesDetalle.sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));

        return {
          id: ses.id,
          fecha: ses.fecha,
          materia: ses.materia,
          grupo_id: ses.grupo_id,
          grupo_nombre: grupoInfo?.nombre || 'Grupo no identificado',
          sede_nombre: grupoInfo?.sede_nombre || 'Sede no identificada',
          docente_nombre: docenteNombre,
          total,
          presentes,
          atrasos,
          faltas,
          licencias,
          porcentaje,
          estudiantes_detalle: estudiantesDetalle
        };
      });

      setSesionesHistorial(builtSesiones);
    } catch (err: any) {
      console.error('Error al cargar historial de asistencia:', err);
      setHistorialError(err.message || 'Error al consultar sesiones de clase en Supabase.');
    } finally {
      setLoadingHistorial(false);
    }
  };

  useEffect(() => {
    refreshData();
    loadFiltrosHistorial();

    // Listen to academic changes from Administration
    const handleAcademicChanged = () => {
      setProgramas(getLocalProgramas());
      setNiveles(getLocalNiveles());
      setEstudiantes(getLocalEstudiantes());
      loadFiltrosHistorial();
    };

    const handleAsistenciaSaved = () => {
      if (activeTab === 'asistencia_estudiantes') {
        fetchSesionesHistorial();
      }
    };

    window.addEventListener('academicStructureChanged', handleAcademicChanged);
    window.addEventListener('asistencia-estudiantes-guardada', handleAsistenciaSaved);
    return () => {
      window.removeEventListener('academicStructureChanged', handleAcademicChanged);
      window.removeEventListener('asistencia-estudiantes-guardada', handleAsistenciaSaved);
    };
  }, []);

  // Cargar historial de asistencia docente cuando se entra a la pestaña o cambian los filtros
  useEffect(() => {
    if (activeTab === 'asistencia_docente') {
      fetchAsistenciasDocentes();
    }
  }, [
    activeTab,
    docenteFilterSede,
    docenteFilterDocenteId,
    docenteFilterMes,
    docenteFilterFechaInicio,
    docenteFilterFechaFin,
    docenteFilterEstado
  ]);

  // Docentes filtrados según la sede seleccionada en la pestaña de Asistencia Docente
  const filteredDocentesForFilter = useMemo(() => {
    if (docenteFilterSede === 'todas') return docentesList;
    return docentesList.filter(d => d.sede_id === docenteFilterSede);
  }, [docentesList, docenteFilterSede]);

  // Resumen métrico calculado de Asistencia Docente
  const resumenDocente = useMemo(() => {
    const total = asistenciasDocentesList.length;
    const puntuales = asistenciasDocentesList.filter(a => a.estado === 'puntual').length;
    const atrasos = asistenciasDocentesList.filter(a => a.estado === 'atraso').length;
    const faltas = asistenciasDocentesList.filter(a => a.estado === 'falta').length;
    const licencias = asistenciasDocentesList.filter(a => a.estado === 'licencia').length;
    const incompletos = asistenciasDocentesList.filter(a => a.estado === 'registro_incompleto').length;
    const totalHoras = asistenciasDocentesList.reduce((acc, curr) => acc + (curr.horas_trabajadas || 0), 0);

    return {
      total,
      puntuales,
      atrasos,
      faltas,
      licencias,
      incompletos,
      totalHoras: Math.round(totalHoras * 10) / 10
    };
  }, [asistenciasDocentesList]);

  // Cargar historial cuando se entra a la pestaña o cambian los filtros
  useEffect(() => {
    if (activeTab === 'asistencia_estudiantes') {
      fetchSesionesHistorial();
    }
  }, [activeTab, historiaSedeId, historiaGrupoId, historiaFecha]);

  // Grupos filtrados para el selector de historial
  const filteredGruposForHistoria = useMemo(() => {
    if (historiaSedeId === 'todas') return dbGrupos;
    return dbGrupos.filter(g => g.sede_id === historiaSedeId);
  }, [dbGrupos, historiaSedeId]);

  // Base collection: Applies Sede + Programa + Nivel + Gestión (ignoring filterSexo)
  const baseEstudiantes = useMemo(() => {
    return estudiantes.filter(e => {
      // Filter Sede (comparing exact UUID)
      if (filterSede !== 'Todas' && e.sede_id !== filterSede) {
        return false;
      }

      // Filter Programa (EPA, ESA, ETA, EDUPER, CEE)
      if (filterPrograma !== 'Todos') {
        const progCode = (e.programa_codigo || e.programa_nombre || '').toUpperCase();
        if (!progCode.includes(filterPrograma.toUpperCase())) {
          return false;
        }
      }

      // Filter Nivel (Elemental, Avanzado, Técnico Básico, etc.)
      if (filterNivel !== 'Todos') {
        const nivName = (e.nivel || '').toLowerCase();
        if (!nivName.includes(filterNivel.toLowerCase())) {
          return false;
        }
      }

      // Filter Gestión
      if (filterGestion !== 'Todas') {
        const gest = e.gestion || '2026';
        if (gest !== filterGestion) return false;
      }

      return true;
    });
  }, [estudiantes, filterSede, filterPrograma, filterNivel, filterGestion]);

  // Filtered collection: Takes baseEstudiantes and applies filterSexo for detailed listing and views
  const filteredEstudiantes = useMemo(() => {
    return baseEstudiantes.filter(e => {
      // Filter Sexo (Masculino, Femenino, Sin especificar)
      if (filterSexo !== 'Todos') {
        const sexoVal = (e.sexo || '').trim();
        if (filterSexo === 'Masculino' && sexoVal !== 'Masculino') return false;
        if (filterSexo === 'Femenino' && sexoVal !== 'Femenino') return false;
        if (filterSexo === 'SinEspecificar' && (sexoVal === 'Masculino' || sexoVal === 'Femenino')) return false;
      }

      return true;
    });
  }, [baseEstudiantes, filterSexo]);

  // Statistical calculations on filteredEstudiantes
  const totalInscritos = filteredEstudiantes.length;
  const activos = filteredEstudiantes.filter(e => e.estado === 'activo').length;
  const inactivos = filteredEstudiantes.filter(e => e.estado !== 'activo').length;

  // Percentage calculations for general population
  const percentActivos = totalInscritos > 0 ? Math.round((activos / totalInscritos) * 100) : 0;
  const percentInactivos = totalInscritos > 0 ? Math.round((inactivos / totalInscritos) * 100) : 0;

  // Sex distribution calculated strictly on baseEstudiantes (independent of filterSexo)
  const totalBase = baseEstudiantes.length;
  const hombres = baseEstudiantes.filter(e => (e.sexo || '').trim() === 'Masculino').length;
  const mujeres = baseEstudiantes.filter(e => (e.sexo || '').trim() === 'Femenino').length;
  const sinSexo = baseEstudiantes.filter(e => {
    const s = (e.sexo || '').trim();
    return s !== 'Masculino' && s !== 'Femenino';
  }).length;

  const percentHombres = totalBase > 0 ? Math.round((hombres / totalBase) * 100) : 0;
  const percentMujeres = totalBase > 0 ? Math.round((mujeres / totalBase) * 100) : 0;
  const percentSinSexo = totalBase > 0 ? Math.round((sinSexo / totalBase) * 100) : 0;

  // Breakdown by Program (Construido dinámicamente desde estudiantes reales)
  const programCounts = useMemo(() => {
    const map: Record<string, number> = {};

    filteredEstudiantes.forEach(e => {
      const code = e.programa_codigo || e.programa_nombre || 'Sin Programa';
      map[code] = (map[code] || 0) + 1;
    });
    return map;
  }, [filteredEstudiantes]);

  // Breakdown by Level (Construido dinámicamente desde estudiantes reales)
  const levelCounts = useMemo(() => {
    const map: Record<string, number> = {};

    filteredEstudiantes.forEach(e => {
      const niv = e.nivel || 'Sin Nivel Asignado';
      map[niv] = (map[niv] || 0) + 1;
    });
    return map;
  }, [filteredEstudiantes]);

  // Dynamic programs and levels derived from real students for filters
  const availableProgramas = useMemo(() => {
    const set = new Set<string>();
    estudiantes.forEach(e => {
      const code = e.programa_codigo || e.programa_nombre;
      if (code) set.add(code);
    });
    return Array.from(set).sort();
  }, [estudiantes]);

  const availableNiveles = useMemo(() => {
    const set = new Set<string>();
    estudiantes.forEach(e => {
      if (e.nivel) set.add(e.nivel);
    });
    return Array.from(set).sort();
  }, [estudiantes]);

  // Breakdown by Sede y Grupo
  const sedeGrupoList = useMemo(() => {
    const map: Record<string, { sede: string; grupo: string; total: number; activos: number; inactivos: number }> = {};

    filteredEstudiantes.forEach(e => {
      const sedeName = e.sede_nombre || 'Sede sin asignar';
      const grupoName = e.grupo_nombre || 'Grupo sin asignar';
      const key = `${sedeName} - ${grupoName}`;
      if (!map[key]) {
        map[key] = {
          sede: sedeName,
          grupo: grupoName,
          total: 0,
          activos: 0,
          inactivos: 0
        };
      }
      map[key].total += 1;
      if (e.estado === 'activo') {
        map[key].activos += 1;
      } else {
        map[key].inactivos += 1;
      }
    });

    return Object.values(map).sort((a, b) => a.sede.localeCompare(b.sede) || a.grupo.localeCompare(b.grupo));
  }, [filteredEstudiantes]);

  const handleDownloadExcelEstadistico = () => {
    const selectedSedeObj = dbSedes.find(s => s.id === filterSede);
    const sedeLabel = filterSede === 'Todas' ? 'Todas las Sedes' : (selectedSedeObj?.nombre || filterSede);

    downloadStudentStatisticalReport(filteredEstudiantes, {
      sede: sedeLabel,
      programa: filterPrograma,
      nivel: filterNivel,
      sexo: filterSexo,
      gestion: filterGestion
    });
  };

  // Downloads for planillas
  const handleDownloadAsistenciaDocente = () => {
    if (asistenciasDocentesList.length === 0) {
      alert('No hay registros de asistencia docente para exportar.');
      return;
    }

    const mesExport = docenteFilterMes || selectedMonth || '';
    const diasConfiguradosMes = getDiasTrabajadosForMonth(mesExport, calendarConfigs);

    // Calcular resumen mensual por docente con base en los registros reales filtrados
    const resumenMap = new Map<string, ResumenAsistenciaDocenteMensual>();

    asistenciasDocentesList.forEach(a => {
      const docId = a.docente_id;
      const docNombre = a.docente_nombre || 'Docente sin asignar';

      if (!resumenMap.has(docId)) {
        resumenMap.set(docId, {
          docente_id: docId,
          docente_nombre: docNombre,
          dias_programados: diasConfiguradosMes,
          dias_asistidos: 0,
          dias_puntuales: 0,
          atrasos: 0,
          faltas: 0,
          licencias: 0,
          salidas_anticipadas: 0,
          registros_incompletos: 0,
          registros_sin_conexion: 0,
          horas_trabajadas: 0,
          porcentaje_asistencia: 0,
          porcentaje_puntualidad: 0
        });
      }

      const item = resumenMap.get(docId)!;
      item.horas_trabajadas += Number(a.horas_trabajadas || 0);

      if (a.origen_registro === 'sin_conexion') {
        item.registros_sin_conexion += 1;
      }

      if (a.estado === 'puntual') {
        item.dias_asistidos += 1;
        item.dias_puntuales += 1;
      } else if (a.estado === 'atraso') {
        item.dias_asistidos += 1;
        item.atrasos += 1;
      } else if (a.estado === 'falta') {
        item.faltas += 1;
      } else if (a.estado === 'licencia') {
        item.licencias += 1;
      } else if (a.estado === 'registro_incompleto') {
        item.registros_incompletos += 1;
      } else if (a.estado === 'salida_anticipada') {
        item.dias_asistidos += 1;
        item.salidas_anticipadas += 1;
      }
    });

    const resumenesList: ResumenAsistenciaDocenteMensual[] = Array.from(resumenMap.values()).map(r => {
      const pctAsistencia = r.dias_programados > 0
        ? Math.min(100, Number(((r.dias_asistidos / r.dias_programados) * 100).toFixed(1)))
        : 0;
      const pctPuntualidad = r.dias_asistidos > 0
        ? Number(((r.dias_puntuales / r.dias_asistidos) * 100).toFixed(1))
        : 100;
      return {
        ...r,
        horas_trabajadas: Number(r.horas_trabajadas.toFixed(2)),
        porcentaje_asistencia: pctAsistencia,
        porcentaje_puntualidad: pctPuntualidad
      };
    });

    downloadDocenteAttendanceReport(asistenciasDocentesList, resumenesList, mesExport);
  };

  const handleDownloadInscritos = () => {
    downloadStudentEnrollmentReport(filteredEstudiantes, selectedSedePlanilla);
  };

  const [downloadingRiesgo, setDownloadingRiesgo] = useState<boolean>(false);

  const handleDownloadRiesgo = async () => {
    if (!isSupabaseConfigured || !supabase) {
      alert('Supabase no está configurado.');
      return;
    }

    setDownloadingRiesgo(true);
    try {
      // 1. Query alertas_estudiantes with role filtering
      let alertasQuery = supabase
        .from('alertas_estudiantes')
        .select('*')
        .order('created_at', { ascending: false });

      let seguimientosQuery = supabase
        .from('seguimientos')
        .select('*')
        .order('created_at', { ascending: false });

      // Docente role restriction
      if (user.rol === 'docente') {
        alertasQuery = alertasQuery.eq('docente_id', user.id);
        seguimientosQuery = seguimientosQuery.eq('docente_id', user.id);
      }

      const [alertasRes, seguimientosRes] = await Promise.all([
        alertasQuery,
        seguimientosQuery
      ]);

      if (alertasRes.error) {
        throw new Error(`Error al consultar alertas: ${alertasRes.error.message}`);
      }
      if (seguimientosRes.error) {
        throw new Error(`Error al consultar seguimientos: ${seguimientosRes.error.message}`);
      }

      const rawAlertas = alertasRes.data || [];
      const rawSeguimientos = seguimientosRes.data || [];

      if (rawAlertas.length === 0) {
        alert('No se encontraron registros de estudiantes en situación de riesgo en la base de datos.');
        return;
      }

      // Collect IDs for enrichment
      const estudianteIds = Array.from(
        new Set([
          ...rawAlertas.map((a: any) => a.estudiante_id),
          ...rawSeguimientos.map((s: any) => s.estudiante_id)
        ].filter(Boolean))
      );

      const grupoIds = Array.from(
        new Set(rawAlertas.map((a: any) => a.grupo_id).filter(Boolean))
      );

      const docenteIds = Array.from(
        new Set([
          ...rawAlertas.map((a: any) => a.docente_id),
          ...rawSeguimientos.map((s: any) => s.docente_id)
        ].filter(Boolean))
      );

      // Fetch lookup dictionaries
      const [estudiantesRes, gruposRes, perfilesRes] = await Promise.all([
        estudianteIds.length > 0
          ? supabase.from('estudiantes').select('id, nombre_completo, codigo_interno').in('id', estudianteIds)
          : Promise.resolve({ data: [] }),
        grupoIds.length > 0
          ? supabase.from('grupos').select('id, nombre, carrera_especialidad').in('id', grupoIds)
          : Promise.resolve({ data: [] }),
        docenteIds.length > 0
          ? supabase.from('perfiles').select('id, nombre_completo').in('id', docenteIds)
          : Promise.resolve({ data: [] })
      ]);

      const estudiantesMap = new Map<string, string>();
      ((estudiantesRes as any).data || []).forEach((e: any) => estudiantesMap.set(e.id, e.nombre_completo));

      const gruposMap = new Map<string, string>();
      ((gruposRes as any).data || []).forEach((g: any) => gruposMap.set(g.id, g.nombre));

      const docentesMap = new Map<string, string>();
      ((perfilesRes as any).data || []).forEach((d: any) => docentesMap.set(d.id, d.nombre_completo));

      const mappedAlertas: AlertaEstudiante[] = rawAlertas.map((a: any) => ({
        ...a,
        estudiante_nombre: estudiantesMap.get(a.estudiante_id) || 'Estudiante no encontrado',
        grupo_nombre: gruposMap.get(a.grupo_id) || 'Grupo no especificado',
        docente_nombre: docentesMap.get(a.docente_id) || 'Docente sin asignar'
      }));

      const mappedSeguimientos: Seguimiento[] = rawSeguimientos.map((s: any) => ({
        ...s,
        estudiante_nombre: estudiantesMap.get(s.estudiante_id) || 'Estudiante no encontrado',
        docente_nombre: docentesMap.get(s.docente_id) || 'Docente responsable'
      }));

      downloadAtRiskReport(mappedAlertas, mappedSeguimientos);
    } catch (err: any) {
      console.error('Error al generar reporte de estudiantes en riesgo:', err);
      alert(err.message || 'Error al obtener datos de estudiantes en riesgo.');
    } finally {
      setDownloadingRiesgo(false);
    }
  };

  return (
    <div className="space-y-5 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#17324D]">Centro de Reportes Institucionales</h2>
          <p className="text-xs text-slate-500 font-medium">
            Estadísticas automáticas de estudiantes y descarga de planillas oficiales en Excel
          </p>
        </div>

        <button
          onClick={refreshData}
          disabled={isLoading}
          className="self-start sm:self-auto h-9 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#00A651]' : ''}`} />
          <span>{isLoading ? 'Actualizando...' : 'Actualizar Datos'}</span>
        </button>
      </div>

      {/* Main Subtabs Selector */}
      <div className="flex bg-slate-200 p-1 rounded-2xl gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('estadistico')}
          className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'estadistico' ? 'bg-[#00A651] text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4 shrink-0" />
          <span>Estadístico</span>
        </button>

        <button
          onClick={() => setActiveTab('asistencia_estudiantes')}
          className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'asistencia_estudiantes' ? 'bg-[#00A651] text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4 shrink-0" />
          <span>Asistencia Estudiantil</span>
        </button>

        <button
          onClick={() => setActiveTab('asistencia_docente')}
          className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'asistencia_docente' ? 'bg-[#00A651] text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'
          }`}
        >
          <UserCheck2 className="w-4 h-4 shrink-0" />
          <span>Asistencia Docente</span>
        </button>

        <button
          onClick={() => setActiveTab('planillas')}
          className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'planillas' ? 'bg-[#00A651] text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 shrink-0" />
          <span>Planillas Excel</span>
        </button>
      </div>

      {/* ================= REPORTE HISTORIAL DE ASISTENCIA ESTUDIANTIL ================= */}
      {activeTab === 'asistencia_estudiantes' && (
        <div className="space-y-4">
          {/* Panel de Filtros */}
          <div className="p-4 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-800 font-extrabold text-sm">
                <Filter className="w-4 h-4 text-[#00A651]" />
                <span>Filtros de Búsqueda</span>
              </div>
              {(historiaSedeId !== 'todas' || historiaGrupoId !== 'todos' || historiaFecha) && (
                <button
                  onClick={() => {
                    setHistoriaSedeId('todas');
                    setHistoriaGrupoId('todos');
                    setHistoriaFecha('');
                  }}
                  className="text-[11px] font-bold text-slate-500 hover:text-red-600 transition-colors"
                >
                  Restablecer
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Filtro Sede */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Sede
                </label>
                <select
                  value={historiaSedeId}
                  onChange={(e) => {
                    setHistoriaSedeId(e.target.value);
                    setHistoriaGrupoId('todos');
                  }}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-[#00A651]"
                >
                  <option value="todas">Todas las sedes</option>
                  {dbSedes.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Filtro Grupo */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Grupo
                </label>
                <select
                  value={historiaGrupoId}
                  onChange={(e) => setHistoriaGrupoId(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-[#00A651]"
                >
                  <option value="todos">Todos los grupos</option>
                  {filteredGruposForHistoria.map(g => (
                    <option key={g.id} value={g.id}>{g.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Filtro Fecha */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Fecha (Opcional)
                </label>
                <input
                  type="date"
                  value={historiaFecha}
                  onChange={(e) => setHistoriaFecha(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-[#00A651]"
                />
              </div>
            </div>
          </div>

          {/* Banner de Error */}
          {historialError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{historialError}</span>
            </div>
          )}

          {/* Listado de Sesiones Reales */}
          {loadingHistorial ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
              <RefreshCw className="w-8 h-8 text-[#00A651] animate-spin mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-600">Consultando sesiones de clase en Supabase...</p>
            </div>
          ) : sesionesHistorial.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
              <h4 className="font-extrabold text-sm text-slate-700">No se encontraron registros de asistencia para los criterios seleccionados.</h4>
              <p className="text-xs text-slate-500">
                Las asistencias guardadas por los docentes en las sesiones de clase aparecerán en este historial.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-extrabold text-slate-600">
                  {sesionesHistorial.length} {sesionesHistorial.length === 1 ? 'sesión registrada' : 'sesiones registradas'}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">Toca una tarjeta para ver la lista de alumnos</span>
              </div>

              {sesionesHistorial.map((ses) => {
                const isExpanded = expandedSesionId === ses.id;

                return (
                  <div
                    key={ses.id}
                    className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden transition-all"
                  >
                    {/* Header de la Tarjeta de Sesión */}
                    <div
                      onClick={() => setExpandedSesionId(isExpanded ? null : ses.id)}
                      className="p-4 cursor-pointer hover:bg-slate-50 transition-colors space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 font-bold text-[11px] rounded-lg border border-slate-200">
                              {ses.fecha}
                            </span>
                            <span className="px-2.5 py-0.5 bg-emerald-50 text-[#00A651] font-bold text-[11px] rounded-lg border border-emerald-200">
                              {ses.grupo_nombre}
                            </span>
                            <span className="text-xs font-semibold text-slate-500">
                              {ses.sede_nombre}
                            </span>
                          </div>
                          <h4 className="font-extrabold text-base text-[#17324D] mt-1">
                            {ses.materia}
                          </h4>
                          <p className="text-xs text-slate-500 font-medium">
                            Docente: <strong className="text-slate-700">{ses.docente_nombre}</strong>
                          </p>
                        </div>

                        {/* Porcentaje de Asistencia */}
                        <div className="text-right shrink-0">
                          <div className="inline-flex items-center gap-1">
                            <span className={`text-xl font-extrabold ${ses.porcentaje >= 80 ? 'text-[#00A651]' : ses.porcentaje >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                              {ses.porcentaje}%
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Asistencia</p>
                          <div className="mt-1 flex justify-end">
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Barra de Resumen de Estados */}
                      <div className="grid grid-cols-5 gap-1 pt-2 border-t border-slate-100 text-center">
                        <div className="bg-slate-50 p-1.5 rounded-xl">
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Total</p>
                          <p className="text-xs font-extrabold text-slate-700">{ses.total}</p>
                        </div>
                        <div className="bg-emerald-50 p-1.5 rounded-xl border border-emerald-100">
                          <p className="text-[9px] font-bold text-emerald-700 uppercase">Pres.</p>
                          <p className="text-xs font-extrabold text-emerald-800">{ses.presentes}</p>
                        </div>
                        <div className="bg-amber-50 p-1.5 rounded-xl border border-amber-100">
                          <p className="text-[9px] font-bold text-amber-700 uppercase">Atraso</p>
                          <p className="text-xs font-extrabold text-amber-800">{ses.atrasos}</p>
                        </div>
                        <div className="bg-red-50 p-1.5 rounded-xl border border-red-100">
                          <p className="text-[9px] font-bold text-red-700 uppercase">Falta</p>
                          <p className="text-xs font-extrabold text-red-800">{ses.faltas}</p>
                        </div>
                        <div className="bg-blue-50 p-1.5 rounded-xl border border-blue-100">
                          <p className="text-[9px] font-bold text-blue-700 uppercase">Lic.</p>
                          <p className="text-xs font-extrabold text-blue-800">{ses.licencias}</p>
                        </div>
                      </div>
                    </div>

                    {/* Detalle Desplegable de Estudiantes */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-slate-100 bg-slate-50/70 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-600 px-1">
                          <span>Nómina de la Sesión ({ses.estudiantes_detalle.length} estudiantes)</span>
                          <span className="text-[10px] text-slate-400 font-normal">Estado individual</span>
                        </div>

                        {ses.estudiantes_detalle.length === 0 ? (
                          <p className="text-xs text-slate-500 text-center py-3">No hay estudiantes asociados en esta sesión.</p>
                        ) : (
                          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                            {ses.estudiantes_detalle.map((st, idx) => (
                              <div
                                key={st.id}
                                className="bg-white p-2.5 rounded-2xl border border-slate-200 flex items-center justify-between gap-2 shadow-2xs"
                              >
                                <div className="min-w-0">
                                  <p className="text-xs font-extrabold text-slate-800 truncate">
                                    <span className="text-slate-400 font-medium mr-1.5">{idx + 1}.</span>
                                    {st.nombre_completo}
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-mono">
                                    Cód: {st.codigo_interno}
                                  </p>
                                </div>

                                <div className="shrink-0">
                                  {st.estado === 'presente' && (
                                    <span className="px-2.5 py-1 bg-emerald-100 text-[#00A651] font-extrabold text-[10px] rounded-lg inline-flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>Presente</span>
                                    </span>
                                  )}
                                  {st.estado === 'atraso' && (
                                    <span className="px-2.5 py-1 bg-amber-100 text-amber-800 font-extrabold text-[10px] rounded-lg inline-flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      <span>Atraso</span>
                                    </span>
                                  )}
                                  {st.estado === 'falta' && (
                                    <span className="px-2.5 py-1 bg-red-100 text-red-700 font-extrabold text-[10px] rounded-lg inline-flex items-center gap-1">
                                      <XCircle className="w-3 h-3" />
                                      <span>Falta</span>
                                    </span>
                                  )}
                                  {st.estado === 'licencia' && (
                                    <span className="px-2.5 py-1 bg-blue-100 text-blue-700 font-extrabold text-[10px] rounded-lg inline-flex items-center gap-1">
                                      <BookOpen className="w-3 h-3" />
                                      <span>Licencia</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= REPORTE DE ASISTENCIA DOCENTE ================= */}
      {activeTab === 'asistencia_docente' && (
        <div className="space-y-4">
          {/* Panel de Filtros */}
          <div className="p-4 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-800 font-extrabold text-sm">
                <Filter className="w-4 h-4 text-[#00A651]" />
                <span>Filtros de Asistencia Docente</span>
              </div>
              {(docenteFilterSede !== 'todas' ||
                docenteFilterDocenteId !== 'todos' ||
                docenteFilterMes !== '' ||
                docenteFilterFechaInicio !== '' ||
                docenteFilterFechaFin !== '' ||
                docenteFilterEstado !== 'todos') && (
                <button
                  onClick={() => {
                    setDocenteFilterSede('todas');
                    setDocenteFilterDocenteId('todos');
                    setDocenteFilterMes('');
                    setDocenteFilterFechaInicio('');
                    setDocenteFilterFechaFin('');
                    setDocenteFilterEstado('todos');
                  }}
                  className="text-[11px] font-bold text-slate-500 hover:text-red-600 transition-colors"
                >
                  Restablecer Filtros
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Filtro Sede */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Sede Educativa
                </label>
                <select
                  value={docenteFilterSede}
                  onChange={(e) => {
                    setDocenteFilterSede(e.target.value);
                    setDocenteFilterDocenteId('todos');
                  }}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-[#00A651]"
                >
                  <option value="todas">Todas las sedes</option>
                  {dbSedes.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Filtro Docente */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Docente
                </label>
                <select
                  value={docenteFilterDocenteId}
                  onChange={(e) => setDocenteFilterDocenteId(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-[#00A651]"
                >
                  <option value="todos">Todos los docentes</option>
                  {filteredDocentesForFilter.map(d => (
                    <option key={d.id} value={d.id}>{d.nombre_completo}</option>
                  ))}
                </select>
              </div>

              {/* Filtro Estado */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Estado
                </label>
                <select
                  value={docenteFilterEstado}
                  onChange={(e) => setDocenteFilterEstado(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-[#00A651]"
                >
                  <option value="todos">Todos los estados</option>
                  <option value="puntual">Puntual</option>
                  <option value="atraso">Atraso</option>
                  <option value="falta">Falta</option>
                  <option value="licencia">Licencia</option>
                  <option value="registro_incompleto">Registro Incompleto</option>
                  <option value="salida_anticipada">Salida Anticipada</option>
                </select>
              </div>

              {/* Filtro Mes o Rango */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Mes Específico
                </label>
                <input
                  type="month"
                  value={docenteFilterMes}
                  onChange={(e) => {
                    setDocenteFilterMes(e.target.value);
                    if (e.target.value) {
                      setDocenteFilterFechaInicio('');
                      setDocenteFilterFechaFin('');
                    }
                  }}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-[#00A651]"
                />
              </div>
            </div>

            {/* Rango de Fechas Opcional */}
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs">
              <span className="text-[11px] font-bold text-slate-500">O rango personalizado:</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={docenteFilterFechaInicio}
                  onChange={(e) => {
                    setDocenteFilterFechaInicio(e.target.value);
                    if (e.target.value) setDocenteFilterMes('');
                  }}
                  className="h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-[#00A651]"
                />
                <span className="text-slate-400 font-bold">a</span>
                <input
                  type="date"
                  value={docenteFilterFechaFin}
                  onChange={(e) => {
                    setDocenteFilterFechaFin(e.target.value);
                    if (e.target.value) setDocenteFilterMes('');
                  }}
                  className="h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-[#00A651]"
                />
              </div>
            </div>
          </div>

          {/* Banner de Error */}
          {docentesError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{docentesError}</span>
            </div>
          )}

          {/* Tarjetas de Resumen Métrico */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-extrabold uppercase tracking-wider">Total Registros</span>
                <FileText className="w-4 h-4 text-[#17324D]" />
              </div>
              <p className="text-2xl font-black text-[#17324D]">{resumenDocente.total}</p>
              <p className="text-[10px] text-slate-400 font-semibold">{resumenDocente.totalHoras} hrs acumuladas</p>
            </div>

            <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-emerald-600">
                <span className="text-[11px] font-extrabold uppercase tracking-wider">Puntuales</span>
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <p className="text-2xl font-black text-emerald-600">{resumenDocente.puntuales}</p>
              <p className="text-[10px] text-slate-400 font-semibold">
                {resumenDocente.total > 0 ? Math.round((resumenDocente.puntuales / resumenDocente.total) * 100) : 0}% del total
              </p>
            </div>

            <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-amber-600">
                <span className="text-[11px] font-extrabold uppercase tracking-wider">Atrasos</span>
                <Clock className="w-4 h-4" />
              </div>
              <p className="text-2xl font-black text-amber-600">{resumenDocente.atrasos}</p>
              <p className="text-[10px] text-slate-400 font-semibold">
                {resumenDocente.total > 0 ? Math.round((resumenDocente.atrasos / resumenDocente.total) * 100) : 0}% del total
              </p>
            </div>

            <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-red-600">
                <span className="text-[11px] font-extrabold uppercase tracking-wider">Faltas</span>
                <XCircle className="w-4 h-4" />
              </div>
              <p className="text-2xl font-black text-red-600">{resumenDocente.faltas}</p>
              <p className="text-[10px] text-slate-400 font-semibold">
                {resumenDocente.total > 0 ? Math.round((resumenDocente.faltas / resumenDocente.total) * 100) : 0}% del total
              </p>
            </div>

            <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-blue-600">
                <span className="text-[11px] font-extrabold uppercase tracking-wider">Licencias</span>
                <BookOpen className="w-4 h-4" />
              </div>
              <p className="text-2xl font-black text-blue-600">{resumenDocente.licencias}</p>
              <p className="text-[10px] text-slate-400 font-semibold">Justificadas</p>
            </div>

            <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-purple-600">
                <span className="text-[11px] font-extrabold uppercase tracking-wider">Incompletos</span>
                <AlertCircle className="w-4 h-4" />
              </div>
              <p className="text-2xl font-black text-purple-600">{resumenDocente.incompletos}</p>
              <p className="text-[10px] text-slate-400 font-semibold">Sin marcación salida</p>
            </div>
          </div>

          {/* Tabla de Registros Reales */}
          {loadingDocentes ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
              <RefreshCw className="w-8 h-8 text-[#00A651] animate-spin mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-600">Consultando asistencias docentes en Supabase...</p>
            </div>
          ) : asistenciasDocentesList.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
              <h4 className="font-extrabold text-sm text-slate-700">No se encontraron registros de asistencia docente para los filtros aplicados.</h4>
              <p className="text-xs text-slate-500">
                Las marcaciones registradas por los docentes desde su módulo aparecerán en este reporte institucional.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#17324D]">
                  Mostrando {asistenciasDocentesList.length} {asistenciasDocentesList.length === 1 ? 'registro' : 'registros'}
                </span>
                <span className="text-[11px] text-slate-400 font-semibold">
                  Datos en tiempo real desde Supabase
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4">Docente</th>
                      <th className="py-3 px-4">Sede</th>
                      <th className="py-3 px-4">Ingreso</th>
                      <th className="py-3 px-4">Salida</th>
                      <th className="py-3 px-4 text-center">Atraso</th>
                      <th className="py-3 px-4 text-center">Horas</th>
                      <th className="py-3 px-4 text-center">Estado</th>
                      <th className="py-3 px-4 text-center">Origen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {asistenciasDocentesList.map((asist) => {
                      const horaIngreso = asist.hora_ingreso_oficial || asist.hora_ingreso_local || '--:--';
                      const horaSalida = asist.hora_salida_oficial || asist.hora_salida_local || '--:--';
                      const minutosAtraso = asist.minutos_atraso || 0;
                      const horasTrabajadas = asist.horas_trabajadas || 0;
                      const isOffline = asist.origen_registro === 'sin_conexion';

                      return (
                        <tr key={asist.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Fecha */}
                          <td className="py-3 px-4 font-bold text-slate-800 whitespace-nowrap">
                            {asist.fecha_laboral}
                          </td>

                          {/* Docente */}
                          <td className="py-3 px-4 font-extrabold text-[#17324D] whitespace-nowrap">
                            {asist.docente_nombre || 'Docente sin asignar'}
                          </td>

                          {/* Sede */}
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                            {asist.sede_nombre || 'Sede General'}
                          </td>

                          {/* Hora Ingreso */}
                          <td className="py-3 px-4 font-mono font-bold text-slate-800 whitespace-nowrap">
                            {horaIngreso}
                          </td>

                          {/* Hora Salida */}
                          <td className="py-3 px-4 font-mono font-bold text-slate-800 whitespace-nowrap">
                            {horaSalida}
                          </td>

                          {/* Minutos Atraso */}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {minutosAtraso > 0 ? (
                              <span className="font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                                {minutosAtraso} min
                              </span>
                            ) : (
                              <span className="text-slate-400 font-semibold">0 min</span>
                            )}
                          </td>

                          {/* Horas Trabajadas */}
                          <td className="py-3 px-4 text-center font-bold text-slate-800 whitespace-nowrap">
                            {horasTrabajadas > 0 ? `${horasTrabajadas}h` : '--'}
                          </td>

                          {/* Estado */}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {asist.estado === 'puntual' && (
                              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-extrabold text-[11px] rounded-lg inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Puntual</span>
                              </span>
                            )}
                            {asist.estado === 'atraso' && (
                              <span className="px-2.5 py-1 bg-amber-100 text-amber-800 font-extrabold text-[11px] rounded-lg inline-flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                <span>Atraso</span>
                              </span>
                            )}
                            {asist.estado === 'falta' && (
                              <span className="px-2.5 py-1 bg-red-100 text-red-800 font-extrabold text-[11px] rounded-lg inline-flex items-center gap-1">
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Falta</span>
                              </span>
                            )}
                            {asist.estado === 'licencia' && (
                              <span className="px-2.5 py-1 bg-blue-100 text-blue-800 font-extrabold text-[11px] rounded-lg inline-flex items-center gap-1">
                                <BookOpen className="w-3.5 h-3.5" />
                                <span>Licencia</span>
                              </span>
                            )}
                            {asist.estado === 'registro_incompleto' && (
                              <span className="px-2.5 py-1 bg-purple-100 text-purple-800 font-extrabold text-[11px] rounded-lg inline-flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>Incompleto</span>
                              </span>
                            )}
                            {asist.estado === 'salida_anticipada' && (
                              <span className="px-2.5 py-1 bg-orange-100 text-orange-800 font-extrabold text-[11px] rounded-lg inline-flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                <span>Salida Anticipada</span>
                              </span>
                            )}
                            {asist.estado === 'pendiente_verificacion' && (
                              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-extrabold text-[11px] rounded-lg inline-flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>Pendiente</span>
                              </span>
                            )}
                          </td>

                          {/* Origen del Registro */}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {isOffline ? (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md font-bold text-[10px] inline-flex items-center gap-1">
                                <WifiOff className="w-3 h-3" />
                                <span>Sin Conexión</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-emerald-50 text-[#00A651] border border-emerald-200 rounded-md font-bold text-[10px] inline-flex items-center gap-1">
                                <Wifi className="w-3 h-3" />
                                <span>En Línea</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'estadistico' && (
        /* ================= REPORTE ESTADÍSTICO DE ESTUDIANTES ================= */
        <div className="space-y-5">
          {/* Banner de Error Estadístico */}
          {estadisticoError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{estadisticoError}</span>
            </div>
          )}

          {/* Filters Bar */}
          <div className="p-4 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Filter className="w-4 h-4 text-[#00A651]" />
                Filtros Estadísticos
              </h3>

              <button
                onClick={handleDownloadExcelEstadistico}
                id="btn-descargar-excel-estadistico"
                className="h-9 px-4 bg-[#00A651] hover:bg-[#008f45] text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition-all"
              >
                <FileSpreadsheet className="w-4 h-4 text-[#FFC845]" />
                <span>Descargar Excel</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs font-bold">
              {/* 1. Sede */}
              <div>
                <label className="block text-slate-700 mb-1">Sede</label>
                <select
                  value={filterSede}
                  onChange={e => setFilterSede(e.target.value)}
                  className="w-full h-10 px-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium text-slate-900"
                >
                  <option value="Todas">Todas las Sedes</option>
                  {dbSedes.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>

              {/* 2. Programa */}
              <div>
                <label className="block text-slate-700 mb-1">Programa</label>
                <select
                  value={filterPrograma}
                  onChange={e => setFilterPrograma(e.target.value)}
                  className="w-full h-10 px-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium text-slate-900"
                >
                  <option value="Todos">Todos los Programas</option>
                  {availableProgramas.map(progCode => (
                    <option key={progCode} value={progCode}>{progCode}</option>
                  ))}
                </select>
              </div>

              {/* 3. Nivel */}
              <div>
                <label className="block text-slate-700 mb-1">Nivel</label>
                <select
                  value={filterNivel}
                  onChange={e => setFilterNivel(e.target.value)}
                  className="w-full h-10 px-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium text-slate-900"
                >
                  <option value="Todos">Todos los Niveles</option>
                  {availableNiveles.map(niv => (
                    <option key={niv} value={niv}>{niv}</option>
                  ))}
                </select>
              </div>

              {/* 4. Sexo */}
              <div>
                <label className="block text-slate-700 mb-1">Sexo</label>
                <select
                  value={filterSexo}
                  onChange={e => setFilterSexo(e.target.value)}
                  className="w-full h-10 px-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium text-slate-900"
                >
                  <option value="Todos">Todos</option>
                  <option value="Masculino">Masculino / Varones</option>
                  <option value="Femenino">Femenino / Mujeres</option>
                  <option value="SinEspecificar">Sin especificar</option>
                </select>
              </div>

              {/* 5. Gestión */}
              <div>
                <label className="block text-slate-700 mb-1">Gestión</label>
                <select
                  value={filterGestion}
                  onChange={e => setFilterGestion(e.target.value)}
                  className="w-full h-10 px-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium text-slate-900"
                >
                  <option value="Todas">Todas las Gestiones</option>
                  <option value="2026">Gestión 2026</option>
                  <option value="2025">Gestión 2025</option>
                  <option value="2024">Gestión 2024</option>
                </select>
              </div>
            </div>
          </div>

          {/* LARGE KPI CARDS FOR MOBILE & DESKTOP */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Inscritos */}
            <div className="p-5 bg-gradient-to-br from-[#17324D] to-slate-900 text-white rounded-3xl shadow-md space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                  Total Inscritos
                </span>
                <Users className="w-6 h-6 text-[#FFC845]" />
              </div>
              <div className="text-4xl font-black">{totalInscritos}</div>
              <p className="text-[11px] text-slate-300 font-medium">
                Estudiantes registrados según filtros seleccionados
              </p>
            </div>

            {/* Card 2: Activos vs Inactivos */}
            <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs font-extrabold uppercase text-slate-500">
                <span>Estado Estudiantil</span>
                <UserCheck className="w-5 h-5 text-[#00A651]" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-[#00A651]">{activos}</span>
                <span className="text-xs font-bold text-slate-400">activos ({percentActivos}%)</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                <div style={{ width: `${percentActivos}%` }} className="bg-[#00A651] h-full" />
                <div style={{ width: `${percentInactivos}%` }} className="bg-red-500 h-full" />
              </div>
              <div className="flex justify-between text-[11px] font-bold pt-1 text-slate-600">
                <span>Inactivos/Retirados: <strong className="text-red-600">{inactivos}</strong></span>
                <span>{percentInactivos}%</span>
              </div>
            </div>

            {/* Card 3: Distribución por Sexo */}
            <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs font-extrabold uppercase text-slate-500">
                <span>Distribución por Sexo</span>
                <PieChart className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="grid grid-cols-2 gap-2 text-center pt-1">
                <div className="p-2 bg-blue-50 border border-blue-200 rounded-2xl">
                  <span className="text-[10px] font-extrabold text-blue-700 block uppercase">Masculino</span>
                  <strong className="text-xl font-black text-blue-900">{hombres}</strong>
                  <span className="text-[10px] text-blue-600 font-bold block">({percentHombres}%)</span>
                </div>
                <div className="p-2 bg-pink-50 border border-pink-200 rounded-2xl">
                  <span className="text-[10px] font-extrabold text-pink-700 block uppercase">Femenino</span>
                  <strong className="text-xl font-black text-pink-900">{mujeres}</strong>
                  <span className="text-[10px] text-pink-600 font-bold block">({percentMujeres}%)</span>
                </div>
              </div>
              {sinSexo > 0 && (
                <div className="text-[11px] font-medium text-slate-500 text-center bg-slate-50 py-1 px-2 rounded-xl border border-slate-200">
                  Sin especificar: <strong className="text-slate-800">{sinSexo}</strong> ({percentSinSexo}%)
                </div>
              )}
            </div>

            {/* Card 4: Sede Activa */}
            <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-2 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-extrabold uppercase text-slate-500">
                <span>Filtro Actual</span>
                <Building2 className="w-5 h-5 text-[#00A651]" />
              </div>
              <div>
                <h4 className="font-extrabold text-base text-[#17324D]">
                  {dbSedes.find(s => s.id === filterSede)?.nombre || 'Todas las Sedes'}
                </h4>
                <p className="text-xs text-slate-500 font-medium">Programa: {filterPrograma} • Nivel: {filterNivel}</p>
              </div>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 self-start">
                Cálculo automático en vivo
              </span>
            </div>
          </div>

          {/* DETAILED CARDS BY PROGRAM AND LEVEL */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* 1. Cantidad por Programa (EPA, ESA, ETA, EDUPER, CEE) */}
            <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-[#00A651]" />
                  <h3 className="font-extrabold text-base text-[#17324D]">Estudiantes por Programa</h3>
                </div>
                <span className="text-xs font-bold text-slate-400">Total: {totalInscritos}</span>
              </div>

              <div className="space-y-3">
                {Object.keys(programCounts).length === 0 ? (
                  <p className="text-xs text-slate-400 font-medium py-3 text-center">Sin datos para los filtros seleccionados</p>
                ) : (
                  Object.entries(programCounts).map(([code, count]) => {
                    const cnt = Number(count);
                    const pct = totalInscritos > 0 ? Math.round((cnt / totalInscritos) * 100) : 0;
                    return (
                      <div key={code} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-[#17324D] font-extrabold flex items-center gap-1.5">
                            <span className="px-2 py-0.5 bg-[#00A651] text-white text-[10px] rounded-md font-bold">
                              {code}
                            </span>
                          </span>
                          <span className="text-slate-700 font-extrabold">
                            {count} est. <span className="text-slate-400 font-medium">({pct}%)</span>
                          </span>
                        </div>

                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div style={{ width: `${pct}%` }} className="bg-[#00A651] h-full transition-all" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 2. Cantidad por Nivel (Elemental, Avanzado, Técnico Básico, etc.) */}
            <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-extrabold text-base text-[#17324D]">Estudiantes por Nivel Educativo</h3>
                </div>
                <span className="text-xs font-bold text-slate-400">Total: {totalInscritos}</span>
              </div>

              <div className="space-y-3">
                {Object.keys(levelCounts).length === 0 ? (
                  <p className="text-xs text-slate-400 font-medium py-3 text-center">Sin datos para los filtros seleccionados</p>
                ) : (
                  Object.entries(levelCounts).map(([nivelName, count]) => {
                    const cnt = Number(count);
                    const pct = totalInscritos > 0 ? Math.round((cnt / totalInscritos) * 100) : 0;
                    return (
                      <div key={nivelName} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-[#17324D]">{nivelName}</span>
                          <span className="text-slate-700 font-extrabold">
                            {count} est. <span className="text-slate-400 font-medium">({pct}%)</span>
                          </span>
                        </div>

                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div style={{ width: `${pct}%` }} className="bg-indigo-600 h-full transition-all" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* SUMMARY TABLE: CANTIDAD POR SEDE Y GRUPO */}
          <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-[#17324D]">Distribución por Sede y Grupo</h3>
                <p className="text-xs text-slate-500 font-medium">Resumen automático por curso y campus educativo</p>
              </div>

              <button
                onClick={handleDownloadExcelEstadistico}
                className="self-start sm:self-auto h-9 px-3 bg-emerald-50 hover:bg-emerald-100 text-[#00A651] font-bold text-xs rounded-xl border border-emerald-200 flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar Tabla en Excel</span>
              </button>
            </div>

            {/* Mobile View: Large Touch Cards */}
            <div className="block sm:hidden space-y-3">
              {sedeGrupoList.map((sg, idx) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                        {sg.sede}
                      </span>
                      <h4 className="font-extrabold text-sm text-[#17324D] mt-1">{sg.grupo}</h4>
                    </div>
                    <span className="text-lg font-black text-[#00A651]">{sg.total} est.</span>
                  </div>
                  <div className="flex justify-between text-xs pt-1 border-t border-slate-200 font-medium text-slate-600">
                    <span>Activos: <strong className="text-[#00A651]">{sg.activos}</strong></span>
                    <span>Inactivos/Retirados: <strong className="text-red-600">{sg.inactivos}</strong></span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop / Tablet View: Summary Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 text-[#17324D] font-extrabold uppercase border-b border-slate-200">
                    <th className="p-3 rounded-l-xl">Sede Educativa</th>
                    <th className="p-3">Grupo / Curso</th>
                    <th className="p-3 text-center">Total Inscritos</th>
                    <th className="p-3 text-center">Activos</th>
                    <th className="p-3 text-center rounded-r-xl">Inactivos / Retirados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {sedeGrupoList.map((sg, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-3 font-extrabold text-[#17324D]">{sg.sede}</td>
                      <td className="p-3">{sg.grupo}</td>
                      <td className="p-3 text-center font-bold text-[#00A651]">{sg.total}</td>
                      <td className="p-3 text-center">
                        <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold">
                          {sg.activos}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2.5 py-0.5 bg-red-100 text-red-800 rounded-full font-bold">
                          {sg.inactivos}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {sedeGrupoList.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-400 font-medium">
                        No hay estudiantes que coincidan con los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= PLANILLAS EN EXCEL EXISTENTES ================= */}
      {activeTab === 'planillas' && (
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-3xl border border-slate-200 space-y-3">
            <h3 className="font-extrabold text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-[#00A651]" />
              Filtros para Planillas
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs font-bold">
              <div>
                <label className="block text-slate-700 mb-1">Mes / Gestión</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Sede Educativa</label>
                <select
                  value={selectedSedePlanilla}
                  onChange={e => setSelectedSedePlanilla(e.target.value)}
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none"
                >
                  <option value="Todas">Todas las Sedes</option>
                  {dbSedes.map(s => (
                    <option key={s.id} value={s.nombre}>{s.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-[#00A651] flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-[#17324D]">Reporte Mensual de Asistencia Docente</h4>
                  <p className="text-xs text-slate-500 font-medium">Incluye marcaciones diarias, atrasos, origen offline y hoja de Resumen Mensual</p>
                </div>
              </div>
              <button
                onClick={handleDownloadAsistenciaDocente}
                className="w-full h-12 bg-[#00A651] hover:bg-[#008f45] text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4 text-[#FFC845]" />
                <span>Descargar Reporte Docente (.xlsx)</span>
              </button>
            </div>

            <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-100 text-[#11B8AE] flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-[#17324D]">Nómina Oficial de Estudiantes Inscritos</h4>
                  <p className="text-xs text-slate-500 font-medium">Lista completa por sede, programa, grupo, especialidad y estado activo/retiro</p>
                </div>
              </div>
              <button
                onClick={handleDownloadInscritos}
                className="w-full h-12 bg-[#11B8AE] hover:bg-teal-700 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4 text-white" />
                <span>Descargar Nómina de Estudiantes (.xlsx)</span>
              </button>
            </div>

            <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-[#17324D]">Estudiantes en Riesgo y Seguimientos</h4>
                  <p className="text-xs text-slate-500 font-medium">Reporte de inasistencias consecutivas y compromisos asumidos por docentes</p>
                </div>
              </div>
              <button
                onClick={handleDownloadRiesgo}
                disabled={downloadingRiesgo}
                className="w-full h-12 bg-[#17324D] hover:bg-slate-900 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
              >
                {downloadingRiesgo ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#FFC845]" />
                ) : (
                  <Download className="w-4 h-4 text-[#FFC845]" />
                )}
                <span>{downloadingRiesgo ? 'Generando Reporte...' : 'Descargar Reporte de Riesgo y Seguimiento (.xlsx)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
