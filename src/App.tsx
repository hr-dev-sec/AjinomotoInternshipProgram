import { useEffect, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminLogin, type AdminUser } from './components/AdminLogin';
import { PublicPortal, type PublicRoute } from './components/PublicPortal';
import { useAppPreferences } from './contexts/AppPreferencesContext';
import { apiRequest, prefetchApiGet, setFirebaseIdToken } from './lib/api';
import { auth } from './lib/firebase';

type AppRoute = PublicRoute | 'login' | 'dashboard';

const VALID_ROUTES: AppRoute[] = ['landing', 'index', 'formmbkm', 'formpkl', 'absensi', 'login', 'dashboard'];
const DEFAULT_FAVICON_URL = '/assets/aistudio/Logo_Ajinomoto_641a64fc.png';

function parseHashRoute(): AppRoute {
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  if (VALID_ROUTES.includes(hash as AppRoute)) {
    return hash as AppRoute;
  }
  return 'landing';
}

function applyFavicon(href: string) {
  const targetHref = href || DEFAULT_FAVICON_URL;
  const selectors = ['link[rel="icon"]', 'link[rel="shortcut icon"]', 'link[rel="apple-touch-icon"]'];
  selectors.forEach((selector) => {
    const existing = document.querySelector<HTMLLinkElement>(selector);
    if (existing) {
      if (existing.getAttribute('href') !== targetHref) {
        existing.setAttribute('href', targetHref);
      }
    } else if (selector === 'link[rel="icon"]') {
      const link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/png';
      link.href = targetHref;
      document.head.appendChild(link);
    }
  });
}

export default function App() {
  const { sessionTimeoutMinutes, t } = useAppPreferences();
  const [route, setRoute] = useState<AppRoute>(() => parseHashRoute());
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loginNoticeType, setLoginNoticeType] = useState<'timeout' | 'expired' | null>(null);

  const navigate = (next: AppRoute) => {
    window.location.hash = `#${next}`;
    setRoute(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Sync browser tab favicon if brand_logo_ajinomoto is updated in Media Manager (non-blocking)
  useEffect(() => {
    const syncFavicon = () => {
      apiRequest<{ media?: Record<string, { currentUrl?: string }> }>('/api/public/media')
        .then((res) => {
          const customLogo = res?.media?.brand_logo_ajinomoto?.currentUrl;
          if (customLogo) applyFavicon(customLogo);
        })
        .catch(() => {});
    };
    const timer = window.setTimeout(syncFavicon, 400);
    const onMutated = (e: Event) => {
      const detail = (e as CustomEvent<{ url?: string }>).detail;
      if (detail?.url?.includes('/api/media')) {
        syncFavicon();
      }
    };
    window.addEventListener('ajinomoto:mutated', onMutated);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('ajinomoto:mutated', onMutated);
    };
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(parseHashRoute());
    };
    const handleUnauthorized = () => {
      setAdminUser(null);
      setLoginNoticeType((prev) => prev || 'expired');
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
        // Fast path: check HttpOnly session cookie immediately without waiting for Firebase SDK boot
        let res = await apiRequest<{ authenticated: boolean; user?: AdminUser }>('/api/auth/session');

        // Fallback path: only check Firebase Google Auth if cookie session is not active
        if (!res.authenticated && active) {
          try {
            await auth.authStateReady();
            const fbUser = auth.currentUser;
            if (fbUser) {
              const fbToken = await fbUser.getIdToken();
              setFirebaseIdToken(fbToken);
              res = await apiRequest<{ authenticated: boolean; user?: AdminUser }>('/api/auth/session');
            }
          } catch {
            // ignore Firebase fallback errors when unauthenticated
          }
        }

        if (active) {
          const authenticatedUser = res.authenticated && res.user ? res.user : null;
          setAdminUser(authenticatedUser);
          if (authenticatedUser) {
            prefetchApiGet('/api/dashboard/overview');
          }
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
    setLoginNoticeType(null);
    setAdminUser(u);
    prefetchApiGet('/api/dashboard/overview');
    window.dispatchEvent(new CustomEvent('ajinomoto:auth-changed'));
    navigate('dashboard');
  };

  const handleLoggedOut = (reason: 'manual' | 'timeout' = 'manual') => {
    setAdminUser(null);
    setLoginNoticeType(reason === 'timeout' ? 'timeout' : null);
    window.dispatchEvent(new CustomEvent('ajinomoto:auth-changed'));
    navigate('login');
  };

  const loginNoticeText =
    loginNoticeType === 'timeout'
      ? t(
          `Sesi Anda berakhir otomatis karena tidak ada aktivitas selama ${sessionTimeoutMinutes} menit tanpa konfirmasi. Silakan login kembali untuk melanjutkan.`,
          `Your session ended automatically due to ${sessionTimeoutMinutes} minutes of inactivity without confirmation. Please sign in again to continue.`
        )
      : loginNoticeType === 'expired'
        ? t(
            'Sesi login Anda telah berakhir. Silakan masuk kembali untuk melanjutkan.',
            'Your login session has expired. Please sign in again to continue.'
          )
        : '';

  if (route === 'dashboard') {
    if (checkingAuth) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-executive-canvas px-4">
          <div className="surface-card tab-panel-enter flex flex-col items-center gap-3.5 px-7 py-6 text-center max-w-xs w-full">
            <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200/90 shadow-2xs">
              <img
                src={DEFAULT_FAVICON_URL}
                alt="Ajinomoto"
                className="h-7 w-auto object-contain"
              />
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
              <span className="h-3.5 w-3.5 rounded-full border-2 border-slate-300 border-t-red-600 animate-spin dark:border-slate-700 dark:border-t-red-400" />
              <span>{t('Memverifikasi sesi HR Admin...', 'Verifying HR Admin session...')}</span>
            </div>
          </div>
        </div>
      );
    }
    if (!adminUser) {
      return (
        <AdminLogin
          notice={loginNoticeText}
          onDismissNotice={() => setLoginNoticeType(null)}
          onSuccess={handleAuthSuccess}
          onBackToPortal={() => navigate('index')}
        />
      );
    }
    return (
      <div className="tab-panel-enter">
        <AdminDashboard
          user={adminUser}
          onUserUpdated={(updated) => setAdminUser(updated)}
          onLoggedOut={handleLoggedOut}
          onGoPortal={() => navigate('index')}
        />
      </div>
    );
  }

  if (route === 'login') {
    if (adminUser) {
      return (
        <div className="tab-panel-enter">
          <AdminDashboard
            user={adminUser}
            onUserUpdated={(updated) => setAdminUser(updated)}
            onLoggedOut={handleLoggedOut}
            onGoPortal={() => navigate('index')}
          />
        </div>
      );
    }
    return (
      <AdminLogin
        notice={loginNoticeText}
        onDismissNotice={() => setLoginNoticeType(null)}
        onSuccess={handleAuthSuccess}
        onBackToPortal={() => navigate('index')}
      />
    );
  }

  return <PublicPortal route={route} onNavigate={navigate} />;
}
