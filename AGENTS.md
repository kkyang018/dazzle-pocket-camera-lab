<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- Global prototype state (quiet mode, one-line hints) lives in `AppProvider` (`src/lib/app-state.tsx`) as in-memory React state; photo state must also stay in memory, never in web storage.
- The 390px mobile shell, hint bar and bottom tab bar are rendered in `src/routes/__root.tsx`; each tab is its own route file.
- Shared marks (`ProMark`, `AiMark`, `ApproxTag`) live in `src/components/app/marks.tsx`; reuse them instead of ad-hoc badges so the visual language stays consistent.
- Page surfaces switch via `.theme-warm` / `.theme-paper` classes in `src/styles.css`, which re-map the semantic tokens; quiet mode disables motion through the `data-quiet` attribute.
