import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// ============================================
// Suppress PostHog analytics errors completely
// These are from external Emergent platform scripts
// ============================================

// Suppress console errors from PostHog
const originalConsoleError = console.error;
console.error = function(...args) {
  const msg = args[0]?.toString?.() || '';
  if (
    msg.includes('posthog') ||
    msg.includes('PerformanceServerTiming') ||
    msg.includes('DataCloneError') ||
    msg.includes('postMessage')
  ) {
    return;
  }
  originalConsoleError.apply(console, args);
};

// Suppress window errors
window.onerror = function(message, source, lineno, colno, error) {
  if (
    message?.includes?.('PerformanceServerTiming') ||
    message?.includes?.('DataCloneError') ||
    source?.includes?.('posthog')
  ) {
    return true; // Prevents the error from showing
  }
  return false;
};

// Suppress unhandled promise rejections
window.onunhandledrejection = function(event) {
  const reason = event.reason?.toString?.() || event.reason?.message || '';
  if (
    reason.includes('PerformanceServerTiming') ||
    reason.includes('DataCloneError') ||
    reason.includes('posthog')
  ) {
    event.preventDefault();
    return;
  }
};

// Remove error overlay elements if they appear
const removePostHogErrorOverlay = () => {
  const overlays = document.querySelectorAll('iframe[id*="webpack-dev-server"]');
  overlays.forEach(el => {
    if (el.contentDocument?.body?.textContent?.includes('posthog') ||
        el.contentDocument?.body?.textContent?.includes('PerformanceServerTiming')) {
      el.remove();
    }
  });
  
  // Also check for React error overlay
  const reactOverlay = document.getElementById('webpack-dev-server-client-overlay');
  if (reactOverlay) {
    const content = reactOverlay.shadowRoot?.textContent || reactOverlay.textContent || '';
    if (content.includes('posthog') || content.includes('PerformanceServerTiming')) {
      reactOverlay.remove();
    }
  }
};

// Run periodically to catch any overlays
setInterval(removePostHogErrorOverlay, 500);

// Also use MutationObserver to catch overlays immediately
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType === 1) {
        const el = node;
        if (el.id?.includes('webpack-dev-server') || 
            el.tagName === 'IFRAME' ||
            el.className?.includes?.('error-overlay')) {
          setTimeout(removePostHogErrorOverlay, 100);
        }
      }
    });
  });
});

observer.observe(document.body || document.documentElement, {
  childList: true,
  subtree: true
});

// ============================================
// Render App
// ============================================

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
