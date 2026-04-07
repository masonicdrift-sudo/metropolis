import ms from "milsymbol";
import fs from "node:fs";

const all = new Set();

const g = new Set();
for (const a of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
  for (const b of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    for (const p of ["---****F", "--****F", "---***F", "--***F", "----***F"]) {
      const c = `SFGPUC${a}${b}${p}`;
      if (c.length !== 15) continue;
      if (new ms.Symbol(c, { size: 10, fill: true }).isValid()) g.add(c);
    }
  }
}

const e = new Set();
for (const a of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
  for (const b of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    for (const p of ["---****F", "--****F", "---***F", "--***F", "----***F"]) {
      const c = `SFGPUS${a}${b}${p}`;
      if (c.length !== 15) continue;
      if (new ms.Symbol(c, { size: 10, fill: true }).isValid()) e.add(c);
    }
  }
}

const ss = new Set();
for (const a of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
  for (const b of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    for (const p of ["---****F", "--****F", "---***F", "--***F"]) {
      const c = `SFGPUSS${a}${b}${p}`;
      if (c.length !== 15) continue;
      if (new ms.Symbol(c, { size: 10, fill: true }).isValid()) ss.add(c);
    }
  }
}

const air = new Set();
for (const a of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
  for (const b of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    for (const c of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
      for (const p of ["---***F", "--***F", "---****F"]) {
        const sidc = `SFAP${a}${b}${c}${p}`;
        if (sidc.length !== 15) continue;
        if (new ms.Symbol(sidc, { size: 10, fill: true }).isValid()) air.add(sidc);
      }
    }
  }
}
for (const x of [
  "SFAPCF----****F",
  "SFAPCH----****F",
  "SFAPCL----****F",
  "SFAPME----****F",
  "SFAPMF----****F",
  "SFAPMH----****F",
  "SFAPML----****F",
  "SFAPMV----****F",
  "SFAPWB----****F",
  "SFAPWD----****F",
  "SFAPWM----****F",
])
  air.add(x);

const sea = new Set([
  "SFSPCUM---****F",
  "SFSPCUN---****F",
  "SFSPCUR---****F",
  "SFSPCUS---****F",
  "SFSPCM----****F",
]);

const inst = new Set(["SFGPI-----****H"]);
for (const a of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
  for (const b of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    const c = `SFGPI${a}${b}----***H`;
    if (c.length !== 15) continue;
    if (new ms.Symbol(c, { size: 10, fill: true }).isValid()) inst.add(c);
  }
}

const singles = new Set();
for (const x of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
  const c = `SFGPUC${x}---****F`;
  if (c.length === 15 && new ms.Symbol(c, { size: 10, fill: true }).isValid()) singles.add(c);
}

for (const x of [...g, ...e, ...ss, ...air, ...sea, ...inst, ...singles]) all.add(x);

const sorted = [...all].sort();
const body = `/**
 * Friendly-template letter SIDCs validated against milsymbol (MIL-STD-2525C-style).
 * Regenerate: \`node script/gen-nato-sidcs.mjs\`
 */
export const NATO_FRIENDLY_SIDCS = [
${sorted.map((s) => `  "${s}",`).join("\n")}
] as const;

export type NatoFriendlySidc = (typeof NATO_FRIENDLY_SIDCS)[number];
`;

const out = new URL("../shared/natoFriendlySidcs.ts", import.meta.url);
fs.writeFileSync(out, body, "utf8");
console.log("Wrote", sorted.length, "SIDCs to shared/natoFriendlySidcs.ts");
