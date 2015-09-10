'''
Contains API end points related to CRUD operations.

The returned response can either be JSON or XML format.

The format is determined from `?format=` query param of the request URL.
If none is supplied, defaults to JSON.
'''

import os

from flask import request
from flask import url_for
from flask import session as login_session
from flask import current_app as app

from werkzeug.exceptions import BadRequest
from werkzeug.exceptions import Unauthorized
from werkzeug.exceptions import NotFound

from ..utils import util
from ..utils import datastore as ds

from . import api


@api.route('/featured/', methods=['GET'])
@util.format_response
def featured_images():
    '''Returns featured photos for the page cover.

    Returns: Array of URLs for images, each pointing to an image resource.
    '''

    images = []
    for i in range(1, 13):
        images.append(url_for('static', filename='images/cover_{}.jpg'.format(i)))
    return images


@api.route('/myitems/', methods=['GET'])
@util.csrf_protect_enable
@util.require_login
@util.format_response
def my_items():
    '''Returns the items created by the current user. CSRF-protected.

    Requires:
        CSRF token - The request must include a CSRF token to use this
                        end point.
        Logged in  - The user must be logged in to use this end point.

    Returns: Array of item object. Returns and empty array if the the user does
                not have any created items. Returns an error object if the
                request does not have a valid CSRF token, or if there is no user
                currently logged in.
    '''

    res = ds.get_items_by_author(login_session['user_id'])
    items = []
    for i in res:
        items.append(util.serialize_item_object(i))
    return items


@api.route('/items/latest/', methods=['GET'])
@util.format_response
def get_latest_items():
    '''Returns the 24 most recently created items.

    Returns: Array of item objects sorted by recently created, or an empty array
                if there is none.
    '''

    res = ds.get_latest_items(limit=24)
    items = []
    for item in res:
        items.append(util.serialize_item_object(item))
    return items


@api.route('/categories/', methods=['GET'])
@util.format_response
def get_categories():
    '''Returns the available categories in the database.

    Returns: Array of category objects, or an empty array if there is none.
    '''

    res = ds.get_categories()
    cats = []
    for category in res:
        cats.append(category.serialize)
    return cats


@api.route('/category/<int:category_id>/items/', methods=['GET'])
@util.format_response
def get_category_items(category_id):
    '''Returns the category info and all items in the category.

    Prameters:
        category_id - Required. The ID of the category.

    Returns: Object with category info and array of item objects. Returns an
                error object if category_id is invalid.
    '''

    category = ds.get_category_by_id(category_id)
    if category is None:
        raise NotFound('Category not found.')

    query = ds.get_all_items_for_category(category_id)
    items = []
    for i in query:
        items.append(util.serialize_item_object(i))

    return {
        'category': category.serialize,
        'items': items
    }


@api.route('/item/new/', methods=['POST'])
@util.csrf_protect_enable
@util.require_login
@util.format_response
def upload_new_item():
    '''Saves new item into the database. CSRF-protected.

    The the photo for the item is saved in the file system with filename:
        [item_id].[extenstion]
    in the `/uploads/images/` folder (see config.py). The filename is the ID of
    the item. The original file extension of the submitted image is preserved.

    Accepts `multipart/form-data` post requests.

    Requires:
        CSRF token - The request must include a CSRF token to use this
                        end point.
        Logged in  - The user must be logged in to use this end point.

    POST Form Fields:
        image       - Required. File. Image file to be saved.
        category    - Required. Integer. Category ID for the item.
        title       - Optional. Text. Title for the item.
        description - Optional. Text. Description for the item.

    Returns: Item object representing the newly created item, or error object if
                an error occured while saving. Returns an error object if the
                request does not have a valid CSRF token, or if there is no user
                currently logged in.
    '''

    image = request.files.get('image', None)
    if image is None or not util.allowed_file(image.filename):
        raise BadRequest('Invalid image.')

    img_type = image.filename.rsplit('.', 1)[1]

    item = ds.new_item({
        'title': request.form.get('title', None),
        'category': request.form.get('category', None),
        'description': request.form.get('description', None),
        'image_type': img_type,
        'author': login_session.get('user_id', None),
        'salt': util.random_key()
        })

    if item is None:
        raise BadRequest('Invalid upload request.')

    image_filename = '{}.{}'.format(item.id, img_type)
    image.save(os.path.join(os.getcwd() + app.config['UPLOAD_FOLDER'], \
        image_filename))

    return util.serialize_item_object(item)


@api.route('/item/<int:item_id>/', methods=['GET'])
@util.format_response
def get_item(item_id):
    '''Return item object of the the specified item ID.

    Parameters:
        item_id - Required. Integer. ID of of the item.

    Returns: Item object, or error object if item_id does not exists.
    '''

    item = ds.get_item_by_id(item_id)
    if item is None:
        raise NotFound('Item not found')
    return util.serialize_item_object(item)


@api.route('/item/<int:item_id>/edit/', methods=['POST'])
@util.csrf_protect_enable
@util.require_login
@util.format_response
def edit_item(item_id):
    '''Updates an existing item in the database. CSRF-protected.

    The the photo for the item is saved in the file system with filename:
        [item_id].[extenstion]
    in the `UPLOAD_FOLDER` folder (see config.py). The filename is the ID of
    the item. The original file extension of the submitted image is preserved.

    Accepts `multipart/form-data` or `application/json` post requests.

    If the request contains an image to replace the original, the content-type
    `multipart/form-data` should be used.

    If the request is not replacing the image file, there is no need to include
    the image file in the request, and `application/json` content-type can be
    used for faster uploading.

    All form fields are optional (except for `item_id`). If a field is not
    supplied, the original value in the database is unchanged.

    The currently logged in user should be the author of the item to be updated,
    otherwise Unauthorized error will be raised.

    Requires:
        CSRF token - The request must include a CSRF token to use this
                        end point.
        Logged in  - The user must be logged in to use this end point, and is
                        the author of the item to be updated.

    Parameters:
        item_id - Required. ID of the item to be updated. This should match with
                    the value item_id field in the form.

    POST Form Fields:
        item_id     - Required. Integer. ID of the item to be updated.
        image       - Optional. File. Image file to replace the original.
        category    - Optional. Integer. Category ID for the item.
        title       - Optional. Text. Title for the item.
        description - Optional. Text. Description for the item.

    Returns: Item object with the updated values, or error object if an error
                occured while saving. Returns an error object if the request
                does not have a valid CSRF token, or if there is no user
                currently logged in, or if the current user is not the author of
                the item being updated.
    '''

    if request.content_type == 'application/json':
        data = request.json
    else:
        data = request.form

    if data is None:
        raise BadRequest('Invalid edit request.')

    try:
        req_item_id = int(data.get('item_id', None))
    except ValueError:
        raise BadRequest('Invalid item ID.')

    if item_id != req_item_id:
        raise BadRequest('Invalid item.')

    item = ds.get_item_by_id(item_id)
    if item is None:
        raise NotFound('Item not found.')

    if item.author_id != login_session.get('user_id'):
        raise Unauthorized('Edit access denied.')

    item.title = data.get('title', None) or item.title
    item.category_id = data.get('category', None) or item.category_id
    item.description = data.get('description', None) or item.description

    # Check if image was changed
    image = request.files.get('image', None)
    if image is not None:
        if not util.allowed_file(image.filename):
            raise BadRequest('Invalid image.')

        img_type = image.filename.rsplit('.', 1)[1]
        item.image_type = img_type
        item.salt = util.random_key()

    item = ds.save_item(item)
    if item is None:
        raise BadRequest('Error updating item.')

    image_filename = '{}.{}'.format(item.id, item.image_type)
    if image is not None:
        image.save(os.path.join(os.getcwd() + app.config['UPLOAD_FOLDER'], \
            image_filename))

    return util.serialize_item_object(item)


@api.route('/item/<int:item_id>/delete/', methods=['GET', 'POST'])
@util.csrf_protect_enable
@util.require_login
@util.format_response
def delete_item(item_id):
    '''Deletes an existing item from the database. CSRF-protected.

    The currently logged in user should be the author of the item to be deleted,
    otherwise Unauthorized error will be raised.

    GET request method will return a nonce token to be used with the actual
    delete request (using POST method).

    POST request method will validate the nonce token (returned by GET method)
    and delete the item from the database.

    Requires:
        CSRF token - The request must include a CSRF token to use this
                        end point.
        Logged in  - The user must be logged in to use this end point, and is
                        the author of the item to be deleted.

    Parameters:
        item_id - Required. ID of the item to be deleted.

    POST Form Fields:
        nonce_token - Required. Text. Nonce token acquired from GET request
                        method.

    Returns: Nonce token object for GET method or success object for POST
                method. Returns an error object if the request does not have a
                valid CSRF token, or if there is no user currently logged in, or
                if the current user is not the author of the item to be deleted.
    '''

    item = ds.get_item_by_id(item_id)
    if item is None:
        raise NotFound('Item not found.')

    if item.author_id != login_session.get('user_id'):
        raise Unauthorized('Delete access denied.')

    token_key = 'delete_nonce_token'
    key = '{}:{}'.format(token_key, item_id)
    if request.method == 'GET':
        login_session[key] = util.random_key()
        return {'nonce_token': login_session[key]}
    else:
        token = request.json.get('nonce_token', None)
        if token is None:
            raise BadRequest('Invalid nonce token.')

        stored_token = login_session.get(key, None)
        if stored_token != token:
            raise BadRequest('Invalid nonce token.')

        del login_session[key]
        if not ds.delete_item(item):
            raise BadRequest('Error deleting item.')

        return {'success': True}
