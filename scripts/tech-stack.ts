/**
 * Draws one SVG tile per skill. Pure: no I/O, no clock.
 *
 * @remarks
 * The README lays the tiles out itself, as inline images under Markdown headings, so they wrap
 * with the page: a phone shows fewer tiles per row at full size instead of a shrunken grid. One SVG
 * per GitHub theme; `theme.ts` explains why.
 *
 * GitHub strips CSS from READMEs, so the space between inline images is whatever whitespace
 * renders as, about 4px. Each tile carries transparent margin on its right and bottom edges to
 * make up the rest of {@link TILE_GAP}. There is none on the left, so the first tile of every row
 * starts flush with the heading above it.
 *
 * @packageDocumentation
 */

import { baseName, findIcon } from "./icons";
import { isCore, type Skill } from "./skills";
import { brandColour, escapeXml, FONT_STACK, iconGlyph, THEMES, type ThemeName } from "./theme";

/** Directory, under `assets/`, that holds the tiles. The generator owns it and prunes it. */
export const SKILL_TILE_DIR = "skills";

/** The gap between tiles in pixels, inline whitespace included. */
export const TILE_GAP = 12;

/** Width of the whitespace GitHub renders between two inline images. */
const INLINE_SPACE = 4;

/** Tile geometry for one tier, without the margin. */
interface Tier {
    readonly width: number;
    readonly height: number;
    readonly icon: number;
    readonly font: number;
    readonly weight: number;
}

const CORE_TIER: Tier = { width: 96, height: 80, icon: 32, font: 12, weight: 600 };
const PROFICIENT_TIER: Tier = { width: 78, height: 64, icon: 22, font: 10.5, weight: 500 };

const CORNER_RADIUS = 10;

/** Average glyph width as a fraction of font size, for the system UI fonts the image names. */
const GLYPH_WIDTH_RATIO = 0.56;

/** Delay between tile fade-ins within a row, in milliseconds. */
const STAGGER_MS = 40;

/** Characters a slug spells out, so `C#` and `C` do not collide. */
const SLUG_WORDS: Readonly<Record<string, string>> = { "#": "sharp", "+": "plus" };

/** The tier a skill is drawn in. */
function tierOf(skill: Skill): Tier {
    return isCore(skill) ? CORE_TIER : PROFICIENT_TIER;
}

/**
 * A category's tiles as rows: core skills, then proficient skills, each row omitted when empty.
 * The README and the generator both lay tiles out through this, so a tile's fade-in delay matches
 * its place on the page.
 */
export function tileRows(skills: readonly Skill[]): Skill[][] {
    return [skills.filter(isCore), skills.filter(s => !isCore(s))].filter(row => row.length > 0);
}

/** A skill name as a file name: `Spring Boot` becomes `spring-boot`, `C#` becomes `c-sharp`. */
export function skillSlug(name: string): string {
    return name
        .toLowerCase()
        .replaceAll(/[#+]/g, char => `-${SLUG_WORDS[char]}-`)
        .replaceAll(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/** Asset name of a skill's tile, for `themedAsset`. */
export function skillTileAsset(skill: Skill): string {
    return `${SKILL_TILE_DIR}/${skillSlug(skill.name)}`;
}

/**
 * Checks that no two skills map to the same tile file.
 *
 * @throws Naming both skills, when two names reduce to the same slug.
 */
export function assertUniqueSlugs(skills: readonly Skill[]): void {
    const seen = new Map<string, string>();
    for (const { name } of skills) {
        const slug = skillSlug(name);
        const other = seen.get(slug);
        if (other !== undefined) {
            throw new Error(`Skills "${other}" and "${name}" would share the tile file "${slug}"`);
        }
        seen.set(slug, name);
    }
}

/** A tile's full image size, margin included, as the README declares it. */
export function tileSize(skill: Skill): { readonly width: number; readonly height: number } {
    const { width, height } = tierOf(skill);
    return { width: width + TILE_GAP - INLINE_SPACE, height: height + TILE_GAP - INLINE_SPACE };
}

/** Draws the logo, or a monogram when there is none, in a box of side `size` at the origin. */
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

/**
 * Renders one skill's tile for one theme.
 *
 * @remarks
 * Core skills get a large tile, proficient skills a small one. The tile fades in after a delay set
 * by its position in its row, so a row appears left to right; viewers who ask for reduced motion
 * see it at once, and so does a renderer without CSS animation.
 *
 * @param skill - The skill to draw.
 * @param position - The tile's index within its row, for the fade-in delay.
 * @param theme - Which GitHub theme the colours are for.
 * @returns A complete SVG document.
 */
export function renderSkillTile(skill: Skill, position: number, theme: ThemeName): string {
    const tier = tierOf(skill);
    const { width, height } = tileSize(skill);
    const { surface, border, text } = THEMES[theme];
    const name = baseName(skill.name);
    // Long names shrink to fit the tile instead of overflowing it.
    const fontSize = Math.min(tier.font, (tier.width - 14) / (name.length * GLYPH_WIDTH_RATIO));
    const iconTop = (tier.height - tier.icon - fontSize - 10) / 2;

    return [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title">`,
        `<title id="title">${escapeXml(skill.name)}</title>`,
        "<style>",
        `text { font-family: ${FONT_STACK}; }`,
        // `backwards` applies the first keyframe only while the animation runs, so a renderer that
        // ignores CSS animation still shows the tile.
        `.tile { animation: tile-in 420ms ease-out ${position * STAGGER_MS}ms backwards; }`,
        "@keyframes tile-in { from { opacity: 0; translate: 0 6px; } to { opacity: 1; translate: 0 0; } }",
        "@media (prefers-reduced-motion: reduce) { .tile { animation: none; } }",
        "</style>",
        `<g class="tile">`,
        `<rect x="0.5" y="0.5" width="${tier.width - 1}" height="${tier.height - 1}" rx="${CORNER_RADIUS}" fill="${surface}" stroke="${border}"/>`,
        `<g transform="translate(${(tier.width - tier.icon) / 2} ${iconTop.toFixed(1)})">${glyph(skill.name, tier.icon, theme)}</g>`,
        `<text x="${tier.width / 2}" y="${tier.height - 14}" text-anchor="middle" font-size="${fontSize.toFixed(1)}" font-weight="${tier.weight}" fill="${text}">${escapeXml(name)}</text>`,
        "</g>",
        "</svg>",
        "",
    ].join("\n");
}
