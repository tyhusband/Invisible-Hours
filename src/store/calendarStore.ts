import { create } from 'zustand'
import { dateKey } from '../lib/slots'
import type { TagPickerAnchor } from '../lib/tags'

export interface SlotEntry {
  categoryId: string
  note: string
  tagIds: string[]
}

export type SlotData = Record<string, SlotEntry>

export interface UndoEntry {
  dateKey: string
  slots: SlotData
}

interface CalendarState {
  currentDate: Date
  viewMode: 'day' | 'week' | 'month'
  navDirection: -1 | 0 | 1
  slotData: Record<string, SlotData>
  undoStack: UndoEntry[]
  focusedSlot: { dateKey: string; slotKey: string } | null
  tagPicker: { dateKey: string; slotKey: string; anchor: TagPickerAnchor } | null

  setCurrentDate: (d: Date, dir?: -1 | 1) => void
  setViewMode: (mode: 'day' | 'week' | 'month') => void
  setSlotData: (dk: string, data: SlotData) => void
  mergeSlotData: (allData: Record<string, SlotData>) => void

  setSlot: (dk: string, slotKey: string, entry: SlotEntry | null) => void
  setSlotsBatch: (dk: string, updates: Record<string, SlotEntry | null>) => void
  setNote: (dk: string, slotKey: string, note: string) => void
  setSlotTags: (dk: string, baseKeys: string[], tagIds: string[]) => void
  removeTagFromAllSlots: (tagId: string) => void

  pushUndo: (entry: UndoEntry) => void
  undo: () => UndoEntry | null

  replaceCategoryInSlots: (sourceCatId: string, targetCatId: string) => void

  setFocusedSlot: (slot: { dateKey: string; slotKey: string } | null) => void
  clearFocusedSlot: () => void
  setTagPicker: (picker: { dateKey: string; slotKey: string; anchor: TagPickerAnchor } | null) => void
  clearTagPicker: () => void
}

const MAX_UNDO = 50

export const useCalendarStore = create<CalendarState>((set, get) => ({
  currentDate: new Date(),
  viewMode: 'day',
  navDirection: 0,
  slotData: {},
  undoStack: [],
  focusedSlot: null,
  tagPicker: null,

  setCurrentDate: (d, dir) => set({ currentDate: d, navDirection: dir ?? 0 }),
  setViewMode: (mode) => set({ viewMode: mode }),

  setSlotData: (dk, data) =>
    set((state) => ({
      slotData: { ...state.slotData, [dk]: data },
    })),

  mergeSlotData: (allData) =>
    set((state) => ({
      slotData: { ...state.slotData, ...allData },
    })),

  setSlot: (dk, slotKey, entry) =>
    set((state) => {
      const daySlots = { ...(state.slotData[dk] || {}) }
      if (entry === null) {
        delete daySlots[slotKey]
      } else {
        daySlots[slotKey] = entry
      }
      return { slotData: { ...state.slotData, [dk]: daySlots } }
    }),

  setSlotsBatch: (dk, updates) =>
    set((state) => {
      const daySlots = { ...(state.slotData[dk] || {}) }
      for (const [key, entry] of Object.entries(updates)) {
        if (entry === null) {
          delete daySlots[key]
        } else {
          daySlots[key] = entry
        }
      }
      return { slotData: { ...state.slotData, [dk]: daySlots } }
    }),

  setNote: (dk, slotKey, note) =>
    set((state) => {
      const daySlots = { ...(state.slotData[dk] || {}) }
      if (daySlots[slotKey]) {
        daySlots[slotKey] = { ...daySlots[slotKey], note }
      }
      return { slotData: { ...state.slotData, [dk]: daySlots } }
    }),

  setSlotTags: (dk, baseKeys, tagIds) =>
    set((state) => {
      const daySlots = { ...(state.slotData[dk] || {}) }
      let changed = false
      for (const key of baseKeys) {
        if (daySlots[key]) {
          daySlots[key] = { ...daySlots[key], tagIds: [...tagIds] }
          changed = true
        }
      }
      if (!changed) return state
      return { slotData: { ...state.slotData, [dk]: daySlots } }
    }),

  removeTagFromAllSlots: (tagId) =>
    set((state) => {
      const newSlotData = { ...state.slotData }
      let anyChanged = false
      for (const dk of Object.keys(newSlotData)) {
        const daySlots = newSlotData[dk]
        let dayChanged = false
        const newDay = { ...daySlots }
        for (const [key, entry] of Object.entries(newDay)) {
          const tagIds = entry.tagIds ?? []
          if (tagIds.includes(tagId)) {
            newDay[key] = { ...entry, tagIds: tagIds.filter((id) => id !== tagId) }
            dayChanged = true
          }
        }
        if (dayChanged) {
          newSlotData[dk] = newDay
          anyChanged = true
        }
      }
      if (!anyChanged) return state
      return { slotData: newSlotData }
    }),

  pushUndo: (entry) =>
    set((state) => ({
      undoStack: [...state.undoStack.slice(-(MAX_UNDO - 1)), entry],
    })),

  undo: () => {
    const { undoStack } = get()
    if (undoStack.length === 0) return null
    const entry = undoStack[undoStack.length - 1]
    set((state) => ({
      undoStack: state.undoStack.slice(0, -1),
      slotData: { ...state.slotData, [entry.dateKey]: entry.slots },
    }))
    return entry
  },

  replaceCategoryInSlots: (sourceCatId, targetCatId) =>
    set((state) => {
      const newSlotData = { ...state.slotData }
      for (const dk of Object.keys(newSlotData)) {
        const daySlots = newSlotData[dk]
        let changed = false
        const newDay = { ...daySlots }
        for (const [key, entry] of Object.entries(newDay)) {
          if (entry.categoryId === sourceCatId) {
            newDay[key] = { ...entry, categoryId: targetCatId }
            changed = true
          }
        }
        if (changed) newSlotData[dk] = newDay
      }
      return { slotData: newSlotData }
    }),

  setFocusedSlot: (slot) => set({ focusedSlot: slot }),
  clearFocusedSlot: () => set({ focusedSlot: null }),
  setTagPicker: (picker) => set({ tagPicker: picker }),
  clearTagPicker: () => set({ tagPicker: null }),
}))

export const selectDayKey = () => dateKey(useCalendarStore.getState().currentDate)
