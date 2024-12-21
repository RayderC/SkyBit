from flask import Flask
from werkzeug.middleware.proxy_fix import ProxyFix
from flask_login import LoginManager
from config import SECRET_KEY
from auth import auth_blueprint
from main import main_blueprint
from profile import profile_blueprint
from admin import admin_blueprint
from models import User
from auth.routes import load_users

app = Flask(__name__)
app.secret_key = SECRET_KEY
app.wsgi_app = ProxyFix(app.wsgi_app)
app.config['SESSION_COOKIE_SECURE'] = True

# Initialize Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "auth.login"


# User loader function
@login_manager.user_loader
def load_user(username):
    users = load_users()  # Load users from the JSON file
    if username in users:
        role = users[username]["role"]
        return User(username, role)  # Pass role when creating the User object
    return None  # Return None if the user doesn't exist


# Register blueprints
app.register_blueprint(auth_blueprint)
app.register_blueprint(admin_blueprint)
app.register_blueprint(profile_blueprint)
app.register_blueprint(main_blueprint)

app.config['MAX_CONTENT_LENGTH'] = 1000 * 1024 * 1024

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=7070)
