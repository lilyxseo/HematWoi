import { useEffect } from "react";

export function useLockBodyScroll(locked: boolean) {
  useEffect(() => {
    const { body, documentElement } = document;
    if (!body || !documentElement) return;

    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;

    if (locked) {
      const scrollbarWidth = window.innerWidth - documentElement.clientWidth;
      body.style.overflow = "hidden";
      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${scrollbarWidth}px`;
      }
      return () => {
        body.style.overflow = previousOverflow;
        body.style.paddingRight = previousPaddingRight;
      };
    }

    body.style.overflow = previousOverflow;
    body.style.paddingRight = previousPaddingRight;

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [locked]);
}
