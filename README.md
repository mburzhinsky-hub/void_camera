# VOID Camera

VOID is a mobile-first experimental camera PWA focused on **shooting with a look already selected**.

The first prototype is designed for iPhone Safari and modern mobile browsers:

- live camera preview
- film looks visible before capture
- processed capture using the same live look
- capability-aware zoom / camera controls
- Nothing-inspired monochrome UI
- tactile UI sound engine
- PWA install support
- progressive enhancement for browser camera APIs

## Prototype status

v0.1 is a web prototype. Browser access to low-level camera controls differs by device and browser. The UI only treats sensor controls such as ISO as real when the browser exposes them; unsupported controls are clearly marked rather than faked.

## iPhone test

After GitHub Pages is enabled for this repository, open the Pages URL in Safari, allow camera access, and optionally use **Share → Add to Home Screen**.

## Direction

Native Android is planned as the full Camera2 implementation for real RAW DNG, manual ISO, shutter, focus and device-specific camera capabilities.
