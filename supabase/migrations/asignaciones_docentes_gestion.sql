-- ====================================================================
-- MIGRACIÓN DE GESTIÓN Y HISTORIAL DE ASIGNACIONES DOCENTES
-- Centro de Educación Alternativa - Normativa Oficial EPJA / ETA
-- ====================================================================

-- 1. Asegurar la tabla base public.asignaciones_docentes
CREATE TABLE IF NOT EXISTS public.asignaciones_docentes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    docente_id UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
    grupo_id UUID REFERENCES public.grupos(id) ON DELETE SET NULL,
    materia TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Añadir columnas curriculares, estado e historial (Non-destructive: IF NOT EXISTS)
ALTER TABLE public.asignaciones_docentes
ADD COLUMN IF NOT EXISTS programa_id UUID REFERENCES public.programas(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS programa_codigo TEXT DEFAULT 'ETA',
ADD COLUMN IF NOT EXISTS subprograma_id UUID REFERENCES public.subprogramas(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS subprograma_codigo TEXT,
ADD COLUMN IF NOT EXISTS carrera_id UUID REFERENCES public.carreras(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS carrera_nombre TEXT,
ADD COLUMN IF NOT EXISTS etapa_id UUID REFERENCES public.etapas(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS etapa_nombre TEXT,
ADD COLUMN IF NOT EXISTS nivel_id UUID REFERENCES public.niveles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS nivel_nombre TEXT,
ADD COLUMN IF NOT EXISTS sede_id UUID REFERENCES public.sedes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS sede_nombre TEXT,
ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true NOT NULL,
ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'activo' NOT NULL CHECK (estado IN ('activo', 'inactivo')),
ADD COLUMN IF NOT EXISTS fecha_inicio DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS fecha_fin DATE,
ADD COLUMN IF NOT EXISTS motivo_cambio TEXT,
ADD COLUMN IF NOT EXISTS observacion TEXT,
ADD COLUMN IF NOT EXISTS gestion INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- 3. Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_asig_docente_activo ON public.asignaciones_docentes (docente_id, activo);
CREATE INDEX IF NOT EXISTS idx_asig_grupo_activo ON public.asignaciones_docentes (grupo_id, activo);
CREATE INDEX IF NOT EXISTS idx_asig_programa ON public.asignaciones_docentes (programa_codigo);

-- 4. Habilitar RLS y Políticas de Seguridad
ALTER TABLE public.asignaciones_docentes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Lectura de asignaciones para autenticados" ON public.asignaciones_docentes;
    DROP POLICY IF EXISTS "Gestión total de asignaciones para directores" ON public.asignaciones_docentes;
END $$;

CREATE POLICY "Lectura de asignaciones para autenticados"
ON public.asignaciones_docentes FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Gestión total de asignaciones para directores"
ON public.asignaciones_docentes FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.perfiles
        WHERE id = auth.uid() AND rol IN ('superadmin', 'director', 'admin')
    )
);

COMMENT ON TABLE public.asignaciones_docentes IS 'Registro oficial e histórico de asignaciones académicas docentes según la jerarquía EPJA / ETA.';
