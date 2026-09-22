<script setup lang="ts">
import type * as THREE from 'three'
import { buildConnectedParticleGraph } from '~/utils/connectedParticleGraph'

interface PointData {
  name: string
  count: number
  positions: Array<{ x: number, y: number, z: number }>
}

type ParticleState = 'field' | 'transition' | 'logo'
type LogoMode = 'classic' | 'connected'

const emit = defineEmits<{
  introStart: [reducedMotion: boolean]
  cardsVisibilityChange: [hidden: boolean]
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
const asset = useAssetUrl()
const isDebugPanelOpen = ref(false)
const cameraView = ref<'front' | 'perspective'>('front')
const settings = reactive({
  logoMode: 'connected' as LogoMode,
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
  connectedNodeCount: 900,
  connectedMaxDistance: 0.075,
  connectedMaxNeighbors: 3,
  connectedLineOpacity: 0.34,
  connectedLineIntensity: 1.05,
  connectedNodeSize: 0.009,
  connectedWaveSpeed: 0.34,
  connectedWaveAmplitude: 0.004,
  connectedDepthSpread: 0.055,
  fieldRadius: 0.98,
  fieldDensity: 0.95,
  fieldTurbulence: 0.028,
  fieldStrength: 0.034,
  transitionDuration: 1.05,
  fieldIntensity: 0.88,
  ambientIntensity: 0.18,
  flowStrength: 0.24,
  turbulenceStrength: 0.055,
  idleStrength: 0.002,
  cursorTiltStrength: 0.025,
  fieldVisible: true,
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
  attribute vec3 fieldPosition;
  attribute vec3 randomSeed;
  attribute float phase;
  attribute float delay;
  attribute float sizeVariation;
  attribute float densityRank;
  attribute float fieldWarmMix;

  uniform float uTime;
  uniform float uTransitionProgress;
  uniform float uFieldRadius;
  uniform float uFieldDensity;
  uniform float uFieldTurbulence;
  uniform float uFieldStrength;
  uniform float uFieldIntensity;
  uniform float uFieldVisibility;
  uniform float uFlowStrength;
  uniform float uTurbulenceStrength;
  uniform float uIdleStrength;
  uniform float uPointSize;
  uniform float uViewportHeight;
  uniform float uSizeAttenuation;
  uniform float uLogoDepthSpread;
  uniform float uSizeVariation;
  uniform float uFinalBodyOpacity;

  varying float vDepthBrightness;
  varying float vTransitionProgress;
  varying float vFieldWarmMix;
  varying float vStateAlpha;

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

    vec3 scaledFieldPosition = fieldPosition * uFieldRadius;
    float fieldEnvelope = 1.0 - easedProgress;
    vec3 directionalDrift = vec3(
      0.7 + randomSeed.x * 0.3,
      randomSeed.y * 0.45,
      -0.24 + randomSeed.z * 0.28
    ) * sin(uTime * 0.22 + phase) * uFieldStrength;
    vec3 organicMotion = vec3(
      sin(uTime * 0.37 + phase * 1.7),
      cos(uTime * 0.29 + phase * 1.13),
      sin(uTime * 0.33 + phase * 1.41)
    ) * uFieldTurbulence;
    vec3 animatedFieldPosition = scaledFieldPosition + (directionalDrift + organicMotion) * fieldEnvelope;

    vec3 animatedPosition = mix(animatedFieldPosition, position, easedProgress) + curvedFlow + turbulence;
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
    vFieldWarmMix = fieldWarmMix;
    float densityMask = step(densityRank, mix(uFieldDensity, 1.0, easedProgress));
    float fieldAlpha = uFieldIntensity * uFieldVisibility;
    float finalBodyFade = mix(1.0, uFinalBodyOpacity, smoothstep(0.55, 1.0, easedProgress));
    vStateAlpha = densityMask * mix(fieldAlpha, 1.0, easedProgress) * finalBodyFade;
    gl_Position = projectionMatrix * modelViewPosition;
    float stateSize = mix(0.72, 1.0, easedProgress);
    gl_PointSize = clamp(uPointSize * uViewportHeight * 0.5 * individualSize * perspectiveScale * stateSize, 0.75, 8.0);
  }
`

const logoFragmentShader = `
  uniform vec3 uFieldColor;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uBrightness;

  varying float vDepthBrightness;
  varying float vTransitionProgress;
  varying float vFieldWarmMix;
  varying float vStateAlpha;

  void main() {
    float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
    float core = 1.0 - smoothstep(0.20, 0.40, distanceToCenter);
    float halo = 1.0 - smoothstep(0.34, 0.50, distanceToCenter);
    float particleAlpha = min(1.0, core + halo * 0.20);
    if (particleAlpha <= 0.0) discard;
    vec3 fieldColor = mix(uFieldColor, uColor, vFieldWarmMix);
    vec3 particleColor = mix(fieldColor, uColor, smoothstep(0.12, 0.92, vTransitionProgress));
    gl_FragColor = vec4(particleColor * uBrightness * vDepthBrightness, uOpacity * vStateAlpha * particleAlpha);
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
    vec3 animatedPosition = position + vec3(
      sin(uTime * 0.13 + phase) * drift.x + sin(uTime * 0.07 + phase * 0.37) * drift.x * 1.6,
      cos(uTime * 0.11 + phase * 1.17) * drift.y,
      sin(uTime * 0.09 + phase * 0.83) * drift.z - cos(uTime * 0.06 + phase * 0.41) * drift.z * 0.8
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

const connectedNodeVertexShader = `
  attribute vec3 motionDirection;
  attribute float phase;
  attribute float sizeVariation;

  uniform float uTime;
  uniform float uTransitionProgress;
  uniform float uWaveSpeed;
  uniform float uWaveAmplitude;
  uniform float uDepthSpread;
  uniform float uPointSize;
  uniform float uViewportHeight;
  uniform float uSizeAttenuation;

  varying float vAlpha;
  varying float vBrightness;

  void main() {
    float slowWave = sin(uTime * uWaveSpeed + phase);
    float secondaryWave = sin(uTime * uWaveSpeed * 0.61 + phase * 1.73) * 0.35;
    vec3 animatedPosition = position + motionDirection * (slowWave + secondaryWave) * uWaveAmplitude;
    animatedPosition.y += motionDirection.y * uDepthSpread;
    vec4 modelViewPosition = modelViewMatrix * vec4(animatedPosition, 1.0);
    float cameraDepth = max(0.18, -modelViewPosition.z);
    float perspectiveScale = mix(1.0, 1.0 / cameraDepth, uSizeAttenuation);
    float reveal = smoothstep(0.38, 0.94, uTransitionProgress);
    vAlpha = reveal;
    vBrightness = clamp(0.82 + perspectiveScale * 0.16, 0.82, 1.18);
    gl_Position = projectionMatrix * modelViewPosition;
    gl_PointSize = clamp(uPointSize * uViewportHeight * sizeVariation * perspectiveScale, 1.0, 7.0);
  }
`

const connectedNodeFragmentShader = `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uIntensity;

  varying float vAlpha;
  varying float vBrightness;

  void main() {
    float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
    float core = 1.0 - smoothstep(0.12, 0.32, distanceToCenter);
    float halo = 1.0 - smoothstep(0.28, 0.50, distanceToCenter);
    float particleAlpha = min(1.0, core + halo * 0.28);
    if (particleAlpha <= 0.0) discard;
    gl_FragColor = vec4(uColor * uIntensity * vBrightness, uOpacity * vAlpha * particleAlpha);
  }
`

const connectedLineVertexShader = `
  attribute vec3 motionDirection;
  attribute float phase;
  attribute float edgeStrength;

  uniform float uTime;
  uniform float uTransitionProgress;
  uniform float uWaveSpeed;
  uniform float uWaveAmplitude;
  uniform float uDepthSpread;
  uniform float uLineOpacity;

  varying float vAlpha;
  varying float vBrightness;

  void main() {
    float slowWave = sin(uTime * uWaveSpeed + phase);
    float secondaryWave = sin(uTime * uWaveSpeed * 0.61 + phase * 1.73) * 0.35;
    vec3 animatedPosition = position + motionDirection * (slowWave + secondaryWave) * uWaveAmplitude;
    animatedPosition.y += motionDirection.y * uDepthSpread;
    vec4 modelViewPosition = modelViewMatrix * vec4(animatedPosition, 1.0);
    float cameraDepth = max(0.18, -modelViewPosition.z);
    float reveal = smoothstep(0.44, 1.0, uTransitionProgress);
    vAlpha = uLineOpacity * edgeStrength * reveal;
    vBrightness = clamp(0.82 + 0.12 / cameraDepth, 0.82, 1.18);
    gl_Position = projectionMatrix * modelViewPosition;
  }
`

const connectedLineFragmentShader = `
  uniform vec3 uColor;
  uniform float uIntensity;

  varying float vAlpha;
  varying float vBrightness;

  void main() {
    gl_FragColor = vec4(uColor * uIntensity * vBrightness, vAlpha);
  }
`

let renderer: THREE.WebGLRenderer | undefined
let threeModule: typeof THREE | undefined
let scene: THREE.Scene | undefined
let camera: THREE.PerspectiveCamera | undefined
let logoGeometry: THREE.BufferGeometry | undefined
let logoMaterial: THREE.ShaderMaterial | undefined
let ambientGeometry: THREE.BufferGeometry | undefined
let ambientMaterial: THREE.ShaderMaterial | undefined
let connectedNodeGeometry: THREE.BufferGeometry | undefined
let connectedNodeMaterial: THREE.ShaderMaterial | undefined
let connectedLineGeometry: THREE.BufferGeometry | undefined
let connectedLineMaterial: THREE.ShaderMaterial | undefined
let resizeObserver: ResizeObserver | undefined
let reducedMotionQuery: MediaQueryList | undefined
let logoPoints: THREE.Points | undefined
let ambientPoints: THREE.Points | undefined
let connectedNodes: THREE.Points | undefined
let connectedLines: THREE.LineSegments | undefined
let connectedGroup: THREE.Group | undefined
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
let graphRebuildTimer: ReturnType<typeof setTimeout> | undefined
let graphSignature = ''

/** CPU-side position sets stay isolated so a future morph can replace the target safely. */
let fieldPositions: Float32Array | undefined
let currentPositions: Float32Array | undefined
let targetPositions: Float32Array | undefined
const transitionProgress = ref(0)
const particleState = ref<ParticleState>('field')
const connectedEdgeCount = ref(0)
const transitionDelay = 0.9

function renderScene() {
  if (renderer && scene && camera) renderer.render(scene, camera)
}

function animate(time: number) {
  if (!renderer || !scene || !camera || !logoMaterial || !ambientMaterial) return
  const deltaSeconds = lastFrameTime ? Math.min((time - lastFrameTime) / 1000, 0.05) : 0
  lastFrameTime = time
  const elapsedSeconds = Math.max(0, time - transitionStartTime) / 1000
  const automaticProgress = Math.max(0, Math.min(1, (elapsedSeconds - transitionDelay) / settings.transitionDuration))
  const activeProgress = transitionOverride ? transitionProgress.value : automaticProgress
  const nextState: ParticleState = activeProgress <= 0 ? 'field' : activeProgress >= 1 ? 'logo' : 'transition'
  if (particleState.value !== nextState) particleState.value = nextState
  logoMaterial.uniforms.uTime!.value = time / 1000
  logoMaterial.uniforms.uTransitionProgress!.value = activeProgress
  if (connectedNodeMaterial && connectedLineMaterial) {
    connectedNodeMaterial.uniforms.uTime!.value = time / 1000
    connectedNodeMaterial.uniforms.uTransitionProgress!.value = activeProgress
    connectedLineMaterial.uniforms.uTime!.value = time / 1000
    connectedLineMaterial.uniforms.uTransitionProgress!.value = activeProgress
  }
  if (!transitionOverride && (time - lastProgressUiUpdate > 50 || activeProgress >= 1)) {
    transitionProgress.value = activeProgress
    lastProgressUiUpdate = time
  }
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

function getGraphSignature() {
  return `${Math.round(settings.connectedNodeCount)}:${settings.connectedMaxDistance.toFixed(4)}:${Math.round(settings.connectedMaxNeighbors)}`
}

function rebuildConnectedGraph() {
  if (!threeModule || !targetPositions) return
  const graph = buildConnectedParticleGraph(targetPositions, {
    nodeCount: settings.connectedNodeCount,
    maxConnectionDistance: settings.connectedMaxDistance,
    maxNeighbors: settings.connectedMaxNeighbors,
  })

  const nextNodeGeometry = new threeModule.BufferGeometry()
  nextNodeGeometry.setAttribute('position', new threeModule.BufferAttribute(graph.nodePositions, 3))
  nextNodeGeometry.setAttribute('phase', new threeModule.BufferAttribute(graph.nodePhases, 1))
  nextNodeGeometry.setAttribute('motionDirection', new threeModule.BufferAttribute(graph.nodeDirections, 3))
  nextNodeGeometry.setAttribute('sizeVariation', new threeModule.BufferAttribute(graph.nodeSizes, 1))

  const nextLineGeometry = new threeModule.BufferGeometry()
  nextLineGeometry.setAttribute('position', new threeModule.BufferAttribute(graph.linePositions, 3))
  nextLineGeometry.setAttribute('phase', new threeModule.BufferAttribute(graph.linePhases, 1))
  nextLineGeometry.setAttribute('motionDirection', new threeModule.BufferAttribute(graph.lineDirections, 3))
  nextLineGeometry.setAttribute('edgeStrength', new threeModule.BufferAttribute(graph.lineStrengths, 1))

  connectedNodeGeometry?.dispose()
  connectedLineGeometry?.dispose()
  connectedNodeGeometry = nextNodeGeometry
  connectedLineGeometry = nextLineGeometry
  if (connectedNodes) connectedNodes.geometry = nextNodeGeometry
  if (connectedLines) connectedLines.geometry = nextLineGeometry
  connectedEdgeCount.value = graph.edgeCount
  graphSignature = getGraphSignature()
}

function scheduleConnectedGraphRebuild() {
  if (getGraphSignature() === graphSignature || !targetPositions) return
  if (graphRebuildTimer) clearTimeout(graphRebuildTimer)
  graphRebuildTimer = setTimeout(() => {
    graphRebuildTimer = undefined
    rebuildConnectedGraph()
    if (reducedMotion) renderScene()
  }, 140)
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
  const rotationX = settings.rotationX + cursorTiltX
  const rotationZ = settings.rotationZ + cursorTiltZ
  logoPoints?.rotation.set(rotationX, settings.rotationY, rotationZ)
  logoPoints?.scale.setScalar(settings.scale)
  if (logoPoints) logoPoints.position.z = settings.verticalOffset
  connectedGroup?.rotation.set(rotationX, settings.rotationY, rotationZ)
  connectedGroup?.scale.setScalar(settings.scale)
  if (connectedGroup) connectedGroup.position.z = settings.verticalOffset
  if (ambientPoints) {
    ambientPoints.rotation.set(cursorTiltX * 0.7, 0, cursorTiltZ * 0.7)
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
    logoMaterial.uniforms.uFieldRadius!.value = settings.fieldRadius
    logoMaterial.uniforms.uFieldDensity!.value = settings.fieldDensity
    logoMaterial.uniforms.uFieldTurbulence!.value = reducedMotion ? 0 : settings.fieldTurbulence
    logoMaterial.uniforms.uFieldStrength!.value = reducedMotion ? 0 : settings.fieldStrength
    logoMaterial.uniforms.uFieldIntensity!.value = settings.fieldIntensity
    logoMaterial.uniforms.uFieldVisibility!.value = settings.fieldVisible ? 1 : 0
    logoMaterial.uniforms.uFlowStrength!.value = settings.flowStrength
    logoMaterial.uniforms.uTurbulenceStrength!.value = settings.turbulenceStrength
    logoMaterial.uniforms.uIdleStrength!.value = reducedMotion ? 0 : settings.idleStrength
    logoMaterial.uniforms.uBrightness!.value = settings.logoBrightness
    logoMaterial.uniforms.uFinalBodyOpacity!.value = settings.logoMode === 'connected' ? 0.2 : 1
  }
  if (ambientMaterial) {
    ambientMaterial.uniforms.uSizeAttenuation!.value = settings.sizeAttenuation
    ambientMaterial.uniforms.uAmbientDepthSpread!.value = settings.ambientDepthSpread
    ambientMaterial.uniforms.uSizeVariation!.value = settings.particleSizeVariation
    ambientMaterial.uniforms.uOpacity!.value = settings.ambientIntensity
  }
  if (connectedNodeMaterial) {
    connectedNodeMaterial.uniforms.uWaveSpeed!.value = reducedMotion ? 0 : settings.connectedWaveSpeed
    connectedNodeMaterial.uniforms.uWaveAmplitude!.value = reducedMotion ? 0 : settings.connectedWaveAmplitude
    connectedNodeMaterial.uniforms.uDepthSpread!.value = settings.connectedDepthSpread
    connectedNodeMaterial.uniforms.uPointSize!.value = settings.connectedNodeSize
    connectedNodeMaterial.uniforms.uSizeAttenuation!.value = settings.sizeAttenuation
    connectedNodeMaterial.uniforms.uIntensity!.value = settings.connectedLineIntensity
  }
  if (connectedLineMaterial) {
    connectedLineMaterial.uniforms.uWaveSpeed!.value = reducedMotion ? 0 : settings.connectedWaveSpeed
    connectedLineMaterial.uniforms.uWaveAmplitude!.value = reducedMotion ? 0 : settings.connectedWaveAmplitude
    connectedLineMaterial.uniforms.uDepthSpread!.value = settings.connectedDepthSpread
    connectedLineMaterial.uniforms.uLineOpacity!.value = settings.connectedLineOpacity
    connectedLineMaterial.uniforms.uIntensity!.value = settings.connectedLineIntensity
  }
  if (connectedGroup) connectedGroup.visible = settings.logoMode === 'connected'
  scheduleConnectedGraphRebuild()
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
  particleState.value = 'field'
  transitionStartTime = performance.now()
  logoMaterial.uniforms.uTransitionProgress!.value = 0
  if (connectedNodeMaterial) connectedNodeMaterial.uniforms.uTransitionProgress!.value = 0
  if (connectedLineMaterial) connectedLineMaterial.uniforms.uTransitionProgress!.value = 0
}

function setTransitionProgress(event: Event) {
  const input = event.target as HTMLInputElement
  transitionOverride = true
  transitionProgress.value = Number(input.value)
  particleState.value = transitionProgress.value <= 0 ? 'field' : transitionProgress.value >= 1 ? 'logo' : 'transition'
  if (logoMaterial) logoMaterial.uniforms.uTransitionProgress!.value = transitionProgress.value
  if (connectedNodeMaterial) connectedNodeMaterial.uniforms.uTransitionProgress!.value = transitionProgress.value
  if (connectedLineMaterial) connectedLineMaterial.uniforms.uTransitionProgress!.value = transitionProgress.value
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
  if (connectedNodeMaterial) connectedNodeMaterial.uniforms.uViewportHeight!.value = height * pixelRatio
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
  if (connectedNodeMaterial) connectedNodeMaterial.uniforms.uTransitionProgress!.value = reducedMotion ? 1 : 0
  if (connectedLineMaterial) connectedLineMaterial.uniforms.uTransitionProgress!.value = reducedMotion ? 1 : 0
  transitionOverride = false
  transitionProgress.value = reducedMotion ? 1 : 0
  particleState.value = reducedMotion ? 'logo' : 'field'
  if (!reducedMotion) transitionStartTime = performance.now()
  lastFrameTime = 0
  applySettings()
  syncAnimationLoop()
}

function dispose() {
  disposed = true
  if (graphRebuildTimer) clearTimeout(graphRebuildTimer)
  graphRebuildTimer = undefined
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
  connectedNodeGeometry?.dispose()
  connectedNodeMaterial?.dispose()
  connectedLineGeometry?.dispose()
  connectedLineMaterial?.dispose()
  renderer?.dispose()
  renderer = undefined
  scene = undefined
  camera = undefined
  logoGeometry = undefined
  logoMaterial = undefined
  ambientGeometry = undefined
  ambientMaterial = undefined
  connectedNodeGeometry = undefined
  connectedNodeMaterial = undefined
  connectedLineGeometry = undefined
  connectedLineMaterial = undefined
  logoPoints = undefined
  ambientPoints = undefined
  connectedNodes = undefined
  connectedLines = undefined
  connectedGroup = undefined
  axesHelper = undefined
  gridHelper = undefined
  currentPositions = undefined
  fieldPositions = undefined
  targetPositions = undefined
  threeModule = undefined
  graphSignature = ''
  connectedEdgeCount.value = 0
  transitionOverride = false
  transitionProgress.value = 0
  particleState.value = 'field'
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
    threeModule = three

    const sessionSeed = crypto.getRandomValues(new Uint32Array(1))[0] ?? Date.now()
    const random = createRandom(sessionSeed)
    const pointCount = data.positions.length
    targetPositions = new Float32Array(pointCount * 3)
    fieldPositions = new Float32Array(pointCount * 3)
    const randomSeeds = new Float32Array(pointCount * 3)
    const phases = new Float32Array(pointCount)
    const delays = new Float32Array(pointCount)
    const logoSizes = new Float32Array(pointCount)
    const densityRanks = new Float32Array(pointCount)
    const fieldWarmMix = new Float32Array(pointCount)

    data.positions.forEach(({ x, y, z }, index) => {
      const offset = index * 3
      const isCoreParticle = random() < 0.34
      const radius = Math.pow(random(), isCoreParticle ? 2.35 : 0.68)
      const azimuth = random() * Math.PI * 2
      const verticalSeed = random() * 2 - 1
      const planarScale = Math.sqrt(Math.max(0, 1 - verticalSeed * verticalSeed))
      const baseX = Math.cos(azimuth) * planarScale * radius
      const baseZ = Math.sin(azimuth) * planarScale * radius
      const baseDepth = verticalSeed * radius
      const warpX = Math.sin(baseZ * 7.4 + baseDepth * 3.1) * (0.035 + radius * 0.045)
      const warpZ = Math.sin(baseX * 5.2 - baseDepth * 4.3) * (0.025 + radius * 0.035)
      const directionalBias = (baseZ * baseZ - 0.16) * 0.18 + (random() - 0.5) * 0.08
      targetPositions![offset] = x
      targetPositions![offset + 1] = y
      targetPositions![offset + 2] = z
      fieldPositions![offset] = baseX * 1.12 + warpX + directionalBias
      fieldPositions![offset + 1] = baseDepth * 0.58 + Math.sin(baseX * 6.1 + baseZ * 3.7) * 0.035 + (random() - 0.5) * 0.045
      fieldPositions![offset + 2] = 0.22 + baseZ * 0.72 + warpZ + Math.max(0, baseX) * 0.05
      randomSeeds[offset] = random() * 2 - 1
      randomSeeds[offset + 1] = random() * 2 - 1
      randomSeeds[offset + 2] = random() * 2 - 1
      phases[index] = random() * Math.PI * 2
      delays[index] = Math.pow(random(), 1.8) * 0.14
      logoSizes[index] = 0.9 + random() * 0.2
      densityRanks[index] = random()
      fieldWarmMix[index] = random() < 0.14 ? 0.18 + random() * 0.48 : random() * 0.055
    })
    currentPositions = fieldPositions.slice()

    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || '#ffec00'
    scene = new three.Scene()
    camera = new three.PerspectiveCamera(40, 1, 0.1, 10)
    updateCamera()

    logoGeometry = new three.BufferGeometry()
    logoGeometry.setAttribute('position', new three.BufferAttribute(targetPositions, 3))
    logoGeometry.setAttribute('fieldPosition', new three.BufferAttribute(fieldPositions, 3))
    logoGeometry.setAttribute('randomSeed', new three.BufferAttribute(randomSeeds, 3))
    logoGeometry.setAttribute('phase', new three.BufferAttribute(phases, 1))
    logoGeometry.setAttribute('delay', new three.BufferAttribute(delays, 1))
    logoGeometry.setAttribute('sizeVariation', new three.BufferAttribute(logoSizes, 1))
    logoGeometry.setAttribute('densityRank', new three.BufferAttribute(densityRanks, 1))
    logoGeometry.setAttribute('fieldWarmMix', new three.BufferAttribute(fieldWarmMix, 1))
    logoMaterial = new three.ShaderMaterial({
      vertexShader: logoVertexShader,
      fragmentShader: logoFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uTransitionProgress: { value: 0 },
        uFieldRadius: { value: settings.fieldRadius },
        uFieldDensity: { value: settings.fieldDensity },
        uFieldTurbulence: { value: settings.fieldTurbulence },
        uFieldStrength: { value: settings.fieldStrength },
        uFieldIntensity: { value: settings.fieldIntensity },
        uFieldVisibility: { value: settings.fieldVisible ? 1 : 0 },
        uFlowStrength: { value: settings.flowStrength },
        uTurbulenceStrength: { value: settings.turbulenceStrength },
        uIdleStrength: { value: settings.idleStrength },
        uPointSize: { value: settings.pointSize },
        uViewportHeight: { value: 1 },
        uSizeAttenuation: { value: settings.sizeAttenuation },
        uLogoDepthSpread: { value: settings.logoDepthSpread },
        uSizeVariation: { value: settings.particleSizeVariation },
        uFinalBodyOpacity: { value: settings.logoMode === 'connected' ? 0.2 : 1 },
        uFieldColor: { value: new three.Color('#e4e9e7') },
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

    rebuildConnectedGraph()
    connectedNodeMaterial = new three.ShaderMaterial({
      vertexShader: connectedNodeVertexShader,
      fragmentShader: connectedNodeFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uTransitionProgress: { value: 0 },
        uWaveSpeed: { value: settings.connectedWaveSpeed },
        uWaveAmplitude: { value: settings.connectedWaveAmplitude },
        uDepthSpread: { value: settings.connectedDepthSpread },
        uPointSize: { value: settings.connectedNodeSize },
        uViewportHeight: { value: 1 },
        uSizeAttenuation: { value: settings.sizeAttenuation },
        uColor: { value: new three.Color(accentColor) },
        uOpacity: { value: 0.9 },
        uIntensity: { value: settings.connectedLineIntensity },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: three.AdditiveBlending,
    })
    connectedLineMaterial = new three.ShaderMaterial({
      vertexShader: connectedLineVertexShader,
      fragmentShader: connectedLineFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uTransitionProgress: { value: 0 },
        uWaveSpeed: { value: settings.connectedWaveSpeed },
        uWaveAmplitude: { value: settings.connectedWaveAmplitude },
        uDepthSpread: { value: settings.connectedDepthSpread },
        uLineOpacity: { value: settings.connectedLineOpacity },
        uColor: { value: new three.Color(accentColor) },
        uIntensity: { value: settings.connectedLineIntensity },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: three.AdditiveBlending,
    })
    connectedNodes = new three.Points(connectedNodeGeometry, connectedNodeMaterial)
    connectedLines = new three.LineSegments(connectedLineGeometry, connectedLineMaterial)
    connectedNodes.frustumCulled = false
    connectedLines.frustumCulled = false
    connectedNodes.renderOrder = 3
    connectedLines.renderOrder = 2
    connectedGroup = new three.Group()
    connectedGroup.add(connectedLines, connectedNodes)
    connectedGroup.visible = settings.logoMode === 'connected'
    scene.add(connectedGroup)

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
    connectedNodeMaterial.uniforms.uTransitionProgress!.value = reducedMotion ? 1 : 0
    connectedLineMaterial.uniforms.uTransitionProgress!.value = reducedMotion ? 1 : 0
    reducedMotionQuery.addEventListener('change', handleReducedMotion)
    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('blur', resetCursorTilt)
    document.documentElement.addEventListener('pointerleave', resetCursorTilt)
    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas.value)
    transitionStartTime = performance.now()
    transitionProgress.value = reducedMotion ? 1 : 0
    particleState.value = reducedMotion ? 'logo' : 'field'
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
            <h2>Logo mode</h2>
            <label>Renderer
              <select v-model="settings.logoMode">
                <option value="classic">Classic</option>
                <option value="connected">Connected</option>
              </select>
            </label>
          </div>
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
            <h2>Particle field</h2>
            <label class="particle-debug__check"><input v-model="settings.fieldVisible" type="checkbox" /> Field visible</label>
            <label>Field radius <output>{{ settings.fieldRadius.toFixed(2) }}</output><input v-model.number="settings.fieldRadius" type="range" min="0.35" max="1.5" step="0.01" /></label>
            <label>Field density <output>{{ settings.fieldDensity.toFixed(2) }}</output><input v-model.number="settings.fieldDensity" type="range" min="0.1" max="1" step="0.01" /></label>
            <label>Field turbulence <output>{{ settings.fieldTurbulence.toFixed(3) }}</output><input v-model.number="settings.fieldTurbulence" type="range" min="0" max="0.08" step="0.001" /></label>
            <label>Field strength <output>{{ settings.fieldStrength.toFixed(3) }}</output><input v-model.number="settings.fieldStrength" type="range" min="0" max="0.12" step="0.002" /></label>
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
          <div v-if="settings.logoMode === 'connected'" class="particle-debug__group">
            <h2>Connected network</h2>
            <p class="particle-debug__meta">{{ settings.connectedNodeCount }} nodes · {{ connectedEdgeCount }} edges</p>
            <label>Graph node count <output>{{ settings.connectedNodeCount }}</output><input v-model.number="settings.connectedNodeCount" type="range" min="600" max="1500" step="50" /></label>
            <label>Max connection distance <output>{{ settings.connectedMaxDistance.toFixed(3) }}</output><input v-model.number="settings.connectedMaxDistance" type="range" min="0.035" max="0.14" step="0.005" /></label>
            <label>Max neighbors <output>{{ settings.connectedMaxNeighbors }}</output><input v-model.number="settings.connectedMaxNeighbors" type="range" min="1" max="6" step="1" /></label>
            <label>Line opacity <output>{{ settings.connectedLineOpacity.toFixed(2) }}</output><input v-model.number="settings.connectedLineOpacity" type="range" min="0" max="1" step="0.01" /></label>
            <label>Line intensity <output>{{ settings.connectedLineIntensity.toFixed(2) }}</output><input v-model.number="settings.connectedLineIntensity" type="range" min="0.25" max="2" step="0.05" /></label>
            <label>Node size <output>{{ settings.connectedNodeSize.toFixed(3) }}</output><input v-model.number="settings.connectedNodeSize" type="range" min="0.002" max="0.02" step="0.001" /></label>
            <label>Wave speed <output>{{ settings.connectedWaveSpeed.toFixed(2) }}</output><input v-model.number="settings.connectedWaveSpeed" type="range" min="0" max="1.2" step="0.02" /></label>
            <label>Wave amplitude <output>{{ settings.connectedWaveAmplitude.toFixed(3) }}</output><input v-model.number="settings.connectedWaveAmplitude" type="range" min="0" max="0.02" step="0.001" /></label>
            <label>Depth spread <output>{{ settings.connectedDepthSpread.toFixed(3) }}</output><input v-model.number="settings.connectedDepthSpread" type="range" min="0" max="0.15" step="0.005" /></label>
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
.particle-debug select { min-width: 118px; padding: 5px 7px; border: 1px solid rgb(157 235 231 / 35%); border-radius: 4px; background: #141d1e; color: inherit; }
.particle-debug__meta { margin: 0; color: rgb(232 245 245 / 65%); font-size: 11px; font-variant-numeric: tabular-nums; }
.particle-debug input[type='range'] { grid-column: 1 / -1; width: 100%; accent-color: #9debe7; }
.particle-debug__actions { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.particle-debug__actions button, .particle-debug__wide-action { padding: 6px; border: 1px solid rgb(157 235 231 / 35%); border-radius: 4px; background: transparent; color: inherit; cursor: pointer; }
.particle-debug__actions button.is-active { background: rgb(157 235 231 / 20%); border-color: #9debe7; }
.particle-debug__switches label, .particle-debug label.particle-debug__check { grid-template-columns: auto 1fr; justify-content: start; }
.particle-debug__switches input, .particle-debug__check input { accent-color: #9debe7; }
@media (max-width: 599px) { .particle-debug { bottom: 8px; left: 8px; width: min(290px, calc(100vw - 16px)); } }
</style>
