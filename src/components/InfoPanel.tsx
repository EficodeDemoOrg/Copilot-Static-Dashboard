import { useEffect, useRef } from 'react'

interface Props {
  isOpen: boolean
  onClose: () => void
  content: string
}

export function InfoPanel({ isOpen, onClose, content }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      <div className="info-panel__overlay" />
      <div className="info-panel" role="dialog" aria-modal="true" ref={dialogRef}>
        <div className="info-panel__header">
          <h2 className="info-panel__title">Input Files Guide</h2>
          <button
            className="info-panel__close"
            onClick={onClose}
            type="button"
            aria-label="Close help panel"
          >
            ✕
          </button>
        </div>
        <div className="info-panel__content">
          {content.split('\n\n').map((section, index) => {
            const lines = section.split('\n')
            const firstLine = lines[0]

            if (firstLine.startsWith('# ')) {
              return (
                <h1 key={index} className="info-panel__heading-1">
                  {firstLine.substring(2)}
                </h1>
              )
            }
            if (firstLine.startsWith('## ')) {
              return (
                <h2 key={index} className="info-panel__heading-2">
                  {firstLine.substring(3)}
                </h2>
              )
            }
            if (firstLine.startsWith('### ')) {
              return (
                <h3 key={index} className="info-panel__heading-3">
                  {firstLine.substring(4)}
                </h3>
              )
            }

            return (
              <div key={index} className="info-panel__text">
                {lines.map((line, lineIndex) => {
                  const trimmed = line.trim()
                  if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
                    return (
                      <strong key={lineIndex}>
                        {trimmed.substring(2, trimmed.length - 2)}
                      </strong>
                    )
                  }
                  if (trimmed.startsWith('1. ') || trimmed.match(/^\d+\. /)) {
                    return <li key={lineIndex}>{trimmed.substring(3)}</li>
                  }
                  if (trimmed.startsWith('- ')) {
                    return <li key={lineIndex}>{trimmed.substring(2)}</li>
                  }
                  if (trimmed === '') {
                    return null
                  }
                  return (
                    <p key={lineIndex} className="info-panel__paragraph">
                      {line}
                    </p>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
