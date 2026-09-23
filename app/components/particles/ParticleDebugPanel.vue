<script setup lang="ts">
import type { PolygonWaveSettings } from '~/types/polygonWave'

type NumericSettingKey = {
  [Key in keyof PolygonWaveSettings]: PolygonWaveSettings[Key] extends number ? Key : never
}[keyof PolygonWaveSettings]

type BooleanSettingKey = {
  [Key in keyof PolygonWaveSettings]: PolygonWaveSettings[Key] extends boolean ? Key : never
}[keyof PolygonWaveSettings]

interface DebugControl {
  key: NumericSettingKey
  label: string
  min: number
  max: number
  step: number
}

interface DebugSection {
  id: string
  title: string
  toggleKey?: BooleanSettingKey
  toggleLabel?: string
  controls: DebugControl[]
}

const route = useRoute()
const isOpen = ref(route.query.debug === '1')
const copyStatus = ref('')
const fallbackText = ref('')
const collapsedSections = reactive<Record<string, boolean>>({
  geometry: true,
  orientation: true,
  motion: true,
  visual: true,
  blur: false,
  highlights: true,
  connections: false,
  utility: false,
})
const { settings, diagnostics, reset } = usePolygonWaveDebug()

watch(() => route.query.debug === '1', (enabled) => {
  if (enabled) isOpen.value = true
})

const sections: DebugSection[] = [
  {
    id: 'geometry',
    title: 'Geometry',
    controls: [
      { key: 'seed', label: 'Seed', min: 1, max: 999999, step: 1 },
      { key: 'meshWidth', label: 'Horizontal extent', min: 1.05, max: 1.8, step: 0.01 },
      { key: 'meshDepth', label: 'Mesh depth', min: 7, max: 18, step: 0.5 },
      { key: 'density', label: 'Vertex density', min: 0.65, max: 1.5, step: 0.05 },
      { key: 'heightVariation', label: 'Height variation', min: 0, max: 1.8, step: 0.05 },
      { key: 'faceVisibility', label: 'Face visibility', min: 0, max: 1, step: 0.01 },
    ],
  },
  {
    id: 'orientation',
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
    id: 'motion',
    title: 'Motion',
    controls: [
      { key: 'waveSpeed', label: 'Wave speed', min: 0, max: 0.8, step: 0.01 },
      { key: 'waveAmplitude', label: 'Wave amplitude', min: 0, max: 1.5, step: 0.02 },
      { key: 'waveFrequency', label: 'Wave scale', min: 0.15, max: 1.4, step: 0.01 },
    ],
  },
  {
    id: 'visual',
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
  {
    id: 'blur',
    title: 'Surface blur',
    toggleKey: 'blurEnabled',
    toggleLabel: 'Enabled',
    controls: [
      { key: 'focusDistance', label: 'Focus distance', min: 5, max: 18, step: 0.1 },
      { key: 'nearTransitionRange', label: 'Near transition range', min: 0.5, max: 8, step: 0.1 },
      { key: 'maxBlurRadius', label: 'Maximum blur radius', min: 0, max: 24, step: 0.5 },
      { key: 'blurStrength', label: 'Effect strength', min: 0, max: 1, step: 0.01 },
      { key: 'blurRenderScale', label: 'Blur quality / render scale', min: 0.35, max: 1, step: 0.05 },
    ],
  },
  {
    id: 'highlights',
    title: 'Highlights',
    toggleKey: 'highlightsEnabled',
    toggleLabel: 'Enabled',
    controls: [
      { key: 'highlightFraction', label: 'Highlight fraction', min: 0.02, max: 0.35, step: 0.01 },
      { key: 'highlightIntensity', label: 'Highlight intensity', min: 0, max: 3, step: 0.05 },
      { key: 'highlightCycleDuration', label: 'Cycle duration', min: 3, max: 14, step: 0.25 },
      { key: 'connectedEdgeEmphasis', label: 'Connected edges', min: 0, max: 3, step: 0.05 },
      { key: 'nodeHaloStrength', label: 'Node halo', min: 0, max: 1.5, step: 0.02 },
    ],
  },
  {
    id: 'connections',
    title: 'Dynamic connections',
    toggleKey: 'dynamicConnectionsEnabled',
    toggleLabel: 'Enabled',
    controls: [
      { key: 'reconnectionInterval', label: 'Interval', min: 1.5, max: 8, step: 0.1 },
      { key: 'maxChangingCells', label: 'Maximum cells', min: 1, max: 4, step: 1 },
      { key: 'connectionTransitionDuration', label: 'Transition duration', min: 0.35, max: 2, step: 0.05 },
      { key: 'cellCooldown', label: 'Cell cooldown', min: 3, max: 20, step: 0.5 },
    ],
  },
]

function formatValue(value: number, step: number) {
  if (step >= 1) return value.toFixed(0)
  return value.toFixed(step <= 0.05 ? 2 : 1)
}

function clampValue(control: DebugControl, value: number) {
  const clamped = Math.min(control.max, Math.max(control.min, value))
  const decimals = control.step < 1 ? Math.max(0, `${control.step}`.split('.')[1]?.length ?? 0) : 0
  return Number(clamped.toFixed(decimals))
}

function handleNumericInput(control: DebugControl, event: Event) {
  const input = event.currentTarget as HTMLInputElement
  const value = Number(input.value)
  if (!input.value.trim() || !Number.isFinite(value)) return
  settings.value[control.key] = clampValue(control, value)
}

function commitNumericInput(control: DebugControl, event: Event) {
  const input = event.currentTarget as HTMLInputElement
  const value = Number(input.value)
  const current = settings.value[control.key]
  settings.value[control.key] = Number.isFinite(value) && input.value.trim()
    ? clampValue(control, value)
    : clampValue(control, current)
  input.value = String(settings.value[control.key])
}

function toggleSection(id: string) {
  collapsedSections[id] = !collapsedSections[id]
}

function requestConnectionTest() {
  if (settings.value.paused) {
    diagnostics.value.manualTestMessage = 'Pause is active — resume animation before testing.'
    return
  }
  if (diagnostics.value.status === 'reduced-motion') {
    diagnostics.value.manualTestMessage = 'Reduced motion is active — manual transitions are disabled.'
    return
  }
  diagnostics.value.manualTestMessage = 'Selecting a visible cell…'
  diagnostics.value.manualTestRequest += 1
}

function serializedSettings() {
  return JSON.stringify({ ...settings.value }, null, 2)
}

async function copySettings() {
  const value = serializedSettings()
  copyStatus.value = ''
  fallbackText.value = ''
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
    await navigator.clipboard.writeText(value)
    copyStatus.value = 'Settings copied'
  } catch {
    fallbackText.value = value
    copyStatus.value = 'Copy manually below'
  }
}

function resetSettings() {
  reset()
  copyStatus.value = 'Defaults restored'
  fallbackText.value = ''
  diagnostics.value.manualTestMessage = ''
}
</script>

<template>
  <Teleport to="body">
    <section class="particle-debug" aria-label="Polygon wave debug panel">
      <button class="particle-debug__toggle" type="button" :aria-expanded="isOpen" @click="isOpen = !isOpen">
        <span>Настройки волны</span>
        <span aria-hidden="true">{{ isOpen ? '−' : '+' }}</span>
      </button>
      <div v-if="isOpen" class="particle-debug__panel">
        <div v-for="section in sections" :key="section.title" class="particle-debug__section">
          <div class="particle-debug__heading">
            <button
              class="particle-debug__section-toggle"
              type="button"
              :aria-expanded="!collapsedSections[section.id]"
              @click="toggleSection(section.id)"
            >
              <h2>{{ section.title }}</h2>
              <span aria-hidden="true">{{ collapsedSections[section.id] ? '+' : '−' }}</span>
            </button>
            <label v-if="section.toggleKey" class="particle-debug__switch">
              <input v-model="settings[section.toggleKey]" type="checkbox" />
              <span>{{ section.toggleLabel }}</span>
            </label>
          </div>
          <div v-if="!collapsedSections[section.id]">
            <label v-for="control in section.controls" :key="control.key" class="particle-debug__control">
              <span>{{ control.label }}</span>
              <input
                :value="settings[control.key]"
                class="particle-debug__number"
                type="number"
                :min="control.min"
                :max="control.max"
                :step="control.step"
                :aria-label="`${control.label} value`"
                @input="handleNumericInput(control, $event)"
                @change="commitNumericInput(control, $event)"
                @blur="commitNumericInput(control, $event)"
              />
              <input
                :value="settings[control.key]"
                type="range"
                :min="control.min"
                :max="control.max"
                :step="control.step"
                @input="handleNumericInput(control, $event)"
              />
              <output>{{ formatValue(settings[control.key], control.step) }}</output>
            </label>
            <label v-if="section.id === 'blur'" class="particle-debug__check particle-debug__subcontrol">
              <input v-model="settings.showBlurMask" type="checkbox" />
              <span>Show blur mask</span>
            </label>
            <template v-if="section.id === 'connections'">
              <label class="particle-debug__check particle-debug__subcontrol">
                <input v-model="settings.highlightChangingCells" type="checkbox" />
                <span>Highlight changing cells</span>
              </label>
              <button class="particle-debug__test" type="button" @click="requestConnectionTest">Test one connection change</button>
              <dl class="particle-debug__diagnostics">
                <div><dt>Status</dt><dd>{{ diagnostics.status }}</dd></div>
                <div><dt>Selected cell ID</dt><dd>{{ diagnostics.selectedCellId ?? '—' }}</dd></div>
                <div><dt>Eligible visible cells</dt><dd>{{ diagnostics.eligibleVisibleCellCount }}</dd></div>
                <div><dt>Active transitions</dt><dd>{{ diagnostics.activeTransitionCount }}</dd></div>
                <div><dt>Completed changes</dt><dd>{{ diagnostics.completedTransitionCount }}</dd></div>
              </dl>
              <p v-if="diagnostics.manualTestMessage" class="particle-debug__status" aria-live="polite">{{ diagnostics.manualTestMessage }}</p>
            </template>
          </div>
        </div>
        <div class="particle-debug__section particle-debug__utility">
          <div class="particle-debug__heading">
            <button class="particle-debug__section-toggle" type="button" :aria-expanded="!collapsedSections.utility" @click="toggleSection('utility')">
              <h2>Utility</h2>
              <span aria-hidden="true">{{ collapsedSections.utility ? '+' : '−' }}</span>
            </button>
          </div>
          <template v-if="!collapsedSections.utility">
            <label class="particle-debug__check">
              <input v-model="settings.paused" type="checkbox" />
              <span>Pause animation</span>
            </label>
            <button type="button" @click="settings.cardsHidden = !settings.cardsHidden">{{ settings.cardsHidden ? 'Show cards' : 'Hide cards' }}</button>
            <button type="button" @click="resetSettings">Reset defaults</button>
            <button class="particle-debug__copy" type="button" @click="copySettings">Copy settings</button>
            <p v-if="copyStatus" class="particle-debug__status" aria-live="polite">{{ copyStatus }}</p>
            <textarea v-if="fallbackText" class="particle-debug__fallback" readonly :value="fallbackText" aria-label="Settings JSON for manual copy" />
          </template>
        </div>
      </div>
    </section>
  </Teleport>
</template>

<style scoped>
.particle-debug { position: fixed; z-index: 100; bottom: 16px; left: 16px; width: min(372px, calc(100vw - 32px)); color: #f7f4d0; font: 12px/1.35 Arial, sans-serif; }
.particle-debug__toggle, .particle-debug__panel { border: 1px solid rgb(255 236 0 / 34%); border-radius: 8px; background: rgb(18 18 16 / 94%); box-shadow: 0 12px 38px rgb(0 0 0 / 38%); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); }
.particle-debug__toggle { display: flex; justify-content: space-between; width: 100%; padding: 10px 12px; color: var(--color-accent); text-align: left; text-transform: uppercase; letter-spacing: .1em; }
.particle-debug__panel { max-height: calc(100vh - 82px); margin-top: 8px; padding: 12px; overflow-y: auto; overscroll-behavior: contain; scrollbar-color: rgb(255 236 0 / 44%) transparent; }
.particle-debug__section + .particle-debug__section { margin-top: 16px; padding-top: 14px; border-top: 1px solid rgb(255 255 255 / 10%); }
.particle-debug__heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.particle-debug__heading h2 { margin: 0; color: rgb(255 236 0 / 78%); font-size: 10px; font-weight: 600; letter-spacing: .13em; text-transform: uppercase; }
.particle-debug__section-toggle { display: flex; flex: 1; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; padding: 0; color: inherit; text-align: left; }
.particle-debug__section-toggle > span { color: rgb(255 255 255 / 48%); font-size: 14px; }
.particle-debug__switch, .particle-debug__check { display: flex; align-items: center; gap: 7px; color: rgb(255 255 255 / 76%); }
.particle-debug__switch input, .particle-debug__check input { accent-color: var(--color-accent); }
.particle-debug__control { display: grid; grid-template-columns: minmax(0, 1fr) 74px; gap: 4px 10px; align-items: center; margin-top: 9px; }
.particle-debug__number { width: 74px; padding: 4px 5px; border: 1px solid rgb(255 255 255 / 16%); border-radius: 4px; color: #fff; background: rgb(255 255 255 / 5%); font: inherit; font-variant-numeric: tabular-nums; }
.particle-debug__control input[type='range'] { width: 100%; height: 3px; margin: 3px 0; accent-color: var(--color-accent); }
.particle-debug__control output { min-width: 34px; color: rgb(255 255 255 / 52%); font-variant-numeric: tabular-nums; text-align: right; }
.particle-debug__subcontrol { margin-top: 12px; }
.particle-debug__test { width: 100%; margin-top: 10px; padding: 8px; border: 1px solid rgb(255 236 0 / 34%); border-radius: 5px; color: var(--color-accent); }
.particle-debug__diagnostics { display: grid; gap: 4px; margin: 10px 0 0; color: rgb(255 255 255 / 62%); font-variant-numeric: tabular-nums; }
.particle-debug__diagnostics div { display: flex; justify-content: space-between; gap: 12px; }
.particle-debug__diagnostics dt, .particle-debug__diagnostics dd { margin: 0; }
.particle-debug__diagnostics dd { color: rgb(255 236 0 / 72%); text-align: right; }
.particle-debug__utility { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.particle-debug__utility .particle-debug__heading, .particle-debug__check, .particle-debug__copy, .particle-debug__status, .particle-debug__fallback { grid-column: 1 / -1; }
.particle-debug__utility button { padding: 8px; border: 1px solid rgb(255 236 0 / 22%); border-radius: 5px; color: rgb(255 255 255 / 78%); font-size: 11px; }
.particle-debug__utility button:hover { border-color: rgb(255 236 0 / 60%); color: var(--color-accent); }
.particle-debug__status { margin: 2px 0 0; color: rgb(255 236 0 / 72%); font-size: 11px; }
.particle-debug__fallback { width: 100%; min-height: 150px; resize: vertical; padding: 8px; border: 1px solid rgb(255 236 0 / 22%); border-radius: 5px; color: #fff; background: #10100f; font: 10px/1.4 Consolas, monospace; }
@media (max-width: 599px) { .particle-debug { bottom: 8px; left: 8px; width: min(340px, calc(100vw - 16px)); } .particle-debug__panel { max-height: calc(100vh - 70px); } }
</style>
