<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1rtf-U3S0ldsV-eDqi__6lqoMuNz2EMZ-

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Firestore Security Rules

To enable the Admin Panel and secure the game, copy the following code into your **Firebase Console** -> **Firestore Database** -> **Rules** tab.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ---------------------------------------------------------
    // Helper Functions
    // ---------------------------------------------------------
    
    // Check if the requesting user is the Admin
    // UID: 6nANvmBRHZQV07CkbGc8lCo44jJ2
    function isAdmin() {
      return request.auth != null && request.auth.uid == '6nANvmBRHZQV07CkbGc8lCo44jJ2';
    }

    // Check if the user is accessing their own data
    function isOwner(userId) {
      return request.auth != null && request.auth.uid == userId;
    }

    // ---------------------------------------------------------
    // Collection Rules
    // ---------------------------------------------------------

    // Users Collection
    match /users/{userId} {
      // Users can read their own balance. Admin can read everyone's to show in Dashboard.
      allow read: if isOwner(userId) || isAdmin();
      
      // CLIENT-SIDE GAME LOGIC:
      // Users must be able to write to their own document to:
      // 1. Initialize account on first login
      // 2. Deduct bets and add wins (since game logic is client-side)
      // 3. Lock funds when requesting a withdrawal
      allow write: if isOwner(userId) || isAdmin();
    }

    // Transactions Collection
    match /transactions/{transactionId} {
      // Users can see their own history. Admin sees all.
      allow read: if (request.auth != null && resource.data.userId == request.auth.uid) || isAdmin();
      
      // Users can CREATE a deposit or withdrawal request
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      
      // ONLY Admin can UPDATE a transaction (e.g. changing status from 'pending' to 'approved')
      allow update: if isAdmin();
      
      // ONLY Admin can DELETE a transaction
      allow delete: if isAdmin();
    }
  }
}
```