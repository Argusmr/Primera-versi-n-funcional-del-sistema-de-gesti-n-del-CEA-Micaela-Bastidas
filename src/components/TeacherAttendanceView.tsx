import React, { useState } from 'react';
import {
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Info,
  MapPin,
  Camera,
  ShieldAlert,
  X,
  Check,
  Eye
} from 'lucide-react';
import { Perfil, AsistenciaDocente, ResumenAsistenciaDocenteMensual } from '../types';
import { MOCK_ASISTENCIAS_DOCENTES } from '../lib/mockData';
import { downloadDocenteAttendanceReport } from '../lib/excelExport';
import { supabase } from '../lib/supabase';

interface TeacherAttendanceViewProps {
  user: Perfil;
}

export const TeacherAttendanceView: React.FC<TeacherAttendanceViewProps> = ({ user }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-07');
  const [recordsState, setRecordsState] = useState<AsistenciaDocente[]>(MOCK_ASISTENCIAS_DOCENTES);
  const [selectedSelfieUrl, setSelectedSelfieUrl] = useState<string | null>(null);

  const isDirectorOrAdmin = user.rol === 'superadmin' || user.rol === 'director' || user.rol === 'coordinador';

  // Filter records
  const records = recordsState.filter(a => a.docente_id === user.id || isDirectorOrAdmin);

  const diasProgramados = 22;
  const diasAsistidos = records.length;
  const diasPuntuales = records.filter(r => r.estado === 'puntual').length;
  const atrasos = records.filter(r => r.estado === 'atraso').length;
  const licencias = records.filter(r => r.estado === 'licencia').length;
  const faltas = records.filter(r => r.estado === 'falta').length;

  const asistenciaPorcentaje = (diasAsistidos / diasProgramados) * 100;
  const puntualidadPorcentaje = diasAsistidos > 0 ? (diasPuntuales / diasAsistidos) * 100 : 100;

  const resumen: ResumenAsistenciaDocenteMensual = {
    docente_id: user.id,
    docente_nombre: user.nombre_completo,
    dias_programados: diasProgramados,
    dias_asistidos: diasAsistidos,
    dias_puntuales: diasPuntuales,
    atrasos,
    faltas,
    licencias,
    salidas_anticipadas: 0,
    registros_incompletos: 0,
    registros_sin_conexion: records.filter(r => r.origen_registro === 'sin_conexion').length,
    horas_trabajadas: records.reduce((acc, curr) => acc + curr.horas_trabajadas, 0),
    porcentaje_asistencia: asistenciaPorcentaje,
    porcentaje_puntualidad: puntualidadPorcentaje
  };

  const handleDownloadExcel = () => {
    downloadDocenteAttendanceReport(records, [resumen], selectedMonth);
  };

  const handleApproveException = async (recordId: string) => {
    setRecordsState(prev =>
      prev.map(r => (r.id === recordId ? { ...r, estado_excepcion: 'aprobada', estado: 'puntual' } : r))
    );
    if (supabase) {
      await supabase
        .from('asistencias_docentes')
        .update({
          estado_excepcion: 'aprobada',
          estado: 'puntual',
          validado_por: user.id,
          fecha_validacion: new Date().toISOString()
        })
        .eq('id', recordId);
    }
  };

  const handleRejectException = async (recordId: string) => {
    setRecordsState(prev =>
      prev.map(r => (r.id === recordId ? { ...r, estado_excepcion: 'rechazada', estado: 'atraso' } : r))
    );
    if (supabase) {
      await supabase
        .from('asistencias_docentes')
        .update({
          estado_excepcion: 'rechazada',
          estado: 'atraso',
          validado_por: user.id,
          fecha_validacion: new Date().toISOString()
        })
        .eq('id', recordId);
    }
  };

  return (
    <div className="space-y-5 pb-20">
      {/* Title & Month Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-[#17324D]">Mi Asistencia Laboral</h2>
          <p className="text-xs text-slate-500 font-medium">Registro mensual y porcentajes oficiales</p>
        </div>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="h-10 px-3 bg-white border border-slate-300 rounded-xl font-bold text-xs text-[#17324D] outline-none"
        />
      </div>

      {/* Monthly Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">% Asistencia</span>
          <strong className="text-2xl font-extrabold text-[#00A651]">
            {asistenciaPorcentaje.toFixed(1)}%
          </strong>
          <span className="text-[10px] text-slate-500 block">Días: {diasAsistidos}/{diasProgramados}</span>
        </div>

        <div className="p-4 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">% Puntualidad</span>
          <strong className="text-2xl font-extrabold text-[#11B8AE]">
            {puntualidadPorcentaje.toFixed(1)}%
          </strong>
          <span className="text-[10px] text-slate-500 block">Puntuales: {diasPuntuales}</span>
        </div>

        <div className="p-4 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Atrasos / Licencias</span>
          <div className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span className="text-amber-600">{atrasos} Atrasos</span>
            <span className="text-slate-300">•</span>
            <span className="text-blue-600">{licencias} Lic.</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Horas Acumuladas</span>
          <strong className="text-2xl font-extrabold text-[#17324D]">
            {resumen.horas_trabajadas} hrs
          </strong>
        </div>
      </div>

      {/* Export Button */}
      <button
        onClick={handleDownloadExcel}
        className="w-full h-12 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-sm"
      >
        <FileSpreadsheet className="w-5 h-5 text-[#FFC845]" />
        <span>Descargar Reporte Mensual en Excel</span>
      </button>

      {/* Daily Records List */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
        <h3 className="font-extrabold text-base text-[#17324D]">Historial de Jornadas</h3>

        <div className="space-y-3">
          {records.map((r) => (
            <div key={r.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-extrabold text-sm text-[#17324D]">{r.fecha_laboral}</span>
                <span
                  className={`px-3 py-1 rounded-full font-bold uppercase text-[10px] ${
                    r.estado === 'puntual'
                      ? 'bg-emerald-100 text-emerald-800'
                      : r.estado === 'atraso'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-200 text-slate-800'
                  }`}
                >
                  {r.estado}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-700 font-medium">
                <div>
                  <span>Ingreso:</span>{' '}
                  <strong>{r.hora_ingreso_oficial ? new Date(r.hora_ingreso_oficial).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }) : 'N/D'}</strong>
                  {r.firma_ingreso && <span className="ml-1 text-[10px] text-emerald-700 font-bold">(Firmado ✓)</span>}
                </div>
                <div>
                  <span>Salida:</span>{' '}
                  <strong>{r.hora_salida_oficial ? new Date(r.hora_salida_oficial).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }) : 'N/D'}</strong>
                  {r.firma_salida && <span className="ml-1 text-[10px] text-emerald-700 font-bold">(Firmado ✓)</span>}
                </div>
                <div>
                  <span>Horas trabajadas:</span> <strong>{r.horas_trabajadas} hrs</strong>
                </div>
                <div>
                  <span>Origen:</span>{' '}
                  <strong className={r.origen_registro === 'sin_conexion' ? 'text-amber-700' : 'text-emerald-700'}>
                    {r.origen_registro === 'sin_conexion' ? 'Sin conexión (Offline)' : 'En Línea'}
                  </strong>
                </div>
              </div>

              {/* GPS & Selfie Verification Box */}
              <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-1.5 text-[11px]">
                <div className="flex justify-between items-center font-bold text-slate-800">
                  <span className="flex items-center gap-1 text-[#17324D]">
                    <MapPin className="w-3.5 h-3.5 text-[#00A651]" />
                    <span>Verificación GPS y Selfie</span>
                  </span>
                  {r.distancia_m_ingreso !== undefined ? (
                    <span className="text-slate-600 font-extrabold">Distancia: {r.distancia_m_ingreso}m</span>
                  ) : (
                    <span className="text-slate-400 font-normal">GPS Estándar</span>
                  )}
                </div>

                {r.precision_gps_ingreso && (
                  <p className="text-slate-500 font-medium">
                    Precisión GPS: ±{r.precision_gps_ingreso}m • Coordenadas: {r.latitud_ingreso?.toFixed(5)}, {r.longitud_ingreso?.toFixed(5)}
                  </p>
                )}

                {r.selfie_url && (
                  <div className="pt-1 flex items-center justify-between border-t border-slate-100">
                    <span className="text-slate-600 font-semibold flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5 text-[#00A651]" />
                      Selfie de Entrada Registrada
                    </span>
                    <button
                      onClick={() => setSelectedSelfieUrl(r.selfie_url || null)}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#00A651] border border-emerald-200 rounded-lg font-extrabold flex items-center gap-1 text-[10px]"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Ver Selfie</span>
                    </button>
                  </div>
                )}

                {/* Exception Handling Box */}
                {r.observacion_excepcion && (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-950 font-medium space-y-1 mt-1">
                    <div className="flex justify-between items-center font-bold">
                      <span className="flex items-center gap-1 text-amber-900">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        Observación de Excepción
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase ${
                        r.estado_excepcion === 'aprobada'
                          ? 'bg-emerald-100 text-emerald-800'
                          : r.estado_excepcion === 'rechazada'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-900'
                      }`}>
                        {r.estado_excepcion === 'pendiente_revision' ? 'Pendiente de Revisión' : r.estado_excepcion || 'Excepción'}
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-900">{r.observacion_excepcion}</p>

                    {/* Director / Admin Exception Action Buttons */}
                    {isDirectorOrAdmin && r.estado_excepcion === 'pendiente_revision' && (
                      <div className="pt-1 flex gap-2">
                        <button
                          onClick={() => handleApproveException(r.id)}
                          className="flex-1 py-1 bg-[#00A651] hover:bg-[#008f45] text-white rounded-md font-bold text-[10px] flex items-center justify-center gap-1"
                        >
                          <Check className="w-3 h-3 text-emerald-200" />
                          <span>Aprobar Excepción</span>
                        </button>
                        <button
                          onClick={() => handleRejectException(r.id)}
                          className="flex-1 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md font-bold text-[10px] flex items-center justify-center gap-1"
                        >
                          <X className="w-3 h-3" />
                          <span>Rechazar</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Multigrade activities display */}
              {r.actividades_multigrado && r.actividades_multigrado.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-200 space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase block">Avance Pedagógico por Nivel (Multigrado):</span>
                  <div className="space-y-1">
                    {r.actividades_multigrado.map((act) => (
                      <div key={act.id} className="bg-white p-2.5 rounded-xl border border-slate-200 text-[11px] space-y-0.5">
                        <div className="flex items-center gap-1.5 font-bold text-[#17324D]">
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px]">
                            {act.area_nivel}
                          </span>
                          <span>{act.subnivel}</span>
                          {act.carrera && (
                            <span className="text-amber-700 font-semibold">• Carrera: {act.carrera}</span>
                          )}
                        </div>
                        <p className="text-slate-600 font-normal pl-1">
                          <strong className="text-slate-700">Actividad pedagógica:</strong> {act.actividad_pedagogica}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {r.observacion && (
                <p className="text-[11px] text-slate-500 bg-white p-2 rounded-xl border border-slate-200">
                  {r.observacion}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Selfie Modal View */}
      {selectedSelfieUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-3 border border-slate-200 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h4 className="font-extrabold text-sm text-[#17324D] flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-[#00A651]" />
                <span>Selfie de Ingreso Registrada</span>
              </h4>
              <button
                onClick={() => setSelectedSelfieUrl(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="aspect-3/4 rounded-2xl overflow-hidden bg-slate-900 border border-slate-200">
              <img
                src={selectedSelfieUrl}
                alt="Selfie Registrada"
                className="w-full h-full object-cover"
              />
            </div>

            <button
              onClick={() => setSelectedSelfieUrl(null)}
              className="w-full h-11 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-xl"
            >
              Cerrar Vista Previa
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
