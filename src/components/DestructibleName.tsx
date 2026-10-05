import { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import type { RefObject } from 'react'
import { Mesh, Vector3, Euler, Quaternion } from 'three'
import { useFrame, useLoader } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { playLetterCrashSound, playLetterRebuildSound } from '../utils/audio'

export type CarPhysicsState = {
  x: number
  z: number
  vx: number
  vz: number
  speed: number
  rotation: number
}

type LetterItem = {
  id: string
  char: string
  geo: TextGeometry
  // Base transform (when standing upright)
  basePos: Vector3
  baseRot: Euler
  // Dynamic physics transform
  pos: Vector3
  rot: Euler
  vel: Vector3
  angVel: Vector3
  state: 'standing' | 'tumbling' | 'settled' | 'rebuilding'
  rebuildTime: number
  rebuildStartPos: Vector3
  rebuildStartRot: Euler
}

interface DestructibleNameProps {
  carPhysics: RefObject<CarPhysicsState>
  onCarImpact?: () => void
}

export default function DestructibleName({ carPhysics, onCarImpact }: DestructibleNameProps) {
  const font = useLoader(FontLoader, '/helvetiker_bold.typeface.json')
  const meshRefs = useRef<(Mesh | null)[]>([])
  const [knockedCount, setKnockedCount] = useState(0)

  // Configuration of the 3D monument
  // Positioned in the scenic open lawn in the South-East quadrant (x: 8.5, z: 8.5)
  // Rotated -45° so it faces directly toward the central intersection
  const monumentCenter = useMemo(() => new Vector3(8.5, 0, 8.5), [])
  const monumentAngle = useMemo(() => -3 * Math.PI / 4, []) // -135 degrees: faces directly toward the road and central intersection

  // Initialize individual 3D letter objects with exact proportional kerning
  // FRONT ROW (seen first from the road): Aymar
  // BACK ROW (stepped up behind/inside): Aviles
  const letters = useMemo(() => {
    const rows = [
      { word: 'Aymar', zOffset: 1.25, yElevation: 0.98, gap: 0.20 },
      { word: 'Aviles', zOffset: -1.25, yElevation: 1.55, gap: 0.20 },
    ]

    const items: LetterItem[] = []
    const rotQ = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), monumentAngle)

    rows.forEach((row) => {
      const chars = row.word.split('')
      // Create geometries and compute exact visual bounding boxes
      const geos = chars.map((char) => {
        const geo = new TextGeometry(char, {
          font,
          size: 1.85,
          depth: 0.52,
          curveSegments: 5,
          bevelEnabled: true,
          bevelThickness: 0.06,
          bevelSize: 0.03,
          bevelSegments: 2,
        })
        geo.center()
        geo.computeBoundingBox()
        return geo
      })

      const widths = geos.map((g) => g.boundingBox!.max.x - g.boundingBox!.min.x)

      // Calculate proportional X offsets so edge-to-edge distance is strictly constant across all letters
      const xOffsets: number[] = [0]
      for (let i = 0; i < chars.length - 1; i++) {
        const step = widths[i] / 2 + row.gap + widths[i + 1] / 2
        xOffsets.push(xOffsets[i] + step)
      }
      const totalSpan = xOffsets[xOffsets.length - 1]
      const centeredX = xOffsets.map((x) => x - totalSpan / 2)

      chars.forEach((char, charIdx) => {
        const geo = geos[charIdx]

        // Calculate world position
        const localPos = new Vector3(centeredX[charIdx], row.yElevation, row.zOffset)
        localPos.applyQuaternion(rotQ)
        const worldPos = localPos.add(monumentCenter)

        const baseRot = new Euler(0, monumentAngle, 0)

        items.push({
          id: `${row.word}-${charIdx}-${char}`,
          char,
          geo,
          basePos: worldPos.clone(),
          baseRot: baseRot.clone(),
          pos: worldPos.clone(),
          rot: baseRot.clone(),
          vel: new Vector3(0, 0, 0),
          angVel: new Vector3(0, 0, 0),
          state: 'standing',
          rebuildTime: 0,
          rebuildStartPos: worldPos.clone(),
          rebuildStartRot: baseRot.clone(),
        })
      })
    })

    return items
  }, [font, monumentCenter, monumentAngle])

  // Function to manually rebuild all collapsed letters
  const rebuildLetters = useCallback(() => {
    let hasKnocked = false
    letters.forEach((letter, i) => {
      if (letter.state !== 'standing') {
        hasKnocked = true
        letter.state = 'rebuilding'
        letter.rebuildTime = -i * 0.06 // Staggered wave rebuild animation
        letter.rebuildStartPos.copy(letter.pos)
        letter.rebuildStartRot.copy(letter.rot)
        letter.vel.set(0, 0, 0)
        letter.angVel.set(0, 0, 0)
      }
    })
    if (hasKnocked) {
      playLetterRebuildSound()
      setKnockedCount(0)
    }
  }, [letters])

  // Physical keyboard "E" shortcut to restore monument
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.code === 'KeyE' || e.key === 'e' || e.key === 'E') && knockedCount > 0) {
        rebuildLetters()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [knockedCount, rebuildLetters])

  // Track time since last knock to auto-rebuild after 18 seconds of inactivity
  const idleTimer = useRef(0)

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.04)
    const car = carPhysics.current
    let newlyKnocked = false

    letters.forEach((letter, idx) => {
      const mesh = meshRefs.current[idx]

      // 1. PRECISE PER-LETTER CAR COLLISION CHECK (Only knock down the exact letter the car hits)
      if (letter.state === 'standing' && car) {
        const worldDx = letter.pos.x - car.x
        const worldDz = letter.pos.z - car.z

        // Transform into car's local heading coordinates
        const forwardX = Math.sin(car.rotation)
        const forwardZ = Math.cos(car.rotation)
        const rightX = Math.cos(car.rotation)
        const rightZ = -Math.sin(car.rotation)

        const localForward = worldDx * forwardX + worldDz * forwardZ
        const localRight = worldDx * rightX + worldDz * rightZ

        // Precise car bounding box adjusted for larger letter dimensions
        const hitForward = Math.abs(localForward) < 1.65
        const hitLateral = Math.abs(localRight) < 0.95

        if (hitForward && hitLateral) {
          newlyKnocked = true
          letter.state = 'tumbling'

          const impactSpeed = Math.max(2.8, Math.abs(car.speed) * 1.5)
          const dist = Math.hypot(worldDx, worldDz) || 1
          const dirX = worldDx / dist
          const dirZ = worldDz / dist

          // Impart linear velocity strictly to this specific letter
          letter.vel.x = (car.vx * 0.8 + dirX * impactSpeed) * 1.15
          letter.vel.z = (car.vz * 0.8 + dirZ * impactSpeed) * 1.15
          letter.vel.y = 2.0 + impactSpeed * 0.4 // Upward kick

          // Impart rotational tumble
          letter.angVel.x = (Math.random() - 0.5) * 10 + dirZ * impactSpeed * 1.6
          letter.angVel.y = (Math.random() - 0.5) * 12
          letter.angVel.z = (Math.random() - 0.5) * 10 - dirX * impactSpeed * 1.6

          playLetterCrashSound(0.85 + Math.random() * 0.35)
          onCarImpact?.()
        }
      }

      // 3. TUMBLING PHYSICS INTEGRATION
      if (letter.state === 'tumbling') {
        // Gravity
        letter.vel.y -= 18.0 * dt

        // Position update
        letter.pos.x += letter.vel.x * dt
        letter.pos.y += letter.vel.y * dt
        letter.pos.z += letter.vel.z * dt

        // Rotation update
        letter.rot.x += letter.angVel.x * dt
        letter.rot.y += letter.angVel.y * dt
        letter.rot.z += letter.angVel.z * dt

        // Ground bounce collision (grass level is y = 0, letter half-height ~0.26m on side)
        const groundY = 0.26
        if (letter.pos.y <= groundY) {
          letter.pos.y = groundY

          // Bouncy rebound if moving fast enough
          if (letter.vel.y < -0.8) {
            letter.vel.y = -letter.vel.y * 0.36
            playLetterCrashSound(1.2 + Math.random() * 0.3)
          } else {
            letter.vel.y = 0
          }

          // Friction on grass
          letter.vel.x *= 0.82
          letter.vel.z *= 0.82
          letter.angVel.x *= 0.78
          letter.angVel.y *= 0.82
          letter.angVel.z *= 0.78

          // Settling condition
          if (
            Math.abs(letter.vel.y) < 0.2 &&
            Math.hypot(letter.vel.x, letter.vel.z) < 0.15 &&
            letter.angVel.length() < 0.25
          ) {
            letter.vel.set(0, 0, 0)
            letter.angVel.set(0, 0, 0)
            letter.state = 'settled'
          }
        }
      }

      // 4. REBUILD ANIMATION (Smooth elastic spring back to upright position)
      if (letter.state === 'rebuilding') {
        letter.rebuildTime += dt
        if (letter.rebuildTime > 0) {
          const t = Math.min(1, letter.rebuildTime / 0.65)
          // Elastic ease-out curve
          const ease = Math.sin((t * Math.PI) / 2)
          const hop = Math.sin(t * Math.PI) * 0.85

          letter.pos.x = letter.rebuildStartPos.x + (letter.basePos.x - letter.rebuildStartPos.x) * ease
          letter.pos.z = letter.rebuildStartPos.z + (letter.basePos.z - letter.rebuildStartPos.z) * ease
          letter.pos.y = letter.rebuildStartPos.y + (letter.basePos.y - letter.rebuildStartPos.y) * ease + hop

          letter.rot.x = letter.rebuildStartRot.x + (letter.baseRot.x - letter.rebuildStartRot.x) * ease
          letter.rot.y = letter.rebuildStartRot.y + (letter.baseRot.y - letter.rebuildStartRot.y) * ease
          letter.rot.z = letter.rebuildStartRot.z + (letter.baseRot.z - letter.rebuildStartRot.z) * ease

          if (t >= 1) {
            letter.pos.copy(letter.basePos)
            letter.rot.copy(letter.baseRot)
            letter.state = 'standing'
          }
        }
      }

      // Apply transforms to Three.js mesh
      if (mesh) {
        mesh.position.copy(letter.pos)
        mesh.rotation.copy(letter.rot)
      }
    })

    // Count currently fallen letters
    const currentKnocked = letters.filter((l) => l.state !== 'standing').length
    if (newlyKnocked || currentKnocked !== knockedCount) {
      setKnockedCount(currentKnocked)
      idleTimer.current = 0
    } else if (currentKnocked > 0) {
      idleTimer.current += dt
      // Automatically rebuild after 16 seconds if untouched
      if (idleTimer.current > 16.0) {
        rebuildLetters()
        idleTimer.current = 0
      }
    }
  })

  return (
    <group>
      {/* Terraced stone garden plaza under the sign */}
      <group position={[monumentCenter.x, 0.012, monumentCenter.z]} rotation={[0, monumentAngle, 0]}>
        {/* Main ground bed */}
        <mesh position={[0, 0, 0]} receiveShadow>
          <boxGeometry args={[11.6, 0.03, 5.8]} />
          <meshStandardMaterial color="#c5bfae" roughness={0.72} />
        </mesh>
        {/* Front terrace for "Aymar" */}
        <mesh position={[0, 0.02, 1.25]} receiveShadow>
          <boxGeometry args={[10.4, 0.04, 2.1]} />
          <meshStandardMaterial color="#a8b297" roughness={0.78} />
        </mesh>
        {/* Elevated back terrace for "Aviles" */}
        <mesh position={[0, 0.22, -1.25]} receiveShadow>
          <boxGeometry args={[11.2, 0.44, 2.1]} />
          <meshStandardMaterial color="#8e987c" roughness={0.80} />
        </mesh>
      </group>

      {/* Individual 3D Interactive Destructible Letters */}
      {letters.map((letter, i) => (
        <mesh
          key={letter.id}
          ref={(el) => {
            meshRefs.current[i] = el
          }}
          geometry={letter.geo}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color={i < 5 ? '#f59e0b' : '#fbbf24'} // Vibrant golden amber gradient
            roughness={0.22}
            metalness={0.35}
          />
        </mesh>
      ))}

      {/* Floating 3D Badge: ONLY visible when letters are knocked down! */}
      {knockedCount > 0 && (
        <Html position={[monumentCenter.x, 3.8, monumentCenter.z]} center distanceFactor={18} zIndexRange={[6, 0]}>
          <div
            className="monument-restore-badge"
            onClick={rebuildLetters}
            role="button"
            tabIndex={0}
            title="Pulsa E para restaurar las letras"
          >
            <kbd className="restore-key">E</kbd>
            <div className="restore-copy">
              <strong>RESTAURAR MONUMENTO</strong>
              <small>{knockedCount} {knockedCount === 1 ? 'letra caída' : 'letras caídas'} · Pulsa [E]</small>
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}
