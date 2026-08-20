import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  Upload,
  Plus,
  FileSpreadsheet,
  Search,
  CheckSquare,
  Sparkles,
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from 'lucide-react';
import { Perfil, Estudiante, Grupo, AsistenciaEstudiante } from '../types';
import { saveOfflineEstudianteAsistencia } from '../lib/db';
import { downloadStudentEnrollmentReport } from '../lib/excelExport';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface StudentsViewProps {
  user: Perfil;
  isOnline: boolean;
  onOpenAddStudentModal: () => void;
}

interface SesionHistorialItem {
  id: string;
  fecha: string;
  materia: string;
  grupo_id: string;
  grupo_nombre: string;
  presentes: number;
  atrasos: number;
  faltas: number;
  licencias: number;
  total: number;
  porcentaje: number;
  detalles: Array<{
    id: string;
    estudiante_id: string;
    nombre_completo: string;
    codigo_interno?: string;
    estado: 'presente' | 'atraso' | 'falta' | 'licencia';
  }>;
}

export const StudentsView: React.FC<StudentsViewProps> = ({
  user,
  isOnline,
  onOpenAddStudentModal
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'asistencia' | 'nomina' | 'historial'>(
    user.rol === 'superadmin' ? 'nomina' : 'asistencia'
  );

  // Attendance Form State
  const [assignedGroups, setAssignedGroups] = useState<Array<{ id: string; nombre: string; materia: string }>>([]);
  const [loadingGrupos, setLoadingGrupos] = useState<boolean>(false);
  const [gruposError, setGruposError] = useState<string | null>(null);

  const [selectedGrupoId, setSelectedGrupoId] = useState<string>('');
  const [fechaClase, setFechaClase] = useState<string>(new Date().toISOString().slice(0, 10));
  const [materiaClase, setMateriaClase] = useState<string>('');

  // Attendance Students State (real from Supabase)
  const [asistenciaStudents, setAsistenciaStudents] = useState<Estudiante[]>([]);
  const [loadingStudents, setLoadingStudents] = useState<boolean>(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  
  // Local Attendance Marking Map: studentId -> 'presente' | 'atraso' | 'falta' | 'licencia'
  const [attendanceMap, setAttendanceMap] = useState<Record<string, 'presente' | 'atraso' | 'falta' | 'licencia'>>({});
  
  const [attendanceSaved, setAttendanceSaved] = useState<boolean>(false);
  const [savedGroupPercent, setSavedGroupPercent] = useState<number | null>(null);
  const [savedMode, setSavedMode] = useState<'cloud' | 'offline'>('cloud');
  const [savingAttendance, setSavingAttendance] = useState<boolean>(false);
  const [saveAttendanceError, setSaveAttendanceError] = useState<string | null>(null);

  // Student Search
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Nomina Real State from Supabase
  const [nominaStudents, setNominaStudents] = useState<Estudiante[]>([]);
  const [loadingNomina, setLoadingNomina] = useState<boolean>(false);
  const [nominaError, setNominaError] = useState<string | null>(null);

  // Historial State from Supabase (Only for authenticated teacher: docente_id = user.id)
  const [historialSesiones, setHistorialSesiones] = useState<SesionHistorialItem[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState<boolean>(false);
  const [historialError, setHistorialError] = useState<string | null>(null);
  const [expandedSessionIds, setExpandedSessionIds] = useState<Set<string>>(new Set());

  // 1. Cargar grupos asignados al docente autenticado
  const fetchAssignedGroups = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setGruposError('Supabase no está configurado.');
      setAssignedGroups([]);
      return;
    }

    setLoadingGrupos(true);
    setGruposError(null);
    try {
      const { data, error } = await supabase
        .from('asignaciones_docentes')
        .select(`
          id,
          docente_id,
          grupo_id,
          materia,
          grupos (
            id,
            nombre,
            carrera_especialidad,
            nivel,
            activo,
            sede_id
          )
        `)
        .eq('docente_id', user.id);

      if (error) {
        throw error;
      }

      const list: Array<{ id: string; nombre: string; materia: string }> = [];
      const seen = new Set<string>();

      (data || []).forEach((asig: any) => {
        const g = asig.grupos;
        if (g && g.activo !== false && !seen.has(g.id)) {
          seen.add(g.id);
          list.push({
            id: g.id,
            nombre: g.nombre,
            materia: asig.materia || g.carrera_especialidad || 'Docencia General'
          });
        }
      });

      setAssignedGroups(list);

      if (list.length > 0) {
        setSelectedGrupoId(prev => {
          const exists = list.some(g => g.id === prev);
          const nextId = exists ? prev : list[0].id;
          const currentG = list.find(g => g.id === nextId);
          if (currentG) {
            setMateriaClase(currentG.materia);
          }
          return nextId;
        });
      } else {
        setSelectedGrupoId('');
        setAsistenciaStudents([]);
      }
    } catch (err: any) {
      console.error('Error al cargar grupos asignados desde Supabase:', err);
      setGruposError(err.message || 'Error al consultar asignaciones del docente en Supabase.');
      setAssignedGroups([]);
    } finally {
      setLoadingGrupos(false);
    }
  };

  // 2. Cargar estudiantes reales del grupo seleccionado
  const fetchStudentsForGroup = async (grupoId: string, customFecha?: string, customMateria?: string) => {
    if (!grupoId) {
      setAsistenciaStudents([]);
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      setStudentsError('Supabase no está configurado.');
      setAsistenciaStudents([]);
      return;
    }

    setLoadingStudents(true);
    setStudentsError(null);
    setSaveAttendanceError(null);
    try {
      const { data, error } = await supabase
        .from('estudiantes')
        .select(`
          id,
          codigo_interno,
          nombre_completo,
          documento,
          programa_id,
          sede_id,
          carrera_especialidad,
          nivel,
          grupo_id,
          estado,
          fecha_inscripcion
        `)
        .eq('grupo_id', grupoId)
        .eq('estado', 'activo')
        .order('nombre_completo', { ascending: true });

      if (error) {
        throw error;
      }

      const mapped: Estudiante[] = (data || []).map((st: any) => ({
        id: st.id,
        codigo_interno: st.codigo_interno || `EST-${st.id.slice(0, 6)}`,
        nombre_completo: st.nombre_completo,
        documento: st.documento || undefined,
        fecha_inscripcion: st.fecha_inscripcion || new Date().toISOString().slice(0, 10),
        programa_id: st.programa_id,
        sede_id: st.sede_id,
        carrera_especialidad: st.carrera_especialidad,
        nivel: st.nivel,
        grupo_id: st.grupo_id,
        estado: st.estado || 'activo',
      }));

      setAsistenciaStudents(mapped);

      // Inicializar mapa de asistencia por defecto en 'presente'
      const initialMap: Record<string, 'presente' | 'atraso' | 'falta' | 'licencia'> = {};
      mapped.forEach(st => {
        initialMap[st.id] = 'presente';
      });

      // Si existe una sesión previa guardada para esta fecha y materia, precargar estados reales
      const targetFecha = customFecha || fechaClase;
      const targetMateria = (customMateria !== undefined ? customMateria : materiaClase).trim();

      if (targetFecha && targetMateria) {
        const { data: sesionData } = await supabase
          .from('sesiones_clase')
          .select('id, asistencias_estudiantes(estudiante_id, estado)')
          .eq('grupo_id', grupoId)
          .eq('fecha', targetFecha)
          .eq('materia', targetMateria)
          .maybeSingle();

        if (sesionData && Array.isArray((sesionData as any).asistencias_estudiantes)) {
          (sesionData as any).asistencias_estudiantes.forEach((a: any) => {
            if (a.estudiante_id && a.estado) {
              initialMap[a.estudiante_id] = a.estado;
            }
          });
        }
      }

      setAttendanceMap(initialMap);
    } catch (err: any) {
      console.error('Error al cargar estudiantes del grupo desde Supabase:', err);
      setStudentsError(err.message || 'Error al consultar estudiantes en Supabase.');
      setAsistenciaStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  };

  // 3. Cargar nómina general
  const fetchNomina = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setNominaError('Supabase no está configurado.');
      setNominaStudents([]);
      return;
    }

    setLoadingNomina(true);
    setNominaError(null);
    try {
      const { data, error } = await supabase
        .from('estudiantes')
        .select(`
          id,
          codigo_interno,
          nombre_completo,
          documento,
          programa_id,
          sede_id,
          carrera_especialidad,
          nivel,
          grupo_id,
          estado,
          fecha_inscripcion,
          grupos (
            id,
            nombre
          ),
          sedes (
            id,
            nombre
          )
        `)
        .order('nombre_completo', { ascending: true });

      if (error) {
        throw error;
      }

      const mapped: Estudiante[] = (data || []).map((st: any) => ({
        id: st.id,
        codigo_interno: st.codigo_interno || `EST-${st.id.slice(0, 6)}`,
        nombre_completo: st.nombre_completo,
        documento: st.documento || undefined,
        fecha_inscripcion: st.fecha_inscripcion || new Date().toISOString().slice(0, 10),
        programa_id: st.programa_id,
        sede_id: st.sede_id,
        carrera_especialidad: st.carrera_especialidad,
        nivel: st.nivel,
        grupo_id: st.grupo_id,
        estado: st.estado || 'activo',
        grupo_nombre: st.grupos?.nombre || undefined,
        sede_nombre: st.sedes?.nombre || undefined,
        programa_nombre: st.carrera_especialidad || 'EPJA'
      }));

      setNominaStudents(mapped);
    } catch (err: any) {
      console.error('Error al cargar la nómina de estudiantes desde Supabase:', err);
      setNominaError(err.message || 'Error al consultar nómina en Supabase.');
      setNominaStudents([]);
    } finally {
      setLoadingNomina(false);
    }
  };

  // 4. Cargar historial real de sesiones de clase del docente autenticado
  const fetchHistorialSesiones = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setHistorialSesiones([]);
      setLoadingHistorial(false);
      return;
    }

    setLoadingHistorial(true);
    setHistorialError(null);

    try {
      const { data, error } = await supabase
        .from('sesiones_clase')
        .select(`
          id,
          fecha,
          materia,
          grupo_id,
          created_at,
          grupos (
            id,
            nombre
          ),
          asistencias_estudiantes (
            id,
            estado,
            estudiante_id,
            estudiantes (
              id,
              nombre_completo,
              codigo_interno
            )
          )
        `)
        .eq('docente_id', user.id)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Garantizar estricta unicidad: exactamente UNA tarjeta por sesiones_clase.id
      const sessionMap = new Map<string, SesionHistorialItem>();

      (data || []).forEach((s: any) => {
        if (!s || !s.id || sessionMap.has(s.id)) {
          return;
        }

        const grupoNombre = s.grupos?.nombre || 'Grupo sin nombre';
        const rawAsistencias = Array.isArray(s.asistencias_estudiantes)
          ? s.asistencias_estudiantes
          : [];

        if (rawAsistencias.length === 0) {
          return;
        }

        // Deduplicar estudiantes por estudiante_id dentro de la sesión para métricas exactas
        const seenStudents = new Set<string>();
        let presentes = 0;
        let atrasos = 0;
        let faltas = 0;
        let licencias = 0;
        const detalles: Array<{
          id: string;
          estudiante_id: string;
          nombre_completo: string;
          codigo_interno?: string;
          estado: 'presente' | 'atraso' | 'falta' | 'licencia';
        }> = [];

        rawAsistencias.forEach((a: any) => {
          const estKey = a.estudiante_id || a.id;
          if (!estKey || seenStudents.has(estKey)) return;
          seenStudents.add(estKey);

          const estado = a.estado as 'presente' | 'atraso' | 'falta' | 'licencia';
          if (estado === 'presente') presentes++;
          else if (estado === 'atraso') atrasos++;
          else if (estado === 'falta') faltas++;
          else if (estado === 'licencia') licencias++;

          detalles.push({
            id: a.id,
            estudiante_id: a.estudiante_id,
            nombre_completo: a.estudiantes?.nombre_completo || 'Estudiante',
            codigo_interno: a.estudiantes?.codigo_interno || undefined,
            estado
          });
        });

        // Ordenar detalles alfabéticamente por nombre de estudiante
        detalles.sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));

        const total = detalles.length;
        const porcentaje = total > 0 ? Math.round(((presentes + atrasos) / total) * 100) : 0;

        sessionMap.set(s.id, {
          id: s.id,
          fecha: s.fecha,
          materia: s.materia,
          grupo_id: s.grupo_id,
          grupo_nombre: grupoNombre,
          presentes,
          atrasos,
          faltas,
          licencias,
          total,
          porcentaje,
          detalles
        });
      });

      const items = Array.from(sessionMap.values());

      // Ordenar de más reciente a más antiguo por fecha
      items.sort((a, b) => b.fecha.localeCompare(a.fecha));

      setHistorialSesiones(items);
    } catch (err: any) {
      console.error('Error al cargar historial de sesiones de clase desde Supabase:', err);
      setHistorialError(err.message || 'Error al consultar historial en Supabase.');
      setHistorialSesiones([]);
    } finally {
      setLoadingHistorial(false);
    }
  };

  const toggleSessionExpanded = (id: string) => {
    setExpandedSessionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Efecto para cargar asignaciones o historial al activar la subpestaña
  useEffect(() => {
    if (activeSubTab === 'asistencia') {
      fetchAssignedGroups();
    } else if (activeSubTab === 'nomina') {
      fetchNomina();
    } else if (activeSubTab === 'historial') {
      fetchHistorialSesiones();
    }
  }, [activeSubTab, user.id]);

  // Efecto para cargar estudiantes al cambiar grupo seleccionado
  useEffect(() => {
    if (selectedGrupoId) {
      setAttendanceSaved(false);
      const currentG = assignedGroups.find(g => g.id === selectedGrupoId);
      const mat = currentG ? currentG.materia : materiaClase;
      if (currentG) {
        setMateriaClase(currentG.materia);
      }
      fetchStudentsForGroup(selectedGrupoId, fechaClase, mat);
    } else {
      setAsistenciaStudents([]);
    }
  }, [selectedGrupoId]);

  // Efecto para recargar si cambia la fecha
  useEffect(() => {
    if (selectedGrupoId && activeSubTab === 'asistencia') {
      setAttendanceSaved(false);
      fetchStudentsForGroup(selectedGrupoId, fechaClase, materiaClase);
    }
  }, [fechaClase]);

  useEffect(() => {
    const handleRefresh = () => {
      if (activeSubTab === 'nomina') {
        fetchNomina();
      } else if (activeSubTab === 'asistencia' && selectedGrupoId) {
        fetchStudentsForGroup(selectedGrupoId, fechaClase, materiaClase);
      } else if (activeSubTab === 'historial') {
        fetchHistorialSesiones();
      }
    };
    window.addEventListener('estudiante-added', handleRefresh);
    window.addEventListener('asistencia-estudiantes-guardada', handleRefresh);
    return () => {
      window.removeEventListener('estudiante-added', handleRefresh);
      window.removeEventListener('asistencia-estudiantes-guardada', handleRefresh);
    };
  }, [activeSubTab, selectedGrupoId, fechaClase, materiaClase]);

  // Nomina tab filtered real students
  const filteredNominaStudents = nominaStudents.filter((e) => {
    const term = searchTerm.toLowerCase();
    const matchName = e.nombre_completo.toLowerCase().includes(term);
    const matchCode = e.codigo_interno ? e.codigo_interno.toLowerCase().includes(term) : false;
    const matchDoc = e.documento ? e.documento.toLowerCase().includes(term) : false;
    return matchName || matchCode || matchDoc;
  });

  const handleMarkAllPresent = () => {
    const updated: Record<string, 'presente' | 'atraso' | 'falta' | 'licencia'> = {};
    asistenciaStudents.forEach(e => {
      updated[e.id] = 'presente';
    });
    setAttendanceMap(updated);
  };

  const handleStatusChange = (studentId: string, status: 'presente' | 'atraso' | 'falta' | 'licencia') => {
    setAttendanceMap(prev => ({ ...prev, [studentId]: status }));
  };

  // Helper to distinguish real network/connection errors from DB/RLS errors
  const isNetworkError = (error: any): boolean => {
    if (!error) return false;
    const msg = (error.message || error.details || error.hint || String(error)).toLowerCase();
    return (
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('network request failed') ||
      msg.includes('network error') ||
      msg.includes('timeout') ||
      msg.includes('connection refused') ||
      msg.includes('abort') ||
      msg.includes('offline') ||
      (typeof navigator !== 'undefined' && !navigator.onLine)
    );
  };

  const handleSaveAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGrupoId) {
      setSaveAttendanceError('Debe seleccionar un grupo asignado.');
      return;
    }
    if (asistenciaStudents.length === 0) {
      setSaveAttendanceError('No hay estudiantes en el grupo seleccionado para registrar asistencia.');
      return;
    }
    const materiaTrimmed = materiaClase.trim();
    if (!materiaTrimmed) {
      setSaveAttendanceError('Debe especificar la materia o módulo de la sesión de clase.');
      return;
    }

    setSavingAttendance(true);
    setSaveAttendanceError(null);

    const items: Array<{
      estudiante_id: string;
      estado: 'presente' | 'atraso' | 'falta' | 'licencia';
    }> = asistenciaStudents.map(st => ({
      estudiante_id: st.id,
      estado: attendanceMap[st.id] || 'presente'
    }));

    // Estrategia Online-First:
    // Si Supabase está configurado, intentar SIEMPRE primero en Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        // 1. Buscar si ya existe una sesión en public.sesiones_clase
        let { data: sesionData, error: sesionSelectError } = await supabase
          .from('sesiones_clase')
          .select('id')
          .eq('grupo_id', selectedGrupoId)
          .eq('fecha', fechaClase)
          .eq('materia', materiaTrimmed)
          .maybeSingle();

        if (sesionSelectError) {
          throw sesionSelectError;
        }

        let sesionId = sesionData?.id;

        // 2. Si no existe la sesión, crearla
        if (!sesionId) {
          const { data: newSesion, error: sesionInsertError } = await supabase
            .from('sesiones_clase')
            .insert({
              grupo_id: selectedGrupoId,
              docente_id: user.id,
              fecha: fechaClase,
              materia: materiaTrimmed
            })
            .select('id')
            .single();

          if (sesionInsertError) {
            // Manejar si hubo carrera o conflicto de clave única (UNIQUE grupo_id, fecha, materia)
            if (sesionInsertError.code === '23505') {
              const { data: retrySesion, error: retryError } = await supabase
                .from('sesiones_clase')
                .select('id')
                .eq('grupo_id', selectedGrupoId)
                .eq('fecha', fechaClase)
                .eq('materia', materiaTrimmed)
                .single();
              if (retryError || !retrySesion) {
                throw retryError || new Error(`Error al recuperar sesión existente tras conflicto: ${sesionInsertError.message}`);
              }
              sesionId = retrySesion.id;
            } else {
              throw sesionInsertError;
            }
          } else {
            sesionId = newSesion.id;
          }
        }

        // 3. Upsert en public.asistencias_estudiantes con onConflict: 'sesion_id,estudiante_id'
        const asistenciasPayload = items.map(item => ({
          sesion_id: sesionId,
          estudiante_id: item.estudiante_id,
          estado: item.estado,
          observacion: null
        }));

        const { error: asistenciasError } = await supabase
          .from('asistencias_estudiantes')
          .upsert(asistenciasPayload, { onConflict: 'sesion_id,estudiante_id' });

        if (asistenciasError) {
          throw asistenciasError;
        }

        // Éxito en Supabase
        const presentesOatrasos = items.filter(i => i.estado === 'presente' || i.estado === 'atraso').length;
        const totalGroup = Math.max(1, items.length);
        const percent = Math.round((presentesOatrasos / totalGroup) * 100);

        setSavedGroupPercent(percent);
        setSavedMode('cloud');
        setAttendanceSaved(true);
        window.dispatchEvent(new Event('asistencia-estudiantes-guardada'));
        setSavingAttendance(false);
        return;
      } catch (cloudErr: any) {
        console.warn('Fallo al intentar guardar en Supabase:', cloudErr);

        // Si es un error real de red/desconexión, derivar a guardado offline (IndexedDB)
        if (isNetworkError(cloudErr)) {
          try {
            const syncKey = `asis-est-${selectedGrupoId}-${fechaClase}-${Date.now()}`;
            await saveOfflineEstudianteAsistencia({
              sync_key: syncKey,
              grupo_id: selectedGrupoId,
              fecha: fechaClase,
              materia: materiaTrimmed,
              docente_id: user.id,
              asistencias: items,
              timestamp: Date.now()
            });

            const presentesOatrasos = items.filter(i => i.estado === 'presente' || i.estado === 'atraso').length;
            const totalGroup = Math.max(1, items.length);
            const percent = Math.round((presentesOatrasos / totalGroup) * 100);

            setSavedGroupPercent(percent);
            setSavedMode('offline');
            setAttendanceSaved(true);
            setSavingAttendance(false);
            return;
          } catch (offlineErr: any) {
            setSaveAttendanceError(`Error al guardar sin conexión: ${offlineErr.message || 'Error en IndexedDB'}`);
            setAttendanceSaved(false);
            setSavingAttendance(false);
            return;
          }
        } else {
          // Es un error de Base de Datos / RLS / Permisos / SQL: NO guardar offline ni marcar éxito
          const detailedMsg = cloudErr.message || cloudErr.details || 'Error de base de datos en Supabase';
          setSaveAttendanceError(`Error de Supabase: ${detailedMsg}`);
          setAttendanceSaved(false);
          setSavingAttendance(false);
          return;
        }
      }
    }

    // Si Supabase no está configurado, guardar en IndexedDB
    try {
      const syncKey = `asis-est-${selectedGrupoId}-${fechaClase}-${Date.now()}`;
      await saveOfflineEstudianteAsistencia({
        sync_key: syncKey,
        grupo_id: selectedGrupoId,
        fecha: fechaClase,
        materia: materiaTrimmed,
        docente_id: user.id,
        asistencias: items,
        timestamp: Date.now()
      });

      const presentesOatrasos = items.filter(i => i.estado === 'presente' || i.estado === 'atraso').length;
      const totalGroup = Math.max(1, items.length);
      const percent = Math.round((presentesOatrasos / totalGroup) * 100);

      setSavedGroupPercent(percent);
      setSavedMode('offline');
      setAttendanceSaved(true);
    } catch (err: any) {
      setSaveAttendanceError(`Error al guardar localmente: ${err.message || 'Error inesperado'}`);
      setAttendanceSaved(false);
    } finally {
      setSavingAttendance(false);
    }
  };

  const handleExportNomina = () => {
    if (nominaStudents.length > 0) {
      downloadStudentEnrollmentReport(nominaStudents);
    }
  };

  return (
    <div className="space-y-5 pb-20">
      {/* Top Selector Subtabs */}
      <div className="flex bg-slate-200 p-1 rounded-2xl">
        <button
          onClick={() => setActiveSubTab('asistencia')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
            activeSubTab === 'asistencia' ? 'bg-[#00A651] text-white shadow-sm' : 'text-slate-700'
          }`}
        >
          Asistencia Diaria
        </button>
        <button
          onClick={() => setActiveSubTab('nomina')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
            activeSubTab === 'nomina' ? 'bg-[#00A651] text-white shadow-sm' : 'text-slate-700'
          }`}
        >
          Nómina de Inscritos
        </button>
        <button
          onClick={() => setActiveSubTab('historial')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
            activeSubTab === 'historial' ? 'bg-[#00A651] text-white shadow-sm' : 'text-slate-700'
          }`}
        >
          Historial
        </button>
      </div>

      {activeSubTab === 'asistencia' ? (
        /* ================= ASISTENCIA DIARIA FORM ================= */
        <div className="space-y-4">
          {/* Loading grupos state */}
          {loadingGrupos && (
            <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-500 font-bold text-xs space-y-2">
              <div className="inline-block animate-spin w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full" />
              <p>Cargando grupos asignados desde Supabase...</p>
            </div>
          )}

          {/* Error loading grupos */}
          {!loadingGrupos && gruposError && (
            <div className="p-5 bg-red-50 border border-red-200 text-red-700 rounded-3xl text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>Error al consultar asignaciones: {gruposError}</span>
              </div>
              <button
                type="button"
                onClick={fetchAssignedGroups}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-[11px] transition-colors"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* Empty groups state */}
          {!loadingGrupos && !gruposError && assignedGroups.length === 0 && (
            <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
              <Users className="w-10 h-10 text-slate-300 mx-auto" />
              <h4 className="font-extrabold text-slate-800 text-base">Sin grupos asignados</h4>
              <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
                No tiene grupos asignados. Solicite al director la asignación correspondiente.
              </p>
              <button
                type="button"
                onClick={fetchAssignedGroups}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors inline-flex items-center gap-1.5"
              >
                <span>Verificar nuevamente</span>
              </button>
            </div>
          )}

          {/* Form & Group Selector when assigned groups exist */}
          {!loadingGrupos && !gruposError && assignedGroups.length > 0 && (
            <div className="space-y-4">
              <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200 space-y-4">
                <h3 className="font-extrabold text-[#17324D] text-lg flex items-center gap-2">
                  <UserCheck className="w-6 h-6 text-[#00A651]" />
                  Registro de Asistencia Estudiantil
                </h3>

                {/* Select Group, Date & Subject */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-bold">
                  <div>
                    <label className="block text-slate-700 mb-1">Grupo / Curso a cargo</label>
                    <select
                      value={selectedGrupoId}
                      onChange={e => {
                        const newId = e.target.value;
                        setSelectedGrupoId(newId);
                        const match = assignedGroups.find(g => g.id === newId);
                        if (match) setMateriaClase(match.materia);
                      }}
                      className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium"
                    >
                      {assignedGroups.map(g => (
                        <option key={g.id} value={g.id}>{g.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 mb-1">Fecha</label>
                    <input
                      type="date"
                      value={fechaClase}
                      onChange={e => setFechaClase(e.target.value)}
                      className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 mb-1">Materia / Módulo</label>
                    <input
                      type="text"
                      value={materiaClase}
                      onChange={e => setMateriaClase(e.target.value)}
                      className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium"
                    />
                  </div>
                </div>

                {/* Quick Action: Mark All Present */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-xs text-slate-500 font-medium">
                    Estudiantes activos en este grupo: <strong>{asistenciaStudents.length}</strong>
                  </span>

                  <button
                    type="button"
                    onClick={handleMarkAllPresent}
                    disabled={asistenciaStudents.length === 0}
                    className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-[#00A651] font-bold text-xs rounded-xl border border-emerald-200 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <CheckSquare className="w-4 h-4" />
                    <span>Marcar Todos Presentes</span>
                  </button>
                </div>
              </div>

              {/* Loading Students */}
              {loadingStudents && (
                <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-500 font-bold text-xs space-y-2">
                  <div className="inline-block animate-spin w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full" />
                  <p>Cargando estudiantes del grupo desde Supabase...</p>
                </div>
              )}

              {/* Error Loading Students */}
              {!loadingStudents && studentsError && (
                <div className="p-5 bg-red-50 border border-red-200 text-red-700 rounded-3xl text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <span>Error al cargar estudiantes: {studentsError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => fetchStudentsForGroup(selectedGrupoId)}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-[11px] transition-colors"
                  >
                    Reintentar
                  </button>
                </div>
              )}

              {/* Empty Students in Group */}
              {!loadingStudents && !studentsError && asistenciaStudents.length === 0 && (
                <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 shadow-xs space-y-2 text-slate-500">
                  <Users className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="font-bold text-xs">No hay estudiantes registrados en este grupo.</p>
                </div>
              )}

              {attendanceSaved && savedGroupPercent !== null && (
                <div
                  className={`p-5 rounded-3xl space-y-2 text-center shadow-xs border ${
                    savedMode === 'cloud'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                      : 'bg-amber-50 border-amber-300 text-amber-950'
                  }`}
                >
                  <Sparkles
                    className={`w-8 h-8 mx-auto ${
                      savedMode === 'cloud' ? 'text-[#00A651]' : 'text-amber-600'
                    }`}
                  />
                  <h4 className="font-extrabold text-lg">
                    {savedMode === 'cloud'
                      ? '¡Asistencia guardada en Supabase!'
                      : 'Sin conexión. Asistencia guardada localmente y pendiente de sincronización.'}
                  </h4>
                  <p
                    className={`text-xs font-medium ${
                      savedMode === 'cloud' ? 'text-emerald-800' : 'text-amber-800'
                    }`}
                  >
                    Porcentaje de asistencia del grupo: <strong className="text-base font-extrabold">{savedGroupPercent}%</strong>
                  </p>
                  <button
                    onClick={() => setAttendanceSaved(false)}
                    className={`px-5 py-2.5 text-white font-bold text-xs rounded-xl mt-2 transition-colors inline-flex items-center gap-1.5 shadow-xs ${
                      savedMode === 'cloud'
                        ? 'bg-[#00A651] hover:bg-[#008d44]'
                        : 'bg-amber-600 hover:bg-amber-700'
                    }`}
                  >
                    <span>Modificar o Revisar Lista</span>
                  </button>
                </div>
              )}

              {/* Student List & Attendance Toggles */}
              {!loadingStudents && !studentsError && asistenciaStudents.length > 0 && !attendanceSaved && (
                <form onSubmit={handleSaveAttendance} className="space-y-3">
                  {asistenciaStudents.map((st) => {
                    const currentStatus = attendanceMap[st.id] || 'presente';
                    return (
                      <div
                        key={st.id}
                        className="p-4 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              {st.codigo_interno}
                            </span>
                            <h4 className="font-extrabold text-base text-[#17324D] mt-1">{st.nombre_completo}</h4>
                            <p className="text-xs text-slate-500 font-medium">
                              {st.carrera_especialidad} • {st.nivel} {st.documento ? `• CI: ${st.documento}` : ''}
                            </p>
                          </div>
                        </div>

                        {/* Status Toggles Buttons */}
                        <div className="grid grid-cols-4 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStatusChange(st.id, 'presente')}
                            className={`h-11 rounded-xl text-xs font-bold transition-all ${
                              currentStatus === 'presente'
                                ? 'bg-[#00A651] text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            Presente
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStatusChange(st.id, 'atraso')}
                            className={`h-11 rounded-xl text-xs font-bold transition-all ${
                              currentStatus === 'atraso'
                                ? 'bg-amber-500 text-slate-950 shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            Atraso
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStatusChange(st.id, 'falta')}
                            className={`h-11 rounded-xl text-xs font-bold transition-all ${
                              currentStatus === 'falta'
                                ? 'bg-red-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            Falta
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStatusChange(st.id, 'licencia')}
                            className={`h-11 rounded-xl text-xs font-bold transition-all ${
                              currentStatus === 'licencia'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            Licencia
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Error Saving Banner */}
                  {saveAttendanceError && (
                    <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs flex items-center gap-2 font-medium">
                      <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                      <span>{saveAttendanceError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    id="btn-guardar-asistencia-est"
                    disabled={savingAttendance}
                    className="w-full h-14 bg-[#00A651] hover:bg-[#008f45] disabled:opacity-60 text-white font-extrabold text-lg rounded-2xl shadow-md flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:cursor-not-allowed"
                  >
                    {savingAttendance ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>GUARDANDO EN SUPABASE...</span>
                      </>
                    ) : (
                      <span>GUARDAR ASISTENCIA DEL GRUPO</span>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      ) : activeSubTab === 'nomina' ? (
        /* ================= NOMINA DE INSCRITOS VIEW ================= */
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar por estudiante o código..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full h-11 pl-10 pr-4 bg-white border border-slate-300 rounded-2xl text-xs font-medium outline-none"
              />
            </div>

            {user.rol === 'superadmin' && (
              <button
                onClick={onOpenAddStudentModal}
                className="h-11 px-3 bg-[#00A651] text-white font-bold text-xs rounded-2xl flex items-center gap-1 shrink-0 hover:bg-[#008d44] transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Añadir</span>
              </button>
            )}

            <button
              onClick={handleExportNomina}
              disabled={nominaStudents.length === 0}
              className="h-11 px-3 bg-slate-800 text-white font-bold text-xs rounded-2xl flex items-center gap-1 shrink-0 hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#FFC845]" />
              <span>Excel</span>
            </button>
          </div>

          {/* Error Message */}
          {nominaError && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-3xl text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>Error al obtener nómina: {nominaError}</span>
              </div>
              <button
                type="button"
                onClick={fetchNomina}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-[11px] transition-colors"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* Loading state */}
          {loadingNomina && (
            <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-500 font-bold text-xs space-y-2">
              <div className="inline-block animate-spin w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full" />
              <p>Cargando nómina de estudiantes desde Supabase...</p>
            </div>
          )}

          {/* Empty state */}
          {!loadingNomina && !nominaError && filteredNominaStudents.length === 0 && (
            <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-500 font-bold text-xs space-y-2">
              <Users className="w-8 h-8 text-slate-300 mx-auto" />
              <p>{searchTerm ? 'No se encontraron estudiantes que coincidan con la búsqueda.' : 'No hay estudiantes registrados.'}</p>
            </div>
          )}

          {/* Roster Cards */}
          {!loadingNomina && !nominaError && filteredNominaStudents.length > 0 && (
            <div className="space-y-3">
              {filteredNominaStudents.map((s) => (
                <div key={s.id} className="p-4 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        {s.codigo_interno}
                      </span>
                      <h4 className="font-extrabold text-base text-[#17324D] mt-1">{s.nombre_completo}</h4>
                      <p className="text-xs text-slate-500 font-medium">
                        CI: {s.documento || 'N/D'} • Inscrito: {s.fecha_inscripcion}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full font-bold text-[10px] uppercase ${
                        s.estado === 'activo'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {s.estado}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 grid grid-cols-2 gap-1 font-medium">
                    <div>Sede: <strong className="text-slate-900">{s.sede_nombre || 'N/D'}</strong></div>
                    <div>Programa: <strong className="text-slate-900">{s.programa_nombre || s.carrera_especialidad || 'EPJA'}</strong></div>
                    <div>Grupo: <strong className="text-slate-900">{s.grupo_nombre || 'N/D'}</strong></div>
                    <div>Nivel: <strong className="text-slate-900">{s.nivel || 'N/D'}</strong></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ================= HISTORIAL DE ASISTENCIA VIEW ================= */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-base text-[#17324D]">Historial de Asistencia</h3>
              <p className="text-xs text-slate-500 font-medium">Sesiones registradas por usted</p>
            </div>
            <button
              onClick={fetchHistorialSesiones}
              disabled={loadingHistorial}
              className="h-9 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-50"
              title="Recargar historial"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${loadingHistorial ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>
          </div>

          {/* Error Message */}
          {historialError && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-3xl text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>Error al cargar historial: {historialError}</span>
              </div>
              <button
                type="button"
                onClick={fetchHistorialSesiones}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-[11px] transition-colors"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* Loading state */}
          {loadingHistorial && (
            <div className="p-10 text-center bg-white rounded-3xl border border-slate-200 text-slate-500 font-bold text-xs space-y-2">
              <RefreshCw className="w-8 h-8 text-[#00A651] animate-spin mx-auto" />
              <p>Cargando historial de asistencias...</p>
            </div>
          )}

          {/* Empty state */}
          {!loadingHistorial && !historialError && historialSesiones.length === 0 && (
            <div className="p-10 text-center bg-white rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="font-bold text-sm text-slate-700">Aún no tiene asistencias estudiantiles registradas.</p>
              <p className="text-xs text-slate-400">
                Las sesiones de clase guardadas en "Asistencia Diaria" aparecerán aquí.
              </p>
            </div>
          )}

          {/* Session Cards */}
          {!loadingHistorial && !historialError && historialSesiones.length > 0 && (
            <div className="space-y-3">
              {historialSesiones.map((s) => {
                const isExpanded = expandedSessionIds.has(s.id);
                return (
                  <div
                    key={s.id}
                    className="p-4 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3 transition-all"
                  >
                    {/* Header & Click to toggle */}
                    <div
                      onClick={() => toggleSessionExpanded(s.id)}
                      className="cursor-pointer space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              {s.grupo_nombre}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                              {s.fecha}
                            </span>
                          </div>
                          <h4 className="font-extrabold text-base text-[#17324D] mt-1">{s.materia}</h4>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <span
                            className={`px-2.5 py-1 rounded-xl text-xs font-extrabold ${
                              s.porcentaje >= 80
                                ? 'bg-emerald-100 text-emerald-800'
                                : s.porcentaje >= 60
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {s.porcentaje}%
                          </span>
                          <span className="text-[9px] text-slate-400 font-bold mt-0.5">Asistencia</span>
                        </div>
                      </div>

                      {/* Stat badges */}
                      <div className="grid grid-cols-4 gap-1.5 pt-1 text-center">
                        <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100">
                          <span className="text-[9px] font-bold text-emerald-700 block uppercase">Pres.</span>
                          <strong className="text-sm text-emerald-800 font-extrabold">{s.presentes}</strong>
                        </div>
                        <div className="p-2 bg-amber-50 rounded-xl border border-amber-100">
                          <span className="text-[9px] font-bold text-amber-700 block uppercase">Atr.</span>
                          <strong className="text-sm text-amber-800 font-extrabold">{s.atrasos}</strong>
                        </div>
                        <div className="p-2 bg-red-50 rounded-xl border border-red-100">
                          <span className="text-[9px] font-bold text-red-700 block uppercase">Falt.</span>
                          <strong className="text-sm text-red-800 font-extrabold">{s.faltas}</strong>
                        </div>
                        <div className="p-2 bg-blue-50 rounded-xl border border-blue-100">
                          <span className="text-[9px] font-bold text-blue-700 block uppercase">Lic.</span>
                          <strong className="text-sm text-blue-800 font-extrabold">{s.licencias}</strong>
                        </div>
                      </div>

                      {/* Expand / collapse hint */}
                      <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-400 pt-1">
                        <span>{isExpanded ? 'Ocultar nómina de la sesión' : `Ver estudiantes (${s.total})`}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </div>
                    </div>

                    {/* Expandable student details */}
                    {isExpanded && (
                      <div className="pt-2 border-t border-slate-100 space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                          Detalle de Estudiantes ({s.detalles.length})
                        </span>
                        <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                          {s.detalles.map((det) => (
                            <div
                              key={det.id}
                              className="flex items-center justify-between p-2 bg-slate-50 rounded-xl text-xs"
                            >
                              <div className="truncate pr-2">
                                <span className="font-bold text-[#17324D]">{det.nombre_completo}</span>
                                {det.codigo_interno && (
                                  <span className="text-[10px] text-slate-400 ml-1">({det.codigo_interno})</span>
                                )}
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase shrink-0 ${
                                  det.estado === 'presente'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : det.estado === 'atraso'
                                    ? 'bg-amber-100 text-amber-800'
                                    : det.estado === 'falta'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {det.estado}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};


