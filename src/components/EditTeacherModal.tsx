import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  UserCheck,
  Plus,
  Edit2,
  Power,
  Clock,
  MapPin,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Layers,
  ChevronDown
} from 'lucide-react';
import { Perfil, Sede, Horario, DocenteHorario } from '../types';
import { INITIAL_SEDES, INITIAL_HORARIOS } from '../lib/mockData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { loadDocentesHorarios, saveLocalDocentesHorarios, getLocalDocentesHorarios } from '../lib/scheduleResolver';

const DIAS_OPCIONES = [
  { id: 'lunes', label: 'Lun' },
  { id: 'martes', label: 'Mar' },
  { id: 'miércoles', label: 'Mié' },
  { id: 'jueves', label: 'Jue' },
  { id: 'viernes', label: 'Vie' },
  { id: 'sábado', label: 'Sáb' },
  { id: 'domingo', label: 'Dom' },
];

interface EditTeacherModalProps {
  docente: Perfil;
  onClose: () => void;
  onSaveSuccess: (updatedTeacher: Perfil) => void;
}

export const EditTeacherModal: React.FC<EditTeacherModalProps> = ({
  docente,
  onClose,
  onSaveSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'perfil' | 'horarios'>('perfil');

  // Perfil form fields
  const [nombreCompleto, setNombreCompleto] = useState(docente.nombre_completo || '');
  const [cargoTitulo, setCargoTitulo] = useState(docente.nivel || docente.categoria || 'Docente');
  const [rda, setRda] = useState(docente.rda || '');
  const [especialidad, setEspecialidad] = useState(docente.especialidad || '');
  const [sedeId, setSedeId] = useState(docente.sede_id || '');
  const [materiasStr, setMateriasStr] = useState(
    Array.isArray(docente.materias) ? docente.materias.join(', ') : ''
  );
  const [horarioId, setHorarioId] = useState(docente.horario_id || '');
  const [activo, setActivo] = useState<boolean>(docente.activo ?? true);

  const [sedesList, setSedesList] = useState<Sede[]>([]);
  const [horariosList, setHorariosList] = useState<Horario[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Docentes Horarios Management state
  const [docenteHorarios, setDocenteHorarios] = useState<DocenteHorario[]>([]);
  const [loadingDH, setLoadingDH] = useState<boolean>(true);
  const [isAddingDH, setIsAddingDH] = useState<boolean>(false);
  const [editingDH, setEditingDH] = useState<DocenteHorario | null>(null);

  // Form for single docente_horario assignment
  const [dhFormSedeId, setDhFormSedeId] = useState<string>('');
  const [dhFormHorarioId, setDhFormHorarioId] = useState<string>('');
  const [dhFormDias, setDhFormDias] = useState<string[]>(['lunes', 'martes', 'miércoles', 'jueves', 'viernes']);
  const [dhFormActivo, setDhFormActivo] = useState<boolean>(true);
  const [dhErrorMsg, setDhErrorMsg] = useState<string | null>(null);
  const [isSavingDH, setIsSavingDH] = useState<boolean>(false);

  useEffect(() => {
    async function fetchCatalogsAndDH() {
      // 1. Catalogs
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: sData } = await supabase.from('sedes').select('*').order('nombre');
          if (sData && sData.length > 0) {
            setSedesList(sData);
          } else {
            setSedesList(INITIAL_SEDES);
          }

          const { data: hData } = await supabase.from('horarios').select('*').order('nombre');
          if (hData && hData.length > 0) {
            setHorariosList(hData);
          } else {
            setHorariosList(INITIAL_HORARIOS);
          }
        } catch (e) {
          console.error('Error cargando catálogos para docente:', e);
          setSedesList(INITIAL_SEDES);
          setHorariosList(INITIAL_HORARIOS);
        }
      } else {
        setSedesList(INITIAL_SEDES);
        setHorariosList(INITIAL_HORARIOS);
      }

      // 2. Load Docente Horarios
      setLoadingDH(true);
      try {
        const list = await loadDocentesHorarios(docente.id);
        setDocenteHorarios(list);
      } catch (e) {
        console.error('Error cargando docentes_horarios:', e);
      } finally {
        setLoadingDH(false);
      }
    }
    fetchCatalogsAndDH();
  }, [docente.id]);

  // Handle Perfil Form Submit
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreCompleto.trim()) {
      setErrorMsg('El nombre completo es obligatorio.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const selectedSede = sedesList.find(s => s.id === sedeId);
    const selectedHorario = horariosList.find(h => h.id === horarioId);

    const materiasArray = materiasStr
      .split(',')
      .map(m => m.trim())
      .filter(Boolean);

    const updated: Perfil = {
      ...docente,
      nombre_completo: nombreCompleto.trim(),
      nivel: cargoTitulo.trim(),
      rda: rda.trim(),
      especialidad: especialidad.trim(),
      sede_id: sedeId || undefined,
      sede_nombre: selectedSede ? selectedSede.nombre : docente.sede_nombre,
      materias: materiasArray,
      horario_id: horarioId || undefined,
      horario_nombre: selectedHorario ? selectedHorario.nombre : docente.horario_nombre,
      activo: activo,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('perfiles')
          .update({
            nombre_completo: updated.nombre_completo,
            nivel: updated.nivel,
            rda: updated.rda,
            especialidad: updated.especialidad,
            sede_id: updated.sede_id || null,
            materias: updated.materias,
            horario_id: updated.horario_id || null,
            activo: updated.activo,
            updated_at: updated.updated_at,
          })
          .eq('id', docente.id);

        if (error) {
          setErrorMsg('Error en Supabase: ' + error.message);
          setIsSaving(false);
          return;
        }
      } catch (err: any) {
        setErrorMsg('Excepción en Supabase: ' + (err.message || err));
        setIsSaving(false);
        return;
      }
    }

    setIsSaving(false);
    setSuccessMsg('Ficha de docente actualizada correctamente.');
    setTimeout(() => {
      onSaveSuccess(updated);
    }, 500);
  };

  // --- DOCENTES HORARIOS MANAGEMENT ---
  const handleOpenAddDH = () => {
    setEditingDH(null);
    setDhFormSedeId(sedeId || sedesList[0]?.id || '');
    setDhFormHorarioId('');
    setDhFormDias(['lunes', 'martes', 'miércoles', 'jueves', 'viernes']);
    setDhFormActivo(true);
    setDhErrorMsg(null);
    setIsAddingDH(true);
  };

  const handleOpenEditDH = (dh: DocenteHorario) => {
    setEditingDH(dh);
    setDhFormSedeId(dh.sede_id || '');
    setDhFormHorarioId(dh.horario_id || '');
    setDhFormDias(dh.dias_semana || []);
    setDhFormActivo(dh.activo !== false);
    setDhErrorMsg(null);
    setIsAddingDH(true);
  };

  const handleToggleDHDia = (diaId: string) => {
    if (dhFormDias.includes(diaId)) {
      if (dhFormDias.length === 1) {
        setDhErrorMsg('Debe seleccionar al menos un día aplicable.');
        return;
      }
      setDhFormDias(dhFormDias.filter(d => d !== diaId));
    } else {
      setDhFormDias([...dhFormDias, diaId]);
    }
  };

  const handleSaveDH = async (e: React.FormEvent) => {
    e.preventDefault();
    setDhErrorMsg(null);

    // 1. Validaciones
    if (!dhFormSedeId) {
      setDhErrorMsg('Debe seleccionar una sede institucional obligatoriamente.');
      return;
    }

    if (!dhFormHorarioId) {
      setDhErrorMsg('Debe seleccionar un horario institucional obligatoriamente.');
      return;
    }

    if (!dhFormDias || dhFormDias.length === 0) {
      setDhErrorMsg('Debe seleccionar al menos un día de la semana para este horario.');
      return;
    }

    // 2. Validación de NO DUPLICADO: No permitir horario duplicado mismo docente/mismo día
    const overlappingItem = docenteHorarios.find(dh => {
      if (editingDH && dh.id === editingDH.id) return false;
      if (!dh.activo) return false; // Solo checar activos
      const existingDias = (dh.dias_semana || []).map(d => d.toLowerCase());
      const hasConflict = dhFormDias.some(d => existingDias.includes(d.toLowerCase()));
      return hasConflict;
    });

    if (overlappingItem && dhFormActivo) {
      const conflictingDias = dhFormDias.filter(d =>
        (overlappingItem.dias_semana || []).map(x => x.toLowerCase()).includes(d.toLowerCase())
      );
      setDhErrorMsg(
        `Conflicto de días: El docente ya tiene un horario activo asignado para (${conflictingDias.join(', ')}) en ${overlappingItem.sede_nombre || 'otra sede'}. Desactive o ajuste los días del horario existente primero.`
      );
      return;
    }

    setIsSavingDH(true);

    const selectedSede = sedesList.find(s => s.id === dhFormSedeId);
    const selectedHorario = horariosList.find(h => h.id === dhFormHorarioId);

    const payload = {
      docente_id: docente.id,
      sede_id: dhFormSedeId,
      horario_id: dhFormHorarioId,
      dias_semana: dhFormDias,
      activo: dhFormActivo,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase) {
      try {
        if (editingDH) {
          const { error } = await supabase
            .from('docentes_horarios')
            .update(payload)
            .eq('id', editingDH.id);

          if (error) {
            console.error('Error al actualizar docente_horario en Supabase:', error);
            setDhErrorMsg('Error de base de datos: ' + error.message);
            setIsSavingDH(false);
            return;
          }
        } else {
          const { data, error } = await supabase
            .from('docentes_horarios')
            .insert({
              ...payload,
              created_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (error) {
            console.error('Error al crear docente_horario en Supabase:', error);
            setDhErrorMsg('Error de base de datos: ' + error.message);
            setIsSavingDH(false);
            return;
          }
        }
      } catch (err: any) {
        console.error('Excepción guardando docente_horario:', err);
      }
    }

    // Actualización reactiva local
    let updatedList: DocenteHorario[];
    if (editingDH) {
      updatedList = docenteHorarios.map(dh =>
        dh.id === editingDH.id
          ? {
              ...dh,
              ...payload,
              sede_nombre: selectedSede?.nombre,
              horario_nombre: selectedHorario?.nombre,
              hora_ingreso: selectedHorario?.hora_ingreso,
              tolerancia_hasta: selectedHorario?.tolerancia_hasta,
              hora_salida: selectedHorario?.hora_salida,
              es_invierno: selectedHorario?.es_invierno,
            }
          : dh
      );
    } else {
      const newDH: DocenteHorario = {
        id: `dh-${Date.now()}`,
        ...payload,
        created_at: new Date().toISOString(),
        sede_nombre: selectedSede?.nombre,
        horario_nombre: selectedHorario?.nombre,
        hora_ingreso: selectedHorario?.hora_ingreso,
        tolerancia_hasta: selectedHorario?.tolerancia_hasta,
        hora_salida: selectedHorario?.hora_salida,
        es_invierno: selectedHorario?.es_invierno,
      };
      updatedList = [...docenteHorarios, newDH];
    }

    setDocenteHorarios(updatedList);

    // Actualizar global localStorage
    const allLocal = getLocalDocentesHorarios().filter(dh => dh.docente_id !== docente.id);
    saveLocalDocentesHorarios([...allLocal, ...updatedList]);

    setIsSavingDH(false);
    setIsAddingDH(false);
    setEditingDH(null);
  };

  const handleToggleDHActive = async (dh: DocenteHorario) => {
    const nextActivo = !dh.activo;
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('docentes_horarios')
          .update({ activo: nextActivo, updated_at: new Date().toISOString() })
          .eq('id', dh.id);
      } catch (e) {
        console.warn('Error cambiando estado de docente_horario:', e);
      }
    }

    const updatedList = docenteHorarios.map(item =>
      item.id === dh.id ? { ...item, activo: nextActivo } : item
    );
    setDocenteHorarios(updatedList);

    const allLocal = getLocalDocentesHorarios().filter(item => item.docente_id !== docente.id);
    saveLocalDocentesHorarios([...allLocal, ...updatedList]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-auto max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 rounded-xl text-[#00A651]">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-[#17324D]">{docente.nombre_completo}</h3>
              <p className="text-xs text-slate-500 font-medium">Gestión de Perfil Institucional y Múltiples Horarios</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('perfil')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'perfil'
                ? 'bg-[#17324D] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Datos Personales & Ficha</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('horarios')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'horarios'
                ? 'bg-[#17324D] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4 text-[#FFC845]" />
            <span>Gestión de Horarios Asignados ({docenteHorarios.filter(h => h.activo).length})</span>
          </button>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#00A651]" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* TAB 1: PERFIL & DATOS BÁSICOS */}
        {activeTab === 'perfil' && (
          <form onSubmit={handleFormSubmit} className="space-y-4 text-xs font-bold">
            <div>
              <label className="block text-slate-700 uppercase mb-1">
                Nombre Completo *
              </label>
              <input
                type="text"
                value={nombreCompleto}
                onChange={(e) => setNombreCompleto(e.target.value)}
                placeholder="Ej. Lic. Juan Pérez Morales"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 focus:border-[#00A651] focus:ring-2 focus:ring-emerald-200 text-sm font-medium text-slate-900 outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 uppercase mb-1">
                  Cargo / Nivel
                </label>
                <input
                  type="text"
                  value={cargoTitulo}
                  onChange={(e) => setCargoTitulo(e.target.value)}
                  placeholder="Ej. Docente Secundaria, Técnico Medio"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 focus:border-[#00A651] text-sm font-medium text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 uppercase mb-1">
                  Número de RDA
                </label>
                <input
                  type="text"
                  value={rda}
                  onChange={(e) => setRda(e.target.value)}
                  placeholder="Ej. 102938"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 focus:border-[#00A651] text-sm font-medium text-slate-900 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 uppercase mb-1">
                Especialidad / Área
              </label>
              <input
                type="text"
                value={especialidad}
                onChange={(e) => setEspecialidad(e.target.value)}
                placeholder="Ej. Ciencias Sociales, Humanidades, Gastronomía"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 focus:border-[#00A651] text-sm font-medium text-slate-900 outline-none"
              />
            </div>

            {/* Sede y Horario de compatibilidad */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 uppercase mb-1 flex items-center justify-between">
                  <span>Sede Principal</span>
                  <span className="text-[10px] text-slate-400 font-normal">Compatibilidad</span>
                </label>
                <select
                  value={sedeId}
                  onChange={(e) => setSedeId(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 focus:border-[#00A651] text-xs font-medium text-slate-900 bg-white outline-none"
                >
                  <option value="">-- Sin Sede Específica --</option>
                  {sedesList.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 uppercase mb-1 flex items-center justify-between">
                  <span>Horario Base</span>
                  <span className="text-[10px] text-slate-400 font-normal">Fallback</span>
                </label>
                <select
                  value={horarioId}
                  onChange={(e) => setHorarioId(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 focus:border-[#00A651] text-xs font-medium text-slate-900 bg-white outline-none"
                >
                  <option value="">-- Sin Horario Específico --</option>
                  {horariosList.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.nombre} ({h.hora_ingreso} - {h.hora_salida})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 uppercase mb-1">
                Materias (separadas por coma)
              </label>
              <input
                type="text"
                value={materiasStr}
                onChange={(e) => setMateriasStr(e.target.value)}
                placeholder="Ej. Lenguaje, Ciencias Sociales, Computación"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 focus:border-[#00A651] text-sm font-medium text-slate-900 outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 uppercase mb-1">
                Estado de la Cuenta
              </label>
              <select
                value={activo ? 'activo' : 'inactivo'}
                onChange={(e) => setActivo(e.target.value === 'activo')}
                className="w-full h-11 px-3 rounded-xl border border-slate-300 focus:border-[#00A651] text-xs font-bold text-slate-900 bg-white outline-none"
              >
                <option value="activo">Activo (Acceso habilitado)</option>
                <option value="inactivo">Inactivo (Acceso suspendido)</option>
              </select>
            </div>

            <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="h-11 px-5 rounded-xl text-slate-600 font-bold text-xs hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="h-11 px-6 bg-[#00A651] hover:bg-[#008f45] text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2"
              >
                <Save className="w-4 h-4 text-[#FFC845]" />
                <span>{isSaving ? 'Guardando...' : 'Guardar Datos del Perfil'}</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: GESTIÓN DE MÚLTIPLES HORARIOS ASIGNADOS (PASO 3) */}
        {activeTab === 'horarios' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-extrabold text-sm text-[#17324D]">
                  Horarios Asignados del Docente
                </h4>
                <p className="text-xs text-slate-500 font-medium">
                  Permite configurar turnos diferenciados por días de la semana y sedes (ej. Lunes a Jueves 16:30-21:00 y Viernes 06:00-08:30)
                </p>
              </div>

              {!isAddingDH && (
                <button
                  type="button"
                  onClick={handleOpenAddDH}
                  className="h-9 px-3 bg-[#00A651] hover:bg-[#008f45] text-white font-bold text-xs rounded-xl flex items-center gap-1 shadow-xs self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4 text-[#FFC845]" />
                  <span>+ Agregar Horario</span>
                </button>
              )}
            </div>

            {/* Sub-formulario Agregar / Editar Horario Asignado */}
            {isAddingDH && (
              <div className="p-4 bg-emerald-50/70 border-2 border-emerald-300 rounded-3xl space-y-3.5 animate-fade-in">
                <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                  <span className="font-extrabold text-xs text-[#17324D] flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#00A651]" />
                    <span>{editingDH ? 'Editar Horario Asignado' : 'Asignar Nuevo Horario al Docente'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => { setIsAddingDH(false); setEditingDH(null); }}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-emerald-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {dhErrorMsg && (
                  <div className="p-3 bg-red-100/80 border border-red-300 text-red-800 text-xs font-bold rounded-xl flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{dhErrorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleSaveDH} className="space-y-3 text-xs font-bold">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Sede */}
                    <div>
                      <label className="block text-slate-700 mb-1">Sede Educativa *</label>
                      <select
                        value={dhFormSedeId}
                        onChange={(e) => setDhFormSedeId(e.target.value)}
                        className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl outline-none font-medium text-slate-900"
                        required
                      >
                        <option value="">-- Seleccionar Sede --</option>
                        {sedesList.map(s => (
                          <option key={s.id} value={s.id}>{s.nombre}</option>
                        ))}
                      </select>
                    </div>

                    {/* Horario Institucional */}
                    <div>
                      <label className="block text-slate-700 mb-1">Horario Institucional *</label>
                      <select
                        value={dhFormHorarioId}
                        onChange={(e) => setDhFormHorarioId(e.target.value)}
                        className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl outline-none font-medium text-slate-900"
                        required
                      >
                        <option value="">-- Seleccionar Horario --</option>
                        {horariosList
                          .filter(h => !dhFormSedeId || h.sede_id === dhFormSedeId)
                          .map(h => (
                            <option key={h.id} value={h.id}>
                              {h.nombre} ({h.hora_ingreso} - {h.hora_salida}) {h.es_invierno ? '[Invierno]' : ''}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {/* Días aplicables */}
                  <div>
                    <label className="block text-slate-700 mb-1.5">Días Aplicables de la Semana *</label>
                    <div className="flex flex-wrap gap-1.5">
                      {DIAS_OPCIONES.map(dia => {
                        const isChecked = dhFormDias.includes(dia.id);
                        return (
                          <button
                            key={dia.id}
                            type="button"
                            onClick={() => handleToggleDHDia(dia.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all border ${
                              isChecked
                                ? 'bg-[#00A651] text-white border-[#00A651] shadow-xs'
                                : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                            }`}
                          >
                            {dia.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Estado activo/inactivo */}
                  <div>
                    <label className="block text-slate-700 mb-1">Estado de la Asignación</label>
                    <select
                      value={dhFormActivo ? 'activo' : 'inactivo'}
                      onChange={(e) => setDhFormActivo(e.target.value === 'activo')}
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl outline-none font-medium text-slate-900"
                    >
                      <option value="activo">Activo (Vigente para el control de asistencia)</option>
                      <option value="inactivo">Inactivo / Desactivado (Historial)</option>
                    </select>
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => { setIsAddingDH(false); setEditingDH(null); }}
                      className="h-10 px-4 bg-white text-slate-700 font-bold rounded-xl border border-slate-300"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingDH}
                      className="h-10 px-5 bg-[#00A651] hover:bg-[#008f45] text-white font-extrabold rounded-xl shadow-xs"
                    >
                      {isSavingDH ? 'Guardando...' : editingDH ? 'Actualizar Horario' : 'Asignar Horario'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* List of Docente Horarios */}
            {loadingDH ? (
              <div className="p-6 text-center text-xs font-bold text-slate-500 bg-slate-50 rounded-2xl border border-slate-200 animate-pulse">
                Cargando horarios asignados al docente...
              </div>
            ) : docenteHorarios.length === 0 ? (
              <div className="p-6 text-center text-xs font-medium text-slate-500 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <Clock className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="font-bold text-slate-700">No tiene horarios específicos asignados.</p>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  El docente utilizará el horario base de su perfil o de sus asignaciones de grupo. Pulse en <strong>+ Agregar Horario</strong> para definir turnos específicos.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {docenteHorarios.map(dh => {
                  const sNombre = dh.sede_nombre || sedesList.find(s => s.id === dh.sede_id)?.nombre || 'Sede no especificada';
                  const hObj = horariosList.find(h => h.id === dh.horario_id);
                  const hNombre = dh.horario_nombre || hObj?.nombre || 'Horario Institucional';
                  const hEntrada = dh.hora_ingreso || hObj?.hora_ingreso || '--:--';
                  const hSalida = dh.hora_salida || hObj?.hora_salida || '--:--';
                  const isInvierno = dh.es_invierno ?? hObj?.es_invierno;

                  return (
                    <div
                      key={dh.id}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        dh.activo
                          ? 'bg-white border-slate-200 shadow-xs'
                          : 'bg-slate-50 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-[#17324D]">
                            {sNombre}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            dh.activo
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-slate-200 text-slate-600 border-slate-300'
                          }`}>
                            {dh.activo ? 'Activo' : 'Desactivado'}
                          </span>
                          {isInvierno && (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-800 border border-blue-200 rounded-full">
                              Invierno
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                          <span className="font-bold text-[#00A651]">{hNombre}</span>
                          <span>•</span>
                          <span>Entrada: <strong>{hEntrada}</strong></span>
                          <span>•</span>
                          <span>Salida: <strong>{hSalida}</strong></span>
                        </div>

                        <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium flex-wrap">
                          <span className="font-bold text-slate-700">Días:</span>
                          {(dh.dias_semana || []).map(d => (
                            <span
                              key={d}
                              className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] capitalize font-semibold"
                            >
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEditDH(dh)}
                          className="h-8 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg flex items-center gap-1 transition-all"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-[#00A651]" />
                          <span>Editar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleDHActive(dh)}
                          className={`h-8 px-2.5 text-xs font-bold rounded-lg flex items-center gap-1 transition-all ${
                            dh.activo
                              ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                          title={dh.activo ? 'Desactivar asignación (mantiene historial)' : 'Activar asignación'}
                        >
                          <Power className="w-3.5 h-3.5" />
                          <span>{dh.activo ? 'Desactivar' : 'Activar'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
