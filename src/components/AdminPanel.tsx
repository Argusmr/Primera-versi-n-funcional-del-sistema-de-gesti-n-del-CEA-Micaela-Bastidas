import React, { useState, useEffect } from 'react';
import {
  Settings,
  MapPin,
  Clock,
  BookOpen,
  Calendar,
  Shield,
  Plus,
  CheckCircle2,
  Building2,
  Save,
  Pencil,
  Power,
  X,
  Layers,
  GraduationCap,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { Perfil, Sede, Horario, Programa, Etapa, NivelEducativo, DatosInstitucionales } from '../types';
import { INITIAL_SEDES, INITIAL_HORARIOS } from '../lib/mockData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getLocalDatosInstitucionales, saveDatosInstitucionales } from '../lib/institutional';
import {
  getLocalProgramas,
  saveLocalProgramas,
  getLocalEtapas,
  saveLocalEtapas,
  getLocalNiveles,
  saveLocalNiveles
} from '../lib/academic';
import { AuditView } from './AuditView';

interface AdminPanelProps {
  user: Perfil;
  datosInstitucionales?: DatosInstitucionales;
  onUpdateDatosInstitucionales?: (datos: DatosInstitucionales) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  user,
  datosInstitucionales,
  onUpdateDatosInstitucionales,
}) => {
  const [activeAdminSubTab, setActiveAdminSubTab] = useState<
    'datos' | 'horarios' | 'sedes' | 'programas' | 'auditoria'
  >('datos');

  // Academic Sub-section inside 'programas'
  const [academicCategory, setAcademicCategory] = useState<'programas' | 'etapas' | 'niveles'>('programas');

  const [horarios, setHorarios] = useState<Horario[]>(INITIAL_HORARIOS);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [loadingSedes, setLoadingSedes] = useState<boolean>(false);
  const [sedesError, setSedesError] = useState<string | null>(null);
  const [sedeModalError, setSedeModalError] = useState<string | null>(null);
  const [isSavingSede, setIsSavingSede] = useState<boolean>(false);

  const fetchSedes = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setSedes(INITIAL_SEDES);
      return;
    }
    setLoadingSedes(true);
    setSedesError(null);
    try {
      const { data, error } = await supabase
        .from('sedes')
        .select('*')
        .order('nombre', { ascending: true });

      if (error) {
        console.error('Error al cargar sedes de Supabase:', error);
        setSedesError(`Error de Supabase: ${error.message}`);
      } else if (data) {
        const mapped: Sede[] = data.map((item: any) => ({
          id: item.id,
          nombre: item.nombre,
          direccion: item.direccion || '',
          latitud: item.latitud !== null && item.latitud !== undefined ? Number(item.latitud) : undefined,
          longitud: item.longitud !== null && item.longitud !== undefined ? Number(item.longitud) : undefined,
          radio_m: item.radio_m !== null && item.radio_m !== undefined ? Number(item.radio_m) : 150,
          activo: item.activo ?? true,
          created_at: item.created_at,
        }));
        setSedes(mapped);
      }
    } catch (err: any) {
      console.error('Error de conexión al cargar sedes:', err);
      setSedesError(err.message || 'Error de conexión al cargar sedes');
    } finally {
      setLoadingSedes(false);
    }
  };

  useEffect(() => {
    fetchSedes();
  }, []);

  useEffect(() => {
    if (activeAdminSubTab === 'sedes') {
      fetchSedes();
    }
  }, [activeAdminSubTab]);

  // Dynamic Academic State
  const [programas, setProgramas] = useState<Programa[]>(() => getLocalProgramas());
  const [etapas, setEtapas] = useState<Etapa[]>(() => getLocalEtapas());
  const [niveles, setNiveles] = useState<NivelEducativo[]>(() => getLocalNiveles());

  // Datos Institucionales Form state
  const [datosForm, setDatosForm] = useState<DatosInstitucionales>(
    datosInstitucionales || getLocalDatosInstitucionales()
  );
  const [isSavingDatos, setIsSavingDatos] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (datosInstitucionales) {
      setDatosForm(datosInstitucionales);
    }
  }, [datosInstitucionales]);

  // Modal / Form state for Programas, Etapas & Niveles
  const [editingPrograma, setEditingPrograma] = useState<Programa | null>(null);
  const [isProgramaModalOpen, setIsProgramaModalOpen] = useState(false);
  const [progForm, setProgForm] = useState<{ codigo: string; nombre: string; descripcion: string }>({
    codigo: '',
    nombre: '',
    descripcion: ''
  });

  const [editingEtapa, setEditingEtapa] = useState<Etapa | null>(null);
  const [isEtapaModalOpen, setIsEtapaModalOpen] = useState(false);
  const [etapaForm, setEtapaForm] = useState<{ nombre: string; programa_codigo: string; descripcion: string }>({
    nombre: '',
    programa_codigo: 'EPA',
    descripcion: ''
  });

  const [editingNivel, setEditingNivel] = useState<NivelEducativo | null>(null);
  const [isNivelModalOpen, setIsNivelModalOpen] = useState(false);
  const [nivelForm, setNivelForm] = useState<{ nombre: string; etapa_nombre: string; programa_codigo: string; descripcion: string }>({
    nombre: '',
    etapa_nombre: '',
    programa_codigo: 'EPA',
    descripcion: ''
  });

  // Modal / Form state for Sedes (GPS Config)
  const [editingSede, setEditingSede] = useState<Sede | null>(null);
  const [isSedeModalOpen, setIsSedeModalOpen] = useState(false);
  const [sedeForm, setSedeForm] = useState<{
    nombre: string;
    direccion: string;
    latitud: number;
    longitud: number;
    radio_m: number;
  }>({
    nombre: '',
    direccion: '',
    latitud: -19.033333,
    longitud: -65.262222,
    radio_m: 150
  });

  const showNotification = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(null), 3500);
  };

  const handleSaveDatosInstitucionales = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingDatos(true);
    setMsg(null);

    const res = await saveDatosInstitucionales(datosForm);
    if (onUpdateDatosInstitucionales) {
      onUpdateDatosInstitucionales(datosForm);
    }

    setIsSavingDatos(false);
    showNotification(res.error ? `Guardado localmente. (${res.error})` : 'Datos institucionales guardados correctamente.');
  };

  const handleToggleInvierno = (horarioId: string) => {
    setHorarios(prev =>
      prev.map(h => {
        if (h.id === horarioId) {
          const newInvierno = !h.es_invierno;
          return {
            ...h,
            es_invierno: newInvierno,
            hora_salida: newInvierno ? '21:30' : '22:00',
            nombre: newInvierno ? 'Poroma - Horario de Invierno' : 'Poroma - Habitual (Noche)'
          };
        }
        return h;
      })
    );
    showNotification('Configuración de horario de invierno actualizada.');
  };

  /* ================= PROGRAMAS CRUD ================= */
  const handleOpenAddPrograma = () => {
    setEditingPrograma(null);
    setProgForm({ codigo: '', nombre: '', descripcion: '' });
    setIsProgramaModalOpen(true);
  };

  const handleOpenEditPrograma = (p: Programa) => {
    setEditingPrograma(p);
    setProgForm({ codigo: p.codigo, nombre: p.nombre, descripcion: p.descripcion || '' });
    setIsProgramaModalOpen(true);
  };

  const handleSavePrograma = (e: React.FormEvent) => {
    e.preventDefault();
    let updated: Programa[];
    if (editingPrograma) {
      updated = programas.map(p => p.id === editingPrograma.id ? { ...p, ...progForm } : p);
      showNotification(`Programa ${progForm.codigo} actualizado correctamente.`);
    } else {
      const newP: Programa = {
        id: `prog-${Date.now()}`,
        codigo: progForm.codigo.toUpperCase(),
        nombre: progForm.nombre,
        descripcion: progForm.descripcion,
        activo: true
      };
      updated = [...programas, newP];
      showNotification(`Programa ${newP.codigo} añadido correctamente.`);
    }

    setProgramas(updated);
    saveLocalProgramas(updated);
    setIsProgramaModalOpen(false);
  };

  const handleToggleProgramaActive = (id: string) => {
    const updated = programas.map(p => p.id === id ? { ...p, activo: !p.activo } : p);
    setProgramas(updated);
    saveLocalProgramas(updated);
    showNotification('Estado del programa actualizado.');
  };

  /* ================= ETAPAS CRUD ================= */
  const handleOpenAddEtapa = () => {
    setEditingEtapa(null);
    setEtapaForm({ nombre: '', programa_codigo: 'EPA', descripcion: '' });
    setIsEtapaModalOpen(true);
  };

  const handleOpenEditEtapa = (e: Etapa) => {
    setEditingEtapa(e);
    setEtapaForm({ nombre: e.nombre, programa_codigo: e.programa_codigo || 'EPA', descripcion: e.descripcion || '' });
    setIsEtapaModalOpen(true);
  };

  const handleSaveEtapa = (ev: React.FormEvent) => {
    ev.preventDefault();
    let updated: Etapa[];
    if (editingEtapa) {
      updated = etapas.map(e => e.id === editingEtapa.id ? { ...e, ...etapaForm } : e);
      showNotification(`Etapa "${etapaForm.nombre}" actualizada.`);
    } else {
      const newE: Etapa = {
        id: `etapa-${Date.now()}`,
        nombre: etapaForm.nombre,
        programa_codigo: etapaForm.programa_codigo,
        descripcion: etapaForm.descripcion,
        activo: true
      };
      updated = [...etapas, newE];
      showNotification(`Etapa "${newE.nombre}" añadida correctamente.`);
    }

    setEtapas(updated);
    saveLocalEtapas(updated);
    setIsEtapaModalOpen(false);
  };

  const handleToggleEtapaActive = (id: string) => {
    const updated = etapas.map(e => e.id === id ? { ...e, activo: !e.activo } : e);
    setEtapas(updated);
    saveLocalEtapas(updated);
    showNotification('Estado de la etapa actualizado.');
  };

  /* ================= NIVELES CRUD ================= */
  const handleOpenAddNivel = () => {
    setEditingNivel(null);
    setNivelForm({ nombre: '', etapa_nombre: '', programa_codigo: 'EPA', descripcion: '' });
    setIsNivelModalOpen(true);
  };

  const handleOpenEditNivel = (n: NivelEducativo) => {
    setEditingNivel(n);
    setNivelForm({
      nombre: n.nombre,
      etapa_nombre: n.etapa_nombre || '',
      programa_codigo: n.programa_codigo || 'EPA',
      descripcion: n.descripcion || ''
    });
    setIsNivelModalOpen(true);
  };

  const handleSaveNivel = (ev: React.FormEvent) => {
    ev.preventDefault();
    let updated: NivelEducativo[];
    if (editingNivel) {
      updated = niveles.map(n => n.id === editingNivel.id ? { ...n, ...nivelForm } : n);
      showNotification(`Nivel "${nivelForm.nombre}" actualizado.`);
    } else {
      const newN: NivelEducativo = {
        id: `niv-${Date.now()}`,
        nombre: nivelForm.nombre,
        etapa_nombre: nivelForm.etapa_nombre,
        programa_codigo: nivelForm.programa_codigo,
        descripcion: nivelForm.descripcion,
        activo: true
      };
      updated = [...niveles, newN];
      showNotification(`Nivel "${newN.nombre}" añadido correctamente.`);
    }

    setNiveles(updated);
    saveLocalNiveles(updated);
    setIsNivelModalOpen(false);
  };

  const handleToggleNivelActive = (id: string) => {
    const updated = niveles.map(n => n.id === id ? { ...n, activo: !n.activo } : n);
    setNiveles(updated);
    saveLocalNiveles(updated);
    showNotification('Estado del nivel actualizado.');
  };

  /* ================= SEDES CRUD & GPS CONFIG ================= */
  const handleOpenAddSede = () => {
    setEditingSede(null);
    setSedeModalError(null);
    setSedeForm({
      nombre: '',
      direccion: '',
      latitud: -19.033333,
      longitud: -65.262222,
      radio_m: 150
    });
    setIsSedeModalOpen(true);
  };

  const handleOpenEditSede = (s: Sede) => {
    setEditingSede(s);
    setSedeModalError(null);
    setSedeForm({
      nombre: s.nombre,
      direccion: s.direccion || '',
      latitud: s.latitud !== undefined && s.latitud !== null ? Number(s.latitud) : 0,
      longitud: s.longitud !== undefined && s.longitud !== null ? Number(s.longitud) : 0,
      radio_m: s.radio_m !== undefined && s.radio_m !== null ? Number(s.radio_m) : 150
    });
    setIsSedeModalOpen(true);
  };

  const handleSaveSede = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSedeModalError(null);
    setIsSavingSede(true);

    if (isSupabaseConfigured && supabase) {
      try {
        if (editingSede) {
          const { error } = await supabase
            .from('sedes')
            .update({
              nombre: sedeForm.nombre,
              direccion: sedeForm.direccion,
              latitud: Number(sedeForm.latitud),
              longitud: Number(sedeForm.longitud),
              radio_m: Number(sedeForm.radio_m)
            })
            .eq('id', editingSede.id);

          if (error) {
            console.error('Error al actualizar la sede en Supabase:', error);
            setSedeModalError(`Error de Supabase: ${error.message}`);
            setIsSavingSede(false);
            return;
          }
        } else {
          const { error } = await supabase
            .from('sedes')
            .insert({
              nombre: sedeForm.nombre,
              direccion: sedeForm.direccion,
              latitud: Number(sedeForm.latitud),
              longitud: Number(sedeForm.longitud),
              radio_m: Number(sedeForm.radio_m)
            });

          if (error) {
            console.error('Error al crear la sede en Supabase:', error);
            setSedeModalError(`Error de Supabase: ${error.message}`);
            setIsSavingSede(false);
            return;
          }
        }

        // Re-consultar los datos directamente desde Supabase después de guardar
        await fetchSedes();
        showNotification(`Sede "${sedeForm.nombre}" guardada correctamente en Supabase.`);
        setIsSedeModalOpen(false);
      } catch (err: any) {
        setSedeModalError(err.message || 'Error inesperado al guardar la sede');
      } finally {
        setIsSavingSede(false);
      }
    } else {
      let updated: Sede[];
      if (editingSede) {
        updated = sedes.map(s => (s.id === editingSede.id ? { ...s, ...sedeForm } : s));
        showNotification(`Sede "${sedeForm.nombre}" actualizada localmente.`);
      } else {
        const newS: Sede = {
          id: `sede-${Date.now()}`,
          nombre: sedeForm.nombre,
          direccion: sedeForm.direccion,
          latitud: sedeForm.latitud,
          longitud: sedeForm.longitud,
          radio_m: sedeForm.radio_m,
          activo: true
        };
        updated = [...sedes, newS];
        showNotification(`Sede "${newS.nombre}" añadida localmente.`);
      }
      setSedes(updated);
      setIsSavingSede(false);
      setIsSedeModalOpen(false);
    }
  };

  return (
    <div className="space-y-5 pb-20">
      {/* Title */}
      <div>
        <h2 className="text-xl font-extrabold text-[#17324D]">Panel de Administración</h2>
        <p className="text-xs text-slate-500 font-medium">
          Configuración general, sedes, programas, etapas, niveles y auditoría
        </p>
      </div>

      {msg && (
        <div className="p-3.5 bg-emerald-100 border border-emerald-300 text-emerald-950 font-bold text-xs rounded-2xl flex items-center gap-2 animate-fade-in shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-[#00A651] shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {/* Main Admin Subtabs */}
      <div className="flex bg-slate-200 p-1 rounded-2xl overflow-x-auto no-scrollbar">
        {[
          { id: 'datos', label: 'Datos institucionales' },
          { id: 'programas', label: 'Programas, Etapas y Niveles' },
          { id: 'horarios', label: 'Horarios' },
          { id: 'sedes', label: 'Sedes' },
          { id: 'auditoria', label: 'Auditoría' },
        ].map(st => (
          <button
            key={st.id}
            onClick={() => setActiveAdminSubTab(st.id as any)}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
              activeAdminSubTab === st.id ? 'bg-[#00A651] text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            {st.label}
          </button>
        ))}
      </div>

      {/* DATOS INSTITUCIONALES */}
      {activeAdminSubTab === 'datos' && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building2 className="w-6 h-6 text-[#00A651]" />
            <div>
              <h3 className="font-extrabold text-base text-[#17324D]">Datos Institucionales</h3>
              <p className="text-xs text-slate-500 font-medium">
                Actualice la información general del centro educativo
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveDatosInstitucionales} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#17324D] uppercase tracking-wider mb-1">
                Nombre completo de la institución *
              </label>
              <input
                type="text"
                value={datosForm.nombre_completo}
                onChange={(e) => setDatosForm({ ...datosForm, nombre_completo: e.target.value })}
                placeholder="Ej. Centro de Educación Alternativa Micaela Bastidas"
                className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-[#00A651] focus:ring-2 focus:ring-emerald-200 outline-none text-sm font-medium text-slate-900"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#17324D] uppercase tracking-wider mb-1">
                  Nombre corto *
                </label>
                <input
                  type="text"
                  value={datosForm.nombre_corto}
                  onChange={(e) => setDatosForm({ ...datosForm, nombre_corto: e.target.value })}
                  placeholder="Ej. CEA Micaela Bastidas"
                  className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-[#00A651] focus:ring-2 focus:ring-emerald-200 outline-none text-sm font-medium text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#17324D] uppercase tracking-wider mb-1">
                  Nombre del director *
                </label>
                <input
                  type="text"
                  value={datosForm.nombre_director}
                  onChange={(e) => setDatosForm({ ...datosForm, nombre_director: e.target.value })}
                  placeholder="Ej. Prof. Mario Gutiérrez Flores"
                  className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-[#00A651] focus:ring-2 focus:ring-emerald-200 outline-none text-sm font-medium text-slate-900"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#17324D] uppercase tracking-wider mb-1">
                  Cargo del director
                </label>
                <input
                  type="text"
                  value={datosForm.cargo_director}
                  onChange={(e) => setDatosForm({ ...datosForm, cargo_director: e.target.value })}
                  placeholder="Ej. Director General Institucional"
                  className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-[#00A651] focus:ring-2 focus:ring-emerald-200 outline-none text-sm font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#17324D] uppercase tracking-wider mb-1">
                  Dirección / Ubicación
                </label>
                <input
                  type="text"
                  value={datosForm.direccion}
                  onChange={(e) => setDatosForm({ ...datosForm, direccion: e.target.value })}
                  placeholder="Ej. Poroma - Chuquisaca, Bolivia"
                  className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-[#00A651] focus:ring-2 focus:ring-emerald-200 outline-none text-sm font-medium text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#17324D] uppercase tracking-wider mb-1">
                  Teléfono / Celular de contacto
                </label>
                <input
                  type="text"
                  value={datosForm.telefono}
                  onChange={(e) => setDatosForm({ ...datosForm, telefono: e.target.value })}
                  placeholder="Ej. +591 67891234"
                  className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-[#00A651] focus:ring-2 focus:ring-emerald-200 outline-none text-sm font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#17324D] uppercase tracking-wider mb-1">
                  Lema o subtítulo institucional
                </label>
                <input
                  type="text"
                  value={datosForm.lema_subtitulo}
                  onChange={(e) => setDatosForm({ ...datosForm, lema_subtitulo: e.target.value })}
                  placeholder="Ej. Asistencia, seguimiento e información en un solo lugar"
                  className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-[#00A651] focus:ring-2 focus:ring-emerald-200 outline-none text-sm font-medium text-slate-900"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={isSavingDatos}
                id="btn-guardar-datos-inst"
                className="h-12 px-6 bg-[#00A651] hover:bg-[#008f45] active:scale-[0.98] text-white font-bold text-sm rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <Save className="w-5 h-5 text-[#FFC845]" />
                <span>{isSavingDatos ? 'Guardando en Supabase...' : 'Guardar Datos Institucionales'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PROGRAMAS, ETAPAS Y NIVELES (ESTRUCTURA ACADÉMICA) */}
      {activeAdminSubTab === 'programas' && (
        <div className="space-y-4">
          {/* Sub-selector for Academic Category */}
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              onClick={() => setAcademicCategory('programas')}
              className={`flex-1 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                academicCategory === 'programas' ? 'bg-[#17324D] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>Programas ({programas.length})</span>
            </button>

            <button
              onClick={() => setAcademicCategory('etapas')}
              className={`flex-1 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                academicCategory === 'etapas' ? 'bg-[#17324D] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Etapas ({etapas.length})</span>
            </button>

            <button
              onClick={() => setAcademicCategory('niveles')}
              className={`flex-1 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                academicCategory === 'niveles' ? 'bg-[#17324D] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Niveles ({niveles.length})</span>
            </button>
          </div>

          {/* 1. SECTION PROGRAMAS */}
          {academicCategory === 'programas' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-base text-[#17324D]">Programas Educativos</h3>
                  <p className="text-xs text-slate-500 font-medium">Gestión de EPA, ESA, ETA, EDUPER, CEE y otros</p>
                </div>

                <button
                  onClick={handleOpenAddPrograma}
                  id="btn-add-programa"
                  className="h-10 px-4 bg-[#00A651] hover:bg-[#008f45] text-white font-bold text-xs rounded-2xl flex items-center gap-1.5 shadow-xs transition-all"
                >
                  <Plus className="w-4 h-4 text-[#FFC845]" />
                  <span>Añadir Programa</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {programas.map(p => (
                  <div key={p.id} className="p-4 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="bg-[#17324D] text-white text-[11px] font-extrabold px-2.5 py-0.5 rounded-full">
                          {p.codigo}
                        </span>
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          p.activo ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-500 border-slate-300'
                        }`}>
                          {p.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      <h4 className="font-extrabold text-base text-[#17324D]">{p.nombre}</h4>
                      <p className="text-xs text-slate-500 font-medium">{p.descripcion || 'Sin descripción'}</p>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handleOpenEditPrograma(p)}
                        className="flex-1 h-9 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition-all"
                      >
                        <Pencil className="w-3.5 h-3.5 text-[#00A651]" />
                        <span>Editar</span>
                      </button>

                      <button
                        onClick={() => handleToggleProgramaActive(p.id)}
                        className={`px-3 h-9 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all ${
                          p.activo
                            ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-[#00A651] border border-emerald-200'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>{p.activo ? 'Desactivar' : 'Activar'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. SECTION ETAPAS */}
          {academicCategory === 'etapas' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-base text-[#17324D]">Etapas Educativas</h3>
                  <p className="text-xs text-slate-500 font-medium">Ciclos o fases asociadas a programas</p>
                </div>

                <button
                  onClick={handleOpenAddEtapa}
                  id="btn-add-etapa"
                  className="h-10 px-4 bg-[#00A651] hover:bg-[#008f45] text-white font-bold text-xs rounded-2xl flex items-center gap-1.5 shadow-xs transition-all"
                >
                  <Plus className="w-4 h-4 text-[#FFC845]" />
                  <span>Añadir Etapa</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {etapas.map(e => (
                  <div key={e.id} className="p-4 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="bg-indigo-100 text-indigo-900 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-indigo-200">
                          Programa: {e.programa_codigo || 'General'}
                        </span>
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          e.activo ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-500 border-slate-300'
                        }`}>
                          {e.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      <h4 className="font-extrabold text-base text-[#17324D]">{e.nombre}</h4>
                      <p className="text-xs text-slate-500 font-medium">{e.descripcion || 'Sin descripción'}</p>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handleOpenEditEtapa(e)}
                        className="flex-1 h-9 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition-all"
                      >
                        <Pencil className="w-3.5 h-3.5 text-[#00A651]" />
                        <span>Editar</span>
                      </button>

                      <button
                        onClick={() => handleToggleEtapaActive(e.id)}
                        className={`px-3 h-9 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all ${
                          e.activo
                            ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-[#00A651] border border-emerald-200'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>{e.activo ? 'Desactivar' : 'Activar'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. SECTION NIVELES */}
          {academicCategory === 'niveles' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-base text-[#17324D]">Niveles Educativos</h3>
                  <p className="text-xs text-slate-500 font-medium">Elemental, Avanzado, Técnico Básico, Auxiliar, Medio, etc.</p>
                </div>

                <button
                  onClick={handleOpenAddNivel}
                  id="btn-add-nivel"
                  className="h-10 px-4 bg-[#00A651] hover:bg-[#008f45] text-white font-bold text-xs rounded-2xl flex items-center gap-1.5 shadow-xs transition-all"
                >
                  <Plus className="w-4 h-4 text-[#FFC845]" />
                  <span>Añadir Nivel</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {niveles.map(n => (
                  <div key={n.id} className="p-4 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="bg-emerald-50 text-emerald-900 border border-emerald-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                          {n.programa_codigo || 'EPA'} {n.etapa_nombre ? `• ${n.etapa_nombre}` : ''}
                        </span>
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          n.activo ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-500 border-slate-300'
                        }`}>
                          {n.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      <h4 className="font-extrabold text-base text-[#17324D]">{n.nombre}</h4>
                      <p className="text-xs text-slate-500 font-medium">{n.descripcion || 'Sin descripción'}</p>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handleOpenEditNivel(n)}
                        className="flex-1 h-9 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition-all"
                      >
                        <Pencil className="w-3.5 h-3.5 text-[#00A651]" />
                        <span>Editar</span>
                      </button>

                      <button
                        onClick={() => handleToggleNivelActive(n.id)}
                        className={`px-3 h-9 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all ${
                          n.activo
                            ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-[#00A651] border border-emerald-200'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>{n.activo ? 'Desactivar' : 'Activar'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* HORARIOS ADMIN */}
      {activeAdminSubTab === 'horarios' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-base text-[#17324D]">Horarios Institucionales</h3>
            <button className="h-9 px-3 bg-[#00A651] text-white font-bold text-xs rounded-xl flex items-center gap-1">
              <Plus className="w-4 h-4" /> <span>Nuevo Horario</span>
            </button>
          </div>

          <div className="space-y-3">
            {horarios.map(h => (
              <div key={h.id} className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      {h.sede_nombre}
                    </span>
                    <h4 className="font-extrabold text-[#17324D] text-base mt-1">{h.nombre}</h4>
                  </div>
                  {h.es_invierno && (
                    <span className="bg-blue-100 text-blue-900 border border-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Horario Invierno Activo
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Ingreso</span>
                    <strong className="text-base text-[#00A651]">{h.hora_ingreso}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Tolerancia</span>
                    <strong className="text-base text-slate-700">{h.tolerancia_hasta}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Salida</span>
                    <strong className="text-base text-[#17324D]">{h.hora_salida}</strong>
                  </div>
                </div>

                {h.sede_nombre === 'Sede Poroma' && (
                  <button
                    onClick={() => handleToggleInvierno(h.id)}
                    className={`w-full h-11 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                      h.es_invierno
                        ? 'bg-amber-100 text-amber-950 border border-amber-300'
                        : 'bg-blue-50 text-blue-900 border border-blue-200 hover:bg-blue-100'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    <span>
                      {h.es_invierno ? 'Desactivar Horario de Invierno (Volver a 22:00)' : 'Activar Horario de Invierno (Salida 21:30)'}
                    </span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SEDES ADMIN */}
      {activeAdminSubTab === 'sedes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-base text-[#17324D]">Sedes Educativas</h3>
              <p className="text-xs text-slate-500 font-medium">Configuración de coordenadas GPS y radio permitido en metros</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchSedes}
                disabled={loadingSedes}
                className="h-9 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1 transition-all disabled:opacity-50"
                title="Recargar sedes desde Supabase"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${loadingSedes ? 'animate-spin' : ''}`} />
                <span>Actualizar</span>
              </button>
              <button
                onClick={handleOpenAddSede}
                className="h-9 px-3 bg-[#00A651] hover:bg-[#008f45] text-white font-bold text-xs rounded-xl flex items-center gap-1 shadow-xs"
              >
                <Plus className="w-4 h-4 text-[#FFC845]" /> <span>Añadir Sede</span>
              </button>
            </div>
          </div>

          {sedesError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-2xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{sedesError}</span>
            </div>
          )}

          {loadingSedes ? (
            <div className="p-8 text-center text-xs font-bold text-slate-500 bg-white rounded-3xl border border-slate-200">
              Cargando sedes desde Supabase...
            </div>
          ) : sedes.length === 0 ? (
            <div className="p-8 text-center text-xs font-bold text-slate-500 bg-white rounded-3xl border border-slate-200">
              No se encontraron sedes registradas en Supabase.
            </div>
          ) : (
            <div className="space-y-3">
              {sedes.map(s => (
                <div key={s.id} className="p-4 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-extrabold text-base text-[#17324D]">{s.nombre}</h4>
                      <p className="text-xs text-slate-500 font-medium">{s.direccion || 'Sin dirección registrada'}</p>
                    </div>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                      {s.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs font-medium text-slate-700">
                    <div>
                      <span className="text-[10px] text-slate-400 font-extrabold block uppercase">Latitud</span>
                      <strong className="text-slate-900">{s.latitud !== undefined && s.latitud !== null ? s.latitud : 'Sin latitud'}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-extrabold block uppercase">Longitud</span>
                      <strong className="text-slate-900">{s.longitud !== undefined && s.longitud !== null ? s.longitud : 'Sin longitud'}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-extrabold block uppercase">Radio GPS</span>
                      <strong className="text-[#00A651] font-extrabold">{s.radio_m ?? 150} metros</strong>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenEditSede(s)}
                    className="w-full h-9 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Pencil className="w-3.5 h-3.5 text-[#00A651]" />
                    <span>Editar Coordenadas GPS y Radio</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AUDITORIA VIEW */}
      {activeAdminSubTab === 'auditoria' && <AuditView user={user} />}

      {/* MODAL PROGRAMAS */}
      {isProgramaModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-lg text-[#17324D]">
                {editingPrograma ? 'Editar Programa Educativo' : 'Añadir Nuevo Programa'}
              </h3>
              <button
                onClick={() => setIsProgramaModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePrograma} className="space-y-3 text-xs font-bold">
              <div>
                <label className="block text-slate-700 mb-1">Código / Sigla *</label>
                <input
                  type="text"
                  placeholder="Ej. EPA, ESA, ETA, EDUPER, CEE"
                  value={progForm.codigo}
                  onChange={e => setProgForm({ ...progForm, codigo: e.target.value })}
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none uppercase font-extrabold text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Nombre Oficial del Programa *</label>
                <input
                  type="text"
                  placeholder="Ej. Educación Secundaria de Adultos"
                  value={progForm.nombre}
                  onChange={e => setProgForm({ ...progForm, nombre: e.target.value })}
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Descripción Breve</label>
                <textarea
                  placeholder="Descripción de la oferta formativa..."
                  value={progForm.descripcion}
                  onChange={e => setProgForm({ ...progForm, descripcion: e.target.value })}
                  className="w-full h-20 p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium text-slate-900 resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProgramaModalOpen(false)}
                  className="h-11 px-4 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-11 px-5 bg-[#00A651] hover:bg-[#008f45] text-white font-extrabold rounded-xl shadow-xs"
                >
                  Guardar Programa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ETAPAS */}
      {isEtapaModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-lg text-[#17324D]">
                {editingEtapa ? 'Editar Etapa Educativa' : 'Añadir Nueva Etapa'}
              </h3>
              <button
                onClick={() => setIsEtapaModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEtapa} className="space-y-3 text-xs font-bold">
              <div>
                <label className="block text-slate-700 mb-1">Nombre de la Etapa *</label>
                <input
                  type="text"
                  placeholder="Ej. Aprendizajes Elementales"
                  value={etapaForm.nombre}
                  onChange={e => setEtapaForm({ ...etapaForm, nombre: e.target.value })}
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Programa Asociado *</label>
                <select
                  value={etapaForm.programa_codigo}
                  onChange={e => setEtapaForm({ ...etapaForm, programa_codigo: e.target.value })}
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium text-slate-900"
                >
                  {programas.map(p => (
                    <option key={p.id} value={p.codigo}>{p.codigo} – {p.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Descripción</label>
                <textarea
                  placeholder="Descripción de la etapa..."
                  value={etapaForm.descripcion}
                  onChange={e => setEtapaForm({ ...etapaForm, descripcion: e.target.value })}
                  className="w-full h-20 p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium text-slate-900 resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEtapaModalOpen(false)}
                  className="h-11 px-4 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-11 px-5 bg-[#00A651] hover:bg-[#008f45] text-white font-extrabold rounded-xl shadow-xs"
                >
                  Guardar Etapa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NIVELES */}
      {isNivelModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-lg text-[#17324D]">
                {editingNivel ? 'Editar Nivel Educativo' : 'Añadir Nuevo Nivel'}
              </h3>
              <button
                onClick={() => setIsNivelModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNivel} className="space-y-3 text-xs font-bold">
              <div>
                <label className="block text-slate-700 mb-1">Nombre del Nivel *</label>
                <input
                  type="text"
                  placeholder="Ej. Elemental, Avanzado, Técnico Medio..."
                  value={nivelForm.nombre}
                  onChange={e => setNivelForm({ ...nivelForm, nombre: e.target.value })}
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Programa Asociado *</label>
                <select
                  value={nivelForm.programa_codigo}
                  onChange={e => setNivelForm({ ...nivelForm, programa_codigo: e.target.value })}
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium text-slate-900"
                >
                  {programas.map(p => (
                    <option key={p.id} value={p.codigo}>{p.codigo} – {p.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Etapa Referencial</label>
                <input
                  type="text"
                  placeholder="Ej. Aprendizajes Elementales"
                  value={nivelForm.etapa_nombre}
                  onChange={e => setNivelForm({ ...nivelForm, etapa_nombre: e.target.value })}
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Descripción</label>
                <textarea
                  placeholder="Detalles sobre el alcance académico..."
                  value={nivelForm.descripcion}
                  onChange={e => setNivelForm({ ...nivelForm, descripcion: e.target.value })}
                  className="w-full h-20 p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium text-slate-900 resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNivelModalOpen(false)}
                  className="h-11 px-4 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-11 px-5 bg-[#00A651] hover:bg-[#008f45] text-white font-extrabold rounded-xl shadow-xs"
                >
                  Guardar Nivel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SEDES GPS CONFIG */}
      {isSedeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-lg text-[#17324D]">
                {editingSede ? 'Editar Sede y Coordenadas GPS' : 'Añadir Nueva Sede'}
              </h3>
              <button
                type="button"
                onClick={() => setIsSedeModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {sedeModalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{sedeModalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveSede} className="space-y-3 text-xs font-bold">
              <div>
                <label className="block text-slate-700 mb-1">Nombre de la Sede *</label>
                <input
                  type="text"
                  placeholder="Ej. Sede Poroma, Sede San Juan de Horcas"
                  value={sedeForm.nombre}
                  onChange={e => setSedeForm({ ...sedeForm, nombre: e.target.value })}
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-extrabold text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Dirección / Ubicación Referencial</label>
                <input
                  type="text"
                  placeholder="Ej. Centro Poblado de Poroma"
                  value={sedeForm.direccion}
                  onChange={e => setSedeForm({ ...sedeForm, direccion: e.target.value })}
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1">Latitud GPS *</label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="-19.033333"
                    value={sedeForm.latitud}
                    onChange={e => setSedeForm({ ...sedeForm, latitud: parseFloat(e.target.value) || 0 })}
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium text-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">Longitud GPS *</label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="-65.262222"
                    value={sedeForm.longitud}
                    onChange={e => setSedeForm({ ...sedeForm, longitud: parseFloat(e.target.value) || 0 })}
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium text-slate-900"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Radio Permitido (metros) *</label>
                <input
                  type="number"
                  min="10"
                  max="5000"
                  value={sedeForm.radio_m}
                  onChange={e => setSedeForm({ ...sedeForm, radio_m: parseInt(e.target.value, 10) || 150 })}
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-extrabold text-[#00A651]"
                  required
                />
                <p className="text-[10px] text-slate-400 font-medium mt-1">
                  Default: 150 metros. Todo marcado fuera de este radio generará una excepción pendiente de revisión.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSedeModalOpen(false)}
                  disabled={isSavingSede}
                  className="h-11 px-4 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingSede}
                  className="h-11 px-5 bg-[#00A651] hover:bg-[#008f45] text-white font-extrabold rounded-xl shadow-xs transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isSavingSede ? 'Guardando...' : 'Guardar Sede'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
