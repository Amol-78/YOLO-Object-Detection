# import cv2
# import numpy as np
# from ultralytics import YOLO
# import os
# import torch

# class YOLODetector:
#     def __init__(self):
#         self.models = {}
        
#     def load_yolov3(self, net_cfg, net_weights, names_path):
#         """Load YOLOv3 model"""
#         try:
#             print(f" Loading YOLOv3 from: {net_cfg}, {net_weights}, {names_path}")
#             net = cv2.dnn.readNetFromDarknet(net_cfg, net_weights)
            
#             with open(names_path, 'rt') as f:
#                 names = f.read().strip().splitlines()
#             print(f" YOLOv3 loaded with {len(names)} classes")
#             return net, names
#         except Exception as e:
#             print(f" Failed to load YOLOv3: {e}")
#             raise Exception(f"Failed to load YOLOv3: {e}")
    
#     def load_ultralytics_model(self, model_name):
#         """Load Ultralytics YOLO model with PyTorch 2.6 compatibility"""
#         try:
#             print(f" Loading Ultralytics model: {model_name}")
            
#             # Fix for PyTorch 2.6 weights_only issue
#             import torch
#             from ultralytics.nn.tasks import DetectionModel
            
#             # Add safe globals for PyTorch 2.6 compatibility
#             torch.serialization.add_safe_globals([DetectionModel])
            
#             model = YOLO(model_name)
#             print(f" {model_name} loaded successfully!")
#             print(f" Model classes: {len(model.names)}")
#             return model
#         except Exception as e:
#             print(f" Failed to load {model_name}: {e}")
#             # Try alternative loading method
#             try:
#                 print(" Trying alternative loading method...")
#                 model = torch.hub.load('ultralytics/yolov5', 'custom', path=model_name, trust_repo=True)
#                 print(f" {model_name} loaded with torch.hub!")
#                 return model
#             except Exception as e2:
#                 print(f" Alternative loading also failed: {e2}")
#                 raise Exception(f"Failed to load {model_name}: {e}")
    
#     def detect_yolov3(self, frame, net, names, conf_thresh=0.35, nms_thresh=0.45, 
#                      inp_size=416, classes_filter=None):
#         """Perform detection with YOLOv3"""
#         try:
#             h, w = frame.shape[:2]
#             blob = cv2.dnn.blobFromImage(frame, 1/255.0, (inp_size, inp_size), [0,0,0], swapRB=False, crop=False)
#             net.setInput(blob)
#             layer_names = net.getUnconnectedOutLayersNames()
#             outs = net.forward(layer_names)

#             boxes, confidences, classIDs = [], [], []
#             for out in outs:
#                 for det in out:
#                     scores = det[5:]
#                     class_id = int(np.argmax(scores))
#                     conf = float(scores[class_id])
#                     if conf > conf_thresh:
#                         cx = int(det[0] * w)
#                         cy = int(det[1] * h)
#                         bw = int(det[2] * w)
#                         bh = int(det[3] * h)
#                         x = int(cx - bw / 2)
#                         y = int(cy - bh / 2)
#                         boxes.append([x, y, bw, bh])
#                         confidences.append(conf)
#                         classIDs.append(class_id)

#             idxs = cv2.dnn.NMSBoxes(boxes, confidences, conf_thresh, nms_thresh)
#             results = []
#             if len(idxs) > 0:
#                 for i in idxs.flatten():
#                     cls_name = names[classIDs[i]] if classIDs[i] < len(names) else str(classIDs[i])
#                     if classes_filter and cls_name not in classes_filter:
#                         continue
#                     x, y, bw, bh = boxes[i]
#                     results.append({
#                         'x': x, 'y': y, 'width': bw, 'height': bh,
#                         'confidence': confidences[i],
#                         'class': cls_name
#                     })
#             return results
#         except Exception as e:
#             print(f" YOLOv3 detection error: {e}")
#             return []
    
#     def detect_ultralytics(self, frame, model, conf_thresh=0.35, nms_thresh=0.45,
#                           inp_size=416, classes_filter=None):
#         """Perform detection with Ultralytics YOLO"""
#         try:
#             # Handle both YOLO and torch.hub models
#             if hasattr(model, 'predict'):
#                 # Standard Ultralytics model
#                 res = model.predict(
#                     source=frame, 
#                     conf=conf_thresh, 
#                     iou=nms_thresh, 
#                     imgsz=inp_size, 
#                     verbose=False
#                 )
#                 r = res[0]
#                 boxes = r.boxes
#             else:
#                 # torch.hub model (YOLOv5)
#                 res = model(frame)
#                 boxes = res.xyxy[0] if len(res.xyxy) > 0 else None
            
#             results = []
#             if boxes is None:
#                 return results
                
#             # Handle different box formats
#             if hasattr(boxes, 'xyxy'):
#                 # Ultralytics format
#                 for box in boxes:
#                     xyxy = box.xyxy[0].cpu().numpy()
#                     conf = float(box.conf[0].cpu().numpy())
#                     cls = int(box.cls[0].cpu().numpy())
#                     cls_name = model.model.names[cls] if hasattr(model, "model") else str(cls)
                    
#                     if classes_filter and cls_name not in classes_filter:
#                         continue
                        
#                     x1, y1, x2, y2 = [int(v) for v in xyxy]
#                     w = x2 - x1
#                     h = y2 - y1
#                     results.append({
#                         'x': x1, 'y': y1, 'width': w, 'height': h,
#                         'confidence': conf,
#                         'class': cls_name
#                     })
#             else:
#                 # torch.hub format
#                 for box in boxes:
#                     x1, y1, x2, y2, conf, cls = box.cpu().numpy()
#                     cls_name = model.names[int(cls)] if hasattr(model, 'names') else str(int(cls))
                    
#                     if classes_filter and cls_name not in classes_filter:
#                         continue
                        
#                     w = x2 - x1
#                     h = y2 - y1
#                     results.append({
#                         'x': int(x1), 'y': int(y1), 'width': int(w), 'height': int(h),
#                         'confidence': float(conf),
#                         'class': cls_name
#                     })
                    
#             return results
#         except Exception as e:
#             print(f" Ultralytics detection error: {e}")
#             return []
    
#     def draw_detections(self, frame, detections, color_bgr):
#         """Draw bounding boxes and labels on frame"""
#         for det in detections:
#             x, y, w, h = det['x'], det['y'], det['width'], det['height']
#             conf = det['confidence']
#             cls_name = det['class']
            
#             # Draw bounding box
#             cv2.rectangle(frame, (x, y), (x + w, y + h), color_bgr, 2)
            
#             # Draw label background
#             label = f"{cls_name} {conf:.2f}"
#             label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)[0]
#             cv2.rectangle(frame, (x, y - label_size[1] - 10), 
#                          (x + label_size[0], y), color_bgr, -1)
            
#             # Draw label text
#             cv2.putText(frame, label, (x, y - 8), 
#                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        
#         return frame
    



#     def process_video(self, input_path, output_path, model, model_type,
#                   conf_thresh=0.35, nms_thresh=0.45, inp_size=416,
#                   classes_filter=None, color_bgr=(0,0,255)):

#         try:
#             cap = cv2.VideoCapture(input_path)

#             if not cap.isOpened():
#                 raise Exception(f"Cannot open video: {input_path}")

#             fps = cap.get(cv2.CAP_PROP_FPS)
#             if fps == 0:
#                 fps = 25

#             width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
#             height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

#             print("Video Info:", width, height, fps)

#             fourcc = cv2.VideoWriter_fourcc(*'mp4v')
#             out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

#             frame_count = 0
#             total_detections = 0

#             while True:

#                 ret, frame = cap.read()

#                 if not ret:
#                     break

#                 # ---------- Detection ----------
#                 if model_type == "yolov3":

#                     detections = self.detect_yolov3(
#                         frame,
#                         model[0],
#                         model[1],
#                         conf_thresh,
#                         nms_thresh,
#                         inp_size,
#                         classes_filter
#                     )

#                 else:

#                     detections = self.detect_ultralytics(
#                         frame,
#                         model,
#                         conf_thresh,
#                         nms_thresh,
#                         inp_size,
#                         classes_filter
#                     )

#                 # ---------- Draw boxes ----------
#                 if len(detections) > 0:
#                     frame = self.draw_detections(frame, detections, color_bgr)

#                 # ---------- Write frame ----------
#                 out.write(frame)

#                 frame_count += 1
#                 total_detections += len(detections)

#                 if frame_count % 30 == 0:
#                     print(f"Processed {frame_count} frames | detections {total_detections}")

#             cap.release()
#             out.release()

#             print("Video processing completed")
#             print("Total Frames:", frame_count)
#             print("Total Detections:", total_detections)

#             return frame_count, total_detections

#         except Exception as e:

#             if 'cap' in locals():
#                 cap.release()

#             if 'out' in locals():
#                 out.release()

#             raise Exception(f"Video processing error: {e}")

    



import cv2
import numpy as np
from ultralytics import YOLO
import os
import torch
import time  # added for sleep

class YOLODetector:
    def __init__(self):
        self.models = {}
        
    def load_yolov3(self, net_cfg, net_weights, names_path):
        """Load YOLOv3 model"""
        try:
            print(f" Loading YOLOv3 from: {net_cfg}, {net_weights}, {names_path}")
            net = cv2.dnn.readNetFromDarknet(net_cfg, net_weights)
            
            with open(names_path, 'rt') as f:
                names = f.read().strip().splitlines()
            print(f" YOLOv3 loaded with {len(names)} classes")
            return net, names
        except Exception as e:
            print(f" Failed to load YOLOv3: {e}")
            raise Exception(f"Failed to load YOLOv3: {e}")
    
    def load_ultralytics_model(self, model_name):
        """Load Ultralytics YOLO model with PyTorch 2.6 compatibility"""
        try:
            print(f" Loading Ultralytics model: {model_name}")
            
            import torch
            from ultralytics.nn.tasks import DetectionModel
            
            torch.serialization.add_safe_globals([DetectionModel])
            
            model = YOLO(model_name)
            print(f" {model_name} loaded successfully!")
            print(f" Model classes: {len(model.names)}")
            return model
        except Exception as e:
            print(f" Failed to load {model_name}: {e}")
            try:
                print(" Trying alternative loading method...")
                model = torch.hub.load('ultralytics/yolov5', 'custom', path=model_name, trust_repo=True)
                print(f" {model_name} loaded with torch.hub!")
                return model
            except Exception as e2:
                print(f" Alternative loading also failed: {e2}")
                raise Exception(f"Failed to load {model_name}: {e}")
    
    def detect_yolov3(self, frame, net, names, conf_thresh=0.35, nms_thresh=0.45, 
                     inp_size=416, classes_filter=None):
        """Perform detection with YOLOv3"""
        try:
            h, w = frame.shape[:2]
            blob = cv2.dnn.blobFromImage(frame, 1/255.0, (inp_size, inp_size), [0,0,0], swapRB=False, crop=False)
            net.setInput(blob)
            layer_names = net.getUnconnectedOutLayersNames()
            outs = net.forward(layer_names)

            boxes, confidences, classIDs = [], [], []
            for out in outs:
                for det in out:
                    scores = det[5:]
                    class_id = int(np.argmax(scores))
                    conf = float(scores[class_id])
                    if conf > conf_thresh:
                        cx = int(det[0] * w)
                        cy = int(det[1] * h)
                        bw = int(det[2] * w)
                        bh = int(det[3] * h)
                        x = int(cx - bw / 2)
                        y = int(cy - bh / 2)
                        boxes.append([x, y, bw, bh])
                        confidences.append(conf)
                        classIDs.append(class_id)

            idxs = cv2.dnn.NMSBoxes(boxes, confidences, conf_thresh, nms_thresh)
            results = []
            if len(idxs) > 0:
                for i in idxs.flatten():
                    cls_name = names[classIDs[i]] if classIDs[i] < len(names) else str(classIDs[i])
                    if classes_filter and cls_name not in classes_filter:
                        continue
                    x, y, bw, bh = boxes[i]
                    results.append({
                        'x': x, 'y': y, 'width': bw, 'height': bh,
                        'confidence': confidences[i],
                        'class': cls_name
                    })
            return results
        except Exception as e:
            print(f" YOLOv3 detection error: {e}")
            return []
    
    def detect_ultralytics(self, frame, model, conf_thresh=0.35, nms_thresh=0.45,
                          inp_size=416, classes_filter=None, tracking=False):
        """Perform detection or tracking with Ultralytics YOLO"""
        try:
            if hasattr(model, 'track') and tracking:
                res = model.track(
                    source=frame, 
                    conf=conf_thresh, 
                    iou=nms_thresh, 
                    imgsz=inp_size, 
                    persist=True,
                    tracker="bytetrack.yaml",
                    verbose=False
                )
                r = res[0]
                boxes = r.boxes
            elif hasattr(model, 'predict'):
                res = model.predict(
                    source=frame, 
                    conf=conf_thresh, 
                    iou=nms_thresh, 
                    imgsz=inp_size, 
                    verbose=False
                )
                r = res[0]
                boxes = r.boxes
            else:
                res = model(frame)
                boxes = res.xyxy[0] if len(res.xyxy) > 0 else None
            
            results = []
            if boxes is None:
                return results
                
            if hasattr(boxes, 'xyxy'):
                for box in boxes:
                    xyxy = box.xyxy[0].cpu().numpy()
                    conf = float(box.conf[0].cpu().numpy())
                    cls = int(box.cls[0].cpu().numpy())
                    cls_name = model.model.names[cls] if hasattr(model, "model") else str(cls)
                    
                    track_id = -1
                    if hasattr(box, 'id') and box.id is not None:
                        track_id = int(box.id[0].cpu().numpy())
                        
                    if classes_filter and cls_name not in classes_filter:
                        continue
                        
                    x1, y1, x2, y2 = [int(v) for v in xyxy]
                    w = x2 - x1
                    h = y2 - y1
                    results.append({
                        'x': x1, 'y': y1, 'width': w, 'height': h,
                        'confidence': conf,
                        'class': cls_name,
                        'track_id': track_id
                    })
            else:
                for box in boxes:
                    x1, y1, x2, y2, conf, cls = box.cpu().numpy()
                    cls_name = model.names[int(cls)] if hasattr(model, 'names') else str(int(cls))
                    
                    if classes_filter and cls_name not in classes_filter:
                        continue
                        
                    w = x2 - x1
                    h = y2 - y1
                    results.append({
                        'x': int(x1), 'y': int(y1), 'width': int(w), 'height': int(h),
                        'confidence': float(conf),
                        'class': cls_name
                    })
                    
            return results
        except Exception as e:
            print(f" Ultralytics detection error: {e}")
            return []
    
    def draw_detections(self, frame, detections, color_bgr):
        """Draw bounding boxes and labels on frame"""
        for det in detections:
            x, y, w, h = int(det['x']), int(det['y']), int(det['width']), int(det['height'])
            conf = det['confidence']
            cls_name = det['class']
            track_id = det.get('track_id', -1)
            
            cv2.rectangle(frame, (x, y), (x + w, y + h), color_bgr, 2)
            
            if track_id != -1:
                label = f"ID:{track_id} {cls_name} {conf:.2f}"
            else:
                label = f"{cls_name} {conf:.2f}"
            label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)[0]
            cv2.rectangle(frame, (x, y - label_size[1] - 10), 
                         (x + label_size[0], y), color_bgr, -1)
            
            cv2.putText(frame, label, (x, y - 8), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        
        return frame

    def process_video(self, input_path, output_path, model, model_type,
                  conf_thresh=0.35, nms_thresh=0.45, inp_size=416,
                  classes_filter=None, color_bgr=(0,0,255)):
        """Process video with detection and save output using imageio"""
        try:
            import imageio
            cap = cv2.VideoCapture(input_path)
            if not cap.isOpened():
                raise Exception(f"Cannot open video: {input_path}")

            fps = cap.get(cv2.CAP_PROP_FPS)
            if fps == 0:
                fps = 25

            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

            print("Video Info:", width, height, fps)

            # Use yuv420p pixel format which is universally supported by web browsers
            # macro_block_size=16 ensures dimensions are compatible with H.264
            writer = imageio.get_writer(
                output_path, 
                fps=fps, 
                format='FFMPEG', 
                codec='libx264',
                pixelformat='yuv420p',
                macro_block_size=16
            )
            frame_count = 0
            total_detections = 0
            unique_ids = set()

            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                if model_type == "yolov3":
                    detections = self.detect_yolov3(
                        frame,
                        model[0],
                        model[1],
                        conf_thresh,
                        nms_thresh,
                        inp_size,
                        classes_filter
                    )
                else:
                    detections = self.detect_ultralytics(
                        frame,
                        model,
                        conf_thresh,
                        nms_thresh,
                        inp_size,
                        classes_filter,
                        tracking=True
                    )

                if len(detections) > 0:
                    frame = self.draw_detections(frame, detections, color_bgr)
                    for det in detections:
                        if det.get('track_id', -1) != -1:
                            unique_ids.add(det['track_id'])

                # Convert BGR (OpenCV) to RGB (imageio)
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                writer.append_data(frame_rgb)

                frame_count += 1
                total_detections += len(detections)

                if frame_count % 30 == 0:
                    print(f"Processed {frame_count} frames | detections {total_detections}")

            cap.release()
            writer.close()
            # Give OS a moment to flush the file
            time.sleep(0.5)

            print("Video processing completed")
            print("Total Frames:", frame_count)
            print("Total Detections (across all frames):", total_detections)
            print("Total Unique Objects Tracked:", len(unique_ids))

            unique_count = len(unique_ids) if len(unique_ids) > 0 else total_detections
            return frame_count, total_detections, unique_count

        except Exception as e:
            if 'cap' in locals():
                cap.release()
            if 'writer' in locals():
                try: writer.close()
                except: pass
            raise Exception(f"Video processing error: {e}")