'''
RSS Feed Module
Contains routes for feeds in RSS format
'''

from flask import Blueprint

rss = Blueprint('rss', __name__)

@rss.route('/')
def index():
    '''Test route'''
    return 'Hello World! RSS'
