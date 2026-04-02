# Checklist — Composants UI

Tu audites les composants React en tant qu'architecte. Les composants sont l'**UI layer** — ils affichent et reagissent aux interactions. C'est tout.

## Le role d'un composant bien designe

- **Recevoir des donnees** (props, context) et **les afficher**
- **Capturer des interactions** (clicks, inputs) et **les remonter** (callbacks, dispatch)
- **Ne jamais calculer** de logique metier
- **Ne jamais appeler** un service directement
- Etre testable avec des props mockees, sans Firebase, sans MediaPipe

## Ce que tu cherches

### 1. Composants impurs (violation de la separation UI/domain)
- Composants qui font des side effects (Firebase, localStorage, fetch) directement dans le body
- Calculs metier dans le JSX ou les handlers (XP, scoring, eligibilite, grading)
- Composants qui importent depuis `src/lib/` autre chose que des constantes ou des types
- Composants qui connaissent la structure Firestore

**Ou chercher:** `src/screens/`, `src/modals/`, `src/components/`
**Methode:** Pour chaque composant, verifie ses imports — tout import de service/Firebase est suspect

### 2. God components
- Fichiers > 200 lignes → suspect. > 400 lignes → presque certain qu'il fait trop
- Composants avec > 3 hooks custom → probablement un container deguise en composant
- Composants qui gerent layout + data + interactions + side effects

**Methode:** `wc -l` sur chaque fichier dans screens/ et modals/

### 3. Architecture des composants
- La separation container/presentational est-elle appliquee ?
- Les screens sont-ils des "pages" (composition de composants) ou des god components ?
- Les modals contiennent-elles de la logique ou deleguent-elles ?
- Y a-t-il un composant d'entree clair par feature ou c'est du spaghetti ?

### 4. Props drilling vs context
- Props passees sur 3+ niveaux → signal de context manquant
- Contexts trop larges qui causent des re-renders inutiles
- Props "god object" (un objet fourre-tout passe a un composant)

### 5. Styling et design tokens
- Valeurs hardcodees au lieu des CSS custom properties / SCSS variables
- Z-index magiques au lieu de l'echelle `$z-base` → `$z-maximum`
- Styles inline au lieu de SCSS co-localise
- Classes CSS non-semantiques ou trop generiques

### 6. React patterns
- `key` manquants ou indexes comme keys sur des listes dynamiques
- `useEffect` pour du state derive (devrait etre `useMemo` ou calcul direct)
- State redondant (derivable de props ou d'autre state)
- Composants qui ne sont jamais memoises alors qu'ils re-render souvent avec les memes props

### 7. Organisation et co-location
- Composants dans le mauvais dossier
- Sous-composants extraits trop loin de leur parent
- Fichiers SCSS manquants quand il y a du style custom

## Criteres de severity

- **CRITICAL** : Composant qui importe Firebase ou fait des calculs metier core — violation de layer
- **HIGH** : God component (> 400 lignes, 5+ responsabilites) ou import direct de services
- **MEDIUM** : Props drilling 3+ niveaux, styles hardcodes, composant qui devrait etre split
- **LOW** : Naming, organisation, petites ameliorations de patterns React
