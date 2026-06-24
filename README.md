# NetScore Backend API

This project implements the backend API for NetScore, a prediction platform where users can predict match outcomes within leagues and track their scores in real-time. The API is built with Node.js, Express, and Prisma, leveraging PostgreSQL as the database and Socket.io for real-time updates.

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

The backend follows a **Layered Architecture** and leverages design patterns like the **Strategy Pattern** to ensure modularity, scalability, and ease of testing.

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

### Key Architectural Layers:
*   **`src/routes`**: Defines the HTTP API endpoints and associates them with specific controller handlers.
*   **`src/controllers`**: Standardizes request validation, extracts parameters from bodies/headers, invokes services, and handles HTTP response codes and structures.
*   **`src/services`**: The core business logic layer. Implements business validations (e.g., verifying if a match is scheduled before allowing predictions) and orchestrates database transactions using Prisma.
*   **`src/strategies`**: Implements the **Strategy Pattern** for prediction scoring. Different leagues can define different strategies (e.g. `CLASSIC`) extending a base class, making it easy to add new scoring rules without changing the controller or service logic.
*   **`src/middlewares`**: Intercepts requests for authentication (JWT verifying) and security validation (HMAC SHA-256 webhook signature validation).
*   **`src/websockets`**: Manages room-based Socket.io namespaces to stream live leaderboard updates to clients joined in a specific league room.
*   **`src/jobs`**: Automated cron tasks (using `node-cron`) to daily synchronize real-world sports fixtures (fetching from APIs like Football-Data.org) into our database.

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
