/**
 * Runtime check for the profile document, so a changed API fails the run instead of reaching the
 * profile page as the text `undefined`.
 *
 * @remarks
 * `scripts/types.ts` describes the document at compile time only; `fetch` returns `unknown` data.
 * This checks the fields the README reads, no more. A failed check aborts before `README.md` is
 * written, so the page keeps its last good render.
 *
 * @packageDocumentation
 */

import { RenderArea, type Profile } from "./types";

const RENDER_AREAS: ReadonlySet<string> = new Set(Object.values(RenderArea));

/** Narrows `value` to a plain object, or throws naming `path`. */
function asObject(value: unknown, path: string): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new TypeError(`Profile field ${path} is not an object`);
    }
    return value as Record<string, unknown>;
}

/** Throws naming `path` unless `value` is a non-empty string. */
function assertString(value: unknown, path: string): void {
    if (typeof value !== "string" || value.length === 0) {
        throw new TypeError(`Profile field ${path} is not a non-empty string`);
    }
}

/** Throws naming `path` unless `value` is an array of skills with a known render area. */
function assertSkills(value: unknown, path: string): void {
    if (!Array.isArray(value)) {
        throw new TypeError(`Profile field ${path} is not an array`);
    }
    value.forEach((entry, index) => {
        const skill = asObject(entry, `${path}[${index}]`);
        assertString(skill.name, `${path}[${index}].name`);
        if (typeof skill.confidence !== "number" || !Number.isFinite(skill.confidence)) {
            throw new TypeError(`Profile field ${path}[${index}].confidence is not a number`);
        }
        const areas = skill.renderArea;
        if (!Array.isArray(areas) || !areas.every(area => typeof area === "string" && RENDER_AREAS.has(area))) {
            throw new TypeError(`Profile field ${path}[${index}].renderArea has an unknown value`);
        }
    });
}

/**
 * Checks that `data` has every field the README reads, with the right type.
 *
 * @param data - The parsed response body.
 * @returns `data`, typed as a {@link Profile}.
 * @throws TypeError naming the first field that is missing or has the wrong type.
 */
export function parseProfile(data: unknown): Profile {
    const profile = asObject(data, "<root>");
    for (const key of ["email", "fullName", "location", "name", "title", "website"] as const) {
        assertString(profile[key], key);
    }

    const socials = asObject(profile.socials, "socials");
    assertString(socials.github, "socials.github");
    assertString(socials.githubUsername, "socials.githubUsername");
    if (socials.linkedin !== undefined && socials.linkedin !== null) {
        assertString(socials.linkedin, "socials.linkedin");
    }

    const skills = asObject(profile.skills, "skills");
    for (const key of ["languages", "frameworks", "infrastructure"] as const) {
        assertSkills(skills[key], `skills.${key}`);
    }

    return data as Profile;
}
