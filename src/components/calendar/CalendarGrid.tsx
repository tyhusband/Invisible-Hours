import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { dateKey, getDisplaySlots, getDisplaySegments, type SlotGranularity } from '../../lib/slots'
import { useCalendarStore } from '../../store/calendarStore'
import { useUIStore } from '../../store/uiStore'
import { useGoogleCalendarStore } from '../../store/googleCalendarStore'
import { mapEventsToSlots } from '../../lib/googleCalendarSlots'
import { SlotCell } from './SlotCell'
import { NowLine } from './NowLine'
import { useDragPaint } from '../../hooks/useDragPaint'
import { useSlotTagActions } from '../../hooks/useSlotTagActions'
import { TagPickerDropdown } from '../tags/TagPickerDropdown'
import type { SlotEntry } from '../../store/calendarStore'
import { computeSlotGroupPositions } from '../../lib/slotGroups'

const SLOT_HEIGHTS: Record<SlotGranularity, number> = { 15: 28, 30: 48, 60: 80 }

function scrollIndexForGranularity(granularity: SlotGranularity): number {
  const minuteTarget = 8 * 60
  const slotsPerHour = 60 / granularity
  return Math.floor((minuteTarget / 60) * slotsPerHour)
}

function formatHourLabel(slotKey: string): string {
  const hour = parseInt(slotKey.split(':')[0], 10)
  if (hour === 0) return '12 AM'
  if (hour < 12) return `${hour} AM`
  if (hour === 12) return '12 PM'
  return `${hour - 12} PM`
}

interface CalendarGridProps {
  onStrokeComplete: (dk: string, changes: Record<string, SlotEntry | null>) => void
  onSaveNote: (dk: string, slotKey: string, note: string) => void
  onSaveSlotTags: (dk: string, baseKeys: string[], tagIds: string[]) => Promise<void>
  onSaveTags: () => Promise<void>
}

export function CalendarGrid({ onStrokeComplete, onSaveNote, onSaveSlotTags, onSaveTags }: CalendarGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const currentDate = useCalendarStore((s) => s.currentDate)
  const slotData = useCalendarStore((s) => s.slotData)
  const setFocusedSlot = useCalendarStore((s) => s.setFocusedSlot)
  const granularity = useUIStore((s) => s.slotGranularity)

  const {
    tagPicker,
    pickerAssignedTagIds,
    openTagPicker,
    clearTagPicker,
    addTagToSlot,
    removeTagFromSlot,
  } = useSlotTagActions({ saveSlotTags: onSaveSlotTags })

  const dk = dateKey(currentDate)
  const daySlots = slotData[dk] || {}

  const displaySlots = useMemo(() => getDisplaySlots(granularity), [granularity])
  const slotHeight = SLOT_HEIGHTS[granularity]

  const groupPositions = useMemo(
    () => computeSlotGroupPositions(daySlots, granularity),
    [daySlots, granularity],
  )

  const gcalVisible = useGoogleCalendarStore((s) => s.visible)
  const gcalEvents = useGoogleCalendarStore((s) => s.eventsByDate[dk])
  const gcalSlots = useMemo(
    () => gcalVisible && gcalEvents ? mapEventsToSlots(gcalEvents, dk) : {},
    [gcalVisible, gcalEvents, dk],
  )

  const isToday = dk === dateKey(new Date())

  const {
    onSlotMouseDown,
    onSlotMouseEnter,
    onMouseUp,
    onSlotTouchStart,
    onSlotTouchEnd,
    onSlotTouchCancel,
    handleNativeTouchMove,
    isDragging,
  } = useDragPaint(onStrokeComplete)

  const [editingNoteSlot, setEditingNoteSlot] = useState<{
    dk: string; slotKey: string
  } | null>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const scrollIdx = scrollIndexForGranularity(granularity)
    requestAnimationFrame(() => {
      el.scrollTop = scrollIdx * slotHeight
    })
  }, [])

  useEffect(() => {
    window.addEventListener('mouseup', onMouseUp)
    return () => window.removeEventListener('mouseup', onMouseUp)
  }, [onMouseUp])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('touchmove', handleNativeTouchMove, { passive: false, capture: true })
    return () => {
      el.removeEventListener('touchmove', handleNativeTouchMove, true)
    }
  }, [handleNativeTouchMove])

  const handleContextMenu = useCallback((_e: React.MouseEvent, dk: string, slotKey: string) => {
    setFocusedSlot({ dateKey: dk, slotKey })
  }, [setFocusedSlot])

  const startNoteEdit = useCallback((dk: string, slotKey: string) => {
    setEditingNoteSlot({ dk, slotKey })
  }, [])

  const endNoteEdit = useCallback(() => {
    setEditingNoteSlot(null)
  }, [])

  const totalHeight = displaySlots.length * slotHeight

  return (
    <div className="h-full flex flex-col">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto relative"
        onMouseLeave={onMouseUp}
      >
        <div className="relative flex pt-3 pb-3 pr-2">
          {/* Hour labels gutter */}
          <div className="w-14 flex-shrink-0 relative" style={{ height: totalHeight }}>
            {displaySlots.map((ds) => {
              const isHour = ds.key.endsWith(':00')
              if (!isHour) return null
              return (
                <div
                  key={ds.key}
                  className="absolute right-2 text-[11px] text-muted select-none leading-none"
                  style={{ top: Math.max(0, ds.displayIndex * slotHeight - 6) }}
                >
                  {formatHourLabel(ds.key)}
                </div>
              )
            })}
          </div>

          {/* Slots column */}
          <div className="flex-1 relative">
            {isToday && <NowLine />}
            {displaySlots.map((ds) => {
              const segments = getDisplaySegments(daySlots, ds.baseKeys)
              const gcalEvent = gcalSlots[ds.baseKeys[0]] ?? null
              return (
                <SlotCell
                  key={ds.key}
                  dk={dk}
                  slotKey={ds.key}
                  slotLabel={ds.label}
                  segments={segments}
                  googleEvent={gcalEvent}
                  isDragging={isDragging}
                  groupPosition={groupPositions[ds.key]}
                  slotHeight={slotHeight}
                  onMouseDown={onSlotMouseDown}
                  onMouseEnter={onSlotMouseEnter}
                  onTouchStart={onSlotTouchStart}
                  onTouchEnd={onSlotTouchEnd}
                  onTouchCancel={onSlotTouchCancel}
                  onContextMenu={handleContextMenu}
                  editingNoteSlot={editingNoteSlot}
                  onStartNoteEdit={startNoteEdit}
                  onEndNoteEdit={endNoteEdit}
                  onSaveNote={onSaveNote}
                  onOpenTagPicker={openTagPicker}
                  onRemoveTag={removeTagFromSlot}
                />
              )
            })}
          </div>
        </div>
      </div>

      {tagPicker && (
        <TagPickerDropdown
          anchor={tagPicker.anchor}
          assignedTagIds={pickerAssignedTagIds}
          onSelect={(tagId) => addTagToSlot(tagPicker.dateKey, tagPicker.slotKey, tagId)}
          onSaveTags={onSaveTags}
          onClose={clearTagPicker}
        />
      )}
    </div>
  )
}
