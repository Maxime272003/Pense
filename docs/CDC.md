# Pense — cahier des charges

Micro-app Windows de post-it, de la même famille que Fini (couleurs, typo Lilita One + Rubik, Tauri + Svelte).

## Fonctions

| # | Fonction |
|---|---|
| P1 | Chaque note est une fenêtre flottante sans bordure (240 × 240), posée où on veut, sans entrée dans la barre des tâches. |
| P2 | Créer une note : raccourci global `Ctrl+Alt+N` ou menu de l'icône. Elle apparaît près de la souris, curseur dans le texte, dans la dernière couleur utilisée. |
| P3 | Écrire : le texte s'enregistre en continu ; la taille du texte diminue quand il s'allonge. Une note vide qu'on quitte disparaît. |
| P4 | Déplacer : en tirant le haut de la note. La position est gardée ; une note hors écran (écran débranché) est replacée. Redimensionner : en tirant le coin bas-droit (ou un bord), de 200 à 640 px ; la taille est gardée. |
| P5 | Couleur : six couleurs (jaune, rose, bleu, vert, violet, orange). Épingle : une note épinglée reste au premier plan, devant les autres fenêtres (désépinglée par défaut). |
| P6 | Rappel : dans 30 min, dans 1 h, demain 9:00 ou à une heure précise (aujourd'hui, ou demain si l'heure est passée). Un badge affiche l'heure. |
| P7 | Quand le rappel arrive : la note s'affiche devant tout, gigote et s'illumine, avec une notification Windows. *Vu* retire le rappel, *+10 min* le repousse. Un rappel manqué (PC éteint) sonne au lancement suivant. |
| P8 | Supprimer : bouton poubelle. Les 10 dernières notes supprimées peuvent être rouvertes depuis le menu de l'icône. |
| P9 | Afficher / masquer toutes les notes : `Ctrl+Alt+P` ou clic sur l'icône. Une note qui sonne reste visible. |
| P10 | Menu de l'icône : nombre de notes, nouvelle note, afficher / masquer, rouvrir la note supprimée, mise à jour disponible, réglages, quitter. |
| P11 | Réglages : lancement avec Windows, les deux raccourcis modifiables, version, dossier des données, recherche de mise à jour. |
| P12 | Mises à jour automatiques signées depuis les Releases GitHub (comme Fini). |

## Données

`Documents\Pense\pense.json`, écriture atomique, une sauvegarde par jour dans `backups` (7 gardées).

```ts
{
  version: 1,
  notes: { id, text, color, x, y, w, h, rot, remindAt, pinned, createdAt, updatedAt }[], // x, y en pixels physiques ; w, h en pixels CSS (200 à 640)
  trash: { ...note, deletedAt }[],                                          // 10 au plus, la plus récente en premier
  lastColor,
  settings: { launchAtStartup, newShortcut, toggleShortcut }
}
```

## Architecture

- La fenêtre `main`, cachée, pilote tout : données, fenêtres des notes, raccourcis, icône, rappels (vérifiés toutes les 5 s), mises à jour. Elle s'affiche comme écran de réglages.
- Chaque note est une fenêtre `note-<id>` (`index.html?note=<id>`), transparente, qui ne fait que de l'affichage : elle envoie ses actions à `main` et reçoit son état en retour.

## Hors périmètre v1

Listes à cocher, recherche, synchronisation.
