import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Printer,
  FileSpreadsheet,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  BookOpen,
  Filter,
  RefreshCw,
  Eye,
  X,
  Layers,
  Sparkles,
  ShieldCheck,
  Building,
  GraduationCap,
  Download,
  AlertCircle
} from 'lucide-react';
import {
  Perfil,
  Estudiante,
  Grupo,
  SesionClase,
  AsistenciaEstudiante,
  DatosInstitucionales,
  ConfiguracionCalendario
} from '../types';
import { getLocalDatosInstitucionales } from '../lib/institutional';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getBoliviaTodayDate, formatAcademicDate } from '../lib/geo';
import {
  downloadMonthlyAttendanceSheetExcel,
  downloadDailyAttendanceReportExcel
} from '../lib/excelExport';
import {
  loadConfiguracionesCalendario,
  loadDiasNoLaborales,
  loadPeriodosAcademicos,
  getDiasLaboralesOficialesMes,
  DiaCalendarioOficial,
  DiaNoLaboral,
  PeriodoAcademico
} from '../lib/calendar';

interface OfficialAttendanceSheetsProps {
  user: Perfil;
  assignedGroups: Array<{ id: string; nombre: string; materia: string }>;
  isDirectorOrAdmin: boolean;
  isOnline: boolean;
  datosInstitucionales?: DatosInstitucionales;
}

export const OfficialAttendanceSheets: React.FC<OfficialAttendanceSheetsProps> = ({
  user,
  assignedGroups,
  isDirectorOrAdmin,
  isOnline,
  datosInstitucionales,
}) => {
  const institucion = datosInstitucionales || getLocalDatosInstitucionales();
  const todayIso = useMemo(() => getBoliviaTodayDate(), []);
  const defaultMonth = useMemo(() => todayIso.slice(0, 7), [todayIso]);

  // Mode: Monthly Matrix or Daily Report
  const [sheetType, setSheetType] = useState<'mensual' | 'diario'>('mensual');

  // Selected parameters
  const [selectedGrupoId, setSelectedGrupoId] = useState<string>(
    assignedGroups.length > 0 ? assignedGroups[0].id : ''
  );
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [materiaInput, setMateriaInput] = useState<string>('');
  const [docenteInput, setDocenteInput] = useState<string>(
    user.rol === 'docente' ? user.nombre_completo : ''
  );

  // Loaded data from Supabase
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [groupDetails, setGroupDetails] = useState<Grupo | null>(null);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [sesionesMensuales, setSesionesMensuales] = useState<Array<{ id: string; fecha: string; materia: string; docente_id?: string }>>([]);
  const [asistenciasMap, setAsistenciasMap] = useState<Record<string, Record<string, 'presente' | 'atraso' | 'falta' | 'licencia'>>>({});
  
  // Institutional Calendar states
  const [configsCalendario, setConfigsCalendario] = useState<ConfiguracionCalendario[]>([]);
  const [diasNoLaborales, setDiasNoLaborales] = useState<DiaNoLaboral[]>([]);
  const [periodosAcademicos, setPeriodosAcademicos] = useState<PeriodoAcademico[]>([]);

  // Daily specific session
  const [dailySesion, setDailySesion] = useState<SesionClase | null>(null);
  const [dailyAsistencias, setDailyAsistencias] = useState<Array<{ estudiante_id: string; estado: 'presente' | 'atraso' | 'falta' | 'licencia'; observacion?: string }>>([]);

  // Print Preview Modal state
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // Sync selected group if assignedGroups changes
  useEffect(() => {
    if (assignedGroups.length > 0 && (!selectedGrupoId || !assignedGroups.some(g => g.id === selectedGrupoId))) {
      setSelectedGrupoId(assignedGroups[0].id);
    }
  }, [assignedGroups, selectedGrupoId]);

  // Load calendar configs, holidays, and academic periods
  useEffect(() => {
    async function loadCalendarBase() {
      try {
        const [configs, noLaborales, periodos] = await Promise.all([
          loadConfiguracionesCalendario(),
          loadDiasNoLaborales(),
          loadPeriodosAcademicos()
        ]);
        setConfigsCalendario(configs);
        setDiasNoLaborales(noLaborales);
        setPeriodosAcademicos(periodos);
      } catch (e) {
        console.warn('Error al cargar base de calendario institucional:', e);
      }
    }
    loadCalendarBase();
  }, []);

  // Compute official institutional working days for the selected month
  const diasLaborales = useMemo(() => {
    return getDiasLaboralesOficialesMes(selectedMonth, {
      configuraciones: configsCalendario,
      diasNoLaborales,
      periodos: periodosAcademicos
    });
  }, [selectedMonth, configsCalendario, diasNoLaborales, periodosAcademicos]);

  // Map recorded sessions by date string
  const sesionPorFechaMap = useMemo(() => {
    const map: Record<string, { id: string; fecha: string; materia: string; docente_id?: string }> = {};
    sesionesMensuales.forEach(s => {
      map[s.fecha] = s;
    });
    return map;
  }, [sesionesMensuales]);

  // Load complete data from Supabase for the selected group & time frame
  const loadSheetData = useCallback(async () => {
    if (!selectedGrupoId) {
      setEstudiantes([]);
      setSesionesMensuales([]);
      setAsistenciasMap({});
      setDailySesion(null);
      setDailyAsistencias([]);
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setFetchError('Supabase no está configurado.');
      return;
    }

    setLoading(true);
    setFetchError(null);

    try {
      // 1. Fetch group info (carrera, nivel, sede)
      const { data: gData, error: gError } = await supabase
        .from('grupos')
        .select(`
          id,
          nombre,
          carrera_especialidad,
          nivel,
          sede_id,
          activo,
          sedes (nombre)
        `)
        .eq('id', selectedGrupoId)
        .maybeSingle();

      if (gError) {
        console.warn('Error al cargar grupo:', gError);
      }

      if (gData) {
        setGroupDetails({
          ...gData,
          sede_nombre: (gData as any).sedes?.nombre || 'Sede General'
        });
        if (!materiaInput) {
          setMateriaInput(gData.carrera_especialidad || 'Docencia General');
        }
      }

      // 2. Fetch active students in this group
      const { data: stData, error: stError } = await supabase
        .from('estudiantes')
        .select(`
          id,
          codigo_interno,
          nombre_completo,
          documento,
          carrera_especialidad,
          nivel,
          grupo_id,
          estado,
          fecha_inscripcion
        `)
        .eq('grupo_id', selectedGrupoId)
        .eq('estado', 'activo')
        .order('nombre_completo', { ascending: true });

      if (stError) throw stError;

      const mappedStudents: Estudiante[] = (stData || []).map((s: any) => ({
        id: s.id,
        codigo_interno: s.codigo_interno || `EST-${s.id.slice(0, 6)}`,
        nombre_completo: s.nombre_completo,
        documento: s.documento || undefined,
        carrera_especialidad: s.carrera_especialidad || gData?.carrera_especialidad,
        nivel: s.nivel || gData?.nivel,
        grupo_id: s.grupo_id,
        estado: s.estado || 'activo',
        fecha_inscripcion: s.fecha_inscripcion || todayIso,
        programa_id: s.programa_id || '',
        sede_id: s.sede_id || ''
      }));

      setEstudiantes(mappedStudents);

      // If user is director/admin, try to detect assigned teacher name if docenteInput is empty
      if (isDirectorOrAdmin && (!docenteInput || docenteInput === '')) {
        const { data: asigData } = await supabase
          .from('asignaciones_docentes')
          .select('docente_id, materia, perfiles(nombre_completo)')
          .eq('grupo_id', selectedGrupoId)
          .limit(1)
          .maybeSingle();

        if (asigData && (asigData as any).perfiles?.nombre_completo) {
          setDocenteInput((asigData as any).perfiles.nombre_completo);
        } else {
          setDocenteInput(user.nombre_completo);
        }
      }

      // 3. Load Monthly Sessions & Attendances
      const startMonthDate = `${selectedMonth}-01`;
      const endMonthDate = `${selectedMonth}-31`;

      const { data: sesData, error: sesError } = await supabase
        .from('sesiones_clase')
        .select('id, fecha, materia, docente_id, grupo_id')
        .eq('grupo_id', selectedGrupoId)
        .gte('fecha', startMonthDate)
        .lte('fecha', endMonthDate)
        .order('fecha', { ascending: true });

      if (sesError) throw sesError;

      const sessionsList = sesData || [];
      setSesionesMensuales(sessionsList);

      if (sessionsList.length > 0) {
        const sessionIds = sessionsList.map(s => s.id);
        const { data: asisData, error: asisError } = await supabase
          .from('asistencias_estudiantes')
          .select('id, sesion_id, estudiante_id, estado, observacion')
          .in('sesion_id', sessionIds);

        if (asisError) throw asisError;

        // Build nested map: sesionId -> estudianteId -> estado
        const newMap: Record<string, Record<string, 'presente' | 'atraso' | 'falta' | 'licencia'>> = {};
        sessionsList.forEach(s => {
          newMap[s.id] = {};
        });

        (asisData || []).forEach((a: any) => {
          if (a.sesion_id && a.estudiante_id && a.estado) {
            if (!newMap[a.sesion_id]) {
              newMap[a.sesion_id] = {};
            }
            newMap[a.sesion_id][a.estudiante_id] = a.estado;
          }
        });

        setAsistenciasMap(newMap);
      } else {
        setAsistenciasMap({});
      }

      // 4. Load Daily Session & Attendance for selectedDate
      const { data: dailySesData } = await supabase
        .from('sesiones_clase')
        .select('id, fecha, materia, docente_id, grupo_id')
        .eq('grupo_id', selectedGrupoId)
        .eq('fecha', selectedDate)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (dailySesData) {
        setDailySesion(dailySesData as SesionClase);
        if (dailySesData.materia) {
          setMateriaInput(dailySesData.materia);
        }

        const { data: dailyAsisData } = await supabase
          .from('asistencias_estudiantes')
          .select('id, sesion_id, estudiante_id, estado, observacion')
          .eq('sesion_id', dailySesData.id);

        const mappedDaily = (dailyAsisData || []).map((a: any) => ({
          estudiante_id: a.estudiante_id,
          estado: a.estado as 'presente' | 'atraso' | 'falta' | 'licencia',
          observacion: a.observacion || ''
        }));
        setDailyAsistencias(mappedDaily);
      } else {
        setDailySesion(null);
        setDailyAsistencias([]);
      }
    } catch (err: any) {
      console.error('Error al cargar datos de planilla oficial:', err);
      setFetchError(err.message || 'Error al conectar con la base de datos de Supabase.');
    } finally {
      setLoading(false);
    }
  }, [selectedGrupoId, selectedMonth, selectedDate, isDirectorOrAdmin, user.nombre_completo, todayIso, materiaInput, docenteInput]);

  useEffect(() => {
    loadSheetData();
  }, [loadSheetData]);

  // Current selected group label
  const selectedGroupObj = useMemo(() => {
    return assignedGroups.find(g => g.id === selectedGrupoId);
  }, [assignedGroups, selectedGrupoId]);

  const grupoNombreDisplay = groupDetails?.nombre || selectedGroupObj?.nombre || 'Grupo sin seleccionar';
  const carreraDisplay = groupDetails?.carrera_especialidad || selectedGroupObj?.materia || materiaInput || 'Docencia General';
  const nivelDisplay = groupDetails?.nivel || 'Nivel Primario / Secundario';
  const sedeDisplay = (groupDetails as any)?.sede_nombre || 'Sede Central';
  const docenteDisplay = docenteInput || user.nombre_completo;

  // Month text title in Spanish
  const monthTitleFormatted = useMemo(() => {
    try {
      const [y, m] = selectedMonth.split('-');
      const d = new Date(Number(y), Number(m) - 1, 15);
      return d.toLocaleDateString('es-BO', { month: 'long', year: 'numeric' }).toUpperCase();
    } catch {
      return selectedMonth;
    }
  }, [selectedMonth]);

  // Calculation of Student Totals for Monthly Matrix based on Official Working Days
  const monthlyStats = useMemo(() => {
    let totalPres = 0;
    let totalAtr = 0;
    let totalFalt = 0;
    let totalLic = 0;

    const studentRows = estudiantes.map((st, idx) => {
      let p = 0;
      let a = 0;
      let f = 0;
      let l = 0;

      diasLaborales.forEach(dia => {
        const ses = sesionPorFechaMap[dia.fecha];
        if (ses) {
          const estado = asistenciasMap[ses.id]?.[st.id];
          if (estado === 'presente') p++;
          else if (estado === 'atraso') a++;
          else if (estado === 'falta') f++;
          else if (estado === 'licencia') l++;
        }
      });

      const totalSes = p + a + f + l;
      const asistieron = p + a;
      const pct = totalSes > 0 ? Math.round((asistieron / totalSes) * 100) : 0;

      totalPres += p;
      totalAtr += a;
      totalFalt += f;
      totalLic += l;

      return {
        estudiante: st,
        num: idx + 1,
        p,
        a,
        f,
        l,
        totalSes,
        pct
      };
    });

    const totalEfectivos = totalPres + totalAtr + totalFalt + totalLic;
    const generalAsistenciaPct = totalEfectivos > 0
      ? Math.round(((totalPres + totalAtr) / totalEfectivos) * 100)
      : 0;

    return {
      studentRows,
      totalPres,
      totalAtr,
      totalFalt,
      totalLic,
      totalSesionesCount: sesionesMensuales.length,
      totalDiasLaborales: diasLaborales.length,
      generalAsistenciaPct
    };
  }, [estudiantes, diasLaborales, sesionPorFechaMap, asistenciasMap, sesionesMensuales.length]);

  // Daily statistics calculation
  const dailyStats = useMemo(() => {
    const mapDailyState: Record<string, { estado: string; observacion?: string }> = {};
    dailyAsistencias.forEach(a => {
      mapDailyState[a.estudiante_id] = {
        estado: a.estado,
        observacion: a.observacion
      };
    });

    const rows = estudiantes.map((st, idx) => {
      const recorded = mapDailyState[st.id];
      const estado = recorded?.estado || (dailySesion ? 'falta' : 'presente');
      return {
        num: idx + 1,
        id: st.id,
        codigo_interno: st.codigo_interno,
        nombre_completo: st.nombre_completo,
        estado: estado as 'presente' | 'atraso' | 'falta' | 'licencia',
        observacion: recorded?.observacion || ''
      };
    });

    const total = rows.length;
    const p = rows.filter(r => r.estado === 'presente').length;
    const a = rows.filter(r => r.estado === 'atraso').length;
    const f = rows.filter(r => r.estado === 'falta').length;
    const l = rows.filter(r => r.estado === 'licencia').length;
    const pct = total > 0 ? Math.round(((p + a) / total) * 100) : 0;

    return {
      rows,
      total,
      p,
      a,
      f,
      l,
      pct,
      hasSession: Boolean(dailySesion)
    };
  }, [estudiantes, dailyAsistencias, dailySesion]);

  // Handle Excel Export
  const handleExportExcel = () => {
    if (sheetType === 'mensual') {
      downloadMonthlyAttendanceSheetExcel({
        institucion,
        grupoNombre: grupoNombreDisplay,
        carreraEspecialidad: carreraDisplay,
        nivel: nivelDisplay,
        materia: materiaInput || carreraDisplay,
        docenteNombre: docenteDisplay,
        mesAno: selectedMonth,
        estudiantes,
        diasLaborales,
        sesiones: sesionesMensuales,
        asistenciasPorSesionYEstudiante: asistenciasMap
      });
    } else {
      downloadDailyAttendanceReportExcel({
        institucion,
        grupoNombre: grupoNombreDisplay,
        carreraEspecialidad: carreraDisplay,
        nivel: nivelDisplay,
        materia: materiaInput || carreraDisplay,
        docenteNombre: docenteDisplay,
        fecha: selectedDate,
        estudiantes: dailyStats.rows
      });
    }
  };

  // Handle Print Action
  const handleTriggerPrint = () => {
    setShowPrintModal(true);
    // Slight timeout to let DOM render before opening print dialog
    setTimeout(() => {
      window.print();
    }, 400);
  };

  return (
    <div className="space-y-4 pb-20">
      {/* 1. Header Hero of Official Sheets Module */}
      <div className="bg-gradient-to-br from-[#17324D] via-[#1c3f63] to-slate-900 rounded-3xl p-5 text-white shadow-xl border border-slate-700/60 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-400/20 border border-amber-400/40 text-amber-300 flex items-center justify-center font-bold shadow-inner">
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-amber-300 font-extrabold uppercase tracking-wider bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                  {isDirectorOrAdmin ? 'Acceso Directivo General' : 'Docente Titular'}
                </span>
                <span className="text-[10px] text-emerald-300 font-extrabold bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-400/30">
                  Planillas Oficiales
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight mt-0.5">
                Impresión y Exportación de Asistencia
              </h2>
            </div>
          </div>

          <button
            onClick={loadSheetData}
            disabled={loading}
            title="Actualizar datos de Supabase"
            className="p-2 bg-white/10 hover:bg-white/20 active:scale-95 rounded-full text-white transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <p className="text-xs text-slate-300 font-medium">
          {isDirectorOrAdmin
            ? 'Como Director o Superadmin, puedes generar e imprimir las planillas oficiales de cualquier grupo institucional.'
            : 'Como Docente, puedes generar e imprimir las planillas oficiales de tus grupos asignados.'}
        </p>

        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-slate-300 font-medium">
          <span className="text-amber-300 font-extrabold text-[11px]">{institucion.nombre_corto}</span>
          <span className="text-[11px] text-slate-400">SIE: Formato Oficial Ministerio de Educación</span>
        </div>
      </div>

      {/* Database Error Banner */}
      {fetchError && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-red-800 text-xs shadow-xs">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="block font-bold">Aviso de consulta a Supabase</strong>
            <p>{fetchError}</p>
          </div>
          <button
            onClick={loadSheetData}
            className="px-2.5 py-1 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shrink-0 text-[11px]"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* 2. Sheet Type Selector (A: Mensual vs B: Diario) */}
      <div className="bg-slate-200 p-1 rounded-2xl flex gap-1 shadow-inner">
        <button
          type="button"
          onClick={() => setSheetType('mensual')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            sheetType === 'mensual'
              ? 'bg-[#17324D] text-white shadow-md'
              : 'text-slate-700 hover:text-slate-950'
          }`}
        >
          <Calendar className="w-4 h-4 text-amber-300" />
          <span>A) Planilla Mensual Institucional</span>
        </button>

        <button
          type="button"
          onClick={() => setSheetType('diario')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            sheetType === 'diario'
              ? 'bg-[#17324D] text-white shadow-md'
              : 'text-slate-700 hover:text-slate-950'
          }`}
        >
          <Clock className="w-4 h-4 text-emerald-400" />
          <span>B) Reporte Diario de Asistencia</span>
        </button>
      </div>

      {/* 3. Parameter Controls and Filters */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-50 text-blue-700 rounded-xl">
              <Filter className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-sm text-[#17324D]">
              Parámetros de la Planilla Oficial
            </h3>
          </div>
          <span className="text-[11px] font-bold text-slate-400">
            {assignedGroups.length} {assignedGroups.length === 1 ? 'grupo disponible' : 'grupos disponibles'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-bold">
          {/* Grupo Selector */}
          <div>
            <label className="block text-slate-700 mb-1">Grupo / Curso</label>
            <select
              value={selectedGrupoId}
              onChange={e => setSelectedGrupoId(e.target.value)}
              className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500"
            >
              {assignedGroups.length === 0 && (
                <option value="">No hay grupos asignados</option>
              )}
              {assignedGroups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.nombre} ({g.materia || 'General'})
                </option>
              ))}
            </select>
          </div>

          {/* Month or Date Selector depending on Mode */}
          {sheetType === 'mensual' ? (
            <div>
              <label className="block text-slate-700 mb-1">Mes y Gestión</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          ) : (
            <div>
              <label className="block text-slate-700 mb-1">Fecha de la Clase</label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )}

          {/* Materia / Módulo */}
          <div>
            <label className="block text-slate-700 mb-1">Materia / Carrera</label>
            <input
              type="text"
              value={materiaInput}
              onChange={e => setMateriaInput(e.target.value)}
              placeholder="Ej: Computación Básica"
              className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Docente Facilitador */}
          <div>
            <label className="block text-slate-700 mb-1">Docente Facilitador</label>
            <input
              type="text"
              value={docenteInput}
              onChange={e => setDocenteInput(e.target.value)}
              placeholder="Nombre del facilitador"
              className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Action Buttons: Imprimir PDF & Descargar Excel */}
        <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={handleTriggerPrint}
            disabled={estudiantes.length === 0}
            id="btn-imprimir-planilla-pdf"
            className="flex-1 h-12 bg-[#17324D] hover:bg-slate-900 text-white rounded-2xl font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-amber-300" />
            <span>Imprimir / Guardar como PDF</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={estudiantes.length === 0}
            id="btn-descargar-planilla-excel"
            className="flex-1 h-12 bg-[#00A651] hover:bg-[#008f45] text-white rounded-2xl font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#FFC845]" />
            <span>Descargar Planilla en Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* 4. Resumen Estadístico (KPIs) */}
      {sheetType === 'mensual' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-center">
          <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Inscritos</span>
            <strong className="text-xl font-black text-[#17324D]">{estudiantes.length}</strong>
            <span className="text-[10px] text-slate-400 block font-medium">estudiantes</span>
          </div>

          <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Días Hábiles Mes</span>
            <strong className="text-xl font-black text-blue-700">{diasLaborales.length}</strong>
            <span className="text-[10px] text-slate-400 block font-medium">{sesionesMensuales.length} clases reg.</span>
          </div>

          <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Presentes (P)</span>
            <strong className="text-xl font-black text-emerald-700">{monthlyStats.totalPres}</strong>
            <span className="text-[10px] text-emerald-600 block font-medium">asistencias</span>
          </div>

          <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Atrasos (A)</span>
            <strong className="text-xl font-black text-amber-700">{monthlyStats.totalAtr}</strong>
            <span className="text-[10px] text-amber-600 block font-medium">con tolerancia</span>
          </div>

          <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200">
            <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">Faltas (F)</span>
            <strong className="text-xl font-black text-rose-700">{monthlyStats.totalFalt}</strong>
            <span className="text-[10px] text-rose-500 block font-medium">inasistencias</span>
          </div>

          <div className="p-3 bg-slate-900 text-white rounded-2xl border border-slate-800">
            <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider block">% Asistencia</span>
            <strong className="text-xl font-black text-emerald-400">{monthlyStats.generalAsistenciaPct}%</strong>
            <span className="text-[10px] text-slate-400 block font-medium">promedio grupal</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-center">
          <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Nómina Total</span>
            <strong className="text-xl font-black text-[#17324D]">{dailyStats.total}</strong>
            <span className="text-[10px] text-slate-400 block font-medium">estudiantes</span>
          </div>

          <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Presentes</span>
            <strong className="text-xl font-black text-emerald-700">{dailyStats.p}</strong>
            <span className="text-[10px] text-emerald-600 block font-medium">en aula</span>
          </div>

          <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Atrasos</span>
            <strong className="text-xl font-black text-amber-700">{dailyStats.a}</strong>
            <span className="text-[10px] text-amber-600 block font-medium">justificados</span>
          </div>

          <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200">
            <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">Faltas</span>
            <strong className="text-xl font-black text-rose-700">{dailyStats.f}</strong>
            <span className="text-[10px] text-rose-500 block font-medium">ausentes</span>
          </div>

          <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200">
            <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">Licencias</span>
            <strong className="text-xl font-black text-blue-700">{dailyStats.l}</strong>
            <span className="text-[10px] text-blue-500 block font-medium">permisos</span>
          </div>

          <div className="p-3 bg-slate-900 text-white rounded-2xl border border-slate-800">
            <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider block">% Asistencia Día</span>
            <strong className="text-xl font-black text-emerald-400">{dailyStats.pct}%</strong>
            <span className="text-[10px] text-slate-400 block font-medium">de efectividad</span>
          </div>
        </div>
      )}

      {/* 5. Visual Preview Container */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-[#17324D] uppercase tracking-wider">
              {sheetType === 'mensual'
                ? `Vista Previa: Planilla Mensual (${monthTitleFormatted})`
                : `Vista Previa: Reporte Diario (${formatAcademicDate(selectedDate)})`}
            </span>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold text-[10px] rounded-md">
              {grupoNombreDisplay}
            </span>
          </div>

          <span className="text-[11px] text-slate-500 font-medium">
            Mostrando {estudiantes.length} {estudiantes.length === 1 ? 'estudiante' : 'estudiantes'}
          </span>
        </div>

        {/* Empty state */}
        {estudiantes.length === 0 && !loading && (
          <div className="p-10 text-center text-slate-500 space-y-2">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="font-extrabold text-sm text-slate-700">No hay estudiantes activos en este grupo.</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Seleccione otro grupo o inscriba estudiantes en la nómina para generar su planilla oficial.
            </p>
          </div>
        )}

        {/* A) Monthly Matrix View */}
        {sheetType === 'mensual' && estudiantes.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100/80 text-slate-700 font-black text-[10px] uppercase border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 text-center border-r border-slate-200 w-10">N°</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 whitespace-nowrap">Código</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 min-w-[200px]">Nombres y Apellidos</th>

                  {/* Official institutional working day columns */}
                  {diasLaborales.map(dia => {
                    const ses = sesionPorFechaMap[dia.fecha];
                    const isRegistered = Boolean(ses);
                    return (
                      <th
                        key={dia.fecha}
                        className={`py-2.5 px-1.5 text-center border-r border-slate-200 min-w-[34px] ${
                          isRegistered ? 'bg-emerald-50/50' : 'bg-slate-50'
                        }`}
                        title={`${dia.diaSemanaCompleto} ${dia.fecha}${ses ? ` • Clase: ${ses.materia || 'Registrada'}` : ' • Día hábil oficial'}`}
                      >
                        <span className="block font-black text-slate-800">{dia.diaNumero}</span>
                        <span className="block text-[8px] font-bold text-slate-400 -mt-0.5">{dia.diaSemana}</span>
                      </th>
                    );
                  })}

                  {diasLaborales.length === 0 && (
                    <th className="py-2.5 px-3 text-center text-slate-400 border-r border-slate-200 italic">
                      Sin días laborales oficiales en este mes
                    </th>
                  )}

                  <th className="py-2.5 px-2 text-center bg-emerald-50 text-emerald-900 border-r border-slate-200" title="Presentes">P</th>
                  <th className="py-2.5 px-2 text-center bg-amber-50 text-amber-900 border-r border-slate-200" title="Atrasos">A</th>
                  <th className="py-2.5 px-2 text-center bg-rose-50 text-rose-900 border-r border-slate-200" title="Faltas">F</th>
                  <th className="py-2.5 px-2 text-center bg-blue-50 text-blue-900 border-r border-slate-200" title="Licencias">L</th>
                  <th className="py-2.5 px-2.5 text-center bg-slate-50 text-slate-800 border-r border-slate-200 font-bold">Total Asist.</th>
                  <th className="py-2.5 px-3 text-center bg-slate-900 text-amber-300 font-extrabold">% Asist</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
                {monthlyStats.studentRows.map(row => (
                  <tr key={row.estudiante.id} className="hover:bg-slate-50/90 transition-colors">
                    <td className="py-2 px-3 text-center border-r border-slate-100 font-bold text-slate-500">
                      {row.num}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-100 font-mono text-[11px] font-bold text-slate-600 whitespace-nowrap">
                      {row.estudiante.codigo_interno}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-100 font-extrabold text-[#17324D] whitespace-nowrap">
                      {row.estudiante.nombre_completo}
                    </td>

                    {/* Official Day Attendance cells */}
                    {diasLaborales.map(dia => {
                      const ses = sesionPorFechaMap[dia.fecha];
                      const stState = ses ? asistenciasMap[ses.id]?.[row.estudiante.id] : undefined;
                      let cellContent = '-';
                      let cellClass = 'text-slate-300';

                      if (stState === 'presente') {
                        cellContent = 'P';
                        cellClass = 'text-emerald-700 font-black bg-emerald-50/60';
                      } else if (stState === 'atraso') {
                        cellContent = 'A';
                        cellClass = 'text-amber-700 font-black bg-amber-50/60';
                      } else if (stState === 'falta') {
                        cellContent = 'F';
                        cellClass = 'text-rose-700 font-black bg-rose-50/60';
                      } else if (stState === 'licencia') {
                        cellContent = 'L';
                        cellClass = 'text-blue-700 font-black bg-blue-50/60';
                      }

                      return (
                        <td
                          key={dia.fecha}
                          className={`py-2 px-1 text-center border-r border-slate-100 text-xs font-mono ${cellClass}`}
                        >
                          {cellContent}
                        </td>
                      );
                    })}

                    {diasLaborales.length === 0 && (
                      <td className="py-2 px-3 text-center text-slate-300 border-r border-slate-100">-</td>
                    )}

                    <td className="py-2 px-2 text-center border-r border-slate-100 font-bold text-emerald-700 bg-emerald-50/30">
                      {row.p}
                    </td>
                    <td className="py-2 px-2 text-center border-r border-slate-100 font-bold text-amber-700 bg-amber-50/30">
                      {row.a}
                    </td>
                    <td className="py-2 px-2 text-center border-r border-slate-100 font-bold text-rose-700 bg-rose-50/30">
                      {row.f}
                    </td>
                    <td className="py-2 px-2 text-center border-r border-slate-100 font-bold text-blue-700 bg-blue-50/30">
                      {row.l}
                    </td>
                    <td className="py-2 px-2.5 text-center border-r border-slate-100 font-bold text-slate-800">
                      {row.p + row.a}
                    </td>
                    <td className="py-2 px-3 text-center font-black text-[#17324D]">
                      {row.pct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* B) Daily Report View */}
        {sheetType === 'diario' && estudiantes.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100/80 text-slate-700 font-black text-[10px] uppercase border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 text-center border-r border-slate-200 w-12">N°</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">Código</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">Nombres y Apellidos</th>
                  <th className="py-2.5 px-3 text-center border-r border-slate-200">Estado Asistencia</th>
                  <th className="py-2.5 px-3">Observación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
                {dailyStats.rows.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50/90 transition-colors">
                    <td className="py-2.5 px-3 text-center border-r border-slate-100 font-bold text-slate-500">
                      {row.num}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-100 font-mono text-[11px] font-bold text-slate-600 whitespace-nowrap">
                      {row.codigo_interno}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-100 font-extrabold text-[#17324D] whitespace-nowrap">
                      {row.nombre_completo}
                    </td>
                    <td className="py-2.5 px-3 text-center border-r border-slate-100 whitespace-nowrap">
                      {row.estado === 'presente' && (
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg font-black text-[10px] inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> PRESENTE
                        </span>
                      )}
                      {row.estado === 'atraso' && (
                        <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg font-black text-[10px] inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" /> ATRASO
                        </span>
                      )}
                      {row.estado === 'falta' && (
                        <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded-lg font-black text-[10px] inline-flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> FALTA
                        </span>
                      )}
                      {row.estado === 'licencia' && (
                        <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg font-black text-[10px] inline-flex items-center gap-1">
                          <BookOpen className="w-3 h-3" /> LICENCIA
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 italic">
                      {row.observacion || '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* PRINT-ONLY OFFICIAL INSTITUTIONAL SHEET CONTAINER (ACTIVATED BY PRINT)  */}
      {/* ========================================================================= */}
      <div id="official-print-document" className="hidden print:block print-only text-black bg-white p-4 font-sans text-xs">
        {/* Institutional Header */}
        <div className="border-b-2 border-slate-800 pb-3 mb-3 text-center space-y-1">
          <span className="text-[11px] font-black uppercase tracking-widest block text-slate-600">
            Estado Plurinacional de Bolivia • Ministerio de Educación
          </span>
          <h1 className="text-base font-black uppercase tracking-tight text-black">
            {institucion.nombre_completo}
          </h1>
          <h2 className="text-sm font-extrabold uppercase text-slate-800">
            {sheetType === 'mensual'
              ? 'PLANILLA OFICIAL DE ASISTENCIA MENSUAL'
              : 'REPORTE OFICIAL DE ASISTENCIA DIARIA'}
          </h2>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-3 gap-2 text-[11px] border border-slate-400 p-2.5 rounded-lg mb-3 bg-slate-50">
          <div>
            <strong>Gestión / Periodo:</strong> {sheetType === 'mensual' ? monthTitleFormatted : formatAcademicDate(selectedDate)}
          </div>
          <div>
            <strong>Grupo / Curso:</strong> {grupoNombreDisplay}
          </div>
          <div>
            <strong>Sede Educativa:</strong> {sedeDisplay}
          </div>
          <div>
            <strong>Carrera / Especialidad:</strong> {carreraDisplay}
          </div>
          <div>
            <strong>Nivel:</strong> {nivelDisplay}
          </div>
          <div>
            <strong>Docente / Facilitador:</strong> {docenteDisplay}
          </div>
        </div>

        {/* Matrix Table for Print (Monthly) */}
        {sheetType === 'mensual' && (
          <table className="w-full text-left text-[10px] border border-black mb-6">
            <thead className="bg-slate-200 text-black font-black uppercase border-b border-black">
              <tr>
                <th className="p-1 border-r border-black text-center w-6">N°</th>
                <th className="p-1 border-r border-black w-16">Código</th>
                <th className="p-1 border-r border-black min-w-[140px]">Nombres y Apellidos</th>
                {diasLaborales.map(dia => (
                  <th key={dia.fecha} className="p-1 border-r border-black text-center w-6">
                    {dia.diaNumero}
                  </th>
                ))}
                {diasLaborales.length === 0 && (
                  <th className="p-1 border-r border-black text-center italic">Sin días laborales oficiales</th>
                )}
                <th className="p-1 border-r border-black text-center w-6">P</th>
                <th className="p-1 border-r border-black text-center w-6">A</th>
                <th className="p-1 border-r border-black text-center w-6">F</th>
                <th className="p-1 border-r border-black text-center w-6">L</th>
                <th className="p-1 border-r border-black text-center w-8">Total Asist.</th>
                <th className="p-1 text-center w-10">% Asist</th>
              </tr>
            </thead>
            <tbody>
              {monthlyStats.studentRows.map(row => (
                <tr key={row.estudiante.id} className="border-b border-slate-300">
                  <td className="p-1 text-center border-r border-slate-400 font-bold">{row.num}</td>
                  <td className="p-1 border-r border-slate-400 font-mono text-[9px]">{row.estudiante.codigo_interno}</td>
                  <td className="p-1 border-r border-slate-400 font-bold uppercase">{row.estudiante.nombre_completo}</td>
                  {diasLaborales.map(dia => {
                    const ses = sesionPorFechaMap[dia.fecha];
                    const st = ses ? asistenciasMap[ses.id]?.[row.estudiante.id] : undefined;
                    const letter = st === 'presente' ? 'P' : st === 'atraso' ? 'A' : st === 'falta' ? 'F' : st === 'licencia' ? 'L' : '-';
                    return (
                      <td key={dia.fecha} className="p-1 text-center border-r border-slate-400 font-bold">
                        {letter}
                      </td>
                    );
                  })}
                  {diasLaborales.length === 0 && (
                    <td className="p-1 text-center border-r border-slate-400">-</td>
                  )}
                  <td className="p-1 text-center border-r border-slate-400 font-bold">{row.p}</td>
                  <td className="p-1 text-center border-r border-slate-400 font-bold">{row.a}</td>
                  <td className="p-1 text-center border-r border-slate-400 font-bold">{row.f}</td>
                  <td className="p-1 text-center border-r border-slate-400 font-bold">{row.l}</td>
                  <td className="p-1 text-center border-r border-slate-400 font-black">{row.p + row.a}</td>
                  <td className="p-1 text-center font-black">{row.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Daily Table for Print */}
        {sheetType === 'diario' && (
          <table className="w-full text-left text-[11px] border border-black mb-6">
            <thead className="bg-slate-200 text-black font-black uppercase border-b border-black">
              <tr>
                <th className="p-1.5 border-r border-black text-center w-8">N°</th>
                <th className="p-1.5 border-r border-black w-24">Código</th>
                <th className="p-1.5 border-r border-black">Nombres y Apellidos</th>
                <th className="p-1.5 border-r border-black text-center w-28">Estado</th>
                <th className="p-1.5">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {dailyStats.rows.map(row => (
                <tr key={row.id} className="border-b border-slate-300">
                  <td className="p-1.5 text-center border-r border-slate-400 font-bold">{row.num}</td>
                  <td className="p-1.5 border-r border-slate-400 font-mono text-[10px]">{row.codigo_interno}</td>
                  <td className="p-1.5 border-r border-slate-400 font-bold uppercase">{row.nombre_completo}</td>
                  <td className="p-1.5 text-center border-r border-slate-400 font-black uppercase">
                    {row.estado}
                  </td>
                  <td className="p-1.5 italic text-slate-700">{row.observacion || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Print Signatures Footer */}
        <div className="grid grid-cols-2 gap-10 pt-12 mt-6 text-center text-xs">
          <div>
            <div className="border-t border-black w-48 mx-auto mb-1" />
            <strong className="block text-black uppercase">{docenteDisplay}</strong>
            <span className="text-[10px] text-slate-600">Docente Facilitador Responsable</span>
          </div>
          <div>
            <div className="border-t border-black w-48 mx-auto mb-1" />
            <strong className="block text-black uppercase">{institucion.nombre_director}</strong>
            <span className="text-[10px] text-slate-600">{institucion.cargo_director}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
