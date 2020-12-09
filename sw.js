const ftlCache = 'ftl-cache-v1';

const ftlCacheURLs = [
  '/static',
  '/static/css/bulma-tooltip.min.css',
  '/static/imgs/1.png',
  '/static/imgs/2.png',
  '/static/imgs/3.png',
  '/static/imgs/4.png',
  '/static/imgs/5.png',
  '/static/imgs/hero-cover.png',
  '/static/imgs/landingpage-infographic.png',
  '/static/imgs/redirection.png',
  '/static/imgs/streetview_phone.png',
  '/static/imgs/cl_white_logo.png',
  '/static/imgs/ftm_phone_screen.png',
  '/static/imgs/gdl_phone_screen.png',
  '/static/js/bulma-toast.min.js',
  '/static/js/tab-selector.js',
  '/static/js/countUp.js',
  '/static/js/sw-loader.js',
  '/static/js/jquery-3.5.0.min.js',
  '/static/js/firebase-app-7.14.3.js',
  '/static/js/firebase-analytics-7.14.3.js',
  '/static/js/font-awesome-89be965993a.js',
  '/static/js/hj.js',
  '/static/css/bulma-0.9.1.min.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(ftlCache).then(function(cache) {
    return cache.addAll(ftlCacheURLs);
  }));
});

self.addEventListener('activate', (event) => {
  return self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  event.respondWith(caches.match(event.request).then(function(response) {
    if (response) {
      return response;
    }
    return fetch(event.request);
  }));
});
