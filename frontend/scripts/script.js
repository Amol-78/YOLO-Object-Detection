class YOLOApp {
    constructor() {
        this.backendUrl = 'http://localhost:5000/api';
        this.currentImage = null;
        this.currentVideo = null;
        this.currentResults = null;
        this.webcamStream = null;
        this.isWebcamRunning = false;
        this.webcamInterval = null;
        this.settings = {
            modelChoice: 'YOLOv3-Tiny',
            confidence: 0.35,
            nmsThresh: 0.45,
            boxColor: '#FF0000',
            inpSize: 416,
            detectOnly: ['person'],
            enableAudio: true
        };
        
        this.initializeEventListeners();
        this.checkBackendHealth();
    }

    initializeEventListeners() {
        // Dialog controls
        document.getElementById('inputTypeBtn').addEventListener('click', () => this.showInputTypeDialog());
        document.getElementById('modelSettingsBtn').addEventListener('click', () => this.showModelSettingsDialog());
        document.getElementById('detectionSettingsBtn').addEventListener('click', () => this.showDetectionSettingsDialog());
        document.getElementById('objectFilterBtn').addEventListener('click', () => this.showObjectFilterDialog());
        document.getElementById('audioAlertBtn').addEventListener('click', () => this.showAudioAlertDialog());
        
        document.getElementById('closeDialog').addEventListener('click', () => this.hideDialog());

        // File input handlers
        document.getElementById('imageInput').addEventListener('change', (e) => {
            this.handleImageUpload(e.target.files[0]);
        });

        document.getElementById('videoInput').addEventListener('change', (e) => {
            this.handleVideoUpload(e.target.files[0]);
        });

        // Drag and drop
        this.setupDragAndDrop('imageUploadArea', 'image');
        this.setupDragAndDrop('videoUploadArea', 'video');

        // Detection buttons
        document.getElementById('detectImageBtn').addEventListener('click', () => {
            this.detectImage();
        });

        // Webcam controls
        document.getElementById('startWebcamBtn').addEventListener('click', () => {
            this.startWebcam();
        });

        document.getElementById('stopWebcamBtn').addEventListener('click', () => {
            this.stopWebcam();
        });

        // Download button
        document.getElementById('downloadBtn').addEventListener('click', () => {
            this.downloadResults();
        });
    }

    setupDragAndDrop(elementId, type) {
        const element = document.getElementById(elementId);
        
        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            element.style.borderColor = '#667eea';
            element.style.background = '#f7fafc';
        });

        element.addEventListener('dragleave', () => {
            element.style.borderColor = '#cbd5e0';
            element.style.background = 'white';
        });

        element.addEventListener('drop', (e) => {
            e.preventDefault();
            element.style.borderColor = '#cbd5e0';
            element.style.background = 'white';
            
            const file = e.dataTransfer.files[0];
            if (file) {
                if (type === 'image' && file.type.startsWith('image/')) {
                    this.handleImageUpload(file);
                } else if (type === 'video' && file.type.startsWith('video/')) {
                    this.handleVideoUpload(file);
                }
            }
        });
    }

    showDialog(title, content) {
        document.getElementById('dialogTitle').textContent = title;
        document.getElementById('dialogContent').innerHTML = content;
        document.getElementById('dialogOverlay').classList.remove('hidden');
    }

    hideDialog() {
        document.getElementById('dialogOverlay').classList.add('hidden');
    }

    showInputTypeDialog() {
        const content = `
            <div class="option-grid">
                <div class="option-card active" onclick="app.selectInputType('image')">
                    <div class="option-icon">🖼️</div>
                    <div class="option-title">Upload Image</div>
                    <div class="option-desc">Detect objects in images</div>
                </div>
                <div class="option-card" onclick="app.selectInputType('video')">
                    <div class="option-icon">🎥</div>
                    <div class="option-title">Upload Video</div>
                    <div class="option-desc">Process video files</div>
                </div>
                <div class="option-card" onclick="app.selectInputType('webcam')">
                    <div class="option-icon">📷</div>
                    <div class="option-title">Webcam Live</div>
                    <div class="option-desc">Real-time detection</div>
                </div>
            </div>
        `;
        this.showDialog('📁 Select Input Type', content);
    }

    selectInputType(type) {
        // Update option cards
        document.querySelectorAll('.option-card').forEach(card => {
            card.classList.remove('active');
        });
        event.target.closest('.option-card').classList.add('active');

        // Hide all sections first
        document.querySelectorAll('.input-section').forEach(section => {
            section.classList.add('hidden');
        });

        // Show selected section
        if (type === 'image') {
            document.getElementById('imageSection').classList.remove('hidden');
            document.getElementById('currentMode').textContent = 'Upload Image';
        } else if (type === 'video') {
            document.getElementById('videoSection').classList.remove('hidden');
            document.getElementById('currentMode').textContent = 'Upload Video';
        } else if (type === 'webcam') {
            document.getElementById('webcamSection').classList.remove('hidden');
            document.getElementById('currentMode').textContent = 'Webcam Live';
        }

        this.hideDialog();
        this.hideResults();
    }

    showModelSettingsDialog() {
        const content = `
            <div class="form-group">
                <label>Model Type:</label>
                <select id="dialogModelChoice">
                    <option value="YOLOv3-Tiny">YOLOv3-Tiny</option>
                    <option value="YOLOv8n">YOLOv8n</option>
                </select>
            </div>
            <div class="form-group">
                <label>Confidence Threshold: <span id="dialogConfidenceValue">${this.settings.confidence}</span></label>
                <input type="range" id="dialogConfidence" min="0.1" max="0.9" step="0.05" value="${this.settings.confidence}">
            </div>
            <div class="form-group">
                <label>NMS Threshold: <span id="dialogNmsValue">${this.settings.nmsThresh}</span></label>
                <input type="range" id="dialogNmsThresh" min="0.1" max="0.6" step="0.05" value="${this.settings.nmsThresh}">
            </div>
            <div class="form-group">
                <label>Input Size:</label>
                <select id="dialogInputSize">
                    <option value="320">320px (Faster)</option>
                    <option value="416" selected>416px (Accurate)</option>
                </select>
            </div>
            <button class="btn-primary" onclick="app.applyModelSettings()" style="width: 100%; margin-top: 20px;">
                Apply Settings
            </button>
        `;
        
        this.showDialog('🤖 Model Settings', content);
        
        // Initialize values
        document.getElementById('dialogModelChoice').value = this.settings.modelChoice;
        document.getElementById('dialogInputSize').value = this.settings.inpSize;
        
        document.getElementById('dialogConfidence').addEventListener('input', (e) => {
            document.getElementById('dialogConfidenceValue').textContent = e.target.value;
        });
        
        document.getElementById('dialogNmsThresh').addEventListener('input', (e) => {
            document.getElementById('dialogNmsValue').textContent = e.target.value;
        });
    }

    applyModelSettings() {
        this.settings.modelChoice = document.getElementById('dialogModelChoice').value;
        this.settings.confidence = parseFloat(document.getElementById('dialogConfidence').value);
        this.settings.nmsThresh = parseFloat(document.getElementById('dialogNmsThresh').value);
        this.settings.inpSize = parseInt(document.getElementById('dialogInputSize').value);
        
        this.hideDialog();
        this.showNotification('Model settings applied successfully!', 'success');
    }

    showDetectionSettingsDialog() {
        const content = `
            <div class="form-group">
                <label>Bounding Box Color:</label>
                <input type="color" id="dialogBoxColor" value="${this.settings.boxColor}">
            </div>
            <div style="display: flex; align-items: center; gap: 15px; margin: 15px 0;">
                <div>Preview:</div>
                <div id="colorPreview" style="width: 100px; height: 50px; background-color: ${this.settings.boxColor}; border-radius: 5px; border: 2px solid #e2e8f0;"></div>
            </div>
            <div class="form-group">
                <label>Box Thickness:</label>
                <select id="dialogBoxThickness">
                    <option value="1">Thin</option>
                    <option value="2" selected>Normal</option>
                    <option value="3">Thick</option>
                </select>
            </div>
            <button class="btn-primary" onclick="app.applyDetectionSettings()" style="width: 100%; margin-top: 20px;">
                Apply Settings
            </button>
        `;
        
        this.showDialog('🎨 Detection Settings', content);
        
        document.getElementById('dialogBoxColor').addEventListener('input', (e) => {
            document.getElementById('colorPreview').style.backgroundColor = e.target.value;
        });
    }

    applyDetectionSettings() {
        this.settings.boxColor = document.getElementById('dialogBoxColor').value;
        this.hideDialog();
        this.showNotification('Detection settings applied successfully!', 'success');
    }

    showObjectFilterDialog() {
        const objects = [
            'person', 'bicycle', 'car', 'motorbike', 'bus', 'truck',
            'dog', 'cat', 'bottle', 'chair', 'laptop', 'cell phone', 'book'
        ];
        
        const objectsHTML = objects.map(obj => `
            <label>
                <input type="checkbox" value="${obj}" ${this.settings.detectOnly.includes(obj) ? 'checked' : ''}>
                ${obj.charAt(0).toUpperCase() + obj.slice(1)}
            </label>
        `).join('');
        
        const content = `
            <p>Select objects to detect (leave all unchecked to detect everything):</p>
            <div class="object-filters">
                ${objectsHTML}
            </div>
            <button class="btn-primary" onclick="app.applyObjectFilter()" style="width: 100%; margin-top: 20px;">
                Apply Filter
            </button>
        `;
        
        this.showDialog('🎯 Object Filter', content);
    }

    applyObjectFilter() {
        const checkboxes = document.querySelectorAll('.object-filters input[type="checkbox"]');
        this.settings.detectOnly = Array.from(checkboxes)
            .filter(checkbox => checkbox.checked)
            .map(checkbox => checkbox.value);
        
        this.hideDialog();
        this.showNotification('Object filter applied successfully!', 'success');
    }

    showAudioAlertDialog() {
        const content = `
            <div class="form-group">
                <label>
                    <input type="checkbox" id="dialogEnableAudio" ${this.settings.enableAudio ? 'checked' : ''}>
                    Enable Audio Alerts
                </label>
            </div>
            <div class="form-group">
                <label>Alert Volume: <span id="dialogVolumeValue">50</span>%</label>
                <input type="range" id="dialogVolume" min="1" max="100" value="50">
            </div>
            <div class="form-group">
                <label>Alert Sound:</label>
                <select id="dialogAlertSound">
                    <option value="beep">Beep</option>
                    <option value="chime">Chime</option>
                    <option value="notification">Notification</option>
                </select>
            </div>
            <button class="btn-secondary" onclick="app.testAudio()" style="width: 100%; margin-bottom: 10px;">
                🔊 Test Audio
            </button>
            <button class="btn-primary" onclick="app.applyAudioSettings()" style="width: 100%;">
                Apply Settings
            </button>
        `;
        
        this.showDialog('🔊 Audio Alerts', content);
        
        document.getElementById('dialogVolume').addEventListener('input', (e) => {
            document.getElementById('dialogVolumeValue').textContent = e.target.value;
        });
    }

    applyAudioSettings() {
        this.settings.enableAudio = document.getElementById('dialogEnableAudio').checked;
        this.hideDialog();
        this.showNotification('Audio settings applied successfully!', 'success');
    }

    testAudio() {
        this.playDetectionSound();
    }

    handleImageUpload(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            this.currentImage = file;
            const preview = document.getElementById('previewImage');
            preview.src = e.target.result;
            
            document.getElementById('imageUploadArea').classList.add('hidden');
            document.getElementById('imagePreview').classList.remove('hidden');
            
            // Show original in results section
            document.getElementById('originalContainer').innerHTML = 
                `<img src="${e.target.result}" alt="Original">`;
        };
        reader.readAsDataURL(file);
    }

    handleVideoUpload(file) {
        if (!file) return;

        this.currentVideo = file;
        this.detectVideo(); // Automatically kick off the MJPEG stream
    }

    // removed polling globally

    // async startWebcam() {
    //     try {
    //         const stream = await navigator.mediaDevices.getUserMedia({ 
    //             video: { width: 640, height: 480 } 
    //         });
            
    //         this.webcamStream = stream;
    //         const video = document.getElementById('webcamVideo');
    //         video.srcObject = stream;
            
    //         document.getElementById('startWebcamBtn').disabled = true;
    //         document.getElementById('stopWebcamBtn').disabled = false;
    //         this.isWebcamRunning = true;
            
    //         // Start webcam processing
    //         this.processWebcam();
            
    //     } catch (error) {
    //         console.error('Error accessing webcam:', error);
    //         this.showNotification('Could not access webcam. Please check permissions.', 'error');
    //     }
    // }


    // stopWebcam() {
    //     if (this.webcamStream) {
    //         this.webcamStream.getTracks().forEach(track => track.stop());
    //         this.webcamStream = null;
    //     }
        
    //     if (this.webcamInterval) {
    //         clearInterval(this.webcamInterval);
    //         this.webcamInterval = null;
    //     }
        
    //     this.isWebcamRunning = false;
    //     document.getElementById('startWebcamBtn').disabled = false;
    //     document.getElementById('stopWebcamBtn').disabled = true;
        
    //     const video = document.getElementById('webcamVideo');
    //     video.srcObject = null;
        
    //     // Clear canvas
    //     const canvas = document.getElementById('webcamCanvas');
    //     const context = canvas.getContext('2d');
    //     context.clearRect(0, 0, canvas.width, canvas.height);
    // }






// Inside the YOLOApp class, update startWebcam and stopWebcam:

    async startWebcam() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 640, height: 480 } 
            });
            
            this.webcamStream = stream;
            const video = document.getElementById('webcamVideo');
            video.srcObject = stream;
            
            document.getElementById('startWebcamBtn').disabled = true;
            document.getElementById('stopWebcamBtn').disabled = false;
            this.isWebcamRunning = true;
            this.latestDetections = []; // Initialize empty detections array

            video.style.display = 'none';
            const canvas = document.getElementById('webcamCanvas');
            canvas.classList.remove('hidden');
            
            // Wait for video metadata to load so dimensions are correct before rendering
            // Use requestAnimationFrame loop instead of onloadedmetadata to avoid race conditions
            const checkDimensions = () => {
                if (video.videoWidth > 0 && video.videoHeight > 0) {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    
                    // Start the rapid 30FPS visual rendering loop
                    this.renderWebcamLoop();
                    
                    // Start the slower background API network polling loop
                    this.processWebcam();
                } else {
                    requestAnimationFrame(checkDimensions);
                }
            };
            
            // Start checking
            video.play().catch(e => console.warn("Video play interrupted", e));
            checkDimensions();
            
        } catch (error) {
            console.error('Error accessing webcam:', error);
            this.showNotification('Could not access webcam. Please check permissions.', 'error');
        }
    }

    renderWebcamLoop() {
        if (!this.isWebcamRunning) return;

        const video = document.getElementById('webcamVideo');
        const canvas = document.getElementById('webcamCanvas');
        const context = canvas.getContext('2d');

        // Always smoothly draw the extremely latest video frame
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Always draw the latest known detection boxes on top
        if (this.latestDetections && this.latestDetections.length > 0) {
            this.drawWebcamDetections(canvas, context, this.latestDetections);
        }

        // Loop rendering at browser's native refresh rate
        requestAnimationFrame(() => this.renderWebcamLoop());
    }

    stopWebcam() {
        if (this.webcamStream) {
            this.webcamStream.getTracks().forEach(track => track.stop());
            this.webcamStream = null;
        }
        
        if (this.webcamInterval) {
            clearInterval(this.webcamInterval);
            this.webcamInterval = null;
        }
        
        this.isWebcamRunning = false;
        this.latestDetections = [];
        
        document.getElementById('startWebcamBtn').disabled = false;
        document.getElementById('stopWebcamBtn').disabled = true;
        
        const video = document.getElementById('webcamVideo');
        video.srcObject = null;
        video.style.display = 'block';
        document.getElementById('webcamCanvas').classList.add('hidden');
        
        const canvas = document.getElementById('webcamCanvas');
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
    }

    async processWebcam() {
        if (!this.isWebcamRunning) return;

        const video = document.getElementById('webcamVideo');
        
        try {
            // Use offscreen canvas to poll a frame silently for API
            const offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = video.videoWidth;
            offscreenCanvas.height = video.videoHeight;
            const offContext = offscreenCanvas.getContext('2d');
            offContext.drawImage(video, 0, 0, offscreenCanvas.width, offscreenCanvas.height);
            
            const imageData = offscreenCanvas.toDataURL('image/jpeg', 0.8);
            
            const detectionResult = await this.detectWebcamFrame(imageData);
            
            if (detectionResult && detectionResult.success) {
                // Update the state so the render pipeline picks up the new boxes instantly
                this.latestDetections = detectionResult.detections;
                
                if (this.settings.enableAudio && detectionResult.detections.length > 0) {
                    this.playDetectionSound();
                }
            } else {
                this.latestDetections = [];
            }
        } catch (error) {
            console.error('Webcam API polling error:', error);
        }
        
        // Queue next API check sequentially (e.g. 100ms later)
        if (this.isWebcamRunning) {
            setTimeout(() => this.processWebcam(), 100);
        }
    }

    async detectWebcamFrame(imageData) {
        try {
            console.log("🔄 Sending webcam request to backend...");
            
            const response = await fetch(`${this.backendUrl}/detect/webcam`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image: imageData,
                    model_choice: this.settings.modelChoice,
                    confidence: this.settings.confidence,
                    nms_thresh: this.settings.nmsThresh,
                    box_color: this.settings.boxColor,
                    inp_size: this.settings.inpSize,
                    detect_only: this.settings.detectOnly
                })
            });

            console.log(`📡 Response status: ${response.status}`);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Server error:', errorText);
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            const result = await response.json();
            console.log('📊 Detection result:', result);
            return result;
            
        } catch (error) {
            console.error('❌ Webcam detection API error:', error);
            this.showNotification('Webcam detection failed: ' + error.message, 'error');
            return null;
        }
    }

    drawWebcamDetections(canvas, context, detections) {
        // Convert hex color to RGB for canvas
        const hexToRgb = (hex) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgb(${r}, ${g}, ${b})`;
        };

        const color = hexToRgb(this.settings.boxColor);

        // Draw detections
        detections.forEach(det => {
            const { x, y, width, height, confidence, class: className } = det;
            
            // Draw bounding box
            context.strokeStyle = color;
            context.lineWidth = 3;
            context.strokeRect(x, y, width, height);
            
            // Draw label background
            const label = `${className} ${confidence.toFixed(2)}`;
            context.font = '16px Arial';
            const textWidth = context.measureText(label).width;
            
            context.fillStyle = color;
            context.fillRect(x, y - 25, textWidth + 10, 25);
            
            // Draw label text
            context.fillStyle = 'white';
            context.fillText(label, x + 5, y - 8);
        });
    }

    async detectImage() {
        if (!this.currentImage) {
            this.showNotification('Please select an image first', 'error');
            return;
        }

        this.showLoading();

        const formData = new FormData();
        formData.append('image', this.currentImage);
        formData.append('model_choice', this.settings.modelChoice);
        formData.append('confidence', this.settings.confidence);
        formData.append('nms_thresh', this.settings.nmsThresh);
        formData.append('box_color', this.settings.boxColor);
        formData.append('inp_size', this.settings.inpSize);

        this.settings.detectOnly.forEach(obj => formData.append('detect_only[]', obj));

        try {
            const response = await fetch(`${this.backendUrl}/detect/image`, {
                method: 'POST',
                body: formData
            });

            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}`);
            }

            const result = await response.json();

            if (result.success) {
                this.displayImageResults(result);
            } else {
                throw new Error(result.error || 'Detection failed');
            }
        } catch (error) {
            console.error('Detection error:', error);
            this.showNotification('Detection failed: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async detectVideo() {
        if (!this.currentVideo) {
            this.showNotification('Please select a video first', 'error');
            return;
        }

        // Adjust UI visibility for live streaming
        document.getElementById('videoUploadArea').classList.add('hidden');
        document.getElementById('videoPreview').classList.remove('hidden');
        document.getElementById('resultsSection').classList.add('hidden');
        document.getElementById('previewVideo').style.display = 'none';
        const liveStats = document.getElementById('liveStatsOverlay');
        if (liveStats) liveStats.style.display = 'none';

        const formData = new FormData();
        formData.append('video', this.currentVideo);
        formData.append('model_choice', this.settings.modelChoice);
        formData.append('confidence', this.settings.confidence);
        formData.append('nms_thresh', this.settings.nmsThresh);
        formData.append('box_color', this.settings.boxColor);
        formData.append('inp_size', this.settings.inpSize);

        this.settings.detectOnly.forEach(obj => formData.append('detect_only[]', obj));

        try {
            const response = await fetch(`${this.backendUrl}/detect/video`, {
                method: 'POST',
                body: formData
            });

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error(`Server returned non-JSON response`);
            }

            const result = await response.json();

            if (result.success && result.stream_url) {
                const streamUrl = this.backendUrl.replace('/api', '') + result.stream_url;
                
                let streamImg = document.getElementById('videoStreamImage');
                if (!streamImg) {
                    streamImg = document.createElement('img');
                    streamImg.id = 'videoStreamImage';
                    streamImg.style.maxWidth = '100%';
                    streamImg.style.borderRadius = '8px';
                    streamImg.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                    document.querySelector('#videoPreview .preview-content').appendChild(streamImg);
                }
                streamImg.src = streamUrl;
                streamImg.style.display = 'block';
                
                const canvas = document.getElementById('videoCanvas');
                if (canvas) canvas.style.display = 'none';
            } else {
                throw new Error(result.error || 'Video upload failed');
            }
        } catch (error) {
            console.error('Video processing error:', error);
            this.showNotification('Video processing failed: ' + error.message, 'error');
        }
    }

    displayImageResults(result) {
        this.currentResults = result;
        
        // Show detected image
        document.getElementById('detectedContainer').innerHTML = 
            `<img src="data:image/jpeg;base64,${result.image}" alt="Detected Objects" style="max-width: 100%; border-radius: 8px;">`;
        
        // Update detection count
        document.getElementById('detectionCount').textContent = 
            `${result.count} objects detected`;
        
        // Show detections list
        this.displayDetectionsList(result.detections);
        
        // Show results section
        this.showResults();
        
        // Play audio alert if enabled
        if (this.settings.enableAudio && result.count > 0) {
            this.playDetectionSound();
        }
    }

  displayVideoResults(result) {
    this.currentResults = result;
    
    console.log('Video result received:', {
        success: result.success,
        frame_count: result.frame_count,
        total_detections: result.total_detections,
        unique_count: result.unique_count,
        hasVideoData: !!result.video,
        videoDataLength: result.video ? result.video.length : 0
    });

    // Hide original preview
    const originalPreview = document.querySelector('.original-preview');
    const detectedPreview = document.querySelector('.detected-preview');
    if (originalPreview) originalPreview.style.display = 'none';
    if (detectedPreview) detectedPreview.style.gridColumn = '1 / -1';

    // Set detection text
    document.getElementById('detectionCount').textContent = 
        `${result.unique_count || result.total_detections || 0} unique objects tracked`;

    // Show processed video with detections
    if (result.video && result.video.length > 100) { // Check if we have substantial video data
        const videoBlob = this.base64ToBlob(result.video, 'video/mp4');
        const videoUrl = URL.createObjectURL(videoBlob);
        
        document.getElementById('detectedContainer').innerHTML = `
            <div style="text-align: center; width: 100%;">
                <h4>Processed Video with Detections</h4>
                <video controls autoplay muted style="max-width: 100%; max-height: 400px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
                    <source src="${videoUrl}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
                <p style="margin-top: 10px; color: #666; font-size: 0.9em;">
                    🔍 Tracked ${result.unique_count || result.total_detections || 0} unique objects across ${result.frame_count} frames
                </p>
            </div>
        `;
    } else {
        document.getElementById('detectedContainer').innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 20px;"></i>
                <h4>Video Processing Issue</h4>
                <p>Processed video data is empty or too small. Please try again.</p>
                <p><small>Video data length: ${result.video ? result.video.length : 0} bytes</small></p>
            </div>
        `;
    }
    
    // Update detection count
    let statsText = `${result.total_detections} total detections`;
    if (result.frame_count > 0) {
        statsText += ` (avg ${(result.average_detections || 0).toFixed(1)} per frame)`;
    }
    document.getElementById('detectionCount').textContent = statsText;
    
    // Show detections list (show summary for video)
    this.displayVideoDetectionsList(result);
    
    // Show results section
    this.showResults();
    
    // Play audio alert if enabled
    if (this.settings.enableAudio && result.total_detections > 0) {
        this.playDetectionSound();
    }
}



// Add this helper function to convert base64 to blob
base64ToBlob(base64, mimeType) {
    const byteCharacters = atob(base64);
    const byteArrays = [];
    
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }
    
    return new Blob(byteArrays, { type: mimeType });
}

displayVideoDetectionsList(result) {
    const listContainer = document.getElementById('detectionsList');
    
    if (result.total_detections === 0) {
        listContainer.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No objects detected in video</p>';
        return;
    }

    // Create detection summary by class
    const classSummary = {};
    // For video, we might not have individual detections in the response
    // So we'll create a simple summary based on the total count
    if (result.detections && Array.isArray(result.detections)) {
        result.detections.forEach(det => {
            if (!classSummary[det.class]) {
                classSummary[det.class] = 0;
            }
            classSummary[det.class]++;
        });
    } else {
        // If no detailed detections, show a generic summary
        classSummary['Various Objects'] = result.total_detections;
    }

    const summaryHTML = Object.entries(classSummary)
        .map(([className, count]) => `
            <div class="detection-item">
                <span class="detection-class">${className}</span>
                <span class="detection-confidence">${count} detected</span>
            </div>
        `).join('');

    const statsHTML = `
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #667eea;">
            <h4 style="margin: 0 0 10px 0; color: #2d3748;">🎥 Video Analysis Summary</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div>
                    <strong>Frames Processed:</strong><br>
                    <span style="font-size: 1.2em; color: #667eea;">${result.frame_count || 0}</span>
                </div>
                <div>
                    <strong>Total Detections:</strong><br>
                    <span style="font-size: 1.2em; color: #48bb78;">${result.total_detections || 0}</span>
                </div>
                <div>
                    <strong>Avg per Frame:</strong><br>
                    <span style="font-size: 1.2em; color: #ed8936;">${(result.average_detections || 0).toFixed(1)}</span>
                </div>
                <div>
                    <strong>Model Used:</strong><br>
                    <span style="font-size: 1.1em; color: #9f7aea;">${result.model_used || 'Unknown'}</span>
                </div>
            </div>
        </div>
        <h4 style="margin: 20px 0 10px 0;">Detected Objects</h4>
        ${summaryHTML}
    `;

    listContainer.innerHTML = statsHTML;
}

    displayDetectionsList(detections) {
        const listContainer = document.getElementById('detectionsList');
        
        if (detections.length === 0) {
            listContainer.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No objects detected</p>';
            return;
        }

        const listHTML = detections.map(det => `
            <div class="detection-item">
                <span class="detection-class">${det.class}</span>
                <span class="detection-confidence">${(det.confidence * 100).toFixed(1)}%</span>
            </div>
        `).join('');

        listContainer.innerHTML = listHTML;
    }

    displayVideoDetectionsList(result) {
        const listContainer = document.getElementById('detectionsList');
        
        if (result.total_detections === 0) {
            listContainer.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No objects detected in video</p>';
            return;
        }

        // Group detections by class for video summary
        const classSummary = {};
        if (result.detections) {
            result.detections.forEach(det => {
                if (!classSummary[det.class]) {
                    classSummary[det.class] = 0;
                }
                classSummary[det.class]++;
            });
        }

        const summaryHTML = Object.entries(classSummary)
            .map(([className, count]) => `
                <div class="detection-item">
                    <span class="detection-class">${className}</span>
                    <span class="detection-confidence">${count} detected</span>
                </div>
            `).join('');

        const statsHTML = `
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0;">Video Summary</h4>
                <p style="margin: 5px 0;">Frames processed: ${result.frame_count || 0}</p>
                <p style="margin: 5px 0;">Total detections: ${result.total_detections || 0}</p>
                <p style="margin: 5px 0;">Average per frame: ${(result.average_detections || 0).toFixed(1)}</p>
            </div>
            ${summaryHTML}
        `;

        listContainer.innerHTML = statsHTML;
    }

    showResults() {
        document.getElementById('resultsSection').classList.remove('hidden');
        
        // Scroll to results
        document.getElementById('resultsSection').scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
        });
    }

    hideResults() {
        document.getElementById('resultsSection').classList.add('hidden');
    }

    showLoading() {
        document.getElementById('loadingOverlay').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loadingOverlay').classList.add('hidden');
    }

    playDetectionSound() {
        // Use Web Audio API for beep sound
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.1;
            
            oscillator.start();
            setTimeout(() => {
                oscillator.stop();
            }, 150);
        } catch (error) {
            console.log('Audio not supported:', error);
        }
    }

    downloadResults() {
        if (!this.currentResults) {
            this.showNotification('No results to download', 'error');
            return;
        }

        try {
            if (this.currentResults.image) {
                // Download image
                const link = document.createElement('a');
                link.href = `data:image/jpeg;base64,${this.currentResults.image}`;
                link.download = `detected-image-${new Date().getTime()}.jpg`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                this.showNotification('Image downloaded successfully!', 'success');
            } else if (this.currentResults.video) {
                // Download video
                const link = document.createElement('a');
                link.href = `data:video/mp4;base64,${this.currentResults.video}`;
                link.download = `detected-video-${new Date().getTime()}.mp4`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                this.showNotification('Video downloaded successfully!', 'success');
            }
        } catch (error) {
            console.error('Download error:', error);
            this.showNotification('Download failed', 'error');
        }
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        document.querySelectorAll('.notification').forEach(notif => notif.remove());

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#f56565' : type === 'success' ? '#48bb78' : '#4299e1'};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 1001;
            max-width: 400px;
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
        
        // Close button
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });
    }

    async checkBackendHealth() {
        try {
            const response = await fetch(`${this.backendUrl}/health`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const health = await response.json();
            console.log('Backend health:', health);
            
            if (!health.yolov3_available && !health.ultralytics_available) {
                this.showNotification(
                    '⚠️ Warning: No YOLO models found. Please check model files or wait for automatic download.', 
                    'error'
                );
            } else {
                const availableModels = [];
                if (health.yolov3_available) availableModels.push('YOLOv3-Tiny');
                if (health.ultralytics_available) availableModels.push('YOLOv8n');
                
                this.showNotification(
                    `✅ Models available: ${availableModels.join(', ')}`, 
                    'success'
                );
            }
        } catch (error) {
            console.error('Backend health check failed:', error);
            this.showNotification(
                '❌ Cannot connect to backend server. Please make sure the backend is running on port 5000.', 
                'error'
            );
        }
    }
}

// Global functions for HTML onclick handlers
function clearImagePreview() {
    if (app) {
        app.currentImage = null;
        document.getElementById('imageInput').value = '';
        document.getElementById('imagePreview').classList.add('hidden');
        document.getElementById('imageUploadArea').classList.remove('hidden');
        app.hideResults();
    }
}

function clearVideoPreview() {
    if (app) {
        app.currentVideo = null;
        document.getElementById('videoInput').value = '';
        document.getElementById('videoPreview').classList.add('hidden');
        document.getElementById('videoUploadArea').classList.remove('hidden');
        app.hideResults();
        
        const streamImg = document.getElementById('videoStreamImage');
        if (streamImg) {
            streamImg.src = '';
            streamImg.style.display = 'none';
        }
    }
}

// Initialize app when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new YOLOApp();
});

// Add notification styles
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    
    .notification-close {
        background: none;
        border: none;
        color: white;
        font-size: 1.2rem;
        cursor: pointer;
        margin-left: 10px;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .notification-close:hover {
        background: rgba(255,255,255,0.2);
        border-radius: 50%;
    }
`;
document.head.appendChild(notificationStyles);