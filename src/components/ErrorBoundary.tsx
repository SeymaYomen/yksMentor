import React from 'react'

export default class ErrorBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() { return { failed: true } }

  componentDidCatch() {
    console.error('Application rendering failed')
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="min-h-screen flex items-center justify-center p-6">
          <div role="alert" className="max-w-md space-y-4 text-center">
            <h1 className="text-xl font-bold">Sayfa yüklenemedi</h1>
            <p>Lütfen sayfayı yenileyip tekrar deneyin.</p>
            <button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-indigo-600 px-5 py-3 text-white focus-visible:ring-4 focus-visible:ring-indigo-300">Sayfayı yenile</button>
          </div>
        </main>
      )
    }
    return this.props.children
  }
}
