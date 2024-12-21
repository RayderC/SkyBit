from flask import render_template, redirect, url_for, request, flash
from flask_login import login_user, logout_user, login_required
from werkzeug.security import check_password_hash
from . import auth_blueprint
from models import User
from auth.utils import load_users
from config import SITE_NAME


# Login route
@auth_blueprint.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form["username"].lower()  # Convert to lowercase
        password = request.form["password"]

        users = load_users()

        # Find the user with a case-insensitive comparison
        # Normalize the stored usernames to lowercase before checking
        normalized_users = {user.lower(): data for user, data in users.items()}

        if username in normalized_users and check_password_hash(normalized_users[username]["password"], password):
            user = User(username)
            login_user(user)
            print("Logged in successfully!")
            return redirect(url_for("main.home"))
        else:
            flash("Invalid username or password", "danger")

    return render_template("login.html", site_name=SITE_NAME)

# Logout route
@auth_blueprint.route("/logout")
@login_required
def logout():
    logout_user()
    print("You have been logged out.")
    return redirect(url_for("auth.login"))
