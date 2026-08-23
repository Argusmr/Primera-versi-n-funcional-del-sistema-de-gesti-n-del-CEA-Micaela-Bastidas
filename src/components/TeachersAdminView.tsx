import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Shield,
  Key,
  Edit,
  Trash2,
  Plus,
  Power,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  FileCheck,
  Search,
  Filter,
  Eye,
  Layers,
  ArrowRight,
  MapPin,
  Clock,
  BookOpen
} from 'lucide-react';
import { Perfil, Sede, Horario, Programa, ControlDocumental, AsignacionDocente } from '../types';
import { MOCK_DOCENTES, INITIAL_SEDES, INITIAL_HORARIOS, INITIAL_PROGRAMAS } from '../lib/mockData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { EditTeacherModal } from './EditTeacherModal';
import { EditControlDocumentalModal } from './EditControlDocumentalModal';
import { TeacherDetailModal } from './TeacherDetailModal';
import { TeacherAssignmentsModal } from './TeacherAssignmentsModal';
import { getLocalControlDocumentalMap, getControlDocumentalForDocente, calculateEstadoControl } from '../lib/controlDocumental';
import { loadAllActiveAsignaciones, getLocalAsignaciones } from '../lib/teacherAssignments';

interface TeachersAdminViewProps {
  user: Perfil;
  isOnline: boolean;
  onOpenAddTeacherModal: () => void;
  onUpdateCurrentUser?: (user: Perfil) => void;
}

export const TeachersAdminView: React.FC<TeachersAdminViewProps> = ({
  user,
  isOnline,
  onOpenAddTeacherModal,
  onUpdateCurrentUser
}) => {
  const [docentes, setDocentes] = useState<Perfil[]>([]);
  const [loadingDocentes, setLoadingDocentes] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [docFilterStatus, setDocFilterStatus] = useState<'todos' | 'presentados' | 'pendientes'>('todos');
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  // Modals state
  const [editingTeacher, setEditingTeacher] = useState<Perfil | null>(null);
  const [viewingTeacher, setViewingTeacher] = useState<Perfil | null>(null);
  const [managingAssignmentsTeacher, setManagingAssignmentsTeacher] = useState<Perfil | null>(null);

  // Assignments Map per Docente
  const [assignmentsMap, setAssignmentsMap] = useState<Record<string, AsignacionDocente[]>>({});

  // Control Documental State Map
  const [controlMap, setControlMap] = useState<Record<string, ControlDocumental>>({});
  const [editingControlDocente, setEditingControlDocente] = useState<Perfil | null>(null);

  const fetchDocentes = async () => {
    if (isSupabaseConfigured && supabase) {
      setLoadingDocentes(true);
      setFetchError(null);
      try {
        const { data, error } = await supabase
          .from('perfiles')
          .select('*, sedes(nombre), horarios(nombre)')
          .eq('rol', 'docente')
          .order('nombre_completo', { ascending: true });

        if (error) {
          setFetchError('Error al obtener docentes de Supabase: ' + error.message);
          setDocentes([]);
        } else if (data) {
          const mapped: Perfil[] = data.map((d: any) => ({
            ...d,
            sede_nombre: d.sedes?.nombre || d.sede_nombre,
            horario_nombre: d.horarios?.nombre || d.horario_nombre,
          }));
          setDocentes(mapped);
        }
      } catch (e: any) {
        setFetchError('Excepción al conectar con Supabase: ' + (e.message || e));
        setDocentes([]);
      } finally {
        setLoadingDocentes(false);
      }
    } else {
      setDocentes(MOCK_DOCENTES);
      setLoadingDocentes(false);
    }
  };

  const fetchAssignments = async () => {
    try {
      const allAsigs = await loadAllActiveAsignaciones();
      const grouped: Record<string, AsignacionDocente[]> = {};
      allAsigs.forEach(asig => {
        if (!grouped[asig.docente_id]) {
          grouped[asig.docente_id] = [];
        }
        grouped[asig.docente_id].push(asig);
      });
      setAssignmentsMap(grouped);
    } catch (e) {
      console.warn('Error al cargar asignaciones docentes:', e);
    }
  };

  useEffect(() => {
    fetchDocentes();
    fetchAssignments();

    const handleRefetch = () => {
      fetchDocentes();
      fetchAssignments();
    };

    window.addEventListener('docente-added', handleRefetch);
    window.addEventListener('asignaciones-docentes-changed', handleRefetch);

    return () => {
      window.removeEventListener('docente-added', handleRefetch);
      window.removeEventListener('asignaciones-docentes-changed', handleRefetch);
    };
  }, []);

  useEffect(() => {
    async function loadControls() {
      const localMap = getLocalControlDocumentalMap();
      const updatedMap: Record<string, ControlDocumental> = { ...localMap };

      for (const d of docentes) {
        const c = await getControlDocumentalForDocente(d.id);
        updatedMap[d.id] = c;
      }
      setControlMap(updatedMap);
    }
    if (docentes.length > 0) {
      loadControls();
    }
  }, [docentes]);

  const handleControlSaveSuccess = (updated: ControlDocumental) => {
    setControlMap(prev => ({
      ...prev,
      [updated.docente_id]: updated
    }));
    setActionMsg(`Control documental actualizado para el docente.`);
    setTimeout(() => setActionMsg(null), 3000);
  };

  // Filter docentes
  const filtered = docentes.filter(d => {
    const matchesSearch =
      d.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.rda && d.rda.includes(searchTerm)) ||
      (d.especialidad && d.especialidad.toLowerCase().includes(searchTerm.toLowerCase()));

    const ctrl = controlMap[d.id];
    const isPresentado = ctrl
      ? calculateEstadoControl(ctrl.tiene_plan_modular, ctrl.tiene_planificacion_curricular) === 'presentado'
      : false;

    if (docFilterStatus === 'presentados' && !isPresentado) return false;
    if (docFilterStatus === 'pendientes' && isPresentado) return false;

    return matchesSearch;
  });

  // Calculate stats for Control Documental
  const totalDocentesCount = docentes.length;
  const presentadosCount = docentes.filter(d => {
    const c = controlMap[d.id];
    return c ? calculateEstadoControl(c.tiene_plan_modular, c.tiene_planificacion_curricular) === 'presentado' : false;
  }).length;
  const pendientesCount = totalDocentesCount - presentadosCount;

  const handleToggleActivo = async (docenteId: string) => {
    const current = docentes.find(d => d.id === docenteId);
    if (!current) return;
    const nextActivo = !current.activo;

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('perfiles')
        .update({ activo: nextActivo, updated_at: new Date().toISOString() })
        .eq('id', docenteId);

      if (error) {
        setActionMsg('Error en Supabase: ' + error.message);
        setTimeout(() => setActionMsg(null), 4000);
        return;
      }
      await fetchDocentes();
    } else {
      setDocentes(prev => prev.map(d => d.id === docenteId ? { ...d, activo: nextActivo } : d));
    }

    setActionMsg('Estado del docente actualizado correctamente.');
    setTimeout(() => setActionMsg(null), 3000);
  };

  const handleTogglePublicar = async (docenteId: string) => {
    const current = docentes.find(d => d.id === docenteId);
    if (!current) return;
    const nextPublicar = !current.puede_publicar;

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('perfiles')
        .update({ puede_publicar: nextPublicar, updated_at: new Date().toISOString() })
        .eq('id', docenteId);

      if (error) {
        setActionMsg('Error en Supabase: ' + error.message);
        setTimeout(() => setActionMsg(null), 4000);
        return;
      }
      await fetchDocentes();
    } else {
      setDocentes(prev => prev.map(d => d.id === docenteId ? { ...d, puede_publicar: nextPublicar } : d));
    }

    setActionMsg('Permiso de publicación actualizado.');
    setTimeout(() => setActionMsg(null), 3000);
  };

  const handleSaveTeacherSuccess = async (updatedTeacher: Perfil) => {
    if (isSupabaseConfigured && supabase) {
      await fetchDocentes();
    } else {
      setDocentes(prev => prev.map(d => d.id === updatedTeacher.id ? updatedTeacher : d));
    }
    if (updatedTeacher.id === user.id && onUpdateCurrentUser) {
      onUpdateCurrentUser(updatedTeacher);
    }
    setEditingTeacher(null);
    setActionMsg('Docente actualizado con éxito en Supabase.');
    setTimeout(() => setActionMsg(null), 3000);
  };

  return (
    <div className="space-y-5 pb-20">
      {/* Title & Add Teacher Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-[#17324D]">Gestión de Personal Docente</h2>
          <p className="text-xs text-slate-500 font-medium">Asignaciones académicas, sedes, horarios y control documental</p>
        </div>
        <button
          onClick={onOpenAddTeacherModal}
          id="btn-add-teacher"
          className="h-10 px-3 bg-[#00A651] hover:bg-[#008f45] text-white font-bold text-xs rounded-xl flex items-center gap-1 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4 text-[#FFC845]" />
          <span>+ Docente</span>
        </button>
      </div>

      {actionMsg && (
        <div className="p-3 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-[#00A651]" />
          <span>{actionMsg}</span>
        </div>
      )}

      {fetchError && (
        <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-2xl text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}

      {/* Control Documental Summary & Filters Header Bar */}
      <div className="p-4 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-[#00A651]" />
            <h3 className="font-extrabold text-sm text-[#17324D]">Resumen de Control Documental</h3>
          </div>
          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
            Total: {totalDocentesCount} Docentes
          </span>
        </div>

        {/* Stats Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <div className="p-2.5 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between">
            <span className="text-emerald-900 font-extrabold flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00A651]" />
              Verde: Presentados
            </span>
            <strong className="text-base font-black text-[#00A651]">{presentadosCount}</strong>
          </div>

          <div className="p-2.5 bg-red-50 rounded-2xl border border-red-200 flex items-center justify-between">
            <span className="text-red-900 font-extrabold flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
              Rojo: Pendientes
            </span>
            <strong className="text-base font-black text-red-600">{pendientesCount}</strong>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between col-span-2 sm:col-span-1">
            <span className="text-slate-700 font-extrabold">Avance General</span>
            <strong className="text-sm font-black text-[#17324D]">
              {totalDocentesCount > 0 ? Math.round((presentadosCount / totalDocentesCount) * 100) : 0}%
            </strong>
          </div>
        </div>

        {/* Search & Status Filter Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar docente por nombre, especialidad o RDA..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-[#00A651]"
            />
          </div>

          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl font-extrabold text-[11px]">
            <button
              onClick={() => setDocFilterStatus('todos')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                docFilterStatus === 'todos'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({totalDocentesCount})
            </button>
            <button
              onClick={() => setDocFilterStatus('presentados')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                docFilterStatus === 'presentados'
                  ? 'bg-[#00A651] text-white shadow-xs'
                  : 'text-emerald-800 hover:text-emerald-950'
              }`}
            >
              Verde ({presentadosCount})
            </button>
            <button
              onClick={() => setDocFilterStatus('pendientes')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                docFilterStatus === 'pendientes'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-red-700 hover:text-red-950'
              }`}
            >
              Rojo ({pendientesCount})
            </button>
          </div>
        </div>
      </div>

      {/* Teachers List */}
      <div className="space-y-3">
        {filtered.map((doc) => {
          const ctrl = controlMap[doc.id];
          const isPresentado = ctrl
            ? calculateEstadoControl(ctrl.tiene_plan_modular, ctrl.tiene_planificacion_curricular) === 'presentado'
            : false;

          const docAssignments = assignmentsMap[doc.id] || [];
          const activeAssignments = docAssignments.filter(a => a.activo !== false && a.estado !== 'inactivo');

          return (
            <div key={doc.id} className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
              {/* Header Info */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-extrabold text-base text-[#17324D]">{doc.nombre_completo}</h3>
                    {doc.rol === 'superadmin' && (
                      <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Director
                      </span>
                    )}
                    {doc.nivel && (
                      <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {doc.nivel}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    RDA: <strong className="text-slate-800">{doc.rda || 'N/D'}</strong> • CI: <strong className="text-slate-800">{doc.ci || 'N/D'}</strong> • Especialidad: <strong className="text-slate-800">{doc.especialidad || 'General'}</strong>
                  </p>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                    doc.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                  }`}
                >
                  {doc.activo ? 'Activo' : 'Desactivado'}
                </span>
              </div>

              {/* THREE MAIN ACTIONS REQUIRED: 1. Ver docente, 2. Editar docente, 3. Gestionar asignaciones */}
              <div className="grid grid-cols-3 gap-2 pt-1 pb-1">
                {/* 1. Ver docente */}
                <button
                  type="button"
                  onClick={() => setViewingTeacher(doc)}
                  className="h-9 px-2 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl font-extrabold text-[11px] flex items-center justify-center gap-1.5 transition-all"
                  title="Ver perfil completo del docente"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-600" />
                  <span>Ver Docente</span>
                </button>

                {/* 2. Editar docente */}
                <button
                  type="button"
                  onClick={() => setEditingTeacher(doc)}
                  className="h-9 px-2 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl font-extrabold text-[11px] flex items-center justify-center gap-1.5 transition-all"
                  title="Editar datos personales e institucionales"
                >
                  <Edit className="w-3.5 h-3.5 text-[#00A651]" />
                  <span>Editar Docente</span>
                </button>

                {/* 3. Gestionar asignaciones académicas */}
                <button
                  type="button"
                  onClick={() => setManagingAssignmentsTeacher(doc)}
                  className="h-9 px-2 bg-emerald-50 hover:bg-emerald-100 text-[#00A651] border border-emerald-200 rounded-xl font-extrabold text-[11px] flex items-center justify-center gap-1.5 transition-all"
                  title="Gestionar asignaciones académicas, materias y grupos"
                >
                  <Layers className="w-3.5 h-3.5 text-[#00A651]" />
                  <span>Asignaciones</span>
                </button>
              </div>

              {/* Asignaciones Académicas Vigentes Preview Badge */}
              <div className="p-3 bg-slate-50/90 rounded-2xl border border-slate-200 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[#17324D] text-[11px] flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-[#00A651]" />
                    Asignaciones Curriculares Vigentes:
                  </span>
                  <span
                    className={`text-[10px] font-black px-2 py-0.2 rounded-full ${
                      activeAssignments.length > 0
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                        : 'bg-amber-100 text-amber-900 border border-amber-200'
                    }`}
                  >
                    {activeAssignments.length} asignación(es) activa(s)
                  </span>
                </div>

                {activeAssignments.length === 0 ? (
                  <p className="text-[11px] text-amber-800 font-medium">
                    Sin asignaciones activas registradas. Haga clic en <strong>"Asignaciones"</strong> para asignar grupos.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {activeAssignments.map(asig => (
                      <span
                        key={asig.id}
                        className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-800 shadow-2xs"
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            asig.programa_codigo === 'ETA' ? 'bg-[#00A651]' : 'bg-blue-600'
                          }`}
                        />
                        <span>
                          {asig.carrera_nombre || asig.etapa_nombre}: <strong>{asig.materia}</strong> ({asig.nivel_nombre || asig.etapa_nombre})
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Recuadro de Control Documental per Teacher */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-extrabold text-[#17324D]">
                    <FileCheck className="w-4 h-4 text-[#00A651]" />
                    <span>Control Documental</span>
                  </div>

                  {/* Estado Badge: Verde (Presentado) or Rojo (Pendiente) */}
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1 border ${
                      isPresentado
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        : 'bg-red-100 text-red-900 border-red-300'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${isPresentado ? 'bg-[#00A651]' : 'bg-red-600'}`} />
                    <span>{isPresentado ? 'VERDE: PRESENTADO' : 'ROJO: PENDIENTE'}</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-700">
                  <p>
                    Plan Modular:{' '}
                    <strong className={ctrl?.tiene_plan_modular ? 'text-[#00A651]' : 'text-red-600'}>
                      {ctrl?.tiene_plan_modular ? `Sí (${ctrl.formato_plan_modular || 'Digital'})` : 'No'}
                    </strong>
                  </p>
                  <p>
                    Planificación Curricular:{' '}
                    <strong className={ctrl?.tiene_planificacion_curricular ? 'text-[#00A651]' : 'text-red-600'}>
                      {ctrl?.tiene_planificacion_curricular ? 'Sí' : 'No'}
                    </strong>
                  </p>
                </div>

                <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 text-[10px] text-slate-500">
                  <span>
                    Fecha de Revisión: <strong className="text-slate-800">{ctrl?.fecha_revision || 'Sin registrar'}</strong>
                  </span>
                  <button
                    onClick={() => setEditingControlDocente(doc)}
                    className="px-2.5 py-1 bg-white hover:bg-[#00A651] text-slate-800 hover:text-white border border-slate-300 rounded-lg font-extrabold flex items-center gap-1 transition-all"
                  >
                    <Edit className="w-3 h-3 text-[#00A651]" />
                    <span>Registrar / Editar Documentos</span>
                  </button>
                </div>
                {ctrl?.observacion && (
                  <p className="text-[10px] text-slate-600 italic border-t border-slate-200/60 pt-1">
                    Obs: {ctrl.observacion}
                  </p>
                )}
              </div>

              <div className="pt-1 text-xs space-y-1 text-slate-600 font-medium">
                <p>Sede Habitual: <strong className="text-slate-900">{doc.sede_nombre || 'Sede Poroma'}</strong></p>
                <p>Horario: <strong className="text-slate-900">{doc.horario_nombre || 'Poroma Habitual (18:30)'}</strong></p>
                <p>Permiso de Publicación: <strong className={doc.puede_publicar ? 'text-[#00A651]' : 'text-slate-500'}>{doc.puede_publicar ? 'SI (Autorizado)' : 'NO (Solo lectura)'}</strong></p>
              </div>

              {/* Actions Toolbar */}
              {doc.rol !== 'superadmin' && (
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleToggleActivo(doc.id)}
                    className={`flex-1 h-10 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all ${
                      doc.activo
                        ? 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                        : 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    <Power className="w-4 h-4" />
                    <span>{doc.activo ? 'Desactivar Docente' : 'Activar Docente'}</span>
                  </button>

                  <button
                    onClick={() => handleTogglePublicar(doc.id)}
                    className="px-3 h-10 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-bold text-xs"
                    title="Permiso para publicar anuncios"
                  >
                    {doc.puede_publicar ? 'Quitar Publicar' : 'Permitir Publicar'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal 1: Ver Docente (Perfil y Asignaciones) */}
      {viewingTeacher && (
        <TeacherDetailModal
          docente={viewingTeacher}
          asignaciones={assignmentsMap[viewingTeacher.id] || []}
          controlDoc={controlMap[viewingTeacher.id]}
          onClose={() => setViewingTeacher(null)}
          onEditTeacher={() => {
            const t = viewingTeacher;
            setViewingTeacher(null);
            setEditingTeacher(t);
          }}
          onManageAssignments={() => {
            const t = viewingTeacher;
            setViewingTeacher(null);
            setManagingAssignmentsTeacher(t);
          }}
        />
      )}

      {/* Modal 2: Editar Docente */}
      {editingTeacher && (
        <EditTeacherModal
          docente={editingTeacher}
          onClose={() => setEditingTeacher(null)}
          onSaveSuccess={handleSaveTeacherSuccess}
        />
      )}

      {/* Modal 3: Gestionar Asignaciones Académicas */}
      {managingAssignmentsTeacher && (
        <TeacherAssignmentsModal
          docente={managingAssignmentsTeacher}
          currentUser={user}
          onClose={() => setManagingAssignmentsTeacher(null)}
          onAssignmentsUpdated={() => {
            fetchAssignments();
          }}
        />
      )}

      {/* Modal 4: Control Documental */}
      {editingControlDocente && (
        <EditControlDocumentalModal
          docente={editingControlDocente}
          currentControl={controlMap[editingControlDocente.id]}
          currentUser={user}
          onClose={() => setEditingControlDocente(null)}
          onSaveSuccess={handleControlSaveSuccess}
        />
      )}
    </div>
  );
};


