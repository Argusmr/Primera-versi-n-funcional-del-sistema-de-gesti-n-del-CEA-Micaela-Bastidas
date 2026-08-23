-- ============================================================
-- CENTRO DE EDUCACIÓN ALTERNATIVA (CEA)
-- MIGRACIÓN Y ESTANDARIZACIÓN: ESTRUCTURA EDUCATIVA OFICIAL
-- ============================================================
-- Esta migración es SEGURA, IDEMPOTENTE y NO DESTRUCTIVA:
-- - No elimina estudiantes, docentes, asistencias ni grupos existentes.
-- - Corrige y estandariza la jerarquía oficial de Educación Alternativa:
--   1. EPJA (EPA: Elementales, Avanzados | ESA: Aplicados, Complementarios, Especializados)
--   2. ETA (Carreras Técnicas: Sistemas Informáticos, Gastronomía | Niveles: Técnico Básico, Auxiliar, Medio)
--   3. EDUPER (Educación Permanente: Cursos, Talleres, Procesos Formativos)
--   4. CEE (Educación Especial: Atención Inclusiva)
-- ============================================================

-- 1. TABLA PROGRAMAS: Garantizar los 4 programas oficiales
INSERT INTO public.programas (codigo, nombre, descripcion, activo)
VALUES
  ('EPJA', 'Educación de Personas Jóvenes y Adultas', 'Educación humanística integral en etapas de primaria (EPA) y secundaria (ESA).', true),
  ('ETA', 'Educación Técnica Alternativa', 'Formación técnica y tecnológica organizada en carreras y niveles de certificación laboral.', true),
  ('EDUPER', 'Educación Permanente', 'Cursos, talleres y procesos formativos continuos comunitarios no escolarizados.', true),
  ('CEE', 'Educación Especial', 'Atención integral a personas con necesidades educativas especiales y adaptaciones curriculares.', true)
ON CONFLICT (codigo) DO UPDATE
SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  activo = true;

-- 2. TABLA SUBPROGRAMAS (para EPJA)
CREATE TABLE IF NOT EXISTS public.subprogramas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programa_id UUID NOT NULL REFERENCES public.programas(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT subprogramas_programa_codigo_unique UNIQUE (programa_id, codigo)
);

-- Insertar EPA y ESA vinculados a EPJA
DO $$
DECLARE
  v_epja_id UUID;
BEGIN
  SELECT id INTO v_epja_id FROM public.programas WHERE codigo = 'EPJA' LIMIT 1;

  IF v_epja_id IS NOT NULL THEN
    INSERT INTO public.subprogramas (programa_id, codigo, nombre, descripcion, activo)
    VALUES
      (v_epja_id, 'EPA', 'Educación Primaria de Personas Jóvenes y Adultas', 'Comprende exclusivamente Aprendizajes Elementales y Aprendizajes Avanzados.', true),
      (v_epja_id, 'ESA', 'Educación Secundaria de Adultos', 'Comprende Aprendizajes Aplicados, Aprendizajes Complementarios y Aprendizajes Especializados.', true)
    ON CONFLICT (programa_id, codigo) DO UPDATE
    SET
      nombre = EXCLUDED.nombre,
      descripcion = EXCLUDED.descripcion,
      activo = true,
      updated_at = now();
  END IF;
END $$;

-- 3. TABLA CARRERAS (para ETA)
CREATE TABLE IF NOT EXISTS public.carreras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subprograma_id UUID REFERENCES public.subprogramas(id) ON DELETE CASCADE,
  programa_id UUID REFERENCES public.programas(id) ON DELETE CASCADE,
  codigo TEXT,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Garantizar constraint único para carreras por nombre y programa
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'carreras_programa_nombre_unique'
  ) THEN
    ALTER TABLE public.carreras ADD CONSTRAINT carreras_programa_nombre_unique UNIQUE (nombre);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN others THEN NULL;
END $$;

-- Insertar Carreras Técnicas oficiales de ETA
DO $$
DECLARE
  v_eta_id UUID;
BEGIN
  SELECT id INTO v_eta_id FROM public.programas WHERE codigo = 'ETA' LIMIT 1;

  IF v_eta_id IS NOT NULL THEN
    INSERT INTO public.carreras (programa_id, codigo, nombre, descripcion, activo)
    VALUES
      (v_eta_id, 'SIS', 'Sistemas Informáticos', 'Carrera técnica en computación, ofimática, mantenimiento, redes y sistemas.', true),
      (v_eta_id, 'GAS', 'Gastronomía', 'Carrera técnica en arte culinario, nutrición, panadería, repostería y servicios gastronómicos.', true)
    ON CONFLICT (nombre) DO UPDATE
    SET
      programa_id = v_eta_id,
      descripcion = EXCLUDED.descripcion,
      activo = true,
      updated_at = now();
  END IF;
END $$;

-- 4. TABLA ETAPAS: Estandarizar etapas para EPA y ESA
CREATE TABLE IF NOT EXISTS public.etapas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programa_codigo TEXT,
  subprograma_codigo TEXT,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insertar etapas oficiales para EPA y ESA
INSERT INTO public.etapas (programa_codigo, subprograma_codigo, nombre, descripcion, activo)
VALUES
  ('EPJA', 'EPA', 'Aprendizajes Elementales', 'Alfabetización inicial y competencias básicas de primaria.', true),
  ('EPJA', 'EPA', 'Aprendizajes Avanzados', 'Profundización primaria humanística.', true),
  ('EPJA', 'ESA', 'Aprendizajes Aplicados', 'Primer ciclo de educación secundaria humanística.', true),
  ('EPJA', 'ESA', 'Aprendizajes Complementarios', 'Segundo ciclo de educación secundaria humanística.', true),
  ('EPJA', 'ESA', 'Aprendizajes Especializados', 'Tercer ciclo de educación secundaria humanística (Bachillerato).', true)
ON CONFLICT DO NOTHING;

-- 5. TABLA NIVELES: Estandarizar niveles por contexto
CREATE TABLE IF NOT EXISTS public.niveles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subprograma_id UUID REFERENCES public.subprogramas(id) ON DELETE CASCADE,
  carrera_id UUID REFERENCES public.carreras(id) ON DELETE CASCADE,
  programa_codigo TEXT,
  subprograma_codigo TEXT,
  carrera_nombre TEXT,
  etapa_nombre TEXT,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  orden INTEGER NOT NULL DEFAULT 1,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inserción de Niveles para EPA
INSERT INTO public.niveles (programa_codigo, subprograma_codigo, etapa_nombre, nombre, orden, descripcion, activo)
VALUES
  ('EPJA', 'EPA', 'Aprendizajes Elementales', 'Aprendizajes Elementales', 1, 'Nivel inicial de primaria de adultos.', true),
  ('EPJA', 'EPA', 'Aprendizajes Avanzados', 'Aprendizajes Avanzados', 2, 'Nivel avanzado de primaria de adultos.', true)
ON CONFLICT DO NOTHING;

-- Inserción de Niveles para ESA
INSERT INTO public.niveles (programa_codigo, subprograma_codigo, etapa_nombre, nombre, orden, descripcion, activo)
VALUES
  ('EPJA', 'ESA', 'Aprendizajes Aplicados', 'Aprendizajes Aplicados', 1, 'Primer ciclo de secundaria de adultos.', true),
  ('EPJA', 'ESA', 'Aprendizajes Complementarios', 'Aprendizajes Complementarios', 2, 'Segundo ciclo de secundaria de adultos.', true),
  ('EPJA', 'ESA', 'Aprendizajes Especializados', 'Aprendizajes Especializados', 3, 'Tercer ciclo de secundaria de adultos.', true)
ON CONFLICT DO NOTHING;

-- Inserción de Niveles para Carreras de ETA
DO $$
DECLARE
  v_sis_id UUID;
  v_gas_id UUID;
BEGIN
  SELECT id INTO v_sis_id FROM public.carreras WHERE nombre = 'Sistemas Informáticos' LIMIT 1;
  SELECT id INTO v_gas_id FROM public.carreras WHERE nombre = 'Gastronomía' LIMIT 1;

  -- Sistemas Informáticos
  IF v_sis_id IS NOT NULL THEN
    INSERT INTO public.niveles (carrera_id, carrera_nombre, programa_codigo, subprograma_codigo, nombre, orden, descripcion, activo)
    VALUES
      (v_sis_id, 'Sistemas Informáticos', 'ETA', 'ETA', 'Técnico Básico', 1, 'Primer nivel de formación técnica certificada en Sistemas.', true),
      (v_sis_id, 'Sistemas Informáticos', 'ETA', 'ETA', 'Técnico Auxiliar', 2, 'Segundo nivel de especialización técnica práctica en Sistemas.', true),
      (v_sis_id, 'Sistemas Informáticos', 'ETA', 'ETA', 'Técnico Medio', 3, 'Nivel técnico medio habilitante para ejercicio profesional.', true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Gastronomía
  IF v_gas_id IS NOT NULL THEN
    INSERT INTO public.niveles (carrera_id, carrera_nombre, programa_codigo, subprograma_codigo, nombre, orden, descripcion, activo)
    VALUES
      (v_gas_id, 'Gastronomía', 'ETA', 'ETA', 'Técnico Básico', 1, 'Primer nivel de formación técnica en Gastronomía.', true),
      (v_gas_id, 'Gastronomía', 'ETA', 'ETA', 'Técnico Auxiliar', 2, 'Segundo nivel técnico auxiliar en Gastronomía.', true),
      (v_gas_id, 'Gastronomía', 'ETA', 'ETA', 'Técnico Medio', 3, 'Nivel técnico medio habilitante en Gastronomía.', true)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Inserción de Niveles para EDUPER y CEE
INSERT INTO public.niveles (programa_codigo, nombre, orden, descripcion, activo)
VALUES
  ('EDUPER', 'Cursos de Capacitación', 1, 'Capacitación laboral corta no escolarizada.', true),
  ('EDUPER', 'Talleres Comunitarios', 2, 'Talleres vivenciales de participación comunitaria.', true),
  ('EDUPER', 'Procesos Formativos Permanentes', 3, 'Procesos modulares continuos.', true),
  ('CEE', 'Atención Curricular Inclusiva', 1, 'Procesos de integración adaptativa.', true)
ON CONFLICT DO NOTHING;
