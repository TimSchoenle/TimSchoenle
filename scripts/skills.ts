/**
 * Which skills the profile page shows, and how they are grouped and ranked.
 *
 * @remarks
 * The README text (`render.ts`) and the tech stack image (`tech-stack.ts`) both read skills
 * through this module, so the two cannot disagree about which skills count.
 *
 * @packageDocumentation
 */

import { RenderArea, type Language, type Profile } from "./types";

/** One skill entry. The three generated skill interfaces are structurally identical. */
export type Skill = Language;

/** A category of skills, already filtered and ranked. */
export interface SkillGroup {
    readonly label: string;
    readonly skills: readonly Skill[];
}

/** Skills below this confidence are not shown anywhere. */
export const CONFIDENCE_THRESHOLD = 0.55;

/** Skills at or above this confidence are drawn as core skills; the rest as proficient. */
export const CORE_CONFIDENCE = 0.8;

/**
 * The render area that puts a skill in the tech stack image. Threshold-passing skills outside it
 * are listed under "Also worked with".
 */
export const SHOWCASE_AREA = RenderArea.Resume;

/** Orders skills by confidence, highest first. Ties keep the API's order. */
export function byConfidence(skills: readonly Skill[]): Skill[] {
    return skills.toSorted((a, b) => b.confidence - a.confidence);
}

/** Whether a skill is drawn as core rather than proficient. */
export function isCore(skill: Skill): boolean {
    return skill.confidence >= CORE_CONFIDENCE;
}

/**
 * Skills at or above {@link CONFIDENCE_THRESHOLD}, ranked by confidence.
 *
 * @param skills - The skills of one category, in API order.
 * @param showcased - `true` for skills in {@link SHOWCASE_AREA}, `false` for the rest.
 * @returns The matching skills, highest confidence first.
 */
export function selectSkills(skills: readonly Skill[], showcased: boolean): Skill[] {
    return byConfidence(skills.filter(s => s.confidence >= CONFIDENCE_THRESHOLD && s.renderArea.includes(SHOWCASE_AREA) === showcased));
}

/**
 * The profile's three skill categories, each filtered by {@link selectSkills}.
 *
 * @param profile - The validated profile document.
 * @param showcased - Passed through to {@link selectSkills}.
 * @returns Languages, frameworks and infrastructure, in that order. A category can be empty.
 */
export function skillGroups(profile: Profile, showcased: boolean): SkillGroup[] {
    const { languages, frameworks, infrastructure } = profile.skills;
    return [
        { label: "Languages", skills: selectSkills(languages, showcased) },
        { label: "Frameworks & Libraries", skills: selectSkills(frameworks, showcased) },
        { label: "Infrastructure & Tools", skills: selectSkills(infrastructure, showcased) },
    ];
}
