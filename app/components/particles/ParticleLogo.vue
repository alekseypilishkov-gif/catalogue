<script setup lang="ts">
import type * as THREE from 'three'

interface PointData {
  name: string
  count: number
  positions: Array<{ x: number, y: number, z: number }>
}

type ParticleState = 'galaxy' | 'transition' | 'logo'

const emit = defineEmits<{
  introStart: [reducedMotion: boolean]
  cardsVisibilityChange: [hidden: boolean]
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
const asset = useAssetUrl()
const isDebugPanelOpen = ref(false)
const cameraView = ref<'front' | 'perspective'>('front')
const settings = reactive({
  rotationX: -0.06,
  rotationY: 0,
  rotationZ: 2.67,
  scale: 1,
  verticalOffset: 0,
  cameraFov: 42,
  cameraDistance: 1.2,
  pointSize: 0.016,
  sizeAttenuation: 2,
  logoDepthSpread: 0.09,
  ambientDepthSpread: 0.26,
  particleSizeVariation: 0.45,
  opacity: 0.67,
  logoBrightness: 1,
  galaxyRadius: 0.68,
  galaxyRotationSpeed: 0.08,
  galaxyTurbulence: 0.018,
  transitionDuration: 1.05,
  fieldIntensity: 0.78,
  ambientIntensity: 0.18,
  flowStrength: 0.24,
  turbulenceStrength: 0.055,
  idleStrength: 0.002,
  cursorTiltStrength: 0.025,
  ambientVisible: true,
  cardHoverGlowSize: 397.4,
  cardHoverGlowOpacity: 0.35,
  cardHoverGlowIntensity: 0.65,
  cardHoverGlowScale: 1,
  cardHoverFollow: 0.14,
  hideCards: false,
  showAxes: false,
  showGrid: false,
})

const logoVertexShader = `
  attribute vec3 galaxyPosition;
  attribute vec3 randomSeed;
  attribute float phase;
  attribute float delay;
  attribute float sizeVariation;

  uniform float uTime;
  uniform float uTransitionProgress;
  uniform float uGalaxyRadius;
  uniform float uGalaxyRotationSpeed;
  uniform float uGalaxyTurbulence;
  uniform float uFlowStrength;
  uniform float uTurbulenceStrength;
  uniform float uIdleStrength;
  uniform float uPointSize;
  uniform float uViewportHeight;
  uniform float uSizeAttenuation;
  uniform float uLogoDepthSpread;
  uniform float uSizeVariation;

  varying float vDepthBrightness;
  varying float vTransitionProgress;

  float easeOutCubic(float value) {
    float inverse = 1.0 - value;
    return 1.0 - inverse * inverse * inverse;
  }

  void main() {
    float localProgress = clamp((uTransitionProgress - delay) / max(0.001, 1.0 - delay), 0.0, 1.0);
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

    vec3 scaledGalaxyPosition = galaxyPosition * uGalaxyRadius;
    float orbitalSpeed = uGalaxyRotationSpeed * (0.55 + abs(randomSeed.y) * 0.65);
    float orbitalAngle = uTime * orbitalSpeed;
    float orbitalCos = cos(orbitalAngle);
    float orbitalSin = sin(orbitalAngle);
    vec2 orbitalPosition = mat2(orbitalCos, -orbitalSin, orbitalSin, orbitalCos) * scaledGalaxyPosition.xz;
    vec3 animatedGalaxyPosition = vec3(orbitalPosition.x, scaledGalaxyPosition.y, orbitalPosition.y);
    animatedGalaxyPosition += vec3(
      sin(uTime * 0.31 + phase * 1.7),
      cos(uTime * 0.27 + phase * 1.13),
      sin(uTime * 0.29 + phase * 1.41)
    ) * uGalaxyTurbulence * (1.0 - easedProgress);

    vec3 animatedPosition = mix(animatedGalaxyPosition, position, easedProgress) + curvedFlow + turbulence;
    float idleEnvelope = smoothstep(0.72, 1.0, uTransitionProgress);
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
    vTransitionProgress = easedProgress;
    gl_Position = projectionMatrix * modelViewPosition;
    float stateSize = mix(0.62, 1.0, easedProgress);
    gl_PointSize = clamp(uPointSize * uViewportHeight * 0.5 * individualSize * perspectiveScale * stateSize, 0.75, 8.0);
  }
`

const logoFragmentShader = `
  uniform vec3 uGalaxyColor;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uBrightness;

  varying float vDepthBrightness;
  varying float vTransitionProgress;

  void main() {
    float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
    float core = 1.0 - smoothstep(0.20, 0.40, distanceToCenter);
    float halo = 1.0 - smoothstep(0.34, 0.50, distanceToCenter);
    float particleAlpha = min(1.0, core + halo * 0.20);
    if (particleAlpha <= 0.0) discard;
    vec3 particleColor = mix(uGalaxyColor, uColor, smoothstep(0.12, 0.92, vTransitionProgress));
    gl_FragColor = vec4(particleColor * uBrightness * vDepthBrightness, uOpacity * particleAlpha);
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
    gl_PointSize = clamp(uPointSize * uViewportHeight * 0.5 * individualSize * perspectiveScale, 0.7, 7.0);
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

const orbitVertexShader = `
  attribute vec3 drift;
  attribute float phase;
  attribute float orbitSpeed;
  attribute float sizeVariation;
  attribute float warmMix;

  uniform float uTime;
  uniform float uTransitionProgress;
  uniform float uPointSize;
  uniform float uViewportHeight;
  uniform float uFieldIntensity;

  varying float vBrightness;
  varying float vWarmMix;
  varying float vAlpha;

  void main() {
    float angle = uTime * orbitSpeed;
    float orbitCos = cos(angle);
    float orbitSin = sin(angle);
    vec2 rotated = mat2(orbitCos, -orbitSin, orbitSin, orbitCos) * position.xz;
    float energyPulse = sin(phase * 2.0 + uTime * 1.4) * 0.5 + 0.5;
    vec3 animatedPosition = vec3(rotated.x, position.y, rotated.y) + vec3(
      sin(uTime * 0.24 + phase) * drift.x,
      cos(uTime * 0.19 + phase * 1.31) * drift.y,
      sin(uTime * 0.22 + phase * 0.83) * drift.z
    );
    animatedPosition *= mix(1.0, 0.94, smoothstep(0.0, 1.0, uTransitionProgress));

    vec4 modelViewPosition = modelViewMatrix * vec4(animatedPosition, 1.0);
    float cameraDepth = max(0.2, -modelViewPosition.z);
    float depthScale = clamp(1.0 / cameraDepth, 0.72, 1.8);
    vBrightness = mix(0.92, 1.62, energyPulse) * mix(0.92, 1.08, uTransitionProgress);
    vWarmMix = warmMix;
    vAlpha = uFieldIntensity * mix(0.76, 1.0, energyPulse);
    gl_Position = projectionMatrix * modelViewPosition;
    gl_PointSize = clamp(uPointSize * uViewportHeight * sizeVariation * depthScale, 0.8, 7.0);
  }
`

const orbitFragmentShader = `
  uniform vec3 uLightColor;
  uniform vec3 uWarmColor;
  uniform float uTransitionProgress;

  varying float vBrightness;
  varying float vWarmMix;
  varying float vAlpha;

  void main() {
    float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
    float core = 1.0 - smoothstep(0.06, 0.25, distanceToCenter);
    float halo = 1.0 - smoothstep(0.18, 0.50, distanceToCenter);
    float particleAlpha = min(1.0, core + halo * 0.48);
    if (particleAlpha <= 0.0) discard;
    float finalWarmMix = vWarmMix * mix(0.28, 0.48, uTransitionProgress);
    vec3 particleColor = mix(uLightColor, uWarmColor, finalWarmMix);
    gl_FragColor = vec4(particleColor * vBrightness, vAlpha * particleAlpha);
  }
`

let renderer: THREE.WebGLRenderer | undefined
let scene: THREE.Scene | undefined
let camera: THREE.PerspectiveCamera | undefined
let logoGeometry: THREE.BufferGeometry | undefined
let logoMaterial: THREE.ShaderMaterial | undefined
let ambientGeometry: THREE.BufferGeometry | undefined
let ambientMaterial: THREE.ShaderMaterial | undefined
let orbitGeometry: THREE.BufferGeometry | undefined
let orbitMaterial: THREE.ShaderMaterial | undefined
let resizeObserver: ResizeObserver | undefined
let reducedMotionQuery: MediaQueryList | undefined
let logoPoints: THREE.Points | undefined
let ambientPoints: THREE.Points | undefined
let orbitPoints: THREE.Points | undefined
let axesHelper: THREE.AxesHelper | undefined
let gridHelper: THREE.GridHelper | undefined
let transitionStartTime = 0
let lastFrameTime = 0
let reducedMotion = false
let disposed = false
let transitionOverride = false
let lastProgressUiUpdate = 0
let pointerTargetX = 0
let pointerTargetY = 0
let cursorTiltX = 0
let cursorTiltZ = 0

/** CPU-side position sets stay isolated so a future morph can replace the target safely. */
let galaxyPositions: Float32Array | undefined
let currentPositions: Float32Array | undefined
let targetPositions: Float32Array | undefined
const transitionProgress = ref(0)
const particleState = ref<ParticleState>('galaxy')
const transitionDelay = 0.9

function renderScene() {
  if (renderer && scene && camera) renderer.render(scene, camera)
}

function animate(time: number) {
  if (!renderer || !scene || !camera || !logoMaterial || !ambientMaterial || !orbitMaterial) return
  const deltaSeconds = lastFrameTime ? Math.min((time - lastFrameTime) / 1000, 0.05) : 0
  lastFrameTime = time
  const elapsedSeconds = Math.max(0, time - transitionStartTime) / 1000
  const automaticProgress = Math.max(0, Math.min(1, (elapsedSeconds - transitionDelay) / settings.transitionDuration))
  const activeProgress = transitionOverride ? transitionProgress.value : automaticProgress
  const nextState: ParticleState = activeProgress <= 0 ? 'galaxy' : activeProgress >= 1 ? 'logo' : 'transition'
  if (particleState.value !== nextState) particleState.value = nextState
  logoMaterial.uniforms.uTime!.value = time / 1000
  logoMaterial.uniforms.uTransitionProgress!.value = activeProgress
  if (!transitionOverride && (time - lastProgressUiUpdate > 50 || activeProgress >= 1)) {
    transitionProgress.value = activeProgress
    lastProgressUiUpdate = time
  }
  ambientMaterial.uniforms.uTime!.value = time / 1000
  orbitMaterial.uniforms.uTime!.value = time / 1000
  orbitMaterial.uniforms.uTransitionProgress!.value = activeProgress
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
  if (orbitPoints) {
    orbitPoints.rotation.set(cursorTiltX * 0.42, 0, cursorTiltZ * 0.42)
  }
}

function updateCursorTilt(deltaSeconds: number) {
  if (!logoMaterial) return
  const activeTransitionProgress = Number(logoMaterial.uniforms.uTransitionProgress!.value)
  const interactionEnvelope = Math.max(0, Math.min(1, (activeTransitionProgress - 0.72) / 0.28))
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
    logoMaterial.uniforms.uGalaxyRadius!.value = settings.galaxyRadius
    logoMaterial.uniforms.uGalaxyRotationSpeed!.value = reducedMotion ? 0 : settings.galaxyRotationSpeed
    logoMaterial.uniforms.uGalaxyTurbulence!.value = reducedMotion ? 0 : settings.galaxyTurbulence
    logoMaterial.uniforms.uFlowStrength!.value = settings.flowStrength
    logoMaterial.uniforms.uTurbulenceStrength!.value = settings.turbulenceStrength
    logoMaterial.uniforms.uIdleStrength!.value = reducedMotion ? 0 : settings.idleStrength
    logoMaterial.uniforms.uBrightness!.value = settings.logoBrightness
  }
  if (ambientMaterial) {
    ambientMaterial.uniforms.uSizeAttenuation!.value = settings.sizeAttenuation
    ambientMaterial.uniforms.uAmbientDepthSpread!.value = settings.ambientDepthSpread
    ambientMaterial.uniforms.uSizeVariation!.value = settings.particleSizeVariation
    ambientMaterial.uniforms.uOpacity!.value = settings.ambientIntensity
  }
  if (orbitMaterial) orbitMaterial.uniforms.uFieldIntensity!.value = settings.fieldIntensity
  emit('cardsVisibilityChange', settings.hideCards)
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
  transitionOverride = false
  transitionProgress.value = 0
  particleState.value = 'galaxy'
  transitionStartTime = performance.now()
  logoMaterial.uniforms.uTransitionProgress!.value = 0
}

function setTransitionProgress(event: Event) {
  const input = event.target as HTMLInputElement
  transitionOverride = true
  transitionProgress.value = Number(input.value)
  particleState.value = transitionProgress.value <= 0 ? 'galaxy' : transitionProgress.value >= 1 ? 'logo' : 'transition'
  if (logoMaterial) logoMaterial.uniforms.uTransitionProgress!.value = transitionProgress.value
  if (reducedMotion) renderScene()
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
  if (orbitMaterial) orbitMaterial.uniforms.uViewportHeight!.value = height * pixelRatio
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
    logoMaterial.uniforms.uTransitionProgress!.value = reducedMotion ? 1 : 0
    logoMaterial.uniforms.uIdleStrength!.value = reducedMotion ? 0 : settings.idleStrength
  }
  transitionOverride = false
  transitionProgress.value = reducedMotion ? 1 : 0
  particleState.value = reducedMotion ? 'logo' : 'galaxy'
  if (!reducedMotion) transitionStartTime = performance.now()
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
  orbitGeometry?.dispose()
  orbitMaterial?.dispose()
  renderer?.dispose()
  renderer = undefined
  scene = undefined
  camera = undefined
  logoGeometry = undefined
  logoMaterial = undefined
  ambientGeometry = undefined
  ambientMaterial = undefined
  orbitGeometry = undefined
  orbitMaterial = undefined
  logoPoints = undefined
  ambientPoints = undefined
  orbitPoints = undefined
  axesHelper = undefined
  gridHelper = undefined
  currentPositions = undefined
  galaxyPositions = undefined
  targetPositions = undefined
  transitionOverride = false
  transitionProgress.value = 0
  particleState.value = 'galaxy'
  pointerTargetX = 0
  pointerTargetY = 0
  cursorTiltX = 0
  cursorTiltZ = 0
  emit('cardsVisibilityChange', false)
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
    galaxyPositions = new Float32Array(pointCount * 3)
    const randomSeeds = new Float32Array(pointCount * 3)
    const phases = new Float32Array(pointCount)
    const delays = new Float32Array(pointCount)
    const logoSizes = new Float32Array(pointCount)

    data.positions.forEach(({ x, y, z }, index) => {
      const offset = index * 3
      const isCoreParticle = random() < 0.2
      const orbitIndex = index % 6
      const orbitAngle = random() * Math.PI * 2
      const orientation = orbitIndex * 0.47 - 0.72
      const orbitRadius = 0.58 + orbitIndex * 0.075 + (random() - 0.5) * 0.085
      const horizontal = Math.cos(orbitAngle) * orbitRadius
      const vertical = Math.sin(orbitAngle) * orbitRadius * (0.36 + orbitIndex * 0.035)
      const orientationCos = Math.cos(orientation)
      const orientationSin = Math.sin(orientation)
      const orientedX = horizontal * orientationCos - vertical * orientationSin
      const orientedZ = horizontal * orientationSin + vertical * orientationCos
      const coreRadius = Math.pow(random(), 2.2) * 0.34
      const coreAngle = random() * Math.PI * 2
      targetPositions![offset] = x
      targetPositions![offset + 1] = y
      targetPositions![offset + 2] = z
      galaxyPositions![offset] = isCoreParticle
        ? Math.cos(coreAngle) * coreRadius + 0.08
        : orientedX + Math.sin(orbitAngle * 3 + orbitIndex) * 0.035 + (random() - 0.5) * 0.035
      galaxyPositions![offset + 1] = isCoreParticle
        ? (random() - 0.5) * 0.22
        : Math.sin(orbitAngle * 2 + orbitIndex * 0.8) * (0.07 + orbitIndex * 0.012) + (random() - 0.5) * 0.045
      galaxyPositions![offset + 2] = isCoreParticle
        ? 0.22 + Math.sin(coreAngle) * coreRadius * 0.62 + (random() - 0.5) * 0.08
        : 0.22 + orientedZ + Math.cos(orbitAngle * 2.4 + orbitIndex) * 0.028 + (random() - 0.5) * 0.035
      randomSeeds[offset] = random() * 2 - 1
      randomSeeds[offset + 1] = random() * 2 - 1
      randomSeeds[offset + 2] = random() * 2 - 1
      phases[index] = random() * Math.PI * 2
      delays[index] = Math.pow(random(), 1.8) * 0.14
      logoSizes[index] = 0.9 + random() * 0.2
    })
    currentPositions = galaxyPositions.slice()

    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || '#ffec00'
    scene = new three.Scene()
    camera = new three.PerspectiveCamera(40, 1, 0.1, 10)
    updateCamera()

    logoGeometry = new three.BufferGeometry()
    logoGeometry.setAttribute('position', new three.BufferAttribute(targetPositions, 3))
    logoGeometry.setAttribute('galaxyPosition', new three.BufferAttribute(galaxyPositions, 3))
    logoGeometry.setAttribute('randomSeed', new three.BufferAttribute(randomSeeds, 3))
    logoGeometry.setAttribute('phase', new three.BufferAttribute(phases, 1))
    logoGeometry.setAttribute('delay', new three.BufferAttribute(delays, 1))
    logoGeometry.setAttribute('sizeVariation', new three.BufferAttribute(logoSizes, 1))
    logoMaterial = new three.ShaderMaterial({
      vertexShader: logoVertexShader,
      fragmentShader: logoFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uTransitionProgress: { value: 0 },
        uGalaxyRadius: { value: settings.galaxyRadius },
        uGalaxyRotationSpeed: { value: settings.galaxyRotationSpeed },
        uGalaxyTurbulence: { value: settings.galaxyTurbulence },
        uFlowStrength: { value: settings.flowStrength },
        uTurbulenceStrength: { value: settings.turbulenceStrength },
        uIdleStrength: { value: settings.idleStrength },
        uPointSize: { value: settings.pointSize },
        uViewportHeight: { value: 1 },
        uSizeAttenuation: { value: settings.sizeAttenuation },
        uLogoDepthSpread: { value: settings.logoDepthSpread },
        uSizeVariation: { value: settings.particleSizeVariation },
        uGalaxyColor: { value: new three.Color('#d7b457') },
        uColor: { value: new three.Color(accentColor) },
        uOpacity: { value: settings.opacity },
        uBrightness: { value: settings.logoBrightness },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: three.AdditiveBlending,
    })
    logoPoints = new three.Points(logoGeometry, logoMaterial)
    logoPoints.frustumCulled = false
    logoPoints.renderOrder = 1
    scene.add(logoPoints)

    const ambientCount = 960
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
      ambientSizes[index] = random() < 0.05 ? 2.4 + random() * 1.8 : 0.62 + random() * 0.82
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
        uPointSize: { value: 0.0032 },
        uViewportHeight: { value: 1 },
        uSizeAttenuation: { value: settings.sizeAttenuation },
        uAmbientDepthSpread: { value: settings.ambientDepthSpread },
        uSizeVariation: { value: settings.particleSizeVariation },
        uColor: { value: new three.Color('#c9d0cf') },
        uOpacity: { value: settings.ambientIntensity },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: three.AdditiveBlending,
    })
    ambientPoints = new three.Points(ambientGeometry, ambientMaterial)
    ambientPoints.frustumCulled = false
    scene.add(ambientPoints)

    const orbitCount = 3600
    const orbitPositions = new Float32Array(orbitCount * 3)
    const orbitDrift = new Float32Array(orbitCount * 3)
    const orbitPhases = new Float32Array(orbitCount)
    const orbitSpeeds = new Float32Array(orbitCount)
    const orbitSizes = new Float32Array(orbitCount)
    const orbitWarmMix = new Float32Array(orbitCount)
    const orbitFamilyCount = 5
    const pointsPerOrbit = Math.ceil(orbitCount / orbitFamilyCount)
    for (let index = 0; index < orbitCount; index += 1) {
      const offset = index * 3
      const family = index % orbitFamilyCount
      const sequenceIndex = Math.floor(index / orbitFamilyCount)
      const angle = sequenceIndex / pointsPerOrbit * Math.PI * 2 + family * 0.38
      const orientation = family * 0.49 - 0.86
      const horizontalRadius = 0.4 + family * 0.065
      const verticalRadius = 0.15 + family * 0.037
      const horizontal = Math.cos(angle) * horizontalRadius
      const vertical = Math.sin(angle) * verticalRadius
      const orientationCos = Math.cos(orientation)
      const orientationSin = Math.sin(orientation)
      const thickness = (random() - 0.5) * (0.012 + family * 0.003)
      orbitPositions[offset] = horizontal * orientationCos - vertical * orientationSin + thickness
      orbitPositions[offset + 1] = Math.sin(angle * (1.55 + family * 0.08) + family) * (0.055 + family * 0.012) + (random() - 0.5) * 0.026
      orbitPositions[offset + 2] = 0.22 + horizontal * orientationSin + vertical * orientationCos + thickness
      orbitDrift[offset] = 0.004 + random() * 0.008
      orbitDrift[offset + 1] = 0.005 + random() * 0.008
      orbitDrift[offset + 2] = 0.004 + random() * 0.008
      orbitPhases[index] = angle + random() * 0.18
      orbitSpeeds[index] = (family % 2 === 0 ? 1 : -1) * (0.018 + family * 0.004)
      orbitSizes[index] = random() < 0.035 ? 1.8 + random() * 1.2 : 0.72 + random() * 0.58
      orbitWarmMix[index] = family === 1 || family === 3 ? 0.75 + random() * 0.25 : random() * 0.32
    }
    orbitGeometry = new three.BufferGeometry()
    orbitGeometry.setAttribute('position', new three.BufferAttribute(orbitPositions, 3))
    orbitGeometry.setAttribute('drift', new three.BufferAttribute(orbitDrift, 3))
    orbitGeometry.setAttribute('phase', new three.BufferAttribute(orbitPhases, 1))
    orbitGeometry.setAttribute('orbitSpeed', new three.BufferAttribute(orbitSpeeds, 1))
    orbitGeometry.setAttribute('sizeVariation', new three.BufferAttribute(orbitSizes, 1))
    orbitGeometry.setAttribute('warmMix', new three.BufferAttribute(orbitWarmMix, 1))
    orbitMaterial = new three.ShaderMaterial({
      vertexShader: orbitVertexShader,
      fragmentShader: orbitFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uTransitionProgress: { value: 0 },
        uPointSize: { value: 0.0072 },
        uViewportHeight: { value: 1 },
        uFieldIntensity: { value: settings.fieldIntensity },
        uLightColor: { value: new three.Color('#f2f0e8') },
        uWarmColor: { value: new three.Color(accentColor) },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: three.AdditiveBlending,
    })
    orbitPoints = new three.Points(orbitGeometry, orbitMaterial)
    orbitPoints.frustumCulled = false
    orbitPoints.renderOrder = 2
    scene.add(orbitPoints)

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
    logoMaterial.uniforms.uTransitionProgress!.value = reducedMotion ? 1 : 0
    reducedMotionQuery.addEventListener('change', handleReducedMotion)
    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('blur', resetCursorTilt)
    document.documentElement.addEventListener('pointerleave', resetCursorTilt)
    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas.value)
    transitionStartTime = performance.now()
    transitionProgress.value = reducedMotion ? 1 : 0
    particleState.value = reducedMotion ? 'logo' : 'galaxy'
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
            <label>Flow strength <output>{{ settings.flowStrength.toFixed(3) }}</output><input v-model.number="settings.flowStrength" type="range" min="0" max="0.5" step="0.005" /></label>
            <label>Turbulence <output>{{ settings.turbulenceStrength.toFixed(3) }}</output><input v-model.number="settings.turbulenceStrength" type="range" min="0" max="0.2" step="0.005" /></label>
            <label>Idle strength <output>{{ settings.idleStrength.toFixed(3) }}</output><input v-model.number="settings.idleStrength" type="range" min="0" max="0.02" step="0.001" /></label>
            <label>Cursor tilt <output>{{ settings.cursorTiltStrength.toFixed(3) }}</output><input v-model.number="settings.cursorTiltStrength" type="range" min="0" max="0.08" step="0.001" /></label>
            <button class="particle-debug__wide-action" type="button" @click="restartIntro">Replay intro</button>
          </div>
          <div class="particle-debug__group">
            <h2>Orbital field</h2>
            <label>Field radius <output>{{ settings.galaxyRadius.toFixed(2) }}</output><input v-model.number="settings.galaxyRadius" type="range" min="0.35" max="1.5" step="0.01" /></label>
            <label>Rotation speed <output>{{ settings.galaxyRotationSpeed.toFixed(3) }}</output><input v-model.number="settings.galaxyRotationSpeed" type="range" min="-0.3" max="0.3" step="0.005" /></label>
            <label>Field turbulence <output>{{ settings.galaxyTurbulence.toFixed(3) }}</output><input v-model.number="settings.galaxyTurbulence" type="range" min="0" max="0.08" step="0.001" /></label>
            <label>Transition progress <output>{{ transitionProgress.toFixed(2) }}</output><input :value="transitionProgress" type="range" min="0" max="1" step="0.01" @input="setTransitionProgress" /></label>
            <label>Transition duration <output>{{ settings.transitionDuration.toFixed(2) }} s</output><input v-model.number="settings.transitionDuration" type="range" min="0.5" max="2.5" step="0.05" /></label>
            <label>Field intensity <output>{{ settings.fieldIntensity.toFixed(2) }}</output><input v-model.number="settings.fieldIntensity" type="range" min="0" max="1" step="0.01" /></label>
            <label>Ambient intensity <output>{{ settings.ambientIntensity.toFixed(2) }}</output><input v-model.number="settings.ambientIntensity" type="range" min="0" max="0.6" step="0.01" /></label>
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
            <label><input v-model="settings.hideCards" type="checkbox" /> Hide cards</label>
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
