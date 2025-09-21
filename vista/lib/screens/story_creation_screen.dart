import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';

import '../providers/stories_provider.dart';
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
  final ImagePicker _imagePicker = ImagePicker();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _selectMedia();
    });
  }

  Future<void> _selectMedia() async {
    try {
      XFile? file;
      
      switch (widget.initialSource) {
        case StoryCreationSource.camera:
          file = await _imagePicker.pickImage(
            source: ImageSource.camera,
            maxWidth: 1080,
            maxHeight: 1920,
            imageQuality: 85,
          );
          break;
        case StoryCreationSource.gallery:
          file = await _imagePicker.pickImage(
            source: ImageSource.gallery,
            maxWidth: 1080,
            maxHeight: 1920,
            imageQuality: 85,
          );
          break;
        case StoryCreationSource.video:
          file = await _imagePicker.pickVideo(
            source: ImageSource.gallery,
            maxDuration: const Duration(seconds: 30),
          );
          break;
      }

      if (file != null) {
        setState(() {
          _selectedFile = file;
        });
      } else {
        // User cancelled selection, go back
        Navigator.of(context).pop();
      }
    } catch (e) {
      _showErrorDialog('Failed to select media: $e');
    }
  }

  Future<void> _createStory() async {
    if (_selectedFile == null) return;

    setState(() {
      _isProcessing = true;
    });

    try {
      final storiesProvider = Provider.of<StoriesProvider>(context, listen: false);
      
      // Create story using the provider's method
      if (widget.initialSource == StoryCreationSource.video) {
        await storiesProvider.createStoryFromVideo();
      } else {
        // For camera and gallery, we need to create from the selected file
        await _createStoryFromFile();
      }

      if (mounted) {
        if (storiesProvider.error != null) {
          _showErrorDialog(storiesProvider.error!);
        } else {
          // Success - go back to feed
          Navigator.of(context).pop();
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Story created successfully!'),
              backgroundColor: Colors.green,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        _showErrorDialog('Failed to create story: $e');
      }
    } finally {
      if (mounted) {
        setState(() {
          _isProcessing = false;
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
      return const Scaffold(
        backgroundColor: Colors.black,
        body: const LoadingWidget(
          message: 'Creating your story...',
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