// src/service/main.ts
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import http from "node:http";
import path from "node:path";

// src/domain/worktree.ts
var parseGitRefOutput = (stdout) => {
  const branches = [];
  for (const line of stdout.split("\n").map((l) => l.trim()).filter(Boolean)) {
    if (line.startsWith("refs/heads/")) branches.push({ name: line.slice("refs/heads/".length), kind: "local" });
    else if (line.startsWith("refs/remotes/")) {
      const name = line.slice("refs/remotes/".length);
      if (!name.endsWith("/HEAD")) branches.push({ name, kind: "remote" });
    }
  }
  return branches;
};

// src/service/main.ts
var port = Number(process.env.OPENCHAMBER_SERVICE_PORT);
var token = process.env.OPENCHAMBER_SERVICE_TOKEN ?? "";
if (!port || !token) {
  console.error("OPENCHAMBER_SERVICE_PORT and OPENCHAMBER_SERVICE_TOKEN are required");
  process.exit(1);
}
var MAX_FILE_BYTES = 1e6;
var MAX_TOTAL_BYTES = 6e6;
var MAX_FILES = 2e3;
var MAX_BODY_BYTES = 4e6;
var SCRATCH = ".scratch";
var json = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};
var git = (directory, args) => new Promise((resolve) => {
  execFile("git", ["-C", directory, ...args], {
    timeout: 15e3,
    maxBuffer: 2 * 1024 * 1024,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" }
  }, (error, stdout, stderr) => {
    if (!error) {
      resolve({ ok: true, stdout });
      return;
    }
    if ("code" in error && error.code === "ENOENT") {
      resolve({ ok: false, status: 500, error: "git is not installed" });
      return;
    }
    if (/not a git repository/i.test(stderr)) {
      resolve({ ok: false, status: 422, error: "not a git repository" });
      return;
    }
    resolve({ ok: false, status: 500, error: stderr.trim() || error.message });
  });
});
var readBody = (req) => new Promise((resolve, reject) => {
  let size = 0;
  const chunks = [];
  req.on("data", (chunk) => {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      reject(new Error("request body too large"));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on("end", () => {
    const text = Buffer.concat(chunks).toString("utf8");
    if (!text.trim()) {
      resolve(null);
      return;
    }
    try {
      resolve(JSON.parse(text));
    } catch {
      reject(new Error("request body must be JSON"));
    }
  });
  req.on("error", reject);
});
var isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
var absoluteDirectory = (value) => {
  if (typeof value !== "string" || !value || value.length > 4096) return null;
  return path.isAbsolute(value) ? path.normalize(value) : null;
};
var scratchRelative = (value) => {
  if (typeof value !== "string" || !value || value.length > 4096) return null;
  const slashed = value.replace(/\\/g, "/").replace(/^\.\//, "");
  if (!slashed.startsWith(`${SCRATCH}/`) || slashed.includes("\0")) return null;
  const parts = slashed.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) return null;
  return parts.join("/");
};
var inside = (root, candidate) => {
  const relative = path.relative(root, candidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
};
var scanScratch = async (directory) => {
  const scratch = path.join(directory, SCRATCH);
  const files = [];
  const warnings = [];
  let complete = true;
  try {
    const stat = await fs.stat(scratch);
    if (!stat.isDirectory()) return { configured: false, files, complete: true, warnings };
  } catch {
    return { configured: false, files, complete: true, warnings };
  }
  let visited = 0;
  let totalBytes = 0;
  const walk = async (relativeDir) => {
    if (!complete) return;
    let entries;
    try {
      entries = await fs.readdir(path.join(directory, relativeDir), { withFileTypes: true });
    } catch (error) {
      complete = false;
      warnings.push(`Could not read ${relativeDir}: ${error.message}`);
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const relative = `${relativeDir}/${entry.name}`;
      if (entry.isSymbolicLink()) {
        warnings.push(`Skipped symlink ${relative}`);
        continue;
      }
      if (entry.isDirectory()) {
        await walk(relative);
        if (!complete) return;
        continue;
      }
      if (!entry.isFile() || !/\.md$/i.test(entry.name)) continue;
      visited += 1;
      if (visited > MAX_FILES) {
        complete = false;
        warnings.push(`Stopped after ${MAX_FILES} markdown files; narrow the scan before trusting the snapshot.`);
        return;
      }
      const absolute = path.join(directory, relative);
      try {
        const stat = await fs.stat(absolute);
        if (stat.size > MAX_FILE_BYTES) {
          warnings.push(`Skipped ${relative}: larger than ${MAX_FILE_BYTES} bytes`);
          complete = false;
          continue;
        }
        if (totalBytes + stat.size > MAX_TOTAL_BYTES) {
          complete = false;
          warnings.push(`Stopped at ${MAX_TOTAL_BYTES} bytes; narrow the project to trust this snapshot.`);
          return;
        }
        totalBytes += stat.size;
        files.push({ path: relative, content: await fs.readFile(absolute, "utf8"), mtimeMs: stat.mtimeMs });
      } catch (error) {
        complete = false;
        warnings.push(`Could not read ${relative}: ${error.message}`);
      }
    }
  };
  await walk(SCRATCH);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { configured: true, files, complete, warnings };
};
var readTriageLabels = async (directory) => {
  try {
    const file = path.join(directory, "docs", "agents", "triage-labels.md");
    const stat = await fs.stat(file);
    if (!stat.isFile() || stat.size > 2e5) return null;
    return await fs.readFile(file, "utf8");
  } catch {
    return null;
  }
};
var detectRemote = async (directory) => {
  const result = await git(directory, ["remote", "get-url", "origin"]);
  if (!result.ok) return null;
  const url = result.stdout.trim();
  if (/github\.com[:/]/i.test(url)) return { host: "github", url };
  if (/gitlab\.com[:/]/i.test(url)) return { host: "gitlab", url };
  return { host: "other", url };
};
var readTicket = async (directory, relative) => {
  const root = path.resolve(directory, SCRATCH);
  const absolute = path.resolve(directory, relative);
  if (!inside(root, absolute) || !/\.md$/i.test(absolute)) return null;
  try {
    const stat = await fs.stat(absolute);
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) return null;
    return { content: await fs.readFile(absolute, "utf8"), mtimeMs: stat.mtimeMs };
  } catch {
    return null;
  }
};
var writeTicket = async (directory, relative, content, expected) => {
  const root = path.resolve(directory, SCRATCH);
  const absolute = path.resolve(directory, relative);
  if (!inside(root, absolute) || !/\.md$/i.test(absolute)) return { ok: false, status: 400, error: "not-writable" };
  if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) return { ok: false, status: 413, error: "ticket is too large" };
  let current;
  try {
    current = await fs.readFile(absolute, "utf8");
  } catch {
    return { ok: false, status: 404, error: "ticket not found" };
  }
  if (current !== expected) return { ok: false, status: 409, error: "ticket changed on disk; reload before writing" };
  try {
    await fs.writeFile(absolute, content, "utf8");
    return { ok: true };
  } catch (error) {
    return { ok: false, status: 500, error: error.message };
  }
};
var commitTicket = async (directory, relative, message) => {
  if (!/\.md$/i.test(relative) || relative.includes("\0")) return { ok: false, status: 400, error: "not-committable" };
  if (!message.trim() || /[\r\n]/.test(message) || message.length > 200) {
    return { ok: false, status: 400, error: "commit message must be one short line" };
  }
  const root = path.resolve(directory, SCRATCH);
  const absolute = path.resolve(directory, relative);
  if (!inside(root, absolute)) return { ok: false, status: 400, error: "not-committable" };
  const pending = await git(directory, ["status", "--porcelain", "--", relative]);
  if (!pending.ok) return { ok: false, status: pending.status, error: pending.error };
  if (!pending.stdout.trim()) return { ok: false, status: 409, error: "nothing to commit" };
  const added = await git(directory, ["add", "--", relative]);
  if (!added.ok) return { ok: false, status: added.status, error: added.error };
  const committed = await git(directory, ["commit", "-m", message, "--", relative]);
  if (!committed.ok) {
    if (/nothing to commit|no changes added/i.test(committed.error)) {
      return { ok: false, status: 409, error: "nothing to commit" };
    }
    return { ok: false, status: committed.status, error: committed.error };
  }
  return { ok: true, commit: committed.stdout.trim() };
};
var server = http.createServer((req, res) => {
  if (req.headers.authorization !== `Bearer ${token}`) {
    json(res, 401, { error: "unauthorized" });
    return;
  }
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const route = `${req.method ?? "GET"} ${url.pathname}`;
  if (route === "GET /health") {
    json(res, 200, { ok: true, version: 2 });
    return;
  }
  if (route === "GET /branches") {
    const directory = absoluteDirectory(url.searchParams.get("directory"));
    if (!directory) {
      json(res, 400, { error: "bad-request" });
      return;
    }
    void git(directory, ["for-each-ref", "--sort=-committerdate", "--count=200", "--format=%(refname)", "refs/heads", "refs/remotes"]).then((result) => {
      if (!result.ok) {
        json(res, result.status, { error: result.error });
        return;
      }
      json(res, 200, { branches: parseGitRefOutput(result.stdout) });
    });
    return;
  }
  if (route === "GET /tickets") {
    const directory = absoluteDirectory(url.searchParams.get("directory"));
    if (!directory) {
      json(res, 400, { error: "bad-request" });
      return;
    }
    void Promise.all([scanScratch(directory), readTriageLabels(directory)]).then(([scan, triageLabels]) => {
      json(res, 200, { ...scan, triageLabels });
    });
    return;
  }
  if (route === "GET /ticket") {
    const directory = absoluteDirectory(url.searchParams.get("directory"));
    const relative = scratchRelative(url.searchParams.get("path"));
    if (!directory || !relative) {
      json(res, 400, { error: "bad-request" });
      return;
    }
    void readTicket(directory, relative).then((ticket) => {
      if (!ticket) {
        json(res, 404, { error: "not-found" });
        return;
      }
      json(res, 200, ticket);
    });
    return;
  }
  if (route === "GET /tracker") {
    const directory = absoluteDirectory(url.searchParams.get("directory"));
    if (!directory) {
      json(res, 400, { error: "bad-request" });
      return;
    }
    void (async () => {
      const scan = await scanScratch(directory);
      const remote = await detectRemote(directory);
      if (scan.configured) {
        json(res, 200, { kind: "local", configured: true, remote });
        return;
      }
      json(res, 200, {
        kind: remote?.host === "github" ? "github" : remote?.host === "gitlab" ? "gitlab" : "none",
        configured: false,
        remote,
        reason: "No .scratch directory in this project. Run /setup-matt-pocock-skills to create the ticket workflow, or choose another project."
      });
    })();
    return;
  }
  if (route === "POST /ticket/write") {
    void (async () => {
      let body;
      try {
        body = await readBody(req);
      } catch (error) {
        json(res, 400, { error: error.message });
        return;
      }
      if (!isRecord(body)) {
        json(res, 400, { error: "bad-request" });
        return;
      }
      const directory = absoluteDirectory(body.directory);
      const relative = scratchRelative(body.path);
      if (!directory || !relative || typeof body.content !== "string" || typeof body.expected !== "string") {
        json(res, 400, { error: "bad-request" });
        return;
      }
      const result = await writeTicket(directory, relative, body.content, body.expected);
      if (result.ok) {
        json(res, 200, { ok: true });
        return;
      }
      json(res, result.status, { error: result.error });
    })();
    return;
  }
  if (route === "POST /ticket/commit") {
    void (async () => {
      let body;
      try {
        body = await readBody(req);
      } catch (error) {
        json(res, 400, { error: error.message });
        return;
      }
      if (!isRecord(body)) {
        json(res, 400, { error: "bad-request" });
        return;
      }
      const directory = absoluteDirectory(body.directory);
      const relative = scratchRelative(body.path);
      if (!directory || !relative || typeof body.message !== "string") {
        json(res, 400, { error: "bad-request" });
        return;
      }
      const result = await commitTicket(directory, relative, body.message);
      if (result.ok) {
        json(res, 200, result);
        return;
      }
      json(res, result.status, { error: result.error });
    })();
    return;
  }
  json(res, 404, { error: "not-found" });
});
server.listen(port, "127.0.0.1");
