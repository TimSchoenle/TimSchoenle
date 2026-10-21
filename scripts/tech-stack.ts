/**
 * Draws the tech stack as a self-contained SVG logo grid. Pure: no I/O, no clock.
 *
 * @remarks
 * One SVG per GitHub theme; `theme.ts` explains why. The background stays transparent and the
 * tiles start at the left edge, so the grid lines up with the README heading above it and sits on
 * whatever page colour GitHub uses, including the dimmed and high-contrast variants.
 *
 * @packageDocumentation
 */

import { baseName, findIcon } from "./icons";
import { isCore, type Skill, type SkillGroup } from "./skills";
import { brandColour, escapeXml, FONT_STACK, iconGlyph, THEMES, type ThemeName } from "./theme";

/** Asset name of the tech stack images, for `themedAsset`. */
export const TECH_STACK_ASSET = "tech-stack";

/** Intrinsic width in pixels. The README scales the image to its column, so this sets proportions, not size. */
export const TECH_STACK_WIDTH = 840;

/** Tile geometry for one tier. */
interface Tier {
    readonly width: number;
    readonly height: number;
    readonly icon: number;
    readonly font: number;
    readonly weight: number;
}

const CORE_TIER: Tier = { width: 122, height: 104, icon: 40, font: 13, weight: 600 };
const PROFICIENT_TIER: Tier = { width: 98, height: 82, icon: 28, font: 11.5, weight: 500 };

/** Horizontal inset: just enough that the outermost tile borders are not clipped. */
const PADDING = 1;
const GAP = 12;
const CORNER_RADIUS = 12;
const HEADER_HEIGHT = 28;
const GROUP_SPACING = 16;

/** Average glyph width as a fraction of font size, for the system UI fonts the image names. */
const GLYPH_WIDTH_RATIO = 0.56;

/** Delay between tile fade-ins, in milliseconds. */
const STAGGER_MS = 25;

/** A tile placed at its final position. */
interface PlacedTile {
    readonly skill: Skill;
    readonly tier: Tier;
    readonly x: number;
    readonly y: number;
}

/**
 * Places tiles left to right, wrapping at the content width.
 *
 * @returns The y coordinate below the last row, or `y` unchanged when `skills` is empty.
 */
function flow(skills: readonly Skill[], tier: Tier, y: number, out: PlacedTile[]): number {
    if (skills.length === 0) {
        return y;
    }
    const perRow = Math.max(1, Math.floor((TECH_STACK_WIDTH - 2 * PADDING + GAP) / (tier.width + GAP)));
    skills.forEach((skill, i) => {
        out.push({
            skill,
            tier,
            x: PADDING + (i % perRow) * (tier.width + GAP),
            y: y + Math.floor(i / perRow) * (tier.height + GAP),
        });
    });
    return y + Math.ceil(skills.length / perRow) * (tier.height + GAP);
}

/** Draws the logo, or a monogram when there is none, centred in a box of side `size`. */
function glyph(name: string, size: number, theme: ThemeName): string {
    const icon = findIcon(name);
    if (icon) {
        return iconGlyph(icon, size, brandColour(icon, theme, "text"));
    }
    const label = name.length <= 3 ? name : name.slice(0, 2);
    const fontSize = size * (label.length === 3 ? 0.34 : 0.42);
    const { accent } = THEMES[theme];
    return `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="none" stroke="${accent}" stroke-width="2"/>`
        + `<text x="${size / 2}" y="${size / 2}" dy="0.35em" text-anchor="middle" font-size="${fontSize}" font-weight="700" fill="${accent}">${escapeXml(label)}</text>`;
}

/** Draws one tile: background, logo and name. */
function tile({ skill, tier, x, y }: PlacedTile, index: number, theme: ThemeName): string {
    const { surface: fill, border, text } = THEMES[theme];
    const name = baseName(skill.name);
    // Long names shrink to fit the tile instead of overflowing it.
    const fontSize = Math.min(tier.font, (tier.width - 14) / (name.length * GLYPH_WIDTH_RATIO));
    const iconTop = (tier.height - tier.icon - fontSize - 10) / 2;
    return `<g class="tile" style="animation-delay:${index * STAGGER_MS}ms" transform="translate(${x} ${y})">`
        + `<rect width="${tier.width}" height="${tier.height}" rx="${CORNER_RADIUS}" fill="${fill}" stroke="${border}"/>`
        + `<g transform="translate(${(tier.width - tier.icon) / 2} ${iconTop.toFixed(1)})">${glyph(skill.name, tier.icon, theme)}</g>`
        + `<text x="${tier.width / 2}" y="${tier.height - 14}" text-anchor="middle" font-size="${fontSize.toFixed(1)}" font-weight="${tier.weight}" fill="${text}">${escapeXml(name)}</text>`
        + `</g>`;
}

/** Draws a category label with a rule running to the right edge. */
function header(label: string, y: number, theme: ThemeName): string {
    const { muted, border } = THEMES[theme];
    const upper = label.toUpperCase();
    // Letter-spaced uppercase at 12px averages about 9.2px per character.
    const ruleStart = PADDING + upper.length * 9.2 + 12;
    return `<text x="${PADDING}" y="${y + 14}" font-size="12" font-weight="600" letter-spacing="1.2" fill="${muted}">${escapeXml(upper)}</text>`
        + `<line x1="${ruleStart.toFixed(1)}" x2="${TECH_STACK_WIDTH - PADDING}" y1="${y + 10}" y2="${y + 10}" stroke="${border}"/>`;
}

/**
 * Renders the tech stack image for one theme.
 *
 * @remarks
 * Each group gets a header, a row of large tiles for its core skills and a row of smaller tiles for
 * the rest. Empty groups are left out. Tiles fade in one after another, except for viewers who ask
 * for reduced motion; a renderer without CSS animation shows them at once.
 *
 * @param groups - The categories to draw, skills already filtered and ranked.
 * @param theme - Which GitHub theme the colours are for.
 * @returns A complete SVG document.
 */
export function renderTechStack(groups: readonly SkillGroup[], theme: ThemeName): string {
    const { muted } = THEMES[theme];
    const tiles: PlacedTile[] = [];
    const headers: string[] = [];

    let y = 8;
    for (const { label, skills } of groups) {
        if (skills.length === 0) {
            continue;
        }
        headers.push(header(label, y, theme));
        y += HEADER_HEIGHT;
        y = flow(skills.filter(isCore), CORE_TIER, y, tiles);
        y = flow(skills.filter(s => !isCore(s)), PROFICIENT_TIER, y, tiles);
        y += GROUP_SPACING;
    }
    const legendY = y + 4;
    const height = legendY + 12;

    const names = tiles.map(t => t.skill.name).join(", ");
    return [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${TECH_STACK_WIDTH}" height="${height}" viewBox="0 0 ${TECH_STACK_WIDTH} ${height}" role="img" aria-labelledby="title">`,
        `<title id="title">${escapeXml(`Tech stack: ${names}`)}</title>`,
        "<style>",
        `text { font-family: ${FONT_STACK}; }`,
        // `backwards` applies the first keyframe only while an animation runs, so a renderer that
        // ignores CSS animation still shows every tile.
        ".tile { animation: tile-in 420ms ease-out backwards; }",
        "@keyframes tile-in { from { opacity: 0; translate: 0 6px; } to { opacity: 1; translate: 0 0; } }",
        "@media (prefers-reduced-motion: reduce) { .tile { animation: none; } }",
        "</style>",
        ...headers,
        ...tiles.map((t, i) => tile(t, i, theme)),
        `<text x="${TECH_STACK_WIDTH - PADDING}" y="${legendY}" text-anchor="end" font-size="11" fill="${muted}">Large tiles: core · small tiles: proficient</text>`,
        "</svg>",
        "",
    ].join("\n");
}
