import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  UserCheck,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  FilePlus,
  WifiOff,
  ChevronRight,
  ShieldCheck,
  Loader2,
  AlertCircle,
  RefreshCw,
  Building2,
  Check,
  X,
  Eye,
  Camera,
  MapPin
} from 'lucide-react';
import { Perfil, AsistenciaDocente, Estudiante, DatosInstitucionales, Sede } from '../types';
import { getLocalDatosInstitucionales } from '../lib/institutional';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getBoliviaTodayDate } from '../lib/geo';

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

  // Real data state
  const [docentes, setDocentes] = useState<Perfil[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [asistenciasHoy, setAsistenciasHoy] = useState<AsistenciaDocente[]>([]);
  const [sedesList, setSedesList] = useState<Sede[]>([]);

  // Loading & error state
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionProcessingId, setActionProcessingId] = useState<string | null>(null);
  const [previewSelfieUrl, setPreviewSelfieUrl] = useState<string | null>(null);

  const todayStr = new Date().toLocaleDateString('es-BO', {
    timeZone: 'America/La_Paz',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Calculate local date format YYYY-MM-DD for today's queries in America/La_Paz timezone
  const todayIsoDate = useMemo(() => getBoliviaTodayDate(), []);

  const getSelfieFullUrl = (urlOrPath: string | null | undefined): string | null => {
    if (!urlOrPath) return null;
    if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://') || urlOrPath.startsWith('data:')) {
      return urlOrPath;
    }
    if (supabase) {
      const { data } = supabase.storage.from('selfies-asistencia').getPublicUrl(urlOrPath);
      return data?.publicUrl || null;
    }
    return null;
  };

  const loadDashboardData = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      setDocentes([]);
      setEstudiantes([]);
      setAsistenciasHoy([]);
      setSedesList([]);
      return;
    }

    setLoading(true);
    setFetchError(null);

    try {
      // Execute parallel queries directly against Supabase without ambiguous embedded joins
      const [
        docentesRes,
        estudiantesRes,
        asistenciasRes,
        sedesRes
      ] = await Promise.all([
        // 1. Total docentes: public.perfiles con rol='docente' y activo=true
        supabase
          .from('perfiles')
          .select('*')
          .eq('rol', 'docente')
          .eq('activo', true)
          .order('nombre_completo', { ascending: true }),

        // 2. Total estudiantes: public.estudiantes con estado='activo'
        supabase
          .from('estudiantes')
          .select('id, codigo_interno, nombre_completo, sexo, estado, sede_id, grupo_id, programa_id')
          .eq('estado', 'activo'),

        // 3. Resumen asistencia docente de hoy: public.asistencias_docentes sin embedded join
        supabase
          .from('asistencias_docentes')
          .select('*')
          .eq('fecha_laboral', todayIsoDate)
          .order('created_at', { ascending: false }),

        // 4. Sedes activas para nombres y pestañas dinámicas
        supabase
          .from('sedes')
          .select('*')
          .eq('activo', true)
          .order('nombre', { ascending: true })
      ]);

      if (docentesRes.error) {
        throw new Error(`Error en public.perfiles: ${docentesRes.error.message}`);
      }
      if (estudiantesRes.error) {
        throw new Error(`Error en public.estudiantes: ${estudiantesRes.error.message}`);
      }
      if (asistenciasRes.error) {
        throw new Error(`Error en public.asistencias_docentes: ${asistenciasRes.error.message}`);
      }

      const sedesData = (sedesRes.data || []) as Sede[];
      const sedesMap = new Map<string, string>();
      sedesData.forEach(s => sedesMap.set(s.id, s.nombre));

      // Map docentes with sede_nombre resolved in memory
      const mappedDocentes: Perfil[] = (docentesRes.data || []).map((d: any) => ({
        ...d,
        sede_nombre: (d.sede_id && sedesMap.get(d.sede_id)) || d.sede_nombre || 'Sin Sede'
      }));

      // Create lookup map of all docentes for fast in-memory joins
      const docentesMap = new Map<string, Perfil>();
      mappedDocentes.forEach(d => docentesMap.set(d.id, d));

      // If any attendance record belongs to a teacher not active or in docentes list, fetch their basic profile
      const rawAsistencias = asistenciasRes.data || [];
      const missingDocenteIds = Array.from(
        new Set(rawAsistencias.map((a: any) => a.docente_id).filter((id: string) => id && !docentesMap.has(id)))
      );

      if (missingDocenteIds.length > 0) {
        const extraDocentesRes = await supabase
          .from('perfiles')
          .select('*')
          .in('id', missingDocenteIds);

        if (extraDocentesRes.data) {
          extraDocentesRes.data.forEach((d: any) => {
            const sedeNom = (d.sede_id && sedesMap.get(d.sede_id)) || d.sede_nombre || 'Sin Sede';
            docentesMap.set(d.id, { ...d, sede_nombre: sedeNom });
          });
        }
      }

      // Map joined fields for asistencias_docentes in memory by UUID
      const mappedAsistencias: AsistenciaDocente[] = rawAsistencias.map((a: any) => {
        const docente = a.docente_id ? docentesMap.get(a.docente_id) : null;
        const docenteNombre = docente?.nombre_completo || 'Docente sin nombre';
        const docenteSedeId = docente?.sede_id || a.sede_id;
        const docenteSedeNombre = (docenteSedeId && sedesMap.get(docenteSedeId)) || docente?.sede_nombre || 'Sede sin asignar';

        return {
          ...a,
          docente_nombre: docenteNombre,
          sede_nombre: docenteSedeNombre,
          sede_id: docenteSedeId
        };
      });

      setDocentes(mappedDocentes);
      setEstudiantes((estudiantesRes.data || []) as Estudiante[]);
      setAsistenciasHoy(mappedAsistencias);
      setSedesList(sedesData);
    } catch (err: any) {
      console.error('Error al cargar datos del Director Dashboard:', err);
      setFetchError(err.message || 'Error al conectar con la base de datos.');
      // En caso de fallo o error, vaciar datos (no usar mocks ficticios)
      setDocentes([]);
      setEstudiantes([]);
      setAsistenciasHoy([]);
      setSedesList([]);
    } finally {
      setLoading(false);
    }
  }, [todayIsoDate]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Filter docentes, estudiantes, and asistencias by selected sede
  const filteredDocentes = useMemo(() => {
    if (selectedSedeFilter === 'Todas') return docentes;
    return docentes.filter(d => d.sede_id === selectedSedeFilter || d.sede_nombre === selectedSedeFilter);
  }, [docentes, selectedSedeFilter]);

  const filteredEstudiantes = useMemo(() => {
    if (selectedSedeFilter === 'Todas') return estudiantes;
    return estudiantes.filter(e => e.sede_id === selectedSedeFilter);
  }, [estudiantes, selectedSedeFilter]);

  const filteredAsistencias = useMemo(() => {
    if (selectedSedeFilter === 'Todas') return asistenciasHoy;
    return asistenciasHoy.filter(a => (a as any).sede_id === selectedSedeFilter || a.sede_nombre === selectedSedeFilter);
  }, [asistenciasHoy, selectedSedeFilter]);

  // Teacher Attendance Statistics calculations (strictly based on public.asistencias_docentes.estado y origen_registro)
  const totalDocentes = filteredDocentes.length;
  const docentesIngresados = filteredAsistencias.filter(a => a.hora_ingreso_oficial || a.hora_ingreso_local).length;
  const docentesPendientes = Math.max(0, totalDocentes - docentesIngresados);
  const docentesPuntuales = filteredAsistencias.filter(a => a.estado === 'puntual').length;
  const docentesAtrasados = filteredAsistencias.filter(a => a.estado === 'atraso').length;
  const registrosOfflineCount = filteredAsistencias.filter(a => a.origen_registro === 'sin_conexion').length;

  // Pending exceptions requiring Director approval
  const pendingExceptions = filteredAsistencias.filter(a => a.estado_excepcion === 'pendiente_revision');

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
        await loadDashboardData();
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
        await loadDashboardData();
      }
    } catch (err: any) {
      alert('Excepción al rechazar: ' + (err.message || err));
    } finally {
      setActionProcessingId(null);
    }
  };

  // Student Statistics calculations (strictly based on public.estudiantes)
  const totalEstudiantes = filteredEstudiantes.length;
  const hombres = filteredEstudiantes.filter(e => (e.sexo || '').trim() === 'Masculino').length;
  const mujeres = filteredEstudiantes.filter(e => (e.sexo || '').trim() === 'Femenino').length;
  const sinSexo = filteredEstudiantes.filter(e => {
    const s = (e.sexo || '').trim();
    return s !== 'Masculino' && s !== 'Femenino';
  }).length;

  return (
    <div className="space-y-5 pb-20">
      {/* Director Header Hero Banner */}
      <div className="bg-gradient-to-br from-[#17324D] to-slate-900 rounded-3xl p-5 text-white shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-[#FFC845]" />
            <div>
              <p className="text-xs text-[#FFC845] font-bold uppercase tracking-wider">{datos.cargo_director || 'Panel de Dirección'}</p>
              <h2 className="text-xl font-extrabold">{user.nombre_completo}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadDashboardData}
              disabled={loading}
              title="Actualizar datos en vivo"
              className="p-2 bg-white/10 hover:bg-white/20 active:scale-95 rounded-full text-white transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <div className="bg-white/10 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border border-white/20">
              {isOnline ? (
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> En línea
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-400">
                  <WifiOff className="w-3.5 h-3.5" /> Sin conexión
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-slate-300 font-medium">
          <span className="capitalize">{todayStr}</span>
          <span className="text-[#FFC845] font-bold">{datos.nombre_corto}</span>
        </div>
      </div>

      {/* Database Error Banner if any query failed */}
      {fetchError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-800 text-xs">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="block font-bold">Aviso de consulta a la base de datos</strong>
            <p>{fetchError}</p>
          </div>
          <button
            onClick={loadDashboardData}
            className="px-3 py-1 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shrink-0"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Quick Action Buttons Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <button
          onClick={onOpenAddTeacherModal}
          id="btn-dir-add-docente"
          className="p-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-2xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 shadow-md h-20 transition-all"
        >
          <UserCheck className="w-6 h-6 text-[#FFC845]" />
          <span>+ Añadir Docente</span>
        </button>

        <button
          onClick={onOpenAddStudentModal}
          id="btn-dir-add-estudiante"
          className="p-3 bg-[#11B8AE] hover:bg-teal-700 active:scale-95 text-white rounded-2xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 shadow-md h-20 transition-all"
        >
          <Users className="w-6 h-6 text-white" />
          <span>+ Añadir Estudiante</span>
        </button>

        <button
          onClick={onOpenPublishModal}
          id="btn-dir-publicar"
          className="p-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 rounded-2xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 shadow-md h-20 transition-all"
        >
          <FilePlus className="w-6 h-6 text-slate-950" />
          <span>Publicar Aviso</span>
        </button>

        <button
          onClick={onDownloadReport}
          id="btn-dir-reporte"
          className="p-3 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white rounded-2xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 shadow-md h-20 transition-all"
        >
          <FileSpreadsheet className="w-6 h-6 text-[#FFC845]" />
          <span>Descargar Excel</span>
        </button>
      </div>

      {/* Sede Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setSelectedSedeFilter('Todas')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
            selectedSedeFilter === 'Todas'
              ? 'bg-[#00A651] text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Todas las Sedes
        </button>
        {sedesList.map((sede) => (
          <button
            key={sede.id}
            onClick={() => setSelectedSedeFilter(sede.id)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedSedeFilter === sede.id
                ? 'bg-[#00A651] text-white shadow-sm'
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
          <span className="text-xs font-bold text-slate-500">Cargando métricas en vivo desde Supabase...</span>
        </div>
      )}

      {!loading && (
        <>
          {/* Teacher Attendance Daily Summary */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-6 h-6 text-[#00A651]" />
                <h3 className="font-extrabold text-lg text-[#17324D]">Resumen Asistencia Docente</h3>
              </div>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                {docentesIngresados}/{totalDocentes} Asistieron
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block">Puntuales</span>
                <strong className="text-xl font-extrabold text-[#00A651]">{docentesPuntuales}</strong>
              </div>

              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200">
                <span className="text-[10px] font-bold text-amber-700 uppercase block">Atrasos</span>
                <strong className="text-xl font-extrabold text-amber-600">{docentesAtrasados}</strong>
              </div>

              <div className="p-3 bg-red-50 rounded-2xl border border-red-200">
                <span className="text-[10px] font-bold text-red-700 uppercase block">Pendientes</span>
                <strong className="text-xl font-extrabold text-red-600">{docentesPendientes}</strong>
              </div>

              <div className="p-3 bg-yellow-50 rounded-2xl border border-yellow-300">
                <span className="text-[10px] font-bold text-yellow-800 uppercase block">Sin Conexión</span>
                <strong className="text-xl font-extrabold text-yellow-900">{registrosOfflineCount}</strong>
              </div>
            </div>

            {/* Pending Exceptions Validation Section */}
            {pendingExceptions.length > 0 && (
              <div className="p-4 bg-amber-50/90 border-2 border-amber-300 rounded-3xl space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <h4 className="font-extrabold text-sm text-amber-950">
                      Excepciones de Asistencia Pendientes ({pendingExceptions.length})
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-200/80 px-2.5 py-0.5 rounded-full">
                    Requiere Validación
                  </span>
                </div>

                <div className="space-y-3">
                  {pendingExceptions.map((a) => {
                    const fullSelfie = getSelfieFullUrl(a.selfie_url);
                    const isProcessing = actionProcessingId === a.id;

                    return (
                      <div
                        key={a.id}
                        className="p-3.5 bg-white rounded-2xl border border-amber-200 shadow-xs space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-extrabold text-sm text-[#17324D] block">
                              {a.docente_nombre}
                            </span>
                            <span className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              {a.sede_nombre}
                              {a.hora_ingreso_oficial && (
                                <span className="ml-1 text-slate-400">
                                  • {new Date(a.hora_ingreso_oficial).toLocaleTimeString('es-BO', { timeZone: 'America/La_Paz', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </span>
                          </div>

                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 uppercase">
                            {a.estado_gps_ingreso || 'gps_impreciso'}
                          </span>
                        </div>

                        {/* Motivo / Justificación */}
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-xs">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                            Motivo / Observación del Docente:
                          </span>
                          <p className="text-xs text-slate-800 font-medium italic">
                            "{a.observacion_excepcion || a.observacion || 'Sin motivo detallado'}"
                          </p>
                        </div>

                        {/* GPS metrics and Selfie preview button */}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 pt-1">
                          <div className="flex items-center gap-3">
                            <span>
                              Distancia:{' '}
                              <strong className="text-slate-800">
                                {a.distancia_m_ingreso !== undefined && a.distancia_m_ingreso !== null
                                  ? `${a.distancia_m_ingreso} m`
                                  : 'N/D'}
                              </strong>
                            </span>
                            <span>
                              Precisión:{' '}
                              <strong className="text-slate-800">
                                {a.precision_gps_ingreso !== undefined && a.precision_gps_ingreso !== null
                                  ? `±${a.precision_gps_ingreso} m`
                                  : 'N/D'}
                              </strong>
                            </span>
                          </div>

                          {fullSelfie && (
                            <button
                              type="button"
                              onClick={() => setPreviewSelfieUrl(fullSelfie)}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#00A651] border border-emerald-300 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Ver Selfie</span>
                            </button>
                          )}
                        </div>

                        {/* Approve / Reject Action Buttons */}
                        <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleApproveException(a.id)}
                            className="flex-1 h-10 bg-[#00A651] hover:bg-[#008f45] active:scale-[0.98] text-white rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                          >
                            <Check className="w-4 h-4 text-emerald-200" />
                            <span>{isProcessing ? 'Procesando...' : 'Aprobar'}</span>
                          </button>

                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleRejectException(a.id)}
                            className="flex-1 h-10 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                          >
                            <X className="w-4 h-4 text-red-200" />
                            <span>{isProcessing ? 'Procesando...' : 'Rechazar'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Teacher shift status list */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Estado de Jornada Hoy ({todayIsoDate})</h4>
              {filteredAsistencias.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs text-slate-500 font-medium">
                  No se registran marcaciones docentes para la fecha laboral de hoy.
                </div>
              ) : (
                filteredAsistencias.map((a) => {
                  const selfieUrl = getSelfieFullUrl(a.selfie_url);
                  return (
                    <div
                      key={a.id}
                      className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-[#17324D] block text-sm">{a.docente_nombre}</span>
                        <span className="text-slate-500">{a.sede_nombre}</span>
                        {a.estado_excepcion && a.estado_excepcion !== 'ninguna' && (
                          <div className="mt-1 flex items-center gap-1.5">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md font-bold text-[9px] uppercase ${
                                a.estado_excepcion === 'aprobada'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : a.estado_excepcion === 'rechazada'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-amber-100 text-amber-900'
                              }`}
                            >
                              Excepción: {a.estado_excepcion}
                            </span>
                            {selfieUrl && (
                              <button
                                type="button"
                                onClick={() => setPreviewSelfieUrl(selfieUrl)}
                                className="text-slate-500 hover:text-[#00A651] font-bold text-[10px] underline flex items-center gap-0.5"
                              >
                                <Eye className="w-3 h-3" /> Selfie
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full font-bold uppercase text-[10px] ${
                            a.estado === 'puntual'
                              ? 'bg-emerald-100 text-emerald-800'
                              : a.estado === 'atraso'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {a.estado}
                        </span>
                        {a.origen_registro === 'sin_conexion' && (
                          <span className="block text-[10px] font-bold text-amber-700 mt-0.5">Offline no verificado</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Student Attendance & Statistics Card */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-6 h-6 text-[#00A651]" />
                <h3 className="font-extrabold text-lg text-[#17324D]">Estudiantes y Matrícula Activa</h3>
              </div>
              <button
                onClick={() => onNavigateTab('estudiantes')}
                className="text-xs font-bold text-[#00A651] hover:underline flex items-center gap-1"
              >
                Ver Todo <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block">Inscritos Activos</span>
                <strong className="text-2xl font-extrabold text-[#00A651]">{totalEstudiantes}</strong>
              </div>

              <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200">
                <span className="text-[10px] font-bold text-blue-700 uppercase block">Masculino</span>
                <strong className="text-2xl font-extrabold text-blue-900">{hombres}</strong>
                <span className="text-[10px] text-blue-600 block font-medium">
                  ({totalEstudiantes > 0 ? Math.round((hombres / totalEstudiantes) * 100) : 0}%)
                </span>
              </div>

              <div className="p-3 bg-pink-50 rounded-2xl border border-pink-200">
                <span className="text-[10px] font-bold text-pink-700 uppercase block">Femenino</span>
                <strong className="text-2xl font-extrabold text-pink-900">{mujeres}</strong>
                <span className="text-[10px] text-pink-600 block font-medium">
                  ({totalEstudiantes > 0 ? Math.round((mujeres / totalEstudiantes) * 100) : 0}%)
                </span>
              </div>
            </div>

            {sinSexo > 0 && (
              <div className="text-[11px] font-medium text-slate-500 text-center bg-slate-50 py-1.5 px-3 rounded-xl border border-slate-200">
                Estudiantes sin sexo especificado en base de datos: <strong className="text-slate-800">{sinSexo}</strong>
              </div>
            )}

            {/* At risk alerts preview - Empty state until real follow-up module connects */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-700 font-bold">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Alertas y Seguimiento Estudiantil
                </span>
                <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full text-[10px]">0 Alertas</span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                No hay alertas activas de deserción o faltas consecutivas registradas en el sistema para esta jornada.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Selfie Preview Modal */}
      {previewSelfieUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-4 max-w-sm w-full space-y-3 relative shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-extrabold text-sm text-[#17324D] flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-[#00A651]" />
                Selfie de Asistencia
              </span>
              <button
                type="button"
                onClick={() => setPreviewSelfieUrl(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 flex items-center justify-center max-h-80">
              <img
                src={previewSelfieUrl}
                alt="Selfie docente"
                className="w-full h-auto object-cover max-h-80"
                referrerPolicy="no-referrer"
              />
            </div>
            <button
              type="button"
              onClick={() => setPreviewSelfieUrl(null)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition-all"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
