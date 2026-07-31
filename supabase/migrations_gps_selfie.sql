-- ====================================================================
-- MIGRACIÓN: VERIFICACIÓN GPS Y SELFIE COMPRIMIDA EN ASISTENCIA DOCENTE
-- ====================================================================

-- 1. CAMPOS DE GEOLOCALIZACIÓN Y RADIO EN SEDES
ALTER TABLE public.sedes
  ADD COLUMN IF NOT EXISTS latitud NUMERIC,
  ADD COLUMN IF NOT EXISTS longitud NUMERIC,
  ADD COLUMN IF NOT EXISTS radio_m INTEGER DEFAULT 150;

-- Coordenadas por defecto para las sedes de Poroma y San Juan de Horcas
UPDATE public.sedes
SET latitud = -19.033333, longitud = -65.262222, radio_m = 150
WHERE nombre LIKE '%Poroma%' AND latitud IS NULL;

UPDATE public.sedes
SET latitud = -19.085000, longitud = -65.312000, radio_m = 150
WHERE nombre LIKE '%San Juan%' AND latitud IS NULL;

-- 2. CAMPOS DE GPS, SELFIE Y EXCEPCIONES EN ASISTENCIAS DOCENTES
ALTER TABLE public.asistencias_docentes
  ADD COLUMN IF NOT EXISTS latitud_ingreso NUMERIC,
  ADD COLUMN IF NOT EXISTS longitud_ingreso NUMERIC,
  ADD COLUMN IF NOT EXISTS precision_gps_ingreso NUMERIC,
  ADD COLUMN IF NOT EXISTS distancia_m_ingreso NUMERIC,
  ADD COLUMN IF NOT EXISTS estado_gps_ingreso TEXT DEFAULT 'dentro_rango',
  ADD COLUMN IF NOT EXISTS selfie_url TEXT,
  ADD COLUMN IF NOT EXISTS observacion_excepcion TEXT,
  ADD COLUMN IF NOT EXISTS estado_excepcion TEXT DEFAULT 'ninguna',
  ADD COLUMN IF NOT EXISTS validado_por UUID REFERENCES public.perfiles(id),
  ADD COLUMN IF NOT EXISTS fecha_validacion TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS latitud_salida NUMERIC,
  ADD COLUMN IF NOT EXISTS longitud_salida NUMERIC,
  ADD COLUMN IF NOT EXISTS precision_gps_salida NUMERIC;

-- 3. CREACIÓN DEL BUCKET PRIVADO EN SUPABASE STORAGE
INSERT INTO storage.buckets (id, name, public)
VALUES ('selfies-asistencia', 'selfies-asistencia', false)
ON CONFLICT (id) DO NOTHING;

-- POLÍTICAS DE SEGURIDAD RLS PARA STORAGE EN selfies-asistencia
CREATE POLICY "Docente puede subir su propia selfie"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'selfies-asistencia' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Lectura restringida de selfies de asistencia"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'selfies-asistencia' AND (
      (storage.foldername(name))[1] = auth.uid()::text OR
      EXISTS (
        SELECT 1 FROM public.perfiles
        WHERE id = auth.uid() AND rol IN ('superadmin')
      )
    )
  );

-- 4. ACTUALIZACIÓN DEL RPC REGISTRAR INGRESO CON GPS Y SELFIE
CREATE OR REPLACE FUNCTION public.registrar_ingreso_gps(
  p_docente_id UUID,
  p_sync_key TEXT,
  p_hora_local TIMESTAMPTZ,
  p_es_offline BOOLEAN,
  p_latitud NUMERIC DEFAULT NULL,
  p_longitud NUMERIC DEFAULT NULL,
  p_precision NUMERIC DEFAULT NULL,
  p_distancia NUMERIC DEFAULT NULL,
  p_estado_gps TEXT DEFAULT 'dentro_rango',
  p_selfie_url TEXT DEFAULT NULL,
  p_observacion_excepcion TEXT DEFAULT NULL,
  p_estado_excepcion TEXT DEFAULT 'ninguna',
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
  -- Comprobar autorización
  IF auth.uid() != p_docente_id THEN
    SELECT rol INTO v_perfil FROM public.perfiles WHERE id = auth.uid();
    IF v_perfil.rol IS NULL OR v_perfil.rol != 'superadmin' THEN
      RAISE EXCEPTION 'No está autorizado para registrar ingreso de otro docente';
    END IF;
  END IF;

  -- Comprobar duplicado por sync_key
  SELECT * INTO v_existente FROM public.asistencias_docentes WHERE sync_key = p_sync_key;
  IF FOUND THEN
    RETURN to_jsonb(v_existente);
  END IF;

  -- Comprobar duplicado por fecha laboral
  SELECT * INTO v_existente FROM public.asistencias_docentes 
  WHERE docente_id = p_docente_id AND fecha_laboral = v_fecha;

  IF FOUND THEN
    IF v_existente.hora_ingreso_oficial IS NOT NULL THEN
      RETURN to_jsonb(v_existente);
    END IF;
  END IF;

  -- Obtener horario
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

  IF p_estado_excepcion = 'pendiente_revision' THEN
    v_estado := 'pendiente_verificacion';
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
    latitud_ingreso,
    longitud_ingreso,
    precision_gps_ingreso,
    distancia_m_ingreso,
    estado_gps_ingreso,
    selfie_url,
    observacion_excepcion,
    estado_excepcion,
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
    p_latitud,
    p_longitud,
    p_precision,
    p_distancia,
    p_estado_gps,
    p_selfie_url,
    p_observacion_excepcion,
    p_estado_excepcion,
    p_observacion
  )
  RETURNING * INTO v_res;

  RETURN to_jsonb(v_res);
END;
$$;

-- 5. ACTUALIZACIÓN DEL RPC REGISTRAR SALIDA CON GPS
CREATE OR REPLACE FUNCTION public.registrar_salida_gps(
  p_docente_id UUID,
  p_sync_key TEXT,
  p_hora_local TIMESTAMPTZ,
  p_es_offline BOOLEAN,
  p_latitud NUMERIC DEFAULT NULL,
  p_longitud NUMERIC DEFAULT NULL,
  p_precision NUMERIC DEFAULT NULL,
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
  v_asistencia RECORD;
  v_perfil RECORD;
  v_horas_trabajadas NUMERIC(5,2) := 0;
  v_res RECORD;
BEGIN
  IF auth.uid() != p_docente_id THEN
    SELECT rol INTO v_perfil FROM public.perfiles WHERE id = auth.uid();
    IF v_perfil.rol IS NULL OR v_perfil.rol != 'superadmin' THEN
      RAISE EXCEPTION 'No está autorizado para registrar salida de otro docente';
    END IF;
  END IF;

  SELECT * INTO v_asistencia FROM public.asistencias_docentes 
  WHERE docente_id = p_docente_id AND fecha_laboral = v_fecha;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Debe registrar ingreso antes de registrar la salida';
  END IF;

  IF v_asistencia.hora_salida_oficial IS NOT NULL THEN
    RETURN to_jsonb(v_asistencia);
  END IF;

  IF p_es_offline THEN
    v_salida_oficial := p_hora_local;
  ELSE
    v_salida_oficial := v_hora_servidor;
  END IF;

  v_horas_trabajadas := EXTRACT(EPOCH FROM (v_salida_oficial - v_asistencia.hora_ingreso_oficial)) / 3600;

  UPDATE public.asistencias_docentes
  SET 
    hora_salida_oficial = v_salida_oficial,
    hora_salida_local = p_hora_local,
    horas_trabajadas = ROUND(v_horas_trabajadas, 2),
    latitud_salida = p_latitud,
    longitud_salida = p_longitud,
    precision_gps_salida = p_precision,
    observacion = COALESCE(p_observacion, observacion)
  WHERE id = v_asistencia.id
  RETURNING * INTO v_res;

  RETURN to_jsonb(v_res);
END;
$$;
