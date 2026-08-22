import React, { useState, useEffect } from 'react';
import { Calendar, Save, Trash2, Edit3, CheckCircle2, AlertCircle, RefreshCw, Info } from 'lucide-react';
import { Perfil, ConfiguracionCalendario } from '../types';
import {
  loadConfiguracionesCalendario,
  saveConfiguracionCalendario,
  deleteConfiguracionCalendario,
  FALLBACK_DIAS_TRABAJADOS
} from '../lib/calendar';
import { getBoliviaTodayDate } from '../lib/geo';

interface WorkCalendarConfigProps {
  user: Perfil;
}

export const WorkCalendarConfig: React.FC<WorkCalendarConfigProps> = ({ user }) => {
  const currentBoliviaMonth = getBoliviaTodayDate().slice(0, 7); // 'YYYY-MM'

  const [configs, setConfigs] = useState<ConfiguracionCalendario[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form State
  const [selectedMes, setSelectedMes] = useState<string>(currentBoliviaMonth);
  const [diasTrabajados, setDiasTrabajados] = useState<number>(22);
  const [observacion, setObservacion] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const data = await loadConfiguracionesCalendario();
      setConfigs(data);

      // If current month has an existing config, pre-fill it
      const currentConfig = data.find(c => c.mes === selectedMes);
      if (currentConfig) {
        setDiasTrabajados(currentConfig.dias_trabajados);
        setObservacion(currentConfig.observacion || '');
        setEditingId(currentConfig.id);
      }
    } catch (err: any) {
      console.error('Error al cargar configuraciones de calendario:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleMonthChange = (newMes: string) => {
    setSelectedMes(newMes);
    const existing = configs.find(c => c.mes === newMes);
    if (existing) {
      setDiasTrabajados(existing.dias_trabajados);
      setObservacion(existing.observacion || '');
      setEditingId(existing.id);
    } else {
      setDiasTrabajados(FALLBACK_DIAS_TRABAJADOS);
      setObservacion('');
      setEditingId(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const res = await saveConfiguracionCalendario(
      selectedMes,
      Number(diasTrabajados),
      observacion,
      user.id
    );

    setSaving(false);

    if (res.success) {
      setMessage({
        text: `Configuración de ${formatMonthDisplay(selectedMes)} guardada correctamente (${diasTrabajados} días efectivos).`,
        type: 'success'
      });
      await fetchConfigs();
    } else {
      setMessage({
        text: res.error || 'Error al guardar la configuración.',
        type: 'error'
      });
    }

    setTimeout(() => setMessage(null), 4000);
  };

  const handleEdit = (config: ConfiguracionCalendario) => {
    setSelectedMes(config.mes);
    setDiasTrabajados(config.dias_trabajados);
    setObservacion(config.observacion || '');
    setEditingId(config.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (config: ConfiguracionCalendario) => {
    if (!confirm(`¿Eliminar la configuración de ${formatMonthDisplay(config.mes)}? Se usará el valor predeterminado (22 días).`)) {
      return;
    }

    await deleteConfiguracionCalendario(config.id, config.mes);
    setMessage({
      text: `Configuración de ${formatMonthDisplay(config.mes)} eliminada.`,
      type: 'success'
    });
    if (selectedMes === config.mes) {
      setDiasTrabajados(FALLBACK_DIAS_TRABAJADOS);
      setObservacion('');
      setEditingId(null);
    }
    await fetchConfigs();
    setTimeout(() => setMessage(null), 3500);
  };

  const formatMonthDisplay = (mesStr: string) => {
    if (!mesStr) return '';
    try {
      const [year, month] = mesStr.split('-');
      const date = new Date(Number(year), Number(month) - 1, 15);
      return date.toLocaleDateString('es-BO', { month: 'long', year: 'numeric' });
    } catch {
      return mesStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#00A651] flex items-center justify-center font-bold">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#17324D]">Calendario Laboral y Días Efectivos</h3>
              <p className="text-xs text-slate-500 font-medium">
                Configure los días hábiles trabajados de cada mes para el cálculo oficial de asistencia docente
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchConfigs}
            disabled={loading}
            className="h-9 px-3 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 transition-all"
            title="Actualizar lista"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        </div>

        {/* Informative banner */}
        <div className="p-3.5 bg-blue-50/80 border border-blue-200 text-blue-900 rounded-2xl text-xs flex items-start gap-2.5">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="font-bold">Regla de Educación Alternativa:</strong> Los porcentajes de asistencia mensual se calcularán dividiendo los días asistidos por el docente entre los <strong>días efectivos configurados</strong> para ese mes. Si un mes no tiene configuración, se aplica el valor base temporal de 22 días.
          </div>
        </div>

        {message && (
          <div
            className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fade-in ${
              message.type === 'success'
                ? 'bg-emerald-100 border border-emerald-300 text-emerald-950'
                : 'bg-rose-100 border border-rose-300 text-rose-950'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#00A651] shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-4 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#17324D] uppercase tracking-wider mb-1">
                Mes Académico *
              </label>
              <input
                type="month"
                value={selectedMes}
                onChange={(e) => handleMonthChange(e.target.value)}
                required
                className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-[#00A651] focus:ring-2 focus:ring-emerald-200 outline-none text-sm font-medium text-slate-900 bg-white"
              />
              <span className="text-[11px] text-slate-500 mt-1 block capitalize">
                Período: {formatMonthDisplay(selectedMes)}
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#17324D] uppercase tracking-wider mb-1">
                Días Efectivos Trabajados *
              </label>
              <input
                type="number"
                min="0"
                max="31"
                value={diasTrabajados}
                onChange={(e) => setDiasTrabajados(Math.max(0, Math.min(31, parseInt(e.target.value) || 0)))}
                required
                placeholder="Ej. 20"
                className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-[#00A651] focus:ring-2 focus:ring-emerald-200 outline-none text-sm font-bold text-[#17324D] bg-white"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Total de jornadas laborales efectivas programadas
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#17324D] uppercase tracking-wider mb-1">
              Observación / Justificación (Opcional)
            </label>
            <input
              type="text"
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder="Ej. Descontados 2 días por receso pedagógico y 1 feriado nacional"
              className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-[#00A651] focus:ring-2 focus:ring-emerald-200 outline-none text-sm font-medium text-slate-900 bg-white"
            />
          </div>

          <div className="pt-2 flex items-center justify-between">
            {editingId ? (
              <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl font-bold">
                Editando configuración existente
              </span>
            ) : (
              <span className="text-xs text-slate-500">
                Nueva configuración para {selectedMes}
              </span>
            )}

            <button
              type="submit"
              disabled={saving}
              className="h-12 px-6 bg-[#00A651] hover:bg-[#008f45] active:scale-[0.98] text-white font-bold text-sm rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-[#FFC845]" />
              <span>{saving ? 'Guardando...' : editingId ? 'Actualizar Días' : 'Guardar Configuración'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Configurations Table / History */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h4 className="font-extrabold text-sm text-[#17324D]">
            Meses Registrados ({configs.length})
          </h4>
          <span className="text-xs text-slate-500 font-medium">
            Orden cronológico descendente
          </span>
        </div>

        {configs.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            No hay meses configurados aún. El sistema utilizará 22 días por defecto hasta que registre los días de cada mes.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-hidden">
            {configs.map((cfg) => {
              const isCurrent = cfg.mes === selectedMes;
              return (
                <div
                  key={cfg.id || cfg.mes}
                  className={`py-3.5 px-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    isCurrent ? 'bg-emerald-50/50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-[#17324D] capitalize">
                        {formatMonthDisplay(cfg.mes)}
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-[#17324D] text-white">
                        {cfg.dias_trabajados} {cfg.dias_trabajados === 1 ? 'día' : 'días'}
                      </span>
                      {cfg.mes === currentBoliviaMonth && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          Mes actual
                        </span>
                      )}
                    </div>
                    {cfg.observacion && (
                      <p className="text-xs text-slate-600 italic">
                        {cfg.observacion}
                      </p>
                    )}
                    <span className="text-[10px] text-slate-400 block">
                      Código: {cfg.mes}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleEdit(cfg)}
                      className="h-8 px-3 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 transition-all"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(cfg)}
                      className="h-8 px-2.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl flex items-center gap-1 transition-all"
                      title="Eliminar configuración"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
