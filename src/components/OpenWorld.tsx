import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { Cloud, Clouds, Float, Html, Sky, Sparkles, useFBX, useGLTF, useProgress } from '@react-three/drei'
import { ACESFilmicToneMapping, AdditiveBlending, Box3, BufferGeometry, CanvasTexture, Color, DoubleSide, FrontSide, Group, InstancedMesh, Material, Matrix4, Mesh, MeshLambertMaterial, MeshStandardMaterial, Object3D, RepeatWrapping, SRGBColorSpace, TextureLoader, Vector3 } from 'three'
import { playBumpSound } from '../utils/audio'
import DestructibleName, { type CarPhysicsState } from './DestructibleName'
import DestructibleTrafficProps from './DestructibleTrafficProps'
import GarageShowroom from './GarageShowroom'

function createGrassTexture() {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // Base grass hue: rich healthy lawn
  ctx.fillStyle = '#4c7a33'
  ctx.fillRect(0, 0, 512, 512)

  // Organic micro-variation blades
  for (let i = 0; i < 22000; i++) {
    const x = Math.random() * 512
    const y = Math.random() * 512
    const r = 0.8 + Math.random() * 1.8
    const rand = Math.random()
    if (rand > 0.6) {
      ctx.fillStyle = '#5e9441'
    } else if (rand > 0.28) {
      ctx.fillStyle = '#3f672a'
    } else {
      ctx.fillStyle = '#6ca94c'
    }
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Soft alternating lawn striping
  ctx.fillStyle = 'rgba(255, 255, 255, 0.035)'
  for (let y = 0; y < 512; y += 64) {
    ctx.fillRect(0, y, 512, 32)
  }

  const texture = new CanvasTexture(canvas)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(16, 16)
  return texture
}

function createCarShadowTexture() {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // Radial gradient: dense dark center under chassis fading smoothly outward
  const grad = ctx.createRadialGradient(128, 128, 20, 128, 128, 118)
  grad.addColorStop(0, 'rgba(8, 12, 6, 0.78)')
  grad.addColorStop(0.5, 'rgba(8, 12, 6, 0.45)')
  grad.addColorStop(0.85, 'rgba(8, 12, 6, 0.12)')
  grad.addColorStop(1, 'rgba(8, 12, 6, 0)')

  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.ellipse(128, 128, 105, 120, 0, 0, Math.PI * 2)
  ctx.fill()

  return new CanvasTexture(canvas)
}

export type Place = 'work' | 'about' | 'skills' | 'contact'
export type OpenWorldProps = {
  onArrive: (place: Place | null) => void
  onOpen: (place: Place) => void
  paused: boolean
  collectedStars?: number[]
  onCollectStar?: (id: number) => void
  onSelectProject?: (id: string) => void
}

type DigitalControl = 'forward' | 'back' | 'left' | 'right'
type Controls = { forward: boolean; back: boolean; left: boolean; right: boolean; throttle?: number; steering?: number }
export const MIN_CAMERA_RADIUS = 8.2
export const MAX_CAMERA_RADIUS = 21.5
export const DEFAULT_CAMERA_RADIUS = 8.2

type CameraOrbitState = {
  yaw: number
  elevation: number
  radius: number
  targetRadius: number
  isManual?: boolean
  lastManualTime?: number
}

export const destinations: { id: Place; title: string; number: string; position: [number, number, number]; color: string; size: number }[] = [
  { id: 'work', title: 'GARAGE / PROYECTOS', number: '01', position: [7.4, 0, -17.5], color: '#d9ff56', size: 2.8 },
  { id: 'about', title: 'ESTUDIO / PERFIL', number: '02', position: [-17.5, 0, -7.4], color: '#eda774', size: 2.25 },
  { id: 'skills', title: 'TORRE / SKILLS', number: '03', position: [17.5, 0, -7.4], color: '#93afdf', size: 2.25 },
  { id: 'contact', title: 'POSTAL / CONTACTO', number: '04', position: [-7.4, 0, 17.5], color: '#cfadcf', size: 2.5 },
]

export const STAR_COORDINATES = [
  { id: 1, pos: [0, 0.72, 0] as [number, number, number], name: 'Cruce Central' },
  { id: 2, pos: [0, 0.72, -7.5] as [number, number, number], name: 'Avenida Norte' },
  { id: 3, pos: [4.4, 0.72, -15.4] as [number, number, number], name: 'Entrada Garaje' },
  { id: 4, pos: [7.5, 0.72, 0] as [number, number, number], name: 'Avenida Este' },
  { id: 5, pos: [15.4, 0.72, -4.4] as [number, number, number], name: 'Plaza de la Torre' },
  { id: 6, pos: [0, 0.72, 7.5] as [number, number, number], name: 'Avenida Sur' },
  { id: 7, pos: [-4.4, 0.72, 15.4] as [number, number, number], name: 'Paso Postal' },
  { id: 8, pos: [-7.5, 0.72, 0] as [number, number, number], name: 'Avenida Oeste' },
]

export const NEIGHBORHOOD_HOMES: {
  position: [number, number, number]
  type: string
  halfWidth: number
  halfDepth: number
}[] = [
  // index 0: building-type-a, rotation 0
  { position: [-4.4, 0, -5.2], type: 'building-type-a', halfWidth: 0.75, halfDepth: 0.60 },
  // index 1: building-type-d, rotation 90 deg (swapped width/depth)
  { position: [4.4, 0, -5.2], type: 'building-type-d', halfWidth: 0.60, halfDepth: 1.02 },
  // index 2: building-type-m, rotation 0
  { position: [-4.4, 0, 5.2], type: 'building-type-m', halfWidth: 0.82, halfDepth: 0.82 },
  // index 3: building-type-j, rotation 0
  { position: [-18, 0, -18], type: 'building-type-j', halfWidth: 0.85, halfDepth: 0.70 },
  // index 4: building-type-h, rotation 90 deg
  { position: [18, 0, 18], type: 'building-type-h', halfWidth: 0.70, halfDepth: 0.95 },
]

export const TREE_DATA = Array.from({ length: 48 }, (_, i) => {
  const x = Math.sin(i * 91.73) * 20
  const z = Math.cos(i * 43.29) * 20
  const nearRoad = Math.abs(x) < 4.6 || Math.abs(z) < 4.6
  const nearPlace = destinations.some((p) => Math.hypot(x - p.position[0], z - p.position[2]) < 5.4)
  return {
    x,
    z,
    scale: 1.6 + ((i * 7) % 6) * 0.15,
    visible: !nearRoad && !nearPlace,
    variant: i % 3 === 0 ? 'city-suburban/tree-large' : 'city-suburban/tree-small',
  }
}).filter((tree) => tree.visible)

type CircleCollider = { type: 'circle'; x: number; z: number; radius: number }
type BoxCollider = { type: 'box'; x: number; z: number; halfWidth: number; halfDepth: number }
export type WorldCollider = CircleCollider | BoxCollider

// Master list of all solid obstacles with exact physical dimensions
export const WORLD_COLLIDERS: WorldCollider[] = [
  // 1. Garage Showroom (Open bay with physical walls allowing car to enter)
  { type: 'box', x: 11.25, z: -17.5, halfWidth: 0.35, halfDepth: 3.7 },  // East Back Wall
  { type: 'box', x: 7.4, z: -21.15, halfWidth: 3.9, halfDepth: 0.35 },   // North Left Wall
  { type: 'box', x: 7.4, z: -13.85, halfWidth: 3.9, halfDepth: 0.35 },   // South Right Wall
  { type: 'box', x: 3.55, z: -20.35, halfWidth: 0.35, halfDepth: 0.75 }, // West Portal Left Pillar
  { type: 'box', x: 3.55, z: -14.65, halfWidth: 0.35, halfDepth: 0.75 }, // West Portal Right Pillar
  { type: 'box', x: -17.5, z: -7.4, halfWidth: 1.85, halfDepth: 1.50 },  // Studio (about)
  { type: 'box', x: 17.5, z: -7.4, halfWidth: 1.29, halfDepth: 1.43 },   // Torre (skills)
  { type: 'box', x: -7.4, z: 17.5, halfWidth: 1.45, halfDepth: 2.32 },   // Postal (contact)

  // 2. Neighborhood Houses (exact physical boundaries, matching the visible walls)
  ...NEIGHBORHOOD_HOMES.map((home) => ({
    type: 'box' as const,
    x: home.position[0],
    z: home.position[2],
    halfWidth: home.halfWidth,
    halfDepth: home.halfDepth,
  })),

  // 3. All 3D Trees in the World (collides with physical trunk radius: ~0.28m)
  ...TREE_DATA.map((tree) => ({
    type: 'circle' as const,
    x: tree.x,
    z: tree.z,
    radius: 0.28,
  })),

  // 4. Planters with flowers
  { type: 'circle', x: -3.6, z: -3.2, radius: 0.38 },
  { type: 'circle', x: 3.6, z: -3.2, radius: 0.38 },
  { type: 'circle', x: -3.6, z: 3.2, radius: 0.38 },
  { type: 'circle', x: 5.4, z: -13.2, radius: 0.38 },
  { type: 'circle', x: 9.4, z: -13.2, radius: 0.38 },
  { type: 'circle', x: -15.2, z: -5.4, radius: 0.38 },
  { type: 'circle', x: -15.2, z: -9.4, radius: 0.38 },
  { type: 'circle', x: 15.2, z: -5.4, radius: 0.38 },
  { type: 'circle', x: 15.2, z: -9.4, radius: 0.38 },
  { type: 'circle', x: -5.4, z: 15.2, radius: 0.38 },
  { type: 'circle', x: -9.4, z: 15.2, radius: 0.38 },
]

const CAR_RADIUS = 0.45
const WORLD_BOUNDARY = 23.55

export function resolveCarCollisions(
  targetX: number,
  targetZ: number,
  colliders: WorldCollider[] = WORLD_COLLIDERS
): { x: number; z: number; collided: boolean; normalX: number; normalZ: number } {
  let curX = targetX
  let curZ = targetZ
  let collided = false
  let totalNx = 0
  let totalNz = 0

  // 2 passes for multi-collider intersection (e.g. corner collisions)
  for (let pass = 0; pass < 2; pass++) {
    for (const c of colliders) {
      if (c.type === 'circle') {
        const dx = curX - c.x
        const dz = curZ - c.z
        const minDist = c.radius + CAR_RADIUS
        const distSq = dx * dx + dz * dz

        if (distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq) || 0.0001
          const overlap = minDist - dist
          const nx = dx / dist
          const nz = dz / dist
          curX += nx * overlap
          curZ += nz * overlap
          totalNx += nx
          totalNz += nz
          collided = true
        }
      } else if (c.type === 'box') {
        const clampedX = Math.max(c.x - c.halfWidth, Math.min(c.x + c.halfWidth, curX))
        const clampedZ = Math.max(c.z - c.halfDepth, Math.min(c.z + c.halfDepth, curZ))
        const dx = curX - clampedX
        const dz = curZ - clampedZ
        const distSq = dx * dx + dz * dz

        if (distSq < CAR_RADIUS * CAR_RADIUS) {
          if (distSq > 0.00001) {
            const dist = Math.sqrt(distSq)
            const overlap = CAR_RADIUS - dist
            const nx = dx / dist
            const nz = dz / dist
            curX += nx * overlap
            curZ += nz * overlap
            totalNx += nx
            totalNz += nz
          } else {
            // Car center is inside the box: push out along minimal penetration axis
            const penX = c.halfWidth + CAR_RADIUS - Math.abs(curX - c.x)
            const penZ = c.halfDepth + CAR_RADIUS - Math.abs(curZ - c.z)
            if (penX < penZ) {
              const nx = Math.sign(curX - c.x) || 1
              curX += nx * penX
              totalNx += nx
            } else {
              const nz = Math.sign(curZ - c.z) || 1
              curZ += nz * penZ
              totalNz += nz
            }
          }
          collided = true
        }
      }
    }
  }

  // World bounds clamp
  if (curX < -WORLD_BOUNDARY) {
    curX = -WORLD_BOUNDARY
    collided = true
    totalNx += 1
  } else if (curX > WORLD_BOUNDARY) {
    curX = WORLD_BOUNDARY
    collided = true
    totalNx -= 1
  }

  if (curZ < -WORLD_BOUNDARY) {
    curZ = -WORLD_BOUNDARY
    collided = true
    totalNz += 1
  } else if (curZ > WORLD_BOUNDARY) {
    curZ = WORLD_BOUNDARY
    collided = true
    totalNz -= 1
  }

  const nLen = Math.hypot(totalNx, totalNz) || 1
  return {
    x: curX,
    z: curZ,
    collided,
    normalX: totalNx / nLen,
    normalZ: totalNz / nLen,
  }
}

function Asset({
  name,
  position,
  rotation = [0, 0, 0],
  scale = 1,
}: {
  name: string
  position: [number, number, number]
  rotation?: [number, number, number]
  scale?: number | [number, number, number]
}) {
  const { scene } = useGLTF(`/models/${name}.glb`)
  const model = useMemo(() => {
    const instance = scene.clone(true)
    instance.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true
        object.receiveShadow = true
        if (object.material) {
          const mats = Array.isArray(object.material) ? object.material : [object.material]
          mats.forEach((m) => {
            if ('roughness' in m) {
              m.roughness = Math.min(0.78, Math.max(0.35, (m.roughness ?? 0.7) * 0.9))
            }
          })
        }
      }
    })
    return instance
  }, [scene])
  return <primitive object={model} position={position} rotation={rotation} scale={scale} dispose={null} />
}

function DestinationBeacon({ position, color }: { position: [number, number, number]; color: string }) {
  const ringRef = useRef<Mesh>(null)

  useFrame(({ clock }) => {
    if (ringRef.current) {
      const s = 1 + Math.sin(clock.getElapsedTime() * 2.6) * 0.08
      ringRef.current.scale.set(s, s, 1)
    }
  })

  return (
    <group position={position}>
      {/* Outer translucent beam */}
      <mesh position={[0, 11, 0]}>
        <cylinderGeometry args={[0.26, 0.52, 22, 16, 1, true]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.24}
          side={DoubleSide}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Inner glowing bright beam */}
      <mesh position={[0, 11, 0]}>
        <cylinderGeometry args={[0.07, 0.14, 22, 8, 1, true]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.52}
          side={DoubleSide}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Pulsing ground glow ring */}
      <mesh ref={ringRef} position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.7, 3.25, 36]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.55}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Sparkling energetic motes */}
      <Sparkles
        count={22}
        scale={[4.2, 9, 4.2]}
        position={[0, 4.6, 0]}
        color={color}
        size={3.2}
        speed={0.4}
        opacity={0.85}
      />
    </group>
  )
}

function StarCollectible({ pos }: { pos: [number, number, number] }) {
  const starGroup = useRef<Group>(null)

  useFrame((_, delta) => {
    if (starGroup.current) {
      starGroup.current.rotation.y += delta * 2.2
    }
  })

  return (
    <group position={pos}>
      <Float speed={2.8} rotationIntensity={0.8} floatIntensity={0.45} floatingRange={[-0.08, 0.08]}>
        <group ref={starGroup}>
          <Asset name="props/star" position={[0, 0, 0]} scale={0.72} />
        </group>
        <Sparkles count={5} scale={1.2} size={2.8} color="#ffe259" opacity={0.9} />
      </Float>
    </group>
  )
}

function Collectibles({ collectedStars }: { collectedStars: number[] }) {
  return (
    <group>
      {STAR_COORDINATES.map((star) => {
        if (collectedStars.includes(star.id)) return null
        return <StarCollectible key={star.id} pos={star.pos} />
      })}
    </group>
  )
}

function Car({
  onArrive,
  controlState,
  cameraOrbit,
  paused,
  collectedStars = [],
  onCollectStar,
  carPhysicsState,
}: {
  onArrive: (place: Place | null) => void
  controlState: RefObject<Controls>
  cameraOrbit: RefObject<CameraOrbitState>
  paused: boolean
  collectedStars?: number[]
  onCollectStar?: (id: number) => void
  carPhysicsState?: RefObject<CarPhysicsState>
}) {
  const car = useRef<Group>(null)
  const velocity = useRef(0)
  const rotation = useRef(0)
  const nearestId = useRef<Place | null>(null)
  const activatedId = useRef<Place | null>(null)
  const { camera } = useThree()

  const carShadowTexture = useMemo(() => createCarShadowTexture(), [])
  const taillightMatsRef = useRef<any[]>([])
  const rearBrakeLightRef = useRef<any>(null)

  // Load and memoize cloned new car model instance with articulated wheel pivots
  const { scene: rawCarScene } = useGLTF('/models/car-kit/car-new.glb')
  const { carModel, wheelGroups } = useMemo(() => {
    const instance = rawCarScene.clone(true)
    const taillights: any[] = []

    instance.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true
        object.receiveShadow = true
        if (object.material) {
          const mats = Array.isArray(object.material) ? object.material : [object.material]
          mats.forEach((m) => {
            m.side = DoubleSide
            m.depthWrite = true
            const name = m.name || ''
            const lower = name.toLowerCase()

            if (name === 'Rubber_Plastic' || lower.includes('rubber') || lower.includes('tire')) {
              // Deep vulcanized black rubber for tires
              if ('color' in m) m.color = new Color('#161816')
              if ('roughness' in m) m.roughness = 0.86
              if ('metalness' in m) m.metalness = 0.04
            } else if (name === 'Plastic_Silver' || lower.includes('rim') || lower.includes('alloy')) {
              // Liquid alloy chrome for wheel rims
              if ('color' in m) m.color = new Color('#d8dde2')
              if ('roughness' in m) m.roughness = 0.16
              if ('metalness' in m) m.metalness = 0.88
            } else if (name === 'M_0131_Silver' || name === 'Metal_Corrogated_Shiny' || lower.includes('chrome') || lower.includes('exhaust')) {
              // Polished mirror chrome for exhausts, badges and grills
              if ('color' in m) m.color = new Color('#f2f4f7')
              if ('roughness' in m) m.roughness = 0.08
              if ('metalness' in m) m.metalness = 0.96
            } else if (name === 'Light_White_Reflective' || lower.includes('headlight')) {
              // Realistic automotive glass and chrome reflector lenses (no projected light)
              if ('color' in m) m.color = new Color('#edf2f7')
              if ('emissive' in m) {
                m.emissive = new Color('#000000')
                m.emissiveIntensity = 0.0
              }
              if ('roughness' in m) m.roughness = 0.08
              if ('metalness' in m) m.metalness = 0.75
            } else if (name === 'M_0020_Red' || lower.includes('taillight')) {
              // Taillights: dark deep burgundy at rest, blazing red ONLY when braking
              if ('color' in m) m.color = new Color('#4a0a0a')
              if ('emissive' in m) {
                m.emissive = new Color('#ff1616')
                m.emissiveIntensity = 0.0
              }
              if ('roughness' in m) m.roughness = 0.22
              if ('metalness' in m) m.metalness = 0.1
              taillights.push(m)
            } else if (name === 'Translucent_Glass_Blue' || lower.includes('glass') || lower.includes('window')) {
              // High-spec crystal automotive glass
              m.transparent = true
              m.opacity = 0.52
              if ('color' in m) m.color = new Color('#2d4457')
              if ('roughness' in m) m.roughness = 0.04
              if ('metalness' in m) m.metalness = 0.22
            } else if (name === 'grill') {
              if ('roughness' in m) m.roughness = 0.35
              if ('metalness' in m) m.metalness = 0.65
            } else {
              // High-gloss metallic automotive body paint
              m.transparent = false
              m.opacity = 1.0
              if ('roughness' in m && 'metalness' in m) {
                m.metalness = 0.52
                m.roughness = 0.16
              }
            }
          })
        }
      }
    })
    taillightMatsRef.current = taillights

    const getGroupCenter = (names: string[]) => {
      const box = new Box3()
      names.forEach((name) => {
        const obj = instance.getObjectByName(name)
        if (obj) box.expandByObject(obj)
      })
      const center = new Vector3()
      box.getCenter(center)
      return center
    }

    // 14.97° (0.26127 rad) pre-steer baked into the asset by the 3D modeler
    const PRE_STEER_ANGLE = 0.26127

    const setupWheel = (names: string[], isFront: boolean) => {
      const center = getGroupCenter(names)
      const steerGroup = new Group()
      steerGroup.position.copy(center)

      const rollGroup = new Group()
      steerGroup.add(rollGroup)

      let parentForOffset: Group = rollGroup
      if (isFront) {
        // Neutralize the baked-in 15° pose so the wheel's rotation axle is 100% true to Z
        // (eliminating elliptical wobbling / 'bailoteo' when rolling)
        const unrotateGroup = new Group()
        unrotateGroup.rotation.y = PRE_STEER_ANGLE
        rollGroup.add(unrotateGroup)
        parentForOffset = unrotateGroup
      }

      const offsetGroup = new Group()
      offsetGroup.position.set(-center.x, -center.y, -center.z)
      parentForOffset.add(offsetGroup)

      names.forEach((name) => {
        const obj = instance.getObjectByName(name)
        if (obj) offsetGroup.add(obj)
      })

      instance.add(steerGroup)
      return { steerGroup, rollGroup }
    }

    const fl = setupWheel(['Mesh75_Group1_Model', 'Mesh76_Group1_Model'], true)
    const fr = setupWheel(['Mesh77_Group1_Model', 'Mesh60_Group1_Model'], true)
    const rl = setupWheel(['Mesh71_Group1_Model', 'Mesh72_Group1_Model'], false)
    const rr = setupWheel(['Mesh73_Group1_Model', 'Mesh74_Group1_Model'], false)

    return {
      carModel: instance,
      wheelGroups: {
        flSteer: fl.steerGroup,
        frSteer: fr.steerGroup,
        flRoll: fl.rollGroup,
        frRoll: fr.rollGroup,
        rlRoll: rl.rollGroup,
        rrRoll: rr.rollGroup,
      },
    }
  }, [rawCarScene])

  // Direct 3D node references for animated components
  const carBody = useRef<Group>(null)

  // Articulation physics accumulators
  const bodyRoll = useRef(0)
  const bodyPitch = useRef(0)
  const bumpPitch = useRef(0)
  const steerAngle = useRef(0)
  const wheelRoll = useRef(0)
  // Acceleration hold time accumulators for progressive speed build-up
  const throttleHoldTime = useRef(0)
  const reverseHoldTime = useRef(0)

  useFrame((state, delta) => {
    if (!car.current) return
    if (paused) {
      velocity.current = 0
      throttleHoldTime.current = 0
      reverseHoldTime.current = 0
      if (controlState.current) {
        controlState.current.forward = false
        controlState.current.back = false
        controlState.current.left = false
        controlState.current.right = false
        controlState.current.throttle = 0
        controlState.current.steering = 0
      }
      return
    }
    const dt = Math.min(delta, 0.05)
    const { forward, back, left, right, throttle = 0, steering: analogSteering = 0 } = controlState.current

    let t = throttle
    if (Math.abs(t) < 0.04) {
      if (forward) t = 1
      else if (back) t = -1
      else t = 0
    }

    let s = analogSteering
    if (Math.abs(s) < 0.04) {
      s = Number(right) - Number(left)
    }

    if (t > 0) {
      // Build up throttle duration as key is held down
      throttleHoldTime.current = Math.min(3.6, throttleHoldTime.current + dt)
      reverseHoldTime.current = Math.max(0, reverseHoldTime.current - dt * 3.0)

      // Progressive speed ramp:
      // - Initial tap/start: base speed ~7.2 m/s
      // - Holding for 1s: ~10.4 m/s
      // - Holding for 2s: ~13.4 m/s
      // - Holding for 3s+: ~16.0 m/s (high gear top speed)
      const holdRatio = Math.min(1, throttleHoldTime.current / 3.0)
      const powerCurve = Math.pow(holdRatio, 0.76)
      const maxSpeed = (7.2 + powerCurve * 8.8) * Math.abs(t)
      const accelRate = (7.2 + powerCurve * 5.2) * t

      velocity.current = Math.min(maxSpeed, velocity.current + (velocity.current < 0 ? 17 : accelRate) * dt)
    } else if (t < 0) {
      reverseHoldTime.current = Math.min(2.0, reverseHoldTime.current + dt)
      throttleHoldTime.current = Math.max(0, throttleHoldTime.current - dt * 3.0)

      const revRatio = Math.min(1, reverseHoldTime.current / 1.8)
      const maxReverse = -(3.2 + revRatio * 2.2) * Math.abs(t)
      const revAccel = (5.5 + revRatio * 3.0) * Math.abs(t)

      velocity.current = Math.max(maxReverse, velocity.current - (velocity.current > 0 ? 18 : revAccel) * dt)
    } else {
      // Natural deceleration & gradual gear decay
      throttleHoldTime.current = Math.max(0, throttleHoldTime.current - dt * 1.5)
      reverseHoldTime.current = Math.max(0, reverseHoldTime.current - dt * 2.5)
      velocity.current *= Math.exp(-1.8 * dt)
    }
    if (Math.abs(velocity.current) < 0.025) velocity.current = 0

    // Grip and steering response scaled smoothly for high speed stability + drift feeling
    const curSpeed = Math.abs(velocity.current)
    const lowSpeedGrip = 0.32 + 0.68 * Math.min(curSpeed / 3.6, 1)
    const highSpeedDamp = 1.0 / (1.0 + Math.max(0, curSpeed - 7.5) * 0.038)
    const grip = lowSpeedGrip * highSpeedDamp
    rotation.current -= s * grip * Math.sign(velocity.current || 1) * dt

    // Compute intended movement step
    const moveX = -Math.sin(rotation.current) * velocity.current * dt
    const moveZ = -Math.cos(rotation.current) * velocity.current * dt

    const currentX = car.current.position.x
    const currentZ = car.current.position.z

    const targetX = currentX + moveX
    const targetZ = currentZ + moveZ

    // Physical collision resolution against all static obstacles
    const resolution = resolveCarCollisions(targetX, targetZ)

    if (resolution.collided) {
      const travelDirX = -Math.sin(rotation.current)
      const travelDirZ = -Math.cos(rotation.current)
      const intoNormal = travelDirX * velocity.current * resolution.normalX + travelDirZ * velocity.current * resolution.normalZ

      // Only respond if moving towards the obstacle surface
      if (intoNormal < -0.05) {
        bumpPitch.current = -Math.min(0.09, Math.abs(velocity.current) * 0.02)
        if (Math.abs(velocity.current) > 1.2) {
          playBumpSound(Math.min(1, Math.abs(velocity.current) / 6.0))
        }

        if (Math.abs(velocity.current) > 2.8) {
          // Energetic bounce back
          velocity.current = -velocity.current * 0.26
        } else {
          // Dampen velocity to allow smooth wall sliding
          velocity.current *= 0.65
        }
      }
    }

    car.current.position.x = resolution.x
    car.current.position.z = resolution.z
    car.current.rotation.y = rotation.current

    if (carPhysicsState?.current) {
      carPhysicsState.current.x = resolution.x
      carPhysicsState.current.z = resolution.z
      carPhysicsState.current.speed = velocity.current
      carPhysicsState.current.vx = Math.sin(rotation.current) * velocity.current
      carPhysicsState.current.vz = Math.cos(rotation.current) * velocity.current
      carPhysicsState.current.rotation = rotation.current
    }

    // --- SUSPENSION DYNAMICS ---
    // 1. Centrifugal lean into/out of turns
    const speed = Math.abs(velocity.current)
    const speedRatio = Math.min(1, speed / 4.2)
    const targetBodyRoll = s * speedRatio * 0.045
    bodyRoll.current += (targetBodyRoll - bodyRoll.current) * Math.min(1, dt * 10)

    // 2. Pitch under acceleration, braking and bumps
    let targetBodyPitch = 0
    if (t > 0.1 && velocity.current >= 0) {
      targetBodyPitch = 0.020 + (throttleHoldTime.current / 3.0) * 0.016 // Progressive nose rise under sustained acceleration
    } else if (t < -0.1 && velocity.current > 0.5) {
      targetBodyPitch = -0.048 // Nose dives under braking
    } else if (t < -0.1 && velocity.current < 0) {
      targetBodyPitch = 0.018 // Tail squats in reverse
    }
    bodyPitch.current += (targetBodyPitch - bodyPitch.current) * Math.min(1, dt * 8)
    bumpPitch.current *= Math.exp(-12 * dt)

    // 3. Engine idle micro-vibration + subtle road feedback
    const engineIdle = Math.sin(state.clock.getElapsedTime() * 10) * 0.0006
    const roadRumble = Math.sin(state.clock.getElapsedTime() * 18) * 0.0008 * speedRatio

    if (carBody.current) {
      carBody.current.position.y = 0.02 + engineIdle + roadRumble
      carBody.current.rotation.x = bodyPitch.current + bumpPitch.current
      carBody.current.rotation.z = bodyRoll.current
    }

    // 4. Wheel steering (front wheels turn) and 4-wheel rolling rotation
    const targetSteer = -s * 0.44
    steerAngle.current += (targetSteer - steerAngle.current) * Math.min(1, dt * 14)

    const wheelRadius = 0.187 // 0.39 * 0.48 scale
    wheelRoll.current = (wheelRoll.current + (velocity.current / wheelRadius) * dt) % (Math.PI * 2)

    if (wheelGroups) {
      wheelGroups.flSteer.rotation.y = steerAngle.current
      wheelGroups.frSteer.rotation.y = steerAngle.current
      wheelGroups.flRoll.rotation.z = wheelRoll.current
      wheelGroups.frRoll.rotation.z = wheelRoll.current
      wheelGroups.rlRoll.rotation.z = wheelRoll.current
      wheelGroups.rrRoll.rotation.z = wheelRoll.current
    }

    const orbit = cameraOrbit.current
    orbit.radius += (orbit.targetRadius - orbit.radius) * Math.min(1, dt * 10)

    // Portrait perspective optimization:
    // When viewport is vertical (width < height), perspective camera horizontal FOV shrinks.
    // Pulling back radius +2.4m and slightly lifting camera target gives wide forward visibility.
    const isPortrait = state.size.width < state.size.height
    const portraitRadiusBonus = isPortrait ? 2.4 : 0
    const portraitElevationBonus = isPortrait ? 0.06 : 0
    const targetLookY = isPortrait ? 0.92 : 0.68

    // Auto-recenter camera yaw behind the car when moving forward if user released touch drag
    const now = performance.now()
    const lastManual = orbit.lastManualTime || 0
    const timeSinceManual = (now - lastManual) / 1000

    if (!orbit.isManual && speed > 1.4 && timeSinceManual > 1.2) {
      orbit.yaw *= Math.exp(-2.4 * dt)
      const defaultElev = 0.40
      orbit.elevation += (defaultElev - orbit.elevation) * Math.min(1, dt * 2.0)
    }

    // Gentle camera pull-back (+0.85m max) proportional to speed for thrilling high-speed sensation
    const speedZoom = Math.min(1.0, speed / 15.5) * 0.85
    const effRadius = orbit.radius + speedZoom + portraitRadiusBonus
    const effElevation = orbit.elevation + portraitElevationBonus

    const cameraYaw = rotation.current + orbit.yaw
    const behind = new Vector3(
      Math.sin(cameraYaw) * effRadius * Math.cos(effElevation),
      effRadius * Math.sin(effElevation),
      Math.cos(cameraYaw) * effRadius * Math.cos(effElevation)
    )
    const target = new Vector3(car.current.position.x, 0, car.current.position.z).add(behind)
    camera.position.lerp(target, 1 - Math.pow(0.001, dt))
    camera.lookAt(car.current.position.x, targetLookY, car.current.position.z)

    // Check Destination Proximity
    const nearest = destinations
      .map((entry) => ({
        entry,
        distance: Math.hypot(car.current!.position.x - entry.position[0], car.current!.position.z - entry.position[2]),
      }))
      .sort((a, b) => a.distance - b.distance)[0]

    const next = nearest.distance < nearest.entry.size + 1.1 ? nearest.entry.id : null
    if (next !== nearestId.current) {
      nearestId.current = next
      onArrive(next)
      if (next && activatedId.current !== next) activatedId.current = next
      if (!next) activatedId.current = null
    }

    // Check Collectible Star Collisions (stars are picked up, not blocked)
    if (onCollectStar) {
      const carX = car.current.position.x
      const carZ = car.current.position.z
      for (const star of STAR_COORDINATES) {
        if (!collectedStars.includes(star.id)) {
          const dist = Math.hypot(carX - star.pos[0], carZ - star.pos[2])
          if (dist < 1.45) {
            onCollectStar(star.id)
          }
        }
      }
    }

    // Dynamic brake lights response: ONLY lights up when physically braking
    const isBraking =
      (t < -0.05 && velocity.current > 0.25) ||
      (t > 0.05 && velocity.current < -0.25)

    const brakeIntensity = isBraking ? 3.8 : 0.0
    taillightMatsRef.current.forEach((m) => {
      if (m && 'emissiveIntensity' in m) {
        m.emissiveIntensity = brakeIntensity
        if ('color' in m) {
          m.color = isBraking ? new Color('#ff2222') : new Color('#4a0a0a')
        }
      }
    })
    if (rearBrakeLightRef.current) {
      rearBrakeLightRef.current.intensity = isBraking ? 3.2 : 0
    }
  })

  return (
    <group ref={car} position={[0, 0, 3]}>
      {/* Ground contact shadow disk anchoring car to the road */}
      {carShadowTexture && (
        <mesh position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.75, 3.25]} />
          <meshBasicMaterial
            map={carShadowTexture}
            transparent
            opacity={0.65}
            depthWrite={false}
          />
        </mesh>
      )}
      <group ref={carBody} position={[0, 0.02, 0]}>
        {/* Dynamic Rear Brake Flare: ONLY lights up when braking */}
        <pointLight
          ref={rearBrakeLightRef}
          position={[0, 0.38, 1.48]}
          intensity={0}
          color="#ff1a1a"
          distance={3.2}
        />

        <group scale={0.48} rotation={[0, -Math.PI / 2, 0]}>
          <primitive
            object={carModel}
            position={[-7.6498, 0, 13.1557]}
            dispose={null}
          />
        </group>
      </group>
    </group>
  )
}

function Trees({ isMobile }: { isMobile?: boolean }) {
  const fbx = useFBX('/models/trees/fantasy_trees.fbx')
  const diffuse = useLoader(TextureLoader, '/models/trees/DioR3.png')
  const alpha = useLoader(TextureLoader, '/models/trees/Alpha.jpg')

  // Shared high-performance standard material with pure white base color so textures are vibrant
  const treeMaterial = useMemo(() => {
    diffuse.colorSpace = SRGBColorSpace
    return new MeshStandardMaterial({
      map: diffuse,
      alphaMap: alpha,
      color: new Color('#ffffff'),
      transparent: true,
      alphaTest: 0.35,
      side: isMobile ? FrontSide : DoubleSide,
      roughness: 0.68,
      metalness: 0.02,
    })
  }, [diffuse, alpha, isMobile])

  // Assemble the 5 distinct complete fantasy tree variants (trunk + foliage + twigs)
  const variants = useMemo(() => {
    const list: Group[] = []

    for (let i = 1; i <= 5; i++) {
      const treeGroup = new Group()
      // Each tree variant consists of: TRS (trunk), TRW (foliage), TRT (twigs)
      const partNames = [`TRS${i}`, `TRW${i}`, `TRT${i}`]
      let foundParts = 0

      partNames.forEach((name) => {
        const mesh = fbx.getObjectByName(name)
        if (mesh && mesh instanceof Mesh) {
          const clone = mesh.clone(true)
          clone.position.set(0, 0, 0)
          clone.rotation.set(-Math.PI / 2, 0, 0)
          clone.scale.set(1, 1, 1)
          clone.material = treeMaterial
          clone.castShadow = !isMobile
          clone.receiveShadow = false
          treeGroup.add(clone)
          foundParts++
        }
      })

      if (foundParts > 0) {
        // Natural normalization: raw FBX tree height is ~7.64m, scale to ~4.6m standard height
        const targetHeight = 4.6
        const rawHeight = 7.64
        const normScale = targetHeight / rawHeight

        const wrapper = new Group()
        treeGroup.scale.set(normScale, normScale, normScale)
        wrapper.add(treeGroup)
        list.push(wrapper)
      }
    }

    return list.length > 0 ? list : [new Group()]
  }, [fbx, treeMaterial])

  return (
    <group>
      {TREE_DATA.map((tree, i) => {
        const variantIndex = i % variants.length
        const variant = variants[variantIndex]
        const clone = variant.clone(true)
        const scaleFactor = tree.scale / 1.6
        return (
          <group
            key={i}
            position={[tree.x, 0, tree.z]}
            rotation={[0, ((i * 5) % 8) * (Math.PI / 4), 0]}
            scale={[scaleFactor, scaleFactor, scaleFactor]}
          >
            <primitive object={clone} />
          </group>
        )
      })}
    </group>
  )
}

const landmarkModels: Record<Place, string> = {
  work: 'city-suburban/building-type-p',
  about: 'city-suburban/building-type-g',
  skills: 'city-suburban/building-type-k',
  contact: 'city-suburban/building-type-b',
}

const landmarkRotations: Record<Place, number> = {
  work: -Math.PI / 2,
  about: 0,
  skills: 0,
  contact: Math.PI / 2,
}

function Building({ kind }: { kind: Place }) {
  const scale = kind === 'skills' ? 2.8 : 2.55
  return <Asset name={landmarkModels[kind]} position={[0, 0, 0]} rotation={[0, landmarkRotations[kind], 0]} scale={scale} />
}

function Neighborhood() {
  return (
    <>
      {NEIGHBORHOOD_HOMES.map((home, index) => {
        const scale = 1.15
        return (
          <Asset
            key={home.type}
            name={`city-suburban/${home.type}`}
            position={home.position}
            rotation={[0, index % 2 ? Math.PI / 2 : 0, 0]}
            scale={scale}
          />
        )
      })}
    </>
  )
}

function UrbanDetails() {
  return (
    <group>
      {/* Planters with flowers in front of suburban houses */}
      <Asset name="city-suburban/planter" position={[-3.6, 0, -3.2]} scale={1.1} />
      <Asset name="props/flower_redA" position={[-3.6, 0.42, -3.2]} scale={1.15} />
      <Asset name="city-suburban/planter" position={[3.6, 0, -3.2]} scale={1.1} />
      <Asset name="props/flower_redA" position={[3.6, 0.42, -3.2]} scale={1.15} />
      <Asset name="city-suburban/planter" position={[-3.6, 0, 3.2]} scale={1.1} />
      <Asset name="props/flower_redA" position={[-3.6, 0.42, 3.2]} scale={1.15} />

      {/* Destination Plaza Planters */}
      <Asset name="city-suburban/planter" position={[5.4, 0, -13.2]} scale={1.15} />
      <Asset name="props/flower_redA" position={[5.4, 0.42, -13.2]} scale={1.2} />
      <Asset name="city-suburban/planter" position={[9.4, 0, -13.2]} scale={1.15} />
      <Asset name="props/flower_redA" position={[9.4, 0.42, -13.2]} scale={1.2} />

      <Asset name="city-suburban/planter" position={[-15.2, 0, -5.4]} rotation={[0, Math.PI / 2, 0]} scale={1.15} />
      <Asset name="props/flower_redA" position={[-15.2, 0.42, -5.4]} scale={1.2} />
      <Asset name="city-suburban/planter" position={[-15.2, 0, -9.4]} rotation={[0, Math.PI / 2, 0]} scale={1.15} />
      <Asset name="props/flower_redA" position={[-15.2, 0.42, -9.4]} scale={1.2} />

      <Asset name="city-suburban/planter" position={[15.2, 0, -5.4]} rotation={[0, -Math.PI / 2, 0]} scale={1.15} />
      <Asset name="props/flower_redA" position={[15.2, 0.42, -5.4]} scale={1.2} />
      <Asset name="city-suburban/planter" position={[15.2, 0, -9.4]} rotation={[0, -Math.PI / 2, 0]} scale={1.15} />
      <Asset name="props/flower_redA" position={[15.2, 0.42, -9.4]} scale={1.2} />

      <Asset name="city-suburban/planter" position={[-5.4, 0, 15.2]} scale={1.15} />
      <Asset name="props/flower_redA" position={[-5.4, 0.42, 15.2]} scale={1.2} />
      <Asset name="city-suburban/planter" position={[-9.4, 0, 15.2]} scale={1.15} />
      <Asset name="props/flower_redA" position={[-9.4, 0.42, 15.2]} scale={1.2} />

      {/* Decorative sidewalk shrubs / bushes */}
      <Asset name="props/plant_bushSmall" position={[2.4, 0, -7.5]} scale={1.2} />
      <Asset name="props/plant_bushSmall" position={[-2.4, 0, -7.5]} scale={1.2} />
      <Asset name="props/plant_bushSmall" position={[2.4, 0, 7.5]} scale={1.2} />
      <Asset name="props/plant_bushSmall" position={[-2.4, 0, 7.5]} scale={1.2} />
      <Asset name="props/plant_bushSmall" position={[7.5, 0, -2.4]} scale={1.2} />
      <Asset name="props/plant_bushSmall" position={[7.5, 0, 2.4]} scale={1.2} />
      <Asset name="props/plant_bushSmall" position={[-7.5, 0, -2.4]} scale={1.2} />
      <Asset name="props/plant_bushSmall" position={[-7.5, 0, 2.4]} scale={1.2} />

      {/* Real 3D Stepping Stone Walkways */}
      <Asset name="city-suburban/path-stones-short" position={[-2.8, 0.02, -5.2]} scale={1.1} />
      <Asset name="city-suburban/path-stones-short" position={[2.8, 0.02, -5.2]} scale={1.1} />
      <Asset name="city-suburban/path-stones-short" position={[-2.8, 0.02, 5.2]} scale={1.1} />

      {/* Walkways leading from the avenue towards the destination landmarks */}
      <Asset name="city-suburban/path-stones-long" position={[-16.8, 0.02, -2.5]} rotation={[0, -Math.PI / 4, 0]} scale={1.2} />
      <Asset name="city-suburban/path-stones-short" position={[-17.2, 0.02, -4.6]} scale={1.2} />

      <Asset name="city-suburban/path-stones-long" position={[16.8, 0.02, -2.5]} rotation={[0, Math.PI / 4, 0]} scale={1.2} />
      <Asset name="city-suburban/path-stones-short" position={[17.2, 0.02, -4.6]} scale={1.2} />

      <Asset name="city-suburban/path-stones-long" position={[-2.5, 0.02, 16.8]} rotation={[0, -Math.PI / 4, 0]} scale={1.2} />
      <Asset name="city-suburban/path-stones-short" position={[-4.6, 0.02, 17.2]} scale={1.2} />
    </group>
  )
}

function PerimeterFences({ isMobile }: { isMobile?: boolean }) {
  const { scene } = useGLTF('/models/props/fence_simple.glb')
  const meshWoodRef = useRef<InstancedMesh>(null)
  const meshWoodDarkRef = useRef<InstancedMesh>(null)

  const { woodGeo, woodMat, woodDarkGeo, woodDarkMat } = useMemo(() => {
    let wG: BufferGeometry | null = null
    let wM: Material | null = null
    let wdG: BufferGeometry | null = null
    let wdM: Material | null = null

    scene.traverse((obj) => {
      if (obj instanceof Mesh) {
        if (obj.material?.name === 'wood') {
          wG = obj.geometry
          wM = obj.material
        } else if (obj.material?.name === 'woodDark') {
          wdG = obj.geometry
          wdM = obj.material
        }
      }
    })
    return { woodGeo: wG, woodMat: wM, woodDarkGeo: wdG, woodDarkMat: wdM }
  }, [scene])

  const matrices = useMemo(() => {
    const BOUNDARY = 24.0
    const STEP = 1.6
    const COUNT = 30
    const start = -BOUNDARY + STEP / 2
    const mats: Matrix4[] = []
    const dummy = new Object3D()
    const scale = 1.6
    const zCentering = 0.465 * scale

    const addSegment = (x: number, z: number, rotY: number) => {
      dummy.position.set(x, 0, z)
      dummy.rotation.set(0, rotY, 0)
      dummy.scale.set(scale, scale, scale)
      dummy.translateZ(zCentering)
      dummy.updateMatrix()
      mats.push(dummy.matrix.clone())
    }

    // North border (z = -BOUNDARY)
    for (let i = 0; i < COUNT; i++) addSegment(start + i * STEP, -BOUNDARY, 0)
    // South border (z = +BOUNDARY)
    for (let i = 0; i < COUNT; i++) addSegment(start + i * STEP, BOUNDARY, Math.PI)
    // East border (x = +BOUNDARY)
    for (let i = 0; i < COUNT; i++) addSegment(BOUNDARY, start + i * STEP, -Math.PI / 2)
    // West border (x = -BOUNDARY)
    for (let i = 0; i < COUNT; i++) addSegment(-BOUNDARY, start + i * STEP, Math.PI / 2)

    return mats
  }, [])

  useEffect(() => {
    if (!meshWoodRef.current || !meshWoodDarkRef.current) return
    meshWoodRef.current.frustumCulled = false
    meshWoodDarkRef.current.frustumCulled = false
    matrices.forEach((mat, i) => {
      meshWoodRef.current!.setMatrixAt(i, mat)
      meshWoodDarkRef.current!.setMatrixAt(i, mat)
    })
    meshWoodRef.current.instanceMatrix.needsUpdate = true
    meshWoodDarkRef.current.instanceMatrix.needsUpdate = true
  }, [matrices])

  if (!woodGeo || !woodMat || !woodDarkGeo || !woodDarkMat) return null

  return (
    <group>
      <instancedMesh
        ref={meshWoodRef}
        args={[woodGeo, woodMat, matrices.length]}
        castShadow={!isMobile}
        receiveShadow={false}
        frustumCulled={false}
      />
      <instancedMesh
        ref={meshWoodDarkRef}
        args={[woodDarkGeo, woodDarkMat, matrices.length]}
        castShadow={!isMobile}
        receiveShadow={false}
        frustumCulled={false}
      />
    </group>
  )
}

function RoadNetwork() {
  const tileSize = 3
  const streets = useMemo(() => Array.from({ length: 8 }, (_, index) => (index + 1) * tileSize), [tileSize])
  return (
    <group position={[0, 0.015, 0]}>
      <Asset name="city-roads/road-crossroad" position={[0, 0, 0]} scale={tileSize} />
      {streets.flatMap((offset) => [
        <Asset key={`north-${offset}`} name="city-roads/road-straight" position={[0, 0, -offset]} scale={tileSize} />,
        <Asset key={`south-${offset}`} name="city-roads/road-straight" position={[0, 0, offset]} rotation={[0, Math.PI, 0]} scale={tileSize} />,
        <Asset key={`east-${offset}`} name="city-roads/road-straight" position={[offset, 0, 0]} rotation={[0, Math.PI / 2, 0]} scale={tileSize} />,
        <Asset key={`west-${offset}`} name="city-roads/road-straight" position={[-offset, 0, 0]} rotation={[0, -Math.PI / 2, 0]} scale={tileSize} />,
      ])}
    </group>
  )
}

function Location({
  id,
  title,
  number,
  position,
  color,
  onOpen,
  onSelectProject,
}: (typeof destinations)[number] & {
  onOpen: (id: Place) => void
  onSelectProject?: (id: string) => void
}) {
  return (
    <group position={position}>
      {id === 'work' ? (
        <GarageShowroom onOpen={onOpen} onSelectProject={onSelectProject} />
      ) : (
        <>
          <Building kind={id} />
          <mesh position={[0, 0.022, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[3.2, 36]} />
            <meshBasicMaterial color={color} transparent opacity={0.14} />
          </mesh>
          <mesh position={[0, 0.026, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[2.95, 3.25, 36]} />
            <meshBasicMaterial color={color} transparent opacity={0.45} />
          </mesh>
        </>
      )}
      <Html position={[0, 4.0, 0]} center distanceFactor={13.5} zIndexRange={[5, 0]}>
        <button className={`world-sign sign-${id}`} type="button" onClick={() => onOpen(id)} aria-label={`Abrir ${title}`}>
          <small>{number} / DESTINO</small>
          <b>{title}</b>
          <span>ENTRAR AQUÍ ↗</span>
        </button>
      </Html>
    </group>
  )
}

function MobileJoystick({ controlState, paused }: { controlState: RefObject<Controls>; paused: boolean }) {
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 })
  const [active, setActive] = useState(false)
  const [braking, setBraking] = useState(false)
  const baseRef = useRef<HTMLDivElement>(null)
  const touchIdRef = useRef<number | null>(null)
  const brakeTouchIdRef = useRef<number | null>(null)
  const maxRadius = 36

  const updatePosition = useCallback(
    (clientX: number, clientY: number, rect: DOMRect) => {
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      let dx = clientX - centerX
      let dy = clientY - centerY
      const dist = Math.hypot(dx, dy)

      if (dist > maxRadius) {
        dx = (dx / dist) * maxRadius
        dy = (dy / dist) * maxRadius
      }

      setKnobPos({ x: dx, y: dy })

      const normX = dx / maxRadius
      const normY = -dy / maxRadius

      const deadzone = 0.12
      const effThrottle = Math.abs(normY) < deadzone ? 0 : normY
      const effSteering = Math.abs(normX) < deadzone ? 0 : normX

      if (controlState.current) {
        // If not actively braking via right-hand pedal, use joystick throttle
        if (!brakeTouchIdRef.current) {
          controlState.current.throttle = effThrottle
          controlState.current.forward = effThrottle > 0.2
          controlState.current.back = effThrottle < -0.2
        }
        controlState.current.steering = effSteering
        controlState.current.left = effSteering < -0.2
        controlState.current.right = effSteering > 0.2
      }
    },
    [controlState, maxRadius]
  )

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (paused) return
    e.preventDefault()
    e.stopPropagation()
    const rect = baseRef.current?.getBoundingClientRect()
    if (!rect) return
    touchIdRef.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
    setActive(true)
    updatePosition(e.clientX, e.clientY, rect)
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (touchIdRef.current !== e.pointerId || !baseRef.current) return
    e.preventDefault()
    e.stopPropagation()
    const rect = baseRef.current.getBoundingClientRect()
    updatePosition(e.clientX, e.clientY, rect)
  }

  const handlePointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (touchIdRef.current !== e.pointerId) return
    e.preventDefault()
    e.stopPropagation()
    touchIdRef.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    setActive(false)
    setKnobPos({ x: 0, y: 0 })
    if (controlState.current) {
      if (!brakeTouchIdRef.current) {
        controlState.current.throttle = 0
        controlState.current.forward = false
        controlState.current.back = false
      }
      controlState.current.steering = 0
      controlState.current.left = false
      controlState.current.right = false
    }
  }

  // Right-hand Brake / Reverse Pedal handlers
  const handleBrakeDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (paused) return
    e.preventDefault()
    e.stopPropagation()
    brakeTouchIdRef.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
    setBraking(true)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(25)
      } catch {
        /* ignore */
      }
    }
    if (controlState.current) {
      controlState.current.throttle = -1
      controlState.current.back = true
      controlState.current.forward = false
    }
  }

  const handleBrakeEnd = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (brakeTouchIdRef.current !== e.pointerId) return
    e.preventDefault()
    e.stopPropagation()
    brakeTouchIdRef.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    setBraking(false)
    if (controlState.current) {
      controlState.current.throttle = 0
      controlState.current.back = false
    }
  }

  useEffect(() => {
    if (paused) {
      setActive(false)
      setBraking(false)
      setKnobPos({ x: 0, y: 0 })
      touchIdRef.current = null
      brakeTouchIdRef.current = null
      if (controlState.current) {
        controlState.current.throttle = 0
        controlState.current.steering = 0
        controlState.current.forward = false
        controlState.current.back = false
        controlState.current.left = false
        controlState.current.right = false
      }
    }
  }, [paused, controlState])

  return (
    <>
      <div
        className={`mobile-joystick-wrap${active ? ' is-active' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onLostPointerCapture={handlePointerEnd}
        aria-label="Palanca de mando para conducir"
        role="region"
      >
        <div className="joystick-base" ref={baseRef}>
          <div className="joystick-ring" />
          <div className="joystick-crosshairs">
            <span className="tick tick-top" />
            <span className="tick tick-bottom" />
            <span className="tick tick-left" />
            <span className="tick tick-right" />
          </div>
          <div
            className="joystick-knob"
            style={{
              transform: `translate3d(${knobPos.x}px, ${knobPos.y}px, 0)`,
              transition: active ? 'none' : 'transform .18s cubic-bezier(.2, .9, .3, 1)',
            }}
          >
            <div className="knob-core" />
          </div>
        </div>
        <span className="joystick-hint">CONDUCIR</span>
      </div>

      <div className="mobile-brake-wrap" aria-label="Pedal de freno y marcha atrás">
        <button
          type="button"
          className={`mobile-brake-btn${braking ? ' is-active' : ''}`}
          onPointerDown={handleBrakeDown}
          onPointerUp={handleBrakeEnd}
          onPointerCancel={handleBrakeEnd}
          onLostPointerCapture={handleBrakeEnd}
          title="Freno y marcha atrás"
          aria-label="Frenar o dar marcha atrás"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M19 12l-7 7-7-7" />
          </svg>
          <span>FRENO</span>
        </button>
        <span className="mobile-brake-hint">REVERSA</span>
      </div>
    </>
  )
}

function WorldLoadingOverlay() {
  const { active, progress } = useProgress()
  const [done, setDone] = useState(false)
  const [removed, setRemoved] = useState(false)

  useEffect(() => {
    if (!active && progress >= 100) {
      const t1 = setTimeout(() => setDone(true), 350)
      const t2 = setTimeout(() => setRemoved(true), 850)
      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
      }
    }
  }, [active, progress])

  if (removed) return null

  const displayPct = Math.min(100, Math.max(0, Math.round(progress)))

  return (
    <div className={`world-loading-overlay ${done ? 'is-fading' : ''}`}>
      <div className="world-loading-card">
        <div className="world-loading-badge">AYMAR AVILÉS · CIUDAD 3D</div>
        <div className="world-loading-car">
          <span className="car-emoji">🚗</span>
          <span className="road-stripes" />
        </div>
        <div className="world-loading-title">Cargando Ciudad Virtual</div>
        <p className="world-loading-desc">Preparando modelos 3D, texturas y físicas...</p>
        <div className="world-loading-track">
          <div className="world-loading-fill" style={{ width: `${displayPct}%` }} />
        </div>
        <div className="world-loading-footer">
          <span className="world-loading-pct">{displayPct}%</span>
          <span className="world-loading-status">
            {displayPct >= 100 ? '¡Listo! Arrancando motor...' : 'Optimizando texturas...'}
          </span>
        </div>
      </div>
    </div>
  )
}

function World({ onArrive, onOpen, paused, collectedStars = [], onCollectStar, onSelectProject }: OpenWorldProps) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768
  })

  useEffect(() => {
    const check = () => {
      setIsMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768)
    }
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const grassTexture = useMemo(() => createGrassTexture(), [])
  const controlState = useRef<Controls>({ forward: false, back: false, left: false, right: false, throttle: 0, steering: 0 })
  const carPhysicsState = useRef<CarPhysicsState>({ x: 0, z: 3, vx: 0, vz: 0, speed: 0, rotation: 0 })
  const cameraOrbit = useRef<CameraOrbitState>({
    yaw: 0,
    elevation: 0.4,
    radius: DEFAULT_CAMERA_RADIUS,
    targetRadius: DEFAULT_CAMERA_RADIUS,
  })
  const lookPointer = useRef<{ id: number; x: number; y: number } | null>(null)
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  const lastPinchDistance = useRef<number | null>(null)
  const lastTapTime = useRef<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const [looking, setLooking] = useState(false)
  const releaseTimers = useRef<Partial<Record<DigitalControl, number>>>({})

  const controls = useCallback(
    (key: DigitalControl, down: boolean) => {
      if (!paused) controlState.current[key] = down
    },
    [paused]
  )

  const cancelRelease = useCallback((key: DigitalControl) => {
    const timer = releaseTimers.current[key]
    if (timer) window.clearTimeout(timer)
    delete releaseTimers.current[key]
  }, [])

  const coastRelease = useCallback(
    (key: DigitalControl) => {
      cancelRelease(key)
      releaseTimers.current[key] = window.setTimeout(() => {
        controls(key, false)
        delete releaseTimers.current[key]
      }, 150)
    },
    [cancelRelease, controls]
  )

  useEffect(() => {
    const codeMap: Record<string, DigitalControl> = {
      KeyW: 'forward',
      ArrowUp: 'forward',
      KeyS: 'back',
      ArrowDown: 'back',
      KeyA: 'left',
      ArrowLeft: 'left',
      KeyD: 'right',
      ArrowRight: 'right',
    }
    const keyMap: Record<string, DigitalControl> = {
      w: 'forward',
      W: 'forward',
      ArrowUp: 'forward',
      s: 'back',
      S: 'back',
      ArrowDown: 'back',
      a: 'left',
      A: 'left',
      ArrowLeft: 'left',
      d: 'right',
      D: 'right',
      ArrowRight: 'right',
    }
    const getControl = (e: KeyboardEvent) => codeMap[e.code] || keyMap[e.key]

    const down = (event: KeyboardEvent) => {
      const control = getControl(event)
      if (control && !paused) {
        event.preventDefault()
        cancelRelease(control)
        controls(control, true)
      }
    }
    const up = (event: KeyboardEvent) => {
      const control = getControl(event)
      if (control) {
        event.preventDefault()
        coastRelease(control)
      }
    }
    const blur = () => {
      if (controlState.current) {
        controlState.current.forward = false
        controlState.current.back = false
        controlState.current.left = false
        controlState.current.right = false
        controlState.current.throttle = 0
        controlState.current.steering = 0
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
      ;(Object.keys(releaseTimers.current) as DigitalControl[]).forEach((name) => cancelRelease(name))
    }
  }, [cancelRelease, coastRelease, controls, paused])

  // Wheel zoom handler with smooth boundary clamping
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const zoomStep = e.deltaY * 0.014
      cameraOrbit.current.targetRadius = Math.max(
        MIN_CAMERA_RADIUS,
        Math.min(MAX_CAMERA_RADIUS, cameraOrbit.current.targetRadius + zoomStep)
      )
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', handleWheel)
    }
  }, [])

  const handleZoomIn = () => {
    cameraOrbit.current.targetRadius = Math.max(
      MIN_CAMERA_RADIUS,
      cameraOrbit.current.targetRadius - 2.0
    )
  }

  const handleZoomOut = () => {
    cameraOrbit.current.targetRadius = Math.min(
      MAX_CAMERA_RADIUS,
      cameraOrbit.current.targetRadius + 2.0
    )
  }

  const startLook = (event: ReactPointerEvent<HTMLDivElement>) => {
    activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (activePointers.current.size === 2) {
      const pts = Array.from(activePointers.current.values())
      lastPinchDistance.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      return
    }

    const isTouch = event.pointerType === 'touch'
    const isMouseOrbit = event.pointerType === 'mouse' && event.button === 2
    if (!isTouch && !isMouseOrbit) return
    if (!(event.target instanceof HTMLCanvasElement)) return

    // Double tap on canvas resets camera view directly behind the car
    const now = performance.now()
    if (isTouch && now - lastTapTime.current < 300) {
      cameraOrbit.current.yaw = 0
      cameraOrbit.current.elevation = 0.40
      cameraOrbit.current.targetRadius = DEFAULT_CAMERA_RADIUS
      lastTapTime.current = 0
      return
    }
    lastTapTime.current = now

    event.preventDefault()
    event.stopPropagation()
    lookPointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
    cameraOrbit.current.isManual = true
    cameraOrbit.current.lastManualTime = now
    event.currentTarget.setPointerCapture(event.pointerId)
    setLooking(true)
  }

  const moveLook = (event: ReactPointerEvent<HTMLDivElement>) => {
    activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (activePointers.current.size === 2 && lastPinchDistance.current !== null) {
      const pts = Array.from(activePointers.current.values())
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const diff = lastPinchDistance.current - dist
      lastPinchDistance.current = dist
      cameraOrbit.current.targetRadius = Math.max(
        MIN_CAMERA_RADIUS,
        Math.min(MAX_CAMERA_RADIUS, cameraOrbit.current.targetRadius + diff * 0.035)
      )
      return
    }

    const pointer = lookPointer.current
    if (!pointer || pointer.id !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    const dx = event.clientX - pointer.x
    const dy = event.clientY - pointer.y
    cameraOrbit.current.yaw -= dx * 0.0075
    cameraOrbit.current.elevation = Math.max(0.16, Math.min(1.15, cameraOrbit.current.elevation + dy * 0.0055))
    cameraOrbit.current.isManual = true
    cameraOrbit.current.lastManualTime = performance.now()
    pointer.x = event.clientX
    pointer.y = event.clientY
  }

  const endLook = (event: ReactPointerEvent<HTMLDivElement>) => {
    activePointers.current.delete(event.pointerId)
    if (activePointers.current.size < 2) {
      lastPinchDistance.current = null
    }

    if (!lookPointer.current || lookPointer.current.id !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    lookPointer.current = null
    cameraOrbit.current.isManual = false
    cameraOrbit.current.lastManualTime = performance.now()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    setLooking(false)
  }

  return (
    <div
      ref={containerRef}
      className={`world-canvas${looking ? ' is-looking' : ''}`}
      onPointerDownCapture={startLook}
      onPointerMoveCapture={moveLook}
      onPointerUpCapture={endLook}
      onPointerCancel={endLook}
      onContextMenu={(event) => event.preventDefault()}
    >
      <WorldLoadingOverlay />
      <Canvas
        shadows
        dpr={isMobile ? [1, 1.15] : [1, 1.5]}
        camera={{ position: [0, 3.2, 10.5], fov: 44, near: 0.5, far: 380 }}
        gl={{
          antialias: true,
          toneMapping: ACESFilmicToneMapping,
          toneMappingExposure: 1.16,
          powerPreference: 'high-performance',
        }}
      >
        {/* Realistic Sky, Fog & Lighting Atmosphere */}
        <color attach="background" args={['#7ab0e6']} />
        <fog attach="fog" args={['#7ab0e6', 55, 140]} />

        <Sky
          distance={350}
          sunPosition={[-18, 28, 16]}
          inclination={0.48}
          azimuth={0.22}
          turbidity={2.4}
          rayleigh={1.2}
          mieCoefficient={0.005}
          mieDirectionalG={0.82}
        />

        {/* PBR Skylight (cool blue sky) & Ground Bounce (warm green) */}
        <ambientLight intensity={0.34} color="#b8dcff" />
        <hemisphereLight args={['#a2d2ff', '#4f7838', 0.52]} />

        {/* Crisp Golden Sunlight with High-Definition Soft Shadows */}
        <directionalLight
          position={[-18, 28, 16]}
          intensity={3.4}
          color="#fff6e8"
          castShadow
          shadow-mapSize={isMobile ? [1024, 1024] : [2048, 2048]}
          shadow-camera-left={-28}
          shadow-camera-right={28}
          shadow-camera-top={28}
          shadow-camera-bottom={-28}
          shadow-bias={-0.00006}
          shadow-normalBias={0.025}
        />

        {/* Floating 3D Clouds with sunlight scattering (disabled on mobile for peak performance) */}
        {!isMobile && (
          <Clouds material={MeshLambertMaterial}>
            <Cloud seed={2} scale={1.8} volume={4.5} segments={8} bounds={[14, 2, 14]} speed={0.12} opacity={0.75} color="#ffffff" position={[-15, 16, -10]} />
            <Cloud seed={5} scale={2.2} volume={5.5} segments={8} bounds={[16, 2, 16]} speed={0.10} opacity={0.65} color="#ffffff" position={[16, 18, 12]} />
            <Cloud seed={8} scale={1.7} volume={4.2} segments={7} bounds={[12, 2, 12]} speed={0.14} opacity={0.70} color="#f7faff" position={[-6, 19, 16]} />
          </Clouds>
        )}

        {/* Enhanced Natural Ground Surface with organic lawn texture */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[56.4, 56.4]} />
          <meshStandardMaterial
            color="#528738"
            map={grassTexture ?? undefined}
            roughness={0.78}
            polygonOffset
            polygonOffsetFactor={1}
            polygonOffsetUnits={1}
          />
        </mesh>
        {/* Architectural bedrock foundation pedestal */}
        <mesh position={[0, -0.22, 0]}>
          <boxGeometry args={[56.4, 0.40, 56.4]} />
          <meshStandardMaterial color="#252b20" roughness={0.88} />
        </mesh>

        <Suspense fallback={null}>
          <PerimeterFences isMobile={isMobile} />
          <RoadNetwork />
          <Neighborhood />
          <UrbanDetails />
          <Trees isMobile={isMobile} />

          {/* Option A: Glowing vertical beacons over the 4 destinations */}
          {destinations.map((destination) => (
            <DestinationBeacon key={`beacon-${destination.id}`} position={destination.position} color={destination.color} />
          ))}

          {/* Destination Landmark Buildings & Signs */}
          {destinations.map((destination) => (
            <Location key={destination.id} {...destination} onOpen={onOpen} onSelectProject={onSelectProject} />
          ))}

          {/* Option C: 3D Collectible Stars Mini-Game */}
          <Collectibles collectedStars={collectedStars} />

          {/* Monumento 3D Interactivo Destructible "AYMAR AVILES" */}
          <DestructibleName carPhysics={carPhysicsState} />

          {/* Señales de tránsito y semáforos destructibles que se quedan tumbados */}
          <DestructibleTrafficProps carPhysics={carPhysicsState} />

          {/* Player Car with synchronized physics, solid obstacle collisions and collectible hit check */}
          <Car
            onArrive={onArrive}
            controlState={controlState}
            cameraOrbit={cameraOrbit}
            paused={paused}
            collectedStars={collectedStars}
            onCollectStar={onCollectStar}
            carPhysicsState={carPhysicsState}
          />
        </Suspense>
      </Canvas>
      <div className="world-zoom-widget" aria-label="Controles de zoom">
        <button type="button" onClick={handleZoomIn} title="Acercar cámara" aria-label="Acercar cámara">+</button>
        <span />
        <button type="button" onClick={handleZoomOut} title="Alejar cámara" aria-label="Alejar cámara">−</button>
      </div>
      {!paused && <MobileJoystick controlState={controlState} paused={paused} />}
    </div>
  )
}

useGLTF.preload('/models/props/fence_simple.glb')
useGLTF.preload('/models/car-kit/car-new.glb')
useFBX.preload('/models/trees/fantasy_trees.fbx')

export default function OpenWorld(props: OpenWorldProps) {
  return <World {...props} />
}
