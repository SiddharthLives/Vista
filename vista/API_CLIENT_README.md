# API Client Implementation

This document describes the comprehensive API client implementation for the Vista college social media app.

## Overview

The API client provides a complete interface to the backend API with the following features:

- **JWT Token Management**: Automatic token handling for authenticated requests
- **Error Handling**: Comprehensive error handling with retry logic
- **Type Safety**: Strongly typed models and responses
- **Request/Response Logging**: Debug logging for development
- **File Upload**: Direct Cloudinary integration with progress tracking
- **Singleton Pattern**: Single instance across the app

## Architecture

### Core Services

1. **ApiService**: Base HTTP client with authentication and error handling
2. **ApiClient**: Centralized client providing access to all services
3. **Feature Services**: Specialized services for each API domain

### Service Structure

```
ApiClient
├── AuthService (authentication)
├── PostsApiService (posts and comments)
├── StoriesApiService (ephemeral stories)
├── TopicsApiService (discussions and voting)
├── UsersApiService (user profiles and search)
├── MediaApiService (file uploads)
├── NotificationsApiService (push notifications)
└── ChatApiService (messaging)
```

## Usage

### Initialization

```dart
final apiClient = ApiClient();
await apiClient.initialize();
```

### Authentication

```dart
// Sign in with Google
final result = await apiClient.auth.signInWithGoogle();
if (result.success) {
  final user = result.data!;
  print('Welcome ${user.displayName}!');

  // Token is automatically set for API requests
  final token = await apiClient.auth.getJwtToken();
  apiClient.setJwtToken(token);
}
```

### Posts API

```dart
// Get posts feed
final feedResult = await apiClient.posts.getPosts(
  limit: 20,
  visibility: 'public',
  tags: ['campus', 'events'],
);

if (feedResult.success) {
  final posts = feedResult.data!.posts;
  // Display posts in UI
}

// Create a post
final createRequest = CreatePostRequest(
  type: PostType.text,
  text: 'Hello world!',
  visibility: PostVisibility.public,
);

final createResult = await apiClient.posts.createPost(createRequest);
```

### Media Upload

```dart
final file = File('/path/to/image.jpg');

// Validate file
final validation = await apiClient.media.validateFile(file);
if (!validation.success) return;

// Upload with progress
final uploadResult = await apiClient.media.uploadFile(
  file,
  studentId,
  onProgress: (progress) {
    print('Progress: ${(progress * 100).toInt()}%');
  },
);

if (uploadResult.success) {
  final response = uploadResult.data!;
  // Use response.publicId and response.secureUrl
}
```

### Error Handling

```dart
final result = await apiClient.posts.getPosts();

if (!result.success && result.error != null) {
  final error = result.error!;

  switch (error.code) {
    case 'NETWORK_ERROR':
      // Show network error message
      break;
    case 'NO_AUTH_TOKEN':
      // Redirect to login
      break;
    case 'RATE_LIMIT_EXCEEDED':
      // Show rate limit message
      break;
    default:
      // Show generic error
      print('Error: ${error.message}');
  }
}
```

## Models

### Core Models

- **ApiResponse<T>**: Wrapper for all API responses
- **ApiError**: Structured error information
- **User**: User profile and settings
- **Post**: Social media posts with media
- **Story**: Ephemeral stories with TTL
- **Topic**: Discussion topics with voting
- **Comment**: Comments and replies
- **Conversation/Message**: Chat functionality
- **Notification**: Push notifications

### Request Models

- **CreatePostRequest**: Post creation parameters
- **CreateStoryRequest**: Story creation parameters
- **CreateTopicRequest**: Topic creation parameters
- **CreateCommentRequest**: Comment creation parameters
- **VoteTopicRequest**: Topic voting parameters
- **SendMessageRequest**: Message sending parameters

### Response Models

- **PostsFeedResponse**: Paginated posts feed
- **StoriesFeedResponse**: Paginated stories feed
- **TopicsFeedResponse**: Paginated topics feed
- **NotificationsFeedResponse**: Paginated notifications
- **ConversationsFeedResponse**: Paginated conversations
- **CloudinaryUploadResponse**: Media upload result

## Features

### Authentication Management

- Firebase ID token verification
- JWT token storage and refresh
- College email domain validation
- Student ID linking
- Automatic token injection in requests

### Request/Response Handling

- Automatic JSON serialization/deserialization
- Query parameter handling
- Request timeout and retry logic
- Response caching (where appropriate)
- Request/response logging in debug mode

### Error Handling

- Network error detection and retry
- HTTP status code handling
- API error code mapping
- Graceful degradation
- User-friendly error messages

### File Upload

- Cloudinary signed upload flow
- File validation (type, size)
- Upload progress tracking
- Automatic folder structure
- Error recovery

### Pagination

- Cursor-based pagination for feeds
- Offset-based pagination for search
- Automatic next page loading
- End-of-data detection

## Testing

### Unit Tests

- Service method testing
- Model serialization testing
- Error handling testing
- Mock API responses

### Integration Tests

- End-to-end API flows
- Authentication integration
- File upload integration
- Real-time features

### Test Files

- `test/services/api_service_test.dart`
- `test/services/posts_api_service_test.dart`
- `test/services/api_client_test.dart`

## Configuration

### Environment Variables

```dart
// Development
API_BASE_URL=http://localhost:3000
SOCKET_URL=http://localhost:3000

// Production
API_BASE_URL=https://api.vista.college.edu
SOCKET_URL=https://api.vista.college.edu
```

### App Config

```dart
class AppConfig {
  static String get baseUrl =>
    const String.fromEnvironment('API_BASE_URL',
        defaultValue: 'http://localhost:3000');

  static bool get enableLogging => !isProduction;
  static bool get enableNetworkLogging => !isProduction;
}
```

## Security

### Token Management

- Secure storage using FlutterSecureStorage
- Automatic token refresh
- Token expiration handling
- Logout cleanup

### Request Security

- HTTPS enforcement
- Request signing for uploads
- Rate limiting compliance
- Input validation

### Data Protection

- No sensitive data in logs (production)
- Secure error messages
- PII handling compliance

## Performance

### Optimization

- Connection pooling
- Request deduplication
- Response caching
- Lazy loading
- Memory management

### Monitoring

- Request timing
- Error rate tracking
- Upload success rates
- Network quality detection

## Dependencies

```yaml
dependencies:
  http: ^1.2.2
  dio: ^5.7.0 # For file uploads
  firebase_auth: ^5.3.1
  firebase_core: ^3.6.0
  flutter_secure_storage: ^9.2.2
  logger: ^2.4.0

dev_dependencies:
  mockito: ^5.4.4
  build_runner: ^2.4.13
```

## Best Practices

### Usage Guidelines

1. Always check `result.success` before accessing `result.data`
2. Handle errors appropriately for user experience
3. Use pagination for large data sets
4. Validate files before upload
5. Dispose resources when done

### Error Handling

1. Provide user-friendly error messages
2. Implement retry logic for transient errors
3. Log errors for debugging (development only)
4. Graceful degradation for non-critical features

### Performance

1. Use appropriate pagination limits
2. Cache responses when possible
3. Implement loading states
4. Handle slow networks gracefully

## Future Enhancements

### Planned Features

- Offline support with local caching
- Real-time updates via WebSocket
- Background sync
- Request queuing
- Advanced caching strategies

### Monitoring

- Analytics integration
- Performance metrics
- Error reporting
- Usage tracking

## Support

For issues or questions about the API client:

1. Check the example usage in `lib/examples/api_client_usage.dart`
2. Review test files for implementation details
3. Consult the backend API documentation
4. Check logs for debugging information

## Changelog

### Version 1.0.0

- Initial implementation
- All core API endpoints
- File upload support
- Comprehensive error handling
- Unit test coverage
- Documentation and examples
