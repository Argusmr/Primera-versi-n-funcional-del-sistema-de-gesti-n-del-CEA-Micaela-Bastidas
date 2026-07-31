import React from 'react';
import { FileCheck, CheckCircle2, AlertTriangle, Calendar, Edit3, Check, X, FileText } from 'lucide-react';
import { ControlDocumental, Perfil } from '../types';

interface ControlDocumentalCardProps {
  control?: ControlDocumental;
  currentUser: Perfil;
  onOpenEdit?: () => void;
  showDocenteName?: boolean;
  docenteNombre?: string;
}

export const ControlDocumentalCard: React.FC<ControlDocumentalCardProps> = ({
  control,
  currentUser,
  onOpenEdit,
  showDocenteName = false,
  docenteNombre
}) => {
  const isDirectorOrAdmin =
    currentUser.rol === 'superadmin' ||
    currentUser.rol === 'director' ||
    currentUser.rol === 'coordinador';

  const tienePlanModular = control?.tiene_plan_modular ?? false;
  const tienePlanificacion = control?.tiene_planificacion_curricular ?? false;
  const isPresentado = tienePlanModular && tienePlanificacion;

  return (
    <div
      id="control-documental-card"
      className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3.5 transition-all"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-emerald-50 text-[#00A651] border border-emerald-100 rounded-2xl">
            <FileCheck className="w-5 h-5 text-[#00A651]" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-[#17324D]">Control documental</h3>
            {showDocenteName && docenteNombre && (
              <p className="text-xs text-slate-500 font-bold">{docenteNombre}</p>
            )}
            <p className="text-[11px] text-slate-400 font-medium">Verificación de Plan Modular y Planificación Curricular</p>
          </div>
        </div>

        {/* Status Badge: Verde (Presentado) or Rojo (Pendiente) */}
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-black uppercase flex items-center gap-1.5 border shadow-2xs ${
              isPresentado
                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                : 'bg-red-100 text-red-900 border-red-300'
            }`}
          >
            {isPresentado ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-[#00A651] inline-block animate-pulse" />
                <CheckCircle2 className="w-3.5 h-3.5 text-[#00A651]" />
                <span>Presentado</span>
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block animate-pulse" />
                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                <span>Pendiente</span>
              </>
            )}
          </span>

          {/* Edit Button ONLY for Director / Superadmin */}
          {isDirectorOrAdmin && onOpenEdit && (
            <button
              onClick={onOpenEdit}
              className="h-8 px-3 bg-slate-100 hover:bg-[#00A651] text-slate-700 hover:text-white rounded-xl font-bold text-xs flex items-center gap-1 transition-all border border-slate-200"
              title="Editar Control Documental"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editar</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid Status Items */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
        {/* Item 1: Plan Modular */}
        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase block tracking-wider">
            Plan Modular
          </span>
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-slate-800 flex items-center gap-1">
              {tienePlanModular ? (
                <Check className="w-4 h-4 text-[#00A651]" />
              ) : (
                <X className="w-4 h-4 text-red-600" />
              )}
              {tienePlanModular ? 'Sí presentado' : 'No presentado'}
            </span>
            <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md">
              Formato: {control?.formato_plan_modular || 'Digital'}
            </span>
          </div>
        </div>

        {/* Item 2: Planificación Curricular */}
        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase block tracking-wider">
            Planificación Curricular
          </span>
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-slate-800 flex items-center gap-1">
              {tienePlanificacion ? (
                <Check className="w-4 h-4 text-[#00A651]" />
              ) : (
                <X className="w-4 h-4 text-red-600" />
              )}
              {tienePlanificacion ? 'Sí presentada' : 'No presentada'}
            </span>
          </div>
        </div>
      </div>

      {/* Footer Info: Revision Date & Observaciones */}
      <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-medium text-slate-600">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Calendar className="w-3.5 h-3.5 text-[#00A651]" />
          <span>Fecha de Revisión: <strong className="text-slate-900 font-extrabold">{control?.fecha_revision || 'Pendiente de fecha'}</strong></span>
        </div>

        {control?.observacion && (
          <div className="flex items-center gap-1.5 text-slate-600">
            <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="italic truncate max-w-xs">{control.observacion}</span>
          </div>
        )}
      </div>
    </div>
  );
};
