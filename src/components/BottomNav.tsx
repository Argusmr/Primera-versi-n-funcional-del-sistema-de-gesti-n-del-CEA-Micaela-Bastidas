import React from 'react';
import { Home, Clock, Users, FileText, UserCheck, Settings, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { Perfil } from '../types';

interface BottomNavProps {
  user: Perfil;
  activeTab: string;
  onTabChange: (tab: string) => void;
  pendingSyncCount?: number;
}

interface NavTabItem {
  id: string;
  label: string;
  icon: React.ForwardRefExoticComponent<any>;
  badge?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  user,
  activeTab,
  onTabChange,
  pendingSyncCount = 0,
}) => {
  const teacherTabs: NavTabItem[] = [
    { id: 'inicio', label: 'Inicio', icon: Home },
    { id: 'asistencia', label: 'Mi Asistencia', icon: Clock },
    { id: 'estudiantes', label: 'Estudiantes', icon: Users },
    { id: 'seguimiento', label: 'Seguimiento', icon: AlertTriangle, badge: pendingSyncCount },
    { id: 'documentos', label: 'Documentos', icon: FileText },
  ];

  const directorTabs: NavTabItem[] = [
    { id: 'inicio', label: 'Inicio', icon: Home },
    { id: 'docentes', label: 'Docentes', icon: UserCheck },
    { id: 'estudiantes', label: 'Estudiantes', icon: Users },
    { id: 'seguimiento', label: 'Seguimiento', icon: AlertTriangle },
    { id: 'documentos', label: 'Documentos', icon: FileText },
    { id: 'reportes', label: 'Reportes', icon: FileSpreadsheet },
    { id: 'admin', label: 'Admin', icon: Settings },
  ];

  const tabs = user.rol === 'superadmin' ? directorTabs : teacherTabs;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg">
      <div className="max-w-2xl mx-auto flex items-center justify-around px-2 py-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`tab-btn-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all min-h-[52px] relative ${
                isActive
                  ? 'text-[#00A651] font-bold bg-emerald-50/80'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                {Boolean(tab.badge && tab.badge > 0) && (
                  <span className="absolute -top-1 -right-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] leading-tight whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
