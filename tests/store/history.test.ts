import { beforeEach, describe, expect, it } from 'vitest'
import { useHistoryStore, Transaction, type Command } from '@/store/history'

function resetHistory() {
  useHistoryStore.getState().clear()
}

function makeCommand(label: string, log: string[]): Command {
  return {
    label,
    do: () => log.push(`do:${label}`),
    undo: () => log.push(`undo:${label}`),
  }
}

describe('history store', () => {
  beforeEach(resetHistory)

  it('execute() runs do() immediately, but the stack entry only lands after the batch flushes', () => {
    const log: string[] = []
    useHistoryStore.getState().execute(makeCommand('a', log))
    expect(log).toEqual(['do:a'])
    expect(useHistoryStore.getState().undoStack).toHaveLength(0)

    useHistoryStore.getState().flush()
    expect(useHistoryStore.getState().undoStack).toHaveLength(1)
  })

  it('round-trips a single command through undo and redo', () => {
    const log: string[] = []
    useHistoryStore.getState().execute(makeCommand('a', log))
    useHistoryStore.getState().flush()

    useHistoryStore.getState().undo()
    expect(log).toEqual(['do:a', 'undo:a'])
    expect(useHistoryStore.getState().undoStack).toHaveLength(0)
    expect(useHistoryStore.getState().redoStack).toHaveLength(1)

    useHistoryStore.getState().redo()
    expect(log).toEqual(['do:a', 'undo:a', 'do:a'])
    expect(useHistoryStore.getState().undoStack).toHaveLength(1)
    expect(useHistoryStore.getState().redoStack).toHaveLength(0)
  })

  it('undo/redo on an empty stack is a harmless no-op', () => {
    expect(() => useHistoryStore.getState().undo()).not.toThrow()
    expect(() => useHistoryStore.getState().redo()).not.toThrow()
  })

  it('groups commands executed within the same synchronous turn into one Transaction', () => {
    const log: string[] = []
    useHistoryStore.getState().execute(makeCommand('a', log))
    useHistoryStore.getState().execute(makeCommand('b', log))
    useHistoryStore.getState().flush()

    const stack = useHistoryStore.getState().undoStack
    expect(stack).toHaveLength(1)
    expect(stack[0]).toBeInstanceOf(Transaction)

    useHistoryStore.getState().undo()
    // Transaction.undo() reverses children in REVERSE order.
    expect(log).toEqual(['do:a', 'do:b', 'undo:b', 'undo:a'])
  })

  it('flushing between calls keeps them as separate undo entries', () => {
    const log: string[] = []
    useHistoryStore.getState().execute(makeCommand('a', log))
    useHistoryStore.getState().flush()
    useHistoryStore.getState().execute(makeCommand('b', log))
    useHistoryStore.getState().flush()

    expect(useHistoryStore.getState().undoStack).toHaveLength(2)
  })

  it('executing a new command after an undo clears the redo stack', () => {
    const log: string[] = []
    useHistoryStore.getState().execute(makeCommand('a', log))
    useHistoryStore.getState().flush()
    useHistoryStore.getState().undo()
    expect(useHistoryStore.getState().redoStack).toHaveLength(1)

    useHistoryStore.getState().execute(makeCommand('b', log))
    useHistoryStore.getState().flush()
    expect(useHistoryStore.getState().redoStack).toHaveLength(0)
  })

  it('coalesceWith merges consecutive commands into a single entry', () => {
    let mergeCount = 0
    function coalescing(label: string): Command {
      return {
        label,
        do: () => {},
        undo: () => {},
        coalesceWith: (next) => {
          mergeCount++
          return coalescing(`${label}+${next.label}`)
        },
      }
    }
    useHistoryStore.getState().execute(coalescing('a'))
    useHistoryStore.getState().flush()
    useHistoryStore.getState().execute(coalescing('b'))
    useHistoryStore.getState().flush()

    expect(mergeCount).toBe(1)
    expect(useHistoryStore.getState().undoStack).toHaveLength(1)
    expect(useHistoryStore.getState().undoStack[0].label).toBe('a+b')
  })

  it('a command that declines to coalesce (returns null) starts a new entry', () => {
    const decliner: Command = { label: 'a', do: () => {}, undo: () => {}, coalesceWith: () => null }
    const other: Command = { label: 'b', do: () => {}, undo: () => {} }
    useHistoryStore.getState().execute(decliner)
    useHistoryStore.getState().flush()
    useHistoryStore.getState().execute(other)
    useHistoryStore.getState().flush()

    expect(useHistoryStore.getState().undoStack).toHaveLength(2)
  })

  it('caps the undo stack at 200 entries, dropping the oldest first', () => {
    for (let i = 0; i < 210; i++) {
      useHistoryStore.getState().execute(makeCommand(`c${i}`, []))
      useHistoryStore.getState().flush()
    }
    const stack = useHistoryStore.getState().undoStack
    expect(stack).toHaveLength(200)
    expect(stack[0].label).toBe('c10')
    expect(stack[stack.length - 1].label).toBe('c209')
  })

  it('clear() drops history without invoking any undo()', () => {
    const log: string[] = []
    useHistoryStore.getState().execute(makeCommand('a', log))
    useHistoryStore.getState().flush()
    useHistoryStore.getState().clear()

    expect(log).toEqual(['do:a'])
    expect(useHistoryStore.getState().undoStack).toHaveLength(0)
    expect(useHistoryStore.getState().redoStack).toHaveLength(0)
  })
})
