import { useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import { Group, Mesh, Vector3, Euler } from 'three'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { playLetterCrashSound } from '../utils/audio'
import type { CarPhysicsState } from './DestructibleName'

export type TrafficPropItem = {
  id: string
  kind: 'stop' | 'street' | 'traffic-light'
  scale: number
  // Initial spawn
  basePos: Vector3
  baseRot: Euler
  // Dynamic physics state
  pos: Vector3
  rot: Euler
  vel: Vector3
  angVel: Vector3
  hitRadius: number
  groundY: number
  state: 'standing' | 'tumbling' | 'settled'
}

interface DestructibleTrafficPropsProps {
  carPhysics: RefObject<CarPhysicsState>
}

export default function DestructibleTrafficProps({ carPhysics }: DestructibleTrafficPropsProps) {
  // Load the 3 distinct 3D traffic prop models
  const { scene: stopScene } = useGLTF('/models/city-roads/road-sign-stop.glb')
  const { scene: streetScene } = useGLTF('/models/city-roads/road-sign-street.glb')
  const { scene: trafficScene } = useGLTF('/models/city-roads/traffic-light.glb')

  const groupRefs = useRef<(Group | null)[]>([])

  // Define the 8 destructible traffic signs and signals at their exact city coordinates
  const propsList = useMemo<TrafficPropItem[]>(() => {
    const rawConfigs: {
      id: string
      kind: 'stop' | 'street' | 'traffic-light'
      pos: [number, number, number]
      rot: [number, number, number]
      scale: number
      hitRadius: number
      groundY: number
    }[] = [
      // 1. Stop Signs at central intersections
      { id: 'stop-north', kind: 'stop', pos: [1.85, 0, -2.4], rot: [0, -Math.PI / 2, 0], scale: 1.1, hitRadius: 0.32, groundY: 0.08 },
      { id: 'stop-south', kind: 'stop', pos: [-1.85, 0, 2.4], rot: [0, Math.PI / 2, 0], scale: 1.1, hitRadius: 0.32, groundY: 0.08 },

      // 2. Street Name Signs
      { id: 'street-ne', kind: 'street', pos: [2.2, 0, -2.2], rot: [0, 0, 0], scale: 1.15, hitRadius: 0.32, groundY: 0.09 },
      { id: 'street-sw', kind: 'street', pos: [-2.2, 0, 2.2], rot: [0, Math.PI, 0], scale: 1.15, hitRadius: 0.32, groundY: 0.09 },
      { id: 'street-nw', kind: 'street', pos: [-2.2, 0, -2.2], rot: [0, -Math.PI / 2, 0], scale: 1.15, hitRadius: 0.32, groundY: 0.09 },
      { id: 'street-se', kind: 'street', pos: [2.2, 0, 2.2], rot: [0, Math.PI, 0], scale: 1.15, hitRadius: 0.32, groundY: 0.09 },

      // 3. Traffic Lights
      { id: 'traffic-ne', kind: 'traffic-light', pos: [1.7, 0, -1.7], rot: [0, 0, 0], scale: 1.2, hitRadius: 0.40, groundY: 0.14 },
      { id: 'traffic-sw', kind: 'traffic-light', pos: [-1.7, 0, 1.7], rot: [0, Math.PI, 0], scale: 1.2, hitRadius: 0.40, groundY: 0.14 },
    ]

    return rawConfigs.map((cfg) => {
      const basePos = new Vector3(...cfg.pos)
      const baseRot = new Euler(...cfg.rot)
      return {
        id: cfg.id,
        kind: cfg.kind,
        scale: cfg.scale,
        basePos: basePos.clone(),
        baseRot: baseRot.clone(),
        pos: basePos.clone(),
        rot: baseRot.clone(),
        vel: new Vector3(0, 0, 0),
        angVel: new Vector3(0, 0, 0),
        hitRadius: cfg.hitRadius,
        groundY: cfg.groundY,
        state: 'standing',
      }
    })
  }, [])

  // Clone and configure 3D models with shadows and fine materials
  const clonedModels = useMemo(() => {
    return propsList.map((item) => {
      const template =
        item.kind === 'stop' ? stopScene : item.kind === 'street' ? streetScene : trafficScene
      const instance = template.clone(true)
      instance.traverse((obj) => {
        if (obj instanceof Mesh) {
          obj.castShadow = true
          obj.receiveShadow = true
          if (obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
            mats.forEach((m) => {
              if ('roughness' in m) {
                m.roughness = Math.min(0.78, Math.max(0.35, (m.roughness ?? 0.7) * 0.9))
              }
            })
          }
        }
      })
      return instance
    })
  }, [propsList, stopScene, streetScene, trafficScene])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.04)
    const car = carPhysics.current

    propsList.forEach((prop, idx) => {
      const group = groupRefs.current[idx]

      // 1. CAR IMPACT DETECTION (Triggers knock-down when car hits the prop)
      if (prop.state === 'standing' && car) {
        const worldDx = prop.pos.x - car.x
        const worldDz = prop.pos.z - car.z

        // Transform into car's local heading coordinates
        const forwardX = Math.sin(car.rotation)
        const forwardZ = Math.cos(car.rotation)
        const rightX = Math.cos(car.rotation)
        const rightZ = -Math.sin(car.rotation)

        const localForward = worldDx * forwardX + worldDz * forwardZ
        const localRight = worldDx * rightX + worldDz * rightZ

        // Car bounding box check + prop radius
        const hitForward = Math.abs(localForward) < 1.05 + prop.hitRadius
        const hitLateral = Math.abs(localRight) < 0.52 + prop.hitRadius

        if (hitForward && hitLateral) {
          prop.state = 'tumbling'

          const impactSpeed = Math.max(3.0, Math.abs(car.speed) * 1.5)
          const dist = Math.hypot(worldDx, worldDz) || 1
          const dirX = worldDx / dist
          const dirZ = worldDz / dist

          // Impart linear momentum in the direction the car is traveling
          prop.vel.x = (car.vx * 0.95 + dirX * impactSpeed * 0.8) * 1.2
          prop.vel.z = (car.vz * 0.95 + dirZ * impactSpeed * 0.8) * 1.2
          prop.vel.y = 2.4 + impactSpeed * 0.38 // Upward launch

          // Impart tipping angular velocity (post tilts violently forward/sideways)
          prop.angVel.x = (Math.random() - 0.5) * 8 + dirZ * impactSpeed * 2.2
          prop.angVel.y = (Math.random() - 0.5) * 10
          prop.angVel.z = (Math.random() - 0.5) * 8 - dirX * impactSpeed * 2.2

          // Play metal impact crunch / clatter sound
          playLetterCrashSound(1.15 + Math.random() * 0.35)
        }
      }

      // 2. TUMBLING DYNAMICS (Gravity, parabolic flight, and ground bounce)
      if (prop.state === 'tumbling') {
        // Gravity
        prop.vel.y -= 22.0 * dt

        // Position update
        prop.pos.x += prop.vel.x * dt
        prop.pos.y += prop.vel.y * dt
        prop.pos.z += prop.vel.z * dt

        // Rotation update
        prop.rot.x += prop.angVel.x * dt
        prop.rot.y += prop.angVel.y * dt
        prop.rot.z += prop.angVel.z * dt

        // Ground collision (asphalt / grass level)
        if (prop.pos.y <= prop.groundY) {
          prop.pos.y = prop.groundY

          // Rebound if hitting hard
          if (prop.vel.y < -0.8) {
            prop.vel.y = -prop.vel.y * 0.28
            playLetterCrashSound(1.4 + Math.random() * 0.25)
          } else {
            prop.vel.y = 0
          }

          // Friction on ground
          prop.vel.x *= 0.78
          prop.vel.z *= 0.78
          prop.angVel.x *= 0.72
          prop.angVel.y *= 0.78
          prop.angVel.z *= 0.72

          // Settling condition: comes to complete stop lying on the ground
          if (
            Math.abs(prop.vel.y) < 0.15 &&
            Math.hypot(prop.vel.x, prop.vel.z) < 0.12 &&
            prop.angVel.length() < 0.20
          ) {
            prop.vel.set(0, 0, 0)
            prop.angVel.set(0, 0, 0)
            // Once settled, it stays knocked down on the floor permanently!
            prop.state = 'settled'
          }
        }
      }

      // Synchronize 3D object transform
      if (group) {
        group.position.copy(prop.pos)
        group.rotation.copy(prop.rot)
      }
    })
  })

  return (
    <group name="destructible-traffic-props">
      {propsList.map((prop, idx) => (
        <group
          key={prop.id}
          ref={(el) => {
            groupRefs.current[idx] = el
          }}
          position={prop.basePos}
          rotation={prop.baseRot}
          scale={prop.scale}
        >
          <primitive object={clonedModels[idx]} dispose={null} />
        </group>
      ))}
    </group>
  )
}

useGLTF.preload('/models/city-roads/road-sign-stop.glb')
useGLTF.preload('/models/city-roads/road-sign-street.glb')
useGLTF.preload('/models/city-roads/traffic-light.glb')
