import { useEffect, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminLogin, type AdminUser } from './components/AdminLogin';
import { PublicPortal, type PublicRoute } from './components/PublicPortal';
import { useAppPreferences } from './contexts/AppPreferencesContext';
import { apiRequest, setFirebaseIdToken } from './lib/api';
import { auth } from './lib/firebase';

type AppRoute = PublicRoute | 'login' | 'dashboard';

const VALID_ROUTES: AppRoute[] = ['landing', 'index', 'formmbkm', 'formpkl', 'absensi', 'login', 'dashboard'];

function parseHashRoute(): AppRoute {
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  if (VALID_ROUTES.includes(hash as AppRoute)) {
    return hash as AppRoute;
  }
  return 'landing';
}

export default function App() {
  const { t } = useAppPreferences();
  const [route, setRoute] = useState<AppRoute>(() => parseHashRoute());
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const navigate = (next: AppRoute) => {
    window.location.hash = `#${next}`;
    setRoute(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(parseHashRoute());
    };
    const handleUnauthorized = () => {
      setAdminUser(null);
      setRoute((prev) => {
        if (prev === 'dashboard') {
          window.location.hash = '#login';
          return 'login';
        }
        return prev;
      });
    };
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('ajinomoto:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('ajinomoto:unauthorized', handleUnauthorized);
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await auth.authStateReady();
        const fbUser = auth.currentUser;
        if (fbUser) {
          const fbToken = await fbUser.getIdToken();
          setFirebaseIdToken(fbToken);
        }
        // Always check /api/auth/session with HttpOnly cookie (zero localStorage)
        const res = await apiRequest<{ authenticated: boolean; user?: AdminUser }>('/api/auth/session');
        if (active) {
          setAdminUser(res.authenticated && res.user ? res.user : null);
          window.dispatchEvent(new CustomEvent('ajinomoto:auth-changed'));
        }
      } catch {
        if (active) setAdminUser(null);
      } finally {
        if (active) setCheckingAuth(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Auth guard: ?/#dashboard without active session redirects cleanly to #login (PRD A-01)
  useEffect(() => {
    if (!checkingAuth && route === 'dashboard' && !adminUser) {
      navigate('login');
    }
  }, [checkingAuth, route, adminUser]);

  const handleAuthSuccess = (u: AdminUser) => {
    setAdminUser(u);
    window.dispatchEvent(new CustomEvent('ajinomoto:auth-changed'));
    navigate('dashboard');
  };

  const handleLoggedOut = () => {
    setAdminUser(null);
    window.dispatchEvent(new CustomEvent('ajinomoto:auth-changed'));
    navigate('login');
  };

  if (route === 'dashboard') {
    if (checkingAuth) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-executive-canvas text-xs text-slate-600 dark:text-slate-300">
          {t('Memverifikasi sesi HR Admin...', 'Verifying HR Admin session...')}
        </div>
      );
    }
    if (!adminUser) {
      return (
        <AdminLogin
          onSuccess={handleAuthSuccess}
          onBackToPortal={() => navigate('index')}
        />
      );
    }
    return (
      <AdminDashboard
        user={adminUser}
        onUserUpdated={(updated) => setAdminUser(updated)}
        onLoggedOut={handleLoggedOut}
        onGoPortal={() => navigate('index')}
      />
    );
  }

  if (route === 'login') {
    if (adminUser) {
      return (
        <AdminDashboard
          user={adminUser}
          onUserUpdated={(updated) => setAdminUser(updated)}
          onLoggedOut={handleLoggedOut}
          onGoPortal={() => navigate('index')}
        />
      );
    }
    return (
      <AdminLogin
        onSuccess={handleAuthSuccess}
        onBackToPortal={() => navigate('index')}
      />
    );
  }

  return <PublicPortal route={route} onNavigate={navigate} />;
}
