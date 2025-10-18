import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';

import '../providers/chat_provider.dart';
import '../providers/auth_provider.dart';
import '../widgets/loading_widget.dart';
import '../widgets/error_widget.dart';
import '../widgets/message_bubble.dart';
import '../widgets/message_composer.dart';
import '../models/conversation.dart';
import '../models/user.dart';

class ChatScreen extends StatefulWidget {
  final Conversation conversation;
  final List<User> participants;

  const ChatScreen({
    super.key,
    required this.conversation,
    required this.participants,
  });

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final ScrollController _scrollController = ScrollController();
  late User _otherParticipant;
  late User _currentUser;

  @override
  void initState() {
    super.initState();
    _initializeUsers();
    _setupScrollController();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadInitialMessages();
      _setupRealtimeChat();
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    // Leave conversation when disposing
    final chatProvider = Provider.of<ChatProvider>(context, listen: false);
    chatProvider.setCurrentConversation(null);
    super.dispose();
  }

  void _initializeUsers() {
    _currentUser = Provider.of<AuthProvider>(context, listen: false).user!;
    _otherParticipant = widget.participants.firstWhere(
      (user) => user.studentId != _currentUser.studentId,
      orElse: () => widget.participants.first,
    );
  }

  void _setupScrollController() {
    _scrollController.addListener(() {
      // Load more messages when scrolled to top
      if (_scrollController.position.pixels == _scrollController.position.maxScrollExtent) {
        _loadMoreMessages();
      }
    });
  }

  Future<void> _loadInitialMessages() async {
    final chatProvider = Provider.of<ChatProvider>(context, listen: false);
    await chatProvider.loadInitialMessages(widget.conversation.id);
    _scrollToBottom();
  }

  Future<void> _setupRealtimeChat() async {
    final chatProvider = Provider.of<ChatProvider>(context, listen: false);
    
    // Initialize real-time functionality if not already done
    await chatProvider.initializeRealtime();
    
    // Set current conversation for real-time updates
    chatProvider.setCurrentConversation(widget.conversation.id);
  }

  Future<void> _loadMoreMessages() async {
    final chatProvider = Provider.of<ChatProvider>(context, listen: false);
    await chatProvider.loadMoreMessages(widget.conversation.id);
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          0.0,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendMessage(String text, {MessageMedia? media}) async {
    final chatProvider = Provider.of<ChatProvider>(context, listen: false);
    
    final request = SendMessageRequest(
      text: text.isNotEmpty ? text : null,
      media: media,
    );

    final message = await chatProvider.sendMessage(widget.conversation.id, request);
    
    if (message != null) {
      _scrollToBottom();
    } else {
      // Show error message
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to send message'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            CircleAvatar(
              radius: 16,
              backgroundImage: _otherParticipant.photoUrl != null
                  ? NetworkImage(_otherParticipant.photoUrl!)
                  : null,
              child: _otherParticipant.photoUrl == null
                  ? Text(
                      _otherParticipant.displayName.isNotEmpty
                          ? _otherParticipant.displayName[0].toUpperCase()
                          : '?',
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                    )
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _otherParticipant.displayName,
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (_otherParticipant.year != null || _otherParticipant.department != null)
                    Text(
                      '${_otherParticipant.year ?? ''} ${_otherParticipant.department ?? ''}'.trim(),
                      style: TextStyle(
                        fontSize: 12,
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                ],
              ),
            ),
          ],
        ),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.more_vert),
            onPressed: () {
              // TODO: Show conversation options menu
            },
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: Consumer<ChatProvider>(
              builder: (context, chatProvider, child) {
                final messages = chatProvider.getMessages(widget.conversation.id);
                final isLoading = chatProvider.isLoadingMessages(widget.conversation.id);
                final error = chatProvider.getMessagesError(widget.conversation.id);

                if (isLoading && messages.isEmpty) {
                  return const LoadingWidget(message: 'Loading messages...');
                }

                if (error != null && messages.isEmpty) {
                  return CustomErrorWidget(
                    message: error,
                    onRetry: _loadInitialMessages,
                  );
                }

                if (messages.isEmpty) {
                  return _buildEmptyState();
                }

                return ListView.builder(
                  controller: _scrollController,
                  reverse: true, // Show newest messages at bottom
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  itemCount: messages.length + (chatProvider.hasMoreMessages(widget.conversation.id) ? 1 : 0),
                  itemBuilder: (context, index) {
                    // Load more indicator at the top (index 0 when reversed)
                    if (index == messages.length) {
                      return Container(
                        padding: const EdgeInsets.all(16),
                        alignment: Alignment.center,
                        child: isLoading
                            ? const CircularProgressIndicator()
                            : TextButton(
                                onPressed: _loadMoreMessages,
                                child: const Text('Load more messages'),
                              ),
                      );
                    }

                    final message = messages[messages.length - 1 - index]; // Reverse index
                    final isCurrentUser = message.senderStudentId == _currentUser.studentId;
                    final showDateHeader = _shouldShowDateHeader(messages, messages.length - 1 - index);

                    return Column(
                      children: [
                        if (showDateHeader) _buildDateHeader(message.createdAt),
                        MessageBubble(
                          message: message,
                          isCurrentUser: isCurrentUser,
                          showSenderInfo: !isCurrentUser,
                        ),
                      ],
                    );
                  },
                );
              },
            ),
          ),
          // Typing indicator
          Consumer<ChatProvider>(
            builder: (context, chatProvider, child) {
              final typingUsers = chatProvider.getTypingUsers(widget.conversation.id);
              final otherUsersTyping = typingUsers.where((userId) => userId != _currentUser.studentId).toList();

              if (otherUsersTyping.isEmpty) {
                return const SizedBox.shrink();
              }

              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Row(
                  children: [
                    const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '${_otherParticipant.displayName} is typing...',
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
          MessageComposer(
            onSendMessage: _sendMessage,
            onTypingChanged: (isTyping) {
              final chatProvider = Provider.of<ChatProvider>(context, listen: false);
              chatProvider.sendTypingIndicator(widget.conversation.id, isTyping);
            },
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          CircleAvatar(
            radius: 40,
            backgroundImage: _otherParticipant.photoUrl != null
                ? NetworkImage(_otherParticipant.photoUrl!)
                : null,
            child: _otherParticipant.photoUrl == null
                ? Text(
                    _otherParticipant.displayName.isNotEmpty
                        ? _otherParticipant.displayName[0].toUpperCase()
                        : '?',
                    style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                  )
                : null,
          ),
          const SizedBox(height: 16),
          Text(
            _otherParticipant.displayName,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          if (_otherParticipant.year != null || _otherParticipant.department != null)
            Text(
              '${_otherParticipant.year ?? ''} ${_otherParticipant.department ?? ''}'.trim(),
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          const SizedBox(height: 8),
          Text(
            'Start your conversation!',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDateHeader(DateTime date) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final messageDate = DateTime(date.year, date.month, date.day);
    
    String dateText;
    if (messageDate == today) {
      dateText = 'Today';
    } else if (messageDate == today.subtract(const Duration(days: 1))) {
      dateText = 'Yesterday';
    } else if (now.difference(messageDate).inDays < 7) {
      dateText = DateFormat('EEEE').format(date);
    } else {
      dateText = DateFormat('MMM d, yyyy').format(date);
    }

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 16),
      child: Row(
        children: [
          Expanded(child: Divider(color: Theme.of(context).colorScheme.outline)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              dateText,
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          Expanded(child: Divider(color: Theme.of(context).colorScheme.outline)),
        ],
      ),
    );
  }

  bool _shouldShowDateHeader(List<Message> messages, int index) {
    if (index == 0) return true;
    
    final currentMessage = messages[index];
    final previousMessage = messages[index - 1];
    
    final currentDate = DateTime(
      currentMessage.createdAt.year,
      currentMessage.createdAt.month,
      currentMessage.createdAt.day,
    );
    final previousDate = DateTime(
      previousMessage.createdAt.year,
      previousMessage.createdAt.month,
      previousMessage.createdAt.day,
    );
    
    return currentDate != previousDate;
  }
}