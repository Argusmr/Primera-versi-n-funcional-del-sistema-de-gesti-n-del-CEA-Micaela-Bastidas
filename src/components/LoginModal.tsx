import React, { useState } from 'react';
import { LogIn, AlertCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Perfil } from '../types';

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

  const handleSupabaseLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Por favor ingrese correo electrónico y contraseña');
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setErrorMsg('Supabase no está configurado en las variables de entorno. Verifique VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

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
          setErrorMsg('No se encontró un perfil docente asignado a esta cuenta.');
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
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
            <div className="font-bold">Supabase no configurado</div>
            <p>Se requieren las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para iniciar sesión.</p>
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
