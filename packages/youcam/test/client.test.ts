import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createYouCam } from "../src/client.ts";
import { YouCamHttpError, YouCamTaskError, mapEngineError } from "../src/errors.ts";
import { FEATURES } from "../src/features.ts";
import { BudgetError, Ledger } from "../src/ledger.ts";
import { recordingTransport, replayTransport, scriptedTransport } from "../src/transport.ts";

const noSleep = async () => {};
const TONE = "/s2s/v2.0/task/skin-tone-analysis";

const toneResult = {
  face_quality: { has_face: true, area: "good", frontal: "good", lighting: "good", faceangle: "good" },
  color: { skin_color: "#b9947c", eyebrow_color: "#5b2b31", hair_color: "#42280E", hair_color_name: "Brown", lip_color: "#d23245", eye_color: "#293f9b", eye_color_name: "Brown" },
};

describe("createYouCam.run", () => {
  it("starts a task, polls until success, returns results and units", async () => {
    const t = scriptedTransport({
      [`POST ${TONE}`]: { status: 200, body: { status: 200, data: { task_id: "abc" } } },
      [`GET ${TONE}/abc`]: [
        { status: 200, body: { status: 200, data: { task_status: "running" } } },
        { status: 200, body: { status: 200, data: { task_status: "success", results: toneResult } } },
      ],
    });
    const yc = createYouCam({ apiKey: "k", transport: t, sleep: noSleep });
    const out = await yc.run<typeof toneResult>("skinTone", { src_file_id: "f1" });
    expect(out.taskId).toBe("abc");
    expect(out.results.color.eyebrow_color).toBe("#5b2b31");
    expect(out.units).toBe(20);
    expect(out.api).toBe("skin-tone-analysis");
    expect(new Headers(t.calls[0]!.init.headers).get("Authorization")).toBe("Bearer k");
  });

  it("turns an engine error into YouCamTaskError with a retake sentence", async () => {
    const t = scriptedTransport({
      [`POST ${TONE}`]: { status: 200, body: { status: 200, data: { task_id: "e1" } } },
      [`GET ${TONE}/e1`]: { status: 200, body: { status: 200, data: { task_status: "error", error: "error_src_face_too_small" } } },
    });
    const yc = createYouCam({ apiKey: "k", transport: t, sleep: noSleep });
    const err = await yc.run("skinTone", { src_file_id: "f1" }).catch((e) => e);
    expect(err).toBeInstanceOf(YouCamTaskError);
    expect(err.code).toBe("error_src_face_too_small");
    expect(err.retake).toMatch(/closer/);
  });

  it("maps an invalid key to YouCamHttpError with its error_code", async () => {
    const t = scriptedTransport({
      [`POST ${TONE}`]: { status: 401, body: { status: 401, error: "This API key is not recognized.", error_code: "InvalidApiKey" } },
    });
    const yc = createYouCam({ apiKey: "bad", transport: t, sleep: noSleep });
    const err = await yc.run("skinTone", {}).catch((e) => e);
    expect(err).toBeInstanceOf(YouCamHttpError);
    expect(err.code).toBe("InvalidApiKey");
  });

  it("commits units on success and releases them on failure", async () => {
    const ledger = new Ledger({ globalCap: 100, sessionCap: 50 });
    const ok = scriptedTransport({
      [`POST ${TONE}`]: { status: 200, body: { status: 200, data: { task_id: "a" } } },
      [`GET ${TONE}/a`]: { status: 200, body: { status: 200, data: { task_status: "success", results: toneResult } } },
    });
    await createYouCam({ apiKey: "k", transport: ok, ledger, sleep: noSleep }).run("skinTone", {}, { sessionId: "s" });
    expect(ledger.snapshot().spent).toBe(20);

    const bad = scriptedTransport({
      [`POST ${TONE}`]: { status: 200, body: { status: 200, data: { task_id: "b" } } },
      [`GET ${TONE}/b`]: { status: 200, body: { status: 200, data: { task_status: "error", error: "error_no_face" } } },
    });
    await createYouCam({ apiKey: "k", transport: bad, ledger, sleep: noSleep }).run("skinTone", {}, { sessionId: "s" }).catch(() => {});
    expect(ledger.snapshot()).toMatchObject({ spent: 20, held: 0 });
    expect(ledger.sessionSpent("s")).toBe(20);
  });

  it("refuses to start a task past the session cap, without calling the API", async () => {
    const ledger = new Ledger({ globalCap: 100, sessionCap: 15 });
    const t = scriptedTransport({});
    const err = await createYouCam({ apiKey: "k", transport: t, ledger, sleep: noSleep }).run("skinTone", {}, { sessionId: "s" }).catch((e) => e);
    expect(err).toBeInstanceOf(BudgetError);
    expect(err.reason).toBe("session_cap");
    expect(t.calls).toHaveLength(0);
  });

  it("holds the caps under parallel reservations with an async credit read", async () => {
    const ledger = new Ledger({ globalCap: 1000, sessionCap: 40, readCredit: async () => 1000 });
    const tries = await Promise.allSettled(Array.from({ length: 6 }, () => ledger.reserve(10, "1.2.3.4|s")));
    expect(tries.filter((t) => t.status === "fulfilled")).toHaveLength(4);
    expect(ledger.sessionSpent("1.2.3.4|s")).toBe(40);
  });

  it("caps an IP across rotated session cookies", async () => {
    const ledger = new Ledger({ globalCap: 1000, sessionCap: 40, ipCap: 60 });
    await ledger.reserve(40, "9.9.9.9|a");
    await ledger.reserve(20, "9.9.9.9|b");
    const err = await ledger.reserve(1, "9.9.9.9|c").catch((e) => e);
    expect(err.reason).toBe("ip_cap");
    await expect(ledger.reserve(10, "8.8.8.8|d")).resolves.toBeTruthy();
  });

  it("stops when the account's real credit is lower than the task needs", async () => {
    const ledger = new Ledger({ globalCap: 1000, sessionCap: 1000, readCredit: async () => 5 });
    const err = await ledger.reserve(20, "s").catch((e) => e);
    expect(err.reason).toBe("credit_low");
  });
});

describe("upload", () => {
  it("registers the file then PUTs bytes with the presigned headers verbatim", async () => {
    const putUrl = "https://yce-us.s3-accelerate.amazonaws.com/demo/ttl30/x?sig=1";
    const t = scriptedTransport({
      "POST /s2s/v2.0/file": {
        status: 200,
        body: { status: 200, data: { files: [{ file_id: "fid", requests: [{ method: "PUT", url: putUrl, headers: { "Content-Length": "3", "Content-Type": "image/jpeg" } }] }] } },
      },
      [`PUT ${putUrl}`]: { status: 200, body: {} },
    });
    const yc = createYouCam({ apiKey: "k", transport: t, sleep: noSleep });
    const { fileId } = await yc.upload(new Uint8Array([1, 2, 3]), "image/jpeg", "a.jpg");
    expect(fileId).toBe("fid");
    const reg = JSON.parse(String(t.calls[0]!.init.body));
    expect(reg.files[0]).toEqual({ content_type: "image/jpeg", file_name: "a.jpg", file_size: 3 });
    expect(t.calls[1]!.init.headers).toEqual({ "Content-Length": "3", "Content-Type": "image/jpeg" });
  });
});

describe("account", () => {
  it("reads the credit balance from the live response shape", async () => {
    const t = scriptedTransport({
      "GET /s2s/v1.0/client/credit": { status: 200, body: { status: 200, results: [{ id: 1, type: "ApiPaygToken", amount: 1000, amount_dec: 1000, expiry: 1801180799000 }] } },
    });
    expect(await createYouCam({ apiKey: "k", transport: t }).credit()).toBe(1000);
  });
});

describe("unit estimates", () => {
  it("prices skin analysis by tier and HD/SD", () => {
    expect(FEATURES.skinAnalysis.estimateUnits({ dst_actions: ["hd_moisture", "hd_redness", "hd_radiance", "hd_texture", "hd_oiliness"] })).toBe(16);
    expect(FEATURES.skinAnalysis.estimateUnits({ dst_actions: ["moisture", "redness"] })).toBe(9);
    expect(FEATURES.faceAttr.estimateUnits({ features: ["a", "b", "c", "d", "e"] })).toBe(10);
    expect(FEATURES.faceAttr.estimateUnits({ features: ["a", "b", "c", "d", "e", "f"] })).toBe(20);
  });
});

describe("mapEngineError", () => {
  it("has a retake sentence for every skin and face capture error", () => {
    for (const code of ["error_no_face", "error_lighting_dark", "error_src_face_out_of_bound", "error_face_angle_upward", "error_hair_too_short"]) {
      expect(mapEngineError(code).retake).toBeTruthy();
    }
    expect(mapEngineError("something_new").retake).toBeNull();
  });
});

describe("record / replay", () => {
  it("replays a recorded call without touching the network", async () => {
    const dir = mkdtempSync(join(tmpdir(), "yc-"));
    const live = scriptedTransport({ [`POST ${TONE}`]: { status: 200, body: { status: 200, data: { task_id: "r1" } } } });
    const rec = recordingTransport(dir, live);
    const init = { method: "POST", body: JSON.stringify({ src_file_id: "f", face_angle_strictness_level: "high" }) };
    await rec(`https://yce-api-01.makeupar.com${TONE}`, init);
    const replay = replayTransport(dir);
    // Same body with keys in a different order hits the same recording.
    const res = await replay(`https://yce-api-01.makeupar.com${TONE}`, { method: "POST", body: JSON.stringify({ face_angle_strictness_level: "high", src_file_id: "f" }) });
    expect(await res.json()).toEqual({ status: 200, data: { task_id: "r1" } });
    const miss = await replay(`https://yce-api-01.makeupar.com${TONE}`, { method: "POST", body: "{}" });
    expect(miss.status).toBe(404);
  });
});
