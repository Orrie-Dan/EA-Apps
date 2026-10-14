export async function bootDashboard(appKey) {
  const boot = document.getElementById('boot')

  try {
    const response = await fetch(new URL(`../api/gis/bootstrap?app=${encodeURIComponent(appKey)}`, import.meta.url), {
      credentials: 'include',
    })
    const data = await response.json()

    if (response.status === 401 || !data.authenticated) {
      const next = window.top?.location?.pathname || '/'
      window.top.location.href = `/login?next=${encodeURIComponent(next)}`
      return
    }

    if (!data.proxyPath) {
      boot.textContent = 'This solution is not configured.'
      return
    }

    window.location.replace(data.proxyPath)
  } catch {
    boot.textContent = 'Unable to open this solution.'
  }
}
