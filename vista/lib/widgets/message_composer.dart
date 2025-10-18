import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import 'dart:typed_data';

import '../models/conversation.dart';
import '../services/cloudinary_upload_service.dart';
import '../providers/auth_provider.dart';
import '../services/logger_service.dart';
import 'package:provider/provider.dart';

class MessageComposer extends StatefulWidget {
  final Function(String text, {MessageMedia? media}) onSendMessage;
  final Function(bool isTyping)? onTypingChanged;

  const MessageComposer({
    super.key,
    required this.onSendMessage,
    this.onTypingChanged,
  });

  @override
  State<MessageComposer> createState() => _MessageComposerState();
}

class _MessageComposerState extends State<MessageComposer> {
  final TextEditingController _textController = TextEditingController();
  final FocusNode _focusNode = FocusNode();
  final CloudinaryUploadService _uploadService = CloudinaryUploadService();
  
  bool _isTyping = false;
  bool _isUploading = false;
  double _uploadProgress = 0.0;
  XFile? _selectedImage;

  @override
  void initState() {
    super.initState();
    _textController.addListener(_onTextChanged);
  }

  @override
  void dispose() {
    _textController.removeListener(_onTextChanged);
    _textController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _onTextChanged() {
    final isTyping = _textController.text.trim().isNotEmpty;
    if (isTyping != _isTyping) {
      setState(() {
        _isTyping = isTyping;
      });
      widget.onTypingChanged?.call(isTyping);
    }
  }

  Future<void> _pickImage() async {
    try {
      final result = await _uploadService.pickImageFromGallery(compress: true);
      
      if (result.success && result.data != null) {
        setState(() {
          _selectedImage = result.data;
        });
      } else if (!result.success) {
        _showError(result.error?.message ?? 'Failed to pick image');
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error picking image for message', e, stackTrace);
      _showError('Failed to pick image');
    }
  }

  Future<void> _takePhoto() async {
    try {
      final result = await _uploadService.pickImageFromCamera(compress: true);
      
      if (result.success && result.data != null) {
        setState(() {
          _selectedImage = result.data;
        });
      } else if (!result.success) {
        _showError(result.error?.message ?? 'Failed to take photo');
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error taking photo for message', e, stackTrace);
      _showError('Failed to take photo');
    }
  }

  void _showImageOptions() {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt),
              title: const Text('Take Photo'),
              onTap: () {
                Navigator.of(context).pop();
                _takePhoto();
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library),
              title: const Text('Choose from Gallery'),
              onTap: () {
                Navigator.of(context).pop();
                _pickImage();
              },
            ),
            ListTile(
              leading: const Icon(Icons.cancel),
              title: const Text('Cancel'),
              onTap: () => Navigator.of(context).pop(),
            ),
          ],
        ),
      ),
    );
  }

  void _removeSelectedImage() {
    setState(() {
      _selectedImage = null;
    });
  }

  Future<MessageMedia?> _uploadImage(XFile imageFile) async {
    try {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final studentId = authProvider.user?.studentId;
      
      if (studentId == null) {
        throw Exception('User not authenticated');
      }

      final result = await _uploadService.uploadFile(
        imageFile,
        studentId,
        onProgress: (progress) {
          setState(() {
            _uploadProgress = progress;
          });
        },
      );

      if (result.success && result.data != null) {
        return MessageMedia(
          url: result.data!.secureUrl,
          cloudinaryPublicId: result.data!.publicId,
        );
      } else {
        throw Exception(result.error?.message ?? 'Upload failed');
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error uploading image for message', e, stackTrace);
      _showError('Failed to upload image: $e');
      return null;
    }
  }

  void _showError(String message) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> _sendMessage() async {
    final text = _textController.text.trim();
    
    if (text.isEmpty && _selectedImage == null) return;

    setState(() {
      _isUploading = true;
    });

    MessageMedia? media;
    
    // Upload image if selected
    if (_selectedImage != null) {
      media = await _uploadImage(_selectedImage!);
      if (media == null) {
        setState(() {
          _isUploading = false;
        });
        return; // Upload failed, don't send message
      }
    }

    // Send the message
    widget.onSendMessage(text, media: media);

    // Clear the input
    _textController.clear();
    setState(() {
      _selectedImage = null;
      _isUploading = false;
      _isTyping = false;
    });
    
    widget.onTypingChanged?.call(false);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).scaffoldBackgroundColor,
        border: Border(
          top: BorderSide(
            color: Theme.of(context).colorScheme.outline.withOpacity(0.2),
          ),
        ),
      ),
      child: Column(
        children: [
          if (_selectedImage != null) _buildImagePreview(),
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.add_photo_alternate_outlined),
                onPressed: _isUploading ? null : _showImageOptions,
                color: Theme.of(context).colorScheme.primary,
              ),
              Expanded(
                child: Container(
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surfaceVariant,
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: TextField(
                    controller: _textController,
                    focusNode: _focusNode,
                    maxLines: null,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: const InputDecoration(
                      hintText: 'Type a message...',
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                    ),
                    enabled: !_isUploading,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primary,
                  shape: BoxShape.circle,
                ),
                child: IconButton(
                  icon: _isUploading
                      ? SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              Theme.of(context).colorScheme.onPrimary,
                            ),
                          ),
                        )
                      : Icon(
                          Icons.send,
                          color: Theme.of(context).colorScheme.onPrimary,
                        ),
                  onPressed: _isUploading ? null : _sendMessage,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildImagePreview() {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      child: Stack(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: FutureBuilder<Uint8List>(
              future: _selectedImage!.readAsBytes(),
              builder: (context, snapshot) {
                if (snapshot.hasData) {
                  return Image.memory(
                    snapshot.data!,
                    height: 200,
                    width: double.infinity,
                    fit: BoxFit.cover,
                  );
                } else if (snapshot.hasError) {
                  return Container(
                    height: 200,
                    width: double.infinity,
                    color: Theme.of(context).colorScheme.errorContainer,
                    child: Icon(
                      Icons.error,
                      color: Theme.of(context).colorScheme.onErrorContainer,
                    ),
                  );
                } else {
                  return Container(
                    height: 200,
                    width: double.infinity,
                    color: Theme.of(context).colorScheme.surfaceVariant,
                    child: const Center(
                      child: CircularProgressIndicator(),
                    ),
                  );
                }
              },
            ),
          ),
          if (_isUploading)
            Positioned.fill(
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.5),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      CircularProgressIndicator(
                        value: _uploadProgress,
                        color: Colors.white,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Uploading... ${(_uploadProgress * 100).toInt()}%',
                        style: const TextStyle(color: Colors.white),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          Positioned(
            top: 8,
            right: 8,
            child: GestureDetector(
              onTap: _isUploading ? null : _removeSelectedImage,
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.6),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.close,
                  color: _isUploading ? Colors.grey : Colors.white,
                  size: 20,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}