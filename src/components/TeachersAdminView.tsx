import React, { useState } from 'react';
import { UserCheck, Shield, Key, Edit, Trash2, Plus, Power, CheckCircle2, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { Perfil, Sede, Horario, Programa } from '../types';
import { MOCK_DOCENTES, INITIAL_SEDES, INITIAL_HORARIOS, INITIAL_PROGRAMAS } from '../lib/mockData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { EditTeacherModal } from './EditTeacherModal';

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
  const [docentes, setDocentes] = useState<Perfil[]>(MOCK_DOCENTES);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [editingTeacher, setEditingTeacher] = useState<Perfil | null>(null);

  const filtered = docentes.filter(d =>
    d.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.rda && d.rda.includes(searchTerm))
  );

  const handleToggleActivo = (docenteId: string) => {
    setDocentes(prev =>
      prev.map(d => (d.id === docenteId ? { ...d, activo: !d.activo } : d))
    );
    setActionMsg('Estado del docente actualizado correctamente.');
    setTimeout(() => setActionMsg(null), 3000);
  };

  const handleTogglePublicar = (docenteId: string) => {
    setDocentes(prev =>
      prev.map(d => (d.id === docenteId ? { ...d, puede_publicar: !d.puede_publicar } : d))
    );
    setActionMsg('Permiso de publicación actualizado.');
    setTimeout(() => setActionMsg(null), 3000);
  };

  const handleSaveTeacherSuccess = (updatedTeacher: Perfil) => {
    setDocentes(prev =>
      prev.map(d => (d.id === updatedTeacher.id ? updatedTeacher : d))
    );
    if (updatedTeacher.id === user.id && onUpdateCurrentUser) {
      onUpdateCurrentUser(updatedTeacher);
    }
    setEditingTeacher(null);
    setActionMsg('Docente actualizado con éxito.');
    setTimeout(() => setActionMsg(null), 3000);
  };

  return (
    <div className="space-y-5 pb-20">
      {/* Title & Add Teacher Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-[#17324D]">Gestión de Personal Docente</h2>
          <p className="text-xs text-slate-500 font-medium">Asignación de sedes, horarios y permisos de publicación</p>
        </div>
        <button
          onClick={onOpenAddTeacherModal}
          id="btn-add-teacher"
          className="h-10 px-3 bg-[#00A651] text-white font-bold text-xs rounded-xl flex items-center gap-1 shadow-sm"
        >
          <Plus className="w-4 h-4 text-[#FFC845]" />
          <span>+ Docente</span>
        </button>
      </div>

      {actionMsg && (
        <div className="p-3 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-2xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#00A651]" />
          <span>{actionMsg}</span>
        </div>
      )}

      {/* Teachers List */}
      <div className="space-y-3">
        {filtered.map((doc) => (
          <div key={doc.id} className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
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
                  RDA: {doc.rda || 'N/D'} • Especialidad: {doc.especialidad || 'General'}
                </p>
                {doc.materias && doc.materias.length > 0 && (
                  <p className="text-[11px] text-emerald-800 font-medium mt-1">
                    Materias: {doc.materias.join(', ')}
                  </p>
                )}
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                    doc.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                  }`}
                >
                  {doc.activo ? 'Activo' : 'Desactivado'}
                </span>

                <button
                  onClick={() => setEditingTeacher(doc)}
                  className="h-8 px-3 bg-emerald-50 hover:bg-emerald-100 text-[#00A651] border border-emerald-200 rounded-xl font-bold text-xs flex items-center gap-1 transition-all"
                  title="Editar datos del docente"
                >
                  <Edit className="w-3.5 h-3.5 text-[#00A651]" />
                  <span>Editar</span>
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 text-xs space-y-1 text-slate-600 font-medium">
              <p>Sede: <strong className="text-slate-900">{doc.sede_nombre || 'Sede Poroma'}</strong></p>
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
        ))}
      </div>

      {editingTeacher && (
        <EditTeacherModal
          docente={editingTeacher}
          onClose={() => setEditingTeacher(null)}
          onSaveSuccess={handleSaveTeacherSuccess}
        />
      )}
    </div>
  );
};

