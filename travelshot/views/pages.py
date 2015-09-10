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
from ..utils.datastore import get_item_with_keys_or_404

pages = Blueprint('pages', __name__)

# TODO: Remove this function
@util.format_response
def format_data_response(data):
    return data

# TODO: Remove this function
@pages.route('/indexxx/')
def indexxx():
    '''Test route'''
    is_requesting_data = False
    if request and request.args:
        is_requesting_data = request.args.get('d', '0') == '1'

    if is_requesting_data:
        return format_data_response({'pagetype': 'homepage'})

    return render_template('indexxx.html')

@pages.route('/index/', methods=['GET'])
@util.smart_request
def index():
    '''Test route'''
    return {'pagetype': 'homepage'}

@pages.route('/login/', methods=['GET'])
@util.smart_request
def login():
    '''Test route'''
    return {'pagetype': 'loginpage'}

@pages.route('/logout/', methods=['GET'])
@util.smart_request
def logout():
    '''Test route'''
    return {'pagetype': 'logoutpage'}

@pages.route('/item/new/', methods=['GET'])
@util.smart_request
def new_item():
    '''Test route'''
    return {'pagetype': 'uploadpage'}

@pages.route('/item/<int:item_id>/', methods=['GET'])
@util.smart_request
def view_item(item_id):
    '''Test route'''
    return {'pagetype': 'viewitempage', 'id': item_id}

@pages.route('/item/<int:item_id>/edit/', methods=['GET'])
@util.smart_request
def edit_item(item_id):
    '''Test route'''
    return {'pagetype': 'edititempage', 'id': item_id}

@pages.route('/item/<int:item_id>/delete/', methods=['GET'])
@util.smart_request
def delete_item(item_id):
    '''Test route'''
    return {'pagetype': 'deleteitempage', 'id': item_id}

@pages.route('/myitems/', methods=['GET'])
@util.smart_request
def view_my_items():
    '''Test route'''
    return {'pagetype': 'myitemspage'}

@pages.route('/latesitems/', methods=['GET'])
@util.smart_request
def view_latest_items():
    '''Test route'''
    return {'pagetype': 'latestitemspage'}

@pages.route('/category/<int:category_id>/items/', methods=['GET'])
@util.smart_request
def view_category(category_id):
    '''Test route'''
    return {'pagetype': 'categorypage', 'id': category_id}

# TODO: Remove this function
@pages.route('/uploadxxx/')
def uploadxxx():
    '''Test route'''
    return render_template('upload.html')

@pages.route('/image/<key>/<filename>', methods=['GET'])
def view_mage(key, filename):
    item_id = ''
    ext = ''
    if '.' in filename:
        (item_id, ext) = filename.rsplit('.', 1)
    get_item_with_keys_or_404(item_id, key, ext)
    return send_from_directory(os.getcwd() + app.config['UPLOAD_FOLDER'],
                               filename)
