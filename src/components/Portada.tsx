import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, Download, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { DatosInstitucionales } from '../types';
import { getLocalDatosInstitucionales } from '../lib/institutional';

interface PortadaProps {
  isOnline: boolean;
  onIngresar: () => void;
  datosInstitucionales?: DatosInstitucionales;
}

export const Portada: React.FC<PortadaProps> = ({ isOnline, onIngresar, datosInstitucionales }) => {
  const datos = datosInstitucionales || getLocalDatosInstitucionales();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [showInstallGuide, setShowInstallGuide] = useState<boolean>(false);

  useEffect(() => {
    // Check if running as standalone PWA
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      setShowInstallGuide(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F8F7] flex flex-col justify-between p-3 sm:p-6 text-[#17324D]">
      {/* Top Bar: Connection status pill */}
      <div className="flex justify-end pt-1">
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-medium text-xs shadow-xs ${
            isOnline ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-900 border border-amber-300'
          }`}
        >
          {isOnline ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-600" />
              <span>En línea</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-amber-700" />
              <span>Sin conexión</span>
            </>
          )}
        </div>
      </div>

      {/* Main Center Content */}
      <div className="flex-1 flex flex-col items-center justify-center text-center my-2 max-w-md mx-auto w-full">
        {/* Institutional Shield Container */}
        <div className="relative mb-3 w-32 h-38 sm:w-44 sm:h-52 flex items-center justify-center shrink-0">
          <img
            src="/escudo-original-v2.png"
            alt="Escudo del CEA Micaela Bastidas"
            className="w-full h-full object-contain"
          />
        </div>

        {/* Institution Titles */}
        <h1 className="text-2xl sm:text-4xl font-extrabold text-[#00A651] tracking-tight mb-0.5">
          {datos.nombre_corto}
        </h1>
        <h2 className="text-base sm:text-2xl font-bold text-[#17324D] mb-2">
          Gestión institucional
        </h2>

        {/* Short Subtitle Message */}
        <p className="text-slate-600 text-xs sm:text-base max-w-xs leading-snug font-medium mb-3">
          {datos.lema_subtitulo}
        </p>

        {/* Quick Highlights */}
        <div className="bg-white/80 backdrop-blur-sm p-3 rounded-2xl border border-emerald-100 shadow-xs w-full mb-3 text-left space-y-1.5">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-700">
            <CheckCircle2 className="w-4 h-4 text-[#00A651] shrink-0" />
            <span>Funciona con o sin señal de internet</span>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-700">
            <CheckCircle2 className="w-4 h-4 text-[#11B8AE] shrink-0" />
            <span>Registro seguro de asistencia laboral y estudiantil</span>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-700">
            <CheckCircle2 className="w-4 h-4 text-[#FFC845] shrink-0" />
            <span>Alertas tempranas de estudiantes en riesgo</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full space-y-2">
          {/* Main INGRESAR Button */}
          <button
            onClick={onIngresar}
            id="btn-portada-ingresar"
            className="w-full h-12 bg-[#00A651] hover:bg-[#008f45] active:scale-[0.98] text-white font-bold text-base rounded-2xl shadow-md shadow-emerald-700/20 flex items-center justify-center gap-2 transition-all"
          >
            <span>INGRESAR</span>
            <ArrowRight className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* PWA Install Button */}
          {!isInstalled && (
            <button
              onClick={handleInstallClick}
              id="btn-portada-instalar"
              className="w-full h-11 bg-white hover:bg-slate-50 text-[#17324D] border border-slate-200 font-bold text-sm rounded-2xl flex items-center justify-center gap-2 transition-all"
            >
              <Download className="w-4 h-4 text-[#11B8AE]" />
              <span>INSTALAR APLICACIÓN</span>
            </button>
          )}

          {isInstalled && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 py-1.5 rounded-xl">
              <ShieldCheck className="w-4 h-4 text-[#00A651]" />
              <span>Aplicación instalada en este dispositivo</span>
            </div>
          )}
        </div>
      </div>

      {/* Browser installation instructions modal */}
      {showInstallGuide && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-left space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-[#17324D] flex items-center gap-2">
              <Download className="w-5 h-5 text-[#00A651]" />
              Instalar en la pantalla principal
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Abre el menú del navegador (los tres puntos arriba a la derecha en Android o el botón Compartir en Safari iPhone) y selecciona:
            </p>
            <div className="bg-emerald-50 p-3 rounded-xl text-sm font-semibold text-emerald-900 border border-emerald-200">
              "Añadir a pantalla principal" o "Instalar aplicación"
            </div>
            <button
              onClick={() => setShowInstallGuide(false)}
              className="w-full h-11 bg-[#00A651] text-white font-bold rounded-xl"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Institutional Footer */}
      <div className="text-center text-xs text-slate-500 py-2 font-medium">
        {datos.nombre_corto} – {datos.direccion} (2026)
      </div>
    </div>
  );
};

