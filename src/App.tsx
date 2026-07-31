import React, { useState, useEffect } from 'react';
import { HeaderNav } from './components/HeaderNav';
import { BottomNav } from './components/BottomNav';
import { Portada } from './components/Portada';
import { LoginModal } from './components/LoginModal';
import { TeacherDashboard } from './components/TeacherDashboard';
import { DirectorDashboard } from './components/DirectorDashboard';
import { TeacherAttendanceView } from './components/TeacherAttendanceView';
import { StudentsView } from './components/StudentsView';
import { FollowUpView } from './components/FollowUpView';
import { TeachersAdminView } from './components/TeachersAdminView';
import { DocumentsView } from './components/DocumentsView';
import { ReportsView } from './components/ReportsView';
import { AdminPanel } from './components/AdminPanel';
import { AddTeacherModal, AddStudentModal, PublishModal } from './components/Modals';

import { Perfil, DatosInstitucionales } from './types';
import { checkIsOnline, getCurrentUserProfile } from './lib/supabase';
import { getPendingSyncCount } from './lib/db';
import { SyncManager } from './lib/syncManager';
import { MOCK_DOCENTES } from './lib/mockData';
import { downloadDocenteAttendanceReport } from './lib/excelExport';
import { getLocalDatosInstitucionales, loadDatosInstitucionales } from './lib/institutional';

export function App() {
  // Current user state (null means visitor on Portada landing screen)
  const [currentUser, setCurrentUser] = useState<Perfil | null>(null);
  const [activeTab, setActiveTab] = useState<string>('inicio');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Institutional data state
  const [datosInstitucionales, setDatosInstitucionales] = useState<DatosInstitucionales>(
    getLocalDatosInstitucionales()
  );

  // Modals state
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [showAddTeacherModal, setShowAddTeacherModal] = useState<boolean>(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState<boolean>(false);
  const [showPublishModal, setShowPublishModal] = useState<boolean>(false);

  useEffect(() => {
    // Sync institutional data from Supabase if online
    const syncInstitutionalData = async () => {
      const data = await loadDatosInstitucionales();
      setDatosInstitucionales(data);
    };
    syncInstitutionalData();
  }, [isOnline]);


  // Connection & Sync monitor
  const refreshSyncCount = async () => {
    try {
      const count = await getPendingSyncCount();
      setPendingSyncCount(count);
    } catch {
      setPendingSyncCount(0);
    }
  };

  useEffect(() => {
    const handleOnlineStatus = async () => {
      const online = await checkIsOnline();
      setIsOnline(online);
      if (online) {
        handleTriggerSync();
      }
    };

    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', () => setIsOnline(false));

    refreshSyncCount();
    const interval = setInterval(refreshSyncCount, 10000);

    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', () => setIsOnline(false));
      clearInterval(interval);
    };
  }, []);

  const handleTriggerSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncNotice(null);

    try {
      const result = await SyncManager.processSyncQueue();
      if (result.syncedCount > 0) {
        setSyncNotice(`¡Sincronización completada! ${result.syncedCount} registros enviados al servidor.`);
        setTimeout(() => setSyncNotice(null), 4000);
      }
    } catch {
      setSyncNotice('Nota: Algunos registros sin conexión se mantuvieron guardados en el dispositivo.');
    } finally {
      setIsSyncing(false);
      refreshSyncCount();
    }
  };

  const handleLoginSuccess = (user: Perfil) => {
    setCurrentUser(user);
    setShowLoginModal(false);
    setActiveTab('inicio');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('inicio');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-[#00A651] selection:text-white">
      {/* Portada / Landing Page for unauthenticated visitors */}
      {!currentUser ? (
        <>
          <Portada
            isOnline={isOnline}
            onIngresar={() => setShowLoginModal(true)}
            datosInstitucionales={datosInstitucionales}
          />
          {showLoginModal && (
            <LoginModal
              onClose={() => setShowLoginModal(false)}
              onLoginSuccess={handleLoginSuccess}
            />
          )}
        </>
      ) : (
        /* Logged In Institutional Application Shell */
        <div className="flex flex-col min-h-screen max-w-2xl mx-auto shadow-2xl bg-[#F8FAFC] border-x border-slate-200">
          {/* Header Navigation */}
          <HeaderNav
            user={currentUser}
            isOnline={isOnline}
            pendingSyncCount={pendingSyncCount}
            isSyncing={isSyncing}
            onSync={handleTriggerSync}
            onGoHome={() => setActiveTab('inicio')}
            onLogout={handleLogout}
            datosInstitucionales={datosInstitucionales}
          />

          {/* Sync Success / Notice Banner */}
          {syncNotice && (
            <div className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 text-center animate-fade-in shadow-xs">
              {syncNotice}
            </div>
          )}

          {/* Main Content Body */}
          <main className="flex-1 px-4 py-4">
            {activeTab === 'inicio' && (
              currentUser.rol === 'superadmin' ? (
                <DirectorDashboard
                  user={currentUser}
                  isOnline={isOnline}
                  onNavigateTab={setActiveTab}
                  onOpenAddTeacherModal={() => setShowAddTeacherModal(true)}
                  onOpenAddStudentModal={() => setShowAddStudentModal(true)}
                  onOpenPublishModal={() => setShowPublishModal(true)}
                  onDownloadReport={() => downloadDocenteAttendanceReport([], [], '2026-07')}
                  datosInstitucionales={datosInstitucionales}
                />
              ) : (
                <TeacherDashboard
                  user={currentUser}
                  isOnline={isOnline}
                  onNavigateTab={setActiveTab}
                  pendingSyncCount={pendingSyncCount}
                  onRefreshSync={refreshSyncCount}
                />
              )
            )}

            {activeTab === 'asistencia' && (
              <TeacherAttendanceView user={currentUser} />
            )}

            {activeTab === 'estudiantes' && (
              <StudentsView
                user={currentUser}
                isOnline={isOnline}
                onOpenAddStudentModal={() => setShowAddStudentModal(true)}
              />
            )}

            {activeTab === 'seguimiento' && (
              <FollowUpView user={currentUser} isOnline={isOnline} />
            )}

            {activeTab === 'docentes' && (
              <TeachersAdminView
                user={currentUser}
                isOnline={isOnline}
                onOpenAddTeacherModal={() => setShowAddTeacherModal(true)}
                onUpdateCurrentUser={(updated) => setCurrentUser(updated)}
              />
            )}

            {activeTab === 'documentos' && (
              <DocumentsView
                user={currentUser}
                onOpenPublishModal={() => setShowPublishModal(true)}
              />
            )}

            {activeTab === 'reportes' && (
              <ReportsView user={currentUser} />
            )}

            {activeTab === 'admin' && (
              <AdminPanel
                user={currentUser}
                datosInstitucionales={datosInstitucionales}
                onUpdateDatosInstitucionales={(datos) => setDatosInstitucionales(datos)}
              />
            )}
          </main>

          {/* Bottom Navigation for Mobile Touch */}
          <BottomNav
            user={currentUser}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            pendingSyncCount={pendingSyncCount}
          />
        </div>
      )}

      {/* Global Modals */}
      {showAddTeacherModal && (
        <AddTeacherModal
          onClose={() => setShowAddTeacherModal(false)}
          onSuccess={() => {
            setShowAddTeacherModal(false);
          }}
        />
      )}

      {showAddStudentModal && (
        <AddStudentModal
          onClose={() => setShowAddStudentModal(false)}
          onSuccess={() => {
            setShowAddStudentModal(false);
          }}
        />
      )}

      {showPublishModal && (
        <PublishModal
          onClose={() => setShowPublishModal(false)}
          onSuccess={() => {
            setShowPublishModal(false);
          }}
        />
      )}
    </div>
  );
}

export default App;
