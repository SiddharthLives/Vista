# Vista - College Social Media Platform

A comprehensive social media platform designed specifically for college students, featuring Instagram-style feeds, stories, real-time chat, and discussion forums.

## 🚀 Features

- **📱 Cross-Platform**: Flutter app for Android and Web
- **🔐 Secure Authentication**: Firebase Auth with college email domain restriction
- **📸 Media Sharing**: Instagram-style posts and 24-hour stories
- **💬 Real-time Chat**: Direct messaging with Socket.IO
- **🗣️ Discussions**: Reddit-style topics with voting and comments
- **👥 User Discovery**: Search and connect with classmates
- **🛡️ Admin Tools**: Content moderation and roster management
- **🔔 Push Notifications**: Firebase Cloud Messaging integration

## 🏗️ Architecture

```
Vista/
├── backend/                    # Node.js Express API server
├── vista/                      # Flutter mobile application
├── admin-web/                  # React admin interface
├── scripts/                    # Development and deployment scripts
└── .kiro/specs/               # Project specifications and tasks
```

## 🛠️ Tech Stack

### Backend

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: Firebase Admin SDK
- **Real-time**: Socket.IO
- **Media Storage**: Cloudinary
- **Caching**: Redis (optional)

### Frontend (Flutter)

- **Framework**: Flutter 3.x with Dart
- **State Management**: Provider/Riverpod
- **Authentication**: firebase_auth
- **Real-time**: socket_io_client
- **HTTP Client**: dio/http
- **Media**: image_picker, cached_network_image

### Admin Interface

- **Framework**: Next.js 13+ with React
- **Styling**: Tailwind CSS
- **Authentication**: JWT-based
- **Testing**: Jest + React Testing Library

## 🚀 Quick Start

### Prerequisites

- Node.js 18 or higher
- Flutter 3.x
- MongoDB (local or Atlas)
- Firebase project with Authentication enabled
- Cloudinary account

### Development Setup

1. **Clone the repository**:

```bash
git clone <repository-url>
cd vista
```

2. **Start the backend**:

```bash
cd backend
npm install
cp .env.example .env
# Update .env with your configuration
npm run dev
```

3. **Start the Flutter app**:

```bash
cd vista
flutter pub get
flutter run
```

4. **Start the admin interface** (optional):

```bash
cd admin-web
npm install
cp .env.example .env.local
# Update .env.local with your configuration
npm run dev
```

### Using Docker

Start all services with Docker Compose:

```bash
docker-compose up -d
```

## 📚 Documentation

- [Backend API Documentation](./backend/README.md)
- [Flutter App Documentation](./vista/README.md)
- [Admin Interface Documentation](./admin-web/README.md)
- [API Reference](./docs/API.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)
- [Environment Setup](./docs/ENVIRONMENT.md)

## 🧪 Testing

### Backend Tests

```bash
cd backend
npm test
npm run test:coverage
```

### Flutter Tests

```bash
cd vista
flutter test
flutter test --coverage
```

### Admin Interface Tests

```bash
cd admin-web
npm test
npm run test:coverage
```

## 🚀 Deployment

### Production Deployment

1. **Configure environment variables** for production
2. **Build and deploy backend** using Docker
3. **Build Flutter app** for web and Android
4. **Deploy admin interface** to hosting platform

See [Deployment Guide](./docs/DEPLOYMENT.md) for detailed instructions.

### Environment Variables

Key environment variables needed:

- `MONGODB_URI`: MongoDB connection string
- `FIREBASE_PROJECT_ID`: Firebase project ID
- `CLOUDINARY_*`: Cloudinary API credentials
- `JWT_SECRET`: JWT signing secret

## 🔒 Security

- Firebase token verification for all protected routes
- Rate limiting on all endpoints
- Input validation and sanitization
- CORS configuration
- Security headers with Helmet
- College email domain restriction

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

1. Check the [documentation](./docs/)
2. Search existing [issues](../../issues)
3. Create a new [issue](../../issues/new) if needed

## 🗺️ Roadmap

- [x] Backend API implementation
- [x] Flutter authentication and core UI
- [x] Topics and discussions feature
- [ ] Real-time chat implementation
- [ ] User profiles and search
- [ ] Push notifications
- [ ] Admin interface enhancements
- [ ] Performance optimizations

## 📊 Project Status

**Current Status**: ~75% Complete

- ✅ Backend: 100% complete
- ✅ Flutter Infrastructure: 90% complete
- ✅ Topics Feature: 100% complete
- 🔄 Chat Feature: Backend ready, UI pending
- 🔄 Profile Feature: Backend ready, UI pending
- 🔄 Admin Interface: Basic implementation complete

See [PROJECT_STATUS_DOCUMENTATION.md](./PROJECT_STATUS_DOCUMENTATION.md) for detailed status.
