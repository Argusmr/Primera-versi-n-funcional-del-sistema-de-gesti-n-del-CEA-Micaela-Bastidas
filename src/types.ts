export type UserRole = 'superadmin' | 'docente';

export type FormatoPlanModular = 'Digital' | 'Impreso' | 'Ambos';
export type EstadoControlDocumental = 'presentado' | 'pendiente';

export interface ControlDocumental {
  id?: string;
  docente_id: string;
  tiene_plan_modular: boolean;
  formato_plan_modular: FormatoPlanModular;
  tiene_planificacion_curricular: boolean;
  fecha_revision?: string;
  observacion?: string;
  estado?: EstadoControlDocumental;
  updated_at?: string;
  updated_by?: string;
}

export interface Perfil {
  id: string;
  nombre_completo: string;
  ci?: string;
  rda?: string;
  especialidad?: string;
  nivel?: string;
  categoria?: string;
  materias?: string[];
  programa_id?: string;
  sede_id?: string;
  dias_laborales?: string[];
  horario_id?: string;
  rol: UserRole;
  activo: boolean;
  puede_publicar: boolean;
  fecha_incorporacion?: string;
  control_documental?: ControlDocumental;
  created_at?: string;
  updated_at?: string;
  // Joined fields
  sede_nombre?: string;
  programa_nombre?: string;
  horario_nombre?: string;
}

export interface Programa {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  created_at?: string;
}

export interface Sede {
  id: string;
  nombre: string;
  direccion?: string;
  latitud?: number;
  longitud?: number;
  radio_m?: number; // Radio permitido en metros (default 150)
  activo: boolean;
  created_at?: string;
}

export interface Horario {
  id: string;
  nombre: string;
  sede_id: string;
  hora_ingreso: string; // HH:mm
  tolerancia_hasta: string; // HH:mm
  hora_salida: string; // HH:mm
  es_invierno: boolean;
  dias_semana: string[];
  vigente_desde?: string;
  vigente_hasta?: string;
  activo: boolean;
  created_at?: string;
  // Joined
  sede_nombre?: string;
}

export interface Grupo {
  id: string;
  nombre: string;
  sede_id: string;
  programa_id: string;
  carrera_especialidad: string;
  nivel: string;
  activo: boolean;
  created_at?: string;
  // Joined
  sede_nombre?: string;
  programa_nombre?: string;
}

export interface AsignacionDocente {
  id: string;
  docente_id: string;
  grupo_id: string;
  materia: string;
  created_at?: string;
  // Joined
  grupo_nombre?: string;
  docente_nombre?: string;
}

export interface Etapa {
  id: string;
  nombre: string;
  programa_codigo?: string;
  descripcion?: string;
  activo: boolean;
  created_at?: string;
}

export interface NivelEducativo {
  id: string;
  nombre: string;
  etapa_nombre?: string;
  programa_codigo?: string;
  descripcion?: string;
  activo: boolean;
  created_at?: string;
}

export type EstadoEstudiante = 'activo' | 'retirado' | 'trasladado' | 'egresado';

export interface Estudiante {
  id: string;
  codigo_interno: string;
  nombre_completo: string;
  documento?: string;
  sexo?: 'Masculino' | 'Femenino' | 'M' | 'F' | string;
  fecha_inscripcion: string;
  gestion?: string;
  programa_id: string;
  programa_codigo?: string;
  sede_id: string;
  carrera_especialidad: string;
  etapa?: string;
  nivel: string;
  grupo_id: string;
  estado: EstadoEstudiante;
  fecha_retiro?: string;
  observacion?: string;
  created_at?: string;
  updated_at?: string;
  // Joined
  grupo_nombre?: string;
  sede_nombre?: string;
  programa_nombre?: string;
}

export type EstadoAsistenciaDocente =
  | 'puntual'
  | 'atraso'
  | 'salida_anticipada'
  | 'registro_incompleto'
  | 'falta'
  | 'licencia'
  | 'pendiente_verificacion';

export type EstadoGPS = 'dentro_rango' | 'fuera_rango' | 'gps_impreciso' | 'sin_gps';
export type EstadoExcepcion = 'ninguna' | 'pendiente_revision' | 'aprobada' | 'rechazada';

export interface FilaActividadPedagogica {
  id: string;
  area_nivel: 'EPA' | 'ESA' | 'ETA' | string;
  subnivel: string;
  carrera?: string;
  actividad_pedagogica: string;
}

export interface AsistenciaDocente {
  id: string;
  docente_id: string;
  fecha_laboral: string;
  hora_ingreso_oficial?: string;
  hora_salida_oficial?: string;
  hora_ingreso_local?: string;
  hora_salida_local?: string;
  firma_ingreso?: boolean;
  firma_salida?: boolean;
  minutos_atraso: number;
  minutos_salida_anticipada: number;
  horas_trabajadas: number;
  estado: EstadoAsistenciaDocente;
  origen_registro: 'en_linea' | 'sin_conexion';
  hora_sincronizacion?: string;
  sync_key: string;
  observacion?: string;
  actividades_multigrado?: FilaActividadPedagogica[];

  // GPS y Selfie - Entrada
  latitud_ingreso?: number;
  longitud_ingreso?: number;
  precision_gps_ingreso?: number;
  distancia_m_ingreso?: number;
  estado_gps_ingreso?: EstadoGPS;
  selfie_url?: string; // Path en bucket selfies-asistencia o URL firmada / local blob
  observacion_excepcion?: string;
  estado_excepcion?: EstadoExcepcion;
  validado_por?: string;
  fecha_validacion?: string;

  // GPS - Salida
  latitud_salida?: number;
  longitud_salida?: number;
  precision_gps_salida?: number;

  created_at?: string;
  // Joined
  docente_nombre?: string;
  sede_nombre?: string;
}

export interface ActividadPedagogica {
  id: string;
  asistencia_docente_id?: string;
  docente_id: string;
  fecha: string;
  sede_id?: string;
  grupo_id?: string;
  materia: string;
  periodos_desarrollados: number;
  contenido_actividad: string;
  numero_participantes: number;
  observacion?: string;
  evidencia_url?: string;
  created_at?: string;
  // Joined
  grupo_nombre?: string;
  sede_nombre?: string;
}

export interface SesionClase {
  id: string;
  grupo_id: string;
  docente_id: string;
  fecha: string;
  materia: string;
  created_at?: string;
}

export type EstadoAsistenciaEstudiante = 'presente' | 'atraso' | 'falta' | 'licencia';

export interface AsistenciaEstudiante {
  id: string;
  sesion_id: string;
  estudiante_id: string;
  estado: EstadoAsistenciaEstudiante;
  observacion?: string;
  created_at?: string;
  // Joined
  estudiante_nombre?: string;
  codigo_interno?: string;
}

export type TipoAlertaEstudiante = 'amarillo_2_faltas' | 'rojo_3_faltas' | 'riesgo_prolongado';
export type EstadoAlertaEstudiante = 'pendiente' | 'atendido' | 'reincorporado';

export interface AlertaEstudiante {
  id: string;
  estudiante_id: string;
  grupo_id: string;
  docente_id: string;
  tipo: TipoAlertaEstudiante;
  faltas_consecutivas: number;
  estado: EstadoAlertaEstudiante;
  created_at?: string;
  // Joined
  estudiante_nombre?: string;
  grupo_nombre?: string;
  docente_nombre?: string;
}

export type AccionSeguimiento =
  | 'llamada'
  | 'mensaje'
  | 'visita'
  | 'conversacion_personal'
  | 'derivacion'
  | 'otra';

export interface Seguimiento {
  id: string;
  alerta_id?: string;
  estudiante_id: string;
  docente_id: string;
  fecha: string;
  motivo: string;
  accion_realizada: AccionSeguimiento;
  resultado: string;
  proxima_accion?: string;
  observacion?: string;
  estado: 'pendiente' | 'cerrado';
  evidencia_url?: string;
  created_at?: string;
  // Joined
  estudiante_nombre?: string;
  docente_nombre?: string;
}

export type CategoriaPublicacion =
  | 'anuncios'
  | 'comunicados'
  | 'instructivos'
  | 'normativa'
  | 'rm_001_2026'
  | 'poa'
  | 'calendario'
  | 'formularios'
  | 'otros';

export type TipoArchivo = 'imagen' | 'pdf' | 'word' | 'excel' | 'ninguno';

export interface Publicacion {
  id: string;
  titulo: string;
  descripcion: string;
  categoria: CategoriaPublicacion;
  fecha: string;
  destacado: boolean;
  archivo_url?: string;
  tipo_archivo: TipoArchivo;
  nombre_archivo?: string;
  contenido_texto?: string;
  autor_id?: string;
  archivado: boolean;
  created_at?: string;
  // Joined
  autor_nombre?: string;
  leido?: boolean;
}

export interface Documento {
  id: string;
  publicacion_id: string;
  nombre: string;
  url: string;
  tipo: string;
  tamano_bytes?: number;
  created_at?: string;
}

export interface Auditoria {
  id: string;
  usuario_id?: string;
  usuario_nombre: string;
  accion: string;
  tabla_afectada: string;
  registro_afectado_id?: string;
  valor_anterior?: any;
  valor_nuevo?: any;
  motivo_correccion: string;
  created_at?: string;
}

export interface ResumenAsistenciaDocenteMensual {
  docente_id: string;
  docente_nombre: string;
  dias_programados: number;
  dias_asistidos: number;
  dias_puntuales: number;
  atrasos: number;
  faltas: number;
  licencias: number;
  salidas_anticipadas: number;
  registros_incompletos: number;
  registros_sin_conexion: number;
  horas_trabajadas: number;
  porcentaje_asistencia: number;
  porcentaje_puntualidad: number;
}

export interface DatosInstitucionales {
  nombre_completo: string;
  nombre_corto: string;
  nombre_director: string;
  cargo_director: string;
  direccion: string;
  telefono: string;
  lema_subtitulo: string;
}

export interface ConfiguracionCalendario {
  id: string;
  mes: string; // 'YYYY-MM'
  dias_trabajados: number;
  observacion?: string;
  creado_por?: string;
  created_at?: string;
  updated_at?: string;
}


