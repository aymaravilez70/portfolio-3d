import { useEffect, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import { Group, Mesh, Vector3 } from 'three'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
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
  const currentAction = useRef<string>('idle')

  // Load animated GLTF character model with skeletal clips (idle, walk, run)
  const { scene, animations } = useGLTF('/models/character.glb')
  const { actions } = useAnimations(animations, groupRef)

  // Configure shadows and materials on the character mesh
  useMemo(() => {
    scene.traverse((child) => {
      if (child instanceof Mesh) {
        child.castShadow = true
        child.receiveShadow = false
      }
    })
  }, [scene])

  // Sync position on vehicle exit
  useEffect(() => {
    if (active) {
      pos.current.set(spawnPos.x, 0, spawnPos.z)
      rotation.current = spawnPos.rotation
      if (groupRef.current) {
        groupRef.current.position.set(spawnPos.x, 0, spawnPos.z)
        groupRef.current.rotation.y = spawnPos.rotation
      }
      // Start with idle animation immediately
      if (actions.idle) {
        actions.idle.reset().fadeIn(0.15).play()
        currentAction.current = 'idle'
      }
    } else {
      // Fade out all actions when entering car
      Object.values(actions).forEach((act) => act?.fadeOut(0.2))
    }
  }, [active, spawnPos, actions])

  useFrame((state, delta) => {
    if (!groupRef.current) return
    const dt = Math.min(delta, 0.05)

    // Hidden when inside car
    if (!active) {
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
    const moveSpeed = 3.6 // Realistic walking speed: 3.6 m/s (~13 km/h)

    const isMoving = Math.abs(inputX) > 0.05 || Math.abs(inputY) > 0.05
    let currentSpeed = 0

    if (isMoving) {
      // Direction relative to camera:
      // When inputY > 0 (W / Forward): moves straight away from the camera looking direction
      // When inputY < 0 (S / Backward): moves toward the camera
      // When inputX > 0 (D / Right): moves to the camera's right
      // When inputX < 0 (A / Left): moves to the camera's left
      const forwardX = -Math.sin(camYaw)
      const forwardZ = -Math.cos(camYaw)
      const rightX = Math.cos(camYaw)
      const rightZ = -Math.sin(camYaw)

      let moveDirX = forwardX * inputY + rightX * inputX
      let moveDirZ = forwardZ * inputY + rightZ * inputX
      const mag = Math.hypot(moveDirX, moveDirZ)
      if (mag > 0.001) {
        moveDirX /= mag
        moveDirZ /= mag
      }

      // Exact facing angle:
      // The 3D model in Three.js faces towards +Z by default.
      // To face the movement vector (moveDirX, moveDirZ), the yaw angle is Math.atan2(moveDirX, moveDirZ).
      const targetAngle = Math.atan2(moveDirX, moveDirZ)
      const diff = targetAngle - rotation.current
      const normDiff = Math.atan2(Math.sin(diff), Math.cos(diff))
      rotation.current += normDiff * Math.min(1, dt * 14)

      currentSpeed = moveSpeed * Math.min(1, Math.hypot(inputX, inputY))
      const vx = moveDirX * currentSpeed
      const vz = moveDirZ * currentSpeed

      const targetX = pos.current.x + vx * dt
      const targetZ = pos.current.z + vz * dt

      // Collision with solid obstacles in the city
      const collision = resolveCarCollisions(targetX, targetZ)
      pos.current.x = collision.x
      pos.current.z = collision.z
    }

    // Play smooth walking vs idle skeletal animations
    const targetAction = isMoving ? 'walk' : 'idle'
    if (currentAction.current !== targetAction) {
      const prev = actions[currentAction.current]
      const next = actions[targetAction]
      if (prev && next) {
        prev.fadeOut(0.2)
        next.reset().fadeIn(0.2).play()
        currentAction.current = targetAction
      } else if (next) {
        next.reset().fadeIn(0.2).play()
        currentAction.current = targetAction
      }
    } else {
      // Ensure the active animation is currently playing (prevents T-pose if action was paused/not started)
      const current = actions[currentAction.current]
      if (current && !current.isRunning()) {
        current.play()
      }
    }

    // Scale walk animation playback speed to movement speed
    if (actions.walk && isMoving) {
      actions.walk.timeScale = 1.15
    }

    groupRef.current.position.set(pos.current.x, 0, pos.current.z)
    groupRef.current.rotation.y = rotation.current

    // Update physics state ref
    if (physicsState.current) {
      physicsState.current.x = pos.current.x
      physicsState.current.z = pos.current.z
      physicsState.current.rotation = rotation.current
      physicsState.current.isWalking = isMoving
      physicsState.current.speed = currentSpeed
    }

    // Third-person camera follow
    orbit.radius += (orbit.targetRadius - orbit.radius) * Math.min(1, dt * 10)
    const effRadius = Math.max(3.0, Math.min(6.5, orbit.radius * 0.48))
    const effElevation = Math.max(0.22, orbit.elevation * 0.9)

    const behind = new Vector3(
      Math.sin(camYaw) * effRadius * Math.cos(effElevation),
      effRadius * Math.sin(effElevation) + 1.05,
      Math.cos(camYaw) * effRadius * Math.cos(effElevation)
    )
    const targetCam = new Vector3(pos.current.x, 0, pos.current.z).add(behind)
    state.camera.position.lerp(targetCam, 1 - Math.pow(0.001, dt))
    state.camera.lookAt(pos.current.x, 0.95, pos.current.z)

    // Check distance to car for "Enter Car" prompt
    const distToCar = Math.hypot(pos.current.x - carPos.x, pos.current.z - carPos.z)
    if (onEnterVehiclePrompt) {
      onEnterVehiclePrompt(distToCar < 3.2)
    }
  })

  return (
    <group ref={groupRef} visible={active}>
      {/* Scaled to human proportion (~1.08m matching vehicle scale 0.48) */}
      <primitive object={scene} scale={0.60} />
    </group>
  )
}

useGLTF.preload('/models/character.glb')
