import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence } from 'motion/react'
import { useTagStore } from '../../store/tagStore'
import { anchorToStyle, RECENT_TAG_LIMIT } from '../../lib/tags'
import type { TagPickerAnchor } from '../../lib/tags'
import { contrastColor } from '../../lib/categories'
import { TagEditor } from './TagEditor'
import { PlusIcon } from '../ui/Icons'

interface TagPickerDropdownProps {
  anchor: TagPickerAnchor
  assignedTagIds: string[]
  onSelect: (tagId: string) => void
  onSaveTags: () => Promise<void>
  onClose: () => void
}

export function TagPickerDropdown({
  anchor,
  assignedTagIds,
  onSelect,
  onSaveTags,
  onClose,
}: TagPickerDropdownProps) {
  const tags = useTagStore((s) => s.tags)
  const getRecentTags = useTagStore((s) => s.getRecentTags)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [showEditor, setShowEditor] = useState(false)

  const showSearch = tags.length > RECENT_TAG_LIMIT
  const assignedSet = useMemo(() => new Set(assignedTagIds), [assignedTagIds])

  const availableTags = useMemo(() => {
    const pool = query.trim()
      ? tags.filter((t) => t.label.toLowerCase().includes(query.trim().toLowerCase()))
      : getRecentTags(RECENT_TAG_LIMIT)
    return pool.filter((t) => !assignedSet.has(t.tagId))
  }, [tags, query, getRecentTags, assignedSet])

  useEffect(() => {
    if (showSearch) searchRef.current?.focus()
  }, [showSearch])

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (showEditor) return
      if (menuRef.current?.contains(e.target as Node)) return
      onClose()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (showEditor) return
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose, showEditor])

  const handleEditorSave = async (tagId?: string) => {
    await onSaveTags()
    setShowEditor(false)
    if (tagId && !assignedSet.has(tagId)) {
      onSelect(tagId)
      onClose()
    }
  }

  const menuHeight = showSearch ? 220 : Math.min(availableTags.length, RECENT_TAG_LIMIT) * 36 + 52

  return createPortal(
    <>
      <div
        ref={menuRef}
        className="bg-surface border border-border rounded-lg shadow-xl py-1.5 overflow-hidden"
        style={anchorToStyle(anchor, menuHeight)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-2 pb-1.5 border-b border-border flex items-center gap-1.5">
          {showSearch ? (
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="flex-1 min-w-0 px-2 py-1.5 rounded-md border border-border bg-bg text-xs focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          ) : (
            <span className="flex-1 text-xs text-muted pl-0.5">Recent tags</span>
          )}
          <button
            type="button"
            onClick={() => setShowEditor(true)}
            className="flex-shrink-0 p-1.5 rounded-md text-muted hover:text-text hover:bg-bg transition-colors"
            aria-label="New tag"
          >
            <PlusIcon size={14} />
          </button>
        </div>
        <div className="max-h-44 overflow-y-auto py-0.5">
          {availableTags.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted">
              {query.trim() ? 'No matching tags' : assignedSet.size > 0 ? 'All recent tags added' : 'No tags yet'}
            </p>
          ) : (
            availableTags.map((tag) => {
              const textColor = contrastColor(tag.color.length === 7 ? tag.color : '#888888')
              return (
                <button
                  key={tag.tagId}
                  type="button"
                  onClick={() => {
                    onSelect(tag.tagId)
                    onClose()
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-bg transition-colors"
                >
                  <span
                    className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium leading-none truncate max-w-full"
                    style={{ backgroundColor: tag.color, color: textColor }}
                  >
                    {tag.label}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </div>

      <AnimatePresence>
        {showEditor && (
          <TagEditor
            onClose={() => setShowEditor(false)}
            onSave={handleEditorSave}
          />
        )}
      </AnimatePresence>
    </>,
    document.body,
  )
}
