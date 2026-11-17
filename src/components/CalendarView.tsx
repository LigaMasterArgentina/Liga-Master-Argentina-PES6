import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  CalendarCheck2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  Edit3,
  Plus,
  Shield,
  Trash2,
  Trophy,
} from 'lucide-react';
import type {
  AuthUser,
  CalendarCategory,
  CalendarEvent,
  CupMatchNode,
  CupTournament,
  PublicTeam,
  ScheduledFixture,
} from '../types';
import { apiFetch } from '../utils/api';

interface CalendarViewProps {
  calendarEvents: CalendarEvent[];
  cup: CupTournament;
  fixtures: ScheduledFixture[];
  teams: PublicTeam[];
  user: AuthUser | null;
  onRefresh: () => Promise<void>;
  onOpenCup?: () => void;
}

interface UnifiedCalendarItem {
  key: string;
  source: 'custom' | 'cup' | 'recopa' | 'fixture';
  sourceId: string;
  title: string;
  category: CalendarCategory;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  roundLabel?: string;
  matchupText?: string;
  notes?: string;
  cupMatchId?: string;
  played?: boolean;
}

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const WEEKDAY_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const CUP_ROUND_NAMES: Record<CupMatchNode['round'], string> = {
  r16: '8° Octavos de Final',
  qf: '4° Cuartos de Final',
  sf: 'Semifinal',
  final: 'Final Copa de la Liga',
};

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toHm(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function parseDateTimeMs(dateStr: string, timeStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = (timeStr || '21:00').split(':').map(Number);
  if (!y || !m || !d) return 0;
  return new Date(y, m - 1, d, Number.isFinite(hh) ? hh : 21, Number.isFinite(mm) ? mm : 0, 0).getTime();
}

function formatReadableDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

function formatCountdownBadge(targetMs: number, nowMs: number, todayYmd: string, itemDate: string, played?: boolean): {
  label: string;
  tone: 'emerald' | 'gold' | 'silver' | 'muted';
} {
  if (played) {
    return { label: 'Jugado', tone: 'emerald' };
  }
  const diffMs = targetMs - nowMs;
  if (diffMs <= 0 && diffMs > -3 * 60 * 60 * 1000) {
    return { label: 'EN HORARIO / HOY', tone: 'emerald' };
  }
  if (diffMs <= -3 * 60 * 60 * 1000) {
    return { label: 'Finalizado', tone: 'muted' };
  }
  const totalMins = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMins / (60 * 24));
  const hours = Math.floor((totalMins % (60 * 24)) / 60);
  const mins = totalMins % 60;

  if (itemDate === todayYmd) {
    return { label: hours > 0 ? `HOY · en ${hours}h ${mins}m` : `HOY · en ${mins}m`, tone: 'gold' };
  }
  if (days === 0) {
    return { label: `En ${hours}h ${mins}m`, tone: 'gold' };
  }
  if (days === 1) {
    return { label: `Mañana · ${hours}h`, tone: 'silver' };
  }
  return { label: `En ${days} días`, tone: 'silver' };
}

export function CalendarView({
  calendarEvents,
  cup,
  fixtures,
  teams,
  user,
  onRefresh,
  onOpenCup,
}: CalendarViewProps) {
  const isAdmin = user?.role === 'admin';
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const todayYmd = toYmd(now);
  const [viewYear, setViewYear] = useState<number>(() => now.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'all' | CalendarCategory>('all');

  // Admin form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<CalendarCategory>('copa');
  const [formDate, setFormDate] = useState<string>(todayYmd);
  const [formTime, setFormTime] = useState<string>(toHm(now));
  const [formCupMatchId, setFormCupMatchId] = useState<string>('');
  const [formHomeTeam, setFormHomeTeam] = useState('');
  const [formAwayTeam, setFormAwayTeam] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  // Build unified schedule: custom calendar events + scheduled Cup matches + Recopa + League Fixtures
  const unifiedItems = useMemo<UnifiedCalendarItem[]>(() => {
    const list: UnifiedCalendarItem[] = [];
    const coveredCupIds = new Set<string>();

    for (const ev of calendarEvents) {
      if (ev.cupMatchId) coveredCupIds.add(ev.cupMatchId);
      const matchup =
        ev.homeTeamName && ev.awayTeamName
          ? `${ev.homeTeamName} vs ${ev.awayTeamName}`
          : ev.homeTeamName || ev.awayTeamName || undefined;
      list.push({
        key: `cal_${ev.id}`,
        source: 'custom',
        sourceId: ev.id,
        title: ev.title,
        category: ev.category,
        date: ev.date,
        time: ev.time || '21:00',
        roundLabel: ev.roundLabel,
        matchupText: matchup,
        notes: ev.notes,
        cupMatchId: ev.cupMatchId,
      });
    }

    for (const m of cup.matches) {
      if (!m.scheduledDate || coveredCupIds.has(m.id)) continue;
      const home = m.homeTeamName || 'Por definir';
      const away = m.awayTeamName || 'Por definir';
      list.push({
        key: `cup_${m.id}`,
        source: 'cup',
        sourceId: m.id,
        title: `${CUP_ROUND_NAMES[m.round]}${m.round !== 'final' ? ` · Llave ${m.matchIndex}` : ''}`,
        category: 'copa',
        date: m.scheduledDate,
        time: m.scheduledTime || '21:00',
        roundLabel: cup.editionName,
        matchupText: `${home} vs ${away}`,
        cupMatchId: m.id,
        played: m.played,
      });
    }

    if (cup.recopa?.scheduledDate && !coveredCupIds.has('recopa')) {
      const lName = cup.recopa.leagueChampionName || 'Campeón Liga';
      const cName = cup.recopa.cupChampionName || 'Campeón Copa';
      list.push({
        key: 'recopa_main',
        source: 'recopa',
        sourceId: 'recopa',
        title: 'Gran Final Recopa Argentina',
        category: 'recopa',
        date: cup.recopa.scheduledDate,
        time: cup.recopa.scheduledTime || '22:00',
        roundLabel: 'Recopa',
        matchupText: `${lName} vs ${cName}`,
        cupMatchId: 'recopa',
        played: cup.recopa.played,
      });
    }

    for (const fx of fixtures) {
      if (!fx.scheduledDate) continue;
      const home = teamMap.get(fx.homeTeamId)?.name || fx.homeTeamId;
      const away = teamMap.get(fx.awayTeamId)?.name || fx.awayTeamId;
      list.push({
        key: `fx_${fx.id}`,
        source: 'fixture',
        sourceId: fx.id,
        title: `Fecha ${fx.matchday} (${fx.leg}) · Liga Master`,
        category: 'liga',
        date: fx.scheduledDate,
        time: fx.scheduledTime || '21:00',
        roundLabel: `Fecha ${fx.matchday}`,
        matchupText: `${home} vs ${away}`,
        notes: fx.notes,
        played: Boolean(fx.completedMatchId),
      });
    }

    return list.sort(
      (a, b) => parseDateTimeMs(a.date, a.time) - parseDateTimeMs(b.date, b.time)
    );
  }, [calendarEvents, cup, fixtures, teamMap]);

  const filteredItems = useMemo(() => {
    return unifiedItems.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (selectedDate && item.date !== selectedDate) return false;
      return true;
    });
  }, [unifiedItems, categoryFilter, selectedDate]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, UnifiedCalendarItem[]>();
    for (const item of unifiedItems) {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) continue;
      const arr = map.get(item.date) || [];
      arr.push(item);
      map.set(item.date, arr);
    }
    return map;
  }, [unifiedItems, categoryFilter]);

  // Calendar Grid cells for viewYear / viewMonth
  const calendarCells = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    // Monday-first index (0 = Mon ... 6 = Sun)
    const startOffset = (firstDayOfMonth.getDay() + 6) % 7;

    const cells: { dateStr: string | null; dayNum: number | null }[] = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push({ dateStr: null, dayNum: null });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const mStr = String(viewMonth + 1).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      cells.push({ dateStr: `${viewYear}-${mStr}-${dStr}`, dayNum: day });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ dateStr: null, dayNum: null });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const nowMs = now.getTime();
  const nextUpcomingCup = unifiedItems.find(
    (item) => (item.category === 'copa' || item.category === 'recopa') && !item.played && parseDateTimeMs(item.date, item.time) >= nowMs - 3600000
  );
  const todayEventsCount = (itemsByDate.get(todayYmd) || []).length;

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleJumpToToday = () => {
    const d = new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedDate(null);
  };

  const handleSelectCupLink = (cupId: string) => {
    setFormCupMatchId(cupId);
    if (!cupId) return;

    if (cupId === 'recopa') {
      setFormCategory('recopa');
      setFormTitle('Gran Final Recopa Argentina');
      setFormHomeTeam(cup.recopa.leagueChampionName || 'Campeón Liga');
      setFormAwayTeam(cup.recopa.cupChampionName || 'Campeón Copa');
      if (cup.recopa.scheduledDate) setFormDate(cup.recopa.scheduledDate);
      if (cup.recopa.scheduledTime) setFormTime(cup.recopa.scheduledTime);
      return;
    }

    const found = cup.matches.find((m) => m.id === cupId);
    if (found) {
      setFormCategory('copa');
      setFormTitle(
        `${CUP_ROUND_NAMES[found.round]}${found.round !== 'final' ? ` · Llave ${found.matchIndex}` : ''}`
      );
      setFormHomeTeam(found.homeTeamName || 'Por definir');
      setFormAwayTeam(found.awayTeamName || 'Por definir');
      if (found.scheduledDate) setFormDate(found.scheduledDate);
      if (found.scheduledTime) setFormTime(found.scheduledTime);
    }
  };

  const handleSubmitEvent = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setSaving(true);
    try {
      const payload = {
        title: formTitle.trim(),
        category: formCategory,
        date: formDate,
        time: formTime || '21:00',
        cupMatchId: formCupMatchId || undefined,
        homeTeamName: formHomeTeam.trim() || undefined,
        awayTeamName: formAwayTeam.trim() || undefined,
        notes: formNotes.trim() || undefined,
        roundLabel:
          formCategory === 'copa'
            ? cup.editionName
            : formCategory === 'recopa'
            ? 'Recopa'
            : undefined,
      };

      if (editingId) {
        await apiFetch(`/api/admin/calendar/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setMsg({ type: 'ok', text: 'Fecha actualizada y sincronizada en el calendario.' });
      } else {
        await apiFetch('/api/admin/calendar', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setMsg({ type: 'ok', text: 'Evento agendado y sincronizado con la Copa / Liga.' });
      }

      setEditingId(null);
      setFormTitle('');
      setFormCupMatchId('');
      setFormHomeTeam('');
      setFormAwayTeam('');
      setFormNotes('');
      await onRefresh();
    } catch (err) {
      setMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Error guardando fecha en el calendario.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEditCustomEvent = (ev: CalendarEvent) => {
    setEditingId(ev.id);
    setFormTitle(ev.title);
    setFormCategory(ev.category);
    setFormDate(ev.date);
    setFormTime(ev.time || '21:00');
    setFormCupMatchId(ev.cupMatchId || '');
    setFormHomeTeam(ev.homeTeamName || '');
    setFormAwayTeam(ev.awayTeamName || '');
    setFormNotes(ev.notes || '');
    setMsg(null);
  };

  const handleDeleteCustomEvent = async (eventId: string) => {
    setMsg(null);
    try {
      await apiFetch(`/api/admin/calendar/${eventId}`, { method: 'DELETE' });
      await onRefresh();
    } catch (err) {
      setMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'No se pudo eliminar el evento.',
      });
    }
  };

  const liveDateLabel = now.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const liveTimeLabel = now.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const categoryBadgeClass = (cat: CalendarCategory) => {
    if (cat === 'copa') {
      return 'bg-amber-400/15 text-amber-300 border-amber-400/50';
    }
    if (cat === 'recopa') {
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-400/50';
    }
    if (cat === 'liga') {
      return 'bg-sky-400/15 text-sky-300 border-sky-400/50';
    }
    return 'bg-zinc-200/15 text-zinc-200 border-zinc-400/45';
  };

  const categoryLabel = (cat: CalendarCategory) => {
    if (cat === 'copa') return 'Copa de la Liga';
    if (cat === 'recopa') return 'Recopa';
    if (cat === 'liga') return 'Liga Master';
    return 'Evento';
  };

  return (
    <div className="space-y-8">
      {/* Cabecera sincronizada con Día / Mes / Año / Hora en tiempo real */}
      <section className="p-6 sm:p-7 rounded-2xl bg-[#0B0D12]/95 border border-zinc-400/35 shadow-[0_18px_40px_rgba(0,0,0,0.85)] space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-amber-300 shrink-0" />
              <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-albiceleste-shiny">
                Calendario Oficial · Liga & Copa de la Liga
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-zinc-300">
              Sincronizado en tiempo real con el día, mes, año, hora actual y las fechas programadas de la Copa de la Liga.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="px-4 py-2.5 rounded-xl bg-[#06070A] border border-amber-400/55 flex items-center gap-3 shadow-inner">
              <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <div className="text-[11px] font-semibold text-zinc-300 capitalize">
                  {liveDateLabel}
                </div>
                <div className="font-mono text-lg font-bold text-gold-shiny tabular-nums leading-tight">
                  {liveTimeLabel} hs
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* KPIs rápidos del Calendario */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-3.5 rounded-xl bg-[#06070A] border border-zinc-400/25 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">
                Agenda de Hoy ({formatReadableDate(todayYmd)})
              </div>
              <div className="font-mono text-xl font-bold text-white tabular-nums mt-0.5">
                {todayEventsCount} {todayEventsCount === 1 ? 'partido' : 'partidos'}
              </div>
            </div>
            <CalendarCheck2 className="w-6 h-6 text-emerald-400 shrink-0" />
          </div>

          <div className="p-3.5 rounded-xl bg-[#06070A] border border-amber-400/35 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wider text-amber-300/90 font-semibold">
                Próxima Fecha de Copa
              </div>
              <div className="text-sm font-bold text-white truncate mt-0.5">
                {nextUpcomingCup
                  ? `${formatReadableDate(nextUpcomingCup.date)} · ${nextUpcomingCup.time}hs`
                  : 'Sin fecha de Copa asignada'}
              </div>
              {nextUpcomingCup && (
                <div className="text-[11px] text-zinc-400 truncate">
                  {nextUpcomingCup.matchupText || nextUpcomingCup.title}
                </div>
              )}
            </div>
            <Trophy className="w-6 h-6 text-amber-300 shrink-0" />
          </div>

          <div className="p-3.5 rounded-xl bg-[#06070A] border border-sky-400/30 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-sky-300 font-semibold">
                Total Fechas Sincronizadas
              </div>
              <div className="font-mono text-xl font-bold text-silver-shiny tabular-nums mt-0.5">
                {unifiedItems.length}
              </div>
            </div>
            {onOpenCup && (
              <button
                type="button"
                onClick={onOpenCup}
                className="px-3 py-1.5 text-xs font-semibold btn-celeste-gold rounded-lg whitespace-nowrap"
              >
                Ver Cuadro Copa
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Grid Mensual + Lista Sincronizada */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Calendario Mensual Interactivo */}
        <section className="lg:col-span-7 p-5 rounded-2xl bg-[#0B0D12]/95 border border-zinc-400/30 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Mes anterior"
                className="p-2 rounded-lg bg-[#06070A] hover:bg-[#141821] border border-zinc-400/35 text-zinc-200 hover:text-amber-300 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2">
                <select
                  value={viewMonth}
                  onChange={(e) => setViewMonth(Number(e.target.value))}
                  aria-label="Seleccionar mes"
                  className="px-2.5 py-1.5 text-sm font-bold bg-[#06070A] text-white border border-zinc-400/35 rounded-lg"
                >
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={name} value={idx}>
                      {name}
                    </option>
                  ))}
                </select>

                <select
                  value={viewYear}
                  onChange={(e) => setViewYear(Number(e.target.value))}
                  aria-label="Seleccionar año"
                  className="px-2.5 py-1.5 text-sm font-mono font-bold bg-[#06070A] text-amber-300 border border-zinc-400/35 rounded-lg"
                >
                  {Array.from({ length: 5 }, (_, idx) => now.getFullYear() - 1 + idx).map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Mes siguiente"
                className="p-2 rounded-lg bg-[#06070A] hover:bg-[#141821] border border-zinc-400/35 text-zinc-200 hover:text-amber-300 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {selectedDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-zinc-200 bg-[#06070A] hover:bg-[#141821] border border-zinc-400/35 rounded-lg"
                >
                  Ver Todo el Mes
                </button>
              )}
              <button
                type="button"
                onClick={handleJumpToToday}
                className="px-3 py-1.5 text-xs font-bold btn-gold-luxury rounded-lg"
              >
                Hoy
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center">
            {WEEKDAY_SHORT.map((dayName) => (
              <div
                key={dayName}
                className="py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400"
              >
                {dayName}
              </div>
            ))}

            {calendarCells.map((cell, idx) => {
              if (!cell.dateStr || !cell.dayNum) {
                return (
                  <div
                    key={`empty_${idx}`}
                    className="min-h-[68px] rounded-xl bg-[#06070A]/45 border border-zinc-800/40"
                  />
                );
              }

              const dayItems = itemsByDate.get(cell.dateStr) || [];
              const isToday = cell.dateStr === todayYmd;
              const isSelected = cell.dateStr === selectedDate;
              const hasCopa = dayItems.some((d) => d.category === 'copa' || d.category === 'recopa');
              const hasLiga = dayItems.some((d) => d.category === 'liga');

              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => {
                    setSelectedDate((prev) => (prev === cell.dateStr ? null : cell.dateStr));
                    if (isAdmin && !editingId) {
                      setFormDate(cell.dateStr);
                    }
                  }}
                  className={`min-h-[68px] p-1.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                    isSelected
                      ? 'bg-amber-400/15 border-amber-400 shadow-[0_0_16px_rgba(250,204,21,0.28)]'
                      : isToday
                      ? 'bg-emerald-500/10 border-emerald-400/75'
                      : dayItems.length > 0
                      ? 'bg-[#10131A] border-zinc-400/35 hover:border-amber-400/60'
                      : 'bg-[#06070A] border-zinc-800/80 hover:border-zinc-500/50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`font-mono text-xs font-bold ${
                        isToday ? 'text-emerald-300' : isSelected ? 'text-amber-300' : 'text-zinc-200'
                      }`}
                    >
                      {cell.dayNum}
                    </span>
                    {isToday && (
                      <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-emerald-500/25 text-emerald-300">
                        HOY
                      </span>
                    )}
                  </div>

                  {dayItems.length > 0 && (
                    <div className="space-y-0.5 w-full mt-1">
                      <div className="flex items-center gap-1">
                        {hasCopa && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                        {hasLiga && <span className="w-2 h-2 rounded-full bg-sky-400" />}
                        {!hasCopa && !hasLiga && (
                          <span className="w-2 h-2 rounded-full bg-zinc-300" />
                        )}
                        <span className="text-[10px] font-mono text-zinc-200 truncate">
                          {dayItems[0].time}
                        </span>
                      </div>
                      <div className="text-[9px] text-zinc-300 truncate font-medium">
                        {dayItems.length > 1
                          ? `${dayItems.length} eventos`
                          : dayItems[0].matchupText || dayItems[0].title}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-zinc-800 text-[11px] text-zinc-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              Día Actual
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              Copa de la Liga / Recopa
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
              Fecha de Liga
            </span>
          </div>
        </section>

        {/* Agenda Cronológica & Filtros */}
        <section className="lg:col-span-5 p-5 rounded-2xl bg-[#0B0D12]/95 border border-zinc-400/30 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-2xl font-bold text-gold-shiny">
              {selectedDate
                ? `Agenda del ${formatReadableDate(selectedDate)}`
                : 'Próximos Días y Horarios'}
            </h2>

            <div className="flex flex-wrap gap-1">
              {(
                [
                  { id: 'all', label: 'Todos' },
                  { id: 'copa', label: 'Copa' },
                  { id: 'liga', label: 'Liga' },
                  { id: 'recopa', label: 'Recopa' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategoryFilter(tab.id)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors ${
                    categoryFilter === tab.id
                      ? 'btn-gold-luxury'
                      : 'bg-[#06070A] text-zinc-300 border-zinc-700 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-[#06070A] border border-zinc-800 text-xs text-zinc-400 space-y-1.5">
              <CalendarDays className="w-6 h-6 text-zinc-500 mx-auto" />
              <p>
                {selectedDate
                  ? `No hay partidos ni eventos programados para el ${formatReadableDate(selectedDate)}.`
                  : 'Todavía no hay fechas asignadas. El Administrador puede programar Copa de la Liga y Cruces abajo.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
              {filteredItems.map((item) => {
                const targetMs = parseDateTimeMs(item.date, item.time);
                const status = formatCountdownBadge(targetMs, nowMs, todayYmd, item.date, item.played);
                const statusBadgeStyle =
                  status.tone === 'emerald'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/45'
                    : status.tone === 'gold'
                    ? 'bg-amber-400/15 text-amber-300 border-amber-400/50'
                    : status.tone === 'silver'
                    ? 'bg-zinc-300/10 text-zinc-200 border-zinc-400/40'
                    : 'bg-zinc-900 text-zinc-500 border-zinc-800';

                const rawCustomEvent =
                  item.source === 'custom'
                    ? calendarEvents.find((ev) => ev.id === item.sourceId)
                    : undefined;

                return (
                  <article
                    key={item.key}
                    className="p-3.5 rounded-xl bg-[#06070A] border border-zinc-400/25 hover:border-amber-400/50 transition-colors space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded border ${categoryBadgeClass(
                            item.category
                          )}`}
                        >
                          {categoryLabel(item.category)}
                        </span>
                        <span className="font-mono text-xs font-bold text-white">
                          {formatReadableDate(item.date)} · {item.time}hs
                        </span>
                      </div>

                      <span className={`px-2 py-0.5 text-[10px] font-semibold rounded border ${statusBadgeStyle}`}>
                        {status.label}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-silver-shiny">{item.title}</h3>
                      {item.matchupText && (
                        <div className="text-xs font-semibold text-amber-200 mt-0.5 flex items-center gap-1.5">
                          {item.category === 'recopa' ? (
                            <Crown className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : item.category === 'copa' ? (
                            <Trophy className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                          ) : (
                            <Shield className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          )}
                          <span>{item.matchupText}</span>
                        </div>
                      )}
                      {item.notes && (
                        <p className="text-[11px] text-zinc-400 mt-1">{item.notes}</p>
                      )}
                    </div>

                    {isAdmin && rawCustomEvent && (
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-800/80">
                        <button
                          type="button"
                          onClick={() => handleEditCustomEvent(rawCustomEvent)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-zinc-200 bg-[#121620] hover:text-amber-300 rounded"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Editar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomEvent(rawCustomEvent.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Eliminar</span>
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Panel Administrador para crear/sincronizar fechas de Copa de la Liga y Liga */}
      {isAdmin && (
        <section className="p-6 rounded-2xl bg-[#0B0D12]/95 border border-amber-400/45 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-2xl font-bold text-gold-shiny flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-300" />
                <span>
                  {editingId
                    ? 'Editar Fecha del Calendario'
                    : 'Crear Evento y Sincronizar Fecha de Copa de la Liga'}
                </span>
              </h2>
              <p className="text-xs text-zinc-300">
                Al vincular una llave de Copa de la Liga o Recopa, el día, mes, año y horario quedan sincronizados automáticamente en el cuadro y en el calendario.
              </p>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setFormTitle('');
                  setFormCupMatchId('');
                  setFormHomeTeam('');
                  setFormAwayTeam('');
                  setFormNotes('');
                }}
                className="px-3 py-1.5 text-xs font-semibold text-zinc-200 bg-[#06070A] border border-zinc-600 rounded-lg"
              >
                Cancelar edición
              </button>
            )}
          </div>

          {msg && (
            <div
              className={`p-3 text-xs font-semibold rounded-xl border ${
                msg.type === 'ok'
                  ? 'bg-emerald-950/60 border-emerald-400/45 text-emerald-200'
                  : 'bg-rose-950/60 border-rose-400/45 text-rose-200'
              }`}
            >
              {msg.text}
            </div>
          )}

          <form onSubmit={handleSubmitEvent} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-4">
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Vincular a Llave de Copa / Recopa (opcional)
              </label>
              <select
                value={formCupMatchId}
                onChange={(e) => handleSelectCupLink(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#06070A] text-white border border-zinc-400/35 rounded-lg"
              >
                <option value="">Evento o cruce manual...</option>
                {cup.matches.map((m) => (
                  <option key={m.id} value={m.id}>
                    {CUP_ROUND_NAMES[m.round]} #{m.matchIndex}: {m.homeTeamName || 'Por def.'} vs{' '}
                    {m.awayTeamName || 'Por def.'}
                  </option>
                ))}
                <option value="recopa">
                  Recopa: {cup.recopa.leagueChampionName || 'Campeón Liga'} vs{' '}
                  {cup.recopa.cupChampionName || 'Campeón Copa'}
                </option>
              </select>
            </div>

            <div className="lg:col-span-4">
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Título del Evento / Fecha
              </label>
              <input
                type="text"
                required
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Ej: 8° Octavos · Llave 1 o Fecha 5"
                className="w-full px-3 py-2 text-xs bg-[#06070A] text-white border border-zinc-400/35 rounded-lg"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Torneo / Tipo
              </label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as CalendarCategory)}
                className="w-full px-3 py-2 text-xs bg-[#06070A] text-white border border-zinc-400/35 rounded-lg"
              >
                <option value="copa">Copa de la Liga</option>
                <option value="liga">Liga Master</option>
                <option value="recopa">Recopa</option>
                <option value="evento">Evento Oficial</option>
              </select>
            </div>

            <div className="lg:col-span-2 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Día / Mes / Año
                </label>
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-2 py-2 text-xs font-mono bg-[#06070A] text-white border border-amber-400/45 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Hora</label>
                <input
                  type="time"
                  required
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  className="w-full px-2 py-2 text-xs font-mono bg-[#06070A] text-amber-300 border border-amber-400/45 rounded-lg"
                />
              </div>
            </div>

            <div className="lg:col-span-3">
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Equipo Local (opcional)
              </label>
              <input
                type="text"
                value={formHomeTeam}
                onChange={(e) => setFormHomeTeam(e.target.value)}
                placeholder="Ej: Boca Juniors"
                className="w-full px-3 py-2 text-xs bg-[#06070A] text-white border border-zinc-400/35 rounded-lg"
              />
            </div>

            <div className="lg:col-span-3">
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Equipo Visitante (opcional)
              </label>
              <input
                type="text"
                value={formAwayTeam}
                onChange={(e) => setFormAwayTeam(e.target.value)}
                placeholder="Ej: River Plate"
                className="w-full px-3 py-2 text-xs bg-[#06070A] text-white border border-zinc-400/35 rounded-lg"
              />
            </div>

            <div className="lg:col-span-4">
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Notas (opcional)
              </label>
              <input
                type="text"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Ej: Transmisión en vivo / Estadio PES6"
                className="w-full px-3 py-2 text-xs bg-[#06070A] text-white border border-zinc-400/35 rounded-lg"
              />
            </div>

            <div className="lg:col-span-2 flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2 px-4 text-xs font-bold btn-gold-luxury disabled:opacity-50 rounded-lg"
              >
                {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Agendar Fecha'}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
