// Cache authenticated app data for offline reading and deliver push notifications.
const OFFLINE_CACHE_PREFIX = "rideshare-offline-v1-";
const STATIC_CACHE_NAME = "rideshare-static-v1";
const PENDING_CACHE_NAME = "rideshare-pending-v1";
const MAX_API_CACHE_ENTRIES = 200;
let activeUserId = null;
let sessionRefreshPromise = null;

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (request.method !== "GET") {
    if (request.method !== "HEAD") {
      event.respondWith(
        fetch(request).catch(() =>
          new Response(
            JSON.stringify({
              error: "Offline Mode — Disconnected. Changes are unavailable while offline.",
            }),
            { status: 503, headers: { "Content-Type": "application/json" } }
          )
        )
      );
    }
    return;
  }

  if (url.pathname === "/api/auth/session") {
    event.respondWith(fetchSession(request));
    return;
  }

  if (url.pathname === "/api/auth/signout" || url.pathname === "/api/auth/logout") return;

  const isApiRequest = url.pathname.startsWith("/api/");
  const isStaticAsset = url.pathname.startsWith("/_next/static/");
  const isAppRequest = request.mode === "navigate" || request.headers.has("RSC");

  if (!isApiRequest && !isStaticAsset && !isAppRequest) return;
  if (url.pathname.startsWith("/api/auth/") || url.pathname.startsWith("/api/admin/")) return;

  event.respondWith(networkFirst(request, { isApiRequest, isStaticAsset }));
});

async function fetchSession(request) {
  let response;
  try {
    response = await fetch(request);
  } catch {
    const cache = await getActiveCache();
    const cachedSession = cache ? await cache.match(request) : null;
    if (cachedSession) {
      try {
        const session = await cachedSession.clone().json();
        if (typeof session?.user?.id === "string") activeUserId = session.user.id;
      } catch {
        await cache.delete(request);
      }
      return cachedSession;
    }
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!response.ok) return response;

  let session;
  try {
    session = await response.clone().json();
  } catch (error) {
    console.error("Unable to read the online session for offline storage:", error);
    return response;
  }

  const userId = session?.user?.id;
  if (typeof userId === "string" && /^[0-9a-f-]{36}$/i.test(userId)) {
    activeUserId = userId;
    await useUserCache(userId);
    const cache = await caches.open(cacheName(userId));
    await storeResponse(cache, request, response.clone());
    await adoptPendingPages(cache);
  } else {
    activeUserId = null;
    await clearOfflineCaches();
  }
  return response;
}

async function networkFirst(request, { isApiRequest, isStaticAsset }) {
  if (isApiRequest && !activeUserId) await refreshSession();

  const userCache = isStaticAsset ? null : await getActiveCache();
  const cache = isStaticAsset
    ? await caches.open(STATIC_CACHE_NAME)
    : userCache;

  let response;
  try {
    response = await fetch(request);
  } catch {
    const cached = cache ? await cache.match(request) : null;
    if (cached) return cached;
    if (isApiRequest) {
      return new Response(
        JSON.stringify({
          error: "offline",
          message: "Offline Mode — Disconnected. No saved data is available.",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }
    if (request.mode === "navigate") {
      const fallbackCache = await getActiveCache();
      const fallback = fallbackCache
        ? await fallbackCache.match(new URL("/dashboard", self.location.origin).href)
        : null;
      if (fallback) return fallback;
      return offlineResponse("This page has not been saved for offline use.");
    }
    return new Response("Offline Mode — Disconnected. No saved data is available.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  function refreshSession() {
    if (!sessionRefreshPromise) {
      sessionRefreshPromise = fetchSession(
        new Request(new URL("/api/auth/session", self.location.origin), { credentials: "include" })
      ).finally(() => {
        sessionRefreshPromise = null;
      });
    }
    return sessionRefreshPromise;
  }

  if (response.ok) {
    if (isStaticAsset) {
      await storeResponse(cache, request, response.clone());
    } else if (cache && activeUserId) {
      await storeResponse(cache, request, response.clone());
      if (isApiRequest) await limitCacheSize(cache);
    } else if (request.mode === "navigate") {
      const pendingCache = await caches.open(PENDING_CACHE_NAME);
      await storeResponse(pendingCache, request, response.clone());
      if (activeUserId) {
        await adoptPendingPages(await caches.open(cacheName(activeUserId)));
      }
    }
  }
  return response;
}

async function storeResponse(cache, request, response) {
  try {
    await cache.put(request, response);
  } catch (error) {
    console.error("Unable to store a response for offline use:", error);
  }
}

function cacheName(userId) {
  return `${OFFLINE_CACHE_PREFIX}${userId}`;
}

async function getActiveCache() {
  if (activeUserId) return caches.open(cacheName(activeUserId));
  const names = (await caches.keys()).filter((name) => name.startsWith(OFFLINE_CACHE_PREFIX));
  if (names.length !== 1) return null;
  activeUserId = names[0].slice(OFFLINE_CACHE_PREFIX.length);
  return caches.open(names[0]);
}

async function useUserCache(userId) {
  const names = (await caches.keys()).filter(
    (name) => name.startsWith(OFFLINE_CACHE_PREFIX) && name !== cacheName(userId)
  );
  await Promise.all(names.map((name) => caches.delete(name)));
}

async function clearOfflineCaches() {
  const names = (await caches.keys()).filter(
    (name) =>
      name.startsWith(OFFLINE_CACHE_PREFIX) ||
      name === STATIC_CACHE_NAME ||
      name === PENDING_CACHE_NAME
  );
  await Promise.all(names.map((name) => caches.delete(name)));
}

async function adoptPendingPages(userCache) {
  const pendingCache = await caches.open(PENDING_CACHE_NAME);
  const requests = await pendingCache.keys();
  await Promise.all(
    requests.map(async (request) => {
      const response = await pendingCache.match(request);
      if (response) await userCache.put(request, response);
    })
  );
  await caches.delete(PENDING_CACHE_NAME);
}

async function limitCacheSize(cache) {
  try {
    const requests = await cache.keys();
    const apiRequests = requests.filter((request) => new URL(request.url).pathname.startsWith("/api/"));
    const excess = apiRequests.length - MAX_API_CACHE_ENTRIES;
    if (excess > 0) {
      await Promise.all(apiRequests.slice(0, excess).map((request) => cache.delete(request)));
    }
  } catch (error) {
    console.error("Unable to limit offline data storage:", error);
  }
}

function offlineResponse(message) {
  return new Response(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline Mode</title><body style="font-family:system-ui,sans-serif;max-width:36rem;margin:15vh auto;padding:1.5rem;color:#222"><h1>Offline Mode — Disconnected</h1><p>${message}</p><p>Reconnect to the internet and try again.</p></body></html>`,
    {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }
  );
}

self.addEventListener("push", (event) => {
  if (event.data) {
    try {
      const data = event.data.json();

      event.waitUntil(
        self.clients
          .matchAll({
            type: "window",
            includeUncontrolled: true,
          })
          .then((clients) => {
            // Check if we have any visible clients
            const visibleClients = clients.filter((client) => client.visibilityState === "visible");

            if (visibleClients.length > 0) {
              // Send to all clients to ensure it's received
              return Promise.all(
                clients.map((client) => {
                  return client.postMessage({
                    type: "PUSH_NOTIFICATION",
                    title: data.title,
                    body: data.body,
                  });
                })
              );
            } else {
              // No visible clients - show native notification
              const options = {
                body: data.body,
                icon: data.icon || "/icon.png",
                vibrate: [100, 50, 100],
                data: {
                  dateOfArrival: Date.now(),
                  primaryKey: "2",
                  ...(data.data || {}),
                },
              };
              return self.registration.showNotification(data.title, options);
            }
          })
      );
    } catch {
      // Fall back to basic notification if parsing fails
      event.waitUntil(
        self.registration.showNotification("New Notification", {
          body: "You have a new notification",
        })
      );
    }
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients
      .matchAll({
        type: "window",
      })
      .then((clientList) => {
        if (clientList.length > 0) {
          return clientList[0].focus();
        }
        return self.clients.openWindow("/");
      })
  );
});

// Log when service worker installs and activates
self.addEventListener("install", () => {
  self.skipWaiting(); // Force activation
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      refreshSession(),
    ])
  );
});
