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
  cardGlowSize: number
  cardGlowBrightness: number
  cardGlowBlur: number
  cardBackgroundBlur: number
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
  seed: 354979,
  meshWidth: 1.51,
  meshDepth: 14,
  density: 0.8,
  heightVariation: 1.2,
  faceVisibility: 1,
  rotationX: -3,
  rotationY: 13,
  rotationZ: 0,
  verticalOffset: -0.45,
  cameraFov: 44,
  cameraDistance: 12,
  waveSpeed: 0.15,
  waveAmplitude: 0.38,
  waveFrequency: 0.79,
  nodeSize: 9.8,
  nodeBrightness: 1.7,
  edgeOpacity: 0.25,
  faceOpacity: 0.11,
  faceShimmer: 0.39,
  edgeFadeStrength: 1.2,
  depthFadeStrength: 0.55,
  blurEnabled: true,
  focusDistance: 12.8,
  nearTransitionRange: 3.2,
  maxBlurRadius: 8,
  blurStrength: 0.94,
  blurRenderScale: 0.55,
  showBlurMask: false,
  highlightsEnabled: true,
  highlightFraction: 0.2,
  highlightIntensity: 1.85,
  highlightCycleDuration: 9.25,
  connectedEdgeEmphasis: 1.55,
  nodeHaloStrength: 0.86,
  dynamicConnectionsEnabled: true,
  reconnectionInterval: 4.3,
  maxChangingCells: 3,
  connectionTransitionDuration: 1.05,
  cellCooldown: 7.5,
  highlightChangingCells: false,
  paused: false,
  cardsHidden: false,
  cardGlowSize: 56.05,
  cardGlowBrightness: 1,
  cardGlowBlur: 22,
  cardBackgroundBlur: 64,
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
