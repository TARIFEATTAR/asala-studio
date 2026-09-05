import { useEffect } from "react";

/** Track the visible area when a phone keyboard or browser toolbar is open. */
export function useMobileViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const root = document.documentElement;
    const update = () => {
      // Pinch zoom must remain browser-controlled; do not resize UI around it.
      if (viewport && viewport.scale !== 1) return;
      root.style.setProperty('--mobile-viewport-height', `${viewport?.height ?? window.innerHeight}px`);
      root.style.setProperty('--mobile-viewport-top', `${viewport?.offsetTop ?? 0}px`);
      root.style.setProperty('--mobile-keyboard-inset', `${Math.max(0, window.innerHeight - (viewport?.height ?? window.innerHeight) - (viewport?.offsetTop ?? 0))}px`);
    };
    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      ['--mobile-viewport-height', '--mobile-viewport-top', '--mobile-keyboard-inset'].forEach(name => root.style.removeProperty(name));
    };
  }, []);
}
