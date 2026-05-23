# Mijote — Guide de remplissage « App Privacy » & Export Compliance

> Guide pour deux questionnaires d'App Store Connect. Ce ne sont pas des
> documents à héberger : ce sont des réponses à cocher dans l'interface.
> Basé sur l'audit des flux de données du 2026-05-20.

---

## Partie 1 — App Privacy (Privacy Nutrition Labels)

Dans App Store Connect : **votre app → onglet « App Privacy » → Get Started.**

### Étape 0 — Collecte de données

> *« Do you or your third-party partners collect data from this app? »*

➡️ **Yes, we collect data.**

(OpenAI, Supabase et Upstash traitent des données pour notre compte → on doit
déclarer.)

### Étape 1 — Types de données à déclarer

Apple présente une longue liste de catégories. **Cochez uniquement les 5
ci-dessous** ; tout le reste = **non collecté**.

| Catégorie Apple | Sous-type | Pourquoi |
|---|---|---|
| **User Content** | **Photos or Videos** | Photos ajoutées aux recettes + images d'import |
| **User Content** | **Audio Data** | Enregistrement de la dictée vocale (transmis à OpenAI) |
| **User Content** | **Other User Content** | Texte des recettes : titres, ingrédients, étapes |
| **Identifiers** | **User ID** | Identifiants de foyer et de session (compte anonyme) |
| **Usage Data** | **Product Interaction** | Nombre de consultations et date de dernière consultation des recettes |

### Étape 2 — Réponses pour CHAQUE type coché

Pour chacun des 5 types ci-dessus, Apple pose 3 questions. Les réponses sont
**identiques pour les 5** :

| Question Apple | Réponse | Justification |
|---|---|---|
| *Used for tracking?* | **No** | Aucun suivi inter-apps/inter-sites, aucun courtier en données |
| *Linked to the user's identity?* | **Yes — Linked to You** | Tout est rattaché au compte « foyer » persistant (même si le foyer est anonyme, la donnée reste liée à ce compte) |
| *Purposes* | **App Functionality** | Uniquement pour faire fonctionner le service |

> Pour **Product Interaction**, vous pouvez aussi cocher **Product
> Personalization** en plus de *App Functionality* (les compteurs servent à la
> liste « consultées récemment »). *App Functionality* seul reste correct.

### Résultat : « Data Linked to You », pas de tracking

L'app n'utilisant pas de tracking, **aucune fenêtre App Tracking Transparency
(ATT)** n'est requise.

### À NE PAS déclarer (et pourquoi)

| Élément | Raison |
|---|---|
| Contact Info (nom, e-mail, téléphone) | Jamais collecté — auth 100 % anonyme |
| Location | Aucune géolocalisation |
| Financial Info / Purchases | Aucun paiement, aucun IAP |
| Health & Fitness, Contacts, Browsing/Search History | Non collectés |
| Diagnostics (Crash, Performance) | Aucun SDK de crash-reporting (pas de Sentry, etc.) |
| Adresse IP | Utilisée seulement pour la limitation de débit (sécurité), conservée 1 h, jamais en base. N'est pas un type listé par Apple et l'usage sécurité seul ne requiert pas de déclaration |
| Nom d'appareil (« iPhone 15 · Safari ») | Couvert par *User ID* ; pas besoin de déclarer *Device ID* en plus — le `device_token` est un identifiant technique first-party, non publicitaire |

### Champs liés (onglet App Privacy / App Information)

- **Privacy Policy URL** : `https://mijote.anthonykocken.fr/legal/confidentialite`
  où sera publiée `docs/politique-confidentialite.md`.
- **Privacy Choices URL** : facultatif → laisser vide.

---

## Partie 2 — Export Compliance (chiffrement)

Question posée à chaque build envoyé (ou réglable une fois pour toutes).

### Réponse

L'app n'utilise que du **chiffrement standard et exempté** :
- HTTPS pour toutes les communications ;
- signature cryptographique standard du cookie de session.

Aucun algorithme de chiffrement propriétaire ou non standard.

➡️ Dans App Store Connect : à la question sur le chiffrement, répondre que l'app
**utilise du chiffrement, mais uniquement du chiffrement exempté**
(communications via HTTPS / chiffrement standard).
➡️ **Aucun rapport de conformité (CCATS / self-classification) à fournir.**

### Pour ne plus être interrogé à chaque build

Ajouter cette clé dans `Info.plist` (lors de la Phase 2 — intégration Capacitor) :

```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

---

## Cohérence à vérifier

Les déclarations ci-dessus doivent rester cohérentes avec la politique de
confidentialité (`docs/politique-confidentialite.md`). Si une fonctionnalité
ajoute un nouveau type de données (ex. notifications push en Phase 5, analytics,
crash-reporting), **mettre à jour les deux documents**.
