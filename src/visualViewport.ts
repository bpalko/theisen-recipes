function syncVisualViewport() {
  const viewport = window.visualViewport;
  const root = document.documentElement;
  if (!viewport) {
    root.style.setProperty("--keyboard-inset", "0px");
    return;
  }
  const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
  root.style.setProperty("--keyboard-inset", `${inset > 100 ? Math.round(inset) : 0}px`);
}

export function resetDocumentScroll() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

export function dismissKeyboard() {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
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
