import React, { useState } from 'react';
import { Clock, Calendar, CheckCircle2, AlertTriangle, FileSpreadsheet, Download, Info } from 'lucide-react';
import { Perfil, AsistenciaDocente, ResumenAsistenciaDocenteMensual } from '../types';
import { MOCK_ASISTENCIAS_DOCENTES } from '../lib/mockData';
import { downloadDocenteAttendanceReport } from '../lib/excelExport';

interface TeacherAttendanceViewProps {
  user: Perfil;
}

export const TeacherAttendanceView: React.FC<TeacherAttendanceViewProps> = ({ user }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-07');

  // Filter records
  const records = MOCK_ASISTENCIAS_DOCENTES.filter(a => a.docente_id === user.id || user.rol === 'superadmin');

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
    </div>
  );
};
