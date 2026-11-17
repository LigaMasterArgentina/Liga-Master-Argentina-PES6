import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';

interface LiveClockProps {
  onClick?: () => void;
}

export function LiveClock({ onClick }: LiveClockProps) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  const dateText = `${day}/${month}/${year}`;
  const timeText = `${hours}:${minutes}:${seconds}`;

  return (
    <button
      type="button"
      onClick={onClick}
      title="Ver Calendario de Liga y Copa de la Liga"
      className="hidden sm:inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#08090D] border border-zinc-400/40 hover:border-amber-400/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors whitespace-nowrap shrink-0"
    >
      <CalendarDays className="w-3.5 h-3.5 text-amber-300 shrink-0" />
      <span className="font-mono text-[11px] font-semibold text-zinc-200 tabular-nums">
        {dateText}
      </span>
      <span className="text-zinc-500 text-[10px]" aria-hidden="true">
        ·
      </span>
      <span className="font-mono text-[11px] font-bold text-amber-300 tabular-nums">
        {timeText}
      </span>
    </button>
  );
}
