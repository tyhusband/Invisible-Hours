import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { motion } from 'motion/react'
import { dateKey, getWeekDates, getDisplaySlots, getDisplaySegments, type SlotGranularity } from '../../lib/slots'
import { useCalendarStore } from '../../store/calendarStore'
import { useUIStore } from '../../store/uiStore'
import { useGoogleCalendarStore } from '../../store/googleCalendarStore'
import { mapEventsToSlots } from '../../lib/googleCalendarSlots'
import { SlotCell } from './SlotCell'
import { useDragPaint } from '../../hooks/useDragPaint'
import { useSlotTagActions } from '../../hooks/useSlotTagActions'
import { TagPickerDropdown } from '../tags/TagPickerDropdown'
import type { SlotEntry } from '../../store/calendarStore'
import { computeSlotGroupPositions } from '../../lib/slotGroups'

const WEEK_SLOT_HEIGHTS: Record<SlotGranularity, number> = { 15: 24, 30: 44, 60: 72 }
const DAY_ABBREVS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

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

interface WeekGridProps {
  onStrokeComplete: (dk: string, changes: Record<string, SlotEntry | null>) => void
  onSaveNote: (dk: string, slotKey: string, note: string) => void
  onSaveSlotTags: (dk: string, baseKeys: string[], tagIds: string[]) => Promise<void>
  onSaveTags: () => Promise<void>
}

export function WeekGrid({ onStrokeComplete, onSaveNote, onSaveSlotTags, onSaveTags }: WeekGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const currentDate = useCalendarStore((s) => s.currentDate)
  const slotData = useCalendarStore((s) => s.slotData)
  const setFocusedSlot = useCalendarStore((s) => s.setFocusedSlot)

  const {
    tagPicker,
    pickerAssignedTagIds,
    openTagPicker,
    clearTagPicker,
    addTagToSlot,
    removeTagFromSlot,
  } = useSlotTagActions({ saveSlotTags: onSaveSlotTags })

  const showWeekends = useUIStore((s) => s.showWeekends)
  const granularity = useUIStore((s) => s.slotGranularity)

  const displaySlots = useMemo(() => getDisplaySlots(granularity), [granularity])
  const slotHeight = WEEK_SLOT_HEIGHTS[granularity]

  const allWeekDates = getWeekDates(currentDate)
  const visibleDays = useMemo(() => {
    const days = allWeekDates.map((d, i) => ({ date: d, abbrev: DAY_ABBREVS[i] }))
    return showWeekends ? days : days.slice(0, 5)
  }, [allWeekDates, showWeekends])
  const todayDk = dateKey(new Date())

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
      {/* Day headers */}
      <div className="flex border-b border-border flex-shrink-0">
        <div className="w-12 flex-shrink-0" />
        {visibleDays.map(({ date, abbrev }, i) => {
          const dk = dateKey(date)
          const isToday = dk === todayDk
          return (
            <motion.div
              key={dk}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`flex-1 text-center py-2 text-xs font-medium ${
                isToday ? 'text-accent bg-accent/5' : 'text-muted'
              }`}
            >
              {abbrev} {date.getDate()}
            </motion.div>
          )
        })}
      </div>

      {/* Slot grid */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        onMouseLeave={onMouseUp}
      >
        <div className="flex pt-3 pb-3 pr-2">
          {/* Hour labels gutter */}
          <div className="w-12 flex-shrink-0 relative" style={{ height: totalHeight }}>
            {displaySlots.map((ds) => {
              if (!ds.key.endsWith(':00')) return null
              return (
                <div
                  key={ds.key}
                  className="absolute right-1.5 text-[10px] text-muted select-none leading-none"
                  style={{ top: Math.max(0, ds.displayIndex * slotHeight - 5) }}
                >
                  {formatHourLabel(ds.key)}
                </div>
              )
            })}
          </div>

          {/* Day columns */}
          <div className="flex-1 flex gap-1">
            {visibleDays.map(({ date }) => {
              const dk = dateKey(date)
              return (
                <WeekDayColumn
                  key={dk}
                  dk={dk}
                  isToday={dk === todayDk}
                  slotData={slotData}
                  isDragging={isDragging}
                  displaySlots={displaySlots}
                  slotHeight={slotHeight}
                  granularity={granularity}
                  onSlotMouseDown={onSlotMouseDown}
                  onSlotMouseEnter={onSlotMouseEnter}
                  onSlotTouchStart={onSlotTouchStart}
                  onSlotTouchEnd={onSlotTouchEnd}
                  onSlotTouchCancel={onSlotTouchCancel}
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

interface WeekDayColumnProps {
  dk: string
  isToday: boolean
  slotData: Record<string, Record<string, import('../../store/calendarStore').SlotEntry>>
  isDragging: boolean
  displaySlots: import('../../lib/slots').DisplaySlot[]
  slotHeight: number
  granularity: SlotGranularity
  onSlotMouseDown: (dk: string, slotKey: string, e: React.MouseEvent) => void
  onSlotMouseEnter: (dk: string, slotKey: string) => void
  onSlotTouchStart: (dk: string, slotKey: string, x: number, y: number, touchId: number) => void
  onSlotTouchEnd: (dk: string, slotKey: string) => void
  onSlotTouchCancel: () => void
  onContextMenu: (e: React.MouseEvent, dk: string, slotKey: string) => void
  editingNoteSlot: { dk: string; slotKey: string } | null
  onStartNoteEdit: (dk: string, slotKey: string) => void
  onEndNoteEdit: () => void
  onSaveNote: (dk: string, slotKey: string, note: string) => void
  onOpenTagPicker: (dk: string, slotKey: string, button: HTMLElement) => void
  onRemoveTag: (dk: string, slotKey: string, tagId: string) => void
}

function WeekDayColumn({
  dk, isToday, slotData, isDragging, displaySlots, slotHeight, granularity,
  onSlotMouseDown, onSlotMouseEnter, onSlotTouchStart, onSlotTouchEnd, onSlotTouchCancel,
  onContextMenu, editingNoteSlot, onStartNoteEdit, onEndNoteEdit, onSaveNote, onOpenTagPicker, onRemoveTag,
}: WeekDayColumnProps) {
  const daySlots = slotData[dk] || {}
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

  return (
    <div className={`flex-1 ${isToday ? 'bg-accent/[0.03]' : ''}`}>
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
            isWeekView
            isDragging={isDragging}
            groupPosition={groupPositions[ds.key]}
            slotHeight={slotHeight}
            onMouseDown={onSlotMouseDown}
            onMouseEnter={onSlotMouseEnter}
            onTouchStart={onSlotTouchStart}
            onTouchEnd={onSlotTouchEnd}
            onTouchCancel={onSlotTouchCancel}
            onContextMenu={onContextMenu}
            editingNoteSlot={editingNoteSlot}
            onStartNoteEdit={onStartNoteEdit}
            onEndNoteEdit={onEndNoteEdit}
            onSaveNote={onSaveNote}
            onOpenTagPicker={onOpenTagPicker}
            onRemoveTag={onRemoveTag}
          />
        )
      })}
    </div>
  )
}
