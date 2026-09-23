<script setup lang="ts">
import * as THREE from 'three'

type TopologyVariant = 0 | 1

interface CellRuntime {
  id: number
  eligible: boolean
  current: TopologyVariant
  target: TopologyVariant
  transitioning: boolean
  transitionStart: number
  lastChanged: number
  faceOffsets: [number, number]
  edgeOffsets: [number, number]
  vertexIndices: [number, number, number, number]
}

interface CellCandidate {
  state: CellRuntime
  score: number
}

const host = ref<HTMLDivElement | null>(null)
const { settings, diagnostics } = usePolygonWaveDebug()

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
let maskMaterial: THREE.ShaderMaterial | undefined
let blurMaterial: THREE.ShaderMaterial | undefined
let compositeMaterial: THREE.ShaderMaterial | undefined
let maskScene: THREE.Scene | undefined
let maskGroup: THREE.Group | undefined
let postScene: THREE.Scene | undefined
let postCamera: THREE.OrthographicCamera | undefined
let postQuad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | undefined
let sharpTarget: THREE.WebGLRenderTarget | undefined
let maskTarget: THREE.WebGLRenderTarget | undefined
let blurTargetA: THREE.WebGLRenderTarget | undefined
let blurTargetB: THREE.WebGLRenderTarget | undefined
let faceTopologyAttribute: THREE.BufferAttribute | undefined
let edgeTopologyAttribute: THREE.BufferAttribute | undefined
let faceChangingAttribute: THREE.BufferAttribute | undefined
let edgeChangingAttribute: THREE.BufferAttribute | undefined
let basePositions: Float32Array | undefined
let frameId = 0
let resizeObserver: ResizeObserver | undefined
let reducedMotionQuery: MediaQueryList | undefined
let lastFrameTime = 0
let elapsedTime = 0
let geometryWidth = 1
let rebuildTimer: ReturnType<typeof setTimeout> | undefined
let isPageVisible = true
let reducedMotion = false
let nextConnectionTime = 0
let connectionSequence = 0
let connectionsWereEnabled = false
let handledManualTestRequest = 0
let manualTransitionCellId: number | null = null
let candidateCache: CellCandidate[] = []
let candidateCacheTimestamp = -Infinity
let postFullWidth = 0
let postFullHeight = 0
let postBlurWidth = 0
let postBlurHeight = 0
let cellStates: CellRuntime[] = []

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

const highlightShader = /* glsl */`
  uniform float uHighlightsEnabled;
  uniform float uHighlightFraction;
  uniform float uHighlightCycleDuration;

  float highlightAccent(float seedValue) {
    if (uHighlightsEnabled < 0.5) return 0.0;
    float cycle = max(uHighlightCycleDuration, 0.1);
    float phase = fract(uTime / cycle + seedValue);
    float circularDistance = min(phase, 1.0 - phase);
    float halfWidth = max(uHighlightFraction * 0.5, 0.005);
    return 1.0 - smoothstep(0.0, halfWidth, circularDistance);
  }
`

const faceVertexShader = commonVertexShader + /* glsl */`
  attribute float aPhase;
  attribute float aVisibility;
  attribute float aTopologyWeight;
  attribute float aChanging;
  varying float vFade;
  varying float vPhase;
  varying float vVisibility;
  varying float vTopologyWeight;
  varying float vChanging;

  void main() {
    vec3 transformed = position;
    transformed.y = transformed.y * uHeightVariation + surfaceDisplacement(transformed);
    vFade = visualFade(transformed);
    vPhase = aPhase;
    vVisibility = aVisibility;
    vTopologyWeight = aTopologyWeight;
    vChanging = aChanging;
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
  uniform float uHighlightChangingCells;
  varying float vFade;
  varying float vPhase;
  varying float vVisibility;
  varying float vTopologyWeight;
  varying float vChanging;

  void main() {
    if (vVisibility > uVisibility || vTopologyWeight < 0.002) discard;
    float shimmer = 0.74 + 0.26 * sin(uTime * (0.28 + uWaveSpeed * 0.72) + vPhase);
    shimmer = mix(1.0, shimmer, uShimmer);
    float alpha = uOpacity * shimmer * vFade * vTopologyWeight;
    if (alpha < 0.002) discard;
    float debugHighlight = uHighlightChangingCells * vChanging;
    vec3 color = mix(uColor, vec3(1.0, 0.24, 0.78), debugHighlight * 0.82);
    gl_FragColor = vec4(color, alpha * (1.0 + debugHighlight * 0.6));
  }
`

const edgeVertexShader = commonVertexShader + highlightShader + /* glsl */`
  attribute float aStrength;
  attribute float aHighlightSeed;
  attribute float aTopologyWeight;
  attribute float aChanging;
  varying float vFade;
  varying float vStrength;
  varying float vAccent;
  varying float vTopologyWeight;
  varying float vChanging;

  void main() {
    vec3 transformed = position;
    transformed.y = transformed.y * uHeightVariation + surfaceDisplacement(transformed);
    vFade = visualFade(transformed);
    vStrength = aStrength;
    vAccent = highlightAccent(aHighlightSeed);
    vTopologyWeight = aTopologyWeight;
    vChanging = aChanging;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  }
`

const edgeFragmentShader = /* glsl */`
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uConnectedEdgeEmphasis;
  uniform float uHighlightChangingCells;
  varying float vFade;
  varying float vStrength;
  varying float vAccent;
  varying float vTopologyWeight;
  varying float vChanging;

  void main() {
    float emphasis = 1.0 + vAccent * uConnectedEdgeEmphasis;
    float alpha = uOpacity * vFade * vStrength * vTopologyWeight * emphasis;
    if (alpha < 0.002) discard;
    float debugHighlight = uHighlightChangingCells * vChanging;
    vec3 color = mix(uColor, vec3(1.0, 0.95, 0.62), vAccent * 0.45);
    color = mix(color, vec3(1.0, 0.24, 0.78), debugHighlight * 0.88);
    gl_FragColor = vec4(color, alpha * (1.0 + debugHighlight));
  }
`

const nodeVertexShader = commonVertexShader + highlightShader + /* glsl */`
  attribute float aEmphasis;
  attribute float aHighlightSeed;
  uniform float uNodeSize;
  uniform float uPixelRatio;
  varying float vFade;
  varying float vEmphasis;
  varying float vAccent;

  void main() {
    vec3 transformed = position;
    transformed.y = transformed.y * uHeightVariation + surfaceDisplacement(transformed);
    vFade = visualFade(transformed);
    vEmphasis = aEmphasis;
    vAccent = highlightAccent(aHighlightSeed);
    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float viewDistance = max(0.0, -mvPosition.z);
    float perspectiveScale = 12.0 / max(3.0, viewDistance);
    float accentScale = 1.0 + vAccent * 0.18;
    gl_PointSize = clamp(uNodeSize * uPixelRatio * perspectiveScale * mix(0.72, 1.32, vFade) * aEmphasis * accentScale, 1.0, 22.0 * uPixelRatio);
  }
`

const nodeFragmentShader = /* glsl */`
  uniform vec3 uColor;
  uniform float uBrightness;
  uniform float uHighlightIntensity;
  uniform float uNodeHaloStrength;
  varying float vFade;
  varying float vEmphasis;
  varying float vAccent;

  void main() {
    vec2 centered = gl_PointCoord - 0.5;
    float distanceToCenter = length(centered);
    if (distanceToCenter > 0.5) discard;

    float core = smoothstep(0.28, 0.0, distanceToCenter);
    float halo = smoothstep(0.5, 0.08, distanceToCenter) * uNodeHaloStrength;
    float highlightGain = 1.0 + vAccent * uHighlightIntensity;
    float alpha = (core + halo) * vFade * min(1.0, uBrightness * 0.82) * vEmphasis * highlightGain;
    vec3 warmCore = vec3(1.0, 0.96, 0.72);
    vec3 color = mix(uColor, warmCore, core * vAccent * 0.78) * (1.0 + core * uBrightness * 0.62);
    gl_FragColor = vec4(color, alpha);
  }
`

const maskVertexShader = commonVertexShader + /* glsl */`
  attribute float aTopologyWeight;
  varying float vTopologyWeight;
  varying float vViewDistance;

  void main() {
    vec3 transformed = position;
    transformed.y = transformed.y * uHeightVariation + surfaceDisplacement(transformed);
    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
    vTopologyWeight = aTopologyWeight;
    vViewDistance = max(0.0, -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const maskFragmentShader = /* glsl */`
  uniform float uFocusDistance;
  uniform float uNearTransitionRange;
  varying float vTopologyWeight;
  varying float vViewDistance;

  void main() {
    float nearStart = max(0.0, uFocusDistance - uNearTransitionRange);
    float nearAmount = 1.0 - smoothstep(nearStart, uFocusDistance, vViewDistance);
    float value = nearAmount * vTopologyWeight;
    if (value < 0.001) discard;
    gl_FragColor = vec4(vec3(value), value);
  }
`

const postVertexShader = /* glsl */`
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const blurFragmentShader = /* glsl */`
  uniform sampler2D uSource;
  uniform vec2 uTexelSize;
  uniform vec2 uDirection;
  uniform float uRadius;
  varying vec2 vUv;

  void main() {
    vec2 stepOffset = uTexelSize * uDirection * uRadius;
    vec4 color = texture2D(uSource, vUv) * 0.227027;
    color += texture2D(uSource, vUv + stepOffset * 0.384615) * 0.316216;
    color += texture2D(uSource, vUv - stepOffset * 0.384615) * 0.316216;
    color += texture2D(uSource, vUv + stepOffset) * 0.070270;
    color += texture2D(uSource, vUv - stepOffset) * 0.070270;
    gl_FragColor = color;
  }
`

const compositeFragmentShader = /* glsl */`
  uniform sampler2D uSharp;
  uniform sampler2D uBlurred;
  uniform sampler2D uMask;
  uniform vec2 uMaskTexelSize;
  uniform float uMaskSpread;
  uniform float uStrength;
  uniform float uShowMask;
  varying vec2 vUv;

  void main() {
    vec2 spread = uMaskTexelSize * uMaskSpread;
    float maskValue = texture2D(uMask, vUv).r;
    maskValue = max(maskValue, texture2D(uMask, vUv + vec2(spread.x, 0.0)).r * 0.88);
    maskValue = max(maskValue, texture2D(uMask, vUv - vec2(spread.x, 0.0)).r * 0.88);
    maskValue = max(maskValue, texture2D(uMask, vUv + vec2(0.0, spread.y)).r * 0.88);
    maskValue = max(maskValue, texture2D(uMask, vUv - vec2(0.0, spread.y)).r * 0.88);
    maskValue = smoothstep(0.0, 1.0, maskValue);

    if (uShowMask > 0.5) {
      gl_FragColor = vec4(vec3(maskValue), maskValue * 0.9);
      return;
    }

    vec4 sharp = texture2D(uSharp, vUv);
    vec4 blurred = texture2D(uBlurred, vUv);
    gl_FragColor = mix(sharp, blurred, maskValue * uStrength);
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

function createHighlightUniforms() {
  return {
    uHighlightsEnabled: { value: settings.value.highlightsEnabled ? 1 : 0 },
    uHighlightFraction: { value: settings.value.highlightFraction },
    uHighlightCycleDuration: { value: settings.value.highlightCycleDuration },
  }
}

function createRenderTarget(width = 1, height = 1) {
  return new THREE.WebGLRenderTarget(width, height, {
    depthBuffer: false,
    stencilBuffer: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
  })
}

function initializePostProcessing() {
  maskScene = new THREE.Scene()
  maskGroup = new THREE.Group()
  maskScene.add(maskGroup)
  postScene = new THREE.Scene()
  postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  sharpTarget = createRenderTarget()
  maskTarget = createRenderTarget()
  blurTargetA = createRenderTarget()
  blurTargetB = createRenderTarget()

  maskMaterial = new THREE.ShaderMaterial({
    uniforms: {
      ...createUniforms(),
      uFocusDistance: { value: settings.value.focusDistance },
      uNearTransitionRange: { value: settings.value.nearTransitionRange },
    },
    vertexShader: maskVertexShader,
    fragmentShader: maskFragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendEquationAlpha: THREE.AddEquation,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneFactor,
    side: THREE.DoubleSide,
    toneMapped: false,
  })

  blurMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uSource: { value: null },
      uTexelSize: { value: new THREE.Vector2(1, 1) },
      uDirection: { value: new THREE.Vector2(1, 0) },
      uRadius: { value: settings.value.maxBlurRadius },
    },
    vertexShader: postVertexShader,
    fragmentShader: blurFragmentShader,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
    toneMapped: false,
  })

  compositeMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uSharp: { value: sharpTarget.texture },
      uBlurred: { value: blurTargetB.texture },
      uMask: { value: maskTarget.texture },
      uMaskTexelSize: { value: new THREE.Vector2(1, 1) },
      uMaskSpread: { value: settings.value.maxBlurRadius },
      uStrength: { value: settings.value.blurStrength },
      uShowMask: { value: settings.value.showBlurMask ? 1 : 0 },
    },
    vertexShader: postVertexShader,
    fragmentShader: compositeFragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
    toneMapped: false,
  })

  postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurMaterial)
  postQuad.frustumCulled = false
  postScene.add(postQuad)
}

function resizePostProcessing(width: number, height: number, pixelRatio: number) {
  if (!sharpTarget || !maskTarget || !blurTargetA || !blurTargetB) return
  const fullWidth = Math.max(1, Math.round(width * pixelRatio))
  const fullHeight = Math.max(1, Math.round(height * pixelRatio))
  const renderScale = THREE.MathUtils.clamp(settings.value.blurRenderScale, 0.25, 1)
  const blurWidth = Math.max(1, Math.round(fullWidth * renderScale))
  const blurHeight = Math.max(1, Math.round(fullHeight * renderScale))
  if (fullWidth !== postFullWidth || fullHeight !== postFullHeight) {
    sharpTarget.setSize(fullWidth, fullHeight)
    maskTarget.setSize(fullWidth, fullHeight)
    postFullWidth = fullWidth
    postFullHeight = fullHeight
  }
  if (blurWidth !== postBlurWidth || blurHeight !== postBlurHeight) {
    blurTargetA.setSize(blurWidth, blurHeight)
    blurTargetB.setSize(blurWidth, blurHeight)
    postBlurWidth = blurWidth
    postBlurHeight = blurHeight
  }
}

function disposePostProcessing() {
  postQuad?.geometry.dispose()
  maskMaterial?.dispose()
  blurMaterial?.dispose()
  compositeMaterial?.dispose()
  sharpTarget?.dispose()
  maskTarget?.dispose()
  blurTargetA?.dispose()
  blurTargetB?.dispose()
  postScene?.clear()
  maskScene?.clear()
  postQuad = undefined
  maskMaterial = undefined
  blurMaterial = undefined
  compositeMaterial = undefined
  sharpTarget = undefined
  maskTarget = undefined
  blurTargetA = undefined
  blurTargetB = undefined
}

function disposeGeometry() {
  faceGeometry?.dispose()
  edgeGeometry?.dispose()
  nodeGeometry?.dispose()
  faceGeometry = undefined
  edgeGeometry = undefined
  nodeGeometry = undefined
  faceTopologyAttribute = undefined
  edgeTopologyAttribute = undefined
  faceChangingAttribute = undefined
  edgeChangingAttribute = undefined
  basePositions = undefined
  cellStates = []
  candidateCache = []
  candidateCacheTimestamp = -Infinity
  if (surfaceGroup) surfaceGroup.clear()
  maskGroup?.clear()
}

function pointCross(positions: Float32Array, first: number, second: number, third: number) {
  const ax = positions[first * 3]!
  const az = positions[first * 3 + 2]!
  const bx = positions[second * 3]!
  const bz = positions[second * 3 + 2]!
  const cx = positions[third * 3]!
  const cz = positions[third * 3 + 2]!
  return (bx - ax) * (cz - az) - (bz - az) * (cx - ax)
}

function isConvexCell(positions: Float32Array, a: number, b: number, c: number, d: number) {
  const order = [a, b, d, c]
  let sign = 0
  for (let index = 0; index < 4; index += 1) {
    const cross = pointCross(positions, order[index]!, order[(index + 1) % 4]!, order[(index + 2) % 4]!)
    if (Math.abs(cross) < 0.0001) return false
    const currentSign = Math.sign(cross)
    if (sign && currentSign !== sign) return false
    sign = currentSign
  }
  const variantAreas = [
    Math.abs(pointCross(positions, a, c, b)),
    Math.abs(pointCross(positions, b, c, d)),
    Math.abs(pointCross(positions, a, c, d)),
    Math.abs(pointCross(positions, a, d, b)),
  ]
  return variantAreas.every(area => area > 0.0001)
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
  const cellCount = (columns - 1) * (rows - 1)
  const positions = new Float32Array(vertexCount * 3)
  const emphasis = new Float32Array(vertexCount)
  const highlightSeeds = new Float32Array(vertexCount)
  const xStep = geometryWidth / (columns - 1)
  const zStep = settings.value.meshDepth / (rows - 1)
  const seedOffset = (settings.value.seed - 260923) * 0.013
  const randomAt = (value: number) => seededRandom(value + seedOffset)

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column
      const edgeColumn = column === 0 || column === columns - 1
      const edgeRow = row === 0 || row === rows - 1
      const xJitter = edgeColumn ? 0 : (randomAt(index + 17) - 0.5) * xStep * 0.34
      const zJitter = edgeRow ? 0 : (randomAt(index + 53) - 0.5) * zStep * 0.32
      const x = -geometryWidth * 0.5 + column * xStep + xJitter
      const z = -settings.value.meshDepth * 0.5 + row * zStep + zJitter
      const broadShape = Math.sin(x * 0.33 + 0.8) * 0.34 + Math.cos(z * 0.62 - x * 0.08) * 0.24
      const irregularity = (randomAt(index + 131) - 0.5) * 0.72

      positions[index * 3] = x
      positions[index * 3 + 1] = broadShape + irregularity
      positions[index * 3 + 2] = z
      emphasis[index] = 0.78 + randomAt(index + 211) * 0.48
      highlightSeeds[index] = randomAt(index + 613)
    }
  }

  basePositions = positions

  nodeGeometry = new THREE.BufferGeometry()
  nodeGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  nodeGeometry.setAttribute('aEmphasis', new THREE.BufferAttribute(emphasis, 1))
  nodeGeometry.setAttribute('aHighlightSeed', new THREE.BufferAttribute(highlightSeeds, 1))

  const facePositions = new Float32Array(cellCount * 4 * 9)
  const facePhases = new Float32Array(cellCount * 4 * 3)
  const faceVisibility = new Float32Array(cellCount * 4 * 3)
  const faceTopologyWeights = new Float32Array(cellCount * 4 * 3)
  const faceChanging = new Float32Array(cellCount * 4 * 3)
  const perimeterEdges = new Map<string, [number, number]>()
  let faceVertexCursor = 0

  const registerPerimeterEdge = (start: number, end: number) => {
    const low = Math.min(start, end)
    const high = Math.max(start, end)
    perimeterEdges.set(`${low}:${high}`, [low, high])
  }

  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const cellIndex = row * (columns - 1) + column
      const a = row * columns + column
      const b = a + 1
      const c = a + columns
      const d = c + 1
      const current = ((row + column) % 2) as TopologyVariant
      const topologyTriangles: [number, number, number][][] = [
        [[a, c, b], [b, c, d]],
        [[a, c, d], [a, d, b]],
      ]
      const faceOffsets: [number, number] = [faceVertexCursor, faceVertexCursor + 6]
      const sharedVisibility = [randomAt(cellIndex * 2 + 401), randomAt(cellIndex * 2 + 402)]

      for (let variant = 0; variant < 2; variant += 1) {
        topologyTriangles[variant]!.forEach((triangle, triangleIndex) => {
          const phase = randomAt(cellIndex * 2 + triangleIndex + 307) * Math.PI * 2
          triangle.forEach((vertexIndex) => {
            const destination = faceVertexCursor * 3
            facePositions[destination] = positions[vertexIndex * 3]!
            facePositions[destination + 1] = positions[vertexIndex * 3 + 1]!
            facePositions[destination + 2] = positions[vertexIndex * 3 + 2]!
            facePhases[faceVertexCursor] = phase
            faceVisibility[faceVertexCursor] = sharedVisibility[triangleIndex]!
            faceTopologyWeights[faceVertexCursor] = current === variant ? 1 : 0
            faceVertexCursor += 1
          })
        })
      }

      registerPerimeterEdge(a, b)
      registerPerimeterEdge(b, d)
      registerPerimeterEdge(d, c)
      registerPerimeterEdge(c, a)
      cellStates.push({
        id: cellIndex,
        eligible: isConvexCell(positions, a, b, c, d),
        current,
        target: current,
        transitioning: false,
        transitionStart: 0,
        lastChanged: -settings.value.cellCooldown - randomAt(cellIndex + 991) * settings.value.cellCooldown,
        faceOffsets,
        edgeOffsets: [-1, -1],
        vertexIndices: [a, b, c, d],
      })
    }
  }

  faceGeometry = new THREE.BufferGeometry()
  faceGeometry.setAttribute('position', new THREE.BufferAttribute(facePositions, 3))
  faceGeometry.setAttribute('aPhase', new THREE.BufferAttribute(facePhases, 1))
  faceGeometry.setAttribute('aVisibility', new THREE.BufferAttribute(faceVisibility, 1))
  faceTopologyAttribute = new THREE.BufferAttribute(faceTopologyWeights, 1)
  faceGeometry.setAttribute('aTopologyWeight', faceTopologyAttribute)
  faceChangingAttribute = new THREE.BufferAttribute(faceChanging, 1)
  faceGeometry.setAttribute('aChanging', faceChangingAttribute)

  const edgeSegmentCount = perimeterEdges.size + cellCount * 2
  const edgePositions = new Float32Array(edgeSegmentCount * 6)
  const edgeStrengths = new Float32Array(edgeSegmentCount * 2)
  const edgeHighlightSeeds = new Float32Array(edgeSegmentCount * 2)
  const edgeTopologyWeights = new Float32Array(edgeSegmentCount * 2)
  const edgeChanging = new Float32Array(edgeSegmentCount * 2)
  let edgeSegmentCursor = 0

  const writeEdge = (start: number, end: number, strength: number, topologyWeight: number) => {
    const endpoints = [start, end]
    endpoints.forEach((vertexIndex, endpointIndex) => {
      const positionOffset = edgeSegmentCursor * 6 + endpointIndex * 3
      const attributeOffset = edgeSegmentCursor * 2 + endpointIndex
      edgePositions[positionOffset] = positions[vertexIndex * 3]!
      edgePositions[positionOffset + 1] = positions[vertexIndex * 3 + 1]!
      edgePositions[positionOffset + 2] = positions[vertexIndex * 3 + 2]!
      edgeStrengths[attributeOffset] = strength
      edgeHighlightSeeds[attributeOffset] = highlightSeeds[vertexIndex]!
      edgeTopologyWeights[attributeOffset] = topologyWeight
    })
    const attributeStart = edgeSegmentCursor * 2
    edgeSegmentCursor += 1
    return attributeStart
  }

  perimeterEdges.forEach(([start, end]) => {
    writeEdge(start, end, 0.64 + randomAt(edgeSegmentCursor + 509) * 0.36, 1)
  })

  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const cellIndex = row * (columns - 1) + column
      const a = row * columns + column
      const b = a + 1
      const c = a + columns
      const d = c + 1
      const state = cellStates[cellIndex]!
      const strength = 0.67 + randomAt(cellIndex + 1201) * 0.28
      state.edgeOffsets[0] = writeEdge(b, c, strength, state.current === 0 ? 1 : 0)
      state.edgeOffsets[1] = writeEdge(a, d, strength, state.current === 1 ? 1 : 0)
    }
  }

  edgeGeometry = new THREE.BufferGeometry()
  edgeGeometry.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3))
  edgeGeometry.setAttribute('aStrength', new THREE.BufferAttribute(edgeStrengths, 1))
  edgeGeometry.setAttribute('aHighlightSeed', new THREE.BufferAttribute(edgeHighlightSeeds, 1))
  edgeTopologyAttribute = new THREE.BufferAttribute(edgeTopologyWeights, 1)
  edgeGeometry.setAttribute('aTopologyWeight', edgeTopologyAttribute)
  edgeChangingAttribute = new THREE.BufferAttribute(edgeChanging, 1)
  edgeGeometry.setAttribute('aChanging', edgeChangingAttribute)

  const color = new THREE.Color('#ffec00')
  faceMaterial = new THREE.ShaderMaterial({
    uniforms: {
      ...createUniforms(),
      uColor: { value: color.clone() },
      uOpacity: { value: settings.value.faceOpacity },
      uShimmer: { value: settings.value.faceShimmer },
      uVisibility: { value: settings.value.faceVisibility },
      uHighlightChangingCells: { value: settings.value.highlightChangingCells ? 1 : 0 },
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
      ...createHighlightUniforms(),
      uColor: { value: color.clone() },
      uOpacity: { value: settings.value.edgeOpacity },
      uConnectedEdgeEmphasis: { value: settings.value.connectedEdgeEmphasis },
      uHighlightChangingCells: { value: settings.value.highlightChangingCells ? 1 : 0 },
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
      ...createHighlightUniforms(),
      uColor: { value: color.clone() },
      uNodeSize: { value: settings.value.nodeSize },
      uPixelRatio: { value: renderer?.getPixelRatio() ?? 1 },
      uBrightness: { value: settings.value.nodeBrightness },
      uHighlightIntensity: { value: settings.value.highlightIntensity },
      uNodeHaloStrength: { value: settings.value.nodeHaloStrength },
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
  const maskFaces = maskMaterial ? new THREE.Mesh(faceGeometry, maskMaterial) : undefined
  faces.renderOrder = 0
  edges.renderOrder = 1
  nodes.renderOrder = 2
  surfaceGroup.add(faces, edges, nodes)
  if (maskFaces) {
    maskFaces.frustumCulled = false
    maskGroup?.add(maskFaces)
  }

  connectionSequence = 0
  connectionsWereEnabled = settings.value.dynamicConnectionsEnabled
  nextConnectionTime = elapsedTime + settings.value.reconnectionInterval
  diagnostics.value.selectedCellId = null
}

function setUniform(material: THREE.ShaderMaterial | undefined, name: string, value: number) {
  const uniform = material?.uniforms[name]
  if (uniform) uniform.value = value
}

function updateMaterial(material: THREE.ShaderMaterial | undefined) {
  if (!material) return
  setUniform(material, 'uTime', elapsedTime)
  setUniform(material, 'uWaveSpeed', settings.value.waveSpeed)
  setUniform(material, 'uWaveAmplitude', settings.value.waveAmplitude)
  setUniform(material, 'uWaveFrequency', settings.value.waveFrequency)
  setUniform(material, 'uHeightVariation', settings.value.heightVariation)
  setUniform(material, 'uHalfWidth', geometryWidth * 0.5)
  setUniform(material, 'uDepth', settings.value.meshDepth)
  setUniform(material, 'uEdgeFadeStrength', settings.value.edgeFadeStrength)
  setUniform(material, 'uDepthFadeStrength', settings.value.depthFadeStrength)
  setUniform(material, 'uHighlightsEnabled', settings.value.highlightsEnabled ? 1 : 0)
  setUniform(material, 'uHighlightFraction', settings.value.highlightFraction)
  setUniform(material, 'uHighlightCycleDuration', settings.value.highlightCycleDuration)
}

function applyCellWeights(state: CellRuntime, firstWeight: number, secondWeight: number) {
  if (!faceTopologyAttribute || !edgeTopologyAttribute) return
  const faceWeights = faceTopologyAttribute.array as Float32Array
  const edgeWeights = edgeTopologyAttribute.array as Float32Array
  const weights: [number, number] = [firstWeight, secondWeight]
  for (let variant = 0; variant < 2; variant += 1) {
    const faceOffset = state.faceOffsets[variant]!
    const edgeOffset = state.edgeOffsets[variant]!
    for (let index = 0; index < 6; index += 1) faceWeights[faceOffset + index] = weights[variant]!
    edgeWeights[edgeOffset] = weights[variant]!
    edgeWeights[edgeOffset + 1] = weights[variant]!
  }
}

function applyCellChanging(state: CellRuntime, value: number) {
  if (!faceChangingAttribute || !edgeChangingAttribute) return
  const faceValues = faceChangingAttribute.array as Float32Array
  const edgeValues = edgeChangingAttribute.array as Float32Array
  for (let variant = 0; variant < 2; variant += 1) {
    const faceOffset = state.faceOffsets[variant]!
    const edgeOffset = state.edgeOffsets[variant]!
    for (let index = 0; index < 6; index += 1) faceValues[faceOffset + index] = value
    edgeValues[edgeOffset] = value
    edgeValues[edgeOffset + 1] = value
  }
  faceChangingAttribute.needsUpdate = true
  edgeChangingAttribute.needsUpdate = true
}

function surfaceDisplacementAt(x: number, z: number) {
  const phase = elapsedTime * settings.value.waveSpeed
  const primary = Math.sin(x * settings.value.waveFrequency + phase)
  const crossing = Math.sin(x * settings.value.waveFrequency * 0.48 - z * settings.value.waveFrequency * 0.72 - phase * 0.71) * 0.58
  const depthWave = Math.cos(z * settings.value.waveFrequency * 0.46 + phase * 0.43) * 0.34
  return (primary + crossing + depthWave) * (settings.value.waveAmplitude / 1.92)
}

function visualFadeAt(x: number, z: number) {
  const horizontalBase = THREE.MathUtils.clamp(1 - Math.abs(x) / Math.max(geometryWidth * 0.5, 0.001), 0, 1)
  const horizontal = horizontalBase ** Math.max(settings.value.edgeFadeStrength, 0.05)
  const depthPosition = THREE.MathUtils.clamp(z / Math.max(settings.value.meshDepth, 0.001) + 0.5, 0, 1)
  const depth = THREE.MathUtils.lerp(1, THREE.MathUtils.lerp(0.34, 1, depthPosition), THREE.MathUtils.clamp(settings.value.depthFadeStrength, 0, 1))
  return horizontal * depth
}

function nearBlurAmount(viewDistance: number) {
  const nearStart = Math.max(0, settings.value.focusDistance - settings.value.nearTransitionRange)
  const span = Math.max(0.001, settings.value.focusDistance - nearStart)
  const progress = THREE.MathUtils.clamp((viewDistance - nearStart) / span, 0, 1)
  const eased = progress * progress * (3 - 2 * progress)
  return 1 - eased
}

function refreshConnectionCandidates(force = false) {
  if (!host.value || !camera || !surfaceGroup || !basePositions) return []
  const now = performance.now()
  if (!force && now - candidateCacheTimestamp < 250) return candidateCache
  candidateCacheTimestamp = now
  surfaceGroup.updateMatrixWorld(true)
  camera.updateMatrixWorld(true)
  const width = Math.max(host.value.clientWidth, 1)
  const height = Math.max(host.value.clientHeight, 1)
  const local = new THREE.Vector3()
  const world = new THREE.Vector3()
  const view = new THREE.Vector3()
  const projected = new THREE.Vector3()
  const candidates: CellCandidate[] = []

  cellStates.forEach((state) => {
    if (!state.eligible || state.transitioning || elapsedTime - state.lastChanged < settings.value.cellCooldown) return
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    let centerNdcX = 0
    let centerNdcY = 0
    let centerViewDistance = 0
    let centerLocalX = 0
    let centerLocalZ = 0
    let visibleVertices = 0

    state.vertexIndices.forEach((vertexIndex) => {
      const x = basePositions![vertexIndex * 3]!
      const y = basePositions![vertexIndex * 3 + 1]! * settings.value.heightVariation + surfaceDisplacementAt(x, basePositions![vertexIndex * 3 + 2]!)
      const z = basePositions![vertexIndex * 3 + 2]!
      local.set(x, y, z)
      world.copy(local).applyMatrix4(surfaceGroup!.matrixWorld)
      view.copy(world).applyMatrix4(camera!.matrixWorldInverse)
      projected.copy(world).project(camera!)
      if (view.z < -0.1 && projected.z >= -1 && projected.z <= 1) visibleVertices += 1
      const screenX = (projected.x * 0.5 + 0.5) * width
      const screenY = (1 - (projected.y * 0.5 + 0.5)) * height
      minX = Math.min(minX, screenX)
      maxX = Math.max(maxX, screenX)
      minY = Math.min(minY, screenY)
      maxY = Math.max(maxY, screenY)
      centerNdcX += projected.x * 0.25
      centerNdcY += projected.y * 0.25
      centerViewDistance += Math.max(0, -view.z) * 0.25
      centerLocalX += x * 0.25
      centerLocalZ += z * 0.25
    })

    const screenWidth = maxX - minX
    const screenHeight = maxY - minY
    const screenArea = screenWidth * screenHeight
    const fade = visualFadeAt(centerLocalX, centerLocalZ)
    const sharpness = 1 - nearBlurAmount(centerViewDistance)
    const centrality = 1 - THREE.MathUtils.clamp(Math.hypot(centerNdcX, centerNdcY) / 1.2, 0, 1)
    const insideFrame = maxX >= 0 && minX <= width && maxY >= 0 && minY <= height
    if (
      visibleVertices < 2
      || !insideFrame
      || Math.abs(centerNdcX) > 0.92
      || Math.abs(centerNdcY) > 0.92
      || screenWidth < 14
      || screenHeight < 10
      || screenArea < 420
      || fade < 0.22
      || sharpness < 0.62
    ) return
    candidates.push({
      state,
      score: Math.sqrt(screenArea) * (0.25 + fade) * (0.2 + sharpness * sharpness * 1.4) * (0.55 + centrality),
    })
  })

  candidateCache = candidates.sort((first, second) => second.score - first.score)
  diagnostics.value.eligibleVisibleCellCount = candidateCache.length
  return candidateCache
}

function startCellTransition(state: CellRuntime, source: 'automatic' | 'manual') {
  state.target = state.current === 0 ? 1 : 0
  state.transitioning = true
  state.transitionStart = elapsedTime
  diagnostics.value.selectedCellId = state.id
  diagnostics.value.manualTestMessage = source === 'manual'
    ? `Cell ${state.id} is changing.`
    : diagnostics.value.manualTestMessage
  if (source === 'manual') manualTransitionCellId = state.id
  applyCellChanging(state, 1)
}

function completeCellTransition(state: CellRuntime) {
  state.current = state.target
  state.transitioning = false
  state.lastChanged = elapsedTime
  applyCellWeights(state, state.current === 0 ? 1 : 0, state.current === 1 ? 1 : 0)
  applyCellChanging(state, 0)
  diagnostics.value.completedTransitionCount += 1
  if (manualTransitionCellId === state.id) {
    diagnostics.value.manualTestMessage = `Cell ${state.id} completed its connection change.`
    manualTransitionCellId = null
  }
}

function settleConnections() {
  let changed = false
  cellStates.forEach((state) => {
    if (!state.transitioning) return
    completeCellTransition(state)
    changed = true
  })
  if (changed) {
    if (faceTopologyAttribute) faceTopologyAttribute.needsUpdate = true
    if (edgeTopologyAttribute) edgeTopologyAttribute.needsUpdate = true
  }
}

function updateConnectionDynamics() {
  if (!faceTopologyAttribute || !edgeTopologyAttribute) return
  let changed = false
  let activeTransitions = 0
  const duration = Math.max(0.05, settings.value.connectionTransitionDuration)

  diagnostics.value.status = reducedMotion
    ? 'reduced-motion'
    : settings.value.paused
      ? 'paused'
      : settings.value.dynamicConnectionsEnabled
        ? 'running'
        : 'disabled'

  cellStates.forEach((state) => {
    if (!state.transitioning) return
    activeTransitions += 1
    const progress = THREE.MathUtils.clamp((elapsedTime - state.transitionStart) / duration, 0, 1)
    const eased = progress * progress * (3 - 2 * progress)
    const firstWeight = state.current === 0 ? 1 - eased : eased
    const secondWeight = 1 - firstWeight
    applyCellWeights(state, firstWeight, secondWeight)
    changed = true
    if (progress >= 1) {
      completeCellTransition(state)
      activeTransitions -= 1
    }
  })

  const manualRequestPending = diagnostics.value.manualTestRequest !== handledManualTestRequest
  if (manualRequestPending) {
    handledManualTestRequest = diagnostics.value.manualTestRequest
    if (settings.value.paused) {
      diagnostics.value.manualTestMessage = 'Pause is active — resume animation before testing.'
    } else if (reducedMotion) {
      diagnostics.value.manualTestMessage = 'Reduced motion is active — manual transitions are disabled.'
    } else if (activeTransitions >= Math.max(1, Math.round(settings.value.maxChangingCells))) {
      diagnostics.value.manualTestMessage = 'All transition slots are busy — try again in a moment.'
    } else {
      const candidate = refreshConnectionCandidates(true)[0]
      if (candidate) {
        startCellTransition(candidate.state, 'manual')
        activeTransitions += 1
        nextConnectionTime = elapsedTime + settings.value.reconnectionInterval
      } else {
        diagnostics.value.manualTestMessage = 'No eligible visible cell is currently available.'
      }
    }
  }

  if (reducedMotion) {
    settleConnections()
  } else if (!settings.value.dynamicConnectionsEnabled) {
    if (connectionsWereEnabled) nextConnectionTime = elapsedTime + settings.value.reconnectionInterval
    connectionsWereEnabled = false
  } else {
    if (!connectionsWereEnabled) nextConnectionTime = elapsedTime + settings.value.reconnectionInterval
    connectionsWereEnabled = true
    const maximum = Math.max(1, Math.round(settings.value.maxChangingCells))
    if (elapsedTime >= nextConnectionTime && activeTransitions < maximum) {
      const candidates = [...refreshConnectionCandidates(true)]
      const availableSlots = maximum - activeTransitions
      const desired = Math.min(availableSlots, 1 + (seededRandom(settings.value.seed + connectionSequence * 19.7) > 0.78 ? 1 : 0))
      for (let index = 0; index < desired && candidates.length; index += 1) {
        const candidatePoolSize = Math.min(12, candidates.length)
        const selection = Math.floor(seededRandom(settings.value.seed * 0.17 + connectionSequence * 31.1 + index * 7.3) * candidatePoolSize)
        const candidate = candidates.splice(selection, 1)[0]!
        startCellTransition(candidate.state, 'automatic')
        activeTransitions += 1
      }
      connectionSequence += 1
      const intervalVariation = 0.82 + seededRandom(settings.value.seed * 0.23 + connectionSequence * 43.9) * 0.36
      nextConnectionTime = elapsedTime + settings.value.reconnectionInterval * intervalVariation
    }
  }

  if (changed) {
    faceTopologyAttribute.needsUpdate = true
    edgeTopologyAttribute.needsUpdate = true
  }
  refreshConnectionCandidates()
  diagnostics.value.activeTransitionCount = cellStates.reduce((count, state) => count + (state.transitioning ? 1 : 0), 0)
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
  setUniform(faceMaterial, 'uOpacity', settings.value.faceOpacity)
  setUniform(faceMaterial, 'uShimmer', settings.value.faceShimmer)
  setUniform(faceMaterial, 'uVisibility', settings.value.faceVisibility)
  setUniform(faceMaterial, 'uHighlightChangingCells', settings.value.highlightChangingCells ? 1 : 0)
  setUniform(edgeMaterial, 'uOpacity', settings.value.edgeOpacity)
  setUniform(edgeMaterial, 'uConnectedEdgeEmphasis', settings.value.connectedEdgeEmphasis)
  setUniform(edgeMaterial, 'uHighlightChangingCells', settings.value.highlightChangingCells ? 1 : 0)
  setUniform(nodeMaterial, 'uNodeSize', settings.value.nodeSize)
  setUniform(nodeMaterial, 'uBrightness', settings.value.nodeBrightness)
  setUniform(nodeMaterial, 'uHighlightIntensity', settings.value.highlightIntensity)
  setUniform(nodeMaterial, 'uNodeHaloStrength', settings.value.nodeHaloStrength)
  updateMaterial(maskMaterial)
  setUniform(maskMaterial, 'uFocusDistance', settings.value.focusDistance)
  setUniform(maskMaterial, 'uNearTransitionRange', settings.value.nearTransitionRange)
  if (maskGroup) {
    maskGroup.rotation.copy(surfaceGroup.rotation)
    maskGroup.position.copy(surfaceGroup.position)
    maskGroup.scale.copy(surfaceGroup.scale)
  }
  updateConnectionDynamics()
}

function renderSurface() {
  if (!renderer || !scene || !camera) return
  if (
    !settings.value.blurEnabled
    || !host.value
    || !maskScene
    || !postScene
    || !postCamera
    || !postQuad
    || !blurMaterial
    || !compositeMaterial
    || !sharpTarget
    || !maskTarget
    || !blurTargetA
    || !blurTargetB
  ) {
    renderer.setRenderTarget(null)
    renderer.clear()
    renderer.render(scene, camera)
    return
  }

  const pixelRatio = renderer.getPixelRatio()
  resizePostProcessing(host.value.clientWidth, host.value.clientHeight, pixelRatio)

  renderer.setRenderTarget(sharpTarget)
  renderer.clear()
  renderer.render(scene, camera)

  renderer.setRenderTarget(maskTarget)
  renderer.clear()
  renderer.render(maskScene, camera)

  const radiusInPixels = settings.value.maxBlurRadius * pixelRatio
  blurMaterial.uniforms.uSource!.value = sharpTarget.texture
  blurMaterial.uniforms.uTexelSize!.value.set(1 / postFullWidth, 1 / postFullHeight)
  blurMaterial.uniforms.uDirection!.value.set(1, 0)
  blurMaterial.uniforms.uRadius!.value = radiusInPixels
  postQuad.material = blurMaterial
  renderer.setRenderTarget(blurTargetA)
  renderer.clear()
  renderer.render(postScene, postCamera)

  blurMaterial.uniforms.uSource!.value = blurTargetA.texture
  blurMaterial.uniforms.uTexelSize!.value.set(1 / postBlurWidth, 1 / postBlurHeight)
  blurMaterial.uniforms.uDirection!.value.set(0, 1)
  blurMaterial.uniforms.uRadius!.value = radiusInPixels * THREE.MathUtils.clamp(settings.value.blurRenderScale, 0.25, 1)
  renderer.setRenderTarget(blurTargetB)
  renderer.clear()
  renderer.render(postScene, postCamera)

  compositeMaterial.uniforms.uSharp!.value = sharpTarget.texture
  compositeMaterial.uniforms.uBlurred!.value = blurTargetB.texture
  compositeMaterial.uniforms.uMask!.value = maskTarget.texture
  compositeMaterial.uniforms.uMaskTexelSize!.value.set(1 / postFullWidth, 1 / postFullHeight)
  compositeMaterial.uniforms.uMaskSpread!.value = radiusInPixels * 0.65
  compositeMaterial.uniforms.uStrength!.value = THREE.MathUtils.clamp(settings.value.blurStrength, 0, 1)
  compositeMaterial.uniforms.uShowMask!.value = settings.value.showBlurMask ? 1 : 0
  postQuad.material = compositeMaterial
  renderer.setRenderTarget(null)
  renderer.clear()
  renderer.render(postScene, postCamera)
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
  setUniform(nodeMaterial, 'uPixelRatio', pixelRatio)
  resizePostProcessing(width, height, pixelRatio)
  buildSurface()
}

function animate(time: number) {
  frameId = window.requestAnimationFrame(animate)
  if (!renderer || !scene || !camera) return
  const delta = lastFrameTime ? Math.min((time - lastFrameTime) / 1000, 0.05) : 0
  lastFrameTime = time
  if (!settings.value.paused && !reducedMotion && isPageVisible) elapsedTime += delta
  updateScene()
  renderSurface()
}

function scheduleRebuild() {
  if (rebuildTimer) window.clearTimeout(rebuildTimer)
  rebuildTimer = window.setTimeout(buildSurface, 90)
}

function handleVisibilityChange() {
  isPageVisible = document.visibilityState === 'visible'
  lastFrameTime = 0
}

function handleReducedMotionChange(event: MediaQueryListEvent | MediaQueryList) {
  reducedMotion = event.matches
  if (reducedMotion) settleConnections()
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
  initializePostProcessing()
  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(host.value)
  reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  handleReducedMotionChange(reducedMotionQuery)
  reducedMotionQuery.addEventListener('change', handleReducedMotionChange)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  resize()
  animate(performance.now())
})

watch(
  () => [settings.value.seed, settings.value.meshWidth, settings.value.meshDepth, settings.value.density, settings.value.cameraFov, settings.value.cameraDistance],
  scheduleRebuild,
)

onBeforeUnmount(() => {
  window.cancelAnimationFrame(frameId)
  if (rebuildTimer) window.clearTimeout(rebuildTimer)
  resizeObserver?.disconnect()
  reducedMotionQuery?.removeEventListener('change', handleReducedMotionChange)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  disposeGeometry()
  faceMaterial?.dispose()
  edgeMaterial?.dispose()
  nodeMaterial?.dispose()
  disposePostProcessing()
  renderer?.dispose()
  renderer?.forceContextLoss()
  renderer?.domElement.remove()
})
</script>

<template>
  <div ref="host" class="polygon-wave" aria-hidden="true" />
</template>

<style scoped>
.polygon-wave { position: absolute; z-index: 0; inset: 0; overflow: hidden; pointer-events: none; }
.polygon-wave :deep(canvas) { display: block; width: 100%; height: 100%; }
</style>
