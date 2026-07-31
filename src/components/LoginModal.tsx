import React, { useState } from 'react';
import { LogIn, UserCheck, Shield, AlertCircle, Key, Info } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Perfil } from '../types';
import { MOCK_SUPERADMIN, MOCK_DOCENTES } from '../lib/mockData';

interface LoginModalProps {
  onLoginSuccess: (user: Perfil) => void;
  onCancel?: () => void;
  onClose?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess, onCancel, onClose }) => {
  const handleClose = onCancel || onClose || (() => {});

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showSuperadminHelp, setShowSuperadminHelp] = useState(false);

  const handleSupabaseLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Por favor ingrese correo electrónico y contraseña');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setErrorMsg(error.message || 'Credenciales incorrectas');
          setLoading(false);
          return;
        }

        if (data.user) {
          // Fetch user profile from perfiles table
          const { data: profile, error: profileErr } = await supabase
            .from('perfiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (profileErr || !profile) {
            setErrorMsg('No se encontró el perfil docente asignado a esta cuenta.');
            setLoading(false);
            return;
          }

          onLoginSuccess(profile as Perfil);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Error de conexión con Supabase');
      } finally {
        setLoading(false);
      }
    } else {
      // Demo authentication mode matching provided email
      if (email.toLowerCase().includes('director') || email.toLowerCase().includes('mario') || email.toLowerCase().includes('malgus')) {
        onLoginSuccess(MOCK_SUPERADMIN);
      } else {
        const found = MOCK_DOCENTES.find(d => d.nombre_completo.toLowerCase().includes(email.toLowerCase())) || MOCK_DOCENTES[1];
        onLoginSuccess(found);
      }
      setLoading(false);
    }
  };

  const handleQuickDemoDocente = () => {
    onLoginSuccess(MOCK_DOCENTES[1]); // Elena Ramos
  };

  const handleQuickDemoDirector = () => {
    onLoginSuccess(MOCK_SUPERADMIN); // Director Mario Gutiérrez
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 my-auto">
        {/* Header */}
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-extrabold text-[#17324D]">Acceso Institucional</h2>
          <p className="text-xs text-slate-500 font-medium">CEA Micaela Bastidas – Poroma</p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {!isSupabaseConfigured && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <Info className="w-4 h-4 text-[#00A651]" />
              <span>Modo Demostración / Sin Supabase configurado</span>
            </div>
            <p>Puede ingresar directamente utilizando los accesos rápidos a continuación.</p>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSupabaseLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#17324D] uppercase tracking-wider mb-1">
              Correo Institucional
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="docente@ceamicaelabastidas.edu.bo"
              className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-[#00A651] focus:ring-2 focus:ring-emerald-200 outline-none text-base font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#17324D] uppercase tracking-wider mb-1">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-[#00A651] focus:ring-2 focus:ring-emerald-200 outline-none text-base font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            id="btn-login-submit"
            className="w-full h-13 bg-[#00A651] hover:bg-[#008f45] active:scale-[0.98] text-white font-bold text-base rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            <LogIn className="w-5 h-5" />
            <span>{loading ? 'Verificando...' : 'Iniciar Sesión'}</span>
          </button>
        </form>

        {/* Demo Quick Switches */}
        <div className="pt-2 border-t border-slate-200 space-y-2">
          <p className="text-center text-xs font-semibold text-slate-500">O Seleccione Perfil para Evaluación:</p>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleQuickDemoDirector}
              className="h-12 bg-emerald-50 hover:bg-emerald-100 text-[#00A651] border border-emerald-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 px-2 text-center"
            >
              <Shield className="w-4 h-4 shrink-0 text-[#00A651]" />
              <span>Rol Director</span>
            </button>

            <button
              onClick={handleQuickDemoDocente}
              className="h-12 bg-teal-50 hover:bg-teal-100 text-[#11B8AE] border border-teal-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 px-2 text-center"
            >
              <UserCheck className="w-4 h-4 shrink-0 text-[#11B8AE]" />
              <span>Rol Docente</span>
            </button>
          </div>
        </div>

        {/* Admin Setup Guide Button */}
        <div className="text-center">
          <button
            onClick={() => setShowSuperadminHelp(!showSuperadminHelp)}
            className="text-xs text-slate-500 underline font-medium hover:text-slate-800"
          >
            ¿Cómo crear el primer Superadministrador en Supabase?
          </button>
        </div>

        {showSuperadminHelp && (
          <div className="p-3 bg-slate-100 rounded-xl text-xs text-slate-700 space-y-1.5 border border-slate-300">
            <div className="font-bold text-[#17324D] flex items-center gap-1">
              <Key className="w-3.5 h-3.5 text-[#00A651]" />
              Guía de Primer Superadmin:
            </div>
            <ol className="list-decimal list-inside space-y-1 leading-relaxed">
              <li>En Supabase Dashboard &gt; Auth: Crear usuario con email del Director.</li>
              <li>En la tabla <code className="bg-white px-1 py-0.5 rounded">perfiles</code>: Insertar fila con el mismo UUID y <code className="bg-white px-1 py-0.5 rounded">rol = 'superadmin'</code>.</li>
            </ol>
          </div>
        )}

        <button
          onClick={handleClose}
          className="w-full text-center text-xs text-slate-400 font-semibold py-1 hover:text-slate-600"
        >
          Volver a la Portada
        </button>
      </div>
    </div>
  );
};
