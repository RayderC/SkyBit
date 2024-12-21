import json
import os
from config import CONFIG_DIRECTORY
from werkzeug.security import generate_password_hash

USERS_FILE = os.path.join(CONFIG_DIRECTORY, "users.json")


def load_users():
    # Check if the users file exists and load it
    if not os.path.exists(USERS_FILE):
        create_default_users()  # Create default users if the file doesn't exist
        return load_users()  # Recursively call load_users again to load the default users

    try:
        with open(USERS_FILE, "r") as file:
            return json.load(file)
    except json.JSONDecodeError:
        print(f"Error decoding JSON in {USERS_FILE}. Returning empty data.")
        return {}
    except Exception as e:
        print(f"Error loading users from {USERS_FILE}: {e}")
        return {}


def save_users(users):
    # Save the users data to the JSON file
    with open(USERS_FILE, "w") as file:
        json.dump(users, file, indent=4)


def create_default_users():
    users = {
        "admin": {
            "password": generate_password_hash("skybit"),
            "role": "admin"
        }
    }
    save_users(users)
