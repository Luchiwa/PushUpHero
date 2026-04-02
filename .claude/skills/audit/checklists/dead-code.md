# Checklist — Code mort

Tu cherches tout le code mort. Chaque ligne morte est du bruit qui complique la comprehension de l'architecture reelle.

## Ce que tu cherches

### 1. Exports jamais importes
- Fonctions, constantes, types, composants exportes mais jamais importes ailleurs
- **Methode** : pour chaque `export` dans `src/lib/`, `src/hooks/`, `src/exercises/`, grep le nom exporte dans tout `src/`
- Attention aux re-exports : verifie que le nom est utilise au final, pas juste re-exporte

### 2. Fichiers orphelins
- Fichiers `.ts`/`.tsx`/`.scss` qui ne sont importes par aucun autre fichier
- **Methode** : pour chaque fichier, grep son nom (sans extension) dans tout `src/`
- Assets dans `src/assets/` jamais references

### 3. Composants jamais rendus
- Composants definis mais jamais utilises dans un JSX
- Ecrans ou modals qui ne sont plus references dans le routing/rendering

**Ou chercher:** `src/components/`, `src/screens/`, `src/modals/`

### 4. Variables et fonctions locales inutilisees
- Variables declarees jamais lues
- Fonctions definies jamais appelees dans le meme fichier
- Parametres de fonction jamais utilises (sans prefixe `_`)
- Destructured values jamais utilisees

### 5. Code unreachable
- Code apres `return`, `throw`, ou `break`
- Branches de conditions toujours vraies/fausses
- Early returns qui rendent le reste de la fonction mort

### 6. Imports inutilises
- Import statements ou le nom importe n'est jamais reference
- Type imports jamais utilises

### 7. CSS/SCSS mort
- Classes CSS definies dans un `.scss` mais jamais utilisees dans le `.tsx` associe
- Variables SCSS definies jamais referencees
- Mixins ou placeholders jamais includes

### 8. Code commente
- Blocs de code commentes qui trainent (signe de code mort pas assume)
- `// TODO` sans issue tracker associe

## Criteres de severity

- **CRITICAL** : Fichier entier orphelin (jamais importe) — bruit pur dans la codebase
- **HIGH** : Fonction/composant exporte mais jamais utilise — fausse surface d'API
- **MEDIUM** : Import ou variable locale inutilise
- **LOW** : Code commente, parametre inutilise
