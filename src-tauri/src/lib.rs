use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_opener::OpenerExt;

const DATA_FILE: &str = "pense.json";
const BACKUP_DIR: &str = "backups";
/// Nombre de sauvegardes quotidiennes conservées.
const BACKUPS_KEPT: usize = 7;
/// Argument passé par le lancement automatique avec Windows.
const AUTOSTART_ARG: &str = "--autostart";

/// `Documents\Pense`, créé si besoin.
fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .document_dir()
        .map_err(|e| e.to_string())?
        .join("Pense");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

#[tauri::command]
fn load_data(app: AppHandle) -> Result<Option<String>, String> {
    let path = data_dir(&app)?.join(DATA_FILE);
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(path).map(Some).map_err(|e| e.to_string())
}

/// Écriture atomique : on écrit un fichier temporaire puis on le renomme,
/// pour ne jamais laisser un pense.json à moitié écrit en cas de coupure.
#[tauri::command]
fn save_data(app: AppHandle, contents: String) -> Result<(), String> {
    let dir = data_dir(&app)?;
    let tmp = dir.join("pense.json.tmp");
    fs::write(&tmp, contents).map_err(|e| e.to_string())?;
    fs::rename(&tmp, dir.join(DATA_FILE)).map_err(|e| e.to_string())
}

#[tauri::command]
fn data_file_path(app: AppHandle) -> Result<String, String> {
    Ok(data_dir(&app)?.join(DATA_FILE).display().to_string())
}

#[tauri::command]
fn open_data_dir(app: AppHandle) -> Result<(), String> {
    let dir = data_dir(&app)?;
    app.opener()
        .open_path(dir.display().to_string(), None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn quit(app: AppHandle) {
    app.exit(0);
}

/// Date du jour (UTC) au format AAAA-MM-JJ, sans dépendance externe.
fn today() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    civil_date((secs / 86_400) as i64)
}

/// Jours depuis le 1970-01-01 → date (algorithme « civil from days » de Howard Hinnant).
fn civil_date(days: i64) -> String {
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + if m <= 2 { 1 } else { 0 };
    format!("{y:04}-{m:02}-{d:02}")
}

/// Copie de sécurité quotidienne : `backups/pense-AAAA-MM-JJ.json`, prise au premier lancement
/// du jour (avant toute modification), en gardant les 7 plus récentes.
fn backup(app: &AppHandle) {
    let Ok(dir) = data_dir(app) else { return };
    let data = dir.join(DATA_FILE);
    if !data.exists() {
        return;
    }
    let backups = dir.join(BACKUP_DIR);
    if fs::create_dir_all(&backups).is_err() {
        return;
    }
    let target = backups.join(format!("pense-{}.json", today()));
    if !target.exists() {
        let _ = fs::copy(&data, &target);
    }
    prune_backups(&backups, BACKUPS_KEPT);
}

/// Supprime les sauvegardes les plus anciennes au-delà de `keep` (les noms datés se trient seuls).
fn prune_backups(dir: &std::path::Path, keep: usize) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    let mut files: Vec<PathBuf> = entries
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n.starts_with("pense-") && n.ends_with(".json"))
        })
        .collect();
    files.sort();
    let excess = files.len().saturating_sub(keep);
    for old in &files[..excess] {
        let _ = fs::remove_file(old);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Doit être le premier plugin : un deuxième lancement réaffiche simplement les notes.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = app.emit_to("main", "second-instance", ());
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![AUTOSTART_ARG]),
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            backup(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_data,
            save_data,
            data_file_path,
            open_data_dir,
            quit
        ])
        .run(tauri::generate_context!())
        .expect("impossible de lancer Pense");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dates() {
        assert_eq!(civil_date(0), "1970-01-01");
        assert_eq!(civil_date(19_723), "2024-01-01");
        assert_eq!(civil_date(20_754), "2026-10-28");
        assert_eq!(civil_date(11_016), "2000-02-29");
    }

    #[test]
    fn garde_les_sept_plus_recentes() {
        let dir = std::env::temp_dir().join(format!("pense-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        for d in 1..=10 {
            fs::write(dir.join(format!("pense-2026-10-{d:02}.json")), "{}").unwrap();
        }
        fs::write(dir.join("autre.txt"), "").unwrap();
        prune_backups(&dir, 7);
        let mut left: Vec<String> = fs::read_dir(&dir)
            .unwrap()
            .map(|e| e.unwrap().file_name().into_string().unwrap())
            .collect();
        left.sort();
        assert_eq!(left.len(), 8);
        assert_eq!(left[0], "autre.txt");
        assert_eq!(left[1], "pense-2026-10-04.json");
        fs::remove_dir_all(&dir).unwrap();
    }
}
