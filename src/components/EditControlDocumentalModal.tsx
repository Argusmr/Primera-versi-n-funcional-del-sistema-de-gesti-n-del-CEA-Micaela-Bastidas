import React, { useState } from 'react';
import { FileCheck, X, CheckCircle2, AlertTriangle, Save, Calendar, FileText } from 'lucide-react';
import { ControlDocumental, FormatoPlanModular, Perfil } from '../types';
import { saveControlDocumental, calculateEstadoControl } from '../lib/controlDocumental';
import { getBoliviaTodayDate } from '../lib/geo';

interface EditControlDocumentalModalProps {
  docente: Perfil;
  currentControl?: ControlDocumental;
  currentUser: Perfil;
  onClose: () => void;
  onSaveSuccess: (updatedControl: ControlDocumental) => void;
}

export const EditControlDocumentalModal: React.FC<EditControlDocumentalModalProps> = ({
  docente,
  currentControl,
  currentUser,
  onClose,
  onSaveSuccess
}) => {
  const [tienePlanModular, setTienePlanModular] = useState<boolean>(
    currentControl?.tiene_plan_modular ?? false
  );
  const [formatoPlanModular, setFormatoPlanModular] = useState<FormatoPlanModular>(
    currentControl?.formato_plan_modular ?? 'Digital'
  );
  const [tienePlanificacionCurricular, setTienePlanificacionCurricular] = useState<boolean>(
    currentControl?.tiene_planificacion_curricular ?? false
  );
  const [fechaRevision, setFechaRevision] = useState<string>(
    currentControl?.fecha_revision || getBoliviaTodayDate()
  );
  const [observacion, setObservacion] = useState<string>(
    currentControl?.observacion || ''
  );

  const [saving, setSaving] = useState<boolean>(false);
  const [msg, setMsg] = useState<string | null>(null);

  const isDirectorOrAdmin = currentUser.rol === 'superadmin' || currentUser.rol === 'director' || currentUser.rol === 'coordinador';

  const estadoCalculado = calculateEstadoControl(tienePlanModular, tienePlanificacionCurricular);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDirectorOrAdmin) {
      setMsg('Únicamente el Director o Superadministrador puede modificar este registro.');
      return;
    }

    setSaving(true);
    try {
      const recordToSave: ControlDocumental = {
        id: currentControl?.id,
        docente_id: docente.id,
        tiene_plan_modular: tienePlanModular,
        formato_plan_modular: formatoPlanModular,
        tiene_planificacion_curricular: tienePlanificacionCurricular,
        fecha_revision: fechaRevision,
        observacion: observacion,
        estado: estadoCalculado
      };

      const saved = await saveControlDocumental(recordToSave, currentUser.id);
      onSaveSuccess(saved);
      onClose();
    } catch (err: any) {
      setMsg(err.message || 'Error al guardar el control documental.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-fade-in border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 text-[#00A651] rounded-xl">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#17324D]">Control Documental</h3>
              <p className="text-xs text-slate-500 font-medium">{docente.nombre_completo}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic Computed Status Banner */}
        <div
          className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
            estadoCalculado === 'presentado'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : 'bg-red-50 text-red-900 border-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {estadoCalculado === 'presentado' ? (
              <CheckCircle2 className="w-5 h-5 text-[#00A651]" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600" />
            )}
            <div>
              <span className="text-[10px] uppercase font-extrabold block tracking-wider opacity-80">
                Estado Actual del Documento
              </span>
              <strong className="text-sm font-extrabold">
                {estadoCalculado === 'presentado' ? 'VERDE: PRESENTADO' : 'ROJO: PENDIENTE'}
              </strong>
            </div>
          </div>

          <span
            className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
              estadoCalculado === 'presentado'
                ? 'bg-[#00A651] text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {estadoCalculado === 'presentado' ? 'Presentado' : 'Pendiente'}
          </span>
        </div>

        {msg && (
          <div className="p-3 bg-amber-50 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{msg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-bold">
          {/* 1. Tiene Plan Modular */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
            <label className="block text-slate-800 font-extrabold text-xs">
              1. ¿Tiene Plan Modular? *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTienePlanModular(true)}
                className={`h-10 rounded-xl border font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  tienePlanModular
                    ? 'bg-[#00A651] text-white border-[#00A651] shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Sí</span>
              </button>
              <button
                type="button"
                onClick={() => setTienePlanModular(false)}
                className={`h-10 rounded-xl border font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  !tienePlanModular
                    ? 'bg-red-600 text-white border-red-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                <X className="w-4 h-4" />
                <span>No</span>
              </button>
            </div>
          </div>

          {/* 2. Formato del Plan Modular */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
            <label className="block text-slate-800 font-extrabold text-xs">
              2. Formato del Plan Modular *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['Digital', 'Impreso', 'Ambos'] as FormatoPlanModular[]).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setFormatoPlanModular(fmt)}
                  className={`h-9 rounded-xl border font-extrabold text-xs transition-all ${
                    formatoPlanModular === fmt
                      ? 'bg-[#17324D] text-white border-[#17324D] shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Tiene Planificación Curricular */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
            <label className="block text-slate-800 font-extrabold text-xs">
              3. ¿Tiene Planificación Curricular? *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTienePlanificacionCurricular(true)}
                className={`h-10 rounded-xl border font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  tienePlanificacionCurricular
                    ? 'bg-[#00A651] text-white border-[#00A651] shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Sí</span>
              </button>
              <button
                type="button"
                onClick={() => setTienePlanificacionCurricular(false)}
                className={`h-10 rounded-xl border font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  !tienePlanificacionCurricular
                    ? 'bg-red-600 text-white border-red-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                <X className="w-4 h-4" />
                <span>No</span>
              </button>
            </div>
          </div>

          {/* 4. Fecha de Revisión */}
          <div>
            <label className="block text-slate-700 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Fecha de Revisión *</span>
            </label>
            <input
              type="date"
              value={fechaRevision}
              onChange={(e) => setFechaRevision(e.target.value)}
              className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-extrabold text-slate-900 focus:border-[#00A651]"
              required
            />
          </div>

          {/* 5. Observación Breve */}
          <div>
            <label className="block text-slate-700 mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Observación Breve</span>
            </label>
            <textarea
              rows={2}
              placeholder="Ej. Plan presentado en fecha. Pendiente firma de entregado..."
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium text-slate-900 focus:border-[#00A651] resize-none text-xs"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-4 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-11 px-5 bg-[#00A651] hover:bg-[#008f45] text-white font-extrabold rounded-xl shadow-xs flex items-center gap-1.5 text-xs transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-[#FFC845]" />
              <span>{saving ? 'Guardando...' : 'Guardar Estado'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
