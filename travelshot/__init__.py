'''
Travel Shot app module initialization
'''
from flask import Flask
from .api.api import api
from .views.pages import pages
from .feeds.atom import atom
from .feeds.rss import rss

import exceptions

app = Flask(__name__, instance_relative_config=True)
app.config.from_object('config')

try:
    app.config.from_pyfile('config.py')
except IOError:
    pass

app.register_blueprint(api, url_prefix='/api')
app.register_blueprint(pages, url_prefix='/pages')
app.register_blueprint(atom, url_prefix='/atom')
app.register_blueprint(rss, url_prefix='/rss')
