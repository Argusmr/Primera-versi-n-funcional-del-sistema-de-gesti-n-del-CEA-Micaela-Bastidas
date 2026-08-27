-- ============================================================================
-- MIGRACIÓN INSTITUCIONAL CEA: PANEL DE INCIDENCIAS DE ASISTENCIA DOCENTE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.incidencias_asistencia_docente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  docente_id UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  tipo_incidencia TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'justificado', 'falta_confirmada', 'corregido')),
  detalle TEXT,
  resolucion TEXT,
  resuelto_por UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
  fecha_resolucion TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de consulta y rendimiento
CREATE INDEX IF NOT EXISTS idx_incidencias_docente ON public.incidencias_asistencia_docente(docente_id);
CREATE INDEX IF NOT EXISTS idx_incidencias_fecha ON public.incidencias_asistencia_docente(fecha);
CREATE INDEX IF NOT EXISTS idx_incidencias_estado ON public.incidencias_asistencia_docente(estado);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.incidencias_asistencia_docente ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
-- 1. Lectura para usuarios autenticados
CREATE POLICY "Permitir lectura de incidencias a usuarios autorizados"
  ON public.incidencias_asistencia_docente
  FOR SELECT
  TO authenticated
  USING (
    docente_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol IN ('superadmin', 'director', 'coordinador')
    )
  );

-- 2. Inserción para superadmins y sistema
CREATE POLICY "Permitir insercion de incidencias"
  ON public.incidencias_asistencia_docente
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 3. Actualización de resolución solo para Directores / Superadmins
CREATE POLICY "Permitir resolucion de incidencias a Direccion"
  ON public.incidencias_asistencia_docente
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol IN ('superadmin', 'director', 'coordinador')
    )
  );
