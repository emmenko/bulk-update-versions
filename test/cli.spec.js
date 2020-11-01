import os from "os";
import fs from "fs";
import path from "path";
import shelljs from "shelljs";
import semver from "semver";

const tmpFolder = os.tmpdir();
const workspaceDir = path.join(tmpFolder, "workspace");

beforeEach(() => {
  shelljs.rm("-rf", workspaceDir);
  shelljs.mkdir("-p", workspaceDir);
  shelljs.cp("-R", path.join(__dirname, "fixtures/*"), workspaceDir);
});

describe("when requesting a specific version for react dependencies", () => {
  it("should update the react dependencies to the requested version", () => {
    const result = shelljs.exec(
      [
        "node",
        path.join(__dirname, "../bin/bulk-update-versions.js"),
        `--match='^(react|react-dom)$'`,
        "17.0.0",
      ].join(" "),
      {
        cwd: workspaceDir,
      }
    );
    expect(result.code).toBe(0);

    const updatedWorkspacePackageJson = JSON.parse(
      fs.readFileSync(path.join(workspaceDir, "package.json"), {
        encoding: "utf8",
      })
    );
    const updatedPackageAPackageJson = JSON.parse(
      fs.readFileSync(
        path.join(workspaceDir, "packages/package-a/package.json"),
        {
          encoding: "utf8",
        }
      )
    );
    const updatedPackageBPackageJson = JSON.parse(
      fs.readFileSync(
        path.join(workspaceDir, "packages/package-b/package.json"),
        {
          encoding: "utf8",
        }
      )
    );

    expect(updatedWorkspacePackageJson).toMatchInlineSnapshot(`
      Object {
        "dependencies": Object {
          "gatsby": "2.0.0",
          "gatsby-cli": "2.0.0",
        },
        "name": "workspace",
        "private": true,
        "version": "1.0.0",
        "workspaces": Array [
          "packages/*",
        ],
      }
    `);
    expect(updatedPackageAPackageJson).toMatchInlineSnapshot(`
      Object {
        "devDependencies": Object {
          "react": "17.0.0",
          "react-dom": "17.0.0",
        },
        "name": "package-a",
        "peerDependencies": Object {
          "react": "16.x",
        },
        "private": true,
        "version": "1.0.0",
      }
    `);
    expect(updatedPackageBPackageJson).toMatchInlineSnapshot(`
      Object {
        "dependencies": Object {
          "react-intl": "5.8.8",
        },
        "devDependencies": Object {
          "react": "17.0.0",
          "react-dom": "17.0.0",
        },
        "name": "package-b",
        "peerDependencies": Object {
          "react": "16.x",
        },
        "private": true,
        "version": "1.0.0",
      }
    `);
  });
});

describe("when requesting the latest version for gatsby dependencies", () => {
  it("should update the gatsby dependencies to the latest version", () => {
    const result = shelljs.exec(
      [
        "node",
        path.join(__dirname, "../bin/bulk-update-versions.js"),
        `--match='^(gatsby|gatsby-cli)$'`,
        "--force-latest",
      ].join(" "),
      {
        cwd: workspaceDir,
      }
    );
    expect(result.code).toBe(0);

    const updatedWorkspacePackageJson = JSON.parse(
      fs.readFileSync(path.join(workspaceDir, "package.json"), {
        encoding: "utf8",
      })
    );
    const updatedPackageAPackageJson = JSON.parse(
      fs.readFileSync(
        path.join(workspaceDir, "packages/package-a/package.json"),
        {
          encoding: "utf8",
        }
      )
    );
    const updatedPackageBPackageJson = JSON.parse(
      fs.readFileSync(
        path.join(workspaceDir, "packages/package-b/package.json"),
        {
          encoding: "utf8",
        }
      )
    );

    expect(
      semver.gt(updatedWorkspacePackageJson.dependencies.gatsby, "2.0.0")
    ).toBe(true);
    expect(
      semver.gt(updatedWorkspacePackageJson.dependencies["gatsby-cli"], "2.0.0")
    ).toBe(true);

    expect(updatedPackageAPackageJson).toMatchInlineSnapshot(`
      Object {
        "devDependencies": Object {
          "react": "16.14.0",
          "react-dom": "16.14.0",
        },
        "name": "package-a",
        "peerDependencies": Object {
          "react": "16.x",
        },
        "private": true,
        "version": "1.0.0",
      }
    `);
    expect(updatedPackageBPackageJson).toMatchInlineSnapshot(`
      Object {
        "dependencies": Object {
          "react-intl": "5.8.8",
        },
        "devDependencies": Object {
          "react": "16.14.0",
          "react-dom": "16.14.0",
        },
        "name": "package-b",
        "peerDependencies": Object {
          "react": "16.x",
        },
        "private": true,
        "version": "1.0.0",
      }
    `);
  });
});
