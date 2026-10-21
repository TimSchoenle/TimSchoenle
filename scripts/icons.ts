/**
 * Resolves a skill name to the logo drawn for it.
 *
 * @remarks
 * `logos.ts` is checked first, then Simple Icons by title. A name neither knows gets no logo, and
 * `tech-stack.ts` draws a monogram in its place, so a new skill in the profile never breaks the
 * image.
 *
 * @packageDocumentation
 */

import * as simpleIcons from "simple-icons";
import { LOCAL_LOGOS } from "./logos";

/** A single-colour logo: one SVG path in a square view box of side `size`. */
export interface Icon {
    readonly title: string;
    readonly path: string;
    readonly size: number;
    /** Brand colour as six hex digits without `#`, or absent when the brand publishes none. */
    readonly hex?: string;
}

/**
 * Skill names whose Simple Icons title is a different name for the same thing. Matching is by
 * title, case-insensitive, after a trailing parenthesised qualifier is dropped.
 */
const ICON_TITLE_ALIASES: Readonly<Record<string, string>> = {
    "ArgoCD": "Argo",
    "Talos Linux": "Talos",
    "TimescaleDB": "Timescale",
};

/** Simple Icons' view box side. */
const SIMPLE_ICONS_SIZE = 24;

/** Every Simple Icons entry, keyed by lowercased title. */
const SIMPLE_ICONS_BY_TITLE: ReadonlyMap<string, Icon> = new Map(
    Object.values(simpleIcons).map(({ title, path, hex }: { title: string; path: string; hex: string }) =>
        [title.toLowerCase(), { title, path, hex, size: SIMPLE_ICONS_SIZE }]),
);

/** Drops a trailing parenthesised qualifier: `WebAssembly (WASM)` becomes `WebAssembly`. */
export function baseName(name: string): string {
    return name.replace(/\s*\(.*\)\s*$/, "");
}

/**
 * Finds the logo for a skill name.
 *
 * @returns The logo, or `undefined` when neither `logos.ts` nor Simple Icons has one.
 */
export function findIcon(name: string): Icon | undefined {
    const local = LOCAL_LOGOS[name];
    if (local) {
        return local;
    }
    const title = ICON_TITLE_ALIASES[name] ?? baseName(name);
    return SIMPLE_ICONS_BY_TITLE.get(title.toLowerCase());
}
