'''
API Module
Contains routes for API calls returning
JSON or XML format.
'''

from flask import Blueprint

api = Blueprint('api', __name__)

@api.route('/')
def index():
    '''Test route'''
    return 'Hello World! API'
