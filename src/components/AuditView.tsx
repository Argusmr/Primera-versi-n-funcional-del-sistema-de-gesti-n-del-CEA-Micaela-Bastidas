import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  RefreshCw,
  Calendar,
  Clock,
  User,
  Database,
  Tag,
  ChevronDown,
  ChevronUp,
  FileText,
  Settings,
  Users,
  Layers,
  ArrowRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  FileSignature
} from 'lucide-react';
import { Perfil, Auditoria } from '../types';
import { loadAuditoriaLogs, getLocalAuditoriaLogs } from '../lib/audit';

interface AuditViewProps {
  user: Perfil;
}

type AuditCategory = 'todas' | 'asistencia' | 'horarios' | 'documentos' | 'configuracion' | 'usuarios';

interface CategoryConfig {
  id: AuditCategory;
  label: string;
  icon: React.ElementType;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

const CATEGORIES: CategoryConfig[] = [
  {
    id: 'todas',
    label: 'Todas las Auditorías',
    icon: Layers,
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-300'
  },
  {
    id: 'asistencia',
    label: 'Asistencia y Cobertura',
    icon: CheckCircle2,
    badgeBg: 'bg-emerald-50 text-emerald-800',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-200'
  },
  {
    id: 'horarios',
    label: 'Horarios y Asignaciones',
    icon: Clock,
    badgeBg: 'bg-indigo-50 text-indigo-800',
    badgeText: 'text-indigo-700',
    badgeBorder: 'border-indigo-200'
  },
  {
    id: 'documentos',
    label: 'Control Documental',
    icon: FileText,
    badgeBg: 'bg-amber-50 text-amber-800',
    badgeText: 'text-amber-700',
    badgeBorder: 'border-amber-200'
  },
  {
    id: 'configuracion',
    label: 'Configuración y Sedes',
    icon: Settings,
    badgeBg: 'bg-purple-50 text-purple-800',
    badgeText: 'text-purple-700',
    badgeBorder: 'border-purple-200'
  },
  {
    id: 'usuarios',
    label: 'Usuarios y Perfiles',
    icon: Users,
    badgeBg: 'bg-cyan-50 text-cyan-800',
    badgeText: 'text-cyan-700',
    badgeBorder: 'border-cyan-200'
  }
];

function classifyAuditCategory(log: Auditoria): AuditCategory {
  const table = (log.tabla_afectada || '').toLowerCase();
  const action = (log.accion || '').toLowerCase();

  // Asistencia & Sesiones
  if (
    table.includes('asistencia') ||
    table.includes('sesion') ||
    table.includes('cobertura') ||
    action.includes('asistencia') ||
    action.includes('cobertura') ||
    action.includes('falta') ||
    action.includes('inasistencia')
  ) {
    return 'asistencia';
  }

  // Horarios & Materias & Grupos
  if (
    table.includes('horario') ||
    table.includes('asignacion') ||
    table.includes('materia') ||
    table.includes('grupo') ||
    action.includes('horario') ||
    action.includes('asignacion') ||
    action.includes('materia') ||
    action.includes('invierno')
  ) {
    return 'horarios';
  }

  // Documentos & Publicaciones
  if (
    table.includes('documento') ||
    table.includes('publicacion') ||
    table.includes('archivo') ||
    table.includes('storage') ||
    action.includes('documento') ||
    action.includes('publicacion') ||
    action.includes('circular')
  ) {
    return 'documentos';
  }

  // Configuración & Calendario & Sedes
  if (
    table.includes('configuracion') ||
    table.includes('calendario') ||
    table.includes('sede') ||
    table.includes('sistema') ||
    table.includes('feriado') ||
    action.includes('calendario') ||
    action.includes('sede') ||
    action.includes('configuracion') ||
    action.includes('dias')
  ) {
    return 'configuracion';
  }

  // Usuarios & Perfiles
  if (
    table.includes('perfil') ||
    table.includes('usuario') ||
    table.includes('docente') ||
    table.includes('auth') ||
    action.includes('usuario') ||
    action.includes('perfil') ||
    action.includes('contraseña') ||
    action.includes('rol')
  ) {
    return 'usuarios';
  }

  return 'configuracion';
}

function getCategoryBadgeStyle(cat: AuditCategory): { label: string; bg: string; text: string; border: string } {
  switch (cat) {
    case 'asistencia':
      return {
        label: 'Asistencia',
        bg: 'bg-emerald-50',
        text: 'text-emerald-800',
        border: 'border-emerald-200'
      };
    case 'horarios':
      return {
        label: 'Horarios',
        bg: 'bg-indigo-50',
        text: 'text-indigo-800',
        border: 'border-indigo-200'
      };
    case 'documentos':
      return {
        label: 'Documentos',
        bg: 'bg-amber-50',
        text: 'text-amber-800',
        border: 'border-amber-200'
      };
    case 'configuracion':
      return {
        label: 'Configuración',
        bg: 'bg-purple-50',
        text: 'text-purple-800',
        border: 'border-purple-200'
      };
    case 'usuarios':
      return {
        label: 'Usuarios',
        bg: 'bg-cyan-50',
        text: 'text-cyan-800',
        border: 'border-cyan-200'
      };
    default:
      return {
        label: 'Institucional',
        bg: 'bg-slate-100',
        text: 'text-slate-800',
        border: 'border-slate-200'
      };
  }
}

export const AuditView: React.FC<AuditViewProps> = ({ user }) => {
  const [logs, setLogs] = useState<Auditoria[]>(() => getLocalAuditoriaLogs());
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<AuditCategory>('todas');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const toggleCardExpand = (id: string) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyRecord = (id: string, log: Auditoria) => {
    try {
      navigator.clipboard.writeText(JSON.stringify(log, null, 2));
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  };

  // Pre-classify and calculate counts
  const classifiedLogs = useMemo(() => {
    return logs.map(l => ({
      ...l,
      category: classifyAuditCategory(l)
    }));
  }, [logs]);

  const categoryCounts = useMemo(() => {
    const counts: Record<AuditCategory, number> = {
      todas: classifiedLogs.length,
      asistencia: 0,
      horarios: 0,
      documentos: 0,
      configuracion: 0,
      usuarios: 0
    };
    classifiedLogs.forEach(item => {
      if (counts[item.category] !== undefined) {
        counts[item.category]++;
      }
    });
    return counts;
  }, [classifiedLogs]);

  // Filter logs by category and search term
  const filteredLogs = useMemo(() => {
    const cleanSearch = searchTerm.trim().toLowerCase();

    return classifiedLogs.filter(log => {
      // Category match
      if (selectedCategory !== 'todas' && log.category !== selectedCategory) {
        return false;
      }

      // Search match
      if (cleanSearch) {
        const matchUser = (log.usuario_nombre || '').toLowerCase().includes(cleanSearch);
        const matchTable = (log.tabla_afectada || '').toLowerCase().includes(cleanSearch);
        const matchMotive = (log.motivo_correccion || '').toLowerCase().includes(cleanSearch);
        const matchAction = (log.accion || '').toLowerCase().includes(cleanSearch);
        const matchRecordId = (log.registro_afectado_id || '').toLowerCase().includes(cleanSearch);
        const matchNewVal = log.valor_nuevo ? JSON.stringify(log.valor_nuevo).toLowerCase().includes(cleanSearch) : false;
        const matchOldVal = log.valor_anterior ? JSON.stringify(log.valor_anterior).toLowerCase().includes(cleanSearch) : false;

        return (
          matchUser ||
          matchTable ||
          matchMotive ||
          matchAction ||
          matchRecordId ||
          matchNewVal ||
          matchOldVal
        );
      }

      return true;
    });
  }, [classifiedLogs, selectedCategory, searchTerm]);

  return (
    <div className="space-y-5">
      {/* Encabezado Institucional del Panel */}
      <div className="bg-slate-900 rounded-3xl p-5 sm:p-6 text-white border border-slate-800 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold shrink-0 shadow-inner">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-white tracking-tight">
                  Panel de Auditoría Institucional y Trazabilidad
                </h3>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 uppercase tracking-wider">
                  Superadmin / Dirección
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Registro inmutable de correcciones, coberturas de asistencia, horarios y cambios de configuración
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-800 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 border border-slate-700 disabled:opacity-50 cursor-pointer"
              title="Actualizar registros desde el servidor"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Actualizando...' : 'Actualizar'}</span>
            </button>
          </div>
        </div>

        {/* Métricas Resumen */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-800/80 text-xs">
          <div className="bg-slate-800/60 rounded-2xl p-3 border border-slate-700/50">
            <span className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wider block">Total Registros</span>
            <span className="text-xl font-black text-white">{categoryCounts.todas}</span>
          </div>
          <div className="bg-slate-800/60 rounded-2xl p-3 border border-slate-700/50">
            <span className="text-emerald-400 text-[10px] font-extrabold uppercase tracking-wider block">Asistencia & Cobertura</span>
            <span className="text-xl font-black text-emerald-400">{categoryCounts.asistencia}</span>
          </div>
          <div className="bg-slate-800/60 rounded-2xl p-3 border border-slate-700/50">
            <span className="text-indigo-400 text-[10px] font-extrabold uppercase tracking-wider block">Horarios & Materias</span>
            <span className="text-xl font-black text-indigo-400">{categoryCounts.horarios}</span>
          </div>
          <div className="bg-slate-800/60 rounded-2xl p-3 border border-slate-700/50">
            <span className="text-purple-400 text-[10px] font-extrabold uppercase tracking-wider block">Config. & Sedes</span>
            <span className="text-xl font-black text-purple-400">{categoryCounts.configuracion + categoryCounts.documentos + categoryCounts.usuarios}</span>
          </div>
        </div>
      </div>

      {/* Controles de Filtros por Categoría & Buscador */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3.5">
        {/* Buscador de Texto */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por usuario, tabla afectada, motivo o detalle en JSON..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full h-11 pl-10 pr-10 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 placeholder-slate-400 outline-none focus:border-amber-400 focus:bg-white transition-all shadow-inner"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded-md hover:bg-slate-200/60"
            >
              ✕
            </button>
          )}
        </div>

        {/* Pestañas de Categoría */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            const count = categoryCounts[cat.id];

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-[#17324D] text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-400' : 'text-slate-500'}`} />
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Listado de Tarjetas de Auditoría */}
      <div className="space-y-3.5">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
              <Filter className="w-6 h-6" />
            </div>
            <h4 className="font-extrabold text-slate-800 text-base">
              No se encontraron registros de auditoría
            </h4>
            <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
              {searchTerm
                ? `No hay coincidencias para "${searchTerm}" en la categoría seleccionada.`
                : 'No existen registros registrados en esta categoría.'}
            </p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                Limpiar búsqueda
              </button>
            )}
          </div>
        ) : (
          filteredLogs.map(aud => {
            const badge = getCategoryBadgeStyle(aud.category);
            const isExpanded = !!expandedCards[aud.id];
            const isCoverageAttendance =
              aud.accion === 'cobertura_institucional_asistencia' ||
              aud.tabla_afectada === 'sesiones_clase';

            return (
              <div
                key={aud.id}
                className="bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow p-4 sm:p-5 space-y-3.5"
              >
                {/* Cabecera de la Tarjeta */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 border-b border-slate-100 pb-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Etiqueta de Categoría Visual */}
                      <span
                        className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border uppercase tracking-wider flex items-center gap-1 ${badge.bg} ${badge.text} ${badge.border}`}
                      >
                        <Tag className="w-2.5 h-2.5" />
                        {badge.label}
                      </span>

                      {/* Tabla Afectada */}
                      <span className="text-[11px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                        <Database className="w-2.5 h-2.5 inline mr-1 text-slate-500" />
                        {aud.tabla_afectada}
                      </span>

                      {aud.registro_afectado_id && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          ID: {aud.registro_afectado_id.slice(0, 14)}
                        </span>
                      )}
                    </div>

                    <h4 className="font-extrabold text-sm sm:text-base text-[#17324D] tracking-tight">
                      {aud.accion}
                    </h4>
                  </div>

                  {/* Fecha y Botones de Copiar / Expandir */}
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <div className="text-right text-[11px] text-slate-500 font-medium">
                      <span className="font-bold text-slate-700 block">
                        {aud.created_at ? new Date(aud.created_at).toLocaleDateString('es-BO', { timeZone: 'America/La_Paz', year: 'numeric', month: 'short', day: '2-digit' }) : ''}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {aud.created_at ? new Date(aud.created_at).toLocaleTimeString('es-BO', { timeZone: 'America/La_Paz', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
                      </span>
                    </div>

                    <button
                      onClick={() => handleCopyRecord(aud.id, aud)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Copiar registro JSON"
                    >
                      {copiedId === aud.id ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Bloque de Usuario Responsable & Rol */}
                <div className="flex items-center justify-between bg-slate-50/80 p-2.5 rounded-2xl border border-slate-100 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider leading-none">
                        Responsable del Registro
                      </span>
                      <span className="font-extrabold text-slate-800">
                        {aud.usuario_nombre}
                      </span>
                    </div>
                  </div>

                  {aud.valor_nuevo?.rol_usuario && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-[#17324D] text-white uppercase tracking-wider">
                      {aud.valor_nuevo.rol_usuario}
                    </span>
                  )}
                </div>

                {/* Bloque de Motivo / Justificación Institucional Obligatoria */}
                <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200/80 text-xs text-amber-950 space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-900 font-extrabold text-[11px] uppercase tracking-wider">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                    <span>Motivo Institucional Registrado:</span>
                  </div>
                  <p className="font-medium text-amber-950 pl-5 italic">
                    "{aud.motivo_correccion}"
                  </p>
                </div>

                {/* Vista Rápida de Resumen si es Cobertura de Asistencia */}
                {isCoverageAttendance && aud.valor_nuevo && (
                  <div className="p-3 bg-emerald-50/70 rounded-2xl border border-emerald-200 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-emerald-900 font-extrabold text-[11px]">
                      <span className="flex items-center gap-1">
                        <FileSignature className="w-3.5 h-3.5 text-emerald-700" />
                        Cobertura Registrada: {aud.valor_nuevo.grupo_nombre || 'Grupo'} · {aud.valor_nuevo.materia || 'Materia'}
                      </span>
                      <span>Fecha clase: {aud.valor_nuevo.fecha || 'N/A'}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-black pt-1">
                      <div className="bg-emerald-100/80 text-emerald-900 py-1 rounded-lg">
                        Pres: {aud.valor_nuevo.presentes ?? 0}
                      </div>
                      <div className="bg-amber-100/80 text-amber-900 py-1 rounded-lg">
                        Atr: {aud.valor_nuevo.atrasos ?? 0}
                      </div>
                      <div className="bg-red-100/80 text-red-900 py-1 rounded-lg">
                        Falt: {aud.valor_nuevo.faltas ?? 0}
                      </div>
                      <div className="bg-blue-100/80 text-blue-900 py-1 rounded-lg">
                        Lic: {aud.valor_nuevo.licencias ?? 0}
                      </div>
                    </div>
                  </div>
                )}

                {/* Sección Desplegable de Valor Anterior vs Valor Nuevo */}
                {(aud.valor_anterior || aud.valor_nuevo) && (
                  <div>
                    <button
                      type="button"
                      onClick={() => toggleCardExpand(aud.id)}
                      className="text-[11px] font-extrabold text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1 cursor-pointer pt-1"
                    >
                      <span>{isExpanded ? 'Ocultar detalle técnico (JSON)' : 'Ver detalle técnico de valores (JSON)'}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {isExpanded && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2 text-[11px]">
                        {aud.valor_anterior ? (
                          <div className="bg-rose-50/80 p-3 rounded-2xl text-rose-950 border border-rose-200 space-y-1">
                            <strong className="text-[10px] font-extrabold uppercase tracking-wider text-rose-800 block">
                              Valor Anterior:
                            </strong>
                            <pre className="font-mono text-[10px] whitespace-pre-wrap bg-white/70 p-2 rounded-xl border border-rose-200 overflow-x-auto">
                              {JSON.stringify(aud.valor_anterior, null, 2)}
                            </pre>
                          </div>
                        ) : (
                          <div className="bg-slate-50 p-3 rounded-2xl text-slate-400 border border-slate-200 text-[10px] italic flex items-center justify-center">
                            Sin registro de valor anterior (Creación / Cobertura directa)
                          </div>
                        )}

                        {aud.valor_nuevo && (
                          <div className="bg-emerald-50/80 p-3 rounded-2xl text-emerald-950 border border-emerald-200 space-y-1">
                            <strong className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 block">
                              Valor Nuevo / Registro Aplicado:
                            </strong>
                            <pre className="font-mono text-[10px] whitespace-pre-wrap bg-white/70 p-2 rounded-xl border border-emerald-200 overflow-x-auto">
                              {JSON.stringify(aud.valor_nuevo, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
