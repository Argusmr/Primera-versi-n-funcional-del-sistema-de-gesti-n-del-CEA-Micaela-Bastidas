-- ==============================================================================
-- MIGRACIÓN: GESTIÓN DE MÚLTIPLES HORARIOS POR DOCENTE EN EL CEA (PASO 3)
-- ==============================================================================

-- 1. Crear tabla docentes_horarios si no existe
CREATE TABLE IF NOT EXISTS public.docentes_horarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  docente_id UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  horario_id UUID NOT NULL REFERENCES public.horarios(id) ON DELETE RESTRICT,
  sede_id UUID NOT NULL REFERENCES public.sedes(id) ON DELETE RESTRICT,
  dias_semana TEXT[] NOT NULL DEFAULT ARRAY['lunes', 'martes', 'miércoles', 'jueves', 'viernes']::TEXT[],
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Índices de optimización para búsqueda por docente y estado
CREATE INDEX IF NOT EXISTS idx_docentes_horarios_docente_activo 
  ON public.docentes_horarios(docente_id, activo);

CREATE INDEX IF NOT EXISTS idx_docentes_horarios_sede 
  ON public.docentes_horarios(sede_id);

CREATE INDEX IF NOT EXISTS idx_docentes_horarios_horario 
  ON public.docentes_horarios(horario_id);

-- 3. Habilitar Seguridad a Nivel de Fila (RLS)
ALTER TABLE public.docentes_horarios ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Acceso RLS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'docentes_horarios' AND policyname = 'Permitir lectura publica de docentes_horarios'
  ) THEN
    CREATE POLICY "Permitir lectura publica de docentes_horarios"
      ON public.docentes_horarios FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'docentes_horarios' AND policyname = 'Permitir insercion autenticada en docentes_horarios'
  ) THEN
    CREATE POLICY "Permitir insercion autenticada en docentes_horarios"
      ON public.docentes_horarios FOR INSERT
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'docentes_horarios' AND policyname = 'Permitir actualizacion en docentes_horarios'
  ) THEN
    CREATE POLICY "Permitir actualizacion en docentes_horarios"
      ON public.docentes_horarios FOR UPDATE
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'docentes_horarios' AND policyname = 'Permitir eliminacion en docentes_horarios'
  ) THEN
    CREATE POLICY "Permitir eliminacion en docentes_horarios"
      ON public.docentes_horarios FOR DELETE
      USING (true);
  END IF;
END $$;

-- 5. Semilla segura de asignación de múltiples horarios iniciales
-- Caso: Docentes con múltiples horarios (ej. San Juan Lun-Jue y Viernes)
DO $$
DECLARE
  v_sede_poroma_id UUID;
  v_sede_sanjuan_id UUID;
  v_hor_poroma_reg_id UUID;
  v_hor_sanjuan_lunjue_id UUID;
  v_hor_sanjuan_vie_id UUID;
  v_doc_roberto_id UUID;
  v_doc_elena_id UUID;
BEGIN
  SELECT id INTO v_sede_poroma_id FROM public.sedes WHERE nombre ILIKE '%Poroma%' LIMIT 1;
  SELECT id INTO v_sede_sanjuan_id FROM public.sedes WHERE nombre ILIKE '%San Juan%' LIMIT 1;

  SELECT id INTO v_hor_poroma_reg_id FROM public.horarios WHERE sede_id = v_sede_poroma_id AND es_invierno = false LIMIT 1;
  SELECT id INTO v_hor_sanjuan_lunjue_id FROM public.horarios WHERE sede_id = v_sede_sanjuan_id AND hora_ingreso = '16:30' LIMIT 1;
  SELECT id INTO v_hor_sanjuan_vie_id FROM public.horarios WHERE sede_id = v_sede_sanjuan_id AND hora_ingreso = '06:00' LIMIT 1;

  SELECT id INTO v_doc_elena_id FROM public.perfiles WHERE nombre_completo ILIKE '%Elena%' LIMIT 1;
  SELECT id INTO v_doc_roberto_id FROM public.perfiles WHERE nombre_completo ILIKE '%Roberto%' OR nombre_completo ILIKE '%Condori%' LIMIT 1;

  -- Asignar Elena Ramos (Poroma Lun-Vie)
  IF v_doc_elena_id IS NOT NULL AND v_sede_poroma_id IS NOT NULL AND v_hor_poroma_reg_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.docentes_horarios WHERE docente_id = v_doc_elena_id) THEN
      INSERT INTO public.docentes_horarios (docente_id, sede_id, horario_id, dias_semana, activo)
      VALUES (v_doc_elena_id, v_sede_poroma_id, v_hor_poroma_reg_id, ARRAY['lunes', 'martes', 'miércoles', 'jueves', 'viernes']::TEXT[], true);
    END IF;
  END IF;

  -- Asignar Roberto / Claudia (San Juan Lun-Jue y Viernes mañana)
  IF v_doc_roberto_id IS NOT NULL AND v_sede_sanjuan_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.docentes_horarios WHERE docente_id = v_doc_roberto_id) THEN
      IF v_hor_sanjuan_lunjue_id IS NOT NULL THEN
        INSERT INTO public.docentes_horarios (docente_id, sede_id, horario_id, dias_semana, activo)
        VALUES (v_doc_roberto_id, v_sede_sanjuan_id, v_hor_sanjuan_lunjue_id, ARRAY['lunes', 'martes', 'miércoles', 'jueves']::TEXT[], true);
      END IF;

      IF v_hor_sanjuan_vie_id IS NOT NULL THEN
        INSERT INTO public.docentes_horarios (docente_id, sede_id, horario_id, dias_semana, activo)
        VALUES (v_doc_roberto_id, v_sede_sanjuan_id, v_hor_sanjuan_vie_id, ARRAY['viernes']::TEXT[], true);
      END IF;
    END IF;
  END IF;
END $$;
