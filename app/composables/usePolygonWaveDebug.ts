import {
  POLYGON_WAVE_DEFAULTS,
  POLYGON_WAVE_DIAGNOSTICS_DEFAULTS,
  type PolygonWaveDiagnostics,
  type PolygonWaveSettings,
} from '~/types/polygonWave'

export function usePolygonWaveDebug() {
  const settings = useState<PolygonWaveSettings>('polygon-wave-settings', () => ({ ...POLYGON_WAVE_DEFAULTS }))
  const diagnostics = useState<PolygonWaveDiagnostics>('polygon-wave-diagnostics', () => ({ ...POLYGON_WAVE_DIAGNOSTICS_DEFAULTS }))

  function reset() {
    Object.assign(settings.value, POLYGON_WAVE_DEFAULTS)
  }

  return { settings, diagnostics, reset }
}
