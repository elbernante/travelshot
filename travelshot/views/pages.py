'''
Views Module
Contains routes for rendering HTML pages
'''

from flask import Blueprint

pages = Blueprint(
    'pages',
    __name__,
    template_folder='templates',
    static_folder='static')

@pages.route('/')
def index():
    '''Test route'''
    return 'Hello World! Html'
