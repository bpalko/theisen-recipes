function syncVisualViewport() {
  const viewport = window.visualViewport;
  const root = document.documentElement;
  root.style.setProperty("--vv-height", `${viewport?.height ?? window.innerHeight}px`);
  root.style.setProperty("--vv-offset", `${viewport?.offsetTop ?? 0}px`);
}

export function resetDocumentScroll() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

export function dismissKeyboard() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  resetDocumentScroll();
}

const installed = Symbol.for("theisen-visual-viewport");
const globalState = globalThis as typeof globalThis & { [installed]?: boolean };
if (!globalState[installed]) {
  globalState[installed] = true;
  syncVisualViewport();
  window.addEventListener("resize", syncVisualViewport);
  window.visualViewport?.addEventListener("resize", syncVisualViewport);
  window.visualViewport?.addEventListener("scroll", syncVisualViewport);
}
