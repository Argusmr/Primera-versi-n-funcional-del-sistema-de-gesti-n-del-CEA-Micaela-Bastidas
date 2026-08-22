import * as XLSX from 'xlsx';
import { AsistenciaDocente, Estudiante, AlertaEstudiante, Seguimiento, Perfil, ResumenAsistenciaDocenteMensual, DatosInstitucionales } from '../types';
import { getBoliviaTodayDate } from './geo';
import { getLocalDatosInstitucionales } from './institutional';

export function downloadDocenteAttendanceReport(
  records: AsistenciaDocente[],
  resumenes: ResumenAsistenciaDocenteMensual[] = [],
  mesAno: string = ''
) {
  if (!records || records.length === 0) {
    alert('No hay registros de asistencia docente para exportar.');
    return;
  }

  const wb = XLSX.utils.book_new();

  // Sheet 1: Detalle de Asistencia Docente con las columnas solicitadas
  const detalleData = records.map((r) => {
    // Formatear horas de ingreso y salida
    let ingresoStr = 'Sin registro';
    if (r.hora_ingreso_oficial) {
      ingresoStr = r.hora_ingreso_oficial.includes('T')
        ? new Date(r.hora_ingreso_oficial).toLocaleTimeString('es-BO')
        : r.hora_ingreso_oficial;
    } else if (r.hora_ingreso_local) {
      ingresoStr = r.hora_ingreso_local.includes('T')
        ? new Date(r.hora_ingreso_local).toLocaleTimeString('es-BO')
        : r.hora_ingreso_local;
    }

    let salidaStr = 'Sin registro';
    if (r.hora_salida_oficial) {
      salidaStr = r.hora_salida_oficial.includes('T')
        ? new Date(r.hora_salida_oficial).toLocaleTimeString('es-BO')
        : r.hora_salida_oficial;
    } else if (r.hora_salida_local) {
      salidaStr = r.hora_salida_local.includes('T')
        ? new Date(r.hora_salida_local).toLocaleTimeString('es-BO')
        : r.hora_salida_local;
    }

    return {
      'Fecha': r.fecha_laboral || '',
      'Docente': r.docente_nombre || 'Docente sin asignar',
      'Sede': r.sede_nombre || 'Sede General',
      'Ingreso': ingresoStr,
      'Salida': salidaStr,
      'Minutos de atraso': r.minutos_atraso || 0,
      'Minutos de salida anticipada': r.minutos_salida_anticipada || 0,
      'Horas trabajadas': r.horas_trabajadas || 0,
      'Estado': (r.estado || '').toUpperCase(),
      'Origen': r.origen_registro === 'sin_conexion' ? 'Sin Conexión (Offline)' : 'En Línea',
      'Observación': r.observacion || ''
    };
  });

  const wsDetalle = XLSX.utils.json_to_sheet(detalleData);
  XLSX.utils.book_append_sheet(wb, wsDetalle, 'Asistencia Docente');

  // Sheet 2: Resumen Mensual (si se provee)
  if (resumenes && resumenes.length > 0) {
    const resumenData = resumenes.map((s) => ({
      'Docente': s.docente_nombre,
      'Días Programados': s.dias_programados,
      'Días Asistidos': s.dias_asistidos,
      'Días Puntuales': s.dias_puntuales,
      'Atrasos': s.atrasos,
      'Faltas': s.faltas,
      'Licencias': s.licencias,
      'Salidas Anticipadas': s.salidas_anticipadas,
      'Registros Incompletos': s.registros_incompletos,
      'Registros Sin Conexión': s.registros_sin_conexion,
      'Horas Acumuladas': s.horas_trabajadas,
      '% Asistencia': `${s.porcentaje_asistencia.toFixed(1)}%`,
      '% Puntualidad': `${s.porcentaje_puntualidad.toFixed(1)}%`
    }));

    const wsResumen = XLSX.utils.json_to_sheet(resumenData);
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen Mensual');
  }

  // Nombre de archivo con fecha o mes
  const fileSuffix = mesAno ? mesAno.replace('-', '_') : getBoliviaTodayDate();
  XLSX.writeFile(wb, `Reporte_Asistencia_Docente_${fileSuffix}.xlsx`);
}

export function downloadStudentEnrollmentReport(estudiantes: Estudiante[], sedeFiltro: string = 'Todas') {
  const wb = XLSX.utils.book_new();

  const data = estudiantes.map((e) => ({
    'Código Interno': e.codigo_interno,
    'Nombre Completo': e.nombre_completo,
    'Documento': e.documento || 'Sin documento',
    'Fecha Inscripción': e.fecha_inscripcion,
    'Programa': e.programa_nombre || 'EPJA',
    'Sede': e.sede_nombre || 'Poroma',
    'Carrera / Especialidad': e.carrera_especialidad,
    'Nivel': e.nivel,
    'Grupo': e.grupo_nombre || 'N/D',
    'Estado': e.estado.toUpperCase(),
    'Fecha Retiro': e.fecha_retiro || 'N/A',
    'Observaciones': e.observacion || ''
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Inscritos Activos');

  XLSX.writeFile(wb, `Nomina_Estudiantes_${sedeFiltro.replace(/\s+/g, '_')}.xlsx`);
}

export function downloadStudentStatisticalReport(
  estudiantes: Estudiante[],
  filtros: {
    sede: string;
    programa: string;
    nivel: string;
    sexo: string;
    gestion: string;
  }
) {
  const wb = XLSX.utils.book_new();

  const total = estudiantes.length;

  // 1. Summary sheet metrics
  const activos = estudiantes.filter(e => e.estado === 'activo').length;
  const inactivos = estudiantes.filter(e => e.estado !== 'activo').length;

  // Programs count
  const programaMap: Record<string, number> = {};
  estudiantes.forEach(e => {
    const p = e.programa_codigo || e.programa_nombre || 'Sin Programa';
    programaMap[p] = (programaMap[p] || 0) + 1;
  });

  // Levels count
  const nivelMap: Record<string, number> = {};
  estudiantes.forEach(e => {
    const n = e.nivel || 'Sin Nivel';
    nivelMap[n] = (nivelMap[n] || 0) + 1;
  });

  // Gender count
  const hombres = estudiantes.filter(e => (e.sexo || '').toLowerCase().startsWith('m')).length;
  const mujeres = estudiantes.filter(e => (e.sexo || '').toLowerCase().startsWith('f')).length;

  // Sede y Grupo count
  const sedeGrupoMap: Record<string, { sede: string; grupo: string; total: number; activos: number; inactivos: number }> = {};
  estudiantes.forEach(e => {
    const key = `${e.sede_nombre || 'Sede'} - ${e.grupo_nombre || 'Grupo'}`;
    if (!sedeGrupoMap[key]) {
      sedeGrupoMap[key] = {
        sede: e.sede_nombre || 'N/D',
        grupo: e.grupo_nombre || 'N/D',
        total: 0,
        activos: 0,
        inactivos: 0
      };
    }
    sedeGrupoMap[key].total += 1;
    if (e.estado === 'activo') {
      sedeGrupoMap[key].activos += 1;
    } else {
      sedeGrupoMap[key].inactivos += 1;
    }
  });

  // Build Sheet 1: Resumen Estadístico
  const resumenGeneral = [
    { Indicador: 'Filtro Sede Aplicado', Valor: filtros.sede },
    { Indicador: 'Filtro Programa Aplicado', Valor: filtros.programa },
    { Indicador: 'Filtro Nivel Aplicado', Valor: filtros.nivel },
    { Indicador: 'Filtro Sexo Aplicado', Valor: filtros.sexo },
    { Indicador: 'Filtro Gestión Aplicada', Valor: filtros.gestion },
    { Indicador: 'TOTAL ESTUDIANTES INSCRITOS', Valor: total },
    { Indicador: 'Estudiantes Activos', Valor: activos },
    { Indicador: 'Estudiantes Inactivos / Retirados / Egresados', Valor: inactivos },
    { Indicador: 'Hombres / Varones', Valor: hombres },
    { Indicador: 'Mujeres', Valor: mujeres }
  ];

  const wsResumenGeneral = XLSX.utils.json_to_sheet(resumenGeneral);
  XLSX.utils.book_append_sheet(wb, wsResumenGeneral, 'Resumen Estadistico');

  // Sheet 2: Por Programa
  const programaRows = Object.entries(programaMap).map(([prog, cant]) => ({
    'Programa Educativo': prog,
    'Inscritos': cant,
    'Porcentaje': total > 0 ? `${((cant / total) * 100).toFixed(1)}%` : '0%'
  }));
  const wsPrograma = XLSX.utils.json_to_sheet(programaRows);
  XLSX.utils.book_append_sheet(wb, wsPrograma, 'Por Programa');

  // Sheet 3: Por Nivel
  const nivelRows = Object.entries(nivelMap).map(([niv, cant]) => ({
    'Nivel Educativo': niv,
    'Inscritos': cant,
    'Porcentaje': total > 0 ? `${((cant / total) * 100).toFixed(1)}%` : '0%'
  }));
  const wsNivel = XLSX.utils.json_to_sheet(nivelRows);
  XLSX.utils.book_append_sheet(wb, wsNivel, 'Por Nivel');

  // Sheet 4: Por Sede y Grupo
  const sedeGrupoRows = Object.values(sedeGrupoMap).map(sg => ({
    'Sede Educativa': sg.sede,
    'Grupo / Curso': sg.grupo,
    'Total Inscritos': sg.total,
    'Activos': sg.activos,
    'Inactivos / Retirados': sg.inactivos
  }));
  const wsSedeGrupo = XLSX.utils.json_to_sheet(sedeGrupoRows);
  XLSX.utils.book_append_sheet(wb, wsSedeGrupo, 'Por Sede y Grupo');

  // Sheet 5: Detalle Completo de Estudiantes
  const detalleEstudiantes = estudiantes.map(e => ({
    'Código Interno': e.codigo_interno,
    'Nombre Completo': e.nombre_completo,
    'Cédula / Documento': e.documento || 'Sin registro',
    'Sexo': e.sexo || 'N/D',
    'Gestión': e.gestion || '2026',
    'Programa': e.programa_codigo || e.programa_nombre || 'N/D',
    'Nivel': e.nivel,
    'Etapa': e.etapa || 'N/D',
    'Sede': e.sede_nombre || 'N/D',
    'Grupo': e.grupo_nombre || 'N/D',
    'Estado': e.estado.toUpperCase(),
    'Fecha Inscripción': e.fecha_inscripcion,
    'Observaciones': e.observacion || ''
  }));
  const wsDetalle = XLSX.utils.json_to_sheet(detalleEstudiantes);
  XLSX.utils.book_append_sheet(wb, wsDetalle, 'Lista de Estudiantes');

  // Download XLSX
  const fechaHoy = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Reporte_Estadistico_Estudiantes_${fechaHoy}.xlsx`);
}

export function downloadAtRiskReport(alertas: AlertaEstudiante[], seguimientos: Seguimiento[]) {
  if (!alertas || alertas.length === 0) {
    alert('No hay estudiantes en situación de riesgo registrados para exportar.');
    return;
  }

  const wb = XLSX.utils.book_new();

  const dataAlertas = alertas.map((a) => {
    const seg = (seguimientos || []).find(s => s.alerta_id === a.id);
    return {
      'Estudiante': a.estudiante_nombre || 'Estudiante sin registrar',
      'Grupo': a.grupo_nombre || 'Sin grupo',
      'Docente Responsable': a.docente_nombre || 'Sin docente asignado',
      'Nivel de Alerta': a.tipo === 'rojo_3_faltas' ? 'ALERTA ROJA (3+ Faltas)' : a.tipo === 'amarillo_2_faltas' ? 'ALERTA AMARILLA (2 Faltas)' : 'RIESGO PROLONGADO',
      'Faltas Consecutivas': a.faltas_consecutivas || 0,
      'Estado Alerta': (a.estado || 'pendiente').toUpperCase(),
      'Fecha Último Seguimiento': seg ? seg.fecha : 'Pendiente',
      'Acción Realizada': seg ? (seg.accion_realizada || '').toUpperCase() : 'Ninguna',
      'Resultado / Compromiso': seg ? seg.resultado : 'Sin intervención',
      'Próxima Acción': seg ? (seg.proxima_accion || 'N/A') : 'Requiere llamada/visita'
    };
  });

  const ws = XLSX.utils.json_to_sheet(dataAlertas);
  XLSX.utils.book_append_sheet(wb, ws, 'Estudiantes en Riesgo');

  const fechaHoy = getBoliviaTodayDate();
  XLSX.writeFile(wb, `Reporte_Estudiantes_En_Riesgo_${fechaHoy}.xlsx`);
}

export interface MonthlyAttendanceExportData {
  institucion?: DatosInstitucionales;
  grupoNombre: string;
  carreraEspecialidad?: string;
  nivel?: string;
  materia?: string;
  docenteNombre: string;
  mesAno: string; // e.g. 2026-08
  estudiantes: Estudiante[];
  sesiones: Array<{ id: string; fecha: string; materia: string }>;
  asistenciasPorSesionYEstudiante: Record<string, Record<string, 'presente' | 'atraso' | 'falta' | 'licencia'>>; // sesionId -> estudianteId -> estado
}

export function downloadMonthlyAttendanceSheetExcel(data: MonthlyAttendanceExportData) {
  const institucion = data.institucion || getLocalDatosInstitucionales();
  const wb = XLSX.utils.book_new();

  // Sort students by name
  const sortedEstudiantes = [...data.estudiantes].sort((a, b) =>
    a.nombre_completo.localeCompare(b.nombre_completo)
  );

  // Sort sessions by date
  const sortedSesiones = [...data.sesiones].sort((a, b) => a.fecha.localeCompare(b.fecha));

  // Determine month title
  let mesTexto = data.mesAno;
  try {
    const [y, m] = data.mesAno.split('-');
    const d = new Date(Number(y), Number(m) - 1, 1);
    mesTexto = d.toLocaleDateString('es-BO', { month: 'long', year: 'numeric' }).toUpperCase();
  } catch {
    mesTexto = data.mesAno;
  }

  // Build rows array for Sheet
  const rows: any[][] = [];

  // 1. Institutional Header
  rows.push([institucion.nombre_completo.toUpperCase()]);
  rows.push(['PLANILLA OFICIAL DE ASISTENCIA MENSUAL']);
  rows.push([`MES / GESTIÓN: ${mesTexto}`, '', `CURSO / GRUPO: ${data.grupoNombre}`]);
  rows.push([
    `CARRERA / ESPECIALIDAD: ${data.carreraEspecialidad || 'General'}`,
    '',
    `NIVEL: ${data.nivel || 'General'}`
  ]);
  rows.push([
    `MATERIA / MÓDULO: ${data.materia || 'General'}`,
    '',
    `DOCENTE / FACILITADOR: ${data.docenteNombre}`
  ]);
  rows.push([]); // blank line

  // 2. Table Column Headers
  const headerRow = ['N°', 'CÓDIGO', 'NOMBRES Y APELLIDOS'];
  
  if (sortedSesiones.length > 0) {
    sortedSesiones.forEach(s => {
      const dayNum = s.fecha.slice(8, 10);
      headerRow.push(`Día ${dayNum}`);
    });
  } else {
    // If no registered sessions yet in that month, put generic day columns or notice
    headerRow.push('Sin sesiones');
  }

  headerRow.push('TOTAL P', 'TOTAL A', 'TOTAL F', 'TOTAL L', 'TOTAL SESIONES', '% ASIST.');
  rows.push(headerRow);

  // 3. Student Data Rows
  let totalPresGroup = 0;
  let totalAtrGroup = 0;
  let totalFaltGroup = 0;
  let totalLicGroup = 0;
  let totalSesionesCount = sortedSesiones.length;

  sortedEstudiantes.forEach((st, idx) => {
    let pCount = 0;
    let aCount = 0;
    let fCount = 0;
    let lCount = 0;

    const row: any[] = [
      idx + 1,
      st.codigo_interno || `EST-${idx + 1}`,
      st.nombre_completo
    ];

    if (sortedSesiones.length > 0) {
      sortedSesiones.forEach(s => {
        const estado = data.asistenciasPorSesionYEstudiante[s.id]?.[st.id];
        if (estado === 'presente') {
          row.push('P');
          pCount++;
        } else if (estado === 'atraso') {
          row.push('A');
          aCount++;
        } else if (estado === 'falta') {
          row.push('F');
          fCount++;
        } else if (estado === 'licencia') {
          row.push('L');
          lCount++;
        } else {
          row.push('-');
        }
      });
    } else {
      row.push('-');
    }

    const totalValid = pCount + aCount + fCount + lCount;
    const asistidos = pCount + aCount;
    const pct = totalValid > 0 ? `${Math.round((asistidos / totalValid) * 100)}%` : '0%';

    totalPresGroup += pCount;
    totalAtrGroup += aCount;
    totalFaltGroup += fCount;
    totalLicGroup += lCount;

    row.push(pCount, aCount, fCount, lCount, totalValid, pct);
    rows.push(row);
  });

  // 4. Totales por Día / Sesión
  rows.push([]);
  const totalesDiasRow = ['', '', 'TOTAL ASISTENCIAS POR SESIÓN (P+A)'];
  if (sortedSesiones.length > 0) {
    sortedSesiones.forEach(s => {
      let dayPresentes = 0;
      sortedEstudiantes.forEach(st => {
        const est = data.asistenciasPorSesionYEstudiante[s.id]?.[st.id];
        if (est === 'presente' || est === 'atraso') {
          dayPresentes++;
        }
      });
      totalesDiasRow.push(dayPresentes as any);
    });
  } else {
    totalesDiasRow.push('');
  }
  totalesDiasRow.push(totalPresGroup as any, totalAtrGroup as any, totalFaltGroup as any, totalLicGroup as any, '', '');
  rows.push(totalesDiasRow);

  // 5. Signature Footer
  rows.push([]);
  rows.push([]);
  rows.push(['', '_______________________________', '', '', '', '_______________________________']);
  rows.push(['', `DOCENTE: ${data.docenteNombre}`, '', '', '', `DIRECCIÓN: ${institucion.nombre_director}`]);
  rows.push(['', 'Firma y Sello del Facilitador', '', '', '', `${institucion.cargo_director} - Sello CEA`]);

  // Convert array of rows to sheet
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column width configuration
  const colWidths = [
    { wch: 5 },  // N°
    { wch: 14 }, // Código
    { wch: 32 }, // Nombre
  ];
  if (sortedSesiones.length > 0) {
    sortedSesiones.forEach(() => colWidths.push({ wch: 8 }));
  } else {
    colWidths.push({ wch: 14 });
  }
  colWidths.push({ wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 14 }, { wch: 10 });
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Planilla Mensual');

  const cleanGrupo = data.grupoNombre.replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `Planilla_Mensual_${cleanGrupo}_${data.mesAno}.xlsx`);
}

export interface DailyAttendanceExportData {
  institucion?: DatosInstitucionales;
  grupoNombre: string;
  carreraEspecialidad?: string;
  nivel?: string;
  materia?: string;
  docenteNombre: string;
  fecha: string; // e.g. 2026-08-22
  estudiantes: Array<{
    id: string;
    codigo_interno: string;
    nombre_completo: string;
    estado: 'presente' | 'atraso' | 'falta' | 'licencia' | string;
    observacion?: string;
  }>;
}

export function downloadDailyAttendanceReportExcel(data: DailyAttendanceExportData) {
  const institucion = data.institucion || getLocalDatosInstitucionales();
  const wb = XLSX.utils.book_new();

  const sorted = [...data.estudiantes].sort((a, b) =>
    a.nombre_completo.localeCompare(b.nombre_completo)
  );

  const total = sorted.length;
  const presentes = sorted.filter(e => e.estado === 'presente').length;
  const atrasos = sorted.filter(e => e.estado === 'atraso').length;
  const faltas = sorted.filter(e => e.estado === 'falta').length;
  const licencias = sorted.filter(e => e.estado === 'licencia').length;
  const pctAsistencia = total > 0 ? Math.round(((presentes + atrasos) / total) * 100) : 0;

  const rows: any[][] = [];

  // Institutional Header
  rows.push([institucion.nombre_completo.toUpperCase()]);
  rows.push(['REPORTE DIARIO DE ASISTENCIA ESTUDIANTIL']);
  rows.push([`FECHA: ${data.fecha}`, '', `GRUPO / CURSO: ${data.grupoNombre}`]);
  rows.push([`CARRERA: ${data.carreraEspecialidad || 'General'}`, '', `NIVEL: ${data.nivel || 'General'}`]);
  rows.push([`MATERIA: ${data.materia || 'General'}`, '', `DOCENTE: ${data.docenteNombre}`]);
  rows.push([]);

  // Summary KPIs
  rows.push(['RESUMEN DE ASISTENCIA DEL DÍA:']);
  rows.push([
    `Total Estudiantes: ${total}`,
    `Presentes: ${presentes}`,
    `Atrasos: ${atrasos}`,
    `Faltas: ${faltas}`,
    `Licencias: ${licencias}`,
    `% Asistencia: ${pctAsistencia}%`
  ]);
  rows.push([]);

  // Table Column Headers
  rows.push(['N°', 'CÓDIGO', 'NOMBRE COMPLETO DEL ESTUDIANTE', 'ESTADO DE ASISTENCIA', 'OBSERVACIÓN']);

  sorted.forEach((st, idx) => {
    let estadoLabel = (st.estado || 'PRESENTE').toUpperCase();
    rows.push([
      idx + 1,
      st.codigo_interno || `EST-${idx + 1}`,
      st.nombre_completo,
      estadoLabel,
      st.observacion || ''
    ]);
  });

  // Footer Signatures
  rows.push([]);
  rows.push([]);
  rows.push(['', '_______________________________', '', '_______________________________']);
  rows.push(['', `DOCENTE: ${data.docenteNombre}`, '', `DIRECCIÓN: ${institucion.nombre_director}`]);
  rows.push(['', 'Firma Facilitador Responsable', '', `${institucion.cargo_director}`]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws['!cols'] = [
    { wch: 5 },
    { wch: 14 },
    { wch: 36 },
    { wch: 22 },
    { wch: 28 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Reporte Diario');

  const cleanGrupo = data.grupoNombre.replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `Reporte_Diario_${cleanGrupo}_${data.fecha}.xlsx`);
}
