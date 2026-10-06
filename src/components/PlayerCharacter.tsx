import { useEffect, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import { Group, Mesh, Vector3 } from 'three'
import { useFrame } from '@react-three/fiber'
import { useFBX } from '@react-three/drei'
import { resolveCarCollisions } from './OpenWorld'

export interface CharacterPhysicsState {
  x: number
  z: number
  rotation: number
  isWalking: boolean
  speed: number
}

interface PlayerCharacterProps {
  active: boolean // true when on foot, false when inside car
  spawnPos: { x: number; z: number; rotation: number }
  controlState: RefObject<{ forward: boolean; back: boolean; left: boolean; right: boolean; throttle?: number; steering?: number }>
  cameraOrbit: RefObject<{ yaw: number; elevation: number; radius: number; targetRadius: number; isManual?: boolean; lastManualTime?: number }>
  physicsState: RefObject<CharacterPhysicsState>
  carPos: { x: number; z: number }
  onEnterVehiclePrompt?: (canEnter: boolean) => void
}

export default function PlayerCharacter({
  active,
  spawnPos,
  controlState,
  cameraOrbit,
  physicsState,
  carPos,
  onEnterVehiclePrompt,
}: PlayerCharacterProps) {
  const groupRef = useRef<Group>(null)
  const pos = useRef(new Vector3(spawnPos.x, 0, spawnPos.z))
  const rotation = useRef(spawnPos.rotation)
  const animTime = useRef(0)

  // Load the character model
  const rawFbx = useFBX('/sport_w_01_warmup.fbx')

  // Clone and optimize character model
  const characterModel = useMemo(() => {
    const clone = rawFbx.clone(true)
    // Scale character to realistic human height (~1.72m)
    // Sport model is in cm (100 units = 1m) or standard units
    clone.scale.set(0.0165, 0.0165, 0.0165)
    clone.traverse((child) => {
      if (child instanceof Mesh) {
        child.castShadow = true
        child.receiveShadow = false
      }
    })
    return clone
  }, [rawFbx])

  // Sync position on toggle
  useEffect(() => {
    if (active) {
      pos.current.set(spawnPos.x, 0, spawnPos.z)
      rotation.current = spawnPos.rotation
      if (groupRef.current) {
        groupRef.current.position.set(spawnPos.x, 0, spawnPos.z)
        groupRef.current.rotation.y = spawnPos.rotation
      }
    }
  }, [active, spawnPos])

  useFrame((state, delta) => {
    if (!groupRef.current) return
    const dt = Math.min(delta, 0.05)

    if (!active) {
      // Invisible/hidden when driving inside car
      groupRef.current.visible = false
      return
    }

    groupRef.current.visible = true

    // Controls
    const { forward, back, left, right, throttle = 0, steering = 0 } = controlState.current || {}
    let inputY = throttle
    if (Math.abs(inputY) < 0.04) {
      if (forward) inputY = 1
      else if (back) inputY = -1
      else inputY = 0
    }

    let inputX = steering
    if (Math.abs(inputX) < 0.04) {
      inputX = Number(right) - Number(left)
    }

    // Camera relative movement
    const orbit = cameraOrbit.current
    const camYaw = orbit.yaw
    const moveSpeed = 4.2 // Human walking/jogging speed: 4.2 m/s

    const isMoving = Math.abs(inputX) > 0.05 || Math.abs(inputY) > 0.05
    let currentSpeed = 0

    if (isMoving) {
      // Direction in camera space
      const moveAngle = Math.atan2(inputX, inputY)
      const worldMoveAngle = camYaw + moveAngle

      // Smooth rotate character towards walking direction
      const diff = worldMoveAngle - rotation.current
      const normDiff = Math.atan2(Math.sin(diff), Math.cos(diff))
      rotation.current += normDiff * Math.min(1, dt * 14)

      currentSpeed = moveSpeed * Math.hypot(inputX, inputY)
      const vx = Math.sin(worldMoveAngle) * currentSpeed
      const vz = Math.cos(worldMoveAngle) * currentSpeed

      const targetX = pos.current.x + vx * dt
      const targetZ = pos.current.z + vz * dt

      // Collision with solid obstacles in the city
      const collision = resolveCarCollisions(targetX, targetZ)
      pos.current.x = collision.x
      pos.current.z = collision.z

      animTime.current += dt * (currentSpeed * 2.5)
    }

    // Natural subtle breathing bobbing or walking bounce
    const bob = isMoving ? Math.sin(animTime.current * 4) * 0.04 : Math.sin(state.clock.getElapsedTime() * 2) * 0.008
    groupRef.current.position.set(pos.current.x, bob, pos.current.z)
    groupRef.current.rotation.y = rotation.current

    // Update physics state ref
    if (physicsState.current) {
      physicsState.current.x = pos.current.x
      physicsState.current.z = pos.current.z
      physicsState.current.rotation = rotation.current
      physicsState.current.isWalking = isMoving
      physicsState.current.speed = currentSpeed
    }

    // Camera follows player when on foot
    orbit.radius += (orbit.targetRadius - orbit.radius) * Math.min(1, dt * 10)
    const effRadius = Math.max(3.5, Math.min(8.0, orbit.radius * 0.58))
    const effElevation = Math.max(0.22, orbit.elevation * 0.9)

    const behind = new Vector3(
      Math.sin(camYaw) * effRadius * Math.cos(effElevation),
      effRadius * Math.sin(effElevation) + 1.2,
      Math.cos(camYaw) * effRadius * Math.cos(effElevation)
    )
    const targetCam = new Vector3(pos.current.x, 0, pos.current.z).add(behind)
    state.camera.position.lerp(targetCam, 1 - Math.pow(0.001, dt))
    state.camera.lookAt(pos.current.x, 1.25, pos.current.z)

    // Check distance to car for "Enter Car" prompt
    const distToCar = Math.hypot(pos.current.x - carPos.x, pos.current.z - carPos.z)
    if (onEnterVehiclePrompt) {
      onEnterVehiclePrompt(distToCar < 3.2)
    }
  })

  return (
    <group ref={groupRef}>
      <primitive object={characterModel} />
    </group>
  )
}
