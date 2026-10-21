export async function unregisterServiceWorker() {
  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((name) => name.startsWith("rideshare-offline-v1-") || name === "rideshare-static-v1")
        .map((name) => caches.delete(name))
    );
  }
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
    }
  }
}
