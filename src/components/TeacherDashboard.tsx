import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  MapPin,
  BookOpen,
  FileText,
  AlertCircle,
  TrendingUp,
  UserCheck,
  Send,
  Sparkles,
  Plus,
  Trash2,
  Check,
  PenTool,
  Camera,
  ShieldCheck
} from 'lucide-react';
import { Perfil, AsistenciaDocente, FilaActividadPedagogica, ControlDocumental } from '../types';
import { supabase } from '../lib/supabase';
import { saveOfflineDocenteAsistencia } from '../lib/db';
import { MOCK_ASISTENCIAS_DOCENTES } from '../lib/mockData';
import { getCurrentGPSPosition, getBoliviaTodayDate } from '../lib/geo';
import { ClockInVerificationModal } from './ClockInVerificationModal';
import { ControlDocumentalCard } from './ControlDocumentalCard';
import { EditControlDocumentalModal } from './EditControlDocumentalModal';
import { getControlDocumentalForDocente } from '../lib/controlDocumental';

interface TeacherDashboardProps {
  user: Perfil;
  isOnline: boolean;
  onNavigateTab: (tab: string) => void;
  pendingSyncCount: number;
  onRefreshSync: () => void;
}

const SUBNIVELES_POR_AREA: Record<string, string[]> = {
  EPA: [
    'Aprendizajes Elementales',
    'Aprendizajes Avanzados',
    'Aprendizajes Aplicados'
  ],
  ESA: [
    'Aprendizajes Complementarios',
    'Aprendizajes Especializados'
  ],
  ETA: [
    'Técnico Básico',
    'Técnico Auxiliar',
    'Técnico Medio'
  ]
};

const CARRERAS_ETA_SUGERIDAS = [
  'Sistemas Informáticos',
  'Gastronomía',
  'Corte y Confección',
  'Belleza Integral',
  'Agropecuaria',
  'Contabilidad',
  'Textiles y Confección'
];

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  user,
  isOnline,
  onNavigateTab,
  pendingSyncCount,
  onRefreshSync
}) => {
  const [todayAttendance, setTodayAttendance] = useState<AsistenciaDocente | null>(null);
  const [controlDoc, setControlDoc] = useState<ControlDocumental | undefined>(undefined);
  const [isEditControlModalOpen, setIsEditControlModalOpen] = useState<boolean>(false);
  const [loadingAction, setLoadingAction] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [showShiftSummaryModal, setShowShiftSummaryModal] = useState<boolean>(false);
  const [showClockInVerificationModal, setShowClockInVerificationModal] = useState<boolean>(false);

  // Form modal state for Control Diario
  const [showControlDiarioModal, setShowControlDiarioModal] = useState<boolean>(false);
  const [formFecha, setFormFecha] = useState<string>(new Date().toISOString().slice(0, 10));
  const [formHoraEntrada, setFormHoraEntrada] = useState<string>('18:30');
  const [firmaEntrada, setFirmaEntrada] = useState<boolean>(true);

  // Multigrade activity rows state
  const [multigradoRows, setMultigradoRows] = useState<FilaActividadPedagogica[]>([
    {
      id: 'row-1',
      area_nivel: 'ETA',
      subnivel: 'Técnico Básico',
      carrera: 'Gastronomía',
      actividad_pedagogica: ''
    }
  ]);
  const [formSavedSuccess, setFormSavedSuccess] = useState<boolean>(false);

  // Stats calculation
  const [asistenciaPorcentaje] = useState<number>(95.8);
  const [puntualidadPorcentaje] = useState<number>(91.5);

  const todayStr = getBoliviaTodayDate();
  const currentDateFormatted = new Date().toLocaleDateString('es-BO', {
    timeZone: 'America/La_Paz',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Load existing attendance record and control documental
  useEffect(() => {
    async function loadInitialData() {
      // 1. Control Documental
      const docControl = await getControlDocumentalForDocente(user.id);
      setControlDoc(docControl);

      // 2. Attendance
      let foundRec: AsistenciaDocente | null = null;
      if (supabase && isOnline) {
        const { data } = await supabase
          .from('asistencias_docentes')
          .select('*')
          .eq('docente_id', user.id)
          .eq('fecha_laboral', todayStr)
          .single();

        if (data) {
          foundRec = data as AsistenciaDocente;
        }
      } else {
        const localRec = MOCK_ASISTENCIAS_DOCENTES.find(
          a => a.docente_id === user.id && a.fecha_laboral === todayStr
        );
        if (localRec) {
          foundRec = localRec;
        }
      }

      if (foundRec) {
        setTodayAttendance(foundRec);
        if (foundRec.actividades_multigrado && foundRec.actividades_multigrado.length > 0) {
          setMultigradoRows(foundRec.actividades_multigrado);
        } else if (foundRec.observacion) {
          try {
            const parsed = JSON.parse(foundRec.observacion);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setMultigradoRows(parsed);
            }
          } catch {
            // Ignorar textos de excepciones, ingresos, salidas o mensajes del sistema
            const obs = foundRec.observacion.trim();
            const esTextoDeSistemaOExcepcion =
              obs.startsWith('Excepción') ||
              obs.startsWith('Ingreso') ||
              obs.startsWith('Salida') ||
              obs.startsWith('Registrado') ||
              obs === (foundRec.observacion_excepcion || '').trim();

            if (obs && !esTextoDeSistemaOExcepcion) {
              setMultigradoRows([
                {
                  id: 'row-1',
                  area_nivel: 'EPA',
                  subnivel: 'Aprendizajes Básicos',
                  actividad_pedagogica: obs
                }
              ]);
            }
          }
        }
        if (foundRec.firma_ingreso !== undefined) setFirmaEntrada(foundRec.firma_ingreso);
      }
    }
    loadInitialData();
  }, [user.id, todayStr, isOnline]);

  // Open Clock In Modal
  const handleRegistrarIngreso = () => {
    if (todayAttendance?.hora_ingreso_oficial) {
      setMessage({ type: 'warning', text: 'Ya registraste tu ingreso para la jornada de hoy.' });
      return;
    }
    setMessage(null);
    setShowClockInVerificationModal(true);
  };

  const handleClockInSuccess = (newRecord: AsistenciaDocente) => {
    setTodayAttendance(newRecord);
    setFirmaEntrada(true);
    setShowClockInVerificationModal(false);
    onRefreshSync();

    const isPending = newRecord.estado_excepcion === 'pendiente_revision' || newRecord.estado === 'pendiente_verificacion';
    setMessage({
      type: isPending ? 'warning' : 'success',
      text: isPending
        ? '⚠️ Ingreso registrado con excepción. Pendiente de revisión por Dirección.'
        : `¡Ingreso verificado exitosamente con GPS y Selfie a las ${new Date().toLocaleTimeString('es-BO')}!`
    });
  };

  // Handle Salida (Clock Out) with GPS verification
  const handleRegistrarSalida = async () => {
    if (!todayAttendance?.hora_ingreso_oficial) {
      setMessage({ type: 'warning', text: 'Debe registrar ingreso antes de registrar la salida.' });
      return;
    }

    if (todayAttendance.hora_salida_oficial) {
      setMessage({ type: 'warning', text: 'Ya registraste la salida de tu jornada de hoy.' });
      return;
    }

    setLoadingAction(true);
    setMessage(null);

    const syncKey = `salida-${user.id}-${todayStr}-${Date.now()}`;
    const localIso = new Date().toISOString();

    // Obtain current GPS position for exit
    const gpsLocation = await getCurrentGPSPosition();

    try {
      if (isOnline && supabase) {
        let { data, error } = await supabase.rpc('registrar_salida_gps', {
          p_docente_id: user.id,
          p_sync_key: syncKey,
          p_hora_local: localIso,
          p_es_offline: false,
          p_latitud: gpsLocation.latitud || null,
          p_longitud: gpsLocation.longitud || null,
          p_precision: gpsLocation.precision || null,
          p_observacion: todayAttendance?.observacion || null
        });

        if (error && error.message?.includes('function')) {
          const fallback = await supabase.rpc('registrar_salida', {
            p_docente_id: user.id,
            p_sync_key: syncKey,
            p_hora_local: localIso,
            p_es_offline: false,
            p_observacion: todayAttendance?.observacion || null
          });
          data = fallback.data;
          error = fallback.error;
        }

        if (error) {
          setMessage({ type: 'error', text: error.message || 'Error al registrar salida' });
        } else if (data) {
          const updatedRec: AsistenciaDocente = {
            ...(data as AsistenciaDocente),
            firma_salida: true,
            latitud_salida: gpsLocation.latitud,
            longitud_salida: gpsLocation.longitud,
            precision_gps_salida: gpsLocation.precision,
            actividades_multigrado: multigradoRows
          };
          setTodayAttendance(updatedRec);
          setShowShiftSummaryModal(true);
        }
      } else {
        // OFFLINE MODE
        await saveOfflineDocenteAsistencia({
          sync_key: syncKey,
          docente_id: user.id,
          tipo: 'salida',
          hora_local: localIso,
          latitud: gpsLocation.latitud,
          longitud: gpsLocation.longitud,
          precision_gps: gpsLocation.precision,
          observacion: todayAttendance?.observacion || undefined,
          timestamp: Date.now()
        });

        const updatedRec: AsistenciaDocente = {
          ...todayAttendance,
          hora_salida_oficial: localIso,
          hora_salida_local: localIso,
          firma_salida: true,
          latitud_salida: gpsLocation.latitud,
          longitud_salida: gpsLocation.longitud,
          precision_gps_salida: gpsLocation.precision,
          actividades_multigrado: multigradoRows
        };

        setTodayAttendance(updatedRec);
        setShowShiftSummaryModal(true);
        onRefreshSync();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error al procesar la salida.' });
    } finally {
      setLoadingAction(false);
    }
  };

  // Multigrade Rows Handlers
  const handleAddMultigradoRow = () => {
    const newRow: FilaActividadPedagogica = {
      id: `row-${Date.now()}`,
      area_nivel: 'EPA',
      subnivel: SUBNIVELES_POR_AREA['EPA'][0],
      actividad_pedagogica: ''
    };
    setMultigradoRows([...multigradoRows, newRow]);
  };

  const handleRemoveMultigradoRow = (id: string) => {
    if (multigradoRows.length === 1) return;
    setMultigradoRows(multigradoRows.filter(r => r.id !== id));
  };

  const handleAreaChange = (id: string, newArea: string) => {
    setMultigradoRows(multigradoRows.map(r => {
      if (r.id !== id) return r;
      const defaultSub = SUBNIVELES_POR_AREA[newArea]?.[0] || '';
      return {
        ...r,
        area_nivel: newArea,
        subnivel: defaultSub,
        carrera: newArea === 'ETA' ? 'Gastronomía' : undefined
      };
    }));
  };

  const handleRowFieldChange = (id: string, field: keyof FilaActividadPedagogica, value: string) => {
    setMultigradoRows(multigradoRows.map(r => {
      if (r.id !== id) return r;
      return { ...r, [field]: value };
    }));
  };

  // Save Control Diario Form
  const handleSaveControlDiario = async (e: React.FormEvent) => {
    e.preventDefault();

    const obsJson = JSON.stringify(multigradoRows);

    const updatedRecord: AsistenciaDocente = {
      id: todayAttendance?.id || `asis-${user.id}-${formFecha}`,
      docente_id: user.id,
      docente_nombre: user.nombre_completo,
      fecha_laboral: formFecha,
      hora_ingreso_oficial: todayAttendance?.hora_ingreso_oficial || `${formFecha}T${formHoraEntrada}:00-04:00`,
      hora_salida_oficial: todayAttendance?.hora_salida_oficial,
      firma_ingreso: todayAttendance?.firma_ingreso ?? true,
      firma_salida: Boolean(todayAttendance?.hora_salida_oficial),
      minutos_atraso: todayAttendance?.minutos_atraso || 0,
      minutos_salida_anticipada: todayAttendance?.minutos_salida_anticipada || 0,
      horas_trabajadas: todayAttendance?.horas_trabajadas || 3.5,
      estado: todayAttendance?.estado || 'puntual',
      origen_registro: isOnline ? 'en_linea' : 'sin_conexion',
      sync_key: todayAttendance?.sync_key || `sync-${Date.now()}`,
      observacion: obsJson,
      actividades_multigrado: multigradoRows
    };

    setTodayAttendance(updatedRecord);

    if (supabase && isOnline) {
      try {
        const { error } = await supabase
          .from('asistencias_docentes')
          .update({
            observacion: obsJson
          })
          .eq('docente_id', user.id)
          .eq('fecha_laboral', formFecha);

        if (error) {
          console.error('Error al actualizar observación de control diario en Supabase:', error.message);
        }
      } catch (err) {
        console.error('Error al persistir control diario en Supabase:', err);
      }
    }

    setFormSavedSuccess(true);
    setTimeout(() => {
      setFormSavedSuccess(false);
      setShowControlDiarioModal(false);
    }, 1200);
  };

  return (
    <div className="space-y-5 pb-20">
      {/* Teacher Greeting Header */}
      <div className="bg-gradient-to-br from-[#00A651] to-emerald-800 rounded-3xl p-5 text-white shadow-lg space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-emerald-100 text-xs font-semibold uppercase tracking-wider">Docente Institucional</p>
            <h2 className="text-2xl font-extrabold capitalize leading-tight">{user.nombre_completo}</h2>
            <p className="text-xs text-emerald-200 mt-1 flex items-center gap-1.5 font-medium">
              <MapPin className="w-3.5 h-3.5 text-[#FFC845]" />
              <span>{user.sede_nombre || 'Sede Poroma'}</span> • <span>RDA: {user.rda || '204958'}</span>
            </p>
          </div>
          <div className="bg-white/10 p-2 rounded-2xl border border-white/20 text-center min-w-[64px]">
            <Calendar className="w-5 h-5 text-[#FFC845] mx-auto mb-1" />
            <span className="text-[10px] font-bold block text-emerald-100 uppercase">Hoy</span>
          </div>
        </div>

        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs font-medium text-emerald-100">
          <span className="capitalize">{currentDateFormatted}</span>
          <div className="flex items-center gap-1 bg-black/20 px-2.5 py-1 rounded-full">
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400 animate-ping'}`} />
            <span>{isOnline ? 'Servidor Conectado' : 'Modo Sin Conexión'}</span>
          </div>
        </div>
      </div>

      {/* Action Alerts Banner */}
      <div className="space-y-2">
        {!todayAttendance?.hora_ingreso_oficial && (
          <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-2xl text-amber-900 text-sm font-semibold flex items-center gap-3 shadow-xs">
            <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
            <span>Todavía no registraste tu ingreso para la jornada laboral de hoy.</span>
          </div>
        )}

        {pendingSyncCount > 0 && (
          <div className="p-3.5 bg-yellow-50 border-2 border-yellow-400 rounded-2xl text-yellow-950 text-sm font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-yellow-600 shrink-0" />
              <span>Tienes <strong>{pendingSyncCount}</strong> registros guardados sin sincronizar.</span>
            </div>
            <button
              onClick={() => onNavigateTab('asistencia')}
              className="text-xs bg-yellow-500 text-yellow-950 px-3 py-1.5 rounded-xl font-bold hover:bg-yellow-400"
            >
              Ver
            </button>
          </div>
        )}
      </div>

      {/* Control Documental Recuadro */}
      <ControlDocumentalCard
        control={controlDoc}
        currentUser={user}
        onOpenEdit={() => setIsEditControlModalOpen(true)}
      />

      {/* Main Clock In / Clock Out & Control Diario Card */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-6 h-6 text-[#00A651]" />
            <h3 className="font-extrabold text-lg text-[#17324D]">Control Diario de Asistencia</h3>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            Oficial CEA
          </span>
        </div>

        {message && (
          <div
            className={`p-3.5 rounded-2xl text-sm font-semibold flex items-start gap-2.5 ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
                : message.type === 'warning'
                ? 'bg-amber-50 text-amber-900 border border-amber-300'
                : 'bg-red-50 text-red-900 border border-red-300'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-[#00A651] shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Current Shift Status summary box */}
        <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-center">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase block">Hora Ingreso</span>
            <span className="text-base font-extrabold text-[#17324D]">
              {todayAttendance?.hora_ingreso_oficial
                ? new Date(todayAttendance.hora_ingreso_oficial).toLocaleTimeString('es-BO', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : '--:--'}
            </span>
            {todayAttendance?.firma_ingreso && (
              <span className="block text-[10px] text-emerald-700 font-bold mt-0.5">✓ Firma Entrada</span>
            )}
          </div>

          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase block">Hora Salida</span>
            <span className="text-base font-extrabold text-[#17324D]">
              {todayAttendance?.hora_salida_oficial
                ? new Date(todayAttendance.hora_salida_oficial).toLocaleTimeString('es-BO', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : '--:--'}
            </span>
            {todayAttendance?.firma_salida && (
              <span className="block text-[10px] text-emerald-700 font-bold mt-0.5">✓ Firma Salida</span>
            )}
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={handleRegistrarIngreso}
            disabled={loadingAction || Boolean(todayAttendance?.hora_ingreso_oficial)}
            id="btn-docente-ingreso"
            className={`h-14 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
              todayAttendance?.hora_ingreso_oficial
                ? 'bg-slate-100 text-slate-400 border border-slate-300 cursor-not-allowed'
                : 'bg-[#00A651] hover:bg-[#008f45] active:scale-[0.98] text-white'
            }`}
          >
            <Clock className="w-5 h-5" />
            <span>{todayAttendance?.hora_ingreso_oficial ? 'INGRESO' : 'MARCAR INGRESO'}</span>
          </button>

          <button
            onClick={handleRegistrarSalida}
            disabled={
              loadingAction ||
              !todayAttendance?.hora_ingreso_oficial ||
              Boolean(todayAttendance?.hora_salida_oficial)
            }
            id="btn-docente-salida"
            className={`h-14 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
              !todayAttendance?.hora_ingreso_oficial || todayAttendance?.hora_salida_oficial
                ? 'bg-slate-100 text-slate-400 border border-slate-300 cursor-not-allowed'
                : 'bg-[#11B8AE] hover:bg-teal-700 active:scale-[0.98] text-white'
            }`}
          >
            <Send className="w-5 h-5" />
            <span>{todayAttendance?.hora_salida_oficial ? 'SALIDA' : 'MARCAR SALIDA'}</span>
          </button>
        </div>

        {/* Form Trigger: Open Formulario Manual Control Diario */}
        <button
          onClick={() => setShowControlDiarioModal(true)}
          id="btn-docente-control-diario"
          className="w-full h-12 bg-emerald-50 hover:bg-emerald-100 text-[#00A651] font-extrabold text-xs sm:text-sm rounded-2xl border-2 border-[#00A651]/30 flex items-center justify-center gap-2 transition-all"
        >
          <FileText className="w-5 h-5 text-[#00A651]" />
          <span>Llenar Formulario Diario (Asistencia y Avance Pedagógico)</span>
        </button>

        {/* Display registered multigrade summary if available */}
        {multigradoRows.length > 0 && multigradoRows.some(r => r.actividad_pedagogica) && (
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
            <span className="font-bold text-[#17324D] block uppercase text-[10px] tracking-wide">
              Resumen de Avance Pedagógico Registrado Hoy:
            </span>
            <div className="space-y-1.5">
              {multigradoRows.map((r, i) => (
                <div key={r.id || i} className="bg-white p-2 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-1.5 font-bold text-[#17324D]">
                    <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] uppercase">
                      {r.area_nivel}
                    </span>
                    <span>{r.subnivel}</span>
                    {r.carrera && <span className="text-amber-700">({r.carrera})</span>}
                  </div>
                  {r.actividad_pedagogica && (
                    <p className="text-slate-600 mt-1 text-[11px]">
                      <strong className="text-slate-700">Actividad pedagógica:</strong> {r.actividad_pedagogica}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Assigned Schedule Info Card */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 space-y-3">
        <h3 className="font-extrabold text-base text-[#17324D] flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#11B8AE]" />
          <span>Horario Asignado – {user.sede_nombre || 'Sede Poroma'}</span>
        </h3>

        <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 space-y-2 text-sm text-emerald-950 font-medium">
          <div className="flex justify-between items-center">
            <span>Hora de Ingreso:</span>
            <strong className="text-base text-[#00A651]">18:30</strong>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span>Tolerancia de ingreso:</span>
            <span className="font-bold text-emerald-800">Hasta 18:40 (Puntual)</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span>Atraso contabilizado desde:</span>
            <span className="font-bold text-red-600">18:41 en adelante</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-emerald-200">
            <span>Salida Habitual:</span>
            <strong className="text-base text-[#17324D]">22:00</strong>
          </div>
        </div>
      </div>

      {/* Quick Access Grid */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onNavigateTab('estudiantes')}
          className="p-4 bg-white rounded-3xl border border-slate-200 shadow-sm hover:border-[#00A651] text-left space-y-2 transition-all"
        >
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-[#00A651] flex items-center justify-center">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-extrabold text-base text-[#17324D]">Tomar Asistencia</h4>
            <p className="text-xs text-slate-500 font-medium">Registrar lista de estudiantes hoy</p>
          </div>
        </button>

        <button
          onClick={() => onNavigateTab('seguimiento')}
          className="p-4 bg-white rounded-3xl border border-slate-200 shadow-sm hover:border-amber-400 text-left space-y-2 transition-all"
        >
          <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-extrabold text-base text-[#17324D]">Seguimiento</h4>
            <p className="text-xs text-slate-500 font-medium">Alertas de 2 o 3 faltas</p>
          </div>
        </button>
      </div>

      {/* Shift Summary Modal */}
      {showShiftSummaryModal && todayAttendance && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-center">
            <div className="w-16 h-16 bg-emerald-100 text-[#00A651] rounded-full flex items-center justify-center mx-auto">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-extrabold text-[#17324D]">Jornada Finalizada</h3>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left text-xs font-medium space-y-2">
              <div className="flex justify-between">
                <span>Entrada:</span>
                <strong className="text-slate-900">
                  {new Date(todayAttendance.hora_ingreso_oficial!).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Salida:</span>
                <strong className="text-slate-900">
                  {new Date(todayAttendance.hora_salida_oficial!).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                </strong>
              </div>
              <div className="flex justify-between text-emerald-800 font-bold">
                <span>Tiempo trabajado:</span>
                <span>{todayAttendance.horas_trabajadas} hrs</span>
              </div>
            </div>

            <button
              onClick={() => setShowShiftSummaryModal(false)}
              className="w-full h-12 bg-[#00A651] text-white font-bold rounded-2xl"
            >
              Aceptar
            </button>
          </div>
        </div>
      )}

      {/* FORMULARIO MANUAL: Control Diario de Asistencia y Avance Pedagógico Modal */}
      {showControlDiarioModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 space-y-5 shadow-2xl my-auto text-left max-h-[92vh] overflow-y-auto border border-slate-200">
            {/* Header / Title */}
            <div className="border-b border-slate-200 pb-3 flex items-start justify-between">
              <div>
                <span className="text-[10px] font-extrabold text-[#00A651] uppercase tracking-wider block">
                  Formulario de Registro Diario
                </span>
                <h3 className="font-extrabold text-lg sm:text-xl text-[#17324D]">
                  Control Diario de Asistencia y Avance Pedagógico
                </h3>
              </div>
              <button
                onClick={() => setShowControlDiarioModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            {formSavedSuccess ? (
              <div className="p-6 bg-emerald-100 text-emerald-900 font-extrabold text-center rounded-2xl space-y-2">
                <CheckCircle2 className="w-10 h-10 text-[#00A651] mx-auto" />
                <p>¡Control Diario y Avance Pedagógico guardado correctamente!</p>
              </div>
            ) : (
              <form onSubmit={handleSaveControlDiario} className="space-y-5 text-xs sm:text-sm">
                {/* Header Fields: Fecha & Docente */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1 uppercase">Fecha</label>
                    <input
                      type="date"
                      value={formFecha}
                      onChange={(e) => setFormFecha(e.target.value)}
                      className="w-full h-11 px-3 bg-white rounded-xl border border-slate-300 font-bold text-slate-800 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1 uppercase">Docente</label>
                    <input
                      type="text"
                      value={user.nombre_completo}
                      readOnly
                      className="w-full h-11 px-3 bg-slate-100 rounded-xl border border-slate-300 font-extrabold text-slate-700 cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Section: Hora y Firma de Entrada */}
                <div className="bg-emerald-50/80 p-4 rounded-2xl border border-emerald-200 space-y-3">
                  <h4 className="font-extrabold text-[#17324D] text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#00A651]" />
                    <span>Registro e Ingreso Oficial</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Hora de Entrada</label>
                      <input
                        type="time"
                        value={formHoraEntrada}
                        onChange={(e) => setFormHoraEntrada(e.target.value)}
                        className="w-full h-11 px-3 bg-white rounded-xl border border-slate-300 font-bold text-slate-800"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Firma de Entrada</label>
                      <button
                        type="button"
                        onClick={() => setFirmaEntrada(!firmaEntrada)}
                        className={`w-full h-11 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                          firmaEntrada
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white border-2 border-slate-300 text-slate-600'
                        }`}
                      >
                        {firmaEntrada ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-200" />
                            <span>✓ Firma de Entrada Validada</span>
                          </>
                        ) : (
                          <>
                            <PenTool className="w-4 h-4 text-slate-400" />
                            <span>Hacer Clic para Firmar Entrada</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Section: Multigrade Levels & Pedagogical Activity */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div>
                      <h4 className="font-extrabold text-sm text-[#17324D]">
                        Desarrollo de Clases (Atención Multigrado)
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Puede agregar varias filas de nivel y actividad pedagógica para la misma jornada.
                      </p>
                    </div>
                  </div>

                  {/* Rows List */}
                  <div className="space-y-3">
                    {multigradoRows.map((row, index) => (
                      <div
                        key={row.id}
                        className="p-4 bg-slate-50 rounded-2xl border border-slate-300 space-y-3 relative"
                      >
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <span className="font-extrabold text-xs text-[#17324D] uppercase">
                            Nivel / Área N° {index + 1}
                          </span>
                          {multigradoRows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveMultigradoRow(row.id)}
                              className="text-red-600 hover:text-red-800 font-bold text-xs flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Eliminar</span>
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Área o Nivel Educativo */}
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Área o Nivel Educativo
                            </label>
                            <select
                              value={row.area_nivel}
                              onChange={(e) => handleAreaChange(row.id, e.target.value)}
                              className="w-full h-11 px-3 bg-white rounded-xl border border-slate-300 font-bold text-slate-800 outline-none"
                            >
                              <option value="EPA">EPA (Primaria Adultos)</option>
                              <option value="ESA">ESA (Secundaria Adultos)</option>
                              <option value="ETA">ETA (Técnica Tecnológica Adultos)</option>
                            </select>
                          </div>

                          {/* Subnivel */}
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Subnivel</label>
                            <select
                              value={row.subnivel}
                              onChange={(e) => handleRowFieldChange(row.id, 'subnivel', e.target.value)}
                              className="w-full h-11 px-3 bg-white rounded-xl border border-slate-300 font-bold text-slate-800 outline-none"
                            >
                              {(SUBNIVELES_POR_AREA[row.area_nivel] || []).map((sub) => (
                                <option key={sub} value={sub}>
                                  {sub}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Carrera (Only for ETA) */}
                        {row.area_nivel === 'ETA' && (
                          <div>
                            <label className="block text-xs font-bold text-amber-900 mb-1">
                              Carrera / Especialidad (ETA)
                            </label>
                            <input
                              type="text"
                              list={`carreras-list-${row.id}`}
                              value={row.carrera || ''}
                              onChange={(e) => handleRowFieldChange(row.id, 'carrera', e.target.value)}
                              placeholder="Ej. Gastronomía, Sistemas Informáticos, Corte y Confección..."
                              className="w-full h-11 px-3 bg-white rounded-xl border border-amber-300 font-bold text-slate-800 outline-none"
                              required={row.area_nivel === 'ETA'}
                            />
                            <datalist id={`carreras-list-${row.id}`}>
                              {CARRERAS_ETA_SUGERIDAS.map((carr) => (
                                <option key={carr} value={carr} />
                              ))}
                            </datalist>
                          </div>
                        )}

                        {/* Actividad Pedagógica */}
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Actividad Pedagógica (Avance del día)
                          </label>
                          <textarea
                            rows={2}
                            value={row.actividad_pedagogica}
                            onChange={(e) => handleRowFieldChange(row.id, 'actividad_pedagogica', e.target.value)}
                            placeholder="Escriba brevemente el tema o actividad pedagógica realmente avanzada ese día..."
                            className="w-full p-3 bg-white rounded-xl border border-slate-300 font-medium text-xs sm:text-sm outline-none"
                            required
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Row Button */}
                  <button
                    type="button"
                    onClick={handleAddMultigradoRow}
                    className="w-full h-11 border-2 border-dashed border-[#00A651]/50 text-[#00A651] bg-emerald-50/50 hover:bg-emerald-50 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar otro nivel / área (Atención Multigrado)</span>
                  </button>
                </div>

                {/* Section: Estado de Salida Oficial */}
                <div className="bg-teal-50/80 p-4 rounded-2xl border border-teal-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-[#17324D] text-sm flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#11B8AE]" />
                      <span>Salida Oficial de la Jornada</span>
                    </h4>
                    {todayAttendance?.hora_salida_oficial ? (
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Registrada (
                        {new Date(todayAttendance.hora_salida_oficial).toLocaleTimeString('es-BO', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                        )
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-amber-100 text-amber-800 font-bold text-xs rounded-xl flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Pendiente
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 font-medium">
                    {todayAttendance?.hora_salida_oficial
                      ? 'Tu salida oficial ya fue verificada y registrada correctamente con GPS.'
                      : 'La salida oficial se realiza únicamente mediante el botón "MARCAR SALIDA" con verificación GPS en la pantalla principal al concluir tu turno.'}
                  </p>
                </div>

                {/* Verification note */}
                <p className="text-[11px] text-slate-500 font-medium bg-slate-100 p-3 rounded-xl text-center border border-slate-200">
                  <strong className="text-slate-700">Nota Institucional:</strong> Este formulario registra el avance pedagógico del día. El control horario de entrada y salida se valida mediante GPS y selfie en el panel docente.
                </p>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowControlDiarioModal(false)}
                    className="flex-1 h-12 border border-slate-300 rounded-2xl font-bold text-slate-600 hover:bg-slate-100"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 h-12 bg-[#00A651] hover:bg-[#008f45] text-white rounded-2xl font-extrabold flex items-center justify-center gap-2 shadow-md"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Guardar Control Diario</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Clock-In GPS and Selfie Verification Modal */}
      {showClockInVerificationModal && (
        <ClockInVerificationModal
          user={user}
          isOnline={isOnline}
          onClose={() => setShowClockInVerificationModal(false)}
          onSuccess={handleClockInSuccess}
        />
      )}

      {/* Control Documental Edit Modal */}
      {isEditControlModalOpen && (
        <EditControlDocumentalModal
          docente={user}
          currentControl={controlDoc}
          currentUser={user}
          onClose={() => setIsEditControlModalOpen(false)}
          onSaveSuccess={(updated) => setControlDoc(updated)}
        />
      )}
    </div>
  );
};
