import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Camera,
  Eye,
  FileCheck,
  Search,
  Filter,
  Check,
  X,
  Edit3,
  Calendar,
  UserCheck,
  ArrowRight,
  Info,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import {
  Perfil,
  IncidenciaAsistenciaDocente,
  EstadoIncidenciaAsistencia,
  TipoIncidenciaAsistencia,
  Sede
} from '../types';
import {
  loadIncidenciasAsistencia,
  resolverIncidenciaAsistencia,
  evaluarYGenerarIncidenciasDelDia,
  getLocalIncidencias
} from '../lib/incidencias';
import { getBoliviaTodayDate } from '../lib/geo';

interface AttendanceIncidentsModalProps {
  user: Perfil;
  onClose: () => void;
  docentesList?: Perfil[];
  sedesList?: Sede[];
}

export const AttendanceIncidentsModal: React.FC<AttendanceIncidentsModalProps> = ({
  user,
  onClose,
  docentesList = [],
  sedesList = []
}) => {
  const [incidencias, setIncidencias] = useState<IncidenciaAsistenciaDocente[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [sedeFilter, setSedeFilter] = useState<string>('todas');
  const [tipoFilter, setTipoFilter] = useState<string>('todos');

  // Detalle e Inspección modal
  const [selectedIncidencia, setSelectedIncidencia] = useState<IncidenciaAsistenciaDocente | null>(null);
  
  // Acciones Director
  const [actionType, setActionType] = useState<'justificar' | 'falta_confirmada' | 'corregir' | null>(null);
  const [motivoPreset, setMotivoPreset] = useState<string>('Problema técnico');
  const [motivoTexto, setMotivoTexto] = useState<string>('');
  const [observacionesExtra, setObservacionesExtra] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Ver Selfie
  const [previewSelfie, setPreviewSelfie] = useState<string | null>(null);

  const isDirector = user.rol === 'superadmin' || user.rol === 'director';

  const fetchIncidencias = async () => {
    setLoading(true);
    try {
      const data = await loadIncidenciasAsistencia(isDirector ? undefined : user.id);
      setIncidencias(data);
    } catch (e) {
      console.error('Error cargando incidencias:', e);
      setIncidencias(getLocalIncidencias());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidencias();
    const handleChanged = () => fetchIncidencias();
    window.addEventListener('incidenciasChanged', handleChanged);
    return () => window.removeEventListener('incidenciasChanged', handleChanged);
  }, [user.id, isDirector]);

  // Resumen / Contadores de Métricas
  const counts = useMemo(() => {
    return {
      pendientes: incidencias.filter(i => i.estado === 'pendiente').length,
      justificadas: incidencias.filter(i => i.estado === 'justificado').length,
      faltas: incidencias.filter(i => i.estado === 'falta_confirmada').length,
      corregidas: incidencias.filter(i => i.estado === 'corregido').length,
      total: incidencias.length,
    };
  }, [incidencias]);

  // Filtros aplicados
  const filteredIncidencias = useMemo(() => {
    return incidencias.filter(inc => {
      // Estado
      if (statusFilter !== 'todos' && inc.estado !== statusFilter) return false;
      // Sede
      if (sedeFilter !== 'todas' && inc.sede_nombre !== sedeFilter) return false;
      // Tipo
      if (tipoFilter !== 'todos' && inc.tipo_incidencia !== tipoFilter) return false;
      // Búsqueda
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const docName = (inc.docente_nombre || '').toLowerCase();
        const rda = (inc.docente_rda || '').toLowerCase();
        const detalle = (inc.detalle || '').toLowerCase();
        return docName.includes(term) || rda.includes(term) || detalle.includes(term);
      }
      return true;
    });
  }, [incidencias, statusFilter, sedeFilter, tipoFilter, searchTerm]);

  // Manejar apertura de resolución
  const handleOpenAction = (inc: IncidenciaAsistenciaDocente, type: 'justificar' | 'falta_confirmada' | 'corregir') => {
    setSelectedIncidencia(inc);
    setActionType(type);
    setActionError(null);
    setActionSuccess(null);
    setObservacionesExtra('');

    if (type === 'justificar') {
      setMotivoPreset('Problema técnico');
      setMotivoTexto('Problema técnico / Falla de conectividad o satelital en el dispositivo');
    } else if (type === 'falta_confirmada') {
      setMotivoPreset('Inasistencia no justificada');
      setMotivoTexto('Inasistencia no justificada a la jornada laboral del CEA');
    } else {
      setMotivoPreset('Corrección de registro');
      setMotivoTexto('Corrección administrativa autorizada por Dirección Institucional');
    }
  };

  const handlePresetChange = (preset: string) => {
    setMotivoPreset(preset);
    if (preset === 'Problema técnico') {
      setMotivoTexto('Problema técnico / Falla de conectividad o satelital en el dispositivo');
    } else if (preset === 'Comisión institucional') {
      setMotivoTexto('Comisión institucional / Actividad oficial autorizada fuera de sede');
    } else if (preset === 'Olvido de marcación') {
      setMotivoTexto('Olvido de marcación de salida / Verificada presencia laboral en aula');
    } else if (preset === 'Actividad autorizada') {
      setMotivoTexto('Actividad pedagógica comunitaria autorizada por Dirección');
    } else if (preset === 'Inasistencia no justificada') {
      setMotivoTexto('Inasistencia no justificada a la jornada laboral');
    } else if (preset === 'Abandono de jornada') {
      setMotivoTexto('Abandono injustificado antes de la hora reglamentaria de salida');
    } else if (preset === 'Otro') {
      setMotivoTexto('');
    }
  };

  const handleConfirmAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncidencia || !actionType) return;

    if (!motivoTexto.trim()) {
      setActionError('El motivo de la resolución es estrictamente obligatorio.');
      return;
    }

    setIsProcessing(true);
    setActionError(null);

    const nuevoEstado: EstadoIncidenciaAsistencia =
      actionType === 'justificar'
        ? 'justificado'
        : actionType === 'falta_confirmada'
        ? 'falta_confirmada'
        : 'corregido';

    const res = await resolverIncidenciaAsistencia({
      incidenciaId: selectedIncidencia.id,
      nuevoEstado,
      motivoResolucion: motivoTexto.trim(),
      directorUser: user,
      observacionesAdicionales: observacionesExtra.trim(),
    });

    setIsProcessing(false);

    if (res.success) {
      setActionSuccess('Incidencia resuelta y registrada en el módulo de auditoría con éxito.');
      setTimeout(() => {
        setActionType(null);
        setSelectedIncidencia(null);
        fetchIncidencias();
      }, 700);
    } else {
      setActionError(res.error || 'Ocurrió un error al resolver la incidencia.');
    }
  };

  const formatTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'sin_salida':
        return 'Sin salida registrada';
      case 'sin_ingreso':
        return 'Sin ingreso registrado';
      case 'sin_registro':
        return 'Sin marcaciones (Jornada vacía)';
      case 'problema_gps':
        return 'Ubicación GPS observada';
      case 'problema_selfie':
        return 'Selfie no validada';
      case 'registro_incompleto':
        return 'Registro incompleto';
      case 'error_tecnico':
        return 'Error técnico / Sin conexión';
      default:
        return tipo;
    }
  };

  const renderBadgeEstado = (estado: EstadoIncidenciaAsistencia) => {
    switch (estado) {
      case 'pendiente':
        return (
          <span className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-[11px] font-extrabold flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Pendiente</span>
          </span>
        );
      case 'justificado':
        return (
          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full text-[11px] font-extrabold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#00A651]" />
            <span>Justificado</span>
          </span>
        );
      case 'falta_confirmada':
        return (
          <span className="px-2.5 py-1 bg-rose-100 text-rose-900 border border-rose-300 rounded-full text-[11px] font-extrabold flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>Falta Confirmada</span>
          </span>
        );
      case 'corregido':
        return (
          <span className="px-2.5 py-1 bg-blue-100 text-blue-900 border border-blue-300 rounded-full text-[11px] font-extrabold flex items-center gap-1">
            <Edit3 className="w-3.5 h-3.5 text-blue-600" />
            <span>Corregido</span>
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 rounded-2xl text-amber-700 border border-amber-200">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-black text-lg sm:text-xl text-[#17324D] leading-tight">
                Panel de Incidencias de Asistencia Docente
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Revisión y dictamen administrativo de marcaciones incompletas del CEA (Regla de No Falta Automática)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tarjetas Resumen */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
          <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">⚠️ Pendientes</span>
              <strong className="text-xl font-black text-amber-900">{counts.pendientes}</strong>
            </div>
            <span className="text-xs text-amber-700 font-medium">Por revisar</span>
          </div>

          <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">✅ Justificadas</span>
              <strong className="text-xl font-black text-[#00A651]">{counts.justificadas}</strong>
            </div>
            <span className="text-xs text-emerald-700 font-medium">Con respaldo</span>
          </div>

          <div className="p-3 bg-rose-50/80 border border-rose-200 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">❌ Faltas</span>
              <strong className="text-xl font-black text-rose-700">{counts.faltas}</strong>
            </div>
            <span className="text-xs text-rose-700 font-medium">Confirmadas</span>
          </div>

          <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">✏️ Corregidas</span>
              <strong className="text-xl font-black text-blue-700">{counts.corregidas}</strong>
            </div>
            <span className="text-xs text-blue-700 font-medium">Ajustadas</span>
          </div>
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por docente, RDA o detalle..."
              className="w-full h-9.5 pl-9 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium text-slate-900 focus:border-[#00A651]"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {/* Estado filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none"
            >
              <option value="todos">Todos los Estados</option>
              <option value="pendiente">⚠️ Pendientes</option>
              <option value="justificado">✅ Justificadas</option>
              <option value="falta_confirmada">❌ Faltas Confirmadas</option>
              <option value="corregido">✏️ Corregidas</option>
            </select>

            {/* Sede filter */}
            <select
              value={sedeFilter}
              onChange={(e) => setSedeFilter(e.target.value)}
              className="h-9.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none"
            >
              <option value="todas">Todas las Sedes</option>
              {sedesList.map(s => (
                <option key={s.id} value={s.nombre}>{s.nombre}</option>
              ))}
            </select>

            {/* Botón Refrescar */}
            <button
              onClick={fetchIncidencias}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all"
              title="Refrescar listado"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Listado Principal de Incidencias */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {loading ? (
            <div className="p-8 text-center text-xs font-bold text-slate-500 bg-slate-50 rounded-2xl border border-slate-200 animate-pulse">
              Cargando incidencias de asistencia docente...
            </div>
          ) : filteredIncidencias.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-[#00A651] mx-auto" />
              <p className="font-bold text-slate-700 text-sm">No existen incidencias de asistencia docente registradas</p>
              <p className="text-slate-500 text-xs">
                Todas las marcaciones de los docentes registrados cumplen con la normativa o no presentan observaciones pendientes.
              </p>
            </div>
          ) : (
            filteredIncidencias.map((inc) => (
              <div
                key={inc.id}
                className="p-3.5 bg-white border border-slate-200 hover:border-slate-300 rounded-2xl shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <strong className="text-sm text-[#17324D]">{inc.docente_nombre || 'Docente'}</strong>
                    {inc.docente_rda && (
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold">
                        RDA: {inc.docente_rda}
                      </span>
                    )}
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-600 font-medium flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#00A651]" />
                      {inc.sede_nombre || 'Sede no especificada'}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-600 font-bold flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      {inc.fecha}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
                    <span className="font-extrabold text-[#17324D] bg-slate-100 px-2 py-0.5 rounded-md">
                      {formatTipoLabel(inc.tipo_incidencia)}
                    </span>
                    <span>Horario: <strong>{inc.horario_esperado || 'Sin definir'}</strong></span>
                    {inc.hora_ingreso && (
                      <span>Ingreso: <strong className="text-[#00A651]">{inc.hora_ingreso}</strong></span>
                    )}
                    {inc.hora_salida ? (
                      <span>Salida: <strong className="text-[#17324D]">{inc.hora_salida}</strong></span>
                    ) : (
                      <span className="text-rose-600 font-bold">Salida: No registrada</span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-1 italic">
                    "{inc.detalle || 'Sin detalle adicional'}"
                  </p>

                  {inc.resolucion && (
                    <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-700 flex items-start gap-1.5">
                      <FileCheck className="w-3.5 h-3.5 text-[#00A651] shrink-0 mt-0.5" />
                      <div>
                        <strong>Resolución:</strong> {inc.resolucion}
                        {inc.resuelto_por_nombre && (
                          <span className="text-slate-500 ml-1">({inc.resuelto_por_nombre})</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Columna Derecha: Estado & Botones de Acción */}
                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0">
                  <div>{renderBadgeEstado(inc.estado)}</div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Botón Ver Detalle */}
                    <button
                      onClick={() => setSelectedIncidencia(inc)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1 transition-all"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Detalle</span>
                    </button>

                    {/* Botones de Dictamen para el Director */}
                    {isDirector && (
                      <>
                        <button
                          onClick={() => handleOpenAction(inc, 'justificar')}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-xs transition-all"
                          title="Justificar incidencia institucional"
                        >
                          <Check className="w-3.5 h-3.5 text-amber-300" />
                          <span>Justificar</span>
                        </button>

                        <button
                          onClick={() => handleOpenAction(inc, 'falta_confirmada')}
                          className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-xs transition-all"
                          title="Declarar falta confirmada con motivo obligatorio"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Falta</span>
                        </button>

                        <button
                          onClick={() => handleOpenAction(inc, 'corregir')}
                          className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-xs transition-all"
                          title="Corregir o registrar observación administrativa"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Corregir</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal de Detalle Completo de la Incidencia */}
        {selectedIncidencia && !actionType && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-100 rounded-xl text-amber-800">
                    <Eye className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-[#17324D]">Expediente de Incidencia</h3>
                    <p className="text-xs text-slate-500 font-medium">{selectedIncidencia.docente_nombre} • {selectedIncidencia.fecha}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedIncidencia(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                {/* Resumen del Docente y Sede */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-2 gap-2 font-medium">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Docente:</span>
                    <strong className="text-[#17324D]">{selectedIncidencia.docente_nombre}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">RDA:</span>
                    <strong className="text-slate-700">{selectedIncidencia.docente_rda || 'No registrado'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Sede:</span>
                    <strong className="text-slate-700">{selectedIncidencia.sede_nombre}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Horario Esperado:</span>
                    <strong className="text-[#00A651]">{selectedIncidencia.horario_esperado || 'Sin definir'}</strong>
                  </div>
                </div>

                {/* Evidencias de Marcación */}
                <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-2">
                  <span className="font-extrabold text-[#17324D] block uppercase tracking-wider text-[11px]">
                    Evidencias Registradas de la Jornada
                  </span>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-white rounded-xl border border-emerald-100">
                      <span className="text-slate-500 block text-[10px]">Hora de Ingreso:</span>
                      <strong className="text-[#00A651] text-sm">
                        {selectedIncidencia.hora_ingreso ? `${selectedIncidencia.hora_ingreso} ✅` : 'No registrada ❌'}
                      </strong>
                    </div>

                    <div className="p-2 bg-white rounded-xl border border-emerald-100">
                      <span className="text-slate-500 block text-[10px]">Hora de Salida:</span>
                      <strong className="text-[#17324D] text-sm">
                        {selectedIncidencia.hora_salida ? `${selectedIncidencia.hora_salida} ✅` : 'No registrada ❌'}
                      </strong>
                    </div>

                    <div className="p-2 bg-white rounded-xl border border-emerald-100">
                      <span className="text-slate-500 block text-[10px]">Geolocalización GPS:</span>
                      <strong className="text-slate-800">
                        {selectedIncidencia.estado_gps === 'dentro_rango' ? 'Dentro de sede ✅' : selectedIncidencia.estado_gps === 'fuera_rango' ? `Fuera de rango (${selectedIncidencia.distancia_m}m) ⚠️` : selectedIncidencia.estado_gps || 'Sin GPS ❌'}
                      </strong>
                    </div>

                    <div className="p-2 bg-white rounded-xl border border-emerald-100 flex items-center justify-between">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Selfie de Ingreso:</span>
                        <strong className="text-slate-800">
                          {selectedIncidencia.selfie_url ? 'Registrada ✅' : 'No capturada ❌'}
                        </strong>
                      </div>
                      {selectedIncidencia.selfie_url && (
                        <button
                          type="button"
                          onClick={() => setPreviewSelfie(selectedIncidencia.selfie_url!)}
                          className="px-2 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg text-[10px]"
                        >
                          Ver
                        </button>
                      )}
                    </div>
                  </div>

                  {selectedIncidencia.actividad_pedagogica && (
                    <div className="p-2 bg-white rounded-xl border border-emerald-100 text-[11px]">
                      <span className="text-slate-500 block text-[10px]">Actividad Pedagógica Reportada:</span>
                      <p className="text-slate-800 font-semibold">{selectedIncidencia.actividad_pedagogica}</p>
                    </div>
                  )}
                </div>

                {/* Detalle del Problema */}
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs">
                  <span className="font-extrabold text-amber-950 block mb-1">Descripción de la Incidencia:</span>
                  <p className="text-amber-900">{selectedIncidencia.detalle}</p>
                </div>

                {/* Dictamen Existente */}
                {selectedIncidencia.resolucion && (
                  <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200 text-xs">
                    <span className="font-extrabold text-blue-950 block mb-1">Dictamen de Dirección:</span>
                    <p className="text-blue-900">{selectedIncidencia.resolucion}</p>
                    {selectedIncidencia.resuelto_por_nombre && (
                      <span className="text-[10px] text-blue-700 block mt-1">
                        Dictaminado por: {selectedIncidencia.resuelto_por_nombre} el {selectedIncidencia.fecha_resolucion ? new Date(selectedIncidencia.fecha_resolucion).toLocaleString('es-BO') : ''}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  onClick={() => setSelectedIncidencia(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cerrar
                </button>
                {isDirector && (
                  <button
                    onClick={() => handleOpenAction(selectedIncidencia, 'justificar')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs"
                  >
                    Dictaminar Incidencia
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal de Acción / Dictamen de Dirección */}
        {actionType && selectedIncidencia && (
          <div className="fixed inset-0 z-70 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-xl text-white ${
                    actionType === 'justificar'
                      ? 'bg-[#00A651]'
                      : actionType === 'falta_confirmada'
                      ? 'bg-rose-600'
                      : 'bg-blue-600'
                  }`}>
                    {actionType === 'justificar' ? (
                      <Check className="w-5 h-5" />
                    ) : actionType === 'falta_confirmada' ? (
                      <X className="w-5 h-5" />
                    ) : (
                      <Edit3 className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-[#17324D]">
                      {actionType === 'justificar'
                        ? 'Justificar Asistencia Docente'
                        : actionType === 'falta_confirmada'
                        ? 'Confirmar Falta Institucional'
                        : 'Corregir Registro Administrativo'}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Docente: {selectedIncidencia.docente_nombre} • {selectedIncidencia.fecha}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActionType(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {actionError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {actionSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#00A651] shrink-0" />
                  <span>{actionSuccess}</span>
                </div>
              )}

              <form onSubmit={handleConfirmAction} className="space-y-3.5 text-xs font-bold">
                {/* Presets de Motivo */}
                <div>
                  <label className="block text-slate-700 mb-1">Motivo Institucional *</label>
                  <select
                    value={motivoPreset}
                    onChange={(e) => handlePresetChange(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-semibold text-slate-900"
                  >
                    {actionType === 'justificar' && (
                      <>
                        <option value="Problema técnico">Problema técnico (conectividad / GPS)</option>
                        <option value="Comisión institucional">Comisión institucional autorizada</option>
                        <option value="Olvido de marcación">Olvido de marcación de salida</option>
                        <option value="Actividad autorizada">Actividad pedagógica comunitaria</option>
                        <option value="Otro">Otro motivo justificado</option>
                      </>
                    )}
                    {actionType === 'falta_confirmada' && (
                      <>
                        <option value="Inasistencia no justificada">Inasistencia no justificada</option>
                        <option value="Abandono de jornada">Abandono injustificado de jornada</option>
                        <option value="Otro">Otro motivo de sanción</option>
                      </>
                    )}
                    {actionType === 'corregir' && (
                      <>
                        <option value="Corrección de registro">Corrección de horario/marcación</option>
                        <option value="Otro">Ajuste con observación</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Explicación Detallada */}
                <div>
                  <label className="block text-slate-700 mb-1">
                    Descripción / Dictamen del Director *
                  </label>
                  <textarea
                    rows={3}
                    value={motivoTexto}
                    onChange={(e) => setMotivoTexto(e.target.value)}
                    placeholder="Detalle los motivos y fundamentos institucionales del dictamen..."
                    className="w-full p-3 bg-white border border-slate-300 rounded-xl outline-none font-medium text-slate-900 focus:border-[#00A651]"
                    required
                  />
                </div>

                {/* Observaciones Extra */}
                <div>
                  <label className="block text-slate-700 mb-1">
                    Observaciones Adicionales (Opcional)
                  </label>
                  <input
                    type="text"
                    value={observacionesExtra}
                    onChange={(e) => setObservacionesExtra(e.target.value)}
                    placeholder="Ej. Respaldado con memorándum Nº 12/2026"
                    className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl outline-none font-medium text-slate-900"
                  />
                </div>

                {/* Nota de Auditoría */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 font-medium flex items-center gap-2">
                  <Info className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>
                    Esta resolución se registrará automáticamente en el <strong>Módulo de Auditoría</strong> con su usuario responsable ({user.nombre_completo}).
                  </span>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActionType(null)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className={`px-5 py-2.5 text-white font-extrabold rounded-xl shadow-md flex items-center gap-1.5 ${
                      actionType === 'justificar'
                        ? 'bg-[#00A651] hover:bg-[#008f45]'
                        : actionType === 'falta_confirmada'
                        ? 'bg-rose-600 hover:bg-rose-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isProcessing ? (
                      <span>Procesando...</span>
                    ) : (
                      <>
                        <FileCheck className="w-4 h-4" />
                        <span>Guardar Dictamen</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Vista Previa Selfie */}
        {previewSelfie && (
          <div className="fixed inset-0 z-80 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full p-4 space-y-3 text-center">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="font-extrabold text-sm text-[#17324D]">Selfie de Verificación</span>
                <button
                  onClick={() => setPreviewSelfie(null)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <img
                src={previewSelfie}
                alt="Selfie"
                className="w-full h-64 object-cover rounded-2xl border"
              />
              <button
                onClick={() => setPreviewSelfie(null)}
                className="w-full py-2 bg-slate-800 text-white font-bold text-xs rounded-xl"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
