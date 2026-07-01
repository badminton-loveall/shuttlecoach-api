# ShuttleCoach API

Backend API for the LoveAll badminton training management application.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcrypt

## Project Structure

```
src/
├── config/          # Configuration files (database, environment)
├── controllers/     # Request handlers
├── middleware/      # Express middleware (auth, error handling)
├── models/          # Database models/queries
├── routes/          # API route definitions
├── types/           # TypeScript type definitions
├── utils/           # Utility functions (auth, calculations)
├── migrations/      # Database migration scripts
└── server.ts        # Main application entry point
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `PORT`: Server port (default: 5000)
- `NODE_ENV`: Environment (development/production)
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT token signing
- `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins

## Getting Started

### Prerequisites

- Node.js 18+ installed
- PostgreSQL database running
- npm or yarn package manager

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your database credentials
nano .env
```

### Development

```bash
# Run in development mode with hot reload
npm run dev
```

### Production

```bash
# Build TypeScript to JavaScript
npm run build

# Run production server
npm start
```

## API Endpoints

### Health Check

- `GET /api/health` - Server health status

### Authentication (To be implemented)

- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Students (To be implemented)

- `POST /api/students` - Create student
- `GET /api/students` - List students
- `GET /api/students/:id` - Get student by ID
- `PATCH /api/students/:id` - Update student

### Additional endpoints for assessments, fees, curriculum, coaches, and training logs will be implemented in subsequent tasks.

## Features

- ✅ TypeScript configuration
- ✅ Express server setup
- ✅ CORS configuration
- ✅ Environment variable management
- ✅ Database connection setup (PostgreSQL)
- ✅ JWT authentication utilities
- ✅ Password hashing with bcrypt
- ✅ Error handling middleware
- ✅ Health check endpoint
- ✅ Request logging (development)
- ⏳ Database migrations (pending)
- ⏳ API endpoints (pending)

## Security

- Passwords are hashed using bcrypt with 10 salt rounds
- JWT tokens expire after 24 hours
- CORS is configured to allow only specified origins
- SQL injection prevention through parameterized queries (to be implemented)
- Input validation (to be implemented)

## Development Notes

- The server automatically restarts on file changes using nodemon
- TypeScript is compiled on-the-fly in development mode
- Production builds use compiled JavaScript from the `dist/` directory
- Database connections are gracefully closed on server shutdown

## License

ISC
