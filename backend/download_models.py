import urllib.request
import os

def download_file(url, filename):
    """Download a file from URL"""
    try:
        print(f" Downloading {filename}...")
        urllib.request.urlretrieve(url, filename)
        print(f" Downloaded {filename}")
        return True
    except Exception as e:
        print(f" Failed to download {filename}: {e}")
        return False

def download_yolov3_files():
    """Download YOLOv3-tiny model files"""
    files = {
        'yolov3-tiny.cfg': 'https://raw.githubusercontent.com/pjreddie/darknet/master/cfg/yolov3-tiny.cfg',
        'yolov3-tiny.weights': 'https://pjreddie.com/media/files/yolov3-tiny.weights',
        'coco.names': 'https://raw.githubusercontent.com/pjreddie/darknet/master/data/coco.names'
    }
    
    print(" Downloading YOLOv3-tiny model files...")
    
    success_count = 0
    for filename, url in files.items():
        if not os.path.exists(filename):
            if download_file(url, filename):
                success_count += 1
        else:
            print(f" {filename} already exists")
            success_count += 1
    
    print(f" Download complete: {success_count}/3 files")
    return success_count == 3

if __name__ == '__main__':
    download_yolov3_files()