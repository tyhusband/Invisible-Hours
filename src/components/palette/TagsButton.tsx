import { useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { useTagStore } from '../../store/tagStore'
import { TagListModal } from '../tags/TagListModal'
import { TagIcon } from '../ui/Icons'

interface TagsButtonProps {
  sync: {
    saveTags: () => Promise<void>
    deleteTagAndAssignments: (tagId: string) => Promise<void>
  }
}

export function TagsButton({ sync }: TagsButtonProps) {
  const tags = useTagStore((s) => s.tags)
  const [showList, setShowList] = useState(false)

  const handleSave = () => {
    sync.saveTags()
  }

  const handleDelete = async (tagId: string) => {
    await sync.deleteTagAndAssignments(tagId)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowList(true)}
        className="flex-1 h-14 flex flex-col items-center justify-center gap-1 rounded-lg text-xs bg-bg text-muted hover:text-text transition-colors"
      >
        <TagIcon size={18} />
        {tags.length} Tags
      </button>

      <AnimatePresence>
        {showList && (
          <TagListModal
            onClose={() => setShowList(false)}
            onSave={handleSave}
            onDelete={handleDelete}
          />
        )}
      </AnimatePresence>
    </>
  )
}
