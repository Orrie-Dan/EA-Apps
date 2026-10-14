export async function bootDashboard(appKey) {
  const boot = document.getElementById('boot')

  try {
    const response = await fetch(new URL(`../api/gis/bootstrap?app=${encodeURIComponent(appKey)}`, import.meta.url))
    const data = await response.json()

    if (!data.proxyPath) {
      boot.textContent = 'This solution is not configured.'
      return
    }

    window.location.replace(data.proxyPath)
  } catch {
    boot.textContent = 'Unable to open this solution.'
  }
}
