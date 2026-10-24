import { describe, it, expect } from "vitest";
import { parsePlace, hasPlace, locationFit, isOnline } from "@/lib/location";

describe("parsePlace", () => {
  it("reads city and state abbreviations", () => {
    expect(parsePlace("Brooklyn, NY")).toMatchObject({ city: "new york", state: "NY" });
  });
  it("reads full state names", () => {
    expect(parsePlace("Fremont, California")).toMatchObject({ city: "fremont", state: "CA" });
  });
  it("reads a state on its own", () => {
    expect(parsePlace("Florida")).toMatchObject({ city: null, state: "FL" });
  });
  it("reads a city and state without a comma", () => {
    expect(parsePlace("Fremont CA")).toMatchObject({ city: "fremont", state: "CA" });
  });
  it("treats Washington DC spellings the same", () => {
    expect(parsePlace("Washington, D.C.").state).toBe("DC");
    expect(parsePlace("Washington, DC").state).toBe("DC");
  });
  it("returns nothing for empty or null text", () => {
    expect(hasPlace(parsePlace(""))).toBe(false);
    expect(hasPlace(parsePlace("null"))).toBe(false);
  });
  it("does not use place matching for non-US students", () => {
    expect(hasPlace(parsePlace("Toronto, ON", "Canada"))).toBe(false);
  });
});

describe("locationFit", () => {
  const fremont = parsePlace("Fremont, CA");

  it("boosts online programs for everyone", () => {
    expect(locationFit(fremont, { location: "Online" }).kind).toBe("online");
    expect(locationFit(null, { format: "virtual", location: "Cambridge, MA" }).kind).toBe("online");
  });
  it("treats nationwide programs as neutral and open", () => {
    const fit = locationFit(fremont, { location: "Nationwide" });
    expect(fit.kind).toBe("national");
    expect(fit.score).toBeGreaterThan(0);
  });
  it("boosts the same city more than the same state", () => {
    const city = locationFit(fremont, { location: "Fremont, CA", format: "in_person" });
    const state = locationFit(fremont, { location: "Stanford, CA", format: "in_person" });
    expect(city.kind).toBe("city");
    expect(state.kind).toBe("state");
    expect(city.score).toBeGreaterThan(state.score);
  });
  it("mildly penalizes in-person programs in another state", () => {
    const fit = locationFit(fremont, { location: "Boston, MA", format: "in_person" });
    expect(fit.kind).toBe("elsewhere");
    expect(fit.score).toBeLessThan(0);
    expect(fit.label).toBe("Travel needed");
  });
  it("does not penalize when travel is covered or the program is hybrid", () => {
    expect(locationFit(fremont, { location: "Boston, MA", description: "Housing and travel are covered for all participants." }).score).toBe(0);
    expect(locationFit(fremont, { location: "Boston, MA", format: "hybrid" }).score).toBe(0);
  });
  it("has no effect when either location is unknown", () => {
    expect(locationFit(fremont, { location: null }).score).toBe(0);
    expect(locationFit(fremont, { location: "null" }).score).toBe(0);
    expect(locationFit(parsePlace(""), { location: "Boston, MA" }).score).toBe(0);
  });
  it("uses the best match when a program lists several places", () => {
    const fit = locationFit(fremont, { location: "Boston, MA; Berkeley, CA" });
    expect(fit.kind).toBe("state");
  });
  it("splits lists of states and keeps the best match", () => {
    expect(locationFit(fremont, { location: "California, Nevada" }).kind).toBe("state");
    expect(locationFit(fremont, { location: "Maryland, Virginia, and DC" }).kind).toBe("elsewhere");
  });
  it("does not split Oregon from its city", () => {
    expect(locationFit(fremont, { location: "Portland, OR", format: "in_person" }).kind).toBe("elsewhere");
  });
  it("penalizes foreign in-person programs for US students with a location", () => {
    expect(locationFit(fremont, { location: "Geneva, Switzerland", format: "in_person" }).kind).toBe("elsewhere");
  });
  it("matches a city-only profile against the same city", () => {
    const fit = locationFit(parsePlace("Fremont"), { location: "Fremont, CA" });
    expect(fit.kind).toBe("city");
  });
  it("ignores the remote flag on a located in-person program", () => {
    expect(isOnline({ remote: true, format: "in_person", location: "Boston, MA" })).toBe(false);
  });
});

import { cleanLocation } from "@/lib/location";

describe("cleanLocation", () => {
  it("hides placeholder values", () => {
    for (const v of [null, undefined, "", "null", "NULL", "None", "N/A", "unknown"]) expect(cleanLocation(v)).toBeNull();
  });
  it("collapses repeated Online text", () => {
    expect(cleanLocation("Online Online")).toBe("Online");
    expect(cleanLocation("Online, Online")).toBe("Online");
    expect(cleanLocation("online / online")).toBe("online");
  });
  it("keeps real locations and drops duplicate segments", () => {
    expect(cleanLocation("Cambridge, MA")).toBe("Cambridge, MA");
    expect(cleanLocation("Boston, MA; Boston, MA")).toBe("Boston, MA");
    expect(cleanLocation("Boston, MA; null")).toBe("Boston, MA");
  });
});
