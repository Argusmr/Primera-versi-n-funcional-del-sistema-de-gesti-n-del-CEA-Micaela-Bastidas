import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Layers,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  BookOpen,
  Calendar,
  Building2,
  FolderTree,
  AlertCircle,
  HelpCircle,
  Archive,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Perfil, AsignacionDocente, Sede, Grupo, CarreraTecnica, Etapa, NivelEducativo, Programa } from '../types';
import {
  loadAsignacionesForDocente,
  createAcademicAssignment,
  deactivateAcademicAssignment,
  updateAcademicAssignment,
  validateAcademicAssignment
} from '../lib/teacherAssignments';
import {
  loadProgramasFromSupabase,
  loadSubprogramasFromSupabase,
  loadCarrerasFromSupabase,
  loadEtapasFromSupabase,
  loadNivelesFromSupabase,
  INITIAL_ETAPAS,
  INITIAL_NIVELES
} from '../lib/academic';
import { getBoliviaTodayDate } from '../lib/geo';
import { INITIAL_SEDES, INITIAL_CARRERAS, INITIAL_GRUPOS } from '../lib/mockData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface TeacherAssignmentsModalProps {
  docente: Perfil;
  currentUser: Perfil;
  onClose: () => void;
  onAssignmentsUpdated?: () => void;
}

export const TeacherAssignmentsModal: React.FC<TeacherAssignmentsModalProps> = ({
  docente,
  currentUser,
  onClose,
  onAssignmentsUpdated
}) => {
  const [asignaciones, setAsignaciones] = useState<AsignacionDocente[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'actuales' | 'historial'>('actuales');

  // Catalogs
  const [sedesList, setSedesList] = useState<Sede[]>([]);
  const [carrerasList, setCarrerasList] = useState<CarreraTecnica[]>([]);
  const [etapasList, setEtapasList] = useState<Etapa[]>([]);
  const [nivelesList, setNivelesList] = useState<NivelEducativo[]>([]);
  const [gruposList, setGruposList] = useState<Grupo[]>([]);

  // UI state
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [editingAsignacion, setEditingAsignacion] = useState<AsignacionDocente | null>(null);
  const [deactivatingAsignacion, setDeactivatingAsignacion] = useState<AsignacionDocente | null>(null);

  // Deactivation modal state
  const [fechaFinDeact, setFechaFinDeact] = useState<string>(getBoliviaTodayDate());
  const [motivoPreset, setMotivoPreset] = useState<string>('Reasignación de carga horaria');
  const [motivoCustom, setMotivoCustom] = useState<string>('');
  const [isProcessingDeact, setIsProcessingDeact] = useState<boolean>(false);

  // Success / Error alerts
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State for New / Edit Assignment
  const [formPrograma, setFormPrograma] = useState<'EPJA' | 'ETA' | 'EDUPER' | 'CEE'>('ETA');
  const [formSubprograma, setFormSubprograma] = useState<'EPA' | 'ESA'>('EPA');
  const [formCarrera, setFormCarrera] = useState<string>('Sistemas Informáticos');
  const [formEtapa, setFormEtapa] = useState<string>('Aprendizajes Elementales');
  const [formNivel, setFormNivel] = useState<string>('Técnico Básico');
  const [formSedeId, setFormSedeId] = useState<string>(docente.sede_id || 'sede-1');
  const [formGrupoId, setFormGrupoId] = useState<string>('');
  const [formGrupoNombre, setFormGrupoNombre] = useState<string>('');
  const [formMateria, setFormMateria] = useState<string>('');
  const [formFechaInicio, setFormFechaInicio] = useState<string>('2026-07-27');
  const [formObservacion, setFormObservacion] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // 1. Load Assignments & Catalogs
  const fetchAllData = async () => {
    setLoading(true);
    try {
      // 1. Asignaciones del docente
      const asigs = await loadAsignacionesForDocente(docente.id);
      setAsignaciones(asigs);

      // 2. Catálogos académicos
      if (isSupabaseConfigured && supabase) {
        const [sedesRes, gruposRes, carrerasRes, etapasRes, nivelesRes] = await Promise.all([
          supabase.from('sedes').select('*').order('nombre'),
          supabase.from('grupos').select('*, sedes(nombre), programas(codigo, nombre)').order('nombre'),
          loadCarrerasFromSupabase(),
          loadEtapasFromSupabase(),
          loadNivelesFromSupabase()
        ]);

        if (sedesRes.data) setSedesList(sedesRes.data);
        if (gruposRes.data) {
          const mappedG: Grupo[] = gruposRes.data.map((g: any) => ({
            ...g,
            sede_nombre: g.sedes?.nombre,
            programa_nombre: g.programas?.nombre
          }));
          setGruposList(mappedG);
        }
        setCarrerasList(carrerasRes);
        setEtapasList(etapasRes);
        setNivelesList(nivelesRes);
      } else {
        setSedesList(INITIAL_SEDES);
        setGruposList(INITIAL_GRUPOS);
        setCarrerasList(INITIAL_CARRERAS);
        setEtapasList(INITIAL_ETAPAS);
        setNivelesList(INITIAL_NIVELES);
      }
    } catch (e) {
      console.error('Error cargando datos de asignaciones:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [docente.id]);

  // Active vs Inactive separation
  const activeAssignments = useMemo(
    () => asignaciones.filter(a => a.activo !== false && a.estado !== 'inactivo'),
    [asignaciones]
  );
  const inactiveAssignments = useMemo(
    () => asignaciones.filter(a => a.activo === false || a.estado === 'inactivo'),
    [asignaciones]
  );

  // Dynamic Options for Curricular Hierarchy
  const availableEtapas = useMemo(() => {
    if (formPrograma !== 'EPJA') return [];
    if (formSubprograma === 'EPA') {
      return ['Aprendizajes Elementales', 'Aprendizajes Avanzados'];
    }
    return ['Aprendizajes Aplicados', 'Aprendizajes Complementarios', 'Aprendizajes Especializados'];
  }, [formPrograma, formSubprograma]);

  const availableNivelesETA = ['Técnico Básico', 'Técnico Auxiliar', 'Técnico Medio'];

  // Automatically adjust etapa/nivel defaults when switching program/subprogram
  useEffect(() => {
    if (formPrograma === 'EPJA') {
      if (formSubprograma === 'EPA') {
        setFormEtapa('Aprendizajes Elementales');
        setFormNivel('Aprendizajes Elementales');
        setFormCarrera('Humanidades EPJA');
        if (!formMateria) setFormMateria('Comunicación y Lenguajes / Matemáticas');
      } else {
        setFormEtapa('Aprendizajes Aplicados');
        setFormNivel('Aprendizajes Aplicados');
        setFormCarrera('Humanidades EPJA');
        if (!formMateria) setFormMateria('Ciencias Sociales y Productivas');
      }
    } else if (formPrograma === 'ETA') {
      setFormNivel('Técnico Básico');
      if (carrerasList.length > 0 && !carrerasList.some(c => c.nombre === formCarrera)) {
        setFormCarrera(carrerasList[0].nombre);
      } else if (!formCarrera) {
        setFormCarrera('Sistemas Informáticos');
      }
      setFormEtapa('Formación Técnica');
      if (!formMateria) setFormMateria('Ofimática y Mantenimiento');
    } else if (formPrograma === 'EDUPER') {
      setFormCarrera('Educación Permanente');
      setFormEtapa('Taller Comunitario');
      setFormNivel('Proceso Formativo');
      if (!formMateria) setFormMateria('Corte y Confección / Artesanías');
    } else if (formPrograma === 'CEE') {
      setFormCarrera('Educación Especial');
      setFormEtapa('Atención Inclusiva');
      setFormNivel('Adaptación Curricular');
      if (!formMateria) setFormMateria('Desarrollo de Habilidades Integrales');
    }
  }, [formPrograma, formSubprograma]);

  // Sede selected object
  const selectedSedeObj = useMemo(() => {
    return sedesList.find(s => s.id === formSedeId) || sedesList[0];
  }, [sedesList, formSedeId]);

  // Filter groups matching sede & program
  const filteredGrupos = useMemo(() => {
    return gruposList.filter(g => {
      const matchSede = !formSedeId || g.sede_id === formSedeId;
      return matchSede && g.activo !== false;
    });
  }, [gruposList, formSedeId]);

  // Suggested group name generator
  const suggestedGroupName = useMemo(() => {
    const sedeName = selectedSedeObj ? selectedSedeObj.nombre.replace('Sede ', '') : 'Poroma';
    if (formPrograma === 'ETA') {
      const tag = formNivel === 'Técnico Básico' ? 'TB-1' : formNivel === 'Técnico Auxiliar' ? 'TA-1' : 'TM-1';
      return `${formCarrera} ${tag} (${sedeName})`;
    }
    if (formPrograma === 'EPJA') {
      return `${formSubprograma} - ${formEtapa} (${sedeName})`;
    }
    return `${formPrograma} - ${formCarrera} (${sedeName})`;
  }, [formPrograma, formSubprograma, formCarrera, formEtapa, formNivel, selectedSedeObj]);

  // Open Edit Assignment Form
  const handleOpenEdit = (asig: AsignacionDocente) => {
    setEditingAsignacion(asig);
    setFormPrograma((asig.programa_codigo as any) || 'ETA');
    setFormSubprograma((asig.subprograma_codigo as any) || 'EPA');
    setFormCarrera(asig.carrera_nombre || 'Sistemas Informáticos');
    setFormEtapa(asig.etapa_nombre || 'Aprendizajes Elementales');
    setFormNivel(asig.nivel_nombre || 'Técnico Básico');
    setFormSedeId(asig.sede_id || docente.sede_id || 'sede-1');
    setFormGrupoId(asig.grupo_id || '');
    setFormGrupoNombre(asig.grupo_nombre || '');
    setFormMateria(asig.materia || '');
    setFormFechaInicio(asig.fecha_inicio || '2026-07-27');
    setFormObservacion(asig.observacion || '');
    setIsAddingNew(false);
  };

  // Open New Assignment Form
  const handleOpenNew = () => {
    setEditingAsignacion(null);
    setFormPrograma('ETA');
    setFormCarrera('Sistemas Informáticos');
    setFormNivel('Técnico Básico');
    setFormSedeId(docente.sede_id || 'sede-1');
    setFormGrupoId('');
    setFormGrupoNombre('');
    setFormMateria('');
    setFormFechaInicio('2026-07-27');
    setFormObservacion('');
    setIsAddingNew(true);
  };

  // Handle Form Submit (Create or Update)
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertMsg(null);
    setIsSubmitting(true);

    try {
      // 1. Resolve or create Group if needed
      let targetGrupoId = formGrupoId;
      let finalGrupoNombre = formGrupoNombre;

      if (!targetGrupoId) {
        // Look for existing group with suggested name
        const match = gruposList.find(
          g => g.nombre.toLowerCase() === suggestedGroupName.toLowerCase() && g.sede_id === formSedeId
        );
        if (match) {
          targetGrupoId = match.id;
          finalGrupoNombre = match.nombre;
        } else if (isSupabaseConfigured && supabase) {
          // Create new grupo in Supabase
          const { data: newG, error: gErr } = await supabase
            .from('grupos')
            .insert([{
              nombre: suggestedGroupName,
              sede_id: formSedeId,
              carrera_especialidad: formCarrera,
              nivel: formNivel || formEtapa,
              activo: true
            }])
            .select()
            .single();

          if (!gErr && newG) {
            targetGrupoId = newG.id;
            finalGrupoNombre = newG.nombre;
          } else {
            targetGrupoId = `grp-${Date.now()}`;
            finalGrupoNombre = suggestedGroupName;
          }
        } else {
          targetGrupoId = `grp-${Date.now()}`;
          finalGrupoNombre = suggestedGroupName;
        }
      } else {
        const found = gruposList.find(g => g.id === targetGrupoId);
        if (found) finalGrupoNombre = found.nombre;
      }

      if (editingAsignacion) {
        // Update existing assignment
        const res = await updateAcademicAssignment(
          editingAsignacion.id,
          {
            materia: formMateria.trim(),
            carrera_nombre: formCarrera,
            nivel_nombre: formNivel,
            etapa_nombre: formEtapa,
            fecha_inicio: formFechaInicio,
            observacion: formObservacion.trim() || undefined
          },
          currentUser
        );

        if (!res.success) {
          setAlertMsg({ type: 'error', text: res.error || 'Error al actualizar asignación.' });
          setIsSubmitting(false);
          return;
        }

        setAlertMsg({ type: 'success', text: 'Asignación académica actualizada con éxito.' });
        setEditingAsignacion(null);
      } else {
        // Create new assignment
        const newAsigPayload: Omit<AsignacionDocente, 'id' | 'created_at'> = {
          docente_id: docente.id,
          docente_nombre: docente.nombre_completo,
          grupo_id: targetGrupoId,
          grupo_nombre: finalGrupoNombre,
          materia: formMateria.trim(),
          programa_codigo: formPrograma,
          subprograma_codigo: formPrograma === 'EPJA' ? formSubprograma : undefined,
          carrera_nombre: formCarrera,
          etapa_nombre: formEtapa,
          nivel_nombre: formNivel,
          sede_id: formSedeId,
          sede_nombre: selectedSedeObj ? selectedSedeObj.nombre : 'Sede Poroma',
          estado: 'activo',
          activo: true,
          fecha_inicio: formFechaInicio,
          gestion: 2026,
          observacion: formObservacion.trim() || undefined
        };

        const res = await createAcademicAssignment(newAsigPayload, currentUser);
        if (!res.success) {
          setAlertMsg({ type: 'error', text: res.error || 'Error al registrar la nueva asignación.' });
          setIsSubmitting(false);
          return;
        }

        setAlertMsg({ type: 'success', text: `Asignación creada correctamente para ${docente.nombre_completo}.` });
        setIsAddingNew(false);
      }

      await fetchAllData();
      if (onAssignmentsUpdated) onAssignmentsUpdated();
    } catch (err: any) {
      setAlertMsg({ type: 'error', text: err.message || 'Error inesperado al guardar la asignación.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Deactivate Confirm
  const handleConfirmDeactivation = async () => {
    if (!deactivatingAsignacion) return;
    setIsProcessingDeact(true);

    const fullMotivo = motivoCustom.trim() ? `${motivoPreset}: ${motivoCustom.trim()}` : motivoPreset;

    const res = await deactivateAcademicAssignment(
      deactivatingAsignacion.id,
      fechaFinDeact,
      fullMotivo,
      currentUser
    );

    setIsProcessingDeact(false);
    setDeactivatingAsignacion(null);

    if (res.success) {
      setAlertMsg({
        type: 'success',
        text: 'La asignación ha sido desactivada y guardada en el historial institucional.'
      });
      await fetchAllData();
      if (onAssignmentsUpdated) onAssignmentsUpdated();
    } else {
      setAlertMsg({
        type: 'error',
        text: res.error || 'Error al desactivar la asignación.'
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-auto max-h-[92vh] flex flex-col">
        {/* Header with Teacher Details */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-[#00A651] rounded-2xl shadow-xs">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-lg text-[#17324D]">{docente.nombre_completo}</h3>
                <span className="bg-emerald-100 text-emerald-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                  Gestión Curricular
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                RDA: <strong className="text-slate-800">{docente.rda || 'N/D'}</strong> • CI: <strong className="text-slate-800">{docente.ci || 'N/D'}</strong> • Sede: <strong className="text-slate-800">{docente.sede_nombre || 'Poroma'}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notifications */}
        {alertMsg && (
          <div
            className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 shrink-0 ${
              alertMsg.type === 'success'
                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                : 'bg-rose-100 text-rose-900 border border-rose-300'
            }`}
          >
            {alertMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#00A651] shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="flex-1">{alertMsg.text}</span>
            <button
              onClick={() => setAlertMsg(null)}
              className="text-xs opacity-70 hover:opacity-100 p-0.5"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tabs & New Assignment Button */}
        {!isAddingNew && !editingAsignacion && (
          <div className="flex items-center justify-between gap-2 shrink-0">
            <div className="flex bg-slate-100 p-1 rounded-2xl text-xs font-extrabold">
              <button
                type="button"
                onClick={() => setActiveTab('actuales')}
                className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                  activeTab === 'actuales'
                    ? 'bg-white text-[#17324D] shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>Asignaciones Actuales</span>
                <span className="bg-[#00A651] text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {activeAssignments.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('historial')}
                className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                  activeTab === 'historial'
                    ? 'bg-white text-[#17324D] shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Historial</span>
                <span className="bg-slate-300 text-slate-700 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {inactiveAssignments.length}
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleOpenNew}
              className="h-9 px-3.5 bg-[#00A651] hover:bg-[#008f45] text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4 text-[#FFC845]" />
              <span>+ Nueva Asignación</span>
            </button>
          </div>
        )}

        {/* Modal Main Scrollable Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* 1. FORM FOR NEW OR EDIT ASSIGNMENT */}
          {(isAddingNew || editingAsignacion) && (
            <div className="p-4 bg-slate-50 rounded-3xl border border-slate-200 space-y-3.5 animate-fade-in text-xs font-bold">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#00A651]" />
                  <h4 className="font-black text-sm text-[#17324D]">
                    {editingAsignacion ? 'Editar Asignación Académica' : 'Nueva Asignación Curricular'}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNew(false);
                    setEditingAsignacion(null);
                  }}
                  className="text-slate-400 hover:text-slate-700 text-xs flex items-center gap-1 font-bold"
                >
                  <X className="w-4 h-4" />
                  <span>Cancelar</span>
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-3">
                {/* 1. Programa Selector */}
                <div>
                  <label className="block text-slate-700 uppercase text-[10px] tracking-wide mb-1">
                    1. Programa Oficial de Educación Alternativa *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {[
                      { id: 'ETA', label: 'ETA – Técnica', color: 'emerald' },
                      { id: 'EPJA', label: 'EPJA – Humanística', color: 'blue' },
                      { id: 'EDUPER', label: 'EDUPER – Permanente', color: 'amber' },
                      { id: 'CEE', label: 'CEE – Especial', color: 'purple' }
                    ].map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setFormPrograma(p.id as any)}
                        className={`h-9 px-2 rounded-xl text-xs font-black border transition-all ${
                          formPrograma === p.id
                            ? 'bg-[#17324D] text-white border-[#17324D] shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Subprograma (EPJA) o Carrera (ETA) */}
                {formPrograma === 'EPJA' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-blue-50/70 rounded-2xl border border-blue-200">
                    <div>
                      <label className="block text-blue-900 text-[10px] uppercase mb-1">
                        Subprograma EPJA *
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFormSubprograma('EPA')}
                          className={`flex-1 h-9 rounded-xl font-black text-xs border ${
                            formSubprograma === 'EPA'
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-blue-900 border-blue-200'
                          }`}
                        >
                          EPA (Primaria)
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormSubprograma('ESA')}
                          className={`flex-1 h-9 rounded-xl font-black text-xs border ${
                            formSubprograma === 'ESA'
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-blue-900 border-blue-200'
                          }`}
                        >
                          ESA (Secundaria)
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-blue-900 text-[10px] uppercase mb-1">
                        Etapa de Aprendizaje ({formSubprograma}) *
                      </label>
                      <select
                        value={formEtapa}
                        onChange={e => {
                          setFormEtapa(e.target.value);
                          setFormNivel(e.target.value);
                        }}
                        className="w-full h-9 px-2.5 bg-white border border-blue-200 rounded-xl outline-none font-bold text-slate-900 text-xs"
                      >
                        {availableEtapas.map(et => (
                          <option key={et} value={et}>{et}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {formPrograma === 'ETA' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-emerald-50/70 rounded-2xl border border-emerald-200">
                    <div>
                      <label className="block text-emerald-900 text-[10px] uppercase mb-1">
                        Carrera Técnica (ETA) *
                      </label>
                      <select
                        value={formCarrera}
                        onChange={e => setFormCarrera(e.target.value)}
                        className="w-full h-9 px-2.5 bg-white border border-emerald-200 rounded-xl outline-none font-bold text-slate-900 text-xs"
                      >
                        {carrerasList.map(c => (
                          <option key={c.id} value={c.nombre}>{c.nombre}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-emerald-900 text-[10px] uppercase mb-1">
                        Nivel de Certificación Técnica *
                      </label>
                      <select
                        value={formNivel}
                        onChange={e => setFormNivel(e.target.value)}
                        className="w-full h-9 px-2.5 bg-white border border-emerald-200 rounded-xl outline-none font-bold text-slate-900 text-xs"
                      >
                        {availableNivelesETA.map(niv => (
                          <option key={niv} value={niv}>{niv}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* 3. Sede & Grupo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 uppercase text-[10px] mb-1">
                      Sede Institucional *
                    </label>
                    <select
                      value={formSedeId}
                      onChange={e => setFormSedeId(e.target.value)}
                      className="w-full h-10 px-2.5 bg-white border border-slate-300 rounded-xl outline-none font-bold text-slate-900 text-xs"
                    >
                      {sedesList.map(s => (
                        <option key={s.id} value={s.id}>{s.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 uppercase text-[10px] mb-1">
                      Grupo / Paralelo
                    </label>
                    <select
                      value={formGrupoId}
                      onChange={e => {
                        setFormGrupoId(e.target.value);
                        const sel = gruposList.find(g => g.id === e.target.value);
                        if (sel) setFormGrupoNombre(sel.nombre);
                      }}
                      className="w-full h-10 px-2.5 bg-white border border-slate-300 rounded-xl outline-none font-bold text-slate-900 text-xs"
                    >
                      <option value="">(Crear / Usar: {suggestedGroupName})</option>
                      {filteredGrupos.map(g => (
                        <option key={g.id} value={g.id}>{g.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 4. Materia / Módulo Formativo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 uppercase text-[10px] mb-1">
                      Materia / Módulo Pedagógico *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Ofimática, Gastronomía Básica..."
                      value={formMateria}
                      onChange={e => setFormMateria(e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl outline-none font-bold text-slate-900 text-xs focus:border-[#00A651]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 uppercase text-[10px] mb-1">
                      Fecha de Inicio de Asignación *
                    </label>
                    <input
                      type="date"
                      value={formFechaInicio}
                      onChange={e => setFormFechaInicio(e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl outline-none font-bold text-slate-900 text-xs"
                      required
                    />
                  </div>
                </div>

                {/* 5. Observación */}
                <div>
                  <label className="block text-slate-700 uppercase text-[10px] mb-1">
                    Observación / Justificación Institucional (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Asignación regular Segundo Semestre 2026..."
                    value={formObservacion}
                    onChange={e => setFormObservacion(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl outline-none font-medium text-slate-900 text-xs"
                  />
                </div>

                {/* Submit buttons */}
                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingNew(false);
                      setEditingAsignacion(null);
                    }}
                    className="h-10 px-4 bg-slate-200 text-slate-700 font-bold rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-10 px-5 bg-[#00A651] hover:bg-[#008f45] text-white font-extrabold rounded-xl shadow-xs flex items-center gap-1.5"
                  >
                    {isSubmitting ? (
                      <span>Guardando...</span>
                    ) : (
                      <>
                        <Check className="w-4 h-4 text-[#FFC845]" />
                        <span>{editingAsignacion ? 'Guardar Cambios' : 'Registrar Asignación'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 2. TAB: ASIGNACIONES ACTUALES */}
          {!isAddingNew && !editingAsignacion && activeTab === 'actuales' && (
            <div className="space-y-3">
              {activeAssignments.length === 0 ? (
                <div className="p-8 bg-slate-50 border border-slate-200 rounded-3xl text-center space-y-2">
                  <Layers className="w-8 h-8 text-slate-400 mx-auto" />
                  <h4 className="font-extrabold text-sm text-[#17324D]">Sin asignaciones activas</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
                    El docente no tiene materias o grupos asignados en este momento. Utilice el botón "+ Nueva Asignación" para asignarle carga horaria.
                  </p>
                  <button
                    onClick={handleOpenNew}
                    className="mt-2 h-9 px-4 bg-[#00A651] text-white font-bold text-xs rounded-xl inline-flex items-center gap-1 shadow-xs"
                  >
                    <Plus className="w-4 h-4 text-[#FFC845]" />
                    <span>Asignar Carga Académica</span>
                  </button>
                </div>
              ) : (
                activeAssignments.map(asig => {
                  const isEta = asig.programa_codigo === 'ETA';
                  const isEpja = asig.programa_codigo === 'EPJA';

                  return (
                    <div
                      key={asig.id}
                      className="p-4 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-2.5 transition-all hover:border-slate-300"
                    >
                      {/* Top badges */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              isEta
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : isEpja
                                ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                : 'bg-amber-100 text-amber-900 border border-amber-300'
                            }`}
                          >
                            {asig.programa_codigo || 'EPJA'}
                            {asig.subprograma_codigo ? ` • ${asig.subprograma_codigo}` : ''}
                          </span>

                          <strong className="text-slate-900 font-extrabold text-xs">
                            {asig.carrera_nombre || asig.etapa_nombre}
                          </strong>
                        </div>

                        <span className="bg-emerald-50 text-[#00A651] border border-emerald-200 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#00A651]" />
                          Activo
                        </span>
                      </div>

                      {/* Content details */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="space-y-0.5">
                          <span className="text-[10px] text-slate-500 font-bold block uppercase">
                            Materia / Módulo:
                          </span>
                          <strong className="text-sm font-black text-[#17324D]">
                            {asig.materia}
                          </strong>
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[10px] text-slate-500 font-bold block uppercase">
                            Nivel / Etapa:
                          </span>
                          <strong className="text-xs font-extrabold text-slate-800">
                            {asig.nivel_nombre || asig.etapa_nombre || 'Nivel General'}
                          </strong>
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[10px] text-slate-500 font-bold block uppercase">
                            Grupo / Paralelo:
                          </span>
                          <p className="text-xs font-bold text-slate-700">
                            {asig.grupo_nombre || 'Sin grupo'}
                          </p>
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[10px] text-slate-500 font-bold block uppercase">
                            Sede & Fecha Inicio:
                          </span>
                          <p className="text-xs font-medium text-slate-600">
                            <span className="font-bold text-slate-800">{asig.sede_nombre || 'Poroma'}</span> • Desde {asig.fecha_inicio || '2026-07-27'}
                          </p>
                        </div>
                      </div>

                      {asig.observacion && (
                        <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-xl border border-slate-100">
                          Obs: {asig.observacion}
                        </p>
                      )}

                      {/* Action buttons */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(asig)}
                          className="h-8 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1 transition-all"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                          <span>Editar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setDeactivatingAsignacion(asig);
                            setFechaFinDeact(getBoliviaTodayDate());
                            setMotivoPreset('Reasignación de carga horaria');
                            setMotivoCustom('');
                          }}
                          className="h-8 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold text-xs flex items-center gap-1 transition-all"
                          title="Desactivar y mover a historial"
                        >
                          <X className="w-3.5 h-3.5 text-rose-600" />
                          <span>Desactivar asignación</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* 3. TAB: HISTORIAL DE ASIGNACIONES (INACTIVAS) */}
          {!isAddingNew && !editingAsignacion && activeTab === 'historial' && (
            <div className="space-y-3">
              {inactiveAssignments.length === 0 ? (
                <div className="p-8 bg-slate-50 border border-slate-200 rounded-3xl text-center space-y-1">
                  <Archive className="w-7 h-7 text-slate-400 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">Sin historial de reasignaciones</p>
                  <p className="text-[11px] text-slate-500">
                    Las asignaciones que sean desactivadas o cambiadas quedarán registradas aquí para fines de auditoría.
                  </p>
                </div>
              ) : (
                inactiveAssignments.map(asig => (
                  <div
                    key={asig.id}
                    className="p-4 bg-slate-50/80 rounded-3xl border border-slate-200 space-y-2 text-xs opacity-90"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-200 text-slate-700 uppercase">
                          {asig.programa_codigo}
                        </span>
                        <strong className="text-slate-800 font-extrabold">
                          {asig.carrera_nombre || asig.etapa_nombre} • {asig.nivel_nombre || asig.etapa_nombre}
                        </strong>
                      </div>
                      <span className="bg-slate-200 text-slate-600 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                        Inactivo / Histórico
                      </span>
                    </div>

                    <p className="text-xs text-slate-800 font-bold">
                      Materia: <span className="text-[#17324D]">{asig.materia}</span> ({asig.grupo_nombre || 'Sin grupo'})
                    </p>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-white p-2.5 rounded-2xl border border-slate-200">
                      <p>
                        Periodo:{' '}
                        <strong className="text-slate-900">
                          {asig.fecha_inicio || '2026-02-01'} → {asig.fecha_fin || 'Concluido'}
                        </strong>
                      </p>
                      <p>
                        Sede: <strong className="text-slate-900">{asig.sede_nombre || 'Poroma'}</strong>
                      </p>
                    </div>

                    {asig.motivo_cambio && (
                      <p className="text-[11px] text-amber-900 bg-amber-50 p-2 rounded-xl border border-amber-200 font-medium">
                        <strong>Motivo de Desactivación:</strong> {asig.motivo_cambio}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* 4. MODAL / DIALOG DE DESACTIVACIÓN SEGURA */}
        {deactivatingAsignacion && (
          <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-fade-in text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-base text-[#17324D]">Desactivar Asignación</h4>
                    <p className="text-[11px] text-slate-500 font-medium">Registro para auditoría institucional</p>
                  </div>
                </div>
                <button
                  onClick={() => setDeactivatingAsignacion(null)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-900 space-y-1 font-medium">
                <p>
                  <strong>Docente:</strong> {docente.nombre_completo}
                </p>
                <p>
                  <strong>Materia:</strong> {deactivatingAsignacion.materia} ({deactivatingAsignacion.grupo_nombre})
                </p>
                <p className="text-amber-800 text-[10px] pt-1 border-t border-amber-200">
                  ℹ️ Esta acción <strong>NO elimina físicamente</strong> el registro; cambiará su estado a <em>Inactivo</em> y lo archivará en el historial.
                </p>
              </div>

              <div className="space-y-3 font-bold text-slate-700">
                <div>
                  <label className="block uppercase text-[10px] mb-1">Fecha de Conclusión / Cese *</label>
                  <input
                    type="date"
                    value={fechaFinDeact}
                    onChange={e => setFechaFinDeact(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-bold text-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block uppercase text-[10px] mb-1">Motivo Institucional del Cambio *</label>
                  <select
                    value={motivoPreset}
                    onChange={e => setMotivoPreset(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-bold text-slate-900 mb-1.5"
                  >
                    <option value="Reasignación de carga horaria">Reasignación de carga horaria</option>
                    <option value="Cambio de grupo o paralelo">Cambio de grupo o paralelo</option>
                    <option value="Culminación de semestre o módulo formativo">Culminación de semestre o módulo formativo</option>
                    <option value="Licencia temporal o suplencia concluida">Licencia temporal o suplencia concluida</option>
                    <option value="Ajuste curricular institucional">Ajuste curricular institucional</option>
                    <option value="Otro motivo justificado">Otro motivo justificado</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Detalles adicionales del motivo..."
                    value={motivoCustom}
                    onChange={e => setMotivoCustom(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium text-slate-900"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeactivatingAsignacion(null)}
                  className="h-10 px-4 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isProcessingDeact}
                  onClick={handleConfirmDeactivation}
                  className="h-10 px-5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  {isProcessingDeact ? 'Procesando...' : 'Confirmar Desactivación'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
