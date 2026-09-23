<script setup lang="ts">
import type { PolygonWaveSettings } from '~/types/polygonWave'

type NumericSettingKey = {
  [Key in keyof PolygonWaveSettings]: PolygonWaveSettings[Key] extends number ? Key : never
}[keyof PolygonWaveSettings]

interface DebugControl {
  key: NumericSettingKey
  label: string
  min: number
  max: number
  step: number
}

interface DebugSection {
  title: string
  controls: DebugControl[]
}

const route = useRoute()
const isOpen = ref(false)
const { settings, reset } = usePolygonWaveDebug()
const isDebugEnabled = computed(() => route.query.debug === '1')

const sections: DebugSection[] = [
  {
    title: 'Geometry',
    controls: [
      { key: 'meshWidth', label: 'Horizontal extent', min: 1.05, max: 1.8, step: 0.01 },
      { key: 'meshDepth', label: 'Mesh depth', min: 7, max: 18, step: 0.5 },
      { key: 'density', label: 'Vertex density', min: 0.65, max: 1.5, step: 0.05 },
      { key: 'heightVariation', label: 'Height variation', min: 0, max: 1.8, step: 0.05 },
      { key: 'faceVisibility', label: 'Face visibility', min: 0, max: 1, step: 0.01 },
    ],
  },
  {
    title: 'Orientation',
    controls: [
      { key: 'rotationX', label: 'Rotation X', min: -35, max: 35, step: 1 },
      { key: 'rotationY', label: 'Rotation Y', min: -25, max: 25, step: 1 },
      { key: 'rotationZ', label: 'Rotation Z', min: -15, max: 15, step: 1 },
      { key: 'verticalOffset', label: 'Vertical offset', min: -4, max: 4, step: 0.05 },
      { key: 'cameraFov', label: 'Camera FOV', min: 28, max: 64, step: 1 },
      { key: 'cameraDistance', label: 'Camera distance', min: 8, max: 20, step: 0.25 },
    ],
  },
  {
    title: 'Motion',
    controls: [
      { key: 'waveSpeed', label: 'Wave speed', min: 0, max: 0.8, step: 0.01 },
      { key: 'waveAmplitude', label: 'Wave amplitude', min: 0, max: 1.5, step: 0.02 },
      { key: 'waveFrequency', label: 'Wave scale', min: 0.15, max: 1.4, step: 0.01 },
    ],
  },
  {
    title: 'Visual',
    controls: [
      { key: 'nodeSize', label: 'Node size', min: 1, max: 12, step: 0.1 },
      { key: 'nodeBrightness', label: 'Node brightness', min: 0.2, max: 2.5, step: 0.05 },
      { key: 'edgeOpacity', label: 'Edge opacity', min: 0, max: 0.8, step: 0.01 },
      { key: 'faceOpacity', label: 'Face opacity', min: 0, max: 0.5, step: 0.01 },
      { key: 'faceShimmer', label: 'Face shimmer', min: 0, max: 1, step: 0.01 },
      { key: 'edgeFadeStrength', label: 'Edge fade', min: 0.2, max: 3, step: 0.05 },
      { key: 'depthFadeStrength', label: 'Depth fade', min: 0, max: 1, step: 0.01 },
    ],
  },
]

function formatValue(value: number, step: number) {
  if (step >= 1) return value.toFixed(0)
  return value.toFixed(step < 0.05 ? 2 : 1)
}
</script>

<template>
  <Teleport v-if="isDebugEnabled" to="body">
    <section class="particle-debug" aria-label="Polygon wave debug panel">
      <button class="particle-debug__toggle" type="button" :aria-expanded="isOpen" @click="isOpen = !isOpen">
        <span>Polygon wave</span>
        <span aria-hidden="true">{{ isOpen ? '−' : '+' }}</span>
      </button>
      <div v-if="isOpen" class="particle-debug__panel">
        <div v-for="section in sections" :key="section.title" class="particle-debug__section">
          <h2>{{ section.title }}</h2>
          <label v-for="control in section.controls" :key="control.key" class="particle-debug__control">
            <span>{{ control.label }}</span>
            <output>{{ formatValue(settings[control.key], control.step) }}</output>
            <input v-model.number="settings[control.key]" type="range" :min="control.min" :max="control.max" :step="control.step" />
          </label>
        </div>
        <div class="particle-debug__section particle-debug__utility">
          <h2>Utility</h2>
          <label class="particle-debug__check">
            <input v-model="settings.paused" type="checkbox" />
            <span>Pause animation</span>
          </label>
          <button type="button" @click="settings.cardsHidden = !settings.cardsHidden">{{ settings.cardsHidden ? 'Show cards' : 'Hide cards' }}</button>
          <button type="button" @click="reset">Reset defaults</button>
        </div>
      </div>
    </section>
  </Teleport>
</template>

<style scoped>
.particle-debug { position: fixed; z-index: 100; bottom: 16px; left: 16px; width: min(330px, calc(100vw - 32px)); color: #f7f4d0; font: 12px/1.35 Arial, sans-serif; }
.particle-debug__toggle, .particle-debug__panel { border: 1px solid rgb(255 236 0 / 34%); border-radius: 8px; background: rgb(18 18 16 / 94%); box-shadow: 0 12px 38px rgb(0 0 0 / 38%); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); }
.particle-debug__toggle { display: flex; justify-content: space-between; width: 100%; padding: 10px 12px; color: var(--color-accent); text-align: left; text-transform: uppercase; letter-spacing: .1em; }
.particle-debug__panel { max-height: min(76vh, 720px); margin-top: 8px; padding: 12px; overflow-y: auto; scrollbar-color: rgb(255 236 0 / 44%) transparent; }
.particle-debug__section + .particle-debug__section { margin-top: 16px; padding-top: 14px; border-top: 1px solid rgb(255 255 255 / 10%); }
.particle-debug__section h2 { margin: 0 0 10px; color: rgb(255 236 0 / 78%); font-size: 10px; font-weight: 600; letter-spacing: .13em; text-transform: uppercase; }
.particle-debug__control { display: grid; grid-template-columns: 1fr auto; gap: 4px 10px; align-items: center; margin-top: 9px; }
.particle-debug__control output { min-width: 34px; color: rgb(255 255 255 / 62%); font-variant-numeric: tabular-nums; text-align: right; }
.particle-debug__control input { grid-column: 1 / -1; width: 100%; height: 3px; margin: 3px 0; accent-color: var(--color-accent); }
.particle-debug__utility { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.particle-debug__utility h2, .particle-debug__check { grid-column: 1 / -1; }
.particle-debug__check { display: flex; align-items: center; gap: 8px; }
.particle-debug__check input { accent-color: var(--color-accent); }
.particle-debug__utility button { padding: 8px; border: 1px solid rgb(255 236 0 / 22%); border-radius: 5px; color: rgb(255 255 255 / 78%); font-size: 11px; }
.particle-debug__utility button:hover { border-color: rgb(255 236 0 / 60%); color: var(--color-accent); }
@media (max-width: 599px) { .particle-debug { bottom: 8px; left: 8px; width: min(310px, calc(100vw - 16px)); } }
</style>
