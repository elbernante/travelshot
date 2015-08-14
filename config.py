import json

DEBUG = False # Turns on debugging features in Flask
BCRYPT_LEVEL = 12 # Configuration for the Flask-Bcrypt extension
MAIL_FROM_EMAIL = "elbernante@gmail.com" # For use in application emails

CLIENT_ID = json.loads(open('g_client_secrets.json', 'r').read())['web']['client_id']
APPLICATION_NAME = "Travel Shot"

FB_APP_ID = json.loads(open('fb_client_secrets.json', 'r').read())['web']['app_id']
FB_APP_SECRET = json.loads(open('fb_client_secrets.json', 'r').read())['web']['app_secret']

SQLALCHEMY_ECHO = False
SQLALCHEMY_TRACK_MODIFICATIONS = False
SQLALCHEMY_DATABASE_URI = 'sqlite:///travelshot.db'

# Image upload settings
UPLOAD_FOLDER = '/travelshot/uploads/images'
ALLOWED_EXTENSIONS = set(['png', 'jpg', 'jpeg', 'gif'])
MAX_CONTENT_LENGTH = 8 * 1024 * 1024                        # Allow up to 8 MB maximum image size

# Enable protection agains *Cross-site Request Forgery (CSRF)*
CSRF_ENABLED = True

# Use a secure, unique and absolutely secret key for
# signing the data. 
CSRF_SESSION_KEY = '\x929\xac\n,6\xcb\xcc\xbeS\xda\x7f\xf5\xbfY\x86\xe7\x9aS\xaek\xbfv\x9d'

# Secret key for signing cookies
SECRET_KEY = '\x10Y&\xca\x02\xf1AI\xb3\xf3\xae\x9fC\xd6\xcfcl\x95\xc1\x98BB\xd1\xa1'