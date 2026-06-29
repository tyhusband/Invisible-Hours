import { useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useCalendarStore, type SlotEntry } from '../store/calendarStore'
import { useCategoryStore } from '../store/categoryStore'
import { useTagStore } from '../store/tagStore'
import { useUIStore } from '../store/uiStore'
import { dateKey, getWeekDates, getMonthDates } from '../lib/slots'
import type { Category } from '../lib/categories'
import type { Tag } from '../lib/tags'
import type { User } from '@supabase/supabase-js'

const MIGRATION_LS_KEY = 'idt-migrated-15min'

/**
 * Expand a 30-min slot key to its companion 15-min key:
 *   "09:00" -> "09:15"
 *   "09:30" -> "09:45"
 * Returns null for keys that are already 15-min subdivisions.
 */
function companion15Key(slotKey: string): string | null {
  const [hh, mm] = slotKey.split(':')
  if (mm === '00') return `${hh}:15`
  if (mm === '30') return `${hh}:45`
  return null
}

export function useSupabaseSync(user: User | null) {
  const loadedDates = useRef<Set<string>>(new Set())
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const migrationRan = useRef(false)

  const loadCategories = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('user_categories')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })

    if (data) {
      const cats: Category[] = data.map((r) => ({
        catId: r.cat_id,
        label: r.label,
        color: r.color,
        isDefault: r.is_default ?? false,
        isDeleted: r.is_deleted ?? false,
        sortOrder: r.sort_order ?? 0,
      }))
      useCategoryStore.getState().setUserCategories(cats)
    }
  }, [user])

  const loadTags = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('user_tags')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })

    if (data) {
      const tags: Tag[] = data.map((r) => ({
        tagId: r.tag_id,
        label: r.label,
        color: r.color,
        isDeleted: r.is_deleted ?? false,
        sortOrder: r.sort_order ?? 0,
      }))
      useTagStore.getState().setTags(tags)
    }
  }, [user])

  const loadEntriesForDates = useCallback(async (dates: string[]) => {
    if (!user) return
    const newDates = dates.filter((d) => !loadedDates.current.has(d))
    if (newDates.length === 0) return

    const { data } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', user.id)
      .in('date', newDates)

    if (data) {
      const byDate: Record<string, Record<string, SlotEntry>> = {}
      for (const d of newDates) {
        byDate[d] = {}
      }
      for (const row of data) {
        if (!byDate[row.date]) byDate[row.date] = {}
        byDate[row.date][row.slot_key] = {
          categoryId: row.category_id,
          note: row.note || '',
          tagIds: [],
        }
      }

      const { data: tagRows } = await supabase
        .from('time_entry_tags')
        .select('date, slot_key, tag_id')
        .eq('user_id', user.id)
        .in('date', newDates)

      if (tagRows) {
        for (const row of tagRows) {
          const entry = byDate[row.date]?.[row.slot_key]
          if (entry && !entry.tagIds.includes(row.tag_id)) {
            entry.tagIds.push(row.tag_id)
          }
        }
      }

      useCalendarStore.getState().mergeSlotData(byDate)
      newDates.forEach((d) => loadedDates.current.add(d))
    }
  }, [user])

  const loadCurrentView = useCallback(async () => {
    const { currentDate, viewMode } = useCalendarStore.getState()
    if (viewMode === 'day') {
      await loadEntriesForDates([dateKey(currentDate)])
    } else if (viewMode === 'week') {
      const weekDates = getWeekDates(currentDate)
      await loadEntriesForDates(weekDates.map(dateKey))
    } else {
      const monthDates = getMonthDates(currentDate)
      await loadEntriesForDates(monthDates.map(dateKey))
    }
  }, [loadEntriesForDates])

  const loadUserSettings = useCallback(async () => {
    if (!user) return
    try {
      const { data } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      if (data?.work_day_start != null && data?.work_day_end != null) {
        const s = Math.max(0, Math.min(95, Number(data.work_day_start)))
        const e = Math.max(0, Math.min(95, Number(data.work_day_end)))
        useUIStore.getState().setWorkDayRange(s, e)
      }
      if (data?.slot_granularity != null) {
        const g = Number(data.slot_granularity)
        if (g === 15 || g === 30 || g === 60) {
          useUIStore.getState().setSlotGranularity(g)
        }
      }
      if (data?.data_migrated_15min) {
        migrationRan.current = true
      }
    } catch {
      // user_settings table may not exist; keep localStorage defaults
    }
  }, [user])

  const migrateDataTo15Min = useCallback(async () => {
    if (!user) return
    if (migrationRan.current) return
    if (localStorage.getItem(MIGRATION_LS_KEY) === '1') {
      migrationRan.current = true
      return
    }

    try {
      const { data: entries } = await supabase
        .from('time_entries')
        .select('date, slot_key, category_id, note')
        .eq('user_id', user.id)

      if (!entries || entries.length === 0) {
        localStorage.setItem(MIGRATION_LS_KEY, '1')
        migrationRan.current = true
        return
      }

      const existingKeys = new Set(entries.map((e) => `${e.date}|${e.slot_key}`))
      const newRows: Array<{
        user_id: string; date: string; slot_key: string; category_id: string; note: string
      }> = []

      for (const entry of entries) {
        const comp = companion15Key(entry.slot_key)
        if (!comp) continue
        const compositeKey = `${entry.date}|${comp}`
        if (existingKeys.has(compositeKey)) continue
        newRows.push({
          user_id: user.id,
          date: entry.date,
          slot_key: comp,
          category_id: entry.category_id,
          note: entry.note || '',
        })
        existingKeys.add(compositeKey)
      }

      if (newRows.length > 0) {
        const batchSize = 500
        for (let i = 0; i < newRows.length; i += batchSize) {
          await supabase
            .from('time_entries')
            .upsert(newRows.slice(i, i + batchSize), { onConflict: 'user_id,date,slot_key' })
        }
      }

      localStorage.setItem(MIGRATION_LS_KEY, '1')
      migrationRan.current = true

      try {
        await supabase.from('user_settings').upsert(
          { user_id: user.id, data_migrated_15min: true },
          { onConflict: 'user_id' }
        )
      } catch { /* optional column may not exist */ }

      loadedDates.current.clear()
    } catch {
      // Migration failed; will retry next load
    }
  }, [user])

  const loadAllTimeTotals = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('time_entries')
      .select('category_id')
      .eq('user_id', user.id)

    if (data) {
      const totals: Record<string, number> = {}
      for (const row of data) {
        totals[row.category_id] = (totals[row.category_id] ?? 0) + 1
      }
      useCategoryStore.getState().setAllTimeTotals(totals)
    }
  }, [user])

  // Initial load
  useEffect(() => {
    if (!user) return
    const init = async () => {
      await loadUserSettings()
      await migrateDataTo15Min()
      loadCategories()
      loadTags()
      loadCurrentView()
      loadAllTimeTotals()
    }
    init()
  }, [user, loadCategories, loadTags, loadCurrentView, loadUserSettings, loadAllTimeTotals, migrateDataTo15Min])

  // Reload when date/view changes
  useEffect(() => {
    let prev = {
      date: dateKey(useCalendarStore.getState().currentDate),
      mode: useCalendarStore.getState().viewMode,
    }
    const unsub = useCalendarStore.subscribe((state) => {
      const next = { date: dateKey(state.currentDate), mode: state.viewMode }
      if (next.date !== prev.date || next.mode !== prev.mode) {
        prev = next
        loadCurrentView()
      }
    })
    return unsub
  }, [loadCurrentView])

  const setSaveStatus = useUIStore.getState().setSaveStatus

  const saveEntries = useCallback(async (dk: string, changes: Record<string, SlotEntry | null>) => {
    if (!user) return
    setSaveStatus('saving')

    const upserts: Array<{
      user_id: string; date: string; slot_key: string; category_id: string; note: string
    }> = []
    const deletes: string[] = []

    for (const [slotKey, entry] of Object.entries(changes)) {
      if (entry === null) {
        deletes.push(slotKey)
      } else {
        upserts.push({
          user_id: user.id,
          date: dk,
          slot_key: slotKey,
          category_id: entry.categoryId,
          note: entry.note,
        })
      }
    }

    if (upserts.length > 0) {
      await supabase.from('time_entries').upsert(upserts, { onConflict: 'user_id,date,slot_key' })
    }
    if (deletes.length > 0) {
      await supabase
        .from('time_entries')
        .delete()
        .eq('user_id', user.id)
        .eq('date', dk)
        .in('slot_key', deletes)
    }

    setSaveStatus('saved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => setSaveStatus('idle'), 2000)
    loadAllTimeTotals()
  }, [user, setSaveStatus, loadAllTimeTotals])

  const saveNote = useCallback(async (dk: string, slotKey: string, note: string) => {
    if (!user) return
    setSaveStatus('saving')

    await supabase
      .from('time_entries')
      .update({ note, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('date', dk)
      .eq('slot_key', slotKey)

    setSaveStatus('saved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => setSaveStatus('idle'), 2000)
  }, [user, setSaveStatus])

  const saveCategories = useCallback(async () => {
    if (!user) return
    setSaveStatus('saving')

    const { userCategories } = useCategoryStore.getState()
    const upserts = userCategories.map((c) => ({
      user_id: user.id,
      cat_id: c.catId,
      label: c.label,
      color: c.color,
      is_default: c.isDefault,
      is_deleted: c.isDeleted,
      sort_order: c.sortOrder,
    }))

    if (upserts.length > 0) {
      await supabase.from('user_categories').upsert(upserts, { onConflict: 'user_id,cat_id' })
    }

    setSaveStatus('saved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => setSaveStatus('idle'), 2000)
  }, [user, setSaveStatus])

  const saveTags = useCallback(async () => {
    if (!user) return
    setSaveStatus('saving')

    const { userTags } = useTagStore.getState()
    const upserts = userTags.map((t) => ({
      user_id: user.id,
      tag_id: t.tagId,
      label: t.label,
      color: t.color,
      is_deleted: t.isDeleted,
      sort_order: t.sortOrder,
    }))

    if (upserts.length > 0) {
      await supabase.from('user_tags').upsert(upserts, { onConflict: 'user_id,tag_id' })
    }

    setSaveStatus('saved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => setSaveStatus('idle'), 2000)
  }, [user, setSaveStatus])

  const saveSlotTags = useCallback(async (dk: string, baseKeys: string[], tagIds: string[]) => {
    if (!user) return
    setSaveStatus('saving')

    for (const slotKey of baseKeys) {
      await supabase
        .from('time_entry_tags')
        .delete()
        .eq('user_id', user.id)
        .eq('date', dk)
        .eq('slot_key', slotKey)

      if (tagIds.length > 0) {
        const rows = tagIds.map((tag_id) => ({
          user_id: user.id,
          date: dk,
          slot_key: slotKey,
          tag_id,
        }))
        await supabase.from('time_entry_tags').insert(rows)
      }
    }

    setSaveStatus('saved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => setSaveStatus('idle'), 2000)
  }, [user, setSaveStatus])

  const deleteTagAndAssignments = useCallback(async (tagId: string) => {
    if (!user) return
    setSaveStatus('saving')

    useTagStore.getState().deleteTag(tagId)
    useCalendarStore.getState().removeTagFromAllSlots(tagId)

    await supabase
      .from('time_entry_tags')
      .delete()
      .eq('user_id', user.id)
      .eq('tag_id', tagId)

    const { userTags } = useTagStore.getState()
    const upserts = userTags.map((t) => ({
      user_id: user.id,
      tag_id: t.tagId,
      label: t.label,
      color: t.color,
      is_deleted: t.isDeleted,
      sort_order: t.sortOrder,
    }))

    if (upserts.length > 0) {
      await supabase.from('user_tags').upsert(upserts, { onConflict: 'user_id,tag_id' })
    }

    setSaveStatus('saved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => setSaveStatus('idle'), 2000)
  }, [user, setSaveStatus])

  const mergeCategories = useCallback(async (sourceCatId: string, targetCatId: string) => {
    if (!user) return
    setSaveStatus('saving')

    await supabase
      .from('time_entries')
      .update({ category_id: targetCatId })
      .eq('user_id', user.id)
      .eq('category_id', sourceCatId)

    useCalendarStore.getState().replaceCategoryInSlots(sourceCatId, targetCatId)
    useCategoryStore.getState().deleteCategory(sourceCatId)

    const { userCategories } = useCategoryStore.getState()
    const upserts = userCategories.map((c) => ({
      user_id: user.id,
      cat_id: c.catId,
      label: c.label,
      color: c.color,
      is_default: c.isDefault,
      is_deleted: c.isDeleted,
      sort_order: c.sortOrder,
    }))
    if (upserts.length > 0) {
      await supabase.from('user_categories').upsert(upserts, { onConflict: 'user_id,cat_id' })
    }

    loadedDates.current.clear()
    await loadCurrentView()
    loadAllTimeTotals()

    setSaveStatus('saved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => setSaveStatus('idle'), 2000)
  }, [user, setSaveStatus, loadCurrentView, loadAllTimeTotals])

  const deleteAllEntriesForCategory = useCallback(async (catId: string) => {
    if (!user) return
    await supabase.from('time_entries').delete().eq('user_id', user.id).eq('category_id', catId)
    loadedDates.current.clear()
    await loadCurrentView()
    loadAllTimeTotals()
  }, [user, loadCurrentView, loadAllTimeTotals])

  const bulkImportEntries = useCallback(async (
    entries: Array<{ date: string; slot_key: string; category_id: string; note: string }>
  ) => {
    if (!user) return
    setSaveStatus('saving')

    const rows = entries.map((e) => ({ ...e, user_id: user.id }))
    await supabase.from('time_entries').upsert(rows, { onConflict: 'user_id,date,slot_key' })

    loadedDates.current.clear()
    await loadCurrentView()
    loadAllTimeTotals()
    setSaveStatus('saved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => setSaveStatus('idle'), 2000)
  }, [user, setSaveStatus, loadCurrentView, loadAllTimeTotals])

  const saveWorkDayRange = useCallback(async () => {
    if (!user) return
    try {
      const { workDayStartIndex, workDayEndIndex } = useUIStore.getState()
      await supabase.from('user_settings').upsert(
        { user_id: user.id, work_day_start: workDayStartIndex, work_day_end: workDayEndIndex },
        { onConflict: 'user_id' }
      )
    } catch {
      // user_settings table may not exist; localStorage already updated by setWorkDayRange
    }
  }, [user])

  const saveSlotGranularity = useCallback(async () => {
    if (!user) return
    try {
      const { slotGranularity } = useUIStore.getState()
      await supabase.from('user_settings').upsert(
        { user_id: user.id, slot_granularity: slotGranularity },
        { onConflict: 'user_id' }
      )
    } catch {
      // user_settings table may not exist
    }
  }, [user])

  return {
    saveEntries,
    saveNote,
    saveCategories,
    saveTags,
    saveSlotTags,
    deleteTagAndAssignments,
    mergeCategories,
    deleteAllEntriesForCategory,
    bulkImportEntries,
    loadCurrentView,
    saveWorkDayRange,
    saveSlotGranularity,
  }
}
