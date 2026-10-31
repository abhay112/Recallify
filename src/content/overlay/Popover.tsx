import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'

export const MIN_WIDTH = 280
export const MIN_HEIGHT = 400

/** Gap kept to the viewport edges when resizing. */
const EDGE = 8

interface Frame {
  /** Offset from where the popover opened, from dragging. */
  dx: number
  dy: number
  /** Set once the user resizes; until then the popover sizes itself to its content. */
  width?: number
  height?: number
}

interface Gesture {
  kind: 'move' | 'resize'
  startX: number
  startY: number
  frame: Frame
  rect: DOMRect
  width: number
  height: number
}

// Unlike Math.min(Math.max(...)), this returns `min` when the range is empty (a tiny viewport).
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max))

/**
 * A card anchored near the selection that can be dragged by its top bar and
 * resized from its bottom-right corner.
 */
export function Popover({ position, children }: { position: { top: number; left: number }; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const [frame, setFrame] = useState<Frame>({ dx: 0, dy: 0 })
  const [active, setActive] = useState(false)

  const begin = (kind: Gesture['kind']) => (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el || event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    gesture.current = {
      kind,
      startX: event.clientX,
      startY: event.clientY,
      frame,
      rect: el.getBoundingClientRect(),
      width: el.offsetWidth,
      height: el.offsetHeight,
    }
    setActive(true)
  }

  const update = (event: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g) return
    const pointerDx = event.clientX - g.startX
    const pointerDy = event.clientY - g.startY

    if (g.kind === 'move') {
      // Stay fully on screen. A popover that opened partly off an edge may not go further
      // off it, but is not pulled back either, so grabbing it never makes it jump.
      const dx = clamp(pointerDx, Math.min(0, -g.rect.left), Math.max(0, window.innerWidth - g.rect.right))
      const dy = clamp(pointerDy, Math.min(0, -g.rect.top), Math.max(0, window.innerHeight - g.rect.bottom))
      setFrame({ ...g.frame, dx: g.frame.dx + dx, dy: g.frame.dy + dy })
    } else {
      const width = clamp(g.width + pointerDx, MIN_WIDTH, window.innerWidth - 2 * EDGE)
      const height = clamp(g.height + pointerDy, MIN_HEIGHT, window.innerHeight - 2 * EDGE)
      // The card is centred on its anchor, so growing by N would push the left edge
      // out by N/2. Shift it back so the corner stays under the cursor.
      setFrame({ dx: g.frame.dx + (width - g.width) / 2, dy: g.frame.dy, width, height })
    }
  }

  const end = () => {
    gesture.current = null
    setActive(false)
  }

  const gestureHandlers = (kind: Gesture['kind']) => ({
    onPointerDown: begin(kind),
    onPointerMove: update,
    onPointerUp: end,
    onPointerCancel: end,
  })

  const sized = frame.width !== undefined
  return (
    <div
      ref={ref}
      className={`recallify-popover${sized ? ' is-sized' : ''}${active ? ' is-dragging' : ''}`}
      style={{ top: position.top + frame.dy, left: position.left + frame.dx, width: frame.width, height: frame.height }}
      // A drag ends in a mouseup; keep it from reaching the page's selection listener.
      onMouseUp={(event) => event.stopPropagation()}
    >
      <div className="recallify-popover-handle" title="Drag to move" {...gestureHandlers('move')} />
      {children}
      <div className="recallify-popover-grip" title="Drag to resize" {...gestureHandlers('resize')} />
    </div>
  )
}
