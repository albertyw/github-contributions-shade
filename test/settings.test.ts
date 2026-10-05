import { expect } from "@wdio/globals";

import {
  STORAGE_KEY,
  normalizeLogin,
  parseUsers,
  profileLogin,
  validLogin,
  validThresholds,
} from "../src/settings.js";

describe("STORAGE_KEY", function() {
  it("is the sync storage key holding every user", function() {
    expect(STORAGE_KEY).toBe("users");
  });
});

describe("normalizeLogin", function() {
  it("trims and lowercases", function() {
    expect(normalizeLogin("  AlbertYW \n")).toBe("albertyw");
  });
  it("drops a leading @ from a pasted mention", function() {
    expect(normalizeLogin(" @AlbertYW")).toBe("albertyw");
    expect(normalizeLogin("@@albertyw")).toBe("@albertyw");
  });
});

describe("validLogin", function() {
  it("accepts GitHub-shaped logins in any case", function() {
    expect(validLogin("albertyw")).toBe(true);
    expect(validLogin(" AlbertYW ")).toBe(true);
    expect(validLogin("a-b-c")).toBe(true);
    expect(validLogin("octocat_acme")).toBe(true);
    expect(validLogin("a-b_c")).toBe(true);
    expect(validLogin("@octocat")).toBe(true);
    expect(validLogin("a".repeat(39))).toBe(true);
  });
  it("rejects logins GitHub would not allow", function() {
    expect(validLogin("")).toBe(false);
    expect(validLogin("@")).toBe(false);
    expect(validLogin("-albert")).toBe(false);
    expect(validLogin("albert-")).toBe(false);
    expect(validLogin("al--bert")).toBe(false);
    expect(validLogin("_albert")).toBe(false);
    expect(validLogin("albert_")).toBe(false);
    expect(validLogin("al__bert")).toBe(false);
    expect(validLogin("al_-bert")).toBe(false);
    expect(validLogin("al-_bert")).toBe(false);
    expect(validLogin("a".repeat(40))).toBe(false);
  });
});

describe("validThresholds", function() {
  it("accepts four strictly increasing integers of at least 1", function() {
    expect(validThresholds([1, 7, 13, 19])).toBe(true);
    expect(validThresholds([2, 3, 4, 5])).toBe(true);
  });
  it("rejects anything else", function() {
    expect(validThresholds("1,7,13,19")).toBe(false);
    expect(validThresholds(null)).toBe(false);
    expect(validThresholds([1, 7, 13])).toBe(false);
    expect(validThresholds([1, 7, 13, 19, 25])).toBe(false);
    expect(validThresholds([0, 7, 13, 19])).toBe(false);
    expect(validThresholds([1, 7.5, 13, 19])).toBe(false);
    expect(validThresholds([1, 7, 7, 19])).toBe(false);
    expect(validThresholds([1, 13, 7, 19])).toBe(false);
    expect(validThresholds([1, "7", 13, 19])).toBe(false);
    expect(validThresholds([1, 7, 13, Infinity])).toBe(false);
  });
});

describe("parseUsers", function() {
  it("treats a non-object as empty", function() {
    expect(parseUsers(undefined).size).toBe(0);
    expect(parseUsers(null).size).toBe(0);
    expect(parseUsers("albertyw").size).toBe(0);
    expect(parseUsers([[1, 7, 13, 19]]).size).toBe(0);
  });
  it("keeps valid entries keyed by normalized login", function() {
    const users = parseUsers({ AlbertYW: [1, 7, 13, 19], octocat: [1, 3, 6, 10] });
    expect([...users.entries()]).toEqual([
      ["albertyw", [1, 7, 13, 19]],
      ["octocat", [1, 3, 6, 10]],
    ]);
  });
  it("drops entries with a bad login or bad thresholds", function() {
    const users = parseUsers({
      "-bad-": [1, 7, 13, 19],
      octocat: "1,3,6,10",
      ghost: [3, 2, 1, 0],
      albertyw: [1, 7, 13, 19],
    });
    expect([...users.keys()]).toEqual(["albertyw"]);
  });
});

describe("profileLogin", function() {
  it("reads the normalized login from a profile path", function() {
    expect(profileLogin("/AlbertYW")).toBe("albertyw");
    expect(profileLogin("/albertyw/")).toBe("albertyw");
    expect(profileLogin("/Octocat_ACME")).toBe("octocat_acme");
  });
  it("reads the first segment of a deeper path", function() {
    expect(profileLogin("/albertyw/repo")).toBe("albertyw");
  });
  it("returns null when there is no valid login", function() {
    expect(profileLogin("/")).toBeNull();
    expect(profileLogin("")).toBeNull();
    expect(profileLogin("/-bad-")).toBeNull();
    expect(profileLogin(`/${"a".repeat(40)}`)).toBeNull();
  });
});
