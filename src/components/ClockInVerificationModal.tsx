import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Camera,
  AlertTriangle,
  CheckCircle2,
  X,
  RefreshCw,
  Clock,
  ShieldAlert,
  Info,
  Check
} from 'lucide-react';
import { Perfil, AsistenciaDocente, Sede, EstadoGPS, EstadoExcepcion } from '../types';
import { getCurrentGPSPosition, calculateDistanceMeters, LocationResult } from '../lib/geo';
import { SelfieCameraModal } from './SelfieCameraModal';
import { supabase } from '../lib/supabase';
import { saveOfflineDocenteAsistencia } from '../lib/db';
import { INITIAL_SEDES } from '../lib/mockData';

interface ClockInVerificationModalProps {
  user: Perfil;
  isOnline: boolean;
  onClose: () => void;
  onSuccess: (record: AsistenciaDocente) => void;
}

export const ClockInVerificationModal: React.FC<ClockInVerificationModalProps> = ({
  user,
  isOnline,
  onClose,
  onSuccess,
}) => {
  const [loadingGps, setLoadingGps] = useState(true);
  const [gpsData, setGpsData] = useState<LocationResult | null>(null);
  const [sedeInfo, setSedeInfo] = useState<Sede | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [estadoGps, setEstadoGps] = useState<EstadoGPS>('sin_gps');

  // Camera & Selfie State
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [selfieBlob, setSelfieBlob] = useState<Blob | null>(null);
  const [selfiePreviewUrl, setSelfiePreviewUrl] = useState<string | null>(null);

  // Exception State
  const [observacionExcepcion, setObservacionExcepcion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load Sede Info and Acquire GPS on Mount
  useEffect(() => {
    async function initGpsAndSede() {
      setLoadingGps(true);
      setErrorMessage(null);

      // 1. Fetch Sede info directly from public.sedes in Supabase
      let foundSede: Sede | undefined;
      if (supabase && isOnline) {
        if (user.sede_id) {
          const { data } = await supabase.from('sedes').select('*').eq('id', user.sede_id).maybeSingle();
          if (data) foundSede = data as Sede;
        }

        if (!foundSede && user.sede_nombre) {
          const { data } = await supabase.from('sedes').select('*').ilike('nombre', `%${user.sede_nombre.trim()}%`).limit(1);
          if (data && data.length > 0) foundSede = data[0] as Sede;
        }

        if (!foundSede) {
          const { data } = await supabase.from('sedes').select('*').eq('activo', true).order('nombre').limit(1);
          if (data && data.length > 0) foundSede = data[0] as Sede;
        }
      }

      if (!foundSede) {
        foundSede = INITIAL_SEDES.find((s) => s.id === user.sede_id || s.nombre === user.sede_nombre) || {
          id: user.sede_id || 'sede-1',
          nombre: user.sede_nombre || 'Sede Poroma',
          direccion: 'Centro Poblado de Poroma',
          latitud: -18.539416,
          longitud: -65.426389,
          radio_m: 180,
          activo: true
        };
      }

      // Ensure valid numbers for latitud, longitud, and radio_m
      const lat = foundSede.latitud !== null && foundSede.latitud !== undefined ? Number(foundSede.latitud) : -18.539416;
      const lon = foundSede.longitud !== null && foundSede.longitud !== undefined ? Number(foundSede.longitud) : -65.426389;
      const rad = foundSede.radio_m !== null && foundSede.radio_m !== undefined ? Number(foundSede.radio_m) : 180;

      foundSede = {
        ...foundSede,
        latitud: lat,
        longitud: lon,
        radio_m: rad
      };

      setSedeInfo(foundSede);

      // 2. Obtain Current Geolocation
      const location = await getCurrentGPSPosition();
      setGpsData(location);

      if (location.error || location.latitud === 0) {
        setEstadoGps('sin_gps');
        setDistanceMeters(null);
      } else {
        const dist = calculateDistanceMeters(
          location.latitud,
          location.longitud,
          lat,
          lon
        );
        setDistanceMeters(dist);

        const allowedRadius = rad;
        if (location.precision > 50) {
          setEstadoGps('gps_impreciso');
        } else if (dist <= allowedRadius) {
          setEstadoGps('dentro_rango');
        } else {
          setEstadoGps('fuera_rango');
        }
      }

      setLoadingGps(false);
    }

    initGpsAndSede();
  }, [user.sede_id, user.sede_nombre, isOnline]);

  const handleRefreshGps = async () => {
    setLoadingGps(true);

    // Re-verify Sede coordinates from public.sedes if needed
    let activeSede = sedeInfo;
    if (supabase && isOnline) {
      if (user.sede_id) {
        const { data } = await supabase.from('sedes').select('*').eq('id', user.sede_id).maybeSingle();
        if (data) activeSede = data as Sede;
      }
      if (!activeSede && user.sede_nombre) {
        const { data } = await supabase.from('sedes').select('*').ilike('nombre', `%${user.sede_nombre.trim()}%`).limit(1);
        if (data && data.length > 0) activeSede = data[0] as Sede;
      }
    }

    const lat = activeSede?.latitud !== null && activeSede?.latitud !== undefined ? Number(activeSede.latitud) : -18.539416;
    const lon = activeSede?.longitud !== null && activeSede?.longitud !== undefined ? Number(activeSede.longitud) : -65.426389;
    const rad = activeSede?.radio_m !== null && activeSede?.radio_m !== undefined ? Number(activeSede.radio_m) : 180;

    if (activeSede) {
      activeSede = { ...activeSede, latitud: lat, longitud: lon, radio_m: rad };
      setSedeInfo(activeSede);
    }

    const location = await getCurrentGPSPosition();
    setGpsData(location);

    if (location.error || location.latitud === 0) {
      setEstadoGps('sin_gps');
      setDistanceMeters(null);
    } else {
      const dist = calculateDistanceMeters(
        location.latitud,
        location.longitud,
        lat,
        lon
      );
      setDistanceMeters(dist);

      const allowedRadius = rad;
      if (location.precision > 50) {
        setEstadoGps('gps_impreciso');
      } else if (dist <= allowedRadius) {
        setEstadoGps('dentro_rango');
      } else {
        setEstadoGps('fuera_rango');
      }
    }
    setLoadingGps(false);
  };

  const handleCaptureSelfie = (blob: Blob, previewUrl: string) => {
    setSelfieBlob(blob);
    setSelfiePreviewUrl(previewUrl);
  };

  const needsException = estadoGps !== 'dentro_rango';

  const handleSubmitClockIn = async () => {
    if (!selfieBlob) {
      setErrorMessage('Es obligatorio capturar una selfie antes de continuar.');
      return;
    }

    if (needsException && !observacionExcepcion.trim()) {
      setErrorMessage('Debes ingresar la justificación / observación obligatoria de la excepción.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const todayStr = new Date().toISOString().slice(0, 10);
    const syncKey = `ingreso-${user.id}-${todayStr}-${Date.now()}`;
    const localIso = new Date().toISOString();
    const estadoExcepcion: EstadoExcepcion = needsException ? 'pendiente_revision' : 'ninguna';

    let selfiePath = '';

    try {
      if (isOnline && supabase) {
        // Upload selfie to Supabase Storage
        const fileName = `${user.id}/${Date.now()}.jpg`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('selfies-asistencia')
          .upload(fileName, selfieBlob, { contentType: 'image/jpeg', upsert: true });

        if (!uploadErr && uploadData) {
          selfiePath = uploadData.path;
        }

        // Call RPC function
        const { data: rpcData, error: rpcErr } = await supabase.rpc('registrar_ingreso_gps', {
          p_docente_id: user.id,
          p_sync_key: syncKey,
          p_hora_local: localIso,
          p_es_offline: false,
          p_latitud: gpsData?.latitud || null,
          p_longitud: gpsData?.longitud || null,
          p_precision: gpsData?.precision || null,
          p_distancia: distanceMeters || null,
          p_estado_gps: estadoGps,
          p_selfie_url: selfiePath || null,
          p_observacion_excepcion: needsException ? observacionExcepcion : null,
          p_estado_excepcion: estadoExcepcion,
          p_observacion: needsException ? `Excepción registrada: ${observacionExcepcion}` : 'Ingreso verificado por GPS y Selfie'
        });

        if (rpcErr) {
          // Fallback if RPC name not updated in server
          const fallback = await supabase.rpc('registrar_ingreso', {
            p_docente_id: user.id,
            p_sync_key: syncKey,
            p_hora_local: localIso,
            p_es_offline: false,
            p_observacion: needsException ? `Excepción GPS: ${observacionExcepcion}` : 'Ingreso registrado en línea'
          });

          if (fallback.error) {
            throw new Error(fallback.error.message || rpcErr.message);
          }
        }

        const newRecord: AsistenciaDocente = {
          id: rpcData?.id || syncKey,
          docente_id: user.id,
          docente_nombre: user.nombre_completo,
          sede_nombre: user.sede_nombre,
          fecha_laboral: todayStr,
          hora_ingreso_oficial: localIso,
          hora_ingreso_local: localIso,
          firma_ingreso: true,
          firma_salida: false,
          minutos_atraso: 0,
          minutos_salida_anticipada: 0,
          horas_trabajadas: 0,
          estado: needsException ? 'pendiente_verificacion' : 'puntual',
          origen_registro: 'en_linea',
          sync_key: syncKey,
          latitud_ingreso: gpsData?.latitud,
          longitud_ingreso: gpsData?.longitud,
          precision_gps_ingreso: gpsData?.precision,
          distancia_m_ingreso: distanceMeters || undefined,
          estado_gps_ingreso: estadoGps,
          selfie_url: selfiePreviewUrl || selfiePath,
          observacion_excepcion: observacionExcepcion,
          estado_excepcion: estadoExcepcion
        };

        onSuccess(newRecord);
      } else {
        // OFFLINE MODE: Convert Blob to Base64 for IndexedDB
        const reader = new FileReader();
        reader.readAsDataURL(selfieBlob);
        reader.onloadend = async () => {
          const base64data = reader.result as string;

          await saveOfflineDocenteAsistencia({
            sync_key: syncKey,
            docente_id: user.id,
            tipo: 'ingreso',
            hora_local: localIso,
            latitud: gpsData?.latitud,
            longitud: gpsData?.longitud,
            precision_gps: gpsData?.precision,
            distancia_m: distanceMeters || undefined,
            estado_gps: estadoGps,
            selfie_base64: base64data,
            observacion_excepcion: observacionExcepcion,
            estado_excepcion: estadoExcepcion,
            observacion: 'Registrado sin conexión con GPS y Selfie',
            timestamp: Date.now()
          });

          const offlineRecord: AsistenciaDocente = {
            id: syncKey,
            docente_id: user.id,
            docente_nombre: user.nombre_completo,
            sede_nombre: user.sede_nombre,
            fecha_laboral: todayStr,
            hora_ingreso_oficial: localIso,
            hora_ingreso_local: localIso,
            firma_ingreso: true,
            firma_salida: false,
            minutos_atraso: 0,
            minutos_salida_anticipada: 0,
            horas_trabajadas: 0,
            estado: 'pendiente_verificacion',
            origen_registro: 'sin_conexion',
            sync_key: syncKey,
            latitud_ingreso: gpsData?.latitud,
            longitud_ingreso: gpsData?.longitud,
            precision_gps_ingreso: gpsData?.precision,
            distancia_m_ingreso: distanceMeters || undefined,
            estado_gps_ingreso: estadoGps,
            selfie_url: selfiePreviewUrl || undefined,
            observacion_excepcion: observacionExcepcion,
            estado_excepcion: estadoExcepcion,
            observacion: 'Registrado sin conexión. Pendiente de sincronización.'
          };

          onSuccess(offlineRecord);
        };
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al procesar el registro de ingreso.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl my-auto text-left max-h-[92vh] overflow-y-auto border border-slate-200">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <span className="text-[10px] font-extrabold text-[#00A651] uppercase tracking-wider block">
              Registro Seguro de Asistencia
            </span>
            <h3 className="font-extrabold text-lg text-[#17324D]">
              Verificación GPS y Selfie de Entrada
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 font-bold"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-300 text-red-900 rounded-2xl text-xs font-semibold flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: GPS STATUS & LOCATION */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#00A651]" />
              <h4 className="font-extrabold text-sm text-[#17324D]">Ubicación GPS</h4>
            </div>
            <button
              onClick={handleRefreshGps}
              disabled={loadingGps}
              className="text-xs text-[#00A651] hover:text-[#008f45] font-extrabold flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingGps ? 'animate-spin' : ''}`} />
              <span>Actualizar GPS</span>
            </button>
          </div>

          {loadingGps ? (
            <div className="py-4 text-center space-y-2 text-xs font-bold text-slate-500">
              <RefreshCw className="w-6 h-6 text-[#00A651] animate-spin mx-auto" />
              <p>Consultando ubicación satelital GPS...</p>
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-700">
                <span>Sede Asignada:</span>
                <strong className="text-slate-900 font-extrabold">{sedeInfo?.nombre || user.sede_nombre}</strong>
              </div>

              {sedeInfo && sedeInfo.latitud !== undefined && sedeInfo.longitud !== undefined && (
                <div className="flex justify-between items-center text-slate-700">
                  <span>Coordenadas Sede Usada:</span>
                  <span className="font-mono text-[11px] font-bold text-slate-700">
                    {Number(sedeInfo.latitud).toFixed(6)}, {Number(sedeInfo.longitud).toFixed(6)}
                  </span>
                </div>
              )}

              {gpsData && !gpsData.error && distanceMeters !== null && (
                <>
                  <div className="flex justify-between items-center text-slate-700">
                    <span>Distancia a la Sede:</span>
                    <strong className="text-slate-900 font-extrabold">{distanceMeters} metros</strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span>Radio Permitido:</span>
                    <span className="font-bold text-slate-600">{sedeInfo?.radio_m || 180} metros</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span>Precisión Satelital GPS:</span>
                    <span className="font-bold text-slate-600">±{gpsData.precision} metros</span>
                  </div>
                </>
              )}

              {/* Estado GPS Badge */}
              <div className="pt-2 border-t border-slate-200">
                {estadoGps === 'dentro_rango' && (
                  <div className="p-2.5 bg-emerald-100 border border-emerald-300 text-emerald-950 rounded-xl font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[#00A651] shrink-0" />
                    <span>Ubicación verificada: Dentro del rango permitido ({distanceMeters}m).</span>
                  </div>
                )}

                {estadoGps === 'fuera_rango' && (
                  <div className="p-2.5 bg-amber-50 border-2 border-amber-300 text-amber-950 rounded-xl font-bold flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p>Ubicación fuera del rango permitido ({distanceMeters}m &gt; {sedeInfo?.radio_m || 180}m).</p>
                      <p className="text-[11px] text-amber-800 font-medium mt-0.5">Se requiere registrar una observación de excepción.</p>
                    </div>
                  </div>
                )}

                {estadoGps === 'gps_impreciso' && (
                  <div className="p-2.5 bg-amber-50 border-2 border-amber-300 text-amber-950 rounded-xl font-bold flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p>GPS con precisión insuficiente (±{gpsData?.precision}m).</p>
                      <p className="text-[11px] text-amber-800 font-medium mt-0.5">Se requiere registrar una observación de excepción.</p>
                    </div>
                  </div>
                )}

                {estadoGps === 'sin_gps' && (
                  <div className="p-2.5 bg-red-50 border-2 border-red-300 text-red-950 rounded-xl font-bold flex items-start gap-2">
                    <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p>No se pudo acceder a la geolocalización GPS del dispositivo.</p>
                      <p className="text-[11px] text-red-800 font-medium mt-0.5">Se requiere registrar una observación de excepción obligatoria.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* STEP 2: MANDATORY EXCEPTION OBSERVATION (IF OUTSIDE RANGE OR IMPRECISE) */}
        {needsException && (
          <div className="p-4 bg-amber-50/80 border-2 border-amber-300 rounded-2xl space-y-2">
            <label className="block text-xs font-extrabold text-amber-950 uppercase flex items-center gap-1.5">
              <Info className="w-4 h-4 text-amber-700" />
              <span>Justificación de Excepción (Obligatoria) *</span>
            </label>
            <textarea
              rows={2}
              value={observacionExcepcion}
              onChange={(e) => setObservacionExcepcion(e.target.value)}
              placeholder="Explique el motivo por el cual marca asistencia fuera de rango o sin GPS (ej. Comisión oficial, falta de cobertura satelital, etc.)..."
              className="w-full p-3 bg-white rounded-xl border border-amber-300 text-xs sm:text-sm font-medium outline-none text-slate-900"
              required
            />
            <p className="text-[11px] text-amber-800 font-medium">
              ⚠️ Este registro quedará marcado como <strong>"Pendiente de revisión"</strong> y solo podrá ser validado por el Director o Superadministrador.
            </p>
          </div>
        )}

        {/* STEP 3: CAPTURE SELFIE */}
        <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-sm text-[#17324D] flex items-center gap-2">
              <Camera className="w-5 h-5 text-[#00A651]" />
              <span>Fotografía Selfie de Entrada *</span>
            </h4>
            {selfiePreviewUrl && (
              <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Check className="w-3 h-3" /> Selfie Capturada
              </span>
            )}
          </div>

          {selfiePreviewUrl ? (
            <div className="flex items-center gap-4 bg-white p-3 rounded-2xl border border-emerald-300">
              <img
                src={selfiePreviewUrl}
                alt="Vista previa Selfie"
                className="w-20 h-24 object-cover rounded-xl border border-slate-200 shadow-xs"
              />
              <div className="space-y-2 flex-1">
                <p className="text-xs font-bold text-slate-800">Fotografía comprimida lista para registro.</p>
                <button
                  onClick={() => setShowCameraModal(true)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-extrabold text-xs flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Tomar otra Selfie</span>
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCameraModal(true)}
              className="w-full h-12 bg-[#00A651] hover:bg-[#008f45] text-white font-extrabold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <Camera className="w-5 h-5" />
              <span>Abrir Cámara Frontal para Selfie</span>
            </button>
          )}
        </div>

        {/* SUBMIT BUTTON */}
        <div className="pt-2 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-12 border border-slate-300 rounded-2xl font-bold text-slate-600 hover:bg-slate-100 text-xs sm:text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmitClockIn}
            disabled={isSubmitting || !selfieBlob || (needsException && !observacionExcepcion.trim())}
            className={`flex-1 h-12 rounded-2xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all ${
              !selfieBlob || (needsException && !observacionExcepcion.trim()) || isSubmitting
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-[#00A651] hover:bg-[#008f45] text-white active:scale-[0.98]'
            }`}
          >
            <Clock className="w-5 h-5" />
            <span>{isSubmitting ? 'REGISTRANDO...' : 'CONFIRMAR INGRESO'}</span>
          </button>
        </div>
      </div>

      {/* Selfie Camera Modal */}
      <SelfieCameraModal
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onCapture={handleCaptureSelfie}
      />
    </div>
  );
};
