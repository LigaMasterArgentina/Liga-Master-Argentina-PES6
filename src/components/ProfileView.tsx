import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Award,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  Crown,
  Edit3,
  Film,
  Image as ImageIcon,
  KeyRound,
  LogOut,
  Mail,
  Music,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Star,
  Trash2,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import type {
  AuthUser,
  ChampionEntry,
  Claim,
  CommunityVideo,
  CupRulesSettings,
  CupTournament,
  GalleryVideo,
  LeagueSettings,
  Match,
  ModerationStatus,
  MusicTrack,
  PublicTeam,
  RulesConfig,
  ScheduledFixture,
  StandingRow,
  Team,
} from '../types';
import { apiFetch } from '../utils/api';
import { AdminCupPanel } from './AdminCupPanel';
import { ResilientImage } from './ResilientImage';
import type { NavTab } from './HomeView';

export type AdminSection =
  | 'equipos'
  | 'copa'
  | 'cruces'
  | 'validacion'
  | 'reclamos'
  | 'archivos'
  | 'reglamento'
  | 'musica'
  | 'videos'
  | 'campeones'
  | 'general';

interface ProfileViewProps {
  user: AuthUser | null;
  settings: LeagueSettings;
  teams: PublicTeam[];
  adminTeams: Team[];
  standings: StandingRow[];
  matches: Match[];
  fixtures?: ScheduledFixture[];
  claims?: Claim[];
  rules: RulesConfig;
  music: MusicTrack[];
  videos: GalleryVideo[];
  communityVideos: CommunityVideo[];
  champions: ChampionEntry[];
  cup: CupTournament;
  initialAdminTab?: AdminSection;
  onOpenAuth: () => void;
  onLogout: () => void;
  onRefresh: () => Promise<void>;
  onNavigate: (tab: NavTab, subTab?: string) => void;
}

const DEFAULT_CREST = '/assets/aistudio/Liga_Master_Argentina__F_tbol_de__lite_eeeab9aa.png';

const DEFAULT_CUP_RULES: CupRulesSettings = {
  format: 'Eliminación directa (16 equipos: 8°, 4°, Semifinales y Final)',
  extraTime: 'Sí — Tiempo Extra obligatorio en caso de empate',
  penalties: 'Sí — Tanda de Penales si persiste la igualdad tras Tiempo Extra',
  notes:
    'Rigen las mismas reglas básicas de la Liga Master Argentina. El Campeón de la Copa juega la Final de la Recopa frente al Campeón de Liga por el título de Gran Campeón.',
};

export function ProfileView({
  user,
  settings,
  teams,
  adminTeams,
  standings,
  matches,
  fixtures = [],
  claims = [],
  rules,
  music,
  videos,
  communityVideos,
  champions,
  cup,
  initialAdminTab,
  onOpenAuth,
  onLogout,
  onRefresh,
  onNavigate,
}: ProfileViewProps) {
  const [adminTab, setAdminTab] = useState<AdminSection>(initialAdminTab || 'equipos');

  useEffect(() => {
    if (initialAdminTab) {
      setAdminTab(initialAdminTab);
    }
  }, [initialAdminTab]);

  const myTeam = teams.find((t) => t.id === (user?.teamId || settings.adminTeamId));
  const myStanding = standings.find((s) => s.team.id === myTeam?.id);
  const [bio, setBio] = useState(myTeam?.bio || '');
  const [bioSaved, setBioSaved] = useState(false);

  // Celebration photo for own profile
  const [celebFile, setCelebFile] = useState<File | null>(null);
  const [celebPreview, setCelebPreview] = useState<string | null>(null);
  const celebInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingCeleb, setUploadingCeleb] = useState(false);
  const [celebMsg, setCelebMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!celebFile) {
      setCelebPreview(null);
      return;
    }
    const url = URL.createObjectURL(celebFile);
    setCelebPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [celebFile]);

  // Admin: Scheduled Fixtures ("Cruces por Fecha") state
  const [fxMatchday, setFxMatchday] = useState('1');
  const [fxLeg, setFxLeg] = useState<'Ida' | 'Vuelta'>('Ida');
  const [fxHomeTeamId, setFxHomeTeamId] = useState(teams[0]?.id || '');
  const [fxAwayTeamId, setFxAwayTeamId] = useState(teams[1]?.id || teams[0]?.id || '');
  const [fxDate, setFxDate] = useState('');
  const [fxTime, setFxTime] = useState('21:00');
  const [fxNotes, setFxNotes] = useState('');
  const [savingFx, setSavingFx] = useState(false);
  const [fxMsg, setFxMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Admin: Claims resolution notes state
  const [claimNoteDrafts, setClaimNoteDrafts] = useState<Record<string, string>>({});
  const [claimsMsg, setClaimsMsg] = useState<string | null>(null);
  const [moderationMsg, setModerationMsg] = useState<string | null>(null);

  // Admin: direct participating team editor (escudo, equipo, nombre, bio)
  const [editingMyAdminTeam, setEditingMyAdminTeam] = useState(false);
  const [adminTeamName, setAdminTeamName] = useState(myTeam?.name || '');
  const [adminMemberName, setAdminMemberName] = useState(myTeam?.memberName || '');
  const [adminTeamBio, setAdminTeamBio] = useState(myTeam?.bio || '');
  const [adminCrestFile, setAdminCrestFile] = useState<File | null>(null);
  const [adminCrestPreview, setAdminCrestPreview] = useState<string | null>(null);
  const adminCrestInputRef = useRef<HTMLInputElement | null>(null);
  const [savingAdminMyTeam, setSavingAdminMyTeam] = useState(false);
  const [adminMyTeamMsg, setAdminMyTeamMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setBio(myTeam?.bio || '');
    setAdminTeamName(myTeam?.name || '');
    setAdminMemberName(myTeam?.memberName || '');
    setAdminTeamBio(myTeam?.bio || '');
  }, [myTeam?.id, myTeam?.name, myTeam?.memberName, myTeam?.bio]);

  useEffect(() => {
    if (!adminCrestFile) {
      setAdminCrestPreview(null);
      return;
    }
    const url = URL.createObjectURL(adminCrestFile);
    setAdminCrestPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [adminCrestFile]);

  // Admin: Add/Edit team state
  const [newTeamId, setNewTeamId] = useState('');
  const [newTeamClave, setNewTeamClave] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newTeamBio, setNewTeamBio] = useState('');
  const [newCrestFile, setNewCrestFile] = useState<File | null>(null);
  const [newCrestPreview, setNewCrestPreview] = useState<string | null>(null);
  const newCrestInputRef = useRef<HTMLInputElement | null>(null);
  const [teamMsg, setTeamMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [savingTeam, setSavingTeam] = useState(false);

  // Admin: Inline team edit & search
  const [teamSearch, setTeamSearch] = useState('');
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const editFormRef = useRef<HTMLTableRowElement | null>(null);
  const [editId, setEditId] = useState('');
  const [editClave, setEditClave] = useState('');
  const [editName, setEditName] = useState('');
  const [editMember, setEditMember] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editCrestFile, setEditCrestFile] = useState<File | null>(null);
  const [editCrestPreview, setEditCrestPreview] = useState<string | null>(null);
  const [savingEditTeam, setSavingEditTeam] = useState(false);

  // Admin: Match validation controls
  const [validationFilter, setValidationFilter] = useState<'pending' | 'validated' | 'rejected' | 'all'>('pending');
  const [proofModalUrl, setProofModalUrl] = useState<string | null>(null);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [editHomeGoals, setEditHomeGoals] = useState('0');
  const [editAwayGoals, setEditAwayGoals] = useState('0');
  const [editMatchday, setEditMatchday] = useState('1');
  const [editLeg, setEditLeg] = useState<'Ida' | 'Vuelta'>('Ida');
  const [editPlayedAt, setEditPlayedAt] = useState('');
  const [editMatchNotes, setEditMatchNotes] = useState('');
  const [validationMsg, setValidationMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!newCrestFile) {
      setNewCrestPreview(null);
      return;
    }
    const url = URL.createObjectURL(newCrestFile);
    setNewCrestPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [newCrestFile]);

  useEffect(() => {
    if (!editCrestFile) {
      setEditCrestPreview(null);
      return;
    }
    const url = URL.createObjectURL(editCrestFile);
    setEditCrestPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [editCrestFile]);

  // Admin: Rules state
  const [rulesList, setRulesList] = useState<string[]>(rules.prohibitedRules);
  const [generalNotes, setGeneralNotes] = useState(rules.generalNotes);
  const [gameMode, setGameMode] = useState(rules.gameMode);
  const [cupRules, setCupRules] = useState<CupRulesSettings>(rules.cupRules || DEFAULT_CUP_RULES);
  const [rulesMsg, setRulesMsg] = useState<string | null>(null);

  useEffect(() => {
    setRulesList(rules.prohibitedRules);
    setGeneralNotes(rules.generalNotes);
    setGameMode(rules.gameMode);
    setCupRules(rules.cupRules || DEFAULT_CUP_RULES);
  }, [rules]);

  // Admin: Music state
  const [trackUrl, setTrackUrl] = useState('');
  const [trackFiles, setTrackFiles] = useState<FileList | null>(null);
  const [musicMsg, setMusicMsg] = useState<string | null>(null);
  const [uploadingMusic, setUploadingMusic] = useState(false);

  // Admin: Video editing state
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [editVideoTitle, setEditVideoTitle] = useState('');
  const [editVideoDesc, setEditVideoDesc] = useState('');
  const [videoMsg, setVideoMsg] = useState<string | null>(null);

  // Admin: Champions CRUD state
  const [newChampType, setNewChampType] = useState<'liga' | 'copa' | 'recopa'>('liga');
  const [newChampSeason, setNewChampSeason] = useState('Temporada 2026');
  const [newChampTeam, setNewChampTeam] = useState('');
  const [newChampMember, setNewChampMember] = useState('');
  const [newChampNotes, setNewChampNotes] = useState('');
  const [newChampFile, setNewChampFile] = useState<File | null>(null);
  const newChampInputRef = useRef<HTMLInputElement | null>(null);
  const [savingChamp, setSavingChamp] = useState(false);
  const [champMsg, setChampMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [editingChampId, setEditingChampId] = useState<string | null>(null);
  const [editChampType, setEditChampType] = useState<'liga' | 'copa' | 'recopa'>('liga');
  const [editChampSeason, setEditChampSeason] = useState('');
  const [editChampTeam, setEditChampTeam] = useState('');
  const [editChampMember, setEditChampMember] = useState('');
  const [editChampNotes, setEditChampNotes] = useState('');
  const [editChampFile, setEditChampFile] = useState<File | null>(null);
  const [savingEditChamp, setSavingEditChamp] = useState(false);

  // Admin: General site settings & icons state
  const [siteTitle, setSiteTitle] = useState(settings.title);
  const [siteSubtitle, setSiteSubtitle] = useState(settings.subtitle);
  const [siteBanner, setSiteBanner] = useState(settings.bannerText);
  const [adminLoginId, setAdminLoginId] = useState(settings.adminId);
  const [adminLoginClave, setAdminLoginClave] = useState('');
  const [backupGmail, setBackupGmail] = useState(settings.backupGmail || '');
  const [radioName, setRadioName] = useState(
    settings.radioName || 'FM 101.5 Pop Radio (Bs. As.)'
  );
  const [radioStreamUrl, setRadioStreamUrl] = useState(
    settings.radioStreamUrl || 'https://popradio.stweb.tv/popradio/live/playlist.m3u8'
  );
  const [adminTeamId, setAdminTeamId] = useState(settings.adminTeamId || '');
  const [siteCrestFile, setSiteCrestFile] = useState<File | null>(null);
  const [siteFaviconFile, setSiteFaviconFile] = useState<File | null>(null);
  const [siteCoverFile, setSiteCoverFile] = useState<File | null>(null);
  const [siteBackgroundFile, setSiteBackgroundFile] = useState<File | null>(null);
  const [siteMsg, setSiteMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setSiteTitle(settings.title);
    setSiteSubtitle(settings.subtitle);
    setSiteBanner(settings.bannerText);
    setAdminLoginId(settings.adminId);
    setBackupGmail(settings.backupGmail || '');
    setRadioName(settings.radioName || 'FM 101.5 Pop Radio (Bs. As.)');
    setRadioStreamUrl(
      settings.radioStreamUrl || 'https://popradio.stweb.tv/popradio/live/playlist.m3u8'
    );
    setAdminTeamId(settings.adminTeamId || '');
  }, [settings]);

  const myHistoryMatches = useMemo(() => {
    if (!myTeam) return [];
    return matches.filter((m) => m.homeTeamId === myTeam.id || m.awayTeamId === myTeam.id);
  }, [matches, myTeam]);

  const myStatsSummary = useMemo(() => {
    if (!myTeam) {
      return { pj: 0, pg: 0, pe: 0, pp: 0, effectiveness: '0.0', titlesLiga: 0, titlesCopa: 0, titlesRecopa: 0, totalTitles: 0 };
    }
    const validated = myHistoryMatches.filter((m) => m.status === 'validated');
    let pg = 0;
    let pe = 0;
    let pp = 0;
    for (const m of validated) {
      const isHome = m.homeTeamId === myTeam.id;
      const gf = isHome ? m.homeGoals : m.awayGoals;
      const gc = isHome ? m.awayGoals : m.homeGoals;
      if (gf > gc) pg += 1;
      else if (gf === gc) pe += 1;
      else pp += 1;
    }
    const pj = validated.length;
    const pts = pg * 3 + pe;
    const effectiveness = pj > 0 ? ((pts / (pj * 3)) * 100).toFixed(1) : '0.0';

    const norm = (s: string) => s.trim().toLowerCase();
    const myMatchesChamp = (c: ChampionEntry) =>
      (c.teamId && c.teamId === myTeam.id) ||
      norm(c.teamName) === norm(myTeam.name) ||
      norm(c.memberName) === norm(myTeam.memberName);

    let titlesLiga = 0;
    let titlesCopa = 0;
    let titlesRecopa = 0;
    for (const c of champions) {
      if (!myMatchesChamp(c)) continue;
      if (c.tournamentType === 'copa') titlesCopa += 1;
      else if (c.tournamentType === 'recopa') titlesRecopa += 1;
      else titlesLiga += 1;
    }
    if (
      cup.status === 'finished' &&
      cup.championTeamName &&
      norm(cup.championTeamName) === norm(myTeam.name) &&
      titlesCopa === 0
    ) {
      titlesCopa += 1;
    }
    if (
      cup.recopa?.played &&
      cup.recopa.grandChampionName &&
      norm(cup.recopa.grandChampionName) === norm(myTeam.name) &&
      titlesRecopa === 0
    ) {
      titlesRecopa += 1;
    }
    return {
      pj,
      pg,
      pe,
      pp,
      effectiveness,
      titlesLiga,
      titlesCopa,
      titlesRecopa,
      totalTitles: titlesLiga + titlesCopa + titlesRecopa,
    };
  }, [myTeam, myHistoryMatches, champions, cup]);

  const pendingClaims = claims.filter((c) => c.status === 'pending');

  const uploadedMediaItems = useMemo(() => {
    const tMap = new Map(teams.map((t) => [t.id, t]));
    const items: Array<{
      key: string;
      kind: 'team_celebration' | 'match_proof' | 'match_scorer' | 'claim_card' | 'claim_video';
      targetId: string;
      title: string;
      subtitle: string;
      url: string;
      isVideo?: boolean;
      status: ModerationStatus;
    }> = [];

    for (const t of teams) {
      if (t.celebrationImageUrl) {
        items.push({
          key: `team_celebration_${t.id}`,
          kind: 'team_celebration',
          targetId: t.id,
          title: `Foto de Festejo · ${t.name}`,
          subtitle: `Miembro: ${t.memberName}`,
          url: t.celebrationImageUrl,
          status: t.celebrationStatus || 'approved',
        });
      }
    }
    for (const m of matches) {
      const h = tMap.get(m.homeTeamId)?.name || m.homeTeamId;
      const a = tMap.get(m.awayTeamId)?.name || m.awayTeamId;
      if (m.proofImageUrl) {
        items.push({
          key: `match_proof_${m.id}`,
          kind: 'match_proof',
          targetId: m.id,
          title: `Foto Resultado · F${m.matchday} (${h} vs ${a})`,
          subtitle: `Subida por ${m.submittedByName}`,
          url: m.proofImageUrl,
          status: m.proofImageStatus || 'approved',
        });
      }
      if (m.scorerImageUrl) {
        items.push({
          key: `match_scorer_${m.id}`,
          kind: 'match_scorer',
          targetId: m.id,
          title: `Foto Goleador${m.scorerName ? `: ${m.scorerName}` : ''} · ${h} vs ${a}`,
          subtitle: `Subida por ${m.submittedByName}`,
          url: m.scorerImageUrl,
          status: m.scorerImageStatus || 'approved',
        });
      }
    }
    for (const c of claims) {
      if (c.cardPhotoUrl) {
        items.push({
          key: `claim_card_${c.id}`,
          kind: 'claim_card',
          targetId: c.id,
          title: `Foto Tarjetas / Reclamo`,
          subtitle: `Enviada por ${c.reporterName}`,
          url: c.cardPhotoUrl,
          status: c.cardPhotoStatus || 'approved',
        });
      }
      if (c.videoUrl) {
        items.push({
          key: `claim_video_${c.id}`,
          kind: 'claim_video',
          targetId: c.id,
          title: `Video .MP4 de Reclamo`,
          subtitle: `Enviado por ${c.reporterName}`,
          url: c.videoUrl,
          isVideo: true,
          status: 'pending',
        });
      }
    }
    return items;
  }, [teams, matches, claims]);

  const pendingMediaCount = uploadedMediaItems.filter((item) => item.status === 'pending' && !item.isVideo).length;

  const pendingMatches = matches.filter((m) => m.status === 'pending');
  const validatedMatches = matches.filter((m) => m.status === 'validated');
  const rejectedMatches = matches.filter((m) => m.status === 'rejected');
  const filteredValidationMatches =
    validationFilter === 'pending'
      ? pendingMatches
      : validationFilter === 'validated'
      ? validatedMatches
      : validationFilter === 'rejected'
      ? rejectedMatches
      : matches;
  const filteredAdminTeams = adminTeams.filter((t) => {
    const q = teamSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      t.id.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.memberName.toLowerCase().includes(q)
    );
  });
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const standingsMap = new Map(standings.map((s) => [s.team.id, s]));

  if (!user) {
    return (
      <div className="max-w-xl mx-auto p-8 bg-[#071D38]/95 border-2 border-amber-400/60 rounded-2xl text-center space-y-4 shadow-xl">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-sky-500/20 border-2 border-amber-400/50 text-amber-300 flex items-center justify-center">
          <KeyRound className="w-7 h-7" />
        </div>
        <h1 className="font-display text-3xl font-extrabold text-albiceleste-shiny">Mi Perfil</h1>
        <p className="text-sm text-sky-100/90">
          Iniciá sesión con el <strong className="text-amber-200">ID</strong> y la{' '}
          <strong className="text-amber-200">Clave</strong> de tu equipo (o como Administrador) para ver tu ficha de club, cargar resultados o administrar la liga.
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          className="px-6 py-3 text-sm font-semibold btn-gold-luxury rounded-xl transition-all"
        >
          Ingresar con ID y Clave
        </button>
      </div>
    );
  }

  const handleSaveBio = async (e: FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify({ bio }),
    });
    setBioSaved(true);
    await onRefresh();
    window.setTimeout(() => setBioSaved(false), 2500);
  };

  const handleSaveAdminMyTeam = async (e: FormEvent) => {
    e.preventDefault();
    setAdminMyTeamMsg(null);
    setSavingAdminMyTeam(true);
    try {
      const form = new FormData();
      form.append('name', adminTeamName.trim());
      form.append('memberName', adminMemberName.trim());
      form.append('bio', adminTeamBio.trim());
      if (adminCrestFile) {
        form.append('crest', adminCrestFile);
      }
      await apiFetch('/api/admin/my-team', { method: 'PUT', body: form });
      setAdminCrestFile(null);
      if (adminCrestInputRef.current) adminCrestInputRef.current.value = '';
      setEditingMyAdminTeam(false);
      await onRefresh();
      setAdminMyTeamMsg({
        type: 'ok',
        text: 'Tu escudo, equipo y nombre quedaron guardados y publicados en la Tabla de Posiciones.',
      });
      window.setTimeout(() => setAdminMyTeamMsg(null), 4000);
    } catch (err) {
      setAdminMyTeamMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'No se pudo guardar tu equipo.',
      });
    } finally {
      setSavingAdminMyTeam(false);
    }
  };

  const handleCreateTeam = async (e: FormEvent) => {
    e.preventDefault();
    setTeamMsg(null);
    setSavingTeam(true);
    try {
      const form = new FormData();
      form.append('id', newTeamId.trim());
      form.append('clave', newTeamClave.trim());
      form.append('name', newTeamName.trim());
      form.append('memberName', newMemberName.trim());
      form.append('bio', newTeamBio.trim());
      if (newCrestFile) {
        form.append('crest', newCrestFile);
      }
      const data = await apiFetch<{ team: Team }>('/api/admin/teams', { method: 'POST', body: form });
      setNewTeamId('');
      setNewTeamClave('');
      setNewTeamName('');
      setNewMemberName('');
      setNewTeamBio('');
      setNewCrestFile(null);
      if (newCrestInputRef.current) newCrestInputRef.current.value = '';
      await onRefresh();
      const created = data?.team;
      setTeamMsg({
        type: 'ok',
        text: created
          ? `Miembro "${created.memberName}" (${created.name} · ID: ${created.id} / Clave: ${created.clave}) creado y agregado automáticamente a la Tabla de Posiciones.`
          : 'Miembro y equipo creados y agregados automáticamente en la Tabla de Posiciones.',
      });
    } catch (err) {
      setTeamMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'No se pudo agregar el equipo.',
      });
    } finally {
      setSavingTeam(false);
    }
  };

  const startEditTeam = (team: Team) => {
    if (editingTeam?.id === team.id) {
      setEditingTeam(null);
      return;
    }
    setEditingTeam(team);
    setEditId(team.id);
    setEditClave(team.clave);
    setEditName(team.name);
    setEditMember(team.memberName);
    setEditBio(team.bio || '');
    setEditCrestFile(null);
  };

  const handleSaveEditTeam = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;
    setTeamMsg(null);
    setSavingEditTeam(true);
    try {
      const form = new FormData();
      form.append('id', editId.trim());
      form.append('clave', editClave.trim());
      form.append('name', editName.trim());
      form.append('memberName', editMember.trim());
      form.append('bio', editBio);
      if (editCrestFile) {
        form.append('crest', editCrestFile);
      }
      await apiFetch(`/api/admin/teams/${encodeURIComponent(editingTeam.id)}`, {
        method: 'PUT',
        body: form,
      });
      setEditingTeam(null);
      await onRefresh();
      setTeamMsg({
        type: 'ok',
        text: `Datos actualizados (ID: ${editId.trim().toUpperCase()} / Clave: ${editClave.trim()}) para ${editMember.trim()}.`,
      });
    } catch (err) {
      setTeamMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Error actualizando equipo.',
      });
    } finally {
      setSavingEditTeam(false);
    }
  };

  const handleDeleteTeam = async (id: string) => {
    await apiFetch(`/api/admin/teams/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await onRefresh();
  };

  const handleSetAdminTeam = async (id: string) => {
    const form = new FormData();
    form.append('adminTeamId', id);
    await apiFetch('/api/admin/settings', { method: 'PUT', body: form });
    setAdminTeamId(id);
    await onRefresh();
    setTeamMsg({
      type: 'ok',
      text: `El equipo ${id} ahora es el equipo oficial del Administrador en la liga.`,
    });
  };

  const handleValidateMatch = async (matchId: string, status: 'validated' | 'rejected' | 'pending') => {
    await apiFetch(`/api/admin/matches/${matchId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await onRefresh();
    setValidationMsg(
      status === 'validated'
        ? 'Resultado validado y publicado oficialmente en Partidos y Tabla de Posiciones.'
        : status === 'rejected'
        ? 'Resultado marcado como rechazado.'
        : 'Resultado pasado nuevamente a Pendiente.'
    );
    window.setTimeout(() => setValidationMsg(null), 3500);
  };

  const handleSaveMatchScore = async (matchId: string, alsoValidate = false) => {
    const payload: Record<string, unknown> = {
      homeGoals: Number(editHomeGoals),
      awayGoals: Number(editAwayGoals),
      matchday: Number(editMatchday) || 1,
      leg: editLeg,
      playedAt: editPlayedAt.trim(),
      notes: editMatchNotes.trim(),
    };
    if (alsoValidate) payload.status = 'validated';
    await apiFetch(`/api/admin/matches/${matchId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    setEditingMatchId(null);
    await onRefresh();
    setValidationMsg(
      alsoValidate
        ? 'Partido actualizado, validado y sumado a la Tabla de Posiciones.'
        : 'Datos y marcador del partido actualizados correctamente.'
    );
    window.setTimeout(() => setValidationMsg(null), 3500);
  };

  const handleDeleteMatch = async (matchId: string) => {
    await apiFetch(`/api/admin/matches/${matchId}`, { method: 'DELETE' });
    await onRefresh();
    setValidationMsg('Partido eliminado.');
    window.setTimeout(() => setValidationMsg(null), 3000);
  };

  const handleSuggestIdClave = () => {
    const existingIds = new Set(adminTeams.map((t) => t.id.toUpperCase()));
    let nextNum = adminTeams.length + 1;
    let candidate = `LMA${String(nextNum).padStart(2, '0')}`;
    while (existingIds.has(candidate)) {
      nextNum += 1;
      candidate = `LMA${String(nextNum).padStart(2, '0')}`;
    }
    const randomSuffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    setNewTeamId(candidate);
    setNewTeamClave(`pes6_${randomSuffix}`);
  };

  const handleSaveRules = async (e: FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/admin/rules', {
      method: 'PUT',
      body: JSON.stringify({
        prohibitedRules: rulesList,
        generalNotes,
        gameMode,
        cupRules,
      }),
    });
    await onRefresh();
    setRulesMsg('Reglamento, Copa y Modo de Juego actualizados.');
    window.setTimeout(() => setRulesMsg(null), 3000);
  };

  const handleAddMusic = async (e: FormEvent) => {
    e.preventDefault();
    setMusicMsg(null);
    setUploadingMusic(true);
    try {
      const form = new FormData();
      if (trackFiles && trackFiles.length > 0) {
        for (const file of Array.from(trackFiles)) {
          form.append('audio', file);
        }
      }
      if (trackUrl.trim()) form.append('audioUrl', trackUrl.trim());
      await apiFetch('/api/admin/music', { method: 'POST', body: form });
      setTrackUrl('');
      setTrackFiles(null);
      await onRefresh();
      setMusicMsg('Canciones agregadas a la lista oficial del sitio.');
    } catch (err) {
      setMusicMsg(err instanceof Error ? err.message : 'No se pudieron subir las canciones.');
    } finally {
      setUploadingMusic(false);
    }
  };

  const handleDeleteMusic = async (id: string) => {
    await apiFetch(`/api/admin/music/${id}`, { method: 'DELETE' });
    await onRefresh();
  };

  const handleFeatureVideo = async (id: string) => {
    await apiFetch(`/api/admin/videos/${id}/featured`, { method: 'PATCH' });
    await onRefresh();
    setVideoMsg('Video destacado actualizado en la página de Inicio.');
    window.setTimeout(() => setVideoMsg(null), 3000);
  };

  const handleFeatureCommunityVideo = async (cv: CommunityVideo) => {
    await apiFetch('/api/admin/featured-video', {
      method: 'PUT',
      body: JSON.stringify({
        id: cv.id,
        source: 'community',
        title: cv.titulo,
        author: cv.autor,
        videoUrl: cv.videoUrl,
        downloadUrl: cv.videoUrl,
        fechaLabel: cv.fechaLabel,
      }),
    });
    await onRefresh();
    setVideoMsg(`"${cv.titulo}" elegido como video destacado en la página de Inicio.`);
    window.setTimeout(() => setVideoMsg(null), 3500);
  };

  const handleDeleteCommunityVideo = async (id: string) => {
    await deleteDoc(doc(db, 'videos_comunidad', id));
    if (settings.featuredVideo?.id === id) {
      await apiFetch('/api/admin/featured-video', { method: 'DELETE' }).catch(() => undefined);
      await onRefresh();
    }
    setVideoMsg('Video de la comunidad eliminado.');
    window.setTimeout(() => setVideoMsg(null), 3000);
  };

  const handleSaveVideoMeta = async (id: string) => {
    if (!editVideoTitle.trim()) return;
    await apiFetch(`/api/admin/videos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        title: editVideoTitle.trim(),
        description: editVideoDesc.trim(),
      }),
    });
    setEditingVideoId(null);
    await onRefresh();
    setVideoMsg('Título y descripción del video actualizados.');
    window.setTimeout(() => setVideoMsg(null), 3000);
  };

  const handleDeleteVideo = async (id: string) => {
    await apiFetch(`/api/admin/videos/${id}`, { method: 'DELETE' });
    await onRefresh();
  };

  const handleCreateChampion = async (e: FormEvent) => {
    e.preventDefault();
    if (!newChampFile) {
      setChampMsg({ type: 'err', text: 'Subí la imagen PNG de los festejos.' });
      return;
    }
    setChampMsg(null);
    setSavingChamp(true);
    try {
      const form = new FormData();
      form.append('tournamentType', newChampType);
      form.append('season', newChampSeason.trim());
      form.append('teamName', newChampTeam.trim());
      form.append('memberName', newChampMember.trim());
      form.append('notes', newChampNotes.trim());
      form.append('celebrationImage', newChampFile);
      await apiFetch('/api/champions', { method: 'POST', body: form });
      setNewChampTeam('');
      setNewChampMember('');
      setNewChampNotes('');
      setNewChampFile(null);
      if (newChampInputRef.current) newChampInputRef.current.value = '';
      await onRefresh();
      setChampMsg({ type: 'ok', text: 'Campeón agregado al historial oficial.' });
    } catch (err) {
      setChampMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'No se pudo guardar el campeón.',
      });
    } finally {
      setSavingChamp(false);
    }
  };

  const handleSaveEditChampion = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingChampId) return;
    setChampMsg(null);
    setSavingEditChamp(true);
    try {
      const form = new FormData();
      form.append('tournamentType', editChampType);
      form.append('season', editChampSeason.trim());
      form.append('teamName', editChampTeam.trim());
      form.append('memberName', editChampMember.trim());
      form.append('notes', editChampNotes.trim());
      if (editChampFile) {
        form.append('celebrationImage', editChampFile);
      }
      await apiFetch(`/api/admin/champions/${encodeURIComponent(editingChampId)}`, {
        method: 'PUT',
        body: form,
      });
      setEditingChampId(null);
      setEditChampFile(null);
      await onRefresh();
      setChampMsg({ type: 'ok', text: 'Datos del campeón actualizados.' });
    } catch (err) {
      setChampMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'No se pudo actualizar el campeón.',
      });
    } finally {
      setSavingEditChamp(false);
    }
  };

  const handleDeleteChampion = async (id: string) => {
    await apiFetch(`/api/admin/champions/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await onRefresh();
  };

  const handleUploadMyCelebration = async (e: FormEvent) => {
    e.preventDefault();
    if (!celebFile) {
      setCelebMsg({ type: 'err', text: 'Seleccioná una foto de festejo deportivo (JPG, PNG o WEBP).' });
      return;
    }
    setCelebMsg(null);
    setUploadingCeleb(true);
    try {
      const form = new FormData();
      form.append('celebrationImage', celebFile);
      await apiFetch('/api/profile/celebration', { method: 'POST', body: form });
      setCelebFile(null);
      if (celebInputRef.current) celebInputRef.current.value = '';
      await onRefresh();
      setCelebMsg({
        type: 'ok',
        text:
          user?.role === 'admin'
            ? 'Foto de festejo publicada en tu perfil.'
            : 'Foto de festejo subida. Quedó visible y sujeta a verificación del Administrador.',
      });
    } catch (err) {
      setCelebMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'No se pudo subir la foto de festejo.',
      });
    } finally {
      setUploadingCeleb(false);
    }
  };

  const handleRemoveMyCelebration = async () => {
    await apiFetch('/api/profile/celebration', { method: 'DELETE' });
    await onRefresh();
    setCelebMsg({ type: 'ok', text: 'Foto de festejo quitada de tu perfil.' });
  };

  const handleCreateFixture = async (e: FormEvent) => {
    e.preventDefault();
    setFxMsg(null);
    setSavingFx(true);
    try {
      await apiFetch('/api/admin/fixtures', {
        method: 'POST',
        body: JSON.stringify({
          matchday: Number(fxMatchday) || 1,
          leg: fxLeg,
          homeTeamId: fxHomeTeamId,
          awayTeamId: fxAwayTeamId,
          scheduledDate: fxDate.trim() || undefined,
          scheduledTime: fxTime.trim() || undefined,
          notes: fxNotes.trim() || undefined,
        }),
      });
      setFxNotes('');
      await onRefresh();
      setFxMsg({ type: 'ok', text: 'Cruce agregado al calendario oficial de la fecha.' });
    } catch (err) {
      setFxMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'No se pudo agregar el cruce.',
      });
    } finally {
      setSavingFx(false);
    }
  };

  const handleDeleteFixture = async (fixtureId: string) => {
    await apiFetch(`/api/admin/fixtures/${encodeURIComponent(fixtureId)}`, { method: 'DELETE' });
    await onRefresh();
  };

  const handleResolveClaim = async (
    claimId: string,
    status: 'valid_match' | 'invalid_match' | 'dismissed'
  ) => {
    await apiFetch(`/api/admin/claims/${encodeURIComponent(claimId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        adminResolutionNote: (claimNoteDrafts[claimId] || '').trim(),
      }),
    });
    await onRefresh();
    setClaimsMsg(
      status === 'valid_match'
        ? 'Dictamen guardado: Partido declarado Válido.'
        : status === 'invalid_match'
        ? 'Dictamen guardado: Partido declarado Inválido.'
        : 'Reclamo desestimado.'
    );
    window.setTimeout(() => setClaimsMsg(null), 3500);
  };

  const handleDeleteClaim = async (claimId: string) => {
    await apiFetch(`/api/admin/claims/${encodeURIComponent(claimId)}`, { method: 'DELETE' });
    await onRefresh();
  };

  const handleModerateMedia = async (
    kind: 'team_celebration' | 'match_proof' | 'match_scorer' | 'claim_card' | 'claim_video',
    targetId: string,
    action: 'approve' | 'remove'
  ) => {
    await apiFetch('/api/admin/moderation/media', {
      method: 'PATCH',
      body: JSON.stringify({ kind, targetId, action }),
    });
    await onRefresh();
    setModerationMsg(
      action === 'approve'
        ? 'Archivo aprobado y validado oficialmente.'
        : 'Archivo quitado permanentemente por el Administrador.'
    );
    window.setTimeout(() => setModerationMsg(null), 3500);
  };

  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setSiteMsg(null);
    try {
      const form = new FormData();
      form.append('title', siteTitle);
      form.append('subtitle', siteSubtitle);
      form.append('bannerText', siteBanner);
      form.append('adminId', adminLoginId);
      form.append('adminTeamId', adminTeamId);
      form.append('backupGmail', backupGmail.trim());
      form.append('radioName', radioName.trim());
      form.append('radioStreamUrl', radioStreamUrl.trim());
      if (adminLoginClave.trim()) form.append('adminClave', adminLoginClave.trim());
      if (siteCrestFile) form.append('crestFile', siteCrestFile);
      if (siteFaviconFile) form.append('faviconFile', siteFaviconFile);
      if (siteCoverFile) form.append('coverFile', siteCoverFile);
      if (siteBackgroundFile) form.append('backgroundFile', siteBackgroundFile);

      await apiFetch('/api/admin/settings', { method: 'PUT', body: form });
      setAdminLoginClave('');
      setSiteCrestFile(null);
      setSiteFaviconFile(null);
      setSiteCoverFile(null);
      setSiteBackgroundFile(null);
      await onRefresh();
      setSiteMsg({ type: 'ok', text: 'Configuración general, Gmail de respaldo privado, fondo e iconos actualizados.' });
      window.setTimeout(() => setSiteMsg(null), 3500);
    } catch (err) {
      setSiteMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'No se pudo guardar la configuración.',
      });
    }
  };

  return (
    <div className="space-y-8">
      {/* Profile Header */}
      <section className="p-6 bg-[#071D38]/95 border border-amber-400/50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {myTeam ? (
            <ResilientImage
              src={myTeam.crestUrl}
              alt={`Escudo ${myTeam.name}`}
              className="w-16 h-16 rounded-xl object-contain bg-[#041224] border border-amber-400/30 p-1 shrink-0"
              fallbackLabel={myTeam.id}
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-[#041224] border border-amber-400/30 text-amber-300 flex items-center justify-center shrink-0">
              <Shield className="w-8 h-8" />
            </div>
          )}

          <div>
            <div className="text-xs font-semibold text-amber-300">
              {user.role === 'admin' ? 'Administrador General' : 'Miembro Oficial'} · ID{' '}
              <span className="font-mono">{user.id}</span>
            </div>
            <h1 className="font-display text-3xl font-extrabold text-albiceleste-shiny">
              {myTeam ? `${myTeam.name} — ${myTeam.memberName}` : user.displayName}
            </h1>
            {myStanding && (
              <div className="mt-1 text-xs text-amber-200/90 font-mono tabular-nums">
                Posición #{myStanding.position} · {myStanding.pts} PTS · {myStanding.pj} PJ (
                {myStanding.pg}G-{myStanding.pe}E-{myStanding.pp}P)
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-amber-100 bg-[#0A294E] hover:bg-[#0D3666] border border-amber-400/50 rounded-lg transition-colors whitespace-nowrap self-start sm:self-auto"
        >
          <LogOut className="w-4 h-4" />
          <span>Cerrar sesión</span>
        </button>
      </section>

      {/* Admin's own participating team (create or edit Escudo, Equipo y Nombre directly) */}
      {user.role === 'admin' && (
        <section className="p-6 bg-[#071D38]/95 border border-amber-400/50 rounded-2xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-albiceleste-shiny">
                {myTeam
                  ? 'Mi Equipo como Participante de la Liga'
                  : 'Participar de la Liga como Miembro (Crear Mi Equipo)'}
              </h2>
              <p className="text-xs text-sky-200/80">
                {myTeam
                  ? 'Competís oficialmente en la Tabla de Posiciones y Partidos como cualquier miembro. Podés cambiar tu escudo, equipo y nombre cuando quieras.'
                  : 'Ponete un nombre, un equipo y un escudo para sumarte a la Tabla de Posiciones y cargar tus partidos.'}
              </p>
            </div>
            {myTeam && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingMyAdminTeam((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold btn-gold-luxury rounded-lg transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{editingMyAdminTeam ? 'Cerrar Editor' : 'Cambiar Escudo, Equipo y Nombre'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('partidos', 'submit')}
                  className="px-4 py-2 text-xs font-semibold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors"
                >
                  Cargar Resultado
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('galeria', 'videos')}
                  className="px-4 py-2 text-xs font-semibold text-amber-200 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 rounded-lg transition-colors"
                >
                  Subir Video / Festejo
                </button>
              </div>
            )}
          </div>

          {adminMyTeamMsg && (
            <div
              className={`p-3 text-sm rounded-xl border ${
                adminMyTeamMsg.type === 'ok'
                  ? 'bg-emerald-950/60 border-emerald-400/40 text-emerald-200'
                  : 'bg-rose-950/60 border-rose-400/40 text-rose-200'
              }`}
            >
              {adminMyTeamMsg.text}
            </div>
          )}

          {(!myTeam || editingMyAdminTeam) && (
            <form
              onSubmit={handleSaveAdminMyTeam}
              className="p-5 bg-[#05162B] border border-amber-400/50 rounded-xl space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
                <div className="lg:col-span-3">
                  <label className="block text-xs font-semibold text-sky-100/90 mb-1">
                    Tu Nombre (DT / Participante)
                  </label>
                  <input
                    type="text"
                    required
                    value={adminMemberName}
                    onChange={(e) => setAdminMemberName(e.target.value)}
                    placeholder="Ej: Nahuel_10"
                    className="w-full px-3 py-2 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                </div>
                <div className="lg:col-span-4">
                  <label className="block text-xs font-semibold text-sky-100/90 mb-1">
                    Nombre de tu Equipo
                  </label>
                  <input
                    type="text"
                    required
                    value={adminTeamName}
                    onChange={(e) => setAdminTeamName(e.target.value)}
                    placeholder="Ej: Huracán"
                    className="w-full px-3 py-2 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                </div>
                <div className="lg:col-span-5 flex items-center gap-3">
                  <ResilientImage
                    src={adminCrestPreview || myTeam?.crestUrl}
                    alt="Escudo del Admin"
                    className="w-12 h-12 rounded-lg object-contain bg-[#041224] border border-amber-400/40 p-0.5 shrink-0"
                    fallbackLabel={myTeam?.id || 'ADM'}
                  />
                  <div className="min-w-0 flex-1">
                    <label className="block text-xs font-semibold text-sky-100/90 mb-1">
                      Tu Escudo (PNG, JPG o WEBP — se ajusta a 128x128)
                    </label>
                    <input
                      ref={adminCrestInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => setAdminCrestFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-sky-100/90 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-400/20 file:text-amber-300 hover:file:bg-amber-400/30"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <input
                  type="text"
                  value={adminTeamBio}
                  onChange={(e) => setAdminTeamBio(e.target.value)}
                  placeholder="Lema o estilo de juego de tu equipo (opcional)..."
                  className="flex-1 px-3.5 py-2 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                />
                <div className="flex items-center justify-end gap-2">
                  {myTeam && (
                    <button
                      type="button"
                      onClick={() => setEditingMyAdminTeam(false)}
                      className="px-4 py-2 text-xs font-semibold text-sky-100/90 bg-[#0A294E] hover:bg-[#0D3666] border border-amber-400/45 rounded-lg"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={savingAdminMyTeam}
                    className="px-5 py-2 text-sm font-semibold btn-gold-luxury disabled:opacity-50 rounded-lg whitespace-nowrap"
                  >
                    {savingAdminMyTeam
                      ? 'Guardando...'
                      : myTeam
                      ? 'Guardar Mi Equipo'
                      : 'Crear Mi Equipo y Participar'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {myTeam && (
            <div className="pt-4 border-t border-amber-400/15 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-amber-300">
                  Mis Partidos Jugados ({matches.filter((m) => m.homeTeamId === myTeam.id || m.awayTeamId === myTeam.id).length})
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('partidos', 'mine')}
                  className="text-xs font-semibold text-amber-300 hover:text-amber-200"
                >
                  Ver todos en Partidos →
                </button>
              </div>

              {matches.filter((m) => m.homeTeamId === myTeam.id || m.awayTeamId === myTeam.id).length === 0 ? (
                <div className="text-xs text-sky-200/80">
                  Todavía no cargaste partidos con {myTeam.name}. Tocá &ldquo;Cargar Resultado&rdquo; para jugar contra otro miembro de la liga.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {matches
                    .filter((m) => m.homeTeamId === myTeam.id || m.awayTeamId === myTeam.id)
                    .slice(0, 4)
                    .map((m) => {
                      const home = teamMap.get(m.homeTeamId);
                      const away = teamMap.get(m.awayTeamId);
                      return (
                        <div
                          key={m.id}
                          className="px-3.5 py-2.5 bg-[#05162B] border border-amber-400/45 rounded-xl flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="text-amber-100 font-semibold truncate flex-1">
                            {home?.name || m.homeTeamId}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-[#041224] border border-amber-400/30 font-mono font-bold text-amber-300 tabular-nums shrink-0">
                            {m.homeGoals} - {m.awayGoals}
                          </span>
                          <span className="text-amber-100 font-semibold truncate flex-1 text-right">
                            {away?.name || m.awayTeamId}
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Member's own team card & bio */}
      {user.role !== 'admin' && myTeam && (
        <section className="p-6 bg-[#071D38]/95 border border-amber-400/50 rounded-2xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-2xl font-bold text-albiceleste-shiny">
                Mi Club y Lema del DT
              </h2>
              <p className="text-xs text-sky-200/80">
                Tu equipo compite oficialmente en la Tabla de Posiciones junto a los demás clubes.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate('partidos', 'submit')}
                className="px-4 py-2 text-xs font-semibold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors"
              >
                Cargar Resultado
              </button>
              <button
                type="button"
                onClick={() => onNavigate('partidos', 'claims')}
                className="px-4 py-2 text-xs font-semibold text-rose-200 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 rounded-lg transition-colors"
              >
                Hacer Reclamo
              </button>
              <button
                type="button"
                onClick={() => onNavigate('galeria', 'videos')}
                className="px-4 py-2 text-xs font-semibold text-amber-200 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 rounded-lg transition-colors"
              >
                Subir Video .MP4
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveBio} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Escribí la descripción o estilo de juego de tu equipo..."
              className="flex-1 px-3.5 py-2.5 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            <button
              type="submit"
              className="px-5 py-2.5 text-sm font-semibold btn-gold-luxury rounded-xl transition-colors whitespace-nowrap"
            >
              {bioSaved ? 'Guardado' : 'Actualizar Lema'}
            </button>
          </form>
        </section>
      )}

      {/* Full History, Effectiveness %, Championships Won & Profile Celebration Photo (Member & Participating Admin) */}
      {myTeam && (
        <section className="p-6 bg-[#071D38]/95 border border-amber-400/50 rounded-2xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-albiceleste-shiny">
                Mi Historial en la Liga, Efectividad y Festejos
              </h2>
              <p className="text-xs text-sky-200/80">
                Todos tus partidos ganados, empatados y perdidos, porcentaje de efectividad, títulos obtenidos y tu foto de festejo personal.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('partidos', 'mine')}
              className="text-xs font-semibold text-amber-300 hover:text-amber-200 whitespace-nowrap"
            >
              Ver en Partidos →
            </button>
          </div>

          {/* 4 Stat KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-[#05162B] border border-amber-400/45 rounded-xl">
              <div className="text-xs font-medium text-sky-200/80">Partidos Oficiales</div>
              <div className="mt-1 font-display text-3xl font-extrabold text-amber-50 tabular-nums">
                {myStatsSummary.pj}
              </div>
              <div className="mt-1 text-xs font-mono text-amber-200/90 tabular-nums">
                {myStatsSummary.pg}G · {myStatsSummary.pe}E · {myStatsSummary.pp}P
              </div>
            </div>

            <div className="p-4 bg-[#05162B] border border-emerald-400/25 rounded-xl">
              <div className="text-xs font-medium text-sky-200/80">% de Efectividad</div>
              <div className="mt-1 font-display text-3xl font-extrabold text-emerald-300 tabular-nums">
                {myStatsSummary.effectiveness}%
              </div>
              <div className="mt-1 text-xs text-sky-200/80">Sobre partidos validados</div>
            </div>

            <div className="p-4 bg-[#05162B] border border-amber-400/35 rounded-xl">
              <div className="text-xs font-medium text-sky-200/80">Títulos Ganados</div>
              <div className="mt-1 font-display text-3xl font-extrabold text-amber-300 tabular-nums">
                {myStatsSummary.totalTitles}
              </div>
              <div className="mt-1 text-xs text-amber-200/90 tabular-nums">
                Liga {myStatsSummary.titlesLiga} · Copa {myStatsSummary.titlesCopa} · Recopa {myStatsSummary.titlesRecopa}
              </div>
            </div>

            <div className="p-4 bg-[#05162B] border border-amber-400/45 rounded-xl">
              <div className="text-xs font-medium text-sky-200/80">Posición en Liga</div>
              <div className="mt-1 font-display text-3xl font-extrabold text-amber-50 tabular-nums">
                {myStanding ? `#${myStanding.position}` : '—'}
              </div>
              <div className="mt-1 text-xs text-amber-200/90 font-mono tabular-nums">
                {myStanding ? `${myStanding.pts} PTS · DG ${myStanding.dg > 0 ? `+${myStanding.dg}` : myStanding.dg}` : 'Sin tabla'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Scrollable Full Match History */}
            <div className="lg:col-span-7 space-y-3">
              <div className="text-xs font-semibold text-amber-300">
                Historial Completo de Partidos ({myHistoryMatches.length})
              </div>

              {myHistoryMatches.length === 0 ? (
                <div className="p-6 bg-[#05162B] border border-amber-400/45 rounded-xl text-xs text-sky-200/80">
                  Todavía no jugaste ni cargaste partidos con {myTeam.name}.
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {myHistoryMatches.map((m) => {
                    const isHome = m.homeTeamId === myTeam.id;
                    const home = teamMap.get(m.homeTeamId);
                    const away = teamMap.get(m.awayTeamId);
                    const myGoals = isHome ? m.homeGoals : m.awayGoals;
                    const oppGoals = isHome ? m.awayGoals : m.homeGoals;
                    const outcomeLabel =
                      m.status !== 'validated'
                        ? m.status === 'pending'
                          ? 'En validación'
                          : 'Rechazado'
                        : myGoals > oppGoals
                        ? 'Ganado'
                        : myGoals === oppGoals
                        ? 'Empatado'
                        : 'Perdido';
                    const outcomeColor =
                      m.status !== 'validated'
                        ? 'text-sky-100/90 bg-[#0A294E] border-amber-400/45'
                        : myGoals > oppGoals
                        ? 'text-emerald-300 bg-emerald-500/15 border-emerald-400/35'
                        : myGoals === oppGoals
                        ? 'text-amber-300 bg-amber-500/15 border-amber-400/35'
                        : 'text-rose-300 bg-rose-500/15 border-rose-400/35';

                    return (
                      <div
                        key={m.id}
                        className="px-4 py-3 bg-[#05162B] border border-amber-400/45 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className={`px-2 py-0.5 rounded border font-semibold shrink-0 ${outcomeColor}`}>
                            {outcomeLabel}
                          </span>
                          <span className="text-sky-200/80 font-mono shrink-0">
                            F{m.matchday} ({m.leg})
                          </span>
                          <span className="text-amber-100 font-semibold truncate">
                            {home?.name || m.homeTeamId} {m.homeGoals}-{m.awayGoals} {away?.name || m.awayTeamId}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-sky-200/80 tabular-nums">
                          {m.playedAt}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Celebration Photo Upload */}
            <div className="lg:col-span-5 p-5 bg-[#05162B] border border-amber-400/50 rounded-2xl space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-amber-300" />
                  <h3 className="font-display text-xl font-bold text-albiceleste-shiny">
                    Mi Foto de Festejo
                  </h3>
                </div>
                {myTeam.celebrationImageUrl && (
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                      myTeam.celebrationStatus === 'pending'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-400/35'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/35'
                    }`}
                  >
                    {myTeam.celebrationStatus === 'pending' ? 'En verificación Admin' : 'Aprobada'}
                  </span>
                )}
              </div>

              {(celebPreview || myTeam.celebrationImageUrl) && (
                <div className="aspect-[16/10] w-full rounded-xl overflow-hidden bg-[#041224] border border-amber-400/45">
                  <ResilientImage
                    src={celebPreview || myTeam.celebrationImageUrl}
                    alt={`Festejo de ${myTeam.name}`}
                    className="w-full h-full object-cover"
                    fallbackLabel={myTeam.name}
                  />
                </div>
              )}

              {celebMsg && (
                <div
                  className={`p-3 text-xs rounded-xl border ${
                    celebMsg.type === 'ok'
                      ? 'bg-emerald-950/60 border-emerald-400/40 text-emerald-200'
                      : 'bg-rose-950/60 border-rose-400/40 text-rose-200'
                  }`}
                >
                  {celebMsg.text}
                </div>
              )}

              <form onSubmit={handleUploadMyCelebration} className="space-y-3">
                <p className="text-[11px] text-sky-200/80">
                  Subí una foto festejando con tu equipo. Solo se permiten imágenes deportivas de festejos; el Administrador verifica todo el material subido.
                </p>
                <input
                  ref={celebInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCelebFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-sky-100/90 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-400/20 file:text-amber-300 hover:file:bg-amber-400/30"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {myTeam.celebrationImageUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveMyCelebration}
                      className="px-3 py-1.5 text-xs font-semibold text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 rounded-lg"
                    >
                      Quitar Foto
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={uploadingCeleb}
                    className="ml-auto px-4 py-2 text-xs font-semibold btn-gold-luxury disabled:opacity-50 rounded-lg"
                  >
                    {uploadingCeleb ? 'Verificando...' : myTeam.celebrationImageUrl ? 'Cambiar Foto de Festejo' : 'Subir Foto de Festejo'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      )}

      {/* Full Admin Control Panel */}
      {user.role === 'admin' && (
        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl font-extrabold text-albiceleste-shiny">
                Panel de Administrador
              </h2>
              <p className="text-xs text-sky-200/80">
                Creá y editá ID y Clave de los {settings.maxTeams} miembros, validá y editá partidos, videos, campeones, reglamento, música, fondo, icono y portada.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1 p-1 bg-[#071D38]/95 border border-amber-400/50 rounded-xl">
              {(
                [
                  { id: 'equipos', label: `Equipos (${adminTeams.length}/${settings.maxTeams})`, icon: Users },
                  { id: 'copa', label: 'Copa de la Liga', icon: Crown },
                  { id: 'cruces', label: `Cruces (${fixtures.length})`, icon: CalendarDays },
                  { id: 'validacion', label: `Validar (${pendingMatches.length})`, icon: Check },
                  { id: 'reclamos', label: `Reclamos (${pendingClaims.length})`, icon: ShieldAlert },
                  { id: 'archivos', label: `Verificar Archivos (${pendingMediaCount})`, icon: ShieldCheck },
                  { id: 'reglamento', label: 'Reglamento', icon: Shield },
                  { id: 'musica', label: `Música (${music.length})`, icon: Music },
                  { id: 'videos', label: `Videos (${communityVideos.length + videos.length})`, icon: Film },
                  { id: 'campeones', label: `Campeones (${champions.length})`, icon: Trophy },
                  { id: 'general', label: 'Fondo, Icono y General', icon: Settings },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const hasHighlight =
                  ((tab.id === 'validacion' && pendingMatches.length > 0) ||
                    (tab.id === 'reclamos' && pendingClaims.length > 0) ||
                    (tab.id === 'archivos' && pendingMediaCount > 0)) &&
                  adminTab !== tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setAdminTab(tab.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      adminTab === tab.id
                        ? 'btn-gold-luxury shadow-sm'
                        : hasHighlight
                        ? 'bg-amber-400/20 text-amber-200 border border-amber-400/40 hover:bg-amber-400/30'
                        : 'text-sky-100/90 hover:text-amber-100'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {pendingMatches.length > 0 && adminTab !== 'validacion' && (
            <div className="p-4 bg-amber-950/50 border border-amber-400/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-sm text-amber-100">
                Tenés <strong className="font-mono text-amber-300">{pendingMatches.length}</strong>{' '}
                {pendingMatches.length === 1
                  ? 'resultado subido por un miembro esperando tu validación.'
                  : 'resultados subidos por miembros esperando tu validación.'}
              </div>
              <button
                type="button"
                onClick={() => {
                  setValidationFilter('pending');
                  setAdminTab('validacion');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold btn-gold-luxury rounded-lg transition-colors whitespace-nowrap self-start sm:self-auto"
              >
                <Check className="w-4 h-4" />
                <span>Validar Resultados Ahora</span>
              </button>
            </div>
          )}

          {/* Copa de la Liga y Recopa */}
          {adminTab === 'copa' && (
            <AdminCupPanel
              cup={cup}
              teams={teams}
              onRefresh={onRefresh}
              onGoToChampions={() => onNavigate('galeria', 'campeones')}
              onGoToHome={() => onNavigate('inicio')}
            />
          )}

          {/* 1. Equipos (hasta 30) */}
          {adminTab === 'equipos' && (
            <div className="space-y-6">
              <form
                onSubmit={handleCreateTeam}
                className="p-6 bg-[#071D38]/95 border border-amber-400/50 rounded-2xl space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-2xl font-bold text-albiceleste-shiny">
                      Crear ID, Clave y Equipo para Nuevo Miembro ({adminTeams.length} / {settings.maxTeams})
                    </h3>
                    <p className="text-xs text-sky-200/80">
                      Creá el ID y la Clave de acceso del miembro. Al guardarlo, se publica automáticamente en la Tabla de Posiciones.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSuggestIdClave}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-200 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Generar ID y Clave</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('posiciones')}
                      className="text-xs font-semibold text-amber-300 hover:text-amber-200 whitespace-nowrap"
                    >
                      Ver Tabla →
                    </button>
                  </div>
                </div>

                {teamMsg && (
                  <div
                    className={`p-3 text-sm rounded-xl border flex flex-wrap items-center justify-between gap-2 ${
                      teamMsg.type === 'ok'
                        ? 'bg-emerald-950/60 border-emerald-400/40 text-emerald-200'
                        : 'bg-rose-950/60 border-rose-400/40 text-rose-200'
                    }`}
                  >
                    <span>{teamMsg.text}</span>
                    {teamMsg.type === 'ok' && (
                      <button
                        type="button"
                        onClick={() => onNavigate('posiciones')}
                        className="px-3 py-1 text-xs font-semibold text-zinc-950 bg-emerald-300 hover:bg-emerald-200 rounded-lg transition-colors whitespace-nowrap"
                      >
                        Ver en Tabla de Posiciones →
                      </button>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-sky-100/90 mb-1">
                      ID de acceso (auto si vacío)
                    </label>
                    <input
                      type="text"
                      value={newTeamId}
                      onChange={(e) => setNewTeamId(e.target.value)}
                      placeholder="Auto (Ej: LMA11)"
                      className="w-full px-3 py-2 text-sm font-mono bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-sky-100/90 mb-1">
                      Clave (auto si vacío)
                    </label>
                    <input
                      type="text"
                      value={newTeamClave}
                      onChange={(e) => setNewTeamClave(e.target.value)}
                      placeholder="Auto (Ej: pes611)"
                      className="w-full px-3 py-2 text-sm font-mono bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-sky-100/90 mb-1">
                      Nombre del Equipo (opcional)
                    </label>
                    <input
                      type="text"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      placeholder="Ej: Rosario Central"
                      className="w-full px-3 py-2 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-sky-100/90 mb-1">
                      Nombre del Miembro
                    </label>
                    <input
                      type="text"
                      required
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      placeholder="Ej: Canalla_10"
                      className="w-full px-3 py-2 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                    />
                  </div>
                  <div className="lg:col-span-2 flex items-center gap-3">
                    {newCrestPreview && (
                      <img
                        src={newCrestPreview}
                        alt="Vista previa escudo 128x128"
                        className="w-11 h-11 rounded-lg object-contain bg-[#041224] border border-amber-400/40 p-0.5 shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <label className="block text-xs font-semibold text-sky-100/90 mb-1">
                        Escudo (PNG/JPG/WEBP 128x128)
                      </label>
                      <input
                        ref={newCrestInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => setNewCrestFile(e.target.files?.[0] || null)}
                        className="w-full text-xs text-sky-100/90 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-400/20 file:text-amber-300 hover:file:bg-amber-400/30"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-sky-100/90 mb-1">
                    Lema / Descripción del Club (opcional)
                  </label>
                  <input
                    type="text"
                    value={newTeamBio}
                    onChange={(e) => setNewTeamBio(e.target.value)}
                    placeholder="Estilo de juego o presentación del DT..."
                    className="w-full px-3 py-2 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingTeam || adminTeams.length >= settings.maxTeams}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold btn-gold-luxury disabled:opacity-50 rounded-xl transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{savingTeam ? 'Guardando...' : 'Crear ID/Clave y Publicar en Tabla'}</span>
                  </button>
                </div>
              </form>

              <div className="bg-[#071D38]/95 border border-amber-400/50 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 bg-[#05162B] border-b border-amber-400/45 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-xl font-bold text-albiceleste-shiny">
                      Miembros y Credenciales ({adminTeams.length} / {settings.maxTeams})
                    </h3>
                    <p className="text-xs text-sky-200/80">
                      Tocá &ldquo;Editar ID / Clave&rdquo; en cualquier miembro para cambiar su ID, clave, equipo, nombre o escudo al instante.
                    </p>
                  </div>
                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-sky-200/80 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={teamSearch}
                      onChange={(e) => setTeamSearch(e.target.value)}
                      placeholder="Buscar por ID, miembro o equipo..."
                      className="w-full pl-9 pr-3 py-2 text-xs bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-amber-400/45 bg-[#05162B]/80 text-xs font-semibold text-amber-200/80">
                        <th className="py-3 pl-5 pr-2 text-left">Escudo</th>
                        <th className="py-3 px-3 text-left">ID de Acceso</th>
                        <th className="py-3 px-3 text-left">Clave</th>
                        <th className="py-3 px-3 text-left">Equipo</th>
                        <th className="py-3 px-3 text-left">Miembro</th>
                        <th className="py-3 px-3 text-left">En Tabla</th>
                        <th className="py-3 pl-3 pr-5 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-400/15">
                      {filteredAdminTeams.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-xs text-sky-200/80">
                            No se encontraron miembros con &ldquo;{teamSearch}&rdquo;.
                          </td>
                        </tr>
                      ) : (
                        filteredAdminTeams.map((t) => {
                          const isAdminOwn = t.id === settings.adminTeamId;
                          const isEditingRow = editingTeam?.id === t.id;
                          const standing = standingsMap.get(t.id);
                          return (
                            <Fragment key={t.id}>
                              <tr className={isEditingRow ? 'bg-amber-400/[0.06]' : 'hover:bg-white/[0.02]'}>
                                <td className="py-2.5 pl-5 pr-2">
                                  <ResilientImage
                                    src={t.crestUrl}
                                    alt={t.name}
                                    className="w-10 h-10 rounded-lg object-contain bg-[#041224] border border-amber-400/50 p-0.5"
                                    fallbackLabel={t.id}
                                  />
                                </td>
                                <td className="py-2.5 px-3 font-mono text-xs font-bold text-amber-300">
                                  {t.id}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-xs text-amber-200">
                                  {t.clave}
                                </td>
                                <td className="py-2.5 px-3 font-semibold text-amber-50">
                                  {t.name}
                                  {isAdminOwn && (
                                    <span className="ml-2 text-[11px] font-semibold text-amber-300">
                                      · Equipo del Admin
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-sky-100/90">{t.memberName}</td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  {standing ? (
                                    <button
                                      type="button"
                                      onClick={() => onNavigate('posiciones')}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-emerald-200 bg-emerald-500/15 border border-emerald-400/30 hover:bg-emerald-500/25 rounded-md transition-colors"
                                    >
                                      <span>Pos #{standing.position}</span>
                                      {standing.position <= 16 && (
                                        <span className="text-amber-300">· Copa</span>
                                      )}
                                      <span className="text-emerald-300/80">· {standing.pts} PTS</span>
                                    </button>
                                  ) : (
                                    <span className="text-[11px] text-sky-200/80">Sin registro</span>
                                  )}
                                </td>
                                <td className="py-2.5 pl-3 pr-5 text-right space-x-2 whitespace-nowrap">
                                  {!isAdminOwn && (
                                    <button
                                      type="button"
                                      onClick={() => handleSetAdminTeam(t.id)}
                                      className="px-2.5 py-1 text-xs font-semibold text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 rounded-lg"
                                    >
                                      Usar como mi equipo
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => startEditTeam(t)}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                                      isEditingRow
                                        ? 'btn-gold-luxury'
                                        : 'text-amber-100 bg-[#0A294E] hover:bg-[#0D3666] border border-amber-400/45'
                                    }`}
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>{isEditingRow ? 'Cerrando' : 'Editar ID / Clave'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteTeam(t.id)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 rounded-lg"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Borrar</span>
                                  </button>
                                </td>
                              </tr>

                              {isEditingRow && (
                                <tr ref={editFormRef} className="bg-[#08264A]">
                                  <td colSpan={7} className="p-5 border-t border-b border-amber-400/40">
                                    <form onSubmit={handleSaveEditTeam} className="space-y-4">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="text-xs font-semibold text-amber-300">
                                          Editando credenciales y datos de <strong className="text-amber-50">{t.name} ({t.id})</strong>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => setEditingTeam(null)}
                                          className="text-sky-200/80 hover:text-amber-100"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>

                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                                        <div>
                                          <label className="block text-xs font-semibold text-amber-300 mb-1">
                                            ID de Acceso
                                          </label>
                                          <input
                                            type="text"
                                            required
                                            value={editId}
                                            onChange={(e) => setEditId(e.target.value)}
                                            className="w-full px-3 py-2 text-sm font-mono font-bold bg-[#041224] text-amber-50 border border-amber-400/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-xs font-semibold text-amber-300 mb-1">
                                            Clave de Acceso
                                          </label>
                                          <input
                                            type="text"
                                            required
                                            value={editClave}
                                            onChange={(e) => setEditClave(e.target.value)}
                                            className="w-full px-3 py-2 text-sm font-mono font-bold bg-[#041224] text-amber-50 border border-amber-400/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-xs font-semibold text-sky-100/90 mb-1">
                                            Nombre Equipo
                                          </label>
                                          <input
                                            type="text"
                                            required
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="w-full px-3 py-2 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-xs font-semibold text-sky-100/90 mb-1">
                                            Nombre Miembro
                                          </label>
                                          <input
                                            type="text"
                                            required
                                            value={editMember}
                                            onChange={(e) => setEditMember(e.target.value)}
                                            className="w-full px-3 py-2 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                                          />
                                        </div>
                                        <div className="flex items-center gap-2.5">
                                          <ResilientImage
                                            src={editCrestPreview || t.crestUrl}
                                            alt={t.name}
                                            className="w-10 h-10 rounded-lg object-contain bg-[#041224] border border-amber-400/50 p-0.5 shrink-0"
                                          />
                                          <div className="min-w-0 flex-1">
                                            <label className="block text-xs font-semibold text-sky-100/90 mb-1">
                                              Escudo (128x128)
                                            </label>
                                            <input
                                              type="file"
                                              accept="image/*"
                                              onChange={(e) => setEditCrestFile(e.target.files?.[0] || null)}
                                              className="w-full text-xs text-sky-100/90"
                                            />
                                          </div>
                                        </div>
                                      </div>

                                      <div>
                                        <label className="block text-xs font-semibold text-sky-100/90 mb-1">
                                          Lema / Bio del Equipo
                                        </label>
                                        <input
                                          type="text"
                                          value={editBio}
                                          onChange={(e) => setEditBio(e.target.value)}
                                          placeholder="Descripción o lema del DT..."
                                          className="w-full px-3 py-2 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                                        />
                                      </div>

                                      <div className="flex justify-end gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setEditingTeam(null)}
                                          className="px-4 py-2 text-xs font-semibold text-sky-100/90 bg-[#0A294E] border border-amber-400/45 rounded-lg"
                                        >
                                          Cancelar
                                        </button>
                                        <button
                                          type="submit"
                                          disabled={savingEditTeam}
                                          className="px-5 py-2 text-xs font-semibold btn-gold-luxury disabled:opacity-50 rounded-lg"
                                        >
                                          {savingEditTeam ? 'Guardando...' : 'Guardar ID, Clave y Datos'}
                                        </button>
                                      </div>
                                    </form>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 2. Validación de Resultados */}
          {adminTab === 'validacion' && (
            <div className="space-y-4">
              <div className="p-5 bg-[#071D38]/95 border border-amber-400/50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-display text-2xl font-bold text-albiceleste-shiny">
                    Validar Resultados de los Miembros
                  </h3>
                  <p className="text-xs text-sky-200/80">
                    Revisá cada resultado subido por los miembros, mirá la foto adjunta, corregí el marcador si hace falta y validalo para publicarlo en Partidos y Tabla de Posiciones.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1 p-1 bg-[#05162B] border border-amber-400/50 rounded-xl shrink-0">
                  {(
                    [
                      { id: 'pending', label: `Pendientes (${pendingMatches.length})` },
                      { id: 'validated', label: `Validados (${validatedMatches.length})` },
                      { id: 'rejected', label: `Rechazados (${rejectedMatches.length})` },
                      { id: 'all', label: `Todos (${matches.length})` },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setValidationFilter(f.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                        validationFilter === f.id
                          ? 'btn-gold-luxury'
                          : 'text-sky-100/90 hover:text-amber-100'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {validationMsg && (
                <div className="p-3.5 text-sm bg-emerald-950/60 border border-emerald-400/40 text-emerald-200 rounded-xl">
                  {validationMsg}
                </div>
              )}

              {filteredValidationMatches.length === 0 ? (
                <div className="p-10 text-center bg-[#071D38]/95 border border-amber-400/45 rounded-2xl text-sm text-sky-200/80">
                  {validationFilter === 'pending'
                    ? 'No hay resultados pendientes de validación en este momento.'
                    : 'No hay partidos en esta categoría.'}
                </div>
              ) : (
                filteredValidationMatches.map((m) => {
                  const home = teamMap.get(m.homeTeamId);
                  const away = teamMap.get(m.awayTeamId);
                  const isEditingScore = editingMatchId === m.id;
                  return (
                    <div
                      key={m.id}
                      className="p-5 bg-[#071D38]/95 border border-amber-400/50 rounded-2xl flex flex-col gap-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-sky-200/80">
                        <div>
                          Fecha {m.matchday} · {m.leg} · {m.playedAt} · Enviado por{' '}
                          <strong className="text-amber-100">{m.submittedByName}</strong>
                        </div>
                        <div className="font-semibold">
                          {m.status === 'validated' && (
                            <span className="text-emerald-400">Oficial Validado</span>
                          )}
                          {m.status === 'pending' && (
                            <span className="text-amber-300">Pendiente de Validación</span>
                          )}
                          {m.status === 'rejected' && (
                            <span className="text-rose-400">Rechazado</span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-2">
                            <ResilientImage
                              src={home?.crestUrl}
                              alt={home?.name || m.homeTeamId}
                              className="w-9 h-9 rounded-lg object-contain bg-[#041224] border border-amber-400/50 p-0.5"
                              fallbackLabel={m.homeTeamId}
                            />
                            <span className="font-display text-xl font-bold text-amber-50">
                              {home?.name || m.homeTeamId}
                            </span>
                          </div>

                          {isEditingScore ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={0}
                                value={editHomeGoals}
                                onChange={(e) => setEditHomeGoals(e.target.value)}
                                className="w-14 px-2 py-1 text-center font-mono font-bold bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                              />
                              <span className="font-bold text-sky-100/90">-</span>
                              <input
                                type="number"
                                min={0}
                                value={editAwayGoals}
                                onChange={(e) => setEditAwayGoals(e.target.value)}
                                className="w-14 px-2 py-1 text-center font-mono font-bold bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveMatchScore(m.id, m.status !== 'validated')}
                                className="px-2.5 py-1 text-xs font-semibold btn-gold-luxury rounded-lg"
                              >
                                {m.status !== 'validated' ? 'Guardar y Validar' : 'Guardar'}
                              </button>
                            </div>
                          ) : (
                            <span className="px-3.5 py-1 rounded-lg bg-[#041224] border border-amber-400/35 font-mono text-xl font-extrabold text-amber-300 tabular-nums">
                              {m.homeGoals} - {m.awayGoals}
                            </span>
                          )}

                          <div className="flex items-center gap-2">
                            <ResilientImage
                              src={away?.crestUrl}
                              alt={away?.name || m.awayTeamId}
                              className="w-9 h-9 rounded-lg object-contain bg-[#041224] border border-amber-400/50 p-0.5"
                              fallbackLabel={m.awayTeamId}
                            />
                            <span className="font-display text-xl font-bold text-amber-50">
                              {away?.name || m.awayTeamId}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {m.proofImageUrl && (
                            <button
                              type="button"
                              onClick={() => setProofModalUrl(m.proofImageUrl || null)}
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-200 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 rounded-lg"
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                              <span>Ver foto del resultado</span>
                            </button>
                          )}
                          {m.scorerImageUrl && (
                            <button
                              type="button"
                              onClick={() => setProofModalUrl(m.scorerImageUrl || null)}
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 rounded-lg"
                            >
                              <Award className="w-3.5 h-3.5" />
                              <span>{m.scorerName ? `Goleador: ${m.scorerName}` : 'Foto Goleador'}</span>
                            </button>
                          )}
                          {m.status !== 'validated' && (
                            <button
                              type="button"
                              onClick={() => handleValidateMatch(m.id, 'validated')}
                              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg"
                            >
                              <Check className="w-4 h-4" />
                              <span>Validar y Publicar</span>
                            </button>
                          )}
                          {m.status !== 'rejected' && (
                            <button
                              type="button"
                              onClick={() => handleValidateMatch(m.id, 'rejected')}
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-200 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 rounded-lg"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Rechazar</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMatchId(isEditingScore ? null : m.id);
                              setEditHomeGoals(String(m.homeGoals));
                              setEditAwayGoals(String(m.awayGoals));
                              setEditMatchday(String(m.matchday));
                              setEditLeg(m.leg);
                              setEditPlayedAt(m.playedAt);
                              setEditMatchNotes(m.notes || '');
                            }}
                            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-amber-100 bg-[#0A294E] hover:bg-[#0D3666] border border-amber-400/45 rounded-lg"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>{isEditingScore ? 'Cancelar' : 'Editar Partido'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMatch(m.id)}
                            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Borrar</span>
                          </button>
                        </div>
                      </div>

                      {isEditingScore && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-amber-400/15">
                          <div>
                            <label className="block text-[11px] font-semibold text-sky-200/80 mb-1">
                              Fecha
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={editMatchday}
                              onChange={(e) => setEditMatchday(e.target.value)}
                              className="w-full px-3 py-1.5 text-xs bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-sky-200/80 mb-1">
                              Ronda
                            </label>
                            <select
                              value={editLeg}
                              onChange={(e) => setEditLeg(e.target.value === 'Vuelta' ? 'Vuelta' : 'Ida')}
                              className="w-full px-3 py-1.5 text-xs bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                            >
                              <option value="Ida">Ida</option>
                              <option value="Vuelta">Vuelta</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-sky-200/80 mb-1">
                              Día del Partido
                            </label>
                            <input
                              type="date"
                              value={editPlayedAt}
                              onChange={(e) => setEditPlayedAt(e.target.value)}
                              className="w-full px-3 py-1.5 text-xs bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-sky-200/80 mb-1">
                              Comentarios
                            </label>
                            <input
                              type="text"
                              value={editMatchNotes}
                              onChange={(e) => setEditMatchNotes(e.target.value)}
                              placeholder="Observaciones del partido..."
                              className="w-full px-3 py-1.5 text-xs bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                            />
                          </div>
                        </div>
                      )}

                      {m.notes && !isEditingScore && (
                        <div className="text-xs text-sky-100/90 pt-2 border-t border-amber-400/15">
                          Comentarios: {m.notes}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* 2B. Cruces por Fecha (Admin Fixture Scheduler) */}
          {adminTab === 'cruces' && (
            <div className="space-y-6">
              <form
                onSubmit={handleCreateFixture}
                className="p-6 bg-[#071D38]/95 border border-amber-400/50 rounded-2xl space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-2xl font-bold text-albiceleste-shiny">
                      Programar Cruces por Fecha
                    </h3>
                    <p className="text-xs text-sky-200/80">
                      Armá los enfrentamientos de cada fecha para que los miembros puedan verlos y cargar el resultado directo.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('partidos', 'fixtures')}
                    className="text-xs font-semibold text-amber-300 hover:text-amber-200"
                  >
                    Ver en Partidos →
                  </button>
                </div>

                {fxMsg && (
                  <div
                    className={`p-3 text-sm rounded-xl border ${
                      fxMsg.type === 'ok'
                        ? 'bg-emerald-950/60 border-emerald-400/40 text-emerald-200'
                        : 'bg-rose-950/60 border-rose-400/40 text-rose-200'
                    }`}
                  >
                    {fxMsg.text}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-sky-100/90 mb-1">Fecha N°</label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={fxMatchday}
                      onChange={(e) => setFxMatchday(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-sky-100/90 mb-1">Ronda</label>
                    <select
                      value={fxLeg}
                      onChange={(e) => setFxLeg(e.target.value === 'Vuelta' ? 'Vuelta' : 'Ida')}
                      className="w-full px-3 py-2 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                    >
                      <option value="Ida">Ida</option>
                      <option value="Vuelta">Vuelta</option>
                    </select>
                  </div>
                  <div className="lg:col-span-2">
                    <label className="block text-xs font-semibold text-sky-100/90 mb-1">Local</label>
                    <select
                      value={fxHomeTeamId}
                      onChange={(e) => setFxHomeTeamId(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                    >
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.memberName})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="lg:col-span-2">
                    <label className="block text-xs font-semibold text-sky-100/90 mb-1">Visitante</label>
                    <select
                      value={fxAwayTeamId}
                      onChange={(e) => setFxAwayTeamId(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                    >
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.memberName})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-200 mb-1">Día del Calendario (opcional)</label>
                    <input
                      type="date"
                      value={fxDate}
                      onChange={(e) => setFxDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono bg-[#06070A] text-white border border-amber-400/50 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-200 mb-1">Hora (sincronizada)</label>
                    <input
                      type="time"
                      value={fxTime}
                      onChange={(e) => setFxTime(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono bg-[#06070A] text-amber-300 border border-amber-400/50 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-200 mb-1">Nota (opcional)</label>
                    <input
                      type="text"
                      value={fxNotes}
                      onChange={(e) => setFxNotes(e.target.value)}
                      placeholder="Ej: Clásico de la fecha"
                      className="w-full px-3 py-2 text-sm bg-[#06070A] text-white border border-amber-400/50 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingFx}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold btn-gold-luxury disabled:opacity-50 rounded-xl"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{savingFx ? 'Guardando...' : 'Agregar Cruce'}</span>
                  </button>
                </div>
              </form>

              <div className="space-y-3">
                {fixtures.length === 0 ? (
                  <div className="p-10 text-center bg-[#071D38]/95 border border-amber-400/45 rounded-2xl text-sm text-sky-200/80">
                    Todavía no programaste cruces por fecha.
                  </div>
                ) : (
                  [...fixtures]
                    .sort((a, b) => a.matchday - b.matchday)
                    .map((fx) => {
                      const home = teamMap.get(fx.homeTeamId);
                      const away = teamMap.get(fx.awayTeamId);
                      return (
                        <div
                          key={fx.id}
                          className="p-4 bg-[#071D38]/95 border border-amber-400/45 rounded-xl flex flex-wrap items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 text-sm">
                            <span className="px-2.5 py-1 rounded bg-amber-500/15 border border-amber-400/50 text-amber-300 font-mono text-xs font-bold">
                              Fecha {fx.matchday} · {fx.leg}
                            </span>
                            <span className="font-bold text-amber-50">{home?.name || fx.homeTeamId}</span>
                            <span className="text-sky-200/80 text-xs">vs</span>
                            <span className="font-bold text-amber-50">{away?.name || fx.awayTeamId}</span>
                            {fx.scheduledDate && (
                              <span className="text-xs text-emerald-300 font-mono">
                                {fx.scheduledDate}{fx.scheduledTime ? ` · ${fx.scheduledTime}hs` : ''}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteFixture(fx.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Eliminar</span>
                          </button>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          )}

          {/* 2C. Reclamos de Partidos (Tarjetas y Videos .MP4 -> Dictamen del Admin) */}
          {adminTab === 'reclamos' && (
            <div className="space-y-4">
              <div className="p-5 bg-[#071D38]/95 border border-rose-400/25 rounded-2xl">
                <h3 className="font-display text-2xl font-bold text-albiceleste-shiny flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-rose-400" />
                  <span>Bandeja de Reclamos (Tarjetas y Goles Prohibidos)</span>
                </h3>
                <p className="text-xs text-sky-200/80 mt-0.5">
                  Revisá las fotos de tarjetas amarillas/rojas y videos .MP4 subidos por los miembros. Dictaminá si el partido es Válido o Inválido.
                </p>
              </div>

              {claimsMsg && (
                <div className="p-3.5 text-sm bg-emerald-950/60 border border-emerald-400/40 text-emerald-200 rounded-xl">
                  {claimsMsg}
                </div>
              )}

              {claims.length === 0 ? (
                <div className="p-10 text-center bg-[#071D38]/95 border border-amber-400/45 rounded-2xl text-sm text-sky-200/80">
                  No hay reclamos pendientes o históricos.
                </div>
              ) : (
                claims.map((c) => (
                  <div
                    key={c.id}
                    className="p-5 bg-[#071D38]/95 border border-rose-400/25 rounded-2xl space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-1 rounded bg-rose-500/15 border border-rose-400/30 font-semibold text-rose-200">
                          {c.reasonType === 'gol_prohibido'
                            ? 'Gol Prohibido'
                            : c.reasonType === 'juego_sucio'
                            ? 'Tarjetas / Juego Sucio'
                            : 'Otro Reclamo'}
                        </span>
                        <span className="text-sky-100/90">
                          Por <strong className="text-amber-50">{c.reporterName}</strong>
                        </span>
                        {c.accusedTeamName && (
                          <span className="text-amber-300">vs {c.accusedTeamName}</span>
                        )}
                      </div>
                      <span className="font-semibold text-xs">
                        {c.status === 'pending' && <span className="text-amber-300">Pendiente de Dictamen</span>}
                        {c.status === 'valid_match' && <span className="text-emerald-300">Partido Válido</span>}
                        {c.status === 'invalid_match' && <span className="text-rose-300">Partido Inválido</span>}
                        {c.status === 'dismissed' && <span className="text-sky-200/80">Desestimado</span>}
                      </span>
                    </div>

                    <p className="text-sm text-zinc-200">{c.description}</p>

                    <div className="flex flex-wrap items-center gap-3">
                      {c.cardPhotoUrl && (
                        <button
                          type="button"
                          onClick={() => setProofModalUrl(c.cardPhotoUrl || null)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-200 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 rounded-lg"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>Ver Foto de Tarjetas</span>
                        </button>
                      )}
                    </div>

                    {c.videoUrl && (
                      <div className="aspect-video max-w-lg bg-[#041224] rounded-xl overflow-hidden border border-amber-400/45">
                        <video controls playsInline preload="metadata" src={c.videoUrl} className="w-full h-full object-contain" />
                      </div>
                    )}

                    <div className="pt-3 border-t border-amber-400/15 space-y-3">
                      <input
                        type="text"
                        value={claimNoteDrafts[c.id] ?? c.adminResolutionNote ?? ''}
                        onChange={(e) =>
                          setClaimNoteDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))
                        }
                        placeholder="Escribí el dictamen o explicación del Administrador (opcional)..."
                        className="w-full px-3.5 py-2 text-xs bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleResolveClaim(c.id, 'valid_match')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Dictaminar Partido Válido</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResolveClaim(c.id, 'invalid_match')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Dictaminar Partido Inválido</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResolveClaim(c.id, 'dismissed')}
                          className="px-3 py-2 text-xs font-semibold text-zinc-200 bg-[#0A294E] hover:bg-[#0D3666] border border-amber-400/45 rounded-lg"
                        >
                          Desestimar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClaim(c.id)}
                          className="ml-auto inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Borrar Reclamo</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* 2D. Verificación Absoluta de Archivos Subidos */}
          {adminTab === 'archivos' && (
            <div className="space-y-4">
              <div className="p-5 bg-[#071D38]/95 border border-emerald-400/25 rounded-2xl">
                <h3 className="font-display text-2xl font-bold text-albiceleste-shiny flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span>Verificar Archivos Subidos por los Miembros</span>
                </h3>
                <p className="text-xs text-sky-200/80 mt-0.5">
                  Control total del Administrador: aprobá o quitá al instante cualquier foto de festejo, captura de partido, goleador o archivo de reclamo subido por los miembros.
                </p>
              </div>

              {moderationMsg && (
                <div className="p-3.5 text-sm bg-emerald-950/60 border border-emerald-400/40 text-emerald-200 rounded-xl">
                  {moderationMsg}
                </div>
              )}

              {uploadedMediaItems.length === 0 ? (
                <div className="p-10 text-center bg-[#071D38]/95 border border-amber-400/45 rounded-2xl text-sm text-sky-200/80">
                  No hay archivos de miembros pendientes o cargados para revisar.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {uploadedMediaItems.map((item) => (
                    <div
                      key={item.key}
                      className={`p-4 bg-[#071D38]/95 rounded-2xl border flex flex-col justify-between gap-3 ${
                        item.status === 'pending' ? 'border-amber-400/50' : 'border-amber-400/45'
                      }`}
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-amber-50 truncate">{item.title}</span>
                          {!item.isVideo && (
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold shrink-0 ${
                                item.status === 'pending'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-emerald-500/20 text-emerald-300'
                              }`}
                            >
                              {item.status === 'pending' ? 'Por verificar' : 'Aprobado'}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-sky-200/80">{item.subtitle}</div>
                        <div className="aspect-video bg-[#041224] rounded-xl overflow-hidden border border-amber-400/45">
                          {item.isVideo ? (
                            <video controls playsInline preload="metadata" src={item.url} className="w-full h-full object-contain" />
                          ) : (
                            <button
                              type="button"
                              onClick={() => setProofModalUrl(item.url)}
                              className="w-full h-full block"
                            >
                              <ResilientImage
                                src={item.url}
                                alt={item.title}
                                className="w-full h-full object-cover hover:scale-105 transition-transform"
                              />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-amber-400/15">
                        {!item.isVideo && item.status !== 'approved' && (
                          <button
                            type="button"
                            onClick={() => handleModerateMedia(item.kind, item.targetId, 'approve')}
                            className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Aprobar</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleModerateMedia(item.kind, item.targetId, 'remove')}
                          className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-200 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/35 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Quitar Archivo</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. Reglamento y Modo de Juego */}
          {adminTab === 'reglamento' && (
            <form
              onSubmit={handleSaveRules}
              className="p-6 bg-[#071D38]/95 border border-amber-400/50 rounded-2xl space-y-6"
            >
              {rulesMsg && (
                <div className="p-3 text-sm bg-emerald-950/60 border border-emerald-400/40 text-emerald-200 rounded-xl">
                  {rulesMsg}
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-2xl font-bold text-albiceleste-shiny">
                    Reglas de la Liga
                  </h3>
                  <button
                    type="button"
                    onClick={() => setRulesList((prev) => [...prev, ''])}
                    className="text-xs font-semibold text-amber-300 hover:text-amber-200"
                  >
                    + Agregar regla
                  </button>
                </div>

                {rulesList.map((rule, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={rule}
                      onChange={(e) =>
                        setRulesList((prev) =>
                          prev.map((item, i) => (i === idx ? e.target.value : item))
                        )
                      }
                      className="flex-1 px-3.5 py-2 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setRulesList((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="p-2 text-rose-400 hover:bg-rose-500/15 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {(
                  [
                    ['partidos', 'Partidos'],
                    ['tiempo', 'Tiempo'],
                    ['condicion', 'Condición'],
                    ['lesiones', 'Lesiones'],
                    ['cambios', 'Cambios'],
                    ['pausas', 'Pausas'],
                    ['clima', 'Clima'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-sky-100/90 mb-1">
                      {label}
                    </label>
                    <input
                      type="text"
                      value={gameMode[key]}
                      onChange={(e) =>
                        setGameMode((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-sky-100/90 mb-1">
                  Notas generales del reglamento
                </label>
                <textarea
                  rows={2}
                  value={generalNotes}
                  onChange={(e) => setGeneralNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                />
              </div>

              <div className="pt-4 border-t border-amber-400/15 space-y-4">
                <div>
                  <h4 className="font-display text-xl font-bold text-albiceleste-shiny">
                    Reglamento de la Copa de la Liga y Recopa
                  </h4>
                  <p className="text-xs text-sky-200/80">
                    Configurá el formato de eliminación directa, Tiempo Extra y Penales que se muestra en Reglamento.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-sky-100/90 mb-1">
                      Formato de Eliminación
                    </label>
                    <input
                      type="text"
                      value={cupRules.format}
                      onChange={(e) =>
                        setCupRules((prev) => ({ ...prev, format: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-sky-100/90 mb-1">
                      Tiempo Extra
                    </label>
                    <input
                      type="text"
                      value={cupRules.extraTime}
                      onChange={(e) =>
                        setCupRules((prev) => ({ ...prev, extraTime: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-sky-100/90 mb-1">
                      Definición por Penales
                    </label>
                    <input
                      type="text"
                      value={cupRules.penalties}
                      onChange={(e) =>
                        setCupRules((prev) => ({ ...prev, penalties: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-sky-100/90 mb-1">
                    Notas de Copa de la Liga y Recopa
                  </label>
                  <textarea
                    rows={2}
                    value={cupRules.notes}
                    onChange={(e) =>
                      setCupRules((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    className="w-full px-3.5 py-2 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 text-sm font-semibold btn-gold-luxury rounded-xl"
                >
                  Guardar Reglamento
                </button>
              </div>
            </form>
          )}

          {/* 4. Música del Sitio */}
          {adminTab === 'musica' && (
            <div className="space-y-6">
              <form
                onSubmit={handleAddMusic}
                className="p-6 bg-[#071D38]/95 border border-amber-400/50 rounded-2xl space-y-4"
              >
                <h3 className="font-display text-2xl font-bold text-albiceleste-shiny">
                  Cargar Varias Canciones MP3
                </h3>
                <p className="text-xs text-sky-200/80">
                  Seleccioná todos los archivos MP3 que quieras a la vez (no hace falta escribir nombre ni artista).
                </p>
                {musicMsg && (
                  <div className="p-3 text-sm bg-amber-950/50 border border-amber-400/40 text-amber-200 rounded-xl">
                    {musicMsg}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-sky-100/90 mb-1">
                      Archivos MP3 (podés seleccionar varios juntos)
                    </label>
                    <input
                      type="file"
                      multiple
                      accept=".mp3,.wav,.ogg,.m4a,audio/mpeg,audio/*"
                      onChange={(e) => setTrackFiles(e.target.files)}
                      className="w-full text-xs text-sky-100/90 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-400/20 file:text-amber-300 hover:file:bg-amber-400/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-sky-100/90 mb-1">
                      O URL de audio directa (opcional)
                    </label>
                    <input
                      type="url"
                      value={trackUrl}
                      onChange={(e) => setTrackUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={uploadingMusic}
                    className="px-5 py-2.5 text-sm font-semibold btn-gold-luxury disabled:opacity-50 rounded-xl"
                  >
                    {uploadingMusic ? 'Subiendo...' : 'Subir Canciones a la Lista'}
                  </button>
                </div>
              </form>

              <div className="bg-[#071D38]/95 border border-amber-400/50 rounded-2xl divide-y divide-amber-400/15">
                {music.map((t) => (
                  <div key={t.id} className="px-6 py-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold text-amber-50">{t.title}</div>
                      <div className="text-xs text-sky-200/80">{t.artist}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteMusic(t.id)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-rose-400 hover:text-rose-300"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Quitar</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. Videos Destacados y Edición */}
          {adminTab === 'videos' && (
            <div className="space-y-6">
              <div className="p-6 bg-[#071D38]/95 border border-amber-400/50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-display text-2xl font-bold text-albiceleste-shiny">
                    Administrar Videos de Goles y Destacado del Inicio
                  </h3>
                  <p className="text-xs text-sky-200/80">
                    Elegí tu video favorito entre los goles subidos por los miembros para que aparezca destacado en la página de Inicio.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('galeria')}
                  className="px-4 py-2 text-xs font-semibold btn-gold-luxury rounded-lg transition-colors whitespace-nowrap"
                >
                  Ir a Galería para subir videos
                </button>
              </div>

              {videoMsg && (
                <div className="p-3 text-sm bg-emerald-950/60 border border-emerald-400/40 text-emerald-200 rounded-xl">
                  {videoMsg}
                </div>
              )}

              {communityVideos.length === 0 && videos.length === 0 ? (
                <div className="p-8 bg-[#071D38]/95 border border-amber-400/45 rounded-2xl text-center text-sm text-sky-200/80">
                  Todavía no hay videos subidos en la Galería.
                </div>
              ) : (
                <div className="space-y-6">
                  {communityVideos.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-display text-xl font-bold text-albiceleste-shiny">
                        Videos de Goles Subidos por Miembros ({communityVideos.length})
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {communityVideos.map((cv) => {
                          const isFeatured = settings.featuredVideo?.id === cv.id;
                          return (
                            <div
                              key={cv.id}
                              className={`p-4 bg-[#071D38]/95 rounded-2xl border space-y-3 ${
                                isFeatured ? 'border-amber-400/70' : 'border-amber-400/45'
                              }`}
                            >
                              <div className="aspect-video bg-[#041224] rounded-xl overflow-hidden">
                                <video
                                  controls
                                  playsInline
                                  preload="metadata"
                                  src={cv.videoUrl}
                                  className="w-full h-full object-contain"
                                />
                              </div>
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="font-semibold text-amber-50 truncate">{cv.titulo}</div>
                                  <div className="text-xs text-sky-200/80">
                                    Subido por <span className="text-amber-300">{cv.autor}</span> · {cv.fechaLabel}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleFeatureCommunityVideo(cv)}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                                      isFeatured
                                        ? 'btn-gold-luxury'
                                        : 'bg-[#0A294E] text-amber-300 hover:bg-amber-400/20 border border-amber-400/30'
                                    }`}
                                  >
                                    <Star className={`w-3.5 h-3.5 ${isFeatured ? 'fill-zinc-950' : ''}`} />
                                    <span>{isFeatured ? 'Destacado en Inicio' : 'Elegir Favorito'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCommunityVideo(cv.id)}
                                    aria-label={`Eliminar ${cv.titulo}`}
                                    className="p-1.5 text-rose-400 hover:bg-rose-500/15 rounded-lg"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {videos.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-display text-xl font-bold text-albiceleste-shiny">
                        Archivo de Videos Locales / Oficiales ({videos.length})
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {videos.map((v) => {
                          const isEditingVid = editingVideoId === v.id;
                          const isFeatured = settings.featuredVideo?.id === v.id || (!settings.featuredVideo && v.featured);
                          return (
                            <div
                              key={v.id}
                              className={`p-4 bg-[#071D38]/95 rounded-2xl border space-y-3 ${
                                isFeatured ? 'border-amber-400/60' : 'border-amber-400/45'
                              }`}
                            >
                              <div className="aspect-video bg-[#041224] rounded-xl overflow-hidden">
                                <video
                                  controls
                                  playsInline
                                  preload="metadata"
                                  src={v.videoUrl}
                                  className="w-full h-full object-contain"
                                >
                                  <source src={v.videoUrl} type="video/mp4" />
                                </video>
                              </div>

                              {isEditingVid ? (
                                <div className="space-y-2 pt-1">
                                  <input
                                    type="text"
                                    value={editVideoTitle}
                                    onChange={(e) => setEditVideoTitle(e.target.value)}
                                    placeholder="Título del video"
                                    className="w-full px-3 py-1.5 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                                  />
                                  <input
                                    type="text"
                                    value={editVideoDesc}
                                    onChange={(e) => setEditVideoDesc(e.target.value)}
                                    placeholder="Descripción (opcional)"
                                    className="w-full px-3 py-1.5 text-xs bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                                  />
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setEditingVideoId(null)}
                                      className="px-3 py-1.5 text-xs font-semibold text-sky-100/90 bg-[#0A294E] border border-amber-400/45 rounded-lg"
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveVideoMeta(v.id)}
                                      className="px-3 py-1.5 text-xs font-semibold btn-gold-luxury rounded-lg"
                                    >
                                      Guardar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="font-semibold text-amber-50 truncate">{v.title}</div>
                                    {v.description && (
                                      <div className="text-xs text-sky-100/90 truncate">{v.description}</div>
                                    )}
                                    <div className="text-xs text-sky-200/80">
                                      {v.originalFormat} · Subido por {v.uploadedBy}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleFeatureVideo(v.id)}
                                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                                        isFeatured
                                          ? 'btn-gold-luxury'
                                          : 'bg-[#0A294E] text-amber-300 hover:bg-amber-400/20 border border-amber-400/30'
                                      }`}
                                    >
                                      <Star className="w-3.5 h-3.5" />
                                      <span>{isFeatured ? 'Destacado' : 'Destacar'}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingVideoId(v.id);
                                        setEditVideoTitle(v.title);
                                        setEditVideoDesc(v.description || '');
                                      }}
                                      aria-label={`Editar ${v.title}`}
                                      className="p-1.5 text-sky-100/90 bg-[#0A294E] hover:bg-[#0D3666] border border-amber-400/45 rounded-lg"
                                    >
                                      <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteVideo(v.id)}
                                      aria-label={`Eliminar ${v.title}`}
                                      className="p-1.5 text-rose-400 hover:bg-rose-500/15 rounded-lg"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 6. Campeones y Festejos */}
          {adminTab === 'campeones' && (
            <div className="space-y-6">
              <form
                onSubmit={handleCreateChampion}
                className="p-6 bg-[#071D38]/95 border border-amber-400/50 rounded-2xl space-y-4"
              >
                <div>
                  <h3 className="font-display text-2xl font-bold text-albiceleste-shiny">
                    Agregar o Editar Campeones de la Liga
                  </h3>
                  <p className="text-xs text-sky-200/80">
                    Publicá un nuevo campeón con su festejo en PNG o editá los campeones ya cargados.
                  </p>
                </div>

                {champMsg && (
                  <div
                    className={`p-3 text-sm rounded-xl border ${
                      champMsg.type === 'ok'
                        ? 'bg-emerald-950/60 border-emerald-400/40 text-emerald-200'
                        : 'bg-rose-950/60 border-rose-400/40 text-rose-200'
                    }`}
                  >
                    {champMsg.text}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-sky-100/90 mb-1">
                      Competencia
                    </label>
                    <select
                      value={newChampType}
                      onChange={(e) =>
                        setNewChampType(e.target.value as 'liga' | 'copa' | 'recopa')
                      }
                      className="w-full px-3 py-2 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                    >
                      <option value="liga">Liga Master</option>
                      <option value="copa">Copa de la Liga</option>
                      <option value="recopa">Recopa (Gran Campeón)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-sky-100/90 mb-1">
                      Temporada / Edición
                    </label>
                    <input
                      type="text"
                      required
                      value={newChampSeason}
                      onChange={(e) => setNewChampSeason(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-sky-100/90 mb-1">
                      Equipo Campeón
                    </label>
                    <input
                      type="text"
                      required
                      value={newChampTeam}
                      onChange={(e) => setNewChampTeam(e.target.value)}
                      placeholder="Ej: Boca Juniors"
                      className="w-full px-3 py-2 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-sky-100/90 mb-1">
                      Nombre del Miembro
                    </label>
                    <input
                      type="text"
                      required
                      value={newChampMember}
                      onChange={(e) => setNewChampMember(e.target.value)}
                      placeholder="Ej: ElXeneize_06"
                      className="w-full px-3 py-2 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-sky-100/90 mb-1">
                      Imagen PNG de Festejos
                    </label>
                    <input
                      ref={newChampInputRef}
                      type="file"
                      accept=".png,image/png"
                      required
                      onChange={(e) => setNewChampFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-sky-100/90 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-400/20 file:text-amber-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-sky-100/90 mb-1">
                    Reseña del Campeonato (opcional)
                  </label>
                  <input
                    type="text"
                    value={newChampNotes}
                    onChange={(e) => setNewChampNotes(e.target.value)}
                    placeholder="Detalle de la final, goleador, etc."
                    className="w-full px-3 py-2 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingChamp}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold btn-gold-luxury disabled:opacity-50 rounded-xl"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{savingChamp ? 'Publicando...' : 'Agregar Campeón'}</span>
                  </button>
                </div>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {champions.map((c) => {
                  const isEditingChamp = editingChampId === c.id;
                  const typePrefix =
                    c.tournamentType === 'copa'
                      ? 'Copa de la Liga · '
                      : c.tournamentType === 'recopa'
                      ? 'Recopa (Gran Campeón) · '
                      : 'Liga Master · ';
                  return (
                    <div
                      key={c.id}
                      className="p-4 bg-[#071D38]/95 border border-amber-400/50 rounded-2xl space-y-3"
                    >
                      <div className="flex items-start gap-4">
                        <ResilientImage
                          src={c.celebrationImageUrl}
                          alt={`Festejo ${c.teamName}`}
                          className="w-24 h-20 rounded-xl object-cover bg-[#041224] border border-amber-400/45 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-amber-300">
                            {typePrefix}
                            {c.season}
                          </div>
                          <div className="font-display text-xl font-bold text-amber-50 truncate">
                            {c.teamName}
                          </div>
                          <div className="text-xs text-amber-200/90">{c.memberName}</div>
                          {c.notes && (
                            <p className="text-xs text-sky-200/80 mt-1 line-clamp-2">{c.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              if (isEditingChamp) {
                                setEditingChampId(null);
                              } else {
                                setEditingChampId(c.id);
                                setEditChampType(c.tournamentType || 'liga');
                                setEditChampSeason(c.season);
                                setEditChampTeam(c.teamName);
                                setEditChampMember(c.memberName);
                                setEditChampNotes(c.notes || '');
                                setEditChampFile(null);
                              }
                            }}
                            className="p-1.5 text-sky-100/90 bg-[#0A294E] hover:bg-[#0D3666] border border-amber-400/45 rounded-lg"
                            aria-label={`Editar campeón ${c.teamName}`}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteChampion(c.id)}
                            className="p-1.5 text-rose-400 hover:bg-rose-500/15 rounded-lg"
                            aria-label={`Eliminar campeón ${c.teamName}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {isEditingChamp && (
                        <form
                          onSubmit={handleSaveEditChampion}
                          className="pt-3 border-t border-amber-400/15 space-y-3"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                            <select
                              value={editChampType}
                              onChange={(e) =>
                                setEditChampType(e.target.value as 'liga' | 'copa' | 'recopa')
                              }
                              className="px-3 py-1.5 text-xs bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                            >
                              <option value="liga">Liga Master</option>
                              <option value="copa">Copa de la Liga</option>
                              <option value="recopa">Recopa (Gran Campeón)</option>
                            </select>
                            <input
                              type="text"
                              required
                              value={editChampSeason}
                              onChange={(e) => setEditChampSeason(e.target.value)}
                              placeholder="Temporada"
                              className="px-3 py-1.5 text-xs bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                            />
                            <input
                              type="text"
                              required
                              value={editChampTeam}
                              onChange={(e) => setEditChampTeam(e.target.value)}
                              placeholder="Equipo Campeón"
                              className="px-3 py-1.5 text-xs bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                            />
                            <input
                              type="text"
                              required
                              value={editChampMember}
                              onChange={(e) => setEditChampMember(e.target.value)}
                              placeholder="Miembro"
                              className="px-3 py-1.5 text-xs bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                            />
                          </div>
                          <input
                            type="text"
                            value={editChampNotes}
                            onChange={(e) => setEditChampNotes(e.target.value)}
                            placeholder="Reseña del campeonato"
                            className="w-full px-3 py-1.5 text-xs bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                          />
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <input
                              type="file"
                              accept=".png,image/png"
                              onChange={(e) => setEditChampFile(e.target.files?.[0] || null)}
                              className="text-xs text-sky-100/90"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingChampId(null)}
                                className="px-3 py-1.5 text-xs font-semibold text-sky-100/90 bg-[#0A294E] border border-amber-400/45 rounded-lg"
                              >
                                Cancelar
                              </button>
                              <button
                                type="submit"
                                disabled={savingEditChamp}
                                className="px-4 py-1.5 text-xs font-semibold btn-gold-luxury rounded-lg"
                              >
                                {savingEditChamp ? 'Guardando...' : 'Guardar Cambios'}
                              </button>
                            </div>
                          </div>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 7. Fondo, Icono, Portada y General */}
          {adminTab === 'general' && (
            <form
              onSubmit={handleSaveSettings}
              className="p-6 bg-[#071D38]/95 border border-amber-400/50 rounded-2xl space-y-5"
            >
              <h3 className="font-display text-2xl font-bold text-albiceleste-shiny">
                Fondo de la Página, Icono, Portada y Configuración General
              </h3>
              {siteMsg && (
                <div
                  className={`p-3 text-sm rounded-xl border ${
                    siteMsg.type === 'ok'
                      ? 'bg-emerald-950/60 border-emerald-400/40 text-emerald-200'
                      : 'bg-rose-950/60 border-rose-400/40 text-rose-200'
                  }`}
                >
                  {siteMsg.text}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-sky-100/90 mb-1">
                    Título de la Liga
                  </label>
                  <input
                    type="text"
                    value={siteTitle}
                    onChange={(e) => setSiteTitle(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-sky-100/90 mb-1">
                    Subtítulo (Parche)
                  </label>
                  <input
                    type="text"
                    value={siteSubtitle}
                    onChange={(e) => setSiteSubtitle(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-sky-100/90 mb-1">
                    Texto Destacado de la Liga
                  </label>
                  <input
                    type="text"
                    value={siteBanner}
                    onChange={(e) => setSiteBanner(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-sky-100/90 mb-1">
                    Equipo del Administrador en la Liga
                  </label>
                  <select
                    value={adminTeamId}
                    onChange={(e) => setAdminTeamId(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                  >
                    <option value="">Sin equipo asignado</option>
                    {adminTeams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.id})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-sky-100/90 mb-1">
                    ID del Administrador
                  </label>
                  <input
                    type="text"
                    value={adminLoginId}
                    onChange={(e) => setAdminLoginId(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm font-mono bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-sky-100/90 mb-1">
                    Nueva Clave del Admin (dejar vacío para mantener)
                  </label>
                  <input
                    type="password"
                    value={adminLoginClave}
                    onChange={(e) => setAdminLoginClave(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                  />
                </div>
                <div className="sm:col-span-2 p-4 rounded-xl bg-[#05162B] border border-amber-400/50 space-y-2">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                    <Mail className="w-3.5 h-3.5" />
                    <span>Gmail Privado de Respaldo del Administrador (nadie más puede verlo)</span>
                  </label>
                  <input
                    type="email"
                    value={backupGmail}
                    onChange={(e) => setBackupGmail(e.target.value)}
                    placeholder="tucorreo@gmail.com (solo para recuperar usuario y clave Admin)"
                    className="w-full px-3.5 py-2 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                  />
                  <p className="text-[11px] text-sky-200/80">
                    Este correo jamás se muestra a los miembros ni en el sitio público. Solo sirve para recuperar tu ID y Clave de Administrador desde la pantalla de ingreso.
                  </p>
                </div>

                <div className="sm:col-span-2 p-4 rounded-xl bg-[#05162B] border border-amber-400/50 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                      <Radio className="w-3.5 h-3.5" />
                      <span>Radio FM Argentina En Vivo (Emisora Principal debajo del MP3)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setRadioName('FM 101.5 Pop Radio (Bs. As.)');
                        setRadioStreamUrl('https://popradio.stweb.tv/popradio/live/playlist.m3u8');
                      }}
                      className="text-[11px] font-semibold text-sky-300 hover:text-amber-300 underline"
                    >
                      Restaurar Pop Radio 101.5
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-sky-100/90 mb-1">
                        Nombre de la Radio FM
                      </label>
                      <input
                        type="text"
                        value={radioName}
                        onChange={(e) => setRadioName(e.target.value)}
                        placeholder="FM 101.5 Pop Radio (Bs. As.)"
                        className="w-full px-3 py-2 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-sky-100/90 mb-1">
                        URL del Stream En Vivo (.m3u8 / .mp3 / .aac)
                      </label>
                      <input
                        type="url"
                        value={radioStreamUrl}
                        onChange={(e) => setRadioStreamUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full px-3 py-2 text-sm bg-[#041224] text-amber-50 border border-amber-400/50 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-amber-400/15">
                <div className="p-4 bg-[#05162B] border border-amber-400/45 rounded-xl space-y-2">
                  <div className="flex items-center gap-3">
                    <ResilientImage
                      src={settings.faviconUrl || settings.crestUrl}
                      fallbackSrc={DEFAULT_CREST}
                      alt="Icono actual de la página"
                      className="w-10 h-10 rounded-full object-cover border border-amber-400/40"
                    />
                    <div>
                      <div className="text-xs font-semibold text-amber-300">
                        Icono de la Página (Pestaña y Barra)
                      </div>
                      <div className="text-[11px] text-sky-200/80">PNG, ICO, SVG o JPG</div>
                    </div>
                  </div>
                  <input
                    type="file"
                    accept="image/*,.ico"
                    onChange={(e) => setSiteFaviconFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-sky-100/90 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-400/20 file:text-amber-300"
                  />
                </div>

                <div className="p-4 bg-[#05162B] border border-amber-400/45 rounded-xl space-y-2">
                  <div className="flex items-center gap-3">
                    <ResilientImage
                      src={settings.crestUrl}
                      fallbackSrc={DEFAULT_CREST}
                      alt="Escudo oficial de la liga"
                      className="w-10 h-10 rounded-full object-cover border border-amber-400/40"
                    />
                    <div>
                      <div className="text-xs font-semibold text-amber-300">
                        Escudo / Logo de la Liga
                      </div>
                      <div className="text-[11px] text-sky-200/80">Intro y debajo de portada</div>
                    </div>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setSiteCrestFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-sky-100/90 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-400/20 file:text-amber-300"
                  />
                </div>

                <div className="p-4 bg-[#05162B] border border-amber-400/45 rounded-xl space-y-2">
                  <div>
                    <div className="text-xs font-semibold text-amber-200">
                      Cambiar Imagen de Portada
                    </div>
                    <div className="text-[11px] text-sky-200/80">Recomendado 16:9 (PNG/JPG)</div>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setSiteCoverFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-sky-100/90 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-400/20 file:text-amber-300"
                  />
                </div>

                <div className="p-4 bg-[#05162B] border border-amber-400/45 rounded-xl space-y-2">
                  <div>
                    <div className="text-xs font-semibold text-amber-200">
                      Cambiar Fondo de la Página
                    </div>
                    <div className="text-[11px] text-sky-200/80">Imagen completa de fondo (JPG/PNG/WEBP)</div>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setSiteBackgroundFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-sky-100/90 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-400/20 file:text-amber-300"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 text-sm font-semibold btn-gold-luxury rounded-xl transition-all"
                >
                  Guardar Configuración Completa
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {proofModalUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setProofModalUrl(null)}
        >
          <div
            className="max-w-3xl w-full bg-[#071D38]/95 border border-amber-400/30 rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 bg-[#05162B] text-amber-100 flex items-center justify-between border-b border-amber-400/45">
              <span className="text-sm font-semibold">Foto del Resultado</span>
              <button
                type="button"
                onClick={() => setProofModalUrl(null)}
                className="text-sky-100/90 hover:text-amber-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-[#041224] flex items-center justify-center max-h-[80vh] overflow-auto">
              <ResilientImage
                src={proofModalUrl}
                alt="Captura de resultado del partido"
                className="max-w-full max-h-[72vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
