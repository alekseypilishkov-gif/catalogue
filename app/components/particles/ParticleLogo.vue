<script setup lang="ts">
import type * as THREE from 'three'

interface PointData {
  name: string
  count: number
  positions: Array<{ x: number, y: number, z: number }>
}

const canvas = ref<HTMLCanvasElement | null>(null)
const asset = useAssetUrl()

let renderer: THREE.WebGLRenderer | undefined
let scene: THREE.Scene | undefined
let camera: THREE.PerspectiveCamera | undefined
let geometry: THREE.BufferGeometry | undefined
let material: THREE.PointsMaterial | undefined
let resizeObserver: ResizeObserver | undefined

/** Keeps the final logo coordinates ready for a future current-to-target morph. */
let currentPositions: Float32Array | undefined
let targetPositions: Float32Array | undefined

function render() {
  if (renderer && scene && camera) renderer.render(scene, camera)
}

function resize() {
  if (!canvas.value || !renderer || !camera) return

  const { width, height } = canvas.value.getBoundingClientRect()
  if (!width || !height) return

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  render()
}

function dispose() {
  resizeObserver?.disconnect()
  resizeObserver = undefined
  geometry?.dispose()
  material?.dispose()
  renderer?.dispose()
  renderer = undefined
  scene = undefined
  camera = undefined
  geometry = undefined
  material = undefined
  currentPositions = undefined
  targetPositions = undefined
}

onMounted(async () => {
  if (!canvas.value) return

  const [three, response] = await Promise.all([
    import('three'),
    fetch(asset('particles/ld_logo_points.json')),
  ])
  if (!response.ok) throw new Error(`Unable to load LD logo particle data: ${response.status}`)
  const data = await response.json() as PointData

  targetPositions = new Float32Array(data.positions.length * 3)
  data.positions.forEach(({ x, y, z }, index) => {
    const offset = index * 3
    targetPositions![offset] = x
    targetPositions![offset + 1] = y
    targetPositions![offset + 2] = z
  })
  currentPositions = targetPositions.slice()

  scene = new three.Scene()
  camera = new three.PerspectiveCamera(40, 1, 0.1, 10)
  camera.position.set(0, 1.2, 0.22)
  camera.up.set(0, 0, 1)
  camera.lookAt(0, 0, 0.22)

  geometry = new three.BufferGeometry()
  geometry.setAttribute('position', new three.BufferAttribute(currentPositions, 3))
  material = new three.PointsMaterial({
    color: '#d7ffff',
    size: 0.006,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  })
  scene.add(new three.Points(geometry, material))

  renderer = new three.WebGLRenderer({ canvas: canvas.value, alpha: true, antialias: false, powerPreference: 'high-performance' })
  renderer.setClearColor(0x000000, 0)

  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(canvas.value)
  resize()
})

onBeforeUnmount(dispose)
</script>

<template>
  <canvas ref="canvas" class="particle-logo" aria-hidden="true" />
</template>

<style scoped>
.particle-logo { display: block; width: 100%; height: 100%; pointer-events: none; user-select: none; }
</style>
