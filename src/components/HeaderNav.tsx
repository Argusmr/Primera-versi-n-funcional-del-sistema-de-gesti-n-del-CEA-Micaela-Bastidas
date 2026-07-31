import React from 'react';
import { Wifi, WifiOff, RefreshCw, ChevronLeft, Home, LogOut, Shield } from 'lucide-react';
import { Perfil, DatosInstitucionales } from '../types';
import { getLocalDatosInstitucionales } from '../lib/institutional';

interface HeaderNavProps {
  user: Perfil | null;
  isOnline: boolean;
  pendingSyncCount: number;
  isSyncing: boolean;
  onSync: () => void;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  onGoHome: () => void;
  onLogout: () => void;
  datosInstitucionales?: DatosInstitucionales;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  user,
  isOnline,
  pendingSyncCount,
  isSyncing,
  onSync,
  title,
  showBack,
  onBack,
  onGoHome,
  onLogout,
  datosInstitucionales,
}) => {
  const datos = datosInstitucionales || getLocalDatosInstitucionales();

  return (
    <header className="sticky top-0 z-40 bg-[#00A651] text-white shadow-md">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
        {/* Left side: Institution Name, User Name & Role */}
        <div className="flex items-center gap-2.5">
          {showBack && (
            <button
              onClick={onBack}
              id="btn-nav-back"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-transform flex items-center justify-center min-w-[40px] min-h-[40px]"
              title="Volver atrás"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
          )}

          <button
            onClick={onGoHome}
            id="btn-nav-brand"
            className="flex flex-col text-left focus:outline-none"
          >
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="font-extrabold text-sm sm:text-base leading-tight tracking-tight text-white">
                {datos.nombre_corto}
              </h1>
              {title && (
                <span className="text-xs text-emerald-100 font-semibold before:content-['•'] before:mr-1">
                  {title}
                </span>
              )}
            </div>

            {user ? (
              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-emerald-100 font-medium mt-0.5">
                <span className="truncate max-w-[140px] sm:max-w-[220px] font-semibold text-white">
                  {user.nombre_completo}
                </span>
                <span className="bg-emerald-800/80 text-emerald-100 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-400/30">
                  {user.rol === 'superadmin' ? 'Director' : 'Docente'}
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-emerald-100 font-medium">Gestión Institucional</p>
            )}
          </button>
        </div>

        {/* Right side: Connection Status, Sync Button, Home & User */}
        <div className="flex items-center gap-2">
          {/* Offline / Online Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-inner ${
              isOnline ? 'bg-emerald-800/60 text-emerald-100' : 'bg-amber-500 text-amber-950 animate-pulse'
            }`}
          >
            {isOnline ? (
              <>
                <Wifi className="w-4 h-4 text-emerald-300" />
                <span className="hidden xs:inline">En línea</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-amber-950" />
                <span>Sin conexión</span>
              </>
            )}
          </div>

          {/* Sync Button */}
          {pendingSyncCount > 0 && (
            <button
              onClick={onSync}
              disabled={isSyncing}
              id="btn-sync-now"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFC845] text-emerald-950 font-bold text-xs shadow-md hover:bg-yellow-300 active:scale-95 transition-all disabled:opacity-50"
              title="Sincronizar registros pendientes"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{pendingSyncCount}</span>
            </button>
          )}

          {/* Return to Home button */}
          <button
            onClick={onGoHome}
            id="btn-header-home"
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-transform flex items-center justify-center min-w-[44px] min-h-[44px]"
            title="Ir al Inicio"
          >
            <Home className="w-5 h-5 text-white" />
          </button>

          {/* Logout button */}
          {user && (
            <button
              onClick={onLogout}
              id="btn-header-logout"
              className="p-2 rounded-xl bg-red-600/80 hover:bg-red-600 active:scale-95 transition-transform flex items-center justify-center min-w-[44px] min-h-[44px]"
              title="Cerrar sesión"
            >
              <LogOut className="w-5 h-5 text-white" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
