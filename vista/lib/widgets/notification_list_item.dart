import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/notification.dart';

class NotificationListItem extends StatelessWidget {
  final Notification notification;
  final VoidCallback? onTap;
  final VoidCallback? onMarkAsRead;

  const NotificationListItem({
    super.key,
    required this.notification,
    this.onTap,
    this.onMarkAsRead,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      elevation: notification.isRead ? 0 : 2,
      color: notification.isRead 
          ? Theme.of(context).colorScheme.surface
          : Theme.of(context).colorScheme.primaryContainer.withOpacity(0.1),
      child: ListTile(
        leading: _buildLeadingIcon(context),
        title: Text(
          _getNotificationTitle(),
          style: TextStyle(
            fontWeight: notification.isRead ? FontWeight.normal : FontWeight.bold,
          ),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (_getNotificationSubtitle().isNotEmpty)
              Text(
                _getNotificationSubtitle(),
                style: Theme.of(context).textTheme.bodySmall,
              ),
            const SizedBox(height: 4),
            Text(
              _formatTimestamp(notification.createdAt),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
        trailing: notification.isRead 
            ? null 
            : Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primary,
                      shape: BoxShape.circle,
                    ),
                  ),
                  if (onMarkAsRead != null) ...[
                    const SizedBox(width: 8),
                    IconButton(
                      icon: const Icon(Icons.mark_email_read),
                      onPressed: onMarkAsRead,
                      tooltip: 'Mark as read',
                    ),
                  ],
                ],
              ),
        onTap: onTap,
      ),
    );
  }

  Widget _buildLeadingIcon(BuildContext context) {
    IconData iconData;
    Color iconColor;

    switch (notification.type) {
      case NotificationType.like:
        iconData = Icons.favorite;
        iconColor = Colors.red;
        break;
      case NotificationType.comment:
        iconData = Icons.comment;
        iconColor = Colors.blue;
        break;
      case NotificationType.follow:
        iconData = Icons.person_add;
        iconColor = Colors.green;
        break;
      case NotificationType.message:
        iconData = Icons.message;
        iconColor = Colors.orange;
        break;
      case NotificationType.topic:
        iconData = Icons.forum;
        iconColor = Colors.purple;
        break;
    }

    return CircleAvatar(
      backgroundColor: iconColor.withOpacity(0.1),
      child: Icon(
        iconData,
        color: iconColor,
        size: 20,
      ),
    );
  }

  String _getNotificationTitle() {
    switch (notification.type) {
      case NotificationType.like:
        return 'Someone liked your post';
      case NotificationType.comment:
        return 'New comment on your post';
      case NotificationType.follow:
        return 'Someone started following you';
      case NotificationType.message:
        return 'New message';
      case NotificationType.topic:
        return 'New activity in topic';
    }
  }

  String _getNotificationSubtitle() {
    switch (notification.type) {
      case NotificationType.like:
        return 'Your post received a new like';
      case NotificationType.comment:
        return 'Someone commented on your post';
      case NotificationType.follow:
        return 'You have a new follower';
      case NotificationType.message:
        return 'You have a new message in your conversation';
      case NotificationType.topic:
        return 'There\'s new activity in a topic you\'re following';
    }
  }

  String _formatTimestamp(DateTime timestamp) {
    final now = DateTime.now();
    final difference = now.difference(timestamp);

    if (difference.inMinutes < 1) {
      return 'Just now';
    } else if (difference.inHours < 1) {
      return '${difference.inMinutes}m ago';
    } else if (difference.inDays < 1) {
      return '${difference.inHours}h ago';
    } else if (difference.inDays < 7) {
      return '${difference.inDays}d ago';
    } else {
      return DateFormat('MMM d').format(timestamp);
    }
  }
}