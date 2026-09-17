export interface BannerMessage {
  id: string;
  category: 'greeting' | 'weather' | 'news' | 'quote' | 'anniversary' | 'tip';
  tag: string;
  headline: string;
  subtext?: string;
  icon: string;
  colorScheme?: 'rose' | 'amber' | 'emerald' | 'cyan' | 'purple' | 'blue';
}

// 1. AVISOS DE SEGURIDAD Y CARRETERA (DGT & Tráfico)
export const ROAD_SAFETY_ALERTS: BannerMessage[] = [
  {
    id: 'alert-dist-1',
    category: 'tip',
    tag: 'SEGURIDAD VIAL',
    headline: 'Mantén la distancia de seguridad: mínimo 2 segundos con el vehículo precedente',
    subtext: '★ Con lluvia o calzada mojada, duplica la distancia a 4 segundos ★',
    icon: '🛡️',
    colorScheme: 'rose',
  },
  {
    id: 'alert-rest-1',
    category: 'tip',
    tag: 'AVISO EN RUTA',
    headline: 'Descanso en viaje: realiza una parada cada 2 horas o 200 kilómetros',
    subtext: '★ Estira las piernas, hidrátate y mantén la concentración al volante ★',
    icon: '☕',
    colorScheme: 'amber',
  },
  {
    id: 'alert-tires-1',
    category: 'tip',
    tag: 'MANTENIMIENTO DEL VEHÍCULO',
    headline: 'Revisa la presión de los neumáticos antes de trayectos largos',
    subtext: '★ La presión adecuada ahorra hasta un 5% de combustible y previene reventones ★',
    icon: '⚙️',
    colorScheme: 'cyan',
  },
  {
    id: 'alert-lights-1',
    category: 'tip',
    tag: 'NORMATIVA DGT',
    headline: 'En túneles y pasos inferiores: encendido obligatorio de luces de cruce',
    subtext: '★ Quítate las gafas de sol y mantén 100 m de separación de seguridad ★',
    icon: '💡',
    colorScheme: 'blue',
  },
  {
    id: 'alert-overtaking-1',
    category: 'tip',
    tag: 'CIRCULACIÓN FLUIDA',
    headline: 'Circula por el carril derecho y utiliza el izquierdo solo para adelantar',
    subtext: '★ Facilita la fluidez del tráfico y evita maniobras bruscas de alcance ★',
    icon: '🚗',
    colorScheme: 'emerald',
  },
];

// 2. NOTICIAS ACTUALES Y DE ACTUALIDAD EN RUTA (Alta prioridad)
export const CURRENT_NEWS_MESSAGES: BannerMessage[] = [
  {
    id: 'news-traffic-1',
    category: 'news',
    tag: 'TRÁFICO & VIALIDAD',
    headline: 'Campaña especial de control de velocidad y distancia en autovías',
    subtext: '★ Precaución en tramos interurbanos, incorporaciones y glorietas ★',
    icon: '🚔',
    colorScheme: 'amber',
  },
  {
    id: 'news-space-1',
    category: 'news',
    tag: 'EXPLORACIÓN ESPACIAL',
    headline: 'El telescopio James Webb halla firmas de vapor de agua en exoplanetas',
    subtext: '★ Nuevos avances en la búsqueda de atmósferas y mundos habitables ★',
    icon: '🔭',
    colorScheme: 'cyan',
  },
  {
    id: 'news-auto-1',
    category: 'news',
    tag: 'TECNOLOGÍA DEL MOTOR',
    headline: 'Nuevas baterías de estado sólido superan los 1.000 km de autonomía',
    subtext: '★ Tiempos de recarga de menos de 10 minutos para la próxima generación ★',
    icon: '⚡',
    colorScheme: 'emerald',
  },
  {
    id: 'news-music-1',
    category: 'news',
    tag: 'ACTUALIDAD AUDIO',
    headline: 'El sonido envolvente en cabina reduce el cansancio acústico en ruta',
    subtext: '★ Ecualización binaural optimizada para una experiencia acústica pura ★',
    icon: '🎧',
    colorScheme: 'purple',
  },
  {
    id: 'news-science-1',
    category: 'news',
    tag: 'CIENCIA & COSMOS',
    headline: 'El ciclo solar 25 alcanza su cénit con espectaculares auroras polares',
    subtext: '★ Fenómenos luminosos visibles en latitudes medias por vientos solares ★',
    icon: '🌌',
    colorScheme: 'blue',
  },
  {
    id: 'news-traffic-2',
    category: 'news',
    tag: 'MOVILIDAD SOSTENIBLE',
    headline: 'Corredores inteligentes sincronizan semáforos y reducen retenciones',
    subtext: '★ Hasta un 20% menos de paradas y emisiones en accesos metropolitanos ★',
    icon: '🌱',
    colorScheme: 'emerald',
  },
  {
    id: 'news-music-2',
    category: 'news',
    tag: 'CULTURA & ALTA FIDELIDAD',
    headline: 'El streaming sin pérdidas (Lossless) bate récords de escuchas en carretera',
    subtext: '★ Los conductores prefieren calidad de master original sin compresión ★',
    icon: '🎵',
    colorScheme: 'purple',
  },
  {
    id: 'news-tech-1',
    category: 'news',
    tag: 'CONECTIVIDAD VEHICULAR',
    headline: 'Sistemas V2X permiten a los vehículos alertar de frenazos imprevistos',
    subtext: '★ Comunicación instantánea coche a coche para anticipar incidencias ★',
    icon: '🛰️',
    colorScheme: 'cyan',
  },
];

// 3. EFEMÉRIDES HISTÓRICAS (TAL DÍA COMO HOY / ANIVERSARIOS CÉLEBRES)
export const HISTORICAL_ANNIVERSARIES: BannerMessage[] = [
  {
    id: 'anniv-voyager-1',
    category: 'anniversary',
    tag: 'EFEMÉRIDE ESPACIAL',
    headline: 'En 1977 despegó la Voyager 1: viaja ahora a más de 24.000 millones de km',
    subtext: '★ Portando el Disco de Oro con música de Bach, Chuck Berry y Mozart ★',
    icon: '🛸',
    colorScheme: 'cyan',
  },
  {
    id: 'anniv-benz-1',
    category: 'anniversary',
    tag: 'HISTORIA DEL AUTOMÓVIL',
    headline: 'En 1888 Bertha Benz completó el primer viaje de 106 km en automóvil',
    subtext: '★ Demostró al mundo entero la fiabilidad y el futuro del transporte moderno ★',
    icon: '🏁',
    colorScheme: 'amber',
  },
  {
    id: 'anniv-apollo-1',
    category: 'anniversary',
    tag: 'TAL DÍA COMO HOY',
    headline: 'La misión Apolo 11 transmitió las primeras palabras desde el Mar de la Tranquilidad',
    subtext: '★ «Un pequeño paso para el hombre, un gran salto para la humanidad» ★',
    icon: '🌕',
    colorScheme: 'blue',
  },
  {
    id: 'anniv-volvo-1',
    category: 'anniversary',
    tag: 'HITO DE SEGURIDAD',
    headline: 'Nils Bohlin patentó en 1959 el cinturón de seguridad de tres puntos',
    subtext: '★ Volvo liberó la patente para salvar más de un millón de vidas en el mundo ★',
    icon: '🎗️',
    colorScheme: 'emerald',
  },
  {
    id: 'anniv-vinyl-1',
    category: 'anniversary',
    tag: 'ANIVERSARIO MUSICAL',
    headline: 'En 1948 Columbia Records presentó el primer disco de vinilo Long Play (LP)',
    subtext: '★ Transformó para siempre la forma de escuchar y disfrutar álbumes completos ★',
    icon: '📻',
    colorScheme: 'purple',
  },
  {
    id: 'anniv-mp3-1',
    category: 'anniversary',
    tag: 'HISTORIA DEL AUDIO DIGITAL',
    headline: 'El Instituto Fraunhofer estandarizó el formato de audio digital MP3',
    subtext: '★ Revolucionó la música portátil permitiendo llevar discografías en el bolsillo ★',
    icon: '💾',
    colorScheme: 'cyan',
  },
  {
    id: 'anniv-dark-side-1',
    category: 'anniversary',
    tag: 'EFEMÉRIDE DE ÁLBUM',
    headline: 'Pink Floyd lanzó «The Dark Side of the Moon», obra cumbre de la ingeniería sonora',
    subtext: '★ Más de 900 semanas consecutivas en las listas de éxitos de todo el planeta ★',
    icon: '🌈',
    colorScheme: 'rose',
  },
];

// 4. FRASES CÉLEBRES E INSPIRADORAS
export const FAMOUS_QUOTES: BannerMessage[] = [
  {
    id: 'quote-1',
    category: 'quote',
    tag: 'FRASE CÉLEBRE',
    headline: '«La música es la taquigrafía de la emoción»',
    subtext: '— León Tolstói',
    icon: '🎶',
    colorScheme: 'purple',
  },
  {
    id: 'quote-2',
    category: 'quote',
    tag: 'SABIDURÍA DE RUTA',
    headline: '«El camino es el destino: disfrútalo paso a paso»',
    subtext: '— Proverbio del viajero',
    icon: '🛣️',
    colorScheme: 'cyan',
  },
  {
    id: 'quote-3',
    category: 'quote',
    tag: 'FILOSOFÍA',
    headline: '«Sin música, la vida sería un error»',
    subtext: '— Friedrich Nietzsche',
    icon: '🎼',
    colorScheme: 'rose',
  },
  {
    id: 'quote-4',
    category: 'quote',
    tag: 'INSPIRACIÓN',
    headline: '«La música puede cambiar el mundo porque puede cambiar a las personas»',
    subtext: '— Bono',
    icon: '✨',
    colorScheme: 'emerald',
  },
  {
    id: 'quote-5',
    category: 'quote',
    tag: 'PENSAMIENTO CÓSMICO',
    headline: '«Somos una forma de que el cosmos se conozca a sí mismo»',
    subtext: '— Carl Sagan',
    icon: '🪐',
    colorScheme: 'blue',
  },
  {
    id: 'quote-6',
    category: 'quote',
    tag: 'PASIÓN POR LA MÚSICA',
    headline: '«Donde las palabras fallan, la música habla»',
    subtext: '— Hans Christian Andersen',
    icon: '🎻',
    colorScheme: 'amber',
  },
];

// Generador dinámico de saludo según la hora del día
export function getTimeGreetingMessage(): BannerMessage {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) {
    return {
      id: 'greeting-morning',
      category: 'greeting',
      tag: '¡BUENOS DÍAS!',
      headline: 'Comienza tu jornada con la mejor selección musical',
      subtext: '★ Viaje despejado · Conduce con energía y buen ritmo ★',
      icon: '🌅',
      colorScheme: 'amber',
    };
  } else if (hour >= 12 && hour < 20) {
    return {
      id: 'greeting-afternoon',
      category: 'greeting',
      tag: '¡BUENAS TARDES!',
      headline: 'Disfruta del trayecto con la máxima fidelidad de sonido',
      subtext: '★ Mantén la distancia y la atención en la carretera ★',
      icon: '☀️',
      colorScheme: 'cyan',
    };
  } else {
    return {
      id: 'greeting-night',
      category: 'greeting',
      tag: '¡BUENAS NOCHES!',
      headline: 'Conducción nocturna: enciende luces y vigila el cansancio',
      subtext: '★ Que las melodías te acompañen bajo el cielo estrellado ★',
      icon: '🌙',
      colorScheme: 'blue',
    };
  }
}

// Lista secundaria para rotación balanceada
export const SECONDARY_MESSAGES: BannerMessage[] = [
  ...HISTORICAL_ANNIVERSARIES,
  ...FAMOUS_QUOTES,
  ...ROAD_SAFETY_ALERTS,
];
