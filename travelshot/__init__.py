'''
Travel Shot app module initialization
'''

from flask import Flask

from .models import db
from .utils.util import csrf

app = Flask(__name__, instance_relative_config=True)
app.config.from_object('config')

# Use config.py file in instance/ folder for local development
try:
    app.config.from_pyfile('config.py')
except IOError:
    pass    # No local development config file

db.init_app(app)
csrf.init_app(app)

from .api import api
from .api import authentication
from .api import interface

from .views.pages import pages

from .feeds.atom import atom

app.register_blueprint(api, url_prefix='/api')
app.register_blueprint(pages, url_prefix='/pages')
app.register_blueprint(atom, url_prefix='/atom')
