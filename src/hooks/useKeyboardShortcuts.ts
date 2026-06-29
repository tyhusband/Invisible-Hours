import { useEffect } from 'react'
import { useCategoryStore } from '../store/categoryStore'
import { useCalendarStore } from '../store/calendarStore'
import { useUIStore } from '../store/uiStore'

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd/Ctrl + . => toggle focus mode (works even in inputs)
      if ((e.metaKey || e.ctrlKey) && e.key === '.') {
        e.preventDefault()
        useUIStore.getState().toggleFocusMode()
        return
      }

      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      const { categories, setActive, toggleEraser, eraserOn, activeCategoryId } = useCategoryStore.getState()
      const { focusedSlot, clearFocusedSlot, tagPicker, clearTagPicker, setSlot, slotData, pushUndo } = useCalendarStore.getState()

      // Cmd/Ctrl + Z => undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        useCalendarStore.getState().undo()
        return
      }

      // Number keys 1-9, 0 => select category
      if (e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key) - 1
        if (idx < categories.length) {
          setActive(categories[idx].catId)
        }
        return
      }
      if (e.key === '0') {
        if (categories.length >= 10) {
          setActive(categories[9].catId)
        }
        return
      }

      // E => toggle eraser
      if (e.key === 'e' || e.key === 'E') {
        toggleEraser()
        return
      }

      // A => add new category
      if (e.key === 'a' || e.key === 'A') {
        window.dispatchEvent(new CustomEvent('add-category'))
        return
      }

      // W => week view, D => day view, M => month view
      if (e.key === 'w' || e.key === 'W') {
        useCalendarStore.getState().setViewMode('week')
        return
      }
      if (e.key === 'd' || e.key === 'D') {
        useCalendarStore.getState().setViewMode('day')
        return
      }
      if (e.key === 'm' || e.key === 'M') {
        useCalendarStore.getState().setViewMode('month')
        return
      }

      // Arrow left/right => navigate calendar
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        const { currentDate, viewMode, setCurrentDate } = useCalendarStore.getState()
        const next = new Date(currentDate)
        const dir: -1 | 1 = e.key === 'ArrowLeft' ? -1 : 1
        if (viewMode === 'month') {
          next.setMonth(next.getMonth() + dir)
        } else if (viewMode === 'week') {
          next.setDate(next.getDate() + dir * 7)
        } else {
          next.setDate(next.getDate() + dir)
        }
        setCurrentDate(next, dir)
        return
      }

      // Escape => close tag picker, clear focused slot, or deselect category/eraser
      if (e.key === 'Escape') {
        if (tagPicker) {
          clearTagPicker()
          return
        }
        if (focusedSlot) {
          const dk = focusedSlot.dateKey
          const daySlots = slotData[dk] || {}
          if (daySlots[focusedSlot.slotKey]) {
            pushUndo({ dateKey: dk, slots: { ...daySlots } })
            setSlot(dk, focusedSlot.slotKey, null)
          }
          clearFocusedSlot()
        } else if (activeCategoryId) {
          setActive(null)
        } else if (eraserOn) {
          toggleEraser()
        }
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
