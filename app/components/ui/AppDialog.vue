<script setup lang="ts">
const props = defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ close: [] }>()
const dialog = useTemplateRef('dialog')
const titleId = useId()

watch(() => props.open, (open) => {
  if (open && !dialog.value?.open) dialog.value?.showModal()
  else if (!open && dialog.value?.open) dialog.value?.close()
}, { flush: 'post' })

onMounted(() => { if (props.open) dialog.value?.showModal() })
function dismiss(event: MouseEvent) {
  const element = dialog.value
  if (!element || event.target !== element) return
  const bounds = element.getBoundingClientRect()
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) emit('close')
}
</script>

<template>
  <dialog ref="dialog" class="app-dialog" :aria-labelledby="titleId" @cancel.prevent="emit('close')" @close="emit('close')" @click="dismiss">
    <div class="app-dialog__heading">
      <h2 :id="titleId">{{ title }}</h2>
      <button class="text-button" type="button" autofocus @click="emit('close')">Закрыть</button>
    </div>
    <slot />
  </dialog>
</template>

<style scoped>
.app-dialog { width: min(640px, calc(100% - 32px)); max-height: calc(100svh - 48px); margin: auto; padding: clamp(24px, 4vw, 40px); border: 1px solid #ffffff26; border-radius: 12px; background: var(--color-bg); color: var(--color-text); box-shadow: 0 24px 100px #0008; }
.app-dialog::backdrop { background: #000b; backdrop-filter: blur(8px); }
.app-dialog__heading { display: flex; align-items: start; justify-content: space-between; gap: 24px; margin-bottom: 28px; }
.app-dialog__heading h2 { font-size: 24px; line-height: 1.4; font-weight: 400; }
.app-dialog__heading button { flex: none; margin-top: 5px; }
</style>
