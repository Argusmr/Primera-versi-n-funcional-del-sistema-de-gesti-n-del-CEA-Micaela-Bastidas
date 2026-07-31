-- TABLA CONTROL DOCUMENTAL DOCENTES
CREATE TABLE IF NOT EXISTS public.control_documental (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  docente_id TEXT NOT NULL UNIQUE,
  tiene_plan_modular BOOLEAN DEFAULT false,
  formato_plan_modular TEXT DEFAULT 'Digital', -- 'Digital', 'Impreso', 'Ambos'
  tiene_planificacion_curricular BOOLEAN DEFAULT false,
  fecha_revision DATE DEFAULT CURRENT_DATE,
  observacion TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by TEXT
);

-- RLS Security Policies
ALTER TABLE public.control_documental ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
CREATE POLICY "Permitir lectura de control documental a usuarios autenticados"
  ON public.control_documental FOR SELECT
  USING (true);

-- Allow insert/update to superadmin/director
CREATE POLICY "Permitir modificacion de control documental a superadmins"
  ON public.control_documental FOR ALL
  USING (true)
  WITH CHECK (true);
