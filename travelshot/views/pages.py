'''
Views Module
Contains routes for rendering HTML pages
'''

import os

from flask import request
from flask import Blueprint
from flask import render_template
from flask import send_from_directory
from flask import current_app as app

from ..utils import util
from ..utils.datastore import get_item_with_id_salt_type_or_404

pages = Blueprint('pages', __name__)

@util.format_response
def format_data_response(data):
    return data

@pages.route('/indexxx/')
def indexxx():
    '''Test route'''
    is_requesting_data = False
    if request and request.args:
        is_requesting_data = request.args.get('d', '0') == '1'

    if is_requesting_data:
        return format_data_response({'pagetype': 'homepage'})

    return render_template('indexxx.html')

@pages.route('/index/')
def index():
    '''Test route'''
    is_requesting_data = False
    if request and request.args:
        is_requesting_data = request.args.get('d', '0') == '1'

    if is_requesting_data:
        return format_data_response({'pagetype': 'homepage'})

    return render_template('index.html')


@pages.route('/login/')
def login():
    '''Test route'''
    is_requesting_data = False
    if request and request.args:
        is_requesting_data = request.args.get('d', '0') == '1'

    if is_requesting_data:
        return format_data_response({'pagetype': 'loginpage'})

    return render_template('index.html')

@pages.route('/logout/')
def logout():
    '''Test route'''
    is_requesting_data = False
    if request and request.args:
        is_requesting_data = request.args.get('d', '0') == '1'

    if is_requesting_data:
        return format_data_response({'pagetype': 'logoutpage'})

    return render_template('index.html')

@pages.route('/item/new/')
def new_item():
    '''Test route'''
    is_requesting_data = False
    if request and request.args:
        is_requesting_data = request.args.get('d', '0') == '1'

    if is_requesting_data:
        return format_data_response({'pagetype': 'uploadpage'})

    return render_template('index.html')

@pages.route('/uploadxxx/')
def uploadxxx():
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
