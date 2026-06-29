import { memo, useRef, useCallback, useMemo, useEffect } from 'react'
import { contrastColor, lighten } from '../../lib/categories'
import { useCategoryStore } from '../../store/categoryStore'
import { useCalendarStore } from '../../store/calendarStore'
import { useTagStore } from '../../store/tagStore'
import { getUnionTagIds } from '../../lib/tags'
import { useIsMobile } from '../../hooks/useIsMobile'
import type { GoogleCalendarSlotInfo } from '../../store/googleCalendarStore'
import type { DisplaySegment } from '../../lib/slots'
import { TagChip } from '../tags/TagChip'
import { PlusIcon } from '../ui/Icons'

const TAP_MAX_MOVEMENT_PX = 14

const CROSS_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Cline x1='4' y1='4' x2='16' y2='16' stroke='white' stroke-width='4' stroke-linecap='round'/%3E%3Cline x1='16' y1='4' x2='4' y2='16' stroke='white' stroke-width='4' stroke-linecap='round'/%3E%3Cline x1='4' y1='4' x2='16' y2='16' stroke='black' stroke-width='2' stroke-linecap='round'/%3E%3Cline x1='16' y1='4' x2='4' y2='16' stroke='black' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E") 10 10, crosshair`

const PLUS_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Cline x1='10' y1='4' x2='10' y2='16' stroke='white' stroke-width='4' stroke-linecap='round'/%3E%3Cline x1='4' y1='10' x2='16' y2='10' stroke='white' stroke-width='4' stroke-linecap='round'/%3E%3Cline x1='10' y1='4' x2='10' y2='16' stroke='black' stroke-width='2' stroke-linecap='round'/%3E%3Cline x1='4' y1='10' x2='16' y2='10' stroke='black' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E") 10 10, cell`

const SWAP_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Cline x1='4' y1='7' x2='16' y2='7' stroke='white' stroke-width='4' stroke-linecap='round'/%3E%3Cpolyline points='12,4 16,7 12,10' fill='none' stroke='white' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cline x1='16' y1='13' x2='4' y2='13' stroke='white' stroke-width='4' stroke-linecap='round'/%3E%3Cpolyline points='8,10 4,13 8,16' fill='none' stroke='white' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cline x1='4' y1='7' x2='16' y2='7' stroke='black' stroke-width='2' stroke-linecap='round'/%3E%3Cpolyline points='12,4 16,7 12,10' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cline x1='16' y1='13' x2='4' y2='13' stroke='black' stroke-width='2' stroke-linecap='round'/%3E%3Cpolyline points='8,10 4,13 8,16' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") 10 10, pointer`

export type SlotGroupPosition = 'solo' | 'first' | 'middle' | 'last'

interface SlotCellProps {
  dk: string
  slotKey: string
  slotLabel: string
  segments: DisplaySegment[]
  googleEvent?: GoogleCalendarSlotInfo | null
  isWeekView?: boolean
  isDragging?: boolean
  groupPosition?: SlotGroupPosition
  slotHeight?: number
  onMouseDown: (dk: string, slotKey: string, e: React.MouseEvent) => void
  onMouseEnter: (dk: string, slotKey: string) => void
  onTouchStart?: (dk: string, slotKey: string, x: number, y: number, touchId: number) => void
  onTouchEnd?: (dk: string, slotKey: string) => void
  onTouchCancel?: () => void
  onContextMenu: (e: React.MouseEvent, dk: string, slotKey: string) => void
  editingNoteSlot: { dk: string; slotKey: string } | null
  onStartNoteEdit: (dk: string, slotKey: string) => void
  onEndNoteEdit: () => void
  onSaveNote: (dk: string, slotKey: string, note: string) => void
  onOpenTagPicker: (dk: string, slotKey: string, button: HTMLElement) => void
  onRemoveTag: (dk: string, slotKey: string, tagId: string) => void
}

const GROUP_RADIUS: Record<SlotGroupPosition, string> = {
  solo: 'rounded-lg',
  first: 'rounded-t-lg',
  middle: '',
  last: 'rounded-b-lg',
}

function buildSegmentGradient(
  segments: DisplaySegment[],
  getCategoryColor: (catId: string) => string,
): string | undefined {
  const n = segments.length
  if (n <= 1) return undefined

  const colors = segments.map((s) =>
    s.categoryId ? getCategoryColor(s.categoryId) : 'var(--color-surface)'
  )

  const bands: { color: string; start: number; end: number }[] = []
  let i = 0
  while (i < n) {
    let j = i + 1
    while (j < n && colors[j] === colors[i]) j++
    bands.push({
      color: colors[i],
      start: (i / n) * 100,
      end: (j / n) * 100,
    })
    i = j
  }

  if (bands.length === 1) return undefined

  const stops = bands.map((band, bi) => {
    const pos = bi === 0 ? 0 : bi === bands.length - 1 ? 100 : ((band.start + band.end) / 2)
    return `${band.color} ${pos}%`
  })

  return `linear-gradient(to bottom, ${stops.join(', ')})`
}

export const SlotCell = memo(function SlotCell({
  dk, slotKey, segments, googleEvent, isWeekView, isDragging, groupPosition, slotHeight,
  onMouseDown, onMouseEnter, onTouchStart, onTouchEnd, onTouchCancel, onContextMenu,
  editingNoteSlot, onStartNoteEdit, onEndNoteEdit, onSaveNote, onOpenTagPicker, onRemoveTag,
}: SlotCellProps) {
  const isMobile = useIsMobile()
  const tagPickerBtnRef = useRef<HTMLButtonElement>(null)
  const activeCategoryId = useCategoryStore((s) => s.activeCategoryId)
  const eraserOn = useCategoryStore((s) => s.eraserOn)
  const getCategoryColor = useCategoryStore((s) => s.getCategoryColor)
  const getCategoryLabel = useCategoryStore((s) => s.getCategoryLabel)

  const firstFilled = segments.find((s) => s.categoryId !== null)
  const isFilled = !!firstFilled
  const primaryCatId = firstFilled?.categoryId ?? null
  const noteBaseKey = firstFilled?.baseKey

  const slotData = useCalendarStore((s) => s.slotData)
  const tagPicker = useCalendarStore((s) => s.tagPicker)
  const setNote = useCalendarStore((s) => s.setNote)
  const getTagLabel = useTagStore((s) => s.getTagLabel)
  const getTagColor = useTagStore((s) => s.getTagColor)
  const note = noteBaseKey ? (slotData[dk]?.[noteBaseKey]?.note ?? '') : ''

  const segmentBaseKeys = useMemo(() => segments.map((s) => s.baseKey), [segments])
  const tagIds = useMemo(
    () => getUnionTagIds(slotData[dk] || {}, segmentBaseKeys),
    [slotData, dk, segmentBaseKeys],
  )

  const isTagPickerOpen =
    tagPicker?.dateKey === dk && tagPicker?.slotKey === slotKey

  const isEditingNote = !!(
    noteBaseKey &&
    editingNoteSlot?.dk === dk &&
    editingNoteSlot?.slotKey === noteBaseKey
  )

  const isMultiSegment = segments.length > 1
  const filledCount = segments.filter((s) => s.categoryId !== null).length
  const isPartialFill = isMultiSegment && filledCount > 0 && filledCount < segments.length
  const hasMultipleCategories = useMemo(() => {
    const cats = new Set(segments.filter((s) => s.categoryId).map((s) => s.categoryId))
    return cats.size > 1
  }, [segments])
  const needsGradient = isMultiSegment && isFilled && (hasMultipleCategories || isPartialFill)

  const color = primaryCatId ? getCategoryColor(primaryCatId) : undefined
  const textColor = color ? contrastColor(color) : undefined

  const combinedLabel = useMemo(() => {
    if (!isFilled) return undefined
    const seen = new Set<string>()
    const labels: string[] = []
    for (const seg of segments) {
      if (seg.categoryId && !seen.has(seg.categoryId)) {
        seen.add(seg.categoryId)
        labels.push(getCategoryLabel(seg.categoryId))
      }
    }
    return labels.join(' & ')
  }, [segments, isFilled, getCategoryLabel])

  const gradientBg = useMemo(
    () => needsGradient ? buildSegmentGradient(segments, getCategoryColor) : undefined,
    [needsGradient, segments, getCategoryColor],
  )

  const showPreview = !isFilled && activeCategoryId && !eraserOn
  const previewColor = showPreview ? getCategoryColor(activeCategoryId) : undefined

  const isHourStart = slotKey.endsWith(':00')

  const showCross = !isDragging && (eraserOn || (isFilled && activeCategoryId === primaryCatId))
  const showSwap = !isDragging && isFilled && !eraserOn && !!activeCategoryId && activeCategoryId !== primaryCatId
  const showPlus = !isDragging && !isFilled && !!activeCategoryId && !eraserOn

  const showIdleHover = !isDragging && isFilled && !activeCategoryId && !eraserOn
  const showTagAction = showIdleHover
  const roundedClass = groupPosition ? GROUP_RADIUS[groupPosition] : ''

  const idleGradient = useMemo(() => {
    if (!showIdleHover || !color) return undefined
    const l1 = lighten(color, 0.18)
    const l2 = lighten(color, 0.3)
    return `linear-gradient(-45deg, ${color}, ${l1}, ${l2}, ${l1}, ${color})`
  }, [showIdleHover, color])

  const swapColor = showSwap && activeCategoryId ? getCategoryColor(activeCategoryId) : undefined
  const swapOverlayRef = useRef<HTMLDivElement>(null)
  const noteInputRef = useRef<HTMLInputElement>(null)

  const touchStartPos = useRef({ x: 0, y: 0 })
  const touchMaxMove = useRef(0)
  const activeTouchId = useRef<number | null>(null)
  const removeTouchListeners = useRef<(() => void) | null>(null)

  const detachTouchListeners = useCallback(() => {
    removeTouchListeners.current?.()
    removeTouchListeners.current = null
  }, [])

  useEffect(() => () => detachTouchListeners(), [detachTouchListeners])

  useEffect(() => {
    if (!isEditingNote || !noteInputRef.current) return
    noteInputRef.current.focus()
    const len = noteInputRef.current.value.length
    noteInputRef.current.setSelectionRange(len, len)
  }, [isEditingNote])

  const handleNoteChange = useCallback((value: string) => {
    if (!noteBaseKey) return
    setNote(dk, noteBaseKey, value)
    onSaveNote(dk, noteBaseKey, value)
  }, [dk, noteBaseKey, setNote, onSaveNote])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!swapOverlayRef.current || !showSwap) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    swapOverlayRef.current.style.background =
      `radial-gradient(circle at ${x}px ${y}px, ${swapColor}90 0%, transparent 50%)`
  }, [showSwap, swapColor])

  const cursor = showCross
    ? CROSS_CURSOR
    : showSwap
      ? SWAP_CURSOR
      : showPlus
        ? PLUS_CURSOR
        : showIdleHover
          ? 'text'
          : undefined

  const fillStyle = useMemo(() => {
    if (!isFilled) return undefined
    if (gradientBg) {
      return { background: gradientBg, color: textColor }
    }
    return { backgroundColor: color, color: textColor }
  }, [isFilled, gradientBg, color, textColor])

  const slotTextClass = isWeekView ? 'text-[10px]' : 'text-xs'
  const labelClass = `${slotTextClass} font-medium relative z-10`
  const showLabel = !groupPosition || groupPosition === 'solo' || groupPosition === 'first'

  const handleIdleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isFilled || !noteBaseKey || isEditingNote) return
    const t = e.touches[0]
    detachTouchListeners()

    touchStartPos.current = { x: t.clientX, y: t.clientY }
    touchMaxMove.current = 0
    activeTouchId.current = t.identifier

    const onGlobalTouchMove = (ev: TouchEvent) => {
      if (activeTouchId.current === null) return
      let touch: Touch | undefined
      for (let i = 0; i < ev.touches.length; i++) {
        if (ev.touches[i].identifier === activeTouchId.current) {
          touch = ev.touches[i]
          break
        }
      }
      if (!touch) return
      const dx = touch.clientX - touchStartPos.current.x
      const dy = touch.clientY - touchStartPos.current.y
      const d = Math.hypot(dx, dy)
      if (d > touchMaxMove.current) touchMaxMove.current = d
    }

    const onGlobalTouchEnd = (ev: TouchEvent) => {
      if (activeTouchId.current === null) return
      let ours = false
      for (let i = 0; i < ev.changedTouches.length; i++) {
        if (ev.changedTouches[i].identifier === activeTouchId.current) {
          ours = true
          break
        }
      }
      if (!ours) return

      const maxMove = touchMaxMove.current
      detachTouchListeners()
      activeTouchId.current = null

      if (ev.type === 'touchcancel') return
      if (maxMove <= TAP_MAX_MOVEMENT_PX) {
        onStartNoteEdit(dk, noteBaseKey)
      }
    }

    window.addEventListener('touchmove', onGlobalTouchMove, { passive: true })
    window.addEventListener('touchend', onGlobalTouchEnd, true)
    window.addEventListener('touchcancel', onGlobalTouchEnd, true)
    removeTouchListeners.current = () => {
      window.removeEventListener('touchmove', onGlobalTouchMove)
      window.removeEventListener('touchend', onGlobalTouchEnd, true)
      window.removeEventListener('touchcancel', onGlobalTouchEnd, true)
    }
  }, [isFilled, noteBaseKey, isEditingNote, dk, onStartNoteEdit, detachTouchListeners])

  const handleOpenTagPicker = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (tagPickerBtnRef.current) {
      onOpenTagPicker(dk, slotKey, tagPickerBtnRef.current)
    }
  }, [dk, slotKey, onOpenTagPicker])

  const handleRemoveTag = useCallback((tagId: string) => {
    onRemoveTag(dk, slotKey, tagId)
  }, [dk, slotKey, onRemoveTag])

  return (
    <div
      data-dk={dk}
      data-slot-key={slotKey}
      className={`group relative flex items-center select-none ${isHourStart ? 'border-t border-border/40' : 'border-t border-border/15'}
      `}
      style={{ height: slotHeight ?? (isWeekView ? 44 : 48), ...(cursor ? { cursor } : {}) }}
      onMouseDown={(e) => {
        if (e.button === 2) return
        if (!activeCategoryId && !eraserOn) {
          if (isFilled && noteBaseKey) {
            e.preventDefault()
            onStartNoteEdit(dk, noteBaseKey)
          }
          return
        }
        onMouseDown(dk, slotKey, e)
      }}
      onMouseEnter={() => onMouseEnter(dk, slotKey)}
      onMouseMove={showSwap ? handleMouseMove : undefined}
      onTouchStart={(e) => {
        if (!activeCategoryId && !eraserOn) {
          handleIdleTouchStart(e)
          return
        }
        const t = e.touches[0]
        onTouchStart?.(dk, slotKey, t.clientX, t.clientY, t.identifier)
      }}
      onTouchEnd={() => {
        if (!activeCategoryId && !eraserOn) return
        onTouchEnd?.(dk, slotKey)
      }}
      onTouchCancel={() => {
        if (!activeCategoryId && !eraserOn) {
          detachTouchListeners()
          activeTouchId.current = null
          return
        }
        onTouchCancel?.()
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        if (isFilled) onContextMenu(e, dk, slotKey)
      }}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* Slot content */}
      <div className={`flex-1 h-full relative overflow-hidden ${roundedClass}`}>
        {isFilled ? (
          <div
            className={`absolute inset-0 flex items-center justify-between gap-1 px-2 transition-[filter,opacity] duration-150 ${roundedClass} ${
              showCross ? 'group-hover:opacity-60 group-hover:saturate-50' : ''
            }`}
            style={fillStyle}
          >
            {showLabel && (
              isEditingNote ? (
                <span className={`flex items-center min-w-0 flex-1 truncate ${labelClass}`}>
                  <span className="flex-shrink-0">{combinedLabel}</span>
                  <span className="opacity-70 mx-1 flex-shrink-0 font-normal">—</span>
                  <input
                    ref={noteInputRef}
                    value={note}
                    onChange={(e) => handleNoteChange(e.target.value)}
                    onBlur={onEndNoteEdit}
                    onKeyDown={(e) => { if (e.key === 'Escape') e.currentTarget.blur() }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    className={`flex-1 min-w-0 bg-transparent outline-none placeholder:opacity-50 ${isWeekView ? 'text-[10px]' : 'text-xs'} font-normal`}
                    style={{ color: textColor }}
                    placeholder="note"
                  />
                </span>
              ) : (
                <span className={`flex items-center min-w-0 flex-1 truncate ${slotTextClass} relative z-10`}>
                  <span className="font-medium flex-shrink-0">{combinedLabel}</span>
                  {note && (
                    <>
                      <span className="opacity-70 mx-1 flex-shrink-0 font-normal">—</span>
                      <span className="font-normal truncate">{note}</span>
                    </>
                  )}
                </span>
              )
            )}
            {!showLabel && <div className="flex-1 min-w-0" />}
            {(tagIds.length > 0 || showTagAction) && (
              <div className="flex items-center gap-0.5 flex-shrink-0 relative z-20">
                {showTagAction && textColor && (
                  <button
                    ref={tagPickerBtnRef}
                    type="button"
                    onMouseDown={handleOpenTagPicker}
                    onTouchStart={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleOpenTagPicker(e)
                    }}
                    className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 ${slotTextClass} font-medium leading-none flex-shrink-0 transition-opacity ${
                      isTagPickerOpen
                        ? 'opacity-100 ring-2 ring-white/40'
                        : isMobile
                          ? 'opacity-70 hover:opacity-100'
                          : 'opacity-0 group-hover:opacity-70 hover:!opacity-100'
                    }`}
                    style={{
                      color: textColor,
                      backgroundColor: textColor === '#FFFFFF'
                        ? 'rgba(0,0,0,0.15)'
                        : 'rgba(255,255,255,0.3)',
                    }}
                    aria-label="Add tags"
                  >
                    <PlusIcon size={isWeekView ? 10 : 12} />
                    {!isWeekView && <span>Tag</span>}
                  </button>
                )}
                {tagIds.map((tagId) => (
                  <TagChip
                    key={tagId}
                    label={getTagLabel(tagId)}
                    color={getTagColor(tagId)}
                    size="slot"
                    textClass={slotTextClass}
                    removable
                    onRemove={() => handleRemoveTag(tagId)}
                  />
                ))}
              </div>
            )}
            {showSwap && (
              <div
                ref={swapOverlayRef}
                className="absolute inset-0 rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
              />
            )}
            {showIdleHover && idleGradient && !gradientBg && (
              <div
                className="absolute inset-0 rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                style={{
                  background: idleGradient,
                  backgroundSize: '300% 300%',
                  animation: 'gradient-flow 6s ease infinite',
                }}
              />
            )}
          </div>
        ) : showPreview ? (
          <>
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-[0.31] transition-opacity rounded-lg"
              style={{ backgroundColor: previewColor }}
            />
            {googleEvent && (
              <div className={`absolute inset-0 flex items-center px-2 pointer-events-none bg-muted/15 ${googleEvent.isFirstSlot && googleEvent.isLastSlot ? 'rounded-lg' : googleEvent.isFirstSlot ? 'rounded-t-lg' : googleEvent.isLastSlot ? 'rounded-b-lg' : ''}`}>
                {googleEvent.isFirstSlot && (
                  <span className={`${isWeekView ? 'text-[9px]' : 'text-[11px]'} text-muted/80 truncate`}>
                    {googleEvent.summary}
                  </span>
                )}
              </div>
            )}
          </>
        ) : googleEvent ? (
          <div className={`absolute inset-0 flex items-center px-2 pointer-events-none bg-muted/15 ${googleEvent.isFirstSlot && googleEvent.isLastSlot ? 'rounded-lg' : googleEvent.isFirstSlot ? 'rounded-t-lg' : googleEvent.isLastSlot ? 'rounded-b-lg' : ''}`}>
            {googleEvent.isFirstSlot && (
              <span className={`${isWeekView ? 'text-[9px]' : 'text-[11px]'} text-muted/80 truncate`}>
                {googleEvent.summary}
              </span>
            )}
          </div>
        ) : (
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-[0.04] transition-opacity bg-current rounded-lg"
          />
        )}
      </div>
    </div>
  )
})
