# Environment Setup Guide

This guide provides detailed instructions for setting up the Vista College Social Media Platform development environment.

## Prerequisites

### System Requirements

- **Operating System**: macOS, Linux, or Windows 10/11
- **Node.js**: Version 18.0 or higher
- **Flutter**: Version 3.0 or higher
- **Git**: Latest version
- **Docker**: Latest version (optional but recommended)

### Required Accounts and Services

1. **Firebase Project**

   - Google account with Firebase access
   - Firebase project with Authentication enabled
   - Firebase Admin SDK service account key

2. **MongoDB**

   - MongoDB Atlas account (recommended) OR
   - Local MongoDB installation

3. **Cloudinary Account**

   - Free or paid Cloudinary account
   - API credentials (cloud name, API key, API secret)

4. **Development Tools**
   - Code editor (VS Code recommended)
   - Android Studio (for Android development)
   - Xcode (for iOS development, macOS only)

## Installation Steps

### 1. Clone the Repository

```bash
git clone <repository-url>
cd vista
```

### 2. Backend Setup

#### Install Node.js Dependencies

```bash
cd backend
npm install
```

#### Environment Configuration

1. Copy the environment template:

```bash
cp .env.example .env
```

2. Edit `.env` file with your configuration:

```env
# Server Configuration
NODE_ENV=development
PORT=3000

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/vista
# OR for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/vista

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random

# Firebase Configuration
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# College Configuration
COLLEGE_EMAIL_DOMAIN=college.edu
COLLEGE_NAME=Your College Name

# Redis Configuration (Optional)
REDIS_URL=redis://localhost:6379

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS Configuration
CORS_ORIGIN=http://localhost:3001,http://localhost:8080
```

#### Firebase Service Account Setup

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Extract the values and add them to your `.env` file

#### Start the Backend Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

The backend will be available at `http://localhost:3000`

### 3. Flutter App Setup

#### Install Flutter Dependencies

```bash
cd vista
flutter pub get
```

#### Firebase Configuration for Flutter

1. Install Firebase CLI:

```bash
npm install -g firebase-tools
```

2. Login to Firebase:

```bash
firebase login
```

3. Configure Flutter Firebase:

```bash
# Install FlutterFire CLI
dart pub global activate flutterfire_cli

# Configure Firebase for your Flutter project
flutterfire configure
```

4. This will create/update:
   - `lib/firebase_options.dart`
   - `android/app/google-services.json`
   - `ios/Runner/GoogleService-Info.plist`

#### App Configuration

1. Update `lib/config/app_config.dart`:

```dart
class AppConfig {
  static const String baseUrl = 'http://localhost:3000';
  static const String socketUrl = 'http://localhost:3000';
  static const String collegeName = 'Your College Name';
  static const String collegeEmailDomain = 'college.edu';

  // Cloudinary configuration
  static const String cloudinaryCloudName = 'your-cloud-name';
  static const String cloudinaryUploadPreset = 'your-upload-preset';

  // App configuration
  static const bool enableDebugMode = true;
  static const int apiTimeoutSeconds = 30;
}
```

#### Run the Flutter App

```bash
# For web development
flutter run -d chrome

# For Android (with device/emulator connected)
flutter run -d android

# For iOS (macOS only, with device/simulator)
flutter run -d ios
```

### 4. Admin Web Interface Setup

#### Install Dependencies

```bash
cd admin-web
npm install
```

#### Environment Configuration

1. Copy the environment template:

```bash
cp .env.example .env.local
```

2. Edit `.env.local`:

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000

# App Configuration
NEXT_PUBLIC_APP_NAME=Vista Admin
NEXT_PUBLIC_COLLEGE_NAME=Your College Name

# Development Configuration
PORT=3001
```

#### Start the Admin Interface

```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```

The admin interface will be available at `http://localhost:3001`

## Database Setup

### Option 1: MongoDB Atlas (Recommended)

1. Create a MongoDB Atlas account at https://www.mongodb.com/atlas
2. Create a new cluster
3. Create a database user with read/write permissions
4. Whitelist your IP address (or use 0.0.0.0/0 for development)
5. Get the connection string and update `MONGODB_URI` in your `.env` file

### Option 2: Local MongoDB

#### Install MongoDB

**macOS (using Homebrew):**

```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb/brew/mongodb-community
```

**Ubuntu/Debian:**

```bash
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
```

**Windows:**
Download and install from https://www.mongodb.com/try/download/community

#### Initialize Database

```bash
# Connect to MongoDB
mongosh

# Create database and collections
use vista
db.createCollection("users")
db.createCollection("posts")
db.createCollection("stories")
db.createCollection("topics")
db.createCollection("comments")
db.createCollection("conversations")
db.createCollection("messages")
db.createCollection("notifications")

# Create indexes (run from backend directory)
cd backend
npm run setup-db
```

## Docker Setup (Alternative)

### Using Docker Compose

1. Make sure Docker and Docker Compose are installed
2. Copy environment files:

```bash
cp backend/.env.example backend/.env
cp admin-web/.env.example admin-web/.env.local
```

3. Update the environment files with your configuration
4. Start all services:

```bash
docker-compose up -d
```

This will start:

- MongoDB on port 27017
- Redis on port 6379
- Backend API on port 3000
- Admin interface on port 3001

### Individual Docker Commands

**Backend:**

```bash
cd backend
docker build -t vista-backend .
docker run -p 3000:3000 --env-file .env vista-backend
```

**Admin Interface:**

```bash
cd admin-web
docker build -t vista-admin .
docker run -p 3001:3001 --env-file .env.local vista-admin
```

## Firebase Setup

### 1. Create Firebase Project

1. Go to https://console.firebase.google.com/
2. Click "Create a project"
3. Enter project name and follow the setup wizard
4. Enable Google Analytics (optional)

### 2. Enable Authentication

1. In Firebase Console, go to Authentication → Sign-in method
2. Enable "Google" sign-in provider
3. Add your domain to authorized domains
4. Configure OAuth consent screen if needed

### 3. Configure Authentication Settings

1. Go to Authentication → Settings → Authorized domains
2. Add your development domains:
   - `localhost`
   - `127.0.0.1`
   - Your production domain

### 4. Generate Service Account Key

1. Go to Project Settings → Service Accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Extract values for your `.env` file

### 5. Configure Firebase for Flutter

1. Add your Flutter app to Firebase project
2. Download configuration files:
   - `google-services.json` for Android
   - `GoogleService-Info.plist` for iOS
3. Place files in appropriate directories
4. Update `firebase_options.dart`

## Cloudinary Setup

### 1. Create Cloudinary Account

1. Go to https://cloudinary.com/
2. Sign up for a free account
3. Note your cloud name, API key, and API secret

### 2. Configure Upload Presets

1. Go to Settings → Upload presets
2. Create a new preset with these settings:
   - **Preset name**: `vista_uploads`
   - **Signing mode**: `Signed`
   - **Folder**: Leave empty (will be set dynamically)
   - **Resource type**: `Auto`
   - **Access mode**: `Public`

### 3. Set Up Folder Structure

The app uses this folder structure:

```
/college-name/
  /year-1/
    /dept-CS/
      /section-A/
        /student-2025CS1001/
          /posts/
          /stories/
          /chat/
```

This is automatically created when users upload content.

## Development Tools Setup

### VS Code Extensions (Recommended)

```bash
# Install VS Code extensions
code --install-extension Dart-Code.dart-code
code --install-extension Dart-Code.flutter
code --install-extension ms-vscode.vscode-typescript-next
code --install-extension bradlc.vscode-tailwindcss
code --install-extension ms-vscode.vscode-json
code --install-extension ms-vscode.vscode-eslint
```

### Android Studio Setup

1. Download and install Android Studio
2. Install Android SDK and build tools
3. Create an Android Virtual Device (AVD)
4. Enable USB debugging on physical devices

### Xcode Setup (macOS only)

1. Install Xcode from Mac App Store
2. Install Xcode command line tools:

```bash
xcode-select --install
```

3. Accept Xcode license:

```bash
sudo xcodebuild -license accept
```

## Testing Setup

### Backend Testing

```bash
cd backend
npm test
npm run test:coverage
```

### Flutter Testing

```bash
cd vista
flutter test
flutter test --coverage
```

### Generate Test Coverage Reports

```bash
# Backend
cd backend
npm run test:coverage
open coverage/lcov-report/index.html

# Flutter
cd vista
flutter test --coverage
genhtml coverage/lcov.info -o coverage/html
open coverage/html/index.html
```

## Troubleshooting

### Common Issues

#### 1. MongoDB Connection Issues

**Error**: `MongoNetworkError: failed to connect to server`

**Solutions**:

- Check if MongoDB is running: `brew services list | grep mongodb`
- Verify connection string in `.env`
- Check firewall settings
- For Atlas: verify IP whitelist and credentials

#### 2. Firebase Authentication Issues

**Error**: `Firebase: Error (auth/invalid-api-key)`

**Solutions**:

- Verify Firebase configuration in `firebase_options.dart`
- Check if Authentication is enabled in Firebase Console
- Verify API keys and project ID

#### 3. Flutter Build Issues

**Error**: `Gradle build failed`

**Solutions**:

```bash
cd vista
flutter clean
flutter pub get
cd android
./gradlew clean
cd ..
flutter run
```

#### 4. Cloudinary Upload Issues

**Error**: `Invalid signature`

**Solutions**:

- Verify Cloudinary credentials in `.env`
- Check upload preset configuration
- Ensure timestamp is correct in signed uploads

#### 5. CORS Issues

**Error**: `Access to fetch at 'http://localhost:3000' from origin 'http://localhost:8080' has been blocked by CORS policy`

**Solutions**:

- Add your frontend URL to `CORS_ORIGIN` in backend `.env`
- Restart backend server after changing CORS settings

### Performance Optimization

#### Backend Optimization

1. **Database Indexes**: Ensure proper indexes are created

```bash
cd backend
npm run setup-indexes
```

2. **Memory Usage**: Monitor with:

```bash
node --inspect server.js
```

#### Flutter Optimization

1. **Build Optimization**:

```bash
flutter build web --release
flutter build apk --release
```

2. **Performance Profiling**:

```bash
flutter run --profile
```

### Logging and Debugging

#### Backend Logging

Logs are written to:

- Console (development)
- `logs/app.log` (production)

Set log level in `.env`:

```env
LOG_LEVEL=debug  # debug, info, warn, error
```

#### Flutter Debugging

Enable debug mode in `app_config.dart`:

```dart
static const bool enableDebugMode = true;
```

View logs:

```bash
flutter logs
```

## Production Considerations

### Environment Variables for Production

```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/vista
JWT_SECRET=very_long_random_secret_for_production
CORS_ORIGIN=https://yourdomain.com
LOG_LEVEL=info
```

### Security Checklist

- [ ] Use strong JWT secret
- [ ] Enable HTTPS in production
- [ ] Configure proper CORS origins
- [ ] Set up rate limiting
- [ ] Enable MongoDB authentication
- [ ] Use environment variables for all secrets
- [ ] Configure proper Firebase security rules
- [ ] Set up Cloudinary signed uploads only

### Performance Checklist

- [ ] Enable MongoDB indexes
- [ ] Configure Redis for Socket.IO scaling
- [ ] Set up CDN for static assets
- [ ] Enable gzip compression
- [ ] Configure proper caching headers
- [ ] Optimize Cloudinary transformations
- [ ] Monitor application performance

## Getting Help

### Documentation

- [Backend README](../backend/README.md)
- [Flutter README](../vista/README.md)
- [API Documentation](./API.md)
- [Deployment Guide](./DEPLOYMENT.md)

### Community Resources

- [Flutter Documentation](https://docs.flutter.dev/)
- [Firebase Documentation](https://firebase.google.com/docs)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Cloudinary Documentation](https://cloudinary.com/documentation)

### Support Channels

1. Check existing [GitHub Issues](../../issues)
2. Create a new [GitHub Issue](../../issues/new)
3. Review [Project Documentation](../PROJECT_STATUS_DOCUMENTATION.md)

## Next Steps

After completing the environment setup:

1. **Verify Installation**: Run all test suites to ensure everything works
2. **Explore the Code**: Review the project structure and existing implementations
3. **Start Development**: Begin with the remaining tasks in the implementation plan
4. **Read Documentation**: Familiarize yourself with the API and architecture

Happy coding! 🚀
