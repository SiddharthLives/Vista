import 'package:flutter/foundation.dart';
import '../models/conversation.dart';

import '../services/api_client.dart';
import '../services/logger_service.dart';
import '../providers/realtime_provider.dart';

class ChatProvider extends ChangeNotifier {
  final ApiClient _apiClient = ApiClient();
  final RealtimeProvider _realtimeProvider = RealtimeProvider();

  // Conversations state
  List<ConversationWithParticipants> _conversations = [];
  bool _isLoadingConversations = false;
  String? _conversationsError;
  String? _conversationsNextCursor;
  bool _hasMoreConversations = true;

  // Messages state
  Map<String, List<Message>> _messagesByConversation = {};
  Map<String, bool> _isLoadingMessages = {};
  Map<String, String?> _messagesError = {};
  Map<String, String?> _messagesNextCursor = {};
  Map<String, bool> _hasMoreMessages = {};

  // Typing indicators
  Map<String, Set<String>> _typingUsers = {};

  // Current conversation for real-time updates
  String? _currentConversationId;

  // Getters
  List<ConversationWithParticipants> get conversations => _conversations;
  bool get isLoadingConversations => _isLoadingConversations;
  String? get conversationsError => _conversationsError;
  bool get hasMoreConversations => _hasMoreConversations;

  List<Message> getMessages(String conversationId) {
    return _messagesByConversation[conversationId] ?? [];
  }

  bool isLoadingMessages(String conversationId) {
    return _isLoadingMessages[conversationId] ?? false;
  }

  String? getMessagesError(String conversationId) {
    return _messagesError[conversationId];
  }

  bool hasMoreMessages(String conversationId) {
    return _hasMoreMessages[conversationId] ?? true;
  }

  Set<String> getTypingUsers(String conversationId) {
    return _typingUsers[conversationId] ?? {};
  }

  bool get isRealtimeConnected => _realtimeProvider.isConnected;
  String? get realtimeConnectionError => _realtimeProvider.connectionError;

  /// Initialize real-time functionality
  Future<void> initializeRealtime() async {
    try {
      // Set up real-time event callbacks
      _realtimeProvider.setOnMessageReceived(_handleRealtimeMessage);
      _realtimeProvider.setOnTypingReceived(_handleTypingIndicator);
      
      // Connect to real-time service
      await _realtimeProvider.connect();
      
      LoggerService.info('Real-time chat functionality initialized');
    } catch (e, stackTrace) {
      LoggerService.error('Failed to initialize real-time functionality', e, stackTrace);
    }
  }

  /// Handle real-time message received
  void _handleRealtimeMessage(Message message) {
    LoggerService.debug('Handling real-time message: ${message.id}');
    addMessage(message.conversationId, message);
  }

  /// Handle typing indicator
  void _handleTypingIndicator(Map<String, dynamic> data) {
    final conversationId = data['conversationId'] as String?;
    final studentId = data['studentId'] as String?;
    final isTyping = data['isTyping'] as bool? ?? false;
    
    if (conversationId != null && studentId != null) {
      setTyping(conversationId, studentId, isTyping);
    }
  }

  /// Set current conversation for real-time updates
  void setCurrentConversation(String? conversationId) {
    if (_currentConversationId == conversationId) return;
    
    // Leave previous conversation
    if (_currentConversationId != null) {
      _realtimeProvider.leaveConversation(_currentConversationId!);
    }
    
    // Join new conversation
    _currentConversationId = conversationId;
    if (conversationId != null) {
      _realtimeProvider.joinConversation(conversationId);
    }
    
    LoggerService.info('Current conversation set to: $conversationId');
  }

  /// Load initial conversations
  Future<void> loadInitialConversations() async {
    if (_isLoadingConversations) return;

    _isLoadingConversations = true;
    _conversationsError = null;
    notifyListeners();

    try {
      final result = await _apiClient.chat.getConversations(limit: 20);

      if (result.success && result.data != null) {
        _conversations = result.data!.conversations;
        _conversationsNextCursor = result.data!.pagination.nextCursor;
        _hasMoreConversations = result.data!.pagination.hasMore;
        _conversationsError = null;
      } else {
        _conversationsError = result.error?.message ?? 'Failed to load conversations';
        LoggerService.error('Failed to load conversations: ${result.error?.message}');
      }
    } catch (e, stackTrace) {
      _conversationsError = 'Failed to load conversations';
      LoggerService.error('Error loading conversations', e, stackTrace);
    } finally {
      _isLoadingConversations = false;
      notifyListeners();
    }
  }

  /// Refresh conversations
  Future<void> refreshConversations() async {
    _conversationsNextCursor = null;
    _hasMoreConversations = true;
    await loadInitialConversations();
  }

  /// Load more conversations
  Future<bool> loadMoreConversations() async {
    if (_isLoadingConversations || !_hasMoreConversations || _conversationsNextCursor == null) {
      return false;
    }

    _isLoadingConversations = true;
    notifyListeners();

    try {
      final result = await _apiClient.chat.getConversations(
        cursor: _conversationsNextCursor,
        limit: 20,
      );

      if (result.success && result.data != null) {
        _conversations.addAll(result.data!.conversations);
        _conversationsNextCursor = result.data!.pagination.nextCursor;
        _hasMoreConversations = result.data!.pagination.hasMore;
        _conversationsError = null;
        return true;
      } else {
        _conversationsError = result.error?.message ?? 'Failed to load more conversations';
        LoggerService.error('Failed to load more conversations: ${result.error?.message}');
        return false;
      }
    } catch (e, stackTrace) {
      _conversationsError = 'Failed to load more conversations';
      LoggerService.error('Error loading more conversations', e, stackTrace);
      return false;
    } finally {
      _isLoadingConversations = false;
      notifyListeners();
    }
  }

  /// Create or get conversation with another user
  Future<Conversation?> createOrGetConversation(String otherStudentId) async {
    try {
      final result = await _apiClient.chat.createOrGetConversation(otherStudentId);

      if (result.success && result.data != null) {
        // Refresh conversations to include the new/existing one
        await refreshConversations();
        return result.data;
      } else {
        LoggerService.error('Failed to create/get conversation: ${result.error?.message}');
        return null;
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error creating/getting conversation', e, stackTrace);
      return null;
    }
  }

  /// Load initial messages for a conversation
  Future<void> loadInitialMessages(String conversationId) async {
    if (_isLoadingMessages[conversationId] == true) return;

    _isLoadingMessages[conversationId] = true;
    _messagesError[conversationId] = null;
    notifyListeners();

    try {
      final result = await _apiClient.chat.getMessages(conversationId, limit: 50);

      if (result.success && result.data != null) {
        // Messages come in reverse chronological order, reverse them for display
        final messages = result.data!.messages.reversed.toList();
        _messagesByConversation[conversationId] = messages;
        _messagesNextCursor[conversationId] = result.data!.pagination.nextCursor;
        _hasMoreMessages[conversationId] = result.data!.pagination.hasMore;
        _messagesError[conversationId] = null;
      } else {
        _messagesError[conversationId] = result.error?.message ?? 'Failed to load messages';
        LoggerService.error('Failed to load messages: ${result.error?.message}');
      }
    } catch (e, stackTrace) {
      _messagesError[conversationId] = 'Failed to load messages';
      LoggerService.error('Error loading messages', e, stackTrace);
    } finally {
      _isLoadingMessages[conversationId] = false;
      notifyListeners();
    }
  }

  /// Load more messages (older messages)
  Future<bool> loadMoreMessages(String conversationId) async {
    if (_isLoadingMessages[conversationId] == true || 
        _hasMoreMessages[conversationId] != true || 
        _messagesNextCursor[conversationId] == null) {
      return false;
    }

    _isLoadingMessages[conversationId] = true;
    notifyListeners();

    try {
      final result = await _apiClient.chat.getMessages(
        conversationId,
        cursor: _messagesNextCursor[conversationId],
        limit: 50,
      );

      if (result.success && result.data != null) {
        // Prepend older messages (they come in reverse chronological order)
        final olderMessages = result.data!.messages.reversed.toList();
        final currentMessages = _messagesByConversation[conversationId] ?? [];
        _messagesByConversation[conversationId] = [...olderMessages, ...currentMessages];
        _messagesNextCursor[conversationId] = result.data!.pagination.nextCursor;
        _hasMoreMessages[conversationId] = result.data!.pagination.hasMore;
        _messagesError[conversationId] = null;
        return true;
      } else {
        _messagesError[conversationId] = result.error?.message ?? 'Failed to load more messages';
        LoggerService.error('Failed to load more messages: ${result.error?.message}');
        return false;
      }
    } catch (e, stackTrace) {
      _messagesError[conversationId] = 'Failed to load more messages';
      LoggerService.error('Error loading more messages', e, stackTrace);
      return false;
    } finally {
      _isLoadingMessages[conversationId] = false;
      notifyListeners();
    }
  }

  /// Send a message (real-time via Socket.IO with HTTP fallback)
  Future<Message?> sendMessage(String conversationId, SendMessageRequest request) async {
    try {
      // Try real-time first if connected
      if (_realtimeProvider.isConnected && request.text != null) {
        _realtimeProvider.sendMessage(
          conversationId, 
          request.text!, 
          mediaUrl: request.media?.url,
        );
        
        // The message will be added via real-time callback
        // Return null to indicate real-time sending (no immediate response)
        return null;
      }
      
      // Fallback to HTTP API
      final result = await _apiClient.chat.sendMessage(conversationId, request);

      if (result.success && result.data != null) {
        // Add the new message to the local list
        final currentMessages = _messagesByConversation[conversationId] ?? [];
        _messagesByConversation[conversationId] = [...currentMessages, result.data!];
        notifyListeners();
        return result.data;
      } else {
        LoggerService.error('Failed to send message: ${result.error?.message}');
        return null;
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error sending message', e, stackTrace);
      return null;
    }
  }

  /// Add a new message (for real-time updates)
  void addMessage(String conversationId, Message message) {
    final currentMessages = _messagesByConversation[conversationId] ?? [];
    _messagesByConversation[conversationId] = [...currentMessages, message];
    
    // Update conversation's last message
    final conversationIndex = _conversations.indexWhere(
      (conv) => conv.conversation.id == conversationId,
    );
    if (conversationIndex != -1) {
      final conversation = _conversations[conversationIndex];
      final updatedConversation = Conversation(
        id: conversation.conversation.id,
        participants: conversation.conversation.participants,
        lastMessage: message.text ?? 'Media',
        updatedAt: message.createdAt,
      );
      _conversations[conversationIndex] = ConversationWithParticipants(
        conversation: updatedConversation,
        participants: conversation.participants,
      );
    }
    
    notifyListeners();
  }

  /// Mark messages as read
  Future<void> markMessagesAsRead(String conversationId, List<String> messageIds) async {
    try {
      final result = await _apiClient.chat.markMessagesAsRead(conversationId, messageIds);
      
      if (result.success) {
        // Update local messages read status
        final messages = _messagesByConversation[conversationId];
        if (messages != null) {
          for (int i = 0; i < messages.length; i++) {
            if (messageIds.contains(messages[i].id)) {
              // Note: We'd need to update the Message model to track read status
              // For now, we'll just log the success
              LoggerService.info('Marked message ${messages[i].id} as read');
            }
          }
        }
      } else {
        LoggerService.error('Failed to mark messages as read: ${result.error?.message}');
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error marking messages as read', e, stackTrace);
    }
  }

  /// Set typing indicator
  void setTyping(String conversationId, String userId, bool isTyping) {
    final typingSet = _typingUsers[conversationId] ?? <String>{};
    
    if (isTyping) {
      typingSet.add(userId);
    } else {
      typingSet.remove(userId);
    }
    
    _typingUsers[conversationId] = typingSet;
    notifyListeners();
  }

  /// Send typing indicator via real-time
  void sendTypingIndicator(String conversationId, bool isTyping) {
    if (_realtimeProvider.isConnected) {
      _realtimeProvider.sendTypingIndicator(conversationId, isTyping);
    }
  }

  /// Clear all data (for logout)
  void clear() {
    // Leave current conversation
    if (_currentConversationId != null) {
      _realtimeProvider.leaveConversation(_currentConversationId!);
      _currentConversationId = null;
    }
    
    // Clear real-time callbacks
    _realtimeProvider.clearCallbacks();
    
    // Clear local data
    _conversations.clear();
    _messagesByConversation.clear();
    _isLoadingMessages.clear();
    _messagesError.clear();
    _messagesNextCursor.clear();
    _hasMoreMessages.clear();
    _typingUsers.clear();
    _conversationsNextCursor = null;
    _hasMoreConversations = true;
    _isLoadingConversations = false;
    _conversationsError = null;
    notifyListeners();
  }
}