import os
import json

_basedir = os.path.abspath(os.path.dirname(__file__))

DEBUG = False # Turns on debugging features in Flask
MAIL_FROM_EMAIL = 'elbernante@gmail.com' # For use in application emails

CLIENT_ID = json.loads(open('g_client_secrets.json', 'r').read())['web']['client_id']
APPLICATION_NAME = 'Travel Shot'

FB_APP_ID = json.loads(open('fb_client_secrets.json', 'r').read())['web']['app_id']
FB_APP_SECRET = json.loads(open('fb_client_secrets.json', 'r').read())['web']['app_secret']

SQLALCHEMY_ECHO = False
SQLALCHEMY_TRACK_MODIFICATIONS = False
SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(_basedir, 'travelshot.db')

# Image upload settings
UPLOAD_FOLDER = '/travelshot/uploads/images'
ALLOWED_EXTENSIONS = set(['png', 'jpg', 'jpeg', 'gif'])
# Allow up to 8 MB maximum image size
MAX_CONTENT_LENGTH = 8 * 1024 * 1024

# Enable protection agains *Cross-site Request Forgery (CSRF)*
CSRF_ENABLED = True
WTF_CSRF_CHECK_DEFAULT = False
WTF_CSRF_TIME_LIMIT = 7 * 24 * 60 * 60
WTF_CSRF_METHODS = ['GET', 'POST', 'PUT', 'PATCH']
WTF_CSRF_SECRET_KEY = '\x929\xac\n,6\xcb\xcc\xbeS\xda\x7f\xf5\xbfY\x86\xe7\x9aS\xaek\xbfv\x9d'

# Secret key for signing cookies
SECRET_KEY = '\x10Y&\xca\x02\xf1AI\xb3\xf3\xae\x9fC\xd6\xcfcl\x95\xc1\x98BB\xd1\xa1'