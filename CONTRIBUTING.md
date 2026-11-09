# Contributing

## Set up and check a change

The runtime requirement is Node.js **18 or later**. Contributor and publisher tooling is separate: use Node.js **22.14 or later** and npm **11.5.1 or later** (the release job uses Node.js 24). Do not raise the runtime floor merely to match development tools.

The public source repository is [toadai/grauss-kruger](https://github.com/toadai/grauss-kruger). Fork it or clone a checkout to get started.

```sh
npm ci
npm test
npm run lint
npm run test:package
npm run example:mga2020
npm run example:utm
```

- `npm test` builds and runs the numerical tests.
- `npm run lint` typechecks source, tests, and examples.
- `npm run test:package` checks a clean npm tarball, ESM/CommonJS runtime imports, TypeScript Node16/NodeNext consumers in both module modes, and artifact hygiene.
- The example commands use the built package entry point; run `npm test` or `npm run build` first.

Use a branch and submit a pull request when repository access permits. Describe the intended behavior and include regression tests for numerical or validation changes. Keep geographic datum transformation separate from projection. Preserve public API names and document deliberate changes to accepted inputs or numerical behavior. Update the Unreleased changelog and relevant user documentation. Avoid generated build output in commits.

## Release a version

Publishing is a maintainer operation, not part of contribution setup. Do not publish from a pull request or enable automatic git pushing from npm lifecycle hooks.

### Account and repository prerequisites

Before using the release workflow, a maintainer must configure and verify:

1. Permission to publish `@canetoad/grauss-kruger` on npm.
2. An npm trusted publisher for GitHub owner `toadai`, repository `grauss-kruger`, workflow `release.yml`, and environment `npm`. The workflow uses OIDC, not an `NPM_TOKEN` secret. Configure it near the release: a new trusted publisher expires if its first publish is not completed within two days. New configurations default to stage-only; explicitly enable **direct publishing** for this workflow's `npm publish` operation.
3. The GitHub `npm` environment is configured with required reviewer `l3wi` and a `v*` tag deployment policy. Self-review is permitted so the single maintainer can approve a manual release. Active rulesets block updates/deletion of `v*` release tags and block deletion/force-pushing of the default branch, with no bypass. Default-branch changes require a pull request, resolved conversations, and all five up-to-date CI matrix checks; the approval count is zero for single-maintainer operation. Verify these environment and ruleset settings before each release.
4. Public source and package visibility for npm provenance. The source repository is public at https://github.com/toadai/grauss-kruger; keep it public and verify the package and source links before releasing. Do not use the former advertised `canetoad/graussKruger` URL.

The npm trusted publisher remains a prerequisite to configure near an actual release; checked-in workflow configuration does not enable it. GitHub private vulnerability reporting, secret scanning, push protection, Dependabot alerts, and security updates are enabled. Neither those settings nor local checks establish that a GitHub workflow has passed; the workflow changes must be pushed and run before hosted results exist. Version 1.0.0 has no npm provenance attestation; a later release must earn its own attestation through the configured publisher.

### Prepare and dispatch

1. Update package and lockfile versions together and move the relevant Unreleased changelog entries into the new version section. Run all checks above from a clean checkout.
2. Merge the reviewed release change to the protected default branch. Create and push a stable `vX.Y.Z` tag at that commit, using the project's authorized release process. The tag must contain the release workflow, and that workflow must also exist on the default branch.
3. Dispatch the workflow **on that same tag**, not on `main`:

   ```sh
   gh workflow run release.yml --repo toadai/grauss-kruger --ref vX.Y.Z -f tag=vX.Y.Z
   ```

4. Review the workflow results and approve the `npm` environment deployment only for the intended release. The workflow validates tag/version agreement, the tag's commit against the run SHA, and default-branch ancestry. It checks the supported Node matrix before handing the exact tested tarball to the gated publication job. That job verifies its checksum and rechecks the remote tag before publishing with provenance; it does not rebuild a replacement artifact.
5. After publication, inspect the npm package version, installed ESM/CommonJS entry points, TypeScript declarations, source links, and provenance attestation. Do not claim success or provenance merely because a dispatch was accepted.

If trusted publishing or repository access is unavailable, resolve those prerequisites first; do not bypass release gates with an ad hoc token-based publish.
