import React from 'react';
import { ShieldAlert, User, Clock, FileText, CheckCircle2 } from 'lucide-react';
import { Perfil } from '../types';
import { MOCK_AUDITORIA } from '../lib/mockData';

interface AuditViewProps {
  user: Perfil;
}

export const AuditView: React.FC<AuditViewProps> = ({ user }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <ShieldAlert className="w-5 h-5 text-amber-600" />
        <h3 className="font-extrabold text-base text-[#17324D]">Historial de Auditoría de Correcciones</h3>
      </div>

      <div className="space-y-3">
        {MOCK_AUDITORIA.map((aud) => (
          <div key={aud.id} className="p-4 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-2 text-xs">
            <div className="flex justify-between items-start border-b border-slate-100 pb-2">
              <div>
                <span className="font-extrabold text-[#17324D] text-sm block">{aud.accion}</span>
                <span className="text-slate-500 font-medium">Por: {aud.usuario_nombre}</span>
              </div>
              <span className="text-slate-400 font-bold">{aud.created_at}</span>
            </div>

            <div className="space-y-1 text-slate-700 font-medium">
              <p>Tabla afectada: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-emerald-800">{aud.tabla_afectada}</code></p>
              
              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-950 space-y-1">
                <strong className="block text-[#17324D]">Motivo de Corrección Obligatorio:</strong>
                <p className="italic">"{aud.motivo_correccion}"</p>
              </div>

              {aud.valor_anterior && (
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div className="bg-red-50 p-2 rounded-xl text-red-900 border border-red-200">
                    <strong className="block">Valor Anterior:</strong>
                    <pre className="font-mono text-[10px] whitespace-pre-wrap">{JSON.stringify(aud.valor_anterior, null, 2)}</pre>
                  </div>

                  <div className="bg-emerald-50 p-2 rounded-xl text-emerald-900 border border-emerald-200">
                    <strong className="block">Valor Nuevo:</strong>
                    <pre className="font-mono text-[10px] whitespace-pre-wrap">{JSON.stringify(aud.valor_nuevo, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
