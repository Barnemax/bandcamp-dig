# Bandcamp Dig

A modular extension that allows you to dig better on Bandcamp. Pending stores acceptation.

## Features

This extension allows you to:
- Sort any items from Bandcamp in playlists
- Track upcoming releases from labels/artists or from individual releases
- Monitor your profile stats (followers, views, plays)
- Adds a dark mode
- Export/import your data across browsers

## Building from source

### Requirements

- **OS:** Windows, macOS, or Linux
- **Node.js:** v22 or later — [nodejs.org](https://nodejs.org)
- **pnpm:** v10 or later — install with `npm install -g pnpm`

### Steps

```bash
# 1. Install dependencies
pnpm install

# 2a. Build for Firefox
pnpm build:firefox

# 2b. Build for Chrome
pnpm build
```

The output is in `.output/firefox-mv2/` (Firefox) or `.output/chrome-mv3/` (Chrome). Load it in your browser via the extension developer tools ("Load unpacked" / "Load temporary add-on").

---

## Some other addons I enjoy

 - [Bandcamp Enhancement Suite](https://github.com/sabjorn/BandcampEnhancementSuite/)
 - [Bandcamp Tempo Adjust](https://github.com/azarbayejani/bandcamp-tempo-adjust)

## Licence

Source-available, all rights reserved during store review. Will switch to MIT once published on the Chrome Web Store and Firefox Add-ons.
