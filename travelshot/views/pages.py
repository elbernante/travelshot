'''
Views Module
Contains routes for rendering HTML pages
'''

from flask import Blueprint
from flask import render_template

pages = Blueprint('pages', __name__)


@pages.route('/index/')
def index():
    '''Test route'''
    return render_template('index.html')

@pages.route('/upload/')
def upload():
    '''Test route'''
    return render_template('upload.html')

