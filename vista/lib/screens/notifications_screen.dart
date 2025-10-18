import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/notifications_provider.dart';
import '../widgets/notification_list_item.dart';
import '../widgets/loading_widget.dart';
import '../widgets/error_widget.dart';
import '../models/notification.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _setupScrollController();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initializeNotifications();
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _setupScrollController() {
    _scrollController.addListener(() {
      if (_scrollController.position.pixels >= 
          _scrollController.position.maxScrollExtent - 200) {
        _loadMoreNotifications();
      }
    });
  }

  Future<void> _initializeNotifications() async {
    final notificationsProvider = Provider.of<NotificationsProvider>(context, listen: false);
    if (!notificationsProvider.isInitialized) {
      await notificationsProvider.initialize();
    }
  }

  Future<void> _loadMoreNotifications() async {
    final notificationsProvider = Provider.of<NotificationsProvider>(context, listen: false);
    await notificationsProvider.loadMoreNotifications();
  }

  Future<void> _refreshNotifications() async {
    final notificationsProvider = Provider.of<NotificationsProvider>(context, listen: false);
    await notificationsProvider.refreshNotifications();
  }

  void _handleNotificationTap(Notification notification) {
    // Navigate to relevant screen based on notification type
    switch (notification.type) {
      case NotificationType.like:
      case NotificationType.comment:
        if (notification.meta.postId != null) {
          _navigateToPost(notification.meta.postId!);
        }
        break;
      case NotificationType.follow:
        if (notification.meta.fromStudentId != null) {
          _navigateToProfile(notification.meta.fromStudentId!);
        }
        break;
      case NotificationType.message:
        if (notification.meta.conversationId != null) {
          _navigateToConversation(notification.meta.conversationId!);
        }
        break;
      case NotificationType.topic:
        if (notification.meta.topicId != null) {
          _navigateToTopic(notification.meta.topicId!);
        }
        break;
    }

    // Mark as read
    _markAsRead(notification.id);
  }

  void _navigateToPost(String postId) {
    // TODO: Navigate to post detail screen
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Navigate to post: $postId')),
    );
  }

  void _navigateToProfile(String studentId) {
    // TODO: Navigate to user profile screen
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Navigate to profile: $studentId')),
    );
  }

  void _navigateToConversation(String conversationId) {
    // TODO: Navigate to conversation screen
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Navigate to conversation: $conversationId')),
    );
  }

  void _navigateToTopic(String topicId) {
    // TODO: Navigate to topic screen
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Navigate to topic: $topicId')),
    );
  }

  void _markAsRead(String notificationId) {
    final notificationsProvider = Provider.of<NotificationsProvider>(context, listen: false);
    notificationsProvider.markAsRead(notificationId);
  }

  void _markAllAsRead() {
    final notificationsProvider = Provider.of<NotificationsProvider>(context, listen: false);
    notificationsProvider.markAllAsRead();
  }

  void _showNotificationSettings() {
    showModalBottomSheet(
      context: context,
      builder: (context) => _buildNotificationSettingsSheet(),
    );
  }

  Widget _buildNotificationSettingsSheet() {
    return Consumer<NotificationsProvider>(
      builder: (context, provider, child) {
        return Container(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Notification Settings',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 16),
              ListTile(
                leading: Icon(
                  provider.notificationsEnabled 
                      ? Icons.notifications_active 
                      : Icons.notifications_off,
                ),
                title: Text(
                  provider.notificationsEnabled 
                      ? 'Notifications Enabled' 
                      : 'Notifications Disabled',
                ),
                subtitle: Text(
                  provider.notificationsEnabled
                      ? 'You will receive push notifications'
                      : 'Enable notifications to stay updated',
                ),
                trailing: provider.notificationsEnabled
                    ? const Icon(Icons.check, color: Colors.green)
                    : TextButton(
                        onPressed: () {
                          provider.requestNotificationPermissions();
                        },
                        child: const Text('Enable'),
                      ),
              ),
              if (provider.fcmToken != null) ...[
                const SizedBox(height: 8),
                ListTile(
                  leading: const Icon(Icons.info_outline),
                  title: const Text('FCM Token'),
                  subtitle: Text(
                    '${provider.fcmToken!.substring(0, 20)}...',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              ],
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Close'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          Consumer<NotificationsProvider>(
            builder: (context, provider, child) {
              final unreadCount = provider.unreadCount;
              return Row(
                children: [
                  if (unreadCount > 0)
                    TextButton(
                      onPressed: _markAllAsRead,
                      child: const Text('Mark all read'),
                    ),
                  IconButton(
                    icon: const Icon(Icons.settings),
                    onPressed: _showNotificationSettings,
                  ),
                ],
              );
            },
          ),
        ],
      ),
      body: Consumer<NotificationsProvider>(
        builder: (context, provider, child) {
          if (!provider.isInitialized && provider.isLoading) {
            return const LoadingWidget(message: 'Loading notifications...');
          }

          if (provider.error != null && provider.notifications.isEmpty) {
            return CustomErrorWidget(
              message: provider.error!,
              onRetry: _initializeNotifications,
            );
          }

          if (provider.notifications.isEmpty && !provider.isLoading) {
            return _buildEmptyState();
          }

          return RefreshIndicator(
            onRefresh: _refreshNotifications,
            child: ListView.builder(
              controller: _scrollController,
              itemCount: provider.notifications.length + (provider.hasMore ? 1 : 0),
              itemBuilder: (context, index) {
                if (index >= provider.notifications.length) {
                  return const Padding(
                    padding: EdgeInsets.all(16),
                    child: Center(child: CircularProgressIndicator()),
                  );
                }

                final notification = provider.notifications[index];
                return NotificationListItem(
                  notification: notification,
                  onTap: () => _handleNotificationTap(notification),
                  onMarkAsRead: notification.isRead 
                      ? null 
                      : () => _markAsRead(notification.id),
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
            Icons.notifications_none,
            size: 64,
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
          const SizedBox(height: 16),
          Text(
            'No notifications yet',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'You\'ll see notifications here when you receive them',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          Consumer<NotificationsProvider>(
            builder: (context, provider, child) {
              if (!provider.notificationsEnabled) {
                return ElevatedButton.icon(
                  onPressed: () => provider.requestNotificationPermissions(),
                  icon: const Icon(Icons.notifications),
                  label: const Text('Enable Notifications'),
                );
              }
              return const SizedBox.shrink();
            },
          ),
        ],
      ),
    );
  }
}