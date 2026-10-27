"use client";

import { useState, useSyncExternalStore } from "react";

/** The cell under the pointer, or null when the pointer is off the stage. */
export interface CellPointer {
  readonly column: number;
  readonly row: number;
}

export interface PointerStore {
  readonly get: () => CellPointer | null;
  readonly set: (next: CellPointer | null) => void;
  readonly subscribe: (listener: () => void) => () => void;
}

const createPointerStore = (): PointerStore => {
  let value: CellPointer | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next) => {
      if (next?.column === value?.column && next?.row === value?.row) {
        return;
      }
      value = next;
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

/**
 * A store per stage, so the pointer readouts re-render on their own and
 * the background under them doesn't re-render on every pointer move.
 */
export const usePointerStore = (): PointerStore => {
  const [store] = useState(createPointerStore);
  return store;
};

const serverPointer = () => null;

export const usePointer = (store: PointerStore): CellPointer | null =>
  useSyncExternalStore(store.subscribe, store.get, serverPointer);
