import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../models/post.dart';
import '../providers/auth_provider.dart';
import '../services/posts_api_service.dart';
import '../services/media_api_service.dart';
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
  final MediaApiService _mediaService = MediaApiService();
  final ImagePicker _imagePicker = ImagePicker();

  PostVisibility _selectedVisibility = PostVisibility.public;
  List<XFile> _selectedImages = [];
  bool _isLoading = false;
  String? _error;

  @override
  void dispose() {
    _textController.dispose();
    _tagsController.dispose();
    super.dispose();
  }

  Future<void> _pickImages() async {
    try {
      final List<XFile> images = await _imagePicker.pickMultiImage(
        maxWidth: 1920,
        maxHeight: 1920,
        imageQuality: 85,
      );
      
      if (images.isNotEmpty) {
        setState(() {
          _selectedImages = images.take(5).toList(); // Limit to 5 images
        });
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error picking images', e, stackTrace);
      _showError('Failed to pick images');
    }
  }

  Future<void> _pickCamera() async {
    try {
      final XFile? image = await _imagePicker.pickImage(
        source: ImageSource.camera,
        maxWidth: 1920,
        maxHeight: 1920,
        imageQuality: 85,
      );
      
      if (image != null) {
        setState(() {
          _selectedImages = [image];
        });
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
        mediaItems = [];
        
        for (final image in _selectedImages) {
          // Get signed upload parameters
          final signResponse = await _mediaService.getSignedUploadParams(
            filename: image.name,
            mimeType: 'image/jpeg',
            studentId: user.studentId!,
          );
          
          if (!signResponse.success || signResponse.data == null) {
            throw Exception('Failed to get upload parameters');
          }
          
          // Upload to Cloudinary
          final uploadResponse = await _mediaService.uploadToCloudinary(
            image,
            signResponse.data!,
          );
          
          if (!uploadResponse.success || uploadResponse.data == null) {
            throw Exception('Failed to upload image');
          }
          
          mediaItems.add(MediaItem(
            url: uploadResponse.data!.secureUrl,
            cloudinaryPublicId: uploadResponse.data!.publicId,
            width: uploadResponse.data!.width,
            height: uploadResponse.data!.height,
          ));
        }
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

  Widget _buildActionButtons() {
    return Row(
      children: [
        Expanded(
          child: OutlinedButton(
            onPressed: _isLoading ? null : () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: ElevatedButton(
            onPressed: _isLoading ? null : _createPost,
            child: _isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
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