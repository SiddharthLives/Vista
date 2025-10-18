# Vista - Flutter Mobile App

The cross-platform mobile application for the Vista College Social Media Platform, built with Flutter for Android and Web.

## 🚀 Features

- **🔐 Authentication**: Google Sign-In with Firebase integration
- **📱 Social Feed**: Instagram-style posts with media support
- **📖 Stories**: 24-hour ephemeral content sharing
- **🗣️ Discussions**: Reddit-style topics with voting and comments
- **💬 Real-time Chat**: Direct messaging with Socket.IO
- **👥 User Profiles**: Student discovery and profile management
- **🔔 Push Notifications**: Firebase Cloud Messaging integration
- **🌐 Cross-Platform**: Single codebase for Android and Web

## 🛠️ Tech Stack

- **Framework**: Flutter 3.x with Dart
- **State Management**: Provider pattern
- **Authentication**: firebase_auth + google_sign_in
- **HTTP Client**: dio for API communication
- **Real-time**: socket_io_client
- **Media**: image_picker, cached_network_image
- **Storage**: flutter_secure_storage
- **UI**: Material Design 3

## 📱 Supported Platforms

- ✅ **Android** (API level 21+)
- ✅ **Web** (Chrome, Firefox, Safari, Edge)
- 🔄 **iOS** (planned - requires macOS for development)

## 🚀 Quick Start

### Prerequisites

- Flutter 3.0 or higher
- Dart SDK 3.0 or higher
- Android Studio (for Android development)
- Chrome (for web development)
- Firebase project configured

### Installation

1. **Clone and navigate to the Flutter app**:

```bash
git clone <repository-url>
cd vista/vista
```

2. **Install dependencies**:

```bash
flutter pub get
```

3. **Configure Firebase**:

```bash
# Install FlutterFire CLI
dart pub global activate flutterfire_cli

# Configure Firebase for your project
flutterfire configure
```

4. **Update app configuration**:
   Edit `lib/config/app_config.dart` with your backend URL and settings.

5. **Run the app**:

```bash
# For web development
flutter run -d chrome

# For Android (with device/emulator connected)
flutter run -d android

# For specific device
flutter devices
flutter run -d <device-id>
```

## 📁 Project Structure

```
lib/
├── config/                 # App configuration
│   ├── app_config.dart     # Environment settings
│   └── firebase_options.dart # Firebase configuration
├── models/                 # Data models
│   ├── user.dart          # User model
│   ├── post.dart          # Post model
│   ├── story.dart         # Story model
│   ├── topic.dart         # Topic model
│   ├── comment.dart       # Comment model
│   ├── conversation.dart  # Chat conversation model
│   └── message.dart       # Chat message model
├── providers/             # State management
│   ├── auth_provider.dart # Authentication state
│   ├── feed_provider.dart # Posts feed state
│   ├── stories_provider.dart # Stories state
│   ├── topics_provider.dart # Topics state
│   ├── chat_provider.dart # Chat state
│   └── theme_provider.dart # Theme state
├── screens/               # UI screens
│   ├── auth/             # Authentication screens
│   ├── home_feed_screen.dart # Main feed
│   ├── stories_viewer_screen.dart # Stories viewer
│   ├── topics_screen.dart # Topics list
│   ├── topic_detail_screen.dart # Topic details
│   ├── create_topic_screen.dart # Topic creation
│   ├── conversations_screen.dart # Chat list
│   ├── chat_screen.dart  # Chat interface
│   ├── profile_screen.dart # User profile
│   └── user_search_screen.dart # User search
├── services/              # API and external services
│   ├── api_service.dart   # Base HTTP client
│   ├── auth_service.dart  # Authentication API
│   ├── posts_api_service.dart # Posts API
│   ├── stories_api_service.dart # Stories API
│   ├── topics_api_service.dart # Topics API
│   ├── chat_api_service.dart # Chat API
│   ├── users_api_service.dart # Users API
│   ├── media_api_service.dart # Media upload
│   ├── socket_service.dart # Real-time communication
│   └── fcm_service.dart   # Push notifications
├── widgets/               # Reusable UI components
│   ├── post_widget.dart   # Post display
│   ├── post_composer.dart # Post creation
│   ├── stories_carousel.dart # Stories display
│   ├── topic_card.dart    # Topic list item
│   ├── comment_card.dart  # Comment display
│   ├── message_bubble.dart # Chat message
│   ├── user_card.dart     # User display
│   ├── loading_widget.dart # Loading indicators
│   └── error_widget.dart  # Error displays
└── main.dart              # App entry point
```

## 🔧 Configuration

### Environment Configuration

Update `lib/config/app_config.dart`:

```dart
class AppConfig {
  // Environment
  static const String environment = 'development'; // or 'production'

  // API Configuration
  static const String baseUrl = 'http://localhost:3000'; // Your backend URL
  static const String socketUrl = 'http://localhost:3000'; // Socket.IO URL

  // App Configuration
  static const String appName = 'Vista';
  static const String collegeName = 'Your College Name';
  static const String collegeEmailDomain = 'college.edu';

  // Cloudinary Configuration
  static const String cloudinaryCloudName = 'your-cloud-name';

  // Feature Flags
  static const bool enableDebugMode = true;
  static const bool enableAnalytics = false;

  // Performance
  static const int apiTimeoutSeconds = 30;
  static const int maxRetryAttempts = 3;
}
```

### Firebase Configuration

Ensure these files are properly configured:

- `android/app/google-services.json` (Android)
- `web/index.html` (Web - Firebase SDK)
- `lib/firebase_options.dart` (Generated by FlutterFire CLI)

## 🧪 Testing

### Run Tests

```bash
# Run all tests
flutter test

# Run tests with coverage
flutter test --coverage

# Run specific test file
flutter test test/widgets/topic_card_test.dart

# Run tests in watch mode
flutter test --watch
```

### Test Structure

```
test/
├── integration/           # Integration tests
├── providers/            # Provider tests
├── screens/              # Screen widget tests
├── services/             # Service unit tests
├── widgets/              # Widget unit tests
└── test_setup.dart       # Test configuration
```

### Generate Mocks

```bash
# Generate mock classes for testing
dart run build_runner build
```

## 📱 Building for Production

### Android APK

```bash
# Build release APK
flutter build apk --release

# Build App Bundle (recommended for Play Store)
flutter build appbundle --release
```

### Web

```bash
# Build for web
flutter build web --release

# Build with specific web renderer
flutter build web --web-renderer html --release
```

### Build Optimization

For production builds, ensure:

- Remove debug code and logs
- Optimize images and assets
- Enable code obfuscation:

```bash
flutter build apk --release --obfuscate --split-debug-info=build/debug-info
```

## 🔌 API Integration

### Authentication Flow

```dart
// Sign in with Google
final authProvider = Provider.of<AuthProvider>(context, listen: false);
await authProvider.signInWithGoogle();

// Check authentication status
if (authProvider.isAuthenticated) {
  // User is signed in
  final user = authProvider.currentUser;
}
```

### Making API Calls

```dart
// Using the API service
final apiService = ApiService();

// Get posts
final posts = await apiService.get('/posts');

// Create post
final newPost = await apiService.post('/posts', data: {
  'text': 'Hello world!',
  'type': 'text',
  'visibility': 'public'
});
```

### Real-time Features

```dart
// Connect to Socket.IO
final socketService = SocketService();
await socketService.connect();

// Listen for messages
socketService.on('message_received', (data) {
  // Handle new message
});

// Send message
socketService.emit('send_message', {
  'conversationId': 'conv_id',
  'text': 'Hello!'
});
```

## 🎨 UI/UX Guidelines

### Design System

- **Colors**: Material Design 3 color scheme
- **Typography**: Roboto font family
- **Icons**: Material Icons
- **Spacing**: 8dp grid system
- **Elevation**: Material elevation levels

### Responsive Design

The app adapts to different screen sizes:

- **Mobile**: Optimized for phones (360dp - 480dp width)
- **Tablet**: Adapted layout for larger screens
- **Web**: Responsive design for desktop browsers

### Accessibility

- Screen reader support
- High contrast mode support
- Keyboard navigation (web)
- Semantic labels for all interactive elements

## 🔔 Push Notifications

### Setup

1. Configure Firebase Cloud Messaging in Firebase Console
2. Add FCM service worker for web (in `web/firebase-messaging-sw.js`)
3. Request notification permissions in app

### Handling Notifications

```dart
// Initialize FCM
final fcmService = FCMService();
await fcmService.initialize();

// Handle foreground messages
FirebaseMessaging.onMessage.listen((RemoteMessage message) {
  // Show in-app notification
});

// Handle notification taps
FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
  // Navigate to relevant screen
});
```

## 🐛 Debugging

### Debug Mode

Enable debug features in `app_config.dart`:

```dart
static const bool enableDebugMode = true;
```

### Logging

The app uses structured logging:

```dart
import 'package:logger/logger.dart';

final logger = Logger();
logger.d('Debug message');
logger.i('Info message');
logger.w('Warning message');
logger.e('Error message');
```

### Flutter Inspector

Use Flutter Inspector in your IDE to:

- Inspect widget tree
- Debug layout issues
- Monitor performance
- Analyze memory usage

## 🚀 Performance Optimization

### Image Optimization

- Use `cached_network_image` for network images
- Implement lazy loading for lists
- Optimize image sizes with Cloudinary transformations

### Memory Management

- Dispose controllers and streams properly
- Use `const` constructors where possible
- Implement efficient list builders for large datasets

### Network Optimization

- Implement request caching
- Use pagination for large data sets
- Optimize API response sizes

## 🔒 Security

### Data Protection

- Secure storage for sensitive data
- Token-based authentication
- Input validation and sanitization
- HTTPS-only communication

### Privacy

- Request minimal permissions
- Clear data handling policies
- User consent for data collection
- Secure data transmission

## 📚 Dependencies

### Core Dependencies

```yaml
dependencies:
  flutter:
    sdk: flutter

  # State Management
  provider: ^6.1.2

  # Firebase
  firebase_core: ^3.6.0
  firebase_auth: ^5.3.1
  firebase_messaging: ^15.1.3
  google_sign_in: ^6.2.1

  # HTTP & Real-time
  dio: ^5.7.0
  socket_io_client: ^2.0.3+1

  # Storage
  shared_preferences: ^2.3.2
  flutter_secure_storage: ^9.2.2

  # Media
  image_picker: ^1.1.2
  cached_network_image: ^3.4.1

  # UI
  flutter_staggered_grid_view: ^0.7.0
  pull_to_refresh: ^2.0.0

  # Utilities
  intl: ^0.19.0
  uuid: ^4.5.1
  logger: ^2.4.0
```

### Dev Dependencies

```yaml
dev_dependencies:
  flutter_test:
    sdk: flutter

  # Testing
  mockito: ^5.4.4
  build_runner: ^2.4.13

  # Code Quality
  flutter_lints: ^4.0.0

  # Tools
  json_serializable: ^6.8.0
```

## 🤝 Contributing

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**
4. **Add tests** for new functionality
5. **Run tests**: `flutter test`
6. **Run code analysis**: `flutter analyze`
7. **Format code**: `dart format .`
8. **Commit changes**: `git commit -m 'Add amazing feature'`
9. **Push to branch**: `git push origin feature/amazing-feature`
10. **Open a Pull Request**

### Code Style

- Follow [Dart style guide](https://dart.dev/guides/language/effective-dart/style)
- Use meaningful variable and function names
- Add documentation for public APIs
- Keep functions small and focused
- Use const constructors where possible

### Testing Guidelines

- Write tests for all new features
- Maintain test coverage above 80%
- Use descriptive test names
- Mock external dependencies
- Test both success and error scenarios

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

## 🆘 Support

### Documentation

- [Environment Setup Guide](../docs/ENVIRONMENT.md)
- [API Documentation](../docs/API.md)
- [Deployment Guide](../docs/DEPLOYMENT.md)

### Getting Help

1. Check the [Flutter documentation](https://docs.flutter.dev/)
2. Search existing [GitHub Issues](../../issues)
3. Create a new [GitHub Issue](../../issues/new)
4. Review [Project Status](../PROJECT_STATUS_DOCUMENTATION.md)

### Common Issues

#### Build Issues

```bash
flutter clean
flutter pub get
flutter run
```

#### Firebase Issues

- Verify `google-services.json` is in `android/app/`
- Check Firebase project configuration
- Ensure Authentication is enabled

#### Network Issues

- Check backend URL in `app_config.dart`
- Verify CORS settings on backend
- Check device/emulator internet connection

## 🗺️ Roadmap

### Completed Features ✅

- Authentication with Google Sign-In
- Posts feed with media support
- Stories with 24-hour expiration
- Topics and discussions with voting
- Real-time features foundation

### In Progress 🔄

- Real-time chat implementation
- User profiles and search
- Push notifications integration

### Planned Features 📋

- iOS support
- Offline mode
- Advanced media editing
- Group conversations
- Enhanced notifications
- Performance optimizations

---

**Happy coding!** 🚀 If you have any questions or need help, don't hesitate to reach out through our support channels.
