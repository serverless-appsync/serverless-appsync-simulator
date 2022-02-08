Basé sur le projet : 
Car il ne nous permettait pas de faire en local un "BatchGetItem" via Appsync et DynamoDB


### Objectif 

Le seul changement que nous avons apporté dans ce fork est de changer la version de la dépendance `amplify-appsync-simulator` qui un sous package de `amplify-cli` afin de le remplacer par une version supportant l'opération `BatchGetItem` au sein d'AppSync (Disponible ici : https://github.com/giraudvalentin/amplify-appsync-simulator-with-BatchGetItem)

### Changement 

Les commits/PR de modifications :
- 7df03530b8facd6a42a3ac62d59c3c39e0727a7b 

- https://github.com/giraudvalentin/serverless-appsync-simulator/pull/1
Pour la prise en compte des commentaires dans le schema graphql qui étaient auparavant supprimé
