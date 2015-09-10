'''
Pages View Module

Contains routes for rendering HTML pages.

The front-end is a single-page web application and all page routes returns the
same HTML file (handled by @util.smart_request decorator). The HTML file will
include a CSRF token in the header which javascript can retrieve and use for
API requests that requires one.

All front-end operations (e.g. page rendering, front-end validation, etc.) are
handled by javascript and communicate directly to API end points.

The views end-points specified here merely provides a way to tell the front-end
application which page to render based on the request URL.

All pages are decorated with @util.smart_request. Returns either the HTML for
the single-page web app, or the data object that tells the front-end web app
which page to render.

If the request includes a query argument `d=1`, the decorator returns the
resulting value of the function it decorated from (i.e. tells the front-end web
app which page to render). Otherwise, it returns the HTML page.

If it returns a data value, the format can either be JSON or XML which can be
specified with `format=json` or `format=xml` query argument. Defaults to JSON
format.
'''

import os

from flask import Blueprint
from flask import send_from_directory
from flask import current_app as app

from ..utils import util
from ..utils.datastore import get_item_with_keys_or_404

pages = Blueprint('pages', __name__)


@pages.route('/index/', methods=['GET'])
@util.smart_request
def index():
    '''Alias route for home page'''
    return {'pagetype': 'homepage'}


@pages.route('/login/', methods=['GET'])
@util.smart_request
def login():
    '''View route for login page'''
    return {'pagetype': 'loginpage'}


@pages.route('/logout/', methods=['GET'])
@util.smart_request
def logout():
    '''View route for logout page'''
    return {'pagetype': 'logoutpage'}


@pages.route('/item/new/', methods=['GET'])
@util.smart_request
def new_item():
    '''View route for uploading new item'''
    return {'pagetype': 'uploadpage'}


@pages.route('/item/<int:item_id>/', methods=['GET'])
@util.smart_request
def view_item(item_id):
    '''View route for displaying an existing item.

    Parameters:
        item_id - Required. Integer. ID of the item.
    '''
    return {'pagetype': 'viewitempage', 'id': item_id}


@pages.route('/item/<int:item_id>/edit/', methods=['GET'])
@util.smart_request
def edit_item(item_id):
    '''View route for editing an exiting item.

    Parameters:
        item_id - Required. Integer. ID of the item.
    '''
    return {'pagetype': 'edititempage', 'id': item_id}


@pages.route('/item/<int:item_id>/delete/', methods=['GET'])
@util.smart_request
def delete_item(item_id):
    '''View route for cofirmation page to delete an item.

    Parameters:
        item_id - Required. Integer. ID of the item.
    '''
    return {'pagetype': 'deleteitempage', 'id': item_id}


@pages.route('/myitems/', methods=['GET'])
@util.smart_request
def view_my_items():
    '''View route for displaying the list of items created by the currently
    logged in user.
    '''
    return {'pagetype': 'myitemspage'}


@pages.route('/latesitems/', methods=['GET'])
@util.smart_request
def view_latest_items():
    '''View route for displaying the most recently created items'''
    return {'pagetype': 'latestitemspage'}


@pages.route('/category/<int:category_id>/items/', methods=['GET'])
@util.smart_request
def view_category(category_id):
    '''View route for displaying the most recent items of the specified
    category.

    Parameters:
        category_id - Required. Integer. ID of the category.
    '''
    return {'pagetype': 'categorypage', 'id': category_id}


@pages.route('/image/<key>/<filename>', methods=['GET'])
def view_mage(key, filename):
    '''Returns the image file of the specified file name.

    The parameters key and filename can be obtained from serialized Item object.

    Parameters:
        key      - Required. String. The salt key that was assigned to the item
                    when it was created (or when the image was updated).
        filename - Required. String. The filename of the image.

    Returns: Image file or a NotFound error if the file does not exists.
    '''
    item_id = ''
    ext = ''
    if '.' in filename:
        (item_id, ext) = filename.rsplit('.', 1)
    # Check if item_id, salt key, and file extension match in the database
    get_item_with_keys_or_404(item_id, key, ext)
    return send_from_directory(os.getcwd() + app.config['UPLOAD_FOLDER'],
                               filename)
