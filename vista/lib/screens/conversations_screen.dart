import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:pull_to_refresh/pull_to_refresh.dart';
import 'package:intl/intl.dart';

import '../providers/chat_provider.dart';
import '../providers/auth_provider.dart';
import '../widgets/loading_widget.dart';
import '../widgets/error_widget.dart';
import '../models/conversation.dart';
import '../models/user.dart';
import 'chat_screen.dart';
import 'user_search_screen.dart';

class ConversationsScreen extends StatefulWidget {
  const ConversationsScreen({super.key});

  @override
  State<ConversationsScreen> createState() => _ConversationsScreenState();
}

class _ConversationsScreenState extends State<ConversationsScreen> {
  final RefreshController _refreshController = RefreshController(initialRefresh: false);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadInitialConversations();
    });
  }

  @override
  void dispose() {
    _refreshController.dispose();
    super.dispose();
  }

  Future<void> _loadInitialConversations() async {
    final chatProvider = Provider.of<ChatProvider>(context, listen: false);
    await chatProvider.loadInitialConversations();
  }

  Future<void> _onRefresh() async {
    final chatProvider = Provider.of<ChatProvider>(context, listen: false);
    await chatProvider.refreshConversations();
    _refreshController.refreshCompleted();
  }

  Future<void> _onLoading() async {
    final chatProvider = Provider.of<ChatProvider>(context, listen: false);
    final hasMore = await chatProvider.loadMoreConversations();
    
    if (hasMore) {
      _refreshController.loadComplete();
    } else {
      _refreshController.loadNoData();
    }
  }

  void _startNewConversation() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => const UserSearchScreen(
          title: 'Start Conversation',
          showStartChatButton: true,
        ),
      ),
    );
  }

  void _openConversation(ConversationWithParticipants conversationWithParticipants) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => ChatScreen(
          conversation: conversationWithParticipants.conversation,
          participants: conversationWithParticipants.participants,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Messages'),
        centerTitle: true,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.add_comment_outlined),
            onPressed: _startNewConversation,
            tooltip: 'Start new conversation',
          ),
        ],
      ),
      body: Consumer<ChatProvider>(
        builder: (context, chatProvider, child) {
          if (chatProvider.isLoadingConversations && chatProvider.conversations.isEmpty) {
            return const LoadingWidget(message: 'Loading conversations...');
          }

          if (chatProvider.conversationsError != null && chatProvider.conversations.isEmpty) {
            return CustomErrorWidget(
              message: chatProvider.conversationsError!,
              onRetry: _loadInitialConversations,
            );
          }

          if (chatProvider.conversations.isEmpty) {
            return _buildEmptyState();
          }

          return SmartRefresher(
            controller: _refreshController,
            enablePullDown: true,
            enablePullUp: chatProvider.hasMoreConversations,
            onRefresh: _onRefresh,
            onLoading: _onLoading,
            child: ListView.builder(
              itemCount: chatProvider.conversations.length,
              itemBuilder: (context, index) {
                final conversationWithParticipants = chatProvider.conversations[index];
                return _ConversationCard(
                  conversationWithParticipants: conversationWithParticipants,
                  onTap: () => _openConversation(conversationWithParticipants),
                );
              },
            ),
          );
        },
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.chat_bubble_outline,
            size: 64,
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
          const SizedBox(height: 16),
          Text(
            'No conversations yet',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Start a conversation with your classmates!',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: _startNewConversation,
            icon: const Icon(Icons.add_comment),
            label: const Text('Start Conversation'),
          ),
        ],
      ),
    );
  }
}

class _ConversationCard extends StatelessWidget {
  final ConversationWithParticipants conversationWithParticipants;
  final VoidCallback onTap;

  const _ConversationCard({
    required this.conversationWithParticipants,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final conversation = conversationWithParticipants.conversation;
    final participants = conversationWithParticipants.participants;
    final currentUser = Provider.of<AuthProvider>(context, listen: false).user;
    
    // Find the other participant (not the current user)
    final otherParticipant = participants.firstWhere(
      (user) => user.studentId != currentUser?.studentId,
      orElse: () => participants.first, // Fallback to first participant
    );

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: CircleAvatar(
          radius: 24,
          backgroundImage: otherParticipant.photoUrl != null
              ? NetworkImage(otherParticipant.photoUrl!)
              : null,
          child: otherParticipant.photoUrl == null
              ? Text(
                  otherParticipant.displayName.isNotEmpty
                      ? otherParticipant.displayName[0].toUpperCase()
                      : '?',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                )
              : null,
        ),
        title: Text(
          otherParticipant.displayName,
          style: const TextStyle(fontWeight: FontWeight.w600),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (otherParticipant.year != null || otherParticipant.department != null)
              Text(
                '${otherParticipant.year ?? ''} ${otherParticipant.department ?? ''}'.trim(),
                style: TextStyle(
                  fontSize: 12,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            const SizedBox(height: 2),
            Text(
              conversation.lastMessage ?? 'No messages yet',
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              _formatTime(conversation.updatedAt),
              style: TextStyle(
                fontSize: 12,
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 4),
            // TODO: Add unread message count indicator
            // Container(
            //   padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            //   decoration: BoxDecoration(
            //     color: Theme.of(context).colorScheme.primary,
            //     borderRadius: BorderRadius.circular(10),
            //   ),
            //   child: Text(
            //     '2',
            //     style: TextStyle(
            //       color: Theme.of(context).colorScheme.onPrimary,
            //       fontSize: 12,
            //       fontWeight: FontWeight.bold,
            //     ),
            //   ),
            // ),
          ],
        ),
        onTap: onTap,
      ),
    );
  }

  String _formatTime(DateTime dateTime) {
    final now = DateTime.now();
    final difference = now.difference(dateTime);

    if (difference.inDays > 0) {
      if (difference.inDays == 1) {
        return 'Yesterday';
      } else if (difference.inDays < 7) {
        return DateFormat('EEEE').format(dateTime); // Day of week
      } else {
        return DateFormat('MMM d').format(dateTime); // Month day
      }
    } else if (difference.inHours > 0) {
      return '${difference.inHours}h ago';
    } else if (difference.inMinutes > 0) {
      return '${difference.inMinutes}m ago';
    } else {
      return 'Just now';
    }
  }
}