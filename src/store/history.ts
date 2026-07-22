import { create } from 'zustand'

/**
 * Command pattern for undo/redo (CLAUDE.md Phase A / roadmap Section 10.2).
 *
 * There is exactly ONE entry point — `history.execute(command)` — used for
 * both single mutations and transaction groups. Grouping happens
 * automatically: every command executed within the same synchronous JS turn
 * is batched together and committed to the undo stack as one entry on the
 * next microtask (a single command commits as itself; two or more commit as
 * a `Transaction`).
 *
 * Why automatic, turn-based grouping instead of an explicit
 * `beginTransaction()/endTransaction()` API: `CanvasStage`'s delete-key
 * handler (owned by another agent — see CLAUDE.md Phase A directory
 * ownership) calls `removeWiresForComponent(id)` then `removeComponent(id)`
 * as two independent store calls, with no knowledge of each other or of
 * history. Turn-based batching is what lets that existing call site collapse
 * into ONE undo step ("delete component + its wires") without editing it.
 * This is safe in practice because real user gestures (distinct click/
 * keydown/drag events) are always separate JS turns — nothing merges two
 * unrelated user actions. Tests that want each call to land in its own undo
 * step call `flush()` (or `await` a microtask) between them.
 */
export interface Command {
  readonly label: string
  do(): void
  undo(): void
  /**
   * If this command can absorb `next` into itself (e.g. two moves of the
   * same component in quick succession — "drag coalescing"), return the
   * merged replacement command. Returning null/undefined means "do not
   * coalesce": `next` is recorded as its own entry.
   */
  coalesceWith?(next: Command): Command | null
}

/** A composite command that undoes/redoes its children as a single unit. */
export class Transaction implements Command {
  readonly label: string
  readonly children: Command[]

  constructor(children: Command[], label?: string) {
    this.children = children
    this.label = label ?? `transaction(${children.map((c) => c.label).join(', ')})`
  }

  do() {
    for (const child of this.children) child.do()
  }

  undo() {
    for (let i = this.children.length - 1; i >= 0; i--) this.children[i].undo()
  }
}

/** Bounded so a long editing session can't grow the stack unboundedly. */
const HISTORY_CAP = 200

interface HistoryState {
  undoStack: Command[]
  redoStack: Command[]
}

interface HistoryStore extends HistoryState {
  /** Runs `command.do()` immediately and queues it for the history stack. */
  execute: (command: Command) => void
  /** Forces any pending same-turn batch to commit to the stack right now. */
  flush: () => void
  undo: () => void
  redo: () => void
  /** Drops all history without touching store data (e.g. on file load/new project). */
  clear: () => void
}

// Module-level (not store state) — this is bookkeeping for the in-flight
// batch, not history content, so it doesn't belong in Zustand state.
let pendingBatch: Command[] = []
let flushScheduled = false

export const useHistoryStore = create<HistoryStore>((set, get) => {
  function commitPendingBatch() {
    flushScheduled = false
    if (pendingBatch.length === 0) return
    const commands = pendingBatch
    pendingBatch = []

    const command = commands.length === 1 ? commands[0] : new Transaction(commands)
    const { undoStack } = get()
    const top = undoStack[undoStack.length - 1]
    const merged = top?.coalesceWith?.(command) ?? null

    let nextStack = merged ? [...undoStack.slice(0, -1), merged] : [...undoStack, command]
    if (nextStack.length > HISTORY_CAP) {
      nextStack = nextStack.slice(nextStack.length - HISTORY_CAP)
    }
    set({ undoStack: nextStack, redoStack: [] })
  }

  return {
    undoStack: [],
    redoStack: [],

    execute: (command) => {
      command.do()
      pendingBatch.push(command)
      if (!flushScheduled) {
        flushScheduled = true
        queueMicrotask(commitPendingBatch)
      }
    },

    flush: () => commitPendingBatch(),

    undo: () => {
      commitPendingBatch()
      const { undoStack, redoStack } = get()
      const command = undoStack[undoStack.length - 1]
      if (!command) return
      command.undo()
      set({ undoStack: undoStack.slice(0, -1), redoStack: [...redoStack, command] })
    },

    redo: () => {
      commitPendingBatch()
      const { undoStack, redoStack } = get()
      const command = redoStack[redoStack.length - 1]
      if (!command) return
      command.do()
      set({ undoStack: [...undoStack, command], redoStack: redoStack.slice(0, -1) })
    },

    clear: () => {
      pendingBatch = []
      flushScheduled = false
      set({ undoStack: [], redoStack: [] })
    },
  }
})
