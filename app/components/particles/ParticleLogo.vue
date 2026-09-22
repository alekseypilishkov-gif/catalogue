<script setup lang="ts">
import type * as THREE from 'three'

interface PointData {
  name: string
  count: number
  positions: Array<{ x: number, y: number, z: number }>
}

const canvas = ref<HTMLCanvasElement | null>(null)
const asset = useAssetUrl()
const isDebugPanelOpen = ref(true)
const cameraView = ref<'front' | 'perspective'>('front')
const settings = reactive({
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  scale: 1,
  cameraDistance: 1.2,
  pointSize: 0.006,
  opacity: 0.72,
  showAxes: false,
  showGrid: false,
})

let renderer: THREE.WebGLRenderer | undefined
let scene: THREE.Scene | undefined
let camera: THREE.PerspectiveCamera | undefined
let geometry: THREE.BufferGeometry | undefined
let material: THREE.PointsMaterial | undefined
let resizeObserver: ResizeObserver | undefined
let points: THREE.Points | undefined
let axesHelper: THREE.AxesHelper | undefined
let gridHelper: THREE.GridHelper | undefined

/** Keeps the final logo coordinates ready for a future current-to-target morph. */
let currentPositions: Float32Array | undefined
let targetPositions: Float32Array | undefined

function render() {
  if (renderer && scene && camera) renderer.render(scene, camera)
}

function updateCamera() {
  if (!camera) return

  const { cameraDistance } = settings
  camera.up.set(0, 0, 1)
  if (cameraView.value === 'front') {
    camera.position.set(0, cameraDistance, 0.22)
  } else {
    camera.position.set(cameraDistance * 0.58, cameraDistance, 0.22 + cameraDistance * 0.46)
  }
  camera.lookAt(0, 0, 0.22)
}

function applySettings() {
  if (points) {
    points.rotation.set(settings.rotationX, settings.rotationY, settings.rotationZ)
    points.scale.setScalar(settings.scale)
  }
  if (material) {
    material.size = settings.pointSize
    material.opacity = settings.opacity
    material.needsUpdate = true
  }
  if (axesHelper) axesHelper.visible = settings.showAxes
  if (gridHelper) gridHelper.visible = settings.showGrid
  updateCamera()
  render()
}

function setCameraView(view: 'front' | 'perspective') {
  cameraView.value = view
  applySettings()
}

watch(settings, applySettings, { deep: true })

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
  points = undefined
  axesHelper = undefined
  gridHelper = undefined
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
  updateCamera()

  geometry = new three.BufferGeometry()
  geometry.setAttribute('position', new three.BufferAttribute(currentPositions, 3))
  material = new three.PointsMaterial({
    color: '#d7ffff',
    size: settings.pointSize,
    sizeAttenuation: true,
    transparent: true,
    opacity: settings.opacity,
    depthWrite: false,
  })
  points = new three.Points(geometry, material)
  scene.add(points)

  axesHelper = new three.AxesHelper(0.35)
  axesHelper.position.set(-0.5, 0, 0)
  axesHelper.visible = settings.showAxes
  scene.add(axesHelper)

  gridHelper = new three.GridHelper(1.2, 12, 0x5ad6d2, 0x315b5a)
  gridHelper.position.set(0, 0, 0.22)
  gridHelper.visible = settings.showGrid
  scene.add(gridHelper)

  renderer = new three.WebGLRenderer({ canvas: canvas.value, alpha: true, antialias: false, powerPreference: 'high-performance' })
  renderer.setClearColor(0x000000, 0)

  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(canvas.value)
  applySettings()
  resize()
})

onBeforeUnmount(dispose)
</script>

<template>
  <div class="particle-logo-root">
    <canvas ref="canvas" class="particle-logo" aria-hidden="true" />
    <Teleport to="body">
      <section class="particle-debug" :class="{ 'is-open': isDebugPanelOpen }" aria-label="Particle logo debug controls">
        <button class="particle-debug__toggle" type="button" :aria-expanded="isDebugPanelOpen" @click="isDebugPanelOpen = !isDebugPanelOpen">
          {{ isDebugPanelOpen ? 'Hide particle controls' : 'Particle controls' }}
        </button>
        <div v-if="isDebugPanelOpen" class="particle-debug__panel">
        <div class="particle-debug__group">
          <h2>Transform</h2>
          <label>Rotation X <output>{{ settings.rotationX.toFixed(2) }}</output><input v-model.number="settings.rotationX" type="range" min="-3.14" max="3.14" step="0.01" /></label>
          <label>Rotation Y <output>{{ settings.rotationY.toFixed(2) }}</output><input v-model.number="settings.rotationY" type="range" min="-3.14" max="3.14" step="0.01" /></label>
          <label>Rotation Z <output>{{ settings.rotationZ.toFixed(2) }}</output><input v-model.number="settings.rotationZ" type="range" min="-3.14" max="3.14" step="0.01" /></label>
          <label>Scale <output>{{ settings.scale.toFixed(2) }}</output><input v-model.number="settings.scale" type="range" min="0.25" max="2" step="0.01" /></label>
        </div>
        <div class="particle-debug__group">
          <h2>Camera</h2>
          <label>Distance <output>{{ settings.cameraDistance.toFixed(2) }}</output><input v-model.number="settings.cameraDistance" type="range" min="0.5" max="3" step="0.01" /></label>
          <div class="particle-debug__actions"><button type="button" :class="{ 'is-active': cameraView === 'front' }" @click="setCameraView('front')">Front view</button><button type="button" :class="{ 'is-active': cameraView === 'perspective' }" @click="setCameraView('perspective')">Perspective view</button></div>
        </div>
        <div class="particle-debug__group">
          <h2>Particles</h2>
          <label>Point size <output>{{ settings.pointSize.toFixed(3) }}</output><input v-model.number="settings.pointSize" type="range" min="0.001" max="0.02" step="0.001" /></label>
          <label>Opacity <output>{{ settings.opacity.toFixed(2) }}</output><input v-model.number="settings.opacity" type="range" min="0.05" max="1" step="0.01" /></label>
        </div>
        <div class="particle-debug__group particle-debug__switches">
          <h2>Debug</h2>
          <label><input v-model="settings.showAxes" type="checkbox" /> Show XYZ axes</label>
          <label><input v-model="settings.showGrid" type="checkbox" /> Show grid</label>
        </div>
        </div>
      </section>
    </Teleport>
  </div>
</template>

<style scoped>
.particle-logo-root { width: 100%; height: 100%; }
.particle-logo { display: block; width: 100%; height: 100%; pointer-events: none; user-select: none; }
.particle-debug { position: fixed; z-index: 20; bottom: 16px; left: 16px; width: min(310px, calc(100vw - 32px)); color: #e8f5f5; font: 12px/1.35 Arial, sans-serif; }
.particle-debug__toggle { width: 100%; padding: 10px 12px; border: 1px solid rgb(157 235 231 / 42%); border-radius: 8px; background: rgb(20 29 30 / 92%); color: inherit; text-align: left; text-transform: uppercase; letter-spacing: .08em; cursor: pointer; }
.particle-debug__panel { display: grid; gap: 12px; max-height: min(72vh, 680px); margin-top: 8px; padding: 12px; overflow-y: auto; border: 1px solid rgb(157 235 231 / 30%); border-radius: 8px; background: rgb(20 29 30 / 94%); box-shadow: 0 10px 30px rgb(0 0 0 / 28%); }
.particle-debug__group { display: grid; gap: 7px; }
.particle-debug h2 { margin: 0; color: #9debe7; font-size: 10px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; }
.particle-debug label { display: grid; grid-template-columns: 1fr auto; gap: 5px 8px; align-items: center; }
.particle-debug output { color: #9debe7; font-variant-numeric: tabular-nums; }
.particle-debug input[type='range'] { grid-column: 1 / -1; width: 100%; accent-color: #9debe7; }
.particle-debug__actions { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.particle-debug__actions button { padding: 6px; border: 1px solid rgb(157 235 231 / 35%); border-radius: 4px; background: transparent; color: inherit; cursor: pointer; }
.particle-debug__actions button.is-active { background: rgb(157 235 231 / 20%); border-color: #9debe7; }
.particle-debug__switches label { grid-template-columns: auto 1fr; justify-content: start; }
.particle-debug__switches input { accent-color: #9debe7; }
@media (max-width: 599px) { .particle-debug { bottom: 8px; left: 8px; width: min(290px, calc(100vw - 16px)); } }
</style>
