-- ============================================================
-- MIGRACIÓN: AUDITORÍA INSTITUCIONAL Y COBERTURA DE ASISTENCIA
-- ============================================================

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

ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

-- Politica: Lectura autorizada de auditoria (Superadmin, Director, Coordinador)
CREATE POLICY "Superadmin y director consultan auditoria" ON public.auditoria
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol IN ('superadmin', 'director', 'coordinador')
    )
  );

-- Politica: Inserción autorizada de auditoria
CREATE POLICY "Usuarios autenticados insertan auditoria" ON public.auditoria
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
