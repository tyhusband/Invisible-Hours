import { contrastColor } from '../../lib/categories'

const REMOVE_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Cline x1='4' y1='4' x2='16' y2='16' stroke='white' stroke-width='4' stroke-linecap='round'/%3E%3Cline x1='16' y1='4' x2='4' y2='16' stroke='white' stroke-width='4' stroke-linecap='round'/%3E%3Cline x1='4' y1='4' x2='16' y2='16' stroke='black' stroke-width='2' stroke-linecap='round'/%3E%3Cline x1='16' y1='4' x2='4' y2='16' stroke='black' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E") 10 10, pointer`

interface TagChipProps {
  label: string
  color: string
  size?: 'sm' | 'md' | 'slot'
  textClass?: string
  onClick?: () => void
  selected?: boolean
  removable?: boolean
  onRemove?: () => void
  className?: string
}

export function TagChip({
  label,
  color,
  size = 'sm',
  textClass,
  onClick,
  selected,
  removable,
  onRemove,
  className = '',
}: TagChipProps) {
  const textColor = contrastColor(color.length === 7 ? color : '#888888')
  const paddingClass =
    size === 'md' ? 'px-2 py-0.5' : size === 'slot' ? 'px-1.5 py-0.5' : 'px-1 py-0.5'
  const textSizeClass = textClass ?? (size === 'sm' ? 'text-[9px]' : 'text-xs')
  const sizeClass = `${textSizeClass} ${paddingClass}`
  const maxWidthClass =
    size === 'md' ? '' : size === 'slot' ? 'max-w-[8.5rem]' : 'max-w-[7rem]'

  if (removable && onRemove) {
    return (
      <button
        type="button"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className={`group/tag inline-flex items-center rounded font-medium leading-none truncate ${maxWidthClass} ${sizeClass} transition-opacity hover:opacity-50 ${className}`}
        style={{
          backgroundColor: color,
          color: textColor,
          cursor: REMOVE_CURSOR,
        }}
        title={`Remove ${label}`}
      >
        {label}
      </button>
    )
  }

  const Component = onClick ? 'button' : 'span'

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`inline-flex items-center rounded font-medium leading-none truncate ${maxWidthClass} ${sizeClass} ${
        onClick ? 'cursor-pointer transition-opacity hover:opacity-80' : ''
      } ${selected ? 'ring-1 ring-white/60 ring-offset-1 ring-offset-transparent' : ''} ${className}`}
      style={{ backgroundColor: color, color: textColor }}
      title={label}
    >
      {label}
    </Component>
  )
}
