import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTagStore } from '../../store/tagStore'
import { TagChip } from './TagChip'
import { TagEditor } from './TagEditor'
import { PencilIcon, PlusIcon, XIcon } from '../ui/Icons'

interface TagListModalProps {
  onClose: () => void
  onSave: () => void
  onDelete: (tagId: string) => Promise<void>
}

export function TagListModal({ onClose, onSave, onDelete }: TagListModalProps) {
  const tags = useTagStore((s) => s.tags)
  const recentTagIds = useTagStore((s) => s.recentTagIds)
  const getAllTagsByRecency = useTagStore((s) => s.getAllTagsByRecency)
  const tagsLoaded = useTagStore((s) => s.tagsLoaded)

  const [query, setQuery] = useState('')
  const [editingTagId, setEditingTagId] = useState<string | undefined>()
  const [showNewEditor, setShowNewEditor] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const allTags = useMemo(
    () => getAllTagsByRecency(),
    [getAllTagsByRecency, tags, recentTagIds],
  )

  const filteredTags = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allTags
    return allTags.filter((t) => t.label.toLowerCase().includes(q))
  }, [allTags, query])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !editingTagId && !showNewEditor) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, editingTagId, showNewEditor])

  const handleDelete = async (tagId: string) => {
    if (confirmDeleteId !== tagId) {
      setConfirmDeleteId(tagId)
      return
    }
    await onDelete(tagId)
    onSave()
    setConfirmDeleteId(null)
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="bg-surface border border-border rounded-xl shadow-xl w-[340px] max-w-full max-h-[min(480px,80vh)] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-base font-semibold">All Tags</h4>
              <button
                type="button"
                onClick={onClose}
                className="flex-shrink-0 flex items-center justify-center p-2 -ml-1 rounded-lg text-muted hover:text-text hover:bg-bg transition-colors"
                aria-label="Close"
              >
                <XIcon size={16} />
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-bg text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              <button
                type="button"
                onClick={() => setShowNewEditor(true)}
                className="flex-shrink-0 p-2 rounded-lg bg-bg text-muted hover:text-text transition-colors"
                aria-label="New tag"
              >
                <PlusIcon size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
            {!tagsLoaded ? (
              <p className="px-2 py-4 text-xs text-muted animate-pulse">Loading tags…</p>
            ) : filteredTags.length === 0 ? (
              <p className="px-2 py-4 text-xs text-muted">
                {query.trim() ? 'No matching tags' : 'No tags yet'}
              </p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {filteredTags.map((tag) => (
                  <li
                    key={tag.tagId}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-bg transition-colors group"
                    onMouseLeave={() => {
                      if (confirmDeleteId === tag.tagId) setConfirmDeleteId(null)
                    }}
                  >
                    <TagChip label={tag.label} color={tag.color} size="md" className="flex-shrink-0" />
                    <div className="flex-1 min-w-0" />
                    <button
                      type="button"
                      onClick={() => setEditingTagId(tag.tagId)}
                      className="h-6 w-6 flex items-center justify-center rounded-md text-muted hover:text-text opacity-70 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity"
                      aria-label={`Edit ${tag.label}`}
                    >
                      <PencilIcon size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(tag.tagId)}
                      className={`h-6 flex items-center justify-center rounded-md flex-shrink-0 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 ${
                        confirmDeleteId === tag.tagId
                          ? 'px-2 text-xs leading-none bg-error text-white opacity-100'
                          : 'w-6 text-muted hover:text-error'
                      }`}
                      aria-label={
                        confirmDeleteId === tag.tagId
                          ? `Confirm delete ${tag.label}`
                          : `Delete ${tag.label}`
                      }
                    >
                      {confirmDeleteId === tag.tagId ? 'Confirm' : <XIcon size={14} />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {showNewEditor && (
          <TagEditor
            onClose={() => setShowNewEditor(false)}
            onSave={() => {
              onSave()
              setShowNewEditor(false)
            }}
          />
        )}
        {editingTagId && (
          <TagEditor
            tagId={editingTagId}
            onClose={() => setEditingTagId(undefined)}
            onSave={onSave}
            onDelete={onDelete}
          />
        )}
      </AnimatePresence>
    </>
  )
}
