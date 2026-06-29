import { useCallback } from 'react'
import { useCalendarStore } from '../store/calendarStore'
import { useTagStore } from '../store/tagStore'
import { useUIStore } from '../store/uiStore'
import {
  getDisplaySlotFilledKeys,
  getDisplaySlotTagIds,
  rectToAnchor,
} from '../lib/tags'

interface SlotTagSync {
  saveSlotTags: (dk: string, baseKeys: string[], tagIds: string[]) => Promise<void>
}

export function useSlotTagActions(sync: SlotTagSync) {
  const granularity = useUIStore((s) => s.slotGranularity)
  const slotData = useCalendarStore((s) => s.slotData)
  const tagPicker = useCalendarStore((s) => s.tagPicker)
  const setTagPicker = useCalendarStore((s) => s.setTagPicker)
  const clearTagPicker = useCalendarStore((s) => s.clearTagPicker)
  const setSlotTags = useCalendarStore((s) => s.setSlotTags)
  const touchRecentTag = useTagStore((s) => s.touchRecentTag)

  const openTagPicker = useCallback(
    (dk: string, slotKey: string, button: HTMLElement) => {
      const current = useCalendarStore.getState().tagPicker
      if (current?.dateKey === dk && current?.slotKey === slotKey) {
        clearTagPicker()
        return
      }
      const rect = button.getBoundingClientRect()
      setTagPicker({ dateKey: dk, slotKey, anchor: rectToAnchor(rect) })
    },
    [setTagPicker, clearTagPicker],
  )

  const addTagToSlot = useCallback(
    (dk: string, displaySlotKey: string, tagId: string) => {
      const daySlots = slotData[dk] || {}
      const filledBaseKeys = getDisplaySlotFilledKeys(daySlots, displaySlotKey, granularity)
      if (filledBaseKeys.length === 0) return

      const current = getDisplaySlotTagIds(daySlots, displaySlotKey, granularity)
      if (current.includes(tagId)) return

      const next = [...current, tagId]
      setSlotTags(dk, filledBaseKeys, next)
      touchRecentTag(tagId)
      sync.saveSlotTags(dk, filledBaseKeys, next)
    },
    [slotData, granularity, setSlotTags, touchRecentTag, sync],
  )

  const removeTagFromSlot = useCallback(
    (dk: string, displaySlotKey: string, tagId: string) => {
      const daySlots = slotData[dk] || {}
      const filledBaseKeys = getDisplaySlotFilledKeys(daySlots, displaySlotKey, granularity)
      if (filledBaseKeys.length === 0) return

      const current = getDisplaySlotTagIds(daySlots, displaySlotKey, granularity)
      if (!current.includes(tagId)) return

      const next = current.filter((id) => id !== tagId)
      setSlotTags(dk, filledBaseKeys, next)
      sync.saveSlotTags(dk, filledBaseKeys, next)
    },
    [slotData, granularity, setSlotTags, sync],
  )

  const pickerAssignedTagIds = tagPicker
    ? getDisplaySlotTagIds(slotData[tagPicker.dateKey] || {}, tagPicker.slotKey, granularity)
    : []

  return {
    tagPicker,
    pickerAssignedTagIds,
    openTagPicker,
    clearTagPicker,
    addTagToSlot,
    removeTagFromSlot,
  }
}
