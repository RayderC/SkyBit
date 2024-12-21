import json
import os
import shutil
import time
from datetime import datetime
from config import CONFIG_DIRECTORY


def save_temp_shares(temp_shares_to_save):
    """Save the temp_shares dictionary to a JSON file."""
    print(f"saved: {temp_shares_to_save}")
    try:
        temp_shares_file = os.path.join(CONFIG_DIRECTORY, "temp_shares.json")
        if not temp_shares_to_save:  # Check if the dictionary is empty
            temp_shares_to_save = {}
            print("temp_shares is empty.")
        with open(temp_shares_file, "w") as f:
            json.dump(temp_shares_to_save, f, indent=4)
    except Exception as e:
        print(f"Error saving temp_shares: {e}")


def load_temp_shares():
    """Load the temp_shares dictionary from a JSON file."""
    try:
        temp_shares_file = os.path.join(CONFIG_DIRECTORY, "temp_shares.json")
        if os.path.exists(temp_shares_file):
            with open(temp_shares_file, "r") as f:
                return json.load(f)  # Return loaded JSON data
        else:
            return {}  # Return an empty dictionary if the file doesn't exist
    except json.JSONDecodeError:
        print("Error: temp_shares.json is corrupted. Returning an empty dictionary.")
        return {}  # Return an empty dictionary if the file is corrupted
    except Exception as e:
        print(f"Unexpected error loading temp_shares: {e}")
        return {}  # Catch other exceptions and return an empty dictionary


# In your temp_share_manager.py, ensure cleanup_expired_links is defined correctly:
def cleanup_expired_links(temp_shares):
    """Remove expired links from temp_shares and delete associated folders."""
    current_time = time.time()

    # Collect expired links
    expired_links = [token for token, share_info in temp_shares.items() if current_time > share_info["expires"]]

    for token in expired_links:
        share_info = temp_shares[token]
        file_path = share_info["path"]
        parent_path = os.path.dirname(file_path)

        # Check if the path is a directory before deleting
        if os.path.isdir(parent_path):
            try:
                shutil.rmtree(parent_path)  # Remove the directory and its contents
                print(f"Deleted expired folder: {parent_path}")
            except Exception as e:
                print(f"Error deleting folder {parent_path}: {e}")
        else:
            print(f"Skipped deletion for file (not a folder): {parent_path}")

        # Remove the expired link
        del temp_shares[token]

    # Save the updated temp_shares after cleanup
    save_temp_shares(temp_shares)

    print(f"Expired links removed: {expired_links}")


def is_expired(expiration_timestamp):
    """Check if the given timestamp has expired."""
    current_time = datetime.now().timestamp()
    return current_time > expiration_timestamp


def format_expiration_time(expiration_timestamp):
    """Format the expiration timestamp into a readable date and time string."""
    return datetime.fromtimestamp(expiration_timestamp).strftime("%Y-%m-%d %H:%M:%S")
