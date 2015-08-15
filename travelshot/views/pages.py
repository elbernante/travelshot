'''
Views Module
Contains routes for rendering HTML pages
'''

import os

from flask import Blueprint
from flask import render_template
from flask import send_from_directory
from flask import current_app as app

pages = Blueprint('pages', __name__)


@pages.route('/index/')
def index():
    '''Test route'''
    return render_template('index.html')


@pages.route('/upload/')
def upload():
    '''Test route'''
    return render_template('upload.html')


@pages.route('/image/<filename>')
def view_mage(filename):
    return send_from_directory(os.getcwd() + app.config['UPLOAD_FOLDER'],
                               filename)
