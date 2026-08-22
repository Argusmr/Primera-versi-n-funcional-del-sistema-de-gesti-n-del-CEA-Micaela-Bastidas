import React, { useState, useEffect } from 'react';
import { ShieldAlert, User, Clock, FileText, CheckCircle2, RefreshCw } from 'lucide-react';
import { Perfil, Auditoria } from '../types';
import { loadAuditoriaLogs, getLocalAuditoriaLogs } from '../lib/audit';

interface AuditViewProps {
  user: Perfil;
}

export const AuditView: React.FC<AuditViewProps> = ({ user }) => {
  const [logs, setLogs] = useState<Auditoria[]>(() => getLocalAuditoriaLogs());
  const [loading, setLoading] = useState<boolean>(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await loadAuditoriaLogs();
      setLogs(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const handleAuditoriaChange = (e: any) => {
      if (e.detail) {
        setLogs(e.detail);
      }
    };
    window.addEventListener('auditoriaChanged', handleAuditoriaChange);
    return () => window.removeEventListener('auditoriaChanged', handleAuditoriaChange);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-amber-600" />
          <h3 className="font-extrabold text-base text-[#17324D]">Historial de Auditoría Institucional</h3>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
          title="Actualizar registros"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-3">
        {logs.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-500 text-xs font-medium">
            No hay registros de auditoría registrados hasta el momento.
          </div>
        ) : (
          logs.map((aud) => (
            <div key={aud.id} className="p-4 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-2 text-xs">
              <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                <div>
                  <span className="font-extrabold text-[#17324D] text-sm block">{aud.accion}</span>
                  <span className="text-slate-500 font-medium">
                    Por: <strong className="text-slate-800">{aud.usuario_nombre}</strong>
                    {aud.valor_nuevo?.rol_usuario ? ` (${aud.valor_nuevo.rol_usuario})` : ''}
                  </span>
                </div>
                <span className="text-slate-400 font-bold">
                  {aud.created_at ? new Date(aud.created_at).toLocaleString('es-BO') : ''}
                </span>
              </div>

              <div className="space-y-1 text-slate-700 font-medium">
                <p>Tabla afectada: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-emerald-800">{aud.tabla_afectada}</code></p>
                
                <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-950 space-y-1">
                  <strong className="block text-[#17324D]">Motivo / Justificación Institucional:</strong>
                  <p className="italic">"{aud.motivo_correccion}"</p>
                </div>

                {aud.valor_anterior && (
                  <div className="bg-red-50 p-2 rounded-xl text-red-900 border border-red-200 text-[11px] pt-1">
                    <strong className="block">Valor Anterior:</strong>
                    <pre className="font-mono text-[10px] whitespace-pre-wrap">{JSON.stringify(aud.valor_anterior, null, 2)}</pre>
                  </div>
                )}

                {aud.valor_nuevo && (
                  <div className="bg-emerald-50 p-2 rounded-xl text-emerald-900 border border-emerald-200 text-[11px] pt-1">
                    <strong className="block">Detalle del Registro / Cobertura:</strong>
                    <pre className="font-mono text-[10px] whitespace-pre-wrap">{JSON.stringify(aud.valor_nuevo, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
