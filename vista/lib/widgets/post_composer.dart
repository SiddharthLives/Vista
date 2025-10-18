import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../models/post.dart';
import '../providers/auth_provider.dart';
import '../services/posts_api_service.dart';
import '../services/cloudinary_upload_service.dart';
import '../services/logger_service.dart';

class PostComposer extends StatefulWidget {
  final ScrollController? scrollController;
  final Function(Post)? onPostCreated;

  const PostComposer({
    super.key,
    this.scrollController,
    this.onPostCreated,
  });

  @override
  State<PostComposer> createState() => _PostComposerState();
}

class _PostComposerState extends State<PostComposer> {
  final TextEditingController _textController = TextEditingController();
  final TextEditingController _tagsController = TextEditingController();
  final PostsApiService _postsService = PostsApiService();
  final CloudinaryUploadService _uploadService = CloudinaryUploadService();

  PostVisibility _selectedVisibility = PostVisibility.public;
  List<XFile> _selectedImages = [];
  bool _isLoading = false;
  bool _isUploading = false;
  double _uploadProgress = 0.0;
  String? _error;

  @override
  void dispose() {
    _textController.dispose();
    _tagsController.dispose();
    super.dispose();
  }

  Future<void> _pickImages() async {
    try {
      final result = await _uploadService.pickMultipleImages(
        maxImages: 5,
        compress: true,
      );
      
      if (result.success && result.data != null && result.data!.isNotEmpty) {
        setState(() {
          _selectedImages = result.data!;
        });
      } else if (!result.success) {
        _showError(result.error?.message ?? 'Failed to pick images');
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error picking images', e, stackTrace);
      _showError('Failed to pick images');
    }
  }

  Future<void> _pickCamera() async {
    try {
      final result = await _uploadService.pickImageFromCamera(compress: true);
      
      if (result.success && result.data != null) {
        setState(() {
          _selectedImages = [result.data!];
        });
      } else if (!result.success) {
        _showError(result.error?.message ?? 'Failed to take photo');
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error taking photo', e, stackTrace);
      _showError('Failed to take photo');
    }
  }

  void _removeImage(int index) {
    setState(() {
      _selectedImages.removeAt(index);
    });
  }

  Future<void> _createPost() async {
    final text = _textController.text.trim();
    
    if (text.isEmpty && _selectedImages.isEmpty) {
      _showError('Please add some content to your post');
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final user = authProvider.user;
      
      if (user == null) {
        _showError('You must be signed in to create a post');
        return;
      }

      List<MediaItem>? mediaItems;
      
      // Upload images if any
      if (_selectedImages.isNotEmpty) {
        setState(() {
          _isUploading = true;
          _uploadProgress = 0.0;
        });

        final uploadResult = await _uploadService.uploadMultipleFiles(
          _selectedImages,
          user.studentId!,
          onProgress: (completed, total, overallProgress) {
            setState(() {
              _uploadProgress = overallProgress;
            });
          },
        );

        setState(() {
          _isUploading = false;
        });

        if (!uploadResult.success || uploadResult.data == null) {
          throw Exception(uploadResult.error?.message ?? 'Failed to upload images');
        }

        mediaItems = uploadResult.data!.map((upload) => MediaItem(
          url: upload.secureUrl,
          cloudinaryPublicId: upload.publicId,
          width: upload.width,
          height: upload.height,
        )).toList();
      }

      // Parse tags
      final tags = _tagsController.text
          .split(',')
          .map((tag) => tag.trim())
          .where((tag) => tag.isNotEmpty)
          .toList();

      // Create post request
      final request = CreatePostRequest(
        type: mediaItems != null && mediaItems.isNotEmpty 
            ? PostType.image 
            : PostType.text,
        text: text.isNotEmpty ? text : null,
        media: mediaItems,
        visibility: _selectedVisibility,
        tags: tags.isNotEmpty ? tags : null,
      );

      // Create post
      final response = await _postsService.createPost(request);
      
      if (response.success && response.data != null) {
        widget.onPostCreated?.call(response.data!);
        LoggerService.info('Post created successfully');
      } else {
        _showError(response.error?.message ?? 'Failed to create post');
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error creating post', e, stackTrace);
      _showError('An unexpected error occurred while creating the post');
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _showError(String message) {
    setState(() {
      _error = message;
    });
    
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Theme.of(context).colorScheme.error,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildHeader(),
          const SizedBox(height: 16),
          Expanded(
            child: SingleChildScrollView(
              controller: widget.scrollController,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildTextInput(),
                  const SizedBox(height: 16),
                  if (_selectedImages.isNotEmpty) _buildImagePreview(),
                  if (_isUploading) _buildUploadProgress(),
                  const SizedBox(height: 16),
                  _buildTagsInput(),
                  const SizedBox(height: 16),
                  _buildVisibilitySelector(),
                  const SizedBox(height: 16),
                  _buildMediaOptions(),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          _buildActionButtons(),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Row(
      children: [
        Text(
          'Create Post',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        const Spacer(),
        IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ],
    );
  }

  Widget _buildTextInput() {
    return TextField(
      controller: _textController,
      maxLines: null,
      minLines: 3,
      decoration: const InputDecoration(
        hintText: 'What\'s on your mind?',
        border: OutlineInputBorder(),
      ),
      textCapitalization: TextCapitalization.sentences,
    );
  }

  Widget _buildImagePreview() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Images (${_selectedImages.length}/5)',
          style: Theme.of(context).textTheme.titleSmall,
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: 100,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            itemCount: _selectedImages.length,
            itemBuilder: (context, index) {
              return Container(
                width: 100,
                margin: const EdgeInsets.only(right: 8),
                child: Stack(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: FutureBuilder<Uint8List>(
                        future: _selectedImages[index].readAsBytes(),
                        builder: (context, snapshot) {
                          if (snapshot.hasData) {
                            return Image.memory(
                              snapshot.data!,
                              width: 100,
                              height: 100,
                              fit: BoxFit.cover,
                            );
                          } else if (snapshot.hasError) {
                            return Container(
                              width: 100,
                              height: 100,
                              color: Theme.of(context).colorScheme.errorContainer,
                              child: Icon(
                                Icons.error,
                                color: Theme.of(context).colorScheme.onErrorContainer,
                              ),
                            );
                          } else {
                            return Container(
                              width: 100,
                              height: 100,
                              color: Theme.of(context).colorScheme.surfaceVariant,
                              child: const Center(
                                child: CircularProgressIndicator(),
                              ),
                            );
                          }
                        },
                      ),
                    ),
                    Positioned(
                      top: 4,
                      right: 4,
                      child: GestureDetector(
                        onTap: () => _removeImage(index),
                        child: Container(
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(
                            color: Colors.black54,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(
                            Icons.close,
                            color: Colors.white,
                            size: 16,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildTagsInput() {
    return TextField(
      controller: _tagsController,
      decoration: const InputDecoration(
        labelText: 'Tags (comma separated)',
        hintText: 'campus, event, study',
        border: OutlineInputBorder(),
        prefixIcon: Icon(Icons.tag),
      ),
    );
  }

  Widget _buildVisibilitySelector() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Visibility',
          style: Theme.of(context).textTheme.titleSmall,
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          children: PostVisibility.values.map((visibility) {
            final isSelected = _selectedVisibility == visibility;
            return FilterChip(
              label: Text(_getVisibilityLabel(visibility)),
              selected: isSelected,
              onSelected: (selected) {
                if (selected) {
                  setState(() {
                    _selectedVisibility = visibility;
                  });
                }
              },
              avatar: Icon(_getVisibilityIcon(visibility)),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildMediaOptions() {
    return Row(
      children: [
        OutlinedButton.icon(
          onPressed: _selectedImages.length < 5 ? _pickImages : null,
          icon: const Icon(Icons.photo_library),
          label: const Text('Gallery'),
        ),
        const SizedBox(width: 8),
        OutlinedButton.icon(
          onPressed: _selectedImages.isEmpty ? _pickCamera : null,
          icon: const Icon(Icons.camera_alt),
          label: const Text('Camera'),
        ),
      ],
    );
  }

  Widget _buildUploadProgress() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceVariant,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.cloud_upload),
              const SizedBox(width: 8),
              Text(
                'Uploading images...',
                style: Theme.of(context).textTheme.titleSmall,
              ),
              const Spacer(),
              Text(
                '${(_uploadProgress * 100).toInt()}%',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
          const SizedBox(height: 8),
          LinearProgressIndicator(
            value: _uploadProgress,
            backgroundColor: Theme.of(context).colorScheme.outline.withOpacity(0.3),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButtons() {
    final isDisabled = _isLoading || _isUploading;
    
    return Row(
      children: [
        Expanded(
          child: OutlinedButton(
            onPressed: isDisabled ? null : () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: ElevatedButton(
            onPressed: isDisabled ? null : _createPost,
            child: _isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : _isUploading
                    ? const Text('Uploading...')
                    : const Text('Post'),
          ),
        ),
      ],
    );
  }

  String _getVisibilityLabel(PostVisibility visibility) {
    switch (visibility) {
      case PostVisibility.public:
        return 'Public';
      case PostVisibility.year:
        return 'Year';
      case PostVisibility.dept:
        return 'Department';
      case PostVisibility.section:
        return 'Section';
    }
  }

  IconData _getVisibilityIcon(PostVisibility visibility) {
    switch (visibility) {
      case PostVisibility.public:
        return Icons.public;
      case PostVisibility.year:
        return Icons.school;
      case PostVisibility.dept:
        return Icons.group;
      case PostVisibility.section:
        return Icons.people;
    }
  }
}