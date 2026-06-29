import { create } from 'zustand'
import type { Tag } from '../lib/tags'
import { RECENT_TAG_LIMIT } from '../lib/tags'

const RECENT_TAGS_LS_KEY = 'idt-recent-tag-ids'
const MAX_STORED_RECENT = 20

function loadRecentIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_TAGS_LS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

function persistRecentIds(ids: string[]) {
  try {
    localStorage.setItem(RECENT_TAGS_LS_KEY, JSON.stringify(ids))
  } catch {
    // ignore quota errors
  }
}

interface TagState {
  tags: Tag[]
  userTags: Tag[]
  tagsLoaded: boolean
  recentTagIds: string[]

  setTags: (tags: Tag[]) => void
  addTag: (tag: Tag) => void
  updateTag: (tagId: string, updates: Partial<Tag>) => void
  deleteTag: (tagId: string) => void
  reorder: (fromIndex: number, toIndex: number) => void
  touchRecentTag: (tagId: string) => void
  getRecentTags: (limit?: number) => Tag[]
  getAllTagsByRecency: () => Tag[]

  getTagLabel: (tagId: string) => string
  getTagColor: (tagId: string) => string
}

function activeTags(userTags: Tag[]): Tag[] {
  return userTags.filter((t) => !t.isDeleted).sort((a, b) => a.sortOrder - b.sortOrder)
}

export const useTagStore = create<TagState>((set, get) => ({
  tags: [],
  userTags: [],
  tagsLoaded: false,
  recentTagIds: loadRecentIds(),

  setTags: (tags) =>
    set({
      userTags: tags,
      tags: activeTags(tags),
      tagsLoaded: true,
    }),

  addTag: (tag) =>
    set((state) => {
      const userTags = [...state.userTags, tag]
      return { userTags, tags: activeTags(userTags) }
    }),

  updateTag: (tagId, updates) =>
    set((state) => {
      const userTags = state.userTags.map((t) =>
        t.tagId === tagId ? { ...t, ...updates } : t
      )
      return { userTags, tags: activeTags(userTags) }
    }),

  deleteTag: (tagId) =>
    set((state) => {
      const existing = state.userTags.find((t) => t.tagId === tagId)
      let userTags: Tag[]
      if (existing) {
        userTags = state.userTags.map((t) =>
          t.tagId === tagId ? { ...t, isDeleted: true } : t
        )
      } else {
        userTags = state.userTags
      }
      const recentTagIds = state.recentTagIds.filter((id) => id !== tagId)
      persistRecentIds(recentTagIds)
      return { userTags, tags: activeTags(userTags), recentTagIds }
    }),

  reorder: (fromIndex, toIndex) =>
    set((state) => {
      const active = activeTags(state.userTags)
      const reordered = [...active]
      const [moved] = reordered.splice(fromIndex, 1)
      reordered.splice(toIndex, 0, moved)
      const orderMap = new Map(reordered.map((t, i) => [t.tagId, i]))
      const userTags = state.userTags.map((t) => ({
        ...t,
        sortOrder: orderMap.has(t.tagId) ? orderMap.get(t.tagId)! : t.sortOrder,
      }))
      return { userTags, tags: activeTags(userTags) }
    }),

  touchRecentTag: (tagId) =>
    set((state) => {
      const recentTagIds = [tagId, ...state.recentTagIds.filter((id) => id !== tagId)].slice(
        0,
        MAX_STORED_RECENT,
      )
      persistRecentIds(recentTagIds)
      return { recentTagIds }
    }),

  getRecentTags: (limit = RECENT_TAG_LIMIT) => {
    const { tags, recentTagIds } = get()
    const byId = new Map(tags.map((t) => [t.tagId, t]))
    const ordered: Tag[] = []

    for (const id of recentTagIds) {
      const tag = byId.get(id)
      if (tag) ordered.push(tag)
    }
    for (const tag of tags) {
      if (!ordered.some((t) => t.tagId === tag.tagId)) ordered.push(tag)
    }

    return ordered.slice(0, limit)
  },

  getAllTagsByRecency: () => {
    const { tags, recentTagIds } = get()
    const byId = new Map(tags.map((t) => [t.tagId, t]))
    const ordered: Tag[] = []

    for (const id of recentTagIds) {
      const tag = byId.get(id)
      if (tag) ordered.push(tag)
    }
    for (const tag of tags) {
      if (!ordered.some((t) => t.tagId === tag.tagId)) ordered.push(tag)
    }

    return ordered
  },

  getTagLabel: (tagId) => {
    const tag = get().userTags.find((t) => t.tagId === tagId)
    return tag?.label ?? tagId
  },

  getTagColor: (tagId) => {
    const tag = get().userTags.find((t) => t.tagId === tagId)
    return tag?.color ?? '#888888'
  },
}))
