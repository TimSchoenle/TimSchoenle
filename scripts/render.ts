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

import * as simpleIcons from "simple-icons";
import { RenderArea, type Language, type Profile, type WakaTime } from "./types";

/** One skill entry. The three generated skill interfaces are structurally identical. */
type Skill = Language;

/** A Simple Icons entry, as far as badge rendering needs it. */
interface Icon {
    readonly title: string;
    readonly slug: string;
}

/** Skills below this confidence get no badge and no mention. */
const CONFIDENCE_THRESHOLD = 0.55;

/** The render area that decides which skills get a badge. The rest of the threshold-passing skills go under "Also worked with". */
const BADGE_AREA = RenderArea.Resume;

/** How many skills "Ask me about" names. */
const ASK_ME_ABOUT_COUNT = 3;

const BADGE_COLOR = "24292e";

/**
 * Skill names whose Simple Icons title is a different name for the same thing. Matching is by
 * title, case-insensitive, after a trailing parenthesised qualifier is dropped.
 */
const ICON_TITLE_ALIASES: Readonly<Record<string, string>> = {
    "ArgoCD": "Argo",
    "Talos Linux": "Talos",
    "TimescaleDB": "Timescale",
};

/** WakaTime "languages" that are prose or configuration, not code. */
const NON_CODE_LANGUAGES: ReadonlySet<string> = new Set([
    "CSV", "Git Config", "INI", "JSON", "Markdown", "Other", "Text", "TOML", "XML", "YAML",
]);

/** How many WakaTime languages the stats block lists. */
const WAKATIME_LANGUAGE_COUNT = 5;

/** Bar width of the WakaTime stats block, in characters. */
const PROGRESS_BAR_LENGTH = 25;

/** Every Simple Icons entry, keyed by lowercased title. */
const ICONS_BY_TITLE: ReadonlyMap<string, Icon> = new Map(
    Object.values(simpleIcons).map((icon: Icon) => [icon.title.toLowerCase(), icon]),
);

/**
 * Finds the Simple Icons entry for a skill name.
 *
 * @returns The entry, or `undefined` when Simple Icons has none, in which case the badge is drawn
 * without a logo.
 */
export function findIcon(name: string): Icon | undefined {
    const title = ICON_TITLE_ALIASES[name] ?? name.replace(/\s*\(.*\)\s*$/, "");
    return ICONS_BY_TITLE.get(title.toLowerCase());
}

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

/** Renders one skill as a Shields badge, with its Simple Icons logo when one exists. */
function skillBadge(name: string): string {
    const icon = findIcon(name);
    const logo = icon ? `&logo=${encodeURIComponent(icon.slug)}&logoColor=white` : "";
    return `![${escapeLinkText(name)}](https://img.shields.io/badge/${shieldsSegment(name)}-${BADGE_COLOR}?style=flat-square${logo})`;
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

/** Orders skills by confidence, highest first. Ties keep the API's order. */
function byConfidence(skills: readonly Skill[]): Skill[] {
    return skills.toSorted((a, b) => b.confidence - a.confidence);
}

/** Skills at or above {@link CONFIDENCE_THRESHOLD} that `inArea` accepts, by confidence. */
function selectSkills(skills: readonly Skill[], inArea: boolean): Skill[] {
    return byConfidence(skills.filter(s => s.confidence >= CONFIDENCE_THRESHOLD && s.renderArea.includes(BADGE_AREA) === inArea));
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

/** Lists the threshold-passing skills that have no badge, as a collapsed block, or nothing when there are none. */
function alsoWorkedWith(profile: Profile): string {
    const rows = [
        ["Languages", profile.skills.languages],
        ["Frameworks & Libraries", profile.skills.frameworks],
        ["Infrastructure & Tools", profile.skills.infrastructure],
    ] as const;

    const lines = rows
        .map(([label, skills]) => [label, selectSkills(skills, false)] as const)
        .filter(([, skills]) => skills.length > 0)
        .map(([label, skills]) => `**${label}:** ${skills.map(s => s.name).join(", ")}`);

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
    const { languages, frameworks, infrastructure } = profile.skills;
    const badges = (skills: readonly Skill[]) => selectSkills(skills, true).map(s => skillBadge(s.name)).join(" ");
    const topSkills = selectSkills([...languages, ...frameworks, ...infrastructure], true)
        .slice(0, ASK_ME_ABOUT_COUNT)
        .map(s => `**${s.name}**`);

    const readme = fillTemplate(template, {
        FULL_NAME: profile.fullName,
        TITLE: profile.title,
        LOCATION: profile.location,
        ASK_ME_ABOUT: joinProse(topSkills),
        CONTACT_BADGES: contactBadges(profile),
        SKILLS_LANGUAGES: badges(languages),
        SKILLS_FRAMEWORKS: badges(frameworks),
        SKILLS_INFRASTRUCTURE: badges(infrastructure),
        ALSO_WORKED_WITH: alsoWorkedWith(profile),
        WAKATIME_STATS: wakaTime ? wakaTimeStats(wakaTime) : "<!-- WakaTime API unavailable -->",
    });

    // An empty section leaves a run of blank lines behind.
    return `${readme.replaceAll(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}
