import { defineConfig } from 'wxt'

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'Bandcamp Dig',
    permissions: ['storage'],
    web_accessible_resources: [
      {
        resources: ['retrieve-tracks.js', 'player-interact.js', 'dark-mode.css'],
        matches: ['*://*.bandcamp.com/*'],
      },
    ],
    host_permissions: ['*://*.bandcamp.com/*'],
  },
  srcDir: 'src',
})
