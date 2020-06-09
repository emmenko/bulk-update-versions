# Bulk update versions

<p align="center">
  <a href="https://www.npmjs.com/package/bulk-update-versions"><img src="https://badgen.net/npm/v/bulk-update-versions" alt="Latest release (latest dist-tag)" /></a> <a href="https://github.com/emmenko/bulk-update-versions/blob/master/LICENSE"><img src="https://badgen.net/github/license/emmenko/bulk-update-versions" alt="GitHub license" /></a>
</p>

Script to bulk update versions matching a certain pattern.

## Install

```
$ npm install --save bulk-update-versions
```

## Usage

Certain dependencies are usually released and updated in bulk as they follow a single Lerna version bump. Updating those packages can get quite verbose, as you need to check which packages have been released, find the right version, and update them.

To make this process simpler, you can use this package to bump all versions of dependencies matching the given pattern. The script will make sure that the versions of the packages matching the given pattern do exist, and bump the version only then.

```
$ bulk-update-versions --match '^@babel/(.*)' 7.9.2
```

### Force updating to `latest` version

If you want to update all the matching packages to their `latest` version, you can pass the `--force-latest` flag instead of a fixed version.

```
$ bulk-update-versions --match '^@babel/(.*)' --force-latest
```
