import React, { useState } from 'react';
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
  FileSpreadsheet
} from 'lucide-react';
import { Perfil, AlertaEstudiante, Seguimiento, AccionSeguimiento } from '../types';
import { MOCK_ALERTAS, MOCK_SEGUIMIENTOS, MOCK_ESTUDIANTES } from '../lib/mockData';
import { saveOfflineSeguimiento } from '../lib/db';
import { downloadAtRiskReport } from '../lib/excelExport';

interface FollowUpViewProps {
  user: Perfil;
  isOnline: boolean;
}

export const FollowUpView: React.FC<FollowUpViewProps> = ({ user, isOnline }) => {
  const [alertas, setAlertas] = useState<AlertaEstudiante[]>(MOCK_ALERTAS);
  const [seguimientos, setSeguimientos] = useState<Seguimiento[]>(MOCK_SEGUIMIENTOS);
  const [showLogModal, setShowLogModal] = useState<boolean>(false);
  const [selectedAlerta, setSelectedAlerta] = useState<AlertaEstudiante | null>(null);

  // New follow-up form state
  const [motivo, setMotivo] = useState<string>('Inasistencia a 3 sesiones consecutivas');
  const [accion, setAccion] = useState<AccionSeguimiento>('llamada');
  const [resultado, setResultado] = useState<string>('');
  const [proximaAccion, setProximaAccion] = useState<string>('');
  const [observacion, setObservacion] = useState<string>('');
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const handleOpenLogModal = (alerta: AlertaEstudiante) => {
    setSelectedAlerta(alerta);
    setMotivo(`Faltas consecutivas: ${alerta.faltas_consecutivas} sesiones ausente.`);
    setShowLogModal(true);
  };

  const handleSubmitFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlerta || !resultado) return;

    const syncKey = `seg-${selectedAlerta.id}-${Date.now()}`;

    if (!isOnline) {
      await saveOfflineSeguimiento({
        sync_key: syncKey,
        estudiante_id: selectedAlerta.estudiante_id,
        docente_id: user.id,
        motivo,
        accion_realizada: accion,
        resultado,
        proxima_accion: proximaAccion,
        observacion,
        timestamp: Date.now()
      });
    }

    const newSeg: Seguimiento = {
      id: syncKey,
      alerta_id: selectedAlerta.id,
      estudiante_id: selectedAlerta.estudiante_id,
      docente_id: user.id,
      fecha: new Date().toISOString().slice(0, 10),
      motivo,
      accion_realizada: accion,
      resultado,
      proxima_accion: proximaAccion,
      observacion,
      estado: 'cerrado',
      estudiante_nombre: selectedAlerta.estudiante_nombre,
      docente_nombre: user.nombre_completo
    };

    setSeguimientos(prev => [newSeg, ...prev]);

    // Update alert status
    setAlertas(prev =>
      prev.map(a => (a.id === selectedAlerta.id ? { ...a, estado: 'atendido' } : a))
    );

    setSavedSuccess(true);
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
        <button
          onClick={handleDownloadExcel}
          className="h-10 px-3 bg-[#17324D] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm"
        >
          <FileSpreadsheet className="w-4 h-4 text-[#FFC845]" />
          <span>Reporte Excel</span>
        </button>
      </div>

      {/* Active Alerts List */}
      <div className="space-y-3">
        <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
          Alertas Pendientes de Intervención
        </h3>

        {alertas.length === 0 ? (
          <div className="p-6 bg-white rounded-3xl text-center border border-slate-200 text-slate-500 text-sm">
            No existen estudiantes en riesgo en este momento.
          </div>
        ) : (
          alertas.map((alt) => {
            const isRed = alt.tipo === 'rojo_3_faltas';
            return (
              <div
                key={alt.id}
                className={`p-5 rounded-3xl border shadow-xs space-y-3 ${
                  isRed ? 'bg-red-50/70 border-red-300 text-red-950' : 'bg-amber-50/70 border-amber-300 text-amber-950'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`w-6 h-6 ${isRed ? 'text-red-600' : 'text-amber-600'}`} />
                    <div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        isRed ? 'bg-red-600 text-white' : 'bg-amber-500 text-slate-950'
                      }`}>
                        {isRed ? 'Alerta Roja (3+ Faltas)' : 'Alerta Amarilla (2 Faltas)'}
                      </span>
                      <h4 className="font-extrabold text-lg text-[#17324D] mt-1">{alt.estudiante_nombre}</h4>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-500">{alt.grupo_nombre}</span>
                </div>

                <div className="text-xs space-y-1 font-medium text-slate-700 bg-white/80 p-3 rounded-2xl border border-slate-200">
                  <p>Docente a cargo: <strong>{alt.docente_nombre}</strong></p>
                  <p>Estado de Alerta: <strong className="uppercase">{alt.estado}</strong></p>
                </div>

                <button
                  onClick={() => handleOpenLogModal(alt)}
                  className={`w-full h-12 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all ${
                    isRed ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                  }`}
                >
                  <PhoneCall className="w-5 h-5" />
                  <span>REGISTRAR ACCIÓN DE SEGUIMIENTO</span>
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* History of Registered Follow-up Actions */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
        <h3 className="font-extrabold text-base text-[#17324D]">Historial de Acciones Registradas</h3>

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
                <p className="text-slate-400 text-[11px] pt-1">Docente responsable: {s.docente_nombre}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

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

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowLogModal(false)}
                    className="flex-1 h-12 border border-slate-300 font-bold rounded-xl text-slate-600"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 h-12 bg-[#00A651] text-white font-bold rounded-xl"
                  >
                    Guardar Registro
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
