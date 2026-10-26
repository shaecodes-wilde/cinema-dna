import { Component, type ErrorInfo, type ReactNode } from 'react'

/** Keeps one chapter's failure (e.g. an unexpected export shape) from blanking the whole dashboard. */
export class ChapterBoundary extends Component<{ name: string; children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`CINEMA DNA: chapter "${this.props.name}" failed to render`, error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <section className="border-t hairline px-5 py-16 md:px-16">
        <div className="panel mx-auto max-w-3xl p-6 text-sm text-ink-2">
          <div className="label mb-2 text-amber">{this.props.name}</div>
          This chapter couldn't render with your data ({this.state.error.message}). The rest of the dashboard is unaffected. If you think it's a bug, open an
          issue with that message (never your export).
        </div>
      </section>
    )
  }
}
