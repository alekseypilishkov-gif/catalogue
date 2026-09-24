import { onBeforeUnmount, ref } from 'vue'

// Prototype tuning: response is measured per second, independently of frame rate.
const FOLLOW_RESPONSE = 8
const SETTLE_DISTANCE = 0.2

export function usePrototypeCardGlow() {
  const card = ref<HTMLElement | null>(null)
  const glow = ref<HTMLElement | null>(null)
  const isCursorInside = ref(false)
  let animationFrame: number | undefined
  let lastFrameTime: number | undefined
  let currentX = 0
  let currentY = 0
  let targetX = 0
  let targetY = 0

  function renderGlow() {
    if (glow.value) glow.value.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`
  }

  function stopAnimation() {
    if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame)
    animationFrame = undefined
    lastFrameTime = undefined
  }

  function animate(time: number) {
    animationFrame = undefined
    const elapsed = lastFrameTime === undefined ? 16.67 : Math.min(time - lastFrameTime, 64)
    lastFrameTime = time
    const alpha = 1 - Math.exp(-FOLLOW_RESPONSE * elapsed / 1000)
    currentX += (targetX - currentX) * alpha
    currentY += (targetY - currentY) * alpha
    renderGlow()

    if (isCursorInside.value && (Math.abs(targetX - currentX) > SETTLE_DISTANCE || Math.abs(targetY - currentY) > SETTLE_DISTANCE)) {
      animationFrame = window.requestAnimationFrame(animate)
    } else {
      lastFrameTime = undefined
    }
  }

  function setTarget(event: PointerEvent) {
    const bounds = card.value?.getBoundingClientRect()
    if (!bounds || !bounds.width || !bounds.height) return false
    targetX = Math.min(bounds.width, Math.max(0, event.clientX - bounds.left)) - bounds.width / 2
    targetY = Math.min(bounds.height, Math.max(0, event.clientY - bounds.top)) - bounds.height / 2
    return true
  }

  function enter(event: PointerEvent) {
    if (event.pointerType === 'touch' || !setTarget(event)) return
    stopAnimation()
    currentX = targetX
    currentY = targetY
    renderGlow()
    isCursorInside.value = true
  }

  function moveCursor(event: PointerEvent) {
    if (!isCursorInside.value || event.pointerType === 'touch' || !setTarget(event)) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      stopAnimation()
      currentX = targetX
      currentY = targetY
      renderGlow()
      return
    }
    if (animationFrame === undefined) animationFrame = window.requestAnimationFrame(animate)
  }

  function leave() {
    isCursorInside.value = false
    stopAnimation()
  }

  onBeforeUnmount(stopAnimation)

  return { card, glow, isCursorInside, enter, leave, moveCursor }
}
