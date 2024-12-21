import os
import shutil
import tempfile
import zipfile
from time import sleep


def get_folder_size(folder_path):
    """Calculate the total size of a folder in bytes."""
    total_size = 0
    for dirpath, dirnames, filenames in os.walk(folder_path):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            if not os.path.islink(fp):
                total_size += os.path.getsize(fp)
    return total_size


def create_zip_folder(folder_path, zip_file_path):
    """Create a zip archive of a folder."""
    try:
        # Create a temporary directory
        with tempfile.TemporaryDirectory() as temp_dir:
            # Copy all files and subdirectories from the folder to the temp directory
            for item in os.listdir(folder_path):
                item_path = os.path.join(folder_path, item)
                temp_item_path = os.path.join(temp_dir, item)

                if os.path.isdir(item_path):
                    shutil.copytree(item_path, temp_item_path)  # Copy subdirectories
                else:
                    shutil.copy2(item_path, temp_item_path)  # Copy individual files

            # Create a zip file from the temporary directory
            with zipfile.ZipFile(zip_file_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for root, dirs, files in os.walk(temp_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, temp_dir)  # Create a relative path inside the zip
                        zipf.write(file_path, arcname)

        print(f"Successfully created zip file: {zip_file_path}")

    except Exception as e:
        print(f"Error creating zip folder: {e}")


def create_zip_folder_download(folder_path, zip_file_name):
    """Create a zip archive of a folder and return the path to the zip file."""
    try:
        # Use a temporary directory for the zip file to avoid deletion
        temp_dir = tempfile.mkdtemp()  # Create a persistent temp directory for the zip file
        temp_zip_file_path = os.path.join(temp_dir, zip_file_name)

        # Create a zip file from the folder
        with zipfile.ZipFile(temp_zip_file_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(folder_path):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, folder_path)  # Create a relative path inside the zip
                    zipf.write(file_path, arcname)

        print(f"Successfully created zip file: {temp_zip_file_path}")
        return temp_zip_file_path

    except Exception as e:
        print(f"Error creating zip folder: {e}")
        return None


def delete_file_after_download(file_path):
    """Delete the file after a short delay to ensure the download is complete."""
    sleep(300)  # Delay to ensure the file is fully downloaded
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            print(f"Deleted file: {file_path}")
    except Exception as e:
        print(f"Error deleting file {file_path}: {str(e)}")
