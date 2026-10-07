import { registerPasskey, signInWithPasskey } from "./passkeys.js";
import { authenticate, request } from "./api.js";
const $ = (id) => document.getElementById(id);
const columns = ["Backlog", "Ready", "In Progress", "Review", "Done"];
let projects = [],
  cards = [],
  current = null,
  editingProject = null,
  pending = false;
function element(tag, text, className) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (className) e.className = className;
  return e;
}
function option(value, label) {
  const e = element("option", label);
  e.value = value;
  return e;
}
function message(error, target = "message") {
  $(target).textContent = error.message ?? String(error);
  if (error.status === 409 && target === "card-message")
    $("reload-card").hidden = false;
}
function loginRequired(error) {
  $("workspace").hidden = true;
  $("logout").hidden = true;
  $("login-panel").hidden = false;
  $("login-error").textContent = error.message;
  for (const dialog of document.querySelectorAll("dialog[open]"))
    dialog.close();
}
function safely(fn, target = "message") {
  return async (event) => {
    event?.preventDefault();
    if (pending) return;
    pending = true;
    const controls = $("card-dialog").open
      ? [...$("card-dialog").querySelectorAll("button")].map((b) => [
          b,
          b.disabled,
        ])
      : [];
    const trigger = event?.currentTarget;
    if (
      trigger instanceof HTMLButtonElement &&
      !controls.some(([b]) => b === trigger)
    )
      controls.push([trigger, trigger.disabled]);
    for (const [b] of controls) {
      b.disabled = true;
      b.setAttribute("aria-busy", "true");
    }
    try {
      await fn(event);
    } catch (error) {
      if (error.status === 401) loginRequired(error);
      else message(error, target);
    } finally {
      for (const [b, disabled] of controls) {
        b.disabled = disabled;
        b.removeAttribute("aria-busy");
      }
      pending = false;
    }
  };
}
async function refresh() {
  [projects, cards] = await Promise.all([
    request("/api/projects"),
    request("/api/cards"),
  ]);
  const selected = $("project-filter").value;
  $("project-filter").replaceChildren(
    option("", "All projects"),
    ...projects.map((p) => option(p.id, p.name)),
  );
  $("project-filter").value = selected;
  $("create-project").replaceChildren(
    ...projects.map((p) => option(p.id, p.name)),
  );
  $("new-card").disabled = !projects.length;
  $("project-settings").disabled = !$("project-filter").value;
  render();
}
function render() {
  const selected = $("project-filter").value;
  const visible = cards.filter((c) => !selected || c.projectId === selected);
  const project = projects.find((p) => p.id === selected);
  $("board-title").textContent = project?.name ?? "Project board";
  $("board-summary").textContent = projects.length
    ? `${visible.length} cards · ${visible.filter((c) => c.column === "In Progress").length} in progress · ${visible.filter((c) => c.blockedReason).length} blocked`
    : "Register a repository to begin.";
  $("project-list").replaceChildren(
    ...projects.map((p) => {
      const b = element("button", p.name, selected === p.id ? "active" : "");
      b.append(
        element(
          "span",
          String(cards.filter((c) => c.projectId === p.id).length),
        ),
      );
      b.onclick = () => {
        $("project-filter").value = p.id;
        $("project-settings").disabled = false;
        render();
      };
      return b;
    }),
  );
  $("board").replaceChildren(
    ...columns.map((column) => {
      const section = element("section", undefined, "column");
      section.dataset.column = column;
      section.setAttribute("role", "region");
      section.setAttribute("aria-label", column);
      const items = visible.filter((c) => c.column === column);
      const heading = element("h2", column);
      heading.append(element("span", String(items.length), "count"));
      section.append(heading);
      if (!items.length)
        section.append(element("p", "No cards here", "empty-column"));
      for (const c of items) {
        const article = element("article", undefined, "task");
        article.draggable = true;
        article.ondragstart = (e) => e.dataTransfer.setData("text/plain", c.id);
        article.append(
          element(
            "p",
            projects.find((p) => p.id === c.projectId)?.name ?? "",
            "task-project",
          ),
        );
        const button = element("button", c.title, "task-heading");
        button.onclick = safely(() => openCard(c.id));
        article.append(button);
        if (c.blockedReason)
          article.append(element("p", c.blockedReason, "blocker"));
        const footer = element("div", undefined, "task-footer");
        footer.append(
          element("span", c.priority, `tag ${c.priority}`),
          element("span", c.phase),
        );
        if (c.owner) footer.append(element("span", c.owner));
        article.append(footer);
        section.append(article);
      }
      section.ondragover = (e) => e.preventDefault();
      section.ondrop = safely(async (e) => {
        const card = cards.find(
          (c) => c.id === e.dataTransfer.getData("text/plain"),
        );
        if (!card) return;
        const result = await request(`/api/cards/${card.id}/move`, {
          method: "POST",
          body: { column, expectedRevision: card.revision },
        });
        $("message").textContent =
          result.warnings.join(" ") || `Moved to ${column}.`;
        await refresh();
      });
      return section;
    }),
  );
}
function fillCard() {
  for (const [field, key] of [
    ["title", "title"],
    ["description", "description"],
    ["priority", "priority"],
    ["phase", "phase"],
    ["owner", "owner"],
    ["blocker", "blockedReason"],
  ])
    $(`card-${field}`).value = current[key] ?? "";
  $("card-artifacts").value = current.artifacts
    .map((a) => `${a.path} | ${a.label}`)
    .join("\n");
  $("move-column").value = current.column;
  $("reload-card").hidden = true;
}
async function details() {
  $("card-context").textContent =
    `${projects.find((p) => p.id === current.projectId)?.name ?? ""} · ${current.column} · revision ${current.revision}`;
  const latest = current.evidence
    .filter((e) => e.workRevision === current.workRevision)
    .at(-1);
  $("verification-status").textContent =
    latest?.outcome === "passed"
      ? "Passing evidence recorded for current work."
      : "Current work needs passing evidence.";
  $("evidence-list").replaceChildren(
    ...current.evidence
      .slice()
      .reverse()
      .map((e) => {
        const li = element("li", `${e.name}: ${e.outcome}`);
        li.append(
          element("span", `${e.summary} · work revision ${e.workRevision}`),
        );
        return li;
      }),
  );
  const events = await request(`/api/cards/${current.id}/events`);
  $("event-list").replaceChildren(
    ...events.map((e) => {
      const li = element("li");
      li.append(
        element("strong", e.action),
        element(
          "span",
          `${e.actor.client} · ${new Date(e.at).toLocaleString()}${e.reason ? ` · ${e.reason}` : ""}`,
        ),
      );
      return li;
    }),
  );
}
async function openCard(id) {
  current = await request(`/api/cards/${id}`);
  $("card-message").textContent = "";
  $("override-panel").hidden = true;
  $("override-reason").value = "";
  $("override-confirm").disabled = true;
  fillCard();
  await details();
  $("card-dialog").showModal();
}
async function move(reason) {
  const result = await request(`/api/cards/${current.id}/move`, {
    method: "POST",
    body: {
      column: $("move-column").value,
      expectedRevision: current.revision,
      ...(reason ? { overrideReason: reason } : {}),
    },
  });
  current = result.card;
  $("card-message").textContent =
    result.warnings.join(" ") || `Moved to ${current.column}.`;
  $("override-panel").hidden = true;
  await details();
  await refresh();
}
for (const button of document.querySelectorAll("[data-close]"))
  button.onclick = () => $(button.dataset.close).close();
$("refresh").onclick = safely(refresh);
$("project-filter").onchange = () => {
  $("project-settings").disabled = !$("project-filter").value;
  render();
};
$("add-project").onclick = () => {
  editingProject = null;
  $("project-form").reset();
  $("project-heading").textContent = "Add project";
  $("project-submit").textContent = "Register project";
  $("root-label").hidden = false;
  $("project-root").required = true;
  $("wip-label").hidden = true;
  $("project-error").textContent = "";
  $("project-dialog").showModal();
};
$("project-settings").onclick = () => {
  editingProject = projects.find((p) => p.id === $("project-filter").value);
  $("project-name").value = editingProject.name;
  $("project-wip").value = editingProject.wipLimit ?? "";
  $("project-heading").textContent = "Project settings";
  $("project-submit").textContent = "Save project";
  $("root-label").hidden = true;
  $("project-root").required = false;
  $("wip-label").hidden = false;
  $("project-error").textContent = "";
  $("project-dialog").showModal();
};
$("project-form").onsubmit = safely(async () => {
  const p = editingProject
    ? await request(`/api/projects/${editingProject.id}`, {
        method: "PATCH",
        body: {
          name: $("project-name").value,
          wipLimit: $("project-wip").value
            ? Number($("project-wip").value)
            : null,
          expectedRevision: editingProject.revision,
        },
      })
    : await request("/api/projects", {
        method: "POST",
        body: {
          name: $("project-name").value,
          root: $("project-root").value,
          expectedRevision: 0,
        },
      });
  $("project-dialog").close();
  await refresh();
  $("project-filter").value = p.id;
  $("project-settings").disabled = false;
  render();
}, "project-error");
$("new-card").onclick = () => {
  $("create-form").reset();
  $("create-project").value = $("project-filter").value || projects[0].id;
  $("create-error").textContent = "";
  $("create-dialog").showModal();
};
$("create-form").onsubmit = safely(async () => {
  await request("/api/cards", {
    method: "POST",
    body: {
      projectId: $("create-project").value,
      title: $("create-title").value,
      description: $("create-description").value,
      expectedRevision: 0,
    },
  });
  $("create-dialog").close();
  await refresh();
}, "create-error");
$("card-form").onsubmit = safely(async () => {
  const artifacts = $("card-artifacts")
    .value.split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      const [path, ...label] = line.split("|");
      return {
        path: path.trim(),
        label: label.join("|").trim() || path.trim(),
      };
    });
  current = await request(`/api/cards/${current.id}`, {
    method: "PATCH",
    body: {
      title: $("card-title").value,
      description: $("card-description").value,
      priority: $("card-priority").value,
      phase: $("card-phase").value,
      owner: $("card-owner").value || null,
      blockedReason: $("card-blocker").value || null,
      artifacts,
      expectedRevision: current.revision,
    },
  });
  $("card-message").textContent = "Changes saved.";
  fillCard();
  await details();
  await refresh();
}, "card-message");
$("move-card").onclick = safely(() => move(), "card-message");
$("override-toggle").onclick = () => {
  $("override-panel").hidden = !$("override-panel").hidden;
};
$("override-reason").oninput = () => {
  $("override-confirm").disabled = !$("override-reason").value.trim();
};
$("override-confirm").onclick = safely(
  () => move($("override-reason").value),
  "card-message",
);
$("reload-card").onclick = safely(async () => {
  current = await request(`/api/cards/${current.id}`);
  fillCard();
  await details();
  $("card-message").textContent =
    "Current version loaded. Reapply any edits you still need.";
  await refresh();
}, "card-message");
$("evidence-form").onsubmit = safely(async () => {
  current = await request(`/api/cards/${current.id}/evidence`, {
    method: "POST",
    body: {
      name: $("check-name").value,
      outcome: $("check-outcome").value,
      summary: $("check-summary").value,
      ...($("check-revision").value
        ? { sourceRevision: $("check-revision").value }
        : {}),
      expectedRevision: current.revision,
    },
  });
  $("card-message").textContent = "Evidence recorded.";
  await details();
  await refresh();
}, "card-message");
$("delete-card").onclick = safely(async () => {
  if (!confirm("Delete this card? Activity remains in the local history."))
    return;
  await request(
    `/api/cards/${current.id}?expectedRevision=${current.revision}`,
    { method: "DELETE" },
  );
  $("card-dialog").close();
  await refresh();
}, "card-message");
async function load() {
  try {
    await authenticate();
    await refresh();
    $("login-panel").hidden = true;
    $("workspace").hidden = false;
    $("logout").hidden = false;
    $("message").textContent = "";
    await refreshPasskeys();
  } catch (error) {
    if (error.status === 401) loginRequired(error);
    else message(error);
  }
}
$("retry-login").onclick = load;
await load();

async function refreshPasskeys() {
  const list = $("passkey-list");
  list.replaceChildren();
  const keys = await request("/api/passkeys");
  $("passkey-onboarding").hidden =
    keys.length > 0 ||
    sessionStorage.getItem("passkey-onboarding-skipped") === "true";
  if (!$("passkey-onboarding").hidden) $("passkey-settings").open = true;
  for (const key of keys) {
    const row = element("div");
    row.append(
      element("p", "Created " + new Date(key.createdAt).toLocaleString()),
    );
    const remove = element("button", "Remove passkey");
    remove.onclick = safely(async () => {
      await request("/api/passkeys/" + encodeURIComponent(key.id), {
        method: "DELETE",
      });
      await load();
    }, "passkey-message");
    row.append(remove);
    list.append(row);
  }
}
$("passkey-settings").addEventListener("toggle", () => {
  if ($("passkey-settings").open)
    refreshPasskeys().catch((e) => message(e, "passkey-message"));
});
$("create-passkey").onclick = safely(async () => {
  await registerPasskey();
  $("passkey-message").textContent =
    "Passkey created. Your board is ready; next time, choose Sign in with passkey.";
  await refreshPasskeys();
}, "passkey-message");
$("verify-passkey").onclick = safely(async () => {
  await signInWithPasskey();
  $("passkey-message").textContent =
    "Passkey verified. You can manage passkeys for five minutes.";
}, "passkey-message");
$("passkey-login").onclick = safely(async () => {
  await signInWithPasskey();
  await load();
}, "login-error");
if (location.hostname !== "localhost") {
  const link = $("localhost-link");
  link.hidden = false;
  link.href = "http://localhost:" + location.port + "/";
  $("passkey-login").disabled = true;
} else if (!window.PublicKeyCredential) {
  $("passkey-login").disabled = true;
  $("passkey-support").textContent =
    "Passkeys are unavailable in this browser. Open Chrome or use CLI recovery.";
}

$("logout").onclick = safely(async () => {
  await request("/api/logout", { method: "POST", body: {} });
  location.replace("/");
});

$("skip-passkey").onclick = () => {
  sessionStorage.setItem("passkey-onboarding-skipped", "true");
  $("passkey-onboarding").hidden = true;
  $("passkey-settings").open = false;
};
$("copy-setup-command").onclick = safely(async () => {
  await navigator.clipboard.writeText($("setup-command").textContent);
  $("setup-message").textContent =
    "Copied. Replace the data directory before running in Terminal.";
}, "setup-message");
