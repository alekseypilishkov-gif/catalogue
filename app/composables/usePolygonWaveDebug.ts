import { POLYGON_WAVE_DEFAULTS, type PolygonWaveSettings } from '~/types/polygonWave'

export function usePolygonWaveDebug() {
  const settings = useState<PolygonWaveSettings>('polygon-wave-settings', () => ({ ...POLYGON_WAVE_DEFAULTS }))

  function reset() {
    Object.assign(settings.value, POLYGON_WAVE_DEFAULTS)
  }

  return { settings, reset }
}
