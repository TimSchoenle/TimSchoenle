/**
 * What every generated image shares: the two GitHub themes, their colours, the font stack, and
 * where each image is written.
 *
 * @remarks
 * Every image is rendered once per theme. The README picks between the two with a `<picture>`
 * element, which GitHub resolves against the viewer's GitHub appearance setting. A single SVG with
 * an internal `prefers-color-scheme` query would follow the operating system instead, and show a
 * light image on a dark GitHub page whenever the two disagree.
 *
 * @packageDocumentation
 */

import type { Icon } from "./icons";

/** The two GitHub themes an image is rendered for. */
export type ThemeName = "light" | "dark";

/** Both themes, in the order images are written. */
export const THEME_NAMES: readonly ThemeName[] = ["light", "dark"];

/** Surface and text colours for one theme, from GitHub's Primer palette. */
export interface Theme {
    readonly surface: string;
    readonly border: string;
    readonly track: string;
    readonly text: string;
    readonly muted: string;
    readonly accent: string;
}

export const THEMES: Readonly<Record<ThemeName, Theme>> = {
    light: { surface: "#f6f8fa", border: "#d0d7de", track: "#eaeef2", text: "#1f2328", muted: "#59636e", accent: "#0969da" },
    dark: { surface: "#161b22", border: "#30363d", track: "#21262d", text: "#e6edf3", muted: "#8b949e", accent: "#4493f8" },
};

/** The system UI fonts GitHub itself uses. An SVG shown as an image cannot load web fonts. */
export const FONT_STACK = `-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif`;

/** Below this contrast against the surface, a brand colour is replaced. */
const MIN_BRAND_CONTRAST = 2;

/** Repository path of the image `name` for `theme`, as the README references it. */
export function themedAsset(name: string, theme: ThemeName): string {
    return `assets/${name}-${theme}.svg`;
}

/** Escapes text for an SVG text node or a double-quoted attribute. */
export function escapeXml(text: string): string {
    return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

/** WCAG relative luminance of a `#rrggbb` colour. */
function luminance(hex: string): number {
    const channel = (offset: number) => {
        const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG contrast ratio between two `#rrggbb` colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
    const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * The colour an icon, or anything keyed to one, is drawn in on the theme's surface.
 *
 * @param icon - The icon, or `undefined` when there is none.
 * @param theme - The theme the colour is for.
 * @param fallback - Used when there is no brand colour, or it would disappear on the surface.
 * @returns A `#rrggbb` colour.
 */
export function brandColour(icon: Icon | undefined, theme: ThemeName, fallback: keyof Pick<Theme, "text" | "accent">): string {
    const colours = THEMES[theme];
    if (!icon?.hex) {
        return colours[fallback];
    }
    const brand = `#${icon.hex}`;
    return contrastRatio(brand, colours.surface) >= MIN_BRAND_CONTRAST ? brand : colours[fallback];
}

/** Draws `icon` scaled into a square of side `size` at the origin. */
export function iconGlyph(icon: Icon, size: number, fill: string): string {
    const rule = icon.fillRule ? ` fill-rule="${icon.fillRule}"` : "";
    return `<g transform="scale(${size / icon.size})"><path fill="${fill}"${rule} d="${icon.path}"/></g>`;
}
