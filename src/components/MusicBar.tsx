import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ListMusic,
  Loader2,
  Pause,
  Play,
  Radio,
  SkipBack,
  SkipForward,
  Square,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { MusicTrack } from '../types';
import { apiFetch } from '../utils/api';

interface RadioStation {
  id: string;
  dial: string;
  name: string;
  city: string;
  streamUrl: string;
}

const DEFAULT_POP_RADIO_URL = 'https://popradio.stweb.tv/popradio/live/playlist.m3u8';

const ARGENTINE_FM_STATIONS: RadioStation[] = [
  {
    id: 'pop-1015',
    dial: '101.5',
    name: 'Pop Radio 101.5',
    city: 'Buenos Aires',
    streamUrl: DEFAULT_POP_RADIO_URL,
  },
  {
    id: 'la100-999',
    dial: '99.9',
    name: 'La 100 FM',
    city: 'Buenos Aires',
    streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/FM999_56.mp3',
  },
  {
    id: 'aspen-1023',
    dial: '102.3',
    name: 'Aspen 102.3',
    city: 'Buenos Aires',
    streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/ASPEN.mp3',
  },
  {
    id: 'rockandpop-959',
    dial: '95.9',
    name: 'Rock & Pop',
    city: 'Buenos Aires',
    streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/ROCKANDPOP.mp3',
  },
  {
    id: 'metro-951',
    dial: '95.1',
    name: 'Metro 95.1',
    city: 'Buenos Aires',
    streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/METRO.mp3',
  },
  {
    id: 'disney-943',
    dial: '94.3',
    name: 'Radio Disney',
    city: 'Buenos Aires',
    streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/DISNEY_ARG_BA.mp3',
  },
  {
    id: 'blue-1007',
    dial: '100.7',
    name: 'Blue FM',
    city: 'Buenos Aires',
    streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/BLUE_FM_100_7AAC.aac',
  },
  {
    id: 'urbana-1043',
    dial: '104.3',
    name: 'Urbana Play',
    city: 'Buenos Aires',
    streamUrl: 'https://vmf.edge-apps.net/playlist/urbana.m3u8/play.m3u8',
  },
  {
    id: 'rcvos-899',
    dial: '89.9',
    name: 'Radio Con Vos',
    city: 'Buenos Aires',
    streamUrl: 'https://server1.stweb.tv/rcvos/live/playlist.m3u8',
  },
  {
    id: 'lapopu-923',
    dial: '92.3',
    name: 'La Popu FM',
    city: 'Córdoba',
    streamUrl: 'https://liveradio.mediainbox.net/popular.mp3',
  },
];

interface MusicBarProps {
  tracks: MusicTrack[];
  radioName?: string;
  radioStreamUrl?: string;
  isAdmin?: boolean;
  introActive?: boolean;
  onRefresh?: () => Promise<void>;
}

export function MusicBar({
  tracks,
  radioName,
  radioStreamUrl,
  isAdmin = false,
  introActive = false,
  onRefresh,
}: MusicBarProps) {
  // MP3 Player state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const userPausedRef = useRef(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [volume, setVolume] = useState(0.55);
  const [muted, setMuted] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [addingTrack, setAddingTrack] = useState(false);
  const [trackFormError, setTrackFormError] = useState<string | null>(null);

  // FM Argentina Live Radio state
  const radioAudioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const radioActiveRef = useRef(false);

  const stations = useMemo(() => {
    const customUrl = radioStreamUrl?.trim();
    const customLabel = radioName?.trim();
    if (!customUrl) return ARGENTINE_FM_STATIONS;

    const existingIdx = ARGENTINE_FM_STATIONS.findIndex((s) => s.streamUrl === customUrl);
    if (existingIdx === 0) {
      if (customLabel && customLabel !== 'FM 101.5 Pop Radio (Bs. As.)') {
        return [
          { ...ARGENTINE_FM_STATIONS[0], name: customLabel },
          ...ARGENTINE_FM_STATIONS.slice(1),
        ];
      }
      return ARGENTINE_FM_STATIONS;
    }
    if (existingIdx > 0) {
      const selected = ARGENTINE_FM_STATIONS[existingIdx];
      return [
        customLabel ? { ...selected, name: customLabel } : selected,
        ...ARGENTINE_FM_STATIONS.filter((_, idx) => idx !== existingIdx),
      ];
    }
    return [
      {
        id: 'custom-fm',
        dial: 'FM',
        name: customLabel || 'Radio FM Argentina',
        city: 'En Vivo',
        streamUrl: customUrl,
      },
      ...ARGENTINE_FM_STATIONS,
    ];
  }, [radioName, radioStreamUrl]);

  const [stationIndex, setStationIndex] = useState(0);
  const [radioPlaying, setRadioPlaying] = useState(false);
  const [radioConnecting, setRadioConnecting] = useState(false);
  const [radioVolume, setRadioVolume] = useState(0.75);
  const [radioMuted, setRadioMuted] = useState(false);
  const [radioMinimized, setRadioMinimized] = useState(false);
  const [showStations, setShowStations] = useState(false);
  const [radioError, setRadioError] = useState<string | null>(null);

  const safeIndex = tracks.length > 0 ? Math.min(currentIndex, tracks.length - 1) : 0;
  const currentTrack = tracks[safeIndex];

  const safeStationIdx = stations.length > 0 ? Math.min(stationIndex, stations.length - 1) : 0;
  const currentStation = stations[safeStationIdx];

  const stopRadio = useCallback(() => {
    radioActiveRef.current = false;
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    const radioAudio = radioAudioRef.current;
    if (radioAudio) {
      radioAudio.pause();
      radioAudio.removeAttribute('src');
      radioAudio.load();
    }
    setRadioPlaying(false);
    setRadioConnecting(false);
  }, []);

  const pauseMp3 = useCallback(() => {
    userPausedRef.current = true;
    const audio = audioRef.current;
    if (audio && !audio.paused) {
      audio.pause();
    }
    setIsPlaying(false);
    setAutoplayBlocked(false);
  }, []);

  const startRadioStation = useCallback(
    async (station: RadioStation) => {
      const radioAudio = radioAudioRef.current;
      if (!radioAudio || !station?.streamUrl) return;

      pauseMp3();
      setRadioError(null);
      setRadioConnecting(true);
      radioActiveRef.current = true;

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      radioAudio.pause();
      radioAudio.removeAttribute('src');
      radioAudio.load();
      radioAudio.volume = radioMuted ? 0 : radioVolume;

      const url = station.streamUrl.trim();
      const isHls = /\.m3u8(\?|$)/i.test(url);

      try {
        if (isHls) {
          if (Hls.isSupported()) {
            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: true,
              backBufferLength: 10,
            });
            hlsRef.current = hls;

            hls.on(Hls.Events.ERROR, (_event, data) => {
              if (!data.fatal) return;
              if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                setRadioError('Sin señal. Probá otra emisora.');
                stopRadio();
              } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                hls.recoverMediaError();
              } else {
                setRadioError('Error de transmisión FM.');
                stopRadio();
              }
            });

            hls.loadSource(url);
            hls.attachMedia(radioAudio);

            await new Promise<void>((resolve, reject) => {
              const onManifest = () => {
                cleanup();
                resolve();
              };
              const onFatal = (_ev: unknown, d: { fatal: boolean }) => {
                if (d.fatal) {
                  cleanup();
                  reject(new Error('hls_fatal'));
                }
              };
              const timeout = window.setTimeout(() => {
                cleanup();
                reject(new Error('timeout'));
              }, 12000);
              const cleanup = () => {
                window.clearTimeout(timeout);
                hls.off(Hls.Events.MANIFEST_PARSED, onManifest);
                hls.off(Hls.Events.ERROR, onFatal);
              };
              hls.on(Hls.Events.MANIFEST_PARSED, onManifest);
              hls.on(Hls.Events.ERROR, onFatal);
            });

            if (!radioActiveRef.current) return;
            await radioAudio.play();
            if (!radioActiveRef.current) return;
            setRadioPlaying(true);
            setRadioConnecting(false);
          } else if (radioAudio.canPlayType('application/vnd.apple.mpegurl')) {
            radioAudio.src = url;
            await radioAudio.play();
            if (!radioActiveRef.current) return;
            setRadioPlaying(true);
            setRadioConnecting(false);
          } else {
            throw new Error('HLS no soportado');
          }
        } else {
          // Direct Icecast / Shoutcast MP3 or AAC live stream
          const cacheBuster = url.includes('?') ? `&t=${Date.now()}` : `?t=${Date.now()}`;
          radioAudio.src = url.includes('streamtheworld.com') ? url : `${url}${cacheBuster}`;
          await radioAudio.play();
          if (!radioActiveRef.current) return;
          setRadioPlaying(true);
          setRadioConnecting(false);
        }
      } catch {
        if (radioActiveRef.current) {
          stopRadio();
          setRadioError('No conectó. Probá otra FM.');
        }
      }
    },
    [pauseMp3, radioMuted, radioVolume, stopRadio]
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = muted ? 0 : volume;
  }, [volume, muted]);

  useEffect(() => {
    const radioAudio = radioAudioRef.current;
    if (!radioAudio) return;
    radioAudio.volume = radioMuted ? 0 : radioVolume;
  }, [radioVolume, radioMuted]);

  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack || userPausedRef.current || introActive || radioActiveRef.current) return;

    let cancelled = false;

    const tryAutoplay = async () => {
      if (cancelled || userPausedRef.current || introActive || radioActiveRef.current) return;
      try {
        await audio.play();
        if (!cancelled) {
          setIsPlaying(true);
          setAutoplayBlocked(false);
        }
      } catch {
        if (!cancelled) {
          setIsPlaying(false);
          setAutoplayBlocked(true);
        }
      }
    };

    tryAutoplay();

    const unlockOnGesture = () => {
      if (!userPausedRef.current && !introActive && !radioActiveRef.current && audio.paused) {
        tryAutoplay();
      }
    };

    window.addEventListener('pointerdown', unlockOnGesture, { once: true });
    window.addEventListener('keydown', unlockOnGesture, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener('pointerdown', unlockOnGesture);
      window.removeEventListener('keydown', unlockOnGesture);
    };
  }, [currentTrack?.audioUrl, introActive]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    setErrorMsg(null);
    if (isPlaying) {
      userPausedRef.current = true;
      audio.pause();
      setIsPlaying(false);
    } else {
      stopRadio();
      userPausedRef.current = false;
      try {
        await audio.play();
        setIsPlaying(true);
        setAutoplayBlocked(false);
      } catch {
        setErrorMsg('No se pudo reproducir.');
        setIsPlaying(false);
      }
    }
  };

  const handleNext = () => {
    if (tracks.length === 0) return;
    stopRadio();
    userPausedRef.current = false;
    setCurrentIndex((prev) => (prev + 1) % tracks.length);
    setIsPlaying(true);
  };

  const handlePrev = () => {
    if (tracks.length === 0) return;
    stopRadio();
    userPausedRef.current = false;
    setCurrentIndex((prev) => (prev - 1 + tracks.length) % tracks.length);
    setIsPlaying(true);
  };

  const toggleRadio = () => {
    if (radioPlaying || radioConnecting) {
      stopRadio();
    } else if (currentStation) {
      void startRadioStation(currentStation);
    }
  };

  const handleSelectStation = (idx: number) => {
    setStationIndex(idx);
    const chosen = stations[idx];
    if (chosen) {
      void startRadioStation(chosen);
    }
  };

  const handleNextStation = () => {
    if (stations.length === 0) return;
    const nextIdx = (safeStationIdx + 1) % stations.length;
    setStationIndex(nextIdx);
    if (radioPlaying || radioConnecting) {
      void startRadioStation(stations[nextIdx]);
    } else {
      setRadioError(null);
    }
  };

  const handlePrevStation = () => {
    if (stations.length === 0) return;
    const prevIdx = (safeStationIdx - 1 + stations.length) % stations.length;
    setStationIndex(prevIdx);
    if (radioPlaying || radioConnecting) {
      void startRadioStation(stations[prevIdx]);
    } else {
      setRadioError(null);
    }
  };

  const handleUploadMultipleMp3 = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setTrackFormError(null);
    setAddingTrack(true);
    try {
      const form = new FormData();
      for (const file of Array.from(fileList)) {
        form.append('audio', file);
      }
      await apiFetch('/api/admin/music', { method: 'POST', body: form });
      if (onRefresh) await onRefresh();
    } catch (err) {
      setTrackFormError(err instanceof Error ? err.message : 'Error subiendo MP3.');
    } finally {
      setAddingTrack(false);
    }
  };

  const handleAdminDeleteTrack = async (trackId: string) => {
    await apiFetch(`/api/admin/music/${trackId}`, { method: 'DELETE' });
    if (onRefresh) await onRefresh();
  };

  const showMp3Section = tracks.length > 0 || isAdmin;

  return (
    <aside
      aria-label="Reproductor de música y Radio FM Argentina"
      className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2"
    >
      {currentTrack && (
        <audio
          ref={audioRef}
          src={currentTrack.audioUrl}
          loop={tracks.length === 1}
          onEnded={handleNext}
          onPlay={() => {
            stopRadio();
            setIsPlaying(true);
            setAutoplayBlocked(false);
          }}
          onPause={() => setIsPlaying(false)}
          onError={() => {
            setIsPlaying(false);
            setErrorMsg('Error de audio.');
          }}
        />
      )}

      {/* Elemento de audio dedicado a la Radio FM Argentina en tiempo real */}
      <audio
        ref={radioAudioRef}
        onPlaying={() => {
          setRadioPlaying(true);
          setRadioConnecting(false);
          setRadioError(null);
        }}
        onWaiting={() => {
          if (radioActiveRef.current) setRadioConnecting(true);
        }}
        onPause={() => {
          if (!radioActiveRef.current) {
            setRadioPlaying(false);
            setRadioConnecting(false);
          }
        }}
        onError={() => {
          if (radioActiveRef.current) {
            stopRadio();
            setRadioError('Señal caída. Probá otra FM.');
          }
        }}
      />

      {/* Popover playlist MP3 hacia arriba */}
      {showMp3Section && showPlaylist && (
        <div className="w-[275px] sm:w-[310px] rounded-xl bg-[#071D38] border-2 border-amber-400/65 shadow-2xl p-3 space-y-2.5 text-white">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-amber-300">
              Canciones MP3 ({tracks.length})
            </span>

            <div className="flex items-center gap-2">
              {isAdmin && (
                <label className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] btn-gold-luxury rounded-md cursor-pointer">
                  <Upload className="w-3 h-3" />
                  <span>{addingTrack ? 'Subiendo...' : 'Cargar MP3'}</span>
                  <input
                    type="file"
                    multiple
                    disabled={addingTrack}
                    accept=".mp3,.wav,.ogg,.m4a,audio/mpeg,audio/*"
                    onChange={(e) => {
                      handleUploadMultipleMp3(e.target.files);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </label>
              )}

              <button
                type="button"
                onClick={() => setShowPlaylist(false)}
                className="text-[11px] text-sky-200 hover:text-amber-300"
              >
                Cerrar
              </button>
            </div>
          </div>

          {trackFormError && (
            <div className="text-[11px] text-rose-300">{trackFormError}</div>
          )}

          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
            {tracks.length === 0 ? (
              <div className="text-[11px] text-sky-200/75 py-2">
                Sin canciones todavía.
              </div>
            ) : (
              tracks.map((track, idx) => {
                const active = idx === safeIndex;
                return (
                  <div
                    key={track.id}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] transition-colors ${
                      active
                        ? 'bg-sky-400/20 border border-amber-400/60 text-white'
                        : 'bg-[#05162B] border border-sky-400/20 text-sky-100 hover:bg-[#0A2B52]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        stopRadio();
                        userPausedRef.current = false;
                        setCurrentIndex(idx);
                        setIsPlaying(true);
                      }}
                      className="min-w-0 pr-2 flex-1 text-left"
                    >
                      <div className="font-semibold truncate">{track.title}</div>
                      <div className="text-[10px] text-zinc-400 truncate">
                        {active && isPlaying ? 'Sonando ahora' : track.artist}
                      </div>
                    </button>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleAdminDeleteTrack(track.id)}
                        aria-label={`Eliminar ${track.title}`}
                        className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/15 rounded transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* REPRODUCTOR MP3 (ARRIBA) */}
      {showMp3Section &&
        (minimized ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#071D38] border-2 border-amber-400/65 shadow-xl">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pausar música' : 'Reproducir música'}
              className="w-7 h-7 rounded-lg btn-gold-luxury flex items-center justify-center shrink-0"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
            </button>
            <button
              type="button"
              onClick={() => setMinimized(false)}
              aria-label="Expandir reproductor MP3"
              className="inline-flex items-center gap-1 px-1.5 py-1 text-[11px] font-semibold text-white hover:text-amber-200"
            >
              <span className="max-w-[100px] truncate">
                {currentTrack ? currentTrack.title : 'Música MP3'}
              </span>
              <ChevronUp className="w-3.5 h-3.5 text-amber-300" />
            </button>
          </div>
        ) : (
          <div className="w-[245px] sm:w-[265px] rounded-xl bg-[#071D38] border-2 border-amber-400/65 shadow-2xl p-2.5 space-y-2 text-white">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pausar música' : 'Reproducir música'}
                className="w-8 h-8 rounded-lg btn-gold-luxury flex items-center justify-center shrink-0"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
              </button>

              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold text-white truncate">
                  {currentTrack ? currentTrack.title : 'Sin canciones'}
                </div>
                <div className="text-[10px] text-sky-200/80 truncate">
                  {errorMsg ||
                    (autoplayBlocked && !radioPlaying
                      ? 'Tocá Play para escuchar'
                      : currentTrack
                      ? currentTrack.artist
                      : 'Agregá MP3 desde Lista')}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMinimized(true)}
                aria-label="Minimizar reproductor MP3"
                className="p-1 text-sky-200 hover:text-amber-300 transition-colors shrink-0"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-amber-400/25">
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={handlePrev}
                  aria-label="Anterior"
                  className="p-1 text-sky-200 hover:text-amber-300 transition-colors"
                >
                  <SkipBack className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  aria-label="Siguiente"
                  className="p-1 text-sky-200 hover:text-amber-300 transition-colors"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => setMuted((m) => !m)}
                  aria-label={muted ? 'Activar sonido MP3' : 'Silenciar MP3'}
                  className="text-sky-200 hover:text-amber-300 transition-colors shrink-0"
                >
                  {muted || volume === 0 ? (
                    <VolumeX className="w-3.5 h-3.5" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  onChange={(e) => {
                    setMuted(false);
                    setVolume(Number(e.target.value));
                  }}
                  aria-label="Volumen MP3"
                  className="w-full accent-amber-400 cursor-pointer h-1"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowStations(false);
                  setShowPlaylist((v) => !v);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-white hover:text-amber-200 bg-[#05162B] hover:bg-[#0B2D54] border border-amber-400/45 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                <ListMusic className="w-3 h-3 text-amber-300" />
                <span>{tracks.length}</span>
              </button>
            </div>
          </div>
        ))}

      {/* Popover selector de Emisoras FM Argentina */}
      {showStations && (
        <div className="w-[275px] sm:w-[310px] rounded-xl bg-[#071D38] border-2 border-amber-400/65 shadow-2xl p-3 space-y-2 text-white">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-300">
              <Radio className="w-3.5 h-3.5" />
              <span>Radios FM Argentina En Vivo</span>
            </span>
            <button
              type="button"
              onClick={() => setShowStations(false)}
              className="text-[11px] text-sky-200 hover:text-amber-300"
            >
              Cerrar
            </button>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
            {stations.map((st, idx) => {
              const active = idx === safeStationIdx;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => handleSelectStation(idx)}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[11px] text-left transition-colors ${
                    active
                      ? 'bg-sky-400/20 border border-amber-400/65 text-white'
                      : 'bg-[#05162B] border border-sky-400/20 text-sky-100 hover:bg-[#0A2B52]'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{st.name}</div>
                    <div className="text-[10px] text-sky-200/75 truncate">
                      {active && radioPlaying
                        ? 'Transmitiendo en vivo'
                        : active && radioConnecting
                        ? 'Sintonizando...'
                        : st.city}
                    </div>
                  </div>
                  <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-[#071D38] border border-amber-400/45 text-amber-300 shrink-0">
                    {st.dial}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* RADIO FM ARGENTINA EN VIVO (ABAJO DEL REPRODUCTOR MP3) */}
      {radioMinimized ? (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#071D38] border-2 border-amber-400/65 shadow-xl">
          <button
            type="button"
            onClick={toggleRadio}
            aria-label={radioPlaying ? 'Detener Radio FM' : 'Escuchar Radio FM en vivo'}
            className="w-7 h-7 rounded-lg btn-gold-luxury flex items-center justify-center shrink-0"
          >
            {radioConnecting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : radioPlaying ? (
              <Square className="w-3 h-3 fill-current" />
            ) : (
              <Radio className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setRadioMinimized(false)}
            aria-label="Expandir Radio FM Argentina"
            className="inline-flex items-center gap-1.5 px-1.5 py-1 text-[11px] font-semibold text-white hover:text-amber-200"
          >
            {radioPlaying && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
            )}
            <span className="max-w-[100px] truncate">
              FM {currentStation?.dial || '101.5'}
            </span>
            <ChevronUp className="w-3.5 h-3.5 text-amber-300" />
          </button>
        </div>
      ) : (
        <div className="w-[245px] sm:w-[265px] rounded-xl bg-[#071D38] border-2 border-amber-400/65 shadow-2xl p-2.5 space-y-2 text-white">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleRadio}
              aria-label={radioPlaying ? 'Detener Radio FM' : 'Escuchar Radio FM Argentina'}
              className="w-8 h-8 rounded-lg btn-gold-luxury flex items-center justify-center shrink-0"
            >
              {radioConnecting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : radioPlaying ? (
                <Square className="w-3 h-3 fill-current" />
              ) : (
                <Radio className="w-4 h-4" />
              )}
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.2 rounded bg-sky-400/20 border border-sky-300/40 text-[9px] font-mono font-bold text-sky-200 shrink-0">
                  FM {currentStation?.dial || '101.5'}
                </span>
                {radioPlaying ? (
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-300 uppercase tracking-wider shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    En vivo
                  </span>
                ) : radioConnecting ? (
                  <span className="text-[9px] font-semibold text-amber-300 shrink-0">
                    Conectando...
                  </span>
                ) : (
                  <span className="text-[9px] font-semibold text-amber-300/90 shrink-0">
                    Radio ARG
                  </span>
                )}
              </div>

              <div className="text-[11px] font-semibold text-white truncate mt-0.5">
                {radioError || currentStation?.name || 'Pop Radio 101.5'}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setRadioMinimized(true)}
              aria-label="Minimizar Radio FM"
              className="p-1 text-sky-200 hover:text-amber-300 transition-colors shrink-0"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-amber-400/25">
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={handlePrevStation}
                aria-label="Emisora anterior"
                className="p-1 text-sky-200 hover:text-amber-300 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleNextStation}
                aria-label="Siguiente emisora"
                className="p-1 text-sky-200 hover:text-amber-300 transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <button
                type="button"
                onClick={() => setRadioMuted((m) => !m)}
                aria-label={radioMuted ? 'Activar sonido Radio FM' : 'Silenciar Radio FM'}
                className="text-sky-200 hover:text-amber-300 transition-colors shrink-0"
              >
                {radioMuted || radioVolume === 0 ? (
                  <VolumeX className="w-3.5 h-3.5" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={radioMuted ? 0 : radioVolume}
                onChange={(e) => {
                  setRadioMuted(false);
                  setRadioVolume(Number(e.target.value));
                }}
                aria-label="Volumen Radio FM"
                className="w-full accent-amber-400 cursor-pointer h-1"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setShowPlaylist(false);
                setShowStations((v) => !v);
              }}
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-white hover:text-amber-200 bg-[#05162B] hover:bg-[#0B2D54] border border-amber-400/45 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <Radio className="w-3 h-3 text-amber-300" />
              <span>FM ({stations.length})</span>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
