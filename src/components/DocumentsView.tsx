import React, { useState } from 'react';
import {
  FileText,
  Search,
  Plus,
  Download,
  Eye,
  CheckCircle2,
  FileSpreadsheet,
  File,
  FileCheck,
  Tag,
  Calendar,
  Sparkles,
  BookOpen
} from 'lucide-react';
import { Perfil, Publicacion, CategoriaPublicacion } from '../types';
import { MOCK_PUBLICACIONES } from '../lib/mockData';

interface DocumentsViewProps {
  user: Perfil;
  onOpenPublishModal: () => void;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({ user, onOpenPublishModal }) => {
  const [publicaciones, setPublicaciones] = useState<Publicacion[]>(MOCK_PUBLICACIONES);
  const [selectedCategoria, setSelectedCategoria] = useState<string>('todas');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [readIds, setReadIds] = useState<string[]>(['pub-rm-001']);

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

  return (
    <div className="space-y-5 pb-20">
      {/* Title & Publish Trigger */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-[#17324D]">Información Institucional</h2>
          <p className="text-xs text-slate-500 font-medium">Documentos oficiales, normativas y POA 2026</p>
        </div>

        {canPublish && (
          <button
            onClick={onOpenPublishModal}
            id="btn-publicar-doc"
            className="h-11 px-3.5 bg-[#00A651] text-white font-bold text-xs rounded-2xl flex items-center gap-1.5 shadow-sm hover:bg-[#008f45]"
          >
            <Plus className="w-4 h-4 text-[#FFC845]" />
            <span>Publicar</span>
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-5 h-5 text-slate-400 absolute left-3 top-3" />
        <input
          type="text"
          placeholder="Buscar en títulos, descripción o texto de RM 001/2026..."
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

      {/* Documents & Announcements List */}
      <div className="space-y-4">
        {filtered.map((pub) => {
          const isRead = readIds.includes(pub.id);
          const isRM = pub.categoria === 'rm_001_2026';
          const isPOA = pub.categoria === 'poa';

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
                      <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                        ¡NUEVO!
                      </span>
                    )}
                  </div>
                  <h3 className="font-extrabold text-lg text-[#17324D] leading-snug">{pub.titulo}</h3>
                </div>
                <span className="text-xs font-semibold text-slate-400 shrink-0">{pub.fecha}</span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed font-medium">{pub.descripcion}</p>

              {pub.contenido_texto && (
                <div className="p-3 bg-slate-100 rounded-2xl text-xs text-slate-700 space-y-1 font-mono">
                  <strong className="text-slate-900 block font-sans">Fragmento de contenido:</strong>
                  <p className="line-clamp-2">{pub.contenido_texto}</p>
                </div>
              )}

              {/* Action Buttons for Document View / Download */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  onClick={() => handleMarkRead(pub.id)}
                  className="text-xs font-bold text-slate-500 hover:text-[#00A651] flex items-center gap-1"
                >
                  <FileCheck className="w-4 h-4 text-[#00A651]" />
                  <span>{isRead ? 'Leído' : 'Marcar como Leído'}</span>
                </button>

                {pub.archivo_url && (
                  <a
                    href={pub.archivo_url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => handleMarkRead(pub.id)}
                    className="h-10 px-4 bg-[#17324D] hover:bg-slate-900 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs"
                  >
                    {isPOA ? (
                      <FileSpreadsheet className="w-4 h-4 text-[#FFC845]" />
                    ) : (
                      <Download className="w-4 h-4 text-[#11B8AE]" />
                    )}
                    <span>{isPOA ? 'Descargar Excel POA' : 'Descargar Archivo'}</span>
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
