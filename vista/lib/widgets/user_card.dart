import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/user.dart';
import '../providers/auth_provider.dart';

class UserCard extends StatelessWidget {
  final User user;
  final bool showStartChatButton;
  final bool showViewProfileButton;
  final VoidCallback? onStartChat;
  final VoidCallback? onViewProfile;

  const UserCard({
    super.key,
    required this.user,
    this.showStartChatButton = false,
    this.showViewProfileButton = true,
    this.onStartChat,
    this.onViewProfile,
  });

  @override
  Widget build(BuildContext context) {
    final currentUser = Provider.of<AuthProvider>(context, listen: false).user;
    final isCurrentUser = user.studentId == currentUser?.studentId;

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: CircleAvatar(
          radius: 24,
          backgroundImage: user.photoUrl != null
              ? NetworkImage(user.photoUrl!)
              : null,
          child: user.photoUrl == null
              ? Text(
                  user.displayName.isNotEmpty
                      ? user.displayName[0].toUpperCase()
                      : '?',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                )
              : null,
        ),
        title: Row(
          children: [
            Expanded(
              child: Text(
                user.displayName,
                style: const TextStyle(fontWeight: FontWeight.w600),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (isCurrentUser)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primary,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  'You',
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onPrimary,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
          ],
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Student ID: ${user.studentId}',
              style: TextStyle(
                fontSize: 12,
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            if (user.year != null || user.department != null)
              Text(
                '${user.year ?? ''} ${user.department ?? ''}'.trim(),
                style: TextStyle(
                  fontSize: 12,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            if (user.bio != null && user.bio!.isNotEmpty)
              Text(
                user.bio!,
                style: TextStyle(
                  fontSize: 12,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
          ],
        ),
        trailing: _buildTrailingActions(context, isCurrentUser),
        onTap: showViewProfileButton && !isCurrentUser ? onViewProfile : null,
      ),
    );
  }

  Widget? _buildTrailingActions(BuildContext context, bool isCurrentUser) {
    if (isCurrentUser) return null;

    final actions = <Widget>[];

    if (showStartChatButton && onStartChat != null) {
      actions.add(
        IconButton(
          icon: const Icon(Icons.chat_bubble_outline),
          onPressed: onStartChat,
          tooltip: 'Start conversation',
        ),
      );
    }

    if (showViewProfileButton && onViewProfile != null) {
      actions.add(
        IconButton(
          icon: const Icon(Icons.person_outline),
          onPressed: onViewProfile,
          tooltip: 'View profile',
        ),
      );
    }

    if (actions.isEmpty) return null;
    if (actions.length == 1) return actions.first;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: actions,
    );
  }
}