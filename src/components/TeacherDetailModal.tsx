import React from 'react';
import { X, UserCheck, Shield, BookOpen, Calendar, MapPin, Clock, FileCheck, CheckCircle2, AlertCircle, Layers, ArrowRight, Edit } from 'lucide-react';
import { Perfil, AsignacionDocente, ControlDocumental } from '../types';

interface TeacherDetailModalProps {
  docente: Perfil;
  asignaciones: AsignacionDocente[];
  controlDoc?: ControlDocumental;
  onClose: () => void;
  onEditTeacher: () => void;
  onManageAssignments: () => void;
}

export const TeacherDetailModal: React.FC<TeacherDetailModalProps> = ({
  docente,
  asignaciones,
  controlDoc,
  onClose,
  onEditTeacher,
  onManageAssignments,
}) => {
  const activeAssignments = asignaciones.filter(a => a.activo !== false && a.estado !== 'inactivo');
  const inactiveAssignments = asignaciones.filter(a => a.activo === false || a.estado === 'inactivo');

  const isControlPresentado = controlDoc?.tiene_plan_modular && controlDoc?.tiene_planificacion_curricular;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-auto max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-[#00A651] flex items-center justify-center font-extrabold text-lg shadow-xs">
              {docente.nombre_completo.charAt(0)}
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-[#17324D] leading-tight">
                {docente.nombre_completo}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                RDA: <span className="font-bold text-slate-800">{docente.rda || 'N/D'}</span> • CI: <span className="font-bold text-slate-800">{docente.ci || 'N/D'}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status and Role Badges */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span
            className={`px-3 py-1 rounded-full font-bold uppercase text-[10px] ${
              docente.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {docente.activo ? 'Docente Activo' : 'Docente Inactivo'}
          </span>

          {docente.rol === 'superadmin' ? (
            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
              <Shield className="w-3 h-3 text-amber-700" />
              Director / Superadmin
            </span>
          ) : (
            <span className="bg-slate-100 text-slate-800 text-[10px] font-bold px-2.5 py-1 rounded-full">
              Personal Docente
            </span>
          )}

          <span className="bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold px-2.5 py-1 rounded-full">
            {docente.especialidad || 'Especialidad General'}
          </span>
        </div>

        {/* Administrative & Location Details */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5 text-xs">
          <h4 className="font-extrabold text-[#17324D] uppercase text-[11px] tracking-wide border-b border-slate-200 pb-1">
            Datos Administrativos y Asignación Institucional
          </h4>

          <div className="grid grid-cols-2 gap-3 text-slate-700">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Sede Asignada</span>
              <strong className="text-slate-900 font-extrabold flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-[#00A651]" />
                {docente.sede_nombre || 'Sede Poroma'}
              </strong>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Horario Laboral</span>
              <strong className="text-slate-900 font-extrabold flex items-center gap-1 mt-0.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                {docente.horario_nombre || 'Poroma Habitual (18:30)'}
              </strong>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Categoría / Escalafón</span>
              <strong className="text-slate-900 font-extrabold">{docente.categoria || docente.nivel || 'Docente'}</strong>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Permiso de Publicación</span>
              <strong className={docente.puede_publicar ? 'text-[#00A651] font-extrabold' : 'text-slate-500 font-extrabold'}>
                {docente.puede_publicar ? 'Autorizado (Comunicados)' : 'Solo Lectura'}
              </strong>
            </div>
          </div>
        </div>

        {/* Control Documental Summary */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-[#17324D] uppercase text-[11px] tracking-wide flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-[#00A651]" />
              Control Documental Pedagógico
            </h4>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                isControlPresentado
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                  : 'bg-red-100 text-red-900 border-red-300'
              }`}
            >
              {isControlPresentado ? 'VERDE: PRESENTADO' : 'ROJO: PENDIENTE'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <p>
              Plan Modular:{' '}
              <strong className={controlDoc?.tiene_plan_modular ? 'text-[#00A651]' : 'text-red-600'}>
                {controlDoc?.tiene_plan_modular ? `Presentado (${controlDoc.formato_plan_modular || 'Digital'})` : 'Pendiente'}
              </strong>
            </p>
            <p>
              Planificación Curricular:{' '}
              <strong className={controlDoc?.tiene_planificacion_curricular ? 'text-[#00A651]' : 'text-red-600'}>
                {controlDoc?.tiene_planificacion_curricular ? 'Presentado' : 'Pendiente'}
              </strong>
            </p>
          </div>
        </div>

        {/* Asignaciones Académicas Vigentes */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-xs text-[#17324D] uppercase flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#00A651]" />
              Asignaciones Académicas Actuales ({activeAssignments.length})
            </h4>
            <button
              onClick={onManageAssignments}
              className="text-[11px] font-bold text-[#00A651] hover:underline flex items-center gap-0.5"
            >
              <span>Gestionar</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {activeAssignments.length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-center space-y-1">
              <AlertCircle className="w-5 h-5 text-amber-600 mx-auto" />
              <p className="text-xs font-bold text-amber-900">Sin asignaciones académicas vigentes</p>
              <p className="text-[11px] text-amber-700">Utilice el botón inferior para asignar grupos y materias.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {activeAssignments.map(asig => (
                <div
                  key={asig.id}
                  className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          asig.programa_codigo === 'ETA'
                            ? 'bg-emerald-100 text-emerald-800'
                            : asig.programa_codigo === 'EPJA'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {asig.programa_codigo || 'EPJA'}
                        {asig.subprograma_codigo ? ` • ${asig.subprograma_codigo}` : ''}
                      </span>
                      <strong className="text-slate-900 font-extrabold text-[11px]">
                        {asig.carrera_nombre || asig.etapa_nombre || 'Formación General'}
                      </strong>
                    </div>
                    <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {asig.nivel_nombre || asig.etapa_nombre || 'Nivel General'}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-800 font-bold">
                    Materia: <span className="text-[#00A651]">{asig.materia}</span>
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Grupo: {asig.grupo_nombre || 'Sin grupo'} • Sede: {asig.sede_nombre || 'Poroma'}
                  </p>
                </div>
              ))}
            </div>
          )}

          {inactiveAssignments.length > 0 && (
            <p className="text-[10px] text-slate-500 font-medium text-right">
              + {inactiveAssignments.length} asignación(es) en historial
            </p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onEditTeacher}
            className="flex-1 h-11 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all"
          >
            <Edit className="w-4 h-4 text-slate-600" />
            <span>Editar Ficha</span>
          </button>

          <button
            type="button"
            onClick={onManageAssignments}
            className="flex-1 h-11 px-4 bg-[#00A651] hover:bg-[#008f45] text-white rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
          >
            <Layers className="w-4 h-4 text-[#FFC845]" />
            <span>Gestionar Asignaciones</span>
          </button>
        </div>
      </div>
    </div>
  );
};
