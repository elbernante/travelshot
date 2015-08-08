'''
ATOM Feed Module
Contains routes for feeds in Atom format
'''

from flask import Blueprint

atom = Blueprint('atom', __name__)

@atom.route('/')
def index():
    '''Test route'''
    return 'Hello World! atom'
