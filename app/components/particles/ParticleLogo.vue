<script setup lang="ts">
import type * as THREE from 'three'

interface PointData {
  name: string
  count: number
  positions: Array<{ x: number, y: number, z: number }>
}

const emit = defineEmits<{
  introStart: [reducedMotion: boolean]
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
const asset = useAssetUrl()
const isDebugPanelOpen = ref(false)
const cameraView = ref<'front' | 'perspective'>('front')
const settings = reactive({
  rotationX: 0,
  rotationY: 0,
  rotationZ: 2.77,
  scale: 1,
  verticalOffset: 0,
  cameraFov: 42,
  cameraDistance: 1.2,
  pointSize: 0.006,
  sizeAttenuation: 1.15,
  logoDepthSpread: 0.045,
  ambientDepthSpread: 0.38,
  particleSizeVariation: 0.7,
  opacity: 0.68,
  logoBrightness: 1,
  introDuration: 1.45,
  flowStrength: 0.24,
  turbulenceStrength: 0.055,
  idleStrength: 0.002,
  cursorTiltStrength: 0.025,
  ambientVisible: true,
  cardHoverGlowSize: 397.4,
  cardHoverGlowOpacity: 1,
  cardHoverGlowIntensity: 1,
  cardHoverGlowScale: 1,
  cardHoverFollow: 0.14,
  showAxes: false,
  showGrid: false,
})

const logoVertexShader = `
  attribute vec3 startPosition;
  attribute vec3 randomSeed;
  attribute float phase;
  attribute float delay;
  attribute float sizeVariation;

  uniform float uTime;
  uniform float uIntroProgress;
  uniform float uFlowStrength;
  uniform float uTurbulenceStrength;
  uniform float uIdleStrength;
  uniform float uPointSize;
  uniform float uViewportHeight;
  uniform float uSizeAttenuation;
  uniform float uLogoDepthSpread;
  uniform float uSizeVariation;

  varying float vDepthBrightness;

  float easeOutCubic(float value) {
    float inverse = 1.0 - value;
    return 1.0 - inverse * inverse * inverse;
  }

  void main() {
    float localProgress = clamp((uIntroProgress - delay) / max(0.001, 1.0 - delay), 0.0, 1.0);
    float easedProgress = easeOutCubic(localProgress);
    float flowWindow = sin(localProgress * 3.14159265) * (1.0 - localProgress * 0.25);
    float turbulenceWindow = (1.0 - localProgress) * sin(localProgress * 3.14159265);

    vec3 curvedFlow = vec3(
      sin(phase + localProgress * 5.5) * (0.45 + abs(randomSeed.x)),
      cos(phase * 0.7 + localProgress * 4.0) * (0.28 + abs(randomSeed.y)),
      sin(phase * 1.3 - localProgress * 4.6) * (0.38 + abs(randomSeed.z))
    ) * uFlowStrength * flowWindow;

    vec3 turbulence = vec3(
      sin(phase * 2.1 + localProgress * 17.0),
      cos(phase * 1.7 - localProgress * 13.0),
      sin(phase * 2.7 + localProgress * 15.0)
    ) * uTurbulenceStrength * turbulenceWindow;

    vec3 animatedPosition = mix(startPosition, position, easedProgress) + curvedFlow + turbulence;
    float idleEnvelope = smoothstep(0.72, 1.0, uIntroProgress);
    vec3 idleOffset = vec3(
      sin(uTime * 0.72 + phase),
      cos(uTime * 0.58 + phase * 1.21),
      sin(uTime * 0.64 + phase * 0.83)
    ) * uIdleStrength * idleEnvelope;
    animatedPosition += idleOffset;

    vec4 modelViewPosition = modelViewMatrix * vec4(animatedPosition, 1.0);
    modelViewPosition.z += randomSeed.z * uLogoDepthSpread * easedProgress;
    float cameraDepth = max(0.18, -modelViewPosition.z);
    float perspectiveScale = mix(1.0, 1.0 / cameraDepth, uSizeAttenuation);
    float individualSize = mix(1.0, sizeVariation, uSizeVariation);
    vDepthBrightness = clamp(0.86 + perspectiveScale * 0.14, 0.86, 1.12);
    gl_Position = projectionMatrix * modelViewPosition;
    gl_PointSize = clamp(uPointSize * uViewportHeight * 0.5 * individualSize * perspectiveScale, 0.9, 8.0);
  }
`

const logoFragmentShader = `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uBrightness;

  varying float vDepthBrightness;

  void main() {
    float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
    float core = 1.0 - smoothstep(0.20, 0.40, distanceToCenter);
    float halo = 1.0 - smoothstep(0.34, 0.50, distanceToCenter);
    float particleAlpha = min(1.0, core + halo * 0.20);
    if (particleAlpha <= 0.0) discard;
    gl_FragColor = vec4(uColor * uBrightness * vDepthBrightness, uOpacity * particleAlpha);
  }
`

const ambientVertexShader = `
  attribute vec3 drift;
  attribute float phase;
  attribute float depthSeed;
  attribute float sizeVariation;

  uniform float uTime;
  uniform float uPointSize;
  uniform float uViewportHeight;
  uniform float uSizeAttenuation;
  uniform float uAmbientDepthSpread;
  uniform float uSizeVariation;

  varying float vDepthBrightness;

  void main() {
    float orbitSpeed = 0.012 + (sin(phase * 1.37) * 0.5 + 0.5) * 0.018;
    float orbitAngle = uTime * orbitSpeed;
    float orbitCos = cos(orbitAngle);
    float orbitSin = sin(orbitAngle);
    vec2 orbitPosition = mat2(orbitCos, -orbitSin, orbitSin, orbitCos) * position.xy;
    vec3 animatedPosition = vec3(orbitPosition, position.z) + vec3(
      sin(uTime * 0.13 + phase) * drift.x,
      cos(uTime * 0.11 + phase * 1.17) * drift.y,
      sin(uTime * 0.09 + phase * 0.83) * drift.z
    );
    vec4 modelViewPosition = modelViewMatrix * vec4(animatedPosition, 1.0);
    modelViewPosition.z += depthSeed * uAmbientDepthSpread;
    float cameraDepth = max(0.18, -modelViewPosition.z);
    float perspectiveScale = mix(1.0, 1.0 / cameraDepth, uSizeAttenuation);
    float individualSize = mix(1.0, sizeVariation, uSizeVariation);
    vDepthBrightness = clamp(0.78 + perspectiveScale * 0.18, 0.76, 1.16);
    gl_Position = projectionMatrix * modelViewPosition;
    gl_PointSize = clamp(uPointSize * uViewportHeight * 0.5 * individualSize * perspectiveScale, 0.7, 4.2);
  }
`

const ambientFragmentShader = `
  uniform vec3 uColor;
  uniform float uOpacity;

  varying float vDepthBrightness;

  void main() {
    float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
    float core = 1.0 - smoothstep(0.18, 0.38, distanceToCenter);
    float halo = 1.0 - smoothstep(0.32, 0.50, distanceToCenter);
    float particleAlpha = min(1.0, core + halo * 0.14);
    if (particleAlpha <= 0.0) discard;
    gl_FragColor = vec4(uColor * vDepthBrightness, uOpacity * particleAlpha);
  }
`

let renderer: THREE.WebGLRenderer | undefined
let scene: THREE.Scene | undefined
let camera: THREE.PerspectiveCamera | undefined
let logoGeometry: THREE.BufferGeometry | undefined
let logoMaterial: THREE.ShaderMaterial | undefined
let ambientGeometry: THREE.BufferGeometry | undefined
let ambientMaterial: THREE.ShaderMaterial | undefined
let resizeObserver: ResizeObserver | undefined
let reducedMotionQuery: MediaQueryList | undefined
let logoPoints: THREE.Points | undefined
let ambientPoints: THREE.Points | undefined
let axesHelper: THREE.AxesHelper | undefined
let gridHelper: THREE.GridHelper | undefined
let introStartTime = 0
let lastFrameTime = 0
let reducedMotion = false
let disposed = false
let pointerTargetX = 0
let pointerTargetY = 0
let cursorTiltX = 0
let cursorTiltZ = 0

/** CPU-side position sets stay isolated so a future morph can replace the target safely. */
let startPositions: Float32Array | undefined
let currentPositions: Float32Array | undefined
let targetPositions: Float32Array | undefined

function renderScene() {
  if (renderer && scene && camera) renderer.render(scene, camera)
}

function animate(time: number) {
  if (!renderer || !scene || !camera || !logoMaterial || !ambientMaterial) return
  const deltaSeconds = lastFrameTime ? Math.min((time - lastFrameTime) / 1000, 0.05) : 0
  lastFrameTime = time
  const elapsedSeconds = Math.max(0, time - introStartTime) / 1000
  logoMaterial.uniforms.uTime!.value = time / 1000
  logoMaterial.uniforms.uIntroProgress!.value = Math.min(1, elapsedSeconds / settings.introDuration)
  ambientMaterial.uniforms.uTime!.value = time / 1000
  updateCursorTilt(deltaSeconds)
  renderer.render(scene, camera)
}

function syncAnimationLoop() {
  if (!renderer) return
  renderer.setAnimationLoop(reducedMotion ? null : animate)
  if (reducedMotion) renderScene()
}

function createRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state += 0x6D2B79F5
    let value = state
    value = Math.imul(value ^ value >>> 15, value | 1)
    value ^= value + Math.imul(value ^ value >>> 7, value | 61)
    return ((value ^ value >>> 14) >>> 0) / 4294967296
  }
}

function updateCamera() {
  if (!camera) return

  const { cameraDistance } = settings
  camera.fov = settings.cameraFov
  camera.up.set(0, 0, 1)
  if (cameraView.value === 'front') {
    camera.position.set(0, cameraDistance, 0.22)
  } else {
    camera.position.set(cameraDistance * 0.58, cameraDistance, 0.22 + cameraDistance * 0.46)
  }
  camera.lookAt(0, 0, 0.22)
  camera.updateProjectionMatrix()
}

function applyParticleTransforms() {
  if (logoPoints) {
    logoPoints.rotation.set(
      settings.rotationX + cursorTiltX,
      settings.rotationY,
      settings.rotationZ + cursorTiltZ,
    )
    logoPoints.scale.setScalar(settings.scale)
    logoPoints.position.z = settings.verticalOffset
  }
  if (ambientPoints) {
    ambientPoints.rotation.set(cursorTiltX * 0.7, 0, cursorTiltZ * 0.7)
  }
}

function updateCursorTilt(deltaSeconds: number) {
  if (!logoMaterial) return
  const introProgress = Number(logoMaterial.uniforms.uIntroProgress!.value)
  const interactionEnvelope = Math.max(0, Math.min(1, (introProgress - 0.72) / 0.28))
  const targetX = reducedMotion ? 0 : pointerTargetY * settings.cursorTiltStrength * interactionEnvelope
  const targetZ = reducedMotion ? 0 : -pointerTargetX * settings.cursorTiltStrength * interactionEnvelope
  const smoothing = 1 - Math.exp(-deltaSeconds * 6.5)
  cursorTiltX += (targetX - cursorTiltX) * smoothing
  cursorTiltZ += (targetZ - cursorTiltZ) * smoothing
  applyParticleTransforms()
}

function handlePointerMove(event: PointerEvent) {
  if (reducedMotion) return
  pointerTargetX = Math.max(-1, Math.min(1, event.clientX / window.innerWidth * 2 - 1))
  pointerTargetY = Math.max(-1, Math.min(1, event.clientY / window.innerHeight * 2 - 1))
}

function resetCursorTilt() {
  pointerTargetX = 0
  pointerTargetY = 0
}

function applySettings() {
  const rootStyle = document.documentElement.style
  rootStyle.setProperty('--card-hover-glow-size', `${settings.cardHoverGlowSize}px`)
  rootStyle.setProperty('--card-hover-glow-opacity', String(settings.cardHoverGlowOpacity))
  rootStyle.setProperty('--card-hover-glow-intensity', String(settings.cardHoverGlowIntensity))
  rootStyle.setProperty('--card-hover-glow-scale', String(settings.cardHoverGlowScale))
  rootStyle.setProperty('--card-hover-follow', String(settings.cardHoverFollow))
  applyParticleTransforms()
  if (logoMaterial) {
    logoMaterial.uniforms.uPointSize!.value = settings.pointSize
    logoMaterial.uniforms.uSizeAttenuation!.value = settings.sizeAttenuation
    logoMaterial.uniforms.uLogoDepthSpread!.value = settings.logoDepthSpread
    logoMaterial.uniforms.uSizeVariation!.value = settings.particleSizeVariation
    logoMaterial.uniforms.uOpacity!.value = settings.opacity
    logoMaterial.uniforms.uFlowStrength!.value = settings.flowStrength
    logoMaterial.uniforms.uTurbulenceStrength!.value = settings.turbulenceStrength
    logoMaterial.uniforms.uIdleStrength!.value = reducedMotion ? 0 : settings.idleStrength
    logoMaterial.uniforms.uBrightness!.value = settings.logoBrightness
  }
  if (ambientMaterial) {
    ambientMaterial.uniforms.uSizeAttenuation!.value = settings.sizeAttenuation
    ambientMaterial.uniforms.uAmbientDepthSpread!.value = settings.ambientDepthSpread
    ambientMaterial.uniforms.uSizeVariation!.value = settings.particleSizeVariation
  }
  if (ambientPoints) ambientPoints.visible = settings.ambientVisible && !reducedMotion
  if (axesHelper) axesHelper.visible = settings.showAxes
  if (gridHelper) gridHelper.visible = settings.showGrid
  updateCamera()
  if (reducedMotion) renderScene()
}

function setCameraView(view: 'front' | 'perspective') {
  cameraView.value = view
  applySettings()
}

function restartIntro() {
  if (reducedMotion || !logoMaterial) return
  introStartTime = performance.now()
  logoMaterial.uniforms.uIntroProgress!.value = 0
}

watch(settings, applySettings, { deep: true })

function resize() {
  if (!canvas.value || !renderer || !camera) return

  const { width, height } = canvas.value.getBoundingClientRect()
  if (!width || !height) return

  const pixelRatio = Math.min(window.devicePixelRatio, 1.5)
  renderer.setPixelRatio(pixelRatio)
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  if (logoMaterial) logoMaterial.uniforms.uViewportHeight!.value = height * pixelRatio
  if (ambientMaterial) ambientMaterial.uniforms.uViewportHeight!.value = height * pixelRatio
  if (reducedMotion) renderScene()
}

function handleReducedMotion(event: MediaQueryListEvent) {
  reducedMotion = event.matches
  resetCursorTilt()
  if (reducedMotion) {
    cursorTiltX = 0
    cursorTiltZ = 0
  }
  if (logoMaterial) {
    logoMaterial.uniforms.uIntroProgress!.value = reducedMotion ? 1 : 0
    logoMaterial.uniforms.uIdleStrength!.value = reducedMotion ? 0 : settings.idleStrength
  }
  if (!reducedMotion) introStartTime = performance.now()
  lastFrameTime = 0
  applySettings()
  syncAnimationLoop()
}

function dispose() {
  disposed = true
  resizeObserver?.disconnect()
  reducedMotionQuery?.removeEventListener('change', handleReducedMotion)
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('blur', resetCursorTilt)
  document.documentElement.removeEventListener('pointerleave', resetCursorTilt)
  const rootStyle = document.documentElement.style
  rootStyle.removeProperty('--card-hover-glow-size')
  rootStyle.removeProperty('--card-hover-glow-opacity')
  rootStyle.removeProperty('--card-hover-glow-intensity')
  rootStyle.removeProperty('--card-hover-glow-scale')
  rootStyle.removeProperty('--card-hover-follow')
  renderer?.setAnimationLoop(null)
  logoGeometry?.dispose()
  logoMaterial?.dispose()
  ambientGeometry?.dispose()
  ambientMaterial?.dispose()
  renderer?.dispose()
  renderer = undefined
  scene = undefined
  camera = undefined
  logoGeometry = undefined
  logoMaterial = undefined
  ambientGeometry = undefined
  ambientMaterial = undefined
  logoPoints = undefined
  ambientPoints = undefined
  axesHelper = undefined
  gridHelper = undefined
  currentPositions = undefined
  startPositions = undefined
  targetPositions = undefined
  pointerTargetX = 0
  pointerTargetY = 0
  cursorTiltX = 0
  cursorTiltZ = 0
}

onMounted(async () => {
  if (!canvas.value) return

  try {
    const [three, response] = await Promise.all([
      import('three'),
      fetch(asset('particles/ld_logo_points.json')),
    ])
    if (!response.ok) throw new Error(`Unable to load LD logo particle data: ${response.status}`)
    const data = await response.json() as PointData
    if (disposed || !canvas.value) return

    const sessionSeed = crypto.getRandomValues(new Uint32Array(1))[0] ?? Date.now()
    const random = createRandom(sessionSeed)
    const pointCount = data.positions.length
    targetPositions = new Float32Array(pointCount * 3)
    startPositions = new Float32Array(pointCount * 3)
    const randomSeeds = new Float32Array(pointCount * 3)
    const phases = new Float32Array(pointCount)
    const delays = new Float32Array(pointCount)
    const logoSizes = new Float32Array(pointCount)

    data.positions.forEach(({ x, y, z }, index) => {
      const offset = index * 3
      const angle = random() * Math.PI * 2
      const radius = Math.pow(random(), 0.58)
      const verticalAngle = (random() - 0.5) * Math.PI
      targetPositions![offset] = x
      targetPositions![offset + 1] = y
      targetPositions![offset + 2] = z
      startPositions![offset] = Math.cos(angle) * radius * (0.58 + random() * 0.48)
      startPositions![offset + 1] = (random() - 0.5) * (0.34 + radius * 0.32)
      startPositions![offset + 2] = 0.22 + Math.sin(verticalAngle) * radius * (0.34 + random() * 0.28)
      randomSeeds[offset] = random() * 2 - 1
      randomSeeds[offset + 1] = random() * 2 - 1
      randomSeeds[offset + 2] = random() * 2 - 1
      phases[index] = random() * Math.PI * 2
      delays[index] = Math.pow(random(), 1.8) * 0.14
      logoSizes[index] = 0.9 + random() * 0.2
    })
    currentPositions = startPositions.slice()

    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || '#ffec00'
    scene = new three.Scene()
    camera = new three.PerspectiveCamera(40, 1, 0.1, 10)
    updateCamera()

    logoGeometry = new three.BufferGeometry()
    logoGeometry.setAttribute('position', new three.BufferAttribute(targetPositions, 3))
    logoGeometry.setAttribute('startPosition', new three.BufferAttribute(startPositions, 3))
    logoGeometry.setAttribute('randomSeed', new three.BufferAttribute(randomSeeds, 3))
    logoGeometry.setAttribute('phase', new three.BufferAttribute(phases, 1))
    logoGeometry.setAttribute('delay', new three.BufferAttribute(delays, 1))
    logoGeometry.setAttribute('sizeVariation', new three.BufferAttribute(logoSizes, 1))
    logoMaterial = new three.ShaderMaterial({
      vertexShader: logoVertexShader,
      fragmentShader: logoFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uIntroProgress: { value: 0 },
        uFlowStrength: { value: settings.flowStrength },
        uTurbulenceStrength: { value: settings.turbulenceStrength },
        uIdleStrength: { value: settings.idleStrength },
        uPointSize: { value: settings.pointSize },
        uViewportHeight: { value: 1 },
        uSizeAttenuation: { value: settings.sizeAttenuation },
        uLogoDepthSpread: { value: settings.logoDepthSpread },
        uSizeVariation: { value: settings.particleSizeVariation },
        uColor: { value: new three.Color(accentColor) },
        uOpacity: { value: settings.opacity },
        uBrightness: { value: settings.logoBrightness },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
    })
    logoPoints = new three.Points(logoGeometry, logoMaterial)
    logoPoints.frustumCulled = false
    logoPoints.renderOrder = 1
    scene.add(logoPoints)

    const ambientCount = 720
    const ambientPositions = new Float32Array(ambientCount * 3)
    const ambientDrift = new Float32Array(ambientCount * 3)
    const ambientPhases = new Float32Array(ambientCount)
    const ambientDepthSeeds = new Float32Array(ambientCount)
    const ambientSizes = new Float32Array(ambientCount)
    for (let index = 0; index < ambientCount; index += 1) {
      const offset = index * 3
      const angle = random() * Math.PI * 2
      const radius = Math.sqrt(random())
      ambientPositions[offset] = Math.cos(angle) * radius * 1.18
      ambientPositions[offset + 1] = (random() - 0.5) * 0.72
      ambientPositions[offset + 2] = 0.22 + Math.sin(angle) * radius * 0.72 + (random() - 0.5) * 0.32
      ambientDrift[offset] = 0.008 + random() * 0.018
      ambientDrift[offset + 1] = 0.006 + random() * 0.015
      ambientDrift[offset + 2] = 0.008 + random() * 0.018
      ambientPhases[index] = random() * Math.PI * 2
      ambientDepthSeeds[index] = random() * 2 - 1
      ambientSizes[index] = 0.62 + random() * 0.76
    }
    ambientGeometry = new three.BufferGeometry()
    ambientGeometry.setAttribute('position', new three.BufferAttribute(ambientPositions, 3))
    ambientGeometry.setAttribute('drift', new three.BufferAttribute(ambientDrift, 3))
    ambientGeometry.setAttribute('phase', new three.BufferAttribute(ambientPhases, 1))
    ambientGeometry.setAttribute('depthSeed', new three.BufferAttribute(ambientDepthSeeds, 1))
    ambientGeometry.setAttribute('sizeVariation', new three.BufferAttribute(ambientSizes, 1))
    ambientMaterial = new three.ShaderMaterial({
      vertexShader: ambientVertexShader,
      fragmentShader: ambientFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uPointSize: { value: 0.0028 },
        uViewportHeight: { value: 1 },
        uSizeAttenuation: { value: settings.sizeAttenuation },
        uAmbientDepthSpread: { value: settings.ambientDepthSpread },
        uSizeVariation: { value: settings.particleSizeVariation },
        uColor: { value: new three.Color('#c9d0cf') },
        uOpacity: { value: 0.18 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
    })
    ambientPoints = new three.Points(ambientGeometry, ambientMaterial)
    ambientPoints.frustumCulled = false
    scene.add(ambientPoints)

    axesHelper = new three.AxesHelper(0.35)
    axesHelper.position.set(-0.5, 0, 0)
    scene.add(axesHelper)

    gridHelper = new three.GridHelper(1.2, 12, 0x5ad6d2, 0x315b5a)
    gridHelper.position.set(0, 0, 0.22)
    scene.add(gridHelper)

    renderer = new three.WebGLRenderer({ canvas: canvas.value, alpha: true, antialias: false, powerPreference: 'high-performance' })
    renderer.setClearColor(0x000000, 0)

    reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotion = reducedMotionQuery.matches
    logoMaterial.uniforms.uIntroProgress!.value = reducedMotion ? 1 : 0
    reducedMotionQuery.addEventListener('change', handleReducedMotion)
    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('blur', resetCursorTilt)
    document.documentElement.addEventListener('pointerleave', resetCursorTilt)
    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas.value)
    introStartTime = performance.now()
    applySettings()
    resize()
    emit('introStart', reducedMotion)
    syncAnimationLoop()
  } catch (error) {
    console.error('[ParticleLogo] Initialization failed', error)
    dispose()
    emit('introStart', true)
  }
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
            <label>Vertical offset <output>{{ settings.verticalOffset.toFixed(2) }}</output><input v-model.number="settings.verticalOffset" type="range" min="-1" max="1" step="0.01" /></label>
          </div>
          <div class="particle-debug__group">
            <h2>Camera</h2>
            <label>FOV <output>{{ settings.cameraFov.toFixed(0) }}°</output><input v-model.number="settings.cameraFov" type="range" min="28" max="65" step="1" /></label>
            <label>Distance <output>{{ settings.cameraDistance.toFixed(2) }}</output><input v-model.number="settings.cameraDistance" type="range" min="0.5" max="3" step="0.01" /></label>
            <div class="particle-debug__actions"><button type="button" :class="{ 'is-active': cameraView === 'front' }" @click="setCameraView('front')">Front view</button><button type="button" :class="{ 'is-active': cameraView === 'perspective' }" @click="setCameraView('perspective')">Perspective view</button></div>
          </div>
          <div class="particle-debug__group">
            <h2>Formation</h2>
            <label>Intro duration <output>{{ settings.introDuration.toFixed(2) }} s</output><input v-model.number="settings.introDuration" type="range" min="1.2" max="1.6" step="0.01" /></label>
            <label>Flow strength <output>{{ settings.flowStrength.toFixed(3) }}</output><input v-model.number="settings.flowStrength" type="range" min="0" max="0.5" step="0.005" /></label>
            <label>Turbulence <output>{{ settings.turbulenceStrength.toFixed(3) }}</output><input v-model.number="settings.turbulenceStrength" type="range" min="0" max="0.2" step="0.005" /></label>
            <label>Idle strength <output>{{ settings.idleStrength.toFixed(3) }}</output><input v-model.number="settings.idleStrength" type="range" min="0" max="0.02" step="0.001" /></label>
            <label>Cursor tilt <output>{{ settings.cursorTiltStrength.toFixed(3) }}</output><input v-model.number="settings.cursorTiltStrength" type="range" min="0" max="0.08" step="0.001" /></label>
            <button class="particle-debug__wide-action" type="button" @click="restartIntro">Replay intro</button>
          </div>
          <div class="particle-debug__group">
            <h2>Particles</h2>
            <label>Point size <output>{{ settings.pointSize.toFixed(3) }}</output><input v-model.number="settings.pointSize" type="range" min="0.001" max="0.02" step="0.001" /></label>
            <label>Size attenuation <output>{{ settings.sizeAttenuation.toFixed(2) }}</output><input v-model.number="settings.sizeAttenuation" type="range" min="0" max="2" step="0.05" /></label>
            <label>LD depth <output>{{ settings.logoDepthSpread.toFixed(3) }}</output><input v-model.number="settings.logoDepthSpread" type="range" min="0" max="0.15" step="0.005" /></label>
            <label>Ambient depth <output>{{ settings.ambientDepthSpread.toFixed(2) }}</output><input v-model.number="settings.ambientDepthSpread" type="range" min="0" max="0.8" step="0.02" /></label>
            <label>Size variation <output>{{ settings.particleSizeVariation.toFixed(2) }}</output><input v-model.number="settings.particleSizeVariation" type="range" min="0" max="1" step="0.05" /></label>
            <label>Opacity <output>{{ settings.opacity.toFixed(2) }}</output><input v-model.number="settings.opacity" type="range" min="0.05" max="1" step="0.01" /></label>
            <label>Logo brightness <output>{{ settings.logoBrightness.toFixed(2) }}</output><input v-model.number="settings.logoBrightness" type="range" min="0.5" max="1.5" step="0.01" /></label>
            <label class="particle-debug__check"><input v-model="settings.ambientVisible" type="checkbox" /> Ambient particles</label>
          </div>
          <div class="particle-debug__group">
            <h2>Card hover</h2>
            <label>Glow size <output>{{ settings.cardHoverGlowSize.toFixed(1) }} px</output><input v-model.number="settings.cardHoverGlowSize" type="range" min="160" max="560" step="0.1" /></label>
            <label>Glow opacity <output>{{ settings.cardHoverGlowOpacity.toFixed(2) }}</output><input v-model.number="settings.cardHoverGlowOpacity" type="range" min="0" max="1" step="0.05" /></label>
            <label>Glow intensity <output>{{ settings.cardHoverGlowIntensity.toFixed(2) }}</output><input v-model.number="settings.cardHoverGlowIntensity" type="range" min="0.25" max="2" step="0.05" /></label>
            <label>Glow scale <output>{{ settings.cardHoverGlowScale.toFixed(2) }}</output><input v-model.number="settings.cardHoverGlowScale" type="range" min="0.5" max="1.5" step="0.05" /></label>
            <label>Follow response <output>{{ settings.cardHoverFollow.toFixed(2) }}</output><input v-model.number="settings.cardHoverFollow" type="range" min="0.02" max="0.5" step="0.01" /></label>
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
.particle-debug__actions button, .particle-debug__wide-action { padding: 6px; border: 1px solid rgb(157 235 231 / 35%); border-radius: 4px; background: transparent; color: inherit; cursor: pointer; }
.particle-debug__actions button.is-active { background: rgb(157 235 231 / 20%); border-color: #9debe7; }
.particle-debug__switches label, .particle-debug label.particle-debug__check { grid-template-columns: auto 1fr; justify-content: start; }
.particle-debug__switches input, .particle-debug__check input { accent-color: #9debe7; }
@media (max-width: 599px) { .particle-debug { bottom: 8px; left: 8px; width: min(290px, calc(100vw - 16px)); } }
</style>
