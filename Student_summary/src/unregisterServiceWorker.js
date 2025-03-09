// Immediately unregister any service workers and prevent future registration
if ('serviceWorker' in navigator) {
  // First unregister any existing service workers
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister().then(function() {
        console.log('ServiceWorker unregistered');
      });
    }
  });

  // Clear any service worker caches
  caches.keys().then(function(cacheNames) {
    return Promise.all(
      cacheNames.map(function(cacheName) {
        return caches.delete(cacheName);
      })
    );
  });

  // Override the register function to prevent new registrations
  navigator.serviceWorker.register = function() {
    console.warn('Service Worker registration prevented');
    return Promise.reject('Service Worker registration prevented');
  };
} 