import { onBeforeUnmount, ref } from 'vue'

export function useCardCursorGlow() {
  const card = ref<HTMLElement | null>(null)
  const isCursorInside = ref(false)
  let animationFrame: number | undefined
  let targetX = 50
  let targetY = 50
  let currentX = 50
  let currentY = 50

  function animate() {
    animationFrame = undefined
    currentX += (targetX - currentX) * 0.14
    currentY += (targetY - currentY) * 0.14
    card.value?.style.setProperty('--cursor-glow-x', `${currentX}%`)
    card.value?.style.setProperty('--cursor-glow-y', `${currentY}%`)

    if (isCursorInside.value || Math.abs(targetX - currentX) > 0.15 || Math.abs(targetY - currentY) > 0.15) {
      animationFrame = window.requestAnimationFrame(animate)
    }
  }

  function requestAnimation() {
    if (animationFrame === undefined) animationFrame = window.requestAnimationFrame(animate)
  }

  function moveCursor(event: MouseEvent) {
    const bounds = card.value?.getBoundingClientRect()
    if (!bounds) return

    targetX = ((event.clientX - bounds.left) / bounds.width) * 100
    targetY = ((event.clientY - bounds.top) / bounds.height) * 100
    requestAnimation()
  }

  function enter(event: MouseEvent) {
    isCursorInside.value = true
    moveCursor(event)
  }

  function leave() {
    isCursorInside.value = false
  }

  onBeforeUnmount(() => {
    if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame)
  })

  return { card, isCursorInside, enter, leave, moveCursor }
}
