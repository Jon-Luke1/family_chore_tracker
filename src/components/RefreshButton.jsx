// Reloads the app from the network so a home screen install picks up the latest
// deploy. Adds a throwaway query param so a cached copy of the page isn't reused.
// The saved login lives in browser storage, so nobody is signed out.
export default function RefreshButton() {
  const refresh = () => {
    const url = new URL(window.location.href)
    url.searchParams.set('r', Date.now())
    window.location.replace(url.toString())
  }

  return (
    <button
      onClick={refresh}
      title="Reload the latest version"
      className="text-sm text-gray-500 hover:text-gray-700"
    >
      ↻ Refresh
    </button>
  )
}
