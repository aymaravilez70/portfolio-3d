export type OrbitProject = {
  id: string
  number: string
  title: string
  discipline: string
  year: string
  summary: string
  stack: string[]
  color: string
  image: string
}

export const projects: OrbitProject[] = [
  {
    id: 'ecosort-ai',
    number: '01',
    title: 'EcoSort AI',
    discipline: 'IA & Automatización · Backend',
    year: '2025',
    summary: 'Sistema de clasificación automatizada de productos excedentes con IA (Donar, Reciclar, Liquidar). Flujos en n8n para webhooks, inferencia y alertas.',
    stack: ['FastAPI', 'n8n', 'Python', 'JavaScript'],
    color: '#34d399',
    image: '/projects/ecosort-ai.png',
  },
  {
    id: 'yale-app',
    number: '02',
    title: 'Yale App',
    discipline: 'Streaming en Tiempo Real · Fullstack',
    year: '2025',
    summary: 'Plataforma multiplataforma (Web y Móvil) para reproducción compartida y sincronizada de música y videos en salas con WebSockets.',
    stack: ['React', 'React Native (Expo)', 'Node.js', 'WebSockets'],
    color: '#60a5fa',
    image: '/projects/yale.png',
  },
  {
    id: 'waspbot',
    number: '03',
    title: 'WaspBot',
    discipline: 'Bot Automatizado · WhatsApp API',
    year: '2024',
    summary: 'Bot inteligente para WhatsApp conectado mediante QR. Convierte fotos en stickers con !s y busca/envía música en audio con !play en tiempo real.',
    stack: ['Node.js', 'JavaScript', 'WhatsApp Web API'],
    color: '#fbbf24',
    image: '/projects/project1.jpg',
  },
  {
    id: 'nocion',
    number: '04',
    title: 'Nocion – Hábitos',
    discipline: 'Gestión & Productividad · Web',
    year: '2024',
    summary: 'Sistema académico para el seguimiento de hábitos, rutinas diarias y recordatorios, con métricas de cumplimiento y calendario interactivo.',
    stack: ['PHP', 'JavaScript', 'Bootstrap', 'MySQL'],
    color: '#a78bfa',
    image: '/projects/project3.png',
  },
  {
    id: 'melopatitas',
    number: '05',
    title: 'MeloPatitas',
    discipline: 'Impacto Social · Plataforma Web',
    year: '2024',
    summary: 'Portal para la Fundación MeloPatitas para adopción y rescate de mascotas, seguimiento de animales rescatados, donaciones y gestión de roles.',
    stack: ['PHP', 'Bootstrap', 'JavaScript', 'SQL'],
    color: '#f87171',
    image: '/projects/project2.png',
  },
  {
    id: 'waike',
    number: '06',
    title: 'Waike',
    discipline: 'Diseño & App Móvil · Música',
    year: '2024',
    summary: 'Aplicación móvil de streaming musical. Descubre canciones, administra playlists y disfruta de una experiencia auditiva fluida.',
    stack: ['UI/UX', 'Mobile App', 'JavaScript'],
    color: '#f472b6',
    image: '/projects/waike.jpg',
  },
  {
    id: 'hpo-shop',
    number: '07',
    title: 'HPO SHOP',
    discipline: 'E-commerce · Catálogo Digital',
    year: '2024',
    summary: 'Catálogo interactivo con diseño moderno y vibrante para exploración y pedido ágil de productos con navegación intuitiva.',
    stack: ['JavaScript', 'HTML5', 'CSS3', 'Responsive Design'],
    color: '#fb923c',
    image: '/projects/hposhop.png',
  },
]
