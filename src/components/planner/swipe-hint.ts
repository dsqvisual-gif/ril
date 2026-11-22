"use client";

import { useSyncExternalStore } from "react";

const KEY = "uspeyka-swipe-learned";
const EVENT = "uspeyka-swipe-learned";

function read(): boolean {
  try {
    if (!window.matchMedia("(pointer: coarse)").matches) return false;
    return window.localStorage.getItem(KEY) !== "1";
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

/** Whether to show the swipe hint: touch screens only, until the first swipe or dismissal. */
export function useSwipeHint(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}

export function markSwipeLearned() {
  try {
    if (window.localStorage.getItem(KEY) === "1") return;
    window.localStorage.setItem(KEY, "1");
  } catch {
    // Storage can be blocked; the hint then simply shows again next time.
  }
  window.dispatchEvent(new Event(EVENT));
}
