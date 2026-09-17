import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  requestAndFetchWeather,
  fetchWeatherByIpFallback,
  getCachedWeather,
  subscribeWeather,
  LocalWeather,
} from '../services/weatherService';
import {
  CURRENT_NEWS_MESSAGES,
  SECONDARY_MESSAGES,
  getTimeGreetingMessage,
  BannerMessage,
} from '../data/bannerMessages';

interface FlightTrajectory {
  id: number;
  isL2R: boolean;
  startX: string;
  startY: string;
  endX: string;
  endY: string;
  angle: number;
  durationSec: number;
  isLooping: boolean;
}

export const UfoBanner: React.FC = () => {
  const [flight, setFlight] = useState<FlightTrajectory | null>(null);
  const [currentMessage, setCurrentMessage] = useState<BannerMessage>(CURRENT_NEWS_MESSAGES[0]);
  const [weatherData, setWeatherData] = useState<LocalWeather | null>(getCachedWeather());
  const [geoState, setGeoState] = useState<'idle' | 'prompting' | 'granted' | 'denied'>('idle');

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const safetyCleanupRef = useRef<NodeJS.Timeout | null>(null);
  const newsIndexRef = useRef<number>(0);
  const secondaryIndexRef = useRef<number>(0);
  const weatherVariantRef = useRef<number>(0);

  // Helper to build weather-specific banner messages
  const buildWeatherBannerMessage = useCallback((weather: LocalWeather, variant: number): BannerMessage => {
    if (variant === 0) {
      // Current condition, real-feel, wind & humidity
      return {
        id: `weather-current-${Date.now()}`,
        category: 'weather',
        tag: `TIEMPO · ${weather.city.toUpperCase()}${weather.isGps ? ' (GPS)' : ''}`,
        headline: `${weather.icon} ${weather.city}: ${weather.temperature}°C (${weather.description})`,
        subtext: `Sensación ${weather.apparentTemperature}°C · Viento ${weather.windSpeed} km/h · Humedad ${weather.humidity}%`,
        icon: weather.icon,
        colorScheme: 'cyan',
      };
    } else if (variant === 1) {
      // Daily forecast: max, min & precipitation probability
      const rainText = weather.precipitationProb != null ? ` · Lluvia: ${weather.precipitationProb}%` : '';
      const uvText = weather.uvIndex != null ? ` · UV: ${weather.uvIndex}` : '';
      return {
        id: `weather-forecast-${Date.now()}`,
        category: 'weather',
        tag: `PRONÓSTICO · ${weather.city.toUpperCase()}`,
        headline: `Pronóstico en ${weather.city}: Máx ${weather.tempMax}°C / Mín ${weather.tempMin}°C`,
        subtext: `★ ${weather.description}${rainText}${uvText} · Buen viaje ★`,
        icon: '🌤️',
        colorScheme: 'emerald',
      };
    } else if (variant === 2) {
      // Road and driving notice based on real meteorology
      const hasNotice = Boolean(weather.roadNotice);
      const noticeText = weather.roadNotice || `Visibilidad óptima en ${weather.city}: condiciones ideales para conducir`;
      return {
        id: `weather-road-${Date.now()}`,
        category: 'weather',
        tag: hasNotice ? 'AVISO EN CARRETERA' : `ESTADO VIAL · ${weather.city.toUpperCase()}`,
        headline: noticeText,
        subtext: hasNotice
          ? `★ Precaución al volante en la zona de ${weather.city} · Modera velocidad ★`
          : `★ Asfalto seco y buena adherencia en ruta · Disfruta la música ★`,
        icon: hasNotice ? '⚠️' : '🚗',
        colorScheme: hasNotice ? 'amber' : 'blue',
      };
    } else {
      // Dynamic time-of-day greeting with town integration
      const greeting = getTimeGreetingMessage();
      return {
        id: `weather-greeting-${Date.now()}`,
        category: 'greeting',
        tag: `${greeting.tag} · ${weather.city.toUpperCase()}`,
        headline: greeting.headline,
        subtext: `${greeting.subtext}`,
        icon: greeting.icon,
        colorScheme: greeting.colorScheme,
      };
    }
  }, []);

  // Request precise GPS location or fallback to IP weather
  const handleRequestLocation = useCallback(async () => {
    setGeoState('prompting');
    try {
      const data = await requestAndFetchWeather();
      if (data) {
        setWeatherData(data);
        setGeoState('granted');
        setCurrentMessage(buildWeatherBannerMessage(data, 0));
      } else {
        setGeoState('denied');
      }
    } catch {
      setGeoState('denied');
    }
  }, [buildWeatherBannerMessage]);

  // Subscribe to central weather service updates
  useEffect(() => {
    const unsubscribe = subscribeWeather((data) => {
      setWeatherData(data);
      if (data.isGps) {
        setGeoState('granted');
      }
    });
    return unsubscribe;
  }, []);

  // Try fetching IP weather on startup so weather is immediately available
  useEffect(() => {
    let isMounted = true;
    (async () => {
      // 1. Check if GPS permission was already granted previously
      if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
        try {
          const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          if (status.state === 'granted') {
            const gpsData = await requestAndFetchWeather();
            if (isMounted && gpsData) {
              setWeatherData(gpsData);
              setGeoState('granted');
              return;
            }
          }
        } catch {
          // ignore
        }
      }

      // 2. Otherwise load IP-based weather silently so we have accurate local data
      const ipData = await fetchWeatherByIpFallback();
      if (isMounted && ipData) {
        setWeatherData(ipData);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // Message selection prioritizing current news and weather (85%+ priority)
  const pickNextMessage = useCallback((): BannerMessage => {
    const weather = weatherData || getCachedWeather();
    const roll = Math.random();

    // 1. TIEMPO LOCAL (45% de probabilidad si hay datos meteorológicos)
    if (weather && roll < 0.45) {
      const variant = weatherVariantRef.current % 4;
      weatherVariantRef.current += 1;
      return buildWeatherBannerMessage(weather, variant);
    }

    // 2. Si no hay datos aún o no se ha concedido GPS, invitar a activar con un aviso de alta visibilidad
    if ((!weather || geoState !== 'granted') && roll < 0.35) {
      return {
        id: 'weather-prompt',
        category: 'weather',
        tag: 'TIEMPO & AVISOS EN RUTA',
        headline: '¿Activar tiempo local GPS? Toca aquí',
        subtext: '★ Consulta temperatura, pronóstico y avisos de carretera en tiempo real ★',
        icon: '🛰️',
        colorScheme: 'cyan',
      };
    }

    // 3. NOTICIAS ACTUALES DEL DÍA (40% de prioridad)
    if (roll < 0.85) {
      const list = CURRENT_NEWS_MESSAGES;
      newsIndexRef.current = (newsIndexRef.current + 1) % list.length;
      return list[newsIndexRef.current];
    }

    // 4. EFEMÉRIDES, FRASES FAMOSAS Y CONSEJOS (15% restante)
    const secondaryList = SECONDARY_MESSAGES;
    secondaryIndexRef.current = (secondaryIndexRef.current + 1) % secondaryList.length;
    return secondaryList[secondaryIndexRef.current];
  }, [weatherData, geoState, buildWeatherBannerMessage]);

  // Launch UFO with wide offscreen margins and guaranteed cleanup
  const launchUfo = useCallback((customMsg?: BannerMessage) => {
    const isL2R = Math.random() > 0.5;
    const duration = 18 + Math.floor(Math.random() * 6); // 18s - 23s

    const corridorType = Math.floor(Math.random() * 5);

    let startX = '';
    let startY = '';
    let endX = '';
    let endY = '';
    let angle = 0;

    // Generous offscreen margins (1400px) ensure the entire 750px convoy (UFO + cable + banner)
    // completely exits the screen without ever sticking or leaving visible edges behind!
    if (isL2R) {
      startX = '-1400px';
      endX = 'calc(100vw + 1400px)';

      if (corridorType === 0) {
        const y = 8 + Math.floor(Math.random() * 18);
        startY = `${y}vh`;
        endY = `${y + (Math.random() * 8 - 4)}vh`;
        angle = Math.random() * 8 - 4;
      } else if (corridorType === 1) {
        // Crosses behind the central terrestrial player
        const y = 42 + Math.floor(Math.random() * 16);
        startY = `${y}vh`;
        endY = `${y + (Math.random() * 8 - 4)}vh`;
        angle = Math.random() * 6 - 3;
      } else if (corridorType === 2) {
        const y = 72 + Math.floor(Math.random() * 16);
        startY = `${y}vh`;
        endY = `${y + (Math.random() * 8 - 4)}vh`;
        angle = Math.random() * 8 - 4;
      } else if (corridorType === 3) {
        startY = `${6 + Math.floor(Math.random() * 15)}vh`;
        endY = `${70 + Math.floor(Math.random() * 20)}vh`;
        angle = 14 + Math.random() * 6;
      } else {
        startY = `${76 + Math.floor(Math.random() * 14)}vh`;
        endY = `${10 + Math.floor(Math.random() * 18)}vh`;
        angle = -(14 + Math.random() * 6);
      }
    } else {
      // Right to Left (-X): starts at 100vw + 1400px, finishes at -1400px
      startX = 'calc(100vw + 1400px)';
      endX = '-1400px';

      if (corridorType === 0) {
        const y = 8 + Math.floor(Math.random() * 18);
        startY = `${y}vh`;
        endY = `${y + (Math.random() * 8 - 4)}vh`;
        angle = -(Math.random() * 8 - 4);
      } else if (corridorType === 1) {
        // Crosses behind the central terrestrial player
        const y = 42 + Math.floor(Math.random() * 16);
        startY = `${y}vh`;
        endY = `${y + (Math.random() * 8 - 4)}vh`;
        angle = -(Math.random() * 6 - 3);
      } else if (corridorType === 2) {
        const y = 72 + Math.floor(Math.random() * 16);
        startY = `${y}vh`;
        endY = `${y + (Math.random() * 8 - 4)}vh`;
        angle = -(Math.random() * 8 - 4);
      } else if (corridorType === 3) {
        startY = `${6 + Math.floor(Math.random() * 15)}vh`;
        endY = `${70 + Math.floor(Math.random() * 20)}vh`;
        angle = -(14 + Math.random() * 6);
      } else {
        startY = `${76 + Math.floor(Math.random() * 14)}vh`;
        endY = `${10 + Math.floor(Math.random() * 18)}vh`;
        angle = 14 + Math.random() * 6;
      }
    }

    // Set updated prioritized message
    setCurrentMessage(customMsg || pickNextMessage());

    setFlight({
      id: Date.now(),
      isL2R,
      startX,
      startY,
      endX,
      endY,
      angle,
      durationSec: duration,
      isLooping: false,
    });

    // Safety timeout: guarantees the convoy is cleanly unmounted when duration completes
    if (safetyCleanupRef.current) clearTimeout(safetyCleanupRef.current);
    safetyCleanupRef.current = setTimeout(() => {
      setFlight(null);
    }, (duration + 1) * 1000);

    // Schedule next flight 16 - 30 seconds after current flight finishes
    const totalFlightMs = (duration + 1) * 1000;
    const nextDelayMs = totalFlightMs + (16000 + Math.random() * 14000);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      launchUfo();
    }, nextDelayMs);
  }, [pickNextMessage]);

  // Support on-demand invocation of UFO banner via custom window event
  useEffect(() => {
    const handleLaunchEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ category?: string }>).detail;
      const weather = weatherData || getCachedWeather();
      if (detail?.category === 'weather' && weather) {
        const v = weatherVariantRef.current % 4;
        weatherVariantRef.current += 1;
        launchUfo(buildWeatherBannerMessage(weather, v));
      } else {
        launchUfo();
      }
    };

    window.addEventListener('audiocar-launch-ufo', handleLaunchEvent);
    return () => {
      window.removeEventListener('audiocar-launch-ufo', handleLaunchEvent);
    };
  }, [launchUfo, weatherData, buildWeatherBannerMessage]);

  useEffect(() => {
    // Initial launch after 2 seconds
    const initialTimer = setTimeout(() => {
      launchUfo();
    }, 2000);

    return () => {
      clearTimeout(initialTimer);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (safetyCleanupRef.current) clearTimeout(safetyCleanupRef.current);
    };
  }, [launchUfo]);

  // Cleanup on animation end so nothing ever hangs in the DOM
  const handleAnimationEnd = (e: React.AnimationEvent) => {
    if (e.target === e.currentTarget) {
      setFlight(null);
    }
  };

  // Click on the banner or craft
  const handleBannerOrUfoClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // If it is the weather prompt, fetch GPS weather
    if (currentMessage.id === 'weather-prompt' || (!weatherData && currentMessage.category === 'weather')) {
      handleRequestLocation();
    } else if (currentMessage.category === 'weather' && weatherData) {
      // Cycle directly to the next weather variant (current -> forecast -> road notice -> greeting)
      const v = weatherVariantRef.current % 4;
      weatherVariantRef.current += 1;
      setCurrentMessage(buildWeatherBannerMessage(weatherData, v));
    } else {
      // Cycle to the next prioritized headline!
      setCurrentMessage(pickNextMessage());
    }

    // 360 loop-de-loop
    if (flight && !flight.isLooping) {
      setFlight((prev) => (prev ? { ...prev, isLooping: true } : null));
      setTimeout(() => {
        setFlight((prev) => (prev ? { ...prev, isLooping: false } : null));
      }, 1200);
    }
  };

  if (!flight) return null;

  const animName = `dynamicUfoFly_${flight.id}`;

  return (
    <div
      id="ufo-sky-corridor"
      /* z-[2] ensures the UFO passes strictly BEHIND the central spherical player and corona (z-10) */
      className="fixed inset-0 pointer-events-none z-[2] overflow-hidden select-none"
    >
      <style>{`
        @keyframes ${animName} {
          0% {
            transform: translate(${flight.startX}, ${flight.startY}) rotate(${flight.angle}deg);
          }
          100% {
            transform: translate(${flight.endX}, ${flight.endY}) rotate(${flight.angle}deg);
          }
        }
        @keyframes ufoHoverWobble {
          0%, 100% {
            transform: translateY(0px) rotate(1deg);
          }
          50% {
            transform: translateY(-8px) rotate(-1.5deg);
          }
        }
        @keyframes bannerFlutter {
          0%, 100% {
            transform: perspective(400px) rotateY(-1.2deg) skewY(0.4deg);
          }
          25% {
            transform: perspective(400px) rotateY(2.2deg) skewY(-0.7deg);
          }
          50% {
            transform: perspective(400px) rotateY(-1.6deg) skewY(0.5deg);
          }
          75% {
            transform: perspective(400px) rotateY(1.9deg) skewY(-0.4deg);
          }
        }
        @keyframes ufoLoopDeLoop {
          0% {
            transform: rotate(0deg) translateY(0px) scale(1);
          }
          50% {
            transform: rotate(180deg) translateY(-45px) scale(1.15);
          }
          100% {
            transform: rotate(360deg) translateY(0px) scale(1);
          }
        }
        @keyframes lightBlink {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* Convoy Container: UFO pulls at the front, banner trails at the rear */}
      <div
        id="ufo-convoy"
        className="absolute top-0 left-0 flex items-center cursor-pointer pointer-events-auto transition-transform active:scale-95"
        style={{
          animation: `${animName} ${flight.durationSec}s linear forwards`,
          flexDirection: 'row',
        }}
        onAnimationEnd={handleAnimationEnd}
        onClick={handleBannerOrUfoClick}
        title="Haz clic para cambiar de titular o hacer una pirueta"
      >
        {/* ========================================================================= */}
        {/* CASE A: LEFT-TO-RIGHT FLIGHT (Moving +X -> BANNER, CABLE, UFO AT FRONT) */}
        {/* ========================================================================= */}
        {flight.isL2R ? (
          <>
            {/* 1. TRAILING BANNER */}
            <BannerCloth isL2R={true} message={currentMessage} geoState={geoState} />

            {/* 2. TOW CABLE */}
            <TowCable isL2R={true} />

            {/* 3. LEADING UFO */}
            <UfoSaucer isLooping={flight.isLooping} isL2R={true} />
          </>
        ) : (
          /* ========================================================================= */
          /* CASE B: RIGHT-TO-LEFT FLIGHT (Moving -X -> UFO AT FRONT, CABLE, BANNER) */
          /* ========================================================================= */
          <>
            {/* 1. LEADING UFO */}
            <UfoSaucer isLooping={flight.isLooping} isL2R={false} />

            {/* 2. TOW CABLE */}
            <TowCable isL2R={false} />

            {/* 3. TRAILING BANNER */}
            <BannerCloth isL2R={false} message={currentMessage} geoState={geoState} />
          </>
        )}
      </div>
    </div>
  );
};

/* ========================================================================= */
/* SUB-COMPONENT: UFO SAUCER CRAFT */
/* ========================================================================= */
interface UfoSaucerProps {
  isLooping: boolean;
  isL2R: boolean;
}

const UfoSaucer: React.FC<UfoSaucerProps> = ({ isLooping, isL2R }) => {
  return (
    <div
      id="ufo-craft"
      className="relative shrink-0 flex items-center justify-center filter drop-shadow-[0_0_20px_rgba(34,211,238,0.65)]"
      style={{
        animation: isLooping
          ? 'ufoLoopDeLoop 1.2s ease-in-out'
          : 'ufoHoverWobble 3.5s ease-in-out infinite',
        transform: !isL2R ? 'scaleX(-1)' : undefined,
      }}
    >
      {/* Ion Thruster Plasma Glow underneath */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-10 h-4 bg-cyan-400/40 rounded-full blur-sm animate-pulse" />
      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 w-4 h-6 bg-gradient-to-b from-cyan-300 to-transparent rounded-full opacity-70 blur-[2px]" />

      {/* Saucer SVG Graphics */}
      <svg width="110" height="62" viewBox="0 0 110 62" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="domeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.85" />
            <stop offset="60%" stopColor="#06b6d4" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#083344" stopOpacity="0.7" />
          </linearGradient>

          <linearGradient id="hullGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e2e8f0" />
            <stop offset="35%" stopColor="#94a3b8" />
            <stop offset="70%" stopColor="#475569" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>

          <linearGradient id="rimGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="50%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>

        {/* Glass Cockpit Dome */}
        <path
          d="M 35 30 C 35 12, 75 12, 75 30 Z"
          fill="url(#domeGrad)"
          stroke="#a5f3fc"
          strokeWidth="1.2"
        />

        {/* Alien Pilot */}
        <g className="alien-pilot">
          <ellipse cx="55" cy="22" rx="7" ry="6.5" fill="#4ade80" />
          <ellipse cx="52.5" cy="21.5" rx="2" ry="2.8" fill="#022c22" transform="rotate(-10 52.5 21.5)" />
          <ellipse cx="57.5" cy="21.5" rx="2" ry="2.8" fill="#022c22" transform="rotate(10 57.5 21.5)" />
          <circle cx="53" cy="20.5" r="0.6" fill="#ffffff" />
          <circle cx="58" cy="20.5" r="0.6" fill="#ffffff" />
          <path d="M 55 15.5 Q 56 12 58 10" stroke="#4ade80" strokeWidth="1" fill="none" />
          <circle cx="58" cy="10" r="1.3" fill="#facc15" />
          <path d="M 53.5 25 Q 55 26.5 56.5 25" stroke="#065f46" strokeWidth="0.8" fill="none" strokeLinecap="round" />
        </g>

        {/* Dome Glass Gleam */}
        <path
          d="M 40 26 C 40 18, 52 15, 62 16"
          stroke="#ffffff"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.75"
        />

        {/* Main Saucer Hull */}
        <ellipse cx="55" cy="34" rx="48" ry="13" fill="url(#hullGrad)" stroke="#cbd5e1" strokeWidth="1" />

        {/* Glowing Rim Ring */}
        <ellipse cx="55" cy="35" rx="44" ry="8" fill="none" stroke="url(#rimGrad)" strokeWidth="1.5" />

        {/* Flashing Running Lights */}
        <circle cx="20" cy="34" r="2.2" fill="#f43f5e" style={{ animation: 'lightBlink 0.6s infinite alternate' }} />
        <circle cx="32" cy="38" r="2.4" fill="#38bdf8" style={{ animation: 'lightBlink 0.8s 0.2s infinite alternate' }} />
        <circle cx="46" cy="40.5" r="2.5" fill="#facc15" style={{ animation: 'lightBlink 0.7s 0.4s infinite alternate' }} />
        <circle cx="64" cy="40.5" r="2.5" fill="#4ade80" style={{ animation: 'lightBlink 0.7s 0.1s infinite alternate' }} />
        <circle cx="78" cy="38" r="2.4" fill="#c084fc" style={{ animation: 'lightBlink 0.8s 0.3s infinite alternate' }} />
        <circle cx="90" cy="34" r="2.2" fill="#22d3ee" style={{ animation: 'lightBlink 0.6s 0.5s infinite alternate' }} />

        {/* Bottom Thruster Chamber */}
        <ellipse cx="55" cy="43" rx="16" ry="4" fill="#083344" stroke="#22d3ee" strokeWidth="1" />
        <ellipse cx="55" cy="43" rx="10" ry="2.2" fill="#67e8f9" />

        {/* Tow Hitch Ring */}
        <path d="M 12 34 C 8 34, 4 36, 2 37" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
        <circle cx="2" cy="37" r="1.8" fill="#facc15" stroke="#94a3b8" strokeWidth="0.8" />
      </svg>
    </div>
  );
};

/* ========================================================================= */
/* SUB-COMPONENT: TOW CABLE / CUERDA DE REMOLQUE */
/* ========================================================================= */
interface TowCableProps {
  isL2R: boolean;
}

const TowCable: React.FC<TowCableProps> = ({ isL2R }) => {
  return (
    <div className="relative shrink-0 w-16 sm:w-20 md:w-24 h-12 flex items-center -mx-1">
      <svg className="w-full h-full" viewBox="0 0 90 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        {isL2R ? (
          <>
            <path d="M 2 8 L 18 20 M 2 32 L 18 20" stroke="#cbd5e1" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M 18 20 Q 45 28 88 20" stroke="#cbd5e1" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="3 2" />
            <circle cx="18" cy="20" r="2.2" fill="#facc15" stroke="#94a3b8" strokeWidth="0.8" />
          </>
        ) : (
          <>
            <path d="M 2 20 Q 45 28 72 20" stroke="#cbd5e1" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="3 2" />
            <path d="M 72 20 L 88 8 M 72 20 L 88 32" stroke="#cbd5e1" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="72" cy="20" r="2.2" fill="#facc15" stroke="#94a3b8" strokeWidth="0.8" />
          </>
        )}
      </svg>
    </div>
  );
};

/* ========================================================================= */
/* SUB-COMPONENT: AERIAL ADVERTISING BANNER CLOTH */
/* ========================================================================= */
interface BannerClothProps {
  isL2R: boolean;
  message: BannerMessage;
  geoState: 'idle' | 'prompting' | 'granted' | 'denied';
}

const BannerCloth: React.FC<BannerClothProps> = ({ isL2R, message, geoState }) => {
  const getSchemeStyles = (scheme?: string) => {
    switch (scheme) {
      case 'cyan':
        return {
          tagBg: 'bg-cyan-900/80 text-cyan-200 border-cyan-400/40',
          headlineColor: 'text-cyan-950',
          gradientBg: 'from-cyan-50/95 via-sky-50/95 to-cyan-100/95',
        };
      case 'emerald':
        return {
          tagBg: 'bg-emerald-900/80 text-emerald-200 border-emerald-400/40',
          headlineColor: 'text-emerald-950',
          gradientBg: 'from-emerald-50/95 via-teal-50/95 to-emerald-100/95',
        };
      case 'purple':
        return {
          tagBg: 'bg-purple-900/80 text-purple-200 border-purple-400/40',
          headlineColor: 'text-purple-950',
          gradientBg: 'from-purple-50/95 via-pink-50/95 to-purple-100/95',
        };
      case 'amber':
        return {
          tagBg: 'bg-amber-900/80 text-amber-200 border-amber-400/40',
          headlineColor: 'text-amber-950',
          gradientBg: 'from-amber-50/95 via-yellow-50/95 to-amber-100/95',
        };
      case 'blue':
        return {
          tagBg: 'bg-blue-900/80 text-blue-200 border-blue-400/40',
          headlineColor: 'text-blue-950',
          gradientBg: 'from-blue-50/95 via-sky-50/95 to-indigo-100/95',
        };
      case 'rose':
      default:
        return {
          tagBg: 'bg-rose-900/80 text-rose-200 border-rose-400/40',
          headlineColor: 'text-rose-950',
          gradientBg: 'from-rose-50/95 via-orange-50/95 to-amber-100/95',
        };
    }
  };

  const scheme = getSchemeStyles(message.colorScheme);

  return (
    <div
      id="ufo-banner-cloth"
      className="relative flex items-center filter drop-shadow-[0_6px_20px_rgba(0,0,0,0.65)]"
      style={{
        animation: 'bannerFlutter 2.6s ease-in-out infinite',
        transformOrigin: isL2R ? 'right center' : 'left center',
      }}
    >
      {/* If moving Right-to-Left, leading spreader bar is on left */}
      {!isL2R && (
        <div className="w-2 h-16 bg-gradient-to-b from-slate-400 via-slate-200 to-slate-500 rounded-sm shadow-md border border-slate-600 shrink-0" />
      )}

      {/* The Cloth Banner Body */}
      <div
        className={`relative flex items-center gap-2.5 sm:gap-3 px-4 sm:px-6 py-2 sm:py-2.5 rounded-sm border-y-2 border-slate-300/85 bg-gradient-to-r ${scheme.gradientBg} shadow-xl select-none backdrop-blur-sm`}
        style={{
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -1px 0 rgba(0,0,0,0.15)',
        }}
      >
        {/* Metal grommets */}
        <div className={`absolute ${isL2R ? 'right-1' : 'left-1'} top-1.5 w-1.5 h-1.5 rounded-full bg-slate-400 border border-slate-600`} />
        <div className={`absolute ${isL2R ? 'right-1' : 'left-1'} bottom-1.5 w-1.5 h-1.5 rounded-full bg-slate-400 border border-slate-600`} />

        {/* Thematic Icon */}
        <div className="shrink-0 flex items-center justify-center text-xl sm:text-2xl leading-none drop-shadow-sm">
          <span>{message.icon}</span>
        </div>

        {/* Dynamic Information Block */}
        <div className="flex flex-col text-left max-w-[280px] sm:max-w-[420px] md:max-w-[520px]">
          {/* Category Tag Badge */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`text-[9px] sm:text-[10px] font-mono font-bold tracking-widest uppercase px-1.5 py-0.5 rounded border ${scheme.tagBg}`}
            >
              {message.tag}
            </span>
            {geoState === 'prompting' && (
              <span className="text-[9px] font-mono text-cyan-800 font-bold animate-pulse">
                Consultando satélite meteorológico...
              </span>
            )}
            {message.id === 'weather-prompt' && (
              <span className="text-[9px] font-mono bg-cyan-600 text-white px-1.5 py-0.5 rounded font-bold animate-pulse shadow-sm">
                ¡Toca la pancarta para activar!
              </span>
            )}
            {message.category === 'weather' && message.id !== 'weather-prompt' && (
              <span className="text-[9px] font-mono text-cyan-800/80 font-medium hidden sm:inline">
                • Toca para alternar aviso/pronóstico
              </span>
            )}
          </div>

          {/* Headline */}
          <span
            className={`font-extrabold text-xs sm:text-sm md:text-base tracking-tight leading-snug font-sans drop-shadow-[0_1px_0_rgba(255,255,255,0.9)] truncate mt-0.5 ${scheme.headlineColor}`}
            title={message.headline}
          >
            {message.headline}
          </span>

          {/* Subtext */}
          {message.subtext && (
            <span className="text-[9px] sm:text-[11px] font-semibold tracking-wide text-slate-700 truncate -mt-0.5">
              {message.subtext}
            </span>
          )}
        </div>

        {/* Trailing Ribbons at the tail of the banner */}
        <div
          className={`absolute ${
            isL2R ? '-left-4' : '-right-4'
          } top-1/2 -translate-y-1/2 flex flex-col gap-1.5`}
        >
          <div
            className="w-4 h-1 bg-rose-500 rounded-full animate-pulse"
            style={{ transform: isL2R ? 'scaleX(-1)' : undefined }}
          />
          <div
            className="w-5 h-1 bg-amber-400 rounded-full"
            style={{ transform: isL2R ? 'scaleX(-1)' : undefined }}
          />
          <div
            className="w-3.5 h-1 bg-sky-500 rounded-full animate-pulse"
            style={{ transform: isL2R ? 'scaleX(-1)' : undefined }}
          />
        </div>
      </div>

      {/* If moving Left-to-Right, leading spreader bar is on right */}
      {isL2R && (
        <div className="w-2 h-16 bg-gradient-to-b from-slate-400 via-slate-200 to-slate-500 rounded-sm shadow-md border border-slate-600 shrink-0" />
      )}
    </div>
  );
};
