#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const mri = require("mri");
const execa = require("execa");
const Listr = require("listr");
const semver = require("semver");
const rcfile = require("rcfile");
const prettier = require("prettier");
const getPackages = require("../lib/packages");

const prettierConfig = rcfile("prettier");

const flags = mri(process.argv.slice(2), {
  alias: { help: ["h"] },
});
const commands = flags._;

if (commands.length === 0 || (flags.help && commands.length === 0)) {
  console.log(`
Usage: update-versions [version] [options]

Updates the versions of the matching packages in each package.json.
This is useful to update versions of packages from a monorepository that have been
published under a single version.

[version]: The version to update the matching packages to.

Options:

 --match <pattern>    A regular expression to match package names that needs to be updated.
  `);
  process.exit(0);
}

const [versionToUpdate] = commands;

if (!versionToUpdate) {
  throw new Error("Missing command argument [version].");
}
if (!semver.valid(versionToUpdate)) {
  throw new Error(
    `Invalid [version] argument ${versionToUpdate}. Please provide a valid SemVer value.`
  );
}
if (!flags.match) {
  throw new Error(
    "Missing required option --match. Please provide a valid regular expression."
  );
}

const matchingPackages = new RegExp(flags.match);

const rootPath = fs.realpathSync(process.cwd());

const dependenciesCache = new Map();

const log = (...args) => {
  if (process.env.DEBUG === "true") {
    console.log(...args);
  }
};

const writeFile = (filePath, data) => {
  const formattedData = prettier.format(JSON.stringify(data, null, 2), {
    ...prettierConfig,
    parser: "json",
  });
  fs.writeFileSync(filePath, formattedData, {
    encoding: "utf8",
  });
};

const fetchRemotePublishedVersions = async (packageName) => {
  const result = await execa("npm", ["view", packageName, "--json"], {
    silent: true,
    encoding: "utf-8",
  });
  if (result.failed) {
    throw new Error(result.stderr);
  }
  return JSON.parse(result.stdout).versions;
};

const updateDependencies = async (dependencies) =>
  Object.entries(dependencies).reduce(async (prevPromise, [name, version]) => {
    // Resolve the promise first, as we're dealing with an async reducer.
    const updatedDependencies = await prevPromise;
    if (!matchingPackages.test(name)) {
      return { ...updatedDependencies, [name]: version };
    }

    // If the current dependency version differs from the version that we
    // are trying to update to, we need to check if the package has a published
    // version that match the requested version.
    // For instance, if the package has version `1.0.0`, the requested version
    // is `1.3.0`, and the package does not have have any published `1.3.0` version,
    // we should not update the version.
    if (!semver.satisfies(versionToUpdate, version)) {
      log(
        `Package ${name} has version ${version} but requested version was ${versionToUpdate}`
      );
      // Fetch the published versions of the given package, if it's not in the cache.
      if (!dependenciesCache.has(name)) {
        const remotePublishedVersions = await fetchRemotePublishedVersions(
          name
        );
        dependenciesCache.set(name, remotePublishedVersions);
      }
      const publishedVersions = dependenciesCache.get(name);

      // If the requested version is included in the list of published versions,
      // then update the version in the package.json.
      if (publishedVersions.includes(versionToUpdate)) {
        log(`Package ${name} can be updated to version ${versionToUpdate}`);
        // Attempt to keep the preserved range
        let versionToUpdateWithPreservedRange = version
          .replace(/\~(.*)$/, `~${versionToUpdate}`)
          .replace(/\^(.*)$/, `^${versionToUpdate}`);
        // ...otherwise fall back to the fixed given version
        if (versionToUpdateWithPreservedRange === version) {
          versionToUpdateWithPreservedRange = versionToUpdate;
        }
        return {
          ...updatedDependencies,
          [name]: versionToUpdateWithPreservedRange,
        };
      }
    }
    return { ...updatedDependencies, [name]: version };
  }, Promise.resolve({}));

const createTaskForPackage = (packageInfo) => ({
  title: `Processing package: ${packageInfo.name}`,
  task: async (context) => {
    const appPackageJsonPath = path.join(packageInfo.location, "package.json");
    // eslint-disable-next-line no-param-reassign
    context.appPackageJson = require(appPackageJsonPath);
    return new Listr([
      {
        title: "Updating dependencies",
        enabled: (ctx) => Boolean(ctx.appPackageJson.dependencies),
        task: async (ctx) => {
          ctx.appPackageJson.dependencies = await updateDependencies(
            ctx.appPackageJson.dependencies
          );
        },
      },
      {
        title: "Updating dev dependencies",
        enabled: (ctx) => Boolean(ctx.appPackageJson.devDependencies),
        task: async (ctx) => {
          ctx.appPackageJson.devDependencies = await updateDependencies(
            ctx.appPackageJson.devDependencies
          );
        },
      },
      {
        title: "Updating package.json",
        task: (ctx) => {
          writeFile(appPackageJsonPath, ctx.appPackageJson);
        },
      },
    ]);
  },
});

// Scanning packages
//   Matching dependencies
//     Fetching remote
//     Compare version
//   Update dependency
// Update package
const start = async () => {
  const rootPackageInfo = {
    name: "root",
    location: rootPath,
  };
  const workspacePackageInfos = await getPackages(rootPath);

  const tasks = new Listr([
    createTaskForPackage(rootPackageInfo),
    ...workspacePackageInfos.map(createTaskForPackage),
  ]);

  await tasks.run();
};

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
