import 'dart:async';
import 'package:flutter/foundation.dart';

import '../services/socket_service.dart';
import '../services/logger_service.dart';
import '../models/conversation.dart';
import '../models/notification.dart';

/// Provider for managing real-time Socket.IO connections and events
class RealtimeProvider extends ChangeNotifier {
  final SocketService _socketService = SocketService();
  
  // Connection state
  bool _isConnected = false;
  bool _isConnecting = false;
  String? _connectionError;
  
  // Event subscriptions
  StreamSubscription<Message>? _messageSubscription;
  StreamSubscription<Notification>? _notificationSubscription;
  StreamSubscription<Map<String, dynamic>>? _likeSubscription;
  StreamSubscription<Map<String, dynamic>>? _commentSubscription;
  StreamSubscription<Map<String, dynamic>>? _typingSubscription;
  StreamSubscription<bool>? _connectionSubscription;

  // Event callbacks
  Function(Message)? _onMessageReceived;
  Function(Notification)? _onNotificationReceived;
  Function(Map<String, dynamic>)? _onLikeReceived;
  Function(Map<String, dynamic>)? _onCommentReceived;
  Function(Map<String, dynamic>)? _onTypingReceived;

  // Getters
  bool get isConnected => _isConnected;
  bool get isConnecting => _isConnecting;
  String? get connectionError => _connectionError;

  RealtimeProvider() {
    _initializeSocketListeners();
  }

  /// Initialize Socket.IO event listeners
  void _initializeSocketListeners() {
    // Connection state listener
    _connectionSubscription = _socketService.onConnectionChange.listen((connected) {
      _isConnected = connected;
      _isConnecting = false;
      if (connected) {
        _connectionError = null;
        LoggerService.info('Real-time connection established');
      } else {
        LoggerService.info('Real-time connection lost');
      }
      notifyListeners();
    });

    // Message listener
    _messageSubscription = _socketService.onMessage.listen((message) {
      LoggerService.debug('Real-time message received: ${message.id}');
      _onMessageReceived?.call(message);
    });

    // Notification listener
    _notificationSubscription = _socketService.onNotification.listen((notification) {
      LoggerService.debug('Real-time notification received: ${notification.type}');
      _onNotificationReceived?.call(notification);
    });

    // Like event listener
    _likeSubscription = _socketService.onLike.listen((likeData) {
      LoggerService.debug('Real-time like event received');
      _onLikeReceived?.call(likeData);
    });

    // Comment event listener
    _commentSubscription = _socketService.onComment.listen((commentData) {
      LoggerService.debug('Real-time comment event received');
      _onCommentReceived?.call(commentData);
    });

    // Typing indicator listener
    _typingSubscription = _socketService.onTyping.listen((typingData) {
      LoggerService.debug('Real-time typing event received');
      _onTypingReceived?.call(typingData);
    });
  }

  /// Connect to Socket.IO server
  Future<void> connect() async {
    if (_isConnected || _isConnecting) {
      LoggerService.info('Already connected or connecting to real-time service');
      return;
    }

    _isConnecting = true;
    _connectionError = null;
    notifyListeners();

    try {
      await _socketService.connect();
      LoggerService.info('Successfully connected to real-time service');
    } catch (e, stackTrace) {
      LoggerService.error('Failed to connect to real-time service', e, stackTrace);
      _connectionError = e.toString();
      _isConnecting = false;
      notifyListeners();
    }
  }

  /// Disconnect from Socket.IO server
  void disconnect() {
    LoggerService.info('Disconnecting from real-time service');
    _socketService.disconnect();
    _isConnected = false;
    _isConnecting = false;
    _connectionError = null;
    notifyListeners();
  }

  /// Join a conversation for real-time messages
  void joinConversation(String conversationId) {
    LoggerService.info('Joining conversation for real-time updates: $conversationId');
    _socketService.joinConversation(conversationId);
  }

  /// Leave a conversation
  void leaveConversation(String conversationId) {
    LoggerService.info('Leaving conversation: $conversationId');
    _socketService.leaveConversation(conversationId);
  }

  /// Send a message via Socket.IO
  void sendMessage(String conversationId, String text, {String? mediaUrl}) {
    LoggerService.debug('Sending message via real-time service');
    _socketService.sendMessage(conversationId, text, mediaUrl: mediaUrl);
  }

  /// Send typing indicator
  void sendTypingIndicator(String conversationId, bool isTyping) {
    _socketService.sendTypingIndicator(conversationId, isTyping);
  }

  /// Set callback for received messages
  void setOnMessageReceived(Function(Message) callback) {
    _onMessageReceived = callback;
  }

  /// Set callback for received notifications
  void setOnNotificationReceived(Function(Notification) callback) {
    _onNotificationReceived = callback;
  }

  /// Set callback for like events
  void setOnLikeReceived(Function(Map<String, dynamic>) callback) {
    _onLikeReceived = callback;
  }

  /// Set callback for comment events
  void setOnCommentReceived(Function(Map<String, dynamic>) callback) {
    _onCommentReceived = callback;
  }

  /// Set callback for typing events
  void setOnTypingReceived(Function(Map<String, dynamic>) callback) {
    _onTypingReceived = callback;
  }

  /// Clear all event callbacks
  void clearCallbacks() {
    _onMessageReceived = null;
    _onNotificationReceived = null;
    _onLikeReceived = null;
    _onCommentReceived = null;
    _onTypingReceived = null;
  }

  @override
  void dispose() {
    LoggerService.info('Disposing real-time provider');
    
    // Cancel all subscriptions
    _messageSubscription?.cancel();
    _notificationSubscription?.cancel();
    _likeSubscription?.cancel();
    _commentSubscription?.cancel();
    _typingSubscription?.cancel();
    _connectionSubscription?.cancel();
    
    // Clear callbacks
    clearCallbacks();
    
    // Disconnect socket
    _socketService.disconnect();
    
    super.dispose();
  }
}