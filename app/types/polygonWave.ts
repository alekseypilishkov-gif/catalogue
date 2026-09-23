export interface PolygonWaveSettings {
  seed: number
  meshWidth: number
  meshDepth: number
  density: number
  heightVariation: number
  faceVisibility: number
  rotationX: number
  rotationY: number
  rotationZ: number
  verticalOffset: number
  cameraFov: number
  cameraDistance: number
  waveSpeed: number
  waveAmplitude: number
  waveFrequency: number
  nodeSize: number
  nodeBrightness: number
  edgeOpacity: number
  faceOpacity: number
  faceShimmer: number
  edgeFadeStrength: number
  depthFadeStrength: number
  blurEnabled: boolean
  focusDistance: number
  nearTransitionRange: number
  maxBlurRadius: number
  blurStrength: number
  blurRenderScale: number
  showBlurMask: boolean
  highlightsEnabled: boolean
  highlightFraction: number
  highlightIntensity: number
  highlightCycleDuration: number
  connectedEdgeEmphasis: number
  nodeHaloStrength: number
  dynamicConnectionsEnabled: boolean
  reconnectionInterval: number
  maxChangingCells: number
  connectionTransitionDuration: number
  cellCooldown: number
  highlightChangingCells: boolean
  paused: boolean
  cardsHidden: boolean
}

export type PolygonWaveConnectionStatus = 'running' | 'paused' | 'reduced-motion' | 'disabled'

export interface PolygonWaveDiagnostics {
  selectedCellId: number | null
  eligibleVisibleCellCount: number
  activeTransitionCount: number
  completedTransitionCount: number
  status: PolygonWaveConnectionStatus
  manualTestRequest: number
  manualTestMessage: string
}

export const POLYGON_WAVE_DEFAULTS: PolygonWaveSettings = {
  seed: 260923,
  meshWidth: 1.34,
  meshDepth: 12,
  density: 1,
  heightVariation: 0.9,
  faceVisibility: 0.64,
  rotationX: -4,
  rotationY: 0,
  rotationZ: 0,
  verticalOffset: -0.45,
  cameraFov: 42,
  cameraDistance: 12,
  waveSpeed: 0.16,
  waveAmplitude: 0.44,
  waveFrequency: 0.58,
  nodeSize: 5.8,
  nodeBrightness: 1.35,
  edgeOpacity: 0.28,
  faceOpacity: 0.16,
  faceShimmer: 0.52,
  edgeFadeStrength: 1.35,
  depthFadeStrength: 0.62,
  blurEnabled: true,
  focusDistance: 10.5,
  nearTransitionRange: 3.6,
  maxBlurRadius: 9,
  blurStrength: 0.72,
  blurRenderScale: 0.65,
  showBlurMask: false,
  highlightsEnabled: true,
  highlightFraction: 0.13,
  highlightIntensity: 1.25,
  highlightCycleDuration: 6,
  connectedEdgeEmphasis: 1.1,
  nodeHaloStrength: 0.62,
  dynamicConnectionsEnabled: true,
  reconnectionInterval: 3,
  maxChangingCells: 2,
  connectionTransitionDuration: 0.8,
  cellCooldown: 7,
  highlightChangingCells: false,
  paused: false,
  cardsHidden: false,
}

export const POLYGON_WAVE_DIAGNOSTICS_DEFAULTS: PolygonWaveDiagnostics = {
  selectedCellId: null,
  eligibleVisibleCellCount: 0,
  activeTransitionCount: 0,
  completedTransitionCount: 0,
  status: 'running',
  manualTestRequest: 0,
  manualTestMessage: '',
}
