import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Suppress PostHog analytics errors (external script, not part of our app)
const originalError = console.error;
console.error = (...args) => {
  const errorString = args[0]?.toString?.() || '';
  if (
    errorString.includes('posthog') ||
    errorString.includes('PerformanceServerTiming') ||
    errorString.includes('DataCloneError')
  ) {
    return; // Suppress PostHog-related errors
  }
  originalError.apply(console, args);
};

// Global error handler for uncaught errors from third-party scripts
window.addEventListener('error', (event) => {
  if (
    event.message?.includes('PerformanceServerTiming') ||
    event.message?.includes('DataCloneError') ||
    event.filename?.includes('posthog')
  ) {
    event.preventDefault();
    event.stopPropagation();
    return false;
  }
});

// Handle unhandled promise rejections from third-party scripts
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason?.toString?.() || '';
  if (
    reason.includes('PerformanceServerTiming') ||
    reason.includes('DataCloneError') ||
    reason.includes('posthog')
  ) {
    event.preventDefault();
    return false;
  }
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
