'''
API Module
Contains routes for API calls returning
JSON or XML format.
'''

from flask import Blueprint

from ..database import db_session
from ..models import User


api = Blueprint('api', __name__)

@api.route('/')
def index():
    '''Test route'''
    return 'Hello World! API'

@api.route('/test')
def nilatch():
    user = User(name='Test User')
    db_session.add(user)
    db_session.commit()
    print("User ID: " + str(user.serialize))
    return 'Test User Added'
