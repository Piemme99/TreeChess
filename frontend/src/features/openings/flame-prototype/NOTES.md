# Prototype — rendu du flame graph

**Question** : comment rendre le flame graph lisible, alors qu'à la racine deux tuiles sur trois
font moins de 6 px, qu'une étiquette sur dix-sept tient, que la couleur ne dit rien sur 80 %
des tuiles du joueur et que la moitié basse est vide ? (mesure du 17/10/2026, côté blanc, 800 px)

Route : `/dev/flame-graph?flame=` sur la vraie page Openings, bascule par la barre en bas
(flèches ← → au clavier). Les quatre rendus partagent l'état de zoom : on compare à position égale.

| Clé | Rendu | Parti pris |
|---|---|---|
| `0` | Actuel | point de comparaison |
| `K` | Pruned | même structure, toutes les propositions : miettes fondues dans une tuile hachurée « … » par parent (seuil 28 px, donc dépendant du zoom), profondeur coupée quand une rangée couvre moins de 40 % (après 6 rangées) et rendue au zoom (arbre à 24 demi-coups au lieu de 16), gris qui recule et vert désaturé, priorités repérées sur le graphe (pastille numérotée ; point = cachée dessous), rangées adverses 14 px, figurines et `coup · parties · score` quand ça tient, carte au survol |
| `L` | Player rows | plus de rangées adverses : une rangée par coup du joueur, une tuile = (coup adverse, réponse). Graphe deux fois moins haut, le coup adverse en préfixe discret, tuiles d'un même coup adverse serrées. **Contredit** la décision du README « coups adverses = rangées grises fines » |
| `M` | Heat | carte de chaleur : tuiles plates bord à bord, couleur continue (déficit lissé, saturée à ±12 pts), moyenne = couleur du papier, filets de 7 px pour les coups adverses, étiquettes rares, bandeau sous le graphe qui suit le survol à la place de la bulle |

Propositions **non** prototypées : rien, tout y est ; la caméra à ressort et `Échap` existaient déjà.

## Verdict

_À remplir après lecture par PMG._ Ce qui est à garder, ce qui est à jeter, et dans quel rendu.
Ensuite : fondre le gagnant dans `flame/` proprement (tests sur `prune.ts`), supprimer ce dossier
et le point d'injection `renderFlame` de `OpeningsPage`.
