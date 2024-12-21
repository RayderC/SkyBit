from flask_login import UserMixin
from auth.utils import load_users  # Import load_users here, not inside methods


def get_user_role(username):
    users = load_users()  # Assuming load_users loads a dictionary of users
    return users.get(username, {}).get("role", "user")  # Default to 'user'


class User(UserMixin):
    def __init__(self, username, role=None):
        self.username = username
        self.role = role or get_user_role(username)  # Use get_user_role if role not provided

    def get_role(self):
        return self.role

    def get_id(self):
        return self.username  # Flask-Login needs this to get the unique identifier
