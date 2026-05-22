# Backlog

Surfaced 2026-05-21 by the octo-ai-client agent during work on octopus/microservices/ai-web/ai-server issues #67–#73. Tracked here until/if migrated to GitHub Issues.

## P1 — `gitlab_create_issue` silently drops assignees

**Symptom.** Passing `assignee_usernames: ["foo"]` returns an issue with `assignees: []`. The tool advertises only `assignee_ids`, but the underlying body builder spreads all args into the POST body and GitLab ignores unknown fields.

**Fix.** Accept `assignee_usernames` in `gitlab_create_issue`, `gitlab_update_issue`, `gitlab_create_merge_request`. Resolve via `GET /users?username=X` before POST. Also add a dedicated `gitlab_set_assignees` tool. Surface a warning in the response if `assignee_usernames` was supplied but the response's `assignees` array is empty.

## P2a — No user-scoped `list assigned issues` tool

**Symptom.** "What issues are assigned to me?" requires the escape-hatch. `gitlab_list_group_issues` only works per-group.

**Fix.** Add `gitlab_list_assigned_issues` wrapping `GET /issues?assignee_id|assignee_username&state&scope=all`. Compact projection. Optional `project` filter.

## P2b — `gitlab_api_request` responses are huge and unfiltered

**Symptom.** 105 KB for 17 issues, 58 KB for 4 notes — busts the inline token budget. Big offenders: `description`, `task_completion_status`, `_links`, `closed_by`.

**Fix.** Add two optional args to `gitlab_api_request`:
- `fields: string[]` — projection (applied to each element if response is an array).
- `slim: boolean` — auto-strip a known noise denylist on array responses.

Both default to no-op, so existing callers are unaffected.

## P3 — System notes flood `list mr notes` / no `list issue notes`

**Symptom.** `/projects/:id/issues/:iid/notes` and the MR equivalent return system-generated `mentioned in commit X` notes mixed in with real comments — 90% noise on a busy issue.

**Fix.**
- Add `include_system_notes: boolean` (default `false`) to `gitlab_list_mr_notes`.
- Add a new `gitlab_list_issue_notes` tool with the same flag.
