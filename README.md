# 🛡️ VAPT-Sonar: Security & Quality Sprint Console

A premium, glassmorphism-styled dashboard designed for engineering and security teams to track, manage, and compare Vulnerability Assessment and Penetration Testing (VAPT) findings alongside SonarQube quality metrics across multiple microservices and sprints.

---

## ✨ Features

* **Sprint Management:** Create, rename, delete, and seamlessly switch between sprint cycles.
* **Microservice Tracking:** Monitor 14+ default microservices with the ability to add, edit, or delete custom services on the fly.
* **VAPT Tracking:** Log Critical, High, Medium, Low, and Negligible security vulnerabilities per service.
* **Sonar Scan Metrics:** Track Code Coverage, Duplications, Vulnerabilities, Bugs, Code Smells, and A-E grading gates.
* **Dynamic Charting:** Visualize data in real-time using Chart.js (Doughnut charts for issue distribution, Bar charts for top offenders, Line/Area charts for coverage trends).
* **Sprint Comparison Engine:** Compare Sprint A vs. Sprint B on a dedicated dashboard that automatically calculates deltas (increases/decreases) in technical debt and vulnerabilities.
* **Optimistic Local Caching:** Instantly load data from `localStorage` within milliseconds while silently syncing with the cloud in the background.
* **Real-time Cloud Sync:** Powered by Firebase Firestore, ensuring your data is synchronized across all devices and team members instantly.
* **Import & Export:** Download or upload data in JSON format at both the global (Sprint) level and the granular (Service) level.

---

## 🛠️ Tech Stack

* **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+)
* **Visualization:** Chart.js
* **Database & Sync:** Firebase Firestore (v8 SDK), LocalStorage API
* **Web Server:** Nginx

---

## 🚀 Getting Started

### 1. Database Setup (Firebase Firestore)
The dashboard uses Firebase Firestore to save your sprint data in the cloud. 

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** and name it (e.g., `vapt-sonar`).
3. Navigate to **Firestore Database** in the left-hand menu and click **Create database**.
4. Choose **Start in test mode** (Note: Update your Firestore security rules before moving to production).
5. Choose a geographic location closest to you and click **Enable**.

### 2. Get Your Firebase Configuration
1. In the Firebase Console, click the **Gear Icon** next to "Project Overview" and select **Project settings**.
2. Scroll to the "Your apps" section and click the **Web icon (`</>`)** to register a new web app.
3. Give the app a nickname (e.g., `SonarVaptWeb`) and register it.
4. Copy the `firebaseConfig` object from the generated SDK setup script.

### 3. Connect the Dashboard
Open your local project files and update the configuration.

1. Locate the `app.js` file (e.g., at `/usr/share/nginx/sonar-vapt/app.js` on your server).
2. Find the `FIREBASE_CONFIG` variable near the top of the file.
3. Replace the placeholder object with your actual Firebase credentials:

```javascript
const FIREBASE_CONFIG = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID",
    measurementId: "YOUR_MEASUREMENT_ID"
};
