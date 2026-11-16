import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { NewAnalysisPage } from './pages/NewAnalysisPage';
import { ProgressPage } from './pages/ProgressPage';
import { ReportPage } from './pages/ReportPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { Loader2 } from 'lucide-react';

function parseHash(): { route: string; param?: string } {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/');
  const route = parts[0] || 'dashboard';
  const param = parts[1] || undefined;
  return { route, param };
}

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [{ route, param }, setNavState] = useState<{ route: string; param?: string }>(parseHash());

  useEffect(() => {
    const handleHashChange = () => {
      setNavState(parseHash());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (nextRoute: string, nextParam?: string) => {
    if (nextParam) {
      window.location.hash = `#/${nextRoute}/${nextParam}`;
    } else {
      window.location.hash = `#/${nextRoute}`;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-2" />
          <span className="text-xs font-semibold text-slate-600">Initializing UpgradeLens...</span>
        </div>
      </div>
    );
  }

  // Auth routing enforcement
  if (!user) {
    if (route === 'register') {
      return (
        <div className="min-h-screen flex flex-col bg-slate-50">
          <Navbar currentRoute={route} navigate={navigate} />
          <main className="flex-1">
            <RegisterPage navigate={navigate} />
          </main>
          <Footer />
        </div>
      );
    }
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Navbar currentRoute={route} navigate={navigate} />
        <main className="flex-1">
          <LoginPage navigate={navigate} />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar currentRoute={route} navigate={navigate} />
      <main className="flex-1">
        {route === 'dashboard' && <DashboardPage navigate={navigate} />}
        {route === 'new-analysis' && <NewAnalysisPage navigate={navigate} />}
        {route === 'progress' && param && <ProgressPage analysisId={param} navigate={navigate} />}
        {route === 'report' && param && <ReportPage analysisId={param} navigate={navigate} />}
        {route === 'history' && <HistoryPage navigate={navigate} />}
        {route === 'settings' && <SettingsPage />}
        {route === 'login' && <DashboardPage navigate={navigate} />}
        {route === 'register' && <DashboardPage navigate={navigate} />}
        {!['dashboard', 'new-analysis', 'progress', 'report', 'history', 'settings', 'login', 'register'].includes(route) && (
          <DashboardPage navigate={navigate} />
        )}
      </main>
      <Footer />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;