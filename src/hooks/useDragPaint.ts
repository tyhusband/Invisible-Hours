import { useRef, useCallback, useState, useEffect } from 'react'
import { useCalendarStore, type SlotData, type SlotEntry } from '../store/calendarStore'
import { useCategoryStore } from '../store/categoryStore'
import { SLOT_INDEX, SLOTS, SLOT_MINUTES, type SlotGranularity } from '../lib/slots'
import { useUIStore } from '../store/uiStore'

/**
 * Commit tap-to-paint only if the finger stays within this radius (px) of touchstart.
 * Larger motion = scroll / drag intent, not a tap.
 */
const TAP_MAX_MOVEMENT_PX = 14

interface DragPaintResult {
  onSlotMouseDown: (dk: string, slotKey: string, e: React.MouseEvent) => void
  onSlotMouseEnter: (dk: string, slotKey: string) => void
  onMouseUp: () => void
  /** `touchId` must be `Touch.identifier` from the same touchstart event (used for global touchend matching). */
  onSlotTouchStart: (dk: string, slotKey: string, touchX: number, touchY: number, touchId: number) => void
  /** Unused: tap completion runs on window `touchend` (see onSlotTouchStart). Kept so callers can omit wiring. */
  onSlotTouchEnd: (dk: string, slotKey: string) => void
  onSlotTouchCancel: () => void
  handleNativeTouchMove: (e: TouchEvent) => void
  isDragging: boolean
}

function getChunkBaseKeys(displayKey: string, granularity: SlotGranularity): string[] {
  const step = granularity / SLOT_MINUTES
  const baseIdx = SLOT_INDEX[displayKey]
  if (baseIdx === undefined) return [displayKey]
  const keys: string[] = []
  for (let i = 0; i < step && baseIdx + i < SLOTS.length; i++) {
    keys.push(SLOTS[baseIdx + i].key)
  }
  return keys
}

function displayIndexFromKey(displayKey: string, granularity: SlotGranularity): number {
  const step = granularity / SLOT_MINUTES
  const baseIdx = SLOT_INDEX[displayKey]
  return Math.floor(baseIdx / step)
}

function displayKeyFromIndex(displayIndex: number, granularity: SlotGranularity): string {
  const step = granularity / SLOT_MINUTES
  const baseIdx = displayIndex * step
  return SLOTS[baseIdx].key
}

export function useDragPaint(onStrokeComplete?: (dk: string, changes: Record<string, SlotEntry | null>) => void): DragPaintResult {
  const isDragging = useRef(false)
  const [isDraggingState, setIsDraggingState] = useState(false)
  const dragDateKey = useRef<string>('')
  const dragLastKey = useRef<string>('')
  const dragMode = useRef<'paint' | 'erase'>('paint')
  const dragCategoryId = useRef<string | null>(null)
  const preStrokeSnapshot = useRef<SlotData>({})
  const dragStroke = useRef<Set<string>>(new Set())
  const strokeChanges = useRef<Record<string, SlotEntry | null>>({})

  const touchStartSlot = useRef<{ dk: string; slotKey: string } | null>(null)
  const touchStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const touchMaxMove = useRef(0)
  const activeTouchId = useRef<number | null>(null)
  const removeGlobalTouchListeners = useRef<(() => void) | null>(null)
  /** After a touch tap paints, iOS may emit a synthetic mouse sequence — ignore mousedown briefly. */
  const ignoreMouseDownUntil = useRef(0)

  const detachGlobalTouchListeners = useCallback(() => {
    removeGlobalTouchListeners.current?.()
    removeGlobalTouchListeners.current = null
  }, [])

  useEffect(
    () => () => {
      detachGlobalTouchListeners()
      activeTouchId.current = null
      touchStartSlot.current = null
    },
    [detachGlobalTouchListeners],
  )

  const paintSlot = useCallback((dk: string, slotKey: string) => {
    const { setSlot } = useCalendarStore.getState()

    if (dragMode.current === 'erase') {
      const hadContent = !!preStrokeSnapshot.current[slotKey]
      if (hadContent) {
        setSlot(dk, slotKey, null)
        strokeChanges.current[slotKey] = null
      }
    } else if (dragCategoryId.current) {
      const entry: SlotEntry = { categoryId: dragCategoryId.current, note: '', tagIds: [] }
      setSlot(dk, slotKey, entry)
      strokeChanges.current[slotKey] = entry
    }
    dragStroke.current.add(slotKey)
  }, [])

  const paintChunk = useCallback((dk: string, displayKey: string) => {
    const granularity = useUIStore.getState().slotGranularity
    const baseKeys = getChunkBaseKeys(displayKey, granularity)
    for (const key of baseKeys) {
      paintSlot(dk, key)
    }
  }, [paintSlot])

  const restoreSlot = useCallback((dk: string, slotKey: string) => {
    if (!dragStroke.current.has(slotKey)) return
    const { setSlot } = useCalendarStore.getState()
    const original = preStrokeSnapshot.current[slotKey] ?? null
    setSlot(dk, slotKey, original)
    dragStroke.current.delete(slotKey)
    delete strokeChanges.current[slotKey]
  }, [])

  const restoreChunk = useCallback((dk: string, displayKey: string) => {
    const granularity = useUIStore.getState().slotGranularity
    const baseKeys = getChunkBaseKeys(displayKey, granularity)
    for (const key of baseKeys) {
      restoreSlot(dk, key)
    }
  }, [restoreSlot])

  const fillGap = useCallback((dk: string, fromKey: string, toKey: string) => {
    const granularity = useUIStore.getState().slotGranularity
    const fromDI = displayIndexFromKey(fromKey, granularity)
    const toDI = displayIndexFromKey(toKey, granularity)
    const step = toDI > fromDI ? 1 : -1

    for (let di = fromDI + step; step > 0 ? di <= toDI : di >= toDI; di += step) {
      const dKey = displayKeyFromIndex(di, granularity)
      const baseKeys = getChunkBaseKeys(dKey, granularity)
      const anyPainted = baseKeys.some((k) => dragStroke.current.has(k))
      if (!anyPainted) {
        paintChunk(dk, dKey)
      }
    }
  }, [paintChunk])

  const enterSlot = useCallback((dk: string, slotKey: string) => {
    if (!isDragging.current) return
    if (dk !== dragDateKey.current) return
    if (slotKey === dragLastKey.current) return

    const granularity = useUIStore.getState().slotGranularity
    const currentDI = displayIndexFromKey(slotKey, granularity)
    const lastDI = displayIndexFromKey(dragLastKey.current, granularity)

    const baseKeys = getChunkBaseKeys(slotKey, granularity)
    const alreadyPainted = baseKeys.some((k) => dragStroke.current.has(k))

    if (alreadyPainted) {
      const minDI = Math.min(currentDI, lastDI)
      const maxDI = Math.max(currentDI, lastDI)

      for (let di = minDI; di <= maxDI; di++) {
        restoreChunk(dk, displayKeyFromIndex(di, granularity))
      }
    } else {
      fillGap(dk, dragLastKey.current, slotKey)
    }

    dragLastKey.current = slotKey
  }, [restoreChunk, fillGap])

  const beginStroke = useCallback((dk: string, slotKey: string) => {
    const { activeCategoryId, eraserOn } = useCategoryStore.getState()
    const { slotData, pushUndo } = useCalendarStore.getState()
    const granularity = useUIStore.getState().slotGranularity

    if (!activeCategoryId && !eraserOn) return

    const daySlots = slotData[dk] || {}
    const baseKeys = getChunkBaseKeys(slotKey, granularity)
    const existing = daySlots[baseKeys[0]]

    isDragging.current = true
    setIsDraggingState(true)
    dragDateKey.current = dk
    dragLastKey.current = slotKey
    preStrokeSnapshot.current = { ...daySlots }
    dragStroke.current = new Set()
    strokeChanges.current = {}

    pushUndo({ dateKey: dk, slots: { ...daySlots } })

    if (eraserOn) {
      dragMode.current = 'erase'
      dragCategoryId.current = null
      paintChunk(dk, slotKey)
    } else if (activeCategoryId) {
      if (existing && existing.categoryId === activeCategoryId) {
        dragMode.current = 'erase'
        dragCategoryId.current = null
        paintChunk(dk, slotKey)
      } else {
        dragMode.current = 'paint'
        dragCategoryId.current = activeCategoryId
        paintChunk(dk, slotKey)
      }
    }
  }, [paintChunk])

  const endStroke = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false
    setIsDraggingState(false)

    const dk = dragDateKey.current
    const changes = { ...strokeChanges.current }
    strokeChanges.current = {}
    dragStroke.current.clear()

    if (Object.keys(changes).length > 0 && onStrokeComplete) {
      onStrokeComplete(dk, changes)
    }
  }, [onStrokeComplete])

  const beginStrokeRef = useRef(beginStroke)
  beginStrokeRef.current = beginStroke
  const endStrokeRef = useRef(endStroke)
  endStrokeRef.current = endStroke

  // --- Mouse handlers ---

  const onSlotMouseDown = useCallback((dk: string, slotKey: string, e: React.MouseEvent) => {
    if (Date.now() < ignoreMouseDownUntil.current) return
    e.preventDefault()
    beginStroke(dk, slotKey)
  }, [beginStroke])

  const onSlotMouseEnter = useCallback((dk: string, slotKey: string) => {
    enterSlot(dk, slotKey)
  }, [enterSlot])

  const onMouseUp = useCallback(() => {
    endStroke()
  }, [endStroke])

  // --- Touch: tap-only via window touchend (slot-level touchend is unreliable on iOS) ---

  const onSlotTouchStart = useCallback(
    (dk: string, slotKey: string, touchX: number, touchY: number, touchId: number) => {
      detachGlobalTouchListeners()

      touchStartSlot.current = { dk, slotKey }
      touchStartPos.current = { x: touchX, y: touchY }
      touchMaxMove.current = 0
      activeTouchId.current = touchId

      const onGlobalTouchEnd = (e: TouchEvent) => {
        if (activeTouchId.current === null) return
        let ours = false
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === activeTouchId.current) {
            ours = true
            break
          }
        }
        if (!ours) return

        const slot = touchStartSlot.current
        const maxMove = touchMaxMove.current

        detachGlobalTouchListeners()
        activeTouchId.current = null
        touchStartSlot.current = null

        if (e.type === 'touchcancel') return
        if (!slot) return
        if (maxMove > TAP_MAX_MOVEMENT_PX) return

        beginStrokeRef.current(slot.dk, slot.slotKey)
        endStrokeRef.current()
        ignoreMouseDownUntil.current = Date.now() + 450
      }

      window.addEventListener('touchend', onGlobalTouchEnd, true)
      window.addEventListener('touchcancel', onGlobalTouchEnd, true)
      removeGlobalTouchListeners.current = () => {
        window.removeEventListener('touchend', onGlobalTouchEnd, true)
        window.removeEventListener('touchcancel', onGlobalTouchEnd, true)
      }
    },
    [detachGlobalTouchListeners],
  )

  const handleNativeTouchMove = useCallback((e: TouchEvent) => {
    if (!touchStartSlot.current || activeTouchId.current === null) return
    let t: Touch | undefined
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === activeTouchId.current) {
        t = e.touches[i]
        break
      }
    }
    if (!t) return
    const dx = t.clientX - touchStartPos.current.x
    const dy = t.clientY - touchStartPos.current.y
    const d = Math.hypot(dx, dy)
    if (d > touchMaxMove.current) touchMaxMove.current = d
  }, [])

  const onSlotTouchEnd = useCallback((_dk: string, _slotKey: string) => {}, [])

  const onSlotTouchCancel = useCallback(() => {
    detachGlobalTouchListeners()
    activeTouchId.current = null
    touchStartSlot.current = null
  }, [detachGlobalTouchListeners])

  return {
    onSlotMouseDown,
    onSlotMouseEnter,
    onMouseUp,
    onSlotTouchStart,
    onSlotTouchEnd,
    onSlotTouchCancel,
    handleNativeTouchMove,
    isDragging: isDraggingState,
  }
}
