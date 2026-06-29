export type StatsGroup = 'categories' | 'labels'

interface StatsGroupTabsProps {
  active: StatsGroup
  onChange: (group: StatsGroup) => void
}

const TABS: { label: string; value: StatsGroup }[] = [
  { label: 'Categories', value: 'categories' },
  { label: 'Tags', value: 'labels' },
]

export function StatsGroupTabs({ active, onChange }: StatsGroupTabsProps) {
  return (
    <div className="flex bg-bg rounded-md p-0.5">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
            active === tab.value
              ? 'bg-surface text-text ring-1 ring-border'
              : 'text-muted hover:text-text'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
