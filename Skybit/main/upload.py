import os
import re
import threading

from flask import request, url_for, jsonify

upload_states = {}
upload_lock = threading.Lock()


def upload_folder(BASE_DIRECTORY):
    uploaded_files = request.files.getlist("file")
    current_folder = request.form.get("current_folder", "")
    uploaded_folder_name = os.path.basename(os.path.dirname(uploaded_files[0].filename))

    destination_folder = os.path.join(BASE_DIRECTORY, current_folder) if current_folder else BASE_DIRECTORY
    uploaded_folder = os.path.join(destination_folder, uploaded_folder_name)

    # Handle folder naming conflicts
    if os.path.exists(uploaded_folder):
        base, suffix = re.match(r"(.*?)(\s\(\d+\))?$", uploaded_folder_name).groups()
        counter = 1 if not suffix else int(suffix.strip("()")) + 1
        while os.path.exists(os.path.join(destination_folder, f"{base} ({counter})")):
            counter += 1
        uploaded_folder = os.path.join(destination_folder, f"{base} ({counter})")
    os.makedirs(uploaded_folder, exist_ok=True)

    # Save all files while preserving folder structure
    for uploaded_file in uploaded_files:
        file_paths = []
        relative_path = os.path.relpath(uploaded_file.filename, uploaded_folder_name)
        save_path = os.path.join(uploaded_folder, relative_path)
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        try:
            uploaded_file.save(save_path)
            file_paths.append(save_path)
            print(f"Saved file: {save_path}")
        except Exception as e:
            print(f"Error saving file '{save_path}': {e}")

    if file_paths:
        return jsonify({
            "success": True,
            "files": file_paths,
            "redirect_url": url_for("main.home", folder=current_folder)
        })

    return jsonify({"error": "Files could not be uploaded"}), 500


def upload_files(BASE_DIRECTORY):
    uploaded_files = request.files.getlist("files")
    current_folder = request.form.get("current_folder", "")
    file_paths = []

    if not uploaded_files:
        return jsonify({"error": "No files uploaded"}), 400

    destination_folder = os.path.join(BASE_DIRECTORY, current_folder) if current_folder else BASE_DIRECTORY
    os.makedirs(destination_folder, exist_ok=True)

    for uploaded_file in uploaded_files:
        # Skips empty files
        if not uploaded_file.filename:
            print(f"Skipped empty file: {uploaded_file.filename}")
            continue

        destination_path = os.path.join(destination_folder, uploaded_file.filename)

        # Handle file name conflicts
        if os.path.exists(destination_path):
            base, ext = os.path.splitext(uploaded_file.filename)
            counter = 1
            while os.path.exists(destination_path):
                new_filename = f"{base} ({counter}){ext}"
                destination_path = os.path.join(destination_folder, new_filename)
                counter += 1

        try:
            uploaded_file.save(destination_path)
            file_paths.append(destination_path)
            print(f"File saved to {destination_path}")
        except Exception as e:
            print(f"Error saving file {uploaded_file.filename}: {e}")
            continue  # Proceed with the next file
    if file_paths:
        return jsonify({
            "success": True,
            "files": file_paths,
            "redirect_url": url_for('main.home', folder=current_folder)  # Use current_folder here
        })

    return jsonify({"error": "Files could not be uploaded"}), 500


# non-routes
def get_unique_filename(file_path):
    """Generate a unique filename if the file already exists by appending (+1), (+2), etc."""
    if not os.path.exists(file_path):
        return file_path

    # Split the file into name and extension
    base_name, extension = os.path.splitext(file_path)
    counter = 1

    # Keep trying new filenames until a unique one is found
    while os.path.exists(file_path):
        file_path = f"{base_name} ({counter}){extension}"
        counter += 1

    return file_path


def save_uploaded_file(file, target_folder):
    """Save a single file, ensuring the target folder exists and the filename is unique."""
    relative_path = file.filename
    full_file_path = os.path.join(target_folder, relative_path)

    # Ensure the directory exists
    dir_name = os.path.dirname(full_file_path)
    if not os.path.exists(dir_name):
        os.makedirs(dir_name, exist_ok=True)

    # Check if the file already exists, and if so, generate a unique name
    full_file_path = get_unique_filename(full_file_path)

    try:
        file.save(full_file_path)
        print(f"File '{file.filename}' uploaded successfully to '{target_folder}'")
    except Exception as e:
        print(f"File upload failed: {str(e)}")
        return False

    return True


def get_unique_folder_path(folder_path, folder_name):
    """Generate a unique folder name by appending (x) if the folder already exists in the target directory."""

    original_folder_path = os.path.join(folder_path, folder_name)
    unique_folder_path = original_folder_path
    counter = 1

    # Ensure that the folder is created within the correct target directory
    while os.path.exists(unique_folder_path):
        # Append a counter to the folder name
        unique_folder_path = f"{original_folder_path} ({counter})"
        counter += 1

    try:
        os.makedirs(unique_folder_path, exist_ok=True)  # Create the new unique folder
    except Exception as e:
        print(f"Could not create directory: {str(e)}")
        raise

    return unique_folder_path
