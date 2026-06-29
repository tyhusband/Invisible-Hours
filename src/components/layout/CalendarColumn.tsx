import { useCallback, useRef, useEffect } from 'react'
import { useCalendarStore } from '../../store/calendarStore'
import { dateKey } from '../../lib/slots'
import { CalendarGrid } from '../calendar/CalendarGrid'
import { WeekGrid } from '../calendar/WeekGrid'
import { MonthGrid } from '../calendar/MonthGrid'
import type { SlotEntry } from '../../store/calendarStore'

interface CalendarColumnProps {
  sync: {
    saveEntries: (dk: string, changes: Record<string, SlotEntry | null>) => Promise<void>
    saveNote: (dk: string, slotKey: string, note: string) => Promise<void>
    saveSlotTags: (dk: string, baseKeys: string[], tagIds: string[]) => Promise<void>
    saveTags: () => Promise<void>
  }
}

export function CalendarColumn({ sync }: CalendarColumnProps) {
  const viewMode = useCalendarStore((s) => s.viewMode)
  const currentDate = useCalendarStore((s) => s.currentDate)
  const navDirection = useCalendarStore((s) => s.navDirection)
  const contentRef = useRef<HTMLDivElement>(null)
  const prevDateKey = useRef(dateKey(currentDate))

  useEffect(() => {
    const key = dateKey(currentDate)
    if (key === prevDateKey.current || navDirection === 0) {
      prevDateKey.current = key
      return
    }
    prevDateKey.current = key

    const el = contentRef.current
    if (!el) return

    const offset = navDirection * 16
    el.style.transition = 'none'
    el.style.transform = `translateX(${offset}px)`

    requestAnimationFrame(() => {
      el.style.transition = 'transform 0.25s cubic-bezier(0.25, 0.1, 0.25, 1)'
      el.style.transform = 'translateX(0)'
    })
  }, [currentDate, navDirection])

  const onStrokeComplete = useCallback((dk: string, changes: Record<string, SlotEntry | null>) => {
    sync.saveEntries(dk, changes)
  }, [sync])

  const onSaveNote = useCallback((dk: string, slotKey: string, note: string) => {
    sync.saveNote(dk, slotKey, note)
  }, [sync])

  const onSaveSlotTags = useCallback((dk: string, baseKeys: string[], tagIds: string[]) => {
    return sync.saveSlotTags(dk, baseKeys, tagIds)
  }, [sync])

  const onSaveTags = useCallback(() => sync.saveTags(), [sync])

  return (
    <div className="h-full bg-surface border-x border-border overflow-hidden">
      <div ref={contentRef} className="h-full">
        {viewMode === 'day' ? (
          <CalendarGrid
            onStrokeComplete={onStrokeComplete}
            onSaveNote={onSaveNote}
            onSaveSlotTags={onSaveSlotTags}
            onSaveTags={onSaveTags}
          />
        ) : viewMode === 'week' ? (
          <WeekGrid
            onStrokeComplete={onStrokeComplete}
            onSaveNote={onSaveNote}
            onSaveSlotTags={onSaveSlotTags}
            onSaveTags={onSaveTags}
          />
        ) : (
          <MonthGrid />
        )}
      </div>
    </div>
  )
}
