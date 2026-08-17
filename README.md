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
/usr/share/nginx/sonar-vapt/
├── index.html        # Main dashboard structure and modals
├── style.css         # Dark glassmorphism UI, responsive layout, animations
├── app.js            # Core logic, Firebase sync, Chart.js rendering, and DOM manipulation
└── README.md         # Documentation