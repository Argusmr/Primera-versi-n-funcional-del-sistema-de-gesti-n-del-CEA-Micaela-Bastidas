import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  Upload,
  Plus,
  FileSpreadsheet,
  Search,
  CheckSquare,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { Perfil, Estudiante, Grupo, AsistenciaEstudiante } from '../types';
import { MOCK_ESTUDIANTES, INITIAL_GRUPOS } from '../lib/mockData';
import { saveOfflineEstudianteAsistencia } from '../lib/db';
import { downloadStudentEnrollmentReport } from '../lib/excelExport';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface StudentsViewProps {
  user: Perfil;
  isOnline: boolean;
  onOpenAddStudentModal: () => void;
}

export const StudentsView: React.FC<StudentsViewProps> = ({
  user,
  isOnline,
  onOpenAddStudentModal
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'asistencia' | 'nomina'>(
    user.rol === 'superadmin' ? 'nomina' : 'asistencia'
  );

  // Attendance Form State
  const [selectedGrupoId, setSelectedGrupoId] = useState<string>(INITIAL_GRUPOS[0].id);
  const [fechaClase, setFechaClase] = useState<string>(new Date().toISOString().slice(0, 10));
  const [materiaClase, setMateriaClase] = useState<string>('Lenguaje y Comunicación');
  
  // Local Attendance Marking Map: studentId -> 'presente' | 'atraso' | 'falta' | 'licencia'
  const [attendanceMap, setAttendanceMap] = useState<Record<string, 'presente' | 'atraso' | 'falta' | 'licencia'>>({
    'est-1': 'presente',
    'est-2': 'presente',
    'est-3': 'falta'
  });
  
  const [attendanceSaved, setAttendanceSaved] = useState<boolean>(false);
  const [savedGroupPercent, setSavedGroupPercent] = useState<number | null>(null);

  // Student Search
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Nomina Real State from Supabase
  const [nominaStudents, setNominaStudents] = useState<Estudiante[]>([]);
  const [loadingNomina, setLoadingNomina] = useState<boolean>(false);
  const [nominaError, setNominaError] = useState<string | null>(null);

  const fetchNomina = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setNominaError('Supabase no está configurado.');
      setNominaStudents([]);
      return;
    }

    setLoadingNomina(true);
    setNominaError(null);
    try {
      const { data, error } = await supabase
        .from('estudiantes')
        .select(`
          id,
          codigo_interno,
          nombre_completo,
          documento,
          programa_id,
          sede_id,
          carrera_especialidad,
          nivel,
          grupo_id,
          estado,
          fecha_inscripcion,
          grupos (
            id,
            nombre
          ),
          sedes (
            id,
            nombre
          )
        `)
        .order('nombre_completo', { ascending: true });

      if (error) {
        throw error;
      }

      const mapped: Estudiante[] = (data || []).map((st: any) => ({
        id: st.id,
        codigo_interno: st.codigo_interno || `EST-${st.id.slice(0, 6)}`,
        nombre_completo: st.nombre_completo,
        documento: st.documento || undefined,
        fecha_inscripcion: st.fecha_inscripcion || new Date().toISOString().slice(0, 10),
        programa_id: st.programa_id,
        sede_id: st.sede_id,
        carrera_especialidad: st.carrera_especialidad,
        nivel: st.nivel,
        grupo_id: st.grupo_id,
        estado: st.estado || 'activo',
        grupo_nombre: st.grupos?.nombre || undefined,
        sede_nombre: st.sedes?.nombre || undefined,
        programa_nombre: st.carrera_especialidad || 'EPJA'
      }));

      setNominaStudents(mapped);
    } catch (err: any) {
      console.error('Error al cargar la nómina de estudiantes desde Supabase:', err);
      setNominaError(err.message || 'Error al consultar nómina en Supabase.');
      setNominaStudents([]);
    } finally {
      setLoadingNomina(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'nomina') {
      fetchNomina();
    }
  }, [activeSubTab]);

  useEffect(() => {
    const handleStudentAdded = () => {
      fetchNomina();
    };
    window.addEventListener('estudiante-added', handleStudentAdded);
    return () => {
      window.removeEventListener('estudiante-added', handleStudentAdded);
    };
  }, []);

  // Attendance tab students list filtered by group and search
  const filteredStudents = MOCK_ESTUDIANTES.filter((e) => {
    const matchGroup = e.grupo_id === selectedGrupoId;
    const matchSearch = e.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        e.codigo_interno.toLowerCase().includes(searchTerm.toLowerCase());
    return matchGroup && matchSearch;
  });

  // Nomina tab filtered real students
  const filteredNominaStudents = nominaStudents.filter((e) => {
    const term = searchTerm.toLowerCase();
    const matchName = e.nombre_completo.toLowerCase().includes(term);
    const matchCode = e.codigo_interno ? e.codigo_interno.toLowerCase().includes(term) : false;
    const matchDoc = e.documento ? e.documento.toLowerCase().includes(term) : false;
    return matchName || matchCode || matchDoc;
  });

  const handleMarkAllPresent = () => {
    const updated: Record<string, 'presente' | 'atraso' | 'falta' | 'licencia'> = {};
    filteredStudents.forEach(e => {
      updated[e.id] = 'presente';
    });
    setAttendanceMap(updated);
  };

  const handleStatusChange = (studentId: string, status: 'presente' | 'atraso' | 'falta' | 'licencia') => {
    setAttendanceMap(prev => ({ ...prev, [studentId]: status }));
  };

  const handleSaveAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    const syncKey = `asis-est-${selectedGrupoId}-${fechaClase}-${Date.now()}`;

    const items: Array<{
      estudiante_id: string;
      estado: 'presente' | 'atraso' | 'falta' | 'licencia';
    }> = Object.entries(attendanceMap).map(([estId, st]) => ({
      estudiante_id: estId,
      estado: st as 'presente' | 'atraso' | 'falta' | 'licencia'
    }));

    if (!isOnline) {
      await saveOfflineEstudianteAsistencia({
        sync_key: syncKey,
        grupo_id: selectedGrupoId,
        fecha: fechaClase,
        materia: materiaClase,
        docente_id: user.id,
        asistencias: items,
        timestamp: Date.now()
      });
    }

    // Calculate group percentage: (presente + atraso) / total * 100
    const presentesOatrasos = items.filter(i => i.estado === 'presente' || i.estado === 'atraso').length;
    const totalGroup = Math.max(1, items.length);
    const percent = Math.round((presentesOatrasos / totalGroup) * 100);

    setSavedGroupPercent(percent);
    setAttendanceSaved(true);
  };

  const handleExportNomina = () => {
    if (nominaStudents.length > 0) {
      downloadStudentEnrollmentReport(nominaStudents);
    }
  };

  return (
    <div className="space-y-5 pb-20">
      {/* Top Selector Subtabs */}
      <div className="flex bg-slate-200 p-1 rounded-2xl">
        <button
          onClick={() => setActiveSubTab('asistencia')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
            activeSubTab === 'asistencia' ? 'bg-[#00A651] text-white shadow-sm' : 'text-slate-700'
          }`}
        >
          Asistencia Diaria
        </button>
        <button
          onClick={() => setActiveSubTab('nomina')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
            activeSubTab === 'nomina' ? 'bg-[#00A651] text-white shadow-sm' : 'text-slate-700'
          }`}
        >
          Nómina de Inscritos
        </button>
      </div>

      {activeSubTab === 'asistencia' ? (
        /* ================= ASISTENCIA DIARIA FORM ================= */
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200 space-y-4">
            <h3 className="font-extrabold text-[#17324D] text-lg flex items-center gap-2">
              <UserCheck className="w-6 h-6 text-[#00A651]" />
              Registro de Asistencia Estudiantil
            </h3>

            {/* Select Group, Date & Subject */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-bold">
              <div>
                <label className="block text-slate-700 mb-1">Grupo / Curso</label>
                <select
                  value={selectedGrupoId}
                  onChange={e => setSelectedGrupoId(e.target.value)}
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium"
                >
                  {INITIAL_GRUPOS.map(g => (
                    <option key={g.id} value={g.id}>{g.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Fecha</label>
                <input
                  type="date"
                  value={fechaClase}
                  onChange={e => setFechaClase(e.target.value)}
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Materia / Módulo</label>
                <input
                  type="text"
                  value={materiaClase}
                  onChange={e => setMateriaClase(e.target.value)}
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium"
                />
              </div>
            </div>

            {/* Quick Action: Mark All Present */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-xs text-slate-500 font-medium">
                Estudiantes en este grupo: <strong>{filteredStudents.length}</strong>
              </span>

              <button
                type="button"
                onClick={handleMarkAllPresent}
                className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-[#00A651] font-bold text-xs rounded-xl border border-emerald-200 flex items-center gap-1.5"
              >
                <CheckSquare className="w-4 h-4" />
                <span>Marcar Todos Presentes</span>
              </button>
            </div>
          </div>

          {attendanceSaved && savedGroupPercent !== null && (
            <div className="p-4 bg-emerald-100 border border-emerald-300 rounded-3xl space-y-2 text-center text-emerald-950">
              <Sparkles className="w-8 h-8 text-[#00A651] mx-auto" />
              <h4 className="font-extrabold text-lg">¡Asistencia Guardada Correctamente!</h4>
              <p className="text-xs font-medium">
                Porcentaje de asistencia del grupo hoy: <strong className="text-base text-[#00A651]">{savedGroupPercent}%</strong>
              </p>
              <button
                onClick={() => setAttendanceSaved(false)}
                className="px-4 py-2 bg-[#00A651] text-white font-bold text-xs rounded-xl mt-2"
              >
                Modificar Registro
              </button>
            </div>
          )}

          {/* Student List & Attendance Toggles */}
          {!attendanceSaved && (
            <form onSubmit={handleSaveAttendance} className="space-y-3">
              {filteredStudents.map((st) => {
                const currentStatus = attendanceMap[st.id] || 'presente';
                return (
                  <div
                    key={st.id}
                    className="p-4 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          {st.codigo_interno}
                        </span>
                        <h4 className="font-extrabold text-base text-[#17324D] mt-1">{st.nombre_completo}</h4>
                        <p className="text-xs text-slate-500 font-medium">{st.carrera_especialidad} • {st.nivel}</p>
                      </div>
                    </div>

                    {/* Status Toggles Buttons */}
                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleStatusChange(st.id, 'presente')}
                        className={`h-11 rounded-xl text-xs font-bold transition-all ${
                          currentStatus === 'presente'
                            ? 'bg-[#00A651] text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Presente
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(st.id, 'atraso')}
                        className={`h-11 rounded-xl text-xs font-bold transition-all ${
                          currentStatus === 'atraso'
                            ? 'bg-amber-500 text-slate-950 shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Atraso
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(st.id, 'falta')}
                        className={`h-11 rounded-xl text-xs font-bold transition-all ${
                          currentStatus === 'falta'
                            ? 'bg-red-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Falta
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(st.id, 'licencia')}
                        className={`h-11 rounded-xl text-xs font-bold transition-all ${
                          currentStatus === 'licencia'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Licencia
                      </button>
                    </div>
                  </div>
                );
              })}

              <button
                type="submit"
                id="btn-guardar-asistencia-est"
                className="w-full h-14 bg-[#00A651] hover:bg-[#008f45] text-white font-extrabold text-lg rounded-2xl shadow-md flex items-center justify-center gap-2"
              >
                <span>GUARDAR ASISTENCIA DEL GRUPO</span>
              </button>
            </form>
          )}
        </div>
      ) : (
        /* ================= NOMINA DE INSCRITOS VIEW ================= */
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar por estudiante o código..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full h-11 pl-10 pr-4 bg-white border border-slate-300 rounded-2xl text-xs font-medium outline-none"
              />
            </div>

            {user.rol === 'superadmin' && (
              <button
                onClick={onOpenAddStudentModal}
                className="h-11 px-3 bg-[#00A651] text-white font-bold text-xs rounded-2xl flex items-center gap-1 shrink-0 hover:bg-[#008d44] transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Añadir</span>
              </button>
            )}

            <button
              onClick={handleExportNomina}
              disabled={nominaStudents.length === 0}
              className="h-11 px-3 bg-slate-800 text-white font-bold text-xs rounded-2xl flex items-center gap-1 shrink-0 hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#FFC845]" />
              <span>Excel</span>
            </button>
          </div>

          {/* Error Message */}
          {nominaError && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-3xl text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>Error al obtener nómina: {nominaError}</span>
              </div>
              <button
                type="button"
                onClick={fetchNomina}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-[11px] transition-colors"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* Loading state */}
          {loadingNomina && (
            <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-500 font-bold text-xs space-y-2">
              <div className="inline-block animate-spin w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full" />
              <p>Cargando nómina de estudiantes desde Supabase...</p>
            </div>
          )}

          {/* Empty state */}
          {!loadingNomina && !nominaError && filteredNominaStudents.length === 0 && (
            <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-500 font-bold text-xs space-y-2">
              <Users className="w-8 h-8 text-slate-300 mx-auto" />
              <p>{searchTerm ? 'No se encontraron estudiantes que coincidan con la búsqueda.' : 'No hay estudiantes registrados.'}</p>
            </div>
          )}

          {/* Roster Cards */}
          {!loadingNomina && !nominaError && filteredNominaStudents.length > 0 && (
            <div className="space-y-3">
              {filteredNominaStudents.map((s) => (
                <div key={s.id} className="p-4 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        {s.codigo_interno}
                      </span>
                      <h4 className="font-extrabold text-base text-[#17324D] mt-1">{s.nombre_completo}</h4>
                      <p className="text-xs text-slate-500 font-medium">
                        CI: {s.documento || 'N/D'} • Inscrito: {s.fecha_inscripcion}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full font-bold text-[10px] uppercase ${
                        s.estado === 'activo'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {s.estado}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 grid grid-cols-2 gap-1 font-medium">
                    <div>Sede: <strong className="text-slate-900">{s.sede_nombre || 'N/D'}</strong></div>
                    <div>Programa: <strong className="text-slate-900">{s.programa_nombre || s.carrera_especialidad || 'EPJA'}</strong></div>
                    <div>Grupo: <strong className="text-slate-900">{s.grupo_nombre || 'N/D'}</strong></div>
                    <div>Nivel: <strong className="text-slate-900">{s.nivel || 'N/D'}</strong></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

