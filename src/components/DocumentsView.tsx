import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Plus,
  Download,
  FileSpreadsheet,
  FileCheck,
  Sparkles,
  RefreshCw,
  AlertCircle,
  File,
  ImageIcon
} from 'lucide-react';
import { Perfil, Publicacion } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface DocumentsViewProps {
  user: Perfil;
  onOpenPublishModal: () => void;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({ user, onOpenPublishModal }) => {
  const [publicaciones, setPublicaciones] = useState<Publicacion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategoria, setSelectedCategoria] = useState<string>('todas');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [readIds, setReadIds] = useState<string[]>([]);

  const canPublish = user.rol === 'superadmin' || user.puede_publicar;

  const categorias: Array<{ id: string; label: string }> = [
    { id: 'todas', label: 'Todas' },
    { id: 'anuncios', label: 'Anuncios' },
    { id: 'comunicados', label: 'Comunicados' },
    { id: 'instructivos', label: 'Instructivos' },
    { id: 'normativa', label: 'Normativa' },
    { id: 'rm_001_2026', label: 'RM 001/2026' },
    { id: 'poa', label: 'POA 2026' },
    { id: 'calendario', label: 'Calendario' },
    { id: 'formularios', label: 'Formularios' },
    { id: 'otros', label: 'Otros' },
  ];

  const fetchPublicaciones = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setPublicaciones([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchErr } = await supabase
        .from('publicaciones')
        .select('*')
        .eq('archivado', false)
        .order('created_at', { ascending: false });

      if (fetchErr) {
        throw fetchErr;
      }

      setPublicaciones(data || []);
    } catch (err: any) {
      console.error('Error fetching publicaciones:', err);
      setError(err.message || 'Error al cargar los documentos institucionales.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublicaciones();

    const handlePublicacionCreada = () => {
      fetchPublicaciones();
    };

    window.addEventListener('publicacion-creada', handlePublicacionCreada);
    return () => {
      window.removeEventListener('publicacion-creada', handlePublicacionCreada);
    };
  }, []);

  const filtered = publicaciones.filter((p) => {
    const matchCat = selectedCategoria === 'todas' ? true : p.categoria === selectedCategoria;
    const matchSearch =
      p.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.contenido_texto && p.contenido_texto.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchCat && matchSearch;
  });

  const handleMarkRead = (id: string) => {
    if (!readIds.includes(id)) {
      setReadIds(prev => [...prev, id]);
    }
  };

  const renderFileIcon = (tipo?: string) => {
    switch (tipo) {
      case 'excel':
        return <FileSpreadsheet className="w-4 h-4 text-[#FFC845]" />;
      case 'imagen':
        return <ImageIcon className="w-4 h-4 text-emerald-400" />;
      case 'word':
        return <File className="w-4 h-4 text-blue-400" />;
      case 'pdf':
      default:
        return <Download className="w-4 h-4 text-[#11B8AE]" />;
    }
  };

  const getDownloadLabel = (tipo?: string, categoria?: string) => {
    if (categoria === 'poa' || tipo === 'excel') return 'Descargar Excel';
    if (tipo === 'pdf') return 'Descargar PDF';
    if (tipo === 'word') return 'Descargar Word';
    if (tipo === 'imagen') return 'Ver Imagen';
    return 'Descargar Archivo';
  };

  return (
    <div className="space-y-5 pb-20">
      {/* Title & Publish Trigger */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-[#17324D]">Información Institucional</h2>
          <p className="text-xs text-slate-500 font-medium">Documentos oficiales, normativas y avisos institucionales</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchPublicaciones}
            disabled={loading}
            className="h-10 w-10 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl flex items-center justify-center transition-colors disabled:opacity-50"
            title="Actualizar documentos"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {canPublish && (
            <button
              onClick={onOpenPublishModal}
              id="btn-publicar-doc"
              className="h-11 px-3.5 bg-[#00A651] text-white font-bold text-xs rounded-2xl flex items-center gap-1.5 shadow-sm hover:bg-[#008f45] transition-colors"
            >
              <Plus className="w-4 h-4 text-[#FFC845]" />
              <span>Publicar</span>
            </button>
          )}
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-5 h-5 text-slate-400 absolute left-3 top-3" />
        <input
          type="text"
          placeholder="Buscar por título, descripción o contenido..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full h-11 pl-10 pr-4 bg-white border border-slate-300 rounded-2xl text-xs font-medium outline-none focus:border-[#00A651]"
        />
      </div>

      {/* Category Pills Slider */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {categorias.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategoria(cat.id)}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedCategoria === cat.id
                ? 'bg-[#00A651] text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Error State */}
      {error && !loading && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-3xl text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchPublicaciones}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-[11px] transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="p-10 text-center bg-white rounded-3xl border border-slate-200 text-slate-500 font-bold text-xs space-y-2">
          <RefreshCw className="w-8 h-8 text-[#00A651] animate-spin mx-auto" />
          <p>Cargando información institucional desde Supabase...</p>
        </div>
      )}

      {/* Global Empty State (no documents in database) */}
      {!loading && !error && publicaciones.length === 0 && (
        <div className="p-10 text-center bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
          <FileText className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="font-extrabold text-sm text-slate-800">Aún no hay documentos institucionales publicados.</p>
          {canPublish && (
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Utilice el botón <strong className="text-emerald-700">"Publicar"</strong> para subir normativas, instructivos, POA o comunicados institucionales.
            </p>
          )}
        </div>
      )}

      {/* Filtered Empty State (search or category with 0 matches) */}
      {!loading && !error && publicaciones.length > 0 && filtered.length === 0 && (
        <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-500 font-bold text-xs space-y-2">
          <Search className="w-8 h-8 text-slate-300 mx-auto" />
          <p>No se encontraron documentos que coincidan con el filtro o la búsqueda.</p>
        </div>
      )}

      {/* Real Documents & Announcements List */}
      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-4">
          {filtered.map((pub) => {
            const isRead = readIds.includes(pub.id);
            const hasFile = Boolean(pub.archivo_url && pub.archivo_url.trim() !== '');

            return (
              <div
                key={pub.id}
                className={`p-5 rounded-3xl border shadow-xs space-y-3 transition-all ${
                  pub.destacado
                    ? 'bg-gradient-to-br from-emerald-50/80 to-teal-50/80 border-emerald-300'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="bg-[#00A651] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase">
                        {pub.categoria.replace('_', ' ')}
                      </span>
                      {pub.destacado && (
                        <span className="bg-[#FFC845] text-amber-950 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Destacado
                        </span>
                      )}
                      {!isRead && (
                        <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          NUEVO
                        </span>
                      )}
                    </div>
                    <h3 className="font-extrabold text-lg text-[#17324D] leading-snug">{pub.titulo}</h3>
                  </div>
                  <span className="text-xs font-semibold text-slate-400 shrink-0">{pub.fecha}</span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed font-medium whitespace-pre-line">
                  {pub.descripcion}
                </p>

                {pub.nombre_archivo && (
                  <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                    <File className="w-3.5 h-3.5 text-slate-400" />
                    <span>Archivo: <strong>{pub.nombre_archivo}</strong></span>
                  </p>
                )}

                {pub.contenido_texto && (
                  <div className="p-3 bg-slate-100 rounded-2xl text-xs text-slate-700 space-y-1 font-mono">
                    <strong className="text-slate-900 block font-sans">Fragmento de contenido:</strong>
                    <p className="line-clamp-2">{pub.contenido_texto}</p>
                  </div>
                )}

                {/* Action Buttons: Marcar como Leído & Descargar Archivo (únicamente si archivo_url existe) */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleMarkRead(pub.id)}
                    className="text-xs font-bold text-slate-500 hover:text-[#00A651] flex items-center gap-1 transition-colors"
                  >
                    <FileCheck className="w-4 h-4 text-[#00A651]" />
                    <span>{isRead ? 'Leído' : 'Marcar como Leído'}</span>
                  </button>

                  {hasFile && (
                    <a
                      href={pub.archivo_url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => handleMarkRead(pub.id)}
                      className="h-10 px-4 bg-[#17324D] hover:bg-slate-900 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      {renderFileIcon(pub.tipo_archivo)}
                      <span>{getDownloadLabel(pub.tipo_archivo, pub.categoria)}</span>
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
