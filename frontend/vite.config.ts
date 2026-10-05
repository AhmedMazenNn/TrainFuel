import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "trainfuel-offline-shell",
      generateBundle(_options, bundle) {
        const assets = [
          "/",
          "/index.html",
          ...Object.keys(bundle)
            .filter((name) => !name.endsWith(".map"))
            .map((name) => "/" + name),
        ];
        const version = JSON.stringify("trainfuel-shell-" + Date.now());
        this.emitFile({
          type: "asset",
          fileName: "sw.js",
          source: `const CACHE=${version}; const ASSETS=${JSON.stringify(assets)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('trainfuel-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.open(CACHE).then(cache=>cache.match('/index.html',{ignoreVary:true}))));return;}if(ASSETS.includes(url.pathname))event.respondWith(caches.open(CACHE).then(cache=>cache.match(url.pathname,{ignoreVary:true})).then(hit=>hit||fetch(event.request)));});`,
        });
      },
    },
  ],
  server: {
    host: "127.0.0.1",
    proxy: {
      "/api": process.env.TRAINFUEL_API_TARGET || "http://127.0.0.1:8000",
    },
  },
  preview: {
    proxy: {
      "/api": process.env.TRAINFUEL_API_TARGET || "http://127.0.0.1:8000",
    },
  },
});
