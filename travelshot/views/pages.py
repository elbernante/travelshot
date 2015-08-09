'''
Views Module
Contains routes for rendering HTML pages
'''

from flask import Blueprint
from flask import redirect, url_for
from .. import app

pages = Blueprint(
    'pages',
    __name__,
    template_folder='templates',
    static_folder='static')


@app.route('/')
@app.route('/index/')
@app.route('/index.html')
@pages.route('/')
def index():
    '''Test route'''
    return 'Hello World! Html'
