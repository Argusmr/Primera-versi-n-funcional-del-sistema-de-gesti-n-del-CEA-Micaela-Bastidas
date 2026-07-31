-- ==========================================
-- CEA MICAELA BASTIDAS - BASE DE DATOS SUPABASE
-- ==========================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLA PROGRAMAS
CREATE TABLE IF NOT EXISTS public.programas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Datos iniciales de Programas
INSERT INTO public.programas (codigo, nombre, descripcion) VALUES
  ('EPJA', 'Educación de Personas Jóvenes y Adultas', 'Atención educativa a jóvenes y adultos'),
  ('EDUPER', 'Educación Permanente', 'Cursos y capacitaciones comunitarias continuas'),
  ('CEE', 'Educación Especial', 'Atención a personas con necesidades educativas especiales')
ON CONFLICT (codigo) DO NOTHING;

-- 2. TABLA SEDES
CREATE TABLE IF NOT EXISTS public.sedes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT UNIQUE NOT NULL,
  direccion TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Datos iniciales de Sedes
INSERT INTO public.sedes (nombre, direccion) VALUES
  ('Sede Poroma', 'Poroma - Chuquisaca'),
  ('Sede San Juan de Horcas', 'San Juan de Horcas - Chuquisaca')
ON CONFLICT (nombre) DO NOTHING;

-- 3. TABLA HORARIOS
CREATE TABLE IF NOT EXISTS public.horarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  sede_id UUID REFERENCES public.sedes(id) ON DELETE CASCADE,
  hora_ingreso TIME NOT NULL,
  tolerancia_hasta TIME NOT NULL,
  hora_salida TIME NOT NULL,
  es_invierno BOOLEAN DEFAULT false,
  dias_semana TEXT[] DEFAULT ARRAY['lunes', 'martes', 'miércoles', 'jueves', 'viernes'],
  vigente_desde DATE DEFAULT '2026-01-01',
  vigente_hasta DATE DEFAULT '2026-12-31',
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. TABLA PERFILES (Docentes y Director/Superadmin)
CREATE TABLE IF NOT EXISTS public.perfiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_completo TEXT NOT NULL,
  ci TEXT,
  rda TEXT,
  especialidad TEXT,
  nivel TEXT,
  categoria TEXT,
  materias TEXT[] DEFAULT '{}',
  programa_id UUID REFERENCES public.programas(id),
  sede_id UUID REFERENCES public.sedes(id),
  dias_laborales TEXT[] DEFAULT ARRAY['lunes', 'martes', 'miércoles', 'jueves', 'viernes'],
  horario_id UUID REFERENCES public.horarios(id),
  rol TEXT CHECK (rol IN ('superadmin', 'docente')) NOT NULL DEFAULT 'docente',
  activo BOOLEAN DEFAULT true,
  puede_publicar BOOLEAN DEFAULT false,
  fecha_incorporacion DATE DEFAULT current_date,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. TABLA GRUPOS
CREATE TABLE IF NOT EXISTS public.grupos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  sede_id UUID REFERENCES public.sedes(id) ON DELETE CASCADE,
  programa_id UUID REFERENCES public.programas(id),
  carrera_especialidad TEXT NOT NULL,
  nivel TEXT NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. TABLA ASIGNACIONES DOCENTES (Docente - Grupo - Materia)
CREATE TABLE IF NOT EXISTS public.asignaciones_docentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  docente_id UUID REFERENCES public.perfiles(id) ON DELETE CASCADE,
  grupo_id UUID REFERENCES public.grupos(id) ON DELETE CASCADE,
  materia TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (docente_id, grupo_id, materia)
);

-- 7. TABLA PERIODOS ACADEMICOS / CALENDARIO
CREATE TABLE IF NOT EXISTS public.periodos_academicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gestion INTEGER DEFAULT 2026,
  nombre TEXT NOT NULL,
  fecha_inicio_operativa DATE NOT NULL DEFAULT '2026-07-27',
  fecha_fin_operativa DATE NOT NULL DEFAULT '2026-12-14',
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.periodos_academicos (gestion, nombre, fecha_inicio_operativa, fecha_fin_operativa)
VALUES (2026, 'Segundo Semestre 2026', '2026-07-27', '2026-12-14')
ON CONFLICT DO NOTHING;

-- 8. TABLA DIAS NO LABORALES (Feriados / Suspensiones)
CREATE TABLE IF NOT EXISTS public.dias_no_laborales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE UNIQUE NOT NULL,
  motivo TEXT NOT NULL,
  tipo TEXT CHECK (tipo IN ('feriado', 'suspension', 'actividad_extraordinaria')) DEFAULT 'feriado',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. TABLA ASISTENCIAS DOCENTES (Control biométrico / manual seguro)
CREATE TABLE IF NOT EXISTS public.asistencias_docentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  docente_id UUID REFERENCES public.perfiles(id) ON DELETE CASCADE,
  fecha_laboral DATE NOT NULL,
  hora_ingreso_oficial TIMESTAMPTZ,
  hora_salida_oficial TIMESTAMPTZ,
  hora_ingreso_local TIMESTAMPTZ,
  hora_salida_local TIMESTAMPTZ,
  minutos_atraso INTEGER DEFAULT 0,
  minutos_salida_anticipada INTEGER DEFAULT 0,
  horas_trabajadas NUMERIC(5,2) DEFAULT 0,
  estado TEXT CHECK (estado IN ('puntual', 'atraso', 'salida_anticipada', 'registro_incompleto', 'falta', 'licencia', 'pendiente_verificacion')) NOT NULL,
  origen_registro TEXT CHECK (origen_registro IN ('en_linea', 'sin_conexion')) DEFAULT 'en_linea',
  hora_sincronizacion TIMESTAMPTZ,
  sync_key TEXT UNIQUE NOT NULL,
  observacion TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (docente_id, fecha_laboral)
);

-- 10. TABLA ACTIVIDADES PEDAGOGICAS
CREATE TABLE IF NOT EXISTS public.actividades_pedagogicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asistencia_docente_id UUID REFERENCES public.asistencias_docentes(id) ON DELETE SET NULL,
  docente_id UUID REFERENCES public.perfiles(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT current_date,
  sede_id UUID REFERENCES public.sedes(id),
  grupo_id UUID REFERENCES public.grupos(id),
  materia TEXT NOT NULL,
  periodos_desarrollados INTEGER DEFAULT 1,
  contenido_actividad TEXT NOT NULL,
  numero_participantes INTEGER DEFAULT 0,
  observacion TEXT,
  evidencia_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. TABLA ESTUDIANTES
CREATE TABLE IF NOT EXISTS public.estudiantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_interno TEXT UNIQUE NOT NULL,
  nombre_completo TEXT NOT NULL,
  documento TEXT,
  fecha_inscripcion DATE NOT NULL DEFAULT current_date,
  programa_id UUID REFERENCES public.programas(id),
  sede_id UUID REFERENCES public.sedes(id),
  carrera_especialidad TEXT NOT NULL,
  nivel TEXT NOT NULL,
  grupo_id UUID REFERENCES public.grupos(id),
  estado TEXT CHECK (estado IN ('activo', 'retirado', 'trasladado', 'egresado')) DEFAULT 'activo',
  fecha_retiro DATE,
  observacion TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 12. TABLA SESIONES CLASE (Control por materia y día)
CREATE TABLE IF NOT EXISTS public.sesiones_clase (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id UUID REFERENCES public.grupos(id) ON DELETE CASCADE,
  docente_id UUID REFERENCES public.perfiles(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  materia TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (grupo_id, fecha, materia)
);

-- 13. TABLA ASISTENCIAS ESTUDIANTES
CREATE TABLE IF NOT EXISTS public.asistencias_estudiantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sesion_id UUID REFERENCES public.sesiones_clase(id) ON DELETE CASCADE,
  estudiante_id UUID REFERENCES public.estudiantes(id) ON DELETE CASCADE,
  estado TEXT CHECK (estado IN ('presente', 'atraso', 'falta', 'licencia')) NOT NULL,
  observacion TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (sesion_id, estudiante_id)
);

-- 14. TABLA ALERTAS ESTUDIANTES
CREATE TABLE IF NOT EXISTS public.alertas_estudiantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id UUID REFERENCES public.estudiantes(id) ON DELETE CASCADE,
  grupo_id UUID REFERENCES public.grupos(id) ON DELETE CASCADE,
  docente_id UUID REFERENCES public.perfiles(id) ON DELETE CASCADE,
  tipo TEXT CHECK (tipo IN ('amarillo_2_faltas', 'rojo_3_faltas', 'riesgo_prolongado')) NOT NULL,
  faltas_consecutivas INTEGER DEFAULT 2,
  estado TEXT CHECK (estado IN ('pendiente', 'atendido', 'reincorporado')) DEFAULT 'pendiente',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 15. TABLA SEGUIMIENTOS
CREATE TABLE IF NOT EXISTS public.seguimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alerta_id UUID REFERENCES public.alertas_estudiantes(id) ON DELETE SET NULL,
  estudiante_id UUID REFERENCES public.estudiantes(id) ON DELETE CASCADE,
  docente_id UUID REFERENCES public.perfiles(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT current_date,
  motivo TEXT NOT NULL,
  accion_realizada TEXT CHECK (accion_realizada IN ('llamada', 'mensaje', 'visita', 'conversacion_personal', 'derivacion', 'otra')) NOT NULL,
  resultado TEXT NOT NULL,
  proxima_accion TEXT,
  observacion TEXT,
  estado TEXT CHECK (estado IN ('pendiente', 'cerrado')) DEFAULT 'pendiente',
  evidencia_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 16. TABLA PUBLICACIONES
CREATE TABLE IF NOT EXISTS public.publicaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  categoria TEXT CHECK (categoria IN ('anuncios', 'comunicados', 'instructivos', 'normativa', 'rm_001_2026', 'poa', 'calendario', 'formularios', 'otros')) NOT NULL,
  fecha DATE NOT NULL DEFAULT current_date,
  destacado BOOLEAN DEFAULT false,
  archivo_url TEXT,
  tipo_archivo TEXT CHECK (tipo_archivo IN ('imagen', 'pdf', 'word', 'excel', 'ninguno')) DEFAULT 'ninguno',
  nombre_archivo TEXT,
  contenido_texto TEXT,
  autor_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
  archivado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 17. TABLA DOCUMENTOS
CREATE TABLE IF NOT EXISTS public.documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publicacion_id UUID REFERENCES public.publicaciones(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  url TEXT NOT NULL,
  tipo TEXT NOT NULL,
  tamano_bytes BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 18. TABLA LECTURAS PUBLICACIONES
CREATE TABLE IF NOT EXISTS public.lecturas_publicaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publicacion_id UUID REFERENCES public.publicaciones(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES public.perfiles(id) ON DELETE CASCADE,
  leido_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (publicacion_id, usuario_id)
);

-- 19. TABLA AUDITORIA
CREATE TABLE IF NOT EXISTS public.auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
  usuario_nombre TEXT NOT NULL,
  accion TEXT NOT NULL,
  tabla_afectada TEXT NOT NULL,
  registro_afectado_id TEXT,
  valor_anterior JSONB,
  valor_nuevo JSONB,
  motivo_correccion TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- FUNCIONES SEGURAS DE SERVIDOR (RPC)
-- ==========================================

-- Función para obtener hora oficial del servidor PostgreSQL
CREATE OR REPLACE FUNCTION public.obtener_hora_servidor()
RETURNS TIMESTAMPTZ
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT now();
$$;

-- RPC: Registrar Ingreso Docente Seguro
CREATE OR REPLACE FUNCTION public.registrar_ingreso(
  p_docente_id UUID,
  p_sync_key TEXT,
  p_hora_local TIMESTAMPTZ,
  p_es_offline BOOLEAN,
  p_observacion TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hora_servidor TIMESTAMPTZ := now();
  v_fecha DATE := (v_hora_servidor AT TIME ZONE 'America/La_Paz')::DATE;
  v_ingreso_oficial TIMESTAMPTZ;
  v_horario RECORD;
  v_perfil RECORD;
  v_existente RECORD;
  v_minutos_atraso INT := 0;
  v_estado TEXT := 'puntual';
  v_hora_limite_tolerancia TIME;
  v_hora_ingreso_plan TIME;
  v_hora_marcada TIME;
  v_res RECORD;
BEGIN
  -- Verificar que la persona solicitante sea el propio docente o superadmin
  IF auth.uid() != p_docente_id THEN
    SELECT rol INTO v_perfil FROM public.perfiles WHERE id = auth.uid();
    IF v_perfil.rol IS NULL OR v_perfil.rol != 'superadmin' THEN
      RAISE EXCEPTION 'No está autorizado para registrar ingreso de otro docente';
    END IF;
  END IF;

  -- Comprobar si ya existe un registro con esta sync_key
  SELECT * INTO v_existente FROM public.asistencias_docentes WHERE sync_key = p_sync_key;
  IF FOUND THEN
    RETURN to_jsonb(v_existente);
  END IF;

  -- Comprobar si ya registró ingreso hoy
  SELECT * INTO v_existente FROM public.asistencias_docentes 
  WHERE docente_id = p_docente_id AND fecha_laboral = v_fecha;

  IF FOUND THEN
    IF v_existente.hora_ingreso_oficial IS NOT NULL THEN
      RAISE EXCEPTION 'Ya existe un registro de ingreso para la jornada de hoy';
    END IF;
  END IF;

  -- Obtener horario del docente
  SELECT h.* INTO v_horario 
  FROM public.perfiles p
  JOIN public.horarios h ON h.id = p.horario_id
  WHERE p.id = p_docente_id;

  IF p_es_offline THEN
    v_ingreso_oficial := p_hora_local;
    v_estado := 'pendiente_verificacion';
  ELSE
    v_ingreso_oficial := v_hora_servidor;
    
    IF v_horario IS NOT NULL THEN
      v_hora_ingreso_plan := v_horario.hora_ingreso;
      v_hora_limite_tolerancia := v_horario.tolerancia_hasta;
      v_hora_marcada := (v_ingreso_oficial AT TIME ZONE 'America/La_Paz')::TIME;

      IF v_hora_marcada > v_hora_limite_tolerancia THEN
        v_estado := 'atraso';
        v_minutos_atraso := EXTRACT(EPOCH FROM (v_hora_marcada - v_hora_ingreso_plan)) / 60;
      ELSE
        v_estado := 'puntual';
      END IF;
    END IF;
  END IF;

  INSERT INTO public.asistencias_docentes (
    docente_id,
    fecha_laboral,
    hora_ingreso_oficial,
    hora_ingreso_local,
    minutos_atraso,
    estado,
    origen_registro,
    hora_sincronizacion,
    sync_key,
    observacion
  ) VALUES (
    p_docente_id,
    v_fecha,
    v_ingreso_oficial,
    p_hora_local,
    v_minutos_atraso,
    v_estado,
    CASE WHEN p_es_offline THEN 'sin_conexion' ELSE 'en_linea' END,
    CASE WHEN p_es_offline THEN NULL ELSE v_hora_servidor END,
    p_sync_key,
    p_observacion
  )
  RETURNING * INTO v_res;

  RETURN to_jsonb(v_res);
END;
$$;

-- RPC: Registrar Salida Docente Seguro
CREATE OR REPLACE FUNCTION public.registrar_salida(
  p_docente_id UUID,
  p_sync_key TEXT,
  p_hora_local TIMESTAMPTZ,
  p_es_offline BOOLEAN,
  p_observacion TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hora_servidor TIMESTAMPTZ := now();
  v_fecha DATE := (v_hora_servidor AT TIME ZONE 'America/La_Paz')::DATE;
  v_salida_oficial TIMESTAMPTZ;
  v_horario RECORD;
  v_asistencia RECORD;
  v_perfil RECORD;
  v_horas_trabajadas NUMERIC(5,2) := 0;
  v_minutos_salida_anticipada INT := 0;
  v_hora_salida_plan TIME;
  v_hora_marcada TIME;
  v_res RECORD;
BEGIN
  IF auth.uid() != p_docente_id THEN
    SELECT rol INTO v_perfil FROM public.perfiles WHERE id = auth.uid();
    IF v_perfil.rol IS NULL OR v_perfil.rol != 'superadmin' THEN
      RAISE EXCEPTION 'No está autorizado para registrar salida de otro docente';
    END IF;
  END IF;

  -- Buscar asistencia de hoy
  SELECT * INTO v_asistencia FROM public.asistencias_docentes 
  WHERE docente_id = p_docente_id AND fecha_laboral = v_fecha;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Debe registrar ingreso antes de registrar la salida';
  END IF;

  IF v_asistencia.hora_salida_oficial IS NOT NULL THEN
    RETURN to_jsonb(v_asistencia);
  END IF;

  -- Obtener horario
  SELECT h.* INTO v_horario 
  FROM public.perfiles p
  JOIN public.horarios h ON h.id = p.horario_id
  WHERE p.id = p_docente_id;

  IF p_es_offline THEN
    v_salida_oficial := p_hora_local;
  ELSE
    v_salida_oficial := v_hora_servidor;
  END IF;

  -- Calcular horas trabajadas
  v_horas_trabajadas := ROUND((EXTRACT(EPOCH FROM (v_salida_oficial - v_asistencia.hora_ingreso_oficial)) / 3600.0)::numeric, 2);

  IF v_horario IS NOT NULL AND NOT p_es_offline THEN
    v_hora_salida_plan := v_horario.hora_salida;
    v_hora_marcada := (v_salida_oficial AT TIME ZONE 'America/La_Paz')::TIME;
    
    IF v_hora_marcada < v_hora_salida_plan THEN
      v_minutos_salida_anticipada := EXTRACT(EPOCH FROM (v_hora_salida_plan - v_hora_marcada)) / 60;
    END IF;
  END IF;

  UPDATE public.asistencias_docentes
  SET 
    hora_salida_oficial = v_salida_oficial,
    hora_salida_local = p_hora_local,
    horas_trabajadas = v_horas_trabajadas,
    minutos_salida_anticipada = v_minutos_salida_anticipada,
    observacion = COALESCE(p_observacion, observacion)
  WHERE id = v_asistencia.id
  RETURNING * INTO v_res;

  RETURN to_jsonb(v_res);
END;
$$;

-- RLS (ROW LEVEL SECURITY) POLICIES
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sedes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asignaciones_docentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periodos_academicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dias_no_laborales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistencias_docentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actividades_pedagogicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estudiantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sesiones_clase ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistencias_estudiantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_estudiantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seguimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publicaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lecturas_publicaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

-- Politica: Perfiles
CREATE POLICY "Superadmin gestiona perfiles" ON public.perfiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'superadmin')
  );

CREATE POLICY "Docente lee su propio perfil" ON public.perfiles
  FOR SELECT USING (id = auth.uid());

-- Politicas: Lectura general autorizada de catalogos
CREATE POLICY "Lectura autenticada de catalogos" ON public.programas FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Lectura autenticada de sedes" ON public.sedes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Lectura autenticada de horarios" ON public.horarios FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Lectura autenticada de grupos" ON public.grupos FOR SELECT USING (auth.uid() IS NOT NULL);

-- Politica: Asistencias Docentes
CREATE POLICY "Superadmin ve todas las asistencias docentes" ON public.asistencias_docentes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'superadmin')
  );

CREATE POLICY "Docente ve su propia asistencia" ON public.asistencias_docentes
  FOR SELECT USING (docente_id = auth.uid());

-- Politica: Estudiantes
CREATE POLICY "Superadmin gestiona estudiantes" ON public.estudiantes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'superadmin')
  );

CREATE POLICY "Docente ve estudiantes asignados" ON public.estudiantes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.asignaciones_docentes ad
      WHERE ad.docente_id = auth.uid() AND ad.grupo_id = estudiantes.grupo_id
    )
  );

-- Politica: Asistencia Estudiantes
CREATE POLICY "Superadmin gestiona asistencia estudiantil" ON public.asistencias_estudiantes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'superadmin')
  );

CREATE POLICY "Docente gestiona asistencia de sus grupos" ON public.asistencias_estudiantes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.sesiones_clase sc
      WHERE sc.id = asistencias_estudiantes.sesion_id AND sc.docente_id = auth.uid()
    )
  );

-- Politicas: Publicaciones y Documentos
CREATE POLICY "Lectura publica autenticada publicaciones" ON public.publicaciones
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Publicador gestiona publicaciones" ON public.publicaciones
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.perfiles 
      WHERE id = auth.uid() AND (rol = 'superadmin' OR puede_publicar = true)
    )
  );

-- STORAGE BUCKET setup script for Supabase
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documentos_institucionales', 'documentos_institucionales', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Acceso publico lectura archivos" ON storage.objects 
  FOR SELECT USING (bucket_id = 'documentos_institucionales');

CREATE POLICY "Publicadores suben archivos" ON storage.objects 
  FOR INSERT WITH CHECK (
    bucket_id = 'documentos_institucionales' AND
    EXISTS (
      SELECT 1 FROM public.perfiles 
      WHERE id = auth.uid() AND (rol = 'superadmin' OR puede_publicar = true)
    )
  );
