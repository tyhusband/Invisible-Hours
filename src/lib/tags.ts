import type { CSSProperties } from 'react'
import type { SlotData } from '../store/calendarStore'
import { getDisplaySlots, type SlotGranularity } from './slots'

export interface Tag {
  tagId: string
  label: string
  color: string
  isDeleted: boolean
  sortOrder: number
}

export const TAG_LABEL_MAX = 15
export const RECENT_TAG_LIMIT = 5

export interface TagPickerAnchor {
  top: number
  left: number
  bottom: number
  right: number
  width: number
  height: number
}

export function getFilledBaseKeys(daySlots: SlotData, baseKeys: string[]): string[] {
  return baseKeys.filter((k) => daySlots[k]?.categoryId)
}

export function getUnionTagIds(daySlots: SlotData, baseKeys: string[]): string[] {
  const ids = new Set<string>()
  for (const k of baseKeys) {
    const entry = daySlots[k]
    if (entry?.tagIds) {
      for (const id of entry.tagIds) ids.add(id)
    }
  }
  return Array.from(ids)
}

export function getDisplaySlotFilledKeys(
  daySlots: SlotData,
  displaySlotKey: string,
  granularity: SlotGranularity,
): string[] {
  const displaySlot = getDisplaySlots(granularity).find((ds) => ds.key === displaySlotKey)
  if (!displaySlot) return []
  return getFilledBaseKeys(daySlots, displaySlot.baseKeys)
}

export function getDisplaySlotTagIds(
  daySlots: SlotData,
  displaySlotKey: string,
  granularity: SlotGranularity,
): string[] {
  const displaySlot = getDisplaySlots(granularity).find((ds) => ds.key === displaySlotKey)
  if (!displaySlot) return []
  return getUnionTagIds(daySlots, displaySlot.baseKeys)
}

export function rectToAnchor(rect: DOMRect): TagPickerAnchor {
  return {
    top: rect.top,
    left: rect.left,
    bottom: rect.bottom,
    right: rect.right,
    width: rect.width,
    height: rect.height,
  }
}

export function anchorToStyle(anchor: TagPickerAnchor, menuHeight = 200): CSSProperties {
  const menuWidth = 192
  const gap = 4
  let top = anchor.bottom + gap
  let left = anchor.right - menuWidth

  if (left < 8) left = 8
  if (left + menuWidth > window.innerWidth - 8) {
    left = window.innerWidth - menuWidth - 8
  }
  if (top + menuHeight > window.innerHeight - 8) {
    top = anchor.top - menuHeight - gap
  }

  return {
    position: 'fixed',
    top,
    left,
    width: menuWidth,
    zIndex: 60,
  }
}
