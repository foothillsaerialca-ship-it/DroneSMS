import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const directScopes = new Map();

for (const [scope, dependencies] of [
  ['Runtime (direct)', lock.packages[''].dependencies ?? {}],
  ['Development (direct)', lock.packages[''].devDependencies ?? {}],
  ['Optional (direct)', lock.packages[''].optionalDependencies ?? {}],
]) {
  for (const name of Object.keys(dependencies)) directScopes.set(name, scope);
}

const packages = new Map();
for (const [packagePath, metadata] of Object.entries(lock.packages)) {
  if (!packagePath.startsWith('node_modules/') || !metadata.version) continue;

  const name = packagePath.slice(packagePath.lastIndexOf('node_modules/') + 'node_modules/'.length);
  const scope = directScopes.get(name) ?? (metadata.dev ? 'Development (transitive)' : 'Runtime (transitive)');
  const license = String(metadata.license ?? 'License metadata missing').replaceAll('|', '\\|');
  const key = `${name}\0${metadata.version}\0${license}\0${scope}`;
  const entry = packages.get(key) ?? {
    name,
    version: metadata.version,
    license,
    scope: `${scope}${metadata.optional ? ', optional' : ''}`,
  };
  packages.set(key, entry);
}

const rows = [...packages.values()]
  .sort((left, right) => {
    const leftKey = `${left.name}\0${left.version}\0${left.license}`;
    const rightKey = `${right.name}\0${right.version}\0${right.license}`;
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  })
  .map(({ name, version, license, scope }) => `| \`${name}\` | ${version} | ${license} | ${scope} |`);

const document = `# Third-Party Licenses

This inventory is generated from the exact dependency tree in \`package-lock.json\`. It includes runtime and development dependencies, including transitive dependencies, so the listing is reproducible for this repository revision. \`License\` contains the package's declared SPDX identifier or expression; consult the package's own license file for the controlling text and any notices or source-distribution obligations.

The production build also emits \`dist/vendor-licenses.txt\` with full license notices for third-party packages included in the browser bundle. Rebuild after dependency changes and review license metadata when adding or upgrading packages. This inventory is not legal advice.

| Package | Version | License | Dependency scope |
|---|---:|---|---|
${rows.join('\n')}
`;

writeFileSync(path.join(root, 'docs/licenses.md'), document);
console.log(`Generated ${rows.length} package license rows from package-lock.json.`);
