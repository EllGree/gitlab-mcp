# gitlab-mcp

MCP server for GitLab API. Works with self-hosted GitLab instances and gitlab.com.

Provides tools for issues, merge requests, code review, pipelines, milestones, releases, search, and file access.

## Prerequisites

- Node.js >= 18
- npm
- GitLab Personal Access Token with `api` scope

## Installation

```bash
git clone <repo-url> gitlab-mcp
cd gitlab-mcp
npm install
npm run build
```

## Configuration

Create `config.json` in the project root:

```json
{
  "token": "glpat-your-token-here",
  "apiUrl": "https://your-gitlab-instance.com/api/v4"
}
```

For gitlab.com, use `"apiUrl": "https://gitlab.com/api/v4"` or omit the field entirely.

Alternatively, set environment variables instead of using `config.json`:

```bash
export GITLAB_PERSONAL_ACCESS_TOKEN="glpat-your-token-here"
export GITLAB_API_URL="https://your-gitlab-instance.com/api/v4"
```

### Creating a GitLab token

1. Go to GitLab > Settings > Access Tokens
2. Create a token with **`api`** scope
3. Copy the token into `config.json`

## Adding to Claude Code

Add the server to your Claude Code MCP settings (`~/.claude/settings.json` or project-level `.claude/settings.local.json`):

```json
{
  "mcpServers": {
    "gitlab": {
      "command": "node",
      "args": ["/absolute/path/to/gitlab-mcp/index.js"]
    }
  }
}
```

Restart Claude Code or run `/mcp` to connect.

## Available tools

### Issues

| Tool | Description |
|------|-------------|
| `gitlab_get_issue` | Get a single issue by project and IID |
| `gitlab_list_group_issues` | List issues in a group with filters (state, labels, assignee, search, milestone) |
| `gitlab_list_milestone_issues` | List issues in a milestone |
| `gitlab_create_issue` | Create a new issue |
| `gitlab_update_issue` | Update issue (state, title, description, labels, assignee, milestone) |
| `gitlab_add_comment` | Add a comment to an issue |

### Merge Requests

| Tool | Description |
|------|-------------|
| `gitlab_list_merge_requests` | List MRs with filters (state, author, reviewer, assignee, date, target branch). Project is optional — omit for cross-project search. |
| `gitlab_get_merge_request` | Get a single MR by project and IID |
| `gitlab_get_mr_changes` | Get the diff / changed files of an MR |
| `gitlab_list_mr_notes` | List comments/notes on an MR |
| `gitlab_add_mr_note` | Add a general comment to an MR |
| `gitlab_create_mr_discussion` | Create an inline diff comment on a specific file and line |

### Projects, Milestones, Releases

| Tool | Description |
|------|-------------|
| `gitlab_list_projects` | List projects in a group |
| `gitlab_list_milestones` | List milestones in a group |
| `gitlab_list_releases` | List releases for a project |

### Search & Files

| Tool | Description |
|------|-------------|
| `gitlab_search` | Search within a project (code, issues, MRs, commits, notes) |
| `gitlab_get_file` | Get file contents from a repository |
| `gitlab_list_pipelines` | List CI/CD pipelines with filters (status, ref) |

### Generic escape hatch

| Tool | Description |
|------|-------------|
| `gitlab_api_request` | Call any GitLab REST API endpoint directly. Use when no dedicated tool exists. Takes `method` (GET/POST/PUT/PATCH/DELETE), `path` (e.g. `/projects/93/merge_requests/2387/notes/74875`), and optional `body`. |

Example — edit an existing MR note:

```
gitlab_api_request({
  method: "PUT",
  path: "/projects/93/merge_requests/2387/notes/74875",
  body: { body: "Updated comment text" }
})
```

## Example usage in Claude Code

```
> Review MR !2397 in octopus/reunion/client

Claude will use gitlab_get_merge_request, gitlab_get_mr_changes,
and gitlab_create_mr_discussion to review and leave inline comments.
```

## Development

```bash
# Edit index.ts, then rebuild
npm run build

# Reconnect in Claude Code
/mcp
```
