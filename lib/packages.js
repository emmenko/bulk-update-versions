/* This file is an extracted version of the `getPackages` implementation from `@lerna/project`. */

const fs = require("fs");
const path = require("path");
const pMap = require("p-map");
const globby = require("globby");

function getPackages(rootPath) {
  const packageLocations = getPackageLocations(rootPath);
  if (!packageLocations) return Promise.resolve([]);

  const mapper = (packageConfigPath) => {
    const packageJson = require(packageConfigPath);
    return {
      name: packageJson.name,
      location: path.dirname(packageConfigPath),
    };
  };
  const fileFinder = makeFileFinder(rootPath, packageLocations);
  return fileFinder("package.json", (filePaths) =>
    pMap(filePaths, mapper, { concurrency: 50 })
  );
}

function getPackageLocations(rootPath) {
  const rootPackageJson = require(path.join(rootPath, "package.json"));
  const lernaJsonPath = path.join(rootPath, "lerna.json");

  if (!fs.existsSync(lernaJsonPath) && !rootPackageJson.workspaces) {
    // This is not a monorepo, fall back to single project.
    return undefined;
  }

  const lernaJson = require(path.join(rootPath, "lerna.json"));
  if (lernaJson.useWorkspaces) {
    const workspaces = rootPackageJson.workspaces;
    if (!workspaces) {
      throw new Error(
        `Yarn workspaces need to be defined in the root package.json.\nSee: https://github.com/lerna/lerna/blob/master/commands/bootstrap/README.md#--use-workspaces`
      );
    }
    return workspaces.packages || workspaces;
  }
  return lernaJson.packages || ["packages/*"];
}

function makeFileFinder(rootPath, packageLocations) {
  const globOpts = {
    cwd: rootPath,
    absolute: true,
    followSymlinkedDirectories: false,
    // POSIX results always need to be normalized
    transform: (filePath) => path.normalize(filePath),
  };

  if (
    packageLocations.some((locationPath) => locationPath.indexOf("**") > -1)
  ) {
    if (
      packageLocations.some(
        (locationPath) => locationPath.indexOf("node_modules") > -1
      )
    ) {
      throw new Error(
        "An explicit node_modules package path does not allow globstars (**)"
      );
    }

    globOpts.ignore = [
      // allow globs like "packages/**",
      // but avoid picking up node_modules/**/package.json
      "**/node_modules/**",
    ];
  }

  return (fileName, fileMapper) => {
    const promise = pMap(
      packageLocations.sort(),
      (globPath) =>
        globby(path.join(globPath, fileName), globOpts)
          .then((results) => results.sort())
          .then(fileMapper),
      { concurrency: 4 }
    );

    // always flatten the results
    return promise.then(flattenResults);
  };
}

function flattenResults(results) {
  return results.reduce((acc, result) => acc.concat(result), []);
}

module.exports = getPackages;
