<script setup lang="ts">
import * as THREE from 'three'

const host = ref<HTMLDivElement | null>(null)
const { settings } = usePolygonWaveDebug()

let renderer: THREE.WebGLRenderer | undefined
let scene: THREE.Scene | undefined
let camera: THREE.PerspectiveCamera | undefined
let surfaceGroup: THREE.Group | undefined
let faceGeometry: THREE.BufferGeometry | undefined
let edgeGeometry: THREE.BufferGeometry | undefined
let nodeGeometry: THREE.BufferGeometry | undefined
let faceMaterial: THREE.ShaderMaterial | undefined
let edgeMaterial: THREE.ShaderMaterial | undefined
let nodeMaterial: THREE.ShaderMaterial | undefined
let frameId = 0
let resizeObserver: ResizeObserver | undefined
let lastFrameTime = 0
let elapsedTime = 0
let geometryWidth = 1
let rebuildTimer: ReturnType<typeof setTimeout> | undefined
let isPageVisible = true

const commonVertexShader = /* glsl */`
  uniform float uTime;
  uniform float uWaveSpeed;
  uniform float uWaveAmplitude;
  uniform float uWaveFrequency;
  uniform float uHeightVariation;
  uniform float uHalfWidth;
  uniform float uDepth;
  uniform float uEdgeFadeStrength;
  uniform float uDepthFadeStrength;

  float surfaceDisplacement(vec3 point) {
    float phase = uTime * uWaveSpeed;
    float primary = sin(point.x * uWaveFrequency + phase);
    float crossing = sin(point.x * uWaveFrequency * 0.48 - point.z * uWaveFrequency * 0.72 - phase * 0.71) * 0.58;
    float depthWave = cos(point.z * uWaveFrequency * 0.46 + phase * 0.43) * 0.34;
    return (primary + crossing + depthWave) * (uWaveAmplitude / 1.92);
  }

  float visualFade(vec3 point) {
    float horizontal = clamp(1.0 - abs(point.x) / max(uHalfWidth, 0.001), 0.0, 1.0);
    horizontal = pow(horizontal, max(uEdgeFadeStrength, 0.05));
    float depthPosition = clamp(point.z / max(uDepth, 0.001) + 0.5, 0.0, 1.0);
    float depth = mix(1.0, mix(0.34, 1.0, depthPosition), clamp(uDepthFadeStrength, 0.0, 1.0));
    return horizontal * depth;
  }
`

const faceVertexShader = commonVertexShader + /* glsl */`
  attribute float aPhase;
  attribute float aVisibility;
  varying float vFade;
  varying float vPhase;
  varying float vVisibility;

  void main() {
    vec3 transformed = position;
    transformed.y = transformed.y * uHeightVariation + surfaceDisplacement(transformed);
    vFade = visualFade(transformed);
    vPhase = aPhase;
    vVisibility = aVisibility;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  }
`

const faceFragmentShader = /* glsl */`
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uWaveSpeed;
  uniform float uOpacity;
  uniform float uShimmer;
  uniform float uVisibility;
  varying float vFade;
  varying float vPhase;
  varying float vVisibility;

  void main() {
    if (vVisibility > uVisibility) discard;
    float shimmer = 0.74 + 0.26 * sin(uTime * (0.28 + uWaveSpeed * 0.72) + vPhase);
    shimmer = mix(1.0, shimmer, uShimmer);
    float alpha = uOpacity * shimmer * vFade;
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`

const edgeVertexShader = commonVertexShader + /* glsl */`
  attribute float aStrength;
  varying float vFade;
  varying float vStrength;

  void main() {
    vec3 transformed = position;
    transformed.y = transformed.y * uHeightVariation + surfaceDisplacement(transformed);
    vFade = visualFade(transformed);
    vStrength = aStrength;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  }
`

const edgeFragmentShader = /* glsl */`
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFade;
  varying float vStrength;

  void main() {
    float alpha = uOpacity * vFade * vStrength;
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`

const nodeVertexShader = commonVertexShader + /* glsl */`
  attribute float aEmphasis;
  uniform float uNodeSize;
  uniform float uPixelRatio;
  varying float vFade;
  varying float vEmphasis;

  void main() {
    vec3 transformed = position;
    transformed.y = transformed.y * uHeightVariation + surfaceDisplacement(transformed);
    vFade = visualFade(transformed);
    vEmphasis = aEmphasis;
    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    float perspectiveScale = 12.0 / max(3.0, -mvPosition.z);
    gl_PointSize = clamp(uNodeSize * uPixelRatio * perspectiveScale * mix(0.72, 1.32, vFade) * aEmphasis, 1.0, 18.0 * uPixelRatio);
  }
`

const nodeFragmentShader = /* glsl */`
  uniform vec3 uColor;
  uniform float uBrightness;
  varying float vFade;
  varying float vEmphasis;

  void main() {
    vec2 centered = gl_PointCoord - 0.5;
    float distanceToCenter = length(centered);
    if (distanceToCenter > 0.5) discard;
    float core = smoothstep(0.28, 0.0, distanceToCenter);
    float halo = smoothstep(0.5, 0.08, distanceToCenter) * 0.52;
    float alpha = (core + halo) * vFade * min(1.0, uBrightness * 0.82) * vEmphasis;
    vec3 color = uColor * (1.0 + core * uBrightness * 0.72);
    gl_FragColor = vec4(color, alpha);
  }
`

function seededRandom(seed: number) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return value - Math.floor(value)
}

function createUniforms() {
  return {
    uTime: { value: elapsedTime },
    uWaveSpeed: { value: settings.value.waveSpeed },
    uWaveAmplitude: { value: settings.value.waveAmplitude },
    uWaveFrequency: { value: settings.value.waveFrequency },
    uHeightVariation: { value: settings.value.heightVariation },
    uHalfWidth: { value: geometryWidth * 0.5 },
    uDepth: { value: settings.value.meshDepth },
    uEdgeFadeStrength: { value: settings.value.edgeFadeStrength },
    uDepthFadeStrength: { value: settings.value.depthFadeStrength },
  }
}

function disposeGeometry() {
  faceGeometry?.dispose()
  edgeGeometry?.dispose()
  nodeGeometry?.dispose()
  faceGeometry = undefined
  edgeGeometry = undefined
  nodeGeometry = undefined
  if (surfaceGroup) surfaceGroup.clear()
}

function buildSurface() {
  if (!host.value || !camera || !surfaceGroup) return
  disposeGeometry()
  faceMaterial?.dispose()
  edgeMaterial?.dispose()
  nodeMaterial?.dispose()
  faceMaterial = undefined
  edgeMaterial = undefined
  nodeMaterial = undefined

  const width = Math.max(host.value.clientWidth, 1)
  const height = Math.max(host.value.clientHeight, 1)
  const aspect = width / height
  const distanceToTarget = Math.sqrt(settings.value.cameraDistance ** 2 + 4.2 ** 2)
  const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(settings.value.cameraFov * 0.5)) * distanceToTarget
  geometryWidth = visibleHeight * aspect * settings.value.meshWidth

  const columns = THREE.MathUtils.clamp(Math.round((width / 72) * settings.value.density), 17, 42)
  const rows = THREE.MathUtils.clamp(Math.round(8.5 * settings.value.density), 7, 14)
  const vertexCount = columns * rows
  const positions = new Float32Array(vertexCount * 3)
  const emphasis = new Float32Array(vertexCount)
  const xStep = geometryWidth / (columns - 1)
  const zStep = settings.value.meshDepth / (rows - 1)

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column
      const edgeColumn = column === 0 || column === columns - 1
      const edgeRow = row === 0 || row === rows - 1
      const xJitter = edgeColumn ? 0 : (seededRandom(index + 17) - 0.5) * xStep * 0.34
      const zJitter = edgeRow ? 0 : (seededRandom(index + 53) - 0.5) * zStep * 0.32
      const x = -geometryWidth * 0.5 + column * xStep + xJitter
      const z = -settings.value.meshDepth * 0.5 + row * zStep + zJitter
      const broadShape = Math.sin(x * 0.33 + 0.8) * 0.34 + Math.cos(z * 0.62 - x * 0.08) * 0.24
      const irregularity = (seededRandom(index + 131) - 0.5) * 0.72

      positions[index * 3] = x
      positions[index * 3 + 1] = broadShape + irregularity
      positions[index * 3 + 2] = z
      emphasis[index] = 0.78 + seededRandom(index + 211) * 0.48
    }
  }

  nodeGeometry = new THREE.BufferGeometry()
  nodeGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  nodeGeometry.setAttribute('aEmphasis', new THREE.BufferAttribute(emphasis, 1))

  const triangles: number[][] = []
  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const a = row * columns + column
      const b = a + 1
      const c = a + columns
      const d = c + 1
      if ((row + column) % 2 === 0) {
        triangles.push([a, c, b], [b, c, d])
      } else {
        triangles.push([a, c, d], [a, d, b])
      }
    }
  }

  const facePositions = new Float32Array(triangles.length * 9)
  const facePhases = new Float32Array(triangles.length * 3)
  const faceVisibility = new Float32Array(triangles.length * 3)
  triangles.forEach((triangle, triangleIndex) => {
    const phase = seededRandom(triangleIndex + 307) * Math.PI * 2
    const visibility = seededRandom(triangleIndex + 401)
    triangle.forEach((vertexIndex, corner) => {
      const destination = triangleIndex * 9 + corner * 3
      facePositions[destination] = positions[vertexIndex * 3]!
      facePositions[destination + 1] = positions[vertexIndex * 3 + 1]!
      facePositions[destination + 2] = positions[vertexIndex * 3 + 2]!
      facePhases[triangleIndex * 3 + corner] = phase
      faceVisibility[triangleIndex * 3 + corner] = visibility
    })
  })
  faceGeometry = new THREE.BufferGeometry()
  faceGeometry.setAttribute('position', new THREE.BufferAttribute(facePositions, 3))
  faceGeometry.setAttribute('aPhase', new THREE.BufferAttribute(facePhases, 1))
  faceGeometry.setAttribute('aVisibility', new THREE.BufferAttribute(faceVisibility, 1))

  const uniqueEdges = new Map<string, [number, number]>()
  const registerEdge = (start: number, end: number) => {
    const low = Math.min(start, end)
    const high = Math.max(start, end)
    uniqueEdges.set(`${low}:${high}`, [low, high])
  }
  triangles.forEach(([a, b, c]) => {
    registerEdge(a!, b!)
    registerEdge(b!, c!)
    registerEdge(c!, a!)
  })
  const edgePositions = new Float32Array(uniqueEdges.size * 6)
  const edgeStrengths = new Float32Array(uniqueEdges.size * 2)
  let edgeIndex = 0
  uniqueEdges.forEach(([start, end]) => {
    for (const vertexIndex of [start, end]) {
      const destination = edgeIndex * 6 + (vertexIndex === start ? 0 : 3)
      edgePositions[destination] = positions[vertexIndex * 3]!
      edgePositions[destination + 1] = positions[vertexIndex * 3 + 1]!
      edgePositions[destination + 2] = positions[vertexIndex * 3 + 2]!
    }
    const strength = 0.64 + seededRandom(edgeIndex + 509) * 0.36
    edgeStrengths[edgeIndex * 2] = strength
    edgeStrengths[edgeIndex * 2 + 1] = strength
    edgeIndex += 1
  })
  edgeGeometry = new THREE.BufferGeometry()
  edgeGeometry.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3))
  edgeGeometry.setAttribute('aStrength', new THREE.BufferAttribute(edgeStrengths, 1))

  const color = new THREE.Color('#ffec00')
  faceMaterial = new THREE.ShaderMaterial({
    uniforms: {
      ...createUniforms(),
      uColor: { value: color.clone() },
      uOpacity: { value: settings.value.faceOpacity },
      uShimmer: { value: settings.value.faceShimmer },
      uVisibility: { value: settings.value.faceVisibility },
    },
    vertexShader: faceVertexShader,
    fragmentShader: faceFragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  edgeMaterial = new THREE.ShaderMaterial({
    uniforms: {
      ...createUniforms(),
      uColor: { value: color.clone() },
      uOpacity: { value: settings.value.edgeOpacity },
    },
    vertexShader: edgeVertexShader,
    fragmentShader: edgeFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  nodeMaterial = new THREE.ShaderMaterial({
    uniforms: {
      ...createUniforms(),
      uColor: { value: color.clone() },
      uNodeSize: { value: settings.value.nodeSize },
      uPixelRatio: { value: renderer?.getPixelRatio() ?? 1 },
      uBrightness: { value: settings.value.nodeBrightness },
    },
    vertexShader: nodeVertexShader,
    fragmentShader: nodeFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })

  const faces = new THREE.Mesh(faceGeometry, faceMaterial)
  const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial)
  const nodes = new THREE.Points(nodeGeometry, nodeMaterial)
  faces.renderOrder = 0
  edges.renderOrder = 1
  nodes.renderOrder = 2
  surfaceGroup.add(faces, edges, nodes)
}

function updateMaterial(material: THREE.ShaderMaterial | undefined) {
  if (!material) return
  const uniforms = material.uniforms
  uniforms.uTime!.value = elapsedTime
  uniforms.uWaveSpeed!.value = settings.value.waveSpeed
  uniforms.uWaveAmplitude!.value = settings.value.waveAmplitude
  uniforms.uWaveFrequency!.value = settings.value.waveFrequency
  uniforms.uHeightVariation!.value = settings.value.heightVariation
  uniforms.uHalfWidth!.value = geometryWidth * 0.5
  uniforms.uDepth!.value = settings.value.meshDepth
  uniforms.uEdgeFadeStrength!.value = settings.value.edgeFadeStrength
  uniforms.uDepthFadeStrength!.value = settings.value.depthFadeStrength
}

function updateScene() {
  if (!camera || !surfaceGroup) return
  camera.fov = settings.value.cameraFov
  camera.position.set(0, 4.2, settings.value.cameraDistance)
  camera.lookAt(0, -0.35, 0)
  camera.updateProjectionMatrix()
  surfaceGroup.rotation.set(
    THREE.MathUtils.degToRad(settings.value.rotationX),
    THREE.MathUtils.degToRad(settings.value.rotationY),
    THREE.MathUtils.degToRad(settings.value.rotationZ),
  )
  surfaceGroup.position.y = settings.value.verticalOffset

  updateMaterial(faceMaterial)
  updateMaterial(edgeMaterial)
  updateMaterial(nodeMaterial)
  if (faceMaterial) {
    faceMaterial.uniforms.uOpacity!.value = settings.value.faceOpacity
    faceMaterial.uniforms.uShimmer!.value = settings.value.faceShimmer
    faceMaterial.uniforms.uVisibility!.value = settings.value.faceVisibility
  }
  if (edgeMaterial) edgeMaterial.uniforms.uOpacity!.value = settings.value.edgeOpacity
  if (nodeMaterial) {
    nodeMaterial.uniforms.uNodeSize!.value = settings.value.nodeSize
    nodeMaterial.uniforms.uBrightness!.value = settings.value.nodeBrightness
  }
}

function resize() {
  if (!host.value || !renderer || !camera) return
  const width = Math.max(host.value.clientWidth, 1)
  const height = Math.max(host.value.clientHeight, 1)
  const pixelRatio = Math.min(window.devicePixelRatio, 1.75)
  renderer.setPixelRatio(pixelRatio)
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  if (nodeMaterial) nodeMaterial.uniforms.uPixelRatio!.value = pixelRatio
  buildSurface()
}

function animate(time: number) {
  frameId = window.requestAnimationFrame(animate)
  if (!renderer || !scene || !camera) return
  const delta = lastFrameTime ? Math.min((time - lastFrameTime) / 1000, 0.05) : 0
  lastFrameTime = time
  if (!settings.value.paused && isPageVisible) elapsedTime += delta
  updateScene()
  renderer.render(scene, camera)
}

function scheduleRebuild() {
  if (rebuildTimer) window.clearTimeout(rebuildTimer)
  rebuildTimer = window.setTimeout(buildSurface, 90)
}

function handleVisibilityChange() {
  isPageVisible = document.visibilityState === 'visible'
  lastFrameTime = 0
}

onMounted(() => {
  if (!host.value) return
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(settings.value.cameraFov, 1, 0.1, 100)
  surfaceGroup = new THREE.Group()
  scene.add(surfaceGroup)
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' })
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08
  renderer.domElement.setAttribute('aria-hidden', 'true')
  host.value.appendChild(renderer.domElement)
  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(host.value)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  resize()
  animate(performance.now())
})

watch(
  () => [settings.value.meshWidth, settings.value.meshDepth, settings.value.density, settings.value.cameraFov, settings.value.cameraDistance],
  scheduleRebuild,
)

onBeforeUnmount(() => {
  window.cancelAnimationFrame(frameId)
  if (rebuildTimer) window.clearTimeout(rebuildTimer)
  resizeObserver?.disconnect()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  disposeGeometry()
  faceMaterial?.dispose()
  edgeMaterial?.dispose()
  nodeMaterial?.dispose()
  renderer?.dispose()
  renderer?.forceContextLoss()
  renderer?.domElement.remove()
})
</script>

<template>
  <div ref="host" class="polygon-wave" aria-hidden="true" />
</template>

<style scoped>
.polygon-wave {
  position: absolute;
  z-index: 0;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.polygon-wave :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
