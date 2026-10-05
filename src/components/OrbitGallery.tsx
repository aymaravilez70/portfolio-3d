import { useEffect, useMemo, useRef } from 'react'
import type { CSSProperties } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, Line, OrbitControls } from '@react-three/drei'
import { Vector3 } from 'three'
import type { Group } from 'three'
import type { OrbitProject } from '../data/projects'

type OrbitGalleryProps = { projects: OrbitProject[]; activeId: string; onSelect: (id: string) => void; reducedMotion: boolean }
type SystemProps = Omit<OrbitGalleryProps, 'reducedMotion'>

function AdaptiveCamera() {
  const camera = useThree((state) => state.camera)
  const width = useThree((state) => state.size.width)

  useEffect(() => {
    camera.position.set(0, 2.2, width < 520 ? 6.3 : 4.8)
    camera.lookAt(0, 0, 0)
  }, [camera, width])

  return null
}

function nodePosition(index: number, count: number, radius: number) {
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2
  return new Vector3(Math.cos(angle) * radius, Math.sin(angle * 2) * 0.2, Math.sin(angle) * radius)
}

function ProjectNode({ project, index, count, active, onSelect }: { project: OrbitProject; index: number; count: number; active: boolean; onSelect: () => void }) {
  const group = useRef<Group>(null)
  const position = useMemo(() => nodePosition(index, count, 1.42 + (index % 2) * 0.24), [index, count])

  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.y = Math.sin(clock.elapsedTime * 0.65 + index) * 0.16
  })

  return (
    <group ref={group} position={position}>
      <mesh onClick={(event) => { event.stopPropagation(); onSelect() }} onPointerOver={(event) => { event.stopPropagation(); document.body.style.cursor = 'pointer' }} onPointerOut={() => { document.body.style.cursor = 'auto' }} scale={active ? 0.18 : 0.105}>
        {index % 2 === 0 ? <icosahedronGeometry args={[1, 0]} /> : <octahedronGeometry args={[1, 0]} />}
        <meshBasicMaterial color={project.color} wireframe={!active} />
      </mesh>
      <mesh scale={active ? 0.23 : 0.145}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshBasicMaterial color={project.color} wireframe transparent opacity={active ? 0.5 : 0.16} />
      </mesh>
      <Html center distanceFactor={7} zIndexRange={[10, 0]}>
        <button className={`orbit-node-label${active ? ' is-active' : ''}`} type="button" onClick={(event) => { event.stopPropagation(); onSelect() }} aria-label={`Abrir ${project.title}`} aria-pressed={active}>
          <span>{project.number}</span><b>{project.title}</b>
        </button>
      </Html>
    </group>
  )
}

function OrbitalSystem({ projects, activeId, onSelect }: SystemProps) {
  const root = useRef<Group>(null)
  useFrame((_, delta) => { if (root.current) root.current.rotation.y += delta * 0.018 })
  const railPoints = useMemo(() => Array.from({ length: 97 }, (_, index) => {
    const angle = (index / 96) * Math.PI * 2
    return new Vector3(Math.cos(angle) * 1.75, Math.sin(angle) * 0.26, Math.sin(angle) * 1.15)
  }), [])
  const axisPoints = useMemo(() => [new Vector3(-2.05, 0, 0), new Vector3(2.05, 0, 0)], [])
  const crossAxisPoints = useMemo(() => [new Vector3(0, 0, -1.52), new Vector3(0, 0, 1.52)], [])

  return (
    <group ref={root}>
      <Line points={railPoints} color="#4a5050" lineWidth={0.7} />
      <Line points={axisPoints} color="#343a3a" lineWidth={0.6} />
      <Line points={crossAxisPoints} color="#343a3a" lineWidth={0.6} />
      <mesh><icosahedronGeometry args={[0.53, 1]} /><meshBasicMaterial color="#171a18" wireframe /></mesh>
      <mesh rotation={[0.4, 0.25, 0.15]}><octahedronGeometry args={[0.3, 0]} /><meshBasicMaterial color="#d9ff56" wireframe /></mesh>
      {projects.map((project, index) => <ProjectNode key={project.id} project={project} index={index} count={projects.length} active={project.id === activeId} onSelect={() => onSelect(project.id)} />)}
    </group>
  )
}

function OrbitFallback({ projects, activeId, onSelect }: SystemProps) {
  return (
    <div className="orbit-fallback" role="group" aria-label="Mapa orbital estático de proyectos">
      <span className="fallback-ring fallback-ring-outer" /><span className="fallback-ring fallback-ring-inner" /><span className="fallback-core" aria-hidden="true" />
      {projects.map((project, index) => <button key={project.id} type="button" className={`fallback-node fallback-node-${index}${project.id === activeId ? ' is-active' : ''}`} style={{ '--node-color': project.color } as CSSProperties} onClick={() => onSelect(project.id)} aria-label={`Abrir ${project.title}`} aria-pressed={project.id === activeId}><span>{project.number}</span></button>)}
    </div>
  )
}

export default function OrbitGallery(props: OrbitGalleryProps) {
  if (props.reducedMotion) return <OrbitFallback {...props} />
  return (
    <div className="orbit-canvas-wrap">
      <Canvas camera={{ position: [0, 2.2, 4.8], fov: 37 }} dpr={[1, 1.4]} gl={{ antialias: true, alpha: false, powerPreference: 'low-power' }} fallback={<OrbitFallback {...props} />}>
        <color attach="background" args={['#101311']} />
        <ambientLight intensity={1.3} />
        <AdaptiveCamera />
        <OrbitalSystem {...props} />
        <OrbitControls enableDamping dampingFactor={0.08} enablePan={false} enableZoom={false} minPolarAngle={0.85} maxPolarAngle={2.15} rotateSpeed={0.42} />
      </Canvas>
    </div>
  )
}
