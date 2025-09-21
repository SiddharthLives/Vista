import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/comment.dart';
import '../models/topic.dart';

class CommentCard extends StatelessWidget {
  final Comment comment;
  final bool isReply;
  final VoidCallback? onReply;
  final Function(VoteType)? onVote;

  const CommentCard({
    super.key,
    required this.comment,
    this.isReply = false,
    this.onReply,
    this.onVote,
  });

  String _formatTimeAgo(DateTime dateTime) {
    final now = DateTime.now();
    final difference = now.difference(dateTime);

    if (difference.inDays > 7) {
      return DateFormat('MMM d, y').format(dateTime);
    } else if (difference.inDays > 0) {
      return '${difference.inDays}d ago';
    } else if (difference.inHours > 0) {
      return '${difference.inHours}h ago';
    } else if (difference.inMinutes > 0) {
      return '${difference.inMinutes}m ago';
    } else {
      return 'Just now';
    }
  }

  Color _getVoteColor(BuildContext context, int votes) {
    if (votes > 0) {
      return Colors.green;
    } else if (votes < 0) {
      return Colors.red;
    } else {
      return Theme.of(context).colorScheme.outline;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: EdgeInsets.only(
        bottom: 12,
        left: isReply ? 32 : 0,
      ),
      child: Card(
        elevation: isReply ? 1 : 2,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header with author and time
              Row(
                children: [
                  CircleAvatar(
                    radius: isReply ? 14 : 16,
                    backgroundImage: comment.author?.photoUrl != null
                        ? NetworkImage(comment.author!.photoUrl!)
                        : null,
                    child: comment.author?.photoUrl == null
                        ? Text(
                            comment.author?.displayName.substring(0, 1).toUpperCase() ?? 
                            comment.authorStudentId.substring(0, 1).toUpperCase(),
                            style: TextStyle(fontSize: isReply ? 12 : 14),
                          )
                        : null,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          comment.author?.displayName ?? comment.authorStudentId,
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          _formatTimeAgo(comment.createdAt),
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Theme.of(context).colorScheme.outline,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              
              const SizedBox(height: 12),
              
              // Comment content
              Text(
                comment.content,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              
              const SizedBox(height: 12),
              
              // Actions row
              Row(
                children: [
                  // Voting buttons (smaller for comments)
                  Container(
                    decoration: BoxDecoration(
                      border: Border.all(
                        color: Theme.of(context).colorScheme.outline.withOpacity(0.3),
                      ),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          onPressed: onVote != null 
                              ? () => onVote!(VoteType.up)
                              : null,
                          icon: const Icon(Icons.keyboard_arrow_up),
                          iconSize: 16,
                          constraints: const BoxConstraints(
                            minWidth: 28,
                            minHeight: 28,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6),
                          child: Text(
                            comment.votes.toString(),
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: _getVoteColor(context, comment.votes),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        IconButton(
                          onPressed: onVote != null 
                              ? () => onVote!(VoteType.down)
                              : null,
                          icon: const Icon(Icons.keyboard_arrow_down),
                          iconSize: 16,
                          constraints: const BoxConstraints(
                            minWidth: 28,
                            minHeight: 28,
                          ),
                        ),
                      ],
                    ),
                  ),
                  
                  const SizedBox(width: 16),
                  
                  // Reply button (only for top-level comments)
                  if (!isReply && onReply != null)
                    TextButton.icon(
                      onPressed: onReply,
                      icon: const Icon(Icons.reply, size: 16),
                      label: const Text('Reply'),
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                        minimumSize: const Size(0, 32),
                      ),
                    ),
                  
                  // Replies count (only for top-level comments)
                  if (!isReply && comment.repliesCount > 0) ...[
                    const SizedBox(width: 8),
                    Text(
                      '${comment.repliesCount} replies',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.outline,
                      ),
                    ),
                  ],
                  
                  const Spacer(),
                  
                  // More options
                  IconButton(
                    onPressed: () {
                      // TODO: Show more options menu
                    },
                    icon: Icon(
                      Icons.more_horiz,
                      color: Theme.of(context).colorScheme.outline,
                    ),
                    iconSize: 16,
                    constraints: const BoxConstraints(
                      minWidth: 32,
                      minHeight: 32,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

