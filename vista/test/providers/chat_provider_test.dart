import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:mockito/annotations.dart';

import 'package:vista/providers/chat_provider.dart';
import 'package:vista/services/api_client.dart';
import 'package:vista/models/conversation.dart';
import 'package:vista/models/api_response.dart';

import 'chat_provider_test.mocks.dart';

@GenerateMocks([ApiClient])
void main() {
  group('ChatProvider', () {
    late ChatProvider chatProvider;
    late MockApiClient mockApiClient;

    setUp(() {
      mockApiClient = MockApiClient();
      chatProvider = ChatProvider();
      // Note: In a real test, we'd need to inject the mock API client
    });

    test('should initialize with empty state', () {
      expect(chatProvider.conversations, isEmpty);
      expect(chatProvider.isLoadingConversations, false);
      expect(chatProvider.conversationsError, null);
      expect(chatProvider.hasMoreConversations, true);
    });

    test('should get messages for conversation', () {
      const conversationId = 'test-conversation-id';
      final messages = chatProvider.getMessages(conversationId);
      expect(messages, isEmpty);
    });

    test('should check loading state for messages', () {
      const conversationId = 'test-conversation-id';
      final isLoading = chatProvider.isLoadingMessages(conversationId);
      expect(isLoading, false);
    });

    test('should get typing users for conversation', () {
      const conversationId = 'test-conversation-id';
      final typingUsers = chatProvider.getTypingUsers(conversationId);
      expect(typingUsers, isEmpty);
    });

    test('should set typing indicator', () {
      const conversationId = 'test-conversation-id';
      const userId = 'test-user-id';
      
      chatProvider.setTyping(conversationId, userId, true);
      final typingUsers = chatProvider.getTypingUsers(conversationId);
      expect(typingUsers.contains(userId), true);
      
      chatProvider.setTyping(conversationId, userId, false);
      final typingUsersAfter = chatProvider.getTypingUsers(conversationId);
      expect(typingUsersAfter.contains(userId), false);
    });

    test('should clear all data', () {
      // Add some test data first
      const conversationId = 'test-conversation-id';
      const userId = 'test-user-id';
      chatProvider.setTyping(conversationId, userId, true);
      
      // Clear all data
      chatProvider.clear();
      
      // Verify everything is cleared
      expect(chatProvider.conversations, isEmpty);
      expect(chatProvider.getMessages(conversationId), isEmpty);
      expect(chatProvider.getTypingUsers(conversationId), isEmpty);
      expect(chatProvider.isLoadingConversations, false);
      expect(chatProvider.conversationsError, null);
      expect(chatProvider.hasMoreConversations, true);
    });
  });
}