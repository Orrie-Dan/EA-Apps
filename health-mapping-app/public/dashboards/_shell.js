export async function bootDashboard(appKey) {
  const boot = document.getElementById('boot')

  try {
    // Relative to this script, so it stays under the base the app is served from.
    const bootstrap = new URL(`../api/gis/bootstrap?app=${encodeURIComponent(appKey)}`, import.meta.url)
    const response = await fetch(bootstrap, {
      credentials: 'include',
    })
    const data = await response.json()

    if (!data.proxyPath) {
      boot.textContent = 'This solution is not configured.'
      return
    }

    window.location.replace(data.embedUrl || data.proxyPath)
  } catch {
    boot.textContent = 'Unable to open this solution.'
  }
}
