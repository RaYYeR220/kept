import { YouCamHttpError, YouCamTaskError } from "./errors.ts";
import { FEATURES, taskPath, type FeatureKey } from "./features.ts";
import type { Ledger } from "./ledger.ts";
import type { Transport } from "./transport.ts";

export const YOUCAM_BASE_URL = "https://yce-api-01.makeupar.com";

export type YouCamOptions = {
  apiKey: string;
  baseUrl?: string;
  transport?: Transport;
  ledger?: Ledger;
  /** Used as the ledger session when a call doesn't pass one. */
  defaultSession?: string;
  sleep?: (ms: number) => Promise<void>;
};

export type RunOptions = { sessionId?: string; pollMs?: number; maxPolls?: number };

export type TaskOutcome<R = Record<string, unknown>> = {
  taskId: string;
  results: R;
  units: number;
  api: string;
  version: string;
};

type Envelope<T> = { status: number; data?: T; result?: T; results?: T; error?: string; error_code?: string; error_message?: string };

export function createYouCam(opts: YouCamOptions) {
  const base = opts.baseUrl ?? YOUCAM_BASE_URL;
  const transport = opts.transport ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const auth = { Authorization: `Bearer ${opts.apiKey}` };

  async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const res = await transport(`${base}${path}`, {
      method,
      headers: body === undefined ? auth : { ...auth, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let env: Envelope<T>;
    try {
      env = (await res.json()) as Envelope<T>;
    } catch {
      throw new YouCamHttpError(res.status, null, `YouCam returned ${res.status} with a non-JSON body`);
    }
    if (!res.ok || (env.status && env.status >= 400)) {
      throw new YouCamHttpError(res.status, env.error_code ?? null, env.error ?? env.error_message ?? `YouCam ${res.status}`);
    }
    // Task endpoints answer in `data`; credit and feature-cost answer in `results` / `result`.
    return (env.data ?? env.result ?? env.results) as T;
  }

  /** Two-step upload: register the file, then PUT the bytes to the presigned URL with its exact headers. */
  async function upload(bytes: Uint8Array, contentType: "image/jpeg" | "image/png", fileName: string) {
    const data = await request<{ files: Array<{ file_id: string; requests: Array<{ method: string; url: string; headers: Record<string, string> }> }> }>(
      "POST",
      "/s2s/v2.0/file",
      { files: [{ content_type: contentType, file_name: fileName, file_size: bytes.byteLength }] },
    );
    const file = data.files[0];
    const put = file?.requests[0];
    if (!file || !put) throw new YouCamHttpError(500, null, "File API returned no upload request");
    const res = await transport(put.url, { method: put.method, headers: put.headers, body: bytes as unknown as BodyInit });
    if (!res.ok) throw new YouCamHttpError(res.status, null, `Upload PUT failed with ${res.status}`);
    return { fileId: file.file_id };
  }

  async function run<R = Record<string, unknown>>(key: FeatureKey, body: Record<string, unknown>, ro: RunOptions = {}): Promise<TaskOutcome<R>> {
    const spec = FEATURES[key];
    const units = spec.estimateUnits(body);
    const session = ro.sessionId ?? opts.defaultSession ?? "default";
    const reservation = opts.ledger ? await opts.ledger.reserve(units, session) : null;
    let taskId: string | null = null;
    try {
      const started = await request<{ task_id: string }>("POST", taskPath(key), body);
      taskId = started.task_id;
      const maxPolls = ro.maxPolls ?? 40;
      for (let i = 0; i < maxPolls; i++) {
        const st = await request<{ task_status: string; results?: R; error?: string | null; error_message?: string | null }>(
          "GET",
          `${taskPath(key)}/${encodeURIComponent(taskId)}`,
        );
        if (st.task_status === "success") {
          if (reservation) opts.ledger!.commit(reservation);
          return { taskId, results: (st.results ?? {}) as R, units, api: spec.api, version: spec.version };
        }
        if (st.task_status === "error") {
          throw new YouCamTaskError(st.error ?? "unknown_internal_error", taskId, st.error_message ?? undefined);
        }
        await sleep(ro.pollMs ?? 2000);
      }
      throw new YouCamTaskError("task_timeout", taskId, "The measurement took too long. Please try again.");
    } catch (e) {
      if (reservation) opts.ledger!.release(reservation);
      throw e;
    }
  }

  return {
    upload,
    run,
    deleteTask: (taskId: string) => request<unknown>("POST", "/s2s/v2.0/task/delete", { task_id: taskId }),
    credit: async () => {
      const d = await request<{ amount?: number } | Array<{ amount?: number }>>("GET", "/s2s/v1.0/client/credit");
      return Array.isArray(d) ? d.reduce((s, x) => s + (x.amount ?? 0), 0) : (d.amount ?? 0);
    },
    featureCost: () => request<unknown>("GET", "/s2s/v2.0/credit/feature-cost"),
  };
}

export type YouCam = ReturnType<typeof createYouCam>;
