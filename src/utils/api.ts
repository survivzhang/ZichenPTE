/**
 * POST JSON to the app's API. Failures are logged rather than thrown so that a
 * network hiccup never interrupts typing practice.
 */
export async function postJSON(path: string, body: unknown) {
  try {
    const res = await fetch(`/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    })
    if (res.status === 401) {
      // The session has ended (e.g. signed out in another tab); show the login page.
      window.location.reload()
      return
    }
    if (!res.ok) {
      console.error(`POST /api${path} failed: ${res.status}`, await res.text())
    }
  } catch (error) {
    console.error(`POST /api${path} failed`, error)
  }
}
