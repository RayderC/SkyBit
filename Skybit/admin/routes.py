import json
import os
import shutil
from datetime import datetime

from flask import render_template, request, redirect, url_for
from flask_login import login_required, current_user
from werkzeug.security import generate_password_hash

from auth.permissions import admin_required
from . import admin_blueprint
from config import USERS_FILE_PATH, SITE_NAME
from main.temp_share_manager import load_temp_shares, is_expired, format_expiration_time, save_temp_shares, \
    cleanup_expired_links


def load_users():
    """Helper function to load users from the JSON file, treating usernames as case-insensitive."""
    try:
        with open(USERS_FILE_PATH, 'r') as file:
            users = json.load(file)
        # Normalize usernames to lowercase for case-insensitive comparison
        return {username.lower(): user_data for username, user_data in users.items()}
    except FileNotFoundError:
        print("User file not found. Please check the configuration.")
    except json.JSONDecodeError:
        print("User file is corrupted. Please fix the file.")
    return {}


def save_users(users):
    """Helper function to save users to the JSON file."""
    try:
        # Normalize usernames to lowercase when saving to ensure consistency
        normalized_users = {username.lower(): user_data for username, user_data in users.items()}
        with open(USERS_FILE_PATH, 'w') as file:
            json.dump(normalized_users, file, indent=4)
    except Exception as e:
        print(f"An error occurred while saving changes: {e}")


# Admin page for managing users
@admin_blueprint.route("/admin")
@login_required
@admin_required
def admin():
    users = load_users()
    return render_template("admin.html", site_name=SITE_NAME, users=users)


@admin_blueprint.route("/admin/add", methods=["GET", "POST"])
@login_required
@admin_required
def add_user():
    users = load_users()

    if request.method == "POST":
        username = request.form.get("username").lower()  # Convert username to lowercase
        password = request.form.get("password")
        role = request.form.get("role")

        # Validate form data
        if not username or not password or not role:
            print("All fields are required.")
            return redirect(url_for("admin.add_user"))

        if username in users:
            print(f"User {username} already exists.")
            return redirect(url_for("admin.add_user"))

        # Hash the password and add the new user
        users[username] = {
            "password": generate_password_hash(password),
            "role": role
        }

        save_users(users)

        print(f"User {username} has been added successfully.")
        return redirect(url_for("admin.admin"))

    return render_template("add_user.html", site_name=SITE_NAME)


@admin_blueprint.route("/admin/edit_user/<username>", methods=["GET", "POST"])
@login_required
@admin_required
def edit_user(username):
    users = load_users()
    username = username.lower()  # Normalize case sensitivity

    # Ensure the user exists
    if username not in users:
        print(f"User '{username}' does not exist.")
        return redirect(url_for('admin.admin'))

    user_data = users[username]

    if request.method == "POST":
        new_username = request.form["username"].strip().lower()
        new_password = request.form["password"].strip()
        confirm_password = request.form["confirm_password"].strip()
        new_role = request.form["role"]

        # Check if new username already exists (excluding the current user)
        if new_username in users and new_username != username:
            print(f"Username '{new_username}' is already taken.")
            return redirect(url_for('admin.edit_user', username=username))

        # Validate password only if provided
        if new_password or confirm_password:
            if new_password != confirm_password:
                print("Passwords do not match.")
                return redirect(url_for('admin.edit_user', username=username))
            # Update password
            user_data["password"] = generate_password_hash(new_password)

        # Update username and role
        if new_username != username:
            del users[username]  # Remove the old username entry
            username = new_username  # Update username for further use

        user_data["role"] = new_role
        users[username] = user_data

        save_users(users)
        print(f"User '{username}' has been updated successfully.")
        return redirect(url_for('admin.admin'))

    # Render the edit form with current user data
    return render_template(
        "edit_user.h, site_name=SITE_NAMEtml",
        username=username,
        role=user_data["role"],
        password_hint="********"  # Placeholder for password
    )


@admin_blueprint.route("/admin/delete/<username>", methods=["GET", "POST"])
@login_required
@admin_required
def delete_user(username):
    username = username.lower()  # Convert username to lowercase

    users = load_users()

    if username == current_user.username.lower():  # Ensure logged-in user doesn't delete their own account
        print("You cannot delete your own account.")
        return redirect(url_for('admin.admin'))

    if username not in users:
        print(f"User '{username}' does not exist.")
        return redirect(url_for('admin.admin'))

    # If the form is submitted, delete the user
    if request.method == "POST":
        del users[username]  # Delete the user
        save_users(users)
        print(f"User '{username}' has been deleted successfully.")
        return redirect(url_for('admin.admin'))

    return render_template("delete_user.html", site_name=SITE_NAME, username=username)


# Admin route to view all temp shares
@admin_blueprint.route("/admin/temp_shares")
@admin_required
@login_required
def manage_temp_shares():
    temp_shares = load_temp_shares()
    cleanup_expired_links(temp_shares)

    expired_shares = {}
    active_shares = {}

    # Separate active and expired temp shares
    for token, data in temp_shares.items():
        if is_expired(data["expires"]):
            expired_shares[token] = data
        else:
            active_shares[token] = data

    # Format expiration times and pass them as formatted_expires
    for token, share in active_shares.items():
        share['formatted_expires'] = format_expiration_time(share['expires'])

    for token, share in expired_shares.items():
        share['formatted_expires'] = format_expiration_time(share['expires'])

    # Return the template with the active and expired shares
    return render_template("temp_shares.html", site_name=SITE_NAME, active_shares=active_shares, expired_shares=expired_shares)


# Admin route to delete a temp share
@admin_blueprint.route("/admin/delete_temp_share/<token>", methods=["GET", "POST"])
@login_required
@admin_required
def delete_temp_share(token):
    temp_shares = load_temp_shares()
    cleanup_expired_links(temp_shares)

    if token not in temp_shares:
        return redirect(url_for("admin.manage_temp_shares"))

        # If the form is submitted, delete the share
    if request.method == "POST":
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

        del temp_shares[token]
        save_temp_shares(temp_shares)
        print(f"Temporary share {token} has been deleted.")

    return render_template("delete_temp_share.html", site_name=SITE_NAME, token=token)


# Admin route to edit expiration time of a temp share
@admin_blueprint.route("/admin/edit_temp_share/<token>", methods=["GET", "POST"])
@login_required
@admin_required
def edit_temp_share(token):
    temp_shares = load_temp_shares()
    cleanup_expired_links(temp_shares)

    if token not in temp_shares:
        print(f"Temp share {token} not found.")
        return redirect(url_for("admin.manage_temp_shares"))

    share = temp_shares[token]

    if request.method == "POST":
        # Update expiration time (in minutes)
        new_expiration = int(request.form["expires_in"]) * 60  # Convert to seconds
        share["expires"] = datetime.now().timestamp() + new_expiration
        save_temp_shares(temp_shares)
        print(f"Temp share {token} expiration updated.")
        return redirect(url_for("admin.manage_temp_shares"))

    # Get the current expiration time in minutes
    current_expiration = (share["expires"] - datetime.now().timestamp()) / 60
    return render_template("edit_temp_share.html", site_name=SITE_NAME, token=token, expires_in=int(current_expiration))
