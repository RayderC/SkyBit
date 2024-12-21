import json
import os
import shutil
import time
from flask import request, send_from_directory, render_template, redirect, url_for, send_file
from flask_login import login_required, current_user
from markupsafe import escape

from auth.permissions import mod_required
from . import main_blueprint
from config import BASE_DIRECTORY, CONFIG_DIRECTORY, USERS_FILE_PATH, SITE_NAME
from main.folder_download import get_folder_size, create_zip_folder, create_zip_folder_download
from main.temp_share_manager import load_temp_shares, save_temp_shares, cleanup_expired_links
from .upload import upload_files, upload_folder

# Load temp_shares when the app starts
temp_shares = load_temp_shares()
max_download_size = 5 * 1024 ** 3


# Route: Display contents of a folder
@main_blueprint.route("/", defaults={"folder": ""})
@main_blueprint.route("/<path:folder>")
@login_required
def home(folder):
    """Render the home page with directory contents."""
    folder_path = os.path.join(BASE_DIRECTORY, folder) if folder else BASE_DIRECTORY
    selected_file = request.args.get('selected_file', '')

    with open(USERS_FILE_PATH, 'r') as file:
        data = json.load(file)

    # Retrieve user info from JSON
    username = current_user.username  # Get the logged-in user's username
    role = data.get(username, {}).get("role", "user")  # Fallback to "user" if role is missing

    try:
        files = os.listdir(folder_path)
        dirs = [f for f in files if os.path.isdir(os.path.join(folder_path, f))]
        files_only = [f for f in files if not os.path.isdir(os.path.join(folder_path, f))]
        all_files = sorted(dirs, key=str.lower) + sorted(files_only, key=str.lower)

        # Prepare file details
        files_info = [{"name": f, "is_dir": os.path.isdir(os.path.join(folder_path, f))} for f in all_files]
    except Exception as e:
        print(f"Error reading folder '{folder_path}': {e}")
        files_info = []
        folder = ""
    return render_template("index.html", site_name=SITE_NAME, files=files_info, current_folder=folder, selected_file=selected_file, role=role)


@main_blueprint.route("/preview/<path:filepath>")
@login_required
def preview(filepath):
    """Preview a file."""
    safe_path = os.path.abspath(os.path.join(BASE_DIRECTORY, filepath))
    current_folder = os.path.dirname(filepath)
    if not safe_path.startswith(BASE_DIRECTORY) or not os.path.exists(safe_path):
        print("Invalid file path!")
        return redirect(url_for("main.home"))

    file_extension = os.path.splitext(safe_path)[1].lower()

    try:
        # Check if it's an image
        if file_extension in ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.webp']:
            return render_template("preview.html", site_name=SITE_NAME, filepath=filepath, current_folder=current_folder, file_type="image")

        # Check if it's a text file
        elif file_extension in ['.txt', '.md', '.py', '.json', '.html', '.css', '.js', '.csv', '.xml', '.yml', '.yaml', '.ini', '.log', 'bat']:
            content = None
            encodings_to_try = ['utf-8', 'utf-16', 'latin-1', 'utf-8-sig']
            for encoding in encodings_to_try:
                try:
                    with open(safe_path, 'r', encoding=encoding) as file:
                        content = file.read()
                    break
                except UnicodeDecodeError:
                    continue

            if content is None:
                return render_template("preview.html", site_name=SITE_NAME, filepath=filepath,
                                       current_folder=current_folder, file_type="unsupported")

            with open(USERS_FILE_PATH, 'r') as file:
                data = json.load(file)

            username = current_user.username
            role = data.get(username, {}).get("role", "user")

            return render_template(
                    "preview.html",
                    site_name=SITE_NAME,
                    filepath=filepath,
                    current_folder=current_folder,
                    file_type="text",
                    content=escape(content),  # Escape special characters
                    role=role
                )

        # Other file types (audio, video, etc.)
        elif file_extension in ['.mp3', '.wav', '.ogg', '.aac', '.flac', '.m4a']:
            return render_template("preview.html", site_name=SITE_NAME, filepath=filepath, current_folder=current_folder, file_type="audio")
        elif file_extension in ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.flv', '.wmv']:
            return render_template("preview.html", site_name=SITE_NAME, filepath=filepath, current_folder=current_folder, file_type="video")
        elif file_extension in ['.xls', '.xlsx', '.ods']:
            return render_template("preview.html", site_name=SITE_NAME, filepath=filepath, current_folder=current_folder, file_type="spreadsheet")
        elif file_extension in ['.ppt', '.pptx', '.odp']:
            return render_template("preview.html", site_name=SITE_NAME, filepath=filepath, current_folder=current_folder, file_type="presentation")
        elif file_extension in ['.zip', '.rar', '.tar', '.gz', '.7z']:
            return render_template("preview.html", site_name=SITE_NAME, filepath=filepath, current_folder=current_folder, file_type="archive")

    except Exception as e:
        print(f"Error processing file: {e}")
        return redirect(url_for("main.home", folder=current_folder))

    return render_template("preview.html", site_name=SITE_NAME, filepath=filepath, current_folder=current_folder, file_type="unsupported")


@main_blueprint.route('/save/<path:filepath>', methods=['POST'])
@login_required
@mod_required
def save_file(filepath):
    """Delete everything in the file and then append each line of text"""
    safe_path = os.path.abspath(os.path.join(BASE_DIRECTORY, filepath))

    if not safe_path.startswith(BASE_DIRECTORY) or not os.path.exists(safe_path):
        return redirect(url_for("main.home"))

    content = request.form['content']

    # Split content into lines (preserve all line breaks)
    lines = content.splitlines()

    try:
        # Open the file and write each line
        with open(safe_path, 'w', encoding='utf-8') as file:
            for line in lines:
                file.write(line + '\n')  # Write each line, preserving line breaks

    except Exception as e:
        print(f"Error saving file: {e}")
        return redirect(url_for('main.preview', filepath=filepath))

    return redirect(url_for('main.preview', filepath=filepath))


# Route: Download a file or folder
@main_blueprint.route("/download/<path:filepath>")
@login_required
def download(filepath):
    """Download a file or a zipped folder."""
    try:
        # Safe path to prevent directory traversal
        safe_path = os.path.normpath(os.path.join(BASE_DIRECTORY, filepath))
        if not safe_path.startswith(BASE_DIRECTORY):
            print("Invalid file path!")
            return redirect(url_for("main.home"))

        # If it's a file, just send it as an attachment
        if os.path.isfile(safe_path):
            return send_from_directory(os.path.dirname(safe_path), os.path.basename(safe_path), as_attachment=True)

        # If it's a directory, zip it first and then send the zip file
        elif os.path.isdir(safe_path):
            folder_size = get_folder_size(safe_path)
            if folder_size > max_download_size:
                print("Folder size exceeds the limit.")
                return redirect(url_for("main.home", folder=os.path.dirname(filepath)))

            zip_file_name = f"{os.path.basename(safe_path)}.zip"
            zip_file_path = create_zip_folder_download(safe_path, zip_file_name)

            if zip_file_path:
                # Send the zip file to the user
                return send_file(zip_file_path, as_attachment=True)

            else:
                print(f"Failed to create zip file for: {safe_path}")
                return redirect(url_for("main.home"))

        else:
            print(f"Invalid path: '{filepath}'")
            return redirect(url_for("main.home"))

    except Exception as e:
        print(f"Error downloading '{filepath}': {e}")
        return redirect(url_for("main.home"))


# Route: Render rename form for a file or folder
@main_blueprint.route("/rename/<path:filepath>", methods=["GET", "POST"])
@login_required
@mod_required
def rename(filepath):
    """Render rename form for a file or folder."""
    safe_path = os.path.normpath(os.path.join(BASE_DIRECTORY, filepath))
    if not safe_path.startswith(BASE_DIRECTORY):
        # Invalid path, redirect to home
        return redirect(url_for("main.home"))

    # Extract the file name (without path) for the input field
    current_folder = os.path.dirname(filepath)
    file_name = os.path.basename(filepath)

    if request.method == "POST":
        new_name = request.form.get("new_name", "").strip()
        if not new_name:
            # If new name is empty, reload with error
            return render_template("rename.html", site_name=SITE_NAME, filepath=file_name, error="New name cannot be empty.", current_folder=current_folder)

        # Sanitize new name to prevent directory traversal
        new_name = os.path.basename(new_name)
        new_path = os.path.join(os.path.dirname(safe_path), new_name)

        if os.path.exists(new_path):
            # If the new name already exists, reload with error
            return render_template("rename.html", site_name=SITE_NAME, filepath=file_name, error=f"The file or folder '{new_name}' already exists.", current_folder=current_folder)

        try:
            os.rename(safe_path, new_path)
            # Redirect to home after successful rename
            return redirect(url_for("main.home", folder=current_folder))
        except OSError as e:
            # In case of error renaming, reload with error message
            return render_template("rename.html", site_name=SITE_NAME, filepath=file_name, error=f"Error renaming '{filepath}': {e}", current_folder=current_folder)

    # Render the form if the request method is GET
    return render_template("rename.html", site_name=SITE_NAME, filepath=file_name, current_folder=current_folder)


@main_blueprint.route('/move_file', methods=['POST'])
@login_required
@mod_required
def move_file():
    """Move a file to a new folder."""
    source_path = request.form.get('selected_file').lstrip('/')
    destination_folder = request.form.get('destination_folder')

    if not source_path or not destination_folder:
        return redirect(request.referrer)

    # Normalize the file paths
    safe_file_path = os.path.normpath(os.path.join(BASE_DIRECTORY, source_path))
    safe_target_folder = os.path.normpath(os.path.join(BASE_DIRECTORY, destination_folder))

    # Ensure both paths are within the BASE_DIRECTORY
    if not safe_file_path.startswith(BASE_DIRECTORY) or not safe_target_folder.startswith(BASE_DIRECTORY):
        print("Invalid paths! Moving file outside the allowed directory.")
        return redirect(url_for("main.home"))

    # Extract the file name and extension
    original_file_name = os.path.basename(safe_file_path)
    file_name, file_extension = os.path.splitext(original_file_name)

    # Generate the target file path
    target_file_path = os.path.join(safe_target_folder, original_file_name)

    # Check for duplicates and rename if necessary
    counter = 1
    while os.path.exists(target_file_path):
        new_file_name = f"{file_name} ({counter}){file_extension}"
        target_file_path = os.path.join(safe_target_folder, new_file_name)
        counter += 1

    try:
        # Move the file to the target path
        shutil.move(safe_file_path, target_file_path)
        print(f"Moved {safe_file_path} to {target_file_path}")
    except Exception as e:
        print(f"Error moving file: {e}")
        return redirect(url_for("main.home"))

    # Redirect to the target folder
    return redirect(url_for("main.home", folder=destination_folder))


@main_blueprint.route('/new_folder', methods=['GET', 'POST'])
@login_required
@mod_required
def new_folder():
    current_folder = request.args.get('folder', '')  # Current folder path from query string

    if request.method == 'POST':
        # Get the new folder name from the form
        folder_name = request.form.get('folder_name', '').strip()
        if not folder_name:
            print("Folder name cannot be empty.")
            return render_template('new_folder.html', site_name=SITE_NAME, current_folder=current_folder)

        # Construct the new folder path
        new_folder_path = os.path.join(BASE_DIRECTORY, current_folder, folder_name)

        try:
            # Create the folder
            os.makedirs(new_folder_path)
            print(f"Folder '{folder_name}' created successfully.")
            return redirect(url_for('main.home', folder=current_folder))
        except FileExistsError:
            print(f"Folder '{folder_name}' already exists.")
        except Exception as e:
            print(f"An error occurred: {str(e)}")

    # Render the new folder page
    return render_template('new_folder.html', site_name=SITE_NAME, current_folder=current_folder)


# Route: Upload a folder
@main_blueprint.route("/upload_folder", methods=["POST"])
@login_required
@mod_required
def upload_folder_route():
    """Upload a folder and its contents."""
    return upload_folder(BASE_DIRECTORY)


# Route: Upload files
@main_blueprint.route("/upload_files", methods=["POST"])
@login_required
@mod_required
def upload_files_route():
    """Upload multiple files."""
    return upload_files(BASE_DIRECTORY)


# Route: Confirm file/folder deletion
@main_blueprint.route("/confirm-delete/<path:filepath>")
@login_required
@mod_required
def confirm_delete(filepath):
    """Render confirmation page for deleting a file or folder."""
    safe_path = os.path.normpath(os.path.join(BASE_DIRECTORY, filepath))
    if not safe_path.startswith(BASE_DIRECTORY):
        print("Invalid file path!")
        return redirect(url_for("main.home"))
    return render_template("confirm_delete.html", site_name=SITE_NAME, filepath=filepath)


# Route: Delete a file or folder
@main_blueprint.route("/delete/<path:filepath>/confirm", methods=["POST"])
@login_required
@mod_required
def delete(filepath):
    """Delete a file or folder and redirect to the same folder."""
    safe_path = os.path.normpath(os.path.join(BASE_DIRECTORY, filepath))
    if not safe_path.startswith(BASE_DIRECTORY):
        print("Invalid file path!")
        return redirect(url_for("main.home"))

    # Get the current folder to redirect back to it
    current_folder = os.path.dirname(filepath)

    try:
        if os.path.isfile(safe_path):
            os.remove(safe_path)
            print(f"File deleted: {safe_path}")
        elif os.path.isdir(safe_path):
            shutil.rmtree(safe_path)
            print(f"Folder deleted: {safe_path}")
    except Exception as e:
        print(f"Error deleting '{filepath}': {e}")

    # Redirect to the same folder after deletion
    return redirect(url_for("main.home", folder=current_folder))


@main_blueprint.route("/temp_share_page/<path:filepath>")
@login_required
@mod_required
def temp_share_page(filepath):
    """Render the page to set expiration time for a temporary share link."""
    load_temp_shares()
    file_name = os.path.basename(filepath)  # Extract the file/folder name
    # Check if the path is a directory
    if os.path.isdir(os.path.join(BASE_DIRECTORY, filepath)):
        file_name += "/"  # Append "/" for folders

    return render_template("temp_share.html", site_name=SITE_NAME, filepath=filepath, file_name=file_name)


# Route: Generate a temporary share link
@main_blueprint.route("/generate_temp_share/<path:filepath>", methods=["POST"])
@login_required
@mod_required
def generate_temp_share(filepath):
    """Generate a temporary share link from form submission."""
    cleanup_expired_links(temp_shares)
    try:
        # Validate the file path
        safe_path = os.path.normpath(os.path.join(BASE_DIRECTORY, filepath))

        if not safe_path.startswith(BASE_DIRECTORY):
            return redirect(url_for("main.home"))

        # Get expiration time from the form
        expires_in = int(request.form.get("expires_in", 60))  # Default to 60 minutes
        expiration_time = int(time.time()) + (expires_in * 60)  # Convert to seconds

        # Create a unique token for the folder (or file)
        share_token = f"{hash(int(time.time()))}{hash(filepath)}"

        if os.path.isdir(safe_path):
            folder_size = get_folder_size(safe_path)
            if folder_size > max_download_size:
                print("Folder size exceeds the limit.")
                return redirect(url_for("main.home", folder=os.path.dirname(filepath)))

            is_folder = True
            zip_file_name = f"{os.path.basename(safe_path)}.zip"
            zip_file_path = os.path.join(CONFIG_DIRECTORY, f"{share_token}", zip_file_name)

            if not os.path.exists(zip_file_path):
                parent_path = os.path.dirname(zip_file_path)

                if not os.path.exists(parent_path):
                    os.makedirs(parent_path)

                create_zip_folder(safe_path, zip_file_path)
                file_path = zip_file_path
        else:
            file_path = safe_path
            is_folder = False

        # Store the path and expiration time directly, without zipping
        temp_shares[share_token] = {
            "path": file_path,
            "is_folder": is_folder,
            "expires": expiration_time
        }

        # Save the updated temp_shares
        save_temp_shares(temp_shares)

        # Generate the shareable URL
        share_url = url_for("main.access_temp_share", token=share_token, _external=True)

        return render_template("share_success.html", site_name=SITE_NAME, share_url=share_url, expires_in=expires_in)

    except Exception as e:
        print(f"Error generating temp share link: {e}")
        return redirect(url_for("main.home"))


@main_blueprint.route("/access_temp_share/<token>", methods=["GET", "POST"])
def access_temp_share(token):
    """Serve the shared file or folder if the token is valid and not expired."""
    share_info = temp_shares.get(token)
    if not share_info:
        return "Invalid or expired link!", 404

    # Check if the link has expired
    if time.time() > share_info["expires"]:
        return "This link has expired!", 404

    safe_path = share_info["path"]

    # Calculate time left until expiration
    time_left = max(0, (share_info["expires"] - time.time()) // 60)  # Time left in minutes

    # Handle file download
    if os.path.isfile(safe_path):
        if request.method == "POST":
            return send_file(safe_path, as_attachment=True)

        return render_template("temp_share_download.html", site_name=SITE_NAME,
                               expiration_time=time_left,
                               type="file",
                               file_name=os.path.basename(safe_path),
                               token=token)

    # Handle folder download (zipped)
    elif os.path.isdir(safe_path):
        if request.method == "POST":
            return send_file(safe_path, as_attachment=True)

        return render_template("temp_share_download.html", site_name=SITE_NAME,
                               expiration_time=time_left,
                               type="folder",
                               zip_file_name=os.path.basename(safe_path),
                               token=token)

    else:
        return "Invalid path!", 404
