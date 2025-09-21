import '../services/api_service.dart';
import '../services/posts_api_service.dart';
import '../services/stories_api_service.dart';
import '../services/topics_api_service.dart';
import '../services/users_api_service.dart';
import '../services/media_api_service.dart';
import '../services/notifications_api_service.dart';
import '../services/chat_api_service.dart';
import '../services/auth_service.dart';
import '../services/logger_service.dart';
import '../models/user.dart';

/// Centralized API client that provides access to all API services
class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;
  ApiClient._internal();

  // Core services
  final ApiService _apiService = ApiService();
  final AuthService _authService = AuthService();

  // Feature-specific services
  final PostsApiService _postsService = PostsApiService();
  final StoriesApiService _storiesService = StoriesApiService();
  final TopicsApiService _topicsService = TopicsApiService();
  final UsersApiService _usersService = UsersApiService();
  final MediaApiService _mediaService = MediaApiService();
  final NotificationsApiService _notificationsService = NotificationsApiService();
  final ChatApiService _chatService = ChatApiService();

  // Getters for accessing individual services
  PostsApiService get posts => _postsService;
  StoriesApiService get stories => _storiesService;
  TopicsApiService get topics => _topicsService;
  UsersApiService get users => _usersService;
  MediaApiService get media => _mediaService;
  NotificationsApiService get notifications => _notificationsService;
  ChatApiService get chat => _chatService;
  AuthService get auth => _authService;

  /// Initialize the API client
  Future<void> initialize() async {
    try {
      LoggerService.info('Initializing API client');

      // Initialize logger service
      LoggerService.init();

      // Check for stored JWT token and set it
      final storedToken = await _authService.getJwtToken();
      if (storedToken != null) {
        _apiService.setJwtToken(storedToken);
        LoggerService.info('JWT token loaded from storage');
      }

      LoggerService.info('API client initialized successfully');
    } catch (e, stackTrace) {
      LoggerService.error('Failed to initialize API client', e, stackTrace);
      rethrow;
    }
  }

  /// Set JWT token for authenticated requests
  void setJwtToken(String? token) {
    _apiService.setJwtToken(token);
    LoggerService.info('JWT token updated in API client');
  }

  /// Clear JWT token (on logout)
  void clearJwtToken() {
    _apiService.setJwtToken(null);
    LoggerService.info('JWT token cleared from API client');
  }

  /// Check if client is authenticated
  Future<bool> isAuthenticated() async {
    return await _authService.isAuthenticated();
  }

  /// Get current user from stored data
  Future<User?> getCurrentUser() async {
    return await _authService.getStoredUser();
  }

  /// Refresh authentication state
  Future<void> refreshAuth() async {
    try {
      final token = await _authService.getJwtToken();
      if (token != null) {
        setJwtToken(token);
      } else {
        clearJwtToken();
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error refreshing auth state', e, stackTrace);
    }
  }

  /// Health check endpoint
  Future<bool> healthCheck() async {
    try {
      final response = await _apiService.getPublic('/health');
      return response.success;
    } catch (e, stackTrace) {
      LoggerService.error('Health check failed', e, stackTrace);
      return false;
    }
  }

  /// Dispose all resources
  void dispose() {
    try {
      LoggerService.info('Disposing API client resources');
      
      _apiService.dispose();
      _authService.dispose();
      _mediaService.dispose();
      
      LoggerService.info('API client resources disposed');
    } catch (e, stackTrace) {
      LoggerService.error('Error disposing API client resources', e, stackTrace);
    }
  }
}

