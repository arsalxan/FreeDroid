#!/usr/bin/env python3
"""
Enhanced file transfer script for FreeDroid app.
Based on the original send.py but supports multiple files.
"""
import subprocess
import sys
import json
import os

def send_files(file_paths, adb_path):
    """
    Sends multiple files to the connected Android device's Download folder using adb.
    Returns a list of results for each file.
    """
    results = []
    remote_dir = "/sdcard/Download/"
    
    for file_path in file_paths:
        if not os.path.exists(file_path):
            results.append({
                'file': os.path.basename(file_path),
                'success': False,
                'error': f'File not found at {file_path}'
            })
            continue
        
        try:
            # Use adb to push the file
            result = subprocess.run(
                [adb_path, "push", file_path, remote_dir],
                check=True,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout per file
            )
            
            results.append({
                'file': os.path.basename(file_path),
                'success': True,
                'message': f'Transferred to {remote_dir}',
                'output': result.stdout.strip() if result.stdout else ''
            })
            
        except subprocess.TimeoutExpired:
            results.append({
                'file': os.path.basename(file_path),
                'success': False,
                'error': 'Transfer timeout (file too large or slow connection)'
            })
        except subprocess.CalledProcessError as e:
            error_msg = e.stderr.strip() if e.stderr else str(e)
            results.append({
                'file': os.path.basename(file_path),
                'success': False,
                'error': f'Transfer failed: {error_msg}'
            })
        except Exception as e:
            results.append({
                'file': os.path.basename(file_path),
                'success': False,
                'error': str(e)
            })
    
    return results

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({
            'error': 'Usage: file-transfer.py <adb_path> <file1> [file2] ...'
        }))
        sys.exit(1)
    
    adb_path = sys.argv[1]
    file_paths = sys.argv[2:]
    
    results = send_files(file_paths, adb_path)
    print(json.dumps(results, indent=2))
