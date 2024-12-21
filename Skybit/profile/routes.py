import json

from flask import render_template, request, redirect, url_for, flash
from flask_login import login_required, current_user
from werkzeug.security import generate_password_hash
from . import profile_blueprint

from config import USERS_FILE_PATH, SITE_NAME


@profile_blueprint.route("/profile")
@login_required
def profile():
    with open(USERS_FILE_PATH, 'r') as file:
        data = json.load(file)

    # Retrieve user info from JSON
    username = current_user.username  # Get the logged-in user's username
    role = data.get(username, {}).get("role", "user")  # Fallback to "user" if role is missing

    return render_template("profile.html", site_name=SITE_NAME, username=username, role=role)


@profile_blueprint.route("/edit-profile", methods=["GET", "POST"])
@login_required
def edit_profile():
    if request.method == "POST":
        new_username = request.form["username"].strip()
        new_password = request.form["password"].strip()
        confirm_password = request.form["confirm_password"].strip()

        # Validate password match
        if new_password != confirm_password:
            flash("Passwords do not match.", "danger")
            return redirect(url_for('profile.edit_profile'))

        # Update the username and password in the users.json file
        with open(USERS_FILE_PATH, 'r') as file:
            data = json.load(file)

        # Check if the new username already exists
        if new_username in data and new_username != current_user.username:
            flash("Username already exists.", "danger")
            return render_template("edit_profile.html", site_name=SITE_NAME)

        # Update username and password for the logged-in user
        old_username = current_user.username  # Get the old username
        user_data = data.pop(old_username, {})
        user_data["password"] = generate_password_hash(new_password)  # Hash the new password
        data[new_username] = user_data

        # Save the updated data back to the users.json file
        with open(USERS_FILE_PATH, 'w') as file:
            json.dump(data, file, indent=4)

        # Update the current user's username in the session
        current_user.username = new_username

        print("Profile updated successfully!", "success")
        return redirect(url_for('profile.profile'))

    return render_template("edit_profile.html", site_name=SITE_NAME)
