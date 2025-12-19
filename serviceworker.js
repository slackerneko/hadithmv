self.addEventListener("install", _ => {
   console.log("Service worker installed");
});
self.addEventListener("activate", _ => {
   console.log("Service worker activated");
});

self.addEventListener("fetch", _ => {
  console.log("Service worker fetch")
});


caches.open("assets")
  .then(cache => {
    cache.addAll([
      "styles/main.css",
      "styles/colors.css",
      "styles/typography.css"
    ])
  })
