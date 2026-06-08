use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::models::ShowMatchHistoryWindowResponse;

const MATCH_HISTORY_WINDOW_LABEL: &str = "match-history";
const MATCH_HISTORY_WINDOW_TITLE: &str = "INFINITAS Arena - Match History";

fn append_match_history_view(mut url: tauri::Url) -> tauri::Url {
    url.query_pairs_mut().append_pair("view", "match-history");
    url
}

fn match_history_window_url(app: &AppHandle) -> WebviewUrl {
    #[cfg(debug_assertions)]
    if let Some(url) = app.config().build.dev_url.clone() {
        return WebviewUrl::External(append_match_history_view(url));
    }

    WebviewUrl::App("index.html?view=match-history".into())
}

#[tauri::command]
pub async fn show_match_history_window(
    app: AppHandle,
) -> Result<ShowMatchHistoryWindowResponse, String> {
    if let Some(window) = app.get_webview_window(MATCH_HISTORY_WINDOW_LABEL) {
        window
            .set_focus()
            .map_err(|error| format!("Failed to focus match history window: {error}"))?;
        return Ok(ShowMatchHistoryWindowResponse {
            focused_existing: true,
        });
    }

    WebviewWindowBuilder::new(
        &app,
        MATCH_HISTORY_WINDOW_LABEL,
        match_history_window_url(&app),
    )
    .title(MATCH_HISTORY_WINDOW_TITLE)
    .inner_size(720.0, 900.0)
    .min_inner_size(520.0, 480.0)
    .resizable(true)
    .build()
    .map_err(|error| format!("Failed to create match history window: {error}"))?;

    Ok(ShowMatchHistoryWindowResponse {
        focused_existing: false,
    })
}

#[cfg(test)]
mod tests {
    use super::append_match_history_view;

    #[test]
    fn append_match_history_view_keeps_multi_instance_query() {
        let url = tauri::Url::parse(
            "http://localhost:1420/?instance=client-a&INF_ARENA_PROFILE=client-a",
        )
        .expect("valid URL");

        let url = append_match_history_view(url);
        let query = url.query_pairs().collect::<Vec<_>>();

        assert!(query.contains(&("instance".into(), "client-a".into())));
        assert!(query.contains(&("INF_ARENA_PROFILE".into(), "client-a".into())));
        assert!(query.contains(&("view".into(), "match-history".into())));
    }
}
