import * as XLSX from 'xlsx';
import { AsistenciaDocente, Estudiante, AlertaEstudiante, Seguimiento, Perfil, ResumenAsistenciaDocenteMensual } from '../types';

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
  const fileSuffix = mesAno ? mesAno.replace('-', '_') : new Date().toISOString().split('T')[0];
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
  const wb = XLSX.utils.book_new();

  const dataAlertas = alertas.map((a) => {
    const seg = seguimientos.find(s => s.alerta_id === a.id);
    return {
      'Estudiante': a.estudiante_nombre,
      'Grupo': a.grupo_nombre,
      'Docente Responsable': a.docente_nombre,
      'Nivel de Alerta': a.tipo === 'rojo_3_faltas' ? 'ALERTA ROJA (3+ Faltas)' : 'ALERTA AMARILLA (2 Faltas)',
      'Faltas Consecutivas': a.faltas_consecutivas,
      'Estado Alerta': a.estado.toUpperCase(),
      'Fecha Último Seguimiento': seg ? seg.fecha : 'Pendiente',
      'Acción Realizada': seg ? seg.accion_realizada.toUpperCase() : 'Ninguna',
      'Resultado / Compromiso': seg ? seg.resultado : 'Sin intervención',
      'Próxima Acción': seg ? seg.proxima_accion || 'N/A' : 'Requiere llamada/visita'
    };
  });

  const ws = XLSX.utils.json_to_sheet(dataAlertas);
  XLSX.utils.book_append_sheet(wb, ws, 'Estudiantes en Riesgo');

  XLSX.writeFile(wb, `Reporte_Estudiantes_En_Riesgo_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
