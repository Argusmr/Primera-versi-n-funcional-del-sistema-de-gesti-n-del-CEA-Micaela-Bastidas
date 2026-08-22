-- ============================================================
-- CEA MICAELA BASTIDAS
-- MIGRACIÓN: CONFIGURACIÓN CALENDARIO LABORAL (DÍAS EFECTIVOS)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.configuracion_calendario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes TEXT NOT NULL UNIQUE, -- Formato 'YYYY-MM'
  dias_trabajados INTEGER NOT NULL CHECK (dias_trabajados >= 0 AND dias_trabajados <= 31),
  observacion TEXT,
  creado_por UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.configuracion_calendario ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad RLS
-- 1. Usuarios autenticados pueden consultar
DROP POLICY IF EXISTS "Todos pueden consultar configuracion_calendario" ON public.configuracion_calendario;
CREATE POLICY "Todos pueden consultar configuracion_calendario"
  ON public.configuracion_calendario
  FOR SELECT
  TO authenticated
  USING (true);

-- 2. Solo superadmin / director pueden insertar
DROP POLICY IF EXISTS "Solo superadmin o director puede insertar configuracion_calendario" ON public.configuracion_calendario;
CREATE POLICY "Solo superadmin o director puede insertar configuracion_calendario"
  ON public.configuracion_calendario
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol IN ('superadmin', 'director')
    )
  );

-- 3. Solo superadmin / director pueden actualizar
DROP POLICY IF EXISTS "Solo superadmin o director puede actualizar configuracion_calendario" ON public.configuracion_calendario;
CREATE POLICY "Solo superadmin o director puede actualizar configuracion_calendario"
  ON public.configuracion_calendario
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol IN ('superadmin', 'director')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol IN ('superadmin', 'director')
    )
  );

-- 4. Solo superadmin / director pueden eliminar
DROP POLICY IF EXISTS "Solo superadmin o director puede eliminar configuracion_calendario" ON public.configuracion_calendario;
CREATE POLICY "Solo superadmin o director puede eliminar configuracion_calendario"
  ON public.configuracion_calendario
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol IN ('superadmin', 'director')
    )
  );
