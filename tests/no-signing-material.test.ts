import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { closeSync, existsSync, openSync, readFileSync, readSync, statSync } from "node:fs";

/**
 * Guards against committing signing keys again. Reads only file NAMES and the first 4 bytes
 * (format magic) — never key contents.
 */
const SIGNING_FILE =
  /\.(jks|keystore|p12|pfx|pepk|pem|key|der)(\.(gpg|b64))?$|(^|\/)(keystore|signing)\.properties$|(^|\/)local\.properties$/i;

function trackedFiles(): string[] {
  const out = execFileSync("git", ["ls-files", "-z"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  // Present files only: a deletion staged but not yet committed is already removed.
  return out.split("\0").filter((f) => f && existsSync(f));
}

function magic(path: string): string {
  try {
    if (statSync(path).size < 4) return "";
    const fd = openSync(path, "r");
    const buf = Buffer.alloc(4);
    readSync(fd, buf, 0, 4, 0);
    closeSync(fd);
    return buf.toString("hex");
  } catch {
    return ""; // listed in the index but deleted in the working tree
  }
}

describe("no signing material in the repository", () => {
  const files = trackedFiles();

  it("tracks no keystore, certificate, private-key or signing-config files", () => {
    expect(files.filter((f) => SIGNING_FILE.test(f))).toEqual([]);
  });

  it("the retired release keystore is gone from the working tree", () => {
    expect(() => statSync("android/winstone-release.jks")).toThrow();
  });

  it("tracks no Java keystore by content, whatever its name (JKS magic FEEDFEED)", () => {
    const binaryish = files.filter(
      (f) =>
        !/\.(ts|tsx|js|mjs|json|md|css|html|sql|kt|kts|xml|yml|yaml|txt|svg|lock|toml|sh|py)$/i.test(
          f,
        ),
    );
    expect(binaryish.filter((f) => magic(f) === "feedfeed")).toEqual([]);
  });

  it(".gitignore keeps blocking keystores and signing configs", () => {
    const ignore = readFileSync(".gitignore", "utf8");
    for (const rule of [
      "*.jks",
      "*.keystore",
      "*.p12",
      "*.pfx",
      "*.pem",
      "*.key",
      "*.jks.gpg",
      "keystore.properties",
      "local.properties",
    ]) {
      expect(ignore.split("\n").map((l) => l.trim())).toContain(rule);
    }
  });
});
