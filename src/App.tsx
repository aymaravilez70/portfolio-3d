import { Suspense, lazy, useCallback, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowLeft, ArrowUpRight, Car, Compass, Keyboard, List, Star, Trophy, X } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import type { CSSProperties } from 'react'
import { projects } from './data/projects'
import type { OrbitProject } from './data/projects'
import { playCompletionSound, playStarCollectSound } from './utils/audio'

const OpenWorld = lazy(() => import('./components/OpenWorld'))
type Place = 'work' | 'about' | 'skills' | 'contact'
const placeNames: Record<Place, string> = { work: 'Garaje de proyectos', about: 'Estudio', skills: 'Torre de señal', contact: 'Puesto postal' }

function WorkPreview({ project }: { project: OrbitProject }) {
  return (
    <div className="work-preview" style={{ '--project-color': project.color } as CSSProperties}>
      <div className="browser-chrome">
        <span />
        <span />
        <span />
        <b>{project.title.toLowerCase().replaceAll(' ', '-')}.app</b>
        <span
          style={{
            marginLeft: 'auto',
            background: `${project.color}22`,
            color: project.color,
            border: `1px solid ${project.color}55`,
            padding: '2px 6px',
            borderRadius: '2px',
            fontSize: '7px',
            fontFamily: 'var(--mono)',
            fontWeight: 700,
          }}
        >
          {project.discipline.split('·')[0].trim()}
        </span>
      </div>
      <div className="project-preview-wrap">
        <img
          src={project.image}
          alt={project.title}
          className="project-preview-img"
          loading="lazy"
        />
        <div className="project-preview-overlay">
          <span className="project-preview-pill">PROYECTO REAL</span>
        </div>
      </div>
      <span className="preview-watermark">AYMAR AVILÉS · {project.year}</span>
    </div>
  )
}

function ProjectCase({ project }: { project: OrbitProject }) {
  return (
    <motion.article
      className="case-content"
      key={project.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
    >
      <WorkPreview project={project} />
      <div className="case-copy">
        <div className="case-meta">
          <span>{project.number} / 07 · {project.discipline}</span>
          <span>{project.year}</span>
        </div>
        <h3>{project.title}</h3>
        <p>{project.summary}</p>
        <div className="case-stack">
          {project.stack.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
        <div className="project-case-footer">
          <small>Desarrollado y construido por Aymar Avilés Ronquillo.</small>
        </div>
      </div>
    </motion.article>
  )
}

function PlaceContent({
  place,
  activeProject,
  onSelectProject,
}: {
  place: Place
  activeProject: OrbitProject
  onSelectProject: (id: string) => void
}) {
  if (place === 'work') {
    return (
      <div className="work-room">
        <div className="work-list" aria-label="Proyectos de Aymar Avilés">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => onSelectProject(project.id)}
              className={activeProject.id === project.id ? 'selected' : ''}
              aria-pressed={activeProject.id === project.id}
            >
              <span style={{ color: project.color }}>{project.number}</span>
              <span>{project.title}</span>
              <small>{project.discipline.split('·')[0].trim()}</small>
              <ArrowUpRight size={16} />
            </button>
          ))}
        </div>
        <ProjectCase project={activeProject} />
      </div>
    )
  }

  if (place === 'about') {
    return (
      <div className="info-room about-room">
        <span className="room-coordinate">ESTUDIO / PERFIL PROFESIONAL</span>
        <div className="about-hero">
          <div className="about-badge-wrap">
            <div className="about-monogram">AA</div>
            <div className="about-badge-status">
              <span className="status-dot" />
              <span>DISPONIBLE</span>
            </div>
            <small>DEV · JUNIOR</small>
          </div>
          <div className="about-intro">
            <h3>Aymar Avilés Ronquillo</h3>
            <p className="about-subtitle">Desarrollador Web Junior · Soluciones digitales de alto impacto</p>
            <p className="about-lead">
              Apasionado por la creación de software con <strong>React, Next.js, Node.js y Python</strong>. Mi enfoque combina <strong>código limpio</strong>, <strong>mejores prácticas</strong> e <strong>innovación continua</strong> para entregar proyectos performantes con excelente experiencia de usuario.
            </p>
            <div className="about-actions">
              <a
                href="/CV_Aymar_Aviles.pdf"
                download="CV_Aymar_Aviles.pdf"
                className="about-cv-button"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>Descargar CV (PDF)</span>
                <ArrowUpRight size={14} />
              </a>
              <a href="mailto:avilezaymar70@gmail.com" className="about-contact-btn">
                <span>Escríbeme</span>
              </a>
            </div>
          </div>
        </div>

        <div className="about-experience-section">
          <h4>Trayectoria & Experiencia Profesional</h4>
          <div className="experience-timeline">
            <div className="timeline-item">
              <div className="timeline-header">
                <strong>Vendedor & Control de Stock | Alvirene</strong>
                <span>Jun 2024 — Feb 2025</span>
              </div>
              <p>Gestión de ventas, levantamiento de inventario de más de 500 productos, registros contables y control de stock en empresa ferretera y de construcción.</p>
            </div>
            <div className="timeline-item">
              <div className="timeline-header">
                <strong>Especialista en Base de Datos | Farmacia Anthony</strong>
                <span>Ene 2024 — Jun 2024</span>
              </div>
              <p>Mantenimiento de base de datos farmacéutica, registro de medicamentos, conciliación de inventarios y control de precisión en más de 800 registros.</p>
            </div>
            <div className="timeline-item">
              <div className="timeline-header">
                <strong>Asistente en Prácticas | Punto de Encuentro</strong>
                <span>Sep 2022 — Mar 2023</span>
              </div>
              <p>Soporte técnico a usuarios, resolución de incidencias y capacitación en herramientas ofimáticas (Microsoft Office, Google Workspace).</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (place === 'skills') {
    return (
      <div className="info-room skills-room">
        <div className="signal-telemetry-header">
          <div className="signal-badge-top">
            <span className="signal-live-dot" />
            <span className="signal-coordinate">TORRE DE SEÑAL // RADAR TÉCNICO & TELEMETRÍA</span>
          </div>
          <h3>Capacidades en Producción &<br />Arquitectura de Software</h3>
          <p className="skills-subtitle">
            Sin porcentajes abstractos ni barras genéricas: cada tecnología aquí forma parte de proyectos reales que he construido, integrado y puesto en funcionamiento.
          </p>

          <div className="skills-metrics-strip">
            <div className="metric-chip">
              <span className="metric-val">7+</span>
              <span className="metric-lbl">Proyectos Reales</span>
            </div>
            <div className="metric-chip">
              <span className="metric-val">Full-Stack</span>
              <span className="metric-lbl">Visión Extremo a Extremo</span>
            </div>
            <div className="metric-chip">
              <span className="metric-val">Real-Time</span>
              <span className="metric-lbl">WebSockets & Streaming</span>
            </div>
            <div className="metric-chip">
              <span className="metric-val">Auto & IA</span>
              <span className="metric-lbl">FastAPI + n8n + Bots</span>
            </div>
          </div>
        </div>

        {/* Módulos de Transmisión: Capacidades Demostradas en Proyectos Reales */}
        <div className="signal-modules-section">
          <div className="section-label-bar">
            <span>MÓDULOS DE CAPACIDAD TÉCNICA (CASOS EN PRODUCCIÓN)</span>
            <small>6 SISTEMAS VERIFICADOS</small>
          </div>

          <div className="signal-modules-grid">
            <div className="signal-module-card">
              <div className="module-top">
                <span className="channel-badge">CH-01 // INTELIGENCIA ARTIFICIAL</span>
                <span className="status-tag live">● ACTIVO</span>
              </div>
              <h4>IA & Pipelines de Clasificación</h4>
              <p className="module-desc">
                Despliegue de modelos de Computer Vision para categorización inteligente de residuos, integración con webhooks asíncronos y respuestas de alta velocidad.
              </p>
              <div className="module-stack-tags">
                <span>Python</span>
                <span>FastAPI</span>
                <span>n8n</span>
                <span>Hugging Face</span>
              </div>
              <div className="module-proof">
                <small>PROYECTO DESPLEGADO</small>
                <strong>EcoSort AI</strong>
              </div>
            </div>

            <div className="signal-module-card">
              <div className="module-top">
                <span className="channel-badge">CH-02 // TIEMPO REAL & MÓVIL</span>
                <span className="status-tag live">● ACTIVO</span>
              </div>
              <h4>Streaming & Conexiones en Vivo</h4>
              <p className="module-desc">
                Transmisión de vídeo en directo con mínima latencia, sincronización bidireccional mediante sockets y control de dispositivos en entornos móviles y web.
              </p>
              <div className="module-stack-tags">
                <span>React Native</span>
                <span>React</span>
                <span>Node.js</span>
                <span>WebSockets</span>
              </div>
              <div className="module-proof">
                <small>PROYECTO DESPLEGADO</small>
                <strong>Yale App</strong>
              </div>
            </div>

            <div className="signal-module-card">
              <div className="module-top">
                <span className="channel-badge">CH-03 // AUTOMATIZACIÓN CONVERSACIONAL</span>
                <span className="status-tag live">● ACTIVO</span>
              </div>
              <h4>Bots & Flujos Automatizados 24/7</h4>
              <p className="module-desc">
                Procesamiento desatendido de mensajería multi-usuario, parsing dinámico de comandos y automatización de respuestas inmediatas sobre APIs conversacionales.
              </p>
              <div className="module-stack-tags">
                <span>Node.js</span>
                <span>WhatsApp API</span>
                <span>Baileys</span>
                <span>Express</span>
              </div>
              <div className="module-proof">
                <small>PROYECTO DESPLEGADO</small>
                <strong>WaspBot</strong>
              </div>
            </div>

            <div className="signal-module-card">
              <div className="module-top">
                <span className="channel-badge">CH-04 // GESTIÓN & DASHBOARDS</span>
                <span className="status-tag live">● ACTIVO</span>
              </div>
              <h4>Plataformas de Control & Inventarios</h4>
              <p className="module-desc">
                Paneles de administración centralizada, control de stock con consistencia relacional ACID, reportes operativos y autenticación segura con roles de usuario.
              </p>
              <div className="module-stack-tags">
                <span>PHP</span>
                <span>JavaScript</span>
                <span>Bootstrap</span>
                <span>MySQL</span>
              </div>
              <div className="module-proof">
                <small>PROYECTO DESPLEGADO</small>
                <strong>Nocion</strong>
              </div>
            </div>

            <div className="signal-module-card">
              <div className="module-top">
                <span className="channel-badge">CH-05 // GEOLOCALIZACIÓN & COMUNIDAD</span>
                <span className="status-tag live">● ACTIVO</span>
              </div>
              <h4>Plataformas Sociales & Rescate Animal</h4>
              <p className="module-desc">
                Georreferenciación de casos con mapas interactivos, gestión comunitaria de rescates, filtros por zona geográfica y fichas dinámicas de adopción.
              </p>
              <div className="module-stack-tags">
                <span>PHP</span>
                <span>MySQL</span>
                <span>CSS3</span>
                <span>Leaflet</span>
              </div>
              <div className="module-proof">
                <small>PROYECTO DESPLEGADO</small>
                <strong>MeloPatitas</strong>
              </div>
            </div>

            <div className="signal-module-card">
              <div className="module-top">
                <span className="channel-badge">CH-06 // COMERCIO & FRONTEND ÁGIL</span>
                <span className="status-tag live">● ACTIVO</span>
              </div>
              <h4>E-Commerce & Catálogos Web Rápidos</h4>
              <p className="module-desc">
                Catálogos comerciales optimizados para velocidad en redes móviles, filtrado dinámico de inventario, diseño ultra-responsivo y conversión directa vía WhatsApp.
              </p>
              <div className="module-stack-tags">
                <span>JavaScript</span>
                <span>HTML5</span>
                <span>CSS3 Flex/Grid</span>
                <span>UI/UX</span>
              </div>
              <div className="module-proof">
                <small>PROYECTO DESPLEGADO</small>
                <strong>HPO SHOP</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Arsenal Tecnológico Integral por Capas */}
        <div className="tech-matrix-section">
          <div className="section-label-bar">
            <span>MATRIZ TECNOLÓGICA POR CAPAS DE ARQUITECTURA</span>
            <small>DOMINIO FULL-STACK</small>
          </div>

          <div className="tech-layers-grid">
            <div className="tech-layer-card">
              <div className="layer-header">
                <span className="layer-num">CAPA 01</span>
                <strong>Frontend & Interfaces Modernas</strong>
              </div>
              <p className="layer-summary">
                Construcción de interfaces reactivas, código modular, consumo fluido de APIs y adaptación impecable a cualquier resolución.
              </p>
              <div className="layer-tags">
                <span className="tech-pill core">React</span>
                <span className="tech-pill core">React Native</span>
                <span className="tech-pill core">Next.js</span>
                <span className="tech-pill core">JavaScript (ES6+)</span>
                <span className="tech-pill">TypeScript</span>
                <span className="tech-pill">Tailwind CSS</span>
                <span className="tech-pill">Bootstrap</span>
                <span className="tech-pill">HTML5 Semántico</span>
                <span className="tech-pill">CSS3 / Flex & Grid</span>
                <span className="tech-pill">Vite</span>
              </div>
            </div>

            <div className="tech-layer-card">
              <div className="layer-header">
                <span className="layer-num">CAPA 02</span>
                <strong>Backend, Lógica & Microservicios</strong>
              </div>
              <p className="layer-summary">
                Desarrollo de servicios backend fiables, endpoints RESTful optimizados, streaming con WebSockets y lógica de negocio segura.
              </p>
              <div className="layer-tags">
                <span className="tech-pill core">Python</span>
                <span className="tech-pill core">FastAPI</span>
                <span className="tech-pill core">Node.js</span>
                <span className="tech-pill core">Express</span>
                <span className="tech-pill">PHP</span>
                <span className="tech-pill">WebSockets</span>
                <span className="tech-pill">APIs RESTful</span>
                <span className="tech-pill">Autenticación JWT</span>
                <span className="tech-pill">Arquitectura Cliente-Servidor</span>
              </div>
            </div>

            <div className="tech-layer-card">
              <div className="layer-header">
                <span className="layer-num">CAPA 03</span>
                <strong>Datos, Automatización & Entorno</strong>
              </div>
              <p className="layer-summary">
                Manejo estructurado de información relacional, integración continua, control de versiones y automatización de flujos de trabajo.
              </p>
              <div className="layer-tags">
                <span className="tech-pill core">MySQL</span>
                <span className="tech-pill core">PostgreSQL</span>
                <span className="tech-pill">SQLite</span>
                <span className="tech-pill core">n8n Workflows</span>
                <span className="tech-pill">Git & GitHub</span>
                <span className="tech-pill">Postman</span>
                <span className="tech-pill">Figma (Prototipado)</span>
                <span className="tech-pill">Linux CLI / Bash</span>
              </div>
            </div>
          </div>
        </div>

        {/* Estándares de Ingeniería */}
        <div className="engineering-standards-bar">
          <div className="standard-item">
            <span className="standard-num">01</span>
            <div>
              <strong>Código Limpio & Modular</strong>
              <small>Componentes legibles, desacoplados y listos para escalar.</small>
            </div>
          </div>
          <div className="standard-item">
            <span className="standard-num">02</span>
            <div>
              <strong>Enfoque en Producción</strong>
              <small>Del problema a la solución implementada y verificada.</small>
            </div>
          </div>
          <div className="standard-item">
            <span className="standard-num">03</span>
            <div>
              <strong>Evolución Continua</strong>
              <small>Curiosidad técnica y rápida adopción de nuevas herramientas.</small>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Contact
  return (
    <div className="info-room contact-room">
      <span className="room-coordinate">PUESTO POSTAL / CANAL DIRECTO</span>
      <h3>¿Hacemos algo<br />increíble juntos?</h3>
      <p>Estoy disponible para nuevos proyectos, oportunidades laborales y colaboraciones en desarrollo web.</p>

      <div className="contact-methods-grid">
        <a className="contact-card" href="mailto:avilezaymar70@gmail.com">
          <small>CORREO ELECTRÓNICO</small>
          <strong>avilezaymar70@gmail.com</strong>
          <span>Enviar correo <ArrowUpRight size={14} /></span>
        </a>

        <a className="contact-card" href="https://wa.me/593990069857" target="_blank" rel="noopener noreferrer">
          <small>TELÉFONO & WHATSAPP</small>
          <strong>+593 990069857</strong>
          <span>Chatear por WhatsApp <ArrowUpRight size={14} /></span>
        </a>

        <a className="contact-card" href="/CV_Aymar_Aviles.pdf" download="CV_Aymar_Aviles.pdf" target="_blank" rel="noopener noreferrer">
          <small>CURRÍCULUM VITAE</small>
          <strong>CV_Aymar_Aviles.pdf</strong>
          <span>Descargar PDF <ArrowUpRight size={14} /></span>
        </a>
      </div>

      <div className="contact-location-tag">
        <span>UBICACIÓN: ECUADOR</span>
        <span>ZONA HORARIA: UTC-5</span>
      </div>
    </div>
  )
}

export default function App() {
  const [place, setPlace] = useState<Place | null>(null)
  const [activeProjectId, setActiveProjectId] = useState(projects[0].id)
  const [helpOpen, setHelpOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [bannerMinimized, setBannerMinimized] = useState(false)
  const [collectedStars, setCollectedStars] = useState<number[]>([])
  const [starBump, setStarBump] = useState(false)

  const handleCollectStar = useCallback((id: number) => {
    setCollectedStars((prev) => {
      if (prev.includes(id)) return prev
      const next = [...prev, id]
      playStarCollectSound()
      setStarBump(true)
      window.setTimeout(() => setStarBump(false), 350)
      if (next.length === 8) {
        window.setTimeout(() => {
          playCompletionSound()
        }, 280)
      }
      return next
    })
  }, [])

  const activeProject = useMemo(() => projects.find((project) => project.id === activeProjectId) ?? projects[0], [activeProjectId])

  return (
    <main className="world-page">
      <div className="demo-ribbon">
        <span className="demo-pip" /> PORTAFOLIO INTERACTIVO 3D <span className="ribbon-divider">/</span> AYMAR AVILÉS RONQUILLO · DESARROLLADOR WEB
      </div>
      <header className="world-header">
        <a className="brand-lockup" href="#mundo" aria-label="Aymar Avilés, inicio">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>
            <b>AYMAR AVILÉS</b>
            <small>DESARROLLADOR WEB & CREATIVO</small>
          </span>
        </a>
        <nav className="world-nav" aria-label="Acceso directo a lugares">
          {(['work', 'about', 'skills', 'contact'] as Place[]).map((id) => (
            <button
              key={id}
              onClick={() => {
                setPlace(id)
                setMenuOpen(false)
              }}
              type="button"
              className={place === id ? 'active' : ''}
            >
              {placeNames[id]}
            </button>
          ))}
        </nav>
        <button
          className="mobile-menu-button"
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-expanded={menuOpen}
          aria-label="Abrir navegación"
        >
          {menuOpen ? <X size={20} /> : <List size={20} />}
        </button>
      </header>
      {menuOpen && (
        <nav className="mobile-world-nav" aria-label="Acceso directo a lugares">
          {(['work', 'about', 'skills', 'contact'] as Place[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setPlace(id)
                setMenuOpen(false)
              }}
            >
              {placeNames[id]} <ArrowUpRight size={16} />
            </button>
          ))}
        </nav>
      )}
      <section id="mundo" className={`world-scene${place ? ' is-open' : ''}`} aria-label="Mundo 3D explorable">
        <Suspense fallback={<div className="world-loading"><span className="loading-mark" /><p>PREPARANDO EL CAMINO…</p></div>}>
          <OpenWorld
            paused={Boolean(place)}
            onArrive={setPlace}
            onOpen={setPlace}
            onSelectProject={setActiveProjectId}
            collectedStars={collectedStars}
            onCollectStar={handleCollectStar}
          />
        </Suspense>

        {/* Collectible Star HUD */}
        {!place && (
          <div
            className={`star-counter${starBump ? ' is-bump' : ''}${collectedStars.length === 8 ? ' is-complete' : ''}`}
            title="Estrellas coleccionables esparcidas en la ciudad"
          >
            <Star size={16} weight={collectedStars.length > 0 ? 'fill' : 'regular'} className="star-counter-icon" />
            <span className="star-counter-count">
              <b>{collectedStars.length}</b><i>/</i>8
            </span>
            <span className="star-counter-label">
              {collectedStars.length === 8 ? '¡100% RECOGIDAS!' : 'ESTRELLAS'}
            </span>
          </div>
        )}

        {/* 100% Exploration Celebration Toast */}
        {collectedStars.length === 8 && !place && (
          <div className="celebration-toast" role="status">
            <Trophy size={18} weight="fill" className="trophy-icon" />
            <div className="celebration-copy">
              <strong>¡MAPEO COMPLETO!</strong>
              <span>8/8 estrellas recolectadas · Has explorado toda la ciudad</span>
            </div>
          </div>
        )}

        {!place && !bannerMinimized && (
          <div className="world-overlay world-overlay-top">
            <div className="welcome-banner-body">
              <div className="welcome-header-tag">
                <span className="world-kicker">AYMAR AVILÉS RONQUILLO</span>
                <span className="welcome-avail-badge">
                  <span className="status-dot" /> DISPONIBLE
                </span>
              </div>
              <h1 className="welcome-title">
                Desarrollador Web<br />
                <em>Fullstack & Creativo</em>
              </h1>
              <p className="welcome-bio">
                Especializado en crear soluciones digitales de alto impacto con <strong>React, Next.js, Node.js, Python e IA</strong>. Conduce libremente por la ciudad para descubrir mis proyectos reales, habilidades y experiencia.
              </p>
              <div className="welcome-btn-row">
                <button
                  type="button"
                  className="welcome-drive-cta"
                  onClick={() => setBannerMinimized(true)}
                  title="Comenzar a conducir por la ciudad"
                >
                  <Car size={16} /> ¡A conducir!
                </button>
                <a
                  href="/CV_Aymar_Aviles.pdf"
                  download="CV_Aymar_Aviles.pdf"
                  className="welcome-cv-cta"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Descargar Curriculum Vitae en PDF"
                >
                  <span>Descargar CV</span>
                  <ArrowUpRight size={13} />
                </a>
              </div>
            </div>
            <div className="top-overlay-actions">
              <button
                className="help-button"
                type="button"
                onClick={() => setHelpOpen(!helpOpen)}
                aria-expanded={helpOpen}
                title="Guía de controles"
              >
                <Keyboard size={15} /> ¿Cómo se juega?
              </button>
              <button
                className="minimize-banner-button"
                type="button"
                onClick={() => setBannerMinimized(true)}
                aria-label="Minimizar panel"
                title="Minimizar panel"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        )}
        {!place && bannerMinimized && (
          <button
            className="world-banner-pill"
            type="button"
            onClick={() => setBannerMinimized(false)}
            aria-label="Ver perfil de Aymar Avilés"
          >
            <span className="demo-pip" />
            <b>AYMAR AVILÉS</b>
            <span>Ver perfil</span>
          </button>
        )}
        <div className="world-location">
          <span className="location-pip" />
          <div>
            <small>UBICACIÓN ACTUAL</small>
            <strong>{place ? placeNames[place] : 'Cruce central'}</strong>
          </div>
          <span className="world-coords">N 00° / E 00°</span>
        </div>
        {!place && (
          <div className="world-overlay world-overlay-bottom">
            <div className="drive-hint">
              <Car size={16} />
              <span>MANTÉN PARA CONDUCIR</span>
              <i>W A S D</i>
              <i>↑ ↓ ← →</i>
            </div>
            <div className="map-help">
              <Compass size={16} />
              <span>SIGUE LOS HACES DE LUZ<small>CLIC DERECHO: MIRAR · RUEDA O +/−: ZOOM</small></span>
            </div>
            <button className="projects-shortcut" type="button" onClick={() => setPlace('work')}>
              Ver proyectos <ArrowDownRight size={17} />
            </button>
          </div>
        )}
        {helpOpen && !place && (
          <aside className="control-guide">
            <button type="button" onClick={() => setHelpOpen(false)} aria-label="Cerrar ayuda">
              <X size={16} />
            </button>
            <b>Controles y Mini-Juego</b>
            <p><kbd>W</kbd>/<kbd>↑</kbd> acelera progresivamente al mantener pulsado; <kbd>S</kbd>/<kbd>↓</kbd> frena o pone reversa.</p>
            <p><kbd>A</kbd>/<kbd>←</kbd> y <kbd>D</kbd>/<kbd>→</kbd> giran el volante con agarre adaptativo.</p>
            <p><b>Zoom de Cámara:</b> Rueda del ratón, pellizco táctil o botones <b>+</b> / <b>−</b>.</p>
            <p><b>Monumento Aymar Aviles:</b> Choca las letras gigantes para tumbarlas y pulsa <kbd>E</kbd> para restaurarlas.</p>
            <p><b>Mini-Juego:</b> Recorre las calles para recolectar las <b>8 estrellas doradas</b> repartidas por el circuito.</p>
            <p>Sigue los <b>haces de luz de colores</b> en el cielo para localizar los 4 destinos principales.</p>
          </aside>
        )}
        <AnimatePresence>
          {place && (
            <motion.aside
              className="place-panel"
              key="place-panel"
              initial={{ opacity: 0, x: 26 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 26 }}
              transition={{ duration: 0.28 }}
              aria-label={placeNames[place]}
            >
              <div className="panel-heading">
                <div>
                  <span>PARADA / {['work', 'about', 'skills', 'contact'].indexOf(place) + 1} DE 4</span>
                  <h2>{placeNames[place]}</h2>
                </div>
                <button type="button" onClick={() => setPlace(null)} aria-label="Cerrar parada">
                  <X size={20} />
                </button>
              </div>
              <PlaceContent place={place} activeProject={activeProject} onSelectProject={setActiveProjectId} />
              <div className="panel-footer">
                <span>AYMAR AVILÉS · PORTAFOLIO PROFESIONAL</span>
                <button type="button" onClick={() => setPlace(null)}>
                  <ArrowLeft size={15} /> VOLVER AL MUNDO
                </button>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </section>
      <footer className="world-footer">
        <span>AYMAR AVILÉS RONQUILLO · PORTAFOLIO INTERACTIVO 3D</span>
        <span>GUAYAS, ECUADOR · 2025</span>
      </footer>
    </main>
  )
}
