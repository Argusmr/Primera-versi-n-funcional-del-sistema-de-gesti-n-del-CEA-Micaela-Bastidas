-- ==============================================================================
-- MIGRACIÓN: Gestión de Horarios Institucionales por Sede y Temporada
-- ==============================================================================

-- 1. Asegurar columnas en public.horarios
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

-- Asegurar columnas si la tabla ya existía
ALTER TABLE public.horarios ADD COLUMN IF NOT EXISTS es_invierno BOOLEAN DEFAULT false;
ALTER TABLE public.horarios ADD COLUMN IF NOT EXISTS dias_semana TEXT[] DEFAULT ARRAY['lunes', 'martes', 'miércoles', 'jueves', 'viernes'];
ALTER TABLE public.horarios ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true;

-- 2. Habilitar RLS
ALTER TABLE public.horarios ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de acceso
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'horarios' 
      AND policyname = 'Lectura pública/autenticada de horarios'
  ) THEN
    CREATE POLICY "Lectura pública/autenticada de horarios" 
    ON public.horarios FOR SELECT 
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'horarios' 
      AND policyname = 'Superadmin administra horarios'
  ) THEN
    CREATE POLICY "Superadmin administra horarios"
    ON public.horarios FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.perfiles
        WHERE perfiles.id = auth.uid() AND perfiles.rol = 'superadmin'
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.perfiles
        WHERE perfiles.id = auth.uid() AND perfiles.rol = 'superadmin'
      )
    );
  END IF;
END $$;

-- 4. Sembrado seguro de horarios nominales del CEA
DO $$
DECLARE
  v_sede_poroma_id UUID;
  v_sede_sanjuan_id UUID;
BEGIN
  -- Obtener o crear Sede Poroma
  SELECT id INTO v_sede_poroma_id FROM public.sedes WHERE nombre ILIKE '%Poroma%' LIMIT 1;
  IF v_sede_poroma_id IS NULL THEN
    INSERT INTO public.sedes (nombre, direccion, radio_m, activo)
    VALUES ('Sede Poroma', 'Poroma - Chuquisaca', 150, true)
    RETURNING id INTO v_sede_poroma_id;
  END IF;

  -- Obtener o crear Sede San Juan de Horcas
  SELECT id INTO v_sede_sanjuan_id FROM public.sedes WHERE nombre ILIKE '%San Juan%' LIMIT 1;
  IF v_sede_sanjuan_id IS NULL THEN
    INSERT INTO public.sedes (nombre, direccion, radio_m, activo)
    VALUES ('Sede San Juan de Horcas', 'San Juan de Horcas - Chuquisaca', 150, true)
    RETURNING id INTO v_sede_sanjuan_id;
  END IF;

  -- Sede Poroma: Horario Regular (18:30 - 22:00)
  IF NOT EXISTS (SELECT 1 FROM public.horarios WHERE sede_id = v_sede_poroma_id AND es_invierno = false AND dias_semana @> ARRAY['lunes', 'viernes']) THEN
    INSERT INTO public.horarios (nombre, sede_id, hora_ingreso, tolerancia_hasta, hora_salida, es_invierno, dias_semana, activo)
    VALUES ('Poroma - Turno Noche (Regular)', v_sede_poroma_id, '18:30', '18:40', '22:00', false, ARRAY['lunes', 'martes', 'miércoles', 'jueves', 'viernes'], true);
  END IF;

  -- Sede Poroma: Horario Invierno (18:30 - 21:30)
  IF NOT EXISTS (SELECT 1 FROM public.horarios WHERE sede_id = v_sede_poroma_id AND es_invierno = true AND dias_semana @> ARRAY['lunes', 'viernes']) THEN
    INSERT INTO public.horarios (nombre, sede_id, hora_ingreso, tolerancia_hasta, hora_salida, es_invierno, dias_semana, activo)
    VALUES ('Poroma - Horario de Invierno', v_sede_poroma_id, '18:30', '18:40', '21:30', true, ARRAY['lunes', 'martes', 'miércoles', 'jueves', 'viernes'], true);
  END IF;

  -- Sede San Juan: Horario Regular 1 (Lun-Jue, 16:30 - 21:00)
  IF NOT EXISTS (SELECT 1 FROM public.horarios WHERE sede_id = v_sede_sanjuan_id AND dias_semana @> ARRAY['lunes', 'jueves'] AND NOT (dias_semana @> ARRAY['viernes'])) THEN
    INSERT INTO public.horarios (nombre, sede_id, hora_ingreso, tolerancia_hasta, hora_salida, es_invierno, dias_semana, activo)
    VALUES ('San Juan - Tarde/Noche (Lun-Jue)', v_sede_sanjuan_id, '16:30', '16:40', '21:00', false, ARRAY['lunes', 'martes', 'miércoles', 'jueves'], true);
  END IF;

  -- Sede San Juan: Horario Regular 2 (Viernes, 06:00 - 08:30)
  IF NOT EXISTS (SELECT 1 FROM public.horarios WHERE sede_id = v_sede_sanjuan_id AND dias_semana = ARRAY['viernes']) THEN
    INSERT INTO public.horarios (nombre, sede_id, hora_ingreso, tolerancia_hasta, hora_salida, es_invierno, dias_semana, activo)
    VALUES ('San Juan - Turno Matutino (Viernes)', v_sede_sanjuan_id, '06:00', '06:10', '08:30', false, ARRAY['viernes'], true);
  END IF;

END $$;
