# College Social Media Backend

A Node.js/Express backend API for a college-only social media application with Instagram-style feeds, Reddit-style discussions, and real-time chat functionality.

## Features

- 🔐 Firebase Authentication with college email domain restriction
- 📱 Instagram-style posts and stories
- 💬 Real-time chat with Socket.IO
- 🗣️ Reddit-style topics and discussions
- 📸 Media management with Cloudinary
- 🔔 Push notifications with FCM
- 👥 College roster management
- 🛡️ Comprehensive security and rate limiting

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: Firebase Admin SDK
- **Real-time**: Socket.IO
- **Media Storage**: Cloudinary
- **Caching**: Redis (optional)

## Quick Start

### Prerequisites

- Node.js 18 or higher
- MongoDB (local or Atlas)
- Firebase project with Authentication enabled
- Cloudinary account

### Installation

1. Clone the repository and navigate to backend directory:

```bash
cd backend
```

2. Install dependencies:

```bash
npm install
```

3. Copy environment configuration:

```bash
cp .env.example .env
```

4. Update `.env` with your configuration values

5. Start the development server:

```bash
npm run dev
```

### Using Docker

1. Start all services with Docker Compose:

```bash
docker-compose up -d
```

2. View logs:

```bash
docker-compose logs -f api
```

3. Stop services:

```bash
docker-compose down
```

## API Endpoints

### Health Check

- `GET /health` - Server health status

### Authentication

- `POST /auth/firebaseSignIn` - Sign in with Firebase token
- `POST /auth/linkStudentId` - Link student ID to account

### Posts

- `GET /posts` - Get feed posts with pagination
- `POST /posts` - Create new post
- `POST /posts/:id/like` - Like/unlike post
- `POST /posts/:id/comment` - Comment on post

### Stories

- `GET /stories` - Get active stories
- `POST /stories` - Create new story

### Topics

- `GET /topics` - Get discussion topics
- `POST /topics` - Create new topic
- `POST /topics/:id/vote` - Vote on topic
- `POST /topics/:id/comment` - Comment on topic

### Chat

- `GET /conversations` - Get user conversations
- `POST /conversations` - Create new conversation
- `GET /conversations/:id/messages` - Get conversation messages

### Media

- `POST /media/sign` - Get signed upload parameters

### Admin

- `POST /admin/roster` - Upload student roster
- `POST /admin/moderate` - Moderate content
- `GET /admin/reports` - Get analytics reports

## Environment Variables

See `.env.example` for all required environment variables.

## Development

### Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode

### Project Structure

```
src/
├── controllers/     # Route handlers
├── middleware/      # Custom middleware
├── models/         # Mongoose schemas
├── routes/         # Express routes
├── services/       # Business logic
└── server.js       # Main application file
```

## Testing

Run the test suite:

```bash
npm test
```

## Deployment

### Production Environment

1. Set `NODE_ENV=production`
2. Use MongoDB Atlas or managed MongoDB
3. Configure Redis for Socket.IO scaling
4. Set up proper logging and monitoring
5. Use HTTPS with proper SSL certificates

### Docker Production

```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Security

- Firebase token verification for all protected routes
- Rate limiting on all endpoints
- Input validation and sanitization
- CORS configuration
- Security headers with Helmet
- College email domain restriction

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details
