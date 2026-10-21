/**
 * Renders the GitHub profile page from `templates/README.md.template`.
 *
 * @remarks
 * `README.md` in this repository is the profile page, and this script is its only writer.
 * `.github/workflows/update-profile.yml` runs it at midnight UTC and commits whatever changed, so
 * an edit made to `README.md` by hand lasts until the next run.
 *
 * This file fetches and writes; `render.ts` decides what the page says, and `contact-buttons.ts`,
 * `tech-stack.ts` and `stats-card.ts` draw its images, one SVG per GitHub theme under `assets/`.
 * The workflow commits those with the README. Skills, contact links and "Ask me about" all come
 * from the profile document at `tim-schoenle.de/api/v1/profile`, so the page changes without an
 * edit here. WakaTime needs a key; the profile API does not.
 *
 * The stats card is allowed to fail: a week of tracked time is worth less than the rest of the
 * page. When WakaTime does not answer, the previous card stays in place, and its date range says
 * how old it is.
 *
 * @packageDocumentation
 */

import { mkdir, readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { file, write } from "bun";
import { parseProfile } from "./profile";
import { contactAsset, contactLinks, renderContactButton } from "./contact-buttons";
import { renderReadme, type StatsImage } from "./render";
import { skillGroups } from "./skills";
import { renderStatsCard, STATS_ASSET, statsSummary } from "./stats-card";
import { assertUniqueSlugs, renderSkillTile, SKILL_TILE_DIR, skillTileAsset, tileRows } from "./tech-stack";
import { THEME_NAMES, themedAsset } from "./theme";
import { parseWakaTime } from "./wakatime";
import type { Profile, WakaTime } from "./types";

const PROFILE_API_URL = "https://tim-schoenle.de/api/v1/profile";
const WAKATIME_API_URL = "https://wakatime.com/api/v1/users/current/stats/last_7_days";

/**
 * Sent on every request so the caller is identifiable in the site's and WakaTime's logs and in a
 * Cloudflare rule, instead of the runtime default `Bun/<version>`.
 */
const REQUEST_HEADERS: Readonly<Record<string, string>> = {
    "Accept": "application/json",
    "User-Agent": "TimSchoenle-profile-readme (+https://github.com/TimSchoenle/TimSchoenle)",
};

/** Characters of a failed response's body quoted in the error, enough to identify an HTML block page. */
const ERROR_BODY_PREVIEW_LENGTH = 200;

/**
 * Describes a non-2xx response in one line: status, the Cloudflare headers that say whether the
 * edge or the origin refused, and the start of the body.
 *
 * @remarks
 * `cf-mitigated: challenge` means a Cloudflare bot or WAF challenge stopped the request at the edge
 * and the origin never saw it; `cf-ray` is the id to look the event up by in Security Events. The
 * request URL is deliberately left out, because the WakaTime URL carries the API key.
 *
 * @param response - The failed response. Its body is consumed.
 * @returns The status line, the Cloudflare headers present, and up to
 * {@link ERROR_BODY_PREVIEW_LENGTH} characters of the body with whitespace collapsed.
 */
async function describeFailedResponse(response: Response): Promise<string> {
    const parts = [`${response.status} ${response.statusText}`];
    for (const header of ["cf-mitigated", "cf-ray", "server"]) {
        const value = response.headers.get(header);
        if (value) {
            parts.push(`${header}=${value}`);
        }
    }
    const body = await response.text().catch(() => "");
    const preview = body.replaceAll(/\s+/g, " ").trim().slice(0, ERROR_BODY_PREVIEW_LENGTH);
    if (preview) {
        parts.push(`body: ${preview}`);
    }
    return parts.join(", ");
}

/**
 * Fetches the profile document the portfolio site publishes.
 *
 * @throws If the endpoint answers with a non-2xx status, or the body fails {@link parseProfile}.
 */
async function fetchProfileData(): Promise<Profile> {
    const response = await fetch(PROFILE_API_URL, { headers: REQUEST_HEADERS });
    if (!response.ok) {
        throw new Error(`Failed to fetch profile data: ${await describeFailedResponse(response)}`);
    }
    return parseProfile(await response.json());
}

/**
 * Fetches seven days of tracked coding time for the account behind `WAKATIME_API_KEY`.
 *
 * @throws If `WAKATIME_API_KEY` is unset or empty, or the endpoint answers with a non-2xx status.
 */
async function fetchWakaTimeData(): Promise<WakaTime> {
    const apiKey = process.env.WAKATIME_API_KEY;
    if (!apiKey) {
        throw new Error("WAKATIME_API_KEY is not defined");
    }

    const response = await fetch(`${WAKATIME_API_URL}?api_key=${apiKey}`, { headers: REQUEST_HEADERS });

    if (!response.ok) {
        throw new Error(`Failed to fetch WakaTime data: ${await describeFailedResponse(response)}`);
    }
    return parseWakaTime(await response.json());
}

/**
 * Deletes tiles of skills that left the profile.
 *
 * @remarks
 * Only files directly in `assets/skills/` are considered, and that directory holds nothing but
 * tiles this script writes, so nothing else can be removed.
 *
 * @param keep - Paths written by this run, as `themedAsset` returns them.
 */
async function pruneSkillTiles(keep: ReadonlySet<string>): Promise<void> {
    const dir = join("assets", SKILL_TILE_DIR);
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
        const path = `${dir}/${entry.name}`;
        if (entry.isFile() && entry.name.endsWith(".svg") && !keep.has(path)) {
            console.log(`Removing stale ${path}...`);
            await rm(path);
        }
    }
}

/**
 * The stats card a previous run left behind, for a run where WakaTime did not answer.
 *
 * @returns The card with generic alt text, since the data behind it is gone, or `null` when no
 * earlier run wrote one for every theme.
 */
async function previousStatsImage(): Promise<StatsImage | null> {
    const present = await Promise.all(THEME_NAMES.map(theme => file(themedAsset(STATS_ASSET, theme)).exists()));
    return present.every(Boolean) ? { alt: "Weekly coding stats from the last successful update" } : null;
}

/**
 * Writes every image and `README.md` from the template, the profile, and the WakaTime
 * section when that call answered.
 *
 * @remarks
 * The template and every output are resolved against the process working directory, so this
 * runs from the repository root and nowhere else. A WakaTime failure keeps the previous stats card
 * (see {@link previousStatsImage}); a profile failure aborts before any file is touched.
 *
 * @throws If the profile cannot be fetched or fails validation, `templates/README.md.template` is
 * missing, or the template and `render.ts` disagree on placeholders.
 */
async function main() {
    console.log("Fetching data...");
    const [profile, wakaTime] = await Promise.all([
        fetchProfileData(),
        fetchWakaTimeData().catch((e: unknown) => {
            console.error("Error fetching WakaTime:", e);
            return null;
        }),
    ]);

    console.log("Rendering...");
    const template = await file("templates/README.md.template").text();
    // Everything is rendered before anything is written, so a render error leaves every file as it was.
    const tiles = skillGroups(profile, true)
        .flatMap(group => tileRows(group.skills))
        .flatMap(row => row.map((skill, position) => ({ skill, position })));
    assertUniqueSlugs(tiles.map(t => t.skill));
    const links = contactLinks(profile);
    const images: (readonly [path: string, svg: string])[] = THEME_NAMES.flatMap(theme => [
        ...tiles.map(({ skill, position }) => [themedAsset(skillTileAsset(skill), theme), renderSkillTile(skill, position, theme)] as const),
        ...links.map(link => [themedAsset(contactAsset(link), theme), renderContactButton(link, theme)] as const),
        ...(wakaTime ? [[themedAsset(STATS_ASSET, theme), renderStatsCard(wakaTime, theme)] as const] : []),
    ]);
    const stats = wakaTime ? { alt: statsSummary(wakaTime) } : await previousStatsImage();
    const readme = renderReadme(template, profile, stats);

    for (const [path, svg] of images) {
        console.log(`Writing ${path}...`);
        await mkdir(dirname(path), { recursive: true });
        await write(path, svg);
    }
    console.log("Writing README.md...");
    await write("README.md", readme);
    await pruneSkillTiles(new Set(images.map(([path]) => path)));
    console.log("Done!");
}

if (import.meta.main) {
    await main();
}

