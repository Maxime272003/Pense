# Pense

Des post-it sur ton bureau Windows, dans le style de [Fini](https://github.com/Maxime272003/Fini-).
Chaque note est une petite fenêtre que tu poses où tu veux, avec une couleur et, si besoin, un rappel à une heure précise.

- Cahier des charges : [`docs/CDC.md`](docs/CDC.md)
- Maquettes : https://claude.ai/artifact/G4hyBVCofjBDeYnU5wrBNs

## Utiliser

| Action | Comment |
|---|---|
| Nouvelle note | `Ctrl+Alt+N` (n'importe où) ou menu de l'icône › *Nouvelle note*. Elle apparaît près de la souris, curseur prêt. |
| Afficher / masquer les notes | `Ctrl+Alt+P` ou clic sur l'icône. Si les notes sont derrière tes fenêtres, le raccourci les ramène devant. |
| Déplacer | Tire la note par le haut (le scotch). |
| Couleur, rappel, supprimer | Survole la note : les trois boutons apparaissent en haut à droite. |
| Rouvrir une note supprimée | Menu de l'icône › *Rouvrir la note supprimée* (les 10 dernières sont gardées). |
| Rappel | La note passe devant tout, gigote, et une notification Windows s'affiche. *Vu* l'arrête, *+10 min* le repousse. |

Une note vide qu'on quitte disparaît toute seule. Une nouvelle note prend la dernière couleur utilisée.
Les raccourcis se changent dans *Réglages* (menu de l'icône).

## Installer

Télécharge le `Pense_…_x64-setup.exe` de la dernière
[Release](https://github.com/Maxime272003/Pense/releases/latest) et lance-le : il s'installe sans droits administrateur.
Ensuite l'app se met à jour toute seule.

Tes notes sont dans `Documents\Pense\pense.json` (une copie par jour dans `Documents\Pense\backups`, les 7 dernières sont gardées).

## Mises à jour

- **Push sur `main`** → le workflow **Release** compile l'app, lui donne la version `0.1.<numéro du run>`,
  signe l'installateur et publie une Release GitHub avec un fichier `latest.json`.
- **Dans l'app** → Pense lit ce `latest.json` au démarrage puis toutes les 6 heures. Si une version plus récente existe,
  le menu de l'icône propose *Installer la mise à jour* (aussi dans *Réglages*).
- **Les autres branches** → le workflow **Build Windows** vérifie seulement que tout compile.

Les mises à jour sont signées. La clé publique est dans `src-tauri/tauri.conf.json` ; la clé privée doit être
enregistrée **une seule fois** dans les secrets du dépôt :

1. GitHub › *Settings* › *Secrets and variables* › *Actions* › *New repository secret*.
2. Nom : `TAURI_SIGNING_PRIVATE_KEY`, valeur : le contenu du fichier de clé privée (une seule ligne).

Garde une copie de cette clé en lieu sûr : sans elle, les versions installées ne peuvent plus se mettre à jour.

## Développer

Prérequis sous Windows : [Node.js 22](https://nodejs.org), [Rust](https://rustup.rs)
et les « Outils de génération C++ » de Visual Studio (voir les
[prérequis Tauri](https://v2.tauri.app/start/prerequisites/)).

```bash
npm install
```

```bash
npm run tauri dev
```

Pour travailler l'interface dans un navigateur (les notes sont alors posées dans la page, données dans `localStorage`) :

```bash
npm run dev
```

Vérifications et tests :

```bash
npm run check
```

```bash
npm test
```

Construire l'installateur localement, sans signature de mise à jour :

```bash
npm run tauri build -- --config src-tauri/tauri.unsigned.conf.json
```

## Organisation

| Fichier | Contenu |
|---|---|
| `src/lib/model.ts` | Données et règles : créer, modifier, supprimer, rouvrir une note, rappels arrivés |
| `src/lib/reminder.ts` | Calcul et affichage des heures de rappel |
| `src/lib/pense.svelte.ts` | Le chef d'orchestre (fenêtre principale cachée) : données, fenêtres des notes, raccourcis, rappels, mises à jour |
| `src/lib/tray.ts` | Menu de l'icône de notification |
| `src/lib/platform.ts` | Tout ce qui touche au système (fichiers, fenêtres, raccourcis, notifications) |
| `src/components/Note.svelte` | Une note : texte, couleur, rappel, sonnerie |
| `src/components/NoteWindow.svelte` | La fenêtre d'une note, reliée à la fenêtre principale par des événements |
| `src/components/Settings.svelte` | L'écran de réglages |
| `src-tauri/src/lib.rs` | Lecture / écriture atomique du fichier, sauvegardes quotidiennes, plugins |
