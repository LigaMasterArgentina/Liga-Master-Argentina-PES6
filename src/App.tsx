import { useCallback, useEffect, useMemo, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { AuthModal } from './components/AuthModal';
import { CalendarView } from './components/CalendarView';
import { FireworksIntro } from './components/FireworksIntro';
import { GalleryView } from './components/GalleryView';
import { HomeView, type NavTab } from './components/HomeView';
import { LiveClock } from './components/LiveClock';
import { MatchesView, type MatchesSubTab } from './components/MatchesView';
import { MusicBar } from './components/MusicBar';
import { ProfileView, type AdminSection } from './components/ProfileView';
import { ResetPasswordView } from './components/ResetPasswordView';
import { RulesView } from './components/RulesView';
import { StandingsView } from './components/StandingsView';
import type { AuthUser, LeagueBootstrap } from './types';
import { useCommunityVideos } from './hooks/useCommunityVideos';
import { apiFetch, setStoredToken } from './utils/api';
import { computeStandings } from './utils/standings';

import maradonaMascotImg from './assets/images/mascot_maradona_chibi_1794813287015.jpg';
import messiMascotImg from './assets/images/mascot_messi_chibi_1794813289521.jpg';

const DEFAULT_ICON = '/assets/aistudio/Liga_Master_Argentina__F_tbol_de__lite_eeeab9aa.png';
const PAGE_BACKGROUND_IMAGE = '/assets/aistudio/WhatsApp_Image_2026-11-13_at_13.50.53_51d40a0e.jpeg';

export default function App() {
  const [data, setData] = useState<LeagueBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showIntro, setShowIntro] = useState(true);
  const [activeTab, setActiveTab] = useState<NavTab>('inicio');
  const [gallerySubTab, setGallerySubTab] = useState<'videos' | 'campeones'>('videos');
  const [matchesSubTab, setMatchesSubTab] = useState<MatchesSubTab>('validated');
  const [profileSubTab, setProfileSubTab] = useState<AdminSection | undefined>(undefined);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [prefillAuthId, setPrefillAuthId] = useState<string | undefined>(undefined);
  const [resetPageState, setResetPageState] = useState<{ active: boolean; oobCode: string | null }>(
    () => {
      if (typeof window === 'undefined') return { active: false, oobCode: null };
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode');
      const oobCode = params.get('oobCode');
      const isResetPath = window.location.pathname === '/reset-password';
      return {
        active: isResetPath || (mode === 'resetPassword' && Boolean(oobCode)),
        oobCode: oobCode || null,
      };
    }
  );

  useEffect(() => {
    if (resetPageState.active) {
      setShowIntro(false);
    }
  }, [resetPageState.active]);

  const handleExitResetPage = useCallback((adminId?: string) => {
    setResetPageState({ active: false, oobCode: null });
    if (adminId) {
      setPrefillAuthId(adminId);
    }
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/');
    }
    setAuthModalOpen(true);
  }, []);

  const { communityVideos, loadingCommunity, firestoreError } = useCommunityVideos();

  const fetchBootstrap = useCallback(async () => {
    try {
      const payload = await apiFetch<LeagueBootstrap>('/api/bootstrap');
      if (
        !payload ||
        !Array.isArray(payload.teams) ||
        !Array.isArray(payload.matches) ||
        !payload.settings ||
        !payload.cup
      ) {
        throw new Error('Datos de la liga incompletos.');
      }
      setData(payload);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Error cargando la liga.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBootstrap();
    const handleFocus = () => {
      void fetchBootstrap();
    };
    window.addEventListener('focus', handleFocus);

    let es: EventSource | null = null;
    if (typeof EventSource !== 'undefined') {
      es = new EventSource('/api/events');
      es.addEventListener('db_updated', () => {
        void fetchBootstrap();
      });
    }

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel('lma-sync');
      bc.onmessage = () => {
        void fetchBootstrap();
      };
    }

    const pollInterval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchBootstrap();
      }
    }, 60000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      if (es) es.close();
      if (bc) bc.close();
      window.clearInterval(pollInterval);
    };
  }, [fetchBootstrap]);

  useEffect(() => {
    if (!data?.settings) return;
    document.title = `${data.settings.title} | ${data.settings.subtitle}`;
    const iconHref = data.settings.faviconUrl || data.settings.crestUrl || DEFAULT_ICON;

    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = iconHref;
  }, [data?.settings]);

  const standings = useMemo(() => {
    if (!data || !Array.isArray(data.teams)) return [];
    return computeStandings(data.teams, Array.isArray(data.matches) ? data.matches : []);
  }, [data]);

  const handleNavigate = (tab: NavTab, subTab?: string) => {
    setActiveTab(tab);
    if (tab === 'galeria' && (subTab === 'videos' || subTab === 'campeones')) {
      setGallerySubTab(subTab);
    }
    if (tab === 'partidos') {
      if (
        subTab === 'validated' ||
        subTab === 'fixtures' ||
        subTab === 'pending' ||
        subTab === 'mine' ||
        subTab === 'submit' ||
        subTab === 'claims'
      ) {
        setMatchesSubTab(subTab);
      } else {
        setMatchesSubTab('validated');
      }
    }
    if (tab === 'perfil') {
      if (
        subTab === 'equipos' ||
        subTab === 'copa' ||
        subTab === 'cruces' ||
        subTab === 'validacion' ||
        subTab === 'reclamos' ||
        subTab === 'archivos' ||
        subTab === 'reglamento' ||
        subTab === 'musica' ||
        subTab === 'videos' ||
        subTab === 'campeones' ||
        subTab === 'general'
      ) {
        setProfileSubTab(subTab);
      } else {
        setProfileSubTab(undefined);
      }
    }
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const handleAuthSuccess = async (_user: AuthUser) => {
    await fetchBootstrap();
  };

  const handleLogout = async () => {
    setStoredToken(null);
    await fetchBootstrap();
  };

  const navItems: { id: NavTab; label: string }[] = [
    { id: 'inicio', label: 'Inicio' },
    { id: 'posiciones', label: 'Posiciones' },
    { id: 'partidos', label: 'Partidos' },
    { id: 'calendario', label: 'Calendario' },
    { id: 'galeria', label: 'Galería' },
    { id: 'reglamento', label: 'Reglamento' },
    { id: 'perfil', label: 'Mi Perfil' },
  ];

  const introIcon = data?.settings.faviconUrl || data?.settings.crestUrl || DEFAULT_ICON;

  return (
    <div className="relative min-h-screen flex flex-col bg-[#050608] text-white pb-8">
      {/* Fondo de pantalla completo optimizado para scroll fluido */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{
          backgroundImage: `url('${data?.settings.backgroundUrl || PAGE_BACKGROUND_IMAGE}')`,
        }}
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 z-0 bg-gradient-to-b from-[#040507]/88 via-[#090B10]/82 to-[#040507]/92 pointer-events-none"
        aria-hidden="true"
      />

      {showIntro && (
        <FireworksIntro
          iconUrl={introIcon}
          title={data?.settings.title || 'Liga Master Argentina Pes6'}
          subtitle={data?.settings.subtitle || '(1°Temporada 2026) THE DEN PATCH'}
          onFinish={() => setShowIntro(false)}
        />
      )}

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-gradient-to-r from-[#06070A]/96 via-[#0E1118]/96 to-[#06070A]/96 border-b border-amber-400/55 shadow-[0_10px_30px_rgba(0,0,0,0.85)]">
        <div className="h-1 w-full albiceleste-ribbon" aria-hidden="true" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => handleNavigate('inicio')}
            className="flex items-center gap-2 text-left whitespace-nowrap shrink-0"
          >
            <span className="font-display text-xl sm:text-2xl xl:text-3xl font-extrabold tracking-tight text-albiceleste-shiny whitespace-nowrap shrink-0">
              Liga Master Argentina
            </span>
            <img
              src={maradonaMascotImg}
              alt="Diego Maradona chiquito con camiseta de Argentina y pelota clásica"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-cover border border-amber-400/75 shadow-md shadow-black/60 shrink-0"
            />
          </button>

          <nav className="hidden lg:flex items-center gap-4 xl:gap-5">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  className={`py-1.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'text-amber-300 border-amber-400'
                      : 'text-zinc-200/90 border-transparent hover:text-white hover:border-zinc-300/70'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <img
              src={messiMascotImg}
              alt="Leo Messi chiquito con camiseta de Argentina y pelota clásica"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-cover border border-zinc-300/65 shadow-md shadow-black/60 shrink-0"
            />

            {/* Fecha actual y hora en tiempo real al lado de Ingresar a Cuenta */}
            <LiveClock onClick={() => handleNavigate('calendario')} />

            {data?.user ? (
              <button
                type="button"
                onClick={() => handleNavigate('perfil')}
                className="px-3.5 py-2 text-xs font-bold btn-gold-luxury rounded-lg transition-all whitespace-nowrap shrink-0"
              >
                {data.user.role === 'admin' ? 'Panel Admin' : data.user.id}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="px-3.5 py-2 text-xs font-bold btn-gold-luxury rounded-lg transition-all whitespace-nowrap shrink-0"
              >
                Ingresar a Cuenta
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Abrir menú"
              className="lg:hidden p-2 text-zinc-200 hover:text-white rounded-lg border border-zinc-400/45 bg-[#0B0D12]"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav className="lg:hidden border-t border-zinc-700/60 bg-[#08090D] px-4 py-3 grid grid-cols-2 gap-2">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  className={`px-3 py-2.5 text-left text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-amber-400/15 text-amber-200 border border-amber-400/60'
                      : 'text-zinc-200 hover:bg-white/10'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {resetPageState.active ? (
          <ResetPasswordView
            oobCode={resetPageState.oobCode}
            onComplete={handleExitResetPage}
          />
        ) : loading && !data ? (
          <div className="space-y-6 animate-pulse">
            <div className="h-80 rounded-2xl bg-[#0B0D12]/90 border border-zinc-400/30" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="h-24 rounded-xl bg-[#0B0D12]/90 border border-zinc-400/25" />
              <div className="h-24 rounded-xl bg-[#0B0D12]/90 border border-zinc-400/25" />
              <div className="h-24 rounded-xl bg-[#0B0D12]/90 border border-zinc-400/25" />
              <div className="h-24 rounded-xl bg-[#0B0D12]/90 border border-zinc-400/25" />
            </div>
          </div>
        ) : loadError && !data ? (
          <div className="p-8 bg-[#0B0D12]/95 border border-amber-400/50 rounded-2xl text-center space-y-3">
            <h2 className="font-display text-2xl font-bold text-albiceleste-shiny">
              No se pudo cargar la liga
            </h2>
            <p className="text-sm text-rose-300">{loadError}</p>
            <button
              type="button"
              onClick={fetchBootstrap}
              className="px-4 py-2 text-xs font-bold btn-gold-luxury rounded-lg"
            >
              Reintentar
            </button>
          </div>
        ) : (
          data && (
            <>
              {activeTab === 'inicio' && (
                <HomeView
                  settings={data.settings}
                  teams={data.teams}
                  standings={standings}
                  matches={data.matches}
                  fixtures={data.fixtures || []}
                  calendarEvents={data.calendarEvents || []}
                  champions={data.champions}
                  videos={data.videos}
                  communityVideos={communityVideos}
                  loadingCommunity={loadingCommunity}
                  cup={data.cup}
                  user={data.user}
                  onNavigate={handleNavigate}
                  onRefresh={fetchBootstrap}
                  onReplayIntro={() => setShowIntro(true)}
                />
              )}

              {activeTab === 'posiciones' && (
                <StandingsView
                  standings={standings}
                  maxTeams={data.settings.maxTeams}
                  user={data.user}
                  onOpenAuth={() => setAuthModalOpen(true)}
                  onRefresh={fetchBootstrap}
                />
              )}

              {activeTab === 'partidos' && (
                <MatchesView
                  matches={data.matches}
                  fixtures={data.fixtures || []}
                  claims={data.claims || []}
                  teams={data.teams}
                  user={data.user}
                  initialSubTab={matchesSubTab}
                  onOpenAuth={() => setAuthModalOpen(true)}
                  onRefresh={fetchBootstrap}
                />
              )}

              {activeTab === 'calendario' && (
                <CalendarView
                  calendarEvents={data.calendarEvents || []}
                  cup={data.cup}
                  fixtures={data.fixtures || []}
                  teams={data.teams}
                  user={data.user}
                  onRefresh={fetchBootstrap}
                  onOpenCup={() => handleNavigate('perfil', 'copa')}
                />
              )}

              {activeTab === 'galeria' && (
                <GalleryView
                  key={gallerySubTab}
                  videos={data.videos}
                  communityVideos={communityVideos}
                  loadingCommunity={loadingCommunity}
                  firestoreError={firestoreError}
                  featuredVideoId={data.settings.featuredVideo?.id}
                  champions={data.champions}
                  user={data.user}
                  initialSubTab={gallerySubTab}
                  onOpenAuth={() => setAuthModalOpen(true)}
                  onRefresh={fetchBootstrap}
                />
              )}

              {activeTab === 'reglamento' && <RulesView rules={data.rules} />}

              {activeTab === 'perfil' && (
                <ProfileView
                  user={data.user}
                  settings={data.settings}
                  teams={data.teams}
                  adminTeams={data.adminTeams || []}
                  standings={standings}
                  matches={data.matches}
                  fixtures={data.fixtures || []}
                  claims={data.claims || []}
                  rules={data.rules}
                  music={data.music}
                  videos={data.videos}
                  communityVideos={communityVideos}
                  champions={data.champions}
                  cup={data.cup}
                  initialAdminTab={profileSubTab}
                  onOpenAuth={() => setAuthModalOpen(true)}
                  onLogout={handleLogout}
                  onRefresh={fetchBootstrap}
                  onNavigate={handleNavigate}
                />
              )}
            </>
          )
        )}
      </main>

      {/* Footer Negro, Dorado y Plateado con toques Liga */}
      <footer className="relative z-10 border-t border-amber-400/50 bg-gradient-to-r from-[#06070A]/96 via-[#0E1118]/96 to-[#06070A]/96 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col lg:flex-row items-center justify-between gap-4 text-xs text-zinc-200">
          <div className="text-center lg:text-left">
            <span className="font-semibold text-silver-shiny">
              {data?.settings.title || 'Liga Master Argentina Pes6'}
            </span>{' '}
            ·{' '}
            <span className="font-semibold text-amber-300">
              {data?.settings.subtitle || '(1°Temporada 2026) THE DEN PATCH'}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <span className="text-zinc-200 font-medium">
              Siguenos en nuestras redes sociales. Gracias Te queremos.
            </span>
            <div className="flex items-center gap-2.5">
              <a
                href="https://www.facebook.com/profile.php?id=61592685431765"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="p-2 rounded-lg bg-[#1877F2]/20 hover:bg-[#1877F2]/40 border border-[#1877F2]/40 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#4C9BFF]" aria-hidden="true">
                  <path d="M22.675 0H1.325C.593 0 0 .593 0 1.325v21.351C0 23.407.593 24 1.325 24H12.82v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116c.73 0 1.323-.593 1.323-1.325V1.325C24 .593 23.407 0 22.675 0z" />
                </svg>
              </a>
              <a
                href="https://www.youtube.com/channel/UClCVRB-u2ZNJJdIXTyi7DjQ"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube"
                className="p-2 rounded-lg bg-[#FF0000]/20 hover:bg-[#FF0000]/40 border border-[#FF0000]/40 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#FF4E45]" aria-hidden="true">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
              <a
                href="https://chat.whatsapp.com/IA8EyaupDRIKXpLJiTeF8X?s=cl&p=a&iam=2"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="p-2 rounded-lg bg-[#25D366]/20 hover:bg-[#25D366]/40 border border-[#25D366]/40 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#25D366]" aria-hidden="true">
                  <path d="M20.52 3.48A11.87 11.87 0 0 0 12.05 0C5.5 0 .16 5.33.16 11.89c0 2.1.55 4.14 1.59 5.95L0 24l6.33-1.66a11.88 11.88 0 0 0 5.71 1.45h.01c6.55 0 11.89-5.34 11.89-11.9 0-3.17-1.24-6.16-3.42-8.41zM12.05 21.78h-.01a9.86 9.86 0 0 1-5.02-1.37l-.36-.21-3.75.98 1-3.66-.23-.38a9.87 9.87 0 0 1-1.51-5.25c0-5.46 4.44-9.9 9.9-9.9 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.9 7c0 5.45-4.45 9.89-9.91 9.89zm5.43-7.41c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.08-.8.37-.27.3-1.04 1.02-1.04 2.49 0 1.47 1.07 2.89 1.22 3.09.15.2 2.1 3.21 5.09 4.5.71.31 1.27.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35z" />
                </svg>
              </a>
            </div>
            <button
              type="button"
              onClick={() => setShowIntro(true)}
              className="font-semibold text-amber-300 hover:text-amber-200 transition-colors"
            >
              Ver Intro con Fuegos Artificiales
            </button>
          </div>
        </div>
      </footer>

      {data && (
        <MusicBar
          tracks={data.music}
          radioName={data.settings.radioName}
          radioStreamUrl={data.settings.radioStreamUrl}
          isAdmin={data.user?.role === 'admin'}
          introActive={showIntro}
          onRefresh={fetchBootstrap}
        />
      )}

      <AuthModal
        open={authModalOpen}
        prefillId={prefillAuthId}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
