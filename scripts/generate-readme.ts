/**
 * Renders `README.md` from a template and two live APIs.
 *
 * @remarks
 * The rendered file is the GitHub profile page. `.github/workflows/update-profile.yml` runs this
 * at midnight UTC and commits whatever changed, so an edit made to `README.md` by hand survives until
 * the next run and no longer. The layout lives in `templates/README.md.template`; adding a section
 * means a placeholder there and a `replaceAll` in {@link main}.
 *
 * The badge rows are the `RenderArea.Resume` skills from `https://tim-schoenle.de/api/v1/profile`,
 * the same list the site's own resume renders.
 *
 * @packageDocumentation
 */

import { file, write } from "bun";
import {type Profile, RenderArea, type WakaTime} from "./types";

const PROFILE_API_URL = "https://tim-schoenle.de/api/v1/profile";
const WAKATIME_API_URL = "https://wakatime.com/api/v1/users/current/stats/last_7_days";

/**
 * Fetches the profile the portfolio site publishes.
 *
 * @remarks
 * The body is cast, not validated: a field renamed upstream is published into the README as the
 * literal text `undefined`.
 *
 * @throws If the endpoint answers with a non-2xx status.
 */
async function fetchProfileData(): Promise<Profile> {
    const response = await fetch(PROFILE_API_URL);
    if (!response.ok) {
        throw new Error(`Failed to fetch profile data: ${response.statusText}`);
    }
    return response.json().then(data => data as Profile);
}

/**
 * Fetches the last seven days of tracked coding time for the account that owns the API key.
 *
 * @throws If `WAKATIME_API_KEY` is unset, or the endpoint answers with a non-2xx status.
 */
async function fetchWakaTimeData(): Promise<WakaTime> {
    const apiKey = process.env.WAKATIME_API_KEY;
    if (!apiKey) {
        throw new Error("WAKATIME_API_KEY is not defined");
    }

    const response = await fetch(`${WAKATIME_API_URL}?api_key=${apiKey}`);

    if (!response.ok) {
        throw new Error(`Failed to fetch WakaTime data: ${response.statusText}`);
    }
    return response.json().then(data => data as WakaTime);
}

/** Draws `percent`, on a scale of 0 to 100, as a bar of `length` characters. */
function generateProgressBar(percent: number, length: number = 25): string {
    const filledChars = Math.round((length * percent) / 100);
    const emptyChars = length - filledChars;

    const full = '█';
    const empty = '░';

    return full.repeat(filledChars) + empty.repeat(emptyChars);
}

/**
 * Formats the first five entries of `stats.data.languages` as a fenced `txt` block, one row each.
 *
 * @remarks
 * Names come out at exactly 20 characters and durations at 14.
 */
function formatWakaTimeStats(stats: WakaTime): string {
    const { start, end, human_readable_total, languages } = stats.data;

    const startDate = new Date(start).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const endDate = new Date(end).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    let output = "```txt\n";
    output += `From: ${startDate} - To: ${endDate}\n\n`;
    output += `Total Time: ${human_readable_total}\n\n`;

    const topLanguages = languages.slice(0, 5);

    for (const lang of topLanguages) {
        // Fixed width in both branches: the bars start at the same column whatever the name is.
        let name = lang.name;
        if (name.length > 20) {
            name = name.substring(0, 19) + "…";
        }
        else {
            name = name.padEnd(20);
        }

        let text = lang.text;
        if (text.length > 14) {
            text = text.substring(0, 13) + "…";
        }
        else {
            text = text.padEnd(14);
        }

        const bar = generateProgressBar(lang.percent);
        const percent = lang.percent.toFixed(2).padStart(5);
        output += `${name}  ${text}   ${bar}   ${percent} %\n`;
    }

    output += "```";
    return output;
}

/**
 * Writes `README.md`, resolving it and the template against the process working directory.
 *
 * @remarks
 * WakaTime is allowed to fail: its section becomes an HTML comment and the page is written anyway.
 * A failed profile fetch aborts before anything is written.
 *
 * @throws If the profile cannot be fetched, or `templates/README.md.template` is missing.
 */
async function main() {
    console.log("Fetching data...");
    const [profile, wakaTime] = await Promise.all([
        fetchProfileData(),
        // A week of time tracking is worth less than the rest of the page, so an outage here
        // degrades one section instead of failing the daily run.
        fetchWakaTimeData().catch(e => {
            console.error("Error fetching WakaTime:", e);
            return null;
        })
    ]);

    if (!profile) {
        throw new Error("Could not load profile data");
    }

    console.log("Processing template...");
    const template = await file("templates/README.md.template").text();

    // Applies on top of the resume filter below; it was 0.7 before that filter existed.
    const confidenceThreshold = 0.55;
    const processSkills = (skills: { name: string; confidence: number; renderArea: RenderArea[] }[]) =>
        skills
            .filter(s => s.confidence >= confidenceThreshold)
            .filter(s => s.renderArea.includes(RenderArea.Resume))
            .sort((a, b) => b.confidence - a.confidence)
            .map(s => {
                return `![${s.name}](https://img.shields.io/badge/${encodeURIComponent(s.name)}-24292e?style=flat-square&logo=${encodeURIComponent(s.name.toLowerCase().replaceAll(/\s+/g, ''))}&logoColor=white)`;
            })
            .join(" ");

    const languages = processSkills(profile.skills.languages);
    const frameworks = processSkills(profile.skills.frameworks);
    const infrastructure = processSkills(profile.skills.infrastructure);
    const wakaTimeStats = wakaTime ? formatWakaTimeStats(wakaTime) : "<!-- WakaTime API unavailable -->";
    const topSkill = profile.skills.languages.toSorted((a, b) => b.confidence - a.confidence)[0]?.name || "Java";

    const readme = template
        .replaceAll("{{NAME}}", profile.name)
        .replaceAll("{{EMAIL}}", profile.email)
        .replaceAll("{{GITHUB_URL}}", profile.socials.github)
        .replaceAll("{{ASK_ME_ABOUT}}", topSkill)
        .replaceAll("{{SKILLS_LANGUAGES}}", languages)
        .replaceAll("{{SKILLS_FRAMEWORKS}}", frameworks)
        .replaceAll("{{SKILLS_INFRASTRUCTURE}}", infrastructure)
        .replaceAll("{{WAKATIME_STATS}}", wakaTimeStats)
        .replaceAll("{{TITLE}}", profile.title)
        .replaceAll("{{LOCATION}}", profile.location)
        .replaceAll("{{WEBSITE}}", profile.website);

    console.log("Writing README.md...");
    await write("README.md", readme);
    console.log("Done!");
}

if (import.meta.main) {
    await main();
}

