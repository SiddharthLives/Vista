import 'dart:async';
import 'dart:io';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../services/logger_service.dart';
import '../services/auth_service.dart';
import '../services/api_client.dart';
import '../models/notification.dart' as app_notification;

/// Firebase Cloud Messaging service for push notifications
class FCMService {
  static final FCMService _instance = FCMService._internal();
  factory FCMService() => _instance;
  FCMService._internal();

  final FirebaseMessaging _firebaseMessaging = FirebaseMessaging.instance;
  final AuthService _authService = AuthService();
  final ApiClient _apiClient = ApiClient();

  String? _fcmToken;
  bool _isInitialized = false;

  // Notification streams
  final StreamController<RemoteMessage> _messageController = StreamController<RemoteMessage>.broadcast();
  final StreamController<app_notification.Notification> _notificationController = StreamController<app_notification.Notification>.broadcast();

  // Getters
  String? get fcmToken => _fcmToken;
  bool get isInitialized => _isInitialized;
  Stream<RemoteMessage> get onMessage => _messageController.stream;
  Stream<app_notification.Notification> get onNotification => _notificationController.stream;

  /// Initialize FCM service
  Future<void> initialize() async {
    if (_isInitialized) {
      LoggerService.info('FCM service already initialized');
      return;
    }

    try {
      LoggerService.info('Initializing FCM service');

      // Request notification permissions
      await _requestPermissions();

      // Get FCM token
      await _getFCMToken();

      // Set up message handlers
      _setupMessageHandlers();

      // Register token with backend
      await _registerTokenWithBackend();

      _isInitialized = true;
      LoggerService.info('FCM service initialized successfully');

    } catch (e, stackTrace) {
      LoggerService.error('Failed to initialize FCM service', e, stackTrace);
      rethrow;
    }
  }

  /// Request notification permissions
  Future<void> _requestPermissions() async {
    try {
      LoggerService.info('Requesting notification permissions');

      final settings = await _firebaseMessaging.requestPermission(
        alert: true,
        announcement: false,
        badge: true,
        carPlay: false,
        criticalAlert: false,
        provisional: false,
        sound: true,
      );

      LoggerService.info('Notification permission status: ${settings.authorizationStatus}');

      if (settings.authorizationStatus == AuthorizationStatus.denied) {
        LoggerService.warning('Notification permissions denied by user');
        throw Exception('Notification permissions denied');
      }

      if (settings.authorizationStatus == AuthorizationStatus.notDetermined) {
        LoggerService.warning('Notification permissions not determined');
        throw Exception('Notification permissions not determined');
      }

    } catch (e, stackTrace) {
      LoggerService.error('Error requesting notification permissions', e, stackTrace);
      rethrow;
    }
  }

  /// Get FCM token
  Future<void> _getFCMToken() async {
    try {
      LoggerService.info('Getting FCM token');

      _fcmToken = await _firebaseMessaging.getToken();
      
      if (_fcmToken == null) {
        throw Exception('Failed to get FCM token');
      }

      LoggerService.info('FCM token obtained: ${_fcmToken!.substring(0, 20)}...');

      // Listen for token refresh
      _firebaseMessaging.onTokenRefresh.listen((newToken) {
        LoggerService.info('FCM token refreshed');
        _fcmToken = newToken;
        _registerTokenWithBackend();
      });

    } catch (e, stackTrace) {
      LoggerService.error('Error getting FCM token', e, stackTrace);
      rethrow;
    }
  }

  /// Set up message handlers for different app states
  void _setupMessageHandlers() {
    LoggerService.info('Setting up FCM message handlers');

    // Handle messages when app is in foreground
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      LoggerService.info('Received foreground message: ${message.messageId}');
      _handleForegroundMessage(message);
    });

    // Handle messages when app is in background but not terminated
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      LoggerService.info('App opened from background notification: ${message.messageId}');
      _handleNotificationTap(message);
    });

    // Handle messages when app is terminated and opened from notification
    _handleTerminatedAppMessage();
  }

  /// Handle foreground messages (show in-app notification)
  void _handleForegroundMessage(RemoteMessage message) {
    try {
      LoggerService.debug('Processing foreground message: ${message.notification?.title}');
      
      // Emit the raw message for UI handling
      _messageController.add(message);

      // Convert to app notification if possible
      final appNotification = _convertToAppNotification(message);
      if (appNotification != null) {
        _notificationController.add(appNotification);
      }

    } catch (e, stackTrace) {
      LoggerService.error('Error handling foreground message', e, stackTrace);
    }
  }

  /// Handle notification tap (navigate to relevant screen)
  void _handleNotificationTap(RemoteMessage message) {
    try {
      LoggerService.info('Handling notification tap: ${message.data}');
      
      // Emit the message for navigation handling
      _messageController.add(message);

      // Convert to app notification for processing
      final appNotification = _convertToAppNotification(message);
      if (appNotification != null) {
        _notificationController.add(appNotification);
      }

    } catch (e, stackTrace) {
      LoggerService.error('Error handling notification tap', e, stackTrace);
    }
  }

  /// Handle messages when app was terminated
  Future<void> _handleTerminatedAppMessage() async {
    try {
      final RemoteMessage? initialMessage = await _firebaseMessaging.getInitialMessage();
      
      if (initialMessage != null) {
        LoggerService.info('App opened from terminated state via notification: ${initialMessage.messageId}');
        _handleNotificationTap(initialMessage);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error handling terminated app message', e, stackTrace);
    }
  }

  /// Convert FCM RemoteMessage to app Notification
  app_notification.Notification? _convertToAppNotification(RemoteMessage message) {
    try {
      final data = message.data;
      
      // Extract notification data from message
      final notificationId = data['notificationId'] as String?;
      final toStudentId = data['toStudentId'] as String?;
      final typeString = data['type'] as String?;
      final metaData = data['meta'] as Map<String, dynamic>?;
      
      if (notificationId == null || toStudentId == null || typeString == null) {
        LoggerService.warning('Incomplete notification data in FCM message');
        return null;
      }

      // Parse notification type
      final type = app_notification.NotificationType.values.firstWhere(
        (e) => e.name == typeString,
        orElse: () => app_notification.NotificationType.message,
      );

      // Parse meta data
      final meta = metaData != null 
          ? app_notification.NotificationMeta.fromJson(metaData)
          : const app_notification.NotificationMeta();

      return app_notification.Notification(
        id: notificationId,
        toStudentId: toStudentId,
        type: type,
        meta: meta,
        isRead: false,
        createdAt: DateTime.now(),
      );

    } catch (e, stackTrace) {
      LoggerService.error('Error converting FCM message to app notification', e, stackTrace);
      return null;
    }
  }

  /// Register FCM token with backend
  Future<void> _registerTokenWithBackend() async {
    try {
      if (_fcmToken == null) {
        LoggerService.warning('No FCM token available for registration');
        return;
      }

      LoggerService.info('Registering FCM token with backend');

      final response = await _apiClient.notifications.registerFCMToken(_fcmToken!);
      
      if (response.success) {
        LoggerService.info('FCM token registered successfully with backend');
      } else {
        LoggerService.error('Failed to register FCM token: ${response.error?.message}');
      }

    } catch (e, stackTrace) {
      LoggerService.error('Error registering FCM token with backend', e, stackTrace);
    }
  }

  /// Subscribe to topic for broadcast notifications
  Future<void> subscribeToTopic(String topic) async {
    try {
      LoggerService.info('Subscribing to FCM topic: $topic');
      await _firebaseMessaging.subscribeToTopic(topic);
      LoggerService.info('Successfully subscribed to topic: $topic');
    } catch (e, stackTrace) {
      LoggerService.error('Error subscribing to topic: $topic', e, stackTrace);
    }
  }

  /// Unsubscribe from topic
  Future<void> unsubscribeFromTopic(String topic) async {
    try {
      LoggerService.info('Unsubscribing from FCM topic: $topic');
      await _firebaseMessaging.unsubscribeFromTopic(topic);
      LoggerService.info('Successfully unsubscribed from topic: $topic');
    } catch (e, stackTrace) {
      LoggerService.error('Error unsubscribing from topic: $topic', e, stackTrace);
    }
  }

  /// Get notification settings
  Future<NotificationSettings> getNotificationSettings() async {
    return await _firebaseMessaging.getNotificationSettings();
  }

  /// Check if notifications are enabled
  Future<bool> areNotificationsEnabled() async {
    final settings = await getNotificationSettings();
    return settings.authorizationStatus == AuthorizationStatus.authorized ||
           settings.authorizationStatus == AuthorizationStatus.provisional;
  }

  /// Handle background messages (static method required by FCM)
  static Future<void> handleBackgroundMessage(RemoteMessage message) async {
    LoggerService.info('Handling background message: ${message.messageId}');
    
    // Background message handling logic
    // Note: This runs in a separate isolate, so we can't access instance variables
    try {
      // Log the background message
      LoggerService.debug('Background message data: ${message.data}');
      LoggerService.debug('Background message notification: ${message.notification?.title}');
      
      // Any background processing can be done here
      // For example, updating local database, etc.
      
    } catch (e) {
      LoggerService.error('Error in background message handler: $e');
    }
  }

  /// Clear all notifications
  Future<void> clearAllNotifications() async {
    try {
      // This would clear notifications from the system tray
      // Implementation depends on platform-specific plugins
      LoggerService.info('Clearing all notifications');
    } catch (e, stackTrace) {
      LoggerService.error('Error clearing notifications', e, stackTrace);
    }
  }

  /// Dispose FCM service
  void dispose() {
    LoggerService.info('Disposing FCM service');
    
    _messageController.close();
    _notificationController.close();
    
    _isInitialized = false;
  }
}