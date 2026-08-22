import React, { useState } from 'react';
import { X, Save, UserCheck, Shield, CheckCircle2, AlertCircle } from 'lucide-react';
import { Perfil, Sede, Horario } from '../types';
import { INITIAL_SEDES, INITIAL_HORARIOS } from '../lib/mockData';
import { supabase, isSupabaseConfigured, checkIsOnline } from '../lib/supabase';

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

  React.useEffect(() => {
    async function fetchCatalogs() {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: sData } = await supabase.from('sedes').select('*').order('nombre');
          if (sData) setSedesList(sData);

          const { data: hData } = await supabase.from('horarios').select('*').order('nombre');
          if (hData) setHorariosList(hData);
        } catch (e) {
          console.error('Error cargando catálogos para docente:', e);
        }
      }
    }
    fetchCatalogs();
  }, []);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreCompleto.trim()) {
      setErrorMsg('El nombre completo es obligatorio.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

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
    onSaveSuccess(updated);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 rounded-xl text-[#00A651]">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-[#17324D]">Editar Ficha Docente</h3>
              <p className="text-xs text-slate-500 font-medium">Modifique la información asignada al docente</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-4">
          {/* 1. Nombre completo */}
          <div>
            <label className="block text-xs font-bold text-[#17324D] uppercase mb-1">
              Nombre Completo *
            </label>
            <input
              type="text"
              value={nombreCompleto}
              onChange={(e) => setNombreCompleto(e.target.value)}
              placeholder="Ej. Lic. Juan Pérez Morales"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 focus:border-[#00A651] focus:ring-2 focus:ring-emerald-200 text-sm font-medium outline-none"
              required
            />
          </div>

          {/* 2. Cargo o Título */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#17324D] uppercase mb-1">
                Cargo o Título
              </label>
              <input
                type="text"
                value={cargoTitulo}
                onChange={(e) => setCargoTitulo(e.target.value)}
                placeholder="Ej. Director General / Docente Secundario"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 focus:border-[#00A651] focus:ring-2 focus:ring-emerald-200 text-sm font-medium outline-none"
              />
            </div>

            {/* 3. RDA */}
            <div>
              <label className="block text-xs font-bold text-[#17324D] uppercase mb-1">
                RDA (Registro Docente)
              </label>
              <input
                type="text"
                value={rda}
                onChange={(e) => setRda(e.target.value)}
                placeholder="Ej. 102938"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 focus:border-[#00A651] focus:ring-2 focus:ring-emerald-200 text-sm font-medium outline-none"
              />
            </div>
          </div>

          {/* 4. Especialidad */}
          <div>
            <label className="block text-xs font-bold text-[#17324D] uppercase mb-1">
              Especialidad
            </label>
            <input
              type="text"
              value={especialidad}
              onChange={(e) => setEspecialidad(e.target.value)}
              placeholder="Ej. Ciencias Sociales, Humanidades, Sistemas"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 focus:border-[#00A651] focus:ring-2 focus:ring-emerald-200 text-sm font-medium outline-none"
            />
          </div>

          {/* 5. Sede & 7. Horario */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#17324D] uppercase mb-1">
                Sede Asignada
              </label>
              <select
                value={sedeId}
                onChange={(e) => setSedeId(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-300 focus:border-[#00A651] text-sm font-medium bg-white outline-none"
              >
                <option value="">-- Seleccionar Sede --</option>
                {sedesList.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#17324D] uppercase mb-1">
                Horario Asignado
              </label>
              <select
                value={horarioId}
                onChange={(e) => setHorarioId(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-300 focus:border-[#00A651] text-sm font-medium bg-white outline-none"
              >
                <option value="">-- Seleccionar Horario --</option>
                {horariosList.map(h => (
                  <option key={h.id} value={h.id}>
                    {h.nombre} ({h.hora_ingreso} - {h.hora_salida})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 6. Materias */}
          <div>
            <label className="block text-xs font-bold text-[#17324D] uppercase mb-1">
              Materias (separadas por coma)
            </label>
            <input
              type="text"
              value={materiasStr}
              onChange={(e) => setMateriasStr(e.target.value)}
              placeholder="Ej. Lenguaje, Ciencias Sociales, Computación"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 focus:border-[#00A651] focus:ring-2 focus:ring-emerald-200 text-sm font-medium outline-none"
            />
          </div>

          {/* 8. Estado activo o inactivo */}
          <div>
            <label className="block text-xs font-bold text-[#17324D] uppercase mb-1">
              Estado de la Cuenta
            </label>
            <select
              value={activo ? 'activo' : 'inactivo'}
              onChange={(e) => setActivo(e.target.value === 'activo')}
              className="w-full h-11 px-3 rounded-xl border border-slate-300 focus:border-[#00A651] text-sm font-bold bg-white outline-none"
            >
              <option value="activo">Activo (Acceso habilitado)</option>
              <option value="inactivo">Inactivo (Acceso suspendido)</option>
            </select>
          </div>

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-5 rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="h-11 px-6 bg-[#00A651] hover:bg-[#008f45] text-white font-bold text-sm rounded-xl shadow-md flex items-center gap-2"
            >
              <Save className="w-4 h-4 text-[#FFC845]" />
              <span>{isSaving ? 'Guardando...' : 'Guardar Cambios'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
