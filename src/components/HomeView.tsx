import { useState } from 'react';
import { ArrowRight, CalendarDays, Film, ShieldAlert, ShieldCheck, Sparkles, Star, Trophy } from 'lucide-react';
import defaultChampImg from '../assets/images/champion_celebration_default_1794642902876.jpg';

const defaultCrestImg = '/assets/aistudio/Liga_Master_Argentina__F_tbol_de__lite_eeeab9aa.png';
const defaultCoverImg = '/assets/aistudio/_Liga_master_argentina_PES6._36522b75.png';
import type {
  AuthUser,
  CalendarEvent,
  ChampionEntry,
  CommunityVideo,
  CupTournament,
  FeaturedVideoSelection,
  GalleryVideo,
  LeagueSettings,
  Match,
  PublicTeam,
  ScheduledFixture,
  StandingRow,
} from '../types';
import { apiFetch } from '../utils/api';
import { CupBracketCard } from './CupBracketCard';
import { ResilientImage } from './ResilientImage';

export type NavTab =
  | 'inicio'
  | 'posiciones'
  | 'partidos'
  | 'calendario'
  | 'galeria'
  | 'reglamento'
  | 'perfil';

interface HomeViewProps {
  settings: LeagueSettings;
  teams: PublicTeam[];
  standings: StandingRow[];
  matches: Match[];
  fixtures?: ScheduledFixture[];
  calendarEvents?: CalendarEvent[];
  champions: ChampionEntry[];
  videos: GalleryVideo[];
  communityVideos: CommunityVideo[];
  loadingCommunity: boolean;
  cup: CupTournament;
  user: AuthUser | null;
  onNavigate: (tab: NavTab, subTab?: string) => void;
  onRefresh: () => Promise<void>;
  onReplayIntro: () => void;
}

export function HomeView({
  settings,
  teams,
  standings,
  matches,
  fixtures = [],
  calendarEvents = [],
  champions,
  videos,
  communityVideos,
  loadingCommunity,
  cup,
  user,
  onNavigate,
  onRefresh,
  onReplayIntro,
}: HomeViewProps) {
  const [updatingFeatured, setUpdatingFeatured] = useState(false);

  const cupScheduledCount =
    cup.matches.filter((m) => Boolean(m.scheduledDate)).length +
    (cup.recopa?.scheduledDate ? 1 : 0);
  const totalCalendarCount =
    calendarEvents.length +
    cupScheduledCount +
    fixtures.filter((f) => Boolean(f.scheduledDate)).length;

  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const validatedMatches = matches.filter((m) => m.status === 'validated').slice(0, 4);
  const pendingCount = matches.filter((m) => m.status === 'pending').length;
  const topFive = standings.slice(0, 5);
  const latestChampion = champions[0];

  const allVideos: FeaturedVideoSelection[] = [
    ...communityVideos.map((cv) => ({
      id: cv.id,
      source: 'community' as const,
      title: cv.titulo,
      author: cv.autor,
      videoUrl: cv.videoUrl,
      downloadUrl: cv.videoUrl,
      fechaLabel: cv.fechaLabel,
    })),
    ...videos.map((v) => ({
      id: v.id,
      source: 'local' as const,
      title: v.title,
      author: v.uploadedBy,
      videoUrl: v.videoUrl,
      downloadUrl: v.downloadUrl,
      originalFormat: v.originalFormat,
    })),
  ];

  const resolveFeaturedVideo = (): {
    video: FeaturedVideoSelection | null;
    isAdminFavorite: boolean;
  } => {
    const saved = settings.featuredVideo;
    if (saved) {
      if (saved.source === 'community') {
        const liveMatch = communityVideos.find((cv) => cv.id === saved.id);
        if (liveMatch) {
          return {
            video: {
              id: liveMatch.id,
              source: 'community',
              title: liveMatch.titulo,
              author: liveMatch.autor,
              videoUrl: liveMatch.videoUrl,
              downloadUrl: liveMatch.videoUrl,
              fechaLabel: liveMatch.fechaLabel,
            },
            isAdminFavorite: true,
          };
        }
        if (loadingCommunity) {
          return { video: saved, isAdminFavorite: true };
        }
      } else {
        const localMatch = videos.find((v) => v.id === saved.id);
        if (localMatch) {
          return {
            video: {
              id: localMatch.id,
              source: 'local',
              title: localMatch.title,
              author: localMatch.uploadedBy,
              videoUrl: localMatch.videoUrl,
              downloadUrl: localMatch.downloadUrl,
              originalFormat: localMatch.originalFormat,
            },
            isAdminFavorite: true,
          };
        }
      }
    }

    const legacyFeatured = videos.find((v) => v.featured);
    if (legacyFeatured) {
      return {
        video: {
          id: legacyFeatured.id,
          source: 'local',
          title: legacyFeatured.title,
          author: legacyFeatured.uploadedBy,
          videoUrl: legacyFeatured.videoUrl,
          downloadUrl: legacyFeatured.downloadUrl,
          originalFormat: legacyFeatured.originalFormat,
        },
        isAdminFavorite: true,
      };
    }

    if (allVideos.length > 0) {
      return { video: allVideos[0], isAdminFavorite: false };
    }

    return { video: null, isAdminFavorite: false };
  };

  const { video: featuredVideo, isAdminFavorite } = resolveFeaturedVideo();
  const totalVideosCount = communityVideos.length + videos.length;
  const featuredLocalMeta =
    featuredVideo?.source === 'local'
      ? videos.find((v) => v.id === featuredVideo.id)
      : undefined;

  const handleSelectFeaturedVideo = async (videoId: string) => {
    const selected = allVideos.find((v) => v.id === videoId);
    if (!selected) return;
    setUpdatingFeatured(true);
    try {
      await apiFetch('/api/admin/featured-video', {
        method: 'PUT',
        body: JSON.stringify(selected),
      });
      await onRefresh();
    } finally {
      setUpdatingFeatured(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero Negro Ónix, Oro & Plata con Escudo y Título encima de la Portada + toques Celeste/Blanco/Verde */}
      <section className="rounded-2xl overflow-hidden bg-[#0B0D12]/96 border border-amber-400/65 shadow-[0_24px_50px_rgba(0,0,0,0.9),0_0_28px_rgba(250,204,21,0.12)]">
        <div className="h-1.5 w-full albiceleste-ribbon" aria-hidden="true" />

        {/* Cabecera Oficial encima de la Foto de Portada: Escudo Redondo + Título 3D Celeste y Blanco + Oro/Plata */}
        <div className="px-5 py-5 sm:px-8 sm:py-6 bg-gradient-to-r from-[#06070A] via-[#11151E] to-[#06070A] border-b border-zinc-400/35 flex flex-col sm:flex-row items-center gap-4 sm:gap-7 text-center sm:text-left">
          <div className="p-[3px] rounded-full bg-gradient-to-b from-[#FEF08A] via-[#E2E8F0] to-[#B45309] shrink-0 shadow-[0_12px_32px_rgba(250,204,21,0.3),0_4px_12px_rgba(0,0,0,0.9)]">
            <div className="p-1 rounded-full bg-[#08090D] border-2 border-emerald-400/55">
              <div className="w-24 h-24 sm:w-32 sm:h-32 lg:w-36 lg:h-36 rounded-full overflow-hidden bg-[#050608] shadow-inner">
                <ResilientImage
                  src={settings.crestUrl}
                  fallbackSrc={defaultCrestImg}
                  alt="Escudo Oficial Liga Master Argentina PES6"
                  className="w-full h-full object-cover"
                  fallbackLabel="LMA PES6"
                />
              </div>
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-wide leading-[1.05] uppercase text-albiceleste-3d">
              {settings.title}
            </h1>
            <p className="font-display text-sm sm:text-xl font-extrabold tracking-[0.2em] uppercase text-gold-shiny">
              {settings.subtitle}
            </p>
          </div>
        </div>

        {/* Foto de Portada debajo del Escudo y del Título, sin tapar la bandera */}
        <div className="relative aspect-[16/9] w-full bg-[#050608] overflow-hidden border-b border-amber-400/45">
          <ResilientImage
            src={settings.coverUrl}
            fallbackSrc={defaultCoverImg}
            alt="La Cabra con la camiseta de Argentina Messi abrazando la Copa del Mundo frente a la tribuna de Liga Master Argentina"
            className="w-full h-full object-cover brightness-[1.05] contrast-[1.04]"
            fallbackLabel="Esto es Liga Master Argentina"
          />
          <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/30 via-transparent to-transparent pointer-events-none" />
        </div>

        {/* Barra de Acciones Abajo de la Foto de Portada */}
        <div className="px-6 py-5 sm:px-10 bg-gradient-to-r from-[#06070A] via-[#10131A] to-[#06070A] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-display text-lg sm:text-2xl font-extrabold tracking-wider uppercase text-silver-shiny">
            {settings.bannerText}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('partidos')}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm btn-gold-luxury rounded-xl whitespace-nowrap"
            >
              <span>Ver Partidos</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('calendario')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-emerald-200 bg-emerald-950/55 hover:bg-emerald-900/65 border border-emerald-400/55 rounded-xl transition-colors whitespace-nowrap"
            >
              <CalendarDays className="w-4 h-4 text-emerald-300" />
              <span>Calendario ({totalCalendarCount})</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('posiciones')}
              className="px-4 py-2.5 text-sm btn-celeste-gold rounded-xl transition-all whitespace-nowrap"
            >
              Posiciones
            </button>
            <button
              type="button"
              onClick={() => onNavigate('partidos', 'claims')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-semibold text-zinc-100 bg-[#141720] hover:bg-[#1C202C] border border-zinc-400/40 rounded-xl transition-colors whitespace-nowrap"
            >
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Reclamos</span>
            </button>
            <button
              type="button"
              onClick={onReplayIntro}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-semibold text-zinc-100 bg-[#0B0D12] hover:bg-[#161923] border border-amber-400/50 rounded-xl transition-colors whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Fuegos</span>
            </button>
          </div>
        </div>
      </section>

      {/* Video Más Destacado Publicado */}
      <section className="bg-[#0B0D12]/95 border border-zinc-400/35 rounded-2xl overflow-hidden shadow-xl shadow-black/70">
        <div className="px-6 py-4 border-b border-amber-400/30 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-[#08090D] via-[#121620] to-[#08090D]">
          <div className="flex items-center gap-2.5">
            <Star className="w-4 h-4 text-amber-300" />
            <h2 className="font-display text-2xl font-bold text-silver-shiny">
              Video Más Destacado
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {user?.role === 'admin' && allVideos.length > 0 && (
              <div className="flex items-center gap-2">
                <label
                  htmlFor="featured-video-select"
                  className="text-xs font-semibold text-amber-300 whitespace-nowrap"
                >
                  Elegir favorito:
                </label>
                <select
                  id="featured-video-select"
                  disabled={updatingFeatured}
                  value={featuredVideo?.id || ''}
                  onChange={(e) => handleSelectFeaturedVideo(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-[#041224] text-white border border-amber-400/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 max-w-[260px]"
                >
                  {allVideos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title} — {v.author}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => onNavigate('galeria', 'videos')}
              className="text-xs font-semibold text-sky-200 hover:text-amber-300 transition-colors whitespace-nowrap"
            >
              Ver todos los videos en Galería ({totalVideosCount}) →
            </button>
          </div>
        </div>

        {featuredVideo ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 items-center">
            <div className="lg:col-span-7 aspect-video rounded-xl overflow-hidden bg-[#041224] border border-amber-400/45">
              <video
                key={featuredVideo.videoUrl}
                controls
                playsInline
                preload="metadata"
                className="w-full h-full object-contain"
                src={featuredVideo.videoUrl}
              >
                <source src={featuredVideo.videoUrl} type="video/mp4" />
                Tu navegador no soporta reproducción directa.
              </video>
            </div>
            <div className="lg:col-span-5 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-sky-200">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-sky-400/15 border border-amber-400/55 text-white font-semibold">
                  <Star className="w-3 h-3 fill-amber-300 text-amber-300" />
                  <span>{isAdminFavorite ? 'Favorito del Administrador' : 'Último Gol Subido'}</span>
                </span>
                {featuredVideo.originalFormat && <span>{featuredVideo.originalFormat}</span>}
                <span>· Subido por {featuredVideo.author}</span>
                {featuredVideo.fechaLabel && <span>· {featuredVideo.fechaLabel}</span>}
              </div>
              <h3 className="font-display text-3xl font-extrabold text-albiceleste-shiny">
                {featuredVideo.title}
              </h3>
              {featuredLocalMeta?.description && (
                <p className="text-sm text-sky-100/85 leading-relaxed">
                  {featuredLocalMeta.description}
                </p>
              )}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('galeria', 'videos')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs btn-gold-luxury rounded-lg"
                >
                  <Film className="w-4 h-4" />
                  <span>Ir a Galería Completa</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-sky-400/15 border border-amber-400/50 text-sky-200 flex items-center justify-center shrink-0">
                <Film className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">
                  Todavía no hay videos publicados
                </div>
                <div className="text-xs text-sky-100/75">
                  Cuando los miembros suban un gol en formato .MP4 en la Galería, el Administrador podrá elegir su favorito para destacarlo aquí en el Inicio.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('galeria', 'videos')}
              className="px-4 py-2 text-xs btn-gold-luxury rounded-lg whitespace-nowrap"
            >
              Subir Primer Video .MP4
            </button>
          </div>
        )}
      </section>

      {/* 4-Column Black, Gold, Silver & League KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-[#0B0D12]/95 border border-zinc-400/30 rounded-xl shadow-lg">
          <div className="text-xs font-medium text-zinc-400">Equipos Inscriptos</div>
          <div className="mt-1 font-display text-3xl font-bold text-silver-shiny tabular-nums">
            {teams.length} / {settings.maxTeams}
          </div>
          <div className="mt-1 text-xs text-amber-300 font-medium">Cupos de Primera División</div>
        </div>

        <div className="p-5 bg-[#0B0D12]/95 border border-zinc-400/30 rounded-xl shadow-lg">
          <div className="text-xs font-medium text-zinc-400">Partidos Oficiales</div>
          <div className="mt-1 font-display text-3xl font-bold text-silver-shiny tabular-nums">
            {matches.filter((m) => m.status === 'validated').length}
          </div>
          <div className="mt-1 text-xs text-emerald-400 font-medium">Validados por Admin</div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('calendario')}
          className="p-5 bg-[#0B0D12]/95 border border-emerald-400/35 hover:border-amber-400/70 rounded-xl text-left transition-colors shadow-lg"
        >
          <div className="text-xs font-medium text-zinc-400">Calendario & Copa</div>
          <div className="mt-1 font-display text-3xl font-bold text-gold-shiny tabular-nums">
            {totalCalendarCount}
          </div>
          <div className="mt-1 text-xs text-emerald-300 font-medium">
            {cupScheduledCount > 0
              ? `${cupScheduledCount} fechas de Copa agendadas →`
              : 'Ver calendario en vivo →'}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('partidos', pendingCount > 0 ? 'pending' : 'validated')}
          className="p-5 bg-[#0B0D12]/95 border border-amber-400/35 hover:border-amber-300 rounded-xl text-left transition-colors shadow-lg"
        >
          <div className="text-xs font-medium text-zinc-400">En Cola de Revisión</div>
          <div className="mt-1 font-display text-3xl font-bold text-silver-shiny tabular-nums">
            {pendingCount}
          </div>
          <div className="mt-1 text-xs text-amber-300 font-medium">
            {user?.role === 'admin' && pendingCount > 0
              ? 'Ir a validar resultados →'
              : 'Esperando validación'}
          </div>
        </button>
      </section>

      {/* Row 1: Top 5 Standings + Recent Matches */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 bg-[#0B0D12]/95 border border-zinc-400/35 rounded-2xl overflow-hidden shadow-xl shadow-black/70">
          <div className="px-6 py-4 border-b border-amber-400/30 flex items-center justify-between bg-gradient-to-r from-[#08090D] via-[#121620] to-[#08090D]">
            <div>
              <h2 className="font-display text-2xl font-bold text-gold-shiny">
                Punteros del Torneo
              </h2>
              <p className="text-xs text-zinc-400">
                Clasificación oficial actualizada tras cada validación
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('posiciones')}
              className="text-xs font-semibold text-amber-300 hover:text-amber-200 transition-colors whitespace-nowrap"
            >
              Ver los {teams.length} equipos →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700/70 text-xs font-semibold text-zinc-300 bg-[#06070A]">
                  <th className="py-3 pl-6 pr-2 text-left w-10">#</th>
                  <th className="py-3 px-3 text-left">Club</th>
                  <th className="py-3 px-2 text-right">PJ</th>
                  <th className="py-3 px-2 text-right">DG</th>
                  <th className="py-3 pl-2 pr-6 text-right text-amber-300">PTS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {topFive.map((row) => (
                  <tr key={row.team.id} className="hover:bg-white/[0.04] transition-colors">
                    <td className="py-3 pl-6 pr-2 font-mono text-xs font-bold text-amber-300 tabular-nums">
                      {row.position}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <ResilientImage
                          src={row.team.crestUrl}
                          alt={`Escudo ${row.team.name}`}
                          className="w-8 h-8 rounded-md object-contain bg-[#06070A] border border-zinc-400/40 p-0.5 shrink-0"
                          fallbackLabel={row.team.id}
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-white truncate">
                            {row.team.name}
                          </div>
                          <div className="text-xs text-zinc-400 truncate">
                            DT: {row.team.memberName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-zinc-200 tabular-nums">
                      {row.pj}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-zinc-200 tabular-nums">
                      {row.dg > 0 ? `+${row.dg}` : row.dg}
                    </td>
                    <td className="py-3 pl-2 pr-6 text-right font-mono font-bold text-amber-300 tabular-nums">
                      {row.pts}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#0B0D12]/95 border border-zinc-400/35 rounded-2xl overflow-hidden shadow-xl shadow-black/70">
          <div className="px-6 py-4 border-b border-amber-400/30 flex items-center justify-between bg-gradient-to-r from-[#08090D] via-[#121620] to-[#08090D]">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-amber-300" />
              <h2 className="font-display text-2xl font-bold text-silver-shiny">
                Últimos Resultados
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('partidos')}
              className="text-xs font-semibold text-amber-300 hover:text-amber-200 transition-colors whitespace-nowrap"
            >
              Todos →
            </button>
          </div>

          <div className="divide-y divide-zinc-800/80">
            {validatedMatches.length === 0 ? (
              <div className="p-6 text-sm text-zinc-400">
                Todavía no hay resultados oficiales publicados.
              </div>
            ) : (
              validatedMatches.map((m) => {
                const home = teamMap.get(m.homeTeamId);
                const away = teamMap.get(m.awayTeamId);
                return (
                  <div key={m.id} className="px-6 py-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <ResilientImage
                        src={home?.crestUrl}
                        alt={home?.name || m.homeTeamId}
                        className="w-6 h-6 object-contain shrink-0"
                      />
                      <span className="text-sm font-semibold text-white truncate">
                        {home?.name || m.homeTeamId}
                      </span>
                    </div>

                    <div className="px-3 py-1 rounded-lg bg-[#06070A] border border-amber-400/50 text-amber-300 font-mono text-sm font-bold tabular-nums shrink-0">
                      {m.homeGoals} - {m.awayGoals}
                    </div>

                    <div className="flex items-center justify-end gap-2 min-w-0 flex-1">
                      <span className="text-sm font-semibold text-white truncate text-right">
                        {away?.name || m.awayTeamId}
                      </span>
                      <ResilientImage
                        src={away?.crestUrl}
                        alt={away?.name || m.awayTeamId}
                        className="w-6 h-6 object-contain shrink-0"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Row 2: Cuadrado de Llaves de la Copa de la Liga (16 equipos) al lado de Historial de Campeones */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8">
          <CupBracketCard
            cup={cup}
            isAdmin={user?.role === 'admin'}
            onEditCup={() => onNavigate('perfil', 'copa')}
            onGoToChampionsUpload={() => onNavigate('galeria', 'campeones')}
            onGoToRules={() => onNavigate('reglamento')}
            onRefresh={onRefresh}
          />
        </div>

        <div className="lg:col-span-4">
          {latestChampion ? (
            <div className="bg-[#0B0D12]/95 border border-amber-400/45 rounded-2xl overflow-hidden h-full flex flex-col shadow-xl shadow-black/70">
              <div className="px-6 py-4 border-b border-amber-400/30 flex items-center justify-between bg-gradient-to-r from-[#08090D] via-[#121620] to-[#08090D]">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-300" />
                  <h2 className="font-display text-2xl font-bold text-gold-shiny">
                    Historial de Campeones
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('galeria', 'campeones')}
                  className="text-xs font-semibold text-amber-300 hover:text-amber-200 transition-colors whitespace-nowrap"
                >
                  Subir festejo PNG →
                </button>
              </div>
              <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                <div className="aspect-[4/3] w-full rounded-xl overflow-hidden bg-[#06070A] border border-zinc-400/35">
                  <ResilientImage
                    src={latestChampion.celebrationImageUrl}
                    fallbackSrc={defaultChampImg}
                    alt={`Festejo campeón ${latestChampion.teamName}`}
                    className="w-full h-full object-cover"
                    fallbackLabel={latestChampion.teamName}
                  />
                </div>
                <div>
                  <div className="text-xs font-medium text-amber-300">
                    {latestChampion.tournamentType === 'copa'
                      ? 'Copa de la Liga · '
                      : latestChampion.tournamentType === 'recopa'
                      ? 'Recopa (Gran Campeón) · '
                      : ''}
                    {latestChampion.season}
                  </div>
                  <div className="font-display text-xl font-bold text-silver-shiny">
                    {latestChampion.teamName}
                  </div>
                  <div className="text-xs text-zinc-400">
                    DT: {latestChampion.memberName}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#0B0D12]/95 border border-amber-400/45 rounded-2xl p-6 h-full flex flex-col justify-center items-center text-center gap-3 shadow-xl shadow-black/70">
              <Trophy className="w-8 h-8 text-amber-300" />
              <h2 className="font-display text-2xl font-bold text-gold-shiny">
                Historial de Campeones
              </h2>
              <p className="text-xs text-zinc-300">
                Subí la celebración oficial de los campeones de Liga y Copa de la Liga.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('galeria', 'campeones')}
                className="px-4 py-2 text-xs btn-gold-luxury rounded-lg"
              >
                Subir festejo PNG
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="p-6 bg-[#0B0D12]/95 border border-zinc-400/35 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-silver-shiny">
              Resultados Validados por el Administrador
            </h3>
            <p className="text-xs text-zinc-300 mt-0.5">
              Los miembros cargan sus partidos con foto del resultado y del goleador; el Administrador valida y verifica cada archivo antes de publicarlo en la tabla oficial.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('perfil')}
          className="px-4 py-2 text-xs btn-celeste-gold rounded-lg transition-all whitespace-nowrap shrink-0"
        >
          Mi Perfil / Acceso
        </button>
      </section>

      {/* Redes Sociales Oficiales */}
      <section className="p-6 bg-gradient-to-r from-[#08090D] via-[#121620] to-[#08090D] border border-amber-400/45 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-5 shadow-xl shadow-black/70">
        <div className="text-center md:text-left">
          <h3 className="font-display text-2xl font-extrabold text-gold-shiny">
            Siguenos en nuestras redes sociales. Gracias Te queremos.
          </h3>
          <p className="text-xs text-zinc-300 mt-1">
            Sumate al grupo oficial, mirá los mejores resúmenes y enterate de todas las fechas.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
          <a
            href="https://www.facebook.com/profile.php?id=61592685431765"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook oficial Liga Master Argentina"
            className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#1877F2]/20 hover:bg-[#1877F2]/35 border border-[#1877F2]/50 text-white text-xs font-bold transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#4C9BFF]" aria-hidden="true">
              <path d="M22.675 0H1.325C.593 0 0 .593 0 1.325v21.351C0 23.407.593 24 1.325 24H12.82v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116c.73 0 1.323-.593 1.323-1.325V1.325C24 .593 23.407 0 22.675 0z" />
            </svg>
            <span>Facebook</span>
          </a>

          <a
            href="https://www.youtube.com/channel/UClCVRB-u2ZNJJdIXTyi7DjQ"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="YouTube oficial Liga Master Argentina"
            className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#FF0000]/20 hover:bg-[#FF0000]/35 border border-[#FF0000]/50 text-white text-xs font-bold transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#FF4E45]" aria-hidden="true">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
            <span>YouTube</span>
          </a>

          <a
            href="https://chat.whatsapp.com/IA8EyaupDRIKXpLJiTeF8X?s=cl&p=a&iam=2"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Grupo oficial WhatsApp Liga Master Argentina"
            className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#25D366]/20 hover:bg-[#25D366]/35 border border-[#25D366]/50 text-white text-xs font-bold transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#25D366]" aria-hidden="true">
              <path d="M20.52 3.48A11.87 11.87 0 0 0 12.05 0C5.5 0 .16 5.33.16 11.89c0 2.1.55 4.14 1.59 5.95L0 24l6.33-1.66a11.88 11.88 0 0 0 5.71 1.45h.01c6.55 0 11.89-5.34 11.89-11.9 0-3.17-1.24-6.16-3.42-8.41zM12.05 21.78h-.01a9.86 9.86 0 0 1-5.02-1.37l-.36-.21-3.75.98 1-3.66-.23-.38a9.87 9.87 0 0 1-1.51-5.25c0-5.46 4.44-9.9 9.9-9.9 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.9 7c0 5.45-4.45 9.89-9.91 9.89zm5.43-7.41c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.08-.8.37-.27.3-1.04 1.02-1.04 2.49 0 1.47 1.07 2.89 1.22 3.09.15.2 2.1 3.21 5.09 4.5.71.31 1.27.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35z" />
            </svg>
            <span>WhatsApp</span>
          </a>
        </div>
      </section>
    </div>
  );
}
