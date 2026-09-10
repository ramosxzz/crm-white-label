/** Converte #rgb / #rrggbb para HSL (0–360, 0–100, 0–100). */
export function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const raw = hex.trim().replace(/^#/, "");
  if (![3, 6].includes(raw.length)) return null;
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return null;
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function hslToRelativeLuminance(h: number, s: number, l: number) {
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = ((h % 360) + 360) % 360 / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  const offset = lightness - chroma / 2;
  const [r, g, b] =
    segment < 1 ? [chroma, x, 0]
      : segment < 2 ? [x, chroma, 0]
        : segment < 3 ? [0, chroma, x]
          : segment < 4 ? [0, x, chroma]
            : segment < 5 ? [x, 0, chroma]
              : [chroma, 0, x];
  const linear = (channel: number) => {
    const value = channel + offset;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** Escolhe preto ou branco conforme o maior contraste WCAG com a cor informada. */
export function contrastingForeground(h: number, s: number, l: number) {
  const luminance = hslToRelativeLuminance(h, s, l);
  const whiteContrast = 1.05 / (luminance + 0.05);
  const blackContrast = (luminance + 0.05) / 0.05;
  return whiteContrast >= blackContrast ? "0 0% 100%" : "0 0% 0%";
}

/** Variáveis CSS do tema por empresa (light/dark). */
export function tenantBrandCssVars(
  hex: string,
  scheme: "light" | "dark",
): Record<string, string> {
  const hsl = hexToHsl(hex);
  if (!hsl) return {};
  const { h, s } = hsl;
  const sat = clamp(s, 32, 72);

  if (scheme === "light") {
    const brandL = clamp(28 + (100 - hsl.l) * 0.12, 28, 40);
    const mutedL = 93;
    const brandForeground = contrastingForeground(h, sat, brandL);
    const darkForeground = brandForeground === "0 0% 0%";
    return {
      "--brand": `${h} ${sat}% ${brandL}%`,
      "--brand-active": `${h} ${sat}% ${brandL}%`,
      "--brand-foreground": brandForeground,
      "--brand-muted": `${h} ${Math.round(sat * 0.45)}% ${mutedL}%`,
      "--accent": `${h} ${Math.round(sat * 0.22)}% 92%`,
      "--accent-foreground": `${h} ${sat}% ${brandL}%`,
      "--ring": `${h} ${sat}% ${brandL + 2}%`,
      "--chat-outbound": `${h} ${sat}% ${brandL}%`,
      "--chat-outbound-foreground": brandForeground,
      "--chat-outbound-meta": darkForeground
        ? `${h} ${Math.round(sat * 0.35)}% 16%`
        : `${h} ${Math.round(sat * 0.35)}% 88%`,
      "--aqua": `${(h + 16) % 360} ${clamp(sat - 8, 28, 55)}% ${brandL + 6}%`,
    };
  }

  const brandL = clamp(42 + hsl.l * 0.08, 44, 58);
  const chatL = brandL - 6;
  const chatForeground = contrastingForeground(h, Math.max(sat - 4, 30), chatL);
  return {
    "--brand": `${h} ${sat}% ${brandL}%`,
    "--brand-active": `${h} ${sat}% ${Math.max(62, brandL)}%`,
    "--brand-foreground": contrastingForeground(h, sat, brandL),
    "--brand-muted": `${h} ${Math.round(sat * 0.35)}% 14%`,
    "--accent": `${h} ${Math.round(sat * 0.28)}% 16%`,
    "--accent-foreground": `${h} ${Math.min(sat + 8, 72)}% ${brandL + 4}%`,
    "--ring": `${h} ${sat}% ${brandL - 2}%`,
    "--chat-outbound": `${h} ${Math.max(sat - 4, 30)}% ${chatL}%`,
    "--chat-outbound-foreground": chatForeground,
    "--chat-outbound-meta": chatForeground === "0 0% 0%"
      ? `${h} ${Math.round(sat * 0.25)}% 14%`
      : `${h} ${Math.round(sat * 0.25)}% 78%`,
    "--aqua": `${(h + 16) % 360} ${clamp(sat - 6, 28, 55)}% ${brandL + 4}%`,
  };
}

/** Cor sugerida a partir do nome da empresa (hue estavel). */
export function suggestBrandColorFromName(name: string): string {
  let hash = 0;
  const t = name.trim() || "empresa";
  for (let i = 0; i < t.length; i++) hash = (hash * 31 + t.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  const sat = 42 + (hash % 18);
  const light = 36 + (hash % 10);
  return hslToHex(hue, sat, light);
}

function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const toByte = (v: number) => Math.round((v + m) * 255);
  const rr = toByte(r).toString(16).padStart(2, "0");
  const gg = toByte(g).toString(16).padStart(2, "0");
  const bb = toByte(b).toString(16).padStart(2, "0");
  return `#${rr}${gg}${bb}`;
}
