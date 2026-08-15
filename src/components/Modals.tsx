import React, { useState, useEffect } from 'react';
import { X, UserCheck, Users, Upload, FilePlus, CheckCircle2, AlertCircle } from 'lucide-react';
import { Perfil, Sede, Horario, Programa, CategoriaPublicacion, Grupo } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// 1. ADD TEACHER MODAL
interface AddTeacherModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const AddTeacherModal: React.FC<AddTeacherModalProps> = ({ onClose, onSuccess }) => {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ci, setCi] = useState('');
  const [rda, setRda] = useState('');
  const [especialidad, setEspecialidad] = useState('Humanidades & EPJA');
  const [sedeId, setSedeId] = useState<string>('');
  const [horarioId, setHorarioId] = useState<string>('');
  const [sedesList, setSedesList] = useState<Sede[]>([]);
  const [horariosList, setHorariosList] = useState<Horario[]>([]);
  const [loadingCatalogos, setLoadingCatalogos] = useState<boolean>(true);
  const [puedePublicar, setPuedePublicar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadSedesAndHorarios() {
      if (!isSupabaseConfigured || !supabase) {
        setErrMsg('Supabase no está configurado. No se pueden cargar sedes ni horarios.');
        setLoadingCatalogos(false);
        return;
      }

      setLoadingCatalogos(true);
      try {
        const [sedesRes, horariosRes] = await Promise.all([
          supabase.from('sedes').select('*').order('nombre'),
          supabase.from('horarios').select('*').order('nombre')
        ]);

        if (sedesRes.error) {
          throw new Error('Error al cargar sedes desde Supabase: ' + sedesRes.error.message);
        }
        if (horariosRes.error) {
          throw new Error('Error al cargar horarios desde Supabase: ' + horariosRes.error.message);
        }

        const sData = (sedesRes.data || []) as Sede[];
        const hData = (horariosRes.data || []) as Horario[];

        if (sData.length === 0) {
          throw new Error('No se encontraron sedes configuradas en la base de datos.');
        }
        if (hData.length === 0) {
          throw new Error('No se encontraron horarios configurados en la base de datos.');
        }

        setSedesList(sData);
        setSedeId(sData[0].id);

        setHorariosList(hData);
        setHorarioId(hData[0].id);
      } catch (e: any) {
        console.error('Error al cargar sedes/horarios desde Supabase:', e);
        setErrMsg(e.message || 'Error al conectar con Supabase para cargar sedes y horarios.');
      } finally {
        setLoadingCatalogos(false);
      }
    }

    loadSedesAndHorarios();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    setErrMsg(null);

    if (!email.trim() || !password.trim() || !nombre.trim() || !rda.trim()) {
      setErrMsg('Email, contraseña, nombre completo y N° RDA son obligatorios.');
      setLoading(false);
      return;
    }

    if (!sedeId || !horarioId) {
      setErrMsg('Debe seleccionar una sede y un horario válidos de la base de datos.');
      setLoading(false);
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setErrMsg('Supabase no está configurado. No se puede crear docentes en el sistema.');
      setLoading(false);
      return;
    }

    try {
      // 1. Validate active session and access token
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const session = sessionData?.session;

      if (sessionError || !session || !session.access_token) {
        setErrMsg('Sesión expirada. Vuelva a iniciar sesión.');
        setLoading(false);
        return;
      }

      // 2. Invoke edge function with explicit Authorization header containing user JWT
      const { data, error } = await supabase.functions.invoke('invitar-docente', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          email: email.trim(),
          password: password.trim(),
          nombre_completo: nombre.trim(),
          ci: ci.trim(),
          ci_exp: ci.trim(),
          rda: rda.trim(),
          especialidad: especialidad.trim(),
          sede_id: sedeId || null,
          horario_id: horarioId || null,
          puede_publicar: puedePublicar
        }
      });

      if (error) {
        let responseError = error.message;
        if (error.context && typeof error.context.json === 'function') {
          try {
            const errJson = await error.context.json();
            if (errJson?.error) responseError = errJson.error;
          } catch (_) {}
        }
        setErrMsg('Error en el servidor Supabase: ' + responseError);
        setLoading(false);
        return;
      }

      if (data?.error) {
        setErrMsg('Error al registrar docente: ' + data.error);
        setLoading(false);
        return;
      }

      setMsg('Docente registrado e incorporado correctamente en Supabase Auth y perfiles.');
      setLoading(false);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);

    } catch (err: any) {
      setErrMsg('Excepción al comunicarse con Supabase: ' + (err.message || err));
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl my-auto text-left">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-extrabold text-[#17324D] text-lg flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-[#00A651]" />
            Añadir Nuevo Docente
          </h3>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {msg && (
          <div className="p-3 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-[#00A651] shrink-0" />
            <span>{msg}</span>
          </div>
        )}

        {errMsg && (
          <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label htmlFor="input-teacher-nombre" className="block font-bold text-slate-700 mb-1">Nombre Completo *</label>
            <input
              id="input-teacher-nombre"
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej. Prof. Carlos Fernando Gutierrez"
              className="w-full h-11 px-3 border border-slate-300 rounded-xl font-medium outline-none focus:border-[#00A651]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="input-teacher-email" className="block font-bold text-slate-700 mb-1">Correo de Acceso *</label>
              <input
                id="input-teacher-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="docente@ceamicaela.edu.bo"
                className="w-full h-11 px-3 border border-slate-300 rounded-xl font-medium outline-none focus:border-[#00A651]"
                required
              />
            </div>
            <div>
              <label htmlFor="input-teacher-password" className="block font-bold text-slate-700 mb-1">Contraseña Inicial *</label>
              <input
                id="input-teacher-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 6 caract."
                className="w-full h-11 px-3 border border-slate-300 rounded-xl font-medium outline-none focus:border-[#00A651]"
                minLength={6}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="input-teacher-ci" className="block font-bold text-slate-700 mb-1">Carnet de Identidad</label>
              <input
                id="input-teacher-ci"
                type="text"
                value={ci}
                onChange={e => setCi(e.target.value)}
                placeholder="102938 Sucre"
                className="w-full h-11 px-3 border border-slate-300 rounded-xl font-medium"
              />
            </div>
            <div>
              <label htmlFor="input-teacher-rda" className="block font-bold text-slate-700 mb-1">N° RDA *</label>
              <input
                id="input-teacher-rda"
                type="text"
                value={rda}
                onChange={e => setRda(e.target.value)}
                placeholder="203948"
                className="w-full h-11 px-3 border border-slate-300 rounded-xl font-medium"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="input-teacher-esp" className="block font-bold text-slate-700 mb-1">Especialidad / Nivel</label>
            <input
              id="input-teacher-esp"
              type="text"
              value={especialidad}
              onChange={e => setEspecialidad(e.target.value)}
              className="w-full h-11 px-3 border border-slate-300 rounded-xl font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="input-teacher-sede" className="block font-bold text-slate-700 mb-1">Sede Asignada *</label>
              <select
                id="input-teacher-sede"
                value={sedeId}
                onChange={e => setSedeId(e.target.value)}
                disabled={loadingCatalogos || sedesList.length === 0}
                className="w-full h-11 px-3 border border-slate-300 rounded-xl font-bold bg-slate-50 disabled:opacity-60"
                required
              >
                {sedesList.length === 0 ? (
                  <option value="">{loadingCatalogos ? 'Cargando sedes...' : 'Sin sedes disponibles'}</option>
                ) : (
                  sedesList.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label htmlFor="input-teacher-horario" className="block font-bold text-slate-700 mb-1">Horario Asignado *</label>
              <select
                id="input-teacher-horario"
                value={horarioId}
                onChange={e => setHorarioId(e.target.value)}
                disabled={loadingCatalogos || horariosList.length === 0}
                className="w-full h-11 px-3 border border-slate-300 rounded-xl font-bold bg-slate-50 disabled:opacity-60"
                required
              >
                {horariosList.length === 0 ? (
                  <option value="">{loadingCatalogos ? 'Cargando horarios...' : 'Sin horarios disponibles'}</option>
                ) : (
                  horariosList.map(h => (
                    <option key={h.id} value={h.id}>{h.nombre}</option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 bg-emerald-50 p-3 rounded-xl border border-emerald-200">
            <input
              type="checkbox"
              id="chk-publicar"
              checked={puedePublicar}
              onChange={e => setPuedePublicar(e.target.checked)}
              className="w-4 h-4 text-[#00A651] rounded"
            />
            <label htmlFor="chk-publicar" className="font-bold text-emerald-950 cursor-pointer">
              Autorizar permiso para publicar anuncios y documentos
            </label>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 border border-slate-300 rounded-xl font-bold text-slate-600"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || loadingCatalogos || !sedeId || !horarioId || sedesList.length === 0 || horariosList.length === 0}
              className="flex-1 h-12 bg-[#00A651] text-white rounded-xl font-bold hover:bg-[#008d44] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creando...' : 'Crear Docente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 2. ADD STUDENT MODAL
export const AddStudentModal: React.FC<{ onClose: () => void; onSuccess: () => void }> = ({
  onClose,
  onSuccess
}) => {
  const [nombre, setNombre] = useState('');
  const [documento, setDocumento] = useState('');
  const [grupoId, setGrupoId] = useState('');
  const [gruposList, setGruposList] = useState<Grupo[]>([]);
  const [loadingCatalogos, setLoadingCatalogos] = useState<boolean>(true);
  const [isCsvImport, setIsCsvImport] = useState(false);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadAcademicGroups() {
      if (!isSupabaseConfigured || !supabase) {
        setErrMsg('Supabase no está configurado. No se pueden cargar los grupos ni la estructura académica.');
        setLoadingCatalogos(false);
        return;
      }

      setLoadingCatalogos(true);
      setErrMsg(null);
      try {
        // Consultar tablas académicas de Supabase
        const [progRes, subprogRes, carrRes, nivRes, grupRes] = await Promise.all([
          supabase.from('programas').select('*').order('codigo'),
          supabase.from('subprogramas').select('*').order('codigo'),
          supabase.from('carreras').select('*').order('nombre'),
          supabase.from('niveles').select('*').order('orden'),
          supabase.from('grupos').select('*, sedes(nombre), programas(codigo, nombre)').order('nombre')
        ]);

        const programasData = (progRes.data || []) as Programa[];
        const subprogramasData = subprogRes.data || [];
        const carrerasData = carrRes.data || [];
        const nivelesData = nivRes.data || [];
        const gruposData = grupRes.data || [];

        // Validar si existen datos en las tablas académicas
        const missingParts: string[] = [];
        if (programasData.length === 0) missingParts.push('Programas (EPJA, EDUPER, CEE)');
        if (subprogramasData.length === 0) missingParts.push('Subprogramas (EPA, ESA, ETA)');
        if (carrerasData.length === 0) missingParts.push('Carreras (Sistemas Informáticos, Gastronomía, etc.)');
        if (nivelesData.length === 0) missingParts.push('Niveles académicos');
        if (gruposData.length === 0) missingParts.push('Grupos académicos');

        if (gruposData.length === 0) {
          const detalleFaltante = missingParts.length > 0
            ? `Faltan registros en la base de datos de Supabase: ${missingParts.join(', ')}.`
            : 'No se encontraron grupos activos configurados en Supabase.';
          setErrMsg(`Sin grupos disponibles. ${detalleFaltante}`);
          setGruposList([]);
          setGrupoId('');
        } else {
          const mapped: Grupo[] = gruposData.map((g: any) => ({
            id: g.id,
            nombre: g.nombre,
            sede_id: g.sede_id,
            programa_id: g.programa_id,
            carrera_especialidad: g.carrera_especialidad,
            nivel: g.nivel,
            activo: g.activo ?? true,
            created_at: g.created_at,
            sede_nombre: g.sedes?.nombre || undefined,
            programa_nombre: g.programas?.nombre || g.programas?.codigo || undefined
          }));

          setGruposList(mapped);
          setGrupoId(mapped[0]?.id || '');
        }
      } catch (e: any) {
        console.error('Error al cargar estructura académica y grupos desde Supabase:', e);
        setErrMsg(e.message || 'Error al conectar con Supabase para cargar los grupos.');
      } finally {
        setLoadingCatalogos(false);
      }
    }

    loadAcademicGroups();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrMsg(null);
    setMsg(null);

    if (!nombre.trim()) {
      setErrMsg('El nombre completo es obligatorio.');
      return;
    }

    if (!grupoId) {
      setErrMsg('Debe seleccionar un grupo asignado válido de la base de datos.');
      return;
    }

    const selectedGroup = gruposList.find(g => g.id === grupoId);
    if (!selectedGroup) {
      setErrMsg('El grupo seleccionado no es válido.');
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setErrMsg('Supabase no está configurado. No se puede registrar al estudiante.');
      return;
    }

    setLoading(true);
    try {
      const codigoInterno = `EST-${Date.now().toString().slice(-6)}`;
      const { error: insertErr } = await supabase
        .from('estudiantes')
        .insert({
          codigo_interno: codigoInterno,
          nombre_completo: nombre.trim(),
          documento: documento.trim() || null,
          programa_id: selectedGroup.programa_id,
          sede_id: selectedGroup.sede_id,
          carrera_especialidad: selectedGroup.carrera_especialidad || 'General',
          nivel: selectedGroup.nivel || 'General',
          grupo_id: selectedGroup.id,
          estado: 'activo'
        });

      if (insertErr) {
        throw new Error('Error al registrar estudiante en Supabase: ' + insertErr.message);
      }

      setMsg('Estudiante registrado exitosamente.');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('Error en creación de estudiante:', err);
      setErrMsg(err.message || 'Error al registrar al estudiante.');
    } finally {
      setLoading(false);
    }
  };

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCsvFileName(e.target.files[0].name);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl text-left my-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-extrabold text-[#17324D] text-lg flex items-center gap-2">
            <Users className="w-6 h-6 text-[#11B8AE]" />
            Añadir Estudiante
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Feedback alerts */}
        {msg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{msg}</span>
          </div>
        )}
        {errMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span>{errMsg}</span>
          </div>
        )}

        {/* Tab switcher: Individual vs CSV */}
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setIsCsvImport(false)}
            className={`flex-1 py-2 rounded-lg ${!isCsvImport ? 'bg-[#00A651] text-white' : 'text-slate-600'}`}
          >
            Registro Individual
          </button>
          <button
            type="button"
            onClick={() => setIsCsvImport(true)}
            className={`flex-1 py-2 rounded-lg ${isCsvImport ? 'bg-[#00A651] text-white' : 'text-slate-600'}`}
          >
            Importar Nómina (CSV)
          </button>
        </div>

        {!isCsvImport ? (
          <form onSubmit={handleSave} className="space-y-3 text-xs">
            <div>
              <label htmlFor="input-student-nombre" className="block font-bold text-slate-700 mb-1">Nombre Completo *</label>
              <input
                id="input-student-nombre"
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej. Carmen Inés Mamani Choque"
                className="w-full h-11 px-3 border border-slate-300 rounded-xl font-medium"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label htmlFor="input-student-documento" className="block font-bold text-slate-700 mb-1">CI / Documento</label>
                <input
                  id="input-student-documento"
                  type="text"
                  value={documento}
                  onChange={e => setDocumento(e.target.value)}
                  placeholder="10293847"
                  className="w-full h-11 px-3 border border-slate-300 rounded-xl font-medium"
                />
              </div>
              <div>
                <label htmlFor="select-student-grupo" className="block font-bold text-slate-700 mb-1">Grupo Asignado *</label>
                <select
                  id="select-student-grupo"
                  value={grupoId}
                  onChange={e => setGrupoId(e.target.value)}
                  disabled={loadingCatalogos || gruposList.length === 0}
                  className="w-full h-11 px-3 border border-slate-300 rounded-xl font-bold bg-slate-50 disabled:opacity-60"
                  required
                >
                  {gruposList.length === 0 ? (
                    <option value="">{loadingCatalogos ? 'Cargando grupos...' : 'Sin grupos disponibles'}</option>
                  ) : (
                    gruposList.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.nombre} {g.sede_nombre ? `(${g.sede_nombre})` : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 h-12 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || loadingCatalogos || !grupoId || gruposList.length === 0}
                className="flex-1 h-12 bg-[#00A651] text-white rounded-xl font-bold hover:bg-[#008d44] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Guardando...' : 'Guardar Estudiante'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSave} className="space-y-4 text-xs">
            <div className="p-6 border-2 border-dashed border-emerald-300 rounded-2xl bg-emerald-50 text-center space-y-2">
              <Upload className="w-8 h-8 text-[#00A651] mx-auto" />
              <p className="font-bold text-slate-800">Seleccionar archivo de nómina CSV</p>
              <p className="text-[11px] text-slate-500">Columnas: nombre_completo, ci, programa, grupo</p>
              <input type="file" accept=".csv" onChange={handleCsvFile} className="hidden" id="file-csv-input" />
              <label htmlFor="file-csv-input" className="inline-block px-4 py-2 bg-[#00A651] text-white font-bold rounded-xl cursor-pointer">
                {csvFileName ? `Archivo: ${csvFileName}` : 'Examinar CSV'}
              </label>
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="flex-1 h-12 border border-slate-300 rounded-xl font-bold text-slate-600">
                Cancelar
              </button>
              <button type="submit" disabled={!csvFileName || loading} className="flex-1 h-12 bg-[#00A651] text-white rounded-xl font-bold disabled:opacity-50">
                Importar Estudiantes
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// 3. PUBLISH DOCUMENT MODAL
export const PublishModal: React.FC<{ onClose: () => void; onSuccess: () => void }> = ({
  onClose,
  onSuccess
}) => {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState<CategoriaPublicacion>('anuncios');
  const [destacado, setDestacado] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl text-left my-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-extrabold text-[#17324D] text-lg flex items-center gap-2">
            <FilePlus className="w-6 h-6 text-[#00A651]" />
            Publicar Aviso o Documento
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handlePublish} className="space-y-3 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Título de la Publicación *</label>
            <input
              type="text"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ej. Instructivo de Evaluaciones Semestrales 2026"
              className="w-full h-11 px-3 border border-slate-300 rounded-xl font-medium"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Categoría</label>
            <select
              value={categoria}
              onChange={e => setCategoria(e.target.value as CategoriaPublicacion)}
              className="w-full h-11 px-3 border border-slate-300 rounded-xl font-bold bg-slate-50"
            >
              <option value="anuncios">Anuncios</option>
              <option value="comunicados">Comunicados</option>
              <option value="instructivos">Instructivos</option>
              <option value="normativa">Normativa</option>
              <option value="rm_001_2026">RM 001/2026</option>
              <option value="poa">POA 2026</option>
              <option value="calendario">Calendario</option>
              <option value="formularios">Formularios</option>
              <option value="otros">Otros</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Descripción / Resumen *</label>
            <textarea
              rows={3}
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder="Escriba la información o el detalle del comunicado..."
              className="w-full p-3 border border-slate-300 rounded-xl font-medium outline-none"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Adjuntar Archivo (PDF, Imagen, Word, Excel)</label>
            <input
              type="file"
              onChange={e => e.target.files?.[0] && setFileName(e.target.files[0].name)}
              className="w-full text-xs font-medium text-slate-500 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:bg-emerald-50 file:text-[#00A651] file:font-bold"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="chk-destacado"
              checked={destacado}
              onChange={e => setDestacado(e.target.checked)}
              className="w-4 h-4 text-[#00A651] rounded"
            />
            <label htmlFor="chk-destacado" className="font-bold text-slate-800 cursor-pointer">
              Marcar como anuncio destacado
            </label>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 h-12 border border-slate-300 rounded-xl font-bold text-slate-600">
              Cancelar
            </button>
            <button type="submit" className="flex-1 h-12 bg-[#00A651] text-white rounded-xl font-bold">
              Publicar Ahora
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
