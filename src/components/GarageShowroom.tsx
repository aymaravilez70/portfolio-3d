import { useMemo, useState } from 'react'
import { useLoader } from '@react-three/fiber'
import {
  CanvasTexture,
  Color,
  DoubleSide,
  SRGBColorSpace,
  TextureLoader,
} from 'three'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { projects, type OrbitProject } from '../data/projects'
import type { Place } from './OpenWorld'

interface GarageShowroomProps {
  onOpen: (place: Place) => void
  onSelectProject?: (id: string) => void
}

interface PosterConfig {
  project: OrbitProject
  textureIndex: number
  position: [number, number, number]
  rotation: [number, number, number]
  width: number
  height: number
}

// Generates a crisp, pure 3D canvas texture for the plaque (100% in WebGL, zero bleed-through)
function createPlaqueCanvas(project: OrbitProject) {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 150
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // Dark studio plaque background
  ctx.fillStyle = '#16191e'
  ctx.fillRect(0, 0, 512, 150)

  // Border outline
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)'
  ctx.lineWidth = 4
  ctx.strokeRect(2, 2, 508, 146)

  // Brand color accent bar on left edge
  ctx.fillStyle = project.color
  ctx.fillRect(0, 0, 16, 150)

  // Project number badge
  ctx.fillStyle = project.color
  ctx.font = 'bold 36px monospace'
  ctx.fillText(project.number, 32, 52)

  // Project title
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 38px sans-serif'
  ctx.fillText(project.title, 105, 52)

  // Stack pills
  const tags = project.stack.slice(0, 3)
  let curX = 32
  ctx.font = 'bold 22px monospace'
  tags.forEach((tag) => {
    const textWidth = ctx.measureText(tag).width
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
    ctx.fillRect(curX, 78, textWidth + 24, 44)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
    ctx.lineWidth = 2
    ctx.strokeRect(curX, 78, textWidth + 24, 44)

    ctx.fillStyle = '#cbd5e1'
    ctx.fillText(tag, curX + 12, 108)
    curX += textWidth + 36
  })

  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

function ProjectPoster({
  project,
  texture,
  position,
  rotation,
  width = 2.0,
  height = 1.25,
  onOpenProject,
}: {
  project: OrbitProject
  texture: any
  position: [number, number, number]
  rotation: [number, number, number]
  width?: number
  height?: number
  onOpenProject: (id: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  const plaqueTexture = useMemo(() => createPlaqueCanvas(project), [project])

  return (
    <group position={position} rotation={rotation}>
      {/* 1. Acoustic wood slat backing panel */}
      <mesh position={[0, 0, -0.04]} receiveShadow>
        <boxGeometry args={[width + 0.36, height + 0.54, 0.04]} />
        <meshStandardMaterial color="#2c2118" roughness={0.75} metalness={0.05} />
      </mesh>

      {/* Vertical decorative wood slats */}
      {[-0.45, -0.3, -0.15, 0, 0.15, 0.3, 0.45].map((u, i) => (
        <mesh key={i} position={[u * width, 0, -0.015]} receiveShadow>
          <boxGeometry args={[0.04, height + 0.5, 0.02]} />
          <meshStandardMaterial color="#543c2a" roughness={0.65} metalness={0.08} />
        </mesh>
      ))}

      {/* 2. Premium dark titanium picture frame */}
      <mesh position={[0, 0.08, 0.01]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.1, height + 0.1, 0.04]} />
        <meshStandardMaterial
          color={hovered ? '#fbbf24' : '#1c2229'}
          roughness={0.25}
          metalness={0.7}
          emissive={hovered ? new Color('#d97706') : new Color('#000000')}
          emissiveIntensity={hovered ? 0.35 : 0}
        />
      </mesh>

      {/* 3. The actual project screenshot canvas */}
      <mesh
        position={[0, 0.08, 0.035]}
        onClick={(e) => {
          e.stopPropagation()
          onOpenProject(project.id)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = 'auto'
        }}
      >
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.3}
          metalness={0.05}
          side={DoubleSide}
        />
      </mesh>

      {/* 4. Overhead brass gallery lamp */}
      <group position={[0, height / 2 + 0.28, 0.18]}>
        <mesh position={[0, -0.06, -0.1]}>
          <boxGeometry args={[0.03, 0.12, 0.2]} />
          <meshStandardMaterial color="#c59b27" roughness={0.25} metalness={0.85} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.045, 0.045, 0.42, 16]} />
          <meshStandardMaterial color="#c59b27" roughness={0.25} metalness={0.85} />
        </mesh>
        <pointLight
          position={[0, -0.05, 0.08]}
          color="#fff5e0"
          intensity={1.2}
          distance={3.2}
          decay={1.8}
        />
      </group>

      {/* 5. Pure 3D Plaque Canvas (Zero bleed through exterior walls!) */}
      {plaqueTexture && (
        <mesh
          position={[0, -height / 2 - 0.10, 0.02]}
          onClick={(e) => {
            e.stopPropagation()
            onOpenProject(project.id)
          }}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHovered(true)
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            setHovered(false)
            document.body.style.cursor = 'auto'
          }}
        >
          <planeGeometry args={[width * 0.94, 0.28]} />
          <meshStandardMaterial
            map={plaqueTexture}
            roughness={0.35}
            metalness={0.1}
            side={DoubleSide}
          />
        </mesh>
      )}
    </group>
  )
}

export default function GarageShowroom({ onOpen, onSelectProject }: GarageShowroomProps) {
  const font = useLoader(FontLoader, '/helvetiker_bold.typeface.json')

  // Load textures for all 7 featured projects
  const textures = useLoader(TextureLoader, [
    '/projects/ecosort-ai.png',
    '/projects/yale.png',
    '/projects/WaspBot1.png',
    '/projects/nocion1.png',
    '/projects/melopatitas1.jpg',
    '/projects/waike-1.jpg',
    '/projects/hposhop-1.png',
  ])

  // Set proper color space for crisp vibrant colors
  useMemo(() => {
    textures.forEach((tex) => {
      tex.colorSpace = SRGBColorSpace
      tex.needsUpdate = true
    })
  }, [textures])

  // Real 3D Extruded Letters for the exterior sign: "PROYECTOS"
  const proyectosGeo = useMemo(() => {
    const geo = new TextGeometry('PROYECTOS', {
      font,
      size: 0.30,
      depth: 0.07,
      curveSegments: 5,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.01,
      bevelSegments: 2,
    })
    geo.center()
    return geo
  }, [font])

  const handleOpenProject = (id: string) => {
    onSelectProject?.(id)
    onOpen('work')
  }

  // Distribution of project posters across the 3 interior walls
  // Local origin (0, 0, 0) is at world (7.4, 0, -17.5)
  // Entrance faces West (-X, towards x = 0 road)
  // Back Wall is at East (+X = +3.72)
  // North Wall is at -Z = -3.52
  // South Wall is at +Z = +3.52
  const posters: PosterConfig[] = useMemo(() => {
    return [
      // BACK WALL (East, facing West towards car headlights): 3 prominent centerpieces
      {
        project: projects[0], // EcoSort AI
        textureIndex: 0,
        position: [3.70, 1.85, -2.15],
        rotation: [0, -Math.PI / 2, 0],
        width: 1.9,
        height: 1.25,
      },
      {
        project: projects[1], // Yale App
        textureIndex: 1,
        position: [3.70, 1.85, 0],
        rotation: [0, -Math.PI / 2, 0],
        width: 1.9,
        height: 1.25,
      },
      {
        project: projects[2], // WaspBot
        textureIndex: 2,
        position: [3.70, 1.85, 2.15],
        rotation: [0, -Math.PI / 2, 0],
        width: 1.9,
        height: 1.25,
      },

      // NORTH WALL (Left side wall, facing South): 2 projects
      {
        project: projects[3], // Nocion
        textureIndex: 3,
        position: [-0.95, 1.85, -3.50],
        rotation: [0, 0, 0],
        width: 1.9,
        height: 1.25,
      },
      {
        project: projects[4], // MeloPatitas
        textureIndex: 4,
        position: [1.65, 1.85, -3.50],
        rotation: [0, 0, 0],
        width: 1.9,
        height: 1.25,
      },

      // SOUTH WALL (Right side wall, facing North): 2 projects
      {
        project: projects[5], // Waike
        textureIndex: 5,
        position: [-0.95, 1.85, 3.50],
        rotation: [0, Math.PI, 0],
        width: 1.9,
        height: 1.25,
      },
      {
        project: projects[6], // HPO SHOP
        textureIndex: 6,
        position: [1.65, 1.85, 3.50],
        rotation: [0, Math.PI, 0],
        width: 1.9,
        height: 1.25,
      },
    ]
  }, [])

  return (
    <group>
      {/* ============================================================== */}
      {/* 1. SEAMLESS ASPHALT & CONCRETE DRIVEWAY LEADING FROM ROAD      */}
      {/* ============================================================== */}
      {/* Driveway apron connecting street (local x: -7.4) into garage (x: -3.8) */}
      <mesh position={[-4.7, 0.02, 0]} receiveShadow>
        <boxGeometry args={[4.4, 0.03, 4.8]} />
        <meshStandardMaterial color="#2d3238" roughness={0.88} metalness={0.08} />
      </mesh>

      {/* Driveway transition ramp at curb edge */}
      <mesh position={[-6.95, 0.015, 0]} receiveShadow>
        <boxGeometry args={[0.7, 0.02, 5.2]} />
        <meshStandardMaterial color="#3f454d" roughness={0.82} metalness={0.05} />
      </mesh>

      {/* Embedded LED runway marker pucks along the driveway */}
      {[-2.0, -1.0, 0, 1.0, 2.0].map((_, i) => (
        <group key={i}>
          <mesh position={[-4.8 + (i % 2) * 1.6, 0.04, -2.35]}>
            <cylinderGeometry args={[0.07, 0.07, 0.02, 12]} />
            <meshStandardMaterial color="#38bdf8" emissive={new Color('#0284c7')} emissiveIntensity={0.8} />
          </mesh>
          <mesh position={[-4.8 + (i % 2) * 1.6, 0.04, 2.35]}>
            <cylinderGeometry args={[0.07, 0.07, 0.02, 12]} />
            <meshStandardMaterial color="#38bdf8" emissive={new Color('#0284c7')} emissiveIntensity={0.8} />
          </mesh>
        </group>
      ))}

      {/* ============================================================== */}
      {/* 2. SUBURBAN HOUSE ARCHITECTURE (WARM BEIGE STUCCO & STONE)     */}
      {/* ============================================================== */}
      {/* Solid Back Wall (East, exterior beige / interior warm studio) */}
      <mesh position={[3.85, 1.8, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.3, 3.6, 7.4]} />
        <meshStandardMaterial color="#ded4c5" roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Foundation plinth on Back Wall */}
      <mesh position={[3.92, 0.18, 0]} receiveShadow>
        <boxGeometry args={[0.18, 0.36, 7.5]} />
        <meshStandardMaterial color="#7a766e" roughness={0.9} />
      </mesh>

      {/* Solid North Wall (Left side) */}
      <mesh position={[0, 1.8, -3.65]} castShadow receiveShadow>
        <boxGeometry args={[7.8, 3.6, 0.3]} />
        <meshStandardMaterial color="#ded4c5" roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Foundation plinth on North Wall */}
      <mesh position={[0, 0.18, -3.72]} receiveShadow>
        <boxGeometry args={[7.9, 0.36, 0.18]} />
        <meshStandardMaterial color="#7a766e" roughness={0.9} />
      </mesh>

      {/* Solid South Wall (Right side) */}
      <mesh position={[0, 1.8, 3.65]} castShadow receiveShadow>
        <boxGeometry args={[7.8, 3.6, 0.3]} />
        <meshStandardMaterial color="#ded4c5" roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Foundation plinth on South Wall */}
      <mesh position={[0, 0.18, 3.72]} receiveShadow>
        <boxGeometry args={[7.9, 0.36, 0.18]} />
        <meshStandardMaterial color="#7a766e" roughness={0.9} />
      </mesh>

      {/* West Front Façade (Wall around the open garage entrance): */}
      {/* Left Wall Section */}
      <mesh position={[-3.85, 1.8, -2.85]} castShadow receiveShadow>
        <boxGeometry args={[0.35, 3.6, 1.4]} />
        <meshStandardMaterial color="#ded4c5" roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Right Wall Section */}
      <mesh position={[-3.85, 1.8, 2.85]} castShadow receiveShadow>
        <boxGeometry args={[0.35, 3.6, 1.4]} />
        <meshStandardMaterial color="#ded4c5" roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Upper Lintel Header */}
      <mesh position={[-3.85, 3.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.35, 0.7, 7.4]} />
        <meshStandardMaterial color="#ded4c5" roughness={0.85} metalness={0.05} />
      </mesh>

      {/* White Architectural Portal Trim around the garage entrance */}
      <mesh position={[-3.95, 1.5, -2.15]} castShadow receiveShadow>
        <boxGeometry args={[0.12, 3.0, 0.16]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.5} />
      </mesh>
      <mesh position={[-3.95, 1.5, 2.15]} castShadow receiveShadow>
        <boxGeometry args={[0.12, 3.0, 0.16]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.5} />
      </mesh>
      <mesh position={[-3.95, 2.95, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.12, 0.16, 4.4]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.5} />
      </mesh>

      {/* Corner White Pilasters on the 4 corners of the house */}
      {[-3.88, 3.88].map((xP, i) =>
        [-3.68, 3.68].map((zP, j) => (
          <mesh key={`col-${i}-${j}`} position={[xP, 1.8, zP]} castShadow receiveShadow>
            <boxGeometry args={[0.22, 3.64, 0.22]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.5} />
          </mesh>
        ))
      )}

      {/* Suburban Roof Slab & Fascia (Warm dark slate/cedar matching other houses) */}
      <mesh position={[0, 3.68, 0]} castShadow receiveShadow>
        <boxGeometry args={[8.4, 0.22, 8.0]} />
        <meshStandardMaterial color="#4e4840" roughness={0.7} metalness={0.15} />
      </mesh>
      {/* Decorative upper roof hip tier */}
      <mesh position={[0, 3.90, 0]} castShadow receiveShadow>
        <boxGeometry args={[7.4, 0.22, 7.0]} />
        <meshStandardMaterial color="#443e37" roughness={0.72} metalness={0.15} />
      </mesh>

      {/* ============================================================== */}
      {/* 3. EXTERIOR SIGN: "PROYECTOS"                                  */}
      {/* ============================================================== */}
      {/* Wooden / Cream Signboard above the garage portal */}
      <mesh position={[-3.98, 3.25, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[3.4, 0.58, 0.05]} />
        <meshStandardMaterial color="#f5f0e6" roughness={0.65} metalness={0.1} />
      </mesh>
      {/* Wooden border frame around the sign */}
      <mesh position={[-3.98, 3.25, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <boxGeometry args={[3.46, 0.64, 0.03]} />
        <meshStandardMaterial color="#6b4f3b" roughness={0.7} />
      </mesh>

      {/* Real 3D Extruded Letters "PROYECTOS" */}
      <mesh
        geometry={proyectosGeo}
        position={[-4.02, 3.25, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color="#1c1917"
          roughness={0.3}
          metalness={0.4}
        />
      </mesh>

      {/* Brass Gooseneck Downlights illuminating the PROYECTOS sign */}
      {[-0.9, 0.9].map((zLamp, idx) => (
        <group key={idx} position={[-4.04, 3.52, zLamp]}>
          <mesh rotation={[0, 0, Math.PI / 4]}>
            <cylinderGeometry args={[0.015, 0.015, 0.16, 8]} />
            <meshStandardMaterial color="#c59b27" roughness={0.3} metalness={0.8} />
          </mesh>
          <mesh position={[-0.06, -0.05, 0]}>
            <sphereGeometry args={[0.045, 12, 12]} />
            <meshStandardMaterial color="#c59b27" roughness={0.3} metalness={0.8} />
          </mesh>
          <pointLight position={[-0.06, -0.08, 0]} color="#fff8e7" intensity={0.8} distance={2.5} decay={2} />
        </group>
      ))}

      {/* ============================================================== */}
      {/* 4. INTERIOR WORKSHOP / SHOWROOM (Only seen through the door!)  */}
      {/* ============================================================== */}
      {/* Polished concrete floor */}
      <mesh position={[0, 0.025, 0]} receiveShadow>
        <boxGeometry args={[7.6, 0.04, 7.2]} />
        <meshStandardMaterial color="#2c3036" roughness={0.38} metalness={0.15} />
      </mesh>

      {/* Yellow parking bay lines */}
      <mesh position={[0.4, 0.048, -1.5]} receiveShadow>
        <boxGeometry args={[4.6, 0.002, 0.12]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.4} emissive={new Color('#f59e0b')} emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0.4, 0.048, 1.5]} receiveShadow>
        <boxGeometry args={[4.6, 0.002, 0.12]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.4} emissive={new Color('#f59e0b')} emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[2.65, 0.048, 0]} receiveShadow>
        <boxGeometry args={[0.12, 0.002, 3.12]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.4} emissive={new Color('#f59e0b')} emissiveIntensity={0.2} />
      </mesh>

      {/* Interior ceiling I-beams */}
      {[-1.8, 0, 1.8].map((xBeam, i) => (
        <group key={i} position={[xBeam, 3.48, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.12, 0.22, 7.1]} />
            <meshStandardMaterial color="#1f2327" roughness={0.45} metalness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Warm Interior Lighting */}
      <pointLight position={[0.5, 3.1, 0]} color="#fff8ed" intensity={1.8} distance={9.0} decay={1.7} />
      <pointLight position={[2.8, 3.0, 0]} color="#fed7aa" intensity={1.4} distance={7.5} decay={1.8} />

      {/* ============================================================== */}
      {/* 5. THE 7 INTERACTIVE 3D PROJECT POSTERS (Pure WebGL)           */}
      {/* ============================================================== */}
      {posters.map((cfg) => (
        <ProjectPoster
          key={cfg.project.id}
          project={cfg.project}
          texture={textures[cfg.textureIndex]}
          position={cfg.position}
          rotation={cfg.rotation}
          width={cfg.width}
          height={cfg.height}
          onOpenProject={handleOpenProject}
        />
      ))}
    </group>
  )
}
