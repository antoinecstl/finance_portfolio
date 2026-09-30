// Pictogram redrawn from the original icon.png geometry (1024 grid): an open
// ring cut horizontally on the right, a dot, and two bars. Keep in sync with
// public/icon.svg.
export const LOGO_MARK_PATHS = {
  ring: 'M733.8 335A306 306 0 1 0 756.1 638L658.5 638A222 222 0 1 1 621.6 335Z',
  dot: { cx: 412, cy: 493, r: 95 },
  bars: [
    { x: 540, y: 384, width: 328, height: 80, rx: 12 },
    { x: 540, y: 509, width: 288, height: 80, rx: 12 },
  ],
} as const;
