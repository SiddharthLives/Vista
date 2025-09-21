import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:intl/intl.dart';

import '../models/post.dart';
import '../models/user.dart';

class PostWidget extends StatelessWidget {
  final Post post;
  final VoidCallback? onLike;
  final VoidCallback? onComment;
  final VoidCallback? onShare;

  const PostWidget({
    super.key,
    required this.post,
    this.onLike,
    this.onComment,
    this.onShare,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildHeader(context),
          if (post.text.isNotEmpty) _buildTextContent(context),
          if (post.media.isNotEmpty) _buildMediaContent(context),
          _buildActions(context),
          _buildStats(context),
        ],
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          CircleAvatar(
            radius: 20,
            backgroundImage: post.author?.photoUrl != null
                ? CachedNetworkImageProvider(post.author!.photoUrl!)
                : null,
            child: post.author?.photoUrl == null
                ? Text(
                    _getInitials(post.author?.displayName ?? 'U'),
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  )
                : null,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  post.author?.displayName ?? 'Unknown User',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  _formatUserInfo(post.author),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          Text(
            _formatTimeAgo(post.createdAt),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          IconButton(
            icon: const Icon(Icons.more_vert),
            onPressed: () => _showPostOptions(context),
          ),
        ],
      ),
    );
  }

  Widget _buildTextContent(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Text(
        post.text,
        style: Theme.of(context).textTheme.bodyMedium,
      ),
    );
  }

  Widget _buildMediaContent(BuildContext context) {
    if (post.media.isEmpty) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      child: post.media.length == 1
          ? _buildSingleMedia(context, post.media.first)
          : _buildMultipleMedia(context),
    );
  }

  Widget _buildSingleMedia(BuildContext context, MediaItem media) {
    return AspectRatio(
      aspectRatio: _calculateAspectRatio(media),
      child: CachedNetworkImage(
        imageUrl: media.url,
        fit: BoxFit.cover,
        placeholder: (context, url) => Container(
          color: Theme.of(context).colorScheme.surfaceVariant,
          child: const Center(child: CircularProgressIndicator()),
        ),
        errorWidget: (context, url, error) => Container(
          color: Theme.of(context).colorScheme.errorContainer,
          child: Icon(
            Icons.error,
            color: Theme.of(context).colorScheme.onErrorContainer,
          ),
        ),
      ),
    );
  }

  Widget _buildMultipleMedia(BuildContext context) {
    return SizedBox(
      height: 200,
      child: PageView.builder(
        itemCount: post.media.length,
        itemBuilder: (context, index) {
          final media = post.media[index];
          return Container(
            margin: const EdgeInsets.symmetric(horizontal: 4),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: CachedNetworkImage(
                imageUrl: media.url,
                fit: BoxFit.cover,
                placeholder: (context, url) => Container(
                  color: Theme.of(context).colorScheme.surfaceVariant,
                  child: const Center(child: CircularProgressIndicator()),
                ),
                errorWidget: (context, url, error) => Container(
                  color: Theme.of(context).colorScheme.errorContainer,
                  child: Icon(
                    Icons.error,
                    color: Theme.of(context).colorScheme.onErrorContainer,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildActions(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.favorite_border),
            onPressed: onLike,
          ),
          IconButton(
            icon: const Icon(Icons.comment_outlined),
            onPressed: onComment,
          ),
          IconButton(
            icon: const Icon(Icons.share_outlined),
            onPressed: onShare,
          ),
          const Spacer(),
          _buildVisibilityChip(context),
        ],
      ),
    );
  }

  Widget _buildStats(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
      child: Row(
        children: [
          if (post.likesCount > 0) ...[
            Text(
              '${post.likesCount} ${post.likesCount == 1 ? 'like' : 'likes'}',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(width: 16),
          ],
          if (post.commentsCount > 0) ...[
            Text(
              '${post.commentsCount} ${post.commentsCount == 1 ? 'comment' : 'comments'}',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
          const Spacer(),
          if (post.tags.isNotEmpty)
            Wrap(
              spacing: 4,
              children: post.tags.take(3).map((tag) => Chip(
                label: Text(
                  '#$tag',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                visualDensity: VisualDensity.compact,
              )).toList(),
            ),
        ],
      ),
    );
  }

  Widget _buildVisibilityChip(BuildContext context) {
    IconData icon;
    String label;
    Color color;

    switch (post.visibility) {
      case PostVisibility.public:
        icon = Icons.public;
        label = 'Public';
        color = Theme.of(context).colorScheme.primary;
        break;
      case PostVisibility.year:
        icon = Icons.school;
        label = 'Year';
        color = Theme.of(context).colorScheme.secondary;
        break;
      case PostVisibility.dept:
        icon = Icons.group;
        label = 'Department';
        color = Theme.of(context).colorScheme.tertiary;
        break;
      case PostVisibility.section:
        icon = Icons.people;
        label = 'Section';
        color = Theme.of(context).colorScheme.outline;
        break;
    }

    return Chip(
      avatar: Icon(icon, size: 16, color: color),
      label: Text(
        label,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: color),
      ),
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
      visualDensity: VisualDensity.compact,
      side: BorderSide(color: color.withOpacity(0.3)),
      backgroundColor: color.withOpacity(0.1),
    );
  }

  String _getInitials(String name) {
    final words = name.trim().split(' ');
    if (words.isEmpty) return 'U';
    if (words.length == 1) return words[0][0].toUpperCase();
    return '${words[0][0]}${words[1][0]}'.toUpperCase();
  }

  String _formatUserInfo(User? user) {
    if (user == null) return 'Unknown';
    
    final parts = <String>[];
    if (user.year != null) parts.add('Year ${user.year}');
    if (user.department != null) parts.add(user.department!);
    if (user.section != null) parts.add('Section ${user.section}');
    
    return parts.join(' • ');
  }

  String _formatTimeAgo(DateTime dateTime) {
    final now = DateTime.now();
    final difference = now.difference(dateTime);

    if (difference.inDays > 7) {
      return DateFormat('MMM d').format(dateTime);
    } else if (difference.inDays > 0) {
      return '${difference.inDays}d';
    } else if (difference.inHours > 0) {
      return '${difference.inHours}h';
    } else if (difference.inMinutes > 0) {
      return '${difference.inMinutes}m';
    } else {
      return 'now';
    }
  }

  double _calculateAspectRatio(MediaItem media) {
    if (media.width != null && media.height != null) {
      return media.width! / media.height!;
    }
    return 16 / 9; // Default aspect ratio
  }

  void _showPostOptions(BuildContext context) {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.share),
              title: const Text('Share'),
              onTap: () {
                Navigator.pop(context);
                onShare?.call();
              },
            ),
            ListTile(
              leading: const Icon(Icons.report),
              title: const Text('Report'),
              onTap: () {
                Navigator.pop(context);
                // TODO: Implement report functionality
              },
            ),
            ListTile(
              leading: const Icon(Icons.block),
              title: const Text('Hide'),
              onTap: () {
                Navigator.pop(context);
                // TODO: Implement hide functionality
              },
            ),
          ],
        ),
      ),
    );
  }
}