# Prototype — Vérifier sur téléphone

Code **jetable**, route servie en développement uniquement : `/prototype/mobile-verify`.
Voir l'ADR 0002 pour les décisions qu'il illustre.

## La question

Quelle forme donner à l'étape Vérifier sur téléphone, une fois la notification de partie tapée ?

- **A — Debrief** : la notification ouvre la partie ; le contexte (coups, écart, scores) vient
  avant l'exercice. L'accueil liste les dernières parties et une révision du jour.
- **B — Session** : la notification ouvre une pile de positions ; on joue d'abord, le contexte de
  la partie n'est révélé qu'après le coup. La préparation proposée devient des cartes à apprendre.
- **C — Line** : l'unité est la ligne entière, rejouée depuis le premier coup ; l'écart de la
  partie n'est qu'un point marqué sur la ligne.

Trois scénarios par variante (`?scenario=`) : partie qui quitte la préparation, partie sans
préparation, jour sans partie (répétition espacée).

## Ce qui est simulé

Parties réelles figées de Piemme78 (chess.com). Aucun moteur : la « préparation » est l'habitude
du joueur sur les positions jouées au moins 25 fois ; une alternative jouée dans 25 % des cas
compte comme un second système, pas comme un écart. La préparation proposée suit ses coups les
plus fréquents tant qu'il y a au moins 3 parties. Pas de correction moteur, pas de persistance,
série et échéances codées en dur.

## Verdict (2026-10-17)

L'idée est validée ; le POC s'arrête là, faute d'app principale sur laquelle la tester en vrai.

- **A — Debrief est la base** : comprendre l'écart, puis rejouer. Jugée cohérente d'emblée.
- **B et C restent des hypothèses**, à trancher en usage réel (répétition sur plusieurs semaines,
  vraies parties, vraie préparation enregistrée), pas sur maquette :
  - B : jouer son coup *avant* de voir la réponse. Dans A, la flèche verte précède l'exercice, qui
    se réduit à recopier ce qu'on vient de voir.
  - C : rejouer la ligne entière plutôt qu'une position isolée, cohérent avec « l'unité de travail
    est la ligne » (POC de septembre).
- **Principe d'interface acquis** : un coup se montre sur un échiquier (flèche rouge = joué, verte =
  prépa), pas en notation. La première version, toute en notation, était jugée confuse.

Ce que l'app principale doit permettre dès maintenant, sans construire l'écran mobile : une
préparation stockée côté serveur (un coup par position, comparable à une partie sans que l'app soit
ouverte) ; le calcul des habitudes du joueur en domaine pur ; des écrans d'atelier dont la liste des
priorités passe sur téléphone.
