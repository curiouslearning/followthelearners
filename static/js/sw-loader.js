
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js', {scope: '/'}).then((reg) => {
        console.log('Service worker registered', reg);
      }).catch((err) => {
        console.log('Failed to register the service worker', err);
      });
    });
  }
}

registerServiceWorker();
