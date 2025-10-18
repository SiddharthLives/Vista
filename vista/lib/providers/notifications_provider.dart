import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import '../services/fcm_service.dart';
import '../services/api_client.dart';
import '../services/logger_service.dart';
import '../models/notification.dart';

/// Provider for managing push notifications and notification state
class NotificationsProvider extends ChangeNotifier {
  final FCMService _fcmService = FCMService();
  final ApiClient _apiClient = ApiClient();

  // Notifications state
  List<Notification> _notifications = [];
  bool _isLoading = false;
  String? _error;
  bool _isInitialized = false;
  String? _nextCursor;
  bool _hasMore = true;

  // FCM state
  bool _fcmInitialized = false;
  String? _fcmToken;
  bool _notificationsEnabled = false;

  // Event subscriptions
  StreamSubscription<RemoteMessage>? _messageSubscription;
  StreamSubscription<Notification>? _notificationSubscription;

  // Getters
  List<Notification> get notifications => _notifications;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get isInitialized => _isInitialized;
  bool get hasMore => _hasMore;
  bool get fcmInitialized => _fcmInitialized;
  String? get fcmToken => _fcmToken;
  bool get notificationsEnabled => _notificationsEnabled;
  int get unreadCount => _notifications.where((n) => !n.isRead).length;

  /// Initialize notifications provider
  Future<void> initialize() async {
    if (_isInitialized) {
      LoggerService.info('Notifications provider already initialized');
      return;
    }

    try {
      LoggerService.info('Initializing notifications provider');

      // Initialize FCM service
      await _initializeFCM();

      // Set up event listeners
      _setupEventListeners();

      // Load initial notifications
      await loadInitialNotifications();

      _isInitialized = true;
      LoggerService.info('Notifications provider initialized successfully');

    } catch (e, stackTrace) {
      LoggerService.error('Failed to initialize notifications provider', e, stackTrace);
      _error = 'Failed to initialize notifications';
      notifyListeners();
    }
  }

  /// Initialize FCM service
  Future<void> _initializeFCM() async {
    try {
      await _fcmService.initialize();
      _fcmInitialized = true;
      _fcmToken = _fcmService.fcmToken;
      _notificationsEnabled = await _fcmService.areNotificationsEnabled();
      
      LoggerService.info('FCM initialized in notifications provider');
    } catch (e, stackTrace) {
      LoggerService.error('Failed to initialize FCM in notifications provider', e, stackTrace);
      _fcmInitialized = false;
    }
    notifyListeners();
  }

  /// Set up event listeners for FCM messages
  void _setupEventListeners() {
    // Listen to FCM messages
    _messageSubscription = _fcmService.onMessage.listen((RemoteMessage message) {
      LoggerService.debug('Received FCM message in notifications provider');
      _handleFCMMessage(message);
    });

    // Listen to app notifications
    _notificationSubscription = _fcmService.onNotification.listen((Notification notification) {
      LoggerService.debug('Received app notification in notifications provider');
      _handleAppNotification(notification);
    });
  }

  /// Handle FCM message
  void _handleFCMMessage(RemoteMessage message) {
    try {
      LoggerService.info('Processing FCM message: ${message.notification?.title}');
      
      // Show in-app notification or update UI based on message
      // This could trigger a snackbar, dialog, or other UI update
      
      // Refresh notifications to get the latest from server
      refreshNotifications();
      
    } catch (e, stackTrace) {
      LoggerService.error('Error handling FCM message', e, stackTrace);
    }
  }

  /// Handle app notification
  void _handleAppNotification(Notification notification) {
    try {
      LoggerService.info('Processing app notification: ${notification.type}');
      
      // Add notification to local list if not already present
      final existingIndex = _notifications.indexWhere((n) => n.id == notification.id);
      if (existingIndex == -1) {
        _notifications.insert(0, notification);
        notifyListeners();
      }
      
    } catch (e, stackTrace) {
      LoggerService.error('Error handling app notification', e, stackTrace);
    }
  }

  /// Load initial notifications
  Future<void> loadInitialNotifications() async {
    if (_isLoading) return;

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _apiClient.notifications.getNotifications(limit: 20);

      if (response.success && response.data != null) {
        _notifications = response.data!.notifications;
        _nextCursor = response.data!.pagination.nextCursor;
        _hasMore = response.data!.pagination.hasMore;
        LoggerService.info('Loaded ${_notifications.length} initial notifications');
      } else {
        _error = response.error?.message ?? 'Failed to load notifications';
        LoggerService.error('Failed to load initial notifications: $_error');
      }
    } catch (e, stackTrace) {
      _error = 'An unexpected error occurred';
      LoggerService.error('Error loading initial notifications', e, stackTrace);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Refresh notifications
  Future<void> refreshNotifications() async {
    try {
      final response = await _apiClient.notifications.getNotifications(limit: 20);

      if (response.success && response.data != null) {
        _notifications = response.data!.notifications;
        _nextCursor = response.data!.pagination.nextCursor;
        _hasMore = response.data!.pagination.hasMore;
        _error = null;
        LoggerService.info('Refreshed notifications: ${_notifications.length} items');
      } else {
        _error = response.error?.message ?? 'Failed to refresh notifications';
        LoggerService.error('Failed to refresh notifications: $_error');
      }
    } catch (e, stackTrace) {
      _error = 'An unexpected error occurred while refreshing';
      LoggerService.error('Error refreshing notifications', e, stackTrace);
    }
    
    notifyListeners();
  }

  /// Load more notifications
  Future<bool> loadMoreNotifications() async {
    if (_isLoading || !_hasMore || _nextCursor == null) {
      return false;
    }

    _isLoading = true;
    notifyListeners();

    try {
      final response = await _apiClient.notifications.getNotifications(
        cursor: _nextCursor,
        limit: 20,
      );

      if (response.success && response.data != null) {
        _notifications.addAll(response.data!.notifications);
        _nextCursor = response.data!.pagination.nextCursor;
        _hasMore = response.data!.pagination.hasMore;
        LoggerService.info('Loaded ${response.data!.notifications.length} more notifications');
        return _hasMore;
      } else {
        _error = response.error?.message ?? 'Failed to load more notifications';
        LoggerService.error('Failed to load more notifications: $_error');
        return false;
      }
    } catch (e, stackTrace) {
      _error = 'An unexpected error occurred while loading more notifications';
      LoggerService.error('Error loading more notifications', e, stackTrace);
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Mark notification as read
  Future<void> markAsRead(String notificationId) async {
    try {
      final response = await _apiClient.notifications.markNotificationAsRead(notificationId);

      if (response.success) {
        // Update local notification
        final index = _notifications.indexWhere((n) => n.id == notificationId);
        if (index != -1) {
          _notifications[index] = Notification(
            id: _notifications[index].id,
            toStudentId: _notifications[index].toStudentId,
            type: _notifications[index].type,
            meta: _notifications[index].meta,
            isRead: true,
            createdAt: _notifications[index].createdAt,
          );
          notifyListeners();
        }
        LoggerService.info('Marked notification as read: $notificationId');
      } else {
        LoggerService.error('Failed to mark notification as read: ${response.error?.message}');
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error marking notification as read', e, stackTrace);
    }
  }

  /// Mark all notifications as read
  Future<void> markAllAsRead() async {
    try {
      final response = await _apiClient.notifications.markAllNotificationsAsRead();

      if (response.success) {
        // Update all local notifications
        _notifications = _notifications.map((notification) => Notification(
          id: notification.id,
          toStudentId: notification.toStudentId,
          type: notification.type,
          meta: notification.meta,
          isRead: true,
          createdAt: notification.createdAt,
        )).toList();
        
        notifyListeners();
        LoggerService.info('Marked all notifications as read');
      } else {
        LoggerService.error('Failed to mark all notifications as read: ${response.error?.message}');
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error marking all notifications as read', e, stackTrace);
    }
  }

  /// Subscribe to notification topic
  Future<void> subscribeToTopic(String topic) async {
    try {
      await _fcmService.subscribeToTopic(topic);
      LoggerService.info('Subscribed to notification topic: $topic');
    } catch (e, stackTrace) {
      LoggerService.error('Error subscribing to topic: $topic', e, stackTrace);
    }
  }

  /// Unsubscribe from notification topic
  Future<void> unsubscribeFromTopic(String topic) async {
    try {
      await _fcmService.unsubscribeFromTopic(topic);
      LoggerService.info('Unsubscribed from notification topic: $topic');
    } catch (e, stackTrace) {
      LoggerService.error('Error unsubscribing from topic: $topic', e, stackTrace);
    }
  }

  /// Check and update notification permissions
  Future<void> checkNotificationPermissions() async {
    try {
      _notificationsEnabled = await _fcmService.areNotificationsEnabled();
      notifyListeners();
      LoggerService.info('Notification permissions checked: $_notificationsEnabled');
    } catch (e, stackTrace) {
      LoggerService.error('Error checking notification permissions', e, stackTrace);
    }
  }

  /// Request notification permissions
  Future<bool> requestNotificationPermissions() async {
    try {
      // Re-initialize FCM to request permissions
      await _fcmService.initialize();
      _notificationsEnabled = await _fcmService.areNotificationsEnabled();
      notifyListeners();
      
      LoggerService.info('Notification permissions requested: $_notificationsEnabled');
      return _notificationsEnabled;
    } catch (e, stackTrace) {
      LoggerService.error('Error requesting notification permissions', e, stackTrace);
      return false;
    }
  }

  /// Clear error
  void clearError() {
    _error = null;
    notifyListeners();
  }

  /// Add a new notification (for real-time updates)
  void addNotification(Notification notification) {
    _notifications.insert(0, notification);
    notifyListeners();
    LoggerService.info('Added new notification: ${notification.id}');
  }

  /// Clear all notifications
  void clear() {
    _notifications.clear();
    _nextCursor = null;
    _hasMore = true;
    _error = null;
    _isLoading = false;
    notifyListeners();
    LoggerService.info('Cleared all notifications');
  }

  @override
  void dispose() {
    LoggerService.info('Disposing notifications provider');
    
    // Cancel subscriptions
    _messageSubscription?.cancel();
    _notificationSubscription?.cancel();
    
    // Dispose FCM service
    _fcmService.dispose();
    
    super.dispose();
  }
}