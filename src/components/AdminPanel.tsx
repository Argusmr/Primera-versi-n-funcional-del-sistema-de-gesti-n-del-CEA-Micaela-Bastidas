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
  RefreshCw,
  FolderTree,
  Laptop,
  Utensils,
  Sparkles,
  Info,
  Check,
  ChevronRight,
  ArrowRight,
  Edit3,
  Trash2
} from 'lucide-react';
import { Perfil, Sede, Horario, Programa, Subprograma, CarreraTecnica, Etapa, NivelEducativo, DatosInstitucionales } from '../types';
import { INITIAL_SEDES, INITIAL_HORARIOS } from '../lib/mockData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getLocalDatosInstitucionales, saveDatosInstitucionales, loadDatosInstitucionales } from '../lib/institutional';
import {
  getLocalProgramas,
  saveLocalProgramas,
  getLocalSubprogramas,
  saveLocalSubprogramas,
  getLocalCarreras,
  saveLocalCarreras,
  getLocalEtapas,
  saveLocalEtapas,
  getLocalNiveles,
  saveLocalNiveles,
  loadProgramasFromSupabase,
  loadSubprogramasFromSupabase,
  loadCarrerasFromSupabase,
  loadEtapasFromSupabase,
  loadNivelesFromSupabase
} from '../lib/academic';
import { AuditView } from './AuditView';
import { WorkCalendarConfig } from './WorkCalendarConfig';
import {
  ajustarHoraSalida,
  setTemporadaInstitucional,
  determinarTemporadaInstitucional,
  TemporadaInstitucional
} from '../lib/scheduleResolver';

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
    'datos' | 'calendario' | 'horarios' | 'sedes' | 'programas' | 'auditoria'
  >('datos');

  // Academic Sub-section inside 'programas'
  const [academicViewMode, setAcademicViewMode] = useState<'arbol' | 'tablas'>('arbol');
  const [academicCategory, setAcademicCategory] = useState<'programas' | 'subprogramas' | 'carreras' | 'etapas' | 'niveles'>('programas');
  const [selectedTreeProgram, setSelectedTreeProgram] = useState<'EPJA' | 'ETA' | 'EDUPER' | 'CEE'>('EPJA');

  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [loadingHorarios, setLoadingHorarios] = useState<boolean>(false);
  const [horariosError, setHorariosError] = useState<string | null>(null);
  const [temporadaInstitucional, setTemporadaInstitucionalState] = useState<TemporadaInstitucional>('verano');
  const [isChangingTemporada, setIsChangingTemporada] = useState<boolean>(false);
  
  // Horario CRUD states
  const [isHorarioModalOpen, setIsHorarioModalOpen] = useState<boolean>(false);
  const [editingHorario, setEditingHorario] = useState<Horario | null>(null);
  const [horarioModalError, setHorarioModalError] = useState<string | null>(null);
  const [isSavingHorario, setIsSavingHorario] = useState<boolean>(false);
  const [horarioForm, setHorarioForm] = useState<{
    nombre: string;
    sede_id: string;
    es_invierno: boolean;
    dias_semana: string[];
    hora_ingreso: string;
    tolerancia_hasta: string;
    hora_salida: string;
    activo: boolean;
  }>({
    nombre: '',
    sede_id: '',
    es_invierno: false,
    dias_semana: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes'],
    hora_ingreso: '18:30',
    tolerancia_hasta: '18:40',
    hora_salida: '22:00',
    activo: true,
  });

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

  const fetchHorarios = async () => {
    // Determinar la temporada institucional activa
    try {
      const currentTemp = await determinarTemporadaInstitucional();
      setTemporadaInstitucionalState(currentTemp);
    } catch {
      // ignore
    }

    if (!isSupabaseConfigured || !supabase) {
      setHorarios(INITIAL_HORARIOS);
      return;
    }
    setLoadingHorarios(true);
    setHorariosError(null);
    try {
      const { data, error } = await supabase
        .from('horarios')
        .select('*, sedes(nombre)')
        .order('nombre', { ascending: true });

      if (error) {
        console.error('Error al cargar horarios de Supabase:', error);
        setHorariosError(`Error de Supabase: ${error.message}`);
        setHorarios(INITIAL_HORARIOS);
      } else if (data) {
        const mapped: Horario[] = data.map((item: any) => ({
          ...item,
          sede_nombre: item.sedes?.nombre || item.sede_nombre || 'Sede General',
        }));
        setHorarios(mapped);
      }
    } catch (err: any) {
      console.error('Excepción al cargar horarios:', err);
      setHorariosError(err.message || 'Error de conexión al cargar horarios');
      setHorarios(INITIAL_HORARIOS);
    } finally {
      setLoadingHorarios(false);
    }
  };

  const fetchProgramas = async () => {
    const list = await loadProgramasFromSupabase();
    setProgramas(list);
  };

  const fetchSubprogramas = async () => {
    const list = await loadSubprogramasFromSupabase();
    setSubprogramas(list);
  };

  const fetchCarreras = async () => {
    const list = await loadCarrerasFromSupabase();
    setCarreras(list);
  };

  const fetchEtapas = async () => {
    const list = await loadEtapasFromSupabase();
    setEtapas(list);
  };

  const fetchNiveles = async () => {
    const list = await loadNivelesFromSupabase();
    setNiveles(list);
  };

  useEffect(() => {
    fetchSedes();
    fetchHorarios();
    fetchProgramas();
    fetchSubprogramas();
    fetchCarreras();
    fetchEtapas();
    fetchNiveles();
  }, []);

  useEffect(() => {
    if (activeAdminSubTab === 'sedes') fetchSedes();
    if (activeAdminSubTab === 'horarios') fetchHorarios();
    if (activeAdminSubTab === 'programas') {
      fetchProgramas();
      fetchSubprogramas();
      fetchCarreras();
      fetchEtapas();
      fetchNiveles();
    }
    if (activeAdminSubTab === 'datos') {
      loadDatosInstitucionales().then(res => {
        if (res) setDatosForm(res);
      });
    }
  }, [activeAdminSubTab]);

  // Dynamic Academic State
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [subprogramas, setSubprogramas] = useState<Subprograma[]>([]);
  const [carreras, setCarreras] = useState<CarreraTecnica[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [niveles, setNiveles] = useState<NivelEducativo[]>([]);

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

  // Modal / Form state for Programas, Subprogramas, Carreras, Etapas & Niveles
  const [editingPrograma, setEditingPrograma] = useState<Programa | null>(null);
  const [isProgramaModalOpen, setIsProgramaModalOpen] = useState(false);
  const [progForm, setProgForm] = useState<{ codigo: string; nombre: string; descripcion: string }>({
    codigo: '',
    nombre: '',
    descripcion: ''
  });

  const [editingSubprograma, setEditingSubprograma] = useState<Subprograma | null>(null);
  const [isSubprogramaModalOpen, setIsSubprogramaModalOpen] = useState(false);
  const [subprogForm, setSubprogForm] = useState<{ codigo: string; nombre: string; descripcion: string; programa_codigo: string }>({
    codigo: '',
    nombre: '',
    descripcion: '',
    programa_codigo: 'EPJA'
  });

  const [editingCarrera, setEditingCarrera] = useState<CarreraTecnica | null>(null);
  const [isCarreraModalOpen, setIsCarreraModalOpen] = useState(false);
  const [carreraForm, setCarreraForm] = useState<{ nombre: string; codigo: string; descripcion: string }>({
    nombre: '',
    codigo: '',
    descripcion: ''
  });

  const [editingEtapa, setEditingEtapa] = useState<Etapa | null>(null);
  const [isEtapaModalOpen, setIsEtapaModalOpen] = useState(false);
  const [etapaForm, setEtapaForm] = useState<{ nombre: string; programa_codigo: string; subprograma_codigo: string; descripcion: string }>({
    nombre: '',
    programa_codigo: 'EPJA',
    subprograma_codigo: 'EPA',
    descripcion: ''
  });

  const [editingNivel, setEditingNivel] = useState<NivelEducativo | null>(null);
  const [isNivelModalOpen, setIsNivelModalOpen] = useState(false);
  const [nivelForm, setNivelForm] = useState<{ nombre: string; etapa_nombre: string; programa_codigo: string; subprograma_codigo: string; carrera_nombre: string; orden: number; descripcion: string }>({
    nombre: '',
    etapa_nombre: '',
    programa_codigo: 'EPJA',
    subprograma_codigo: 'EPA',
    carrera_nombre: '',
    orden: 1,
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
    if (res.error) {
      setMsg('Error al guardar en Supabase: ' + res.error);
    } else {
      if (onUpdateDatosInstitucionales) {
        onUpdateDatosInstitucionales(datosForm);
      }
      showNotification('Datos institucionales guardados correctamente en Supabase.');
      const reload = await loadDatosInstitucionales();
      if (reload) setDatosForm(reload);
    }
    setIsSavingDatos(false);
  };

  const handleToggleInvierno = async (horarioId: string) => {
    const target = horarios.find(h => h.id === horarioId);
    if (!target) return;

    const newInvierno = !target.es_invierno;
    const delta = newInvierno ? -30 : 30;
    const newHoraSalida = ajustarHoraSalida(target.hora_salida, delta);
    const cleanName = target.nombre.replace(/ - Horario de Invierno| - Habitual \(Noche\)/g, '').trim();
    const newNombre = newInvierno ? `${cleanName} - Horario de Invierno` : `${cleanName} - Habitual (Noche)`;

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('horarios')
        .update({
          es_invierno: newInvierno,
          hora_salida: newHoraSalida,
          nombre: newNombre,
          updated_at: new Date().toISOString()
        })
        .eq('id', horarioId);

      if (error) {
        showNotification('Error en Supabase: ' + error.message);
        return;
      }
      await fetchHorarios();
    } else {
      setHorarios(prev =>
        prev.map(h => {
          if (h.id === horarioId) {
            return {
              ...h,
              es_invierno: newInvierno,
              hora_salida: newHoraSalida,
              nombre: newNombre
            };
          }
          return h;
        })
      );
    }
    showNotification(`Horario actualizado: ${newInvierno ? 'Horario de Invierno activado' : 'Horario Regular restablecido'}.`);
  };

  const handleCambiarTemporadaInstitucional = async (nuevaTemp: TemporadaInstitucional) => {
    setIsChangingTemporada(true);
    try {
      await setTemporadaInstitucional(nuevaTemp);
      setTemporadaInstitucionalState(nuevaTemp);
      await fetchHorarios();
      showNotification(`Temporada institucional actualizada a: ${nuevaTemp === 'invierno' ? 'Horario de Invierno' : 'Horario Regular / Verano'}.`);
    } catch (e: any) {
      showNotification('Error al cambiar temporada institucional: ' + (e.message || 'Desconocido'));
    } finally {
      setIsChangingTemporada(false);
    }
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

  const handleSavePrograma = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSupabaseConfigured && supabase) {
      if (editingPrograma) {
        const { error } = await supabase
          .from('programas')
          .update({
            codigo: progForm.codigo.toUpperCase(),
            nombre: progForm.nombre,
            descripcion: progForm.descripcion,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingPrograma.id);

        if (error) {
          showNotification('Error en Supabase: ' + error.message);
          return;
        }
        showNotification(`Programa ${progForm.codigo} actualizado correctamente en Supabase.`);
      } else {
        const { error } = await supabase
          .from('programas')
          .insert({
            codigo: progForm.codigo.toUpperCase(),
            nombre: progForm.nombre,
            descripcion: progForm.descripcion,
            activo: true
          });

        if (error) {
          showNotification('Error en Supabase: ' + error.message);
          return;
        }
        showNotification(`Programa ${progForm.codigo.toUpperCase()} añadido correctamente en Supabase.`);
      }
      await fetchProgramas();
    } else {
      let updated: Programa[];
      if (editingPrograma) {
        updated = programas.map(p => p.id === editingPrograma.id ? { ...p, ...progForm } : p);
      } else {
        const newP: Programa = {
          id: `prog-${Date.now()}`,
          codigo: progForm.codigo.toUpperCase(),
          nombre: progForm.nombre,
          descripcion: progForm.descripcion,
          activo: true
        };
        updated = [...programas, newP];
      }
      setProgramas(updated);
      saveLocalProgramas(updated);
    }
    setIsProgramaModalOpen(false);
  };

  const handleToggleProgramaActive = async (id: string) => {
    const target = programas.find(p => p.id === id);
    if (!target) return;

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('programas')
        .update({ activo: !target.activo, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        showNotification('Error en Supabase: ' + error.message);
        return;
      }
      await fetchProgramas();
    } else {
      const updated = programas.map(p => p.id === id ? { ...p, activo: !p.activo } : p);
      setProgramas(updated);
      saveLocalProgramas(updated);
    }
    showNotification('Estado del programa actualizado.');
  };

  /* ================= SUBPROGRAMAS CRUD ================= */
  const handleOpenAddSubprograma = (progCode = 'EPJA') => {
    setEditingSubprograma(null);
    setSubprogForm({ codigo: '', nombre: '', descripcion: '', programa_codigo: progCode });
    setIsSubprogramaModalOpen(true);
  };

  const handleOpenEditSubprograma = (sp: Subprograma) => {
    setEditingSubprograma(sp);
    setSubprogForm({
      codigo: sp.codigo,
      nombre: sp.nombre,
      descripcion: sp.descripcion || '',
      programa_codigo: sp.programa_codigo || 'EPJA'
    });
    setIsSubprogramaModalOpen(true);
  };

  const handleSaveSubprograma = async (e: React.FormEvent) => {
    e.preventDefault();
    const parentProg = programas.find(p => p.codigo === subprogForm.programa_codigo);
    if (isSupabaseConfigured && supabase) {
      if (editingSubprograma) {
        const { error } = await supabase
          .from('subprogramas')
          .update({
            codigo: subprogForm.codigo.toUpperCase(),
            nombre: subprogForm.nombre,
            descripcion: subprogForm.descripcion,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingSubprograma.id);

        if (error) {
          showNotification('Error en Supabase: ' + error.message);
          return;
        }
        showNotification(`Subprograma ${subprogForm.codigo} actualizado en Supabase.`);
      } else {
        const { error } = await supabase
          .from('subprogramas')
          .insert({
            programa_id: parentProg?.id,
            codigo: subprogForm.codigo.toUpperCase(),
            nombre: subprogForm.nombre,
            descripcion: subprogForm.descripcion,
            activo: true
          });

        if (error) {
          showNotification('Error en Supabase: ' + error.message);
          return;
        }
        showNotification(`Subprograma ${subprogForm.codigo.toUpperCase()} añadido en Supabase.`);
      }
      await fetchSubprogramas();
    } else {
      let updated: Subprograma[];
      if (editingSubprograma) {
        updated = subprogramas.map(s => s.id === editingSubprograma.id ? { ...s, ...subprogForm, codigo: subprogForm.codigo.toUpperCase() } : s);
      } else {
        const newS: Subprograma = {
          id: `subprog-${Date.now()}`,
          programa_id: parentProg?.id || 'prog-1',
          programa_codigo: subprogForm.programa_codigo,
          codigo: subprogForm.codigo.toUpperCase(),
          nombre: subprogForm.nombre,
          descripcion: subprogForm.descripcion,
          activo: true
        };
        updated = [...subprogramas, newS];
      }
      setSubprogramas(updated);
      saveLocalSubprogramas(updated);
    }
    setIsSubprogramaModalOpen(false);
  };

  const handleToggleSubprogramaActive = async (id: string) => {
    const target = subprogramas.find(s => s.id === id);
    if (!target) return;

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('subprogramas')
        .update({ activo: !target.activo, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        showNotification('Error en Supabase: ' + error.message);
        return;
      }
      await fetchSubprogramas();
    } else {
      const updated = subprogramas.map(s => s.id === id ? { ...s, activo: !s.activo } : s);
      setSubprogramas(updated);
      saveLocalSubprogramas(updated);
    }
    showNotification('Estado del subprograma actualizado.');
  };

  /* ================= CARRERAS TECNICAS (ETA) CRUD ================= */
  const handleOpenAddCarrera = () => {
    setEditingCarrera(null);
    setCarreraForm({ nombre: '', codigo: '', descripcion: '' });
    setIsCarreraModalOpen(true);
  };

  const handleOpenEditCarrera = (c: CarreraTecnica) => {
    setEditingCarrera(c);
    setCarreraForm({ nombre: c.nombre, codigo: c.codigo || '', descripcion: c.descripcion || '' });
    setIsCarreraModalOpen(true);
  };

  const handleSaveCarrera = async (e: React.FormEvent) => {
    e.preventDefault();
    const etaProg = programas.find(p => p.codigo === 'ETA');
    if (isSupabaseConfigured && supabase) {
      if (editingCarrera) {
        const { error } = await supabase
          .from('carreras')
          .update({
            nombre: carreraForm.nombre,
            codigo: carreraForm.codigo.toUpperCase(),
            descripcion: carreraForm.descripcion,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingCarrera.id);

        if (error) {
          showNotification('Error en Supabase: ' + error.message);
          return;
        }
        showNotification(`Carrera "${carreraForm.nombre}" actualizada en Supabase.`);
      } else {
        const { error } = await supabase
          .from('carreras')
          .insert({
            programa_id: etaProg?.id,
            nombre: carreraForm.nombre,
            codigo: carreraForm.codigo.toUpperCase(),
            descripcion: carreraForm.descripcion,
            activo: true
          });

        if (error) {
          showNotification('Error en Supabase: ' + error.message);
          return;
        }
        showNotification(`Carrera "${carreraForm.nombre}" añadida a ETA en Supabase.`);
      }
      await fetchCarreras();
    } else {
      let updated: CarreraTecnica[];
      if (editingCarrera) {
        updated = carreras.map(c => c.id === editingCarrera.id ? { ...c, ...carreraForm } : c);
      } else {
        const newC: CarreraTecnica = {
          id: `carr-${Date.now()}`,
          programa_id: etaProg?.id || 'prog-2',
          programa_codigo: 'ETA',
          codigo: carreraForm.codigo.toUpperCase(),
          nombre: carreraForm.nombre,
          descripcion: carreraForm.descripcion,
          activo: true
        };
        updated = [...carreras, newC];
      }
      setCarreras(updated);
      saveLocalCarreras(updated);
    }
    setIsCarreraModalOpen(false);
  };

  const handleToggleCarreraActive = async (id: string) => {
    const target = carreras.find(c => c.id === id);
    if (!target) return;

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('carreras')
        .update({ activo: !target.activo, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        showNotification('Error en Supabase: ' + error.message);
        return;
      }
      await fetchCarreras();
    } else {
      const updated = carreras.map(c => c.id === id ? { ...c, activo: !c.activo } : c);
      setCarreras(updated);
      saveLocalCarreras(updated);
    }
    showNotification('Estado de la carrera técnica actualizado.');
  };

  /* ================= ETAPAS CRUD ================= */
  const handleOpenAddEtapa = (subprogCode = 'EPA') => {
    setEditingEtapa(null);
    setEtapaForm({ nombre: '', programa_codigo: 'EPJA', subprograma_codigo: subprogCode, descripcion: '' });
    setIsEtapaModalOpen(true);
  };

  const handleOpenEditEtapa = (e: Etapa) => {
    setEditingEtapa(e);
    setEtapaForm({
      nombre: e.nombre,
      programa_codigo: e.programa_codigo || 'EPJA',
      subprograma_codigo: e.subprograma_codigo || 'EPA',
      descripcion: e.descripcion || ''
    });
    setIsEtapaModalOpen(true);
  };

  const handleSaveEtapa = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (isSupabaseConfigured && supabase) {
      if (editingEtapa) {
        const { error } = await supabase
          .from('etapas')
          .update({
            nombre: etapaForm.nombre,
            programa_codigo: etapaForm.programa_codigo,
            subprograma_codigo: etapaForm.subprograma_codigo,
            descripcion: etapaForm.descripcion,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingEtapa.id);

        if (error) {
          showNotification('Error en Supabase: ' + error.message);
          return;
        }
        showNotification(`Etapa "${etapaForm.nombre}" actualizada en Supabase.`);
      } else {
        const { error } = await supabase
          .from('etapas')
          .insert({
            nombre: etapaForm.nombre,
            programa_codigo: etapaForm.programa_codigo,
            subprograma_codigo: etapaForm.subprograma_codigo,
            descripcion: etapaForm.descripcion,
            activo: true
          });

        if (error) {
          showNotification('Error en Supabase: ' + error.message);
          return;
        }
        showNotification(`Etapa "${etapaForm.nombre}" añadida en Supabase.`);
      }
      await fetchEtapas();
    } else {
      let updated: Etapa[];
      if (editingEtapa) {
        updated = etapas.map(e => e.id === editingEtapa.id ? { ...e, ...etapaForm } : e);
      } else {
        const newE: Etapa = {
          id: `etapa-${Date.now()}`,
          nombre: etapaForm.nombre,
          programa_codigo: etapaForm.programa_codigo,
          subprograma_codigo: etapaForm.subprograma_codigo,
          descripcion: etapaForm.descripcion,
          activo: true
        };
        updated = [...etapas, newE];
      }
      setEtapas(updated);
      saveLocalEtapas(updated);
    }
    setIsEtapaModalOpen(false);
  };

  const handleToggleEtapaActive = async (id: string) => {
    const target = etapas.find(e => e.id === id);
    if (!target) return;

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('etapas')
        .update({ activo: !target.activo, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        showNotification('Error en Supabase: ' + error.message);
        return;
      }
      await fetchEtapas();
    } else {
      const updated = etapas.map(e => e.id === id ? { ...e, activo: !e.activo } : e);
      setEtapas(updated);
      saveLocalEtapas(updated);
    }
    showNotification('Estado de la etapa actualizado.');
  };

  /* ================= NIVELES CRUD ================= */
  const handleOpenAddNivel = (context?: { prog?: string; subprog?: string; carrera?: string; etapa?: string }) => {
    setEditingNivel(null);
    setNivelForm({
      nombre: '',
      etapa_nombre: context?.etapa || '',
      programa_codigo: context?.prog || 'EPJA',
      subprograma_codigo: context?.subprog || 'EPA',
      carrera_nombre: context?.carrera || '',
      orden: 1,
      descripcion: ''
    });
    setIsNivelModalOpen(true);
  };

  const handleOpenEditNivel = (n: NivelEducativo) => {
    setEditingNivel(n);
    setNivelForm({
      nombre: n.nombre,
      etapa_nombre: n.etapa_nombre || '',
      programa_codigo: n.programa_codigo || 'EPJA',
      subprograma_codigo: n.subprograma_codigo || '',
      carrera_nombre: n.carrera_nombre || '',
      orden: n.orden || 1,
      descripcion: n.descripcion || ''
    });
    setIsNivelModalOpen(true);
  };

  const handleSaveNivel = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (isSupabaseConfigured && supabase) {
      if (editingNivel) {
        const { error } = await supabase
          .from('niveles')
          .update({
            nombre: nivelForm.nombre,
            etapa_nombre: nivelForm.etapa_nombre,
            programa_codigo: nivelForm.programa_codigo,
            subprograma_codigo: nivelForm.subprograma_codigo,
            carrera_nombre: nivelForm.carrera_nombre,
            orden: nivelForm.orden,
            descripcion: nivelForm.descripcion,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingNivel.id);

        if (error) {
          showNotification('Error en Supabase: ' + error.message);
          return;
        }
        showNotification(`Nivel "${nivelForm.nombre}" actualizado en Supabase.`);
      } else {
        const { error } = await supabase
          .from('niveles')
          .insert({
            nombre: nivelForm.nombre,
            etapa_nombre: nivelForm.etapa_nombre,
            programa_codigo: nivelForm.programa_codigo,
            subprograma_codigo: nivelForm.subprograma_codigo,
            carrera_nombre: nivelForm.carrera_nombre,
            orden: nivelForm.orden,
            descripcion: nivelForm.descripcion,
            activo: true
          });

        if (error) {
          showNotification('Error en Supabase: ' + error.message);
          return;
        }
        showNotification(`Nivel "${nivelForm.nombre}" añadido en Supabase.`);
      }
      await fetchNiveles();
    } else {
      let updated: NivelEducativo[];
      if (editingNivel) {
        updated = niveles.map(n => n.id === editingNivel.id ? { ...n, ...nivelForm } : n);
      } else {
        const newN: NivelEducativo = {
          id: `niv-${Date.now()}`,
          nombre: nivelForm.nombre,
          etapa_nombre: nivelForm.etapa_nombre,
          programa_codigo: nivelForm.programa_codigo,
          subprograma_codigo: nivelForm.subprograma_codigo,
          carrera_nombre: nivelForm.carrera_nombre,
          orden: nivelForm.orden,
          descripcion: nivelForm.descripcion,
          activo: true
        };
        updated = [...niveles, newN];
      }
      setNiveles(updated);
      saveLocalNiveles(updated);
    }
    setIsNivelModalOpen(false);
  };

  const handleToggleNivelActive = async (id: string) => {
    const target = niveles.find(n => n.id === id);
    if (!target) return;

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('niveles')
        .update({ activo: !target.activo, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        showNotification('Error en Supabase: ' + error.message);
        return;
      }
      await fetchNiveles();
    } else {
      const updated = niveles.map(n => n.id === id ? { ...n, activo: !n.activo } : n);
      setNiveles(updated);
      saveLocalNiveles(updated);
    }
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

  /* ================= HORARIOS CRUD ================= */
  const handleOpenCreateHorario = () => {
    setEditingHorario(null);
    setHorarioModalError(null);
    const defaultSedeId = sedes.length > 0 ? sedes[0].id : '';
    setHorarioForm({
      nombre: '',
      sede_id: defaultSedeId,
      es_invierno: false,
      dias_semana: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes'],
      hora_ingreso: '18:30',
      tolerancia_hasta: '18:40',
      hora_salida: '22:00',
      activo: true,
    });
    setIsHorarioModalOpen(true);
  };

  const handleOpenEditHorario = (h: Horario) => {
    setEditingHorario(h);
    setHorarioModalError(null);
    setHorarioForm({
      nombre: h.nombre,
      sede_id: h.sede_id,
      es_invierno: Boolean(h.es_invierno),
      dias_semana: Array.isArray(h.dias_semana) && h.dias_semana.length > 0
        ? h.dias_semana
        : ['lunes', 'martes', 'miércoles', 'jueves', 'viernes'],
      hora_ingreso: h.hora_ingreso || '18:30',
      tolerancia_hasta: h.tolerancia_hasta || '18:40',
      hora_salida: h.hora_salida || '22:00',
      activo: h.activo !== false,
    });
    setIsHorarioModalOpen(true);
  };

  const handleToggleDiaSemana = (dia: string) => {
    const norm = dia.toLowerCase();
    const current = horarioForm.dias_semana || [];
    if (current.includes(norm)) {
      if (current.length === 1) {
        setHorarioModalError('El horario debe tener al menos un día aplicable asignado.');
        return;
      }
      setHorarioForm({ ...horarioForm, dias_semana: current.filter(d => d !== norm) });
    } else {
      setHorarioForm({ ...horarioForm, dias_semana: [...current, norm] });
    }
  };

  const handleSaveHorario = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setHorarioModalError(null);

    // 1. Validaciones
    if (!horarioForm.sede_id) {
      setHorarioModalError('Debe seleccionar una sede educativa obligatoriamente.');
      return;
    }

    if (!horarioForm.nombre.trim()) {
      setHorarioModalError('El nombre descriptivo del horario es obligatorio.');
      return;
    }

    if (!horarioForm.dias_semana || horarioForm.dias_semana.length === 0) {
      setHorarioModalError('Debe seleccionar al menos un día de la semana aplicable.');
      return;
    }

    if (horarioForm.hora_salida <= horarioForm.hora_ingreso) {
      setHorarioModalError('La hora de salida debe ser posterior a la hora de ingreso.');
      return;
    }

    if (horarioForm.tolerancia_hasta < horarioForm.hora_ingreso || horarioForm.tolerancia_hasta > horarioForm.hora_salida) {
      setHorarioModalError('La hora de tolerancia debe estar comprendida entre la hora de ingreso y la hora de salida.');
      return;
    }

    // Validar duplicidad de horario de invierno para la misma sede con solapamiento de días
    if (horarioForm.es_invierno) {
      const existingDuplicate = horarios.find(h => {
        if (editingHorario && h.id === editingHorario.id) return false;
        if (h.sede_id !== horarioForm.sede_id) return false;
        if (!h.es_invierno || !h.activo) return false;
        const diasTarget = (h.dias_semana || []).map(d => d.toLowerCase());
        return horarioForm.dias_semana.some(d => diasTarget.includes(d.toLowerCase()));
      });

      if (existingDuplicate) {
        setHorarioModalError(`Ya existe un Horario de Invierno activo para esta sede con días coincidentes (${existingDuplicate.nombre}).`);
        return;
      }
    }

    setIsSavingHorario(true);

    const payload = {
      nombre: horarioForm.nombre.trim(),
      sede_id: horarioForm.sede_id,
      es_invierno: horarioForm.es_invierno,
      dias_semana: horarioForm.dias_semana,
      hora_ingreso: horarioForm.hora_ingreso,
      tolerancia_hasta: horarioForm.tolerancia_hasta,
      hora_salida: horarioForm.hora_salida,
      activo: horarioForm.activo,
    };

    if (isSupabaseConfigured && supabase) {
      try {
        if (editingHorario) {
          const { error } = await supabase
            .from('horarios')
            .update({
              ...payload,
              updated_at: new Date().toISOString()
            })
            .eq('id', editingHorario.id);

          if (error) {
            console.error('Error al actualizar horario en Supabase:', error);
            setHorarioModalError(`Error de Supabase: ${error.message}`);
            setIsSavingHorario(false);
            return;
          }
        } else {
          const { error } = await supabase
            .from('horarios')
            .insert(payload);

          if (error) {
            console.error('Error al crear horario en Supabase:', error);
            setHorarioModalError(`Error de Supabase: ${error.message}`);
            setIsSavingHorario(false);
            return;
          }
        }

        await fetchHorarios();
        showNotification(`Horario "${horarioForm.nombre}" guardado correctamente en Supabase.`);
        setIsHorarioModalOpen(false);
      } catch (err: any) {
        setHorarioModalError(err.message || 'Error inesperado al guardar el horario');
      } finally {
        setIsSavingHorario(false);
      }
    } else {
      const sedeSeleccionada = sedes.find(s => s.id === horarioForm.sede_id);
      let updated: Horario[];
      if (editingHorario) {
        updated = horarios.map(h =>
          h.id === editingHorario.id
            ? { ...h, ...payload, sede_nombre: sedeSeleccionada?.nombre || h.sede_nombre }
            : h
        );
        showNotification(`Horario "${horarioForm.nombre}" actualizado localmente.`);
      } else {
        const newH: Horario = {
          id: `hor-${Date.now()}`,
          ...payload,
          sede_nombre: sedeSeleccionada?.nombre || 'Sede Seleccionada',
        };
        updated = [...horarios, newH];
        showNotification(`Horario "${newH.nombre}" creado localmente.`);
      }
      setHorarios(updated);
      setIsSavingHorario(false);
      setIsHorarioModalOpen(false);
    }
  };

  const handleDeleteHorario = async (horarioId: string) => {
    const target = horarios.find(h => h.id === horarioId);
    if (!target) return;

    if (!window.confirm(`¿Está seguro de eliminar el horario "${target.nombre}"?`)) {
      return;
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('horarios')
          .delete()
          .eq('id', horarioId);

        if (error) {
          showNotification('Error al eliminar horario en Supabase: ' + error.message);
          return;
        }
        await fetchHorarios();
        showNotification(`Horario "${target.nombre}" eliminado correctamente.`);
      } catch (e: any) {
        showNotification('Error inesperado al eliminar horario: ' + e.message);
      }
    } else {
      setHorarios(prev => prev.filter(h => h.id !== horarioId));
      showNotification(`Horario "${target.nombre}" eliminado localmente.`);
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
          { id: 'calendario', label: 'Calendario Laboral' },
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
                  placeholder="Ej. Lic. Juan Pérez Morales"
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

      {/* PROGRAMAS, ETAPAS Y NIVELES (ESTRUCTURA ACADÉMICA OFICIAL CEA) */}
      {activeAdminSubTab === 'programas' && (
        <div className="space-y-5">
          {/* Header & View Mode Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200 shadow-xs">
            <div>
              <h3 className="font-extrabold text-lg text-[#17324D] flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-[#00A651]" />
                <span>Estructura Educativa Institucional</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Organización de Educación Alternativa: EPJA (EPA/ESA), ETA (Carreras y Niveles), EDUPER y CEE
              </p>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setAcademicViewMode('arbol')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                  academicViewMode === 'arbol' ? 'bg-[#17324D] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FolderTree className="w-3.5 h-3.5" />
                <span>Árbol Oficial</span>
              </button>

              <button
                type="button"
                onClick={() => setAcademicViewMode('tablas')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                  academicViewMode === 'tablas' ? 'bg-[#17324D] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Tablas / Registros</span>
              </button>
            </div>
          </div>

          {/* VISTA 1: ÁRBOL JERÁRQUICO OFICIAL */}
          {academicViewMode === 'arbol' && (
            <div className="space-y-4">
              {/* Program Selector Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { code: 'EPJA', label: 'EPJA', title: 'Jóvenes y Adultos', desc: 'EPA (Primaria) & ESA (Secundaria)', icon: GraduationCap, color: 'emerald' },
                  { code: 'ETA', label: 'ETA', title: 'Técnica Alternativa', desc: 'Carreras & Niveles Técnicos', icon: Laptop, color: 'blue' },
                  { code: 'EDUPER', label: 'EDUPER', title: 'Educación Permanente', desc: 'Cursos & Talleres Comunitarios', icon: BookOpen, color: 'amber' },
                  { code: 'CEE', label: 'CEE', title: 'Educación Especial', desc: 'Inclusión & Adaptaciones', icon: Sparkles, color: 'purple' },
                ].map(p => {
                  const isSelected = selectedTreeProgram === p.code;
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => setSelectedTreeProgram(p.code as any)}
                      className={`p-3.5 rounded-3xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[#17324D] border-[#17324D] text-white shadow-md'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          isSelected ? 'bg-white/15 text-[#FFC845]' : 'bg-slate-100 text-slate-600'
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          isSelected ? 'bg-[#00A651] text-white' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {p.code}
                        </span>
                      </div>
                      <div className="mt-2.5">
                        <h4 className={`font-extrabold text-sm ${isSelected ? 'text-white' : 'text-[#17324D]'}`}>{p.title}</h4>
                        <p className={`text-[11px] font-medium leading-snug mt-0.5 ${isSelected ? 'text-slate-200' : 'text-slate-500'}`}>{p.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* 1. SECCIÓN EPJA (EPA + ESA) */}
              {selectedTreeProgram === 'EPJA' && (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-3xl text-xs text-emerald-950 font-medium space-y-1">
                    <div className="flex items-center gap-2 font-extrabold text-emerald-900 text-sm">
                      <GraduationCap className="w-4 h-4 text-[#00A651]" />
                      <span>EPJA — Educación de Personas Jóvenes y Adultas</span>
                    </div>
                    <p>
                      Estructurada en dos subsistemas humanísticos: <strong>EPA</strong> (Educación Primaria de Adultos) y <strong>ESA</strong> (Educación Secundaria de Adultos).
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* BLOQUE EPA */}
                    <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-xl bg-emerald-100 text-[#00A651] font-black text-xs flex items-center justify-center">
                              EPA
                            </span>
                            <div>
                              <h4 className="font-extrabold text-base text-[#17324D]">Educación Primaria de Adultos</h4>
                              <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                Primaria Humanística
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* REGLA INSTITUCIONAL CLAVE */}
                        <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-2xl text-[11px] text-amber-900 font-semibold flex items-start gap-2">
                          <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                          <span>
                            <strong>Regla EPA:</strong> EPA solamente contiene hasta <strong>Aprendizajes Avanzados</strong>. NO debe contener Aplicados, Complementarios ni Especializados.
                          </span>
                        </div>

                        <div className="space-y-2.5 pt-1">
                          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-sm text-[#17324D] flex items-center gap-2">
                                <Check className="w-4 h-4 text-[#00A651]" />
                                <span>1. Aprendizajes Elementales</span>
                              </span>
                              <span className="text-[10px] font-extrabold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                                Ciclo Inicial
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium pl-6">
                              Alfabetización inicial, lectoescritura, cálculo básico y competencias primarias fundamentales.
                            </p>
                          </div>

                          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-sm text-[#17324D] flex items-center gap-2">
                                <Check className="w-4 h-4 text-[#00A651]" />
                                <span>2. Aprendizajes Avanzados</span>
                              </span>
                              <span className="text-[10px] font-extrabold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                                Culminación Primaria
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium pl-6">
                              Consolidación de saberes de primaria, comprensión lectora, ciencias y habilitación para el ingreso a Secundaria.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
                        <span>Total: 2 Etapas / Niveles oficiales</span>
                        <button
                          type="button"
                          onClick={() => handleOpenAddEtapa('EPA')}
                          className="h-8 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold flex items-center gap-1 transition-all"
                        >
                          <Plus className="w-3.5 h-3.5 text-[#00A651]" />
                          <span>Gestionar EPA</span>
                        </button>
                      </div>
                    </div>

                    {/* BLOQUE ESA */}
                    <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 font-black text-xs flex items-center justify-center">
                              ESA
                            </span>
                            <div>
                              <h4 className="font-extrabold text-base text-[#17324D]">Educación Secundaria de Adultos</h4>
                              <span className="text-[11px] text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                                Secundaria Humanística
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-2xl text-[11px] text-blue-900 font-semibold flex items-start gap-2">
                          <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                          <span>
                            <strong>Estructura ESA:</strong> Comprende de forma exclusiva los 3 ciclos de secundaria: <strong>Aplicados</strong>, <strong>Complementarios</strong> y <strong>Especializados</strong>.
                          </span>
                        </div>

                        <div className="space-y-2.5 pt-1">
                          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-sm text-[#17324D] flex items-center gap-2">
                                <Check className="w-4 h-4 text-blue-600" />
                                <span>1. Aprendizajes Aplicados</span>
                              </span>
                              <span className="text-[10px] font-extrabold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">
                                1er Ciclo Secundaria
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium pl-6">
                              Primer ciclo formativo orientado a la aplicación comunitaria y consolidación humanística.
                            </p>
                          </div>

                          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-sm text-[#17324D] flex items-center gap-2">
                                <Check className="w-4 h-4 text-blue-600" />
                                <span>2. Aprendizajes Complementarios</span>
                              </span>
                              <span className="text-[10px] font-extrabold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">
                                2do Ciclo Secundaria
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium pl-6">
                              Segundo ciclo de profundización en ciencias sociales, exactas y humanidades.
                            </p>
                          </div>

                          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-sm text-[#17324D] flex items-center gap-2">
                                <Check className="w-4 h-4 text-blue-600" />
                                <span>3. Aprendizajes Especializados</span>
                              </span>
                              <span className="text-[10px] font-extrabold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">
                                Bachillerato Humanístico
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium pl-6">
                              Ciclo culminante habilitante para el Título de Bachiller en Humanidades.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
                        <span>Total: 3 Etapas / Niveles oficiales</span>
                        <button
                          type="button"
                          onClick={() => handleOpenAddEtapa('ESA')}
                          className="h-8 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold flex items-center gap-1 transition-all"
                        >
                          <Plus className="w-3.5 h-3.5 text-[#00A651]" />
                          <span>Gestionar ESA</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. SECCIÓN ETA (CARRERAS TÉCNICAS Y NIVELES) */}
              {selectedTreeProgram === 'ETA' && (
                <div className="space-y-4">
                  {/* ALERTA DE REGLA INSTITUCIONAL ETA */}
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-3xl text-xs text-amber-950 font-medium space-y-1.5">
                    <div className="flex items-center gap-2 font-extrabold text-amber-900 text-sm">
                      <Info className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>Regla Institucional: Organización de Educación Técnica Alternativa (ETA)</span>
                    </div>
                    <p>
                      <strong>ETA NO utiliza etapas de aprendizaje</strong> como EPA o ESA. ETA trabaja exclusivamente mediante <strong>Carreras Técnicas</strong> y sus 3 niveles de certificación progresiva: <strong>Técnico Básico</strong>, <strong>Técnico Auxiliar</strong> y <strong>Técnico Medio</strong>.
                    </p>
                  </div>

                  {/* Header con botón para añadir Carrera Técnica */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-base text-[#17324D]">Carreras Técnicas Oficiales</h4>
                      <p className="text-xs text-slate-500 font-medium">Especialidades técnicas ofertadas en el CEA</p>
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenAddCarrera}
                      id="btn-add-carrera-tecnica"
                      className="h-10 px-4 bg-[#00A651] hover:bg-[#008f45] text-white font-extrabold text-xs rounded-2xl flex items-center gap-1.5 shadow-xs transition-all"
                    >
                      <Plus className="w-4 h-4 text-[#FFC845]" />
                      <span>Añadir Carrera Técnica</span>
                    </button>
                  </div>

                  {/* Carreras Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {carreras.map(c => {
                      const isSistemas = c.nombre.toLowerCase().includes('sistemas') || c.codigo === 'SIS';
                      const isGastro = c.nombre.toLowerCase().includes('gastronom') || c.codigo === 'GAS';
                      const Icon = isSistemas ? Laptop : isGastro ? Utensils : GraduationCap;

                      return (
                        <div key={c.id} className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                                  isSistemas ? 'bg-blue-100 text-blue-700' : isGastro ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  <Icon className="w-5 h-5" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-extrabold px-2 py-0.5 bg-[#17324D] text-white rounded-md">
                                      {c.codigo || 'ETA'}
                                    </span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                      c.activo ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                                    }`}>
                                      {c.activo ? 'Activa' : 'Inactiva'}
                                    </span>
                                  </div>
                                  <h4 className="font-extrabold text-base text-[#17324D] mt-0.5">{c.nombre}</h4>
                                </div>
                              </div>
                            </div>

                            <p className="text-xs text-slate-500 font-medium">
                              {c.descripcion || 'Formación técnica con titulación laboral habilitante en el Estado Plurinacional.'}
                            </p>

                            {/* 3 Niveles de la Carrera */}
                            <div className="space-y-2 pt-1">
                              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">
                                Niveles de Titulación Oficial
                              </span>

                              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-0.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-xs text-[#17324D] flex items-center gap-1.5">
                                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-extrabold flex items-center justify-center">1</span>
                                    <span>Técnico Básico</span>
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                                    Nivel Inicial
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 pl-6.5">Operación básica, fundamentos técnicos y competencias iniciales.</p>
                              </div>

                              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-0.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-xs text-[#17324D] flex items-center gap-1.5">
                                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-extrabold flex items-center justify-center">2</span>
                                    <span>Técnico Auxiliar</span>
                                  </span>
                                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                                    Nivel Intermedio
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 pl-6.5">Especialización práctica intermedia y ejecución de procedimientos.</p>
                              </div>

                              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-0.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-xs text-[#17324D] flex items-center gap-1.5">
                                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center justify-center">3</span>
                                    <span>Técnico Medio</span>
                                  </span>
                                  <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300">
                                    Título Profesional
                                  </span>
                                </div>
                                <p className="text-[11px] text-emerald-700/80 pl-6.5 font-medium">
                                  Grado profesional habilitante con resolución ministerial y título técnico.
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenEditCarrera(c)}
                              className="flex-1 h-9 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition-all"
                            >
                              <Pencil className="w-3.5 h-3.5 text-[#00A651]" />
                              <span>Editar Carrera</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleCarreraActive(c.id)}
                              className={`px-3 h-9 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all ${
                                c.activo
                                  ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-[#00A651] border border-emerald-200'
                              }`}
                            >
                              <Power className="w-3.5 h-3.5" />
                              <span>{c.activo ? 'Desactivar' : 'Activar'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. SECCIÓN EDUPER */}
              {selectedTreeProgram === 'EDUPER' && (
                <div className="space-y-4">
                  <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-3xl text-xs text-amber-950 font-medium space-y-1">
                    <div className="flex items-center gap-2 font-extrabold text-amber-900 text-sm">
                      <BookOpen className="w-4 h-4 text-amber-700" />
                      <span>EDUPER — Educación Permanente</span>
                    </div>
                    <p>
                      Maneja procesos formativos comunitarios no escolarizados, cursos cortos de capacitación y talleres continuos para el desarrollo productivo y comunitario.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 font-extrabold text-xs flex items-center justify-center">
                        1
                      </div>
                      <h4 className="font-extrabold text-sm text-[#17324D]">Cursos de Capacitación</h4>
                      <p className="text-xs text-slate-500 font-medium">Cursos modulares y específicos orientados a habilidades técnicas y laborales rápidas.</p>
                    </div>

                    <div className="p-4 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 font-extrabold text-xs flex items-center justify-center">
                        2
                      </div>
                      <h4 className="font-extrabold text-sm text-[#17324D]">Talleres Comunitarios</h4>
                      <p className="text-xs text-slate-500 font-medium">Espacios de formación práctica vivencial con participación de organizaciones sociales.</p>
                    </div>

                    <div className="p-4 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 font-extrabold text-xs flex items-center justify-center">
                        3
                      </div>
                      <h4 className="font-extrabold text-sm text-[#17324D]">Procesos Formativos</h4>
                      <p className="text-xs text-slate-500 font-medium">Programas permanentes de fortalecimiento sociocomunitario y productivo.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. SECCIÓN CEE */}
              {selectedTreeProgram === 'CEE' && (
                <div className="space-y-4">
                  <div className="p-4 bg-purple-50/80 border border-purple-200 rounded-3xl text-xs text-purple-950 font-medium space-y-1">
                    <div className="flex items-center gap-2 font-extrabold text-purple-900 text-sm">
                      <Sparkles className="w-4 h-4 text-purple-700" />
                      <span>CEE — Educación Especial</span>
                    </div>
                    <p>
                      Atención educativa integral e inclusiva dirigida a personas con discapacidad, dificultades en el aprendizaje o talento extraordinario en modalidad directa e indirecta.
                    </p>
                  </div>

                  <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
                    <h4 className="font-extrabold text-base text-[#17324D]">Modalidad y Adaptaciones Curriculares</h4>
                    <p className="text-xs text-slate-600 font-medium">
                      El Centro de Educación Alternativa implementa adaptaciones no significativas y significativas, garantizando el acceso a la formación técnica y humanística inclusiva con acompañamiento psicopedagógico.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VISTA 2: TABLAS Y REGISTROS DE BASE DE DATOS */}
          {academicViewMode === 'tablas' && (
            <div className="space-y-4">
              {/* Sub-selector for Database Tables */}
              <div className="flex flex-wrap bg-slate-100 p-1 rounded-2xl border border-slate-200 gap-1">
                {[
                  { key: 'programas', label: `Programas (${programas.length})`, icon: GraduationCap },
                  { key: 'subprogramas', label: `Subprogramas (${subprogramas.length})`, icon: FolderTree },
                  { key: 'carreras', label: `Carreras Técnicas (${carreras.length})`, icon: Laptop },
                  { key: 'etapas', label: `Etapas (${etapas.length})`, icon: BookOpen },
                  { key: 'niveles', label: `Niveles (${niveles.length})`, icon: Layers },
                ].map(tab => {
                  const Icon = tab.icon;
                  const isActive = academicCategory === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setAcademicCategory(tab.key as any)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                        isActive ? 'bg-[#17324D] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* TABLA PROGRAMAS */}
              {academicCategory === 'programas' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-base text-[#17324D]">Programas Principales</h4>
                      <p className="text-xs text-slate-500 font-medium">EPJA, ETA, EDUPER, CEE</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenAddPrograma}
                      className="h-9 px-3 bg-[#00A651] text-white font-extrabold text-xs rounded-xl flex items-center gap-1 shadow-xs"
                    >
                      <Plus className="w-4 h-4 text-[#FFC845]" />
                      <span>Nuevo Programa</span>
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
                            type="button"
                            onClick={() => handleOpenEditPrograma(p)}
                            className="flex-1 h-9 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition-all"
                          >
                            <Pencil className="w-3.5 h-3.5 text-[#00A651]" />
                            <span>Editar</span>
                          </button>

                          <button
                            type="button"
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

              {/* TABLA SUBPROGRAMAS */}
              {academicCategory === 'subprogramas' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-base text-[#17324D]">Subprogramas (EPA, ESA)</h4>
                      <p className="text-xs text-slate-500 font-medium">Divisiones humanísticas de EPJA</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenAddSubprograma('EPJA')}
                      className="h-9 px-3 bg-[#00A651] text-white font-extrabold text-xs rounded-xl flex items-center gap-1 shadow-xs"
                    >
                      <Plus className="w-4 h-4 text-[#FFC845]" />
                      <span>Nuevo Subprograma</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {subprogramas.map(s => (
                      <div key={s.id} className="p-4 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="bg-emerald-100 text-emerald-900 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-200">
                              {s.codigo} • Programa: {s.programa_codigo || 'EPJA'}
                            </span>
                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                              s.activo ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-500 border-slate-300'
                            }`}>
                              {s.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </div>
                          <h4 className="font-extrabold text-base text-[#17324D]">{s.nombre}</h4>
                          <p className="text-xs text-slate-500 font-medium">{s.descripcion || 'Sin descripción'}</p>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => handleOpenEditSubprograma(s)}
                            className="flex-1 h-9 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition-all"
                          >
                            <Pencil className="w-3.5 h-3.5 text-[#00A651]" />
                            <span>Editar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleSubprogramaActive(s.id)}
                            className={`px-3 h-9 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all ${
                              s.activo
                                ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-[#00A651] border border-emerald-200'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                            <span>{s.activo ? 'Desactivar' : 'Activar'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TABLA CARRERAS TECNICAS */}
              {academicCategory === 'carreras' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-base text-[#17324D]">Carreras Técnicas de ETA</h4>
                      <p className="text-xs text-slate-500 font-medium">Sistemas Informáticos, Gastronomía, etc.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenAddCarrera}
                      className="h-9 px-3 bg-[#00A651] text-white font-extrabold text-xs rounded-xl flex items-center gap-1 shadow-xs"
                    >
                      <Plus className="w-4 h-4 text-[#FFC845]" />
                      <span>Nueva Carrera</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {carreras.map(c => (
                      <div key={c.id} className="p-4 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="bg-blue-100 text-blue-900 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border border-blue-200">
                              ETA • {c.codigo || 'TÉCNICA'}
                            </span>
                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                              c.activo ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-500 border-slate-300'
                            }`}>
                              {c.activo ? 'Activa' : 'Inactiva'}
                            </span>
                          </div>
                          <h4 className="font-extrabold text-base text-[#17324D]">{c.nombre}</h4>
                          <p className="text-xs text-slate-500 font-medium">{c.descripcion || 'Sin descripción'}</p>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => handleOpenEditCarrera(c)}
                            className="flex-1 h-9 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition-all"
                          >
                            <Pencil className="w-3.5 h-3.5 text-[#00A651]" />
                            <span>Editar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleCarreraActive(c.id)}
                            className={`px-3 h-9 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all ${
                              c.activo
                                ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-[#00A651] border border-emerald-200'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                            <span>{c.activo ? 'Desactivar' : 'Activar'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TABLA ETAPAS */}
              {academicCategory === 'etapas' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-base text-[#17324D]">Etapas de Aprendizaje</h4>
                      <p className="text-xs text-slate-500 font-medium">Elementales, Avanzados, Aplicados, Complementarios, Especializados</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenAddEtapa('EPA')}
                      className="h-9 px-3 bg-[#00A651] text-white font-extrabold text-xs rounded-xl flex items-center gap-1 shadow-xs"
                    >
                      <Plus className="w-4 h-4 text-[#FFC845]" />
                      <span>Nueva Etapa</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {etapas.map(e => (
                      <div key={e.id} className="p-4 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="bg-indigo-100 text-indigo-900 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-indigo-200">
                              {e.subprograma_codigo ? `Subprog: ${e.subprograma_codigo}` : `Prog: ${e.programa_codigo || 'EPJA'}`}
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
                            type="button"
                            onClick={() => handleOpenEditEtapa(e)}
                            className="flex-1 h-9 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition-all"
                          >
                            <Pencil className="w-3.5 h-3.5 text-[#00A651]" />
                            <span>Editar</span>
                          </button>

                          <button
                            type="button"
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

              {/* TABLA NIVELES */}
              {academicCategory === 'niveles' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-base text-[#17324D]">Niveles Educativos y de Titulación</h4>
                      <p className="text-xs text-slate-500 font-medium">Niveles EPA/ESA y Técnico Básico, Auxiliar, Medio de ETA</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenAddNivel()}
                      className="h-9 px-3 bg-[#00A651] text-white font-extrabold text-xs rounded-xl flex items-center gap-1 shadow-xs"
                    >
                      <Plus className="w-4 h-4 text-[#FFC845]" />
                      <span>Nuevo Nivel</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {niveles.map(n => (
                      <div key={n.id} className="p-4 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="bg-emerald-50 text-emerald-900 border border-emerald-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                              {n.carrera_nombre ? `Carrera: ${n.carrera_nombre}` : n.subprograma_codigo ? `Subprog: ${n.subprograma_codigo}` : n.programa_codigo || 'EPJA'}
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
                            type="button"
                            onClick={() => handleOpenEditNivel(n)}
                            className="flex-1 h-9 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition-all"
                          >
                            <Pencil className="w-3.5 h-3.5 text-[#00A651]" />
                            <span>Editar</span>
                          </button>

                          <button
                            type="button"
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
        </div>
      )}

      {/* HORARIOS ADMIN */}
      {activeAdminSubTab === 'horarios' && (
        <div className="space-y-4">
          {/* Institutional Season Control Banner */}
          <div className="p-5 bg-gradient-to-r from-slate-900 via-[#17324D] to-slate-900 rounded-3xl text-white shadow-md space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-400 block">
                  Temporada Institucional Activa
                </span>
                <h4 className="text-lg font-black mt-0.5 flex items-center gap-2">
                  {temporadaInstitucional === 'invierno' ? (
                    <>
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse"></span>
                      <span>Horario de Invierno Vigente</span>
                    </>
                  ) : (
                    <>
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                      <span>Horario Regular / Verano Vigente</span>
                    </>
                  )}
                </h4>
                <p className="text-xs text-slate-300 mt-1 max-w-xl">
                  {temporadaInstitucional === 'invierno'
                    ? 'Todas las sedes aplican salida anticipada (-30 min) según normativa EPJA. Poroma: 21:30, San Juan: 20:00.'
                    : 'Todas las sedes aplican su turno regular completo. Poroma: 22:00, San Juan: 20:30.'}
                </p>
              </div>

              {/* Season Switch Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleCambiarTemporadaInstitucional('invierno')}
                  disabled={isChangingTemporada || temporadaInstitucional === 'invierno'}
                  className={`h-10 px-4 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                    temporadaInstitucional === 'invierno'
                      ? 'bg-blue-500 text-white shadow-inner cursor-default opacity-90'
                      : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Activar Invierno (Institucional)</span>
                </button>
                <button
                  onClick={() => handleCambiarTemporadaInstitucional('verano')}
                  disabled={isChangingTemporada || temporadaInstitucional === 'verano'}
                  className={`h-10 px-4 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                    temporadaInstitucional === 'verano'
                      ? 'bg-emerald-600 text-white shadow-inner cursor-default opacity-90'
                      : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Restablecer Verano (Regular)</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-base text-[#17324D]">Horarios Institucionales</h3>
              <p className="text-xs text-slate-500 font-medium">Gestión de horarios por sede, temporada y días aplicables</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchHorarios}
                disabled={loadingHorarios}
                className="h-9 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1 transition-all disabled:opacity-50"
                title="Recargar horarios desde Supabase"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${loadingHorarios ? 'animate-spin' : ''}`} />
                <span>Actualizar</span>
              </button>
              <button
                onClick={handleOpenCreateHorario}
                className="h-9 px-3 bg-[#00A651] hover:bg-[#008f45] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition-all"
              >
                <Plus className="w-4 h-4" /> <span>Nuevo Horario</span>
              </button>
            </div>
          </div>

          {horariosError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{horariosError}</span>
            </div>
          )}

          {loadingHorarios ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <RefreshCw className="w-8 h-8 text-[#00A651] animate-spin mx-auto" />
              <p className="text-xs font-bold">Cargando horarios de Supabase...</p>
            </div>
          ) : horarios.length === 0 ? (
            <div className="p-10 text-center text-slate-500 bg-white rounded-3xl border border-slate-200 space-y-2">
              <Clock className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="font-bold text-sm text-slate-700">No hay horarios registrados.</p>
              <p className="text-xs text-slate-400">
                Haga clic en "+ Nuevo Horario" para crear la primera configuración de horario por sede.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Tabla de Horarios Institucionales */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/75 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                        <th className="py-3 px-4">Sede</th>
                        <th className="py-3 px-4">Nombre / Horario</th>
                        <th className="py-3 px-3 text-center">Temporada</th>
                        <th className="py-3 px-3">Días Aplicables</th>
                        <th className="py-3 px-3 text-center">Ingreso</th>
                        <th className="py-3 px-3 text-center">Tolerancia</th>
                        <th className="py-3 px-3 text-center">Salida</th>
                        <th className="py-3 px-3 text-center">Estado</th>
                        <th className="py-3 px-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {horarios.map(h => {
                        const diasText = Array.isArray(h.dias_semana) && h.dias_semana.length > 0
                          ? h.dias_semana.map(d => d.slice(0, 3).toUpperCase()).join(', ')
                          : 'Lun-Vie';

                        return (
                          <tr key={h.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3.5 px-4 font-bold text-[#17324D] whitespace-nowrap">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-slate-100 text-slate-800 border border-slate-200">
                                {h.sede_nombre || 'Sede General'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-bold text-slate-900">
                              {h.nombre}
                            </td>
                            <td className="py-3.5 px-3 text-center whitespace-nowrap">
                              {h.es_invierno ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-900 border border-blue-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                  Invierno
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-900 border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  Regular
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-3 whitespace-nowrap">
                              <span className="font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                                {diasText}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-center whitespace-nowrap font-black text-[#00A651]">
                              {h.hora_ingreso}
                            </td>
                            <td className="py-3.5 px-3 text-center whitespace-nowrap font-bold text-slate-600">
                              {h.tolerancia_hasta}
                            </td>
                            <td className="py-3.5 px-3 text-center whitespace-nowrap font-black text-[#17324D]">
                              {h.hora_salida}
                            </td>
                            <td className="py-3.5 px-3 text-center whitespace-nowrap">
                              {h.activo !== false ? (
                                <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                  Activo
                                </span>
                              ) : (
                                <span className="text-[10px] font-extrabold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                  Inactivo
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditHorario(h)}
                                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                                  title="Editar Horario"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteHorario(h.id)}
                                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Eliminar Horario"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
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

      {/* CALENDARIO LABORAL (DÍAS EFECTIVOS) */}
      {activeAdminSubTab === 'calendario' && <WorkCalendarConfig user={user} />}

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

      {/* MODAL SUBPROGRAMAS (EPA, ESA) */}
      {isSubprogramaModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-lg text-[#17324D]">
                {editingSubprograma ? 'Editar Subprograma' : 'Añadir Nuevo Subprograma'}
              </h3>
              <button
                type="button"
                onClick={() => setIsSubprogramaModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubprograma} className="space-y-3 text-xs font-bold">
              <div>
                <label className="block text-slate-700 mb-1">Código / Sigla *</label>
                <input
                  type="text"
                  placeholder="Ej. EPA, ESA"
                  value={subprogForm.codigo}
                  onChange={e => setSubprogForm({ ...subprogForm, codigo: e.target.value })}
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none uppercase font-extrabold text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Nombre Oficial del Subprograma *</label>
                <input
                  type="text"
                  placeholder="Ej. Educación Primaria de Adultos"
                  value={subprogForm.nombre}
                  onChange={e => setSubprogForm({ ...subprogForm, nombre: e.target.value })}
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Programa Padre</label>
                <select
                  value={subprogForm.programa_codigo}
                  onChange={e => setSubprogForm({ ...subprogForm, programa_codigo: e.target.value })}
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium text-slate-900"
                >
                  <option value="EPJA">EPJA – Educación de Personas Jóvenes y Adultas</option>
                  {programas.filter(p => p.codigo !== 'EPJA').map(p => (
                    <option key={p.id} value={p.codigo}>{p.codigo} – {p.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Descripción</label>
                <textarea
                  placeholder="Alcance del subprograma..."
                  value={subprogForm.descripcion}
                  onChange={e => setSubprogForm({ ...subprogForm, descripcion: e.target.value })}
                  className="w-full h-20 p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium text-slate-900 resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSubprogramaModalOpen(false)}
                  className="h-11 px-4 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-11 px-5 bg-[#00A651] hover:bg-[#008f45] text-white font-extrabold rounded-xl shadow-xs"
                >
                  Guardar Subprograma
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CARRERAS TÉCNICAS (ETA) */}
      {isCarreraModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-lg text-[#17324D]">
                {editingCarrera ? 'Editar Carrera Técnica' : 'Añadir Carrera Técnica a ETA'}
              </h3>
              <button
                type="button"
                onClick={() => setIsCarreraModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCarrera} className="space-y-3 text-xs font-bold">
              <div>
                <label className="block text-slate-700 mb-1">Nombre de la Especialidad / Carrera *</label>
                <input
                  type="text"
                  placeholder="Ej. Sistemas Informáticos, Gastronomía..."
                  value={carreraForm.nombre}
                  onChange={e => setCarreraForm({ ...carreraForm, nombre: e.target.value })}
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Código / Sigla Técnica</label>
                <input
                  type="text"
                  placeholder="Ej. SIS, GAS, BEL, ELE"
                  value={carreraForm.codigo}
                  onChange={e => setCarreraForm({ ...carreraForm, codigo: e.target.value })}
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none uppercase font-extrabold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Descripción de la Carrera</label>
                <textarea
                  placeholder="Perfil profesional y formación técnica de la especialidad..."
                  value={carreraForm.descripcion}
                  onChange={e => setCarreraForm({ ...carreraForm, descripcion: e.target.value })}
                  className="w-full h-20 p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium text-slate-900 resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCarreraModalOpen(false)}
                  className="h-11 px-4 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-11 px-5 bg-[#00A651] hover:bg-[#008f45] text-white font-extrabold rounded-xl shadow-xs"
                >
                  Guardar Carrera
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
                type="button"
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
                  placeholder="Ej. Aprendizajes Elementales, Avanzados, Aplicados..."
                  value={etapaForm.nombre}
                  onChange={e => setEtapaForm({ ...etapaForm, nombre: e.target.value })}
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium text-slate-900"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 mb-1">Programa</label>
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
                  <label className="block text-slate-700 mb-1">Subprograma</label>
                  <select
                    value={etapaForm.subprograma_codigo}
                    onChange={e => setEtapaForm({ ...etapaForm, subprograma_codigo: e.target.value })}
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium text-slate-900"
                  >
                    <option value="">(Ninguno)</option>
                    <option value="EPA">EPA – Primaria Adultos</option>
                    <option value="ESA">ESA – Secundaria Adultos</option>
                  </select>
                </div>
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
                type="button"
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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 mb-1">Programa</label>
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
                  <label className="block text-slate-700 mb-1">Subprograma</label>
                  <select
                    value={nivelForm.subprograma_codigo}
                    onChange={e => setNivelForm({ ...nivelForm, subprograma_codigo: e.target.value })}
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium text-slate-900"
                  >
                    <option value="">(Ninguno)</option>
                    <option value="EPA">EPA – Primaria Adultos</option>
                    <option value="ESA">ESA – Secundaria Adultos</option>
                  </select>
                </div>
              </div>

              {nivelForm.programa_codigo === 'ETA' && (
                <div>
                  <label className="block text-slate-700 mb-1">Carrera Técnica (ETA)</label>
                  <select
                    value={nivelForm.carrera_nombre}
                    onChange={e => setNivelForm({ ...nivelForm, carrera_nombre: e.target.value })}
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium text-slate-900"
                  >
                    <option value="">(Nivel Técnico General)</option>
                    {carreras.map(c => (
                      <option key={c.id} value={c.nombre}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-700 mb-1">Etapa Referencial</label>
                <input
                  type="text"
                  placeholder="Ej. Aprendizajes Elementales, Ciclo Técnico..."
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

      {/* MODAL CREAR / EDITAR HORARIO */}
      {isHorarioModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4 my-8 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-[#00A651]">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">
                    {editingHorario ? 'Editar Horario Institucional' : 'Nuevo Horario Institucional'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Configuración de turnos y días aplicables</p>
                </div>
              </div>
              <button
                onClick={() => setIsHorarioModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {horarioModalError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{horarioModalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveHorario} className="space-y-4 text-xs font-semibold">
              {/* Sede */}
              <div>
                <label className="block text-slate-700 mb-1">Sede Educativa *</label>
                <select
                  value={horarioForm.sede_id}
                  onChange={e => setHorarioForm({ ...horarioForm, sede_id: e.target.value })}
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-bold text-slate-900"
                  required
                >
                  <option value="">Seleccione una sede...</option>
                  {sedes.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Nombre */}
              <div>
                <label className="block text-slate-700 mb-1">Nombre / Identificador del Horario *</label>
                <input
                  type="text"
                  placeholder="Ej. Poroma - Turno Noche (Regular)"
                  value={horarioForm.nombre}
                  onChange={e => setHorarioForm({ ...horarioForm, nombre: e.target.value })}
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-bold text-slate-900"
                  required
                />
              </div>

              {/* Temporada (Regular o Invierno) */}
              <div>
                <label className="block text-slate-700 mb-1">Temporada del Horario *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setHorarioForm({ ...horarioForm, es_invierno: false })}
                    className={`h-10 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                      !horarioForm.es_invierno
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <span>Regular / Verano</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHorarioForm({ ...horarioForm, es_invierno: true })}
                    className={`h-10 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                      horarioForm.es_invierno
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <span>Horario de Invierno</span>
                  </button>
                </div>
              </div>

              {/* Días de la semana */}
              <div>
                <label className="block text-slate-700 mb-1.5">Días Aplicables *</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: 'lunes', label: 'Lunes' },
                    { key: 'martes', label: 'Martes' },
                    { key: 'miércoles', label: 'Miércoles' },
                    { key: 'jueves', label: 'Jueves' },
                    { key: 'viernes', label: 'Viernes' },
                    { key: 'sábado', label: 'Sábado' },
                    { key: 'domingo', label: 'Domingo' },
                  ].map(d => {
                    const isSelected = (horarioForm.dias_semana || []).includes(d.key);
                    return (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() => handleToggleDiaSemana(d.key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          isSelected
                            ? 'bg-[#17324D] text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tiempos: Ingreso, Tolerancia, Salida */}
              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <label className="block text-slate-600 text-[10px] uppercase font-bold mb-1">Hora Ingreso *</label>
                  <input
                    type="time"
                    value={horarioForm.hora_ingreso}
                    onChange={e => setHorarioForm({ ...horarioForm, hora_ingreso: e.target.value })}
                    className="w-full h-10 px-2 bg-white border border-slate-300 rounded-xl outline-none font-black text-[#00A651] text-center"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-600 text-[10px] uppercase font-bold mb-1">Tolerancia *</label>
                  <input
                    type="time"
                    value={horarioForm.tolerancia_hasta}
                    onChange={e => setHorarioForm({ ...horarioForm, tolerancia_hasta: e.target.value })}
                    className="w-full h-10 px-2 bg-white border border-slate-300 rounded-xl outline-none font-bold text-slate-700 text-center"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-600 text-[10px] uppercase font-bold mb-1">Hora Salida *</label>
                  <input
                    type="time"
                    value={horarioForm.hora_salida}
                    onChange={e => setHorarioForm({ ...horarioForm, hora_salida: e.target.value })}
                    className="w-full h-10 px-2 bg-white border border-slate-300 rounded-xl outline-none font-black text-[#17324D] text-center"
                    required
                  />
                </div>
              </div>

              {/* Estado */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="horarioActivoCheck"
                  checked={horarioForm.activo}
                  onChange={e => setHorarioForm({ ...horarioForm, activo: e.target.checked })}
                  className="w-4 h-4 rounded-md text-[#00A651] accent-[#00A651] cursor-pointer"
                />
                <label htmlFor="horarioActivoCheck" className="text-slate-700 text-xs font-bold cursor-pointer">
                  Horario activo para asignaciones y cálculo de asistencia
                </label>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsHorarioModalOpen(false)}
                  disabled={isSavingHorario}
                  className="h-11 px-4 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingHorario}
                  className="h-11 px-5 bg-[#00A651] hover:bg-[#008f45] text-white font-extrabold rounded-xl shadow-xs transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isSavingHorario ? 'Guardando...' : editingHorario ? 'Guardar Cambios' : 'Crear Horario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
