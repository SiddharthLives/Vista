import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';

import '../providers/stories_provider.dart';
import '../providers/auth_provider.dart';
import '../services/cloudinary_upload_service.dart';
import '../services/stories_api_service.dart';
import '../services/logger_service.dart';
import '../models/story.dart';
import '../widgets/loading_widget.dart';

enum StoryCreationSource { camera, gallery, video }

class StoryCreationScreen extends StatefulWidget {
  final StoryCreationSource initialSource;

  const StoryCreationScreen({
    super.key,
    required this.initialSource,
  });

  @override
  State<StoryCreationScreen> createState() => _StoryCreationScreenState();
}

class _StoryCreationScreenState extends State<StoryCreationScreen> {
  XFile? _selectedFile;
  bool _isProcessing = false;
  bool _isUploading = false;
  double _uploadProgress = 0.0;
  final CloudinaryUploadService _uploadService = CloudinaryUploadService();
  final StoriesApiService _storiesService = StoriesApiService();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _selectMedia();
    });
  }

  Future<void> _selectMedia() async {
    try {
      switch (widget.initialSource) {
        case StoryCreationSource.camera:
          final result = await _uploadService.pickImageFromCamera(compress: true);
          if (result.success && result.data != null) {
            setState(() {
              _selectedFile = result.data;
            });
          } else if (!result.success) {
            _showErrorDialog(result.error?.message ?? 'Failed to take photo');
            return;
          } else {
            Navigator.of(context).pop();
          }
          break;
          
        case StoryCreationSource.gallery:
          final result = await _uploadService.pickImageFromGallery(compress: true);
          if (result.success && result.data != null) {
            setState(() {
              _selectedFile = result.data;
            });
          } else if (!result.success) {
            _showErrorDialog(result.error?.message ?? 'Failed to pick image');
            return;
          } else {
            Navigator.of(context).pop();
          }
          break;
          
        case StoryCreationSource.video:
          final result = await _uploadService.pickVideoFromGallery();
          if (result.success && result.data != null) {
            setState(() {
              _selectedFile = result.data;
            });
          } else if (!result.success) {
            _showErrorDialog(result.error?.message ?? 'Failed to pick video');
            return;
          } else {
            Navigator.of(context).pop();
          }
          break;
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error selecting media for story', e, stackTrace);
      _showErrorDialog('Failed to select media: $e');
    }
  }

  Future<void> _createStory() async {
    if (_selectedFile == null) return;

    setState(() {
      _isProcessing = true;
      _isUploading = true;
      _uploadProgress = 0.0;
    });

    try {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final user = authProvider.user;
      
      if (user == null || user.studentId == null) {
        _showErrorDialog('You must be signed in to create a story');
        return;
      }

      // Upload media to Cloudinary
      final uploadResult = await _uploadService.uploadFile(
        _selectedFile!,
        user.studentId!,
        onProgress: (progress) {
          setState(() {
            _uploadProgress = progress;
          });
        },
      );

      setState(() {
        _isUploading = false;
      });

      if (!uploadResult.success || uploadResult.data == null) {
        throw Exception(uploadResult.error?.message ?? 'Failed to upload media');
      }

      // Create story via API
      final storyRequest = CreateStoryRequest(
        media: StoryMedia(
          url: uploadResult.data!.secureUrl,
          cloudinaryPublicId: uploadResult.data!.publicId,
          width: uploadResult.data!.width,
          height: uploadResult.data!.height,
          duration: widget.initialSource == StoryCreationSource.video ? 30.0 : null,
          type: widget.initialSource == StoryCreationSource.video 
              ? StoryMediaType.video 
              : StoryMediaType.image,
        ),
      );

      final storyResult = await _storiesService.createStory(storyRequest);

      if (mounted) {
        if (storyResult.success) {
          // Success - go back to feed
          Navigator.of(context).pop();
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Story created successfully!'),
              backgroundColor: Colors.green,
            ),
          );
          
          // Refresh stories in provider
          final storiesProvider = Provider.of<StoriesProvider>(context, listen: false);
          storiesProvider.refreshStories();
        } else {
          _showErrorDialog(storyResult.error?.message ?? 'Failed to create story');
        }
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error creating story', e, stackTrace);
      if (mounted) {
        _showErrorDialog('Failed to create story: $e');
      }
    } finally {
      if (mounted) {
        setState(() {
          _isProcessing = false;
          _isUploading = false;
        });
      }
    }
  }

  Future<void> _createStoryFromFile() async {
    // This is a simplified version - in a real implementation,
    // you'd integrate with the media upload service directly
    final storiesProvider = Provider.of<StoriesProvider>(context, listen: false);
    
    if (widget.initialSource == StoryCreationSource.camera) {
      await storiesProvider.createStoryFromCamera();
    } else {
      await storiesProvider.createStoryFromGallery();
    }
  }

  void _showErrorDialog(String message) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Error'),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isProcessing) {
      return Scaffold(
        backgroundColor: Colors.black,
        body: LoadingWidget(
          message: _isUploading 
              ? 'Uploading... ${(_uploadProgress * 100).toInt()}%'
              : 'Creating your story...',
        ),
      );
    }

    if (_selectedFile == null) {
      return const Scaffold(
        backgroundColor: Colors.black,
        body: const LoadingWidget(
          message: 'Loading...',
        ),
      );
    }

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // Media preview
          Center(
            child: _buildMediaPreview(),
          ),
          
          // Top bar with close button
          Positioned(
            top: MediaQuery.of(context).padding.top + 8,
            left: 8,
            right: 8,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                IconButton(
                  icon: const Icon(
                    Icons.close,
                    color: Colors.white,
                    size: 28,
                  ),
                  onPressed: () => Navigator.of(context).pop(),
                ),
                IconButton(
                  icon: const Icon(
                    Icons.refresh,
                    color: Colors.white,
                    size: 28,
                  ),
                  onPressed: _selectMedia,
                ),
              ],
            ),
          ),
          
          // Bottom bar with share button
          Positioned(
            bottom: MediaQuery.of(context).padding.bottom + 16,
            left: 16,
            right: 16,
            child: _buildBottomBar(),
          ),
        ],
      ),
    );
  }

  Widget _buildMediaPreview() {
    if (widget.initialSource == StoryCreationSource.video) {
      // For video, show a placeholder with play icon
      return Stack(
        children: [
          Container(
            width: double.infinity,
            height: double.infinity,
            color: Colors.grey[900],
            child: const Center(
              child: Icon(
                Icons.videocam,
                color: Colors.white,
                size: 64,
              ),
            ),
          ),
          const Center(
            child: Icon(
              Icons.play_circle_filled,
              color: Colors.white,
              size: 80,
            ),
          ),
        ],
      );
    } else {
      // For images, show the actual image
      return Image.file(
        File(_selectedFile!.path),
        fit: BoxFit.cover,
        width: double.infinity,
        height: double.infinity,
      );
    }
  }

  Widget _buildBottomBar() {
    return Row(
      children: [
        // Media type indicator
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.black.withOpacity(0.5),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                widget.initialSource == StoryCreationSource.video
                    ? Icons.videocam
                    : Icons.camera_alt,
                color: Colors.white,
                size: 16,
              ),
              const SizedBox(width: 4),
              Text(
                widget.initialSource == StoryCreationSource.video
                    ? 'Video'
                    : 'Photo',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
        
        const Spacer(),
        
        // Share button
        Consumer<StoriesProvider>(
          builder: (context, storiesProvider, child) {
            return ElevatedButton.icon(
              onPressed: storiesProvider.isCreatingStory ? null : _createStory,
              icon: storiesProvider.isCreatingStory
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.send),
              label: Text(
                storiesProvider.isCreatingStory ? 'Sharing...' : 'Share',
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: Theme.of(context).colorScheme.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(24),
                ),
              ),
            );
          },
        ),
      ],
    );
  }
}