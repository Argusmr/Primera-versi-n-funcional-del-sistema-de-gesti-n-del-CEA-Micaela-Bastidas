import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  PhoneCall,
  MessageSquare,
  Home,
  UserCheck,
  Send,
  CheckCircle2,
  Clock,
  Plus,
  FileSpreadsheet,
  Loader2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { Perfil, AlertaEstudiante, Seguimiento, AccionSeguimiento } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { saveOfflineSeguimiento } from '../lib/db';
import { downloadAtRiskReport } from '../lib/excelExport';

interface FollowUpViewProps {
  user: Perfil;
  isOnline: boolean;
}

export const FollowUpView: React.FC<FollowUpViewProps> = ({ user, isOnline }) => {
  const [alertas, setAlertas] = useState<AlertaEstudiante[]>([]);
  const [seguimientos, setSeguimientos] = useState<Seguimiento[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [showLogModal, setShowLogModal] = useState<boolean>(false);
  const [selectedAlerta, setSelectedAlerta] = useState<AlertaEstudiante | null>(null);

  // New follow-up form state
  const [motivo, setMotivo] = useState<string>('Inasistencia a 3 sesiones consecutivas');
  const [accion, setAccion] = useState<AccionSeguimiento>('llamada');
  const [resultado, setResultado] = useState<string>('');
  const [proximaAccion, setProximaAccion] = useState<string>('');
  const [observacion, setObservacion] = useState<string>('');
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadFollowUpData = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      setAlertas([]);
      setSeguimientos([]);
      return;
    }

    setLoading(true);
    setFetchError(null);

    try {
      // 1. Query alertas_estudiantes with separate lookups to avoid ambiguous embed issues
      const [alertasRes, seguimientosRes] = await Promise.all([
        supabase
          .from('alertas_estudiantes')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('seguimientos')
          .select('*')
          .order('created_at', { ascending: false })
      ]);

      if (alertasRes.error) {
        throw new Error(`Error en alertas_estudiantes: ${alertasRes.error.message}`);
      }
      if (seguimientosRes.error) {
        throw new Error(`Error en seguimientos: ${seguimientosRes.error.message}`);
      }

      const rawAlertas = alertasRes.data || [];
      const rawSeguimientos = seguimientosRes.data || [];

      // Collect IDs for enrichment
      const estudianteIds = Array.from(
        new Set([
          ...rawAlertas.map((a: any) => a.estudiante_id),
          ...rawSeguimientos.map((s: any) => s.estudiante_id)
        ].filter(Boolean))
      );

      const grupoIds = Array.from(
        new Set(rawAlertas.map((a: any) => a.grupo_id).filter(Boolean))
      );

      const docenteIds = Array.from(
        new Set([
          ...rawAlertas.map((a: any) => a.docente_id),
          ...rawSeguimientos.map((s: any) => s.docente_id)
        ].filter(Boolean))
      );

      // Fetch lookup dictionaries in parallel
      const [estudiantesRes, gruposRes, perfilesRes] = await Promise.all([
        estudianteIds.length > 0
          ? supabase.from('estudiantes').select('id, nombre_completo, codigo_interno').in('id', estudianteIds)
          : Promise.resolve({ data: [] }),
        grupoIds.length > 0
          ? supabase.from('grupos').select('id, nombre, carrera_especialidad').in('id', grupoIds)
          : Promise.resolve({ data: [] }),
        docenteIds.length > 0
          ? supabase.from('perfiles').select('id, nombre_completo').in('id', docenteIds)
          : Promise.resolve({ data: [] })
      ]);

      const estudiantesMap = new Map<string, string>();
      ((estudiantesRes as any).data || []).forEach((e: any) => estudiantesMap.set(e.id, e.nombre_completo));

      const gruposMap = new Map<string, string>();
      ((gruposRes as any).data || []).forEach((g: any) => gruposMap.set(g.id, g.nombre));

      const docentesMap = new Map<string, string>();
      ((perfilesRes as any).data || []).forEach((d: any) => docentesMap.set(d.id, d.nombre_completo));

      // Enrich alertas
      const mappedAlertas: AlertaEstudiante[] = rawAlertas.map((a: any) => ({
        ...a,
        estudiante_nombre: estudiantesMap.get(a.estudiante_id) || 'Estudiante no encontrado',
        grupo_nombre: gruposMap.get(a.grupo_id) || 'Grupo no especificado',
        docente_nombre: docentesMap.get(a.docente_id) || 'Docente sin asignar'
      }));

      // Enrich seguimientos
      const mappedSeguimientos: Seguimiento[] = rawSeguimientos.map((s: any) => ({
        ...s,
        estudiante_nombre: estudiantesMap.get(s.estudiante_id) || 'Estudiante no encontrado',
        docente_nombre: docentesMap.get(s.docente_id) || 'Docente responsable'
      }));

      setAlertas(mappedAlertas);
      setSeguimientos(mappedSeguimientos);
    } catch (err: any) {
      console.error('Error al cargar alertas y seguimientos:', err);
      setFetchError(err.message || 'Error al conectar con la base de datos.');
      setAlertas([]);
      setSeguimientos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFollowUpData();
  }, [loadFollowUpData]);

  const handleOpenLogModal = (alerta: AlertaEstudiante) => {
    setSelectedAlerta(alerta);
    setMotivo(`Faltas consecutivas: ${alerta.faltas_consecutivas} sesiones ausente.`);
    setShowLogModal(true);
  };

  const handleSubmitFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlerta || !resultado) return;

    setSubmitting(true);
    const syncKey = `seg-${selectedAlerta.id}-${Date.now()}`;
    const today = new Date().toISOString().slice(0, 10);

    const newSegPayload = {
      alerta_id: selectedAlerta.id,
      estudiante_id: selectedAlerta.estudiante_id,
      docente_id: user.id,
      fecha: today,
      motivo,
      accion_realizada: accion,
      resultado,
      proxima_accion: proximaAccion || null,
      observacion: observacion || null,
      estado: 'cerrado' as const
    };

    if (isOnline && isSupabaseConfigured && supabase) {
      try {
        const insertRes = await supabase
          .from('seguimientos')
          .insert(newSegPayload)
          .select();

        if (insertRes.error) {
          console.warn('Error insertando en Supabase seguimientos, guardando en cola offline:', insertRes.error);
          await saveOfflineSeguimiento({
            sync_key: syncKey,
            ...newSegPayload,
            timestamp: Date.now()
          });
        }

        // Update alerta status in Supabase
        await supabase
          .from('alertas_estudiantes')
          .update({ estado: 'atendido' })
          .eq('id', selectedAlerta.id);
      } catch (err) {
        console.error('Fallo de red en seguimiento:', err);
      }
    } else {
      await saveOfflineSeguimiento({
        sync_key: syncKey,
        ...newSegPayload,
        timestamp: Date.now()
      });
    }

    const newSeg: Seguimiento = {
      id: syncKey,
      ...newSegPayload,
      estudiante_nombre: selectedAlerta.estudiante_nombre,
      docente_nombre: user.nombre_completo
    };

    setSeguimientos(prev => [newSeg, ...prev]);

    // Update alert status locally
    setAlertas(prev =>
      prev.map(a => (a.id === selectedAlerta.id ? { ...a, estado: 'atendido' } : a))
    );

    setSavedSuccess(true);
    setSubmitting(false);
    setTimeout(() => {
      setShowLogModal(false);
      setSavedSuccess(false);
    }, 1200);
  };

  const handleDownloadExcel = () => {
    downloadAtRiskReport(alertas, seguimientos);
  };

  return (
    <div className="space-y-5 pb-20">
      {/* Title & Download */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-[#17324D]">Seguimiento a Estudiantes</h2>
          <p className="text-xs text-slate-500 font-medium">Alertas automáticas y compromisos de reincorporación</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadFollowUpData}
            disabled={loading}
            title="Recargar datos"
            className="p-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleDownloadExcel}
            className="h-10 px-3 bg-[#17324D] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm hover:bg-slate-900 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#FFC845]" />
            <span>Reporte Excel</span>
          </button>
        </div>
      </div>

      {/* Error state if database query failed */}
      {fetchError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-800 text-xs">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="block font-bold">Aviso de consulta</strong>
            <p>{fetchError}</p>
          </div>
          <button
            onClick={loadFollowUpData}
            className="px-3 py-1 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shrink-0"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center flex flex-col items-center justify-center gap-2 shadow-xs">
          <Loader2 className="w-7 h-7 text-[#00A651] animate-spin" />
          <span className="text-xs font-bold text-slate-500">Cargando alertas y seguimientos desde Supabase...</span>
        </div>
      )}

      {!loading && (
        <>
          {/* Active Alerts List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                Alertas Pendientes de Intervención
              </h3>
              <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full">
                {alertas.filter(a => a.estado === 'pendiente').length} Pendientes
              </span>
            </div>

            {alertas.length === 0 ? (
              <div className="p-6 bg-white rounded-3xl text-center border border-slate-200 text-slate-500 text-sm">
                No existen estudiantes en riesgo en este momento.
              </div>
            ) : (
              alertas.map((alt) => {
                const isRed = alt.tipo === 'rojo_3_faltas';
                const isAttended = alt.estado === 'atendido' || alt.estado === 'reincorporado';

                return (
                  <div
                    key={alt.id}
                    className={`p-5 rounded-3xl border shadow-xs space-y-3 ${
                      isAttended
                        ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                        : isRed
                        ? 'bg-red-50/70 border-red-300 text-red-950'
                        : 'bg-amber-50/70 border-amber-300 text-amber-950'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {isAttended ? (
                          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                        ) : (
                          <AlertTriangle className={`w-6 h-6 ${isRed ? 'text-red-600' : 'text-amber-600'}`} />
                        )}
                        <div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            isAttended
                              ? 'bg-emerald-600 text-white'
                              : isRed
                              ? 'bg-red-600 text-white'
                              : 'bg-amber-500 text-slate-950'
                          }`}>
                            {isAttended
                              ? 'Alerta Atendida'
                              : isRed
                              ? 'Alerta Roja (3+ Faltas)'
                              : 'Alerta Amarilla (2 Faltas)'}
                          </span>
                          <h4 className="font-extrabold text-lg text-[#17324D] mt-1">{alt.estudiante_nombre}</h4>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-slate-500">{alt.grupo_nombre}</span>
                    </div>

                    <div className="text-xs space-y-1 font-medium text-slate-700 bg-white/80 p-3 rounded-2xl border border-slate-200">
                      <p>Docente a cargo: <strong>{alt.docente_nombre}</strong></p>
                      <p>Estado de Alerta: <strong className="uppercase">{alt.estado}</strong></p>
                      <p>Faltas consecutivas registradas: <strong>{alt.faltas_consecutivas}</strong></p>
                    </div>

                    {!isAttended && (
                      <button
                        onClick={() => handleOpenLogModal(alt)}
                        className={`w-full h-12 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all ${
                          isRed ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                        }`}
                      >
                        <PhoneCall className="w-5 h-5" />
                        <span>REGISTRAR ACCIÓN DE SEGUIMIENTO</span>
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* History of Registered Follow-up Actions */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-[#17324D]">Historial de Acciones Registradas</h3>
              <span className="text-xs font-bold text-slate-400">{seguimientos.length} Registros</span>
            </div>

            {seguimientos.length === 0 ? (
              <div className="p-6 bg-slate-50 rounded-2xl text-center border border-slate-200 text-slate-500 text-xs font-medium">
                No hay seguimientos registrados.
              </div>
            ) : (
              <div className="space-y-3">
                {seguimientos.map((s) => (
                  <div key={s.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                      <span className="font-extrabold text-sm text-[#17324D]">{s.estudiante_nombre}</span>
                      <span className="text-slate-500 font-bold">{s.fecha}</span>
                    </div>
                    <div className="space-y-1 font-medium text-slate-700">
                      <p><strong>Acción Realizada:</strong> <span className="uppercase text-[#00A651] font-bold">{s.accion_realizada}</span></p>
                      <p><strong>Motivo:</strong> {s.motivo}</p>
                      <p><strong>Resultado:</strong> {s.resultado}</p>
                      {s.proxima_accion && <p><strong>Próximo Compromiso:</strong> {s.proxima_accion}</p>}
                      {s.observacion && <p><strong>Observación:</strong> {s.observacion}</p>}
                      <p className="text-slate-400 text-[11px] pt-1">Docente responsable: {s.docente_nombre}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal: Log Follow-up Action */}
      {showLogModal && selectedAlerta && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl text-left">
            <h3 className="font-extrabold text-xl text-[#17324D] flex items-center gap-2">
              <PhoneCall className="w-6 h-6 text-[#00A651]" />
              Registrar Acción de Seguimiento
            </h3>

            {savedSuccess ? (
              <div className="p-4 bg-emerald-100 text-emerald-900 font-bold text-sm rounded-2xl text-center">
                ¡Seguimiento guardado correctamente!
              </div>
            ) : (
              <form onSubmit={handleSubmitFollowUp} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Estudiante</label>
                  <input
                    type="text"
                    value={selectedAlerta.estudiante_nombre}
                    disabled
                    className="w-full h-11 px-3 bg-slate-100 rounded-xl font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Acción Realizada</label>
                  <select
                    value={accion}
                    onChange={e => setAccion(e.target.value as AccionSeguimiento)}
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                  >
                    <option value="llamada">Llamada telefónica</option>
                    <option value="mensaje">Mensaje de texto / WhatsApp</option>
                    <option value="visita">Visita domiciliaria</option>
                    <option value="conversacion_personal">Conversación personal</option>
                    <option value="derivacion">Derivación institucional</option>
                    <option value="otra">Otra acción</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Resultado / Respuesta del Estudiante</label>
                  <textarea
                    rows={3}
                    value={resultado}
                    onChange={e => setResultado(e.target.value)}
                    placeholder="Ej. La madre indicó que el estudiante se ausentó por trabajo agrícola. Se reincorpora el lunes."
                    className="w-full p-3 border border-slate-300 rounded-xl font-medium outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Próxima Acción / Compromiso</label>
                  <input
                    type="text"
                    value={proximaAccion}
                    onChange={e => setProximaAccion(e.target.value)}
                    placeholder="Ej. Verificación de tareas el próximo miércoles"
                    className="w-full h-11 px-3 border border-slate-300 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Observación adicional (Opcional)</label>
                  <input
                    type="text"
                    value={observacion}
                    onChange={e => setObservacion(e.target.value)}
                    placeholder="Notas internas..."
                    className="w-full h-11 px-3 border border-slate-300 rounded-xl font-medium"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setShowLogModal(false)}
                    className="flex-1 h-12 border border-slate-300 font-bold rounded-xl text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !resultado}
                    className="flex-1 h-12 bg-[#00A651] text-white font-bold rounded-xl hover:bg-[#008d44] transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Guardando...' : 'Guardar Registro'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
