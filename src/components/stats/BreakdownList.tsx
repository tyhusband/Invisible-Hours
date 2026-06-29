import { motion } from 'motion/react'
import { useCategoryStore } from '../../store/categoryStore'
import { SLOT_MINUTES } from '../../lib/slots'
import { EyeIcon, EyeOffIcon } from '../ui/Icons'
import type { StatsGroup } from './StatsGroupTabs'

export interface BreakdownSubItem {
  id: string
  label: string
  color: string
  minutes: number
}

export interface BreakdownItem {
  id: string
  label: string
  color: string
  minutes: number
  subRows?: BreakdownSubItem[]
}

interface BreakdownListProps {
  group: StatsGroup
  items: BreakdownItem[]
  hiddenIds: Set<string>
  onToggleVisibility: (id: string) => void
  emptyMessage?: string
}

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function BreakdownList({
  group,
  items,
  hiddenIds,
  onToggleVisibility,
  emptyMessage = 'No tracked time',
}: BreakdownListProps) {
  const allTimeTotals = useCategoryStore((s) => s.allTimeTotals)
  const showAllTime = group === 'categories'

  if (items.length === 0) {
    return <div className="text-xs text-muted text-center py-4">{emptyMessage}</div>
  }

  return (
    <div className="flex flex-col gap-1">
      {items.map((item, i) => {
        const isHidden = hiddenIds.has(item.id)
        const allTimeSlots = showAllTime ? (allTimeTotals[item.id] ?? 0) : 0
        const allTimeMinutes = allTimeSlots * SLOT_MINUTES
        return (
          <div
            key={item.id}
            className={isHidden ? 'opacity-40' : ''}
          >
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="group flex items-center gap-2 px-2.5 py-1 rounded-md cursor-pointer transition-colors hover:bg-bg"
              onClick={() => onToggleVisibility(item.id)}
            >
              <div className="relative w-2.5 h-2.5 flex-shrink-0">
                <div
                  className={`w-2.5 h-2.5 rounded-full transition-opacity ${isHidden ? 'opacity-0' : 'group-hover:opacity-0'}`}
                  style={{ backgroundColor: item.color }}
                />
                <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                  isHidden ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}>
                  {isHidden
                    ? <EyeOffIcon size={14} className="text-muted -ml-0.5" />
                    : <EyeIcon size={14} className="text-muted -ml-0.5" />
                  }
                </div>
              </div>
              <span className="text-sm truncate flex-1">{item.label}</span>
              <span className="text-sm text-muted tabular-nums">
                {showAllTime ? (
                  <>
                    <span className="group-hover:hidden">{formatDuration(item.minutes)}</span>
                    <span className="hidden group-hover:inline">All Time: {formatDuration(allTimeMinutes)}</span>
                  </>
                ) : (
                  formatDuration(item.minutes)
                )}
              </span>
            </motion.div>
            {item.subRows?.map((sub) => (
              <div
                key={sub.id}
                className="flex items-center gap-2 pl-6 pr-2.5 py-0.5 text-xs"
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: sub.color }}
                />
                <span className="truncate flex-1 text-muted">{sub.label}</span>
                <span className="text-muted tabular-nums">{formatDuration(sub.minutes)}</span>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
