# Tebeka Legal Portal — Attorney Discovery & Credential Vault Guide

---

## 🗺️ Attorney Discovery Architecture & Ranking Pipeline

```
 CLIENT (Web / Mobile / Anonymous Guest)
        │
   ┌────┴──────────────────────────────────────┐
   │                                           │
[ Option A: Guided Questionnaire ]      [ Option B: Direct Filtered Search ]
   • Matter Type (e.g. Commercial)         • Practice Area, City/Region
   • Urgency (Immediate / Flexible)        • Language, Rating, Availability
   • City / Region & Language              • Price / Fee Band
   │                                           │
   └───────────────────┬───────────────────────┘
                       │
                       ▼
        [ OBJECTIVE RANKING ENGINE ]
    SearchScore = (Verification% × 30%)
                + (Client Rating% × 25%)
                + (Experience Years% × 25%)
                + (Responsiveness SLA% × 20%)
        (Weights configurable by Admin)
                       │
                       ▼
        [ CREDENTIAL VAULT PRESENTATION ]
    • Verified Badge (Ministry of Justice & Bar)
    • Bar Admission Year & Experience Years
    • Standing Status (Active in Good Standing)
    • Responsiveness SLA Rate (e.g. 98%)
    • Next Available Consultation Slot
                       │
         ┌─────────────┴─────────────┐
         ▼                           ▼
[ AUTHENTICATED USER ]       [ ANONYMOUS GUEST ]
• Full Attorney Names        • Max 3 Result Cards
• Direct Profile & Booking   • Masked Surnames (Advocate Yared T.)
• Contact & Chat Access      • Contact info stripped
                             • Registration Prompt Attached
```

---

## 🚀 Endpoints & Example Payloads

---

### 1. Guided Questionnaire Flow (`matter type → urgency → location → language`)
Clients answer 4 quick questions to get a curated, pre-filtered, and ranked attorney match.

* **Endpoint**: `POST /api/v1/discovery/questionnaire`
* **Access**: Public / Anonymous allowed (`@AllowAnonymous`)

#### Request Payload:
```json
{
  "matterType": "Commercial Contract Dispute",
  "urgency": "IMMEDIATE_24H",
  "city": "Addis Ababa",
  "region": "Addis Ababa",
  "language": "am",
  "maxBudget": 5000.0
}
```

#### Authenticated Response (`200 OK`):
```json
{
  "questionnaireSummary": {
    "matterType": "Commercial Contract Dispute",
    "urgency": "IMMEDIATE_24H",
    "location": "Addis Ababa",
    "language": "am",
    "matchedCount": 8
  },
  "recommendations": [
    {
      "attorneyId": "4a71b290-7c22-4a01-9f12-88192a0149bb",
      "displayName": "Advocate Yared Tesfaye",
      "city": "Addis Ababa",
      "languages": ["en", "am"],
      "practiceAreas": ["Commercial Law", "Contract Disputes", "Corporate Litigation"],
      "rating": 4.9,
      "responsivenessRate": "99%",
      "searchScore": 96.5,
      "matchExplanation": "Matched for Commercial Contract Dispute in Addis Ababa with instant 24h SLA response.",
      "isAnonymousPreview": false,
      "credentialVault": {
        "verifiedBadge": true,
        "barAdmissionYear": 2014,
        "yearsOfExperience": 12,
        "standingStatus": "ACTIVE_IN_GOOD_STANDING",
        "credentialClaimsMatch": true,
        "profileCompleteness": 100
      }
    }
  ]
}
```

---

### 2. Search and Advanced Filters
Explore verified attorneys with multi-dimensional filtering.

* **Endpoint**: `GET /api/v1/discovery/attorneys?city=Addis%20Ababa&language=am&minRating=4.5&sortBy=searchScore&sortOrder=desc`
* **Access**: Public / Anonymous allowed

#### Query Parameters:
* `city` (string) — Filter by city (e.g. `Addis Ababa`, `Hawassa`, `Dire Dawa`)
* `region` (string) — Filter by region (e.g. `Oromia`, `Amhara`, `Tigray`)
* `language` (string) — Filter by spoken language (`am`, `en`, `or`, `ti`, `sid`)
* `practiceAreaId` (UUID) — Filter by specific Practice Area ID
* `minRating` (float) — Minimum client rating (`0.0` – `5.0`)
* `minExperience` (int) — Minimum experience score
* `minResponsiveness` (int) — Minimum SLA responsiveness rate
* `availabilityWindow` (`TODAY`, `THIS_WEEK`, `NEXT_7_DAYS`, `ALL`)
* `feeBand` (`AFFORDABLE`, `STANDARD`, `PREMIUM`)

#### Response:
```json
{
  "items": [
    {
      "attorneyId": "4a71b290-7c22-4a01-9f12-88192a0149bb",
      "displayName": "Advocate Yared Tesfaye",
      "city": "Addis Ababa",
      "languages": ["en", "am"],
      "practiceAreas": ["Commercial Law", "Contract Disputes"],
      "rating": 4.9,
      "reviewCount": 42,
      "responsivenessRate": "98%",
      "searchScore": 96.5,
      "feeBand": "PREMIUM",
      "nextAvailableWindow": "Weekday 2 at 14:00",
      "isAnonymousPreview": false,
      "credentialVault": {
        "verifiedBadge": true,
        "verifiedAt": "2024-01-15T09:00:00.000Z",
        "barAdmissionYear": 2014,
        "yearsOfExperience": 12,
        "standingStatus": "ACTIVE_IN_GOOD_STANDING",
        "credentialClaimsMatch": true,
        "profileCompleteness": 100
      }
    }
  ],
  "total": 24,
  "page": 1,
  "limit": 20,
  "totalPages": 2
}
```

---

### 3. Objective Ranking & Configurable Weights
Admin-configurable weighted formula ensures merit-based discovery without bias.

$$\text{SearchScore} = \frac{(W_{\text{verif}} \cdot V) + (W_{\text{rating}} \cdot R) + (W_{\text{exp}} \cdot E) + (W_{\text{resp}} \cdot S)}{100}$$

* **Endpoint**: `POST /api/v1/ranking/weights`
* **Role**: Admin

#### Request Payload:
```json
{
  "verificationWeight": 30.0,
  "ratingWeight": 25.0,
  "experienceWeight": 25.0,
  "responsivenessWeight": 20.0
}
```

#### Response:
```json
{
  "id": "rw_99120aa-7712-4cf1-8812-1049281a01bb",
  "version": 2,
  "verificationWeight": 30.0,
  "ratingWeight": 25.0,
  "experienceWeight": 25.0,
  "responsivenessWeight": 20.0,
  "effectiveAt": "2026-08-19T15:35:00.000Z",
  "approvedBy1": "admin_chief_officer"
}
```

---

### 4. Anonymous Preview Protection
Unauthenticated guests can preview the marketplace while protecting attorney contact details.

* **Endpoint**: `GET /api/v1/discovery/attorneys` (without `Authorization` header)

#### Anonymous Response:
```json
{
  "items": [
    {
      "attorneyId": "4a71b290-7c22-4a01-9f12-88192a0149bb",
      "displayName": "Advocate Yared T.",
      "city": "Addis Ababa",
      "languages": ["en", "am"],
      "practiceAreas": ["Commercial Law", "Contract Disputes"],
      "rating": 4.9,
      "reviewCount": 42,
      "responsivenessRate": "98%",
      "searchScore": 96.5,
      "isAnonymousPreview": true,
      "credentialVault": {
        "verifiedBadge": true,
        "barAdmissionYear": 2014,
        "yearsOfExperience": 12,
        "standingStatus": "ACTIVE_IN_GOOD_STANDING"
      }
    }
  ],
  "total": 35,
  "page": 1,
  "limit": 3,
  "totalPages": 12,
  "registrationPrompt": {
    "message": "Viewing anonymous preview (max 3 results). Sign up or log in to unlock complete credentials, contact details, and online consultation booking.",
    "actionUrl": "/auth/register",
    "totalAvailableAttorneys": 35
  }
}
```
