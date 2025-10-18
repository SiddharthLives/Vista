import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as IO;

import '../config/app_config.dart';
import '../services/auth_service.dart';
import '../services/logger_service.dart';
import '../models/conversation.dart';
import '../models/notification.dart';

/// Socket.IO service for real-time communication
class SocketService {
  static final SocketService _instance = SocketService._internal();
  factory SocketService() => _instance;
  SocketService._internal();

  IO.Socket? _socket;
  final AuthService _authService = AuthService();
  
  // Connection state
  bool _isConnected = false;
  bool _isConnecting = false;
  String? _connectionError;
  Timer? _reconnectTimer;
  int _reconnectAttempts = 0;
  static const int _maxReconnectAttempts = 5;
  static const Duration _reconnectDelay = Duration(seconds: 2);

  // Event streams
  final StreamController<Message> _messageController = StreamController<Message>.broadcast();
  final StreamController<Notification> _notificationController = StreamController<Notification>.broadcast();
  final StreamController<Map<String, dynamic>> _likeController = StreamController<Map<String, dynamic>>.broadcast();
  final StreamController<Map<String, dynamic>> _commentController = StreamController<Map<String, dynamic>>.broadcast();
  final StreamController<Map<String, dynamic>> _typingController = StreamController<Map<String, dynamic>>.broadcast();
  final StreamController<bool> _connectionController = StreamController<bool>.broadcast();

  // Getters
  bool get isConnected => _isConnected;
  bool get isConnecting => _isConnecting;
  String? get connectionError => _connectionError;
  
  // Event streams
  Stream<Message> get onMessage => _messageController.stream;
  Stream<Notification> get onNotification => _notificationController.stream;
  Stream<Map<String, dynamic>> get onLike => _likeController.stream;
  Stream<Map<String, dynamic>> get onComment => _commentController.stream;
  Stream<Map<String, dynamic>> get onTyping => _typingController.stream;
  Stream<bool> get onConnectionChange => _connectionController.stream;

  /// Initialize and connect to Socket.IO server
  Future<void> connect() async {
    if (_isConnected || _isConnecting) {
      LoggerService.info('Socket already connected or connecting');
      return;
    }

    _isConnecting = true;
    _connectionError = null;
    _connectionController.add(false);

    try {
      LoggerService.info('Connecting to Socket.IO server: ${AppConfig.socketUrl}');

      // Get JWT token for authentication
      final token = await _authService.getJwtToken();
      if (token == null) {
        throw Exception('No authentication token available');
      }

      // Create socket instance with authentication
      _socket = IO.io(
        AppConfig.socketUrl,
        IO.OptionBuilder()
            .setTransports(['websocket'])
            .enableAutoConnect()
            .enableReconnection()
            .setReconnectionAttempts(_maxReconnectAttempts)
            .setReconnectionDelay(_reconnectDelay.inMilliseconds)
            .setAuth({
              'token': token,
            })
            .build(),
      );

      _setupEventListeners();
      
      // Wait for connection with timeout
      await _waitForConnection();

    } catch (e, stackTrace) {
      LoggerService.error('Failed to connect to Socket.IO server', e, stackTrace);
      _connectionError = e.toString();
      _isConnecting = false;
      _connectionController.add(false);
      _scheduleReconnect();
    }
  }

  /// Wait for socket connection with timeout
  Future<void> _waitForConnection() async {
    final completer = Completer<void>();
    Timer? timeoutTimer;

    void onConnect() {
      if (!completer.isCompleted) {
        completer.complete();
      }
    }

    void onError(dynamic error) {
      if (!completer.isCompleted) {
        completer.completeError(error);
      }
    }

    _socket?.on('connect', (_) => onConnect());
    _socket?.on('connect_error', (error) => onError(error));

    // Set timeout for connection
    timeoutTimer = Timer(const Duration(seconds: 10), () {
      if (!completer.isCompleted) {
        completer.completeError('Connection timeout');
      }
    });

    try {
      await completer.future;
      timeoutTimer?.cancel();
    } catch (e) {
      timeoutTimer?.cancel();
      rethrow;
    }
  }

  /// Set up Socket.IO event listeners
  void _setupEventListeners() {
    if (_socket == null) return;

    // Connection events
    _socket!.on('connect', (_) {
      LoggerService.info('Socket.IO connected successfully');
      _isConnected = true;
      _isConnecting = false;
      _connectionError = null;
      _reconnectAttempts = 0;
      _connectionController.add(true);
    });

    _socket!.on('disconnect', (reason) {
      LoggerService.warning('Socket.IO disconnected: $reason');
      _isConnected = false;
      _isConnecting = false;
      _connectionController.add(false);
      
      // Schedule reconnect if not manually disconnected
      if (reason != 'io client disconnect') {
        _scheduleReconnect();
      }
    });

    _socket!.on('connect_error', (error) {
      LoggerService.error('Socket.IO connection error: $error');
      _connectionError = error.toString();
      _isConnected = false;
      _isConnecting = false;
      _connectionController.add(false);
      _scheduleReconnect();
    });

    // Authentication events
    _socket!.on('authenticated', (_) {
      LoggerService.info('Socket.IO authentication successful');
    });

    _socket!.on('unauthorized', (error) {
      LoggerService.error('Socket.IO authentication failed: $error');
      _connectionError = 'Authentication failed';
      disconnect();
    });

    // Message events
    _socket!.on('message_received', (data) {
      try {
        final message = Message.fromJson(data as Map<String, dynamic>);
        LoggerService.debug('Received message: ${message.id}');
        _messageController.add(message);
      } catch (e, stackTrace) {
        LoggerService.error('Error parsing received message', e, stackTrace);
      }
    });

    // Notification events
    _socket!.on('notification', (data) {
      try {
        final notification = Notification.fromJson(data as Map<String, dynamic>);
        LoggerService.debug('Received notification: ${notification.type}');
        _notificationController.add(notification);
      } catch (e, stackTrace) {
        LoggerService.error('Error parsing notification', e, stackTrace);
      }
    });

    // Like events
    _socket!.on('post_liked', (data) {
      try {
        LoggerService.debug('Received like event');
        _likeController.add(data as Map<String, dynamic>);
      } catch (e, stackTrace) {
        LoggerService.error('Error parsing like event', e, stackTrace);
      }
    });

    _socket!.on('post_unliked', (data) {
      try {
        LoggerService.debug('Received unlike event');
        _likeController.add(data as Map<String, dynamic>);
      } catch (e, stackTrace) {
        LoggerService.error('Error parsing unlike event', e, stackTrace);
      }
    });

    // Comment events
    _socket!.on('comment_added', (data) {
      try {
        LoggerService.debug('Received comment event');
        _commentController.add(data as Map<String, dynamic>);
      } catch (e, stackTrace) {
        LoggerService.error('Error parsing comment event', e, stackTrace);
      }
    });

    // Typing events
    _socket!.on('user_typing', (data) {
      try {
        LoggerService.debug('Received typing event');
        _typingController.add(data as Map<String, dynamic>);
      } catch (e, stackTrace) {
        LoggerService.error('Error parsing typing event', e, stackTrace);
      }
    });

    // Error events
    _socket!.on('error', (error) {
      LoggerService.error('Socket.IO error: $error');
    });
  }

  /// Schedule reconnection attempt
  void _scheduleReconnect() {
    if (_reconnectAttempts >= _maxReconnectAttempts) {
      LoggerService.warning('Max reconnection attempts reached');
      return;
    }

    _reconnectTimer?.cancel();
    _reconnectAttempts++;
    
    final delay = Duration(seconds: _reconnectDelay.inSeconds * _reconnectAttempts);
    LoggerService.info('Scheduling reconnect attempt $_reconnectAttempts in ${delay.inSeconds}s');
    
    _reconnectTimer = Timer(delay, () {
      if (!_isConnected && !_isConnecting) {
        LoggerService.info('Attempting to reconnect...');
        connect();
      }
    });
  }

  /// Join a conversation room for real-time messages
  void joinConversation(String conversationId) {
    if (!_isConnected) {
      LoggerService.warning('Cannot join conversation: Socket not connected');
      return;
    }

    LoggerService.info('Joining conversation: $conversationId');
    _socket?.emit('join_conversation', {'conversationId': conversationId});
  }

  /// Leave a conversation room
  void leaveConversation(String conversationId) {
    if (!_isConnected) {
      LoggerService.warning('Cannot leave conversation: Socket not connected');
      return;
    }

    LoggerService.info('Leaving conversation: $conversationId');
    _socket?.emit('leave_conversation', {'conversationId': conversationId});
  }

  /// Send a message via Socket.IO
  void sendMessage(String conversationId, String text, {String? mediaUrl}) {
    if (!_isConnected) {
      LoggerService.warning('Cannot send message: Socket not connected');
      return;
    }

    final messageData = {
      'conversationId': conversationId,
      'text': text,
      if (mediaUrl != null) 'media': {'url': mediaUrl},
    };

    LoggerService.debug('Sending message via Socket.IO');
    _socket?.emit('send_message', messageData);
  }

  /// Send typing indicator
  void sendTypingIndicator(String conversationId, bool isTyping) {
    if (!_isConnected) {
      return;
    }

    _socket?.emit('typing', {
      'conversationId': conversationId,
      'isTyping': isTyping,
    });
  }

  /// Disconnect from Socket.IO server
  void disconnect() {
    LoggerService.info('Disconnecting from Socket.IO server');
    
    _reconnectTimer?.cancel();
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    
    _isConnected = false;
    _isConnecting = false;
    _connectionError = null;
    _reconnectAttempts = 0;
    _connectionController.add(false);
  }

  /// Dispose all resources
  void dispose() {
    LoggerService.info('Disposing Socket.IO service');
    
    disconnect();
    
    _messageController.close();
    _notificationController.close();
    _likeController.close();
    _commentController.close();
    _typingController.close();
    _connectionController.close();
  }
}