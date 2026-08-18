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
  Building2
} from 'lucide-react';
import { Perfil, AsistenciaDocente, Estudiante, DatosInstitucionales, Sede } from '../types';
import { getLocalDatosInstitucionales } from '../lib/institutional';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

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

  const todayStr = new Date().toLocaleDateString('es-BO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Calculate local date format YYYY-MM-DD for today's queries
  const todayIsoDate = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

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
      // Execute parallel queries directly against Supabase
      const [
        docentesRes,
        estudiantesRes,
        asistenciasRes,
        sedesRes
      ] = await Promise.all([
        // 1. Total docentes: public.perfiles con rol='docente' y activo=true
        supabase
          .from('perfiles')
          .select('*, sedes(nombre), horarios(nombre)')
          .eq('rol', 'docente')
          .eq('activo', true)
          .order('nombre_completo', { ascending: true }),

        // 2. Total estudiantes: public.estudiantes con estado='activo'
        supabase
          .from('estudiantes')
          .select('id, codigo_interno, nombre_completo, sexo, estado, sede_id, grupo_id, programa_id')
          .eq('estado', 'activo'),

        // 3. Resumen asistencia docente de hoy: public.asistencias_docentes filtrando por fecha_laboral de hoy
        supabase
          .from('asistencias_docentes')
          .select('*, perfiles(nombre_completo, sede_id, sedes(nombre))')
          .eq('fecha_laboral', todayIsoDate)
          .order('created_at', { ascending: false }),

        // 4. Sedes activas para pestañas dinámicas
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

      // Map joined fields for docentes
      const mappedDocentes: Perfil[] = (docentesRes.data || []).map((d: any) => ({
        ...d,
        sede_nombre: d.sedes?.nombre || d.sede_nombre || 'Sin Sede'
      }));

      // Map joined fields for asistencias_docentes
      const mappedAsistencias: AsistenciaDocente[] = (asistenciasRes.data || []).map((a: any) => ({
        ...a,
        docente_nombre: a.perfiles?.nombre_completo || 'Docente sin nombre',
        sede_nombre: a.perfiles?.sedes?.nombre || 'Sede sin asignar',
        sede_id: a.perfiles?.sede_id || a.sede_id
      }));

      setDocentes(mappedDocentes);
      setEstudiantes((estudiantesRes.data || []) as Estudiante[]);
      setAsistenciasHoy(mappedAsistencias);
      setSedesList((sedesRes.data || []) as Sede[]);
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

            {/* Teacher shift status list */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Estado de Jornada Hoy ({todayIsoDate})</h4>
              {filteredAsistencias.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs text-slate-500 font-medium">
                  No se registran marcaciones docentes para la fecha laboral de hoy.
                </div>
              ) : (
                filteredAsistencias.map((a) => (
                  <div
                    key={a.id}
                    className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-[#17324D] block text-sm">{a.docente_nombre}</span>
                      <span className="text-slate-500">{a.sede_nombre}</span>
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
                ))
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
    </div>
  );
};
