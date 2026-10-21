/**
 * Draws a week of WakaTime stats as a self-contained SVG card. Pure: no I/O, no clock.
 *
 * @remarks
 * One SVG per GitHub theme; `theme.ts` explains why. Each language's colour and logo come from the
 * same lookup as the tech stack, so Java is the same red in both images.
 *
 * @packageDocumentation
 */

import { findIcon } from "./icons";
import { brandColour, escapeXml, FONT_STACK, iconGlyph, THEMES, type ThemeName } from "./theme";
import type { WakaTime } from "./types";

/** Asset name of the stats images, for `themedAsset`. */
export const STATS_ASSET = "stats";

/** Intrinsic width in pixels, the same as the tech stack image so both scale to the same size. */
export const STATS_WIDTH = 840;

/** WakaTime "languages" that are prose, configuration or diff viewing, not code. */
const NON_CODE_LANGUAGES: ReadonlySet<string> = new Set([
    "CSV", "Diff", "Git Config", "INI", "JSON", "Markdown", "Other", "Text", "TOML", "XML", "YAML",
]);

/** How many languages the card lists. */
const LANGUAGE_COUNT = 5;

const INSET = 28;
const ROW_HEIGHT = 40;
const ICON_SIZE = 18;
const NAME_X = INSET + 30;
const BAR_X = INSET + 210;
const BAR_WIDTH = 400;
const SUMMARY_Y = 96;
const SUMMARY_HEIGHT = 10;
const FIRST_ROW_Y = SUMMARY_Y + SUMMARY_HEIGHT + 30;

/** One listed language and its share of coding time. */
export interface LanguageShare {
    readonly name: string;
    /** WakaTime's own rendering of the time, such as `8 hrs 51 mins`. */
    readonly text: string;
    /** Share of all coding time, from 0 to 100. */
    readonly percent: number;
}

/** The week's coding time and how it splits across languages. */
export interface CodeBreakdown {
    /** Seconds spent in code languages, listed or not. Zero when nothing was coded. */
    readonly seconds: number;
    /** At most {@link LANGUAGE_COUNT} languages, in WakaTime's order (most time first). */
    readonly languages: readonly LanguageShare[];
    /** Share of coding time in code languages too small to be listed, from 0 to 100. */
    readonly otherPercent: number;
}

/**
 * Splits the week's coding time across languages.
 *
 * @remarks
 * Prose and configuration are left out of the list and out of the denominator, so the listed
 * shares and the unlisted remainder add up to 100%. The headline total of all tracked time is
 * shown separately.
 */
export function codeBreakdown(stats: WakaTime): CodeBreakdown {
    const code = stats.data.languages.filter(lang => !NON_CODE_LANGUAGES.has(lang.name) && lang.total_seconds > 0);
    const seconds = code.reduce((sum, lang) => sum + lang.total_seconds, 0);
    if (seconds === 0) {
        return { seconds: 0, languages: [], otherPercent: 0 };
    }
    const share = (part: number) => (part / seconds) * 100;
    const listed = code.slice(0, LANGUAGE_COUNT);
    const listedSeconds = listed.reduce((sum, lang) => sum + lang.total_seconds, 0);
    return {
        seconds,
        languages: listed.map(lang => ({ name: lang.name, text: lang.text, percent: share(lang.total_seconds) })),
        otherPercent: share(seconds - listedSeconds),
    };
}

/** Formats a duration the way WakaTime does, such as `16 hrs 5 mins`, `1 hr` or `27 mins`. */
export function formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    if (minutes === 0) {
        return seconds > 0 ? "<1 min" : "0 mins";
    }
    const unit = (count: number, name: string) => `${count} ${name}${count === 1 ? "" : "s"}`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return [hours > 0 ? unit(hours, "hr") : "", rest > 0 ? unit(rest, "min") : ""].filter(Boolean).join(" ");
}

/** Formats a WakaTime timestamp as `13 October`, or `13 October 2026` with the year. */
function formatDate(value: Date | string, withYear: boolean): string {
    return new Date(value).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        ...(withYear ? { year: "numeric" } : {}),
        timeZone: "UTC",
    });
}

/** The covered week as `13 October – 20 October 2026`. */
function dateRange(stats: WakaTime): string {
    return `${formatDate(stats.data.start, false)} – ${formatDate(stats.data.end, true)}`;
}

/**
 * One sentence describing the card, for its `<title>` and the README alt text.
 *
 * @returns For example `Weekly coding stats, 13 October – 20 October 2026: 16 hrs 33 mins of code, 40 hrs 35 mins tracked. Java 8 hrs 51 mins (53.5%)`.
 */
export function statsSummary(stats: WakaTime): string {
    const { seconds, languages } = codeBreakdown(stats);
    const total = stats.data.human_readable_total;
    const tracked = seconds > 0 ? `${formatDuration(seconds)} of code, ${total} tracked.` : `${total} tracked.`;
    const base = `Weekly coding stats, ${dateRange(stats)}: ${tracked}`;
    const listed = languages.map(lang => `${lang.name} ${lang.text} (${lang.percent.toFixed(1)}%)`).join(", ");
    return listed ? `${base} ${listed}` : base;
}

/** The colour a language's bar and logo are drawn in. */
function languageColour(name: string, theme: ThemeName): string {
    return brandColour(findIcon(name), theme, "accent");
}

/**
 * Draws the stacked bar across the full width: each listed language's share of coding time, in
 * order, then the unlisted code languages as one muted segment.
 */
function summaryBar(breakdown: CodeBreakdown, theme: ThemeName): string {
    const width = STATS_WIDTH - 2 * INSET;
    const segments = [
        ...breakdown.languages.map(lang => ({ percent: lang.percent, fill: languageColour(lang.name, theme), opacity: 1 })),
        { percent: breakdown.otherPercent, fill: THEMES[theme].muted, opacity: 0.5 },
    ];
    let x = INSET;
    return segments.filter(segment => segment.percent > 0).map((segment, i) => {
        const span = (width * segment.percent) / 100;
        // A 2px gap separates segments; a sliver too thin for that is drawn at zero width.
        const opacity = segment.opacity < 1 ? ` fill-opacity="${segment.opacity}"` : "";
        const rect = `<rect class="grow" style="animation-delay:${i * 60}ms" x="${x.toFixed(1)}" y="${SUMMARY_Y}" width="${Math.max(span - 2, 0).toFixed(1)}" height="${SUMMARY_HEIGHT}" rx="3" fill="${segment.fill}"${opacity}/>`;
        x += span;
        return rect;
    }).join("\n");
}

/** Draws one language row: logo, name, bar, time and percentage. */
function languageRow(lang: LanguageShare, index: number, theme: ThemeName): string {
    const { text, muted, track } = THEMES[theme];
    const y = FIRST_ROW_Y + index * ROW_HEIGHT;
    const colour = languageColour(lang.name, theme);
    const icon = findIcon(lang.name);
    const glyph = icon
        ? `<g transform="translate(${INSET} ${y - 13})">${iconGlyph(icon, ICON_SIZE, colour)}</g>`
        : `<circle cx="${INSET + ICON_SIZE / 2}" cy="${y - 4}" r="${ICON_SIZE / 2 - 1}" fill="none" stroke="${colour}" stroke-width="2"/>`;
    // A non-zero share keeps a visible stub, so a small language still shows a bar.
    const fill = Math.max((BAR_WIDTH * lang.percent) / 100, 4);
    return `<g class="row" style="animation-delay:${200 + index * 70}ms">${glyph}`
        + `<text x="${NAME_X}" y="${y}" font-size="14" font-weight="600" fill="${text}">${escapeXml(lang.name)}</text>`
        + `<rect x="${BAR_X}" y="${y - 10}" width="${BAR_WIDTH}" height="8" rx="4" fill="${track}"/>`
        + `<rect class="grow" style="animation-delay:${260 + index * 70}ms" x="${BAR_X}" y="${y - 10}" width="${fill.toFixed(1)}" height="8" rx="4" fill="${colour}"/>`
        + `<text x="${STATS_WIDTH - INSET - 70}" y="${y}" text-anchor="end" font-size="13" fill="${muted}">${escapeXml(lang.text)}</text>`
        + `<text x="${STATS_WIDTH - INSET}" y="${y}" text-anchor="end" font-size="13" font-weight="600" fill="${text}">${lang.percent.toFixed(1)}%</text>`
        + `</g>`;
}

/**
 * Renders the stats card for one theme.
 *
 * @remarks
 * The card's own border starts at the left edge of the image, so it lines up with the README
 * heading above it. Bars grow in and rows fade in, except for viewers who ask for reduced motion;
 * a renderer without CSS animation shows the final state at once.
 *
 * @param stats - A validated WakaTime response.
 * @param theme - Which GitHub theme the colours are for.
 * @returns A complete SVG document.
 */
export function renderStatsCard(stats: WakaTime, theme: ThemeName): string {
    const { surface, border, text, muted } = THEMES[theme];
    const breakdown = codeBreakdown(stats);
    const { languages } = breakdown;
    const body = languages.length > 0
        ? [summaryBar(breakdown, theme), ...languages.map((lang, i) => languageRow(lang, i, theme))]
        : [`<text x="${INSET}" y="${FIRST_ROW_Y - 10}" font-size="14" fill="${muted}">No code tracked this week.</text>`];
    const height = FIRST_ROW_Y + Math.max(languages.length - 1, 0) * ROW_HEIGHT + 30;

    return [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${STATS_WIDTH}" height="${height}" viewBox="0 0 ${STATS_WIDTH} ${height}" role="img" aria-labelledby="title">`,
        `<title id="title">${escapeXml(statsSummary(stats))}</title>`,
        "<style>",
        `text { font-family: ${FONT_STACK}; }`,
        // `backwards` applies the first keyframe only while an animation runs, so a renderer that
        // ignores CSS animation still shows full bars.
        ".grow { transform-box: fill-box; transform-origin: left center; animation: grow 700ms cubic-bezier(.2,.8,.2,1) backwards; }",
        ".row { animation: fade 400ms ease-out backwards; }",
        "@keyframes grow { from { transform: scaleX(0); } }",
        "@keyframes fade { from { opacity: 0; } }",
        "@media (prefers-reduced-motion: reduce) { .grow, .row { animation: none; } }",
        "</style>",
        `<rect x="0.5" y="0.5" width="${STATS_WIDTH - 1}" height="${height - 1}" rx="14" fill="${surface}" stroke="${border}"/>`,
        `<text x="${INSET}" y="40" font-size="12" font-weight="600" letter-spacing="1.2" fill="${muted}">LAST 7 DAYS</text>`,
        `<text x="${INSET}" y="66" font-size="15" fill="${text}">${escapeXml(dateRange(stats))}</text>`,
        `<text x="${STATS_WIDTH - INSET}" y="44" text-anchor="end" font-size="28" font-weight="700" fill="${text}">${escapeXml(formatDuration(breakdown.seconds))}</text>`,
        `<text x="${STATS_WIDTH - INSET}" y="66" text-anchor="end" font-size="12" fill="${muted}">of code, ${escapeXml(stats.data.human_readable_total)} tracked in total</text>`,
        ...body,
        "</svg>",
        "",
    ].join("\n");
}
