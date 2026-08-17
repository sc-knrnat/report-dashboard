# VAPT-Sonar: Security & Quality Sprint Console

A premium, glassmorphism-styled dashboard designed for engineering and security teams to track, manage, and compare Vulnerability Assessment and Penetration Testing (VAPT) findings and SonarQube quality metrics across multiple microservices and sprints.

## ✨ Features

* **Sprint Management**: Create, rename, delete, and seamlessly switch between sprint cycles.
* **Microservice Tracking**: Monitor 14+ default microservices with the ability to add, edit, or delete custom services on the fly.
* **VAPT Tracking**: Log Critical, High, Medium, Low, and Negligible security vulnerabilities per service.
* **Sonar Scan Metrics**: Track Code Coverage, Duplications, Vulnerabilities, Bugs, Code Smells, and A-E grading gates.
* **Dynamic Charting**: Visualizes data in real-time using Chart.js (Doughnut charts for issue distribution, Bar charts for top offenders, Line/Area charts for coverage trends).
* **Sprint Comparison Engine**: A dedicated dashboard to compare Sprint A vs. Sprint B, automatically calculating deltas (increases/decreases) in technical debt and vulnerabilities.
* **Optimistic Local Caching**: Instantly loads data from `localStorage` within milliseconds while silently syncing with the cloud in the background.
* **Real-time Cloud Sync**: Powered by Firebase Firestore, ensuring your data is synchronized across all devices.
* **Import & Export**: Download or upload data in JSON format at both the global (Sprint) level and the granular (Service) level.

## 🛠️ Tech Stack

* **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
* **Visualization**: Chart.js
* **Database & Sync**: Firebase Firestore (v8 SDK) + LocalStorage API
* **Web Server**: Nginx

## 📂 File Structure

```text
sonar-vapt/
├── index.html        # Main dashboard structure and modals
├── style.css         # Dark glassmorphism UI, responsive layout, animations
├── app.js            # Core logic, Firebase sync, Chart.js rendering, and DOM manipulation
└── README.md         # Documentation

Firebase Configuration & Setup Steps

The dashboard uses Firebase Firestore to save your sprint data in the cloud, ensuring it synchronizes instantly across all your devices and team members.

1. How to create a database in Firebase
Go to the Firebase Console.

Click Add project (or "Create a project").

Give your project a name (e.g., vapt-sonar) and click Continue. You can disable Google Analytics for this project.

Once the project is created, navigate to Firestore Database in the left-hand menu.

Click Create database.

Choose Start in test mode (this allows you to read/write data easily without setting up authentication right away. Note: For production, you should update your Firestore security rules).

Choose a geographic location closest to you and click Enable.

2. Where to get the FIREBASE_CONFIG details
In the left sidebar of the Firebase Console, click the Gear Icon next to "Project Overview" and select Project settings.

Scroll down to the "Your apps" section and click the Web icon (</>) to register a new web app.

Give the app a nickname (e.g., SonarVaptWeb) and register it.

Firebase will generate an SDK setup script. Look for the firebaseConfig object block. It will look like this:

const firebaseConfig = {
    apiKey: "...",
    authDomain: "vapt-sonar.firebaseapp.com",
    projectId: "vapt-sonar",
    storageBucket: "vapt-sonar.firebasestorage.app",
    messagingSenderId: "",
    appId: "1:1234567890:web:abcdef123456",
    measurementId: "G-XXXXXXXX"
};

Copy this entire object.

3. Where to put this in your project
Open the app.js file located at /usr/share/nginx/sonar-vapt/app.js on your server.

Locate the FIREBASE_CONFIG variable near the top of the file (around line 50).

Replace the placeholder object with the exact values you copied from Firebase:

const FIREBASE_CONFIG = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID",
    measurementId: "YOUR_MEASUREMENT_ID"
};

Save the app.js file.

Hard-refresh your browser (Ctrl + Shift + R or Cmd + Shift + R). The dashboard is now connected to your live database!

📖 Usage Guide
Create a Sprint: Click New Sprint in the top right. Give it a name (e.g., "Sprint 115").

Add Data: Scroll to the VAPT or Sonar table. Click the Edit (Pen) icon next to a service to open the data entry modal.

Manage Services: Click Manage Services at the bottom of the left sidebar to add custom repositories or link external dashboards.

Compare Sprints: Navigate to the Compare Sprints tab in the sidebar, select a Base Sprint and a Comparison Sprint, and instantly view the generated delta metrics.

Backup Data: Use the Export button in the top navigation bar to download a full JSON backup of the currently active sprint.
