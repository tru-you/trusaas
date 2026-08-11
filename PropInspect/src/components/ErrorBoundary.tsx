import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Catches render errors so one bad component doesn't take the whole DMS down.
 *
 * React unmounts the entire tree when a render throws, which is exactly what
 * happened on 2026-07-23: a single ReferenceError in one effect left every
 * signed-in agency staring at a white page, with nothing on screen to explain
 * it and no way back except knowing to reload.
 *
 * A yard depends on this during a working day, so the failure mode has to be
 * "one screen is broken, here's the way out" — never a blank window.
 */
export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep this one: without it a production crash leaves no trace at all.
    console.error("Unhandled render error:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen bg-[color:var(--ink)] text-[color:var(--white)] flex items-center justify-center p-6">
        <div className="max-w-md w-full flex flex-col gap-4 rounded-[18px] border border-[rgba(232,234,230,0.14)] bg-[rgba(232,234,230,0.055)] p-6">
          <div>
            <h2 className="text-[20px] font-semibold tracking-[-0.01em]">Something went wrong</h2>
            <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-2 leading-relaxed">
              This screen hit an error and stopped. Your data is safe — nothing was saved or
              changed. Reloading usually clears it.
            </p>
          </div>

          {/* The message, not the stack. Enough for you to tell us what broke. */}
          <p className="text-[13px] font-mono text-[rgba(232,234,230,0.55)] bg-[color:var(--ink)] border border-[rgba(232,234,230,0.14)] rounded-lg px-3 py-2 break-words">
            {error.message || "Unknown error"}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn btn-primary flex-1"
            >
              <RefreshCw size={14} /> Reload
            </button>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="btn btn-secondary"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
}
