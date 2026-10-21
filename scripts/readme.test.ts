import { describe, expect, test } from "bun:test";
import { findIcon } from "./icons";
import { parseProfile } from "./profile";
import { buttonWidth, contactLinks, renderContactButton } from "./contact-buttons";
import { escapeLinkDestination, fillTemplate, renderReadme } from "./render";
import { skillGroups } from "./skills";
import { codeLanguages, renderStatsCard, statsSummary } from "./stats-card";
import { renderTechStack } from "./tech-stack";
import { brandColour, contrastRatio, themedAsset } from "./theme";
import { RenderArea, type Language, type Profile } from "./types";
import { parseWakaTime } from "./wakatime";

const skill = (name: string, confidence: number, showcased = true): Language => ({
    name,
    confidence,
    renderArea: showcased ? [RenderArea.Resume, RenderArea.TechRadar] : [RenderArea.TechRadar],
});

const PROFILE: Profile = {
    email: "contact@example.com",
    fullName: "Ada Example",
    location: "Germany",
    name: "Ada",
    title: "Engineer",
    website: "https://example.com",
    socials: { github: "https://github.com/ada", githubUsername: "ada" },
    skills: {
        languages: [skill("Rust", 0.7), skill("Java", 0.95), skill("Cobol", 0.4), skill("Zig", 0.6, false)],
        frameworks: [skill("Spring Boot", 0.86), skill("Made<Up>&Co", 0.6)],
        infrastructure: [],
    },
};

const WAKATIME = {
    data: {
        start: "2026-10-13T00:00:00Z",
        end: "2026-10-20T23:59:59Z",
        human_readable_total: "10 hrs",
        languages: [
            { name: "Markdown", text: "4 hrs", percent: 40 },
            { name: "Java", text: "4 hrs", percent: 40 },
            { name: "Bash", text: "2 hrs", percent: 20 },
        ],
    },
};

describe("fillTemplate", () => {
    test("replaces every placeholder", () => {
        expect(fillTemplate("{{A}}-{{B}}-{{A}}", { A: "1", B: "2" })).toBe("1-2-1");
    });
    test("throws on a placeholder without a value", () => {
        expect(() => fillTemplate("{{A}} {{B}}", { A: "1" })).toThrow("{{B}}");
    });
    test("throws on a value the template never uses", () => {
        expect(() => fillTemplate("{{A}}", { A: "1", B: "2" })).toThrow("B");
    });
});

describe("escaping", () => {
    test("link destinations cannot be closed early", () => {
        expect(escapeLinkDestination("https://a.example/) [x](https://b.example")).not.toMatch(/[()\s]/);
        expect(escapeLinkDestination("https://a.example/ ")).toEndWith("%C2%A0");
    });
});

describe("validation", () => {
    test("parseProfile names the missing field", () => {
        expect(() => parseProfile({ ...PROFILE, title: undefined })).toThrow("title");
    });
    test("parseWakaTime rejects out-of-range percentages and bad dates", () => {
        const lang = { name: "Java", text: "1 hr" };
        expect(() => parseWakaTime({ data: { ...WAKATIME.data, languages: [{ ...lang, percent: -5 }] } })).toThrow("percent");
        expect(() => parseWakaTime({ data: { ...WAKATIME.data, start: "not-a-date" } })).toThrow("start");
        expect(parseWakaTime(WAKATIME)).toBe(WAKATIME as never);
    });
});

describe("skills", () => {
    test("groups filter by threshold and render area and rank by confidence", () => {
        const [languages] = skillGroups(PROFILE, true);
        expect(languages!.skills.map(s => s.name)).toEqual(["Java", "Rust"]);
        expect(skillGroups(PROFILE, false)[0]!.skills.map(s => s.name)).toEqual(["Zig"]);
    });
});

describe("icons", () => {
    test("local logos win, aliases resolve, unknown names have none", () => {
        expect(findIcon("Java")?.size).toBe(128);
        expect(findIcon("ArgoCD")?.title).toBe("Argo");
        expect(findIcon("WebAssembly (WASM)")?.title).toBe("WebAssembly");
        expect(findIcon("Bash")?.title).toBe("GNU Bash");
        expect(findIcon("Made<Up>&Co")).toBeUndefined();
    });
    test("a brand colour too close to the tile falls back to the text colour", () => {
        const rust = findIcon("Rust")!;
        expect(brandColour(rust, "light", "text")).toBe("#000000");
        expect(brandColour(rust, "dark", "text")).not.toBe("#000000");
        expect(brandColour(undefined, "dark", "accent")).toMatch(/^#[0-9a-f]{6}$/);
        expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    });
});

describe("renderTechStack", () => {
    const groups = skillGroups(PROFILE, true);
    const light = renderTechStack(groups, "light");
    const dark = renderTechStack(groups, "dark");

    test("draws every showcased skill and nothing else", () => {
        for (const name of ["Java", "Rust", "Spring Boot"]) {
            expect(light).toContain(`>${name}</text>`);
        }
        expect(light).not.toContain("Cobol");
        expect(light).not.toContain("Zig");
    });
    test("escapes names and omits empty groups", () => {
        expect(light).toContain("Made&lt;Up&gt;&amp;Co");
        expect(light).not.toContain("Made<Up>");
        expect(light).not.toContain("INFRASTRUCTURE");
    });
    test("themes differ only in colour", () => {
        expect(light).not.toBe(dark);
        const shape = (svg: string) => svg.replaceAll(/#[0-9a-fA-F]{6}/g, "");
        expect(shape(light)).toBe(shape(dark));
    });
});

describe("renderStatsCard", () => {
    const stats = parseWakaTime(WAKATIME);

    test("lists code languages only, but keeps their share of all time", () => {
        expect(codeLanguages(stats).map(l => l.name)).toEqual(["Java", "Bash"]);
        const svg = renderStatsCard(stats, "dark");
        expect(svg).toContain(">Java</text>");
        expect(svg).toContain(">40.0%</text>");
        expect(svg).not.toContain("Markdown");
    });
    test("summarises the week for alt text", () => {
        expect(statsSummary(stats)).toBe("Weekly coding stats, 13 October – 20 October 2026: 10 hrs tracked. Java 4 hrs, Bash 2 hrs");
    });
    test("says so when no code was tracked", () => {
        const prose = parseWakaTime({ data: { ...WAKATIME.data, languages: [WAKATIME.data.languages[0]!] } });
        expect(renderStatsCard(prose, "light")).toContain("No code tracked this week.");
    });
});

describe("contact buttons", () => {
    test("LinkedIn appears only when the profile has it", () => {
        expect(contactLinks(PROFILE).map(l => l.id)).toEqual(["website", "email"]);
        const withLinkedIn = { ...PROFILE, socials: { ...PROFILE.socials, linkedin: "https://linkedin.example/in/ada" } };
        expect(contactLinks(withLinkedIn).map(l => l.id)).toEqual(["website", "linkedin", "email"]);
    });
    test("the SVG width matches the width the README declares", () => {
        for (const link of contactLinks(PROFILE)) {
            expect(renderContactButton(link, "light")).toContain(`width="${buttonWidth(link)}"`);
        }
    });
});

describe("renderReadme", () => {
    test("fills the real template", async () => {
        const template = await Bun.file("templates/README.md.template").text();
        const readme = renderReadme(template, PROFILE, { alt: "Weekly <stats>" });
        expect(readme).not.toContain("{{");
        expect(readme).toContain(`srcset="${themedAsset("tech-stack", "dark")}"`);
        expect(readme).toContain(`<a href="mailto:contact@example.com"><picture>`);
        expect(readme).toContain('alt="Weekly &lt;stats&gt;" src="assets/stats-light.svg" width="100%"');
        expect(readme).toMatch(/src="assets\/tech-stack-light.svg" width="100%"/);
        expect(readme).toContain('alt="Tech stack: Java, Rust, Spring Boot, Made&lt;Up&gt;&amp;Co"');
        expect(readme).toContain("Ask me about **Java**, **Spring Boot** and **Rust**.");
    });
    test("marks the stats section when WakaTime is unavailable", async () => {
        const template = await Bun.file("templates/README.md.template").text();
        expect(renderReadme(template, PROFILE, null)).toContain("<!-- WakaTime stats unavailable -->");
    });
});
