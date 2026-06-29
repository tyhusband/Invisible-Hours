import { useMemo, useState, useCallback } from 'react'
import { useCalendarStore } from '../../store/calendarStore'
import { useCategoryStore } from '../../store/categoryStore'
import { useTagStore } from '../../store/tagStore'
import { useUIStore } from '../../store/uiStore'
import { dateKey, getWeekDates, getWorkDayKeys, SLOT_MINUTES } from '../../lib/slots'
import { StatsTabs, type StatsMode } from '../stats/StatsTabs'
import { StatsGroupTabs, type StatsGroup } from '../stats/StatsGroupTabs'
import { DonutChart } from '../stats/DonutChart'
import { BreakdownList } from '../stats/BreakdownList'
import { WorkDayRangePicker } from '../stats/WorkDayRangePicker'

interface StatsColumnProps {
  sync?: { saveWorkDayRange?: () => Promise<void> }
}

export function StatsColumn({ sync }: StatsColumnProps) {
  const [mode, setMode] = useState<StatsMode>('total')
  const [group, setGroup] = useState<StatsGroup>('categories')
  const [hiddenCatIds, setHiddenCatIds] = useState<Set<string>>(new Set())
  const [hiddenTagIds, setHiddenTagIds] = useState<Set<string>>(new Set())
  const currentDate = useCalendarStore((s) => s.currentDate)
  const viewMode = useCalendarStore((s) => s.viewMode)
  const slotData = useCalendarStore((s) => s.slotData)
  const categories = useCategoryStore((s) => s.categories)
  const getCategoryColor = useCategoryStore((s) => s.getCategoryColor)
  const getCategoryLabel = useCategoryStore((s) => s.getCategoryLabel)
  const getTagLabel = useTagStore((s) => s.getTagLabel)
  const getTagColor = useTagStore((s) => s.getTagColor)
  const showWeekends = useUIStore((s) => s.showWeekends)
  const workDayStartIndex = useUIStore((s) => s.workDayStartIndex)
  const workDayEndIndex = useUIStore((s) => s.workDayEndIndex)

  const workDayKeys = useMemo(
    () => getWorkDayKeys(workDayStartIndex, workDayEndIndex),
    [workDayStartIndex, workDayEndIndex]
  )

  const toggleCategoryVisibility = useCallback((catId: string) => {
    setHiddenCatIds((prev) => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId)
      else next.add(catId)
      return next
    })
  }, [])

  const toggleTagVisibility = useCallback((tagId: string) => {
    setHiddenTagIds((prev) => {
      const next = new Set(prev)
      if (next.has(tagId)) next.delete(tagId)
      else next.add(tagId)
      return next
    })
  }, [])

  const stats = useMemo(() => {
    let weekDates: Date[]
    if (viewMode === 'day') {
      weekDates = [currentDate]
    } else if (viewMode === 'month') {
      const year = currentDate.getFullYear(), month = currentDate.getMonth()
      const daysInMonth = new Date(year, month + 1, 0).getDate()
      weekDates = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1))
    } else {
      weekDates = getWeekDates(currentDate)
      if (!showWeekends) {
        weekDates = weekDates.filter((d) => d.getDay() !== 0 && d.getDay() !== 6)
      }
    }
    const dates = weekDates.map(dateKey)

    const categoryCounts = new Map<string, number>()
    const tagCountsByCategory = new Map<string, Map<string, number>>()
    const tagCounts = new Map<string, number>()
    const categoryCountsByTag = new Map<string, Map<string, number>>()

    for (const dk of dates) {
      const daySlots = slotData[dk]
      if (!daySlots) continue
      for (const [slotKey, entry] of Object.entries(daySlots)) {
        if (mode === '9-5' && !workDayKeys.has(slotKey)) continue
        if (mode === 'overtime' && workDayKeys.has(slotKey)) continue

        categoryCounts.set(entry.categoryId, (categoryCounts.get(entry.categoryId) ?? 0) + 1)

        const tagIds = entry.tagIds ?? []
        if (tagIds.length > 0) {
          let catTags = tagCountsByCategory.get(entry.categoryId)
          if (!catTags) {
            catTags = new Map()
            tagCountsByCategory.set(entry.categoryId, catTags)
          }
          for (const tagId of tagIds) {
            catTags.set(tagId, (catTags.get(tagId) ?? 0) + 1)

            tagCounts.set(tagId, (tagCounts.get(tagId) ?? 0) + 1)
            let tagCats = categoryCountsByTag.get(tagId)
            if (!tagCats) {
              tagCats = new Map()
              categoryCountsByTag.set(tagId, tagCats)
            }
            tagCats.set(entry.categoryId, (tagCats.get(entry.categoryId) ?? 0) + 1)
          }
        }
      }
    }

    if (group === 'labels') {
      const allSegments = Array.from(tagCounts.entries())
        .map(([tagId, count]) => ({
          id: tagId,
          color: getTagColor(tagId),
          value: count,
        }))
        .sort((a, b) => b.value - a.value)

      const breakdown = allSegments.map((seg) => {
        const catMap = categoryCountsByTag.get(seg.id)
        const subRows = catMap
          ? Array.from(catMap.entries())
              .map(([catId, count]) => ({
                id: catId,
                label: getCategoryLabel(catId),
                color: getCategoryColor(catId),
                minutes: count * SLOT_MINUTES,
              }))
              .sort((a, b) => b.minutes - a.minutes)
          : []

        return {
          id: seg.id,
          label: getTagLabel(seg.id),
          color: seg.color,
          minutes: seg.value * SLOT_MINUTES,
          ...(subRows.length > 0 ? { subRows } : {}),
        }
      })

      const visibleSegments = allSegments.filter((s) => !hiddenTagIds.has(s.id))
      const visibleSlots = visibleSegments.reduce((a, s) => a + s.value, 0)
      const visibleMinutes = visibleSlots * SLOT_MINUTES

      const segments = visibleSegments.map((s) => ({
        ...s,
        fraction: visibleSlots > 0 ? s.value / visibleSlots : 0,
      }))

      return { segments, totalMinutes: visibleMinutes, breakdown }
    }

    const allSegments = Array.from(categoryCounts.entries())
      .map(([catId, count]) => ({
        id: catId,
        color: getCategoryColor(catId),
        value: count,
      }))
      .sort((a, b) => b.value - a.value)

    const breakdown = allSegments.map((seg) => {
      const tagMap = tagCountsByCategory.get(seg.id)
      const subRows = tagMap
        ? Array.from(tagMap.entries())
            .map(([tagId, count]) => ({
              id: tagId,
              label: getTagLabel(tagId),
              color: getTagColor(tagId),
              minutes: count * SLOT_MINUTES,
            }))
            .sort((a, b) => b.minutes - a.minutes)
        : []

      return {
        id: seg.id,
        label: getCategoryLabel(seg.id),
        color: seg.color,
        minutes: seg.value * SLOT_MINUTES,
        ...(subRows.length > 0 ? { subRows } : {}),
      }
    })

    const visibleSegments = allSegments.filter((s) => !hiddenCatIds.has(s.id))
    const visibleSlots = visibleSegments.reduce((a, s) => a + s.value, 0)
    const visibleMinutes = visibleSlots * SLOT_MINUTES

    const segments = visibleSegments.map((s) => ({
      ...s,
      fraction: visibleSlots > 0 ? s.value / visibleSlots : 0,
    }))

    return { segments, totalMinutes: visibleMinutes, breakdown }
  }, [
    currentDate,
    viewMode,
    slotData,
    mode,
    group,
    workDayKeys,
    hiddenCatIds,
    hiddenTagIds,
    showWeekends,
    categories,
    getCategoryColor,
    getCategoryLabel,
    getTagLabel,
    getTagColor,
  ])

  return (
    <div className="h-full flex flex-col bg-surface p-3 gap-4">
      <StatsTabs active={mode} onChange={setMode} />
      <StatsGroupTabs active={group} onChange={setGroup} />

      {(mode === '9-5' || mode === 'overtime') && (
        <WorkDayRangePicker onSave={sync?.saveWorkDayRange} inverted={mode === 'overtime'} />
      )}

      <div className="flex justify-center mt-2">
        <DonutChart segments={stats.segments} totalMinutes={stats.totalMinutes} />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <BreakdownList
          group={group}
          items={stats.breakdown}
          hiddenIds={group === 'labels' ? hiddenTagIds : hiddenCatIds}
          onToggleVisibility={group === 'labels' ? toggleTagVisibility : toggleCategoryVisibility}
          emptyMessage={group === 'labels' ? 'No labeled time' : 'No tracked time'}
        />
      </div>
    </div>
  )
}
