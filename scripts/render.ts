/**
 * Turns the profile into the text of `README.md`. Pure: no I/O, no clock.
 *
 * @remarks
 * The README is text around generated images: contact buttons, the tech stack, and the weekly
 * stats card. This file writes the markup that points at them; `contact-buttons.ts`,
 * `tech-stack.ts` and `stats-card.ts` draw them.
 *
 * Every placeholder the template may use is a key of the map built in {@link renderReadme}.
 * {@link fillTemplate} throws on a placeholder with no value and on a value no placeholder uses,
 * so the template and this file cannot drift apart silently.
 *
 * @packageDocumentation
 */

import { BUTTON_HEIGHT, buttonWidth, contactAsset, contactLinks } from "./contact-buttons";
import { byConfidence, skillGroups } from "./skills";
import { STATS_ASSET } from "./stats-card";
import { TECH_STACK_ASSET } from "./tech-stack";
import { themedAsset } from "./theme";
import type { Profile } from "./types";

/** What the README says about the stats card. */
export interface StatsImage {
    /** Alt text for the card. */
    readonly alt: string;
}

/**
 * An image's rendered size, as HTML `width`/`height` attribute values: pixels, or a percentage of
 * the README column. A side left out follows the image's aspect ratio.
 */
interface ImageSize {
    readonly width?: number | `${number}%`;
    readonly height?: number;
}

/**
 * Width of the full-width images. They scale with GitHub's README column, so both edges line up with
 * the headings at any page width; being SVG, they stay sharp at any size.
 */
const FULL_WIDTH = "100%";

/** How many skills "Ask me about" names. */
const ASK_ME_ABOUT_COUNT = 3;

/** Percent-encodings for the two URL delimiters `encodeURIComponent` does not encode. */
const PAREN_ENCODINGS: Readonly<Record<string, string>> = { "(": "%28", ")": "%29" };

/**
 * Percent-encodes the characters that could end a link destination or split it into a title. The
 * result is the same URL to a browser.
 */
export function escapeLinkDestination(href: string): string {
    // encodeURIComponent leaves parentheses alone, so those two are spelled out; everything else
    // goes through it to get the UTF-8 encoding of non-ASCII whitespace such as U+00A0.
    return href.replaceAll(/[()<>\s]/g, char => PAREN_ENCODINGS[char] ?? encodeURIComponent(char));
}

/** Escapes text for a double-quoted HTML attribute. */
function escapeHtmlAttribute(text: string): string {
    return text.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/**
 * A `<picture>` that shows the dark or light image `asset` to match the viewer's GitHub theme.
 *
 * @remarks
 * The `<img>` is what renderers without `<picture>` support show, and its alt text is what screen
 * readers announce.
 *
 * @param asset - The asset name, as `themedAsset` takes it.
 * @param alt - Alt text, unescaped.
 * @param size - The image's rendered size, so the page does not shift while it loads.
 * @returns The `<picture>` element on one line.
 */
function themedPicture(asset: string, alt: string, size: ImageSize): string {
    const dimensions = [
        size.width === undefined ? "" : ` width="${size.width}"`,
        size.height === undefined ? "" : ` height="${size.height}"`,
    ].join("");
    return `<picture><source media="(prefers-color-scheme: dark)" srcset="${themedAsset(asset, "dark")}">`
        + `<img alt="${escapeHtmlAttribute(alt)}" src="${themedAsset(asset, "light")}"${dimensions}></picture>`;
}

/** Joins items as English prose: `a`, `a and b`, `a, b and c`. */
function joinProse(items: readonly string[]): string {
    if (items.length <= 1) {
        return items.join("");
    }
    return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** The contact buttons, each its own link, one per line. */
function contactButtons(profile: Profile): string {
    return contactLinks(profile)
        .map(link => {
            const href = escapeHtmlAttribute(escapeLinkDestination(link.href));
            const picture = themedPicture(contactAsset(link), link.label, { width: buttonWidth(link), height: BUTTON_HEIGHT });
            return `<a href="${href}">${picture}</a>`;
        })
        .join("\n");
}

/** The tech stack image. Its alt text names every skill the image draws. */
function techStackImage(profile: Profile): string {
    const names = skillGroups(profile, true).flatMap(g => g.skills.map(s => s.name));
    return themedPicture(TECH_STACK_ASSET, `Tech stack: ${names.join(", ")}`, { width: FULL_WIDTH });
}

/** Lists the threshold-passing skills the image leaves out, as a collapsed block, or nothing when there are none. */
function alsoWorkedWith(profile: Profile): string {
    const lines = skillGroups(profile, false)
        .filter(group => group.skills.length > 0)
        .map(group => `**${group.label}:** ${group.skills.map(s => s.name).join(", ")}`);

    if (lines.length === 0) {
        return "";
    }
    return `<details>\n<summary>Also worked with</summary>\n\n${lines.join("<br>\n")}\n\n</details>`;
}

/**
 * Replaces every `{{KEY}}` in `template` with `values[KEY]`.
 *
 * @throws If the template uses a key `values` lacks, or `values` has a key the template never uses.
 */
export function fillTemplate(template: string, values: Readonly<Record<string, string>>): string {
    const used = new Set<string>();
    const output = template.replaceAll(/\{\{([A-Z_]+)\}\}/g, (_, key: string) => {
        const value = values[key];
        if (value === undefined) {
            throw new Error(`Template placeholder {{${key}}} has no value`);
        }
        used.add(key);
        return value;
    });

    const unused = Object.keys(values).filter(key => !used.has(key));
    if (unused.length > 0) {
        throw new Error(`Template never uses: ${unused.join(", ")}`);
    }
    return output;
}

/**
 * Renders `README.md`.
 *
 * @param template - The contents of `templates/README.md.template`.
 * @param profile - The validated profile document.
 * @param stats - The stats card to reference, or `null` to leave a comment in its place.
 * @returns The README text, ending in exactly one newline.
 */
export function renderReadme(template: string, profile: Profile, stats: StatsImage | null): string {
    const topSkills = byConfidence(skillGroups(profile, true).flatMap(g => g.skills))
        .slice(0, ASK_ME_ABOUT_COUNT)
        .map(s => `**${s.name}**`);

    const readme = fillTemplate(template, {
        FULL_NAME: profile.fullName,
        TITLE: profile.title,
        LOCATION: profile.location,
        ASK_ME_ABOUT: joinProse(topSkills),
        CONTACT_BUTTONS: contactButtons(profile),
        TECH_STACK: techStackImage(profile),
        ALSO_WORKED_WITH: alsoWorkedWith(profile),
        WAKATIME_STATS: stats
            ? themedPicture(STATS_ASSET, stats.alt, { width: FULL_WIDTH })
            : "<!-- WakaTime stats unavailable -->",
    });

    // An empty section leaves a run of blank lines behind.
    return `${readme.replaceAll(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}
