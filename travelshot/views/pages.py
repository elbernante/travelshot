'''
Views Module
Contains routes for rendering HTML pages
'''

import os

from flask import Blueprint
from flask import render_template
from flask import send_from_directory
from flask import current_app as app

from ..utils.datastore import get_item_with_id_salt_type_or_404

pages = Blueprint('pages', __name__)


@pages.route('/index/')
def index():
    '''Test route'''
    return render_template('index.html')


@pages.route('/upload/')
def upload():
    '''Test route'''
    return render_template('upload.html')


@pages.route('/image/<key>/<filename>')
def view_mage(key, filename):
    id = ''
    ext = ''
    if '.' in filename:
        (id, ext) = filename.rsplit('.', 1)
    get_item_with_id_salt_type_or_404(id, key, ext)
    return send_from_directory(os.getcwd() + app.config['UPLOAD_FOLDER'],
                               filename)
