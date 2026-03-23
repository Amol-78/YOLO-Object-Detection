import base64
import uuid
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import cv2
import numpy as np
import os
from werkzeug.utils import secure_filename
import tempfile
from utils.yolo_utils import YOLODetector
from utils.helpers import hex_to_bgr, pil_to_cv2, cv2_to_pil, image_to_base64, base64_to_cv2

app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = os.path.join(tempfile.gettempdir(), 'yolo_video_uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'mp4', 'avi', 'mov'}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

# Initialize YOLO detector
detector = YOLODetector()

# Load models with better error handling and fallback
print(" Initializing YOLO Models...")

# Try YOLOv8n first (it auto-downloads)
app.yolov3_available = False
app.ultralytics_available = False
ultralytics_model = None
yolov3_net, yolov3_names = None, []

# ========== FIXED MODEL LOADING ==========
def load_models():
    global ultralytics_model, yolov3_net, yolov3_names
    
    # Try YOLOv8n first
    try:
        print(" Attempting to load YOLOv8n model...")
        from ultralytics import YOLO
        ultralytics_model = YOLO('yolov8n.pt')
        app.ultralytics_available = True
        print(" YOLOv8n model loaded successfully!")
        print(f" YOLOv8 classes: {len(ultralytics_model.names)}")
    except Exception as e:
        print(f" YOLOv8n failed: {e}")
        app.ultralytics_available = False
        ultralytics_model = None

    # Try YOLOv3-tiny if files exist
    yolov3_files = {
        'cfg': os.path.exists("yolov3-tiny.cfg"),
        'weights': os.path.exists("yolov3-tiny.weights"), 
        'names': os.path.exists("coco.names")
    }
    
    print(f" YOLOv3 files check: {yolov3_files}")
    
    if all(yolov3_files.values()):
        try:
            print(" Attempting to load YOLOv3-tiny model...")
            yolov3_net, yolov3_names = detector.load_yolov3(
                "yolov3-tiny.cfg", 
                "yolov3-tiny.weights", 
                "coco.names"
            )
            app.yolov3_available = True
            print(" YOLOv3-tiny model loaded successfully!")
            print(f" YOLOv3 classes: {len(yolov3_names)}")
        except Exception as e:
            print(f" YOLOv3-tiny failed: {e}")
            app.yolov3_available = False
    else:
        print("ℹ YOLOv3-tiny files missing, skipping...")
        missing_files = [k for k, v in yolov3_files.items() if not v]
        print(f" Missing files: {missing_files}")

# Load models
load_models()

# Check if any model is available
if not app.yolov3_available and not app.ultralytics_available:
    print(" WARNING: No YOLO models available! Detection will not work.")
    print(" Solution: The app will try to download YOLOv8n automatically.")
else:
    print(f" Models loaded: YOLOv3-Tiny: {app.yolov3_available}, YOLOv8n: {app.ultralytics_available}")

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route("/")
def home():
    return """
    <h2>🚀 YOLO Object Detection API is Running</h2>
    <p>Available Endpoints:</p>
    <ul>
        <li>/api/health</li>
        <li>/api/status</li>
        <li>/api/models</li>
        <li>/api/detect/image</li>
        <li>/api/detect/video</li>
        <li>/api/detect/webcam</li>
    </ul>
    """

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'yolov3_available': app.yolov3_available,
        'ultralytics_available': app.ultralytics_available,
        'message': 'Backend is running but some models may be unavailable' if not (app.yolov3_available or app.ultralytics_available) else 'All systems operational'
    })

@app.route('/api/detect/image', methods=['POST'])
def detect_image():
    try:
        # Check if any model is available
        if not app.yolov3_available and not app.ultralytics_available:
            return jsonify({
                'success': False,
                'error': 'No YOLO models are available. Please check that model files exist or internet connection is available for automatic downloads.'
            }), 400

        # Get parameters
        model_choice = request.form.get('model_choice', 'YOLOv8n')
        confidence = float(request.form.get('confidence', 0.35))
        nms_thresh = float(request.form.get('nms_thresh', 0.45))
        box_color = request.form.get('box_color', '#FF0000')
        inp_size = int(request.form.get('inp_size', 416))
        detect_only = request.form.getlist('detect_only[]')
        
        # Get image file
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if file and allowed_file(file.filename):
            # Read and process image
            image_data = file.read()
            nparr = np.frombuffer(image_data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if frame is None:
                return jsonify({'error': 'Invalid image file'}), 400
            
            # Perform detection
            color_bgr = hex_to_bgr(box_color)
            classes_filter = detect_only if detect_only else []
            detections = []
            
            # Choose which model to use based on availability and choice
            if model_choice == 'YOLOv3-Tiny' and app.yolov3_available:
                detections = detector.detect_yolov3(
                    frame, yolov3_net, yolov3_names, confidence, 
                    nms_thresh, inp_size, classes_filter
                )
                model_used = 'YOLOv3-Tiny'
            elif app.ultralytics_available:
                detections = detector.detect_ultralytics(
                    frame, ultralytics_model, confidence, 
                    nms_thresh, inp_size, classes_filter
                )
                model_used = 'YOLOv8n'
            else:
                return jsonify({
                    'success': False,
                    'error': 'No available model for detection. Please check model files.'
                }), 400
            
            # Draw detections
            result_frame = detector.draw_detections(frame.copy(), detections, color_bgr)
            
            # Convert to base64 for response
            result_image = image_to_base64(result_frame)
            
            return jsonify({
                'success': True,
                'detections': detections,
                'image': result_image,
                'count': len(detections),
                'model_used': model_used
            })
        
        return jsonify({'error': 'Invalid file type'}), 400
        
    except Exception as e:
        return jsonify({'error': f'Detection failed: {str(e)}'}), 500

@app.route('/api/detect/video', methods=['POST'])
def detect_video():

    try:
        # Check if any model is available
        if not app.yolov3_available and not app.ultralytics_available:
            return jsonify({
                'success': False,
                'error': 'No YOLO models are available for video processing.'
            }), 400

        # Get parameters
        model_choice = request.form.get('model_choice', 'YOLOv3-Tiny')
        confidence = float(request.form.get('confidence', 0.35))
        nms_thresh = float(request.form.get('nms_thresh', 0.45))
        box_color = request.form.get('box_color', '#FF0000')
        inp_size = int(request.form.get('inp_size', 416))
        detect_only = request.form.getlist('detect_only[]')
        
        # Get video file
        if 'video' not in request.files:
            return jsonify({'error': 'No video file provided'}), 400
        
        file = request.files['video']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        if file and allowed_file(file.filename):
            print(f" Preparation for streaming video: {file.filename}")
            
            # Save uploaded video permanently for the stream to read
            filename = secure_filename(f"{uuid.uuid4().hex[:8]}_{file.filename}")
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            
            color_hex = box_color.replace('#', '')
            detect_str = ",".join(detect_only)
            
            stream_url = f"/api/stream/{filename}?model={model_choice}&conf={confidence}&nms={nms_thresh}&color={color_hex}&size={inp_size}&classes={detect_str}"
            
            return jsonify({
                'success': True,
                'stream_url': stream_url
            })
        
        return jsonify({'error': 'Invalid file type'}), 400
        
    except Exception as e:
        print(f" Video upload error: {str(e)}")
        return jsonify({'error': f'Video upload failed: {str(e)}'}), 500

@app.route('/api/stream/<filename>')
def stream_video(filename):
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    if not os.path.exists(filepath):
        return "File not found", 404
        
    model_choice = request.args.get('model', 'YOLOv8n')
    conf_thresh = float(request.args.get('conf', 0.35))
    nms_thresh = float(request.args.get('nms', 0.45))
    box_color_hex = request.args.get('color', 'FF0000')
    color_bgr = hex_to_bgr(f"#{box_color_hex}")
    inp_size = int(request.args.get('size', 416))
    classes_str = request.args.get('classes', '')
    classes_filter = classes_str.split(',') if classes_str else []

    def generate():
        cap = cv2.VideoCapture(filepath)
        unique_ids = set()
        
        while cap.isOpened():
            success, frame = cap.read()
            if not success:
                break
                
            if model_choice == 'YOLOv3-Tiny' and app.yolov3_available:
                detections = detector.detect_yolov3(
                    frame, yolov3_net, yolov3_names, conf_thresh, 
                    nms_thresh, inp_size, classes_filter
                )
            elif app.ultralytics_available:
                detections = detector.detect_ultralytics(
                    frame, ultralytics_model, conf_thresh, 
                    nms_thresh, inp_size, classes_filter, tracking=True
                )
            else:
                break
                
            if len(detections) > 0:
                frame = detector.draw_detections(frame, detections, color_bgr)
                for det in detections:
                    tid = det.get('track_id', -1)
                    if tid != -1:
                        unique_ids.add(tid)
            
            # Draw live stats overlay directly onto the video frame
            overlay = frame.copy()
            cv2.rectangle(overlay, (10, 10), (380, 60), (0, 0, 0), -1)
            frame = cv2.addWeighted(overlay, 0.6, frame, 0.4, 0)
            
            count_text = f"Live Tracked Objects: {len(unique_ids)}"
            cv2.putText(frame, count_text, (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            
            ret, buffer = cv2.imencode('.jpg', frame)
            if not ret:
                continue
            
            frame_bytes = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
                   
        cap.release()
        try:
            os.remove(filepath)
        except Exception as e:
            print("Cleanup of stream video failed", e)
            
    return Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/api/detect/webcam', methods=['POST'])
def detect_webcam():
    try:
        print(" Webcam request received")
        
        # Check if any model is available
        if not app.yolov3_available and not app.ultralytics_available:
            error_msg = 'No YOLO models are available for webcam detection.'
            print(f" {error_msg}")
            return jsonify({
                'success': False,
                'error': error_msg
            }), 400

        # Check content type
        if not request.is_json:
            error_msg = 'Request must be JSON'
            print(f" {error_msg}")
            return jsonify({'error': error_msg}), 400

        # Get parameters from JSON
        data = request.get_json()
        if not data:
            error_msg = 'No JSON data received'
            print(f" {error_msg}")
            return jsonify({'error': error_msg}), 400

        print(f" Received data keys: {list(data.keys())}")

        model_choice = data.get('model_choice', 'YOLOv8n')
        confidence = float(data.get('confidence', 0.35))
        nms_thresh = float(data.get('nms_thresh', 0.45))
        box_color = data.get('box_color', '#FF0000')
        inp_size = int(data.get('inp_size', 416))
        detect_only = data.get('detect_only', [])
        
        # Get image data (base64)
        image_data = data.get('image')
        if not image_data:
            error_msg = 'No image data provided in JSON'
            print(f" {error_msg}")
            return jsonify({'error': error_msg}), 400

        print(f" Image data length: {len(image_data)}")

        try:
            # Convert base64 to OpenCV image
            frame = base64_to_cv2(image_data)
            if frame is None:
                error_msg = 'Failed to convert base64 to image'
                print(f" {error_msg}")
                return jsonify({'error': error_msg}), 400
                
            print(f" Frame shape: {frame.shape}")
        except Exception as e:
            error_msg = f'Error converting image: {str(e)}'
            print(f" {error_msg}")
            return jsonify({'error': error_msg}), 400

        color_bgr = hex_to_bgr(box_color)
        classes_filter = detect_only if detect_only else []
        
        # Perform detection
        detections = []
        model_used = 'None'
        
        try:
            if model_choice == 'YOLOv3-Tiny' and app.yolov3_available:
                detections = detector.detect_yolov3(
                    frame, yolov3_net, yolov3_names, confidence, 
                    nms_thresh, inp_size, classes_filter
                )
                model_used = 'YOLOv3-Tiny'
            elif app.ultralytics_available:
                detections = detector.detect_ultralytics(
                    frame, ultralytics_model, confidence, 
                    nms_thresh, inp_size, classes_filter, tracking=True
                )
                model_used = 'YOLOv8n'
            else:
                error_msg = 'No available model for detection'
                print(f" {error_msg}")
                return jsonify({'error': error_msg}), 400
                
            print(f" Detections found: {len(detections)}")
        except Exception as e:
            error_msg = f'Detection error: {str(e)}'
            print(f" {error_msg}")
            return jsonify({'error': error_msg}), 500
        
        # Draw detections
        result_frame = detector.draw_detections(frame.copy(), detections, color_bgr)
        
        # Convert to base64 for response
        result_image = image_to_base64(result_frame)
        
        response_data = {
            'success': True,
            'detections': detections,
            'image': result_image,
            'count': len(detections),
            'model_used': model_used
        }
        
        print(f" Webcam detection successful: {len(detections)} objects detected")
        return jsonify(response_data)
        
    except Exception as e:
        error_msg = f'Webcam detection failed: {str(e)}'
        print(f" {error_msg}")
        return jsonify({'error': error_msg}), 500

@app.route('/api/models', methods=['GET'])
def get_models():
    return jsonify({
        'available_models': {
            'YOLOv3-Tiny': app.yolov3_available,
            'YOLOv8n': app.ultralytics_available
        },
        'recommended_model': 'YOLOv8n' if app.ultralytics_available else 'YOLOv3-Tiny' if app.yolov3_available else 'None'
    })

@app.route('/api/status', methods=['GET'])
def get_status():
    """Detailed status endpoint"""
    yolov3_files = {
        'yolov3-tiny.cfg': os.path.exists('yolov3-tiny.cfg'),
        'yolov3-tiny.weights': os.path.exists('yolov3-tiny.weights'),
        'coco.names': os.path.exists('coco.names')
    }
    
    return jsonify({
        'backend_status': 'running',
        'models': {
            'yolov3_tiny': {
                'available': app.yolov3_available,
                'files': yolov3_files
            },
            'yolov8n': {
                'available': app.ultralytics_available
            }
        },
        'recommendation': 'Use YOLOv8n (auto-downloads)' if app.ultralytics_available else 'Download YOLOv3-Tiny files' if not any(yolov3_files.values()) else 'Fix YOLOv3-Tiny file paths'
    })




if __name__ == '__main__':
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)
    
    print("\n" + "="*50)
    print(" YOLO Object Detection Backend Started!")
    print("="*50)
    print(f" API URL: http://localhost:5000")
    print(f" Health Check: http://localhost:5000/api/health")
    print(f" Status: http://localhost:5000/api/status")
    print(f" Models: http://localhost:5000/api/models")
    print("="*50)
    
    if not app.yolov3_available and not app.ultralytics_available:
        print("\n  WARNING: No YOLO models are currently available!")
        print(" To fix this:")
        print("   1. Wait for YOLOv8n to auto-download (recommended)")
        print("   2. OR Download YOLOv3-Tiny files manually:")
        print("      - yolov3-tiny.cfg")
        print("      - yolov3-tiny.weights") 
        print("      - coco.names")
        print("   3. Place them in the backend directory")
    else:
        print("\n Ready for object detection!")

    # ✅ IMPORTANT FIX FOR RENDER
    import os
    port = int(os.environ.get("PORT", 10000))

    app.run(host='0.0.0.0', port=port)