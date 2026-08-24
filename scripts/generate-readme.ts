/**
 * Renders the GitHub profile page from `templates/README.md.template`.
 *
 * @remarks
 * `README.md` in this repository is the profile page, and this script is its only writer.
 * `.github/workflows/update-profile.yml` runs it at midnight UTC and commits whatever changed, so
 * an edit made to `README.md` by hand lasts until the next run.
 *
 * A skill reaches a badge row by being marked `resume` in the profile document at
 * `tim-schoenle.de/api/v1/profile` and scoring at least 0.55 confidence, so the rows change
 * without an edit to this script or the template. WakaTime needs a key; the profile API does not.
 * Its section is allowed to fail: a week of tracked time is worth less than the rest of the page.
 *
 * Layout is not in this file. A new section on the page means a placeholder in the template and a
 * matching `replaceAll` in {@link main}. Nothing checks that the two agree, and a placeholder with
 * no `replaceAll` is committed to the profile verbatim.
 *
 * @packageDocumentation
 */

import { file, write } from "bun";
import {type Profile, RenderArea, type WakaTime} from "./types";

const PROFILE_API_URL = "https://tim-schoenle.de/api/v1/profile";
const WAKATIME_API_URL = "https://wakatime.com/api/v1/users/current/stats/last_7_days";

/**
 * Fetches the profile document the portfolio site publishes.
 *
 * @remarks
 * The body is cast, not validated. A field the API stops sending reaches the profile page as the
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
 * Fetches seven days of tracked coding time for the account behind `WAKATIME_API_KEY`.
 *
 * @throws If `WAKATIME_API_KEY` is unset or empty, or the endpoint answers with a non-2xx status.
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

/**
 * Draws `percent`, on a scale of 0 to 100, as a bar exactly `length` characters wide, `█` filled
 * and `░` empty.
 *
 * @remarks
 * The filled count is rounded, so at the default width a language under 2 percent draws an empty bar.
 */
function generateProgressBar(percent: number, length: number = 25): string {
    const filledChars = Math.round((length * percent) / 100);
    const emptyChars = length - filledChars;

    const full = '█';
    const empty = '░';

    return full.repeat(filledChars) + empty.repeat(emptyChars);
}

/** Formats `stats.data` as a fenced `txt` block: the date range, the total, then the first five languages. */
function formatWakaTimeStats(stats: WakaTime): string {
    const { start, end, human_readable_total, languages } = stats.data;

    const startDate = new Date(start).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const endDate = new Date(end).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    let output = "```txt\n";
    output += `From: ${startDate} - To: ${endDate}\n\n`;
    output += `Total Time: ${human_readable_total}\n\n`;

    const topLanguages = languages.slice(0, 5);

    for (const lang of topLanguages) {
        // Both branches leave the field at the same width, so every bar starts at the same column
        // however long the language name is.
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
 * Writes `README.md` from the template, the profile, and the WakaTime section when that call
 * answered.
 *
 * @remarks
 * Both the template and the output are resolved against the process working directory, so this
 * runs from the repository root and nowhere else. A WakaTime failure leaves an HTML comment where
 * its section would be; a profile failure aborts before `README.md` is touched.
 *
 * @throws If the profile cannot be fetched, or `templates/README.md.template` is missing.
 */
async function main() {
    console.log("Fetching data...");
    const [profile, wakaTime] = await Promise.all([
        fetchProfileData(),
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
    // Reads the unfiltered list, so the winner can be a language no badge above it shows.
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

