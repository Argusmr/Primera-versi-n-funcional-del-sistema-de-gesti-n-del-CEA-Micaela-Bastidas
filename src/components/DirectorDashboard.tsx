import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldCheck,
  UserCheck,
  Users,
  AlertTriangle,
  FileCheck,
  Calendar,
  ShieldAlert,
  Clock,
  RefreshCw,
  WifiOff,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  FilePlus,
  BookOpen,
  Eye,
  Camera,
  MapPin,
  Check,
  X,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import {
  Perfil,
  AsistenciaDocente,
  Estudiante,
  Grupo,
  NivelEducativo,
  AlertaEstudiante,
  Seguimiento,
  ControlDocumental,
  ConfiguracionCalendario,
  Auditoria,
  DatosInstitucionales,
  Sede,
  IncidenciaAsistenciaDocente
} from '../types';
import { getLocalDatosInstitucionales } from '../lib/institutional';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getBoliviaTodayDate } from '../lib/geo';
import { loadAuditoriaLogs } from '../lib/audit';
import { loadConfiguracionesCalendario, FALLBACK_DIAS_TRABAJADOS } from '../lib/calendar';
import { getLocalControlDocumentalMap, getControlDocumentalForDocente, calculateEstadoControl } from '../lib/controlDocumental';
import { loadIncidenciasAsistencia, evaluarYGenerarIncidenciasDelDia } from '../lib/incidencias';
import { AttendanceIncidentsModal } from './AttendanceIncidentsModal';

interface DirectorDashboardProps {
  user: Perfil;
  isOnline: boolean;
  onNavigateTab: (tab: string) => void;
  onOpenAddTeacherModal: () => void;
  onOpenAddStudentModal: () => void;
  onOpenPublishModal: () => void;
  onDownloadReport: () => void;
  datosInstitucionales?: DatosInstitucionales;
}

export const DirectorDashboard: React.FC<DirectorDashboardProps> = ({
  user,
  isOnline,
  onNavigateTab,
  onOpenAddTeacherModal,
  onOpenAddStudentModal,
  onOpenPublishModal,
  onDownloadReport,
  datosInstitucionales,
}) => {
  const datos = datosInstitucionales || getLocalDatosInstitucionales();
  const [selectedSedeFilter, setSelectedSedeFilter] = useState<string>('Todas');

  // Real Supabase data state
  const [docentes, setDocentes] = useState<Perfil[]>([]);
  const [asistenciasHoy, setAsistenciasHoy] = useState<AsistenciaDocente[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [niveles, setNiveles] = useState<NivelEducativo[]>([]);
  const [alertas, setAlertas] = useState<AlertaEstudiante[]>([]);
  const [seguimientos, setSeguimientos] = useState<Seguimiento[]>([]);
  const [controlDocMap, setControlDocMap] = useState<Record<string, ControlDocumental>>({});
  const [calendarConfigs, setCalendarConfigs] = useState<ConfiguracionCalendario[]>([]);
  const [ultimasAuditorias, setUltimasAuditorias] = useState<Auditoria[]>([]);
  const [sedesList, setSedesList] = useState<Sede[]>([]);
  const [incidenciasList, setIncidenciasList] = useState<IncidenciaAsistenciaDocente[]>([]);
  const [isIncidenciasModalOpen, setIsIncidenciasModalOpen] = useState<boolean>(false);

  // Loading & error state
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionProcessingId, setActionProcessingId] = useState<string | null>(null);

  // Selfie modal
  const [isSelfieModalOpen, setIsSelfieModalOpen] = useState<boolean>(false);
  const [loadingSelfie, setLoadingSelfie] = useState<boolean>(false);
  const [selfieError, setSelfieError] = useState<string | null>(null);
  const [previewSelfieUrl, setPreviewSelfieUrl] = useState<string | null>(null);

  const todayIsoDate = useMemo(() => getBoliviaTodayDate(), []);
  const currentMonthKey = useMemo(() => todayIsoDate.slice(0, 7), [todayIsoDate]);

  const todayStr = useMemo(() => {
    return new Date().toLocaleDateString('es-BO', {
      timeZone: 'America/La_Paz',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }, []);

  const handleOpenSelfie = async (rawPathOrUrl: string) => {
    if (!rawPathOrUrl) return;

    setIsSelfieModalOpen(true);
    setSelfieError(null);
    setPreviewSelfieUrl(null);

    if (rawPathOrUrl.startsWith('data:')) {
      setPreviewSelfieUrl(rawPathOrUrl);
      return;
    }

    let path = rawPathOrUrl;
    if (path.includes('/selfies-asistencia/')) {
      path = path.split('/selfies-asistencia/')[1].split('?')[0];
    }

    if (path.startsWith('http://') || path.startsWith('https://')) {
      setPreviewSelfieUrl(path);
      return;
    }

    setLoadingSelfie(true);
    try {
      if (!supabase) {
        throw new Error('Supabase client no configurado');
      }

      const { data, error } = await supabase.storage
        .from('selfies-asistencia')
        .createSignedUrl(path, 300);

      if (error || !data?.signedUrl) {
        throw error || new Error('No se pudo generar la URL firmada');
      }

      setPreviewSelfieUrl(data.signedUrl);
    } catch (err) {
      console.error('Error al generar signed URL de selfie:', err);
      setSelfieError('No se pudo cargar la selfie de verificación.');
    } finally {
      setLoadingSelfie(false);
    }
  };

  const loadExecutiveData = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setFetchError(null);

    try {
      // Parallel fetch of real Supabase tables
      const [
        docentesRes,
        asistenciasRes,
        estudiantesRes,
        gruposRes,
        nivelesRes,
        alertasRes,
        seguimientosRes,
        sedesRes,
        calendarRes,
        auditoriaData
      ] = await Promise.all([
        // 1. Docentes activos (public.perfiles)
        supabase
          .from('perfiles')
          .select('*')
          .eq('rol', 'docente')
          .order('nombre_completo', { ascending: true }),

        // 2. Asistencias docentes de hoy (public.asistencias_docentes)
        supabase
          .from('asistencias_docentes')
          .select('*')
          .eq('fecha_laboral', todayIsoDate)
          .order('created_at', { ascending: false }),

        // 3. Estudiantes activos (public.estudiantes)
        supabase
          .from('estudiantes')
          .select('id, codigo_interno, nombre_completo, sexo, estado, sede_id, grupo_id, programa_id, nivel')
          .eq('estado', 'activo'),

        // 4. Grupos activos (public.grupos)
        supabase
          .from('grupos')
          .select('*')
          .eq('activo', true)
          .order('nombre', { ascending: true }),

        // 5. Niveles educativos (public.niveles)
        supabase
          .from('niveles')
          .select('*')
          .eq('activo', true)
          .order('nombre', { ascending: true }),

        // 6. Alertas estudiantiles (public.alertas_estudiantes)
        supabase
          .from('alertas_estudiantes')
          .select('*')
          .order('created_at', { ascending: false }),

        // 7. Seguimientos (public.seguimientos)
        supabase
          .from('seguimientos')
          .select('*')
          .order('created_at', { ascending: false }),

        // 8. Sedes (public.sedes)
        supabase
          .from('sedes')
          .select('*')
          .eq('activo', true)
          .order('nombre', { ascending: true }),

        // 9. Calendario laboral (public.configuracion_calendario)
        loadConfiguracionesCalendario(),

        // 10. Últimas auditorías (public.auditoria)
        loadAuditoriaLogs()
      ]);

      if (docentesRes.error) throw new Error(`Error en perfiles: ${docentesRes.error.message}`);
      if (asistenciasRes.error) throw new Error(`Error en asistencias_docentes: ${asistenciasRes.error.message}`);
      if (estudiantesRes.error) throw new Error(`Error en estudiantes: ${estudiantesRes.error.message}`);
      if (gruposRes.error) throw new Error(`Error en grupos: ${gruposRes.error.message}`);

      const sedesData = (sedesRes.data || []) as Sede[];
      const sedesMap = new Map<string, string>();
      sedesData.forEach(s => sedesMap.set(s.id, s.nombre));

      // Map docentes
      const rawDocentes = (docentesRes.data || []) as Perfil[];
      const mappedDocentes: Perfil[] = rawDocentes.map((d: any) => ({
        ...d,
        sede_nombre: (d.sede_id && sedesMap.get(d.sede_id)) || d.sede_nombre || 'Sin Sede'
      }));

      const docentesMap = new Map<string, Perfil>();
      mappedDocentes.forEach(d => docentesMap.set(d.id, d));

      // Map asistencias
      const rawAsistencias = asistenciasRes.data || [];
      const mappedAsistencias: AsistenciaDocente[] = rawAsistencias.map((a: any) => {
        const docente = a.docente_id ? docentesMap.get(a.docente_id) : null;
        return {
          ...a,
          docente_nombre: docente?.nombre_completo || 'Docente',
          sede_nombre: (a.sede_id && sedesMap.get(a.sede_id)) || docente?.sede_nombre || 'Sede sin asignar',
          sede_id: a.sede_id || docente?.sede_id
        };
      });

      // Load Control Documental map for all teachers
      const initialMap = getLocalControlDocumentalMap();
      const updatedCtrlMap: Record<string, ControlDocumental> = { ...initialMap };

      for (const d of mappedDocentes) {
        const ctrl = await getControlDocumentalForDocente(d.id);
        updatedCtrlMap[d.id] = ctrl;
      }

      setDocentes(mappedDocentes);
      setAsistenciasHoy(mappedAsistencias);
      setEstudiantes((estudiantesRes.data || []) as Estudiante[]);
      setGrupos((gruposRes.data || []) as Grupo[]);
      setNiveles((nivelesRes.data || []) as NivelEducativo[]);
      setAlertas((alertasRes.data || []) as AlertaEstudiante[]);
      setSeguimientos((seguimientosRes.data || []) as Seguimiento[]);
      setControlDocMap(updatedCtrlMap);
      setCalendarConfigs(calendarRes);
      setUltimasAuditorias(auditoriaData.slice(0, 6));
      setSedesList(sedesData);

      // Cargar Incidencias de Asistencia Docente
      const incData = await loadIncidenciasAsistencia();
      setIncidenciasList(incData);
    } catch (err: any) {
      console.error('Error al cargar datos del Panel Ejecutivo:', err);
      setFetchError(err.message || 'Error de conexión con Supabase');
    } finally {
      setLoading(false);
    }
  }, [todayIsoDate]);

  useEffect(() => {
    loadExecutiveData();
  }, [loadExecutiveData]);

  // Sede filters
  const filteredDocentes = useMemo(() => {
    if (selectedSedeFilter === 'Todas') return docentes;
    return docentes.filter(d => d.sede_id === selectedSedeFilter || d.sede_nombre === selectedSedeFilter);
  }, [docentes, selectedSedeFilter]);

  const filteredAsistencias = useMemo(() => {
    if (selectedSedeFilter === 'Todas') return asistenciasHoy;
    return asistenciasHoy.filter(a => a.sede_id === selectedSedeFilter || a.sede_nombre === selectedSedeFilter);
  }, [asistenciasHoy, selectedSedeFilter]);

  const filteredEstudiantes = useMemo(() => {
    if (selectedSedeFilter === 'Todas') return estudiantes;
    return estudiantes.filter(e => e.sede_id === selectedSedeFilter);
  }, [estudiantes, selectedSedeFilter]);

  const filteredGrupos = useMemo(() => {
    if (selectedSedeFilter === 'Todas') return grupos;
    return grupos.filter(g => g.sede_id === selectedSedeFilter);
  }, [grupos, selectedSedeFilter]);

  // 1. Control Docente del Día
  const totalDocentes = filteredDocentes.length;
  const docentesPresentes = filteredAsistencias.filter(
    a => a.hora_ingreso_oficial || a.hora_ingreso_local || a.estado === 'puntual' || a.estado === 'atraso'
  ).length;

  const excepcionesPendientes = filteredAsistencias.filter(
    a =>
      (a.estado_excepcion === 'pendiente_revision' || a.estado === 'pendiente_verificacion') &&
      a.estado_excepcion !== 'aprobada' &&
      a.estado_excepcion !== 'rechazada'
  );

  const registrosIncompletos = filteredAsistencias.filter(
    a =>
      a.estado === 'registro_incompleto' ||
      (a.hora_ingreso_oficial && !a.hora_salida_oficial && !a.hora_salida_local && a.estado !== 'puntual' && a.estado !== 'atraso')
  ).length;

  // 2. Resumen Estudiantil
  const totalEstudiantes = filteredEstudiantes.length;
  const gruposActivosCount = filteredGrupos.length;
  const nivelesCount = niveles.length;

  // 3. Seguimiento y Alertas
  const alertasAmarillas = alertas.filter(
    a => (a.tipo === 'amarillo_2_faltas' || a.faltas_consecutivas === 2) && a.estado === 'pendiente'
  ).length;

  const alertasRojas = alertas.filter(
    a => (a.tipo === 'rojo_3_faltas' || a.faltas_consecutivas >= 3 || a.tipo === 'riesgo_prolongado') && a.estado === 'pendiente'
  ).length;

  const seguimientosPendientes = seguimientos.filter(s => s.estado === 'pendiente').length;

  // 4. Control Documental
  const docsPresentados = filteredDocentes.filter(d => {
    const ctrl = controlDocMap[d.id];
    return ctrl ? calculateEstadoControl(ctrl.tiene_plan_modular, ctrl.tiene_planificacion_curricular) === 'presentado' : false;
  }).length;

  const docsPendientes = Math.max(0, totalDocentes - docsPresentados);

  // 5. Calendario Laboral
  const currentCalendarConfig = useMemo(() => {
    return calendarConfigs.find(c => c.mes === currentMonthKey);
  }, [calendarConfigs, currentMonthKey]);

  const diasEfectivosConfigurados = currentCalendarConfig
    ? currentCalendarConfig.dias_trabajados
    : FALLBACK_DIAS_TRABAJADOS;

  const monthLabel = useMemo(() => {
    try {
      const [y, m] = currentMonthKey.split('-');
      const d = new Date(Number(y), Number(m) - 1, 1);
      return d.toLocaleDateString('es-BO', { month: 'long', year: 'numeric' });
    } catch {
      return currentMonthKey;
    }
  }, [currentMonthKey]);

  // Exception approval actions
  const handleApproveException = async (recordId: string) => {
    if (!supabase) return;
    setActionProcessingId(recordId);
    try {
      const record = filteredAsistencias.find(a => a.id === recordId);
      const estadoFinal = (record?.minutos_atraso && record.minutos_atraso > 0) ? 'atraso' : 'puntual';

      const { error } = await supabase
        .from('asistencias_docentes')
        .update({
          estado_excepcion: 'aprobada',
          estado: estadoFinal,
          validado_por: user.id,
          fecha_validacion: new Date().toISOString()
        })
        .eq('id', recordId);

      if (error) {
        alert('Error al aprobar excepción: ' + error.message);
      } else {
        await loadExecutiveData();
      }
    } catch (err: any) {
      alert('Excepción al aprobar: ' + (err.message || err));
    } finally {
      setActionProcessingId(null);
    }
  };

  const handleRejectException = async (recordId: string) => {
    if (!supabase) return;
    setActionProcessingId(recordId);
    try {
      const { error } = await supabase
        .from('asistencias_docentes')
        .update({
          estado_excepcion: 'rechazada',
          estado: 'falta',
          validado_por: user.id,
          fecha_validacion: new Date().toISOString()
        })
        .eq('id', recordId);

      if (error) {
        alert('Error al rechazar excepción: ' + error.message);
      } else {
        await loadExecutiveData();
      }
    } catch (err: any) {
      alert('Excepción al rechazar: ' + (err.message || err));
    } finally {
      setActionProcessingId(null);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* 1. Header Hero Ejecutivo del Director */}
      <div className="bg-gradient-to-br from-[#17324D] via-[#1b3d5e] to-slate-900 rounded-3xl p-5 text-white shadow-xl border border-slate-700/50 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-400/20 border border-amber-400/40 text-amber-300 flex items-center justify-center font-bold shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-amber-300 font-extrabold uppercase tracking-wider bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                  {datos.cargo_director || 'Dirección General'}
                </span>
                <span className="text-[10px] text-emerald-300 font-extrabold bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-400/30">
                  Panel Ejecutivo
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight mt-0.5">{user.nombre_completo}</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadExecutiveData}
              disabled={loading}
              title="Actualizar datos ejecutivos"
              className="p-2 bg-white/10 hover:bg-white/20 active:scale-95 rounded-full text-white transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <div className="bg-white/10 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border border-white/20">
              {isOnline ? (
                <span className="flex items-center gap-1 text-emerald-400 font-bold text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> En línea
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-300 font-bold text-[11px]">
                  <WifiOff className="w-3 h-3" /> Offline
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="pt-2.5 border-t border-white/10 flex items-center justify-between text-xs text-slate-300 font-medium">
          <span className="capitalize font-bold text-slate-200">{todayStr}</span>
          <span className="text-amber-300 font-extrabold text-[11px]">{datos.nombre_corto}</span>
        </div>
      </div>

      {/* Database Error Banner if any */}
      {fetchError && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-red-800 text-xs shadow-xs">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="block font-bold">Aviso de consulta a Supabase</strong>
            <p>{fetchError}</p>
          </div>
          <button
            onClick={loadExecutiveData}
            className="px-2.5 py-1 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shrink-0 text-[11px]"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Botones de Acción Rápida */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <button
          onClick={onOpenAddTeacherModal}
          id="btn-exec-add-docente"
          className="p-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-2xl font-extrabold text-xs flex flex-col items-center justify-center gap-1 shadow-xs h-18 transition-all cursor-pointer"
        >
          <UserCheck className="w-5 h-5 text-amber-300" />
          <span>+ Docente</span>
        </button>

        <button
          onClick={onOpenAddStudentModal}
          id="btn-exec-add-estudiante"
          className="p-3 bg-[#11B8AE] hover:bg-teal-700 active:scale-95 text-white rounded-2xl font-extrabold text-xs flex flex-col items-center justify-center gap-1 shadow-xs h-18 transition-all cursor-pointer"
        >
          <Users className="w-5 h-5 text-white" />
          <span>+ Estudiante</span>
        </button>

        <button
          onClick={onOpenPublishModal}
          id="btn-exec-publicar"
          className="p-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 rounded-2xl font-extrabold text-xs flex flex-col items-center justify-center gap-1 shadow-xs h-18 transition-all cursor-pointer"
        >
          <FilePlus className="w-5 h-5 text-slate-950" />
          <span>Publicar Aviso</span>
        </button>

        <button
          onClick={onDownloadReport}
          id="btn-exec-reporte"
          className="p-3 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white rounded-2xl font-extrabold text-xs flex flex-col items-center justify-center gap-1 shadow-xs h-18 transition-all cursor-pointer"
        >
          <FileSpreadsheet className="w-5 h-5 text-amber-300" />
          <span>Reporte Excel</span>
        </button>
      </div>

      {/* Sede Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setSelectedSedeFilter('Todas')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
            selectedSedeFilter === 'Todas'
              ? 'bg-[#17324D] text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Todas las Sedes
        </button>
        {sedesList.map((sede) => (
          <button
            key={sede.id}
            onClick={() => setSelectedSedeFilter(sede.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
              selectedSedeFilter === sede.id
                ? 'bg-[#17324D] text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {sede.nombre}
          </button>
        ))}
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center flex flex-col items-center justify-center gap-2 shadow-xs">
          <Loader2 className="w-7 h-7 text-[#00A651] animate-spin" />
          <span className="text-xs font-bold text-slate-500">Cargando métricas ejecutivas desde Supabase...</span>
        </div>
      )}

      {!loading && (
        <div className="space-y-4">
          {/* ================= 1. CONTROL DOCENTE DEL DÍA ================= */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-xl">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-[#17324D]">
                    1. Control Docente del Día
                  </h3>
                  <span className="text-[11px] text-slate-500 font-medium">Fuente: asistencias_docentes</span>
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('asistencia')}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5"
              >
                <span>Ver Asistencias</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Docentes Presentes</span>
                <strong className="text-xl sm:text-2xl font-black text-emerald-700">{docentesPresentes}</strong>
                <span className="text-[10px] text-emerald-600 block font-medium">de {totalDocentes} asignados</span>
              </div>

              <div className={`p-3 rounded-2xl border ${excepcionesPendientes.length > 0 ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Excepciones Pendientes</span>
                <strong className={`text-xl sm:text-2xl font-black ${excepcionesPendientes.length > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
                  {excepcionesPendientes.length}
                </strong>
                <span className="text-[10px] text-slate-500 block font-medium">por revisar</span>
              </div>

              <div className={`p-3 rounded-2xl border ${registrosIncompletos > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">Registros Incompletos</span>
                <strong className={`text-xl sm:text-2xl font-black ${registrosIncompletos > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                  {registrosIncompletos}
                </strong>
                <span className="text-[10px] text-slate-500 block font-medium">sin cierre</span>
              </div>
            </div>

            {/* Sub-bloque institucional: Panel de Incidencias de Asistencia Docente */}
            <div className="p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-300 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-500 text-white rounded-xl shadow-xs">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs sm:text-sm text-amber-950">
                      Panel de Incidencias de Asistencia
                    </h4>
                    <p className="text-[11px] text-amber-800 font-medium">
                      Marcaciones incompletas requieren dictamen de Dirección (Regla de No Falta Automática)
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsIncidenciasModalOpen(true)}
                  className="px-3 py-1.5 bg-[#00A651] hover:bg-[#008f45] text-white text-xs font-black rounded-xl shadow-xs flex items-center gap-1.5 transition-all shrink-0"
                >
                  <span>Revisar ({incidenciasList.filter(i => i.estado === 'pendiente').length} pend.)</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-amber-900 font-semibold pt-1 border-t border-amber-200/70">
                <span>⚠️ {incidenciasList.filter(i => i.estado === 'pendiente').length} Pendientes</span>
                <span>•</span>
                <span>✅ {incidenciasList.filter(i => i.estado === 'justificado').length} Justificadas</span>
                <span>•</span>
                <span>❌ {incidenciasList.filter(i => i.estado === 'falta_confirmada').length} Faltas</span>
                <span>•</span>
                <span>✏️ {incidenciasList.filter(i => i.estado === 'corregido').length} Corregidas</span>
              </div>
            </div>

            {/* Sub-bloque: Excepciones que requieren validación del director */}
            {excepcionesPendientes.length > 0 && (
              <div className="p-3 bg-amber-50/90 rounded-2xl border border-amber-300 space-y-2.5">
                <div className="flex items-center justify-between text-xs text-amber-950 font-extrabold">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Excepciones de Asistencia que Requieren tu Validación ({excepcionesPendientes.length})
                  </span>
                </div>

                <div className="space-y-2">
                  {excepcionesPendientes.slice(0, 3).map((a) => {
                    const isProcessing = actionProcessingId === a.id;
                    return (
                      <div key={a.id} className="p-2.5 bg-white rounded-xl border border-amber-200 text-xs space-y-1.5 shadow-xs">
                        <div className="flex items-center justify-between">
                          <strong className="text-[#17324D]">{a.docente_nombre}</strong>
                          <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md font-bold uppercase">
                            {a.estado_gps_ingreso || 'gps_impreciso'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 italic">
                          "{a.observacion_excepcion || a.observacion || 'Sin motivo detallado'}"
                        </p>
                        <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-100">
                          {a.selfie_url && (
                            <button
                              type="button"
                              onClick={() => handleOpenSelfie(a.selfie_url!)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" /> Selfie
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleApproveException(a.id)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-extrabold flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" /> Aprobar
                          </button>
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleRejectException(a.id)}
                            className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-extrabold flex items-center gap-1"
                          >
                            <X className="w-3 h-3" /> Rechazar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ================= 2. RESUMEN ESTUDIANTIL ================= */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 text-blue-700 rounded-xl">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-[#17324D]">
                    2. Resumen Estudiantil y Académico
                  </h3>
                  <span className="text-[11px] text-slate-500 font-medium">Fuentes: estudiantes, grupos, niveles</span>
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('estudiantes')}
                className="text-xs font-bold text-blue-700 hover:text-blue-800 flex items-center gap-0.5"
              >
                <span>Ver Estudiantes</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200">
                <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">Estudiantes Activos</span>
                <strong className="text-xl sm:text-2xl font-black text-blue-900">{totalEstudiantes}</strong>
                <span className="text-[10px] text-blue-600 block font-medium">matriculados</span>
              </div>

              <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-200">
                <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">Grupos / Cursos</span>
                <strong className="text-xl sm:text-2xl font-black text-indigo-900">{gruposActivosCount}</strong>
                <span className="text-[10px] text-indigo-600 block font-medium">habilitados</span>
              </div>

              <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200">
                <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block">Niveles Educativos</span>
                <strong className="text-xl sm:text-2xl font-black text-purple-900">{nivelesCount}</strong>
                <span className="text-[10px] text-purple-600 block font-medium">en oferta</span>
              </div>
            </div>
          </div>

          {/* ================= 3. SEGUIMIENTO Y ALERTAS ================= */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-50 text-amber-700 rounded-xl">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-[#17324D]">
                    3. Seguimiento y Alertas Estudiantiles
                  </h3>
                  <span className="text-[11px] text-slate-500 font-medium">Fuentes: alertas_estudiantes, seguimientos</span>
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('seguimiento')}
                className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-0.5"
              >
                <span>Ver Módulo</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="p-3 bg-yellow-50 rounded-2xl border border-yellow-300">
                <span className="text-[10px] font-bold text-yellow-900 uppercase tracking-wider block">Alertas Amarillas</span>
                <strong className="text-xl sm:text-2xl font-black text-yellow-800">{alertasAmarillas}</strong>
                <span className="text-[10px] text-yellow-700 block font-medium">2 faltas consecutivas</span>
              </div>

              <div className="p-3 bg-red-50 rounded-2xl border border-red-200">
                <span className="text-[10px] font-bold text-red-800 uppercase tracking-wider block">Alertas Rojas</span>
                <strong className="text-xl sm:text-2xl font-black text-red-600">{alertasRojas}</strong>
                <span className="text-[10px] text-red-500 block font-medium">3+ faltas / riesgo</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">Seguimientos Pendientes</span>
                <strong className="text-xl sm:text-2xl font-black text-slate-800">{seguimientosPendientes}</strong>
                <span className="text-[10px] text-slate-500 block font-medium">casos abiertos</span>
              </div>
            </div>
          </div>

          {/* ================= 4. CONTROL DOCUMENTAL ================= */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-xl">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-[#17324D]">
                    4. Control Documental Docente
                  </h3>
                  <span className="text-[11px] text-slate-500 font-medium">Fuente: control_documental (Plan Modular & Plan Curricular)</span>
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('docentes')}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5"
              >
                <span>Administrar Docentes</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-center">
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Documentos Presentados</span>
                <strong className="text-xl sm:text-2xl font-black text-emerald-700">{docsPresentados}</strong>
                <span className="text-[10px] text-emerald-600 block font-medium">
                  ({totalDocentes > 0 ? Math.round((docsPresentados / totalDocentes) * 100) : 0}% al día)
                </span>
              </div>

              <div className={`p-3 rounded-2xl border ${docsPendientes > 0 ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Documentos Pendientes</span>
                <strong className={`text-xl sm:text-2xl font-black ${docsPendientes > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
                  {docsPendientes}
                </strong>
                <span className="text-[10px] text-slate-500 block font-medium">docentes por regularizar</span>
              </div>
            </div>
          </div>

          {/* ================= 5. CALENDARIO LABORAL ================= */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 text-indigo-700 rounded-xl">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-[#17324D]">
                    5. Calendario Laboral Institucional
                  </h3>
                  <span className="text-[11px] text-slate-500 font-medium">Fuente: configuracion_calendario</span>
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('admin')}
                className="text-xs font-bold text-indigo-700 hover:text-indigo-800 flex items-center gap-0.5"
              >
                <span>Configurar Días</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-3 bg-indigo-50/80 rounded-2xl border border-indigo-200 text-center">
                <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">Mes Actual</span>
                <strong className="text-base sm:text-lg font-black text-indigo-950 capitalize block mt-0.5">{monthLabel}</strong>
                <span className="text-[10px] text-indigo-600 font-mono font-bold">({currentMonthKey})</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">Días Efectivos Configurados</span>
                <strong className="text-xl sm:text-2xl font-black text-slate-800 block mt-0.5">{diasEfectivosConfigurados} días</strong>
                <span className="text-[10px] text-slate-500 block font-medium">para reportes oficiales</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-center">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-0.5">Observaciones del Mes:</span>
                <p className="text-[11px] text-slate-800 font-medium italic line-clamp-2">
                  "{currentCalendarConfig?.observacion || 'Sin observaciones registradas para este periodo mensual.'}"
                </p>
              </div>
            </div>
          </div>

          {/* ================= 6. ÚLTIMAS ACCIONES (AUDITORÍA) ================= */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-50 text-amber-700 rounded-xl">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-[#17324D]">
                    6. Últimas Acciones Institucionales
                  </h3>
                  <span className="text-[11px] text-slate-500 font-medium">Fuente: auditoria</span>
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('admin')}
                className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-0.5"
              >
                <span>Panel Auditoría</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {ultimasAuditorias.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs text-slate-500 font-medium">
                No hay registros recientes de auditoría en Supabase.
              </div>
            ) : (
              <div className="space-y-2">
                {ultimasAuditorias.map((aud) => (
                  <div
                    key={aud.id}
                    className="p-3 bg-slate-50 hover:bg-slate-100/80 transition-colors rounded-2xl border border-slate-200/90 text-xs space-y-1"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-slate-200 text-slate-800 rounded-md">
                            {aud.tabla_afectada}
                          </span>
                          <strong className="text-slate-900 font-bold">{aud.accion}</strong>
                        </div>
                        <span className="text-[11px] text-slate-600 block">
                          Por: <strong className="text-slate-800">{aud.usuario_nombre}</strong>
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">
                        {aud.created_at ? new Date(aud.created_at).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    {aud.motivo_correccion && (
                      <p className="text-[11px] text-amber-900 bg-amber-50 p-1.5 rounded-lg border border-amber-200/60 font-medium italic">
                        Motivo: "{aud.motivo_correccion}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selfie Preview Modal */}
      {isSelfieModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-4 relative shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-extrabold text-sm text-[#17324D] flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-[#00A651]" />
                Selfie de Asistencia
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsSelfieModalOpen(false);
                  setPreviewSelfieUrl(null);
                  setSelfieError(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 flex items-center justify-center min-h-[220px] max-h-80 relative">
              {loadingSelfie && (
                <div className="flex flex-col items-center justify-center gap-2 p-6 text-white text-xs">
                  <Loader2 className="w-7 h-7 text-[#00A651] animate-spin" />
                  <span className="font-medium">Cargando selfie de verificación...</span>
                </div>
              )}

              {!loadingSelfie && selfieError && (
                <div className="p-4 text-center text-xs font-bold text-red-400">
                  {selfieError}
                </div>
              )}

              {!loadingSelfie && !selfieError && previewSelfieUrl && (
                <img
                  src={previewSelfieUrl}
                  alt="Selfie docente"
                  className="w-full h-auto object-cover max-h-80"
                  referrerPolicy="no-referrer"
                  onError={() => setSelfieError('No se pudo cargar la selfie de verificación.')}
                />
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setIsSelfieModalOpen(false);
                setPreviewSelfieUrl(null);
                setSelfieError(null);
              }}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Modal Institucional: Panel de Incidencias de Asistencia Docente */}
      {isIncidenciasModalOpen && (
        <AttendanceIncidentsModal
          user={user}
          onClose={() => {
            setIsIncidenciasModalOpen(false);
            loadExecutiveData();
          }}
          docentesList={docentes}
          sedesList={sedesList}
        />
      )}
    </div>
  );
};
