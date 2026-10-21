/**
 * Runtime check for the WakaTime stats response.
 *
 * @remarks
 * Checks only the fields `render.ts` reads. A failed check throws inside the WakaTime fetch, where
 * `generate-readme.ts` already turns any error into the "unavailable" marker, so a malformed body
 * costs that section and nothing else.
 *
 * @packageDocumentation
 */

import type { WakaTime } from "./types";

/** Throws naming `path` unless `value` is a string `Date` can parse. */
function assertDate(value: unknown, path: string): void {
    assertString(value, path);
    if (Number.isNaN(Date.parse(value as string))) {
        throw new TypeError(`WakaTime field ${path} is not a date`);
    }
}

/** Throws naming `path` unless `value` is a string. */
function assertString(value: unknown, path: string): void {
    if (typeof value !== "string") {
        throw new TypeError(`WakaTime field ${path} is not a string`);
    }
}

/**
 * Checks that `data` has every field the stats block reads, with the right type.
 *
 * @param data - The parsed response body.
 * @returns `data`, typed as {@link WakaTime}.
 * @throws TypeError naming the first field that is missing or has the wrong type.
 */
export function parseWakaTime(data: unknown): WakaTime {
    const stats = (data as { data?: unknown } | null)?.data;
    if (typeof stats !== "object" || stats === null) {
        throw new TypeError("WakaTime field data is not an object");
    }

    const { start, end, human_readable_total, languages } = stats as Record<string, unknown>;
    assertDate(start, "data.start");
    assertDate(end, "data.end");
    assertString(human_readable_total, "data.human_readable_total");
    if (!Array.isArray(languages)) {
        throw new TypeError("WakaTime field data.languages is not an array");
    }
    languages.forEach((entry: unknown, index) => {
        const lang = (entry ?? {}) as Record<string, unknown>;
        assertString(lang.name, `data.languages[${index}].name`);
        assertString(lang.text, `data.languages[${index}].text`);
        // Shares are computed from this; a negative or non-finite value would skew every bar.
        if (typeof lang.total_seconds !== "number" || !(lang.total_seconds >= 0 && Number.isFinite(lang.total_seconds))) {
            throw new TypeError(`WakaTime field data.languages[${index}].total_seconds is not a finite number of at least 0`);
        }
    });

    return data as WakaTime;
}
