import { describe, expect, test } from "bun:test";
import { findIcon } from "./icons";
import { parseProfile } from "./profile";
import { buttonWidth, contactLinks, renderContactButton } from "./contact-buttons";
import { escapeLinkDestination, fillTemplate, renderReadme } from "./render";
import { skillGroups } from "./skills";
import { codeBreakdown, formatDuration, renderStatsCard, statsSummary } from "./stats-card";
import { assertUniqueSlugs, renderSkillTile, skillSlug, tileRows, tileSize } from "./tech-stack";
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
            { name: "Markdown", text: "4 hrs", percent: 40, total_seconds: 14_400 },
            { name: "Java", text: "4 hrs", percent: 40, total_seconds: 14_400 },
            { name: "Bash", text: "2 hrs", percent: 20, total_seconds: 7_200 },
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
    test("parseWakaTime rejects bad durations and bad dates", () => {
        const lang = { name: "Java", text: "1 hr" };
        for (const total_seconds of [-5, Number.NaN, Number.POSITIVE_INFINITY, "60"]) {
            expect(() => parseWakaTime({ data: { ...WAKATIME.data, languages: [{ ...lang, total_seconds }] } })).toThrow("total_seconds");
        }
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

describe("skill tiles", () => {
    const [languages, frameworks] = skillGroups(PROFILE, true);

    test("rows put core skills first and drop empty rows", () => {
        expect(tileRows(languages!.skills).map(row => row.map(s => s.name))).toEqual([["Java"], ["Rust"]]);
        expect(tileRows([skill("Go", 0.6)]).length).toBe(1);
    });
    test("slugs are file-safe and keep C# apart from C", () => {
        expect(skillSlug("Spring Boot")).toBe("spring-boot");
        expect(skillSlug("WebAssembly (WASM)")).toBe("webassembly-wasm");
        expect(skillSlug("C#")).toBe("c-sharp");
        expect(skillSlug("C++")).toBe("c-plus-plus");
        expect(() => assertUniqueSlugs([skill("Next.js", 1), skill("Next JS", 1)])).toThrow("next-js");
    });
    test("core tiles are larger, and the SVG size matches the declared size", () => {
        const java = languages!.skills[0]!;
        const rust = languages!.skills[1]!;
        expect(tileSize(java).width).toBeGreaterThan(tileSize(rust).width);
        expect(renderSkillTile(java, 0, "dark")).toContain(`width="${tileSize(java).width}" height="${tileSize(java).height}"`);
    });
    test("escapes names, staggers by position, and themes differ only in colour", () => {
        const odd = frameworks!.skills.find(s => s.name.startsWith("Made"))!;
        const light = renderSkillTile(odd, 2, "light");
        expect(light).toContain("Made&lt;Up&gt;&amp;Co");
        expect(light).not.toContain("Made<Up>");
        expect(light).toContain("ease-out 80ms backwards");
        const shape = (svg: string) => svg.replaceAll(/#[0-9a-fA-F]{6}/g, "");
        expect(shape(light)).toBe(shape(renderSkillTile(odd, 2, "dark")));
    });
});

describe("renderStatsCard", () => {
    const stats = parseWakaTime(WAKATIME);

    test("lists code languages only, as shares of coding time", () => {
        const { seconds, languages, otherPercent } = codeBreakdown(stats);
        expect(seconds).toBe(21_600);
        expect(languages.map(l => l.name)).toEqual(["Java", "Bash"]);
        expect(languages[0]!.percent).toBeCloseTo(200 / 3, 10);
        expect(languages[1]!.percent).toBeCloseTo(100 / 3, 10);
        expect(otherPercent).toBe(0);
        const svg = renderStatsCard(stats, "dark");
        expect(svg).toContain(">Java</text>");
        expect(svg).toContain(">66.7%</text>");
        expect(svg).toContain(">6 hrs</text>");
        expect(svg).toContain(">of code, 10 hrs tracked in total</text>");
        expect(svg).not.toContain("Markdown");
        expect(svg).not.toContain("fill-opacity");
    });
    test("folds unlisted code languages into one remainder that fills the bar", () => {
        const many = ["Java", "Bash", "Kotlin", "Python", "Go", "Rust"]
            .map(name => ({ name, text: "1 hr", percent: 10, total_seconds: 3_600 }));
        const breakdown = codeBreakdown(parseWakaTime({ data: { ...WAKATIME.data, languages: many } }));
        expect(breakdown.languages.map(l => l.name)).toEqual(["Java", "Bash", "Kotlin", "Python", "Go"]);
        const total = breakdown.languages.reduce((sum, l) => sum + l.percent, breakdown.otherPercent);
        expect(total).toBeCloseTo(100, 10);
        expect(breakdown.otherPercent).toBeCloseTo(100 / 6, 10);
        expect(renderStatsCard(parseWakaTime({ data: { ...WAKATIME.data, languages: many } }), "light")).toContain('fill-opacity="0.5"');
    });
    test("summarises the week for alt text", () => {
        expect(statsSummary(stats)).toBe("Weekly coding stats, 13 October – 20 October 2026: 6 hrs of code, 10 hrs tracked. Java 4 hrs (66.7%), Bash 2 hrs (33.3%)");
    });
    test("formats durations like WakaTime", () => {
        expect(formatDuration(59)).toBe("<1 min");
        expect(formatDuration(60)).toBe("1 min");
        expect(formatDuration(1_620)).toBe("27 mins");
        expect(formatDuration(3_600)).toBe("1 hr");
        expect(formatDuration(3_660)).toBe("1 hr 1 min");
        expect(formatDuration(58_500)).toBe("16 hrs 15 mins");
    });
    test("says so when no code was tracked", () => {
        const prose = parseWakaTime({ data: { ...WAKATIME.data, languages: [WAKATIME.data.languages[0]!] } });
        expect(renderStatsCard(prose, "light")).toContain("No code tracked this week.");
        expect(statsSummary(prose)).toBe("Weekly coding stats, 13 October – 20 October 2026: 10 hrs tracked.");
        const idle = parseWakaTime({ data: { ...WAKATIME.data, languages: [{ name: "Java", text: "0 secs", percent: 0, total_seconds: 0 }] } });
        expect(codeBreakdown(idle)).toEqual({ seconds: 0, languages: [], otherPercent: 0 });
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
        expect(readme).toContain(`srcset="${themedAsset("skills/rust", "dark")}"`);
        expect(readme).toContain(`<a href="mailto:contact@example.com"><picture>`);
        expect(readme).toContain('alt="Weekly &lt;stats&gt;" src="assets/stats-light.svg" width="100%"');
        expect(readme).toContain("### Languages\n\n<p>\n");
        expect(readme).not.toContain("### Infrastructure");
        expect(readme).toContain('srcset="assets/skills/java-dark.svg"><img alt="Java" src="assets/skills/java-light.svg"');
        expect(readme).toContain('alt="Made&lt;Up&gt;&amp;Co"');
        expect(readme).toContain("Ask me about **Java**, **Spring Boot** and **Rust**.");
    });
    test("marks the stats section when WakaTime is unavailable", async () => {
        const template = await Bun.file("templates/README.md.template").text();
        expect(renderReadme(template, PROFILE, null)).toContain("<!-- WakaTime stats unavailable -->");
    });
});
