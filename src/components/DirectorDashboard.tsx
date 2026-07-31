import React, { useState } from 'react';
import {
  Users,
  UserCheck,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  PlusCircle,
  FilePlus,
  Filter,
  CheckCircle,
  WifiOff,
  Search,
  ChevronRight,
  ShieldCheck,
  MapPin,
  Calendar
} from 'lucide-react';
import { Perfil, AsistenciaDocente, AlertaEstudiante, Seguimiento, DatosInstitucionales } from '../types';
import { MOCK_DOCENTES, MOCK_ASISTENCIAS_DOCENTES, MOCK_ALERTAS, MOCK_SEGUIMIENTOS, MOCK_ESTUDIANTES } from '../lib/mockData';
import { getLocalDatosInstitucionales } from '../lib/institutional';

interface DirectorDashboardProps {
  user: Perfil;
  isOnline: boolean;
  onNavigateTab: (tab: string) => void;
  onOpenAddTeacherModal: () => void;
  onOpenAddStudentModal: () => void;
  onOpenPublishModal: () => void;
  onDownloadReport: () => void;
  datosInstitucionales?: DatosInstitucionales;
}

export const DirectorDashboard: React.FC<DirectorDashboardProps> = ({
  user,
  isOnline,
  onNavigateTab,
  onOpenAddTeacherModal,
  onOpenAddStudentModal,
  onOpenPublishModal,
  onDownloadReport,
  datosInstitucionales,
}) => {
  const datos = datosInstitucionales || getLocalDatosInstitucionales();
  const [selectedSedeFilter, setSelectedSedeFilter] = useState<string>('Todas');

  const todayStr = new Date().toLocaleDateString('es-BO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Calculate stats
  const totalDocentes = MOCK_DOCENTES.length;
  const docentesIngresados = MOCK_ASISTENCIAS_DOCENTES.filter(a => a.hora_ingreso_oficial).length;
  const docentesPendientes = Math.max(0, totalDocentes - docentesIngresados);
  const docentesPuntuales = MOCK_ASISTENCIAS_DOCENTES.filter(a => a.estado === 'puntual').length;
  const docentesAtrasados = MOCK_ASISTENCIAS_DOCENTES.filter(a => a.estado === 'atraso').length;
  const registrosOfflineCount = MOCK_ASISTENCIAS_DOCENTES.filter(a => a.origen_registro === 'sin_conexion').length;

  const totalEstudiantes = MOCK_ESTUDIANTES.length;
  const alertasPendientes = MOCK_ALERTAS.filter(a => a.estado === 'pendiente').length;

  return (
    <div className="space-y-5 pb-20">
      {/* Director Header Hero Banner */}
      <div className="bg-gradient-to-br from-[#17324D] to-slate-900 rounded-3xl p-5 text-white shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-[#FFC845]" />
            <div>
              <p className="text-xs text-[#FFC845] font-bold uppercase tracking-wider">{datos.cargo_director || 'Panel de Dirección'}</p>
              <h2 className="text-xl font-extrabold">{user.nombre_completo}</h2>
            </div>
          </div>
          <div className="bg-white/10 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border border-white/20">
            {isOnline ? (
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> En línea
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-400">
                <WifiOff className="w-3.5 h-3.5" /> Sin conexión
              </span>
            )}
          </div>
        </div>

        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-slate-300 font-medium">
          <span className="capitalize">{todayStr}</span>
          <span className="text-[#FFC845] font-bold">{datos.nombre_corto}</span>
        </div>
      </div>


      {/* Quick Action Buttons Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <button
          onClick={onOpenAddTeacherModal}
          id="btn-dir-add-docente"
          className="p-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-2xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 shadow-md h-20 transition-all"
        >
          <UserCheck className="w-6 h-6 text-[#FFC845]" />
          <span>+ Añadir Docente</span>
        </button>

        <button
          onClick={onOpenAddStudentModal}
          id="btn-dir-add-estudiante"
          className="p-3 bg-[#11B8AE] hover:bg-teal-700 active:scale-95 text-white rounded-2xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 shadow-md h-20 transition-all"
        >
          <Users className="w-6 h-6 text-white" />
          <span>+ Añadir Estudiante</span>
        </button>

        <button
          onClick={onOpenPublishModal}
          id="btn-dir-publicar"
          className="p-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 rounded-2xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 shadow-md h-20 transition-all"
        >
          <FilePlus className="w-6 h-6 text-slate-950" />
          <span>Publicar Aviso</span>
        </button>

        <button
          onClick={onDownloadReport}
          id="btn-dir-reporte"
          className="p-3 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white rounded-2xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 shadow-md h-20 transition-all"
        >
          <FileSpreadsheet className="w-6 h-6 text-[#FFC845]" />
          <span>Descargar Excel</span>
        </button>
      </div>

      {/* Sede Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {['Todas', 'Sede Poroma', 'Sede San Juan de Horcas'].map((sede) => (
          <button
            key={sede}
            onClick={() => setSelectedSedeFilter(sede)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedSedeFilter === sede
                ? 'bg-[#00A651] text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {sede}
          </button>
        ))}
      </div>

      {/* Teacher Attendance Daily Summary */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-6 h-6 text-[#00A651]" />
            <h3 className="font-extrabold text-lg text-[#17324D]">Resumen Asistencia Docente</h3>
          </div>
          <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            {docentesIngresados}/{totalDocentes} Asistieron
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
            <span className="text-[10px] font-bold text-emerald-700 uppercase block">Puntuales</span>
            <strong className="text-xl font-extrabold text-[#00A651]">{docentesPuntuales}</strong>
          </div>

          <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200">
            <span className="text-[10px] font-bold text-amber-700 uppercase block">Atrasos</span>
            <strong className="text-xl font-extrabold text-amber-600">{docentesAtrasados}</strong>
          </div>

          <div className="p-3 bg-red-50 rounded-2xl border border-red-200">
            <span className="text-[10px] font-bold text-red-700 uppercase block">Pendientes</span>
            <strong className="text-xl font-extrabold text-red-600">{docentesPendientes}</strong>
          </div>

          <div className="p-3 bg-yellow-50 rounded-2xl border border-yellow-300">
            <span className="text-[10px] font-bold text-yellow-800 uppercase block">Sin Conexión</span>
            <strong className="text-xl font-extrabold text-yellow-900">{registrosOfflineCount}</strong>
          </div>
        </div>

        {/* Teacher shift status list */}
        <div className="space-y-2 pt-2">
          <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Estado de Jornada Hoy</h4>
          {MOCK_ASISTENCIAS_DOCENTES.map((a) => (
            <div
              key={a.id}
              className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs"
            >
              <div>
                <span className="font-bold text-[#17324D] block text-sm">{a.docente_nombre}</span>
                <span className="text-slate-500">{a.sede_nombre}</span>
              </div>
              <div className="text-right">
                <span
                  className={`inline-block px-2.5 py-1 rounded-full font-bold uppercase text-[10px] ${
                    a.estado === 'puntual'
                      ? 'bg-emerald-100 text-emerald-800'
                      : a.estado === 'atraso'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {a.estado}
                </span>
                {a.origen_registro === 'sin_conexion' && (
                  <span className="block text-[10px] font-bold text-amber-700 mt-0.5">Offline no verificado</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Student Attendance & Risk Summary Card */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            <h3 className="font-extrabold text-lg text-[#17324D]">Estudiantes y Seguimiento</h3>
          </div>
          <button
            onClick={() => onNavigateTab('estudiantes')}
            className="text-xs font-bold text-[#00A651] hover:underline flex items-center gap-1"
          >
            Ver Todo <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
            <span className="text-[10px] font-bold text-emerald-700 uppercase block">Inscritos Activos</span>
            <strong className="text-2xl font-extrabold text-[#00A651]">{totalEstudiantes}</strong>
          </div>

          <div className="p-3 bg-red-50 rounded-2xl border border-red-200">
            <span className="text-[10px] font-bold text-red-700 uppercase block">Alertas por Faltas</span>
            <strong className="text-2xl font-extrabold text-red-600">{alertasPendientes}</strong>
          </div>
        </div>

        {/* At risk alerts preview */}
        {MOCK_ALERTAS.length > 0 && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs text-red-900 font-bold">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                Estudiante con Alerta Roja (3 Faltas Consecutivas)
              </span>
              <span className="bg-red-600 text-white px-2 py-0.5 rounded-full text-[10px]">Urgente</span>
            </div>
            <p className="text-sm font-bold text-slate-900">{MOCK_ALERTAS[0].estudiante_nombre}</p>
            <p className="text-xs text-slate-600 font-medium">Docente a cargo: {MOCK_ALERTAS[0].docente_nombre}</p>
          </div>
        )}
      </div>
    </div>
  );
};
