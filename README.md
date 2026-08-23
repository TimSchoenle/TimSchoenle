# Tim Schönle

Software Developer in Germany. Mostly Rust services and Java build tooling, plus the Helm charts and
GitHub Actions the rest of it runs on.

[https://tim-schoenle.de](https://tim-schoenle.de) · <contact@tim-schoenle.de> · [LinkedIn](https://www.linkedin.com/in/tim-schoenle)

## What I build

Rust services that run in Kubernetes, and the libraries they turned out to need. Six of the
repositories here load their configuration through `terrace-config`, and three build their
Content-Security-Policy with `csp-shell`. Neither is on crates.io; callers pin them by git tag, so
every bump is a manifest edit that shows up in review.

Most of these repositories render their README from a Handlebars template in CI. A job on the
default branch fails when the committed file no longer matches its template, which is what keeps a
version number, an MSRV or an image tag in the one file that owns it.

On the Java side, a Gradle plugin that drives `jextract` and a catalog of OpenRewrite recipes.

## Selected work

- [Portfolio](https://github.com/TimSchoenle/Portfolio) is the source of the site linked above. One
  Rust workspace: Dioxus renders every route server-side and then hydrates it in the browser, behind
  Axum, shipped as a distroless image with no writable filesystem.
- [csp-shell](https://github.com/TimSchoenle/csp-shell) assembles a Content-Security-Policy from the
  app shell you actually serve. It hashes the inline scripts the HTML parser will see, and reserves
  a per-response nonce so an edge-injected script can still run. No `'unsafe-inline'`.
- [terrace-config](https://github.com/TimSchoenle/terrace-config) layers
  [figment](https://docs.rs/figment) configuration for services whose secrets arrive as files, from
  a Kubernetes `Secret` volume or Docker `_FILE` indirection. A supervisor rebuilds the service when
  those files change, so a rotated secret needs no restart.
- [actions](https://github.com/TimSchoenle/actions) holds the composite actions and reusable
  workflows the other repositories call. Each one carries its own tag, so Renovate can keep callers
  pinned to a SHA and still see a release.
- [helm-charts](https://github.com/TimSchoenle/helm-charts) is what I run on Kubernetes. Every chart
  is built on the same `common` library chart, giving them one values contract, one label scheme and
  one security baseline.
- [gradle-jextract](https://github.com/TimSchoenle/gradle-jextract) downloads `jextract`, runs it
  over a project's C headers, and puts the generated Java FFM bindings on the main source set.
  Native libraries either load from the system or ride along inside the JAR. Gradle 9 and Java 25.

## Tech stack

**Languages**

![Java](https://img.shields.io/badge/Java-24292e?style=flat-square&logo=openjdk&logoColor=white) ![SQL](https://img.shields.io/badge/SQL-24292e?style=flat-square&logo=sql&logoColor=white) ![Rust](https://img.shields.io/badge/Rust-24292e?style=flat-square&logo=rust&logoColor=white) ![WebAssembly (WASM)](https://img.shields.io/badge/WebAssembly%20(WASM)-24292e?style=flat-square&logo=webassembly&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-24292e?style=flat-square&logo=typescript&logoColor=white) ![Kotlin](https://img.shields.io/badge/Kotlin-24292e?style=flat-square&logo=kotlin&logoColor=white)

**Frameworks and libraries**

![Spring Boot](https://img.shields.io/badge/Spring%20Boot-24292e?style=flat-square&logo=springboot&logoColor=white) ![PaperMC](https://img.shields.io/badge/PaperMC-24292e?style=flat-square&logo=papermc&logoColor=white) ![gRPC](https://img.shields.io/badge/gRPC-24292e?style=flat-square&logo=grpc&logoColor=white) ![Next.js](https://img.shields.io/badge/Next.js-24292e?style=flat-square&logo=next.js&logoColor=white) ![React](https://img.shields.io/badge/React-24292e?style=flat-square&logo=react&logoColor=white) ![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-24292e?style=flat-square&logo=tailwindcss&logoColor=white) ![Yew](https://img.shields.io/badge/Yew-24292e?style=flat-square&logo=yew&logoColor=white) ![Node.js](https://img.shields.io/badge/Node.js-24292e?style=flat-square&logo=node.js&logoColor=white)

**Infrastructure and tools**

![Docker](https://img.shields.io/badge/Docker-24292e?style=flat-square&logo=docker&logoColor=white) ![Kubernetes](https://img.shields.io/badge/Kubernetes-24292e?style=flat-square&logo=kubernetes&logoColor=white) ![ArgoCD](https://img.shields.io/badge/ArgoCD-24292e?style=flat-square&logo=argo&logoColor=white) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-24292e?style=flat-square&logo=postgresql&logoColor=white) ![Helm](https://img.shields.io/badge/Helm-24292e?style=flat-square&logo=helm&logoColor=white) ![Linux](https://img.shields.io/badge/Linux-24292e?style=flat-square&logo=linux&logoColor=white) ![TimescaleDB](https://img.shields.io/badge/TimescaleDB-24292e?style=flat-square&logo=timescale&logoColor=white) ![MongoDB](https://img.shields.io/badge/MongoDB-24292e?style=flat-square&logo=mongodb&logoColor=white) ![Redis](https://img.shields.io/badge/Redis-24292e?style=flat-square&logo=redis&logoColor=white)

## Weekly stats

Editor time, from WakaTime. A workflow refreshes it once a day.

```txt
From: 14 August 2026 - To: 21 August 2026

Total Time: 58 hrs 50 mins

YAML                  15 hrs 33 mins   ██████░░░░░░░░░░░░░░░░░░░   25.89 %
Rust                  12 hrs 57 mins   █████░░░░░░░░░░░░░░░░░░░░   21.55 %
Markdown              10 hrs 7 mins    ████░░░░░░░░░░░░░░░░░░░░░   16.85 %
Python                6 hrs 2 mins     ███░░░░░░░░░░░░░░░░░░░░░░   10.04 %
Text                  2 hrs 15 mins    █░░░░░░░░░░░░░░░░░░░░░░░░    3.75 %
```
