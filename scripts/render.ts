/**
 * Turns the profile and WakaTime data into the text of `README.md`. Pure: no I/O, no clock.
 *
 * @remarks
 * Every placeholder the template may use is a key of the map built in {@link renderReadme}.
 * {@link fillTemplate} throws on a placeholder with no value and on a value no placeholder uses,
 * so the template and this file cannot drift apart silently.
 *
 * @packageDocumentation
 */

import { byConfidence, skillGroups } from "./skills";
import { TECH_STACK_ASSETS, TECH_STACK_WIDTH } from "./tech-stack";
import type { Profile, WakaTime } from "./types";

/** How many skills "Ask me about" names. */
const ASK_ME_ABOUT_COUNT = 3;

const BADGE_COLOR = "24292e";

/** WakaTime "languages" that are prose or configuration, not code. */
const NON_CODE_LANGUAGES: ReadonlySet<string> = new Set([
    "CSV", "Git Config", "INI", "JSON", "Markdown", "Other", "Text", "TOML", "XML", "YAML",
]);

/** How many WakaTime languages the stats block lists. */
const WAKATIME_LANGUAGE_COUNT = 5;

/** Bar width of the WakaTime stats block, in characters. */
const PROGRESS_BAR_LENGTH = 25;

/**
 * Encodes text for one segment of a Shields static badge path.
 *
 * @remarks
 * Shields reads `-` as the segment separator and `_` as a space, so both are doubled before
 * percent-encoding. Without this, `Cert-Manager` renders as a badge reading `Cert` in colour
 * `Manager`.
 */
export function shieldsSegment(text: string): string {
    return encodeURIComponent(text.replaceAll("-", "--").replaceAll("_", "__"));
}

/** Escapes the characters that end or nest markdown link and image text. */
function escapeLinkText(text: string): string {
    return text.replaceAll(/[\\[\]]/g, "\\$&");
}

/** Percent-encodings for the two destination delimiters `encodeURIComponent` does not encode. */
const PAREN_ENCODINGS: Readonly<Record<string, string>> = { "(": "%28", ")": "%29" };

/**
 * Percent-encodes the characters that end a markdown link destination or split it into a title.
 * The result is the same URL to a browser.
 */
export function escapeLinkDestination(href: string): string {
    // encodeURIComponent leaves parentheses alone, so those two are spelled out; everything else
    // goes through it to get the UTF-8 encoding of non-ASCII whitespace such as U+00A0.
    return href.replaceAll(/[()<>\s]/g, char => PAREN_ENCODINGS[char] ?? encodeURIComponent(char));
}

/** Renders a badge reading `label` that links to `href`. */
function linkBadge(label: string, href: string): string {
    return `[![${escapeLinkText(label)}](https://img.shields.io/badge/${shieldsSegment(label)}-${BADGE_COLOR}?style=for-the-badge)](${escapeLinkDestination(href)})`;
}

/** Joins items as English prose: `a`, `a and b`, `a, b and c`. */
function joinProse(items: readonly string[]): string {
    if (items.length <= 1) {
        return items.join("");
    }
    return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** The contact row: website, LinkedIn when the profile has one, and email. */
function contactBadges(profile: Profile): string {
    const badges = [linkBadge("Website", profile.website)];
    if (profile.socials.linkedin) {
        badges.push(linkBadge("LinkedIn", profile.socials.linkedin));
    }
    badges.push(linkBadge("Email", `mailto:${profile.email}`));
    return badges.join(" ");
}

/** Escapes text for a double-quoted HTML attribute. */
function escapeHtmlAttribute(text: string): string {
    return text.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/**
 * The tech stack image, switching with the viewer's GitHub theme.
 *
 * @remarks
 * The `<img>` is what renderers without `<picture>` support show, and its alt text is what screen
 * readers announce, so it names every skill the image draws.
 */
function techStackImage(profile: Profile): string {
    const names = skillGroups(profile, true).flatMap(g => g.skills.map(s => s.name));
    const alt = escapeHtmlAttribute(`Tech stack: ${names.join(", ")}`);
    return [
        "<picture>",
        `  <source media="(prefers-color-scheme: dark)" srcset="${TECH_STACK_ASSETS.dark}">`,
        `  <source media="(prefers-color-scheme: light)" srcset="${TECH_STACK_ASSETS.light}">`,
        `  <img alt="${alt}" src="${TECH_STACK_ASSETS.light}" width="${TECH_STACK_WIDTH}">`,
        "</picture>",
    ].join("\n");
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

/** Pads `text` to `width`, or cuts it to `width` with a trailing ellipsis. */
function fitWidth(text: string, width: number): string {
    return text.length > width ? `${text.substring(0, width - 1)}…` : text.padEnd(width);
}

/** Draws `percent` (0 to 100) as a bar {@link PROGRESS_BAR_LENGTH} characters wide. */
function progressBar(percent: number): string {
    const filled = Math.round((PROGRESS_BAR_LENGTH * percent) / 100);
    return "█".repeat(filled) + "░".repeat(PROGRESS_BAR_LENGTH - filled);
}

/**
 * Formats a week of WakaTime data as a fenced `txt` block.
 *
 * @remarks
 * Prose and configuration entries ({@link NON_CODE_LANGUAGES}) are left out of the list but not
 * out of the total, so each percentage stays the share of all tracked time.
 */
function wakaTimeStats(stats: WakaTime): string {
    const { start, end, human_readable_total, languages } = stats.data;
    const format = (date: Date | string) =>
        new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

    const rows = languages
        .filter(lang => !NON_CODE_LANGUAGES.has(lang.name))
        .slice(0, WAKATIME_LANGUAGE_COUNT)
        .map(lang => `${fitWidth(lang.name, 20)}  ${fitWidth(lang.text, 14)}   ${progressBar(lang.percent)}   ${lang.percent.toFixed(2).padStart(5)} %`);

    return [
        "```txt",
        `From: ${format(start)} - To: ${format(end)}`,
        "",
        `Total Time: ${human_readable_total}`,
        "",
        ...rows,
        "```",
    ].join("\n");
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
 * @param wakaTime - Seven days of WakaTime stats, or `null` when that call failed.
 * @returns The README text, ending in exactly one newline.
 */
export function renderReadme(template: string, profile: Profile, wakaTime: WakaTime | null): string {
    const topSkills = byConfidence(skillGroups(profile, true).flatMap(g => g.skills))
        .slice(0, ASK_ME_ABOUT_COUNT)
        .map(s => `**${s.name}**`);

    const readme = fillTemplate(template, {
        FULL_NAME: profile.fullName,
        TITLE: profile.title,
        LOCATION: profile.location,
        ASK_ME_ABOUT: joinProse(topSkills),
        CONTACT_BADGES: contactBadges(profile),
        TECH_STACK: techStackImage(profile),
        ALSO_WORKED_WITH: alsoWorkedWith(profile),
        WAKATIME_STATS: wakaTime ? wakaTimeStats(wakaTime) : "<!-- WakaTime API unavailable -->",
    });

    // An empty section leaves a run of blank lines behind.
    return `${readme.replaceAll(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}
