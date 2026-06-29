import { useState, useCallback, useRef, useEffect } from 'react'
import { useCategoryStore } from '../../store/categoryStore'
import { useGoogleCalendarStore } from '../../store/googleCalendarStore'
import { CategoryRow } from '../palette/CategoryRow'
import { MoreAccordion } from '../palette/MoreAccordion'
import { EraserButton } from '../palette/EraserButton'
import { TagsButton } from '../palette/TagsButton'
import { CategoryEditor } from '../palette/CategoryEditor'
import { PlusIcon, EyeIcon, EyeOffIcon } from '../ui/Icons'

const MAX_VISIBLE = 10

interface PaletteColumnProps {
  sync: {
    saveCategories: () => Promise<void>
    deleteAllEntriesForCategory: (catId: string) => Promise<void>
    saveTags: () => Promise<void>
    deleteTagAndAssignments: (tagId: string) => Promise<void>
  }
}

function CategorySkeleton() {
  return (
    <div className="flex flex-col gap-1.5 pt-0.5 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-9 rounded-lg bg-bg"
          style={{ opacity: 1 - i * 0.15 }}
        />
      ))}
    </div>
  )
}

export function PaletteColumn({ sync }: PaletteColumnProps) {
  const categories = useCategoryStore((s) => s.categories)
  const categoriesLoaded = useCategoryStore((s) => s.categoriesLoaded)
  const activeCategoryId = useCategoryStore((s) => s.activeCategoryId)
  const reorder = useCategoryStore((s) => s.reorder)

  const dragFrom = useRef<number | null>(null)
  const addBtnRef = useRef<HTMLButtonElement>(null)
  const [showNewEditor, setShowNewEditor] = useState(false)
  const [newEditorPos, setNewEditorPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  const hotkey = (i: number) => {
    if (i < 9) return String(i + 1)
    if (i === 9) return '0'
    return null
  }

  const visibleCats = categories.slice(0, MAX_VISIBLE)
  const overflowCats = categories.slice(MAX_VISIBLE)

  const onDragStart = useCallback((index: number) => {
    dragFrom.current = index
  }, [])

  const onDragEnter = useCallback((index: number) => {
    if (dragFrom.current === null || dragFrom.current === index) return
    reorder(dragFrom.current, index)
    dragFrom.current = index
  }, [reorder])

  const onDragEnd = useCallback(() => {
    dragFrom.current = null
    sync.saveCategories()
  }, [sync])

  const openAddEditor = useCallback((x: number, y: number) => {
    setNewEditorPos({ x, y })
    setShowNewEditor(true)
  }, [])

  const handleAddClick = (e: React.MouseEvent) => {
    openAddEditor(e.clientX, e.clientY)
  }

  useEffect(() => {
    const handler = () => {
      if (addBtnRef.current) {
        const rect = addBtnRef.current.getBoundingClientRect()
        openAddEditor(rect.left + rect.width / 2, rect.top + rect.height / 2)
      }
    }
    window.addEventListener('add-category', handler)
    return () => window.removeEventListener('add-category', handler)
  }, [openAddEditor])

  return (
    <div className="h-full flex flex-col bg-surface px-4 py-3">
      <div className="flex-1 min-h-0 overflow-y-auto">
        {!categoriesLoaded ? (
          <CategorySkeleton />
        ) : (
          <>
            <div className="flex flex-col gap-1.5 pt-0.5">
              {visibleCats.map((cat, i) => (
                <CategoryRow
                  key={cat.catId}
                  catId={cat.catId}
                  label={cat.label}
                  color={cat.color}
                  hotkey={hotkey(i)}
                  isActive={activeCategoryId === cat.catId}
                  index={i}
                  onDragStart={onDragStart}
                  onDragEnter={onDragEnter}
                  onDragEnd={onDragEnd}
                  onSaveCategories={sync.saveCategories}
                  onDeleteAllEntries={sync.deleteAllEntriesForCategory}
                />
              ))}
            </div>

            {overflowCats.length > 0 && (
              <MoreAccordion count={overflowCats.length}>
                <div className="flex flex-col gap-1.5">
                  {overflowCats.map((cat, i) => (
                    <CategoryRow
                      key={cat.catId}
                      catId={cat.catId}
                      label={cat.label}
                      color={cat.color}
                      hotkey={null}
                      isActive={activeCategoryId === cat.catId}
                      index={MAX_VISIBLE + i}
                      onDragStart={onDragStart}
                      onDragEnter={onDragEnter}
                      onDragEnd={onDragEnd}
                      onSaveCategories={sync.saveCategories}
                      onDeleteAllEntries={sync.deleteAllEntriesForCategory}
                    />
                  ))}
                </div>
              </MoreAccordion>
            )}
          </>
        )}
      </div>

      <div className="mt-2 flex gap-1.5 flex-shrink-0">
        <EraserButton />
        <button
          ref={addBtnRef}
          onClick={handleAddClick}
          className="flex-1 h-14 flex flex-col items-center justify-center gap-1 rounded-lg text-xs bg-bg text-muted hover:text-text transition-colors"
        >
          <PlusIcon size={18} />
          Add
        </button>
        <TagsButton sync={sync} />
        <GcalVisibilityToggle />
      </div>

      {showNewEditor && (
        <CategoryEditor
          position={newEditorPos}
          onClose={() => setShowNewEditor(false)}
          onSave={sync.saveCategories}
          onDeleteAllEntries={sync.deleteAllEntriesForCategory}
        />
      )}
    </div>
  )
}

function GcalVisibilityToggle() {
  const linked = useGoogleCalendarStore((s) => s.linked)
  const visible = useGoogleCalendarStore((s) => s.visible)
  const toggleVisible = useGoogleCalendarStore((s) => s.toggleVisible)

  if (!linked) return null

  return (
    <button
      onClick={toggleVisible}
      className="flex-1 h-14 flex flex-col items-center justify-center gap-1 rounded-lg text-xs bg-bg text-muted hover:text-text transition-colors"
    >
      {visible ? <EyeIcon size={18} /> : <EyeOffIcon size={18} />}
      Calendar
    </button>
  )
}
