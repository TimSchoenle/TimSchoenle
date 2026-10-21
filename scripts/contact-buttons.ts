/**
 * Draws the contact links as themed SVG buttons. Pure: no I/O, no clock.
 *
 * @remarks
 * Each button is its own image, because a link inside an SVG is not clickable once GitHub shows the
 * SVG as an image: the README wraps each button's `<picture>` in its own `<a>`. Labels are fixed
 * words rather than the addresses themselves, so a button's width never depends on profile data.
 *
 * @packageDocumentation
 */

import type { Icon } from "./icons";
import { LOCAL_LOGOS, GLYPHS } from "./logos";
import { brandColour, escapeXml, FONT_STACK, iconGlyph, THEMES, type ThemeName } from "./theme";
import type { Profile } from "./types";

/** One contact button. */
export interface ContactLink {
    /** Stable identifier, used in the asset name. */
    readonly id: "website" | "linkedin" | "email";
    readonly label: string;
    readonly href: string;
    readonly icon: Icon;
}

/** Button height in pixels; the README sets the same height on the `<img>`. */
export const BUTTON_HEIGHT = 40;

const PADDING_X = 16;
const ICON_SIZE = 18;
const ICON_GAP = 10;
const FONT_SIZE = 14;
/** Average glyph width of 14px semibold system UI text, generous so labels never touch the edge. */
const LABEL_CHAR_WIDTH = 8.4;

/** Asset name of one button's images, for `themedAsset`. */
export function contactAsset(link: ContactLink): string {
    return `contact-${link.id}`;
}

/**
 * The profile's contact buttons: website, LinkedIn when the profile has one, and email.
 *
 * @param profile - The validated profile document.
 * @returns The buttons in display order.
 */
export function contactLinks(profile: Profile): ContactLink[] {
    const links: ContactLink[] = [{ id: "website", label: "Website", href: profile.website, icon: GLYPHS.globe }];
    if (profile.socials.linkedin) {
        links.push({ id: "linkedin", label: "LinkedIn", href: profile.socials.linkedin, icon: LOCAL_LOGOS["LinkedIn"]! });
    }
    links.push({ id: "email", label: "Email", href: `mailto:${profile.email}`, icon: GLYPHS.mail });
    return links;
}

/** The rendered width of a button, from its label length. */
export function buttonWidth(link: ContactLink): number {
    return Math.ceil(2 * PADDING_X + ICON_SIZE + ICON_GAP + link.label.length * LABEL_CHAR_WIDTH);
}

/**
 * Renders one contact button for one theme.
 *
 * @param link - The button to draw.
 * @param theme - Which GitHub theme the colours are for.
 * @returns A complete SVG document.
 */
export function renderContactButton(link: ContactLink, theme: ThemeName): string {
    const { surface, border, text } = THEMES[theme];
    const width = buttonWidth(link);
    const iconTop = (BUTTON_HEIGHT - ICON_SIZE) / 2;
    return [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${BUTTON_HEIGHT}" viewBox="0 0 ${width} ${BUTTON_HEIGHT}" role="img" aria-labelledby="title">`,
        `<title id="title">${escapeXml(link.label)}</title>`,
        `<style>text { font-family: ${FONT_STACK}; }</style>`,
        `<rect x="0.5" y="0.5" width="${width - 1}" height="${BUTTON_HEIGHT - 1}" rx="${BUTTON_HEIGHT / 2 - 0.5}" fill="${surface}" stroke="${border}"/>`,
        `<g transform="translate(${PADDING_X} ${iconTop})">${iconGlyph(link.icon, ICON_SIZE, brandColour(link.icon, theme, "text"))}</g>`,
        `<text x="${PADDING_X + ICON_SIZE + ICON_GAP}" y="${BUTTON_HEIGHT / 2}" dy="0.35em" font-size="${FONT_SIZE}" font-weight="600" fill="${text}">${escapeXml(link.label)}</text>`,
        "</svg>",
        "",
    ].join("\n");
}
