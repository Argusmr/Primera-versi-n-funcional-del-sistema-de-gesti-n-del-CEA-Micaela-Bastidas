-- ============================================================
-- CEA MICAELA BASTIDAS
-- MIGRACIÓN DE PERSISTENCIA ADMINISTRATIVA
-- ============================================================
-- No elimina datos existentes.
-- No modifica las migraciones anteriores.
--
-- Jerarquía académica:
-- programas -> subprogramas -> carreras (cuando corresponda) -> niveles
-- ============================================================


-- ============================================================
-- 1. DATOS INSTITUCIONALES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.datos_institucionales (
  id TEXT PRIMARY KEY DEFAULT 'main',
  nombre_completo TEXT,
  nombre_corto TEXT,
  nombre_director TEXT,
  cargo_director TEXT,
  direccion TEXT,
  telefono TEXT,
  lema_subtitulo TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Solo se cargan los dos datos institucionales ya conocidos.
-- No se inventa director, teléfono, cargo, dirección ni lema.

INSERT INTO public.datos_institucionales (
  id,
  nombre_completo,
  nombre_corto
)
VALUES (
  'main',
  'Centro de Educación Alternativa Micaela Bastidas',
  'CEA Micaela Bastidas'
)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 2. SUBPROGRAMAS
-- Ejemplos futuros: EPA, ESA, ETA
-- Relacionados mediante UUID con public.programas.
-- NO se insertan datos en esta migración.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.subprogramas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programa_id UUID NOT NULL
    REFERENCES public.programas(id)
    ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT subprogramas_programa_codigo_unique
    UNIQUE (programa_id, codigo)
);


-- ============================================================
-- 3. CARRERAS
-- Aplica cuando un subprograma necesite carreras, por ejemplo ETA.
-- NO se insertan carreras en esta migración.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.carreras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subprograma_id UUID NOT NULL
    REFERENCES public.subprogramas(id)
    ON DELETE CASCADE,
  codigo TEXT,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT carreras_subprograma_nombre_unique
    UNIQUE (subprograma_id, nombre)
);


-- ============================================================
-- 4. NIVELES
--
-- EPA / ESA:
--   subprograma_id = requerido
--   carrera_id = NULL
--
-- ETA:
--   subprograma_id = requerido
--   carrera_id = carrera correspondiente
--
-- NO se insertan niveles en esta migración.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.niveles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  subprograma_id UUID NOT NULL
    REFERENCES public.subprogramas(id)
    ON DELETE CASCADE,

  carrera_id UUID
    REFERENCES public.carreras(id)
    ON DELETE CASCADE,

  nombre TEXT NOT NULL,
  descripcion TEXT,
  orden INTEGER NOT NULL DEFAULT 1,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT niveles_contexto_nombre_unique
    UNIQUE (subprograma_id, carrera_id, nombre)
);


-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.datos_institucionales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subprogramas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carreras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.niveles ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 6. POLÍTICAS RLS
-- Lectura: usuarios autenticados.
-- Escritura: exclusivamente superadmin.
-- Se usa public.es_superadmin() ya existente.
-- ============================================================

DO $$
BEGIN

  -- ----------------------------------------------------------
  -- DATOS INSTITUCIONALES
  -- ----------------------------------------------------------

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'datos_institucionales'
      AND policyname = 'Lectura autenticada datos institucionales'
  ) THEN
    CREATE POLICY "Lectura autenticada datos institucionales"
    ON public.datos_institucionales
    FOR SELECT
    USING (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'datos_institucionales'
      AND policyname = 'Superadmin administra datos institucionales'
  ) THEN
    CREATE POLICY "Superadmin administra datos institucionales"
    ON public.datos_institucionales
    FOR ALL
    USING (public.es_superadmin())
    WITH CHECK (public.es_superadmin());
  END IF;


  -- ----------------------------------------------------------
  -- SUBPROGRAMAS
  -- ----------------------------------------------------------

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subprogramas'
      AND policyname = 'Lectura autenticada subprogramas'
  ) THEN
    CREATE POLICY "Lectura autenticada subprogramas"
    ON public.subprogramas
    FOR SELECT
    USING (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subprogramas'
      AND policyname = 'Superadmin administra subprogramas'
  ) THEN
    CREATE POLICY "Superadmin administra subprogramas"
    ON public.subprogramas
    FOR ALL
    USING (public.es_superadmin())
    WITH CHECK (public.es_superadmin());
  END IF;


  -- ----------------------------------------------------------
  -- CARRERAS
  -- ----------------------------------------------------------

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'carreras'
      AND policyname = 'Lectura autenticada carreras'
  ) THEN
    CREATE POLICY "Lectura autenticada carreras"
    ON public.carreras
    FOR SELECT
    USING (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'carreras'
      AND policyname = 'Superadmin administra carreras'
  ) THEN
    CREATE POLICY "Superadmin administra carreras"
    ON public.carreras
    FOR ALL
    USING (public.es_superadmin())
    WITH CHECK (public.es_superadmin());
  END IF;


  -- ----------------------------------------------------------
  -- NIVELES
  -- ----------------------------------------------------------

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'niveles'
      AND policyname = 'Lectura autenticada niveles'
  ) THEN
    CREATE POLICY "Lectura autenticada niveles"
    ON public.niveles
    FOR SELECT
    USING (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'niveles'
      AND policyname = 'Superadmin administra niveles'
  ) THEN
    CREATE POLICY "Superadmin administra niveles"
    ON public.niveles
    FOR ALL
    USING (public.es_superadmin())
    WITH CHECK (public.es_superadmin());
  END IF;


  -- ----------------------------------------------------------
  -- PROGRAMAS EXISTENTES
  -- ----------------------------------------------------------

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'programas'
      AND policyname = 'Superadmin administra programas'
  ) THEN
    CREATE POLICY "Superadmin administra programas"
    ON public.programas
    FOR ALL
    USING (public.es_superadmin())
    WITH CHECK (public.es_superadmin());
  END IF;


  -- ----------------------------------------------------------
  -- SEDES EXISTENTES
  -- ----------------------------------------------------------

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sedes'
      AND policyname = 'Superadmin administra sedes'
  ) THEN
    CREATE POLICY "Superadmin administra sedes"
    ON public.sedes
    FOR ALL
    USING (public.es_superadmin())
    WITH CHECK (public.es_superadmin());
  END IF;


  -- ----------------------------------------------------------
  -- HORARIOS EXISTENTES
  -- ----------------------------------------------------------

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'horarios'
      AND policyname = 'Superadmin administra horarios'
  ) THEN
    CREATE POLICY "Superadmin administra horarios"
    ON public.horarios
    FOR ALL
    USING (public.es_superadmin())
    WITH CHECK (public.es_superadmin());
  END IF;

END
$$;
