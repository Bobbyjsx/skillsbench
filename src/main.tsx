import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { api } from "./api/client";

function report(msg: string) {
  console.error("[skillbench]", msg);
  api.logLine(msg).catch(() => {});
}

window.addEventListener("error", (e) => {
  const msg = `${e.message} @ ${e.filename}:${e.lineno}`;
  report(msg);
});

window.addEventListener("unhandledrejection", (e) => {
  const reason = e.reason?.message ?? String(e.reason);
  report(`unhandled rejection: ${reason}`);
});

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    report(`render error: ${error.message}\n${info.componentStack ?? ""}`);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen items-center justify-center bg-bg px-8">
          <div className="max-w-[520px] rounded-[10px] border border-danger/40 bg-surface p-5">
            <h1 className="text-sm font-semibold text-danger">Something went wrong</h1>
            <p className="mt-2 break-all font-mono text-xs leading-relaxed text-text">
              {this.state.error.message}
            </p>
            <p className="mt-2 text-xs text-faint">
              This is a bug in Skillbench. Restarting the app usually recovers; the error was
              written to the console.
            </p>
            <button
              onClick={() => this.setState({ error: null })}
              className="mt-4 rounded-[6px] bg-accent px-3 py-1.5 text-sm font-medium text-bg hover:opacity-90"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
