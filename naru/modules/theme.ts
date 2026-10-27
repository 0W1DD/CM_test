// The community's theme from its key colour (settings.theme_key_color): the
// app's colour tokens at the key colour's OKLCh hue and chroma, light on
// :root and dark on .dark. Shared by the page (app/lib/theme.ts, which
// previews a colour as the owner picks it) and the site's route, which
// writes it into each page's head (routes.ts), so the two agree to the
// character. The colour maths is culori's (sRGB to linear to OKLab to
// OKLCh), written out because the site's code imports no packages.

/** The OKLCh chroma and hue of #rrggbb (or #rgb), as culori's converter("oklch") has them. */
function keyOf(hex: string): { c: number; h: number } | null {
  const match = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!match) return null;
  const digits = match[1] as string;
  const n = parseInt(
    digits.length === 3 ? digits.replace(/./g, (d) => d + d) : digits,
    16,
  );
  const [r, g, b] = [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff].map(
    (v) => v / 255,
  ) as [number, number, number];
  const linear = (v: number) =>
    Math.abs(v) <= 0.04045
      ? v / 12.92
      : (Math.sign(v) || 1) * ((Math.abs(v) + 0.055) / 1.055) ** 2.4;
  const [lr, lg, lb] = [linear(r), linear(g), linear(b)];
  const L = Math.cbrt(
    0.412221469470763 * lr + 0.5363325372617348 * lg + 0.0514459932675022 * lb,
  );
  const M = Math.cbrt(
    0.2119034958178252 * lr + 0.6806995506452344 * lg + 0.1073969535369406 * lb,
  );
  const S = Math.cbrt(
    0.0883024591900564 * lr + 0.2817188391361215 * lg + 0.6299787016738222 * lb,
  );
  // A grey has no hue: culori sets a and b to 0 for one.
  const grey = r === g && g === b;
  const a = grey
    ? 0
    : 1.9779985324311684 * L - 2.4285922420485799 * M + 0.450593709617411 * S;
  const bb = grey
    ? 0
    : 0.0259040424655478 * L + 0.7827717124575296 * M - 0.8086757549230774 * S;
  const c = Math.sqrt(a * a + bb * bb);
  // Without chroma, the hue the app has always used (culori's undefined).
  let h = 255;
  if (c) {
    h = ((Math.atan2(bb, a) * 180) / Math.PI) % 360;
    if (h < 0) h += 360;
  }
  return { c, h };
}

function fmt(l: number, c: number, h: number): string {
  return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(2)})`;
}

function rotate(h: number, delta: number): number {
  return (((h + delta) % 360) + 360) % 360;
}

function lightTokens(h: number, keyC: number): Record<string, string> {
  const primaryC = Math.min(keyC, 0.1);
  const ringC = Math.min(keyC, 0.08);
  return {
    "--background": fmt(0.975, 0.004, h),
    "--foreground": fmt(0.22, 0.02, h),
    "--card": fmt(0.995, 0.003, h),
    "--card-foreground": fmt(0.27, 0.02, h),
    "--popover": fmt(0.995, 0.003, h),
    "--popover-foreground": fmt(0.27, 0.02, h),
    "--primary": fmt(0.52, primaryC, h),
    "--primary-foreground": fmt(0.99, 0.003, h),
    "--secondary": fmt(0.94, 0.008, h),
    "--secondary-foreground": fmt(0.32, 0.03, h),
    "--muted": fmt(0.955, 0.005, h),
    "--muted-foreground": fmt(0.47, 0.02, h),
    "--accent": fmt(0.945, 0.005, h),
    "--accent-foreground": fmt(0.32, 0.02, h),
    "--border": fmt(0.9, 0.006, h),
    "--input": fmt(0.92, 0.005, h),
    "--ring": fmt(0.65, ringC, h),
    "--chart-1": fmt(0.78, 0.1, h),
    "--chart-2": fmt(0.78, 0.12, rotate(h, 120)),
    "--chart-3": fmt(0.78, 0.08, rotate(h, 240)),
    "--chart-4": fmt(0.86, 0.13, rotate(h, -60)),
    "--chart-5": fmt(0.78, 0.1, rotate(h, 60)),
    "--sidebar": fmt(0.98, 0.005, h),
    "--sidebar-foreground": fmt(0.27, 0.02, h),
    "--sidebar-primary": fmt(0.52, primaryC, h),
    "--sidebar-primary-foreground": fmt(0.99, 0.003, h),
    "--sidebar-accent": fmt(0.94, 0.005, h),
    "--sidebar-accent-foreground": fmt(0.32, 0.02, h),
    "--sidebar-border": fmt(0.92, 0.005, h),
    "--sidebar-ring": fmt(0.65, ringC, h),
    "--lilac-strong": fmt(0.5, Math.min(keyC, 0.08), h),
    "--mute": fmt(0.55, 0.03, h),
    "--mute-strong": fmt(0.5, 0.04, h),
    "--mute-strong-hover": fmt(0.45, 0.05, h),
    "--logo-gradient": `linear-gradient(135deg, ${fmt(0.58, Math.min(keyC, 0.07), h)}, ${fmt(0.45, Math.min(keyC, 0.08), h)})`,
    "--badge-gradient": `linear-gradient(135deg, ${fmt(0.58, Math.min(keyC, 0.08), h)}, ${fmt(0.5, Math.min(keyC, 0.09), h)})`,
    "--badge-shadow": `0 2px 6px -1px oklch(0.45 ${Math.min(keyC, 0.08).toFixed(3)} ${h.toFixed(2)} / 0.4)`,
  };
}

function darkTokens(h: number, keyC: number): Record<string, string> {
  const primaryC = Math.min(keyC, 0.1);
  const ringC = Math.min(keyC, 0.08);
  return {
    "--background": fmt(0.19, 0.015, h),
    "--foreground": fmt(0.95, 0.005, h),
    "--card": fmt(0.225, 0.015, h),
    "--card-foreground": fmt(0.96, 0.005, h),
    "--popover": fmt(0.255, 0.02, h),
    "--popover-foreground": fmt(0.96, 0.005, h),
    "--primary": fmt(0.78, primaryC, h),
    "--primary-foreground": fmt(0.22, 0.02, h),
    "--secondary": fmt(0.33, 0.03, h),
    "--secondary-foreground": fmt(0.94, 0.01, h),
    "--muted": fmt(0.28, 0.02, h),
    "--muted-foreground": fmt(0.76, 0.015, h),
    "--accent": fmt(0.33, 0.015, h),
    "--accent-foreground": fmt(0.94, 0.01, h),
    "--ring": fmt(0.72, ringC, h),
    "--chart-1": fmt(0.78, 0.12, h),
    "--chart-2": fmt(0.78, 0.13, rotate(h, 120)),
    "--chart-3": fmt(0.78, 0.1, rotate(h, 240)),
    "--chart-4": fmt(0.85, 0.13, rotate(h, -60)),
    "--chart-5": fmt(0.78, 0.12, rotate(h, 60)),
    "--sidebar": fmt(0.225, 0.02, h),
    "--sidebar-foreground": fmt(0.96, 0.005, h),
    "--sidebar-primary": fmt(0.78, primaryC, h),
    "--sidebar-primary-foreground": fmt(0.22, 0.02, h),
    "--sidebar-accent": fmt(0.33, 0.015, h),
    "--sidebar-accent-foreground": fmt(0.94, 0.01, h),
    "--sidebar-ring": fmt(0.72, ringC, h),
    "--lilac-strong": fmt(0.72, Math.min(keyC, 0.08), h),
    "--mute": fmt(0.68, 0.04, h),
    "--mute-strong": fmt(0.7, 0.05, h),
    "--mute-strong-hover": fmt(0.75, 0.06, h),
    "--logo-gradient": `linear-gradient(135deg, ${fmt(0.7, Math.min(keyC, 0.08), h)}, ${fmt(0.58, Math.min(keyC, 0.09), h)})`,
    "--badge-gradient": `linear-gradient(135deg, ${fmt(0.7, Math.min(keyC, 0.09), h)}, ${fmt(0.6, Math.min(keyC, 0.1), h)})`,
    "--badge-shadow": `0 2px 6px -1px oklch(0.6 ${Math.min(keyC, 0.09).toFixed(3)} ${h.toFixed(2)} / 0.45)`,
  };
}

function rulesBlock(tokens: Record<string, string>): string {
  return Object.entries(tokens)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
}

export function buildThemeCss(hex: string | null | undefined): string {
  if (!hex) return "";
  const key = keyOf(hex);
  if (!key) return "";
  const h = key.h;
  const keyC = key.c;
  return `:root {
${rulesBlock(lightTokens(h, keyC))}
}

.dark {
${rulesBlock(darkTokens(h, keyC))}
}`;
}
