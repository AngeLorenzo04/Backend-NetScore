# NetScore Backend API

This project implements the backend API for NetScore, a prediction platform where users can predict match outcomes within leagues and track their scores in real-time. The API is built with Node.js, Express, and Prisma, leveraging PostgreSQL as the database and Socket.io for real-time updates.
visit https://netscore26.cloud/ to explore the website

## 🚀 Technologies Used

*   **Node.js**: JavaScript runtime environment
*   **Express.js**: Web application framework
*   **Prisma**: Next-generation ORM for Node.js and TypeScript
*   **PostgreSQL**: Robust relational database
*   **Socket.io**: Real-time bidirectional event-based communication
*   **bcryptjs**: Library for hashing passwords
*   **jsonwebtoken**: JSON Web Token implementation for authentication
*   **Jest**: JavaScript testing framework
*   **Supertest**: Library for testing HTTP servers

## ✨ Features

*   **User Authentication**: Register and log in users with JWT-based authentication.
*   **Prediction Management**: Allow authenticated users to submit predictions for scheduled matches within a league.
*   **Scoring Logic**: Automatically calculate points for predictions based on actual match results using a Classic Scoring strategy.
*   **Webhook Receiver**: Listen for external match result updates (e.g., from the Nostradamus API).
*   **Real-time Leaderboard**: Broadcast leaderboard updates to connected clients via WebSockets after match results are processed.
*   **Automated Testing**: Comprehensive integration tests for API endpoints using Jest and Supertest.

## 🏛️ Architecture & Design

The backend is engineered following clean code principles, structured as a **Layered Architecture** with a clear separation of concerns, and implements design patterns like the **Strategy Pattern** and room-scoped event broadcasting.

### System Architecture Flow
```mermaid
graph TD
    Client[Client / Frontend] <-->|WebSockets / HTTP| Express[Express Server]
    Express -->|Routes| RouteHandler[Route Layer]
    RouteHandler -->|Auth/Webhook Middleware| Middleware[Middleware Layer]
    Middleware -->|Controllers| Controller[Controller Layer]
    Controller -->|Services| Service[Service Layer]
    Service -->|Prisma Client| DB[(PostgreSQL Database)]
    Service -->|Strategy Pattern| Scoring[Scoring Strategy]
    Service -->|Socket Manager| WebSockets[Socket.io Broadcast]
```

### Key Architectural Layers & Design Decisions:

1. **Routing Layer (`src/routes`)**
   * Maps HTTP requests to specific controller functions.
   * Defines route protections using token-verification and signature-verification middlewares.

2. **Controller Layer (`src/controllers`)**
   * Decouples the presentation layer from business logic.
   * Standardizes request validation, extracts payloads, executes operations, and returns uniform JSON formats (e.g. `200 OK`, `201 Created`, `400 Bad Request`, `401 Unauthorized`, `500 Server Error`).

3. **Business Logic Layer (`src/services`)**
   * Contains core prediction logic, user league boundaries, score updates, and operations orchestration.
   * **League-scoped Predictions Isolation**: A prediction is uniquely bound to a `userId`, `matchId`, and `leagueId`. This enables a user participating in multiple leagues to submit separate predictions for the same match without they overwriting each other.
   * **Transactional Database Ops**: Orchestrates multi-row reads and writes inside transaction boundaries using Prisma Transaction API (e.g. duplicating matches' predictions when joining a league).

4. **Scoring Strategy Pattern (`src/strategies`)**
   * Abstract class `ScoringStrategy` defines interface guidelines for outcome evaluation.
   * Concrete class `ClassicScoringStrategy` calculates points:
     * **3 Points**: Exact score prediction (e.g. predicted `2 - 1`, match ends `2 - 1`).
     * **1 Point**: Correct outcome (1X2) prediction (e.g. predicted `3 - 1` [home win], match ends `1 - 0` [home win]).
     * **0 Points**: Incorrect outcome prediction.
   * This design permits adding new rulesets (e.g. `"GOAL_DIFFERENCE"` or `"EXACT_ONLY"`) by simply adding a new strategy class extending `ScoringStrategy`, without touching the core scoring execution service.

5. **External Integration Layer (`src/integrations`)**
   * Integrates external APIs like `football-data.org` to fetch match listings.
   * **Timezone Offset**: Normalizes UTC timestamp formats, applying a `-2h` offset to resolve local Rome (+2h) time formatting issues, ensuring that the stored kick-off times accurately reflect local scheduling.

6. **WebSockets Layer (`src/websockets`)**
   * Uses `socket.io` to provide real-time updates.
   * Clients join rooms identified by the specific `leagueId` they are viewing. After webhook result validation and scoring runs, the database points are recalculated and the updated leaderboard ranks are broadcasted only to the relevant room.

---

## 🗄️ Database Entity-Relationship (ER) Diagram

The relational schema is implemented in PostgreSQL via Prisma ORM:

```mermaid
erDiagram
    users {
        String id PK "UUID"
        String nickname UNIQUE
        String email UNIQUE
        String passwordHash
        String avatarUrl "Base64 or image URL"
    }
    leagues {
        String id PK "UUID"
        String name
        String inviteCode UNIQUE
        String scoringStrategy "Default: CLASSIC"
    }
    league_members {
        String userId PK, FK
        String leagueId PK, FK
        Int totalPoints "Default: 0"
    }
    matches {
        String id PK "API Match ID"
        String homeTeam
        String awayTeam
        DateTime startTime
        MatchStatus status "SCHEDULED | IN_PLAY | FINISHED"
        Int homeGoals "Nullable"
        Int awayGoals "Nullable"
    }
    predictions {
        String id PK "UUID"
        Int predictedHome
        Int predictedAway
        Int pointsEarned "Nullable"
        String userId FK
        String matchId FK
        String leagueId FK
    }

    users ||--o{ league_members : "belongs to"
    leagues ||--o{ league_members : "has members"
    users ||--o{ predictions : "submits"
    matches ||--o{ predictions : "has predictions"
    leagues ||--o{ predictions : "contains predictions"
```

### Schema Relations & Constraints
* **Composite Primary Key**: `league_members` has a composite PK `[user_id, league_id]`, preventing a user from joining the same league more than once.
* **Unique Prediction Constraints**: `predictions` enforces a unique constraint on `[user_id, match_id, league_id]` so that a user can have at most one prediction per match per league.
* **Nullable Columns**: Match scores (`homeGoals`, `awayGoals`) and predictions' score points (`pointsEarned`) are nullable until the match transitions to `FINISHED`.

## 🛠️ Prerequisites

Before you begin, ensure you have met the following requirements:

*   **Node.js**: v18.x or higher
*   **npm**: v8.x or higher
*   **PostgreSQL**: A running PostgreSQL instance (e.g., installed locally, via Docker, or a cloud service).
*   **Git**: For cloning the repository.

## 🚀 Getting Started

Follow these steps to set up and run the NetScore backend locally.

### 1. Clone the Repository

```bash
git clone https://github.com/AngeLorenzo04/Backend-NetScore.git
cd Backend-NetScore
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables Setup

Create a `.env` file in the root directory of the project based on the `.env.example` (or the values provided during setup):

```env
DATABASE_URL="postgresql://admin:root@localhost:5432/netscore_db?schema=public"
JWT_SECRET="your_strong_random_jwt_secret_key"
```

*   **`DATABASE_URL`**: Connection string for your PostgreSQL database. Ensure the username, password, host, port, and database name are correct for your setup.
*   **`JWT_SECRET`**: A strong, random string used to sign and verify JWT tokens. Generate a long, complex string for production.

### 4. Database Setup

Ensure your PostgreSQL database is running and accessible. Then, apply the Prisma schema:

```bash
npx prisma db push
```
*(Note: If you encounter issues with Prisma CLI v7+, consider downgrading to Prisma v6 as was done during development, and ensure the DATABASE_URL is in schema.prisma for `db push` to function correctly.)*

### 5. Running the Application

To start the server, execute:

```bash
node index.js
```

The server will start on the port specified in your `.env` file or default to `3000`. You should see `Server running on port 3000` (or your configured port) in the console.

## 📡 API Endpoints

All API endpoints are prefixed with `/api`.

### Authentication

*   **`POST /api/auth/register`**
    *   **Description**: Registers a new user.
    *   **Request Body**: `{ "email": "string", "nickname": "string", "password": "string" }`
    *   **Response**: `201 Created` with `{ "user": { "id": "uuid", "email": "string", "nickname": "string" }, "token": "string" }`
    *   **Errors**: `400 Bad Request` if email/nickname/password missing or email/nickname already in use.

*   **`POST /api/auth/login`**
    *   **Description**: Logs in an existing user.
    *   **Request Body**: `{ "email": "string", "password": "string" }`
    *   **Response**: `200 OK` with `{ "user": { "id": "uuid", "email": "string", "nickname": "string" }, "token": "string" }`
    *   **Errors**: `400 Bad Request` if email/password missing or invalid credentials.

### Users (Profile Management)

*   **`PUT /api/users/profile`**
    *   **Description**: Updates the logged-in user's profile details.
    *   **Authentication**: Requires a valid JWT in the `Authorization: Bearer <token>` header.
    *   **Request Body**: `{ "nickname": "string", "email": "string", "password": "string", "avatarUrl": "string" }` (at least one field is required, all are optional).
    *   **Response**: `200 OK` with `{ "message": "Profile updated successfully.", "user": { "id": "uuid", "nickname": "string", "email": "string", "avatarUrl": "string" } }`
    *   **Errors**:
        *   `401 Unauthorized` if token is missing.
        *   `403 Forbidden` if token is invalid or expired.
        *   `400 Bad Request` if no update fields are provided or if email/nickname is already in use.

### Predictions

*   **`POST /api/predictions`**
    *   **Description**: Allows an authenticated user to submit a prediction for a match in a league.
    *   **Authentication**: Requires a valid JWT in the `Authorization: Bearer <token>` header.
    *   **Request Body**: `{ "userId": "uuid", "matchId": "string", "leagueId": "uuid", "predictedHome": "number", "predictedAway": "number" }`
    *   **Response**: `201 Created` with the newly created prediction object.
    *   **Errors**:
        *   `401 Unauthorized` if no token is provided.
        *   `403 Forbidden` if the token is invalid or expired.
        *   `400 Bad Request` if missing fields, match not found, match is not `SCHEDULED`, match has already started, or user already predicted for this match/league.

### Webhooks

*   **`POST /api/webhooks/nostradamus`**
    *   **Description**: Receives match results from an external source (e.g., Nostradamus API). Processes scores, updates predictions, and triggers real-time leaderboard updates.
    *   **Request Body**: `{ "matchId": "string", "homeGoals": "number", "awayGoals": "number" }`
    *   **Response**: `200 OK` with `{ "message": "string" }`
    *   **Errors**: `400 Bad Request` if `matchId`, `homeGoals`, or `awayGoals` are missing, match not found, or match already processed.

## 🌐 Real-time Leaderboard (WebSockets)

The application uses Socket.io to provide real-time leaderboard updates.

*   **WebSocket Endpoint**: `ws://localhost:3000` (or your configured server address)

### Events:

*   **`socket.on('joinLeague', (leagueId: string))`**
    *   **Description**: Clients should emit this event to join a specific league's room and receive its leaderboard updates.
    *   **Payload**: The `leagueId` (UUID) of the league to join.

*   **`socket.emit('leaderboardUpdate', (leaderboardData: Array<object>))`**
    *   **Description**: The server emits this event to all clients in a specific league's room when its leaderboard changes (e.g., after a match result is processed).
    *   **Payload**: `leaderboardData` - an array of objects, each containing `userId`, `nickname`, and `totalPoints` for league members, ordered by `totalPoints` DESC.

## 🧪 Testing

Automated integration tests are set up using Jest and Supertest. These tests cover authentication, prediction creation, and webhook processing, with Prisma database calls being mocked.

To run the tests:

```bash
npx jest
```

## 📝 Further Improvements / Notes

*   **Error Handling**: Implement more granular and user-friendly error messages.
*   **Validation**: Add Joi or Zod for robust request body validation.
*   **Security**: Implement rate limiting, input sanitization, and more advanced security measures.
*   **Scoring Strategies**: Expand `src/strategies` to include different scoring algorithms (e.g., "Exact Score + Result", "Goal Difference").
*   **Pagination/Filtering**: Add pagination and filtering options to API endpoints for large datasets.
*   **Logging**: Integrate a more advanced logging solution.
*   **Real-time Error Handling**: Implement error emission over WebSockets.
*   **Deployment**: Provide instructions for deployment to production environments.
