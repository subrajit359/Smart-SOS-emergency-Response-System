# Smart SOS Emergency Response System 🚨

A web-based emergency SOS system designed to help accident victims get immediate medical assistance. 

---

## 📌 About The Project

Smart SOS Emergency Response System allows accident or emergency victims to send an SOS alert with their live GPS location, automatically notify nearby available ambulances, and give medical responders critical health information before they arrive. The entire system runs in the browser.

---

## ✨ Features

- **Manual SOS Button** — One tap to send an emergency alert with live GPS location
- **Crash Detection** — Automatically detects vehicle crashes using the device accelerometer and gyroscope, monitors for stillness, and auto-sends SOS if the user is unresponsive
- **Medical Profile** — Users store their blood group, allergies, medical conditions, medications, and emergency contact so ambulances are prepared before arriving
- **Ambulance Dashboard** — Ambulance staff can view all incoming SOS alerts with full victim medical details and accept requests
- **Live Status Updates** — Users can track the status of their SOS alert in real time
- **Alert History** — Users can view all past SOS alerts and their outcomes
- **Role Based Access** — Separate dashboards and permissions for regular users and ambulance staff
- **Secure Authentication** — JWT based login with bcrypt password hashing

---

## 🚨 How The SOS Flow Works

1. User must be logged in before sending an SOS
2. User taps the SOS button — a confirmation popup appears to prevent accidental alerts
3. Browser Geolocation API fetches the user's current GPS coordinates
4. SOS alert is sent to the backend and saved in the database with status **Pending**
5. Ambulance dashboard shows the new alert with the victim's full medical profile
6. Ambulance staff taps Accept — status updates to **Accepted** and ambulance is assigned
7. User dashboard reflects the updated status automatically — "Help is on the way"
8. When help arrives, ambulance staff marks the alert as **Completed**

---

## 🔍 How Crash Detection Works

1. The app continuously monitors accelerometer and gyroscope readings using the browser DeviceMotion API
2. If a sudden high G-force spike and sudden rotation are detected simultaneously, it registers as a potential crash
3. After the impact, the app monitors the device for 15 to 20 seconds of no significant movement
4. If the device stays completely still for that duration, a large "Are you okay?" popup appears with a countdown timer
5. Two outcomes:
   - User taps **"I'm Okay"** — alert is cancelled, monitoring resumes
   - Countdown ends with no response — SOS is automatically sent with the user's GPS location
6. If the device moves normally again before the countdown ends, it is treated as a false alarm and cancelled silently

---

## 👤 User Roles

### Regular User
- Register and log in
- Send SOS alert manually or via crash detection
- View live status of active alert
- View full alert history
- Manage medical profile

### Ambulance Staff
- Log in to ambulance dashboard
- View all incoming pending SOS alerts
- See victim location and full medical profile on each alert
- Accept alerts and mark them as completed

---

## 🗄️ Database Design

**Users Table**

| Field | Type | Description |
|---|---|---|
| id | Primary Key | Auto-generated |
| name | String | Full name |
| email | String | Unique email |
| phone | String | Phone number |
| password | String | Hashed with bcrypt |
| role | String | user or ambulance |
| blood_group | String | e.g. B+ |
| allergies | Text | e.g. Penicillin, Latex |
| medical_conditions | Text | e.g. Diabetes, Epilepsy |
| current_medications | Text | e.g. Insulin |
| emergency_contact_name | String | Name of emergency contact |
| emergency_contact_phone | String | Phone of emergency contact |
| medical_notes | Text | Additional notes for doctors |
| created_at | Timestamp | Account creation time |

**SOS Alerts Table**

| Field | Type | Description |
|---|---|---|
| id | Primary Key | Auto-generated |
| user_id | Foreign Key | References users |
| latitude | Float | GPS latitude |
| longitude | Float | GPS longitude |
| status | String | pending / accepted / completed / cancelled |
| assigned_ambulance_id | Foreign Key | References ambulances (nullable) |
| created_at | Timestamp | When alert was sent |
| updated_at | Timestamp | Last status change |
| completed_at | Timestamp | When alert was resolved |

**Ambulances Table**

| Field | Type | Description |
|---|---|---|
| id | Primary Key | Auto-generated |
| name | String | Ambulance unit name |
| driver_name | String | Driver full name |
| phone | String | Contact number |
| user_id | Foreign Key | Linked ambulance staff account |
| location_lat | Float | Current latitude |
| location_lng | Float | Current longitude |
| available | Boolean | true or false |
| created_at | Timestamp | Registration time |

---

## ⚙️ API Endpoints

**Authentication**
```
POST   /api/register        — Create new account
POST   /api/login           — Login and receive JWT token
```

**Profile**
```
GET    /api/profile         — Get logged-in user profile and medical details
PUT    /api/profile         — Update personal and medical profile
```

**SOS Alerts**
```
POST   /api/sos             — Create new SOS alert
GET    /api/sos             — Get all pending alerts (ambulance only)
GET    /api/sos/my          — Get current user's alert history
GET    /api/sos/:id         — Get single alert details
PUT    /api/sos/:id         — Update alert status
```

**Ambulances**
```
GET    /api/ambulances          — List all ambulances with availability
PUT    /api/ambulance/:id/status — Toggle ambulance availability
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React JS (JavaScript) |
| Styling | Plain CSS |
| Backend | Node.js + Express.js |
| Database | PostgreSQL |
| Authentication | JWT + bcrypt |
| Location | Browser Geolocation API |
| Crash Detection | Browser DeviceMotion API |

---



## 🚀 Getting Started


1. Install backend dependencies
```bash
cd server
npm install
```

2. Install frontend dependencies
```bash
cd client
npm install
```

3. Create a `.env` file in the server folder
```
PORT=5000
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_secret_key
```

4. Set up the PostgreSQL database and run migrations

5. Start the backend server
```bash
cd server
npm start
```

6. Start the frontend
```bash
cd client
npm start
```

---

## 🔐 Security

- Passwords hashed using bcrypt
- JWT authentication on all protected routes
- Role based access control for user and ambulance routes
- Input validation on all API endpoints
- Rate limiting on POST /api/sos to prevent spam alerts
- All secrets stored in .env file — never hardcoded

---

## ⚠️ Important Notes

- Crash detection uses the browser DeviceMotion API which works best on mobile browsers
- The app tab must remain open and active for crash detection to run
- On iOS Safari, the user must grant DeviceMotion permission manually on first load
- Location access must be granted by the user for SOS to work

---

## 🔮 Future Plans

- WebSocket integration for real-time alert notifications
- Live map view showing victim and ambulance location
- Mobile app version with full background crash detection
- SMS alert to emergency contacts when SOS is sent
- Admin panel for system management

---


## 📄 License

This project is licensed under the MIT License.
