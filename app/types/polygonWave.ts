export interface PolygonWaveSettings {
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
  paused: boolean
  cardsHidden: boolean
}

export const POLYGON_WAVE_DEFAULTS: PolygonWaveSettings = {
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
  paused: false,
  cardsHidden: false,
}
