#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, "config.json");

let TOKEN = "";
let BASE_URL = "https://gitlab.com/api/v4";

try {
  const config = JSON.parse(readFileSync(configPath, "utf-8").replace(/^\uFEFF/, ""));
  TOKEN = config.token || process.env.GITLAB_PERSONAL_ACCESS_TOKEN || "";
  BASE_URL = config.apiUrl || process.env.GITLAB_API_URL || BASE_URL;
} catch {
  TOKEN = process.env.GITLAB_PERSONAL_ACCESS_TOKEN || "";
  BASE_URL = process.env.GITLAB_API_URL || BASE_URL;
}

async function gitlabFetch(path: string, method = "GET", body?: object) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "PRIVATE-TOKEN": TOKEN,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`GitLab API error: ${res.status} ${await res.text()}`);
  return res.json();
}

const server = new Server(
  { name: "gitlab-mcp", version: "1.4.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // ── Issues ──────────────────────────────────────────────
    {
      name: "gitlab_get_issue",
      description: "Get a single GitLab issue by project and issue number",
      inputSchema: {
        type: "object",
        properties: {
          project: { type: "string", description: "Project path e.g. octopus/microservices/ai-web/ai-server" },
          issue_iid: { type: "number", description: "Issue number (IID)" },
        },
        required: ["project", "issue_iid"],
      },
    },
    {
      name: "gitlab_list_group_issues",
      description: "List issues in a GitLab group with optional filters",
      inputSchema: {
        type: "object",
        properties: {
          group: { type: "string", description: "Group path" },
          state: { type: "string", enum: ["opened", "closed", "all"], default: "opened" },
          labels: { type: "string", description: "Comma-separated labels" },
          assignee_username: { type: "string" },
          search: { type: "string" },
          milestone: { type: "string", description: "Milestone title" },
        },
        required: ["group"],
      },
    },
    {
      name: "gitlab_list_milestone_issues",
      description: "List issues in a GitLab milestone",
      inputSchema: {
        type: "object",
        properties: {
          group: { type: "string", description: "Group path e.g. octopus/microservices/ai-web" },
          milestone_id: { type: "number", description: "Milestone ID" },
          state: { type: "string", enum: ["opened", "closed", "all"], default: "all" },
        },
        required: ["group", "milestone_id"],
      },
    },
    {
      name: "gitlab_create_issue",
      description: "Create a new GitLab issue",
      inputSchema: {
        type: "object",
        properties: {
          project: { type: "string", description: "Project path" },
          title: { type: "string" },
          description: { type: "string" },
          labels: { type: "string", description: "Comma-separated labels" },
          milestone_id: { type: "number" },
          assignee_usernames: { type: "array", items: { type: "string" } },
        },
        required: ["project", "title"],
      },
    },
    {
      name: "gitlab_update_issue",
      description: "Update a GitLab issue (state, labels, assignee, etc.)",
      inputSchema: {
        type: "object",
        properties: {
          project: { type: "string", description: "Project path" },
          issue_iid: { type: "number" },
          state_event: { type: "string", enum: ["close", "reopen"] },
          title: { type: "string" },
          description: { type: "string" },
          labels: { type: "string" },
          milestone_id: { type: "number" },
          assignee_usernames: { type: "array", items: { type: "string" } },
        },
        required: ["project", "issue_iid"],
      },
    },
    {
      name: "gitlab_add_comment",
      description: "Add a comment to a GitLab issue",
      inputSchema: {
        type: "object",
        properties: {
          project: { type: "string", description: "Project path" },
          issue_iid: { type: "number" },
          body: { type: "string" },
        },
        required: ["project", "issue_iid", "body"],
      },
    },
    // ── Merge Requests ──────────────────────────────────────
    {
      name: "gitlab_list_merge_requests",
      description: "List merge requests in a GitLab project",
      inputSchema: {
        type: "object",
        properties: {
          project: { type: "string", description: "Project path e.g. octopus/customer-portal/server. Omit for cross-project search (requires reviewer_username or assignee_username)." },
          state: { type: "string", enum: ["opened", "closed", "merged", "all"], default: "all" },
          author_username: { type: "string" },
          reviewer_username: { type: "string" },
          assignee_username: { type: "string" },
          created_after: { type: "string", description: "ISO 8601 date e.g. 2024-10-01" },
          target_branch: { type: "string" },
        },
        required: [],
      },
    },
    {
      name: "gitlab_get_merge_request",
      description: "Get a single merge request by project and MR number",
      inputSchema: {
        type: "object",
        properties: {
          project: { type: "string", description: "Project path e.g. octopus/reunion/client" },
          mr_iid: { type: "number", description: "Merge request number (IID)" },
        },
        required: ["project", "mr_iid"],
      },
    },
    {
      name: "gitlab_get_mr_changes",
      description: "Get the diff / changed files of a merge request",
      inputSchema: {
        type: "object",
        properties: {
          project: { type: "string", description: "Project path" },
          mr_iid: { type: "number", description: "Merge request number (IID)" },
        },
        required: ["project", "mr_iid"],
      },
    },
    {
      name: "gitlab_list_mr_notes",
      description: "List comments/notes on a merge request",
      inputSchema: {
        type: "object",
        properties: {
          project: { type: "string", description: "Project path" },
          mr_iid: { type: "number", description: "Merge request number (IID)" },
        },
        required: ["project", "mr_iid"],
      },
    },
    {
      name: "gitlab_add_mr_note",
      description: "Add a comment to a merge request",
      inputSchema: {
        type: "object",
        properties: {
          project: { type: "string", description: "Project path" },
          mr_iid: { type: "number", description: "Merge request number (IID)" },
          body: { type: "string", description: "Comment text (markdown supported)" },
        },
        required: ["project", "mr_iid", "body"],
      },
    },
    {
      name: "gitlab_api_request",
      description: "Generic escape hatch — call any GitLab REST API endpoint directly. Use this when no dedicated tool exists for the operation you need (e.g. editing notes, approving MRs, managing branches, etc.). The path is appended to the configured base URL.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"], description: "HTTP method" },
          path: { type: "string", description: "API path starting with /, e.g. /projects/93/merge_requests/2387/notes/74875" },
          body: { type: "object", description: "Optional JSON body for POST/PUT/PATCH requests", additionalProperties: true },
        },
        required: ["method", "path"],
      },
    },
    {
      name: "gitlab_create_merge_request",
      description: "Create a new merge request",
      inputSchema: {
        type: "object",
        properties: {
          project: { type: "string", description: "Project path" },
          source_branch: { type: "string", description: "Source branch name" },
          target_branch: { type: "string", description: "Target branch name (default: main/dev)" },
          title: { type: "string", description: "MR title" },
          description: { type: "string", description: "MR description (markdown supported)" },
          assignee_id: { type: "number", description: "Assignee user ID" },
          reviewer_ids: { type: "array", items: { type: "number" }, description: "Reviewer user IDs" },
          squash: { type: "boolean", description: "Squash commits on merge (default: true)" },
          remove_source_branch: { type: "boolean", description: "Remove source branch after merge (default: true)" },
        },
        required: ["project", "source_branch", "title"],
      },
    },
    {
      name: "gitlab_create_mr_discussion",
      description: "Create an inline diff comment (discussion) on a merge request at a specific file and line",
      inputSchema: {
        type: "object",
        properties: {
          project: { type: "string", description: "Project path" },
          mr_iid: { type: "number", description: "Merge request number (IID)" },
          body: { type: "string", description: "Comment text (markdown supported)" },
          new_path: { type: "string", description: "File path in the new version (e.g. src/hooks/useFoo.ts)" },
          new_line: { type: "number", description: "Line number in the new version of the file" },
          old_path: { type: "string", description: "File path in the old version (defaults to new_path if omitted)" },
          old_line: { type: "number", description: "Line number in the old version (omit for lines that only exist in new version)" },
        },
        required: ["project", "mr_iid", "body", "new_path", "new_line"],
      },
    },
    // ── Projects, Milestones, Releases ──────────────────────
    {
      name: "gitlab_list_projects",
      description: "List projects in a GitLab group",
      inputSchema: {
        type: "object",
        properties: {
          group: { type: "string", description: "Group path" },
        },
        required: ["group"],
      },
    },
    {
      name: "gitlab_list_milestones",
      description: "List milestones in a GitLab group",
      inputSchema: {
        type: "object",
        properties: {
          group: { type: "string", description: "Group path" },
          state: { type: "string", enum: ["active", "closed", "all"], default: "active" },
        },
        required: ["group"],
      },
    },
    {
      name: "gitlab_list_releases",
      description: "List releases for a GitLab project",
      inputSchema: {
        type: "object",
        properties: {
          project: { type: "string", description: "Project path e.g. octopus/microservices/ai-web/ai-client" },
          per_page: { type: "number", description: "Results per page (default 20)", default: 20 },
        },
        required: ["project"],
      },
    },
    // ── Search & Files ──────────────────────────────────────
    {
      name: "gitlab_search",
      description: "Search within a GitLab project (code, issues, merge_requests, etc.)",
      inputSchema: {
        type: "object",
        properties: {
          project: { type: "string", description: "Project path" },
          scope: { type: "string", enum: ["issues", "merge_requests", "milestones", "blobs", "commits", "notes"], description: "Search scope" },
          search: { type: "string", description: "Search query" },
        },
        required: ["project", "scope", "search"],
      },
    },
    {
      name: "gitlab_get_file",
      description: "Get the contents of a file from a GitLab repository",
      inputSchema: {
        type: "object",
        properties: {
          project: { type: "string", description: "Project path" },
          file_path: { type: "string", description: "Path to the file e.g. src/main.ts" },
          ref: { type: "string", description: "Branch, tag or commit SHA (default: default branch)" },
        },
        required: ["project", "file_path"],
      },
    },
    {
      name: "gitlab_list_pipelines",
      description: "List CI/CD pipelines for a project",
      inputSchema: {
        type: "object",
        properties: {
          project: { type: "string", description: "Project path" },
          status: { type: "string", enum: ["running", "pending", "success", "failed", "canceled", "skipped", "manual"], description: "Filter by status" },
          ref: { type: "string", description: "Filter by branch or tag" },
          per_page: { type: "number", description: "Results per page (default 20)", default: 20 },
        },
        required: ["project"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  try {
    let result: any;

    switch (name) {
      // ── Issues ──────────────────────────────────────────────
      case "gitlab_get_issue": {
        const project = encodeURIComponent(args.project as string);
        result = await gitlabFetch(`/projects/${project}/issues/${args.issue_iid}`);
        break;
      }
      case "gitlab_list_group_issues": {
        const group = encodeURIComponent(args.group as string);
        const params = new URLSearchParams({ state: (args.state as string) || "opened", per_page: "50" });
        if (args.labels) params.set("labels", args.labels as string);
        if (args.assignee_username) params.set("assignee_username", args.assignee_username as string);
        if (args.search) params.set("search", args.search as string);
        if (args.milestone) params.set("milestone", args.milestone as string);
        const raw = await gitlabFetch(`/groups/${group}/issues?${params}`);
        result = raw.map((i: any) => ({
          id: i.id, iid: i.iid, project_id: i.project_id,
          title: i.title, state: i.state,
          labels: i.labels,
          assignees: i.assignees?.map((a: any) => a.username),
          milestone: i.milestone?.title,
          web_url: i.web_url,
          created_at: i.created_at,
        }));
        break;
      }
      case "gitlab_list_milestone_issues": {
        const group = encodeURIComponent(args.group as string);
        const milestones = await gitlabFetch(`/groups/${group}/milestones?per_page=100`);
        const milestone = milestones.find((m: any) => m.id === args.milestone_id || m.iid === args.milestone_id);
        if (!milestone) throw new Error(`Milestone ${args.milestone_id} not found`);
        const params = new URLSearchParams({
          milestone: milestone.title,
          state: (args.state as string) || "all",
          per_page: "100",
        });
        const rawM = await gitlabFetch(`/groups/${group}/issues?${params}`);
        result = rawM.map((i: any) => ({
          id: i.id, iid: i.iid, project_id: i.project_id,
          title: i.title, state: i.state,
          labels: i.labels,
          assignees: i.assignees?.map((a: any) => a.username),
          milestone: i.milestone?.title,
          web_url: i.web_url,
        }));
        break;
      }
      case "gitlab_create_issue": {
        const project = encodeURIComponent(args.project as string);
        result = await gitlabFetch(`/projects/${project}/issues`, "POST", args);
        break;
      }
      case "gitlab_update_issue": {
        const project = encodeURIComponent(args.project as string);
        const iid = args.issue_iid;
        const { project: _p, issue_iid: _i, ...body } = args as any;
        result = await gitlabFetch(`/projects/${project}/issues/${iid}`, "PUT", body);
        break;
      }
      case "gitlab_add_comment": {
        const project = encodeURIComponent(args.project as string);
        result = await gitlabFetch(`/projects/${project}/issues/${args.issue_iid}/notes`, "POST", { body: args.body });
        break;
      }
      // ── Merge Requests ──────────────────────────────────────
      case "gitlab_list_merge_requests": {
        const params = new URLSearchParams({ state: (args.state as string) || "all", per_page: "100" });
        if (args.author_username) params.set("author_username", args.author_username as string);
        if (args.reviewer_username) params.set("reviewer_username", args.reviewer_username as string);
        if (args.assignee_username) params.set("assignee_username", args.assignee_username as string);
        if (args.created_after) params.set("created_after", args.created_after as string);
        if (args.target_branch) params.set("target_branch", args.target_branch as string);
        let endpoint: string;
        if (args.project) {
          const project = encodeURIComponent(args.project as string);
          endpoint = `/projects/${project}/merge_requests?${params}`;
        } else {
          params.set("scope", "all");
          endpoint = `/merge_requests?${params}`;
        }
        const raw = await gitlabFetch(endpoint);
        result = raw.map((mr: any) => ({
          iid: mr.iid,
          title: mr.title,
          state: mr.state,
          source_branch: mr.source_branch,
          target_branch: mr.target_branch,
          author: mr.author?.username,
          assignees: mr.assignees?.map((a: any) => a.username),
          reviewers: mr.reviewers?.map((r: any) => r.username),
          created_at: mr.created_at,
          merged_at: mr.merged_at,
          web_url: mr.web_url,
        }));
        break;
      }
      case "gitlab_get_merge_request": {
        const project = encodeURIComponent(args.project as string);
        result = await gitlabFetch(`/projects/${project}/merge_requests/${args.mr_iid}`);
        break;
      }
      case "gitlab_get_mr_changes": {
        const project = encodeURIComponent(args.project as string);
        const mr = await gitlabFetch(`/projects/${project}/merge_requests/${args.mr_iid}/changes`);
        result = {
          title: mr.title,
          state: mr.state,
          changes_count: mr.changes_count,
          changes: mr.changes?.map((c: any) => ({
            old_path: c.old_path,
            new_path: c.new_path,
            new_file: c.new_file,
            deleted_file: c.deleted_file,
            renamed_file: c.renamed_file,
            diff: c.diff,
          })),
        };
        break;
      }
      case "gitlab_list_mr_notes": {
        const project = encodeURIComponent(args.project as string);
        const raw = await gitlabFetch(`/projects/${project}/merge_requests/${args.mr_iid}/notes?per_page=100`);
        result = raw.map((n: any) => ({
          id: n.id,
          body: n.body,
          author: n.author?.username,
          created_at: n.created_at,
          system: n.system,
          resolvable: n.resolvable,
          resolved: n.resolved,
        }));
        break;
      }
      case "gitlab_add_mr_note": {
        const project = encodeURIComponent(args.project as string);
        result = await gitlabFetch(`/projects/${project}/merge_requests/${args.mr_iid}/notes`, "POST", { body: args.body });
        break;
      }
      case "gitlab_api_request": {
        result = await gitlabFetch(args.path as string, args.method as string, args.body as object | undefined);
        break;
      }
      case "gitlab_create_merge_request": {
        const project = encodeURIComponent(args.project as string);
        const body: Record<string, unknown> = {
          source_branch: args.source_branch,
          target_branch: args.target_branch || "dev",
          title: args.title,
          squash: args.squash ?? true,
          remove_source_branch: args.remove_source_branch ?? true,
        };
        if (args.description) body.description = args.description;
        if (args.assignee_id) body.assignee_id = args.assignee_id;
        if (args.reviewer_ids) body.reviewer_ids = args.reviewer_ids;
        result = await gitlabFetch(`/projects/${project}/merge_requests`, "POST", body);
        break;
      }
      case "gitlab_create_mr_discussion": {
        const project = encodeURIComponent(args.project as string);
        const mr = await gitlabFetch(`/projects/${project}/merge_requests/${args.mr_iid}`);
        const position: Record<string, unknown> = {
          position_type: "text",
          base_sha: mr.diff_refs.base_sha,
          head_sha: mr.diff_refs.head_sha,
          start_sha: mr.diff_refs.start_sha,
          new_path: args.new_path as string,
          old_path: (args.old_path as string) || (args.new_path as string),
          new_line: args.new_line as number,
        };
        if (args.old_line != null) {
          position.old_line = args.old_line as number;
        }
        result = await gitlabFetch(
          `/projects/${project}/merge_requests/${args.mr_iid}/discussions`,
          "POST",
          { body: args.body, position }
        );
        break;
      }
      // ── Projects, Milestones, Releases ──────────────────────
      case "gitlab_list_projects": {
        const group = encodeURIComponent(args.group as string);
        result = await gitlabFetch(`/groups/${group}/projects?per_page=50`);
        break;
      }
      case "gitlab_list_milestones": {
        const group = encodeURIComponent(args.group as string);
        const params = new URLSearchParams({ state: (args.state as string) || "active" });
        result = await gitlabFetch(`/groups/${group}/milestones?${params}`);
        break;
      }
      case "gitlab_list_releases": {
        const project = encodeURIComponent(args.project as string);
        const perPage = (args.per_page as number) || 20;
        result = await gitlabFetch(`/projects/${project}/releases?per_page=${perPage}`);
        break;
      }
      // ── Search & Files ──────────────────────────────────────
      case "gitlab_search": {
        const project = encodeURIComponent(args.project as string);
        const params = new URLSearchParams({
          scope: args.scope as string,
          search: args.search as string,
        });
        result = await gitlabFetch(`/projects/${project}/search?${params}`);
        break;
      }
      case "gitlab_get_file": {
        const project = encodeURIComponent(args.project as string);
        const filePath = encodeURIComponent(args.file_path as string);
        const ref = args.ref ? `?ref=${encodeURIComponent(args.ref as string)}` : "";
        const file = await gitlabFetch(`/projects/${project}/repository/files/${filePath}${ref}`);
        result = {
          file_name: file.file_name,
          file_path: file.file_path,
          size: file.size,
          encoding: file.encoding,
          ref: file.ref,
          content: file.encoding === "base64" ? Buffer.from(file.content, "base64").toString("utf-8") : file.content,
        };
        break;
      }
      case "gitlab_list_pipelines": {
        const project = encodeURIComponent(args.project as string);
        const params = new URLSearchParams({ per_page: String((args.per_page as number) || 20) });
        if (args.status) params.set("status", args.status as string);
        if (args.ref) params.set("ref", args.ref as string);
        const raw = await gitlabFetch(`/projects/${project}/pipelines?${params}`);
        result = raw.map((p: any) => ({
          id: p.id,
          status: p.status,
          ref: p.ref,
          sha: p.sha?.substring(0, 8),
          created_at: p.created_at,
          updated_at: p.updated_at,
          web_url: p.web_url,
        }));
        break;
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err: any) {
    return {
      content: [{ type: "text", text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

async function main() {
  if (!TOKEN) {
    process.stderr.write("Error: GITLAB_PERSONAL_ACCESS_TOKEN is required\n");
    process.exit(1);
  }
  process.on('uncaughtException', (err) => {
    process.stderr.write(`Uncaught exception: ${err.message}\n`);
  });
  process.on('unhandledRejection', (reason) => {
    process.stderr.write(`Unhandled rejection: ${reason}\n`);
  });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("GitLab MCP server running\n");
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
