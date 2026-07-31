import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Filter,
  Users,
  GraduationCap,
  Layers,
  Building2,
  PieChart,
  BarChart3,
  CheckCircle2,
  RefreshCw,
  UserCheck,
  UserX
} from 'lucide-react';
import { Perfil, Estudiante, Programa, Sede, NivelEducativo } from '../types';
import {
  MOCK_ASISTENCIAS_DOCENTES,
  MOCK_ALERTAS,
  MOCK_SEGUIMIENTOS,
  INITIAL_SEDES
} from '../lib/mockData';
import {
  downloadDocenteAttendanceReport,
  downloadStudentEnrollmentReport,
  downloadAtRiskReport,
  downloadStudentStatisticalReport
} from '../lib/excelExport';
import {
  getLocalEstudiantes,
  loadEstudiantesFromSupabase,
  getLocalProgramas,
  getLocalNiveles
} from '../lib/academic';

interface ReportsViewProps {
  user: Perfil;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'estadistico' | 'planillas'>('estadistico');

  // Load dynamic student data and structure
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>(() => getLocalEstudiantes());
  const [programas, setProgramas] = useState<Programa[]>(() => getLocalProgramas());
  const [niveles, setNiveles] = useState<NivelEducativo[]>(() => getLocalNiveles());
  const [sedes] = useState<Sede[]>(INITIAL_SEDES);

  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Filters State
  const [filterSede, setFilterSede] = useState<string>('Todas');
  const [filterPrograma, setFilterPrograma] = useState<string>('Todos');
  const [filterNivel, setFilterNivel] = useState<string>('Todos');
  const [filterSexo, setFilterSexo] = useState<string>('Todos');
  const [filterGestion, setFilterGestion] = useState<string>('2026');

  // Planillas Filter State
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-07');
  const [selectedSedePlanilla, setSelectedSedePlanilla] = useState<string>('Todas');

  const refreshData = async () => {
    setIsLoading(true);
    const loaded = await loadEstudiantesFromSupabase();
    setEstudiantes(loaded);
    setProgramas(getLocalProgramas());
    setNiveles(getLocalNiveles());
    setIsLoading(false);
  };

  useEffect(() => {
    refreshData();

    // Listen to academic changes from Administration
    const handleAcademicChanged = () => {
      setProgramas(getLocalProgramas());
      setNiveles(getLocalNiveles());
      setEstudiantes(getLocalEstudiantes());
    };

    window.addEventListener('academicStructureChanged', handleAcademicChanged);
    return () => {
      window.removeEventListener('academicStructureChanged', handleAcademicChanged);
    };
  }, []);

  // Filter students dynamically based on current filters
  const filteredEstudiantes = useMemo(() => {
    return estudiantes.filter(e => {
      // Filter Sede
      if (filterSede !== 'Todas' && e.sede_nombre !== filterSede && e.sede_id !== filterSede) {
        return false;
      }

      // Filter Programa (EPA, ESA, ETA, EDUPER, CEE)
      if (filterPrograma !== 'Todos') {
        const progCode = (e.programa_codigo || e.programa_nombre || '').toUpperCase();
        if (!progCode.includes(filterPrograma.toUpperCase())) {
          return false;
        }
      }

      // Filter Nivel (Elemental, Avanzado, Técnico Básico, etc.)
      if (filterNivel !== 'Todos') {
        const nivName = (e.nivel || '').toLowerCase();
        if (!nivName.includes(filterNivel.toLowerCase())) {
          return false;
        }
      }

      // Filter Sexo (Hombres, Mujeres)
      if (filterSexo !== 'Todos') {
        const sexoVal = (e.sexo || '').toLowerCase();
        if (filterSexo === 'Masculino' && !sexoVal.startsWith('m')) return false;
        if (filterSexo === 'Femenino' && !sexoVal.startsWith('f')) return false;
      }

      // Filter Gestión
      if (filterGestion !== 'Todas') {
        const gest = e.gestion || '2026';
        if (gest !== filterGestion) return false;
      }

      return true;
    });
  }, [estudiantes, filterSede, filterPrograma, filterNivel, filterSexo, filterGestion]);

  // Statistical calculations
  const totalInscritos = filteredEstudiantes.length;
  const activos = filteredEstudiantes.filter(e => e.estado === 'activo').length;
  const inactivos = filteredEstudiantes.filter(e => e.estado !== 'activo').length;

  const hombres = filteredEstudiantes.filter(e => (e.sexo || '').toLowerCase().startsWith('m')).length;
  const mujeres = filteredEstudiantes.filter(e => (e.sexo || '').toLowerCase().startsWith('f')).length;

  // Percentage calculations
  const percentActivos = totalInscritos > 0 ? Math.round((activos / totalInscritos) * 100) : 0;
  const percentInactivos = totalInscritos > 0 ? Math.round((inactivos / totalInscritos) * 100) : 0;
  const percentHombres = totalInscritos > 0 ? Math.round((hombres / totalInscritos) * 100) : 0;
  const percentMujeres = totalInscritos > 0 ? Math.round((mujeres / totalInscritos) * 100) : 0;

  // Breakdown by Program
  const programCounts = useMemo(() => {
    const map: Record<string, number> = {};
    // Ensure all active programs are initialized with 0
    programas.filter(p => p.activo).forEach(p => {
      map[p.codigo] = 0;
    });

    filteredEstudiantes.forEach(e => {
      const code = e.programa_codigo || e.programa_nombre || 'OTRO';
      map[code] = (map[code] || 0) + 1;
    });
    return map;
  }, [filteredEstudiantes, programas]);

  // Breakdown by Level
  const levelCounts = useMemo(() => {
    const map: Record<string, number> = {};
    niveles.filter(n => n.activo).forEach(n => {
      map[n.nombre] = 0;
    });

    filteredEstudiantes.forEach(e => {
      const niv = e.nivel || 'Sin Nivel';
      map[niv] = (map[niv] || 0) + 1;
    });
    return map;
  }, [filteredEstudiantes, niveles]);

  // Breakdown by Sede y Grupo
  const sedeGrupoList = useMemo(() => {
    const map: Record<string, { sede: string; grupo: string; total: number; activos: number; inactivos: number }> = {};

    filteredEstudiantes.forEach(e => {
      const key = `${e.sede_nombre || 'Sede'} - ${e.grupo_nombre || 'Grupo'}`;
      if (!map[key]) {
        map[key] = {
          sede: e.sede_nombre || 'Poroma',
          grupo: e.grupo_nombre || 'General',
          total: 0,
          activos: 0,
          inactivos: 0
        };
      }
      map[key].total += 1;
      if (e.estado === 'activo') {
        map[key].activos += 1;
      } else {
        map[key].inactivos += 1;
      }
    });

    return Object.values(map);
  }, [filteredEstudiantes]);

  const handleDownloadExcelEstadistico = () => {
    downloadStudentStatisticalReport(filteredEstudiantes, {
      sede: filterSede,
      programa: filterPrograma,
      nivel: filterNivel,
      sexo: filterSexo,
      gestion: filterGestion
    });
  };

  // Downloads for planillas
  const handleDownloadAsistenciaDocente = () => {
    downloadDocenteAttendanceReport(MOCK_ASISTENCIAS_DOCENTES, [{
      docente_id: 'usr-doc-1',
      docente_nombre: 'Lic. Elena Ramos Mamani',
      dias_programados: 22,
      dias_asistidos: 20,
      dias_puntuales: 18,
      atrasos: 2,
      faltas: 0,
      licencias: 2,
      salidas_anticipadas: 0,
      registros_incompletos: 0,
      registros_sin_conexion: 1,
      horas_trabajadas: 72.5,
      porcentaje_asistencia: 90.9,
      porcentaje_puntualidad: 90.0
    }], selectedMonth);
  };

  const handleDownloadInscritos = () => {
    downloadStudentEnrollmentReport(filteredEstudiantes, selectedSedePlanilla);
  };

  const handleDownloadRiesgo = () => {
    downloadAtRiskReport(MOCK_ALERTAS, MOCK_SEGUIMIENTOS);
  };

  return (
    <div className="space-y-5 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#17324D]">Centro de Reportes Institucionales</h2>
          <p className="text-xs text-slate-500 font-medium">
            Estadísticas automáticas de estudiantes y descarga de planillas oficiales en Excel
          </p>
        </div>

        <button
          onClick={refreshData}
          disabled={isLoading}
          className="self-start sm:self-auto h-9 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#00A651]' : ''}`} />
          <span>{isLoading ? 'Actualizando...' : 'Actualizar Datos'}</span>
        </button>
      </div>

      {/* Main Subtabs Selector */}
      <div className="flex bg-slate-200 p-1 rounded-2xl">
        <button
          onClick={() => setActiveTab('estadistico')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'estadistico' ? 'bg-[#00A651] text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Reporte Estadístico de Estudiantes</span>
        </button>

        <button
          onClick={() => setActiveTab('planillas')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'planillas' ? 'bg-[#00A651] text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Planillas Oficiales Excel</span>
        </button>
      </div>

      {activeTab === 'estadistico' ? (
        /* ================= REPORTE ESTADÍSTICO DE ESTUDIANTES ================= */
        <div className="space-y-5">
          {/* Filters Bar */}
          <div className="p-4 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Filter className="w-4 h-4 text-[#00A651]" />
                Filtros Estadísticos
              </h3>

              <button
                onClick={handleDownloadExcelEstadistico}
                id="btn-descargar-excel-estadistico"
                className="h-9 px-4 bg-[#00A651] hover:bg-[#008f45] text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition-all"
              >
                <FileSpreadsheet className="w-4 h-4 text-[#FFC845]" />
                <span>Descargar Excel</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs font-bold">
              {/* 1. Sede */}
              <div>
                <label className="block text-slate-700 mb-1">Sede</label>
                <select
                  value={filterSede}
                  onChange={e => setFilterSede(e.target.value)}
                  className="w-full h-10 px-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium text-slate-900"
                >
                  <option value="Todas">Todas las Sedes</option>
                  {sedes.map(s => (
                    <option key={s.id} value={s.nombre}>{s.nombre}</option>
                  ))}
                </select>
              </div>

              {/* 2. Programa */}
              <div>
                <label className="block text-slate-700 mb-1">Programa</label>
                <select
                  value={filterPrograma}
                  onChange={e => setFilterPrograma(e.target.value)}
                  className="w-full h-10 px-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium text-slate-900"
                >
                  <option value="Todos">Todos los Programas</option>
                  {programas.map(p => (
                    <option key={p.id} value={p.codigo}>{p.codigo} – {p.nombre}</option>
                  ))}
                </select>
              </div>

              {/* 3. Nivel */}
              <div>
                <label className="block text-slate-700 mb-1">Nivel</label>
                <select
                  value={filterNivel}
                  onChange={e => setFilterNivel(e.target.value)}
                  className="w-full h-10 px-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium text-slate-900"
                >
                  <option value="Todos">Todos los Niveles</option>
                  {niveles.map(n => (
                    <option key={n.id} value={n.nombre}>{n.nombre}</option>
                  ))}
                </select>
              </div>

              {/* 4. Sexo */}
              <div>
                <label className="block text-slate-700 mb-1">Sexo</label>
                <select
                  value={filterSexo}
                  onChange={e => setFilterSexo(e.target.value)}
                  className="w-full h-10 px-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium text-slate-900"
                >
                  <option value="Todos">Todos</option>
                  <option value="Masculino">Hombres / Varones</option>
                  <option value="Femenino">Mujeres</option>
                </select>
              </div>

              {/* 5. Gestión */}
              <div>
                <label className="block text-slate-700 mb-1">Gestión</label>
                <select
                  value={filterGestion}
                  onChange={e => setFilterGestion(e.target.value)}
                  className="w-full h-10 px-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium text-slate-900"
                >
                  <option value="Todas">Todas las Gestiones</option>
                  <option value="2026">Gestión 2026</option>
                  <option value="2025">Gestión 2025</option>
                  <option value="2024">Gestión 2024</option>
                </select>
              </div>
            </div>
          </div>

          {/* LARGE KPI CARDS FOR MOBILE & DESKTOP */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Inscritos */}
            <div className="p-5 bg-gradient-to-br from-[#17324D] to-slate-900 text-white rounded-3xl shadow-md space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                  Total Inscritos
                </span>
                <Users className="w-6 h-6 text-[#FFC845]" />
              </div>
              <div className="text-4xl font-black">{totalInscritos}</div>
              <p className="text-[11px] text-slate-300 font-medium">
                Estudiantes registrados según filtros seleccionados
              </p>
            </div>

            {/* Card 2: Activos vs Inactivos */}
            <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs font-extrabold uppercase text-slate-500">
                <span>Estado Estudiantil</span>
                <UserCheck className="w-5 h-5 text-[#00A651]" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-[#00A651]">{activos}</span>
                <span className="text-xs font-bold text-slate-400">activos ({percentActivos}%)</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                <div style={{ width: `${percentActivos}%` }} className="bg-[#00A651] h-full" />
                <div style={{ width: `${percentInactivos}%` }} className="bg-red-500 h-full" />
              </div>
              <div className="flex justify-between text-[11px] font-bold pt-1 text-slate-600">
                <span>Inactivos/Retirados: <strong className="text-red-600">{inactivos}</strong></span>
                <span>{percentInactivos}%</span>
              </div>
            </div>

            {/* Card 3: Distribución por Sexo */}
            <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs font-extrabold uppercase text-slate-500">
                <span>Distribución por Sexo</span>
                <PieChart className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="grid grid-cols-2 gap-2 text-center pt-1">
                <div className="p-2 bg-blue-50 border border-blue-200 rounded-2xl">
                  <span className="text-[10px] font-extrabold text-blue-700 block uppercase">Hombres</span>
                  <strong className="text-xl font-black text-blue-900">{hombres}</strong>
                  <span className="text-[10px] text-blue-600 font-bold block">({percentHombres}%)</span>
                </div>
                <div className="p-2 bg-pink-50 border border-pink-200 rounded-2xl">
                  <span className="text-[10px] font-extrabold text-pink-700 block uppercase">Mujeres</span>
                  <strong className="text-xl font-black text-pink-900">{mujeres}</strong>
                  <span className="text-[10px] text-pink-600 font-bold block">({percentMujeres}%)</span>
                </div>
              </div>
            </div>

            {/* Card 4: Sede Activa */}
            <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-2 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-extrabold uppercase text-slate-500">
                <span>Filtro Actual</span>
                <Building2 className="w-5 h-5 text-[#00A651]" />
              </div>
              <div>
                <h4 className="font-extrabold text-base text-[#17324D]">{filterSede}</h4>
                <p className="text-xs text-slate-500 font-medium">Programa: {filterPrograma} • Nivel: {filterNivel}</p>
              </div>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 self-start">
                Cálculo automático en vivo
              </span>
            </div>
          </div>

          {/* DETAILED CARDS BY PROGRAM AND LEVEL */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* 1. Cantidad por Programa (EPA, ESA, ETA, EDUPER, CEE) */}
            <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-[#00A651]" />
                  <h3 className="font-extrabold text-base text-[#17324D]">Estudiantes por Programa</h3>
                </div>
                <span className="text-xs font-bold text-slate-400">Total: {totalInscritos}</span>
              </div>

              <div className="space-y-3">
                {Object.entries(programCounts).map(([code, count]) => {
                  const cnt = Number(count);
                  const pct = totalInscritos > 0 ? Math.round((cnt / totalInscritos) * 100) : 0;
                  return (
                    <div key={code} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-[#17324D] font-extrabold flex items-center gap-1.5">
                          <span className="px-2 py-0.5 bg-[#00A651] text-white text-[10px] rounded-md font-bold">
                            {code}
                          </span>
                        </span>
                        <span className="text-slate-700 font-extrabold">
                          {count} est. <span className="text-slate-400 font-medium">({pct}%)</span>
                        </span>
                      </div>

                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div style={{ width: `${pct}%` }} className="bg-[#00A651] h-full transition-all" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Cantidad por Nivel (Elemental, Avanzado, Técnico Básico, etc.) */}
            <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-extrabold text-base text-[#17324D]">Estudiantes por Nivel Educativo</h3>
                </div>
                <span className="text-xs font-bold text-slate-400">Incluye elemental/avanzado</span>
              </div>

              <div className="space-y-3">
                {Object.entries(levelCounts).map(([nivelName, count]) => {
                  const cnt = Number(count);
                  const pct = totalInscritos > 0 ? Math.round((cnt / totalInscritos) * 100) : 0;
                  return (
                    <div key={nivelName} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-[#17324D]">{nivelName}</span>
                        <span className="text-slate-700 font-extrabold">
                          {count} est. <span className="text-slate-400 font-medium">({pct}%)</span>
                        </span>
                      </div>

                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div style={{ width: `${pct}%` }} className="bg-indigo-600 h-full transition-all" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SUMMARY TABLE: CANTIDAD POR SEDE Y GRUPO */}
          <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-[#17324D]">Distribución por Sede y Grupo</h3>
                <p className="text-xs text-slate-500 font-medium">Resumen automático por curso y campus educativo</p>
              </div>

              <button
                onClick={handleDownloadExcelEstadistico}
                className="self-start sm:self-auto h-9 px-3 bg-emerald-50 hover:bg-emerald-100 text-[#00A651] font-bold text-xs rounded-xl border border-emerald-200 flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar Tabla en Excel</span>
              </button>
            </div>

            {/* Mobile View: Large Touch Cards */}
            <div className="block sm:hidden space-y-3">
              {sedeGrupoList.map((sg, idx) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                        {sg.sede}
                      </span>
                      <h4 className="font-extrabold text-sm text-[#17324D] mt-1">{sg.grupo}</h4>
                    </div>
                    <span className="text-lg font-black text-[#00A651]">{sg.total} est.</span>
                  </div>
                  <div className="flex justify-between text-xs pt-1 border-t border-slate-200 font-medium text-slate-600">
                    <span>Activos: <strong className="text-[#00A651]">{sg.activos}</strong></span>
                    <span>Inactivos/Retirados: <strong className="text-red-600">{sg.inactivos}</strong></span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop / Tablet View: Summary Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 text-[#17324D] font-extrabold uppercase border-b border-slate-200">
                    <th className="p-3 rounded-l-xl">Sede Educativa</th>
                    <th className="p-3">Grupo / Curso</th>
                    <th className="p-3 text-center">Total Inscritos</th>
                    <th className="p-3 text-center">Activos</th>
                    <th className="p-3 text-center rounded-r-xl">Inactivos / Retirados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {sedeGrupoList.map((sg, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-3 font-extrabold text-[#17324D]">{sg.sede}</td>
                      <td className="p-3">{sg.grupo}</td>
                      <td className="p-3 text-center font-bold text-[#00A651]">{sg.total}</td>
                      <td className="p-3 text-center">
                        <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold">
                          {sg.activos}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2.5 py-0.5 bg-red-100 text-red-800 rounded-full font-bold">
                          {sg.inactivos}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {sedeGrupoList.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-400 font-medium">
                        No hay estudiantes que coincidan con los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ================= PLANILLAS EN EXCEL EXISTENTES ================= */
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-3xl border border-slate-200 space-y-3">
            <h3 className="font-extrabold text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-[#00A651]" />
              Filtros para Planillas
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs font-bold">
              <div>
                <label className="block text-slate-700 mb-1">Mes / Gestión</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Sede Educativa</label>
                <select
                  value={selectedSedePlanilla}
                  onChange={e => setSelectedSedePlanilla(e.target.value)}
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl outline-none"
                >
                  <option value="Todas">Todas las Sedes</option>
                  <option value="Sede Poroma">Sede Poroma</option>
                  <option value="Sede San Juan de Horcas">Sede San Juan de Horcas</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-[#00A651] flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-[#17324D]">Reporte Mensual de Asistencia Docente</h4>
                  <p className="text-xs text-slate-500 font-medium">Incluye marcaciones diarias, atrasos, origen offline y hoja de Resumen Mensual</p>
                </div>
              </div>
              <button
                onClick={handleDownloadAsistenciaDocente}
                className="w-full h-12 bg-[#00A651] hover:bg-[#008f45] text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4 text-[#FFC845]" />
                <span>Descargar Reporte Docente (.xlsx)</span>
              </button>
            </div>

            <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-100 text-[#11B8AE] flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-[#17324D]">Nómina Oficial de Estudiantes Inscritos</h4>
                  <p className="text-xs text-slate-500 font-medium">Lista completa por sede, programa, grupo, especialidad y estado activo/retiro</p>
                </div>
              </div>
              <button
                onClick={handleDownloadInscritos}
                className="w-full h-12 bg-[#11B8AE] hover:bg-teal-700 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4 text-white" />
                <span>Descargar Nómina de Estudiantes (.xlsx)</span>
              </button>
            </div>

            <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-[#17324D]">Estudiantes en Riesgo y Seguimientos</h4>
                  <p className="text-xs text-slate-500 font-medium">Reporte de inasistencias consecutivas y compromisos asumidos por docentes</p>
                </div>
              </div>
              <button
                onClick={handleDownloadRiesgo}
                className="w-full h-12 bg-[#17324D] hover:bg-slate-900 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4 text-[#FFC845]" />
                <span>Descargar Reporte de Riesgo y Seguimiento (.xlsx)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
