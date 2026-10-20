# AstraGame

Jeu PC original de construction, récolte et survie, inspiré des mécaniques de Zombs.io, avec un duel en ligne **1 contre 1**. Next.js pour le site et un serveur Node.js autoritaire pour le multijoueur. Les graphismes sont dessinés en Canvas, sans assets du jeu de référence.

## Ce qui est inclus

- Personnage contrôlable, vue du dessus, caméra suiveuse et zoom.
- Déplacement ZQSD/WASD (position physique des touches) ou flèches.
- Récolte de bois et pierre, ressources qui repoussent, revenus d’or et mines.
- Bastion, remparts, arbalètes, canons avec dégâts de zone, tours de givre et mines.
- Cinq niveaux de bâtiment ; le niveau du bastion limite celui des autres bâtiments.
- Combat au corps à corps, améliorations d’arme, soin et réapparition.
- Trois vagues offensives : meute, colosses, nuée.
- Trêve initiale de 30 secondes, jour de 60 s puis nuit de 45 s et vagues sauvages.
- Mini-carte, barres de vie, indicateurs de ressources, effets et son optionnel.
- Salons privés par code, deux joueurs prêts avant de démarrer, reconnexion par jeton.
- Entraînement local contre une IA, disponible même sans serveur de jeu.

## Architecture de déploiement : deux services

| Partie | Où la lancer | Commande |
| --- | --- | --- |
| Client Next.js | Vercel, racine du dépôt | npm run build |
| Simulation + WebSocket | Un service Node/Docker permanent, par exemple Render ou votre VPS | npm run server |

Le frontend seul sur Vercel donne accès au mode entraînement. **Le duel en ligne nécessite également le serveur de jeu.**

Vercel prend en charge les WebSockets, mais ses instances sont distribuées et limitées en durée. Cette version utilise volontairement **un seul processus Node permanent** pour garantir une simulation autoritaire par salon, sans Redis ni coordination distribuée. Ne lancez pas ce serveur en plusieurs replicas et ne le copiez pas dans une route serverless Next.js : les salons de cette version sont en mémoire.

Référence : https://vercel.com/docs/functions/websockets

## Démarrer sur votre ordinateur

Node.js 22 ou version LTS plus récente.

~~~bash
npm install
cp .env.example .env.local
npm run dev
~~~

Dans un second terminal :

~~~bash
npm run server
~~~

Ouvrir http://localhost:3000. Le serveur accepte par défaut cette origine.
Pour tester à deux : ouvrir deux navigateurs/profils, créer un salon dans le premier puis rejoindre son code dans le second. Cliquer sur « Je suis prêt » des deux côtés.

Les variables du serveur se définissent dans l’environnement du terminal ou chez l’hébergeur. Le serveur Node ne lit pas le fichier .env.local de Next.js.

## Publier le frontend sur Vercel

1. Importer **MatisseAD/AstraGame** dans Vercel.
2. Framework : **Next.js** ; Root Directory : racine du dépôt.
3. Laisser les commandes de vercel.json : installation npm install et build npm run build.
4. Le mode entraînement ne requiert aucune variable.
5. Pour le mode en ligne, ajouter :
   ~~~text
   NEXT_PUBLIC_GAME_SERVER_URL=wss://VOTRE-SERVEUR/ws
   ~~~
6. Redéployer après une modification de cette variable (elle est intégrée au bundle pendant le build).

Cette variable est une adresse publique, pas un secret.

## Publier le serveur de jeu

### Render avec Docker

Le dépôt contient Dockerfile et render.yaml. Importer le dépôt comme Blueprint ou créer un Web Service Docker.

- Dockerfile : celui à la racine.
- Health Check Path : /health.
- Variable **ALLOWED_ORIGINS** : l’origine exacte du site Vercel, sans slash final, par exemple https://astragame.vercel.app.
- Plusieurs origines se séparent par une virgule : domaine principal et éventuel domaine de preview explicitement autorisé.
- PORT est lu automatiquement ; la configuration fournie utilise 3001.
- NODE_ENV=production est défini par le Dockerfile.
- Reporter l’URL publique du service sous la forme wss://NOM-DU-SERVICE.onrender.com/ws dans Vercel.
- Garder **un seul replica**.

Le modèle propose une formule gratuite ; vérifier sa disponibilité et ses conditions avant activation. Une mise en veille, un redémarrage ou un déploiement termine les parties en cours. Aucune ressource payante n’est créée par ce dépôt.

### VPS / autre hébergeur Docker

~~~bash
docker build -t astragame-server .
docker run --rm -p 3001:3001 \
  -e ALLOWED_ORIGINS=https://VOTRE-DOMAINE \
  astragame-server
~~~

Mettre un reverse proxy HTTPS devant le port 3001, avec support de l’Upgrade WebSocket et route /ws.
Le navigateur d’un site HTTPS doit utiliser **wss://**, jamais ws://.

## Commandes

| Commande | Action |
| --- | --- |
| ZQSD / WASD / flèches | Déplacer le personnage |
| Souris | Viser |
| Clic gauche maintenu | Récolter / attaquer |
| 1 à 5 | Sélectionner une construction |
| Clic sur le terrain | Poser le bâtiment sélectionné près du personnage |
| Clic sur un bâtiment allié | Afficher ses actions |
| E | Améliorer le bâtiment sélectionné |
| R | Réparer le bâtiment sélectionné |
| F | Soin : 45 or, recharge 25 secondes |
| Espace | Activer/désactiver l’attaque automatique |
| Échap / clic droit | Annuler la sélection |
| Molette | Zoom |
| Boutons du portail | Envoyer une vague, recharge 12 secondes |

Construire à moins de 270 unités du personnage et dans un rayon de 680 autour de son bastion. Limites : 55 bâtiments hors bastion, 8 mines, 70 créatures offensives par joueur. Les murs bloquent les joueurs ; les créatures attaquent les obstacles et les cibles proches, sans pathfinding complexe. Les tours attaquent les créatures et les héros ennemis. Tous les camps sont visibles sur la mini-carte.

Un bastion détruit perd la partie ; une destruction simultanée est une égalité. Au bout de 20 minutes, le bastion avec le plus de PV gagne.

## Réseau et sécurité

- Simulation fixe à 20 ticks/s, snapshots à 10 Hz.
- Les clients envoient des intentions ; le serveur calcule les positions, achats, coûts, dégâts et délais.
- Les coordonnées sont validées, les vecteurs de déplacement normalisés et les entrées périmées arrêtées.
- Un joueur ne peut vendre ni améliorer les bâtiments de l’autre.
- Code aléatoire de salon et jeton de reprise aléatoire de 256 bits.
- Le jeton reste en sessionStorage ; il n’est jamais envoyé dans les snapshots ni dans les URL.
- Origines WebSocket explicitement autorisées ; pas de wildcard en production.
- Payload maximal de 4 Ko, limite de 50 messages/s et de 6 actions non-déplacement/s par connexion.
- Plafonds de 50 salons et 200 connexions par processus.
- Déconnexion : le personnage reste sur la carte, reconnexion possible ; forfait après 60 secondes.
- Salons sans aucun client supprimés après deux minutes ; durée de vie maximale d’un salon de 30 minutes.

Ce sont des **sessions invitées**, pas des comptes avec email/mot de passe. Pas de classement persistant, d’authentification de compte ni de sauvegarde des parties après redémarrage dans cette version. Le code du salon permet de prendre la place libre : ne le partagez qu’avec votre adversaire.

## Vérification

~~~bash
npm test
npm run build
~~~

La CI GitHub exécute :
- 19 tests de simulation, dont coûts, contrôle de propriété, limites, trêve, victoire et simulation prolongée.
- Un test WebSocket avec deux vrais clients : création, entrée, démarrage, mouvement, reprise et refus d’une origine non autorisée.
- Une compilation Next.js de production.

Les dépendances directes sont fixées à des versions exactes. En l’absence d’environnement npm local à la création, aucun lockfile n’a été fabriqué : après un npm install réussi, conserver et committer package-lock.json pour verrouiller aussi les dépendances transitives.

## Fichiers

- app/ : pages et styles Next.js.
- components/Game.jsx : accueil, connexion, contrôles et interface.
- game/engine.mjs : règles et simulation, sans dépendance réseau.
- game/renderer.mjs : rendu Canvas et caméra.
- server/index.mjs : serveur de salons et transport WebSocket.
- tests/ : tests de simulation et d’intégration réseau.

## État

Première alpha jouable, pensée pour des duels privés. Les comptes persistants, le matchmaking public, la sauvegarde et la répartition des salons entre plusieurs serveurs sont des évolutions distinctes.
